// 외부 라이브러리 위치. 기본은 CDN이며, `?vendor=local` 로 열면 web/vendor/ 의 로컬 사본을 사용합니다.
// (로컬 사본은 scripts/vendor_assets.sh 로 만들 수 있습니다 — 오프라인/사내망 환경용)

const VERSIONS = {
  duckdb: '1.32.0',
  pyodide: '0.29.5',
  codemirror: '5.65.16',
};

const cdn = {
  duckdbModule: `https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@${VERSIONS.duckdb}/+esm`,
  duckdbDist: `https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@${VERSIONS.duckdb}/dist/`,
  pyodide: `https://cdn.jsdelivr.net/pyodide/v${VERSIONS.pyodide}/full/`,
  codemirror: `https://cdnjs.cloudflare.com/ajax/libs/codemirror/${VERSIONS.codemirror}/`,
};

const local = {
  duckdbModule: new URL('../../vendor/duckdb/duckdb-browser.bundle.mjs', import.meta.url).href,
  duckdbDist: new URL('../../vendor/duckdb/', import.meta.url).href,
  // Pyodide 코어는 로컬, pandas 등 패키지 휠은 CDN에서 받습니다.
  pyodide: new URL('../../vendor/pyodide/', import.meta.url).href,
  pyodidePackages: cdn.pyodide,
  codemirror: new URL('../../vendor/codemirror/', import.meta.url).href,
};

let useLocal = false;
try {
  useLocal = new URLSearchParams(location.search).get('vendor') === 'local';
} catch { /* ignore */ }

export const LIBS = { ...(useLocal ? local : cdn), versions: VERSIONS, mode: useLocal ? 'local' : 'cdn' };

// 연습용 샘플 테이블 (web/data/*.csv)
export const TABLES = [
  { name: 'users', desc: '회원 (가입일, 국가, 디바이스, 유입 채널, 연령대)' },
  { name: 'events', desc: '앱/웹 행동 로그 (visit → view_item → add_to_cart → checkout → purchase)' },
  { name: 'orders', desc: '주문 (상태, 결제수단, 쿠폰, 할인액, 결제금액)' },
  { name: 'order_items', desc: '주문 상세 (상품, 수량, 단가)' },
  { name: 'products', desc: '상품 (카테고리, 가격)' },
  { name: 'ab_test', desc: 'A/B 테스트 배정·전환 (checkout_button_v2, free_shipping_banner)' },
  { name: 'employees', desc: '직원 (부서, 매니저, 급여) — 고전 SQL 면접 문제용' },
  { name: 'departments', desc: '부서' },
];
