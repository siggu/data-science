"""브라우저(Pyodide) pandas 실행 런타임.

웹 페이지가 이 파일을 Pyodide에 로드해서 사용합니다. CPython에서도 그대로 import 되도록
작성되어 있어 tests/ 에서 동일한 코드로 채점 로직을 검증합니다.
"""

from __future__ import annotations

import ast
import contextlib
import datetime as _dt
import inspect
import io
import json
import math
import traceback

import numpy as np
import pandas as pd

pd.set_option("display.width", 140)
pd.set_option("display.max_columns", 40)

# 테이블별 날짜 컬럼 / nullable 정수 컬럼
TABLE_SPECS = {
    "users": {"dates": ["signup_date"]},
    "events": {"dates": ["event_ts"], "ints": ["product_id"]},
    "orders": {"dates": ["order_ts"]},
    "order_items": {},
    "products": {},
    "ab_test": {"dates": ["assigned_date"]},
    "employees": {"dates": ["hire_date"], "ints": ["dept_id", "manager_id"]},
    "departments": {},
}

BASE: dict[str, pd.DataFrame] = {}
G: dict = {}
_displays: list = []


def load_table(name: str, source) -> pd.DataFrame:
    spec = TABLE_SPECS.get(name, {})
    dtypes = {c: "Int64" for c in spec.get("ints", [])}
    return pd.read_csv(source, parse_dates=spec.get("dates") or False, dtype=dtypes or None)


def load_tables(base_dir: str = "/data") -> None:
    for name in TABLE_SPECS:
        BASE[name] = load_table(name, f"{base_dir}/{name}.csv")
    reset_namespace()


def fresh_namespace() -> dict:
    ns = {"pd": pd, "np": np, "display": display, "sql": sql, "to_sql": to_sql, "__name__": "__main__"}
    for k, v in BASE.items():
        ns[k] = v.copy()
    return ns


def reset_namespace() -> None:
    G.clear()
    G.update(fresh_namespace())


def register_table(name: str, csv_text: str) -> str:
    """업로드한 CSV를 DataFrame으로 등록"""
    df = pd.read_csv(io.StringIO(csv_text))
    BASE[name] = df
    G[name] = df.copy()
    return f"{name}: {df.shape[0]} rows x {df.shape[1]} cols"


# ---------- 값/프레임 직렬화 ----------
def _jsonable(v):
    if v is None or v is pd.NA or v is pd.NaT:
        return None
    if isinstance(v, (bool, np.bool_)):
        return bool(v)
    if isinstance(v, (int, np.integer)):
        return int(v)
    if isinstance(v, (float, np.floating)):
        f = float(v)
        if math.isnan(f):
            return None
        if math.isinf(f):
            return str(f)
        return f
    if isinstance(v, pd.Timestamp):
        if v.tz is None and v == v.normalize():
            return v.strftime("%Y-%m-%d")
        return v.strftime("%Y-%m-%d %H:%M:%S")
    if isinstance(v, _dt.datetime):
        return v.strftime("%Y-%m-%d %H:%M:%S")
    if isinstance(v, _dt.date):
        return v.isoformat()
    if isinstance(v, (pd.Timedelta, _dt.timedelta)):
        return str(v)
    if isinstance(v, pd.Period):
        return str(v)
    return str(v)


def _label(x) -> str:
    if isinstance(x, tuple):
        return " / ".join(str(p) for p in x if str(p) != "")
    return str(x)


def frame_payload(obj, limit: int = 500) -> dict:
    df = obj.to_frame(name=obj.name if obj.name is not None else 0) if isinstance(obj, pd.Series) else obj
    show_index = not (isinstance(df.index, pd.RangeIndex) and df.index.start == 0 and df.index.step == 1)
    head = df.head(limit)
    payload = {
        "type": "table",
        "columns": [{"name": _label(c), "type": str(t)} for c, t in zip(df.columns, df.dtypes)],
        "rows": [[_jsonable(v) for v in row] for row in head.itertuples(index=False, name=None)],
        "totalRows": int(len(df)),
    }
    if show_index:
        payload["index"] = [_label(_jsonable(i) if not isinstance(i, tuple) else tuple(_jsonable(p) for p in i))
                            for i in head.index]
        payload["indexName"] = _label(df.index.names if df.index.nlevels > 1 else (df.index.name or ""))
    return payload


def value_payload(v):
    if v is None:
        return None
    if isinstance(v, (pd.DataFrame, pd.Series)):
        return frame_payload(v)
    if isinstance(v, pd.Index):
        return frame_payload(v.to_series(index=range(len(v)), name=v.name or "index"))
    if hasattr(v, "_repr_html_") and hasattr(v, "data") and isinstance(getattr(v, "data"), pd.DataFrame):
        return frame_payload(v.data)  # Styler
    return {"type": "text", "text": repr(v)}


def display(*objs) -> None:
    for o in objs:
        p = value_payload(o)
        if p is not None:
            _displays.append(p)


# ---------- DuckDB 브리지 (브라우저에서만 동작) ----------
async def sql(query: str) -> pd.DataFrame:
    """DuckDB(브라우저 SQL 엔진)에 쿼리를 보내 결과를 DataFrame으로 받습니다.

        df = await sql("SELECT * FROM users LIMIT 5")
    """
    try:
        from dsbridge import run_sql  # type: ignore  # Pyodide에서 JS가 등록한 모듈
    except ImportError as e:  # pragma: no cover - CPython 테스트 환경
        raise RuntimeError("sql()은 브라우저 플레이그라운드에서만 사용할 수 있습니다.") from e
    res = json.loads(await run_sql(query))
    if res.get("error"):
        raise RuntimeError(res["error"])
    df = pd.DataFrame(res["rows"], columns=[c["name"] for c in res["columns"]])
    for c in res["columns"]:
        t = c["type"].upper()
        if t.startswith("TIMESTAMP") or t == "DATE":
            df[c["name"]] = pd.to_datetime(df[c["name"]])
    return df


async def to_sql(df: pd.DataFrame, name: str) -> str:
    """DataFrame을 DuckDB 테이블로 등록 → SQL 탭에서 바로 조회 가능

        await to_sql(my_df, "my_table")
    """
    try:
        from dsbridge import register_csv  # type: ignore
    except ImportError as e:  # pragma: no cover
        raise RuntimeError("to_sql()은 브라우저 플레이그라운드에서만 사용할 수 있습니다.") from e
    out = df.reset_index() if not isinstance(df.index, pd.RangeIndex) else df
    msg = await register_csv(name, out.to_csv(index=False))
    return str(msg)


# ---------- 셀 실행 ----------
_FLAGS = ast.PyCF_ALLOW_TOP_LEVEL_AWAIT


def _format_error(e: BaseException) -> str:
    if isinstance(e, SyntaxError):
        return f"SyntaxError: {e.msg} (line {e.lineno})\n{(e.text or '').rstrip()}"
    frames = [f for f in traceback.extract_tb(e.__traceback__) if f.filename == "<cell>"]
    where = f" (line {frames[-1].lineno})" if frames else ""
    return f"{type(e).__name__}{where}: {e}"


async def run_cell(src: str, ns: dict | None = None) -> dict:
    """Jupyter처럼 마지막 표현식의 값을 결과로 돌려줍니다."""
    ns = G if ns is None else ns
    _displays.clear()
    out = io.StringIO()
    result, error = None, None
    try:
        with contextlib.redirect_stdout(out):
            tree = ast.parse(src, "<cell>", "exec")
            last = None
            if tree.body and isinstance(tree.body[-1], ast.Expr):
                last = ast.Expression(tree.body.pop().value)
            r = eval(compile(tree, "<cell>", "exec", flags=_FLAGS), ns)
            if inspect.iscoroutine(r):
                await r
            if last is not None:
                v = eval(compile(last, "<cell>", "eval", flags=_FLAGS), ns)
                if inspect.iscoroutine(v):
                    v = await v
                result = value_payload(v)
    except BaseException as e:  # noqa: BLE001 - 사용자 코드의 모든 오류를 표시
        error = _format_error(e)
    return {"stdout": out.getvalue(), "displays": list(_displays), "result": result, "error": error}


async def run_cell_json(src: str) -> str:
    return json.dumps(await run_cell(src), ensure_ascii=False)


# ---------- 채점 ----------
def _norm_value(v):
    v = _jsonable(v)
    if isinstance(v, bool):
        return int(v)
    if isinstance(v, float):
        x = round(v, 4)
        if x == 0:
            return 0
        return int(x) if x.is_integer() else x
    return v


def normalize(obj) -> tuple[list[str], int]:
    """채점용 정규화. 컬럼 이름은 무시하고 값만 비교합니다.

    - 이름 없는 정수 인덱스는 위치 인덱스로 보고 버립니다 (정렬/필터 후 남은 라벨)
    - 이름이 있거나 문자열/날짜 인덱스(groupby 키 등)는 컬럼으로 풀어 비교합니다
    """
    if isinstance(obj, pd.Series):
        obj = obj.to_frame()
    if not isinstance(obj, pd.DataFrame):
        obj = pd.DataFrame([[obj]])
    df = obj
    idx = df.index
    positional = idx.nlevels == 1 and idx.name is None and pd.api.types.is_integer_dtype(idx.dtype)
    if not positional:
        df = df.reset_index()
    rows = [json.dumps([_norm_value(v) for v in r], ensure_ascii=False, default=str)
            for r in df.itertuples(index=False, name=None)]
    return rows, df.shape[1]


def compare(user, expected, order_matters: bool) -> dict:
    a, ac = normalize(user)
    b, bc = normalize(expected)
    if ac != bc:
        return {"ok": False, "reason": f"컬럼 수가 다릅니다. (내 결과 {ac}개 / 정답 {bc}개)"}
    if len(a) != len(b):
        return {"ok": False, "reason": f"행 수가 다릅니다. (내 결과 {len(a)}행 / 정답 {len(b)}행)"}
    if not order_matters:
        a, b = sorted(a), sorted(b)
    for i, (x, y) in enumerate(zip(a, b)):
        if x != y:
            where = f"{i + 1}번째 행" if order_matters else "일부 행"
            return {"ok": False, "reason": f"{where}의 값이 다릅니다." + (" (정렬 순서도 채점 대상입니다)" if order_matters else ""),
                    "detail": {"mine": x, "answer": y}}
    return {"ok": True}


async def grade(user_src: str, solution_src: str, order_matters: bool) -> dict:
    ns_user, ns_sol = fresh_namespace(), fresh_namespace()
    run = await run_cell(user_src, ns_user)
    if run["error"]:
        return {"ok": False, "reason": "코드 실행 중 오류가 발생했습니다.", "run": run}
    if "result" not in ns_user:
        return {"ok": False, "reason": "`result` 변수에 최종 결과를 담아주세요.", "run": run}
    sol = await run_cell(solution_src, ns_sol)
    if sol["error"] or "result" not in ns_sol:  # pragma: no cover - 문제 데이터 오류
        return {"ok": False, "reason": f"정답 코드 오류: {sol['error']}", "run": run}
    verdict = compare(ns_user["result"], ns_sol["result"], order_matters)
    verdict["run"] = run
    verdict["expected"] = frame_payload(ns_sol["result"]) if isinstance(ns_sol["result"], (pd.DataFrame, pd.Series)) \
        else value_payload(ns_sol["result"])
    return verdict


async def grade_json(user_src: str, solution_src: str, order_matters: bool) -> str:
    return json.dumps(await grade(user_src, solution_src, bool(order_matters)), ensure_ascii=False)
