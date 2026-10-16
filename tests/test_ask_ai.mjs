// 질문하기(AI) 단위 테스트 — API 를 호출하지 않고 요청 구성 · 응답 해석 · 레퍼런스 검색(RAG)을 검사합니다.
//   node tests/test_ask_ai.mjs
import assert from 'node:assert/strict';
import { buildRequest, parseAnswer, usesOnlySampleTables, costOf, keyProblem, MODEL } from '../web/assets/js/ask/ai.js';
import { retrieve } from '../web/assets/js/ask/retrieve.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ok  ${name}`); };
const keys = (refs) => refs.map((r) => `${r.lang}:${r.id}`);

test('요청: Haiku 5.5, JSON 스키마 출력, 시스템 프롬프트 캐시, 샘플링 파라미터 없음', () => {
  const { params } = buildRequest({ question: 'orders에서 payment_method별 total_amount 합계' });
  assert.equal(params.model, 'claude-haiku-5-5');
  assert.equal(MODEL, 'claude-haiku-5-5');
  assert.equal(params.output_config.format.type, 'json_schema');
  assert.equal(params.output_config.effort, 'low');
  assert.deepEqual(params.thinking, { type: 'adaptive' });
  assert.equal(params.system[0].cache_control.type, 'ephemeral');
  assert.ok(params.system[0].text.includes('sql:group-by'), '시스템 프롬프트에 레퍼런스 목차');
  for (const k of ['temperature', 'top_p', 'top_k']) assert.ok(!(k in params));
  const schema = params.output_config.format.schema;
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual([...schema.required].sort(), Object.keys(schema.properties).sort());
});

test('요청: 샘플 테이블을 언급하면 스키마를, 붙여 넣은 코드가 있으면 컬럼 목록을 넣음', () => {
  const a = buildRequest({ question: 'orders에서 status별 주문 수' });
  assert.ok(a.params.messages[0].content.includes('orders(order_id, user_id, order_ts, status'));
  assert.deepEqual(a.sampleTables, ['orders']);
  const code = "import pandas as pd\ndf = pd.read_csv('sales.csv')\ndf[['si_do_name', 'sales_qty']].head()";
  const b = buildRequest({ question: '이 코드에서 si_do_name별 sales_qty 합을 구하는 방법', code });
  const content = b.params.messages[0].content;
  assert.ok(content.includes('<code>') && content.includes('si_do_name') && content.includes('컬럼: si_do_name, sales_qty'));
  assert.deepEqual(b.sampleTables, []);
});

test('요청: 언어 선택 시 해당 언어 레퍼런스만', () => {
  const { refs, params } = buildRequest({ question: '채널별 매출 합계', lang: 'pandas' });
  assert.ok(refs.length && refs.every((r) => r.lang === 'pandas'));
  assert.ok(params.messages[0].content.includes('pandas 만'));
});

test('요청: 너무 긴 코드는 자르지 않고 줄여 달라고 안내', () => {
  assert.throws(() => buildRequest({ question: 'x별 합계', code: 'a'.repeat(20001) }), /너무 깁니다/);
  assert.throws(() => buildRequest({ question: '   ' }), /질문을 입력/);
});

test('RAG: 질문에 맞는 레퍼런스를 고름', () => {
  assert.ok(keys(retrieve('si_do_name별 sales_qty 합을 구하는 방법')).includes('sql:group-by'));
  assert.ok(keys(retrieve('si_do_name별 sales_qty 합을 구하는 방법')).includes('pandas:groupby-agg'));
  assert.ok(keys(retrieve('윈도우 함수로 그룹 안 순위')).some((k) => ['sql:window-basics', 'sql:ranking'].includes(k)));
  assert.ok(keys(retrieve('결측값 0으로 채우기')).includes('pandas:missing'));
  assert.ok(keys(retrieve('두 테이블 조인')).some((k) => /join|merge/.test(k)));
  assert.ok(keys(retrieve('월별 매출 추이')).some((k) => /date|dt-accessor|resample/.test(k)));
  assert.equal(retrieve('점심 메뉴 추천').length, 0);
});

test('응답 해석: JSON → 답변, 없는 레퍼런스 id 는 버림', () => {
  const msg = { stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify({
    kind: 'code', title: '채널별 합계', explanation: '설명', sql: 'SELECT 1', pandas: 'result = df\nresult',
    used_refs: ['sql:group-by', 'sql:없는항목', 'pandas:groupby-agg'], assumptions: [],
  }) }] };
  const a = parseAnswer(msg);
  assert.equal(a.title, '채널별 합계');
  assert.deepEqual(a.usedRefs, ['sql:group-by', 'pandas:groupby-agg']);
});

test('응답 해석: 거절 · 길이 초과 · 형식 오류는 안내 메시지', () => {
  assert.throws(() => parseAnswer({ stop_reason: 'refusal', stop_details: { explanation: '정책' }, content: [] }), /거절/);
  assert.throws(() => parseAnswer({ stop_reason: 'max_tokens', content: [] }), /끊겼/);
  assert.throws(() => parseAnswer({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'not json' }] }), /형식/);
});

test('샘플 테이블만 쓰는 SQL 판별 (CTE 제외)', () => {
  assert.equal(usesOnlySampleTables('SELECT * FROM orders o JOIN users u ON o.user_id = u.user_id'), true);
  assert.equal(usesOnlySampleTables('WITH t AS (SELECT * FROM orders) SELECT * FROM t'), true);
  assert.equal(usesOnlySampleTables('SELECT * FROM sales'), false);
  assert.equal(usesOnlySampleTables(''), false);
});

test('비용 계산 (Haiku 5.5: 입력 $0.10 · 출력 $0.50 / 100만 토큰)', () => {
  const c = costOf({ input_tokens: 1_000_000, output_tokens: 1_000_000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 });
  assert.equal(Number(c.usd.toFixed(6)), 0.6);
});

test('API 키 형식 검사 (공백·줄바꿈·한글이 섞이면 브라우저가 요청을 막으므로 저장 전에 거름)', () => {
  const good = `sk-ant-api03-${'aB3_-x'.repeat(16)}`;
  assert.equal(keyProblem(good), '');
  assert.match(keyProblem(''), /없습니다/);
  assert.match(keyProblem('api03-abc'), /sk-ant-/);
  assert.match(keyProblem(`${good.slice(0, 40)} ${good.slice(40)}`), /1개/);
  assert.match(keyProblem(`${good}\n`), /1개/);
  assert.match(keyProblem(`${good}ㅁ`), /1개/);
  assert.match(keyProblem('sk-ant-api03-short'), /짧습니다/);
});

console.log(`질문하기(AI): ${n}개 테스트 통과`);
