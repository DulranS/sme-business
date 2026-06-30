"""
Entry point — runs both the Discord bot (for receiving) and FastAPI (for webhooks/admin).
"""

import asyncio
import logging
import sys

from fastapi import FastAPI, Request
from fastapi.responses import PlainTextResponse

from bot import DiscordSupportBot
from config import Config
from discord_client import create_bot

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

# ── Initialize bot ──
bot = DiscordSupportBot()
discord_bot = create_bot(bot.handle_message)
bot.set_bot_client(discord_bot)


# ── FastAPI app (for admin endpoints + Discord Interactions) ──
app = FastAPI(title="Discord AI Inventory Support", version="1.0.0")


@app.on_event("startup")
async def startup():
    """Start the Discord bot in the background."""
    if Config.DISCORD_BOT_TOKEN:
        asyncio.create_task(discord_bot.start(Config.DISCORD_BOT_TOKEN))
        logger.info("Discord bot starting in background")
    else:
        logger.warning("DISCORD_BOT_TOKEN not set — bot will only respond via webhooks")


@app.on_event("shutdown")
async def shutdown():
    await bot.close()


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "rag_enabled": Config.USE_RAG,
        "cache": "redis" if bot.cache._use_redis else "memory",
        "discord_bot_connected": not discord_bot.is_closed() if discord_bot else False
    }


@app.post("/admin/reindex")
async def reindex_inventory():
    """Trigger RAG re-indexing of inventory."""
    return await bot.reindex_inventory()


@app.post("/discord/interactions")
async def discord_interactions(request: Request):
    """
    Handle Discord Interactions (slash commands, message components).
    Useful if you want slash commands like /ask, /inventory, etc.
    """
    # Verify Discord signature (requires pynacl)
    try:
        from nacl.signing import VerifyKey
        from nacl.exceptions import BadSignatureError

        public_key = Config.DISCORD_PUBLIC_KEY
        signature = request.headers.get("X-Signature-Ed25519")
        timestamp = request.headers.get("X-Signature-Timestamp")
        body = await request.body()

        if public_key and signature and timestamp:
            verify_key = VerifyKey(bytes.fromhex(public_key))
            try:
                verify_key.verify(f"{timestamp}{body.decode()}".encode(), bytes.fromhex(signature))
            except BadSignatureError:
                return PlainTextResponse("Invalid signature", status_code=401)
    except ImportError:
        logger.warning("pynacl not installed — skipping signature verification")

    payload = await request.json()
    interaction_type = payload.get("type")

    # Ping — Discord sends this to verify your endpoint
    if interaction_type == 1:
        return {"type": 1}

    # Application command (slash command)
    if interaction_type == 2:
        command_name = payload.get("data", {}).get("name")
        options = {opt["name"]: opt["value"] for opt in payload.get("data", {}).get("options", [])}

        if command_name == "ask":
            question = options.get("question", "")
            user = payload.get("member", {}).get("user", {})
            user_id = str(user.get("id", ""))
            username = user.get("global_name") or user.get("username", "Unknown")

            # Process asynchronously — respond with deferred message
            # In production, you'd use interaction tokens to send follow-ups
            asyncio.create_task(bot.handle_message({
                "id": f"interaction_{payload.get('id', '')}",
                "from": user_id,
                "text_body": question,
                "profile_name": username,
                "timestamp": str(int(payload.get("created_at", 0))),
                "channel_id": str(payload.get("channel_id", "")),
                "guild_id": str(payload.get("guild_id", ""))
            }))

            return {
                "type": 4,  # Channel message with source
                "data": {
                    "content": f"Processing your question: {question}",
                    "flags": 64  # Ephemeral
                }
            }

    return {"type": 1}


# ── Demo mode ──
async def demo():
    """Test the agent without Discord — useful for development."""
    test_msg = {
        "id": "test_msg_001",
        "from": "123456789012345678",
        "text_body": "Do you have Nike Air Max in size 9?",
        "profile_name": "Kasun",
        "timestamp": "1718600000",
        "channel_id": "111111111111111111",
        "guild_id": "222222222222222222"
    }

    from agent import InventoryAgent

    user_id = test_msg["from"]
    agent = InventoryAgent(bot.claude, bot.data, user_id, test_msg["profile_name"])
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