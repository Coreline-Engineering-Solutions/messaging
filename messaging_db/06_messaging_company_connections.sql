-- ============================================================
-- Messaging Company Connections - Rev 6
-- Purpose: Implements company-to-company connection management
-- with strict access enforcement for messaging.
--
-- Status flow:
--   PENDING  → ACTIVE   (accepted by responder admin)
--   PENDING  → REJECTED (rejected by responder admin)
--   ACTIVE   → REVOKED  (revoked by either admin)
--
-- Design decisions:
--   - Connections are mutual: once active, both companies can interact.
--   - Same-company contacts can always interact without a connection.
--   - Historical messages remain readable after revocation, but new
--     messages and conversations are blocked.
--   - Only company admins can manage connection lifecycle.
--   - Every unique company pair in a group conversation must be connected.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS messaging;

-- =============================================
-- Schema Changes
-- =============================================

-- Add admin role flag so only designated contacts can manage connections.
ALTER TABLE messaging.contact
    ADD COLUMN IF NOT EXISTS is_company_admin BOOLEAN DEFAULT FALSE;

-- =============================================
-- Company Connection Table
-- =============================================

-- Stores each company-to-company relationship with full audit trail.
CREATE TABLE IF NOT EXISTS messaging.company_connection (
    connection_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    requester_company   VARCHAR(30) NOT NULL,
    responder_company   VARCHAR(30) NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    requested_by        BIGINT NOT NULL,
    responded_by        BIGINT,
    requested_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    responded_at        TIMESTAMPTZ,
    revoked_by          BIGINT,
    revoked_at          TIMESTAMPTZ,

    -- Only allow valid status values.
    CONSTRAINT chk_connection_status
        CHECK (status IN ('PENDING', 'ACTIVE', 'REJECTED', 'REVOKED')),

    -- Prevent a company from connecting to itself.
    CONSTRAINT chk_no_self_connection
        CHECK (requester_company <> responder_company),

    FOREIGN KEY (requested_by) REFERENCES messaging.contact(contact_id),
    FOREIGN KEY (responded_by) REFERENCES messaging.contact(contact_id),
    FOREIGN KEY (revoked_by)   REFERENCES messaging.contact(contact_id)
);

-- Prevent duplicate active or pending connections between the same pair,
-- regardless of which company initiated.
CREATE UNIQUE INDEX IF NOT EXISTS uq_company_connection_active_pair
    ON messaging.company_connection (
        LEAST(requester_company, responder_company),
        GREATEST(requester_company, responder_company)
    )
    WHERE status IN ('PENDING', 'ACTIVE');

-- Fast lookup by company and status for dashboard queries.
CREATE INDEX IF NOT EXISTS ix_company_connection_requester
    ON messaging.company_connection (requester_company, status);

CREATE INDEX IF NOT EXISTS ix_company_connection_responder
    ON messaging.company_connection (responder_company, status);

-- Fast lookup for contact visibility filtering by company.
CREATE INDEX IF NOT EXISTS ix_contact_company
    ON messaging.contact (company, active);

-- =============================================
-- Validation Helper Functions
-- =============================================

-- Validates that a contact belongs to a company and holds admin privileges.
-- Returns the contact's company name so callers can use it directly.
CREATE OR REPLACE FUNCTION messaging.fn_assert_company_admin(
    p_contact_id BIGINT
)
RETURNS VARCHAR(30)
LANGUAGE plpgsql
AS $function$
DECLARE
    v_company   VARCHAR(30);
    v_is_admin  BOOLEAN;
BEGIN
    SELECT c.company, c.is_company_admin
    INTO v_company, v_is_admin
    FROM messaging.contact c
    WHERE c.contact_id = p_contact_id
      AND c.active IS TRUE;

    -- Contacts without a company cannot manage connections.
    IF v_company IS NULL THEN
        RAISE EXCEPTION 'Contact % does not exist, is inactive, or has no company assigned',
            p_contact_id;
    END IF;

    IF NOT COALESCE(v_is_admin, FALSE) THEN
        RAISE EXCEPTION 'Contact % is not a company admin', p_contact_id;
    END IF;

    RETURN v_company;
END;
$function$;

-- Returns the company for an active contact. Raises if not found or no company.
CREATE OR REPLACE FUNCTION messaging.fn_get_contact_company(
    p_contact_id BIGINT
)
RETURNS VARCHAR(30)
LANGUAGE plpgsql
AS $function$
DECLARE
    v_company VARCHAR(30);
BEGIN
    SELECT c.company
    INTO v_company
    FROM messaging.contact c
    WHERE c.contact_id = p_contact_id
      AND c.active IS TRUE;

    IF v_company IS NULL THEN
        RAISE EXCEPTION 'Contact % does not exist, is inactive, or has no company assigned',
            p_contact_id;
    END IF;

    RETURN v_company;
END;
$function$;

-- Checks that two companies have an active connection or are the same company.
CREATE OR REPLACE FUNCTION messaging.fn_assert_companies_connected(
    p_company_a VARCHAR(30),
    p_company_b VARCHAR(30)
)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
    v_connected BOOLEAN;
BEGIN
    -- Same company always allowed.
    IF p_company_a = p_company_b THEN
        RETURN;
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM messaging.company_connection cc
        WHERE cc.status = 'ACTIVE'
          AND (
              (cc.requester_company = p_company_a AND cc.responder_company = p_company_b)
              OR
              (cc.requester_company = p_company_b AND cc.responder_company = p_company_a)
          )
    )
    INTO v_connected;

    IF NOT v_connected THEN
        RAISE EXCEPTION 'Companies % and % do not have an active connection',
            p_company_a, p_company_b;
    END IF;
END;
$function$;

-- Validates that every unique pair of companies among the given contacts
-- has an active connection. Used to enforce group conversation rules.
CREATE OR REPLACE FUNCTION messaging.fn_assert_all_participants_connected(
    p_contact_ids BIGINT[]
)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
    r RECORD;
BEGIN
    -- Build every distinct pair of companies from the participant list
    -- and verify each pair is connected.
    FOR r IN
        SELECT DISTINCT
            LEAST(ca.company, cb.company)    AS company_lo,
            GREATEST(ca.company, cb.company) AS company_hi
        FROM unnest(p_contact_ids) AS a(contact_id)
        JOIN messaging.contact ca
          ON ca.contact_id = a.contact_id
         AND ca.active IS TRUE
        CROSS JOIN unnest(p_contact_ids) AS b(contact_id)
        JOIN messaging.contact cb
          ON cb.contact_id = b.contact_id
         AND cb.active IS TRUE
        WHERE a.contact_id < b.contact_id
          AND ca.company IS NOT NULL
          AND cb.company IS NOT NULL
          AND ca.company <> cb.company
    LOOP
        PERFORM messaging.fn_assert_companies_connected(r.company_lo, r.company_hi);
    END LOOP;
END;
$function$;

-- Checks that a sender's company is connected to every other company
-- represented in an existing conversation. Prevents new messages after revocation.
CREATE OR REPLACE FUNCTION messaging.fn_assert_sender_connected_to_conversation(
    p_conversation_id  BIGINT,
    p_sender_contact_id BIGINT
)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
    v_sender_company      VARCHAR(30);
    v_unconnected_company VARCHAR(30);
BEGIN
    v_sender_company := messaging.fn_get_contact_company(p_sender_contact_id);

    -- Find any active participant whose company is not connected to the sender's.
    SELECT DISTINCT c.company
    INTO v_unconnected_company
    FROM messaging.conversation_participant cp
    JOIN messaging.contact c
      ON c.contact_id = cp.contact_id
     AND c.active IS TRUE
    WHERE cp.conversation_id = p_conversation_id
      AND cp.left_at IS NULL
      AND c.company IS NOT NULL
      AND c.company <> v_sender_company
      AND NOT EXISTS (
          SELECT 1
          FROM messaging.company_connection cc
          WHERE cc.status = 'ACTIVE'
            AND (
                (cc.requester_company = v_sender_company AND cc.responder_company = c.company)
                OR
                (cc.requester_company = c.company AND cc.responder_company = v_sender_company)
            )
      )
    LIMIT 1;

    IF v_unconnected_company IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot send message: no active connection between % and %',
            v_sender_company, v_unconnected_company;
    END IF;
END;
$function$;

-- =============================================
-- Connection Management Functions
-- =============================================

-- Sends a connection invite from one company to another.
-- Only a company admin can initiate.
CREATE OR REPLACE FUNCTION messaging.fn_send_connection_invite(
    p_admin_contact_id BIGINT,
    p_target_company   VARCHAR(30)
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $function$
DECLARE
    v_requester_company VARCHAR(30);
    v_connection_id     BIGINT;
    v_existing_status   VARCHAR(20);
BEGIN
    -- Only admins can send connection invites.
    v_requester_company := messaging.fn_assert_company_admin(p_admin_contact_id);

    IF v_requester_company = p_target_company THEN
        RAISE EXCEPTION 'Cannot send a connection invite to your own company';
    END IF;

    -- Verify the target company has at least one active contact.
    IF NOT EXISTS (
        SELECT 1
        FROM messaging.contact
        WHERE company = p_target_company
          AND active IS TRUE
    ) THEN
        RAISE EXCEPTION 'Target company % does not exist or has no active members',
            p_target_company;
    END IF;

    -- Check for an existing active or pending connection between these companies.
    SELECT cc.status
    INTO v_existing_status
    FROM messaging.company_connection cc
    WHERE cc.status IN ('PENDING', 'ACTIVE')
      AND (
          (cc.requester_company = v_requester_company AND cc.responder_company = p_target_company)
          OR
          (cc.requester_company = p_target_company AND cc.responder_company = v_requester_company)
      );

    IF v_existing_status = 'ACTIVE' THEN
        RAISE EXCEPTION 'An active connection already exists between % and %',
            v_requester_company, p_target_company;
    END IF;

    IF v_existing_status = 'PENDING' THEN
        RAISE EXCEPTION 'A pending connection request already exists between % and %',
            v_requester_company, p_target_company;
    END IF;

    INSERT INTO messaging.company_connection (
        requester_company,
        responder_company,
        status,
        requested_by
    )
    VALUES (
        v_requester_company,
        p_target_company,
        'PENDING',
        p_admin_contact_id
    )
    RETURNING connection_id INTO v_connection_id;

    RETURN v_connection_id;
END;
$function$;

-- Responds to a pending connection invite. Only the responder company's admin
-- can accept or reject.
CREATE OR REPLACE FUNCTION messaging.fn_respond_to_connection(
    p_admin_contact_id BIGINT,
    p_connection_id    BIGINT,
    p_accept           BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
    v_responder_company    VARCHAR(30);
    v_connection_responder VARCHAR(30);
    v_current_status       VARCHAR(20);
BEGIN
    -- Only admins can respond to invites.
    v_responder_company := messaging.fn_assert_company_admin(p_admin_contact_id);

    -- Fetch the connection and validate ownership.
    SELECT cc.responder_company, cc.status
    INTO v_connection_responder, v_current_status
    FROM messaging.company_connection cc
    WHERE cc.connection_id = p_connection_id;

    IF v_connection_responder IS NULL THEN
        RAISE EXCEPTION 'Connection % does not exist', p_connection_id;
    END IF;

    -- Only the responder company's admin can accept or reject.
    IF v_connection_responder <> v_responder_company THEN
        RAISE EXCEPTION 'Contact % is not authorized to respond to this connection request',
            p_admin_contact_id;
    END IF;

    IF v_current_status <> 'PENDING' THEN
        RAISE EXCEPTION 'Connection % is not in PENDING status (current: %)',
            p_connection_id, v_current_status;
    END IF;

    UPDATE messaging.company_connection
    SET status       = CASE WHEN p_accept THEN 'ACTIVE' ELSE 'REJECTED' END,
        responded_by = p_admin_contact_id,
        responded_at = CURRENT_TIMESTAMP
    WHERE connection_id = p_connection_id;
END;
$function$;

-- Revokes an active connection. Either company's admin can revoke.
-- After revocation, new messages and conversations are blocked but
-- historical messages remain readable.
CREATE OR REPLACE FUNCTION messaging.fn_revoke_connection(
    p_admin_contact_id BIGINT,
    p_connection_id    BIGINT
)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
    v_admin_company     VARCHAR(30);
    v_requester_company VARCHAR(30);
    v_responder_company VARCHAR(30);
    v_current_status    VARCHAR(20);
BEGIN
    v_admin_company := messaging.fn_assert_company_admin(p_admin_contact_id);

    SELECT cc.requester_company, cc.responder_company, cc.status
    INTO v_requester_company, v_responder_company, v_current_status
    FROM messaging.company_connection cc
    WHERE cc.connection_id = p_connection_id;

    IF v_requester_company IS NULL THEN
        RAISE EXCEPTION 'Connection % does not exist', p_connection_id;
    END IF;

    -- Either side of the connection can revoke it.
    IF v_admin_company <> v_requester_company
       AND v_admin_company <> v_responder_company THEN
        RAISE EXCEPTION 'Contact % is not authorized to revoke this connection',
            p_admin_contact_id;
    END IF;

    IF v_current_status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'Connection % is not in ACTIVE status (current: %)',
            p_connection_id, v_current_status;
    END IF;

    UPDATE messaging.company_connection
    SET status     = 'REVOKED',
        revoked_by = p_admin_contact_id,
        revoked_at = CURRENT_TIMESTAMP
    WHERE connection_id = p_connection_id;
END;
$function$;

-- =============================================
-- Access Resolution Functions
-- =============================================

-- Returns all companies that have an active connection with the given company.
CREATE OR REPLACE FUNCTION messaging.fn_get_allowed_companies(
    p_company VARCHAR(30)
)
RETURNS TABLE (
    connected_company VARCHAR(30),
    connection_id     BIGINT,
    connected_since   TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        CASE
            WHEN cc.requester_company = p_company THEN cc.responder_company
            ELSE cc.requester_company
        END AS connected_company,
        cc.connection_id,
        cc.responded_at AS connected_since
    FROM messaging.company_connection cc
    WHERE cc.status = 'ACTIVE'
      AND (cc.requester_company = p_company OR cc.responder_company = p_company)
    ORDER BY cc.responded_at;
END;
$function$;

-- Returns contacts visible to a given contact: same company plus connected companies.
CREATE OR REPLACE FUNCTION messaging.fn_get_visible_contacts(
    p_contact_id BIGINT
)
RETURNS TABLE (
    contact_id   BIGINT,
    username     VARCHAR(50),
    first_name   VARCHAR(50),
    last_name    VARCHAR(50),
    phone_number VARCHAR(50),
    email        VARCHAR(100),
    company      VARCHAR(30),
    profile_pic  UUID
)
LANGUAGE plpgsql
AS $function$
DECLARE
    v_company VARCHAR(30);
BEGIN
    v_company := messaging.fn_get_contact_company(p_contact_id);

    RETURN QUERY
    SELECT
        c.contact_id,
        c.username,
        c.first_name,
        c.last_name,
        c.phone_number,
        c.email,
        c.company,
        c.profile_pic
    FROM messaging.contact c
    WHERE c.active IS TRUE
      AND c.company IS NOT NULL
      AND (
          -- Same company contacts are always visible.
          c.company = v_company
          OR
          -- Contacts from connected companies are visible.
          c.company IN (
              SELECT ac.connected_company
              FROM messaging.fn_get_allowed_companies(v_company) ac
          )
      )
    ORDER BY c.company, c.last_name, c.first_name;
END;
$function$;

-- Returns all connection records for a company admin's dashboard,
-- ordered by status priority and recency.
CREATE OR REPLACE FUNCTION messaging.fn_get_company_connections(
    p_admin_contact_id BIGINT
)
RETURNS TABLE (
    connection_id         BIGINT,
    requester_company     VARCHAR(30),
    responder_company     VARCHAR(30),
    status                VARCHAR(20),
    requested_by_username VARCHAR(50),
    responded_by_username VARCHAR(50),
    revoked_by_username   VARCHAR(50),
    requested_at          TIMESTAMPTZ,
    responded_at          TIMESTAMPTZ,
    revoked_at            TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $function$
DECLARE
    v_company VARCHAR(30);
BEGIN
    -- Only admins can view the connection dashboard.
    v_company := messaging.fn_assert_company_admin(p_admin_contact_id);

    RETURN QUERY
    SELECT
        cc.connection_id,
        cc.requester_company,
        cc.responder_company,
        cc.status,
        req.username  AS requested_by_username,
        resp.username AS responded_by_username,
        rev.username  AS revoked_by_username,
        cc.requested_at,
        cc.responded_at,
        cc.revoked_at
    FROM messaging.company_connection cc
    LEFT JOIN messaging.contact req  ON req.contact_id  = cc.requested_by
    LEFT JOIN messaging.contact resp ON resp.contact_id = cc.responded_by
    LEFT JOIN messaging.contact rev  ON rev.contact_id  = cc.revoked_by
    WHERE cc.requester_company = v_company
       OR cc.responder_company = v_company
    ORDER BY
        CASE cc.status
            WHEN 'PENDING'  THEN 1
            WHEN 'ACTIVE'   THEN 2
            WHEN 'REJECTED' THEN 3
            WHEN 'REVOKED'  THEN 4
        END,
        cc.requested_at DESC;
END;
$function$;

-- =============================================
-- Updated Messaging Functions with Company Enforcement
-- =============================================

-- Updated: Sends a message with company connection enforcement.
-- Blocks new messages if the sender's company is no longer connected
-- to all other companies in the conversation.
CREATE OR REPLACE FUNCTION messaging.fn_send_message(
    p_conversation_id   BIGINT,
    p_sender_contact_id BIGINT,
    p_message_type      VARCHAR(20),
    p_content           TEXT DEFAULT NULL,
    p_media_url         TEXT DEFAULT NULL
)
RETURNS TABLE (
    message_id      BIGINT,
    conversation_id BIGINT,
    sender_id       BIGINT,
    message_type    VARCHAR(20),
    content         TEXT,
    media_url       TEXT,
    created_at      TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $function$
#variable_conflict use_column
DECLARE
    v_new_message_id BIGINT;
    v_message_type   VARCHAR(20);
BEGIN
    IF p_conversation_id IS NULL THEN
        RAISE EXCEPTION 'conversation_id is required';
    END IF;

    -- The sender must still be an active member of the conversation.
    PERFORM messaging.fn_assert_active_participant(p_conversation_id, p_sender_contact_id);

    -- Enforce company connection rules for cross-company conversations.
    PERFORM messaging.fn_assert_sender_connected_to_conversation(
        p_conversation_id, p_sender_contact_id
    );

    -- Normalize the message type so validation stays case-insensitive.
    v_message_type := UPPER(BTRIM(COALESCE(p_message_type, '')));

    -- Text messages require body content.
    IF v_message_type = 'TEXT' THEN
        IF p_content IS NULL OR BTRIM(p_content) = '' THEN
            RAISE EXCEPTION 'TEXT messages require content';
        END IF;
    -- Image messages require a media URL.
    ELSIF v_message_type = 'IMAGE' THEN
        IF p_media_url IS NULL OR BTRIM(p_media_url) = '' THEN
            RAISE EXCEPTION '% messages require media_url', v_message_type;
        END IF;
    ELSE
        RAISE EXCEPTION 'Unsupported message type: %', p_message_type;
    END IF;

    -- Persist the message and let the database generate the timestamp.
    INSERT INTO messaging.message (
        conversation_id,
        sender_id,
        message_type,
        content,
        media_url
    )
    VALUES (
        p_conversation_id,
        p_sender_contact_id,
        v_message_type,
        NULLIF(BTRIM(p_content), ''),
        NULLIF(BTRIM(p_media_url), '')
    )
    RETURNING messaging.message.message_id INTO v_new_message_id;

    -- Mark the sender's copy as read immediately.
    INSERT INTO messaging.message_read (message_id, contact_id, read_at)
    VALUES (v_new_message_id, p_sender_contact_id, CURRENT_TIMESTAMP)
    ON CONFLICT (message_id, contact_id)
    DO UPDATE SET read_at = EXCLUDED.read_at;

    -- Return the inserted row so callers get the generated id and timestamps.
    RETURN QUERY
    SELECT
        m.message_id,
        m.conversation_id,
        m.sender_id,
        m.message_type,
        m.content,
        m.media_url,
        m.created_at
    FROM messaging.message m
    WHERE m.message_id = v_new_message_id;
END;
$function$;

-- Updated: Creates a new conversation with company connection enforcement.
-- All participant companies must be mutually connected.
CREATE OR REPLACE FUNCTION messaging.fn_create_conversation(
    p_creator_contact_id    BIGINT,
    p_participant_contact_ids BIGINT[],
    p_name                  VARCHAR(50) DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $function$
DECLARE
    v_conversation_id      BIGINT;
    v_recipient_count      INTEGER;
    v_is_group             BOOLEAN;
    v_all_participants     BIGINT[];
    v_invalid_participants INTEGER;
BEGIN
    -- The creator must be able to send into the conversation.
    PERFORM messaging.fn_assert_contact_exists_and_active(p_creator_contact_id);

    -- Require at least one recipient so a conversation is meaningful.
    IF p_participant_contact_ids IS NULL
       OR array_length(p_participant_contact_ids, 1) IS NULL THEN
        RAISE EXCEPTION 'At least one participant is required';
    END IF;

    SELECT COUNT(*)
    INTO v_recipient_count
    FROM (
        SELECT DISTINCT contact_id
        FROM unnest(p_participant_contact_ids) AS participant(contact_id)
        WHERE contact_id <> p_creator_contact_id
    ) recipients;

    IF v_recipient_count = 0 THEN
        RAISE EXCEPTION 'At least one recipient other than the creator is required';
    END IF;

    IF v_recipient_count = 1 THEN
        -- A single recipient means a direct conversation, so the name must stay null.
        IF p_name IS NOT NULL AND btrim(p_name) <> '' THEN
            RAISE EXCEPTION 'Direct conversations cannot have a name';
        END IF;
        v_is_group := FALSE;
    ELSE
        -- Multiple recipients indicate a group conversation, which needs a title.
        IF p_name IS NULL OR btrim(p_name) = '' THEN
            RAISE EXCEPTION 'Group conversations require a name';
        END IF;
        v_is_group := TRUE;
    END IF;

    -- Include the creator in the final participant list for the new chat.
    v_all_participants := ARRAY[p_creator_contact_id];
    v_all_participants := v_all_participants || p_participant_contact_ids;

    -- Reject any participant that does not exist or is inactive.
    SELECT COUNT(*)
    INTO v_invalid_participants
    FROM (
        SELECT DISTINCT contact_id
        FROM unnest(v_all_participants) AS participant(contact_id)
    ) participants
    LEFT JOIN messaging.contact c
      ON c.contact_id = participants.contact_id
     AND c.active IS TRUE
    WHERE c.contact_id IS NULL;

    IF v_invalid_participants > 0 THEN
        RAISE EXCEPTION 'One or more participants do not exist or are inactive';
    END IF;

    -- Enforce company connection rules: all participant companies must be connected.
    PERFORM messaging.fn_assert_all_participants_connected(v_all_participants);

    -- Create the conversation record first so participants can reference it.
    INSERT INTO messaging.conversation (name, is_group)
    VALUES (
        CASE
            WHEN v_is_group THEN btrim(p_name)
            ELSE NULL
        END,
        v_is_group
    )
    RETURNING conversation_id INTO v_conversation_id;

    -- Insert each unique participant once into the membership table.
    INSERT INTO messaging.conversation_participant (conversation_id, contact_id)
    SELECT v_conversation_id, participants.contact_id
    FROM (
        SELECT DISTINCT contact_id
        FROM unnest(v_all_participants) AS participant(contact_id)
    ) participants
    ON CONFLICT (conversation_id, contact_id) DO NOTHING;

    RETURN v_conversation_id;
END;
$function$;

-- Updated: Finds or creates a direct conversation with company connection enforcement.
CREATE OR REPLACE FUNCTION messaging.fn_send_direct_message(
    p_sender_contact_id    BIGINT,
    p_recipient_contact_id BIGINT,
    p_message_type         VARCHAR(20),
    p_content              TEXT DEFAULT NULL,
    p_media_url            TEXT DEFAULT NULL
)
RETURNS TABLE (
    message_id      BIGINT,
    conversation_id BIGINT,
    sender_id       BIGINT,
    message_type    VARCHAR(20),
    content         TEXT,
    media_url       TEXT,
    created_at      TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $function$
DECLARE
    v_conversation_id   BIGINT;
    v_sender_company    VARCHAR(30);
    v_recipient_company VARCHAR(30);
BEGIN
    IF p_sender_contact_id = p_recipient_contact_id THEN
        RAISE EXCEPTION 'Sender and recipient cannot be the same contact';
    END IF;

    -- Enforce company connection before allowing direct messaging.
    v_sender_company    := messaging.fn_get_contact_company(p_sender_contact_id);
    v_recipient_company := messaging.fn_get_contact_company(p_recipient_contact_id);
    PERFORM messaging.fn_assert_companies_connected(v_sender_company, v_recipient_company);

    -- Reuse an existing direct conversation when possible.
    v_conversation_id := messaging.fn_get_direct_conversation_id(
        p_sender_contact_id,
        p_recipient_contact_id
    );

    -- Create the direct conversation lazily if it does not already exist.
    IF v_conversation_id IS NULL THEN
        v_conversation_id := messaging.fn_create_conversation(
            p_sender_contact_id,
            ARRAY[p_recipient_contact_id],
            NULL
        );
    END IF;

    -- Delegate the actual insert to the shared send function.
    RETURN QUERY
    SELECT *
    FROM messaging.fn_send_message(
        v_conversation_id,
        p_sender_contact_id,
        p_message_type,
        p_content,
        p_media_url
    );
END;
$function$;
