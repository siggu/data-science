// 질문 해석용 단어 사전 (한국어 + 영어)

export const AGG_CUES = [
  // [agg, 정규식] — 위에서부터 먼저 검사 (nunique 를 count 보다 먼저)
  ['nunique', /(고유\s*(값\s*)?(개수|갯수|수)|유니크|중복\s*(없이|제외(하고|한)?|제거(하고|한)?)\s*(개수|갯수|수|센)|서로\s*다른\s*\S*\s*(개수|수)|\bdistinct\b|\bnunique\b|몇\s*(명|종류|가지))/i],
  ['median', /(중앙값|중간값|\bmedian\b)/i],
  ['mean', /(평균|\bmean\b|\bavg\b|\baverage\b)/i],
  // '합'은 앞에 다른 한글이 없을 때만 (조합·종합·누적합의 합 제외), '총'은 금액·수량 앞에서만
  ['sum', /(합계|합산|총합|총액|총량|총\s*(?=매출|금액|판매|수량|결제|구매액|매출액)|(?<![가-힣])합(?:을|이)|(?<![가-힣])합(?![가-힣])|더한|더해|\bsum\b|\btotal\b)/i],
  ['max', /(최댓값|최대값|최대|\bmax\b)/i],
  ['min', /(최솟값|최소값|최소|\bmin\b)/i],
  ['count', /(건수|개수|갯수|횟수|빈도|인원|명수|\bcount\b|몇\s*(개|건|번)|(?<![가-힣])수(?!\s*(?:있|없))(?=[를가는도의랑와과만\s,.?)]|하고|$))/i],
];

export const AGG_LABEL = { sum: '합계', mean: '평균', count: '개수(행 수)', nunique: '고유값 개수', max: '최댓값', min: '최솟값', median: '중앙값' };
export const AGG_SQL = { sum: 'SUM', mean: 'AVG', count: 'COUNT', nunique: 'COUNT', max: 'MAX', min: 'MIN', median: 'MEDIAN' };
export const AGG_SUFFIX = { sum: 'sum', mean: 'avg', count: 'cnt', nunique: 'nunique', max: 'max', min: 'min', median: 'median' };

// 날짜 단위 (월별, 일별 …)
export const DATE_UNITS = [
  ['dow', /(요일별|요일\s*마다|by\s*weekday|day\s*of\s*week)/i],
  ['hour', /(시간별|시간대별|시간\s*단위|hourly|by\s*hour)/i],
  ['day', /(일별|일자별|날짜별|하루\s*단위|daily|by\s*day|일\s*단위)/i],
  ['week', /(주별|주간|주\s*단위|weekly|by\s*week)/i],
  ['month', /(월별|월간|달별|월\s*단위|monthly|by\s*month)/i],
  ['quarter', /(분기별|분기\s*단위|quarterly)/i],
  ['year', /(연도별|년도별|연별|년별|연간|yearly|annual|by\s*year)/i],
];
export const UNIT_LABEL = { dow: '요일', hour: '시간', day: '일', week: '주', month: '월', quarter: '분기', year: '연도' };

export const CUES = {
  top: /(상위|top\s*\d*|(가장|제일)\s*(많|큰|높|비싼)|많이\s*(팔린|산|쓴|주문)|높은\s*순|큰\s*순|많은\s*순|내림차순|best|베스트)/i,
  bottom: /(하위|bottom|(가장|제일)\s*(적|작|낮|싼)|적은\s*순|작은\s*순|낮은\s*순|오름차순)/i,
  sort: /(정렬|sort|order\s*by|순서대로|순으로)/i,
  join: /(조인|join|merge|합치|합쳐|붙이|붙여|연결해|매칭|두\s*테이블|vlookup)/i,
  pivot: /(피벗|pivot|가로로|열로\s*(펼|만들|바꿔)|크로스\s*탭|crosstab|행은.*열은)/i,
  running: /(누적\s*(합|합계|매출|판매|금액|값|개수|수|평균)?|cumsum|cumulative|running\s*total)/i,
  lag: /((전월|전일|전주|전년|전분기|이전|직전|지난\s*(달|주|해|날))\s*(대비|보다|와|과)?|증감|증가율|감소율|성장률|변화량|차이\s*를?\s*(구|계산)|lag|lead|pct_change|diff\b)/i,
  rank: /(순위|랭킹|랭크|등수|rank|ranking|몇\s*위)/i,
  share: /(비중|점유율|구성비|차지하는\s*(비율|비중)|share|전체\s*대비\s*비율|퍼센트\s*비중)/i,
  rate: /(비율|전환율|구매율|이탈률|재구매율|클릭률|[가-힣]율(?![가-힣])|[가-힣]률(?![가-힣])|rate|ratio|퍼센트|%)/i,
  bucket: /(구간|등급|분류해|분류하|나누어|나눠|라벨|레이블|bin|cut|qcut|분위|티어|tier|그룹으로\s*나)/i,
  moving: /(이동\s*평균|이동\s*합|rolling|moving\s*average|최근\s*\d+\s*(일|개|주|행)\s*(평균|합))/i,
  null: /(결측|null|nan|na\b|비어\s*있|빈\s*값|빈\s*칸|누락|missing|none\s*값)/i,
  fill: /(채우|채워|대체|fillna|coalesce|바꿔|0으로)/i,
  drop: /(제거|삭제|빼고|지우|지워|없애|drop|제외)/i,
  dedupe: /(중복)/i,
  distinct: /(고유값|고유한\s*(값|조합)|조합\s*목록|유니크|unique|distinct|종류|어떤\s*값들?|값\s*목록|목록을?\s*(보|뽑))/i,
  filter: /(인\s*(것|행|데이터|건|주문|유저|고객)|만\s*(보|뽑|골라|추출|필터|남)|필터|조건|where|이상|이하|초과|미만|보다\s*(큰|작은|많은|적은)|포함|들어간|제외|아닌)/i,
  count_rows: /(몇\s*(개|건|행)|행\s*(수|개수)|레코드\s*수|row\s*count)/i,
};

// 한국어 표현 → 컬럼 이름에 들어갈 법한 영문 조각 (앞에 있을수록 우선)
export const SYNONYMS = [
  [/매출|매출액|판매액|판매\s*금액|결제\s*금액|금액|revenue/, ['sales_amt', 'sales_amount', 'revenue', 'total_amount', 'amount', 'amt', 'sales', 'price']],
  [/판매량|판매\s*수량|수량|qty/, ['sales_qty', 'qty', 'quantity', 'cnt', 'count']],
  [/가격|단가/, ['price', 'unit_price', 'amount']],
  [/할인/, ['discount_amount', 'discount']],
  [/시도|시·도|광역|지역/, ['si_do_name', 'sido', 'si_do', 'region', 'area', 'city', 'state']],
  [/시군구|구군/, ['sigungu', 'si_gun_gu', 'gu', 'district']],
  [/국가|나라/, ['country', 'nation']],
  [/채널|유입/, ['channel', 'source', 'medium']],
  [/디바이스|기기|플랫폼/, ['device', 'platform', 'os']],
  [/카테고리|분류|품목/, ['category', 'cat', 'product_category']],
  [/상품명|제품명/, ['product_name', 'item_name', 'name']],
  [/상품|제품|품목|아이템/, ['product_id', 'product', 'item_id', 'item', 'sku', 'product_name']],
  [/고객|유저|사용자|회원|사람|구매자/, ['user_id', 'customer_id', 'member_id', 'user', 'customer']],
  [/주문/, ['order_id', 'order']],
  [/세션/, ['session_id', 'session']],
  [/매장|점포|지점/, ['store_id', 'store', 'shop', 'branch']],
  [/부서/, ['dept_name', 'department', 'dept_id', 'dept']],
  [/직원|사원/, ['emp_id', 'employee', 'name']],
  [/급여|연봉|월급/, ['salary', 'pay', 'wage']],
  [/상태/, ['status', 'state']],
  [/결제\s*수단|결제\s*방법/, ['payment_method', 'payment', 'pay_method']],
  [/이벤트|행동/, ['event_type', 'event', 'action']],
  [/버전/, ['app_version', 'version']],
  [/연령|나이/, ['age_group', 'age']],
  [/성별/, ['gender', 'sex']],
  [/점수|평점|스코어/, ['score', 'rating', 'point']],
  [/전환|구매\s*여부/, ['converted', 'is_converted', 'purchase', 'is_purchase']],
  [/실험|그룹|variant/, ['variant', 'group', 'experiment']],
  [/가입일|가입\s*날짜/, ['signup_date', 'join_date', 'reg_date', 'created_at']],
  [/주문일|주문\s*날짜|주문\s*시각/, ['order_ts', 'order_date', 'order_dt', 'ordered_at']],
  [/날짜|일자|일시|시각|시간|기간|date/, ['date', 'dt', 'sale_date', 'sales_date', 'order_date', 'order_ts', 'event_ts', 'ts', 'created_at', 'timestamp', 'ymd', 'base_dt']],
];

// 날짜 컬럼으로 보이는 이름
export const DATE_COL = /(date|_dt$|^dt$|_ts$|^ts$|time|_at$|ymd|day$|month$|일자|날짜)/i;
// 숫자 값 컬럼으로 보이는 이름
export const NUM_COL = /(qty|quantity|amount|amt|price|sales|revenue|cnt|count|value|score|total|cost|profit|salary|discount|num|금액|수량|매출)/i;
// 키(ID) 컬럼으로 보이는 이름
export const KEY_COL = /(_id$|^id$|_cd$|_code$|_key$|_no$)/i;
