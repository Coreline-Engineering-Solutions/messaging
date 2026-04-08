-- Purpose: represents each user in the messaging system.

-- rev1 contact table

CREATE TABLE messaging.contact (
    contact_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username         VARCHAR(50), -- admin.users username column
    first_name       VARCHAR(50), -- added by user
    last_name        VARCHAR(50), -- added by user
    phone_number     VARCHAR(50), -- added by user
    email            VARCHAR(100), -- admin.users email column
    user_gid         uuid NOT NULL, -- admin.users global_id
    company          VARCHAR(30), -- added by user -- determines who can see whose contact list
    active           BOOLEAN, -- admin.users active column
    profile_pic      uuid, -- attachments.profile images id column
    created_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_contact_user_gid UNIQUE (user_gid)


    
);


-- when a user is added the basic contact is created and there is a trigger to add it from the admin.users table

CREATE OR REPLACE FUNCTION messaging.fn_sync_user_to_contact()
RETURNS TRIGGER AS
$$
BEGIN
    INSERT INTO messaging.contact (
        username,
        email,
        user_gid,
        active
    )
    VALUES (
        NEW.username,
        NEW.email,
        NEW.global_id,
        NEW.active
    );

    RETURN NEW;
END;
$$
LANGUAGE plpgsql;

--trigger to create this function

CREATE TRIGGER trg_sync_user_to_contact
AFTER INSERT ON admin.users
FOR EACH ROW
EXECUTE FUNCTION messaging.fn_sync_user_to_contact();

-- existing users ingestion

INSERT INTO messaging.contact (
    username,
    email,
    user_gid,
    active
)
SELECT
    u.username,
    u.email,
    u.global_id,
    u.active
FROM admin.users u
LEFT JOIN messaging.contact c
    ON c.user_gid = u.global_id
WHERE c.user_gid IS NULL;