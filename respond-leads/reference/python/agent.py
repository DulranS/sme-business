"""
Agentic core — Claude with tool use.
Replaces the rigid Make.com flow with flexible reasoning.
"""

import json
import logging
import time
from typing import Optional

from anthropic import AsyncAnthropic

from config import Config
from database import DataLayer
from models import AgentResult, BusinessInfo, InventoryItem

logger = logging.getLogger(__name__)


class InventoryAgent:
    """
    Agentic loop: Claude decides which tools to call.
    Tools: search_inventory, get_business_info, get_conversation_history
    """

    TOOLS = [
        {
            "name": "search_inventory",
            "description": (
                "Search inventory by keyword. Returns matching products with stock, price, SKU. "
                "Use this when the customer asks about a specific product."
            ),
            "input_schema": {
                "type": "object",
                "properties": {
                    "keyword": {
                        "type": "string",
                        "description": "Product name, SKU, or search term. Use 'GENERAL' for non-product queries."
                    }
                },
                "required": ["keyword"]
            }
        },
        {
            "name": "get_business_info",
            "description": (
                "Get store information: hours, location, contact, policies, payment methods, shipping. "
                "Use for non-product questions."
            ),
            "input_schema": {
                "type": "object",
                "properties": {},
                "required": []
            }
        },
        {
            "name": "get_conversation_history",
            "description": (
                "Get previous conversation with this customer. "
                "Use when the message references 'it', 'that one', 'the same', or needs context."
            ),
            "input_schema": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    ]

    SYSTEM_PROMPT = """You are a warm, helpful customer support assistant for a WhatsApp business.

BEHAVIOR:
- Use tools to gather information before responding
- For product queries: call search_inventory, then respond with accurate stock/price info
- For policy/hours/location questions: call get_business_info
- If the message is vague ("it", "that one"): call get_conversation_history first
- If the message is a greeting or general chat: respond warmly without tools

FORMATTING RULES:
- Plain text only — no asterisks, underscores, dashes as bullets, numbered lists
- Short paragraphs or single sentences
- Under 220 words
- Never open with 'Certainly!', 'Absolutely!', 'Great question!', 'I understand your concern'
- Start naturally, like a real person

ACCURACY:
- For stock levels, prices, SKUs: use ONLY inventory tool results, never guess
- If inventory is empty, say so honestly and ask the customer to describe differently or share the product code
- Never mention Make, Supabase, Claude, AI, automation, or any internal systems
- Never invent contact details, addresses, or policies

TONE:
- Warm and conversational, not robotic or corporate
- If the customer seems frustrated, acknowledge it warmly before answering
- Address the customer by name if known

After gathering information via tools, provide your final response as plain text."""

    BATTLE_CARD_PROMPT = """You are a sales intelligence assistant. Generate a concise battle card for our human sales closer based on this lead interaction.

Use exactly this structure (plain text, no markdown):

LEAD SNAPSHOT
[One sentence: who this person appears to be, what they want, budget/timeline signals]

TOP 3 SELLING POINTS
1. [Concrete inventory fact tied to what they asked. Lead with number/stat.]
2. [Second point. Specific, translate numbers into value.]
3. [Third point. Frame around their situation.]

OBJECTION 1: [Name in 5 words or fewer]
Why: [One sentence on the psychology behind it.]
Script: [How a real salesperson would handle it. Never start with "I understand" or "Certainly". Start mid-thought.]

OBJECTION 2: [Name in 5 words or fewer]
Why: [One sentence.]
Script: [Same rules. Under 3 sentences.]

CLOSER TIP
[One tactical observation specific to this lead.]

Rules:
- Never invent inventory data
- Scripts must sound like a real person
- Keep under 300 words
- Address the lead by name if known"""

    def __init__(self, client: AsyncAnthropic, data: DataLayer, phone: str, customer_name: str):
        self.client = client
        self.data = data
        self.phone = phone
        self.customer_name = customer_name
        self._business_info: Optional[BusinessInfo] = None
        self._history: str = ""
        self._inventory_cache: dict[str, list[InventoryItem]] = {}
        self.total_input_tokens = 0
        self.total_output_tokens = 0

    async def run(self, customer_message: str) -> AgentResult:
        """Execute the agentic loop."""
        start = time.time()
        messages = [{"role": "user", "content": customer_message}]
        all_inventory: list[InventoryItem] = []
        keyword_used = "GENERAL"
        cache_hits = 0

        for iteration in range(Config.MAX_AGENT_ITERATIONS):
            system = self.SYSTEM_PROMPT
            if self._history:
                system += f"\n\nConversation history:\n{self._history}"
            system += f"\n\nCustomer name: {self.customer_name}"

            try:
                response = await self.client.messages.create(
                    model=Config.MODEL_MAIN,
                    max_tokens=Config.MAX_TOKENS_RESPONSE,
                    system=system,
                    tools=self.TOOLS,
                    messages=messages
                )
            except Exception as e:
                logger.error(f"Claude API error: {e}")
                return AgentResult(
                    customer_response="Sorry, I'm having trouble right now. Please try again in a moment.",
                    latency_ms=int((time.time() - start) * 1000)
                )

            self.total_input_tokens += response.usage.input_tokens
            self.total_output_tokens += response.usage.output_tokens

            # ── Final response ──
            if response.stop_reason == "end_turn":
                final_text = ""
                for block in response.content:
                    if hasattr(block, "text"):
                        final_text += block.text

                battle_card = None
                if keyword_used != "GENERAL" and all_inventory:
                    battle_card = await self._generate_battle_card(
                        customer_message, all_inventory, keyword_used
                    )

                return AgentResult(
                    customer_response=final_text.strip(),
                    battle_card=battle_card,
                    keyword=keyword_used,
                    inventory_results=all_inventory,
                    tokens_used={
                        "input": self.total_input_tokens,
                        "output": self.total_output_tokens
                    },
                    latency_ms=int((time.time() - start) * 1000),
                    cache_hits=cache_hits
                )

            # ── Tool use ──
            elif response.stop_reason == "tool_use":
                messages.append({"role": "assistant", "content": response.content})
                tool_results = []

                for block in response.content:
                    if block.type == "tool_use":
                        tool_result = await self._execute_tool(block.name, block.input)
                        cache_hits += tool_result.get("cache_hit", 0)

                        if block.name == "search_inventory":
                            keyword_used = block.input.get("keyword", "GENERAL")
                            all_inventory = tool_result.get("items", [])

                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": json.dumps(tool_result.get("result", ""))
                        })

                messages.append({"role": "user", "content": tool_results})
            else:
                break

        # Fallback if loop exhausted
        return AgentResult(
            customer_response="Let me check on that for you. One moment please.",
            latency_ms=int((time.time() - start) * 1000)
        )

    async def _execute_tool(self, name: str, inp: dict) -> dict:
        if name == "search_inventory":
            keyword = inp.get("keyword", "GENERAL")
            if Config.USE_RAG:
                items = await self.data.search_inventory_rag(keyword)
            else:
                items = await self.data.search_inventory_keyword(keyword)
            self._inventory_cache[keyword] = items
            return {
                "result": [i.to_display() for i in items] if items else "No matching products found.",
                "items": items,
                "cache_hit": 0
            }

        elif name == "get_business_info":
            if not self._business_info:
                self._business_info = await self.data.get_business_info(self.phone)
            bi = self._business_info
            return {
                "result": {
                    "store_name": bi.store_name,
                    "hours": bi.store_hours,
                    "location": bi.store_location,
                    "contact": bi.store_contact,
                    "return_policy": bi.return_policy,
                    "shipping": bi.shipping_info,
                    "payment_methods": bi.payment_methods,
                    "additional": bi.additional_info
                }
            }

        elif name == "get_conversation_history":
            if not self._history:
                self._history, _ = await self.data.get_conversation(self.phone)
            return {
                "result": self._history if self._history else "No prior conversation — this is the first message."
            }

        return {"result": f"Unknown tool: {name}"}

    async def _generate_battle_card(
        self,
        customer_msg: str,
        inventory: list[InventoryItem],
        keyword: str
    ) -> Optional[str]:
        inv_text = "\n".join(i.to_display() for i in inventory)
        prompt = f"""{self.BATTLE_CARD_PROMPT}

Customer name: {self.customer_name}
Customer message: {customer_msg}
Conversation history: {self._history or 'No prior history — first contact.'}
Inventory search keyword: {keyword}
Inventory results:
{inv_text}"""

        try:
            resp = await self.client.messages.create(
                model=Config.MODEL_BATTLE,
                max_tokens=Config.MAX_TOKENS_BATTLE,
                messages=[{"role": "user", "content": prompt}]
            )
            self.total_input_tokens += resp.usage.input_tokens
            self.total_output_tokens += resp.usage.output_tokens
            return resp.content[0].text.strip()
        except Exception as e:
            logger.error(f"Battle card generation failed: {e}")
            return None