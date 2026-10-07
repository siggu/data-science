import { h, md, store, debounce } from '../util.js';
import { CATEGORIES, LEVELS, QUESTIONS } from '../data/interview.js';
import { PROBLEMS } from '../data/problems.js';

const catName = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.name]));
const probTitle = Object.fromEntries(PROBLEMS.map((p) => [p.id, p.title]));

export default {
  id: 'interview',
  title: '면접 Q&A',
  mount(el) {
    this.state = { cat: 'all', level: 'all', status: 'all', q: '' };
    this.open = new Set();
    this.listEl = h('div', { class: 'qa-list' });
    this.filterEl = h('div', { class: 'card flat stack' });
    this.countEl = h('span', { class: 'small muted' });

    el.append(
      h('div', { class: 'page-head' },
        h('h1', null, '면접 질문 & 모범 답변'),
        h('p', null, `데이터 분석가 면접에서 반복적으로 나오는 질문 ${QUESTIONS.length}개를 정리했습니다. 먼저 답을 소리 내어 말해본 뒤 펼쳐서 비교하세요. "익힘"으로 표시하면 진행 현황에 반영되고, ★는 다시 볼 질문입니다. SQL·pandas 질문은 "직접 풀어보기"로 문제은행과 연결됩니다.`)),
      h('div', { class: 'split' },
        h('aside', { class: 'sticky-side' }, this.filterEl),
        h('div', null,
          h('div', { class: 'row between', style: { marginBottom: '10px' } },
            this.countEl,
            h('div', { class: 'row' },
              h('button', { class: 'btn sm', onclick: () => { this.visible().forEach((q) => this.open.add(q.id)); this.renderList(); } }, '모두 펼치기'),
              h('button', { class: 'btn sm', onclick: () => { this.open.clear(); this.renderList(); } }, '모두 접기'))),
          this.listEl)));
    this.renderFilters();
    this.renderList();
  },

  onShow(params) {
    if (params.q) {
      const q = QUESTIONS.find((x) => x.id === params.q);
      if (q) {
        this.state = { cat: 'all', level: 'all', status: 'all', q: '' };
        this.open.add(q.id);
        this.renderFilters();
        this.renderList();
        requestAnimationFrame(() => document.getElementById(`qa-${q.id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
      }
    }
  },

  visible() {
    const { cat, level, status, q } = this.state;
    const known = new Set(store.get('qa:known', []));
    const marked = new Set(store.get('qa:bookmarks', []));
    const kw = q.trim().toLowerCase();
    return QUESTIONS.filter((x) =>
      (cat === 'all' || x.cat === cat) &&
      (level === 'all' || String(x.level) === level) &&
      (status === 'all' || (status === 'bookmarked' && marked.has(x.id)) || (status === 'known' && known.has(x.id)) || (status === 'unknown' && !known.has(x.id))) &&
      (!kw || (x.q + x.answer + (x.keyPoints || []).join(' ')).toLowerCase().includes(kw)));
  },

  renderFilters() {
    const s = this.state;
    const counts = QUESTIONS.reduce((m, q) => ((m[q.cat] = (m[q.cat] || 0) + 1), m), {});
    const chip = (key, val, label, count) => h('button', {
      class: `chip ${s[key] === val ? 'on' : ''}`, type: 'button',
      onclick: () => { s[key] = val; this.renderFilters(); this.renderList(); },
    }, label, count != null ? h('span', { class: 'count' }, count) : null);
    const search = h('input', { type: 'search', placeholder: '키워드 검색 (예: 윈도우, SRM)', value: s.q, 'aria-label': '질문 검색' });
    search.addEventListener('input', debounce(() => { s.q = search.value; this.renderList(); }, 150));
    // 좁은 화면에서는 필터를 접어 두고 검색창만 보여 질문 목록이 바로 보이게
    if (this.filtersOpen == null) this.filtersOpen = !window.matchMedia('(max-width: 900px)').matches;
    const active = [s.cat !== 'all', s.level !== 'all', s.status !== 'all'].filter(Boolean).length;
    const more = h('details', { class: 'filter-more', open: this.filtersOpen || null, ontoggle: (e) => { this.filtersOpen = e.target.open; } },
      h('summary', null, `필터${active ? ` (${active}개 적용)` : ''}`),
      h('div', { class: 'stack', style: { marginTop: '10px' } },
      h('div', null, h('div', { class: 'small muted', style: { marginBottom: '6px' } }, '카테고리'),
        h('div', { class: 'row' }, chip('cat', 'all', '전체', QUESTIONS.length), CATEGORIES.map((c) => chip('cat', c.id, c.name, counts[c.id] || 0)))),
      h('div', null, h('div', { class: 'small muted', style: { marginBottom: '6px' } }, '난이도'),
        h('div', { class: 'row' }, chip('level', 'all', '전체'), Object.entries(LEVELS).map(([k, v]) => chip('level', k, v)))),
      h('div', null, h('div', { class: 'small muted', style: { marginBottom: '6px' } }, '상태'),
        h('div', { class: 'row' }, chip('status', 'all', '전체'), chip('status', 'unknown', '아직'), chip('status', 'known', '익힘'), chip('status', 'bookmarked', '★ 다시 보기'))),
    ));
    this.filterEl.replaceChildren(search, more);
  },

  renderList() {
    const list = this.visible();
    this.countEl.textContent = `${list.length}개 질문`;
    if (!list.length) {
      this.listEl.replaceChildren(h('div', { class: 'card empty' }, '조건에 맞는 질문이 없습니다.'));
      return;
    }
    this.listEl.replaceChildren(...list.map((q) => this.renderItem(q)));
  },

  renderItem(q) {
    const isOpen = this.open.has(q.id);
    const marked = store.has('qa:bookmarks', q.id);
    const known = store.has('qa:known', q.id);
    const star = h('button', {
      class: `icon-btn ${marked ? 'on' : ''}`, title: '다시 볼 질문', 'aria-label': '북마크', type: 'button',
      onclick: (e) => { e.stopPropagation(); const on = store.toggle('qa:bookmarks', q.id); star.classList.toggle('on', on); star.textContent = on ? '★' : '☆'; },
    }, marked ? '★' : '☆');
    const head = h('div', {
      class: 'qa-head', role: 'button', tabindex: 0, 'aria-expanded': String(isOpen),
      onclick: () => { isOpen ? this.open.delete(q.id) : this.open.add(q.id); item.replaceWith(this.renderItem(q)); },
      onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); head.click(); } },
    },
    star,
    h('div', { style: { flex: 1, minWidth: 0 } },
      h('div', { class: 'qa-q' }, q.q),
      h('div', { class: 'qa-meta' },
        h('span', { class: 'badge' }, catName[q.cat]),
        h('span', { class: `badge lv-${q.level}` }, LEVELS[q.level]),
        known ? h('span', { class: 'badge ok' }, '익힘') : null)),
    h('span', { class: 'muted', 'aria-hidden': 'true' }, isOpen ? '▴' : '▾'));
    const item = h('div', { class: 'qa', id: `qa-${q.id}` }, head);
    if (isOpen) {
      item.append(h('div', { class: 'qa-body' },
        section('면접관 의도', h('p', { class: 'muted', style: { marginBottom: 0 } }, q.intent)),
        section('모범 답변', h('div', { class: 'md', html: md(q.answer) })),
        q.keyPoints?.length ? section('핵심 포인트 (이것만은 꼭)', h('ul', { class: 'keypoints' }, q.keyPoints.map((k) => h('li', null, k)))) : null,
        q.pitfalls?.length ? section('흔한 실수 → 이렇게 하세요', h('div', { class: 'mini-qa' }, q.pitfalls.map((x) => miniItem(x.text, x.fix, '✗')))) : null,
        q.followups?.length ? section('예상 꼬리 질문 (눌러서 짧은 답 보기)', h('div', { class: 'mini-qa' }, q.followups.map((x) => miniItem(x.q, x.a, 'Q')))) : null,
        h('div', { class: 'row', style: { marginTop: '16px' } },
          h('button', {
            class: `btn sm ${known ? '' : 'primary'}`, type: 'button',
            onclick: () => { store.toggle('qa:known', q.id); item.replaceWith(this.renderItem(q)); },
          }, known ? '익힘 해제' : '✓ 익힘으로 표시'),
          q.practice ? h('a', { class: 'btn sm', href: `#/problems?id=${q.practice}` }, `직접 풀어보기: ${probTitle[q.practice] || q.practice}`) : null)));
    }
    return item;
  },
};

/** depth 1 접이식 항목: 요약 한 줄 → 클릭하면 짧은 답 */
export function miniItem(title, answer, mark) {
  return h('details', { class: 'mini-item' },
    h('summary', null, h('span', { class: 'mini-mark' }, mark), h('span', null, title)),
    h('div', { class: 'mini-answer md', html: md(answer) }));
}

function section(title, body) {
  return h('div', { class: 'qa-section' }, h('h4', null, title), body);
}
