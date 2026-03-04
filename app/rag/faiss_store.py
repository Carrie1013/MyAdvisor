"""
app/rag/faiss_store.py — FAISS index + sentence-embedding singleton.

Replaces ChromaDB with an on-disk FAISS flat inner-product index paired with a
companion JSON file that stores the raw chunk metadata and text.

Architecture
────────────
  • Embeddings  : sentence-transformers  all-MiniLM-L6-v2  (384-dim, cosine)
  • Index type  : IndexFlatIP  (exact cosine via L2-normalised vectors)
  • Persistence : <FAISS_DIR>/index.faiss  +  <FAISS_DIR>/chunks.json
  • Threading   : a reentrant lock guards all writes; reads are lock-free after
                  the first load (globals are stable once set)
"""

from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Optional

import numpy as np

from app.core.config import settings

# ── paths ─────────────────────────────────────────────────────────────────────
INDEX_PATH: Path = settings.FAISS_DIR / "index.faiss"
CHUNKS_PATH: Path = settings.FAISS_DIR / "chunks.json"

# Embedding model output dimension (all-MiniLM-L6-v2)
DIM: int = 384

# ── module-level singletons ───────────────────────────────────────────────────
_model = None          # SentenceTransformer instance
_index = None          # faiss.Index instance
_chunks: list[dict] = []
_lock = threading.Lock()


# ── embedding model ───────────────────────────────────────────────────────────

def _get_model():
    """Lazy-load the embedding model (downloads ~22 MB on first call)."""
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def embed(texts: list[str]) -> np.ndarray:
    """
    Encode *texts* into L2-normalised float32 vectors of shape (N, DIM).
    Normalisation lets IndexFlatIP behave as cosine similarity.
    """
    if not texts:
        return np.zeros((0, DIM), dtype="float32")
    model = _get_model()
    vecs = model.encode(
        texts,
        normalize_embeddings=True,
        show_progress_bar=False,
        batch_size=64,
    )
    return vecs.astype("float32")


# ── persistence ───────────────────────────────────────────────────────────────

def save_index(vectors: np.ndarray, chunk_list: list[dict]) -> None:
    """
    Build a fresh FAISS IndexFlatIP, add *vectors*, persist to disk, and
    update the in-memory singletons.
    """
    import faiss  # imported here so the rest of the module works even if
                  # faiss is not installed (tests, CI, etc.)

    with _lock:
        settings.FAISS_DIR.mkdir(parents=True, exist_ok=True)

        dim = vectors.shape[1] if vectors.ndim == 2 and vectors.shape[0] > 0 else DIM
        index = faiss.IndexFlatIP(dim)

        if vectors.shape[0] > 0:
            index.add(vectors)

        faiss.write_index(index, str(INDEX_PATH))
        CHUNKS_PATH.write_text(
            json.dumps(chunk_list, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        global _index, _chunks
        _index = index
        _chunks = chunk_list

    print(f"[faiss_store] Saved {len(chunk_list)} chunks, index size={index.ntotal}")


def load_index():
    """
    Load the FAISS index and chunk metadata from disk (once).
    Returns (index, chunks) — index may be None if no data has been indexed.
    """
    global _index, _chunks

    if _index is not None:
        return _index, _chunks

    if not INDEX_PATH.exists():
        return None, []

    import faiss

    with _lock:
        # Double-checked locking
        if _index is not None:
            return _index, _chunks
        _index = faiss.read_index(str(INDEX_PATH))
        _chunks = (
            json.loads(CHUNKS_PATH.read_text(encoding="utf-8"))
            if CHUNKS_PATH.exists()
            else []
        )

    print(f"[faiss_store] Loaded index: {_index.ntotal} vectors, {len(_chunks)} chunks")
    return _index, _chunks


# ── search ────────────────────────────────────────────────────────────────────

def search(query: str, k: int = 10) -> list[dict]:
    """
    Return the top-*k* chunks most relevant to *query*, sorted by descending
    cosine similarity score (0–1).
    """
    index, chunk_list = load_index()
    if index is None or index.ntotal == 0:
        return []

    k = min(k, index.ntotal)
    q_vec = embed([query])
    scores, indices = index.search(q_vec, k)

    results: list[dict] = []
    for score, idx in zip(scores[0], indices[0]):
        if idx < 0:
            continue
        chunk = dict(chunk_list[idx])
        chunk["relevance_score"] = round(float(score), 4)
        results.append(chunk)

    return results


def stats() -> dict:
    """Return current index statistics."""
    index, chunk_list = load_index()
    return {
        "total_chunks": len(chunk_list),
        "index_vectors": index.ntotal if index else 0,
        "index_path": str(INDEX_PATH),
        "index_exists": INDEX_PATH.exists(),
        "embedding_model": "all-MiniLM-L6-v2",
        "dim": DIM,
    }
