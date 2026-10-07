// SQLD (SQL 개발자) — 한국데이터산업진흥원 데이터자격검정
// 시험 정보는 2026년 공고 기준. 문제는 출제 범위를 바탕으로 직접 작성한 연습 문제입니다 (기출 문제 아님).

export const SQLD = {
  id: 'sqld',
  name: 'SQLD',
  fullName: 'SQL 개발자 (SQL Developer)',
  org: '한국데이터산업진흥원 (데이터자격검정 dataq.or.kr)',
  format: {
    questions: 50,
    minutes: 90,
    type: '객관식 4지선다 (2024년부터 단답형 폐지)',
    fee: '50,000원',
    pass: '총점 60점 이상 + 과목별 40% 이상 (미만 시 과락)',
  },
  schedule: [
    { round: '제60회', apply: '2026-02-02 ~ 02-06', exam: '2026-03-07', result: '2026-03-27' },
    { round: '제61회', apply: '2026-04-27 ~ 05-01', exam: '2026-05-31', result: '2026-06-19' },
    { round: '제62회', apply: '2026-07-20 ~ 07-24', exam: '2026-08-22', result: '2026-09-11' },
    { round: '제63회', apply: '2026-10-12 ~ 10-16', exam: '2026-11-14', result: '2026-12-04' },
  ],
  why: `
    - DA 채용 공고에서 **SQL 역량을 객관적으로 증명**하는 가장 대중적인 자격증입니다. 신입 지원 시 우대 항목으로 자주 등장합니다.
    - 시험은 **Oracle 문법 기준**으로 출제됩니다 (\`NVL\`, \`DECODE\`, \`ROWNUM\`, \`CONNECT BY\`, \`(+)\` 외부조인). Databricks/DuckDB와 다른 부분은 요약 노트에 표시했습니다.
    - 실무 SQL(윈도우 함수, 집계)을 쓰고 있다면 **1과목(모델링 이론)과 Oracle 전용 문법**을 집중 보완하면 2~3주 안에 준비할 수 있습니다.`,
  subjects: [
    {
      name: '1과목 · 데이터 모델링의 이해',
      count: 10,
      summary: `
        ### 데이터 모델링 기본
        - 모델링의 특징: **추상화, 단순화, 명확화**
        - 단계: **개념적**(엔터티·관계, 추상화 수준 높음) → **논리적**(키·속성·정규화, 재사용성 높음) → **물리적**(테이블·인덱스·성능)
        - 관점: 데이터(What), 프로세스(How), 상관(데이터↔프로세스)
        - **3단계 스키마**: 외부(사용자 뷰) / 개념(통합 뷰, 전체 DB 구조) / 내부(물리 저장)
          - 논리적 독립성: 개념 스키마 변경이 외부 스키마에 영향 X
          - 물리적 독립성: 내부 스키마 변경이 개념 스키마에 영향 X

        ### 엔터티 (Entity)
        - 조건: 업무에 필요, **식별자로 유일하게 식별**, **인스턴스 2개 이상**, 속성 보유, 다른 엔터티와 **관계 1개 이상**
        - 유무형 분류: **유형**(사원, 상품) / **개념**(조직, 보험상품) / **사건**(주문, 청구)
        - 발생 시점 분류: **기본**(독립 생성, 자신의 주식별자) / **중심**(기본에서 파생, 업무 중심: 주문) / **행위**(2개 이상 부모, 이력: 주문내역)

        ### 속성 (Attribute)
        - 특성 분류: **기본**(업무에서 도출) / **설계**(코드, 일련번호 등 설계 시 생성) / **파생**(계산값 — 데이터 정합성 관리 필요, 최소화)
        - 구성 방식: PK/FK/일반 속성 · 분해 여부: 단일/복합 · 값 개수: 단일값/다중값
        - **도메인**: 속성이 가질 수 있는 값의 범위 (데이터 타입, 크기, 제약)

        ### 관계 (Relationship)
        - 표기: **관계명, 관계 차수(카디널리티: 1:1, 1:M, M:N), 관계 선택성(필수/선택)**
        - 존재 관계(부서-사원) / 행위 관계(고객-주문)

        ### 식별자 (Identifier)
        - 주식별자 특징: **유일성, 최소성, 불변성, 존재성(NOT NULL)**
        - 분류: 대표성(주/보조), 생성(내부/외부), 속성 수(단일/복합), 대체 여부(**본질/인조**)
        - **식별 관계**: 부모 PK가 자식 PK의 일부 (강한 연결, 자식 PK 속성 증가) / **비식별 관계**: 부모 PK가 자식의 일반 FK (약한 연결, 부모 없이 자식 생성 가능)

        ### 정규화와 반정규화
        - **1NF**: 원자값(반복 그룹 제거) / **2NF**: **부분 함수 종속 제거** (복합키 일부에만 종속) / **3NF**: **이행 함수 종속 제거** (A→B→C) / **BCNF**: 모든 결정자가 후보키
        - 정규화 효과: 중복 제거·이상현상(삽입/수정/삭제 이상) 방지, **조회 성능은 저하될 수 있음** (조인 증가)
        - **반정규화**: 조회 성능을 위해 중복 허용 (컬럼/테이블 중복, 통계 테이블, 이력 테이블 추가 등) → 데이터 무결성 위험

        ### 기타
        - 슈퍼타입/서브타입 변환: **One to One**(개별 테이블) / **Plus**(슈퍼+서브) / **Single**(All in One, 하나의 테이블)
        - 트랜잭션 특성 **ACID**: 원자성, 일관성, 고립성, 지속성
        - NULL: 연산 결과 NULL, 집계 함수는 NULL 제외
        - 분산 DB 투명성: 분할, 위치, 지역사상, 중복, 장애, 병행`,
    },
    {
      name: '2과목 · SQL 기본 및 활용',
      count: 40,
      summary: `
        ### SQL 분류
        | 분류 | 명령어 |
        |---|---|
        | DDL | CREATE, ALTER, DROP, RENAME, TRUNCATE |
        | DML | SELECT, INSERT, UPDATE, DELETE, MERGE |
        | DCL | GRANT, REVOKE |
        | TCL | COMMIT, ROLLBACK, SAVEPOINT |

        ### 실행 순서
        FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY
        (ORDER BY에서는 SELECT 별칭 사용 가능, WHERE에서는 불가)

        ### 함수 (Oracle 기준)
        - NULL: \`NVL(a, b)\`, \`NVL2(a, b, c)\`, \`NULLIF(a, b)\`(같으면 NULL), \`COALESCE(a, b, ...)\`(첫 번째 NOT NULL)
        - 조건: \`DECODE(col, v1, r1, v2, r2, default)\`, \`CASE WHEN ... THEN ... ELSE ... END\` (ELSE 없으면 NULL)
        - 문자: \`SUBSTR\`, \`INSTR\`, \`LENGTH\`, \`LPAD/RPAD\`, \`TRIM/LTRIM/RTRIM\`, \`REPLACE\`, \`CONCAT\`(Oracle은 2개 인자), \`||\`
        - 숫자: \`ROUND(123.456, 1)=123.5\`, \`TRUNC\`, \`CEIL\`, \`FLOOR\`, \`MOD\`, \`SIGN\`
        - 날짜: \`SYSDATE\`, \`ADD_MONTHS\`, \`MONTHS_BETWEEN\`, \`LAST_DAY\`, \`EXTRACT\`, 날짜 + 1 = 하루 뒤, 날짜 + 1/24 = 한 시간 뒤

        ### NULL 핵심
        - \`NULL = NULL\`은 UNKNOWN → \`IS NULL\` 사용
        - \`NULL + 1 = NULL\`, 집계 함수는 NULL 제외 (\`COUNT(*)\`는 포함)
        - **\`NOT IN (…, NULL)\` → 결과 0건**
        - 정렬: **Oracle은 NULL을 가장 큰 값**(ASC 시 마지막), SQL Server는 가장 작은 값

        ### JOIN
        - EQUI / NON-EQUI(BETWEEN 등) / NATURAL(같은 이름 컬럼, 별칭 접두사 사용 불가) / USING / CROSS(카테시안 곱(Cartesian Product))
        - OUTER: LEFT/RIGHT/FULL, Oracle 구문 \`WHERE a.id = b.id(+)\` → (+) 반대쪽이 기준(LEFT)

        ### 서브쿼리
        - 단일행(=, <, >) / 다중행(**IN, ANY, ALL, EXISTS**) / 다중컬럼
        - 위치: SELECT절 = **스칼라 서브쿼리**(1행 1열), FROM절 = **인라인 뷰**, WHERE/HAVING절 = 서브쿼리
        - \`> ALL(…)\` = 최댓값보다 큼, \`> ANY(…)\` = 최솟값보다 큼

        ### 집합 연산자
        UNION(중복 제거, 결과 순서는 보장되지 않으므로 정렬은 마지막 ORDER BY로) / UNION ALL(중복 포함) / INTERSECT / MINUS(Oracle) = EXCEPT(SQL Server). 컬럼 수·타입이 같아야 하며 컬럼명은 **첫 번째 SELECT 기준**.

        ### 그룹 함수 (소계)
        - \`ROLLUP(A, B)\`: (A,B), (A), 전체 → **인자 순서 중요**
        - \`CUBE(A, B)\`: 모든 조합 (A,B), (A), (B), 전체
        - \`GROUPING SETS(A, B)\`: A별, B별 (각각만, 전체합계 없음)
        - \`GROUPING(col)\`: 소계 행이면 1

        ### 윈도우 함수
        - 순위: \`RANK\`(1,1,3) / \`DENSE_RANK\`(1,1,2) / \`ROW_NUMBER\`(1,2,3)
        - 집계: \`SUM() OVER (PARTITION BY … ORDER BY … ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)\`
        - 행 순서: \`LAG\`, \`LEAD\`, \`FIRST_VALUE\`, \`LAST_VALUE\`
        - 비율: \`RATIO_TO_REPORT\`(합계 대비 비율), \`PERCENT_RANK\`, \`CUME_DIST\`, \`NTILE(n)\`
        - ORDER BY만 있고 프레임 생략 시 기본값: **RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW**

        ### Top-N
        - Oracle: \`ROWNUM\` (WHERE 단계에서 부여 → \`ROWNUM <= 3\`은 가능, **\`ROWNUM = 2\`·\`ROWNUM > 1\`은 0건**), 정렬 후 자르려면 인라인 뷰에서 ORDER BY
        - SQL Server: \`TOP(n) [WITH TIES]\`, 표준: \`FETCH FIRST n ROWS ONLY\`

        ### 계층형 질의 (Oracle)
        \`START WITH\`(루트) / \`CONNECT BY PRIOR 자식 = 부모\`(순방향, 부모→자식) / \`LEVEL\`(루트=1) / \`CONNECT_BY_ISLEAF\` / \`SYS_CONNECT_BY_PATH\` / \`ORDER SIBLINGS BY\`

        ### DML · TCL · DDL · DCL
        - \`TRUNCATE\`: 전체 삭제 + 저장공간 해제, **ROLLBACK 불가(DDL)** / \`DELETE\`: 행 단위, ROLLBACK 가능 / \`DROP\`: 구조까지 삭제
        - **Oracle은 DDL 실행 시 자동 COMMIT**, SQL Server는 기본 AUTO COMMIT
        - \`SAVEPOINT sp1\` → \`ROLLBACK TO sp1\`
        - 제약조건: PRIMARY KEY(UNIQUE + NOT NULL, 테이블당 1개), UNIQUE(NULL 허용), NOT NULL, CHECK, FOREIGN KEY(\`ON DELETE CASCADE / SET NULL\`)
        - \`GRANT SELECT ON t TO user [WITH GRANT OPTION]\`, \`REVOKE\`, ROLE로 권한 묶음 관리
        - VIEW: 보안성, 편리성, 독립성 / 자체 데이터 없음 / ALTER VIEW로 정의 변경 불가 → CREATE OR REPLACE VIEW로 재정의

        ### Databricks/DuckDB와 다른 점 (실무자 주의)
        | Oracle (시험) | Databricks / DuckDB |
        |---|---|
        | \`NVL\`, \`DECODE\` | \`coalesce\`/\`ifnull\`, \`CASE\` (Databricks는 \`nvl\`·\`decode\`도 지원, 이 사이트는 \`nvl\` 호환 매크로 제공) |
        | \`ROWNUM <= 3\` | \`LIMIT 3\` |
        | \`a.id = b.id(+)\` | \`LEFT JOIN\` |
        | \`MINUS\` | \`EXCEPT\` |
        | \`CONNECT BY\` | 재귀 CTE (\`WITH RECURSIVE\`) |
        | 빈 문자열 \`''\` = NULL | \`''\`과 NULL은 다름 |`,
    },
  ],
  questions: [
    // ───── 1과목: 데이터 모델링의 이해 ─────
    { id: 'sqld-m01', subject: 0, q: '데이터 모델링의 특징으로 가장 거리가 먼 것은?', options: ['추상화', '단순화', '명확화', '구체화'], answer: 3, explain: '데이터 모델링의 3가지 특징은 추상화, 단순화, 명확화입니다. 현실 세계를 일정한 형식으로 표현(추상화)하고, 쉽게 이해할 수 있게 표현(단순화)하며, 애매함을 없애고 정확하게 기술(명확화)합니다.' },
    { id: 'sqld-m02', subject: 0, q: '데이터 모델링 단계 중 엔터티, 속성, 관계, 키를 정의하고 정규화를 수행하여 재사용성이 가장 높은 단계는?', options: ['개념적 데이터 모델링', '논리적 데이터 모델링', '물리적 데이터 모델링', '외부 데이터 모델링'], answer: 1, explain: '논리적 모델링은 특정 DBMS와 무관하게 키, 속성, 관계를 정확히 표현하고 정규화를 수행하는 단계로 재사용성이 높습니다. 물리적 모델링은 테이블, 인덱스 등 실제 DB 구현과 성능을 고려합니다.' },
    { id: 'sqld-m03', subject: 0, q: '3단계 스키마 구조에서 "개념 스키마가 변경되어도 외부 스키마(응용 프로그램)에 영향을 주지 않는 성질"은?', options: ['물리적 독립성', '논리적 독립성', '데이터 무결성', '데이터 일관성'], answer: 1, explain: '논리적 독립성은 개념 스키마 변경이 외부 스키마에 영향을 주지 않는 것, 물리적 독립성은 내부 스키마(저장 구조) 변경이 개념 스키마에 영향을 주지 않는 것입니다.' },
    { id: 'sqld-m04', subject: 0, q: '엔터티의 특징으로 옳지 않은 것은?', options: ['업무에서 필요하고 관리하고자 하는 정보여야 한다.', '유일한 식별자에 의해 식별이 가능해야 한다.', '영속적으로 존재하는 인스턴스가 1개 이상이면 된다.', '다른 엔터티와 최소 1개 이상의 관계가 있어야 한다.'], answer: 2, explain: '엔터티는 영속적으로 존재하는 인스턴스의 집합으로, 인스턴스가 **2개 이상**이어야 합니다. 인스턴스가 하나뿐이면 엔터티로 보기 어렵습니다.' },
    { id: 'sqld-m05', subject: 0, q: '발생 시점에 따른 엔터티 분류에서 "주문내역", "이력"처럼 두 개 이상의 부모 엔터티로부터 발생하고 자주 내용이 바뀌거나 데이터가 증가하는 엔터티는?', options: ['기본 엔터티', '중심 엔터티', '행위 엔터티', '개념 엔터티'], answer: 2, explain: '행위 엔터티는 2개 이상의 부모 엔터티로부터 발생하며 데이터 양이 많고 변경이 잦습니다. 기본 엔터티는 독립적으로 생성(사원, 상품), 중심 엔터티는 기본 엔터티에서 발생해 업무의 중심 역할(주문, 계약)을 합니다.' },
    { id: "sqld-m06", subject: 0, q: "다음 중 \"파생 속성\"에 대한 설명으로 옳은 것은?", options: ["업무로부터 추출한 일반적인 속성이다.","업무상 필요하지 않지만 설계 시 일련번호처럼 새로 만든 속성이다.","다른 속성으로부터 계산·변형되어 생성된 속성이다.","여러 개의 값을 동시에 가질 수 있는 속성이다."], answer: 2, explain: "파생 속성은 다른 속성의 값으로 계산된 속성(예: 총주문금액)입니다. 원본이 바뀔 때 함께 갱신해야 해서 정합성 관리 부담이 있으므로 최소화합니다. \"업무로부터 추출한 속성\"은 기본 속성, \"설계 시 새로 만든 일련번호\"는 설계 속성, \"여러 값을 동시에 갖는 속성\"은 다중값 속성입니다." },
    { id: 'sqld-m07', subject: 0, q: '관계를 표현할 때 표기하는 요소로 거리가 먼 것은?', options: ['관계명', '관계 차수(Cardinality)', '관계 선택성(Optionality)', '관계 도메인'], answer: 3, explain: '관계 표기법은 관계명, 관계 차수(1:1, 1:M, M:N), 관계 선택성(필수/선택) 세 가지입니다. 도메인은 속성이 가질 수 있는 값의 범위입니다.' },
    { id: 'sqld-m08', subject: 0, q: '주식별자의 특징이 아닌 것은?', options: ['유일성: 모든 인스턴스를 유일하게 구분한다.', '최소성: 유일성을 만족하는 최소한의 속성으로 구성한다.', '불변성: 한 번 지정된 값은 자주 바뀌지 않아야 한다.', '가변성: 업무 변화에 따라 쉽게 바뀔 수 있어야 한다.'], answer: 3, explain: '주식별자의 4가지 특징은 유일성, 최소성, 불변성, 존재성(값이 반드시 존재, NULL 불가)입니다.' },
    { id: 'sqld-m09', subject: 0, q: '식별 관계와 비식별 관계에 대한 설명으로 옳지 않은 것은?', options: ['식별 관계는 부모의 주식별자를 자식의 주식별자 일부로 상속한다.', '식별 관계만으로 연결하면 자식 엔터티의 주식별자 속성 수가 계속 늘어날 수 있다.', '비식별 관계는 부모 없이 자식 데이터가 생성될 수 있는 경우에 사용할 수 있다.', '비식별 관계에서는 부모의 주식별자를 자식이 상속할 수 없다.'], answer: 3, explain: '비식별 관계에서도 부모의 주식별자는 자식에게 상속되지만, 자식의 주식별자가 아닌 **일반 속성(외래키)**으로 상속됩니다.' },
    { id: "sqld-m10", subject: 0, q: "[주문상세](주문번호, 상품코드, 수량, 상품명) 테이블에서 PK가 (주문번호, 상품코드)이고 상품명이 상품코드에만 종속될 때, 만족하지 못하는 가장 낮은 단계의 정규형은?", options: ["제1정규형","제2정규형","제3정규형","BCNF"], answer: 1, explain: "복합키의 일부(상품코드)에만 종속되는 속성(상품명)이 있으면 **부분 함수 종속** → 제2정규형 위반입니다. 상품 테이블로 분리해 해결합니다." },
    { id: "sqld-m11", subject: 0, q: "[사원](사원번호, 부서코드, 부서명)에서 사원번호 → 부서코드, 부서코드 → 부서명 종속이 있다. 이 테이블이 만족하지 못하는 가장 낮은 단계의 정규형과 그 이유는?", options: ["제1정규형 - 반복 그룹 존재","제2정규형 - 부분 함수 종속","제3정규형 - 이행 함수 종속","BCNF - 후보키가 아닌 결정자 존재"], answer: 2, explain: "사원번호 → 부서코드 → 부서명처럼 기본키가 아닌 속성을 거쳐 종속되는 **이행 함수 종속**은 제3정규형 위반입니다." },
    { id: 'sqld-m12', subject: 0, q: '반정규화에 대한 설명으로 가장 적절하지 않은 것은?', options: ['조회 성능 향상을 위해 데이터 중복을 허용하는 기법이다.', '통계 테이블이나 이력 테이블을 추가하는 것도 반정규화 기법이다.', '반정규화를 하면 데이터 무결성이 더 강하게 보장된다.', '반정규화 전에 인덱스 조정, 뷰, 클러스터링 등 다른 방법을 먼저 검토한다.'], answer: 2, explain: '반정규화는 중복을 허용하므로 데이터 무결성(정합성)이 깨질 위험이 커집니다. 그래서 다른 성능 개선 방법을 먼저 검토한 뒤 적용합니다.' },
    { id: 'sqld-m13', subject: 0, q: '슈퍼타입/서브타입 모델을 하나의 테이블로 통합하는 변환 방식으로, 조인이 없어 조회가 빠르지만 NULL 컬럼이 많아질 수 있는 것은?', options: ['One to One Type', 'Plus Type', 'Single Type (All in One)', 'Super Type Only'], answer: 2, explain: 'Single(All in One) 방식은 슈퍼타입과 모든 서브타입을 하나의 테이블로 만듭니다. 조인이 필요 없지만 서브타입별 속성이 다른 행에서는 NULL이 됩니다. One to One은 각각 테이블, Plus는 슈퍼+서브 조합입니다.' },
    { id: 'sqld-m14', subject: 0, q: '트랜잭션의 특성(ACID) 중 "트랜잭션 실행 중 다른 트랜잭션이 중간 결과에 접근할 수 없다"는 특성은?', options: ['원자성(Atomicity)', '일관성(Consistency)', '고립성(Isolation)', '지속성(Durability)'], answer: 2, explain: '고립성은 동시에 실행되는 트랜잭션이 서로의 중간 결과를 볼 수 없다는 특성입니다. 원자성은 All or Nothing, 일관성은 실행 전후 DB 상태가 일관됨, 지속성은 커밋된 결과가 영구 반영됨입니다.' },
    { id: 'sqld-m15', subject: 0, q: '다음 중 엔터티를 유형과 무형에 따라 분류했을 때 "개념 엔터티"에 해당하는 것은?', options: ['사원', '물품', '보험상품', '주문'], answer: 2, explain: '유무형에 따른 분류: 유형 엔터티(물리적 형태: 사원, 물품), 개념 엔터티(물리적 형태 없는 개념: 조직, 보험상품), 사건 엔터티(업무 수행 중 발생: 주문, 청구).' },

    // ───── 2과목: SQL 기본 및 활용 ─────
    { id: 'sqld-s01', subject: 1, q: 'SQL 명령어 분류가 잘못 짝지어진 것은?', options: ['DDL - CREATE, ALTER, DROP', 'DML - INSERT, UPDATE, DELETE', 'DCL - GRANT, REVOKE', 'TCL - COMMIT, ROLLBACK, TRUNCATE'], answer: 3, explain: 'TRUNCATE는 테이블 구조를 남기고 데이터를 모두 삭제하는 **DDL**입니다. TCL은 COMMIT, ROLLBACK, SAVEPOINT입니다.' },
    { id: 'sqld-s02', subject: 1, q: 'SELECT 문의 논리적 실행 순서로 옳은 것은?', options: ['SELECT → FROM → WHERE → GROUP BY → HAVING → ORDER BY', 'FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY', 'FROM → SELECT → WHERE → GROUP BY → HAVING → ORDER BY', 'FROM → WHERE → HAVING → GROUP BY → SELECT → ORDER BY'], answer: 1, explain: 'FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY 순서입니다. 그래서 ORDER BY에서는 SELECT 별칭을 쓸 수 있지만 WHERE에서는 쓸 수 없습니다.' },
    { id: 'sqld-s03', subject: 1, q: '다음 SQL의 결과는? (Oracle)', code: "SELECT NVL(NULLIF('A', 'A'), 'B') AS r1,\n       COALESCE(NULL, NULL, 'C', 'D') AS r2\nFROM DUAL;", options: ["r1 = 'A', r2 = 'C'", "r1 = 'B', r2 = 'C'", "r1 = NULL, r2 = 'D'", "r1 = 'B', r2 = NULL"], answer: 1, explain: "NULLIF('A','A')는 두 값이 같으므로 NULL → NVL(NULL, 'B') = 'B'. COALESCE는 첫 번째 NULL이 아닌 값 'C'를 반환합니다." },
    { id: 'sqld-s04', subject: 1, q: 'COL1 값이 (10, NULL, 20, 30)인 테이블 T에서 다음 결과는?', code: 'SELECT COUNT(*), COUNT(COL1), SUM(COL1), AVG(COL1) FROM T;', options: ['4, 4, 60, 15', '4, 3, 60, 20', '3, 3, 60, 20', '4, 3, 60, 15'], answer: 1, explain: 'COUNT(*)는 NULL 포함 4, COUNT(COL1)은 NULL 제외 3, SUM은 60, AVG는 NULL을 제외하고 60/3 = 20입니다. NULL을 0으로 보고 싶다면 AVG(NVL(COL1,0)) = 15입니다.' },
    { id: 'sqld-s05', subject: 1, q: '다음 중 결과가 0건인 SQL은? (T.COL1에는 1, 2, 3이 있고, S.C에는 2, NULL이 있다)', options: ['SELECT * FROM T WHERE COL1 IN (SELECT C FROM S)', 'SELECT * FROM T WHERE COL1 NOT IN (SELECT C FROM S)', 'SELECT * FROM T WHERE NOT EXISTS (SELECT 1 FROM S WHERE S.C = T.COL1)', 'SELECT * FROM T WHERE COL1 > 1'], answer: 1, explain: 'NOT IN 목록에 NULL이 있으면 "COL1 <> NULL"이 UNKNOWN이 되어 모든 행이 걸러집니다. 그래서 결과는 0건입니다. NOT EXISTS는 1, 3을 정상 반환합니다.' },
    { id: 'sqld-s06', subject: 1, q: "LIKE 조건에서 이름에 '_'(언더바) 문자가 포함된 행을 찾는 올바른 표현은?", options: ["WHERE NAME LIKE '%_%'", "WHERE NAME LIKE '%\\_%' ESCAPE '\\'", "WHERE NAME LIKE '_'", "WHERE NAME = '%_%'"], answer: 1, explain: "'_'는 임의의 한 글자를 뜻하는 와일드카드이므로, 문자 그대로 찾으려면 ESCAPE 문자를 지정해야 합니다. '%_%'는 한 글자 이상인 모든 행과 일치합니다." },
    { id: 'sqld-s07', subject: 1, q: 'Oracle에서 다음 SQL을 실행했을 때 NULL 값의 정렬 위치로 옳은 것은?', code: 'SELECT ename, comm FROM emp ORDER BY comm ASC;', options: ['NULL이 가장 앞에 온다', 'NULL이 가장 뒤에 온다', 'NULL 행은 결과에서 제외된다', '오류가 발생한다'], answer: 1, explain: 'Oracle은 NULL을 가장 큰 값으로 취급해 ASC 정렬 시 마지막에 옵니다. SQL Server는 반대로 가장 작은 값으로 취급합니다. NULLS FIRST / NULLS LAST로 직접 지정할 수 있습니다.' },
    { id: 'sqld-s08', subject: 1, q: '다음 SQL의 결과로 옳은 것은?', code: "SELECT CASE WHEN SAL >= 3000 THEN 'HIGH'\n            WHEN SAL >= 2000 THEN 'MID' END AS GRADE\nFROM EMP\nWHERE EMPNO = 7369;   -- SAL = 800", options: ["'MID'", "'LOW'", 'NULL', '오류'], answer: 2, explain: 'CASE 문에서 어떤 조건도 만족하지 않고 ELSE가 없으면 NULL을 반환합니다.' },
    { id: 'sqld-s09', subject: 1, q: "DECODE(DEPTNO, 10, 'A', 20, 'B', 'C')에서 DEPTNO가 30일 때 결과는?", options: ["'A'", "'B'", "'C'", 'NULL'], answer: 2, explain: "DECODE(값, 비교1, 결과1, 비교2, 결과2, 기본값) 형태로, 일치하는 값이 없으면 마지막 기본값 'C'를 반환합니다. 기본값을 생략하면 NULL입니다." },
    { id: 'sqld-s10', subject: 1, q: '다음 함수의 결과가 틀린 것은? (Oracle)', options: ['ROUND(123.456, 1) = 123.5', 'TRUNC(123.456, -1) = 120', 'CEIL(-1.5) = -2', 'MOD(10, 3) = 1'], answer: 2, explain: 'CEIL은 크거나 같은 최소 정수이므로 CEIL(-1.5) = -1입니다. FLOOR(-1.5) = -2입니다.' },
    { id: 'sqld-s11', subject: 1, q: "SUBSTR('SQLDEVELOPER', 4, 3)과 INSTR('SQLDEVELOPER', 'E')의 결과는?", options: ["'DEV', 5", "'LDE', 5", "'DEV', 4", "'EVE', 5"], answer: 0, explain: "SUBSTR(문자열, 시작, 길이): 4번째 글자부터 3글자 = 'DEV'. INSTR은 처음 'E'가 나오는 위치 = 5 (S1 Q2 L3 D4 E5)." },
    { id: 'sqld-s12', subject: 1, q: '다음 중 WHERE 절에 사용할 수 없는 것은?', options: ['서브쿼리', 'BETWEEN 조건', '집계 함수 SUM()', 'IS NULL 조건'], answer: 2, explain: 'WHERE는 GROUP BY 이전에 실행되므로 집계 함수를 쓸 수 없습니다. 집계 결과에 대한 조건은 HAVING에 작성합니다.' },
    { id: 'sqld-s13', subject: 1, q: '부서별 평균 급여가 2,000 이상인 부서만 조회하는 SQL로 옳은 것은?', options: ['SELECT deptno, AVG(sal) FROM emp WHERE AVG(sal) >= 2000 GROUP BY deptno', 'SELECT deptno, AVG(sal) FROM emp GROUP BY deptno HAVING AVG(sal) >= 2000', 'SELECT deptno, AVG(sal) FROM emp GROUP BY deptno WHERE AVG(sal) >= 2000', 'SELECT deptno, AVG(sal) FROM emp HAVING AVG(sal) >= 2000'], answer: 1, explain: '집계 결과에 대한 조건은 GROUP BY 뒤의 HAVING에 둡니다. GROUP BY 없이 deptno와 AVG를 함께 SELECT하면 오류가 나고, WHERE에는 집계 함수를 쓸 수 없습니다.' },
    { id: 'sqld-s14', subject: 1, q: 'Oracle의 외부 조인 표기 "WHERE A.ID = B.ID(+)"와 같은 결과를 내는 ANSI 조인은?', options: ['A INNER JOIN B ON A.ID = B.ID', 'A LEFT OUTER JOIN B ON A.ID = B.ID', 'A RIGHT OUTER JOIN B ON A.ID = B.ID', 'A FULL OUTER JOIN B ON A.ID = B.ID'], answer: 1, explain: '(+)가 붙은 쪽(B)이 "없어도 되는 쪽"이므로 A 기준의 LEFT OUTER JOIN입니다.' },
    { id: 'sqld-s15', subject: 1, q: 'NATURAL JOIN에 대한 설명으로 옳지 않은 것은?', options: ['두 테이블에서 이름이 같은 모든 컬럼으로 EQUI JOIN한다.', '조인에 사용된 컬럼은 결과에 한 번만 나타난다.', '조인 컬럼 앞에 테이블 별칭(alias)을 붙여 사용할 수 있다.', '이름이 같은 컬럼의 데이터 타입이 같아야 한다.'], answer: 2, explain: 'NATURAL JOIN과 USING 절에 사용된 조인 컬럼에는 테이블 별칭이나 테이블명을 접두사로 붙일 수 없습니다.' },
    { id: 'sqld-s16', subject: 1, q: 'EMP 테이블이 14건, DEPT 테이블이 4건일 때 다음 SQL의 결과 건수는?', code: 'SELECT * FROM EMP CROSS JOIN DEPT;', options: ['14건', '18건', '56건', '4건'], answer: 2, explain: 'CROSS JOIN은 모든 조합을 만드는 카테시안 곱(Cartesian Product)이므로 14 × 4 = 56건입니다.' },
    { id: 'sqld-s17', subject: 1, q: '다음 중 다중행 서브쿼리 연산자가 아닌 것은?', options: ['IN', 'ALL', 'EXISTS', '='], answer: 3, explain: '= 은 단일행 비교 연산자입니다. 서브쿼리가 여러 행을 반환할 때 = 를 쓰면 오류가 납니다. 다중행 연산자는 IN, ANY, SOME, ALL, EXISTS입니다.' },
    { id: 'sqld-s18', subject: 1, q: '서브쿼리 (SELECT sal FROM emp WHERE deptno = 30)의 결과가 (950, 1250, 1500, 2850)일 때, "WHERE sal > ALL (서브쿼리)"를 만족하는 조건과 같은 것은?', options: ['sal > 950', 'sal > 2850', 'sal > 1500', 'sal IN (950, 1250, 1500, 2850)'], answer: 1, explain: '> ALL은 모든 값보다 커야 하므로 최댓값(2850)보다 큰 것과 같습니다. > ANY는 최솟값(950)보다 큰 것과 같습니다.' },
    { id: 'sqld-s19', subject: 1, q: 'SELECT 절에 사용되어 한 행, 한 컬럼만 반환해야 하는 서브쿼리는?', options: ['인라인 뷰', '스칼라 서브쿼리', '상관 서브쿼리', '다중 컬럼 서브쿼리'], answer: 1, explain: '스칼라 서브쿼리는 SELECT 절 등에서 단일 값처럼 쓰이며 1행 1열을 반환해야 합니다. FROM 절의 서브쿼리는 인라인 뷰입니다.' },
    { id: 'sqld-s20', subject: 1, q: '집합 연산자에 대한 설명으로 옳지 않은 것은?', options: ['UNION은 중복을 제거한다.', 'UNION ALL은 중복을 포함하며 일반적으로 UNION보다 빠르다.', 'Oracle의 MINUS는 SQL Server의 EXCEPT와 같은 역할이다.', '결과 컬럼명은 마지막 SELECT 문의 컬럼명을 따른다.'], answer: 3, explain: '집합 연산 결과의 컬럼명은 **첫 번째** SELECT 문의 컬럼명(별칭)을 따릅니다. ORDER BY도 마지막에 한 번만 쓸 수 있습니다.' },
    { id: 'sqld-s21', subject: 1, q: 'T1(1,2,3,3), T2(3,4)일 때 SELECT C FROM T1 UNION SELECT C FROM T2 의 결과 건수는?', options: ['6건', '5건', '4건', '3건'], answer: 2, explain: 'UNION은 중복을 제거하므로 1, 2, 3, 4 → 4건입니다. UNION ALL이라면 6건입니다.' },
    { id: 'sqld-s22', subject: 1, q: 'GROUP BY ROLLUP(DEPTNO, JOB)이 생성하는 그룹 집합으로 옳은 것은?', options: ['(DEPTNO, JOB), (DEPTNO), (JOB), ()', '(DEPTNO, JOB), (DEPTNO), ()', '(DEPTNO), (JOB)', '(DEPTNO, JOB), (JOB), ()'], answer: 1, explain: 'ROLLUP(A, B)는 (A,B) 소계, (A) 소계, 전체 합계를 만듭니다. 인자 순서에 따라 결과가 달라집니다. 모든 조합은 CUBE입니다.' },
    { id: 'sqld-s23', subject: 1, q: 'GROUP BY CUBE(A, B)와 같은 결과를 만드는 것은?', options: ['GROUPING SETS((A, B), (A), (B), ())', 'GROUPING SETS(A, B)', 'ROLLUP(A, B)', 'ROLLUP(B, A)'], answer: 0, explain: 'CUBE(A, B)는 가능한 모든 조합 (A,B), (A), (B), 전체를 만듭니다. GROUPING SETS(A, B)는 A별, B별 집계만 만들고 전체 합계는 없습니다.' },
    { id: "sqld-s24", subject: 1, q: "ROLLUP 결과에서 해당 컬럼이 소계(집계)를 위해 NULL로 표시된 행이면 1을 반환하는 함수는?", options: ["GROUPING","NVL","COALESCE","DECODE"], answer: 0, explain: "GROUPING(컬럼)은 해당 행이 그 컬럼에 대한 소계 행이면 1, 아니면 0을 반환합니다. CASE/DECODE와 함께 \"부서 소계\", \"전체 합계\" 라벨을 붙일 때 씁니다." },
    { id: 'sqld-s25', subject: 1, q: '급여가 (5000, 3000, 3000, 2000)일 때 RANK, DENSE_RANK, ROW_NUMBER로 매긴 2000의 순위가 차례로 옳은 것은? (급여 내림차순)', options: ['4, 3, 4', '3, 3, 4', '4, 4, 4', '3, 2, 4'], answer: 0, explain: 'RANK는 동점 다음 순위를 건너뛰어 1,2,2,4 / DENSE_RANK는 건너뛰지 않아 1,2,2,3 / ROW_NUMBER는 고유 번호 1,2,3,4입니다.' },
    { id: 'sqld-s26', subject: 1, q: '윈도우 함수에서 ORDER BY만 지정하고 윈도우 프레임을 생략했을 때 기본 프레임은?', options: ['ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING', 'RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW', 'ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING', 'RANGE BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING'], answer: 1, explain: 'ORDER BY가 있으면 기본 프레임은 RANGE UNBOUNDED PRECEDING ~ CURRENT ROW입니다(누적). RANGE라서 정렬 값이 같은 행은 함께 합산됩니다. ORDER BY가 없으면 파티션 전체가 대상입니다.' },
    { id: 'sqld-s27', subject: 1, q: '각 사원의 바로 이전 입사자의 급여를 함께 조회할 때 사용하는 함수는?', code: 'SELECT ename, hiredate, sal,\n       ______(sal) OVER (ORDER BY hiredate) AS prev_sal\nFROM emp;', options: ['LEAD', 'LAG', 'FIRST_VALUE', 'NTILE'], answer: 1, explain: 'LAG는 이전 행, LEAD는 다음 행의 값을 가져옵니다. LAG(sal, 2, 0)처럼 몇 행 전인지와 기본값도 지정할 수 있습니다.' },
    { id: 'sqld-s28', subject: 1, q: '파티션 전체 합계 대비 현재 행 값의 비율을 반환하는 윈도우 함수는?', options: ['PERCENT_RANK', 'CUME_DIST', 'RATIO_TO_REPORT', 'NTILE'], answer: 2, explain: 'RATIO_TO_REPORT(sal) OVER ()는 sal / SUM(sal)입니다. PERCENT_RANK는 (순위-1)/(행수-1), CUME_DIST는 현재 값 이하인 행의 누적 비율입니다.' },
    { id: "sqld-s29", subject: 1, q: "Oracle에서 다음 SQL 중 결과가 1건 이상 나올 수 있는 것은? (EMP는 14건)", options: ["SELECT * FROM EMP WHERE ROWNUM = 2","SELECT * FROM EMP WHERE ROWNUM > 1","SELECT * FROM EMP WHERE ROWNUM <= 3","SELECT * FROM EMP WHERE ROWNUM BETWEEN 2 AND 5"], answer: 2, explain: "ROWNUM은 조건을 통과한 행에 1부터 차례로 부여됩니다. 첫 행이 ROWNUM=1로 \"= 2\", \"> 1\" 조건에서 탈락하면 다음 행도 다시 1이 되어 계속 탈락하므로 결과가 0건입니다. ROWNUM BETWEEN 2 AND 5도 첫 행(ROWNUM=1)이 탈락하므로 0건입니다." },
    { id: 'sqld-s30', subject: 1, q: 'Oracle에서 급여 상위 3명을 올바르게 조회하는 SQL은?', options: ['SELECT * FROM emp WHERE ROWNUM <= 3 ORDER BY sal DESC', 'SELECT * FROM (SELECT * FROM emp ORDER BY sal DESC) WHERE ROWNUM <= 3', 'SELECT TOP 3 * FROM emp ORDER BY sal DESC', 'SELECT * FROM emp ORDER BY sal DESC WHERE ROWNUM <= 3'], answer: 1, explain: 'ROWNUM은 ORDER BY보다 먼저(WHERE 단계에서) 부여되므로, WHERE ROWNUM <= 3 ORDER BY ...는 임의의 3건을 뽑은 뒤 정렬합니다. 인라인 뷰에서 먼저 정렬해야 합니다. TOP 3은 SQL Server 문법입니다.' },
    { id: 'sqld-s31', subject: 1, q: '계층형 질의에서 관리자(부모)부터 부하(자식) 방향으로 전개하는 올바른 CONNECT BY 절은? (EMP의 MGR은 관리자 사번)', options: ['CONNECT BY PRIOR MGR = EMPNO', 'CONNECT BY PRIOR EMPNO = MGR', 'CONNECT BY EMPNO = MGR', 'CONNECT BY LEVEL = MGR'], answer: 1, explain: 'PRIOR가 붙은 컬럼은 이전(부모) 행의 값입니다. 부모 행의 EMPNO가 현재 행의 MGR과 같아야 하므로 CONNECT BY PRIOR EMPNO = MGR이 순방향(위→아래)입니다. 암기법: "CONNECT BY PRIOR PK(EMPNO) = FK(MGR)"이면 부모→자식 순방향, "PRIOR FK = PK"이면 자식→부모 역방향입니다.' },
    { id: 'sqld-s32', subject: 1, q: '계층형 질의에 대한 설명으로 옳지 않은 것은?', options: ['START WITH는 루트 노드를 지정한다.', 'LEVEL은 루트 노드가 1이다.', 'CONNECT_BY_ISLEAF는 자식이 없는 리프 노드이면 1을 반환한다.', 'ORDER SIBLINGS BY는 계층 구조를 무시하고 전체 결과를 정렬한다.'], answer: 3, explain: 'ORDER SIBLINGS BY는 계층 구조를 유지하면서 같은 부모를 가진 형제 노드끼리만 정렬합니다. 일반 ORDER BY는 계층 구조를 무시하고 정렬합니다.' },
    { id: 'sqld-s33', subject: 1, q: 'DELETE, TRUNCATE, DROP에 대한 설명으로 옳은 것은?', options: ['TRUNCATE는 WHERE 절로 일부 행만 삭제할 수 있다.', 'DELETE는 로그를 남기므로 ROLLBACK이 가능하다.', 'DROP은 데이터만 삭제하고 테이블 구조는 남긴다.', 'TRUNCATE는 DML이므로 ROLLBACK할 수 있다.'], answer: 1, explain: 'DELETE는 DML로 행 단위 삭제와 ROLLBACK이 가능합니다. TRUNCATE는 DDL로 전체 데이터를 삭제하고 저장 공간을 해제하며 ROLLBACK할 수 없습니다. DROP은 테이블 구조까지 삭제합니다.' },
    { id: 'sqld-s34', subject: 1, q: 'Oracle에서 다음을 순서대로 실행한 뒤 T의 건수는? (T는 처음에 0건)', code: "INSERT INTO T VALUES (1);\nSAVEPOINT A;\nINSERT INTO T VALUES (2);\nSAVEPOINT B;\nINSERT INTO T VALUES (3);\nROLLBACK TO A;\nCOMMIT;", options: ['0건', '1건', '2건', '3건'], answer: 1, explain: 'ROLLBACK TO A는 SAVEPOINT A 이후의 작업(2, 3 입력)을 취소합니다. 1만 남은 상태로 COMMIT되므로 1건입니다.' },
    { id: 'sqld-s35', subject: 1, q: 'Oracle에서 다음을 실행한 뒤 T의 건수는? (T는 처음에 0건)', code: "INSERT INTO T VALUES (1);\nCREATE TABLE T2 (C NUMBER);\nINSERT INTO T VALUES (2);\nROLLBACK;", options: ['0건', '1건', '2건', '오류'], answer: 1, explain: 'Oracle은 DDL(CREATE TABLE) 실행 시 자동으로 COMMIT합니다. 따라서 1은 이미 커밋되었고, 이후 입력한 2만 ROLLBACK되어 1건이 남습니다.' },
    { id: 'sqld-s36', subject: 1, q: '제약조건에 대한 설명으로 옳지 않은 것은?', options: ['PRIMARY KEY는 UNIQUE와 NOT NULL 특성을 모두 가진다.', 'UNIQUE 제약조건이 걸린 컬럼에는 NULL을 입력할 수 있다.', '하나의 테이블에 PRIMARY KEY는 여러 개 정의할 수 있다.', 'FOREIGN KEY에 ON DELETE CASCADE를 지정하면 부모 삭제 시 자식도 함께 삭제된다.'], answer: 2, explain: '기본키는 테이블당 하나만 정의할 수 있습니다(여러 컬럼으로 구성된 복합키는 가능). UNIQUE는 여러 개 정의할 수 있습니다.' },
    { id: 'sqld-s37', subject: 1, q: '다른 사용자에게 받은 권한을 다시 다른 사용자에게 부여할 수 있게 하는 GRANT 옵션은?', options: ['WITH ADMIN OPTION', 'WITH GRANT OPTION', 'WITH CHECK OPTION', 'CASCADE'], answer: 1, explain: '객체 권한(SELECT, INSERT 등)에는 WITH GRANT OPTION, 시스템 권한·롤에는 WITH ADMIN OPTION을 사용합니다. WITH CHECK OPTION은 뷰 조건을 벗어나는 DML을 막는 옵션입니다.' },
    { id: "sqld-s38", subject: 1, q: "MERGE 문에 대한 설명으로 옳은 것은?", options: ["UPDATE와 INSERT를 조건에 따라 한 문장으로 처리할 수 있다.","DDL 명령어이므로 실행 즉시 자동 커밋된다.","WHEN MATCHED 절에서 DELETE는 사용할 수 없다.","MERGE 실행 후에는 ROLLBACK할 수 없다."], answer: 0, explain: "MERGE는 DML로 WHEN MATCHED THEN UPDATE, WHEN NOT MATCHED THEN INSERT를 한 번에 처리합니다(Oracle은 MATCHED 절 안에서 DELETE도 지원). Databricks Delta의 MERGE INTO와 같은 개념입니다." },
    { id: 'sqld-s39', subject: 1, q: '뷰(View)의 장점으로 거리가 먼 것은?', options: ['복잡한 쿼리를 단순화할 수 있다(편리성).', '사용자에게 필요한 컬럼만 보여줘 보안을 강화할 수 있다(보안성).', '테이블 구조가 바뀌어도 뷰만 수정하면 응용 프로그램은 유지할 수 있다(독립성).', '뷰는 데이터를 별도로 저장하므로 조회가 항상 빠르다.'], answer: 3, explain: '일반 뷰는 데이터를 저장하지 않는 가상 테이블로, 조회할 때마다 정의된 쿼리를 실행합니다. 결과를 저장하는 것은 Materialized View입니다.' },
    { id: 'sqld-s40', subject: 1, q: '다음 SQL의 결과로 옳은 것은? (Oracle)', code: "SELECT LPAD('SQL', 6, '*') AS a,\n       RTRIM('xxSQLxx', 'x') AS b\nFROM DUAL;", options: ["a = '***SQL', b = 'xxSQL'", "a = 'SQL***', b = 'SQLxx'", "a = '***SQL', b = 'SQL'", "a = '******SQL', b = 'xxSQL'"], answer: 0, explain: "LPAD('SQL', 6, '*')는 전체 길이 6이 되도록 왼쪽을 '*'로 채워 '***SQL'. RTRIM은 오른쪽의 'x'만 제거해 'xxSQL'입니다." },
    { id: "sqld-s41", subject: 1, q: "다음 중 Oracle에서 빈 문자열('')에 대한 설명으로 옳은 것은?", options: ["''은 길이 0인 일반 문자열로 NULL과 다르다.","''은 NULL로 취급된다.","''을 입력하면 오류가 발생한다.","''은 공백 한 칸(' ')으로 저장된다."], answer: 1, explain: "Oracle은 빈 문자열을 NULL로 취급합니다. 그래서 WHERE col = '' 은 UNKNOWN이 되어 어떤 행도 반환하지 않으므로 IS NULL을 써야 합니다. SQL Server, PostgreSQL, Databricks에서는 빈 문자열과 NULL이 다릅니다." },
    { id: 'sqld-s42', subject: 1, q: '다음 SQL의 결과 건수는? (DEPT 4건: 10,20,30,40 / EMP의 DEPTNO는 10,20,30만 존재)', code: 'SELECT d.deptno\nFROM dept d\nWHERE NOT EXISTS (SELECT 1 FROM emp e WHERE e.deptno = d.deptno);', options: ['0건', '1건', '3건', '4건'], answer: 1, explain: '사원이 없는 부서(40)만 반환하므로 1건입니다. EXISTS/NOT EXISTS는 서브쿼리 결과의 존재 여부만 확인하는 상관 서브쿼리입니다.' },
    { id: 'sqld-s43', subject: 1, q: 'SQL Server에서 "급여 상위 3명을 뽑되 3위와 동점인 사원도 모두 포함"하는 구문은?', options: ['SELECT TOP(3) * FROM emp ORDER BY sal DESC', 'SELECT TOP(3) WITH TIES * FROM emp ORDER BY sal DESC', 'SELECT * FROM emp WHERE ROWNUM <= 3', 'SELECT TOP(3) PERCENT * FROM emp'], answer: 1, explain: 'TOP(n) WITH TIES는 마지막 순위와 같은 값을 가진 행을 함께 반환하며, ORDER BY가 반드시 필요합니다.' },
    { id: 'sqld-s44', subject: 1, q: 'SELECT 절에서 정의한 별칭(alias)을 사용할 수 있는 절은?', options: ['WHERE', 'GROUP BY', 'HAVING', 'ORDER BY'], answer: 3, explain: 'ORDER BY는 SELECT 이후에 실행되므로 별칭을 쓸 수 있습니다. 표준 SQL에서 WHERE, GROUP BY, HAVING은 SELECT보다 먼저 실행되어 별칭을 인식하지 못합니다(Databricks/DuckDB는 일부 허용).' },
  ],
};
