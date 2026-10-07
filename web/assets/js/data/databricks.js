// Databricks 특화 팩: 개념, 문법 대응표, Databricks SQL 기능, 자격증(Data Analyst Associate) 연습 퀴즈

export const CONCEPTS = [
  {
    title: '레이크하우스 (Lakehouse)',
    body: `데이터 레이크(저렴한 오브젝트 스토리지, 모든 형식)와 데이터 웨어하우스(트랜잭션, 성능, 거버넌스)를 결합한 구조입니다. Databricks는 **Delta Lake + Unity Catalog + Databricks SQL Warehouse**로 이를 구현합니다. 하나의 데이터 사본으로 BI, SQL 분석, ML을 모두 처리하는 것이 핵심입니다.`,
  },
  {
    title: 'Unity Catalog',
    body: `- **3단계 네임스페이스**: \`catalog.schema.table\` (예: \`prod.sales.orders\`)
- 중앙 집중식 **권한 관리**: \`GRANT SELECT ON TABLE prod.sales.orders TO \\\`analysts\\\`\`
- **리니지**: 테이블·컬럼 단위로 데이터 흐름을 추적 → 영향 범위 분석
- Managed table(UC가 저장소까지 관리)과 External table(외부 경로) 구분
- Volume: 비정형 파일(CSV, 이미지) 저장 공간 → \`/Volumes/catalog/schema/volume/file.csv\``,
  },
  {
    title: 'Delta Lake',
    body: `- Parquet + 트랜잭션 로그 → **ACID**, 동시 읽기·쓰기
- **Time Travel**: \`VERSION AS OF\`, \`TIMESTAMP AS OF\`, \`RESTORE TABLE\`
- **DML**: \`MERGE INTO\`, \`UPDATE\`, \`DELETE\`
- 성능: \`OPTIMIZE\`(작은 파일 병합), \`ZORDER BY\` / **Liquid Clustering**(\`CLUSTER BY\`)
- \`VACUUM\`: 보존 기간(기본 7일)이 지난 파일 삭제 → 그 이전으로는 time travel 불가
- \`DESCRIBE HISTORY\`, \`DESCRIBE DETAIL\``,
  },
  {
    title: '메달리온 아키텍처',
    body: `**Bronze**(원본) → **Silver**(정제·중복 제거·조인된 엔티티) → **Gold**(비즈니스 집계·마트). 분석가는 주로 Silver를 읽고 Gold를 만듭니다. Lakeflow Declarative Pipelines(구 DLT)와 Workflows(Jobs)로 파이프라인을 운영합니다.`,
  },
  {
    title: 'SQL Warehouse',
    body: `Databricks SQL 쿼리를 실행하는 컴퓨트입니다. **Serverless**(즉시 시작, 자동 확장 — 권장) / Pro / Classic 유형이 있습니다. 클러스터 크기(T-shirt size)는 단일 쿼리 성능에, 스케일링(최소/최대 클러스터 수)은 동시성에 영향을 줍니다. 쿼리 결과 캐시와 Photon 엔진으로 빠르게 처리합니다.`,
  },
  {
    title: 'AI/BI: 대시보드와 Genie',
    body: `- **AI/BI Dashboards**: 데이터셋(SQL) → 위젯(시각화) → 필터·파라미터 → 게시 및 공유, 예약 스냅샷 이메일
- **Genie Space**: 자연어로 데이터에 질문하는 공간. 분석가가 테이블, **지침(instructions)**, **예시 SQL**, 신뢰할 수 있는 자산(trusted assets)을 큐레이션해 답변 품질을 높입니다.
- **Alerts**: 쿼리 결과가 조건을 만족하면 알림 (예: 일 매출이 전주 대비 20% 하락)
- **AI Functions**: \`ai_query()\`, \`ai_classify()\`, \`ai_summarize()\` 등 SQL에서 LLM 호출`,
  },
];

// Databricks SQL ↔ DuckDB(이 사이트) ↔ pandas ↔ PySpark 대응표
export const SYNTAX = [
  { task: '상위 N행', dbsql: 'SELECT * FROM t LIMIT 10', duck: '동일', pandas: 'df.head(10)', pyspark: 'df.limit(10) / df.show(10)' },
  { task: '컬럼 선택·별칭', dbsql: 'SELECT a, b AS bb FROM t', duck: '동일', pandas: "df[['a','b']].rename(columns={'b':'bb'})", pyspark: "df.select('a', F.col('b').alias('bb'))" },
  { task: '조건 필터', dbsql: "WHERE status = 'completed' AND amt > 0", duck: '동일', pandas: "df[(df.status=='completed') & (df.amt>0)]", pyspark: "df.filter((F.col('status')=='completed') & (F.col('amt')>0))" },
  { task: '그룹 집계', dbsql: 'SELECT k, SUM(v) FROM t GROUP BY k', duck: '동일 (GROUP BY ALL도 지원)', pandas: "df.groupby('k')['v'].sum()", pyspark: "df.groupBy('k').agg(F.sum('v'))" },
  { task: '조건부 개수', dbsql: 'COUNT_IF(x > 0) / COUNT(*) FILTER (WHERE x > 0)', duck: '동일', pandas: "(df.x > 0).sum()", pyspark: "F.count(F.when(F.col('x')>0, 1))" },
  { task: '고유 개수', dbsql: 'COUNT(DISTINCT u) / approx_count_distinct(u)', duck: 'COUNT(DISTINCT u) / approx_count_distinct(u)', pandas: "df.u.nunique()", pyspark: "F.countDistinct('u') / F.approx_count_distinct('u')" },
  { task: '조인', dbsql: 'a LEFT JOIN b ON a.k = b.k', duck: '동일 (USING, ANTI/SEMI JOIN 지원)', pandas: "a.merge(b, on='k', how='left')", pyspark: "a.join(b, 'k', 'left')" },
  { task: '안티 조인', dbsql: 'a LEFT ANTI JOIN b ON a.k = b.k', duck: 'a ANTI JOIN b ON a.k = b.k', pandas: "a[~a.k.isin(b.k)]", pyspark: "a.join(b, 'k', 'left_anti')" },
  { task: '순위', dbsql: 'ROW_NUMBER() OVER (PARTITION BY g ORDER BY v DESC)', duck: '동일', pandas: "df.groupby('g')['v'].rank(method='first', ascending=False)", pyspark: "F.row_number().over(Window.partitionBy('g').orderBy(F.desc('v')))" },
  { task: '윈도우 필터', dbsql: 'QUALIFY ROW_NUMBER() OVER (...) = 1', duck: '동일', pandas: "df.sort_values(...).drop_duplicates('g')", pyspark: "withColumn('rn', ...).filter('rn = 1')" },
  { task: '이전 행', dbsql: 'LAG(v) OVER (PARTITION BY g ORDER BY t)', duck: '동일', pandas: "df.groupby('g')['v'].shift(1)", pyspark: "F.lag('v').over(w)" },
  { task: '누적합', dbsql: 'SUM(v) OVER (ORDER BY t ROWS UNBOUNDED PRECEDING)', duck: '동일', pandas: "df['v'].cumsum()", pyspark: "F.sum('v').over(w.rowsBetween(Window.unboundedPreceding, 0))" },
  { task: '날짜 자르기', dbsql: "date_trunc('MONTH', ts)", duck: "date_trunc('month', ts)", pandas: "df.ts.dt.to_period('M').dt.to_timestamp()", pyspark: "F.date_trunc('month', 'ts')" },
  { task: '날짜 차이(일)', dbsql: 'datediff(end, start)', duck: "date_diff('day', start, end) — 이 사이트는 datediff(end, start) 호환 매크로 제공", pandas: '(df.end - df.start).dt.days', pyspark: "F.datediff('end', 'start')" },
  { task: '날짜 더하기', dbsql: 'date_add(d, 7) / d + INTERVAL 7 DAYS', duck: 'date_add(d, 7) / d + INTERVAL 7 DAY', pandas: "df.d + pd.Timedelta(days=7)", pyspark: "F.date_add('d', 7)" },
  { task: '날짜 포맷', dbsql: "date_format(ts, 'yyyy-MM')", duck: "strftime(ts, '%Y-%m') — 주요 포맷은 date_format 호환", pandas: "df.ts.dt.strftime('%Y-%m')", pyspark: "F.date_format('ts', 'yyyy-MM')" },
  { task: '문자열→날짜', dbsql: "to_date('2025-01-01')", duck: "CAST('2025-01-01' AS DATE) — to_date 호환", pandas: "pd.to_datetime(s)", pyspark: "F.to_date('s')" },
  { task: 'NULL 대체', dbsql: 'coalesce(a, 0) / nvl(a, 0) / ifnull(a, 0)', duck: 'coalesce / ifnull — nvl 호환', pandas: "df.a.fillna(0)", pyspark: "F.coalesce('a', F.lit(0)) / df.fillna(0)" },
  { task: '배열로 모으기', dbsql: 'collect_list(x) / collect_set(x)', duck: 'list(x) / list(DISTINCT x) — 호환 매크로 제공', pandas: "df.groupby('g')['x'].agg(list)", pyspark: "F.collect_list('x')" },
  { task: '배열 펼치기', dbsql: 'SELECT explode(arr) / LATERAL VIEW explode(arr)', duck: 'unnest(arr)', pandas: "df.explode('arr')", pyspark: "F.explode('arr')" },
  { task: '피벗', dbsql: "PIVOT (SUM(v) FOR c IN ('a','b'))", duck: 'PIVOT t ON c USING SUM(v)', pandas: "df.pivot_table(index=..., columns='c', values='v', aggfunc='sum')", pyspark: "df.groupBy(...).pivot('c').sum('v')" },
  { task: '백분위수', dbsql: 'percentile_approx(v, 0.5) / median(v)', duck: 'approx_quantile(v, 0.5) / median(v) — percentile_approx 호환', pandas: "df.v.quantile(0.5)", pyspark: "F.percentile_approx('v', 0.5)" },
  { task: '0 나누기 방지', dbsql: 'try_divide(a, b)', duck: 'a / NULLIF(b, 0) — try_divide 호환', pandas: "df.a / df.b.replace(0, np.nan)", pyspark: "F.try_divide('a', 'b')" },
  { task: '파일 바로 읽기', dbsql: "SELECT * FROM read_files('/Volumes/.../x.csv')", duck: "SELECT * FROM read_csv('x.csv')", pandas: "pd.read_csv('x.csv')", pyspark: "spark.read.csv(path, header=True)" },
  { task: '테이블 생성', dbsql: 'CREATE OR REPLACE TABLE t AS SELECT ...', duck: '동일', pandas: "df.to_parquet(...)", pyspark: "df.write.mode('overwrite').saveAsTable('t')" },
  { task: 'Upsert', dbsql: 'MERGE INTO t USING s ON t.id = s.id WHEN MATCHED THEN UPDATE SET * WHEN NOT MATCHED THEN INSERT *', duck: 'INSERT OR REPLACE / ON CONFLICT (MERGE는 최신 버전부터)', pandas: "pd.concat([...]).drop_duplicates('id', keep='last')", pyspark: 'DeltaTable.forName(spark, "t").merge(...)' },
];

export const DBSQL_FEATURES = `
### 분석가가 자주 쓰는 Databricks SQL 문법

\`\`\`sql
-- 1) 3단계 네임스페이스와 기본 카탈로그 설정
USE CATALOG prod;
USE SCHEMA sales;
SELECT * FROM prod.sales.orders LIMIT 10;

-- 2) 파라미터 (SQL 편집기/대시보드에서 입력 위젯 생성)
SELECT * FROM orders WHERE order_date >= :start_date AND status = :status;

-- 3) QUALIFY: 윈도우 결과로 바로 필터
SELECT * FROM orders
QUALIFY ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY order_ts DESC) = 1;

-- 4) GROUP BY ALL / 컬럼 별칭 재사용
SELECT date_trunc('MONTH', order_ts) AS month, channel, SUM(amount) AS revenue
FROM orders GROUP BY ALL;

-- 5) Time Travel
SELECT * FROM orders VERSION AS OF 12;
SELECT * FROM orders TIMESTAMP AS OF '2025-10-01';
DESCRIBE HISTORY orders;
RESTORE TABLE orders TO VERSION AS OF 12;

-- 6) MERGE (Upsert)
MERGE INTO dim_users t
USING updates s ON t.user_id = s.user_id
WHEN MATCHED THEN UPDATE SET *
WHEN NOT MATCHED THEN INSERT *;

-- 7) 파일 직접 조회 / 적재
SELECT * FROM read_files('/Volumes/prod/raw/landing/orders/', format => 'csv', header => true);
COPY INTO raw.orders FROM '/Volumes/prod/raw/landing/orders/' FILEFORMAT = CSV FORMAT_OPTIONS ('header' = 'true');

-- 8) 뷰 / Materialized View / 권한
CREATE OR REPLACE VIEW gold.daily_kpi AS SELECT ...;
CREATE MATERIALIZED VIEW gold.daily_kpi_mv AS SELECT ...;   -- 자동 증분 갱신
GRANT SELECT ON TABLE gold.daily_kpi TO \`analysts\`;

-- 9) 성능
OPTIMIZE orders ZORDER BY (user_id);
ALTER TABLE events CLUSTER BY (event_date);                 -- Liquid Clustering
ANALYZE TABLE orders COMPUTE STATISTICS FOR ALL COLUMNS;

-- 10) AI Functions
SELECT review, ai_classify(review, ARRAY('positive', 'negative', 'neutral')) AS sentiment FROM reviews;
\`\`\`

### 노트북에서 SQL과 Python 섞어 쓰기

\`\`\`python
# Python 셀
df = spark.sql("SELECT channel, COUNT(*) AS users FROM users GROUP BY channel")
display(df)                      # Databricks 표/차트 렌더링
pdf = df.toPandas()              # 작아진 결과만 pandas로

# pandas → Spark 테이블
spark.createDataFrame(pdf).write.mode("overwrite").saveAsTable("sandbox.my_result")

# 위젯 (노트북 파라미터)
dbutils.widgets.text("start_date", "2025-01-01")
start = dbutils.widgets.get("start_date")
\`\`\`

\`\`\`sql
%sql
-- SQL 셀: 직전 결과는 _sqldf 로 Python에서 참조 가능
SELECT * FROM users WHERE signup_date >= '2025-10-01'
\`\`\`
`;

export const EXAM = {
  name: 'Databricks Certified Data Analyst Associate',
  meta: '45문항 객관식 · 90분 · 2025년 10월 개정 블루프린트 (2026년 응시 기준)',
  domains: [
    { name: 'Databricks SQL과 SQL Warehouse로 쿼리 실행', weight: 20 },
    { name: '대시보드와 시각화 만들기', weight: 16 },
    { name: '쿼리 분석 (Query Profile, 성능)', weight: 15 },
    { name: 'AI/BI Genie Space 개발·공유·관리', weight: 12 },
    { name: 'Databricks Data Intelligence Platform 이해', weight: 11 },
    { name: '데이터 관리 (Delta, Unity Catalog 객체)', weight: 8 },
    { name: '데이터 보안 (권한, 마스킹)', weight: 8 },
    { name: '데이터 가져오기 (업로드, read_files, COPY INTO)', weight: 5 },
    { name: 'Databricks SQL 데이터 모델링', weight: 5 },
  ],
  tips: [
    '공식 Exam Guide와 Databricks Academy의 무료 "Data Analysis with Databricks" 과정을 기준으로 공부하세요.',
    '시험은 SQL 문법보다 플랫폼 기능(Warehouse 유형, 대시보드, Genie, Unity Catalog 권한)을 많이 묻습니다.',
    '무료 체험 또는 Databricks Free Edition에서 직접 대시보드, Genie Space, Alert를 만들어 보면 빠르게 익힐 수 있습니다.',
    '아래 연습 문항은 이해도 점검용으로 직접 작성한 문제이며, 실제 시험 문제가 아닙니다.',
  ],
};

export const QUIZ = [
  {
    q: 'Unity Catalog에서 테이블을 완전하게 지정하는 이름 형식은?',
    options: ['database.table', 'catalog.schema.table', 'workspace.catalog.table', 'metastore.database.schema.table'],
    answer: 1,
    explain: 'Unity Catalog는 catalog.schema.table의 3단계 네임스페이스를 사용합니다.',
  },
  {
    q: '분석가 그룹에게 특정 테이블의 읽기 권한만 부여하는 올바른 문장은?',
    options: ['GRANT READ ON prod.sales.orders TO analysts', 'GRANT SELECT ON TABLE prod.sales.orders TO `analysts`', 'ALLOW SELECT prod.sales.orders FOR analysts', 'GRANT USAGE ON TABLE prod.sales.orders TO `analysts`'],
    answer: 1,
    explain: '테이블 읽기는 SELECT 권한입니다. 실제로 조회하려면 상위 catalog와 schema에 대한 USE CATALOG / USE SCHEMA 권한도 필요합니다.',
  },
  {
    q: '실수로 DELETE를 실행한 Delta 테이블을 이전 버전으로 되돌리는 명령은?',
    options: ['ROLLBACK TABLE orders', 'RESTORE TABLE orders TO VERSION AS OF 5', 'UNDO DELETE orders', 'VACUUM orders RETAIN 5 VERSIONS'],
    answer: 1,
    explain: 'Delta Lake의 RESTORE로 특정 버전이나 시점으로 테이블을 되돌릴 수 있습니다. VACUUM은 옛 파일을 삭제하는 명령이라 오히려 복구를 불가능하게 만듭니다.',
  },
  {
    q: 'VACUUM 명령의 주의점으로 옳은 것은?',
    options: ['테이블 스키마를 초기화한다', '보존 기간 이전 버전으로의 Time Travel이 불가능해진다', '모든 데이터를 삭제한다', '쿼리 캐시를 비운다'],
    answer: 1,
    explain: 'VACUUM은 더 이상 참조되지 않는 오래된 데이터 파일을 삭제합니다. 기본 보존 기간은 7일입니다.',
  },
  {
    q: '시작 시간이 거의 없고 사용량에 따라 자동 확장되어, 일반적으로 권장되는 SQL Warehouse 유형은?',
    options: ['Classic', 'Pro', 'Serverless', 'All-purpose cluster'],
    answer: 2,
    explain: 'Serverless SQL Warehouse는 Databricks가 컴퓨트를 관리하며 빠르게 시작되고 자동으로 확장됩니다.',
  },
  {
    q: '동시에 많은 사용자가 쿼리를 실행해 대기(queueing)가 발생할 때 가장 적절한 조치는?',
    options: ['클러스터 크기(T-shirt size)를 키운다', '최대 클러스터 수(스케일링 상한)를 늘린다', '쿼리에 LIMIT을 추가한다', 'Auto stop 시간을 줄인다'],
    answer: 1,
    explain: '클러스터 크기는 단일 쿼리의 처리 성능, 스케일링(클러스터 수)은 동시성 처리에 영향을 줍니다.',
  },
  {
    q: '그룹별 최신 1건을 서브쿼리 없이 뽑을 수 있는 Databricks SQL 절은?',
    options: ['HAVING', 'QUALIFY', 'FILTER', 'LATERAL'],
    answer: 1,
    explain: 'QUALIFY는 윈도우 함수 결과로 행을 필터링합니다: QUALIFY ROW_NUMBER() OVER (...) = 1',
  },
  {
    q: '대시보드 사용자가 날짜 범위를 직접 바꿔 쿼리 결과를 다르게 보게 하려면 SQL에서 무엇을 사용하나요?',
    options: ['임시 뷰', '파라미터 (:param 형식)', 'Time Travel', 'Materialized View'],
    answer: 1,
    explain: 'Databricks SQL은 :parameter_name 형식의 named parameter를 지원하며, 대시보드에서 필터/입력 위젯과 연결됩니다.',
  },
  {
    q: '어떤 쿼리가 느린 원인을 단계별(스캔, 조인, 셔플)로 확인하려면 무엇을 봐야 하나요?',
    options: ['Query Profile', 'DESCRIBE HISTORY', 'Catalog Explorer의 권한 탭', 'Alert 설정'],
    answer: 0,
    explain: 'Query History에서 쿼리를 선택하고 Query Profile을 열면 연산자별 시간, 읽은 행·바이트, 스필 여부 등을 확인할 수 있습니다.',
  },
  {
    q: '자주 필터링하는 컬럼에 대해 데이터 스키핑 효율을 높이는 최신 Delta 기능은?',
    options: ['Liquid Clustering', 'VACUUM', 'CLONE', 'Change Data Feed'],
    answer: 0,
    explain: 'Liquid Clustering(CLUSTER BY)은 Z-ORDER와 파티셔닝을 대체하는 유연한 데이터 레이아웃 최적화 기능입니다.',
  },
  {
    q: 'Genie Space의 답변 정확도를 높이는 방법으로 가장 적절한 것은?',
    options: ['가능한 많은 테이블을 무작위로 추가한다', '테이블 설명, 지침(instructions), 예시 SQL 쿼리를 큐레이션한다', 'Warehouse를 Classic으로 바꾼다', '대시보드를 삭제한다'],
    answer: 1,
    explain: 'Genie는 분석가가 제공한 메타데이터(테이블/컬럼 설명), 일반 지침, 예시 SQL과 신뢰 자산을 활용해 더 정확한 SQL을 생성합니다. 범위를 좁게 유지하는 것도 중요합니다.',
  },
  {
    q: '쿼리 결과가 특정 조건(예: 일 매출 20% 이상 하락)을 만족하면 이메일·Slack으로 알려주는 기능은?',
    options: ['Alerts', 'Repos', 'Delta Sharing', 'Volumes'],
    answer: 0,
    explain: 'Databricks SQL Alerts는 예약 실행된 쿼리 결과의 값을 임계값과 비교해 알림을 보냅니다.',
  },
  {
    q: 'Unity Catalog에서 CSV 같은 비정형/반정형 파일을 저장하고 경로로 접근하는 객체는?',
    options: ['View', 'Volume', 'Function', 'Share'],
    answer: 1,
    explain: 'Volume은 /Volumes/<catalog>/<schema>/<volume>/ 경로로 파일을 관리하는 Unity Catalog 객체입니다.',
  },
  {
    q: '폴더에 새로 도착한 CSV 파일만 중복 없이 테이블에 적재(멱등)하는 SQL 명령은?',
    options: ['INSERT OVERWRITE', 'COPY INTO', 'CREATE VIEW', 'MERGE SCHEMA'],
    answer: 1,
    explain: 'COPY INTO는 이미 적재한 파일을 추적해 다시 실행해도 같은 파일을 중복으로 적재하지 않습니다.',
  },
  {
    q: 'Managed table과 External table의 차이로 옳은 것은?',
    options: ['Managed table은 SQL로 조회할 수 없다', 'Managed table을 DROP하면 데이터 파일도 함께 삭제되고, External table은 메타데이터만 삭제된다', 'External table은 Delta 형식을 지원하지 않는다', '둘은 차이가 없다'],
    answer: 1,
    explain: 'Managed table은 Unity Catalog가 저장 위치와 수명주기를 관리합니다. External table은 사용자가 지정한 외부 경로의 데이터를 가리킵니다.',
  },
  {
    q: '스타 스키마에서 "주문 금액, 수량"처럼 측정값을 담는 테이블은?',
    options: ['Dimension table', 'Fact table', 'Bridge table', 'Lookup view'],
    answer: 1,
    explain: '팩트 테이블은 이벤트/거래의 측정값과 차원 키를 담고, 차원 테이블은 고객·상품·날짜 같은 설명 속성을 담습니다.',
  },
  {
    q: '특정 그룹이 아니면 이메일 컬럼을 마스킹해서 보여주고 싶을 때 Unity Catalog에서 사용할 수 있는 기능은?',
    options: ['Column mask (마스킹 함수)', 'OPTIMIZE', 'Time Travel', 'Auto Loader'],
    answer: 0,
    explain: 'Unity Catalog는 행 필터(row filter)와 컬럼 마스크(column mask)를 SQL 함수로 정의해 세밀한 접근 제어를 지원합니다. 동적 뷰(is_account_group_member 사용)로도 구현할 수 있습니다.',
  },
  {
    q: '시계열 추세를 보여주기에 가장 적절한 시각화와, 피해야 할 것의 조합은?',
    options: ['파이 차트 / 라인 차트', '라인 차트 / 축이 2개인 이중축 차트', '산점도 / 막대 차트', '히트맵 / 테이블'],
    answer: 1,
    explain: '추세는 라인 차트가 적합합니다. 이중축 차트는 축 스케일 조작으로 잘못된 해석을 유도하기 쉬워 지양합니다.',
  },
  {
    q: '대시보드 결과를 매주 월요일 이해관계자에게 PDF 스냅샷으로 보내려면?',
    options: ['대시보드 Schedule(구독) 설정', 'Delta Sharing', 'Git 폴더 연결', 'Query Profile 다운로드'],
    answer: 0,
    explain: 'AI/BI 대시보드는 예약 새로고침과 구독자 이메일 전송(스냅샷)을 지원합니다.',
  },
  {
    q: 'Databricks SQL에서 DuckDB의 strftime(ts, \'%Y-%m\')과 같은 결과를 내는 함수는?',
    options: ["to_char(ts, 'YYYY-MM')", "date_format(ts, 'yyyy-MM')", "format_date('%Y-%m', ts)", "strftime(ts, 'yyyy-MM')"],
    answer: 1,
    explain: "Databricks(Spark SQL)는 Java 형식 패턴(yyyy, MM, dd, HH, mm)을 사용하는 date_format을 씁니다. 대소문자에 주의하세요: MM=월, mm=분.",
  },
  {
    q: 'datediff(\'2025-01-10\', \'2025-01-01\')의 Databricks SQL 결과는?',
    options: ['-9', '9', '10', '오류'],
    answer: 1,
    explain: 'Databricks의 2인자 datediff(end, start)는 end - start 일수를 반환합니다. DuckDB의 date_diff(\'day\', start, end)와 인자 순서가 반대입니다.',
  },
  {
    q: 'Materialized View에 대한 설명으로 옳은 것은?',
    options: ['쿼리할 때마다 원본에서 다시 계산된다', '결과를 미리 계산해 저장하고 원본 변경 시 (증분) 갱신된다', '권한 설정이 불가능하다', 'Delta 테이블을 대상으로 만들 수 없다'],
    answer: 1,
    explain: 'Materialized View는 결과를 저장해 조회가 빠르며, 갱신(REFRESH, 스케줄)으로 최신화합니다. 일반 View는 조회할 때마다 계산됩니다.',
  },
];
