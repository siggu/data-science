// 데이터 분석가(DA) 중심 면접 질문 은행
// 출처: 국내외 채용 공고·면접 후기·면접 가이드에서 공통적으로 반복되는 질문을 2026년 기준으로 정리
// (DataCamp, Coursera, Interview Query, Exponent, techinterview.org, PracHub, 토스/쿠팡 DA 공고 등)
//
// 필드: id, cat, level(1 기본 · 2 실무 · 3 심화), q, intent(면접관 의도), answer(모범 답변, md),
//       keyPoints(모의면접 자기채점 기준), pitfalls(흔한 실수), followups(꼬리 질문), practice(연습 문제 id)

export const CATEGORIES = [
  { id: 'sql', name: 'SQL' },
  { id: 'pandas', name: 'pandas / Python' },
  { id: 'stats', name: '통계' },
  { id: 'ab', name: 'A/B 테스트·실험' },
  { id: 'metrics', name: '지표·프로덕트 센스' },
  { id: 'databricks', name: 'Spark·Databricks' },
  { id: 'ml', name: 'ML 기초' },
  { id: 'behavior', name: '행동·커뮤니케이션' },
];

export const LEVELS = { 1: '기본', 2: '실무', 3: '심화' };

export const QUESTIONS = [
  // ───────────────────────── SQL ─────────────────────────
  {
    id: 'sql-where-having', cat: 'sql', level: 1,
    q: 'WHERE와 HAVING의 차이는 무엇인가요? SQL의 논리적 실행 순서와 함께 설명해 주세요.',
    intent: 'SQL 실행 순서를 이해하고 있는지, 집계 전/후 필터를 구분하는지 확인합니다. 신입 SQL 면접의 단골 첫 질문입니다.',
    answer: `
      **WHERE는 집계 전 '행'을 거르고, HAVING은 GROUP BY 이후 '그룹'을 거릅니다.**

      SQL의 논리적 실행 순서는 다음과 같습니다.

      1. \`FROM / JOIN\` → 2. \`WHERE\` → 3. \`GROUP BY\` → 4. \`HAVING\` → 5. \`SELECT\` (윈도우 함수 포함) → 6. \`QUALIFY\` → 7. \`DISTINCT\` → 8. \`ORDER BY\` → 9. \`LIMIT\`

      그래서 WHERE에서는 \`SUM()\` 같은 집계 함수를 쓸 수 없고, SELECT에서 만든 별칭도 (표준 SQL에서는) WHERE에서 참조할 수 없습니다.

      \`\`\`sql
      SELECT user_id, SUM(total_amount) AS revenue
      FROM orders
      WHERE status = 'completed'          -- 집계 전: 완료 주문만
      GROUP BY user_id
      HAVING SUM(total_amount) >= 300000  -- 집계 후: 30만원 이상 유저만
      \`\`\`

      **성능 관점**: 집계와 무관한 조건은 HAVING이 아니라 WHERE에 두는 것이 좋습니다. 집계할 행 수 자체가 줄어들기 때문입니다.`,
    keyPoints: ['WHERE = 집계 전 행 필터, HAVING = 집계 후 그룹 필터', '논리적 실행 순서(FROM→WHERE→GROUP BY→HAVING→SELECT→ORDER BY)', 'WHERE에서 집계함수 사용 불가', '가능한 조건은 WHERE로 (성능)'],
    pitfalls: [{ text: "\"HAVING은 GROUP BY와 같이 쓰는 WHERE\"라고만 답하고 실행 순서를 설명하지 못함", fix: "실행 순서(FROM → WHERE → GROUP BY → HAVING → SELECT)와 함께 \"WHERE는 집계 전 행, HAVING은 집계 후 그룹\"이라고 답하세요." }, { text: "집계와 무관한 조건을 HAVING에 넣는 습관", fix: "`status = 'completed'`처럼 집계와 무관한 조건은 WHERE에 두세요. 집계할 행이 먼저 줄어 더 빠릅니다." }],
    followups: [{ q: "SELECT에서 정의한 별칭을 WHERE에서 쓸 수 있나요?", a: "표준 SQL에서는 불가합니다. WHERE가 SELECT보다 먼저 실행되기 때문입니다. DuckDB는 WHERE에서도 별칭을 허용하지만, Databricks는 SELECT 목록 안(lateral column alias)과 GROUP BY·HAVING·ORDER BY에서만 허용합니다. 이식성을 생각하면 CTE나 서브쿼리로 감싸세요." }, { q: "QUALIFY는 무엇이고 언제 쓰나요?", a: "윈도우 함수 결과로 행을 거르는 절입니다. \"그룹별 최신 1건\"(`QUALIFY ROW_NUMBER() OVER (...) = 1`)처럼 서브쿼리 없이 필터링할 때 씁니다. Databricks와 DuckDB는 지원하고, 오픈소스 Spark와 MySQL은 지원하지 않습니다." }],
    practice: 'sql-02',
  },
  {
    id: 'sql-joins', cat: 'sql', level: 1,
    q: 'JOIN의 종류를 설명하고, LEFT JOIN을 쓸 때 주의할 점을 말해 주세요.',
    intent: '조인 결과의 행 수를 예측할 수 있는지, 실무에서 자주 터지는 LEFT JOIN 함정(ON vs WHERE, 중복 증식)을 아는지 봅니다.',
    answer: `
      | 종류 | 결과 |
      |---|---|
      | INNER JOIN | 양쪽에 모두 매칭되는 행만 |
      | LEFT (OUTER) JOIN | 왼쪽 전체 + 매칭되는 오른쪽 (없으면 NULL) |
      | FULL OUTER JOIN | 양쪽 전체 |
      | CROSS JOIN | 모든 조합 (카티션 곱) |
      | SELF JOIN | 같은 테이블끼리 (예: 직원-매니저) |
      | SEMI / ANTI JOIN | \`EXISTS\` / \`NOT EXISTS\` — 존재 여부만 확인, 행 증식 없음 |

      **LEFT JOIN 주의점 3가지**

      1. **오른쪽 테이블 조건은 ON에 둬야 합니다.** WHERE에 \`o.status = 'completed'\`를 두면 매칭 안 된(NULL) 행이 걸러져 사실상 INNER JOIN이 됩니다.
      2. **1:N 조인 시 행이 증식합니다.** 유저 테이블에 주문을 붙이면 유저 수가 아니라 주문 수만큼 행이 생기므로, 유저 수를 셀 때는 \`COUNT(DISTINCT user_id)\`를 쓰거나 먼저 집계한 뒤 조인합니다.
      3. **NULL 처리**: 매칭이 없는 행은 NULL이므로 \`COALESCE(revenue, 0)\`처럼 기본값을 채워야 평균 등이 왜곡되지 않습니다.

      \`\`\`sql
      -- 주문이 없는 유저도 0원으로 포함
      SELECT u.user_id, COALESCE(SUM(o.total_amount), 0) AS revenue
      FROM users u
      LEFT JOIN orders o
        ON u.user_id = o.user_id AND o.status = 'completed'   -- 조건은 ON에!
      GROUP BY u.user_id
      \`\`\``,
    keyPoints: ['INNER/LEFT/FULL/CROSS/SELF 구분', '오른쪽 테이블 필터는 ON 절에 (WHERE면 INNER화)', '1:N 조인 시 행 증식 → 먼저 집계 또는 DISTINCT', '매칭 없는 행 NULL → COALESCE'],
    pitfalls: [{ text: "조인 후 SUM했더니 매출이 부풀려지는 팬아웃(fan-out) 문제를 모름", fix: "1:N 조인 전에 N쪽을 키 단위로 먼저 집계하고, 조인 전후 행 수와 합계를 비교해 검증하세요." }, { text: "NOT IN 서브쿼리에 NULL이 섞이면 결과가 비는 문제를 모름", fix: "`NOT EXISTS`나 `LEFT JOIN ... WHERE b.key IS NULL`을 쓰세요. NULL이 있어도 안전합니다." }],
    followups: [{ q: "주문이 한 번도 없는 유저를 찾는 쿼리를 세 가지 방법으로 작성해 보세요.", a: "① `LEFT JOIN orders o ... WHERE o.user_id IS NULL` ② `WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.user_id)` ③ `SELECT user_id FROM users EXCEPT SELECT user_id FROM orders`. NULL에 취약한 `NOT IN`은 피합니다." }],
    practice: 'sql-04',
  },
  {
    id: 'sql-window-rank', cat: 'sql', level: 2,
    q: '윈도우 함수란 무엇이고, ROW_NUMBER, RANK, DENSE_RANK의 차이는 무엇인가요?',
    intent: '윈도우 함수는 중급과 고급 SQL 실력을 가르는 기준입니다. GROUP BY와의 차이, 동점 처리 방식을 정확히 아는지 봅니다.',
    answer: `
      **윈도우 함수는 행을 합치지 않고(GROUP BY와 달리) '관련된 행 집합(윈도우)'을 기준으로 값을 계산**합니다. \`함수() OVER (PARTITION BY ... ORDER BY ... ROWS BETWEEN ...)\` 형태입니다.

      급여가 300, 200, 200, 100일 때:

      | salary | ROW_NUMBER | RANK | DENSE_RANK |
      |---|---|---|---|
      | 300 | 1 | 1 | 1 |
      | 200 | 2 | 2 | 2 |
      | 200 | 3 | 2 | 2 |
      | 100 | 4 | **4** | **3** |

      - **ROW_NUMBER**: 동점이어도 무조건 고유 번호 → "그룹별 1건만" 뽑을 때 (중복 제거, 최신 1건)
      - **RANK**: 동점은 같은 순위, 다음 순위는 건너뜀 (올림픽 방식)
      - **DENSE_RANK**: 동점은 같은 순위, 건너뛰지 않음 → "N번째로 높은 급여" 문제

      자주 쓰는 윈도우 함수: \`LAG/LEAD\`(이전/다음 행), \`SUM() OVER (ORDER BY ...)\`(누적합), \`AVG() OVER (ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)\`(이동평균), \`FIRST_VALUE\`, \`NTILE\`.

      Databricks SQL과 DuckDB는 \`QUALIFY\`를 지원해서 서브쿼리 없이 윈도우 결과로 필터링할 수 있습니다.
      \`\`\`sql
      SELECT * FROM orders
      QUALIFY ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY order_ts DESC) = 1
      \`\`\``,
    keyPoints: ['행을 유지한 채 그룹 기준 계산 (GROUP BY와 차이)', 'PARTITION BY / ORDER BY / 프레임 구성', '동점 처리: ROW_NUMBER 고유, RANK 건너뜀, DENSE_RANK 연속', '활용 예: 최신 1건, N번째 값, 누적합, 이동평균, LAG'],
    pitfalls: [{ text: "ROWS와 RANGE 프레임 차이를 모름", fix: "ORDER BY만 쓰면 기본 프레임이 RANGE라 정렬 값이 같은 행이 함께 합산됩니다. 행 단위 누적이 필요하면 `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`를 명시하세요." }, { text: "윈도우 함수 결과를 WHERE에서 바로 필터링하려 함", fix: "윈도우 함수는 WHERE 이후에 계산됩니다. `QUALIFY`(Databricks/DuckDB)를 쓰거나 서브쿼리·CTE로 감싼 뒤 바깥에서 필터링하세요." }],
    followups: [{ q: "부서별 급여 상위 2명을 뽑아보세요.", a: "`DENSE_RANK() OVER (PARTITION BY dept_id ORDER BY salary DESC) AS rk`를 구한 뒤 `rk <= 2`로 필터링합니다. 동점을 포함할지에 따라 ROW_NUMBER와 DENSE_RANK 중 고릅니다." }, { q: "윈도우 함수 결과로 필터링하려면 어떻게 하나요?", a: "`QUALIFY`를 쓰거나, 서브쿼리·CTE에서 윈도우 컬럼을 만든 뒤 바깥 쿼리의 WHERE에서 필터링합니다." }],
    practice: 'sql-07',
  },
  {
    id: 'sql-nth-salary', cat: 'sql', level: 2,
    q: '두 번째로 높은 급여를 구하는 쿼리를 작성해 주세요. 동점이 있거나 값이 없으면 어떻게 하나요?',
    intent: 'LeetCode/StrataScratch 단골 문제입니다. 엣지 케이스(동점, 결과 없음)를 먼저 질문하는지가 핵심입니다.',
    answer: `
      먼저 **요구사항을 확인**합니다. "동점이면 같은 값으로 보나요? 2등이 없으면 NULL을 반환하나요?"

      **방법 1 — DENSE_RANK (일반화 가능, 추천)**
      \`\`\`sql
      SELECT MAX(salary) AS second_highest   -- 결과 없으면 NULL 반환
      FROM (
        SELECT salary, DENSE_RANK() OVER (ORDER BY salary DESC) AS rk
        FROM employees
      )
      WHERE rk = 2
      \`\`\`

      **방법 2 — 서브쿼리**
      \`\`\`sql
      SELECT MAX(salary) FROM employees
      WHERE salary < (SELECT MAX(salary) FROM employees)
      \`\`\`

      **방법 3 — DISTINCT + OFFSET**
      \`\`\`sql
      SELECT DISTINCT salary FROM employees ORDER BY salary DESC LIMIT 1 OFFSET 1
      \`\`\`
      (단, 결과가 없으면 NULL이 아니라 빈 결과가 나옵니다.)

      바깥에 \`MAX()\`를 씌우는 이유는 **해당 순위가 없을 때 빈 결과 대신 NULL을 반환**하기 위해서입니다. N번째로 일반화하려면 방법 1의 \`rk = N\`만 바꾸면 됩니다.`,
    keyPoints: ['동점/결과 없음 엣지 케이스를 먼저 질문', 'DENSE_RANK로 일반화', '서브쿼리 MAX(salary) < MAX 방식', '결과 없을 때 NULL 반환 처리'],
    pitfalls: [{ text: "ROW_NUMBER를 써서 동점 시 같은 급여가 2등으로 나옴", fix: "\"N번째로 높은 값\"은 값 기준 순위이므로 `DENSE_RANK`를 쓰세요." }, { text: "DISTINCT 없이 OFFSET 1을 써서 동점 1등이 2등으로 나옴", fix: "`SELECT DISTINCT salary ... ORDER BY salary DESC LIMIT 1 OFFSET 1`처럼 중복부터 제거하세요." }],
    followups: [{ q: "부서별 두 번째로 높은 급여는요?", a: "`DENSE_RANK() OVER (PARTITION BY dept_id ORDER BY salary DESC) = 2`인 행을 부서별로 뽑습니다. 2등이 없는 부서도 보여야 하면 부서 테이블에 LEFT JOIN합니다." }],
    practice: 'sql-06',
  },
  {
    id: 'sql-dup', cat: 'sql', level: 1,
    q: '테이블에서 중복 데이터를 찾고 제거하는 방법을 설명해 주세요.',
    intent: '데이터 정합성 감각을 봅니다. 무엇을 기준으로 중복이라 볼지 정의하는 능력이 중요합니다.',
    answer: `
      먼저 **'중복'의 기준(키)을 정의**합니다. 전체 컬럼이 같은 완전 중복인지, 비즈니스 키(예: user_id + event_ts + event_type)가 같은 논리 중복인지에 따라 방법이 다릅니다.

      **찾기**
      \`\`\`sql
      SELECT user_id, event_ts, event_type, COUNT(*) AS cnt
      FROM events
      GROUP BY user_id, event_ts, event_type
      HAVING COUNT(*) > 1
      \`\`\`

      **제거 (어떤 행을 남길지 규칙 지정)**
      \`\`\`sql
      SELECT *
      FROM events
      QUALIFY ROW_NUMBER() OVER (
        PARTITION BY user_id, event_ts, event_type
        ORDER BY event_id            -- 남길 행의 우선순위 (예: 가장 먼저 적재된 것)
      ) = 1
      \`\`\`

      완전 중복이면 \`SELECT DISTINCT *\`로도 충분합니다. Databricks Delta 테이블이라면 \`MERGE INTO\`나 \`CREATE OR REPLACE TABLE ... AS SELECT\`로 정리하고, 근본적으로는 **중복이 생긴 원인**(재시도 로직, 조인 팬아웃, 중복 적재)을 찾아 파이프라인에서 막는 것이 중요합니다.`,
    keyPoints: ['중복 기준(키) 먼저 정의', 'GROUP BY + HAVING COUNT(*) > 1로 탐지', 'ROW_NUMBER로 남길 행 규칙 지정 후 제거', '원인 파악(파이프라인/조인)까지 언급'],
    pitfalls: [{ text: "남길 행의 기준(ORDER BY) 없이 임의로 제거", fix: "`ROW_NUMBER() OVER (PARTITION BY 키 ORDER BY 적재시각 DESC)`처럼 어떤 행을 남길지 규칙을 명시하세요. 그래야 실행할 때마다 결과가 같습니다." }, { text: "DISTINCT로 모든 것을 해결하려 함", fix: "DISTINCT는 모든 컬럼이 같은 완전 중복만 제거합니다. 키는 같은데 일부 컬럼이 다른 논리 중복은 ROW_NUMBER로 처리하세요." }],
    followups: [{ q: "pandas에서는 어떻게 하나요?", a: "찾기는 `df.duplicated(subset=[...], keep=False)`, 제거는 `df.sort_values('ts').drop_duplicates(subset=[...], keep='last')`입니다. 정렬로 남길 행을 정합니다." }],
    practice: 'sql-05',
  },
  {
    id: 'sql-moving-avg', cat: 'sql', level: 2,
    q: '일별 매출의 7일 이동평균과 누적 매출을 구하는 쿼리를 작성해 주세요.',
    intent: '시계열 분석의 기본인 윈도우 프레임을 다룰 수 있는지, 데이터가 없는 날(빈 날짜) 문제를 인지하는지 봅니다.',
    answer: `
      \`\`\`sql
      WITH daily AS (
        SELECT CAST(order_ts AS DATE) AS dt, SUM(total_amount) AS revenue
        FROM orders
        WHERE status = 'completed'
        GROUP BY 1
      )
      SELECT
        dt,
        revenue,
        AVG(revenue) OVER (ORDER BY dt ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS ma7,
        SUM(revenue) OVER (ORDER BY dt ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cum_revenue
      FROM daily
      ORDER BY dt
      \`\`\`

      **꼭 언급할 포인트**
      - \`ROWS BETWEEN 6 PRECEDING AND CURRENT ROW\`는 '7개 행'이지 '7일'이 아닙니다. **주문이 없는 날이 있으면 기간이 틀어지므로** 날짜 차원(calendar) 테이블을 만들어 LEFT JOIN한 뒤 0으로 채우거나, \`RANGE BETWEEN INTERVAL 6 DAYS PRECEDING AND CURRENT ROW\`를 사용합니다.
      - 처음 6일은 7일치가 없으므로 이동평균이 불완전합니다. 필요하면 \`COUNT(*) OVER (...) = 7\`인 경우만 표시합니다.`,
    keyPoints: ['윈도우 프레임 ROWS BETWEEN 6 PRECEDING AND CURRENT ROW', '누적합 UNBOUNDED PRECEDING', '빈 날짜 문제 → 날짜 테이블 LEFT JOIN 또는 RANGE INTERVAL', '초기 구간 불완전 처리'],
    pitfalls: [{ text: "빈 날짜를 고려하지 않아 \"7행 평균\"을 \"7일 평균\"으로 보고", fix: "날짜 테이블과 LEFT JOIN해 빈 날을 0으로 채우거나 `RANGE BETWEEN INTERVAL 6 DAYS PRECEDING AND CURRENT ROW`를 쓰세요." }, { text: "ORDER BY만 쓰고 프레임을 생략해 동일 날짜 처리 오류", fix: "프레임(`ROWS BETWEEN ...`)을 항상 명시하는 습관을 들이세요." }],
    followups: [{ q: "전주 같은 요일 대비 증감률(WoW)은 어떻게 구하나요?", a: "빈 날짜 없는 일별 테이블에서 `LAG(revenue, 7) OVER (ORDER BY dt)`로 7일 전 값을 가져와 `(revenue - prev) / prev`를 계산합니다." }],
    practice: 'sql-09',
  },
  {
    id: 'sql-retention', cat: 'sql', level: 3,
    q: '가입 월 코호트별 N개월 리텐션을 구하는 쿼리를 어떻게 작성하시겠어요?',
    intent: '프로덕트 분석의 대표 과제입니다. 코호트 정의, 분모 설정, 관측 기간이 덜 찬(incomplete) 코호트 처리 같은 세부 사항을 챙기는지 봅니다.',
    answer: `
      **1) 정의부터 합의합니다.**
      - 코호트: 가입 월 (users.signup_date 기준)
      - 활동: events에 기록이 있으면 활성
      - 리텐션 종류: N개월차에 활동했는지(classic/bounded) vs N개월차 이후 한 번이라도(unbounded)

      **2) 쿼리 구조: 코호트 CTE → 활동 CTE → 조인 → 분모로 나누기**
      \`\`\`sql
      WITH cohort AS (
        SELECT user_id, date_trunc('month', signup_date) AS cohort_month
        FROM users
      ),
      activity AS (
        SELECT DISTINCT user_id, date_trunc('month', event_ts) AS active_month
        FROM events
      ),
      joined AS (
        SELECT c.cohort_month,
               datediff('month', c.cohort_month, a.active_month) AS month_n,
               c.user_id
        FROM cohort c JOIN activity a USING (user_id)
      )
      SELECT j.cohort_month, j.month_n,
             COUNT(DISTINCT j.user_id) AS active_users,
             COUNT(DISTINCT j.user_id) * 1.0 / s.cohort_size AS retention
      FROM joined j
      JOIN (SELECT cohort_month, COUNT(*) AS cohort_size FROM cohort GROUP BY 1) s USING (cohort_month)
      WHERE j.month_n >= 0
      GROUP BY j.cohort_month, j.month_n, s.cohort_size
      ORDER BY 1, 2
      \`\`\`

      (DuckDB 문법입니다. Databricks에서는 \`datediff(MONTH, start, end)\`처럼 단위를 따옴표 없이 씁니다. 두 날짜를 월초로 자른 뒤 비교하므로 결과는 같습니다.)

      **3) 함정 체크**
      - **분모는 코호트 전체 인원**이어야 합니다. 활동 테이블과 INNER JOIN한 뒤 분모를 세면 한 번도 활동하지 않은 유저가 빠져 리텐션이 부풀려집니다.
      - **관측 기간이 덜 찬 코호트**(예: 12월 가입자의 3개월차)는 0%가 아니라 '측정 불가'로 비워야 합니다.
      - 월 단위는 가입일이 월초인지 월말인지에 따라 편차가 크므로, 정밀하게는 **가입일 기준 N일차(D1, D7, D30)** 리텐션을 함께 봅니다.`,
    keyPoints: ['코호트·활동·리텐션 종류 정의 먼저', '코호트 CTE + 활동 CTE + 기간차 계산', '분모 = 코호트 전체 인원', '관측 기간 미달 코호트는 제외/표시', '월 단위 vs N일차 리텐션 차이'],
    pitfalls: [{ text: "분모를 잘못 잡아 리텐션 과대 추정", fix: "분모는 활동 테이블과 조인하기 전의 코호트 전체 인원입니다. 코호트 크기를 따로 집계해 붙이세요." }, { text: "미완성 코호트를 0%로 표시해 리텐션이 떨어진 것처럼 보임", fix: "관측 기간이 부족한 칸은 NULL(측정 불가)로 두거나, 관측이 끝난 코호트만 비교하세요." }],
    followups: [{ q: "리텐션이 떨어지고 있다면 어떤 분석을 추가로 하시겠어요?", a: "어느 코호트와 몇 주차부터 떨어졌는지 보고, 유입 채널·플랫폼별로 분해해 구성비 변화인지 확인합니다. 리텐션 유저와 이탈 유저의 초기 행동(Aha moment)을 비교하고, 같은 시기의 제품 변경과 대조합니다." }, { q: "pandas로는 어떻게 구현하나요?", a: "`dt.to_period('M')`로 가입 월과 활동 월을 만들고 merge합니다. `month_n = (active - cohort).apply(lambda d: d.n)`을 구한 뒤 `groupby(['cohort', 'month_n']).user_id.nunique()`를 코호트 크기로 나누고 `pivot`합니다." }],
    practice: 'sql-14',
  },
  {
    id: 'sql-funnel', cat: 'sql', level: 2,
    q: '방문 → 상품조회 → 장바구니 → 결제 퍼널의 단계별 전환율을 구하는 쿼리를 작성해 주세요.',
    intent: '이커머스와 핀테크 DA 과제에서 가장 많이 나오는 유형입니다. 퍼널 단위(유저/세션)와 순서 조건을 정의하는지 봅니다.',
    answer: `
      **먼저 정의**: 퍼널 단위는 유저인가 세션인가? 단계 순서를 강제하는가(장바구니 전에 조회가 있어야 하는가)? 기간은?

      **세션 기준, 조건부 집계 방식**
      \`\`\`sql
      WITH s AS (
        SELECT session_id,
               MAX(CASE WHEN event_type = 'visit'       THEN 1 ELSE 0 END) AS visit,
               MAX(CASE WHEN event_type = 'view_item'   THEN 1 ELSE 0 END) AS view_item,
               MAX(CASE WHEN event_type = 'add_to_cart' THEN 1 ELSE 0 END) AS cart,
               MAX(CASE WHEN event_type = 'purchase'    THEN 1 ELSE 0 END) AS purchase
        FROM events
        GROUP BY session_id
      )
      SELECT SUM(visit) AS visits,
             SUM(view_item) AS views,
             SUM(cart) AS carts,
             SUM(purchase) AS purchases,
             SUM(view_item) * 1.0 / SUM(visit)    AS view_rate,
             SUM(cart)      * 1.0 / SUM(view_item) AS cart_rate,
             SUM(purchase)  * 1.0 / SUM(cart)      AS purchase_rate,
             SUM(purchase)  * 1.0 / SUM(visit)     AS overall_cvr
      FROM s
      \`\`\`

      **해석까지 연결**: 단계별 전환율(step conversion)과 전체 전환율(overall)을 구분해 보여주고, 가장 이탈이 큰 단계를 플랫폼·유입 채널별로 쪼개 원인을 찾습니다. 순서를 강제해야 한다면 각 단계의 최초 시각(\`MIN(CASE WHEN ... THEN event_ts END)\`)을 구해 \`view_ts <= cart_ts\` 조건을 추가합니다.`,
    keyPoints: ['퍼널 단위(유저/세션), 순서, 기간 정의', 'CASE WHEN 조건부 집계로 단계 플래그', '단계별 전환율 vs 전체 전환율', '세그먼트별 분해로 원인 탐색'],
    pitfalls: [{ text: "이벤트 수(COUNT(*))로 전환율을 계산해 중복 이벤트에 왜곡", fix: "퍼널 단위(유저나 세션)로 \"도달 여부\"를 먼저 만들고 그 단위로 세세요 (`COUNT(DISTINCT session_id)`)." }, { text: "단계 순서를 고려하지 않음", fix: "단계별 최초 시각(`MIN(CASE WHEN ... THEN ts END)`)을 구해 `view_ts <= cart_ts <= purchase_ts` 조건을 추가하세요." }],
    followups: [{ q: "플랫폼별로 비교하면? 웹의 결제 전환율이 낮다면 어떤 가설을 세우나요?", a: "먼저 어느 단계에서 이탈하는지 쪼개 봅니다. 가설로는 웹 결제 UI·간편결제 미지원, 비회원·저의도 트래픽 비중, 페이지 속도, 브라우저별 오류가 있고, 단계별 전환율과 에러 로그로 검증합니다." }],
    practice: 'sql-12',
  },
  {
    id: 'sql-gaps-islands', cat: 'sql', level: 3,
    q: '3일 연속으로 접속한 유저를 찾는 쿼리를 작성해 주세요.',
    intent: '"Gaps and Islands" 패턴으로 고급 SQL 문제의 대표 유형입니다. 날짜에서 ROW_NUMBER를 빼는 아이디어를 아는지 봅니다.',
    answer: `
      **핵심 아이디어**: 연속된 날짜에서 \`ROW_NUMBER()\`를 빼면 같은 값(그룹 키)이 나옵니다.

      | 접속일 | rn | 접속일 - rn |
      |---|---|---|
      | 01-03 | 1 | 01-02 |
      | 01-04 | 2 | 01-02 |
      | 01-05 | 3 | 01-02 |
      | 01-09 | 4 | 01-05 |

      \`\`\`sql
      WITH d AS (
        SELECT DISTINCT user_id, CAST(event_ts AS DATE) AS dt FROM events
      ),
      g AS (
        SELECT user_id, dt,
               dt - CAST(ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY dt) AS INTEGER) AS grp
        FROM d
      )
      SELECT DISTINCT user_id
      FROM g
      GROUP BY user_id, grp
      HAVING COUNT(*) >= 3
      \`\`\`

      **대안**: \`LAG(dt, 2) OVER (PARTITION BY user_id ORDER BY dt) = dt - 2\` 조건으로도 3일 연속을 찾을 수 있습니다. 간단하지만 'N일 연속'으로 일반화하거나 연속 구간의 시작/끝/길이를 구할 때는 grp 방식이 더 유연합니다.

      반드시 **하루 여러 번 접속을 DISTINCT로 먼저 제거**해야 합니다.`,
    keyPoints: ['날짜 단위 DISTINCT 선처리', '날짜 - ROW_NUMBER = 그룹 키 아이디어', 'GROUP BY 그룹 키 HAVING COUNT >= N', 'LAG 대안 및 일반화 가능성'],
    pitfalls: [{ text: "같은 날 여러 이벤트를 제거하지 않아 연속 판정 오류", fix: "`SELECT DISTINCT user_id, CAST(ts AS DATE)`로 하루 한 행을 먼저 만드세요." }, { text: "셀프 조인을 3번 해서 N 일반화가 불가능한 쿼리", fix: "\"날짜 - ROW_NUMBER\" 그룹 키 방식을 쓰면 N이 바뀌어도 `HAVING COUNT(*) >= N`만 고치면 됩니다." }],
    followups: [{ q: "유저별 최장 연속 접속일은?", a: "\"날짜 - ROW_NUMBER\"로 만든 그룹 키별로 `COUNT(*)`를 구하고, 유저별 `MAX`를 구합니다." }],
    practice: 'sql-15',
  },
  {
    id: 'sql-null', cat: 'sql', level: 1,
    q: 'SQL에서 NULL은 어떻게 동작하나요? COUNT(*)와 COUNT(컬럼)의 차이도 말해 주세요.',
    intent: 'NULL을 이해하지 못하면 집계 결과가 조용히 틀립니다. 데이터 품질 감각과 연결되는 기본기입니다.',
    answer: `
      - NULL은 '값이 없음/알 수 없음'이며 **어떤 비교도 TRUE가 아닌 UNKNOWN**입니다. \`col = NULL\`이 아니라 \`col IS NULL\`로 비교합니다.
      - \`COUNT(*)\`는 모든 행, \`COUNT(col)\`은 **NULL이 아닌 행**만 셉니다. \`COUNT(DISTINCT col)\`도 NULL을 제외합니다.
      - \`SUM/AVG/MIN/MAX\`는 NULL을 무시합니다. 그래서 **AVG(col)은 'NULL을 0으로 본 평균'과 다릅니다.** 의도에 따라 \`AVG(COALESCE(col, 0))\`를 써야 합니다.
      - \`NOT IN (서브쿼리)\`에 NULL이 하나라도 있으면 결과가 전부 비게 됩니다 → \`NOT EXISTS\`를 권장합니다.
      - 산술 연산에 NULL이 끼면 결과가 NULL입니다 (\`price * NULL = NULL\`).
      - \`GROUP BY\`에서는 NULL끼리 한 그룹으로 묶입니다.

      예시: 쿠폰 사용률을 \`COUNT(coupon_code) / COUNT(*)\`로 구할 수 있는 것도 이 성질 덕분입니다.`,
    keyPoints: ['NULL 비교는 IS NULL (= NULL은 UNKNOWN)', 'COUNT(*) vs COUNT(col)', '집계함수는 NULL 무시 → AVG 왜곡 주의, COALESCE', 'NOT IN + NULL 함정 → NOT EXISTS'],
    pitfalls: [{ text: "결측을 0으로 채워야 할지 제외해야 할지 판단 없이 기계적으로 처리", fix: "\"값이 0이다\"(주문 없음 = 매출 0)와 \"값을 모른다\"(측정 누락)를 구분하세요. 앞의 경우는 COALESCE(x, 0), 뒤의 경우는 제외하거나 따로 표시합니다." }],
    followups: [{ q: "pandas에서 NaN과 None, pd.NA의 차이는?", a: "`NaN`은 float형 결측(넘파이), `None`은 파이썬 객체(object 컬럼), `pd.NA`는 nullable dtype(`Int64`, `string`, `boolean`)의 통일된 결측값입니다. 판정은 모두 `isna()`로 합니다." }],
    practice: 'sql-03',
  },
  {
    id: 'sql-optimize', cat: 'sql', level: 2,
    q: '쿼리가 너무 느릴 때 어떻게 개선하시나요?',
    intent: '대용량 데이터를 다뤄본 경험과 실행 계획을 읽는 습관이 있는지 봅니다. Databricks 사용자라면 파티션과 파일 레이아웃 관점도 기대합니다.',
    answer: `
      **1) 측정부터**: \`EXPLAIN\` / Databricks **Query Profile**로 어느 단계(스캔, 셔플, 조인)가 병목인지 확인합니다.

      **2) 읽는 데이터 줄이기 (가장 효과 큼)**
      - \`SELECT *\` 대신 필요한 컬럼만 → 컬럼 기반 포맷(Parquet/Delta)에서 효과가 큽니다.
      - **파티션 컬럼으로 필터**해서 파티션 프루닝이 일어나게 합니다 (예: \`event_date\`). 필터 컬럼에 함수를 씌우면(\`YEAR(event_date) = 2025\`) 프루닝이 안 될 수 있습니다.
      - Delta 신규 테이블은 파티셔닝·Z-ORDER 대신 **Liquid Clustering**(\`CLUSTER BY\`)과 Predictive Optimization을 권장합니다 (기존 테이블은 Z-ORDER). 자주 필터하는 컬럼의 데이터 스키핑을 높여줍니다.

      **3) 조인 최적화**
      - 조인 전에 필터와 집계를 먼저 해서 조인 입력을 줄입니다.
      - 작은 테이블은 **broadcast join**이 되도록 합니다 (Spark 힌트 \`/*+ BROADCAST(t) */\`).
      - 조인 키 타입을 맞추고, 팬아웃(1:N 증식)이 없는지 확인합니다.

      **4) 기타**
      - \`COUNT(DISTINCT)\`가 무겁다면 \`approx_count_distinct\`를 검토합니다 (대시보드용).
      - 같은 서브쿼리를 반복하면 중간 결과를 테이블로 저장(materialize)합니다.
      - 작은 파일이 많으면 \`OPTIMIZE\`로 파일을 합칩니다.`,
    keyPoints: ['실행계획/Query Profile로 병목 측정', '필요 컬럼만, 파티션 프루닝되도록 필터', '조인 전 필터/집계, broadcast join', 'Z-ORDER/클러스터링, OPTIMIZE, 근사 집계'],
    pitfalls: [{ text: "\"인덱스를 건다\"만 답함", fix: "레이크하우스에는 전통적 인덱스가 없습니다. 파티션 프루닝, Z-ORDER/Liquid Clustering, 필요한 컬럼만 읽기, 조인 전 필터링, broadcast join을 말하세요." }],
    followups: [{ q: "데이터 스큐(skew)가 있으면 어떻게 하나요?", a: "Spark UI에서 특정 태스크만 오래 걸리면 스큐입니다. AQE의 skew join 최적화를 켜거나, 작은 쪽을 broadcast하거나, 핫 키에 salting(랜덤 접미사)을 붙이거나, 핫 키만 따로 처리합니다." }],
  },
  {
    id: 'sql-cte-union', cat: 'sql', level: 1,
    q: 'UNION과 UNION ALL, 서브쿼리와 CTE의 차이를 설명해 주세요.',
    intent: '기본 문법 이해와 함께 가독성 있는 쿼리를 짜는 습관이 있는지 봅니다.',
    answer: `
      **UNION vs UNION ALL**
      - \`UNION\`은 결과를 합친 뒤 **중복을 제거**하고(정렬/해시 비용 발생), \`UNION ALL\`은 그대로 이어 붙입니다.
      - 중복이 없거나 중복을 유지해야 한다면 \`UNION ALL\`이 빠르고 의도도 명확합니다.

      **서브쿼리 vs CTE(WITH 절)**
      - 기능적으로는 대부분 같지만, CTE는 **이름을 붙여 위에서 아래로 읽히게** 만들어 복잡한 분석 쿼리의 가독성과 디버깅이 좋아집니다.
      - 같은 중간 결과를 여러 번 참조할 때 CTE가 편합니다. (엔진에 따라 매번 다시 계산할 수도 있으니, 무거운 중간 결과는 임시 테이블로 저장하기도 합니다.)
      - 재귀 CTE(\`WITH RECURSIVE\`)로 조직도 같은 계층 구조를 탐색할 수 있습니다.

      실무에서는 **"CTE로 단계별 로직을 쪼개고, 각 단계 결과를 따로 확인하는 습관"**이 정확도를 높입니다.`,
    keyPoints: ['UNION은 중복 제거(비용), UNION ALL은 유지', 'CTE는 가독성/재사용, 단계별 검증', '재귀 CTE 활용'],
    followups: [{ q: "상관 서브쿼리(correlated subquery)란?", a: "바깥 쿼리의 컬럼을 참조해 바깥 행마다 다시 평가되는 서브쿼리입니다(예: `EXISTS (SELECT 1 FROM o WHERE o.user_id = u.user_id)`). 대용량에서는 조인이나 윈도우 함수로 바꾸는 것이 빠른 경우가 많습니다." }],
    practice: 'sql-08',
  },

  // ───────────────────────── pandas ─────────────────────────
  {
    id: 'pd-loc-iloc', cat: 'pandas', level: 1,
    q: 'pandas에서 loc과 iloc의 차이는 무엇인가요?',
    intent: 'pandas 인덱싱의 기본입니다. 슬라이싱 끝 포함 여부 같은 디테일까지 아는지 봅니다.',
    answer: `
      - \`loc\`: **라벨(인덱스 이름, 컬럼 이름) 기반**. 불리언 마스크도 받습니다. 슬라이스 끝을 **포함**합니다.
      - \`iloc\`: **정수 위치 기반**. 파이썬 리스트처럼 슬라이스 끝을 **제외**합니다.

      \`\`\`python
      df.loc[df['status'] == 'completed', ['user_id', 'total_amount']]   # 조건 + 컬럼 선택
      df.iloc[:5, :3]                                                   # 앞 5행, 앞 3열
      df.loc['2025-01-01':'2025-01-07']                                 # DatetimeIndex 라벨 슬라이스 (끝 포함)
      \`\`\`

      **실무 팁**: 값을 바꿀 때는 \`df.loc[mask, 'col'] = value\`처럼 **한 번에 loc으로 할당**해야 \`SettingWithCopyWarning\`(체인 할당 문제)을 피할 수 있습니다.`,
    keyPoints: ['loc = 라벨/불리언, iloc = 정수 위치', '슬라이스 끝 포함(loc) vs 제외(iloc)', '할당은 df.loc[mask, col] = v로'],
    followups: [{ q: "df[df.a > 0][\"b\"] = 1 이 왜 문제인가요?", a: "체인 인덱싱이라 중간 결과가 복사본일 수 있어 원본이 바뀌지 않습니다(SettingWithCopyWarning, pandas 3.0에서는 아예 바뀌지 않음). `df.loc[df.a > 0, \"b\"] = 1`로 한 번에 할당하세요." }],
    practice: 'pd-01',
  },
  {
    id: 'pd-groupby-transform', cat: 'pandas', level: 2,
    q: 'groupby 후 agg와 transform의 차이는 무엇인가요? 각각 언제 쓰나요?',
    intent: 'SQL의 GROUP BY와 윈도우 함수에 대응하는 개념을 pandas에서 구분하는지 봅니다.',
    answer: `
      - \`agg\`: 그룹당 **한 행**으로 줄입니다 → SQL의 \`GROUP BY\`
      - \`transform\`: 결과를 **원래 행 수 그대로** 돌려줍니다 → SQL의 \`윈도우 함수 (PARTITION BY)\`

      \`\`\`python
      # 유저별 매출 요약 (행이 줄어듦)
      summary = orders.groupby('user_id').agg(
          order_cnt=('order_id', 'count'),
          revenue=('total_amount', 'sum'),
      )

      # 각 주문이 그 유저 전체 매출에서 차지하는 비중 (행 유지)
      orders['user_total'] = orders.groupby('user_id')['total_amount'].transform('sum')
      orders['share'] = orders['total_amount'] / orders['user_total']
      \`\`\`

      그 밖에 \`apply\`는 그룹별로 임의 함수를 실행해 가장 유연하지만 느립니다. \`filter\`는 그룹 단위로 행을 남기거나 버립니다 (SQL의 HAVING과 비슷). 순위는 \`groupby().rank()\`, 누적합은 \`groupby().cumsum()\`, 이전 값은 \`groupby().shift()\`를 씁니다.`,
    keyPoints: ['agg = 그룹당 1행 (GROUP BY)', 'transform = 원래 행 수 유지 (윈도우 함수)', 'named aggregation 문법', 'apply는 유연하지만 느림, filter는 HAVING'],
    followups: [{ q: "그룹별 상위 3개 행은 어떻게 뽑나요?", a: "`df.sort_values('v', ascending=False).groupby('g').head(3)` 입니다. 동점까지 포함하려면 `df[df.groupby('g')['v'].rank(method='dense', ascending=False) <= 3]`를 씁니다. (`groupby().apply`는 pandas 3.0에서 그룹 컬럼이 빠지므로 피합니다.)" }],
    practice: 'pd-04',
  },
  {
    id: 'pd-merge', cat: 'pandas', level: 1,
    q: 'merge, join, concat의 차이를 설명해 주세요.',
    intent: '데이터 결합 도구를 정확히 구분하고, 조인 후 행 수 검증 습관이 있는지 봅니다.',
    answer: `
      - \`pd.merge(left, right, on=..., how=...)\`: **컬럼 값 기준** 결합 = SQL JOIN. \`how\`는 inner/left/right/outer/cross.
      - \`df.join(other)\`: **인덱스 기준** 결합의 단축 문법 (기본 left).
      - \`pd.concat([a, b])\`: 위아래(axis=0) 또는 좌우(axis=1)로 **이어 붙이기** = SQL UNION ALL.

      **실무 안전장치**
      \`\`\`python
      merged = orders.merge(users, on='user_id', how='left',
                            validate='many_to_one',   # 키 관계가 다르면 에러 → 팬아웃 방지
                            indicator=True)           # _merge 컬럼으로 매칭 여부 확인
      assert len(merged) == len(orders)
      \`\`\`
      \`validate\`와 \`indicator\`를 쓰면 키 중복으로 행이 늘어나는 문제나 매칭 실패를 바로 잡아낼 수 있습니다.`,
    keyPoints: ['merge = 컬럼 기준 JOIN', 'join = 인덱스 기준', 'concat = 이어 붙이기(UNION ALL)', 'validate/indicator로 결합 검증'],
    practice: 'pd-03',
  },
  {
    id: 'pd-missing', cat: 'pandas', level: 1,
    q: '결측치를 어떻게 처리하시나요?',
    intent: '기계적으로 제거하거나 채우는지, 결측의 원인과 메커니즘을 먼저 보는지 확인합니다.',
    answer: `
      **1) 먼저 파악합니다**: \`df.isna().sum()\`, \`df.isna().mean()\`으로 컬럼별 결측 비율을 보고, **왜 비어 있는지** 확인합니다.
      - 구조적 결측: 쿠폰을 안 썼으니 coupon_code가 비어 있음 → 결측이 아니라 '없음'이라는 정보 (\`fillna('NONE')\`)
      - 수집 오류: 특정 앱 버전에서 로깅 누락 → 해당 구간을 분석에서 제외하거나 원인 리포트
      - 완전 무작위 결측(MCAR) vs 관측된 다른 변수로 설명되는 결측(MAR) vs 결측값 자체와 관련된 결측(MNAR, 예: 고소득자가 소득을 안 적음) → 단순 삭제 시 편향 발생 여부 판단

      **2) 처리 방법**
      - 삭제: \`dropna(subset=[...])\` — 결측 비율이 낮고 무작위일 때
      - 대치: 평균/중앙값(이상치가 있으면 중앙값), 그룹별 대치(\`groupby().transform('median')\`), 시계열은 \`ffill\`/보간
      - 플래그: \`is_missing\` 컬럼을 추가해 결측 자체를 정보로 활용

      **3) 결측 처리 전후로 결론이 바뀌는지 확인**(민감도 분석)하고, 처리 방식을 리포트에 명시합니다.`,
    keyPoints: ['결측 비율·패턴 파악 먼저', '결측 원인(구조적/수집오류/MCAR·MAR·MNAR) 구분', '삭제/대치/플래그 방법과 선택 기준', '처리 방식의 영향 확인 및 문서화'],
    pitfalls: [{ text: "무조건 평균으로 채움", fix: "결측 원인을 먼저 확인하고, 치우친 분포는 중앙값, 그룹 차이가 크면 그룹별 대치, 원인이 의미 있으면 결측 플래그를 쓰세요." }, { text: "결측이 의미 있는 정보(미사용 등)인 경우를 놓침", fix: "쿠폰 미사용처럼 구조적 결측은 `fillna('NONE')`이나 `is_missing` 컬럼으로 정보를 살리세요." }],
    practice: 'pd-02',
  },
  {
    id: 'pd-vectorize', cat: 'pandas', level: 2,
    q: 'pandas에서 apply와 for 루프가 느린 이유와, 성능을 개선하는 방법을 말해 주세요.',
    intent: '대용량 데이터를 다룰 때 효율적인 코드를 쓰는지 봅니다.',
    answer: `
      pandas와 NumPy는 내부적으로 C로 구현된 **벡터화 연산**으로 배열 전체를 한 번에 처리합니다. 반면 \`for\` 루프나 행 단위 \`apply(axis=1)\`는 행마다 파이썬 함수를 호출하므로 수십~수백 배 느립니다.

      **개선 방법**
      - 산술/비교는 컬럼 연산으로: \`df['net'] = df['price'] * df['qty'] - df['discount']\`
      - 조건 분기는 \`np.where\` / \`np.select\` / \`pd.cut\`:
      \`\`\`python
      df['tier'] = np.select(
          [df.revenue >= 500000, df.revenue >= 100000],
          ['VIP', 'Regular'], default='Light')
      \`\`\`
      - 문자열/날짜는 \`.str\`, \`.dt\` 접근자
      - 매핑은 \`map(dict)\` 또는 merge
      - 메모리: 반복값이 많은 문자열 컬럼은 \`category\` dtype, 정수는 downcast
      - 그래도 크다면 **Spark(Databricks)에서 집계한 뒤 결과만 pandas로** 가져옵니다 (\`toPandas()\`는 드라이버 메모리에 전부 올라가므로 주의).`,
    keyPoints: ['벡터화(C 구현) vs 파이썬 루프', 'np.where / np.select / pd.cut', '.str / .dt 접근자, map', 'category dtype 등 메모리 최적화', '대용량은 Spark에서 집계 후 pandas'],
  },
  {
    id: 'pd-pivot', cat: 'pandas', level: 2,
    q: 'pivot, pivot_table, melt의 차이를 설명해 주세요.',
    intent: 'wide와 long 형태 변환을 자유롭게 하는지 봅니다. 리포트용 크로스탭을 만들 때 필수입니다.',
    answer: `
      - \`pivot(index, columns, values)\`: long → wide. **(index, columns) 조합이 유일해야** 하며 집계하지 않습니다. 중복이 있으면 에러가 납니다.
      - \`pivot_table(index, columns, values, aggfunc='sum', fill_value=0, margins=True)\`: 중복이 있으면 **집계**합니다. 엑셀 피벗과 같습니다.
      - \`melt(id_vars, value_vars)\`: wide → long (pivot의 반대). 시각화 라이브러리나 groupby에 넣기 좋은 형태입니다.
      - \`pd.crosstab(a, b, normalize='index')\`: 빈도나 비율 교차표를 빠르게 만듭니다.

      \`\`\`python
      # 월 × 카테고리 매출표
      pt = df.pivot_table(index='month', columns='category', values='amount',
                          aggfunc='sum', fill_value=0)
      \`\`\`
      SQL에서는 \`SUM(CASE WHEN category = 'books' THEN amount END)\` 패턴이나 Databricks/DuckDB의 \`PIVOT\` 구문으로 같은 결과를 냅니다.`,
    keyPoints: ['pivot은 집계 없음(유일 조합 필요)', 'pivot_table은 aggfunc로 집계', 'melt는 wide→long', 'SQL CASE WHEN / PIVOT 대응'],
    practice: 'pd-06',
  },
  {
    id: 'pd-copy', cat: 'pandas', level: 2,
    q: 'SettingWithCopyWarning은 왜 발생하고 어떻게 해결하나요?',
    intent: '실무 pandas 코드에서 조용히 발생하는 버그를 이해하는지 봅니다.',
    answer: `
      \`df[df.a > 0]['b'] = 1\`처럼 **체인 인덱싱으로 할당**하면, 중간 결과가 원본의 view인지 copy인지 불확실해서 원본이 바뀌지 않을 수 있습니다. pandas가 이를 경고하는 것이 SettingWithCopyWarning입니다.

      **해결**
      - 한 번의 \`loc\`으로 할당: \`df.loc[df.a > 0, 'b'] = 1\`
      - 부분 데이터를 따로 가공하려면 명시적으로 복사: \`sub = df[df.a > 0].copy()\`
      - 메서드 체이닝 스타일: \`df.assign(b=lambda d: np.where(d.a > 0, 1, d.b))\`

      참고로 **pandas 3.0부터 Copy-on-Write가 기본**이 되어 SettingWithCopyWarning은 사라졌고, 체인 할당은 원본을 절대 바꾸지 않으며 \`ChainedAssignmentError\` 경고가 납니다. 그래서 \`loc\` 한 번으로 할당하는 습관이 더욱 중요합니다.`,
    keyPoints: ['체인 인덱싱 할당 → view/copy 모호', 'df.loc[mask, col] = v', '.copy() 명시', 'pandas 3.0 Copy-on-Write 기본'],
  },

  // ───────────────────────── 통계 ─────────────────────────
  {
    id: 'st-pvalue', cat: 'stats', level: 1,
    q: 'p-value가 무엇인지 비전공자도 이해할 수 있게 설명해 주세요.',
    intent: '가장 많이 오해되는 개념입니다. 정확한 정의와 쉬운 설명을 함께 할 수 있는지(커뮤니케이션 능력)를 봅니다.',
    answer: `
      **정의**: 귀무가설(효과가 없다)이 참이라고 가정했을 때, **지금 관찰한 것만큼 또는 그보다 더 극단적인 결과가 우연히 나올 확률**입니다.

      **쉬운 설명**: "새 버튼이 사실 아무 효과가 없다고 쳐도, 우연만으로 이 정도 차이가 날 확률이 3%다. 우연이라 보기엔 드무니 효과가 있다고 판단하자."

      **흔한 오해 (면접에서 꼭 짚기)**
      - ❌ "p-value = 귀무가설이 참일 확률" → 아닙니다. p-value는 귀무가설이 참이라는 **가정 하의** 데이터 확률입니다.
      - ❌ "p가 작을수록 효과가 크다" → 표본이 크면 아주 작은 효과도 p가 작아집니다. **효과 크기와 신뢰구간**을 함께 봐야 합니다.
      - ❌ "p > 0.05면 효과가 없다" → '효과가 없다는 증거'가 아니라 '효과를 입증할 증거가 부족하다'입니다 (검정력 부족일 수 있음).

      0.05는 관례일 뿐이므로, 실무에서는 비즈니스 리스크에 따라 유의수준을 사전에 정합니다.`,
    keyPoints: ['귀무가설이 참이라는 가정 하에 관측값 이상 극단적일 확률', '쉬운 비유로 설명', '귀무가설이 참일 확률이 아님', '효과 크기·신뢰구간과 함께 해석', 'p>0.05 ≠ 효과 없음'],
    pitfalls: [{ text: "\"귀무가설이 맞을 확률\"이라고 정의", fix: "\"귀무가설이 참이라고 가정할 때, 지금처럼 또는 더 극단적인 결과가 나올 확률\"이라고 정의하세요." }, { text: "정의만 외우고 비즈니스 언어로 번역하지 못함", fix: "\"효과가 없다고 쳐도 우연히 이 정도 차이가 날 확률이 3%라 우연으로 보기 어렵다\"처럼 한 문장으로 바꿔 말하는 연습을 하세요." }],
    followups: [{ q: "p-value가 0.051이 나왔습니다. 어떻게 하시겠어요?", a: "사전에 정한 α=0.05 기준으로는 \"유의하지 않음\"입니다. 기준을 사후에 바꾸지 않습니다. 대신 효과 크기와 신뢰구간, 검정력을 함께 보고하고, 의미 있는 효과로 보이면 표본을 충분히 늘린 재실험을 제안합니다." }],
  },
  {
    id: 'st-errors', cat: 'stats', level: 1,
    q: '1종 오류와 2종 오류, 그리고 검정력(Power)에 대해 설명해 주세요.',
    intent: '실험 설계의 기초 개념을 비즈니스 맥락과 연결해서 설명할 수 있는지 봅니다.',
    answer: `
      | | 실제 효과 없음 (H0 참) | 실제 효과 있음 (H1 참) |
      |---|---|---|
      | 효과 있다고 판단 | **1종 오류 (α, False Positive)** | 올바른 판단 = **검정력 (1-β)** |
      | 효과 없다고 판단 | 올바른 판단 | **2종 오류 (β, False Negative)** |

      - **1종 오류(α)**: 효과 없는 기능을 효과 있다고 보고 출시 → 리소스 낭비, 잘못된 의사결정. 보통 α = 0.05.
      - **2종 오류(β)**: 효과 있는 기능을 놓침 → 기회 손실. 보통 β = 0.2 (검정력 80%).
      - **검정력**은 표본 크기↑, 효과 크기↑, 분산↓, α↑일수록 커집니다.

      **트레이드오프**: 같은 표본에서 α를 낮추면 β가 커집니다. 그래서 실험 전에 '탐지하고 싶은 최소 효과(MDE)'를 정하고, 원하는 α와 검정력을 만족하는 **표본 크기를 미리 계산**합니다.

      비즈니스 예: 결제 플로우처럼 잘못 출시하면 손실이 큰 실험은 α를 더 엄격하게, 빠른 탐색이 중요한 UI 실험은 다소 느슨하게 설정할 수 있습니다.`,
    keyPoints: ['1종 = 거짓 양성(α), 2종 = 거짓 음성(β)', '검정력 = 1-β, 보통 80%', '검정력 결정 요인(표본, 효과크기, 분산, α)', 'α-β 트레이드오프와 사전 표본 크기 계산', '비즈니스 비용과 연결'],
    followups: [{ q: "검정력이 낮은 실험에서 유의한 결과가 나오면 어떤 문제가 있나요?", a: "유의성을 넘으려면 우연히 크게 나와야 하므로 효과 크기가 과대 추정됩니다(winner's curse). 거짓 양성일 가능성도 높아 재현이 잘 되지 않습니다. 재실험이나 출시 후 홀드아웃으로 확인합니다." }],
  },
  {
    id: 'st-ci', cat: 'stats', level: 2,
    q: '95% 신뢰구간은 어떻게 해석해야 하나요?',
    intent: '빈도주의 신뢰구간의 정확한 의미를 알고 실무 보고에 활용할 수 있는지 봅니다.',
    answer: `
      **정확한 해석**: 같은 방식으로 표본을 뽑아 신뢰구간을 100번 만들면, 그중 약 95개가 진짜 모수를 포함한다는 뜻입니다. 즉 '95%'는 **구간을 만드는 방법의 신뢰도**입니다.

      ❌ "진짜 값이 이 구간 안에 있을 확률이 95%" — 빈도주의에서 모수는 고정된 값이라 확률 표현을 쓰지 않습니다. (베이지안 신용구간은 이렇게 해석할 수 있습니다.)

      **실무에서의 가치**
      - p-value보다 정보가 많습니다: **효과의 크기와 불확실성**을 함께 보여줍니다.
      - 전환율 차이의 95% CI가 [+0.2%p, +3.1%p]라면 "유의하지만, 효과가 작게는 0.2%p일 수도 있다" → 출시 의사결정 시 하한이 비즈니스적으로 의미 있는지 판단합니다.
      - 구간이 0을 포함하면 α=0.05 양측검정에서 유의하지 않습니다.

      구간 폭은 표본 크기의 제곱근에 반비례합니다. 표본을 4배로 늘려야 구간 폭이 절반이 됩니다.`,
    keyPoints: ['반복 시 95%의 구간이 모수를 포함 (방법의 신뢰도)', '"모수가 구간에 있을 확률 95%"는 오해', '효과 크기와 불확실성 동시 전달', '0 포함 여부와 유의성 관계', '폭 ∝ 1/√n'],
  },
  {
    id: 'st-clt', cat: 'stats', level: 1,
    q: '중심극한정리(CLT)란 무엇이고, 왜 중요한가요?',
    intent: '왜 대부분의 검정이 정규분포를 쓰는지 근본 원리를 이해하는지 봅니다.',
    answer: `
      **모집단 분포가 무엇이든(분산이 유한하면), 표본 크기가 충분히 크면 표본평균의 분포는 정규분포에 가까워진다**는 정리입니다. 표본평균의 표준오차는 σ/√n입니다.

      **왜 중요한가**
      - 매출처럼 한쪽으로 크게 치우친 데이터도, 그룹 평균의 차이는 정규분포로 근사할 수 있어서 **t-검정과 z-검정을 쓸 수 있는 근거**가 됩니다.
      - A/B 테스트에서 전환율(베르누이 평균)의 차이를 z-검정하는 것도 CLT 덕분입니다.
      - 신뢰구간 계산(평균 ± 1.96 × SE)의 기반입니다.

      **주의**: '충분히 큰 n'은 분포 모양에 따라 다릅니다. 매출처럼 극단적인 롱테일(소수 고래 유저)이 있으면 수천 건 이상 필요할 수 있습니다. 이럴 때는 로그 변환, 윈저라이징(상위 값 캡), 부트스트랩, 비모수 검정을 검토합니다.

      (A/B 테스트 탭의 시뮬레이터에서 직접 확인해 볼 수 있습니다.)`,
    keyPoints: ['모집단 분포와 무관하게 표본평균 분포 → 정규', '표준오차 σ/√n', 't/z 검정, 신뢰구간의 근거', '치우친 분포는 더 큰 n 필요 → 변환/부트스트랩'],
  },
  {
    id: 'st-mean-median', cat: 'stats', level: 1,
    q: '평균과 중앙값 중 무엇을 보고해야 하나요? 객단가 분석을 예로 들어주세요.',
    intent: '분포를 먼저 보는 습관과 이상치에 대한 감각을 확인합니다.',
    answer: `
      **분포를 먼저 봅니다.** 객단가나 매출은 대부분 오른쪽으로 긴 꼬리(right-skewed)를 가져, 소수의 고액 주문이 평균을 끌어올립니다. 이럴 때는 평균 > 중앙값이 됩니다.

      - **중앙값**: '전형적인 고객'을 설명할 때 적합하고 이상치에 강건합니다.
      - **평균**: **총합과 연결**되는 지표입니다 (평균 × 주문 수 = 총매출). 매출 목표나 재무 관점에서는 평균이 필요합니다.

      **실무 답변**: "둘 다 보고합니다. 중앙값으로 일반 고객을 설명하고, 평균으로 매출 영향을 계산합니다. 차이가 크면 상위 1% 주문이 매출의 몇 %를 차지하는지 함께 보여줍니다. 실험 지표로 평균을 쓴다면 이상치 영향을 줄이려고 윈저라이징이나 로그 변환을 검토합니다."

      분포 확인 도구: 히스토그램, 박스플롯, 백분위수(p50/p90/p99)`,
    keyPoints: ['분포(왜도) 먼저 확인', '중앙값 = 전형값, 이상치에 강건', '평균 = 총합과 연결(매출)', '둘 다 + 백분위수 보고, 이상치 처리 방법'],
  },
  {
    id: 'st-causation', cat: 'stats', level: 2,
    q: '상관관계와 인과관계의 차이는 무엇인가요? 심슨의 역설도 설명해 주세요.',
    intent: '분석 결과를 과대 해석하지 않는지, 교란 변수(confounder)를 떠올리는지 봅니다.',
    answer: `
      **상관관계 ≠ 인과관계.** 두 변수가 함께 움직여도 다음 가능성이 있습니다.
      - **교란 변수**: 아이스크림 판매량과 익사 사고는 '기온'이라는 공통 원인 때문에 상관이 있습니다.
      - **역인과**: "쿠폰을 쓴 유저가 충성도가 높다" → 쿠폰이 충성도를 만든 게 아니라 충성 유저가 쿠폰을 더 챙겨 쓸 수 있습니다.
      - **선택 편향과 우연**

      인과를 주장하려면 **무작위 실험(A/B 테스트)**이 가장 확실합니다. 실험이 불가능하면 DiD(이중차분), 성향점수매칭, 회귀불연속 같은 준실험 방법을 사용합니다.

      **심슨의 역설**: 전체 데이터에서 보이는 경향이 **하위 그룹에서는 반대로** 나타나는 현상입니다.
      예) 전체로는 B안 전환율이 높지만, iOS와 Android를 각각 보면 둘 다 A안이 높습니다 → B안 트래픽에 전환율이 원래 높은 iOS 비중이 많았기 때문입니다 (그룹 구성 차이 = 교란).
      → 그래서 비교할 때는 **세그먼트별로도 확인**하고, 실험에서는 무작위 배정으로 구성 차이를 없앱니다.`,
    keyPoints: ['교란 변수, 역인과, 선택 편향', '인과 = 무작위 실험, 불가 시 준실험(DiD, PSM, RDD)', '심슨의 역설 정의 + 예시', '세그먼트별 확인의 중요성'],
    followups: [{ q: "쿠폰 발행이 재구매에 미치는 효과를 실험 없이 추정해야 한다면?", a: "발행 대상과 비대상의 전후 변화를 비교하는 이중차분(DiD, 평행 추세 확인), 성향점수 매칭, 발행 기준점이 있으면 회귀 불연속을 씁니다. 다음부터는 홀드아웃 그룹을 두자고 제안합니다." }],
  },
  {
    id: 'st-tests', cat: 'stats', level: 2,
    q: 't-검정, 카이제곱 검정, Mann-Whitney U 검정은 각각 언제 사용하나요?',
    intent: '데이터 유형과 가정에 맞는 검정을 고를 수 있는지 봅니다. "도구보다 통계적 추론"이 요즘 면접의 포인트입니다.',
    answer: `
      | 상황 | 검정 |
      |---|---|
      | 두 그룹의 **평균** 비교 (연속형: 객단가, 체류시간) | **Welch t-검정** (분산이 달라도 됨, 실무 기본값) |
      | 두 그룹의 **비율** 비교 (전환율) | **두 비율 z-검정** 또는 카이제곱 검정 (2×2에서 연속성 보정이 없으면 χ² = z²로 동일) |
      | 범주형 변수 간 **독립성** (플랫폼 × 구매여부), 배정 비율 검증(SRM) | **카이제곱 검정** (기대빈도가 작으면 Fisher 정확검정) |
      | 정규성 가정이 의심되고 이상치가 심하며 표본이 작음 | **Mann-Whitney U** (순위 기반, 비모수) |
      | 같은 대상의 전/후 비교 | **대응표본 t-검정** / Wilcoxon 부호순위 |
      | 3개 이상 그룹 평균 | ANOVA → 사후검정 |

      **주의**: Mann-Whitney는 '평균 차이'가 아니라 '한 그룹 값이 다른 그룹보다 큰 경향(분포 차이)'을 검정합니다. 매출 총액처럼 평균이 비즈니스적으로 중요하면, 표본이 충분할 때는 CLT에 기대 t-검정을 쓰거나 **부트스트랩으로 평균 차이의 신뢰구간**을 구하는 편이 의사결정에 더 적합합니다.`,
    keyPoints: ['평균 → Welch t-test', '비율 → z-test/카이제곱', '독립성/SRM → 카이제곱', '비모수 → Mann-Whitney (분포 차이 검정)', '비즈니스 질문(평균 vs 분포)에 맞춰 선택, 부트스트랩'],
  },
  {
    id: 'st-bayes', cat: 'stats', level: 2,
    q: '어떤 질병의 유병률이 1%이고, 검사의 민감도가 99%, 특이도가 95%입니다. 양성 판정을 받았을 때 실제로 병이 있을 확률은?',
    intent: '베이즈 정리와 기저율(base rate) 개념을 직관적으로 이해하는지 봅니다. 사기 탐지, 이상 탐지 모델의 정밀도 문제와 연결됩니다.',
    answer: `
      **1만 명으로 생각하면 쉽습니다.**
      - 실제 환자: 100명 → 양성 99명 (민감도 99%)
      - 건강한 사람: 9,900명 → 위양성 495명 (특이도 95% → 5% 오진)
      - 양성 판정 총 594명 중 진짜 환자는 99명

      **P(병 | 양성) = 99 / 594 ≈ 16.7%**

      베이즈 정리로 쓰면:
      P(D|+) = P(+|D)·P(D) / [P(+|D)·P(D) + P(+|¬D)·P(¬D)] = 0.99×0.01 / (0.99×0.01 + 0.05×0.99) ≈ 0.167

      **실무 의미**: 기저율이 낮은 사건(사기 거래, 이탈, 장애)에서는 정확해 보이는 모델도 **양성 예측의 대부분이 오탐**일 수 있습니다. 그래서 정확도(accuracy)가 아니라 정밀도(precision)와 재현율(recall), 그리고 오탐의 비즈니스 비용을 함께 봐야 합니다.`,
    keyPoints: ['자연 빈도(1만 명)로 계산', '정답 약 16.7%', '베이즈 정리 공식', '기저율의 중요성 → 정밀도/오탐 비용 연결'],
  },
  {
    id: 'st-multiple', cat: 'stats', level: 3,
    q: '하나의 실험에서 지표 20개를 동시에 검정했더니 1개가 유의하게 나왔습니다. 어떻게 해석하시겠어요?',
    intent: '다중 비교 문제를 인지하고 실무적인 해결책을 아는지 봅니다.',
    answer: `
      **다중 비교 문제**입니다. α=0.05로 독립적인 검정 20개를 하면, 실제 효과가 하나도 없어도 최소 1개가 유의하게 나올 확률은 1 − 0.95²⁰ ≈ **64%**입니다. 그 1개는 우연일 가능성이 큽니다.

      **해결 방법**
      - **사전에 1차 지표(primary metric) 1~2개를 정해두고**, 출시 판단은 그것으로 합니다. 나머지는 보조/가드레일 지표로 탐색적 성격임을 명시합니다.
      - 보정: **Bonferroni** (α/m, 보수적), **Holm** (단계적, 덜 보수적), **Benjamini-Hochberg** (FDR 통제, 지표가 많을 때 실무에서 많이 씀).
      - 세그먼트를 잘게 쪼개 유의한 곳을 찾는 것(p-hacking)도 같은 문제입니다 → 가설을 사전 등록하고, 발견된 효과는 **후속 실험으로 재검증**합니다.`,
    keyPoints: ['1-(0.95)^20 ≈ 64% 계산', '사전 primary metric 지정', 'Bonferroni/Holm/BH(FDR) 보정', '세그먼트 쪼개기 = p-hacking, 재실험 검증'],
  },
  {
    id: 'st-bias', cat: 'stats', level: 2,
    q: '분석에서 주의해야 할 편향(bias)의 예를 들어주세요.',
    intent: '데이터가 어떻게 만들어졌는지 비판적으로 보는 습관이 있는지 확인합니다.',
    answer: `
      - **선택 편향**: 설문 응답자는 충성 고객 위주라 만족도가 과대 측정됩니다.
      - **생존자 편향**: "1년 이상 쓴 유저는 기능 X를 많이 쓴다" → 이탈자는 데이터에서 사라졌기 때문일 수 있습니다. 2차대전 폭격기 장갑 사례가 유명합니다.
      - **자기 선택 편향**: 새 기능을 '켠' 유저와 안 켠 유저를 비교하면 원래 활발한 유저가 켰을 가능성이 큽니다 → 기능 효과가 과대 추정됩니다.
      - **노출/신규 효과(Novelty effect)**: 실험 초기에 새로움 때문에 반응이 일시적으로 증가합니다.
      - **평균으로의 회귀**: 성과가 가장 나빴던 매장에 컨설팅을 했더니 좋아졌다 → 개입이 없어도 다음 기간에는 평균 쪽으로 돌아갈 수 있습니다.
      - **확증 편향**: 원하는 결론을 지지하는 분석만 찾습니다.

      대응: 비교 집단을 공정하게 설정(무작위화)하고, 데이터 생성 과정을 이해하며, 결론에 불리한 증거도 찾아봅니다.`,
    keyPoints: ['선택/생존자/자기선택 편향 예시', '노출효과, 평균으로의 회귀', '확증 편향', '대응: 무작위화, 데이터 생성과정 이해'],
  },
  {
    id: 'st-regression', cat: 'stats', level: 2,
    q: '선형 회귀분석 결과에서 계수와 R²는 어떻게 해석하나요?',
    intent: 'DA가 가장 많이 쓰는 모델인 회귀의 해석 능력과 가정을 아는지 봅니다.',
    answer: `
      - **계수(β)**: *다른 변수가 일정할 때* 해당 변수가 1단위 증가하면 y가 평균적으로 β만큼 변한다는 뜻입니다. 로그를 취한 경우(log-y)에는 대략 '100×β% 변화'로 해석합니다.
      - **p-value/신뢰구간**: 계수가 0이 아니라고 볼 근거가 있는지 보여줍니다.
      - **R²**: y의 분산 중 모델이 설명하는 비율입니다. R²가 낮아도 계수 추정이 유의하면 '관계'에 대한 인사이트는 유효할 수 있고, 반대로 R²가 높아도 인과를 의미하지는 않습니다. 변수가 많으면 R²는 무조건 올라가므로 **수정 R²**를 봅니다.

      **가정과 체크 포인트**: 선형성, 잔차의 독립성·등분산성·정규성, **다중공선성**(VIF가 높으면 계수가 불안정하고 부호가 뒤집힐 수 있음), 이상치와 레버리지 점.

      **실무 해석 주의**: 관측 데이터의 회귀계수는 교란 변수가 빠지면 편향됩니다 (누락변수 편향). "광고비 계수가 양수 = 광고가 매출을 올린다"를 인과로 주장하려면 추가 근거가 필요합니다.`,
    keyPoints: ['계수: 다른 변수 고정 시 1단위 변화의 효과', 'R²: 설명된 분산 비율, 수정 R²', '가정: 선형성, 잔차 독립·등분산, 다중공선성', '관측 데이터 회귀 ≠ 인과 (누락변수 편향)'],
  },

  // ───────────────────────── A/B 테스트 ─────────────────────────
  {
    id: 'ab-design', cat: 'ab', level: 2,
    q: 'A/B 테스트를 처음부터 끝까지 어떻게 설계하고 진행하시나요?',
    intent: '토스, 쿠팡 등의 DA 공고에 공통으로 들어가는 핵심 역량입니다. 가설부터 의사결정까지 전체 흐름을 구조적으로 말할 수 있는지 봅니다.',
    answer: `
      **1. 목표와 가설 정의**
      "결제 버튼 문구를 바꾸면 결제 전환율이 오를 것이다. 왜냐하면 현재 문구가 모호해 망설임을 유발하기 때문이다." → 가설에 **근거(왜)**를 포함합니다.

      **2. 지표 설계**
      - 1차 지표(Primary): 결제 전환율 (의사결정 기준, 1개)
      - 보조 지표(Secondary): 객단가, 장바구니 진입률
      - 가드레일(Guardrail): 환불률, 페이지 로딩 시간, 전체 매출 → 나빠지면 안 되는 것

      **3. 실험 단위와 배정**: 유저 단위 무작위 배정 (세션 단위면 한 유저가 두 버전을 보는 오염 발생). 해시 기반으로 일관성 있게 배정합니다.

      **4. 표본 크기와 기간**: 기준 전환율, MDE, α=0.05, 검정력 80%로 표본 크기를 계산 → 일 트래픽으로 나눠 기간을 정합니다. **요일 효과 때문에 최소 1~2주(7일 단위)**로 잡습니다.

      **5. 실행 중 모니터링**: SRM(배정 비율 불균형) 체크, 로깅 오류 확인. **결과를 보고 중간에 멈추지 않습니다**(피킹 금지).

      **6. 분석**: 효과 크기 + 신뢰구간 + p-value, 세그먼트별 일관성 확인 (탐색적), 가드레일 확인.

      **7. 의사결정과 공유**: 출시/보류/재실험. 실패한 실험도 학습으로 문서화합니다.`,
    keyPoints: ['근거 있는 가설', 'Primary/Secondary/Guardrail 지표', '유저 단위 무작위 배정', '표본 크기 사전 계산 + 7일 단위 기간', 'SRM 체크, 피킹 금지', '효과크기+CI로 의사결정, 문서화'],
    pitfalls: [{ text: "지표를 실험 후에 고름", fix: "Primary, Guardrail 지표와 성공 기준을 실험 시작 전에 문서로 확정하세요. 사후에 고르면 p-hacking입니다." }, { text: "유의한 결과가 나오자마자 실험 종료", fix: "사전에 계산한 표본 크기와 기간(7일 단위)을 끝까지 채우세요. 중간에 결정해야 하면 순차 검정을 쓰세요." }],
    followups: [{ q: "실험 기간이 너무 길게 계산되면 어떻게 하시겠어요?", a: "실험 전 데이터로 분산을 줄이는 CUPED, 더 민감한 대리 지표(예: 구매 대신 장바구니), 기능에 노출된 유저만 분석(트리거 분석), MDE의 비즈니스적 재검토, 트래픽 배분 확대를 검토합니다." }],
  },
  {
    id: 'ab-sample-size', cat: 'ab', level: 2,
    q: 'A/B 테스트의 표본 크기는 어떻게 정하나요?',
    intent: '표본 크기를 결정하는 요인과 MDE 개념을 이해하는지 봅니다.',
    answer: `
      표본 크기는 네 가지로 결정됩니다.
      1. **기준 전환율(baseline)**: 현재 전환율 (예: 10%)
      2. **MDE(최소 탐지 효과)**: 비즈니스적으로 의미 있는 최소 개선 폭 (예: +1%p, 상대 +10%)
      3. **유의수준 α** (보통 0.05, 양측)
      4. **검정력 1-β** (보통 0.8)

      두 비율 비교에서 그룹당 표본 수는 대략
      n ≈ (z₁₋α/₂ + z₁₋β)² × [p₁(1-p₁) + p₂(1-p₂)] / (p₂ − p₁)²

      예: 10% → 11% (MDE 1%p), α=0.05, 검정력 80% → **그룹당 약 14,750명**

      **직관**: MDE를 절반으로 줄이면 필요 표본은 **약 4배**가 됩니다 (효과 크기 제곱에 반비례).

      **MDE 정하는 법**: "이 정도는 올라야 개발 비용을 회수한다"는 비즈니스 기준과, 현실적인 트래픽으로 몇 주 안에 끝낼 수 있는지 사이에서 협의합니다. 트래픽이 부족하면 분산 감소(CUPED), 더 민감한 지표 사용, 실험 기간 연장을 검토합니다.

      → **A/B 테스트 탭의 표본 크기 계산기**로 직접 계산해 보세요.`,
    keyPoints: ['기준 전환율, MDE, α, 검정력 4요소', '공식 또는 계산기 사용', 'MDE 1/2 → 표본 4배', 'MDE는 비즈니스 기준과 트래픽 현실의 협의', '트래픽 부족 시 CUPED 등'],
  },
  {
    id: 'ab-peeking', cat: 'ab', level: 2,
    q: '실험 중간에 결과를 보고 유의해지면 바로 종료하는 것은 왜 문제인가요?',
    intent: '피킹(peeking) 문제는 실무에서 가장 흔한 실험 오류입니다. 원리와 대안을 아는지 봅니다.',
    answer: `
      p-value는 **사전에 정한 표본 크기에서 딱 한 번 검정**한다는 가정으로 계산됩니다. 매일 결과를 보고 유의하면 멈추는 것은 사실상 여러 번 검정하는 것이라, **1종 오류율이 5%보다 훨씬 커집니다.** 효과가 없는 A/A 테스트에서도 14일간 매일 확인하면 거짓 양성률이 20% 이상으로 올라갈 수 있습니다.

      p-value는 실험 중에 무작위로 오르내리기 때문에, '우연히 0.05 아래로 내려간 순간'에 멈추면 거짓 승리를 선언하게 됩니다.

      **대안**
      - 표본 크기와 기간을 **사전에 정하고 끝까지 진행**합니다. 중간 모니터링은 버그나 가드레일 확인 용도로만 씁니다.
      - 중간 결정이 꼭 필요하면 **순차 검정(Sequential testing)**을 씁니다: O'Brien-Fleming 같은 alpha spending, always-valid p-value (mSPRT) 등.
      - 베이지안 방법도 대안이지만, 무분별한 조기 종료 문제가 완전히 사라지지는 않습니다.

      → **A/B 테스트 탭의 피킹 시뮬레이터**에서 직접 확인할 수 있습니다.`,
    keyPoints: ['고정 표본 1회 검정 가정 위반', '반복 확인 → 1종 오류율 증가 (A/A에서도)', '사전 표본/기간 고정', '순차 검정(alpha spending, mSPRT) 대안'],
  },
  {
    id: 'ab-srm', cat: 'ab', level: 2,
    q: 'SRM(Sample Ratio Mismatch)이 무엇이고, 발견하면 어떻게 하나요?',
    intent: '실험 결과를 믿기 전에 실험 자체의 건전성을 점검하는 습관이 있는지 봅니다. 시니어 분석가를 판별하는 질문입니다.',
    answer: `
      **SRM은 설계한 배정 비율(예: 50:50)과 실제 배정 인원 비율이 통계적으로 유의하게 다른 상태**입니다.

      **확인 방법**: 카이제곱 적합도 검정. 예를 들어 control 1,150명, treatment 947명이면 기대값 1,048.5명 대비 χ² ≈ 19.7, **p < 0.0001** → SRM입니다.

      **왜 중요한가**: SRM은 배정이나 로깅 과정에 버그가 있다는 신호이고, 그 버그가 특정 유형의 유저를 한쪽에서만 빠뜨렸을 가능성이 큽니다. 그러면 무작위화가 깨진 것이므로 **결과(전환율 차이)를 신뢰할 수 없습니다.** 결과가 좋아 보여도 그대로 해석하면 안 됩니다.

      **흔한 원인**
      - treatment에서만 발생하는 크래시나 로딩 지연으로 로깅 누락
      - 봇 필터링이 한쪽에만 다르게 적용됨
      - 배정 시점과 노출 시점의 차이 (리다이렉트 실험)
      - 실험 도중 배정 비율 변경

      **대응**: 세그먼트(플랫폼, 브라우저, 날짜)별로 SRM이 어디서 발생하는지 찾고 → 원인을 수정한 뒤 **재실험**합니다. 샘플 데이터의 \`free_shipping_banner\` 실험이 바로 이 사례입니다.`,
    keyPoints: ['설계 비율 vs 실제 비율의 유의한 차이', '카이제곱 적합도 검정', '무작위화 훼손 → 결과 신뢰 불가', '원인: 로깅 누락, 봇 필터, 리다이렉트 등', '세그먼트별 원인 탐색 후 재실험'],
    practice: 'sql-17',
  },
  {
    id: 'ab-metrics', cat: 'ab', level: 2,
    q: '실험의 1차 지표는 올랐는데 가드레일 지표가 떨어졌습니다. 어떻게 판단하시겠어요?',
    intent: '단일 숫자가 아닌 트레이드오프 관점에서 의사결정을 돕는지 봅니다.',
    answer: `
      **1. 먼저 결과가 진짜인지 확인합니다**: SRM, 로깅 이슈, 가드레일 하락의 유의성과 신뢰구간, 기간 효과(노출 효과).

      **2. 트레이드오프를 같은 단위로 환산합니다.**
      예: 전환율 +3%로 월 매출 +2억, 하지만 환불률 +0.5%p로 월 -0.6억과 CS 비용 증가. 장기적으로 신뢰도 하락에 따른 리텐션 영향도 추정합니다.

      **3. 왜 그런지 메커니즘을 파악합니다**: 공격적인 할인 문구 → 충동구매 증가 → 환불 증가처럼, 1차 지표 상승이 '질 낮은 전환'에서 왔는지 세그먼트별로 봅니다.

      **4. 선택지를 제시합니다**
      - 가드레일이 사전에 정한 허용 범위를 넘으면 **출시하지 않습니다**. 가드레일은 그러라고 정하는 것입니다.
      - 부작용을 줄인 변형안(문구 완화, 특정 세그먼트에만 적용)으로 후속 실험을 제안합니다.

      의사결정권자에게는 "출시하면 X를 얻고 Y를 잃으며, 불확실성은 이 정도"라고 정리해 전달합니다.`,
    keyPoints: ['결과 신뢰성 먼저 확인', '같은 단위(금액)로 트레이드오프 환산', '메커니즘/세그먼트 분석', '사전 정의된 가드레일 기준 준수', '대안 실험 제안 + 명확한 커뮤니케이션'],
  },
  {
    id: 'ab-not-sig', cat: 'ab', level: 2,
    q: '실험 결과가 통계적으로 유의하지 않게 나왔습니다. 어떻게 하시겠어요?',
    intent: '"효과 없음"과 "판단 불가"를 구분하고 실험에서 학습을 끌어내는지 봅니다.',
    answer: `
      **1. 유의하지 않다 ≠ 효과가 없다**: 먼저 **검정력이 충분했는지** 봅니다. 사전에 계산한 표본을 채웠는지, 관찰된 신뢰구간이 얼마나 넓은지 확인합니다.
      - CI가 [-0.2%p, +0.3%p]처럼 좁게 0 근처라면 → "의미 있는 효과는 없다"고 자신 있게 말할 수 있습니다.
      - CI가 [-2%p, +4%p]처럼 넓다면 → "판단할 수 없다(검정력 부족)"입니다.

      **2. 실험이 제대로 돌았는지 확인합니다**: 실제 노출이 되었는지(트리거 분석), SRM은 없는지, 변경 사항이 유저에게 눈에 띄었는지.

      **3. 학습을 정리합니다**: 가설이 틀렸다면 그것도 가치 있는 결과입니다. 세그먼트별 차이는 탐색적으로만 보고, 흥미로운 패턴은 **새 가설로 재실험**합니다.

      **4. 의사결정**: 효과가 없고 유지보수 비용이 비슷하다면 단순한 쪽이나 전략적으로 선호하는 쪽을 택할 수 있습니다. 이때 "통계적 근거가 아니라 다른 이유로 선택한다"고 명시합니다.

      ❌ 하지 말아야 할 것: 유의할 때까지 실험 연장, 세그먼트를 쪼개 유의한 곳 찾기(p-hacking).`,
    keyPoints: ['효과 없음 vs 검정력 부족 구분 (CI 폭)', '실험 실행 건전성 확인(노출, SRM)', '학습 문서화, 새 가설로 재실험', 'p-hacking·무한 연장 금지'],
  },
  {
    id: 'ab-network', cat: 'ab', level: 3,
    q: '중고거래나 배달처럼 양면 시장(마켓플레이스)에서는 A/B 테스트에 어떤 어려움이 있나요?',
    intent: '당근, 배민, 쿠팡이츠 같은 국내 플랫폼 면접에서 자주 나옵니다. SUTVA 위반과 간섭 효과를 아는지 봅니다.',
    answer: `
      A/B 테스트는 **한 유저의 처치가 다른 유저의 결과에 영향을 주지 않는다**(SUTVA)는 가정이 필요한데, 마켓플레이스에서는 이 가정이 깨집니다.

      **예시**: 구매자 treatment 그룹에게 할인 쿠폰을 주면 treatment가 인기 매물을 먼저 사버려서 control의 구매 기회가 줄어듭니다 → **treatment 효과가 과대 추정**됩니다 (공급이 한정된 자원을 두고 경쟁).

      **해결 방법**
      - **클러스터 무작위화**: 지역(동네)이나 도시 단위로 배정해 그룹 간 상호작용을 줄입니다 (당근의 동네 단위). 단, 클러스터 수가 적으면 검정력이 떨어집니다.
      - **스위치백(Switchback) 실험**: 시간대를 번갈아 가며 전체를 treatment/control로 전환합니다 (배달, 모빌리티의 배차 알고리즘).
      - **양면 무작위화**: 구매자와 판매자 쪽을 모두 고려해 설계합니다.
      - 소규모 실험 결과는 전면 출시 시 효과가 다를 수 있으므로, 출시 후 홀드아웃 그룹으로 장기 효과를 검증합니다.

      SNS처럼 네트워크 효과가 있는 서비스(친구 초대, 메시징)도 같은 문제가 있으며, 그래프 클러스터 기반 배정을 사용합니다.`,
    keyPoints: ['SUTVA(간섭 없음) 가정 위반', '공유 자원 경쟁 → 효과 과대추정 예시', '클러스터(지역) 무작위화', '스위치백 실험', '홀드아웃으로 장기 효과 검증'],
  },
  {
    id: 'ab-causal', cat: 'ab', level: 3,
    q: 'A/B 테스트를 할 수 없는 상황에서 정책(예: 쿠폰 지급)의 효과를 어떻게 측정하시겠어요?',
    intent: '관측 데이터로 인과를 추정하는 준실험(quasi-experiment) 방법론을 아는지 봅니다.',
    answer: `
      **왜 단순 비교가 안 되는가**: 쿠폰을 받은 유저와 받지 않은 유저는 원래 다릅니다 (선택 편향). 단순 비교하면 쿠폰 효과와 유저 특성 차이가 섞입니다.

      **방법**
      1. **이중차분(DiD)**: 정책 대상 그룹과 비대상 그룹의 '전후 변화량'을 비교합니다. 핵심 가정은 정책이 없었다면 두 그룹이 **같은 추세(평행 추세)**를 보였을 것이라는 점입니다 → 정책 전 기간의 추세를 그려 검증합니다.
      2. **성향점수 매칭(PSM)**: 쿠폰을 받을 확률(성향점수)이 비슷한 유저끼리 짝지어 비교합니다. 단, 관측된 변수만 통제할 수 있다는 한계가 있습니다.
      3. **회귀 불연속(RDD)**: "구매액 5만원 이상이면 쿠폰 지급"처럼 기준점이 있으면, 기준점 바로 위아래 유저를 비교합니다.
      4. **합성 통제(Synthetic Control)**: 특정 지역에만 정책을 시행했다면, 다른 지역들을 가중 조합해 '가상의 대조군'을 만듭니다.
      5. **인과 영향 분석(CausalImpact) / 시계열 예측**: 정책이 없었을 경우의 시계열을 예측해 실제와 비교합니다.

      실무에서는 **가능하면 작은 홀드아웃 그룹(예: 5%는 쿠폰 미지급)을 남겨두자고 제안**하는 것이 가장 강력한 답입니다.`,
    keyPoints: ['단순 비교의 선택 편향 설명', 'DiD + 평행 추세 가정', 'PSM (관측 변수 한계)', 'RDD, 합성통제', '홀드아웃 그룹 제안'],
  },
  {
    id: 'ab-duration', cat: 'ab', level: 1,
    q: '실험 기간은 어떻게 정하나요? 일주일보다 짧게 해도 되나요?',
    intent: '통계적 표본 크기 외의 실무적 고려사항(요일 효과, 노출 효과)을 아는지 봅니다.',
    answer: `
      **기간 = 필요 표본 크기 ÷ 일일 실험 트래픽**이 출발점이고, 여기에 실무 조건을 더합니다.

      - **최소 1주, 7일 단위로**: 요일마다 유저 구성과 행동이 다릅니다 (주말 쇼핑 증가 등). 3일만 돌리면 특정 요일의 효과가 과대 반영됩니다.
      - **노출 효과(Novelty) / 학습 효과(Primacy)**: 새 UI는 초기에 호기심으로 클릭이 늘었다가 줄어들거나, 반대로 익숙해지는 데 시간이 걸립니다 → 일별 효과 추이를 보고 안정화되는지 확인합니다.
      - **비즈니스 주기**: 급여일, 월초/월말, 프로모션 기간, 명절은 피하거나 고려합니다.
      - **너무 길어도 문제**: 쿠키 삭제나 기기 변경으로 배정이 오염되고, 기회비용이 생깁니다. 보통 2~4주 이내를 권장합니다.

      표본을 이미 채웠더라도 1주를 채우지 못했다면 기간을 늘리는 것이 안전합니다.`,
    keyPoints: ['표본크기 ÷ 일 트래픽', '최소 1주, 7일 단위(요일 효과)', '노출/학습 효과 추이 확인', '비즈니스 주기 고려', '너무 긴 실험의 오염 문제'],
  },

  // ───────────────────────── 지표·프로덕트 ─────────────────────────
  {
    id: 'mt-dau-drop', cat: 'metrics', level: 2,
    q: '어제 DAU가 전주 대비 10% 하락했습니다. 어떻게 원인을 분석하시겠어요?',
    intent: '프로덕트 분석 면접에서 가장 많이 나오는 질문입니다. 바로 가설을 던지지 않고 구조적으로 쪼개 나가는지 봅니다.',
    answer: `
      **1. 문제 명확화 (질문으로 시작)**
      - DAU 정의는? (앱 실행 기준인지, 로그인 기준인지)
      - 갑작스러운 하락인가, 점진적 하락인가? 하루만 그런가, 계속되는가?
      - 비교 기준은 적절한가? (전주 같은 요일 대비인지, 공휴일 여부)

      **2. 데이터 이상부터 배제**: 로깅 파이프라인 장애, 집계 쿼리 변경, 트래킹 SDK 업데이트. 다른 지표(주문, 결제 서버 로그)도 같이 떨어졌는지 교차 확인합니다.

      **3. 지표 분해**: DAU = 신규 유저 + 기존 유저(리텐션) + 복귀 유저. 어느 쪽이 줄었는지 봅니다.

      **4. 세그먼트로 쪼개기** (하락이 특정 집단에 몰려 있는지)
      - 플랫폼(iOS/Android/Web), **앱 버전**, 국가/지역, 유입 채널, 신규/기존

      **5. 내부 요인 vs 외부 요인**
      - 내부: 앱 배포, 기능 변경, 마케팅 캠페인 종료, 푸시 발송 중단, 서버 장애
      - 외부: 공휴일, 경쟁사 이벤트, 앱스토어 정책, 계절성, 뉴스

      **6. 가설 검증 → 영향 추정 → 액션**
      예: "Android 5.2.0 배포 이후 Android DAU만 약 50% 감소 → 크래시 로그 확인 → 핫픽스 롤아웃 → 복구 모니터링"

      → **케이스 트레이닝 탭**에 이 문제를 단계별로 풀어보고, 실제 샘플 데이터(events 테이블)로 원인을 찾는 실습이 있습니다.`,
    keyPoints: ['정의·기간·비교기준 명확화 질문', '데이터/로깅 이상 먼저 배제', '지표 분해(신규/기존/복귀)', '세그먼트 분해(플랫폼, 앱버전, 지역, 채널)', '내부 vs 외부 요인', '가설 검증 → 액션까지'],
    pitfalls: [{ text: "바로 \"경쟁사 때문일 것\"이라고 가설부터 던짐", fix: "정의·기간을 확인하는 질문 → 데이터 오류 배제 → 지표·세그먼트 분해 → 가설 순서로 구조를 먼저 보여주세요." }, { text: "데이터 오류 가능성을 고려하지 않음", fix: "로깅·파이프라인 변경 여부를 확인하고 다른 소스(주문 DB, 서버 로그)와 교차 검증하는 단계를 맨 앞에 두세요." }],
    practice: 'sql-16',
  },
  {
    id: 'mt-new-feature', cat: 'metrics', level: 2,
    q: '새로운 기능(예: 장바구니 상품 추천)의 성공을 어떻게 측정하시겠어요?',
    intent: '기능 목표를 지표로 번역하는 능력, 지표 간 계층과 부작용을 고려하는지 봅니다.',
    answer: `
      **1. 기능의 목적을 먼저 정의합니다**: 장바구니 추천은 '함께 살 만한 상품을 제안해 객단가를 높이는 것'이 목적입니다.

      **2. 지표를 계층으로 설계합니다**
      - **채택(Adoption)**: 추천 영역 노출 대비 클릭률(CTR), 추천 상품 장바구니 추가율
      - **핵심 성과(Primary)**: 주문당 평균 상품 수, **객단가(AOV)**
      - **비즈니스 결과**: 유저당 매출, 장기 재구매율
      - **가드레일**: 결제 전환율(추천이 방해가 되어 이탈하지 않는지), 페이지 로딩 속도, 반품률

      **3. 인과적 측정**: 추천을 클릭한 유저와 안 한 유저를 비교하면 자기 선택 편향이 생깁니다 → **A/B 테스트**로 추천 노출 그룹과 미노출 그룹을 비교합니다.

      **4. 성공 기준을 사전에 정합니다**: "AOV +3% 이상, 결제 전환율 -0.5%p 이내"

      **5. 장기 관점**: 노출 효과가 사라진 뒤에도 유지되는지 4주 이상 관찰하고, 출시 후 홀드아웃 그룹을 남겨 장기 효과를 확인합니다.`,
    keyPoints: ['기능 목적 정의', '채택→핵심→비즈니스 지표 계층', '가드레일 지표', '클릭 vs 미클릭 비교의 편향 → A/B', '사전 성공 기준, 장기 효과'],
  },
  {
    id: 'mt-north-star', cat: 'metrics', level: 1,
    q: 'North Star Metric이란 무엇이고, 좋은 지표의 조건은 무엇인가요?',
    intent: '지표 설계 철학과 비즈니스 이해를 봅니다.',
    answer: `
      **North Star Metric**은 고객이 얻는 핵심 가치를 가장 잘 반영하고, 장기적인 비즈니스 성과로 이어지는 **단 하나의 핵심 지표**입니다. 팀들이 같은 방향을 보게 만듭니다.

      예시: 에어비앤비 – 예약된 숙박 일수 / 스포티파이 – 청취 시간 / 중고거래 앱 – 거래 완료 건수 / 핀테크 – 월간 송금(거래) 활성 유저

      North Star는 보통 **입력 지표(Input metrics)**로 분해해 각 팀이 움직일 수 있게 합니다.
      예: 주간 거래 완료 수 = 활성 구매자 수 × 구매자당 문의 수 × 문의→거래 전환율

      **좋은 지표의 조건**
      - **고객 가치를 반영**: 매출 같은 결과 지표만 보면 단기적으로 무리하게 됩니다.
      - **실행 가능(Actionable)**: 팀이 행동으로 움직일 수 있어야 합니다.
      - **이해하기 쉽고, 정의가 명확**합니다.
      - **민감도**: 변화를 적절한 시간 안에 감지할 수 있어야 합니다.
      - **조작하기 어려움**: 허영 지표(누적 가입자 수, 페이지뷰)는 피합니다.
      - 비율 지표는 분자와 분모를 함께 봅니다.`,
    keyPoints: ['고객 가치 + 장기 성과를 반영하는 단일 지표', '서비스별 예시', 'Input metric으로 분해', '좋은 지표: 실행가능, 명확, 민감, 허영지표 아님'],
  },
  {
    id: 'mt-retention-def', cat: 'metrics', level: 2,
    q: '리텐션은 어떻게 정의하나요? 서비스마다 다르게 정의해야 하는 이유는?',
    intent: '리텐션 지표의 종류와 서비스 특성에 맞는 정의를 내리는 능력을 봅니다.',
    answer: `
      **리텐션 종류**
      - **N-day (classic) 리텐션**: 가입 후 정확히 N일차에 활동한 비율 (D1, D7, D30). 일 단위 사용 서비스(SNS, 게임)에 적합합니다.
      - **Unbounded (rolling) 리텐션**: N일차 **이후** 한 번이라도 활동한 비율. 사용 주기가 불규칙한 서비스에 적합하며 이탈 정의와 연결됩니다.
      - **Bracket(범위) 리텐션**: 특정 기간(예: 7~13일차, 주 단위) 내 활동 여부. 주 1회 사용 서비스에 적합합니다.

      **서비스마다 다른 이유: '자연스러운 사용 주기'가 다르기 때문**
      - 메신저: 매일 → D1/D7
      - 이커머스: 월 1~2회 → 월간 구매 리텐션
      - 여행/부동산: 연 1~2회 → 리텐션보다 재방문 의도나 NPS가 더 적합
      - 핀테크 송금: 월 단위 거래 리텐션

      **'활동'의 정의도 중요합니다**: 앱 실행만으로는 약하고, **핵심 가치 행동**(구매, 송금, 게시)을 기준으로 정의해야 의미가 있습니다.

      시각화는 **코호트 테이블(삼각형 히트맵)**과 리텐션 곡선으로 하며, 곡선이 0으로 떨어지지 않고 평평해지는지(플래토)가 PMF 신호입니다.`,
    keyPoints: ['N-day / Unbounded / Bracket 리텐션', '서비스의 자연 사용 주기에 맞춤', '활동 = 핵심 가치 행동', '코호트 테이블, 리텐션 곡선 플래토'],
    practice: 'pd-08',
  },
  {
    id: 'mt-ltv-cac', cat: 'metrics', level: 2,
    q: 'LTV와 CAC는 무엇이고, 마케팅 채널 효율을 어떻게 평가하나요?',
    intent: '마케팅과 그로스 분석의 기본 단위경제학을 이해하는지 봅니다.',
    answer: `
      - **CAC(고객 획득 비용)** = 채널 마케팅 비용 ÷ 해당 채널로 획득한 신규 고객 수
      - **LTV(고객 생애 가치)** ≈ 고객당 월평균 매출(공헌이익 기준) × 평균 유지 기간
        (구독형 단순 공식: ARPU × 마진 ÷ 월 이탈률)
      - **LTV/CAC > 3**이면 건강하다고 보는 경험칙이 있고, **CAC 회수 기간(Payback period)**도 함께 봅니다.

      **채널 평가 시 주의점**
      - **첫 구매가 아니라 코호트 LTV로 비교합니다.** 샘플 데이터에서도 paid_search 유입 유저는 가입 7일 내 구매율은 organic과 비슷하지만(약 15% vs 14%) 28일 리텐션이 약 37%로 organic(약 84%)의 절반에도 못 미칩니다 → 단기 ROAS로는 좋아 보여도 LTV는 낮을 수 있습니다.
      - **기여(Attribution) 모델**: 라스트 클릭은 검색 광고를 과대평가합니다. 멀티터치, MMM(마케팅 믹스 모델링)을 검토합니다.
      - **증분성(Incrementality)**: 광고가 없어도 왔을 유저인지 확인합니다 → 지역 기반 홀드아웃이나 Geo 실험으로 측정합니다.`,
    keyPoints: ['CAC, LTV 정의와 계산', 'LTV/CAC, 회수기간', '채널별 코호트 LTV 비교 (단기 전환 함정)', '기여모델 한계, 증분성 실험'],
    practice: 'sql-13',
  },
  {
    id: 'mt-dashboard', cat: 'metrics', level: 1,
    q: '경영진용 대시보드를 설계한다면 어떻게 하시겠어요?',
    intent: '대시보드는 DA의 대표 산출물입니다. 사용자 중심 설계와 지표 거버넌스 감각을 봅니다.',
    answer: `
      **1. 사용자와 의사결정부터**: 누가(경영진), 언제(주간 회의), 어떤 결정을 위해(예산 배분, 우선순위) 보는지 인터뷰합니다. "이 숫자가 바뀌면 무엇을 하실 건가요?"

      **2. 구조: 위에서 아래로, 요약에서 상세로**
      - 최상단: North Star + 핵심 KPI 3~5개 (목표 대비, 전주/전년 대비)
      - 중간: KPI 분해 (채널, 플랫폼, 카테고리)
      - 하단: 드릴다운용 상세 테이블

      **3. 원칙**
      - 숫자에는 항상 **비교 기준**(목표, 전기 대비)을 함께 보여줍니다.
      - 적합한 차트를 고릅니다: 추세는 라인, 구성비는 막대(파이는 지양), 이중축은 피합니다.
      - **지표 정의를 명시**하고 단일 출처(semantic layer, 공인 테이블)를 사용합니다. 같은 지표가 팀마다 다르면 신뢰를 잃습니다.
      - 데이터 갱신 시각과 품질 상태를 표시합니다.

      **4. 운영**: 사용 로그로 실제 조회 여부를 확인하고, 안 보는 차트는 정리합니다. 이상 탐지 알림(Databricks SQL Alerts 등)을 붙이면 '보러 와야 하는' 대시보드에서 '알려주는' 대시보드가 됩니다.`,
    keyPoints: ['사용자·의사결정 중심 요구사항', '요약→분해→상세 구조', '비교 기준, 적합한 차트', '지표 정의/단일 출처', '사용 모니터링, 알림'],
  },
  {
    id: 'mt-funnel-drop', cat: 'metrics', level: 2,
    q: '이커머스 결제 전환율이 지난달보다 떨어졌습니다. 어떤 순서로 분석하시겠어요?',
    intent: '퍼널 관점과 믹스(구성비) 효과를 고려하는지 봅니다.',
    answer: `
      1. **정의와 측정 확인**: 전환율 = 결제 완료 / 무엇? (방문, 세션, 장바구니) 분모 정의가 바뀌었거나 트래킹 오류는 없는지 봅니다.
      2. **분자와 분모를 나눠 봅니다**: 결제 수가 줄었는가, 방문이 늘었는가? 대형 광고 캠페인으로 **저의도 트래픽이 유입**되면 결제 수가 그대로여도 전환율은 떨어집니다.
      3. **퍼널 단계별 분해**: 방문→조회→장바구니→결제시작→결제완료 중 어느 단계가 떨어졌는지 봅니다. 결제시작→완료가 떨어졌다면 PG사 오류나 결제수단 이슈를 의심합니다.
      4. **믹스 효과 vs 비율 효과**: 세그먼트별 전환율은 그대로인데 **저전환 세그먼트(웹, 신규, 특정 채널)의 비중이 늘어서** 전체가 떨어진 것인지 분해합니다. 심슨의 역설과 같은 맥락입니다.
      5. **외부 요인**: 시즌성, 경쟁사 프로모션, 가격 변경, 품절.
      6. **결론과 액션**: 원인별 영향 크기를 추정해 우선순위를 정하고 제안합니다.`,
    keyPoints: ['정의·트래킹 확인', '분자/분모 분리', '퍼널 단계 분해', '믹스 효과 vs 세그먼트 내 비율 변화', '외부 요인, 영향 추정 후 액션'],
    practice: 'sql-12',
  },

  // ───────────────────────── Spark / Databricks ─────────────────────────
  {
    id: 'db-spark-pandas', cat: 'databricks', level: 1,
    q: 'pandas와 Spark(PySpark)의 차이는 무엇이고, 언제 무엇을 쓰시나요?',
    intent: 'Databricks를 쓰는 회사라면 거의 반드시 나옵니다. 분산 처리와 지연 평가를 이해하는지 봅니다.',
    answer: `
      | | pandas | Spark |
      |---|---|---|
      | 처리 | 단일 머신 메모리 | 클러스터 분산 처리 |
      | 실행 | 즉시 실행(eager) | **지연 평가(lazy)**: action(\`count\`, \`collect\`, \`write\`)을 호출해야 실행 |
      | 데이터 크기 | 메모리 이하 (수 GB) | TB~PB |
      | 순서 | 인덱스와 행 순서가 있음 | 순서가 보장되지 않음 (명시적 orderBy 필요) |
      | API | 풍부한 분석 함수 | SQL / DataFrame API, pandas API on Spark |

      **실무 패턴**
      - 원천 데이터 정제와 집계는 **Spark SQL/PySpark**로 → 결과가 작아지면 \`toPandas()\`로 가져와 시각화와 통계 분석을 합니다.
      - \`toPandas()\`와 \`collect()\`는 **드라이버 메모리로 전부 가져오므로** 대용량에는 쓰지 않습니다.
      - pandas 문법을 유지하면서 분산 처리하려면 **pandas API on Spark**(\`import pyspark.pandas as ps\`)를 씁니다.
      - 행 단위 Python UDF는 느리므로 내장 함수를 쓰거나, 필요하면 **pandas UDF(벡터화 UDF)**를 사용합니다.`,
    keyPoints: ['단일 머신 vs 분산', 'lazy evaluation (transformation/action)', 'Spark로 집계 → toPandas로 분석', 'toPandas/collect 드라이버 메모리 주의', 'pandas API on Spark, pandas UDF'],
  },
  {
    id: 'db-delta', cat: 'databricks', level: 2,
    q: 'Delta Lake는 무엇이고, 일반 Parquet 테이블과 비교해 어떤 장점이 있나요?',
    intent: 'Databricks 레이크하우스의 핵심 저장 형식을 이해하는지 봅니다.',
    answer: `
      Delta Lake는 Parquet 데이터 파일 위에 **트랜잭션 로그(\`_delta_log\`)**를 추가한 오픈 테이블 포맷입니다.

      **장점**
      - **ACID 트랜잭션**: 동시에 읽고 써도 깨지지 않습니다. 쓰기 도중 실패해도 반쯤 쓰인 데이터가 보이지 않습니다.
      - **Time Travel**: \`SELECT * FROM t VERSION AS OF 3\` / \`TIMESTAMP AS OF '2025-10-01'\` → 과거 시점 데이터 조회, 실수 복구(\`RESTORE\`), 재현 가능한 분석
      - **MERGE INTO (Upsert)**, UPDATE, DELETE 지원 → CDC 처리, 중복 제거
      - **스키마 강제와 진화**: 잘못된 스키마 쓰기를 막고, 필요하면 \`mergeSchema\`로 컬럼을 추가합니다.
      - **성능**: 파일 통계 기반 데이터 스키핑, \`OPTIMIZE\`(작은 파일 병합), Z-ORDER / Liquid Clustering
      - \`DESCRIBE HISTORY\`로 변경 이력을 감사할 수 있습니다.

      \`VACUUM\`은 보존 기간이 지난 옛 파일을 삭제하므로, 그 이전 버전으로는 Time Travel이 불가능해진다는 점을 주의합니다.

      → 로컬 Spark 환경(local-spark 폴더)에서 Delta Lake를 직접 실습할 수 있습니다.`,
    keyPoints: ['Parquet + 트랜잭션 로그', 'ACID', 'Time Travel / RESTORE', 'MERGE/UPDATE/DELETE', '스키마 강제·진화', 'OPTIMIZE, Z-ORDER, VACUUM 주의'],
  },
  {
    id: 'db-medallion', cat: 'databricks', level: 2,
    q: '메달리온 아키텍처(Bronze/Silver/Gold)를 설명하고, 분석가는 주로 어느 계층을 다루나요?',
    intent: '데이터 파이프라인 전체 흐름을 이해하는 분석가인지 봅니다. 2026년 공고에서 ETL/파이프라인 역량 요구가 크게 늘었습니다.',
    answer: `
      - **Bronze (Raw)**: 원천 데이터를 거의 그대로 적재 (로그, CDC). 재처리를 위한 원본 보관 역할입니다.
      - **Silver (Cleansed)**: 정제, 중복 제거, 타입 변환, 조인으로 **신뢰할 수 있는 엔티티 테이블** (users, orders, events)을 만듭니다.
      - **Gold (Business)**: 비즈니스 목적별 집계와 마트 (일별 KPI, 코호트 리텐션, 대시보드용 테이블)

      **분석가의 역할**
      - 주로 **Silver를 조회하고 Gold를 만드는** 역할입니다. 최근에는 dbt나 Lakeflow Jobs(구 Workflows)·Lakeflow Spark Declarative Pipelines(구 DLT)로 Gold 테이블을 직접 만들고 운영하는 분석가(Analytics Engineer 성향)를 선호합니다.
      - 같은 지표를 매번 다르게 계산하지 않도록 Gold 계층에 **지표 정의를 코드로 고정**하고 문서화합니다.
      - Unity Catalog의 \`catalog.schema.table\` 3단계 네임스페이스와 권한(GRANT), 리니지 기능으로 데이터의 출처와 영향 범위를 추적합니다.`,
    keyPoints: ['Bronze = 원본, Silver = 정제 엔티티, Gold = 비즈니스 집계', '분석가는 Silver 조회 + Gold 생성/운영', '지표 정의의 코드화', 'Unity Catalog 3단계 네임스페이스, 리니지'],
  },

  // ───────────────────────── ML 기초 ─────────────────────────
  {
    id: 'ml-overfit', cat: 'ml', level: 1,
    q: '과적합(Overfitting)이란 무엇이고 어떻게 방지하나요?',
    intent: 'DA에게도 기본적인 모델링 개념을 기대합니다.',
    answer: `
      **과적합은 학습 데이터의 노이즈까지 외워서, 학습 성능은 좋지만 새로운 데이터에서는 성능이 떨어지는 상태**입니다. 학습 오차와 검증 오차의 차이가 크게 벌어지는 것으로 확인합니다.

      **방지 방법**
      - **데이터 분할과 교차검증**: train/validation/test 분리, k-fold CV. 시계열은 시간 순서대로 분할합니다 (미래 데이터 누수 방지).
      - **모델 복잡도 제어**: 정규화(L1 Lasso, L2 Ridge), 트리 깊이 제한, 조기 종료
      - **더 많은 데이터**, 피처 수 줄이기(피처 선택)
      - **앙상블**: 랜덤 포레스트(배깅)는 분산을 줄입니다.
      - **데이터 누수(Leakage) 점검**: 예측 시점에는 알 수 없는 정보(미래 정보, 타깃에서 파생된 변수)가 피처에 섞이면 검증 성능이 비현실적으로 높게 나옵니다. 실무에서 가장 흔한 함정입니다.

      편향-분산 트레이드오프: 너무 단순하면 과소적합(높은 편향), 너무 복잡하면 과적합(높은 분산)입니다.`,
    keyPoints: ['학습↑ 검증↓ 상태 정의', '교차검증, 시계열 분할', '정규화, 복잡도 제어, 조기종료', '데이터 누수 점검', '편향-분산 트레이드오프'],
  },
  {
    id: 'ml-metrics', cat: 'ml', level: 2,
    q: '분류 모델 평가 지표(Accuracy, Precision, Recall, F1, AUC)를 설명하고, 불균형 데이터에서는 무엇을 보나요?',
    intent: '모델 지표를 비즈니스 비용과 연결해 선택하는지 봅니다.',
    answer: `
      - **Accuracy**: 전체 중 맞춘 비율. 이탈률이 5%면 '전부 잔존'으로 예측해도 95%가 나오므로 **불균형 데이터에서는 무의미**합니다.
      - **Precision(정밀도)** = TP / (TP + FP): 양성이라고 예측한 것 중 실제 양성 비율 → **오탐 비용이 클 때** (정상 거래를 사기로 차단)
      - **Recall(재현율)** = TP / (TP + FN): 실제 양성 중 잡아낸 비율 → **놓치는 비용이 클 때** (사기, 질병)
      - **F1**: 정밀도와 재현율의 조화평균
      - **ROC-AUC**: 무작위로 고른 양성 샘플의 점수가 무작위로 고른 음성 샘플보다 높을 확률(임계값과 무관). 불균형이 심하면 **PR-AUC**가 더 정보력이 있습니다.

      **실무 포인트**: 임계값(threshold)은 비즈니스 비용으로 정합니다. 예: 이탈 방지 쿠폰 비용 5천 원, 이탈 고객 LTV 10만 원 → 기대 이익이 최대가 되는 임계값을 선택하고, **상위 N% 타깃 시 Lift**로 커뮤니케이션하면 현업이 이해하기 쉽습니다.`,
    keyPoints: ['불균형에서 Accuracy 함정', 'Precision = 오탐 비용, Recall = 미탐 비용', 'F1, ROC-AUC vs PR-AUC', '임계값은 비즈니스 비용 기준, Lift로 소통'],
  },
  {
    id: 'ml-churn', cat: 'ml', level: 2,
    q: '고객 이탈 예측 모델을 만든다면 어떻게 진행하시겠어요?',
    intent: '모델링 전체 과정, 특히 문제 정의와 활용 방안까지 생각하는지 봅니다. DA에게는 모델 정확도보다 비즈니스 활용이 더 중요합니다.',
    answer: `
      1. **문제 정의**: '이탈'의 정의 (예: 30일간 구매 없음), 예측 시점과 예측 기간, **모델을 어떻게 쓸 것인가** (이탈 위험 고객에게 쿠폰 발송 → 쿠폰 예산이 한정됨 → 상위 N명 선정 문제)
      2. **데이터와 피처**: 예측 시점 이전 데이터만 사용합니다 (누수 방지). RFM(최근성, 빈도, 금액), 활동 추세(최근 4주 vs 이전 4주), 고객센터 문의, 유입 채널, 쿠폰 반응 이력 등.
      3. **모델**: 해석 가능한 로지스틱 회귀를 기준선으로 두고, 그래디언트 부스팅(LightGBM/XGBoost)과 비교합니다. 시간 기반으로 검증 세트를 분리합니다.
      4. **평가**: PR-AUC, 상위 10% Lift, 보정(calibration)
      5. **해석**: SHAP 등으로 주요 이탈 요인을 찾고 → 제품 개선 인사이트로 연결합니다.
      6. **효과 검증 (가장 중요)**: 모델이 잘 맞히는 것과 **개입이 효과가 있는 것은 다릅니다.** 위험군을 무작위로 쿠폰 지급군과 미지급군으로 나눠 실제 이탈 감소 효과를 측정합니다. 더 나아가 '쿠폰을 주면 마음을 바꿀 사람'을 찾는 **업리프트 모델링**을 고려합니다.`,
    keyPoints: ['이탈 정의, 예측 시점, 활용 방식 정의', '누수 없는 피처(RFM, 추세)', '기준선 모델 → 부스팅, 시간 기반 검증', 'PR-AUC, Lift', '개입 효과는 A/B로 검증, 업리프트 모델링'],
  },
  {
    id: 'ml-logistic', cat: 'ml', level: 2,
    q: '로지스틱 회귀의 계수는 어떻게 해석하나요?',
    intent: '가장 많이 쓰이는 해석 가능 모델을 실제로 해석할 수 있는지 봅니다.',
    answer: `
      로지스틱 회귀는 **로그 오즈(log-odds)**를 선형으로 모델링합니다: log(p / (1-p)) = β₀ + β₁x₁ + ...

      - 계수 β₁: x₁이 1단위 증가하면 **로그 오즈가 β₁만큼** 증가합니다.
      - **exp(β₁) = 오즈비(Odds Ratio)**: 예를 들어 marketing_opt_in의 계수가 0.4라면, exp(0.4) ≈ 1.49 → 마케팅 수신 동의 유저의 구매 **오즈가 약 1.49배**라는 뜻입니다 (다른 변수가 동일할 때).
      - 주의: 오즈비는 확률비가 아닙니다. 기저 확률이 작을 때만 대략 확률비와 비슷합니다.
      - 확률 변화로 설명하려면 **평균 한계효과(Average Marginal Effect)**를 계산해 "구매 확률이 평균 2.1%p 높다"처럼 전달하면 현업이 이해하기 쉽습니다.

      피처 스케일이 다르면 계수 크기를 직접 비교할 수 없으므로, 표준화 후 비교합니다.`,
    keyPoints: ['로그 오즈 선형 모델', 'exp(β) = 오즈비 해석', '오즈비 ≠ 확률비', '한계효과로 확률 변화 설명', '스케일 표준화 후 비교'],
  },

  // ───────────────────────── 행동·커뮤니케이션 ─────────────────────────
  {
    id: 'bh-intro', cat: 'behavior', level: 1,
    q: '1분 자기소개와 함께, 왜 데이터 분석가가 되고 싶은지 말씀해 주세요.',
    intent: '직무 이해도와 동기, 그리고 핵심을 압축해 전달하는 능력을 봅니다.',
    answer: `
      **구조: 핵심 정체성 1문장 → 근거 경험 2개 → 지원 동기와 기여 방향**

      예시)
      > "저는 **데이터로 질문을 정의하고 의사결정까지 연결하는 분석가**입니다.
      > 이전 프로젝트에서 SQL로 구매 퍼널을 분석해 결제 단계에서 웹 유저 이탈이 iOS보다 8%p 높다는 점을 발견했고, 원인 가설을 세워 결제 UI 개선 A/B 테스트를 제안했습니다. 그 결과 전환율이 1.2%p 개선되었습니다.
      > 또한 Databricks에서 반복되는 주간 리포트를 Gold 테이블과 대시보드로 자동화해 팀의 리포팅 시간을 주 6시간 줄였습니다.
      > 귀사의 커머스 도메인에서 실험 문화를 바탕으로 지표를 설계하고, 분석이 실제 제품 변화로 이어지게 하는 데 기여하고 싶습니다."

      **팁**
      - 툴 나열(SQL, Python, Tableau 가능)이 아니라 **툴로 만든 결과(임팩트, 숫자)**를 말합니다.
      - '왜 이 회사인가'를 서비스 지표나 실험 문화와 연결합니다 (지원 회사의 기술 블로그를 읽고 가세요).
      - 60~90초를 넘기지 않습니다.`,
    keyPoints: ['첫 문장에 핵심 정체성', '수치가 있는 경험 1~2개', '툴이 아니라 임팩트', '회사/도메인과 연결된 동기', '60~90초'],
  },
  {
    id: 'bh-impact', cat: 'behavior', level: 2,
    q: '데이터 분석으로 비즈니스에 영향을 준 경험을 말씀해 주세요.',
    intent: '가장 중요한 행동 질문입니다. STAR 구조로 본인의 기여와 결과를 수치로 말하는지 봅니다.',
    answer: `
      **STAR 구조**로 답합니다: Situation(상황) → Task(과제) → Action(나의 행동) → Result(결과, 수치) + Learning(배운 점)

      예시)
      - **S**: 신규 가입자의 첫 구매 전환율이 3개월째 하락하고 있었습니다.
      - **T**: 원인을 찾고 개선 방향을 제안하는 것이 제 과제였습니다.
      - **A**: (1) 가입 코호트별 퍼널을 SQL로 분해해, 특정 유입 채널(paid_search)의 비중이 늘면서 전체 전환율이 떨어지는 **믹스 효과**임을 확인했습니다. (2) 채널 내 전환율도 떨어진 구간이 있어 랜딩 페이지별로 쪼갰고, 특정 키워드 랜딩이 상품과 맞지 않는다는 점을 찾았습니다. (3) 마케팅팀과 함께 키워드 정비안을 만들고 A/B 테스트를 설계했습니다.
      - **R**: 해당 채널의 첫 구매 전환율이 18% 개선되었고, CAC가 월 12% 감소했습니다. 이 분석을 대시보드로 만들어 주간 모니터링 지표로 정착시켰습니다.
      - **L**: 전체 지표가 변할 때 구성비 변화부터 확인하는 습관이 생겼습니다.

      **포인트**: '우리'가 아니라 **'내가' 한 행동**을 구체적으로 말하고, 결과는 숫자로, 실패 경험이라면 배운 점을 강조합니다.`,
    keyPoints: ['STAR 구조', '나의 구체적 행동(분석 방법)', '수치화된 결과', '협업/실행까지 연결', '배운 점'],
    followups: [{ q: "그 분석에서 가장 어려웠던 점은?", a: "기술(데이터 품질, 정의 합의) 하나와 사람(이해관계자 설득) 하나 중 실제 경험을 골라 \"문제 → 내가 한 해결 → 배운 점\"으로 30초 안에 답하세요." }, { q: "다시 한다면 무엇을 다르게 하시겠어요?", a: "\"지표 정의를 더 일찍 합의하겠다\", \"가설을 사전에 문서화하겠다\"처럼 구체적인 개선 1~2개를 말하면 성찰 능력을 보여줄 수 있습니다." }],
  },
  {
    id: 'bh-explain', cat: 'behavior', level: 1,
    q: '비전문가(마케터, 경영진)에게 복잡한 분석 결과를 설명한 경험이 있나요? 어떻게 전달하시나요?',
    intent: '커뮤니케이션 역량은 면접 통과와 탈락을 가르는 가장 흔한 이유입니다.',
    answer: `
      **원칙**
      1. **결론부터 (두괄식, 피라미드 원칙)**: "결론: 쿠폰 B안을 전체 적용하면 월 매출이 약 3,000만 원 늘어날 것으로 예상합니다. 근거는 세 가지입니다."
      2. **청중의 언어로**: p-value 대신 "우연일 가능성은 1% 미만", 신뢰구간 대신 "적게는 +1,000만 원, 많게는 +5,000만 원"
      3. **'그래서 무엇을 해야 하는가'**로 끝냅니다: 제안 액션과 기대 효과, 리스크
      4. **시각화는 메시지 하나당 차트 하나**, 핵심 숫자는 강조하고 나머지는 회색 처리합니다.
      5. **한계와 가정을 정직하게**: 확신 수준을 구분합니다 ("이건 확실합니다 / 이건 추정입니다").

      **예시 답변**: "실험 결과를 마케팅팀에 공유할 때, 처음에는 통계표를 보여드렸더니 반응이 없었습니다. 이후에는 첫 장에 '결론과 추천 액션'을, 두 번째 장에 '매출 영향 범위'를 그래프 하나로 보여주는 형식으로 바꿨고, 결정이 회의 한 번에 내려지게 되었습니다."`,
    keyPoints: ['결론 먼저(두괄식)', '청중의 언어로 번역', '액션 제안으로 마무리', '메시지 중심 시각화', '한계·확신수준 정직하게'],
  },
  {
    id: 'bh-conflict', cat: 'behavior', level: 2,
    q: '분석 결과가 이해관계자의 기대와 다를 때(또는 의견 충돌이 있을 때) 어떻게 대응하셨나요?',
    intent: '데이터에 대한 정직성과 협업 능력의 균형을 봅니다.',
    answer: `
      **접근**
      1. **먼저 내 분석을 다시 검증합니다**: 데이터 오류, 정의 차이, 기간 선택이 결과를 바꾸지 않는지 확인합니다. 상대가 맞을 수도 있다는 열린 태도가 중요합니다.
      2. **상대의 근거를 듣습니다**: 현업은 데이터에 없는 맥락(경쟁사 동향, 고객 VOC)을 갖고 있는 경우가 많습니다. 정의를 다르게 이해하고 있어서 생긴 충돌도 자주 있습니다.
      3. **합의 가능한 기준을 세웁니다**: "어떤 결과가 나오면 서로 납득할 수 있을까요?"라고 묻고 검증 방법을 합의합니다 (예: 작은 규모 실험).
      4. **결과는 정직하게 공유하되, 대안을 함께 제시합니다**: "기대하신 효과는 확인되지 않았지만, 대신 이 세그먼트에서는 효과가 있어 타깃을 좁히는 방안을 제안드립니다."

      **예시**: "마케팅팀이 성공이라고 판단한 캠페인을 분석해보니 증분 효과가 거의 없었습니다. 바로 반박하기보다 지역 홀드아웃 실험을 같이 설계하자고 제안했고, 결과를 함께 확인한 뒤 예산을 다른 채널로 재배분하게 되었습니다."`,
    keyPoints: ['내 분석 재검증 (열린 태도)', '상대 맥락 경청, 정의 차이 확인', '합의 가능한 검증 방법 제안', '정직한 결과 + 대안 제시'],
  },
  {
    id: 'bh-data-quality', cat: 'behavior', level: 2,
    q: '데이터 품질 문제를 발견한 경험이 있나요? 어떻게 처리했나요?',
    intent: '분석 결과를 맹신하지 않고 데이터를 의심하는 습관, 그리고 문제를 구조적으로 해결하는지 봅니다.',
    answer: `
      **좋은 답변 구조**: 발견 계기 → 영향 범위 파악 → 단기 대응 → 근본 해결 → 재발 방지

      예시)
      - **발견**: 주간 리포트에서 Android 전환율이 갑자기 2배로 뛰어서 "너무 좋은 결과는 일단 의심한다"는 원칙으로 확인했습니다.
      - **원인**: 앱 업데이트 후 purchase 이벤트가 중복 로깅되고 있었습니다 (같은 주문에 이벤트 2개).
      - **영향 파악**: 영향받은 기간, 테이블, 이를 참조하는 대시보드와 실험을 리니지로 확인했습니다.
      - **단기 대응**: 주문 ID 기준으로 중복을 제거한 뷰를 만들고, 영향받은 리포트 이용자에게 공지했습니다.
      - **근본 해결**: 개발팀에 재현 케이스와 함께 이슈를 전달해 로깅을 수정했습니다.
      - **재발 방지**: 주문 수와 purchase 이벤트 수의 비율을 매일 체크하는 **데이터 품질 테스트(알림)**를 추가했습니다.

      **포인트**: 기술적 해결뿐 아니라 **커뮤니케이션(누구에게 알렸는지)**과 **재발 방지 장치**를 말하면 시니어처럼 보입니다.`,
    keyPoints: ['이상 징후를 의심하는 습관', '원인 규명', '영향 범위(리니지) 파악', '단기 대응 + 공지', '근본 해결 + 품질 테스트로 재발 방지'],
  },
  {
    id: 'bh-priority', cat: 'behavior', level: 1,
    q: '여러 팀에서 동시에 분석 요청이 들어오면 우선순위를 어떻게 정하나요?',
    intent: '분석가로서 업무를 주도적으로 관리하고, 요청의 본질을 파악하는지 봅니다.',
    answer: `
      1. **요청의 목적과 결정을 확인합니다**: "이 분석으로 어떤 결정을 하시나요? 언제까지 필요하신가요?" 이 질문만으로도 요청의 범위가 줄거나 더 간단한 답으로 해결되는 경우가 많습니다.
      2. **임팩트 × 긴급도 × 소요 시간**으로 평가합니다. 회사나 팀 OKR과의 연관성을 기준으로 삼습니다.
      3. **투명하게 공유합니다**: 요청 백로그를 공개하고, 우선순위가 밀리는 요청자에게 예상 일정과 이유를 미리 알립니다. 충돌이 크면 리더와 함께 조율합니다.
      4. **반복 요청은 자동화**합니다: 같은 유형이 반복되면 셀프서비스 대시보드나 공인 테이블로 만들어 요청 자체를 줄입니다.
      5. 빠른 답이 필요하면 **"80% 정확도의 1시간 답변"과 "완벽한 1주 분석"** 중 무엇이 필요한지 묻습니다.`,
    keyPoints: ['요청 목적·결정·기한 확인', '임팩트×긴급도×소요시간', '백로그 투명성, 리더와 조율', '반복 요청 자동화(셀프서비스)', '정확도 vs 속도 합의'],
  },
  {
    id: 'bh-our-service', cat: 'behavior', level: 2,
    q: '우리 서비스를 사용해 보셨나요? 분석가로서 개선하고 싶은 점과 보고 싶은 지표는?',
    intent: '회사와 서비스에 대한 관심, 그리고 프로덕트 센스를 동시에 봅니다. 거의 모든 회사에서 나옵니다.',
    answer: `
      **준비 방법**: 면접 전에 서비스를 **직접 써보고** 핵심 플로우(가입 → 첫 가치 경험 → 재방문)를 기록합니다. 기술 블로그, IR 자료, 앱 리뷰를 읽고 갑니다.

      **답변 구조**
      1. **서비스의 핵심 가치와 North Star를 내 언어로 정의**: "이 서비스의 핵심 가치는 '믿을 수 있는 동네 거래'이고, North Star는 '주간 거래 완료 건수'라고 생각합니다."
      2. **사용 중 느낀 마찰 1~2개**: "첫 거래 전 채팅 단계에서 응답이 늦으면 이탈하게 되는데, 응답 대기 시간이 길수록 거래 완료율이 떨어질 것이라는 가설을 세웠습니다."
      3. **확인하고 싶은 지표와 분석 방법**: 첫 응답 시간 구간별 거래 완료율, 판매자 응답률 코호트
      4. **개선 아이디어와 검증 방법**: 응답이 빠른 판매자 배지 → A/B 테스트로 거래 완료율과 판매자 만족도(가드레일)를 측정

      **포인트**: 비판보다는 **가설 → 지표 → 검증** 흐름을 보여주는 것이 핵심입니다.`,
    keyPoints: ['서비스 직접 사용 + 사전 조사', '핵심 가치/North Star 정의', '구체적 마찰 지점과 가설', '측정 지표와 분석 방법', '검증 방법(A/B)까지'],
  },
];
