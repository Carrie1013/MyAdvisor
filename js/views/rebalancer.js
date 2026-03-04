/* =========================================================
   views/rebalancer.js — Portfolio Drift Detection & Rebalancing
   Investment philosophy: market movements drift actual weights
   from optimal weights; trigger systematic rebalancing.
   ========================================================= */

const RebalancerView = {
  _charts: {},
  _threshold: 5.0, // %

  render(container, state) {
    const target  = DATA.TARGET_WEIGHTS;
    const current = DATA.CURRENT_WEIGHTS;
    const thresh  = state.settings.rebalThreshold ?? 5.0;
    this._threshold = thresh;

    const drifts   = this._computeDrift(current, target);
    const triggers = drifts.filter(d => Math.abs(d.drift) >= thresh);
    const totalDrift = drifts.reduce((s, d) => s + Math.abs(d.drift), 0) / drifts.length;

    container.innerHTML = `
      <div class="view-container">
        <div class="view-header flex-between">
          <div>
            <div class="view-title">Portfolio Rebalancer</div>
            <div class="view-sub">Monitor drift from optimal weights · Threshold: ${thresh}% absolute</div>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn-secondary" id="refreshPrices">&#8635; Refresh Prices</button>
            <button class="btn-primary" id="analyzeBtn">&#129504; AI Drift Analysis</button>
          </div>
        </div>

        <!-- Status Banner -->
        ${triggers.length > 0 ? `
          <div class="rebalance-alert">
            <h3>&#9888; Rebalancing Recommended — ${triggers.length} position(s) exceed ${thresh}% threshold</h3>
            <p>The following assets have drifted beyond your target allocation. Market movements in
            technology and equity have outperformed bonds, causing equity weights to increase.
            Review the analysis below to understand the cause and plan your rebalancing trades.</p>
          </div>` : `
          <div style="background:var(--success-bg);border:1px solid rgba(16,185,129,0.3);border-radius:var(--radius);padding:14px 16px;margin-bottom:16px">
            <strong style="color:var(--success)">&#10003; Portfolio within tolerance</strong>
            <span style="font-size:13px;color:var(--text-secondary);margin-left:8px">
              All positions within ${thresh}% of target weights. Next review: 30 days.
            </span>
          </div>`}

        <!-- KPI Row -->
        <div class="grid-4 mb-16">
          ${this._kpi('Avg. Drift', totalDrift.toFixed(1) + '%', 'From target weights', totalDrift >= thresh ? 'danger' : totalDrift >= thresh/2 ? 'warning' : 'success')}
          ${this._kpi('Positions Triggered', triggers.length + ' / ' + drifts.length, `>= ${thresh}% threshold`, triggers.length > 0 ? 'warning' : 'success')}
          ${this._kpi('Max Overweight', this._maxDrift(drifts, '+'), 'Most overweight asset', 'danger')}
          ${this._kpi('Max Underweight', this._maxDrift(drifts, '-'), 'Most underweight asset', 'blue')}
        </div>

        <!-- Main chart -->
        <div class="card mb-16">
          <div class="card-header">
            <div class="card-title card-title-blue">Current vs Target Weight Comparison</div>
            <div style="display:flex;gap:8px;font-size:11px;color:var(--text-muted)">
              <span style="display:flex;align-items:center;gap:4px">
                <span style="display:inline-block;width:12px;height:3px;background:var(--accent-blue)"></span> Current
              </span>
              <span style="display:flex;align-items:center;gap:4px">
                <span style="display:inline-block;width:12px;height:3px;background:var(--accent-purple-light)"></span> Target
              </span>
            </div>
          </div>
          <div style="height:260px"><canvas id="driftCompareChart"></canvas></div>
        </div>

        <!-- Drift Analysis Table + Actions -->
        <div class="grid-2 mb-16">
          <div class="card">
            <div class="card-header"><div class="card-title card-title-blue">Drift by Position</div></div>
            ${drifts.map(d => this._driftRow(d, thresh)).join('')}
          </div>

          <div class="card">
            <div class="card-header"><div class="card-title card-title-purple">Rebalancing Action Plan</div></div>
            ${this._actionPlan(drifts, state)}
          </div>
        </div>

        <!-- Why Rebalance? -->
        <div class="card mb-16">
          <div class="card-header"><div class="card-title card-title-teal">Why Rebalance Now? — Market Context</div></div>
          <div id="whyContent">
            ${this._whyRebalanceHTML(drifts, triggers)}
          </div>
        </div>

        <!-- AI Analysis Area -->
        <div class="card" id="aiAnalysisCard" style="display:none">
          <div class="card-header"><div class="card-title card-title-blue">&#129504; AI Rebalancing Analysis</div></div>
          <div id="aiAnalysisContent" class="report-preview"></div>
        </div>
      </div>
    `;

    this._renderCharts(drifts);
    this._bindEvents(drifts, triggers, state);
  },

  _kpi(label, value, sub, color) {
    const colors = { success:'#10B981', danger:'#EF4444', warning:'#F59E0B', blue:'#3B82F6' };
    return `
      <div class="stat-card">
        <div class="stat-label">${label}</div>
        <div class="stat-value" style="color:${colors[color]};font-size:18px;font-family:monospace">${value}</div>
        <div class="stat-sub">${sub}</div>
      </div>`;
  },

  _computeDrift(current, target) {
    return Object.keys(target).map(ticker => {
      const cur = (current[ticker] || 0) * 100;
      const tgt = target[ticker] * 100;
      const drift = cur - tgt;
      return { ticker, current: cur, target: tgt, drift };
    });
  },

  _maxDrift(drifts, sign) {
    const filtered = sign === '+' ? drifts.filter(d => d.drift > 0) : drifts.filter(d => d.drift < 0);
    if (!filtered.length) return '—';
    const max = filtered.reduce((a, b) => Math.abs(a.drift) > Math.abs(b.drift) ? a : b);
    return `${max.ticker} (${sign}${Math.abs(max.drift).toFixed(1)}%)`;
  },

  _driftRow(d, thresh) {
    const abs   = Math.abs(d.drift);
    const pct   = Math.min(abs / (thresh * 2), 1) * 100;
    const color = abs >= thresh ? (d.drift > 0 ? 'var(--danger)' : 'var(--accent-blue)') : abs >= thresh / 2 ? 'var(--warning)' : 'var(--success)';
    const dir   = d.drift > 0 ? '▲' : d.drift < 0 ? '▼' : '—';
    const badge = abs >= thresh ? `<span class="badge badge-warn">ALERT</span>` : '';

    return `
      <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(30,45,69,0.5)">
        <span style="font-family:monospace;font-size:12px;width:45px;color:var(--accent-blue)">${d.ticker}</span>
        <div class="drift-bar-track" style="flex:1">
          <div class="drift-bar-fill" style="width:${pct}%;background:${color}"></div>
        </div>
        <span style="font-family:monospace;font-size:12px;width:55px;text-align:right;color:${color}">${dir} ${d.drift.toFixed(1)}%</span>
        ${badge}
      </div>`;
  },

  _actionPlan(drifts, state) {
    const total = DATA.CLIENT.total_value;
    const triggered = drifts.filter(d => Math.abs(d.drift) >= this._threshold);
    if (!triggered.length) {
      return `<div style="color:var(--text-muted);font-size:13px;padding:12px 0">No rebalancing trades needed at current threshold.</div>`;
    }

    const rows = triggered.sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift)).map(d => {
      const action = d.drift > 0 ? 'SELL' : 'BUY';
      const amount = Math.abs(d.drift / 100) * total;
      const color  = action === 'SELL' ? 'var(--danger)' : 'var(--success)';
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid rgba(30,45,69,0.5);font-size:12px">
          <span style="font-family:monospace;color:var(--accent-blue)">${d.ticker}</span>
          <span style="color:${color};font-weight:600">${action}</span>
          <span style="font-family:monospace">$${(amount / 1000).toFixed(1)}K</span>
          <span style="color:var(--text-muted)">${d.drift > 0 ? '-' : '+'}${Math.abs(d.drift).toFixed(1)}% wt</span>
        </div>`;
    }).join('');

    const totalTrades = triggered.reduce((s, d) => s + Math.abs(d.drift / 100) * total / 2, 0);
    const estTaxImpact = totalTrades * 0.003; // rough 0.3% tax drag estimate

    return `
      ${rows}
      <div class="info-box mt-12" style="font-size:11px">
        <strong>Estimated trade volume:</strong> $${(totalTrades / 1000).toFixed(0)}K ·
        <strong>Est. tax impact:</strong> ~$${(estTaxImpact / 1000).toFixed(1)}K<br>
        Tip: Use new contributions first to minimize taxable events.
      </div>`;
  },

  _whyRebalanceHTML(drifts, triggers) {
    const overweight  = drifts.filter(d => d.drift > 2);
    const underweight = drifts.filter(d => d.drift < -2);

    // Simulated market context
    const marketContext = {
      'VTI':  { perf: '+18.2%', reason: 'Strong US equity bull market (AI/tech rally)' },
      'QQQ':  { perf: '+24.7%', reason: 'NASDAQ outperformance driven by mega-cap tech' },
      'BND':  { perf: '-3.1%',  reason: 'Rising rates pressured bond prices' },
      'AGG':  { perf: '-2.8%',  reason: 'Duration risk materialized as Fed held rates higher' },
      'VXUS': { perf: '+8.4%',  reason: 'International equity underperformed vs US' },
      'GLD':  { perf: '+12.3%', reason: 'Gold rallied amid geopolitical uncertainty' },
      'VNQ':  { perf: '-5.2%',  reason: 'REITs pressured by higher-for-longer interest rates' },
      'QQQ':  { perf: '+24.7%', reason: 'NASDAQ mega-cap outperformance' },
    };

    const ovHtml = overweight.map(d => {
      const ctx = marketContext[d.ticker] || { perf: '+?%', reason: 'Market outperformance' };
      return `
        <div style="padding:8px 12px;background:rgba(239,68,68,0.06);border-radius:var(--radius-sm);margin-bottom:6px">
          <div style="display:flex;justify-content:space-between;font-size:12px">
            <span><strong style="color:var(--danger)">${d.ticker}</strong> — ${ctx.reason}</span>
            <span style="font-family:monospace;color:var(--success)">${ctx.perf} YTD</span>
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">
            Weight drifted from ${d.target.toFixed(1)}% → ${d.current.toFixed(1)}% (overweight by ${d.drift.toFixed(1)}%)
          </div>
        </div>`;
    }).join('');

    const unHtml = underweight.map(d => {
      const ctx = marketContext[d.ticker] || { perf: '-?%', reason: 'Market underperformance' };
      return `
        <div style="padding:8px 12px;background:rgba(59,130,246,0.06);border-radius:var(--radius-sm);margin-bottom:6px">
          <div style="display:flex;justify-content:space-between;font-size:12px">
            <span><strong style="color:var(--accent-blue)">${d.ticker}</strong> — ${ctx.reason}</span>
            <span style="font-family:monospace;color:var(--danger)">${ctx.perf} YTD</span>
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">
            Weight drifted from ${d.target.toFixed(1)}% → ${d.current.toFixed(1)}% (underweight by ${Math.abs(d.drift).toFixed(1)}%)
          </div>
        </div>`;
    }).join('');

    return `
      <div style="font-size:13px;color:var(--text-secondary);line-height:1.8;margin-bottom:16px">
        Over the past 12 months, strong equity performance — particularly in US technology (VTI +18.2%, QQQ +24.7%) — has
        caused your equity weights to drift above target. Simultaneously, rising interest rates have pressured bond prices
        (BND -3.1%), reducing your fixed income weight below target. This is a classic "buy low, sell high" rebalancing
        opportunity: selling appreciated equities and buying underperforming bonds brings you back to your strategic allocation.
      </div>

      ${ovHtml ? `<div style="margin-bottom:12px"><div style="font-size:11px;font-weight:600;text-transform:uppercase;color:var(--danger);letter-spacing:1px;margin-bottom:6px">&#8679; Overweight — Consider Selling</div>${ovHtml}</div>` : ''}
      ${unHtml ? `<div><div style="font-size:11px;font-weight:600;text-transform:uppercase;color:var(--accent-blue);letter-spacing:1px;margin-bottom:6px">&#8681; Underweight — Consider Buying</div>${unHtml}</div>` : ''}

      <div class="info-box mt-12">
        <strong>Investment Philosophy Note:</strong> Rebalancing is not market timing. We systematically return to our
        optimal target weights, maintaining the risk/return profile that the Michaud REF optimizer has identified as
        optimal for your risk tolerance. The drift threshold (${this._threshold}%) is designed to balance transaction costs
        against the cost of being off-target.
      </div>`;
  },

  _renderCharts(drifts) {
    const tickers = drifts.map(d => d.ticker);
    const current = drifts.map(d => d.current / 100);
    const target  = drifts.map(d => d.target / 100);

    refreshChart('driftCompareChart', ctx => new Chart(ctx, {
      type: 'bar',
      data: {
        labels: tickers,
        datasets: [
          { label: 'Current Weight', data: current, backgroundColor: CHART_COLORS.blueAlpha, borderColor: CHART_COLORS.blue, borderWidth: 1.5, borderRadius: 3 },
          { label: 'Target Weight',  data: target,  backgroundColor: CHART_COLORS.purpleAlpha, borderColor: CHART_COLORS.purple, borderWidth: 1.5, borderRadius: 3 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'top', labels: { color: CHART_COLORS.text, boxWidth: 14, padding: 12 } },
          tooltip: {
            backgroundColor: '#0F1829',
            borderColor: CHART_COLORS.grid,
            borderWidth: 1,
            callbacks: { label: ctx => ` ${ctx.dataset.label}: ${(ctx.parsed.y * 100).toFixed(1)}%` },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: CHART_COLORS.text } },
          y: { grid: { color: CHART_COLORS.grid }, ticks: { callback: v => (v * 100).toFixed(0) + '%', color: CHART_COLORS.text } },
        },
      },
    }));
  },

  async _runAIAnalysis(drifts, triggers, state) {
    const apiKey = state.settings.claudeApiKey;
    if (!apiKey) { App.toast('Claude API key required for AI analysis — add it in Settings', 'error'); return; }

    const card = document.getElementById('aiAnalysisCard');
    const content = document.getElementById('aiAnalysisContent');
    card.style.display = 'block';
    content.innerHTML = '<div class="chat-typing"><div class="typing-dots"><span></span><span></span><span></span></div><span style="margin-left:8px">Generating AI analysis...</span></div>';
    card.scrollIntoView({ behavior: 'smooth' });

    const portfolio = DATA.CLIENT;
    const prompt = `
Analyze the following portfolio drift situation and generate a detailed rebalancing recommendation:

**Client:** ${portfolio.client_name} — ${portfolio.risk_profile}
**Portfolio Value:** $${(portfolio.total_value / 1e6).toFixed(2)}M
**Rebalancing Threshold:** ${this._threshold}%

**Current vs Target Weights:**
${drifts.map(d => `- ${d.ticker}: Current ${d.current.toFixed(1)}% vs Target ${d.target.toFixed(1)}% (Drift: ${d.drift > 0 ? '+' : ''}${d.drift.toFixed(1)}%)`).join('\n')}

**Triggered Positions (drift >= ${this._threshold}%):**
${triggers.map(d => `- ${d.ticker}: ${d.drift > 0 ? 'OVERWEIGHT' : 'UNDERWEIGHT'} by ${Math.abs(d.drift).toFixed(1)}%`).join('\n')}

Please provide:
1. **Executive Summary** — Why is rebalancing needed now?
2. **Market Context** — What market events caused this drift?
3. **Trade Recommendations** — Specific buy/sell actions with rationale
4. **Tax Considerations** — How to minimize tax impact
5. **Risk Assessment** — What are the risks of rebalancing vs. not rebalancing?
6. **Timeline** — When should trades be executed?

Format the response in clear Markdown with headers and bullet points.`;

    try {
      const resp = await API.callClaude(
        [{ role: 'user', content: prompt }],
        `You are a quantitative portfolio manager specializing in systematic rebalancing.
         Use the Markowitz-Michaud investment philosophy. Be specific and data-driven.`,
        apiKey
      );
      const reply = resp?.content?.[0]?.text || 'Analysis unavailable.';
      content.innerHTML = typeof marked !== 'undefined' ? marked.parse(reply) : reply;
    } catch (e) {
      content.innerHTML = `<div class="danger-box">Error: ${e.message}</div>`;
    }
  },

  _bindEvents(drifts, triggers, state) {
    document.getElementById('analyzeBtn')?.addEventListener('click', () =>
      this._runAIAnalysis(drifts, triggers, state));

    document.getElementById('refreshPrices')?.addEventListener('click', () => {
      App.toast('Refreshing portfolio prices...', 'info');
      setTimeout(() => App.toast('Prices updated (simulated — connect backend for live data)', 'success'), 1500);
    });
  },
};
