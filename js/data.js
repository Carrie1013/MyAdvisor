/* =========================================================
   data.js — Static portfolio data, ETF universe, and templates
   All user profile / historical ratios are simulated.
   ETF parameters are approximate 2019-2024 actuals (overridden
   by real Yahoo Finance data when available).
   ========================================================= */

// ── Client Portfolio (simulated user data) ────────────────
const DATA = {

  CLIENT: {
    portfolio_id:  'CLIENT_A_2026',
    client_name:   'Carrie Feng',
    risk_profile:  'Moderate Growth',
    risk_score:    6,          // 1-10
    time_horizon:  'Long-term (10+ years)',
    tax_bracket:   0.28,       // Marginal tax rate
    account_types: ['Taxable', 'Traditional IRA', '401(k)'],
    total_value:   1_500_000,
    valuation_date:'2026-02-28',
    asset_allocation: { equity: 0.72, fixed_income: 0.15, cash: 0.05, alternatives: 0.08 },

    holdings: [
      { ticker:'AAPL',     name:'Apple Inc.',                    asset_class:'equity',       sector:'Technology',       geography:'US',        weight:0.14, cost_basis:155.20, purchased:'2023-01-15', credit_rating:null,   value:210000 },
      { ticker:'MSFT',     name:'Microsoft Corporation',          asset_class:'equity',       sector:'Technology',       geography:'US',        weight:0.09, cost_basis:310.50, purchased:'2023-03-10', credit_rating:null,   value:135000 },
      { ticker:'GOOGL',    name:'Alphabet Inc.',                  asset_class:'equity',       sector:'Technology',       geography:'US',        weight:0.07, cost_basis:138.00, purchased:'2023-05-20', credit_rating:null,   value:105000 },
      { ticker:'JPM',      name:'JPMorgan Chase & Co.',           asset_class:'equity',       sector:'Financials',       geography:'US',        weight:0.06, cost_basis:162.30, purchased:'2022-11-08', credit_rating:null,   value:90000  },
      { ticker:'JNJ',      name:'Johnson & Johnson',              asset_class:'equity',       sector:'Healthcare',       geography:'US',        weight:0.05, cost_basis:168.70, purchased:'2022-08-22', credit_rating:null,   value:75000  },
      { ticker:'NESN.SW',  name:'Nestle S.A.',                    asset_class:'equity',       sector:'Consumer Staples', geography:'International', weight:0.05, cost_basis:112.40, purchased:'2023-02-14', credit_rating:null, value:75000 },
      { ticker:'ASML',     name:'ASML Holding N.V.',              asset_class:'equity',       sector:'Technology',       geography:'International', weight:0.05, cost_basis:680.00, purchased:'2023-04-05', credit_rating:null, value:75000 },
      { ticker:'BRK-B',    name:'Berkshire Hathaway Inc.',        asset_class:'equity',       sector:'Financials',       geography:'US',        weight:0.04, cost_basis:325.00, purchased:'2022-12-01', credit_rating:null,   value:60000  },
      { ticker:'XOM',      name:'Exxon Mobil Corporation',        asset_class:'equity',       sector:'Energy',           geography:'US',        weight:0.04, cost_basis:113.50, purchased:'2023-01-28', credit_rating:null,   value:60000  },
      { ticker:'PG',       name:'Procter & Gamble Co.',           asset_class:'equity',       sector:'Consumer Staples', geography:'US',        weight:0.04, cost_basis:145.80, purchased:'2023-06-12', credit_rating:null,   value:60000  },
      { ticker:'VWO',      name:'Vanguard FTSE Emerging Markets ETF', asset_class:'equity',  sector:'Diversified',      geography:'Emerging',  weight:0.04, cost_basis:42.20,  purchased:'2023-07-01', credit_rating:null,   value:60000  },
      { ticker:'BOND_10Y', name:'US Treasury 10-Year Bond',       asset_class:'fixed_income', sector:'Government',      geography:'US',        weight:0.10, cost_basis:100.00, purchased:'2023-01-01', credit_rating:'AAA',  value:150000 },
      { ticker:'HYG',      name:'iShares High Yield Corporate Bond ETF', asset_class:'fixed_income', sector:'Corporate', geography:'US',       weight:0.05, cost_basis:77.80,  purchased:'2023-09-15', credit_rating:'BB',   value:75000  },
      { ticker:'CASH',     name:'Cash & Money Market',            asset_class:'cash',          sector:'Cash',            geography:'US',        weight:0.05, cost_basis:1.00,   purchased:'2026-01-01', credit_rating:null,   value:75000  },
      { ticker:'GLD',      name:'SPDR Gold Shares',               asset_class:'alternatives',  sector:'Commodities',     geography:'Global',    weight:0.08, cost_basis:178.50, purchased:'2023-02-28', credit_rating:null,   value:120000 },
    ],

    sector_breakdown: {
      Technology:       0.35,
      Financials:       0.10,
      Healthcare:       0.05,
      'Consumer Staples': 0.09,
      Energy:           0.04,
      Diversified:      0.04,
      'Govt Bonds':     0.10,
      'Corp Bonds':     0.05,
      Cash:             0.05,
      Commodities:      0.08,
    },

    // Simulated historical weights (monthly snapshots, 12 months)
    historical_weights: {
      dates: ['2025-03','2025-04','2025-05','2025-06','2025-07','2025-08','2025-09','2025-10','2025-11','2025-12','2026-01','2026-02'],
      equity:        [0.68, 0.69, 0.70, 0.71, 0.72, 0.72, 0.71, 0.72, 0.73, 0.74, 0.73, 0.72],
      fixed_income:  [0.17, 0.17, 0.16, 0.16, 0.15, 0.15, 0.15, 0.15, 0.14, 0.14, 0.15, 0.15],
      cash:          [0.07, 0.06, 0.06, 0.05, 0.05, 0.05, 0.06, 0.05, 0.05, 0.05, 0.05, 0.05],
      alternatives:  [0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.07, 0.07, 0.08],
    },

    // Simulated monthly portfolio returns (2025)
    monthly_returns: {
      dates:    ['2025-03','2025-04','2025-05','2025-06','2025-07','2025-08','2025-09','2025-10','2025-11','2025-12','2026-01','2026-02'],
      portfolio:[0.024, -0.018, 0.031, 0.028, 0.042, -0.012, 0.019, 0.033, 0.025, 0.031, -0.008, 0.014],
      benchmark:[0.021, -0.022, 0.027, 0.031, 0.038, -0.015, 0.022, 0.029, 0.020, 0.028, -0.011, 0.012],
    },
  },

  // ── Investment Rules (mirror of criteria/investment_rules.json) ──────
  RULES: [
    { rule_id:'R001', rule_name:'Single Position Concentration',    metric:'max_single_weight',                        threshold:0.10, operator:'<=', severity:'FAIL',    category:'concentration' },
    { rule_id:'R002', rule_name:'Top 5 Holdings Concentration',     metric:'top5_combined_weight',                     threshold:0.40, operator:'<=', severity:'WARNING', category:'concentration' },
    { rule_id:'R003', rule_name:'Equity Allocation Maximum',        metric:'equity_weight',                            threshold:0.80, operator:'<=', severity:'FAIL',    category:'asset_allocation' },
    { rule_id:'R004', rule_name:'Minimum Fixed Income Allocation',  metric:'fixed_income_weight',                      threshold:0.10, operator:'>=', severity:'FAIL',    category:'asset_allocation' },
    { rule_id:'R005', rule_name:'Single Sector Concentration',      metric:'max_sector_weight',                        threshold:0.30, operator:'<=', severity:'WARNING', category:'sector_diversification' },
    { rule_id:'R006', rule_name:'Geographic Diversification',       metric:'domestic_equity_ratio',                    threshold:0.70, operator:'<=', severity:'WARNING', category:'geographic_diversification' },
    { rule_id:'R007', rule_name:'Minimum Cash Buffer',              metric:'cash_weight',                              threshold:0.02, operator:'>=', severity:'FAIL',    category:'liquidity' },
    { rule_id:'R008', rule_name:'Alternative Investment Cap',       metric:'alternatives_weight',                      threshold:0.15, operator:'<=', severity:'WARNING', category:'asset_allocation' },
    { rule_id:'R009', rule_name:'Low-rated Bond Restriction',       metric:'high_yield_ratio_of_fixed_income',         threshold:0.10, operator:'<=', severity:'FAIL',    category:'credit_quality' },
    { rule_id:'R010', rule_name:'Minimum Equity Holdings Count',    metric:'distinct_equity_holdings_count',           threshold:10,   operator:'>=', severity:'WARNING', category:'diversification' },
  ],

  // ── ETF Universe (for optimizer) ──────────────────────────────────────
  // mu/sigma are approximate 2019-2024 actuals; overridden by real data
  ETF_UNIVERSE: [
    // US Equity
    { ticker:'VTI',   name:'Vanguard Total Stock Market ETF',      category:'US Equity',     mu:0.142, sigma:0.182, dividendYield:0.013, turnover:0.03, taxScore:94, qualified:true  },
    { ticker:'VOO',   name:'Vanguard S&P 500 ETF',                 category:'US Equity',     mu:0.145, sigma:0.180, dividendYield:0.015, turnover:0.03, taxScore:94, qualified:true  },
    { ticker:'VTV',   name:'Vanguard Value ETF',                   category:'US Equity',     mu:0.118, sigma:0.175, dividendYield:0.025, turnover:0.05, taxScore:91, qualified:true  },
    { ticker:'VUG',   name:'Vanguard Growth ETF',                  category:'US Equity',     mu:0.165, sigma:0.198, dividendYield:0.006, turnover:0.07, taxScore:93, qualified:true  },
    { ticker:'VXF',   name:'Vanguard Extended Market ETF',         category:'US Equity',     mu:0.131, sigma:0.215, dividendYield:0.014, turnover:0.08, taxScore:91, qualified:true  },
    { ticker:'QQQ',   name:'Invesco QQQ Trust (NASDAQ-100)',        category:'US Equity',     mu:0.215, sigma:0.238, dividendYield:0.006, turnover:0.08, taxScore:90, qualified:true  },
    // International Equity
    { ticker:'VXUS',  name:'Vanguard Total International Stock ETF',category:'Intl Equity',  mu:0.075, sigma:0.175, dividendYield:0.028, turnover:0.04, taxScore:80, qualified:false },
    { ticker:'VEA',   name:'Vanguard FTSE Developed Markets ETF',  category:'Intl Equity',   mu:0.072, sigma:0.168, dividendYield:0.031, turnover:0.04, taxScore:78, qualified:false },
    { ticker:'VWO',   name:'Vanguard FTSE Emerging Markets ETF',   category:'Intl Equity',   mu:0.052, sigma:0.210, dividendYield:0.034, turnover:0.06, taxScore:75, qualified:false },
    // Fixed Income
    { ticker:'BND',   name:'Vanguard Total Bond Market ETF',       category:'US Bond',       mu:0.023, sigma:0.048, dividendYield:0.038, turnover:0.60, taxScore:62, qualified:false },
    { ticker:'AGG',   name:'iShares Core U.S. Aggregate Bond ETF', category:'US Bond',       mu:0.022, sigma:0.046, dividendYield:0.035, turnover:0.40, taxScore:65, qualified:false },
    { ticker:'BSV',   name:'Vanguard Short-Term Bond ETF',         category:'US Bond',       mu:0.028, sigma:0.022, dividendYield:0.042, turnover:0.60, taxScore:60, qualified:false },
    { ticker:'TLT',   name:'iShares 20+ Year Treasury Bond ETF',   category:'US Bond',       mu:0.008, sigma:0.145, dividendYield:0.035, turnover:0.20, taxScore:68, qualified:false },
    { ticker:'BNDX',  name:'Vanguard Total International Bond ETF',category:'Intl Bond',     mu:0.015, sigma:0.055, dividendYield:0.028, turnover:0.50, taxScore:63, qualified:false },
    // Alternatives
    { ticker:'GLD',   name:'SPDR Gold Shares',                     category:'Commodities',   mu:0.108, sigma:0.155, dividendYield:0.000, turnover:0.00, taxScore:72, qualified:false },
    { ticker:'VNQ',   name:'Vanguard Real Estate ETF',             category:'Real Estate',   mu:0.095, sigma:0.208, dividendYield:0.042, turnover:0.10, taxScore:48, qualified:false },
  ],

  // Pre-computed correlation matrix for the 16 ETFs above
  // Order: VTI VOO VTV VUG VXF QQQ VXUS VEA VWO BND AGG BSV TLT BNDX GLD VNQ
  ETF_CORR: [
    //VTI  VOO   VTV   VUG   VXF   QQQ   VXUS  VEA   VWO   BND   AGG   BSV   TLT   BNDX  GLD   VNQ
    [1.00, 0.99, 0.92, 0.96, 0.96, 0.89, 0.82, 0.81, 0.72, -0.08,-0.07,-0.06,-0.25,-0.05, 0.03, 0.72],
    [0.99, 1.00, 0.92, 0.96, 0.95, 0.89, 0.81, 0.80, 0.71, -0.08,-0.07,-0.06,-0.25,-0.05, 0.03, 0.71],
    [0.92, 0.92, 1.00, 0.80, 0.85, 0.76, 0.77, 0.76, 0.67, -0.05,-0.04,-0.04,-0.22,-0.04, 0.02, 0.73],
    [0.96, 0.96, 0.80, 1.00, 0.91, 0.96, 0.78, 0.77, 0.69, -0.10,-0.09,-0.07,-0.28,-0.06, 0.03, 0.66],
    [0.96, 0.95, 0.85, 0.91, 1.00, 0.87, 0.80, 0.79, 0.72, -0.08,-0.07,-0.06,-0.24,-0.04, 0.03, 0.68],
    [0.89, 0.89, 0.76, 0.96, 0.87, 1.00, 0.74, 0.73, 0.66, -0.11,-0.10,-0.08,-0.30,-0.07, 0.01, 0.62],
    [0.82, 0.81, 0.77, 0.78, 0.80, 0.74, 1.00, 0.97, 0.88, -0.05,-0.04,-0.03,-0.18,-0.01, 0.07, 0.65],
    [0.81, 0.80, 0.76, 0.77, 0.79, 0.73, 0.97, 1.00, 0.86, -0.05,-0.04,-0.03,-0.17,-0.01, 0.07, 0.64],
    [0.72, 0.71, 0.67, 0.69, 0.72, 0.66, 0.88, 0.86, 1.00, -0.08,-0.07,-0.05,-0.22, 0.01, 0.10, 0.58],
    [-0.08,-0.08,-0.05,-0.10,-0.08,-0.11,-0.05,-0.05,-0.08, 1.00, 0.97, 0.85, 0.78, 0.65, 0.12,-0.03],
    [-0.07,-0.07,-0.04,-0.09,-0.07,-0.10,-0.04,-0.04,-0.07, 0.97, 1.00, 0.87, 0.78, 0.66, 0.11,-0.02],
    [-0.06,-0.06,-0.04,-0.07,-0.06,-0.08,-0.03,-0.03,-0.05, 0.85, 0.87, 1.00, 0.58, 0.62, 0.08,-0.02],
    [-0.25,-0.25,-0.22,-0.28,-0.24,-0.30,-0.18,-0.17,-0.22, 0.78, 0.78, 0.58, 1.00, 0.48, 0.18,-0.15],
    [-0.05,-0.05,-0.04,-0.06,-0.04,-0.07,-0.01,-0.01, 0.01, 0.65, 0.66, 0.62, 0.48, 1.00, 0.10,-0.02],
    [0.03, 0.03, 0.02, 0.03, 0.03, 0.01, 0.07, 0.07, 0.10, 0.12, 0.11, 0.08, 0.18, 0.10, 1.00, 0.04],
    [0.72, 0.71, 0.73, 0.66, 0.68, 0.62, 0.65, 0.64, 0.58,-0.03,-0.02,-0.02,-0.15,-0.02, 0.04, 1.00],
  ],

  // Tax-loss harvesting substitutes (avoid wash-sale rule)
  TLH_PAIRS: {
    'VTI':  ['ITOT','SCHB','IVV'],
    'VOO':  ['IVV','SPY','SCHX'],
    'VTV':  ['IWD','SCHV'],
    'VUG':  ['IWF','SCHG'],
    'VXUS': ['IXUS','CWI'],
    'VEA':  ['EFA','SCHF'],
    'VWO':  ['EEM','IEMG'],
    'BND':  ['AGG','SCHZ'],
    'AGG':  ['BND','SCHZ'],
    'TLT':  ['VGLT','EDV'],
    'BSV':  ['SHV','VGSH'],
    'GLD':  ['IAU','SGOL'],
    'VNQ':  ['IYR','SCHH'],
    'QQQ':  ['ONEQ','QQQM'],
  },

  // ── Portfolio Recommendation Templates ───────────────────────────────
  PORTFOLIO_TEMPLATES: {
    // ── US Core ──────────────────────────────────────────────────────
    us_20_80: {
      id: 'us_20_80', group: 'US Core',
      name: 'U.S. Core ETF 20/80',
      description: 'Designed for investors focusing on capital preservation with modest growth expectations.',
      equityPct: 20, bondPct: 80, riskLevel: 1,
      holdings: [
        { ticker:'VTI',  weight:0.10, name:'Vanguard Total Stock Market ETF' },
        { ticker:'VTV',  weight:0.06, name:'Vanguard Value ETF' },
        { ticker:'VUG',  weight:0.04, name:'Vanguard Growth ETF' },
        { ticker:'BND',  weight:0.48, name:'Vanguard Total Bond Market ETF' },
        { ticker:'AGG',  weight:0.20, name:'iShares Core U.S. Aggregate Bond ETF' },
        { ticker:'BSV',  weight:0.12, name:'Vanguard Short-Term Bond ETF' },
      ],
    },
    us_40_60: {
      id: 'us_40_60', group: 'US Core',
      name: 'U.S. Core ETF 40/60',
      description: 'Designed for investors seeking moderate growth and capital preservation.',
      equityPct: 40, bondPct: 60, riskLevel: 2,
      holdings: [
        { ticker:'VTI',  weight:0.22, name:'Vanguard Total Stock Market ETF' },
        { ticker:'VTV',  weight:0.10, name:'Vanguard Value ETF' },
        { ticker:'VUG',  weight:0.08, name:'Vanguard Growth ETF' },
        { ticker:'BND',  weight:0.35, name:'Vanguard Total Bond Market ETF' },
        { ticker:'AGG',  weight:0.15, name:'iShares Core U.S. Aggregate Bond ETF' },
        { ticker:'BSV',  weight:0.10, name:'Vanguard Short-Term Bond ETF' },
      ],
    },
    us_60_40: {
      id: 'us_60_40', group: 'US Core',
      name: 'U.S. Core ETF 60/40',
      description: 'Designed for investors seeking long-term growth balanced with capital preservation.',
      equityPct: 60, bondPct: 40, riskLevel: 3,
      holdings: [
        { ticker:'VTI',  weight:0.30, name:'Vanguard Total Stock Market ETF' },
        { ticker:'VTV',  weight:0.15, name:'Vanguard Value ETF' },
        { ticker:'VUG',  weight:0.10, name:'Vanguard Growth ETF' },
        { ticker:'VXF',  weight:0.05, name:'Vanguard Extended Market ETF' },
        { ticker:'BND',  weight:0.25, name:'Vanguard Total Bond Market ETF' },
        { ticker:'AGG',  weight:0.10, name:'iShares Core U.S. Aggregate Bond ETF' },
        { ticker:'BSV',  weight:0.05, name:'Vanguard Short-Term Bond ETF' },
      ],
    },
    us_75_25: {
      id: 'us_75_25', group: 'US Core',
      name: 'U.S. Core ETF 75/25',
      description: 'Designed for investors pursuing long-term capital growth with a secondary focus on capital preservation.',
      equityPct: 75, bondPct: 25, riskLevel: 4,
      holdings: [
        { ticker:'VTI',  weight:0.38, name:'Vanguard Total Stock Market ETF' },
        { ticker:'VTV',  weight:0.18, name:'Vanguard Value ETF' },
        { ticker:'VUG',  weight:0.12, name:'Vanguard Growth ETF' },
        { ticker:'VXF',  weight:0.07, name:'Vanguard Extended Market ETF' },
        { ticker:'BND',  weight:0.15, name:'Vanguard Total Bond Market ETF' },
        { ticker:'AGG',  weight:0.07, name:'iShares Core U.S. Aggregate Bond ETF' },
        { ticker:'BSV',  weight:0.03, name:'Vanguard Short-Term Bond ETF' },
      ],
    },
    us_90_10: {
      id: 'us_90_10', group: 'US Core',
      name: 'U.S. Core ETF 90/10',
      description: 'Designed for investors focusing on long-term capital growth.',
      equityPct: 90, bondPct: 10, riskLevel: 5,
      holdings: [
        { ticker:'VTI',  weight:0.46, name:'Vanguard Total Stock Market ETF' },
        { ticker:'VTV',  weight:0.20, name:'Vanguard Value ETF' },
        { ticker:'VUG',  weight:0.15, name:'Vanguard Growth ETF' },
        { ticker:'VXF',  weight:0.09, name:'Vanguard Extended Market ETF' },
        { ticker:'BND',  weight:0.07, name:'Vanguard Total Bond Market ETF' },
        { ticker:'AGG',  weight:0.03, name:'iShares Core U.S. Aggregate Bond ETF' },
      ],
    },
    us_100_0: {
      id: 'us_100_0', group: 'US Core',
      name: 'U.S. Core ETF 100/0',
      description: 'Designed for investors seeking to capture the growth of equity markets over the long term.',
      equityPct: 100, bondPct: 0, riskLevel: 6,
      holdings: [
        { ticker:'VTI',  weight:0.55, name:'Vanguard Total Stock Market ETF' },
        { ticker:'VTV',  weight:0.22, name:'Vanguard Value ETF' },
        { ticker:'VUG',  weight:0.15, name:'Vanguard Growth ETF' },
        { ticker:'VXF',  weight:0.08, name:'Vanguard Extended Market ETF' },
      ],
    },
    // ── International Core ───────────────────────────────────────────
    intl_60_40: {
      id: 'intl_60_40', group: 'International Core',
      name: 'International Core ETF 60/40',
      description: 'Global diversification with developed and emerging markets, balanced with international bonds.',
      equityPct: 60, bondPct: 40, riskLevel: 3,
      holdings: [
        { ticker:'VXUS', weight:0.30, name:'Vanguard Total International Stock ETF' },
        { ticker:'VEA',  weight:0.18, name:'Vanguard FTSE Developed Markets ETF' },
        { ticker:'VWO',  weight:0.12, name:'Vanguard FTSE Emerging Markets ETF' },
        { ticker:'BNDX', weight:0.25, name:'Vanguard Total International Bond ETF' },
        { ticker:'AGG',  weight:0.15, name:'iShares Core U.S. Aggregate Bond ETF' },
      ],
    },
    // ── Combined Core ────────────────────────────────────────────────
    combined_60_40: {
      id: 'combined_60_40', group: 'Combined Core',
      name: 'Combined Core ETF 60/40',
      description: 'Full-spectrum global portfolio blending US and international equity with diversified fixed income.',
      equityPct: 60, bondPct: 40, riskLevel: 3,
      holdings: [
        { ticker:'VTI',  weight:0.22, name:'Vanguard Total Stock Market ETF' },
        { ticker:'VXUS', weight:0.18, name:'Vanguard Total International Stock ETF' },
        { ticker:'VTV',  weight:0.10, name:'Vanguard Value ETF' },
        { ticker:'VEA',  weight:0.10, name:'Vanguard FTSE Developed Markets ETF' },
        { ticker:'BND',  weight:0.20, name:'Vanguard Total Bond Market ETF' },
        { ticker:'BNDX', weight:0.10, name:'Vanguard Total International Bond ETF' },
        { ticker:'BSV',  weight:0.05, name:'Vanguard Short-Term Bond ETF' },
        { ticker:'GLD',  weight:0.05, name:'SPDR Gold Shares' },
      ],
    },
  },

  // ── Target portfolio weights for rebalancing demo ──────────────────
  TARGET_WEIGHTS: {
    'VTI':   0.28,
    'VXUS':  0.12,
    'BND':   0.20,
    'AGG':   0.10,
    'GLD':   0.05,
    'VNQ':   0.05,
    'QQQ':   0.10,
    'CASH':  0.05,
    'BSV':   0.05,
  },
  // Simulated current weights (drifted from market)
  CURRENT_WEIGHTS: {
    'VTI':   0.32,
    'VXUS':  0.10,
    'BND':   0.16,
    'AGG':   0.09,
    'GLD':   0.07,
    'VNQ':   0.04,
    'QQQ':   0.14,
    'CASH':  0.05,
    'BSV':   0.03,
  },
};
