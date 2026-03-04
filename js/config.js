/* =========================================================
   config.js — Application configuration & persistent settings
   ========================================================= */

const Config = {
  // ── Defaults ──────────────────────────────────────────
  DEFAULTS: {
    claudeApiKey:    '',
    backendUrl:      '',
    riskFreeRate:    5.25,   // %
    rebalThreshold:  5.0,    // %
  },

  // ── Anthropic ──────────────────────────────────────────
  CLAUDE_MODEL:    'claude-sonnet-4-6',
  CLAUDE_ENDPOINT: 'https://api.anthropic.com/v1/messages',

  // ── Yahoo Finance (via CORS proxies) ──────────────────
  CORS_PROXIES: [
    url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    url => `https://thingproxy.freeboard.io/fetch/${url}`,
  ],
  YAHOO_CHART_API: ticker =>
    `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=2y&interval=1mo`,

  // ── ETF Data Cache ─────────────────────────────────────
  ETF_CACHE_KEY:  'wealthiq_etf_cache',
  ETF_CACHE_TTL:  6 * 60 * 60 * 1000, // 6 hours in ms

  // ── localStorage keys ─────────────────────────────────
  SETTINGS_KEY:   'wealthiq_settings',
  CHAT_HIST_KEY:  'wealthiq_chat_history',

  // ── Load settings from localStorage ───────────────────
  load() {
    try {
      const stored = localStorage.getItem(this.SETTINGS_KEY);
      return stored ? { ...this.DEFAULTS, ...JSON.parse(stored) } : { ...this.DEFAULTS };
    } catch { return { ...this.DEFAULTS }; }
  },

  // ── Save settings to localStorage ─────────────────────
  save(settings) {
    try { localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings)); } catch {}
  },

  // ── Convenience getter ─────────────────────────────────
  get(key) { return this.load()[key]; },
};
