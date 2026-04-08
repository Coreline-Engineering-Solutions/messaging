# Messaging DB API

This project adds a small REST API layer on top of the `messaging` database functions.
The backend is implemented in **Python with FastAPI** and keeps the same `/api` surface used by the Angular frontend.

## What it exposes

- Connection lifecycle
  - `fn_send_connection_invite`
  - `fn_respond_to_connection`
  - `fn_revoke_connection`
  - `fn_get_company_connections`
- Contact visibility
  - `fn_get_allowed_companies`
  - `fn_get_visible_contacts`
- Conversations and messages
  - `fn_create_conversation`
  - `fn_send_message`
  - `fn_send_direct_message`
  - `fn_mark_conversation_read`
  - `fn_get_conversation_messages`
  - `fn_get_contact_inbox`

## Setup

1. Install Python dependencies:

```bash
pip install -r requirements.txt
```

The backend now uses a pure-Python PostgreSQL driver, so Windows users should not need Microsoft C++ Build Tools for installation.

2. Create a `.env` file from `.env.example` and point it at your database.

3. Start the API:

```bash
python -m python_backend.main
```

If you prefer a direct Uvicorn command, you can also run:

```bash
uvicorn python_backend.app:app --reload --host 0.0.0.0 --port 3000
```

## Endpoints

### Health

- `GET /health`

### Connections

- `POST /api/connections/invites`
- `POST /api/connections/:connectionId/respond`
- `POST /api/connections/:connectionId/revoke`
- `GET /api/contacts/:contactId/connections`

### Contacts

- `GET /api/contacts/:contactId/visible-contacts`
- `GET /api/contacts/:contactId/inbox`

### Companies

- `GET /api/companies/:company/allowed`

### Conversations

- `POST /api/conversations`
- `POST /api/conversations/:conversationId/messages`
- `POST /api/conversations/:conversationId/read`
- `GET /api/conversations/:conversationId/messages?contactId=123`

### Direct messaging

- `POST /api/direct-messages`

## Request examples

### Send a connection invite

```json
{
  "adminContactId": "1",
  "targetCompany": "CompanyB"
}
```

### Create a conversation

```json
{
  "creatorContactId": "1",
  "participantContactIds": ["2", "3"],
  "name": "Project Team"
}
```

### Send a direct message

```json
{
  "senderContactId": "1",
  "recipientContactId": "2",
  "messageType": "TEXT",
  "content": "Hello"
}
```

## Notes

- The database functions enforce the business rules.
- Bigint ids are normalized to strings so the Angular frontend can keep using its current TypeScript models.
- If you want, I can also add a standalone Python client script or OpenAPI examples for these endpoints.
