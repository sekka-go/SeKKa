import { useState } from "react";
import { Wordmark, type Appearance } from "./Onboarding";
import { internalScreen, publicScreen, screenTitle } from "./screenMap";
import "./admin.css";
export const adminScreens = Array.from({ length: 12 }, (_, i) =>
  internalScreen(i + 63),
);
type Item = {
  id: string;
  name: string;
  detail: string;
  status: string;
  value?: string;
};
const seed: Record<number, Item[]> = {
  64: [
    {
      id: "U-101",
      name: "أحمد محمد",
      detail: "راكب · انضم 10 نوفمبر 2026",
      status: "نشط",
    },
    {
      id: "U-102",
      name: "مريم علي",
      detail: "راكب · انضمت 12 نوفمبر 2026",
      status: "نشط",
    },
  ],
  65: [
    {
      id: "C-201",
      name: "مصطفى حسن",
      detail: "تويوتا كورولا · PRIME · خط واحد",
      status: "قيد المراجعة",
    },
    {
      id: "C-202",
      name: "كريم علي",
      detail: "هاي آس · SPACE · خطان",
      status: "معتمد",
    },
  ],
  66: [
    {
      id: "D-301",
      name: "رخصة القيادة — مصطفى حسن",
      detail: "نموذج توضيحي؛ لا توجد وثيقة هوية حقيقية",
      status: "قيد المراجعة",
    },
    {
      id: "D-302",
      name: "رخصة العربية — كريم علي",
      detail: "نموذج توضيحي؛ لا توجد وثيقة هوية حقيقية",
      status: "مطلوب تعديل",
    },
  ],
  67: [
    {
      id: "V-401",
      name: "تويوتا كورولا",
      detail: "PRIME · 3 مقاعد · مصطفى حسن",
      status: "قيد المراجعة",
    },
    {
      id: "V-402",
      name: "هاي آس",
      detail: "SPACE · 9 مقاعد · كريم علي",
      status: "معتمد",
    },
  ],
  68: [
    {
      id: "R-501",
      name: "المعادي ← التجمع",
      detail: "مصطفى حسن · PRIME · 07:30 / 17:00 · شهري · ذهاب وعودة",
      status: "نشط",
      value: "2,800 ج.م",
    },
    {
      id: "R-502",
      name: "الزمالك ← الشيخ زايد",
      detail: "كريم علي · SPACE · 08:00 · أسبوعي · ذهاب فقط",
      status: "موقوف",
      value: "850 ج.م",
    },
  ],
  69: [
    {
      id: "B-601",
      name: "أحمد محمد · المعادي ← التجمع",
      detail:
        "البداية 15 نوفمبر · السعر مثبت وقت الحجز · الراكب: تم الدفع · الكابتن: انتظار الاستلام",
      status: "حجز مؤكد",
      value: "2,800 ج.م",
    },
    {
      id: "B-602",
      name: "مريم علي · الزمالك ← الشيخ زايد",
      detail: "البداية 16 نوفمبر · السعر مثبت وقت الحجز · الدفع: تأكيد الطرفين",
      status: "الدفع مؤكد",
      value: "850 ج.م",
    },
  ],
  70: [
    {
      id: "W-701",
      name: "أحمد محمد",
      detail: "متاح 100 · تأمين جدية الحجز 100 · الإجمالي 200 ج.م",
      status: "تأمين محجوز",
      value: "200 ج.م",
    },
    {
      id: "W-702",
      name: "مريم علي",
      detail: "متاح 200 · تأمين جدية الحجز 0 · الإجمالي 200 ج.م",
      status: "التأمين متاح",
      value: "200 ج.م",
    },
  ],
  71: [
    {
      id: "T-801",
      name: "حجز تأمين جدية الحجز",
      detail: "أحمد محمد · B-601 · حركة داخل المحفظة",
      status: "مكتملة",
      value: "100 ج.م",
    },
    {
      id: "T-802",
      name: "طلب سحب رصيد",
      detail: "مريم علي · مرجع توضيحي · لا يوجد تحويل فعلي",
      status: "قيد المراجعة",
      value: "100 ج.م",
    },
  ],
  72: [
    {
      id: "S-901",
      name: "اختلاف في تأكيد الدفع",
      detail: "أحمد محمد · B-601 · أولوية عالية",
      status: "مفتوحة",
    },
    {
      id: "S-902",
      name: "طلب تحديث بيانات العربية",
      detail: "كريم علي · أولوية عادية",
      status: "قيد المتابعة",
    },
  ],
  73: [],
  74: [],
};
const intro: Record<number, string> = {
  63: "صورة واضحة لتشغيل سِكّة، من توثيق الكباتن لحد متابعة الاشتراكات.",
  64: "إدارة حسابات الركاب ومراجعة حالتهم.",
  65: "متابعة التوثيق والعربيات والخطوط المرتبطة بكل كابتن.",
  66: "راجع التطابق والوضوح قبل اتخاذ قرار التوثيق.",
  67: "الفئة والسعة لازم يتوافقوا مع قواعد سِكّة.",
  68: "متابعة العروض المنشورة؛ إيقاف العرض يمنع الحجوزات الجديدة فقط.",
  69: "تابع الحجز وإقرارات الدفع مع الحفاظ على السعر المثبت.",
  70: "الرصيد المتاح منفصل عن تأمين جدية الحجز المسترد.",
  71: "حركة محفظة سِكّة؛ مدفوعات الكباتن المباشرة مش إيداعات هنا.",
  72: "متابعة التذاكر وتصعيد نزاعات الدفع بسجل واضح.",
  73: "جهّز الرسالة وراجع الجمهور قبل أي إرسال.",
  74: "إدارة صلاحيات الفريق وإعدادات التشغيل وسجل التدقيق.",
};
const permissions = [
  "الكل",
  "التوثيق",
  "التشغيل",
  "المالية",
  "الدعم",
  "إدارة النظام",
];
const required = (n: number) =>
  n <= 63
    ? "الكل"
    : n <= 67
      ? "التوثيق"
      : n === 68 || n === 69
        ? "التشغيل"
        : n <= 71
          ? "المالية"
          : n === 72
            ? "الدعم"
            : "إدارة النظام";
export default function AdminDashboard(p: {
  screen: number;
  theme: Appearance;
  onTheme: (v: Appearance) => void;
  go: (v: number) => void;
}) {
  const demo = new URLSearchParams(location.search).get("preview") === "phase8",
    n = publicScreen(p.screen);
  const [data, setData] = useState(seed),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState(""),
    [empty, setEmpty] = useState(false),
    [role, setRole] = useState("الكل"),
    [selected, setSelected] = useState<Item | null>(null),
    [decision, setDecision] = useState(""),
    [reason, setReason] = useState(""),
    [note, setNote] = useState(""),
    [audit, setAudit] = useState<string[]>([]),
    [title, setTitle] = useState(""),
    [body, setBody] = useState(""),
    [audience, setAudience] = useState("الركاب"),
    [messagePreview, setMessagePreview] = useState(false);
  const allowed = role === "الكل" || role === required(n),
    items = empty ? [] : data[n] || [],
    filtered = items.filter(
      (i) =>
        (!filter || i.status === filter) &&
        `${i.id} ${i.name} ${i.detail}`.includes(query.trim()),
    );
  function nav(id: number) {
    setSelected(null);
    setDecision("");
    setReason("");
    setQuery("");
    setFilter("");
    setNote("");
    setMessagePreview(false);
    p.go(internalScreen(id));
  }
  function record(text: string) {
    setAudit((a) => [
      `${new Date().toLocaleTimeString("ar-EG")} · ${text}`,
      ...a,
    ]);
    setNote("اتحفظ في المعاينة فقط؛ لم يتغير أي حساب حقيقي.");
  }
  function apply() {
    if (!selected || reason.trim().length < 5) return;
    setData((d) => ({
      ...d,
      [n]: (d[n] || []).map((i) =>
        i.id === selected.id ? { ...i, status: decision } : i,
      ),
    }));
    record(`${selected.id} · ${decision} · ${reason.trim()}`);
    setSelected(null);
    setDecision("");
    setReason("");
  }
  return (
    <div className={`admin-stage ${p.theme}`} dir="rtl">
      <header className="ad-top">
        <div className="ad-brand">
          <Wordmark />
          <span>لوحة الإدارة</span>
        </div>
        <div className="ad-themes">
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
      </header>
      {!demo ? (
        <main className="ad-content">
          <h1>{screenTitle(p.screen)}</h1>
          <section className="ad-card">
            <h2>دخول الإدارة محمي</h2>
            <p>
              واجهة الإدارة الجديدة متاحة للمعاينة فقط حاليًا. ربط الإجراءات
              الحقيقية بصلاحيات الإدارة ومراجعة الأمان لسه مطلوب قبل التفعيل.
            </p>
            <button onClick={() => p.go(4)}>الرجوع لتسجيل الدخول</button>
          </section>
        </main>
      ) : (
        <>
          <p className="ad-notice">
            معاينة المرحلة الثامنة · بيانات توضيحية فقط · لا توجد إجراءات أو
            رسائل حقيقية
          </p>
          <div className="ad-layout">
            <aside className="ad-sidebar">
              <p>إدارة المنصة</p>
              <nav aria-label="شاشات الإدارة">
                {adminScreens.map((s) => (
                  <button
                    key={s}
                    aria-current={s === p.screen ? "page" : undefined}
                    onClick={() => nav(publicScreen(s))}
                  >
                    <span className="ad-number">{publicScreen(s)}</span>
                    {screenTitle(s)}
                  </button>
                ))}
              </nav>
            </aside>
            <main className="ad-content">
              <div className="ad-heading">
                <div>
                  <span className="ad-eyebrow">سِكّة / الإدارة / {n}</span>
                  <h1>{screenTitle(p.screen)}</h1>
                  <p>{intro[n]}</p>
                </div>
                <span className="ad-tag">معاينة</span>
              </div>
              <div className="ad-tools">
                <label>
                  محاكاة صلاحية
                  <select
                    aria-label="محاكاة صلاحية"
                    value={role}
                    onChange={(e) => {
                      setRole(e.target.value);
                      setSelected(null);
                    }}
                  >
                    {permissions.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </label>
                <label className="ad-check">
                  <input
                    type="checkbox"
                    checked={empty}
                    onChange={(e) => setEmpty(e.target.checked)}
                  />
                  عرض الحالة الفارغة
                </label>
                <span>البيانات تتصفّر عند إعادة التحميل</span>
              </div>
              {note && (
                <p className="ad-feedback" role="status">
                  {note}
                </p>
              )}
              {!allowed ? (
                <section className="ad-card">
                  <h2>الصلاحية غير متاحة في المعاينة</h2>
                  <p>
                    القسم ده يحتاج صلاحية {required(n)}. الاختيار هنا يحاكي
                    الواجهة فقط ولا يمنح صلاحيات فعلية.
                  </p>
                </section>
              ) : (
                <>
                  {n === 63 && (
                    <>
                      <div className="ad-metrics">
                        {[
                          ["حسابات الركاب", 64],
                          ["كباتن معتمدون", 65],
                          ["عروض نشطة", 68],
                          ["حجوزات مثبتة", 69],
                          ["تأمينات معلّقة", 70],
                        ].map(([label, id]) => {
                          const rows = empty ? [] : data[Number(id)];
                          const count =
                            Number(id) === 65
                              ? rows.filter((i) => i.status === "معتمد").length
                              : Number(id) === 68
                                ? rows.filter((i) => i.status === "نشط").length
                                : Number(id) === 70
                                  ? rows.filter(
                                      (i) => i.status === "تأمين محجوز",
                                    ).length
                                  : rows.length;
                          return (
                            <button key={label} onClick={() => nav(Number(id))}>
                              <span>{label}</span>
                              <b>{count}</b>
                              <small>عرض التفاصيل ←</small>
                            </button>
                          );
                        })}
                      </div>
                      <div className="ad-columns">
                        <section className="ad-card">
                          <h2>محتاج مراجعتك</h2>
                          <p>
                            راجع طلبات التوثيق والتذاكر المفتوحة قبل اتخاذ أي
                            إجراء.
                          </p>
                          <button
                            className="ad-primary"
                            onClick={() => nav(66)}
                          >
                            مراجعة المستندات
                          </button>
                          <button onClick={() => nav(72)}>
                            الشكاوى والدعم
                          </button>
                        </section>
                        <section className="ad-card">
                          <h2>تعريف المؤشرات</h2>
                          <p>
                            الأعداد محسوبة من سجلات المعاينة الحالية. الكباتن:
                            المعتمدون فقط. العروض: النشطة فقط. التأمينات:
                            المحجوزة ولم تتحرر.
                          </p>
                          <p>آخر تحديث: عند فتح المعاينة أو تعديل سجل محلي.</p>
                          <span className="ad-tag">
                            الأموال الحقيقية غير مفعّلة
                          </span>
                        </section>
                      </div>
                    </>
                  )}
                  {n === 67 && (
                    <div className="ad-categories">
                      {[
                        ["PRIME", 3],
                        ["SAVER", 4],
                        ["SPACE", 9],
                        ["MAX", 13],
                      ].map(([c, seats]) => (
                        <section className="ad-card" key={c}>
                          <b>{c}</b>
                          <p>{seats} مقاعد</p>
                          <small>
                            {Number(seats) < 5 ? "سيارة ركوب" : "هاي آس"}
                          </small>
                        </section>
                      ))}
                    </div>
                  )}
                  {n >= 64 && n <= 72 && (
                    <section className="ad-card">
                      <div className="ad-list-head">
                        <h2>
                          السجلات <small>({filtered.length})</small>
                        </h2>
                        <div className="ad-filters">
                          <label>
                            بحث
                            <input
                              aria-label="بحث السجلات"
                              placeholder="الاسم أو المرجع أو الخط"
                              value={query}
                              onChange={(e) => setQuery(e.target.value)}
                            />
                          </label>
                          <label>
                            الحالة
                            <select
                              aria-label="تصفية الحالة"
                              value={filter}
                              onChange={(e) => setFilter(e.target.value)}
                            >
                              <option value="">الكل</option>
                              {[...new Set(items.map((i) => i.status))].map(
                                (s) => (
                                  <option key={s}>{s}</option>
                                ),
                              )}
                            </select>
                          </label>
                        </div>
                      </div>
                      <div className="ad-table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>المرجع</th>
                              <th>البيانات</th>
                              <th>الحالة</th>
                              <th>الإجراء</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map((i) => (
                              <tr key={i.id}>
                                <td dir="ltr">{i.id}</td>
                                <td>
                                  <strong>{i.name}</strong>
                                  <p>{i.detail}</p>
                                  {i.value && <b>{i.value}</b>}
                                </td>
                                <td>
                                  <span className="ad-tag">{i.status}</span>
                                </td>
                                <td>
                                  <button
                                    onClick={() => {
                                      setSelected(i);
                                      setDecision("");
                                      setReason("");
                                    }}
                                  >
                                    عرض التفاصيل
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {!filtered.length && (
                        <div className="ad-empty">
                          <h2>
                            {query || filter
                              ? "مفيش نتائج مطابقة"
                              : "لسه مفيش سجلات"}
                          </h2>
                          <p>جرّب تغيير البحث أو التصفية.</p>
                          <button
                            onClick={() => {
                              setQuery("");
                              setFilter("");
                            }}
                          >
                            مسح الفلاتر
                          </button>
                        </div>
                      )}
                    </section>
                  )}
                  {selected && n >= 64 && n <= 72 && (
                    <section
                      className="ad-card ad-detail"
                      aria-label="تفاصيل السجل"
                    >
                      <button
                        className="ad-close"
                        onClick={() => setSelected(null)}
                      >
                        إغلاق التفاصيل ×
                      </button>
                      <h2>{selected.name}</h2>
                      <span className="ad-tag">{selected.id}</span>
                      <p>{selected.detail}</p>
                      {selected.value && <h3>{selected.value}</h3>}
                      {n === 66 && (
                        <div className="ad-document">
                          <span>▤</span>
                          <h3>مساحة معاينة المستند</h3>
                          <p>
                            لا توجد وثيقة حقيقية هنا. المستندات الفعلية تتطلب
                            صلاحية التوثيق ورابطًا خاصًا مؤقتًا.
                          </p>
                        </div>
                      )}
                      {n === 69 && (
                        <p>
                          شروط الحجز والسعر المسجل لا تتغير بتعديل العرض. لا
                          توجد موافقة يدوية جديدة على الحجز المؤكد.
                        </p>
                      )}
                      {(n === 70 || n === 71) && (
                        <p>
                          لا يوجد تحرير تأمين أو تحويل أو سحب يدوي في هذه
                          المعاينة. مراجعة العملية لا تعني تنفيذها.
                        </p>
                      )}
                      {![69, 70, 71].includes(n) && (
                        <>
                          <label>
                            قرار المعاينة
                            <select
                              aria-label="قرار المعاينة"
                              value={decision}
                              onChange={(e) => setDecision(e.target.value)}
                            >
                              <option value="">اختار إجراء</option>
                              {(n === 64
                                ? ["نشط", "موقوف"]
                                : n === 68
                                  ? ["نشط", "موقوف"]
                                  : n === 72
                                    ? ["قيد المتابعة", "مصعّدة للمالية", "مغلقة"]
                                    : ["معتمد", "مطلوب تعديل", "مرفوض"]
                              ).map((v) => (
                                <option key={v}>{v}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            سبب الإجراء
                            <textarea
                              aria-label="سبب الإجراء"
                              minLength={5}
                              maxLength={1000}
                              value={reason}
                              onChange={(e) => setReason(e.target.value)}
                              placeholder="اكتب سببًا واضحًا للمراجعة"
                            />
                          </label>
                          <p>
                            التغيير هيتم على السجل التوضيحي فقط، مع إضافته لسجل
                            المعاينة.
                          </p>
                          <button
                            className="ad-primary"
                            disabled={!decision || reason.trim().length < 5}
                            onClick={apply}
                          >
                            تأكيد التغيير في المعاينة
                          </button>
                        </>
                      )}
                    </section>
                  )}
                  {n === 73 && (
                    <div className="ad-columns">
                      <form
                        className="ad-card"
                        onSubmit={(e) => {
                          e.preventDefault();
                          setMessagePreview(true);
                        }}
                      >
                        <h2>رسالة جديدة</h2>
                        <label>
                          عنوان الرسالة
                          <input
                            required
                            maxLength={120}
                            value={title}
                            onChange={(e) => {
                              setTitle(e.target.value);
                              setMessagePreview(false);
                            }}
                          />
                        </label>
                        <label>
                          المحتوى
                          <textarea
                            required
                            maxLength={1000}
                            value={body}
                            onChange={(e) => {
                              setBody(e.target.value);
                              setMessagePreview(false);
                            }}
                          />
                        </label>
                        <label>
                          الجمهور
                          <select
                            value={audience}
                            onChange={(e) => {
                              setAudience(e.target.value);
                              setMessagePreview(false);
                            }}
                          >
                            {["الركاب", "الكباتن", "الجميع"].map((v) => (
                              <option key={v}>{v}</option>
                            ))}
                          </select>
                        </label>
                        <button
                          className="ad-primary"
                          disabled={!title.trim() || !body.trim()}
                        >
                          معاينة الرسالة
                        </button>
                      </form>
                      <section className="ad-card">
                        <h2>معاينة قبل الإرسال</h2>
                        {messagePreview ? (
                          <>
                            <span className="ad-tag">إلى: {audience}</span>
                            <h3>{title}</h3>
                            <p className="ad-message">{body}</p>
                            <button
                              onClick={() => {
                                record(
                                  `حفظ مسودة إشعار إلى ${audience}: ${title}`,
                                );
                                setMessagePreview(false);
                              }}
                            >
                              حفظ مسودة في المعاينة
                            </button>
                          </>
                        ) : (
                          <p>اكتب الرسالة واضغط معاينة.</p>
                        )}
                        <button disabled>الإرسال الجماعي غير مفعّل</button>
                        <p>
                          لا يتم إرسال إشعارات حقيقية أو مشاركة بيانات
                          المستخدمين.
                        </p>
                      </section>
                    </div>
                  )}
                  {n === 74 && (
                    <div className="ad-columns">
                      <section className="ad-card">
                        <h2>قواعد التشغيل المعتمدة</h2>
                        <dl>
                          <dt>نطاق الخدمة</dt>
                          <dd>القاهرة والجيزة</dd>
                          <dt>تأمين جدية الحجز</dt>
                          <dd>100 جنيه مستردة</dd>
                          <dt>الحد الأدنى للشحن</dt>
                          <dd>100 جنيه</dd>
                          <dt>أيام التشغيل</dt>
                          <dd>الأحد–الخميس باستثناء الإجازات الرسمية</dd>
                        </dl>
                        <button disabled>تعديل القواعد المالية غير مفعّل</button>
                      </section>
                      <section className="ad-card">
                        <h2>الصلاحيات</h2>
                        <p>
                          التوثيق · التشغيل · المالية · الدعم · إدارة النظام
                        </p>
                        <p>
                          اختيار الصلاحية أعلى الصفحة مجرد محاكاة. لا يغيّر أدوار
                          الحسابات.
                        </p>
                        <button disabled>منح صلاحيات حقيقية غير مفعّل</button>
                        <h2>مظهر اللوحة</h2>
                        <div className="ad-themes">
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
                      </section>
                    </div>
                  )}
                  {(n === 74 || audit.length > 0) && (
                    <section className="ad-card">
                      <h2>سجل إجراءات المعاينة</h2>
                      {audit.length ? (
                        <ol className="ad-audit">
                          {audit.map((a, i) => (
                            <li key={i}>{a}</li>
                          ))}
                        </ol>
                      ) : (
                        <p>
                          لسه مفيش إجراءات. السجل ده محلي ومش بديل لسجل التدقيق
                          الحقيقي.
                        </p>
                      )}
                    </section>
                  )}
                </>
              )}
              <footer>سِكّة — معاك في السِكّة</footer>
            </main>
          </div>
        </>
      )}
    </div>
  );
}
