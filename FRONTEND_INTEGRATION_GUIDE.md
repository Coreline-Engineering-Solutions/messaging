# Frontend Integration Guide

This guide describes how to integrate the messaging API and WebSocket endpoints into your frontend application.

## Base URL

All messaging endpoints are available at:
```
https://your-api-host/messaging
```

## Authentication

All messaging endpoints use **session-based authentication** via `session_gid` (UUID from login). Include `session_gid` in every request body or as query parameter for GET requests.

### Obtaining a Session

First authenticate via the main auth endpoint:

```http
POST /auth
Content-Type: application/json

{
  "function": "_login",
  "email": "user@example.com",
  "password": "yourpassword"
}
```

Response:
```json
{
  "session_gid": "550e8400-e29b-41d4-a716-446655440000",
  "session_expires": "2026-04-02T12:00:00Z"
}
```

## Required Privileges

Your user must have the appropriate privileges assigned via the Access_Control utility. Common messaging privileges:

| Privilege | Purpose |
|-----------|---------|
| `_send_message` | Send messages in conversations |
| `_create_conversation` | Create new conversations |
| `_get_conversation_messages` | View message history |
| `_get_contact_inbox` | View inbox |
| `_send_connection_invite` | Send company connection invites (admin only) |

Contact your system administrator to request privilege assignments.

## API Endpoints

### 1. Connection Management (Company Admins)

#### Send Connection Invite
```http
POST /messaging/connections/invites
Content-Type: application/json

{
  "session_gid": "550e8400-e29b-41d4-a716-446655440000",
  "adminContactId": "123",
  "targetCompany": "Partner Corp"
}
```

Response:
```json
{
  "connectionId": "456"
}
```

#### Respond to Connection Invite
```http
POST /messaging/connections/{connectionId}/respond
Content-Type: application/json

{
  "session_gid": "550e8400-e29b-41d4-a716-446655440000",
  "adminContactId": "123",
  "accept": true
}
```

#### Get Company Connections
```http
GET /messaging/contacts/{contactId}/connections?session_gid={session_gid}
```

### 2. Contact Management

#### Get Visible Contacts
```http
GET /messaging/contacts/{contactId}/visible-contacts?session_gid={session_gid}
```

Returns contacts from the same company and connected companies.

#### Check/Update Contact Profile
```http
POST /messaging/contacts/check
Content-Type: application/json

{
  "session_gid": "550e8400-e29b-41d4-a716-446655440000",
  "userGid": "uuid-from-admin-users",
  "updates": {
    "profile_image_url": "https://example.com/image.jpg",
    "phone": "+1234567890"
  }
}
```

### 3. Conversations

#### Create Conversation
```http
POST /messaging/conversations
Content-Type: application/json

{
  "session_gid": "550e8400-e29b-41d4-a716-446655440000",
  "creatorContactId": "123",
  "participantContactIds": ["456", "789"],
  "name": "Project Team"  // Required for groups, null for direct
}
```

#### Get Direct Conversation
```http
GET /messaging/conversations/direct?contactA=123&contactB=456&sessionGid={session_gid}
```

Returns existing conversation ID or null if none exists.

#### Get Inbox
```http
GET /messaging/contacts/{contactId}/inbox?session_gid={session_gid}
```

Returns:
```json
[
  {
    "conversation_id": "789",
    "name": "Project Team",
    "last_message_preview": "Let's meet tomorrow",
    "last_message_at": "2026-04-02T08:30:00Z",
    "unread_count": 3
  }
]
```

### 4. Messages

#### Send Message
```http
POST /messaging/conversations/{conversationId}/messages
Content-Type: application/json

{
  "session_gid": "550e8400-e29b-41d4-a716-446655440000",
  "senderContactId": "123",
  "messageType": "TEXT",
  "content": "Hello team!"
}
```

Or for images:
```http
POST /messaging/conversations/{conversationId}/messages
Content-Type: application/json

{
  "session_gid": "550e8400-e29b-41d4-a716-446655440000",
  "senderContactId": "123",
  "messageType": "IMAGE",
  "mediaUrl": "https://cdn.example.com/image.jpg"
}
```

#### Get Messages (Paginated)
```http
GET /messaging/conversations/{conversationId}/messages?contactId=123&beforeMessageId=999&limit=50&sessionGid={session_gid}
```

- `beforeMessageId`: Optional cursor for pagination (get older messages)
- `limit`: 1-200, default 50

#### Send Direct Message
```http
POST /messaging/direct-messages
Content-Type: application/json

{
  "session_gid": "550e8400-e29b-41d4-a716-446655440000",
  "senderContactId": "123",
  "recipientContactId": "456",
  "messageType": "TEXT",
  "content": "Hi there!"
}
```

#### Mark Conversation as Read
```http
POST /messaging/conversations/{conversationId}/read
Content-Type: application/json

{
  "session_gid": "550e8400-e29b-41d4-a716-446655440000",
  "contactId": "123"
}
```

### 5. Group Management

```http
POST /messaging/groups
Content-Type: application/json

{
  "session_gid": "550e8400-e29b-41d4-a716-446655440000",
  "contactId": "123",
  "action": "create",  // or "add", "remove", "rename"
  "conversationId": "789",  // Required for add/remove/rename
  "groupName": "New Group Name"  // Required for create/rename
}
```

## WebSocket Real-Time Updates

For real-time message delivery, use WebSocket connections.

### Connection

```javascript
const contactId = '123';  // Your contact ID
const ws = new WebSocket(`wss://your-api-host/messaging/ws/${contactId}`);

ws.onopen = () => {
  console.log('WebSocket connected');
  
  // Authenticate
  ws.send(JSON.stringify({
    action: 'auth',
    session_gid: '550e8400-e29b-41d4-a716-446655440000'
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  handleWebSocketMessage(message);
};

ws.onclose = () => {
  console.log('WebSocket disconnected');
  // Implement reconnection logic
};
```

### WebSocket Actions

#### Subscribe to Conversation
```javascript
ws.send(JSON.stringify({
  action: 'subscribe',
  conversation_id: '789'
}));
```

#### Unsubscribe from Conversation
```javascript
ws.send(JSON.stringify({
  action: 'unsubscribe',
  conversation_id: '789'
}));
```

#### Keepalive Ping
```javascript
ws.send(JSON.stringify({ action: 'ping' }));
// Server responds: { "type": "pong" }
```

### WebSocket Message Types

#### New Message
```json
{
  "type": "new_message",
  "timestamp": "2026-04-02T09:15:30Z",
  "data": {
    "message_id": "1001",
    "conversation_id": "789",
    "sender_id": "456",
    "sender_name": "John Doe",
    "message_type": "TEXT",
    "content": "Hello!",
    "created_at": "2026-04-02T09:15:30Z"
  }
}
```

#### Conversation Updated
```json
{
  "type": "conversation_updated",
  "timestamp": "2026-04-02T09:15:30Z",
  "data": {
    "conversation_id": "789",
    "name": "New Group Name",
    "participants_added": ["101"],
    "participants_removed": []
  }
}
```

#### Connection Status
```json
{
  "type": "connection_invite_received",
  "timestamp": "2026-04-02T09:15:30Z",
  "data": {
    "connection_id": "456",
    "company_initiated": "Partner Corp",
    "status": "pending"
  }
}
```

## Implementation Flow

### Typical Chat Application Flow

```
1. User Login
   └─ POST /auth → Get session_gid

2. Load Inbox
   └─ GET /messaging/contacts/{id}/inbox

3. Connect WebSocket
   └─ wss://host/messaging/ws/{contactId}
   └─ Send auth message with session_gid
   └─ Subscribe to all conversation IDs from inbox

4. Open Conversation
   ├─ GET /messaging/conversations/{id}/messages
   ├─ Render message history
   └─ Mark as read: POST /messaging/conversations/{id}/read

5. Send Message
   ├─ POST /messaging/conversations/{id}/messages
   └─ WebSocket delivers to other participants automatically

6. Receive Message (WebSocket)
   └─ Server pushes: { type: "new_message", data: {...} }
   └─ Update UI, show notification if conversation not active

7. Create New Conversation
   ├─ Find user: GET /messaging/contacts/{id}/visible-contacts
   ├─ Check direct convo: GET /messaging/conversations/direct
   ├─ Create if needed: POST /messaging/conversations
   └─ WebSocket auto-subscribes (or manually subscribe)
```

### Reconnection Strategy

```javascript
class MessagingWebSocket {
  constructor(contactId, sessionGid, onMessage) {
    this.contactId = contactId;
    this.sessionGid = sessionGid;
    this.onMessage = onMessage;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.subscribedConversations = new Set();
    this.connect();
  }

  connect() {
    this.ws = new WebSocket(`wss://host/messaging/ws/${this.contactId}`);
    
    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.authenticate();
      this.resubscribe();
    };

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'auth_success') {
        console.log('WebSocket authenticated');
      } else {
        this.onMessage(msg);
      }
    };

    this.ws.onclose = () => {
      this.attemptReconnect();
    };
  }

  authenticate() {
    this.send({ action: 'auth', session_gid: this.sessionGid });
  }

  subscribe(conversationId) {
    this.subscribedConversations.add(conversationId);
    this.send({ action: 'subscribe', conversation_id: conversationId });
  }

  resubscribe() {
    this.subscribedConversations.forEach(id => {
      this.subscribe(id);
    });
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      setTimeout(() => this.connect(), delay);
      this.reconnectAttempts++;
    }
  }

  send(data) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}
```

## Error Handling

### HTTP Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | - |
| 201 | Created | New resource created |
| 400 | Bad Request | Check request body |
| 401 | Unauthorized | Session expired, re-login |
| 403 | Forbidden | Missing privilege, contact admin |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate or invalid state |
| 500 | Server Error | Retry or contact support |

### WebSocket Errors

```javascript
ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

// Server may send:
{ "type": "error", "message": "Invalid session" }
{ "type": "error", "message": "Access denied" }
```

## Security Best Practices

1. **Never expose session_gid in URLs** - Only use in request bodies or headers
2. **Validate all inputs** - Sanitize content before sending
3. **Handle token expiration** - Refresh session when 401 received
4. **Rate limiting** - Don't flood the API with requests
5. **Secure WebSocket** - Always use `wss://` in production

## Testing

### Using curl

```bash
# Health check
curl https://your-api-host/messaging/health

# Get inbox
curl "https://your-api-host/messaging/contacts/123/inbox?session_gid=YOUR_SESSION"

# Send message
curl -X POST https://your-api-host/messaging/conversations/789/messages \
  -H "Content-Type: application/json" \
  -d '{
    "session_gid": "YOUR_SESSION",
    "senderContactId": "123",
    "messageType": "TEXT",
    "content": "Test message"
  }'
```

### Using wscat (WebSocket testing)

```bash
npm install -g wscat

wscat -c "wss://your-api-host/messaging/ws/123"

> {"action": "auth", "session_gid": "YOUR_SESSION"}
> {"action": "subscribe", "conversation_id": "789"}
> {"action": "ping"}
```

## Support

For issues or questions:
1. Check this documentation
2. Review error messages from API
3. Verify privilege assignments with system admin
4. Test WebSocket connection using wscat
