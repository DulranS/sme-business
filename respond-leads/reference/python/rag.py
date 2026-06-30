"""
RAG indexer — generates and stores embeddings for inventory items.
Run this as a cron job or trigger via /admin/reindex endpoint.
"""

import logging
from typing import Optional

from supabase import Client

logger = logging.getLogger(__name__)


class RAGIndexer:
    """
    Generates and stores embeddings for inventory items.
    Requires: inventory table has `embedding` column (vector type)
    and a function `match_inventory(query_embedding, match_count)`.
    """

    def __init__(self, sb: Client):
        self.sb = sb

    async def index_all(self) -> int:
        """Re-index entire inventory. Returns count of items indexed."""
        resp = self.sb.table("inventory").select("id,name,description,price,sku").execute()
        items = resp.data or []

        if not items:
            logger.warning("No inventory items to index")
            return 0

        texts = [f"{i['name']}. {i.get('description', '')}" for i in items]
        embeddings = await self._generate_embeddings(texts)

        for item, emb in zip(items, embeddings):
            self.sb.table("inventory").update({"embedding": emb}).eq("id", item["id"]).execute()

        logger.info(f"Indexed {len(items)} inventory items")
        return len(items)

    async def index_incremental(self, since: Optional[str] = None) -> int:
        """Index only items updated since a given timestamp."""
        query = self.sb.table("inventory").select("id,name,description,price,sku")
        if since:
            query = query.gt("updated_at", since)

        resp = query.execute()
        items = resp.data or []

        if not items:
            return 0

        texts = [f"{i['name']}. {i.get('description', '')}" for i in items]
        embeddings = await self._generate_embeddings(texts)

        for item, emb in zip(items, embeddings):
            self.sb.table("inventory").update({"embedding": emb}).eq("id", item["id"]).execute()

        logger.info(f"Incrementally indexed {len(items)} items")
        return len(items)

    async def _generate_embeddings(self, texts: list[str]) -> list[list[float]]:
        """
        Generate embeddings for a batch of texts.
        Replace this with your preferred embedding provider.

        Options:
        1. OpenAI: openai.embeddings.create(input=texts, model="text-embedding-3-small")
        2. Local: SentenceTransformer('all-MiniLM-L6-v2').encode(texts).tolist()
        3. Cohere: cohere_client.embed(texts=texts, model="embed-english-v3.0")
        """
        # ── OPTION 1: OpenAI ──
        # import openai
        # client = openai.OpenAI()
        # resp = client.embeddings.create(input=texts, model="text-embedding-3-small")
        # return [d.embedding for d in resp.data]

        # ── OPTION 2: Local (fastest, free, no API calls) ──
        # from sentence_transformers import SentenceTransformer
        # model = SentenceTransformer('all-MiniLM-L6-v2')
        # return model.encode(texts, show_progress_bar=False).tolist()

        # ── PLACEHOLDER — replace with real implementation ──
        logger.warning("Using placeholder embeddings — replace _generate_embeddings")
        return [[0.0] * 384 for _ in texts]