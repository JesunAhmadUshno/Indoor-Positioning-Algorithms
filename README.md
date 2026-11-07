# Indoor Positioning Algorithms

Weighted-centroid and trilateration positioning from recorded RSSI (received signal strength) of Wi-Fi access points and BLE beacons, plus a look at signal spread in a moving capture and a Kalman filter demo.

Live dashboard: https://jesunahmadushno.github.io/Indoor-Positioning-Algorithms/

## What is here

| File | Contents |
|---|---|
| `Indoor Localisation Using RSS.ipynb` | The analysis: path-loss distance model, weighted centroid (Wi-Fi), trilateration (BLE), standard deviations of the moving capture, Kalman filter demo |
| `Wifi_ap_0.5.csv`, `Wifi_ap_1.csv`, `Wifi_ap_1.5.csv` | 50 RSSI samples each from three Wi-Fi APs |
| `beacon1.csv`, `beacon2.csv`, `beacon3.csv` | RSSI samples from three BLE beacons (89, 122 and 138 numeric values) |
| `dynamichall.csv` | 247 rows, 6 channels, recorded at 0.1 s steps while moving |
| `site/` | The live dashboard (React + Vite); every number is computed from the CSVs |
| `tests/` | Smoke test that reproduces the notebook's printed outputs |

## Setup, as far as the data shows

The room, devices, heights and orientations were not recorded. The geometry below comes only from the notebook code.

- Anchors: (2, 0), (1.5, 1) and (0, 0) metres.
- True tag position: (1.5, 0), so the anchor-to-tag distances are 0.5, 1 and 1.5 m.
- Distance model: `d = 10^((RSS - A) / (-10 n))`, with Wi-Fi A = -36 dBm, n = 1.5 and BLE A = -90 dBm, n = 3.

## Results (reproduced by `tests/` and by the site's build check)

| Method | Estimate (x, y) | Error |
|---|---|---|
| Weighted centroid, Wi-Fi | (1.516, 0.257) | 0.257 m |
| Trilateration, BLE | (1.268, -0.152) | 0.277 m |

## Limitations

- **One test point.** Both errors come from a single tag position. They are not accuracy figures.
- **Calibration is not held out.** The Wi-Fi A = -36 is essentially the 1 m capture's own mean (-36.20 dBm), and the presets appear tuned on the same captures that are scored. The dashboard adds a leave-one-out check.
- **Silent data loss.** The Wi-Fi CSVs start with a UTF-8 byte-order mark, so `np.genfromtxt` turns the first sample into NaN and the notebook uses 49 of 50. The beacon2/3 files start with two header lines that are dropped the same way. Keeping the BOM sample moves the weighted-centroid x by about 0.0004 m.
- **Zeros in `dynamichall.csv`.** Before a channel's first reading the file stores 0 dBm. The notebook's standard deviations include those zeros (Topic1: 6.60); treating them as missing gives 3.75.
- **Plot labels.** In the notebook, `top4 = df[5]` and `top5 = df[6]`, so the "SAT 4" plot shows Topic5, "SAT 5" shows Topic6, and Topic4/Topic6 are never plotted. The notebook is left unchanged.
- **Kalman filter is synthetic.** It runs only on simulated data and never on the recorded RSSI.
- **Min-max** is mentioned in the repository description but not implemented in the notebook. The dashboard computes it as a new, clearly labelled method.
- `Trilateration.py` and `wifi.py`, named in the notebook's markdown, are not in the repository. `beacon.dot` is empty.

See [docs/research-review.md](docs/research-review.md) for a fuller review.

## Reproduce

```bash
pip install -r requirements.txt
python -m unittest discover tests        # notebook numbers, in Python
cd site && npm ci && npm run build       # same numbers checked in JavaScript, then the dashboard is built
```
