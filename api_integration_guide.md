# Messaging API - Integration Guide

> **Base URL:** `http://<host>:<port>`
> **Content-Type:** `application/json`
> **Framework:** FastAPI (Python)

---

## Table of Contents

1. [Health Check](#1-health-check)
2. [Contact Management](#2-contact-management)
3. [Company Connections](#3-company-connections)
4. [Conversations](#4-conversations)
5. [Messages](#5-messages)
6. [Group Management](#6-group-management)
7. [Error Handling](#7-error-handling)
8. [Database Functions Reference](#8-database-functions-reference)

---

## 1. Health Check

### `GET /health`

Returns API status.

**Response:**
```json
{ "status": "ok" }
```

---

## 2. Contact Management

### `POST /api/contacts/check`

Check and optionally update missing contact profile fields (first_name, last_name, company). Returns a JSON object where each key is a missing field set to `true`.

**Request Body:**
| Field      | Type   | Required | Description                                      |
|------------|--------|----------|--------------------------------------------------|
| `userGid`  | string | Yes      | The user's global UUID from `admin.users`         |
| `updates`  | object | No       | Key-value pairs to update, e.g. `{"first_name": "John"}` |

**Example Request:**
```json
{
  "userGid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "updates": {
    "first_name": "John",
    "last_name": "Doe"
  }
}
```

**Response (200):**
```json
{
  "missing_fields": {
    "company": true
  }
}
```
> Empty `missing_fields` object means the profile is complete.

**DB Function:** `messaging.fn_fill_and_check_contact(uuid, jsonb)`

---

### `GET /api/contacts/{contact_id}/visible-contacts`

Returns all contacts visible to the given contact (same company + connected companies).

**Path Parameters:**
| Param        | Type | Description                |
|--------------|------|----------------------------|
| `contact_id` | int  | The requesting contact's ID |

**Response (200):**
```json
[
  {
    "contact_id": "1",
    "username": "jdoe",
    "first_name": "John",
    "last_name": "Doe",
    "phone_number": "555-1234",
    "email": "jdoe@example.com",
    "company": "Acme",
    "profile_pic": "uuid-string"
  }
]
```

**DB Function:** `messaging.fn_get_visible_contacts(bigint)`

---

## 3. Company Connections

### `POST /api/connections/invites`

Send a connection invite from one company to another. Only company admins can initiate.

**Request Body:**
| Field            | Type   | Required | Description                     |
|------------------|--------|----------|---------------------------------|
| `adminContactId` | int    | Yes      | The admin contact sending the invite |
| `targetCompany`  | string | Yes      | The target company name          |

**Response (201):**
```json
{ "connectionId": "42" }
```

**DB Function:** `messaging.fn_send_connection_invite(bigint, varchar)`

---

### `POST /api/connections/{connection_id}/respond`

Accept or reject a pending connection invite. Only the responder company's admin can act.

**Path Parameters:**
| Param           | Type | Description        |
|-----------------|------|--------------------|
| `connection_id` | int  | The connection ID   |

**Request Body:**
| Field            | Type | Required | Description                        |
|------------------|------|----------|------------------------------------|
| `adminContactId` | int  | Yes      | The admin contact responding        |
| `accept`         | bool | Yes      | `true` to accept, `false` to reject |

**Response (200):**
```json
{ "success": true }
```

**DB Function:** `messaging.fn_respond_to_connection(bigint, bigint, boolean)`

---

### `POST /api/connections/{connection_id}/revoke`

Revoke an active connection. Either company's admin can revoke.

**Path Parameters:**
| Param           | Type | Description        |
|-----------------|------|--------------------|
| `connection_id` | int  | The connection ID   |

**Request Body:**
| Field            | Type | Required | Description                   |
|------------------|------|----------|-------------------------------|
| `adminContactId` | int  | Yes      | The admin contact revoking     |

**Response (200):**
```json
{ "success": "true" }
```

**DB Function:** `messaging.fn_revoke_connection(bigint, bigint)`

---

### `GET /api/contacts/{contact_id}/connections`

Returns all connection records for a company admin's dashboard (all statuses).

**Path Parameters:**
| Param        | Type | Description              |
|--------------|------|--------------------------|
| `contact_id` | int  | The admin contact's ID    |

**Response (200):**
```json
[
  {
    "connection_id": "1",
    "requester_company": "Acme",
    "responder_company": "Globex",
    "status": "ACTIVE",
    "requested_by_username": "admin1",
    "responded_by_username": "admin2",
    "revoked_by_username": null,
    "requested_at": "2026-01-15T10:00:00+00:00",
    "responded_at": "2026-01-16T09:00:00+00:00",
    "revoked_at": null
  }
]
```

**Filtering (client-side):**
- **Outgoing pending:** `requester_company == yourCompany && status == 'PENDING'`
- **Incoming pending:** `responder_company == yourCompany && status == 'PENDING'`
- **Active:** `status == 'ACTIVE'`

**DB Function:** `messaging.fn_get_company_connections(bigint)`

---

### `GET /api/companies/{company}/allowed`

Returns all companies with an active connection to the given company.

**Path Parameters:**
| Param     | Type   | Description       |
|-----------|--------|-------------------|
| `company` | string | The company name   |

**Response (200):**
```json
[
  {
    "connected_company": "Globex",
    "connection_id": "1",
    "connected_since": "2026-01-16T09:00:00+00:00"
  }
]
```

**DB Function:** `messaging.fn_get_allowed_companies(varchar)`

---

## 4. Conversations

### `POST /api/conversations`

Create a new conversation (direct or group). Groups require a name and 2+ participants.

**Request Body:**
| Field                 | Type     | Required | Description                                |
|-----------------------|----------|----------|--------------------------------------------|
| `creatorContactId`    | int      | Yes      | The contact creating the conversation       |
| `participantContactIds` | int[]  | Yes      | Array of participant contact IDs            |
| `name`                | string   | No       | Required for groups, must be null for direct |

**Response (201):**
```json
{ "conversationId": "10" }
```

**DB Function:** `messaging.fn_create_conversation(bigint, bigint[], varchar)`

---

### `GET /api/conversations/direct`

Look up an existing direct conversation between two contacts.

**Query Parameters:**
| Param      | Type | Required | Description       |
|------------|------|----------|-------------------|
| `contactA` | int  | Yes      | First contact ID   |
| `contactB` | int  | Yes      | Second contact ID  |

**Response (200):**
```json
{ "conversationId": "5" }
```
> Returns `null` conversationId if no direct conversation exists.

**DB Function:** `messaging.fn_get_direct_conversation_id(bigint, bigint)`

---

### `GET /api/contacts/{contact_id}/inbox`

Returns the inbox view: all conversations with latest message preview and unread count.

**Path Parameters:**
| Param        | Type | Description         |
|--------------|------|---------------------|
| `contact_id` | int  | The contact's ID     |

**Response (200):**
```json
[
  {
    "conversation_id": "1",
    "name": "Project Alpha",
    "is_group": true,
    "created_at": "2026-01-10T08:00:00+00:00",
    "last_message_id": "99",
    "last_message_sender_id": "3",
    "last_message_sender_username": "jsmith",
    "last_message_type": "TEXT",
    "last_message_preview": "See you tomorrow",
    "last_message_at": "2026-03-31T14:30:00+00:00",
    "unread_count": 3
  }
]
```

**DB Function:** `messaging.fn_get_contact_inbox(bigint)`

---

## 5. Messages

### `POST /api/conversations/{conversation_id}/messages`

Send a message into an existing conversation.

**Path Parameters:**
| Param             | Type | Description         |
|-------------------|------|---------------------|
| `conversation_id` | int  | The conversation ID  |

**Request Body:**
| Field             | Type   | Required | Description                                    |
|-------------------|--------|----------|------------------------------------------------|
| `senderContactId` | int    | Yes      | The sending contact's ID                        |
| `messageType`     | string | Yes      | `TEXT` or `IMAGE`                               |
| `content`         | string | No       | Required for TEXT messages                       |
| `mediaUrl`        | string | No       | Required for IMAGE messages                      |

**Response (201):**
```json
{
  "message_id": "101",
  "conversation_id": "1",
  "sender_id": "3",
  "message_type": "TEXT",
  "content": "Hello everyone",
  "media_url": null,
  "created_at": "2026-04-01T08:00:00+00:00"
}
```

**DB Function:** `messaging.fn_send_message(bigint, bigint, varchar, text, text)`

---

### `POST /api/direct-messages`

Send a direct message. Finds or creates the direct conversation automatically.

**Request Body:**
| Field                | Type   | Required | Description                           |
|----------------------|--------|----------|---------------------------------------|
| `senderContactId`    | int    | Yes      | The sender's contact ID                |
| `recipientContactId` | int    | Yes      | The recipient's contact ID             |
| `messageType`        | string | Yes      | `TEXT` or `IMAGE`                      |
| `content`            | string | No       | Required for TEXT messages              |
| `mediaUrl`           | string | No       | Required for IMAGE messages             |

**Response (201):**
```json
{
  "message_id": "102",
  "conversation_id": "5",
  "sender_id": "3",
  "message_type": "TEXT",
  "content": "Hey, quick question",
  "media_url": null,
  "created_at": "2026-04-01T08:05:00+00:00"
}
```

**DB Function:** `messaging.fn_send_direct_message(bigint, bigint, varchar, text, text)`

---

### `GET /api/conversations/{conversation_id}/messages`

Fetch message history with cursor-based pagination (newest first).

**Path Parameters:**
| Param             | Type | Description         |
|-------------------|------|---------------------|
| `conversation_id` | int  | The conversation ID  |

**Query Parameters:**
| Param             | Type | Required | Default | Description                                       |
|-------------------|------|----------|---------|---------------------------------------------------|
| `contactId`       | int  | Yes      |         | The viewing contact's ID                           |
| `beforeMessageId` | int  | No       | null    | Cursor: fetch messages older than this message ID   |
| `limit`           | int  | No       | 50      | Max messages to return (1–200)                      |

**Example Requests:**
```
GET /api/conversations/1/messages?contactId=3
GET /api/conversations/1/messages?contactId=3&beforeMessageId=230&limit=50
```

**Response (200):**
```json
[
  {
    "message_id": "229",
    "conversation_id": "1",
    "sender_id": "3",
    "sender_username": "jsmith",
    "sender_first_name": "John",
    "sender_last_name": "Smith",
    "message_type": "TEXT",
    "content": "Hello",
    "media_url": null,
    "created_at": "2026-04-01T08:00:00+00:00",
    "is_read": true,
    "read_at": "2026-04-01T08:01:00+00:00"
  }
]
```

**Pagination flow:**
1. First load: call without `beforeMessageId` → returns newest 50 messages
2. Scroll up: pass the smallest `message_id` from current results as `beforeMessageId` → returns next 50 older messages
3. Repeat until response returns fewer than `limit` rows (end of history)

**DB Function:** `messaging.fn_get_conversation_messages(bigint, bigint, bigint, integer)`

---

### `POST /api/conversations/{conversation_id}/read`

Mark all unread messages in a conversation as read for a contact.

**Path Parameters:**
| Param             | Type | Description         |
|-------------------|------|---------------------|
| `conversation_id` | int  | The conversation ID  |

**Request Body:**
| Field       | Type | Required | Description           |
|-------------|------|----------|-----------------------|
| `contactId` | int  | Yes      | The contact marking read |

**Response (200):**
```json
{ "updatedCount": 5 }
```

**DB Function:** `messaging.fn_mark_conversation_read(bigint, bigint)`

---

## 6. Group Management

### `POST /api/groups`

Manage group conversations: create, add/remove participants, or rename.

**Request Body:**
| Field            | Type   | Required        | Description                                      |
|------------------|--------|-----------------|--------------------------------------------------|
| `contactId`      | int    | Always          | The acting contact's ID                           |
| `action`         | string | Always          | One of: `create`, `add`, `remove`, `rename`       |
| `conversationId` | int    | add/remove/rename | The group conversation ID                        |
| `groupName`      | string | create/rename   | The group name (max 50 chars)                     |

**Actions:**

#### Create a group
```json
{
  "contactId": 1,
  "action": "create",
  "groupName": "Project Alpha"
}
```

#### Add a participant
```json
{
  "contactId": 5,
  "action": "add",
  "conversationId": 10
}
```

#### Remove a participant (soft-delete, preserves history)
```json
{
  "contactId": 5,
  "action": "remove",
  "conversationId": 10
}
```

#### Rename a group
```json
{
  "contactId": 1,
  "action": "rename",
  "conversationId": 10,
  "groupName": "Project Beta"
}
```

**Response (201):**
```json
{ "conversationId": "10" }
```

**Validation rules:**
- Only group conversations support add/remove/rename
- Company connection rules are enforced when adding participants
- Previously removed participants can be re-added
- Remove sets `left_at` timestamp (does not delete the row)

**DB Function:** `messaging.fn_manage_group(bigint, text, bigint, varchar)`

---

## 7. Error Handling

All errors return a JSON body with an `error` field.

### HTTP Status Codes

| Code | Meaning                         | Example Cause                              |
|------|----------------------------------|--------------------------------------------|
| 400  | Bad Request / Validation Error   | Missing required field, invalid input       |
| 403  | Forbidden                        | Not a company admin, not authorized         |
| 404  | Not Found                        | Contact or conversation does not exist       |
| 409  | Conflict                         | Duplicate connection invite                  |
| 500  | Internal Server Error            | Unhandled exception                          |

### Error Response Format
```json
{ "error": "Contact 99 does not exist or is inactive" }
```

### Common PostgreSQL Errors Mapped

| PG Code | HTTP Code | Meaning                        |
|---------|-----------|--------------------------------|
| 23505   | 409       | Unique constraint violation     |
| 22P02   | 400       | Invalid input syntax            |
| P0001   | 400/403/404 | Raised exception (context-dependent) |

---

## 8. Database Functions Reference

| Function                                     | Description                                                                      |
|----------------------------------------------|----------------------------------------------------------------------------------|
| `fn_sync_user_to_contact`                    | Trigger: syncs new `admin.users` rows to `messaging.contact`                      |
| `fn_fill_and_check_contact`                  | Check/update missing profile fields, returns JSON of still-missing fields          |
| `fn_assert_contact_exists_and_active`        | Validates contact exists and is active                                            |
| `fn_assert_active_participant`               | Validates contact is active participant in conversation                            |
| `fn_get_direct_conversation_id`              | Looks up existing 1-to-1 conversation between two contacts                        |
| `fn_create_conversation`                     | Creates conversation with participants, enforces company rules                     |
| `fn_manage_group`                            | Group lifecycle: create, add, remove, rename                                      |
| `fn_send_message`                            | Sends message into conversation with validation                                   |
| `fn_send_direct_message`                     | Finds/creates direct conversation then sends message                              |
| `fn_mark_conversation_read`                  | Marks all unread messages as read for a contact                                   |
| `fn_get_conversation_messages`               | Returns paginated message history with read state                                 |
| `fn_get_contact_inbox`                       | Returns inbox with latest message preview and unread counts                       |
| `fn_assert_company_admin`                    | Validates contact is a company admin                                              |
| `fn_get_contact_company`                     | Returns company for an active contact                                             |
| `fn_assert_companies_connected`              | Checks two companies have active connection                                       |
| `fn_assert_all_participants_connected`       | Validates all participant company pairs are connected                              |
| `fn_assert_sender_connected_to_conversation` | Checks sender's company is connected to all conversation companies                |
| `fn_send_connection_invite`                  | Admin sends connection invite to another company                                  |
| `fn_respond_to_connection`                   | Admin accepts/rejects pending invite                                              |
| `fn_revoke_connection`                       | Admin revokes active connection                                                   |
| `fn_get_allowed_companies`                   | Returns companies with active connections                                         |
| `fn_get_visible_contacts`                    | Returns contacts from same + connected companies                                  |
| `fn_get_company_connections`                 | Returns all connection records for admin dashboard                                |
