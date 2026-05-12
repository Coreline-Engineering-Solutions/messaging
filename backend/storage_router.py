"""
Storage proxy router for the CES Messaging system.

Add this to your FastAPI app:
    from backend.storage_router import router as storage_router
    app.include_router(storage_router)

Required environment variables (set in Render dashboard):
    MESSAGING_STORAGE_API_KEY   — the API key for the file storage service
    MESSAGING_SERVICE_BASE_URL  — base URL of the storage service
                                  (default: https://file-storage-api-sz2e.onrender.com)

The API key is NEVER sent to the browser — only this server-side module uses it.
"""
import os
from io import BytesIO

import httpx
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

STORAGE_BASE: str = os.getenv(
    "MESSAGING_SERVICE_BASE_URL", "https://file-storage-api-sz2e.onrender.com"
).rstrip("/")

STORAGE_KEY: str = os.getenv("MESSAGING_STORAGE_API_KEY", "")

router = APIRouter(prefix="/api/messaging/storage", tags=["messaging-storage"])


def _require_key() -> None:
    if not STORAGE_KEY:
        raise HTTPException(
            status_code=500,
            detail="MESSAGING_STORAGE_API_KEY is not configured on this server.",
        )


# ── Upload ──────────────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    category: str = Form(default="messaging_attachments"),
):
    """Receive a file from the Angular client, inject the API key, forward to storage service."""
    _require_key()

    content = await file.read()
    mime = file.content_type or "application/octet-stream"

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            f"{STORAGE_BASE}/storage/store",
            data={"api_key": STORAGE_KEY, "category": category},
            files={"file": (file.filename, BytesIO(content), mime)},
        )

    if resp.status_code != 200:
        try:
            detail = resp.json().get("detail", "Upload to storage service failed")
        except Exception:
            detail = "Upload to storage service failed"
        raise HTTPException(status_code=resp.status_code, detail=detail)

    data = resp.json()
    return {
        "file_id": data["file_id"],
        "filename": data.get("filename", file.filename),
        "size_bytes": data.get("size_bytes", len(content)),
        "mime_type": mime,
    }


# ── Retrieve ─────────────────────────────────────────────────────────────────

class FileIdRequest(BaseModel):
    file_id: str


@router.post("/retrieve")
async def retrieve_file(body: FileIdRequest):
    """Return base64 + mime_type for a stored file so the browser can display it inline."""
    _require_key()

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{STORAGE_BASE}/storage/retrieve",
            data={"api_key": STORAGE_KEY, "file_id": body.file_id},
        )

    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail="File not found in storage")
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="Storage retrieval failed")

    data = resp.json()
    return {
        "file_id": data.get("file_id", body.file_id),
        "filename": data.get("filename", body.file_id),
        "mime_type": data.get("mime_type", "application/octet-stream"),
        "base64_data": data.get("base64_data", ""),
    }


# ── Delete ────────────────────────────────────────────────────────────────────

@router.post("/delete")
async def delete_file(body: FileIdRequest):
    """Delete a file from storage. Call after removing your DB reference."""
    _require_key()

    async with httpx.AsyncClient(timeout=30.0) as client:
        await client.post(
            f"{STORAGE_BASE}/storage/delete",
            data={"api_key": STORAGE_KEY, "file_id": body.file_id},
        )

    return {"success": True}
