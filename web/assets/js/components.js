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
  const msg = (e && e.message) || String(e);
  return h('pre', { class: 'output-text err' }, msg.replace(/^Error: /, ''));
}

export function loadingLine(text) {
  return h('div', { class: 'row small muted' }, h('span', { class: 'status-dot loading' }), text);
}
