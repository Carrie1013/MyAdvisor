/* =========================================================
   api.js — Financial data fetching (Yahoo Finance) + Claude API
   ========================================================= */

const API = {

  // ── ETF Data Cache ────────────────────────────────────
  _cache: null,

  _loadCache() {
    if (this._cache) return this._cache;
    try {
      const raw = localStorage.getItem(Config.ETF_CACHE_KEY);
      if (!raw) return null;
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts < Config.ETF_CACHE_TTL) {
        this._cache = data;
        return data;
      }
    } catch {}
    return null;
  },

  _saveCache(data) {
    this._cache = data;
    try {
      localStorage.setItem(Config.ETF_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
    } catch {}
  },

  // ── Fetch one ticker via Yahoo Finance + CORS proxies ─
  async fetchYahoo(ticker, range = '2y', interval = '1mo') {
    const url = Config.YAHOO_CHART_API(ticker);
    for (const proxy of Config.CORS_PROXIES) {
      try {
        const res = await fetch(proxy(url), { signal: AbortSignal.timeout(10000) });
        if (!res.ok) continue;
        let json;
        try { json = await res.json(); } catch { continue; }

        const result = json?.chart?.result?.[0];
        if (!result) continue;

        const timestamps = result.timestamp || [];
        const closes = result.indicators?.adjclose?.[0]?.adjclose
                    || result.indicators?.quote?.[0]?.close
                    || [];

        const prices = timestamps
          .map((t, i) => ({ date: new Date(t * 1000), price: closes[i] }))
          .filter(d => d.price != null && isFinite(d.price));

        if (prices.length < 6) continue;
        return prices;
      } catch (_) { /* try next proxy */ }
    }
    return null;
  },

  // ── Compute monthly log-returns from price series ─────
  computeReturns(prices) {
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      const p0 = prices[i - 1].price, p1 = prices[i].price;
      if (p0 && p1 && p0 > 0) returns.push((p1 - p0) / p0);
    }
    return returns;
  },

  // ── Compute annualized mean & sigma from monthly returns ─
  annualizeStats(returns) {
    const T = returns.length;
    const mu = returns.reduce((a, b) => a + b, 0) / T * 12;
    const variance = returns.reduce((a, r) => a + (r - mu / 12) ** 2, 0) / (T - 1) * 12;
    return { mu, sigma: Math.sqrt(Math.max(variance, 0)) };
  },

  // ── Fetch a set of tickers, return processed stats ─────
  async fetchMultiple(tickers, onProgress) {
    // Check cache first
    const cached = this._loadCache();
    if (cached) {
      const allPresent = tickers.every(t => cached[t]);
      if (allPresent) {
        onProgress?.({ pct: 100, msg: 'Loaded from cache' });
        return cached;
      }
    }

    const results = {};
    let done = 0;

    await Promise.allSettled(tickers.map(async ticker => {
      const prices = await this.fetchYahoo(ticker);
      if (prices) {
        const returns = this.computeReturns(prices);
        const { mu, sigma } = this.annualizeStats(returns);
        results[ticker] = { prices, returns, mu, sigma };
      }
      done++;
      onProgress?.({ pct: Math.round(done / tickers.length * 100), msg: `Loaded ${ticker}` });
    }));

    if (Object.keys(results).length > 0) this._saveCache(results);
    return results;
  },

  // ── Portfolio compliance checking (client-side) ────────
  checkCompliance(portfolio, rules) {
    const holdings = portfolio.holdings;

    const equityHoldings  = holdings.filter(h => h.asset_class === 'equity');
    const fixedIncome     = holdings.filter(h => h.asset_class === 'fixed_income');
    const cashHoldings    = holdings.filter(h => h.asset_class === 'cash');
    const altHoldings     = holdings.filter(h => h.asset_class === 'alternatives');

    const totalEquity     = equityHoldings.reduce((s, h) => s + h.weight, 0);
    const totalFI         = fixedIncome.reduce((s, h) => s + h.weight, 0);
    const totalCash       = cashHoldings.reduce((s, h) => s + h.weight, 0);
    const totalAlt        = altHoldings.reduce((s, h) => s + h.weight, 0);
    const domesticEquity  = equityHoldings.filter(h => h.geography === 'US').reduce((s, h) => s + h.weight, 0);

    const sectorWeights = {};
    holdings.forEach(h => { sectorWeights[h.sector] = (sectorWeights[h.sector] || 0) + h.weight; });
    const maxSector = Math.max(...Object.values(sectorWeights));

    const sortedByWeight  = [...holdings].sort((a, b) => b.weight - a.weight);
    const top5Weight      = sortedByWeight.slice(0, 5).reduce((s, h) => s + h.weight, 0);
    const maxSingle       = sortedByWeight[0]?.weight || 0;

    const highYield       = fixedIncome.filter(h => h.credit_rating && ['B','BB','CCC'].some(r => h.credit_rating.startsWith(r)));
    const highYieldRatio  = totalFI > 0 ? highYield.reduce((s, h) => s + h.weight, 0) / totalFI : 0;

    return rules.map(rule => {
      let actual, passed;
      switch (rule.metric) {
        case 'max_single_weight':
          actual = maxSingle; passed = actual <= rule.threshold; break;
        case 'top5_combined_weight':
          actual = top5Weight; passed = actual <= rule.threshold; break;
        case 'equity_weight':
          actual = totalEquity; passed = actual <= rule.threshold; break;
        case 'fixed_income_weight':
          actual = totalFI; passed = actual >= rule.threshold; break;
        case 'max_sector_weight':
          actual = maxSector; passed = actual <= rule.threshold; break;
        case 'domestic_equity_ratio':
          actual = totalEquity > 0 ? domesticEquity / totalEquity : 0;
          passed = actual <= rule.threshold; break;
        case 'cash_weight':
          actual = totalCash; passed = actual >= rule.threshold; break;
        case 'alternatives_weight':
          actual = totalAlt; passed = actual <= rule.threshold; break;
        case 'high_yield_ratio_of_fixed_income':
          actual = highYieldRatio; passed = actual <= rule.threshold; break;
        case 'distinct_equity_holdings_count':
          actual = equityHoldings.length; passed = actual >= rule.threshold; break;
        default:
          actual = 0; passed = true;
      }
      return { ...rule, actual, passed };
    });
  },

  // ── Claude API (direct browser call) ─────────────────
  async callClaude(messages, systemPrompt, apiKey) {
    if (!apiKey) throw new Error('Claude API key not configured. Please add it in Settings.');

    const res = await fetch(Config.CLAUDE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'x-api-key':     apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model:      Config.CLAUDE_MODEL,
        max_tokens: 2048,
        system:     systemPrompt,
        messages,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Claude API error ${res.status}`);
    }
    return res.json();
  },

  // ── Backend API (FastAPI) ─────────────────────────────
  async callBackend(endpoint, body, backendUrl) {
    if (!backendUrl) throw new Error('Backend URL not configured');
    const res = await fetch(`${backendUrl}${endpoint}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(60000),
    });
    if (!res.ok) throw new Error(`Backend error ${res.status}`);
    return res.json();
  },

  // ── Fetch a single current price (for rebalancer) ─────
  async fetchCurrentPrice(ticker) {
    const prices = await this.fetchYahoo(ticker, '1mo', '1d');
    return prices?.[prices.length - 1]?.price ?? null;
  },
};
