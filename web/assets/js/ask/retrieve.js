// 질문하기 RAG: 문법 레퍼런스(SQL 50 · pandas 52 항목)에서 질문과 관련된 항목을 골라 프롬프트에 넣습니다.
// 임베딩 없이 키워드 + 한국어→영문 동의어로 점수를 매겨, 프롬프트에는 관련 항목 몇 개만 넣어 토큰을 줄입니다.
import { REF_LANGS } from '../data/reference.js';
import { TABLES } from '../config.js';

// 한국어 표현 → 레퍼런스 문서에 나오는 키워드
const SYNONYMS = [
  [/(별|마다|기준으로|그룹|묶)/, ['group by', 'groupby', '집계']],
  [/(합계|합|총합|총액|더한)/, ['sum', '집계']],
  [/(평균)/, ['avg', 'mean']],
  [/(개수|갯수|건수|몇\s*개|몇\s*명|수)/, ['count', 'nunique']],
  [/(고유|중복\s*없이|distinct|유니크|종류)/, ['distinct', 'nunique', 'unique']],
  [/(상위|하위|top|가장|제일|순서|정렬)/, ['order by', 'limit', 'sort_values', 'nlargest']],
  [/(그룹별\s*상위|별\s*상위|씩)/, ['row_number', 'qualify', 'rank']],
  [/(순위|랭킹|등수)/, ['rank', 'dense_rank']],
  [/(일별|주별|월별|분기|연도별|요일|추이|날짜|기간|월간|주간)/, ['date_trunc', 'to_period', 'dt.', '날짜']],
  [/(누적)/, ['cumsum', 'running', 'unbounded']],
  [/(전월|전일|전날|전주|대비|증감|증가율|이전)/, ['lag', 'shift', 'pct_change', 'diff']],
  [/(이동\s*평균|롤링|rolling)/, ['rolling', 'rows between']],
  [/(비중|점유율|비율|전환율|퍼센트|%)/, ['ratio', 'over', 'transform', 'conditional']],
  [/(조인|join|합치|붙이|붙여|merge|연결)/, ['join', 'merge']],
  [/(피벗|pivot|가로로|옆으로\s*펼|열로)/, ['pivot', 'pivot_table', 'crosstab']],
  [/(결측|null|nan|비어|빠진\s*값|누락)/, ['null', 'coalesce', 'isna', 'fillna', 'dropna']],
  [/(중복|겹치)/, ['distinct', 'drop_duplicates', 'duplicated', 'row_number']],
  [/(구간|등급|나누|분위|bin)/, ['case when', 'cut', 'qcut', 'ntile']],
  [/(조건|필터|이상|이하|초과|미만|사이|인\s*것|만\s*보)/, ['where', 'between', 'boolean', 'query']],
  [/(포함|들어간|like)/, ['like', 'contains', 'str']],
  [/(문자열|글자|대소문자|자르|치환)/, ['string', 'str', 'replace', 'substring']],
  [/(형\s*변환|타입|숫자로|문자로)/, ['cast', 'astype', 'to_numeric']],
  [/(서브쿼리|하위\s*쿼리|cte|with)/i, ['subquery', 'cte', 'with']],
  [/(윈도우|over|partition)/i, ['window', 'over', 'partition']],
  [/(케이스|조건\s*분기|라벨|case)/i, ['case when', 'np.where', 'np.select']],
  [/(합집합|union|이어\s*붙)/i, ['union', 'concat']],
];
// 의도가 분명한 표현 → 꼭 보여줄 레퍼런스 항목 (가산점)
const BOOSTS = [
  [/(일별|주별|월별|분기별|연도별|년별|요일별|시간별|추이|월간|주간)/, ['sql:date-trunc-extract', 'pandas:dt-accessor']],
  [/(별|마다|기준으로|안에서).*(상위|하위|top|가장|제일|\d+\s*(개|명|건)\s*씩)/i, ['sql:ranking', 'sql:qualify', 'pandas:nlargest', 'pandas:rank']],
  [/(순위|랭킹|등수)/, ['sql:ranking', 'pandas:rank']],
  [/(피벗|pivot|가로로|옆으로\s*펼|열로\s*펼)/i, ['sql:pivot', 'pandas:pivot-table']],
  [/(조인|join|합치|붙이|붙여|merge)/i, ['sql:left-join', 'sql:inner-join', 'pandas:merge']],
  [/(누적)/, ['sql:running-moving', 'pandas:cumulative']],
  [/(이동\s*평균|롤링|rolling)/i, ['sql:running-moving', 'pandas:rolling']],
  [/(전월|전일|전날|전주|전년|대비|증감)/, ['sql:lag-lead', 'pandas:shift-diff']],
  [/(비중|점유율|구성비)/, ['sql:window-basics', 'pandas:transform']],
  [/(구간|등급|분위)/, ['sql:case-when', 'pandas:cut-qcut']],
  [/(결측|null|nan|빠진\s*값|비어)/i, ['sql:null-handling', 'pandas:missing']],
  [/(중복|겹치)/, ['sql:distinct', 'pandas:duplicates']],
  [/(별|마다|기준으로).*(합|평균|개수|수|최대|최소)/, ['sql:group-by', 'pandas:groupby-agg']],
];

const STOP = new Set(['구하', '구해', '방법', '알려', '어떻게', '주세요', '싶어', '코드', '뭔가요', '무엇', '사용', '하는', '있나요', '보여', '뽑아', '이', '그', '저', '좀']);

const items = REF_LANGS.flatMap((L) => L.items.map((it) => ({
  lang: L.id, it,
  head: `${it.id} ${it.title} ${it.summary}`.toLowerCase(),
  body: `${it.body} ${it.syntax} ${it.tips || ''}`.toLowerCase(),
})));

// 샘플 테이블·컬럼 이름은 문법과 상관없으므로 검색어에서 뺌 (orders, status 가 예제에 많이 나와 엉뚱한 항목이 오르는 것 방지)
const SCHEMA_WORDS = new Set(TABLES.flatMap((t) => [t.name, ...t.columns]).map((w) => w.toLowerCase()));

/**
 * 질문에서 검색어 목록 — [단어, 가중치]
 * @param {string[]} exclude  붙여 넣은 코드에서 찾은 컬럼·테이블 이름 (검색어에서 제외)
 */
export function queryTerms(question, exclude = []) {
  const skip = new Set([...SCHEMA_WORDS, ...exclude.map((w) => w.toLowerCase())]);
  const words = [...question.matchAll(/[A-Za-z_][A-Za-z_.]{2,}|[가-힣]{2,}/g)]
    .map((m) => m[0].toLowerCase()).filter((w) => !STOP.has(w) && !skip.has(w) && !/_/.test(w));
  const syn = SYNONYMS.filter(([re]) => re.test(question)).flatMap(([, v]) => v);
  const out = new Map(words.map((w) => [w, 1]));
  for (const s of syn) out.set(s, 1.5); // 동의어(문법 키워드)는 더 강하게
  return [...out];
}

/**
 * 관련 레퍼런스 상위 k개 (언어별)
 * @param {string} question
 * @param {{lang?: 'sql'|'pandas'|null, k?: number, exclude?: string[]}} opts  lang 이 정해지면 그 언어만, 아니면 SQL·pandas 각각 k개
 */
export function retrieve(question, { lang = null, k = 3, exclude = [] } = {}) {
  const terms = queryTerms(question, exclude);
  const boosted = new Set(BOOSTS.filter(([re]) => re.test(question)).flatMap(([, ids]) => ids));
  const scored = items.map((x) => {
    const score = terms.reduce((s, [t, w]) => s + w * ((x.head.includes(t) ? 3 : 0) + (x.body.includes(t) ? 1 : 0)), 0)
      + (boosted.has(`${x.lang}:${x.it.id}`) ? 20 : 0)
      + (x.it.tier === 'core' ? 0.5 : 0); // 같은 점수면 자주 쓰는 문법 우선
    return { ...x, score };
  }).filter((x) => x.score >= 2);
  const langs = lang ? [lang] : ['sql', 'pandas'];
  return langs.flatMap((l) => scored.filter((x) => x.lang === l).sort((a, b) => b.score - a.score).slice(0, k))
    .map(({ lang: l, it, score }) => ({ lang: l, id: it.id, title: it.title, score }));
}

const find = (lang, id) => REF_LANGS.find((l) => l.id === lang)?.items.find((i) => i.id === id);

/** 프롬프트에 넣을 레퍼런스 발췌 (문법 + 첫 예제만, 짧게) */
export function refSnippet(lang, id) {
  const it = find(lang, id);
  if (!it) return '';
  const ex = it.examples?.[0]?.code?.trim() || '';
  return `[${lang}:${id}] ${it.title} — ${it.summary}\n문법:\n${it.syntax.trim()}\n예제:\n${ex.length > 700 ? `${ex.slice(0, 700)}\n…` : ex}`;
}

/** 시스템 프롬프트용 전체 목차 (id와 제목만) — 모델이 used_refs 에 실제 id 를 쓰도록 */
export function catalog() {
  return REF_LANGS.map((L) => `${L.name}: ${L.items.map((it) => `${L.id}:${it.id} (${it.title})`).join(' | ')}`).join('\n');
}

export function refExists(key) {
  const [lang, id] = String(key).split(':');
  return !!find(lang, id);
}
export function refTitle(key) {
  const [lang, id] = String(key).split(':');
  return find(lang, id)?.title || key;
}
