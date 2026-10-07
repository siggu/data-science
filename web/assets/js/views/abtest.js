import { h, md, store } from '../util.js';
import {
  sampleSizeProportion, sampleSizeMean, twoProportionTest, welchTest, srmTest,
  mulberry32, randBinomial, randNormal, normCdf,
} from '../stats.js';
import { lineChart, histogram, bins } from '../charts.js';

const pct = (v, d = 2) => `${(v * 100).toFixed(d)}%`;
const pp = (v, d = 2) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(d)}%p`;
const num = (v) => Math.round(v).toLocaleString();
const pfmt = (p) => (p < 0.0001 ? '< 0.0001' : p.toFixed(4));

function field(label, value, { step = 'any', min, suffix, help } = {}) {
  const input = h('input', { type: 'number', value, step, min });
  const el = h('label', { class: 'field' }, label + (suffix ? ` (${suffix})` : ''), input, help ? h('span', { class: 'small muted', style: { display: 'block', marginTop: '2px', fontWeight: 400 } }, help) : null);
  return { el, input, get: () => parseFloat(input.value) };
}

function selectField(label, options, value) {
  const sel = h('select', null, options.map(([v, t]) => h('option', { value: v, selected: String(v) === String(value) }, t)));
  return { el: h('label', { class: 'field' }, label, sel), input: sel, get: () => sel.value };
}

const TABS = [
  ['size', '표본 크기'],
  ['prop', '결과 분석 · 비율'],
  ['mean', '결과 분석 · 평균'],
  ['srm', 'SRM 검사'],
  ['sim', '시뮬레이터'],
];

export default {
  id: 'abtest',
  title: 'A/B 테스트',
  mount(el) {
    this.body = h('div');
    this.tabBar = h('div', { class: 'tabs', role: 'tablist' });
    el.append(
      h('div', { class: 'page-head' },
        h('h1', null, 'A/B 테스트 도구'),
        h('p', null, '실험 설계부터 결과 해석까지 면접과 실무에서 쓰는 계산을 직접 해보세요. 모든 계산은 브라우저에서 이루어지며 결과마다 해석 문장이 함께 나옵니다. 시뮬레이터로 피킹 문제와 p-value 분포, 중심극한정리를 눈으로 확인할 수 있습니다.')),
      this.tabBar, this.body);
    this.show(store.get('ab:tab', 'size'));
  },

  onShow(params) { if (params.tab) this.show(params.tab); },

  show(tab) {
    this.tab = tab;
    store.set('ab:tab', tab);
    this.tabBar.replaceChildren(...TABS.map(([k, label]) => h('button', {
      type: 'button', role: 'tab', class: k === tab ? 'on' : '', 'aria-selected': String(k === tab), onclick: () => this.show(k),
    }, label)));
    const view = { size: () => this.sizeView(), prop: () => this.propView(), mean: () => this.meanView(), srm: () => this.srmView(), sim: () => this.simView() }[tab] || (() => this.sizeView());
    this.body.replaceChildren(view());
  },

  // ───────── 표본 크기 ─────────
  sizeView() {
    const type = selectField('지표 유형', [['prop', '비율 (전환율, 클릭률)'], ['mean', '평균 (객단가, 체류시간)']], 'prop');
    const base = field('기준 전환율', 10, { suffix: '%', min: 0 });
    const mean = field('기준 평균', 50000, { min: 0 });
    const sd = field('표준편차', 30000, { min: 0, help: '과거 데이터에서 계산 (매출은 평균보다 큰 경우가 많음)' });
    const mdeType = selectField('MDE 기준', [['abs', '절대 (%p / 값)'], ['rel', '상대 (%)']], 'rel');
    const mde = field('MDE (최소 탐지 효과)', 10, { min: 0, help: '이보다 작은 효과는 놓쳐도 괜찮은 크기' });
    const alpha = selectField('유의수준 α', [[0.01, '0.01'], [0.05, '0.05'], [0.1, '0.10']], 0.05);
    const power = selectField('검정력 1-β', [[0.8, '80%'], [0.9, '90%'], [0.95, '95%']], 0.8);
    const sided = selectField('검정 방향', [['two', '양측'], ['one', '단측']], 'two');
    const ratio = field('배정 비율 (treatment / control)', 1, { min: 0.1, help: '50:50이면 1' });
    const traffic = field('실험에 들어오는 일 방문자', 5000, { min: 1 });
    const out = h('div', { class: 'stack' });

    const calc = () => {
      const isProp = type.get() === 'prop';
      base.el.style.display = isProp ? '' : 'none';
      mean.el.style.display = sd.el.style.display = isProp ? 'none' : '';
      const a = +alpha.get(); const pw = +power.get(); const two = sided.get() === 'two'; const r = ratio.get();
      let res; let effectText; let sens = [];
      try {
        if (isProp) {
          const p1 = base.get() / 100;
          const delta = mdeType.get() === 'rel' ? p1 * mde.get() / 100 : mde.get() / 100;
          const p2 = p1 + delta;
          if (!(p1 > 0 && p1 < 1 && p2 > 0 && p2 < 1 && delta > 0)) throw new Error('전환율과 MDE 값을 확인하세요.');
          res = sampleSizeProportion({ p1, p2, alpha: a, power: pw, twoSided: two, ratio: r });
          effectText = `${pct(p1)} → ${pct(p2)} (${pp(delta)}, 상대 ${(delta / p1 * 100).toFixed(1)}%)`;
          sens = [0.5, 0.75, 1, 1.5, 2].map((k) => ({ k, label: `${pp(delta * k)} (상대 ${(delta * k / p1 * 100).toFixed(1)}%)`, n: sampleSizeProportion({ p1, p2: p1 + delta * k, alpha: a, power: pw, twoSided: two, ratio: r }) }));
        } else {
          const m0 = mean.get();
          const delta = mdeType.get() === 'rel' ? m0 * mde.get() / 100 : mde.get();
          if (!(delta > 0 && sd.get() > 0)) throw new Error('평균, 표준편차, MDE 값을 확인하세요.');
          res = sampleSizeMean({ sd: sd.get(), delta, alpha: a, power: pw, twoSided: two, ratio: r });
          effectText = `${num(m0)} → ${num(m0 + delta)} (+${num(delta)}, 상대 ${(delta / m0 * 100).toFixed(1)}%)`;
          sens = [0.5, 0.75, 1, 1.5, 2].map((k) => ({ k, label: `+${num(delta * k)}`, n: sampleSizeMean({ sd: sd.get(), delta: delta * k, alpha: a, power: pw, twoSided: two, ratio: r }) }));
        }
      } catch (e) {
        out.replaceChildren(h('div', { class: 'callout bad' }, e.message));
        return;
      }
      const total = res.nControl + res.nTreatment;
      const days = Math.ceil(total / traffic.get());
      const weeks = Math.max(1, Math.ceil(days / 7));
      out.replaceChildren(
        h('div', { class: 'grid grid-3' },
          kpi(num(res.nControl), 'control 표본'),
          kpi(num(res.nTreatment), 'treatment 표본'),
          kpi(`${days}일`, `최소 기간 → 권장 ${weeks * 7}일 (${weeks}주)`)),
        h('div', { class: 'callout info md', html: md(`**해석**: ${effectText}의 효과를 α=${a}, 검정력 ${pw * 100}%로 탐지하려면 총 **${num(total)}명**이 필요합니다. 일 ${num(traffic.get())}명 기준 **${days}일**이 걸리며, 요일 효과를 고려해 **${weeks}주(7일 단위)**로 운영하길 권장합니다. 실제 효과가 MDE보다 작으면 이 실험으로는 유의한 결과를 얻기 어렵습니다.`) }),
        h('div', null, h('h4', null, 'MDE에 따른 필요 표본 (그룹당 control 기준)'),
          h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
            h('thead', null, h('tr', null, h('th', null, 'MDE'), h('th', null, 'control'), h('th', null, '총 인원'), h('th', null, '기간'))),
            h('tbody', null, sens.map((x) => h('tr', { style: x.k === 1 ? { fontWeight: 600 } : null },
              h('td', null, x.label), h('td', null, num(x.n.nControl)), h('td', null, num(x.n.nControl + x.n.nTreatment)),
              h('td', null, `${Math.ceil((x.n.nControl + x.n.nTreatment) / traffic.get())}일`)))))),
          h('p', { class: 'small muted', style: { marginTop: '6px' } }, 'MDE를 절반으로 줄이면 필요한 표본은 약 4배가 됩니다 (효과 크기의 제곱에 반비례).')));
    };
    const inputs = [type, base, mean, sd, mdeType, mde, alpha, power, sided, ratio, traffic];
    inputs.forEach((f) => f.input.addEventListener('input', calc));
    queueMicrotask(calc);
    return h('div', { class: 'grid grid-2' },
      h('div', { class: 'card stack' }, h('h3', null, '실험 설계 입력'), h('div', { class: 'field-grid' }, inputs.map((f) => f.el))),
      h('div', { class: 'card stack' }, h('h3', null, '결과'), out,
        h('details', null, h('summary', { style: { cursor: 'pointer' } }, '공식 보기'),
          h('div', { class: 'md small', html: md(`
            **두 비율**: n = (z₁₋α/₂·√(p̄(1-p̄)(1+1/k)) + z₁₋β·√(p₁(1-p₁) + p₂(1-p₂)/k))² / (p₂-p₁)²
            **두 평균**: n = (z₁₋α/₂ + z₁₋β)² · σ² · (1+1/k) / δ²
            (k = treatment/control 비율, n = control 그룹 인원)
          `) }))));
  },

  // ───────── 비율 결과 분석 ─────────
  propView() {
    const nC = field('control 인원', 1811, { min: 1 });
    const xC = field('control 전환', 207, { min: 0 });
    const nT = field('treatment 인원', 1747, { min: 1 });
    const xT = field('treatment 전환', 251, { min: 0 });
    const alpha = selectField('유의수준 α', [[0.01, '0.01'], [0.05, '0.05'], [0.1, '0.10']], 0.05);
    const out = h('div', { class: 'stack' });
    const load = (a, b, c, d) => { nC.input.value = a; xC.input.value = b; nT.input.value = c; xT.input.value = d; calc(); };
    const calc = () => {
      const a = +alpha.get();
      const v = { nC: nC.get(), xC: xC.get(), nT: nT.get(), xT: xT.get() };
      if (!(v.nC > 0 && v.nT > 0 && v.xC >= 0 && v.xT >= 0 && v.xC <= v.nC && v.xT <= v.nT)) {
        out.replaceChildren(h('div', { class: 'callout bad' }, '전환 수는 0 이상, 인원 이하여야 합니다.'));
        return;
      }
      const r = twoProportionTest({ ...v, alpha: a });
      const srm = srmTest([v.nC, v.nT], [1, 1]);
      const sig = r.pValue < a;
      const ciPos = r.ci[0] > 0; const ciNeg = r.ci[1] < 0;
      out.replaceChildren(
        srm.pValue < 0.001 ? h('div', { class: 'callout bad md', html: md(`⚠️ **SRM 의심**: 50:50 배정 기준으로 인원 비율이 크게 다릅니다 (χ²=${srm.chi2.toFixed(2)}, p=${pfmt(srm.pValue)}). 배정이나 로깅에 문제가 있을 수 있어 **아래 결과를 신뢰하기 어렵습니다.** SRM 검사 탭에서 확인하세요.`) }) : null,
        h('div', { class: 'grid grid-3' },
          kpi(pct(r.pC), 'control 전환율'), kpi(pct(r.pT), 'treatment 전환율'),
          kpi(pp(r.diff), `차이 (상대 ${(r.rel * 100).toFixed(1)}%)`)),
        h('div', { class: 'table-wrap' }, h('table', { class: 'data' }, h('tbody', null,
          row('z 통계량', r.z.toFixed(3)),
          row('p-value (양측)', pfmt(r.pValue)),
          row(`${(1 - a) * 100}% 신뢰구간 (차이)`, `[${pp(r.ci[0])}, ${pp(r.ci[1])}]`),
          row('SRM 검사 p-value (50:50 가정)', pfmt(srm.pValue))))),
        h('div', { class: `callout ${sig ? 'good' : 'warn'} md`, html: md(sig
          ? `**통계적으로 유의합니다** (p = ${pfmt(r.pValue)} < α = ${a}). treatment의 전환율이 ${r.diff > 0 ? '높습니다' : '낮습니다'}. 실제 효과는 ${(1 - a) * 100}% 신뢰구간 기준 **${pp(r.ci[0])} ~ ${pp(r.ci[1])}** 범위로 추정됩니다. ${ciPos ? '하한도 0보다 크므로, 하한 수준의 효과로도 비즈니스적으로 의미가 있는지 판단해 출시를 결정하세요.' : ciNeg ? '구간 전체가 음수이므로 treatment가 더 나쁩니다.' : ''}`
          : `**통계적으로 유의하지 않습니다** (p = ${pfmt(r.pValue)} ≥ α = ${a}). 다만 이것이 "효과가 없다"는 뜻은 아닙니다. 신뢰구간 **${pp(r.ci[0])} ~ ${pp(r.ci[1])}**가 ${Math.abs(r.ci[1] - r.ci[0]) > 0.02 ? '넓으므로 검정력이 부족했을 수 있습니다. 표본 크기 탭에서 필요한 인원을 확인해 보세요.' : '비교적 좁습니다. 구간 상한이 비즈니스적으로 의미 있는 최소 효과(MDE)보다 작다면 의미 있는 효과는 없다고 볼 수 있고, 그렇지 않다면 판단을 보류하세요.'}`) }));
    };
    [nC, xC, nT, xT, alpha].forEach((f) => f.input.addEventListener('input', calc));
    queueMicrotask(calc);
    return h('div', { class: 'grid grid-2' },
      h('div', { class: 'card stack' },
        h('h3', null, '실험 결과 입력'),
        h('div', { class: 'field-grid' }, [nC, xC, nT, xT, alpha].map((f) => f.el)),
        h('div', { class: 'row' },
          h('span', { class: 'small muted' }, '샘플 데이터:'),
          h('button', { class: 'btn sm', type: 'button', onclick: () => load(1811, 207, 1747, 251) }, 'checkout_button_v2'),
          h('button', { class: 'btn sm', type: 'button', onclick: () => load(1150, 115, 947, 113) }, 'free_shipping_banner')),
        h('div', { class: 'md small muted', html: md('플레이그라운드에서 `SELECT experiment, variant, COUNT(*), SUM(converted) FROM ab_test GROUP BY ALL`로 숫자를 직접 뽑아 넣어보세요. 검정은 합동 표준오차 z-검정, 신뢰구간은 비합동 표준오차(Wald)를 사용합니다.') })),
      h('div', { class: 'card stack' }, h('h3', null, '분석 결과'), out));
  },

  // ───────── 평균 결과 분석 ─────────
  meanView() {
    const f = {
      mC: field('control 평균', 52000), sC: field('control 표준편차', 31000, { min: 0 }), nC: field('control 인원', 400, { min: 2 }),
      mT: field('treatment 평균', 55500), sT: field('treatment 표준편차', 36000, { min: 0 }), nT: field('treatment 인원', 380, { min: 2 }),
    };
    const alpha = selectField('유의수준 α', [[0.01, '0.01'], [0.05, '0.05'], [0.1, '0.10']], 0.05);
    const out = h('div', { class: 'stack' });
    const calc = () => {
      const v = Object.fromEntries(Object.entries(f).map(([k, x]) => [k, x.get()]));
      const a = +alpha.get();
      if (!(v.nC >= 2 && v.nT >= 2 && v.sC > 0 && v.sT > 0)) { out.replaceChildren(h('div', { class: 'callout bad' }, '인원은 2 이상, 표준편차는 0보다 커야 합니다.')); return; }
      const r = welchTest({ ...v, alpha: a });
      const sig = r.pValue < a;
      out.replaceChildren(
        h('div', { class: 'grid grid-3' }, kpi(num(v.mC), 'control 평균'), kpi(num(v.mT), 'treatment 평균'), kpi(`${r.diff >= 0 ? '+' : ''}${num(r.diff)}`, `차이 (상대 ${(r.rel * 100).toFixed(1)}%)`)),
        h('div', { class: 'table-wrap' }, h('table', { class: 'data' }, h('tbody', null,
          row('Welch t 통계량', r.t.toFixed(3)), row('자유도 (Welch-Satterthwaite)', r.df.toFixed(1)),
          row('p-value (양측)', pfmt(r.pValue)), row(`${(1 - a) * 100}% 신뢰구간 (차이)`, `[${num(r.ci[0])}, ${num(r.ci[1])}]`)))),
        h('div', { class: `callout ${sig ? 'good' : 'warn'} md`, html: md(sig
          ? `**통계적으로 유의합니다** (p = ${pfmt(r.pValue)}). 평균 차이는 ${num(r.ci[0])} ~ ${num(r.ci[1])} 범위로 추정됩니다.`
          : `**통계적으로 유의하지 않습니다** (p = ${pfmt(r.pValue)}). 매출처럼 분산이 큰 지표는 같은 효과를 탐지하는 데 훨씬 많은 표본이 필요합니다. 분산 감소(CUPED), 이상치 윈저라이징, 로그 변환을 검토해 보세요.`) }),
        h('div', { class: 'md small muted', html: md('매출 데이터는 오른쪽으로 긴 꼬리를 가지므로, 표본이 작으면 t-검정의 정규 근사가 부정확할 수 있습니다. 부트스트랩으로 평균 차이의 신뢰구간을 구하는 방법도 많이 씁니다.') }));
    };
    [...Object.values(f), alpha].forEach((x) => x.input.addEventListener('input', calc));
    queueMicrotask(calc);
    return h('div', { class: 'grid grid-2' },
      h('div', { class: 'card stack' }, h('h3', null, '그룹별 요약 통계'), h('div', { class: 'field-grid' }, [...Object.values(f), alpha].map((x) => x.el))),
      h('div', { class: 'card stack' }, h('h3', null, '분석 결과'), out));
  },

  // ───────── SRM ─────────
  srmView() {
    const groups = [
      { name: 'control', n: field('control 인원', 1150, { min: 0 }), r: field('설계 비율', 50, { min: 0 }) },
      { name: 'treatment', n: field('treatment 인원', 947, { min: 0 }), r: field('설계 비율', 50, { min: 0 }) },
    ];
    const out = h('div', { class: 'stack' });
    const calc = () => {
      const obs = groups.map((g) => g.n.get());
      const rat = groups.map((g) => g.r.get());
      if (obs.some((x) => !(x >= 0)) || rat.some((x) => !(x > 0))) return;
      const r = srmTest(obs, rat);
      const bad = r.pValue < 0.001;
      const total = obs.reduce((a, b) => a + b, 0);
      out.replaceChildren(
        h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
          h('thead', null, h('tr', null, h('th', null, '그룹'), h('th', null, '관측'), h('th', null, '기대'), h('th', null, '관측 비율'))),
          h('tbody', null, groups.map((g, i) => h('tr', null, h('td', null, g.name), h('td', null, num(obs[i])), h('td', null, r.expected[i].toFixed(1)), h('td', null, pct(obs[i] / total, 1))))))),
        h('div', { class: 'grid grid-2' }, kpi(r.chi2.toFixed(2), `χ² (자유도 ${r.df})`), kpi(pfmt(r.pValue), 'p-value')),
        h('div', { class: `callout ${bad ? 'bad' : 'good'} md`, html: md(bad
          ? `**SRM이 발생했습니다** (p < 0.001). 배정이나 로깅 과정에서 한쪽 유저가 체계적으로 빠졌을 가능성이 큽니다. **실험 결과(전환율 차이)를 해석하지 말고**, 플랫폼·브라우저·날짜별로 어디서 불균형이 생겼는지 찾은 뒤 재실험하세요.`
          : `배정 비율이 설계와 통계적으로 다르지 않습니다 (p = ${pfmt(r.pValue)}). SRM 문제는 없어 보입니다.`) }),
        h('div', { class: 'md small muted', html: md('SRM 판단 기준으로는 보통 **p < 0.001**처럼 엄격한 임계값을 씁니다. 실험을 많이 돌리면 우연히 걸리는 경우(거짓 경보)도 생기기 때문입니다.') }));
    };
    groups.forEach((g) => { g.n.input.addEventListener('input', calc); g.r.input.addEventListener('input', calc); });
    queueMicrotask(calc);
    return h('div', { class: 'grid grid-2' },
      h('div', { class: 'card stack' },
        h('h3', null, '배정 인원 입력'),
        groups.map((g) => h('div', { class: 'field-grid' }, g.n.el, g.r.el)),
        h('div', { class: 'md small', html: md(`
          **SRM이란?** 설계한 배정 비율(예: 50:50)과 실제 인원 비율이 우연이라고 보기 어려울 만큼 다른 상태입니다. 실험 결과를 보기 **전에** 반드시 확인합니다.

          **흔한 원인**: treatment에서만 생기는 크래시와 로딩 지연으로 인한 로깅 누락, 봇 필터 차이, 리다이렉트 실험, 실험 도중 비율 변경

          샘플 데이터의 \`free_shipping_banner\` 실험 인원(1,150 / 947)이 기본값으로 들어가 있습니다.
        `) })),
      h('div', { class: 'card stack' }, h('h3', null, '검정 결과'), out));
  },

  // ───────── 시뮬레이터 ─────────
  simView() {
    const wrap = h('div', { class: 'stack' });
    wrap.append(this.peekingSim(), this.pvalueSim(), this.cltSim());
    return wrap;
  },

  peekingSim() {
    const p0 = field('기준 전환율', 10, { suffix: '%' });
    const daily = field('그룹당 일 유입', 500, { min: 10 });
    const days = field('실험 기간', 14, { suffix: '일', min: 2 });
    const sims = field('시뮬레이션 횟수', 1000, { min: 100 });
    const out = h('div', { class: 'stack' });
    const run = () => {
      const p = p0.get() / 100; const n = Math.round(daily.get()); const D = Math.min(60, Math.round(days.get())); const S = Math.min(5000, Math.round(sims.get()));
      const rand = mulberry32(Date.now() % 1e9);
      let peekFP = 0; let finalFP = 0;
      const paths = [];
      for (let s = 0; s < S; s++) {
        let nc = 0, xc = 0, nt = 0, xt = 0, hit = false;
        const path = [];
        for (let d = 0; d < D; d++) {
          nc += n; nt += n; xc += randBinomial(rand, n, p); xt += randBinomial(rand, n, p);
          const pool = (xc + xt) / (nc + nt);
          const se = Math.sqrt(pool * (1 - pool) * (1 / nc + 1 / nt));
          const z = se > 0 ? (xt / nt - xc / nc) / se : 0;
          const pv = 2 * (1 - normCdf(Math.abs(z)));
          if (pv < 0.05) hit = true;
          if (s < 20) path.push(pv);
          if (d === D - 1 && pv < 0.05) finalFP++;
        }
        if (hit) peekFP++;
        if (s < 20) paths.push(path);
      }
      const series = paths.map((v, i) => ({ values: v, color: v.some((x) => x < 0.05) ? 'var(--series-2)' : 'var(--series-muted)', width: v.some((x) => x < 0.05) ? 2 : 1.5, label: i === 0 ? '실험 #1' : null }));
      out.replaceChildren(
        h('div', { class: 'grid grid-2' },
          kpi(pct(finalFP / S, 1), '거짓 양성률 — 마지막 날 한 번만 검정'),
          kpi(pct(peekFP / S, 1), '거짓 양성률 — 매일 확인하고 유의하면 종료')),
        h('div', { class: 'legend' }, h('span', { style: { '--c': 'var(--series-2)' } }, '한 번이라도 p < 0.05를 찍은 A/A 실험'), h('span', { style: { '--c': 'var(--series-muted)' } }, '끝까지 유의하지 않은 실험')),
        lineChart({ series, yMin: 0, yMax: 1, hline: { y: 0.05, label: 'α = 0.05' }, xLabel: '실험 일차 (일)', yLabel: 'p-value (A/A 실험 20개)', yFmt: (v) => (+v).toFixed(2), highlight: series.filter((x) => x.label) }),
        h('div', { class: 'callout warn md', html: md(`두 그룹에 **실제 차이가 전혀 없는(A/A)** 실험인데도, 매일 결과를 보다가 유의해지는 순간 멈추면 거짓 양성률이 **${pct(peekFP / S, 1)}**까지 올라갑니다 (설계상 5%). p-value는 실험 중에 무작위로 오르내리기 때문에, 우연히 0.05 아래로 내려간 순간에 멈추면 거짓 승리를 선언하게 됩니다.`) }));
    };
    return h('div', { class: 'card stack' },
      h('h3', null, '① 피킹(Peeking) 시뮬레이터'),
      h('p', { class: 'small muted', style: { margin: 0 } }, '효과가 없는 A/A 실험을 여러 번 돌려, 매일 결과를 확인하는 습관이 거짓 양성을 얼마나 늘리는지 확인합니다.'),
      h('div', { class: 'field-grid' }, p0.el, daily.el, days.el, sims.el),
      h('div', null, h('button', { class: 'btn primary', type: 'button', onclick: run }, '시뮬레이션 실행')),
      out);
  },

  pvalueSim() {
    const base = field('기준 전환율', 10, { suffix: '%' });
    const lift = field('실제 효과 (상대)', 10, { suffix: '%' });
    const n = field('그룹당 인원', 5000, { min: 50 });
    const out = h('div', { class: 'stack' });
    const run = () => {
      const p1 = base.get() / 100; const p2 = p1 * (1 + lift.get() / 100); const N = Math.round(n.get());
      const rand = mulberry32(42 + N);
      const sim = (pa, pb) => Array.from({ length: 2000 }, () => {
        const r = twoProportionTest({ nC: N, xC: randBinomial(rand, N, pa), nT: N, xT: randBinomial(rand, N, pb) });
        return r.pValue;
      });
      const h0 = sim(p1, p1); const h1 = sim(p1, p2);
      const power = h1.filter((x) => x < 0.05).length / h1.length;
      const fp = h0.filter((x) => x < 0.05).length / h0.length;
      out.replaceChildren(
        h('div', { class: 'grid grid-2' }, kpi(pct(fp, 1), '효과 없음(H0)에서 p < 0.05 비율 ≈ α'), kpi(pct(power, 1), '실제 효과 있음(H1)에서 p < 0.05 비율 = 검정력')),
        h('div', { class: 'legend' }, h('span', { style: { '--c': 'var(--series-muted)' } }, '효과 없음 (H0)'), h('span', { style: { '--c': 'var(--series-1)' } }, `실제 효과 +${lift.get()}% (H1)`)),
        histogram({ layers: [{ bins: bins(h0, 0, 1, 20), color: 'var(--series-muted)', label: 'H0' }, { bins: bins(h1, 0, 1, 20), color: 'var(--series-1)', label: 'H1' }], xFmt: (v) => (+v).toFixed(2), xLabel: 'p-value', yLabel: '빈도 (각 2,000회)', vline: { x: 0.05, label: '0.05' } }),
        h('div', { class: 'callout info md', html: md(`**효과가 없으면 p-value는 0~1 사이에 균등하게** 퍼집니다. 그래서 5%는 우연히 0.05 아래로 떨어집니다 (1종 오류). **효과가 있으면 p-value가 0 쪽으로 몰리며**, 0.05 아래에 떨어지는 비율이 검정력입니다. 인원을 줄이거나 효과를 작게 하면 검정력이 어떻게 변하는지 확인해 보세요.`) }));
    };
    return h('div', { class: 'card stack' },
      h('h3', null, '② p-value 분포와 검정력'),
      h('div', { class: 'field-grid' }, base.el, lift.el, n.el),
      h('div', null, h('button', { class: 'btn primary', type: 'button', onclick: run }, '시뮬레이션 실행')),
      out);
  },

  cltSim() {
    const n = field('표본 크기 n', 30, { min: 1 });
    const out = h('div', { class: 'stack' });
    const run = () => {
      const N = Math.max(1, Math.round(n.get()));
      const rand = mulberry32(7);
      // 객단가처럼 오른쪽으로 치우친 로그정규 분포 (중앙값 약 4만 원)
      const draw = () => Math.exp(10.6 + 0.8 * randNormal(rand));
      const pop = Array.from({ length: 5000 }, draw);
      const means = Array.from({ length: 3000 }, () => { let s = 0; for (let i = 0; i < N; i++) s += draw(); return s / N; });
      const won = (v) => `${Math.round(v / 1000)}k`;
      const popMax = 200000;
      const mu = Math.exp(10.6 + 0.32);
      const mMin = Math.min(...means); const mMax = Math.max(...means);
      out.replaceChildren(
        h('div', { class: 'grid grid-2' },
          h('div', null, h('div', { class: 'small muted' }, '모집단 분포 (개별 주문 금액)'),
            histogram({ layers: [{ bins: bins(pop, 0, popMax, 30), color: 'var(--series-muted)' }], xFmt: won, xLabel: '주문 금액 (원)', width: 420, height: 220 })),
          h('div', null, h('div', { class: 'small muted' }, `표본평균의 분포 (n = ${N}, 3,000번 반복)`),
            histogram({ layers: [{ bins: bins(means, mMin, mMax, 30), color: 'var(--series-1)' }], xFmt: won, xLabel: '표본평균 (원)', width: 420, height: 220, vline: { x: mu, label: '모평균' } }))),
        h('div', { class: 'callout info md', html: md(`모집단은 오른쪽으로 긴 꼬리를 가진 분포지만, **표본평균의 분포는 n이 커질수록 정규분포 모양**이 되고 폭(표준오차 σ/√n)이 좁아집니다. n을 1, 5, 30, 300으로 바꿔 비교해 보세요. 치우침이 심한 데이터일수록 정규 근사에 더 큰 n이 필요합니다.`) }));
    };
    return h('div', { class: 'card stack' },
      h('h3', null, '③ 중심극한정리 (CLT)'),
      h('div', { class: 'field-grid' }, n.el),
      h('div', null, h('button', { class: 'btn primary', type: 'button', onclick: run }, '시뮬레이션 실행')),
      out);
  },
};

function kpi(v, l) {
  return h('div', { class: 'kpi' }, h('span', { class: 'v' }, v), h('span', { class: 'l' }, l));
}
function row(k, v) {
  return h('tr', null, h('th', { style: { width: '50%' } }, k), h('td', null, v));
}
