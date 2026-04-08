-- ============================================================
-- Rev 7 – Test Contact Profiles
-- Purpose: Inserts two test contacts for manual chat testing.
-- Both belong to the same company so they can message each other
-- without requiring a company connection.
-- ============================================================

INSERT INTO messaging.contact (
    username,
    first_name,
    last_name,
    phone_number,
    email,
    user_gid,
    company,
    active,
    is_company_admin
)
VALUES (
    'testuser1',
    'Test',
    'UserOne',
    '555-1001',
    'testuser1@testcorp.com',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    'TestCorp',
    TRUE,
    TRUE
)
ON CONFLICT (user_gid) DO NOTHING;

INSERT INTO messaging.contact (
    username,
    first_name,
    last_name,
    phone_number,
    email,
    user_gid,
    company,
    active,
    is_company_admin
)
VALUES (
    'testuser2',
    'Test',
    'UserTwo',
    '555-1002',
    'testuser2@testcorp.com',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
    'TestCorp',
    TRUE,
    FALSE
)
ON CONFLICT (user_gid) DO NOTHING;
