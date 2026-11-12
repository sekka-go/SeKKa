import { useState, type ReactNode } from "react";
import { Wordmark, type Appearance } from "./Onboarding";
import { DiscoveryIcon } from "./Discovery";
import type { Booking } from "./api";
import "./booking.css";
import "./wallet.css";
export const walletScreens = [24, 25, 26, 27, 28, 29, 30];
const titles = [
  "محفظتي",
  "شحن الرصيد",
  "حالة الشحن",
  "سحب الرصيد",
  "سجل المعاملات",
  "اشتراكاتي",
  "سجل الاشتراكات",
];
const money = (n: number) => `${n.toLocaleString("en-US")} ج.م`;
const kinds: Record<string, string> = {
  provider_credit: "شحن الرصيد",
  reserve: "حجز تأمين",
  release: "إتاحة التأمين",
  withdrawal: "سحب الرصيد",
};
const states: Record<string, string> = {
  reserved: "التأمين محجوز",
  released: "التأمين متاح",
  confirmed: "مؤكد",
  completed: "منتهي",
  cancelled: "ملغي",
  disputed: "قيد المراجعة",
};
const samples = [
  {
    id: "demo-3",
    kind: "reserve",
    available_delta: -100,
    reserved_delta: 100,
    created_at: "2026-11-12T08:00:00Z",
  },
  {
    id: "demo-2",
    kind: "release",
    available_delta: 100,
    reserved_delta: -100,
    created_at: "2026-11-10T08:00:00Z",
  },
  {
    id: "demo-1",
    kind: "provider_credit",
    available_delta: 150,
    reserved_delta: 0,
    created_at: "2026-11-09T08:00:00Z",
  },
];
const subscriptions: Booking[] = [
  {
    id: "demo-active",
    origin: "المعادي",
    destination: "التجمع",
    price: 1527,
    starts_on: "2026-11-15",
    ends_before: "2026-12-01",
    status: "reserved",
    rider_paid_at: null,
    captain_received_at: null,
  },
  {
    id: "demo-history",
    origin: "الزمالك",
    destination: "الشيخ زايد",
    price: 850,
    starts_on: "2026-11-01",
    ends_before: "2026-11-08",
    status: "completed",
    rider_paid_at: "2026-11-01",
    captain_received_at: "2026-11-01",
  },
];
function Box({ children }: { children: ReactNode }) {
  return <section className="d-box b-box">{children}</section>;
}
export default function WalletFlow(p: {
  screen: number;
  theme: Appearance;
  onTheme: (t: Appearance) => void;
  go: (n: number, r?: string, b?: string) => void;
  signedIn: boolean;
  balance: { available: number; reserved: number };
  transactions: Record<string, unknown>[];
  bookings: Booking[];
  error: string;
}) {
  const demo = new URLSearchParams(location.search).get("preview") === "phase4";
  const [filter, setFilter] = useState("all"),
    [amount, setAmount] = useState("100"),
    [scenario, setScenario] = useState("pending"),
    [empty, setEmpty] = useState(false),
    [detail, setDetail] = useState<string | null>(null);
  const balance = demo ? { available: 50, reserved: 100 } : p.balance;
  const transactions = demo ? (empty ? [] : samples) : p.transactions;
  const bookings = demo ? (empty ? [] : subscriptions) : p.bookings;
  const shown = transactions.filter(
    (t) => filter === "all" || t.kind === filter,
  );
  const nav = (n: number) => {
    setDetail(null);
    p.go(n);
  };
  const button = (text: string, n: number) => (
    <button className="d-primary b-primary" onClick={() => nav(n)}>
      {text}
      <DiscoveryIcon name="arrow" />
    </button>
  );
  const date = (v: string) =>
    new Date(v).toLocaleDateString("ar-EG-u-nu-latn", {
      timeZone: "Africa/Cairo",
    });
  return (
    <div
      className={`phase-one-stage discovery-stage booking-stage wallet-stage ${p.theme}`}
    >
      <nav className="phase-review-bar" aria-label="معاينة المرحلة الرابعة">
        <div className="review-screen-nav">
          <button
            aria-label="الشاشة السابقة"
            disabled={p.screen === 24}
            onClick={() => nav(p.screen - 1)}
          >
            ‹
          </button>
          <select
            aria-label="شاشة المرحلة الرابعة"
            value={p.screen}
            onChange={(e) => nav(+e.target.value)}
          >
            {walletScreens.map((id, i) => (
              <option key={id} value={id}>
                {id} · {titles[i]}
              </option>
            ))}
          </select>
          <button
            aria-label="الشاشة التالية"
            disabled={p.screen === 30}
            onClick={() => nav(p.screen + 1)}
          >
            ›
          </button>
        </div>
        <div className="review-themes">
          {(["dark", "light"] as const).map((t) => (
            <button
              key={t}
              aria-pressed={p.theme === t}
              onClick={() => p.onTheme(t)}
            >
              {t === "dark" ? "دارك" : "لايت"}
            </button>
          ))}
        </div>
      </nav>
      <p className="w-preview">
        {demo
          ? "معاينة المرحلة الرابعة · بيانات توضيحية فقط"
          : "المحفظة والاشتراكات"}
      </p>
      {demo && (
        <div className="w-scenarios">
          <label>
            <input
              type="checkbox"
              checked={empty}
              onChange={(e) => setEmpty(e.target.checked)}
            />{" "}
            معاينة السجل الفارغ
          </label>
          {p.screen === 26 && (
            <select
              aria-label="حالة الشحن التجريبية"
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
            >
              <option value="pending">قيد التحقق</option>
              <option value="failed">لم يكتمل</option>
              <option value="success">نجاح توضيحي</option>
            </select>
          )}
        </div>
      )}
      <main className="phase-canvas d-canvas b-canvas w-canvas">
        <header className="d-header">
          <button
            className="phase-back"
            aria-label="رجوع"
            onClick={() => nav(p.screen === 24 ? 19 : 24)}
          >
            <DiscoveryIcon name="back" />
          </button>
          <Wordmark />
        </header>
        <div className="b-stage-label">
          <span>المحفظة والاشتراكات</span>
          <span dir="ltr">{p.screen - 23} / 7</span>
        </div>
        <h1 className="b-title">{titles[p.screen - 24]}</h1>
        {p.error && (
          <Box>
            <p role="alert">{p.error}</p>
          </Box>
        )}
        {!(demo || p.signedIn) ? (
          <Box>
            <p>سجّل برقم موبايلك عشان نكمل.</p>
            {button("تسجيل الدخول", 4)}
          </Box>
        ) : (
          <>
            {p.screen === 24 && (
              <>
                <Box>
                  <div className="w-wallet-art" aria-hidden="true">
                    <svg viewBox="0 0 120 90">
                      <rect x="12" y="20" width="96" height="62" rx="16" />
                      <path d="M20 20V12h72v8M80 43h30v22H80z" />
                      <circle cx="90" cy="54" r="3" />
                    </svg>
                  </div>
                  <p className="w-center">رصيدك المتاح</p>
                  <strong className="w-balance">
                    {money(balance.available)}
                  </strong>
                  <div className="b-row">
                    <span>تأمين محجوز</span>
                    <strong>{money(balance.reserved)}</strong>
                  </div>
                  <p>
                    التأمين المحجوز بيتاح بعد تأكيد الدفع والاستلام من الطرفين،
                    لو مفيش نزاع.
                  </p>
                </Box>
                <div className="w-actions">
                  {button("شحن الرصيد", 25)}
                  {button("سحب الرصيد", 27)}
                </div>
                <Box>
                  <h2>تأمينك محفوظ</h2>
                  <p>
                    الـ100 جنيه تأمين مسترد. قيمة الاشتراك بتدفعها كاملة للكابتن
                    أول يوم، والتأمين مش بيتخصم منها.
                  </p>
                </Box>
                {button("سجل المعاملات", 28)}
                {button("اشتراكاتي", 29)}
              </>
            )}
            {p.screen === 25 && (
              <>
                <Box>
                  <h2>تحب تشحن بكام؟</h2>
                  <p>المتاح حاليًا: {money(balance.available)}</p>
                  <label className="w-field">
                    مبلغ الشحن بالجنيه
                    <input
                      inputMode="decimal"
                      type="number"
                      min="1"
                      step="1"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </label>
                  <div className="w-presets">
                    {[50, 100, 200].map((n) => (
                      <button
                        key={n}
                        aria-pressed={amount === String(n)}
                        onClick={() => setAmount(String(n))}
                      >
                        {money(n)}
                      </button>
                    ))}
                  </div>
                  {(!Number.isFinite(+amount) || +amount <= 0) && (
                    <p role="alert">اكتب مبلغ أكبر من صفر.</p>
                  )}
                </Box>
                <Box>
                  <h2>الشحن لسه مش متاح</h2>
                  <p>
                    هنفعّل الشحن بعد اعتماد وسيلة الدفع. مفيش مبلغ هيتخصم منك
                    دلوقتي.
                  </p>
                </Box>
                <button className="d-primary b-primary" disabled>
                  متابعة للدفع — غير مفعّل
                </button>
                {demo && button("معاينة حالات الشحن", 26)}
              </>
            )}
            {p.screen === 26 && (
              <>
                <Box>
                  <div
                    className={`w-result ${demo && scenario === "success" ? "positive" : ""}`}
                    aria-hidden="true"
                  >
                    {demo && scenario === "success"
                      ? "✓"
                      : demo && scenario === "failed"
                        ? "!"
                        : "…"}
                  </div>
                  <h2 className="w-center">
                    {!demo
                      ? "مفيش عملية شحن مؤكدة"
                      : scenario === "success"
                        ? "نموذج شحن ناجح"
                        : scenario === "failed"
                          ? "الشحن ما اكتملش"
                          : "مستنيين نتيجة الشحن"}
                  </h2>
                  <p>
                    {demo
                      ? "دي معاينة للحالة فقط. مفيش دفع تم، ورصيد المحفظة ما اتغيرش."
                      : "أي رصيد جديد لازم يتأكد من مزوّد الدفع ويتسجل مرة واحدة في سجل المعاملات."}
                  </p>
                  {demo && (
                    <div className="b-row">
                      <span>مبلغ المثال</span>
                      <strong>{money(+amount > 0 ? +amount : 100)}</strong>
                    </div>
                  )}
                </Box>
                {button("الرجوع للمحفظة", 24)}
                {demo &&
                  scenario === "failed" &&
                  button("مراجعة مبلغ الشحن", 25)}
              </>
            )}
            {p.screen === 27 && (
              <>
                <Box>
                  <h2>الرصيد المتاح للسحب</h2>
                  <strong className="w-balance">
                    {money(balance.available)}
                  </strong>
                  <div className="b-row">
                    <span>محجوز — غير متاح للسحب</span>
                    <strong>{money(balance.reserved)}</strong>
                  </div>
                </Box>
                <Box>
                  <h2>السحب لسه مش مفعّل</h2>
                  <p>
                    طريقة السحب ومدته وأي رسوم محتاجين اعتماد قبل تفعيل الطلبات.
                    رصيدك هيفضل زي ما هو.
                  </p>
                  <p>مش هنطلب منك بيانات حساب أو محفظة قبل تفعيل الخدمة.</p>
                </Box>
                <button className="d-primary b-primary" disabled>
                  طلب سحب — غير مفعّل
                </button>
                {button("سجل المعاملات", 28)}
              </>
            )}
            {p.screen === 28 && (
              <>
                <Box>
                  <label className="w-field">
                    نوع العملية
                    <select
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option value="all">كل المعاملات</option>
                      {Object.entries(kinds).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                </Box>
                {shown.length ? (
                  shown.map((t) => (
                    <Box key={String(t.id)}>
                      <button
                        className="w-transaction"
                        aria-expanded={detail === t.id}
                        onClick={() =>
                          setDetail(detail === t.id ? null : String(t.id))
                        }
                      >
                        <span>
                          <strong>{kinds[String(t.kind)] || "معاملة"}</strong>
                          <small>{date(String(t.created_at))}</small>
                        </span>
                        <strong dir="ltr">
                          {Number(t.available_delta) > 0 ? "+" : ""}
                          {money(Number(t.available_delta))}
                        </strong>
                      </button>
                      {detail === t.id && (
                        <dl className="w-details">
                          <div>
                            <dt>المرجع</dt>
                            <dd>{String(t.id)}</dd>
                          </div>
                          <div>
                            <dt>تغير الرصيد المحجوز</dt>
                            <dd dir="ltr">{money(Number(t.reserved_delta))}</dd>
                          </div>
                          <div>
                            <dt>تغير الرصيد المتاح</dt>
                            <dd dir="ltr">
                              {money(Number(t.available_delta))}
                            </dd>
                          </div>
                        </dl>
                      )}
                    </Box>
                  ))
                ) : (
                  <Box>
                    <h2>لسه مفيش معاملات هنا.</h2>
                    <p>أي تغيير في الرصيد هيظهر في السجل.</p>
                  </Box>
                )}
              </>
            )}
            {[29, 30].includes(p.screen) && (
              <>
                <div className="w-tabs">
                  <button
                    aria-pressed={p.screen === 29}
                    onClick={() => nav(29)}
                  >
                    الحالية
                  </button>
                  <button
                    aria-pressed={p.screen === 30}
                    onClick={() => nav(30)}
                  >
                    السابقة
                  </button>
                </div>
                {(() => {
                  const items = bookings.filter(
                    (b) =>
                      ["completed", "cancelled"].includes(b.status) ===
                      (p.screen === 30),
                  );
                  return items.length ? (
                    items.map((b) => (
                      <Box key={b.id}>
                        <div className="b-row">
                          <strong>{b.origin}</strong>
                          <DiscoveryIcon name="arrow" />
                          <strong>{b.destination}</strong>
                        </div>
                        <p className="w-status">
                          {states[b.status] || "حالة الاشتراك قيد التحديث"}
                        </p>
                        <div className="b-row">
                          <span>قيمة الاشتراك</span>
                          <strong>{money(b.price)}</strong>
                        </div>
                        <div className="b-row">
                          <span>البداية</span>
                          <strong>{date(b.starts_on)}</strong>
                        </div>
                        <div className="b-row">
                          <span>نهاية الدورة — غير شاملة</span>
                          <strong>{date(b.ends_before)}</strong>
                        </div>
                        {demo ? (
                          <button
                            className="w-link"
                            onClick={() =>
                              setDetail(detail === b.id ? null : b.id)
                            }
                          >
                            عرض حالة الدفع
                          </button>
                        ) : (
                          <button
                            className="w-link"
                            onClick={() => p.go(19, undefined, b.id)}
                          >
                            تفاصيل الاشتراك
                          </button>
                        )}
                        {detail === b.id && (
                          <p role="status">
                            {b.rider_paid_at && b.captain_received_at
                              ? "الطرفين أكدوا الدفع والاستلام — مثال توضيحي."
                              : "لسه مستنيين تأكيد الدفع والاستلام — مثال توضيحي."}
                          </p>
                        )}
                      </Box>
                    ))
                  ) : (
                    <Box>
                      <h2>
                        {p.screen === 29
                          ? "لسه مفيش اشتراك حالي."
                          : "لسه مفيش اشتراكات سابقة."}
                      </h2>
                      {button("دوّر على خط", 8)}
                    </Box>
                  );
                })()}
              </>
            )}
          </>
        )}
        <p className="w-footnote">معاك في السِكّة</p>
      </main>
    </div>
  );
}
