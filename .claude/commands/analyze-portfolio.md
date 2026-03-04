---
name: analyze-portfolio
description: Run full portfolio analysis pipeline for a client
---

# Full Portfolio Analysis Command

## Usage
/analyze-portfolio [portfolio_file] [client_name]

## What This Does
Runs the complete 3-agent portfolio analysis pipeline:
1. Spawns rules-checker and rag-analyst IN PARALLEL
2. Waits for both to complete
3. Passes combined results to report-writer
4. Confirms report saved to /output/

## Steps

1. Read the portfolio file at $ARGUMENTS[0]
2. Extract client name from $ARGUMENTS[1] or from the portfolio file itself

3. Launch IN PARALLEL using the Task tool:
   - Task 1: rules-checker agent — pass full portfolio data and path to /criteria/investment_rules.json
   - Task 2: rag-analyst agent — pass portfolio holdings, sector/geography breakdown, and /docs/ path

4. Once BOTH tasks complete, call report-writer with:
   - rules_checker_output (full JSON from Task 1)
   - rag_analyst_output (full markdown from Task 2)
   - client_name

5. Confirm report location to user (e.g., /output/[client_id]_report.md)
6. Print a 3-line summary of key findings:
   - Overall compliance status (X/Y rules passed)
   - Top strength identified
   - Most critical issue to address

## Error Handling
- If rules-checker fails: halt and report which rules could not be evaluated
- If rag-analyst finds 0 documents: proceed but flag "No internal research available"
- If report-writer fails to save: retry once, then output full report to terminal
