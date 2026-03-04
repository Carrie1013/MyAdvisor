import asyncio
import json

from app.core.config import settings
from app.core.claude_client import get_client

SYSTEM_PROMPT = """You are a strict compliance analyst. Given a client investment portfolio and a set of \
company-defined rules, evaluate EVERY rule and return a structured JSON result.

Your output MUST be valid JSON with this exact structure (no markdown fences, no extra text):
{
  "evaluation_date": "YYYY-MM-DD",
  "portfolio_id": "...",
  "summary": {
    "total_rules": 0,
    "passed": 0,
    "failed": 0,
    "warnings": 0,
    "data_missing": 0
  },
  "results": [
    {
      "rule_id": "R001",
      "rule_name": "...",
      "status": "PASS|FAIL|WARNING|DATA_MISSING",
      "threshold": "human-readable threshold",
      "actual_value": "calculated value with context",
      "detail": "one sentence explanation of the finding"
    }
  ]
}

Evaluation rules:
- Evaluate ALL rules — never skip any.
- Use exact numeric calculations from the portfolio data (weights, counts, etc.).
- STATUS meanings:
    PASS         = portfolio satisfies the rule threshold
    FAIL         = violates a rule with severity FAIL
    WARNING      = violates a rule with severity WARNING
    DATA_MISSING = required field absent from portfolio data
- Do NOT make recommendations. Only report findings.
- Output ONLY valid JSON. No preamble, no explanation."""


class RulesCheckerAgent:
    def _call_claude(self, portfolio: dict, rules: dict) -> str:
        client = get_client()
        user_message = (
            f"## Investment Rules\n{json.dumps(rules, indent=2)}\n\n"
            f"## Portfolio Data\n{json.dumps(portfolio, indent=2)}\n\n"
            f"Evaluate all {len(rules['rules'])} rules against this portfolio. "
            "Return ONLY valid JSON."
        )
        response = client.messages.create(
            model=settings.MODEL,
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )
        return response.content[0].text

    async def run(self, portfolio: dict) -> dict:
        rules = json.loads(settings.CRITERIA_PATH.read_text())
        raw = await asyncio.to_thread(self._call_claude, portfolio, rules)

        # Strip markdown code fences if Claude wrapped the JSON
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            cleaned = "\n".join(lines[1:])
        if cleaned.endswith("```"):
            lines = cleaned.split("\n")
            cleaned = "\n".join(lines[:-1])

        return json.loads(cleaned.strip())
