import { useState } from "react";
import { Wordmark, type Appearance } from "./Onboarding";
import { DiscoveryIcon } from "./Discovery";
import type { Profile } from "./api";
import "./booking.css";
import "./wallet.css";
import "./captain.css";
export const captainOnboardingScreens = [37, 38, 39, 40, 41, 42, 43];
const titles = [
  "أهلًا بيك يا كابتن",
  "بيانات الكابتن",
  "مستندات الكابتن",
  "بيانات العربية",
  "مستندات العربية",
  "راجع طلبك",
  "حالة الطلب",
];
const capacities = { PRIME: 3, SAVER: 4, SPACE: 9, MAX: 13 };
const documentNames = {
  identity: "إثبات الهوية",
  driving_license: "رخصة القيادة",
  vehicle_license: "رخصة العربية",
  vehicle_photo: "صورة العربية",
};
type DocKind = keyof typeof documentNames;
export default function CaptainOnboarding(p: {
  screen: number;
  theme: Appearance;
  onTheme: (v: Appearance) => void;
  go: (n: number) => void;
  profile: Profile | null;
  signedIn: boolean;
  rows: Record<string, unknown>[];
  busy: boolean;
  error: string;
  onRefresh: () => void;
}) {
  const demo = new URLSearchParams(location.search).get("preview") === "phase6";
  const [name, setName] = useState("");
  const [experience, setExperience] = useState("");
  const [model, setModel] = useState("");
  const [plate, setPlate] = useState("");
  const [category, setCategory] = useState<keyof typeof capacities>("PRIME");
  const [docs, setDocs] = useState<Partial<Record<DocKind, string>>>({});
  const [note, setNote] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const nav = (n: number) => {
    setNote("");
    p.go(n);
  };
  const complete =
    name.trim().length >= 2 &&
    model.trim().length >= 2 &&
    plate.trim().length >= 3 &&
    Object.keys(docs).length === 4;
  const blocked = !demo && (!p.signedIn || p.profile?.role !== "captain");
  const actual = p.rows.find((r) => r.kind === "captain");
  const statusLabels: Record<string, string> = {
    pending: "طلبك قيد المراجعة",
    approved: "تم اعتماد بيانات الكابتن",
    changes_requested: "طلبك محتاج تعديل",
    rejected: "الطلب لم يُعتمد",
    suspended: "حساب الكابتن موقوف",
  };
  function files(kinds: DocKind[]) {
    return (
      <>
        {kinds.map((kind) => (
          <section className="d-box b-box c-document" key={kind}>
            <h2>{documentNames[kind]}</h2>
            <label className="w-field">
              <span>اختار ملف للمعاينة — {documentNames[kind]}</span>
              <input
                disabled={!demo}
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setSubmitted(false);
                  if (
                    !["image/jpeg", "image/png", "application/pdf"].includes(
                      file.type,
                    ) ||
                    file.size > 5 * 1024 * 1024 ||
                    file.size === 0
                  ) {
                    setNote(
                      "اختار صورة JPG أو PNG أو ملف PDF، بحجم أكبر من صفر ولحد 5 ميجا.",
                    );
                    e.target.value = "";
                    return;
                  }
                  setDocs((d) => ({ ...d, [kind]: file.name }));
                  setNote("الملف اتحدد على جهازك فقط. مفيش رفع أو إرسال.");
                }}
              />
            </label>
            {docs[kind] && (
              <p className="c-filename">
                {docs[kind]}{" "}
                <button
                  className="w-link"
                  onClick={() => {
                    setDocs((d) => {
                      const next = { ...d };
                      delete next[kind];
                      return next;
                    });
                    setSubmitted(false);
                  }}
                >
                  إزالة الاختيار
                </button>
              </p>
            )}
          </section>
        ))}
        <p>
          استخدم ملفات تجريبية. الاختيار مش بيرفع الملف، وبيتمسح لما تقفل أو
          تحدّث الصفحة.
        </p>
        <button
          className="d-primary b-primary"
          disabled={!demo || kinds.some((k) => !docs[k])}
          onClick={() => nav(p.screen + 1)}
        >
          متابعة <DiscoveryIcon name="arrow" />
        </button>
      </>
    );
  }
  return (
    <div
      className={`phase-one-stage discovery-stage booking-stage captain-stage ${p.theme}`}
    >
      <nav className="phase-review-bar" aria-label="معاينة المرحلة السادسة">
        <div className="review-screen-nav">
          <button
            aria-label="الشاشة السابقة"
            disabled={p.screen === 37}
            onClick={() => nav(p.screen - 1)}
          >
            ‹
          </button>
          <select
            aria-label="شاشة المرحلة السادسة"
            value={p.screen}
            onChange={(e) => nav(+e.target.value)}
          >
            {captainOnboardingScreens.map((n, i) => (
              <option key={n} value={n}>
                {n} · {titles[i]}
              </option>
            ))}
          </select>
          <button
            aria-label="الشاشة التالية"
            disabled={p.screen === 43}
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
      {demo && (
        <p className="w-preview">
          معاينة المرحلة السادسة · 7 شاشات · مفيش إرسال طلبات أو مستندات حقيقية
        </p>
      )}
      <main className="phase-canvas d-canvas b-canvas c-canvas">
        <header className="d-header">
          <button
            className="phase-back"
            aria-label="رجوع"
            onClick={() => nav(p.screen === 37 ? 3 : p.screen - 1)}
          >
            <DiscoveryIcon name="back" />
          </button>
          <Wordmark />
        </header>
        <div className="b-stage-label">
          انضم لسِكّة <span dir="ltr">{p.screen - 36} / 7</span>
        </div>
        <h1 className="b-title">{titles[p.screen - 37]}</h1>
        {p.error && (
          <div role="alert">
            <p>{p.error}</p>
            <button className="w-link" onClick={p.onRefresh}>
              حاول تاني
            </button>
          </div>
        )}
        {p.busy && <p role="status">بنحمّل بيانات طلبك…</p>}
        {note && (
          <p role="status" className="d-box b-box">
            {note}
          </p>
        )}
        {p.screen === 37 ? (
          <>
            <section className="d-box b-box">
              <h2>شغّل خطك مع سِكّة</h2>
              <p>
                قدّم بياناتك وبيانات عربيتك للمراجعة، وبعد الاعتماد تقدر تحدد خطك
                ومواعيدك وعروض الاشتراك.
              </p>
              <ol className="c-steps">
                <li>كمّل بياناتك</li>
                <li>جهّز مستنداتك وبيانات العربية</li>
                <li>راجع طلبك وتابع حالته</li>
              </ol>
            </section>
            <button
              className="d-primary b-primary"
              onClick={() =>
                nav(demo || p.profile?.role === "captain" ? 38 : 3)
              }
            >
              ابدأ يا كابتن <DiscoveryIcon name="arrow" />
            </button>
          </>
        ) : blocked ? (
          <section className="d-box b-box">
            <h2>سجّل بحساب كابتن عشان نكمل.</h2>
            <button className="d-primary b-primary" onClick={() => nav(3)}>
              اختار نوع حسابك
            </button>
          </section>
        ) : (
          <>
            {!demo && p.screen !== 43 ? (
              <section className="d-box b-box">
                <h2>تقديم الطلب لسه مش متاح</h2>
                <p>
                  تفعيل استقبال المستندات محتاج اعتماد سياسة التحقق وحماية
                  المستندات. بياناتك الحالية محفوظة، ومش هنرفع ملفات دلوقتي.
                </p>
                <button className="w-link" onClick={() => nav(43)}>
                  تابع حالة الطلب الحالي
                </button>
              </section>
            ) : (
              <>
                {p.screen === 38 && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setSubmitted(false);
                      nav(39);
                    }}
                  >
                    <label className="w-field">
                      <span>الاسم الكامل</span>
                      <input
                        required
                        minLength={2}
                        maxLength={100}
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          setSubmitted(false);
                        }}
                        autoComplete="name"
                      />
                    </label>
                    <label className="w-field">
                      <span>خبرتك في تشغيل الخطوط (اختياري)</span>
                      <textarea
                        maxLength={1000}
                        value={experience}
                        onChange={(e) => setExperience(e.target.value)}
                      />
                    </label>
                    <p>الاسم وباقي البيانات هنا للمعاينة بس.</p>
                    <button
                      className="d-primary b-primary"
                      disabled={name.trim().length < 2}
                    >
                      متابعة <DiscoveryIcon name="arrow" />
                    </button>
                  </form>
                )}
                {p.screen === 39 && files(["identity", "driving_license"])}
                {p.screen === 40 && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setSubmitted(false);
                      nav(41);
                    }}
                  >
                    <label className="w-field">
                      <span>موديل العربية</span>
                      <input
                        required
                        minLength={2}
                        maxLength={100}
                        value={model}
                        onChange={(e) => {
                          setModel(e.target.value);
                          setSubmitted(false);
                        }}
                        placeholder="مثال: تويوتا كورولا"
                      />
                    </label>
                    <label className="w-field">
                      <span>رقم اللوحة</span>
                      <input
                        required
                        minLength={3}
                        maxLength={30}
                        value={plate}
                        onChange={(e) => {
                          setPlate(e.target.value);
                          setSubmitted(false);
                        }}
                      />
                    </label>
                    <fieldset className="c-categories">
                      <legend>فئة العربية</legend>
                      {(
                        Object.keys(capacities) as (keyof typeof capacities)[]
                      ).map((c) => (
                        <button
                          type="button"
                          aria-pressed={category === c}
                          key={c}
                          onClick={() => {
                            setCategory(c);
                            setSubmitted(false);
                          }}
                        >
                          <strong>{c}</strong>
                          <span>
                            {c === "PRIME" || c === "SAVER"
                              ? "ملاكي"
                              : "هاي إس"}{" "}
                            · {capacities[c]} مقاعد
                          </span>
                        </button>
                      ))}
                    </fieldset>
                    <p>
                      سعة الفئة ثابتة، وعدد المقاعد المتاحة في الخط بيتحدد
                      بعدين.
                    </p>
                    <button
                      className="d-primary b-primary"
                      disabled={
                        model.trim().length < 2 || plate.trim().length < 3
                      }
                    >
                      متابعة <DiscoveryIcon name="arrow" />
                    </button>
                  </form>
                )}
                {p.screen === 41 && files(["vehicle_license", "vehicle_photo"])}
                {p.screen === 42 && (
                  <>
                    <section className="d-box b-box">
                      <h2>بياناتك</h2>
                      <p>{name || "الاسم لسه ناقص"}</p>
                      <p>{experience || "مفيش خبرة مضافة"}</p>
                      <button className="w-link" onClick={() => nav(38)}>
                        تعديل بيانات الكابتن
                      </button>
                    </section>
                    <section className="d-box b-box">
                      <h2>عربيتك</h2>
                      <p>
                        {model || "الموديل لسه ناقص"} ·{" "}
                        {plate || "اللوحة لسه ناقصة"}
                      </p>
                      <p>
                        {category} · {capacities[category]} مقاعد
                      </p>
                      <button className="w-link" onClick={() => nav(40)}>
                        تعديل بيانات العربية
                      </button>
                    </section>
                    <section className="d-box b-box">
                      <h2>المستندات المختارة</h2>
                      {(Object.keys(documentNames) as DocKind[]).map((k) => (
                        <p key={k}>
                          {documentNames[k]}:{" "}
                          {docs[k] ? "تم الاختيار محليًا" : "لسه ناقص"}
                        </p>
                      ))}
                      <button className="w-link" onClick={() => nav(39)}>
                        راجع مستنداتك
                      </button>
                      <button className="w-link" onClick={() => nav(41)}>
                        راجع مستندات العربية
                      </button>
                    </section>
                    <label className="c-check">
                      <input
                        type="checkbox"
                        checked={reviewed}
                        onChange={(e) => setReviewed(e.target.checked)}
                      />
                      راجعت البيانات التجريبية
                    </label>
                    {!complete && <p>كمّل البيانات والمستندات الناقصة الأول.</p>}
                    <button
                      className="d-primary b-primary"
                      disabled={!complete || !reviewed}
                      onClick={() => {
                        setSubmitted(true);
                        nav(43);
                      }}
                    >
                      معاينة حالة الطلب
                    </button>
                  </>
                )}
                {p.screen === 43 && (
                  <section className="d-box b-box">
                    <h2>
                      {demo
                        ? submitted
                          ? "مثال: طلبك قيد المراجعة"
                          : "لسه مفيش طلب في المعاينة"
                        : statusLabels[String(actual?.status)] ||
                          "لسه مفيش طلب متاح"}
                    </h2>
                    <p>
                      {demo
                        ? "دي معاينة فقط؛ مفيش طلب اتبعت أو اعتماد حصل. اعتماد الكابتن والعربية بيحتاج مراجعة فعلية."
                        : "حالة الكابتن مستقلة عن اعتماد العربية والمستندات. الموافقة على جزء مش معناها إن كل الطلب معتمد."}
                    </p>
                    {!demo &&
                      p.rows
                        .filter((r) => r.kind !== "captain")
                        .map((r, i) => (
                          <p key={i}>
                            {r.kind === "vehicle"
                              ? "العربية"
                              : documentNames[r.kind as DocKind] || "مستند"}
                            : {statusLabels[String(r.status)] || "قيد المراجعة"}
                          </p>
                        ))}
                    <button
                      className="w-link"
                      onClick={() => (demo ? nav(42) : p.onRefresh())}
                    >
                      {demo ? "ارجع لمراجعة الطلب" : "تحديث الحالة"}
                    </button>
                  </section>
                )}
              </>
            )}
          </>
        )}
        <p className="w-footnote">سِكّة — معاك في السِكّة</p>
      </main>
    </div>
  );
}
