// 통계 함수 (외부 라이브러리 없이 구현, tests/test_stats.mjs 에서 scipy 값과 비교 검증)

export function erfc(x) {
  // Numerical Recipes erfcc: 상대 오차 < 1.2e-7
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}

export const normCdf = (x) => 0.5 * erfc(-x / Math.SQRT2);

/** 표준정규 분위수 (Acklam 근사 + Halley 보정 1회) */
export function normInv(p) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  let x;
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= 1 - pl) {
    const q = p - 0.5;
    const r = q * q;
    x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const e = normCdf(x) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  return x - u / (1 + (x * u) / 2);
}

export function lgamma(x) {
  const g = 7;
  const coef = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1;
  let a = coef[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += coef[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

function betacf(a, b, x) {
  const MAXIT = 300;
  const EPS = 3e-14;
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let hh = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; hh *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    hh *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return hh;
}

/** 정규화된 불완전 베타 함수 I_x(a, b) */
export function betainc(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Student t CDF */
export function tCdf(t, df) {
  if (!Number.isFinite(df) || df > 1e7) return normCdf(t);
  const x = df / (df + t * t);
  const tail = 0.5 * betainc(x, df / 2, 0.5);
  return t > 0 ? 1 - tail : tail;
}

/** t 분포 분위수 (이분법) */
export function tInv(p, df) {
  let lo = -1e3;
  let hi = 1e3;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (tCdf(mid, df) < p) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** 정규화된 하부 불완전 감마 P(a, x) */
export function gammaincP(a, x) {
  if (x <= 0) return 0;
  const gln = lgamma(a);
  if (x < a + 1) {
    let ap = a;
    let sum = 1 / a;
    let del = sum;
    for (let n = 0; n < 1000; n++) {
      ap += 1; del *= x / ap; sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-15) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - gln);
  }
  // 연분수 (Q 계산 후 1-Q)
  let b = x + 1 - a;
  let c = 1 / 1e-300;
  let d = 1 / b;
  let hh = d;
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    hh *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - gln) * hh;
}

export const chi2Sf = (x, k) => 1 - gammaincP(k / 2, x / 2);

// ---------- A/B 테스트 계산 ----------

/** 두 비율 비교 표본 크기 (그룹별). ratio = n_t / n_c */
export function sampleSizeProportion({ p1, p2, alpha = 0.05, power = 0.8, twoSided = true, ratio = 1 }) {
  const za = normInv(1 - (twoSided ? alpha / 2 : alpha));
  const zb = normInv(power);
  const pbar = (p1 + ratio * p2) / (1 + ratio);
  const delta = Math.abs(p2 - p1);
  const nC = (za * Math.sqrt(pbar * (1 - pbar) * (1 + 1 / ratio)) + zb * Math.sqrt(p1 * (1 - p1) + (p2 * (1 - p2)) / ratio)) ** 2 / delta ** 2;
  return { nControl: Math.ceil(nC), nTreatment: Math.ceil(nC * ratio) };
}

/** 두 평균 비교 표본 크기 (그룹별, 공통 표준편차 sd) */
export function sampleSizeMean({ sd, delta, alpha = 0.05, power = 0.8, twoSided = true, ratio = 1 }) {
  const za = normInv(1 - (twoSided ? alpha / 2 : alpha));
  const zb = normInv(power);
  const nC = ((za + zb) ** 2 * sd * sd * (1 + 1 / ratio)) / (delta * delta);
  return { nControl: Math.ceil(nC), nTreatment: Math.ceil(nC * ratio) };
}

/** 두 비율 z-검정 (합동 SE로 검정, 비합동 SE로 신뢰구간) */
export function twoProportionTest({ nC, xC, nT, xT, alpha = 0.05 }) {
  const pC = xC / nC;
  const pT = xT / nT;
  const diff = pT - pC;
  const p = (xC + xT) / (nC + nT);
  const sePooled = Math.sqrt(p * (1 - p) * (1 / nC + 1 / nT));
  const z = diff / sePooled;
  const pValue = 2 * (1 - normCdf(Math.abs(z)));
  const se = Math.sqrt((pC * (1 - pC)) / nC + (pT * (1 - pT)) / nT);
  const zc = normInv(1 - alpha / 2);
  return { pC, pT, diff, rel: pC > 0 ? diff / pC : NaN, z, pValue, ci: [diff - zc * se, diff + zc * se], se };
}

/** Welch t-검정 */
export function welchTest({ mC, sC, nC, mT, sT, nT, alpha = 0.05 }) {
  const vC = (sC * sC) / nC;
  const vT = (sT * sT) / nT;
  const se = Math.sqrt(vC + vT);
  const diff = mT - mC;
  const t = diff / se;
  const df = (vC + vT) ** 2 / ((vC * vC) / (nC - 1) + (vT * vT) / (nT - 1));
  const pValue = 2 * (1 - tCdf(Math.abs(t), df));
  const tc = tInv(1 - alpha / 2, df);
  return { diff, rel: mC !== 0 ? diff / mC : NaN, t, df, pValue, ci: [diff - tc * se, diff + tc * se], se };
}

/** 카이제곱 적합도 검정 (SRM) */
export function srmTest(observed, expectedRatios) {
  const total = observed.reduce((a, b) => a + b, 0);
  const rs = expectedRatios.reduce((a, b) => a + b, 0);
  const expected = expectedRatios.map((r) => (total * r) / rs);
  const chi2 = observed.reduce((s, o, i) => s + (o - expected[i]) ** 2 / expected[i], 0);
  const df = observed.length - 1;
  return { chi2, df, pValue: chi2Sf(chi2, df), expected };
}

// ---------- 난수 (시뮬레이터용) ----------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randNormal(rand) {
  let u = 0;
  while (u === 0) u = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/** 이항분포 샘플 (n이 크면 정규 근사) */
export function randBinomial(rand, n, p) {
  if (n * p < 30 || n * (1 - p) < 30) {
    let x = 0;
    for (let i = 0; i < n; i++) if (rand() < p) x++;
    return x;
  }
  const x = Math.round(n * p + Math.sqrt(n * p * (1 - p)) * randNormal(rand));
  return Math.min(n, Math.max(0, x));
}
