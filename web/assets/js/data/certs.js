import { SQLD } from './cert-sqld.js';
import { ADSP } from './cert-adsp.js';

export const CERTS = [SQLD, ADSP];

// 함께 고려할 만한 데이터 직무 자격증 (간단 안내)
export const OTHER_CERTS = [
  {
    name: '빅데이터분석기사',
    level: '중급',
    desc: '한국데이터산업진흥원이 시행하는 **국가기술자격**입니다. 필기(빅데이터 분석 기획, 탐색, 모델링, 결과 해석)와 **실기(Python/R 작업형)**로 나뉩니다. ADsP 3과목과 범위가 많이 겹쳐서 **ADsP → 빅데이터분석기사** 순서로 준비하는 경우가 많습니다.',
  },
  {
    name: 'SQLP (SQL 전문가)',
    level: '상급',
    desc: 'SQLD의 상위 자격으로 SQL 고급 활용과 **튜닝**(실행계획, 인덱스, 조인 원리)까지 다룹니다. 합격률이 낮아 DA보다는 데이터 엔지니어나 DBA 지원 시 더 강한 차별화 요소입니다.',
  },
  {
    name: 'ADP (데이터분석 전문가)',
    level: '상급',
    desc: 'ADsP의 상위 자격으로 필기와 **실기(분석 과제 수행)**가 있습니다. 난이도가 높아 취득하면 강한 경쟁력이 되지만, 준비 기간이 길어 실무 포트폴리오와 함께 장기 목표로 잡는 것을 권장합니다.',
  },
  {
    name: 'Databricks Certified Data Analyst Associate',
    level: '중급',
    desc: 'Databricks SQL, 대시보드, Genie, Unity Catalog를 다루는 벤더 자격증입니다. Databricks를 쓰는 회사라면 실무와 바로 연결됩니다. → [Databricks 탭의 연습 퀴즈](#/databricks)',
  },
];

export const CERT_ROADMAP = `
**DA 신입·주니어 추천 순서**: **SQLD**(SQL 증명, 2~3주) → **ADsP**(통계·분석 이론, 3~4주) → (선택) 빅데이터분석기사 또는 Databricks 자격증

- 자격증은 서류 단계의 **기본 역량 증빙**입니다. 면접에서는 "자격증 공부로 배운 것을 실제로 어떻게 썼는지"를 묻는 경우가 많으니, 이 사이트의 문제은행과 케이스 트레이닝으로 실전 감각을 함께 기르세요.
- 시험 일정과 접수 기간은 변경될 수 있으니 [데이터자격검정 공식 사이트(dataq.or.kr)](https://www.dataq.or.kr)에서 꼭 확인하세요.
`;
