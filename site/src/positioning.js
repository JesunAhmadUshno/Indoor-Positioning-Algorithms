// Pure-JS port of the positioning maths in "Indoor Localisation Using RSS.ipynb".
// Used by the page (live, in the browser) and by positioning.check.mjs (in Node, before every build).

// Anchor layout and true tag position exactly as coded in the notebook (cells "Wifi Positioning", "trilateration").
export const ANCHORS = [{ x: 2, y: 0 }, { x: 1.5, y: 1 }, { x: 0, y: 0 }];
export const TRUTH = { x: 1.5, y: 0 };
export const WIFI_PRESET = { a: -36, n: 1.5 };
export const BLE_PRESET = { a: -90, n: 3 };

const BOM = '﻿';

// One-column CSV -> numbers. Mirrors np.genfromtxt: non-numeric lines (the name and MAC header lines in
// beacon2/3) are dropped. The Wi-Fi files start with a UTF-8 BOM, which genfromtxt turns into NaN, so the
// notebook silently loses that first sample. keepBom=true strips the BOM and keeps the sample instead.
export function parseColumn(text, { keepBom = false } = {}) {
  const values = [];
  let dropped = 0;
  for (let line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (line.startsWith(BOM)) {
      if (!keepBom) { dropped++; continue; }
      line = line.slice(1);
    }
    const v = Number(line.trim());
    if (line.trim() === '' || Number.isNaN(v)) { dropped++; continue; }
    values.push(v);
  }
  return { values, dropped };
}

export const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
export const variance = (a, ddof = 0) => { const m = mean(a); return a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - ddof); };
export const std = (a, ddof = 1) => Math.sqrt(variance(a, ddof));

// Log-distance path-loss model, inverted: the notebook's calc_dist.
export const calcDist = (rss, a, n) => 10 ** ((rss - a) / (-10 * n));
export const calcRss = (d, a, n) => a - 10 * n * Math.log10(d);
export const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

// Weighted centroid: weight per anchor = mean of 1/d over its samples (as in the notebook).
export function wcl(captures, anchors, a, n) {
  const w = captures.map((c) => mean(c.map((r) => 1 / calcDist(r, a, n))));
  const sw = w.reduce((s, v) => s + v, 0);
  return { x: anchors.reduce((s, p, i) => s + p.x * w[i], 0) / sw, y: anchors.reduce((s, p, i) => s + p.y * w[i], 0) / sw, weights: w };
}

// Mean distance per capture: mean of per-sample distances, as in the notebook (not distance of the mean RSS).
export const meanDists = (captures, a, n) => captures.map((c) => mean(c.map((r) => calcDist(r, a, n))));

// Closed-form 3-anchor trilateration: the notebook's trilateration().
export function trilaterate([p1, p2, p3], [r1, r2, r3]) {
  const A = 2 * p2.x - 2 * p1.x, B = 2 * p2.y - 2 * p1.y;
  const C = r1 ** 2 - r2 ** 2 - p1.x ** 2 + p2.x ** 2 - p1.y ** 2 + p2.y ** 2;
  const D = 2 * p3.x - 2 * p2.x, E = 2 * p3.y - 2 * p2.y;
  const F = r2 ** 2 - r3 ** 2 - p2.x ** 2 + p3.x ** 2 - p2.y ** 2 + p3.y ** 2;
  const den = E * A - B * D;
  if (Math.abs(den) < 1e-12) return null; // collinear anchors: no unique solution
  return { x: (C * E - F * B) / den, y: (C * D - A * F) / (B * D - A * E) };
}

// Min-max (bounding box): NOT in the notebook. Added here because the repo description promises it.
// Each anchor gives a square [x-r, x+r] x [y-r, y+r]; the estimate is the centre of their intersection.
export function minMax(anchors, r) {
  const x0 = Math.max(...anchors.map((p, i) => p.x - r[i])), x1 = Math.min(...anchors.map((p, i) => p.x + r[i]));
  const y0 = Math.max(...anchors.map((p, i) => p.y - r[i])), y1 = Math.min(...anchors.map((p, i) => p.y + r[i]));
  // empty: the squares do not overlap (x0 > x1 or y0 > y1); the "centre" is then the midpoint of crossed bounds.
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, box: [x0, y0, x1, y1], empty: x0 > x1 || y0 > y1 };
}

// Baselines (not in the notebook). Nearest anchor: the anchor with the smallest estimated distance.
export function nearestAnchor(anchors, r) {
  const i = r.indexOf(Math.min(...r));
  return { x: anchors[i].x, y: anchors[i].y, index: i };
}
// Unweighted centroid of the anchors: ignores the signal entirely, so any method should beat it.
export const centroid = (anchors) => ({ x: mean(anchors.map((p) => p.x)), y: mean(anchors.map((p) => p.y)) });

export function estimateAll({ wifi, ble, anchors, wifiAN, bleAN }) {
  const rw = meanDists(wifi, wifiAN.a, wifiAN.n), rb = meanDists(ble, bleAN.a, bleAN.n);
  return { wcl: wcl(wifi, anchors, wifiAN.a, wifiAN.n), tri: trilaterate(anchors, rb), minmax: minMax(anchors, rb), nearest: nearestAnchor(anchors, rw), centroid: centroid(anchors), rWifi: rw, rBle: rb };
}

// Two-point fit of RSS = A - 10 n log10(d), then predict the held-out distance (leave-one-out calibration).
export function fitAN(points) {
  const xs = points.map((p) => Math.log10(p.d)), ys = points.map((p) => p.rss);
  const mx = mean(xs), my = mean(ys);
  const slope = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  return { a: my - slope * mx, n: -slope / 10 };
}
export function leaveOneOut(points) {
  return points.map((held, i) => {
    const fit = fitAN(points.filter((_, j) => j !== i));
    const pred = calcDist(held.rss, fit.a, fit.n);
    return { d: held.d, rss: held.rss, ...fit, pred, err: pred - held.d };
  });
}

// Seeded PRNG (mulberry32) and a standard normal draw (Box-Muller).
export function rng(seed) {
  let s = seed >>> 0;
  const u = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const randn = () => Math.sqrt(-2 * Math.log(1 - u())) * Math.cos(2 * Math.PI * u());
  return { u, randn };
}

// Bootstrap: draw k samples with replacement from each recorded capture, re-estimate, repeat B times.
export function bootstrap({ wifi, ble, anchors, wifiAN, bleAN, k, B = 400, seed = 7, truth = TRUTH }) {
  const { u } = rng(seed);
  const draw = (c) => Array.from({ length: k }, () => c[Math.floor(u() * c.length)]);
  const out = { wcl: [], tri: [], minmax: [] };
  for (let b = 0; b < B; b++) {
    const e = estimateAll({ wifi: wifi.map(draw), ble: ble.map(draw), anchors, wifiAN, bleAN });
    for (const m of ['wcl', 'tri', 'minmax']) if (e[m]) out[m].push({ x: e[m].x, y: e[m].y, err: dist(e[m], truth) });
  }
  return out;
}
export const quantile = (a, q) => { const s = [...a].sort((x, y) => x - y); const i = (s.length - 1) * q, lo = Math.floor(i); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo); };

// The notebook's Kalman demo (getMeasurement + filter), ported with a seeded PRNG.
// Synthetic only: the notebook never ran it on the RSS or position data.
export function kalmanDemo({ seed = 1, R = 10, Q = [1, 3], steps = 300, noise = 8 } = {}) {
  const { randn } = rng(seed);
  const dt = 0.1;
  let pos = 0, vel = -80; // getMeasurement's initial state
  let x = [0, 20], P = [[5, 0], [0, 5]]; // filter's initial state
  const rows = [];
  for (let k = 1; k < steps; k++) {
    const w = noise * randn(), v = noise * randn();
    const z = pos + vel * dt + v;
    pos = z - v; vel = 80 + w;
    // predict: x_p = A x, P_p = A P A^T + Q with A = [[1, dt], [0, 1]]
    const xp = [x[0] + dt * x[1], x[1]];
    const Pp = [
      [P[0][0] + dt * (P[1][0] + P[0][1]) + dt * dt * P[1][1] + Q[0], P[0][1] + dt * P[1][1]],
      [P[1][0] + dt * P[1][1], P[1][1] + Q[1]],
    ];
    const S = Pp[0][0] + R, K = [Pp[0][0] / S, Pp[1][0] / S];
    const res = z - xp[0];
    x = [xp[0] + K[0] * res, xp[1] + K[1] * res];
    P = [[Pp[0][0] - K[0] * Pp[0][0], Pp[0][1] - K[0] * Pp[0][1]], [Pp[1][0] - K[1] * Pp[0][0], Pp[1][1] - K[1] * Pp[0][1]]];
    rows.push({ k, z, truePos: pos, est: x[0], vel: x[1], sigma3: 3 * Math.sqrt(P[0][0]) });
  }
  return rows;
}

// dynamichall.csv: "mm:ss.s" timestamps and 6 RSS channels. A 0 means "no reading yet".
export function parseHall(text) {
  const lines = text.trim().split(/\r?\n/);
  const names = lines[0].split(',').slice(1);
  const rows = lines.slice(1).map((l) => l.split(','));
  const toSec = (s) => { const [m, sec] = s.split(':'); return +m * 60 + +sec; };
  const t0 = toSec(rows[0][0]);
  return { names, t: rows.map((r) => +(toSec(r[0]) - t0).toFixed(1)), ch: names.map((_, j) => rows.map((r) => +r[j + 1])) };
}
export function channelStats(values, zerosAsMissing) {
  const v = zerosAsMissing ? values.filter((x) => x !== 0) : values;
  return { n: v.length, mean: mean(v), std: std(v, 1) };
}
