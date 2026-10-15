// 질문하기: 자연어 질문 + (선택) 내 코드 → 정해진 문법(레시피) 안에서 SQL/pandas 코드로 답변
// 해석은 브라우저 안의 규칙 엔진(ask/engine.js)이 합니다. 서버·API 호출이 없어 비용이 들지 않습니다.
import { h, md, store } from '../util.js';
import { understand, build, RECIPES } from '../ask/engine.js';
import { describeSlots } from '../ask/recipes.js';
import { AGG_LABEL, UNIT_LABEL } from '../ask/lexicon.js';
import { REF_LANGS } from '../data/reference.js';

const HISTORY_KEY = 'ask:history';
const EXAMPLES = [
  'orders에서 payment_method별 total_amount 합계',
  'orders에서 status가 completed인 주문의 월별 매출 합계',
  'users에서 channel별 유저 수',
  'orders에서 user_id별 total_amount 합계 상위 5명',
  'ab_test에서 variant별 전환율',
  'employees에서 dept_id별 salary 순위',
];
const CONF = { high: ['확실', 'ok'], medium: ['확인 필요', 'lv-2'], low: ['추측', 'lv-3'] };
const refTitle = (lang, id) => REF_LANGS.find((l) => l.id === lang)?.items.find((i) => i.id === id)?.title || id;

export default {
  id: 'ask',
  title: '질문하기',

  mount(el) {
    this.history = store.get(HISTORY_KEY, []);
    this.thread = h('div', { class: 'ask-thread' });
    this.q = h('textarea', { rows: 2, placeholder: '예: si_do_name별 sales_qty 합을 구하는 방법', 'aria-label': '질문' });
    this.code = h('textarea', { rows: 6, class: 'mono', placeholder: '내 코드, CREATE TABLE 문, CSV 헤더, 또는 "컬럼: a, b, c" 를 붙여 넣으면 실제 컬럼 이름으로 답합니다.', 'aria-label': '내 코드 또는 테이블 정보' });
    this.code.value = store.get('ask:code', '');
    this.code.addEventListener('input', () => store.set('ask:code', this.code.value));
    this.lang = h('select', { 'aria-label': '답변 언어', style: { width: 'auto' } },
      h('option', { value: 'auto' }, '언어: 자동'), h('option', { value: 'sql' }, 'SQL 먼저'), h('option', { value: 'pandas' }, 'pandas 먼저'));
    this.lang.value = store.get('ask:lang', 'auto');
    this.lang.addEventListener('change', () => store.set('ask:lang', this.lang.value));
    const submit = () => this.ask();
    this.q.addEventListener('keydown', (e) => {
      // 한글 입력 중(조합 중) Enter 는 무시
      if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229 && (e.ctrlKey || e.metaKey || !e.shiftKey)) { e.preventDefault(); submit(); }
    });
    const codeBox = h('details', { class: 'ask-code', open: !!this.code.value || null },
      h('summary', null, '내 코드 / 테이블 정보 붙여넣기 (선택)'), this.code);

    el.append(
      h('div', { class: 'page-head' },
        h('h1', null, 'SQL · pandas 질문하기'),
        h('p', null, '"어떤 컬럼별로 무엇을 구하고 싶은지"를 물어보면, 정해진 문법 안에서 SQL과 pandas 코드로 답합니다. 내 코드를 붙여 넣으면 그 안의 테이블·컬럼 이름을 그대로 씁니다. 답변은 브라우저 안의 규칙 엔진이 만들어서 서버 비용이 들지 않습니다.')),
      h('div', { class: 'ask-wrap' },
        this.thread,
        h('div', { class: 'card ask-composer' },
          this.q, codeBox,
          h('div', { class: 'row between' },
            h('div', { class: 'row' }, this.lang, h('span', { class: 'small muted' }, 'Enter 보내기 · Shift+Enter 줄바꿈')),
            h('div', { class: 'row' },
              h('button', { class: 'btn ghost sm', type: 'button', onclick: () => this.clear() }, '기록 지우기'),
              h('button', { class: 'btn primary', type: 'button', onclick: submit }, '질문하기'))),
          h('div', { class: 'ask-examples' }, h('span', { class: 'small muted' }, '샘플 데이터로 해보기: '),
            // 예시는 샘플 테이블 질문이라 붙여 넣은 코드 없이 물어봄
            EXAMPLES.map((x) => h('button', { class: 'chip', type: 'button', onclick: () => { this.q.value = x; this.ask({ code: '' }); } }, x))))));
    this.renderThread();
  },

  ask({ code } = {}) {
    const question = this.q.value.trim();
    if (!question) { this.q.focus(); return; }
    const entry = { question, code: code ?? this.code.value, lang: this.lang.value, at: Date.now() };
    this.history = [...this.history, entry].slice(-15);
    store.set(HISTORY_KEY, this.history);
    this.q.value = '';
    const node = this.renderEntry(entry, this.history.length - 1);
    this.thread.append(node);
    node.scrollIntoView({ block: 'start', behavior: 'smooth' });
  },

  clear() {
    if (!this.history.length || !confirm('질문 기록을 모두 지울까요?')) return;
    this.history = [];
    store.set(HISTORY_KEY, []);
    this.renderThread();
  },

  save(idx, patch) {
    if (!this.history[idx]) return;
    this.history[idx] = { ...this.history[idx], ...patch };
    store.set(HISTORY_KEY, this.history);
  },

  renderThread() {
    this.thread.replaceChildren(...(this.history.length
      ? this.history.map((e, i) => this.renderEntry(e, i))
      : [h('div', { class: 'card empty ask-empty' }, '아직 질문이 없습니다. 아래에 질문을 적거나 예시를 눌러 보세요.')]));
  },

  renderEntry(entry, idx) {
    const info = understand(entry.question, entry.code, { lang: entry.lang });
    const userBubble = h('div', { class: 'ask-q' },
      h('div', { class: 'ask-q-text' }, entry.question),
      entry.code?.trim() ? h('details', { class: 'ask-q-code' }, h('summary', null, `코드 ${entry.code.trim().split('\n').length}줄 첨부`), h('pre', { class: 'no-enhance' }, entry.code.trim())) : null);
    const answer = h('div', { class: 'card ask-a' });
    // 저장된 수정 내용(다른 해석 선택, 빈칸 수정)이 있으면 그것으로
    let current = entry.recipe ? { recipe: entry.recipe, slots: entry.slots } : info.best;
    const paint = () => answer.replaceChildren(...this.answerBody(info, current, (next) => { current = next; this.save(idx, next); paint(); }));
    paint();
    return h('div', { class: 'ask-entry' }, userBubble, answer);
  },

  answerBody(info, cur, change) {
    if (!cur) {
      return [
        h('div', { class: 'ask-head' }, h('b', null, '정해진 레시피로는 답하기 어려운 질문이에요'), h('span', { class: 'badge lv-3' }, '레시피 없음')),
        h('p', { class: 'small muted' }, '"X별 Y의 합계", "Z가 100 이상인 행", "월별 매출", "그룹별 상위 3개"처럼 기준 컬럼과 구하려는 값을 함께 적으면 코드로 답할 수 있습니다.'),
        this.refList(info.refs, '관련 있어 보이는 문법'),
      ];
    }
    const recipe = RECIPES.find((r) => r.id === cur.recipe);
    const out = build(cur.recipe, cur.slots, info);
    const conf = cur === info.best ? info.confidence : 'high';
    const [cLabel, cCls] = CONF[conf];
    const primary = info.lang === 'pandas' ? 'pandas' : 'sql';
    const order = primary === 'sql' ? ['sql', 'pandas'] : ['pandas', 'sql'];
    let showing = primary;
    const codeBox = h('div');
    const tabs = h('div', { class: 'seg ask-tabs', role: 'tablist' });
    const paintCode = () => {
      tabs.replaceChildren(...order.map((l) => h('button', {
        type: 'button', role: 'tab', class: l === showing ? 'on' : '', 'aria-selected': String(l === showing),
        onclick: () => { showing = l; paintCode(); },
      }, l === 'sql' ? 'SQL' : 'pandas')));
      codeBox.replaceChildren(h('pre', null, h('code', { 'data-lang': showing === 'sql' ? 'sql' : 'python' }, showing === 'sql' ? out.sql : out.pandas)));
    };
    paintCode();
    const alts = info.candidates.filter((c) => c.recipe !== cur.recipe).slice(0, 3);
    const notes = [...info.assumptions, ...out.notes];
    return [
      h('div', { class: 'ask-head' },
        h('div', null, h('b', null, recipe.title), h('div', { class: 'small muted' }, recipe.desc)),
        h('span', { class: `badge ${cCls}`, title: '규칙 엔진의 해석 확신도' }, cLabel)),
      h('div', { class: 'ask-interp small' }, h('span', { class: 'muted' }, '해석: '), describeSlots(cur.recipe, cur.slots) || '—'),
      this.slotEditor(cur, info, change),
      h('div', { class: 'row between', style: { marginTop: '10px' } }, tabs, h('span', { class: 'small muted' }, info.table ? `테이블: ${info.table}` : '')),
      codeBox,
      h('div', { class: 'ask-refs small' }, h('span', { class: 'muted' }, '사용한 문법: '),
        order.flatMap((l) => recipe.refs[l].map((id) => h('a', { class: 'chip', href: `#/reference?lang=${l}&id=${id}` }, `${l === 'sql' ? 'SQL' : 'pandas'} · ${refTitle(l, id)}`)))),
      notes.length ? h('div', { class: 'callout warn md small', style: { marginTop: '10px' }, html: md(notes.map((n) => `- ${n}`).join('\n')) }) : null,
      alts.length ? h('div', { class: 'ask-alts small' }, h('span', { class: 'muted' }, '다른 해석: '),
        alts.map((a) => h('button', { class: 'chip', type: 'button', onclick: () => change({ recipe: a.recipe, slots: a.slots }) }, RECIPES.find((r) => r.id === a.recipe).title))) : null,
      conf === 'low' && info.refs.length ? this.refList(info.refs, '관련 문법') : null,
    ];
  },

  refList(refs, title) {
    if (!refs.length) return h('p', { class: 'small muted' }, '관련 문법을 찾지 못했습니다. 문법 레퍼런스 탭에서 검색해 보세요.');
    return h('div', { class: 'ask-ref-list' }, h('div', { class: 'small muted' }, `${title}:`),
      h('ul', null, refs.map((r) => h('li', null, h('span', { class: 'badge', style: { marginRight: '6px' } }, r.lang === 'sql' ? 'SQL' : 'pandas'), h('a', { href: `#/reference?lang=${r.lang}&id=${r.id}` }, r.title), h('span', { class: 'small muted' }, ` — ${r.summary}`)))));
  },

  /** 해석 수정: 빈칸을 바꾸면 코드가 바로 다시 만들어짐 */
  slotEditor(cur, info, change) {
    const s = cur.slots;
    const listId = `cols-${Math.random().toString(36).slice(2, 8)}`;
    const dl = h('datalist', { id: listId }, info.columns.map((c) => h('option', { value: c })));
    const set = (patch) => change({ recipe: cur.recipe, slots: { ...s, ...patch } });
    const text = (label, key, { multi = false } = {}) => {
      const v = multi ? (s[key] || []).join(', ') : (s[key] ?? '');
      const input = h('input', { type: 'text', value: v, list: listId, 'aria-label': label });
      input.addEventListener('change', () => {
        const val = input.value.trim();
        set({ [key]: multi ? val.split(/\s*,\s*/).filter(Boolean) : (val || null) });
      });
      return h('label', { class: 'field' }, label, input);
    };
    const select = (label, key, opts) => {
      const el = h('select', { 'aria-label': label }, opts.map(([v, l]) => h('option', { value: v }, l)));
      el.value = s[key] ?? opts[0][0];
      el.addEventListener('change', () => set({ [key]: el.value === '' ? null : el.value }));
      return h('label', { class: 'field' }, label, el);
    };
    const num = (label, key) => {
      const el = h('input', { type: 'number', min: 1, value: s[key] ?? '', 'aria-label': label });
      el.addEventListener('change', () => set({ [key]: el.value ? parseInt(el.value, 10) : null }));
      return h('label', { class: 'field' }, label, el);
    };
    const aggOpts = Object.entries(AGG_LABEL);
    const fields = [];
    const has = (k) => k in s && s[k] !== undefined;
    if (has('keys') && cur.recipe !== 'join') fields.push(text('기준 컬럼 (쉼표로 여러 개)', 'keys', { multi: true }));
    if (has('dateCol')) fields.push(text('날짜 컬럼', 'dateCol'));
    if (has('unit')) fields.push(select('날짜 단위', 'unit', [['', '(없음 — 행 단위)'], ...Object.entries(UNIT_LABEL)]));
    if (has('orderCol') && !s.unit) fields.push(text('정렬(순서) 컬럼', 'orderCol'));
    if (s.metrics?.length) {
      s.metrics.forEach((m, i) => {
        const agg = h('select', { 'aria-label': `집계 ${i + 1}` }, aggOpts.map(([v, l]) => h('option', { value: v }, l)));
        agg.value = m.agg;
        const col = h('input', { type: 'text', value: m.col || '', list: listId, placeholder: m.agg === 'count' ? '(비우면 행 수)' : '컬럼', 'aria-label': `집계 컬럼 ${i + 1}` });
        const upd = () => { const ms = s.metrics.slice(); ms[i] = { agg: agg.value, col: col.value.trim() || null }; if (ms[i].agg !== 'count' && !ms[i].col) return; set({ metrics: ms }); };
        agg.addEventListener('change', upd);
        col.addEventListener('change', upd);
        fields.push(h('label', { class: 'field' }, `값 ${s.metrics.length > 1 ? i + 1 : ''}`, h('div', { class: 'row', style: { flexWrap: 'nowrap', gap: '6px' } }, agg, col)));
      });
    } else if (has('value')) fields.push(text('값 컬럼', 'value'));
    if (has('item')) fields.push(text('뽑을 항목 컬럼 (선택)', 'item'));
    if (has('agg') && !s.metrics) fields.push(select('집계', 'agg', aggOpts));
    if (has('limit')) fields.push(num('N개', 'limit'));
    if (has('order')) fields.push(select('정렬', 'order', [['', '(기본)'], ['desc', '큰 값부터'], ['asc', '작은 값부터']]));
    if (has('window')) fields.push(num('이동 창 크기', 'window'));
    if (has('index')) fields.push(text('행(index)', 'index'));
    if (has('columns')) fields.push(text('열(columns)', 'columns'));
    if (has('right')) fields.push(text('붙일 테이블', 'right'));
    if (has('key')) fields.push(text('조인 키', 'key'));
    if (has('how')) fields.push(select('조인 방식', 'how', [['left', 'LEFT (왼쪽 전부)'], ['inner', 'INNER (양쪽 모두)'], ['outer', 'FULL OUTER (전부)']]));
    if (has('col')) fields.push(text('대상 컬럼', 'col'));
    if (has('mode')) fields.push(select('처리', 'mode', [['count', '개수 확인'], ['fill', '값 채우기'], ['drop', '행 제거']]));
    if (has('cols') && cur.recipe !== 'filter') fields.push(text('컬럼 (쉼표로 여러 개)', 'cols', { multi: true }));
    if (!fields.length) return null;
    return h('details', { class: 'ask-edit' }, h('summary', null, '해석 고치기 (컬럼·집계·단위 바꾸기)'),
      h('div', { class: 'field-grid', style: { marginTop: '8px' } }, fields), dl,
      s.filters?.length ? h('p', { class: 'small muted', style: { margin: '8px 0 0' } }, '조건(WHERE)은 질문 문장에서 읽었습니다. 바꾸려면 질문을 고쳐 다시 물어보세요.') : null);
  },
};
