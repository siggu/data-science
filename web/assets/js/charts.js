// 가벼운 SVG 차트 (선, 히스토그램, 막대) + 호버 툴팁
// 색은 CSS 토큰(--series-1, --series-2, --series-muted)을 사용해 라이트/다크 모드를 따라갑니다.

const NS = 'http://www.w3.org/2000/svg';

function s(tag, attrs = {}, ...children) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  for (const c of children) if (c != null) el.append(c);
  return el;
}

let tipEl;
function tip(e, html) {
  if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'chart-tip'; document.body.append(tipEl); }
  tipEl.innerHTML = html;
  tipEl.style.display = 'block';
  const x = Math.min(e.clientX + 12, window.innerWidth - tipEl.offsetWidth - 8);
  tipEl.style.left = `${x}px`;
  tipEl.style.top = `${e.clientY + 12}px`;
}
function hideTip() { if (tipEl) tipEl.style.display = 'none'; }

function niceTicks(min, max, n = 4) {
  const span = max - min || 1;
  const step0 = span / n;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((st) => span / st <= n) || step0;
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(+v.toFixed(10));
  return ticks;
}

function frame({ width, height, m, xs, ys, xTicks, yTicks, xFmt = String, yFmt = String, xLabel, yLabel }) {
  const svg = s('svg', { viewBox: `0 0 ${width} ${height}`, class: 'chart', role: 'img' });
  const g = s('g', { class: 'grid' });
  for (const t of yTicks) g.append(s('line', { x1: m.l, x2: width - m.r, y1: ys(t), y2: ys(t) }));
  svg.append(g);
  const ax = s('g', { class: 'axis' });
  for (const t of yTicks) ax.append(s('text', { x: m.l - 6, y: ys(t) + 4, 'text-anchor': 'end' }, yFmt(t)));
  for (const t of xTicks) ax.append(s('text', { x: xs(t), y: height - m.b + 16, 'text-anchor': 'middle' }, xFmt(t)));
  ax.append(s('line', { x1: m.l, x2: width - m.r, y1: height - m.b, y2: height - m.b }));
  if (xLabel) ax.append(s('text', { x: (m.l + width - m.r) / 2, y: height - 4, 'text-anchor': 'middle' }, xLabel));
  if (yLabel) ax.append(s('text', { x: 8, y: 14, 'text-anchor': 'start' }, yLabel));
  svg.append(ax);
  return svg;
}

/**
 * lineChart({ series: [{ values:[y...], color, width, label }], xMax, yMin, yMax, hline, ... })
 * x는 인덱스(1부터). hline: { y, label } 기준선
 */
export function lineChart({ series, yMin = 0, yMax = 1, hline, xLabel, yLabel, yFmt = (v) => v, width = 860, height = 320, highlight }) {
  const m = { l: 48, r: 16, t: 34, b: 40 };
  const n = Math.max(...series.map((se) => se.values.length));
  const xs = (i) => m.l + ((i - 1) / Math.max(1, n - 1)) * (width - m.l - m.r);
  const ys = (v) => height - m.b - ((Math.min(Math.max(v, yMin), yMax) - yMin) / (yMax - yMin)) * (height - m.t - m.b);
  const svg = frame({ width, height, m, xs, ys, xTicks: niceTicks(1, n, 6).filter((t) => t >= 1 && Number.isInteger(t)), yTicks: niceTicks(yMin, yMax, 4), yFmt, xLabel, yLabel });
  for (const se of series) {
    const d = se.values.map((v, i) => `${i ? 'L' : 'M'}${xs(i + 1).toFixed(1)},${ys(v).toFixed(1)}`).join('');
    svg.append(s('path', { d, fill: 'none', stroke: se.color, 'stroke-width': se.width || 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', opacity: se.opacity ?? 1 }));
  }
  if (hline) {
    svg.append(s('line', { x1: m.l, x2: width - m.r, y1: ys(hline.y), y2: ys(hline.y), stroke: 'var(--text-2)', 'stroke-dasharray': '4 4', 'stroke-width': 1.5 }));
    svg.append(s('text', { x: width - m.r, y: ys(hline.y) - 6, 'text-anchor': 'end' }, hline.label));
  }
  // 크로스헤어 + 툴팁
  const cross = s('line', { y1: m.t, y2: height - m.b, stroke: 'var(--text-3)', 'stroke-width': 1, visibility: 'hidden' });
  svg.append(cross);
  const hit = s('rect', { x: m.l, y: m.t, width: width - m.l - m.r, height: height - m.t - m.b, fill: 'transparent' });
  hit.addEventListener('mousemove', (e) => {
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * width;
    const i = Math.round(((px - m.l) / (width - m.l - m.r)) * (n - 1)) + 1;
    if (i < 1 || i > n) return;
    cross.setAttribute('x1', xs(i)); cross.setAttribute('x2', xs(i)); cross.setAttribute('visibility', 'visible');
    const rows = (highlight || series).filter((se) => se.label).map((se) => `${se.label}: ${yFmt(se.values[i - 1])}`);
    tip(e, `<b>${xLabel ? xLabel.replace(/\s*\(.*\)/, '') : 'x'} ${i}</b>${rows.length ? '<br>' + rows.join('<br>') : ''}`);
  });
  hit.addEventListener('mouseleave', () => { cross.setAttribute('visibility', 'hidden'); hideTip(); });
  svg.append(hit);
  return svg;
}

/** histogram({ bins: [{x0, x1, count}], color, xFmt, overlay: [{bins, color}] }) */
export function histogram({ layers, xFmt = (v) => v, xLabel, yLabel, width = 860, height = 300, vline }) {
  const m = { l: 48, r: 16, t: 34, b: 40 };
  const all = layers.flatMap((l) => l.bins);
  const x0 = Math.min(...all.map((b) => b.x0));
  const x1 = Math.max(...all.map((b) => b.x1));
  const yMax = Math.max(1, ...all.map((b) => b.count)) * 1.1;
  const xs = (v) => m.l + ((v - x0) / (x1 - x0)) * (width - m.l - m.r);
  const ys = (v) => height - m.b - (v / yMax) * (height - m.t - m.b);
  const svg = frame({ width, height, m, xs, ys, xTicks: niceTicks(x0, x1, 5), yTicks: niceTicks(0, yMax, 4), xFmt, xLabel, yLabel });
  layers.forEach((l, li) => {
    for (const b of l.bins) {
      const w = Math.max(1, xs(b.x1) - xs(b.x0) - 2);
      const rect = s('rect', { x: xs(b.x0) + 1, y: ys(b.count), width: w, height: Math.max(0, ys(0) - ys(b.count)), fill: l.color, opacity: layers.length > 1 ? 0.7 : 1, rx: 2 });
      rect.addEventListener('mousemove', (e) => tip(e, `${l.label ? `<b>${l.label}</b><br>` : ''}${xFmt(b.x0)} ~ ${xFmt(b.x1)}<br>${b.count.toLocaleString()}회`));
      rect.addEventListener('mouseleave', hideTip);
      svg.append(rect);
    }
    if (li === 0 && vline) {
      svg.append(s('line', { x1: xs(vline.x), x2: xs(vline.x), y1: m.t, y2: height - m.b, stroke: 'var(--text-2)', 'stroke-dasharray': '4 4', 'stroke-width': 1.5 }));
      svg.append(s('text', { x: xs(vline.x) + 4, y: m.t + 10 }, vline.label));
    }
  });
  return svg;
}

export function bins(values, lo, hi, n) {
  const w = (hi - lo) / n;
  const out = Array.from({ length: n }, (_, i) => ({ x0: lo + i * w, x1: lo + (i + 1) * w, count: 0 }));
  for (const v of values) {
    if (v < lo || v > hi) continue;
    out[Math.min(n - 1, Math.floor((v - lo) / w))].count++;
  }
  return out;
}
