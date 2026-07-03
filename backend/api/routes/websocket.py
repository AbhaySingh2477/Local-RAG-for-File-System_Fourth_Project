"""
WebSocket Route — Real-time progress updates for document processing.
"""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from workers.document_worker import get_document_worker

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time updates.
    Clients connect here to receive document processing progress,
    status changes, and other real-time notifications.
    """
    await websocket.accept()
    worker = get_document_worker()
    worker.add_connection(websocket)

    logger.info("[WS] Client connected")

    try:
        # Send initial status
        await websocket.send_text(json.dumps({
            "type": "connected",
            "message": "WebSocket connected",
        }))

        # Keep connection alive — listen for client messages
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                msg_type = message.get("type", "")

                if msg_type == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
                elif msg_type == "subscribe":
                    # Client subscribes to specific document updates
                    logger.debug(f"[WS] Client subscribed to: {message.get('document_id')}")
                else:
                    logger.debug(f"[WS] Unknown message type: {msg_type}")

            except json.JSONDecodeError:
                pass

    except WebSocketDisconnect:
        logger.info("[WS] Client disconnected")
    except Exception as e:
        logger.error(f"[WS] Error: {e}")
    finally:
        worker.remove_connection(websocket)
