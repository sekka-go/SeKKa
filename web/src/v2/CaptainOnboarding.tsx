import {usePreferences} from "./preferences";
import {translate} from "./translations";
import { publicScreen, internalScreen, screenTitle } from "./screenMap";
import { useEffect, useState } from "react";
import { Wordmark, type Appearance } from "./Onboarding";
import { DiscoveryIcon } from "./Discovery";
import type { Profile } from "./api";
import CaptainApplicationLive from "./CaptainApplicationLive";
import "./booking.css";
import "./wallet.css";
import "./captain.css";
export const captainOnboardingScreens = [37, 38, 40, 39, 42, 43, 76];
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
  production?: boolean;
  onEnrolled?: () => void;
  journeyScreen?: number;
  onJourneyGo?: (screen: number) => void;
  onJourneyBack?: () => void;
}) {
  const {language}=usePreferences();
  const tr=(text:string)=>translate(text,language);
  // A new Captain wizard step must start below the sticky application header,
  // not inherit the scroll position of the previous long form. This runs
  // after React commits the new step (including browser Back navigation).
  useEffect(()=>{
    if(p.production)window.scrollTo(0,0);
  },[p.production,p.journeyScreen,p.screen]);
  const demo = new URLSearchParams(location.search).get("preview") === "phase5";
  const [name, setName] = useState("");
  const [experience, setExperience] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicleType, setVehicleType] = useState<"private_car"|"hiace"| "">("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [manufactureYear, setManufactureYear] = useState("");
  const [color, setColor] = useState("");
  const [plate, setPlate] = useState("");
  const [docs, setDocs] = useState<Partial<Record<DocKind, string>>>({});
  const [note, setNote] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const nav = (n: number) => {
    setNote("");
    p.go(n);
  };
  const complete =
    name.trim().split(/\s+/).length >= 2 &&
    /^01[0125]\d{8}$/.test(phone.replace(/[\s-]/g,"")) &&
    experience.trim().length >= 3 &&
    experienceYears !== "" &&
    Number.isInteger(Number(experienceYears)) &&
    Number(experienceYears) >= 0 &&
    model.trim().length >= 2 &&
    make.trim().length >= 2 &&
    !!manufactureYear &&
    !!vehicleType &&
    plate.trim().length >= 3 &&
    Object.keys(docs).length === 4 &&
    color.trim().length > 0;
  const blocked = !demo && (!p.signedIn || p.profile?.role !== "captain");
  const actual = p.rows.find((r) => r.kind === "captain");
  const statusLabels: Record<string, string> = {
    pending: tr("طلبك قيد المراجعة"),
    approved: tr("تم اعتماد بيانات الكابتن"),
    changes_requested: tr("طلبك محتاج تعديل"),
    rejected: tr("الطلب لم يُعتمد"),
    suspended: tr("حساب الكابتن موقوف"),
  };
  function files(kinds: DocKind[]) {
    return (
      <>
        {kinds.map((kind) => (
          <section className="d-box b-box c-document" key={kind}>
            <h2>{tr(documentNames[kind])}</h2>
            <label className="w-field">
              <span>{tr("اختار ملف للمعاينة —")}{tr(documentNames[kind])}</span>
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
                      tr("اختار صورة JPG أو PNG أو ملف PDF، بحجم أكبر من صفر ولحد 5 ميجا."),
                    );
                    e.target.value = "";
                    return;
                  }
                  setDocs((d) => ({ ...d, [kind]: file.name }));
                  setNote(tr("الملف اتحدد على جهازك فقط. مفيش رفع أو إرسال."));
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
                  {tr("إزالة الاختيار")}</button>
              </p>
            )}
          </section>
        ))}
        <p>
          {tr("استخدم ملفات تجريبية. الاختيار مش بيرفع الملف، وبيتمسح لما تقفل أو تحدّث الصفحة.")}</p>
        <button
          className="d-primary b-primary"
          disabled={!demo || kinds.some((k) => !docs[k])}
          onClick={() =>
            nav(
              captainOnboardingScreens[
                captainOnboardingScreens.indexOf(p.screen) + 1
              ],
            )
          }
        >
          {tr("متابعة")}<DiscoveryIcon name="arrow" />
        </button>
      </>
    );
  }
  if(p.production){
    const n=p.journeyScreen??publicScreen(p.screen);
    const next=(id:number)=>p.onJourneyGo?p.onJourneyGo(id):p.go(internalScreen(id));
    const activeStep=n===35?0:n>=40?4:n-36;
    const steps=language==='en'
      ?['Your details','Vehicle','Documents','Review','Approval']
      :['بياناتك','العربية','المستندات','مراجعة الطلب','الاعتماد'];
    return <div className={`phase-one-stage discovery-stage booking-stage captain-stage ${p.theme}`}>
      <main className={`phase-canvas d-canvas captain-onboarding-canvas captain-step-${n}`}>
        <header className="d-header captain-onboarding-header">
          <button type="button" className="phase-back" aria-label={tr("رجوع")}
            onClick={()=>{if(n===35){if(p.onJourneyBack)p.onJourneyBack();else p.go(internalScreen(3));}else next(n-1);}}>
            <DiscoveryIcon name="back"/>
          </button>
          {!p.production&&<Wordmark/>}
        </header>
        <h1>{n===35
          ?language==='en'?'Complete your captain profile':'كمّل تسجيلك ككابتن'
          :screenTitle(p.screen,language)}</h1>
        <nav className="captain-enrollment-progress" aria-label={tr('مراحل تسجيل الكابتن')}>
          <ol>
            {steps.map((step,index)=><li key={step} aria-current={index===activeStep?'step':undefined}>
              <span className="captain-enrollment-progress__number">{index+1}</span>
              <span>{step}</span>
            </li>)}
          </ol>
        </nav>
        <CaptainApplicationLive screen={n} onNext={next} onEnrolled={p.onEnrolled}/>
      </main>
    </div>;
  }
  return (
    <div
      className={`phase-one-stage discovery-stage booking-stage captain-stage ${p.theme}`}
    >
      <nav className="phase-review-bar" aria-label={tr("معاينة المرحلة الخامسة")}>
        <div className="review-screen-nav">
          <button
            aria-label={tr("الشاشة السابقة")}
            disabled={p.screen === 37}
            onClick={() =>
              nav(
                captainOnboardingScreens[
                  captainOnboardingScreens.indexOf(p.screen) - 1
                ],
              )
            }
          >
            ‹
          </button>
          <select
            aria-label={tr("شاشة المرحلة الخامسة")}
            value={p.screen}
            onChange={(e) => nav(+e.target.value)}
          >
            {captainOnboardingScreens.map((n) => (
              <option key={n} value={n}>
                {publicScreen(n)} · {screenTitle(n,language)}
              </option>
            ))}
          </select>
          <button
            aria-label={tr("الشاشة التالية")}
            disabled={p.screen === 76}
            onClick={() =>
              nav(
                captainOnboardingScreens[
                  captainOnboardingScreens.indexOf(p.screen) + 1
                ],
              )
            }
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
      {demo && (
        <p className="w-preview">
          {tr("معاينة المرحلة الخامسة · 7 شاشات · مفيش إرسال طلبات أو مستندات حقيقية")}</p>
      )}
      <main className="phase-canvas d-canvas b-canvas c-canvas">
        <header className="d-header">
          <button
            className="phase-back"
            aria-label={tr("رجوع")}
            onClick={() =>
              nav(
                p.screen === 37
                  ? 3
                  : captainOnboardingScreens[
                      captainOnboardingScreens.indexOf(p.screen) - 1
                    ],
              )
            }
          >
            <DiscoveryIcon name="back" />
          </button>
          {!p.production&&<Wordmark />}
        </header>
        <div className="b-stage-label">
          {tr("انضم لPoNo")}<span dir="ltr">{publicScreen(p.screen) - 35} / 7</span>
        </div>
        <h1 className="b-title">{screenTitle(p.screen,language)}</h1>
        {p.error && (
          <div role="alert">
            <p>{p.error}</p>
            <button className="w-link" onClick={p.onRefresh}>
              {tr("حاول تاني")}</button>
          </div>
        )}
        {p.busy && <p role="status">{tr("بنحمّل بيانات طلبك…")}</p>}
        {note && (
          <p role="status" className="d-box b-box">
            {note}
          </p>
        )}
        {p.screen === 37 ? (
          <>
            <section className="d-box b-box">
              <h2>{tr("شغّل خطك مع PoNo")}</h2>
              <p>
                {tr("قدّم بياناتك وبيانات عربيتك للمراجعة، وبعد الاعتماد تقدر تحدد خطك ومواعيدك وعروض الاشتراك.")}</p>
              <ol className="c-steps">
                <li>{tr("كمّل بياناتك")}</li>
                <li>{tr("جهّز مستنداتك وبيانات العربية")}</li>
                <li>{tr("راجع طلبك وتابع حالته")}</li>
              </ol>
            </section>
            <button
              className="d-primary b-primary"
              onClick={() =>
                nav(demo || p.profile?.role === "captain" ? 38 : 3)
              }
            >
              {tr("ابدأ يا كابتن")}<DiscoveryIcon name="arrow" />
            </button>
          </>
        ) : blocked ? (
          <section className="d-box b-box">
            <h2>{tr("سجّل بحساب كابتن عشان نكمل.")}</h2>
            <button className="d-primary b-primary" onClick={() => nav(3)}>
              {tr("اختار نوع حسابك")}</button>
          </section>
        ) : (
          <>
            {!demo && ![43, 76].includes(p.screen) ? (
              <section className="d-box b-box">
                <h2>{tr("تقديم الطلب لسه مش متاح")}</h2>
                <p>
                  {tr("تفعيل استقبال المستندات محتاج اعتماد سياسة التحقق وحماية المستندات. بياناتك الحالية محفوظة، ومش هنرفع ملفات دلوقتي.")}</p>
                <button className="w-link" onClick={() => nav(43)}>
                  {tr("تابع حالة الطلب الحالي")}</button>
              </section>
            ) : (
              <>
                {p.screen === 38 && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setSubmitted(false);
                      nav(40);
                    }}
                  >
                    <label className="w-field">
                      <span>{tr("الاسم بالكامل")}</span>
                      <input
                        required
                        minLength={5}
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
                      <span>{tr("رقم الهاتف المصري (غير مؤكد)")}</span>
                      <input type="tel" inputMode="tel" autoComplete="tel-national"
                        required pattern="01[0125][0-9]{8}" value={phone}
                        onChange={(e) => setPhone(e.target.value)}/>
                    </label>
                    <label className="w-field">
                      <span>{tr("الخلفية المهنية")}</span>
                      <textarea
                        required
                        minLength={3}
                        maxLength={1000}
                        value={experience}
                        onChange={(e) => setExperience(e.target.value)}
                      />
                    </label>
                    <label className="w-field">
                      <span>{tr("سنوات الخبرة")}</span>
                      <input type="number" required min={0} max={80} step={1}
                        value={experienceYears} onChange={(e)=>setExperienceYears(e.target.value)}/>
                    </label>
                    <p>{tr("الاسم وباقي البيانات هنا للمعاينة بس.")}</p>
                    <button
                      className="d-primary b-primary"
                      disabled={name.trim().split(/\s+/).length < 2||
                        !/^01[0125]\d{8}$/.test(phone.replace(/[\s-]/g,""))||
                        experience.trim().length<3||experienceYears===""}
                    >
                      {tr("متابعة")}<DiscoveryIcon name="arrow" />
                    </button>
                  </form>
                )}
                {p.screen === 39 &&
                  files([
                    "identity",
                    "driving_license",
                    "vehicle_license",
                    "vehicle_photo",
                  ])}
                {p.screen === 40 && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setSubmitted(false);
                      nav(39);
                    }}
                  >
                    <label className="w-field">
                      <span>{tr("نوع المركبة الفعلي")}</span>
                      <select required value={vehicleType} onChange={e=>{
                        setVehicleType(e.target.value as "private_car"|"hiace"|"");
                      }}>
                        <option value="">{tr("اختر نوع المركبة")}</option>
                        <option value="private_car">{tr("سيارة ملاكي")}</option>
                        <option value="hiace">{tr("هايس")}</option>
                      </select>
                    </label>
                    <label className="w-field">
                      <span>{tr("الشركة المصنعة")}</span>
                      <input required minLength={2} maxLength={60} value={make}
                        onChange={e=>{setMake(e.target.value);setModel("");}}/>
                    </label>
                    <label className="w-field">
                      <span>{tr("الموديل")}</span>
                      <input
                        required
                        minLength={2}
                        maxLength={100}
                        value={model}
                        onChange={(e) => {
                          setModel(e.target.value);
                          setSubmitted(false);
                        }}
                        placeholder={tr("مثال: تويوتا كورولا")}
                      />
                    </label>
                    <label className="w-field">
                      <span>{tr("سنة الصنع")}</span>
                      <select required value={manufactureYear} onChange={e=>setManufactureYear(e.target.value)}>
                        <option value="">{tr("اختر سنة الصنع")}</option>
                        {Array.from({length:new Date().getFullYear()-1979},(_,i)=>String(new Date().getFullYear()-i))
                          .map(year=><option key={year} value={year}>{year}</option>)}
                      </select>
                    </label>
                    <label className="w-field">
                      <span>{tr("رقم اللوحة")}</span>
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
                    <label className="w-field">
                      <span>{tr("لون المركبة")}</span>
                      <select required value={color} onChange={e=>setColor(e.target.value)}>
                        <option value="">{tr("اختر اللون")}</option>
                        {["white","black","silver","gray","red","blue","green","brown","gold","other"]
                         .map(value=><option key={value} value={value}>{tr(value)}</option>)}
                      </select>
                    </label>
                    {vehicleType==="private_car"&&<p>PRIME · 3 {tr("مقاعد")} / SAVER · 4 {tr("مقاعد")}</p>}
                    {vehicleType==="hiace"&&<p>SPACE · 9 {tr("مقاعد")} / MAX · 13 {tr("مقاعد")} · {tr("تحديد المسؤول")}</p>}
                    <p>{tr("السعة ثابتة حسب فئة الخدمة ولا يمكن تعديلها.")}</p>
                    <button
                      className="d-primary b-primary"
                      disabled={
                        model.trim().length < 2 ||
                        make.trim().length<2||!manufactureYear||!vehicleType||
                        plate.trim().length < 3 ||
                        !color.trim()
                      }
                    >
                      {tr("متابعة")}<DiscoveryIcon name="arrow" />
                    </button>
                  </form>
                )}

                {p.screen === 42 && (
                  <>
                    <section className="d-box b-box">
                      <h2>{tr("بياناتك")}</h2>
                      <p>{name || tr("الاسم لسه ناقص")}</p>
                      <p>{phone || tr("رقم الهاتف لسه ناقص")} · {tr("غير مؤكد")}</p>
                      <p>{experience || tr("الخلفية المهنية لسه ناقصة")}</p>
                      <p>{experienceYears || "—"} {tr("سنوات خبرة")}</p>
                      <button className="w-link" onClick={() => nav(38)}>
                        {tr("تعديل بيانات الكابتن")}</button>
                    </section>
                    <section className="d-box b-box">
                      <h2>{tr("عربيتك")}</h2>
                      <p>
                        {vehicleType==="private_car"?tr("ملاكي"):vehicleType==="hiace"?tr("هايس"):"—"} ·
                        {make || tr("الشركة لسه ناقصة")} · {model || tr("الموديل لسه ناقص")} ·{" "}
                        {manufactureYear||"—"} ·{" "}
                        {color || tr("اللون لسه ناقص")} ·{" "}
                        {plate || tr("اللوحة لسه ناقصة")}
                      </p>
                      {vehicleType==="private_car"&&<p>PRIME · 3 {tr("مقاعد")} / SAVER · 4 {tr("مقاعد")}</p>}
                      {vehicleType==="hiace"&&<p>SPACE · 9 {tr("مقاعد")} / MAX · 13 {tr("مقاعد")}</p>}
                      <button className="w-link" onClick={() => nav(40)}>
                        {tr("تعديل بيانات العربية")}</button>
                    </section>
                    <section className="d-box b-box">
                      <h2>{tr("المستندات المختارة")}</h2>
                      {(Object.keys(documentNames) as DocKind[]).map((k) => (
                        <p key={k}>
                          {tr(documentNames[k])}:{" "}
                          {docs[k] ? tr("تم الاختيار محليًا") : tr("لسه ناقص")}
                        </p>
                      ))}
                      <button className="w-link" onClick={() => nav(39)}>
                        {tr("راجع مستنداتك")}</button>
                      <button className="w-link" onClick={() => nav(39)}>
                        {tr("راجع مستندات العربية")}</button>
                    </section>
                    <label className="c-check">
                      <input
                        type="checkbox"
                        checked={reviewed}
                        onChange={(e) => setReviewed(e.target.checked)}
                      />
                      {tr("راجعت البيانات التجريبية")}</label>
                    {!complete && <p>{tr("كمّل البيانات والمستندات الناقصة الأول.")}</p>}
                    <button
                      className="d-primary b-primary"
                      disabled={!complete || !reviewed}
                      onClick={() => {
                        setSubmitted(true);
                        nav(43);
                      }}
                    >
                      {tr("معاينة حالة الطلب")}</button>
                  </>
                )}
                {p.screen === 43 && (
                  <section className="d-box b-box">
                    <h2>
                      {demo
                        ? submitted
                          ? tr("مثال: طلبك قيد المراجعة")
                          : tr("لسه مفيش طلب في المعاينة")
                        : statusLabels[String(actual?.status)] ||
                          tr("لسه مفيش طلب متاح")}
                    </h2>
                    <p>
                      {demo
                        ? tr("دي معاينة فقط؛ مفيش طلب اتبعت أو اعتماد حصل. اعتماد الكابتن والعربية بيحتاج مراجعة فعلية.")
                        : tr("حالة الكابتن مستقلة عن اعتماد العربية والمستندات. الموافقة على جزء مش معناها إن كل الطلب معتمد.")}
                    </p>
                    {!demo &&
                      p.rows
                        .filter((r) => r.kind !== "captain")
                        .map((r, i) => (
                          <p key={i}>
                            {r.kind === "vehicle"
                              ? (language==="en"?"Vehicle":"العربية")
                              : documentNames[r.kind as DocKind] || tr("مستند")}
                            : {statusLabels[String(r.status)] || tr("قيد المراجعة")}
                          </p>
                        ))}
                    <button
                      className="w-link"
                      onClick={() => (demo ? nav(42) : p.onRefresh())}
                    >
                      {demo ? tr("ارجع لمراجعة الطلب") : tr("تحديث الحالة")}
                    </button>
                  </section>
                )}
              </>
            )}
          </>
        )}
        {p.screen === 76 && !blocked && (
          <section className="d-box b-box">
            <h2>
              {!demo &&
              actual?.status === "approved" &&
              p.rows.some(
                (r) => r.kind === "vehicle" && r.status === "approved",
              )
                ? tr("حساب الكابتن والعربية معتمدين")
                : tr("التفعيل مستني اعتماد الإدارة")}
            </h2>
            <p>
              {tr("الدخول لإدارة الخطوط مش بديل عن اعتماد الكابتن والعربية. المعاينة ما بتمنحش صلاحيات نشر.")}</p>
            {!demo &&
            actual?.status === "approved" &&
            p.rows.some(
              (r) => r.kind === "vehicle" && r.status === "approved",
            ) ? (
              <button className="d-primary" onClick={() => nav(45)}>
                {tr("إدارة خطوطي")}</button>
            ) : (
              <button className="w-link" onClick={() => nav(43)}>
                {tr("متابعة حالة الطلب")}</button>
            )}
          </section>
        )}
        <p className="w-footnote">{tr("PoNo — معاك في PoNo")}</p>
      </main>
    </div>
  );
}
