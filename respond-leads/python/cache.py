"""
Two-tier cache: in-memory (hot) + Redis (persistent).
Critical for cost optimization — prevents redundant Claude API calls.
"""

import hashlib
import json
import logging
import time
from typing import Any, Optional

import redis

logger = logging.getLogger(__name__)


class CacheLayer:
    def __init__(self, redis_url: str):
        self._mem: dict[str, tuple[float, Any]] = {}
        self._use_redis = False

        try:
            self._redis = redis.from_url(redis_url, decode_responses=True)
            self._redis.ping()
            self._use_redis = True
            logger.info("Redis cache connected")
        except Exception as e:
            logger.warning(f"Redis unavailable, using memory-only cache: {e}")
            self._redis = None

    def _make_key(self, prefix: str, *args) -> str:
        raw = f"{prefix}:" + ":".join(str(a) for a in args)
        return hashlib.sha256(raw.encode()).hexdigest()[:32]

    def get(self, prefix: str, *args) -> Optional[Any]:
        key = self._make_key(prefix, *args)

        # L1: memory
        if key in self._mem:
            expiry, val = self._mem[key]
            if time.time() < expiry:
                return val
            del self._mem[key]

        # L2: Redis
        if self._use_redis and self._redis:
            raw = self._redis.get(f"wa:{key}")
            if raw:
                try:
                    data = json.loads(raw)
                    if time.time() < data.get("exp", 0):
                        val = data["val"]
                        self._mem[key] = (data["exp"], val)
                        return val
                except Exception:
                    pass
        return None

    def set(self, prefix: str, ttl: int, value: Any, *args):
        key = self._make_key(prefix, *args)
        exp = time.time() + ttl
        self._mem[key] = (exp, value)

        if self._use_redis and self._redis:
            try:
                self._redis.setex(f"wa:{key}", ttl, json.dumps({"exp": exp, "val": value}))
            except Exception as e:
                logger.debug(f"Redis set failed: {e}")

    def invalidate(self, prefix: str, *args):
        key = self._make_key(prefix, *args)
        self._mem.pop(key, None)

        if self._use_redis and self._redis:
            try:
                self._redis.delete(f"wa:{key}")
            except Exception:
                pass