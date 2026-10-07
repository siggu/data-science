// 코드 에디터: CodeMirror 5(문법 강조)를 CDN에서 불러오고, 실패하면 textarea로 대체합니다.
import { LIBS } from './config.js';
import { h, loadCss, loadScript } from './util.js';

let cmPromise = null;
function loadCodeMirror() {
  if (!cmPromise) {
    const base = LIBS.codemirror;
    cmPromise = (async () => {
      loadCss(base + 'codemirror.min.css');
      await loadScript(base + 'codemirror.min.js');
      await Promise.all([
        loadScript(base + 'mode/sql/sql.min.js'),
        loadScript(base + 'mode/python/python.min.js'),
        loadScript(base + 'addon/edit/matchbrackets.min.js'),
      ]);
      return window.CodeMirror;
    })().catch((e) => { console.warn('CodeMirror 사용 불가, textarea로 대체:', e.message); return null; });
  }
  return cmPromise;
}

/**
 * createEditor(container, { lang: 'sql'|'python', value, onRun, minHeight })
 * 반환: { getValue, setValue, focus, insert, el }
 */
export function createEditor(container, { lang = 'sql', value = '', onRun, placeholder = '' } = {}) {
  const ta = h('textarea', { class: 'plain', spellcheck: false, placeholder, 'aria-label': `${lang} 코드 에디터` });
  ta.value = value;
  const box = h('div', { class: 'editor' }, ta);
  container.append(box);
  let cm = null;

  ta.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); onRun?.(); }
    else if (e.key === 'Tab') {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: en } = ta;
      ta.setRangeText('    ', s, en, 'end');
    }
  });

  const api = {
    el: box,
    getValue: () => (cm ? cm.getValue() : ta.value),
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
    const current = ta.value;
    cm = CodeMirror.fromTextArea(ta, {
      mode: lang === 'sql' ? 'text/x-sparksql' : 'python',
      lineNumbers: true,
      indentUnit: 4,
      tabSize: 4,
      matchBrackets: true,
      lineWrapping: false,
      viewportMargin: Infinity,
      extraKeys: {
        'Ctrl-Enter': () => onRun?.(),
        'Cmd-Enter': () => onRun?.(),
        Tab: (c) => c.replaceSelection('    '),
      },
    });
    cm.setValue(current);
    // 보이지 않는 탭 안에서 생성된 경우 대비
    const io = new IntersectionObserver((entries) => { if (entries.some((en) => en.isIntersecting)) cm.refresh(); });
    io.observe(box);
  });

  return api;
}
