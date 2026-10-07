// 자동 완성 순위 테스트:  node tests/test_completion.mjs
import assert from 'node:assert/strict';

globalThis.localStorage = { getItem: () => null, setItem: () => {} };
const c = await import(new URL('../web/assets/js/completion.js', import.meta.url));

c.setSchema([
  { name: 'users', columns: [{ name: 'user_id', type: 'BIGINT' }, { name: 'signup_date', type: 'DATE' }, { name: 'channel', type: 'VARCHAR' }] },
  { name: 'orders', columns: [{ name: 'order_id', type: 'BIGINT' }, { name: 'user_id', type: 'BIGINT' }, { name: 'order_ts', type: 'TIMESTAMP' }, { name: 'total_amount', type: 'BIGINT' }] },
]);
const top = (r) => r.list[0]?.text;
const texts = (r) => r.list.map((x) => x.text);

// SQL
assert.equal(top(c.sqlCandidates('SELECT * FROM or')), 'orders', 'FROM 뒤에는 테이블 우선');
assert.deepEqual(texts(c.sqlCandidates('SELECT o.', ' FROM orders o JOIN users u USING (user_id)')), ['order_id', 'user_id', 'order_ts', 'total_amount'], '별칭 뒤에는 해당 테이블 컬럼만');
assert.deepEqual(texts(c.sqlCandidates('SELECT u.ch', ' FROM users u')), ['channel']);
assert.equal(top(c.sqlCandidates('SELECT tot', ' FROM orders')), 'total_amount', '쿼리에서 쓰는 테이블의 컬럼 우선');
assert.equal(top(c.sqlCandidates('select coun', ' from orders')), 'COUNT');
assert.ok(texts(c.sqlCandidates('SELECT * FROM orders WHERE ', '')).slice(0, 3).includes('user_id'), '같은 이름 컬럼은 높은 점수로 유지');
assert.ok(texts(c.sqlCandidates('SELECT dense', '')).includes('DENSE_RANK'));
assert.equal(c.sqlCandidates('WITH t AS (SELECT 1) SELECT * FROM ', '').list[0].text, 't', 'CTE 이름도 테이블 후보');

// Python / pandas
assert.equal(top(c.pyCandidates('orders.gr', '')), 'groupby');
assert.equal(top(c.pyCandidates("orders['to", '')), 'total_amount', "df['… 안에서는 컬럼");
assert.ok(texts(c.pyCandidates('orders["order_ts"].dt.', '')).includes('year'), '.dt 뒤에는 날짜 메서드');
assert.ok(texts(c.pyCandidates('s.str.', '')).includes('contains'), '.str 뒤에는 문자열 메서드');
assert.equal(top(c.pyCandidates('pd.to_d', '')), 'to_datetime');
assert.equal(top(c.pyCandidates('rev', 'revenue = orders.total_amount.sum()\n')), 'revenue', '내가 만든 변수');
assert.equal(top(c.pyCandidates('done.', 'done = orders\n')), 'head', '입력 없을 때 자주 쓰는 메서드 먼저');

// 점수 함수
assert.ok(c.matchScore('signup_date', 'sig') > c.matchScore('signup_date', 'date'), '접두 일치 > 단어 경계 일치');
assert.ok(c.matchScore('order_ts', 'ot') > 0, '이니셜 일치');
assert.equal(c.matchScore('channel', 'xyz'), -1);

console.log('completion: 모든 테스트 통과');
