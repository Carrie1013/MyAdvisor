"""
app/rag/retriever.py — FAISS-backed retrieval with multi-query fan-out.

Strategy
────────
Instead of a single blended query string, we fire multiple targeted queries
(one per portfolio theme) and deduplicate results by chunk identity, keeping
the best relevance score for each unique chunk.  This yields far better recall
than a single long concatenated query.

Query generation
────────────────
  1. Per-sector outlook queries  (e.g. "Technology sector investment outlook")
  2. Per-top-holding queries     (e.g. "Apple Inc AAPL equity analysis")
  3. Per-asset-class queries     (e.g. "fixed income portfolio strategy")
  4. Geographic focus query      (e.g. "United States market opportunities")
  5. Risk-profile query          (e.g. "moderate growth portfolio risk management")
  6. Compliance/regulatory query
"""

from __future__ import annotations

from app.rag import faiss_store


# ── public API ────────────────────────────────────────────────────────────────

def retrieve(query: str, n_results: int = 10) -> list[dict]:
    """Single-query retrieval — thin wrapper around faiss_store.search."""
    return faiss_store.search(query, k=n_results)


def retrieve_by_portfolio(portfolio: dict, n_results: int = 15) -> list[dict]:
    """
    Multi-query retrieval tuned to the portfolio's characteristics.

    Returns up to *n_results* unique chunks ranked by best relevance score.
    """
    queries = _build_queries(portfolio)

    # Fan out: collect best-score chunk per (source, chunk_index) key
    seen: dict[str, dict] = {}

    for query in queries[:10]:          # hard cap: 10 queries max
        for chunk in faiss_store.search(query, k=6):
            key = f"{chunk['source']}::{chunk['chunk_index']}"
            if key not in seen or chunk["relevance_score"] > seen[key]["relevance_score"]:
                seen[key] = chunk

    ranked = sorted(seen.values(), key=lambda c: c["relevance_score"], reverse=True)
    return ranked[:n_results]


# ── query builder ─────────────────────────────────────────────────────────────

def _build_queries(portfolio: dict) -> list[str]:
    queries: list[str] = []

    # 1. Sector queries
    for sector, weight in sorted(
        portfolio.get("sector_breakdown", {}).items(),
        key=lambda kv: kv[1],
        reverse=True,
    )[:4]:
        queries.append(f"{sector} sector investment outlook market analysis")

    # 2. Top-5 holding queries
    holdings = sorted(
        portfolio.get("holdings", []),
        key=lambda h: h.get("weight", 0),
        reverse=True,
    )[:5]
    for h in holdings:
        name = h.get("name", "")
        ticker = h.get("ticker", "")
        asset_class = h.get("asset_class", "")
        if name or ticker:
            queries.append(
                f"{name} {ticker} {asset_class} equity analysis research".strip()
            )

    # 3. Asset-class queries (only for meaningful weights)
    for asset_class, weight in portfolio.get("asset_allocation", {}).items():
        if weight >= 0.05:
            label = asset_class.replace("_", " ")
            queries.append(f"{label} investment strategy portfolio management")

    # 4. Geographic focus query
    geo = portfolio.get("geographic_breakdown", {})
    if geo:
        top_region = max(geo, key=geo.get)
        queries.append(f"{top_region} market investment opportunities outlook")

    # 5. Risk-profile query
    profile = portfolio.get("client_profile", {})
    risk = profile.get("risk_tolerance", "moderate")
    queries.append(f"{risk} risk portfolio management rebalancing strategy")

    # 6. Compliance / regulatory catch-all
    queries.append("investment compliance regulatory concentration limits fiduciary")

    # Fallback if portfolio data is sparse
    if not queries:
        queries.append("portfolio analysis investment management risk return")

    return queries
