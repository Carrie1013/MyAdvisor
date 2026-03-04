"""
app/rag/indexer.py — Document ingestion pipeline backed by FAISS.

Supported formats : .txt  .md  .pdf (PyMuPDF)  .docx (python-docx)
Chunking strategy : sliding word-window (200 words, 30-word overlap)
Embedding         : sentence-transformers all-MiniLM-L6-v2 (via faiss_store)
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

import numpy as np

from app.core.config import settings
from app.rag import faiss_store

SUPPORTED_EXTENSIONS = {".txt", ".md", ".pdf", ".docx"}

# ── text extraction ────────────────────────────────────────────────────────────

def _read_file(path: Path) -> Optional[str]:
    suffix = path.suffix.lower()
    try:
        if suffix in (".txt", ".md"):
            return path.read_text(encoding="utf-8")

        elif suffix == ".pdf":
            import fitz  # PyMuPDF
            doc = fitz.open(str(path))
            pages = [page.get_text("text") for page in doc]
            return "\n\n".join(pages)

        elif suffix == ".docx":
            from docx import Document
            doc = Document(str(path))
            return "\n".join(p.text for p in doc.paragraphs if p.text.strip())

    except Exception as exc:
        print(f"[indexer] Failed to read {path.name}: {exc}")

    return None


# ── chunking ───────────────────────────────────────────────────────────────────

def _chunk_text(
    text: str,
    chunk_words: int = 200,
    overlap_words: int = 30,
) -> list[str]:
    """
    Split *text* into overlapping word-window chunks.
    Returns an empty list when the text is blank.
    """
    words = text.split()
    if not words:
        return []

    chunks: list[str] = []
    step = max(1, chunk_words - overlap_words)
    i = 0
    while i < len(words):
        chunk = " ".join(words[i : i + chunk_words])
        chunks.append(chunk)
        i += step

    return chunks


# ── main entry point ───────────────────────────────────────────────────────────

def index_documents() -> dict:
    """
    Walk ``settings.DOCS_DIR``, extract + chunk all supported files, embed
    every chunk with sentence-transformers, build a FAISS index, and persist
    it to disk.

    Returns a summary dict compatible with ``IndexDocsResponse``.
    """
    doc_files = [
        f
        for f in settings.DOCS_DIR.rglob("*")
        if f.is_file()
        and f.suffix.lower() in SUPPORTED_EXTENSIONS
        and not f.name.startswith(".")
    ]

    all_chunks: list[dict] = []
    indexed = 0
    failed = 0

    for file_path in doc_files:
        content = _read_file(file_path)
        if not content or not content.strip():
            print(f"[indexer] Skipping (empty/unreadable): {file_path.name}")
            failed += 1
            continue

        text_chunks = _chunk_text(content)
        if not text_chunks:
            failed += 1
            continue

        rel_name = str(file_path.relative_to(settings.DOCS_DIR))
        for i, chunk_text in enumerate(text_chunks):
            all_chunks.append(
                {
                    "source": rel_name,
                    "chunk_index": i,
                    "total_chunks": len(text_chunks),
                    "content": chunk_text,
                }
            )

        indexed += 1
        print(f"[indexer] {rel_name}  →  {len(text_chunks)} chunks")

    total_chunks = len(all_chunks)

    if total_chunks == 0:
        print("[indexer] No documents to embed — saving empty index.")
        faiss_store.save_index(np.zeros((0, faiss_store.DIM), dtype="float32"), [])
        return {
            "total_files": len(doc_files),
            "indexed": indexed,
            "failed": failed,
            "total_chunks": 0,
        }

    # ── embed all chunks in one batched call ───────────────────────────────────
    print(f"[indexer] Embedding {total_chunks} chunks …")
    texts = [c["content"] for c in all_chunks]
    vectors = faiss_store.embed(texts)  # shape (N, 384), float32, L2-normalised

    # ── build & persist FAISS index ────────────────────────────────────────────
    faiss_store.save_index(vectors, all_chunks)

    return {
        "total_files": len(doc_files),
        "indexed": indexed,
        "failed": failed,
        "total_chunks": total_chunks,
    }
