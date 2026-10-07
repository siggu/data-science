import { h, md, store, resultTable } from '../util.js';
import { CASES, FRAMEWORKS } from '../data/cases.js';
import { runSQL } from '../engines.js';
import { renderError, loadingLine } from '../components.js';
import { LEVELS } from '../data/interview.js';

export default {
  id: 'cases',
  title: '케이스 트레이닝',
  mount(el) {
    this.el = el;
    this.listView();
  },

  onShow(params) {
    if (params.id) this.caseView(params.id);
    else this.listView();
  },

  listView() {
    const done = new Set(store.get('case:done', []));
    this.el.replaceChildren(
      h('div', { class: 'page-head' },
        h('h1', null, '프로덕트 케이스 트레이닝'),
        h('p', null, '"DAU가 떨어졌다", "새 기능의 성공을 어떻게 측정하나" 같은 케이스 면접을 단계별로 연습합니다. 각 단계에서 내 생각을 먼저 적고 모범 답안을 펼쳐 비교하세요. 일부 케이스는 샘플 데이터로 직접 원인을 확인하는 실습이 포함되어 있습니다.')),
      h('div', { class: 'grid grid-2' }, CASES.map((c) => h('a', { class: 'card nav-card', href: `#/cases?id=${c.id}` },
        h('div', { class: 'row' },
          h('span', { class: `badge lv-${c.level}` }, LEVELS[c.level]),
          c.tags.map((t) => h('span', { class: 'badge' }, t)),
          done.has(c.id) ? h('span', { class: 'badge ok' }, '✓ 완료') : null),
        h('h3', { style: { marginTop: '10px' } }, c.title),
        h('div', { class: 'small muted' }, `${c.steps.length}단계${c.dataCheck ? ' · 데이터 실습 포함' : ''}`)))),
      h('h2', { style: { marginTop: '28px' } }, '케이스 면접 프레임워크'),
      h('div', { class: 'grid grid-2' }, FRAMEWORKS.map((f) => h('div', { class: 'card' }, h('h3', null, f.title), h('div', { class: 'md small', html: md(f.body) })))));
  },

  caseView(id) {
    const c = CASES.find((x) => x.id === id);
    if (!c) return this.listView();
    const notesKey = `case:notes:${c.id}`;
    const notes = store.get(notesKey, {});
    const done = store.has('case:done', c.id);

    const steps = c.steps.map((s, i) => {
      const ta = h('textarea', { rows: 4, placeholder: s.guide, 'aria-label': `${i + 1}단계 내 답변` });
      ta.value = notes[i] || '';
      ta.addEventListener('input', () => { notes[i] = ta.value; store.set(notesKey, notes); });
      const model = h('div', { class: 'model-answer md', html: md(s.model), hidden: true });
      const btn = h('button', { class: 'btn sm', type: 'button', onclick: () => { model.hidden = !model.hidden; btn.textContent = model.hidden ? '모범 답안 보기' : '모범 답안 숨기기'; } }, '모범 답안 보기');
      return h('div', { class: 'step' },
        h('div', { class: 'step-head' }, h('span', { class: 'step-num' }, i + 1), h('h3', { style: { margin: 0 } }, s.title)),
        h('div', { class: 'step-body stack' }, h('div', { class: 'small muted' }, s.guide), ta, h('div', null, btn), model));
    });

    const dataOut = h('div', { style: { marginTop: '10px' } });
    const runCheck = async () => {
      dataOut.replaceChildren(loadingLine('SQL 엔진에서 실행 중… (처음이면 데이터 로딩 포함)'));
      try { dataOut.replaceChildren(resultTable(await runSQL(c.dataCheck))); } catch (e) { dataOut.replaceChildren(renderError(e)); }
    };

    this.el.replaceChildren(
      h('div', { class: 'row', style: { marginBottom: '12px' } }, h('a', { class: 'btn ghost sm', href: '#/cases' }, '← 케이스 목록')),
      h('div', { class: 'card', style: { marginBottom: '16px' } },
        h('div', { class: 'row' }, h('span', { class: `badge lv-${c.level}` }, LEVELS[c.level]), c.tags.map((t) => h('span', { class: 'badge' }, t))),
        h('h1', { style: { marginTop: '10px', fontSize: '1.4rem' } }, c.title),
        h('div', { class: 'md', html: md(c.situation) })),
      ...steps,
      c.dataCheck ? h('div', { class: 'card', style: { marginBottom: '12px' } },
        h('h3', null, '데이터로 확인하기'),
        h('p', { class: 'small muted' }, c.dataCheckDesc),
        h('pre', null, h('code', null, c.dataCheck)),
        h('div', { class: 'row' },
          h('button', { class: 'btn primary', type: 'button', onclick: runCheck }, '▶ 쿼리 실행'),
          h('a', { class: 'btn', href: '#/playground', onclick: () => store.set('pg:inject', c.dataCheck) }, '플레이그라운드에서 수정하기')),
        dataOut) : null,
      h('div', { class: 'card' },
        h('h3', null, '자기 평가 체크리스트'),
        h('div', { class: 'check-list' }, c.rubric.map((r) => h('label', null, h('input', { type: 'checkbox' }), h('span', null, r)))),
        h('div', { class: 'row', style: { marginTop: '12px' } },
          h('button', {
            class: `btn ${done ? '' : 'primary'}`, type: 'button',
            onclick: () => { store.toggle('case:done', c.id); this.caseView(c.id); },
          }, done ? '완료 해제' : '✓ 케이스 완료로 표시'),
          h('button', { class: 'btn ghost', type: 'button', onclick: () => { if (confirm('이 케이스에 적은 답변을 지울까요?')) { store.set(notesKey, {}); this.caseView(c.id); } } }, '내 답변 지우기'))));
    window.scrollTo(0, 0);
  },
};
