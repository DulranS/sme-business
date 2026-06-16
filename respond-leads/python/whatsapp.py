"""
WhatsApp Business Cloud API client.
Handles sending messages and parsing webhook payloads.
"""

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)


class WhatsAppClient:
    BASE = "https://graph.facebook.com/v19.0"

    def __init__(self, token: str, phone_id: str):
        self.token = token
        self.phone_id = phone_id
        self._client = httpx.AsyncClient(timeout=30)

    async def send_text(self, to: str, body: str, context_msg_id: str = None) -> dict:
        """Send a text message via WhatsApp Cloud API."""
        payload: dict[str, Any] = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "text",
            "text": {"body": body}
        }
        if context_msg_id:
            payload["context"] = {"message_id": context_msg_id}

        resp = await self._client.post(
            f"{self.BASE}/{self.phone_id}/messages",
            headers={
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json"
            },
            json=payload
        )
        resp.raise_for_status()
        return resp.json()

    def parse_webhook(self, payload: dict) -> list[dict]:
        """Extract messages from WhatsApp webhook payload."""
        messages = []

        for entry in payload.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                if "messages" not in value:
                    continue

                for msg in value["messages"]:
                    messages.append({
                        "id": msg.get("id", ""),
                        "from": msg.get("from", ""),
                        "type": msg.get("type", "unknown"),
                        "text_body": (
                            msg.get("text", {}).get("body", "")
                            if msg.get("type") == "text"
                            else "[Non-text message]"
                        ),
                        "profile_name": (
                            value.get("contacts", [{}])[0]
                            .get("profile", {})
                            .get("name", "Unknown")
                        ),
                        "timestamp": msg.get("timestamp", "")
                    })

        return messages

    async def close(self):
        await self._client.aclose()