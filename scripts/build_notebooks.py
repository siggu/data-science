"""local-spark/notebooks/*.ipynb 생성 스크립트 (노트북 내용을 코드로 관리).

    python scripts/build_notebooks.py
"""

from __future__ import annotations

import json
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "local-spark" / "notebooks"


def md(src: str) -> dict:
    return {"cell_type": "markdown", "metadata": {}, "source": src.strip("\n")}


def code(src: str) -> dict:
    return {"cell_type": "code", "metadata": {}, "execution_count": None, "outputs": [], "source": src.strip("\n")}


def notebook(cells: list[dict]) -> dict:
    return {
        "cells": cells,
        "metadata": {
            "kernelspec": {"display_name": "Python 3 (ipykernel)", "language": "python", "name": "python3"},
            "language_info": {"name": "python"},
        },
        "nbformat": 4,
        "nbformat_minor": 5,
    }


NB1 = [
    md("""
# 01. Spark SQL 기초 — Databricks 노트북처럼 쓰기

커널이 시작되면 자동으로 준비되는 것:
- `spark` : Delta Lake가 켜진 SparkSession
- `practice` 스키마의 테이블 8개 (웹 플레이그라운드와 같은 데이터)
- `%%sql` 셀 매직 (Databricks의 `%sql`), 결과는 `_sqldf` 변수에 저장
- `display(df)`, `dbutils.widgets`

> Databricks에서는 테이블을 `catalog.schema.table`로 부르지만, 여기서는 `practice.users` 또는 그냥 `users`로 씁니다.
"""),
    code("""
%%sql
SHOW TABLES
"""),
    code("""
%%sql
SELECT * FROM users LIMIT 10
"""),
    md("""
## Spark SQL 날짜 함수 (Databricks와 동일)
`date_format`(Java 패턴), `datediff(end, start)`, `date_add`, `date_trunc`, `to_date`를 그대로 씁니다.
"""),
    code("""
%%sql
SELECT order_id,
       order_ts,
       date_format(order_ts, 'yyyy-MM')          AS ym,
       datediff(DATE'2025-12-31', order_ts)     AS days_ago,
       date_add(to_date(order_ts), 7)           AS plus7,
       date_trunc('MONTH', order_ts)            AS month_start,
       nvl(coupon_code, 'NONE')                 AS coupon
FROM orders
LIMIT 10
"""),
    md("## 플랫폼별 일별 DAU (10월) — 케이스 트레이닝의 DAU 하락 구간"),
    code("""
%%sql
SELECT to_date(event_ts) AS dt, platform, app_version, COUNT(DISTINCT user_id) AS dau
FROM events
WHERE event_ts >= '2025-10-07' AND event_ts < '2025-10-29'
GROUP BY ALL
ORDER BY dt, platform
"""),
    code("""
# %%sql 결과는 _sqldf (Spark DataFrame) 로 받을 수 있습니다 → pandas로 피벗 후 시각화
pdf = _sqldf.toPandas()
wide = pdf.groupby(['dt', 'platform'])['dau'].sum().unstack()
wide.plot(figsize=(10, 4), title='Daily DAU by platform');
"""),
    md("## 퍼널: `count_if`와 조건부 집계"),
    code("""
%%sql
WITH s AS (
  SELECT session_id, platform,
         max(event_type = 'visit')       AS visit,
         max(event_type = 'view_item')   AS view_item,
         max(event_type = 'add_to_cart') AS cart,
         max(event_type = 'purchase')    AS purchase
  FROM events
  GROUP BY session_id, platform
)
SELECT platform,
       count_if(visit) AS visits, count_if(view_item) AS views,
       count_if(cart) AS carts, count_if(purchase) AS purchases,
       round(count_if(purchase) / count_if(visit), 4) AS overall_cvr
FROM s
GROUP BY platform
ORDER BY platform
"""),
    md("""
## 윈도우 함수: 유저별 최신 주문

Databricks에서는 `QUALIFY ROW_NUMBER() OVER (...) = 1`로 짧게 쓸 수 있습니다.
오픈소스 Spark 3.5에는 QUALIFY가 없어서 서브쿼리로 작성합니다 (두 방식 모두 알아두세요).
"""),
    code("""
%%sql
SELECT user_id, order_id, order_ts, total_amount
FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY order_ts DESC, order_id DESC) AS rn
  FROM orders
)
WHERE rn = 1
ORDER BY user_id
LIMIT 20
"""),
    md("## 가입 월 코호트 리텐션"),
    code("""
%%sql
WITH cohort AS (
  SELECT user_id, date_trunc('MONTH', signup_date) AS cohort_month FROM users
),
act AS (
  SELECT DISTINCT user_id, date_trunc('MONTH', event_ts) AS active_month FROM events
),
j AS (
  SELECT c.cohort_month, CAST(months_between(a.active_month, c.cohort_month) AS INT) AS month_n, c.user_id
  FROM cohort c JOIN act a USING (user_id)
)
SELECT cohort_month, month_n, COUNT(DISTINCT user_id) AS active_users
FROM j
WHERE month_n BETWEEN 0 AND 3
GROUP BY ALL
ORDER BY cohort_month, month_n
"""),
    md("""
## 위젯과 파라미터 쿼리
Databricks의 `dbutils.widgets` + named parameter(`:name`)와 같은 패턴입니다. (로컬에서는 위젯 UI 대신 `dbutils.widgets.set()`으로 값을 바꿉니다.)
"""),
    code("""
dbutils.widgets.text("start_date", "2025-10-01")
dbutils.widgets.dropdown("platform", "android", ["android", "ios", "web"])

df = spark.sql(
    \"\"\"
    SELECT to_date(event_ts) AS dt, COUNT(DISTINCT user_id) AS dau
    FROM events
    WHERE event_ts >= :start AND platform = :platform
    GROUP BY 1 ORDER BY 1
    \"\"\",
    args={"start": dbutils.widgets.get("start_date"), "platform": dbutils.widgets.get("platform")},
)
display(df, n=20)
"""),
    md("""
## 연습
1. 웹 문제은행의 `sql-14`(코호트 리텐션)와 `sql-16`(DAU 하락)을 이 노트북에서 Spark SQL로 다시 풀어보세요. DuckDB와 무엇이 다른지 메모해 두면 면접에서 좋은 이야깃거리가 됩니다.
2. `EXPLAIN FORMATTED <쿼리>`로 실행 계획을 보고, http://localhost:4040 Spark UI의 SQL 탭과 비교해 보세요.
"""),
    code("""
%%sql
EXPLAIN FORMATTED
SELECT u.channel, SUM(o.total_amount) AS revenue
FROM orders o JOIN users u USING (user_id)
WHERE o.status = 'completed'
GROUP BY u.channel
"""),
]

NB2 = [
    md("""
# 02. Delta Lake 실습 — MERGE, Time Travel, 스키마 강제, OPTIMIZE

실습용 복사본 테이블 `orders_lab`을 만들어 바꿔 봅니다. 원본 테이블을 망가뜨렸다면 `reset_practice_tables()`로 되돌릴 수 있습니다.
"""),
    code("""
%%sql
CREATE OR REPLACE TABLE orders_lab AS SELECT * FROM orders;
DESCRIBE DETAIL orders_lab
"""),
    md("## UPDATE / DELETE — 일반 Parquet 테이블에서는 불가능한 작업"),
    code("""
%%sql
UPDATE orders_lab SET status = 'refunded' WHERE order_id = 50001;
DELETE FROM orders_lab WHERE status = 'cancelled';
SELECT status, COUNT(*) AS n FROM orders_lab GROUP BY status
"""),
    md("""
## MERGE INTO (Upsert)
결제사에서 받은 상태 변경 파일을 반영한다고 가정합니다: 기존 주문은 상태를 업데이트하고, 새 주문은 추가합니다.
"""),
    code("""
%%sql
CREATE OR REPLACE TEMP VIEW status_updates AS
SELECT * FROM VALUES
  (50002, 'refunded'),
  (50003, 'refunded'),
  (99999, 'completed')
AS t(order_id, status);

MERGE INTO orders_lab AS t
USING (
  SELECT u.order_id, u.status, o.user_id, o.order_ts, o.payment_method, o.coupon_code, o.discount_amount, o.total_amount
  FROM status_updates u LEFT JOIN orders o USING (order_id)
) AS s
ON t.order_id = s.order_id
WHEN MATCHED THEN UPDATE SET t.status = s.status
WHEN NOT MATCHED THEN INSERT (order_id, user_id, order_ts, status, payment_method, coupon_code, discount_amount, total_amount)
  VALUES (s.order_id, 1001, TIMESTAMP'2025-12-31 23:00:00', s.status, 'card', NULL, 0, 10000);

SELECT * FROM orders_lab WHERE order_id IN (50001, 50002, 50003, 99999)
"""),
    md("## 변경 이력과 Time Travel"),
    code("""
%%sql
DESCRIBE HISTORY orders_lab
"""),
    code("""
%%sql
SELECT 'v0 (최초)' AS version, COUNT(*) AS n, SUM(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END) AS refunded FROM orders_lab VERSION AS OF 0
UNION ALL
SELECT '현재', COUNT(*), SUM(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END) FROM orders_lab
"""),
    code("""
%%sql
RESTORE TABLE orders_lab TO VERSION AS OF 0;
SELECT COUNT(*) AS n_after_restore FROM orders_lab
"""),
    md("""
## 스키마 강제(Schema enforcement)와 스키마 진화(mergeSchema)
Delta는 테이블 스키마와 다른 데이터를 쓰려고 하면 막아서 데이터 오염을 방지합니다.
"""),
    code("""
from pyspark.sql import functions as F

extra = spark.table("orders_lab").limit(3).withColumn("channel_hint", F.lit("app"))
try:
    extra.write.format("delta").mode("append").saveAsTable("orders_lab")
except Exception as e:
    print("스키마 불일치로 거부됨 →", str(e).splitlines()[0][:160])

# 의도한 변경이라면 mergeSchema 옵션으로 컬럼 추가 허용
extra.write.format("delta").mode("append").option("mergeSchema", "true").saveAsTable("orders_lab")
spark.catalog.refreshTable("orders_lab")
spark.table("orders_lab").printSchema()   # channel_hint 컬럼이 추가됨
"""),
    md("""
## OPTIMIZE / ZORDER / VACUUM
- `OPTIMIZE`: 작은 파일을 합쳐 읽기 성능 향상
- `ZORDER BY`: 자주 필터하는 컬럼 기준으로 데이터를 모아 데이터 스키핑 향상 (Databricks에서는 Liquid Clustering `CLUSTER BY`를 권장)
- `VACUUM`: 보존 기간이 지난 옛 파일 삭제 → **그 이전 버전으로는 Time Travel 불가**
"""),
    code("""
%%sql
OPTIMIZE orders_lab ZORDER BY (user_id)
"""),
    code("""
# 데모를 위해 보존 기간 0시간으로 VACUUM (실무에서는 절대 이렇게 하지 마세요: 기본 7일)
spark.sql("VACUUM orders_lab RETAIN 0 HOURS")
try:
    # COUNT(*)는 Delta 로그 통계만으로 답할 수 있어 실제 파일을 읽는 쿼리로 확인
    spark.sql("SELECT status, COUNT(*) FROM orders_lab VERSION AS OF 1 GROUP BY status").show()
except Exception as e:
    msg = str(e)
    reason = "옛 버전의 데이터 파일이 삭제됨 (FileNotFound)" if "FileNotFound" in msg or "does not exist" in msg else msg.splitlines()[0][:160]
    print("VACUUM 이후 옛 버전 조회 실패 →", reason)
"""),
    md("""
## 면접 포인트 정리
- Delta = Parquet + 트랜잭션 로그(`_delta_log`) → ACID, Time Travel, MERGE/UPDATE/DELETE
- 실수 복구: `DESCRIBE HISTORY` → `RESTORE TABLE ... TO VERSION AS OF n`
- `VACUUM`은 Time Travel 범위를 줄인다
- 스키마 강제로 잘못된 데이터 적재를 막고, 필요할 때만 `mergeSchema`
"""),
    code("""
# 실습 테이블 정리
spark.sql("DROP TABLE IF EXISTS orders_lab")
"""),
]

NB3 = [
    md("""
# 03. PySpark vs pandas — 같은 분석, 네 가지 방법

"채널별 완료 주문 매출과 구매자 수"를 SQL, PySpark DataFrame API, pandas API on Spark, pandas로 각각 구합니다.
"""),
    code("""
%%sql
SELECT u.channel, COUNT(DISTINCT o.user_id) AS buyers, SUM(o.total_amount) AS revenue
FROM orders o JOIN users u USING (user_id)
WHERE o.status = 'completed'
GROUP BY u.channel
ORDER BY revenue DESC
"""),
    code("""
from pyspark.sql import functions as F

orders = spark.table("orders")
users = spark.table("users")

result = (orders.filter(F.col("status") == "completed")
          .join(users, "user_id")
          .groupBy("channel")
          .agg(F.countDistinct("user_id").alias("buyers"), F.sum("total_amount").alias("revenue"))
          .orderBy(F.desc("revenue")))
display(result)
"""),
    md("""
### 지연 평가(Lazy evaluation)
위 `result`는 아직 계산되지 않은 **실행 계획**입니다. `display`, `count`, `collect`, `write` 같은 **action**이 호출될 때 실행됩니다.
"""),
    code("""
result.explain()   # 물리 실행 계획 (BroadcastHashJoin 등을 찾아보세요)
"""),
    code("""
import pyspark.pandas as ps

pso = orders.pandas_api()
psu = users.pandas_api()
done = pso[pso["status"] == "completed"].merge(psu[["user_id", "channel"]], on="user_id")
done.groupby("channel").agg({"user_id": "nunique", "total_amount": "sum"}).sort_values("total_amount", ascending=False)
"""),
    code("""
# 작은 결과만 pandas로 가져오기 (toPandas는 드라이버 메모리에 전부 올림 → 대용량 금지)
pdf_orders = orders.filter("status = 'completed'").select("user_id", "total_amount").toPandas()
pdf_users = users.select("user_id", "channel").toPandas()
(pdf_orders.merge(pdf_users, on="user_id")
    .groupby("channel")
    .agg(buyers=("user_id", "nunique"), revenue=("total_amount", "sum"))
    .sort_values("revenue", ascending=False))
"""),
    md("## 윈도우 함수: PySpark vs pandas"),
    code("""
from pyspark.sql.window import Window

w = Window.partitionBy("user_id").orderBy("order_ts")
seq = (orders.filter("status = 'completed'")
       .withColumn("order_seq", F.row_number().over(w))
       .withColumn("prev_ts", F.lag("order_ts").over(w))
       .withColumn("gap_days", F.datediff("order_ts", "prev_ts")))
display(seq.filter("order_seq > 1").select("user_id", "order_id", "order_seq", "prev_ts", "order_ts", "gap_days"), n=10)
"""),
    code("""
p = orders.filter("status = 'completed'").select("user_id", "order_id", "order_ts").toPandas().sort_values(["user_id", "order_ts"])
p["order_seq"] = p.groupby("user_id").cumcount() + 1
p["prev_ts"] = p.groupby("user_id")["order_ts"].shift()
p["gap_days"] = (p["order_ts"].dt.normalize() - p["prev_ts"].dt.normalize()).dt.days
p[p["order_seq"] > 1].head(10)
"""),
    md("""
## pandas UDF (벡터화 UDF)
행 단위 Python UDF는 느립니다. 꼭 Python 로직이 필요하면 Arrow 기반 pandas UDF를 씁니다.
"""),
    code("""
import pandas as pd
from pyspark.sql.functions import pandas_udf

@pandas_udf("string")
def tier(revenue: pd.Series) -> pd.Series:
    return pd.cut(revenue, bins=[-1, 100_000, 500_000, float("inf")], labels=["Light", "Regular", "VIP"]).astype(str)

rev = orders.filter("status = 'completed'").groupBy("user_id").agg(F.sum("total_amount").alias("revenue"))
display(rev.withColumn("tier", tier("revenue")).groupBy("tier").count())
"""),
    md("""
## 면접 포인트
- pandas: 단일 머신·즉시 실행 / Spark: 분산·지연 실행
- 무거운 정제·집계는 Spark에서 → 작아진 결과만 `toPandas()`
- pandas 문법 그대로 분산 처리: `pyspark.pandas` (pandas API on Spark)
- UDF는 내장 함수 → pandas UDF → Python UDF 순으로 고려
"""),
]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, cells in [("01_spark_sql_basics.ipynb", NB1), ("02_delta_lake.ipynb", NB2), ("03_pyspark_vs_pandas.ipynb", NB3)]:
        (OUT / name).write_text(json.dumps(notebook(cells), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print("wrote", OUT / name)


if __name__ == "__main__":
    main()
