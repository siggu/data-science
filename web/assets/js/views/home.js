import { h, md, store } from '../util.js';
import { QUESTIONS } from '../data/interview.js';
import { PROBLEMS } from '../data/problems.js';
import { CASES } from '../data/cases.js';
import { CERTS } from '../data/certs.js';

const SKILLS = [
  { name: 'SQL', level: '필수', desc: '2026년 데이터 직무 공고의 **79%**가 SQL을 요구했습니다 (전년 61%). 신입 면접에서도 가장 먼저 확인합니다. **윈도우 함수, CTE, 코호트·퍼널 쿼리**에서 실력 차이가 드러납니다.' },
  { name: 'Python · pandas', level: '필수', desc: '정제, 결합, 집계, 시계열 처리를 봅니다. SQL로 할 수 있는 것을 pandas로도 똑같이 할 수 있어야 하고, 대용량은 Spark로 넘기는 판단도 필요합니다.' },
  { name: '통계 · A/B 테스트', level: '차별화', desc: '실험 관련 요구가 1년 새 **+14%p** 늘었습니다. 가설검정, 표본 크기, 검정력, SRM, 인과추론을 다룹니다. 토스·쿠팡 DA 공고의 공통 업무는 "지표·가설 설정 → 실험 설계 → Action Item 제안"입니다.' },
  { name: '프로덕트 센스', level: '차별화', desc: '"DAU가 10% 떨어졌다면?" 같은 모호한 비즈니스 질문을 구조화하는 케이스 면접이 핵심입니다. 지표 설계와 원인 분석 프레임워크가 필요합니다.' },
  { name: '데이터 파이프라인', level: '트렌드', desc: 'ETL 경험 요구 **+18%p**, dbt·Snowflake·Databricks 같은 모던 데이터 스택 요구가 늘었습니다. 엔지니어를 기다리지 않고 Gold 테이블을 직접 만드는 분석가를 선호합니다.' },
  { name: '커뮤니케이션', level: '합격 결정', desc: '분석 결과를 비즈니스 제안으로 바꿔 전달하는 능력입니다. 면접 루프에서 **합격과 탈락을 가르는 가장 흔한 이유**입니다. AI가 단순 분석을 자동화할수록 더 중요해집니다.' },
];

const ROUTE = [
  { week: '1주차', title: 'SQL 기본기 다지기', items: ['면접 Q&A → SQL 카테고리 정독', '문제은행 SQL 초급 전부 + 중급 절반', 'Databricks 탭의 문법 대응표 훑기'] },
  { week: '2주차', title: '윈도우 함수 · 코호트 · pandas', items: ['SQL 중급/고급 (리텐션, 연속 접속, 퍼널)', '같은 문제를 pandas로 다시 풀기', '면접 Q&A → pandas, 지표 카테고리'] },
  { week: '3주차', title: '통계 · 실험', items: ['면접 Q&A → 통계, A/B 테스트', 'A/B 도구: 표본 크기 → 결과 분석 → SRM → 피킹 시뮬레이터', '케이스: "두 개의 A/B 테스트 결과 해석"'] },
  { week: '4주차', title: '케이스 · 모의 면접', items: ['케이스 트레이닝 전체 (단계별 답안 작성)', '모의 면접 10문항 × 매일 1세트', '행동 질문 STAR 답변 3개 작성'] },
];

export default {
  id: 'home',
  title: '홈',
  mount(el) {
    this.el = el;
  },
  onShow() {
    const el = this.el;
    const known = store.get('qa:known', []).length;
    const solved = store.get('prob:solved', []).length;
    const mocks = store.get('mock:history', []);
    const casesDone = store.get('case:done', []).length;
    const avg = mocks.length ? (mocks.reduce((s, m) => s + m.avg, 0) / mocks.length).toFixed(1) : '–';

    el.replaceChildren(
      h('div', { class: 'hero' },
        h('div', { class: 'card' },
          h('h1', null, '데이터 분석가 면접, 실전처럼 준비하기'),
          h('p', { class: 'muted' }, '최신 면접 질문과 모범 답변을 익히고, 브라우저에서 바로 SQL·pandas를 실행해 볼 수 있습니다. 설치 없이 DuckDB(SQL)와 Pyodide(pandas)가 브라우저에서 돌아가고, 같은 샘플 데이터로 로컬 Spark + Delta Lake(Databricks와 거의 같은 Spark SQL·Delta 문법) 환경도 쓸 수 있습니다.'),
          h('div', { class: 'row', style: { marginTop: '14px' } },
            h('a', { class: 'btn primary', href: '#/interview' }, '면접 Q&A 보기'),
            h('a', { class: 'btn', href: '#/playground' }, 'SQL·pandas 연습하기'),
            h('a', { class: 'btn', href: '#/mock' }, '모의 면접 시작'))),
        h('div', { class: 'card' },
          h('h3', null, '나의 진행 현황'),
          h('div', { class: 'grid', style: { gap: '14px', marginTop: '10px', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } },
            kpi(`${known} / ${QUESTIONS.length}`, '익힌 면접 질문'),
            kpi(`${solved} / ${PROBLEMS.length}`, '맞힌 연습 문제'),
            kpi(`${mocks.length}회`, mocks.length ? `모의 면접 (평균 ${avg}점)` : '모의 면접'),
            kpi(`${casesDone} / ${CASES.length}`, '완료한 케이스')),
          h('p', { class: 'small muted', style: { marginTop: '12px', marginBottom: 0 } }, '진행 현황은 이 브라우저에만 저장됩니다.'))),

      h('div', { class: 'grid grid-2' },
        h('div', { class: 'card' },
          h('h2', null, '기업이 원하는 DA 역량 (2026)'),
          h('p', { class: 'small muted' }, '국내외 채용 공고 분석, 면접 가이드, 토스·쿠팡 DA 공고를 기준으로 정리했습니다.'),
          SKILLS.map((s) => h('div', { class: 'skill-row' },
            h('div', null, h('b', null, s.name), h('div', null, h('span', { class: 'badge accent' }, s.level))),
            h('div', { class: 'md small', html: md(s.desc) }))),
          h('p', { class: 'small muted', style: { marginTop: '10px', marginBottom: 0 } },
            '출처: ', src('365 Data Science (2026 공고 1,000건 분석)', 'https://365datascience.com/career-advice/data-scientist-job-market/'), ', ',
            src('Interview Query', 'https://www.interviewquery.com/p/data-scientist-skills-2026'), ', ',
            src('토스 DA 공고', 'https://career.rememberapp.co.kr/job/posting/261673'), ', ',
            src('링커리어', 'https://community.linkareer.com/employment_data/6158482'))),
        h('div', { class: 'stack' },
          h('div', { class: 'card' },
            h('h2', null, '4주 학습 루트'),
            ROUTE.map((r) => h('div', { class: 'skill-row' },
              h('div', null, h('b', null, r.week), h('div', { class: 'small muted' }, r.title)),
              h('ul', { style: { margin: 0 } }, r.items.map((i) => h('li', { class: 'small' }, i)))))),
          h('div', { class: 'card' },
            h('h3', null, '면접 구성 (일반적인 DA/DS 루프)'),
            h('div', { class: 'md small', html: md(`
              1. **SQL 라이브 코딩 / 과제**: 조인, 윈도우 함수, 코호트·퍼널
              2. **통계·실험**: p-value, 검정력, A/B 설계와 해석
              3. **프로덕트 케이스**: 지표 하락 원인, 신규 기능 지표 설계
              4. **Python/pandas**: 데이터 정제와 집계 (과제형 포함)
              5. **행동·컬처핏**: STAR 경험, 커뮤니케이션, 협업
            `) })))),

      h('h2', { style: { marginTop: '24px' } }, '바로가기'),
      h('div', { class: 'grid grid-3' },
        navCard('#/interview', '면접 Q&A', `${QUESTIONS.length}개 질문 · 모범 답변 · 면접관 의도 · 꼬리 질문`),
        navCard('#/playground', 'SQL · pandas 플레이그라운드', '샘플 DB 8개 테이블 · CSV 업로드 · SQL 결과를 pandas로 전달'),
        navCard('#/problems', '문제은행', `${PROBLEMS.length}문제 자동 채점 · SQL과 pandas 풀이 비교`),
        navCard('#/mock', '모의 면접', '랜덤 질문 · 타이머 · 핵심 포인트로 자기 채점 · 기록'),
        navCard('#/abtest', 'A/B 테스트 도구', '표본 크기 · 결과 분석 · SRM 검사 · 피킹 시뮬레이터'),
        navCard('#/cases', '케이스 트레이닝', `${CASES.length}개 프로덕트 케이스 · 단계별 모범 답안 · 데이터로 검증`),
        navCard('#/certs', '자격증 (SQLD · ADsP)', `${CERTS.reduce((n, c) => n + c.questions.length, 0)}문제 · 핵심 요약 · 실전 모의고사(과락 판정) · 오답노트 · D-day`),
        navCard('#/databricks', 'Databricks 팩', '문법 대응표 · Delta/Unity Catalog · 자격증 연습 퀴즈')),
    );
  },
};

function kpi(v, l) {
  return h('div', { class: 'kpi' }, h('span', { class: 'v' }, v), h('span', { class: 'l' }, l));
}
function src(t, u) {
  return h('a', { href: u, target: '_blank', rel: 'noopener' }, t);
}
function navCard(href, title, desc) {
  return h('a', { class: 'card nav-card', href }, h('div', { class: 'k' }, '→'), h('h3', null, title), h('div', { class: 'small muted' }, desc));
}
