import {readPreviewBookings, reservePreviewBooking, confirmPreviewBooking} from "./previewBookingStore";
import { publicScreen } from "./screenMap";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Wordmark } from "./Onboarding";
import type { Appearance } from "./Onboarding";
import { DiscoveryIcon, examples, favoriteExamples } from "./Discovery";
import type { Line } from "./Discovery";
import type { Booking, Quote, Route } from "./api";
import {
  quote as calculateQuote,
  addDays,
} from "../../../packages/domain/subscriptions";
import type { Period } from "../../../packages/domain/subscriptions";
import { copy, errorCopy } from "./copy";
import "./booking.css";

export const bookingScreens = [16, 17, 18, 19, 20, 21, 22];
export const bookingTitles = [
  "ملخص الحجز والتكلفة النهائية",
  "تأمين الحجز",
  "تم تأكيد الحجز",
  "تفاصيل اشتراكي",
  "تأكيد الدفع",
  "متابعة تأكيد الاستلام",
  "إدارة الاشتراك",
];
const periodText = (v: string) => (v === "weekly" ? "أسبوعي" : "شهري");
const directionText = (v: string) =>
  v === "outbound" ? "ذهاب فقط" : v === "return" ? "عودة فقط" : "ذهاب وعودة";
const egp = (v: number) => `${v.toLocaleString("en-US")} ج.م`;
const dateText = (v: string) =>
  new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${v}T12:00:00Z`));
const timeText = (v: string) => {
  if (!v) return "—";
  const [h, m] = v.split(":");
  return `${String(+h % 12 || 12).padStart(2, "0")}:${m} ${+h < 12 ? "ص" : "م"}`;
};
// A deterministic illustration calendar, NEVER used to approve a live quote.
// No official-holiday coverage is claimed by this UI fixture.
function readSelectedPreview(id: string | null): Line | null {
  try { const offer = JSON.parse(sessionStorage.getItem("sekka.preview.selectedOffer") || "null") as Line | null; return offer?.id === id ? offer : null; } catch {return null;}
}
function sampleQuote(offer: Line): Quote {
  return calculateQuote({
    anchor: "2026-11-01",
    period: offer.period as Period,
    fullPrice: offer.amount || 2800,
    now: new Date("2026-11-12T10:00:00Z"),
    calendar: {
      coveredFrom: "2026-11-01",
      coveredThrough: "2026-12-31",
      excluded: [],
    },
  });
}
function Box({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`d-box b-box ${className}`}>{children}</section>;
}
function Primary({
  children,
  onClick,
  disabled = false,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      className="d-primary b-primary"
      type={type}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
      <DiscoveryIcon name="arrow" />
    </button>
  );
}
function Row({
  label,
  children,
  emphasis = false,
}: {
  label: string;
  children: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className={`b-row ${emphasis ? "b-emphasis" : ""}`}>
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}
function Illustration({
  kind,
}: {
  kind: "wallet" | "success" | "payment" | "waiting";
}) {
  return (
    <div className={`b-illustration b-illustration-${kind}`} aria-hidden="true">
      <svg viewBox="0 0 240 128" fill="none">
        <path
          d="M14 112c19-35 49-18 64-32 23-22 42-48 79-37 23 7 32 36 66 69"
          fill="currentColor"
          opacity=".07"
        />
        <path
          d="M25 117c50-36 91 21 185-13"
          stroke="currentColor"
          strokeWidth="13"
          opacity=".1"
        />
        <path
          d="M25 117c50-36 91 21 185-13"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="13 10"
          opacity=".3"
        />
        {kind === "wallet" ? (
          <>
            <rect
              x="64"
              y="28"
              width="111"
              height="70"
              rx="15"
              fill="#ffc400"
            />
            <path d="M65 41h111" stroke="#0b0b0d" strokeWidth="3" />
            <rect x="143" y="52" width="43" height="29" rx="9" fill="#15191f" />
            <circle cx="156" cy="66" r="4" fill="#ffc400" />
            <path
              d="m79 31 3-18 69 9-1 9"
              stroke="currentColor"
              strokeWidth="3"
            />
          </>
        ) : (
          <>
            <rect
              x="86"
              y="9"
              width="72"
              height="101"
              rx="13"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              d="M109 19h26"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle
              cx="122"
              cy="63"
              r="25"
              fill={kind === "success" ? "#1fad64" : "#ffc400"}
            />
            {kind === "success" ? (
              <path
                d="m109 63 9 9 18-20"
                stroke="white"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : kind === "waiting" ? (
              <>
                <circle
                  cx="122"
                  cy="63"
                  r="15"
                  stroke="#0b0b0d"
                  strokeWidth="3"
                />
                <path
                  d="M122 52v12l8 5"
                  stroke="#0b0b0d"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </>
            ) : (
              <>
                <path
                  d="M110 57h25m-25 7h25m-25 7h12"
                  stroke="#0b0b0d"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </>
            )}
          </>
        )}
        <path
          d="m178 17 8-12m0 27 15-6m-24 18 16 1"
          stroke="#ffc400"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
function Offer({ offer }: { offer: Line }) {
  return (
    <Box className="b-offer">
      <div className="b-route">
        <span>
          <DiscoveryIcon name="pin" />
          {offer.origin}
        </span>
        <DiscoveryIcon name="swap" />
        <span>
          <DiscoveryIcon name="pin" />
          {offer.destination}
        </span>
      </div>
      {offer.selectedStops && <div className="b-stops"><p>الركوب: {offer.selectedStops.pickup.name}</p><p>النزول: {offer.selectedStops.dropoff.name}</p>{offer.selectedStops.returnPickup && <p>العودة تلقائيًا: {offer.selectedStops.returnPickup.name} ← {offer.selectedStops.returnDropoff?.name}</p>}</div>}
      <div className="b-offer-tags">
        <span>{offer.category}</span>
        <span>{periodText(offer.period)}</span>
        <span>{directionText(offer.direction)}</span>
      </div>
      <div className="b-offer-times">
        <span>
          <DiscoveryIcon name="sun" />
          الذهاب <b dir="auto">{timeText(offer.outbound)}</b>
        </span>
        <span>
          <DiscoveryIcon name="moon" />
          العودة <b dir="auto">{timeText(offer.returnTime)}</b>
        </span>
      </div>
    </Box>
  );
}
export type BookingFlowProps = {
  screen: number;
  theme: Appearance;
  onTheme: (value: Appearance) => void;
  go: (id: number) => void;
  offer: Line | null;
  route: Route | null;
  period: string;
  direction: string;
  quote: Quote | null;
  booking: Booking | null;
  balance: { available: number; reserved: number };
  signedIn: boolean;
  busy: boolean;
  error: string;
  onQuote: () => Promise<Quote>;
  onPaid: () => Promise<Booking>;
  onRefresh: () => Promise<Booking | null>;
  onDispute: (reason: string) => Promise<void>;
};
export default function BookingFlow(p: BookingFlowProps) {
  const { screen, theme, onTheme, go } = p;
  const params = new URLSearchParams(location.search);
  const demo = params.get("preview") === "phase3";
  const offerId = params.get("offer");
  const [previewLedger,setPreviewLedger] = useState(readPreviewBookings);
  const previewBooking = previewLedger.bookings.find(b => b.offerId === offerId);
  const interactivePreview = demo && Boolean(readSelectedPreview(offerId));
  const currentOffer =
    p.offer || readSelectedPreview(offerId) ||
    [...examples, ...favoriteExamples].find((o) => o.id === offerId) ||
    examples[0];
  const demoOffer = screen >= 18 && previewBooking ? previewBooking.offer : currentOffer;
  const config = p.route?.prices.find(
    (v) => v.period === p.period && v.direction === p.direction,
  );
  const liveOffer =
    p.offer ||
    (p.route && config
      ? {
          id: p.route.id,
          routeId: p.route.id,
          origin: p.route.origin,
          destination: p.route.destination,
          category: p.route.category,
          available: p.route.seats,
          outbound: config.direction === "return" ? "" : p.route.outbound,
          returnTime:
            config.direction === "outbound" ? "" : p.route.return_time || "",
          period: config.period,
          direction: config.direction,
          amount: config.amount,
        }
      : null);
  const offer = demo ? demoOffer : liveOffer;
  const [localQuote, setLocalQuote] = useState<Quote | null>(null),
    [working, setWorking] = useState(false),
    [notice, setNotice] = useState(""),
    [paidChecked, setPaidChecked] = useState(false),
    [reason, setReason] = useState("");
  const [balanceMode, setBalanceMode] = useState("enough"),
    [receipt, setReceipt] = useState("waiting");
  const [demoPayment, setDemoPayment] = useState(false);
  const [modal, setModal] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (modal) {
      lastFocus.current = document.activeElement as HTMLElement;
      dialog.current?.showModal();
    } else {
      dialog.current?.close();
      lastFocus.current?.focus();
    }
  }, [modal]);
  const q = demo ? (screen >= 18 && previewBooking ? previewBooking.quote : sampleQuote(demoOffer)) : localQuote || p.quote;
  const b = p.booking;
  const hasSnapshot =
    (demo && (!interactivePreview || Boolean(previewBooking))) ||
    Boolean(
      b &&
      ["reserved", "confirmed", "disputed", "completed"].includes(b.status),
    );
  const snapshotPrice = demo ? q!.price : b?.price;
  const snapshotStart = demo ? q!.start : b?.starts_on;
  const snapshotEnd = demo ? q!.endExclusive : b?.ends_before;
  const disputed = demo ? receipt === "disputed" : b?.status === "disputed";
  const riderReported = demo
    ? interactivePreview ? Boolean(previewBooking?.riderPaid) : demoPayment || screen === 21 || receipt === "received"
    : Boolean(b?.rider_paid_at);
  const captainReported = demo
    ? interactivePreview ? Boolean(previewBooking?.captainReceived) : receipt === "received"
    : Boolean(b?.captain_received_at);
  const released = hasSnapshot && riderReported && captainReported && !disputed;
  const available = demo
    ? balanceMode === "enough"
      ? interactivePreview ? previewLedger.available : 150
      : 40
    : p.balance.available;
  const sufficient = available >= 100;
  const heading =
    screen === 18 && !hasSnapshot ? "تأكيد الحجز" : bookingTitles[screen - 16];
  function nav(id: number) {
    setNotice("");
    go(id);
  }
  async function getQuote() {
    setWorking(true);
    setNotice("");
    try {
      setLocalQuote(await p.onQuote());
    } catch (e) {
      setNotice(errorCopy(e));
    } finally {
      setWorking(false);
    }
  }
  async function paid() {
    if (!paidChecked) return;
    if (demo) {
      if (interactivePreview && previewBooking) setPreviewLedger(confirmPreviewBooking(previewBooking.id,"rider"));
      setDemoPayment(true);
      nav(21);
      return;
    }
    setWorking(true);
    try {
      await p.onPaid();
      nav(21);
    } catch (e) {
      setNotice(errorCopy(e));
    } finally {
      setWorking(false);
    }
  }
  async function refresh() {
    if (demo) {
      setNotice("دي حالة توضيحية. تقدر تختار حالة الاستلام من شريط المعاينة.");
      return;
    }
    setWorking(true);
    try {
      await p.onRefresh();
      setNotice("تم تحديث حالة الاشتراك من الخدمة.");
    } catch (e) {
      setNotice(errorCopy(e));
    } finally {
      setWorking(false);
    }
  }
  async function support() {
    if (reason.trim().length < 5) return;
    if (demo) {
      setNotice("دي معاينة للمراجعة فقط. لم يتم إرسال طلب دعم فعلي.");
      return;
    }
    setWorking(true);
    try {
      await p.onDispute(reason.trim());
      setNotice("المراجعة اتسجلت. الدعم هيتابع معاك.");
      setReason("");
    } catch (e) {
      setNotice(errorCopy(e));
    } finally {
      setWorking(false);
    }
  }
  const empty = (
    <Box className="b-empty">
      <DiscoveryIcon name="info" />
      <p>
        {!p.signedIn
          ? "سجّل الدخول الأول عشان تشوف اشتراكك."
          : "اختار حجزك من اشتراكاتي عشان نكمل."}
      </p>
      <Primary onClick={() => nav(!p.signedIn ? 4 : 29)}>
        {!p.signedIn ? "تسجيل الدخول" : "اشتراكاتي"}
      </Primary>
    </Box>
  );
  const securityNote = (
    <div className="b-callout">
      <DiscoveryIcon name="info" />
      <p>
        تأمينك 100 جنيه قابل للاسترداد، منفصل عن الاشتراك. مش رسوم خدمة، ومش خصم
        من المبلغ اللي هتدفعه للكابتن.
      </p>
    </div>
  );
  return (
    <div className={`phase-one-stage discovery-stage booking-stage ${theme}`}>
      <nav
        className="phase-review-bar b-review"
        aria-label="معاينة المرحلة الثالثة"
      >
        <div className="review-screen-nav">
          <button
            aria-label="الشاشة السابقة"
            disabled={screen === 16}
            onClick={() => nav(screen - 1)}
          >
            ‹
          </button>
          <select
            aria-label="شاشة المرحلة الثالثة"
            value={screen}
            onChange={(e) => nav(+e.target.value)}
          >
            {bookingScreens.map((id, i) => (
              <option key={id} value={id}>
                {publicScreen(id)} · {bookingTitles[i]}
              </option>
            ))}
          </select>
          <button
            aria-label="الشاشة التالية"
            disabled={screen === 22}
            onClick={() => nav(screen + 1)}
          >
            ›
          </button>
        </div>
        <div className="review-themes">
          <button
            aria-pressed={theme === "dark"}
            onClick={() => onTheme("dark")}
          >
            دارك
          </button>
          <button
            aria-pressed={theme === "light"}
            onClick={() => onTheme("light")}
          >
            لايت
          </button>
        </div>
      </nav>
      <p className="phase-preview-note">
        {demo
          ? "معاينة المرحلة الثالثة · البيانات والأحداث توضيحية. لا حجز ولا دفع ولا تغيير رصيد فعلي."
          : "سِكّة · حجزك واشتراكك"}
      </p>
      {demo && !interactivePreview && [17, 21].includes(screen) && (
        <aside className="b-scenario" aria-label="حالات المعاينة">
          {screen === 17 ? (
            <>
              <span>رصيد تجريبي:</span>
              <button
                aria-pressed={balanceMode === "enough"}
                onClick={() => setBalanceMode("enough")}
              >
                كافي
              </button>
              <button
                aria-pressed={balanceMode === "short"}
                onClick={() => setBalanceMode("short")}
              >
                غير كافي
              </button>
            </>
          ) : (
            <>
              <span>حالة توضيحية:</span>
              {[
                { id: "waiting", text: "في الانتظار" },
                { id: "received", text: "تأكيد الطرفين" },
                { id: "disputed", text: "قيد المراجعة" },
              ].map((v) => (
                <button
                  key={v.id}
                  aria-pressed={receipt === v.id}
                  onClick={() => setReceipt(v.id)}
                >
                  {v.text}
                </button>
              ))}
            </>
          )}
        </aside>
      )}
      <main className={`phase-canvas d-canvas b-canvas b-screen-${screen}`}>
        <header className="d-header">
          <button
            className="phase-back"
            aria-label="رجوع"
            onClick={() =>
              nav(screen === 16 ? 12 : screen === 19 ? 29 : screen - 1)
            }
          >
            <DiscoveryIcon name="back" />
          </button>
          <Wordmark />
        </header>
        <div className="b-stage-label">
          <span>الحجز والاشتراكات</span>
          <span dir="ltr">{screen - 15} / 7</span>
        </div>
        <h1 className="b-title">
          <DiscoveryIcon
            name={
              screen === 17
                ? "seat"
                : screen === 18
                  ? "check"
                  : screen === 22
                    ? "settings"
                    : "calendar"
            }
          />
          {heading}
        </h1>
        {(notice || (p.error && !demo)) && (
          <p className="d-feedback" role="status">
            {notice || "الخدمة مش متاحة دلوقتي. جرّب تاني بعد شوية."}
          </p>
        )}
        {(p.busy || working) && (
          <p className="b-loading" role="status">
            بنراجع بيانات اشتراكك…
          </p>
        )}
        {screen === 16 &&
          (offer ? (
            <>
              <p className="b-subtitle">
                راجع عرض الكابتن وتكلفة اشتراكك قبل ما تكمل.
              </p>
              <Offer offer={offer} />
              <Box className="b-calendar">
                <h2>
                  <DiscoveryIcon name="calendar" />
                  مواعيد اشتراكك
                </h2>
                <Row label="تاريخ البداية التلقائي">
                  {q ? dateText(q.start) : "مستنيين حساب الخدمة"}
                </Row>
                <Row label="آخر يوم في الدورة">
                  {q
                    ? dateText(addDays(q.endExclusive, -1))
                    : "مستنيين حساب الخدمة"}
                </Row>
                <Row label="أيام التشغيل المستحقة">
                  {q ? `${q.remainingDays} من ${q.totalDays} يوم تشغيل` : "—"}
                </Row>
                <p className="b-hint">
                  البداية بتتحسب بتوقيت مصر. من الأحد للخميس، مع استبعاد
                  الإجازات الرسمية المعتمدة.
                </p>
                {demo && (
                  <p className="b-fixture-note">
                    الحساب المعروض مثال بتقويم تجريبي من غير إجازات؛ مش تسعيرًا
                    معتمدًا لحجز فعلي.
                  </p>
                )}
              </Box>
              <Box className="b-price-summary">
                <Row label="سعر دورة العرض الكاملة">
                  {egp(offer.amount || 0)}
                </Row>
                <Row label="اشتراكك للأيام المستحقة" emphasis>
                  {q ? egp(q.price) : "لم يُحسب بعد"}
                </Row>
                <Row label="تأمين مسترد من المحفظة">100 ج.م</Row>
                <div className="b-price-breakdown">
                  <span>تدفع للكابتن أول يوم</span>
                  <strong>{q ? egp(q.price) : "—"}</strong>
                </div>
                {q && (
                  <p className="b-formula">
                    {egp(q.fullPrice)} × {q.remainingDays} ÷ {q.totalDays} ={" "}
                    {egp(q.price)}
                  </p>
                )}
              </Box>
              {securityNote}
              {!demo && !q && (
                <Primary
                  disabled={working || !p.signedIn}
                  onClick={() => void getQuote()}
                >
                  احسب التكلفة من الخدمة
                </Primary>
              )}
              {!demo && !p.signedIn && (
                <p className="b-hint">سجّل الدخول عشان نراجع السعر والتواريخ.</p>
              )}
              <Primary disabled={!q} onClick={() => nav(17)}>
                متابعة لتأمين الحجز
              </Primary>
            </>
          ) : (
            <Box className="b-empty">
              <p>
                اختار عرض الكابتن الأول. المدة والاتجاه والسعر محددين في العرض.
              </p>
              <Primary onClick={() => nav(11)}>شوف العروض</Primary>
            </Box>
          ))}
        {screen === 17 &&
          (demo || p.signedIn ? (
            <>
              <Illustration kind="wallet" />
              <p className="b-subtitle">
                تأمين بسيط لحجز مكانك. بيتاح بعد تأكيد الدفع والاستلام من
                الطرفين.
              </p>
              <Box className="b-wallet">
                <div className="b-wallet-label">
                  <DiscoveryIcon name="seat" />
                  رصيد المحفظة المتاح
                </div>
                <strong className="b-balance">{egp(available)}</strong>
                <div
                  className={`b-balance-state ${sufficient ? "positive" : "warning"}`}
                >
                  <DiscoveryIcon name={sufficient ? "check" : "info"} />
                  {sufficient
                    ? "رصيدك كافي للتأمين"
                    : `محتاج تضيف ${egp(100 - available)} للتأمين`}
                </div>
              </Box>
              <Box>
                <Row label="التأمين المطلوب">100 ج.م</Row>
                <Row label="الحجز من الرصيد" emphasis>
                  {sufficient ? "متاح بعد تأكيد الحجز" : "الرصيد مش كافي"}
                </Row>
                <Row label="المتبقي بعد الحجز">
                  {sufficient ? egp(available - 100) : "—"}
                </Row>
              </Box>
              {securityNote}
              {!sufficient && (
                <Primary
                  onClick={() =>
                    setModal(
                      "شحن المحفظة لسه مش مفعّل. محتاجين ربط شريك الدفع واعتماد سياسة الرصيد والاسترداد. لم يتم شحن أي مبلغ.",
                    )
                  }
                >
                  شحن الرصيد
                </Primary>
              )}
              <Primary
                disabled={!sufficient || !q || !demo}
                onClick={() => {
                  try {
                    if(interactivePreview && offer && q) setPreviewLedger(reservePreviewBooking(offer,q));
                    nav(18);
                  } catch(error){setNotice(errorCopy(error));}
                }}
              >
                {demo ? interactivePreview ? "تأكيد الحجز التجريبي وحجز 100 جنيه افتراضية" : "معاينة تأكيد الحجز" : "تأكيد حجز المقعد"}
              </Primary>
              <p className="b-hint">
                {demo
                  ? interactivePreview ? "محاكاة محلية فقط: يتم تثبيت الشروط وتحديث الرصيد التجريبي، من غير حجز حقيقي أو حركة أموال." : "الزر بيفتح نموذج التأكيد للمراجعة؛ مش بيحجز مقعد ولا بيخصم رصيد."
                  : copy.moneyDisabled}
              </p>
            </>
          ) : (
            empty
          ))}
        {screen === 18 &&
          (hasSnapshot ? (
            <>
              <Illustration kind="success" />
              <div className="b-success-tag">
                <DiscoveryIcon name="check" />
                {demo ? "نموذج حجز مؤكد — معاينة" : "حجزك اتسجل."}
              </div>
              <p className="b-subtitle">
                مكانك في السِكّة جاهز. راجع موعد البداية وتعليمات الدفع.
              </p>
              <Box className="b-start">
                <span>اشتراكك يبدأ</span>
                <strong>{snapshotStart ? dateText(snapshotStart) : "—"}</strong>
              </Box>
              {offer && <Offer offer={offer} />}
              <Box className="b-payment-instruction">
                <h2>
                  <DiscoveryIcon name="phone" />
                  ادفع للكابتن أول يوم.
                </h2>
                <p>
                  ادفع قيمة اشتراكك كاملة:{" "}
                  <strong>{egp(snapshotPrice || 0)}</strong>، وبعدها أكد الدفع
                  من التطبيق.
                </p>
                <p>الـ100 جنيه تأمين منفصل، مش خصم من الاشتراك.</p>
              </Box>
              <Primary onClick={() => nav(19)}>شوف تفاصيل اشتراكي</Primary>
              <Box>
                <h2>بيانات الكابتن والعربية</h2>
                {demo ? <><p>كابتن أحمد — بيانات توضيحية بعد الحجز</p><p>تويوتا كورولا · أبيض · لوحة توضيحية 7284</p><p>التواصل غير مفعّل في المعاينة.</p></> : <p>ستظهر البيانات المصرح بها هنا بعد ربط خدمة الحجز المؤكد.</p>}
              </Box>
            </>
          ) : (
            empty
          ))}
        {screen === 19 &&
          (hasSnapshot ? (
            <>
              <div
                className={`b-status-tag ${disputed ? "warning" : "positive"}`}
              >
                <DiscoveryIcon name={disputed ? "info" : "check"} />
                {disputed
                  ? "الحجز قيد المراجعة"
                  : demo
                    ? "اشتراك تجريبي مؤكد"
                    : "تفاصيل حجزك"}
              </div>
              {offer ? (
                <Offer offer={offer} />
              ) : (
                <Box>
                  <h2>
                    {b?.origin} ← {b?.destination}
                  </h2>
                </Box>
              )}
              <Box>
                <Row label="بداية الخدمة">
                  {snapshotStart ? dateText(snapshotStart) : "—"}
                </Row>
                <Row label="نهاية الاشتراك">
                  {snapshotEnd ? dateText(addDays(snapshotEnd, -1)) : "—"}
                </Row>
                <Row label="قيمة الاشتراك">{egp(snapshotPrice || 0)}</Row>
              </Box>
              <Box className="b-status-card">
                <h2>
                  <DiscoveryIcon name="clipboard" />
                  حالة الدفع
                </h2>
                <p>
                  {released
                    ? "الكابتن أكد الاستلام."
                    : riderReported
                      ? "مستنيين تأكيد الكابتن."
                      : "ادفع للكابتن أول يوم، وبعدها أكد الدفع."}
                </p>
                <span className="b-security-pill">
                  {released
                    ? "تأمينك متاح دلوقتي."
                    : "تأمين الحجز: 100 ج.م محجوزة"}
                </span>
              </Box>
              <Primary onClick={() => nav(riderReported ? 21 : 20)}>
                {riderReported ? "متابعة تأكيد الاستلام" : "تأكيد الدفع"}
              </Primary>
              <Box>
                <h2>بيانات الكابتن والعربية</h2>
                {demo ? <><p>كابتن أحمد — بيانات توضيحية بعد الحجز</p><p>تويوتا كورولا · أبيض · لوحة توضيحية 7284</p><p>التواصل غير مفعّل في المعاينة.</p></> : <p>ستظهر البيانات المصرح بها هنا بعد ربط خدمة الحجز المؤكد.</p>}
              </Box>
              <button className="b-secondary" onClick={() => nav(22)}>
                <DiscoveryIcon name="settings" />
                إدارة الاشتراك
              </button>
            </>
          ) : (
            empty
          ))}
        {screen === 20 &&
          (hasSnapshot ? (
            <>
              <Illustration kind="payment" />
              <p className="b-subtitle">دفعت؟ أكد الدفع.</p>
              <Box className="b-amount-card">
                <span>قيمة الاشتراك للكابتن</span>
                <strong>{egp(snapshotPrice || 0)}</strong>
                <small>تدفعها مباشرة للكابتن أول يوم خدمة.</small>
              </Box>
              <Box>
                <div className="b-callout">
                  <DiscoveryIcon name="info" />
                  <p>
                    الخطوة دي بتسجّل تأكيدك بس. مش بتسحب فلوس من محفظتك، ومش بديل
                    عن تأكيد الكابتن.
                  </p>
                </div>
                <label className="b-check-label">
                  <input
                    type="checkbox"
                    checked={paidChecked || riderReported}
                    onChange={(e) => setPaidChecked(e.target.checked)}
                    disabled={riderReported || disputed}
                  />
                  <span>دفعت للكابتن قيمة الاشتراك كاملة.</span>
                </label>
              </Box>
              <Primary
                disabled={
                  !paidChecked ||
                  working ||
                  riderReported ||
                  disputed ||
                  (!demo && !p.signedIn)
                }
                onClick={() => void paid()}
              >
                {demo ? "معاينة متابعة الاستلام" : "تم الدفع"}
              </Primary>
              {riderReported && (
                <button className="b-secondary" onClick={() => nav(21)}>
                  شوف حالة التأكيد
                </button>
              )}
              <p className="b-hint">
                ما تأكدش الدفع إلا بعد ما تدفع فعلًا. التأمين بيتاح بعد تأكيد
                الطرفين.
              </p>
            </>
          ) : (
            empty
          ))}
        {screen === 21 &&
          (hasSnapshot ? (
            <>
              <Illustration kind={released ? "success" : "waiting"} />
              <div
                className={`b-status-tag ${released ? "positive" : disputed ? "warning" : "pending"}`}
              >
                {disputed
                  ? "الحالة قيد المراجعة"
                  : released
                    ? "الكابتن أكد الاستلام."
                    : "مستنيين تأكيد الكابتن."}
              </div>
              <Box className="b-timeline">
                <div className={riderReported ? "done" : ""}>
                  <span className="b-timeline-dot">
                    <DiscoveryIcon name="check" />
                  </span>
                  <div>
                    <strong>تأكيد الراكب</strong>
                    <p>
                      {riderReported
                        ? "تأكيد الدفع اتسجل."
                        : "مستنيين تأكيدك بعد الدفع."}
                    </p>
                  </div>
                </div>
                <div className={captainReported ? "done" : ""}>
                  <span className="b-timeline-dot">
                    <DiscoveryIcon name={captainReported ? "check" : "user"} />
                  </span>
                  <div>
                    <strong>تأكيد الكابتن</strong>
                    <p>
                      {captainReported
                        ? "الكابتن أكد استلام قيمة الاشتراك."
                        : "الكابتن هيراجع ويأكد الاستلام."}
                    </p>
                  </div>
                </div>
                <div className={released ? "done" : ""}>
                  <span className="b-timeline-dot">
                    <DiscoveryIcon name="seat" />
                  </span>
                  <div>
                    <strong>إتاحة تأمين الحجز</strong>
                    <p>
                      {released
                        ? "تأمينك متاح دلوقتي. 100 ج.م رجعت للرصيد المتاح."
                        : "100 ج.م بتفضل محجوزة لحد تأكيد الطرفين."}
                    </p>
                  </div>
                </div>
              </Box>
              {disputed && (
                <div className="b-callout">
                  <DiscoveryIcon name="info" />
                  <p>
                    الدعم بيراجع الحالة. مفيش مصادرة تلقائية للتأمين بسبب غياب
                    أو تأخير التأكيد.
                  </p>
                </div>
              )}
              {interactivePreview && previewBooking && !captainReported && <button className="b-secondary" onClick={() => setPreviewLedger(confirmPreviewBooking(previewBooking.id,"captain"))}>محاكاة تأكيد الكابتن — لا دفع حقيقي</button>}
              <Primary disabled={working} onClick={() => void refresh()}>
                تحديث الحالة
              </Primary>
              <Box>
                <h2>بيانات الكابتن والعربية</h2>
                {demo ? <><p>كابتن أحمد — بيانات توضيحية بعد الحجز</p><p>تويوتا كورولا · أبيض · لوحة توضيحية 7284</p><p>التواصل غير مفعّل في المعاينة.</p></> : <p>ستظهر البيانات المصرح بها هنا بعد ربط خدمة الحجز المؤكد.</p>}
              </Box>
              <button className="b-secondary" onClick={() => nav(22)}>
                محتاج مساعدة في الاشتراك؟
              </button>
            </>
          ) : (
            empty
          ))}
        {screen === 22 &&
          (hasSnapshot ? (
            <>
              {offer && <Offer offer={offer} />}
              <Box>
                <Row label="موعد البداية">
                  {snapshotStart ? dateText(snapshotStart) : "—"}
                </Row>
                <Row label="قيمة الاشتراك">{egp(snapshotPrice || 0)}</Row>
                <Row label="حالة التأمين">
                  {released ? "متاح" : "محجوز لحد اكتمال التأكيد"}
                </Row>
              </Box>
              <div className="b-manage-actions">
                <button onClick={() => nav(19)}>
                  <DiscoveryIcon name="clipboard" />
                  <span>راجع تفاصيل اشتراكك</span>
                  <DiscoveryIcon name="back" />
                </button>
                <button
                  onClick={() =>
                    setModal(
                      "التجديد هيتاح بعد اعتماد قواعد أولوية التجديد. لم يتم إنشاء تجديد أو حجز جديد.",
                    )
                  }
                >
                  <DiscoveryIcon name="calendar" />
                  <span>تجديد الاشتراك</span>
                  <small>قريبًا</small>
                </button>
                <button
                  onClick={() =>
                    setModal(
                      "إلغاء الاشتراك متوقف لحد اعتماد سياسة الإلغاء والاسترداد. مفيش مقعد أو رصيد اتغيّر. تقدر تطلب مراجعة من الدعم.",
                    )
                  }
                >
                  <DiscoveryIcon name="info" />
                  <span>طلب إلغاء الاشتراك</span>
                  <small>محتاج مراجعة</small>
                </button>
              </div>
              <Box className="b-support">
                <h2>
                  <DiscoveryIcon name="chat" />
                  فيه مشكلة؟ احكي لنا.
                </h2>
                <label>
                  <span className="sr-only">سبب مراجعة الاشتراك</span>
                  <textarea
                    aria-label="سبب مراجعة الاشتراك"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    minLength={5}
                    maxLength={1000}
                    placeholder="اكتب المشكلة عشان نعرف نساعدك…"
                  />
                </label>
                <Primary
                  disabled={
                    reason.trim().length < 5 ||
                    working ||
                    (!demo && !p.signedIn)
                  }
                  onClick={() => void support()}
                >
                  {demo ? "معاينة طلب المراجعة" : "إرسال طلب مراجعة"}
                </Primary>
                <p className="b-hint">
                  التأمين مش بيتصادر تلقائيًا بسبب غياب أو تأخير التأكيد.
                </p>
              </Box>
            </>
          ) : (
            empty
          ))}
      </main>
      <dialog
        ref={dialog}
        className="b-dialog"
        onCancel={() => setModal("")}
        aria-labelledby="b-dialog-title"
      >
        <h2 id="b-dialog-title">خلّيك على علم</h2>
        <p>{modal}</p>
        <button className="d-primary" onClick={() => setModal("")}>
          تمام
        </button>
      </dialog>
    </div>
  );
}
