"""연습용 이커머스 샘플 데이터 생성기.

웹 플레이그라운드(DuckDB-WASM / Pyodide)와 로컬 Spark 환경이 같은 CSV를 사용합니다.
시드가 고정되어 있어 몇 번을 실행해도 동일한 데이터가 만들어집니다.

    python scripts/generate_sample_data.py            # web/data/ 에 생성
    python scripts/generate_sample_data.py --out DIR  # 다른 위치에 생성

데이터에 의도적으로 심어둔 패턴 (케이스 스터디/면접 연습용):
  * 2025-10-14 ~ 10-24: Android 앱 5.2.0 배포 후 Android 세션 급감 (DAU 하락 케이스)
  * 주말(토/일) 트래픽 증가, 12월 연말 시즌 증가
  * paid_search 유입 유저는 첫 구매가 빠르지만(가입 직후 장바구니 확률↑) 리텐션이 낮음
  * ab_test 'checkout_button_v2': treatment 전환율이 실제로 더 높음
  * ab_test 'free_shipping_banner': 배정 비율 불균형(SRM) 존재
  * employees: 동일 급여(동점) 존재 → RANK / DENSE_RANK 차이 연습
"""

from __future__ import annotations

import argparse
import csv
from datetime import date, datetime, timedelta
from pathlib import Path

import numpy as np

SEED = 42
START = date(2025, 1, 1)
END = date(2025, 12, 31)
N_USERS = 6000

COUNTRIES = (["KR", "JP", "US", "VN", "TW"], [0.68, 0.12, 0.09, 0.06, 0.05])
DEVICES = (["ios", "android", "web"], [0.38, 0.42, 0.20])
CHANNELS = (["organic", "paid_search", "social", "referral", "email"], [0.36, 0.24, 0.20, 0.12, 0.08])
AGE_GROUPS = (["18-24", "25-34", "35-44", "45-54", "55+"], [0.18, 0.36, 0.25, 0.13, 0.08])
PAYMENTS = (["card", "kakaopay", "naverpay", "bank_transfer"], [0.45, 0.28, 0.20, 0.07])

CATEGORY_ITEMS = {
    "electronics": (["Wireless Earbuds", "Smart Watch", "USB-C Hub", "Bluetooth Speaker", "Power Bank",
                     "Mechanical Keyboard", "Webcam", "Tablet Stand"], (25000, 320000)),
    "fashion": (["Denim Jacket", "Linen Shirt", "Sneakers", "Wool Coat", "Cotton Tee", "Chino Pants",
                 "Leather Belt", "Knit Beanie"], (15000, 180000)),
    "beauty": (["Sunscreen", "Lip Tint", "Cleansing Oil", "Sheet Mask Set", "Hair Serum", "Moisturizer",
                "Perfume", "Hand Cream"], (8000, 90000)),
    "grocery": (["Cold Brew Coffee", "Granola", "Olive Oil", "Green Tea", "Protein Bar Box", "Kimchi",
                 "Rice 10kg", "Mixed Nuts"], (4000, 45000)),
    "home": (["Desk Lamp", "Bath Towel Set", "Storage Box", "Scented Candle", "Pillow", "Throw Blanket",
              "Coffee Mug", "Plant Pot"], (7000, 120000)),
    "books": (["SQL Cookbook", "Python for Data Analysis", "Statistics 101", "Storytelling with Data",
               "Lean Analytics", "Trustworthy Online Experiments", "Naked Statistics", "Data Science from Scratch"],
              (15000, 45000)),
}
COUPONS = ["WELCOME10", "SPRING15", "SUMMER20", "FALL10", "XMAS25"]

ANDROID_BUG_START = date(2025, 10, 14)
ANDROID_BUG_END = date(2025, 10, 24)


def choice(rng, spec, size=None):
    values, probs = spec
    return rng.choice(values, size=size, p=probs)


def app_version(platform: str, d: date) -> str:
    if platform == "web":
        return "web"
    if platform == "android" and ANDROID_BUG_START <= d <= ANDROID_BUG_END:
        return "5.2.0"
    if d >= date(2025, 10, 25):
        return "5.2.1"
    if d >= date(2025, 7, 1):
        return "5.1.0"
    if d >= date(2025, 3, 1):
        return "5.0.2"
    return "4.9.8"


def write_csv(path: Path, header: list[str], rows: list[list]) -> None:
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)
    print(f"  {path.name:<20} {len(rows):>7,} rows")


def main(out_dir: Path) -> None:
    rng = np.random.default_rng(SEED)
    out_dir.mkdir(parents=True, exist_ok=True)
    n_days = (END - START).days + 1

    # ---------- products ----------
    products = []
    pid = 1
    for cat, (names, (lo, hi)) in CATEGORY_ITEMS.items():
        for name in names:
            for variant in ("Basic", "Plus", "Pro"):
                mult = {"Basic": 0.8, "Plus": 1.0, "Pro": 1.35}[variant]
                price = int(round(rng.uniform(lo, hi) * mult / 100) * 100)
                products.append([pid, f"{name} {variant}", cat, price])
                pid += 1
    product_ids = np.array([p[0] for p in products])
    product_price = {p[0]: p[3] for p in products}
    product_cat = {p[0]: p[2] for p in products}
    # 인기 상품 편중 (롱테일)
    pop = rng.pareto(1.2, len(products)) + 0.2
    pop = pop / pop.sum()

    # ---------- users ----------
    # 가입일: 연중 완만한 성장 + 12월 시즌
    day_w = np.linspace(0.7, 1.4, n_days)
    day_w[-31:] *= 1.3
    day_w = day_w / day_w.sum()
    signup_offsets = np.sort(rng.choice(n_days, size=N_USERS, p=day_w))
    users = []
    for i in range(N_USERS):
        signup = START + timedelta(days=int(signup_offsets[i]))
        users.append({
            "user_id": 1001 + i,
            "signup_date": signup,
            "country": str(choice(rng, COUNTRIES)),
            "device": str(choice(rng, DEVICES)),
            "channel": str(choice(rng, CHANNELS)),
            "age_group": str(choice(rng, AGE_GROUPS)),
            "marketing_opt_in": bool(rng.random() < 0.55),
        })

    # ---------- events & orders ----------
    events, orders, items = [], [], []
    event_id, session_id, order_id, item_id = 1, 1, 50001, 1
    weekday_boost = {5: 1.25, 6: 1.30}

    for u in users:
        # 채널별 리텐션 차이: paid_search 는 빨리 이탈
        mean_life = {"organic": 75, "paid_search": 22, "social": 40, "referral": 70, "email": 60}[u["channel"]]
        n_sessions = 1 + rng.negative_binomial(2, 2 / (2 + 6.5 * (mean_life / 55)))
        n_sessions = min(n_sessions, 40)
        offsets = np.concatenate([[0], rng.exponential(mean_life, n_sessions - 1)])
        for off in np.sort(offsets):
            d = u["signup_date"] + timedelta(days=int(off))
            if d > END:
                continue
            # 요일/시즌 가중치 → 수락-기각 샘플링
            w = weekday_boost.get(d.weekday(), 1.0) * (1.25 if d.month == 12 else 1.0)
            if rng.random() > w / 1.4:
                continue
            platform = u["device"] if rng.random() < 0.9 else ("web" if u["device"] != "web" else "android")
            # Android 5.2.0 버그: 앱 크래시로 세션 상당수 유실
            if platform == "android" and ANDROID_BUG_START <= d <= ANDROID_BUG_END and rng.random() < 0.45:
                continue
            ver = app_version(platform, d)
            hour = int(np.clip(rng.normal(20, 4), 0, 23))
            ts = datetime(d.year, d.month, d.day, hour, int(rng.integers(0, 60)), int(rng.integers(0, 60)))

            def add(event_type, t, product=None):
                nonlocal event_id
                events.append([event_id, session_id, u["user_id"], t.strftime("%Y-%m-%d %H:%M:%S"),
                               event_type, platform, ver, product if product is not None else ""])
                event_id += 1

            add("visit", ts)
            t = ts
            p_view, p_cart, p_checkout, p_purchase = 0.74, 0.36, 0.62, 0.76
            if u["channel"] == "paid_search" and off < 3:
                p_cart += 0.08
            if platform == "web":
                p_checkout -= 0.08
            if rng.random() < p_view:
                prod = int(rng.choice(product_ids, p=pop))
                t += timedelta(seconds=int(rng.integers(10, 300)))
                add("view_item", t, prod)
                if rng.random() < p_cart:
                    t += timedelta(seconds=int(rng.integers(10, 400)))
                    add("add_to_cart", t, prod)
                    if rng.random() < p_checkout:
                        t += timedelta(seconds=int(rng.integers(20, 600)))
                        add("checkout", t)
                        if rng.random() < p_purchase:
                            t += timedelta(seconds=int(rng.integers(10, 200)))
                            add("purchase", t)
                            # 주문 생성
                            basket = [prod] + [int(x) for x in rng.choice(product_ids, size=rng.poisson(0.7), p=pop)]
                            subtotal = 0
                            for b in dict.fromkeys(basket):
                                qty = int(1 + rng.poisson(0.25))
                                price = product_price[b]
                                if product_cat[b] == "grocery":
                                    qty += int(rng.poisson(0.6))
                                items.append([item_id, order_id, b, qty, price])
                                item_id += 1
                                subtotal += qty * price
                            coupon, discount = "", 0
                            first_order = not any(o[1] == u["user_id"] for o in orders[-50:])
                            if first_order and rng.random() < 0.35:
                                coupon = "WELCOME10"
                            elif rng.random() < 0.18:
                                coupon = COUPONS[1 + min((d.month - 1) // 3, 3)]
                            if coupon:
                                pct = int("".join(ch for ch in coupon if ch.isdigit()))
                                discount = int(round(subtotal * pct / 100 / 100) * 100)
                            r = rng.random()
                            status = "completed" if r < 0.88 else ("cancelled" if r < 0.95 else "refunded")
                            orders.append([order_id, u["user_id"], t.strftime("%Y-%m-%d %H:%M:%S"), status,
                                           str(choice(rng, PAYMENTS)), coupon, discount, subtotal - discount])
                            order_id += 1
            session_id += 1

    events.sort(key=lambda e: e[3])
    for i, e in enumerate(events, start=1):
        e[0] = i

    # ---------- ab_test ----------
    ab = []
    for u in users:
        if u["signup_date"] < date(2025, 7, 1):
            continue
        variant = "treatment" if rng.random() < 0.5 else "control"
        rate = 0.11 if variant == "control" else 0.145
        conv = int(rng.random() < rate)
        rev = int(round(rng.lognormal(10.6, 0.7) / 100) * 100) if conv else 0
        assigned = u["signup_date"] + timedelta(days=int(rng.integers(0, 3)))
        ab.append(["checkout_button_v2", u["user_id"], variant, min(assigned, END).isoformat(), conv, rev])
    for u in users:
        if not (date(2025, 2, 1) <= u["signup_date"] < date(2025, 7, 1)):
            continue
        # SRM: treatment 배정 로직 버그로 일부 유실 → 약 46% 만 treatment
        variant = "treatment" if rng.random() < 0.46 else "control"
        rate = 0.110 if variant == "control" else 0.118
        conv = int(rng.random() < rate)
        rev = int(round(rng.lognormal(10.5, 0.75) / 100) * 100) if conv else 0
        ab.append(["free_shipping_banner", u["user_id"], variant, u["signup_date"].isoformat(), conv, rev])

    # ---------- employees / departments (고전 SQL 면접 문제용) ----------
    departments = [[10, "Data", "Seoul"], [20, "Engineering", "Seoul"], [30, "Marketing", "Busan"],
                   [40, "Sales", "Seoul"], [50, "Finance", "Pangyo"], [60, "HR", "Busan"]]
    first = ["Minjun", "Seoyeon", "Jiho", "Hayoon", "Doyun", "Seoa", "Eunwoo", "Jiwoo", "Siwoo", "Haeun",
             "Junseo", "Yerin", "Hajun", "Sua", "Yejun", "Chaewon", "Juwon", "Jia", "Gunwoo", "Dain",
             "Woojin", "Subin", "Hyunwoo", "Yuna", "Taeyang", "Somin", "Jaewon", "Nari", "Sungmin", "Bora",
             "Kyungho", "Mina", "Donghyun", "Hyejin", "Sangwoo", "Eunji", "Youngjae", "Sora", "Jinho", "Ara"]
    employees = []
    emp_id = 1
    heads = {}
    for dept_id, _, _ in departments:
        heads[dept_id] = emp_id
        employees.append([emp_id, first[emp_id - 1], dept_id, "", 9000 + int(rng.integers(0, 30)) * 100,
                          (date(2018, 1, 1) + timedelta(days=int(rng.integers(0, 900)))).isoformat()])
        emp_id += 1
    salary_pool = [4200, 4800, 5200, 5200, 5600, 6100, 6100, 6400, 7000, 7300, 7300, 7800]
    while emp_id <= 40:
        dept_id = departments[(emp_id * 7) % len(departments)][0]
        sal = int(rng.choice(salary_pool)) + (0 if rng.random() < 0.6 else int(rng.integers(1, 8)) * 100)
        employees.append([emp_id, first[emp_id - 1], dept_id, heads[dept_id], sal,
                          (date(2019, 1, 1) + timedelta(days=int(rng.integers(0, 2300)))).isoformat()])
        emp_id += 1
    # 부서에 소속되지 않은 신규 입사자 (LEFT JOIN / NULL 처리 연습)
    employees.append([41, "Hanbit", "", "", 3900, "2025-11-03"])

    print(f"Writing sample data to {out_dir}/")
    write_csv(out_dir / "users.csv", ["user_id", "signup_date", "country", "device", "channel", "age_group",
                                      "marketing_opt_in"],
              [[u["user_id"], u["signup_date"].isoformat(), u["country"], u["device"], u["channel"],
                u["age_group"], str(u["marketing_opt_in"]).lower()] for u in users])
    write_csv(out_dir / "products.csv", ["product_id", "product_name", "category", "price"], products)
    write_csv(out_dir / "orders.csv", ["order_id", "user_id", "order_ts", "status", "payment_method",
                                       "coupon_code", "discount_amount", "total_amount"], orders)
    write_csv(out_dir / "order_items.csv", ["order_item_id", "order_id", "product_id", "quantity", "unit_price"],
              items)
    write_csv(out_dir / "events.csv", ["event_id", "session_id", "user_id", "event_ts", "event_type", "platform",
                                       "app_version", "product_id"], events)
    write_csv(out_dir / "ab_test.csv", ["experiment", "user_id", "variant", "assigned_date", "converted",
                                        "revenue"], ab)
    write_csv(out_dir / "departments.csv", ["dept_id", "dept_name", "location"], departments)
    write_csv(out_dir / "employees.csv", ["emp_id", "name", "dept_id", "manager_id", "salary", "hire_date"],
              employees)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=Path, default=Path(__file__).resolve().parent.parent / "web" / "data")
    main(parser.parse_args().out)
