// 질문하기 (AI): 질문 + (선택) 내 코드 → Claude Haiku 5.5 가 SQL · pandas 코드로 답변
// - 문법 레퍼런스에서 관련 항목만 골라 프롬프트에 넣어(RAG) 토큰을 줄이고, 답이 사이트의 문법을 따르게 합니다.
// - API 키는 이 브라우저(localStorage)에만 저장하고 브라우저에서 Anthropic API 를 직접 호출합니다 (혼자 쓰는 용도).
import { h, md, store, resultTable } from '../util.js';
import { askAI, fixWithError, usesOnlySampleTables, diagnose, keyProblem, MODEL_LABEL } from '../ask/ai.js';
import { refTitle } from '../ask/retrieve.js';
import { runSQL } from '../engines.js';
import { renderError, loadingLine } from '../components.js';

const HISTORY_KEY = 'ask:history';
const KEY_KEY = 'ask:apiKey';
const SPENT_KEY = 'ask:spentUsd';
const EXAMPLES = [
  'orders에서 payment_method별 total_amount 합계',
  'orders에서 status가 completed인 주문의 월별 매출 합계',
  'users에서 channel별 유저 수',
  'employees에서 부서별 급여 상위 2명',
  'SQL에서 WHERE와 HAVING 차이가 뭔가요?',
];
const KIND = { code: ['코드 답변', 'ok'], concept: ['개념 설명', 'accent'], out_of_scope: ['범위 밖 질문', 'lv-3'] };
const usd = (x) => (x < 0.01 ? `$${x.toFixed(5)}` : `$${x.toFixed(3)}`);
const maskKey = (k) => (k ? `${k.slice(0, 10)}…${k.slice(-4)}` : '');

/** 연결 진단 버튼 + 결과 목록 (auto: 바로 실행) */
function diagBox(label, auto = false) {
  const out = h('div', { class: 'ask-diag' });
  const btn = h('button', { class: 'btn ghost sm', type: 'button' }, label);
  const run = async () => {
    btn.disabled = true;
    out.replaceChildren(loadingLine('api.anthropic.com 연결을 확인하는 중…'));
    const { checks, hint } = await diagnose(store.get(KEY_KEY, ''));
    out.replaceChildren(
      h('ul', { class: 'ask-diag-list' }, checks.map((c) => h('li', { class: c.ok ? 'ok' : 'bad' },
        h('span', { 'aria-hidden': 'true' }, c.ok ? '✓' : '✗'), ' ', h('b', null, c.label), c.detail ? h('span', { class: 'muted' }, ` — ${c.detail}`) : null))),
      h('div', { class: 'callout info small md', html: md(hint) }));
    btn.disabled = false;
  };
  btn.addEventListener('click', run);
  if (auto) queueMicrotask(run);
  return h('div', { class: 'stack', style: { marginTop: '8px', gap: '6px' } }, h('div', null, btn), out);
}

export default {
  id: 'ask',
  title: '질문하기',

  mount(el) {
    // 답변을 기다리다 페이지를 닫은 질문은 '중단됨'으로 표시 (다시 시도 가능)
    this.history = store.get(HISTORY_KEY, []).map((e) => (e.status === 'loading' ? { ...e, status: 'error', error: '답변을 기다리는 중에 페이지를 벗어났습니다.' } : e));
    this.live = new Map(); // 이번 세션에서 받은 답의 대화 내용 (오류 고쳐 달라고 할 때 사용)
    this.thread = h('div', { class: 'ask-thread' });
    this.q = h('textarea', { rows: 2, placeholder: '예: 이 코드에서 si_do_name별 sales_qty 합을 구하는 방법', 'aria-label': '질문' });
    this.code = h('textarea', { rows: 6, class: 'mono', placeholder: '내 코드, CREATE TABLE 문, CSV 헤더, df.columns · df.info() 출력 등을 붙여 넣으면 실제 테이블·컬럼 이름으로 답합니다.', 'aria-label': '내 코드 또는 테이블 정보' });
    this.code.value = store.get('ask:code', '');
    this.code.addEventListener('input', () => store.set('ask:code', this.code.value));
    this.lang = h('select', { 'aria-label': '답변 언어', style: { width: 'auto' } },
      h('option', { value: 'auto' }, 'SQL + pandas'), h('option', { value: 'sql' }, 'SQL만'), h('option', { value: 'pandas' }, 'pandas만'));
    this.lang.value = store.get('ask:lang', 'auto');
    this.lang.addEventListener('change', () => store.set('ask:lang', this.lang.value));
    this.q.addEventListener('keydown', (e) => {
      // 한글 조합 중 Enter 는 무시, Shift+Enter 는 줄바꿈
      if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229 && !e.shiftKey) { e.preventDefault(); this.ask(); }
    });
    this.settings = h('details', { class: 'card ask-settings', open: !store.get(KEY_KEY, '') || null });
    this.spentEl = h('span', { class: 'small muted' });
    this.renderSettings();

    el.append(
      h('div', { class: 'page-head' },
        h('h1', null, 'SQL · pandas 질문하기'),
        h('p', null, `"어떤 컬럼별로 무엇을 구하고 싶은지" 물어보면 ${MODEL_LABEL}가 SQL과 pandas 코드로 답합니다. 질문과 관련된 문법 레퍼런스 항목을 함께 보내 답이 사이트의 문법을 따르게 하고, 샘플 테이블 질문이면 SQL을 바로 실행해 결과까지 보여줍니다.`)),
      h('div', { class: 'ask-wrap' },
        this.settings,
        this.thread,
        h('div', { class: 'card ask-composer' },
          this.q,
          h('details', { class: 'ask-code', open: !!this.code.value || null }, h('summary', null, '내 코드 / 테이블 정보 붙여넣기 (선택)'), this.code),
          h('div', { class: 'row between' },
            h('div', { class: 'row' }, this.lang, h('span', { class: 'small muted' }, 'Enter 보내기 · Shift+Enter 줄바꿈')),
            h('div', { class: 'row' },
              h('button', { class: 'btn ghost sm', type: 'button', onclick: () => this.clear() }, '기록 지우기'),
              h('button', { class: 'btn primary', type: 'button', onclick: () => this.ask() }, '질문하기'))),
          h('div', { class: 'ask-examples' }, h('span', { class: 'small muted' }, '샘플 데이터로 해보기: '),
            EXAMPLES.map((x) => h('button', { class: 'chip', type: 'button', onclick: () => { this.q.value = x; this.ask({ code: '' }); } }, x))))));
    this.renderThread();
  },

  renderSettings() {
    const key = store.get(KEY_KEY, '');
    const input = h('input', { type: 'password', placeholder: 'sk-ant-…', autocomplete: 'off', 'aria-label': 'Anthropic API 키', value: '' });
    const effort = h('select', { 'aria-label': '답변 방식', style: { width: 'auto' } },
      h('option', { value: 'low' }, '빠르고 저렴하게 (기본)'), h('option', { value: 'medium' }, '조금 더 꼼꼼하게'));
    effort.value = store.get('ask:effort', 'low');
    effort.addEventListener('change', () => store.set('ask:effort', effort.value));
    const save = () => {
      const v = input.value.trim();
      const kp = keyProblem(v);
      if (kp) { input.setCustomValidity(kp); input.reportValidity(); return; }
      store.set(KEY_KEY, v);
      this.settings.open = false;
      this.renderSettings();
    };
    input.addEventListener('input', () => input.setCustomValidity(''));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } });
    this.spentEl.textContent = `지금까지 사용: ${usd(store.get(SPENT_KEY, 0))}`;
    this.settings.replaceChildren(
      h('summary', null, h('b', null, 'AI 설정'), ' ', key ? h('span', { class: 'badge ok' }, `키 저장됨 ${maskKey(key)}`) : h('span', { class: 'badge lv-3' }, 'API 키 필요'), ' ', this.spentEl),
      h('div', { class: 'stack', style: { marginTop: '10px' } },
        h('div', { class: 'row', style: { flexWrap: 'nowrap' } }, input,
          h('button', { class: 'btn', type: 'button', onclick: save }, key ? '키 바꾸기' : '저장'),
          key ? h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { if (confirm('저장된 API 키를 지울까요?')) { store.set(KEY_KEY, ''); this.renderSettings(); } } }, '키 지우기') : null),
        h('label', { class: 'row small' }, '답변 방식: ', effort),
        key ? diagBox('연결 테스트 (비용 없음)') : null,
        h('div', { class: 'callout info small md', html: md([
          `- 모델: **${MODEL_LABEL}** (질문 1건에 보통 $0.001 미만)`,
          '- 키는 [Anthropic Console](https://console.anthropic.com/settings/keys)에서 만들 수 있습니다. **이 브라우저에만 저장**되고 Anthropic API 외에는 어디로도 보내지 않습니다.',
          '- 질문과 붙여 넣은 코드는 Anthropic API로 전송됩니다. 회사 코드라면 보안 정책을 먼저 확인하고, 실제 데이터 값은 붙여 넣지 마세요.',
        ].join('\n')) })));
  },

  addSpent(x) {
    store.set(SPENT_KEY, store.get(SPENT_KEY, 0) + x);
    this.spentEl.textContent = `지금까지 사용: ${usd(store.get(SPENT_KEY, 0))}`;
  },

  async ask({ code } = {}) {
    const question = this.q.value.trim();
    if (!question) { this.q.focus(); return; }
    const apiKey = store.get(KEY_KEY, '');
    if (!apiKey) { this.settings.open = true; this.settings.scrollIntoView({ block: 'center' }); return; }
    const entry = { id: Date.now(), question, code: code ?? this.code.value, lang: this.lang.value, status: 'loading' };
    this.history = [...this.history, entry].slice(-20);
    this.q.value = '';
    const node = this.renderEntry(entry);
    this.thread.querySelector('.ask-empty')?.remove();
    this.thread.append(node);
    node.scrollIntoView({ block: 'start', behavior: 'smooth' });
    await this.run(entry, () => askAI({ apiKey, question, code: entry.code, lang: entry.lang, effort: store.get('ask:effort', 'low') }));
  },

  async run(entry, call) {
    entry.status = 'loading';
    this.repaint(entry);
    try {
      const res = await call();
      this.live.set(entry.id, res);
      Object.assign(entry, { status: 'done', answer: res.answer, cost: res.cost, sampleTables: res.sampleTables, error: null, errorKind: null, errorDetail: null });
      this.addSpent(res.cost.usd);
    } catch (e) {
      Object.assign(entry, { status: 'error', error: e.message || String(e), errorKind: e.kind || null, errorDetail: e.detail || null });
      this.freshError = entry.id; // 방금 난 연결 오류는 진단을 바로 실행 (기록에서 다시 그릴 때는 버튼만)
    }
    this.save();
    this.repaint(entry);
    this.freshError = null;
  },

  save() { store.set(HISTORY_KEY, this.history.map(({ ...e }) => e)); },

  clear() {
    if (!this.history.length || !confirm('질문 기록을 모두 지울까요?')) return;
    this.history = [];
    this.live.clear();
    this.save();
    this.renderThread();
  },

  renderThread() {
    this.thread.replaceChildren(...(this.history.length
      ? this.history.map((e) => this.renderEntry(e))
      : [h('div', { class: 'card empty ask-empty' }, '아직 질문이 없습니다. API 키를 저장한 뒤 아래에 질문을 적거나 예시를 눌러 보세요.')]));
  },

  repaint(entry) {
    const node = this.thread.querySelector(`[data-entry="${entry.id}"] .ask-a`);
    if (node) node.replaceChildren(...this.answerBody(entry).filter(Boolean));
  },

  renderEntry(entry) {
    const userBubble = h('div', { class: 'ask-q' },
      h('div', { class: 'ask-q-text' }, entry.question),
      entry.code?.trim() ? h('details', { class: 'ask-q-code' }, h('summary', null, `코드 ${entry.code.trim().split('\n').length}줄 첨부`), h('pre', { class: 'no-enhance' }, entry.code.trim())) : null);
    const answer = h('div', { class: 'card ask-a' });
    answer.append(...this.answerBody(entry).filter(Boolean));
    return h('div', { class: 'ask-entry', 'data-entry': entry.id }, userBubble, answer);
  },

  answerBody(entry) {
    if (entry.status === 'loading') return [loadingLine(`${MODEL_LABEL}가 답변을 만드는 중…`)];
    if (entry.status === 'error' || !entry.answer) {
      const apiKey = store.get(KEY_KEY, '');
      return [
        h('div', { class: 'callout bad small' }, entry.error || '답변을 받지 못했습니다.',
          entry.errorDetail ? h('div', { class: 'small muted ask-err-detail' }, `원인: ${entry.errorDetail}`) : null),
        entry.errorKind === 'connection' || entry.errorKind === 'key' ? diagBox('연결 진단', entry.errorKind === 'connection' && this.freshError === entry.id) : null,
        h('div', { class: 'row', style: { marginTop: '8px' } },
          h('button', { class: 'btn sm', type: 'button', onclick: () => this.run(entry, () => askAI({ apiKey: store.get(KEY_KEY, ''), question: entry.question, code: entry.code, lang: entry.lang, effort: store.get('ask:effort', 'low') })) }, '다시 시도'),
          !apiKey ? h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { this.settings.open = true; this.settings.scrollIntoView({ block: 'center' }); } }, 'API 키 저장하기') : null),
      ];
    }
    const a = entry.answer;
    const [kLabel, kCls] = KIND[a.kind] || KIND.code;
    const langs = [['sql', a.sql], ['pandas', a.pandas]].filter(([, c]) => c);
    let showing = langs[0]?.[0];
    const tabs = h('div', { class: 'seg ask-tabs', role: 'tablist' });
    const codeBox = h('div');
    const paintCode = () => {
      tabs.replaceChildren(...langs.map(([l]) => h('button', {
        type: 'button', role: 'tab', class: l === showing ? 'on' : '', 'aria-selected': String(l === showing),
        onclick: () => { showing = l; paintCode(); },
      }, l === 'sql' ? 'SQL' : 'pandas')));
      const cur = langs.find(([l]) => l === showing);
      codeBox.replaceChildren(cur ? h('pre', null, h('code', { 'data-lang': showing === 'sql' ? 'sql' : 'python' }, cur[1])) : '');
    };
    paintCode();
    // 샘플 테이블만 쓰는 SQL 이면 바로 실행해 결과 미리보기
    const preview = h('div', { class: 'ask-preview' });
    if (a.sql && usesOnlySampleTables(a.sql)) this.preview(entry, preview);
    return [
      h('div', { class: 'ask-head' }, h('b', null, a.title), h('span', { class: `badge ${kCls}` }, kLabel)),
      a.explanation ? h('div', { class: 'md ask-expl', html: md(a.explanation) }) : null,
      langs.length ? h('div', { class: 'row between', style: { marginTop: '10px' } }, langs.length > 1 ? tabs : h('span', { class: 'small muted' }, langs[0][0] === 'sql' ? 'SQL' : 'pandas')) : null,
      langs.length ? codeBox : null,
      preview,
      a.usedRefs?.length ? h('div', { class: 'ask-refs small' }, h('span', { class: 'muted' }, '참고한 문법: '),
        a.usedRefs.map((k) => { const [lang, id] = k.split(':'); return h('a', { class: 'chip', href: `#/reference?lang=${lang}&id=${id}` }, `${lang === 'sql' ? 'SQL' : 'pandas'} · ${refTitle(k)}`); })) : null,
      a.assumptions?.length ? h('div', { class: 'callout warn md small', style: { marginTop: '10px' }, html: md(`**가정한 내용**\n${a.assumptions.map((x) => `- ${x}`).join('\n')}`) }) : null,
      entry.cost ? h('div', { class: 'small muted ask-cost' }, `${MODEL_LABEL} · 입력 ${entry.cost.tokensIn.toLocaleString()} · 출력 ${entry.cost.tokensOut.toLocaleString()} 토큰 · 약 ${usd(entry.cost.usd)}`) : null,
    ];
  },

  async preview(entry, box) {
    box.replaceChildren(loadingLine('샘플 데이터에서 SQL 실행 중…'));
    try {
      const r = await runSQL(entry.answer.sql);
      box.replaceChildren(h('div', { class: 'small muted', style: { margin: '8px 0 4px' } }, '샘플 데이터 실행 결과'), resultTable(r, { limit: 20 }));
    } catch (e) {
      const prev = this.live.get(entry.id);
      box.replaceChildren(
        h('div', { class: 'small muted', style: { margin: '8px 0 4px' } }, '샘플 데이터에서 실행하니 오류가 났습니다'),
        renderError(e),
        prev ? h('button', {
          class: 'btn sm', type: 'button', style: { marginTop: '6px' },
          onclick: () => this.run(entry, () => fixWithError({ apiKey: store.get(KEY_KEY, ''), prev, error: e.message || String(e) })),
        }, '오류를 보여주고 고쳐 달라고 하기 (추가 요청 1회)') : h('div', { class: 'small muted' }, '같은 질문을 다시 보내 보세요.'));
    }
  },
};
