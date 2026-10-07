// 브라우저 안에서 동작하는 두 개의 실행 엔진
//  - DuckDB-WASM : SQL (Databricks SQL과 문법이 가장 가까운 임베디드 엔진)
//  - Pyodide     : 실제 CPython + pandas

import { LIBS, TABLES } from './config.js';
import { COMPAT_MACROS } from './compat.js';

const DATA_BASE = new URL('../../data/', import.meta.url).href;
const RUNTIME_PY = new URL('../py/runtime.py', import.meta.url).href;

// ---------- 상태 브로드캐스트 ----------
const listeners = new Set();
export const engineState = { duckdb: 'idle', pyodide: 'idle', duckdbMsg: '', pyodideMsg: '' };
function setState(patch) {
  Object.assign(engineState, patch);
  listeners.forEach((fn) => fn(engineState));
}
export function onEngineState(fn) {
  listeners.add(fn);
  fn(engineState);
  return () => listeners.delete(fn);
}

// CSV 텍스트 캐시 (DuckDB와 Pyodide가 공유)
const csvCache = new Map();
async function fetchCsv(name) {
  if (!csvCache.has(name)) {
    csvCache.set(name, fetch(DATA_BASE + name + '.csv').then((r) => {
      if (!r.ok) throw new Error(`${name}.csv 로드 실패 (${r.status})`);
      return r.text();
    }));
  }
  return csvCache.get(name);
}

// ---------- DuckDB ----------
let duckPromise = null;
let duckConn = null;
let duckDb = null;


export function getDuckDB() {
  if (duckPromise) return duckPromise;
  duckPromise = (async () => {
    setState({ duckdb: 'loading', duckdbMsg: 'DuckDB-WASM 로딩 중…' });
    const duckdb = await import(/* @vite-ignore */ LIBS.duckdbModule);
    const base = LIBS.duckdbDist;
    const bundle = await duckdb.selectBundle({
      mvp: { mainModule: base + 'duckdb-mvp.wasm', mainWorker: base + 'duckdb-browser-mvp.worker.js' },
      eh: { mainModule: base + 'duckdb-eh.wasm', mainWorker: base + 'duckdb-browser-eh.worker.js' },
    });
    const workerUrl = URL.createObjectURL(new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' }));
    const worker = new Worker(workerUrl);
    const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    URL.revokeObjectURL(workerUrl);
    await db.open({ query: { castDecimalToDouble: true } });
    const conn = await db.connect();
    duckDb = db;
    duckConn = conn;
    setState({ duckdbMsg: '샘플 테이블 적재 중…' });
    await Promise.all(TABLES.map(async (t) => {
      const text = await fetchCsv(t.name);
      await db.registerFileText(`${t.name}.csv`, text);
    }));
    for (const t of TABLES) {
      await conn.query(`CREATE OR REPLACE TABLE ${t.name} AS SELECT * FROM read_csv('${t.name}.csv', header = true, auto_detect = true)`);
    }
    for (const m of COMPAT_MACROS) {
      try { await conn.query(m); } catch (e) { console.warn('macro skipped:', m, e.message); }
    }
    setState({ duckdb: 'ready', duckdbMsg: 'SQL 엔진 준비 완료' });
    return conn;
  })().catch((e) => {
    duckPromise = null;
    setState({ duckdb: 'error', duckdbMsg: `SQL 엔진 로드 실패: ${e.message}` });
    throw e;
  });
  return duckPromise;
}

function arrowValue(v, typeStr) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'bigint') return Number(v);
  if (/^Timestamp/i.test(typeStr) && typeof v === 'number') {
    return new Date(v).toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
  }
  if (/^Date/i.test(typeStr) && (typeof v === 'number' || v instanceof Date)) {
    return new Date(v).toISOString().slice(0, 10);
  }
  if (v instanceof Date) return v.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
  if (typeof v === 'object') {
    if (typeof v.toJSON === 'function') return JSON.stringify(v.toJSON());
    if (typeof v.toArray === 'function') return JSON.stringify(Array.from(v.toArray(), (x) => (typeof x === 'bigint' ? Number(x) : x)));
    return String(v);
  }
  return v;
}

function duckType(arrowType) {
  const s = String(arrowType);
  if (/^Timestamp/.test(s)) return 'TIMESTAMP';
  if (/^Date/.test(s)) return 'DATE';
  if (/^Float/.test(s)) return 'DOUBLE';
  if (/^U?Int/.test(s)) return 'BIGINT';
  if (/^Utf8|^LargeUtf8/.test(s)) return 'VARCHAR';
  if (/^Bool/.test(s)) return 'BOOLEAN';
  if (/^Decimal/.test(s)) return 'DECIMAL';
  if (/^List/.test(s)) return 'LIST';
  if (/^Struct/.test(s)) return 'STRUCT';
  return s.toUpperCase();
}

/** SQL 실행 → {columns:[{name,type}], rows:[[...]], elapsed} */
export async function runSQL(sql) {
  const conn = await getDuckDB();
  const t0 = performance.now();
  const table = await conn.query(sql);
  const elapsed = performance.now() - t0;
  const fields = table.schema.fields;
  const columns = fields.map((f) => ({ name: f.name, type: duckType(f.type), arrowType: String(f.type) }));
  const cols = fields.map((f, i) => table.getChildAt(i));
  const rows = [];
  for (let r = 0; r < table.numRows; r++) {
    rows.push(cols.map((c, i) => arrowValue(c.get(r), columns[i].arrowType)));
  }
  return { columns, rows, elapsed };
}

export async function listSchema() {
  const res = await runSQL(`SELECT table_name, column_name, data_type FROM information_schema.columns
    WHERE table_schema = 'main' ORDER BY table_name, ordinal_position`);
  const counts = await runSQL(TABLES.map((t) => `SELECT '${t.name}' AS t, count(*) AS n FROM ${t.name}`).join(' UNION ALL '));
  const n = Object.fromEntries(counts.rows.map((r) => [r[0], r[1]]));
  const map = new Map();
  for (const [t, c, ty] of res.rows) {
    if (!map.has(t)) map.set(t, { name: t, rows: n[t], columns: [] });
    map.get(t).columns.push({ name: c, type: ty });
  }
  return [...map.values()];
}

/** 업로드 CSV를 DuckDB 테이블로 등록 */
export async function registerCsvInDuckDB(name, text) {
  const conn = await getDuckDB();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error('테이블 이름은 영문/숫자/_ 만 사용할 수 있습니다.');
  await duckDb.registerFileText(`${name}__upload.csv`, text);
  await conn.query(`CREATE OR REPLACE TABLE ${name} AS SELECT * FROM read_csv('${name}__upload.csv', header = true, auto_detect = true)`);
  const r = await runSQL(`SELECT count(*) FROM ${name}`);
  return `${name}: ${r.rows[0][0]} rows`;
}

// ---------- Pyodide ----------
let pyPromise = null;
export function getPyodide() {
  if (pyPromise) return pyPromise;
  pyPromise = (async () => {
    setState({ pyodide: 'loading', pyodideMsg: 'Python(Pyodide) 로딩 중… (최초 1회 약 10~20초)' });
    if (!window.loadPyodide) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = LIBS.pyodide + 'pyodide.js';
        s.onload = resolve;
        s.onerror = () => reject(new Error('pyodide.js 로드 실패'));
        document.head.append(s);
      });
    }
    const opts = { indexURL: LIBS.pyodide };
    if (LIBS.pyodidePackages) opts.packageBaseUrl = LIBS.pyodidePackages;
    const py = await window.loadPyodide(opts);
    setState({ pyodideMsg: 'pandas 설치 중…' });
    await py.loadPackage(['pandas']);
    setState({ pyodideMsg: '샘플 데이터 적재 중…' });
    py.FS.mkdirTree('/data');
    await Promise.all(TABLES.map(async (t) => py.FS.writeFile(`/data/${t.name}.csv`, await fetchCsv(t.name))));
    const runtimeSrc = await (await fetch(RUNTIME_PY)).text();
    py.FS.writeFile('/home/pyodide/dsruntime.py', runtimeSrc);
    py.registerJsModule('dsbridge', {
      run_sql: async (q) => {
        try { return JSON.stringify(await runSQL(q)); } catch (e) { return JSON.stringify({ error: e.message }); }
      },
      register_csv: async (name, text) => registerCsvInDuckDB(name, text),
    });
    await py.runPythonAsync('import sys\nsys.path.insert(0, "/home/pyodide")\nimport dsruntime\ndsruntime.load_tables("/data")');
    setState({ pyodide: 'ready', pyodideMsg: 'pandas 엔진 준비 완료' });
    return py;
  })().catch((e) => {
    pyPromise = null;
    setState({ pyodide: 'error', pyodideMsg: `Python 엔진 로드 실패: ${e.message}` });
    throw e;
  });
  return pyPromise;
}

async function callRuntime(fn, ...args) {
  const py = await getPyodide();
  const rt = py.pyimport('dsruntime');
  try {
    const out = await rt[fn](...args);
    return JSON.parse(out);
  } finally {
    rt.destroy();
  }
}

/** pandas 코드 실행 → {stdout, displays, result, error} */
export function runPython(code) {
  return callRuntime('run_cell_json', code);
}

/** pandas 문제 채점 */
export function gradePython(userCode, solution, orderMatters) {
  return callRuntime('grade_json', userCode, solution, !!orderMatters);
}

export async function resetPythonNamespace() {
  const py = await getPyodide();
  await py.runPythonAsync('import dsruntime\ndsruntime.reset_namespace()');
}

export async function registerCsvInPython(name, text) {
  const py = await getPyodide();
  py.globals.set('_upload_name', name);
  py.globals.set('_upload_text', text);
  return py.runPythonAsync('import dsruntime\ndsruntime.register_table(_upload_name, _upload_text)');
}

/** SQL 결과를 pandas 변수로 전달 */
export async function sendToPython(varName, result) {
  const py = await getPyodide();
  py.globals.set('_payload', JSON.stringify(result));
  py.globals.set('_varname', varName);
  await py.runPythonAsync(`
import json, pandas as pd, dsruntime
_p = json.loads(_payload)
_df = pd.DataFrame(_p["rows"], columns=[c["name"] for c in _p["columns"]])
for _c in _p["columns"]:
    if _c["type"] in ("TIMESTAMP", "DATE"):
        _df[_c["name"]] = pd.to_datetime(_df[_c["name"]])
dsruntime.G[_varname] = _df
`);
}
