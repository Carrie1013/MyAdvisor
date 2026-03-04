import asyncio
import json

from app.core.config import settings
from app.core.claude_client import get_client
from app.rag.retriever import retrieve_by_portfolio

SYSTEM_PROMPT = """You are a research analyst with access to the firm's internal document library.
Given retrieved document excerpts and a client portfolio, synthesize relevant insights.

Your output MUST be structured Markdown following this exact template:

## RAG Analysis Results

### Documents Searched
- Total chunks retrieved: N
- Relevant sources: [list unique source filenames]

### Key Insights by Theme

#### [Theme Name, e.g., Technology Sector]
- **Source**: [filename :: chunk N]
- **Insight**: [2-3 sentences summarising the relevant finding]
- **Relevance**: Supports / Challenges / Neutral — [one-line reason]

(Repeat an "#### Theme" block for each major portfolio theme that has coverage)

### Research Gaps
- [Portfolio themes with NO document coverage — or "None identified" if fully covered]

### Critical Flags
- [Documents that directly warn against or contradict current holdings/allocation]
- [Or "None" if nothing critical found]

Analyst rules:
- Cite exact source filenames — never fabricate citations.
- If no relevant docs exist for a theme, say so explicitly.
- Do NOT make compliance judgments — that is the rules-checker's job.
- Output ONLY the Markdown report, no preamble."""


class RagAnalystAgent:
    def _call_claude(self, portfolio: dict, chunks: list[dict]) -> str:
        client = get_client()

        if chunks:
            chunks_text = "\n\n---\n\n".join(
                f"**Source**: {c['source']} (chunk {c['chunk_index']}, "
                f"relevance: {c['relevance_score']})\n{c['content']}"
                for c in chunks
            )
        else:
            chunks_text = "No internal documents have been indexed yet."

        portfolio_summary = {
            "portfolio_id": portfolio.get("portfolio_id"),
            "sector_breakdown": portfolio.get("sector_breakdown"),
            "asset_allocation": portfolio.get("asset_allocation"),
            "geographic_breakdown": portfolio.get("geographic_breakdown"),
            "top_holdings": sorted(
                portfolio.get("holdings", []),
                key=lambda x: x.get("weight", 0),
                reverse=True,
            )[:5],
        }

        user_message = (
            f"## Portfolio Overview\n{json.dumps(portfolio_summary, indent=2)}\n\n"
            f"## Retrieved Internal Documents ({len(chunks)} chunks)\n{chunks_text}\n\n"
            "Analyse these documents in context of the portfolio. "
            "Return structured Markdown."
        )
        response = client.messages.create(
            model=settings.MODEL,
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )
        return response.content[0].text

    async def run(self, portfolio: dict) -> str:
        chunks = retrieve_by_portfolio(portfolio, n_results=15)
        return await asyncio.to_thread(self._call_claude, portfolio, chunks)
