/* =========================================================
   app.js — Main application controller & router
   ========================================================= */

const App = {
  state: {
    currentView:  'chat',
    settings:     {},
    etfData:      {},      // real data from Yahoo Finance
    etfDataReady: false,
    chatHistory:  [],
    uploadedDocs: [],      // { name, content }
    optimizerResults: null,
    refResults:   null,
  },

  // ── Toast ─────────────────────────────────────────────
  toast(msg, type = 'info', duration = 3500) {
    const icons = { info: 'ℹ️', success: '✅', error: '❌' };
    const div = document.createElement('div');
    div.className = `toast toast-${type}`;
    div.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
    document.getElementById('toastContainer').appendChild(div);
    setTimeout(() => div.remove(), duration);
  },

  // ── View navigation ───────────────────────────────────
  navigate(view) {
    this.state.currentView = view;

    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.view === view);
    });

    const viewMap = {
      chat:            ChatView,
      profile:         ProfileView,
      optimizer:       OptimizerView,
      rebalancer:      RebalancerView,
      recommendations: RecommendationsView,
      report:          ReportView,
    };

    const main = document.getElementById('mainContent');
    if (viewMap[view]) {
      viewMap[view].render(main, this.state);
    }
  },

  // ── Settings ──────────────────────────────────────────
  openSettings() {
    const s = this.state.settings;
    document.getElementById('claudeApiKey').value  = s.claudeApiKey || '';
    document.getElementById('backendUrl').value    = s.backendUrl   || '';
    document.getElementById('riskFreeRate').value  = s.riskFreeRate ?? 5.25;
    document.getElementById('rebalThreshold').value = s.rebalThreshold ?? 5.0;
    document.getElementById('settingsModal').classList.add('active');
  },

  closeSettings() {
    document.getElementById('settingsModal').classList.remove('active');
  },

  saveSettings() {
    const settings = {
      claudeApiKey:   document.getElementById('claudeApiKey').value.trim(),
      backendUrl:     document.getElementById('backendUrl').value.trim().replace(/\/$/, ''),
      riskFreeRate:   parseFloat(document.getElementById('riskFreeRate').value) || 5.25,
      rebalThreshold: parseFloat(document.getElementById('rebalThreshold').value) || 5.0,
    };
    this.state.settings = settings;
    Config.save(settings);
    this.closeSettings();
    this.toast('Settings saved', 'success');
  },

  // ── ETF Data Loader ───────────────────────────────────
  async loadETFData() {
    const tickers = DATA.ETF_UNIVERSE.map(e => e.ticker);
    const statusEl = document.getElementById('loadingStatus');

    try {
      const data = await API.fetchMultiple(tickers, ({ pct, msg }) => {
        if (statusEl) statusEl.textContent = `${msg} (${pct}%)`;
      });

      const loaded = Object.keys(data).length;
      this.state.etfData = data;
      this.state.etfDataReady = loaded >= Math.floor(tickers.length * 0.5);

      if (this.state.etfDataReady) {
        this.toast(`Real ETF data loaded (${loaded}/${tickers.length} tickers)`, 'success');
      } else {
        this.toast('Using pre-computed ETF parameters (API unavailable)', 'info');
      }
    } catch (e) {
      this.toast('ETF data fetch failed — using pre-computed parameters', 'info');
    }
  },

  // ── Init ──────────────────────────────────────────────
  async init() {
    // Load settings
    this.state.settings = Config.load();

    // Bind nav items
    document.querySelectorAll('[data-view]').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        this.navigate(el.dataset.view);
      });
    });

    // Settings modal
    document.getElementById('settingsBtn').addEventListener('click', () => this.openSettings());
    document.getElementById('closeSettings').addEventListener('click',  () => this.closeSettings());
    document.getElementById('closeSettings2')?.addEventListener('click', () => this.closeSettings());
    document.getElementById('saveSettings').addEventListener('click',   () => this.saveSettings());
    document.getElementById('settingsModal').addEventListener('click',  e => {
      if (e.target === document.getElementById('settingsModal')) this.closeSettings();
    });

    // Load ETF data (non-blocking)
    await this.loadETFData();

    // Hide loading, show initial view
    const ls = document.getElementById('loadingScreen');
    if (ls) ls.remove();

    this.navigate('chat');
  },
};

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
