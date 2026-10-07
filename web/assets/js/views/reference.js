// 문법 레퍼런스: SQL · pandas 기본 문법을 Docs 형식으로 (자주 쓰는 문법 → Appendix)
//  - 왼쪽 목차(현재 읽는 항목 강조), 검색, 항목별 바로 실행(결과 표) / 플레이그라운드로 보내기
import { h, md, store, debounce, resultTable } from '../util.js';
import { REF_LANGS } from '../data/reference.js';
import { PROBLEMS } from '../data/problems.js';
import { runSQL, runPython } from '../engines.js';
import { renderPyOutput, renderError, loadingLine } from '../components.js';

const TIERS = [['core', '자주 쓰는 문법'], ['appendix', 'Appendix — 덜 쓰는 문법']];
const anchor = (lang, id) => `ref-${lang}-${id}`;

/** tier → group → items (원래 순서 유지) */
function outline(items) {
  return TIERS.map(([tier, name]) => {
    const groups = [];
    for (const it of items.filter((x) => x.tier === tier)) {
      let g = groups[groups.length - 1];
      if (!g || g.name !== it.group) groups.push(g = { name: it.group, items: [] });
      g.items.push(it);
    }
    return { tier, name, groups };
  }).filter((t) => t.groups.length);
}

const plain = (it) => [it.title, it.summary, it.body, it.syntax, it.tips, it.dbx, ...(it.examples || []).map((e) => `${e.title} ${e.code}`)].join(' ').toLowerCase();

export default {
  id: 'reference',
  title: '문법 레퍼런스',

  mount(el) {
    this.lang = store.get('ref:lang', 'sql');
    this.langBar = h('div', { class: 'seg', role: 'tablist', 'aria-label': '언어 선택' });
    this.search = h('input', { type: 'search', placeholder: '문법 검색 (예: 윈도우, merge, NULL)', 'aria-label': '문법 검색' });
    this.search.addEventListener('input', debounce(() => this.applySearch(), 150));
    this.countEl = h('span', { class: 'small muted' });
    this.tocEl = h('nav', { class: 'ref-toc-list', 'aria-label': '목차' });
    this.docEl = h('div', { class: 'ref-doc' });
    this.toc = h('details', { class: 'ref-toc card flat', open: !window.matchMedia('(max-width: 900px)').matches || null },
      h('summary', null, '목차'), this.tocEl);
    el.append(
      h('div', { class: 'page-head' },
        h('h1', null, 'SQL · pandas 문법 레퍼런스'),
        h('p', null, '데이터 분석에서 자주 쓰는 문법을 기능별로 정리했습니다. 각 항목은 무엇을 하는지, 문법 형태, 샘플 데이터로 바로 실행되는 예제, 주의할 점 순서로 되어 있습니다. 자주 쓰는 문법을 먼저 익히고, 덜 쓰는 문법은 Appendix에서 필요할 때 찾아보세요.')),
      h('div', { class: 'row between ref-bar' }, this.langBar, h('div', { class: 'row' }, this.countEl, this.search)),
      h('div', { class: 'split ref-layout' },
        h('aside', { class: 'sticky-side' }, this.toc),
        h('div', { style: { minWidth: 0 } }, this.docEl)));
    this.render();
  },

  onShow(params) {
    if (params.lang && REF_LANGS.some((l) => l.id === params.lang) && params.lang !== this.lang) {
      this.lang = params.lang;
      this.render();
    }
    // 라우터가 맨 위로 스크롤한 뒤에 항목으로 이동
    if (params.id) setTimeout(() => this.jump(params.id, false), 0);
  },

  render() {
    store.set('ref:lang', this.lang);
    const L = REF_LANGS.find((l) => l.id === this.lang) || REF_LANGS[0];
    this.langBar.replaceChildren(...REF_LANGS.map((l) => h('button', {
      type: 'button', role: 'tab', class: l.id === L.id ? 'on' : '', 'aria-selected': String(l.id === L.id),
      onclick: () => { if (this.lang !== l.id) { this.lang = l.id; this.render(); window.scrollTo(0, 0); } },
    }, l.name, h('span', { class: 'count' }, l.items.length))));

    const tree = outline(L.items);
    this.tocEl.replaceChildren(...tree.map((t) => h('div', { class: `toc-tier toc-${t.tier}` },
      h('div', { class: 'toc-tier-name' }, t.name),
      t.groups.map((g) => h('div', { class: 'toc-group' },
        h('div', { class: 'toc-group-name' }, g.name),
        g.items.map((it) => h('a', {
          href: `#/reference?lang=${L.id}&id=${it.id}`, 'data-id': it.id, title: it.summary,
          onclick: (e) => { e.preventDefault(); this.jump(it.id, true); },
        }, it.title)))))));

    this.docEl.replaceChildren(
      h('div', { class: 'callout info md small', html: md(L.intro) }),
      ...tree.map((t) => h('section', { class: `ref-tier ref-${t.tier}` },
        h('h2', { class: 'ref-tier-title' }, t.name),
        t.groups.map((g) => h('div', { class: 'ref-group' },
          h('h3', { class: 'ref-group-title' }, g.name),
          g.items.map((it) => this.item(L.id, it)))))),
      h('div', { class: 'card empty ref-empty', hidden: true }, '검색 결과가 없습니다.'));
    this.applySearch();
    this.spy();
  },

  item(lang, it) {
    const related = (it.related || []).map((id) => PROBLEMS.find((p) => p.id === id)).filter(Boolean);
    return h('article', { class: 'ref-item card', id: anchor(lang, it.id), 'data-id': it.id, 'data-text': plain(it) },
      h('div', { class: 'row between ref-item-head' },
        h('h4', null, it.title, it.tier === 'appendix' ? h('span', { class: 'badge', style: { marginLeft: '8px', verticalAlign: 'middle' } }, 'Appendix') : null),
        h('a', {
          class: 'ref-link', href: `#/reference?lang=${lang}&id=${it.id}`, title: '이 항목 링크 복사', 'aria-label': '링크 복사',
          onclick: (e) => {
            e.preventDefault();
            const url = `${location.origin}${location.pathname}${location.search}#/reference?lang=${lang}&id=${it.id}`;
            navigator.clipboard?.writeText(url).catch(() => {});
            history.replaceState(null, '', `#/reference?lang=${lang}&id=${it.id}`);
          },
        }, '#')),
      h('p', { class: 'ref-summary' }, it.summary),
      h('div', { class: 'md', html: md(it.body) }),
      h('div', { class: 'ref-label' }, '문법'),
      h('pre', { class: 'ref-syntax' }, h('code', { 'data-lang': lang === 'sql' ? 'sql-syntax' : 'python-syntax' }, it.syntax.trim())),
      (it.examples || []).map((ex) => this.example(lang, ex)),
      it.tips ? h('div', { class: 'callout warn md small ref-tips', html: md('**주의·팁**\n' + it.tips) }) : null,
      it.dbx ? h('div', { class: 'callout md small ref-dbx', html: md(`**${lang === 'sql' ? 'Databricks' : 'SQL · PySpark'}**: ${it.dbx}`) }) : null,
      related.length ? h('p', { class: 'small ref-related' }, '연습 문제: ',
        related.map((p, i) => [i ? ' · ' : '', h('a', { href: `#/problems?id=${p.id}` }, `${p.id} ${p.title}`)])) : null);
  },

  example(lang, ex) {
    const out = h('div', { class: 'ref-out' });
    const code = ex.code.trim();
    const run = async () => {
      btn.disabled = true;
      out.replaceChildren(loadingLine(lang === 'sql' ? '실행 중…' : 'Python(pandas) 엔진 준비 중… 처음 한 번은 10~20초 걸립니다'));
      try {
        if (lang === 'sql') {
          const r = await runSQL(code);
          out.replaceChildren(resultTable(r, { limit: 50 }));
        } else {
          out.replaceChildren(renderPyOutput(await runPython(code)));
        }
      } catch (e) {
        out.replaceChildren(renderError(e));
      } finally {
        btn.disabled = false;
      }
    };
    const btn = ex.noBrowser ? null : h('button', { class: 'btn sm', type: 'button', onclick: run }, '▶ 결과 보기');
    return h('div', { class: 'ref-example' },
      h('div', { class: 'row between' }, h('div', { class: 'ref-label' }, `예제 — ${ex.title}`), btn),
      // noBrowser 예제는 data-lang 을 바꿔 플레이그라운드 실행 버튼도 붙지 않게 함
      h('pre', null, h('code', { 'data-lang': ex.noBrowser ? 'text' : lang === 'sql' ? 'sql' : 'python' }, code)),
      ex.noBrowser ? h('p', { class: 'small muted', style: { margin: '0 0 6px' } }, '이 사이트의 브라우저용 DuckDB에서는 이 기능을 쓸 수 없어 실행 버튼이 없습니다. 로컬 DuckDB나 local-spark 환경에서 실행해 보세요.') : null,
      out);
  },

  applySearch() {
    const kw = this.search.value.trim().toLowerCase();
    let n = 0;
    for (const art of this.docEl.querySelectorAll('.ref-item')) {
      const show = !kw || kw.split(/\s+/).every((w) => art.dataset.text.includes(w));
      art.hidden = !show;
      if (show) n++;
      const link = this.tocEl.querySelector(`a[data-id="${art.dataset.id}"]`);
      if (link) link.hidden = !show;
    }
    // 항목이 모두 숨겨진 단원/단계는 제목도 숨김
    for (const sel of ['.ref-group', '.ref-tier']) {
      for (const box of this.docEl.querySelectorAll(sel)) box.hidden = !box.querySelector('.ref-item:not([hidden])');
    }
    for (const box of this.tocEl.querySelectorAll('.toc-group, .toc-tier')) box.hidden = !box.querySelector('a:not([hidden])');
    const total = this.docEl.querySelectorAll('.ref-item').length;
    this.countEl.textContent = kw ? `${n} / ${total}개 항목` : `${total}개 항목`;
    this.docEl.querySelector('.ref-empty').hidden = n > 0;
    this.onScroll?.();
  },

  jump(id, updateHash) {
    const el = document.getElementById(anchor(this.lang, id));
    if (!el) return;
    if (el.hidden) { this.search.value = ''; this.applySearch(); }
    el.scrollIntoView({ block: 'start' });
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    if (updateHash) history.replaceState(null, '', `#/reference?lang=${this.lang}&id=${id}`);
    if (window.matchMedia('(max-width: 900px)').matches) this.toc.open = false;
  },

  // 스크롤 위치에 맞춰 목차에서 현재 항목 강조: 헤더 아래 기준선을 지난 마지막 항목
  spy() {
    if (this.onScroll) window.removeEventListener('scroll', this.onScroll);
    const links = new Map([...this.tocEl.querySelectorAll('a')].map((a) => [a.dataset.id, a]));
    let raf = 0;
    const update = () => {
      raf = 0;
      if (!this.docEl.closest('.view.active')) return;
      const line = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 92) + 40;
      let cur = null;
      for (const art of this.docEl.querySelectorAll('.ref-item:not([hidden])')) {
        if (art.getBoundingClientRect().top <= line) cur = art; else break;
      }
      cur = cur || this.docEl.querySelector('.ref-item:not([hidden])');
      for (const a of links.values()) a.classList.toggle('on', !!cur && a.dataset.id === cur.dataset.id);
      const a = cur && links.get(cur.dataset.id);
      const box = this.tocEl.closest('.sticky-side');
      if (a && box && box.scrollHeight > box.clientHeight && getComputedStyle(box).overflowY === 'auto') {
        const r = a.getBoundingClientRect(), b = box.getBoundingClientRect();
        if (r.top < b.top + 40 || r.bottom > b.bottom - 40) box.scrollTop += r.top - b.top - b.height / 3;
      }
    };
    this.onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    window.addEventListener('scroll', this.onScroll, { passive: true });
    this.onScroll();
  },
};

/** 문제은행 등에서 쓰는 역참조: 문제 id → 관련 문법 항목 [{lang, id, title}] */
export function refsForProblem(pid) {
  return REF_LANGS.flatMap((l) => l.items.filter((it) => (it.related || []).includes(pid)).map((it) => ({ lang: l.id, id: it.id, title: it.title })));
}
