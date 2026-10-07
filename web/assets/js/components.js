// 실행 결과 렌더링 등 여러 화면에서 쓰는 컴포넌트
import { h, resultTable } from './util.js';

/** pandas 실행 결과 {stdout, displays, result, error} → 엘리먼트 */
export function renderPyOutput(res) {
  const box = h('div', { class: 'stack' });
  if (res.stdout) box.append(h('pre', { class: 'output-text' }, res.stdout));
  for (const d of res.displays || []) box.append(renderPayload(d));
  if (res.result) box.append(renderPayload(res.result));
  if (res.error) box.append(h('pre', { class: 'output-text err' }, res.error));
  if (!box.children.length) box.append(h('div', { class: 'small muted' }, '실행 완료 (출력 없음). 마지막 줄에 변수명을 쓰거나 print()/display()를 사용하세요.'));
  return box;
}

function renderPayload(p) {
  if (p.type === 'table') return resultTable(p);
  return h('pre', { class: 'output-text' }, p.text);
}

export function renderError(e) {
  const msg = ((e && e.message) || String(e)).replace(/^Error: /, '');
  const lines = msg.trim().split('\n');
  // 짧은 오류(SQL 오류 등)는 그대로, 긴 트레이스백은 마지막 줄(실제 원인)만 보이고 나머지는 접어 둡니다
  if (lines.length <= 6) return h('pre', { class: 'output-text err' }, msg);
  const last = [...lines].reverse().find((l) => l.trim()) || lines[0];
  const engine = /Python 엔진 로드 실패|pyodide|ModuleNotFoundError/i.test(msg);
  return h('div', { class: 'callout bad small' },
    h('b', null, engine ? 'Python(pandas) 엔진을 불러오지 못했습니다' : '실행 중 오류가 발생했습니다'),
    h('div', { style: { fontFamily: 'var(--mono)', margin: '4px 0', overflowWrap: 'anywhere' } }, last.trim()),
    engine ? h('div', null, '인터넷 연결(CDN 접근)을 확인한 뒤 다시 실행하면 재시도합니다.') : null,
    h('details', { style: { marginTop: '6px' } }, h('summary', null, '전체 오류 보기'), h('pre', { class: 'output-text err', style: { marginTop: '6px' } }, msg)));
}

export function loadingLine(text) {
  return h('div', { class: 'row small muted' }, h('span', { class: 'status-dot loading' }), text);
}
