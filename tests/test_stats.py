"""web/assets/js/stats.js 의 통계 함수를 scipy 결과와 비교합니다.

    python tests/test_stats.py
"""

import json
import subprocess
import sys
from pathlib import Path

from scipy import stats

ROOT = Path(__file__).resolve().parent.parent
JS = """
const s = await import(process.argv[1]);
const out = {
  normCdf: [-3, -1.96, -0.5, 0, 0.7, 1.645, 2.5].map(s.normCdf),
  normInv: [0.001, 0.025, 0.2, 0.5, 0.8, 0.975, 0.999].map(s.normInv),
  tCdf: [[-2.1, 5], [0.3, 12], [1.7, 30], [2.6, 3500.5], [-0.8, 1.5]].map(([t, d]) => s.tCdf(t, d)),
  tInv: [[0.975, 9], [0.95, 40.3]].map(([p, d]) => s.tInv(p, d)),
  chi2Sf: [[19.65, 1], [3.2, 2], [0.5, 1], [11.3, 3], [45, 1]].map(([x, k]) => s.chi2Sf(x, k)),
  prop: s.twoProportionTest({ nC: 1811, xC: 207, nT: 1747, xT: 251 }),
  welch: s.welchTest({ mC: 52000, sC: 31000, nC: 400, mT: 55500, sT: 36000, nT: 380 }),
  srm: s.srmTest([1150, 947], [1, 1]),
  n: s.sampleSizeProportion({ p1: 0.10, p2: 0.11 }),
};
console.log(JSON.stringify(out));
"""

r = json.loads(subprocess.run(["node", "--input-type=module", "-e", JS, (ROOT / "web/assets/js/stats.js").as_uri()],
                              capture_output=True, text=True, check=True).stdout)
fails = []


def close(name, got, exp, tol=1e-6):
    if abs(got - exp) > tol * max(1, abs(exp)):
        fails.append(f"{name}: got {got}, expected {exp}")


for x, g in zip([-3, -1.96, -0.5, 0, 0.7, 1.645, 2.5], r["normCdf"]):
    close(f"normCdf({x})", g, stats.norm.cdf(x))
for p, g in zip([0.001, 0.025, 0.2, 0.5, 0.8, 0.975, 0.999], r["normInv"]):
    close(f"normInv({p})", g, stats.norm.ppf(p))
for (t, d), g in zip([[-2.1, 5], [0.3, 12], [1.7, 30], [2.6, 3500.5], [-0.8, 1.5]], r["tCdf"]):
    close(f"tCdf({t},{d})", g, stats.t.cdf(t, d))
for (p, d), g in zip([[0.975, 9], [0.95, 40.3]], r["tInv"]):
    close(f"tInv({p},{d})", g, stats.t.ppf(p, d))
for (x, k), g in zip([[19.65, 1], [3.2, 2], [0.5, 1], [11.3, 3], [45, 1]], r["chi2Sf"]):
    close(f"chi2Sf({x},{k})", g, stats.chi2.sf(x, k), tol=1e-5)

# 두 비율 검정: statsmodels 없이 scipy로 동일 계산
import math
pC, pT = 207 / 1811, 251 / 1747
p = (207 + 251) / (1811 + 1747)
z = (pT - pC) / math.sqrt(p * (1 - p) * (1 / 1811 + 1 / 1747))
close("prop.z", r["prop"]["z"], z)
close("prop.p", r["prop"]["pValue"], 2 * stats.norm.sf(abs(z)))

w = stats.ttest_ind_from_stats(55500, 36000, 380, 52000, 31000, 400, equal_var=False)
close("welch.t", r["welch"]["t"], w.statistic)
close("welch.p", r["welch"]["pvalue"] if "pvalue" in r["welch"] else r["welch"]["pValue"], w.pvalue)

srm = stats.chisquare([1150, 947])
close("srm.chi2", r["srm"]["chi2"], srm.statistic)
close("srm.p", r["srm"]["pValue"], srm.pvalue, tol=1e-4)

# 표본 크기: 10% → 11%, alpha .05, power .8 → 약 14,750 (G*Power/Evan Miller 계산기와 동일 공식)
if not 14600 <= r["n"]["nControl"] <= 14900:
    fails.append(f"sample size: {r['n']}")

if fails:
    print("FAILED"); [print(" -", f) for f in fails]; sys.exit(1)
print("stats.js: 모든 값이 scipy와 일치합니다.", r["n"])
