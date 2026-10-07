import { h, md, store, toast } from '../util.js';
import { CATEGORIES, LEVELS, QUESTIONS } from '../data/interview.js';
import { miniItem } from './interview.js';

const catName = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.name]));
const RATING = [
  { v: 1, label: '1 · 거의 못함' },
  { v: 2, label: '2 · 일부만' },
  { v: 3, label: '3 · 보통' },
  { v: 4, label: '4 · 잘함' },
  { v: 5, label: '5 · 완벽' },
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default {
  id: 'mock',
  title: '모의 면접',
  mount(el) {
    this.el = el;
    this.config = store.get('mock:config', { cats: ['sql', 'stats', 'ab', 'metrics', 'behavior'], count: 5, seconds: 180, levels: ['1', '2', '3'], prioritizeWeak: true });
    this.session = null;
    this.renderSetup();
  },

  onShow() {
    if (!this.session) this.renderSetup();
  },

  renderSetup() {
    clearInterval(this.timer);
    const c = this.config;
    const toggle = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
    const chips = (key, items) => h('div', { class: 'row' }, items.map(([v, label]) => h('button', {
      type: 'button', class: `chip ${c[key].includes(v) ? 'on' : ''}`,
      onclick: () => { c[key] = toggle(c[key], v); this.renderSetup(); },
    }, label)));
    const single = (key, items) => h('div', { class: 'row' }, items.map(([v, label]) => h('button', {
      type: 'button', class: `chip ${c[key] === v ? 'on' : ''}`,
      onclick: () => { c[key] = v; this.renderSetup(); },
    }, label)));
    const pool = this.pool();
    const history = store.get('mock:history', []);

    this.el.replaceChildren(
      h('div', { class: 'page-head' },
        h('h1', null, '모의 면접'),
        h('p', null, '실제 면접처럼 질문이 무작위로 나오고 타이머가 돌아갑니다. 답변을 적거나 소리 내어 말한 뒤 제출하면 모범 답안과 "핵심 포인트"가 공개됩니다. 내 답변에 포함된 포인트를 체크하고 스스로 점수를 매기세요. 점수가 낮았던 질문은 다음 세션에 우선 출제됩니다.')),
      h('div', { class: 'grid grid-2' },
        h('div', { class: 'card stack' },
          h('h3', null, '세션 설정'),
          h('div', null, h('div', { class: 'small muted', style: { marginBottom: '6px' } }, '카테고리'), chips('cats', CATEGORIES.map((x) => [x.id, x.name]))),
          h('div', null, h('div', { class: 'small muted', style: { marginBottom: '6px' } }, '난이도'), chips('levels', Object.entries(LEVELS))),
          h('div', null, h('div', { class: 'small muted', style: { marginBottom: '6px' } }, '문항 수'), single('count', [[3, '3문항'], [5, '5문항'], [10, '10문항'], [15, '15문항']])),
          h('div', null, h('div', { class: 'small muted', style: { marginBottom: '6px' } }, '문항당 시간'), single('seconds', [[90, '1분 30초'], [180, '3분'], [300, '5분'], [0, '무제한']])),
          h('label', { class: 'row small', style: { cursor: 'pointer' } },
            h('input', { type: 'checkbox', checked: c.prioritizeWeak, onchange: (e) => { c.prioritizeWeak = e.target.checked; } }),
            '점수가 낮았거나 안 풀어본 질문 우선 출제'),
          h('div', { class: 'row' },
            h('button', { class: 'btn primary', type: 'button', disabled: !pool.length, onclick: () => this.start() }, `시작하기 (후보 ${pool.length}문항)`))),
        h('div', { class: 'card' },
          h('h3', null, '최근 기록'),
          history.length ? this.historyView(history) : h('div', { class: 'empty' }, '아직 기록이 없습니다. 첫 세션을 시작해 보세요!'))),
      h('div', { class: 'card', style: { marginTop: '16px' } },
        h('h3', null, '모의 면접 활용 팁'),
        h('div', { class: 'md small', html: md(`
          - **말로 답하기**: 실제 면접은 구두입니다. 휴대폰으로 녹음하면서 답하고, 다시 들으며 군더더기를 줄이세요.
          - **두괄식**: 첫 문장에 결론과 정의를 말하고, 근거와 예시는 그다음에 덧붙입니다.
          - **2분 룰**: 하나의 답변은 1~2분이 적당합니다. 길어지면 면접관이 꼬리 질문으로 끊습니다.
          - **핵심 포인트 체크**: 모범 답안을 외우기보다, 빠뜨린 핵심 포인트를 다음에 반드시 넣는 연습을 하세요.
          - **스터디**: 친구와 면접관과 지원자 역할을 바꿔가며 진행하면 꼬리 질문 대응력이 늘어납니다.
        `) })),
    );
  },

  pool() {
    const c = this.config;
    return QUESTIONS.filter((q) => c.cats.includes(q.cat) && c.levels.includes(String(q.level)));
  },

  start() {
    store.set('mock:config', this.config);
    const scores = store.get('mock:scores', {});
    let pool = shuffle(this.pool());
    if (this.config.prioritizeWeak) {
      // 안 풀어본 질문(점수 없음) → 낮은 점수 순으로, 같은 그룹 안에서는 무작위
      pool = pool.map((q) => ({ q, s: scores[q.id] == null ? -1 : scores[q.id] + Math.random() * 0.5 }))
        .sort((a, b) => a.s - b.s).map((x) => x.q);
    }
    const qs = pool.slice(0, this.config.count);
    this.session = { qs, i: 0, answers: [], startedAt: Date.now() };
    this.renderQuestion();
  },

  renderQuestion() {
    clearInterval(this.timer);
    const s = this.session;
    const q = s.qs[s.i];
    const limit = this.config.seconds;
    let left = limit;
    const t0 = Date.now();
    const timerEl = h('div', { class: 'timer', 'aria-live': 'off' }, limit ? fmt(left) : '∞');
    const ta = h('textarea', { rows: 9, placeholder: '답변을 적어보세요. (말로 답하고 키워드만 적어도 좋습니다)', 'aria-label': '내 답변' });
    const submit = (skipped = false) => {
      clearInterval(this.timer);
      this.renderReview({ q, text: ta.value, skipped, spent: Math.round((Date.now() - t0) / 1000) });
    };
    if (limit) {
      this.timer = setInterval(() => {
        left = limit - Math.floor((Date.now() - t0) / 1000);
        timerEl.textContent = fmt(Math.max(left, 0));
        timerEl.classList.toggle('warn', left <= 30);
        if (left <= 0) { toast('시간 종료! 답변을 확인합니다.'); submit(); }
      }, 250);
    }
    ta.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submit(); });

    this.el.replaceChildren(
      h('div', { class: 'card stack', style: { maxWidth: '860px', margin: '0 auto' } },
        h('div', { class: 'row between' },
          h('span', { class: 'small muted' }, `문항 ${s.i + 1} / ${s.qs.length}`),
          timerEl),
        h('div', { class: 'progress' }, h('div', { style: { width: `${(s.i / s.qs.length) * 100}%` } })),
        h('div', { class: 'row' }, h('span', { class: 'badge' }, catName[q.cat]), h('span', { class: `badge lv-${q.level}` }, LEVELS[q.level])),
        h('h2', { style: { fontSize: '1.25rem' } }, q.q),
        ta,
        h('div', { class: 'row' },
          h('button', { class: 'btn primary', type: 'button', onclick: () => submit() }, '답변 제출 (Ctrl+Enter)'),
          h('button', { class: 'btn ghost', type: 'button', onclick: () => submit(true) }, '모르겠어요 · 패스'),
          h('span', { class: 'spacer' }),
          h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { if (confirm('세션을 종료할까요? 지금까지의 답변은 저장되지 않습니다.')) { this.session = null; this.renderSetup(); } } }, '세션 종료'))));
    ta.focus();
  },

  renderReview({ q, text, skipped, spent }) {
    const s = this.session;
    const checks = q.keyPoints.map(() => false);
    let rating = null;
    const nextBtn = h('button', { class: 'btn primary', type: 'button', disabled: true, onclick: () => {
      s.answers.push({ id: q.id, cat: q.cat, q: q.q, text, skipped, spent, rating, covered: checks.filter(Boolean).length, total: checks.length });
      const scores = store.get('mock:scores', {});
      scores[q.id] = rating;
      store.set('mock:scores', scores);
      s.i += 1;
      if (s.i < s.qs.length) this.renderQuestion(); else this.renderSummary();
    } }, s.i + 1 < s.qs.length ? '다음 질문 →' : '결과 보기');
    const ratingRow = h('div', { class: 'rating' }, RATING.map((r) => {
      const b = h('button', { class: 'btn sm', type: 'button', onclick: () => {
        rating = r.v;
        ratingRow.querySelectorAll('button').forEach((x) => x.classList.remove('primary'));
        b.classList.add('primary');
        nextBtn.disabled = false;
      } }, r.label);
      return b;
    }));

    this.el.replaceChildren(
      h('div', { class: 'stack', style: { maxWidth: '860px', margin: '0 auto' } },
        h('div', { class: 'card stack' },
          h('div', { class: 'row between' }, h('span', { class: 'small muted' }, `문항 ${s.i + 1} / ${s.qs.length} · ${spent}초 사용`), h('span', { class: 'badge' }, catName[q.cat])),
          h('h2', { style: { fontSize: '1.15rem' } }, q.q),
          h('div', null, h('div', { class: 'small muted', style: { marginBottom: '4px' } }, '내 답변'),
            h('div', { class: 'output-text', style: { fontFamily: 'var(--font)', fontSize: '.92rem' } }, skipped ? '(패스)' : (text.trim() || '(작성 안 함 — 말로 답변)')))),
        h('div', { class: 'card stack' },
          h('h3', null, '핵심 포인트 — 내 답변에 들어간 것을 체크하세요'),
          h('div', { class: 'check-list' }, q.keyPoints.map((k, i) => h('label', null,
            h('input', { type: 'checkbox', onchange: (e) => { checks[i] = e.target.checked; } }), h('span', null, k)))),
          h('h3', { style: { marginTop: '8px' } }, '스스로 점수 매기기'),
          ratingRow,
          h('div', { class: 'row', style: { marginTop: '6px' } }, nextBtn)),
        h('div', { class: 'card' },
          h('h3', null, '모범 답변'),
          h('p', { class: 'small muted' }, `면접관 의도: ${q.intent}`),
          h('div', { class: 'md', html: md(q.answer) }),
          q.followups?.length ? h('div', null, h('h4', null, '꼬리 질문도 대비하세요'), h('div', { class: 'mini-qa' }, q.followups.map((f) => miniItem(f.q, f.a, 'Q')))) : null)));
    window.scrollTo(0, 0);
  },

  renderSummary() {
    const s = this.session;
    const avg = s.answers.reduce((a, x) => a + x.rating, 0) / s.answers.length;
    const coverage = s.answers.reduce((a, x) => a + x.covered, 0) / Math.max(1, s.answers.reduce((a, x) => a + x.total, 0));
    const record = {
      at: new Date().toISOString(), n: s.answers.length, avg: +avg.toFixed(2), coverage: +coverage.toFixed(2),
      minutes: Math.round((Date.now() - s.startedAt) / 60000),
      byCat: s.answers.reduce((m, a) => { (m[a.cat] = m[a.cat] || []).push(a.rating); return m; }, {}),
    };
    const history = [record, ...store.get('mock:history', [])].slice(0, 30);
    store.set('mock:history', history);
    for (const a of s.answers) if (a.rating <= 2) store.add('qa:bookmarks', a.id);
    this.session = null;

    this.el.replaceChildren(
      h('div', { class: 'stack', style: { maxWidth: '860px', margin: '0 auto' } },
        h('div', { class: 'card' },
          h('h2', null, '세션 결과'),
          h('div', { class: 'grid grid-3', style: { marginTop: '10px' } },
            h('div', { class: 'kpi' }, h('span', { class: 'v' }, `${avg.toFixed(1)} / 5`), h('span', { class: 'l' }, '평균 자기 평가')),
            h('div', { class: 'kpi' }, h('span', { class: 'v' }, `${Math.round(coverage * 100)}%`), h('span', { class: 'l' }, '핵심 포인트 포함률')),
            h('div', { class: 'kpi' }, h('span', { class: 'v' }, `${record.minutes}분`), h('span', { class: 'l' }, '소요 시간'))),
          h('p', { class: 'small muted', style: { marginTop: '12px', marginBottom: 0 } }, '2점 이하로 평가한 질문은 면접 Q&A의 ★ 다시 보기에 자동으로 추가했습니다.')),
        h('div', { class: 'card' },
          h('h3', null, '문항별 결과'),
          h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
            h('thead', null, h('tr', null, h('th', null, '질문'), h('th', null, '포인트'), h('th', null, '점수'), h('th', null, ''))),
            h('tbody', null, s.answers.map((a) => h('tr', null,
              h('td', null, a.q),
              h('td', null, `${a.covered}/${a.total}`),
              h('td', null, String(a.rating)),
              h('td', null, h('a', { href: `#/interview?q=${a.id}` }, '복습'))))))),
          h('div', { class: 'row', style: { marginTop: '12px' } },
            h('button', { class: 'btn primary', type: 'button', onclick: () => this.start() }, '같은 설정으로 다시'),
            h('button', { class: 'btn', type: 'button', onclick: () => this.renderSetup() }, '설정으로 돌아가기')))));
  },

  historyView(history) {
    // 카테고리별 평균 점수 (최근 30세션)
    const agg = {};
    for (const r of history) for (const [cat, arr] of Object.entries(r.byCat || {})) {
      agg[cat] = agg[cat] || [];
      agg[cat].push(...arr);
    }
    const rows = Object.entries(agg).map(([cat, arr]) => ({ cat, avg: arr.reduce((a, b) => a + b, 0) / arr.length, n: arr.length }))
      .sort((a, b) => a.avg - b.avg);
    return h('div', { class: 'stack' },
      h('div', { class: 'small muted' }, '카테고리별 평균 자기 평가 (낮은 순 = 보완 필요)'),
      h('div', null, rows.map((r) => h('div', { class: 'bar-row', title: `${r.n}문항` },
        h('span', null, catName[r.cat] || r.cat),
        h('div', { class: 'bar-track' }, h('div', { class: 'bar-fill', style: { width: `${(r.avg / 5) * 100}%` } })),
        h('span', { class: 'small' }, r.avg.toFixed(1))))),
      h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
        h('thead', null, h('tr', null, h('th', null, '일시'), h('th', null, '문항'), h('th', null, '평균'), h('th', null, '포인트'))),
        h('tbody', null, history.slice(0, 8).map((r) => h('tr', null,
          h('td', null, new Date(r.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })),
          h('td', null, String(r.n)), h('td', null, r.avg.toFixed(1)), h('td', null, `${Math.round(r.coverage * 100)}%`)))))),
      h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { if (confirm('모의 면접 기록을 모두 지울까요?')) { store.set('mock:history', []); store.set('mock:scores', {}); this.renderSetup(); } } }, '기록 초기화'));
  },
};

function fmt(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
