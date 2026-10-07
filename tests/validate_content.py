"""콘텐츠 검증: 문제 정답이 실제로 실행되는지, SQL 풀이와 pandas 풀이의 결과가 같은지 확인합니다.

    pip install duckdb pandas
    python tests/validate_content.py

- SQL 정답은 DuckDB(Python)로, pandas 정답은 브라우저와 같은 runtime.py로 실행합니다.
- 웹에서 쓰는 Databricks 호환 매크로(compat.js)도 그대로 적용합니다.
- 면접 질문의 practice 링크가 실제 문제 id를 가리키는지도 확인합니다.
"""

from __future__ import annotations

import asyncio
import json
import re
import subprocess
import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
sys.path.insert(0, str(WEB / "assets" / "py"))
import runtime  # noqa: E402


def load_js_exports() -> dict:
    script = """
const load = (p) => import(new URL(p, 'file://' + process.argv[1] + '/'));
const [probs, iv, compat, cases, dbx, certs, config, ref] = await Promise.all([
  load('assets/js/data/problems.js'), load('assets/js/data/interview.js'), load('assets/js/compat.js'),
  load('assets/js/data/cases.js'), load('assets/js/data/databricks.js'), load('assets/js/data/certs.js'),
  load('assets/js/config.js'), load('assets/js/data/reference.js'),
]);
console.log(JSON.stringify({
  problems: probs.PROBLEMS, questions: iv.QUESTIONS, categories: iv.CATEGORIES, macros: compat.COMPAT_MACROS,
  cases: cases.CASES, quiz: dbx.QUIZ, certs: certs.CERTS, tables: config.TABLES, ref: ref.REF_LANGS, checks: cases.CASES.flatMap((c) => c.dataCheck ? [c.dataCheck] : []),
}));
"""
    out = subprocess.run(["node", "--input-type=module", "-e", script, str(WEB)],
                         capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def make_duckdb(macros: list[str]) -> duckdb.DuckDBPyConnection:
    con = duckdb.connect()
    for name in runtime.TABLE_SPECS:
        con.execute(f"CREATE TABLE {name} AS SELECT * FROM read_csv('{WEB / 'data' / name}.csv', header=true, auto_detect=true)")
    for m in macros:
        con.execute(m)
    return con


def sql_tables(sql: str, known: set[str]) -> set[str]:
    """SQL에서 FROM/JOIN 으로 참조한 샘플 테이블 (CTE 이름 제외)"""
    ctes = {m.lower() for m in re.findall(r"(?:\bWITH\s+(?:RECURSIVE\s+)?|,\s*)([A-Za-z_]\w*)\s+AS\s*\(", sql, re.I)}
    refs = {m.lower() for m in re.findall(r"\b(?:FROM|JOIN)\s+([A-Za-z_]\w*)", sql, re.I)}
    return (refs - ctes) & known


def py_tables(code: str, known: set[str]) -> set[str]:
    """pandas 코드에서 변수로 참조한 샘플 테이블 (문자열 리터럴, 속성 접근 제외)"""
    stripped = re.sub(r"(\"[^\"]*\"|'[^']*')", "''", code)
    # 키워드 인자(users=...)는 제외, 비교(users == ...)는 포함
    return {m for m in re.findall(r"(?<![\w.])([A-Za-z_]\w*)\b(?!\s*=(?!=))", stripped) if m in known}


def run_py(src: str):
    ns = runtime.fresh_namespace()
    res = asyncio.run(runtime.run_cell(src, ns))
    if res["error"]:
        raise RuntimeError(res["error"])
    if "result" not in ns:
        raise RuntimeError("result 변수가 없습니다")
    return ns["result"]


def main() -> int:
    data = load_js_exports()
    runtime.load_tables(str(WEB / "data"))
    con = make_duckdb(data["macros"])
    failures: list[str] = []
    ids = set()

    for p in data["problems"]:
        pid = p["id"]
        if pid in ids:
            failures.append(f"{pid}: 중복 id")
        ids.add(pid)
        try:
            if p["lang"] == "sql":
                main_df = con.execute(p["solution"]).fetchdf()
                other_src, other_kind = p.get("pandasSolution"), "pandas"
                other = run_py(other_src) if other_src else None
            else:
                main_df = run_py(p["solution"])
                other_src, other_kind = p.get("sqlSolution"), "sql"
                other = con.execute(other_src).fetchdf() if other_src else None
            if len(main_df) == 0:
                failures.append(f"{pid}: 정답 결과가 비어 있음")
            if other is not None:
                verdict = runtime.compare(other, main_df, p["orderMatters"])
                if not verdict["ok"]:
                    failures.append(f"{pid}: {other_kind} 풀이 결과 불일치 — {verdict['reason']} {verdict.get('detail', '')}")
            print(f"  ok  {pid:<7} {p['lang']:<6} rows={len(main_df):<5} {'(+' + other_kind + ')' if other is not None else ''}")
        except Exception as e:  # noqa: BLE001
            failures.append(f"{pid}: 실행 오류 — {e}")

    # 채점기 자체 검증: 정답을 그대로 제출하면 통과, 엉뚱한 답이면 실패해야 함
    pd_prob = next(p for p in data["problems"] if p["lang"] == "pandas")
    ok = asyncio.run(runtime.grade(pd_prob["solution"], pd_prob["solution"], pd_prob["orderMatters"]))
    bad = asyncio.run(runtime.grade("result = users.head(1)", pd_prob["solution"], pd_prob["orderMatters"]))
    if not ok["ok"] or bad["ok"]:
        failures.append("grade(): 채점 로직 이상")

    # 샘플 테이블 컬럼 정의가 실제 CSV 헤더와 같은지
    known = {t["name"] for t in data["tables"]}
    for t in data["tables"]:
        header = (WEB / "data" / f"{t['name']}.csv").read_text(encoding="utf-8").splitlines()[0].split(",")
        if header != t["columns"]:
            failures.append(f"config.TABLES['{t['name']}'] 컬럼이 CSV 헤더와 다름: {header}")

    # 문제에 표기한 사용 테이블 = 정답 풀이(SQL/pandas)가 실제로 쓰는 테이블
    for p in data["problems"]:
        declared = set(p.get("tables") or [])
        if not declared:
            failures.append(f"{p['id']}: 사용 테이블(tables) 표기 없음")
            continue
        if declared - known:
            failures.append(f"{p['id']}: 존재하지 않는 테이블 {declared - known}")
        for kind, src in (("solution", p["solution"]), ("pandasSolution", p.get("pandasSolution")), ("sqlSolution", p.get("sqlSolution"))):
            if not src:
                continue
            is_sql = (kind == "solution" and p["lang"] == "sql") or kind == "sqlSolution"
            used = sql_tables(src, known) if is_sql else py_tables(src, known)
            if used != declared:
                failures.append(f"{p['id']}: 표기 테이블 {sorted(declared)} ≠ {kind}에서 쓰는 테이블 {sorted(used)}")

    cats = {c["id"] for c in data["categories"]}
    for q in data["questions"]:
        if q["cat"] not in cats:
            failures.append(f"{q['id']}: 알 수 없는 카테고리 {q['cat']}")
        if q.get("practice") and q["practice"] not in ids:
            failures.append(f"{q['id']}: practice 링크 {q['practice']} 가 존재하지 않음")
        if not q.get("keyPoints"):
            failures.append(f"{q['id']}: keyPoints 없음")
        for p in q.get("pitfalls") or []:
            if not (isinstance(p, dict) and p.get("text") and p.get("fix")):
                failures.append(f"{q['id']}: 흔한 실수에 짧은 답(fix)이 없음 — {p}")
        for f in q.get("followups") or []:
            if not (isinstance(f, dict) and f.get("q") and f.get("a")):
                failures.append(f"{q['id']}: 꼬리 질문에 짧은 답(a)이 없음 — {f}")
    if len({q["id"] for q in data["questions"]}) != len(data["questions"]):
        failures.append("면접 질문 id 중복")

    for sql in data["checks"]:
        try:
            con.execute(sql).fetchall()
        except Exception as e:  # noqa: BLE001
            failures.append(f"케이스 데이터 검증 SQL 오류: {e}\n{sql}")
    for q in data["quiz"]:
        if not (0 <= q["answer"] < len(q["options"])):
            failures.append(f"퀴즈 정답 인덱스 오류: {q['q'][:30]}")

    # 자격증: 정답 인덱스, id 중복, 과목 비중만큼 문제가 있는지 (실전 모의고사가 실제 시험 비중으로 구성되도록)
    for cert in data["certs"]:
        qids = [q["id"] for q in cert["questions"]]
        if len(set(qids)) != len(qids):
            failures.append(f"{cert['id']}: 문제 id 중복")
        if sum(s["count"] for s in cert["subjects"]) != cert["format"]["questions"]:
            failures.append(f"{cert['id']}: 과목별 문항 수 합계가 시험 문항 수와 다름")
        for si, subj in enumerate(cert["subjects"]):
            n = sum(1 for q in cert["questions"] if q["subject"] == si)
            if n < subj["count"]:
                failures.append(f"{cert['id']}: '{subj['name']}' 문제 {n}개 < 시험 문항 {subj['count']}개")
        for q in cert["questions"]:
            if len(q["options"]) != 4 or not (0 <= q["answer"] < 4) or not q.get("explain"):
                failures.append(f"{q['id']}: 보기 4개/정답 인덱스/해설 확인 필요")
            if len(set(q["options"])) != 4:
                failures.append(f"{q['id']}: 중복된 보기")
        for s_ in cert["schedule"]:
            import re
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", s_["exam"]):
                failures.append(f"{cert['id']} {s_['round']}: 시험일 형식 오류")

    # 문법 레퍼런스: 필수 필드, id 중복, 단원(group) 연속 배치, 관련 문제 링크, 모든 예제 실행
    n_ref = n_ex = 0
    for lang in data["ref"]:
        seen, groups = set(), []
        for it in lang["items"]:
            n_ref += 1
            rid = f"ref:{lang['id']}:{it.get('id')}"
            for key in ("id", "tier", "group", "title", "summary", "body", "syntax", "examples"):
                if not it.get(key):
                    failures.append(f"{rid}: {key} 없음")
            if it.get("tier") not in ("core", "appendix"):
                failures.append(f"{rid}: tier는 core/appendix")
            if it.get("id") in seen:
                failures.append(f"{rid}: id 중복")
            seen.add(it.get("id"))
            key = (it.get("tier"), it.get("group"))
            if groups and groups[-1] != key and key in groups:
                failures.append(f"{rid}: 같은 단원({it.get('group')}) 항목이 떨어져 있음")
            if not groups or groups[-1] != key:
                groups.append(key)
            for r in it.get("related") or []:
                if r not in ids:
                    failures.append(f"{rid}: related 문제 {r} 없음")
            for ex in it.get("examples") or []:
                n_ex += 1
                try:
                    if lang["id"] == "sql":
                        con.execute(ex["code"]).fetchall()
                    else:
                        res = asyncio.run(runtime.run_cell(ex["code"], runtime.fresh_namespace()))
                        if res["error"]:
                            raise RuntimeError(res["error"].strip().splitlines()[-1])
                except Exception as e:  # noqa: BLE001
                    failures.append(f"{rid} 예제 '{ex.get('title')}' 실행 오류: {e}")
        if [t for t, _ in groups] != sorted([t for t, _ in groups], key=lambda t: t != "core"):
            failures.append(f"ref:{lang['id']}: core 항목이 appendix보다 앞에 와야 함")
    print(f"문법 레퍼런스 {n_ref}개 항목 · 예제 {n_ex}개 실행")

    print(f"\n문제 {len(data['problems'])}개 · 면접 질문 {len(data['questions'])}개 · 케이스 {len(data['cases'])}개 · 퀴즈 {len(data['quiz'])}개 · 자격증 문제 {sum(len(c['questions']) for c in data['certs'])}개")
    if failures:
        print("\nFAILED:")
        for f in failures:
            print(" -", f)
        return 1
    print("모든 검증 통과")
    return 0


if __name__ == "__main__":
    sys.exit(main())
