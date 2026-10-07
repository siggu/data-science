import { h, md, resultTable, toast, toCsv, downloadText, store } from '../util.js';
import { TABLES } from '../config.js';
import { COMPAT_MACROS } from '../compat.js';
import { createEditor, refreshCompletionSchema } from '../editor.js';
import { renderPyOutput, renderError, loadingLine } from '../components.js';
import {
  getDuckDB, runSQL, listSchema, registerCsvInDuckDB, onEngineState, engineState,
  getPyodide, runPython, resetPythonNamespace, registerCsvInPython, sendToPython,
} from '../engines.js';

const SQL_EXAMPLES = [
  { name: '테이블 미리보기', code: 'SELECT *\nFROM orders\nLIMIT 20' },
  { name: '일별 DAU 추이 (10월)', code: `SELECT CAST(event_ts AS DATE) AS dt,\n       COUNT(DISTINCT user_id) AS dau\nFROM events\nWHERE event_ts >= '2025-10-01' AND event_ts < '2025-11-01'\nGROUP BY 1\nORDER BY 1` },
  { name: '채널별 구매율·매출 (CTE + LEFT JOIN)', code: `WITH rev AS (\n  SELECT user_id, SUM(total_amount) AS revenue\n  FROM orders\n  WHERE status = 'completed'\n  GROUP BY user_id\n)\nSELECT u.channel,\n       COUNT(*) AS users,\n       COUNT(r.user_id) * 1.0 / COUNT(*) AS buyer_rate,\n       COALESCE(SUM(r.revenue), 0) / COUNT(*) AS arpu\nFROM users u\nLEFT JOIN rev r USING (user_id)\nGROUP BY u.channel\nORDER BY arpu DESC` },
  { name: '유저별 최신 주문 (QUALIFY)', code: `SELECT user_id, order_id, order_ts, total_amount\nFROM orders\nQUALIFY ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY order_ts DESC) = 1\nORDER BY user_id\nLIMIT 50` },
  { name: '퍼널 (조건부 집계)', code: `SELECT platform,\n       COUNT(DISTINCT CASE WHEN event_type = 'visit' THEN session_id END)       AS visits,\n       COUNT(DISTINCT CASE WHEN event_type = 'view_item' THEN session_id END)   AS views,\n       COUNT(DISTINCT CASE WHEN event_type = 'add_to_cart' THEN session_id END) AS carts,\n       COUNT(DISTINCT CASE WHEN event_type = 'purchase' THEN session_id END)    AS purchases\nFROM events\nGROUP BY platform` },
  { name: 'Databricks 호환 함수 데모', code: `-- Databricks(Spark SQL) 함수명을 그대로 사용할 수 있습니다\nSELECT order_id,\n       date_format(order_ts, 'yyyy-MM') AS ym,\n       datediff(DATE '2025-12-31', order_ts) AS days_ago,\n       nvl(coupon_code, 'NONE') AS coupon,\n       to_date(order_ts) AS order_date,\n       date_add(to_date(order_ts), 7) AS plus7\nFROM orders\nLIMIT 10` },
  { name: '월 × 카테고리 PIVOT', code: `WITH t AS (\n  SELECT date_trunc('month', o.order_ts) AS month, p.category,\n         oi.quantity * oi.unit_price AS amount\n  FROM order_items oi\n  JOIN orders o ON oi.order_id = o.order_id AND o.status = 'completed'\n  JOIN products p ON oi.product_id = p.product_id\n)\nPIVOT t ON category USING SUM(amount)\nORDER BY month` },
  { name: '코호트 리텐션 (월)', code: `WITH cohort AS (\n  SELECT user_id, date_trunc('month', signup_date) AS cohort_month FROM users\n),\nact AS (\n  SELECT DISTINCT user_id, date_trunc('month', event_ts) AS m FROM events\n)\nSELECT c.cohort_month,\n       datediff('month', c.cohort_month, a.m) AS month_n,\n       COUNT(DISTINCT c.user_id) AS active_users\nFROM cohort c JOIN act a USING (user_id)\nGROUP BY ALL\nORDER BY 1, 2` },
];

const PY_EXAMPLES = [
  { name: '데이터 훑어보기', code: `# 샘플 테이블은 이미 DataFrame으로 로드되어 있습니다:\n# users, events, orders, order_items, products, ab_test, employees, departments\nprint(orders.shape)\nprint(orders.dtypes)\norders.head()` },
  { name: 'groupby + named aggregation', code: `done = orders[orders['status'] == 'completed']\nsummary = (done.groupby('payment_method')\n           .agg(orders=('order_id', 'count'),\n                revenue=('total_amount', 'sum'),\n                aov=('total_amount', 'mean'))\n           .sort_values('revenue', ascending=False))\nsummary` },
  { name: 'merge + pivot_table', code: `df = orders.merge(users[['user_id', 'channel']], on='user_id', how='left', validate='many_to_one')\ndf['month'] = df['order_ts'].dt.to_period('M').astype(str)\ndf.pivot_table(index='month', columns='channel', values='total_amount', aggfunc='sum', fill_value=0)` },
  { name: '윈도우 함수처럼: transform / rank / shift', code: `o = orders[orders['status'] == 'completed'].sort_values(['user_id', 'order_ts']).copy()\no['order_seq'] = o.groupby('user_id').cumcount() + 1               # ROW_NUMBER\no['user_total'] = o.groupby('user_id')['total_amount'].transform('sum')  # SUM() OVER\no['prev_ts'] = o.groupby('user_id')['order_ts'].shift(1)            # LAG\no['gap_days'] = (o['order_ts'] - o['prev_ts']).dt.days\no.head(15)` },
  { name: 'SQL 결과를 pandas로 (await sql)', code: `# DuckDB(SQL 엔진)에 쿼리를 보내 DataFrame으로 받기\ndaily = await sql("""\n    SELECT CAST(event_ts AS DATE) AS dt, platform, COUNT(DISTINCT user_id) AS dau\n    FROM events GROUP BY 1, 2\n""")\nwide = daily.pivot(index='dt', columns='platform', values='dau').sort_index()\nwide.loc['2025-10-07':'2025-10-28']` },
  { name: 'pandas 결과를 SQL 테이블로 (await to_sql)', code: `rfm = (orders[orders['status'] == 'completed']\n       .groupby('user_id')\n       .agg(last_order=('order_ts', 'max'), frequency=('order_id', 'count'), monetary=('total_amount', 'sum'))\n       .reset_index())\nrfm['recency_days'] = (pd.Timestamp('2025-12-31') - rfm['last_order']).dt.days\nprint(await to_sql(rfm, 'rfm'))   # 이제 SQL 탭에서 SELECT * FROM rfm 가능\nrfm.describe()` },
  { name: 'A/B 테스트 z-검정', code: `import math\nt = ab_test[ab_test['experiment'] == 'checkout_button_v2']\ng = t.groupby('variant')['converted'].agg(n='size', x='sum')\ng['cvr'] = g['x'] / g['n']\np = g['x'].sum() / g['n'].sum()\nse = math.sqrt(p * (1 - p) * (1 / g.loc['control', 'n'] + 1 / g.loc['treatment', 'n']))\nz = (g.loc['treatment', 'cvr'] - g.loc['control', 'cvr']) / se\npval = 2 * (1 - 0.5 * (1 + math.erf(abs(z) / math.sqrt(2))))\nprint(f"z = {z:.3f}, p-value = {pval:.4f}")\ng` },
];

export default {
  id: 'playground',
  title: '플레이그라운드',
  mount(el) {
    this.pendingUploads = [];
    this.lastSql = null;
    this.mode = store.get('pg:mode', 'sql');

    this.schemaEl = h('div', null, h('div', { class: 'small muted' }, 'SQL 엔진을 불러오는 중…'));
    this.sqlOut = h('div', { class: 'stack' });
    this.pyOut = h('div', { class: 'stack' });
    this.sqlPane = h('div');
    this.pyPane = h('div');
    this.tabBtns = {};

    const tabs = h('div', { class: 'tabs', role: 'tablist' },
      ['sql', 'pandas'].map((m) => (this.tabBtns[m] = h('button', { type: 'button', role: 'tab', onclick: () => this.setMode(m) }, m === 'sql' ? 'SQL (DuckDB)' : 'Python · pandas (Pyodide)'))));

    el.append(
      h('div', { class: 'page-head' },
        h('h1', null, 'SQL · pandas 플레이그라운드'),
        h('p', null, '브라우저에서 실행되는 연습 환경입니다. 서버나 설치가 필요 없고, 데이터는 내 컴퓨터 밖으로 나가지 않습니다. SQL은 Databricks SQL과 문법이 가장 비슷한 DuckDB로 실행되며, 자주 쓰는 Spark SQL 함수(datediff, date_format, nvl, collect_list 등)는 호환 매크로로 그대로 쓸 수 있습니다. ', h('kbd', null, 'Ctrl'), ' + ', h('kbd', null, 'Enter'), '로 실행합니다 (선택한 부분만 실행 가능). 입력하면 테이블·컬럼·함수 자동 완성 목록이 뜨고 ', h('kbd', null, 'Tab'), '으로 완성합니다.')),
      h('div', { class: 'split' },
        h('aside', { class: 'sticky-side stack' },
          h('div', { class: 'card flat' }, h('h3', null, '샘플 데이터베이스'), h('p', { class: 'small muted' }, '이커머스 서비스의 2025년 1년치 가상 데이터입니다. 컬럼을 클릭하면 에디터에 삽입됩니다.'), this.schemaEl),
          this.uploadCard(),
          this.dialectCard()),
        h('div', { style: { minWidth: 0 } }, tabs, this.sqlPane, this.pyPane)));

    this.buildSqlPane();
    this.buildPyPane();
    this.setMode(this.mode);

    getDuckDB().then(() => this.refreshSchema()).catch((e) => {
      this.schemaEl.replaceChildren(renderError(e), h('p', { class: 'small muted' }, '인터넷 연결(CDN 접근)이 필요합니다. 사내망이라면 README의 오프라인 모드를 참고하세요.'));
    });
  },

  onShow() {
    const inject = store.get('pg:inject', null);
    if (inject) {
      store.set('pg:inject', null);
      this.setMode('sql');
      this.sqlEditor.setValue(inject);
      this.runSql();
    }
    const injectPy = store.get('pg:injectPy', null);
    if (injectPy) {
      store.set('pg:injectPy', null);
      this.setMode('pandas');
      this.pyEditor.setValue(injectPy);
      this.runPy();
    }
  },

  setMode(m) {
    this.mode = m;
    store.set('pg:mode', m);
    for (const [k, b] of Object.entries(this.tabBtns)) { b.classList.toggle('on', k === m); b.setAttribute('aria-selected', String(k === m)); }
    this.sqlPane.style.display = m === 'sql' ? '' : 'none';
    this.pyPane.style.display = m === 'pandas' ? '' : 'none';
    (m === 'sql' ? this.sqlEditor : this.pyEditor).refresh();
    if (m === 'pandas') this.ensurePython();
  },

  buildSqlPane() {
    const holder = h('div');
    this.sqlEditor = createEditor(holder, { lang: 'sql', value: store.get('pg:sql', SQL_EXAMPLES[0].code), onRun: () => this.runSql() });
    const examples = h('select', { 'aria-label': 'SQL 예제', style: { width: 'auto' } },
      h('option', { value: '' }, '예제 불러오기…'), SQL_EXAMPLES.map((e, i) => h('option', { value: i }, e.name)));
    examples.addEventListener('change', () => { if (examples.value !== '') { this.sqlEditor.setValue(SQL_EXAMPLES[+examples.value].code); examples.value = ''; } });
    this.sqlEditor.el.append(h('div', { class: 'editor-bar' },
      h('button', { class: 'btn primary', type: 'button', onclick: () => this.runSql() }, '▶ 실행'),
      examples,
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn sm', type: 'button', title: '마지막 결과를 pandas 변수 df_sql 로 전달', onclick: () => this.sendSqlToPandas() }, '결과 → pandas'),
      h('button', { class: 'btn sm', type: 'button', onclick: () => this.downloadSql() }, 'CSV 저장')));
    this.sqlPane.append(holder, h('div', { style: { marginTop: '12px' } }, this.sqlOut));
  },

  buildPyPane() {
    const holder = h('div');
    this.pyEditor = createEditor(holder, { lang: 'python', value: store.get('pg:py', PY_EXAMPLES[0].code), onRun: () => this.runPy() });
    const examples = h('select', { 'aria-label': 'pandas 예제', style: { width: 'auto' } },
      h('option', { value: '' }, '예제 불러오기…'), PY_EXAMPLES.map((e, i) => h('option', { value: i }, e.name)));
    examples.addEventListener('change', () => { if (examples.value !== '') { this.pyEditor.setValue(PY_EXAMPLES[+examples.value].code); examples.value = ''; } });
    this.pyStatus = h('span', { class: 'small muted' });
    this.pyEditor.el.append(h('div', { class: 'editor-bar' },
      h('button', { class: 'btn primary', type: 'button', onclick: () => this.runPy() }, '▶ 실행'),
      examples,
      h('span', { class: 'spacer' }),
      this.pyStatus,
      h('button', {
        class: 'btn sm', type: 'button', title: '내가 만든 변수를 지우고 샘플 테이블을 다시 로드',
        onclick: async () => { await resetPythonNamespace(); toast('Python 변수를 초기화했습니다.'); },
      }, '변수 초기화')));
    this.pyPane.append(
      h('div', {
        class: 'callout info small md', style: { marginBottom: '10px' },
        html: md('Jupyter처럼 **마지막 줄의 값**이 출력되고, 변수는 실행 간에 유지됩니다. `display(df)`로 여러 표를 출력할 수 있습니다. `df = await sql("SELECT ...")`로 SQL 결과를 받고, `await to_sql(df, "name")`으로 DataFrame을 SQL 테이블로 보낼 수 있습니다.'),
      }),
      holder, h('div', { style: { marginTop: '12px' } }, this.pyOut));
    onEngineState((s) => { if (this.pyStatus) this.pyStatus.textContent = s.pyodide === 'idle' ? '' : s.pyodideMsg; });
  },

  async ensurePython() {
    if (engineState.pyodide === 'ready') return;
    if (engineState.pyodide !== 'loading') this.pyOut.replaceChildren(loadingLine('Python(Pyodide)과 pandas를 불러오는 중입니다… 처음 한 번은 10~20초 정도 걸립니다.'));
    try {
      await getPyodide();
      for (const u of this.pendingUploads.splice(0)) await registerCsvInPython(u.name, u.text);
      if (this.pyOut.textContent.includes('불러오는 중')) this.pyOut.replaceChildren(h('div', { class: 'small muted' }, 'pandas 준비 완료. 코드를 실행해 보세요.'));
    } catch (e) {
      this.pyOut.replaceChildren(renderError(e));
    }
  },

  async runSql() {
    store.set('pg:sql', this.sqlEditor.getValue());
    const code = this.sqlEditor.getRunText();
    if (!code.trim()) return;
    this.sqlOut.replaceChildren(loadingLine('실행 중…'));
    try {
      const res = await runSQL(code);
      this.lastSql = res;
      this.sqlOut.replaceChildren(resultTable(res));
      if (/\b(CREATE|DROP|ALTER|INSERT)\b/i.test(code)) this.refreshSchema();
    } catch (e) {
      this.sqlOut.replaceChildren(renderError(e));
    }
  },

  async runPy() {
    store.set('pg:py', this.pyEditor.getValue());
    const code = this.pyEditor.getRunText();
    if (!code.trim()) return;
    await this.ensurePython();
    if (engineState.pyodide !== 'ready') return;
    this.pyOut.replaceChildren(loadingLine('실행 중…'));
    const t0 = performance.now();
    try {
      const res = await runPython(code);
      this.pyOut.replaceChildren(renderPyOutput(res), h('div', { class: 'result-meta' }, `${(performance.now() - t0).toFixed(0)} ms`));
      if (/to_sql\(/.test(code)) this.refreshSchema();
    } catch (e) {
      this.pyOut.replaceChildren(renderError(e));
    }
  },

  async sendSqlToPandas() {
    if (!this.lastSql) return toast('먼저 SQL을 실행하세요.');
    this.setMode('pandas');
    await this.ensurePython();
    await sendToPython('df_sql', this.lastSql);
    this.pyEditor.setValue('# SQL 결과가 df_sql 변수로 전달되었습니다\ndf_sql.head()');
    toast('SQL 결과를 df_sql 변수로 전달했습니다.');
  },

  downloadSql() {
    if (!this.lastSql) return toast('먼저 SQL을 실행하세요.');
    downloadText('query_result.csv', toCsv(this.lastSql.columns, this.lastSql.rows));
  },

  async refreshSchema() {
    try {
      const tables = await listSchema();
      refreshCompletionSchema();
      const desc = Object.fromEntries(TABLES.map((t) => [t.name, t.desc]));
      this.schemaEl.replaceChildren(...tables.map((t) => {
        const d = h('details', { class: 'schema-table' },
          h('summary', null, t.name, h('span', { class: 'muted' }, t.rows != null ? `${t.rows.toLocaleString()}행` : '')),
          h('div', { class: 'schema-cols' },
            desc[t.name] ? h('div', { style: { cursor: 'default', color: 'var(--text-3)', fontFamily: 'var(--font)', marginBottom: '4px' } }, desc[t.name]) : null,
            t.columns.map((c) => h('div', { onclick: () => this.insert(c.name) }, h('span', null, c.name), h('span', null, c.type.toLowerCase()))),
            h('button', { class: 'btn sm', type: 'button', style: { marginTop: '6px' }, onclick: () => this.preview(t.name) }, '미리보기')));
        return d;
      }));
    } catch (e) {
      this.schemaEl.replaceChildren(renderError(e));
    }
  },

  insert(text) {
    (this.mode === 'sql' ? this.sqlEditor : this.pyEditor).insert(text);
  },

  preview(name) {
    if (this.mode === 'sql') {
      this.sqlEditor.setValue(`SELECT *\nFROM ${name}\nLIMIT 20`);
      this.runSql();
    } else {
      this.pyEditor.setValue(`print(${name}.shape)\n${name}.head(20)`);
      this.runPy();
    }
  },

  uploadCard() {
    const nameIn = h('input', { type: 'text', placeholder: '테이블 이름 (예: my_data)', 'aria-label': '업로드 테이블 이름' });
    const fileIn = h('input', { type: 'file', accept: '.csv,text/csv', 'aria-label': 'CSV 파일 선택', style: { fontSize: '.82rem', maxWidth: '100%' } });
    const msg = h('div', { class: 'small muted' });
    fileIn.addEventListener('change', () => {
      const f = fileIn.files[0];
      if (f && !nameIn.value) nameIn.value = f.name.replace(/\.csv$/i, '').replace(/[^A-Za-z0-9_]/g, '_').replace(/^(\d)/, 't_$1').toLowerCase();
    });
    const go = async () => {
      const f = fileIn.files[0];
      const name = nameIn.value.trim();
      if (!f || !name) return toast('CSV 파일과 테이블 이름을 입력하세요.');
      try {
        const text = await f.text();
        msg.textContent = '등록 중…';
        const r = await registerCsvInDuckDB(name, text);
        if (engineState.pyodide === 'ready') await registerCsvInPython(name, text);
        else this.pendingUploads.push({ name, text });
        msg.textContent = `등록 완료: ${r} (SQL 테이블 · pandas DataFrame)`;
        this.refreshSchema();
      } catch (e) {
        msg.textContent = `실패: ${e.message}`;
      }
    };
    return h('div', { class: 'card flat stack' },
      h('h3', null, '내 CSV 올리기'),
      h('p', { class: 'small muted', style: { margin: 0 } }, '회사 데이터 샘플이나 Kaggle 데이터를 올려 SQL과 pandas로 바로 분석할 수 있습니다. 파일은 브라우저 메모리에만 있습니다.'),
      fileIn, nameIn, h('button', { class: 'btn', type: 'button', onclick: go }, '테이블로 등록'), msg);
  },

  dialectCard() {
    const fns = COMPAT_MACROS.map((m) => m.match(/MACRO (\w+)/)[1]);
    return h('details', { class: 'card flat' },
      h('summary', { style: { cursor: 'pointer', fontWeight: 600 } }, 'Databricks SQL과의 차이'),
      h('div', { class: 'md small', style: { marginTop: '10px' }, html: md(`
        **그대로 쓸 수 있는 것**: \`QUALIFY\`, \`GROUP BY ALL\`, \`PIVOT\`, 윈도우 함수, \`date_trunc\`, \`date_add\`, \`COUNT_IF\`, \`FILTER (WHERE ...)\`, \`median\`, \`concat_ws\`, \`split\`, \`regexp_extract\`, \`array_contains\`

        **호환 매크로로 지원**: ${fns.map((f) => '`' + f + '`').join(', ')}

        **다른 점**
        - 테이블 이름은 3단계(\`catalog.schema.table\`)가 아니라 \`orders\`처럼 씁니다.
        - \`date_format\`은 자주 쓰는 패턴(yyyy-MM-dd, yyyy-MM, HH 등)만 지원 → 그 외는 \`strftime(ts, '%Y-%m')\`
        - \`LATERAL VIEW explode\` 대신 \`unnest\`, \`MERGE INTO\`·Time Travel·\`OPTIMIZE\` 같은 Delta 기능은 **local-spark 환경**에서 실습하세요.
        - 정수 나눗셈: DuckDB와 Databricks 모두 \`/\`는 실수 나눗셈입니다.
      `) }));
  },
};
