import LiveAdminOverview from './LiveAdminOverview';
import {usePreferences} from "./preferences";
import {readPreviewBookings, previewSubscriberRows, previewSecurityTransactions} from "./previewBookingStore";
import {translate} from "./translations";
import { useState } from "react";
import { Wordmark, type Appearance } from "./Onboarding";
import { internalScreen, publicScreen, screenTitle } from "./screenMap";
import "./admin.css";
export const adminScreens = Array.from({ length: 12 }, (_, i) =>
  internalScreen(i + 62),
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
  const {language}=usePreferences();
  const tr=(text:string)=>translate(text,language);
  const demo = new URLSearchParams(location.search).get("preview") === "phase8",
    n = publicScreen(p.screen) + 1;
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
  // Read the same session-only booking/security snapshot as rider, captain and wallet.
  // Never blend these records with illustrative fixed examples once a booking exists.
  const ledger = demo ? readPreviewBookings() : null;
  const shared = ledger && ledger.bookings.length > 0 ? ledger : null;
  const money = (value: number) =>
    language === "en" ? `EGP ${value.toLocaleString("en-GB")}` : `${value.toLocaleString("en-US")} ج.م`;
  const itemsFor = (id: number): Item[] => {
    if (!shared) return data[id] || [];
    if (id === 69) {
      return previewSubscriberRows(shared).map(b => ({
        id: String(b.id),
        name: `${tr("راكب المعاينة")} · ${tr(b.origin)} ← ${tr(b.destination)}`,
        detail: `${tr("البداية")} ${b.starts_on} · ${tr("نهاية الدورة")} ${b.ends_before} · ${tr("الراكب:")} ${b.rider_paid_at ? tr("تم الدفع") : tr("انتظار الدفع")} · ${tr("الكابتن:")} ${b.captain_received_at ? tr("تم الاستلام") : tr("انتظار الاستلام")}`,
        status: b.security_state === "released" ? "الدفع مؤكد" : "حجز مؤكد",
        value: money(Number(b.price)),
      }));
    }
    if (id === 70) {
      const total = shared.available + shared.reserved;
      return [{
        id: "PREVIEW-WALLET",
        name: tr("محفظة الراكب التجريبية"),
        detail: `${tr("الرصيد المتاح")} ${money(shared.available)} · ${tr("التأمين المحجوز")} ${money(shared.reserved)}`,
        status: shared.reserved > 0 ? "تأمين محجوز" : "التأمين متاح",
        value: money(total),
      }];
    }
    if (id === 71) {
      return previewSecurityTransactions(shared).map(t => ({
        id: String(t.id),
        name: t.kind === "reserve" ? "حجز تأمين جدية الحجز" : "تحرير تأمين جدية الحجز",
        detail: `${tr("راكب المعاينة")} · ${String(t.id).replace(/-(reserve|release)$/, "")} · ${String(t.created_at).slice(0, 10)}`,
        status: "مكتملة",
        value: money(100),
      }));
    }
    return data[id] || [];
  };
  const allowed = role === "الكل" || role === required(n),
    items = empty ? [] : itemsFor(n),
    filtered = items.filter(
      (i) =>
        (!filter || i.status === filter) &&
        `${i.id} ${tr(i.name)} ${tr(i.detail)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
    );
  function nav(id: number) {
    setSelected(null);
    setDecision("");
    setReason("");
    setQuery("");
    setFilter("");
    setNote("");
    setMessagePreview(false);
    p.go(internalScreen(id - 1));
  }
  function record(text: string) {
    setAudit((a) => [
      `${new Date().toLocaleTimeString(language==="en"?"en-GB":"ar-EG")} · ${text}`,
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
    record(`${selected.id} · ${tr(decision)} · ${reason.trim()}`);
    setSelected(null);
    setDecision("");
    setReason("");
  }
  if(!demo&&n===63)return <div className={`admin-stage ${p.theme}`}><LiveAdminOverview/><button type="button" onClick={()=>p.go(64)}>{tr("قائمة المستخدمين")}</button></div>;
  return (
    <div className={`admin-stage ${p.theme}`} >
      <header className="ad-top">
        <div className="ad-brand">
          <Wordmark />
          <span>{tr("لوحة الإدارة")}</span>
        </div>
        <div className="ad-themes">
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
      </header>
      {!demo ? (
        <main className="ad-content">
          <h1>{screenTitle(p.screen,language)}</h1>
          <section className="ad-card">
            <h2>{tr("دخول الإدارة محمي")}</h2>
            <p>
              {tr("واجهة الإدارة الجديدة متاحة للمعاينة فقط حاليًا. ربط الإجراءات الحقيقية بصلاحيات الإدارة ومراجعة الأمان لسه مطلوب قبل التفعيل.")}</p>
            <button onClick={() => p.go(4)}>{tr("الرجوع لتسجيل الدخول")}</button>
          </section>
        </main>
      ) : (
        <>
          <p className="ad-notice">
            {tr("معاينة المرحلة الثامنة · بيانات توضيحية فقط · لا توجد إجراءات أو رسائل حقيقية")}</p>
          <div className="ad-layout">
            <aside className="ad-sidebar">
              <p>{tr("إدارة المنصة")}</p>
              <nav aria-label={tr("شاشات الإدارة")}>
                {adminScreens.map((s) => (
                  <button
                    key={s}
                    aria-current={s === p.screen ? "page" : undefined}
                    onClick={() => nav(publicScreen(s) + 1)}
                  >
                    <span className="ad-number">{publicScreen(s)}</span>
                    {screenTitle(s,language)}
                  </button>
                ))}
              </nav>
            </aside>
            <main className="ad-content">
              <div className="ad-heading">
                <div>
                  <span className="ad-eyebrow">{tr("سِكّة / الإدارة /")}{publicScreen(p.screen)}</span>
                  <h1>{screenTitle(p.screen,language)}</h1>
                  <p>{tr(intro[n])}</p>
                </div>
                <span className="ad-tag">{tr("معاينة")}</span>
              </div>
              <div className="ad-tools">
                <label>
                  {tr("محاكاة صلاحية")}<select
                    aria-label={tr("محاكاة صلاحية")}
                    value={role}
                    onChange={(e) => {
                      setRole(e.target.value);
                      setSelected(null);
                    }}
                  >
                    {permissions.map((r) => (
                      <option key={r} value={r}>{tr(r)}</option>
                    ))}
                  </select>
                </label>
                <label className="ad-check">
                  <input
                    type="checkbox"
                    checked={empty}
                    onChange={(e) => setEmpty(e.target.checked)}
                  />
                  {tr("عرض الحالة الفارغة")}</label>
                <span>{shared ? tr("حجوزات المعاينة موحّدة مع حساب الراكب والكابتن والمحفظة") : tr("البيانات تتصفّر عند إعادة التحميل")}</span>
              </div>
              {note && (
                <p className="ad-feedback" role="status">
                  {tr(note)}
                </p>
              )}
              {!allowed ? (
                <section className="ad-card">
                  <h2>{tr("الصلاحية غير متاحة في المعاينة")}</h2>
                  <p>
                    {tr("القسم ده يحتاج صلاحية")}{tr(required(n))}{tr(". الاختيار هنا يحاكي الواجهة فقط ولا يمنح صلاحيات فعلية.")}</p>
                <button onClick={() => setRole(required(n))}>{language==="en" ? "Preview with required permission" : "جرّب الصلاحية المطلوبة في المعاينة"}</button>
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
                          const rows = empty ? [] : itemsFor(Number(id));
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
                              <span>{tr(String(label))}</span>
                              <b>{count}</b>
                              <small>{tr("عرض التفاصيل ←")}</small>
                            </button>
                          );
                        })}
                      </div>
                      <div className="ad-columns">
                        <section className="ad-card">
                          <h2>{tr("محتاج مراجعتك")}</h2>
                          <p>
                            {tr("راجع طلبات التوثيق والتذاكر المفتوحة قبل اتخاذ أي إجراء.")}</p>
                          <button
                            className="ad-primary"
                            onClick={() => nav(66)}
                          >
                            {tr("مراجعة المستندات")}</button>
                          <button onClick={() => nav(72)}>
                            {tr("الشكاوى والدعم")}</button>
                        </section>
                        <section className="ad-card">
                          <h2>{tr("تعريف المؤشرات")}</h2>
                          <p>
                            {tr("الأعداد محسوبة من سجلات المعاينة الحالية. الكباتن: المعتمدون فقط. العروض: النشطة فقط. التأمينات: المحجوزة ولم تتحرر.")}</p>
                          <p>{tr("آخر تحديث: عند فتح المعاينة أو تعديل سجل محلي.")}</p>
                          <span className="ad-tag">
                            {tr("الأموال الحقيقية غير مفعّلة")}</span>
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
                          <p>{seats} {tr("مقاعد")}</p>
                          <small>
                            {Number(seats) < 5 ? tr("سيارة ركوب") : tr("هاي آس")}
                          </small>
                        </section>
                      ))}
                    </div>
                  )}
                  {n >= 64 && n <= 72 && (
                    <section className="ad-card">
                      <div className="ad-list-head">
                        <h2>
                          {tr("السجلات")}<small>({filtered.length})</small>
                        </h2>
                        <div className="ad-filters">
                          <label>
                            {tr("بحث")}<input
                              aria-label={tr("بحث السجلات")}
                              placeholder={tr("الاسم أو المرجع أو الخط")}
                              value={query}
                              onChange={(e) => setQuery(e.target.value)}
                            />
                          </label>
                          <label>
                            {tr("الحالة")}<select
                              aria-label={tr("تصفية الحالة")}
                              value={filter}
                              onChange={(e) => setFilter(e.target.value)}
                            >
                              <option value="">{tr("الكل")}</option>
                              {[...new Set(items.map((i) => i.status))].map(
                                (s) => (
                                  <option key={s} value={s}>{tr(s)}</option>
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
                              <th>{tr("المرجع")}</th>
                              <th>{tr("البيانات")}</th>
                              <th>{tr("الحالة")}</th>
                              <th>{tr("الإجراء")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map((i) => (
                              <tr key={i.id}>
                                <td dir="ltr">{i.id}</td>
                                <td>
                                  <strong>{tr(i.name)}</strong>
                                  <p>{tr(i.detail)}</p>
                                  {i.value && <b>{tr(i.value)}</b>}
                                </td>
                                <td>
                                  <span className="ad-tag">{tr(i.status)}</span>
                                </td>
                                <td>
                                  <button
                                    onClick={() => {
                                      setSelected(i);
                                      setDecision("");
                                      setReason("");
                                    }}
                                  >
                                    {tr("عرض التفاصيل")}</button>
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
                              ? tr("مفيش نتائج مطابقة")
                              : tr("لسه مفيش سجلات")}
                          </h2>
                          <p>{tr("جرّب تغيير البحث أو التصفية.")}</p>
                          <button
                            onClick={() => {
                              setQuery("");
                              setFilter("");
                              setEmpty(false);
                            }}
                          >
                            {tr("مسح الفلاتر")}</button>
                        </div>
                      )}
                    </section>
                  )}
                  {selected && n >= 64 && n <= 72 && (
                    <section
                      className="ad-card ad-detail"
                      aria-label={tr("تفاصيل السجل")}
                    >
                      <button
                        className="ad-close"
                        onClick={() => setSelected(null)}
                      >
                        {tr("إغلاق التفاصيل ×")}</button>
                      <h2>{tr(selected.name)}</h2>
                      <span className="ad-tag">{selected.id}</span>
                      <p>{tr(selected.detail)}</p>
                      {selected.value && <h3>{tr(selected.value)}</h3>}
                      {n === 66 && (
                        <div className="ad-document">
                          <span>▤</span>
                          <h3>{tr("مساحة معاينة المستند")}</h3>
                          <p>
                            {tr("لا توجد وثيقة حقيقية هنا. المستندات الفعلية تتطلب صلاحية التوثيق ورابطًا خاصًا مؤقتًا.")}</p>
                        </div>
                      )}
                      {n === 69 && (
                        <p>
                          {tr("شروط الحجز والسعر المسجل لا تتغير بتعديل العرض. لا توجد موافقة يدوية جديدة على الحجز المؤكد.")}</p>
                      )}
                      {(n === 70 || n === 71) && (
                        <p>
                          {tr("لا يوجد تحرير تأمين أو تحويل أو سحب يدوي في هذه المعاينة. مراجعة العملية لا تعني تنفيذها.")}</p>
                      )}
                      {![69, 70, 71].includes(n) && (
                        <>
                          <label>
                            {tr("قرار المعاينة")}<select
                              aria-label={tr("قرار المعاينة")}
                              value={decision}
                              onChange={(e) => setDecision(e.target.value)}
                            >
                              <option value="">{tr("اختار إجراء")}</option>
                              {(n === 64
                                ? ["نشط", "موقوف"]
                                : n === 68
                                  ? ["نشط", "موقوف"]
                                  : n === 72
                                    ? ["قيد المتابعة", "مصعّدة للمالية", "مغلقة"]
                                    : ["معتمد", "مطلوب تعديل", "مرفوض"]
                              ).map((v) => (
                                <option key={v} value={v}>{tr(v)}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            {tr("سبب الإجراء")}<textarea
                              aria-label={tr("سبب الإجراء")}
                              minLength={5}
                              maxLength={1000}
                              value={reason}
                              onChange={(e) => setReason(e.target.value)}
                              placeholder={tr("اكتب سببًا واضحًا للمراجعة")}
                            />
                          </label>
                          <p>
                            {tr("التغيير هيتم على السجل التوضيحي فقط، مع إضافته لسجل المعاينة.")}</p>
                          <button
                            className="ad-primary"
                            disabled={!decision || reason.trim().length < 5}
                            onClick={apply}
                          >
                            {tr("تأكيد التغيير في المعاينة")}</button>
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
                        <h2>{tr("رسالة جديدة")}</h2>
                        <label>
                          {tr("عنوان الرسالة")}<input
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
                          {tr("المحتوى")}<textarea
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
                          {tr("الجمهور")}<select
                            value={tr(audience)}
                            onChange={(e) => {
                              setAudience(e.target.value);
                              setMessagePreview(false);
                            }}
                          >
                            {["الركاب", "الكباتن", "الجميع"].map((v) => (
                              <option key={v} value={v}>{tr(v)}</option>
                            ))}
                          </select>
                        </label>
                        <button
                          className="ad-primary"
                          disabled={!title.trim() || !body.trim()}
                        >
                          {tr("معاينة الرسالة")}</button>
                      </form>
                      <section className="ad-card">
                        <h2>{tr("معاينة قبل الإرسال")}</h2>
                        {messagePreview ? (
                          <>
                            <span className="ad-tag">{tr("إلى:")}{tr(audience)}</span>
                            <h3>{title}</h3>
                            <p className="ad-message">{body}</p>
                            <button
                              onClick={() => {
                                record(
                                  language==="en" ? `Saved notification draft for ${tr(audience)}: ${title}` : `حفظ مسودة إشعار إلى ${tr(audience)}: ${title}`,
                                );
                                setMessagePreview(false);
                              }}
                            >
                              {tr("حفظ مسودة في المعاينة")}</button>
                          </>
                        ) : (
                          <p>{tr("اكتب الرسالة واضغط معاينة.")}</p>
                        )}
                        <button disabled>{tr("الإرسال الجماعي غير مفعّل")}</button>
                        <p>
                          {tr("لا يتم إرسال إشعارات حقيقية أو مشاركة بيانات المستخدمين.")}</p>
                      </section>
                    </div>
                  )}
                  {n === 74 && (
                    <div className="ad-columns">
                      <section className="ad-card">
                        <h2>{tr("قواعد التشغيل المعتمدة")}</h2>
                        <dl>
                          <dt>{tr("نطاق الخدمة")}</dt>
                          <dd>{tr("القاهرة والجيزة")}</dd>
                          <dt>{tr("تأمين جدية الحجز")}</dt>
                          <dd>{tr("100 جنيه مستردة")}</dd>
                          <dt>{tr("الحد الأدنى للشحن")}</dt>
                          <dd>{tr("100 جنيه")}</dd>
                          <dt>{tr("أيام التشغيل")}</dt>
                          <dd>{tr("الأحد–الخميس باستثناء الإجازات الرسمية")}</dd>
                        </dl>
                        <button disabled>{tr("تعديل القواعد المالية غير مفعّل")}</button>
                      </section>
                      <section className="ad-card">
                        <h2>{tr("الصلاحيات")}</h2>
                        <p>
                          {tr("التوثيق · التشغيل · المالية · الدعم · إدارة النظام")}</p>
                        <p>
                          {tr("اختيار الصلاحية أعلى الصفحة مجرد محاكاة. لا يغيّر أدوار الحسابات.")}</p>
                        <button disabled>{tr("منح صلاحيات حقيقية غير مفعّل")}</button>
                        <h2>{tr("مظهر اللوحة")}</h2>
                        <div className="ad-themes">
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
                      </section>
                    </div>
                  )}
                  {(n === 74 || audit.length > 0) && (
                    <section className="ad-card">
                      <h2>{tr("سجل إجراءات المعاينة")}</h2>
                      {audit.length ? (
                        <ol className="ad-audit">
                          {audit.map((a, i) => (
                            <li key={i}>{a}</li>
                          ))}
                        </ol>
                      ) : (
                        <p>
                          {tr("لسه مفيش إجراءات. السجل ده محلي ومش بديل لسجل التدقيق الحقيقي.")}</p>
                      )}
                    </section>
                  )}
                </>
              )}
              <footer>{tr("سِكّة — معاك في السِكّة")}</footer>
            </main>
          </div>
        </>
      )}
    </div>
  );
}
