-- Purpose: Stores each message in a conversation.
-- Note: each row = one message.
-- Relational rows instead of a giant JSON blob → scalable, fast, concurrent.


CREATE TABLE messaging.message (
    message_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conversation_id   BIGINT NOT NULL,
    sender_id         BIGINT NOT NULL,
    message_type      VARCHAR(20) NOT NULL, -- TEXT, IMAGE
    content           TEXT, -- text message
    media_url         TEXT, -- image/file path
    created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (conversation_id) REFERENCES messaging.conversation(conversation_id),
    FOREIGN KEY (sender_id) REFERENCES messaging.contact(contact_id)
);

CREATE INDEX IF NOT EXISTS ix_message_conversation_lookup
    ON messaging.message (conversation_id, created_at DESC, message_id DESC);

CREATE INDEX IF NOT EXISTS ix_message_sender_lookup
    ON messaging.message (sender_id, created_at DESC, message_id DESC);

CREATE TABLE messaging.message_read (
    message_id    BIGINT NOT NULL,
    contact_id    BIGINT NOT NULL,
    read_at       TIMESTAMPTZ,

    PRIMARY KEY (message_id, contact_id),

    FOREIGN KEY (message_id) REFERENCES messaging.message(message_id),
    FOREIGN KEY (contact_id) REFERENCES messaging.contact(contact_id)
);

CREATE INDEX IF NOT EXISTS ix_message_read_contact_lookup
    ON messaging.message_read (contact_id, message_id);