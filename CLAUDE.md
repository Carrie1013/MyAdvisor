# Portfolio Analysis Agent — Project Configuration

## Overview
This project is an agentic system that analyzes client investment portfolios
against company-defined criteria and internal research documents,
then produces professional analysis reports.

## Architecture
Three specialized sub-agents handle this workflow:
1. **rules-checker** — Evaluates portfolio against criteria in /criteria/
2. **rag-analyst** — Searches /docs/ for relevant internal research & context
3. **report-writer** — Synthesizes outputs into a final client-ready report

## Key Directories
- `/criteria/investment_rules.json` — Company predefined rules (source of truth)
- `/docs/` — Internal research documents, memos, market outlooks
- `/output/` — Final reports saved here as Markdown/HTML

## Workflow Rules
- ALWAYS run rules-checker and rag-analyst in PARALLEL before calling report-writer
- rules-checker result must include pass/fail status for EVERY rule, no exceptions
- rag-analyst must cite specific document names and sections
- report-writer must NOT fabricate data — only use what the other two agents provide
- Final report language: match client's preferred language (default: English)

## Output Format
Reports follow this structure:
1. Executive Summary (3-5 sentences)
2. Strengths Analysis
3. Weaknesses & Risk Flags
4. Rule Compliance Summary (table format)
5. Recommendations
6. Appendix: Source Documents Referenced

## Quality Standards
- No hallucination: every claim must trace back to portfolio data or a document
- Compliance flags must reference the exact rule ID from investment_rules.json
- Recommendations must be actionable and specific
