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
const [probs, iv, compat, cases, dbx, certs] = await Promise.all([
  load('assets/js/data/problems.js'), load('assets/js/data/interview.js'), load('assets/js/compat.js'),
  load('assets/js/data/cases.js'), load('assets/js/data/databricks.js'), load('assets/js/data/certs.js'),
]);
console.log(JSON.stringify({
  problems: probs.PROBLEMS, questions: iv.QUESTIONS, categories: iv.CATEGORIES, macros: compat.COMPAT_MACROS,
  cases: cases.CASES, quiz: dbx.QUIZ, certs: certs.CERTS, checks: cases.CASES.flatMap((c) => c.dataCheck ? [c.dataCheck] : []),
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
