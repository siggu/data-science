"""Databricks 노트북과 비슷한 로컬 실습 환경.

Jupyter 시작 시 startup 스크립트가 이 모듈을 불러와 다음을 준비합니다.
  - spark        : Delta Lake가 활성화된 SparkSession
  - practice.*   : 웹 플레이그라운드와 같은 샘플 데이터 (Delta 테이블)
  - display(df)  : Spark/pandas DataFrame 표 출력
  - %%sql        : Databricks의 %sql 셀처럼 SQL 실행 (결과는 _sqldf 에 저장)
  - dbutils      : widgets / fs.ls 간이 구현
"""

from __future__ import annotations

import os
from collections import namedtuple

DATA_DIR = os.environ.get("PRACTICE_DATA_DIR", "/data")
WAREHOUSE = os.environ.get("PRACTICE_WAREHOUSE", os.path.expanduser("~/warehouse"))
SCHEMA = "practice"
TABLES = ["users", "events", "orders", "order_items", "products", "ab_test", "employees", "departments"]

_spark = None
DELTA_ENABLED = False


def get_spark():
    """Delta Lake 설정이 된 SparkSession (실패 시 Delta 없이 시작)."""
    global _spark, DELTA_ENABLED
    if _spark is not None:
        return _spark
    from pyspark.sql import SparkSession

    builder = (
        SparkSession.builder.appName("dbx-local")
        .master("local[*]")
        .config("spark.sql.warehouse.dir", WAREHOUSE)
        .config("spark.sql.session.timeZone", "UTC")
        .config("spark.sql.shuffle.partitions", "8")
        .config("spark.driver.memory", os.environ.get("SPARK_DRIVER_MEMORY", "2g"))
        .config("spark.ui.showConsoleProgress", "false")
        .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
        .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.delta.catalog.DeltaCatalog")
        .config("spark.databricks.delta.retentionDurationCheck.enabled", "false")
        .config("spark.sql.sources.default", "delta")  # Databricks처럼 CREATE TABLE 기본 포맷 = Delta
    )
    try:
        from delta import configure_spark_with_delta_pip

        _spark = configure_spark_with_delta_pip(builder).getOrCreate()
        DELTA_ENABLED = True
    except Exception as e:  # noqa: BLE001 - Delta jar를 못 받는 환경에서도 Spark는 쓸 수 있게
        print(f"[dbx-local] Delta Lake를 활성화하지 못했습니다 ({e}). Parquet 테이블로 대체합니다.")
        from pyspark.sql import SparkSession as S

        _spark = (S.builder.appName("dbx-local").master("local[*]")
                  .config("spark.sql.warehouse.dir", WAREHOUSE)
                  .config("spark.sql.session.timeZone", "UTC").getOrCreate())
    _spark.sparkContext.setLogLevel("ERROR")
    return _spark


def setup_practice_tables(spark=None, data_dir: str = DATA_DIR, force: bool = False) -> list[str]:
    """CSV → Delta 테이블 (practice 스키마). 이미 있으면 기존 테이블(변경 이력 포함)을 그대로 등록만 합니다."""
    spark = spark or get_spark()
    fmt = "delta" if DELTA_ENABLED else "parquet"
    spark.sql(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}")
    created = []
    for name in TABLES:
        src = os.path.join(data_dir, f"{name}.csv")
        path = os.path.join(WAREHOUSE, SCHEMA, name)
        exists = os.path.exists(os.path.join(path, "_delta_log" if DELTA_ENABLED else "_SUCCESS"))
        if not os.path.exists(src) and not exists:
            continue
        if force or not exists:
            df = (spark.read.option("header", True).option("inferSchema", True)
                  .option("timestampFormat", "yyyy-MM-dd HH:mm:ss").csv(src))
            df.write.format(fmt).mode("overwrite").option("overwriteSchema", "true").save(path)
            created.append(name)
        spark.sql(f"CREATE TABLE IF NOT EXISTS {SCHEMA}.{name} USING {fmt} LOCATION '{path}'")
    spark.sql(f"USE {SCHEMA}")
    return created


def reset_practice_tables() -> None:
    """실습으로 바꾼 테이블을 원본 CSV 상태로 되돌립니다."""
    spark = get_spark()
    for name in TABLES:
        spark.sql(f"DROP TABLE IF EXISTS {SCHEMA}.{name}")
    setup_practice_tables(spark, force=True)
    print("practice 테이블을 초기화했습니다.")


def display(obj=None, n: int = 100):
    """Databricks display() 흉내: Spark DataFrame은 상위 n행을 pandas로 변환해 표로 출력."""
    from IPython.display import display as ipy_display

    if obj is None:
        return
    try:
        from pyspark.sql import DataFrame as SparkDF
    except ImportError:  # pragma: no cover
        SparkDF = ()
    if isinstance(obj, SparkDF):
        pdf = obj.limit(n).toPandas()
        ipy_display(pdf)
        if len(pdf) == n:
            print(f"(상위 {n}행만 표시)")
    else:
        ipy_display(obj)


# ---------- dbutils 간이 구현 ----------
FileInfo = namedtuple("FileInfo", "path name size")


class _Widgets:
    def __init__(self):
        self._values: dict[str, str] = {}

    def text(self, name, defaultValue="", label=None):
        self._values.setdefault(name, defaultValue)

    def dropdown(self, name, defaultValue, choices, label=None):
        if defaultValue not in choices:
            raise ValueError("defaultValue는 choices 안에 있어야 합니다")
        self._values.setdefault(name, defaultValue)

    combobox = dropdown

    def get(self, name):
        if name not in self._values:
            raise ValueError(f"위젯 '{name}'이(가) 없습니다")
        return self._values[name]

    getArgument = get

    def set(self, name, value):  # 로컬 전용: 값 바꾸기
        self._values[name] = str(value)

    def remove(self, name):
        self._values.pop(name, None)

    def removeAll(self):
        self._values.clear()


class _Fs:
    def ls(self, path):
        path = path.replace("dbfs:", "")
        return [FileInfo(os.path.join(path, f), f + ("/" if os.path.isdir(os.path.join(path, f)) else ""),
                         os.path.getsize(os.path.join(path, f))) for f in sorted(os.listdir(path))]

    def head(self, path, maxBytes=65536):
        with open(path.replace("dbfs:", ""), encoding="utf-8") as f:
            return f.read(maxBytes)


class _DBUtils:
    widgets = _Widgets()
    fs = _Fs()

    def help(self):
        print("로컬 dbutils: widgets.text/dropdown/get/set/removeAll, fs.ls/head")


dbutils = _DBUtils()


def _split_sql(text: str) -> list[str]:
    """세미콜론으로 문장 분리 (작은따옴표 문자열과 -- 주석 안의 ; 는 무시)."""
    out, buf, in_str, i = [], [], False, 0
    while i < len(text):
        ch = text[i]
        if not in_str and text.startswith("--", i):
            j = text.find("\n", i)
            j = len(text) if j == -1 else j
            buf.append(text[i:j])
            i = j
            continue
        if ch == "'":
            in_str = not in_str
        if ch == ";" and not in_str:
            out.append("".join(buf))
            buf = []
        else:
            buf.append(ch)
        i += 1
    out.append("".join(buf))
    return [s for s in out if s.strip() and not all(line.strip().startswith("--") or not line.strip() for line in s.splitlines())]


def register_magics(ip=None) -> None:
    from IPython import get_ipython
    from IPython.core.magic import register_cell_magic

    ip = ip or get_ipython()
    if ip is None:
        return

    @register_cell_magic
    def sql(line, cell):  # noqa: ARG001
        """%%sql — 여러 문장은 ;로 구분, 마지막 결과를 표시하고 _sqldf 에 저장"""
        spark = get_spark()
        df = None
        for stmt in _split_sql(cell):
            df = spark.sql(stmt)
        if df is not None:
            ip.user_ns["_sqldf"] = df
            display(df)


def init_notebook() -> None:
    """Jupyter startup에서 호출."""
    from IPython import get_ipython

    spark = get_spark()
    created = setup_practice_tables(spark)
    register_magics()
    ip = get_ipython()
    if ip is not None:
        ip.user_ns.update({"spark": spark, "display": display, "dbutils": dbutils,
                           "reset_practice_tables": reset_practice_tables})
    mode = "Delta Lake" if DELTA_ENABLED else "Parquet (Delta 비활성)"
    print(f"[dbx-local] Spark {spark.version} · {mode} · 스키마 '{SCHEMA}' 테이블 {len(TABLES)}개 준비"
          + (f" (새로 적재: {', '.join(created)})" if created else ""))
    print("[dbx-local] 사용 가능: spark, display(df), %%sql 셀, dbutils.widgets, reset_practice_tables()")
