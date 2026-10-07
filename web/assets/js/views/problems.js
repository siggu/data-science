import { h, md, store, resultTable, compareResults } from '../util.js';
import { PROBLEMS, LEVEL_NAME } from '../data/problems.js';
import { QUESTIONS } from '../data/interview.js';
import { TABLES } from '../config.js';
import { createEditor } from '../editor.js';
import { renderPyOutput, renderError, loadingLine } from '../components.js';
import { runSQL, getDuckDB, getPyodide, runPython, gradePython, engineState } from '../engines.js';

const starter = (p) => (p.lang === 'sql'
  ? `-- ${p.title}\nSELECT\n    \nFROM `
  : `# ${p.title}\n# 최종 결과를 result 변수에 담아주세요\nresult = `);

export default {
  id: 'problems',
  title: '문제은행',
  mount(el) {
    this.filter = { lang: 'all', level: 'all', status: 'all' };
    this.listEl = h('div');
    this.filterEl = h('div', { class: 'stack', style: { marginBottom: '10px' } });
    this.detailEl = h('div');
    el.append(
      h('div', { class: 'page-head' },
        h('h1', null, 'SQL · pandas 문제은행'),
        h('p', null, `면접과 실무에서 자주 나오는 패턴 ${PROBLEMS.length}문제입니다. 샘플 데이터로 직접 풀고 "채점"을 누르면 정답 쿼리의 결과와 비교합니다. 컬럼 이름은 채점하지 않고 값과 행 수, 컬럼 수를 비교합니다 (숫자는 소수 넷째 자리까지). 맞힌 뒤에는 다른 언어 풀이(SQL ↔ pandas)도 확인해 보세요.`)),
      h('div', { class: 'split' },
        h('aside', { class: 'card flat sticky-side prob-aside' }, this.filterEl, this.listEl),
        h('div', { style: { minWidth: 0 } }, this.detailEl)));
    this.renderFilters();
    this.renderList();
    this.select(store.get('prob:last', PROBLEMS[0].id));
    getDuckDB().catch(() => {});
  },

  onShow(params) {
    if (params.id && params.id !== this.current?.id) this.select(params.id);
  },

  renderFilters() {
    const f = this.filter;
    const chip = (key, val, label) => h('button', {
      class: `chip ${f[key] === val ? 'on' : ''}`, type: 'button',
      onclick: () => { f[key] = val; this.renderFilters(); this.renderList(); },
    }, label);
    this.filterEl.replaceChildren(
      h('div', { class: 'row' }, chip('lang', 'all', '전체'), chip('lang', 'sql', 'SQL'), chip('lang', 'pandas', 'pandas')),
      h('div', { class: 'row' }, chip('level', 'all', '모든 난이도'), Object.entries(LEVEL_NAME).map(([k, v]) => chip('level', k, v))),
      h('div', { class: 'row' }, chip('status', 'all', '전체'), chip('status', 'todo', '안 푼 문제'), chip('status', 'done', '맞힌 문제')));
  },

  renderList() {
    const solved = new Set(store.get('prob:solved', []));
    const f = this.filter;
    const items = PROBLEMS.filter((p) => (f.lang === 'all' || p.lang === f.lang) &&
      (f.level === 'all' || String(p.level) === f.level) &&
      (f.status === 'all' || (f.status === 'done') === solved.has(p.id)));
    const total = PROBLEMS.filter((p) => f.lang === 'all' || p.lang === f.lang).length;
    const done = PROBLEMS.filter((p) => (f.lang === 'all' || p.lang === f.lang) && solved.has(p.id)).length;
    this.listEl.replaceChildren(
      h('div', { class: 'small muted', style: { margin: '2px 4px 8px' } }, `맞힌 문제 ${done} / ${total}`),
      ...items.map((p) => h('button', {
        class: `prob-item ${this.current?.id === p.id ? 'on' : ''}`, type: 'button', onclick: () => this.select(p.id),
      },
      h('div', { class: 't' }, solved.has(p.id) ? h('span', { class: 'solved-mark', 'aria-label': '맞힘' }, '✓') : null, p.title),
      h('div', { class: 's' }, `${p.id} · ${p.lang === 'sql' ? 'SQL' : 'pandas'} · ${LEVEL_NAME[p.level]} · ${p.topics.join(', ')}`))));
  },

  select(id) {
    const p = PROBLEMS.find((x) => x.id === id) || PROBLEMS[0];
    this.current = p;
    store.set('prob:last', p.id);
    this.renderList();
    this.renderDetail(p);
    // 좁은 화면(목록이 문제 위에 쌓이는 레이아웃)에서는 선택한 문제로 스크롤
    if (this.mounted && window.matchMedia('(max-width: 900px)').matches) this.detailEl.scrollIntoView({ block: 'start' });
    this.mounted = true;
    if (p.lang === 'pandas' && engineState.pyodide === 'idle') {
      // 미리 로딩 시작 (사용자가 문제를 읽는 동안)
      getPyodide().catch(() => {});
    }
  },

  /** 사용 테이블과 컬럼 목록 (컬럼 클릭 → 에디터에 삽입, 미리보기 → 플레이그라운드) */
  tablesBox(p, getEditor) {
    const byName = Object.fromEntries(TABLES.map((t) => [t.name, t]));
    return h('div', { class: 'tables-box' },
      h('div', { class: 'tables-box-title' }, '사용 테이블', h('span', { class: 'muted small' }, ' · 컬럼을 누르면 에디터에 입력됩니다')),
      (p.tables || []).map((name) => {
        const t = byName[name];
        return h('div', { class: 'tables-box-row' },
          h('div', { class: 'row', style: { gap: '6px' } },
            h('button', { class: 'tbl-name', type: 'button', title: '테이블 이름 입력', onclick: () => getEditor().insert(name) }, name),
            h('span', { class: 'small muted' }, t ? t.desc : ''),
            h('button', {
              class: 'btn ghost sm', type: 'button', title: '플레이그라운드에서 상위 20행 보기',
              onclick: () => {
                if (p.lang === 'sql') store.set('pg:inject', `SELECT *\nFROM ${name}\nLIMIT 20`);
                else store.set('pg:injectPy', `${name}.head(20)`);
                location.hash = '#/playground';
              },
            }, '미리보기 ↗')),
          h('div', { class: 'col-chips' }, (t ? t.columns : []).map((c) => h('button', { class: 'col-chip', type: 'button', onclick: () => getEditor().insert(c) }, c))));
      }));
  },

  renderDetail(p) {
    const out = h('div', { class: 'stack', style: { marginTop: '12px' } });
    const extra = h('div', { class: 'stack', style: { marginTop: '12px' } });
    const holder = h('div');
    const draftKey = `prob:draft:${p.id}`;
    const editor = createEditor(holder, {
      lang: p.lang === 'sql' ? 'sql' : 'python',
      value: store.get(draftKey, starter(p)),
      onRun: () => run(),
      onGrade: () => grade(),
    });
    const save = () => store.set(draftKey, editor.getValue());
    const related = QUESTIONS.filter((q) => q.practice === p.id);

    const run = async () => {
      save();
      out.replaceChildren(loadingLine(p.lang === 'pandas' && engineState.pyodide !== 'ready' ? 'Python 엔진 준비 중… (처음 한 번 10~20초)' : '실행 중…'));
      try {
        if (p.lang === 'sql') {
          const res = await runSQL(editor.getRunText());
          out.replaceChildren(resultTable(res));
        } else {
          await getPyodide();
          const res = await runPython(editor.getRunText());
          out.replaceChildren(renderPyOutput(res));
        }
      } catch (e) {
        out.replaceChildren(renderError(e));
      }
    };

    const grade = async () => {
      save();
      out.replaceChildren(loadingLine('채점 중…'));
      try {
        let verdict;
        let mine = null;
        let expected;
        if (p.lang === 'sql') {
          let userRes;
          try {
            userRes = await runSQL(editor.getValue());
          } catch (e) {
            out.replaceChildren(h('div', { class: 'callout bad' }, '쿼리 실행 중 오류가 발생했습니다.'), renderError(e));
            return;
          }
          expected = await runSQL(p.solution);
          verdict = compareResults(userRes, expected, p.orderMatters);
          mine = resultTable(userRes);
        } else {
          await getPyodide();
          verdict = await gradePython(editor.getValue(), p.solution, p.orderMatters);
          expected = verdict.expected;
          mine = verdict.run ? renderPyOutput(verdict.run) : null;
        }
        if (verdict.ok) {
          store.add('prob:solved', p.id);
          this.renderList();
          out.replaceChildren(h('div', { class: 'callout good' }, h('b', null, '정답입니다! '), '해설과 다른 언어 풀이도 확인해 보세요.'), mine);
          showSolution();
        } else {
          out.replaceChildren(
            h('div', { class: 'callout bad' }, h('b', null, '아직 정답과 다릅니다. '), verdict.reason,
              verdict.detail ? h('div', { class: 'small', style: { marginTop: '6px', fontFamily: 'var(--mono)' } }, `내 결과: ${verdict.detail.mine}`, h('br'), `정답: ${verdict.detail.answer}`) : null),
            h('div', { class: 'small muted' }, '내 결과'), mine,
            expected ? h('details', null, h('summary', { style: { cursor: 'pointer' } }, '정답 결과 미리보기 (쿼리는 숨김)'), h('div', { style: { marginTop: '8px' } }, resultTable(expected, { limit: 50 }))) : null);
        }
      } catch (e) {
        out.replaceChildren(renderError(e));
      }
    };

    const showSolution = () => {
      const altLang = p.lang === 'sql' ? 'pandas' : 'SQL';
      const alt = p.lang === 'sql' ? p.pandasSolution : p.sqlSolution;
      extra.replaceChildren(h('div', { class: 'card' },
        h('h3', null, '모범 풀이'),
        h('pre', null, h('code', null, p.solution)),
        alt ? h('div', null, h('h4', null, `${altLang} 풀이`), h('pre', null, h('code', null, alt))) : null,
        h('h4', null, '해설'),
        h('div', { class: 'md', html: md(p.explanation) }),
        h('div', { class: 'row', style: { marginTop: '10px' } },
          h('button', { class: 'btn sm', type: 'button', onclick: () => { editor.setValue(p.solution); save(); } }, '모범 풀이를 에디터에 넣기'))));
    };

    const idx = PROBLEMS.indexOf(p);
    const next = PROBLEMS[idx + 1];
    const hintEl = h('div');

    this.detailEl.replaceChildren(
      h('div', { class: 'card' },
        h('div', { class: 'row between' },
          h('div', { class: 'row' },
            h('span', { class: 'badge accent' }, p.lang === 'sql' ? 'SQL' : 'pandas'),
            h('span', { class: `badge lv-${p.level}` }, LEVEL_NAME[p.level]),
            p.topics.map((t) => h('span', { class: 'badge' }, t))),
          store.has('prob:solved', p.id) ? h('span', { class: 'badge ok' }, '✓ 맞힘') : null),
        h('h2', { style: { marginTop: '10px' } }, `${p.id}. ${p.title}`),
        h('div', { class: 'md', html: md(p.prompt) }),
        this.tablesBox(p, () => editor),
        h('details', { class: 'grading-rules small muted' },
          h('summary', null, '채점 기준'),
          h('ul', null,
            h('li', null, '컬럼 이름은 채점하지 않고, 컬럼 순서와 값만 비교합니다.'),
            h('li', null, '숫자는 소수 4자리까지 비교합니다. 비율은 지문에 따로 없으면 0~1 소수로 내고, ×100이나 반올림은 하지 않습니다.'),
            h('li', null, p.orderMatters ? '이 문제는 행 순서도 채점합니다. 지문의 정렬 조건을 지켜주세요.' : '이 문제는 행 순서를 채점하지 않습니다.'),
            h('li', null, "날짜는 '2025-01-01'과 '2025-01-01 00:00:00'을 같은 값으로 봅니다."))),
        related.length ? h('p', { class: 'small muted', style: { marginTop: '8px', marginBottom: 0 } },
          '관련 면접 질문: ', related.map((q, i) => [i ? ', ' : '', h('a', { href: `#/interview?q=${q.id}` }, q.q.length > 40 ? q.q.slice(0, 40) + '…' : q.q)])) : null,
        hintEl),
      h('div', { style: { marginTop: '12px' } }, holder),
      out,
      extra);

    editor.el.append(h('div', { class: 'editor-bar' },
      h('button', { class: 'btn', type: 'button', onclick: run, title: 'Ctrl+Enter (선택 영역만 실행 가능)' }, '▶ 실행'),
      h('button', { class: 'btn primary', type: 'button', onclick: grade, title: 'Ctrl+Shift+Enter' }, '채점'),
      h('button', { class: 'btn ghost sm', type: 'button', onclick: () => hintEl.replaceChildren(h('div', { class: 'callout info md', style: { marginTop: '10px' }, html: md('**힌트**: ' + p.hint) })) }, '힌트'),
      h('button', {
        class: 'btn ghost sm', type: 'button',
        onclick: () => { if (store.has('prob:solved', p.id) || confirm('정답을 보면 학습 효과가 줄어듭니다. 그래도 볼까요?')) showSolution(); },
      }, '정답 보기'),
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn ghost sm', type: 'button', title: '초기 코드로 되돌리기', onclick: () => { editor.setValue(starter(p)); save(); } }, '초기화'),
      next ? h('button', { class: 'btn sm', type: 'button', onclick: () => { this.select(next.id); window.scrollTo(0, 0); } }, '다음 문제 →') : null));
  },
};
