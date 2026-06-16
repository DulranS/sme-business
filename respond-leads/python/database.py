"""
Supabase data layer — handles inventory search, conversation history,
and business info storage with caching.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from supabase import create_client, Client

from cache import CacheLayer
from config import Config
from models import BusinessInfo, InventoryItem

logger = logging.getLogger(__name__)


class DataLayer:
    def __init__(self, url: str, key: str, cache: CacheLayer):
        self.sb: Client = create_client(url, key)
        self.cache = cache

    # ── Inventory ──

    async def search_inventory_keyword(self, keyword: str, limit: int = 5) -> list[InventoryItem]:
        """Standard ilike search — fast and cheap."""
        if keyword == "GENERAL" or not keyword.strip():
            return []

        cached = self.cache.get("inv_kw", keyword)
        if cached is not None:
            return [InventoryItem(**i) for i in cached]

        resp = (
            self.sb.table("inventory")
            .select("name,quantity,price,sku,description")
            .ilike("name", f"%{keyword}%")
            .limit(limit)
            .execute()
        )

        items = [InventoryItem(**r) for r in (resp.data or [])]
        self.cache.set("inv_kw", Config.CACHE_TTL_INVENTORY, [i.__dict__ for i in items], keyword)
        return items

    async def search_inventory_rag(self, query: str, limit: int = 5) -> list[InventoryItem]:
        """Semantic search via pgvector RPC function."""
        cached = self.cache.get("inv_rag", query)
        if cached is not None:
            return [InventoryItem(**i) for i in cached]

        resp = self.sb.rpc("match_inventory", {
            "query_text": query,
            "match_count": limit
        }).execute()

        items = [
            InventoryItem(
                name=r.get("name", ""),
                quantity=r.get("quantity", 0),
                price=r.get("price"),
                sku=r.get("sku", ""),
                description=r.get("description", "")
            )
            for r in (resp.data or [])
        ]

        self.cache.set("inv_rag", Config.CACHE_TTL_INVENTORY, [i.__dict__ for i in items], query)
        return items

    # ── Conversations ──

    async def get_conversation(self, phone: str) -> tuple[str, str]:
        """Returns (history_string, last_message_id)."""
        cached = self.cache.get("conv", phone)
        if cached is not None:
            return cached["history"], cached["last_message_id"]

        resp = (
            self.sb.table("conversations")
            .select(
                "history,last_message_id,store_name,store_hours,store_location,"
                "store_contact,return_policy,shipping_info,payment_methods,additional_info"
            )
            .eq("phone_number", phone)
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )

        if resp.data:
            row = resp.data[0]
            result = {
                "history": row.get("history", "") or "",
                "last_message_id": row.get("last_message_id", "") or "",
                "business_info": BusinessInfo(
                    store_name=row.get("store_name") or "our store",
                    store_hours=row.get("store_hours") or "please contact us for hours",
                    store_location=row.get("store_location") or "please contact us for our address",
                    store_contact=row.get("store_contact") or "please reply here for help",
                    return_policy=row.get("return_policy") or "please contact us about returns",
                    shipping_info=row.get("shipping_info") or "please contact us for shipping details",
                    payment_methods=row.get("payment_methods") or "please contact us for payment options",
                    additional_info=row.get("additional_info") or ""
                )
            }
            self.cache.set("conv", Config.CACHE_TTL_CONVERSATION, result, phone)
            return result["history"], result["last_message_id"]

        return "", ""

    async def get_business_info(self, phone: str) -> BusinessInfo:
        """Get business info — cached for 1 hour since it rarely changes."""
        cached = self.cache.get("biz", phone)
        if cached:
            return BusinessInfo(**cached)

        # Trigger conversation fetch to populate cache
        await self.get_conversation(phone)
        cached = self.cache.get("conv", phone)

        if cached and "business_info" in cached:
            bi = cached["business_info"]
            self.cache.set("biz", Config.CACHE_TTL_BUSINESS_INFO, bi.__dict__, phone)
            return bi

        return BusinessInfo()

    async def save_conversation(
        self,
        phone: str,
        customer_name: str,
        message_id: str,
        history: str,
        new_customer_msg: str,
        new_assistant_msg: str
    ):
        """Append new messages to conversation history and upsert."""
        updated_history = self._truncate_history(
            (history or "") +
            f"\n[Customer]: {new_customer_msg}\n[Assistant]: {new_assistant_msg}"
        )

        self.sb.table("conversations").upsert(
            {
                "phone_number": phone,
                "customer_name": customer_name,
                "last_message_id": message_id,
                "history": updated_history,
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            on_conflict="phone_number"
        ).execute()

        # Invalidate caches
        self.cache.invalidate("conv", phone)
        self.cache.invalidate("biz", phone)

    @staticmethod
    def _truncate_history(text: str) -> str:
        if len(text) <= Config.MAX_HISTORY_CHARS:
            return text
        return text[-Config.MAX_HISTORY_CHARS:]