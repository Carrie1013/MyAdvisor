import asyncio
import json
from datetime import date
from pathlib import Path

from app.core.config import settings
from app.core.claude_client import get_client

SYSTEM_PROMPT = """You are a senior portfolio analyst writing a professional, client-ready report.

You receive:
1. Compliance results (JSON) from the rules-checker
2. Research insights (Markdown) from the RAG analyst
3. Client profile information

Your report MUST follow this exact structure in Markdown:

---
# Portfolio Analysis Report
**Client**: [name] | **Date**: [date] | **Portfolio ID**: [id]

---

## Executive Summary
[3-5 sentences: overall health, #rules passed, top strength, top risk, headline recommendation]

---

## Portfolio Strengths
[2-4 bullet points backed by specific PASS results and/or research insights. Include rule IDs and doc sources.]

---

## Areas of Concern
[For EACH FAIL and WARNING rule:
  - **[Rule ID] [Rule Name]**: actual value vs threshold
  - Why this matters for the client
  - Suggested corrective action
  Contextualise with research insights where relevant.]

---

## Compliance Summary
| Rule ID | Rule Name | Status | Actual Value | Threshold |
|---------|-----------|--------|-------------|-----------|
[Include ALL rules — PASS, FAIL, WARNING, DATA_MISSING]

---

## Recommendations
[Numbered, specific, actionable. Each must reference a rule ID or document source.]
1. ...
2. ...

---

## Supporting Research
[List each cited internal document with a one-line summary of its relevance]

---
*Report generated using company-approved criteria and internal research.
All findings reference verified data sources.*

Writer rules:
- NEVER add data not present in your inputs.
- Every claim must reference a rule ID (e.g., R001) or a document filename.
- Flag any contradiction between compliance results and research insights.
- Tone: professional but accessible — the client may not be a finance expert.
- Output ONLY the report Markdown, no preamble or explanation."""


class ReportWriterAgent:
    def _call_claude(
        self,
        rules_result: dict,
        rag_result: str,
        client_name: str,
        portfolio_id: str,
    ) -> str:
        client = get_client()
        user_message = (
            f"## Client Information\n"
            f"- Name: {client_name}\n"
            f"- Portfolio ID: {portfolio_id}\n"
            f"- Report Date: {date.today().isoformat()}\n\n"
            f"## Compliance Results (from rules-checker)\n"
            f"{json.dumps(rules_result, indent=2)}\n\n"
            f"## Research Insights (from rag-analyst)\n"
            f"{rag_result}\n\n"
            "Write the complete portfolio analysis report now."
        )
        response = client.messages.create(
            model=settings.MODEL,
            max_tokens=8096,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )
        return response.content[0].text

    def _save(self, content: str, portfolio_id: str) -> Path:
        settings.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        out = settings.OUTPUT_DIR / f"{portfolio_id}_report.md"
        out.write_text(content, encoding="utf-8")
        return out

    async def run(
        self,
        rules_result: dict,
        rag_result: str,
        client_name: str,
        portfolio_id: str,
    ) -> tuple[str, Path]:
        report_md = await asyncio.to_thread(
            self._call_claude, rules_result, rag_result, client_name, portfolio_id
        )
        output_path = self._save(report_md, portfolio_id)
        return report_md, output_path
