// 공통 유틸: DOM 헬퍼, 미니 마크다운 렌더러, 저장소, 결과 테이블

/** h('div', {class: 'x', onclick: fn}, child1, 'text', ...) */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v)) sk.startsWith('--') ? el.style.setProperty(sk, sv) : (el.style[sk] = sv);
      }
      else if (k in el && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function inline(s) {
  // 코드 스팬을 먼저 빼두고 나머지에 강조/링크 적용
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  s = escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => {
      const ext = /^https?:/.test(u);
      return `<a href="${u}"${ext ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`;
    });
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${escapeHtml(codes[+i])}</code>`);
}

/** 콘텐츠 작성용 경량 마크다운 (제목, 목록, 표, 코드블록, 인용, 강조, 링크) */
export function md(src) {
  if (!src) return '';
  const lines = String(src).replace(/\r\n/g, '\n').split('\n');
  // 공통 들여쓰기 제거 (템플릿 리터럴 작성 편의)
  const ind = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
  const L = lines.map((l) => l.slice(Number.isFinite(ind) ? ind : 0));
  const out = [];
  let i = 0;
  const isBlockStart = (l) => /^(#{1,4} |```|> |\s*[-*] |\s*\d+\. |\|)/.test(l) || !l.trim();
  while (i < L.length) {
    const line = L[i];
    if (!line.trim()) { i++; continue; }
    let m;
    if ((m = line.match(/^```(\w*)/))) {
      const buf = [];
      i++;
      while (i < L.length && !L[i].startsWith('```')) buf.push(L[i++]);
      i++;
      out.push(`<pre><code data-lang="${m[1]}">${escapeHtml(buf.join('\n'))}</code></pre>`);
    } else if ((m = line.match(/^(#{1,4}) (.*)/))) {
      const lv = Math.min(m[1].length + 1, 5);
      out.push(`<h${lv}>${inline(m[2])}</h${lv}>`);
      i++;
    } else if (line.startsWith('> ')) {
      const buf = [];
      while (i < L.length && L[i].startsWith('>')) buf.push(L[i++].replace(/^> ?/, ''));
      out.push(`<blockquote>${md(buf.join('\n'))}</blockquote>`);
    } else if (line.startsWith('|')) {
      const rows = [];
      while (i < L.length && L[i].startsWith('|')) rows.push(L[i++]);
      const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = cells(rows[0]);
      const body = rows.slice(rows[1] && /^\|[\s:|-]+\|?$/.test(rows[1]) ? 2 : 1);
      out.push('<div class="table-wrap"><table><thead><tr>' + head.map((c) => `<th>${inline(c)}</th>`).join('') +
        '</tr></thead><tbody>' + body.map((r) => '<tr>' + cells(r).map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
        '</tbody></table></div>');
    } else if (/^\s*([-*]|\d+\.) /.test(line)) {
      // 중첩 목록 지원 (2칸 이상 들여쓰기)
      const parse = (base) => {
        const ordered = /^\s*\d+\./.test(L[i]);
        let html = ordered ? '<ol>' : '<ul>';
        while (i < L.length && /^\s*([-*]|\d+\.) /.test(L[i])) {
          const d = L[i].match(/^ */)[0].length;
          if (d < base) break;
          if (d > base) { html = html.replace(/<\/li>$/, '') + parse(d) + '</li>'; continue; }
          let text = L[i].replace(/^\s*([-*]|\d+\.) /, '');
          i++;
          while (i < L.length && L[i].trim() && !isBlockStart(L[i])) text += ' ' + L[i++].trim();
          html += `<li>${inline(text)}</li>`;
        }
        return html + (ordered ? '</ol>' : '</ul>');
      };
      out.push(parse(line.match(/^ */)[0].length));
    } else {
      const buf = [line];
      i++;
      while (i < L.length && L[i].trim() && !isBlockStart(L[i])) buf.push(L[i++]);
      out.push(`<p>${inline(buf.join(' '))}</p>`);
    }
  }
  return out.join('\n');
}

export function mdEl(src, cls = '') {
  return h('div', { class: `md ${cls}`, html: md(src) });
}

// localStorage 래퍼: 사생활 보호 모드 등에서 실패해도 앱은 동작해야 함
const PREFIX = 'dsprep:';
export const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(PREFIX + key);
      return v == null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* ignore */ }
  },
  /** Set 형태로 관리하는 키 토글 */
  toggle(key, id) {
    const s = new Set(this.get(key, []));
    s.has(id) ? s.delete(id) : s.add(id);
    this.set(key, [...s]);
    return s.has(id);
  },
  has(key, id) { return this.get(key, []).includes(id); },
  add(key, id) { const s = new Set(this.get(key, [])); s.add(id); this.set(key, [...s]); },
};

let toastTimer;
export function toast(msg, ms = 2200) {
  document.querySelector('.toast')?.remove();
  const el = h('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), ms);
}

export function fmtNum(v, digits = 4) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return String(v);
  if (Number.isInteger(v)) return v.toLocaleString('en-US', { useGrouping: false });
  return String(+v.toFixed(digits));
}

/** 결과 테이블 렌더링. data = {columns:[{name,type}], rows:[[...]], index?:[...]}
 *  컬럼 이름을 누르면 정렬(오름 → 내림 → 원래 순서), [복사]로 TSV 복사 */
export function resultTable(data, { limit = 500 } = {}) {
  const { columns } = data;
  const hasIndex = Array.isArray(data.index);
  const original = data.rows.map((r, i) => ({ r, idx: hasIndex ? data.index[i] : null }));
  let view = original;
  let sort = { col: -1, dir: 0 };
  const wrap = h('div');
  const grid = h('div', { class: 'result-grid' });
  const table = h('table');
  const tbody = h('tbody');
  const ths = columns.map((c, ci) => h('th', {
    class: 'sortable', title: '클릭해서 정렬',
    onclick: () => {
      sort = sort.col === ci ? { col: ci, dir: (sort.dir + 1) % 3 } : { col: ci, dir: 1 };
      if (!sort.dir) view = original;
      else {
        const mul = sort.dir === 1 ? 1 : -1;
        view = [...original].sort((a, b) => {
          const x = a.r[ci];
          const y = b.r[ci];
          if (x == null && y == null) return 0;
          if (x == null) return 1;
          if (y == null) return -1;
          return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'ko', { numeric: true })) * mul;
        });
      }
      ths.forEach((t, ti) => t.setAttribute('data-sort', ti === sort.col && sort.dir ? (sort.dir === 1 ? 'asc' : 'desc') : ''));
      paint();
    },
  }, c.name, c.type ? h('small', null, c.type) : null));
  table.append(h('thead', null, h('tr', null, hasIndex ? h('th', null, data.indexName || '') : null, ths)));
  const paint = () => {
    tbody.replaceChildren(...view.slice(0, limit).map(({ r, idx }) => {
      const tr = h('tr');
      if (hasIndex) tr.append(h('td', { class: 'idx' }, String(idx)));
      r.forEach((v) => {
        if (v === null || v === undefined) tr.append(h('td', { class: 'null' }, 'NULL'));
        else if (typeof v === 'number') tr.append(h('td', { class: 'num' }, fmtNum(v)));
        else tr.append(h('td', { title: String(v).length > 40 ? String(v) : null }, String(v)));
      });
      return tr;
    }));
  };
  paint();
  table.append(tbody);
  grid.append(table);
  const total = data.totalRows ?? data.rows.length;
  const shown = Math.min(limit, data.rows.length);
  const copy = h('button', {
    class: 'btn ghost sm', type: 'button', title: '탭으로 구분된 텍스트로 복사 (엑셀/시트에 붙여넣기)',
    onclick: async () => {
      const lines = [columns.map((c) => c.name).join('\t'), ...view.map(({ r }) => r.map((v) => (v == null ? '' : String(v))).join('\t'))];
      const { copyText } = await import('./enhance.js');
      copyText(lines.join('\n'));
    },
  }, '복사');
  wrap.append(grid, h('div', { class: 'result-meta row between' },
    h('span', null, `${total.toLocaleString()} rows × ${columns.length} columns` +
      (total > shown ? ` (상위 ${shown.toLocaleString()}행 표시)` : '') +
      (data.elapsed != null ? ` · ${data.elapsed.toFixed(0)} ms` : '')),
    copy));
  return wrap;
}

/** 결과 비교용 정규화: 숫자 반올림, 날짜 문자열화, (옵션) 행 정렬 */
export function normalizeRows(rows, orderMatters) {
  const norm = rows.map((r) => r.map((v) => {
    if (v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v))) return null;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (typeof v === 'number') { const x = Math.round(v * 1e4) / 1e4; return Object.is(x, -0) ? 0 : x; }
    if (v instanceof Date) return v.toISOString().replace('T', ' ').replace(/\.000Z$/, '').replace(/ 00:00:00$/, '');
    return String(v);
  }));
  const keyed = norm.map((r) => JSON.stringify(r));
  if (!orderMatters) keyed.sort();
  return keyed;
}

export function compareResults(user, expected, orderMatters) {
  if (user.columns.length !== expected.columns.length) {
    return { ok: false, reason: `컬럼 수가 다릅니다. (내 결과 ${user.columns.length}개 / 정답 ${expected.columns.length}개)` };
  }
  if (user.rows.length !== expected.rows.length) {
    return { ok: false, reason: `행 수가 다릅니다. (내 결과 ${user.rows.length}행 / 정답 ${expected.rows.length}행)` };
  }
  const a = normalizeRows(user.rows, orderMatters);
  const b = normalizeRows(expected.rows, orderMatters);
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return { ok: false, reason: `${orderMatters ? `${i + 1}번째 행` : '일부 행'}의 값이 다릅니다.` + (orderMatters ? ' (정렬 순서도 채점 대상입니다)' : ''), detail: { mine: a[i], answer: b[i] } };
    }
  }
  return { ok: true };
}

export function debounce(fn, ms = 200) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export function loadScript(src) {
  return new Promise((resolve, reject) => {
    if ([...document.scripts].some((s) => s.src === src)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`스크립트 로드 실패: ${src}`));
    document.head.append(s);
  });
}

export function loadCss(href) {
  if ([...document.querySelectorAll('link[rel=stylesheet]')].some((l) => l.href === href)) return;
  document.head.append(h('link', { rel: 'stylesheet', href }));
}

export function downloadText(filename, text, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toCsv(columns, rows) {
  const esc = (v) => {
    if (v == null) return '';
    const s = v instanceof Date ? v.toISOString() : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.map((c) => esc(c.name)).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
}
