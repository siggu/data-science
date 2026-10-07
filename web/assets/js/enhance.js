// 사이트 전반 편의 기능
//  - 코드 블록: 복사 버튼, "플레이그라운드에서 실행" 버튼
//  - 단축키 도움말 (? 키), / 키로 검색창 이동, 맨 위로 버튼
import { h, store, toast } from './util.js';
import { TABLES } from './config.js';

const TABLE_RE = new RegExp(`\\b(${TABLES.map((t) => t.name).join('|')})\\b`);

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast('복사했습니다.');
}

function codeLang(pre, text) {
  const lang = pre.querySelector('code')?.dataset.lang;
  if (lang) return lang === 'python' ? 'python' : lang === 'sql' ? 'sql' : lang;
  if (/^\s*(--|SELECT|WITH|CREATE|MERGE|UPDATE|DELETE|INSERT|%%sql)/i.test(text)) return 'sql';
  if (/^\s*(#|import |from |\w+\s*=|print\(|df)/.test(text)) return 'python';
  return '';
}

function decoratePre(pre) {
  if (pre.dataset.enhanced || pre.closest('.CodeMirror, .output-text, .no-enhance') || pre.classList.contains('output-text')) return;
  pre.dataset.enhanced = '1';
  const text = pre.innerText.replace(/\n$/, '');
  const lang = codeLang(pre, text);
  const bar = h('div', { class: 'code-tools' },
    h('button', { class: 'code-tool', type: 'button', title: '코드 복사', onclick: () => copyText(text) }, '복사'));
  // 샘플 테이블을 쓰는 SQL/pandas 코드는 플레이그라운드에서 바로 실행
  if ((lang === 'sql' || lang === 'python') && TABLE_RE.test(text) && !text.includes('%%sql') && !/spark\./.test(text)) {
    bar.append(h('button', {
      class: 'code-tool', type: 'button', title: '플레이그라운드에서 실행',
      onclick: () => {
        store.set(lang === 'sql' ? 'pg:inject' : 'pg:injectPy', text);
        location.hash = '#/playground';
      },
    }, '▶ 실행해 보기'));
  }
  const wrap = h('div', { class: 'code-wrap' });
  pre.replaceWith(wrap);
  wrap.append(pre, bar);
}

function scan(root) {
  root.querySelectorAll?.('pre').forEach(decoratePre);
}

// ───── 단축키 도움말 ─────
const SHORTCUTS = [
  ['에디터', [
    ['Ctrl/⌘ + Enter', '실행 (선택한 부분만 실행 가능)'],
    ['Ctrl/⌘ + Shift + Enter', '채점 (문제은행)'],
    ['Tab / Shift + Tab', '들여쓰기 / 내어쓰기 (여러 줄 선택 시 블록 단위)'],
    ['Tab (단어 입력 중)', '자동 완성 — 후보가 하나면 바로 완성'],
    ['Ctrl + Space', '자동 완성 목록 열기'],
    ['↑ ↓ · Enter/Tab · Esc', '목록 이동 · 선택 · 닫기'],
    ['Ctrl/⌘ + /', '주석 토글'],
    ['( [ { \' "', '괄호·따옴표 자동 닫기'],
  ]],
  ['문제 풀이 (자격증 · Databricks 퀴즈)', [
    ['1 ~ 4', '보기 선택'],
    ['Enter 또는 →', '다음 문제'],
    ['←', '이전 문제'],
  ]],
  ['모의 면접', [['Ctrl/⌘ + Enter', '답변 제출']]],
  ['사이트', [
    ['/', '검색창으로 이동 (면접 Q&A, 문법 대응표)'],
    ['?', '이 도움말 열기/닫기'],
    ['Esc', '도움말 닫기'],
  ]],
];

let modal = null;
function toggleHelp(force) {
  if (modal && force !== true) { modal.remove(); modal = null; return; }
  if (modal) return;
  const auto = h('input', { type: 'checkbox', checked: store.get('editor:autocomplete', true), onchange: (e) => store.set('editor:autocomplete', e.target.checked) });
  modal = h('div', { class: 'modal-backdrop', onclick: (e) => { if (e.target === modal) toggleHelp(); } },
    h('div', { class: 'modal card', role: 'dialog', 'aria-label': '단축키 도움말' },
      h('div', { class: 'row between' }, h('h2', { style: { margin: 0 } }, '단축키 & 편의 기능'), h('button', { class: 'btn ghost sm', type: 'button', onclick: () => toggleHelp() }, '닫기')),
      SHORTCUTS.map(([group, rows]) => h('div', { style: { marginTop: '14px' } },
        h('h4', null, group),
        h('div', { class: 'table-wrap' }, h('table', { class: 'data' }, h('tbody', null,
          rows.map(([k, d]) => h('tr', null, h('td', { style: { width: '42%' } }, k.split(' · ').map((x, i) => [i ? ' · ' : '', h('kbd', null, x)])), h('td', null, d)))))))),
      h('label', { class: 'row small', style: { marginTop: '14px', cursor: 'pointer' } }, auto, '입력하는 동안 자동 완성 목록을 자동으로 띄우기 (끄면 Ctrl+Space / Tab으로만 열림)'),
      h('p', { class: 'small muted', style: { margin: '10px 0 0' } }, '코드 블록에 마우스를 올리면 [복사]와 [▶ 실행해 보기] 버튼이 나타납니다. 결과 표의 컬럼 이름을 누르면 정렬됩니다.')));
  document.body.append(modal);
}

const isTyping = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.closest?.('.CodeMirror'));

// 가로 스크롤 탭 바: 선택된 탭이 화면 밖에 있으면 보이도록 스크롤하고, 양끝에 더 있음을 표시
function revealActiveTabs() {
  document.querySelectorAll('.view.active .tabs').forEach((bar) => {
    const on = bar.querySelector('button.on');
    if (on && on.dataset.revealed !== '1') {
      on.dataset.revealed = '1';
      bar.querySelectorAll('button:not(.on)').forEach((b) => delete b.dataset.revealed);
      const l = on.offsetLeft - bar.offsetLeft, r = l + on.offsetWidth;
      if (l < bar.scrollLeft || r > bar.scrollLeft + bar.clientWidth) bar.scrollLeft = Math.max(0, l - 24);
    }
    edgeFade(bar);
    bar.dispatchEvent(new Event('scroll'));
  });
}

/** 가로 스크롤 영역 양끝에 숨은 항목이 있으면 more-left / more-right 클래스 (CSS에서 흐리게 표시) */
function edgeFade(bar) {
  if (bar.dataset.fade) return;
  bar.dataset.fade = '1';
  const upd = () => {
    bar.classList.toggle('more-left', bar.scrollLeft > 2);
    bar.classList.toggle('more-right', bar.scrollLeft + bar.clientWidth < bar.scrollWidth - 2);
  };
  bar.addEventListener('scroll', upd, { passive: true });
  window.addEventListener('resize', upd);
  requestAnimationFrame(upd);
}

export function initEnhancements() {
  const main = document.getElementById('main');
  scan(main);
  new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) { if (n.tagName === 'PRE') decoratePre(n); else scan(n); }
    revealActiveTabs();
  }).observe(main, { childList: true, subtree: true });
  window.addEventListener('hashchange', () => requestAnimationFrame(revealActiveTabs));
  main.addEventListener('click', (e) => { if (e.target.closest?.('.tabs')) requestAnimationFrame(revealActiveTabs); });

  const nav = document.getElementById('nav');
  if (nav) { edgeFade(nav); window.addEventListener('hashchange', () => setTimeout(() => nav.dispatchEvent(new Event('scroll')), 50)); }

  // 헤더 높이 → --header-h (sticky 요소 위치, 스크롤 여백 계산용)
  const header = document.querySelector('.app-header');
  if (header) {
    const setH = () => document.documentElement.style.setProperty('--header-h', `${Math.round(header.getBoundingClientRect().height)}px`);
    new ResizeObserver(setH).observe(header);
    setH();
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal) { toggleHelp(); return; }
    if (isTyping(document.activeElement) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '?') { e.preventDefault(); toggleHelp(); }
    else if (e.key === '/') {
      const input = document.querySelector('.view.active input[type=search]');
      if (input) { e.preventDefault(); input.focus(); input.select(); }
    }
  });

  const help = document.getElementById('help-toggle');
  help?.addEventListener('click', () => toggleHelp());

  // 맨 위로
  const top = h('button', { class: 'to-top', type: 'button', title: '맨 위로', 'aria-label': '맨 위로', onclick: () => window.scrollTo({ top: 0, behavior: 'smooth' }) }, '↑');
  document.body.append(top);
  const onScroll = () => top.classList.toggle('show', window.scrollY > 600);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/** 퀴즈 화면용 숫자키/화살표 단축키. container 안의 .quiz-opt 와 [data-nav] 버튼을 사용 */
export function quizKeys(isActive) {
  document.addEventListener('keydown', (e) => {
    if (!isActive() || isTyping(document.activeElement) || e.ctrlKey || e.metaKey || e.altKey || modal) return;
    const view = document.querySelector('.view.active');
    if (!view) return;
    if (/^[1-9]$/.test(e.key)) {
      const card = [...view.querySelectorAll('.quiz-card')].find((c) => c.querySelector('.quiz-opt:not(:disabled)'));
      const opt = card?.querySelectorAll('.quiz-opt')[+e.key - 1];
      if (opt && !opt.disabled) { e.preventDefault(); opt.click(); }
    } else if (e.key === 'Enter' || e.key === 'ArrowRight') {
      const next = view.querySelector('[data-nav=next]');
      if (next) { e.preventDefault(); next.click(); }
    } else if (e.key === 'ArrowLeft') {
      const prev = view.querySelector('[data-nav=prev]');
      if (prev) { e.preventDefault(); prev.click(); }
    }
  });
}
