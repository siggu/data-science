import { h, store } from './util.js';
import { onEngineState } from './engines.js';
import { initEnhancements, quizKeys } from './enhance.js';
import home from './views/home.js';
import interview from './views/interview.js';
import playground from './views/playground.js';
import problems from './views/problems.js';
import mock from './views/mock.js';
import abtest from './views/abtest.js';
import cases from './views/cases.js';
import databricks from './views/databricks.js';
import certs from './views/certs.js';

const VIEWS = [home, interview, playground, problems, mock, abtest, cases, certs, databricks];
const mounted = new Map();
const nav = document.getElementById('nav');
const main = document.getElementById('main');

for (const v of VIEWS) {
  nav.append(h('a', { href: `#/${v.id}`, 'data-id': v.id }, v.title));
}

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [id, query = ''] = raw.split('?');
  return { id: id || 'home', params: Object.fromEntries(new URLSearchParams(query)) };
}

function route() {
  const { id, params } = parseHash();
  const view = VIEWS.find((v) => v.id === id) || home;
  for (const a of nav.querySelectorAll('a')) a.classList.toggle('active', a.dataset.id === view.id);
  nav.querySelector('a.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  if (!mounted.has(view.id)) {
    const el = h('section', { class: 'view', id: `view-${view.id}` });
    main.append(el);
    view.mount(el);
    mounted.set(view.id, el);
  }
  for (const [vid, el] of mounted) el.classList.toggle('active', vid === view.id);
  view.onShow?.(params);
  document.title = `${view.title} · DA 면접 준비 랩`;
  if (!params.keepScroll) window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
route();
initEnhancements();
// 자격증 문제 풀이 / Databricks 퀴즈에서 숫자키·화살표 사용
quizKeys(() => ['certs', 'databricks'].includes(parseHash().id));

// 엔진 상태 표시
const status = document.getElementById('engine-status');
onEngineState((s) => {
  status.replaceChildren();
  const item = (label, st, msg) => h('span', { class: 'engine-status', title: msg || '' },
    h('span', { class: `status-dot ${st === 'idle' ? '' : st}` }), label);
  if (s.duckdb !== 'idle') status.append(item('SQL', s.duckdb, s.duckdbMsg));
  if (s.pyodide !== 'idle') status.append(item('pandas', s.pyodide, s.pyodideMsg));
});

// 테마 전환: 시스템 → 라이트 → 다크
const themeBtn = document.getElementById('theme-toggle');
const THEMES = [null, 'light', 'dark'];
const LABEL = { null: '테마: 시스템', light: '테마: 라이트', dark: '테마: 다크' };
function applyTheme(t) {
  if (t) document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  themeBtn.textContent = LABEL[t];
}
applyTheme(store.get('theme', null));
themeBtn.addEventListener('click', () => {
  const cur = store.get('theme', null);
  const next = THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length];
  store.set('theme', next);
  applyTheme(next);
});
