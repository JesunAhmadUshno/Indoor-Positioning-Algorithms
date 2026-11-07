import { useMemo, useState, useEffect, useId, useRef } from 'react';
import wifi05 from '../../Wifi_ap_0.5.csv?raw';
import wifi10 from '../../Wifi_ap_1.csv?raw';
import wifi15 from '../../Wifi_ap_1.5.csv?raw';
import ble1 from '../../beacon1.csv?raw';
import ble2 from '../../beacon2.csv?raw';
import ble3 from '../../beacon3.csv?raw';
import hallCsv from '../../dynamichall.csv?raw';
import * as P from './positioning.js';

const REPO = 'https://github.com/JesunAhmadUshno/Indoor-Positioning-Algorithms';
const blob = (p) => `${REPO}/blob/main/${encodeURI(p)}`;
const NB = 'Indoor Localisation Using RSS.ipynb';
const f2 = (v) => v.toFixed(2), f3 = (v) => v.toFixed(3);

// Recorded data, parsed at build time from the repo's CSVs.
const WIFI_FILES = [['Wifi_ap_0.5.csv', wifi05], ['Wifi_ap_1.csv', wifi10], ['Wifi_ap_1.5.csv', wifi15]];
const BLE_FILES = [['beacon1.csv', ble1], ['beacon2.csv', ble2], ['beacon3.csv', ble3]];
const load = (files, keepBom) => files.map(([, t]) => P.parseColumn(t, { keepBom }).values);
const WIFI = load(WIFI_FILES, false), WIFI_BOM = load(WIFI_FILES, true), BLE = load(BLE_FILES, false);
const RAW_COUNT = WIFI_BOM[0].length;
const TRUE_D = P.ANCHORS.map((a) => P.dist(a, P.TRUTH));
const HALL = P.parseHall(hallCsv);
const BASE = P.estimateAll({ wifi: WIFI, ble: BLE, anchors: P.ANCHORS, wifiAN: P.WIFI_PRESET, bleAN: P.BLE_PRESET });
const ERR = { wcl: P.dist(BASE.wcl, P.TRUTH), tri: P.dist(BASE.tri, P.TRUTH), minmax: P.dist(BASE.minmax, P.TRUTH) };

const METHODS = [
  { k: 'wcl', name: 'Weighted centroid (Wi-Fi)', c: 'var(--primary)', src: 'notebook' },
  { k: 'tri', name: 'Trilateration (BLE)', c: 'var(--bad)', src: 'notebook' },
  { k: 'minmax', name: 'Min-max (BLE)', c: 'var(--warn)', src: 'new' },
];

const SECTIONS = [['top', 'Overview', '◎'], ['floor', 'Floor plan', '⌖'], ['pathloss', 'Path loss', '∿'], ['spread', 'Spread', '⁘'], ['samples', 'Samples', '▥'], ['hall', 'Moving', '≋'], ['kalman', 'Kalman', '◷'], ['limits', 'Limits', '!']];

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.08 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
}

function MenuBar() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  return (
    <div className="menubar" role="banner">
      <span className="apple" aria-hidden="true">◆</span>
      <a className="app" href="#top">Indoor Positioning Lab</a>
      <a className="m" href={blob(NB)}>Notebook</a>
      <a className="m" href={blob('README.md')}>README</a>
      <a className="m" href={blob('docs/research-review.md')}>Research review</a>
      <span className="spacer" />
      <span className="status"><i /> Computed in your browser</span>
      <a href={REPO}>GitHub ↗</a>
      <span className="clock">{now.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</span>
    </div>
  );
}

function Dock() {
  const [active, setActive] = useState('top');
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setActive(e.target.id)), { rootMargin: '-45% 0px -50% 0px' });
    SECTIONS.forEach(([id]) => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);
  return (
    <nav className="dock" aria-label="Sections">
      {SECTIONS.map(([id, label, icon]) => (
        <a key={id} href={`#${id}`} className={active === id ? 'on' : ''} aria-current={active === id ? 'true' : undefined}>
          <span className="ico" aria-hidden="true">{icon}</span><span className="lbl">{label}</span>
        </a>
      ))}
    </nav>
  );
}

function Range({ label, value, min, max, step, onChange, show }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label} <span>{show}</span></label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
    </div>
  );
}

function Seg({ label, value, options, onChange }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([k, l]) => <button key={k} aria-pressed={value === k} onClick={() => onChange(k)}>{l}</button>)}
    </div>
  );
}

export default function App() {
  useReveal();
  return (
    <div className="wrap">
      <MenuBar />
      <div className="glow" aria-hidden="true" />
      <Hero />
      <FloorPlan />
      <PathLoss />
      <Spread />
      <Samples />
      <Hall />
      <Kalman />
      <Limits />
      <Dock />
      <footer>
        Data: the recorded RSSI captures committed in this repository. Every number on this page is computed from those CSV files at build time or live in your browser, and a Node check reproduces the notebook's printed outputs before each build.
      </footer>
    </div>
  );
}

function Hero() {
  return (
    <header className="card hero window" id="top" data-title="Indoor-Positioning-Algorithms — README">
      <div className="head">
        <p className="eyebrow">Coursework · recorded RSSI · one test point</p>
        <span className="pill warn">● Single test point</span>
      </div>
      <h1>From signal strength alone, a tag placed to within <em>{f2(ERR.wcl)} m</em> of its true spot.</h1>
      <p className="sub">
        Three Wi-Fi access points and three BLE beacons were recorded from one tag position. The notebook turns each signal strength into a distance with a log-distance path-loss model,
        then locates the tag with a weighted centroid (Wi-Fi, {f3(ERR.wcl)} m off) and closed-form trilateration (BLE, {f3(ERR.tri)} m off) in a layout about 2 m across.
        Both results come from one point, with the model calibrated on the same captures it is scored on. Treat them as a worked example, not an accuracy claim.
      </p>
      <div className="actions">
        <a className="btn primary" href="#floor">Open the floor plan</a>
        <a className="btn ghost" href={blob(NB)}>Read the notebook</a>
        <span className="hint">Tag at ({P.TRUTH.x}, {P.TRUTH.y}), as coded in the notebook</span>
      </div>
      <div className="tiles">
        <div className="tile"><div className="num">{f3(ERR.wcl)} m</div><div className="cap">Weighted-centroid error, Wi-Fi, A = {P.WIFI_PRESET.a}, n = {P.WIFI_PRESET.n}</div></div>
        <div className="tile"><div className="num">{f3(ERR.tri)} m</div><div className="cap">Trilateration error, BLE, A = {P.BLE_PRESET.a}, n = {P.BLE_PRESET.n}</div></div>
        <div className="tile"><div className="num">{WIFI[0].length}</div><div className="cap">Wi-Fi samples per AP used ({RAW_COUNT} recorded; the first is lost to a byte-order mark)</div></div>
        <div className="tile"><div className="num">{BLE.map((b) => b.length).join('/')}</div><div className="cap">BLE samples per beacon after header lines are dropped</div></div>
      </div>
    </header>
  );
}

// World-to-screen mapping for the floor plan (metres; y up).
const FP = { W: 560, H: 420, x0: -1.3, x1: 3.3, y0: -1.2, y1: 2.25 };
const sx = (x) => ((x - FP.x0) / (FP.x1 - FP.x0)) * FP.W;
const sy = (y) => (1 - (y - FP.y0) / (FP.y1 - FP.y0)) * FP.H;
const scale = FP.W / (FP.x1 - FP.x0);

function FloorPlan() {
  const [anchors, setAnchors] = useState(P.ANCHORS);
  const [truth, setTruth] = useState(P.TRUTH);
  const [wa, setWa] = useState(P.WIFI_PRESET.a), [wn, setWn] = useState(P.WIFI_PRESET.n);
  const [ba, setBa] = useState(P.BLE_PRESET.a), [bn, setBn] = useState(P.BLE_PRESET.n);
  const [k, setK] = useState(200);
  const [keepBom, setKeepBom] = useState(false);
  const [drag, setDrag] = useState(null);
  const svg = useRef(null);
  const wifi = (keepBom ? WIFI_BOM : WIFI).map((c) => c.slice(0, k)), ble = BLE.map((c) => c.slice(0, k));
  const est = P.estimateAll({ wifi, ble, anchors, wifiAN: { a: wa, n: wn }, bleAN: { a: ba, n: bn } });
  const isDefault = wa === -36 && wn === 1.5 && ba === -90 && bn === 3 && k >= 138 && !keepBom && anchors === P.ANCHORS && truth === P.TRUTH;
  const reset = () => { setAnchors(P.ANCHORS); setTruth(P.TRUTH); setWa(-36); setWn(1.5); setBa(-90); setBn(3); setK(200); setKeepBom(false); };

  const toWorld = (e) => {
    const pt = svg.current.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.current.getScreenCTM().inverse());
    const r = (v) => Math.round(v * 20) / 20; // snap to 5 cm
    return { x: r(FP.x0 + (p.x / FP.W) * (FP.x1 - FP.x0)), y: r(FP.y0 + (1 - p.y / FP.H) * (FP.y1 - FP.y0)) };
  };
  const move = (e) => {
    if (drag === null) return;
    const w = toWorld(e);
    if (drag === 'truth') setTruth(w); else setAnchors((a) => a.map((p, i) => (i === drag ? w : p)));
  };
  const nudge = (who) => (e) => {
    const d = { ArrowLeft: [-0.05, 0], ArrowRight: [0.05, 0], ArrowUp: [0, 0.05], ArrowDown: [0, -0.05] }[e.key];
    if (!d) return;
    e.preventDefault();
    const f = (p) => ({ x: +(p.x + d[0]).toFixed(2), y: +(p.y + d[1]).toFixed(2) });
    if (who === 'truth') setTruth(f); else setAnchors((a) => a.map((p, i) => (i === who ? f(p) : p)));
  };
  const handle = (who) => ({ tabIndex: 0, role: 'button', 'data-interactive': true, style: { cursor: 'grab' }, onPointerDown: (e) => { e.target.setPointerCapture?.(e.pointerId); setDrag(who); }, onKeyDown: nudge(who) });
  const grid = []; for (let v = -1; v <= 3; v += 0.5) grid.push(v);
  const box = est.minmax.box;

  return (
    <section id="floor" className="card window reveal" data-title="floorplan.svg — live positioning">
      <div className="head">
        <div>
          <p className="eyebrow">Live playground</p>
          <h2>Three anchors, one tag, three ways to find it.</h2>
          <p className="sub">
            Every estimate below is recomputed in your browser from the recorded samples. Drag an anchor or the true tag (or focus one and use the arrow keys) to see how each method reacts when the assumed geometry changes.
            The recorded signals do not change when you drag: this shows sensitivity to where you believe the anchors are, not a new measurement. Dashed circles are the BLE range estimates used by trilateration and min-max.
          </p>
        </div>
        <span className={`pill ${isDefault ? 'good' : 'info'}`}>{isDefault ? '● Matches the notebook' : '● Your settings'}</span>
      </div>
      <div className="grid2">
        <div>
          <svg ref={svg} className="chart" viewBox={`0 0 ${FP.W} ${FP.H}`} role="img" aria-label="Floor plan with anchors, true tag position and three position estimates" style={{ overflow: 'hidden', touchAction: 'none', borderRadius: 12, background: 'var(--surface-strong)' }}
            onPointerMove={move} onPointerUp={() => setDrag(null)} onPointerLeave={() => setDrag(null)}>
            {grid.map((v) => <g key={v}><line className="axis" x1={sx(v)} x2={sx(v)} y1={0} y2={FP.H} /><line className="axis" x1={0} x2={FP.W} y1={sy(v)} y2={sy(v)} /></g>)}
            {[0, 1, 2].map((v) => <text key={v} x={sx(v) + 3} y={FP.H - 6}>{v} m</text>)}
            {anchors.map((a, i) => <circle key={i} cx={sx(a.x)} cy={sy(a.y)} r={est.rBle[i] * scale} fill="none" stroke="var(--bad)" strokeOpacity="0.45" strokeDasharray="5 4" />)}
            {box[0] <= box[2] && box[1] <= box[3] && <rect x={sx(box[0])} y={sy(box[3])} width={Math.max(1, (box[2] - box[0]) * scale)} height={Math.max(1, (box[3] - box[1]) * scale)} fill="var(--warn)" opacity="0.18" stroke="var(--warn)" />}
            {METHODS.map((m) => est[m.k] && <line key={m.k} x1={sx(truth.x)} y1={sy(truth.y)} x2={sx(est[m.k].x)} y2={sy(est[m.k].y)} stroke={m.c} strokeOpacity="0.5" />)}
            <g {...handle('truth')} aria-label={`True tag at ${truth.x}, ${truth.y}`}>
              <circle cx={sx(truth.x)} cy={sy(truth.y)} r="11" fill="var(--good)" opacity="0.2" />
              <circle cx={sx(truth.x)} cy={sy(truth.y)} r="6" fill="var(--good)" />
            </g>
            {anchors.map((a, i) => (
              <g key={i} {...handle(i)} aria-label={`Anchor ${i + 1} at ${a.x}, ${a.y}`}>
                <rect x={sx(a.x) - 9} y={sy(a.y) - 9} width="18" height="18" rx="4" fill="var(--text)" />
                <text x={sx(a.x)} y={sy(a.y) + 4} textAnchor="middle" style={{ fill: 'var(--bg)', fontWeight: 700 }}>{i + 1}</text>
              </g>
            ))}
            {METHODS.map((m) => est[m.k] && <circle key={m.k} cx={sx(est[m.k].x)} cy={sy(est[m.k].y)} r="5.5" fill={m.c} stroke="var(--surface-strong)" strokeWidth="2" pointerEvents="none" />)}
          </svg>
          <div className="legend">
            <span><i style={{ background: 'var(--text)' }} />Anchors</span><span><i style={{ background: 'var(--good)' }} />True tag</span>
            {METHODS.map((m) => <span key={m.k}><i style={{ background: m.c }} />{m.name}</span>)}
          </div>
        </div>
        <div>
          <div className="controls" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Range label="Wi-Fi A (dBm at 1 m)" value={wa} min={-60} max={-20} step={0.5} onChange={setWa} show={wa} />
            <Range label="Wi-Fi n" value={wn} min={1} max={5} step={0.1} onChange={setWn} show={wn.toFixed(1)} />
            <Range label="BLE A (dBm at 1 m)" value={ba} min={-100} max={-60} step={0.5} onChange={setBa} show={ba} />
            <Range label="BLE n" value={bn} min={1} max={5} step={0.1} onChange={setBn} show={bn.toFixed(1)} />
            <Range label="Samples per capture" value={Math.min(k, 140)} min={1} max={140} step={1} onChange={(v) => setK(v >= 140 ? 200 : v)} show={k >= 140 ? 'all' : `first ${k}`} />
            <div className="field"><label htmlFor="bom">First Wi-Fi sample</label>
              <select id="bom" value={keepBom ? 'keep' : 'drop'} onChange={(e) => setKeepBom(e.target.value === 'keep')}>
                <option value="drop">Dropped (as the notebook)</option><option value="keep">Kept (BOM stripped)</option>
              </select>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Method</th><th>Estimate (x, y)</th><th>Error</th></tr></thead>
              <tbody>
                {METHODS.map((m) => (
                  <tr key={m.k}>
                    <td><span style={{ color: m.c }}>●</span> {m.name}{m.src === 'new' && <> <span className="pill info">new</span></>}</td>
                    <td className="mono">{est[m.k] ? `(${f3(est[m.k].x)}, ${f3(est[m.k].y)})` : 'collinear'}</td>
                    <td><b>{est[m.k] ? `${f3(P.dist(est[m.k], truth))} m` : 'n/a'}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="actions" style={{ marginTop: 14 }}>
            <button className="btn ghost" onClick={reset}>Reset to notebook settings</button>
          </div>
          <p className="hint">Min-max is not in the notebook; it is added here from the same BLE distances because the repository description promises it. With the default settings it lands {f3(ERR.minmax)} m from the tag.</p>
        </div>
      </div>
    </section>
  );
}

function PathLoss() {
  const [tech, setTech] = useState('wifi');
  const preset = tech === 'wifi' ? P.WIFI_PRESET : P.BLE_PRESET;
  const [an, setAn] = useState({ wifi: P.WIFI_PRESET, ble: P.BLE_PRESET });
  const { a, n } = an[tech];
  const set = (patch) => setAn((s) => ({ ...s, [tech]: { ...s[tech], ...patch } }));
  const caps = tech === 'wifi' ? WIFI : BLE;
  const pts = caps.map((c, i) => ({ d: TRUE_D[i], rss: P.mean(c), sd: P.std(c, 0) }));
  const loo = P.leaveOneOut(pts), fitAll = P.fitAN(pts);
  const W = 460, H = 260, pad = { l: 44, r: 10, t: 12, b: 28 };
  const lo = tech === 'wifi' ? -50 : -100, hi = tech === 'wifi' ? -20 : -70;
  const x = (d) => pad.l + (d / 2) * (W - pad.l - pad.r);
  const y = (v) => pad.t + (1 - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const curve = Array.from({ length: 80 }, (_, i) => { const d = 0.1 + i * 0.024; return `${x(d)},${y(P.calcRss(d, a, n))}`; }).join(' ');
  return (
    <section id="pathloss" className="card window reveal" data-title="pathloss.calc — log-distance model">
      <div className="head">
        <div>
          <p className="eyebrow">Signal to distance</p>
          <h2>The model that turns dBm into metres, against the recorded means.</h2>
          <p className="sub">
            The notebook converts each sample with <span className="mono">d = 10^((RSS − A) / (−10 n))</span>. A is the expected signal at 1 m and n is how fast it fades.
            Points are the recorded mean RSS at the anchor-to-tag distances implied by the notebook's layout ({TRUE_D.map((d) => `${d} m`).join(', ')}), with ±1 SD bars.
          </p>
        </div>
        <Seg label="Signal type" value={tech} onChange={setTech} options={[['wifi', 'Wi-Fi'], ['ble', 'BLE']]} />
      </div>
      <div className="grid2">
        <div>
          <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Path-loss curve for ${tech === 'wifi' ? 'Wi-Fi' : 'BLE'} with recorded mean RSS`}>
            {[0, 0.5, 1, 1.5, 2].map((d) => <g key={d}><line className="axis" x1={x(d)} x2={x(d)} y1={pad.t} y2={H - pad.b} /><text x={x(d)} y={H - 8} textAnchor="middle">{d} m</text></g>)}
            {[0, 1, 2, 3].map((i) => { const v = lo + i * 10; return <g key={v}><line className="axis" x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} /><text x={pad.l - 6} y={y(v) + 4} textAnchor="end">{v}</text></g>; })}
            <polyline fill="none" stroke="var(--primary)" strokeWidth="2.5" points={curve} />
            {pts.map((p, i) => (
              <g key={i}>
                <line x1={x(p.d)} x2={x(p.d)} y1={y(p.rss - p.sd)} y2={y(p.rss + p.sd)} stroke="var(--text)" strokeWidth="2" />
                <circle cx={x(p.d)} cy={y(p.rss)} r="5" fill="var(--text)" />
                <line x1={x(p.d)} x2={x(P.calcDist(p.rss, a, n))} y1={y(p.rss)} y2={y(p.rss)} stroke="var(--bad)" strokeDasharray="3 3" />
              </g>
            ))}
            <text x={W - pad.r} y={pad.t + 12} textAnchor="end">dBm (y) vs distance (x)</text>
          </svg>
          <p className="hint">Red dashes show how far the model's distance for each mean lands from the true distance.</p>
        </div>
        <div>
          <div className="controls" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Range label="A (dBm at 1 m)" value={a} min={tech === 'wifi' ? -60 : -100} max={tech === 'wifi' ? -20 : -60} step={0.5} onChange={(v) => set({ a: v })} show={a} />
            <Range label="Path-loss exponent n" value={n} min={1} max={5} step={0.1} onChange={(v) => set({ n: v })} show={n.toFixed(1)} />
          </div>
          <div className="actions" style={{ marginTop: 0, marginBottom: 12 }}>
            <button className="btn ghost" onClick={() => set(preset)}>Notebook preset (A {preset.a}, n {preset.n})</button>
            <button className="btn ghost" onClick={() => set({ a: +fitAll.a.toFixed(1), n: +fitAll.n.toFixed(1) })}>Least-squares fit</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>True d</th><th>Mean RSS</th><th>Model d</th><th>Held-out d</th></tr></thead>
              <tbody>
                {pts.map((p, i) => (
                  <tr key={i}><td>{p.d} m</td><td>{f2(p.rss)} dBm</td><td>{f3(P.calcDist(p.rss, a, n))} m</td><td>{f3(loo[i].pred)} m <span className="hint">({loo[i].err >= 0 ? '+' : ''}{f3(loo[i].err)})</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint" style={{ marginTop: 10 }}>
            Held-out d is a leave-one-out check added here: fit A and n on the other two distances, then predict this one. It is the honest version of the calibration, since the notebook's presets were tuned on the same captures they are scored on.
            A fit on all three gives A = {f2(fitAll.a)}, n = {f2(fitAll.n)}.
          </p>
        </div>
      </div>
    </section>
  );
}

function Spread() {
  const [k, setK] = useState(10);
  const [seed, setSeed] = useState(7);
  const B = 400;
  const res = useMemo(() => P.bootstrap({ wifi: WIFI, ble: BLE, anchors: P.ANCHORS, wifiAN: P.WIFI_PRESET, bleAN: P.BLE_PRESET, k, B, seed }), [k, seed]);
  const W = 460, H = 300, x0 = 0.7, x1 = 2.3, y0 = -0.75, y1 = 0.75;
  const px = (x) => ((x - x0) / (x1 - x0)) * W, py = (y) => (1 - (y - y0) / (y1 - y0)) * H;
  return (
    <section id="spread" className="card window reveal" data-title="bootstrap.js — how much one estimate can move">
      <div className="head">
        <div>
          <p className="eyebrow">Live resampling</p>
          <h2>Use fewer samples and the same tag lands somewhere else.</h2>
          <p className="sub">
            The notebook reports one estimate per method. Here each run redraws k samples per anchor (with replacement) from the recorded captures and recomputes all three methods, {B} times with a seeded generator.
            This measures sampling noise in these captures only. It cannot capture the bigger unknowns: other tag positions, other rooms, or a calibration fitted on separate data.
          </p>
        </div>
        <span className="pill info">{B} resamples · seed {seed}</span>
      </div>
      <div className="grid2">
        <div>
          <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Scatter of bootstrapped position estimates around the true tag" style={{ overflow: 'hidden', borderRadius: 12, background: 'var(--surface-strong)' }}>
            {[1, 1.5, 2].map((v) => <g key={v}><line className="axis" x1={px(v)} x2={px(v)} y1={0} y2={H} /><text x={px(v) + 3} y={H - 6}>x {v}</text></g>)}
            {[-0.5, 0, 0.5].map((v) => <g key={v}><line className="axis" x1={0} x2={W} y1={py(v)} y2={py(v)} /><text x={4} y={py(v) - 4}>y {v}</text></g>)}
            {METHODS.map((m) => res[m.k].map((p, i) => <circle key={`${m.k}${i}`} cx={px(p.x)} cy={py(p.y)} r="2.2" fill={m.c} opacity="0.4" />))}
            <circle cx={px(P.TRUTH.x)} cy={py(P.TRUTH.y)} r="7" fill="var(--good)" stroke="var(--surface-strong)" strokeWidth="2" />
          </svg>
          <div className="legend"><span><i style={{ background: 'var(--good)' }} />True tag</span>{METHODS.map((m) => <span key={m.k}><i style={{ background: m.c }} />{m.name}</span>)}</div>
        </div>
        <div>
          <div className="controls" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Range label="Samples per anchor (k)" value={k} min={1} max={89} step={1} onChange={setK} show={k} />
            <div className="field"><label htmlFor="bseed">Seed</label><input id="bseed" type="number" value={seed} onChange={(e) => setSeed(+e.target.value || 1)} /></div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Method</th><th>Median error</th><th>90% range of error</th></tr></thead>
              <tbody>
                {METHODS.map((m) => { const e = res[m.k].map((p) => p.err); return (
                  <tr key={m.k}><td><span style={{ color: m.c }}>●</span> {m.name}</td><td>{f3(P.quantile(e, 0.5))} m</td><td>{f3(P.quantile(e, 0.05))} to {f3(P.quantile(e, 0.95))} m</td></tr>
                ); })}
              </tbody>
            </table>
          </div>
          <p className="hint" style={{ marginTop: 10 }}>Wi-Fi readings barely vary (variance at most {f2(Math.max(...WIFI.map((c) => P.variance(c))))} dB², against {f2(Math.min(...BLE.map((c) => P.variance(c))))} dB² or more for BLE), so the weighted centroid hardly moves, while trilateration and min-max scatter at small k.</p>
        </div>
      </div>
    </section>
  );
}

function Samples() {
  const all = [...WIFI_FILES.map(([f], i) => ({ f, v: WIFI[i], kind: 'Wi-Fi' })), ...BLE_FILES.map(([f], i) => ({ f, v: BLE[i], kind: 'BLE' }))];
  const [sel, setSel] = useState(0);
  const cap = all[sel], v = cap.v;
  const mn = Math.min(...v), mx = Math.max(...v), span = Math.max(mx - mn, 1e-9);
  const W = 460, H = 200, pad = { l: 44, r: 8, t: 10, b: 22 };
  const lx = (i) => pad.l + (i / Math.max(1, v.length - 1)) * (W - pad.l - pad.r);
  const ly = (r) => pad.t + (1 - (r - mn) / span) * (H - pad.t - pad.b);
  const bins = 14, counts = Array(bins).fill(0);
  v.forEach((r) => counts[Math.min(bins - 1, Math.floor(((r - mn) / span) * bins))]++);
  const cmax = Math.max(...counts);
  return (
    <section id="samples" className="card window reveal" data-title="rssi_captures.csv — recorded data">
      <div className="head">
        <div>
          <p className="eyebrow">Recorded data</p>
          <h2>What the six static captures look like.</h2>
          <p className="sub">These are the raw recordings from the repository, plotted as stored, in recorded order. Nothing here is simulated. Variance uses the population formula, as the notebook's <span className="mono">np.nanvar</span> does.</p>
        </div>
        <div className="field" style={{ minWidth: 200 }}><label htmlFor="cap">Capture</label>
          <select id="cap" value={sel} onChange={(e) => setSel(+e.target.value)}>
            {all.map((c, i) => <option key={c.f} value={i}>{c.kind}: {c.f}</option>)}
          </select>
        </div>
      </div>
      <div className="grid2">
        <div>
          <h3>Trace ({v.length} samples)</h3>
          <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`RSS trace for ${cap.f}`}>
            {[mn, (mn + mx) / 2, mx].map((t) => <g key={t}><line className="axis" x1={pad.l} x2={W - pad.r} y1={ly(t)} y2={ly(t)} /><text x={pad.l - 6} y={ly(t) + 4} textAnchor="end">{t.toFixed(1)}</text></g>)}
            <polyline fill="none" stroke="var(--primary)" strokeWidth="1.8" points={v.map((r, i) => `${lx(i)},${ly(r)}`).join(' ')} />
            <text x={pad.l} y={H - 4}>sample 1</text><text x={W - pad.r} y={H - 4} textAnchor="end">sample {v.length}</text>
          </svg>
        </div>
        <div>
          <h3>Histogram</h3>
          <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Histogram of RSS for ${cap.f}`}>
            {counts.map((c, i) => { const bw = (W - pad.l - pad.r) / bins; const h = (c / cmax) * (H - pad.t - pad.b); return <rect key={i} x={pad.l + i * bw + 1} width={bw - 2} y={H - pad.b - h} height={h} rx="3" fill="var(--primary)" opacity="0.75" />; })}
            <text x={pad.l} y={H - 4}>{mn.toFixed(1)} dBm</text><text x={W - pad.r} y={H - 4} textAnchor="end">{mx.toFixed(1)} dBm</text>
          </svg>
        </div>
      </div>
      <div className="tiles">
        <div className="tile"><div className="num">{f2(P.mean(v))}</div><div className="cap">Mean RSS (dBm)</div></div>
        <div className="tile"><div className="num">{f3(P.variance(v))}</div><div className="cap">Variance (dB²)</div></div>
        <div className="tile"><div className="num">{mn.toFixed(1)} / {mx.toFixed(1)}</div><div className="cap">Min / max (dBm)</div></div>
        <div className="tile"><div className="num">{v.length}</div><div className="cap">Samples used</div></div>
      </div>
    </section>
  );
}

function Hall() {
  const [drop, setDrop] = useState(false);
  const [hover, setHover] = useState(null);
  const colors = ['var(--primary)', 'var(--bad)', 'var(--good)', 'var(--warn)', '#8b5cf6', '#0ea5a4'];
  const W = 960, H = 280, pad = { l: 44, r: 12, t: 10, b: 26 };
  const T = HALL.t[HALL.t.length - 1];
  const lo = -100, hi = drop ? -55 : 5;
  const x = (t) => pad.l + (t / T) * (W - pad.l - pad.r);
  const y = (v) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const stats = HALL.ch.map((c) => ({ all: P.channelStats(c, false), nz: P.channelStats(c, true) }));
  const rs = stats.map((s) => s.all.std / s.nz.std), ratio = [Math.min(...rs), Math.max(...rs)];
  const ticks = drop ? [-100, -90, -80, -70, -60] : [-100, -75, -50, -25, 0];
  return (
    <section id="hall" className="card window reveal" data-title="dynamichall.csv — recorded moving capture">
      <div className="head">
        <div>
          <p className="eyebrow">Recorded moving capture</p>
          <h2>Count the empty readings as zeros and the spread grows <em>{ratio[0].toFixed(1)}× to {ratio[1].toFixed(1)}×</em>.</h2>
          <p className="sub">
            Six channels recorded over about {Math.round(T)} s at 0.1 s steps ({HALL.t.length} rows). Before a channel's first reading the file stores 0 dBm, which is not a signal.
            The notebook's standard deviations include those zeros. Toggle to treat them as missing and the numbers change. Same data, different cleaning, different answer.
          </p>
        </div>
        <Seg label="Zero handling" value={drop ? 'drop' : 'keep'} onChange={(k) => setDrop(k === 'drop')} options={[['keep', 'Zeros counted (notebook)'], ['drop', 'Zeros missing']]} />
      </div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="RSS of six channels over time" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => <g key={t}><line className="axis" x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} /><text x={pad.l - 6} y={y(t) + 4} textAnchor="end">{t}</text></g>)}
        {HALL.ch.map((c, j) => {
          const segs = []; let cur = [];
          c.forEach((v, i) => { if (drop && v === 0) { if (cur.length) segs.push(cur); cur = []; } else cur.push(`${x(HALL.t[i])},${y(v)}`); });
          if (cur.length) segs.push(cur);
          return segs.map((s, si) => <polyline key={`${j}-${si}`} fill="none" stroke={colors[j]} strokeWidth={hover === j ? 2.6 : 1.5} strokeOpacity={hover === null || hover === j ? 0.9 : 0.15} points={s.join(' ')} onMouseEnter={() => setHover(j)} />);
        })}
        <text x={pad.l} y={H - 6}>0 s</text><text x={W - pad.r} y={H - 6} textAnchor="end">{T.toFixed(1)} s</text>
      </svg>
      <div style={{ overflowX: 'auto', marginTop: 12 }}>
        <table>
          <thead><tr><th>Channel</th><th>Readings</th><th>Mean (zeros counted)</th><th>SD (zeros counted)</th><th>Mean (zeros missing)</th><th>SD (zeros missing)</th></tr></thead>
          <tbody>
            {HALL.names.map((nm, j) => (
              <tr key={nm} onMouseEnter={() => setHover(j)} onMouseLeave={() => setHover(null)}>
                <td><span style={{ color: colors[j] }}>●</span> {nm}</td><td>{stats[j].nz.n} of {stats[j].all.n}</td>
                <td className={drop ? '' : 'ok'}>{f2(stats[j].all.mean)}</td><td className={drop ? '' : 'ok'}>{f2(stats[j].all.std)}</td>
                <td className={drop ? 'ok' : ''}>{f2(stats[j].nz.mean)}</td><td className={drop ? 'ok' : ''}>{f2(stats[j].nz.std)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint" style={{ marginTop: 10 }}>Standard deviation with N − 1, as pandas computes it. The notebook's plots also label columns off by one (the "SAT 4" plot shows Topic5 and "SAT 5" shows Topic6), so Topic4 and Topic6 are never plotted there.</p>
    </section>
  );
}

function Kalman() {
  const [R, setR] = useState(10), [q1, setQ1] = useState(1), [q2, setQ2] = useState(3), [seed, setSeed] = useState(1);
  const rows = useMemo(() => P.kalmanDemo({ seed, R, Q: [q1, q2] }), [seed, R, q1, q2]);
  const W = 460, H = 240, pad = { l: 40, r: 8, t: 10, b: 24 };
  const N = rows.length;
  const x = (k) => pad.l + ((k - 1) / (N - 1)) * (W - pad.l - pad.r);
  const errLim = 30;
  const ye = (v) => pad.t + (1 - (Math.max(-errLim, Math.min(errLim, v)) + errLim) / (2 * errLim)) * (H - pad.t - pad.b);
  const vmin = -20, vmax = 120;
  const yv = (v) => pad.t + (1 - (Math.max(vmin, Math.min(vmax, v)) - vmin) / (vmax - vmin)) * (H - pad.t - pad.b);
  const rms = (a) => Math.sqrt(P.mean(a.map((v) => v * v)));
  const tail = rows.slice(50);
  const mErr = rms(tail.map((r) => r.z - r.truePos)), eErr = rms(tail.map((r) => r.est - r.truePos));
  return (
    <section id="kalman" className="card window reveal" data-title="kalman.js — synthetic demo, ported from the notebook">
      <div className="head">
        <div>
          <p className="eyebrow">Live filter · synthetic data</p>
          <h2>The notebook's Kalman filter, rerun with a seed.</h2>
          <p className="sub">
            A constant-velocity filter (A = [[1, 0.1], [0, 1]], H = [1, 0]) tracking a simulated target, ported line for line from <span className="mono">getMeasurement()</span> and <span className="mono">filter()</span>.
            The notebook only ever ran it on simulated data like this, never on the recorded RSS, and neither does this page. Its simulator starts at −80 m/s and jumps to about +80 m/s, which is why the early estimates lag.
          </p>
        </div>
        <span className="pill warn">Synthetic, not recorded</span>
      </div>
      <div className="controls">
        <Range label="Measurement noise R" value={R} min={1} max={100} step={1} onChange={setR} show={R} />
        <Range label="Process noise Q (position)" value={q1} min={0.1} max={10} step={0.1} onChange={setQ1} show={q1.toFixed(1)} />
        <Range label="Process noise Q (velocity)" value={q2} min={0.1} max={20} step={0.1} onChange={setQ2} show={q2.toFixed(1)} />
        <div className="field"><label htmlFor="kseed">Seed</label><input id="kseed" type="number" value={seed} onChange={(e) => setSeed(+e.target.value || 1)} /></div>
      </div>
      <div className="grid2">
        <div>
          <h3>Position error per update, with ±3σ bound</h3>
          <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Measured and estimated position error with three sigma bounds">
            {[-20, 0, 20].map((t) => <g key={t}><line className="axis" x1={pad.l} x2={W - pad.r} y1={ye(t)} y2={ye(t)} /><text x={pad.l - 6} y={ye(t) + 4} textAnchor="end">{t}</text></g>)}
            <polygon fill="var(--primary)" opacity="0.1" points={[...rows.map((r) => `${x(r.k)},${ye(r.sigma3)}`), ...[...rows].reverse().map((r) => `${x(r.k)},${ye(-r.sigma3)}`)].join(' ')} />
            {rows.map((r) => <circle key={r.k} cx={x(r.k)} cy={ye(r.z - r.truePos)} r="1.6" fill="var(--bad)" opacity="0.55" />)}
            <polyline fill="none" stroke="var(--primary)" strokeWidth="1.8" points={rows.map((r) => `${x(r.k)},${ye(r.est - r.truePos)}`).join(' ')} />
            <text x={pad.l} y={H - 4}>update 1</text><text x={W - pad.r} y={H - 4} textAnchor="end">update {N}</text>
          </svg>
          <div className="legend"><span><i style={{ background: 'var(--bad)' }} />Measurement error</span><span><i style={{ background: 'var(--primary)' }} />Filter error</span></div>
        </div>
        <div>
          <h3>Velocity estimate</h3>
          <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Velocity estimate on each update">
            {[0, 40, 80, 120].map((t) => <g key={t}><line className="axis" x1={pad.l} x2={W - pad.r} y1={yv(t)} y2={yv(t)} strokeDasharray={t === 80 ? '4 4' : ''} /><text x={pad.l - 6} y={yv(t) + 4} textAnchor="end">{t}</text></g>)}
            <polyline fill="none" stroke="var(--primary)" strokeWidth="1.8" points={rows.map((r) => `${x(r.k)},${yv(r.vel)}`).join(' ')} />
            <text x={pad.l} y={H - 4}>update 1</text><text x={W - pad.r} y={H - 4} textAnchor="end">update {N}</text>
          </svg>
          <p className="hint">Dashed line: the simulator's mean velocity, 80 m/s. After update 50 the RMS error is {f2(mErr)} for raw measurements and {f2(eErr)} for the filter.</p>
        </div>
      </div>
    </section>
  );
}

function Limits() {
  const items = [
    ['One test point', `Every error figure comes from one tag position, (${P.TRUTH.x}, ${P.TRUTH.y}). There is no error distribution across positions, so ${f2(ERR.wcl)} m and ${f2(ERR.tri)} m are single observations, not accuracies.`],
    ['Calibration not held out', `The Wi-Fi preset A = ${P.WIFI_PRESET.a} sits next to the 1 m capture's own mean (${f2(P.mean(WIFI[1]))} dBm), and n looks hand-tuned on the same captures that are then scored. The leave-one-out column in the path-loss window shows the honest version.`],
    ['Setup undocumented', 'Room, devices, heights and orientation are not recorded. The anchor layout and true point come only from the notebook code.'],
    ['Silent data loss', `The Wi-Fi files start with a byte-order mark, so the notebook drops one of ${RAW_COUNT} samples per file; header lines in two beacon files are dropped the same way. This page follows the notebook by default and lets you switch.`],
    ['Kalman filter is synthetic', 'It never touches the recorded data, in the notebook or here.'],
    ['Min-max is new', 'The repository description promises min-max, but the notebook does not implement it. It is computed fresh on this page and labelled that way.'],
  ];
  return (
    <section id="limits" className="card window reveal" data-title="README — limitations and reproduction">
      <p className="eyebrow">Limitations and threats to validity</p>
      <h2>What these numbers can and cannot tell you.</h2>
      <div className="grid2" style={{ marginTop: 16 }}>
        {items.map(([t, d]) => (
          <div className="tile" key={t}><h3>{t}</h3><p className="hint" style={{ margin: '6px 0 0', fontSize: 13 }}>{d}</p></div>
        ))}
      </div>
      <h3 style={{ marginTop: 24 }}>Reproduce</h3>
      <ol className="steps" style={{ marginTop: 12 }}>
        <li><span className="n">1</span><div><b>Notebook numbers, in Python</b><div className="hint"><code>pip install -r requirements.txt && python -m unittest discover tests</code></div></div></li>
        <li><span className="n">2</span><div><b>Same numbers, in JavaScript</b><div className="hint"><code>cd site && npm ci && npm run build</code> runs <span className="mono">positioning.check.mjs</span> before building and fails if any notebook output drifts.</div></div></li>
      </ol>
      <div className="docs" style={{ marginTop: 20 }}>
        {[[NB, 'Notebook', 'Original analysis and printed outputs'], ['README.md', 'README', 'Setup as far as the data shows'], ['docs/research-review.md', 'Research review', 'Graded against a PhD rubric']].map(([p, t, d]) => <a key={p} href={blob(p)}><b>{t}</b><small>{d}</small></a>)}
      </div>
    </section>
  );
}
