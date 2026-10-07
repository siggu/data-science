import { h, md, store, debounce } from '../util.js';
import { CONCEPTS, SYNTAX, DBSQL_FEATURES, EXAM, QUIZ } from '../data/databricks.js';

// 코드 조각: 여는 괄호·쉼표 뒤, 메서드 체인(.groupBy( 등) 앞에서 줄바꿈되도록 <wbr> 삽입
// (a.k 같은 짧은 참조는 끊지 않음)
function snippet(text) {
  const code = h('code', { class: 'snippet' });
  text.split(/(?<=[(,])(?!\))|(?<=[\w)\]'"]{2})(?=\.\w+\()/).forEach((part, i) => { if (i) code.append(h('wbr')); code.append(part); });
  return code;
}

const TABS = [['concepts', '핵심 개념'], ['syntax', '문법 대응표'], ['dbsql', 'Databricks SQL 문법'], ['exam', '자격증 대비 퀴즈'], ['local', '로컬 Spark 환경']];

export default {
  id: 'databricks',
  title: 'Databricks',
  mount(el) {
    this.tabBar = h('div', { class: 'tabs', role: 'tablist' });
    this.body = h('div');
    el.append(
      h('div', { class: 'page-head' },
        h('h1', null, 'Databricks 대비 팩'),
        h('p', null, 'Databricks를 쓰는 회사의 DA 면접과 실무를 위한 자료입니다. 레이크하우스와 Delta Lake 개념, Databricks SQL과 pandas·PySpark 문법 대응표, Data Analyst Associate 자격증 연습 문항을 담았습니다. Delta Lake 기능은 저장소의 local-spark 환경에서 직접 실행해 볼 수 있습니다.')),
      this.tabBar, this.body);
    this.show(store.get('dbx:tab', 'concepts'));
  },

  onShow(params) { if (params.tab && TABS.some(([k]) => k === params.tab)) this.show(params.tab); },

  show(tab) {
    store.set('dbx:tab', tab);
    this.tabBar.replaceChildren(...TABS.map(([k, l]) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(k === tab), class: k === tab ? 'on' : '', onclick: () => this.show(k) }, l)));
    const v = { concepts: () => this.concepts(), syntax: () => this.syntax(), dbsql: () => this.dbsql(), exam: () => this.exam(), local: () => this.local() }[tab] || (() => this.concepts());
    this.body.replaceChildren(v());
  },

  concepts() {
    return h('div', { class: 'grid grid-2' }, CONCEPTS.map((c) => h('div', { class: 'card' }, h('h3', null, c.title), h('div', { class: 'md small', html: md(c.body) }))));
  },

  syntax() {
    const search = h('input', { type: 'search', placeholder: '검색 (예: 날짜, 피벗, 순위)', 'aria-label': '문법 검색', style: { maxWidth: '360px' } });
    const tbody = h('tbody');
    const render = () => {
      const kw = search.value.trim().toLowerCase();
      const rows = SYNTAX.filter((r) => !kw || Object.values(r).join(' ').toLowerCase().includes(kw));
      tbody.replaceChildren(...(rows.length ? rows.map((r) => h('tr', null,
        h('th', { scope: 'row' }, r.task),
        h('td', { 'data-label': 'Databricks SQL' }, snippet(r.dbsql)),
        h('td', { 'data-label': 'DuckDB' }, r.duck === '동일' ? h('span', { class: 'muted' }, '동일') : snippet(r.duck)),
        h('td', { 'data-label': 'pandas' }, snippet(r.pandas)),
        h('td', { 'data-label': 'PySpark' }, snippet(r.pyspark)))) : [h('tr', null, h('td', { colspan: 5, class: 'muted' }, '검색 결과가 없습니다.'))]));
    };
    search.addEventListener('input', debounce(render, 120));
    render();
    return h('div', { class: 'card stack' },
      h('div', { class: 'row between' }, h('h3', { style: { margin: 0 } }, 'Databricks SQL ↔ DuckDB(이 사이트) ↔ pandas ↔ PySpark'), search),
      h('p', { class: 'small muted', style: { margin: 0 } }, 'PySpark 예시는 from pyspark.sql import functions as F, from pyspark.sql.window import Window 를 가정합니다.'),
      h('div', { class: 'table-wrap syntax-wrap' }, h('table', { class: 'data syntax-table' },
        h('colgroup', null, h('col', { class: 'c-task' }), h('col'), h('col', { class: 'c-duck' }), h('col'), h('col', { class: 'c-spark' })),
        h('thead', null, h('tr', null, h('th', null, '작업'), h('th', null, 'Databricks SQL'), h('th', null, 'DuckDB'), h('th', null, 'pandas'), h('th', null, 'PySpark'))),
        tbody)));
  },

  dbsql() {
    return h('div', { class: 'card md', html: md(DBSQL_FEATURES) });
  },

  exam() {
    const answers = store.get('dbx:quiz', {});
    const scoreEl = h('div', { class: 'kpi' });
    const updateScore = () => {
      const done = Object.keys(answers).length;
      const correct = Object.entries(answers).filter(([i, a]) => QUIZ[+i].answer === a).length;
      scoreEl.replaceChildren(h('span', { class: 'v' }, `${correct} / ${QUIZ.length}`), h('span', { class: 'l' }, `정답 (푼 문항 ${done}개)`));
    };
    updateScore();
    const items = QUIZ.map((q, i) => {
      const exp = h('div', { class: 'callout info small', hidden: answers[i] == null }, q.explain);
      const opts = q.options.map((o, oi) => {
        const b = h('button', { class: 'quiz-opt', type: 'button', onclick: () => {
          answers[i] = oi;
          store.set('dbx:quiz', answers);
          paint();
          opts.forEach((x) => { x.disabled = true; });
          exp.hidden = false;
          updateScore();
        } }, `${String.fromCharCode(65 + oi)}. ${o}`);
        return b;
      });
      const paint = () => opts.forEach((b, oi) => {
        b.classList.toggle('correct', answers[i] != null && oi === q.answer);
        b.classList.toggle('wrong', answers[i] === oi && oi !== q.answer);
      });
      paint();
      if (answers[i] != null) opts.forEach((b) => { b.disabled = true; });
      return h('div', { class: 'card quiz-card' }, h('div', { class: 'small muted' }, `문항 ${i + 1}`), h('h4', { style: { margin: '4px 0 6px' } }, q.q), opts, exp);
    });
    return h('div', { class: 'stack' },
      h('div', { class: 'grid grid-2' },
        h('div', { class: 'card' },
          h('h3', null, EXAM.name),
          h('p', { class: 'small muted' }, EXAM.meta),
          EXAM.domains.map((d) => h('div', { class: 'bar-row', style: { gridTemplateColumns: 'minmax(0,1fr) 120px 40px' } },
            h('span', { class: 'small' }, d.name),
            h('div', { class: 'bar-track' }, h('div', { class: 'bar-fill', style: { width: `${(d.weight / 20) * 100}%` } })),
            h('span', { class: 'small' }, `${d.weight}%`)))),
        h('div', { class: 'card stack' },
          h('h3', null, '공부 팁'),
          h('ul', { class: 'small' }, EXAM.tips.map((t) => h('li', null, t))),
          scoreEl,
          h('div', null, h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { store.set('dbx:quiz', {}); this.show('exam'); } }, '퀴즈 초기화')))),
      ...items);
  },

  local() {
    return h('div', { class: 'card md', html: md(`
      ### 로컬에서 Databricks와 같은 문법으로 실습하기 (Spark + Delta Lake)

      저장소의 \`local-spark/\` 폴더에 **Docker 기반 Jupyter + PySpark + Delta Lake** 환경이 있습니다. Databricks Runtime과 같은 Spark 3.5 계열이며, 이 사이트와 **같은 샘플 데이터**가 Delta 테이블로 자동 등록됩니다.

      \`\`\`bash
      cd local-spark
      docker compose up --build
      # 브라우저에서 http://localhost:8888 접속 (토큰 없음)
      \`\`\`

      **Databricks 노트북과 비슷하게 동작하도록 준비해 둔 것**
      - \`spark\` 세션이 자동으로 생성됩니다 (Delta Lake 활성화, \`practice\` 스키마)
      - \`display(df)\` — Spark/pandas DataFrame을 표로 출력
      - \`%%sql\` 셀 매직 — Databricks의 \`%sql\` 셀처럼 SQL 실행, 결과는 \`_sqldf\` 변수에 저장
      - \`dbutils.widgets\` (text/dropdown/get), \`dbutils.fs.ls\` 간이 버전
      - 샘플 노트북: Spark SQL 기초, Delta Lake(MERGE·Time Travel·OPTIMIZE), PySpark와 pandas 비교

      **이런 걸 연습하세요**
      1. 플레이그라운드에서 푼 SQL 문제를 \`%%sql\` 셀에서 그대로 실행해 보기 (날짜 함수 차이 체감)
      2. \`MERGE INTO\`로 주문 상태 업데이트하고 \`DESCRIBE HISTORY\` → \`VERSION AS OF\`로 되돌리기
      3. 같은 집계를 SQL, PySpark DataFrame API, pandas API on Spark로 각각 작성해 보기

      > Docker를 쓸 수 없다면 **Databricks Free Edition**(무료) 가입 후 이 저장소의 \`web/data/*.csv\`를 업로드해서 같은 실습을 할 수 있습니다.
    `) });
  },
};
