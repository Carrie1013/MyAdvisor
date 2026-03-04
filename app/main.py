"""
app/main.py — Portfolio Analysis Agent  ·  FastAPI application

Endpoints
─────────
  POST /api/analyze              Run full 3-agent pipeline (file path)
  POST /api/analyze/inline       Run pipeline with inline portfolio JSON
  GET  /api/portfolios           List available portfolio files
  GET  /api/portfolios/{name}    Fetch a single portfolio JSON
  GET  /api/reports              List generated reports
  GET  /api/reports/{client_id}  Fetch a saved Markdown report
  DELETE /api/reports/{client_id} Delete a saved report
  POST /api/index-docs           Re-index /docs/ directory via FAISS
  GET  /api/rag/stats            FAISS index statistics
  POST /api/chat                 RAG-powered chat (inject portfolio context)
  GET  /api/rules                Return all compliance rules
  GET  /health                   Health check
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse

from app.agents.rag_analyst import RagAnalystAgent
from app.agents.report_writer import ReportWriterAgent
from app.agents.rules_checker import RulesCheckerAgent
from app.core.config import settings
from app.core.claude_client import get_client
from app.rag.indexer import index_documents
from app.rag import faiss_store, retriever
from app.schemas.portfolio import (
    AnalyzeRequest,
    PortfolioUploadRequest,
    ChatRequest,
)
from app.schemas.responses import (
    AnalysisResponse,
    ChatResponse,
    DeleteResponse,
    IndexDocsResponse,
    PortfolioListItem,
    PortfolioListResponse,
    RAGStatsResponse,
    ReportListItem,
    ReportListResponse,
)

# ── app setup ─────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Portfolio Analysis Agent",
    description="3-agent system: rules-checker + rag-analyst (parallel) → report-writer",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── helpers ───────────────────────────────────────────────────────────────────

def _load_portfolio(path: Path) -> dict[str, Any]:
    """Read and parse a portfolio JSON file."""
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Portfolio file not found: {path}")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail=f"Invalid JSON in portfolio file: {exc}")


def _resolve_portfolio_path(portfolio_file: str) -> Path:
    path = Path(portfolio_file)
    if not path.is_absolute():
        path = settings.PORTFOLIOS_DIR / portfolio_file
    # Allow paths relative to project root as a fallback
    if not path.exists():
        alt = settings.CRITERIA_PATH.parent.parent / portfolio_file
        if alt.exists():
            path = alt
    return path


async def _run_pipeline(
    portfolio: dict[str, Any],
    client_name: str,
) -> AnalysisResponse:
    """Core 3-agent pipeline shared by both analyze endpoints."""
    portfolio["client_name"] = client_name
    portfolio_id = portfolio.get("portfolio_id", "UNKNOWN")

    # ── Stage 1 : parallel agents ──────────────────────────────────────────────
    rules_agent = RulesCheckerAgent()
    rag_agent = RagAnalystAgent()

    rules_result, rag_result = await asyncio.gather(
        rules_agent.run(portfolio),
        rag_agent.run(portfolio),
    )

    # ── Stage 2 : synthesise report ────────────────────────────────────────────
    writer = ReportWriterAgent()
    report_md, output_path = await writer.run(
        rules_result, rag_result, client_name, portfolio_id
    )

    return AnalysisResponse(
        client_name=client_name,
        portfolio_id=portfolio_id,
        report_path=str(output_path),
        report_markdown=report_md,
        rules_summary=rules_result.get("summary", {}),
    )


# ── analysis endpoints ────────────────────────────────────────────────────────

@app.post("/api/analyze", response_model=AnalysisResponse, tags=["Analysis"])
async def analyze_portfolio(request: AnalyzeRequest):
    """
    Run the full 3-agent pipeline for a client portfolio loaded from a file.

    The pipeline runs rules-checker and rag-analyst in parallel, then passes
    both results to the report-writer to produce a client-ready Markdown report.
    """
    path = _resolve_portfolio_path(request.portfolio_file)
    portfolio = _load_portfolio(path)
    return await _run_pipeline(portfolio, request.client_name)


@app.post("/api/analyze/inline", response_model=AnalysisResponse, tags=["Analysis"])
async def analyze_portfolio_inline(request: PortfolioUploadRequest):
    """
    Run the 3-agent pipeline with portfolio data supplied inline in the request
    body — no file needed.  Useful for the frontend to submit live portfolio data.
    """
    return await _run_pipeline(request.portfolio, request.client_name)


# ── portfolio file management ─────────────────────────────────────────────────

@app.get("/api/portfolios", response_model=PortfolioListResponse, tags=["Portfolios"])
async def list_portfolios():
    """Return metadata for every portfolio JSON in the portfolios/ directory."""
    settings.PORTFOLIOS_DIR.mkdir(parents=True, exist_ok=True)
    items: list[PortfolioListItem] = []

    for f in sorted(settings.PORTFOLIOS_DIR.glob("*.json")):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            items.append(
                PortfolioListItem(
                    filename=f.name,
                    portfolio_id=data.get("portfolio_id", f.stem),
                    client_name=data.get("client_name", ""),
                    total_value_usd=data.get("total_value_usd", 0.0),
                    valuation_date=data.get("valuation_date", ""),
                )
            )
        except Exception:
            pass  # skip malformed files silently

    return PortfolioListResponse(portfolios=items, total=len(items))


@app.get("/api/portfolios/{filename}", tags=["Portfolios"])
async def get_portfolio(filename: str):
    """Fetch a single portfolio JSON by filename."""
    path = settings.PORTFOLIOS_DIR / filename
    if not path.exists() or path.suffix != ".json":
        raise HTTPException(status_code=404, detail=f"Portfolio not found: {filename}")
    return json.loads(path.read_text(encoding="utf-8"))


# ── report management ─────────────────────────────────────────────────────────

@app.get("/api/reports", response_model=ReportListResponse, tags=["Reports"])
async def list_reports():
    """List all saved Markdown reports in the output/ directory."""
    settings.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    items: list[ReportListItem] = []

    for f in sorted(settings.OUTPUT_DIR.glob("*_report.md")):
        stat = f.stat()
        portfolio_id = f.stem.replace("_report", "")
        items.append(
            ReportListItem(
                portfolio_id=portfolio_id,
                filename=f.name,
                size_bytes=stat.st_size,
                created_at=datetime.fromtimestamp(
                    stat.st_mtime, tz=timezone.utc
                ).isoformat(),
            )
        )

    return ReportListResponse(reports=items, total=len(items))


@app.get("/api/reports/{client_id}", response_class=PlainTextResponse, tags=["Reports"])
async def get_report(client_id: str):
    """Return the saved Markdown report for a given portfolio ID."""
    report_path = settings.OUTPUT_DIR / f"{client_id}_report.md"
    if not report_path.exists():
        raise HTTPException(status_code=404, detail=f"Report not found: {client_id}")
    return report_path.read_text(encoding="utf-8")


@app.delete("/api/reports/{client_id}", response_model=DeleteResponse, tags=["Reports"])
async def delete_report(client_id: str):
    """Delete a saved report."""
    report_path = settings.OUTPUT_DIR / f"{client_id}_report.md"
    if not report_path.exists():
        raise HTTPException(status_code=404, detail=f"Report not found: {client_id}")
    report_path.unlink()
    return DeleteResponse(deleted=True, detail=f"Deleted report for {client_id}")


# ── RAG / document indexing ───────────────────────────────────────────────────

@app.post("/api/index-docs", response_model=IndexDocsResponse, tags=["RAG"])
async def index_docs():
    """
    Scan /docs/ and (re-)index all documents into the FAISS store.

    The embedding step can be slow for large document collections; this endpoint
    runs synchronously and returns once complete.  For very large corpora,
    consider triggering via a background job.
    """
    result = await asyncio.to_thread(index_documents)
    return IndexDocsResponse(**result)


@app.get("/api/rag/stats", response_model=RAGStatsResponse, tags=["RAG"])
async def rag_stats():
    """Return FAISS index statistics (chunk count, dimension, paths)."""
    return RAGStatsResponse(**faiss_store.stats())


@app.get("/api/rag/search", tags=["RAG"])
async def rag_search(q: str, k: int = 8):
    """
    Ad-hoc semantic search against the FAISS index.
    Useful for debugging retrieval quality before running a full analysis.
    """
    if not q.strip():
        raise HTTPException(status_code=422, detail="Query parameter 'q' must not be empty")
    chunks = faiss_store.search(q.strip(), k=min(k, 30))
    return {"query": q, "results": chunks, "total": len(chunks)}


# ── chat endpoint ─────────────────────────────────────────────────────────────

_CHAT_SYSTEM = (
    "You are a senior wealth management advisor with deep expertise in "
    "portfolio construction (Markowitz-Michaud), compliance, and tax efficiency. "
    "Answer concisely and cite sources when provided in the context."
)


@app.post("/api/chat", response_model=ChatResponse, tags=["Chat"])
async def chat(request: ChatRequest):
    """
    RAG-powered conversational endpoint.

    Retrieves relevant document chunks based on the user's message (and optional
    portfolio context), injects them into the system prompt, then calls Claude.
    """
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="ANTHROPIC_API_KEY not configured — set it in .env",
        )

    # ── build RAG context ──────────────────────────────────────────────────────
    rag_chunks: list[dict] = []
    portfolio_ctx = ""

    if request.n_rag_chunks > 0:
        # If a portfolio_id was supplied, load the portfolio for thematic retrieval
        portfolio: dict | None = None
        if request.portfolio_id:
            port_path = settings.PORTFOLIOS_DIR / f"{request.portfolio_id}.json"
            if port_path.exists():
                portfolio = json.loads(port_path.read_text(encoding="utf-8"))
                portfolio_ctx = (
                    f"\n\n**Current Portfolio**: {portfolio.get('client_name', '')} "
                    f"(ID: {request.portfolio_id}, "
                    f"Value: ${portfolio.get('total_value_usd', 0):,.0f})"
                )

        # Semantic search — prefer portfolio-aware multi-query when available
        if portfolio:
            rag_chunks = await asyncio.to_thread(
                retriever.retrieve_by_portfolio, portfolio, request.n_rag_chunks
            )
        else:
            rag_chunks = await asyncio.to_thread(
                retriever.retrieve, request.message, request.n_rag_chunks
            )

    # ── build system prompt ────────────────────────────────────────────────────
    system_parts = [_CHAT_SYSTEM + portfolio_ctx]

    if rag_chunks:
        docs_text = "\n\n---\n\n".join(
            f"**[{c['source']} · chunk {c['chunk_index']}]** "
            f"(relevance: {c['relevance_score']})\n{c['content']}"
            for c in rag_chunks
        )
        system_parts.append(
            f"\n\n## Relevant Internal Research\n\n{docs_text}\n\n"
            "Use the above documents to ground your answer. "
            "Cite sources as [filename] when quoting."
        )

    full_system = "\n".join(system_parts)

    # ── call Claude ────────────────────────────────────────────────────────────
    messages = [
        *[{"role": m["role"], "content": m["content"]} for m in request.history],
        {"role": "user", "content": request.message},
    ]

    def _call() -> str:
        client = get_client()
        resp = client.messages.create(
            model=settings.MODEL,
            max_tokens=2048,
            system=full_system,
            messages=messages,
        )
        return resp.content[0].text

    reply = await asyncio.to_thread(_call)
    sources = list({c["source"] for c in rag_chunks})

    return ChatResponse(reply=reply, rag_sources=sources, model=settings.MODEL)


# ── rules & health ────────────────────────────────────────────────────────────

@app.get("/api/rules", tags=["Rules"])
async def get_rules():
    """Return all company-defined investment rules."""
    return json.loads(settings.CRITERIA_PATH.read_text(encoding="utf-8"))


@app.get("/health", tags=["System"])
async def health():
    """Health check — confirms the API is up and reports basic configuration."""
    rag = faiss_store.stats()
    return {
        "status": "ok",
        "model": settings.MODEL,
        "api_key_configured": bool(settings.ANTHROPIC_API_KEY),
        "rag": {
            "index_exists": rag["index_exists"],
            "total_chunks": rag["total_chunks"],
            "embedding_model": rag["embedding_model"],
        },
    }
