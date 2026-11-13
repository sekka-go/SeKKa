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
  internalScreen(i + 51),
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
const str = (r: Row, k: string, f = "—") => String(r[k] ?? f);
const money = (v: unknown) =>
  `${Number(v || 0).toLocaleString("ar-EG-u-nu-latn")} ج.م`;
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
  const demo = new URLSearchParams(location.search).get("preview") === "phase7";
  const n = publicScreen(p.screen);
  const [local, setLocal] = useState(demoData),
    [empty, setEmpty] = useState(false),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState(""),
    [selected, setSelected] = useState(""),
    [thread, setThread] = useState(""),
    [messages, setMessages] = useState<Row[]>([]),
    [draft, setDraft] = useState(""),
    [note, setNote] = useState(""),
    [error, setError] = useState(""),
    [working, setWorking] = useState(false),
    [confirm, setConfirm] = useState(false),
    [unread, setUnread] = useState(false),
    [support, setSupport] = useState(""),
    [topic, setTopic] = useState("الدفع والتأمين");
  const d = demo
    ? empty
      ? { ...emptyData, today: demoData.today, eligible: true }
      : local
    : p.data || emptyData;
  const allowed = demo || (p.signedIn && p.profile?.role === "captain");
  const nav = (v: number) => {
    setNote("");
    setError("");
    setConfirm(false);
    p.go(internalScreen(v));
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
      {label}
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
  async function openChat(id: string) {
    await perform(async () => {
      if (demo) {
        setMessages([
          {
            id: "m1",
            body: "أهلًا يا كابتن، هنلتزم بنقطة الالتقاء.",
            sender_id: "rider",
            created_at: "2026-11-15T05:00:00Z",
          },
        ]);
      } else setMessages(await api<Row[]>("messages", { conversationId: id }));
      setThread(id);
      nav(58);
    });
  }
  const card = (b: Row) => (
    <Box key={str(b, "id")}>
      <div className="o-card-top">
        <strong>{str(b, "rider_name", "مشترك")}</strong>
        <span className="o-badge">{state(b.status)}</span>
      </div>
      <h2>
        {str(b, "origin")} ← {str(b, "destination")}
      </h2>
      <div className="b-row">
        <span>البداية</span>
        <b dir="ltr">{str(b, "starts_on")}</b>
      </div>
      <div className="b-row">
        <span>المبلغ المثبت</span>
        <b>{money(b.price)}</b>
      </div>
      <button className="d-primary b-primary" onClick={() => choose(b)}>
        تفاصيل الاشتراك
      </button>
    </Box>
  );
  return (
    <div
      className={`phase-one-stage discovery-stage booking-stage account-stage ${p.theme}`}
    >
      <nav className="phase-review-bar" aria-label="معاينة المرحلة السابعة">
        <div className="review-screen-nav">
          <button
            aria-label="الشاشة السابقة"
            disabled={n === 51}
            onClick={() => nav(n - 1)}
          >
            ‹
          </button>
          <select
            aria-label="شاشة المرحلة السابعة"
            value={n}
            onChange={(e) => nav(+e.target.value)}
          >
            {operationsScreens.map((s) => (
              <option key={s} value={publicScreen(s)}>
                {publicScreen(s)} · {screenTitle(s)}
              </option>
            ))}
          </select>
          <button
            aria-label="الشاشة التالية"
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
              {t === "dark" ? "دارك" : "لايت"}
            </button>
          ))}
        </div>
      </nav>
      <p className="w-preview">
        {demo
          ? "معاينة المرحلة السابعة · بيانات توضيحية، مفيش عمليات حقيقية"
          : "تشغيل الكابتن"}
      </p>
      {demo && (
        <label className="a-preview-empty">
          <input
            type="checkbox"
            checked={empty}
            onChange={(e) => setEmpty(e.target.checked)}
          />
          معاينة القوائم الفارغة
        </label>
      )}
      <main className="phase-canvas d-canvas b-canvas a-canvas o-canvas">
        <header className="d-header">
          <button
            className="phase-back"
            aria-label="رجوع"
            onClick={() => nav(n === 58 ? 57 : 51)}
          >
            <DiscoveryIcon name="back" />
          </button>
          <Wordmark />
        </header>
        <div className="b-stage-label">
          <span>الكابتن · معاك في السِكّة</span>
          <span>{n - 50} / 12</span>
        </div>
        <h1 className="b-title">{screenTitle(p.screen)}</h1>
        {!allowed ? (
          <Box>
            <p>سجّل بحساب كابتن عشان تشوف بيانات تشغيلك.</p>
            <button className="d-primary b-primary" onClick={() => p.go(4)}>
              تسجيل الدخول
            </button>
          </Box>
        ) : (
          <>
            {busy && (
              <Box>
                <p role="status">جاري التحميل…</p>
              </Box>
            )}
            {(error || p.error) && (
              <Box>
                <p role="alert">{error || p.error}</p>
                <button className="w-link" onClick={p.refresh}>
                  تحديث البيانات
                </button>
              </Box>
            )}
            {note && (
              <Box>
                <p role="status">{note}</p>
              </Box>
            )}
            {n === 51 && (
              <>
                <Box>
                  <h2>أهلًا يا كابتن {demo ? "مصطفى" : p.profile?.full_name}</h2>
                  <p>تابع خطوطك ومشتركيك وتأكيدات الدفع من مكان واحد.</p>
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
                    <button key={label} onClick={() => nav(Number(target))}>
                      <b>{count}</b>
                      <span>{label}</span>
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
                      ? "الحجوزات مثبتة بالفعل؛ مش محتاجة موافقة جديدة منك. الأحدث أولًا."
                      : "كل صف اشتراك بمقعد واحد. اختار الخط أو ابحث باسم المشترك."}
                  </p>
                  <label className="w-field">
                    اسم المشترك
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <label className="w-field">
                    الخط
                    <select
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option value="">كل الخطوط</option>
                      {d.routes.map((r) => (
                        <option key={str(r, "id")} value={str(r, "id")}>
                          {str(r, "origin")} ← {str(r, "destination")}
                        </option>
                      ))}
                    </select>
                  </label>
                </Box>
                {active
                  .filter(
                    (b) =>
                      (!filter || b.route_id === filter) &&
                      str(b, "rider_name", "").includes(query.trim()),
                  )
                  .sort((a, b) =>
                    str(b, "created_at").localeCompare(str(a, "created_at")),
                  )
                  .map(card)}
                {!active.filter(
                  (b) =>
                    (!filter || b.route_id === filter) &&
                    str(b, "rider_name", "").includes(query.trim()),
                ).length && (
                  <Box>
                    <p>مفيش اشتراكات مطابقة حاليًا.</p>
                  </Box>
                )}
              </>
            )}
            {(n === 54 || n === 56) &&
              (!booking ? (
                <Box>
                  <p>اختار اشتراك راكب الأول.</p>
                  {action("قائمة المشتركين", 53)}
                </Box>
              ) : (
                <>
                  {card(booking)}
                  <Box>
                    <div className="b-row">
                      <span>نهاية الفترة (غير شامل)</span>
                      <b>{str(booking, "ends_before")}</b>
                    </div>
                    <div className="b-row">
                      <span>تأكيد الراكب</span>
                      <b>
                        {booking.rider_paid_at ? "تم الدفع" : "بانتظار التأكيد"}
                      </b>
                    </div>
                    <div className="b-row">
                      <span>تأكيد الكابتن</span>
                      <b>
                        {booking.captain_received_at
                          ? "تم الاستلام"
                          : "بانتظار التأكيد"}
                      </b>
                    </div>
                    <div className="b-row">
                      <span>تأمين جدية الحجز</span>
                      <b>{state(booking.security_state)}</b>
                    </div>
                    <p>
                      سعر الاشتراك مدفوع ليك مباشرة. التأمين المسترد 100 جنيه
                      يفضل منفصل، ويتحرر بعد تأكيد الطرفين.
                    </p>
                  </Box>
                  {n === 54 ? (
                    <>
                      <button
                        className="d-primary b-primary"
                        onClick={() => nav(56)}
                      >
                        متابعة تأكيد الاستلام
                      </button>
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
                        محادثة الراكب
                      </button>
                    </>
                  ) : (
                    <Box>
                      <p>
                        أكد فقط لو استلمت {money(booking.price)} فعلًا من الراكب.
                      </p>
                      <label className="o-check">
                        <input
                          type="checkbox"
                          checked={confirm}
                          onChange={(e) => setConfirm(e.target.checked)}
                        />
                        أقر باستلام المبلغ الموضح
                      </label>
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
                            if (demo) {
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
                        {demo ? "محاكاة تم الاستلام" : "تم الاستلام"}
                      </button>
                      {!booking.rider_paid_at && (
                        <p>مستنيين إقرار الراكب بالدفع الأول.</p>
                      )}
                      <p>
                        لو فيه اختلاف في الدفع، افتح طلب دعم. مفيش خصم تأمين
                        تلقائي بسبب الغياب.
                      </p>
                      {action("مشكلة في الدفع", 62)}
                    </Box>
                  )}
                </>
              ))}
            {n === 55 && (
              <>
                <Box>
                  <h2>جدول اليوم · {d.today || "—"}</h2>
                  <p>بتوقيت القاهرة · الأحد للخميس، ما عدا الإجازات الرسمية.</p>
                </Box>
                {d.eligible === null ? (
                  <Box>
                    <p>
                      تقويم التشغيل غير معتمد لليوم؛ مش هنفترض إن فيه تشغيل.
                    </p>
                  </Box>
                ) : !d.eligible ? (
                  <Box>
                    <p>النهارده إجازة تشغيل.</p>
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
                          {str(r, "origin")} ← {str(r, "destination")}
                        </h2>
                        <div className="b-row">
                          <span>ذهاب {str(r, "outbound")}</span>
                          <span>عودة {str(r, "return_time")}</span>
                        </div>
                        <p>{bs.length} اشتراك اليوم</p>
                        <button
                          className="d-primary b-primary"
                          onClick={() => {
                            setFilter(str(r, "id"));
                            nav(53);
                          }}
                        >
                          عرض ركاب الخط
                        </button>
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
                      <p>مفيش اشتراكات تشغيل النهارده.</p>
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
                        <strong>{str(c, "rider_name", "مشترك")}</strong>
                        <small>{str(c, "body", "ابدأ المحادثة")}</small>
                        <small>{str(c, "created_at", "")}</small>
                      </span>
                      <DiscoveryIcon name="back" />
                    </button>
                  </Box>
                ))}
                {!d.conversations.length && (
                  <Box>
                    <p>لسه مفيش محادثات. افتح اشتراك مؤكد للتواصل مع الراكب.</p>
                    {action("قائمة المشتركين", 53)}
                  </Box>
                )}
                <Box>
                  <p>علامات القراءة وعدّاد غير المقروء مش متاحين حاليًا.</p>
                </Box>
              </>
            )}
            {n === 58 &&
              (!thread ? (
                <Box>
                  <p>اختار محادثة الأول.</p>
                  {action("المحادثات", 57)}
                </Box>
              ) : (
                <>
                  <section className="a-chat" aria-label="رسائل المحادثة">
                    {messages.map((m) => (
                      <article
                        className={`a-bubble ${m.sender_id === (demo ? "me" : p.profile?.id) ? "mine" : ""}`}
                        key={str(m, "id")}
                      >
                        <p>{str(m, "body")}</p>
                        <small>{str(m, "created_at")}</small>
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
                        if (demo)
                          setMessages((v) => [
                            ...v,
                            {
                              id: crypto.randomUUID(),
                              body,
                              sender_id: "me",
                              created_at: new Date().toLocaleTimeString(
                                "ar-EG",
                              ),
                            },
                          ]);
                        else {
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
                            ? "الرسالة في المعاينة فقط، ماتبعتتش."
                            : "تم إرسال الرسالة.",
                        );
                      });
                    }}
                  >
                    <label className="w-field">
                      رسالتك
                      <textarea
                        maxLength={2000}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                      />
                    </label>
                    <button
                      className="d-primary"
                      disabled={busy || !draft.trim()}
                    >
                      {demo ? "إضافة للمعاينة" : "إرسال الرسالة"}
                    </button>
                    <button
                      type="button"
                      className="w-link"
                      disabled={busy}
                      onClick={() => void openChat(thread)}
                    >
                      تحديث المحادثة
                    </button>
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
                    الكل
                  </button>
                  <button aria-pressed={unread} onClick={() => setUnread(true)}>
                    غير المقروءة
                  </button>
                </div>
                {d.notifications
                  .filter((r) => !unread || !r.read_at)
                  .map((r) => (
                    <Box key={str(r, "id")}>
                      <p>{str(r, "body")}</p>
                      <small>{str(r, "created_at")}</small>
                      {action("راجع الحجوزات", 52)}
                    </Box>
                  ))}
                {!d.notifications.filter((r) => !unread || !r.read_at)
                  .length && (
                  <Box>
                    <p>مفيش إشعارات جديدة.</p>
                  </Box>
                )}
                <Box>
                  <p>الإشعار تنبيه؛ راجع حالة الدفع الفعلية في الاشتراك.</p>
                </Box>
              </>
            )}
            {n === 60 && (
              <>
                <Box>
                  <h2>سجل إقرارات الاستلام</h2>
                  <p>
                    المبالغ دي مدفوعة مباشرة ليك من الركاب؛ مش رصيد في محفظة
                    سِكّة.
                  </p>
                </Box>
                {d.bookings
                  .filter((b) => b.captain_received_at)
                  .map((b) => (
                    <Box key={str(b, "id")}>
                      <h2>{str(b, "rider_name")}</h2>
                      <div className="b-row">
                        <span>تم الإقرار باستلام</span>
                        <b>{money(b.price)}</b>
                      </div>
                      <small>{str(b, "captain_received_at")}</small>
                      <button className="a-menu" onClick={() => choose(b)}>
                        تفاصيل الاشتراك
                      </button>
                    </Box>
                  ))}
                {!d.bookings.some((b) => b.captain_received_at) && (
                  <Box>
                    <p>لسه مفيش إقرارات استلام مسجلة.</p>
                  </Box>
                )}
              </>
            )}
            {n === 61 && (
              <>
                <Box>
                  <div className="a-profile">
                    <span className="a-avatar">ك</span>
                    <h2>{demo ? "كابتن مصطفى" : p.profile?.full_name}</h2>
                    <span className="o-badge">{state(d.captain.status)}</span>
                  </div>
                </Box>
                <Box>
                  <h2>بيانات العربية</h2>
                  <div className="b-row">
                    <span>الموديل</span>
                    <b>{str(d.vehicle, "model")}</b>
                  </div>
                  <div className="b-row">
                    <span>الفئة</span>
                    <b>{str(d.vehicle, "category")}</b>
                  </div>
                  <div className="b-row">
                    <span>اللوحة</span>
                    <b>{str(d.vehicle, "plate")}</b>
                  </div>
                  <p>تعديل العربية أو المستندات يحتاج مراجعة الإدارة.</p>
                  {action("طلب تعديل البيانات", 62)}
                </Box>
                <Box>
                  <h2>مظهر التطبيق</h2>
                  <div className="w-tabs">
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
                </Box>
              </>
            )}
            {n === 62 && (
              <>
                <Box>
                  <h2>نساعدك إزاي؟</h2>
                  <details className="a-faq">
                    <summary>الراكب قال دفع والمبلغ موصلش؟</summary>
                    <p>
                      متأكدش الاستلام. ابعت تفاصيل الحجز للدعم عشان يراجع
                      إقرارات الطرفين.
                    </p>
                  </details>
                  <details className="a-faq">
                    <summary>هل الغياب يخصم تأمين؟</summary>
                    <p>لأ، مفيش مصادرة تلقائية للتأمين بسبب الغياب.</p>
                  </details>
                  <details className="a-faq">
                    <summary>أعدّل العربية إزاي؟</summary>
                    <p>قدّم طلب تعديل، والبيانات الحساسة بتحتاج مراجعة جديدة.</p>
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
                      نوع المشكلة
                      <select
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                      >
                        {[
                          "الدفع والتأمين",
                          "الحجوزات",
                          "العربية والمستندات",
                          "تعديل البيانات",
                        ].map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </label>
                    <label className="w-field">
                      تفاصيل المشكلة
                      <textarea
                        minLength={5}
                        maxLength={3800}
                        value={support}
                        onChange={(e) => setSupport(e.target.value)}
                        placeholder="اكتب رقم الحجز والتفاصيل، من غير كلمات مرور أو أكواد تحقق"
                      />
                    </label>
                    <button
                      className="d-primary b-primary"
                      disabled={busy || support.trim().length < 5}
                    >
                      {demo ? "معاينة طلب الدعم" : "إرسال للدعم"}
                    </button>
                  </Box>
                </form>
                {d.tickets.map((t) => (
                  <Box key={str(t, "id")}>
                    <p>{str(t, "body")}</p>
                    <small>الحالة: {str(t, "status")}</small>
                  </Box>
                ))}
              </>
            )}
          </>
        )}
        <p className="w-footnote">معاك في السِكّة</p>
      </main>
    </div>
  );
}
