CREATE SCHEMA IF NOT EXISTS messaging;

-- Validates that a contact exists and is active before it can participate inconversation, send, or inbox operations.
CREATE OR REPLACE FUNCTION messaging.fn_assert_contact_exists_and_active(
    p_contact_id BIGINT
)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
    v_exists BOOLEAN;
BEGIN
    -- We only allow active contacts to use messaging features.
    SELECT EXISTS (
        SELECT 1
        FROM messaging.contact c
        WHERE c.contact_id = p_contact_id
          AND c.active IS TRUE

    )
    INTO v_exists;

    IF NOT v_exists THEN
        RAISE EXCEPTION 'Contact % does not exist or is inactive', p_contact_id;
    END IF;
END;
$function$;

-- Ensures the contact is both active and currently part of the conversation.
CREATE OR REPLACE FUNCTION messaging.fn_assert_active_participant(
    p_conversation_id BIGINT,
    p_contact_id BIGINT
)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
    v_exists BOOLEAN;
BEGIN
    -- Reuse the contact check so inactive users are rejected early.
    PERFORM messaging.fn_assert_contact_exists_and_active(p_contact_id);

    -- A participant must still be in the conversation to send or read messages.
    SELECT EXISTS (
        SELECT 1
        FROM messaging.conversation_participant cp
        WHERE cp.conversation_id = p_conversation_id
          AND cp.contact_id = p_contact_id
          AND cp.left_at IS NULL
    )
    INTO v_exists;

    IF NOT v_exists THEN
        RAISE EXCEPTION 'Contact % is not an active participant in conversation %', p_contact_id, p_conversation_id;
    END IF;
END;
$function$;

-- Looks up an existing one-to-one conversation between two contacts.
CREATE OR REPLACE FUNCTION messaging.fn_get_direct_conversation_id(
    p_contact_a BIGINT,
    p_contact_b BIGINT
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $function$
DECLARE
    v_conversation_id BIGINT;
BEGIN
    -- Direct chats require exactly two different contacts.
    IF p_contact_a IS NULL OR p_contact_b IS NULL THEN
        RAISE EXCEPTION 'Both contact ids are required';
    END IF;

    IF p_contact_a = p_contact_b THEN
        RAISE EXCEPTION 'Direct conversations require two different contacts';
    END IF;

    PERFORM messaging.fn_assert_contact_exists_and_active(p_contact_a);
    PERFORM messaging.fn_assert_contact_exists_and_active(p_contact_b);

    -- We only reuse conversations that have no extra active participants.
    SELECT c.conversation_id
    INTO v_conversation_id
    FROM messaging.conversation c
    JOIN messaging.conversation_participant cp_a
      ON cp_a.conversation_id = c.conversation_id
     AND cp_a.contact_id = p_contact_a
     AND cp_a.left_at IS NULL
    JOIN messaging.conversation_participant cp_b
      ON cp_b.conversation_id = c.conversation_id
     AND cp_b.contact_id = p_contact_b
     AND cp_b.left_at IS NULL
    WHERE c.is_group IS FALSE
      AND c.name IS NULL
      AND NOT EXISTS (
          SELECT 1
          FROM messaging.conversation_participant cp_other
          WHERE cp_other.conversation_id = c.conversation_id
            AND cp_other.left_at IS NULL
            AND cp_other.contact_id NOT IN (p_contact_a, p_contact_b)
      )
    ORDER BY c.conversation_id
    LIMIT 1;

    RETURN v_conversation_id;
END;
$function$;

-- Marks every unread message in a conversation as read for one contact.
CREATE OR REPLACE FUNCTION messaging.fn_mark_conversation_read(
    p_conversation_id BIGINT,
    p_contact_id BIGINT
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $function$
DECLARE
    v_rows_affected INTEGER;
BEGIN
    -- Only active participants can update their read state.
    PERFORM messaging.fn_assert_active_participant(p_conversation_id, p_contact_id);

    -- Insert read receipts for messages the contact has not yet read.
    WITH unread_messages AS (
        SELECT m.message_id
        FROM messaging.message m
        WHERE m.conversation_id = p_conversation_id
          AND m.sender_id <> p_contact_id
          AND NOT EXISTS (
              SELECT 1
              FROM messaging.message_read mr
              WHERE mr.message_id = m.message_id
                AND mr.contact_id = p_contact_id
          )
    )
    INSERT INTO messaging.message_read (message_id, contact_id, read_at)
    SELECT message_id, p_contact_id, CURRENT_TIMESTAMP
    FROM unread_messages
    ON CONFLICT (message_id, contact_id)
    DO UPDATE SET read_at = EXCLUDED.read_at;

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    RETURN v_rows_affected;
END;
$function$;

-CREATE OR REPLACE FUNCTION messaging.fn_get_conversation_messages(
    p_conversation_id    BIGINT,
    p_contact_id         BIGINT,
    p_before_message_id  BIGINT  DEFAULT NULL,
    p_limit              INTEGER DEFAULT 50
)
RETURNS TABLE (
    message_id        BIGINT,
    conversation_id   BIGINT,
    sender_id         BIGINT,
    sender_username   VARCHAR(50),
    sender_first_name VARCHAR(50),
    sender_last_name  VARCHAR(50),
    message_type      VARCHAR(20),
    content           TEXT,
    media_url         TEXT,
    created_at        TIMESTAMPTZ,
    is_read           BOOLEAN,
    read_at           TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $function$
BEGIN
    -- The viewer must belong to the conversation to see its messages.
    PERFORM messaging.fn_assert_active_participant(p_conversation_id, p_contact_id);

    -- Clamp the limit to a sensible range to prevent abuse.
    IF p_limit IS NULL OR p_limit < 1 THEN
        p_limit := 50;
    ELSIF p_limit > 200 THEN
        p_limit := 200;
    END IF;

    -- Join sender metadata and read receipts so clients can render the thread directly.
    RETURN QUERY
    SELECT
        m.message_id,
        m.conversation_id,
        m.sender_id,
        s.username,
        s.first_name,
        s.last_name,
        m.message_type,
        m.content,
        m.media_url,
        m.created_at,
        (mr.message_id IS NOT NULL) AS is_read,
        mr.read_at
    FROM messaging.message m
    JOIN messaging.contact s
      ON s.contact_id = m.sender_id
    LEFT JOIN messaging.message_read mr
      ON mr.message_id = m.message_id
     AND mr.contact_id = p_contact_id
    WHERE m.conversation_id = p_conversation_id
      AND (p_before_message_id IS NULL OR m.message_id < p_before_message_id)
    ORDER BY m.created_at DESC, m.message_id DESC
    LIMIT p_limit;
END;
$function$;

-- Returns the inbox view for a contact, including latest message and unread counts.
CREATE OR REPLACE FUNCTION messaging.fn_get_contact_inbox(
    p_contact_id BIGINT
)
RETURNS TABLE (
    conversation_id BIGINT,
    name VARCHAR(50),
    is_group BOOLEAN,
    created_at TIMESTAMPTZ,
    last_message_id BIGINT,
    last_message_sender_id BIGINT,
    last_message_sender_username VARCHAR(50),
    last_message_type VARCHAR(20),
    last_message_preview TEXT,
    last_message_at TIMESTAMPTZ,
    unread_count INTEGER
)
LANGUAGE plpgsql
AS $function$
BEGIN
    PERFORM messaging.fn_assert_contact_exists_and_active(p_contact_id);

    -- Build the inbox from conversations the contact is still active in.
    RETURN QUERY
    WITH active_conversations AS (
        SELECT c.conversation_id, c.name, c.is_group, c.created_at
        FROM messaging.conversation c
        JOIN messaging.conversation_participant cp
          ON cp.conversation_id = c.conversation_id
         AND cp.contact_id = p_contact_id
         AND cp.left_at IS NULL
    ),
    -- Pick the most recent message in each conversation for preview data.
    latest_message AS (
        SELECT DISTINCT ON (m.conversation_id)
            m.conversation_id,
            m.message_id,
            m.sender_id,
            m.message_type,
            m.content,
            m.media_url,
            m.created_at
        FROM messaging.message m
        JOIN active_conversations ac
          ON ac.conversation_id = m.conversation_id
        ORDER BY m.conversation_id, m.created_at DESC, m.message_id DESC
    ),
    -- Count messages that the contact has not yet read.
    unread_counts AS (
        SELECT m.conversation_id, COUNT(*)::INT AS unread_count
        FROM messaging.message m
        JOIN active_conversations ac
          ON ac.conversation_id = m.conversation_id
        LEFT JOIN messaging.message_read mr
          ON mr.message_id = m.message_id
         AND mr.contact_id = p_contact_id
        WHERE m.sender_id <> p_contact_id
          AND mr.message_id IS NULL
        GROUP BY m.conversation_id
    )
    SELECT
        ac.conversation_id,
        ac.name,
        ac.is_group,
        ac.created_at,
        lm.message_id,
        lm.sender_id,
        s.username,
        lm.message_type,
        COALESCE(lm.content, lm.media_url) AS last_message_preview,
        lm.created_at,
        COALESCE(uc.unread_count, 0) AS unread_count
    FROM active_conversations ac
    LEFT JOIN latest_message lm
      ON lm.conversation_id = ac.conversation_id
    LEFT JOIN messaging.contact s
      ON s.contact_id = lm.sender_id
    LEFT JOIN unread_counts uc
      ON uc.conversation_id = ac.conversation_id
    ORDER BY lm.created_at DESC NULLS LAST, ac.created_at DESC, ac.conversation_id DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION messaging.fn_manage_group(
    p_contact_id      BIGINT,
    p_action          TEXT,
    p_conversation_id BIGINT   DEFAULT NULL,
    p_group_name      VARCHAR(50) DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    v_new_conversation_id BIGINT;
    v_is_group            BOOLEAN;
BEGIN
    -- The acting contact must exist and be active for any action.
    PERFORM messaging.fn_assert_contact_exists_and_active(p_contact_id);

    CASE p_action

        -- =========================
        -- CREATE a new group
        -- =========================
        WHEN 'create' THEN
            IF p_group_name IS NULL OR btrim(p_group_name) = '' THEN
                RAISE EXCEPTION 'Group name is required when creating a group';
            END IF;

            INSERT INTO messaging.conversation (name, is_group)
            VALUES (btrim(p_group_name), TRUE)
            RETURNING conversation_id INTO v_new_conversation_id;

            -- Add the creator as the first participant.
            INSERT INTO messaging.conversation_participant (conversation_id, contact_id)
            VALUES (v_new_conversation_id, p_contact_id);

            RETURN v_new_conversation_id;

        -- =========================
        -- ADD a participant
        -- =========================
        WHEN 'add' THEN
            IF p_conversation_id IS NULL THEN
                RAISE EXCEPTION 'conversation_id is required for adding participants';
            END IF;

            -- Only group conversations support adding members.
            SELECT c.is_group INTO v_is_group
            FROM messaging.conversation c
            WHERE c.conversation_id = p_conversation_id;

            IF v_is_group IS NULL THEN
                RAISE EXCEPTION 'Conversation % does not exist', p_conversation_id;
            END IF;

            IF NOT v_is_group THEN
                RAISE EXCEPTION 'Cannot add participants to a direct conversation';
            END IF;

            -- Enforce company connection rules between the new contact
            -- and every current active participant.
            PERFORM messaging.fn_assert_all_participants_connected(
                array_agg(cp.contact_id) || p_contact_id
            )
            FROM messaging.conversation_participant cp
            WHERE cp.conversation_id = p_conversation_id
              AND cp.left_at IS NULL;

            -- If the contact was previously removed, re-add by clearing left_at.
            -- Otherwise insert a new row.
            INSERT INTO messaging.conversation_participant (conversation_id, contact_id, joined_at, left_at)
            VALUES (p_conversation_id, p_contact_id, CURRENT_TIMESTAMP, NULL)
            ON CONFLICT (conversation_id, contact_id)
            DO UPDATE SET joined_at = CURRENT_TIMESTAMP,
                          left_at   = NULL;

            RETURN p_conversation_id;

        -- =========================
        -- REMOVE a participant (soft-delete)
        -- =========================
        WHEN 'remove' THEN
            IF p_conversation_id IS NULL THEN
                RAISE EXCEPTION 'conversation_id is required for removing participants';
            END IF;

            -- Mark the participant as having left rather than deleting the row,
            -- so historical message attribution is preserved.
            UPDATE messaging.conversation_participant
            SET left_at = CURRENT_TIMESTAMP
            WHERE conversation_id = p_conversation_id
              AND contact_id = p_contact_id
              AND left_at IS NULL;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Contact % is not an active member of conversation %',
                    p_contact_id, p_conversation_id;
            END IF;

            RETURN p_conversation_id;

        -- =========================
        -- RENAME a group
        -- =========================
        WHEN 'rename' THEN
            IF p_conversation_id IS NULL THEN
                RAISE EXCEPTION 'conversation_id is required for renaming';
            END IF;

            IF p_group_name IS NULL OR btrim(p_group_name) = '' THEN
                RAISE EXCEPTION 'group_name is required for renaming';
            END IF;

            -- Only group conversations can be renamed.
            SELECT c.is_group INTO v_is_group
            FROM messaging.conversation c
            WHERE c.conversation_id = p_conversation_id;

            IF v_is_group IS NULL THEN
                RAISE EXCEPTION 'Conversation % does not exist', p_conversation_id;
            END IF;

            IF NOT v_is_group THEN
                RAISE EXCEPTION 'Cannot rename a direct conversation';
            END IF;

            UPDATE messaging.conversation
            SET name = btrim(p_group_name)
            WHERE conversation_id = p_conversation_id;

            RETURN p_conversation_id;

        ELSE
            RAISE EXCEPTION 'Unknown action %. Allowed: create, add, remove, rename', p_action;
    END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION messaging.fn_fill_and_check_contact(
    p_user_gid uuid,
    p_updates jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_contact messaging.contact%ROWTYPE;
    v_missing jsonb := '{}'::jsonb;
    v_field text;
    v_required_fields text[] := ARRAY['first_name', 'last_name', 'company']; -- add more fields here
BEGIN
    -- Get the contact row
    SELECT * INTO v_contact
    FROM messaging.contact
    WHERE user_gid = p_user_gid;

    IF NOT FOUND THEN
        RETURN v_missing;
    END IF;

    -- Update fields dynamically if provided in JSON
    FOREACH v_field IN ARRAY v_required_fields
    LOOP
        EXECUTE format(
            'UPDATE messaging.contact SET %I = COALESCE($1->>%I, %I) WHERE user_gid = $2',
            v_field, v_field, v_field
        )
        USING p_updates, p_user_gid;
    END LOOP;

    -- Refresh contact row after update
    SELECT * INTO v_contact
    FROM messaging.contact
    WHERE user_gid = p_user_gid;

    -- Check which fields are still missing dynamically
    FOREACH v_field IN ARRAY v_required_fields
    LOOP
        IF (v_contact.*)::jsonb ->> v_field IS NULL OR (v_contact.*)::jsonb ->> v_field = '' THEN
            v_missing := v_missing || jsonb_build_object(v_field, true);
        END IF;
    END LOOP;

    RETURN v_missing;
END;
$$;