// SQL / pandas 연습 문제 (자동 채점)
// - lang: 'sql' 문제는 DuckDB에서, 'pandas' 문제는 Pyodide에서 실행/채점
// - 채점: 컬럼 '이름'은 무시하고 컬럼 수/행 수/값을 비교 (숫자는 소수 4자리까지)
// - orderMatters: true 면 행 순서까지 채점
// - sqlSolution/pandasSolution: 다른 언어 풀이 (학습용, tests 에서 결과 일치 여부를 검증)

export const LEVEL_NAME = { 1: '초급', 2: '중급', 3: '고급' };

export const PROBLEMS = [
  // ───────────── SQL ─────────────
  {
    id: 'sql-01', lang: 'sql', level: 1, topics: ['GROUP BY', 'ORDER BY'],
    title: '국가별 가입자 수',
    prompt: `
      \`users\` 테이블에서 **국가(country)별 가입자 수**를 구하세요.
      - 컬럼: \`country\`, \`users\`
      - 정렬: 가입자 수 내림차순`,
    hint: '`GROUP BY country` 후 `COUNT(*)`, `ORDER BY users DESC`',
    solution: `SELECT country, COUNT(*) AS users
FROM users
GROUP BY country
ORDER BY users DESC`,
    pandasSolution: `result = (users.groupby('country').size()
          .reset_index(name='users')
          .sort_values('users', ascending=False))`,
    orderMatters: true,
    explanation: '가장 기본적인 집계입니다. `COUNT(*)`는 행 수, `COUNT(DISTINCT user_id)`는 고유 유저 수입니다. users 테이블은 유저당 1행이므로 둘의 결과가 같습니다.',
  },
  {
    id: 'sql-02', lang: 'sql', level: 1, topics: ['WHERE', 'HAVING'],
    title: '누적 결제 30만 원 이상 고객',
    prompt: `
      **완료(status = 'completed')된 주문**만 기준으로, 누적 결제금액(\`total_amount\` 합계)이 **300,000원 이상**인 유저를 구하세요.
      - 컬럼: \`user_id\`, \`revenue\`
      - 정렬: revenue 내림차순, 같으면 user_id 오름차순`,
    hint: '행 조건(status)은 WHERE, 집계 조건(SUM)은 HAVING에 둡니다.',
    solution: `SELECT user_id, SUM(total_amount) AS revenue
FROM orders
WHERE status = 'completed'
GROUP BY user_id
HAVING SUM(total_amount) >= 300000
ORDER BY revenue DESC, user_id`,
    pandasSolution: `done = orders[orders['status'] == 'completed']
rev = done.groupby('user_id', as_index=False)['total_amount'].sum().rename(columns={'total_amount': 'revenue'})
result = rev[rev['revenue'] >= 300000].sort_values(['revenue', 'user_id'], ascending=[False, True])`,
    orderMatters: true,
    explanation: 'WHERE는 집계 전 행을, HAVING은 집계 후 그룹을 거릅니다. 정렬 기준이 동점일 때 결과가 매번 달라지지 않도록 **보조 정렬 키(user_id)**를 넣는 습관이 중요합니다.',
  },
  {
    id: 'sql-03', lang: 'sql', level: 1, topics: ['NULL', 'COUNT'],
    title: '결제수단별 쿠폰 사용률',
    prompt: `
      \`orders\` 테이블에서 **결제수단(payment_method)별** 전체 주문 수, 쿠폰 사용 주문 수, 쿠폰 사용률을 구하세요.
      쿠폰을 쓰지 않은 주문은 \`coupon_code\`가 NULL입니다.
      - 컬럼: \`payment_method\`, \`orders\`, \`coupon_orders\`, \`coupon_rate\`
      - 정렬: payment_method 오름차순`,
    hint: '`COUNT(*)`는 모든 행, `COUNT(coupon_code)`는 NULL이 아닌 행만 셉니다.',
    solution: `SELECT payment_method,
       COUNT(*) AS orders,
       COUNT(coupon_code) AS coupon_orders,
       COUNT(coupon_code) * 1.0 / COUNT(*) AS coupon_rate
FROM orders
GROUP BY payment_method
ORDER BY payment_method`,
    pandasSolution: `g = orders.groupby('payment_method')
result = pd.DataFrame({
    'orders': g.size(),
    'coupon_orders': g['coupon_code'].count(),   # count()는 NaN 제외
})
result['coupon_rate'] = result['coupon_orders'] / result['orders']
result = result.reset_index().sort_values('payment_method')`,
    orderMatters: true,
    explanation: '`COUNT(col)`이 NULL을 세지 않는 성질을 이용하면 CASE WHEN 없이도 비율을 구할 수 있습니다. pandas의 `count()`도 NaN을 제외합니다 (`size()`는 포함).',
  },
  {
    id: 'sql-04', lang: 'sql', level: 1, topics: ['LEFT JOIN', 'IS NULL'],
    title: '한 번도 주문하지 않은 유저',
    prompt: `
      가입은 했지만 **주문 기록이 전혀 없는 유저 수**를 유입 채널(channel)별로 구하세요. (주문 상태는 무관)
      - 컬럼: \`channel\`, \`users_without_order\`
      - 정렬: channel 오름차순`,
    hint: '`users LEFT JOIN orders` 후 `o.order_id IS NULL` 또는 `NOT EXISTS`',
    solution: `SELECT u.channel, COUNT(*) AS users_without_order
FROM users u
LEFT JOIN orders o ON u.user_id = o.user_id
WHERE o.order_id IS NULL
GROUP BY u.channel
ORDER BY u.channel`,
    pandasSolution: `no_order = users[~users['user_id'].isin(orders['user_id'])]
result = (no_order.groupby('channel').size()
          .reset_index(name='users_without_order')
          .sort_values('channel'))`,
    orderMatters: true,
    explanation: 'ANTI JOIN 패턴입니다. `NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.user_id)`도 같은 결과입니다. `NOT IN`은 서브쿼리에 NULL이 있으면 결과가 비어버리므로 주의하세요.',
  },
  {
    id: 'sql-05', lang: 'sql', level: 2, topics: ['ROW_NUMBER', 'QUALIFY', '중복 제거'],
    title: '유저별 가장 최근 주문 1건',
    prompt: `
      유저별로 **가장 최근(order_ts가 가장 늦은) 주문 1건**만 남기세요. (상태 무관)
      - 컬럼: \`user_id\`, \`order_id\`, \`order_ts\`, \`total_amount\``,
    hint: '`ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY order_ts DESC)` = 1 인 행. `QUALIFY`를 쓰면 서브쿼리가 필요 없습니다.',
    solution: `SELECT user_id, order_id, order_ts, total_amount
FROM orders
QUALIFY ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY order_ts DESC, order_id DESC) = 1`,
    pandasSolution: `result = (orders.sort_values(['user_id', 'order_ts', 'order_id'])
          .drop_duplicates('user_id', keep='last')
          [['user_id', 'order_id', 'order_ts', 'total_amount']])`,
    orderMatters: false,
    explanation: '"그룹별 1건" 문제의 정석입니다. `QUALIFY`는 Databricks SQL과 DuckDB 모두 지원합니다. 같은 시각 주문이 있을 수 있으니 order_id를 보조 정렬 키로 둬서 결과를 결정적으로 만듭니다.',
  },
  {
    id: 'sql-06', lang: 'sql', level: 2, topics: ['DENSE_RANK', '서브쿼리'],
    title: '두 번째로 높은 급여',
    prompt: `
      \`employees\` 테이블에서 **두 번째로 높은 급여**를 구하세요. 동점은 같은 순위로 봅니다.
      - 컬럼: \`second_highest\` (1행)`,
    hint: '`DENSE_RANK() OVER (ORDER BY salary DESC)` = 2, 또는 `MAX(salary) WHERE salary < (SELECT MAX(salary) ...)`',
    solution: `SELECT MAX(salary) AS second_highest
FROM (
  SELECT salary, DENSE_RANK() OVER (ORDER BY salary DESC) AS rk
  FROM employees
)
WHERE rk = 2`,
    pandasSolution: `vals = employees['salary'].drop_duplicates().nlargest(2)
result = pd.DataFrame({'second_highest': [vals.iloc[1] if len(vals) > 1 else None]})`,
    orderMatters: true,
    explanation: '바깥에 `MAX()`를 씌우면 2등이 없을 때 빈 결과 대신 NULL이 반환됩니다. N번째로 일반화하려면 `rk = N`만 바꾸면 됩니다.',
  },
  {
    id: 'sql-07', lang: 'sql', level: 2, topics: ['DENSE_RANK', 'PARTITION BY', 'JOIN'],
    title: '부서별 급여 상위 2위까지',
    prompt: `
      부서별로 급여 **상위 2위까지**의 직원을 구하세요. 동점이면 모두 포함합니다 (DENSE_RANK 기준). 부서가 없는 직원은 제외합니다.
      - 컬럼: \`dept_name\`, \`name\`, \`salary\`, \`rk\``,
    hint: '`DENSE_RANK() OVER (PARTITION BY dept_id ORDER BY salary DESC)` 후 rk <= 2',
    solution: `SELECT d.dept_name, e.name, e.salary,
       DENSE_RANK() OVER (PARTITION BY e.dept_id ORDER BY e.salary DESC) AS rk
FROM employees e
JOIN departments d ON e.dept_id = d.dept_id
QUALIFY rk <= 2`,
    pandasSolution: `df = employees.merge(departments, on='dept_id')
df['rk'] = df.groupby('dept_id')['salary'].rank(method='dense', ascending=False).astype(int)
result = df[df['rk'] <= 2][['dept_name', 'name', 'salary', 'rk']]`,
    orderMatters: false,
    explanation: 'pandas의 `rank(method=...)`는 SQL과 대응됩니다: `first`=ROW_NUMBER, `min`=RANK, `dense`=DENSE_RANK. 샘플 데이터에는 동점 급여가 있어서 ROW_NUMBER를 쓰면 오답이 됩니다.',
  },
  {
    id: 'sql-08', lang: 'sql', level: 1, topics: ['CTE', 'JOIN', 'date_trunc'],
    title: '월별 신규 가입자와 첫 구매자',
    prompt: `
      월별 **신규 가입자 수**와, 그 달에 **첫 완료 주문을 한 유저 수**를 하나의 표로 만드세요.
      - 첫 구매 월 = 유저의 completed 주문 중 가장 이른 order_ts의 월
      - 컬럼: \`month\`(월 첫날, DATE), \`new_users\`, \`first_buyers\`
      - 정렬: month 오름차순`,
    hint: 'CTE 두 개(월별 가입, 월별 첫 구매)를 만든 뒤 month로 JOIN 합니다.',
    solution: `WITH signups AS (
  SELECT date_trunc('month', signup_date) AS month, COUNT(*) AS new_users
  FROM users GROUP BY 1
),
first_orders AS (
  SELECT user_id, MIN(order_ts) AS first_ts
  FROM orders WHERE status = 'completed' GROUP BY user_id
),
buyers AS (
  SELECT CAST(date_trunc('month', first_ts) AS DATE) AS month, COUNT(*) AS first_buyers
  FROM first_orders GROUP BY 1
)
SELECT s.month, s.new_users, COALESCE(b.first_buyers, 0) AS first_buyers
FROM signups s
LEFT JOIN buyers b USING (month)
ORDER BY s.month`,
    pandasSolution: `s = users.groupby(users['signup_date'].dt.to_period('M')).size().rename('new_users')
first = orders[orders['status'] == 'completed'].groupby('user_id')['order_ts'].min()
b = first.groupby(first.dt.to_period('M')).size().rename('first_buyers')
result = pd.concat([s, b], axis=1).fillna(0).astype(int).sort_index()
result.index = result.index.to_timestamp()
result = result.reset_index(names='month')`,
    orderMatters: true,
    explanation: 'CTE로 단계를 나누면 각 단계를 따로 실행해 검증할 수 있습니다. 첫 구매는 "유저별 MIN"을 먼저 구한 뒤 월로 집계해야 합니다 (월별로 바로 COUNT DISTINCT하면 재구매자가 매달 중복 집계됨).',
  },
  {
    id: 'sql-09', lang: 'sql', level: 2, topics: ['윈도우 프레임', '이동평균', '누적합'],
    title: '일별 매출 7일 이동평균과 누적 매출',
    prompt: `
      완료 주문 기준 **일별 매출**과 **7일 이동평균**(현재 행 포함 직전 7개 행), **누적 매출**을 구하세요. (주문이 있는 날만)
      - 컬럼: \`dt\`(DATE), \`revenue\`, \`ma7\`, \`cum_revenue\`
      - 정렬: dt 오름차순`,
    hint: '`AVG(revenue) OVER (ORDER BY dt ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)`',
    solution: `WITH daily AS (
  SELECT CAST(order_ts AS DATE) AS dt, SUM(total_amount) AS revenue
  FROM orders
  WHERE status = 'completed'
  GROUP BY 1
)
SELECT dt, revenue,
       AVG(revenue) OVER (ORDER BY dt ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS ma7,
       SUM(revenue) OVER (ORDER BY dt ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cum_revenue
FROM daily
ORDER BY dt`,
    pandasSolution: `done = orders[orders['status'] == 'completed']
daily = done.groupby(done['order_ts'].dt.normalize())['total_amount'].sum().rename('revenue').to_frame()
daily['ma7'] = daily['revenue'].rolling(7, min_periods=1).mean()
daily['cum_revenue'] = daily['revenue'].cumsum()
result = daily.reset_index(names='dt')`,
    orderMatters: true,
    explanation: '`ROWS`는 "행 7개"입니다. 주문이 없는 날이 있으면 실제로는 7일보다 긴 기간의 평균이 되므로, 정확한 "7일" 평균이 필요하면 날짜 테이블과 LEFT JOIN 하거나 `RANGE BETWEEN INTERVAL 6 DAYS PRECEDING AND CURRENT ROW`를 사용합니다. pandas에서는 `rolling(\'7D\')`가 RANGE에 해당합니다.',
  },
  {
    id: 'sql-10', lang: 'sql', level: 2, topics: ['LAG', '증감률'],
    title: '월별 매출과 전월 대비 증감률(MoM)',
    prompt: `
      완료 주문 기준 **월별 매출**, **전월 매출**, **전월 대비 증감률**을 구하세요.
      - 증감률 = (이번 달 - 전월) / 전월 (첫 달은 NULL)
      - 컬럼: \`month\`(DATE), \`revenue\`, \`prev_revenue\`, \`mom_rate\`
      - 정렬: month 오름차순`,
    hint: '`LAG(revenue) OVER (ORDER BY month)`',
    solution: `WITH m AS (
  SELECT CAST(date_trunc('month', order_ts) AS DATE) AS month, SUM(total_amount) AS revenue
  FROM orders WHERE status = 'completed'
  GROUP BY 1
)
SELECT month, revenue,
       LAG(revenue) OVER (ORDER BY month) AS prev_revenue,
       (revenue - LAG(revenue) OVER (ORDER BY month)) * 1.0 / LAG(revenue) OVER (ORDER BY month) AS mom_rate
FROM m
ORDER BY month`,
    pandasSolution: `done = orders[orders['status'] == 'completed']
m = done.groupby(done['order_ts'].dt.to_period('M'))['total_amount'].sum().rename('revenue').to_frame()
m['prev_revenue'] = m['revenue'].shift(1)
m['mom_rate'] = m['revenue'].pct_change()
m.index = m.index.to_timestamp()
result = m.reset_index(names='month')`,
    orderMatters: true,
    explanation: '`LAG(x, n)`는 n행 전 값을 가져옵니다. 같은 윈도우를 여러 번 쓴다면 `WINDOW w AS (ORDER BY month)`로 이름을 붙이면 깔끔합니다. pandas에서는 `shift()`와 `pct_change()`가 대응합니다.',
  },
  {
    id: 'sql-11', lang: 'sql', level: 2, topics: ['JOIN 3개', '윈도우 SUM', '비중'],
    title: '카테고리별 매출과 비중',
    prompt: `
      완료 주문의 주문 상세(\`order_items\`)를 기준으로 **카테고리별 매출**(quantity × unit_price 합계)과 **전체 대비 비중**을 구하세요.
      - 컬럼: \`category\`, \`revenue\`, \`share\`
      - 정렬: revenue 내림차순`,
    hint: '`SUM(revenue) OVER ()`는 전체 합계를 각 행에 붙여줍니다.',
    solution: `SELECT p.category,
       SUM(oi.quantity * oi.unit_price) AS revenue,
       SUM(oi.quantity * oi.unit_price) * 1.0 / SUM(SUM(oi.quantity * oi.unit_price)) OVER () AS share
FROM order_items oi
JOIN orders o   ON oi.order_id = o.order_id AND o.status = 'completed'
JOIN products p ON oi.product_id = p.product_id
GROUP BY p.category
ORDER BY revenue DESC`,
    pandasSolution: `df = (order_items
      .merge(orders.loc[orders['status'] == 'completed', ['order_id']], on='order_id')
      .merge(products[['product_id', 'category']], on='product_id'))
df['amount'] = df['quantity'] * df['unit_price']
result = df.groupby('category', as_index=False)['amount'].sum().rename(columns={'amount': 'revenue'})
result['share'] = result['revenue'] / result['revenue'].sum()
result = result.sort_values('revenue', ascending=False)`,
    orderMatters: true,
    explanation: '`SUM(SUM(x)) OVER ()`처럼 집계 결과 위에 윈도우 함수를 겹쳐 쓸 수 있습니다 (집계 → 윈도우 순서로 실행). 할인 전 상품 금액 기준이라 orders.total_amount 합계와는 다릅니다. 어떤 금액 기준인지 명시하는 것이 실무에서 중요합니다.',
  },
  {
    id: 'sql-12', lang: 'sql', level: 2, topics: ['퍼널', 'CASE WHEN', '조건부 집계'],
    title: '플랫폼별 세션 퍼널 전환율',
    prompt: `
      \`events\`에서 **세션(session_id) 기준** 퍼널을 플랫폼별로 구하세요.
      - 각 단계에 도달한 세션 수: visit, view_item, add_to_cart, purchase
      - overall_cvr = purchase 세션 / visit 세션
      - 컬럼: \`platform\`, \`visits\`, \`views\`, \`carts\`, \`purchases\`, \`overall_cvr\`
      - 정렬: platform 오름차순`,
    hint: '세션별로 `MAX(CASE WHEN event_type = ... THEN 1 ELSE 0 END)` 플래그를 만든 뒤 플랫폼별 SUM',
    solution: `WITH s AS (
  SELECT session_id, platform,
         MAX(CASE WHEN event_type = 'visit' THEN 1 ELSE 0 END) AS visit,
         MAX(CASE WHEN event_type = 'view_item' THEN 1 ELSE 0 END) AS view_item,
         MAX(CASE WHEN event_type = 'add_to_cart' THEN 1 ELSE 0 END) AS cart,
         MAX(CASE WHEN event_type = 'purchase' THEN 1 ELSE 0 END) AS purchase
  FROM events
  GROUP BY session_id, platform
)
SELECT platform,
       SUM(visit) AS visits, SUM(view_item) AS views, SUM(cart) AS carts, SUM(purchase) AS purchases,
       SUM(purchase) * 1.0 / SUM(visit) AS overall_cvr
FROM s
GROUP BY platform
ORDER BY platform`,
    pandasSolution: `flags = (pd.crosstab([events['session_id'], events['platform']], events['event_type']) > 0).astype(int)
g = flags.groupby(level='platform').sum()
result = pd.DataFrame({
    'visits': g['visit'], 'views': g['view_item'], 'carts': g['add_to_cart'], 'purchases': g['purchase'],
})
result['overall_cvr'] = result['purchases'] / result['visits']
result = result.reset_index().sort_values('platform')`,
    orderMatters: true,
    explanation: '이벤트 수가 아니라 **세션 단위 도달 여부**로 세는 것이 핵심입니다. 결과를 보면 web의 구매 전환율이 앱보다 낮은데, 다음 단계로는 "어느 단계에서 이탈이 큰가?"(views→carts, carts→purchases)를 쪼개 봅니다.',
  },
  {
    id: 'sql-13', lang: 'sql', level: 3, topics: ['LEFT JOIN', '집계 후 조인', '단위경제'],
    title: '유입 채널별 구매율과 ARPU',
    prompt: `
      유입 채널별 **유저 수**, **구매 유저 비율**(완료 주문이 1건 이상인 유저 / 전체 유저), **ARPU**(완료 주문 매출 합계 / 전체 유저)를 구하세요.
      - 컬럼: \`channel\`, \`users\`, \`buyer_rate\`, \`arpu\`
      - 정렬: arpu 내림차순`,
    hint: '주문을 **유저별로 먼저 집계**한 뒤 users에 LEFT JOIN 하면 팬아웃(행 증식)이 생기지 않습니다.',
    solution: `WITH rev AS (
  SELECT user_id, SUM(total_amount) AS revenue
  FROM orders WHERE status = 'completed'
  GROUP BY user_id
)
SELECT u.channel,
       COUNT(*) AS users,
       COUNT(r.user_id) * 1.0 / COUNT(*) AS buyer_rate,
       COALESCE(SUM(r.revenue), 0) * 1.0 / COUNT(*) AS arpu
FROM users u
LEFT JOIN rev r ON u.user_id = r.user_id
GROUP BY u.channel
ORDER BY arpu DESC`,
    pandasSolution: `rev = orders[orders['status'] == 'completed'].groupby('user_id')['total_amount'].sum().rename('revenue')
df = users.merge(rev, left_on='user_id', right_index=True, how='left')
result = df.groupby('channel').agg(
    users=('user_id', 'size'),
    buyer_rate=('revenue', lambda s: s.notna().mean()),
    arpu=('revenue', lambda s: s.fillna(0).sum() / len(s)),
).reset_index().sort_values('arpu', ascending=False)`,
    orderMatters: true,
    explanation: 'paid_search 유저는 초기 전환은 높지만 리텐션이 낮아 ARPU가 가장 낮습니다. 채널 효율은 첫 전환이 아니라 **코호트 단위 LTV**로 비교해야 한다는 면접 포인트로 연결됩니다.',
  },
  {
    id: 'sql-14', lang: 'sql', level: 3, topics: ['코호트', '리텐션', 'datediff'],
    title: '가입 월 코호트 리텐션 (0~3개월차)',
    prompt: `
      2025년 1~6월 가입 코호트에 대해 **월별 리텐션**을 구하세요.
      - 코호트 = 가입 월, 활동 = 해당 월에 events 기록이 1건 이상
      - month_n = 활동 월 - 가입 월 (0, 1, 2, 3만)
      - retention = 활동 유저 수 / **코호트 전체 인원**
      - 컬럼: \`cohort_month\`(DATE), \`month_n\`, \`active_users\`, \`retention\`
      - 정렬: cohort_month, month_n`,
    hint: '코호트 CTE와 (user_id, 활동 월) DISTINCT CTE를 조인하고, 분모는 코호트 인원을 따로 구해 붙입니다. `datediff(\'month\', a, b)`',
    solution: `WITH cohort AS (
  SELECT user_id, CAST(date_trunc('month', signup_date) AS DATE) AS cohort_month
  FROM users
  WHERE signup_date < DATE '2025-07-01'
),
size AS (
  SELECT cohort_month, COUNT(*) AS cohort_size FROM cohort GROUP BY 1
),
activity AS (
  SELECT DISTINCT user_id, CAST(date_trunc('month', event_ts) AS DATE) AS active_month
  FROM events
),
j AS (
  SELECT c.cohort_month, datediff('month', c.cohort_month, a.active_month) AS month_n, c.user_id
  FROM cohort c JOIN activity a USING (user_id)
)
SELECT j.cohort_month, j.month_n,
       COUNT(DISTINCT j.user_id) AS active_users,
       COUNT(DISTINCT j.user_id) * 1.0 / s.cohort_size AS retention
FROM j JOIN size s USING (cohort_month)
WHERE j.month_n BETWEEN 0 AND 3
GROUP BY j.cohort_month, j.month_n, s.cohort_size
ORDER BY 1, 2`,
    pandasSolution: `u = users[users['signup_date'] < '2025-07-01'][['user_id', 'signup_date']].copy()
u['cohort'] = u['signup_date'].dt.to_period('M')
size = u.groupby('cohort').size()
act = events[['user_id', 'event_ts']].copy()
act['active'] = act['event_ts'].dt.to_period('M')
act = act[['user_id', 'active']].drop_duplicates()
j = u.merge(act, on='user_id')
j['month_n'] = (j['active'] - j['cohort']).apply(lambda d: d.n)
j = j[j['month_n'].between(0, 3)]
result = j.groupby(['cohort', 'month_n'])['user_id'].nunique().rename('active_users').reset_index()
result['retention'] = result['active_users'] / result['cohort'].map(size)
result['cohort'] = result['cohort'].dt.to_timestamp()
result = result.rename(columns={'cohort': 'cohort_month'}).sort_values(['cohort_month', 'month_n'])`,
    orderMatters: true,
    explanation: '분모를 "활동 테이블과 조인된 인원"으로 세면 한 번도 활동하지 않은 유저가 빠져 리텐션이 부풀려집니다. 결과를 피벗하면(행=코호트, 열=month_n) 익숙한 코호트 히트맵이 됩니다.',
  },
  {
    id: 'sql-15', lang: 'sql', level: 3, topics: ['Gaps & Islands', 'ROW_NUMBER'],
    title: '3일 연속 접속한 유저 수',
    prompt: `
      \`events\` 기준으로 **3일 이상 연속으로 접속한 적이 있는 유저 수**를 구하세요.
      - 컬럼: \`users\` (1행)`,
    hint: '유저-날짜를 DISTINCT 한 뒤, `날짜 - ROW_NUMBER()`가 같은 행들이 하나의 연속 구간입니다.',
    solution: `WITH d AS (
  SELECT DISTINCT user_id, CAST(event_ts AS DATE) AS dt FROM events
),
g AS (
  SELECT user_id, dt,
         dt - CAST(ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY dt) AS INTEGER) AS grp
  FROM d
),
streaks AS (
  SELECT user_id, grp, COUNT(*) AS len FROM g GROUP BY user_id, grp
)
SELECT COUNT(DISTINCT user_id) AS users FROM streaks WHERE len >= 3`,
    pandasSolution: `d = events[['user_id']].assign(dt=events['event_ts'].dt.normalize()).drop_duplicates()
d = d.sort_values(['user_id', 'dt'])
d['grp'] = d['dt'] - pd.to_timedelta(d.groupby('user_id').cumcount(), unit='D')
streak = d.groupby(['user_id', 'grp']).size()
result = pd.DataFrame({'users': [streak[streak >= 3].index.get_level_values('user_id').nunique()]})`,
    orderMatters: true,
    explanation: 'Gaps & Islands의 대표 패턴입니다. 연속된 날짜에서 순번을 빼면 같은 기준일이 나오는 성질을 이용합니다. 이 방식은 "유저별 최장 연속 접속일" 같은 변형 문제에도 그대로 쓸 수 있습니다.',
  },
  {
    id: 'sql-16', lang: 'sql', level: 2, topics: ['DAU', '기간 비교', '원인 분석'],
    title: '[케이스] DAU 하락 원인 찾기',
    prompt: `
      10월 중순 DAU가 급감했습니다. 플랫폼별로 **이전 기간(10/01~10/11)**과 **문제 기간(10/14~10/24)**의 **일평균 DAU**를 비교하세요.
      - 일평균 DAU = 기간 내 (날짜별 순 접속 유저 수)의 평균
      - change_rate = (문제 기간 - 이전 기간) / 이전 기간
      - 컬럼: \`platform\`, \`pre_dau\`, \`bug_dau\`, \`change_rate\`
      - 정렬: change_rate 오름차순 (가장 많이 떨어진 순)`,
    hint: '먼저 (날짜, 플랫폼)별 COUNT(DISTINCT user_id)를 구한 뒤, 기간별로 AVG 합니다.',
    solution: `WITH daily AS (
  SELECT CAST(event_ts AS DATE) AS dt, platform, COUNT(DISTINCT user_id) AS dau
  FROM events
  WHERE event_ts >= '2025-10-01' AND event_ts < '2025-10-25'
  GROUP BY 1, 2
),
p AS (
  SELECT platform,
         AVG(CASE WHEN dt BETWEEN '2025-10-01' AND '2025-10-11' THEN dau END) AS pre_dau,
         AVG(CASE WHEN dt BETWEEN '2025-10-14' AND '2025-10-24' THEN dau END) AS bug_dau
  FROM daily
  GROUP BY platform
)
SELECT platform, pre_dau, bug_dau, (bug_dau - pre_dau) / pre_dau AS change_rate
FROM p
ORDER BY change_rate`,
    pandasSolution: `e = events[(events['event_ts'] >= '2025-10-01') & (events['event_ts'] < '2025-10-25')]
daily = e.groupby([e['event_ts'].dt.normalize().rename('dt'), 'platform'])['user_id'].nunique().rename('dau').reset_index()
pre = daily[daily['dt'].between('2025-10-01', '2025-10-11')].groupby('platform')['dau'].mean()
bug = daily[daily['dt'].between('2025-10-14', '2025-10-24')].groupby('platform')['dau'].mean()
result = pd.DataFrame({'pre_dau': pre, 'bug_dau': bug})
result['change_rate'] = (result['bug_dau'] - result['pre_dau']) / result['pre_dau']
result = result.reset_index().sort_values('change_rate')`,
    orderMatters: true,
    explanation: 'Android 일평균 DAU가 약 52% 급감한 반면 iOS(-13%)와 web(-8%)은 평소 변동 수준입니다. 다음 단계로 `app_version`별로 쪼개 보면 10/14 배포된 **5.2.0** 버전에서만 문제가 발생했음을 확인할 수 있습니다. (케이스 트레이닝 탭의 "DAU 10% 하락" 케이스와 연결됩니다.)',
  },
  {
    id: 'sql-17', lang: 'sql', level: 2, topics: ['A/B 테스트', 'SRM', '윈도우 비율'],
    title: '[실험] 실험별 배정 비율과 전환율',
    prompt: `
      \`ab_test\` 테이블에서 실험(experiment)·그룹(variant)별 **인원**, **실험 내 배정 비율**, **전환율**을 구하세요.
      - share = 그룹 인원 / 해당 실험 전체 인원
      - cvr = 전환 유저 수 / 그룹 인원
      - 컬럼: \`experiment\`, \`variant\`, \`users\`, \`share\`, \`cvr\`
      - 정렬: experiment, variant`,
    hint: '`SUM(COUNT(*)) OVER (PARTITION BY experiment)`로 실험 전체 인원을 붙입니다.',
    solution: `SELECT experiment, variant,
       COUNT(*) AS users,
       COUNT(*) * 1.0 / SUM(COUNT(*)) OVER (PARTITION BY experiment) AS share,
       AVG(converted) AS cvr
FROM ab_test
GROUP BY experiment, variant
ORDER BY experiment, variant`,
    pandasSolution: `result = ab_test.groupby(['experiment', 'variant']).agg(users=('user_id', 'size'), cvr=('converted', 'mean')).reset_index()
result['share'] = result['users'] / result.groupby('experiment')['users'].transform('sum')
result = result[['experiment', 'variant', 'users', 'share', 'cvr']].sort_values(['experiment', 'variant'])`,
    orderMatters: true,
    explanation: '`free_shipping_banner`는 treatment 비율이 약 45%로 50:50 설계에서 크게 벗어났습니다 → **SRM**. 이 실험의 전환율 차이는 신뢰할 수 없습니다. A/B 테스트 탭의 SRM 검사기에 인원을 넣어 p-value를 확인해 보세요.',
  },
  {
    id: 'sql-18', lang: 'sql', level: 1, topics: ['SELF JOIN', 'LEFT JOIN'],
    title: '직원과 매니저 이름',
    prompt: `
      \`employees\`를 셀프 조인해서 **직원 이름과 매니저 이름**을 구하세요. 매니저가 없으면 NULL입니다.
      - 컬럼: \`emp_id\`, \`name\`, \`manager_name\`
      - 정렬: emp_id`,
    hint: '`employees e LEFT JOIN employees m ON e.manager_id = m.emp_id`',
    solution: `SELECT e.emp_id, e.name, m.name AS manager_name
FROM employees e
LEFT JOIN employees m ON e.manager_id = m.emp_id
ORDER BY e.emp_id`,
    pandasSolution: `m = employees[['emp_id', 'name']].rename(columns={'emp_id': 'manager_id', 'name': 'manager_name'})
result = employees[['emp_id', 'name', 'manager_id']].merge(m, on='manager_id', how='left')[['emp_id', 'name', 'manager_name']].sort_values('emp_id')`,
    orderMatters: true,
    explanation: '같은 테이블에 별칭을 두 개 붙여 서로 다른 역할(직원/매니저)로 조인합니다. INNER JOIN을 쓰면 매니저가 없는 부서장이 빠집니다.',
  },
  {
    id: 'sql-19', lang: 'sql', level: 3, topics: ['LAG', 'PARTITION BY', 'datediff'],
    title: '채널별 평균 재구매 간격',
    prompt: `
      완료 주문을 **2회 이상** 한 유저의 **연속된 주문 간 간격(일)**을 구하고, 유입 채널별로 재구매 유저 수와 평균 간격을 구하세요.
      - 간격 = 이번 주문 날짜 - 직전 주문 날짜 (날짜 단위)
      - 평균 간격 = 채널 내 모든 간격의 평균
      - 컬럼: \`channel\`, \`repeat_buyers\`, \`avg_gap_days\`
      - 정렬: channel`,
    hint: '`LAG(CAST(order_ts AS DATE)) OVER (PARTITION BY user_id ORDER BY order_ts)`로 직전 주문일을 붙입니다.',
    solution: `WITH o AS (
  SELECT user_id, CAST(order_ts AS DATE) AS dt,
         LAG(CAST(order_ts AS DATE)) OVER (PARTITION BY user_id ORDER BY order_ts, order_id) AS prev_dt
  FROM orders
  WHERE status = 'completed'
)
SELECT u.channel,
       COUNT(DISTINCT o.user_id) AS repeat_buyers,
       AVG(datediff(o.dt, o.prev_dt)) AS avg_gap_days
FROM o JOIN users u USING (user_id)
WHERE o.prev_dt IS NOT NULL
GROUP BY u.channel
ORDER BY u.channel`,
    pandasSolution: `o = orders[orders['status'] == 'completed'].sort_values(['user_id', 'order_ts', 'order_id']).copy()
o['dt'] = o['order_ts'].dt.normalize()
o['gap'] = o.groupby('user_id')['dt'].diff().dt.days
g = o.dropna(subset=['gap']).merge(users[['user_id', 'channel']], on='user_id')
result = g.groupby('channel').agg(repeat_buyers=('user_id', 'nunique'), avg_gap_days=('gap', 'mean')).reset_index()`,
    orderMatters: true,
    explanation: 'Databricks의 `datediff(end, start)`는 일 단위 차이를 반환합니다 (이 사이트에서도 호환 매크로로 동일하게 동작). 유저 평균의 평균인지, 전체 간격의 평균인지에 따라 값이 달라지므로 **정의를 명확히** 하세요.',
  },
  {
    id: 'sql-20', lang: 'sql', level: 2, topics: ['PIVOT', 'CASE WHEN', '크로스탭'],
    title: '월 × 카테고리 매출 크로스탭',
    prompt: `
      완료 주문의 상품 매출(quantity × unit_price)을 **행 = 월, 열 = 카테고리**인 표로 만드세요. 값이 없으면 0입니다.
      - 컬럼: \`month\`(DATE), \`beauty\`, \`books\`, \`electronics\`, \`fashion\`, \`grocery\`, \`home\`
      - 정렬: month`,
    hint: '`SUM(CASE WHEN category = \'beauty\' THEN amount ELSE 0 END) AS beauty` … 또는 DuckDB/Databricks의 `PIVOT` 구문',
    solution: `WITH t AS (
  SELECT CAST(date_trunc('month', o.order_ts) AS DATE) AS month, p.category, oi.quantity * oi.unit_price AS amount
  FROM order_items oi
  JOIN orders o ON oi.order_id = o.order_id AND o.status = 'completed'
  JOIN products p ON oi.product_id = p.product_id
)
SELECT month,
       SUM(CASE WHEN category = 'beauty' THEN amount ELSE 0 END) AS beauty,
       SUM(CASE WHEN category = 'books' THEN amount ELSE 0 END) AS books,
       SUM(CASE WHEN category = 'electronics' THEN amount ELSE 0 END) AS electronics,
       SUM(CASE WHEN category = 'fashion' THEN amount ELSE 0 END) AS fashion,
       SUM(CASE WHEN category = 'grocery' THEN amount ELSE 0 END) AS grocery,
       SUM(CASE WHEN category = 'home' THEN amount ELSE 0 END) AS home
FROM t
GROUP BY month
ORDER BY month`,
    pandasSolution: `df = (order_items
      .merge(orders.loc[orders['status'] == 'completed', ['order_id', 'order_ts']], on='order_id')
      .merge(products[['product_id', 'category']], on='product_id'))
df['amount'] = df['quantity'] * df['unit_price']
df['month'] = df['order_ts'].dt.to_period('M').dt.to_timestamp()
result = df.pivot_table(index='month', columns='category', values='amount', aggfunc='sum', fill_value=0).reset_index()`,
    orderMatters: true,
    explanation: 'Databricks SQL에서는 `PIVOT (SUM(amount) FOR category IN (\'beauty\', \'books\', ...))` 구문도 쓸 수 있습니다. CASE WHEN 방식은 어떤 SQL 엔진에서나 동작하는 이식성이 장점입니다.',
  },

  // ───────────── pandas ─────────────
  {
    id: 'pd-01', lang: 'pandas', level: 1, topics: ['loc', '불리언 인덱싱', 'sort_values'],
    title: '조건 필터링과 정렬',
    prompt: `
      \`users\`에서 **국가가 KR이고 디바이스가 ios**인 유저 중 **가장 먼저 가입한 5명**의 \`user_id\`, \`signup_date\`를 구하세요.
      - 정렬: signup_date 오름차순, 같으면 user_id 오름차순
      - 최종 결과를 \`result\` 변수에 담으세요.`,
    hint: "`users.loc[(users['country'] == 'KR') & (users['device'] == 'ios'), [...]]` — 조건마다 괄호 필수",
    solution: `result = (users.loc[(users['country'] == 'KR') & (users['device'] == 'ios'), ['user_id', 'signup_date']]
          .sort_values(['signup_date', 'user_id'])
          .head(5))`,
    sqlSolution: `SELECT user_id, signup_date FROM users
WHERE country = 'KR' AND device = 'ios'
ORDER BY signup_date, user_id
LIMIT 5`,
    orderMatters: true,
    explanation: '여러 조건은 `&`, `|`로 묶고 각 조건을 괄호로 감쌉니다 (연산자 우선순위 때문). `df.query("country == \'KR\' and device == \'ios\'")`도 같은 결과입니다.',
  },
  {
    id: 'pd-02', lang: 'pandas', level: 1, topics: ['fillna', 'value_counts'],
    title: '결측치 채우고 빈도 세기',
    prompt: `
      \`orders.coupon_code\`의 결측(쿠폰 미사용)을 \`'NONE'\`으로 채운 뒤, **쿠폰 코드별 주문 수**를 구하세요.
      - 컬럼: \`coupon_code\`, \`orders\`
      - 정렬: orders 내림차순, 같으면 coupon_code 오름차순`,
    hint: "`fillna('NONE')` → `value_counts()` 또는 `groupby().size()`",
    solution: `cnt = orders['coupon_code'].fillna('NONE').value_counts()
result = (cnt.rename_axis('coupon_code').reset_index(name='orders')
          .sort_values(['orders', 'coupon_code'], ascending=[False, True]))`,
    sqlSolution: `SELECT COALESCE(coupon_code, 'NONE') AS coupon_code, COUNT(*) AS orders
FROM orders
GROUP BY 1
ORDER BY orders DESC, coupon_code`,
    orderMatters: true,
    explanation: '`value_counts()`는 기본적으로 NaN을 제외하므로 (`dropna=False` 옵션 필요), 의미 있는 결측은 먼저 채워두는 것이 안전합니다. 여기서 결측은 "쿠폰 미사용"이라는 정보입니다.',
  },
  {
    id: 'pd-03', lang: 'pandas', level: 1, topics: ['merge', 'groupby'],
    title: '주문에 유저 정보 붙이기',
    prompt: `
      완료 주문에 유저의 \`channel\`을 붙여 **채널별 매출 합계**를 구하세요.
      - 컬럼: \`channel\`, \`revenue\`
      - 정렬: revenue 내림차순`,
    hint: "`orders.merge(users[['user_id', 'channel']], on='user_id', how='left', validate='many_to_one')`",
    solution: `done = orders[orders['status'] == 'completed']
df = done.merge(users[['user_id', 'channel']], on='user_id', how='left', validate='many_to_one')
result = (df.groupby('channel', as_index=False)['total_amount'].sum()
          .rename(columns={'total_amount': 'revenue'})
          .sort_values('revenue', ascending=False))`,
    sqlSolution: `SELECT u.channel, SUM(o.total_amount) AS revenue
FROM orders o JOIN users u USING (user_id)
WHERE o.status = 'completed'
GROUP BY u.channel
ORDER BY revenue DESC`,
    orderMatters: true,
    explanation: '`validate=\'many_to_one\'`을 넣으면 users에 user_id 중복이 있을 때 에러가 나서 팬아웃을 미리 막을 수 있습니다. 실무에서 강력 추천하는 습관입니다.',
  },
  {
    id: 'pd-04', lang: 'pandas', level: 2, topics: ['groupby', 'transform'],
    title: '주문별 유저 매출 비중 (transform)',
    prompt: `
      완료 주문 각각이 **해당 유저의 전체 완료 매출에서 차지하는 비중**을 구하세요.
      - 컬럼: \`order_id\`, \`user_id\`, \`share\`
      - 행 수는 완료 주문 수와 같아야 합니다.`,
    hint: "`groupby('user_id')['total_amount'].transform('sum')` — 원래 행 수를 유지합니다.",
    solution: `df = orders[orders['status'] == 'completed'].copy()
df['share'] = df['total_amount'] / df.groupby('user_id')['total_amount'].transform('sum')
result = df[['order_id', 'user_id', 'share']]`,
    sqlSolution: `SELECT order_id, user_id,
       total_amount * 1.0 / SUM(total_amount) OVER (PARTITION BY user_id) AS share
FROM orders
WHERE status = 'completed'`,
    orderMatters: false,
    explanation: '`transform`은 SQL의 `SUM() OVER (PARTITION BY ...)`에 해당합니다. `agg`를 쓰면 유저당 1행으로 줄어들어 다시 merge 해야 합니다.',
  },
  {
    id: 'pd-05', lang: 'pandas', level: 2, topics: ['named aggregation', 'merge'],
    title: '카테고리별 판매 요약',
    prompt: `
      완료 주문의 주문 상세 기준으로 카테고리별 **판매 수량 합계**, **매출 합계**(quantity × unit_price), **판매된 고유 상품 수**를 구하세요.
      - 컬럼: \`category\`, \`qty\`, \`revenue\`, \`products_sold\`
      - 정렬: revenue 내림차순`,
    hint: "named aggregation: `.agg(qty=('quantity', 'sum'), products_sold=('product_id', 'nunique'))`",
    solution: `df = (order_items
      .merge(orders.loc[orders['status'] == 'completed', ['order_id']], on='order_id')
      .merge(products[['product_id', 'category']], on='product_id'))
df['amount'] = df['quantity'] * df['unit_price']
result = (df.groupby('category')
          .agg(qty=('quantity', 'sum'), revenue=('amount', 'sum'), products_sold=('product_id', 'nunique'))
          .reset_index()
          .sort_values('revenue', ascending=False))`,
    sqlSolution: `SELECT p.category, SUM(oi.quantity) AS qty, SUM(oi.quantity * oi.unit_price) AS revenue,
       COUNT(DISTINCT oi.product_id) AS products_sold
FROM order_items oi
JOIN orders o ON oi.order_id = o.order_id AND o.status = 'completed'
JOIN products p ON oi.product_id = p.product_id
GROUP BY p.category
ORDER BY revenue DESC`,
    orderMatters: true,
    explanation: 'named aggregation(`새이름=(컬럼, 함수)`)을 쓰면 MultiIndex 컬럼이 생기지 않아 후처리가 깔끔합니다.',
  },
  {
    id: 'pd-06', lang: 'pandas', level: 2, topics: ['pivot_table', 'dt accessor'],
    title: '월 × 디바이스 신규 가입자 피벗',
    prompt: `
      **가입 월(행) × 디바이스(열)**별 신규 가입자 수 피벗 테이블을 만드세요.
      - 컬럼: \`month\`(월 첫날 Timestamp), \`android\`, \`ios\`, \`web\`
      - 정렬: month 오름차순`,
    hint: "`users.assign(month=users['signup_date'].dt.to_period('M').dt.to_timestamp()).pivot_table(index='month', columns='device', values='user_id', aggfunc='count', fill_value=0)`",
    solution: `df = users.assign(month=users['signup_date'].dt.to_period('M').dt.to_timestamp())
result = df.pivot_table(index='month', columns='device', values='user_id', aggfunc='count', fill_value=0).reset_index()`,
    sqlSolution: `SELECT date_trunc('month', signup_date) AS month,
       COUNT(*) FILTER (WHERE device = 'android') AS android,
       COUNT(*) FILTER (WHERE device = 'ios') AS ios,
       COUNT(*) FILTER (WHERE device = 'web') AS web
FROM users
GROUP BY 1
ORDER BY 1`,
    orderMatters: true,
    explanation: '`pivot_table`은 중복 조합을 aggfunc로 집계하고, `pivot`은 집계 없이 모양만 바꿉니다. SQL에서는 `COUNT(*) FILTER (WHERE ...)`(DuckDB/Databricks 지원)나 `SUM(CASE WHEN ...)`으로 같은 표를 만듭니다.',
  },
  {
    id: 'pd-07', lang: 'pandas', level: 2, topics: ['datetime', 'groupby 2단계'],
    title: '요일별 평균 일 방문 세션',
    prompt: `
      \`events\`의 visit 이벤트로 **날짜별 방문 세션 수**를 구한 뒤, **요일별 평균**을 구하세요.
      - weekday: 월요일 = 0 … 일요일 = 6
      - 컬럼: \`weekday\`, \`avg_visits\`
      - 정렬: weekday`,
    hint: "날짜별로 먼저 센 다음(`dt.normalize()`), 그 결과의 `dt.dayofweek`로 다시 groupby 해서 평균",
    solution: `v = events[events['event_type'] == 'visit']
daily = v.groupby(v['event_ts'].dt.normalize())['session_id'].nunique()
result = (daily.groupby(daily.index.dayofweek).mean()
          .rename_axis('weekday').reset_index(name='avg_visits'))`,
    sqlSolution: `WITH d AS (
  SELECT CAST(event_ts AS DATE) AS dt, COUNT(DISTINCT session_id) AS visits
  FROM events WHERE event_type = 'visit'
  GROUP BY 1
)
SELECT isodow(dt) - 1 AS weekday, AVG(visits) AS avg_visits
FROM d GROUP BY 1 ORDER BY 1`,
    orderMatters: true,
    explanation: '"요일별 평균 일 방문"은 반드시 **날짜별로 먼저 집계**한 뒤 평균을 내야 합니다. 요일별로 한 번에 세면 "요일별 총 방문"이 되어, 해당 요일이 몇 번 있었는지에 따라 왜곡됩니다. 결과에서 주말 트래픽이 높은 패턴이 보입니다.',
  },
  {
    id: 'pd-08', lang: 'pandas', level: 3, topics: ['리텐션', 'merge_asof 없이 조건 조인', '코호트'],
    title: '가입 월별 2주차 리텐션',
    prompt: `
      **가입 후 7~13일차(2주차)에 한 번이라도 활동**한 유저 비율을 가입 월별로 구하세요.
      - 관측 기간이 부족한 **2025-12-18 이후 가입자는 제외**합니다. (12/31까지 13일차를 관측할 수 없음)
      - 경과일 = 활동 날짜 - 가입 날짜 (일 단위)
      - 컬럼: \`cohort_month\`(\"2025-01\" 형태 문자열), \`users\`, \`retained\`, \`rate\`
      - 정렬: cohort_month`,
    hint: "events를 유저별 활동 날짜로 DISTINCT → users와 merge → `(dt - signup_date).dt.days`가 7~13인 유저 집합",
    solution: `u = users[users['signup_date'] <= '2025-12-17'][['user_id', 'signup_date']]
act = events[['user_id']].assign(dt=events['event_ts'].dt.normalize()).drop_duplicates()
j = act.merge(u, on='user_id')
j['day_n'] = (j['dt'] - j['signup_date']).dt.days
kept = set(j.loc[j['day_n'].between(7, 13), 'user_id'])
u = u.assign(cohort_month=u['signup_date'].dt.strftime('%Y-%m'), retained=u['user_id'].isin(kept))
result = u.groupby('cohort_month').agg(users=('user_id', 'size'), retained=('retained', 'sum')).reset_index()
result['rate'] = result['retained'] / result['users']`,
    sqlSolution: `WITH u AS (
  SELECT user_id, signup_date FROM users WHERE signup_date <= DATE '2025-12-17'
),
kept AS (
  SELECT DISTINCT e.user_id
  FROM events e JOIN u USING (user_id)
  WHERE datediff(CAST(e.event_ts AS DATE), u.signup_date) BETWEEN 7 AND 13
)
SELECT strftime(u.signup_date, '%Y-%m') AS cohort_month,
       COUNT(*) AS users,
       COUNT(k.user_id) AS retained,
       COUNT(k.user_id) * 1.0 / COUNT(*) AS rate
FROM u LEFT JOIN kept k USING (user_id)
GROUP BY 1 ORDER BY 1`,
    orderMatters: true,
    explanation: '관측 기간이 부족한 코호트를 포함하면 리텐션이 인위적으로 낮아집니다 (**right-censoring**). 면접에서 "최근 코호트 리텐션이 떨어졌다"는 데이터를 받으면 가장 먼저 의심해야 하는 부분입니다.',
  },
  {
    id: 'pd-09', lang: 'pandas', level: 2, topics: ['A/B 테스트', 'z-test', 'numpy'],
    title: '[실험] 두 비율 z-검정 직접 구현',
    prompt: `
      \`ab_test\`의 **checkout_button_v2** 실험에 대해 두 비율 z-검정을 직접 구현하세요.
      - lift = treatment 전환율 - control 전환율
      - 합동 비율 p = 전체 전환 / 전체 인원, SE = √(p(1-p)(1/n_c + 1/n_t)), z = lift / SE
      - 양측 p-value = 2 × (1 - Φ(|z|)) — Φ는 표준정규 CDF: \`0.5 * (1 + math.erf(x / math.sqrt(2)))\`
      - 컬럼: \`cvr_control\`, \`cvr_treatment\`, \`lift\`, \`z\`, \`p_value\` (1행)`,
    hint: "variant별 n과 전환 수를 구한 뒤 공식을 그대로 옮기면 됩니다. `import math`",
    solution: `import math
t = ab_test[ab_test['experiment'] == 'checkout_button_v2']
g = t.groupby('variant')['converted'].agg(['size', 'sum'])
n_c, x_c = g.loc['control']
n_t, x_t = g.loc['treatment']
p_c, p_t = x_c / n_c, x_t / n_t
p = (x_c + x_t) / (n_c + n_t)
se = math.sqrt(p * (1 - p) * (1 / n_c + 1 / n_t))
z = (p_t - p_c) / se
p_value = 2 * (1 - 0.5 * (1 + math.erf(abs(z) / math.sqrt(2))))
result = pd.DataFrame([{'cvr_control': p_c, 'cvr_treatment': p_t, 'lift': p_t - p_c, 'z': z, 'p_value': p_value}])`,
    orderMatters: true,
    explanation: 'p-value가 약 0.009로 α=0.05에서 유의합니다. 실무에서는 `statsmodels.stats.proportion.proportions_ztest`를 쓰지만, 면접에서는 공식을 이해하고 있는지 묻는 경우가 많습니다. 결과를 A/B 테스트 탭의 "결과 분석" 계산기에 넣어 비교해 보세요.',
  },
  {
    id: 'pd-10', lang: 'pandas', level: 3, topics: ['datetime 차이', 'median', 'merge'],
    title: '가입부터 첫 구매까지 걸린 일수',
    prompt: `
      유저별로 **가입일부터 첫 완료 주문까지 걸린 일수**(첫 주문 날짜 - 가입 날짜)를 구하고, 유입 채널별 **구매자 수, 평균, 중앙값**을 구하세요.
      - 컬럼: \`channel\`, \`buyers\`, \`avg_days\`, \`median_days\`
      - 정렬: channel`,
    hint: "유저별 첫 주문 시각 `groupby('user_id')['order_ts'].min()` → users와 merge → `(first.dt.normalize() - signup_date).dt.days`",
    solution: `first = orders[orders['status'] == 'completed'].groupby('user_id')['order_ts'].min().rename('first_ts')
df = users.merge(first, left_on='user_id', right_index=True)
df['days'] = (df['first_ts'].dt.normalize() - df['signup_date']).dt.days
result = df.groupby('channel')['days'].agg(buyers='size', avg_days='mean', median_days='median').reset_index()`,
    sqlSolution: `WITH f AS (
  SELECT user_id, MIN(order_ts) AS first_ts FROM orders WHERE status = 'completed' GROUP BY user_id
)
SELECT u.channel, COUNT(*) AS buyers,
       AVG(datediff(CAST(f.first_ts AS DATE), u.signup_date)) AS avg_days,
       MEDIAN(datediff(CAST(f.first_ts AS DATE), u.signup_date)) AS median_days
FROM f JOIN users u USING (user_id)
GROUP BY u.channel ORDER BY u.channel`,
    orderMatters: true,
    explanation: '평균이 중앙값보다 훨씬 크다면 늦게 구매하는 소수 유저가 평균을 끌어올리는 것입니다. "첫 구매까지 기간"은 온보딩 개선 실험의 좋은 보조 지표입니다.',
  },
  {
    id: 'pd-11', lang: 'pandas', level: 2, topics: ['pd.cut', 'np.select', '세그먼트'],
    title: '구매 금액 기준 고객 등급',
    prompt: `
      유저별 완료 주문 매출 합계로 등급을 나누고 **등급별 유저 수와 매출 합계**를 구하세요. (구매 이력이 있는 유저만)
      - VIP: 500,000원 이상 / Regular: 100,000원 이상 / Light: 그 외
      - 컬럼: \`tier\`, \`users\`, \`revenue\``,
    hint: "`np.select([rev >= 500000, rev >= 100000], ['VIP', 'Regular'], default='Light')`",
    solution: `rev = orders[orders['status'] == 'completed'].groupby('user_id')['total_amount'].sum()
tier = np.select([rev >= 500000, rev >= 100000], ['VIP', 'Regular'], default='Light')
df = pd.DataFrame({'tier': tier, 'revenue': rev.values})
result = df.groupby('tier').agg(users=('revenue', 'size'), revenue=('revenue', 'sum')).reset_index()`,
    sqlSolution: `WITH r AS (
  SELECT user_id, SUM(total_amount) AS revenue FROM orders WHERE status = 'completed' GROUP BY user_id
)
SELECT CASE WHEN revenue >= 500000 THEN 'VIP' WHEN revenue >= 100000 THEN 'Regular' ELSE 'Light' END AS tier,
       COUNT(*) AS users, SUM(revenue) AS revenue
FROM r GROUP BY 1`,
    orderMatters: false,
    explanation: '`np.select`는 위에서부터 첫 번째로 참인 조건을 적용하므로 SQL의 `CASE WHEN`과 같습니다. 구간이 연속이라면 `pd.cut(rev, bins=[0, 100000, 500000, np.inf], right=False)`도 쓸 수 있습니다.',
  },
  {
    id: 'pd-12', lang: 'pandas', level: 3, topics: ['파레토', 'quantile', 'cumsum'],
    title: '상위 10% 고객의 매출 비중',
    prompt: `
      완료 주문 매출 기준 **상위 10% 구매자**(매출 내림차순으로 정렬했을 때 앞쪽 ceil(구매자 수 × 0.1)명)가 **전체 매출에서 차지하는 비중**을 구하세요.
      - 컬럼: \`top10_share\` (1행)`,
    hint: "`rev.sort_values(ascending=False)` → `math.ceil(len(rev) * 0.1)`명의 합 / 전체 합",
    solution: `import math
rev = orders[orders['status'] == 'completed'].groupby('user_id')['total_amount'].sum().sort_values(ascending=False)
k = math.ceil(len(rev) * 0.1)
result = pd.DataFrame({'top10_share': [rev.iloc[:k].sum() / rev.sum()]})`,
    sqlSolution: `WITH r AS (
  SELECT user_id, SUM(total_amount) AS revenue FROM orders WHERE status = 'completed' GROUP BY user_id
),
ranked AS (
  SELECT revenue, ROW_NUMBER() OVER (ORDER BY revenue DESC, user_id) AS rn, COUNT(*) OVER () AS n FROM r
)
SELECT SUM(CASE WHEN rn <= CEIL(n * 0.1) THEN revenue ELSE 0 END) * 1.0 / SUM(revenue) AS top10_share
FROM ranked`,
    orderMatters: true,
    explanation: '매출 집중도(파레토)는 평균과 중앙값의 괴리를 설명하는 강력한 숫자입니다. 상위 고객 비중이 높다면 평균 객단가 같은 지표는 소수 고객의 행동에 크게 흔들립니다. 이 경우 실험 지표에 윈저라이징을 고려합니다.',
  },
];
