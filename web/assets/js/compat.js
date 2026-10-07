// Databricks(Spark SQL) 함수 이름을 DuckDB에서도 쓸 수 있게 하는 호환 매크로.
// 이 사이트의 SQL 엔진은 DuckDB지만, Databricks에서 쓰던 쿼리를 최대한 그대로 실행할 수 있도록 합니다.
// (tests/validate_content.py 가 이 목록을 그대로 DuckDB에 적용해 검증합니다)

const DATE_FORMATS = [
  ['yyyy-MM-dd HH:mm:ss', '%Y-%m-%d %H:%M:%S'], ['yyyy-MM-dd HH:mm', '%Y-%m-%d %H:%M'], ['yyyy-MM-dd', '%Y-%m-%d'],
  ['yyyy-MM', '%Y-%m'], ['yyyyMMdd', '%Y%m%d'], ['yyyyMM', '%Y%m'], ['yyyy', '%Y'], ['MM', '%m'], ['dd', '%d'],
  ['HH', '%H'], ['E', '%a'], ['EEEE', '%A'],
];

const dateFormatCase = 'CASE fmt ' +
  DATE_FORMATS.map(([j, p]) => `WHEN '${j}' THEN strftime(CAST(d AS TIMESTAMP), '${p}')`).join(' ') +
  " ELSE error('date_format: 지원 포맷은 yyyy-MM-dd, yyyy-MM, yyyyMMdd, HH, E 등입니다') END";

export const COMPAT_MACROS = [
  'CREATE OR REPLACE MACRO nvl(a, b) AS coalesce(a, b)',
  'CREATE OR REPLACE MACRO nvl2(a, b, c) AS CASE WHEN a IS NOT NULL THEN b ELSE c END',
  'CREATE OR REPLACE MACRO collect_list(x) AS list(x)',
  'CREATE OR REPLACE MACRO collect_set(x) AS list(DISTINCT x)',
  'CREATE OR REPLACE MACRO to_date(x) AS CAST(x AS DATE)',
  'CREATE OR REPLACE MACRO to_timestamp(x) AS CAST(x AS TIMESTAMP)',
  "CREATE OR REPLACE MACRO datediff(a, b) AS date_diff('day', CAST(b AS DATE), CAST(a AS DATE)), (unit, a, b) AS date_diff(unit, a, b)",
  'CREATE OR REPLACE MACRO date_sub(d, n) AS CAST(CAST(d AS DATE) - CAST(n AS INTEGER) AS DATE)',
  'CREATE OR REPLACE MACRO add_months(d, n) AS CAST(CAST(d AS DATE) + to_months(CAST(n AS INTEGER)) AS DATE)',
  `CREATE OR REPLACE MACRO date_format(d, fmt) AS ${dateFormatCase}`,
  "CREATE OR REPLACE MACRO dayofweek(d) AS (CAST(strftime(CAST(d AS DATE), '%w') AS INTEGER) + 1)",
  "CREATE OR REPLACE MACRO from_unixtime(x) AS strftime(epoch_ms(CAST(x AS BIGINT) * 1000), '%Y-%m-%d %H:%M:%S')",
  'CREATE OR REPLACE MACRO unix_timestamp(x) AS CAST(epoch(CAST(x AS TIMESTAMP)) AS BIGINT)',
  'CREATE OR REPLACE MACRO percentile_approx(x, p) AS approx_quantile(x, p)',
  'CREATE OR REPLACE MACRO percentile(x, p) AS quantile_cont(x, p)',
  'CREATE OR REPLACE MACRO try_divide(a, b) AS CASE WHEN b = 0 THEN NULL ELSE a / b END',
  'CREATE OR REPLACE MACRO size(x) AS len(x)',
  'CREATE OR REPLACE MACRO explode(x) AS unnest(x)',
];
