import { usePreferences } from "./preferences";
import { translate } from "./translations";
import { PreferenceSettings } from "./preferences";
import { publicScreen } from "./screenMap";
import { useEffect, useState, type ReactNode } from "react";
import { Wordmark, type Appearance } from "./Onboarding";
import { DiscoveryIcon } from "./Discovery";
import type { Profile } from "./api";
import "./booking.css";
import "./wallet.css";
import "./account.css";
export const accountScreens = [31, 32, 33, 34, 35, 36];
const titles = [
  "المحادثات",
  "المحادثة",
  "الإشعارات",
  "حسابي",
  "تعديل بياناتي",
  "المساعدة",
];
type Row = Record<string, unknown>;
const threads = [
  {
    id: "demo-ahmed",
    name: "كابتن أحمد",
    route: "المعادي ← التجمع",
    body: "نتقابل عند نقطة الالتقاء المتفق عليها.",
  },
  {
    id: "demo-karim",
    name: "كابتن كريم",
    route: "الزمالك ← الشيخ زايد",
    body: "أهلًا بيك، أنا معاك لو محتاج تسأل عن الخط.",
  },
];
const alerts = [
  {
    id: "n1",
    body: "الكابتن أكد الاستلام. تأمينك متاح دلوقتي.",
    created_at: "2026-11-12T08:00:00Z",
    read_at: null,
  },
  {
    id: "n2",
    body: "تقدر تراجع موعد بداية اشتراكك من تفاصيل الاشتراك.",
    created_at: "2026-11-11T08:00:00Z",
    read_at: "2026-11-11T09:00:00Z",
  },
];
const faq = [
  [
    "تأمين جدية الحجز ده مقابل إيه؟",
    "هو مبلغ مسترد 100 جنيه، منفصل عن سعر الاشتراك. بيتاح بعد تأكيد الدفع والاستلام من الطرفين، لو مفيش نزاع.",
  ],
  [
    "أدفع الاشتراك إزاي؟",
    "ادفع قيمة الاشتراك كاملة للكابتن أول يوم خدمة. بعد الدفع أكد «تم الدفع»، والكابتن يأكد «تم الاستلام».",
  ],
  [
    "أقدر أغيّر مدة الاشتراك أو اتجاهه؟",
    "الكابتن بيحدد مدة العرض واتجاهه وسعره. اختار العرض المناسب ليك قبل الحجز.",
  ],
  ["لو ملقيتش خط مناسب؟", "بعد البحث، لو مفيش عروض مطابقة، اختار «اطلب رحلة» وراجع بيانات بحثك ثم أكد الطلب."],
  [
    "الإلغاء والتجديد متاحين؟",
    "لسه محتاجين اعتماد السياسات قبل تفعيل الإلغاء والتجديد. مفيش خصم تلقائي من التأمين بسبب غياب أو تأكيد متأخر.",
  ],
];
function Box({ children }: { children: ReactNode }) {
  return <section className="d-box b-box">{children}</section>;
}
export default function AccountFlow(p: {
  screen: number;
  theme: Appearance;
  onTheme: (t: Appearance) => void;
  go: (n: number) => void;
  profile: Profile | null;
  signedIn: boolean;
  rows: Row[];
  conversation: string;
  onConversation: (id: string) => void;
  busy: boolean;
  error: string;
  onSend: (body: string) => Promise<void>;
  onSupport: (body: string) => Promise<void>;
  onRefresh: () => void;
  onLogout: () => Promise<void>;
}) {
  const {language} = usePreferences();
  const tr = (text:string) => translate(text,language);
  const demo = new URLSearchParams(location.search).get("preview") === "phase4";
  const [empty, setEmpty] = useState(false),
    [query, setQuery] = useState(""),
    [draft, setDraft] = useState(""),
    [support, setSupport] = useState(""),
    [note, setNote] = useState(""),
    [name, setName] = useState(p.profile?.full_name || "أحمد محمد"),
    [savedName, setSavedName] = useState("أحمد محمد"),
    [unread, setUnread] = useState(false),
    [read, setRead] = useState<string[]>([]),
    [localMessages, setLocalMessages] = useState<Record<string, Row[]>>({});
  const [selected, setSelected] = useState("demo-ahmed");
  useEffect(() => {
    setNote("");
    setDraft("");
  }, [p.screen, p.conversation, selected]);
  const nav = (id: number) => {
    setNote("");
    p.go(id);
  };
  const current = demo ? selected : p.conversation;
  const thread = threads.find((t) => t.id === selected) || threads[0];
  const rows = demo ? (empty ? [] : threads) : p.rows;
  const messages = demo
    ? empty
      ? []
      : [
          {
            id: "greeting",
            body: thread.body,
            sender_id: "captain",
            created_at: "2026-11-12T08:00:00Z",
          },
          ...(localMessages[selected] || []),
        ]
    : p.rows;
  const notifications: Row[] = demo ? (empty ? [] : alerts) : p.rows;
  const displayName = demo ? savedName : p.profile?.full_name || "";
  const action = (label: string, id: number) => (
    <button className="a-menu" onClick={() => nav(id)}>
      <span>{label}</span>
      <DiscoveryIcon name="back" />
    </button>
  );
  async function send() {
    const value = draft.trim();
    if (!value || value.length > 2000) return;
    if (demo) {
      setLocalMessages((m) => ({
        ...m,
        [selected]: [
          ...(m[selected] || []),
          {
            id: crypto.randomUUID(),
            body: value,
            sender_id: "me",
            created_at: new Date().toISOString(),
          },
        ],
      }));
      setNote(tr("الرسالة اتضافت للمعاينة بس، وماتبعتتش لأي حد."));
      setDraft("");
    } else {
      try {
        await p.onSend(value);
        setDraft("");
        setNote(tr("رسالتك اتبعتت."));
      } catch {
        /* parent displays error */
      }
    }
  }
  return (
    <div
      className={`phase-one-stage discovery-stage booking-stage account-stage ${p.theme}`}
    >
      <nav className="phase-review-bar" aria-label={tr("معاينة المرحلة الرابعة")}>
        <div className="review-screen-nav">
          <button
            aria-label={tr("الشاشة السابقة")}
            disabled={p.screen === 31}
            onClick={() => nav(p.screen - 1)}
          >
            ‹
          </button>
          <select
            aria-label={tr("شاشة المرحلة الرابعة")}
            value={p.screen}
            onChange={(e) => nav(+e.target.value)}
          >
            {accountScreens.map((n, i) => (
              <option key={n} value={n}>
                {publicScreen(n)} · {tr(titles[i])}
              </option>
            ))}
          </select>
          <button
            aria-label={tr("الشاشة التالية")}
            disabled={p.screen === 36}
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
          : tr("حسابك والتواصل")}
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
      <main className="phase-canvas d-canvas b-canvas a-canvas">
        <header className="d-header">
          <button
            className="phase-back"
            aria-label={tr("رجوع")}
            onClick={() => nav(p.screen === 32 ? 31 : p.screen === 35 ? 34 : 8)}
          >
            <DiscoveryIcon name="back" />
          </button>
          <Wordmark />
        </header>
        <div className="b-stage-label">
          <span>{tr("حسابك والتواصل")}</span>
          <span dir="ltr">{p.screen - 30} / 6</span>
        </div>
        <h1 className="b-title">{tr(titles[p.screen - 31])}</h1>
        {p.busy && !demo && (
          <Box>
            <p role="status">{tr("جاري التحميل…")}</p>
          </Box>
        )}
        {p.error && (
          <Box>
            <p role="alert">{p.error}</p>
            <button className="w-link" onClick={p.onRefresh}>
              {tr("حاول تاني")}</button>
          </Box>
        )}
        {note && (
          <Box>
            <p role="status">{note}</p>
          </Box>
        )}
        {!(demo || p.signedIn) && p.screen !== 36 ? (
          <Box>
            <p>{tr("سجّل برقم موبايلك عشان نكمل.")}</p>
            {action(tr("تسجيل الدخول"), 4)}
          </Box>
        ) : (
          <>
            {p.screen === 31 && (
              <>
                <Box>
                  <label className="w-field">
                    {tr("دوّر في المحادثات")}<input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={tr("اسم الكابتن أو الخط")}
                    />
                  </label>
                </Box>
                {rows
                  .filter((r) =>
                    `${r.name || tr("محادثة الخط")} ${r.route || ""}`.includes(
                      query.trim(),
                    ),
                  )
                  .map((r) => (
                    <Box key={String(r.id)}>
                      <button
                        className="a-thread"
                        onClick={() => {
                          if (demo) setSelected(String(r.id));
                          else p.onConversation(String(r.id));
                          nav(32);
                        }}
                      >
                        <span className="a-avatar" aria-hidden="true">
                          {demo ? "ك" : "↔"}
                        </span>
                        <span>
                          <strong>{String(r.name || tr("محادثة الخط"))}</strong>
                          {Boolean(r.route) && <small>{String(r.route)}</small>}
                          <small>
                            {String(
                              r.body || tr("افتح المحادثة عشان تشوف الرسائل."),
                            )}
                          </small>
                        </span>
                        <DiscoveryIcon name="back" />
                      </button>
                    </Box>
                  ))}
                {!rows.filter((r) =>
                  `${r.name || tr("محادثة الخط")} ${r.route || ""}`.includes(
                    query.trim(),
                  ),
                ).length && (
                  <Box>
                    <h2>
                      {query ? tr("مفيش محادثة بالبحث ده.") : tr("لسه مفيش محادثات.")}
                    </h2>
                    <p>{tr("اختار خط عشان تفتح محادثة مع الكابتن.")}</p>
                    {action(tr("دوّر على خط"), 8)}
                  </Box>
                )}
              </>
            )}
            {p.screen === 32 &&
              (current ? (
                <>
                  <Box>
                    <div className="a-chat-heading">
                      <span className="a-avatar">ك</span>
                      <div>
                        <h2>{demo ? thread.name : tr("محادثة الخط")}</h2>
                        <p>
                          {demo
                            ? thread.route
                            : tr("الرسائل بينك وبين الطرف التاني في المحادثة.")}
                        </p>
                      </div>
                    </div>
                  </Box>
                  <section
                    className="a-chat"
                    aria-label={tr("رسائل المحادثة")}
                    aria-live="polite"
                  >
                    {messages.length ? (
                      messages.map((m) => (
                        <article
                          key={String(m.id)}
                          className={`a-bubble ${m.sender_id === (demo ? "me" : p.profile?.id) ? "mine" : ""}`}
                        >
                          <p>{String(m.body)}</p>
                          <small>
                            {new Date(String(m.created_at)).toLocaleTimeString(
                              language === "en" ? "en-GB" : "ar-EG-u-nu-latn",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                                timeZone: "Africa/Cairo",
                              },
                            )}
                          </small>
                        </article>
                      ))
                    ) : (
                      <p>{tr("ابدأ المحادثة برسالة.")}</p>
                    )}
                  </section>
                  <form
                    className="a-compose"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void send();
                    }}
                  >
                    <label className="w-field">
                      {tr("رسالتك")}<textarea
                        maxLength={2000}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder={tr("اكتب رسالتك هنا")}
                      />
                    </label>
                    <button
                      className="d-primary"
                      disabled={p.busy || !draft.trim()}
                    >
                      {p.busy
                        ? tr("جاري الإرسال…")
                        : demo
                          ? tr("إضافة للمعاينة")
                          : tr("ابعت الرسالة")}
                    </button>
                  </form>
                </>
              ) : (
                <Box>
                  <p>{tr("اختار محادثة الأول.")}</p>
                  {action(tr("المحادثات"), 31)}
                </Box>
              ))}
            {p.screen === 33 && (
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
                {notifications
                  .filter(
                    (n) =>
                      !unread || (!n.read_at && !read.includes(String(n.id))),
                  )
                  .map((n) => (
                    <Box key={String(n.id)}>
                      <div className="a-notification">
                        <span
                          className={`a-dot ${n.read_at || read.includes(String(n.id)) ? "seen" : ""}`}
                          aria-label={
                            n.read_at || read.includes(String(n.id))
                              ? tr("مقروء")
                              : tr("غير مقروء")
                          }
                        />
                        <p>{demo ? tr(String(n.body)) : String(n.body)}</p>
                      </div>
                      <small>
                        {new Date(String(n.created_at)).toLocaleDateString(
                          language === "en" ? "en-GB" : "ar-EG-u-nu-latn",
                          { timeZone: "Africa/Cairo" },
                        )}
                      </small>
                      {demo && !n.read_at && !read.includes(String(n.id)) && (
                        <button
                          className="w-link"
                          onClick={() => setRead((v) => [...v, String(n.id)])}
                        >
                          {tr("اعتباره مقروءًا في المعاينة")}</button>
                      )}
                    </Box>
                  ))}
                {!notifications.filter(
                  (n) =>
                    !unread || (!n.read_at && !read.includes(String(n.id))),
                ).length && (
                  <Box>
                    <h2>{tr("مفيش إشعارات جديدة.")}</h2>
                    <p>{tr("تحديثات حسابك واشتراكاتك هتظهر هنا.")}</p>
                  </Box>
                )}
              </>
            )}
            {p.screen === 34 && (
              <>
                <Box>
                  <div className="a-profile">
                    <span className="a-avatar">
                      {displayName.slice(0, 1) || "س"}
                    </span>
                    <h2>{displayName}</h2>
                    <p>
                      {p.profile?.role === "captain" ? tr("كابتن") : tr("راكب")}
                      {demo ? tr("· حساب توضيحي") : ""}
                    </p>
                  </div>
                </Box>
                <Box>
                  {action(tr("تعديل بياناتي"), 35)}
                  {action(tr("اشتراكاتي"), 29)}
                  {action(tr("محفظتي"), 24)}
                  {action(tr("المحادثات"), 31)}
                  {action(tr("الإشعارات"), 33)}
                  {action(tr("المساعدة"), 36)}
                </Box>
                <PreferenceSettings />
                <Box>
                  <button
                    className="w-link"
                    disabled={p.busy}
                    onClick={() => {
                      if (demo)
                        setNote(
                          tr("دي معاينة. مفيش جلسة حساب حقيقية لتسجيل خروجها."),
                        );
                      else void p.onLogout().catch(() => {});
                    }}
                  >
                    {tr("تسجيل الخروج")}</button>
                </Box>
              </>
            )}
            {p.screen === 35 && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (demo && name.trim().length >= 2) {
                    setSavedName(name.trim());
                    setNote(tr("الاسم اتغيّر في المعاينة بس."));
                  }
                }}
              >
                <Box>
                  <label className="w-field">
                    {tr("الاسم الكامل")}<input
                      value={demo ? name : p.profile?.full_name || ""}
                      readOnly={!demo}
                      onChange={(e) => setName(e.target.value)}
                      required
                      minLength={2}
                      maxLength={100}
                    />
                  </label>
                  <p>{tr("تغيير رقم الموبايل محتاج تحقق جديد، ومش متاح دلوقتي.")}</p>
                </Box>
                {!demo && (
                  <Box>
                    <p>
                      {tr("حفظ تعديلات الحساب متوقف لحد اعتماد مسار الحساب وشروطه.")}</p>
                  </Box>
                )}
                <button
                  className="d-primary b-primary"
                  disabled={!demo || name.trim().length < 2}
                >
                  {demo ? tr("حفظ في المعاينة") : tr("حفظ البيانات — غير مفعّل")}
                </button>
                {action(tr("الرجوع لحسابي"), 34)}
              </form>
            )}
            {p.screen === 36 && (
              <>
                <Box>
                  <h2>{tr("نساعدك إزاي؟")}</h2>
                  <p>{tr("إجابات سريعة عن الحجز والاشتراك والتأمين.")}</p>
                  {faq.map(([q, a]) => (
                    <details className="a-faq" key={tr(q)}>
                      <summary>{tr(q)}</summary>
                      <p>{tr(a)}</p>
                    </details>
                  ))}
                </Box>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (support.trim().length < 5) return;
                    if (demo) {
                      setNote(
                        tr("طلب المساعدة اتجهّز في المعاينة فقط، وماتبعتش للدعم."),
                      );
                      setSupport("");
                    } else {
                      try {
                        await p.onSupport(support.trim());
                        setNote(tr("رسالتك وصلت للدعم."));
                        setSupport("");
                      } catch {
                        /* parent error */
                      }
                    }
                  }}
                >
                  <Box>
                    <h2>{tr("لسه محتاج مساعدة؟")}</h2>
                    <label className="w-field">
                      {tr("قولنا نساعدك إزاي؟")}<textarea
                        minLength={5}
                        maxLength={4000}
                        value={support}
                        onChange={(e) => setSupport(e.target.value)}
                        placeholder={tr("اكتب تفاصيل المشكلة، من غير كلمات مرور أو أكواد تحقق.")}
                      />
                    </label>
                    <button
                      className="d-primary b-primary"
                      disabled={
                        p.busy ||
                        support.trim().length < 5 ||
                        (!demo && !p.signedIn)
                      }
                    >
                      {demo
                        ? tr("معاينة طلب المساعدة")
                        : p.busy
                          ? tr("جاري الإرسال…")
                          : tr("ابعت للدعم")}
                    </button>
                    {!demo && !p.signedIn && (
                      <p>{tr("سجّل دخولك عشان تبعت طلب للدعم.")}</p>
                    )}
                  </Box>
                </form>
              </>
            )}
          </>
        )}
        <p className="w-footnote">{tr("معاك في السِكّة")}</p>
      </main>
    </div>
  );
}
