// SQL 문법 레퍼런스 — 형식은 reference.js 주석 참고
export const SQL_REF = [
  {
    id: 'select', tier: 'core', group: '조회 기본',
    title: 'SELECT · FROM · 별칭(AS)',
    summary: '테이블에서 원하는 컬럼을 골라 조회합니다.',
    body: `
      \`SELECT\` 뒤에 가져올 컬럼(또는 계산식)을, \`FROM\` 뒤에 테이블을 씁니다. \`AS\`로 결과 컬럼에 이름(별칭)을 붙일 수 있고, 계산식에는 별칭을 붙이는 습관을 들이세요.
      - \`*\`는 모든 컬럼입니다. 탐색할 때만 쓰고, 분석 쿼리에서는 필요한 컬럼만 적습니다.`,
    syntax: `SELECT col1, col2 AS alias, expr AS alias2
FROM table_name`,
    examples: [
      { title: '필요한 컬럼만, 계산 컬럼에 별칭', code: `SELECT order_id, user_id, total_amount,
       total_amount + discount_amount AS amount_before_discount
FROM orders
LIMIT 5` },
    ],
    tips: `
      - 별칭에 공백·한글을 쓰려면 큰따옴표로 감쌉니다: \`AS "결제 금액"\` (Databricks는 백틱)
      - 컬럼 기반 저장소(Parquet/Delta)에서는 필요한 컬럼만 읽을수록 빠르고 저렴합니다.`,
    dbx: 'Databricks에서 특수문자가 들어간 식별자는 백틱(`` `col name` ``)으로 감쌉니다.',
    related: ['sql-01'],
  },
];
