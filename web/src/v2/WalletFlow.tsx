import {usePreferences} from "./preferences";
import {translate} from "./translations";
import {readPreviewBookings, previewSubscriberRows, previewSecurityTransactions} from "./previewBookingStore";
import { publicScreen } from "./screenMap";
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

const kinds: Record<string, string> = {
  provider_credit: "شحن الرصيد",
  reserve: "تخصيص تأمين جدية الحجز",
  release: "إتاحة التأمين",
  withdrawal: "سحب الرصيد",
};
const states: Record<string, string> = {
  reserved: "تأمين جدية الحجز محجوز",
  released: "التأمين متاح",
  confirmed: "مؤكد",
  completed: "منتهي",
  cancelled: "ملغي",
  disputed: "قيد المراجعة",
};
const samples = [
  {
    id: "demo-previous-reserve",
    kind: "reserve",
    available_delta: -100,
    reserved_delta: 100,
    created_at: "2026-11-09T10:00:00Z",
  },
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
  const {language}=usePreferences();
  const tr=(text:string)=>translate(text,language);
  const money = (n:number) => language==="en" ? `EGP ${n.toLocaleString("en-GB")}` : `${n.toLocaleString("en-US")} ج.م`;
  const demo = new URLSearchParams(location.search).get("preview") === "phase4";
  const [filter, setFilter] = useState("all"),
    [amount, setAmount] = useState("100"),
    [scenario, setScenario] = useState("pending"),
    [empty, setEmpty] = useState(false),
    [detail, setDetail] = useState<string | null>(null);
  const ledger = demo ? readPreviewBookings() : null;
  const shared = ledger && ledger.bookings.length > 0 ? ledger : null;
  const balance = demo ? shared || {available:50,reserved:100} : p.balance;
  const transactions = demo ? (empty ? [] : shared ? previewSecurityTransactions(shared) : samples) : p.transactions;
  const bookings = demo ? (empty ? [] : shared ? previewSubscriberRows(shared) : subscriptions) : p.bookings;
  const shown = [...transactions]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .filter((t) => filter === "all" || t.kind === filter);
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
    new Date(v).toLocaleDateString(language==="en"?"en-GB":"ar-EG-u-nu-latn", {
      timeZone: "Africa/Cairo",
    });
  return (
    <div
      className={`phase-one-stage discovery-stage booking-stage wallet-stage ${p.theme}`}
    >
      <nav className="phase-review-bar" aria-label={tr("معاينة المرحلة الرابعة")}>
        <div className="review-screen-nav">
          <button
            aria-label={tr("الشاشة السابقة")}
            disabled={p.screen === 24}
            onClick={() => nav(p.screen - 1)}
          >
            ‹
          </button>
          <select
            aria-label={tr("شاشة المرحلة الرابعة")}
            value={p.screen}
            onChange={(e) => nav(+e.target.value)}
          >
            {walletScreens.map((id, i) => (
              <option key={id} value={id}>
                {publicScreen(id)} · {tr(titles[i])}
              </option>
            ))}
          </select>
          <button
            aria-label={tr("الشاشة التالية")}
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
              {t === "dark" ? tr("دارك") : tr("لايت")}
            </button>
          ))}
        </div>
      </nav>
      <p className="w-preview">
        {demo
          ? tr("معاينة المرحلة الرابعة · بيانات توضيحية فقط")
          : tr("المحفظة والاشتراكات")}
      </p>
      {demo && (
        <div className="w-scenarios">
          <label>
            <input
              type="checkbox"
              checked={empty}
              onChange={(e) => setEmpty(e.target.checked)}
            />{" "}
            {tr("معاينة السجل الفارغ")}</label>
          {p.screen === 26 && (
            <select
              aria-label={tr("حالة الشحن التجريبية")}
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
            >
              <option value="pending">{tr("قيد التحقق")}</option>
              <option value="failed">{tr("لم يكتمل")}</option>
              <option value="success">{tr("نجاح توضيحي")}</option>
            </select>
          )}
        </div>
      )}
      <main className="phase-canvas d-canvas b-canvas w-canvas">
        <header className="d-header">
          <button
            className="phase-back"
            aria-label={tr("رجوع")}
            onClick={() => nav(p.screen === 24 ? 19 : 24)}
          >
            <DiscoveryIcon name="back" />
          </button>
          <Wordmark />
        </header>
        <div className="b-stage-label">
          <span>{tr("المحفظة والاشتراكات")}</span>
          <span dir="ltr">{p.screen - 23} / 7</span>
        </div>
        <h1 className="b-title">{tr(titles[p.screen - 24])}</h1>
        {p.error && (
          <Box>
            <p role="alert">{p.error}</p>
          </Box>
        )}
        {!(demo || p.signedIn) ? (
          <Box>
            <p>{tr("سجّل برقم موبايلك عشان نكمل.")}</p>
            {button(tr("تسجيل الدخول"), 4)}
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
                  <p className="w-center">{tr("رصيدك المتاح")}</p>
                  <strong className="w-balance">
                    {money(balance.available)}
                  </strong>
                  <div className="b-row">
                    <span>{tr("تأمين جدية الحجز")}</span>
                    <strong>{money(balance.reserved)}</strong>
                  </div>
                  <p>
                    {tr("التأمين المحجوز بيتاح بعد تأكيد الدفع والاستلام من الطرفين، لو مفيش نزاع.")}</p>
                </Box>
                <div className="w-actions">
                  {button(tr("شحن الرصيد"), 25)}
                  {button(tr("سحب الرصيد"), 27)}
                </div>
                <Box>
                  <h2>{tr("تأمينك محفوظ")}</h2>
                  <p>
                    {tr("الـ100 جنيه لتأمين جدية الحجز، ومبلغ مسترد. قيمة الاشتراك بتدفعها كاملة للكابتن أول يوم، والتأمين مش بيتخصم منها.")}</p>
                </Box>
                {button(tr("سجل المعاملات"), 28)}
                {button(tr("اشتراكاتي"), 29)}
              </>
            )}
            {p.screen === 25 && (
              <>
                <Box>
                  <h2>{tr("تحب تشحن بكام؟")}</h2>
                  <p>{tr("الحد الأدنى للشحن 100 جنيه.")}</p>
                  <p>{tr("المتاح حاليًا:")}{money(balance.available)}</p>
                  <label className="w-field">
                    {tr("مبلغ الشحن بالجنيه")}<input
                      inputMode="decimal"
                      type="number"
                      min="100"
                      step="1"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </label>
                  <div className="w-presets">
                    {[100, 200, 300].map((n) => (
                      <button
                        key={n}
                        aria-pressed={amount === String(n)}
                        onClick={() => setAmount(String(n))}
                      >
                        {money(n)}
                      </button>
                    ))}
                  </div>
                  {(!Number.isInteger(+amount) || +amount < 100) && (
                    <p role="alert">
                      {tr("أقل مبلغ شحن 100 جنيه. اكتب المبلغ بالجنيه من غير كسور.")}</p>
                  )}
                </Box>
                <Box>
                  <h2>{tr("الشحن لسه مش متاح")}</h2>
                  <p>
                    {tr("هنفعّل الشحن بعد اعتماد وسيلة الدفع. مفيش مبلغ هيتخصم منك دلوقتي.")}</p>
                </Box>
                <button className="d-primary b-primary" disabled>
                  {tr("متابعة للدفع — غير مفعّل")}</button>
                {demo && (
                  <button
                    className="d-primary b-primary"
                    disabled={!Number.isInteger(+amount) || +amount < 100}
                    onClick={() => nav(26)}
                  >
                    {tr("معاينة حالات الشحن")}</button>
                )}
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
                      ? tr("مفيش عملية شحن مؤكدة")
                      : scenario === "success"
                        ? tr("نموذج شحن ناجح")
                        : scenario === "failed"
                          ? tr("الشحن ما اكتملش")
                          : tr("مستنيين نتيجة الشحن")}
                  </h2>
                  <p>
                    {demo
                      ? tr("دي معاينة للحالة فقط. مفيش دفع تم، ورصيد المحفظة ما اتغيرش.")
                      : tr("أي رصيد جديد لازم يتأكد من مزوّد الدفع ويتسجل مرة واحدة في سجل المعاملات.")}
                  </p>
                  {demo && (
                    <div className="b-row">
                      <span>{tr("مبلغ المثال")}</span>
                      <strong>
                        {money(
                          Number.isInteger(+amount) && +amount >= 100
                            ? +amount
                            : 100,
                        )}
                      </strong>
                    </div>
                  )}
                </Box>
                {button(tr("الرجوع للمحفظة"), 24)}
                {demo &&
                  scenario === "failed" &&
                  button(tr("مراجعة مبلغ الشحن"), 25)}
              </>
            )}
            {p.screen === 27 && (
              <>
                <Box>
                  <h2>{tr("الرصيد المتاح للسحب")}</h2>
                  <strong className="w-balance">
                    {money(balance.available)}
                  </strong>
                  <div className="b-row">
                    <span>{tr("محجوز — غير متاح للسحب")}</span>
                    <strong>{money(balance.reserved)}</strong>
                  </div>
                </Box>
                <Box>
                  <h2>{tr("السحب لسه مش مفعّل")}</h2>
                  <p>
                    {tr("طريقة السحب ومدته وأي رسوم محتاجين اعتماد قبل تفعيل الطلبات. رصيدك هيفضل زي ما هو.")}</p>
                  <p>{tr("مش هنطلب منك بيانات حساب أو محفظة قبل تفعيل الخدمة.")}</p>
                </Box>
                <button className="d-primary b-primary" disabled>
                  {tr("طلب سحب — غير مفعّل")}</button>
                {button(tr("سجل المعاملات"), 28)}
              </>
            )}
            {p.screen === 28 && (
              <>
                <Box>
                  <label className="w-field">
                    {tr("نوع العملية")}<select
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option value="all">{tr("كل المعاملات")}</option>
                      {Object.entries(kinds).map(([k, v]) => (
                        <option key={k} value={k}>
                          {tr(v)}
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
                          <strong>{tr(kinds[String(t.kind)] || "معاملة")}</strong>
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
                            <dt>{tr("المرجع")}</dt>
                            <dd>{String(t.id)}</dd>
                          </div>
                          <div>
                            <dt>{tr("تغير الرصيد المحجوز")}</dt>
                            <dd dir="ltr">{money(Number(t.reserved_delta))}</dd>
                          </div>
                          <div>
                            <dt>{tr("تغير الرصيد المتاح")}</dt>
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
                    <h2>{tr("لسه مفيش معاملات هنا.")}</h2>
                    <p>{tr("أي تغيير في الرصيد هيظهر في السجل.")}</p>
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
                    {tr("الحالية")}</button>
                  <button
                    aria-pressed={p.screen === 30}
                    onClick={() => nav(30)}
                  >
                    {tr("السابقة")}</button>
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
                          {tr(states[b.status] || "حالة الاشتراك قيد التحديث")}
                        </p>
                        <div className="b-row">
                          <span>{tr("قيمة الاشتراك")}</span>
                          <strong>{money(b.price)}</strong>
                        </div>
                        <div className="b-row">
                          <span>{tr("البداية")}</span>
                          <strong>{date(b.starts_on)}</strong>
                        </div>
                        <div className="b-row">
                          <span>{tr("نهاية الدورة — غير شاملة")}</span>
                          <strong>{date(b.ends_before)}</strong>
                        </div>
                        {demo ? (
                          <button
                            className="w-link"
                            onClick={() =>
                              setDetail(detail === b.id ? null : b.id)
                            }
                          >
                            {tr("عرض حالة الدفع")}</button>
                        ) : (
                          <button
                            className="w-link"
                            onClick={() => p.go(19, undefined, b.id)}
                          >
                            {tr("تفاصيل الاشتراك")}</button>
                        )}
                        {detail === b.id && (
                          <p role="status">
                            {b.rider_paid_at && b.captain_received_at
                              ? tr("الطرفين أكدوا الدفع والاستلام — مثال توضيحي.")
                              : tr("لسه مستنيين تأكيد الدفع والاستلام — مثال توضيحي.")}
                          </p>
                        )}
                      </Box>
                    ))
                  ) : (
                    <Box>
                      <h2>
                        {p.screen === 29
                          ? tr("لسه مفيش اشتراك حالي.")
                          : tr("لسه مفيش اشتراكات سابقة.")}
                      </h2>
                      {button(tr("دوّر على خط"), 8)}
                    </Box>
                  );
                })()}
              </>
            )}
          </>
        )}
        <p className="w-footnote">{tr("معاك في السِكّة")}</p>
      </main>
    </div>
  );
}
