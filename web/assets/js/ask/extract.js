// 사용자가 붙여 넣은 코드/테이블 정보에서 언어, 테이블(DataFrame) 이름, 컬럼 이름을 뽑습니다.
// 정규식 기반의 가벼운 추출이라 완벽하지 않습니다. 화면에서 사용자가 고칠 수 있게 후보만 넉넉히 모읍니다.

const SQL_WORDS = new Set(`select from where and or not in is null like ilike between as on join inner left right full outer cross
group by having order asc desc limit offset distinct all union case when then else end with over partition rows range
count sum avg min max median cast date timestamp interval true false filter qualify insert into values update set delete
create table view replace if exists varchar int integer bigint double float decimal string boolean text using nulls first last
coalesce nullif round lower upper trim substr substring concat length extract year month day week quarter date_trunc
row_number rank dense_rank lag lead first_value last_value ntile percent_rank unbounded preceding following current row
datediff date_diff date_add date_format strftime to_date to_timestamp now current_date`.split(/\s+/));

const PY_WORDS = new Set(`import from as pd np df def return if else elif for in not and or is none true false print len lambda
with try except class range list dict set tuple str int float bool sum min max mean count head tail sort_values groupby agg
reset_index merge read_csv read_excel read_parquet to_csv query loc iloc astype rename drop fillna dropna isna notna apply
map value_counts nunique unique describe info shape columns index values pivot_table concat assign copy dt str
self cls display result`.split(/\s+/));

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const uniq = (arr) => [...new Set(arr.filter(Boolean))];

/** SQL 인지 pandas 인지 추정 */
export function detectLang(code) {
  if (!code || !code.trim()) return null;
  const sqlHits = (code.match(/\b(SELECT|FROM|WHERE|GROUP\s+BY|JOIN|CREATE\s+TABLE)\b/gi) || []).length;
  const pyHits = (code.match(/(\bpd\.|\bimport\b|\.groupby\(|\.merge\(|\[\s*['"][^'"]+['"]\s*\]|\bdf\b|read_csv)/g) || []).length;
  if (sqlHits === 0 && pyHits === 0) return null;
  return sqlHits >= pyHits ? 'sql' : 'pandas';
}

function sqlInfo(code) {
  const tables = [];
  const columns = [];
  const ctes = new Set([...code.matchAll(/(?:\bWITH\s+|,\s*)([A-Za-z_]\w*)\s+AS\s*\(/gi)].map((m) => m[1].toLowerCase()));
  for (const m of code.matchAll(/\b(?:FROM|JOIN|INTO|UPDATE|TABLE)\s+([A-Za-z_][\w.]*)/gi)) {
    const t = m[1].split('.').pop();
    if (!ctes.has(t.toLowerCase()) && !SQL_WORDS.has(t.toLowerCase())) tables.push(t);
  }
  // CREATE TABLE t (col type, ...)
  for (const m of code.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?(?:TEMP(?:ORARY)?\s+)?TABLE\s+[\w.]+\s*\(([\s\S]*?)\)\s*;?/gi)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+/)[0]?.replace(/[`"]/g, '');
      if (name && IDENT.test(name)) columns.push(name);
    }
  }
  // 문자열·주석 제거 후 식별자 수집 (t.col 은 col)
  const body = code.replace(/--[^\n]*/g, ' ').replace(/'(?:[^']|'')*'/g, ' ');
  for (const m of body.matchAll(/(?:\b[A-Za-z_]\w*\.)?\b([A-Za-z_]\w*)\b(?!\s*\()/g)) {
    const w = m[1];
    if (!SQL_WORDS.has(w.toLowerCase()) && !tables.includes(w)) columns.push(w);
  }
  // 별칭(AS x)과 한 글자 테이블 별칭은 컬럼 후보에서 뺌
  const aliases = new Set([...body.matchAll(/\bAS\s+([A-Za-z_]\w*)/gi)].map((m) => m[1]));
  for (const m of body.matchAll(/\b(?:FROM|JOIN)\s+[\w.]+\s+(?:AS\s+)?([A-Za-z_]\w*)/gi)) aliases.add(m[1]);
  return { tables: uniq(tables), columns: uniq(columns.filter((c) => !aliases.has(c) && c.length > 1)) };
}

function pyInfo(code) {
  const frames = [];
  const columns = [];
  const body = code.replace(/#[^\n]*/g, ' ');
  // df = pd.read_csv(...), df = something.merge(...)
  for (const m of body.matchAll(/^\s*([A-Za-z_]\w*)\s*=\s*(?:pd\.(?:read_\w+|DataFrame)|[A-Za-z_]\w*\s*[[.])/gm)) frames.push(m[1]);
  // x['col'] / x[['a', 'b']]
  for (const m of body.matchAll(/([A-Za-z_]\w*)\s*\[\s*\[?\s*((?:['"][^'"]+['"]\s*,?\s*)+)\]?\s*\]/g)) {
    frames.push(m[1]);
    for (const c of m[2].matchAll(/['"]([^'"]+)['"]/g)) columns.push(c[1]);
  }
  // groupby('a') / groupby(['a','b']) / sort_values('x') / on='k' / columns=[...] / usecols=[...] / values=, index=
  for (const m of body.matchAll(/(?:groupby|sort_values|drop_duplicates|value_counts|nlargest|nsmallest|set_index|pivot_table|melt)\s*\(\s*\[?([^)]*?)\]?\s*[,)]/g)) {
    for (const c of m[1].matchAll(/['"]([^'"]+)['"]/g)) columns.push(c[1]);
  }
  for (const m of body.matchAll(/\b(?:on|left_on|right_on|by|columns|usecols|values|index|subset|id_vars|value_vars)\s*=\s*(\[[^\]]*\]|['"][^'"]+['"])/g)) {
    for (const c of m[1].matchAll(/['"]([^'"]+)['"]/g)) columns.push(c[1]);
  }
  // DataFrame({'col': ...}) / rename(columns={'a': 'b'}) / agg(name=('col', 'sum'))
  for (const m of body.matchAll(/['"]([A-Za-z_][\w ]*)['"]\s*:/g)) columns.push(m[1]);
  for (const m of body.matchAll(/=\s*\(\s*['"]([^'"]+)['"]\s*,/g)) columns.push(m[1]);
  // df.col (메서드가 아닌 속성 접근)
  for (const m of body.matchAll(/\b([A-Za-z_]\w*)\.([A-Za-z_]\w*)\b(?!\s*\()/g)) {
    if (frames.includes(m[1]) && !PY_WORDS.has(m[2])) columns.push(m[2]);
  }
  const fr = uniq(frames).filter((f) => !PY_WORDS.has(f) || f === 'df');
  return { tables: fr, columns: uniq(columns.filter((c) => c && !fr.includes(c))) };
}

/** CSV/탭 구분 헤더나 "컬럼: a, b, c" 형태의 목록 */
function headerInfo(code) {
  const first = code.trim().split('\n')[0];
  if (/^[A-Za-z_][\w ]*([,\t|][A-Za-z_][\w ]*){1,}$/.test(first.trim())) {
    return first.split(/[,\t|]/).map((s) => s.trim()).filter((s) => IDENT.test(s));
  }
  const m = code.match(/(?:컬럼|columns?|열)\s*[:：]\s*([^\n]+)/i);
  if (m) return m[1].split(/[,\s]+/).map((s) => s.trim().replace(/[`'"]/g, '')).filter((s) => IDENT.test(s));
  return [];
}

/** 질문 문장 속 영문 식별자 (si_do_name, sales_qty …) — 컬럼일 가능성이 높음 */
export function questionIdents(question) {
  const out = [];
  for (const m of question.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) {
    const w = m[0];
    if (w.length < 2 || /^(sql|pandas|df|top|sum|avg|count|max|min|mean|by|and|or|the|of|in|group|order|join|select|where|python|csv|id)$/i.test(w)) continue;
    out.push({ word: w, index: m.index });
  }
  return out;
}

/**
 * @returns {{lang: 'sql'|'pandas'|null, tables: string[], columns: string[]}}
 */
export function extractContext(code) {
  const text = code || '';
  const lang = detectLang(text);
  const header = headerInfo(text);
  let info = { tables: [], columns: [] };
  if (lang === 'sql') info = sqlInfo(text);
  else if (lang === 'pandas') info = pyInfo(text);
  return { lang, tables: info.tables, columns: uniq([...header, ...info.columns]) };
}
