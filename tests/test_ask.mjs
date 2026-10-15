// 질문하기 엔진 정확도 테스트
//   node tests/test_ask.mjs           정확도 리포트 (기준 미달이면 실패)
//   node tests/test_ask.mjs --emit    샘플 테이블 질문의 생성 코드를 JSON으로 출력 (validate_content.py 가 실제 실행)
//
// tests/ask_cases.json 은 엔진 코드를 보지 않고 따로 작성한 질문 세트입니다 (규칙에 맞춘 질문만 넣지 않기 위해).
import { readFileSync, existsSync } from 'node:fs';
import { understand, build } from '../web/assets/js/ask/engine.js';

if (!existsSync(new URL('./ask_cases.json', import.meta.url))) {
  console.log(process.argv.includes('--emit') ? '[]' : 'tests/ask_cases.json 없음 — 건너뜀');
  process.exit(0);
}

const MIN_RECIPE_ACC = 0.85; // 레시피(의도) 정확도
const MIN_FULL_ACC = 0.7; // 레시피 + 빈칸까지 모두 맞은 비율

const cases = JSON.parse(readFileSync(new URL('./ask_cases.json', import.meta.url), 'utf8'));
const norm = (v) => (v == null ? null : String(v).toLowerCase());
const sameSet = (a = [], b = []) => a.length === b.length && a.every((x) => b.map(norm).includes(norm(x)));

function slotOk(key, exp, act) {
  if (exp === undefined) return true;
  if (Array.isArray(exp) && key === 'metrics') {
    return exp.every((m) => (act || []).some((x) => x.agg === m.agg && norm(x.col) === norm(m.col)));
  }
  if (Array.isArray(exp) && key === 'filters') {
    return exp.every((f) => (act || []).some((x) => norm(x.col) === norm(f.col) && x.op === f.op && (f.value === undefined || norm(x.value) === norm(f.value))));
  }
  if (Array.isArray(exp) && key === 'bins') return sameSet(exp.map(Number).map(String), (act || []).map(String));
  if (Array.isArray(exp)) return sameSet(exp, act);
  if (exp && typeof exp === 'object') return Object.entries(exp).every(([k, v]) => norm(act?.[k]) === norm(v));
  return norm(exp) === norm(act);
}

const emit = process.argv.includes('--emit');
let recipeOk = 0;
let fullOk = 0;
const fails = [];
const out = [];
for (const c of cases) {
  const r = understand(c.q, c.code || '');
  const best = r.confidence === 'low' && c.expect.recipe === 'none' ? null : r.best;
  const actual = best?.recipe || 'none';
  const okRecipe = actual === c.expect.recipe;
  const wrongSlots = okRecipe && best ? Object.keys(c.expect).filter((k) => k !== 'recipe' && !slotOk(k, c.expect[k], best.slots[k])) : [];
  if (okRecipe) recipeOk++;
  if (okRecipe && !wrongSlots.length) fullOk++;
  else fails.push({ q: c.q, expect: c.expect, actual, slots: best?.slots, wrongSlots });
  if (emit && c.sample && best) {
    const code = build(best.recipe, best.slots, r);
    out.push({ q: c.q, recipe: best.recipe, sql: code.sql, pandas: code.pandas });
  }
}

if (emit) {
  console.log(JSON.stringify(out));
} else {
  for (const f of fails) {
    console.log(`✗ ${f.q}\n   기대: ${JSON.stringify(f.expect)}\n   결과: ${f.actual} ${f.wrongSlots.length ? `(틀린 빈칸: ${f.wrongSlots.join(', ')}) ` : ''}${JSON.stringify(f.slots || {})}`);
  }
  const n = cases.length;
  const ra = recipeOk / n;
  const fa = fullOk / n;
  console.log(`\n질문하기: ${n}문항 · 레시피 정확도 ${(ra * 100).toFixed(1)}% · 빈칸까지 정확 ${(fa * 100).toFixed(1)}%`);
  if (ra < MIN_RECIPE_ACC || fa < MIN_FULL_ACC) {
    console.log(`기준 미달 (레시피 ${MIN_RECIPE_ACC * 100}% · 전체 ${MIN_FULL_ACC * 100}%)`);
    process.exit(1);
  }
  console.log('기준 통과');
}
