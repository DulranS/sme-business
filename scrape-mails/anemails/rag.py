from __future__ import annotations

import argparse
import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import List, Tuple

import faiss
import numpy as np
from openai import OpenAI
from pypdf import PdfReader


# -----------------------------
# Config
# -----------------------------
OPENAI_API_KEY = os.getenv("OPENAI_EMBED_MODEL","test123")
EMBED_MODEL = os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-small")
CHAT_MODEL = os.getenv("OPENAI_CHAT_MODEL", "gpt-4.1-mini")

INDEX_PATH = "rag.index"
CHUNKS_PATH = "rag_chunks.jsonl"


# -----------------------------
# Data structures
# -----------------------------

@dataclass
class Chunk:
    chunk_id: str
    source: str
    text: str


# -----------------------------
# Loading documents
# -----------------------------

def read_text_file(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def read_pdf_file(path: Path) -> str:
    reader = PdfReader(str(path))
    pages = []
    for page in reader.pages:
        try:
            pages.append(page.extract_text() or "")
        except Exception:
            pages.append("")
    return "\n".join(pages)


def load_documents(data_dir: Path) -> List[Tuple[str, str]]:
    docs = []
    for path in sorted(data_dir.rglob("*")):
        if not path.is_file():
            continue

        suffix = path.suffix.lower()
        try:
            if suffix in {".txt", ".md", ".markdown"}:
                text = read_text_file(path)
            elif suffix == ".pdf":
                text = read_pdf_file(path)
            else:
                continue
        except Exception as e:
            print(f"[skip] {path} -> {e}")
            continue

        text = normalize_text(text)
        if text.strip():
            docs.append((str(path), text))

    return docs


# -----------------------------
# Cleaning + chunking
# -----------------------------

def normalize_text(text: str) -> str:
    text = text.replace("\x00", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def chunk_text(text: str, max_chars: int = 1200, overlap: int = 200) -> List[str]:
    """
    Simple character-based chunking with overlap.
    Good enough for a practice RAG demo.
    """
    text = normalize_text(text)
    if len(text) <= max_chars:
        return [text]

    chunks = []
    start = 0
    while start < len(text):
        end = min(start + max_chars, len(text))
        chunk = text[start:end].strip()

        # try not to end mid-word too harshly
        if end < len(text):
            last_space = chunk.rfind(" ")
            if last_space > 200:
                chunk = chunk[:last_space].strip()
                end = start + last_space

        if chunk:
            chunks.append(chunk)

        if end >= len(text):
            break

        start = max(0, end - overlap)

    return chunks


def build_chunks(docs: List[Tuple[str, str]]) -> List[Chunk]:
    all_chunks: List[Chunk] = []
    for source, text in docs:
        pieces = chunk_text(text)
        for i, piece in enumerate(pieces):
            all_chunks.append(
                Chunk(
                    chunk_id=f"{Path(source).name}::chunk_{i}",
                    source=source,
                    text=piece,
                )
            )
    return all_chunks


# -----------------------------
# Embeddings
# -----------------------------

def embed_texts(client: OpenAI, texts: List[str], model: str) -> np.ndarray:
    """
    Returns float32 array of shape (n, d), L2-normalized for cosine search.
    """
    resp = client.embeddings.create(model=model, input=texts)
    vectors = np.array([item.embedding for item in resp.data], dtype="float32")
    faiss.normalize_L2(vectors)
    return vectors


def batch(iterable: List[str], batch_size: int) -> List[List[str]]:
    for i in range(0, len(iterable), batch_size):
        yield iterable[i : i + batch_size]


# -----------------------------
# Index persistence
# -----------------------------

def save_chunks(chunks: List[Chunk], path: Path) -> None:
    with path.open("w", encoding="utf-8") as f:
        for c in chunks:
            f.write(json.dumps(c.__dict__, ensure_ascii=False) + "\n")


def load_chunks(path: Path) -> List[Chunk]:
    chunks: List[Chunk] = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            obj = json.loads(line)
            chunks.append(Chunk(**obj))
    return chunks


def build_faiss_index(vectors: np.ndarray) -> faiss.Index:
    dim = vectors.shape[1]
    index = faiss.IndexFlatIP(dim)  # cosine similarity after normalization
    index.add(vectors)
    return index


def save_index(index: faiss.Index, path: Path) -> None:
    faiss.write_index(index, str(path))


def load_index(path: Path) -> faiss.Index:
    return faiss.read_index(str(path))


# -----------------------------
# Retrieval
# -----------------------------

def retrieve(
    client: OpenAI,
    query: str,
    index: faiss.Index,
    chunks: List[Chunk],
    model: str,
    top_k: int = 4,
) -> List[Tuple[Chunk, float]]:
    q_vec = embed_texts(client, [query], model=model)
    scores, ids = index.search(q_vec, top_k)

    results: List[Tuple[Chunk, float]] = []
    for idx, score in zip(ids[0], scores[0]):
        if idx == -1:
            continue
        results.append((chunks[idx], float(score)))
    return results


# -----------------------------
# Generation
# -----------------------------

def answer_question(
    client: OpenAI,
    query: str,
    retrieved: List[Tuple[Chunk, float]],
    model: str,
) -> str:
    context_blocks = []
    for i, (chunk, score) in enumerate(retrieved, start=1):
        context_blocks.append(
            f"[Source {i}] {chunk.source}\n"
            f"Chunk ID: {chunk.chunk_id}\n"
            f"Similarity: {score:.4f}\n"
            f"Text:\n{chunk.text}"
        )

    context = "\n\n---\n\n".join(context_blocks) if context_blocks else "No context found."

    prompt = f"""
You are a careful RAG assistant.

Use only the provided context when possible.
If the context does not contain the answer, say you do not know.
Be concise, accurate, and cite the source numbers in brackets like [Source 1].

Question:
{query}

Context:
{context}
""".strip()

    resp = client.responses.create(
        model=model,
        input=prompt,
    )

    # Most recent SDKs expose `.output_text`
    output_text = getattr(resp, "output_text", None)
    if output_text:
        return output_text.strip()

    # Fallback parsing if needed
    try:
        parts = []
        for item in resp.output:
            for content in getattr(item, "content", []):
                text = getattr(content, "text", None)
                if text:
                    parts.append(text)
        return "\n".join(parts).strip() if parts else str(resp)
    except Exception:
        return str(resp)


# -----------------------------
# Main pipeline
# -----------------------------

def build_or_load_index(
    client: OpenAI,
    data_dir: Path,
    reindex: bool,
    embed_model: str,
    index_path: Path,
    chunks_path: Path,
) -> Tuple[faiss.Index, List[Chunk]]:
    if not reindex and index_path.exists() and chunks_path.exists():
        index = load_index(index_path)
        chunks = load_chunks(chunks_path)
        return index, chunks

    docs = load_documents(data_dir)
    if not docs:
        raise SystemExit(f"No supported files found in: {data_dir}")

    chunks = build_chunks(docs)
    texts = [c.text for c in chunks]

    all_vectors = []
    for text_batch in batch(texts, batch_size=64):
        vectors = embed_texts(client, text_batch, model=embed_model)
        all_vectors.append(vectors)

    vectors = np.vstack(all_vectors)
    index = build_faiss_index(vectors)

    save_index(index, index_path)
    save_chunks(chunks, chunks_path)

    return index, chunks


def main() -> None:
    parser = argparse.ArgumentParser(description="Simple single-file RAG demo")
    parser.add_argument("--data_dir", type=str, required=True, help="Folder with .txt/.md/.pdf files")
    parser.add_argument("--query", type=str, default=None, help="Ask a question")
    parser.add_argument("--top_k", type=int, default=4, help="How many chunks to retrieve")
    parser.add_argument("--reindex", action="store_true", help="Rebuild the index from scratch")
    args = parser.parse_args()

    client = OpenAI()

    data_dir = Path(args.data_dir)
    index_path = Path(INDEX_PATH)
    chunks_path = Path(CHUNKS_PATH)

    index, chunks = build_or_load_index(
        client=client,
        data_dir=data_dir,
        reindex=args.reindex,
        embed_model=EMBED_MODEL,
        index_path=index_path,
        chunks_path=chunks_path,
    )

    print(f"Loaded {len(chunks)} chunks.")

    if args.query:
        query = args.query
    else:
        query = input("\nAsk a question: ").strip()

    retrieved = retrieve(
        client=client,
        query=query,
        index=index,
        chunks=chunks,
        model=EMBED_MODEL,
        top_k=args.top_k,
    )

    print("\nRetrieved chunks:")
    for i, (chunk, score) in enumerate(retrieved, start=1):
        print(f"\n[{i}] score={score:.4f} | {chunk.source} | {chunk.chunk_id}")
        print(chunk.text[:500].replace("\n", " ") + ("..." if len(chunk.text) > 500 else ""))

    print("\nAnswer:\n")
    answer = answer_question(
        client=client,
        query=query,
        retrieved=retrieved,
        model=CHAT_MODEL,
    )
    print(answer)


if __name__ == "__main__":
    main()