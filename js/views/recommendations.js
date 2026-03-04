/* =========================================================
   views/recommendations.js — Portfolio Recommendation Engine
   Supports: US Core, International Core, Combined Core,
   multiple equity/bond ratios, alternative assets, tax efficiency
   ========================================================= */

const RecommendationsView = {
  _selected: null,
  _charts: {},
  _assetType: 'etf', // 'etf' | 'stock' | 'alternative' | 'bond'

  render(container, state) {
    const templates = DATA.PORTFOLIO_TEMPLATES;
    const rfRate    = (state.settings.riskFreeRate ?? 5.25) / 100;
    const client    = DATA.CLIENT;

    // Recommend based on risk profile
    const recommended = this._getRecommended(client);

    container.innerHTML = `
      <div class="view-container">
        <div class="view-header">
          <div class="view-title">Portfolio Recommendations</div>
          <div class="view-sub">Personalized ETF portfolios based on your risk profile · ${client.risk_profile}</div>
        </div>

        <!-- Risk Profile Card -->
        <div class="card mb-16">
          <div class="flex-between mb-12">
            <div class="card-title card-title-blue">Your Investment Profile</div>
            <span class="highlight-chip chip-blue">Risk Score: ${client.risk_score}/10</span>
          </div>
          <div class="grid-4">
            ${this._profileChip('Risk Tolerance', client.risk_profile)}
            ${this._profileChip('Time Horizon', client.time_horizon)}
            ${this._profileChip('Tax Bracket', (client.tax_bracket * 100).toFixed(0) + '%')}
            ${this._profileChip('Recommended', recommended)}
          </div>
        </div>

        <!-- Asset Type Filter -->
        <div class="card mb-16">
          <div class="card-title card-title-blue mb-12">Asset Universe Preference</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            ${[['etf','Core ETF Portfolios'],['stock','Individual Stocks + ETF'],['alternative','Alt Assets + ETF'],['bond','Fixed Income Focus']].map(([id, label]) => `
              <button class="btn-${this._assetType === id ? 'primary' : 'secondary'}" data-atype="${id}" id="atype-${id}" style="font-size:12px">
                ${label}
              </button>`).join('')}
          </div>
          <div class="info-box mt-12" id="assetTypeInfo">
            ${this._assetTypeInfo(this._assetType)}
          </div>
        </div>

        <!-- Portfolio Group Tabs -->
        <div class="tabs mb-8">
          <button class="tab-btn active" data-rtab="us">U.S. Core</button>
          <button class="tab-btn" data-rtab="intl">International Core</button>
          <button class="tab-btn" data-rtab="combined">Combined Core</button>
          <button class="tab-btn" data-rtab="compare">Comparison</button>
          <button class="tab-btn" data-rtab="tax">Tax Analysis</button>
        </div>

        <div id="recTabContent">
          ${this._renderUSCore(templates, state)}
        </div>
      </div>
    `;

    this._bindEvents(templates, state);
  },

  _profileChip(label, value) {
    return `
      <div class="stat-card" style="padding:12px">
        <div class="stat-label">${label}</div>
        <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-top:4px">${value}</div>
      </div>`;
  },

  _getRecommended(client) {
    const score = client.risk_score;
    if (score <= 3) return 'U.S. Core 20/80';
    if (score <= 4) return 'U.S. Core 40/60';
    if (score <= 6) return 'U.S. Core 60/40';
    if (score <= 7) return 'U.S. Core 75/25';
    if (score <= 8) return 'U.S. Core 90/10';
    return 'U.S. Core 100/0';
  },

  _assetTypeInfo(type) {
    const info = {
      etf: '&#10003; <strong>Core ETF Portfolios (Default):</strong> Broad-market, tax-efficient Vanguard/iShares ETFs provide instant diversification at minimal cost. Ideal for most investors.',
      stock: '&#9755; <strong>Individual Stocks + ETF Core:</strong> Satellite positions in individual stocks (5-15% each) around a core ETF portfolio. Higher potential alpha, higher concentration risk. Requires monitoring.',
      alternative: '&#9755; <strong>Alternative Assets + ETF Core:</strong> Add GLD (gold), VNQ (REITs), or other alternatives to core ETF holdings. Reduces correlation with traditional equity/bond portfolio.',
      bond: '&#9755; <strong>Fixed Income Focus:</strong> For income-oriented or capital-preservation investors. Mix of government, corporate, and international bonds. Low volatility, income-generating.',
    };
    return info[type] || info.etf;
  },

  _renderUSCore(templates, state) {
    const usCoreTemplates = Object.values(templates).filter(t => t.group === 'US Core');
    const recommended = this._getRecommended(DATA.CLIENT);

    return `
      <div class="grid-3" style="gap:14px">
        ${usCoreTemplates.map(t => this._portfolioCard(t, recommended, state)).join('')}
      </div>
      ${this._additionalAssetsPanel()}`;
  },

  _portfolioCard(t, recommended, state) {
    const isRec = t.name.includes(recommended.split(' ').slice(-2).join(' '));
    const etfMap = Object.fromEntries(DATA.ETF_UNIVERSE.map(e => [e.ticker, e]));

    // Estimate stats using preset parameters
    const mu  = t.holdings.reduce((s, h) => s + h.weight * (etfMap[h.ticker]?.mu || 0.07), 0);
    const vol = Math.sqrt(t.holdings.reduce((v, h) => v + Math.pow(h.weight * (etfMap[h.ticker]?.sigma || 0.1), 2), 0) * 0.7); // simplified
    const rf  = (state.settings.riskFreeRate ?? 5.25) / 100;
    const sharpe = vol > 0 ? (mu - rf) / vol : 0;

    // Tax efficiency: weighted average
    const taxScore = t.holdings.reduce((s, h) => s + h.weight * (etfMap[h.ticker]?.taxScore || 75), 0);

    const riskColors = { 1:'#10B981', 2:'#3B82F6', 3:'#7C3AED', 4:'#F59E0B', 5:'#EF4444', 6:'#DC2626' };
    const riskColor  = riskColors[t.riskLevel] || '#3B82F6';

    return `
      <div class="portfolio-type-card ${isRec ? 'selected' : ''}" onclick="RecommendationsView._selectTemplate('${t.id}', App.state)">
        <div class="ptc-header">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div class="ptc-name">${t.name}</div>
            ${isRec ? '<span class="badge badge-pass" style="font-size:10px">&#9733; Recommended</span>' : ''}
          </div>
          <div class="ptc-desc">${t.description}</div>
        </div>
        <div class="ptc-body">
          <!-- Equity/Bond ratio bar -->
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">
            Equity ${t.equityPct}% · Bond ${t.bondPct}%
          </div>
          <div class="ratio-bar mb-12">
            <div class="ratio-equity" style="width:${t.equityPct}%"></div>
            <div class="ratio-bond" style="width:${t.bondPct}%"></div>
          </div>

          <!-- Stats -->
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:12px">
            <div style="text-align:center">
              <div style="font-size:10px;color:var(--text-muted)">Est. Return</div>
              <div style="font-size:13px;font-weight:700;font-family:monospace;color:var(--success)">${(mu*100).toFixed(1)}%</div>
            </div>
            <div style="text-align:center">
              <div style="font-size:10px;color:var(--text-muted)">Est. Vol</div>
              <div style="font-size:13px;font-weight:700;font-family:monospace;color:var(--warning)">${(vol*100).toFixed(1)}%</div>
            </div>
            <div style="text-align:center">
              <div style="font-size:10px;color:var(--text-muted)">Sharpe</div>
              <div style="font-size:13px;font-weight:700;font-family:monospace;color:${riskColor}">${sharpe.toFixed(2)}</div>
            </div>
          </div>

          <!-- Holdings -->
          ${t.holdings.map(h => `
            <div class="holding-row">
              <span style="font-family:monospace;font-size:11px;color:var(--accent-blue)">${h.ticker}</span>
              <span style="font-size:11px;color:var(--text-muted);flex:1;margin:0 8px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${h.name.replace(' ETF','')}</span>
              <span style="font-family:monospace;font-size:11px;font-weight:600">${(h.weight*100).toFixed(0)}%</span>
            </div>`).join('')}

          <!-- Tax Efficiency -->
          <div style="margin-top:10px;display:flex;align-items:center;justify-content:space-between">
            <span style="font-size:11px;color:var(--text-muted)">Tax Efficiency</span>
            <div class="tax-eff-bar" style="width:120px">
              <div class="tax-eff-track">
                <div class="tax-eff-fill" style="width:${taxScore}%;background:${taxScore>=85?'var(--success)':taxScore>=70?'var(--warning)':'var(--danger)'}"></div>
              </div>
              <span style="font-size:11px;font-family:monospace">${taxScore.toFixed(0)}/100</span>
            </div>
          </div>
        </div>
      </div>`;
  },

  _additionalAssetsPanel() {
    return `
      <div class="card mt-16">
        <div class="card-title card-title-purple mb-8">Custom Asset Additions</div>
        <div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">
          Add satellite positions around your core ETF portfolio. Maximum satellite exposure: 20-30% of portfolio.
        </div>
        <div class="grid-3">
          ${this._assetAddCard('Individual Stocks', 'AAPL, MSFT, GOOGL, etc.', ['5-15% each position', 'Concentrated risk', 'Active monitoring required', 'Tax-loss harvesting opportunities'], '#EF4444')}
          ${this._assetAddCard('Alternative Assets', 'GLD, VNQ, BCI', ['5-10% allocation', 'Inflation hedge', 'Low equity correlation', 'May reduce portfolio Sharpe slightly'], '#F59E0B')}
          ${this._assetAddCard('Individual Bonds', 'US Treasury, Muni bonds', ['Laddered maturity structure', 'Tax-exempt munis for high earners', 'Lower liquidity than ETFs', 'Good for capital preservation'], '#3B82F6')}
        </div>
        <div class="warn-box mt-12">
          &#9888; Individual securities require more monitoring and can reduce diversification benefits.
          The core ETF approach captures market beta efficiently at minimal cost. Satellite positions should not exceed 25% of total portfolio.
        </div>
      </div>`;
  },

  _assetAddCard(title, examples, points, color) {
    return `
      <div style="background:var(--bg-elevated);border-radius:var(--radius);padding:14px;border-top:3px solid ${color}">
        <div style="font-weight:600;font-size:13px;color:var(--text-primary);margin-bottom:4px">${title}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">${examples}</div>
        ${points.map(p => `<div style="font-size:11px;color:var(--text-secondary);margin-bottom:3px">· ${p}</div>`).join('')}
      </div>`;
  },

  _renderComparison(templates, state) {
    const rfRate = (state.settings.riskFreeRate ?? 5.25) / 100;
    const etfMap = Object.fromEntries(DATA.ETF_UNIVERSE.map(e => [e.ticker, e]));

    const rows = Object.values(templates).map(t => {
      const mu     = t.holdings.reduce((s, h) => s + h.weight * (etfMap[h.ticker]?.mu || 0.07), 0);
      const vol    = Math.sqrt(t.holdings.reduce((v, h) => v + Math.pow(h.weight * (etfMap[h.ticker]?.sigma || 0.1), 2), 0) * 0.7);
      const sharpe = vol > 0 ? (mu - rfRate) / vol : 0;
      const taxScore = t.holdings.reduce((s, h) => s + h.weight * (etfMap[h.ticker]?.taxScore || 75), 0);

      return `
        <tr>
          <td class="td-primary">${t.name}</td>
          <td><div class="ratio-bar" style="height:8px;width:80px">
            <div class="ratio-equity" style="width:${t.equityPct}%"></div>
            <div class="ratio-bond" style="width:${t.bondPct}%"></div>
          </div></td>
          <td class="td-mono" style="color:var(--success)">${(mu*100).toFixed(1)}%</td>
          <td class="td-mono" style="color:var(--warning)">${(vol*100).toFixed(1)}%</td>
          <td class="td-mono">${sharpe.toFixed(3)}</td>
          <td>
            <div class="tax-eff-bar">
              <div class="tax-eff-track" style="width:60px">
                <div class="tax-eff-fill" style="width:${taxScore}%;background:${taxScore>=85?'var(--success)':taxScore>=70?'var(--warning)':'var(--danger)'}"></div>
              </div>
              <span style="font-size:11px">${taxScore.toFixed(0)}</span>
            </div>
          </td>
          <td>
            <button class="btn-secondary btn-sm" onclick="RecommendationsView._selectTemplate('${t.id}', App.state)">
              View Details
            </button>
          </td>
        </tr>`;
    });

    return `
      <div class="card">
        <div class="card-title card-title-blue mb-12">All Portfolio Comparison</div>
        <div style="height:260px;margin-bottom:16px"><canvas id="comparisonChart"></canvas></div>
        <table class="data-table">
          <thead>
            <tr><th>Portfolio</th><th>Equity/Bond</th><th>Est. Return</th><th>Est. Vol</th><th>Sharpe</th><th>Tax Score</th><th>Action</th></tr>
          </thead>
          <tbody>${rows.join('')}</tbody>
        </table>
      </div>`;
  },

  _renderTaxAnalysis(templates) {
    const etfMap = Object.fromEntries(DATA.ETF_UNIVERSE.map(e => [e.ticker, e]));
    const client = DATA.CLIENT;

    const taxStrategies = [
      { title: 'Asset Location Optimization', icon: '&#127968;',
        desc: 'Place tax-inefficient assets in tax-advantaged accounts (IRA/401k), tax-efficient assets in taxable accounts.',
        taxable: ['VTI','VOO','VUG','QQQ','VXF'], taxAdv: ['BND','AGG','VNQ','BNDX','VWO','TLT'],
        savings: '$2,400/yr est.' },
      { title: 'Tax-Loss Harvesting', icon: '&#9889;',
        desc: 'Systematically harvest unrealized losses to offset capital gains, while maintaining market exposure.',
        pairs: DATA.TLH_PAIRS,
        savings: '$1,800/yr est. (varies)' },
      { title: 'Long-Term Capital Gains', icon: '&#128197;',
        desc: 'Hold ETFs > 1 year to qualify for preferential LTCG tax rates (0%, 15%, or 20% vs. up to 37% for STCG).',
        savings: 'Up to 17% rate reduction' },
      { title: 'ETF Tax Efficiency', icon: '&#10003;',
        desc: 'ETFs are inherently more tax-efficient than mutual funds due to in-kind creation/redemption mechanism — no embedded capital gains distributions.',
        savings: '0.5–2.0% annual tax drag avoided vs mutual funds' },
    ];

    return `
      <div class="card mb-16">
        <div class="card-title card-title-teal mb-12">Tax Efficiency Strategies</div>
        <div class="grid-2">
          ${taxStrategies.map(s => `
            <div style="background:var(--bg-elevated);border-radius:var(--radius);padding:16px">
              <div style="font-size:18px;margin-bottom:8px">${s.icon}</div>
              <div style="font-weight:600;font-size:13px;color:var(--text-primary);margin-bottom:6px">${s.title}</div>
              <div style="font-size:12px;color:var(--text-secondary);line-height:1.6;margin-bottom:10px">${s.desc}</div>
              <div style="font-size:11px;color:var(--success);font-weight:600">Est. Savings: ${s.savings}</div>
              ${s.taxable ? `
                <div style="margin-top:10px;font-size:11px">
                  <span style="color:var(--success)">Taxable:</span>
                  <span style="font-family:monospace;color:var(--accent-blue)">${s.taxable.join(', ')}</span>
                </div>
                <div style="font-size:11px">
                  <span style="color:var(--accent-blue)">Tax-Adv.:</span>
                  <span style="font-family:monospace;color:var(--accent-purple-light)">${s.taxAdv.join(', ')}</span>
                </div>` : ''}
              ${s.pairs ? `
                <div style="margin-top:8px;font-size:11px;color:var(--text-muted)">
                  Sample pairs: VTI→ITOT, BND→AGG, GLD→IAU
                </div>` : ''}
            </div>`).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-title card-title-teal mb-12">Estimated Annual Tax Impact by Portfolio Type</div>
        <div style="height:220px"><canvas id="taxCompareChart"></canvas></div>
        <div class="info-box mt-12">
          Tax impact estimates assume ${(client.tax_bracket * 100).toFixed(0)}% marginal tax bracket, 15% qualified dividend rate,
          and typical ETF distribution patterns. Actual impact varies based on individual tax situation.
          Consult a tax professional for personalized advice.
        </div>
      </div>`;
  },

  _selectTemplate(id, state) {
    this._selected = id;
    const t = DATA.PORTFOLIO_TEMPLATES[id];
    if (!t) return;

    // Show detail modal or highlight card
    App.toast(`Selected: ${t.name}`, 'info');

    // Update visual selection
    document.querySelectorAll('.portfolio-type-card').forEach(c => c.classList.remove('selected'));
    // Re-render to show selection — simplified: just notify
  },

  _renderTab(tab, templates, state) {
    document.querySelectorAll('.tab-btn[data-rtab]').forEach(b => b.classList.toggle('active', b.dataset.rtab === tab));
    const content = document.getElementById('recTabContent');
    if (!content) return;

    if (tab === 'us')       content.innerHTML = this._renderUSCore(templates, state);
    if (tab === 'intl')     content.innerHTML = this._renderIntlCore(templates, state);
    if (tab === 'combined') content.innerHTML = this._renderCombined(templates, state);
    if (tab === 'compare')  { content.innerHTML = this._renderComparison(templates, state); this._renderComparisonChart(templates, state); }
    if (tab === 'tax')      { content.innerHTML = this._renderTaxAnalysis(templates); this._renderTaxChart(templates, state); }
  },

  _renderIntlCore(templates, state) {
    const intlTemplates = Object.values(templates).filter(t => t.group === 'International Core');
    const recommended = this._getRecommended(DATA.CLIENT);
    return intlTemplates.length
      ? `<div class="grid-3" style="gap:14px">${intlTemplates.map(t => this._portfolioCard(t, recommended, state)).join('')}</div>`
      : `<div class="empty-state"><div class="empty-state-icon">&#127760;</div><h3>International Core Portfolio</h3><p>Combining VXUS, VEA, VWO, and BNDX for full global diversification.</p></div>`;
  },

  _renderCombined(templates, state) {
    const coreTemplates = Object.values(templates).filter(t => t.group === 'Combined Core');
    const recommended = this._getRecommended(DATA.CLIENT);
    return coreTemplates.length
      ? `<div class="grid-3" style="gap:14px">${coreTemplates.map(t => this._portfolioCard(t, recommended, state)).join('')}</div>`
      : `<div class="empty-state"><div class="empty-state-icon">&#9889;</div><h3>Combined Core Portfolio</h3><p>Full-spectrum global diversification blending US and international with diversified fixed income.</p></div>`;
  },

  _renderComparisonChart(templates, state) {
    const rfRate = (state.settings.riskFreeRate ?? 5.25) / 100;
    const etfMap = Object.fromEntries(DATA.ETF_UNIVERSE.map(e => [e.ticker, e]));

    const pts = Object.values(templates).map(t => {
      const mu  = t.holdings.reduce((s, h) => s + h.weight * (etfMap[h.ticker]?.mu || 0.07), 0);
      const vol = Math.sqrt(t.holdings.reduce((v, h) => v + Math.pow(h.weight * (etfMap[h.ticker]?.sigma || 0.1), 2), 0) * 0.7);
      return { x: vol * 100, y: mu * 100, label: t.name.replace('U.S. Core ETF ', '').replace('International Core ETF ', 'Intl ').replace('Combined Core ETF ', 'Comb ') };
    });

    setTimeout(() => {
      refreshChart('comparisonChart', ctx => createFrontierChart(ctx, [
        { label: 'Portfolio Options', data: pts, color: CHART_COLORS.blue, pointRadius: 6 },
        { label: 'S&P 500 Benchmark', data: [{ x: 18.2, y: 14.5, label: 'S&P 500 (SPY)' }], color: '#F97316', pointRadius: 7, pointStyle: 'triangle' },
        { label: 'Risk-Free Rate', data: [{ x: 0, y: rfRate * 100, label: `T-Bill ${(rfRate*100).toFixed(2)}%` }], color: CHART_COLORS.green, pointRadius: 6 },
      ]));
    }, 0);
  },

  _renderTaxChart(templates, state) {
    const etfMap = Object.fromEntries(DATA.ETF_UNIVERSE.map(e => [e.ticker, e]));
    const client = DATA.CLIENT;

    const labels = [];
    const taxDrags = [];

    Object.values(templates).slice(0, 6).forEach(t => {
      labels.push(t.name.replace('U.S. Core ETF ', ''));
      const drag = t.holdings.reduce((s, h) => {
        const etf = etfMap[h.ticker];
        if (!etf) return s;
        const d = etf.dividendYield * (etf.qualified ? 0.15 : client.tax_bracket);
        const c = etf.turnover * 0.10 * 0.15;
        return s + (d + c) * h.weight;
      }, 0);
      taxDrags.push(drag);
    });

    setTimeout(() => {
      refreshChart('taxCompareChart', ctx => createBarChart(
        ctx, labels, taxDrags,
        taxDrags.map(d => d > 0.008 ? CHART_COLORS.yellow : CHART_COLORS.teal),
        v => (v * 100).toFixed(2) + '%'
      ));
    }, 0);
  },

  _bindEvents(templates, state) {
    // Tab switching
    document.querySelectorAll('.tab-btn[data-rtab]').forEach(btn =>
      btn.addEventListener('click', () => this._renderTab(btn.dataset.rtab, templates, state)));

    // Asset type buttons
    document.querySelectorAll('[data-atype]').forEach(btn => {
      btn.addEventListener('click', () => {
        this._assetType = btn.dataset.atype;
        document.getElementById('assetTypeInfo').innerHTML = this._assetTypeInfo(this._assetType);
        document.querySelectorAll('[data-atype]').forEach(b => {
          b.className = b.dataset.atype === this._assetType ? 'btn-primary' : 'btn-secondary';
          b.style.fontSize = '12px';
        });
      });
    });
  },
};
