// pandas 문법 레퍼런스 — 형식은 reference.js 주석 참고
export const PANDAS_REF = [
  // ───────────────────────── core: 데이터 살펴보기 ─────────────────────────
  {
    id: 'inspect', tier: 'core', group: '데이터 살펴보기',
    title: 'head · shape · info · describe',
    summary: 'DataFrame의 크기, 타입, 분포를 빠르게 확인합니다.',
    body: `
      분석을 시작하면 먼저 데이터 모양을 확인합니다. 행 수, 컬럼 타입, 결측 여부를 알아야 이후 필터·집계에서 실수하지 않습니다.
      - \`df.head(n)\` / \`df.tail(n)\`: 앞/뒤 n행 (기본 5행)
      - \`df.shape\`: (행 수, 열 수) — 괄호 없는 속성입니다
      - \`df.dtypes\`, \`df.info()\`: 컬럼 타입과 결측이 아닌 값의 개수
      - \`df.describe()\`: 숫자 컬럼의 개수·평균·표준편차·최솟값·사분위수·최댓값`,
    syntax: `df.head(5)
df.shape
df.dtypes
df.info()
df.describe(include='all')`,
    examples: [
      { title: '주문 테이블 숫자 컬럼 요약', code: `orders[['discount_amount', 'total_amount']].describe()` },
      { title: '행·열 개수', code: `orders.shape` },
      { title: '컬럼 타입 확인 (날짜가 datetime64인지)', code: `orders.dtypes` },
    ],
    tips: `
      - 날짜가 \`object\`(문자열)로 읽혔다면 \`pd.to_datetime\`으로 바꿔야 날짜 연산이 됩니다.
      - \`describe(include='all')\`은 문자열 컬럼의 고유값 수(unique)·최빈값(top)도 보여줍니다.
      - \`info()\`는 결과를 반환하지 않고 출력만 합니다. 결측 개수는 \`df.isna().sum()\`이 더 보기 쉽습니다.`,
  },
  {
    id: 'value-counts', tier: 'core', group: '데이터 살펴보기',
    title: 'value_counts · nunique · unique',
    summary: '범주형 컬럼의 값별 빈도, 고유값 개수, 고유값 목록을 구합니다.',
    body: `
      범주 컬럼의 분포를 볼 때 가장 먼저 쓰는 함수입니다. \`value_counts()\`는 값별 행 수를 **많은 순으로 정렬**해서 Series로 돌려줍니다.
      - \`normalize=True\`: 개수 대신 비율
      - \`dropna=False\`: 결측(NaN)도 하나의 값으로 셈 (기본은 제외)
      - \`nunique()\`: 고유값 개수(NaN 제외), \`unique()\`: 고유값 배열(등장 순서)
      - \`df.value_counts(['a', 'b'])\`: 여러 컬럼 조합의 빈도`,
    syntax: `s.value_counts(normalize=False, dropna=True, ascending=False)
df.value_counts(['col1', 'col2'])
s.nunique(dropna=True)
s.unique()`,
    examples: [
      { title: '유입 채널별 가입자 수', code: `users['channel'].value_counts()` },
      { title: '국가별 비율 (%)', code: `(users['country'].value_counts(normalize=True) * 100).round(1)` },
      { title: '쿠폰 미사용(NaN)까지 포함한 빈도와 표 형태 변환', code: `orders['coupon_code'].value_counts(dropna=False).reset_index()` },
      { title: '컬럼별 고유값 개수 (유저 수, 세션 수 …)', code: `events[['user_id', 'session_id', 'event_type']].nunique()` },
    ],
    tips: `
      - pandas 2.x에서 \`value_counts()\` 결과의 이름은 \`count\`(비율이면 \`proportion\`)입니다. \`.reset_index()\`하면 \`[원래 컬럼, count]\` 두 컬럼이 됩니다.
      - 결측이 있는 컬럼은 \`dropna=False\`를 붙여야 전체 합이 행 수와 맞습니다.
      - 알파벳/날짜 순으로 보려면 \`.sort_index()\`를 이어 붙입니다.`,
    dbx: `SQL: \`SELECT col, COUNT(*) FROM t GROUP BY col ORDER BY 2 DESC\` · PySpark: \`df.groupBy('col').count().orderBy(F.desc('count'))\`, 고유값 개수는 \`F.countDistinct\``,
    related: ['pd-02', 'sql-01'],
  },

  // ───────────────────────── core: 선택·필터 ─────────────────────────
  {
    id: 'select-columns', tier: 'core', group: '선택·필터',
    title: '열 선택: [ ] 와 [[ ]]',
    summary: '컬럼 하나는 Series로, 여러 개는 DataFrame으로 꺼냅니다.',
    body: `
      \`df['col']\`은 **Series**(1차원), \`df[['col1', 'col2']]\`는 **DataFrame**(2차원)을 돌려줍니다. 대괄호 안에 리스트를 넣느냐가 차이입니다.
      - 분석 결과로 넘길 표는 필요한 컬럼만 \`[[...]]\`로 골라 둡니다.
      - 타입으로 고르기: \`df.select_dtypes('number')\`, 이름 패턴으로 고르기: \`df.filter(like='amount')\``,
    syntax: `df['col']                 # Series
df[['col1', 'col2']]      # DataFrame
df.select_dtypes('number')
df.filter(like='part_of_name')`,
    examples: [
      { title: '필요한 컬럼만 골라 보기', code: `orders[['order_id', 'user_id', 'total_amount']].head()` },
      { title: '[ ] 와 [[ ]] 의 결과 타입 차이', code: `type(orders['total_amount']).__name__, type(orders[['total_amount']]).__name__` },
      { title: '이름에 amount가 들어간 컬럼만', code: `orders.filter(like='amount').head(3)` },
    ],
    tips: `
      - \`df.col\`(점 표기)도 되지만 컬럼명이 메서드명(\`count\`, \`size\` 등)과 겹치거나 공백이 있으면 동작하지 않습니다. \`df['col']\`을 기본으로 쓰세요.
      - 새 컬럼을 만들 때는 반드시 \`df['new'] = ...\` 형태여야 합니다. \`df.new = ...\`는 컬럼이 아니라 속성이 생깁니다.`,
    dbx: `PySpark: \`df.select('col1', 'col2')\``,
  },
  {
    id: 'bool-filter', tier: 'core', group: '선택·필터',
    title: '불리언 필터: & | ~ · isin · between · isna',
    summary: '조건식으로 행을 거릅니다. SQL의 WHERE에 해당합니다.',
    body: `
      조건식을 계산하면 True/False로 된 Series(마스크)가 나오고, \`df[mask]\` 또는 \`df.loc[mask]\`로 True인 행만 남깁니다.
      - 여러 조건은 \`&\`(AND), \`|\`(OR), \`~\`(NOT)로 묶고 **각 조건을 괄호로 감쌉니다**.
      - \`isin([...])\`: 목록 안에 있는지 (SQL \`IN\`), \`between(a, b)\`: 양 끝 포함 범위
      - \`isna()\` / \`notna()\`: 결측 여부 (SQL \`IS NULL\`)`,
    syntax: `df[(df['a'] == 1) & (df['b'] > 10)]
df[(cond1) | (cond2)]
df[~df['col'].isin(['x', 'y'])]
df[df['col'].between(low, high)]
df[df['col'].isna()]`,
    examples: [
      { title: '완료 주문 중 30만 원 이상', code: `mask = (orders['status'] == 'completed') & (orders['total_amount'] >= 300000)
orders.loc[mask, ['order_id', 'user_id', 'total_amount']].head()` },
      { title: '간편결제(카카오·네이버페이)로 쿠폰을 쓴 주문 수', code: `pay = orders['payment_method'].isin(['kakaopay', 'naverpay'])
used_coupon = orders['coupon_code'].notna()
len(orders[pay & used_coupon])` },
      { title: '한 번도 주문하지 않은 유저 (~isin = NOT IN)', code: `no_order = users[~users['user_id'].isin(orders['user_id'])]
no_order['channel'].value_counts()` },
      { title: '12월 주문만 (타임스탬프는 끝을 미포함으로)', code: `dec = orders[(orders['order_ts'] >= '2025-12-01') & (orders['order_ts'] < '2026-01-01')]
dec['order_ts'].agg(['min', 'max', 'count'])` },
    ],
    tips: `
      - \`and\`/\`or\`/\`not\`를 쓰면 \`ValueError: The truth value of a Series is ambiguous\`가 납니다. 반드시 \`& | ~\`를 씁니다.
      - 괄호를 빼면 연산자 우선순위 때문에 \`df['a'] == 1 & df['b'] > 10\`이 엉뚱하게 계산됩니다.
      - 타임스탬프 컬럼에 \`between('2025-12-01', '2025-12-31')\`을 쓰면 12/31 00:00:00까지만 포함됩니다. 하루 전체를 넣으려면 \`>= 시작\` & \`< 다음날\`로 씁니다.
      - \`df['col'] == np.nan\`은 항상 False입니다. 결측은 \`isna()\`로 확인합니다.`,
    dbx: `SQL의 \`WHERE\` · PySpark: \`df.filter((F.col('a') == 1) & (F.col('b') > 10))\`, \`F.col('c').isin(...)\``,
    related: ['pd-01', 'sql-04'],
  },
  {
    id: 'query', tier: 'core', group: '선택·필터',
    title: 'query: 문자열 조건식으로 필터',
    summary: 'SQL WHERE처럼 문자열로 조건을 적어 행을 거릅니다.',
    body: `
      \`df.query("조건")\`은 불리언 필터를 문자열로 쓰는 방법입니다. 컬럼명을 그대로 쓰고 \`and\`/\`or\`/\`not\`, \`in\`을 쓸 수 있어 조건이 길 때 읽기 쉽습니다.
      - 파이썬 변수는 \`@변수명\`으로 참조합니다.
      - 공백·특수문자가 있는 컬럼명은 백틱으로 감쌉니다: \`\` \`order amount\` > 0 \`\`
      - 메서드 체이닝 중간에 넣기 좋습니다.`,
    syntax: `df.query("col == 'x' and num >= 10")
df.query("col in @my_list")
df.query("a > b")             # 컬럼끼리 비교`,
    examples: [
      { title: '완료 주문 중 30만 원 이상', code: `orders.query("status == 'completed' and total_amount >= 300000").head()` },
      { title: '파이썬 변수 참조 (@)', code: `methods = ['kakaopay', 'naverpay']
min_amount = 100000
orders.query("payment_method in @methods and total_amount >= @min_amount").shape` },
      { title: '체이닝 중간에 필터', code: `(users
 .query("country == 'KR' and device == 'ios'")
 .groupby('channel')
 .size())` },
    ],
    tips: `
      - 문자열 값은 따옴표로 감싸야 합니다. 바깥을 큰따옴표로 쓰면 안쪽은 작은따옴표로 씁니다.
      - \`.str.contains()\` 같은 메서드 호출이 섞인 복잡한 조건은 일반 불리언 필터가 더 안전합니다.
      - 결과는 원본의 부분 복사본입니다. 이어서 컬럼을 추가하려면 \`.copy()\`를 붙이거나 \`assign\`을 쓰세요.`,
    dbx: `PySpark의 \`df.filter("status = 'completed' AND total_amount >= 300000")\`처럼 SQL 문자열을 넣는 방식과 비슷합니다. (단 pandas는 \`==\`, Spark SQL은 \`=\`)`,
    related: ['pd-01'],
  },
  {
    id: 'loc-iloc', tier: 'core', group: '선택·필터',
    title: 'loc · iloc: 행과 열을 함께 선택',
    summary: 'loc는 라벨·조건으로, iloc는 위치(정수)로 행과 열을 고릅니다.',
    body: `
      \`df.loc[행, 열]\`은 **라벨**(인덱스 값, 컬럼명)이나 불리언 마스크로, \`df.iloc[행, 열]\`은 **0부터 시작하는 위치**로 선택합니다.
      - 조건 필터와 컬럼 선택을 한 번에: \`df.loc[mask, ['a', 'b']]\`
      - 값을 바꿀 때도 \`df.loc[mask, 'col'] = 값\`을 씁니다. (체인 할당 방지)
      - 슬라이스 끝: \`loc\`는 **끝 포함**, \`iloc\`는 **끝 미포함**`,
    syntax: `df.loc[row_mask_or_label, ['col1', 'col2']]
df.loc[mask, 'col'] = value
df.iloc[0:5, 0:3]
df.iloc[-1]          # 마지막 행`,
    examples: [
      { title: '조건 + 컬럼 선택을 한 번에', code: `orders.loc[orders['status'] == 'refunded', ['order_id', 'user_id', 'total_amount']].head()` },
      { title: '위치로 앞 3행 × 앞 4열', code: `orders.iloc[:3, :4]` },
      { title: '인덱스를 키로 바꿔 라벨 조회', code: `products.set_index('product_id').loc[[1, 2, 3], ['product_name', 'price']]` },
      { title: '조건에 맞는 행의 값만 바꾸기', code: `df = orders.copy()
df.loc[df['coupon_code'].isna(), 'coupon_code'] = 'NONE'
df['coupon_code'].value_counts()` },
    ],
    tips: `
      - \`df[df['a'] > 0]['b'] = 1\` 같은 **체인 할당**은 원본을 바꾸지 못하고 \`SettingWithCopyWarning\`을 냅니다 (pandas 3.0의 Copy-on-Write에서는 항상 원본이 바뀌지 않음). \`df.loc[df['a'] > 0, 'b'] = 1\`로 한 번에 씁니다.
      - 필터한 결과에 컬럼을 추가할 계획이면 \`sub = df[mask].copy()\`처럼 명시적으로 복사합니다.
      - 필터·정렬 후 인덱스는 원래 번호를 유지합니다. \`iloc[0]\`(첫 행)과 \`loc[0]\`(라벨이 0인 행)은 다를 수 있습니다.`,
    related: ['pd-01', 'sql-11'],
  },

  // ───────────────────────── core: 열 만들기·변환 ─────────────────────────
  {
    id: 'assign', tier: 'core', group: '열 만들기·변환',
    title: '새 열 만들기 · assign',
    summary: '계산 결과로 새 컬럼을 추가합니다.',
    body: `
      컬럼끼리의 연산은 행 단위로 자동 계산(벡터 연산)되므로 반복문이 필요 없습니다.
      - \`df['new'] = 식\`: 원본에 바로 추가
      - \`df.assign(new=식)\`: 컬럼이 추가된 **새 DataFrame**을 반환 → 메서드 체이닝에 적합
      - assign 안에서 \`lambda d: ...\`를 쓰면 바로 앞 단계의 DataFrame(같은 assign에서 먼저 만든 컬럼 포함)을 참조할 수 있습니다.`,
    syntax: `df['new'] = df['a'] * df['b']
df.assign(new=df['a'] * df['b'])
df.assign(x=lambda d: d['a'] + 1, y=lambda d: d['x'] * 2)`,
    examples: [
      { title: '주문 상품별 금액 = 수량 × 단가', code: `items = order_items.copy()
items['amount'] = items['quantity'] * items['unit_price']
items.head()` },
      { title: 'assign 체이닝: 할인 전 금액과 할인율', code: `(orders
 .assign(gross=lambda d: d['total_amount'] + d['discount_amount'],
         discount_rate=lambda d: d['discount_amount'] / d['gross'])
 .loc[lambda d: d['discount_amount'] > 0, ['order_id', 'gross', 'discount_amount', 'discount_rate']]
 .head())` },
      { title: '필터 결과에 열 추가는 copy() 후에', code: `done = orders[orders['status'] == 'completed'].copy()
done['is_big'] = done['total_amount'] >= 300000
done['is_big'].mean()` },
    ],
    tips: `
      - 필터한 DataFrame에 바로 \`sub['new'] = ...\`를 하면 \`SettingWithCopyWarning\`이 날 수 있습니다. \`.copy()\`를 붙이거나 \`assign\`을 쓰세요.
      - 0으로 나누면 에러 대신 \`inf\`나 \`NaN\`이 됩니다. 비율 계산 뒤 \`replace([np.inf, -np.inf], np.nan)\`로 정리할 수 있습니다.`,
    dbx: `PySpark: \`df.withColumn('amount', F.col('quantity') * F.col('unit_price'))\``,
    related: ['pd-06', 'pd-05'],
  },
  {
    id: 'conditional', tier: 'core', group: '열 만들기·변환',
    title: '조건으로 값 정하기: np.where · np.select · case_when',
    summary: 'SQL의 CASE WHEN처럼 조건에 따라 다른 값을 넣습니다.',
    body: `
      - \`np.where(조건, 참일 때, 거짓일 때)\`: 조건이 하나일 때
      - \`np.select([조건1, 조건2, ...], [값1, 값2, ...], default=기본값)\`: 조건이 여러 개일 때. **앞의 조건부터** 검사해 처음 맞는 값을 씁니다.
      - pandas 2.2+에서는 \`Series.case_when\`도 쓸 수 있습니다. 조건에 안 맞는 행은 원래 Series 값이 남습니다.`,
    syntax: `np.where(cond, 'Y', 'N')
np.select([cond1, cond2], ['A', 'B'], default='C')
s.case_when([(cond1, 'A'), (cond2, 'B')])   # pandas 2.2+`,
    examples: [
      { title: '쿠폰 사용 여부 Y/N', code: `orders.assign(used_coupon=np.where(orders['coupon_code'].notna(), 'Y', 'N'))['used_coupon'].value_counts()` },
      { title: '주문 금액 구간 (여러 조건)', code: `amt = orders['total_amount']
bucket = np.select([amt >= 300000, amt >= 100000], ['large', 'medium'], default='small')
pd.Series(bucket).value_counts()` },
      { title: 'case_when (pandas 2.2+)', code: `rev = orders[orders['status'] == 'completed'].groupby('user_id')['total_amount'].sum()
tier = pd.Series('Light', index=rev.index).case_when([
    (rev >= 500000, 'VIP'),
    (rev >= 100000, 'Regular'),
])
tier.value_counts()` },
    ],
    tips: `
      - \`np.select\`는 조건 순서가 중요합니다. 넓은 조건(\`>= 100000\`)을 먼저 쓰면 좁은 조건(\`>= 300000\`)에 도달하지 못합니다.
      - 값이 문자열이면 \`default\`도 문자열로 주세요. 기본값 \`0\`과 섞이면 타입 오류가 납니다.
      - \`np.where\`는 NaN을 조건 False로 처리합니다. 결측을 따로 구분하려면 조건에 \`isna()\`를 먼저 넣습니다.`,
    dbx: `SQL의 \`CASE WHEN ... THEN ... ELSE ... END\` · PySpark: \`F.when(cond, 'A').when(cond2, 'B').otherwise('C')\``,
    related: ['pd-11'],
  },
  {
    id: 'map-replace', tier: 'core', group: '열 만들기·변환',
    title: 'map · replace: 값 바꾸기',
    summary: '딕셔너리나 Series로 값을 다른 값으로 대응시킵니다.',
    body: `
      - \`s.map(dict)\`: 딕셔너리로 값을 변환합니다. **딕셔너리에 없는 값은 NaN**이 됩니다.
      - \`s.map(series)\`: 다른 Series의 인덱스를 키로 값을 찾아옵니다 (간단한 lookup, merge 대용).
      - \`s.replace(dict)\`: 딕셔너리에 있는 값만 바꾸고 **나머지는 그대로** 둡니다.`,
    syntax: `s.map({'a': 'A', 'b': 'B'})
s.map(lookup_series)          # lookup_series.index → 값
s.replace({'old': 'new'})
df.replace({'col': {'old': 'new'}})`,
    examples: [
      { title: '디바이스명을 한글로', code: `device_kr = {'android': '안드로이드', 'ios': 'iOS', 'web': '웹'}
users['device'].map(device_kr).value_counts()` },
      { title: 'Series로 lookup: 상품 ID → 카테고리', code: `category_of = products.set_index('product_id')['category']
order_items.assign(category=order_items['product_id'].map(category_of)).head()` },
      { title: 'map은 없는 키를 NaN, replace는 그대로', code: `m = {'organic': '자연유입', 'paid_search': '검색광고'}
pd.DataFrame({
    'map': users['channel'].map(m),
    'replace': users['channel'].replace(m),
}).drop_duplicates()` },
    ],
    tips: `
      - \`map\` 후 NaN이 생겼다면 딕셔너리에 빠진 값이 있다는 뜻입니다. \`.isna().sum()\`으로 확인하세요.
      - lookup용 Series의 인덱스에 중복이 있으면 \`map\`이 실패합니다(\`InvalidIndexError\`). 키가 유일한지 확인합니다.
      - 함수로 변환할 때도 \`s.map(func)\`를 쓸 수 있지만, 문자열 처리라면 \`.str\` 메서드가 더 빠릅니다.`,
    dbx: `SQL에서는 \`CASE\` 또는 매핑 테이블과의 \`JOIN\`으로 같은 일을 합니다.`,
  },
  {
    id: 'apply', tier: 'core', group: '열 만들기·변환',
    title: 'apply: 함수를 행·열마다 적용',
    summary: '내장 연산으로 안 되는 계산을 함수로 적용합니다. 느리므로 마지막 수단입니다.',
    body: `
      \`apply\`는 함수를 Series의 원소마다, 또는 DataFrame의 열/행마다 호출합니다.
      - \`s.apply(func)\`: 원소마다
      - \`df.apply(func)\`: 열(Series)마다 (기본 \`axis=0\`)
      - \`df.apply(func, axis=1)\`: 행마다 — 행 하나가 Series로 들어옵니다
      파이썬 함수를 행마다 호출하므로 **벡터 연산보다 수십~수백 배 느립니다**. 산술·비교·\`np.where\`·\`.str\`·\`.dt\`로 가능한 일은 그쪽을 먼저 쓰세요.`,
    syntax: `s.apply(func)
df.apply(func)              # 열마다
df.apply(func, axis=1)      # 행마다`,
    examples: [
      { title: '열마다: 각 금액 컬럼의 범위(max - min)', code: `orders[['discount_amount', 'total_amount']].apply(lambda s: s.max() - s.min())` },
      { title: '행마다 (axis=1): 여러 컬럼을 조합한 라벨', code: `orders.head().apply(lambda r: f"{r['payment_method']}:{r['total_amount']:,}", axis=1)` },
      { title: '같은 일을 벡터 연산으로 (권장)', code: `(orders['payment_method'] + ':' + orders['total_amount'].map('{:,}'.format)).head()` },
    ],
    tips: `
      - \`df.apply(lambda r: r['a'] * r['b'], axis=1)\` → \`df['a'] * df['b']\`로 바꾸면 훨씬 빠릅니다.
      - 조건 분기 때문에 apply를 쓴다면 \`np.where\`/\`np.select\`로 바꿀 수 있는지 먼저 보세요.
      - 그룹별 계산은 \`apply\`보다 \`agg\`/\`transform\`이 빠르고 명확합니다.`,
  },
  {
    id: 'astype', tier: 'core', group: '열 만들기·변환',
    title: 'astype · to_numeric: 타입 변환',
    summary: '컬럼의 데이터 타입을 바꿉니다. 숫자가 문자열로 읽혔을 때 필수입니다.',
    body: `
      \`df.dtypes\`에서 숫자여야 할 컬럼이 \`object\`라면 연산·정렬이 문자열 기준으로 됩니다.
      - \`s.astype(int | float | str | 'category' | 'Int64')\`: 타입 변환
      - \`pd.to_numeric(s, errors='coerce')\`: 숫자로 못 바꾸는 값은 NaN으로
      - \`'Int64'\`(대문자 I)는 **결측을 허용하는 정수** 타입입니다. 샘플 테이블의 \`employees.dept_id\`가 이 타입입니다.`,
    syntax: `s.astype('int64')
df.astype({'a': 'float64', 'b': 'string'})
pd.to_numeric(s, errors='coerce')
s.astype('Int64')           # NaN 허용 정수`,
    examples: [
      { title: '"1,200" 같은 문자열을 숫자로', code: `s = pd.Series(['1,200', '3500', '없음', None])
pd.to_numeric(s.str.replace(',', ''), errors='coerce')` },
      { title: '불리언 → 정수로 바꿔 비율 계산', code: `users['marketing_opt_in'].astype(int).agg(['sum', 'mean'])` },
      { title: 'NaN이 있는 정수 컬럼은 Int64', code: `employees[['emp_id', 'dept_id', 'manager_id']].dtypes` },
    ],
    tips: `
      - NaN이 섞인 컬럼에 \`astype(int)\`를 하면 \`IntCastingNaNError\`가 납니다. \`fillna\` 후 변환하거나 \`'Int64'\`를 씁니다.
      - 일반 \`int64\` 컬럼도 NaN이 생기는 순간(left merge 등) \`float64\`로 바뀝니다. ID가 \`1001.0\`처럼 보이면 이 때문입니다.
      - 문자열 숫자는 사전순 정렬됩니다(\`'10' < '9'\`). 정렬이 이상하면 dtype부터 확인하세요.`,
    dbx: `PySpark: \`F.col('c').cast('int')\` — 변환할 수 없는 값은 ANSI 모드가 꺼져 있으면 NULL, 켜져 있으면 에러입니다 (SQL은 \`TRY_CAST\`로 NULL 처리).`,
  },
  {
    id: 'rename-drop', tier: 'core', group: '열 만들기·변환',
    title: 'rename · drop: 이름 바꾸기와 열 삭제',
    summary: '컬럼 이름을 바꾸거나, 필요 없는 컬럼·행을 지웁니다.',
    body: `
      - \`df.rename(columns={'old': 'new'})\`: 일부 컬럼만 이름 변경
      - \`df.drop(columns=[...])\`: 컬럼 삭제 (행 삭제는 \`index=[...]\`)
      - \`df.columns = [...]\`: 전체 이름을 한 번에 교체
      - 열 순서 바꾸기는 \`df[['c', 'a', 'b']]\`처럼 원하는 순서로 다시 선택합니다.
      모두 새 DataFrame을 반환하므로 결과를 변수에 다시 담아야 합니다.`,
    syntax: `df.rename(columns={'old': 'new'})
df.drop(columns=['a', 'b'])
df.drop(columns=['maybe'], errors='ignore')
df[['c', 'a', 'b']]          # 순서 바꾸기`,
    examples: [
      { title: '컬럼 이름 바꾸기', code: `orders.rename(columns={'total_amount': 'revenue', 'order_ts': 'ordered_at'}).head(3)` },
      { title: '필요 없는 컬럼 지우기', code: `orders.drop(columns=['coupon_code', 'discount_amount']).head(3)` },
      { title: '집계 결과 컬럼명 정리', code: `(orders.groupby('payment_method', as_index=False)['total_amount'].sum()
 .rename(columns={'total_amount': 'revenue'}))` },
    ],
    tips: `
      - \`rename\`에 없는 컬럼명을 줘도 에러 없이 무시됩니다. 오타가 있으면 조용히 안 바뀌니 결과를 확인하세요.
      - \`inplace=True\`보다 \`df = df.rename(...)\`처럼 다시 대입하는 방식을 권장합니다. (체이닝이 되고 향후 버전에서도 안전)`,
    dbx: `PySpark: \`df.withColumnRenamed('old', 'new')\`, \`df.drop('a', 'b')\``,
    related: ['sql-02'],
  },

  // ───────────────────────── core: 정렬·중복 ─────────────────────────
  {
    id: 'sort', tier: 'core', group: '정렬·중복',
    title: 'sort_values · sort_index',
    summary: '값 또는 인덱스 기준으로 행을 정렬합니다. SQL의 ORDER BY입니다.',
    body: `
      - \`sort_values('col')\`: 오름차순, \`ascending=False\`: 내림차순
      - 여러 키: \`sort_values(['a', 'b'], ascending=[True, False])\` — 키마다 방향 지정
      - \`sort_index()\`: 인덱스 기준 (groupby 결과, 날짜 인덱스 등)
      - 결측은 기본으로 맨 뒤(\`na_position='last'\`)에 옵니다.`,
    syntax: `df.sort_values('col', ascending=False)
df.sort_values(['a', 'b'], ascending=[True, False])
df.sort_index()
s.sort_values().head(10)`,
    examples: [
      { title: '금액이 큰 주문 TOP 5', code: `orders.sort_values('total_amount', ascending=False).head()[['order_id', 'user_id', 'total_amount']]` },
      { title: '유저 오름차순, 같은 유저 안에서는 최근 주문부터', code: `(orders.sort_values(['user_id', 'order_ts'], ascending=[True, False])
 [['user_id', 'order_ts', 'total_amount']].head(6))` },
      { title: '빈도표를 이름순으로', code: `users['age_group'].value_counts().sort_index()` },
    ],
    tips: `
      - 동점이 있으면 순서가 보장되지 않습니다. 결과를 재현하려면 \`['revenue', 'user_id']\`처럼 **타이브레이커 키**를 추가하세요.
      - \`shift\`, \`cumsum\`, \`diff\`, \`drop_duplicates(keep=...)\` 전에는 반드시 정렬부터 합니다. 이들은 현재 행 순서를 그대로 씁니다.
      - 상위 N개만 필요하면 \`nlargest(n, 'col')\`이 더 간단합니다.`,
    dbx: `SQL의 \`ORDER BY a ASC, b DESC\` · PySpark: \`df.orderBy(F.col('a'), F.col('b').desc())\``,
    related: ['pd-01', 'sql-01'],
  },
  {
    id: 'duplicates', tier: 'core', group: '정렬·중복',
    title: 'drop_duplicates · duplicated',
    summary: '중복 행을 찾거나 제거합니다. 정렬과 함께 "그룹별 첫/마지막 행" 뽑기에도 씁니다.',
    body: `
      - \`df.duplicated(subset)\`: 앞에서 이미 나온 조합이면 True인 마스크
      - \`df.drop_duplicates(subset, keep='first' | 'last' | False)\`: 중복 제거
      - \`subset\`을 생략하면 **모든 컬럼**이 같아야 중복으로 봅니다.
      - \`sort_values\` + \`drop_duplicates('key', keep='last')\` = 키별 최신 1건 (SQL \`ROW_NUMBER() = 1\` 패턴)`,
    syntax: `df.duplicated(subset=['a', 'b'], keep='first')
df.drop_duplicates(subset=['a'], keep='last')
df.sort_values(['key', 'ts']).drop_duplicates('key', keep='last')`,
    examples: [
      { title: '같은 (유저, 세션) 조합이 몇 번 반복되나', code: `events.duplicated(subset=['user_id', 'session_id']).sum()` },
      { title: '유저별 가장 최근 주문 1건', code: `(orders.sort_values(['user_id', 'order_ts', 'order_id'])
 .drop_duplicates('user_id', keep='last')
 [['user_id', 'order_id', 'order_ts', 'total_amount']].head())` },
      { title: '중복된 값을 가진 행 모두 보기 (keep=False)', code: `dup = employees[employees.duplicated('salary', keep=False)]
dup.sort_values('salary')[['name', 'salary']].head(8)` },
    ],
    tips: `
      - \`keep='first'/'last'\`는 **현재 행 순서** 기준입니다. 정렬 없이 쓰면 "최근 1건"이 보장되지 않습니다.
      - 고유값 개수만 필요하면 \`drop_duplicates\` 후 \`len\` 대신 \`nunique()\`가 간단합니다.
      - merge 전에 키 컬럼 중복을 \`duplicated().any()\`로 확인하면 행 뻥튀기를 막을 수 있습니다.`,
    dbx: `SQL \`DISTINCT\` / \`ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ...) = 1\` · PySpark \`dropDuplicates(['a'])\`는 어떤 행이 남을지 보장하지 않으므로 "최신 1건"은 \`row_number\` 윈도우로 구합니다.`,
    related: ['sql-05', 'sql-06'],
  },

  // ───────────────────────── core: 결측치 ─────────────────────────
  {
    id: 'missing', tier: 'core', group: '결측치',
    title: 'isna · fillna · dropna',
    summary: '결측(NaN, None, NaT)을 찾고, 채우고, 지웁니다.',
    body: `
      pandas의 결측은 숫자 \`NaN\`, 날짜 \`NaT\`, nullable 타입의 \`<NA>\`로 표시됩니다. 대부분의 집계(\`sum\`, \`mean\`, \`count\`)는 결측을 **건너뜁니다**.
      - 찾기: \`isna()\` / \`notna()\`, 컬럼별 개수 \`df.isna().sum()\`
      - 채우기: \`fillna(값)\`, 컬럼별로 \`fillna({'a': 0, 'b': 'NONE'})\`, 앞/뒤 값으로 \`ffill()\` / \`bfill()\`
      - 지우기: \`dropna(subset=[...])\` — 특정 컬럼이 결측인 행만 삭제`,
    syntax: `df.isna().sum()
s.fillna(0)
df.fillna({'a': 0, 'b': 'NONE'})
s.ffill()
df.dropna(subset=['a'], how='any')`,
    examples: [
      { title: '컬럼별 결측 개수', code: `orders.isna().sum()` },
      { title: '결측을 NONE으로 채워 빈도 세기', code: `orders['coupon_code'].fillna('NONE').value_counts()` },
      { title: 'NaN은 == 로 찾을 수 없다', code: `pd.Series({
    '== np.nan': (orders['coupon_code'] == np.nan).sum(),
    'isna()': orders['coupon_code'].isna().sum(),
})` },
      { title: 'count는 결측 제외, size는 전체 행', code: `orders.groupby('payment_method')['coupon_code'].agg(['size', 'count'])` },
    ],
    tips: `
      - \`NaN == NaN\`은 False입니다. 결측 비교는 항상 \`isna()\`로 합니다.
      - 평균을 낼 때 "결측 = 0"이 맞는지 생각하세요. \`mean()\`은 결측을 빼고 나누므로 \`fillna(0).mean()\`과 결과가 다릅니다 (예: 구매 안 한 유저 포함 ARPU).
      - \`fillna(method='ffill')\`은 deprecated입니다. \`ffill()\`을 쓰세요.
      - \`dropna()\`를 인자 없이 쓰면 **어느 컬럼이든** 결측인 행이 모두 지워집니다. \`subset\`을 지정하는 습관을 들이세요.`,
    dbx: `SQL: \`IS NULL\`, \`COALESCE(col, 'NONE')\` · PySpark: \`df.fillna({'col': 'NONE'})\`, \`df.dropna(subset=['col'])\``,
    related: ['pd-02', 'sql-03', 'sql-13'],
  },

  // ───────────────────────── core: 집계 ─────────────────────────
  {
    id: 'groupby-agg', tier: 'core', group: '집계',
    title: 'groupby + agg (named aggregation)',
    summary: '그룹별로 여러 지표를 한 번에 계산합니다. SQL의 GROUP BY입니다.',
    body: `
      \`df.groupby(키)[컬럼].집계함수()\`가 기본 형태입니다. 지표가 여러 개면 **named aggregation**으로 결과 컬럼 이름까지 한 번에 정합니다.
      - \`agg(새이름=('컬럼', '함수'))\`: 함수는 \`'sum'\`, \`'mean'\`, \`'count'\`, \`'size'\`, \`'nunique'\`, \`'min'\`, \`'max'\`, \`'median'\`, \`'first'\` 등 문자열이나 lambda
      - \`agg(['sum', 'mean'])\`: 한 컬럼에 여러 함수 (컬럼명이 함수 이름이 됨)`,
    syntax: `df.groupby('key')['val'].sum()
df.groupby('key').agg(
    total=('val', 'sum'),
    users=('user_id', 'nunique'),
    rate=('flag', 'mean'),
)`,
    examples: [
      { title: '주문 상태별 매출 합계', code: `orders.groupby('status')['total_amount'].sum()` },
      { title: '결제수단별 주문 수 · 구매자 수 · 매출 · 객단가', code: `(orders[orders['status'] == 'completed']
 .groupby('payment_method')
 .agg(orders=('order_id', 'count'),
      buyers=('user_id', 'nunique'),
      revenue=('total_amount', 'sum'),
      aov=('total_amount', 'mean'))
 .sort_values('revenue', ascending=False))` },
      { title: 'lambda 집계: 결제수단별 쿠폰 사용률', code: `orders.groupby('payment_method').agg(
    orders=('order_id', 'size'),
    coupon_rate=('coupon_code', lambda s: s.notna().mean()),
)` },
    ],
    tips: `
      - 0/1 플래그의 \`mean\`은 비율입니다 (전환율, 쿠폰 사용률 등).
      - \`count\`는 결측을 제외한 개수, \`size\`는 행 수입니다. "주문 수"처럼 행을 세려면 \`size\`가 안전합니다.
      - lambda 집계는 그룹마다 파이썬 함수를 호출해 느립니다. 가능하면 미리 플래그 컬럼을 만들어 \`'mean'\`/\`'sum'\`으로 집계하세요.`,
    dbx: `SQL: \`SELECT key, SUM(val) AS total ... GROUP BY key\` · PySpark: \`df.groupBy('key').agg(F.sum('val').alias('total'), F.countDistinct('user_id').alias('users'))\``,
    related: ['pd-05', 'pd-10', 'sql-13', 'sql-19'],
  },
  {
    id: 'groupby-keys', tier: 'core', group: '집계',
    title: '여러 키 groupby · reset_index · as_index=False',
    summary: '여러 컬럼으로 묶고, 결과의 인덱스를 일반 컬럼으로 되돌립니다.',
    body: `
      groupby 결과는 **그룹 키가 인덱스**로 들어갑니다 (키가 여러 개면 MultiIndex). 표로 다루거나 merge하려면 키를 다시 컬럼으로 꺼냅니다.
      - \`.reset_index()\`: 인덱스를 컬럼으로. Series면 \`reset_index(name='값이름')\`
      - \`groupby(..., as_index=False)\`: 처음부터 키를 컬럼으로 둔 결과
      - \`.size()\`: 그룹별 행 수 (결측 무관)`,
    syntax: `df.groupby(['a', 'b']).size().reset_index(name='n')
df.groupby(['a', 'b'], as_index=False).agg(total=('v', 'sum'))
df.groupby('a', dropna=False).size()     # NaN 키도 그룹으로`,
    examples: [
      { title: '국가 × 디바이스별 가입자 수', code: `users.groupby(['country', 'device']).size().reset_index(name='users').head(6)` },
      { title: '실험 × 그룹별 인원과 전환율', code: `ab_test.groupby(['experiment', 'variant'], as_index=False).agg(
    users=('user_id', 'size'),
    cvr=('converted', 'mean'),
)` },
      { title: 'NaN 키는 기본으로 빠진다 (dropna=False로 포함)', code: `pd.DataFrame({
    'default': employees.groupby('dept_id').size(),
    'dropna=False': employees.groupby('dept_id', dropna=False).size(),
})` },
    ],
    tips: `
      - groupby는 기본으로 **결측 키 행을 버립니다**. 부서 미배정 직원처럼 결측도 하나의 그룹으로 봐야 하면 \`dropna=False\`를 씁니다.
      - 결과는 키 기준으로 정렬됩니다(\`sort=True\`). 등장 순서를 유지하려면 \`sort=False\`.
      - MultiIndex 결과를 \`.unstack()\`하면 두 번째 키가 열로 펼쳐집니다 (피벗과 같은 모양).`,
    dbx: `PySpark의 \`groupBy\` 결과는 항상 키가 컬럼이라 reset_index가 필요 없습니다. SQL GROUP BY는 NULL 키를 하나의 그룹으로 남긴다는 점도 pandas 기본값과 다릅니다.`,
    related: ['sql-01', 'sql-17', 'sql-02'],
  },
  {
    id: 'transform', tier: 'core', group: '집계',
    title: 'groupby + transform: 그룹 값을 행마다 붙이기',
    summary: '그룹 집계값을 원래 행 수 그대로 붙입니다. SQL의 SUM() OVER (PARTITION BY)입니다.',
    body: `
      \`agg\`는 그룹당 1행으로 줄이지만, \`transform\`은 **원래 DataFrame과 같은 길이**로 각 행에 자기 그룹의 집계값을 돌려줍니다. 그래서 바로 새 컬럼으로 붙일 수 있습니다.
      - 그룹 내 비중: \`값 / 그룹 합계\`
      - 그룹 평균 대비 비교, 그룹 크기로 필터 (\`transform('size') >= 3\`)`,
    syntax: `df['grp_sum'] = df.groupby('key')['val'].transform('sum')
df['share'] = df['val'] / df.groupby('key')['val'].transform('sum')
df[df.groupby('key')['val'].transform('size') >= 3]`,
    examples: [
      { title: '주문별 해당 유저 매출에서의 비중', code: `done = orders[orders['status'] == 'completed'].copy()
done['user_total'] = done.groupby('user_id')['total_amount'].transform('sum')
done['share'] = done['total_amount'] / done['user_total']
done.sort_values('user_id')[['order_id', 'user_id', 'total_amount', 'user_total', 'share']].head()` },
      { title: '부서 평균보다 급여가 높은 직원', code: `dept_avg = employees.groupby('dept_id')['salary'].transform('mean')
employees.loc[employees['salary'] > dept_avg, ['name', 'dept_id', 'salary']].head(8)` },
      { title: '실험 안에서 그룹별 배정 비율', code: `g = ab_test.groupby(['experiment', 'variant'], as_index=False).agg(users=('user_id', 'size'))
g['share'] = g['users'] / g.groupby('experiment')['users'].transform('sum')
g` },
    ],
    tips: `
      - \`agg\` 결과를 원본에 merge하는 것과 같은 일을 한 줄로 합니다. 행 수가 그대로라 merge 실수(뻥튀기)가 없습니다.
      - 결측 키 행은 transform 결과도 NaN입니다 (\`dropna=True\` 기본).
      - 그룹별 순번·누적합은 \`transform\` 대신 \`cumcount()\`·\`cumsum()\`을 바로 씁니다.`,
    dbx: `SQL: \`SUM(val) OVER (PARTITION BY key)\` · PySpark: \`F.sum('val').over(Window.partitionBy('key'))\``,
    related: ['pd-04', 'sql-17'],
  },

  // ───────────────────────── core: 결합 ─────────────────────────
  {
    id: 'merge', tier: 'core', group: '결합',
    title: 'merge: 키로 두 테이블 조인',
    summary: '공통 키로 두 DataFrame을 붙입니다. SQL의 JOIN입니다.',
    body: `
      \`left.merge(right, on='key', how=...)\`로 조인합니다. **기본값은 \`how='inner'\`**라서 짝이 없는 행은 사라집니다.
      - \`how\`: \`'inner'\` | \`'left'\` | \`'right'\` | \`'outer'\` | \`'cross'\`
      - 키 이름이 다르면 \`left_on='a', right_on='b'\` (결과에 두 컬럼이 모두 남음)
      - 키 외에 이름이 같은 컬럼은 \`_x\`, \`_y\`가 붙습니다 → \`suffixes=('', '_mgr')\`로 지정
      - 붙이기 전에 오른쪽에서 **필요한 컬럼만** 골라 두면 결과가 깔끔합니다.`,
    syntax: `left.merge(right, on='key', how='left')
left.merge(right, left_on='a', right_on='b', how='inner')
left.merge(right, on=['k1', 'k2'], suffixes=('_l', '_r'))`,
    examples: [
      { title: '완료 주문에 유저 채널 붙여 채널별 매출', code: `done = orders[orders['status'] == 'completed']
df = done.merge(users[['user_id', 'channel']], on='user_id', how='left')
df.groupby('channel')['total_amount'].sum().sort_values(ascending=False)` },
      { title: 'inner vs left: 부서 없는 직원이 사라진다', code: `pd.Series({
    'employees': len(employees),
    'inner': len(employees.merge(departments, on='dept_id')),
    'left': len(employees.merge(departments, on='dept_id', how='left')),
})` },
      { title: '셀프 조인: 직원 – 매니저 이름 (left_on/right_on)', code: `(employees
 .merge(employees[['emp_id', 'name']], left_on='manager_id', right_on='emp_id',
        how='left', suffixes=('', '_mgr'))
 [['emp_id', 'name', 'name_mgr']].head(8))` },
    ],
    tips: `
      - 오른쪽 키가 중복되면 왼쪽 행이 그만큼 **복제**됩니다(행 뻥튀기). 조인 전후 \`len()\`을 비교하거나 \`validate='many_to_one'\`을 넣으세요.
      - 키 dtype이 다르면(예: int vs str) 에러가 나거나 아무것도 안 붙습니다. \`astype\`으로 맞춥니다.
      - left merge 후 짝이 없는 행은 NaN이 되어 정수 컬럼이 float로 바뀔 수 있습니다.
      - 인덱스를 키로 쓰려면 \`right_index=True\` (예: groupby 결과 Series를 붙일 때).`,
    dbx: `SQL: \`LEFT JOIN ... ON\` · PySpark: \`left.join(right, on='key', how='left')\` — Spark는 같은 이름 컬럼에 접미사를 붙이지 않아 모호성 에러가 날 수 있습니다.`,
    related: ['pd-03', 'sql-11', 'sql-18', 'sql-13'],
  },
  {
    id: 'merge-check', tier: 'core', group: '결합',
    title: 'merge 검증: validate · indicator · 안티 조인',
    summary: '조인 관계를 검증하고, 어느 쪽에만 있는 행을 찾습니다.',
    body: `
      - \`validate='one_to_one' | 'one_to_many' | 'many_to_one' | 'many_to_many'\` (\`'1:1'\`, \`'1:m'\`, \`'m:1'\`도 가능): 기대한 관계가 아니면 \`MergeError\`를 냅니다. 분석 코드의 안전장치로 좋습니다.
      - \`indicator=True\`: \`_merge\` 컬럼에 \`'both'\` / \`'left_only'\` / \`'right_only'\`를 표시합니다.
      - **안티 조인**(왼쪽에만 있는 행): \`indicator\` + \`left_only\` 필터, 또는 \`~isin\``,
    syntax: `left.merge(right, on='key', how='left', validate='many_to_one')
m = left.merge(right, on='key', how='left', indicator=True)
m[m['_merge'] == 'left_only']`,
    examples: [
      { title: 'validate로 관계 확인 (주문상품 N : 상품 1)', code: `items = order_items.merge(products[['product_id', 'category']], on='product_id',
                          how='left', validate='many_to_one')
len(order_items), len(items)` },
      { title: '관계가 틀리면 MergeError', code: `try:
    users.merge(orders, on='user_id', validate='one_to_one')
except pd.errors.MergeError as e:
    print('MergeError:', e)` },
      { title: 'indicator로 주문 없는 유저 찾기 (안티 조인)', code: `buyers = orders[['user_id']].drop_duplicates()
m = users[['user_id', 'channel']].merge(buyers, on='user_id', how='left', indicator=True)
m.loc[m['_merge'] == 'left_only'].groupby('channel').size()` },
    ],
    tips: `
      - 오른쪽 테이블을 \`drop_duplicates\`로 키당 1행으로 만든 뒤 붙이면 뻥튀기를 막을 수 있습니다.
      - \`_merge\`는 category 타입입니다. 확인 후 \`drop(columns='_merge')\`로 지우세요.
      - 존재 여부만 필요하면 \`users['user_id'].isin(orders['user_id'])\`가 더 간단하고 빠릅니다.`,
    dbx: `SQL: \`LEFT JOIN ... WHERE r.key IS NULL\` 또는 \`NOT EXISTS\` · PySpark: \`left.join(right, 'key', 'left_anti')\` (반대로 존재하는 행만은 \`'left_semi'\`)`,
    related: ['pd-03', 'sql-04'],
  },
  {
    id: 'concat', tier: 'core', group: '결합',
    title: 'concat: 위아래·옆으로 이어 붙이기',
    summary: '여러 DataFrame/Series를 행 방향(UNION ALL) 또는 열 방향으로 붙입니다.',
    body: `
      - \`pd.concat([df1, df2])\`: 위아래로 쌓기. 컬럼 이름 기준으로 맞추고, 한쪽에 없는 컬럼은 NaN
      - \`ignore_index=True\`: 인덱스를 0부터 새로 매김
      - \`pd.concat([s1, s2], axis=1)\`: **인덱스 기준**으로 옆에 붙이기 (월별 지표 여러 개를 한 표로)
      - \`keys=[...]\`: 어느 데이터에서 왔는지 표시`,
    syntax: `pd.concat([df1, df2], ignore_index=True)
pd.concat([s1, s2], axis=1)
pd.concat([df1, df2], keys=['a', 'b'])`,
    examples: [
      { title: '취소·환불 주문을 위아래로 합치기', code: `a = orders[orders['status'] == 'cancelled'].head(2)
b = orders[orders['status'] == 'refunded'].head(2)
pd.concat([a, b], ignore_index=True)[['order_id', 'status', 'total_amount']]` },
      { title: '월별 지표 두 개를 옆으로 (인덱스 정렬)', code: `signups = users.groupby(users['signup_date'].dt.to_period('M')).size().rename('signups')
buyers = orders.groupby(orders['order_ts'].dt.to_period('M'))['user_id'].nunique().rename('buyers')
pd.concat([signups, buyers], axis=1).head()` },
    ],
    tips: `
      - 반복문 안에서 \`concat\`을 계속 호출하면 느립니다. 리스트에 모아 두었다가 마지막에 한 번 \`concat\`합니다.
      - \`axis=1\`은 키가 아니라 **인덱스**로 맞춥니다. 인덱스가 다르면 NaN이 생기니, 키 기반 결합은 \`merge\`를 쓰세요.
      - \`df.append\`는 pandas 2.0에서 제거됐습니다. \`concat\`을 씁니다.`,
    dbx: `SQL \`UNION ALL\` · PySpark: \`df1.unionByName(df2, allowMissingColumns=True)\``,
    related: ['sql-08'],
  },

  // ───────────────────────── core: 날짜 ─────────────────────────
  {
    id: 'to-datetime', tier: 'core', group: '날짜',
    title: 'to_datetime: 문자열을 날짜로',
    summary: '문자열·숫자 컬럼을 datetime64로 바꿔 날짜 연산이 가능하게 합니다.',
    body: `
      CSV에서 읽은 날짜는 보통 문자열(\`object\`)입니다. \`pd.to_datetime\`으로 바꿔야 \`.dt\` 접근자, 기간 비교, 날짜 차이를 쓸 수 있습니다.
      - \`format='%Y-%m-%d %H:%M:%S'\`: 형식을 명시하면 빠르고 정확합니다
      - \`errors='coerce'\`: 해석할 수 없는 값은 \`NaT\`(날짜 결측)로
      - \`unit='s'\`: 유닉스 타임스탬프(초) 변환
      - \`read_csv(..., parse_dates=['col'])\`로 읽을 때 바로 변환할 수도 있습니다.`,
    syntax: `pd.to_datetime(s, format='%Y-%m-%d', errors='coerce')
pd.to_datetime(s, unit='s')
df[df['ts'] >= '2025-12-01']          # 문자열과 바로 비교 가능`,
    examples: [
      { title: '형식 지정 + 잘못된 값은 NaT', code: `s = pd.Series(['2025-01-03', '2025-02-15', 'unknown', None])
pd.to_datetime(s, format='%Y-%m-%d', errors='coerce')` },
      { title: '유닉스 타임스탬프(초) → 날짜', code: `pd.to_datetime(pd.Series([1735689600, 1735776000]), unit='s')` },
      { title: '변환된 컬럼은 문자열 날짜로 기간 필터', code: `q4 = orders[(orders['order_ts'] >= '2025-10-01') & (orders['order_ts'] < '2026-01-01')]
q4.groupby('status').size()` },
    ],
    tips: `
      - pandas 2.x는 첫 값으로 형식을 추론해 전체에 적용합니다. 형식이 섞여 있으면 에러가 나니 \`format='mixed'\`나 전처리가 필요합니다.
      - \`03/04/2025\`처럼 월/일 순서가 모호한 형식은 반드시 \`format\`을 지정하세요.
      - 시간대: \`dt.tz_localize('UTC').dt.tz_convert('Asia/Seoul')\` — UTC로 저장된 로그를 한국 시간으로 볼 때.`,
    dbx: `PySpark: \`F.to_timestamp('col', 'yyyy-MM-dd HH:mm:ss')\`, \`F.to_date('col')\` — 형식 문자가 Java 스타일입니다(\`%Y\` 대신 \`yyyy\`).`,
    related: ['sql-16'],
  },
  {
    id: 'dt-accessor', tier: 'core', group: '날짜',
    title: '.dt 접근자: 연·월·요일·기간 단위',
    summary: '날짜 컬럼에서 연도, 월, 요일, 월 단위 기간 등을 뽑습니다.',
    body: `
      datetime64 컬럼 뒤에 \`.dt\`를 붙이면 날짜 부품과 변환 메서드를 쓸 수 있습니다.
      - 부품: \`.dt.year\`, \`.dt.month\`, \`.dt.day\`, \`.dt.hour\`, \`.dt.dayofweek\`(월=0 … 일=6), \`.dt.day_name()\`
      - 일 단위로 자르기: \`.dt.normalize()\` 또는 \`.dt.floor('D')\` (datetime 타입 유지), \`.dt.date\` (파이썬 date 객체)
      - 기간: \`.dt.to_period('M')\` → \`2025-03\` 같은 월 기간, \`'W'\`(월~일 주), \`'Q'\`
      - 문자열로: \`.dt.strftime('%Y-%m')\``,
    syntax: `s.dt.year / s.dt.month / s.dt.dayofweek / s.dt.hour
s.dt.normalize()              # 자정으로 (일 단위)
s.dt.floor('h')               # 시 단위로 내림
s.dt.to_period('M')           # 월 기간
s.dt.to_period('M').dt.to_timestamp()   # 월 첫날 날짜
s.dt.strftime('%Y-%m')`,
    examples: [
      { title: '날짜 부품 뽑기', code: `ts = orders['order_ts']
pd.DataFrame({
    'order_ts': ts, 'year': ts.dt.year, 'month': ts.dt.month,
    'dayofweek': ts.dt.dayofweek, 'day_name': ts.dt.day_name(), 'hour': ts.dt.hour,
}).head()` },
      { title: '월별 매출 (to_period)', code: `done = orders[orders['status'] == 'completed']
done.groupby(done['order_ts'].dt.to_period('M'))['total_amount'].sum().head()` },
      { title: '일별 활성 유저(DAU): normalize로 날짜 단위 묶기', code: `events.groupby(events['event_ts'].dt.normalize())['user_id'].nunique().head()` },
      { title: '요일 × 시간대 주문 수', code: `ts = orders['order_ts']
orders.groupby([ts.dt.day_name().rename('weekday'), ts.dt.hour.rename('hour')]).size().nlargest(5)` },
    ],
    tips: `
      - \`.dt.date\`는 파이썬 \`date\` 객체(\`object\` 타입)라 이후 \`.dt\` 연산·리샘플이 안 됩니다. 날짜 단위로 묶을 땐 \`normalize()\`가 낫습니다.
      - \`to_period('W')\`는 **월요일 시작** 주입니다 (끝이 일요일인 \`W-SUN\`).
      - \`dayofweek\`는 월요일=0입니다. SQL·Spark의 \`DAYOFWEEK\`(일요일=1)와 다릅니다.
      - Period를 그래프·병합에 쓸 땐 \`.dt.to_timestamp()\`로 날짜로 되돌리는 편이 편합니다.`,
    dbx: `SQL: \`DATE_TRUNC('month', ts)\`, \`EXTRACT(HOUR FROM ts)\` · PySpark: \`F.date_trunc('month', 'ts')\`, \`F.dayofweek('ts')\` (일요일=1 … 토요일=7)`,
    related: ['pd-07', 'pd-06', 'sql-08', 'sql-10'],
  },
  {
    id: 'timedelta', tier: 'core', group: '날짜',
    title: '날짜 차이 · Timedelta · DateOffset',
    summary: '두 날짜의 차이를 일·초 단위로 구하거나, 날짜에 기간을 더합니다.',
    body: `
      datetime끼리 빼면 \`timedelta64\` 타입이 됩니다. 숫자로 쓰려면 단위를 꺼냅니다.
      - \`(b - a).dt.days\`: 일수(정수, 내림), \`.dt.total_seconds()\`: 초(실수)
      - 고정 길이 더하기: \`ts + pd.Timedelta(days=7)\`, \`pd.to_timedelta(n, unit='D')\`
      - 달력 기준 더하기: \`ts + pd.DateOffset(months=1)\` (월말 자동 보정)`,
    syntax: `(df['end'] - df['start']).dt.days
(df['end'] - df['start']).dt.total_seconds() / 60
df['ts'] + pd.Timedelta(days=7)
df['ts'] + pd.DateOffset(months=1)`,
    examples: [
      { title: '가입부터 첫 주문까지 걸린 일수', code: `first = orders.groupby('user_id')['order_ts'].min().rename('first_order')
df = users.merge(first, left_on='user_id', right_index=True)
df['days_to_first'] = (df['first_order'].dt.normalize() - df['signup_date']).dt.days
df['days_to_first'].describe()` },
      { title: '세션 길이(분) 분포', code: `s = events.groupby('session_id')['event_ts'].agg(['min', 'max'])
((s['max'] - s['min']).dt.total_seconds() / 60).describe()` },
      { title: 'Timedelta(30일) vs DateOffset(1개월)', code: `d = pd.Timestamp('2025-01-31')
pd.Series({'+30일': d + pd.Timedelta(days=30), '+1개월': d + pd.DateOffset(months=1)})` },
    ],
    tips: `
      - 시각이 있는 타임스탬프끼리 빼면 "23시간"은 0일로 내림됩니다. **날짜 기준 일수**를 원하면 양쪽을 \`dt.normalize()\`한 뒤 뺍니다.
      - \`.dt.days\`는 timedelta 컬럼에만 있습니다. datetime 컬럼에 쓰면 에러가 나니 뺄셈이 먼저입니다.
      - 리텐션의 "N일차"는 \`(활동일 - 가입일).dt.days\`로 구합니다.`,
    dbx: `SQL/Spark: \`DATEDIFF(end, start)\`(일수), \`DATE_ADD(d, 7)\`, \`ADD_MONTHS(d, 1)\``,
    related: ['pd-10', 'sql-19', 'pd-08', 'sql-15'],
  },

  // ───────────────────────── core: 문자열 ─────────────────────────
  {
    id: 'str-accessor', tier: 'core', group: '문자열',
    title: '.str 접근자: 문자열 처리',
    summary: '문자열 컬럼 전체에 대소문자 변환, 포함 여부, 치환, 분리, 자르기를 적용합니다.',
    body: `
      문자열 컬럼 뒤에 \`.str\`을 붙이면 파이썬 문자열 메서드를 벡터로 쓸 수 있습니다. 결측은 결측 그대로 둡니다.
      - \`lower()\` / \`upper()\` / \`strip()\` / \`len()\`
      - \`contains('pat', case=False, na=False)\`, \`startswith()\`, \`endswith()\`
      - \`replace('a', 'b')\`, \`split(' ')\` → 리스트, \`split(' ', expand=True)\` → 여러 컬럼
      - 자르기: \`s.str[:3]\` = \`s.str.slice(0, 3)\`, 리스트 원소: \`s.str.split().str[-1]\`
      - 정규식 추출: \`extract(r'(\\d+)')\``,
    syntax: `s.str.lower()
s.str.contains('pro', case=False, na=False)
s.str.replace('old', 'new', regex=False)
s.str.split(' ', expand=True)
s.str[:3]
s.str.extract(r'([A-Z]+)(\\d+)')`,
    examples: [
      { title: '이름에 Pro가 들어간 상품 (대소문자 무시)', code: `products[products['product_name'].str.contains('pro', case=False)][['product_name', 'category', 'price']].head()` },
      { title: '상품명에서 등급(마지막 단어) 뽑아 평균 가격', code: `(products
 .assign(grade=products['product_name'].str.split().str[-1])
 .groupby('grade')['price'].mean()
 .round())` },
      { title: '쿠폰 코드를 이름과 할인율로 분리 (정규식)', code: `orders['coupon_code'].dropna().str.extract(r'(?P<name>[A-Z]+)(?P<pct>\\d+)').drop_duplicates()` },
      { title: '문자 치환', code: `users['age_group'].str.replace('+', ' 이상', regex=False).value_counts()` },
    ],
    tips: `
      - 결측이 있는 컬럼에 \`str.contains\`로 필터하면 NaN 때문에 에러가 납니다. \`na=False\`를 넣으세요.
      - \`contains\`는 기본이 **정규식**입니다. \`.\`, \`+\`, \`(\` 같은 문자를 그대로 찾으려면 \`regex=False\`.
      - \`str.replace\`는 pandas 2.0부터 기본 \`regex=False\`입니다. 정규식 치환은 \`regex=True\`를 명시하세요.
      - 숫자 컬럼에는 \`.str\`이 없습니다. \`astype(str)\` 후 사용합니다.`,
    dbx: `PySpark: \`F.lower\`, \`F.col('c').contains('x')\`, \`F.regexp_replace\`, \`F.split\`, \`F.regexp_extract\`, \`F.substring('c', 1, 3)\`(1부터 시작)`,
  },

  // ───────────────────────── core: 재구성 ─────────────────────────
  {
    id: 'pivot-table', tier: 'core', group: '재구성',
    title: 'pivot_table: 행 × 열 요약표',
    summary: '두 기준(행, 열)으로 값을 집계해 엑셀 피벗 같은 넓은 표를 만듭니다.',
    body: `
      \`index\`(행), \`columns\`(열), \`values\`(값), \`aggfunc\`(집계 함수)를 지정합니다. "월 × 카테고리 매출", "국가 × 디바이스 유저 수" 같은 크로스 집계에 씁니다.
      - \`fill_value=0\`: 조합이 없는 칸을 0으로
      - \`margins=True\`: 행·열 합계(\`All\`) 추가
      - groupby 두 키 + \`unstack()\`과 같은 결과입니다.`,
    syntax: `df.pivot_table(index='row_key', columns='col_key', values='val',
               aggfunc='sum', fill_value=0, margins=False)`,
    examples: [
      { title: '월 × 결제수단 매출', code: `done = orders[orders['status'] == 'completed']
(done.assign(month=done['order_ts'].dt.to_period('M'))
 .pivot_table(index='month', columns='payment_method', values='total_amount',
              aggfunc='sum', fill_value=0)
 .head())` },
      { title: '국가 × 디바이스 유저 수 + 합계', code: `users.pivot_table(index='country', columns='device', values='user_id', aggfunc='count', margins=True)` },
      { title: '실험 × 그룹 전환율', code: `ab_test.pivot_table(index='experiment', columns='variant', values='converted', aggfunc='mean').round(4)` },
    ],
    tips: `
      - \`aggfunc\`의 **기본값은 \`'mean'\`**입니다. 합계를 원하면 반드시 \`aggfunc='sum'\`을 적으세요.
      - 결과 열 이름에 \`columns\` 이름(예: \`payment_method\`)이 붙어 있습니다. 평평한 표가 필요하면 \`.reset_index()\` 후 \`df.columns.name = None\`.
      - 집계 없이 모양만 바꾸는 \`pivot\`은 (index, columns) 조합이 중복되면 에러가 납니다. 중복 가능성이 있으면 \`pivot_table\`을 씁니다.`,
    dbx: `SQL: \`SUM(CASE WHEN col = 'x' THEN val END)\` 조건부 집계 또는 \`PIVOT\` 절 · PySpark: \`df.groupBy('row').pivot('col').agg(F.sum('val'))\``,
    related: ['pd-06', 'sql-20'],
  },

  // ───────────────────────── core: 윈도우 계열 ─────────────────────────
  {
    id: 'rank', tier: 'core', group: '윈도우 계열',
    title: 'rank: 순위 매기기',
    summary: '값의 순위를 구합니다. groupby와 함께 쓰면 그룹 내 순위입니다.',
    body: `
      \`s.rank(method=..., ascending=...)\`로 순위를 매깁니다. 동점 처리 방식(\`method\`)이 SQL 순위 함수와 대응됩니다.
      | method | 동점 처리 | SQL |
      |---|---|---|
      | \`'average'\` (기본) | 평균 순위 (1, 2.5, 2.5, 4) | — |
      | \`'min'\` | 같은 순위, 다음은 건너뜀 (1, 2, 2, 4) | \`RANK()\` |
      | \`'dense'\` | 같은 순위, 건너뛰지 않음 (1, 2, 2, 3) | \`DENSE_RANK()\` |
      | \`'first'\` | 먼저 나온 행이 앞 순위 (1, 2, 3, 4) | \`ROW_NUMBER()\` |`,
    syntax: `s.rank(method='dense', ascending=False)
df.groupby('key')['val'].rank(method='min', ascending=False)`,
    examples: [
      { title: 'method별 차이', code: `s = pd.Series([300, 200, 200, 100], index=list('abcd'))
pd.DataFrame({
    'value': s,
    'average': s.rank(ascending=False),
    'min': s.rank(method='min', ascending=False),
    'dense': s.rank(method='dense', ascending=False),
    'first': s.rank(method='first', ascending=False),
})` },
      { title: '부서별 급여 상위 2위까지 (dense)', code: `emp = employees.merge(departments, on='dept_id')
emp['rk'] = emp.groupby('dept_name')['salary'].rank(method='dense', ascending=False).astype(int)
emp[emp['rk'] <= 2].sort_values(['dept_name', 'rk'])[['dept_name', 'name', 'salary', 'rk']].head(8)` },
    ],
    tips: `
      - 결과는 \`float\`입니다. 정수로 보려면 \`.astype(int)\` (결측이 있으면 \`'Int64'\`).
      - 기본은 **오름차순**(작은 값이 1위)입니다. "많은 순 1위"는 \`ascending=False\`.
      - \`'first'\`의 동점 순서는 현재 행 순서이므로, 재현 가능한 ROW_NUMBER가 필요하면 먼저 정렬하세요.
      - \`pct=True\`는 \`순위 / 개수\`입니다. SQL \`PERCENT_RANK()\`(\`(rank-1)/(n-1)\`)와 계산식이 다릅니다.`,
    dbx: `SQL: \`DENSE_RANK() OVER (PARTITION BY dept ORDER BY salary DESC)\` · PySpark: \`F.dense_rank().over(Window.partitionBy('dept').orderBy(F.desc('salary')))\``,
    related: ['sql-07'],
  },
  {
    id: 'shift-diff', tier: 'core', group: '윈도우 계열',
    title: 'shift · diff · pct_change: 이전/다음 행과 비교',
    summary: '이전 행 값 가져오기, 차이, 증감률을 구합니다. SQL의 LAG/LEAD입니다.',
    body: `
      - \`shift(1)\`: 한 행 아래로 밀기 → **이전 행 값** (LAG), \`shift(-1)\`: 다음 행 값 (LEAD)
      - \`diff()\`: 현재 - 이전, \`pct_change()\`: (현재 - 이전) / 이전
      - groupby 뒤에 쓰면 **그룹 경계를 넘지 않습니다** (유저별 이전 주문 등).
      모두 현재 행 순서를 기준으로 하므로 **먼저 정렬**해야 합니다.`,
    syntax: `s.shift(1)        # LAG
s.shift(-1)       # LEAD
s.diff()
s.pct_change()
df.sort_values(['key', 'ts']).groupby('key')['val'].shift(1)`,
    examples: [
      { title: '월별 매출과 전월 대비 증감률', code: `done = orders[orders['status'] == 'completed']
m = done.groupby(done['order_ts'].dt.to_period('M'))['total_amount'].sum().to_frame('revenue')
m['prev_revenue'] = m['revenue'].shift(1)
m['mom'] = m['revenue'].pct_change()
m.head()` },
      { title: '유저별 직전 주문과의 간격(일)', code: `o = orders.sort_values(['user_id', 'order_ts']).copy()
o['gap_days'] = o.groupby('user_id')['order_ts'].diff().dt.days
o[['user_id', 'order_ts', 'gap_days']].head(6)` },
      { title: '세션 안에서 다음 이벤트 (LEAD)', code: `e = events.sort_values(['session_id', 'event_ts']).copy()
e['next_event'] = e.groupby('session_id')['event_type'].shift(-1)
e[['session_id', 'event_ts', 'event_type', 'next_event']].head(6)` },
    ],
    tips: `
      - 정렬하지 않고 \`shift\`/\`diff\`를 쓰면 "이전 행"이 시간상 이전이 아닐 수 있습니다.
      - 그룹을 무시하고 \`df['val'].shift()\`를 쓰면 앞 유저의 마지막 값이 다음 유저 첫 행에 들어옵니다. \`groupby(...).shift()\`를 쓰세요.
      - 값에 결측이 있으면 \`pct_change()\`가 FutureWarning을 냅니다(기본 \`fill_method='pad'\` deprecated). \`pct_change(fill_method=None)\`으로 명시하세요.
      - 월별 집계에서 빠진 달이 있으면 \`shift(1)\`이 "전월"이 아니라 "직전 데이터가 있는 달"이 됩니다. 필요하면 \`reindex\`로 달을 채운 뒤 비교합니다.`,
    dbx: `SQL: \`LAG(val) OVER (PARTITION BY key ORDER BY ts)\` · PySpark: \`F.lag('val').over(Window.partitionBy('key').orderBy('ts'))\``,
    related: ['sql-10', 'sql-19'],
  },
  {
    id: 'cumulative', tier: 'core', group: '윈도우 계열',
    title: 'cumsum · cumcount · cummax: 누적 계산',
    summary: '누적 합계, 그룹 내 순번, 누적 최댓값을 구합니다.',
    body: `
      - \`cumsum()\`: 누적 합 (누적 매출), \`cummax()\` / \`cummin()\`: 지금까지의 최댓값/최솟값
      - \`groupby('key').cumcount()\`: 그룹 안에서 **0부터** 매기는 순번 (n번째 주문)
      - \`groupby('key')['val'].cumsum()\`: 그룹별 누적 합
      순서가 의미 있는 계산이므로 **정렬 후** 적용합니다.`,
    syntax: `s.cumsum()
df.groupby('key').cumcount() + 1
df.groupby('key')['val'].cumsum()
s.cummax()`,
    examples: [
      { title: '일별 매출과 누적 매출', code: `done = orders[orders['status'] == 'completed']
daily = done.groupby(done['order_ts'].dt.normalize())['total_amount'].sum().to_frame('revenue')
daily['cum_revenue'] = daily['revenue'].cumsum()
daily.head()` },
      { title: '유저별 주문 순번과 누적 결제액', code: `o = orders.sort_values(['user_id', 'order_ts']).copy()
o['order_seq'] = o.groupby('user_id').cumcount() + 1
o['cum_spend'] = o.groupby('user_id')['total_amount'].cumsum()
o[['user_id', 'order_ts', 'total_amount', 'order_seq', 'cum_spend']].head(6)` },
      { title: '누적 비중 (파레토): 상위 유저가 매출의 몇 %?', code: `rev = orders[orders['status'] == 'completed'].groupby('user_id')['total_amount'].sum()
cum_share = rev.sort_values(ascending=False).cumsum() / rev.sum()
cum_share.reset_index(drop=True).iloc[[9, 99, 499]]` },
    ],
    tips: `
      - \`cumcount()\`는 0부터 시작합니다. "첫 주문 = 1"로 쓰려면 \`+ 1\`.
      - \`sort_values\` 없이 \`cumsum\`을 하면 파일 순서대로 누적되어 의미 없는 값이 됩니다.
      - 연속 구간(3일 연속 접속 등)은 \`날짜 - cumcount일\`이 같은 행끼리 묶는 패턴으로 풉니다.`,
    dbx: `SQL: \`SUM(val) OVER (PARTITION BY key ORDER BY ts ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)\`, \`ROW_NUMBER()\``,
    related: ['sql-09', 'sql-15'],
  },
  {
    id: 'rolling', tier: 'core', group: '윈도우 계열',
    title: 'rolling: 이동 평균·이동 합',
    summary: '최근 N행(또는 N일) 창으로 평균·합계를 구합니다.',
    body: `
      \`s.rolling(window).집계()\`로 이동 창 집계를 합니다. 일별 지표의 잡음을 줄이는 7일 이동평균이 대표적입니다.
      - \`rolling(7)\`: 현재 포함 최근 **7행**
      - \`rolling('7D')\`: 현재 포함 최근 **7일**(달력 기준) — DatetimeIndex(또는 \`on='날짜컬럼'\`)가 필요
      - \`min_periods=1\`: 창이 다 차지 않은 초기 구간도 계산 (기본은 창 크기만큼 모일 때까지 NaN)`,
    syntax: `s.rolling(7).mean()
s.rolling(7, min_periods=1).mean()
s.rolling('7D').sum()                 # 날짜 인덱스
df.rolling('7D', on='dt')['val'].sum()`,
    examples: [
      { title: '일별 매출 7일 이동평균', code: `done = orders[orders['status'] == 'completed']
daily = done.groupby(done['order_ts'].dt.normalize())['total_amount'].sum().to_frame('revenue')
daily['ma7'] = daily['revenue'].rolling(7, min_periods=1).mean()
daily.head(8)` },
      { title: '행 기준(7) vs 날짜 기준(7D) — 빠진 날짜가 있을 때', code: `s = pd.Series([10, 20, 30, 40], index=pd.to_datetime(['2025-01-01', '2025-01-02', '2025-01-09', '2025-01-10']))
pd.DataFrame({'value': s, 'rows_3': s.rolling(3, min_periods=1).sum(), 'days_7D': s.rolling('7D').sum()})` },
    ],
    tips: `
      - \`rolling(7)\`은 행 7개입니다. 주문이 없는 날이 빠져 있으면 "최근 7일"이 아니게 되니 \`'7D'\`를 쓰거나 날짜를 먼저 채우세요 (\`resample('D')\`, \`reindex\`).
      - 결과는 창의 **오른쪽 끝(현재 행)**에 붙습니다. 가운데 정렬은 \`center=True\`.
      - 그룹별 이동 평균은 \`groupby(...)['val'].transform(lambda s: s.rolling(3).mean())\` (부록 참고).`,
    dbx: `SQL: \`AVG(val) OVER (ORDER BY dt ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)\` · 날짜 기준은 \`RANGE BETWEEN INTERVAL 6 DAYS PRECEDING AND CURRENT ROW\``,
    related: ['sql-09'],
  },

  // ───────────────────────── core: 입출력 ─────────────────────────
  {
    id: 'read-csv', tier: 'core', group: '입출력',
    title: 'read_csv · to_csv',
    summary: 'CSV를 읽고 쓸 때 자주 쓰는 옵션입니다.',
    body: `
      \`pd.read_csv(경로)\`가 기본이고, 데이터 상태에 맞춰 옵션을 붙입니다.
      - \`parse_dates=['col']\`: 날짜로 읽기, \`dtype={'col': 'string'}\`: 타입 지정 (앞자리 0이 있는 코드 등)
      - \`usecols=[...]\`, \`nrows=n\`: 필요한 컬럼·행만 (큰 파일)
      - \`na_values=['-', '없음']\`: 결측으로 볼 값, \`thousands=','\`: 천 단위 쉼표 숫자
      - \`encoding='cp949'\`: 엑셀에서 저장한 한글 CSV, \`sep='\\t'\`: 탭 구분
      - 저장: \`df.to_csv('out.csv', index=False, encoding='utf-8-sig')\``,
    syntax: `pd.read_csv(path, sep=',', usecols=[...], dtype={...},
            parse_dates=['col'], na_values=['-'], thousands=',',
            encoding='utf-8', nrows=None)
df.to_csv('out.csv', index=False, encoding='utf-8-sig')`,
    examples: [
      { title: '쉼표 숫자·결측 표기·날짜를 한 번에 처리', code: `import io
csv = """order_id,ordered_at,amount,coupon
001,2025-01-03,"12,000",WELCOME10
002,2025-01-04,"8,500",
003,2025-01-04,-,FALL10
"""
df = pd.read_csv(io.StringIO(csv), dtype={'order_id': 'string'}, parse_dates=['ordered_at'],
                 thousands=',', na_values=['-'])
df` },
      { title: '읽은 결과의 타입 확인', code: `import io
csv = "order_id,ordered_at,amount\\n001,2025-01-03,\\"12,000\\"\\n002,2025-01-04,8500\\n"
pd.read_csv(io.StringIO(csv), dtype={'order_id': 'string'}, parse_dates=['ordered_at'], thousands=',').dtypes` },
      { title: 'to_csv: 인덱스 없이 문자열로 내보내기', code: `print(orders.head(3).to_csv(index=False))` },
    ],
    tips: `
      - \`to_csv\`에서 \`index=False\`를 빼면 의미 없는 \`Unnamed: 0\` 컬럼이 생깁니다.
      - 엑셀에서 한글이 깨지면 \`encoding='utf-8-sig'\`(BOM 포함)로 저장하세요.
      - 우편번호·상품코드처럼 앞자리 0이 중요한 컬럼은 \`dtype=str\`로 읽어야 0이 사라지지 않습니다.
      - 큰 파일은 \`usecols\`와 \`dtype\`(category 등)을 지정하면 메모리를 크게 줄일 수 있습니다.`,
    dbx: `PySpark: \`spark.read.csv(path, header=True, inferSchema=True)\`, 저장은 \`df.write.mode('overwrite').csv(path)\` (파일 여러 개로 나뉘어 저장됨)`,
  },

  // ───────────────────────── appendix: 재구성 심화 ─────────────────────────
  {
    id: 'melt-pivot', tier: 'appendix', group: '재구성 심화',
    title: 'melt · pivot: 넓은 표 ↔ 긴 표',
    summary: '열로 펼쳐진 표를 행으로 내리거나(melt), 다시 펼칩니다(pivot).',
    body: `
      - \`melt(id_vars, value_vars, var_name, value_name)\`: 여러 열을 "변수명/값" 두 열로 내립니다 (wide → long). 시각화·groupby 하기 좋은 모양입니다.
      - \`pivot(index, columns, values)\`: 집계 없이 long → wide. 조합이 중복되면 에러가 납니다.`,
    syntax: `df.melt(id_vars=['id'], value_vars=['a', 'b'], var_name='metric', value_name='value')
df.pivot(index='id', columns='metric', values='value')`,
    examples: [
      { title: '실험별 전환율 표를 긴 표로', code: `wide = ab_test.pivot_table(index='experiment', columns='variant', values='converted', aggfunc='mean').reset_index()
wide.columns.name = None
wide.melt(id_vars='experiment', var_name='variant', value_name='cvr')` },
      { title: '긴 표를 다시 넓게 (pivot)', code: `long = ab_test.groupby(['experiment', 'variant'], as_index=False)['converted'].mean()
long.pivot(index='experiment', columns='variant', values='converted')` },
    ],
    tips: `
      - \`pivot\`에서 \`ValueError: Index contains duplicate entries\`가 나면 집계가 필요한 데이터입니다. \`pivot_table\`을 쓰세요.
      - \`value_vars\`를 생략하면 \`id_vars\`를 뺀 모든 열이 내려갑니다.`,
    dbx: `SQL \`UNPIVOT\` / \`PIVOT\` · PySpark 3.4+: \`df.unpivot(...)\`(=\`melt\`), \`groupBy().pivot()\``,
  },
  {
    id: 'stack-unstack', tier: 'appendix', group: '재구성 심화',
    title: 'stack · unstack: 인덱스 ↔ 열',
    summary: 'MultiIndex의 한 레벨을 열로 펼치거나(unstack), 열을 인덱스로 접습니다(stack).',
    body: `
      두 키로 groupby한 Series에 \`.unstack()\`을 붙이면 마지막 키가 열로 펼쳐집니다. \`pivot_table\`과 같은 모양을 groupby 흐름 안에서 만들 때 편합니다.
      - \`unstack(level=-1, fill_value=0)\`: 인덱스 레벨 → 열
      - \`stack()\`: 열 → 인덱스 레벨 (반대 방향)`,
    syntax: `df.groupby(['a', 'b'])['v'].sum().unstack(fill_value=0)
wide.stack()`,
    examples: [
      { title: '국가 × 디바이스 유저 수 (unstack)', code: `users.groupby(['country', 'device']).size().unstack(fill_value=0)` },
      { title: '첫 번째 레벨을 열로 (level=0)', code: `orders.groupby(['status', 'payment_method']).size().unstack(level=0)` },
      { title: 'stack으로 다시 긴 형태로', code: `wide = users.groupby(['country', 'device']).size().unstack()
wide.stack().head()` },
    ],
    tips: `
      - 조합이 없는 칸은 NaN이 되어 정수가 float로 바뀝니다. \`fill_value=0\`을 쓰세요.
      - 코호트 리텐션 표(코호트 × N개월차)도 groupby 두 키 + \`unstack\`으로 만듭니다.`,
  },
  {
    id: 'crosstab', tier: 'appendix', group: '재구성 심화',
    title: 'crosstab: 교차 빈도표',
    summary: '두 범주 변수의 조합별 빈도(또는 비율)를 표로 만듭니다.',
    body: `
      \`pd.crosstab(행, 열)\`은 조합별 **개수**를 세는 데 특화된 pivot입니다. 컬럼이 아니라 Series를 받으므로 서로 다른 계산 결과끼리도 교차할 수 있습니다.
      - \`normalize='index'\`: 행 기준 비율 (각 행 합 = 1), \`'columns'\`, \`'all'\`
      - \`margins=True\`: 합계 행/열`,
    syntax: `pd.crosstab(df['a'], df['b'])
pd.crosstab(df['a'], df['b'], normalize='index', margins=True)
pd.crosstab(df['a'], df['b'], values=df['v'], aggfunc='sum')`,
    examples: [
      { title: '국가 × 디바이스 유저 수', code: `pd.crosstab(users['country'], users['device'], margins=True)` },
      { title: '채널별 마케팅 수신 동의 비율 (행 기준)', code: `pd.crosstab(users['channel'], users['marketing_opt_in'], normalize='index').round(3)` },
      { title: '세션 × 이벤트 유형 존재 여부 → 퍼널', code: `flags = pd.crosstab(events['session_id'], events['event_type']) > 0
flags[['visit', 'view_item', 'add_to_cart', 'checkout', 'purchase']].sum()` },
    ],
    tips: `
      - 값 합계 같은 집계가 필요하면 \`values\`와 \`aggfunc\`를 같이 줘야 합니다. 대부분 \`pivot_table\`이 더 읽기 쉽습니다.
      - 카이제곱 검정(\`scipy.stats.chi2_contingency\`)의 입력 분할표로 바로 쓸 수 있습니다.`,
    dbx: `PySpark: \`df.crosstab('a', 'b')\` (빈도만)`,
    related: ['sql-12'],
  },
  {
    id: 'explode', tier: 'appendix', group: '재구성 심화',
    title: 'explode: 리스트를 여러 행으로',
    summary: '한 칸에 든 리스트(태그 목록 등)를 원소마다 한 행으로 펼칩니다.',
    body: `
      "a,b,c"처럼 한 컬럼에 여러 값이 들어 있으면 \`str.split\`으로 리스트를 만든 뒤 \`explode\`로 행을 늘립니다. 다른 컬럼 값은 복제되고 인덱스도 그대로 반복됩니다.`,
    syntax: `df.assign(tag=df['tags'].str.split(',')).explode('tag')
df.explode('list_col', ignore_index=True)`,
    examples: [
      { title: '쉼표로 묶인 태그 펼치기', code: `df = pd.DataFrame({'user_id': [1, 2, 3], 'tags': ['sale,new', 'new', None]})
df.assign(tag=df['tags'].str.split(',')).explode('tag')` },
      { title: '상품명 단어 빈도', code: `(products['product_name'].str.split()
 .explode()
 .value_counts()
 .head())` },
    ],
    tips: `
      - 빈 리스트와 NaN은 NaN 한 행으로 남습니다.
      - 펼친 뒤 원래 인덱스가 반복되므로, 이어서 \`loc\` 할당을 하려면 \`ignore_index=True\`나 \`reset_index(drop=True)\`를 쓰세요.`,
    dbx: `SQL/Spark: \`LATERAL VIEW explode(split(tags, ','))\` · PySpark: \`F.explode(F.split('tags', ','))\``,
  },
  {
    id: 'multiindex', tier: 'appendix', group: '재구성 심화',
    title: 'MultiIndex 다루기',
    summary: '여러 키 groupby 결과의 다중 인덱스·다중 열을 선택하고 평평하게 만듭니다.',
    body: `
      키 여러 개로 groupby하면 인덱스가, 한 컬럼에 함수 여러 개를 agg하면 열이 MultiIndex가 됩니다.
      - 선택: \`s.loc['completed']\`(바깥 레벨), \`s.loc[('completed', 'card')]\`, \`s.xs('card', level='payment_method')\`
      - 레벨 값 꺼내기: \`idx.get_level_values('user_id')\`
      - 평평하게: \`reset_index()\`, 열은 \`df.columns = ['_'.join(c) for c in df.columns]\``,
    syntax: `s.loc['a']
s.loc[('a', 'x')]
s.xs('x', level='b')
df.columns = ['_'.join(c) for c in df.columns]`,
    examples: [
      { title: '두 키 결과에서 한 레벨로 선택', code: `g = orders.groupby(['status', 'payment_method'])['total_amount'].sum()
g.xs('card', level='payment_method')` },
      { title: '다중 열을 한 줄 이름으로', code: `t = orders.groupby('status').agg({'total_amount': ['sum', 'mean'], 'discount_amount': ['sum']})
t.columns = ['_'.join(c) for c in t.columns]
t.reset_index()` },
    ],
    tips: `
      - 다중 열이 생기는 \`agg({'col': [...]})\` 대신 named aggregation을 쓰면 처음부터 평평한 열 이름을 얻습니다.
      - \`get_level_values\`로 꺼낸 값으로 \`nunique()\` 등을 바로 계산할 수 있습니다.`,
    related: ['sql-15'],
  },

  // ───────────────────────── appendix: 구간·범주 ─────────────────────────
  {
    id: 'cut-qcut', tier: 'appendix', group: '구간·범주',
    title: 'pd.cut · pd.qcut: 구간 나누기',
    summary: '숫자를 고정 경계(cut) 또는 분위수(qcut)로 구간화합니다.',
    body: `
      - \`pd.cut(s, bins=[...], labels=[...])\`: 직접 정한 경계로 나눔 (금액대, 연령대). 기본은 \`(a, b]\` — 왼쪽 미포함, 오른쪽 포함
      - \`right=False\`: \`[a, b)\` — "10만 원 이상 50만 원 미만" 같은 표현에 맞음
      - \`pd.qcut(s, q=4)\`: 각 구간에 **같은 개수**가 들어가도록 분위수로 나눔 (사분위 등급, 상위 10%)
      결과는 순서 있는 category 타입입니다.`,
    syntax: `pd.cut(s, bins=[0, 100000, 500000, np.inf], labels=['L', 'M', 'H'], right=False)
pd.qcut(s, q=4, labels=['Q1', 'Q2', 'Q3', 'Q4'])
pd.qcut(s, q=[0, .9, 1], labels=['나머지', '상위10%'])`,
    examples: [
      { title: '누적 매출 등급 (이상/미만 경계)', code: `rev = orders[orders['status'] == 'completed'].groupby('user_id')['total_amount'].sum()
tier = pd.cut(rev, bins=[0, 100000, 500000, np.inf], labels=['Light', 'Regular', 'VIP'], right=False)
pd.DataFrame({'tier': tier, 'revenue': rev}).groupby('tier', observed=True)['revenue'].agg(['size', 'sum'])` },
      { title: '사분위 등급 (qcut)', code: `rev = orders[orders['status'] == 'completed'].groupby('user_id')['total_amount'].sum()
pd.qcut(rev, q=4, labels=['Q1', 'Q2', 'Q3', 'Q4']).value_counts().sort_index()` },
    ],
    tips: `
      - cut 결과(category)로 groupby할 때 \`observed=True\`를 지정하세요. 생략하면 pandas 2.1+에서 FutureWarning이 나고, \`False\`면 빈 구간도 행으로 나옵니다.
      - 경계 밖 값(예: 0원)은 NaN이 됩니다. 첫 경계를 포함하려면 \`include_lowest=True\`(right=True일 때) 또는 \`right=False\`.
      - qcut은 같은 값이 많으면 경계가 겹쳐 에러가 납니다 → \`duplicates='drop'\` 또는 \`rank(method='first')\` 후 qcut.`,
    dbx: `SQL: \`CASE WHEN\` 구간 / \`NTILE(4) OVER (ORDER BY revenue)\` · PySpark ML: \`Bucketizer\`, \`QuantileDiscretizer\``,
    related: ['pd-11', 'pd-12'],
  },
  {
    id: 'category', tier: 'appendix', group: '구간·범주',
    title: 'category 타입: 순서 정하기와 메모리 절약',
    summary: '반복되는 문자열을 범주형으로 바꿔 원하는 정렬 순서를 주고 메모리를 줄입니다.',
    body: `
      - \`pd.Categorical(s, categories=[...], ordered=True)\`: 사전순이 아닌 **업무 순서**로 정렬 (요일, 등급, 퍼널 단계)
      - \`s.astype('category')\`: 고유값이 적은 문자열 컬럼의 메모리를 크게 줄임
      - \`s.cat.categories\`, \`s.cat.codes\`로 범주 목록과 정수 코드를 볼 수 있습니다.`,
    syntax: `pd.Categorical(s, categories=['a', 'b', 'c'], ordered=True)
s.astype('category')
pd.CategoricalDtype(categories=[...], ordered=True)`,
    examples: [
      { title: '퍼널 단계 순서대로 정렬', code: `steps = ['visit', 'view_item', 'add_to_cart', 'checkout', 'purchase']
stage = pd.Categorical(events['event_type'], categories=steps, ordered=True)
pd.Series(stage).value_counts().sort_index()` },
      { title: '요일을 월~일 순서로', code: `days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
dow = pd.Categorical(orders['order_ts'].dt.day_name(), categories=days, ordered=True)
orders.groupby(dow, observed=True)['total_amount'].sum()` },
    ],
    tips: `
      - category로 groupby/pivot_table할 때는 \`observed=True\`를 명시하세요 (빈 범주 처리 + FutureWarning 방지).
      - 범주에 없는 값을 할당하면 에러가 납니다. \`s.cat.add_categories\`로 먼저 추가합니다.
      - merge 키로 쓰면 양쪽 범주가 달라 object로 바뀌기도 하니, 키는 일반 타입으로 두는 편이 안전합니다.`,
  },

  // ───────────────────────── appendix: 그룹·선택 보조 ─────────────────────────
  {
    id: 'nlargest', tier: 'appendix', group: '그룹·선택 보조',
    title: 'nlargest · nsmallest: 상위/하위 N개',
    summary: '정렬 + head를 한 번에, 더 빠르게 합니다.',
    body: `
      \`df.nlargest(n, 'col')\`은 \`sort_values('col', ascending=False).head(n)\`과 같습니다. Series에도 쓸 수 있습니다.
      - \`keep='all'\`: N번째와 동점인 행을 모두 포함
      - 그룹별 TOP N은 \`sort_values\` + \`groupby().head(n)\`이 간단합니다.`,
    syntax: `df.nlargest(5, 'col')
df.nlargest(5, ['a', 'b'], keep='all')
s.nsmallest(3)
df.sort_values('v', ascending=False).groupby('key').head(2)`,
    examples: [
      { title: '가장 비싼 상품 5개', code: `products.nlargest(5, 'price')` },
      { title: '두 번째로 높은 급여 (중복 제거 후)', code: `employees['salary'].drop_duplicates().nlargest(2).iloc[-1]` },
      { title: '카테고리별 가장 비싼 상품 2개', code: `(products.sort_values('price', ascending=False)
 .groupby('category')
 .head(2)
 .sort_values(['category', 'price'], ascending=[True, False]))` },
    ],
    tips: `
      - 숫자 컬럼에만 쓸 수 있습니다 (문자열 컬럼은 \`sort_values\`).
      - 동점이 신경 쓰이면 \`keep='all'\`을 쓰거나 \`rank(method='dense')\`로 필터하세요.`,
    dbx: `SQL: \`ORDER BY col DESC LIMIT 5\` · PySpark: \`df.orderBy(F.desc('col')).limit(5)\``,
    related: ['sql-06'],
  },
  {
    id: 'idxmax', tier: 'appendix', group: '그룹·선택 보조',
    title: 'idxmax · idxmin: 최댓값의 위치',
    summary: '최댓값/최솟값이 있는 행의 인덱스 라벨을 돌려줍니다.',
    body: `
      \`s.idxmax()\`는 값이 아니라 **인덱스**를 돌려줍니다. "매출이 가장 높은 날은 언제?"처럼 최댓값의 주인을 찾을 때 씁니다.
      groupby와 함께 \`df.loc[df.groupby('key')['v'].idxmax()]\`로 쓰면 **그룹별 최댓값 행 전체**를 뽑을 수 있습니다.`,
    syntax: `s.idxmax()
df.loc[df.groupby('key')['val'].idxmax()]`,
    examples: [
      { title: '매출이 가장 높은 날', code: `done = orders[orders['status'] == 'completed']
daily = done.groupby(done['order_ts'].dt.normalize())['total_amount'].sum()
daily.idxmax(), daily.max()` },
      { title: '부서별 최고 연봉자 (행 전체)', code: `emp = employees.dropna(subset=['dept_id'])
emp.loc[emp.groupby('dept_id')['salary'].idxmax(), ['dept_id', 'name', 'salary']]` },
    ],
    tips: `
      - 동점이면 **처음 나온** 하나만 돌려줍니다. 동점 모두가 필요하면 \`transform('max')\`와 비교해 필터하세요.
      - 인덱스에 중복이 있으면 \`loc\`이 여러 행을 돌려줄 수 있습니다. 필터 후에는 인덱스가 유일한지 확인하세요.`,
  },
  {
    id: 'groupby-filter', tier: 'appendix', group: '그룹·선택 보조',
    title: 'groupby + filter: 조건을 만족하는 그룹만',
    summary: '그룹 단위 조건으로 행을 남깁니다. SQL의 HAVING에 해당합니다.',
    body: `
      \`df.groupby('key').filter(lambda g: 조건)\`은 조건이 True인 **그룹의 모든 행**을 남깁니다 (집계 결과가 아니라 원본 행).
      같은 일을 \`transform\`으로 하면 더 빠릅니다: \`df[df.groupby('key')['col'].transform('size') >= 3]\``,
    syntax: `df.groupby('key').filter(lambda g: len(g) >= 3)
df[df.groupby('key')['val'].transform('sum') >= 100]`,
    examples: [
      { title: '주문이 3건 이상인 유저의 주문만', code: `heavy = orders.groupby('user_id').filter(lambda g: len(g) >= 3)
heavy['user_id'].nunique(), len(heavy)` },
      { title: '같은 결과를 transform으로 (빠름)', code: `heavy = orders[orders.groupby('user_id')['order_id'].transform('size') >= 3]
heavy['user_id'].nunique(), len(heavy)` },
      { title: '집계 결과에 조건 걸기 (HAVING처럼)', code: `rev = orders[orders['status'] == 'completed'].groupby('user_id')['total_amount'].sum()
rev[rev >= 1000000].sort_values(ascending=False).head()` },
    ],
    tips: `
      - 그룹 수가 많으면 lambda 호출이 느립니다. 수천 그룹 이상이면 \`transform\` 방식을 쓰세요.
      - 그룹별 집계표만 필요하면 집계 후 불리언 필터가 가장 간단합니다.`,
    dbx: `SQL의 \`GROUP BY ... HAVING COUNT(*) >= 3\` (원본 행이 필요하면 윈도우 \`COUNT(*) OVER (PARTITION BY ...)\`로 필터)`,
    related: ['sql-02'],
  },
  {
    id: 'groupby-apply', tier: 'appendix', group: '그룹·선택 보조',
    title: 'groupby + apply: 그룹마다 임의의 함수',
    summary: 'agg/transform으로 안 되는 그룹 단위 계산을 함수로 처리합니다.',
    body: `
      \`groupby(...).apply(func)\`는 그룹별 DataFrame을 함수에 넘기고 결과를 이어 붙입니다. 가장 유연하지만 가장 느립니다.
      - pandas 2.2부터 그룹 키 컬럼까지 함수에 넘기는 동작이 deprecated입니다. 필요한 컬럼만 선택하거나 \`include_groups=False\`를 씁니다.
      - \`group_keys=False\`: 결과 인덱스에 그룹 키를 덧붙이지 않음`,
    syntax: `df.groupby('key')[['a', 'b']].apply(func)
df.groupby('key').apply(func, include_groups=False)   # pandas 2.2+`,
    examples: [
      { title: '유저별 금액 상위 2건 주문', code: `(orders.groupby('user_id', group_keys=False)[['order_id', 'order_ts', 'total_amount']]
 .apply(lambda g: g.nlargest(2, 'total_amount'))
 .head(6))` },
      { title: '그룹별 여러 값을 Series로 반환', code: `def summary(g):
    return pd.Series({'n': len(g), 'cvr': g['converted'].mean(), 'arpu': g['revenue'].mean()})

ab_test.groupby(['experiment', 'variant']).apply(summary, include_groups=False)` },
    ],
    tips: `
      - 먼저 \`agg\`(named aggregation), \`transform\`, \`sort_values + head\`로 풀 수 있는지 보세요. 대부분 가능하고 훨씬 빠릅니다.
      - 그룹 키 컬럼을 포함한 채 apply하면 경고가 납니다 (2.2는 \`DeprecationWarning\`, 2.3은 \`FutureWarning\`). pandas 3.0부터는 키 컬럼이 함수에 전달되지 않습니다.`,
  },
  {
    id: 'where-mask-clip', tier: 'appendix', group: '그룹·선택 보조',
    title: 'where · mask · clip: 조건부 값 유지/대체',
    summary: '조건에 따라 값을 남기거나 바꾸고, 범위를 넘는 값을 자릅니다.',
    body: `
      - \`s.where(cond, other)\`: 조건이 **True인 곳은 유지**, 나머지는 \`other\`(기본 NaN)
      - \`s.mask(cond, other)\`: 조건이 **True인 곳을 대체** (where의 반대)
      - \`s.clip(lower, upper)\`: 범위를 벗어나는 값을 경계값으로 (이상치 윈저라이징)`,
    syntax: `s.where(s > 0)              # 0 이하 → NaN
s.mask(cond, 0)
s.clip(lower=0, upper=s.quantile(0.99))`,
    examples: [
      { title: '할인이 있는 주문만 평균 (나머지 NaN)', code: `d = orders['discount_amount']
pd.Series({'전체 평균': d.mean(), '할인 주문만 평균': d.where(d > 0).mean()})` },
      { title: '완료가 아닌 주문 금액을 0으로', code: `orders['total_amount'].mask(orders['status'] != 'completed', 0).sum()` },
      { title: '상위 1% 이상치를 잘라 평균 비교', code: `s = orders['total_amount'].astype(float)   # 정수 컬럼에 실수 경계를 쓰면 경고 → 미리 float로
cap = s.quantile(0.99)
pd.Series({'cap': cap, 'mean': s.mean(), 'clipped_mean': s.clip(upper=cap).mean()})` },
    ],
    tips: `
      - \`np.where\`와 달리 \`s.where\`는 조건이 False인 곳을 바꿉니다. 방향을 헷갈리기 쉬우니 \`mask\`와 구분하세요.
      - 원본 일부만 바꾸는 할당은 \`df.loc[cond, 'col'] = 값\`이 더 명확할 때가 많습니다.`,
  },
  {
    id: 'sample', tier: 'appendix', group: '그룹·선택 보조',
    title: 'sample: 무작위 추출',
    summary: '행을 무작위로 뽑습니다. 데이터 확인, 부트스트랩, 그룹별 샘플링에 씁니다.',
    body: `
      - \`df.sample(n=5)\` 또는 \`df.sample(frac=0.1)\`
      - \`random_state=42\`: 같은 결과 재현
      - \`replace=True\`: 복원 추출 (부트스트랩)
      - \`df.groupby('key').sample(n=2)\`: 그룹마다 n개 (층화 샘플링)`,
    syntax: `df.sample(n=5, random_state=42)
df.sample(frac=0.1, replace=False)
df.groupby('key').sample(n=2, random_state=0)`,
    examples: [
      { title: '유저 5명 무작위', code: `users.sample(n=5, random_state=42)` },
      { title: '디바이스별 2명씩 (층화)', code: `users.groupby('device').sample(n=2, random_state=0)[['user_id', 'device', 'country']]` },
      { title: '부트스트랩: 전환율의 95% 구간', code: `t = ab_test[ab_test['experiment'] == 'checkout_button_v2']
boots = [t.sample(frac=1, replace=True, random_state=i)['converted'].mean() for i in range(200)]
pd.Series(boots).quantile([0.025, 0.975])` },
    ],
    tips: `
      - \`random_state\`를 고정하지 않으면 실행할 때마다 결과가 바뀝니다. 리포트용 분석은 고정하세요.
      - 큰 데이터 탐색은 전체 대신 \`sample\`로 먼저 확인하면 빠릅니다.`,
    dbx: `PySpark: \`df.sample(fraction=0.1, seed=42)\` — 비율은 근사치라 정확히 n개가 아닙니다.`,
  },

  // ───────────────────────── appendix: 시계열 심화 ─────────────────────────
  {
    id: 'resample', tier: 'appendix', group: '시계열 심화',
    title: 'resample: 시간 단위로 다시 집계',
    summary: '날짜 인덱스를 일·주·월 단위로 묶어 집계하고, 빈 기간도 행으로 채웁니다.',
    body: `
      \`resample('주기')\`는 시간 기준 groupby입니다. groupby와 달리 **데이터가 없는 기간도 행으로 만들어** 줍니다 (합계 0, 평균 NaN).
      - DatetimeIndex에 쓰거나, 컬럼이면 \`on='컬럼'\`
      - 주기: \`'D'\`(일), \`'W'\`(주, 일요일 끝), \`'MS'\`(월초 라벨), \`'ME'\`(월말 라벨), \`'h'\`(시)`,
    syntax: `df.resample('D', on='ts')['val'].sum()
s.resample('W').mean()
df.set_index('ts').resample('MS').agg(n=('val', 'size'), total=('val', 'sum'))`,
    examples: [
      { title: '주별 매출 (on=날짜컬럼)', code: `done = orders[orders['status'] == 'completed']
done.resample('W', on='order_ts')['total_amount'].sum().head()` },
      { title: '월별 주문 수와 매출 (월초 라벨)', code: `done = orders[orders['status'] == 'completed']
done.set_index('order_ts')['total_amount'].resample('MS').agg(['count', 'sum']).head()` },
      { title: '빈 날짜가 0으로 채워진 일별 시리즈', code: `refunds = orders[orders['status'] == 'refunded']
daily = refunds.resample('D', on='order_ts').size()
len(refunds['order_ts'].dt.normalize().unique()), len(daily), (daily == 0).sum()` },
    ],
    tips: `
      - pandas 2.2부터 월말 주기 \`'M'\`은 deprecated → \`'ME'\`, 시간 \`'H'\` → \`'h'\`를 씁니다. (\`to_period('M')\`의 \`'M'\`은 그대로)
      - \`'W'\`의 라벨은 그 주의 **일요일**입니다. 월요일 라벨이 필요하면 \`'W-MON'\`이 아니라 \`to_period('W').dt.start_time\`을 쓰는 편이 명확합니다.
      - 빈 기간을 채우기 싫으면 일반 \`groupby(s.dt.to_period(...))\`를 씁니다.`,
    dbx: `SQL: \`GROUP BY DATE_TRUNC('week', ts)\` (빈 기간은 날짜 테이블과 LEFT JOIN으로 채움) · PySpark: \`F.window('ts', '1 week')\``,
  },
  {
    id: 'merge-asof', tier: 'appendix', group: '시계열 심화',
    title: 'merge_asof: 가장 가까운 시각으로 조인',
    summary: '키가 정확히 같지 않아도 직전(또는 직후) 시각의 행을 붙입니다.',
    body: `
      "주문 직전에 본 상품", "거래 시점의 최신 환율"처럼 **시간상 가장 가까운 행**을 붙일 때 씁니다.
      - 두 DataFrame 모두 시간 키로 **정렬**되어 있어야 합니다.
      - \`by='user_id'\`: 같은 유저 안에서만 찾기
      - \`direction='backward'\`(기본, 이전 중 가장 가까운) | \`'forward'\` | \`'nearest'\`
      - \`tolerance=pd.Timedelta('1h')\`: 이 범위 밖이면 붙이지 않음(NaN)`,
    syntax: `pd.merge_asof(left.sort_values('ts'), right.sort_values('ts'),
              on='ts', by='key', direction='backward',
              tolerance=pd.Timedelta('1h'))`,
    examples: [
      { title: '주문 직전 1시간 안에 마지막으로 본 상품', code: `views = (events.loc[events['event_type'] == 'view_item', ['user_id', 'event_ts', 'product_id']]
         .sort_values('event_ts'))
o = orders[['order_id', 'user_id', 'order_ts']].sort_values('order_ts')
pd.merge_asof(o, views, left_on='order_ts', right_on='event_ts', by='user_id',
              direction='backward', tolerance=pd.Timedelta('1h')).head()` },
    ],
    tips: `
      - 정렬하지 않으면 \`ValueError: left keys must be sorted\`가 납니다. (\`by\` 그룹 안이 아니라 **전체**가 시간순이어야 함)
      - \`by\` 컬럼의 dtype이 양쪽에서 같아야 합니다.`,
  },
  {
    id: 'expanding', tier: 'appendix', group: '시계열 심화',
    title: 'expanding: 처음부터 지금까지 누적 창',
    summary: '시작부터 현재 행까지 늘어나는 창으로 평균·최댓값 등을 계산합니다.',
    body: `
      \`rolling\`이 고정 크기 창이라면 \`expanding\`은 **처음부터 현재까지** 계속 커지는 창입니다. \`cumsum\`/\`cummax\`가 없는 집계(평균, 중앙값, 표준편차)를 누적으로 볼 때 씁니다.`,
    syntax: `s.expanding().mean()
s.expanding(min_periods=7).std()`,
    examples: [
      { title: '일별 매출의 누적 평균과 최고 기록', code: `done = orders[orders['status'] == 'completed']
daily = done.groupby(done['order_ts'].dt.normalize())['total_amount'].sum().to_frame('revenue')
daily['running_avg'] = daily['revenue'].expanding().mean()
daily['best_so_far'] = daily['revenue'].expanding().max()   # = cummax()
daily.head()` },
    ],
    tips: `
      - 합계·최댓값은 \`cumsum()\`·\`cummax()\`가 더 빠르고 같은 결과입니다.
      - 누적 평균은 \`cumsum() / 누적 개수\`로도 구할 수 있습니다.`,
  },
  {
    id: 'ewm', tier: 'appendix', group: '시계열 심화',
    title: 'ewm: 지수 가중 이동 평균',
    summary: '최근 값에 더 큰 가중치를 주는 이동 평균입니다.',
    body: `
      \`s.ewm(span=7).mean()\`은 최근 값일수록 가중치를 크게 주는 평균입니다. 단순 이동평균보다 변화에 빨리 반응하고 창 경계에서 값이 튀지 않습니다.
      - \`span\` 또는 \`alpha\`로 가중치 감소 속도 지정 (\`alpha = 2 / (span + 1)\`)
      - \`adjust=False\`: 재귀식 \`y_t = (1-α)·y_{t-1} + α·x_t\``,
    syntax: `s.ewm(span=7, adjust=False).mean()
s.ewm(alpha=0.3).mean()`,
    examples: [
      { title: '일별 매출: 7일 단순 이동평균 vs EWM', code: `done = orders[orders['status'] == 'completed']
daily = done.groupby(done['order_ts'].dt.normalize())['total_amount'].sum().to_frame('revenue')
daily['ma7'] = daily['revenue'].rolling(7, min_periods=1).mean()
daily['ewm7'] = daily['revenue'].ewm(span=7, adjust=False).mean()
daily.round(0).head(8)` },
    ],
    tips: `
      - 행 기준 가중치이므로 빠진 날짜가 있으면 먼저 \`resample('D')\`로 채우세요.
      - 대시보드의 추세선, 이상 탐지의 기준선으로 자주 씁니다.`,
  },
  {
    id: 'groupby-rolling', tier: 'appendix', group: '시계열 심화',
    title: '그룹별 rolling: 유저·상품별 이동 집계',
    summary: '그룹 경계를 넘지 않는 이동 평균·이동 합을 구합니다.',
    body: `
      그룹별 이동 창은 두 가지 방법이 있습니다.
      - \`groupby('key')['v'].transform(lambda s: s.rolling(3).mean())\`: 원래 행 순서·길이 유지 → 바로 새 컬럼으로
      - \`groupby('key')[['ts', 'v']].rolling('30D', on='ts').sum()\`: 날짜 기준 창. 결과 인덱스가 (key, 원래 인덱스) MultiIndex라 첫 레벨을 떼면 원본에 붙일 수 있습니다
      어느 쪽이든 그룹 안에서 시간순으로 **정렬**되어 있어야 합니다.`,
    syntax: `df['ma3'] = df.groupby('key')['v'].transform(lambda s: s.rolling(3, min_periods=1).mean())
r = df.groupby('key')[['ts', 'v']].rolling('30D', on='ts').sum()
df['v_30d'] = r['v'].reset_index(level=0, drop=True)`,
    examples: [
      { title: '유저별 최근 3건 주문 평균 금액', code: `o = orders.sort_values(['user_id', 'order_ts']).copy()
o['avg_last3'] = o.groupby('user_id')['total_amount'].transform(lambda s: s.rolling(3, min_periods=1).mean())
o[['user_id', 'order_ts', 'total_amount', 'avg_last3']].head(6)` },
      { title: '유저별 최근 30일 결제액 (날짜 기준 창)', code: `o = orders.sort_values(['user_id', 'order_ts']).copy()
r = o.groupby('user_id')[['order_ts', 'total_amount']].rolling('30D', on='order_ts').sum()
o['spend_30d'] = r['total_amount'].reset_index(level=0, drop=True)
o[['user_id', 'order_ts', 'total_amount', 'spend_30d']].head(6)` },
    ],
    tips: `
      - \`groupby().rolling()\` 결과는 (그룹 키, 원래 인덱스) 순서라 원본과 행 순서가 다를 수 있습니다. \`reset_index(level=0, drop=True)\`로 첫 레벨을 떼면 인덱스 기준으로 정확히 맞춰 들어갑니다.
      - \`rolling(..., on='ts')\` 뒤에 컬럼을 \`['v']\`로 고르면 인덱스가 (키, 날짜)가 되어 원본에 바로 붙일 수 없습니다. 위 예제처럼 \`[['ts', 'v']]\`를 먼저 고르세요.
      - 그룹 없이 \`df['v'].rolling(3)\`을 쓰면 앞 유저의 값이 섞입니다.`,
    dbx: `SQL: \`AVG(v) OVER (PARTITION BY key ORDER BY ts ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)\``,
  },

  // ───────────────────────── appendix: 체이닝·출력·성능 ─────────────────────────
  {
    id: 'pipe', tier: 'appendix', group: '체이닝·출력·성능',
    title: 'pipe와 메서드 체이닝',
    summary: '중간 변수 없이 변환 단계를 위에서 아래로 이어 씁니다.',
    body: `
      괄호로 감싸 줄바꿈하면 여러 메서드를 한 흐름으로 쓸 수 있습니다. 직접 만든 함수는 \`.pipe(func, 인자)\`로 체인 중간에 끼웁니다.
      - 체인 안에서 방금 만든 컬럼을 참조할 땐 \`assign(x=lambda d: ...)\`, \`loc[lambda d: 조건]\`
      - 단계별로 이름이 붙어 읽기 쉽고, 중간 DataFrame 수정(체인 할당) 문제가 없습니다.`,
    syntax: `(df
 .query("...")
 .assign(new=lambda d: d['a'] * 2)
 .pipe(my_func, arg=1)
 .groupby('k').agg(...)
 .reset_index())`,
    examples: [
      { title: '함수를 체인에 끼우기 (pipe)', code: `def completed(df):
    return df[df['status'] == 'completed']

def by_month(df, col='order_ts'):
    return df.groupby(df[col].dt.to_period('M'))['total_amount'].sum()

orders.pipe(completed).pipe(by_month).head()` },
      { title: '중간 변수 없는 채널별 리포트', code: `(orders
 .loc[lambda d: d['status'] == 'completed']
 .merge(users[['user_id', 'channel']], on='user_id', how='left', validate='many_to_one')
 .groupby('channel', as_index=False)
 .agg(buyers=('user_id', 'nunique'), revenue=('total_amount', 'sum'))
 .assign(arppu=lambda d: d['revenue'] / d['buyers'])
 .sort_values('revenue', ascending=False))` },
    ],
    tips: `
      - 체인이 너무 길면 디버깅이 어렵습니다. 의미 단위(정제 → 결합 → 집계)로 끊어 변수에 담는 것도 좋습니다.
      - 중간 결과를 보고 싶으면 체인 중간에 \`.pipe(lambda d: (print(d.shape), d)[1])\`를 넣을 수 있습니다.`,
    dbx: `PySpark: \`df.transform(my_func)\`로 같은 패턴을 씁니다.`,
  },
  {
    id: 'formatting', tier: 'appendix', group: '체이닝·출력·성능',
    title: '숫자·날짜 표시 형식',
    summary: '리포트용으로 반올림, 천 단위 쉼표, 퍼센트, 날짜 형식을 적용합니다.',
    body: `
      - \`round(n)\`: 소수 n자리 (숫자 타입 유지)
      - \`s.map('{:,.0f}'.format)\`: 천 단위 쉼표, \`'{:.1%}'.format\`: 퍼센트 — 결과는 **문자열**
      - 날짜: \`s.dt.strftime('%Y-%m-%d')\`
      문자열로 바꾸면 정렬·계산이 안 되므로 **마지막 출력 단계에서만** 적용합니다.`,
    syntax: `df.round(2)
s.map('{:,.0f}'.format)
s.map('{:.1%}'.format)
s.dt.strftime('%Y-%m')`,
    examples: [
      { title: '결제수단 요약을 보기 좋게', code: `t = orders.groupby('payment_method').agg(
    revenue=('total_amount', 'sum'),
    coupon_rate=('coupon_code', lambda s: s.notna().mean()),
)
t.assign(revenue=t['revenue'].map('{:,}원'.format), coupon_rate=t['coupon_rate'].map('{:.1%}'.format))` },
      { title: '반올림과 날짜 문자열', code: `done = orders[orders['status'] == 'completed']
m = done.groupby(done['order_ts'].dt.to_period('M').dt.to_timestamp())['total_amount'].mean().round(-2)
m.index = m.index.strftime('%Y년 %m월')
m.head(3)` },
    ],
    tips: `
      - 포맷한 컬럼으로 정렬하면 사전순이 됩니다 (\`'9,000' > '10,000'\`). 정렬은 포맷 전에 하세요.
      - 전역 표시만 바꾸려면 \`pd.set_option('display.float_format', '{:,.2f}'.format)\` (값은 그대로).`,
  },
  {
    id: 'memory', tier: 'appendix', group: '체이닝·출력·성능',
    title: 'memory_usage와 메모리 최적화',
    summary: '큰 데이터를 다룰 때 메모리 사용량을 확인하고 dtype으로 줄입니다.',
    body: `
      \`df.memory_usage(deep=True)\`로 컬럼별 바이트를 봅니다. 문자열(\`object\`) 컬럼이 대부분을 차지하는 경우가 많습니다.
      - 고유값이 적은 문자열 → \`category\`
      - 큰 정수/실수 → \`pd.to_numeric(s, downcast='integer' | 'float')\`
      - 읽을 때부터 \`usecols\`, \`dtype\`을 지정하면 가장 효과적입니다.`,
    syntax: `df.memory_usage(deep=True)
df.astype({'col': 'category'})
pd.to_numeric(s, downcast='integer')`,
    examples: [
      { title: '문자열 컬럼을 category로 바꾸기 전후', code: `cats = ['country', 'device', 'channel', 'age_group']
before = users.memory_usage(deep=True).sum()
after = users.astype({c: 'category' for c in cats}).memory_usage(deep=True).sum()
pd.Series({'before_KB': before / 1024, 'after_KB': after / 1024}).round(1)` },
      { title: '정수 다운캐스트', code: `q = order_items['quantity']
q.dtype, pd.to_numeric(q, downcast='integer').dtype` },
    ],
    tips: `
      - \`deep=True\`를 빼면 문자열 컬럼은 포인터 크기만 계산되어 실제보다 훨씬 작게 나옵니다.
      - 고유값이 행 수와 비슷한 컬럼(ID, 자유 텍스트)은 category로 바꿔도 이득이 없습니다.
      - 다운캐스트한 정수는 범위를 넘으면 오버플로가 나니 합계는 원래 타입으로 계산하세요.`,
  },
];
