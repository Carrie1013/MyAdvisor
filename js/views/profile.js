/* =========================================================
   views/profile.js — User Profile, Portfolio & Compliance
   ========================================================= */

const ProfileView = {
  _charts: {},

  render(container, state) {
    const client = DATA.CLIENT;
    const rules  = DATA.RULES;
    const compliance = API.checkCompliance(client, rules);

    const passCount = compliance.filter(r => r.passed).length;
    const failCount = compliance.filter(r => !r.passed && r.severity === 'FAIL').length;
    const warnCount = compliance.filter(r => !r.passed && r.severity === 'WARNING').length;

    container.innerHTML = `
      <div class="view-container">
        <div class="view-header flex-between">
          <div>
            <div class="view-title">User Profile &amp; Portfolio</div>
            <div class="view-sub">Portfolio ID: ${client.portfolio_id} &nbsp;·&nbsp; As of ${client.valuation_date}</div>
          </div>
          <button class="btn-primary" id="runAnalysisBtn">&#9654; Run Full Analysis</button>
        </div>

        <!-- KPI Row -->
        <div class="grid-4 mb-16">
          ${this._kpiCard('Total Value', '$' + (client.total_value / 1e6).toFixed(2) + 'M', 'As of ' + client.valuation_date, 'blue')}
          ${this._kpiCard('Compliance', passCount + '/' + rules.length + ' Pass', failCount + ' FAIL · ' + warnCount + ' WARN', failCount > 0 ? 'danger' : warnCount > 0 ? 'warning' : 'success')}
          ${this._kpiCard('Equity Weight', (client.asset_allocation.equity * 100).toFixed(1) + '%', 'Target: 60–75%', 'purple')}
          ${this._kpiCard('Risk Score', client.risk_score + '/10', client.risk_profile, 'teal')}
        </div>

        <!-- Charts row -->
        <div class="grid-2 mb-16">
          <div class="card">
            <div class="card-header"><div class="card-title card-title-blue">Asset Allocation</div></div>
            <div style="height:220px"><canvas id="allocChart"></canvas></div>
          </div>
          <div class="card">
            <div class="card-header"><div class="card-title card-title-blue">Sector Breakdown</div></div>
            <div style="height:220px"><canvas id="sectorChart"></canvas></div>
          </div>
        </div>

        <!-- Performance Chart -->
        <div class="card mb-16">
          <div class="card-header">
            <div class="card-title card-title-blue">Portfolio Performance vs Benchmark (Last 12 Months)</div>
            <div style="display:flex;gap:8px;">
              <span class="highlight-chip chip-blue">Portfolio</span>
              <span class="highlight-chip chip-purple">S&amp;P 500 Benchmark</span>
            </div>
          </div>
          <div style="height:220px"><canvas id="perfChart"></canvas></div>
        </div>

        <!-- Tabs -->
        <div class="tabs">
          <button class="tab-btn active" data-tab="holdings">Holdings</button>
          <button class="tab-btn" data-tab="compliance">Compliance</button>
          <button class="tab-btn" data-tab="tax">Tax Efficiency</button>
        </div>
        <div id="tabContent"></div>
      </div>
    `;

    this._renderCharts(client);
    this._renderTab('holdings', client, compliance, state);
    this._bindEvents(client, compliance, state);
  },

  _kpiCard(label, value, sub, color) {
    const colorMap = { blue: '#3B82F6', purple: '#7C3AED', teal: '#14B8A6', success: '#10B981', danger: '#EF4444', warning: '#F59E0B' };
    const c = colorMap[color] || colorMap.blue;
    return `
      <div class="stat-card">
        <div class="stat-label">${label}</div>
        <div class="stat-value" style="color:${c};font-size:20px">${value}</div>
        <div class="stat-sub">${sub}</div>
      </div>`;
  },

  _renderCharts(client) {
    const alloc = client.asset_allocation;
    this._charts.alloc = refreshChart('allocChart', ctx =>
      createDonutChart(ctx,
        ['Equity', 'Fixed Income', 'Cash', 'Alternatives'],
        [alloc.equity, alloc.fixed_income, alloc.cash, alloc.alternatives],
        [CHART_COLORS.blue, CHART_COLORS.teal, CHART_COLORS.green, CHART_COLORS.yellow]
      )
    );

    const sectors = client.sector_breakdown || {};
    this._charts.sector = refreshChart('sectorChart', ctx =>
      createBarChart(ctx,
        Object.keys(sectors),
        Object.values(sectors),
        Object.values(sectors).map((_, i) => PALETTE[i % PALETTE.length])
      )
    );

    const mr = client.monthly_returns;
    // Cumulative returns (build array of compound growth - 1)
    const buildCumulative = returns => {
      let compound = 1;
      return returns.map(r => { compound *= (1 + r); return compound - 1; });
    };
    const cumPort  = buildCumulative(mr.portfolio);
    const cumBench = buildCumulative(mr.benchmark);

    this._charts.perf = refreshChart('perfChart', ctx =>
      createLineChart(ctx, mr.dates, [
        { label: 'Portfolio', data: cumPort, color: CHART_COLORS.blue },
        { label: 'Benchmark', data: cumBench, color: CHART_COLORS.purple, dash: [5, 3] },
      ])
    );
  },

  _renderTab(tab, client, compliance, state) {
    const content = document.getElementById('tabContent');
    if (!content) return;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));

    if (tab === 'holdings')   content.innerHTML = this._holdingsHTML(client);
    if (tab === 'compliance') content.innerHTML = this._complianceHTML(client, compliance, state);
    if (tab === 'tax')        content.innerHTML = this._taxHTML(client);
  },

  _holdingsHTML(client) {
    const sortedHoldings = [...client.holdings].sort((a, b) => b.weight - a.weight);
    const rows = sortedHoldings.map((h, i) => {
      const gain = h.ticker !== 'CASH' && h.ticker !== 'BOND_10Y'
        ? ((h.value / (h.weight * client.total_value) - 1) * 100).toFixed(1) + '%' : '—';
      const gainColor = parseFloat(gain) >= 0 ? 'var(--success)' : 'var(--danger)';

      return `
        <tr>
          <td class="td-primary">
            <span class="holding-dot" style="background:${PALETTE[i % PALETTE.length]}"></span>
            ${h.ticker}
          </td>
          <td class="td-primary">${h.name}</td>
          <td><span class="badge badge-${h.asset_class === 'equity' ? 'info' : h.asset_class === 'fixed_income' ? 'pass' : 'warn'}">${h.asset_class.replace('_',' ')}</span></td>
          <td>${h.sector}</td>
          <td>${h.geography}</td>
          <td class="td-mono">${(h.weight * 100).toFixed(1)}%</td>
          <td class="td-mono">$${(h.value / 1000).toFixed(0)}K</td>
          <td class="td-mono" style="color:${gainColor}">${gain}</td>
        </tr>`;
    }).join('');

    return `
      <div class="card mt-8">
        <table class="data-table">
          <thead>
            <tr>
              <th>Ticker</th><th>Name</th><th>Class</th><th>Sector</th>
              <th>Geography</th><th>Weight</th><th>Value</th><th>P&amp;L Est.</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },

  _complianceHTML(client, compliance, state) {
    const rows = compliance.map(r => {
      const status = r.passed ? 'pass' : r.severity === 'FAIL' ? 'fail' : 'warn';
      const isPercent = r.threshold <= 1 && r.actual <= 1;
      const actualFmt  = isPercent ? (r.actual * 100).toFixed(1) + '%' : r.actual.toString();
      const threshFmt  = isPercent ? (r.threshold * 100).toFixed(0) + '%' : r.threshold.toString();
      const barPct     = isPercent ? Math.min(r.actual / (r.threshold * 1.5), 1) * 100 : 0;
      const barClass   = r.passed ? 'progress-pass' : status === 'fail' ? 'progress-fail' : 'progress-warn';

      return `
        <tr>
          <td class="td-mono" style="font-size:11px;color:var(--text-muted)">${r.rule_id}</td>
          <td class="td-primary">${r.rule_name}</td>
          <td>
            <div style="display:flex;align-items:center;gap:8px;min-width:120px">
              <div class="progress-bar-wrap" style="flex:1;position:relative">
                <div class="progress-bar ${barClass}" style="width:${barPct}%"></div>
              </div>
              <span class="td-mono" style="width:42px;text-align:right">${actualFmt}</span>
            </div>
          </td>
          <td class="td-mono">${r.operator} ${threshFmt}</td>
          <td><span class="badge badge-${status}">${r.passed ? 'PASS' : r.severity}</span></td>
        </tr>`;
    }).join('');

    const passCount = compliance.filter(r => r.passed).length;
    const failCount = compliance.filter(r => !r.passed && r.severity === 'FAIL').length;
    const warnCount = compliance.filter(r => !r.passed && r.severity === 'WARNING').length;

    const failedRules = compliance.filter(r => !r.passed && r.severity === 'FAIL');
    const alertBox = failedRules.length > 0 ? `
      <div class="warn-box mb-16">
        <strong>&#9888; ${failCount} Compliance Failure(s):</strong>
        ${failedRules.map(r => `<div style="margin-top:4px">· ${r.rule_id}: ${r.rule_name} — actual ${(r.actual * 100).toFixed(1)}% vs limit ${(r.threshold * 100).toFixed(0)}%</div>`).join('')}
      </div>` : '';

    const summary = `
      <div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap">
        <span class="highlight-chip chip-green">&#10003; ${passCount} Passed</span>
        ${failCount ? `<span class="highlight-chip" style="background:var(--danger-bg);color:var(--danger)">&#10007; ${failCount} Failed</span>` : ''}
        ${warnCount ? `<span class="highlight-chip chip-yellow">&#9888; ${warnCount} Warnings</span>` : ''}
      </div>`;

    return `
      <div class="card mt-8">
        ${summary}
        ${alertBox}
        <table class="data-table">
          <thead><tr><th>Rule ID</th><th>Rule Name</th><th>Current Value</th><th>Limit</th><th>Status</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="info-box mt-12">
          &#8505; Rules sourced from <code>investment_rules.json</code>. Run Full Analysis via the button above to generate a detailed AI-powered report using the backend agent pipeline.
        </div>
      </div>`;
  },

  _taxHTML(client) {
    const holdings = client.holdings;
    const etfUniverse = DATA.ETF_UNIVERSE;
    const etfMap = Object.fromEntries(etfUniverse.map(e => [e.ticker, e]));

    // Tax efficiency score per holding
    const taxRows = holdings.map(h => {
      const etf = etfMap[h.ticker];
      const score    = etf ? etf.taxScore : (h.asset_class === 'cash' ? 98 : 70);
      const turnover = etf ? (etf.turnover * 100).toFixed(0) + '%' : '—';
      const divYield = etf ? (etf.dividendYield * 100).toFixed(1) + '%' : '—';
      const scoreColor = score >= 85 ? 'var(--success)' : score >= 65 ? 'var(--warning)' : 'var(--danger)';
      const acctRec = score >= 85 ? 'Taxable ✓' : score >= 65 ? 'Either' : 'Tax-Adv.';
      const acctColor = score >= 85 ? 'var(--success)' : score >= 65 ? 'var(--warning)' : 'var(--accent-blue)';

      // Tax drag estimate: dividend_yield * (qualified ? 0.15 : 0.28) + turnover * 0.10 * 0.15
      const dTax = etf ? etf.dividendYield * (etf.qualified ? 0.15 : client.tax_bracket) : 0;
      const cTax = etf ? etf.turnover * 0.10 * 0.15 : 0;
      const drag  = ((dTax + cTax) * 100).toFixed(2) + '%/yr';

      // TLH opportunities: holding below cost basis (simulated)
      const tlhPair = DATA.TLH_PAIRS[h.ticker];

      return `
        <tr>
          <td class="td-primary">${h.ticker}</td>
          <td style="font-size:12px;color:var(--text-secondary)">${h.name.slice(0,28)}${h.name.length>28?'…':''}</td>
          <td>
            <div style="display:flex;align-items:center;gap:6px">
              <div class="tax-eff-track" style="width:60px">
                <div class="tax-eff-fill" style="width:${score}%;background:${scoreColor}"></div>
              </div>
              <span class="td-mono" style="color:${scoreColor};font-size:12px">${score}</span>
            </div>
          </td>
          <td class="td-mono">${turnover}</td>
          <td class="td-mono">${divYield}</td>
          <td class="td-mono">${drag}</td>
          <td style="font-size:12px;color:${acctColor}">${acctRec}</td>
          <td style="font-size:11px;color:var(--text-muted)">${tlhPair ? tlhPair[0] + ', ' + tlhPair[1] : '—'}</td>
        </tr>`;
    }).join('');

    // Portfolio-level tax drag
    let totalDrag = 0;
    holdings.forEach(h => {
      const etf = etfMap[h.ticker];
      if (etf) {
        const d = etf.dividendYield * (etf.qualified ? 0.15 : client.tax_bracket);
        const c = etf.turnover * 0.10 * 0.15;
        totalDrag += (d + c) * h.weight;
      }
    });

    return `
      <div class="card mt-8">
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px">
          <div class="stat-card" style="min-width:160px">
            <div class="stat-label">Est. Annual Tax Drag</div>
            <div class="stat-value" style="color:var(--warning);font-size:18px">${(totalDrag * 100).toFixed(2)}%/yr</div>
            <div class="stat-sub">Blended across all holdings</div>
          </div>
          <div class="stat-card" style="min-width:160px">
            <div class="stat-label">Tax Efficiency Score</div>
            <div class="stat-value" style="color:var(--success);font-size:18px">74 / 100</div>
            <div class="stat-sub">Room to improve via asset location</div>
          </div>
          <div class="stat-card" style="flex:1;min-width:220px">
            <div class="stat-label">Key Recommendations</div>
            <div style="font-size:12px;color:var(--text-secondary);line-height:1.7;margin-top:4px">
              • Move <strong>BND / HYG</strong> to IRA/401(k) — interest taxed as ordinary income<br>
              • Keep <strong>VTI / AAPL / MSFT</strong> in taxable — qualified dividends &amp; low turnover<br>
              • Consider tax-loss harvest on positions with unrealized losses
            </div>
          </div>
        </div>

        <table class="data-table">
          <thead>
            <tr>
              <th>Ticker</th><th>Name</th><th>Tax Score (0-100)</th>
              <th>Turnover</th><th>Div Yield</th><th>Tax Drag</th>
              <th>Best Account</th><th>TLH Substitute</th>
            </tr>
          </thead>
          <tbody>${taxRows}</tbody>
        </table>

        <div class="info-box mt-12">
          <strong>Tax Efficiency Score:</strong> 85+ = excellent (taxable-friendly, low turnover, qualified dividends) ·
          65-84 = neutral · &lt;65 = prefer tax-advantaged account.<br>
          <strong>TLH Pairs</strong> are ETFs with similar market exposure but different enough to avoid the 30-day wash-sale rule.
        </div>
      </div>`;
  },

  async _runFullAnalysis(state) {
    const btn = document.getElementById('runAnalysisBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-sm"></span> Analyzing...';

    try {
      const backendUrl = state.settings.backendUrl;
      const apiKey     = state.settings.claudeApiKey;

      if (backendUrl) {
        // ── Backend path: 3-agent server pipeline ─────────────────────────────
        const result = await API.callBackend('/api/analyze/inline', {
          client_name: DATA.CLIENT.client_name,
          portfolio: DATA.CLIENT,
        }, backendUrl);
        state.lastReport = result.report_markdown;
        App.toast('Full analysis complete — opening report…', 'success');
        App.navigate('report');

      } else if (apiKey) {
        // ── Client-side path: Claude API directly ──────────────────────────────
        await this._runClientSideAnalysis(state, apiKey);

      } else {
        App.toast('Add a Claude API key (or backend URL) in ⚙ Settings to run the full analysis.', 'info');
      }
    } catch (e) {
      App.toast('Analysis failed: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '&#9654; Run Full Analysis';
    }
  },

  async _runClientSideAnalysis(state, apiKey) {
    const client     = DATA.CLIENT;
    const rules      = DATA.RULES;
    const compliance = API.checkCompliance(client, rules);

    const passCount = compliance.filter(r => r.passed).length;
    const failItems = compliance.filter(r => !r.passed);

    // Build a compact compliance JSON for the prompt
    const complianceJSON = JSON.stringify({
      summary: {
        total_rules: rules.length,
        passed: passCount,
        failed: failItems.filter(r => r.severity === 'FAIL').length,
        warnings: failItems.filter(r => r.severity === 'WARNING').length,
      },
      results: compliance.map(r => ({
        rule_id:    r.rule_id,
        rule_name:  r.rule_name,
        status:     r.passed ? 'PASS' : r.severity,
        actual:     r.actual,
        threshold:  r.threshold,
        operator:   r.operator,
      })),
    }, null, 2);

    const topHoldings = [...client.holdings]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5)
      .map(h => `- **${h.ticker}** (${h.name}): ${(h.weight * 100).toFixed(1)}%`)
      .join('\n');

    const alloc = client.asset_allocation;
    const allocStr = Object.entries(alloc)
      .map(([k, v]) => `${k}: ${(v * 100).toFixed(1)}%`)
      .join(' · ');

    const prompt =
`You are a senior wealth management analyst. Write a professional, client-ready portfolio analysis report in Markdown.

## Client Information
- **Name**: ${client.client_name}
- **Portfolio ID**: ${client.portfolio_id}
- **Total Value**: $${(client.total_value / 1e6).toFixed(2)}M
- **Risk Profile**: ${client.risk_profile} (score ${client.risk_score}/10)
- **Tax Bracket**: ${(client.tax_bracket * 100).toFixed(0)}%
- **Valuation Date**: ${client.valuation_date}

## Asset Allocation
${allocStr}

## Top 5 Holdings
${topHoldings}

## Compliance Evaluation (client-side rule engine)
\`\`\`json
${complianceJSON}
\`\`\`

## Instructions
Write the full report in this exact structure:

---
# Portfolio Analysis Report
**Client**: ${client.client_name} | **Portfolio ID**: ${client.portfolio_id} | **Date**: ${new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}

---

## Executive Summary
[3-5 sentences: overall health, compliance score, top strength, top risk, key recommendation]

---

## Portfolio Strengths
[2-4 bullet points backed by PASS results — cite Rule IDs]

---

## Areas of Concern
[For every FAIL and WARNING: rule ID, actual vs threshold, why it matters, specific remediation step]

---

## Compliance Summary
| Rule ID | Rule Name | Status | Actual | Limit |
|---------|-----------|--------|--------|-------|
[ALL rules — PASS, FAIL, WARNING]

---

## Recommendations
[3-5 numbered, specific, actionable items tied to rule IDs]

---

*Report generated by WealthIQ Intelligence Platform.*

Rules: no fabrication — use only the data above. Professional but accessible tone.`;

    const resp = await API.callClaude(
      [{ role: 'user', content: prompt }],
      'You are a senior wealth management analyst writing client-ready portfolio analysis reports. Output only the Markdown report, no preamble.',
      apiKey
    );

    const reportMd = resp?.content?.[0]?.text;
    if (!reportMd) throw new Error('Empty response from Claude');

    state.lastReport = reportMd;
    App.toast('Analysis complete — opening report…', 'success');
    App.navigate('report');
  },

  _bindEvents(client, compliance, state) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._renderTab(btn.dataset.tab, client, compliance, state);
      });
    });

    document.getElementById('runAnalysisBtn')?.addEventListener('click', () => {
      this._runFullAnalysis(state);
    });
  },
};
