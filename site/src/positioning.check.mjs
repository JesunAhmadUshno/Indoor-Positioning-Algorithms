// Known-answer check, run before every build (npm run build). It reads the repo's CSVs and asserts that
// positioning.js reproduces the numbers printed in "Indoor Localisation Using RSS.ipynb".
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as P from './positioning.js';

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
const close = (got, want, tol, what) => assert.ok(Math.abs(got - want) <= tol, `${what}: got ${got}, want ${want} (tol ${tol})`);

const WIFI = ['Wifi_ap_0.5.csv', 'Wifi_ap_1.csv', 'Wifi_ap_1.5.csv'], BLE = ['beacon1.csv', 'beacon2.csv', 'beacon3.csv'];
const wifi = WIFI.map((f) => P.parseColumn(read(f)).values), ble = BLE.map((f) => P.parseColumn(read(f)).values);

// Sample counts after genfromtxt-style loading.
assert.deepEqual(wifi.map((c) => c.length), [49, 49, 49]);
assert.deepEqual(ble.map((c) => c.length), [89, 122, 138]);

// Notebook cell "Wifi Positioning".
[0.1590444776299875, 0.22748854686164108, 0.050504848955032974].forEach((v, i) => close(P.variance(wifi[i]), v, 1e-12, `wifi var ${i}`));
const rw = P.meanDists(wifi, -36, 1.5);
[0.46902391423662665, 1.0340159083677651, 1.4878178790157683].forEach((v, i) => close(rw[i], v, 1e-12, `wifi dist ${i}`));
const w = P.wcl(wifi, P.ANCHORS, -36, 1.5);
close(w.x, 1.5160246669702728, 1e-12, 'wcl x');
close(w.y, 0.25686081359369217, 1e-12, 'wcl y');
close(P.dist(w, P.TRUTH), 0.2573601902228113, 1e-12, 'wcl error');

// Keeping the BOM sample instead moves WCL x by about 0.0004 m (the page offers this as a toggle).
const wifiBom = WIFI.map((f) => P.parseColumn(read(f), { keepBom: true }).values);
assert.deepEqual(wifiBom.map((c) => c.length), [50, 50, 50]);
close(P.wcl(wifiBom, P.ANCHORS, -36, 1.5).x, 1.5157, 5e-4, 'wcl x with BOM sample');

// Notebook cell "trilateration".
[3.157251021690227, 6.524032840870201, 4.11028176542816].forEach((v, i) => close(P.variance(ble[i]), v, 1e-12, `ble var ${i}`));
const rb = P.meanDists(ble, -90, 3);
[0.5103504799195734, 1.0404103990237048, 1.154613588087402].forEach((v, i) => close(rb[i], v, 1e-12, `ble dist ${i}`));
const t = P.trilaterate(P.ANCHORS, rb);
close(t.x, 1.2681687313604815, 1e-12, 'tri x');
close(t.y, -0.15191372734102215, 1e-12, 'tri y');
close(P.dist(t, P.TRUTH), 0.27717055701075294, 1e-12, 'tri error');

// Min-max is new (not in the notebook): check it against a hand-worked box on exact distances.
const mm = P.minMax(P.ANCHORS, [0.5, 1, 1.5]);
// x: max(1.5, 0.5, -1.5)=1.5, min(2.5, 2.5, 1.5)=1.5; y: max(-0.5, 0, -1.5)=0, min(0.5, 2, 1.5)=0.5.
assert.deepEqual(mm.box, [1.5, 0, 1.5, 0.5]);
assert.deepEqual([mm.x, mm.y], [1.5, 0.25]);

// Default min-max on the notebook's BLE distances: the three squares do not overlap in x
// (max left edge 2 - 0.5104 = 1.4896 > min right edge 0 + 1.1546), so the box is empty.
const mmDef = P.minMax(P.ANCHORS, rb);
assert.equal(mmDef.empty, true);
close(mmDef.box[0], 2 - rb[0], 1e-12, 'minmax x0'); close(mmDef.box[2], rb[2], 1e-12, 'minmax x1');
assert.equal(mm.empty, false);

// Baselines (new): nearest anchor on Wi-Fi distances is anchor 1 at (2, 0), 0.5 m from the tag;
// the unweighted anchor centroid is (7/6, 1/3), sqrt(2)/3 = 0.4714 m from the tag.
const near = P.nearestAnchor(P.ANCHORS, rw);
assert.deepEqual(near, { x: 2, y: 0, index: 0 });
assert.equal(P.nearestAnchor(P.ANCHORS, rb).index, 0);
close(P.dist(near, P.TRUTH), 0.5, 1e-12, 'nearest error');
const cen = P.centroid(P.ANCHORS);
close(cen.x, 7 / 6, 1e-12, 'centroid x'); close(cen.y, 1 / 3, 1e-12, 'centroid y');
close(P.dist(cen, P.TRUTH), Math.SQRT2 / 3, 1e-12, 'centroid error');
const all = P.estimateAll({ wifi, ble, anchors: P.ANCHORS, wifiAN: P.WIFI_PRESET, bleAN: P.BLE_PRESET });
assert.deepEqual([all.nearest.index, all.centroid.x, all.minmax.empty], [0, cen.x, true]);

// Leave-one-out calibration: a two-point fit through exact model points recovers A and n.
const exact = [0.5, 1, 1.5].map((d) => ({ d, rss: P.calcRss(d, -36, 1.5) }));
P.leaveOneOut(exact).forEach((r) => { close(r.a, -36, 1e-9, 'loo a'); close(r.n, 1.5, 1e-9, 'loo n'); close(r.err, 0, 1e-9, 'loo err'); });

// dynamichall.csv statistics (pandas std, ddof=1), and the numpy ddof=0 value the notebook also prints.
const hall = P.parseHall(read('dynamichall.csv'));
assert.equal(hall.t.length, 247);
[6.597240621565514, 11.80880234307116, 12.526858672857147, 13.093887369386689, 14.43170874978187, 16.13561544055986]
  .forEach((v, j) => close(P.channelStats(hall.ch[j], false).std, v, 1e-9, `hall std ${j}`));
[-85.02834008097166, -78.7165991902834, -78.82995951417004, -82.03643724696356, -78.8502024291498, -79.93927125506073]
  .forEach((v, j) => close(P.channelStats(hall.ch[j], false).mean, v, 1e-9, `hall mean ${j}`));
close(P.std(hall.ch[5], 0), 16.10291912440817, 1e-9, 'hall std ddof0');
const t1 = P.channelStats(hall.ch[0], true).std;
close(t1, 3.75, 0.005, 'Topic1 std with zeros dropped');

// Kalman: the hand-expanded 2x2 update must equal a generic matrix implementation on the same seed.
const mm2 = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((s, v, k) => s + v * B[k][j], 0)));
const tr = (A) => A[0].map((_, j) => A.map((r) => r[j]));
{
  const { randn } = P.rng(3), dt = 0.1, A = [[1, dt], [0, 1]], H = [[1, 0]], Q = [[1, 0], [0, 3]], R = 10;
  let pos = 0, vel = -80, x = [[0], [20]], Pm = [[5, 0], [0, 5]];
  const ref = [];
  for (let k = 1; k < 300; k++) {
    const wn = 8 * randn(), v = 8 * randn(), z = pos + vel * dt + v; pos = z - v; vel = 80 + wn;
    const xp = mm2(A, x), Pp = mm2(mm2(A, Pm), tr(A)).map((r, i) => r.map((c, j) => c + Q[i][j]));
    const S = mm2(mm2(H, Pp), tr(H))[0][0] + R, K = mm2(Pp, tr(H)).map((r) => [r[0] / S]);
    const res = z - mm2(H, xp)[0][0];
    x = xp.map((r, i) => [r[0] + K[i][0] * res]);
    const KHP = mm2(mm2(K, H), Pp); Pm = Pp.map((r, i) => r.map((c, j) => c - KHP[i][j]));
    ref.push([x[0][0], x[1][0], Pm[0][0]]);
  }
  const got = P.kalmanDemo({ seed: 3 });
  ref.forEach((r, i) => { close(got[i].est, r[0], 1e-9, `kf pos ${i}`); close(got[i].vel, r[1], 1e-9, `kf vel ${i}`); close(got[i].sigma3, 3 * Math.sqrt(r[2]), 1e-9, `kf sigma ${i}`); });
}

// Bootstrap is deterministic for a fixed seed.
const b1 = P.bootstrap({ wifi, ble, anchors: P.ANCHORS, wifiAN: P.WIFI_PRESET, bleAN: P.BLE_PRESET, k: 20, B: 50, seed: 11 });
const b2 = P.bootstrap({ wifi, ble, anchors: P.ANCHORS, wifiAN: P.WIFI_PRESET, bleAN: P.BLE_PRESET, k: 20, B: 50, seed: 11 });
assert.deepEqual(b1, b2);

console.log('positioning ok', { wcl: [w.x, w.y], tri: [t.x, t.y], topic1StdNoZeros: t1 });
