/* =========================================================
   views/report.js — Annual Investment Report Generator
   Produces a professional Markdown report with performance,
   compliance, tax summary, and AI-generated narrative.
   ========================================================= */

const ReportView = {
  // ── Persistent cache: survives navigation AND page refreshes ─────────────
  _CACHE_KEY: 'wiq_report_md',
  get _reportMd()  { return localStorage.getItem(this._CACHE_KEY) || null; },
  set _reportMd(v) { v ? localStorage.setItem(this._CACHE_KEY, v) : localStorage.removeItem(this._CACHE_KEY); },

  render(container, state) {
    const client    = DATA.CLIENT;
    const hasCached = !!this._reportMd;

    container.innerHTML = `
      <div class="view-container">
        <div class="view-header flex-between">
          <div>
            <div class="view-title">Annual Investment Report</div>
            <div class="view-sub">2025 Full-Year Portfolio Review — ${client.client_name}</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <button class="btn-secondary" id="generateStatic">&#9998; Generate Static Report</button>
            <button class="btn-primary" id="generateAI">&#129504; Generate AI Report</button>
            <button class="btn-ghost" id="downloadMd" style="${hasCached ? 'display:inline-flex' : 'display:none'}">&#8681; Download .md</button>
            ${hasCached ? '<button class="btn-ghost" id="clearReport" title="Clear cached report">&#128465; Clear</button>' : ''}
          </div>
        </div>

        <!-- Report Preview -->
        <div class="card mb-16" id="reportCard" style="min-height:400px">
          <div class="empty-state">
            <div class="empty-state-icon">&#128196;</div>
            <h3>Generate Your Annual Report</h3>
            <p>Click <strong>Generate Static Report</strong> for an instant Markdown report, or
            <strong>Generate AI Report</strong> for a Claude-powered narrative analysis.</p>
          </div>
        </div>

        <!-- Performance Charts (rendered when report is generated) -->
        <div class="grid-2 mb-16" id="reportCharts" style="display:none">
          <div class="card">
            <div class="card-title card-title-blue mb-12">12-Month Cumulative Return</div>
            <div style="height:200px"><canvas id="reportPerfChart"></canvas></div>
          </div>
          <div class="card">
            <div class="card-title card-title-blue mb-12">Asset Allocation Evolution</div>
            <div style="height:200px"><canvas id="reportAllocChart"></canvas></div>
          </div>
        </div>
      </div>
    `;

    this._bindEvents(state);

    // Re-render the cached report so navigating away and back doesn't lose it
    if (this._reportMd) {
      this._renderReport(this._reportMd);
    } else if (state.lastReport) {
      // Handed off from "Run Full Analysis" in Profile view — consume once
      this._renderReport(state.lastReport);
      state.lastReport = null;
    }
  },

  _generateStaticReport(client) {
    const rules = DATA.RULES;
    const compliance = API.checkCompliance(client, rules);
    const passCount = compliance.filter(r => r.passed).length;
    const failItems = compliance.filter(r => !r.passed);

    const mr = client.monthly_returns;
    const buildCumulative = returns => { let c = 1; return returns.map(r => { c *= (1+r); return c-1; }); };
    const cumPort  = buildCumulative(mr.portfolio);
    const cumBench = buildCumulative(mr.benchmark);
    const totalPortRet  = cumPort[cumPort.length-1] * 100;
    const totalBenchRet = cumBench[cumBench.length-1] * 100;
    const alpha = totalPortRet - totalBenchRet;

    const annualVol = Math.sqrt(mr.portfolio.reduce((s, r) => {
      const m = mr.portfolio.reduce((a, b) => a + b, 0) / mr.portfolio.length;
      return s + Math.pow(r - m, 2);
    }, 0) / (mr.portfolio.length - 1)) * Math.sqrt(12) * 100;

    const rfRate = 5.25 / 100;
    const sharpe = (totalPortRet / 100 - rfRate) / (annualVol / 100);

    // Sort holdings by weight
    const topHoldings = [...client.holdings].sort((a, b) => b.weight - a.weight).slice(0, 5);

    const now = new Date();
    const reportDate = `${now.toLocaleString('en-US', { month: 'long' })} ${now.getDate()}, ${now.getFullYear()}`;

    const complianceTable = compliance.map(r => {
      const isPercent = r.threshold <= 1 && r.actual <= 1;
      const actual    = isPercent ? (r.actual * 100).toFixed(1) + '%' : r.actual.toString();
      const thresh    = isPercent ? (r.threshold * 100).toFixed(0) + '%' : r.threshold.toString();
      const status    = r.passed ? '✅ PASS' : r.severity === 'FAIL' ? '❌ FAIL' : '⚠️ WARN';
      return `| ${r.rule_id} | ${r.rule_name} | ${actual} | ${r.operator} ${thresh} | ${status} |`;
    }).join('\n');

    return `# Annual Investment Report — 2025

**Client:** ${client.client_name} &nbsp;&nbsp; **Portfolio ID:** ${client.portfolio_id}
**Report Date:** ${reportDate} &nbsp;&nbsp; **Reporting Period:** March 2025 – February 2026

---

## Executive Summary

Your portfolio delivered a **${totalPortRet.toFixed(2)}% total return** over the past 12 months,
${alpha >= 0 ? 'outperforming' : 'underperforming'} the S&P 500 benchmark by **${Math.abs(alpha).toFixed(2)}%** (alpha: ${alpha >= 0 ? '+' : ''}${alpha.toFixed(2)}%).
Portfolio volatility of **${annualVol.toFixed(1)}%** reflects your Moderate Growth risk profile.
Your Sharpe ratio of **${sharpe.toFixed(2)}** indicates solid risk-adjusted performance.

${failItems.length > 0
  ? `⚠️ **${failItems.length} compliance issue(s) require attention** — see Compliance section for details.`
  : '✅ All compliance rules passed with no violations during the reporting period.'}

---

## Performance Overview

| Metric | Portfolio | Benchmark (S&P 500) | Difference |
|--------|-----------|---------------------|------------|
| 12-Month Return | **${totalPortRet.toFixed(2)}%** | ${totalBenchRet.toFixed(2)}% | ${alpha >= 0 ? '+' : ''}${alpha.toFixed(2)}% |
| Annualized Volatility | ${annualVol.toFixed(1)}% | 18.2% | ${(annualVol - 18.2).toFixed(1)}% |
| Sharpe Ratio | **${sharpe.toFixed(2)}** | 0.51 | ${(sharpe - 0.51).toFixed(2)} |
| Max Drawdown | -8.3% | -12.1% | +3.8% |

### Quarterly Performance

| Quarter | Portfolio | Benchmark | Excess Return |
|---------|-----------|-----------|---------------|
| Q1 2025 | +5.8% | +5.1% | +0.7% |
| Q2 2025 | +4.2% | +3.8% | +0.4% |
| Q3 2025 | +1.9% | +1.6% | +0.3% |
| Q4 2025 | +6.1% | +5.4% | +0.7% |

---

## Asset Allocation

| Asset Class | Current | Target | Deviation |
|-------------|---------|--------|-----------|
| Equity | ${(client.asset_allocation.equity * 100).toFixed(1)}% | 70.0% | ${((client.asset_allocation.equity - 0.70) * 100).toFixed(1)}% |
| Fixed Income | ${(client.asset_allocation.fixed_income * 100).toFixed(1)}% | 15.0% | ${((client.asset_allocation.fixed_income - 0.15) * 100).toFixed(1)}% |
| Cash | ${(client.asset_allocation.cash * 100).toFixed(1)}% | 5.0% | ${((client.asset_allocation.cash - 0.05) * 100).toFixed(1)}% |
| Alternatives | ${(client.asset_allocation.alternatives * 100).toFixed(1)}% | 10.0% | ${((client.asset_allocation.alternatives - 0.10) * 100).toFixed(1)}% |

---

## Top 5 Holdings

| Ticker | Name | Weight | Asset Class |
|--------|------|--------|-------------|
${topHoldings.map(h => `| **${h.ticker}** | ${h.name} | ${(h.weight * 100).toFixed(1)}% | ${h.asset_class.replace('_', ' ')} |`).join('\n')}

---

## Compliance Status

${passCount}/${rules.length} rules passed. ${failItems.length > 0 ? `**${failItems.filter(r=>r.severity==='FAIL').length} FAIL, ${failItems.filter(r=>r.severity==='WARNING').length} WARNING.**` : 'All rules compliant.'}

| Rule ID | Rule Name | Actual | Limit | Status |
|---------|-----------|--------|-------|--------|
${complianceTable}

${failItems.length > 0 ? `
### Required Actions

${failItems.map(r => {
  const isPercent = r.threshold <= 1 && r.actual <= 1;
  const actual = isPercent ? (r.actual * 100).toFixed(1) + '%' : r.actual;
  const thresh = isPercent ? (r.threshold * 100).toFixed(0) + '%' : r.threshold;
  return `- **${r.rule_id} (${r.severity}):** ${r.rule_name} — Current: ${actual}, Limit: ${r.operator} ${thresh}. Immediate rebalancing recommended.`;
}).join('\n')}
` : ''}

---

## Tax Efficiency Summary

| Metric | Value |
|--------|-------|
| Estimated Annual Tax Drag | 0.42% |
| Tax-Efficient Holdings | VTI, MSFT, AAPL, GOOGL |
| Tax-Deferred Candidates | HYG, BND, GLD |
| TLH Opportunities Identified | 2 positions |
| Unrealized Long-Term Gains | ~$48,000 |

**Asset Location Recommendation:** Move high-yield bond ETF (HYG) and US Treasury position to IRA/401(k)
to shield ordinary income from current ${(client.tax_bracket * 100).toFixed(0)}% marginal rate.

---

## Recommendations for 2026

1. **Rebalancing:** Technology sector at 35% — above the 30% sector limit. Trim AAPL/GOOGL,
   add to fixed income or international equity.

2. **Tax Strategy:** Execute tax-loss harvest on underperforming positions before March year-end.
   Consider swapping AAPL → VOO if position exceeds 10% threshold.

3. **Asset Location:** Move HYG to traditional IRA. Estimated tax savings: ~$2,200/year.

4. **International Diversification:** Increase international exposure from 14% to 20% target.
   Add VXUS or VEA to improve geographic diversification (currently at 86% US — above 70% limit).

5. **Cash Management:** 5% cash position is appropriate. Consider short-term bond ETF (BSV) for
   excess cash beyond emergency buffer to improve yield.

---

## Risk Metrics

| Risk Measure | Portfolio | Benchmark |
|--------------|-----------|-----------|
| Annual Volatility | ${annualVol.toFixed(1)}% | 18.2% |
| Beta (vs S&P 500) | 0.82 | 1.00 |
| Max Drawdown | -8.3% | -12.1% |
| Value at Risk (95%, monthly) | -4.8% | -6.2% |
| Tracking Error | 4.2% | — |

---

## Investment Philosophy Adherence

Your portfolio continues to follow the Markowitz-Michaud investment framework:

- ✅ **Asset Universe:** Diversified across US equity, international equity, fixed income, and alternatives
- ✅ **Risk Estimation:** Annual covariance review completed using 24-month rolling window
- ⚠️ **Portfolio Construction:** Technology sector concentration slightly above optimal (35% vs 30% target)
- ✅ **Monitor & Rebalance:** Quarterly drift monitoring in place; 2 rebalancing events executed in 2025

---

*This report was generated by Intelligence Platform. Past performance does not guarantee future results.
This document is for informational purposes only and does not constitute investment advice. All recommendations
should be reviewed with a qualified financial advisor.*

*Report generated: ${reportDate}*`;
  },

  _renderReport(md) {
    this._reportMd = md;
    const card = document.getElementById('reportCard');
    if (!card) return;
    card.className = 'report-preview mb-16';
    card.innerHTML = typeof marked !== 'undefined' ? marked.parse(md) : md.replace(/\n/g, '<br>');

    document.getElementById('downloadMd').style.display = 'inline-flex';
    document.getElementById('reportCharts').style.display = 'grid';
    this._renderReportCharts();
  },

  _renderReportCharts() {
    const mr = DATA.CLIENT.monthly_returns;
    const bCum = rs => { let c = 1; return rs.map(r => { c *= (1+r); return c-1; }); };
    const cumPort  = bCum(mr.portfolio);
    const cumBench = bCum(mr.benchmark);

    setTimeout(() => {
      refreshChart('reportPerfChart', ctx =>
        createLineChart(ctx, mr.dates, [
          { label: 'Portfolio', data: cumPort, color: CHART_COLORS.blue },
          { label: 'Benchmark', data: cumBench, color: CHART_COLORS.purple, dash: [5, 3] },
        ])
      );

      // Stacked area for allocation evolution
      const hist = DATA.CLIENT.historical_weights;
      refreshChart('reportAllocChart', ctx => new Chart(ctx, {
        type: 'line',
        data: {
          labels: hist.dates,
          datasets: [
            { label: 'Equity', data: hist.equity, borderColor: CHART_COLORS.blue, backgroundColor: CHART_COLORS.blueAlpha, fill: true, tension: 0.3 },
            { label: 'Fixed Income', data: hist.fixed_income, borderColor: CHART_COLORS.teal, backgroundColor: CHART_COLORS.tealAlpha, fill: true, tension: 0.3 },
            { label: 'Cash', data: hist.cash, borderColor: CHART_COLORS.green, backgroundColor: CHART_COLORS.greenAlpha, fill: true, tension: 0.3 },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: true, position: 'top', labels: { color: CHART_COLORS.text, boxWidth: 12, padding: 10, font: { size: 10 } } },
            tooltip: { backgroundColor: '#0F1829', borderColor: CHART_COLORS.grid, borderWidth: 1,
              callbacks: { label: ctx => ` ${ctx.dataset.label}: ${(ctx.parsed.y * 100).toFixed(1)}%` } },
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: CHART_COLORS.text, maxRotation: 30, font: { size: 9 } } },
            y: { stacked: false, grid: { color: CHART_COLORS.grid }, ticks: { callback: v => (v*100).toFixed(0)+'%', color: CHART_COLORS.text } },
          },
        },
      }));
    }, 0);
  },

  async _generateAIReport(state) {
    const apiKey = state.settings.claudeApiKey;
    if (!apiKey) { App.toast('Claude API key required for AI report — add it in Settings', 'error'); return; }

    const card = document.getElementById('reportCard');
    card.className = 'report-preview mb-16';
    card.innerHTML = '<div class="chat-typing" style="padding:40px"><div class="typing-dots"><span></span><span></span><span></span></div><span style="margin-left:8px">Claude is generating your annual report...</span></div>';

    const client = DATA.CLIENT;
    const rules  = DATA.RULES;
    const compliance = API.checkCompliance(client, rules);
    const staticReport = this._generateStaticReport(client);

    const prompt = `Based on the following portfolio data and static report skeleton, generate a comprehensive, professional annual investment report in Markdown format.

**Static Report Data:**
${staticReport}

**Instructions:**
1. Expand the Executive Summary into a compelling 3-5 sentence narrative explaining performance drivers
2. Add market context for 2025 — what happened in markets that drove these results?
3. Provide deeper analysis of each compliance issue and specific remediation steps
4. Enhance the recommendations with specific trade instructions and timing
5. Add a "Looking Ahead to 2026" section with market outlook and strategy adjustments
6. Maintain a professional, client-facing tone throughout
7. Keep all numbers from the static report unchanged
8. Format beautifully in Markdown with tables, bullet points, and clear headings

Generate the complete enhanced annual report now.`;

    try {
      const resp = await API.callClaude(
        [{ role: 'user', content: prompt }],
        'You are a senior wealth management analyst at a prestigious investment firm. Write professional, comprehensive annual investment reports for high-net-worth clients.',
        apiKey
      );
      const reply = resp?.content?.[0]?.text || staticReport;
      this._renderReport(reply);
      App.toast('AI annual report generated successfully', 'success');
    } catch (e) {
      card.innerHTML = '<div class="warn-box">AI generation failed: ' + e.message + '. Falling back to static report.</div>';
      setTimeout(() => this._renderReport(staticReport), 1000);
    }
  },

  _downloadMarkdown() {
    if (!this._reportMd) return;
    const blob = new Blob([this._reportMd], { type: 'text/markdown;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `Annual_Report_2025_${DATA.CLIENT.portfolio_id}.md`;
    a.click();
    URL.revokeObjectURL(url);
    App.toast('Report downloaded as Markdown', 'success');
  },

  _bindEvents(state) {
    document.getElementById('generateStatic')?.addEventListener('click', () => {
      const md = this._generateStaticReport(DATA.CLIENT);
      this._renderReport(md);
      App.toast('Static report generated', 'success');
    });

    document.getElementById('generateAI')?.addEventListener('click', () => {
      this._generateAIReport(state);
    });

    document.getElementById('downloadMd')?.addEventListener('click', () => {
      this._downloadMarkdown();
    });

    document.getElementById('clearReport')?.addEventListener('click', () => {
      this._reportMd = null;           // wipes localStorage entry
      App.navigate('report');          // re-render to empty state
      App.toast('Report cleared', 'info');
    });
  },
};
