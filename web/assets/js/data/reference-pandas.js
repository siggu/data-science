// pandas 문법 레퍼런스 — 형식은 reference.js 주석 참고
export const PANDAS_REF = [
  {
    id: 'inspect', tier: 'core', group: '데이터 살펴보기',
    title: 'head · shape · info · describe',
    summary: 'DataFrame의 크기, 타입, 분포를 빠르게 확인합니다.',
    body: `
      분석을 시작하면 먼저 데이터 모양을 확인합니다.
      - \`df.head(n)\` / \`df.tail(n)\`: 앞/뒤 n행
      - \`df.shape\`: (행 수, 열 수)
      - \`df.dtypes\`, \`df.info()\`: 컬럼 타입과 결측 여부
      - \`df.describe()\`: 숫자 컬럼의 개수·평균·표준편차·사분위수`,
    syntax: `df.head(5)
df.shape
df.dtypes
df.describe()`,
    examples: [
      { title: '주문 테이블 숫자 컬럼 요약', code: `orders[['discount_amount', 'total_amount']].describe()` },
      { title: '행·열 개수', code: `orders.shape` },
    ],
    tips: `
      - 날짜가 \`object\`(문자열)로 읽혔다면 \`pd.to_datetime\`으로 바꿔야 날짜 연산이 됩니다.
      - \`describe(include='all')\`은 문자열 컬럼의 고유값 수·최빈값도 보여줍니다.`,
    related: ['pd-01'],
  },
];
