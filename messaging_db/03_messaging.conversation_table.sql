-- Table: messaging.conversation

-- Purpose:
-- Represents a chat or conversation. It can be either a one-on-one chat or a group chat.

-- Key points to note:

-- conversation_id → unique ID for the conversation
-- name → only used for groups; can be NULL for 1-to-1 chats
-- is_group → TRUE if it’s a group chat, FALSE if it’s a private chat
-- created_at → timestamp when the conversation was created
-- Works with conversation_participant to track who is in the conversation


CREATE TABLE messaging.conversation (
    conversation_id  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name             VARCHAR(50), -- null for 1-to-1 chats
    is_group         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table: messaging.conversation_participant

-- Purpose:
-- Tracks which contacts are part of which conversations and when they joined or left. It’s the “membership” table for chats and groups.

-- Key points to note:

-- Each row = one person in one conversation.
-- conversation_id → which chat/group
-- contact_id → which person
-- joined_at → when they were added
-- left_at → when they left (NULL = still in the group)
-- Primary key = (conversation_id, contact_id) → ensures no duplicate memberships
-- Foreign keys → links to the actual conversation and contact tables


CREATE TABLE messaging.conversation_participant (
    conversation_id  BIGINT NOT NULL,
    contact_id       BIGINT NOT NULL,
    joined_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    left_at          TIMESTAMPTZ, -- null = still in group

    PRIMARY KEY (conversation_id, contact_id),

    FOREIGN KEY (conversation_id) REFERENCES messaging.conversation(conversation_id),
    FOREIGN KEY (contact_id) REFERENCES messaging.contact(contact_id)
);

CREATE INDEX IF NOT EXISTS ix_conversation_participant_contact_lookup
    ON messaging.conversation_participant (contact_id, left_at, conversation_id);


-- CREATE TABLE messaging.conversation_summary (
--     conversation_id        BIGINT NOT NULL,
--     contact_id             BIGINT NOT NULL,

--     -- Conversation info (denormalized for fast reads)
--     conversation_name      VARCHAR(50),
--     is_group               BOOLEAN,

--     -- Last message info
--     last_message_id        BIGINT,
--     last_message_sender_id BIGINT,
--     last_message_type      VARCHAR(20),
--     last_message_preview   TEXT,
--     last_message_at        TIMESTAMPTZ,

--     -- Read tracking (CRITICAL improvement)
--     last_read_message_id   BIGINT,
--     unread_count           INTEGER DEFAULT 0,

--     -- Metadata
--     updated_at             TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

--     PRIMARY KEY (conversation_id, contact_id)
-- );

-- CREATE INDEX idx_cs_contact
-- ON messaging.conversation_summary (contact_id);

-- CREATE INDEX idx_cs_inbox_order
-- ON messaging.conversation_summary (contact_id, last_message_at DESC);



