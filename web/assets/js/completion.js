// 코드 자동 완성: 문맥(테이블/별칭/DataFrame/.str/.dt 등)에 맞는 후보를 모아 점수 순으로 정렬합니다.
// CodeMirror show-hint 애드온에서 사용하며, 순수 함수(rank, sqlCandidates, pyCandidates)는 테스트 가능하게 분리했습니다.

import { COMPAT_MACROS } from './compat.js';
import { store } from './util.js';

// ───────── 후보 사전 ─────────
const SQL_KEYWORDS = ('SELECT FROM WHERE GROUP BY ORDER HAVING LIMIT OFFSET JOIN LEFT RIGHT FULL INNER OUTER CROSS ON USING AS ' +
  'DISTINCT AND OR NOT IN IS NULL LIKE ILIKE BETWEEN EXISTS CASE WHEN THEN ELSE END WITH UNION ALL INTERSECT EXCEPT ' +
  'ASC DESC NULLS FIRST LAST OVER PARTITION ROWS RANGE UNBOUNDED PRECEDING FOLLOWING CURRENT ROW QUALIFY WINDOW ' +
  'FILTER PIVOT UNPIVOT INTERVAL DAY MONTH YEAR WEEK HOUR CREATE OR REPLACE TABLE VIEW INSERT INTO VALUES UPDATE SET DELETE ' +
  'DROP IF TRUE FALSE CAST TRY_CAST DATE TIMESTAMP VARCHAR INTEGER BIGINT DOUBLE DECIMAL BOOLEAN RECURSIVE ANTI SEMI').split(' ');

const SQL_FUNCS = {
  COUNT: 'COUNT(*) · 행 수', SUM: 'SUM(x)', AVG: 'AVG(x)', MIN: 'MIN(x)', MAX: 'MAX(x)', MEDIAN: 'MEDIAN(x)',
  STDDEV: 'STDDEV(x)', VARIANCE: 'VARIANCE(x)', COUNT_IF: 'COUNT_IF(cond)', ANY_VALUE: 'ANY_VALUE(x)',
  APPROX_COUNT_DISTINCT: 'APPROX_COUNT_DISTINCT(x)', QUANTILE_CONT: 'QUANTILE_CONT(x, p)', STRING_AGG: 'STRING_AGG(x, sep)',
  LIST: 'LIST(x) · 배열로 모으기', ROW_NUMBER: 'ROW_NUMBER() OVER (...)', RANK: 'RANK() OVER (...)', DENSE_RANK: 'DENSE_RANK() OVER (...)',
  NTILE: 'NTILE(n) OVER (...)', LAG: 'LAG(x, n, default)', LEAD: 'LEAD(x, n, default)', FIRST_VALUE: 'FIRST_VALUE(x)',
  LAST_VALUE: 'LAST_VALUE(x)', PERCENT_RANK: 'PERCENT_RANK()', CUME_DIST: 'CUME_DIST()',
  COALESCE: 'COALESCE(a, b, ...)', NULLIF: 'NULLIF(a, b)', IFNULL: 'IFNULL(a, b)', GREATEST: 'GREATEST(a, b)', LEAST: 'LEAST(a, b)',
  ROUND: 'ROUND(x, n)', FLOOR: 'FLOOR(x)', CEIL: 'CEIL(x)', ABS: 'ABS(x)', LN: 'LN(x)', LOG10: 'LOG10(x)', POWER: 'POWER(x, y)', SQRT: 'SQRT(x)',
  DATE_TRUNC: "DATE_TRUNC('month', ts)", DATE_DIFF: "DATE_DIFF('day', a, b)", DATE_ADD: 'DATE_ADD(d, n)', DATE_PART: "DATE_PART('dow', d)",
  EXTRACT: 'EXTRACT(YEAR FROM d)', STRFTIME: "STRFTIME(ts, '%Y-%m')", STRPTIME: "STRPTIME(s, fmt)", CURRENT_DATE: 'CURRENT_DATE',
  YEAR: 'YEAR(d)', MONTH: 'MONTH(d)', DAYOFWEEK: 'DAYOFWEEK(d) · 1=일요일(Spark 호환)', ISODOW: 'ISODOW(d) · 1=월요일', LAST_DAY: 'LAST_DAY(d)',
  LOWER: 'LOWER(s)', UPPER: 'UPPER(s)', LENGTH: 'LENGTH(s)', SUBSTRING: 'SUBSTRING(s, start, len)', TRIM: 'TRIM(s)', REPLACE: 'REPLACE(s, a, b)',
  CONCAT: 'CONCAT(a, b, ...)', CONCAT_WS: 'CONCAT_WS(sep, a, b)', SPLIT: 'SPLIT(s, sep)', REGEXP_EXTRACT: 'REGEXP_EXTRACT(s, re)',
  REGEXP_MATCHES: 'REGEXP_MATCHES(s, re)', LPAD: 'LPAD(s, n, c)', UNNEST: 'UNNEST(list)', ARRAY_CONTAINS: 'ARRAY_CONTAINS(list, x)',
};
for (const m of COMPAT_MACROS) {
  const name = m.match(/MACRO (\w+)/)[1].toUpperCase();
  if (!SQL_FUNCS[name]) SQL_FUNCS[name] = `${name}(…) · Databricks 호환`;
}

const PY_KEYWORDS = 'import from as def return if elif else for while in not and or is None True False with lambda try except finally class pass break continue await async yield print len range sorted list dict set tuple sum min max abs round enumerate zip isinstance'.split(' ');
const PY_GLOBALS = { pd: 'pandas', np: 'numpy', display: 'display(df) · 표 출력', sql: 'await sql("SELECT …") → DataFrame', to_sql: 'await to_sql(df, "name")', result: '문제 정답 변수', math: 'math 모듈' };

const DF_METHODS = {
  head: 'head(n=5)', tail: 'tail(n=5)', info: 'info()', describe: 'describe()', shape: '(행, 열)', columns: '컬럼 목록', dtypes: '컬럼 타입',
  groupby: "groupby('col')", agg: "agg(name=('col', 'sum'))", merge: "merge(right, on='key', how='left')", join: 'join(other)',
  pivot_table: "pivot_table(index, columns, values, aggfunc)", pivot: 'pivot(index, columns, values)', melt: 'melt(id_vars)',
  sort_values: "sort_values('col', ascending=False)", sort_index: 'sort_index()', reset_index: 'reset_index()', set_index: "set_index('col')",
  rename: 'rename(columns={})', drop: "drop(columns=['col'])", drop_duplicates: "drop_duplicates(subset=[...], keep='first')",
  duplicated: 'duplicated()', dropna: 'dropna()', fillna: 'fillna(value)', isna: 'isna()', notna: 'notna()', assign: 'assign(new=lambda d: ...)',
  query: "query('col > 0')", loc: 'loc[행, 열]', iloc: 'iloc[i, j]', apply: 'apply(func)', transform: "transform('sum')",
  value_counts: 'value_counts()', nunique: 'nunique()', unique: 'unique()', count: 'count()', size: 'size', sum: 'sum()', mean: 'mean()',
  median: 'median()', min: 'min()', max: 'max()', std: 'std()', cumsum: 'cumsum()', cumcount: 'cumcount()', rank: "rank(method='dense')",
  shift: 'shift(1)', diff: 'diff()', pct_change: 'pct_change()', rolling: 'rolling(7).mean()', resample: "resample('W')", nlargest: "nlargest(n, 'col')",
  nsmallest: "nsmallest(n, 'col')", copy: 'copy()', astype: "astype('int')", isin: 'isin([...])', between: 'between(a, b)', clip: 'clip(lo, hi)',
  explode: "explode('col')", sample: 'sample(n)', corr: 'corr()', to_frame: 'to_frame()', to_csv: 'to_csv()', plot: 'plot()', T: '전치',
  str: '.str 문자열 메서드', dt: '.dt 날짜 메서드', where: 'where(cond)', mask: 'mask(cond)', map: 'map(dict)', filter: 'filter(func)',
};
const POPULAR = new Set(['head', 'groupby', 'merge', 'loc', 'sort_values', 'agg', 'reset_index', 'query', 'assign', 'value_counts', 'pivot_table', 'drop_duplicates', 'fillna', 'isna', 'rename', 'apply', 'transform', 'nunique', 'shape', 'columns', 'info', 'describe', 'iloc', 'copy']);
const STR_METHODS = { contains: "contains('a')", startswith: "startswith('a')", endswith: "endswith('a')", lower: 'lower()', upper: 'upper()',
  strip: 'strip()', replace: "replace('a', 'b')", split: "split(',')", len: 'len()', slice: 'slice(0, 3)', extract: "extract(r'(\\d+)')", zfill: 'zfill(n)', cat: 'cat(sep=)' };
const DT_METHODS = { year: 'year', month: 'month', day: 'day', hour: 'hour', dayofweek: '0=월요일', day_name: 'day_name()', date: 'date',
  normalize: 'normalize() · 자정으로', floor: "floor('D')", to_period: "to_period('M')", strftime: "strftime('%Y-%m')", days: '(timedelta) 일수',
  isocalendar: 'isocalendar()', quarter: 'quarter', weekday: '0=월요일', is_month_end: 'is_month_end' };
const PD_FUNCS = { DataFrame: 'pd.DataFrame(...)', Series: 'pd.Series(...)', read_csv: "pd.read_csv('path')", merge: 'pd.merge(a, b, on=)',
  concat: 'pd.concat([a, b])', to_datetime: 'pd.to_datetime(s)', to_timedelta: "pd.to_timedelta(n, unit='D')", Timestamp: "pd.Timestamp('2025-01-01')",
  cut: 'pd.cut(x, bins)', qcut: 'pd.qcut(x, q)', crosstab: 'pd.crosstab(a, b)', pivot_table: 'pd.pivot_table(df, ...)', isna: 'pd.isna(x)',
  date_range: "pd.date_range('2025-01-01', periods=7)", get_dummies: 'pd.get_dummies(df)', NA: '결측값', set_option: 'pd.set_option(...)' };
const NP_FUNCS = { where: 'np.where(cond, a, b)', select: 'np.select(conds, choices, default)', nan: 'NaN', mean: 'np.mean(x)', log: 'np.log(x)',
  log1p: 'np.log1p(x)', sqrt: 'np.sqrt(x)', arange: 'np.arange(n)', linspace: 'np.linspace(a, b, n)', percentile: 'np.percentile(x, q)',
  random: 'np.random', round: 'np.round(x, n)', clip: 'np.clip(x, lo, hi)', inf: '무한대', array: 'np.array([...])', abs: 'np.abs(x)' };

// ───────── 스키마 (DuckDB에서 조회) ─────────
let schema = []; // [{name, columns:[{name,type}]}]
export function setSchema(tables) { schema = tables || []; }
export function getSchema() { return schema; }

// ───────── 점수 계산 ─────────
const KIND_BOOST = { column: 60, table: 55, alias: 55, var: 50, method: 45, func: 30, keyword: 20, module: 40 };
const usageKey = 'ac:usage';
let usage = null;
function usageCount(text) {
  if (!usage) usage = store.get(usageKey, {});
  return usage[text] || 0;
}
export function recordUsage(text) {
  if (!usage) usage = store.get(usageKey, {});
  usage[text] = (usage[text] || 0) + 1;
  store.set(usageKey, usage);
}

/** prefix와 후보의 일치 점수 (일치하지 않으면 -1) */
export function matchScore(cand, prefix) {
  if (!prefix) return 100;
  const c = cand.toLowerCase();
  const p = prefix.toLowerCase();
  if (c === p) return 1100;
  if (c.startsWith(p)) return 1000 - Math.min(200, (c.length - p.length) * 5);
  // 단어 경계(_ 또는 대문자) 시작 일치: signup_date ← "date", DataFrame ← "frame"
  const parts = cand.split(/_|(?=[A-Z])/).map((x) => x.toLowerCase());
  if (parts.some((x, i) => i > 0 && x.startsWith(p))) return 700;
  // 약어(이니셜) 일치: order_ts ← "ot"
  const initials = parts.map((x) => x[0] || '').join('');
  if (p.length >= 2 && initials.startsWith(p)) return 650;
  if (c.includes(p)) return 400;
  // 순서대로 포함 (퍼지): dense_rank ← "drk"
  let i = 0;
  let gaps = 0;
  for (const ch of c) {
    if (ch === p[i]) i++;
    else if (i > 0) gaps++;
    if (i === p.length) break;
  }
  return i === p.length && p.length >= 2 ? Math.max(50, 250 - gaps * 10) : -1;
}

/** 후보 [{text, kind, detail, boost}] → 점수 순 정렬 (같은 이름은 점수가 높은 쪽만 남김) */
export function rank(cands, prefix, limit = 60) {
  const best = new Map();
  cands.forEach((c, order) => {
    const m = matchScore(c.text, prefix);
    if (m < 0) return;
    if (prefix && c.text === prefix) return; // 이미 다 입력한 단어는 제외
    const score = m + (KIND_BOOST[c.kind] || 0) + (c.boost || 0) + Math.min(80, Math.log2(1 + usageCount(c.text)) * 25);
    const prev = best.get(c.text);
    if (!prev || score > prev.score) best.set(c.text, { ...c, score, order: prev ? Math.min(prev.order, order) : order });
  });
  const out = [...best.values()];
  // 입력이 없으면 선언 순서(자주 쓰는 것 먼저), 입력이 있으면 짧은 후보 먼저
  out.sort((a, b) => b.score - a.score || (prefix ? a.text.length - b.text.length : a.order - b.order) || a.text.localeCompare(b.text));
  return out.slice(0, limit);
}

const dict = (obj, kind) => Object.entries(obj).map(([text, detail]) => ({ text, kind, detail, boost: kind === 'method' && POPULAR.has(text) ? 15 : 0 }));
const tableByName = (n) => schema.find((t) => t.name.toLowerCase() === String(n).toLowerCase());
const colsOf = (t, boost = 0) => (t ? t.columns.map((c) => ({ text: c.name, kind: 'column', detail: `${t.name} · ${c.type.toLowerCase()}`, boost })) : []);

// ───────── SQL ─────────
/** 문장 안의 테이블 참조와 별칭 파악 */
export function sqlRefs(stmt) {
  const refs = [];
  const re = /\b(?:FROM|JOIN)\s+([A-Za-z_][\w.]*)(?:\s+(?:AS\s+)?([A-Za-z_]\w*))?/gi;
  const reserved = new Set(['ON', 'USING', 'WHERE', 'GROUP', 'ORDER', 'LEFT', 'RIGHT', 'INNER', 'FULL', 'CROSS', 'JOIN', 'LIMIT', 'QUALIFY', 'HAVING', 'WINDOW', 'UNION', 'AS', 'ANTI', 'SEMI']);
  let m;
  while ((m = re.exec(stmt))) {
    const alias = m[2] && !reserved.has(m[2].toUpperCase()) ? m[2] : null;
    refs.push({ table: m[1], alias });
  }
  const ctes = [...stmt.matchAll(/(?:\bWITH\s+(?:RECURSIVE\s+)?|,\s*)([A-Za-z_]\w*)\s+AS\s*\(/gi)].map((x) => x[1]);
  return { refs, ctes };
}

export function sqlCandidates(before, after = '') {
  const stmtStart = before.lastIndexOf(';') + 1;
  const stmtEnd = after.indexOf(';');
  const stmt = before.slice(stmtStart) + (stmtEnd >= 0 ? after.slice(0, stmtEnd) : after);
  const local = before.slice(stmtStart);
  const prefix = (local.match(/[A-Za-z_]\w*$/) || [''])[0];
  const head = local.slice(0, local.length - prefix.length);
  const { refs, ctes } = sqlRefs(stmt);

  // alias.col / table.col
  const q = head.match(/([A-Za-z_]\w*)\.$/);
  if (q) {
    const name = q[1];
    const ref = refs.find((r) => (r.alias && r.alias.toLowerCase() === name.toLowerCase()) || r.table.toLowerCase() === name.toLowerCase());
    const t = tableByName(ref ? ref.table : name);
    return { prefix, list: rank(colsOf(t, 100), prefix) };
  }

  const cands = [];
  const tableCtx = /\b(FROM|JOIN|INTO|UPDATE|TABLE|EXISTS)\s+$/i.test(head) || /\b(FROM|JOIN)\s+[\w.]+\s*,\s*$/i.test(head);
  const tblBoost = tableCtx ? 400 : 0;
  for (const t of schema) cands.push({ text: t.name, kind: 'table', detail: `테이블 · ${t.columns.length}컬럼`, boost: tblBoost });
  for (const c of ctes) cands.push({ text: c, kind: 'table', detail: 'CTE', boost: tblBoost + 20 });
  if (!tableCtx) {
    // 쿼리에서 참조한 테이블의 컬럼을 우선, 나머지 테이블 컬럼은 낮게
    const used = new Set(refs.map((r) => r.table.toLowerCase()));
    for (const t of schema) cands.push(...colsOf(t, used.has(t.name.toLowerCase()) ? 150 : -120));
    for (const r of refs) if (r.alias) cands.push({ text: r.alias, kind: 'alias', detail: `${r.table} 별칭` });
    cands.push(...Object.entries(SQL_FUNCS).map(([text, detail]) => ({ text, kind: 'func', detail, snippet: '(' })));
  }
  cands.push(...SQL_KEYWORDS.map((k) => ({ text: k, kind: 'keyword', detail: '키워드', boost: tableCtx ? -300 : 0 })));
  return { prefix, list: rank(cands, prefix) };
}

// ───────── Python / pandas ─────────
export function pyCandidates(before, fullText = '') {
  const prefix = (before.match(/[A-Za-z_]\w*$/) || [''])[0];
  const head = before.slice(0, before.length - prefix.length);
  const vars = [...new Set([...fullText.matchAll(/^\s*([A-Za-z_]\w*)\s*=[^=]/gm)].map((m) => m[1]))];

  // df['col  /  df["col
  const sub = head.match(/([A-Za-z_]\w*)\[\s*['"]$/);
  if (sub) {
    const t = tableByName(sub[1]);
    const cols = t ? colsOf(t, 100) : schema.flatMap((x) => colsOf(x));
    return { prefix, list: rank(cols, prefix), inString: true };
  }
  // .str. / .dt.
  if (/\.str\.$/.test(head)) return { prefix, list: rank(dict(STR_METHODS, 'method'), prefix) };
  if (/\.dt\.$/.test(head)) return { prefix, list: rank(dict(DT_METHODS, 'method'), prefix) };
  const attr = head.match(/([A-Za-z_]\w*)\s*\.$/);
  if (attr) {
    const name = attr[1];
    if (name === 'pd') return { prefix, list: rank(dict(PD_FUNCS, 'func'), prefix) };
    if (name === 'np') return { prefix, list: rank(dict(NP_FUNCS, 'func'), prefix) };
    const t = tableByName(name);
    return { prefix, list: rank([...dict(DF_METHODS, 'method'), ...colsOf(t, 30)], prefix) };
  }
  if (/[)\]]\s*\.$/.test(head)) return { prefix, list: rank(dict(DF_METHODS, 'method'), prefix) };

  const cands = [
    ...schema.map((t) => ({ text: t.name, kind: 'table', detail: `DataFrame · ${t.columns.length}컬럼`, boost: 30 })),
    ...vars.map((v) => ({ text: v, kind: 'var', detail: '내 변수' })),
    ...dict(PY_GLOBALS, 'module'),
    ...PY_KEYWORDS.map((k) => ({ text: k, kind: 'keyword', detail: 'Python' })),
  ];
  return { prefix, list: rank(cands, prefix) };
}

// ───────── CodeMirror 연결 ─────────
const KIND_LABEL = { column: 'C', table: 'T', alias: 'A', var: 'V', method: 'M', func: 'F', keyword: 'K', module: 'P' };

export function makeHint(lang) {
  return (cm) => {
    const cur = cm.getCursor();
    const token = cm.getTokenAt(cur);
    const tt = token.type || '';
    const before = cm.getRange({ line: Math.max(0, cur.line - 200), ch: 0 }, cur);
    const after = cm.getRange(cur, { line: cur.line + 50, ch: 0 });
    let res;
    if (lang === 'sql') {
      if (/comment/.test(tt) || (/string/.test(tt) && !/\.$/.test(before))) return null;
      res = sqlCandidates(before, after);
    } else {
      res = pyCandidates(before, cm.getValue());
      if (/comment/.test(tt) || (/string/.test(tt) && !res.inString)) return null;
    }
    if (!res.list.length) return null;
    const from = { line: cur.line, ch: cur.ch - res.prefix.length };
    const upperKw = lang === 'sql' && res.prefix && res.prefix === res.prefix.toLowerCase();
    const data = {
      from,
      to: cur,
      list: res.list.map((c) => ({
        text: upperKw && (c.kind === 'keyword' || c.kind === 'func') ? c.text.toLowerCase() : c.text,
        displayText: c.text,
        className: `ac-item ac-${c.kind}`,
        render(el) {
          el.innerHTML = '';
          const k = document.createElement('span');
          k.className = 'ac-kind';
          k.textContent = KIND_LABEL[c.kind] || '•';
          const t = document.createElement('span');
          t.className = 'ac-text';
          t.textContent = c.text;
          const d = document.createElement('span');
          d.className = 'ac-detail';
          d.textContent = c.detail || '';
          el.append(k, t, d);
        },
      })),
    };
    window.CodeMirror.on(data, 'pick', (item) => recordUsage(item.displayText));
    return data;
  };
}
