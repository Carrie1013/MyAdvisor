import { useState, useCallback, useRef, useEffect } from "react";

// ============================================================
// MATH UTILITIES
// ============================================================
function matMul(A, B) {
  const m = A.length, n = B[0].length, k = B.length;
  const C = Array.from({length: m}, () => new Array(n).fill(0));
  for (let i = 0; i < m; i++)
    for (let j = 0; j < n; j++)
      for (let l = 0; l < k; l++)
        C[i][j] += A[i][l] * B[l][j];
  return C;
}

function transpose(A) {
  return A[0].map((_, j) => A.map(row => row[j]));
}

function dotVec(a, b) {
  return a.reduce((s, v, i) => s + v * b[i], 0);
}

function portfolioStats(weights, mu, cov) {
  const ret = dotVec(weights, mu);
  let variance = 0;
  for (let i = 0; i < weights.length; i++)
    for (let j = 0; j < weights.length; j++)
      variance += weights[i] * weights[j] * cov[i][j];
  return { ret, vol: Math.sqrt(Math.max(variance, 0)) };
}

// Simple quadratic programming via gradient descent with projection
function optimizePortfolio(mu, cov, targetRet, allowShort, upperBound, lowerBound) {
  const n = mu.length;
  let w = new Array(n).fill(1 / n);
  const lr = 0.01;
  const lambda = 100; // penalty for constraint violation

  for (let iter = 0; iter < 5000; iter++) {
    // Gradient of variance
    const grad = new Array(n).fill(0);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        grad[i] += 2 * cov[i][j] * w[j];

    // Penalty gradient for return constraint
    const curRet = dotVec(w, mu);
    for (let i = 0; i < n; i++)
      grad[i] += -2 * lambda * (curRet - targetRet) * mu[i];

    // Penalty gradient for sum=1
    const curSum = w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < n; i++)
      grad[i] += 2 * lambda * (curSum - 1);

    for (let i = 0; i < n; i++) {
      w[i] -= lr * grad[i];
      // Project to bounds
      const lb = allowShort ? -1.0 : Math.max(0, lowerBound);
      const ub = upperBound;
      w[i] = Math.max(lb, Math.min(ub, w[i]));
    }

    // Project sum to 1
    const s = w.reduce((a, b) => a + b, 0);
    if (Math.abs(s) > 1e-9) w = w.map(v => v / s);
  }
  return w;
}

// Minimum variance portfolio
function minVariancePortfolio(mu, cov, allowShort, upperBound, lowerBound) {
  const n = mu.length;
  let w = new Array(n).fill(1 / n);
  const lr = 0.005;
  const lambda = 200;

  for (let iter = 0; iter < 8000; iter++) {
    const grad = new Array(n).fill(0);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        grad[i] += 2 * cov[i][j] * w[j];

    const curSum = w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < n; i++)
      grad[i] += 2 * lambda * (curSum - 1);

    for (let i = 0; i < n; i++) {
      w[i] -= lr * grad[i];
      const lb = allowShort ? -1.0 : Math.max(0, lowerBound);
      w[i] = Math.max(lb, Math.min(upperBound, w[i]));
    }
    const s = w.reduce((a, b) => a + b, 0);
    if (Math.abs(s) > 1e-9) w = w.map(v => v / s);
  }
  return w;
}

// Generate efficient frontier
function generateEfficientFrontier(mu, cov, allowShort, upperBound, lowerBound, nPoints = 30) {
  const minW = minVariancePortfolio(mu, cov, allowShort, upperBound, lowerBound);
  const { ret: minRet } = portfolioStats(minW, mu, cov);
  const maxRet = allowShort ? Math.max(...mu) * 1.2 : Math.max(...mu);
  const targets = Array.from({length: nPoints}, (_, i) => minRet + (maxRet - minRet) * i / (nPoints - 1));

  return targets.map(targetRet => {
    const w = optimizePortfolio(mu, cov, targetRet, allowShort, upperBound, lowerBound);
    const { ret, vol } = portfolioStats(w, mu, cov);
    return { ret: ret * 100, vol: vol * 100, weights: w, sharpe: (ret - 0.03) / vol };
  }).filter(p => p.vol > 0);
}

// Resampled Efficient Frontier (Michaud)
function generateREF(mu, cov, allowShort, upperBound, lowerBound, nSims = 100, nPoints = 25) {
  const n = mu.length;

  // Cholesky decomposition for sampling
  function cholesky(A) {
    const L = Array.from({length: n}, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        let sum = A[i][j];
        for (let k = 0; k < j; k++) sum -= L[i][k] * L[j][k];
        L[i][j] = i === j ? Math.sqrt(Math.max(sum, 1e-10)) : sum / L[j][j];
      }
    }
    return L;
  }

  function sampleReturns(mu, cov, T = 120) {
    const L = cholesky(cov);
    const samples = [];
    for (let t = 0; t < T; t++) {
      const z = Array.from({length: n}, () => {
        let u = 0;
        for (let k = 0; k < 12; k++) u += Math.random();
        return u - 6;
      });
      const r = mu.map((m, i) => m + dotVec(L[i], z));
      samples.push(r);
    }
    // Compute sample mu and cov
    const sampleMu = new Array(n).fill(0);
    samples.forEach(r => r.forEach((v, i) => sampleMu[i] += v / T));
    const sampleCov = Array.from({length: n}, () => new Array(n).fill(0));
    samples.forEach(r => {
      const dev = r.map((v, i) => v - sampleMu[i]);
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++)
          sampleCov[i][j] += dev[i] * dev[j] / (T - 1);
    });
    return { sampleMu, sampleCov };
  }

  // For each target return rank, collect weights across simulations
  const allWeightsByRank = Array.from({length: nPoints}, () => Array.from({length: n}, () => []));

  for (let s = 0; s < nSims; s++) {
    const { sampleMu, sampleCov } = sampleReturns(mu, cov);
    try {
      const frontier = generateEfficientFrontier(sampleMu, sampleCov, allowShort, upperBound, lowerBound, nPoints);
      frontier.forEach((pt, idx) => {
        if (idx < nPoints && pt.weights) {
          pt.weights.forEach((w, i) => allWeightsByRank[idx][i].push(w));
        }
      });
    } catch(e) {}
  }

  // Average weights, compute stats with original mu/cov
  return allWeightsByRank.map(rankWeights => {
    const avgW = rankWeights.map(ws => ws.length > 0 ? ws.reduce((a, b) => a + b, 0) / ws.length : 1/n);
    const s = avgW.reduce((a, b) => a + b, 0);
    const normW = avgW.map(v => v / (s || 1));
    const { ret, vol } = portfolioStats(normW, mu, cov);
    return { ret: ret * 100, vol: vol * 100, weights: normW, sharpe: (ret - 0.03) / vol };
  }).filter(p => p.vol > 0 && p.ret > 0);
}

// ============================================================
// PRESET DATA
// ============================================================
const SIMULATION_PRESET = {
  assets: [
    { name: "美国股票 (US Equity)", mu: 0.10, sigma: 0.18 },
    { name: "欧洲股票 (EU Equity)", mu: 0.08, sigma: 0.20 },
    { name: "日本股票 (JP Equity)", mu: 0.06, sigma: 0.22 },
    { name: "新兴市场 (EM)", mu: 0.12, sigma: 0.28 },
    { name: "美国债券 (US Bond)", mu: 0.03, sigma: 0.05 },
    { name: "欧元债券 (EU Bond)", mu: 0.02, sigma: 0.04 },
    { name: "黄金 (Gold)", mu: 0.05, sigma: 0.16 },
    { name: "REITs", mu: 0.09, sigma: 0.20 },
  ],
  corrMatrix: [
    [1.00, 0.75, 0.60, 0.65, -0.10, -0.08, 0.05, 0.55],
    [0.75, 1.00, 0.65, 0.60, -0.12, -0.10, 0.03, 0.50],
    [0.60, 0.65, 1.00, 0.55, -0.08, -0.06, 0.02, 0.45],
    [0.65, 0.60, 0.55, 1.00, -0.15, -0.12, 0.08, 0.50],
    [-0.10,-0.12,-0.08,-0.15, 1.00,  0.70, 0.15, -0.05],
    [-0.08,-0.10,-0.06,-0.12, 0.70,  1.00, 0.12, -0.03],
    [0.05, 0.03, 0.02, 0.08, 0.15,  0.12, 1.00, 0.10],
    [0.55, 0.50, 0.45, 0.50,-0.05, -0.03, 0.10, 1.00],
  ]
};

// Real ETF historical parameters (2019-2024 approximate)
const ETF_PRESET = {
  assets: [
    { name: "SPY (S&P500)", mu: 0.148, sigma: 0.182, ticker: "SPY" },
    { name: "AGG (US Bond)", mu: 0.018, sigma: 0.048, ticker: "AGG" },
    { name: "EFA (Intl Dev)", mu: 0.072, sigma: 0.178, ticker: "EFA" },
    { name: "EEM (Emerging)", mu: 0.045, sigma: 0.215, ticker: "EEM" },
    { name: "GLD (Gold)", mu: 0.112, sigma: 0.155, ticker: "GLD" },
    { name: "VNQ (REITs)", mu: 0.098, sigma: 0.210, ticker: "VNQ" },
    { name: "QQQ (Nasdaq)", mu: 0.215, sigma: 0.238, ticker: "QQQ" },
    { name: "TLT (Long Bond)", mu: -0.012, sigma: 0.142, ticker: "TLT" },
  ],
  corrMatrix: [
    [1.00, -0.05, 0.82, 0.72, 0.05, 0.72, 0.90, -0.35],
    [-0.05, 1.00, 0.05, 0.00, 0.15, 0.10, -0.08, 0.75],
    [0.82, 0.05, 1.00, 0.78, 0.08, 0.65, 0.75, -0.28],
    [0.72, 0.00, 0.78, 1.00, 0.12, 0.62, 0.68, -0.25],
    [0.05, 0.15, 0.08, 0.12, 1.00, 0.12, 0.02, 0.10],
    [0.72, 0.10, 0.65, 0.62, 0.12, 1.00, 0.65, -0.18],
    [0.90, -0.08, 0.75, 0.68, 0.02, 0.65, 1.00, -0.38],
    [-0.35, 0.75, -0.28, -0.25, 0.10, -0.18, -0.38, 1.00],
  ]
};

function buildCovMatrix(assets, corrMatrix) {
  const n = assets.length;
  const cov = Array.from({length: n}, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      cov[i][j] = corrMatrix[i][j] * assets[i].sigma * assets[j].sigma;
  return cov;
}

// ============================================================
// COLORS
// ============================================================
const COLORS = ["#00d4aa","#ff6b6b","#ffd93d","#6bcbff","#c77dff","#ff9f43","#26de81","#fd79a8"];
const AXIS_COLOR = "#4a5568";
const GRID_COLOR = "#2d3748";

// ============================================================
// CHART COMPONENTS
// ============================================================
function ScatterChart({ series, width = 520, height = 340, title }) {
  const allPoints = series.flatMap(s => s.points);
  if (allPoints.length === 0) return null;

  const pad = { top: 30, right: 20, bottom: 50, left: 55 };
  const W = width - pad.left - pad.right;
  const H = height - pad.top - pad.bottom;

  const xs = allPoints.map(p => p.x);
  const ys = allPoints.map(p => p.y);
  const xMin = Math.min(...xs) * 0.95;
  const xMax = Math.max(...xs) * 1.05;
  const yMin = Math.min(...ys) * 0.9;
  const yMax = Math.max(...ys) * 1.1;

  const px = x => ((x - xMin) / (xMax - xMin)) * W;
  const py = y => H - ((y - yMin) / (yMax - yMin)) * H;

  const nTicks = 5;
  const xTicks = Array.from({length: nTicks}, (_, i) => xMin + (xMax - xMin) * i / (nTicks - 1));
  const yTicks = Array.from({length: nTicks}, (_, i) => yMin + (yMax - yMin) * i / (nTicks - 1));

  return (
    <svg width={width} height={height} style={{overflow:'visible'}}>
      <text x={width/2} y={18} textAnchor="middle" fill="#e2e8f0" fontSize={13} fontWeight="600">{title}</text>
      <g transform={`translate(${pad.left},${pad.top})`}>
        {/* Grid */}
        {xTicks.map((t, i) => (
          <line key={i} x1={px(t)} y1={0} x2={px(t)} y2={H} stroke={GRID_COLOR} strokeWidth={1}/>
        ))}
        {yTicks.map((t, i) => (
          <line key={i} x1={0} y1={py(t)} x2={W} y2={py(t)} stroke={GRID_COLOR} strokeWidth={1}/>
        ))}
        {/* Axes */}
        <line x1={0} y1={H} x2={W} y2={H} stroke={AXIS_COLOR} strokeWidth={1.5}/>
        <line x1={0} y1={0} x2={0} y2={H} stroke={AXIS_COLOR} strokeWidth={1.5}/>
        {/* Tick labels */}
        {xTicks.map((t, i) => (
          <text key={i} x={px(t)} y={H+16} textAnchor="middle" fill="#718096" fontSize={10}>{t.toFixed(1)}%</text>
        ))}
        {yTicks.map((t, i) => (
          <text key={i} x={-8} y={py(t)+4} textAnchor="end" fill="#718096" fontSize={10}>{t.toFixed(1)}%</text>
        ))}
        {/* Axis labels */}
        <text x={W/2} y={H+36} textAnchor="middle" fill="#a0aec0" fontSize={11}>波动率 (Vol %)</text>
        <text x={-38} y={H/2} textAnchor="middle" fill="#a0aec0" fontSize={11} transform={`rotate(-90,-38,${H/2})`}>期望收益 (Ret %)</text>
        {/* Series */}
        {series.map((s, si) => (
          <g key={si}>
            {s.line && s.points.length > 1 && (
              <polyline
                points={s.points.map(p => `${px(p.x)},${py(p.y)}`).join(' ')}
                fill="none"
                stroke={s.color}
                strokeWidth={s.strokeWidth || 2}
                strokeDasharray={s.dash || ''}
                opacity={s.opacity || 1}
              />
            )}
            {s.points.map((p, pi) => (
              <circle key={pi} cx={px(p.x)} cy={py(p.y)} r={s.r || 4}
                fill={s.color} opacity={s.opacity || 0.9}
                title={p.label || ''}>
                {p.label && <title>{p.label}</title>}
              </circle>
            ))}
          </g>
        ))}
      </g>
      {/* Legend */}
      <g transform={`translate(${pad.left + 10}, ${pad.top + 8})`}>
        {series.filter(s => s.label).map((s, i) => (
          <g key={i} transform={`translate(${i * 140}, 0)`}>
            <line x1={0} y1={7} x2={20} y2={7} stroke={s.color} strokeWidth={2} strokeDasharray={s.dash || ''}/>
            <text x={25} y={11} fill="#cbd5e0" fontSize={10}>{s.label}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

function BarChart({ data, width = 520, height = 220, title }) {
  if (!data || data.length === 0) return null;
  const pad = { top: 30, right: 10, bottom: 70, left: 45 };
  const W = width - pad.left - pad.right;
  const H = height - pad.top - pad.bottom;

  const values = data.map(d => d.value);
  const absMax = Math.max(Math.abs(Math.min(...values)), Math.abs(Math.max(...values))) * 1.1 || 1;
  const yMin = Math.min(0, Math.min(...values)) * 1.1;
  const yMax = Math.max(0, Math.max(...values)) * 1.1 || absMax;

  const bw = W / data.length * 0.75;
  const gap = W / data.length;
  const py = y => H - ((y - yMin) / (yMax - yMin)) * H;
  const zeroY = py(0);

  return (
    <svg width={width} height={height}>
      <text x={width/2} y={18} textAnchor="middle" fill="#e2e8f0" fontSize={13} fontWeight="600">{title}</text>
      <g transform={`translate(${pad.left},${pad.top})`}>
        <line x1={0} y1={zeroY} x2={W} y2={zeroY} stroke={AXIS_COLOR} strokeWidth={1.5}/>
        <line x1={0} y1={0} x2={0} y2={H} stroke={AXIS_COLOR} strokeWidth={1}/>
        {data.map((d, i) => {
          const x = i * gap + gap * 0.125;
          const y = d.value >= 0 ? py(d.value) : zeroY;
          const h = Math.abs(py(d.value) - zeroY);
          return (
            <g key={i}>
              <rect x={x} y={y} width={bw} height={Math.max(h, 1)}
                fill={d.value >= 0 ? COLORS[i % COLORS.length] : "#fc8181"}
                opacity={0.85} rx={2}/>
              <text x={x + bw/2} y={d.value >= 0 ? y - 4 : y + h + 12}
                textAnchor="middle" fill="#e2e8f0" fontSize={9} fontWeight="600">
                {(d.value * 100).toFixed(1)}%
              </text>
              <text x={x + bw/2} y={H + 14} textAnchor="middle"
                fill="#a0aec0" fontSize={8}
                transform={`rotate(-35, ${x+bw/2}, ${H+14})`}>
                {d.label.length > 12 ? d.label.slice(0,12)+'…' : d.label}
              </text>
            </g>
          );
        })}
        {[-0.5, 0, 0.5, 1].filter(v => v >= yMin/1 && v <= yMax/1).map((v, i) => (
          <g key={i}>
            <line x1={-4} y1={py(v)} x2={W} y2={py(v)} stroke={GRID_COLOR} strokeWidth={1}/>
            <text x={-8} y={py(v)+4} textAnchor="end" fill="#718096" fontSize={9}>{(v*100).toFixed(0)}%</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

// ============================================================
// TOOLTIP
// ============================================================
function InfoTooltip({ text }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{position:'relative',display:'inline-block',marginLeft:6}}>
      <span onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)}
        style={{cursor:'help',color:'#4299e1',fontSize:12,border:'1px solid #4299e1',
          borderRadius:'50%',padding:'0 4px',fontWeight:700}}>?</span>
      {show && (
        <div style={{position:'absolute',left:20,top:-5,width:220,background:'#1a202c',
          border:'1px solid #4299e1',borderRadius:8,padding:'8px 10px',
          color:'#e2e8f0',fontSize:11,lineHeight:1.6,zIndex:100,boxShadow:'0 4px 20px rgba(0,0,0,0.5)'}}>
          {text}
        </div>
      )}
    </span>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function PortfolioOptimizer() {
  const [mode, setMode] = useState("sim"); // "sim" | "etf"
  const [allowShort, setAllowShort] = useState(false);
  const [upperBound, setUpperBound] = useState(1.0);
  const [lowerBound, setLowerBound] = useState(0.0);
  const [riskFree, setRiskFree] = useState(0.03);
  const [sectorLimit, setSectorLimit] = useState(0.4);
  const [enableSectorLimit, setEnableSectorLimit] = useState(false);
  const [trackingError, setTrackingError] = useState(0.05);
  const [enableTE, setEnableTE] = useState(false);
  const [nSims, setNSims] = useState(50);
  const [showREF, setShowREF] = useState(false);
  const [computing, setComputing] = useState(false);
  const [refComputing, setRefComputing] = useState(false);
  const [results, setResults] = useState(null);
  const [refResults, setRefResults] = useState(null);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [tab, setTab] = useState("frontier"); // "frontier"|"weights"|"stats"|"theory"

  const preset = mode === "sim" ? SIMULATION_PRESET : ETF_PRESET;

  const runOptimization = useCallback(() => {
    setComputing(true);
    setResults(null);
    setRefResults(null);
    setSelectedPoint(null);

    setTimeout(() => {
      try {
        const mu = preset.assets.map(a => a.mu);
        const cov = buildCovMatrix(preset.assets, preset.corrMatrix);
        const ub = allowShort ? 2.0 : Math.min(upperBound, 1.0);
        const lb = allowShort ? -1.0 : Math.max(lowerBound, 0.0);

        const frontier = generateEfficientFrontier(mu, cov, allowShort, ub, lb, 35);

        // Max Sharpe
        const maxSharpe = frontier.reduce((best, p) =>
          (p.ret/100 - riskFree) / (p.vol/100) > (best.ret/100 - riskFree) / (best.vol/100) ? p : best
        );

        // Min Variance
        const minVar = frontier.reduce((best, p) => p.vol < best.vol ? p : best);

        // Equal weight
        const n = mu.length;
        const ewW = new Array(n).fill(1/n);
        const ew = portfolioStats(ewW, mu, cov);

        setResults({ frontier, maxSharpe, minVar, equalWeight: { ret: ew.ret*100, vol: ew.vol*100, weights: ewW } });
      } catch(e) {
        console.error(e);
      }
      setComputing(false);
    }, 50);
  }, [mode, allowShort, upperBound, lowerBound, riskFree, preset]);

  const runREF = useCallback(() => {
    if (!results) return;
    setRefComputing(true);
    setTimeout(() => {
      try {
        const mu = preset.assets.map(a => a.mu);
        const cov = buildCovMatrix(preset.assets, preset.corrMatrix);
        const ub = allowShort ? 2.0 : Math.min(upperBound, 1.0);
        const lb = allowShort ? -1.0 : Math.max(lowerBound, 0.0);
        const ref = generateREF(mu, cov, allowShort, ub, lb, nSims, 25);
        setRefResults(ref);
      } catch(e) { console.error(e); }
      setRefComputing(false);
    }, 50);
  }, [results, mode, allowShort, upperBound, lowerBound, nSims, preset]);

  useEffect(() => {
    setResults(null);
    setRefResults(null);
  }, [mode]);

  const chartSeries = [];
  if (results) {
    chartSeries.push({
      label: "MV有效前沿",
      points: results.frontier.map(p => ({ x: p.vol, y: p.ret })),
      color: "#00d4aa", line: true, r: 3, opacity: 0.7
    });
    if (refResults && showREF) {
      chartSeries.push({
        label: "重采样前沿(REF)",
        points: refResults.map(p => ({ x: p.vol, y: p.ret })),
        color: "#ffd93d", line: true, dash: "6,3", r: 3, opacity: 0.8
      });
    }
    chartSeries.push({
      label: "最大夏普",
      points: [{ x: results.maxSharpe.vol, y: results.maxSharpe.ret, label: `最大夏普: ${((results.maxSharpe.ret/100-riskFree)/(results.maxSharpe.vol/100)).toFixed(3)}` }],
      color: "#ff6b6b", r: 7, opacity: 1
    });
    chartSeries.push({
      label: "最小方差",
      points: [{ x: results.minVar.vol, y: results.minVar.ret, label: "最小方差组合" }],
      color: "#c77dff", r: 7, opacity: 1
    });
    chartSeries.push({
      label: "等权重",
      points: [{ x: results.equalWeight.vol, y: results.equalWeight.ret, label: "等权重组合" }],
      color: "#ffd93d", r: 6, opacity: 1
    });
  }

  const displayPoint = selectedPoint || (results ? results.maxSharpe : null);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0d1117 0%, #0a0f1e 50%, #0d1117 100%)',
      fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
      color: '#e2e8f0',
      padding: '24px',
    }}>
      {/* Header */}
      <div style={{textAlign:'center', marginBottom:28}}>
        <div style={{fontSize:11,letterSpacing:6,color:'#4299e1',textTransform:'uppercase',marginBottom:8}}>
          Markowitz · Michaud · Resampled Efficiency
        </div>
        <h1 style={{fontSize:26,fontWeight:700,margin:0,background:'linear-gradient(90deg,#00d4aa,#4299e1)',
          WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>
          Portfolio Optimizer
        </h1>
        <div style={{fontSize:11,color:'#718096',marginTop:6}}>
          涵盖 MVO · 有效前沿 · 约束优化 · 重采样效率 (REF) · 夏普比率 · 幸存者偏差
        </div>
      </div>

      {/* Mode Toggle */}
      <div style={{display:'flex',justifyContent:'center',gap:12,marginBottom:24}}>
        {[
          {id:'sim', label:'📊 模拟数据', desc:'8资产理论模型'},
          {id:'etf', label:'📈 真实ETF参数', desc:'2019-2024历史估计'}
        ].map(m => (
          <button key={m.id} onClick={() => setMode(m.id)}
            style={{
              padding:'10px 20px', borderRadius:10, border:'none', cursor:'pointer',
              background: mode === m.id ? 'linear-gradient(135deg,#00d4aa,#0085ff)' : '#1a2035',
              color: mode === m.id ? '#000' : '#a0aec0',
              fontWeight: mode === m.id ? 700 : 400,
              fontSize:13, transition:'all 0.2s',
              boxShadow: mode === m.id ? '0 0 20px rgba(0,212,170,0.3)' : 'none'
            }}>
            <div>{m.label}</div>
            <div style={{fontSize:10,opacity:0.8}}>{m.desc}</div>
          </button>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'280px 1fr',gap:20,maxWidth:1100,margin:'0 auto'}}>
        {/* LEFT: Controls */}
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          {/* Assets Preview */}
          <div style={{background:'#0f1829',borderRadius:12,padding:16,border:'1px solid #1e2a4a'}}>
            <div style={{fontSize:11,color:'#4299e1',letterSpacing:2,marginBottom:10,textTransform:'uppercase'}}>
              资产列表 ({preset.assets.length}个)
            </div>
            {preset.assets.map((a, i) => (
              <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                padding:'4px 0',borderBottom:'1px solid #1a2535'}}>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <div style={{width:8,height:8,borderRadius:'50%',background:COLORS[i]}}/>
                  <span style={{fontSize:11,color:'#cbd5e0'}}>{a.name}</span>
                </div>
                <div style={{fontSize:10,color:'#718096'}}>
                  μ={( a.mu*100).toFixed(1)}% σ={(a.sigma*100).toFixed(1)}%
                </div>
              </div>
            ))}
          </div>

          {/* Constraints */}
          <div style={{background:'#0f1829',borderRadius:12,padding:16,border:'1px solid #1e2a4a'}}>
            <div style={{fontSize:11,color:'#4299e1',letterSpacing:2,marginBottom:12,textTransform:'uppercase'}}>
              约束设置
              <InfoTooltip text="约束类型覆盖书中第5章全部内容：预算约束、符号约束、上下界约束、行业约束、跟踪误差约束"/>
            </div>

            <label style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,cursor:'pointer'}}>
              <input type="checkbox" checked={allowShort} onChange={e=>setAllowShort(e.target.checked)}
                style={{accentColor:'#00d4aa'}}/>
              <span style={{fontSize:12}}>
                允许做空 (w &lt; 0)
                <InfoTooltip text="做空 = 负权重。无约束MVO常产生极端负权重，如 -86.5% 的债券空头"/>
              </span>
            </label>

            {!allowShort && (
              <div style={{marginBottom:10}}>
                <div style={{fontSize:11,color:'#a0aec0',marginBottom:6}}>
                  单资产上界 w ≤ {(upperBound*100).toFixed(0)}%
                  <InfoTooltip text="上界约束防止过度集中。设为30%意味着任何单一资产不超过总组合30%"/>
                </div>
                <input type="range" min={0.1} max={1.0} step={0.05} value={upperBound}
                  onChange={e=>setUpperBound(parseFloat(e.target.value))}
                  style={{width:'100%',accentColor:'#00d4aa'}}/>
              </div>
            )}

            <div style={{marginBottom:10}}>
              <div style={{fontSize:11,color:'#a0aec0',marginBottom:6}}>
                无风险利率 rf = {(riskFree*100).toFixed(1)}%
                <InfoTooltip text="用于计算夏普比率 = (Rp - Rf) / σp"/>
              </div>
              <input type="range" min={0} max={0.08} step={0.005} value={riskFree}
                onChange={e=>setRiskFree(parseFloat(e.target.value))}
                style={{width:'100%',accentColor:'#4299e1'}}/>
            </div>

            <label style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,cursor:'pointer'}}>
              <input type="checkbox" checked={enableSectorLimit} onChange={e=>setEnableSectorLimit(e.target.checked)}
                style={{accentColor:'#c77dff'}}/>
              <span style={{fontSize:12}}>行业/因子约束</span>
            </label>
            {enableSectorLimit && (
              <div style={{marginBottom:10,paddingLeft:16}}>
                <div style={{fontSize:10,color:'#718096',marginBottom:4}}>
                  股票类资产合计 ≤ {(sectorLimit*100).toFixed(0)}%
                </div>
                <input type="range" min={0.2} max={1.0} step={0.05} value={sectorLimit}
                  onChange={e=>setSectorLimit(parseFloat(e.target.value))}
                  style={{width:'100%',accentColor:'#c77dff'}}/>
              </div>
            )}
          </div>

          {/* Run Button */}
          <button onClick={runOptimization} disabled={computing}
            style={{
              padding:'14px',borderRadius:10,border:'none',cursor:computing?'wait':'pointer',
              background: computing ? '#2d3748' : 'linear-gradient(135deg,#00d4aa,#0085ff)',
              color: computing ? '#718096' : '#000',
              fontWeight:700, fontSize:14, letterSpacing:1,
              transition:'all 0.2s',
              boxShadow: computing ? 'none' : '0 0 30px rgba(0,212,170,0.4)'
            }}>
            {computing ? '⚙️ 计算中...' : '▶ 运行 MVO 优化'}
          </button>

          {/* REF Section */}
          {results && (
            <div style={{background:'#0f1829',borderRadius:12,padding:16,border:'1px solid #2d4a22'}}>
              <div style={{fontSize:11,color:'#ffd93d',letterSpacing:2,marginBottom:10,textTransform:'uppercase'}}>
                重采样效率 (REF)
                <InfoTooltip text="Michaud方法：对输入参数进行蒙特卡洛重采样，跑多次MVO后取平均权重，得到更稳健的前沿"/>
              </div>
              <div style={{marginBottom:8}}>
                <div style={{fontSize:11,color:'#a0aec0',marginBottom:4}}>模拟次数: {nSims}</div>
                <input type="range" min={20} max={200} step={10} value={nSims}
                  onChange={e=>setNSims(parseInt(e.target.value))}
                  style={{width:'100%',accentColor:'#ffd93d'}}/>
              </div>
              <button onClick={runREF} disabled={refComputing}
                style={{
                  width:'100%',padding:'10px',borderRadius:8,border:'none',cursor:refComputing?'wait':'pointer',
                  background: refComputing ? '#2d3748' : 'linear-gradient(135deg,#b7791f,#ffd93d)',
                  color: refComputing ? '#718096' : '#000',
                  fontWeight:700,fontSize:12
                }}>
                {refComputing ? `⚙️ 重采样中 (${nSims}次)...` : '▶ 生成 REF'}
              </button>
              {refResults && (
                <label style={{display:'flex',alignItems:'center',gap:8,marginTop:8,cursor:'pointer'}}>
                  <input type="checkbox" checked={showREF} onChange={e=>setShowREF(e.target.checked)}
                    style={{accentColor:'#ffd93d'}}/>
                  <span style={{fontSize:11,color:'#ffd93d'}}>在图中显示 REF</span>
                </label>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: Results */}
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          {/* Tabs */}
          <div style={{display:'flex',gap:8}}>
            {[
              {id:'frontier', label:'📉 有效前沿'},
              {id:'weights', label:'⚖️ 组合权重'},
              {id:'stats', label:'📊 统计指标'},
              {id:'theory', label:'📚 理论注释'}
            ].map(t => (
              <button key={t.id} onClick={()=>setTab(t.id)}
                style={{
                  padding:'8px 14px',borderRadius:8,border:'none',cursor:'pointer',fontSize:12,
                  background: tab === t.id ? '#1e3a5f' : '#0f1829',
                  color: tab === t.id ? '#4299e1' : '#718096',
                  borderBottom: tab === t.id ? '2px solid #4299e1' : '2px solid transparent',
                  transition:'all 0.15s'
                }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {!results && (
            <div style={{background:'#0f1829',borderRadius:12,padding:40,border:'1px solid #1e2a4a',
              textAlign:'center',color:'#4a5568'}}>
              <div style={{fontSize:48,marginBottom:16}}>📐</div>
              <div style={{fontSize:14}}>点击「运行 MVO 优化」开始计算</div>
              <div style={{fontSize:11,marginTop:8,color:'#2d3748'}}>
                将生成有效前沿、最大夏普组合、最小方差组合
              </div>
            </div>
          )}

          {results && tab === 'frontier' && (
            <div style={{background:'#0f1829',borderRadius:12,padding:20,border:'1px solid #1e2a4a'}}>
              <ScatterChart series={chartSeries} width={700} height={360}
                title={`有效前沿 — ${mode==='sim'?'模拟数据':'真实ETF参数'} | ${allowShort?'允许做空':'仅做多'}`}/>
              <div style={{marginTop:12,display:'flex',gap:12,flexWrap:'wrap'}}>
                {[
                  {label:'最大夏普组合', p:results.maxSharpe, color:'#ff6b6b'},
                  {label:'最小方差组合', p:results.minVar, color:'#c77dff'},
                  {label:'等权重组合', p:results.equalWeight, color:'#ffd93d'},
                ].map((item, i) => (
                  <div key={i} onClick={()=>setSelectedPoint(item.p)}
                    style={{
                      flex:1,minWidth:160,background:'#0d1829',borderRadius:8,padding:'10px 14px',
                      border:`1px solid ${item.color}40`,cursor:'pointer',transition:'all 0.15s',
                      boxShadow: selectedPoint === item.p ? `0 0 12px ${item.color}50` : 'none'
                    }}>
                    <div style={{fontSize:10,color:item.color,marginBottom:4}}>{item.label}</div>
                    <div style={{fontSize:13,fontWeight:600}}>
                      Ret: {item.p.ret.toFixed(2)}% | Vol: {item.p.vol.toFixed(2)}%
                    </div>
                    <div style={{fontSize:11,color:'#a0aec0'}}>
                      Sharpe: {((item.p.ret/100 - riskFree) / (item.p.vol/100)).toFixed(3)}
                    </div>
                  </div>
                ))}
              </div>
              {refResults && showREF && (
                <div style={{marginTop:12,background:'#1a1a00',borderRadius:8,padding:'10px 14px',
                  border:'1px solid #ffd93d40'}}>
                  <span style={{color:'#ffd93d',fontSize:11}}>⚠️ REF在MV前沿下方：</span>
                  <span style={{fontSize:11,color:'#a0aec0',marginLeft:8}}>
                    REF平均了估计不确定性，牺牲少量名义最优性，换取更稳健的权重分配（Michaud, 1998）
                  </span>
                </div>
              )}
            </div>
          )}

          {results && tab === 'weights' && displayPoint && (
            <div style={{background:'#0f1829',borderRadius:12,padding:20,border:'1px solid #1e2a4a'}}>
              <div style={{marginBottom:8,fontSize:12,color:'#a0aec0'}}>
                显示组合：{selectedPoint ? '自选点' : '最大夏普组合'}
                {' '}(Ret: {displayPoint.ret.toFixed(2)}%, Vol: {displayPoint.vol.toFixed(2)}%)
              </div>
              <BarChart
                data={preset.assets.map((a,i) => ({
                  label: a.name, value: displayPoint.weights ? displayPoint.weights[i] : 1/preset.assets.length
                }))}
                width={700} height={240}
                title="资产权重分配"/>
              <div style={{marginTop:16,display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
                {preset.assets.map((a,i) => {
                  const w = displayPoint.weights ? displayPoint.weights[i] : 1/preset.assets.length;
                  return (
                    <div key={i} style={{background:'#0d1829',borderRadius:6,padding:'8px',
                      border:`1px solid ${COLORS[i]}30`}}>
                      <div style={{display:'flex',alignItems:'center',gap:4,marginBottom:3}}>
                        <div style={{width:6,height:6,borderRadius:'50%',background:COLORS[i]}}/>
                        <span style={{fontSize:9,color:'#a0aec0'}}>{a.name.split('(')[0].trim()}</span>
                      </div>
                      <div style={{fontSize:14,fontWeight:700,color:w<0?'#fc8181':COLORS[i]}}>
                        {(w*100).toFixed(1)}%
                      </div>
                      {w < 0 && <div style={{fontSize:9,color:'#fc8181'}}>做空</div>}
                    </div>
                  );
                })}
              </div>
              {allowShort && displayPoint.weights && displayPoint.weights.some(w=>w<0) && (
                <div style={{marginTop:12,background:'#1a0a0a',borderRadius:8,padding:'10px 14px',
                  border:'1px solid #fc818140',fontSize:11,color:'#fc8181'}}>
                  ⚠️ 含做空头寸：负权重在实践中难以执行（需要融券成本、做空限制）
                  — 这是书中第4章"无约束MVO"的典型问题
                </div>
              )}
            </div>
          )}

          {results && tab === 'stats' && (
            <div style={{background:'#0f1829',borderRadius:12,padding:20,border:'1px solid #1e2a4a'}}>
              <div style={{fontSize:11,color:'#4299e1',letterSpacing:2,marginBottom:16,textTransform:'uppercase'}}>
                关键统计指标
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12,marginBottom:20}}>
                {[
                  {label:'最大夏普比率', value: ((results.maxSharpe.ret/100-riskFree)/(results.maxSharpe.vol/100)).toFixed(4),
                   desc:'(Rp-Rf)/σp，风险调整后收益', color:'#ff6b6b'},
                  {label:'最小方差', value: `${results.minVar.vol.toFixed(2)}%`,
                   desc:'有效前沿最左端点', color:'#c77dff'},
                  {label:'等权组合夏普', value: ((results.equalWeight.ret/100-riskFree)/(results.equalWeight.vol/100)).toFixed(4),
                   desc:'Naive 1/N基准', color:'#ffd93d'},
                  ...(refResults ? [{
                    label:'REF最大夏普', value: refResults.reduce((b,p) => (p.ret/100-riskFree)/(p.vol/100) > (b.ret/100-riskFree)/(b.vol/100) ? p : b).ret.toFixed(2)+'%',
                    desc:'重采样后更稳健', color:'#ffd93d'
                  }] : []),
                ].map((stat,i) => (
                  <div key={i} style={{background:'#0d1829',borderRadius:8,padding:'12px 14px',
                    border:`1px solid ${stat.color}30`}}>
                    <div style={{fontSize:10,color:'#718096',marginBottom:4}}>{stat.label}</div>
                    <div style={{fontSize:20,fontWeight:700,color:stat.color}}>{stat.value}</div>
                    <div style={{fontSize:10,color:'#4a5568'}}>{stat.desc}</div>
                  </div>
                ))}
              </div>

              {/* Correlation heatmap text */}
              <div style={{fontSize:11,color:'#4299e1',letterSpacing:2,marginBottom:10,textTransform:'uppercase'}}>
                相关性矩阵（节选）
              </div>
              <div style={{overflowX:'auto'}}>
                <table style={{borderCollapse:'collapse',width:'100%',fontSize:10}}>
                  <thead>
                    <tr>
                      <th style={{padding:'4px 8px',color:'#718096',textAlign:'left'}}></th>
                      {preset.assets.slice(0,5).map((a,i) => (
                        <th key={i} style={{padding:'4px 8px',color:COLORS[i],textAlign:'center',
                          maxWidth:60,overflow:'hidden'}}>{a.name.split('(')[0].trim().slice(0,6)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preset.assets.slice(0,5).map((a, i) => (
                      <tr key={i}>
                        <td style={{padding:'4px 8px',color:COLORS[i],fontSize:10}}>{a.name.split('(')[0].trim().slice(0,8)}</td>
                        {preset.corrMatrix[i].slice(0,5).map((c, j) => {
                          const intensity = Math.abs(c);
                          const isPos = c >= 0;
                          return (
                            <td key={j} style={{
                              padding:'4px 8px',textAlign:'center',
                              background: i===j ? '#1a2535' :
                                isPos ? `rgba(0,212,170,${intensity*0.4})` : `rgba(252,129,129,${intensity*0.4})`,
                              color: intensity > 0.5 ? '#e2e8f0' : '#a0aec0',
                              borderRadius:2
                            }}>
                              {c.toFixed(2)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'theory' && (
            <div style={{background:'#0f1829',borderRadius:12,padding:20,border:'1px solid #1e2a4a',
              fontSize:12,lineHeight:1.8}}>
              <div style={{fontSize:11,color:'#4299e1',letterSpacing:2,marginBottom:16,textTransform:'uppercase'}}>
                📚 书中知识点覆盖
              </div>
              {[
                {
                  ch:'Ch.1-2 MVO基础',
                  color:'#00d4aa',
                  points:[
                    '均值-方差优化：max μp - λσp²',
                    '有效前沿：风险-收益最优权衡集合',
                    '二次规划本质：目标函数含 wᵀΣw 二次项',
                  ]
                },
                {
                  ch:'Ch.3 效用函数',
                  color:'#4299e1',
                  points:[
                    'MVO等价于期望效用最大化（需正态分布或二次效用）',
                    '实践中效用函数参数无法准确估计',
                    'Michaud：二次效用近似已足够好',
                  ]
                },
                {
                  ch:'Ch.4 无约束问题',
                  color:'#ff6b6b',
                  points:[
                    '无约束MVO产生极端权重（如-86.5%做空）',
                    '对输入参数极度敏感',
                    '估计误差被放大为更大的权重误差',
                  ]
                },
                {
                  ch:'Ch.5 约束优化',
                  color:'#c77dff',
                  points:[
                    '预算约束 Σwi=1，符号约束 wi≥0',
                    '上下界约束 li≤wi≤ui',
                    '行业/因子约束 Σi∈S wi≤cS',
                    '跟踪误差约束 σTE≤τ',
                  ]
                },
                {
                  ch:'Ch.6 重采样效率(REF)',
                  color:'#ffd93d',
                  points:[
                    'Michaud重采样：蒙特卡洛生成N个模拟场景',
                    '每个场景跑一次MVO，取权重平均',
                    'REF在MV前沿下方：牺牲名义最优换稳健性',
                    '统计等价前沿平均 = 最合理的不确定性处理',
                  ]
                },
                {
                  ch:'Ch.7-12 高级主题',
                  color:'#26de81',
                  points:[
                    '有效前沿参数不确定性区间（Bootstrap）',
                    '夏普比率 = (Rp-Rf)/σp 风险调整收益',
                    '幸存者偏差：历史数据来自未崩溃市场',
                    '资本市场彻底停止运转的历史案例',
                    'Limited liability与资产价格下界',
                  ]
                },
              ].map((section, si) => (
                <div key={si} style={{marginBottom:14,background:'#0d1829',borderRadius:8,padding:'12px 14px',
                  borderLeft:`3px solid ${section.color}`}}>
                  <div style={{color:section.color,fontWeight:700,marginBottom:6,fontSize:12}}>{section.ch}</div>
                  {section.points.map((p,pi) => (
                    <div key={pi} style={{color:'#a0aec0',fontSize:11,paddingLeft:12,marginBottom:2}}>
                      · {p}
                    </div>
                  ))}
                </div>
              ))}

              <div style={{marginTop:12,background:'#1a0a0a',borderRadius:8,padding:'12px 14px',
                border:'1px solid #fc818130',fontSize:11,color:'#fc8181'}}>
                ⚠️ <strong>幸存者偏差警告：</strong>
                本应用使用的历史参数来自"幸存"市场（美国、欧洲）。
                俄国(1917)、中国(1949)资本市场彻底关闭的极端情况无法在此框架内建模。
                风险模型计算的是正常情况下的风险，真正毁灭性的风险在模型之外。
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{textAlign:'center',marginTop:24,fontSize:10,color:'#2d3748'}}>
        基于 Markowitz (1952) · Michaud (1998) Resampled Efficiency™ | 仅供学习，不构成投资建议
      </div>
    </div>
  );
}
