# DA 면접 준비 랩

데이터 분석가(DA)와 데이터 사이언티스트 면접을 준비하기 위한 **웹 학습 환경**입니다.
설치 없이 브라우저에서 SQL과 pandas를 실행할 수 있고, Databricks와 같은 문법으로 연습할 수 있는 로컬 Spark + Delta Lake 환경도 함께 들어 있습니다.

| 탭 | 내용 |
|---|---|
| **면접 Q&A** | 2026년 기준 공통 면접 질문 60개 (SQL · pandas · 통계 · A/B 테스트 · 지표/프로덕트 · Spark/Databricks · ML 기초 · 행동). 질문마다 모범 답변, 면접관 의도, 핵심 포인트, 흔한 실수, 꼬리 질문 포함 |
| **플레이그라운드** | 브라우저 안의 DuckDB(SQL)와 Pyodide(pandas). 샘플 이커머스 DB 8개 테이블, CSV 업로드, SQL 결과를 pandas로 넘기기, Databricks 함수 호환(`datediff`, `date_format`, `nvl`, `collect_list` 등) |
| **문제은행** | SQL 20문제 + pandas 12문제 **자동 채점**. 문제마다 SQL 풀이와 pandas 풀이를 함께 제공 |
| **모의 면접** (A) | 무작위 출제, 타이머, 핵심 포인트로 자기 채점, 약한 질문 우선 출제, 카테고리별 기록 |
| **A/B 테스트** (B) | 표본 크기 계산기, 비율·평균 결과 분석, SRM 검사, 피킹·p-value 분포·중심극한정리 시뮬레이터 |
| **케이스 트레이닝** (C) | 프로덕트 케이스 7개 (DAU 하락, 지표 설계, 실험 해석, 인과 추론 등) 단계별 모범 답안 + 샘플 데이터로 검증 |
| **Databricks** (G) | 레이크하우스, Delta, Unity Catalog 개념, Databricks SQL ↔ DuckDB ↔ pandas ↔ PySpark 대응표, Data Analyst Associate 연습 퀴즈 22문항 |

## 빠른 시작

### 1) 웹 학습 환경

정적 사이트라서 아무 웹 서버로나 `web/` 폴더를 열면 됩니다. (ES 모듈과 `fetch`를 쓰므로 파일을 더블클릭해 `file://`로 열면 동작하지 않습니다.)

```bash
python -m http.server 8000 -d web
# → http://localhost:8000
```

- SQL 엔진(DuckDB-WASM, 약 30MB)은 플레이그라운드에 처음 들어갈 때, pandas 엔진(Pyodide, 약 20MB)은 pandas 탭을 처음 열 때 CDN에서 내려받습니다. 이후에는 브라우저 캐시를 씁니다.
- 진행 현황(익힌 질문, 맞힌 문제, 모의 면접 기록, 작성한 답변)은 **이 브라우저의 localStorage에만** 저장됩니다.

**GitHub Pages로 배포하기**: 저장소 Settings → Pages → Source를 **GitHub Actions**로 바꾼 뒤 `main`에 push하면 `.github/workflows/pages.yml`이 `web/`을 배포합니다.

**CDN이 막힌 사내망·오프라인 환경**: npm 레지스트리만 접근할 수 있으면 로컬 사본을 만들어 쓸 수 있습니다.

```bash
bash scripts/vendor_assets.sh          # web/vendor/ 생성 (git 제외)
python -m http.server 8000 -d web
# → http://localhost:8000/?vendor=local
```

(Pyodide의 pandas 휠은 여전히 Pyodide CDN에서 받습니다.)

### 2) 로컬 Spark + Delta Lake (Databricks와 같은 문법)

```bash
cd local-spark
docker compose up --build
# → http://localhost:8888 (JupyterLab, 토큰 없음)
```

`spark`, `display()`, `%%sql` 셀, `dbutils.widgets`가 준비된 상태로 시작하고, 웹과 같은 샘플 데이터가 `practice` 스키마의 Delta 테이블로 등록됩니다. 자세한 내용은 [local-spark/README.md](local-spark/README.md)를 참고하세요.

## 샘플 데이터

`scripts/generate_sample_data.py`가 시드 고정으로 생성하는 2025년 1년치 가상 이커머스 데이터입니다. 웹과 로컬 Spark가 같은 `web/data/*.csv`를 씁니다.

| 테이블 | 행 수 | 설명 |
|---|---|---|
| `users` | 6,000 | 가입일, 국가, 디바이스, 유입 채널, 연령대, 마케팅 수신 동의 |
| `events` | 63,413 | 세션별 행동 로그: visit → view_item → add_to_cart → checkout → purchase, 플랫폼, 앱 버전 |
| `orders` | 3,445 | 주문 상태(completed/cancelled/refunded), 결제수단, 쿠폰, 할인, 결제금액 |
| `order_items` | 5,833 | 주문 상세 (상품, 수량, 단가) |
| `products` | 144 | 6개 카테고리 상품과 가격 |
| `ab_test` | 5,655 | 실험 2개의 배정과 전환 (`checkout_button_v2`, `free_shipping_banner`) |
| `employees` / `departments` | 41 / 6 | 고전 SQL 면접 문제용 (N번째 급여, 셀프 조인, 동점) |

케이스 스터디용으로 **의도적으로 심어둔 패턴**:
- 2025-10-14 ~ 10-24: Android 앱 5.2.0 배포 후 Android DAU가 약 50% 급감 (DAU 하락 원인 분석)
- paid_search 유입 유저는 첫 전환은 빠르지만 28일 리텐션이 낮음 (채널 LTV 비교)
- `checkout_button_v2`: 실제 효과 있음 (p ≈ 0.009) / `free_shipping_banner`: **SRM** 발생 (p < 0.0001)
- 주말·12월 트래픽 증가, 급여 동점 (RANK와 DENSE_RANK 비교)

## 폴더 구조

```
web/                      정적 웹 앱 (빌드 과정 없음)
  index.html
  assets/js/app.js        라우터, 테마
  assets/js/engines.js    DuckDB-WASM / Pyodide 실행 엔진
  assets/js/compat.js     Databricks(Spark SQL) 함수 호환 매크로
  assets/js/stats.js      통계 함수 (정규, t, 카이제곱 분포, 표본 크기, 검정)
  assets/js/views/*.js    탭별 화면
  assets/js/data/*.js     콘텐츠: 면접 질문, 문제, 케이스, Databricks 자료
  assets/py/runtime.py    브라우저 pandas 실행·채점 런타임 (CPython에서도 테스트)
  data/*.csv              샘플 데이터
local-spark/              Docker: JupyterLab + PySpark 3.5 + Delta Lake 3.2
scripts/                  데이터 생성, 노트북 생성, 오프라인 라이브러리 준비
tests/                    콘텐츠·통계 검증
```

## 콘텐츠 추가와 검증

- 면접 질문: `web/assets/js/data/interview.js`의 `QUESTIONS`에 항목을 추가합니다 (`keyPoints`는 모의 면접 채점 기준).
- 연습 문제: `web/assets/js/data/problems.js`. `solution`과 함께 다른 언어 풀이(`pandasSolution` / `sqlSolution`)를 넣으면, 테스트가 두 풀이의 결과가 같은지 확인합니다.

```bash
pip install duckdb "pandas==2.3.3" scipy
python tests/validate_content.py   # 모든 정답 실행 + SQL/pandas 풀이 결과 일치 + 링크 무결성
python tests/test_stats.py         # stats.js 계산값을 scipy와 비교
```

PR마다 GitHub Actions(`.github/workflows/ci.yml`)에서 같은 검증이 실행됩니다.

## 참고한 자료

- [365 Data Science – Data Scientist Job Market 2026 (공고 1,000건 분석)](https://365datascience.com/career-advice/data-scientist-job-market/)
- [Interview Query – Data Scientist Skills 2026](https://www.interviewquery.com/p/data-scientist-skills-2026)
- [DataCamp – Data Scientist Interview Questions](https://www.datacamp.com/blog/data-scientist-interview-questions)
- [Coursera – Data Scientist Interview Questions (2026)](https://www.coursera.org/articles/data-scientist-interview-questions)
- [Exponent – Top Data Analyst Interview Questions](https://www.tryexponent.com/blog/top-data-analyst-interview-questions)
- [techinterview.org – SQL Interview Questions 2026](https://www.techinterview.org/post/3233460377/sql-interview-questions-2026-window-functions-optimization-and-advanced-queries/)
- [PracHub – SQL Retention Interview Questions](https://prachub.com/resources/sql-retention-interview-questions-cohort-definitions-incomplete-windows-and-correct-denominators)
- [리멤버 – 토스 Data Analyst 채용 공고](https://career.rememberapp.co.kr/job/posting/261673)
- [Databricks Certified Data Analyst Associate 가이드](https://blog.certifhub.com/?p=901347)
- [DuckDB – DuckDB in Pyodide](https://duckdb.org/2024/10/02/pyodide)
