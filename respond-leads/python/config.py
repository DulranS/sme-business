"""
Centralized configuration — loads from environment variables with sensible defaults.
"""

import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    # ── API Keys ──
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")

    # ── WhatsApp ──
    WHATSAPP_TOKEN: str = os.getenv("WHATSAPP_TOKEN", "")
    WHATSAPP_PHONE_ID: str = os.getenv("WHATSAPP_PHONE_ID", "")
    SALES_CHANNEL_NUMBER: str = os.getenv("SALES_CHANNEL_NUMBER", "")
    WEBHOOK_VERIFY_TOKEN: str = os.getenv("WEBHOOK_VERIFY_TOKEN", "verify_me")

    # ── Model Selection ──
    MODEL_FAST: str = "claude-haiku-4-5"
    MODEL_MAIN: str = "claude-haiku-4-5"
    MODEL_BATTLE: str = "claude-haiku-4-5"

    # ── Cache TTLs (seconds) ──
    CACHE_TTL_INVENTORY: int = int(os.getenv("CACHE_TTL_INVENTORY", "300"))
    CACHE_TTL_CONVERSATION: int = int(os.getenv("CACHE_TTL_CONVERSATION", "60"))
    CACHE_TTL_BUSINESS_INFO: int = int(os.getenv("CACHE_TTL_BUSINESS_INFO", "3600"))
    CACHE_TTL_EVAL: int = int(os.getenv("CACHE_TTL_EVAL", "86400"))

    # ── Cost Controls ──
    MAX_HISTORY_CHARS: int = int(os.getenv("MAX_HISTORY_CHARS", "4000"))
    MAX_TOKENS_RESPONSE: int = int(os.getenv("MAX_TOKENS_RESPONSE", "300"))
    MAX_TOKENS_KEYWORD: int = int(os.getenv("MAX_TOKENS_KEYWORD", "50"))
    MAX_TOKENS_BATTLE: int = int(os.getenv("MAX_TOKENS_BATTLE", "420"))
    MAX_TOKENS_EVAL: int = int(os.getenv("MAX_TOKENS_EVAL", "30"))
    MAX_AGENT_ITERATIONS: int = int(os.getenv("MAX_AGENT_ITERATIONS", "5"))

    # ── RAG ──
    USE_RAG: bool = os.getenv("USE_RAG", "false").lower() == "true"
    RAG_TOP_K: int = int(os.getenv("RAG_TOP_K", "5"))

    @classmethod
    def validate(cls) -> list[str]:
        """Returns list of missing required config values."""
        errors = []
        if not cls.ANTHROPIC_API_KEY:
            errors.append("ANTHROPIC_API_KEY is required")
        if not cls.SUPABASE_URL:
            errors.append("SUPABASE_URL is required")
        if not cls.SUPABASE_KEY:
            errors.append("SUPABASE_KEY is required")
        if not cls.WHATSAPP_TOKEN:
            errors.append("WHATSAPP_TOKEN is required")
        if not cls.WHATSAPP_PHONE_ID:
            errors.append("WHATSAPP_PHONE_ID is required")
        return errors