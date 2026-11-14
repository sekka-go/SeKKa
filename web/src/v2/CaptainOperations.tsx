import {usePreferences} from "./preferences";
import {translate} from "./translations";
import {readPreviewBookings, previewSubscriberRows, confirmPreviewBooking} from "./previewBookingStore";
import { PreferenceSettings } from "./preferences";
import { useState, type ReactNode } from "react";
import { Wordmark, type Appearance } from "./Onboarding";
import { DiscoveryIcon } from "./Discovery";
import { internalScreen, publicScreen, screenTitle } from "./screenMap";
import { api, type Profile } from "./api";
import "./booking.css";
import "./wallet.css";
import "./account.css";
import "./operations.css";
export const operationsScreens = Array.from({ length: 12 }, (_, i) =>
  internalScreen(i + 50),
);
type Row = Record<string, unknown>;
export type OperationsData = {
  bookings: Row[];
  routes: Row[];
  conversations: Row[];
  notifications: Row[];
  tickets: Row[];
  captain: Row;
  vehicle: Row;
  today: string;
  eligible: boolean | null;
};
const emptyData: OperationsData = {
  bookings: [],
  routes: [],
  conversations: [],
  notifications: [],
  tickets: [],
  captain: {},
  vehicle: {},
  today: "",
  eligible: null,
};
const demoData: OperationsData = {
  today: "2026-11-15",
  eligible: true,
  captain: { status: "approved" },
  vehicle: {
    model: "تويوتا كورولا",
    category: "PRIME",
    plate: "بيانات توضيحية",
    status: "approved",
  },
  routes: [
    {
      id: "route-1",
      origin: "المعادي",
      destination: "التجمع",
      outbound: "07:30",
      return_time: "17:00",
      status: "active",
      category: "PRIME",
    },
    {
      id: "route-2",
      origin: "الزمالك",
      destination: "الشيخ زايد",
      outbound: "08:00",
      return_time: null,
      status: "active",
      category: "SAVER",
    },
  ],
  bookings: [
    {
      id: "demo-1",
      pickup_stop: "ميدان الجزائر", dropoff_stop: "شارع التسعين",
      rider_id: "r1",
      rider_name: "أحمد محمد",
      route_id: "route-1",
      origin: "المعادي",
      destination: "التجمع",
      price: 2800,
      starts_on: "2026-11-15",
      ends_before: "2026-12-01",
      status: "reserved",
      rider_paid_at: "2026-11-15T06:00:00Z",
      captain_received_at: null,
      security_state: "reserved",
      period: "monthly",
      direction: "round_trip",
      created_at: "2026-11-13",
    },
    {
      id: "demo-2",
      pickup_stop: "الزمالك", dropoff_stop: "الشيخ زايد",
      rider_id: "r2",
      rider_name: "مريم علي",
      route_id: "route-2",
      origin: "الزمالك",
      destination: "الشيخ زايد",
      price: 850,
      starts_on: "2026-11-16",
      ends_before: "2026-11-23",
      status: "reserved",
      rider_paid_at: null,
      captain_received_at: null,
      security_state: "reserved",
      period: "weekly",
      direction: "outbound",
      created_at: "2026-11-12",
    },
  ],
  conversations: [
    {
      id: "thread-1",
      rider_name: "أحمد محمد",
      body: "صباح الخير، نتقابل عند نقطة الالتقاء المتفق عليها.",
      created_at: "2026-11-15T05:00:00Z",
    },
  ],
  notifications: [
    {
      id: "n1",
      body: "عندك تأكيد دفع محتاج مراجعتك.",
      created_at: "2026-11-15",
      read_at: null,
    },
    {
      id: "n2",
      body: "تم تثبيت حجز جديد على خطك.",
      created_at: "2026-11-13",
      read_at: null,
    },
  ],
  tickets: [],
};
// Demo conversations are session-local; no real chat messages are sent or stored remotely.
const previewChatHistoryKey = "sekka.preview.captainChatHistory";
const previewChatThreadKey = "sekka.preview.captainChatThread";
function restorePreviewChatHistory(): Record<string, Row[]> {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(previewChatHistoryKey) || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([, messages]) =>
        Array.isArray(messages) &&
        messages.every((message) => message && typeof message === "object" && typeof message.body === "string"),
      ),
    ) as Record<string, Row[]>;
  } catch {
    return {};
  }
}
const restorePreviewChatThread = () => {
  try { return sessionStorage.getItem(previewChatThreadKey) || ""; }
  catch { return ""; }
};
const str = (r: Row, k: string, f = "—") => String(r[k] ?? f);
const state = (v: unknown) =>
  ({
    reserved: "حجز مؤكد · انتظار الدفع",
    confirmed: "الدفع مؤكد",
    disputed: "تحت المراجعة",
    completed: "منتهي",
    cancelled: "ملغي",
    approved: "معتمد",
    pending: "قيد المراجعة",
    active: "نشط",
    paused: "موقوف",
    released: "متاح للراكب",
  })[String(v)] || String(v || "غير متاح");
function Box({ children }: { children: ReactNode }) {
  return <section className="d-box b-box">{children}</section>;
}
export default function CaptainOperations(p: {
  screen: number;
  theme: Appearance;
  onTheme: (v: Appearance) => void;
  go: (n: number) => void;
  profile: Profile | null;
  signedIn: boolean;
  data: OperationsData | null;
  busy: boolean;
  error: string;
  refresh: () => void;
}) {
  const {language}=usePreferences();
  const tr=(text:string)=>translate(text,language);
const money = (v: unknown) =>
  `${Number(v || 0).toLocaleString(language==="en"?"en-GB":"ar-EG-u-nu-latn")} ${language==="en"?"EGP":"ج.م"}`;
  const demo = new URLSearchParams(location.search).get("preview") === "phase7";
  const dateLabel = (value: unknown, withTime = false) => {
    const raw = String(value ?? "");
    if (!raw) return language === "en" ? "Not available" : "غير متاح";
    // Treat a calendar date as local date, not midnight UTC; preserve its day.
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw + "T12:00:00Z" : raw;
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) return raw; // Old time-only preview data.
    return new Intl.DateTimeFormat(language === "en" ? "en-GB" : "ar-EG-u-nu-latn", {
      day: "numeric", month: "short", year: "numeric",
      ...(withTime ? {hour: "2-digit", minute: "2-digit"} : {}),
      timeZone: "Africa/Cairo",
    }).format(parsed);
  };
  const n = publicScreen(p.screen) + 1;
  const [chatHistory,setChatHistory] = useState<Record<string,Row[]>>(() => demo ? restorePreviewChatHistory() : {});
  const [local, setLocal] = useState(demoData),
    [empty, setEmpty] = useState(false),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState(""),
    [selected, setSelected] = useState(""),
    [thread, setThread] = useState(() => demo ? restorePreviewChatThread() : ""),
    [messages, setMessages] = useState<Row[]>(() => {
      if (!demo) return [];
      const threadId = restorePreviewChatThread();
      return restorePreviewChatHistory()[threadId] || [];
    }),
    [draft, setDraft] = useState(""),
    [note, setNote] = useState(""),
    [error, setError] = useState(""),
    [working, setWorking] = useState(false),
    [confirm, setConfirm] = useState(false),
    [unread, setUnread] = useState(false),
    [support, setSupport] = useState(""),
    [topic, setTopic] = useState("الدفع والتأمين");
  const ledger = demo ? readPreviewBookings() : null;
  const shared = ledger && ledger.bookings.length > 0 ? ledger : null;
  const d = demo
    ? empty
      ? { ...emptyData, today: demoData.today, eligible: true }
      : shared ? {...local, bookings: previewSubscriberRows(shared)} : local
    : p.data || emptyData;
  const allowed = demo || (p.signedIn && p.profile?.role === "captain");
  const nav = (v: number) => {
    setNote("");
    setError("");
    setConfirm(false);
    p.go(internalScreen(v - 1));
  };
  const booking = d.bookings.find((b) => b.id === selected);
  const active = d.bookings.filter((b) =>
    ["reserved", "confirmed", "disputed"].includes(str(b, "status")),
  );
  const choose = (b: Row, target = 54) => {
    setSelected(str(b, "id"));
    nav(target);
  };
  const action = (label: string, target: number) => (
    <button className="a-menu" onClick={() => nav(target)}>
      {tr(String(label))}
      <DiscoveryIcon name="back" />
    </button>
  );
  const busy = p.busy || working;
  async function perform(fn: () => Promise<void>) {
    setWorking(true);
    setError("");
    try {
      await fn();
    } catch {
      setError("تعذّر إتمام العملية. جرّب تاني، ولم نؤكد نجاحها.");
    } finally {
      setWorking(false);
    }
  }
  async function openChat(id: string, shouldNavigate = true) {
    await perform(async () => {
      if (demo) {
        setMessages(chatHistory[id] ?? [
          {
            id: "m1",
            body: "أهلًا يا كابتن، هنلتزم بنقطة الالتقاء.",
            sender_id: "rider",
            created_at: "2026-11-15T05:00:00Z",
          },
        ]);
      } else setMessages(await api<Row[]>("messages", { conversationId: id }));
      setThread(id);
      if (demo) {
        try { sessionStorage.setItem(previewChatThreadKey, id); }
        catch { /* Session persistence is optional. */ }
      }
      if (shouldNavigate) nav(58);
    });
  }
  const card = (b: Row) => (
    <Box key={str(b, "id")}>
      <div className="o-card-top">
        <strong>{tr(str(b, "rider_name", "مشترك"))}</strong>
        <span className="o-badge">{tr(state(b.status))}</span>
      </div>
      <h2>
        {tr(str(b, "origin"))} ← {tr(str(b, "destination"))}
      </h2>
      <div className="b-row">
        <span>{language==="en" ? "Start date" : "البداية"}</span>
        <b dir="ltr">{dateLabel(str(b, "starts_on"))}</b>
      </div>
      <div className="b-row">
        <span>{tr("المبلغ المثبت")}</span>
        <b>{money(b.price)}</b>
      </div>
      <button className="d-primary b-primary" onClick={() => choose(b)}>
        {tr("تفاصيل الاشتراك")}</button>
    </Box>
  );
  return (
    <div
      className={`phase-one-stage discovery-stage booking-stage account-stage ${p.theme}`}
    >
      <nav className="phase-review-bar" aria-label={tr("معاينة المرحلة السابعة")}>
        <div className="review-screen-nav">
          <button
            aria-label={tr("الشاشة السابقة")}
            disabled={n === 51}
            onClick={() => nav(n - 1)}
          >
            ‹
          </button>
          <select
            aria-label={tr("شاشة المرحلة السابعة")}
            value={n}
            onChange={(e) => nav(+e.target.value)}
          >
            {operationsScreens.map((s) => (
              <option key={s} value={publicScreen(s) + 1}>
                {publicScreen(s)} · {screenTitle(s,language)}
              </option>
            ))}
          </select>
          <button
            aria-label={tr("الشاشة التالية")}
            disabled={n === 62}
            onClick={() => nav(n + 1)}
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
          ? tr("معاينة المرحلة السابعة · بيانات توضيحية، مفيش عمليات حقيقية")
          : tr("تشغيل الكابتن")}
      </p>
      {demo && (
        <label className="a-preview-empty">
          <input
            type="checkbox"
            checked={empty}
            onChange={(e) => setEmpty(e.target.checked)}
          />
          {tr("معاينة القوائم الفارغة")}</label>
      )}
      <main className="phase-canvas d-canvas b-canvas a-canvas o-canvas">
        <header className="d-header">
          <button
            className="phase-back"
            aria-label={tr("رجوع")}
            onClick={() => nav(n === 58 ? 57 : 51)}
          >
            <DiscoveryIcon name="back" />
          </button>
          <Wordmark />
        </header>
        <div className="b-stage-label">
          <span>{tr("الكابتن · معاك في السِكّة")}</span>
          <span>{n - 50} / 12</span>
        </div>
        <h1 className="b-title">{screenTitle(p.screen,language)}</h1>
        {!allowed ? (
          <Box>
            <p>{tr("سجّل بحساب كابتن عشان تشوف بيانات تشغيلك.")}</p>
            <button className="d-primary b-primary" onClick={() => p.go(4)}>
              {tr("تسجيل الدخول")}</button>
          </Box>
        ) : (
          <>
            {busy && (
              <Box>
                <p role="status">{tr("جاري التحميل…")}</p>
              </Box>
            )}
            {(error || p.error) && (
              <Box>
                <p role="alert">{error || p.error}</p>
                <button className="w-link" onClick={p.refresh}>
                  {tr("تحديث البيانات")}</button>
              </Box>
            )}
            {note && (
              <Box>
                <p role="status">{tr(note)}</p>
              </Box>
            )}
            {n === 51 && (
              <>
                <Box>
                  <h2>{tr("أهلًا يا كابتن")}{demo ? tr("مصطفى") : p.profile?.full_name}</h2>
                  <p>{tr("تابع خطوطك ومشتركيك وتأكيدات الدفع من مكان واحد.")}</p>
                </Box>
                <div className="o-stats">
                  {[
                    [
                      "الخطوط النشطة",
                      d.routes.filter((r) => r.status === "active").length,
                      55,
                    ],
                    ["اشتراكات قائمة", active.length, 53],
                    [
                      "تأكيدات معلقة",
                      active.filter(
                        (b) => b.rider_paid_at && !b.captain_received_at,
                      ).length,
                      52,
                    ],
                  ].map(([label, count, target]) => (
                    <button key={tr(String(label))} onClick={() => nav(Number(target))}>
                      <b>{count}</b>
                      <span>{tr(String(label))}</span>
                    </button>
                  ))}
                </div>
                <Box>
                  {action("الحجوزات الجديدة", 52)}
                  {action("التشغيل اليومي", 55)}
                  {action("المحادثات", 57)}
                  {action("الإشعارات", 59)}
                  {action("الحساب المالي", 60)}
                  {action("حساب الكابتن", 61)}
                  {action("الدعم والمساعدة", 62)}
                </Box>
              </>
            )}
            {(n === 52 || n === 53) && (
              <>
                <Box>
                  <p>
                    {n === 52
                      ? tr("الحجوزات مثبتة بالفعل؛ مش محتاجة موافقة جديدة منك. الأحدث أولًا.")
                      : tr("كل صف اشتراك بمقعد واحد. اختار الخط أو ابحث باسم المشترك.")}
                  </p>
                  <label className="w-field">
                    {tr("اسم المشترك")}<input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <label className="w-field">
                    {tr("الخط")}<select
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option value="">{tr("كل الخطوط")}</option>
                      {d.routes.map((r) => (
                        <option key={str(r, "id")} value={str(r, "id")}>
                          {tr(str(r, "origin"))} ← {tr(str(r, "destination"))}
                        </option>
                      ))}
                    </select>
                  </label>
                </Box>
                {active
                  .filter(
                    (b) =>
                      (!filter || b.route_id === filter) &&
                      tr(str(b, "rider_name", "")).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
                  )
                  .sort((a, b) =>
                    str(b, "created_at").localeCompare(str(a, "created_at")),
                  )
                  .map(card)}
                {!active.filter(
                  (b) =>
                    (!filter || b.route_id === filter) &&
                    tr(str(b, "rider_name", "")).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
                ).length && (
                  <Box>
                    <p>{tr("مفيش اشتراكات مطابقة حاليًا.")}</p>
                    {(query || filter || empty) && <button onClick={()=>{setQuery("");setFilter("");setEmpty(false);}}>{tr("مسح الفلاتر")}</button>}
                  </Box>
                )}
              </>
            )}
            {(n === 54 || n === 56) &&
              (!booking ? (
                <Box>
                  <p>{tr("اختار اشتراك راكب الأول.")}</p>
                  {action("قائمة المشتركين", 53)}
                </Box>
              ) : (
                <>
                  {card(booking)}
                  <Box><h2>{tr("نقاط الراكب")}</h2><p>{tr("الركوب:")}{str(booking, "pickup_stop")}</p><p>{tr("النزول:")}{str(booking, "dropoff_stop")}</p>{booking.direction === "round_trip" && <p>{tr("العودة تلقائيًا:")}{str(booking, "dropoff_stop")} ← {str(booking, "pickup_stop")}</p>}</Box>
                  <Box>
                    <div className="b-row">
                      <span>{tr("نهاية الفترة (غير شامل)")}</span>
                      <b>{dateLabel(str(booking, "ends_before"))}</b>
                    </div>
                    <div className="b-row">
                      <span>{tr("تأكيد الراكب")}</span>
                      <b>
                        {booking.rider_paid_at ? tr("تم الدفع") : tr("بانتظار التأكيد")}
                      </b>
                    </div>
                    <div className="b-row">
                      <span>{tr("تأكيد الكابتن")}</span>
                      <b>
                        {booking.captain_received_at
                          ? tr("تم الاستلام")
                          : tr("بانتظار التأكيد")}
                      </b>
                    </div>
                    <div className="b-row">
                      <span>{tr("تأمين جدية الحجز")}</span>
                      <b>{tr(state(booking.security_state))}</b>
                    </div>
                    <p>
                      {tr("سعر الاشتراك مدفوع ليك مباشرة. التأمين المسترد 100 جنيه يفضل منفصل، ويتحرر بعد تأكيد الطرفين.")}</p>
                  </Box>
                  {n === 54 ? (
                    <>
                      <button
                        className="d-primary b-primary"
                        onClick={() => nav(56)}
                      >
                        {tr("متابعة تأكيد الاستلام")}</button>
                      <button
                        className="d-primary b-primary"
                        disabled={busy}
                        onClick={() =>
                          void perform(async () => {
                            const c = demo
                              ? { id: "thread-1" }
                              : await api<{ id: string }>(
                                  "captain.conversation.open",
                                  { bookingId: booking.id },
                                );
                            await openChat(c.id);
                          })
                        }
                      >
                        {tr("محادثة الراكب")}</button>
                    </>
                  ) : (
                    <Box>
                      <p>
                        {tr("أكد فقط لو استلمت")}{money(booking.price)} {tr("فعلًا من الراكب.")}</p>
                      <label className="o-check">
                        <input
                          type="checkbox"
                          checked={confirm}
                          onChange={(e) => setConfirm(e.target.checked)}
                        />
                        {tr("أقر باستلام المبلغ الموضح")}</label>
                      <button
                        className="d-primary b-primary"
                        disabled={
                          busy ||
                          !confirm ||
                          !booking.rider_paid_at ||
                          !!booking.captain_received_at ||
                          booking.status !== "reserved" ||
                          str(booking, "starts_on") > d.today
                        }
                        onClick={() =>
                          void perform(async () => {
                            if (shared) {
                              confirmPreviewBooking(str(booking,"id"),"captain");
                              setNote("تم تسجيل الاستلام وتحرير تأمين الحجز في المحفظة التجريبية.");
                            } else if (demo) {
                              setLocal((v) => ({
                                ...v,
                                bookings: v.bookings.map((b) =>
                                  b.id === booking.id
                                    ? {
                                        ...b,
                                        captain_received_at:
                                          "2026-11-15T08:00:00Z",
                                        status: "confirmed",
                                        security_state: "released",
                                      }
                                    : b,
                                ),
                              }));
                              setNote(
                                "تمت محاكاة الاستلام وتحرير التأمين في المعاينة فقط.",
                              );
                            } else {
                              await api("payment.received", {
                                bookingId: booking.id,
                              });
                              p.refresh();
                              setNote("تم تسجيل تأكيد الاستلام.");
                            }
                            setConfirm(false);
                          })
                        }
                      >
                        {demo ? tr("محاكاة تم الاستلام") : tr("تم الاستلام")}
                      </button>
                      {!booking.rider_paid_at && (
                        <p>{tr("مستنيين إقرار الراكب بالدفع الأول.")}</p>
                      )}
                      <p>
                        {tr("لو فيه اختلاف في الدفع، افتح طلب دعم. مفيش خصم تأمين تلقائي بسبب الغياب.")}</p>
                      {action("مشكلة في الدفع", 62)}
                    </Box>
                  )}
                </>
              ))}
            {n === 55 && (
              <>
                <Box>
                  <h2>{tr("جدول اليوم ·")}{d.today || "—"}</h2>
                  <p>{tr("بتوقيت القاهرة · الأحد للخميس، ما عدا الإجازات الرسمية.")}</p>
                </Box>
                {d.eligible === null ? (
                  <Box>
                    <p>
                      {tr("تقويم التشغيل غير معتمد لليوم؛ مش هنفترض إن فيه تشغيل.")}</p>
                    {action("قائمة المشتركين", 53)}
                  </Box>
                ) : !d.eligible ? (
                  <Box>
                    <p>{tr("النهارده إجازة تشغيل.")}</p>
                    {action("قائمة المشتركين", 53)}
                  </Box>
                ) : (
                  d.routes.map((r) => {
                    const bs = active.filter(
                      (b) =>
                        b.route_id === r.id &&
                        str(b, "starts_on") <= d.today &&
                        str(b, "ends_before") > d.today,
                    );
                    return bs.length ? (
                      <Box key={str(r, "id")}>
                        <h2>
                          {tr(str(r, "origin"))} ← {tr(str(r, "destination"))}
                        </h2>
                        <div className="b-row">
                          <span>{tr("ذهاب")}{str(r, "outbound")}</span>
                          <span>{tr("عودة")}{str(r, "return_time")}</span>
                        </div>
                        <p>{bs.length} {tr("اشتراك اليوم")}</p>
                        <button
                          className="d-primary b-primary"
                          onClick={() => {
                            setFilter(str(r, "id"));
                            nav(53);
                          }}
                        >
                          {tr("عرض ركاب الخط")}</button>
                      </Box>
                    ) : null;
                  })
                )}
                {d.eligible &&
                  !active.some(
                    (b) =>
                      str(b, "starts_on") <= d.today &&
                      str(b, "ends_before") > d.today,
                  ) && (
                    <Box>
                      <p>{tr("مفيش اشتراكات تشغيل النهارده.")}</p>
                      {action("قائمة المشتركين", 53)}
                    </Box>
                  )}
              </>
            )}
            {n === 57 && (
              <>
                {d.conversations.map((c) => (
                  <Box key={str(c, "id")}>
                    <button
                      className="a-thread"
                      disabled={busy}
                      onClick={() => void openChat(str(c, "id"))}
                    >
                      <span className="a-avatar">
                        {str(c, "rider_name", "ر").slice(0, 1)}
                      </span>
                      <span>
                        <strong>{tr(str(c, "rider_name", "مشترك"))}</strong>
                        <small>{tr(str(c, "body", "ابدأ المحادثة"))}</small>
                        <small>{dateLabel(str(c, "created_at", ""), true)}</small>
                      </span>
                      <DiscoveryIcon name="back" />
                    </button>
                  </Box>
                ))}
                {!d.conversations.length && (
                  <Box>
                    <p>{tr("لسه مفيش محادثات. افتح اشتراك مؤكد للتواصل مع الراكب.")}</p>
                    {action("قائمة المشتركين", 53)}
                  </Box>
                )}
                <Box>
                  <p>{tr("علامات القراءة وعدّاد غير المقروء مش متاحين حاليًا.")}</p>
                </Box>
              </>
            )}
            {n === 58 &&
              (!thread ? (
                <Box>
                  <p>{tr("اختار محادثة الأول.")}</p>
                  {action("المحادثات", 57)}
                </Box>
              ) : (
                <>
                  <section className="a-chat" aria-label={tr("رسائل المحادثة")}>
                    {messages.map((m) => (
                      <article
                        className={`a-bubble ${m.sender_id === (demo ? "me" : p.profile?.id) ? "mine" : ""}`}
                        key={str(m, "id")}
                      >
                        <p>{tr(str(m, "body"))}</p>
                        <small>{dateLabel(str(m, "created_at"), true)}</small>
                      </article>
                    ))}
                  </section>
                  <form
                    className="a-compose"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void perform(async () => {
                        const body = draft.trim();
                        if (!body) return;
                        if (demo) {
                          const next = [
                            ...messages,
                            {
                              id: crypto.randomUUID(),
                              body,
                              sender_id: "me",
                              created_at: new Date().toISOString(),
                            },
                          ];
                          const nextHistory = {...chatHistory, [thread]: next};
                          setChatHistory(nextHistory);
                          try { sessionStorage.setItem(previewChatHistoryKey, JSON.stringify(nextHistory)); }
                          catch { /* Messages still remain available within this preview. */ }
                          setMessages(next);
                        } else {
                          await api("message.send", {
                            conversationId: thread,
                            body,
                          });
                          setMessages(
                            await api<Row[]>("messages", {
                              conversationId: thread,
                            }),
                          );
                        }
                        setDraft("");
                        setNote(
                          demo
                            ? tr("الرسالة في المعاينة فقط، ماتبعتتش.")
                            : tr("تم إرسال الرسالة."),
                        );
                      });
                    }}
                  >
                    <label className="w-field">
                      {tr("رسالتك")}<textarea
                        maxLength={2000}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                      />
                    </label>
                    <button
                      className="d-primary"
                      disabled={busy || !draft.trim()}
                    >
                      {demo ? tr("إضافة للمعاينة") : tr("إرسال الرسالة")}
                    </button>
                    <button
                      type="button"
                      className="w-link"
                      disabled={busy}
                      onClick={() => void openChat(thread, false)}
                    >
                      {tr("تحديث المحادثة")}</button>
                  </form>
                </>
              ))}
            {n === 59 && (
              <>
                <div className="w-tabs">
                  <button
                    aria-pressed={!unread}
                    onClick={() => setUnread(false)}
                  >
                    {tr("الكل")}</button>
                  <button aria-pressed={unread} onClick={() => setUnread(true)}>
                    {tr("غير المقروءة")}</button>
                </div>
                {d.notifications
                  .filter((r) => !unread || !r.read_at)
                  .map((r) => (
                    <Box key={str(r, "id")}>
                      <p>{tr(str(r, "body"))}</p>
                      <small>{dateLabel(str(r, "created_at"), true)}</small>
                      {action("راجع الحجوزات", 52)}
                    </Box>
                  ))}
                {!d.notifications.filter((r) => !unread || !r.read_at)
                  .length && (
                  <Box>
                    <p>{tr("مفيش إشعارات جديدة.")}</p>
                    {unread ? (
                      <button type="button" className="a-menu" onClick={() => setUnread(false)}>
                        {tr("عرض كل الإشعارات")}<DiscoveryIcon name="back" />
                      </button>
                    ) : action("الحجوزات الجديدة", 52)}
                  </Box>
                )}
                <Box>
                  <p>{tr("الإشعار تنبيه؛ راجع حالة الدفع الفعلية في الاشتراك.")}</p>
                </Box>
              </>
            )}
            {n === 60 && (
              <>
                <Box>
                  <h2>{tr("سجل إقرارات الاستلام")}</h2>
                  <p>
                    {tr("المبالغ دي مدفوعة مباشرة ليك من الركاب؛ مش رصيد في محفظة سِكّة.")}</p>
                </Box>
                {d.bookings
                  .filter((b) => b.captain_received_at)
                  .map((b) => (
                    <Box key={str(b, "id")}>
                      <h2>{tr(str(b, "rider_name"))}</h2>
                      <div className="b-row">
                        <span>{tr("تم الإقرار باستلام")}</span>
                        <b>{money(b.price)}</b>
                      </div>
                      <small>{dateLabel(str(b, "captain_received_at"), true)}</small>
                      <button className="a-menu" onClick={() => choose(b)}>
                        {tr("تفاصيل الاشتراك")}</button>
                    </Box>
                  ))}
                {!d.bookings.some((b) => b.captain_received_at) && (
                  <Box>
                    <p>{tr("لسه مفيش إقرارات استلام مسجلة.")}</p>
                    {action("الحجوزات الجديدة", 52)}
                  </Box>
                )}
              </>
            )}
            {n === 61 && (
              <>
                <Box>
                  <div className="a-profile">
                    <span className="a-avatar">{tr("ك")}</span>
                    <h2>{demo ? tr("كابتن مصطفى") : p.profile?.full_name}</h2>
                    <span className="o-badge">{tr(state(d.captain.status))}</span>
                  </div>
                </Box>
                <Box>
                  <h2>{tr("بيانات العربية")}</h2>
                  <div className="b-row">
                    <span>{tr("الموديل")}</span>
                    <b>{str(d.vehicle, "model")}</b>
                  </div>
                  <div className="b-row">
                    <span>{tr("الفئة")}</span>
                    <b>{str(d.vehicle, "category")}</b>
                  </div>
                  <div className="b-row">
                    <span>{tr("اللوحة")}</span>
                    <b>{str(d.vehicle, "plate")}</b>
                  </div>
                  <p>{tr("تعديل العربية أو المستندات يحتاج مراجعة الإدارة.")}</p>
                  {action("طلب تعديل البيانات", 62)}
                </Box>
                <PreferenceSettings />
              </>
            )}
            {n === 62 && (
              <>
                <Box>
                  <h2>{tr("نساعدك إزاي؟")}</h2>
                  <details className="a-faq">
                    <summary>{tr("الراكب قال دفع والمبلغ موصلش؟")}</summary>
                    <p>
                      {tr("متأكدش الاستلام. ابعت تفاصيل الحجز للدعم عشان يراجع إقرارات الطرفين.")}</p>
                  </details>
                  <details className="a-faq">
                    <summary>{tr("هل الغياب يخصم تأمين؟")}</summary>
                    <p>{tr("لأ، مفيش مصادرة تلقائية للتأمين بسبب الغياب.")}</p>
                  </details>
                  <details className="a-faq">
                    <summary>{tr("أعدّل العربية إزاي؟")}</summary>
                    <p>{tr("قدّم طلب تعديل، والبيانات الحساسة بتحتاج مراجعة جديدة.")}</p>
                  </details>
                </Box>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void perform(async () => {
                      const body = `${topic}: ${support.trim()}`;
                      if (demo) {
                        setLocal((v) => ({
                          ...v,
                          tickets: [
                            ...v.tickets,
                            {
                              id: crypto.randomUUID(),
                              body,
                              status: "معاينة فقط",
                            },
                          ],
                        }));
                        setNote("طلب الدعم اتضاف للمعاينة فقط.");
                      } else {
                        await api("support.create", { body });
                        p.refresh();
                        setNote("تم إرسال طلبك للدعم.");
                      }
                      setSupport("");
                    });
                  }}
                >
                  <Box>
                    <label className="w-field">
                      {tr("نوع المشكلة")}<select
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                      >
                        {[
                          "الدفع والتأمين",
                          "الحجوزات",
                          "العربية والمستندات",
                          "تعديل البيانات",
                        ].map((t) => (
                          <option key={t} value={t}>{tr(t)}</option>
                        ))}
                      </select>
                    </label>
                    <label className="w-field">
                      {tr("تفاصيل المشكلة")}<textarea
                        minLength={5}
                        maxLength={3800}
                        value={support}
                        onChange={(e) => setSupport(e.target.value)}
                        placeholder={tr("اكتب رقم الحجز والتفاصيل، من غير كلمات مرور أو أكواد تحقق")}
                      />
                    </label>
                    <button
                      className="d-primary b-primary"
                      disabled={busy || support.trim().length < 5}
                    >
                      {demo ? tr("معاينة طلب الدعم") : tr("إرسال للدعم")}
                    </button>
                  </Box>
                </form>
                {d.tickets.map((t) => (
                  <Box key={str(t, "id")}>
                    <p>{tr(str(t, "body"))}</p>
                    <small>{tr("الحالة:")}{str(t, "status")}</small>
                  </Box>
                ))}
              </>
            )}
          </>
        )}
        <p className="w-footnote">{tr("معاك في السِكّة")}</p>
      </main>
    </div>
  );
}
