"""
Main orchestrator — ties together all components.
Now adapted for Discord instead of WhatsApp.
"""

import asyncio
import json
import logging
from datetime import datetime, timezone

from anthropic import AsyncAnthropic

from agent import InventoryAgent
from cache import CacheLayer
from config import Config
from database import DataLayer
from discord_client import DiscordWebhookSender, DiscordBotClient
from eval import EvalSystem
from rag import RAGIndexer

logger = logging.getLogger(__name__)


class DiscordSupportBot:
    def __init__(self):
        self.cache = CacheLayer(Config.REDIS_URL)
        self.data = DataLayer(Config.SUPABASE_URL, Config.SUPABASE_KEY, self.cache)
        self.discord_sender = DiscordWebhookSender()
        self.claude = AsyncAnthropic(api_key=Config.ANTHROPIC_API_KEY)
        self.evaluator = EvalSystem(self.claude, self.cache)
        self._bot_client: DiscordBotClient | None = None

    def set_bot_client(self, bot_client: DiscordBotClient):
        """Set the Discord bot client for direct channel messaging."""
        self._bot_client = bot_client

    async def handle_message(self, msg: dict):
        """Process a single incoming Discord message."""
        user_id = msg["from"]
        msg_id = msg["id"]
        customer_msg = msg["text_body"]
        customer_name = msg["profile_name"]
        channel_id = msg.get("channel_id", "")

        logger.info(f"Processing message from {customer_name} ({user_id}): {customer_msg[:50]}...")

        # Dedup check — use user_id as the "phone number" equivalent
        history, last_msg_id = await self.data.get_conversation(user_id)
        if msg_id == last_msg_id:
            logger.info(f"Skipping duplicate message {msg_id}")
            return

        # Run agentic loop
        agent = InventoryAgent(self.claude, self.data, user_id, customer_name)
        result = await agent.run(customer_msg)

        # Evaluate response
        eval_score, eval_reason = await self.evaluator.evaluate(
            customer_msg, result.customer_response,
            result.inventory_results, result.keyword
        )
        result.eval_score = eval_score
        result.eval_reason = eval_reason

        # Send customer response via webhook (or direct channel if bot is available)
        if self._bot_client and channel_id:
            await self._bot_client.send_response(int(channel_id), result.customer_response)
        else:
            await self.discord_sender.send_customer_response(
                result.customer_response,
                username=f"{customer_name} Support"
            )

        logger.info(
            f"Sent response to {customer_name} | Score: {eval_score}/10 | "
            f"Tokens: {result.tokens_used} | Latency: {result.latency_ms}ms"
        )

        # Send battle card to sales channel (if product query)
        if result.battle_card:
            await self.discord_sender.send_battle_card(result.battle_card, customer_name)
            logger.info(f"Sent battle card for lead {customer_name}")

        # Save conversation
        await self.data.save_conversation(
            user_id, customer_name, msg_id, history,
            customer_msg, result.customer_response
        )

        # Log metrics
        self._log_metrics(result, eval_score)

    def _log_metrics(self, result, eval_score: int):
        """Log structured metrics for monitoring."""
        metrics = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "eval_score": eval_score,
            "eval_reason": result.eval_reason,
            "keyword": result.keyword,
            "inventory_count": len(result.inventory_results),
            "tokens_in": result.tokens_used.get("input", 0),
            "tokens_out": result.tokens_used.get("output", 0),
            "latency_ms": result.latency_ms,
            "cache_hits": result.cache_hits,
            "has_battle_card": result.battle_card is not None
        }
        logger.info(f"METRICS: {json.dumps(metrics)}")

    async def reindex_inventory(self) -> dict:
        """Trigger RAG re-indexing of inventory."""
        if not Config.USE_RAG:
            return {"status": "RAG disabled"}
        indexer = RAGIndexer(self.data.sb)
        count = await indexer.index_all()
        return {"status": "reindexed", "count": count}

    async def close(self):
        """Clean up resources."""
        await self.discord_sender.close()
        if self._bot_client and not self._bot_client.is_closed():
            await self._bot_client.close()