/* =========================================================
   views/optimizer.js — Markowitz / Michaud Portfolio Optimizer
   Implements the full 4-step investment philosophy
   ========================================================= */

const OptimizerView = {
  _frontierChart: null,
  _weightsChart:  null,
  _results:   null,
  _refResults: null,
  _computing: false,
  _selectedPoint: null,
  _state: null,
  _keyPoints: null,

  render(container, state) {
    this._state = state;
    const universe = DATA.ETF_UNIVERSE;
    const rfRate   = (state.settings.riskFreeRate ?? 5.25) / 100;

    container.innerHTML = `
      <div class="view-container">
        <div class="view-header">
          <div class="view-title">ETF Portfolio Optimizer</div>
          <div class="view-sub">Markowitz Mean-Variance Optimization · Michaud Resampled Efficient Frontier (REF)</div>
        </div>

        <!-- Investment Philosophy Strip -->
        <div class="philosophy-strip">
          ${this._philosophyStep(1,'Asset Universe','Select liquid ETFs across US equity, international, fixed income, and alternatives','blue')}
          ${this._philosophyStep(2,'Estimate Risk & Return','Use real historical data from Yahoo Finance to compute μ and Σ','purple')}
          ${this._philosophyStep(3,'Construct Portfolio','Markowitz MVO + Michaud REF for robust, uncertainty-aware weights','teal')}
          ${this._philosophyStep(4,'Monitor & Rebalance','Track drift vs target; trigger rebalance when threshold exceeded','green')}
        </div>

        <div class="grid-sidebar">
          <!-- Left: Controls -->
          <div class="optimizer-controls">

            <!-- Data source indicator -->
            <div class="control-card">
              <div class="control-title">Data Source</div>
              <div id="dataSourceStatus" style="font-size:12px;color:var(--text-secondary)">
                ${state.etfDataReady
                  ? `<span style="color:var(--success)">&#9679; Real Yahoo Finance data loaded</span>`
                  : `<span style="color:var(--warning)">&#9679; Using pre-computed parameters (2019-2024)</span>`}
              </div>
              <button class="btn-secondary btn-sm mt-8" id="refreshData" style="width:100%">
                &#8635; Refresh ETF Data
              </button>
            </div>

            <!-- Asset Universe Selection -->
            <div class="control-card">
              <div class="control-title">Asset Universe</div>
              <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                <button class="btn-ghost btn-sm" id="selectAll">All</button>
                <button class="btn-ghost btn-sm" id="selectUSCore">US Core</button>
                <button class="btn-ghost btn-sm" id="selectGlobal">Global</button>
              </div>
              <div class="etf-checkbox-list" id="etfCheckList">
                ${this._etfCheckboxList(universe)}
              </div>
            </div>

            <!-- Constraints -->
            <div class="control-card">
              <div class="control-title">Constraints</div>

              <div class="control-row">
                <span>Max weight per asset</span>
                <strong id="ubLabel">100%</strong>
              </div>
              <input type="range" id="ubSlider" min="10" max="100" step="5" value="100" style="margin-bottom:10px">

              <div class="control-row">
                <span>Risk-free rate (rf)</span>
                <strong id="rfLabel">${(rfRate * 100).toFixed(2)}%</strong>
              </div>
              <input type="range" id="rfSlider" min="0" max="8" step="0.25" value="${(rfRate * 100).toFixed(2)}" style="margin-bottom:10px">

              <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;color:var(--text-secondary)">
                <input type="checkbox" id="showBenchmarks" checked>
                Show market benchmarks
              </label>
              <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;margin-top:6px;color:var(--text-secondary)">
                <input type="checkbox" id="showCML">
                Show Capital Market Line
              </label>
            </div>

            <!-- Run buttons -->
            <button class="btn-primary" id="runMVO" style="width:100%">
              &#9654; Run MVO Optimization
            </button>

            <!-- REF Section -->
            <div class="control-card" id="refPanel" style="display:none">
              <div class="control-title" style="color:var(--warning)">Michaud REF</div>
              <div class="control-row">
                <span>Simulations</span>
                <strong id="simLabel">100</strong>
              </div>
              <input type="range" id="simSlider" min="20" max="300" step="10" value="100" style="margin-bottom:8px">
              <button class="btn-secondary" id="runREF" style="width:100%">
                &#9654; Generate Resampled Frontier
              </button>
            </div>

            <!-- Progress bar -->
            <div id="progressWrap" style="display:none">
              <div class="control-row"><span id="progressLabel">Computing...</span><strong id="progressPct">0%</strong></div>
              <div style="background:var(--bg-elevated);border-radius:4px;height:6px;overflow:hidden">
                <div id="progressBar" style="height:100%;background:var(--accent-blue);border-radius:4px;width:0%;transition:width 0.2s"></div>
              </div>
            </div>
          </div>

          <!-- Right: Results -->
          <div>
            <div class="tabs">
              <button class="tab-btn active" data-otab="frontier">Efficient Frontier</button>
              <button class="tab-btn" data-otab="weights">Weights</button>
              <button class="tab-btn" data-otab="stats">Statistics</button>
              <button class="tab-btn" data-otab="theory">Theory</button>
            </div>
            <div id="optimizerTabContent">
              ${this._placeholderHTML()}
            </div>
          </div>
        </div>
      </div>
    `;

    this._bindEvents(state);
  },

  _philosophyStep(num, title, desc, color) {
    const colors = { blue:'var(--accent-blue)', purple:'var(--accent-purple-light)', teal:'var(--accent-teal)', green:'var(--success)' };
    return `
      <div class="philosophy-step">
        <div class="step-num" style="color:${colors[color]}">Step ${num}</div>
        <div class="step-title">${title}</div>
        <div class="step-desc">${desc}</div>
      </div>`;
  },

  _etfCheckboxList(universe) {
    const categories = [...new Set(universe.map(e => e.category))];
    return categories.map(cat => {
      const etfs = universe.filter(e => e.category === cat);
      return `
        <div class="etf-cat-label">${cat}</div>
        ${etfs.map(e => `
          <label class="etf-check-item">
            <input type="checkbox" class="etf-check" data-ticker="${e.ticker}" checked>
            <span style="font-family:monospace;color:var(--accent-blue);font-size:11px;min-width:38px">${e.ticker}</span>
            <span style="font-size:11px">${e.name.replace(' ETF','').replace(' Trust','')}</span>
          </label>`).join('')}`;
    }).join('');
  },

  _placeholderHTML() {
    return `
      <div class="empty-state" style="padding:60px 24px">
        <div class="empty-state-icon">&#128202;</div>
        <h3>Run Optimization to View Results</h3>
        <p>Select your asset universe, configure constraints, then click<br><strong>Run MVO Optimization</strong> to generate the efficient frontier.</p>
      </div>`;
  },

  _getSelectedAssets(state) {
    const checked = Array.from(document.querySelectorAll('.etf-check:checked')).map(c => c.dataset.ticker);
    const universe = DATA.ETF_UNIVERSE.filter(e => checked.includes(e.ticker));

    // Use real data where available
    return universe.map(etf => {
      const real = state.etfData?.[etf.ticker];
      return {
        ...etf,
        mu:    real?.mu    ?? etf.mu,
        sigma: real?.sigma ?? etf.sigma,
      };
    });
  },

  _getCorr(assets) {
    const allTickers = DATA.ETF_UNIVERSE.map(e => e.ticker);
    const n = assets.length;
    const corr = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      const ri = allTickers.indexOf(assets[i].ticker);
      for (let j = 0; j < n; j++) {
        const rj = allTickers.indexOf(assets[j].ticker);
        corr[i][j] = ri >= 0 && rj >= 0 ? DATA.ETF_CORR[ri][rj] : (i === j ? 1 : 0.3);
      }
    }
    return corr;
  },

  async _runMVO(state) {
    if (this._computing) return;
    this._computing = true;

    const btn = document.getElementById('runMVO');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-sm"></span> Computing...';

    const ub = parseInt(document.getElementById('ubSlider').value) / 100;
    const rf = parseFloat(document.getElementById('rfSlider').value) / 100;
    const assets = this._getSelectedAssets(state);
    if (assets.length < 2) { App.toast('Select at least 2 assets', 'error'); this._computing = false; btn.disabled = false; btn.innerHTML = '&#9654; Run MVO Optimization'; return; }

    const mu  = assets.map(a => a.mu);
    const cov = MathUtils.buildCovMatrix(assets, this._getCorr(assets));

    await new Promise(r => setTimeout(r, 20));

    const frontier  = MathUtils.generateEfficientFrontier(mu, cov, { lb: 0, ub, nPoints: 35, rfRate: rf });
    const maxSharpe = MathUtils.maxSharpePt(frontier, rf);
    const minVar    = frontier.reduce((b, p) => p.vol < b.vol ? p : b);
    const ewW       = new Array(assets.length).fill(1 / assets.length);
    const { ret: ewR, vol: ewV } = MathUtils.portfolioStats(ewW, mu, cov);
    const equalWeight = { ret: ewR * 100, vol: ewV * 100, weights: ewW, sharpe: (ewR - rf) / ewV };

    this._results = { frontier, maxSharpe, minVar, equalWeight, assets, cov, mu, rf };
    this._refResults = null;
    this._selectedPoint = maxSharpe;

    document.getElementById('refPanel').style.display = 'block';
    this._renderTab('frontier');
    this._computing = false;
    btn.disabled = false;
    btn.innerHTML = '&#9654; Run MVO Optimization';
    App.toast('MVO optimization complete', 'success');
  },

  async _runREF(state) {
    if (!this._results || this._computing) return;
    this._computing = true;
    const btn = document.getElementById('runREF');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-sm"></span> Resampling...';

    const nSims = parseInt(document.getElementById('simSlider').value);
    const { mu, cov, rf, assets } = this._results;
    const ub = parseInt(document.getElementById('ubSlider').value) / 100;

    document.getElementById('progressWrap').style.display = 'block';

    this._refResults = await MathUtils.generateREF(mu, cov, {
      lb: 0, ub, nSims, nPoints: 25, simNPoints: 16, rfRate: rf,
      onProgress: pct => {
        document.getElementById('progressBar').style.width = pct + '%';
        document.getElementById('progressPct').textContent = pct + '%';
        document.getElementById('progressLabel').textContent = `REF simulation ${pct}%`;
      },
    });

    document.getElementById('progressWrap').style.display = 'none';
    this._computing = false;
    btn.disabled = false;
    btn.innerHTML = '&#9654; Generate Resampled Frontier';
    this._renderTab('frontier');
    App.toast('Michaud REF complete', 'success');
  },

  _renderTab(tab) {
    document.querySelectorAll('.tab-btn[data-otab]').forEach(b => b.classList.toggle('active', b.dataset.otab === tab));
    const content = document.getElementById('optimizerTabContent');
    if (!content) return;
    if (!this._results) { content.innerHTML = this._placeholderHTML(); return; }

    if (tab === 'frontier')  this._renderFrontierTab(content);
    if (tab === 'weights')   this._renderWeightsTab(content);
    if (tab === 'stats')     this._renderStatsTab(content);
    if (tab === 'theory')    this._renderTheoryTab(content);
  },

  _renderFrontierTab(content) {
    const { frontier, maxSharpe, minVar, equalWeight, assets, rf } = this._results;
    const refFrontier = this._refResults?.resampledFrontier || null;
    const displayMax = refFrontier?.length ? MathUtils.maxSharpePt(refFrontier, rf) : maxSharpe;
    const displayMin = refFrontier?.length ? refFrontier.reduce((b, p) => p.vol < b.vol ? p : b) : minVar;
    this._keyPoints = { maxSharpe: displayMax, minVar: displayMin, equalWeight };
    const benchmarks = [
      { label:'S&P 500 (SPY)', vol: 18.2, ret: 14.5 },
      { label:'60/40 Blend',   vol:  9.1, ret:  7.8 },
      { label:'US Bonds (AGG)',vol:  4.6, ret:  2.2 },
    ];

    content.innerHTML = `
      <div class="card">
        <div style="height:380px"><canvas id="frontierCanvas"></canvas></div>
        <div class="frontier-legend mt-12" id="frontierLegend"></div>

        <div class="grid-3 mt-16">
          ${this._ptCard(refFrontier?.length ? 'REF Max Sharpe' : 'Max Sharpe', displayMax, rf, '#EF4444', 'maxSharpe')}
          ${this._ptCard(refFrontier?.length ? 'REF Min Variance' : 'Min Variance', displayMin, rf, '#7C3AED', 'minVar')}
          ${this._ptCard('Equal Weight', equalWeight, rf, '#F59E0B', 'equalWeight')}
        </div>

        ${this._refResults ? `
          <div class="info-box mt-12">
            <strong>&#9679; Michaud REF displayed:</strong> ${this._refResults.simulatedFrontiers.length} simulated frontiers are overlaid.
            The thick dashed curve is the resampled frontier produced by averaging portfolio weights by risk rank across simulations.
            This usually trades a bit of in-sample optimality for more robust, estimation-error-resistant allocations.
          </div>` : ''}
      </div>`;

    const series = this._buildChartSeries(benchmarks);
    setTimeout(() => {
      this._frontierChart = refreshChart('frontierCanvas', ctx => createFrontierChart(ctx, series));
    }, 0);
  },

  _ptCard(label, pt, rf, color, id) {
    const sharpe = (pt.ret / 100 - rf) / (pt.vol / 100);
    return `
      <div class="stat-card" style="border-color:${color}30;cursor:pointer" onclick="OptimizerView._selectPoint('${id}')">
        <div class="stat-label" style="color:${color}">${label}</div>
        <div style="font-size:13px;font-weight:600;font-family:monospace;margin:4px 0">
          Ret: ${pt.ret.toFixed(2)}% | Vol: ${pt.vol.toFixed(2)}%
        </div>
        <div style="font-size:12px;color:var(--text-muted)">Sharpe: ${sharpe.toFixed(3)}</div>
      </div>`;
  },

  _selectPoint(id) {
    const p = this._keyPoints || this._results;
    this._selectedPoint = { maxSharpe: p.maxSharpe, minVar: p.minVar, equalWeight: p.equalWeight }[id] || p.maxSharpe;
    this._renderTab('weights');
  },

  _buildChartSeries(benchmarks) {
    const { frontier, maxSharpe, minVar, equalWeight, rf } = this._results;
    const refFrontier = this._refResults?.resampledFrontier || null;
    const displayMax = refFrontier?.length ? MathUtils.maxSharpePt(refFrontier, rf) : maxSharpe;
    const displayMin = refFrontier?.length ? refFrontier.reduce((b, p) => p.vol < b.vol ? p : b) : minVar;
    const series = [];

    const withAlpha = (hex, alpha = 0.2) => {
      const h = (hex || '').replace('#', '');
      if (!/^[0-9a-fA-F]{6}$/.test(h)) return hex;
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    // MV Frontier
    series.push({
      label: 'MV Efficient Frontier',
      data: frontier.map(p => ({ x: p.vol, y: p.ret })),
      color: CHART_COLORS.blue,
      showLine: true, pointRadius: 0, width: 2.5,
    });

    // Michaud REF
    if (this._refResults?.simulatedFrontiers?.length) {
      this._refResults.simulatedFrontiers.forEach((f, i) => {
        series.push({
          label: i === 0 ? 'REF Simulations' : '',
          data: f.map(p => ({ x: p.vol, y: p.ret })),
          color: withAlpha(CHART_COLORS.text, 0.22),
          showLine: true, pointRadius: 0, width: 1,
        });
      });
    }

    if (this._refResults?.resampledFrontier?.length) {
      series.push({
        label: 'Michaud REF (Resampled)',
        data: this._refResults.resampledFrontier.map(p => ({ x: p.vol, y: p.ret })),
        color: CHART_COLORS.yellow,
        showLine: true, dash: [6, 3], pointRadius: 0, width: 2,
      });
    }

    // Capital Market Line
    if (document.getElementById('showCML')?.checked && displayMax) {
      const cmlPts = MathUtils.capitalMarketLine(rf, displayMax, 50);
      series.push({
        label: 'Capital Market Line',
        data: cmlPts,
        color: CHART_COLORS.teal,
        showLine: true, dash: [4, 2], pointRadius: 0, width: 1.5,
      });
    }

    // Key portfolios
    series.push({ label: refFrontier?.length ? 'REF Max Sharpe' : 'Max Sharpe', data: [{ x: displayMax.vol, y: displayMax.ret, label: `Max Sharpe (${((displayMax.ret/100 - rf)/(displayMax.vol/100)).toFixed(3)})` }], color: '#EF4444', pointRadius: 8, pointStyle: 'star' });
    series.push({ label: refFrontier?.length ? 'REF Min Variance' : 'Min Variance', data: [{ x: displayMin.vol, y: displayMin.ret, label: 'Min Variance' }], color: CHART_COLORS.purple, pointRadius: 7 });
    series.push({ label: 'Equal Weight', data: [{ x: equalWeight.vol, y: equalWeight.ret, label: 'Equal Weight (1/N)' }], color: CHART_COLORS.yellow, pointRadius: 6 });

    // Risk-free point
    series.push({ label: `Risk-Free Rate (${(rf*100).toFixed(2)}%)`, data: [{ x: 0, y: rf * 100, label: `Risk-Free: ${(rf*100).toFixed(2)}%` }], color: CHART_COLORS.green, pointRadius: 6 });

    // Market benchmarks
    if (document.getElementById('showBenchmarks')?.checked) {
      series.push({
        label: 'Market Benchmarks',
        data: benchmarks.map(b => ({ x: b.vol, y: b.ret, label: b.label })),
        color: '#F97316',
        pointRadius: 6, pointStyle: 'triangle',
      });
    }

    // Individual assets
    if (this._results.assets) {
      series.push({
        label: 'Individual ETFs',
        data: this._results.assets.map(a => ({ x: a.sigma * 100, y: a.mu * 100, label: a.ticker })),
        color: CHART_COLORS.text,
        pointRadius: 4, pointStyle: 'circle',
      });
    }

    return series;
  },

  _renderWeightsTab(content) {
    const pt = this._selectedPoint || this._results?.maxSharpe;
    if (!pt || !pt.weights) { content.innerHTML = this._placeholderHTML(); return; }
    const { assets } = this._results;

    content.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">Weight Allocation — ${pt === this._results.maxSharpe ? 'Max Sharpe' : pt === this._results.minVar ? 'Min Variance' : 'Equal Weight'}</div>
          <div style="font-size:12px;color:var(--text-muted)">Ret: ${pt.ret.toFixed(2)}% | Vol: ${pt.vol.toFixed(2)}%</div>
        </div>
        <div style="height:280px"><canvas id="weightsCanvas"></canvas></div>
        <div class="grid-4 mt-16">
          ${assets.map((a, i) => {
            const w = pt.weights[i];
            const c = w > 0.15 ? 'var(--warning)' : PALETTE[i % PALETTE.length];
            return `
              <div class="stat-card" style="border-color:${c}30;padding:10px">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                  <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c}"></span>
                  <span style="font-size:11px;font-family:monospace;color:${c}">${a.ticker}</span>
                </div>
                <div style="font-size:16px;font-weight:700;font-family:monospace">${(w * 100).toFixed(1)}%</div>
                <div style="font-size:10px;color:var(--text-muted)">${a.category}</div>
              </div>`;
          }).join('')}
        </div>
      </div>`;

    setTimeout(() => {
      refreshChart('weightsCanvas', ctx =>
        createHBarChart(ctx,
          assets.map(a => a.ticker),
          pt.weights,
          assets.map((_, i) => PALETTE[i % PALETTE.length])
        )
      );
    }, 0);
  },

  _renderStatsTab(content) {
    const { frontier, maxSharpe, minVar, equalWeight, rf } = this._results;
    const frontierSharpes = frontier.map(p => (p.ret / 100 - rf) / (p.vol / 100));
    const bestSharpe = Math.max(...frontierSharpes);
    const refSharpe = this._refResults?.resampledFrontier?.length
      ? Math.max(...this._refResults.resampledFrontier.map(p => (p.ret / 100 - rf) / (p.vol / 100)))
      : null;

    content.innerHTML = `
      <div class="card">
        <div class="grid-4 mb-16">
          ${this._statTile('Max Sharpe Ratio', bestSharpe.toFixed(4), '(Rp−Rf)/σp', '#EF4444')}
          ${this._statTile('Min Variance', minVar.vol.toFixed(2) + '%', 'Annualized vol', '#7C3AED')}
          ${this._statTile('Equal Weight Sharpe', ((equalWeight.ret/100 - rf)/(equalWeight.vol/100)).toFixed(4), '1/N benchmark', '#F59E0B')}
          ${refSharpe !== null ? this._statTile('REF Max Sharpe', refSharpe.toFixed(4), 'More robust', CHART_COLORS.teal) : this._statTile('REF', 'Not run', 'Click Generate REF', CHART_COLORS.text)}
        </div>

        <div class="card-title mb-12" style="color:var(--accent-blue)">Correlation Matrix (selected assets)</div>
        ${this._correlationTable()}

        <div class="warn-box mt-12">
          <strong>&#9888; Survivorship Bias Warning:</strong> All ETF parameters are estimated from data of
          "surviving" markets. Historical returns for markets that experienced complete closure
          (Russia 1917, China 1949) are not reflected. Risk models capture normal-market risk —
          tail events beyond the model are not quantified here.
        </div>
      </div>`;
  },

  _statTile(label, value, desc, color) {
    return `
      <div class="stat-card" style="border-color:${color}30">
        <div class="stat-label">${label}</div>
        <div class="stat-value" style="color:${color};font-size:18px;font-family:monospace">${value}</div>
        <div class="stat-sub">${desc}</div>
      </div>`;
  },

  _correlationTable() {
    const { assets } = this._results;
    const n = Math.min(assets.length, 8);
    const slice = assets.slice(0, n);
    const corr  = this._getCorr(slice);

    const header = slice.map(a => `<th style="padding:6px 8px;font-size:10px;color:var(--text-muted)">${a.ticker}</th>`).join('');
    const rows   = slice.map((a, i) => {
      const cells = corr[i].slice(0, n).map((c, j) => {
        const intensity = Math.abs(c);
        const bg = i === j ? 'var(--bg-elevated)' : c > 0 ? `rgba(59,130,246,${intensity * 0.5})` : `rgba(239,68,68,${intensity * 0.5})`;
        return `<td style="padding:5px 8px;text-align:center;background:${bg};font-family:monospace;font-size:10px">${c.toFixed(2)}</td>`;
      }).join('');
      return `<tr><td style="padding:5px 8px;font-size:10px;font-family:monospace;color:${PALETTE[i % PALETTE.length]}">${a.ticker}</td>${cells}</tr>`;
    }).join('');

    return `<div style="overflow-x:auto"><table class="data-table" style="font-size:11px"><thead><tr><th></th>${header}</tr></thead><tbody>${rows}</tbody></table></div>`;
  },

  _renderTheoryTab(content) {
    const sections = [
      { title:'Step 1 · Asset Universe Selection', color:'var(--accent-blue)',
        points:['Liquid, low-cost ETFs from Vanguard, iShares, and SPDR families','Core categories: US equity (VTI/VOO), International (VXUS/VEA/VWO), Fixed income (BND/AGG), Alternatives (GLD/VNQ)','Selection based on AUM, expense ratio, bid-ask spread, and tracking error'] },
      { title:'Step 2 · Risk & Return Estimation', color:'var(--accent-purple-light)',
        points:['Expected returns: annualized monthly return from 2-year Yahoo Finance data','Covariance matrix: sample covariance from monthly returns (annualized)','Forward-looking overlay: consider macro environment and mean-reversion'] },
      { title:'Step 3 · Portfolio Construction (Markowitz + Michaud)', color:'var(--accent-teal)',
        points:['Classical MVO: min wᵀΣw s.t. wᵀμ = μp, Σwi = 1, wi ≥ 0','Efficient Frontier traces the minimum-variance boundary for each return target','Michaud REF: run N Monte-Carlo simulations of (μ, Σ), compute a frontier each time, then average weights by risk rank','Display includes many simulation frontiers plus one resampled frontier for robust allocation guidance','Max-Sharpe portfolio: highest risk-adjusted return on the frontier','Capital Market Line: connects rf to Max-Sharpe point; extend for leveraged portfolios'] },
      { title:'Step 4 · Monitor & Rebalance', color:'var(--success)',
        points:['Target weights set from optimal portfolio (usually Max-Sharpe or custom blend)','Monitor drift: |actual - target| at each rebalancing window','Trigger threshold: 5% absolute drift (configurable in Settings)','Tax-aware rebalancing: use new contributions first, then direct trades','Annual full review; quarterly drift check'] },
    ];

    content.innerHTML = `
      <div class="card">
        <div class="info-box mb-16">
          <strong>Core Philosophy:</strong> We do not predict markets. We construct optimally diversified portfolios
          based on historical risk/return relationships, and systematically maintain those allocations over time.
        </div>
        ${sections.map(s => `
          <div style="background:var(--bg-elevated);border-radius:var(--radius);padding:14px;border-left:3px solid ${s.color};margin-bottom:12px">
            <div style="color:${s.color};font-weight:600;font-size:13px;margin-bottom:8px">${s.title}</div>
            ${s.points.map(p => `<div style="color:var(--text-secondary);font-size:12px;padding-left:12px;margin-bottom:4px">· ${p}</div>`).join('')}
          </div>`).join('')}
        <div class="info-box">
          Reference: Markowitz, H. (1952). "Portfolio Selection". Journal of Finance 7(1):77–91. ·
          Michaud, R. (1998). "Efficient Asset Management". Harvard Business School Press.
        </div>
      </div>`;
  },

  _bindEvents(state) {
    // Slider labels
    document.getElementById('ubSlider')?.addEventListener('input', e =>
      document.getElementById('ubLabel').textContent = e.target.value + '%');
    document.getElementById('rfSlider')?.addEventListener('input', e =>
      document.getElementById('rfLabel').textContent = parseFloat(e.target.value).toFixed(2) + '%');
    document.getElementById('simSlider')?.addEventListener('input', e =>
      document.getElementById('simLabel').textContent = e.target.value);

    // Tab switching
    document.querySelectorAll('.tab-btn[data-otab]').forEach(btn =>
      btn.addEventListener('click', () => this._renderTab(btn.dataset.otab)));

    // Checkboxes "show" options
    document.getElementById('showBenchmarks')?.addEventListener('change', () => {
      if (this._results) this._renderTab('frontier');
    });
    document.getElementById('showCML')?.addEventListener('change', () => {
      if (this._results) this._renderTab('frontier');
    });

    // Select presets
    document.getElementById('selectAll')?.addEventListener('click', () => {
      document.querySelectorAll('.etf-check').forEach(c => (c.checked = true));
    });
    document.getElementById('selectUSCore')?.addEventListener('click', () => {
      document.querySelectorAll('.etf-check').forEach(c => {
        const cat = DATA.ETF_UNIVERSE.find(e => e.ticker === c.dataset.ticker)?.category || '';
        c.checked = cat.includes('US') || cat === 'Commodities';
      });
    });
    document.getElementById('selectGlobal')?.addEventListener('click', () => {
      document.querySelectorAll('.etf-check').forEach(c => (c.checked = true));
    });

    // Run buttons
    document.getElementById('runMVO')?.addEventListener('click', () => this._runMVO(state));
    document.getElementById('runREF')?.addEventListener('click', () => this._runREF(state));
    document.getElementById('refreshData')?.addEventListener('click', async () => {
      localStorage.removeItem(Config.ETF_CACHE_KEY);
      App.toast('Refreshing ETF data...', 'info');
      await App.loadETFData();
      App.navigate('optimizer');
    });
  },

  _getCorr(assets) {
    const allTickers = DATA.ETF_UNIVERSE.map(e => e.ticker);
    const n = assets.length;
    const corr = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      const ri = allTickers.indexOf(assets[i].ticker);
      for (let j = 0; j < n; j++) {
        const rj = allTickers.indexOf(assets[j].ticker);
        corr[i][j] = ri >= 0 && rj >= 0 ? DATA.ETF_CORR[ri][rj] : (i === j ? 1 : 0.3);
      }
    }
    return corr;
  },
};
