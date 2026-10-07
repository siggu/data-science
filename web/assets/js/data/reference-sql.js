// SQL 문법 레퍼런스 — 형식은 reference.js 주석 참고
// 예제는 DuckDB(+ compat.js 호환 매크로)로 실제 실행됩니다. Databricks와 다른 점은 dbx에 적습니다.
export const SQL_REF = [
  // ───────────────────────── core: 조회 기본 ─────────────────────────
  {
    id: 'select', tier: 'core', group: '조회 기본',
    title: 'SELECT · FROM · 별칭(AS)',
    summary: '테이블에서 원하는 컬럼을 골라 조회합니다.',
    body: `
      \`SELECT\` 뒤에 가져올 컬럼(또는 계산식)을, \`FROM\` 뒤에 테이블을 씁니다. \`AS\`로 결과 컬럼에 이름(별칭)을 붙일 수 있고, 계산식에는 별칭을 붙이는 습관을 들이세요.
      - \`*\`는 모든 컬럼입니다. 탐색할 때만 쓰고, 분석 쿼리에서는 필요한 컬럼만 적습니다.
      - 여러 테이블을 다룰 때는 \`FROM orders o\`처럼 테이블에도 별칭을 붙이고 \`o.user_id\`처럼 접두어를 씁니다.`,
    syntax: `SELECT col1, col2 AS alias, expr AS alias2
FROM table_name`,
    examples: [
      { title: '필요한 컬럼만, 계산 컬럼에 별칭', code: `SELECT order_id, user_id, total_amount,
       total_amount + discount_amount AS amount_before_discount
FROM orders
LIMIT 5` },
      { title: '일부 컬럼만 빼고 전부 (DuckDB EXCLUDE)', code: `SELECT * EXCLUDE (signup_date, marketing_opt_in)
FROM users
LIMIT 5` },
    ],
    tips: `
      - 별칭에 공백·한글을 쓰려면 큰따옴표로 감쌉니다: \`AS "결제 금액"\` (Databricks는 백틱)
      - 컬럼 기반 저장소(Parquet/Delta)에서는 필요한 컬럼만 읽을수록 빠르고 저렴합니다.
      - 문자열 값은 작은따옴표(\`'KR'\`)로 씁니다. 표준 SQL과 DuckDB에서 큰따옴표는 컬럼 이름(식별자)입니다.`,
    dbx: `특수문자가 들어간 식별자는 백틱(\`\` \`col name\` \`\`)으로 감쌉니다. 컬럼 제외는 DuckDB의 \`* EXCLUDE (...)\` 대신 \`* EXCEPT (...)\`를 씁니다.`,
    related: ['sql-01'],
  },
  {
    id: 'distinct', tier: 'core', group: '조회 기본',
    title: 'DISTINCT (중복 제거)',
    summary: '결과에서 중복된 행을 제거하고, COUNT(DISTINCT)로 고유 개수를 셉니다.',
    body: `
      \`SELECT DISTINCT\`는 결과 행 전체가 같은 경우 하나만 남깁니다. 컬럼이 여러 개면 **조합** 기준으로 중복을 판단합니다.
      "어떤 값들이 있는지" 훑어볼 때, 그리고 \`COUNT(DISTINCT col)\`로 **고유 유저 수**처럼 중복 없는 개수를 셀 때 씁니다.`,
    syntax: `SELECT DISTINCT col1, col2
FROM table_name

SELECT COUNT(DISTINCT col) FROM table_name`,
    examples: [
      { title: '채널 × 기기 조합 목록', code: `SELECT DISTINCT channel, device
FROM users
ORDER BY channel, device` },
      { title: '주문 건수 vs 구매자 수', code: `SELECT COUNT(*) AS orders,
       COUNT(DISTINCT user_id) AS buyers
FROM orders
WHERE status = 'completed'` },
      { title: 'DISTINCT는 NULL을 값으로 남기고, COUNT(DISTINCT)는 NULL을 뺀다', code: `SELECT (SELECT COUNT(*) FROM (SELECT DISTINCT coupon_code FROM orders)) AS distinct_rows,
       (SELECT COUNT(DISTINCT coupon_code) FROM orders) AS count_distinct` },
    ],
    tips: `
      - \`DISTINCT\`는 첫 번째 컬럼이 아니라 **SELECT한 컬럼 전체**에 걸립니다. \`SELECT DISTINCT a, b\`는 (a, b) 조합의 중복 제거입니다.
      - 조인 후 행이 불어난 것을 \`DISTINCT\`로 덮지 마세요. 원인(조인 키 중복)을 고치는 것이 먼저입니다.
      - \`COUNT(DISTINCT)\`는 큰 테이블에서 비쌉니다. 근사치로 충분하면 \`approx_count_distinct\`를 씁니다(부록 참고).`,
    related: ['sql-14'],
  },
  {
    id: 'where', tier: 'core', group: '조회 기본',
    title: 'WHERE · 비교 · AND / OR',
    summary: '조건에 맞는 행만 남깁니다.',
    body: `
      \`WHERE\` 뒤의 조건이 **참(TRUE)인 행만** 결과에 남습니다. 비교 연산자는 \`=\`, \`<>\`(또는 \`!=\`), \`<\`, \`<=\`, \`>\`, \`>=\`이고, \`AND\` · \`OR\` · \`NOT\`으로 조건을 묶습니다.
      - \`AND\`가 \`OR\`보다 먼저 계산됩니다. \`OR\`를 섞을 때는 항상 괄호를 칩니다.
      - 조건 결과가 NULL(알 수 없음)이면 그 행은 **제외**됩니다.`,
    syntax: `SELECT cols
FROM table_name
WHERE cond1 AND (cond2 OR cond3)`,
    examples: [
      { title: '완료된 30만 원 이상 주문', code: `SELECT order_id, user_id, payment_method, total_amount
FROM orders
WHERE status = 'completed' AND total_amount >= 300000
ORDER BY total_amount DESC
LIMIT 5` },
      { title: 'OR는 괄호로 묶기 — 간편결제 완료 주문 수', code: `SELECT COUNT(*) AS orders
FROM orders
WHERE status = 'completed'
  AND (payment_method = 'kakaopay' OR payment_method = 'naverpay')` },
      { title: '<> 비교는 NULL 행을 조용히 뺀다', code: `SELECT COUNT(*) AS not_welcome10,
       (SELECT COUNT(*) FROM orders
        WHERE coupon_code <> 'WELCOME10' OR coupon_code IS NULL) AS incl_no_coupon
FROM orders
WHERE coupon_code <> 'WELCOME10'` },
    ],
    tips: `
      - \`status = 'completed' AND method = 'a' OR method = 'b'\`는 \`(… AND method = 'a') OR method = 'b'\`로 해석됩니다. 괄호를 빼먹는 실수가 가장 흔합니다.
      - \`col <> 'X'\`는 col이 NULL인 행을 포함하지 않습니다. "X가 아닌 모든 행"이 필요하면 \`OR col IS NULL\`을 붙이세요.
      - \`WHERE\`에는 집계 함수(\`SUM\`, \`COUNT\`)를 쓸 수 없습니다. 집계 결과로 거르려면 \`HAVING\`을 씁니다.`,
    dbx: `Databricks SQL에서는 큰따옴표("abc")도 문자열 리터럴로 해석됩니다. 엔진 간 이식성을 위해 문자열은 항상 작은따옴표로 쓰세요.`,
    related: ['sql-02'],
  },
  {
    id: 'where-operators', tier: 'core', group: '조회 기본',
    title: 'IN · BETWEEN · LIKE · IS NULL',
    summary: '목록·범위·패턴·NULL 여부로 행을 거릅니다.',
    body: `
      자주 쓰는 조건 연산자들입니다.
      | 연산자 | 의미 | 예 |
      |---|---|---|
      | \`IN (…)\` | 목록 중 하나와 같음 | \`country IN ('KR', 'JP')\` |
      | \`BETWEEN a AND b\` | a 이상 **b 이하** (양 끝 포함) | \`price BETWEEN 10000 AND 50000\` |
      | \`LIKE\` | 패턴 일치 (\`%\` 0자 이상, \`_\` 정확히 1자) | \`product_name LIKE '%Pro'\` |
      | \`IS NULL\` / \`IS NOT NULL\` | 값이 비어 있는지 | \`coupon_code IS NULL\` |
      앞에 \`NOT\`을 붙여 \`NOT IN\`, \`NOT BETWEEN\`, \`NOT LIKE\`로 뒤집을 수 있습니다.`,
    syntax: `WHERE col IN ('a', 'b')
  AND col2 BETWEEN low AND high
  AND col3 LIKE 'pre%'
  AND col4 IS NOT NULL`,
    examples: [
      { title: '한국·일본 3월 가입자 (IN, BETWEEN)', code: `SELECT country, COUNT(*) AS signups
FROM users
WHERE country IN ('KR', 'JP')
  AND signup_date BETWEEN '2025-03-01' AND '2025-03-31'
GROUP BY country` },
      { title: "이름이 'Pro'로 끝나는 상품 (LIKE)", code: `SELECT product_id, product_name, category, price
FROM products
WHERE product_name LIKE '% Pro'
ORDER BY price DESC
LIMIT 5` },
      { title: '타임스탬프 BETWEEN 함정 — 3월 31일 낮 주문이 빠진다', code: `SELECT
  (SELECT COUNT(*) FROM orders
   WHERE order_ts BETWEEN '2025-03-01' AND '2025-03-31') AS between_cnt,
  (SELECT COUNT(*) FROM orders
   WHERE order_ts >= '2025-03-01' AND order_ts < '2025-04-01') AS half_open_cnt` },
    ],
    tips: `
      - 타임스탬프 컬럼에 \`BETWEEN '…-01' AND '…-31'\`을 쓰면 끝값이 \`31일 00:00:00\`이 되어 마지막 날이 거의 다 빠집니다. **\`>= 시작 AND < 다음날\`**(반열린 구간)을 쓰세요.
      - \`= NULL\`은 항상 NULL이라 아무 행도 안 나옵니다. 반드시 \`IS NULL\`을 씁니다.
      - \`NOT IN (서브쿼리)\`에 NULL이 하나라도 섞이면 결과가 **0행**이 됩니다. \`NOT EXISTS\`나 ANTI JOIN이 안전합니다.
      - \`LIKE\`는 대소문자를 구분합니다. 무시하려면 \`ILIKE\`나 \`LOWER(col) LIKE …\`를 씁니다.`,
    dbx: `Databricks도 \`ILIKE\`를 지원하며, 정규식 매칭은 \`RLIKE\`(= \`REGEXP\`)를 씁니다.`,
    related: ['sql-04', 'sql-16'],
  },
  {
    id: 'order-limit', tier: 'core', group: '조회 기본',
    title: 'ORDER BY · LIMIT',
    summary: '결과를 정렬하고 앞에서 n개만 가져옵니다.',
    body: `
      \`ORDER BY col [ASC|DESC]\`로 정렬하고(기본 ASC), \`LIMIT n\`으로 상위 n개만 남깁니다. 여러 컬럼을 쓰면 앞 컬럼이 같을 때 다음 컬럼으로 정렬합니다.
      - **Top N** 질문("매출 상위 10개 상품")은 \`ORDER BY … DESC LIMIT n\`입니다.
      - \`OFFSET k\`로 앞의 k개를 건너뛸 수 있고, \`NULLS FIRST / NULLS LAST\`로 NULL 위치를 정할 수 있습니다.
      - \`ORDER BY\`에는 SELECT의 별칭이나 위치 번호(\`ORDER BY 2\`)도 쓸 수 있습니다.`,
    syntax: `SELECT cols
FROM table_name
ORDER BY col1 DESC, col2 ASC NULLS LAST
LIMIT n OFFSET k`,
    examples: [
      { title: '결제 금액 상위 5건 (동점은 order_id로)', code: `SELECT order_id, user_id, total_amount
FROM orders
WHERE status = 'completed'
ORDER BY total_amount DESC, order_id
LIMIT 5` },
      { title: '카테고리별 가격 높은 순', code: `SELECT category, product_name, price
FROM products
ORDER BY category, price DESC
LIMIT 8` },
    ],
    tips: `
      - 동점이 있으면 \`LIMIT\` 결과가 실행할 때마다 달라질 수 있습니다. **보조 정렬 키**(id 등)를 넣어 결과를 결정적으로 만드세요.
      - \`ORDER BY\` 없는 \`LIMIT\`은 "아무 n개"입니다. 순서는 보장되지 않습니다.
      - 서브쿼리·CTE 안의 \`ORDER BY\`는 최종 결과 순서를 보장하지 않습니다. 정렬은 맨 바깥 쿼리에서 합니다.`,
    dbx: `NULL 기본 위치가 다릅니다. DuckDB는 ASC·DESC 모두 NULL이 마지막이고, Databricks는 ASC면 NULL이 처음, DESC면 마지막입니다. 중요하면 NULLS FIRST/LAST를 명시하세요.`,
    related: ['sql-01', 'sql-02'],
  },

  // ───────────────────────── core: 집계 ─────────────────────────
  {
    id: 'aggregate', tier: 'core', group: '집계',
    title: '집계 함수 (COUNT · SUM · AVG · MIN · MAX)',
    summary: '여러 행을 하나의 값으로 요약합니다.',
    body: `
      집계 함수는 여러 행을 받아 값 하나를 돌려줍니다. \`GROUP BY\` 없이 쓰면 테이블 전체가 한 그룹입니다.
      | 함수 | 의미 | NULL 처리 |
      |---|---|---|
      | \`COUNT(*)\` | 행 수 | NULL 행도 셈 |
      | \`COUNT(col)\` | col이 NULL이 아닌 행 수 | NULL 제외 |
      | \`COUNT(DISTINCT col)\` | 고유값 개수 | NULL 제외 |
      | \`SUM\` · \`AVG\` · \`MIN\` · \`MAX\` | 합계 · 평균 · 최솟값 · 최댓값 | NULL 무시 |`,
    syntax: `SELECT COUNT(*), COUNT(col), COUNT(DISTINCT col),
       SUM(col), AVG(col), MIN(col), MAX(col)
FROM table_name`,
    examples: [
      { title: '완료 주문 요약 지표', code: `SELECT COUNT(*) AS orders,
       COUNT(coupon_code) AS coupon_orders,
       COUNT(DISTINCT user_id) AS buyers,
       SUM(total_amount) AS revenue,
       AVG(total_amount) AS aov,
       MIN(order_ts) AS first_order,
       MAX(order_ts) AS last_order
FROM orders
WHERE status = 'completed'` },
      { title: 'COUNT(*) vs COUNT(col) — NULL은 세지 않는다', code: `SELECT COUNT(*) AS events,
       COUNT(product_id) AS events_with_product,
       COUNT(DISTINCT product_id) AS products_seen
FROM events` },
    ],
    tips: `
      - \`AVG(col)\`은 NULL을 **분모에서도 뺍니다**. NULL을 0으로 보고 평균내야 하면 \`AVG(COALESCE(col, 0))\`.
      - 행이 하나도 없으면 \`COUNT\`는 0이지만 \`SUM\`·\`AVG\`는 NULL입니다. 필요하면 \`COALESCE(SUM(x), 0)\`.
      - 집계 함수와 일반 컬럼을 함께 SELECT하려면 그 컬럼을 \`GROUP BY\`에 넣어야 합니다.`,
    related: ['sql-03'],
  },
  {
    id: 'group-by', tier: 'core', group: '집계',
    title: 'GROUP BY',
    summary: '같은 값끼리 묶어 그룹마다 집계합니다.',
    body: `
      \`GROUP BY\`에 적은 컬럼(또는 식)의 값이 같은 행끼리 묶고, 그룹마다 집계 함수를 계산합니다. "채널**별** 가입자 수", "월**별** 매출"처럼 "~별"이 나오면 GROUP BY입니다.
      - SELECT에는 **GROUP BY에 쓴 컬럼**과 **집계 함수**만 올 수 있습니다.
      - 위치 번호(\`GROUP BY 1, 2\`)나 식(\`GROUP BY date_trunc('month', order_ts)\`)으로도 묶을 수 있습니다.`,
    syntax: `SELECT key1, key2, AGG(col) AS alias
FROM table_name
GROUP BY key1, key2`,
    examples: [
      { title: '유입 채널별 가입자 수', code: `SELECT channel, COUNT(*) AS users
FROM users
GROUP BY channel
ORDER BY users DESC` },
      { title: '월별 완료 주문 수와 매출', code: `SELECT CAST(date_trunc('month', order_ts) AS DATE) AS month,
       COUNT(*) AS orders,
       SUM(total_amount) AS revenue
FROM orders
WHERE status = 'completed'
GROUP BY 1
ORDER BY 1
LIMIT 6` },
      { title: '두 컬럼으로 묶기 — 기기 × 마케팅 수신 동의', code: `SELECT device, marketing_opt_in, COUNT(*) AS users
FROM users
GROUP BY device, marketing_opt_in
ORDER BY device, marketing_opt_in` },
    ],
    tips: `
      - NULL도 하나의 그룹으로 묶입니다. 결과에 NULL 그룹이 보이면 원인(누락 데이터)을 확인하세요.
      - 고유 키(user_id 등)로 묶으면 행 수가 거의 줄지 않습니다. 묶는 단위(grain)가 질문과 맞는지 먼저 생각하세요.
      - DuckDB·Databricks는 \`GROUP BY\`에서 SELECT 별칭도 허용하지만, 표준 SQL은 아니므로 면접에서는 식이나 위치 번호를 쓰는 편이 안전합니다.`,
    related: ['sql-01', 'sql-08'],
  },
  {
    id: 'having', tier: 'core', group: '집계',
    title: 'HAVING',
    summary: '집계 결과(그룹)에 조건을 걸어 거릅니다.',
    body: `
      \`HAVING\`은 \`GROUP BY\`로 집계한 **뒤에** 그룹을 거릅니다. \`WHERE\`는 집계 **전에** 행을 거른다는 점이 다릅니다.
      - 행 조건(\`status = 'completed'\`)은 WHERE, 집계 조건(\`COUNT(*) >= 5\`)은 HAVING에 둡니다.
      - 한 쿼리에 둘 다 쓸 수 있습니다: WHERE로 행을 줄이고 → 묶고 → HAVING으로 그룹을 거릅니다.`,
    syntax: `SELECT key, AGG(col)
FROM table_name
WHERE row_condition
GROUP BY key
HAVING AGG(col) > value`,
    examples: [
      { title: '완료 주문 5회 이상인 헤비 유저', code: `SELECT user_id, COUNT(*) AS orders, SUM(total_amount) AS revenue
FROM orders
WHERE status = 'completed'
GROUP BY user_id
HAVING COUNT(*) >= 5
ORDER BY orders DESC, revenue DESC
LIMIT 10` },
      { title: '평균 주문 금액이 12만 원 이상인 결제수단', code: `SELECT payment_method, COUNT(*) AS orders, AVG(total_amount) AS aov
FROM orders
WHERE status = 'completed'
GROUP BY payment_method
HAVING AVG(total_amount) >= 120000` },
    ],
    tips: `
      - 집계와 무관한 조건을 HAVING에 두면 동작은 해도 불필요한 행까지 집계한 뒤 거르게 됩니다. 행 조건은 WHERE로 옮기세요.
      - 표준 SQL에서는 HAVING에서 SELECT 별칭을 쓸 수 없습니다. \`HAVING COUNT(*) >= 5\`처럼 집계식을 다시 쓰는 것이 어디서나 안전합니다.`,
    related: ['sql-02'],
  },
  {
    id: 'conditional-agg', tier: 'core', group: '집계',
    title: '조건부 집계 (SUM(CASE…) · COUNT_IF · FILTER)',
    summary: '한 번의 GROUP BY로 조건별 개수·합계·비율을 동시에 구합니다.',
    body: `
      집계 함수 안에 조건을 넣으면 그룹마다 "조건을 만족하는 행만" 집계할 수 있습니다. 퍼널·전환율·상태별 분포처럼 **여러 지표를 한 행에** 만들 때 핵심 패턴입니다.
      - \`SUM(CASE WHEN 조건 THEN 값 ELSE 0 END)\` — 어디서나 동작하는 표준 방식
      - \`COUNT_IF(조건)\` — 조건이 참인 행 수 (DuckDB, Databricks)
      - \`AGG(…) FILTER (WHERE 조건)\` — 표준 SQL의 집계 필터
      - \`AVG(CASE WHEN 조건 THEN 1.0 ELSE 0 END)\` — 조건을 만족하는 **비율**`,
    syntax: `SELECT key,
       SUM(CASE WHEN cond THEN col ELSE 0 END) AS sum_if,
       COUNT_IF(cond) AS cnt_if,
       COUNT(*) FILTER (WHERE cond) AS cnt_filter,
       AVG(CASE WHEN cond THEN 1.0 ELSE 0 END) AS rate
FROM table_name
GROUP BY key`,
    examples: [
      { title: '결제수단별 취소율과 완료 매출', code: `SELECT payment_method,
       COUNT(*) AS orders,
       COUNT_IF(status = 'cancelled') AS cancelled,
       AVG(CASE WHEN status = 'cancelled' THEN 1.0 ELSE 0 END) AS cancel_rate,
       SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END) AS completed_revenue
FROM orders
GROUP BY payment_method
ORDER BY orders DESC` },
      { title: '실험 그룹별 전환자 수와 전환율 (FILTER)', code: `SELECT experiment, variant,
       COUNT(*) AS users,
       COUNT(*) FILTER (WHERE converted = 1) AS converters,
       AVG(converted) AS cvr
FROM ab_test
GROUP BY experiment, variant
ORDER BY experiment, variant` },
      { title: '플랫폼별 이벤트 퍼널 (CASE로 피벗)', code: `SELECT platform,
       COUNT(DISTINCT CASE WHEN event_type = 'visit' THEN session_id END) AS visit,
       COUNT(DISTINCT CASE WHEN event_type = 'add_to_cart' THEN session_id END) AS cart,
       COUNT(DISTINCT CASE WHEN event_type = 'purchase' THEN session_id END) AS purchase
FROM events
GROUP BY platform
ORDER BY platform` },
    ],
    tips: `
      - \`COUNT(CASE WHEN 조건 THEN 1 ELSE 0 END)\`는 **모든 행**을 셉니다(0도 NULL이 아니니까). COUNT를 쓸 때는 \`ELSE\`를 빼서 NULL이 되게 하거나, \`SUM\`을 쓰세요.
      - 비율은 \`AVG(CASE … THEN 1.0 ELSE 0 END)\`로 구합니다. \`ELSE\`를 빼면 NULL이 분모에서 빠져 항상 1이 됩니다.
      - 분자·분모를 각각 따로 쿼리하지 말고 한 번에 집계하면 기준(필터)이 어긋날 일이 없습니다.`,
    dbx: `Databricks도 \`count_if\`와 \`FILTER (WHERE …)\`를 모두 지원합니다.`,
    related: ['sql-03', 'sql-12', 'sql-16', 'sql-17'],
  },

  // ───────────────────────── core: 조건·변환 ─────────────────────────
  {
    id: 'case-when', tier: 'core', group: '조건·변환',
    title: 'CASE WHEN',
    summary: '조건에 따라 다른 값을 돌려주는 SQL의 if-else입니다.',
    body: `
      \`CASE WHEN 조건 THEN 값 … ELSE 기본값 END\`는 위에서부터 조건을 검사해 **처음 참이 되는** THEN 값을 돌려줍니다. 구간 나누기(버킷팅), 라벨 붙이기, 조건부 집계에 씁니다.
      - 값 하나를 여러 값과 비교할 때는 \`CASE col WHEN 'a' THEN … END\` 단순형도 쓸 수 있습니다.
      - \`ELSE\`를 생략하면 어떤 조건도 맞지 않을 때 NULL입니다.`,
    syntax: `CASE
  WHEN cond1 THEN result1
  WHEN cond2 THEN result2
  ELSE default_result
END AS alias`,
    examples: [
      { title: '주문 금액 구간별 주문 수', code: `SELECT CASE
         WHEN total_amount >= 300000 THEN '3) 30만 원 이상'
         WHEN total_amount >= 100000 THEN '2) 10만~30만 원'
         ELSE '1) 10만 원 미만'
       END AS amount_band,
       COUNT(*) AS orders
FROM orders
WHERE status = 'completed'
GROUP BY 1
ORDER BY 1` },
      { title: '단순형 CASE — 기기를 웹/앱으로 묶기', code: `SELECT CASE device WHEN 'web' THEN 'web' ELSE 'app' END AS device_group,
       COUNT(*) AS users
FROM users
GROUP BY 1` },
    ],
    tips: `
      - 범위 조건은 **위에서부터** 검사하므로 큰 값(좁은 조건)부터 쓰세요. \`>= 100000\`을 먼저 쓰면 30만 원 이상도 거기에 걸립니다.
      - THEN 값들의 타입을 맞추세요. 숫자와 문자열을 섞으면 오류가 나거나 전부 문자열로 바뀝니다.
      - 정렬용 라벨은 \`'1) …'\`처럼 번호를 붙이거나, \`ORDER BY MIN(total_amount)\`처럼 원래 값으로 정렬합니다.`,
    related: ['sql-12', 'sql-20'],
  },
  {
    id: 'null-handling', tier: 'core', group: '조건·변환',
    title: 'NULL 처리 (COALESCE · NULLIF)',
    summary: 'NULL을 다른 값으로 바꾸고, 0으로 나누기를 막습니다.',
    body: `
      NULL은 "값이 없음/알 수 없음"이라 계산에 섞이면 결과도 NULL이 됩니다(\`1 + NULL = NULL\`).
      - \`COALESCE(a, b, …)\` — 처음으로 NULL이 아닌 값을 돌려줍니다. 결측을 기본값으로 채울 때 씁니다.
      - \`NULLIF(a, b)\` — a와 b가 같으면 NULL, 아니면 a. 분모에 써서 **0으로 나누기**를 막습니다: \`x / NULLIF(y, 0)\`
      - NULL 여부는 \`IS NULL\` / \`IS NOT NULL\`로만 확인합니다.`,
    syntax: `COALESCE(col, default_value)
numerator / NULLIF(denominator, 0)
col IS NULL / col IS NOT NULL`,
    examples: [
      { title: '쿠폰 미사용을 라벨로 채워 집계', code: `SELECT COALESCE(coupon_code, '(쿠폰 없음)') AS coupon,
       COUNT(*) AS orders
FROM orders
GROUP BY 1
ORDER BY orders DESC` },
      { title: '0으로 나누기 방지 — 결제수단별 환불/완료 비율', code: `SELECT payment_method,
       COUNT_IF(status = 'refunded') * 1.0
         / NULLIF(COUNT_IF(status = 'completed'), 0) AS refund_per_completed
FROM orders
GROUP BY payment_method
ORDER BY payment_method` },
      { title: 'LEFT JOIN 후 매칭 없는 값을 0으로', code: `SELECT u.channel,
       COUNT(*) AS users,
       SUM(COALESCE(o.total_amount, 0)) AS revenue
FROM users u
LEFT JOIN orders o ON u.user_id = o.user_id AND o.status = 'completed'
GROUP BY u.channel
ORDER BY revenue DESC` },
    ],
    tips: `
      - \`col = NULL\`, \`col <> NULL\`은 항상 NULL(거짓 취급)입니다. 반드시 \`IS NULL\`을 쓰세요.
      - 0으로 나누면 엔진마다 오류·NULL·Infinity 등 결과가 다릅니다. \`NULLIF(분모, 0)\`을 습관으로 들이세요.
      - \`COALESCE\`의 인자들은 타입이 같아야 합니다. 숫자 컬럼을 \`'없음'\` 같은 문자열로 채우면 오류가 납니다.`,
    dbx: `Databricks는 \`nvl(a, b)\`(= coalesce), \`nvl2\`, \`ifnull\`도 씁니다(이 사이트에서도 동작). ANSI 모드(기본)에서 0으로 나누면 오류가 나므로 \`try_divide(a, b)\`나 \`NULLIF\`를 씁니다.`,
    related: ['sql-03', 'sql-08', 'sql-13'],
  },
  {
    id: 'cast', tier: 'core', group: '조건·변환',
    title: 'CAST · 형 변환',
    summary: '값의 타입(숫자·문자열·날짜)을 바꿉니다.',
    body: `
      \`CAST(값 AS 타입)\`으로 타입을 바꿉니다. DuckDB와 Databricks는 \`값::타입\` 축약형도 지원합니다.
      - 자주 쓰는 타입: \`INTEGER\`/\`BIGINT\`, \`DOUBLE\`, \`DECIMAL(p, s)\`, \`VARCHAR\`(Databricks는 \`STRING\`), \`DATE\`, \`TIMESTAMP\`, \`BOOLEAN\`
      - 문자열 날짜를 날짜로(\`CAST('2025-03-01' AS DATE)\`), 타임스탬프를 날짜로(\`CAST(order_ts AS DATE)\`) 바꿀 때 가장 많이 씁니다.`,
    syntax: `CAST(expr AS type)
expr::type`,
    examples: [
      { title: '타임스탬프 → 날짜, 숫자 → 문자열', code: `SELECT order_id,
       order_ts,
       CAST(order_ts AS DATE) AS order_date,
       CAST(total_amount AS VARCHAR) || '원' AS amount_label
FROM orders
LIMIT 5` },
      { title: '비율 계산은 실수로 — 쿠폰 사용률', code: `SELECT payment_method,
       COUNT(coupon_code) AS coupon_orders,
       COUNT(*) AS orders,
       CAST(COUNT(coupon_code) AS DOUBLE) / COUNT(*) AS coupon_rate
FROM orders
GROUP BY payment_method
ORDER BY coupon_rate DESC` },
    ],
    tips: `
      - **정수 나눗셈**: DuckDB·Databricks는 \`/\`가 항상 실수(1/2 = 0.5)지만, PostgreSQL·SQL Server 등은 정수끼리 나누면 소수점을 버립니다(1/2 = 0). 어디서나 안전하게 \`* 1.0\`이나 CAST를 습관처럼 붙이세요. DuckDB의 정수 나눗셈은 \`//\`입니다.
      - 실수 → 정수 CAST는 엔진마다 다릅니다: DuckDB는 **반올림**(3.7 → 4), Databricks는 **버림**(3.7 → 3). 의도를 \`ROUND\`/\`FLOOR\`로 명시하세요.
      - 변환할 수 없는 값(\`CAST('abc' AS INTEGER)\`)은 오류가 납니다. NULL로 받고 싶으면 \`TRY_CAST\`(부록)를 씁니다.`,
    dbx: `문자열 타입은 \`STRING\`을 주로 씁니다. ANSI 모드(기본)에서는 잘못된 CAST가 오류를 내므로 \`try_cast\`를 함께 알아두세요.`,
    related: ['sql-03', 'sql-10'],
  },
  {
    id: 'numeric', tier: 'core', group: '조건·변환',
    title: '숫자 함수 (ROUND · FLOOR · CEIL · ABS)',
    summary: '반올림·버림·올림·절댓값과 비율 표시.',
    body: `
      - \`ROUND(x, n)\` 소수 n자리로 반올림, \`FLOOR(x)\` 내림, \`CEIL(x)\` 올림, \`ABS(x)\` 절댓값, \`x % y\` 나머지
      - 비율을 %로 보여줄 때는 \`ROUND(100.0 * 분자 / 분모, 1)\`처럼 **마지막에 한 번** 반올림합니다.
      - \`FLOOR(x / 단위) * 단위\`는 값을 일정 구간(가격대, 연령대)으로 묶을 때 씁니다.`,
    syntax: `ROUND(x, n)  FLOOR(x)  CEIL(x)  ABS(x)  x % y`,
    examples: [
      { title: '실험 전환율을 % 로 (소수 둘째 자리)', code: `SELECT experiment, variant,
       ROUND(100.0 * AVG(converted), 2) AS cvr_pct
FROM ab_test
GROUP BY experiment, variant
ORDER BY experiment, variant` },
      { title: '10만 원 단위 가격대별 상품 수', code: `SELECT CAST(FLOOR(price / 100000) AS INTEGER) * 100000 AS price_band,
       COUNT(*) AS products
FROM products
GROUP BY 1
ORDER BY 1` },
    ],
    tips: `
      - 중간 단계에서 반올림하면 오차가 누적됩니다. 계산은 원래 값으로 하고 표시 직전에만 반올림하세요.
      - 비율의 차이는 "%p(퍼센트포인트)"로 표현합니다. 10% → 12%는 2%p 증가, 상대적으로는 20% 증가입니다.`,
    related: ['sql-17'],
  },
  {
    id: 'string-funcs', tier: 'core', group: '조건·변환',
    title: '문자열 함수',
    summary: '대소문자·공백·자르기·바꾸기·이어붙이기 등 문자열 가공.',
    body: `
      로그·상품명·코드 값을 정리할 때 쓰는 함수들입니다. 위치는 **1부터** 셉니다.
      | 함수 | 설명 | 예 → 결과 |
      |---|---|---|
      | \`LOWER\` / \`UPPER\` | 소문자 / 대문자 | \`UPPER('kr')\` → \`'KR'\` |
      | \`TRIM\` | 앞뒤 공백 제거 | \`TRIM(' a ')\` → \`'a'\` |
      | \`CONCAT(a, b)\` | 이어붙이기 (연산자는 표 아래 참고) | \`CONCAT('A', '1')\` → \`'A1'\` |
      | \`SUBSTRING(s, 시작, 길이)\` | 부분 문자열 | \`SUBSTRING('2025-03-15', 1, 7)\` → \`'2025-03'\` |
      | \`REPLACE(s, 찾을, 바꿀)\` | 모두 바꾸기 | \`REPLACE('a-b', '-', '_')\` → \`'a_b'\` |
      | \`LENGTH(s)\` | 글자 수 | \`LENGTH('한글')\` → \`2\` |
      | \`SPLIT_PART(s, 구분자, n)\` | 구분자로 나눈 n번째 조각 | \`SPLIT_PART('a@b.com', '@', 2)\` → \`'b.com'\` |
      | \`LEFT(s, n)\` / \`RIGHT(s, n)\` | 앞 / 뒤 n글자 | \`LEFT('SUMMER20', 6)\` → \`'SUMMER'\` |
      이어붙이기 연산자는 파이프 두 개(\`||\`)입니다: \`category || '-' || product_id\``,
    syntax: `LOWER(s)  UPPER(s)  TRIM(s)  LENGTH(s)
s1 || s2   CONCAT(s1, s2)   CONCAT_WS(sep, s1, s2)
SUBSTRING(s, start, len)   REPLACE(s, from, to)   SPLIT_PART(s, sep, n)
s ILIKE 'pattern'`,
    examples: [
      { title: '상품명 가공', code: `SELECT product_name,
       UPPER(category) AS category_upper,
       SPLIT_PART(product_name, ' ', 1) AS first_word,
       REPLACE(product_name, ' ', '_') AS slug,
       LENGTH(product_name) AS name_len,
       category || '-' || product_id AS sku
FROM products
LIMIT 5` },
      { title: "대소문자 무시 검색 — 'pro'가 들어간 상품 (ILIKE)", code: `SELECT category, COUNT(*) AS products
FROM products
WHERE product_name ILIKE '%pro%'
GROUP BY category
ORDER BY products DESC` },
      { title: '앱 버전에서 메이저 버전 뽑기', code: `SELECT SPLIT_PART(app_version, '.', 1) AS major, COUNT(*) AS events
FROM events
WHERE platform <> 'web'
GROUP BY 1
ORDER BY 1` },
    ],
    tips: `
      - \`||\`는 피연산자 중 하나라도 NULL이면 결과가 NULL입니다. NULL을 건너뛰고 붙이려면 \`CONCAT_WS(구분자, …)\`를 씁니다.
      - 문자열 비교는 대소문자와 공백을 구분합니다. 조인 키·그룹 키로 쓰기 전에 \`LOWER(TRIM(col))\`로 정규화하세요.
      - 복잡한 패턴 추출은 정규식 함수(부록 '정규식')를 씁니다.`,
    dbx: `**\`concat\`의 NULL 처리가 다릅니다.** DuckDB의 \`concat\`은 NULL을 건너뛰지만 Databricks의 \`concat\`은 인자 하나라도 NULL이면 NULL을 돌려줍니다. \`concat_ws\`는 둘 다 NULL을 건너뜁니다. Databricks의 \`split(s, 정규식)\`은 배열을 돌려줍니다.`,
  },

  // ───────────────────────── core: 날짜·시간 ─────────────────────────
  {
    id: 'date-trunc-extract', tier: 'core', group: '날짜·시간',
    title: '날짜 자르기·추출 (CAST AS DATE · date_trunc · EXTRACT)',
    summary: '타임스탬프를 일·주·월 단위로 자르거나, 연·월·요일·시를 꺼냅니다.',
    body: `
      시계열 집계의 첫 단계는 타임스탬프를 원하는 단위로 맞추는 것입니다.
      - \`CAST(ts AS DATE)\` — 일 단위 (시각 제거)
      - \`date_trunc('month', ts)\` — 해당 단위의 시작 시점으로 자름 (\`'year'\`, \`'quarter'\`, \`'month'\`, \`'week'\`, \`'day'\`, \`'hour'\`)
      - \`EXTRACT(part FROM ts)\` 또는 \`year(ts)\`, \`month(ts)\`, \`day(ts)\`, \`hour(ts)\` — 숫자 하나를 꺼냄
      - \`dayofweek(ts)\` — 요일 번호 (이 사이트에서는 Databricks와 같게 **1=일요일 … 7=토요일**)`,
    syntax: `CAST(ts AS DATE)
date_trunc('month', ts)
EXTRACT(year FROM ts)   year(ts)  month(ts)  hour(ts)
dayofweek(ts)`,
    examples: [
      { title: '주(월요일 시작)별 주문 수', code: `SELECT CAST(date_trunc('week', order_ts) AS DATE) AS week_start,
       COUNT(*) AS orders
FROM orders
WHERE order_ts >= '2025-12-01'
GROUP BY 1
ORDER BY 1` },
      { title: '요일별 주문 수 (1=일요일)', code: `SELECT dayofweek(order_ts) AS dow,
       date_format(order_ts, 'E') AS day_name,
       COUNT(*) AS orders
FROM orders
GROUP BY 1, 2
ORDER BY 1` },
      { title: '시간대별 이벤트 수 (저녁 피크 확인)', code: `SELECT hour(event_ts) AS hr, COUNT(*) AS events
FROM events
GROUP BY 1
ORDER BY events DESC
LIMIT 5` },
    ],
    tips: `
      - \`date_trunc\`의 결과 타입은 엔진·단위에 따라 DATE 또는 TIMESTAMP입니다. 날짜로 확실히 쓰려면 \`CAST(date_trunc(…) AS DATE)\`로 감싸세요(조인·비교 시 타입 불일치 방지).
      - \`'week'\`는 ISO 기준으로 **월요일**에 시작합니다(DuckDB, Databricks 모두).
      - 요일 번호 체계가 제각각입니다: Databricks \`dayofweek\`는 1=일요일, DuckDB 기본 \`EXTRACT(dow …)\`는 0=일요일, \`isodow\`는 1=월요일. 결과에 요일 이름을 함께 찍어 확인하세요.`,
    dbx: `Databricks의 \`date_trunc('MONTH', ts)\`는 항상 TIMESTAMP를 돌려줍니다. 날짜가 필요하면 \`trunc(d, 'MM')\`(DATE 반환)이나 CAST를 씁니다. \`EXTRACT(DOW FROM ts)\`도 1=일요일입니다.`,
    related: ['sql-08', 'sql-10', 'sql-16'],
  },
  {
    id: 'date-arith', tier: 'core', group: '날짜·시간',
    title: '날짜 계산 (date_diff · datediff · INTERVAL)',
    summary: '두 날짜의 차이를 구하고, 날짜에 기간을 더하거나 뺍니다.',
    body: `
      - **차이**: DuckDB는 \`date_diff('day', 시작, 끝)\`, Databricks는 \`datediff(끝, 시작)\`(일 수). 이 사이트에서는 둘 다 쓸 수 있고, 단위를 주는 \`datediff('month', 시작, 끝)\`도 됩니다.
      - **더하기/빼기**: \`날짜 + INTERVAL 7 DAY\`, \`날짜 - INTERVAL 1 MONTH\`, \`date_add(날짜, 7)\`, \`add_months(날짜, 1)\`
      - 리텐션(가입 후 N일째), 재구매 간격, "최근 30일" 필터에 씁니다.`,
    syntax: `date_diff('day', start, end)        -- DuckDB
datediff(end, start)                -- Databricks (일 수)
datediff('month', start, end)
d + INTERVAL 7 DAY   date_add(d, 7)   add_months(d, 1)`,
    examples: [
      { title: '가입 후 며칠 만에 주문했나', code: `SELECT o.order_id, u.signup_date,
       CAST(o.order_ts AS DATE) AS order_date,
       datediff(o.order_ts, u.signup_date) AS days_since_signup,
       date_diff('day', u.signup_date, CAST(o.order_ts AS DATE)) AS same_in_duckdb
FROM orders o
JOIN users u ON o.user_id = u.user_id
ORDER BY o.order_id
LIMIT 5` },
      { title: '마지막 날 기준 최근 7일 주문', code: `SELECT CAST(order_ts AS DATE) AS dt, COUNT(*) AS orders
FROM orders
WHERE order_ts >= DATE '2025-12-31' - INTERVAL 6 DAY
GROUP BY 1
ORDER BY 1` },
      { title: '월말 + 1개월, 월 경계 차이', code: `SELECT DATE '2025-01-31' + INTERVAL 1 MONTH AS plus_interval,
       add_months(DATE '2025-01-31', 1) AS plus_add_months,
       DATE '2025-01-31' + 7 AS plus_7_days,
       datediff('month', DATE '2025-01-31', DATE '2025-02-01') AS month_diff` },
    ],
    tips: `
      - **인자 순서**가 함수마다 다릅니다: \`date_diff(unit, 시작, 끝)\` vs \`datediff(끝, 시작)\`. 순서를 바꾸면 부호가 뒤집힙니다.
      - DuckDB \`date_diff('month', …)\`는 **경계를 넘은 횟수**라 1/31 → 2/1도 1개월입니다. Databricks \`datediff(MONTH, …)\`/\`timestampdiff\`는 **꽉 찬 단위 수**라 0입니다. 코호트 "N개월차"는 보통 \`date_trunc\`한 월끼리 비교해 정의를 명확히 합니다.
      - 1/31 + 1개월은 2/31이 없어서 2/28이 됩니다. 월말 기준 계산은 결과를 꼭 확인하세요.
      - DuckDB에서 \`DATE + INTERVAL\`은 TIMESTAMP가 되고, \`DATE + 정수\`는 DATE를 유지합니다.`,
    dbx: `\`datediff(end, start)\`는 일 수, \`datediff(unit, start, end)\`(= \`timestampdiff\`)는 꽉 찬 단위 수를 돌려줍니다. 날짜 더하기는 \`date_add(d, n)\`, \`add_months(d, n)\`, \`d + INTERVAL 1 DAY\`를 씁니다.`,
    related: ['sql-14', 'sql-19'],
  },
  {
    id: 'date-format', tier: 'core', group: '날짜·시간',
    title: '날짜 포맷 (strftime · date_format · strptime)',
    summary: '날짜를 원하는 형태의 문자열로 바꾸거나, 문자열을 날짜로 읽습니다.',
    body: `
      - 날짜 → 문자열: DuckDB \`strftime(ts, '%Y-%m')\`, Databricks \`date_format(ts, 'yyyy-MM')\`
      - 문자열 → 날짜: DuckDB \`strptime(s, '%Y%m%d')\`, Databricks \`to_date(s, 'yyyyMMdd')\` / \`to_timestamp(s, fmt)\`
      - 이 사이트에서는 Databricks식 \`date_format\`도 자주 쓰는 포맷(\`yyyy-MM-dd\`, \`yyyy-MM\`, \`yyyyMMdd\`, \`HH\`, \`E\` 등)에 한해 동작합니다.`,
    syntax: `strftime(ts, '%Y-%m-%d %H:%M')       -- DuckDB
date_format(ts, 'yyyy-MM-dd HH:mm')   -- Databricks
strptime('20250315', '%Y%m%d')       -- DuckDB 문자열 → TIMESTAMP`,
    examples: [
      { title: '월 라벨로 주문 수 집계', code: `SELECT strftime(order_ts, '%Y-%m') AS ym,
       date_format(order_ts, 'yyyy-MM') AS ym_dbx_style,
       COUNT(*) AS orders
FROM orders
GROUP BY 1, 2
ORDER BY 1
LIMIT 6` },
      { title: '문자열을 날짜로 읽기', code: `SELECT strptime('20250315', '%Y%m%d') AS from_yyyymmdd,
       CAST(strptime('2025/03/15 21:30', '%Y/%m/%d %H:%M') AS DATE) AS as_date,
       CAST('2025-03-15' AS DATE) AS iso_string` },
    ],
    tips: `
      - 포맷 결과는 **문자열**입니다. 날짜 계산·범위 비교·조인에는 \`date_trunc\`나 DATE 타입을 쓰고, 포맷은 표시용으로 마지막에 적용하세요.
      - 대소문자를 헷갈리기 쉽습니다: DuckDB \`%m\` 월 / \`%M\` 분, Databricks \`MM\` 월 / \`mm\` 분.
      - \`'yyyy-MM-dd'\`(ISO) 형태의 문자열은 포맷 없이 \`CAST(… AS DATE)\`로 바로 읽힙니다.`,
    dbx: `Databricks는 Java 스타일 패턴(\`yyyy-MM-dd HH:mm:ss\`, 요일 \`E\`)을 씁니다. DuckDB의 \`%Y-%m-%d\` 스타일과 섞어 쓰지 않도록 주의하세요.`,
  },

  // ───────────────────────── core: 조인 ─────────────────────────
  {
    id: 'inner-join', tier: 'core', group: '조인',
    title: 'INNER JOIN',
    summary: '두 테이블에서 키가 일치하는 행끼리 붙입니다.',
    body: `
      \`JOIN … ON 조건\`(= \`INNER JOIN\`)은 양쪽 모두에 짝이 있는 행만 남깁니다. 주문에 유저 정보를 붙이거나, 주문 상세에 상품 카테고리를 붙일 때 씁니다.
      - 키 컬럼 이름이 같으면 \`USING (user_id)\`로 짧게 쓸 수 있고, 결과에 키 컬럼이 하나로 합쳐집니다.
      - 짝이 없는 행은 **사라집니다**. 빠지면 안 되는 쪽이 있다면 LEFT JOIN을 씁니다.`,
    syntax: `SELECT a.col, b.col
FROM table_a a
JOIN table_b b ON a.key = b.key

FROM table_a JOIN table_b USING (key)`,
    examples: [
      { title: '유입 채널별 완료 매출 (주문 + 유저)', code: `SELECT u.channel,
       COUNT(*) AS orders,
       SUM(o.total_amount) AS revenue
FROM orders o
JOIN users u ON o.user_id = u.user_id
WHERE o.status = 'completed'
GROUP BY u.channel
ORDER BY revenue DESC` },
      { title: '카테고리별 판매 수량 (USING)', code: `SELECT p.category, SUM(oi.quantity) AS units
FROM order_items oi
JOIN products p USING (product_id)
GROUP BY p.category
ORDER BY units DESC` },
    ],
    tips: `
      - 테이블 별칭을 붙이고 모든 컬럼에 접두어(\`o.\`, \`u.\`)를 쓰세요. 양쪽에 같은 이름의 컬럼이 있으면 모호하다는 오류가 납니다.
      - 조인 전후의 행 수(\`COUNT(*)\`)를 비교하는 습관을 들이세요. 줄었다면 짝 없는 행이, 늘었다면 키 중복이 있는 것입니다.
      - NULL 키는 어떤 값과도(NULL끼리도) 매칭되지 않습니다.`,
    related: ['sql-07', 'sql-08', 'sql-11'],
  },
  {
    id: 'left-join', tier: 'core', group: '조인',
    title: 'LEFT JOIN (ON vs WHERE 필터 위치)',
    summary: '왼쪽 테이블의 모든 행을 유지하고, 짝이 없으면 NULL로 채웁니다.',
    body: `
      \`A LEFT JOIN B\`는 A의 행을 **하나도 잃지 않고** B를 붙입니다. 짝이 없는 행은 B의 컬럼이 NULL입니다. "전체 유저 중 구매한 비율", "주문 없는 유저"처럼 **분모를 지켜야 하는** 분석에 필수입니다.
      - **오른쪽 테이블 조건은 ON에** 둡니다: \`ON u.user_id = o.user_id AND o.status = 'completed'\`
      - 같은 조건을 WHERE에 두면 NULL 행(짝 없는 유저)이 걸러져 사실상 INNER JOIN이 됩니다.
      - \`WHERE b.key IS NULL\`을 붙이면 "B에 없는 A"(ANTI JOIN)를 찾을 수 있습니다.`,
    syntax: `SELECT a.*, b.col
FROM table_a a
LEFT JOIN table_b b
  ON a.key = b.key
 AND b.filter_col = 'value'   -- 오른쪽 조건은 ON에`,
    examples: [
      { title: '채널별 구매 전환율 (전체 유저가 분모)', code: `SELECT u.channel,
       COUNT(DISTINCT u.user_id) AS users,
       COUNT(DISTINCT o.user_id) AS buyers,
       COUNT(DISTINCT o.user_id) * 1.0 / COUNT(DISTINCT u.user_id) AS conversion
FROM users u
LEFT JOIN orders o
  ON u.user_id = o.user_id AND o.status = 'completed'
GROUP BY u.channel
ORDER BY conversion DESC` },
      { title: '필터를 ON에 vs WHERE에 — 남는 유저 수 비교', code: `SELECT 'ON에 조건' AS filter_at, COUNT(DISTINCT u.user_id) AS users_kept
FROM users u
LEFT JOIN orders o ON u.user_id = o.user_id AND o.status = 'completed'
UNION ALL
SELECT 'WHERE에 조건', COUNT(DISTINCT u.user_id)
FROM users u
LEFT JOIN orders o ON u.user_id = o.user_id
WHERE o.status = 'completed'` },
      { title: '한 번도 주문하지 않은 유저 (기기별)', code: `SELECT u.device, COUNT(*) AS users_without_order
FROM users u
LEFT JOIN orders o ON u.user_id = o.user_id
WHERE o.order_id IS NULL
GROUP BY u.device
ORDER BY users_without_order DESC` },
    ],
    tips: `
      - LEFT JOIN 뒤 \`COUNT(*)\`는 짝 없는 행도 1로 셉니다. 오른쪽 기준 개수는 \`COUNT(o.order_id)\`처럼 오른쪽 컬럼을 세세요.
      - 집계 결과의 NULL은 \`COALESCE(…, 0)\`으로 0으로 바꿔 보여줍니다.
      - 오른쪽 테이블이 1:N이면 왼쪽 행이 여러 개로 늘어납니다. 비율의 분모는 \`COUNT(DISTINCT 왼쪽키)\`로 세거나, 오른쪽을 먼저 집계한 뒤 조인하세요.`,
    related: ['sql-04', 'sql-13', 'sql-18'],
  },
  {
    id: 'join-fanout', tier: 'core', group: '조인',
    title: '여러 테이블 조인과 행 뻥튀기(fan-out)',
    summary: '1:N 조인으로 행이 불어나 합계가 부풀려지는 문제와 피하는 법.',
    body: `
      조인은 키가 일치하는 **모든 조합**을 만듭니다. 주문(1)과 주문상세(N)를 조인하면 주문 한 건이 상품 수만큼 복제되고, 이때 주문 단위 값(\`total_amount\`)을 SUM하면 **부풀려진** 값이 나옵니다.
      - 조인 전에 각 테이블의 **한 행이 무엇인지(grain)**와 키가 유일한지 확인하세요.
      - 해결책: 값은 그 값이 속한 grain의 테이블에서 집계하거나(\`quantity * unit_price\`는 order_items에서), **먼저 집계한 뒤 조인**합니다.`,
    syntax: `-- 집계 후 조인
WITH per_user AS (
  SELECT user_id, SUM(amount) AS revenue FROM fact GROUP BY user_id
)
SELECT d.*, p.revenue
FROM dim d LEFT JOIN per_user p ON d.user_id = p.user_id`,
    examples: [
      { title: '잘못된 합계 — 주문상세와 조인 후 total_amount를 SUM', code: `SELECT (SELECT SUM(total_amount) FROM orders) AS correct_revenue,
       (SELECT SUM(o.total_amount)
        FROM orders o
        JOIN order_items oi ON o.order_id = oi.order_id) AS inflated_revenue` },
      { title: '조인 전에 키 중복 확인', code: `SELECT order_id, COUNT(*) AS item_rows
FROM order_items
GROUP BY order_id
HAVING COUNT(*) > 1
ORDER BY item_rows DESC, order_id
LIMIT 5` },
      { title: '3개 테이블 조인 — 카테고리별 완료 매출 (상세 단위에서 계산)', code: `SELECT p.category,
       SUM(oi.quantity * oi.unit_price) AS revenue
FROM order_items oi
JOIN orders o ON oi.order_id = o.order_id
JOIN products p ON oi.product_id = p.product_id
WHERE o.status = 'completed'
GROUP BY p.category
ORDER BY revenue DESC` },
    ],
    tips: `
      - 조인 후 \`COUNT(*)\`가 예상보다 크면 fan-out을 의심하세요. 조인 전후 행 수 비교가 가장 빠른 점검입니다.
      - \`SUM(DISTINCT total_amount)\`로 덮는 것은 오답입니다. 금액이 같은 서로 다른 주문까지 하나로 합쳐집니다.
      - fact 두 개(예: 주문과 이벤트)를 유저 키로 바로 조인하면 N×M으로 폭발합니다. 각각 유저 단위로 집계한 뒤 붙이세요.`,
    related: ['sql-11', 'sql-13'],
  },

  // ───────────────────────── core: 서브쿼리·CTE ─────────────────────────
  {
    id: 'subquery', tier: 'core', group: '서브쿼리·CTE',
    title: '서브쿼리 (WHERE IN · 스칼라 · FROM 절)',
    summary: '쿼리 안에 쿼리를 넣어 그 결과를 조건·값·테이블로 씁니다.',
    body: `
      괄호 안의 SELECT를 서브쿼리라고 합니다. 쓰는 위치에 따라 역할이 다릅니다.
      - **WHERE col IN (서브쿼리)** — 서브쿼리 결과 목록에 포함된 행만
      - **스칼라 서브쿼리** — 값 하나(1행 1열)를 돌려줘서 비교나 SELECT에 씀: \`> (SELECT AVG(…) …)\`
      - **FROM (서브쿼리) 별칭** — 중간 결과를 테이블처럼 사용 (파생 테이블)`,
    syntax: `WHERE col IN (SELECT col FROM t WHERE …)
WHERE col > (SELECT AVG(col) FROM t)
SELECT … FROM (SELECT … FROM t GROUP BY …) AS sub`,
    examples: [
      { title: '평균보다 비싼 주문 수 (스칼라 서브쿼리)', code: `SELECT COUNT(*) AS above_avg_orders
FROM orders
WHERE total_amount > (SELECT AVG(total_amount) FROM orders)` },
      { title: 'WELCOME10 쿠폰을 쓴 유저의 채널 분포 (IN)', code: `SELECT channel, COUNT(*) AS users
FROM users
WHERE user_id IN (SELECT user_id FROM orders WHERE coupon_code = 'WELCOME10')
GROUP BY channel
ORDER BY users DESC` },
      { title: '유저별 주문 횟수의 분포 (FROM 절 서브쿼리)', code: `SELECT order_cnt, COUNT(*) AS users
FROM (
  SELECT user_id, COUNT(*) AS order_cnt
  FROM orders
  GROUP BY user_id
) AS per_user
GROUP BY order_cnt
ORDER BY order_cnt` },
    ],
    tips: `
      - \`NOT IN (서브쿼리)\`에 NULL이 섞이면 결과가 0행이 됩니다. \`NOT EXISTS\`를 쓰세요(부록 참고).
      - 스칼라 서브쿼리가 2행 이상을 돌려주면 오류입니다. 집계나 \`LIMIT 1\`로 1행을 보장하세요.
      - 서브쿼리가 두 겹 이상 중첩되면 읽기 어려워집니다. 그때는 CTE(\`WITH\`)로 바꿉니다.`,
    related: ['sql-06'],
  },
  {
    id: 'cte', tier: 'core', group: '서브쿼리·CTE',
    title: 'WITH (CTE)',
    summary: '중간 결과에 이름을 붙여 단계별로 쿼리를 쌓습니다.',
    body: `
      \`WITH 이름 AS (SELECT …)\`로 정의한 결과를 뒤쪽 쿼리에서 테이블처럼 씁니다. 여러 개는 **쉼표로** 이어 쓰고, 뒤의 CTE는 앞의 CTE를 참조할 수 있습니다.
      - 복잡한 분석을 "유저별 집계 → 세그먼트 → 요약"처럼 **단계로 나눠** 읽기 쉽게 만듭니다.
      - 마지막 SELECT만 바꿔(\`SELECT * FROM 중간단계\`) 중간 결과를 바로 확인할 수 있어 디버깅이 쉽습니다.`,
    syntax: `WITH step1 AS (
  SELECT …
),
step2 AS (
  SELECT … FROM step1
)
SELECT … FROM step2`,
    examples: [
      { title: '구매 횟수 세그먼트별 유저 수와 매출', code: `WITH user_orders AS (
  SELECT user_id, COUNT(*) AS order_cnt, SUM(total_amount) AS revenue
  FROM orders
  WHERE status = 'completed'
  GROUP BY user_id
),
segments AS (
  SELECT user_id, revenue,
         CASE WHEN order_cnt >= 3 THEN '3회 이상'
              WHEN order_cnt = 2 THEN '2회'
              ELSE '1회' END AS segment
  FROM user_orders
)
SELECT segment, COUNT(*) AS users, SUM(revenue) AS revenue,
       ROUND(AVG(revenue)) AS avg_revenue
FROM segments
GROUP BY segment
ORDER BY segment` },
      { title: '월별 신규 가입자와 매출을 따로 집계해 붙이기', code: `WITH signups AS (
  SELECT CAST(date_trunc('month', signup_date) AS DATE) AS month, COUNT(*) AS new_users
  FROM users GROUP BY 1
),
sales AS (
  SELECT CAST(date_trunc('month', order_ts) AS DATE) AS month, SUM(total_amount) AS revenue
  FROM orders WHERE status = 'completed' GROUP BY 1
)
SELECT s.month, s.new_users, COALESCE(r.revenue, 0) AS revenue
FROM signups s
LEFT JOIN sales r ON s.month = r.month
ORDER BY s.month
LIMIT 6` },
    ],
    tips: `
      - \`WITH\`는 맨 앞에 한 번만 쓰고, 이후 CTE는 \`, 이름 AS (…)\`로 잇습니다. \`WITH\`를 반복하면 문법 오류입니다.
      - CTE 이름은 내용을 설명하게 짓습니다(\`daily\`, \`user_orders\`, \`cohort\`). 면접에서 풀이 설명이 훨씬 쉬워집니다.
      - 서로 다른 grain의 지표는 CTE로 각각 집계한 뒤 키로 조인하면 fan-out을 피할 수 있습니다.`,
    related: ['sql-08', 'sql-09', 'sql-13', 'sql-14'],
  },

  // ───────────────────────── core: 윈도우 함수 ─────────────────────────
  {
    id: 'window-basics', tier: 'core', group: '윈도우 함수',
    title: 'OVER · PARTITION BY 기본',
    summary: '행을 줄이지 않고 그룹 합계·평균·비중을 행마다 붙입니다.',
    body: `
      윈도우 함수는 \`함수() OVER (PARTITION BY … ORDER BY …)\` 형태로, GROUP BY처럼 묶어서 계산하되 **행은 그대로** 둡니다. "내 급여 vs 부서 평균", "카테고리 매출 비중"처럼 개별 행과 그룹 값을 나란히 볼 때 씁니다.
      - \`PARTITION BY\` — 계산할 그룹 (생략하면 전체가 한 그룹: \`OVER ()\`)
      - \`ORDER BY\` — 순서가 필요한 함수(순위, LAG, 누적합)에서 정렬 기준
      - GROUP BY와 함께 쓰면 **집계가 끝난 결과** 위에서 계산됩니다: \`SUM(COUNT(*)) OVER ()\``,
    syntax: `AGG(col) OVER (PARTITION BY key)
AGG(col) OVER ()                       -- 전체
SUM(SUM(col)) OVER (PARTITION BY key)  -- GROUP BY 결과 위에서`,
    examples: [
      { title: '내 급여 vs 부서 평균', code: `SELECT name, dept_id, salary,
       AVG(salary) OVER (PARTITION BY dept_id) AS dept_avg,
       salary - AVG(salary) OVER (PARTITION BY dept_id) AS diff_from_avg
FROM employees
WHERE dept_id IN (10, 20)
ORDER BY dept_id, salary DESC` },
      { title: '실험별 그룹 배정 비율 (집계 + 윈도우)', code: `SELECT experiment, variant,
       COUNT(*) AS users,
       COUNT(*) * 1.0 / SUM(COUNT(*)) OVER (PARTITION BY experiment) AS assign_ratio
FROM ab_test
GROUP BY experiment, variant
ORDER BY experiment, variant` },
      { title: '카테고리 매출 비중', code: `SELECT p.category,
       SUM(oi.quantity * oi.unit_price) AS revenue,
       SUM(oi.quantity * oi.unit_price) * 1.0
         / SUM(SUM(oi.quantity * oi.unit_price)) OVER () AS share
FROM order_items oi
JOIN products p ON oi.product_id = p.product_id
GROUP BY p.category
ORDER BY revenue DESC` },
    ],
    tips: `
      - 윈도우 함수는 SELECT 단계에서 계산되므로 **WHERE에 쓸 수 없습니다**. 결과로 거르려면 서브쿼리/CTE로 감싸거나 \`QUALIFY\`(부록)를 씁니다.
      - WHERE로 행을 먼저 거르면 윈도우도 거른 행만 대상으로 계산합니다. 전체 대비 비중이 필요하면 거르기 전에 계산하세요.
      - 같은 OVER 절을 여러 번 쓰면 \`WINDOW w AS (PARTITION BY …)\`로 이름을 붙여 \`OVER w\`로 재사용할 수 있습니다.`,
    related: ['sql-11', 'sql-17'],
  },
  {
    id: 'ranking', tier: 'core', group: '윈도우 함수',
    title: '순위 (ROW_NUMBER · RANK · DENSE_RANK)',
    summary: '그룹 안에서 순위를 매기고, 그룹별 Top N·최신 1건을 뽑습니다.',
    body: `
      세 함수는 **동점 처리**만 다릅니다.
      | 값 | ROW_NUMBER | RANK | DENSE_RANK |
      |---|---|---|---|
      | 100 | 1 | 1 | 1 |
      | 90 | 2 | 2 | 2 |
      | 90 | 3 | 2 | 2 |
      | 80 | 4 | **4** | **3** |
      "그룹별 최신 1건 / 상위 N개"는 순위를 매긴 뒤 바깥 쿼리에서 \`WHERE rn = 1\`(또는 \`<= N\`)로 거르는 패턴입니다.`,
    syntax: `ROW_NUMBER() OVER (PARTITION BY key ORDER BY col DESC) AS rn
RANK()       OVER (PARTITION BY key ORDER BY col DESC)
DENSE_RANK() OVER (PARTITION BY key ORDER BY col DESC)`,
    examples: [
      { title: '세 함수 비교 — Data 부서 급여 순위 (4200 동점)', code: `SELECT name, salary,
       ROW_NUMBER() OVER (ORDER BY salary DESC, name) AS row_num,
       RANK()       OVER (ORDER BY salary DESC) AS rnk,
       DENSE_RANK() OVER (ORDER BY salary DESC) AS dense_rnk
FROM employees
WHERE dept_id = 10
ORDER BY salary DESC, name` },
      { title: '유저별 가장 최근 주문 1건', code: `SELECT user_id, order_id, order_ts, total_amount
FROM (
  SELECT *,
         ROW_NUMBER() OVER (PARTITION BY user_id
                            ORDER BY order_ts DESC, order_id DESC) AS rn
  FROM orders
) AS t
WHERE rn = 1
ORDER BY user_id
LIMIT 5` },
      { title: '카테고리별 매출 상위 2개 상품', code: `WITH sales AS (
  SELECT p.category, p.product_name, SUM(oi.quantity * oi.unit_price) AS revenue
  FROM order_items oi
  JOIN products p ON oi.product_id = p.product_id
  GROUP BY p.category, p.product_name
)
SELECT category, product_name, revenue, rk
FROM (
  SELECT *, RANK() OVER (PARTITION BY category ORDER BY revenue DESC) AS rk
  FROM sales
) AS ranked
WHERE rk <= 2
ORDER BY category, rk` },
    ],
    tips: `
      - "정확히 1건"이 필요하면 ROW_NUMBER, "동점이면 모두"는 RANK/DENSE_RANK입니다. 문제의 동점 규칙을 먼저 확인하세요.
      - ROW_NUMBER는 동점끼리 순서가 임의입니다. 보조 정렬 키(\`order_id DESC\`)를 넣어 결과를 결정적으로 만드세요.
      - "N번째로 높은 값"은 DENSE_RANK = N입니다(RANK는 동점 뒤 번호를 건너뜀).`,
    related: ['sql-05', 'sql-06', 'sql-07', 'sql-15'],
  },
  {
    id: 'lag-lead', tier: 'core', group: '윈도우 함수',
    title: 'LAG · LEAD (이전·다음 행 값)',
    summary: '정렬 기준으로 이전/다음 행의 값을 가져와 전기 대비·간격을 계산합니다.',
    body: `
      \`LAG(col, n, 기본값)\`은 n행 **앞**(기본 1), \`LEAD(col, n, 기본값)\`은 n행 **뒤**의 값을 가져옵니다. 전월 대비 증감률(MoM), 직전 주문과의 간격, 다음 이벤트 확인에 씁니다.
      - \`OVER (ORDER BY …)\`가 꼭 필요하고, 유저별로 따로 보려면 \`PARTITION BY user_id\`를 추가합니다.
      - 첫 행의 LAG(마지막 행의 LEAD)는 이전 행이 없으므로 NULL(또는 지정한 기본값)입니다.`,
    syntax: `LAG(col, 1) OVER (PARTITION BY key ORDER BY ts)
LEAD(col, 1, default) OVER (PARTITION BY key ORDER BY ts)`,
    examples: [
      { title: '월별 완료 주문 수와 전월 대비 증감률', code: `WITH m AS (
  SELECT CAST(date_trunc('month', order_ts) AS DATE) AS month, COUNT(*) AS orders
  FROM orders
  WHERE status = 'completed'
  GROUP BY 1
)
SELECT month, orders,
       LAG(orders) OVER (ORDER BY month) AS prev_orders,
       (orders - LAG(orders) OVER (ORDER BY month)) * 1.0
         / LAG(orders) OVER (ORDER BY month) AS mom
FROM m
ORDER BY month
LIMIT 6` },
      { title: '유저의 직전 주문일과 간격(일)', code: `SELECT user_id, order_id,
       CAST(order_ts AS DATE) AS dt,
       LAG(CAST(order_ts AS DATE)) OVER (PARTITION BY user_id ORDER BY order_ts, order_id) AS prev_dt,
       datediff(order_ts, LAG(order_ts) OVER (PARTITION BY user_id ORDER BY order_ts, order_id)) AS gap_days
FROM orders
WHERE user_id = 3338
ORDER BY order_ts` },
      { title: '세션 안에서 다음 이벤트 (LEAD)', code: `SELECT session_id, event_ts, event_type,
       LEAD(event_type, 1, '(이탈)') OVER (PARTITION BY session_id ORDER BY event_ts, event_id) AS next_event
FROM events
WHERE session_id = 11
ORDER BY event_ts, event_id` },
    ],
    tips: `
      - LAG는 "이전 **행**"이지 "이전 **달**"이 아닙니다. 중간에 데이터가 없는 달이 있으면 두 달 전과 비교하게 되므로, 빈 기간을 날짜 뼈대로 채운 뒤 쓰세요(부록 '날짜 채우기').
      - 같은 OVER를 여러 번 쓰면 \`WINDOW w AS (ORDER BY month)\`로 이름을 붙여 재사용합니다.
      - 증감률의 분모(이전 값)가 0일 수 있으면 \`NULLIF\`로 감싸세요.`,
    related: ['sql-10', 'sql-19'],
  },
  {
    id: 'running-moving', tier: 'core', group: '윈도우 함수',
    title: '누적합 · 이동평균 (ROWS BETWEEN)',
    summary: '윈도우 프레임으로 누적 합계와 최근 N개 평균을 계산합니다.',
    body: `
      \`ORDER BY\`가 있는 집계 윈도우에 **프레임**을 지정하면 "어디부터 어디까지"를 계산할지 정할 수 있습니다.
      - 누적합: \`SUM(x) OVER (ORDER BY dt ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)\`
      - 7일 이동평균: \`AVG(x) OVER (ORDER BY dt ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)\`
      - 그룹마다 따로 누적하려면 \`PARTITION BY\`를 함께 씁니다.`,
    syntax: `SUM(x) OVER (PARTITION BY key ORDER BY dt
             ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
AVG(x) OVER (ORDER BY dt ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)`,
    examples: [
      { title: '월별 매출 누적합과 누적 비중', code: `WITH m AS (
  SELECT CAST(date_trunc('month', order_ts) AS DATE) AS month, SUM(total_amount) AS revenue
  FROM orders
  WHERE status = 'completed'
  GROUP BY 1
)
SELECT month, revenue,
       SUM(revenue) OVER (ORDER BY month ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cum_revenue,
       SUM(revenue) OVER (ORDER BY month ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) * 1.0
         / SUM(revenue) OVER () AS cum_share
FROM m
ORDER BY month` },
      { title: '일별 주문 수 7일 이동평균 (계산 후 기간 필터)', code: `WITH daily AS (
  SELECT CAST(order_ts AS DATE) AS dt, COUNT(*) AS orders
  FROM orders
  GROUP BY 1
),
ma AS (
  SELECT dt, orders,
         AVG(orders) OVER (ORDER BY dt ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS ma7
  FROM daily
)
SELECT * FROM ma
WHERE dt >= '2025-12-22'
ORDER BY dt` },
    ],
    tips: `
      - \`ORDER BY\`만 쓰고 프레임을 생략하면 기본값이 \`RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW\`입니다. 정렬 값이 같은 행(동점)이 한꺼번에 더해지므로, 누적합은 \`ROWS\`를 명시하는 편이 안전합니다.
      - \`ROWS 6 PRECEDING\`은 "행 7개"입니다. 데이터가 없는 날이 있으면 실제로는 7일보다 긴 기간의 평균이 됩니다. 날짜 뼈대로 채우거나 \`RANGE BETWEEN INTERVAL 6 DAY PRECEDING AND CURRENT ROW\`를 씁니다.
      - WHERE로 기간을 먼저 자르면 첫 6일의 이동평균이 짧은 구간으로 계산됩니다. **계산한 뒤** 바깥에서 거르세요(예제 2).`,
    related: ['sql-09'],
  },

  // ───────────────────────── core: 집합 ─────────────────────────
  {
    id: 'union', tier: 'core', group: '집합',
    title: 'UNION · UNION ALL',
    summary: '여러 쿼리 결과를 위아래로 이어 붙입니다.',
    body: `
      \`UNION ALL\`은 결과를 그대로 이어 붙이고, \`UNION\`은 이어 붙인 뒤 **중복 행을 제거**합니다. 지표를 세로로 쌓거나, 구조가 같은 테이블(예: 월별 로그)을 합칠 때 씁니다.
      - 각 쿼리의 **컬럼 수와 순서, 타입**이 맞아야 합니다. 이름이 아니라 **위치**로 맞춰집니다.
      - 결과 컬럼 이름은 첫 번째 쿼리를 따르고, \`ORDER BY\`는 맨 끝에 한 번만 씁니다.`,
    syntax: `SELECT a, b FROM t1
UNION ALL
SELECT a, b FROM t2
ORDER BY a`,
    examples: [
      { title: '12월 핵심 지표를 세로로 쌓기', code: `SELECT '신규 가입자' AS metric, COUNT(*) AS value
FROM users WHERE signup_date >= '2025-12-01'
UNION ALL
SELECT '주문 수', COUNT(*)
FROM orders WHERE order_ts >= '2025-12-01'
UNION ALL
SELECT '구매자 수', COUNT(DISTINCT user_id)
FROM orders WHERE order_ts >= '2025-12-01'` },
      { title: 'UNION ALL vs UNION — 행 수 비교', code: `SELECT
  (SELECT COUNT(*) FROM (SELECT country FROM users UNION ALL SELECT country FROM users)) AS union_all_rows,
  (SELECT COUNT(*) FROM (SELECT country FROM users UNION SELECT country FROM users)) AS union_rows` },
    ],
    tips: `
      - 중복이 없거나 중복을 유지해야 하면 \`UNION ALL\`을 쓰세요. \`UNION\`은 중복 제거를 위해 정렬/해시를 해서 느리고, 의도치 않게 행이 사라질 수 있습니다.
      - 컬럼 순서를 바꿔 쓰면 오류 없이 값이 엉뚱한 컬럼에 섞입니다. 타입이 같으면 엔진이 알아채지 못합니다.
      - DuckDB에는 컬럼 이름으로 맞춰 붙이는 \`UNION BY NAME\`도 있습니다.`,
  },

  // ───────────────────────── core: 실행 순서 ─────────────────────────
  {
    id: 'execution-order', tier: 'core', group: '쿼리 실행 순서',
    title: '쿼리의 논리적 실행 순서',
    summary: 'FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT',
    body: `
      SQL은 쓰는 순서와 **논리적으로 처리되는 순서**가 다릅니다. 이 순서를 알면 "왜 WHERE에서 별칭을 못 쓰지?", "왜 WHERE에 윈도우 함수가 안 되지?"가 풀립니다.
      | 순서 | 절 | 하는 일 |
      |---|---|---|
      | 1 | \`FROM\` / \`JOIN\` | 테이블을 읽고 조인 |
      | 2 | \`WHERE\` | 행 필터 (집계 전) |
      | 3 | \`GROUP BY\` | 그룹으로 묶기 |
      | 4 | \`HAVING\` | 그룹 필터 (집계 후) |
      | 5 | \`SELECT\` | 컬럼·계산식·별칭, **윈도우 함수** |
      | 6 | \`DISTINCT\` | 중복 제거 |
      | 7 | \`ORDER BY\` | 정렬 (별칭 사용 가능) |
      | 8 | \`LIMIT\` | 개수 제한 |`,
    syntax: `SELECT … -- 5
FROM …    -- 1
WHERE …   -- 2
GROUP BY … -- 3
HAVING …  -- 4
ORDER BY … -- 7
LIMIT …   -- 8`,
    examples: [
      { title: '각 절에 번호를 붙여 읽기', code: `SELECT country,                          -- 5. 출력 컬럼과 별칭
       COUNT(*) AS completed_orders          --    (집계 결과)
FROM orders o                               -- 1. 읽기
JOIN users u ON o.user_id = u.user_id       --    조인
WHERE o.status = 'completed'                -- 2. 행 필터 (집계 전)
GROUP BY country                            -- 3. 묶기
HAVING COUNT(*) >= 100                      -- 4. 그룹 필터 (집계 후)
ORDER BY completed_orders DESC              -- 7. 정렬 (별칭 사용 가능)
LIMIT 3                                     -- 8. 개수 제한` },
    ],
    tips: `
      - WHERE는 SELECT보다 먼저라 **SELECT 별칭을 쓸 수 없는 것이 표준**입니다. DuckDB는 편의상 허용하지만 다른 엔진에서는 오류이므로, 면접에서는 식을 다시 쓰세요.
      - 윈도우 함수는 5단계에서 계산되므로 WHERE·GROUP BY·HAVING에서 쓸 수 없습니다. 바깥 쿼리나 \`QUALIFY\`로 거릅니다.
      - 이것은 **논리적** 순서입니다. 실제 실행 계획은 옵티마이저가 필터를 앞당기는 등 자유롭게 바꿉니다(결과는 같음).`,
    related: ['sql-02'],
  },

  // ═════════════════════════ appendix ═════════════════════════
  // ───────────────────────── 필터·그룹 확장 ─────────────────────────
  {
    id: 'qualify', tier: 'appendix', group: '필터·그룹 확장',
    title: 'QUALIFY',
    summary: '윈도우 함수 결과로 바로 행을 거릅니다 (서브쿼리 불필요).',
    body: `
      \`QUALIFY\`는 윈도우 함수가 계산된 **뒤에** 적용되는 필터입니다. "그룹별 1건/상위 N개"를 서브쿼리 없이 한 번에 쓸 수 있습니다.
      - SELECT에 정의한 윈도우 별칭(\`QUALIFY rk <= 2\`)을 써도 되고, 윈도우 식을 직접 써도 됩니다.`,
    syntax: `SELECT cols
FROM t
QUALIFY ROW_NUMBER() OVER (PARTITION BY key ORDER BY ts DESC) = 1`,
    examples: [
      { title: '부서별 최고 연봉자', code: `SELECT d.dept_name, e.name, e.salary
FROM employees e
JOIN departments d ON e.dept_id = d.dept_id
QUALIFY RANK() OVER (PARTITION BY e.dept_id ORDER BY e.salary DESC) = 1
ORDER BY d.dept_name` },
      { title: '유저 첫 주문의 결제수단 분포', code: `WITH first_orders AS (
  SELECT user_id, payment_method
  FROM orders
  QUALIFY ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY order_ts, order_id) = 1
)
SELECT payment_method, COUNT(*) AS users
FROM first_orders
GROUP BY payment_method
ORDER BY users DESC` },
    ],
    tips: `
      - PostgreSQL·MySQL 등에는 없는 확장 문법입니다. 면접에서 엔진이 불분명하면 서브쿼리 + \`WHERE rn = 1\` 방식도 함께 말하세요.`,
    dbx: `Databricks SQL도 \`QUALIFY\`를 지원합니다.`,
    related: ['sql-05', 'sql-07'],
  },
  {
    id: 'group-by-all', tier: 'appendix', group: '필터·그룹 확장',
    title: 'GROUP BY ALL',
    summary: 'SELECT의 집계 아닌 컬럼 전부로 자동으로 묶습니다.',
    body: `
      \`GROUP BY ALL\`은 SELECT 목록에서 집계 함수가 아닌 컬럼을 모두 GROUP BY 키로 씁니다. 키 컬럼이 많을 때 SELECT와 GROUP BY를 이중으로 관리하지 않아도 됩니다.`,
    syntax: `SELECT key1, key2, AGG(col)
FROM t
GROUP BY ALL`,
    examples: [
      { title: '국가 × 기기별 가입자 수 상위 5', code: `SELECT country, device, COUNT(*) AS users
FROM users
GROUP BY ALL
ORDER BY users DESC
LIMIT 5` },
    ],
    tips: `
      - 표준 SQL이 아닙니다. 다른 엔진으로 옮길 쿼리나 면접 답안에서는 키를 직접 적는 편이 안전합니다.
      - SELECT에 컬럼을 추가하면 묶는 단위도 조용히 바뀝니다. grain이 의도대로인지 확인하세요.`,
    dbx: `Databricks SQL도 \`GROUP BY ALL\`을 지원합니다.`,
  },

  // ───────────────────────── 조인 심화 ─────────────────────────
  {
    id: 'exists', tier: 'appendix', group: '조인 심화',
    title: 'EXISTS · NOT EXISTS',
    summary: '다른 테이블에 조건에 맞는 행이 있는지(없는지)로 거릅니다.',
    body: `
      \`EXISTS (서브쿼리)\`는 서브쿼리가 한 행이라도 돌려주면 참입니다. 바깥 행을 참조하는 **상관 서브쿼리**로 씁니다.
      - "구매한 적 있는 유저"는 \`EXISTS\`, "장바구니엔 담았지만 구매하지 않은 세션"은 \`NOT EXISTS\`
      - 조인과 달리 행이 늘어나지 않고, \`NOT IN\`과 달리 NULL에 안전합니다.`,
    syntax: `SELECT … FROM a
WHERE EXISTS (SELECT 1 FROM b WHERE b.key = a.key AND …)

WHERE NOT EXISTS (SELECT 1 FROM b WHERE b.key = a.key)`,
    examples: [
      { title: '장바구니에 담았지만 구매하지 않은 세션 (플랫폼별)', code: `SELECT e.platform, COUNT(DISTINCT e.session_id) AS abandoned_sessions
FROM events e
WHERE e.event_type = 'add_to_cart'
  AND NOT EXISTS (
    SELECT 1 FROM events p
    WHERE p.session_id = e.session_id AND p.event_type = 'purchase'
  )
GROUP BY e.platform
ORDER BY abandoned_sessions DESC` },
      { title: 'WELCOME10 쿠폰으로 구매한 적 있는 유저 수', code: `SELECT COUNT(*) AS users
FROM users u
WHERE EXISTS (
  SELECT 1 FROM orders o
  WHERE o.user_id = u.user_id AND o.coupon_code = 'WELCOME10'
)` },
    ],
    tips: `
      - 서브쿼리의 SELECT 목록은 의미가 없어서 관례로 \`SELECT 1\`을 씁니다.
      - \`NOT IN (SELECT col …)\`은 col에 NULL이 하나라도 있으면 0행이 됩니다. "없는 것 찾기"는 \`NOT EXISTS\`가 기본입니다.`,
    related: ['sql-04'],
  },
  {
    id: 'semi-anti-join', tier: 'appendix', group: '조인 심화',
    title: 'SEMI JOIN · ANTI JOIN',
    summary: 'EXISTS / NOT EXISTS를 조인 문법으로 씁니다.',
    body: `
      - \`A SEMI JOIN B ON …\` — B에 짝이 **있는** A의 행만 (A의 컬럼만, 행 중복 없음)
      - \`A ANTI JOIN B ON …\` — B에 짝이 **없는** A의 행만
      EXISTS / NOT EXISTS와 같은 결과를 더 짧게 쓸 수 있습니다.`,
    syntax: `SELECT a.* FROM a SEMI JOIN b ON a.key = b.key
SELECT a.* FROM a ANTI JOIN b ON a.key = b.key`,
    examples: [
      { title: '구매 경험이 있는 유저의 국가 분포 (SEMI)', code: `SELECT u.country, COUNT(*) AS buyers
FROM users u
SEMI JOIN orders o ON u.user_id = o.user_id
GROUP BY u.country
ORDER BY buyers DESC` },
      { title: '주문이 없는 유저 수 (ANTI)', code: `SELECT u.device, COUNT(*) AS users_without_order
FROM users u
ANTI JOIN orders o ON u.user_id = o.user_id
GROUP BY u.device
ORDER BY u.device` },
    ],
    tips: `
      - SEMI JOIN은 B에 짝이 여러 개여도 A의 행이 한 번만 나옵니다. INNER JOIN + DISTINCT보다 의도가 분명합니다.
      - 결과에는 왼쪽 테이블의 컬럼만 있습니다. B의 컬럼이 필요하면 일반 조인을 쓰세요.`,
    dbx: `Databricks는 \`LEFT SEMI JOIN\` / \`LEFT ANTI JOIN\`으로 주로 쓰며, \`SEMI JOIN\` / \`ANTI JOIN\`도 같은 뜻입니다. DuckDB는 \`LEFT\`를 붙이지 않은 형태만 받습니다.`,
    related: ['sql-04'],
  },
  {
    id: 'full-outer-join', tier: 'appendix', group: '조인 심화',
    title: 'FULL OUTER JOIN',
    summary: '양쪽 테이블의 모든 행을 유지하고, 짝이 없는 쪽은 NULL로 채웁니다.',
    body: `
      \`FULL OUTER JOIN\`은 LEFT JOIN과 RIGHT JOIN을 합친 것입니다. 두 집계 결과를 날짜·키 기준으로 나란히 비교하는데 **어느 한쪽에만 있는 키**가 있을 때, 또는 두 데이터의 불일치를 찾을 때 씁니다.
      - 키는 \`COALESCE(a.key, b.key)\`로 하나로 합쳐 보여줍니다.`,
    syntax: `SELECT COALESCE(a.key, b.key) AS key, a.val, b.val
FROM a
FULL OUTER JOIN b ON a.key = b.key`,
    examples: [
      { title: '일별 DAU와 주문 수 나란히 (한쪽에만 있는 날짜 포함)', code: `WITH dau AS (
  SELECT CAST(event_ts AS DATE) AS dt, COUNT(DISTINCT user_id) AS dau
  FROM events WHERE event_ts >= '2025-12-28' GROUP BY 1
),
ord AS (
  SELECT CAST(order_ts AS DATE) AS dt, COUNT(*) AS orders
  FROM orders WHERE order_ts >= '2025-12-28' GROUP BY 1
)
SELECT COALESCE(d.dt, o.dt) AS dt, d.dau, COALESCE(o.orders, 0) AS orders
FROM dau d
FULL OUTER JOIN ord o ON d.dt = o.dt
ORDER BY dt` },
      { title: '부서 배정이 안 된 직원 / 직원이 없는 부서 찾기', code: `SELECT e.emp_id, e.name, d.dept_id, d.dept_name
FROM employees e
FULL OUTER JOIN departments d ON e.dept_id = d.dept_id
WHERE e.emp_id IS NULL OR d.dept_id IS NULL` },
    ],
    tips: `
      - FULL OUTER JOIN 뒤 WHERE에 한쪽 테이블 조건을 걸면 반대쪽에만 있던 행이 사라집니다. 필터는 조인 전에(CTE 안에서) 거세요.`,
  },
  {
    id: 'cross-join', tier: 'appendix', group: '조인 심화',
    title: 'CROSS JOIN',
    summary: '두 테이블의 모든 조합(카테시안 곱)을 만듭니다.',
    body: `
      \`CROSS JOIN\`은 조인 조건 없이 A의 각 행에 B의 모든 행을 붙입니다(행 수 = A × B). **월 × 채널** 같은 빈 격자를 만들고 실제 값을 LEFT JOIN해서, 값이 없는 조합을 0으로 보여줄 때 씁니다.`,
    syntax: `SELECT a.x, b.y
FROM a
CROSS JOIN b`,
    examples: [
      { title: '월 × 채널 격자에 XMAS25 쿠폰 주문 수 채우기 (없으면 0)', code: `WITH months AS (
  SELECT DISTINCT CAST(date_trunc('month', order_ts) AS DATE) AS month
  FROM orders WHERE order_ts >= '2025-11-01'
),
channels AS (SELECT DISTINCT channel FROM users),
xmas AS (
  SELECT CAST(date_trunc('month', o.order_ts) AS DATE) AS month, u.channel, COUNT(*) AS orders
  FROM orders o JOIN users u ON o.user_id = u.user_id
  WHERE o.coupon_code = 'XMAS25'
  GROUP BY 1, 2
)
SELECT m.month, c.channel, COALESCE(x.orders, 0) AS xmas25_orders
FROM months m
CROSS JOIN channels c
LEFT JOIN xmas x ON x.month = m.month AND x.channel = c.channel
ORDER BY m.month, c.channel` },
    ],
    tips: `
      - 큰 테이블끼리 CROSS JOIN하면 결과가 폭발합니다. 작은 차원(날짜, 카테고리) 목록끼리만 쓰세요.
      - 일반 조인에서 ON 조건을 빠뜨리거나 잘못 쓰면 사실상 CROSS JOIN이 됩니다. 행 수가 갑자기 커지면 조인 조건을 확인하세요.`,
  },
  {
    id: 'self-join', tier: 'appendix', group: '조인 심화',
    title: 'SELF JOIN',
    summary: '같은 테이블을 별칭 두 개로 조인합니다 (직원–매니저 등).',
    body: `
      한 테이블 안에 행끼리의 관계가 있을 때(직원의 \`manager_id\` → 다른 직원의 \`emp_id\`) 같은 테이블을 다른 별칭으로 두 번 불러 조인합니다. 같은 그룹 안의 다른 행과 비교할 때도 씁니다.`,
    syntax: `SELECT e.name, m.name AS manager_name
FROM employees e
LEFT JOIN employees m ON e.manager_id = m.emp_id`,
    examples: [
      { title: '매니저별 팀원 수와 평균 연봉', code: `SELECT m.name AS manager, COUNT(*) AS reports, AVG(e.salary) AS avg_salary
FROM employees e
JOIN employees m ON e.manager_id = m.emp_id
GROUP BY m.name
ORDER BY reports DESC, manager` },
      { title: '같은 부서에서 나보다 연봉이 높은 동료 수', code: `SELECT a.name, a.dept_id, a.salary,
       COUNT(b.emp_id) AS higher_paid_peers
FROM employees a
LEFT JOIN employees b
  ON a.dept_id = b.dept_id AND b.salary > a.salary
WHERE a.dept_id = 20
GROUP BY a.name, a.dept_id, a.salary
ORDER BY a.salary DESC` },
    ],
    tips: `
      - 매니저가 없는 최상위 직원까지 보려면 LEFT JOIN을 씁니다(INNER면 빠짐).
      - 별칭 이름(e/m, a/b)을 역할이 드러나게 지으면 실수가 줄어듭니다.`,
    related: ['sql-18'],
  },

  // ───────────────────────── 집계·통계 심화 ─────────────────────────
  {
    id: 'rollup-cube', tier: 'appendix', group: '집계·통계 심화',
    title: 'ROLLUP · CUBE · GROUPING SETS',
    summary: '소계와 총계를 한 쿼리로 함께 구합니다.',
    body: `
      - \`GROUP BY ROLLUP(a, b)\` — (a, b), (a), () 순서로 계층적 소계 + 총계
      - \`GROUP BY CUBE(a, b)\` — 가능한 모든 조합: (a, b), (a), (b), ()
      - \`GROUP BY GROUPING SETS ((a), (b), ())\` — 원하는 조합만 직접 지정
      소계 행에서는 묶이지 않은 컬럼이 NULL입니다. 진짜 NULL과 구분하려면 \`GROUPING(col)\`(소계면 1)을 씁니다.`,
    syntax: `SELECT a, b, AGG(x), GROUPING(a), GROUPING(b)
FROM t
GROUP BY ROLLUP(a, b)`,
    examples: [
      { title: '기기 × 수신동의 가입자 수 + 기기 소계 + 총계', code: `SELECT CASE WHEN GROUPING(device) = 1 THEN '(전체)' ELSE device END AS device,
       CASE WHEN GROUPING(marketing_opt_in) = 1 THEN '(소계)'
            ELSE CAST(marketing_opt_in AS VARCHAR) END AS opt_in,
       COUNT(*) AS users
FROM users
GROUP BY ROLLUP(device, marketing_opt_in)
ORDER BY GROUPING(device), device, GROUPING(marketing_opt_in), opt_in` },
      { title: '기기별 · 채널별 · 전체를 한 번에 (GROUPING SETS)', code: `SELECT device, channel, COUNT(*) AS users
FROM users
GROUP BY GROUPING SETS ((device), (channel), ())
ORDER BY device NULLS LAST, channel NULLS LAST` },
    ],
    tips: `
      - 소계 행의 NULL과 원래 데이터의 NULL을 헷갈리지 않도록 \`GROUPING()\`으로 라벨을 붙이세요.
      - 대시보드용 피벗 표를 만들 때 유용하지만, 이후 계산에 다시 쓸 데이터라면 소계 행이 섞이지 않게 주의하세요.`,
    dbx: `Databricks도 \`ROLLUP\`, \`CUBE\`, \`GROUPING SETS\`, \`grouping()\`, \`grouping_id()\`를 지원합니다.`,
  },
  {
    id: 'percentile', tier: 'appendix', group: '집계·통계 심화',
    title: '중앙값 · 백분위수 · 근사 집계',
    summary: 'median, quantile_cont/percentile_cont, approx_count_distinct, percentile_approx.',
    body: `
      매출·체류시간처럼 꼬리가 긴 분포는 평균보다 **중앙값과 백분위수**가 대표값으로 적합합니다.
      - \`median(x)\` — 중앙값
      - \`quantile_cont(x, 0.9)\` (DuckDB) = \`percentile_cont(0.9) WITHIN GROUP (ORDER BY x)\` (표준) — 보간한 90번째 백분위수
      - \`approx_count_distinct(x)\` — 고유값 개수 근사(HyperLogLog), 대용량에서 빠름
      - \`percentile_approx(x, 0.5)\` — 백분위수 근사 (이 사이트에서는 DuckDB \`approx_quantile\`로 동작)`,
    syntax: `median(x)
quantile_cont(x, p)                              -- DuckDB
percentile_cont(p) WITHIN GROUP (ORDER BY x)     -- 표준
percentile_approx(x, p)   approx_count_distinct(x)`,
    examples: [
      { title: '결제수단별 주문 금액 평균 vs 중앙값 vs P90', code: `SELECT payment_method,
       COUNT(*) AS orders,
       ROUND(AVG(total_amount)) AS avg_amount,
       median(total_amount) AS median_amount,
       quantile_cont(total_amount, 0.9) AS p90
FROM orders
WHERE status = 'completed'
GROUP BY payment_method
ORDER BY orders DESC` },
      { title: '표준 문법과 근사 함수', code: `SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY total_amount) AS median_std,
       percentile_approx(total_amount, 0.5) AS median_approx,
       COUNT(DISTINCT user_id) AS buyers_exact,
       approx_count_distinct(user_id) AS buyers_approx
FROM orders` },
    ],
    tips: `
      - 평균이 중앙값보다 훨씬 크면 소수의 큰 값(헤비 유저, 대량 주문)이 평균을 끌어올리는 것입니다. 둘 다 보고하세요.
      - \`_cont\`는 값 사이를 보간하고, \`quantile_disc\`/\`percentile_disc\`는 실제 존재하는 값 중에서 고릅니다.
      - 근사 함수는 결과가 정확하지 않습니다. 예제처럼 작은 데이터에서는 \`approx_count_distinct\` 오차가 눈에 띄게 클 수도 있습니다. 대용량 탐색용이고, 공식 리포트 수치에는 정확한 함수를 쓰세요.`,
    dbx: `Databricks는 \`median\`, \`percentile(x, p)\`(정확), \`percentile_approx\`/\`approx_percentile\`, \`percentile_cont … WITHIN GROUP\`, \`approx_count_distinct\`를 씁니다. \`quantile_cont\`는 DuckDB 이름입니다.`,
  },

  // ───────────────────────── 윈도우 심화 ─────────────────────────
  {
    id: 'ntile-percent-rank', tier: 'appendix', group: '윈도우 심화',
    title: 'NTILE · PERCENT_RANK · CUME_DIST',
    summary: '행을 n등분하거나, 상대적 위치(백분위)를 계산합니다.',
    body: `
      - \`NTILE(n)\` — 정렬 순서대로 행을 n개 버킷으로 나눠 1~n 번호를 붙임 (4분위, 10분위 세그먼트)
      - \`PERCENT_RANK()\` — \`(순위 - 1) / (전체 행 - 1)\`, 0~1
      - \`CUME_DIST()\` — 현재 값 **이하**인 행의 비율, 0 초과 ~ 1`,
    syntax: `NTILE(4) OVER (ORDER BY x DESC)
PERCENT_RANK() OVER (ORDER BY x)
CUME_DIST() OVER (ORDER BY x)`,
    examples: [
      { title: '고객 구매액 4분위별 매출 기여', code: `WITH per_user AS (
  SELECT user_id, SUM(total_amount) AS revenue
  FROM orders
  WHERE status = 'completed'
  GROUP BY user_id
),
bucketed AS (
  SELECT *, NTILE(4) OVER (ORDER BY revenue DESC) AS quartile
  FROM per_user
)
SELECT quartile, COUNT(*) AS users,
       MIN(revenue) AS min_revenue, MAX(revenue) AS max_revenue,
       SUM(revenue) * 1.0 / SUM(SUM(revenue)) OVER () AS revenue_share
FROM bucketed
GROUP BY quartile
ORDER BY quartile` },
      { title: '연봉의 백분위 위치', code: `SELECT name, salary,
       ROUND(PERCENT_RANK() OVER (ORDER BY salary), 3) AS pct_rank,
       ROUND(CUME_DIST() OVER (ORDER BY salary), 3) AS cume_dist
FROM employees
ORDER BY salary DESC
LIMIT 6` },
    ],
    tips: `
      - NTILE은 **행 수**로 나누므로 같은 값이 서로 다른 버킷에 들어갈 수 있습니다. 값 기준 구간이 필요하면 백분위수 경계값(\`quantile_cont\`)으로 CASE WHEN을 쓰세요.
      - "상위 10% 고객"은 \`NTILE(10) … = 1\` 또는 \`PERCENT_RANK() OVER (ORDER BY revenue DESC) < 0.1\`로 구합니다.`,
  },
  {
    id: 'first-last-value', tier: 'appendix', group: '윈도우 심화',
    title: 'FIRST_VALUE · LAST_VALUE · 윈도우 프레임',
    summary: '그룹 안의 첫 값·마지막 값을 행마다 붙입니다 (LAST_VALUE 프레임 함정 주의).',
    body: `
      \`FIRST_VALUE(x)\` / \`LAST_VALUE(x)\`는 정렬된 윈도우 프레임의 첫/마지막 값을, \`NTH_VALUE(x, n)\`은 n번째 값을 돌려줍니다. 유저의 첫 유입 경로, 마지막 결제수단 등을 각 행에 붙일 때 씁니다.
      - \`ORDER BY\`가 있으면 기본 프레임이 "처음 ~ **현재 행**"이라 \`LAST_VALUE\`는 그냥 현재 행 값이 됩니다. 그룹 전체의 마지막 값을 원하면 \`ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING\`을 지정합니다.`,
    syntax: `FIRST_VALUE(x) OVER (PARTITION BY key ORDER BY ts)
LAST_VALUE(x)  OVER (PARTITION BY key ORDER BY ts
                     ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)`,
    examples: [
      { title: 'LAST_VALUE 프레임 함정 — 기본 프레임 vs 전체 프레임', code: `SELECT name, salary,
       FIRST_VALUE(name) OVER (ORDER BY salary DESC, name) AS top_paid,
       LAST_VALUE(name)  OVER (ORDER BY salary DESC, name) AS last_default_frame,
       LAST_VALUE(name)  OVER (ORDER BY salary DESC, name
                               ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS lowest_paid
FROM employees
WHERE dept_id = 10
ORDER BY salary DESC, name` },
      { title: '첫 주문과 마지막 주문의 결제수단이 다른 유저 비율 (WINDOW 절)', code: `WITH t AS (
  SELECT DISTINCT user_id,
         FIRST_VALUE(payment_method) OVER w AS first_pm,
         LAST_VALUE(payment_method)  OVER w AS last_pm
  FROM orders
  WINDOW w AS (PARTITION BY user_id ORDER BY order_ts, order_id
               ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)
)
SELECT COUNT(*) AS users,
       AVG(CASE WHEN first_pm <> last_pm THEN 1.0 ELSE 0 END) AS switched_ratio
FROM t` },
    ],
    tips: `
      - 그룹별 첫/마지막 값 하나만 필요하면 윈도우 대신 \`arg_min(x, ts)\` / \`arg_max(x, ts)\`(DuckDB; Databricks는 \`min_by\` / \`max_by\`)로 GROUP BY 집계하는 편이 간단합니다.
      - NULL을 건너뛰려면 \`LAST_VALUE(x IGNORE NULLS)\`를 씁니다(결측을 직전 값으로 채우기).`,
    dbx: `Databricks는 \`first_value\`/\`last_value\`(별칭 \`first\`/\`last\`)와 \`min_by(x, ord)\`/\`max_by(x, ord)\`를 씁니다. DuckDB도 \`min_by\`/\`max_by\`를 \`arg_min\`/\`arg_max\`의 별칭으로 지원합니다.`,
  },

  // ───────────────────────── 행↔열 변환 ─────────────────────────
  {
    id: 'pivot', tier: 'appendix', group: '행↔열 변환',
    title: 'PIVOT',
    summary: '행에 있는 값을 열로 펼쳐 크로스탭을 만듭니다.',
    body: `
      \`PIVOT\`은 한 컬럼의 값들을 새 컬럼으로 펼치고 각 칸을 집계합니다(예: 월 × 카테고리 매출표). 어디서나 동작하는 대안은 \`SUM(CASE WHEN category = 'x' THEN amt END)\` 조건부 집계입니다.
      - 표준(Databricks 호환) 문법: \`FROM t PIVOT (집계 FOR 컬럼 IN (값1, 값2, …))\` — IN 목록 필요
      - DuckDB 간편 문법: \`PIVOT t ON 컬럼 USING 집계 GROUP BY 키\` — IN 목록 생략 시 값을 자동으로 찾아 펼침`,
    syntax: `SELECT * FROM (SELECT key, col, val FROM t)
PIVOT (SUM(val) FOR col IN ('a', 'b', 'c'))

PIVOT t ON col USING SUM(val) GROUP BY key   -- DuckDB`,
    examples: [
      { title: '결제수단 × 주문 상태 건수 (표준 문법)', code: `SELECT *
FROM (SELECT payment_method, status FROM orders)
PIVOT (COUNT(*) FOR status IN ('completed', 'cancelled', 'refunded'))
ORDER BY payment_method` },
      { title: '분기 × 카테고리 매출 (DuckDB 간편 문법)', code: `PIVOT (
  SELECT CAST(date_trunc('quarter', o.order_ts) AS DATE) AS quarter,
         p.category,
         oi.quantity * oi.unit_price AS amount
  FROM order_items oi
  JOIN orders o ON oi.order_id = o.order_id
  JOIN products p ON oi.product_id = p.product_id
)
ON category USING SUM(amount)
GROUP BY quarter
ORDER BY quarter` },
    ],
    tips: `
      - 표준 문법에서는 집계·FOR에 쓰지 않은 **나머지 모든 컬럼**이 자동으로 그룹 키가 됩니다. 서브쿼리로 필요한 컬럼만 남긴 뒤 PIVOT하세요.
      - 펼칠 값이 자주 바뀌면 컬럼 구조도 바뀝니다. 대시보드·후속 쿼리에는 긴(long) 형태가 더 안정적입니다.`,
    dbx: `Databricks는 표준 문법 \`PIVOT (agg FOR col IN (…))\`만 지원하며 IN 목록이 필수입니다. DuckDB의 \`PIVOT … ON … USING\` 간편 문법은 쓸 수 없습니다.`,
    related: ['sql-20'],
  },
  {
    id: 'unpivot', tier: 'appendix', group: '행↔열 변환',
    title: 'UNPIVOT',
    summary: '여러 열을 (이름, 값) 두 열의 행으로 접습니다.',
    body: `
      \`UNPIVOT\`은 PIVOT의 반대입니다. \`completed\`, \`cancelled\`, \`refunded\`처럼 지표가 옆으로 늘어선 넓은(wide) 표를 \`(status, cnt)\` 형태의 긴(long) 표로 바꿉니다. 시각화 도구나 후속 집계에 넣기 좋습니다.
      - 대안: 컬럼마다 SELECT해서 \`UNION ALL\`로 쌓기`,
    syntax: `SELECT * FROM wide
UNPIVOT (value_col FOR name_col IN (col1, col2, col3))`,
    examples: [
      { title: '결제수단별 상태 지표를 long 형태로', code: `WITH wide AS (
  SELECT payment_method,
         COUNT_IF(status = 'completed') AS completed,
         COUNT_IF(status = 'cancelled') AS cancelled,
         COUNT_IF(status = 'refunded') AS refunded
  FROM orders
  GROUP BY payment_method
)
SELECT *
FROM wide
UNPIVOT (cnt FOR status IN (completed, cancelled, refunded))
ORDER BY payment_method, status` },
    ],
    tips: `
      - 기본적으로 값이 NULL인 행은 결과에서 빠집니다. 남기려면 \`UNPIVOT INCLUDE NULLS (…)\`를 씁니다.
      - 접을 컬럼들의 타입이 같아야 합니다. 다르면 먼저 CAST로 맞추세요.`,
    dbx: `Databricks도 같은 표준 문법 \`UNPIVOT [INCLUDE | EXCLUDE NULLS] (val FOR name IN (…))\`을 지원합니다.`,
  },

  // ───────────────────────── 집합 심화 ─────────────────────────
  {
    id: 'except-intersect', tier: 'appendix', group: '집합 심화',
    title: 'EXCEPT · INTERSECT',
    summary: '두 결과의 차집합 · 교집합을 구합니다.',
    body: `
      - \`A EXCEPT B\` — A에는 있고 B에는 없는 행 (차집합)
      - \`A INTERSECT B\` — 양쪽 모두에 있는 행 (교집합)
      기본은 중복을 제거하며, 중복을 유지하려면 \`EXCEPT ALL\` / \`INTERSECT ALL\`을 씁니다. "11월엔 샀는데 12월엔 안 산 유저"처럼 **유저 목록끼리 비교**할 때 간결합니다.`,
    syntax: `SELECT key FROM a
EXCEPT
SELECT key FROM b`,
    examples: [
      { title: '11월 구매자 중 12월 이탈자 수 vs 연속 구매자 수', code: `WITH nov AS (
  SELECT user_id FROM orders
  WHERE order_ts >= '2025-11-01' AND order_ts < '2025-12-01'
),
dec AS (
  SELECT user_id FROM orders
  WHERE order_ts >= '2025-12-01' AND order_ts < '2026-01-01'
)
SELECT
  (SELECT COUNT(*) FROM (SELECT user_id FROM nov EXCEPT SELECT user_id FROM dec)) AS churned,
  (SELECT COUNT(*) FROM (SELECT user_id FROM nov INTERSECT SELECT user_id FROM dec)) AS retained` },
    ],
    tips: `
      - 비교할 컬럼만 SELECT하세요. 다른 컬럼(주문일 등)이 섞이면 행 전체가 달라져 차집합이 의도와 달라집니다.
      - 같은 결과를 \`NOT EXISTS\` / \`EXISTS\`로도 쓸 수 있고, 다른 컬럼도 함께 가져와야 하면 그쪽이 편합니다.`,
    dbx: `Databricks는 \`EXCEPT\`의 별칭으로 \`MINUS\`도 지원합니다.`,
  },

  // ───────────────────────── 재귀·날짜 생성 ─────────────────────────
  {
    id: 'recursive-cte', tier: 'appendix', group: '재귀·날짜 생성',
    title: '재귀 CTE (WITH RECURSIVE)',
    summary: '자기 자신을 참조하는 CTE로 계층 구조(조직도)나 수열을 만듭니다.',
    body: `
      \`WITH RECURSIVE\`는 **시작 행(앵커)**을 만든 뒤, 직전 단계 결과를 다시 조인해 행을 계속 추가합니다. 더 이상 새 행이 없으면 멈춥니다.
      - 조직도·카테고리 트리처럼 깊이를 모르는 계층 구조를 펼칠 때
      - 1, 2, 3 … 같은 수열이나 날짜 목록을 만들 때 (DuckDB에서는 \`generate_series\`가 더 간단)`,
    syntax: `WITH RECURSIVE r AS (
  SELECT …                 -- 앵커 (시작 행)
  UNION ALL
  SELECT … FROM t JOIN r ON …  -- 재귀 단계
)
SELECT * FROM r`,
    examples: [
      { title: '조직도 — 각 직원의 레벨과 보고 경로', code: `WITH RECURSIVE org AS (
  SELECT emp_id, name, manager_id, 1 AS lvl, name AS path
  FROM employees
  WHERE manager_id IS NULL
  UNION ALL
  SELECT e.emp_id, e.name, e.manager_id, o.lvl + 1, o.path || ' > ' || e.name
  FROM employees e
  JOIN org o ON e.manager_id = o.emp_id
)
SELECT emp_id, name, lvl, path
FROM org
ORDER BY path
LIMIT 8` },
      { title: '1부터 5까지 수열', code: `WITH RECURSIVE nums(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM nums WHERE n < 5
)
SELECT n FROM nums` },
    ],
    tips: `
      - 재귀 단계에 **종료 조건**(\`WHERE n < 5\`, 더 이상 매칭되는 자식이 없음)이 없으면 무한히 돕니다.
      - 데이터에 순환(A의 매니저가 B, B의 매니저가 A)이 있으면 끝나지 않습니다. 깊이 제한(\`WHERE lvl < 10\`)을 걸어 두면 안전합니다.`,
    dbx: `Databricks는 재귀 CTE를 오랫동안 지원하지 않다가 최근 런타임(DBR 17 무렵)부터 \`WITH RECURSIVE\`를 지원하기 시작했습니다. 사용하는 런타임 버전을 확인하세요.`,
  },
  {
    id: 'date-spine', tier: 'appendix', group: '재귀·날짜 생성',
    title: '날짜 채우기 (generate_series · range)',
    summary: '빈 날짜 없는 연속 날짜 목록(날짜 뼈대)을 만들어 0을 채웁니다.',
    body: `
      GROUP BY 결과에는 데이터가 없는 날짜가 **아예 나오지 않습니다**. 일별 차트·이동평균·LAG 계산 전에 연속된 날짜 목록을 만들고 LEFT JOIN해서 빈 날을 0으로 채웁니다.
      - \`generate_series(시작, 끝, INTERVAL 1 DAY)\` — 끝 **포함**
      - \`range(시작, 끝, INTERVAL 1 DAY)\` — 끝 **제외**
      DuckDB에서 결과는 TIMESTAMP이므로 \`CAST(… AS DATE)\`로 맞춥니다.`,
    syntax: `SELECT CAST(dt AS DATE) AS dt
FROM generate_series(DATE '2025-12-01', DATE '2025-12-31', INTERVAL 1 DAY) AS t(dt)`,
    examples: [
      { title: '12월 하순 일별 XMAS25 쿠폰 주문 수 (없는 날은 0)', code: `WITH days AS (
  SELECT CAST(dt AS DATE) AS dt
  FROM generate_series(DATE '2025-12-18', DATE '2025-12-31', INTERVAL 1 DAY) AS t(dt)
),
daily AS (
  SELECT CAST(order_ts AS DATE) AS dt, COUNT(*) AS orders
  FROM orders
  WHERE coupon_code = 'XMAS25'
  GROUP BY 1
)
SELECT d.dt, COALESCE(x.orders, 0) AS xmas25_orders
FROM days d
LEFT JOIN daily x ON d.dt = x.dt
ORDER BY d.dt` },
    ],
    tips: `
      - 날짜 뼈대가 **왼쪽**에 와야 합니다(\`days LEFT JOIN daily\`). 반대로 쓰면 빈 날이 그대로 빠집니다.
      - 조인 키 타입을 맞추세요. TIMESTAMP 뼈대와 DATE 컬럼을 비교하면 시각이 달라 매칭이 안 될 수 있습니다.`,
    dbx: `Databricks에서는 보통 \`SELECT explode(sequence(DATE'2025-12-01', DATE'2025-12-31', INTERVAL 1 DAY)) AS dt\`로 날짜 목록을 만듭니다(\`sequence\`는 끝 포함 배열을 돌려줌).`,
    related: ['sql-09'],
  },

  // ───────────────────────── 배열·JSON ─────────────────────────
  {
    id: 'arrays', tier: 'appendix', group: '배열·JSON',
    title: '배열 (list · array_agg · unnest · string_agg)',
    summary: '여러 행을 배열/문자열로 모으고, 배열을 다시 행으로 펼칩니다.',
    body: `
      - 모으기: \`list(x)\` = \`array_agg(x)\` (Databricks \`collect_list\`), 중복 제거는 \`list(DISTINCT x)\` (\`collect_set\`)
      - 문자열로 잇기: \`string_agg(x, ' > ' ORDER BY ts)\`
      - 펼치기: \`unnest(arr)\` (Databricks \`explode\`) — 배열 원소 하나당 한 행
      - 다루기: \`len(arr)\`(\`size\`), \`list_contains(arr, v)\`(\`array_contains\`), \`arr[1]\`
      세션별 이벤트 경로, 유저별 사용 카테고리 목록 같은 분석에 씁니다.`,
    syntax: `SELECT key, list(x ORDER BY ts) AS xs FROM t GROUP BY key
SELECT key, string_agg(x, ', ' ORDER BY ts) FROM t GROUP BY key
SELECT key, unnest(xs) AS x FROM t2`,
    examples: [
      { title: '가장 흔한 세션 이벤트 경로 Top 5', code: `WITH paths AS (
  SELECT session_id,
         string_agg(event_type, ' > ' ORDER BY event_ts, event_id) AS path
  FROM events
  GROUP BY session_id
)
SELECT path, COUNT(*) AS sessions
FROM paths
GROUP BY path
ORDER BY sessions DESC
LIMIT 5` },
      { title: '유저별 사용 결제수단 개수 분포 (array_agg + len)', code: `WITH u AS (
  SELECT user_id, array_agg(DISTINCT payment_method) AS methods
  FROM orders
  GROUP BY user_id
)
SELECT len(methods) AS n_methods, COUNT(*) AS users
FROM u
GROUP BY 1
ORDER BY 1` },
      { title: '배열을 행으로 펼치기 (unnest)', code: `WITH u AS (
  SELECT user_id, list(DISTINCT payment_method) AS methods
  FROM orders
  GROUP BY user_id
  HAVING len(list(DISTINCT payment_method)) >= 3
),
exploded AS (
  SELECT user_id, unnest(methods) AS method FROM u
)
SELECT method, COUNT(*) AS multi_method_users
FROM exploded
GROUP BY method
ORDER BY multi_method_users DESC` },
    ],
    tips: `
      - DuckDB 배열 인덱스는 **1부터**, Databricks \`arr[i]\`는 **0부터**입니다(\`element_at(arr, 1)\`은 1부터).
      - 순서가 중요하면 집계 안에 \`ORDER BY\`를 꼭 쓰세요. 없으면 원소 순서가 보장되지 않습니다.
      - \`unnest\`/\`explode\` 결과로 바로 GROUP BY할 수 없는 경우가 있습니다. CTE에서 먼저 펼친 뒤 바깥에서 집계하세요.`,
    dbx: `Databricks는 \`collect_list\`/\`collect_set\`(이 사이트에서도 동작), \`array_join(arr, sep)\`, \`explode\`/\`LATERAL VIEW explode\`, \`size\`를 씁니다. \`collect_list\`는 순서를 보장하지 않으므로, 순서가 필요하면 (ts, 값) 구조체를 모아 \`array_sort\`한 뒤 값을 꺼냅니다.`,
  },
  {
    id: 'json', tier: 'appendix', group: '배열·JSON',
    title: 'JSON 다루기',
    summary: '이벤트 로그의 JSON 문자열에서 필드를 꺼냅니다.',
    body: `
      이벤트 속성이 JSON 문자열로 저장된 로그가 많습니다. 경로(\`$.a.b\`)로 필드를 꺼내 일반 컬럼처럼 씁니다.
      - DuckDB: \`json_extract_string(j, '$.a.b')\` 또는 \`j ->> '$.a.b'\` (문자열), \`json_extract(j, '$.a')\` / \`->\` (JSON)
      - 숫자로 쓰려면 꺼낸 뒤 \`CAST\`합니다.`,
    syntax: `json_extract_string(json_col, '$.key.sub')
json_col ->> '$.key'`,
    examples: [
      { title: 'JSON 속성에서 플랫폼을 꺼내 집계', noBrowser: true, code: `WITH logs AS (
  SELECT event_id,
         json_object('type', event_type,
                     'ctx', json_object('platform', platform, 'ver', app_version)) AS payload
  FROM events
  WHERE event_type = 'purchase'
)
SELECT json_extract_string(payload, '$.ctx.platform') AS platform,
       COUNT(*) AS purchases
FROM logs
GROUP BY 1
ORDER BY purchases DESC` },
    ],
    tips: `
      - 같은 JSON 필드를 여러 쿼리에서 반복해서 꺼낸다면, 한 번 파싱해 컬럼으로 만든 테이블/뷰를 두는 편이 빠르고 읽기 쉽습니다.
      - 없는 경로는 오류 대신 NULL을 돌려줍니다. 오타가 조용히 NULL로 숨겨지지 않는지 NULL 비율을 확인하세요.`,
    dbx: `Databricks는 콜론 문법 \`payload:ctx.platform\`과 \`get_json_object(payload, '$.ctx.platform')\`, 스키마를 주는 \`from_json\`을 씁니다.`,
  },

  // ───────────────────────── 정규식·형 변환 ─────────────────────────
  {
    id: 'regex', tier: 'appendix', group: '정규식·형 변환',
    title: '정규식 (regexp_matches · regexp_extract · regexp_replace)',
    summary: '패턴으로 문자열을 검사·추출·치환합니다 (엔진별 기본값 차이 주의).',
    body: `
      - \`regexp_matches(s, 패턴)\` — 패턴이 들어 있으면 TRUE (부분 일치)
      - \`regexp_extract(s, 패턴, 그룹)\` — 일치한 부분(또는 n번째 괄호 그룹)을 추출
      - \`regexp_replace(s, 패턴, 바꿀값, 'g')\` — 패턴을 치환. DuckDB는 \`'g'\` 옵션이 있어야 **전부** 바꿉니다.`,
    syntax: `regexp_matches(s, 'pattern')
regexp_extract(s, '(grp1)(grp2)', 2)
regexp_replace(s, 'pattern', 'replacement', 'g')`,
    examples: [
      { title: '쿠폰 코드를 이름과 할인율로 분리', code: `SELECT coupon_code,
       regexp_extract(coupon_code, '([A-Z]+)([0-9]+)', 1) AS campaign,
       CAST(regexp_extract(coupon_code, '([A-Z]+)([0-9]+)', 2) AS INTEGER) AS pct,
       COUNT(*) AS orders
FROM orders
WHERE coupon_code IS NOT NULL
GROUP BY 1, 2, 3
ORDER BY orders DESC` },
      { title: '상품명에서 등급(Basic/Plus/Pro)을 떼어 제품 라인별 집계', code: `SELECT regexp_replace(product_name, ' (Basic|Plus|Pro)$', '') AS product_line,
       COUNT(*) AS variants,
       MIN(price) AS min_price,
       MAX(price) AS max_price
FROM products
WHERE category = 'electronics'
GROUP BY 1
ORDER BY max_price DESC
LIMIT 5` },
      { title: '앱 버전 5.2.x 비율 (regexp_matches)', code: `SELECT regexp_matches(app_version, '^5[.]2[.]') AS is_v52,
       COUNT(*) AS events
FROM events
WHERE platform <> 'web'
GROUP BY 1` },
    ],
    tips: `
      - **그룹 기본값이 다릅니다**: DuckDB \`regexp_extract(s, p)\`는 그룹 0(전체 일치), Databricks는 그룹 **1**이 기본입니다. 항상 그룹 번호를 명시하세요.
      - **치환 범위가 다릅니다**: DuckDB \`regexp_replace\`는 \`'g'\` 없이 첫 번째만, Databricks는 기본으로 모두 바꿉니다.
      - 백슬래시 대신 \`[0-9]\`, \`[.]\`처럼 문자 클래스를 쓰면 엔진별 이스케이프 차이를 피할 수 있습니다.`,
    dbx: `패턴 일치 여부는 \`s RLIKE 'p'\`(= \`regexp\`, \`regexp_like\`)로 검사합니다. Databricks 문자열 리터럴은 백슬래시를 이스케이프로 처리하므로 \`\\d\`는 \`'\\\\d'\` 또는 raw 문자열 \`r'\\d'\`로 씁니다.`,
  },
  {
    id: 'try-cast', tier: 'appendix', group: '정규식·형 변환',
    title: 'TRY_CAST',
    summary: '변환에 실패하면 오류 대신 NULL을 돌려줍니다.',
    body: `
      지저분한 원천 데이터(숫자 컬럼에 섞인 \`'web'\`, \`'N/A'\` 등)를 변환할 때 \`CAST\`는 한 행만 잘못돼도 쿼리 전체가 실패합니다. \`TRY_CAST\`는 실패한 값만 NULL로 바꿔 줍니다.`,
    syntax: `TRY_CAST(expr AS type)`,
    examples: [
      { title: '앱 버전의 메이저 번호를 정수로 (web은 NULL)', code: `SELECT TRY_CAST(SPLIT_PART(app_version, '.', 1) AS INTEGER) AS major,
       COUNT(*) AS events
FROM events
GROUP BY 1
ORDER BY 1 NULLS LAST` },
      { title: '변환에 실패한 원본 값 확인', code: `SELECT app_version, COUNT(*) AS failed_rows
FROM events
WHERE TRY_CAST(SPLIT_PART(app_version, '.', 1) AS INTEGER) IS NULL
GROUP BY app_version` },
    ],
    tips: `
      - TRY_CAST는 문제를 **숨깁니다**. 변환 실패 건수(NULL로 바뀐 행)를 꼭 따로 세어 데이터 품질을 확인하세요.`,
    dbx: `Databricks도 \`try_cast\`를 지원합니다. ANSI 모드(기본)에서는 CAST 실패가 오류이므로 더 자주 쓰이며, \`try_divide\`, \`try_to_number\` 등 try_ 계열 함수도 있습니다.`,
  },

  // ───────────────────────── 테이블 만들기·수정 ─────────────────────────
  {
    id: 'ddl', tier: 'appendix', group: '테이블 만들기·수정',
    title: 'CREATE TABLE AS · VIEW',
    summary: '쿼리 결과를 테이블(CTAS)이나 뷰로 저장합니다.',
    body: `
      - \`CREATE TABLE 이름 AS SELECT …\`(CTAS) — 결과를 **물리 테이블**로 저장. 무거운 중간 집계를 재사용할 때
      - \`CREATE VIEW 이름 AS SELECT …\` — 쿼리만 저장, 조회할 때마다 다시 실행
      - \`CREATE OR REPLACE …\`로 덮어쓰고, \`TEMP\`(임시)는 세션이 끝나면 사라집니다.
      이 사이트 편집기에서도 실행되지만 브라우저 메모리에만 있어 새로고침하면 사라집니다. 아래 예제는 저장할 SELECT 부분입니다.`,
    syntax: `CREATE OR REPLACE TABLE daily_sales AS
SELECT …;

CREATE OR REPLACE TEMP VIEW v_completed AS
SELECT * FROM orders WHERE status = 'completed';`,
    examples: [
      { title: 'CTAS로 저장할 일별 매출 마트 미리 보기', code: `SELECT CAST(order_ts AS DATE) AS dt,
       COUNT(*) AS orders,
       COUNT(DISTINCT user_id) AS buyers,
       SUM(total_amount) AS revenue
FROM orders
WHERE status = 'completed'
GROUP BY 1
ORDER BY 1 DESC
LIMIT 5` },
    ],
    tips: `
      - 원본 테이블 이름(\`orders\` 등)으로 \`CREATE OR REPLACE\`하면 원본을 덮어씁니다. 결과 테이블 이름은 접두어(\`tmp_\`, \`mart_\`)로 구분하세요.
      - 뷰는 항상 최신 데이터를 보여주지만 매번 다시 계산합니다. 자주 조회하는 무거운 집계는 테이블로 저장합니다.`,
    dbx: `Databricks에서는 기본이 Delta 테이블이며 \`catalog.schema.table\` 3단계 이름을 씁니다. 임시 뷰는 \`CREATE TEMP VIEW\`로 세션 동안만 존재합니다.`,
  },
  {
    id: 'dml', tier: 'appendix', group: '테이블 만들기·수정',
    title: 'INSERT · UPDATE · DELETE',
    summary: '테이블에 행을 추가·수정·삭제합니다.',
    body: `
      - \`INSERT INTO t SELECT …\` / \`INSERT INTO t VALUES (…), (…)\` — 행 추가
      - \`UPDATE t SET col = 값 WHERE 조건\` — 조건에 맞는 행 수정
      - \`DELETE FROM t WHERE 조건\` — 조건에 맞는 행 삭제
      분석가는 직접 쓸 일이 적지만, 마트 적재 쿼리를 읽거나 임시 테이블을 다룰 때 필요합니다. 실행 전에는 **같은 WHERE로 SELECT해서 대상 행을 먼저 확인**하는 습관이 중요합니다.`,
    syntax: `INSERT INTO t (col1, col2) VALUES ('a', 1), ('b', 2);
UPDATE t SET col2 = 0 WHERE col1 = 'a';
DELETE FROM t WHERE col2 IS NULL;`,
    examples: [
      { title: 'DELETE 전에 대상 행 수 확인', code: `SELECT status, COUNT(*) AS rows_to_delete
FROM orders
WHERE status = 'cancelled' AND order_ts < '2025-02-01'
GROUP BY status` },
      { title: 'VALUES로 만든 임시 매핑 표를 조인 (INSERT … VALUES와 같은 형태)', code: `SELECT m.campaign, COUNT(*) AS orders
FROM orders o
JOIN (VALUES ('WELCOME10', '신규 가입'),
             ('XMAS25', '크리스마스'),
             ('SUMMER20', '여름 세일')) AS m(coupon_code, campaign)
  ON o.coupon_code = m.coupon_code
GROUP BY m.campaign
ORDER BY orders DESC` },
    ],
    tips: `
      - \`WHERE\` 없는 \`UPDATE\`/\`DELETE\`는 **모든 행**에 적용됩니다.
      - 대량 수정은 트랜잭션으로 묶거나, 새 테이블을 CTAS로 만든 뒤 교체하는 편이 안전합니다.`,
    dbx: `Delta 테이블은 \`UPDATE\`/\`DELETE\`와 함께 업서트용 \`MERGE INTO … WHEN MATCHED … WHEN NOT MATCHED …\`를 많이 쓰며, 실수했을 때 \`RESTORE\`나 time travel(\`VERSION AS OF\`)로 되돌릴 수 있습니다.`,
  },
];
