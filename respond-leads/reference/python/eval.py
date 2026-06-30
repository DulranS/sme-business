"""
Evaluation system — scores AI responses 1-10 across multiple dimensions.
Uses Claude Haiku for fast, cheap evaluation with caching.
"""

import logging
import re
from typing import Optional

from anthropic import AsyncAnthropic

from cache import CacheLayer
from config import Config
from models import InventoryItem

logger = logging.getLogger(__name__)


class EvalSystem:
    """
    Evaluates AI responses on a 1-10 scale.
    Criteria: relevance, accuracy, tone, formatting, helpfulness.
    """

    CRITERIA = {
        "relevance": "Does the response directly address the customer's question?",
        "accuracy": "Are inventory facts (stock, price, SKU) correct based on provided data?",
        "tone": "Is the tone warm, natural, human? No robotic openers?",
        "formatting": "Plain text only? Under 220 words? No markdown?",
        "helpfulness": "If out of stock, does it suggest alternatives or ask for clarification?"
    }

    def __init__(self, client: AsyncAnthropic, cache: CacheLayer):
        self.client = client
        self.cache = cache

    async def evaluate(
        self,
        customer_msg: str,
        customer_response: str,
        inventory_results: list[InventoryItem],
        keyword: str
    ) -> tuple[int, str]:
        """Returns (score 1-10, reasoning)."""
        cache_key = f"{keyword}:{customer_msg[:100]}:{customer_response[:100]}"
        cached = self.cache.get("eval", cache_key)
        if cached:
            return cached["score"], cached["reason"]

        inv_text = (
            "\n".join(i.to_display() for i in inventory_results)
            if inventory_results
            else "No results"
        )

        prompt = f"""Score this WhatsApp customer service response from 1-10.

CRITERIA:
- relevance (0-2): Directly addresses the question?
- accuracy (0-2): Inventory facts correct?
- tone (0-2): Warm, natural, human? No "Certainly!" or "Absolutely!"?
- formatting (0-2): Plain text, short, no markdown?
- helpfulness (0-2): Handles edge cases well?

Customer: {customer_msg}
Keyword extracted: {keyword}
Inventory available:
{inv_text}

AI Response:
{customer_response}

Reply in EXACTLY this format:
SCORE: [number 1-10]
REASON: [one sentence]"""

        try:
            resp = await self.client.messages.create(
                model=Config.MODEL_FAST,
                max_tokens=Config.MAX_TOKENS_EVAL,
                messages=[{"role": "user", "content": prompt}]
            )
            text = resp.content[0].text.strip()
            score_match = re.search(r"SCORE:\s*(\d+)", text)
            reason_match = re.search(r"REASON:\s*(.+)", text, re.DOTALL)

            score = int(score_match.group(1)) if score_match else 5
            score = max(1, min(10, score))
            reason = reason_match.group(1).strip() if reason_match else "Parse error"

            self.cache.set("eval", Config.CACHE_TTL_EVAL, {"score": score, "reason": reason}, cache_key)
            return score, reason

        except Exception as e:
            logger.error(f"Eval failed: {e}")
            return 5, f"Eval error: {e}"