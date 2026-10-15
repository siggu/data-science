// 질문하기 엔진: 질문 + (선택) 코드 → 레시피와 빈칸을 규칙으로 해석 → SQL/pandas 코드
// 서버·API 없이 브라우저 안에서만 동작합니다. (2단계에서 Jev 같은 판단 모델을 붙일 수 있게
// 해석 결과를 recipe/slots 구조로 분리해 두었습니다.)
import { extractContext, questionIdents } from './extract.js';
import { AGG_CUES, DATE_UNITS, CUES, SYNONYMS, DATE_COL, NUM_COL, KEY_COL } from './lexicon.js';
import { RECIPES, RECIPE_BY_ID } from './recipes.js';
import { TABLES } from '../config.js';
import { REF_LANGS } from '../data/reference.js';

const SAMPLE = Object.fromEntries(TABLES.map((t) => [t.name, t.columns]));
const DATE_UNIT_WORDS = /^(월|일|주|연도|년도|년|연|분기|시간|시간대|요일|일자|날짜|하루|달)$/;
const PARTICLES = /(의|를|을|이|가|은|는|에서|에|로|으로|와|과|도|만|별|마다)$/;
/** 끝의 조사를 떼되, 남는 말이 2자 이상일 때만 (시도 → 시 방지) */
const stripP = (w) => { const m = w.match(PARTICLES); return m && w.length - m[0].length >= 2 ? w.slice(0, -m[0].length) : w; };
/** 질문 속 영문 식별자를 같은 길이의 기호로 가림 — total_amount 의 total, discount 의 count 가 집계어로 잡히지 않게 */
const maskIdents = (q) => q.replace(/[A-Za-z_][A-Za-z0-9_]*/g, (w) => (/^(sum|avg|mean|count|max|min|median|total|top|bottom|by|distinct|rank|pivot|join|rolling|null|nan|rate)$/i.test(w) ? w : '§'.repeat(w.length)));
const STOP_KO = new Set(['구하', '구해', '구하는', '방법', '알려', '보여', '계산', '뽑아', '어떻게', '코드', '데이터', '테이블', '컬럼', '값', '기준', '전체', '각', '모든', '해주', '주세요', '싶어', '정렬', '상위', '하위', '가장', '합계', '평균', '개수', '최대', '최소', '중앙값', '누적', '비율', '비중', '순위', '이동', '결측', '중복', '조인', '피벗', '구간', '조건', '이상', '이하', '초과', '미만', '포함', '최근', '이전', '대비', '증감']);

const uniq = (a) => [...new Set(a.filter(Boolean))];

function koNumber(numStr, unit) {
  const n = parseFloat(numStr.replace(/,/g, ''));
  return n * ({ 천: 1e3, 만: 1e4, 억: 1e8 }[unit] || 1);
}

/** 문맥 정보: 테이블 이름, DataFrame 이름, 컬럼 후보 */
function buildContext(question, code) {
  const ex = extractContext(code);
  const qIds = questionIdents(question).map((x) => x.word);
  let tables = ex.tables;
  // 질문/코드에 샘플 테이블 이름이 나오면 그 컬럼을 사용 (사이트 샘플 데이터로 바로 실행 가능)
  const mentionedSample = uniq([...tables, ...qIds]).filter((w) => SAMPLE[w]);
  // 질문에 직접 적은 샘플 테이블이 코드에 없으면, 질문의 테이블을 우선
  const askedSample = qIds.filter((w) => SAMPLE[w] && !tables.includes(w));
  if (askedSample.length) tables = uniq([...askedSample, ...tables]);
  else if (!tables.length && mentionedSample.length) tables = mentionedSample;
  // 질문이 샘플 테이블을 직접 가리키면 붙여 넣은 코드의 컬럼은 쓰지 않음 (다른 데이터 이야기)
  let columns = askedSample.length ? [] : ex.columns;
  for (const t of askedSample.length ? askedSample : mentionedSample) columns = uniq([...columns, ...SAMPLE[t]]);
  const tableSet = new Set(tables);
  const identCols = qIds.filter((w) => !tableSet.has(w) && !SAMPLE[w]);
  return { lang: ex.lang, tables, columns, identCols, mentionedSample };
}

function makeResolver(ctx, assumptions) {
  const lower = new Map(ctx.columns.map((c) => [c.toLowerCase(), c]));
  return function resolve(word, { prefer } = {}) {
    if (!word) return null;
    const w = stripP(word);
    if (!w) return null;
    if (/^[A-Za-z_]\w*$/.test(w)) {
      if (lower.has(w.toLowerCase())) return lower.get(w.toLowerCase());
      if (ctx.tables.includes(w) || SAMPLE[w]) return null;
      // 코드에 없는 영문 식별자 → 사용자가 질문에 직접 적은 컬럼으로 봄
      return w;
    }
    if (!/[가-힣]/.test(w) || STOP_KO.has(w) || DATE_UNIT_WORDS.test(w)) return null;
    for (const [re, frags] of SYNONYMS) {
      if (!re.test(w)) continue;
      const pool = prefer ? ctx.columns.filter((c) => prefer.test(c)) : [];
      for (const f of frags) {
        const hit = [...pool, ...ctx.columns].find((c) => c.toLowerCase() === f) || [...pool, ...ctx.columns].find((c) => c.toLowerCase().includes(f));
        if (hit) return hit;
      }
      if (!ctx.columns.length) {
        assumptions.push(`'${w}'에 해당하는 컬럼을 몰라 \`${frags[0]}\`로 가정했습니다. 실제 컬럼 이름으로 바꾸세요.`);
        return frags[0];
      }
      return null;
    }
    return null;
  };
}

/** "A와 B별", "A, B 기준" 덩어리에서 단어 목록 */
function splitKeys(chunk) {
  return chunk.split(/\s*(?:,|\/|및|and)\s*|(?<=[\w가-힣])(?:와|과|하고)\s+|\s+/).map((s) => s.trim()).filter(Boolean);
}

/** 앞쪽 텍스트에서 마지막 단어 (조사 제거) */
function lastWord(text) {
  const m = text.match(/([A-Za-z_]\w*|[가-힣]+)\s*$/);
  return m ? stripP(m[1]) : null;
}
/** 앞쪽 단어들을 뒤에서부터 (최대 n개) */
function prevWords(text, n = 3) {
  return [...text.matchAll(/[A-Za-z_]\w*|[가-힣]+/g)].map((m) => stripP(m[0])).slice(-n).reverse();
}
function nextWord(text) {
  const m = text.match(/^\s*(?:of\s+)?([A-Za-z_]\w*|[가-힣]+)/);
  return m ? stripP(m[1]) : null;
}

const AGG_WORD = /^(합계|합|평균|개수|갯수|수|건수|총액|총합|최대|최소|최댓값|최솟값)$/;

function parseFilters(q, resolve, ctx) {
  const out = [];
  const used = new Set();
  const val = (raw) => {
    const t = raw.replace(/^['"‘“]|['"’”]$/g, '');
    return /^-?\d[\d,]*(\.\d+)?$/.test(t) ? Number(t.replace(/,/g, '')) : t;
  };
  // 기간: col이 A부터 B까지 / A ~ B
  const dr = q.match(/(\d{4}-\d{2}-\d{2})\s*(?:~|부터|에서|-|and)\s*(\d{4}-\d{2}-\d{2})/);
  if (dr) {
    const dcol = ctx.columns.find((c) => DATE_COL.test(c)) || 'date';
    out.push({ col: dcol, op: 'between', value: dr[1], value2: dr[2] });
    used.add(dr.index);
  }
  // 비교: col >= 10 / col이 10000 이상
  for (const m of q.matchAll(/([A-Za-z_]\w*|[가-힣]+?)\s*(?:이|가|은|는)?\s*(>=|<=|!=|<>|==|=|>|<)\s*(['"]?[\w.\-가-힣]+['"]?)/g)) {
    const col = resolve(m[1]);
    if (!col) continue;
    out.push({ col, op: { '==': '=', '<>': '!=' }[m[2]] || m[2], value: val(m[3]) });
  }
  for (const m of q.matchAll(/([A-Za-z_]\w*|[가-힣]+?)\s*(?:이|가|은|는|의\s*값이)?\s*(-?\d[\d,]*(?:\.\d+)?)\s*(만|천|억)?\s*(?:원|개|건|명|회)?\s*(이상|초과|이하|미만|보다\s*(?:큰|많은|작은|적은))/g)) {
    const op = { 이상: '>=', 초과: '>', 이하: '<=', 미만: '<' }[m[4]] || (/큰|많은/.test(m[4]) ? '>' : '<');
    if (AGG_WORD.test(stripP(m[1]))) { out.push({ col: null, op, value: koNumber(m[2], m[3]), _agg: true }); continue; }
    const col = resolve(m[1], { prefer: NUM_COL });
    if (!col) continue;
    out.push({ col, op, value: koNumber(m[2], m[3]) });
  }
  // 같음: status가 completed인 / status = 'completed' / 'KR'인 country
  for (const m of q.matchAll(/([A-Za-z_]\w*|[가-힣]+?)\s*(?:이|가|은|는|컬럼이|값이)\s*['"‘“]?([A-Za-z0-9_\-.가-힣]+?)['"’”]?\s*(?:인|이고|일\s*때|이면|만|인\s*것|인\s*행|이\s*아닌|가\s*아닌|아닌)/g)) {
    const col = resolve(m[1]);
    if (!col || /^\d/.test(m[2]) && /이상|이하|초과|미만/.test(q.slice(m.index, m.index + m[0].length + 4))) continue;
    if (STOP_KO.has(m[2]) || /^(null|nan|없|비어)/i.test(m[2])) continue;
    if (out.some((f) => f.col === col)) continue;
    const neg = /아닌/.test(m[0]);
    out.push({ col, op: neg ? '!=' : '=', value: val(m[2]) });
  }
  // 포함: name에 'abc'가 포함된 / 'abc'를 포함하는
  for (const m of q.matchAll(/([A-Za-z_]\w*|[가-힣]+?)\s*(?:에|이|가)\s*['"‘“]([^'"’”]+)['"’”]\s*(?:가|이|을|를)?\s*(?:포함|들어간|들어가)/g)) {
    const col = resolve(m[1]);
    if (col) out.push({ col, op: 'contains', value: m[2] });
  }
  return out;
}

/** 질문에서 특징을 뽑습니다 */
function features(q, ctx, resolve, assumptions) {
  const f = {};
  const qm = maskIdents(q);
  // 그룹 기준
  const keys = [];
  for (const m of q.matchAll(/((?:[A-Za-z_]\w*|[가-힣]+)(?:\s*(?:,|\/|및|and|와|과)\s*(?:[A-Za-z_]\w*|[가-힣]+))*)\s*(?:별로|별|마다|기준으로|기준|단위로|에\s*따른|당)(?![가-힣])/g)) {
    for (const w of splitKeys(m[1])) {
      const word = w.replace(/(와|과)$/, '');
      if (DATE_UNIT_WORDS.test(word)) continue;
      const c = resolve(word);
      if (c) keys.push(c);
    }
  }
  for (const m of q.matchAll(/\bby\s+([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)/gi)) for (const w of m[1].split(/\s*,\s*/)) { const c = resolve(w); if (c) keys.push(c); }
  for (const m of q.matchAll(/([A-Za-z_]\w*|[가-힣]+)\s*(?:으로|로)\s*(?:묶|그룹|그루핑)/g)) { const c = resolve(m[1]); if (c) keys.push(c); }
  f.keys = uniq(keys);

  // 집계 (여러 개 가능: "주문 수와 매출 합계")
  f.metrics = [];
  const taken = [];
  for (const [agg, re] of AGG_CUES) {
    const g = new RegExp(re.source, 'gi');
    for (const m of qm.matchAll(g)) {
      if (taken.some(([s, e]) => m.index < e && m.index + m[0].length > s)) continue;
      taken.push([m.index, m.index + m[0].length]);
      const before = q.slice(0, m.index).replace(/\s*(의|을|를|이|가|은|는)\s*$/, '');
      let col = null;
      for (const w of prevWords(before, 3)) {
        if (STOP_KO.has(w) || AGG_WORD.test(w)) continue;
        const c = resolve(w, { prefer: NUM_COL });
        if (c && !f.keys.includes(c)) { col = c; break; }
        if (c) break;
      }
      if ((!col || f.keys.includes(col)) && agg !== 'count') {
        const nw = nextWord(q.slice(m.index + m[0].length));
        const c2 = nw && resolve(nw, { prefer: NUM_COL });
        if (c2 && !f.keys.includes(c2)) col = c2;
      }
      if (col && f.keys.includes(col) && agg !== 'nunique') col = null;
      let a = agg;
      if (agg === 'count') {
        // "유저 수" 처럼 ID 컬럼의 수 → 고유 개수, 그 외 → 행 수
        if (col && KEY_COL.test(col) && /(user|customer|member|client|session|emp)/i.test(col)) a = 'nunique';
        else if (!(col && KEY_COL.test(col))) col = col && !NUM_COL.test(col) ? null : col;
        if (a === 'count' && col && KEY_COL.test(col)) col = null;
      }
      if (a !== 'count' && !col) {
        col = ctx.columns.find((c) => NUM_COL.test(c) && !f.keys.includes(c) && !KEY_COL.test(c)) || ctx.identCols.find((c) => !f.keys.includes(c)) || null;
        if (!col) { col = 'value'; assumptions.push(`${agg} 할 값 컬럼을 찾지 못해 \`value\`로 썼습니다.`); }
      }
      f.metrics.push({ agg: a, col: a === 'count' && !col ? null : col, at: m.index });
    }
  }
  f.metrics.sort((x, y) => x.at - y.at);
  f.metrics = f.metrics.filter((m, i, arr) => arr.findIndex((x) => x.agg === m.agg && x.col === m.col) === i).map(({ agg, col }) => ({ agg, col }));

  // 날짜 단위
  f.unit = (DATE_UNITS.find(([, re]) => re.test(qm)) || [])[0] || null;
  // "전월 대비" → 월, "전일 대비" → 일 …
  if (!f.unit) { const pu = q.match(/(전월|지난\s*달|전일|어제|전주|지난\s*주|전년|작년|전분기)/); if (pu) f.unit = { 전월: 'month', 전일: 'day', 어제: 'day', 전주: 'week', 전년: 'year', 작년: 'year', 전분기: 'quarter' }[pu[1].replace(/\s/g, '')] || (/달/.test(pu[1]) ? 'month' : 'week'); }
  const dateMention = q.match(/([가-힣]*(?:일|날짜|일자|시각|일시)|[A-Za-z_]\w*(?:date|_dt|_ts|_at)\w*)\s*(?:기준|으로|로)/i);
  f.dateCol = (dateMention && resolve(dateMention[1])) || ctx.columns.find((c) => DATE_COL.test(c)) || ctx.identCols.find((c) => DATE_COL.test(c)) || null;

  // 상위/하위 N
  const nm = q.match(/(?:상위|하위|top|bottom|최근)\s*(\d+)/i) || q.match(/(\d+)\s*(?:개|위|명|건|곳|등|가지)(?!\s*(?:이상|이하|초과|미만))/);
  f.n = nm ? parseInt(nm[1], 10) : null;
  f.top = CUES.top.test(qm);
  f.bottom = CUES.bottom.test(qm);
  f.order = f.bottom ? 'asc' : (f.top ? 'desc' : (/(내림차순|desc)/i.test(q) ? 'desc' : /(오름차순|asc)/i.test(q) ? 'asc' : null));
  const im = q.match(/(?:상위|하위|top|bottom)\s*\d*\s*(?:개|위|명|곳|가지)?\s*(?:의\s*)?([A-Za-z_]\w*|[가-힣]{2,})/i) || q.match(/가장\s*(?:많이|적게)\s*(?:팔린|산|주문된|쓴|구매한)\s*([A-Za-z_]\w*|[가-힣]{2,})/);
  f.item = im ? resolve(im[1]) : null;
  if (f.item && f.keys.includes(f.item)) f.item = null;

  f.filters = parseFilters(q, resolve, ctx);
  f.having = f.filters.find((x) => x._agg) || null;
  if (f.having && !f.having.col) f.having.col = f.metrics.find((m) => m.col)?.col || null;
  f.filters = f.filters.filter((x) => !x._agg).map(({ _agg, ...x }) => x);

  // 이동평균 창, 구간 경계
  const wm = q.match(/최근\s*(\d+)\s*(?:일|개|주|행)/) || q.match(/(\d+)\s*(?:일|개|행)\s*이동/);
  f.window = wm ? parseInt(wm[1], 10) : null;
  f.bins = [...q.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(만|천|억)?\s*(?:원)?(?=\s*(?:,|과|와|및|기준|단위|으로|로|씩|구간|이상|미만|\s|$))/g)]
    .map((m) => koNumber(m[1], m[2])).filter((x) => x > 0 && x !== f.n);

  // 조인
  const other = uniq([...ctx.tables.slice(1), ...ctx.mentionedSample.filter((t) => t !== ctx.tables[0])]);
  f.right = other[0] || null;
  const km = q.match(/([A-Za-z_]\w*|[가-힣]+)\s*(?:으로|로|를\s*키로|기준으로|키로)\s*(?:조인|join|합치|붙이|merge|연결)/i);
  f.key = (km && resolve(km[1])) || ctx.columns.find((c) => KEY_COL.test(c) && (!f.right || (SAMPLE[f.right] || []).includes(c))) || null;
  f.how = /(inner|교집합|둘\s*다|공통|양쪽\s*모두\s*있)/i.test(q) ? 'inner' : /(full|outer|모두\s*남|전부\s*남|합집합)/i.test(q) ? 'outer' : 'left';

  // 피벗: "행은 A, 열은 B" / "B를 열로"
  const pr = q.match(/행(?:은|에)?\s*([A-Za-z_]\w*|[가-힣]+).*?열(?:은|에)?\s*([A-Za-z_]\w*|[가-힣]+)/);
  const pc = q.match(/([A-Za-z_]\w*|[가-힣]+?)\s*(?:을|를|값을)?\s*(?:열로|컬럼으로|가로로)/);
  f.pivotIndex = pr ? resolve(pr[1]) : null;
  f.pivotCols = pr ? resolve(pr[2]) : (pc ? resolve(pc[1]) : null);

  // 결측 처리 방식
  f.nullMode = CUES.fill.test(q) ? 'fill' : (CUES.drop.test(q) ? 'drop' : 'count');
  const fv = q.match(/(-?\d+(?:\.\d+)?|['"][^'"]+['"])\s*(?:으로|로)\s*(?:채우|채워|대체|바꿔)/);
  f.fillValue = fv ? fv[1].replace(/^['"]|['"]$/g, '') : 0;
  if (typeof f.fillValue === 'string' && /^-?\d+(\.\d+)?$/.test(f.fillValue)) f.fillValue = Number(f.fillValue);

  // 언급된 컬럼 전체 (질문 순서)
  f.mentioned = uniq([...q.matchAll(/[A-Za-z_]\w*|[가-힣]{2,}/g)].map((m) => resolve(m[0])).filter(Boolean));
  return f;
}

/** 레시피별 점수와 빈칸 */
function scoreRecipes(q, f, ctx) {
  const c = CUES;
  const qm = maskIdents(q);
  const has = (re) => re.test(qm);
  const anyCol = (re) => ctx.columns.find((x) => re.test(x)) || ctx.identCols.find((x) => re.test(x));
  const valueCol = f.metrics.find((m) => m.col)?.col || f.mentioned.find((x) => NUM_COL.test(x) && !f.keys.includes(x)) || f.mentioned.find((x) => !f.keys.includes(x) && !KEY_COL.test(x) && !DATE_COL.test(x)) || anyCol(NUM_COL);
  const orderCol = f.dateCol || anyCol(DATE_COL);
  const metrics = f.metrics.length ? f.metrics : null;
  const pivotValue = f.metrics.find((m) => m.col)?.col || f.mentioned.find((x) => NUM_COL.test(x) && !f.keys.includes(x)) || null;
  const out = [];
  const add = (id, score, slots) => out.push({ recipe: id, score, slots: { filters: f.filters, ...slots } });

  if (f.unit && (metrics || has(c.count_rows)) && !has(c.running) && !has(c.lag) && !has(c.moving)) {
    add('date_agg', 4.5, { dateCol: f.dateCol || 'date', unit: f.unit, metrics: metrics || [{ agg: 'count', col: null }], keys: f.keys });
  }
  if (has(c.moving)) add('moving_avg', 5, { orderCol: orderCol || 'date', value: valueCol || 'value', window: f.window || 7, unit: f.unit || (/최근\s*\d+\s*일|\d+\s*일\s*이동/.test(q) ? 'day' : null), dateCol: f.dateCol || orderCol || 'date', keys: f.keys, metrics: f.metrics.filter((m) => m.agg !== 'mean') });
  if (has(c.running)) add('running_total', 5, { orderCol: orderCol || 'date', value: valueCol || 'value', keys: f.unit ? [] : f.keys, unit: f.unit, dateCol: f.dateCol || orderCol || 'date', metrics: f.metrics.length ? f.metrics : null });
  if (has(c.lag)) add('lag_diff', 4.2, { orderCol: orderCol || 'date', value: valueCol || 'value', keys: f.unit ? [] : f.keys, unit: f.unit, dateCol: f.dateCol || orderCol || 'date', metrics: f.metrics.length ? f.metrics : null });
  if (has(c.share)) add('share', 4.6, { keys: f.keys.length ? f.keys : [f.mentioned.find((x) => !NUM_COL.test(x)) || 'category'], value: valueCol || null });
  if (has(c.pivot)) add('pivot', 5, { index: f.pivotIndex || f.keys[0] || f.mentioned[0] || 'row_key', columns: f.pivotCols || f.keys[1] || f.mentioned.find((x) => x !== (f.pivotIndex || f.keys[0]) && !NUM_COL.test(x)) || 'col_key', value: pivotValue, agg: f.metrics[0]?.agg || (pivotValue ? 'sum' : 'count') });
  if (has(c.join)) add('join', 5, { right: f.right || 'other_table', key: f.key || 'id', how: f.how });
  if (has(c.bucket) && !has(c.pivot)) add('bucket', 4.2, { value: valueCol || 'value', bins: f.bins });
  if (has(c.null)) add('null_handle', 4.6, { col: f.mentioned.find((x) => !STOP_KO.has(x)) || null, mode: f.nullMode, fillValue: f.fillValue });
  if (has(c.dedupe) && !f.metrics.some((m) => m.agg === 'nunique')) add('dedupe', 4.3, { cols: f.mentioned.filter((x) => !DATE_COL.test(x)), orderCol: /(최신|최근|마지막|latest)/.test(q) ? orderCol : null });
  if (has(c.rank) && !(f.keys.length && f.top && f.n)) add('rank', 4.4, { value: valueCol || 'value', keys: f.keys, order: f.order || 'desc' });
  if (has(c.rate) && !has(c.share)) {
    const cond = f.filters.find((x) => x.op === '=' || x.op === '!=' || x.op === 'contains') || f.filters[0];
    const flagCol = anyCol(/(converted|is_|flag|yn$|여부)/i);
    if (cond || flagCol) add('cond_rate', cond ? 4.4 : 3.6, { keys: f.keys, cond: cond || { col: flagCol, op: '=', value: 1 }, filters: f.filters.filter((x) => x !== cond) });
  }
  if (f.keys.length && f.top && (f.item || /(별|마다)\s*(?:로\s*)?(?:각각\s*)?(?:상위|top|가장)/i.test(q))) {
    add('top_n_per_group', f.item ? 4.8 : 4.0, { keys: f.keys, item: f.item, value: valueCol || 'value', agg: f.metrics[0]?.agg || 'sum', limit: f.n || 3 });
  }
  if (f.keys.length && f.having) add('having', 4.9, { keys: f.keys, metrics: metrics || [{ agg: 'sum', col: f.having.col }], having: { op: f.having.op, value: f.having.value } });
  if (f.keys.length) {
    const s = metrics ? 4.2 : (has(c.count_rows) ? 3.2 : 2.2);
    add('group_agg', s, { keys: f.keys, metrics: metrics || [{ agg: 'count', col: null }], order: f.top || f.bottom ? f.order : null, limit: f.n });
  } else if (metrics) {
    // 그룹 없이 집계 + 상위 N → 그룹 대상이 문장에 있는 경우 ("매출 상위 5개 상품")
    if ((f.top || f.bottom) && f.item) add('group_agg', 3.8, { keys: [f.item], metrics, order: f.order, limit: f.n || 5 });
    add('total_agg', 3.4, { metrics });
  }
  if ((f.top || f.bottom || has(c.sort)) && !f.keys.length) add('sort_limit', f.item && metrics ? 3 : 3.5, { value: valueCol || 'value', order: f.order || 'desc', limit: f.n });
  if (has(c.distinct) && !f.metrics.length) add('distinct', 3.8, { cols: f.mentioned.length ? [f.mentioned[0]] : [] });
  if (f.filters.length) add('filter', has(c.filter) && !metrics && !f.keys.length ? 4 : 2.8, { cols: [] });
  if (has(c.count_rows) && !f.keys.length && !metrics) add('total_agg', 3.0, { metrics: [{ agg: 'count', col: null }] });
  return out.sort((a, b) => b.score - a.score).filter((x, i, arr) => arr.findIndex((y) => y.recipe === x.recipe) === i);
}

/** 레퍼런스에서 관련 문법 찾기 (규칙으로 못 풀 때 안내) */
// 레퍼런스 검색용 동의어 (한국어 개념어 → 문서에 나오는 영문 키워드)
const REF_SYNONYMS = {
  윈도우: ['window', 'over', 'partition'], 조인: ['join', 'merge'], 피벗: ['pivot'], 결측: ['null', 'missing', 'na'],
  중복: ['duplicate', 'distinct'], 정렬: ['order by', 'sort'], 날짜: ['date', 'dt'], 문자열: ['string', 'str'],
  순위: ['rank'], 누적: ['cum', 'running'], 집계: ['group by', 'agg'], 그룹: ['group by', 'groupby'], 서브쿼리: ['subquery'],
  정규식: ['regex', 'regexp'], 형변환: ['cast', 'astype'], 타입: ['cast', 'astype', 'dtype'], 이동평균: ['rolling', 'moving'],
  배열: ['array', 'list', 'explode'], 백분위: ['percentile', 'quantile'], 중앙값: ['median'], 합치: ['union', 'concat', 'merge'],
};
const REF_STOP = new Set(['구하', '방법', '알려', '어떻게', '주세요', '싶어', '코드', '뭔가요', '무엇', '뭐예요', '뭐야', '사용', '하는', '있나요']);

export function searchReference(question, lang) {
  const raw = uniq([...question.matchAll(/[A-Za-z_]{3,}|[가-힣]{2,}/g)].map((m) => stripP(m[0].toLowerCase())));
  const words = uniq(raw.filter((w) => w.length >= 2 && !REF_STOP.has(w))
    .flatMap((w) => [w, ...Object.entries(REF_SYNONYMS).filter(([k]) => w.includes(k)).flatMap(([, v]) => v)]));
  // 질문 언어를 먼저, 다른 언어도 함께 검색
  const langs = [...REF_LANGS].sort((a, b) => (a.id === lang ? -1 : b.id === lang ? 1 : 0));
  return langs.flatMap((L, li) => L.items.map((it) => {
    const title = `${it.title} ${it.summary}`.toLowerCase();
    const body = `${it.body} ${it.syntax}`.toLowerCase();
    const score = words.reduce((s, w) => s + (title.includes(w) ? 3 : 0) + (body.includes(w) ? 1 : 0), 0) - li * 0.5;
    return { lang: L.id, id: it.id, title: it.title, summary: it.summary, score };
  })).filter((x) => x.score > 0.5).sort((a, b) => b.score - a.score).slice(0, 5);
}

/**
 * 질문 해석
 * @returns {{lang, table, df, columns, candidates, best, confidence, assumptions, refs}}
 */
export function understand(question, code = '', { lang: langPref } = {}) {
  const q = question.trim();
  const ctx = buildContext(q, code);
  const assumptions = [];
  const resolve = makeResolver(ctx, assumptions);
  const f = features(q, ctx, resolve, assumptions);
  let lang = langPref && langPref !== 'auto' ? langPref : null;
  if (!lang) lang = /(pandas|판다스|파이썬|python|데이터\s*프레임|dataframe|\bdf\b)/i.test(q) ? 'pandas' : /(sql|쿼리|query)/i.test(q) ? 'sql' : ctx.lang || 'sql';
  const table = ctx.tables[0] || null;
  const candidates = scoreRecipes(q, f, ctx);
  const best = candidates[0] || null;
  const second = candidates[1];
  let confidence = 'low';
  if (best) confidence = best.score >= 4 && (!second || best.score - second.score >= 0.6) ? 'high' : best.score >= 3 ? 'medium' : 'low';
  if (!table) assumptions.push(lang === 'sql' ? '테이블 이름을 찾지 못해 `t`로 썼습니다.' : 'DataFrame 이름을 찾지 못해 `df`로 썼습니다.');
  return {
    question: q, lang, table, df: table || 'df', sqlTable: table || 't',
    columns: uniq([...ctx.columns, ...ctx.identCols]), sample: ctx.mentionedSample,
    candidates, best, confidence, assumptions: uniq(assumptions),
    refs: searchReference(q, lang),
  };
}

/** 레시피 + 빈칸 → 코드 (화면에서 빈칸을 바꿔 다시 만들 때도 사용) */
export function build(recipeId, slots, info) {
  const r = RECIPE_BY_ID[recipeId];
  const out = r.build(slots, { table: info.sqlTable, df: info.df }, info.columns);
  return { ...out, recipe: r, notes: out.notes || [] };
}

export { RECIPES };
