// 문법 레퍼런스 (SQL · pandas) — Docs 형식
// - tier: 'core' = 자주 쓰는 문법(본문), 'appendix' = 덜 쓰는 문법(부록)
// - group: 목차에서 묶이는 단원 이름 (같은 group 은 연속해서 배치)
// - summary: 한 줄 설명 (목차 툴팁·검색 결과에 표시)
// - body: 무엇을 하는지 + 언제 쓰는지 (마크다운)
// - syntax: 문법 형태 (실행하지 않는 틀, 대문자 키워드 + 소문자 자리표시자)
// - examples: [{ title, code }] — 샘플 테이블로 실제 실행되는 예제 (tests/validate_content.py 가 모두 실행해 검증)
//     SQL 은 DuckDB(+ compat.js 호환 매크로), pandas 는 runtime.py 네임스페이스(users, orders … 와 pd, np)에서 실행
//     pandas 예제는 마지막 줄의 값이 출력되므로 결과를 보여줄 식으로 끝냅니다
// - tips: 주의할 점·실무 팁 (마크다운 목록, 선택)
// - dbx: Databricks(Spark SQL / PySpark)와 다른 점 (선택)
// - related: 연습할 문제은행 id 목록 (선택)
import { SQL_REF } from './reference-sql.js';
import { PANDAS_REF } from './reference-pandas.js';

export const REF_LANGS = [
  { id: 'sql', name: 'SQL', intro: '이 사이트의 SQL은 DuckDB로 실행됩니다. Databricks SQL과 문법이 거의 같고, 다른 부분은 각 항목의 **Databricks** 메모에 적었습니다. 예제는 샘플 테이블(users, orders, events …)로 바로 실행해 볼 수 있습니다.', items: SQL_REF },
  { id: 'pandas', name: 'pandas', intro: 'pandas 2.x 기준입니다. 예제의 `users`, `orders` 등은 샘플 테이블을 미리 읽어 둔 DataFrame이고, `pd`, `np`도 이미 import되어 있습니다. 마지막 줄의 값이 결과로 출력됩니다.', items: PANDAS_REF },
];
