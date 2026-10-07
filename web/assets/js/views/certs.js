import { h, md, store, toast } from '../util.js';
import { CERTS, OTHER_CERTS, CERT_ROADMAP } from '../data/certs.js';

const TABS = [['info', '시험 정보'], ['summary', '핵심 요약'], ['practice', '문제 풀기'], ['mock', '실전 모의고사'], ['wrong', '오답노트']];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const dday = (date) => Math.round((parseDate(date) - today()) / 86400000);

/** "2026-10-12 ~ 10-16" → [시작, 끝] */
function applyRange(apply, examDate) {
  const m = apply.match(/(\d{4})-(\d{2})-(\d{2})\s*~\s*(\d{2})-(\d{2})/);
  if (!m) return null;
  const y = +m[1];
  return [new Date(y, +m[2] - 1, +m[3]), new Date(y, +m[4] - 1, +m[5])];
}

/** 답안 기록: { [qid]: { last, correct, wrong } } */
const answersKey = (cert) => `cert:${cert.id}:answers`;
function recordAnswer(cert, q, choice) {
  const all = store.get(answersKey(cert), {});
  const prev = all[q.id] || { wrong: 0 };
  const correct = choice === q.answer;
  all[q.id] = { last: choice, correct, wrong: prev.wrong + (correct ? 0 : 1) };
  store.set(answersKey(cert), all);
  return correct;
}

export default {
  id: 'certs',
  title: '자격증',
  mount(el) {
    this.el = el;
    this.certId = store.get('cert:current', CERTS[0].id);
    this.tab = store.get('cert:tab', 'info');
    this.certBar = h('div', { class: 'row', style: { marginBottom: '12px' } });
    this.tabBar = h('div', { class: 'tabs', role: 'tablist' });
    this.body = h('div');
    el.append(
      h('div', { class: 'page-head' },
        h('h1', null, '자격증 준비 (SQLD · ADsP)'),
        h('p', null, 'DA 채용에서 자주 우대하는 SQLD와 ADsP를 준비합니다. 2026년 시험 정보, 과목별 핵심 요약, 실제 시험과 같은 과목 비중의 연습 문제와 실전 모의고사(타이머, 과락 판정), 오답노트를 제공합니다. 문제는 출제 범위를 바탕으로 직접 작성한 연습 문제입니다.')),
      this.certBar, this.tabBar, this.body);
    this.render();
  },

  onShow(params) {
    if (params.cert && CERTS.some((c) => c.id === params.cert)) { this.certId = params.cert; this.render(); }
  },

  get cert() { return CERTS.find((c) => c.id === this.certId) || CERTS[0]; },

  render() {
    clearInterval(this.timer);
    store.set('cert:current', this.certId);
    store.set('cert:tab', this.tab);
    this.certBar.replaceChildren(
      ...CERTS.map((c) => h('button', {
        type: 'button', class: `chip ${c.id === this.certId ? 'on' : ''}`,
        onclick: () => { this.certId = c.id; this.render(); },
      }, c.name, h('span', { class: 'count' }, `${c.questions.length}문제`))),
      h('button', { type: 'button', class: `chip ${this.certId === 'others' ? 'on' : ''}`, onclick: () => { this.certId = 'others'; this.render(); } }, '다른 자격증 · 로드맵'));
    if (this.certId === 'others') {
      this.tabBar.replaceChildren();
      this.body.replaceChildren(this.othersView());
      return;
    }
    this.tabBar.replaceChildren(...TABS.map(([k, l]) => h('button', {
      type: 'button', role: 'tab', class: k === this.tab ? 'on' : '', 'aria-selected': String(k === this.tab),
      onclick: () => { this.tab = k; this.render(); },
    }, l)));
    const v = { info: () => this.infoView(), summary: () => this.summaryView(), practice: () => this.practiceView(), mock: () => this.mockSetup(), wrong: () => this.wrongView() }[this.tab] || (() => this.infoView());
    this.body.replaceChildren(v());
  },

  // ───── 시험 정보 ─────
  infoView() {
    const c = this.cert;
    const next = c.schedule.find((s) => dday(s.exam) >= 0);
    let applyNote = null;
    if (next) {
      const r = applyRange(next.apply);
      const t = today();
      if (r && t < r[0]) applyNote = `원서 접수 시작까지 ${Math.round((r[0] - t) / 86400000)}일 (${next.apply})`;
      else if (r && t <= r[1]) applyNote = `지금 원서 접수 기간입니다! (${next.apply})`;
      else if (r) applyNote = `원서 접수 마감 (${next.apply})`;
    }
    const answers = store.get(answersKey(c), {});
    const solved = Object.keys(answers).length;
    const correct = Object.values(answers).filter((a) => a.correct).length;
    const mocks = store.get(`cert:${c.id}:mocks`, []);
    return h('div', { class: 'stack' },
      h('div', { class: 'grid grid-3' },
        h('div', { class: 'card kpi' }, h('span', { class: 'v' }, next ? (dday(next.exam) === 0 ? 'D-DAY' : `D-${dday(next.exam)}`) : '–'), h('span', { class: 'l' }, next ? `${next.round} 시험 ${next.exam}` : '올해 남은 시험 없음'), applyNote ? h('span', { class: 'small', style: { marginTop: '6px', color: 'var(--accent)' } }, applyNote) : null),
        h('div', { class: 'card kpi' }, h('span', { class: 'v' }, `${correct} / ${c.questions.length}`), h('span', { class: 'l' }, `맞힌 문제 (푼 문제 ${solved}개)`)),
        h('div', { class: 'card kpi' }, h('span', { class: 'v' }, mocks.length ? `${mocks[0].score}점` : '–'), h('span', { class: 'l' }, mocks.length ? `최근 모의고사 · ${mocks[0].passed ? '합격권' : '불합격권'} (${mocks.length}회 응시)` : '모의고사 기록 없음'))),
      h('div', { class: 'grid grid-2' },
        h('div', { class: 'card' },
          h('h3', null, `${c.name} · ${c.fullName}`),
          h('div', { class: 'table-wrap' }, h('table', { class: 'data' }, h('tbody', null,
            row('주관', c.org),
            row('문항 · 시간', `${c.format.questions}문항 · ${c.format.minutes}분`),
            row('형식', c.format.type),
            row('과목 구성', c.subjects.map((s) => `${s.name.replace(/^\d과목 · /, '')} ${s.count}문항`).join(' / ')),
            row('합격 기준', c.format.pass),
            row('응시료', c.format.fee)))),
          h('div', { class: 'md small', style: { marginTop: '12px' }, html: md(c.why) })),
        h('div', { class: 'card' },
          h('h3', null, '2026년 시험 일정'),
          h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
            h('thead', null, h('tr', null, h('th', null, '회차'), h('th', null, '원서 접수'), h('th', null, '시험일'), h('th', null, '결과 발표'))),
            h('tbody', null, c.schedule.map((s) => {
              const past = dday(s.exam) < 0;
              return h('tr', { style: past ? { color: 'var(--text-3)' } : (s === next ? { fontWeight: 600 } : null) },
                h('td', null, s.round, s === next ? h('span', { class: 'badge accent', style: { marginLeft: '6px' } }, '다음 시험') : null),
                h('td', null, s.apply), h('td', null, s.exam + (past ? ' (종료)' : '')), h('td', null, s.result));
            })))),
          h('p', { class: 'small muted', style: { marginTop: '8px', marginBottom: 0 } }, '일정은 변경될 수 있습니다. 접수 전 ', h('a', { href: 'https://www.dataq.or.kr', target: '_blank', rel: 'noopener' }, '데이터자격검정(dataq.or.kr)'), '에서 꼭 확인하세요.'),
          h('div', { class: 'row', style: { marginTop: '14px' } },
            h('button', { class: 'btn primary', type: 'button', onclick: () => { this.tab = 'summary'; this.render(); } }, '핵심 요약 보기'),
            h('button', { class: 'btn', type: 'button', onclick: () => { this.tab = 'practice'; this.render(); } }, '문제 풀기'),
            h('button', { class: 'btn', type: 'button', onclick: () => { this.tab = 'mock'; this.render(); } }, '모의고사')))));
  },

  // ───── 핵심 요약 ─────
  summaryView() {
    const c = this.cert;
    return h('div', { class: 'stack' }, c.subjects.map((s, i) => h('details', { class: 'card', open: i === 0 },
      h('summary', { style: { cursor: 'pointer', fontWeight: 700, fontSize: '1.05rem' } }, `${s.name} (${s.count}문항)`),
      h('div', { class: 'md', style: { marginTop: '12px' }, html: md(s.summary) }),
      h('div', { class: 'row', style: { marginTop: '12px' } },
        h('button', { class: 'btn sm', type: 'button', onclick: () => { this.practiceFilter = i; this.tab = 'practice'; this.render(); } }, '이 과목 문제 풀기 →')))));
  },

  // ───── 문제 풀기 ─────
  practiceView() {
    const c = this.cert;
    const wrap = h('div', { class: 'stack' });
    const answers = () => store.get(answersKey(c), {});
    const state = this.pstate && this.pstate.cert === c.id ? this.pstate : (this.pstate = { cert: c.id, subject: this.practiceFilter ?? 'all', mode: 'order', i: 0, list: null });
    if (this.practiceFilter != null) { state.subject = this.practiceFilter; state.list = null; state.i = 0; this.practiceFilter = null; }

    const build = () => {
      const a = answers();
      let qs = c.questions.filter((q) => state.subject === 'all' || q.subject === state.subject);
      if (state.mode === 'unsolved') qs = qs.filter((q) => !a[q.id]);
      if (state.mode === 'wrong') qs = qs.filter((q) => a[q.id] && !a[q.id].correct);
      if (state.mode === 'random') qs = shuffle(qs);
      state.list = qs;
      state.i = 0;
    };
    if (!state.list) build();

    const chip = (key, val, label) => h('button', {
      type: 'button', class: `chip ${state[key] === val ? 'on' : ''}`,
      onclick: () => { state[key] = val; build(); this.render(); },
    }, label);

    const a = answers();
    const bySubject = c.subjects.map((s, si) => {
      const qs = c.questions.filter((q) => q.subject === si);
      const done = qs.filter((q) => a[q.id]);
      return { name: s.name, total: qs.length, done: done.length, correct: done.filter((q) => a[q.id].correct).length };
    });

    wrap.append(
      h('div', { class: 'card stack' },
        h('div', { class: 'row' }, h('span', { class: 'small muted', style: { width: '48px' } }, '과목'), chip('subject', 'all', '전체'), c.subjects.map((s, si) => chip('subject', si, s.name.replace(/ · .*/, '')))),
        h('div', { class: 'row' }, h('span', { class: 'small muted', style: { width: '48px' } }, '순서'), chip('mode', 'order', '순서대로'), chip('mode', 'random', '무작위'), chip('mode', 'unsolved', '안 푼 문제'), chip('mode', 'wrong', '틀린 문제')),
        h('div', null, bySubject.map((s) => h('div', { class: 'bar-row', style: { gridTemplateColumns: 'minmax(0,1.4fr) 1fr 90px' } },
          h('span', { class: 'small' }, s.name),
          h('div', { class: 'bar-track' }, h('div', { class: 'bar-fill', style: { width: `${(s.done / s.total) * 100}%` } })),
          h('span', { class: 'small muted' }, `${s.done}/${s.total} · 정답 ${s.correct}`))))));

    if (!state.list.length) {
      wrap.append(h('div', { class: 'card empty' }, state.mode === 'wrong' ? '틀린 문제가 없습니다. 👍' : state.mode === 'unsolved' ? '이 범위의 문제를 모두 풀었습니다.' : '문제가 없습니다.'));
      return wrap;
    }
    const q = state.list[state.i];
    const card = this.questionCard(q, {
      index: state.i, total: state.list.length,
      previous: a[q.id],
      onAnswer: (choice) => recordAnswer(c, q, choice),
      onPrev: state.i > 0 ? () => { state.i -= 1; this.render(); } : null,
      onNext: state.i < state.list.length - 1 ? () => { state.i += 1; this.render(); } : null,
    });
    wrap.append(card);
    return wrap;
  },

  /** 4지선다 문제 카드 (즉시 채점) */
  questionCard(q, { index, total, previous, onAnswer, onPrev, onNext }) {
    const c = this.cert;
    const explain = h('div', { class: 'callout info md', hidden: true });
    // 정답 위치가 외워지지 않도록 보기 순서를 매번 섞음 (기록은 원래 인덱스로 저장)
    const order = shuffle([0, 1, 2, 3].slice(0, q.options.length));
    const opts = order.map((oi, pos) => h('button', { class: 'quiz-opt', type: 'button', onclick: () => choose(oi) }, `${pos + 1}. ${q.options[oi]}`));
    let answered = false;
    const choose = (oi) => {
      if (answered) return;
      answered = true;
      const correct = onAnswer(oi);
      opts.forEach((b, pos) => {
        b.classList.toggle('correct', order[pos] === q.answer);
        b.classList.toggle('wrong', order[pos] === oi && !correct);
        b.disabled = true;
      });
      explain.innerHTML = md(`${correct ? '**정답입니다.** ' : `**오답입니다.** 정답은 ${order.indexOf(q.answer) + 1}번입니다. `}${q.explain}`);
      explain.hidden = false;
    };
    return h('div', { class: 'card stack quiz-card' },
      h('div', { class: 'row between' },
        h('span', { class: 'small muted' }, `${index + 1} / ${total} · ${c.subjects[q.subject].name}`),
        previous ? h('span', { class: `badge ${previous.correct ? 'ok' : 'lv-3'}` }, previous.correct ? '지난번 정답' : `지난번 오답${previous.wrong > 1 ? ` (${previous.wrong}회)` : ''}`) : null),
      h('h3', { style: { margin: 0, lineHeight: 1.5 } }, q.q),
      q.code ? h('pre', null, h('code', null, q.code)) : null,
      h('div', null, opts),
      explain,
      h('div', { class: 'row' },
        onPrev ? h('button', { class: 'btn', type: 'button', 'data-nav': 'prev', onclick: onPrev }, '← 이전') : null,
        h('span', { class: 'small muted' }, '키보드: 1~4 선택 · Enter/→ 다음 · ← 이전'),
        h('span', { class: 'spacer' }),
        onNext ? h('button', { class: 'btn primary', type: 'button', 'data-nav': 'next', onclick: onNext }, '다음 문제 →') : null));
  },

  // ───── 실전 모의고사 ─────
  mockSetup() {
    const c = this.cert;
    const history = store.get(`cert:${c.id}:mocks`, []);
    const pools = c.subjects.map((s, si) => c.questions.filter((q) => q.subject === si).length);
    const counts = c.subjects.map((s, si) => Math.min(s.count, pools[si]));
    const total = counts.reduce((x, y) => x + y, 0);
    const minutes = Math.round((c.format.minutes * total) / c.format.questions);
    return h('div', { class: 'grid grid-2' },
      h('div', { class: 'card stack' },
        h('h3', null, `${c.name} 실전 모의고사`),
        h('div', { class: 'md small', html: md(`
          - **${total}문항 · ${minutes}분** (실제 시험과 같은 과목 비중: ${c.subjects.map((s, si) => `${s.name.replace(/ · .*/, '')} ${counts[si]}문항`).join(', ')})
          - 시험 중에는 정답이 보이지 않고, 제출하면 과목별 점수와 **과락 여부**를 판정합니다.
          - 채점 기준: 100점 만점 환산, **총점 60점 이상 + 과목별 40% 이상**이면 합격권
          - 틀린 문제는 자동으로 오답노트에 쌓입니다.
        `) }),
        h('div', null, h('button', { class: 'btn primary', type: 'button', onclick: () => this.startMock(counts, minutes) }, '모의고사 시작'))),
      h('div', { class: 'card' },
        h('h3', null, '응시 기록'),
        history.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
          h('thead', null, h('tr', null, h('th', null, '일시'), h('th', null, '점수'), h('th', null, '과목별'), h('th', null, '결과'))),
          h('tbody', null, history.slice(0, 10).map((r) => h('tr', null,
            h('td', null, new Date(r.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })),
            h('td', null, `${r.score}점`),
            h('td', null, r.subjects.map((s) => `${s.pct}%`).join(' / ')),
            h('td', null, h('span', { class: `badge ${r.passed ? 'ok' : 'lv-3'}` }, r.passed ? '합격권' : (r.failReason || '불합격권')))))))) : h('div', { class: 'empty' }, '아직 응시 기록이 없습니다.')));
  },

  startMock(counts, minutes) {
    const c = this.cert;
    const qs = c.subjects.flatMap((s, si) => shuffle(c.questions.filter((q) => q.subject === si)).slice(0, counts[si]));
    const picks = new Array(qs.length).fill(null);
    const endAt = Date.now() + minutes * 60000;
    const timerEl = h('span', { class: 'timer' });
    const progressEl = h('span', { class: 'small muted' });
    const list = h('div', { class: 'stack' });
    const update = () => { progressEl.textContent = `${picks.filter((p) => p != null).length} / ${qs.length} 답안 작성`; };
    qs.forEach((q, qi) => {
      const order = shuffle([0, 1, 2, 3].slice(0, q.options.length));
      const opts = order.map((oi, pos) => h('button', { class: 'quiz-opt', type: 'button', onclick: () => {
        picks[qi] = oi;
        opts.forEach((x, xp) => { const on = order[xp] === oi; x.style.borderColor = on ? 'var(--accent)' : ''; x.style.background = on ? 'var(--accent-soft)' : ''; });
        update();
      } }, `${pos + 1}. ${q.options[oi]}`));
      list.append(h('div', { class: 'card' },
        h('div', { class: 'small muted' }, `${qi + 1}번 · ${c.subjects[q.subject].name}`),
        h('h4', { style: { margin: '4px 0 8px', lineHeight: 1.5 } }, q.q),
        q.code ? h('pre', null, h('code', null, q.code)) : null,
        opts));
    });
    const submit = () => {
      clearInterval(this.timer);
      this.gradeMock(qs, picks, Math.round((Date.now() - (endAt - minutes * 60000)) / 60000));
    };
    const tick = () => {
      const left = Math.max(0, Math.round((endAt - Date.now()) / 1000));
      timerEl.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      timerEl.classList.toggle('warn', left <= 300);
      if (left <= 0) { toast('시험 시간이 끝났습니다. 자동 제출합니다.'); submit(); }
    };
    tick();
    this.timer = setInterval(tick, 500);
    update();
    this.tabBar.replaceChildren();
    this.body.replaceChildren(h('div', { class: 'stack', style: { maxWidth: '860px', margin: '0 auto' } },
      h('div', { class: 'card row between', style: { position: 'sticky', top: '112px', zIndex: 5 } },
        h('div', null, h('b', null, `${c.name} 모의고사`), ' ', progressEl),
        h('div', { class: 'row' }, timerEl,
          h('button', { class: 'btn primary', type: 'button', onclick: () => {
            const blank = picks.filter((p) => p == null).length;
            if (!blank || confirm(`답하지 않은 문제가 ${blank}개 있습니다. 제출할까요?`)) submit();
          } }, '제출'),
          h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { if (confirm('모의고사를 그만둘까요? 기록되지 않습니다.')) { clearInterval(this.timer); this.render(); } } }, '그만두기'))),
      list));
    window.scrollTo(0, 0);
  },

  gradeMock(qs, picks, minutesUsed) {
    const c = this.cert;
    const subjects = c.subjects.map((s, si) => {
      const idx = qs.map((q, i) => i).filter((i) => qs[i].subject === si);
      const correct = idx.filter((i) => picks[i] === qs[i].answer).length;
      return { name: s.name, total: idx.length, correct, pct: idx.length ? Math.round((correct / idx.length) * 100) : 0 };
    });
    const correctAll = subjects.reduce((x, s) => x + s.correct, 0);
    const score = Math.round((correctAll / qs.length) * 100);
    const failed = subjects.filter((s) => s.pct < 40);
    const passed = score >= 60 && !failed.length;
    const failReason = !passed ? (failed.length ? `과락 (${failed.map((s) => s.name.replace(/ · .*/, '')).join(', ')})` : '총점 미달') : null;
    qs.forEach((q, i) => { if (picks[i] != null) recordAnswer(c, q, picks[i]); });
    const record = { at: new Date().toISOString(), score, passed, failReason, minutes: minutesUsed, subjects: subjects.map((s) => ({ pct: s.pct })) };
    store.set(`cert:${c.id}:mocks`, [record, ...store.get(`cert:${c.id}:mocks`, [])].slice(0, 30));

    const review = qs.map((q, i) => ({ q, pick: picks[i] })).filter((x) => x.pick !== x.q.answer);
    this.tabBar.replaceChildren(...TABS.map(([k, l]) => h('button', { type: 'button', class: k === 'mock' ? 'on' : '', onclick: () => { this.tab = k; this.render(); } }, l)));
    this.body.replaceChildren(h('div', { class: 'stack', style: { maxWidth: '860px', margin: '0 auto' } },
      h('div', { class: `callout ${passed ? 'good' : 'bad'}` }, h('b', null, passed ? '🎉 합격권입니다!' : `아직 불합격권입니다 — ${failReason}`), ` 총점 ${score}점 (${correctAll}/${qs.length}) · ${minutesUsed}분 사용`),
      h('div', { class: 'card' },
        h('h3', null, '과목별 결과'),
        subjects.map((s) => h('div', { class: 'bar-row', style: { gridTemplateColumns: 'minmax(0,1.4fr) 1fr 110px' } },
          h('span', { class: 'small' }, s.name),
          h('div', { class: 'bar-track' }, h('div', { class: 'bar-fill', style: { width: `${s.pct}%`, background: s.pct < 40 ? 'var(--bad)' : 'var(--series-1)' } })),
          h('span', { class: 'small' }, `${s.correct}/${s.total} (${s.pct}%)${s.pct < 40 ? ' 과락' : ''}`)))),
      h('div', { class: 'card stack' },
        h('h3', null, `틀린 문제 ${review.length}개`),
        review.length ? review.map(({ q, pick }) => h('div', { style: { borderTop: '1px solid var(--border)', paddingTop: '10px' } },
          h('div', { class: 'small muted' }, c.subjects[q.subject].name),
          h('div', { style: { fontWeight: 600, margin: '4px 0' } }, q.q),
          q.code ? h('pre', null, h('code', null, q.code)) : null,
          h('div', { class: 'small' }, `내 답: ${pick == null ? '미응답' : q.options[pick]}`),
          h('div', { class: 'small', style: { color: 'var(--good)', fontWeight: 600 } }, `정답: ${q.options[q.answer]}`),
          h('div', { class: 'md small muted', style: { marginTop: '4px' }, html: md(q.explain) }))) : h('div', { class: 'muted' }, '모두 맞혔습니다!'),
        h('div', { class: 'row' },
          h('button', { class: 'btn primary', type: 'button', onclick: () => { this.tab = 'mock'; this.render(); } }, '다시 응시'),
          h('button', { class: 'btn', type: 'button', onclick: () => { this.tab = 'wrong'; this.render(); } }, '오답노트로')))));
    window.scrollTo(0, 0);
  },

  // ───── 오답노트 ─────
  wrongView() {
    const c = this.cert;
    const a = store.get(answersKey(c), {});
    const wrong = c.questions.filter((q) => a[q.id] && !a[q.id].correct).sort((x, y) => a[y.id].wrong - a[x.id].wrong);
    const everWrong = c.questions.filter((q) => a[q.id] && a[q.id].wrong > 0 && a[q.id].correct);
    return h('div', { class: 'stack' },
      h('div', { class: 'card row between' },
        h('div', null, h('b', null, `오답 ${wrong.length}개`), h('span', { class: 'small muted' }, ` · 다시 풀어서 맞힌 문제 ${everWrong.length}개`)),
        h('div', { class: 'row' },
          h('button', { class: 'btn primary', type: 'button', disabled: !wrong.length, onclick: () => { this.pstate = { cert: c.id, subject: 'all', mode: 'wrong', i: 0, list: null }; this.tab = 'practice'; this.render(); } }, '틀린 문제 다시 풀기'),
          h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { if (confirm(`${c.name} 풀이 기록을 모두 지울까요?`)) { store.set(answersKey(c), {}); this.render(); } } }, '기록 초기화'))),
      wrong.length ? wrong.map((q) => h('details', { class: 'card' },
        h('summary', { style: { cursor: 'pointer' } },
          h('span', { class: 'badge lv-3', style: { marginRight: '8px' } }, `${a[q.id].wrong}회 오답`),
          h('span', { class: 'small muted' }, c.subjects[q.subject].name.replace(/ · .*/, '') + ' · '), q.q),
        h('div', { style: { marginTop: '10px' } },
          q.code ? h('pre', null, h('code', null, q.code)) : null,
          h('div', { class: 'small' }, `마지막 내 답: ${q.options[a[q.id].last]}`),
          h('div', { class: 'small', style: { color: 'var(--good)', fontWeight: 600 } }, `정답: ${q.options[q.answer]}`),
          h('div', { class: 'md small muted', style: { marginTop: '6px' }, html: md(q.explain) })))) : h('div', { class: 'card empty' }, '오답이 없습니다. 문제 풀기나 모의고사를 진행하면 틀린 문제가 여기에 모입니다.'));
  },

  othersView() {
    return h('div', { class: 'stack' },
      h('div', { class: 'card md', html: md(CERT_ROADMAP) }),
      h('div', { class: 'grid grid-2' }, OTHER_CERTS.map((o) => h('div', { class: 'card' },
        h('div', { class: 'row between' }, h('h3', { style: { margin: 0 } }, o.name), h('span', { class: 'badge' }, o.level)),
        h('div', { class: 'md small', style: { marginTop: '8px' }, html: md(o.desc) })))));
  },
};

function row(k, v) {
  return h('tr', null, h('th', { style: { width: '30%' } }, k), h('td', null, v));
}
