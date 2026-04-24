import os
import json
import asyncio
import asyncpg

from typing import Dict, List, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# =========================================================
# 🚀 APP INIT
# =========================================================

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_URL = os.getenv("DATABASE_URL")

# =========================================================
# 📦 DB HELPERS
# =========================================================

async def db_fetch(query, *args):
    async with app.state.pool.acquire() as conn:
        return await conn.fetch(query, *args)

async def db_fetchval(query, *args):
    async with app.state.pool.acquire() as conn:
        return await conn.fetchval(query, *args)

# =========================================================
# 🔌 WEBSOCKET MANAGER
# =========================================================

class ConnectionManager:
    def __init__(self):
        self.active: Dict[str, List[WebSocket]] = {}

    async def connect(self, contact_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active.setdefault(contact_id, []).append(websocket)

    def disconnect(self, contact_id: str, websocket: WebSocket):
        if contact_id in self.active:
            self.active[contact_id].remove(websocket)

    async def send_to_user(self, contact_id: str, message: dict):
        for ws in self.active.get(contact_id, []):
            await ws.send_json(message)

manager = ConnectionManager()

# =========================================================
# 🧠 PG LISTENER
# =========================================================

async def pg_listener():
    conn = await asyncpg.connect(DB_URL)

    async def handler(connection, pid, channel, payload):
        try:
            msg = json.loads(payload)
            event = msg.get("event")
            data = msg.get("data", {})

            # =====================================================
            # ✉️ NEW MESSAGE
            # =====================================================
            if channel == "new_message":
                conversation_id = data["conversation_id"]

                participants = await db_fetch(
                    """
                    SELECT contact_id
                    FROM messaging.conversation_participant
                    WHERE conversation_id = $1
                    """,
                    conversation_id
                )

                for p in participants:
                    await manager.send_to_user(
                        p["contact_id"],
                        {
                            "type": event,
                            **data
                        }
                    )

            # =====================================================
            # 👁️ MESSAGE READ
            # =====================================================
            elif channel == "message_read":
                conversation_id = data["conversation_id"]

                participants = await db_fetch(
                    """
                    SELECT contact_id
                    FROM messaging.conversation_participant
                    WHERE conversation_id = $1
                    """,
                    conversation_id
                )

                for p in participants:
                    await manager.send_to_user(
                        p["contact_id"],
                        {
                            "type": "message_read",
                            **data
                        }
                    )

            # =====================================================
            # 💬 CONVERSATION CREATED
            # =====================================================
            elif channel == "conversation_created":
                # you may include participants in payload later
                await manager.send_to_user(
                    data["created_by"],
                    {
                        "type": "conversation_created",
                        **data
                    }
                )

            # =====================================================
            # 👥 GROUP UPDATES
            # =====================================================
            elif channel == "group_updated":
                conversation_id = data["conversation_id"]

                participants = await db_fetch(
                    """
                    SELECT contact_id
                    FROM messaging.conversation_participant
                    WHERE conversation_id = $1
                    """,
                    conversation_id
                )

                for p in participants:
                    await manager.send_to_user(
                        p["contact_id"],
                        {
                            "type": event,  # participant_added / removed / renamed
                            **data
                        }
                    )

            # =====================================================
            # 🔗 CONNECTION UPDATES
            # =====================================================
            elif channel == "connection_update":
                # best practice: include affected contacts in payload later
                # fallback: broadcast to specific contact if provided

                target = data.get("contact_id")

                if target:
                    await manager.send_to_user(
                        target,
                        {
                            "type": event,
                            **data
                        }
                    )

            # =====================================================
            # 👤 CONTACT UPDATES
            # =====================================================
            elif channel == "contact_update":
                await manager.send_to_user(
                    data["contact_id"],
                    {
                        "type": event,
                        **data
                    }
                )

        except Exception as e:
            print("Listener error:", e)

    # =====================================================
    # 📡 REGISTER CHANNELS
    # =====================================================

    channels = [
        "new_message",
        "message_read",
        "conversation_created",
        "group_updated",
        "connection_update",
        "contact_update"
    ]

    for ch in channels:
        await conn.add_listener(ch, handler)

    print("✅ PG LISTENER STARTED")

    while True:
        await asyncio.sleep(60)

# =========================================================
# 🔄 STARTUP
# =========================================================

@app.on_event("startup")
async def startup():
    app.state.pool = await asyncpg.create_pool(DB_URL)
    asyncio.create_task(pg_listener())

# =========================================================
# ❤️ HEALTH
# =========================================================

@app.get("/health")
async def health():
    return {"status": "ok"}

# =========================================================
# 📦 REQUEST MODELS
# =========================================================

class InviteBody(BaseModel):
    admin_contact_id: str
    target_company: str

class RespondBody(BaseModel):
    admin_contact_id: str
    accept: bool

class RevokeBody(BaseModel):
    admin_contact_id: str

class ContactCheckBody(BaseModel):
    contact_id: str

class CreateConversationBody(BaseModel):
    creator_id: str
    participants: List[str]
    name: Optional[str] = None

class SendMessageBody(BaseModel):
    sender_id: str
    content: str

class DirectMessageBody(BaseModel):
    sender_id: str
    recipient_id: str
    content: str

class MarkReadBody(BaseModel):
    contact_id: str

class GroupActionBody(BaseModel):
    action: str
    payload: dict

# =========================================================
# 🔗 CONNECTIONS
# =========================================================

@app.post("/api/connections/invites")
async def send_invite(body: InviteBody):
    return await db_fetchval(
        "SELECT messaging.fn_send_connection_invite($1,$2)",
        body.admin_contact_id, body.target_company
    )

@app.post("/api/connections/{connection_id}/respond")
async def respond(connection_id: int, body: RespondBody):
    return await db_fetchval(
        "SELECT messaging.fn_respond_to_connection($1,$2,$3)",
        body.admin_contact_id, connection_id, body.accept
    )

@app.post("/api/connections/{connection_id}/revoke")
async def revoke(connection_id: int, body: RevokeBody):
    return await db_fetchval(
        "SELECT messaging.fn_revoke_connection($1,$2)",
        body.admin_contact_id, connection_id
    )

@app.get("/api/contacts/{contact_id}/connections")
async def get_connections(contact_id: str):
    return await db_fetch(
        "SELECT * FROM messaging.fn_get_company_connections($1)",
        contact_id
    )

@app.get("/api/companies/{company}/allowed")
async def allowed_companies(company: str):
    return await db_fetch(
        "SELECT * FROM messaging.fn_get_allowed_companies($1)",
        company
    )

# =========================================================
# 👤 CONTACTS
# =========================================================

@app.get("/api/contacts/{contact_id}/visible-contacts")
async def visible_contacts(contact_id: str):
    return await db_fetch(
        "SELECT * FROM messaging.fn_get_visible_contacts($1)",
        contact_id
    )

@app.post("/api/contacts/check")
async def check_contact(body: ContactCheckBody):
    return await db_fetchval(
        "SELECT messaging.fn_missing_contact_info_json($1)",
        body.contact_id
    )

# =========================================================
# 💬 CONVERSATIONS
# =========================================================

@app.post("/api/conversations")
async def create_conversation(body: CreateConversationBody):
    return await db_fetchval(
        "SELECT messaging.fn_create_conversation($1,$2,$3)",
        body.creator_id, body.participants, body.name
    )

@app.get("/api/conversations/direct")
async def direct(contactA: str, contactB: str):
    return await db_fetchval(
        "SELECT messaging.fn_get_direct_conversation_id($1,$2)",
        contactA, contactB
    )

@app.get("/api/contacts/{contact_id}/inbox")
async def inbox(contact_id: str):
    return await db_fetch(
        "SELECT * FROM messaging.fn_get_contact_inbox($1)",
        contact_id
    )

# =========================================================
# ✉️ MESSAGES
# =========================================================

@app.post("/api/conversations/{conversation_id}/messages")
async def send_message(conversation_id: int, body: SendMessageBody):
    return await db_fetchval(
        "SELECT messaging.fn_send_message($1,$2,$3)",
        conversation_id, body.sender_id, body.content
    )

@app.post("/api/direct-messages")
async def send_direct(body: DirectMessageBody):
    return await db_fetchval(
        "SELECT messaging.fn_send_direct_message($1,$2,$3)",
        body.sender_id, body.recipient_id, body.content
    )

@app.get("/api/conversations/{conversation_id}/messages")
async def get_messages(
    conversation_id: int,
    contact_id: str,
    before: Optional[int] = None,
    limit: int = 50
):
    return await db_fetch(
        "SELECT * FROM messaging.fn_get_conversation_messages($1,$2,$3,$4)",
        conversation_id, contact_id, before, limit
    )

@app.post("/api/conversations/{conversation_id}/read")
async def mark_read(conversation_id: int, body: MarkReadBody):
    return await db_fetchval(
        "SELECT messaging.fn_mark_conversation_read($1,$2)",
        conversation_id, body.contact_id
    )

# =========================================================
# 👥 GROUPS
# =========================================================

@app.post("/api/groups")
async def manage_group(body: GroupActionBody):
    return await db_fetchval(
        "SELECT messaging.fn_manage_group($1,$2)",
        body.action, body.payload
    )

# =========================================================
# 🔌 WEBSOCKET
# =========================================================

@app.websocket("/ws/{contact_id}")
async def websocket_endpoint(websocket: WebSocket, contact_id: str):
    await manager.connect(contact_id, websocket)

    try:
        while True:
            data = await websocket.receive_json()

            if data["type"] == "typing":
                await manager.send_to_user(
                    data["to"],
                    {
                        "type": "typing",
                        "from": contact_id
                    }
                )

    except WebSocketDisconnect:
        manager.disconnect(contact_id, websocket)