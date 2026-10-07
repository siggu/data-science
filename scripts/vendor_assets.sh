#!/usr/bin/env bash
# 외부 CDN 없이(사내망/오프라인) 웹 플레이그라운드를 쓰기 위한 로컬 사본 생성 스크립트.
# npm 레지스트리만 접근 가능하면 됩니다. 결과물은 web/vendor/ (git에는 포함되지 않음)
#
#   bash scripts/vendor_assets.sh
#   python -m http.server 8000 -d web
#   → http://localhost:8000/?vendor=local
#
# 참고: Pyodide 코어는 로컬에서 로드하지만, pandas/numpy 휠은 Pyodide CDN에서 받습니다.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/web/vendor"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

DUCKDB_VER="1.32.0"
PYODIDE_VER="0.29.5"
CM_VER="5.65.16"

echo "→ npm 패키지 설치 (임시 폴더)"
cd "$TMP"
npm init -y >/dev/null
npm install --silent "@duckdb/duckdb-wasm@${DUCKDB_VER}" "pyodide@${PYODIDE_VER}" "codemirror@${CM_VER}" esbuild

rm -rf "$OUT"
mkdir -p "$OUT/duckdb" "$OUT/pyodide" "$OUT/codemirror/mode/sql" "$OUT/codemirror/mode/python"

echo "→ DuckDB-WASM (apache-arrow 포함 ESM 번들)"
D=node_modules/@duckdb/duckdb-wasm/dist
npx esbuild "$D/duckdb-browser.mjs" --bundle --format=esm --log-level=warning --outfile="$OUT/duckdb/duckdb-browser.bundle.mjs"
cp "$D"/duckdb-mvp.wasm "$D"/duckdb-eh.wasm "$D"/duckdb-browser-mvp.worker.js "$D"/duckdb-browser-eh.worker.js "$OUT/duckdb/"

echo "→ Pyodide 코어"
cp node_modules/pyodide/{pyodide.js,pyodide.asm.js,pyodide.asm.wasm,python_stdlib.zip,pyodide-lock.json} "$OUT/pyodide/" 2>/dev/null || \
  cp node_modules/pyodide/{pyodide.js,pyodide.asm.mjs,pyodide.asm.wasm,python_stdlib.zip,pyodide-lock.json} "$OUT/pyodide/"

echo "→ CodeMirror 5 (minify)"
C=node_modules/codemirror
npx esbuild "$C/lib/codemirror.js" --minify --log-level=warning --outfile="$OUT/codemirror/codemirror.min.js"
npx esbuild "$C/lib/codemirror.css" --minify --log-level=warning --outfile="$OUT/codemirror/codemirror.min.css"
npx esbuild "$C/mode/sql/sql.js" --minify --log-level=warning --outfile="$OUT/codemirror/mode/sql/sql.min.js"
npx esbuild "$C/mode/python/python.js" --minify --log-level=warning --outfile="$OUT/codemirror/mode/python/python.min.js"
# 에디터 편의 기능 애드온 (web/assets/js/editor.js 의 CM_ADDONS 와 같은 목록)
for f in edit/matchbrackets edit/closebrackets comment/comment selection/active-line hint/show-hint; do
  mkdir -p "$OUT/codemirror/addon/$(dirname "$f")"
  npx esbuild "$C/addon/$f.js" --minify --log-level=warning --outfile="$OUT/codemirror/addon/$f.min.js"
done
npx esbuild "$C/addon/hint/show-hint.css" --minify --log-level=warning --outfile="$OUT/codemirror/addon/hint/show-hint.min.css"

du -sh "$OUT"
echo "완료: http://localhost:8000/?vendor=local 로 접속하세요 (python -m http.server 8000 -d web)"
