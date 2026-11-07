# Research review

A review of this repository against a PhD-level research rubric. It is coursework, so the grade is a measure of distance to publishable evidence, not a judgement of the coursework itself.

**Overall: about C as coursework, D against a PhD rubric.** The notebook's printed outputs reproduce exactly from the committed CSVs (see `tests/` and `site/src/positioning.check.mjs`), but the evaluation is one point, the calibration is not held out, and the setup is undocumented.

## Grades

| Criterion | Grade | Evidence |
|---|---|---|
| Research question | D | No question is stated. Implied: how accurately can RSSI-based weighted centroid and trilateration locate a tag indoors? |
| Hypotheses | F | None stated, so nothing could be falsified. |
| Method | C | Standard log-distance path-loss model, weighted centroid with weights mean(1/d), closed-form 3-anchor trilateration. Correctly implemented (reproduced to 1e-12). |
| Baselines | F (now C) | No baseline in the notebook. The dashboard now adds min-max and two baselines from the same data: nearest anchor on Wi-Fi distances (anchor at (2, 0), 0.500 m error) and the unweighted anchor centroid, which ignores the signal ((7/6, 1/3), 0.471 m). Weighted centroid (0.257 m) and trilateration (0.277 m) beat both, but with one test point that is not evidence of a general margin. Min-max lands 0.295 m away, but at the default settings its box is empty (the BLE squares do not overlap in x: left edge 1.490 > right edge 1.155), so that point is the midpoint of crossed bounds, not a true intersection. All values are asserted in `positioning.check.mjs`. Fingerprinting is still missing. |
| Statistics and uncertainty | F (now D) | Single point estimates only. The dashboard now adds a seeded bootstrap over the recorded samples, which bounds sampling noise but not position or environment variation. |
| Calibration and validation | F (now D) | A and n appear tuned on the scored captures. The dashboard now shows a leave-one-out fit (fit A and n on two distances, predict the third): held-out distance errors of -0.083, +0.059 and -0.121 m for Wi-Fi. |
| Reproducibility | B (was C) | Data and notebook are committed and outputs reproduce. Added: README, requirements.txt, a Python smoke test and a JS known-answer check run on every build. Still missing: pinned versions and the two scripts the notebook names. |
| Threats to validity | D (was F) | Now listed in the README and on the dashboard: one point, in-sample calibration, BOM and header data loss, zero placeholders, mislabelled plots. |
| Related work | F | No citations. The log-distance model, weighted centroid and min-max are textbook methods; the repo does not position itself against any prior work. |
| Limitations | D (was F) | Now written down (README, dashboard). |

## Fixed in this pass (cheap)

1. README with the setup as far as the code shows, the reproduced results and the limitations.
2. `tests/test_notebook_outputs.py`: reproduces the notebook's Wi-Fi, BLE and moving-capture numbers from the CSVs with numpy only.
3. `site/src/positioning.js` + `positioning.check.mjs`: a JS port, asserted against the notebook outputs before every site build.
4. Min-max positioning, labelled as new, with a flag for an empty box (the default case). Nearest-anchor and unweighted-centroid baselines on the floor plan.
5. Zero-excluded statistics for `dynamichall.csv` alongside the notebook's (Topic1 SD 6.60 with zeros, 3.75 without).
6. Leave-one-out calibration and a seeded bootstrap of position error.
7. Documented the BOM sample loss, the dropped beacon header lines and the SAT4/SAT5 plot mislabel. The notebook itself is left unchanged so its recorded outputs stay as they were.

## Remaining gaps and what each needs

| Gap | What closes it |
|---|---|
| One test point | New data collection: at least 10 to 20 surveyed tag positions on a grid across the same room, about 50 samples per anchor per position (the current capture size). Then report mean, median and 90th-percentile error with a CDF. No compute cost. |
| In-sample calibration | Separate calibration captures at known distances (for example 0.5 to 3 m in 0.5 m steps per anchor), recorded on a different session from the test captures. |
| Undocumented setup | The room dimensions, device models (AP, beacon, receiver), heights, orientations and dates. Only the original experimenter can supply these. |
| No environmental replication | Repeat captures on at least two days and with the tag rotated, to separate multipath and body shadowing from model error. |
| Missing baselines | Nearest-anchor and unweighted centroid are now done. Fingerprinting (k-NN on RSS vectors) needs the grid survey above: a radio map of at least 10 to 20 surveyed positions, with separate test captures. |
| Kalman filter never applied to real data | A recorded trajectory with ground truth (for example a walked path with timed markers) to filter and score. The current `dynamichall.csv` has no ground-truth positions. |
| Related work | A short literature section: log-distance path loss (Rappaport, Wireless Communications), weighted centroid localisation (Blumenthal et al., 2007) and min-max (Savvides et al., 2001), checked against the original papers before citing. |
| Version pins | Record the exact numpy/pandas/matplotlib versions used to produce the notebook outputs; the originals are unknown. |
