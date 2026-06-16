"""
Main orchestrator — ties together all components.
Handles message processing, evaluation, and metric logging.
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
from eval import EvalSystem
from rag import RAGIndexer
from whatsapp import WhatsAppClient

logger = logging.getLogger(__name__)


class WhatsAppSupportBot:
    def __init__(self):
        self.cache = CacheLayer(Config.REDIS_URL)
        self.data = DataLayer(Config.SUPABASE_URL, Config.SUPABASE_KEY, self.cache)
        self.whatsapp = WhatsAppClient(Config.WHATSAPP_TOKEN, Config.WHATSAPP_PHONE_ID)
        self.claude = AsyncAnthropic(api_key=Config.ANTHROPIC_API_KEY)
        self.evaluator = EvalSystem(self.claude, self.cache)

    async def handle_message(self, msg: dict):
        """Process a single incoming WhatsApp message."""
        phone = msg["from"]
        msg_id = msg["id"]
        customer_msg = msg["text_body"]
        customer_name = msg["profile_name"]

        logger.info(f"Processing message from {customer_name} ({phone}): {customer_msg[:50]}...")

        # Dedup check
        history, last_msg_id = await self.data.get_conversation(phone)
        if msg_id == last_msg_id:
            logger.info(f"Skipping duplicate message {msg_id}")
            return

        # Run agentic loop
        agent = InventoryAgent(self.claude, self.data, phone, customer_name)
        result = await agent.run(customer_msg)

        # Evaluate response
        eval_score, eval_reason = await self.evaluator.evaluate(
            customer_msg, result.customer_response,
            result.inventory_results, result.keyword
        )
        result.eval_score = eval_score
        result.eval_reason = eval_reason

        # Send customer response
        await self.whatsapp.send_text(phone, result.customer_response, context_msg_id=msg_id)
        logger.info(
            f"Sent response to {phone} | Score: {eval_score}/10 | "
            f"Tokens: {result.tokens_used} | Latency: {result.latency_ms}ms"
        )

        # Send battle card to sales channel (if product query)
        if result.battle_card:
            battle_msg = f"Lead alert — {customer_name}\n\n{result.battle_card}"
            await self.whatsapp.send_text(Config.SALES_CHANNEL_NUMBER, battle_msg)
            logger.info(f"Sent battle card for lead {customer_name}")

        # Save conversation
        await self.data.save_conversation(
            phone, customer_name, msg_id, history,
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

    async def webhook_handler(self, payload: dict):
        """Process all messages from a webhook payload in parallel."""
        messages = self.whatsapp.parse_webhook(payload)
        tasks = [self.handle_message(msg) for msg in messages]
        await asyncio.gather(*tasks, return_exceptions=True)

    async def reindex_inventory(self) -> dict:
        """Trigger RAG re-indexing of inventory."""
        if not Config.USE_RAG:
            return {"status": "RAG disabled"}
        indexer = RAGIndexer(self.data.sb)
        count = await indexer.index_all()
        return {"status": "reindexed", "count": count}

    async def close(self):
        """Clean up resources."""
        await self.whatsapp.close()