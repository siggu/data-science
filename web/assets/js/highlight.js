// 코드 블록 문법 강조 (SQL · Python) — 외부 라이브러리 없이 가벼운 토크나이저로 처리
// 색은 에디터와 같은 팔레트(style.css 의 .tok-*)를 사용합니다.
import { escapeHtml } from './util.js';

const SQL_KW = new Set(`
select from where and or not in is null like ilike between as on join inner left right full outer cross semi anti
natural using group by having order asc desc nulls first last limit offset distinct all union intersect except
case when then else end with recursive over partition rows range unbounded preceding following current row window
qualify pivot unpivot for insert into values update set delete create replace table view temp temporary drop alter
add column if exists primary merge matched cast try_cast interval true false filter within lateral exclude
rollup cube grouping sets returning default describe explain show optimize zorder vacuum restore version timestamp
date time day days month months year years hour hours minute minutes second seconds week weeks quarter
`.trim().split(/\s+/));
const SQL_CONST = new Set(['null', 'true', 'false']);
// 키워드지만 괄호가 붙으면 함수인 이름 (month(ts), left(s, 3), cast(x AS INT) …)
const SQL_KW_FN = new Set('cast try_cast replace left right date time timestamp year month day hour minute second week quarter if grouping'.split(' '));
// 괄호가 바로 붙지 않아도 함수로 보이는 이름 (타입 등)
const SQL_TYPES = new Set('int integer bigint smallint double float decimal numeric varchar string text boolean bool date timestamp'.split(' '));

const PY_KW = new Set(`
and as assert async await break class continue def del elif else except finally for from global if import in is
lambda nonlocal not or pass raise return try while with yield match case
`.trim().split(/\s+/));
const PY_CONST = new Set(['True', 'False', 'None']);
const PY_BUILTIN = new Set('print len range list dict set tuple int float str bool sum min max abs round sorted enumerate zip map filter isinstance type display open any all reversed'.split(' '));

const span = (cls, text) => `<span class="tok-${cls}">${escapeHtml(text)}</span>`;

function tokenize(src, rules) {
  let out = '';
  let i = 0;
  let prev = ''; // 직전 의미 있는 토큰 (속성 접근 판단용)
  outer: while (i < src.length) {
    for (const [re, fn] of rules) {
      re.lastIndex = i;
      const m = re.exec(src);
      if (m && m.index === i) {
        out += fn(m[0], src, i + m[0].length, prev);
        if (m[0].trim()) prev = m[0];
        i += m[0].length;
        continue outer;
      }
    }
    out += escapeHtml(src[i]);
    if (src[i].trim()) prev = src[i];
    i++;
  }
  return out;
}

const nextChar = (src, j) => { while (src[j] === ' ') j++; return src[j]; };

const SQL_RULES = [
  [/--[^\n]*/y, (t) => span('com', t)],
  [/\/\*[\s\S]*?\*\//y, (t) => span('com', t)],
  [/'(?:[^']|'')*'?/y, (t) => span('str', t)],
  [/"(?:[^"]|"")*"?|`[^`]*`?/y, (t) => span('id', t)],
  [/\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/iy, (t) => span('num', t)],
  [/[A-Za-z_][\w$]*/y, (t, src, j, prev) => {
    const lw = t.toLowerCase();
    if (prev === '.') return escapeHtml(t); // t.col
    if (SQL_CONST.has(lw)) return span('const', t);
    const call = nextChar(src, j) === '(';
    if (SQL_KW.has(lw) && !(call && SQL_KW_FN.has(lw))) return span('kw', t);
    if (call) return span('fn', t);
    if (SQL_TYPES.has(lw)) return span('fn', t);
    return escapeHtml(t);
  }],
  [/::|<=|>=|<>|!=|\|\||->>|->|[=<>+\-*/%]/y, (t) => span('op', t)],
];

const PY_RULES = [
  [/#[^\n]*/y, (t) => span('com', t)],
  [/[rbfuRBFU]{0,2}("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?)/y, (t) => span('str', t)],
  [/@[A-Za-z_][\w.]*/y, (t) => span('fn', t)],
  [/\d+(?:_\d+)*(?:\.\d+)?(?:e[+-]?\d+)?\b/iy, (t) => span('num', t)],
  [/[A-Za-z_]\w*/y, (t, src, j, prev) => {
    if (PY_CONST.has(t)) return span('const', t);
    if (PY_KW.has(t) && prev !== '.') return span('kw', t);
    const call = nextChar(src, j) === '(';
    if (prev === '.') return call ? span('fn', t) : span('attr', t);
    if (call || PY_BUILTIN.has(t)) return span('fn', t);
    return escapeHtml(t);
  }],
  [/==|!=|<=|>=|\*\*|\/\/|[=<>+\-*/%&|~]/y, (t) => span('op', t)],
];

/** lang: 'sql' | 'python' — 강조된 HTML 문자열 */
export function highlight(code, lang) {
  if (lang === 'sql') return tokenize(code, SQL_RULES);
  if (lang === 'python') return tokenize(code, PY_RULES);
  return escapeHtml(code);
}

/** data-lang 값 → 강조 언어 ('sql-syntax' 처럼 실행하지 않는 틀도 포함) */
export function hlLang(lang) {
  const l = (lang || '').toLowerCase().replace(/-syntax$/, '');
  if (l === 'sql') return 'sql';
  if (l === 'python' || l === 'py' || l === 'pandas') return 'python';
  return '';
}
