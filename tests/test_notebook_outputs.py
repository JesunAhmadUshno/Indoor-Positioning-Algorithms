"""Smoke test: the notebook's printed results reproduce from the committed CSVs.

Re-implements the notebook's loading and maths with numpy only (no pandas or matplotlib needed).
Run from the repo root: python -m unittest discover tests
"""
import csv
import math
import unittest
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
ANCHORS = [(2, 0), (1.5, 1), (0, 0)]
TRUTH = (1.5, 0)


def load(name):
    # np.genfromtxt, as the notebook uses: BOM-prefixed first value and header strings become NaN.
    a = np.genfromtxt(ROOT / name, delimiter=",")
    return a[~np.isnan(a)]


def calc_dist(rss, a, n):
    return 10 ** ((rss - a) / (-10 * n))


def trilateration(p1, r1, p2, r2, p3, r3):
    (x1, y1), (x2, y2), (x3, y3) = p1, p2, p3
    A, B = 2 * x2 - 2 * x1, 2 * y2 - 2 * y1
    C = r1**2 - r2**2 - x1**2 + x2**2 - y1**2 + y2**2
    D, E = 2 * x3 - 2 * x2, 2 * y3 - 2 * y2
    F = r2**2 - r3**2 - x2**2 + x3**2 - y2**2 + y3**2
    return (C * E - F * B) / (E * A - B * D), (C * D - A * F) / (B * D - A * E)


class NotebookOutputs(unittest.TestCase):
    def test_wifi_weighted_centroid(self):
        caps = [load(f) for f in ("Wifi_ap_0.5.csv", "Wifi_ap_1.csv", "Wifi_ap_1.5.csv")]
        self.assertEqual([len(c) for c in caps], [49, 49, 49])
        for c, want in zip(caps, [0.1590444776299875, 0.22748854686164108, 0.050504848955032974]):
            self.assertAlmostEqual(np.var(c), want, places=10)
        w = np.array([np.mean(1 / calc_dist(c, -36, 1.5)) for c in caps])
        x = np.dot([p[0] for p in ANCHORS], w) / w.sum()
        y = np.dot([p[1] for p in ANCHORS], w) / w.sum()
        self.assertAlmostEqual(x, 1.5160246669702728, places=10)
        self.assertAlmostEqual(y, 0.25686081359369217, places=10)
        self.assertAlmostEqual(math.dist((x, y), TRUTH), 0.2573601902228113, places=10)

    def test_ble_trilateration(self):
        caps = [load(f) for f in ("beacon1.csv", "beacon2.csv", "beacon3.csv")]
        self.assertEqual([len(c) for c in caps], [89, 122, 138])
        r = [np.mean(calc_dist(c, -90, 3)) for c in caps]
        for got, want in zip(r, [0.5103504799195734, 1.0404103990237048, 1.154613588087402]):
            self.assertAlmostEqual(got, want, places=10)
        x, y = trilateration(ANCHORS[0], r[0], ANCHORS[1], r[1], ANCHORS[2], r[2])
        self.assertAlmostEqual(x, 1.2681687313604815, places=10)
        self.assertAlmostEqual(y, -0.15191372734102215, places=10)
        self.assertAlmostEqual(math.dist((x, y), TRUTH), 0.27717055701075294, places=10)

    def test_dynamichall_std_counts_zeros(self):
        with open(ROOT / "dynamichall.csv", newline="") as f:
            rows = list(csv.reader(f))[1:]
        cols = np.array([[float(v) for v in r[1:]] for r in rows]).T
        self.assertEqual(cols.shape, (6, 247))
        want = [6.597240621565514, 11.80880234307116, 12.526858672857147,
                13.093887369386689, 14.43170874978187, 16.13561544055986]
        for c, w in zip(cols, want):
            self.assertAlmostEqual(np.std(c, ddof=1), w, places=9)
        # Treating the 0 dBm placeholders as missing roughly halves the spread.
        self.assertAlmostEqual(np.std(cols[0][cols[0] != 0], ddof=1), 3.75, places=2)


if __name__ == "__main__":
    unittest.main()
