"""
Data models used across the application.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class MessageType(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    AUDIO = "audio"
    DOCUMENT = "document"
    UNKNOWN = "unknown"


@dataclass
class InventoryItem:
    name: str
    quantity: int
    price: Optional[float]
    sku: str
    description: str = ""

    def to_display(self) -> str:
        price_str = f"${self.price:.2f}" if self.price else "N/A"
        return f"{self.name} | Stock: {self.quantity} | Price: {price_str} | SKU: {self.sku}"


@dataclass
class ConversationMessage:
    role: str  # "customer" or "assistant"
    content: str
    timestamp: str = ""


@dataclass
class BusinessInfo:
    store_name: str = "our store"
    store_hours: str = "please contact us for hours"
    store_location: str = "please contact us for our address"
    store_contact: str = "please reply here for help"
    return_policy: str = "please contact us about returns"
    shipping_info: str = "please contact us for shipping details"
    payment_methods: str = "please contact us for payment options"
    additional_info: str = ""


@dataclass
class AgentResult:
    customer_response: str
    battle_card: Optional[str] = None
    keyword: str = "GENERAL"
    inventory_results: list = field(default_factory=list)
    eval_score: Optional[int] = None
    eval_reason: str = ""
    tokens_used: dict = field(default_factory=dict)
    latency_ms: int = 0
    cache_hits: int = 0