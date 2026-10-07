# Jupyter 커널 시작 시 Databricks 비슷한 환경(spark, display, %%sql, dbutils, practice 테이블)을 준비
try:
    import dbx_local

    dbx_local.init_notebook()
except Exception as e:  # noqa: BLE001
    print(f"[dbx-local] 초기화 실패: {e}")
