"""
FastAPI server — entry point for the WhatsApp AI Inventory Support bot.
"""

import asyncio
import logging
import sys

from fastapi import FastAPI, Query, Request
from fastapi.responses import PlainTextResponse

from bot import WhatsAppSupportBot
from config import Config

# ── Logging ──
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

# ── Validate config ──
errors = Config.validate()
if errors:
    for err in errors:
        logger.error(f"Config error: {err}")
    sys.exit(1)

# ── App ──
app = FastAPI(title="WhatsApp AI Inventory Support", version="1.0.0")
bot = WhatsAppSupportBot()


@app.on_event("shutdown")
async def shutdown():
    await bot.close()


@app.get("/webhook")
async def verify_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge")
):
    """WhatsApp webhook verification endpoint."""
    if hub_mode == "subscribe" and hub_token == Config.WEBHOOK_VERIFY_TOKEN:
        return PlainTextResponse(hub_challenge or "")
    return PlainTextResponse("Forbidden", status_code=403)


@app.post("/webhook")
async def receive_webhook(request: Request):
    """Receive and process incoming WhatsApp messages."""
    payload = await request.json()
    await bot.webhook_handler(payload)
    return {"status": "ok"}


@app.post("/admin/reindex")
async def reindex_inventory():
    """Trigger RAG re-indexing of inventory."""
    return await bot.reindex_inventory()


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "rag_enabled": Config.USE_RAG,
        "cache": "redis" if bot.cache._use_redis else "memory"
    }


# ── Demo mode ──
async def demo():
    """Test the agent without WhatsApp — useful for development."""
    test_msg = {
        "id": "test_msg_001",
        "from": "+94771234567",
        "text_body": "Do you have Nike Air Max in size 9?",
        "profile_name": "Kasun",
        "timestamp": "1718600000"
    }

    from agent import InventoryAgent

    phone = test_msg["from"]
    agent = InventoryAgent(bot.claude, bot.data, phone, test_msg["profile_name"])
    result = await agent.run(test_msg["text_body"])

    eval_score, eval_reason = await bot.evaluator.evaluate(
        test_msg["text_body"], result.customer_response,
        result.inventory_results, result.keyword
    )

    print("\n" + "=" * 60)
    print(f"CUSTOMER: {test_msg['text_body']}")
    print(f"KEYWORD: {result.keyword}")
    print(f"INVENTORY: {len(result.inventory_results)} items")
    print(f"\nRESPONSE:\n{result.customer_response}")
    print(f"\nEVAL: {eval_score}/10 — {eval_reason}")
    print(f"TOKENS: {result.tokens_used}")
    print(f"LATENCY: {result.latency_ms}ms")
    if result.battle_card:
        print(f"\nBATTLE CARD:\n{result.battle_card}")
    print("=" * 60)

    await bot.close()


if __name__ == "__main__":
    if "--demo" in sys.argv:
        asyncio.run(demo())
    else:
        print("Start with: uvicorn main:app --host 0.0.0.0 --port 8000")
        print("Or demo: python main.py --demo")