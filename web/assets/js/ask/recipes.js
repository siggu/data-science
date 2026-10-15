// 질문하기 레시피: 의도(recipe) + 빈칸(slots) → SQL / pandas 코드 템플릿
// - desc 는 화면 안내와 (2단계) Jev 보기 설명으로 함께 씁니다.
// - refs 는 문법 레퍼런스 항목 id (#/reference?lang=…&id=…)
import { AGG_SQL, AGG_SUFFIX, AGG_LABEL, UNIT_LABEL } from './lexicon.js';

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const qi = (c) => (IDENT.test(c) ? c : `"${String(c).replace(/"/g, '""')}"`);
const ps = (c) => `'${String(c).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const isNum = (v) => typeof v === 'number' || (/^-?\d+(\.\d+)?$/.test(String(v)) && String(v).length < 16);
const sqlLit = (v) => (isNum(v) ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const pyLit = (v) => (isNum(v) ? String(v) : ps(v));
const list = (cols) => `[${cols.map(ps).join(', ')}]`;
const keyArg = (keys) => (keys.length === 1 ? ps(keys[0]) : list(keys));

export const metricAlias = (m) => (m.agg === 'count' && !m.col ? 'cnt' : `${m.col}_${AGG_SUFFIX[m.agg]}`);
function sqlMetric(m) {
  if (m.agg === 'count' && !m.col) return `COUNT(*) AS ${metricAlias(m)}`;
  if (m.agg === 'nunique') return `COUNT(DISTINCT ${qi(m.col)}) AS ${metricAlias(m)}`;
  return `${AGG_SQL[m.agg]}(${qi(m.col)}) AS ${metricAlias(m)}`;
}
function pdMetric(m, keys) {
  if (m.agg === 'count' && !m.col) return `${metricAlias(m)}=(${ps(keys[0])}, 'size')`;
  return `${metricAlias(m)}=(${ps(m.col)}, '${m.agg}')`;
}

// ───── 필터 (WHERE / 불리언 마스크) ─────
const OPS_SQL = { '=': '=', '!=': '<>', '>': '>', '>=': '>=', '<': '<', '<=': '<=' };
function sqlCond(f) {
  const c = qi(f.col);
  if (f.op === 'contains') return `${c} LIKE '%${String(f.value).replace(/'/g, "''")}%'`;
  if (f.op === 'isnull') return `${c} IS NULL`;
  if (f.op === 'notnull') return `${c} IS NOT NULL`;
  if (f.op === 'between') return `${c} BETWEEN ${sqlLit(f.value)} AND ${sqlLit(f.value2)}`;
  if (f.op === 'in') return `${c} IN (${f.value.map(sqlLit).join(', ')})`;
  return `${c} ${OPS_SQL[f.op]} ${sqlLit(f.value)}`;
}
function pdCond(f, df) {
  const c = `${df}[${ps(f.col)}]`;
  if (f.op === 'contains') return `${c}.str.contains(${ps(f.value)}, na=False)`;
  if (f.op === 'isnull') return `${c}.isna()`;
  if (f.op === 'notnull') return `${c}.notna()`;
  if (f.op === 'between') return `${c}.between(${pyLit(f.value)}, ${pyLit(f.value2)})`;
  if (f.op === 'in') return `${c}.isin([${f.value.map(pyLit).join(', ')}])`;
  return `(${c} ${f.op === '=' ? '==' : f.op} ${pyLit(f.value)})`;
}
export const sqlWhere = (filters) => (filters?.length ? `\nWHERE ${filters.map(sqlCond).join('\n  AND ')}` : '');
export function pdSource(df, filters) {
  if (!filters?.length) return df;
  const conds = filters.map((f) => pdCond(f, df));
  return `${df}[${conds.length === 1 ? conds[0].replace(/^\((.*)\)$/, '$1') : conds.join(' & ')}]`;
}

// 날짜 단위 → SQL / pandas
const UNIT_SQL = (u, d) => (u === 'dow' ? `dayname(${qi(d)})` : `date_trunc('${u}', ${qi(d)})`);
const UNIT_PD = { hour: 'h', day: 'D', week: 'W', month: 'M', quarter: 'Q', year: 'Y' };
const unitAlias = (u) => ({ dow: 'weekday', hour: 'hour', day: 'day', week: 'week', month: 'month', quarter: 'quarter', year: 'year' }[u]);
const pdUnitExpr = (u, df, d) => (u === 'dow' ? `${df}[${ps(d)}].dt.day_name()` : `${df}[${ps(d)}].dt.to_period('${UNIT_PD[u]}').dt.start_time`);

/** 날짜 단위로 먼저 집계한 뒤(선택) 윈도우 계산을 하는 레시피들의 공통 앞부분 */
function periodBase(s, ctx) {
  const m = s.metrics?.[0] || { agg: 'sum', col: s.value };
  if (!s.unit) return null;
  const a = unitAlias(s.unit);
  const alias = metricAlias(m);
  return {
    alias, a,
    sql: `WITH base AS (\n  SELECT ${UNIT_SQL(s.unit, s.dateCol)} AS ${a}, ${sqlMetric(m)}\n  FROM ${ctx.table}${sqlWhere(s.filters).replace(/\n/g, '\n  ')}\n  GROUP BY 1\n)`,
    pd: `base = (${pdSource(ctx.df, s.filters)}\n        .groupby(${pdUnitExpr(s.unit, ctx.df, s.dateCol)}.rename(${ps(a)}))\n        .agg(${pdMetric(m, [s.dateCol])})\n        .reset_index())`,
  };
}

export const RECIPES = [
  {
    id: 'group_agg', title: '그룹별 집계', desc: '어떤 컬럼 값별로 묶어서 합계·평균·개수 등을 구한다 (GROUP BY / groupby)',
    refs: { sql: ['group-by', 'aggregate', 'order-limit'], pandas: ['groupby-agg', 'groupby-keys', 'sort'] },
    slots: ['keys', 'metrics', 'filters', 'order', 'limit'],
    build(s, ctx) {
      const keys = s.keys;
      const metrics = s.metrics;
      const first = metricAlias(metrics[0]);
      const sortSql = s.order ? `\nORDER BY ${first} ${s.order === 'desc' ? 'DESC' : 'ASC'}` : `\nORDER BY ${keys.map(qi).join(', ')}`;
      const sql = `SELECT ${keys.map(qi).join(', ')},\n       ${metrics.map(sqlMetric).join(',\n       ')}\nFROM ${ctx.table}${sqlWhere(s.filters)}\nGROUP BY ${keys.map(qi).join(', ')}${sortSql}${s.limit ? `\nLIMIT ${s.limit}` : ''}`;
      let pd = `result = (${pdSource(ctx.df, s.filters)}\n          .groupby(${keyArg(keys)}, as_index=False)\n          .agg(${metrics.map((m) => pdMetric(m, keys)).join(', ')})`;
      if (s.order) pd += `\n          .sort_values(${ps(first)}, ascending=${s.order !== 'desc' ? 'True' : 'False'})`;
      if (s.limit) pd += `\n          .head(${s.limit})`;
      pd += ')\nresult';
      return { sql, pandas: pd };
    },
  },
  {
    id: 'total_agg', title: '전체 집계', desc: '그룹 없이 전체(또는 조건에 맞는 행)의 합계·평균·개수를 구한다',
    refs: { sql: ['aggregate', 'where'], pandas: ['groupby-agg', 'bool-filter'] },
    slots: ['metrics', 'filters'],
    build(s, ctx) {
      const sql = `SELECT ${s.metrics.map(sqlMetric).join(',\n       ')}\nFROM ${ctx.table}${sqlWhere(s.filters)}`;
      const src = pdSource(ctx.df, s.filters);
      const one = (m) => (m.agg === 'count' && !m.col ? `len(${src})` : `${src}[${ps(m.col)}].${m.agg === 'count' ? 'count' : m.agg}()`);
      const pd = s.metrics.length === 1 ? one(s.metrics[0])
        : `pd.Series({\n${s.metrics.map((m) => `    ${ps(metricAlias(m))}: ${one(m)},`).join('\n')}\n})`;
      return { sql, pandas: pd };
    },
  },
  {
    id: 'having', title: '집계 결과로 필터 (HAVING)', desc: '그룹별로 집계한 값이 기준 이상/이하인 그룹만 남긴다',
    refs: { sql: ['having', 'group-by'], pandas: ['groupby-agg', 'groupby-filter'] },
    slots: ['keys', 'metrics', 'having', 'filters'],
    build(s, ctx) {
      const m = s.metrics[0];
      const a = metricAlias(m);
      const h = s.having;
      const sqlAgg = sqlMetric(m).replace(/ AS \w+$/, '');
      const sql = `SELECT ${s.keys.map(qi).join(', ')},\n       ${sqlMetric(m)}\nFROM ${ctx.table}${sqlWhere(s.filters)}\nGROUP BY ${s.keys.map(qi).join(', ')}\nHAVING ${sqlAgg} ${OPS_SQL[h.op]} ${h.value}\nORDER BY ${a} DESC`;
      const pd = `agg = (${pdSource(ctx.df, s.filters)}\n       .groupby(${keyArg(s.keys)}, as_index=False)\n       .agg(${pdMetric(m, s.keys)}))\nresult = agg[agg[${ps(a)}] ${h.op === '=' ? '==' : h.op} ${h.value}].sort_values(${ps(a)}, ascending=False)\nresult`;
      return { sql, pandas: pd };
    },
  },
  {
    id: 'filter', title: '조건으로 행 거르기', desc: '조건(같다·이상·포함·기간 등)에 맞는 행만 남긴다 (WHERE / 불리언 인덱싱)',
    refs: { sql: ['where', 'where-operators'], pandas: ['bool-filter', 'query'] },
    slots: ['filters', 'cols'],
    build(s, ctx) {
      const cols = s.cols?.length ? s.cols : null;
      const sql = `SELECT ${cols ? cols.map(qi).join(', ') : '*'}\nFROM ${ctx.table}${sqlWhere(s.filters)}`;
      const pd = `result = ${pdSource(ctx.df, s.filters)}${cols ? `[${list(cols)}]` : ''}\nresult`;
      return { sql, pandas: pd };
    },
  },
  {
    id: 'sort_limit', title: '정렬 · 상위 N개', desc: '한 컬럼 기준으로 정렬하고 위에서 N개만 본다 (ORDER BY + LIMIT / sort_values + head)',
    refs: { sql: ['order-limit'], pandas: ['sort', 'nlargest'] },
    slots: ['value', 'order', 'limit', 'filters'],
    build(s, ctx) {
      const desc = s.order !== 'asc';
      const sql = `SELECT *\nFROM ${ctx.table}${sqlWhere(s.filters)}\nORDER BY ${qi(s.value)} ${desc ? 'DESC' : 'ASC'}${s.limit ? `\nLIMIT ${s.limit}` : ''}`;
      const pd = `result = ${pdSource(ctx.df, s.filters)}.sort_values(${ps(s.value)}, ascending=${desc ? 'False' : 'True'})${s.limit ? `.head(${s.limit})` : ''}\nresult`;
      return { sql, pandas: pd };
    },
  },
  {
    id: 'top_n_per_group', title: '그룹별 상위 N개', desc: '그룹마다 값이 큰 순서로 N개씩 뽑는다 (ROW_NUMBER + PARTITION BY / sort + groupby.head)',
    refs: { sql: ['ranking', 'qualify', 'cte'], pandas: ['rank', 'nlargest', 'groupby-agg'] },
    slots: ['keys', 'item', 'value', 'agg', 'limit', 'filters'],
    build(s, ctx) {
      const n = s.limit || 3;
      const k = s.keys.map(qi).join(', ');
      if (s.item) {
        const m = { agg: s.agg || 'sum', col: s.value };
        const a = metricAlias(m);
        const sql = `WITH agg AS (\n  SELECT ${k}, ${qi(s.item)}, ${sqlMetric(m)}\n  FROM ${ctx.table}${sqlWhere(s.filters).replace(/\n/g, '\n  ')}\n  GROUP BY ${k}, ${qi(s.item)}\n)\nSELECT *\nFROM (\n  SELECT *, ROW_NUMBER() OVER (PARTITION BY ${k} ORDER BY ${a} DESC) AS rn\n  FROM agg\n) ranked\nWHERE rn <= ${n}\nORDER BY ${k}, rn`;
        const pd = `agg = (${pdSource(ctx.df, s.filters)}\n       .groupby(${list([...s.keys, s.item])}, as_index=False)\n       .agg(${pdMetric(m, s.keys)}))\nresult = (agg.sort_values(${list([...s.keys, a])}, ascending=[${[...s.keys.map(() => 'True'), 'False'].join(', ')}])\n             .groupby(${keyArg(s.keys)})\n             .head(${n}))\nresult`;
        return { sql, pandas: pd };
      }
      const sql = `SELECT *\nFROM (\n  SELECT *, ROW_NUMBER() OVER (PARTITION BY ${k} ORDER BY ${qi(s.value)} DESC) AS rn\n  FROM ${ctx.table}${sqlWhere(s.filters).replace(/\n/g, '\n  ')}\n) ranked\nWHERE rn <= ${n}\nORDER BY ${k}, rn`;
      const pd = `result = (${pdSource(ctx.df, s.filters)}\n          .sort_values(${list([...s.keys, s.value])}, ascending=[${[...s.keys.map(() => 'True'), 'False'].join(', ')}])\n          .groupby(${keyArg(s.keys)})\n          .head(${n}))\nresult`;
      return { sql, pandas: pd };
    },
  },
  {
    id: 'date_agg', title: '기간(일·주·월)별 집계', desc: '날짜를 일/주/월/연도/요일 단위로 묶어 집계한다 (date_trunc / dt.to_period)',
    refs: { sql: ['date-trunc-extract', 'group-by'], pandas: ['dt-accessor', 'groupby-agg', 'resample'] },
    slots: ['dateCol', 'unit', 'metrics', 'keys', 'filters'],
    build(s, ctx) {
      const a = unitAlias(s.unit);
      const keys = s.keys || [];
      const sqlKeys = keys.length ? `, ${keys.map(qi).join(', ')}` : '';
      const sql = `SELECT ${UNIT_SQL(s.unit, s.dateCol)} AS ${a}${sqlKeys},\n       ${s.metrics.map(sqlMetric).join(',\n       ')}\nFROM ${ctx.table}${sqlWhere(s.filters)}\nGROUP BY ${keys.length ? `1, ${keys.map(qi).join(', ')}` : '1'}\nORDER BY 1${sqlKeys}`;
      const grp = keys.length ? `[${pdUnitExpr(s.unit, 'src', s.dateCol)}.rename(${ps(a)}), ${keys.map((k) => `src[${ps(k)}]`).join(', ')}]` : `${pdUnitExpr(s.unit, 'src', s.dateCol)}.rename(${ps(a)})`;
      const pd = `src = ${pdSource(ctx.df, s.filters)}\nresult = (src.groupby(${grp})\n          .agg(${s.metrics.map((m) => pdMetric(m, [s.dateCol])).join(', ')})\n          .reset_index())\nresult`;
      return { sql, pandas: pd, notes: [`${s.dateCol}이 날짜 타입이어야 합니다. 문자열이면 SQL은 \`CAST(${s.dateCol} AS DATE)\`, pandas는 \`pd.to_datetime(${ctx.df}['${s.dateCol}'])\`로 먼저 바꾸세요.`] };
    },
  },
  {
    id: 'running_total', title: '누적 합계', desc: '순서(날짜 등)대로 값을 누적해서 더한다 (SUM() OVER (ORDER BY …) / cumsum)',
    refs: { sql: ['running-moving', 'window-basics'], pandas: ['cumulative', 'sort'] },
    slots: ['orderCol', 'value', 'keys', 'unit', 'dateCol', 'filters'],
    build(s, ctx) {
      const pb = periodBase({ ...s, metrics: s.metrics?.length ? s.metrics : [{ agg: 'sum', col: s.value }] }, ctx);
      if (pb) {
        const sql = `${pb.sql}\nSELECT ${pb.a}, ${pb.alias},\n       SUM(${pb.alias}) OVER (ORDER BY ${pb.a} ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cum_${pb.alias}\nFROM base\nORDER BY ${pb.a}`;
        const pd = `${pb.pd}\nbase['cum_${pb.alias}'] = base[${ps(pb.alias)}].cumsum()\nbase`;
        return { sql, pandas: pd };
      }
      const keys = s.keys || [];
      const part = keys.length ? `PARTITION BY ${keys.map(qi).join(', ')} ` : '';
      const sql = `SELECT *,\n       SUM(${qi(s.value)}) OVER (${part}ORDER BY ${qi(s.orderCol)} ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cum_${s.value}\nFROM ${ctx.table}${sqlWhere(s.filters)}\nORDER BY ${keys.length ? `${keys.map(qi).join(', ')}, ` : ''}${qi(s.orderCol)}`;
      const pd = `result = ${pdSource(ctx.df, s.filters)}.sort_values(${list([...keys, s.orderCol])}).copy()\nresult['cum_${s.value}'] = ${keys.length ? `result.groupby(${keyArg(keys)})[${ps(s.value)}].cumsum()` : `result[${ps(s.value)}].cumsum()`}\nresult`;
      return { sql, pandas: pd };
    },
  },
  {
    id: 'lag_diff', title: '이전 값 대비 증감', desc: '이전 행(전일·전월)의 값과 비교해 차이·증감률을 구한다 (LAG / shift · pct_change)',
    refs: { sql: ['lag-lead', 'window-basics'], pandas: ['shift-diff', 'sort'] },
    slots: ['orderCol', 'value', 'keys', 'unit', 'dateCol', 'filters'],
    build(s, ctx) {
      const pb = periodBase({ ...s, metrics: s.metrics?.length ? s.metrics : [{ agg: 'sum', col: s.value }] }, ctx);
      if (pb) {
        const sql = `${pb.sql}\nSELECT ${pb.a}, ${pb.alias},\n       LAG(${pb.alias}) OVER (ORDER BY ${pb.a}) AS prev_${pb.alias},\n       ${pb.alias} - LAG(${pb.alias}) OVER (ORDER BY ${pb.a}) AS diff,\n       (${pb.alias} - LAG(${pb.alias}) OVER (ORDER BY ${pb.a})) / NULLIF(LAG(${pb.alias}) OVER (ORDER BY ${pb.a}), 0) AS pct_change\nFROM base\nORDER BY ${pb.a}`;
        const pd = `${pb.pd}\nbase['prev_${pb.alias}'] = base[${ps(pb.alias)}].shift(1)\nbase['diff'] = base[${ps(pb.alias)}].diff()\nbase['pct_change'] = base[${ps(pb.alias)}].pct_change()\nbase`;
        return { sql, pandas: pd };
      }
      const keys = s.keys || [];
      const w = `OVER (${keys.length ? `PARTITION BY ${keys.map(qi).join(', ')} ` : ''}ORDER BY ${qi(s.orderCol)})`;
      const v = qi(s.value);
      const sql = `SELECT *,\n       LAG(${v}) ${w} AS prev_${s.value},\n       ${v} - LAG(${v}) ${w} AS diff,\n       (${v} - LAG(${v}) ${w}) / NULLIF(LAG(${v}) ${w}, 0) AS pct_change\nFROM ${ctx.table}${sqlWhere(s.filters)}\nORDER BY ${keys.length ? `${keys.map(qi).join(', ')}, ` : ''}${qi(s.orderCol)}`;
      const g = keys.length ? `result.groupby(${keyArg(keys)})[${ps(s.value)}]` : `result[${ps(s.value)}]`;
      const pd = `result = ${pdSource(ctx.df, s.filters)}.sort_values(${list([...keys, s.orderCol])}).copy()\nresult['prev_${s.value}'] = ${g}.shift(1)\nresult['diff'] = ${g}.diff()\nresult['pct_change'] = ${g}.pct_change()\nresult`;
      return { sql, pandas: pd };
    },
  },
  {
    id: 'rank', title: '순위 매기기', desc: '값 크기 순으로 순위를 매긴다, 그룹 안 순위도 가능 (RANK / DENSE_RANK / rank)',
    refs: { sql: ['ranking', 'window-basics'], pandas: ['rank'] },
    slots: ['value', 'keys', 'order', 'filters'],
    build(s, ctx) {
      const keys = s.keys || [];
      const desc = s.order !== 'asc';
      const sql = `SELECT *,\n       DENSE_RANK() OVER (${keys.length ? `PARTITION BY ${keys.map(qi).join(', ')} ` : ''}ORDER BY ${qi(s.value)} ${desc ? 'DESC' : 'ASC'}) AS rnk\nFROM ${ctx.table}${sqlWhere(s.filters)}\nORDER BY ${keys.length ? `${keys.map(qi).join(', ')}, ` : ''}rnk`;
      const g = keys.length ? `result.groupby(${keyArg(keys)})[${ps(s.value)}]` : `result[${ps(s.value)}]`;
      const pd = `result = ${pdSource(ctx.df, s.filters)}.copy()\nresult['rnk'] = ${g}.rank(method='dense', ascending=${desc ? 'False' : 'True'}).astype('Int64')\nresult = result.sort_values(${list([...keys, 'rnk'])})\nresult`;
      return { sql, pandas: pd, notes: ['동점 처리: DENSE_RANK(1,2,2,3) / RANK(1,2,2,4) / ROW_NUMBER(1,2,3,4) 중 목적에 맞게 고르세요. pandas는 `method=` 로 같은 선택을 합니다.'] };
    },
  },
  {
    id: 'share', title: '전체 대비 비중', desc: '그룹별 값이 전체에서 차지하는 비중(%)을 구한다 (SUM() OVER () / 합계로 나누기)',
    refs: { sql: ['window-basics', 'group-by'], pandas: ['groupby-agg', 'transform'] },
    slots: ['keys', 'value', 'filters'],
    build(s, ctx) {
      const m = s.value ? { agg: 'sum', col: s.value } : { agg: 'count', col: null };
      const a = metricAlias(m);
      const sql = `SELECT ${s.keys.map(qi).join(', ')},\n       ${sqlMetric(m)},\n       ${sqlMetric(m).replace(/ AS \w+$/, '')} * 1.0 / SUM(${sqlMetric(m).replace(/ AS \w+$/, '')}) OVER () AS share\nFROM ${ctx.table}${sqlWhere(s.filters)}\nGROUP BY ${s.keys.map(qi).join(', ')}\nORDER BY share DESC`;
      const pd = `result = (${pdSource(ctx.df, s.filters)}\n          .groupby(${keyArg(s.keys)}, as_index=False)\n          .agg(${pdMetric(m, s.keys)}))\nresult['share'] = result[${ps(a)}] / result[${ps(a)}].sum()\nresult = result.sort_values('share', ascending=False)\nresult`;
      return { sql, pandas: pd, notes: ['share는 0~1 비율입니다. 퍼센트로 보려면 100을 곱하세요.'] };
    },
  },
  {
    id: 'cond_rate', title: '조건 비율 (전환율 등)', desc: '조건을 만족하는 행의 비율을 (그룹별로) 구한다 (AVG(CASE WHEN …) / 불리언 평균)',
    refs: { sql: ['conditional-agg', 'case-when'], pandas: ['groupby-agg', 'conditional'] },
    slots: ['keys', 'cond', 'filters'],
    build(s, ctx) {
      const keys = s.keys || [];
      const cs = sqlCond(s.cond);
      const sel = keys.length ? `${keys.map(qi).join(', ')},\n       ` : '';
      const sql = `SELECT ${sel}COUNT(*) AS n,\n       AVG(CASE WHEN ${cs} THEN 1.0 ELSE 0 END) AS rate\nFROM ${ctx.table}${sqlWhere(s.filters)}${keys.length ? `\nGROUP BY ${keys.map(qi).join(', ')}\nORDER BY rate DESC` : ''}`;
      const src = pdSource(ctx.df, s.filters);
      const flag = pdCond(s.cond, 'src').replace(/^\((.*)\)$/, '$1');
      const pd = keys.length
        ? `src = ${src}\nresult = (src.assign(flag=${flag})\n          .groupby(${keyArg(keys)}, as_index=False)\n          .agg(n=('flag', 'size'), rate=('flag', 'mean'))\n          .sort_values('rate', ascending=False))\nresult`
        : `src = ${src}\n(${flag}).mean()`;
      return { sql, pandas: pd, notes: ['rate는 0~1 비율입니다. 분모(전체 행)에 무엇을 넣을지(예: 유저 단위인지 행 단위인지) 먼저 확인하세요.'] };
    },
  },
  {
    id: 'bucket', title: '구간 나누기', desc: '숫자 값을 구간(등급)으로 나누고 구간별 개수를 센다 (CASE WHEN / pd.cut)',
    refs: { sql: ['case-when', 'ntile-percent-rank'], pandas: ['cut-qcut', 'conditional'] },
    slots: ['value', 'bins', 'filters'],
    build(s, ctx) {
      const v = qi(s.value);
      const b = (s.bins || []).slice().sort((x, y) => x - y);
      if (!b.length) {
        const sql = `SELECT NTILE(4) OVER (ORDER BY ${v}) AS quartile, *\nFROM ${ctx.table}${sqlWhere(s.filters)}`;
        const pd = `result = ${pdSource(ctx.df, s.filters)}.copy()\nresult['quartile'] = pd.qcut(result[${ps(s.value)}], q=4, labels=['Q1', 'Q2', 'Q3', 'Q4'])\nresult['quartile'].value_counts().sort_index()`;
        return { sql, pandas: pd, notes: ['구간 경계를 질문에 적지 않아 4분위(값 순서로 4등분)로 나눴습니다. "1만, 5만 기준" 처럼 경계를 적으면 그 기준으로 나눕니다.'] };
      }
      const labels = [`~${b[0]}`, ...b.slice(1).map((x, i) => `${b[i]}~${x}`), `${b[b.length - 1]}~`];
      const whens = b.map((x, i) => `WHEN ${v} < ${x} THEN '${labels[i]}'`).join('\n         ');
      const sql = `SELECT CASE ${whens}\n         ELSE '${labels[labels.length - 1]}'\n       END AS bucket,\n       COUNT(*) AS cnt\nFROM ${ctx.table}${sqlWhere(s.filters)}\nGROUP BY 1\nORDER BY MIN(${v})`;
      const pd = `result = ${pdSource(ctx.df, s.filters)}.copy()\nresult['bucket'] = pd.cut(result[${ps(s.value)}],\n                          bins=[-np.inf, ${b.join(', ')}, np.inf],\n                          labels=[${labels.map(ps).join(', ')}], right=False)\nresult['bucket'].value_counts(sort=False)`;
      return { sql, pandas: pd, notes: ['구간은 "이상 ~ 미만"으로 나눴습니다 (right=False).'] };
    },
  },
  {
    id: 'moving_avg', title: '이동 평균', desc: '최근 N개(N일) 값의 평균을 행마다 구한다 (AVG() OVER (ROWS BETWEEN …) / rolling)',
    refs: { sql: ['running-moving'], pandas: ['rolling', 'groupby-rolling'] },
    slots: ['orderCol', 'value', 'window', 'unit', 'dateCol', 'keys', 'filters'],
    build(s, ctx) {
      const w = s.window || 7;
      const pb = periodBase({ ...s, metrics: s.metrics?.length ? s.metrics : [{ agg: 'sum', col: s.value }] }, ctx);
      if (pb) {
        const sql = `${pb.sql}\nSELECT ${pb.a}, ${pb.alias},\n       AVG(${pb.alias}) OVER (ORDER BY ${pb.a} ROWS BETWEEN ${w - 1} PRECEDING AND CURRENT ROW) AS ma${w}\nFROM base\nORDER BY ${pb.a}`;
        const pd = `${pb.pd}\nbase['ma${w}'] = base[${ps(pb.alias)}].rolling(${w}, min_periods=1).mean()\nbase`;
        return { sql, pandas: pd, notes: ['빠진 날짜가 있으면 "최근 N행"과 "최근 N일"이 달라집니다. 날짜를 빠짐없이 채운 뒤 계산하세요.'] };
      }
      const keys = s.keys || [];
      const sql = `SELECT *,\n       AVG(${qi(s.value)}) OVER (${keys.length ? `PARTITION BY ${keys.map(qi).join(', ')} ` : ''}ORDER BY ${qi(s.orderCol)} ROWS BETWEEN ${w - 1} PRECEDING AND CURRENT ROW) AS ma${w}\nFROM ${ctx.table}${sqlWhere(s.filters)}\nORDER BY ${keys.length ? `${keys.map(qi).join(', ')}, ` : ''}${qi(s.orderCol)}`;
      const g = keys.length ? `result.groupby(${keyArg(keys)})[${ps(s.value)}].transform(lambda x: x.rolling(${w}, min_periods=1).mean())` : `result[${ps(s.value)}].rolling(${w}, min_periods=1).mean()`;
      const pd = `result = ${pdSource(ctx.df, s.filters)}.sort_values(${list([...keys, s.orderCol])}).copy()\nresult['ma${w}'] = ${g}\nresult`;
      return { sql, pandas: pd };
    },
  },
  {
    id: 'null_handle', title: '결측값(NULL) 확인·처리', desc: 'NULL/NaN 개수를 세거나, 다른 값으로 채우거나, 제거한다 (IS NULL · COALESCE / isna · fillna · dropna)',
    refs: { sql: ['null-handling'], pandas: ['missing'] },
    slots: ['col', 'mode', 'fillValue'],
    build(s, ctx, all) {
      const df = ctx.df;
      if (s.mode === 'fill') {
        const fv = s.fillValue ?? 0;
        const sql = `SELECT *, COALESCE(${qi(s.col)}, ${sqlLit(fv)}) AS ${s.col}_filled\nFROM ${ctx.table}`;
        const pd = `result = ${df}.copy()\nresult[${ps(s.col)}] = result[${ps(s.col)}].fillna(${pyLit(fv)})\nresult`;
        return { sql, pandas: pd };
      }
      if (s.mode === 'drop') {
        const sql = `SELECT *\nFROM ${ctx.table}\nWHERE ${qi(s.col)} IS NOT NULL`;
        const pd = `result = ${df}.dropna(subset=[${ps(s.col)}])\nresult`;
        return { sql, pandas: pd };
      }
      const cols = s.col ? [s.col] : (all || []).slice(0, 8);
      const sql = cols.length
        ? `SELECT COUNT(*) AS total_rows,\n       ${cols.map((c) => `COUNT(*) - COUNT(${qi(c)}) AS ${c}_nulls`).join(',\n       ')}\nFROM ${ctx.table}`
        : `SELECT COUNT(*) - COUNT(col) AS col_nulls\nFROM ${ctx.table}`;
      const pd = s.col ? `${df}[${ps(s.col)}].isna().sum()` : `${df}.isna().sum()`;
      return { sql, pandas: pd, notes: ['`COUNT(col)`은 NULL을 세지 않으므로 `COUNT(*) - COUNT(col)`이 NULL 개수입니다.'] };
    },
  },
  {
    id: 'dedupe', title: '중복 제거', desc: '완전히 같은 행, 또는 특정 컬럼 기준 중복을 제거한다 (DISTINCT · ROW_NUMBER / drop_duplicates)',
    refs: { sql: ['distinct', 'ranking'], pandas: ['duplicates'] },
    slots: ['cols', 'orderCol'],
    build(s, ctx) {
      const cols = s.cols || [];
      if (!cols.length) {
        return { sql: `SELECT DISTINCT *\nFROM ${ctx.table}`, pandas: `result = ${ctx.df}.drop_duplicates()\nresult` };
      }
      const ord = s.orderCol ? `${qi(s.orderCol)} DESC` : cols.map(qi).join(', ');
      const sql = `SELECT *\nFROM (\n  SELECT *, ROW_NUMBER() OVER (PARTITION BY ${cols.map(qi).join(', ')} ORDER BY ${ord}) AS rn\n  FROM ${ctx.table}\n) t\nWHERE rn = 1`;
      const pd = s.orderCol
        ? `result = ${ctx.df}.sort_values(${ps(s.orderCol)}, ascending=False).drop_duplicates(subset=${list(cols)}, keep='first')\nresult`
        : `result = ${ctx.df}.drop_duplicates(subset=${list(cols)}, keep='first')\nresult`;
      return { sql, pandas: pd, notes: ['어떤 행을 남길지(최신/최초)를 ORDER BY(sort_values)로 정합니다.'] };
    },
  },
  {
    id: 'distinct', title: '고유값 목록', desc: '컬럼에 어떤 값들이 있는지 중복 없이 본다 (DISTINCT / unique · value_counts)',
    refs: { sql: ['distinct'], pandas: ['value-counts'] },
    slots: ['cols'],
    build(s, ctx) {
      const cols = s.cols?.length ? s.cols : ['col'];
      const sql = `SELECT ${cols.map(qi).join(', ')}, COUNT(*) AS cnt\nFROM ${ctx.table}\nGROUP BY ${cols.map(qi).join(', ')}\nORDER BY cnt DESC`;
      const pd = cols.length === 1 ? `${ctx.df}[${ps(cols[0])}].value_counts()` : `${ctx.df}[${list(cols)}].value_counts()`;
      return { sql, pandas: pd, notes: ['값 목록만 필요하면 SQL은 `SELECT DISTINCT 컬럼`, pandas는 `.unique()`를 쓰세요. 위 코드는 값별 개수까지 함께 보여줍니다.'] };
    },
  },
  {
    id: 'join', title: '두 테이블 조인', desc: '공통 키로 두 테이블(DataFrame)을 붙인다 (JOIN / merge)',
    refs: { sql: ['left-join', 'inner-join', 'join-fanout'], pandas: ['merge', 'merge-check'] },
    slots: ['right', 'key', 'how'],
    build(s, ctx) {
      const how = s.how || 'left';
      const kw = { left: 'LEFT JOIN', inner: 'JOIN', outer: 'FULL OUTER JOIN' }[how];
      const sql = `SELECT a.*, b.*\nFROM ${ctx.table} a\n${kw} ${s.right} b\n  ON a.${qi(s.key)} = b.${qi(s.key)}`;
      const pd = `result = ${ctx.df}.merge(${s.right}, on=${ps(s.key)}, how='${how}', validate='many_to_one')\nresult`;
      return { sql, pandas: pd, notes: ['오른쪽 테이블의 키가 중복이면 행이 늘어납니다(fan-out). pandas의 `validate=`는 키가 고유하지 않으면 오류를 냅니다 — 1:N 조인이 의도라면 지우세요.', '`b.*`에는 키 컬럼이 한 번 더 들어갑니다. 실제로는 필요한 컬럼만 고르세요.'] };
    },
  },
  {
    id: 'pivot', title: '피벗 (행 × 열 표)', desc: '한 컬럼 값을 열로 펼쳐 행×열 요약표를 만든다 (PIVOT / pivot_table)',
    refs: { sql: ['pivot', 'conditional-agg'], pandas: ['pivot-table', 'melt-pivot'] },
    slots: ['index', 'columns', 'value', 'agg', 'filters'],
    build(s, ctx) {
      const agg = s.agg || 'sum';
      const valueSql = s.value ? `${AGG_SQL[agg]}(${qi(s.value)})` : 'COUNT(*)';
      const sql = `PIVOT ${s.filters?.length ? `(SELECT * FROM ${ctx.table}${sqlWhere(s.filters).replace(/\n/g, ' ')})` : ctx.table}\nON ${qi(s.columns)}\nUSING ${valueSql}\nGROUP BY ${qi(s.index)}\nORDER BY ${qi(s.index)}`;
      const src = pdSource(ctx.df, s.filters);
      const pd = s.value
        ? `result = pd.pivot_table(${src},\n                        index=${ps(s.index)}, columns=${ps(s.columns)},\n                        values=${ps(s.value)}, aggfunc='${agg}', fill_value=0)\nresult`
        : `src = ${src}\nresult = pd.crosstab(src[${ps(s.index)}], src[${ps(s.columns)}])\nresult`;
      return { sql, pandas: pd, notes: ['SQL은 DuckDB의 PIVOT 문법입니다. Databricks는 `SELECT * FROM t PIVOT (SUM(v) FOR col IN (\'a\', \'b\'))`처럼 열 값을 직접 적거나, `SUM(CASE WHEN col = \'a\' THEN v END)` 조건부 집계를 씁니다.'] };
    },
  },
];

export const RECIPE_BY_ID = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

/** 해석 결과를 사람이 읽는 한 줄로 */
export function describeSlots(recipeId, s) {
  const parts = [];
  const m = (x) => (x.agg === 'count' && !x.col ? '행 개수' : `${x.col} ${AGG_LABEL[x.agg]}`);
  if (s.keys?.length) parts.push(`기준: ${s.keys.join(', ')}`);
  if (s.unit) parts.push(`단위: ${UNIT_LABEL[s.unit]} (${s.dateCol})`);
  if (s.metrics?.length && recipeId !== 'running_total' && recipeId !== 'lag_diff' && recipeId !== 'moving_avg') parts.push(`값: ${s.metrics.map(m).join(', ')}`);
  if (s.value && !s.metrics) parts.push(`값: ${s.value}`);
  if (s.item) parts.push(`항목: ${s.item}`);
  if (s.limit) parts.push(`${s.order === 'asc' ? '하위' : '상위'} ${s.limit}개`);
  if (s.filters?.length) parts.push(`조건: ${s.filters.map((f) => `${f.col} ${f.op} ${f.op === 'between' ? `${f.value}~${f.value2}` : f.value ?? ''}`.trim()).join(', ')}`);
  return parts.join(' · ');
}
