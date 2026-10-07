// 코드 에디터: CodeMirror 5(문법 강조 + 자동 완성)를 불러오고, 실패하면 textarea로 대체합니다.
//
// 단축키
//   Ctrl/Cmd+Enter        실행 (선택 영역이 있으면 선택한 부분만)
//   Ctrl/Cmd+Shift+Enter  채점 (문제은행)
//   Tab / Shift+Tab       들여쓰기 / 내어쓰기 (여러 줄 선택 시 블록 단위)
//   Tab (단어 입력 중)     자동 완성 — 후보가 하나면 바로 완성, 여러 개면 목록 표시
//   Ctrl+Space            자동 완성 목록 열기
//   Ctrl/Cmd+/            주석 토글
//   ↑ ↓ Enter Tab Esc     자동 완성 목록 이동 / 선택 / 닫기
import { LIBS } from './config.js';
import { h, loadCss, loadScript, store } from './util.js';
import { makeHint, setSchema, getSchema } from './completion.js';

const CM_ADDONS = ['edit/matchbrackets', 'edit/closebrackets', 'comment/comment', 'selection/active-line', 'hint/show-hint'];

let cmPromise = null;
function loadCodeMirror() {
  if (!cmPromise) {
    const base = LIBS.codemirror;
    cmPromise = (async () => {
      loadCss(base + 'codemirror.min.css');
      loadCss(base + 'addon/hint/show-hint.min.css');
      await loadScript(base + 'codemirror.min.js');
      await Promise.all([
        loadScript(base + 'mode/sql/sql.min.js'),
        loadScript(base + 'mode/python/python.min.js'),
        ...CM_ADDONS.map((a) => loadScript(`${base}addon/${a}.min.js`)),
      ]);
      return window.CodeMirror;
    })().catch((e) => { console.warn('CodeMirror 사용 불가, textarea로 대체:', e.message); return null; });
  }
  return cmPromise;
}

// 자동 완성용 스키마를 SQL 엔진에서 한 번 불러옴
let schemaPromise = null;
export function refreshCompletionSchema() {
  schemaPromise = import('./engines.js')
    .then((e) => e.getDuckDB().then(() => e.listSchema()))
    .then(setSchema)
    .catch(() => {});
  return schemaPromise;
}
function ensureSchema() {
  if (!schemaPromise && !getSchema().length) refreshCompletionSchema();
}

export const autocompleteEnabled = () => store.get('editor:autocomplete', true);

/** textarea 대체 모드에서의 블록 들여쓰기/내어쓰기 */
function indentTextarea(ta, outdent) {
  const { value, selectionStart: s, selectionEnd: e } = ta;
  const lineStart = value.lastIndexOf('\n', s - 1) + 1;
  const multi = value.slice(s, e).includes('\n');
  if (!outdent && !multi) { ta.setRangeText('    ', s, e, 'end'); return; }
  const lineEnd = e > s && value[e - 1] === '\n' ? e - 1 : e;
  const block = value.slice(lineStart, lineEnd);
  const lines = block.split('\n');
  const changed = lines.map((l) => (outdent ? l.replace(/^( {1,4}|\t)/, '') : '    ' + l)).join('\n');
  ta.setRangeText(changed, lineStart, lineEnd, 'preserve');
  ta.selectionStart = lineStart;
  ta.selectionEnd = lineStart + changed.length;
}

/**
 * createEditor(container, { lang: 'sql'|'python', value, onRun, onGrade })
 * 반환: { getValue, getRunText, setValue, focus, insert, refresh, el }
 */
export function createEditor(container, { lang = 'sql', value = '', onRun, onGrade, placeholder = '' } = {}) {
  const ta = h('textarea', { class: 'plain', spellcheck: false, placeholder, 'aria-label': `${lang} 코드 에디터` });
  ta.value = value;
  const box = h('div', { class: 'editor' }, ta);
  container.append(box);
  let cm = null;

  ta.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.shiftKey && e.key === 'Enter' && onGrade) { e.preventDefault(); onGrade(); }
    else if (mod && e.key === 'Enter') { e.preventDefault(); onRun?.(); }
    else if (e.key === 'Tab') { e.preventDefault(); indentTextarea(ta, e.shiftKey); }
  });

  const api = {
    el: box,
    getValue: () => (cm ? cm.getValue() : ta.value),
    /** 실행할 코드: 선택 영역이 있으면 선택한 부분만 */
    getRunText: () => {
      if (cm) return cm.somethingSelected() ? cm.getSelection() : cm.getValue();
      const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd);
      return sel.trim() ? sel : ta.value;
    },
    hasSelection: () => (cm ? cm.somethingSelected() : ta.selectionEnd > ta.selectionStart),
    setValue: (v) => (cm ? cm.setValue(v) : (ta.value = v)),
    focus: () => (cm ? cm.focus() : ta.focus()),
    insert: (text) => {
      if (cm) { cm.replaceSelection(text); cm.focus(); }
      else { ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end'); ta.focus(); }
    },
    refresh: () => cm?.refresh(),
  };

  loadCodeMirror().then((CodeMirror) => {
    if (!CodeMirror) return;
    ensureSchema();
    const current = ta.value;
    const hint = makeHint(lang === 'sql' ? 'sql' : 'python');
    const showHint = (c, completeSingle = false) => {
      if (!c.showHint) return;
      c.showHint({ hint, completeSingle, closeCharacters: /[\s()[\]{};:>,=+\-*/<!|&]/, alignWithWord: true, container: document.body });
    };
    const prefixBeforeCursor = (c) => {
      const cur = c.getCursor();
      const line = c.getLine(cur.line).slice(0, cur.ch);
      return /[A-Za-z_][\w]*$|\.$/.test(line);
    };

    cm = CodeMirror.fromTextArea(ta, {
      mode: lang === 'sql' ? 'text/x-sparksql' : 'python',
      lineNumbers: true,
      indentUnit: 4,
      tabSize: 4,
      matchBrackets: true,
      autoCloseBrackets: true,
      styleActiveLine: true,
      lineWrapping: false,
      viewportMargin: Infinity,
      extraKeys: {
        'Ctrl-Enter': () => onRun?.(),
        'Cmd-Enter': () => onRun?.(),
        'Shift-Ctrl-Enter': () => onGrade?.(),
        'Shift-Cmd-Enter': () => onGrade?.(),
        Tab: (c) => {
          if (c.somethingSelected()) return c.indentSelection('add');
          // 단어를 입력하던 중이면 Tab = 자동 완성 (후보가 하나면 바로 완성)
          if (prefixBeforeCursor(c)) {
            const res = hint(c);
            if (res && res.list.length) return showHint(c, true);
          }
          return c.replaceSelection('    ');
        },
        'Shift-Tab': (c) => c.indentSelection('subtract'),
        'Ctrl-Space': (c) => showHint(c, false),
        'Ctrl-/': (c) => c.toggleComment({ indent: true }),
        'Cmd-/': (c) => c.toggleComment({ indent: true }),
      },
    });
    cm.setValue(current);

    // 입력하면서 자동으로 목록 표시 (단어 문자 또는 '.' 입력 시)
    let timer;
    cm.on('inputRead', (c, change) => {
      if (!autocompleteEnabled() || c.state.completionActive) return;
      const ch = change.text[change.text.length - 1].slice(-1);
      const quoteOpen = lang !== 'sql' && /['"]/.test(ch) && /\[\s*['"]$/.test(c.getLine(c.getCursor().line).slice(0, c.getCursor().ch));
      if (!/[\w.]/.test(ch) && !quoteOpen) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (c.state.completionActive) return;
        const cur = c.getCursor();
        const line = c.getLine(cur.line).slice(0, cur.ch);
        // 숫자만 입력 중이거나 한 글자 키워드 직후에는 띄우지 않음
        if (/(^|[^\w.])\d+$/.test(line)) return;
        showHint(c, false);
      }, 60);
    });

    // 보이지 않는 탭 안에서 생성된 경우 대비
    const io = new IntersectionObserver((entries) => { if (entries.some((en) => en.isIntersecting)) cm.refresh(); });
    io.observe(box);
  });

  return api;
}
