# Messaging Integration - CES Ticketing System API

## Overview

Messaging functionality integrated into ticketing API at `/api/messaging` prefix.

## Architecture

**Dual Database Approach:**
- **Ticketing endpoints** → Sync `psycopg2` connections
- **Messaging endpoints** → Async `asyncpg` pool (managed via lifespan)

Both use same PostgreSQL database but different connection methods.

## What Was Added

### 1. Dependencies
```python
from app.messaging_lib import (
    ConnectionManager,
    DBHelper,
    pg_listener,
    init_messaging,
    create_messaging_router
)
```

### 2. Lifespan Manager
- Creates asyncpg pool for messaging
- Initializes ConnectionManager for WebSocket
- Starts PostgreSQL LISTEN/NOTIFY listener
- Cleans up on shutdown

### 3. Endpoints

**Router-based (from messaging_lib):**
- All standard messaging endpoints at `/api/messaging/*`
- See `API_ENDPOINTS.md` for full list

**Custom endpoints:**
- `GET /api/messaging/contacts/by-email/{email}` - Lookup contact by email
- `GET /api/messaging/conversations/{conversation_id}/participants` - Get participants
- `GET /api/messaging/contacts/{contact_id}/inbox-enhanced` - Enhanced inbox

**WebSocket:**
- `WS /api/messaging/ws/{contact_id}` - Real-time messaging

### Angular app (`@coreline-engineering-solutions/messaging`)

The client builds the socket URL as **`{wsBaseUrl}/messaging/ws/{contactId}`**. Because this API mounts the socket under **`/api/messaging/ws/...`**, set:

- **`wsBaseUrl`** = same origin as REST **including the `/api` segment**, e.g. `wss://your-host/api` (not `wss://your-host`).

REST routes under `messaging_lib` use **`int(contact_id)`** for inbox, visible-contacts, etc. Use **numeric** `contact_id` from the DB (e.g. resolve with **`GET /api/messaging/contacts/by-email/{email}`**) before calling `AuthService.setSession` — do not pass raw email as `contact_id` in the path.

## Configuration

Uses **separate messaging database** from environment variable:
```python
# In .env
MESSAGING_DB_URL=postgresql://user:password@host:5432/messaging_db?sslmode=require

# In app/main.py
messaging_db_url = settings.MESSAGING_DB_URL
```

**Two databases:**
- Ticketing DB → `DB_HOST`, `DB_NAME`, etc. (psycopg2)
- Messaging DB → `MESSAGING_DB_URL` (asyncpg)

## Running

```bash
cd ticketing-api
uvicorn app.main:app --reload --port 8000
```

Messaging endpoints available at `http://localhost:8000/api/messaging/*`

## Testing

### Health Check
```bash
curl http://localhost:8000/
```

### Test Messaging
```bash
# Get inbox
curl http://localhost:8000/api/messaging/contacts/123/inbox

# Send direct message
curl -X POST http://localhost:8000/api/messaging/direct-messages \
  -H "Content-Type: application/json" \
  -d '{"sender_id":"123","recipient_id":"456","content":"Test"}'
```

### WebSocket Test
```javascript
const ws = new WebSocket('ws://localhost:8000/api/messaging/ws/123');
ws.onopen = () => ws.send(JSON.stringify({type: 'auth'}));
ws.onmessage = (e) => console.log(JSON.parse(e.data));
```

## Real-time Features

PostgreSQL LISTEN/NOTIFY broadcasts:
- `new_message` - New messages
- `message_read` - Read receipts
- `conversation_created` - New conversations
- `group_updated` - Group changes
- `connection_update` - Connection status
- `contact_update` - Contact changes

Events auto-broadcast to connected WebSocket clients.

## File Structure

```
ticketing-api/
├── app/
│   ├── main.py                 # Integrated messaging + ticketing
│   ├── messaging_lib.py        # Messaging library (copied)
│   ├── config.py               # Shared DB config
│   ├── ticket_service.py       # Ticketing logic
│   └── ...
├── MESSAGING_INTEGRATION.md    # This file
└── ...
```

## Notes

- Messaging uses `str` for contact_id (flexible typing)
- Ticketing uses `int` for IDs
- Both coexist - no conflicts
- PostgreSQL listener auto-reconnects on failure
- WebSocket handles auth, ping/pong, typing indicators

## API Documentation

See `API_ENDPOINTS.md` in project root for complete endpoint reference.
