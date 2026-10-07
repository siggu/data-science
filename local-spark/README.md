# local-spark — Databricks 문법으로 로컬 실습하기

Docker 하나로 **JupyterLab + PySpark 3.5 + Delta Lake 3.2** 환경을 띄웁니다. 웹 플레이그라운드와 같은 샘플 데이터가 Delta 테이블로 자동 등록되어, Databricks 노트북과 거의 같은 방식으로 SQL, PySpark, Delta 기능을 연습할 수 있습니다.

> Databricks Runtime 15.4 / 16.4 LTS도 Spark 3.5 계열입니다.

## 실행

```bash
cd local-spark
docker compose up --build        # 처음 빌드는 몇 분 걸립니다 (pip + Delta jar 다운로드)
```

브라우저에서 **http://localhost:8888** (토큰 없음) → `notebooks/` 폴더를 엽니다.
Spark UI(실행 계획, 스테이지)는 **http://localhost:4040**에서 볼 수 있습니다.

종료는 `Ctrl+C` 또는 `docker compose down`입니다. Delta 테이블은 `warehouse` 볼륨에 남아서 다시 띄워도 변경 이력이 유지됩니다. 완전히 지우려면 `docker compose down -v`를 실행하세요.

## 커널 시작 시 준비되는 것

| 이름 | 설명 |
|---|---|
| `spark` | Delta Lake가 켜진 SparkSession (`CREATE TABLE` 기본 포맷 = Delta, 시간대 UTC) |
| `practice.*` | `users`, `events`, `orders`, `order_items`, `products`, `ab_test`, `employees`, `departments` |
| `%%sql` | Databricks의 `%sql` 셀처럼 SQL 실행. `;`로 여러 문장 실행 가능, 마지막 결과는 `_sqldf` |
| `display(df, n=100)` | Spark/pandas DataFrame을 표로 출력 |
| `dbutils.widgets` | `text`, `dropdown`, `get`, `set`(로컬 전용), `removeAll` |
| `dbutils.fs` | `ls`, `head` |
| `reset_practice_tables()` | 실습으로 바꾼 practice 테이블을 원본 CSV 상태로 되돌림 |

## 노트북

| 파일 | 내용 |
|---|---|
| `01_spark_sql_basics.ipynb` | `%%sql` 사용법, Spark 날짜 함수, DAU, 퍼널(`count_if`), 윈도우 함수, 코호트, 파라미터 쿼리, `EXPLAIN` |
| `02_delta_lake.ipynb` | `UPDATE`/`DELETE`/`MERGE INTO`, `DESCRIBE HISTORY`, `VERSION AS OF`, `RESTORE`, 스키마 강제와 `mergeSchema`, `OPTIMIZE ZORDER`, `VACUUM` |
| `03_pyspark_vs_pandas.ipynb` | 같은 분석을 SQL, DataFrame API, pandas API on Spark, pandas로 작성, 지연 평가, pandas UDF |

노트북 내용은 `scripts/build_notebooks.py`에서 관리합니다. 내용을 고친 뒤 `python scripts/build_notebooks.py`로 다시 생성하세요.

## Databricks와 다른 점

| 항목 | 로컬(OSS Spark 3.5 + Delta) | Databricks |
|---|---|---|
| 테이블 이름 | `practice.users` (2단계) | `catalog.schema.table` (Unity Catalog 3단계) |
| `QUALIFY` | ❌ 미지원 → 서브쿼리 + `ROW_NUMBER()` | ✅ |
| `GROUP BY ALL`, `count_if`, `try_divide`, `datediff(unit, a, b)` | ✅ | ✅ |
| Liquid Clustering, Photon, Serverless, Genie, AI/BI 대시보드, `ai_query` | ❌ | ✅ |
| 위젯 UI | `dbutils.widgets.set()`으로 값 변경 | 노트북 상단 위젯 UI |
| `display()` 차트 | pandas 표 (차트는 matplotlib 사용) | 내장 시각화 |

플랫폼 기능(대시보드, Genie, Unity Catalog 권한)까지 실습하려면 **Databricks Free Edition**에 가입한 뒤 `web/data/*.csv`를 업로드해서 쓰면 됩니다.

## 문제 해결

- **포트 충돌**: `docker-compose.yml`의 `8888:8888`을 `8889:8888` 등으로 바꾸세요.
- **메모리 부족**: Docker Desktop의 메모리를 4GB 이상으로 늘리거나, `SPARK_DRIVER_MEMORY`를 조정하세요.
- **노트북 저장 권한 오류 (Linux)**: 컨테이너 사용자 UID가 1000입니다. `sudo chown -R 1000:1000 notebooks`로 맞춰 주세요.
- **사내 프록시에서 빌드 실패**: pip와 Maven(Delta jar)이 회사 인증서를 신뢰해야 합니다. 회사 CA를 이미지에 추가하고 `PIP_CERT`와 Java truststore(`keytool -importcert -cacerts`)에 등록하세요.
