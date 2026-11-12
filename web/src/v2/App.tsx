import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { api, client } from "./api";
import type { Profile, Route, Quote, Booking } from "./api";
import {
  categories,
  normalizePhone,
} from "../../../packages/domain/subscriptions";
import { screenTitles, publicScreens, adminResources } from "./screens";
import { copy, errorCopy } from "./copy";
import "./theme.css";
import Onboarding, { readAppearance, Wordmark } from "./Onboarding";
import type { Appearance } from "./Onboarding";
import Discovery, { discoveryScreens } from "./Discovery";
import type { Line } from "./Discovery";
import BookingFlow, { bookingScreens } from "./BookingFlow";
type Row = Record<string, unknown>;
const money = (n: number) =>
  new Intl.NumberFormat("ar-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  }).format(n);
const periodLabel = (s: string) => (s === "weekly" ? "أسبوعي" : "شهري");
const directionLabel = (s: string) =>
  s === "outbound" ? "ذهاب" : s === "return" ? "عودة" : "ذهاب وعودة";
function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}
function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Record<string, string>;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {Object.entries(options).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`panel ${className}`}>{children}</section>;
}
function Empty({ children = copy.noData }: { children?: ReactNode }) {
  return (
    <Panel>
      <p className="muted">{children}</p>
    </Panel>
  );
}
function JsonRows({ rows }: { rows: Row[] }) {
  return rows.length ? (
    <div className="cards">
      {rows.map((row, i) => (
        <Panel key={String(row.id ?? i)}>
          <dl>
            {Object.entries(row)
              .filter(([k, v]) => v !== null && Boolean(labels[k]))
              .map(([k, v]) => (
                <div key={k}>
                  <dt>{labels[k] ?? k}</dt>
                  <dd>
                    {typeof v === "boolean"
                      ? v
                        ? "متاح"
                        : "غير متاح"
                      : typeof v === "object"
                        ? "متاح للمراجعة"
                        : (valueLabels[String(v)] ?? String(v))}
                  </dd>
                </div>
              ))}
          </dl>
        </Panel>
      ))}
    </div>
  ) : (
    <Empty />
  );
}
const valueLabels: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "معتمد",
  changes_requested: "محتاج تعديل",
  rejected: "مرفوض",
  suspended: "متوقف",
  active: "متاح",
  draft: "مسودة",
  paused: "متوقف مؤقتًا",
  reserved: "التأمين محجوز",
  released: "التأمين متاح",
  confirmed: "مؤكد ماليًا",
  disputed: "قيد المراجعة",
  completed: "منتهي",
  cancelled: "ملغي",
  rider: "راكب",
  captain: "كابتن",
  reserve: "حجز التأمين",
  release: "تحرير التأمين",
  provider_credit: "شحن رصيد",
  withdrawal: "سحب رصيد",
  outbound: "ذهاب",
  return: "عودة",
  round_trip: "ذهاب وعودة",
};
const labels: Record<string, string> = {
  id: "المرجع",
  user_id: "صاحب الحساب",
  created_at: "التاريخ",
  body: "الرسالة",
  amount: "القيمة",
  available_delta: "تغير المتاح",
  reserved_delta: "تغير المحجوز",
  kind: "نوع العملية",
  status: "الحالة",
  origin: "من",
  destination: "إلى",
  category: "الفئة",
  seats: "المقاعد",
  full_name: "الاسم",
  role: "نوع الحساب",
  experience: "الخبرة",
  plate: "اللوحة",
  model: "الموديل",
  starts_on: "البداية",
  ends_before: "نهاية الدورة — غير شاملة",
  price: "قيمة الاشتراك",
  direction: "الاتجاه",
  reference: "المرجع",
  reason: "السبب",
  routes: "الخطوط المعتمدة",
  reservedSeats: "المقاعد المؤمنة",
  confirmedSeats: "المقاعد المؤكدة ماليًا",
  unmetRequests: "طلبات الخطوط",
  realMoneyEnabled: "تفعيل الأموال الحقيقية",
};
export default function SubscriptionApp() {
  const getScreen = () => {
    const n = Number(new URLSearchParams(location.search).get("screen") ?? 1);
    return Number.isInteger(n) && n >= 1 && n <= 75 ? n : 8;
  };
  const [theme, setTheme] = useState<Appearance>(readAppearance);
  function changeTheme(value: Appearance) {
    setTheme(value);
    const url = new URL(location.href);
    url.searchParams.set("theme", value);
    history.replaceState(null, "", url);
    document.documentElement.dataset.theme = value;
    try {
      localStorage.setItem("sekka.appearance", value);
    } catch {
      /* storage optional */
    }
  }
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const [screen, setScreen] = useState(getScreen),
    [profile, setProfile] = useState<Profile | null>(null),
    [signedIn, setSignedIn] = useState(false),
    [authReady, setAuthReady] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [revision, setRevision] = useState(0);
  const [rows, setRows] = useState<Row[]>([]),
    [routes, setRoutes] = useState<Route[]>([]),
    [route, setRoute] = useState<Route | null>(null),
    [bookings, setBookings] = useState<Booking[]>([]),
    [booking, setBooking] = useState<Booking | null>(null),
    [quote, setQuote] = useState<Quote | null>(null);
  const [bookingOffer, setBookingOffer] = useState<Line | null>(null);
  const [role, setRole] = useState("rider"),
    [phone, setPhone] = useState(""),
    [otp, setOtp] = useState(""),
    [name, setName] = useState(""),
    [consent, setConsent] = useState(false);
  const [origin, setOrigin] = useState(""),
    [destination, setDestination] = useState(""),
    [category, setCategory] = useState(""),
    [departure, setDeparture] = useState("07:30"),
    [returnTime, setReturnTime] = useState("17:00"),
    [period, setPeriod] = useState(
      new URLSearchParams(location.search).get("offerPeriod") || "monthly",
    ),
    [direction, setDirection] = useState(
      new URLSearchParams(location.search).get("offerDirection") ||
        "round_trip",
    ),
    [maxPrice, setMaxPrice] = useState("");
  const [balance, setBalance] = useState({ available: 0, reserved: 0 }),
    [body, setBody] = useState(""),
    [conversation, setConversation] = useState("");
  const [model, setModel] = useState(""),
    [plate, setPlate] = useState(""),
    [seats, setSeats] = useState("3"),
    [anchor, setAnchor] = useState(""),
    [weekly, setWeekly] = useState(""),
    [monthly, setMonthly] = useState(""),
    [expiresOn, setExpiresOn] = useState(""),
    [documentKind, setDocumentKind] = useState("driving_license");
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );
  const [health, setHealth] = useState<{
    calendarApproved: boolean;
    realMoneyEnabled: boolean;
  } | null>(null);
  function go(id: number, routeId = route?.id, bookingId = booking?.id) {
    setScreen(id);
    setError("");
    setNotice("");
    const params = new URLSearchParams({ screen: String(id), theme });
    if (id <= 7) params.set("inspect", "1");
    const previous = new URLSearchParams(location.search);
    if (["phase2", "phase3"].includes(previous.get("preview") || ""))
      params.set("preview", bookingScreens.includes(id) ? "phase3" : "phase2");
    for (const key of ["offer", "offerPeriod", "offerDirection"]) {
      const value = previous.get(key);
      if (value) params.set(key, value);
    }
    if (routeId) params.set("route", routeId);
    if (bookingId) params.set("booking", bookingId);
    history.pushState({}, "", `?${params}`);
    window.scrollTo(0, 0);
  }
  useEffect(() => {
    const h = () => setScreen(getScreen());
    addEventListener("popstate", h);
    return () => removeEventListener("popstate", h);
  }, []);
  useEffect(() => {
    document.title = `${screenTitles[screen - 1]} | سِكّة`;
  }, [screen]);
  async function refreshProfile() {
    if (
      !client ||
      ["phase2", "phase3"].includes(
        new URLSearchParams(location.search).get("preview") || "",
      )
    )
      return;
    const { data } = await client.auth.getSession();
    setSignedIn(Boolean(data.session));
    if (data.session) {
      const p = await api<Profile | null>("me");
      setProfile(p);
      if (p) {
        setName(p.full_name);
        setRole(p.role);
        setBalance(p.balance);
      }
    } else setProfile(null);
  }
  useEffect(() => {
    if (!client) {
      setAuthReady(true);
      return;
    }
    void refreshProfile()
      .catch(() => setError(copy.serviceUnavailable))
      .finally(() => setAuthReady(true));
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
      setRevision((v) => v + 1);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (authReady)
      void refreshProfile().catch(() => setError(copy.serviceUnavailable));
  }, [revision, authReady]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(errorCopy(e));
    } finally {
      setBusy(false);
    }
  }
  function submit(fn: () => Promise<void>) {
    return (e: FormEvent) => {
      e.preventDefault();
      void run(fn);
    };
  }
  useEffect(() => {
    let active = true;
    setRows([]);
    setError("");
    if (
      !client ||
      ["phase2", "phase3"].includes(
        new URLSearchParams(location.search).get("preview") || "",
      )
    )
      return;
    const load = async () => {
      const h = await api<typeof health>("health");
      const params = new URLSearchParams(location.search);
      const routeId = params.get("route");
      if (routeId && [12, 13, 16, 17, 18].includes(screen)) {
        const detail = await api<Route>("route", { id: routeId });
        if (active) setRoute(detail);
      }

      if (active) setHealth(h);
      if ([8, 9, 10, 11].includes(screen)) {
        const rs = await api<Route[]>("search", {
          origin,
          destination,
          category,
          direction,
          period,
          departure,
          returnTime: direction === "round_trip" ? returnTime : "",
          maxPrice,
        });
        if (active) setRoutes(rs);
      }
      if (!signedIn) return;
      if ([14].includes(screen)) {
        const rs = await api<Route[]>("favorites");
        if (active) setRoutes(rs);
      }
      if (
        [18, 19, 20, 21, 22, 23, 29, 30, 52, 53, 54, 55, 56, 58, 61].includes(
          screen,
        )
      ) {
        const bs = await api<Booking[]>("bookings");
        if (active) {
          setBookings(bs);
          const selected = new URLSearchParams(location.search).get("booking");
          if (selected) setBooking(bs.find((b) => b.id === selected) ?? null);
        }
      }
      if ([17, 18, 24, 25, 26, 27, 28].includes(screen)) {
        const w = await api<{ balance: typeof balance; transactions: Row[] }>(
          "wallet",
        );
        if (active) {
          setBalance(w.balance);
          setRows(w.transactions);
        }
      }
      if ([31, 63].includes(screen)) {
        const rr = await api<Row[]>("conversations");
        if (active) setRows(rr);
      }
      if (screen === 32 && conversation) {
        const rr = await api<Row[]>("messages", {
          conversationId: conversation,
        });
        if (active) setRows(rr);
      }
      if ([33, 62].includes(screen)) {
        const rr = await api<Row[]>("notifications");
        if (active) setRows(rr);
      }
      if ([43, 59, 60].includes(screen)) {
        const c = await api<Row>("captain");
        if (active)
          setRows(
            Object.entries(c).flatMap(([kind, data]) =>
              Array.isArray(data)
                ? (data as Row[])
                : data && typeof data === "object"
                  ? [{ kind, ...(data as Row) }]
                  : [],
            ),
          );
      }
      if ([44, 45].includes(screen)) {
        const rr = await api<Row[]>("captain.routes");
        if (active) setRows(rr);
      }
      if (screen === 57) {
        const rr = await api<Row[]>("captain.waitlist");
        if (active) setRows(rr);
      }
      if (screen >= 64) {
        const rr = await api<Row[] | Row>("admin.list", {
          resource: adminResources[screen],
        });
        if (active) setRows(Array.isArray(rr) ? rr : [rr]);
      }
    };
    setBusy(true);
    void load()
      .catch((e) => {
        if (active) setError(errorCopy(e));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
    // Search runs on the results screen; intermediate form edits do not send requests.
  }, [screen, revision, signedIn, conversation]);
  const guarded =
    !publicScreens.has(screen) &&
    ![6, 7].includes(screen) &&
    (!signedIn || !profile);
  const captainBlocked =
    screen >= 38 && screen < 64 && profile?.role !== "captain";
  const adminBlocked = screen >= 64 && !profile?.permissions?.length;
  const selectedRoute = route;
  function RouteCard({ r }: { r: Route }) {
    return (
      <Panel className="route-card">
        <div className="row">
          <span className="category" dir="ltr">
            {r.category}
          </span>
          <span className="muted">{r.seats} مقاعد منشورة</span>
        </div>
        <h3>
          {r.origin} <span aria-label="إلى">←</span> {r.destination}
        </h3>
        <p className="muted">
          {r.outbound?.slice(0, 5)}{" "}
          {r.return_time && ` · العودة ${r.return_time.slice(0, 5)}`}
        </p>
        <div className="row">
          <span>{r.captain_name ?? "خط ثابت"}</span>
          <button
            onClick={() =>
              void run(async () => {
                const detail = await api<Route>("route", { id: r.id });
                setRoute(detail);
                setQuote(null);
                go(12, r.id);
              })
            }
          >
            تفاصيل الخط
          </button>
        </div>
      </Panel>
    );
  }
  function BookingCard({ b }: { b: Booking }) {
    return (
      <Panel>
        <span className="category">
          {b.status === "confirmed"
            ? "مؤكد ماليًا"
            : b.status === "disputed"
              ? "قيد المراجعة"
              : "مستني تأكيد الدفع"}
        </span>
        <h3>
          {b.origin} ← {b.destination}
        </h3>
        <p>{money(b.price)}</p>
        <p className="muted">
          {b.starts_on} — {b.ends_before} (النهاية غير شاملة)
        </p>
        <button
          onClick={() => {
            setBooking(b);
            go(profile?.role === "captain" ? 53 : 20);
          }}
        >
          تفاصيل الاشتراك
        </button>
      </Panel>
    );
  }
  function authScreen() {
    return (
      <Panel>
        <p>
          {!signedIn ? "سجّل برقم موبايلك عشان نكمل." : copy.profileRequired}
        </p>
        <button onClick={() => go(signedIn ? 6 : 3)}>كمّل</button>
      </Panel>
    );
  }
  function SearchForm() {
    return (
      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          if (screen === 11) setRevision((v) => v + 1);
          else go(11);
        }}
      >
        <Field
          label="منين؟"
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          placeholder="مثال: مدينة نصر"
        />
        <Field
          label="لفين؟"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="مثال: التجمع الخامس"
        />
        <div className="grid">
          <Field
            label="ميعاد الذهاب"
            type="time"
            value={departure}
            onChange={(e) => setDeparture(e.target.value)}
          />
          {direction === "round_trip" && (
            <Field
              label="ميعاد العودة"
              type="time"
              value={returnTime}
              onChange={(e) => setReturnTime(e.target.value)}
            />
          )}
        </div>
        <div className="grid">
          <Select
            label="المشوار"
            value={direction}
            onChange={setDirection}
            options={{
              outbound: "ذهاب",
              return: "عودة",
              round_trip: "ذهاب وعودة",
            }}
          />
          <Select
            label="الاشتراك"
            value={period}
            onChange={setPeriod}
            options={{ weekly: "أسبوعي", monthly: "شهري" }}
          />
        </div>
        <div className="grid">
          <Select
            label="الفئة"
            value={category}
            onChange={setCategory}
            options={{
              "": "كل الفئات",
              PRIME: "PRIME",
              SAVER: "SAVER",
              SPACE: "SPACE",
              MAX: "MAX",
            }}
          />
          <Field
            label="أقصى سعر للدورة"
            type="number"
            min="1"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
          />
        </div>
        <button type="submit">شوف الخطوط المناسبة</button>
      </form>
    );
  }
  function content(): ReactNode {
    if (!authReady) return <Empty>{copy.loading}</Empty>;
    if (guarded) return authScreen();
    if (captainBlocked || adminBlocked)
      return <Empty>الصفحة دي مش متاحة لحسابك.</Empty>;
    if ([1, 2, 37].includes(screen))
      return (
        <Panel className="hero">
          <img src="/brand/sekka-mark.png" alt="شعار سِكّة" />
          <p className="eyebrow">{copy.tagline}</p>
          <h1>
            {screen === 37
              ? "خطك موجود. ناقصه ركابه."
              : "مشوارك اليومي، متظبّط."}
          </h1>
          <p>خط ثابت، ميعاد واضح، واشتراك يناسبك.</p>
          <button
            onClick={() => {
              if (screen === 37) setRole("captain");
              go(screen === 37 ? 3 : 8);
            }}
          >
            {screen === 37 ? "انضم ككابتن" : copy.browse}
          </button>
          <button className="secondary" onClick={() => go(3)}>
            سجّل دخولك
          </button>
        </Panel>
      );
    if (screen === 3)
      return (
        <Panel>
          <h2>هنكمل معاك إزاي؟</h2>
          <div className="grid">
            {["rider", "captain"].map((r) => (
              <button
                className={role === r ? "" : "secondary"}
                key={r}
                onClick={() => {
                  setRole(r);
                  go(4);
                }}
              >
                {r === "rider" ? "راكب" : "كابتن"}
              </button>
            ))}
          </div>
          <p className="muted">تقدر تتصفح الخطوط من غير حساب.</p>
          <button className="text-button" onClick={() => go(8)}>
            تصفح الخطوط
          </button>
        </Panel>
      );
    if (screen === 4)
      return (
        <form
          className="panel"
          onSubmit={submit(async () => {
            if (!client) throw new Error("V2_BACKEND_NOT_CONFIGURED");
            const { error } = await client.auth.signInWithOtp({
              phone: normalizePhone(phone),
            });
            if (error) throw error;
            go(5);
          })}
        >
          <Field
            label="رقم الموبايل"
            type="tel"
            autoComplete="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="01xxxxxxxxx"
          />
          <p className="muted">هنبعت لك كود تأكيد على موبايلك.</p>
          <button disabled={busy}>ابعت الكود</button>
        </form>
      );
    if (screen === 5)
      return (
        <form
          className="panel"
          onSubmit={submit(async () => {
            if (!client) throw new Error("V2_BACKEND_NOT_CONFIGURED");
            const { error } = await client.auth.verifyOtp({
              phone: normalizePhone(phone),
              token: otp,
              type: "sms",
            });
            if (error) throw error;
            await refreshProfile();
            go(6);
          })}
        >
          <Field
            label="كود التأكيد"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
          />
          <button disabled={busy}>أكد رقمك</button>
          <button type="button" className="text-button" onClick={() => go(4)}>
            غيّر الرقم أو اطلب كود تاني
          </button>
        </form>
      );
    if (screen === 6 || screen === 7 || screen === 35)
      return (
        <form
          className="panel"
          onSubmit={submit(async () => {
            if (!consent) throw new Error("INVALID_PROFILE");
            await api("profile.save", {
              name,
              role,
              policyVersion: "2026-11-12",
            });
            await refreshProfile();
            go(role === "captain" ? 38 : 8);
          })}
        >
          <Field
            label="اسمك"
            required
            minLength={2}
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <p>
            التسجيل متاح بعد اعتماد شروط الاستخدام وسياسة الخصوصية. مش بنطلب
            موقعك عشان نراقب حضورك.
          </p>
          <label className="check">
            <input
              type="checkbox"
              required
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />{" "}
            قرأت الشروط المعتمدة ووافقت عليها
          </label>
          <p className="muted">
            النصوص القانونية النهائية لسه تحت المراجعة؛ إنشاء حسابات الإطلاق
            متوقف لحين اعتمادها.
          </p>
          <button disabled title="بانتظار اعتماد النصوص القانونية">
            حفظ البيانات — قريبًا
          </button>
        </form>
      );
    if ([8, 9, 10, 11].includes(screen))
      return (
        <>
          <div className="intro">
            <p className="eyebrow">خط شغلك؟ دوّر عليه في سِكّة.</p>
            <h1>
              مشوارك اليومي
              <br />
              منين لفين؟
            </h1>
            <p className="muted">اشتراكات أسبوعية وشهرية · الأحد للخميس</p>
          </div>
          {SearchForm()}
          <div className="category-grid">
            {Object.entries(categories).map(([c, n]) => (
              <button
                key={c}
                className={`category-tile ${category === c ? "selected" : ""}`}
                onClick={() => {
                  setCategory(c);
                  setRevision((v) => v + 1);
                }}
              >
                <span dir="ltr">{c}</span>
                <small>حتى {n} مقاعد</small>
              </button>
            ))}
          </div>
          <div className="section-heading">
            <h2>خطوط تناسب يومك</h2>
            <span className="muted">{routes.length} خطوط</span>
          </div>
          <div className="cards">
            {routes.map((r) => (
              <RouteCard key={r.id} r={r} />
            ))}
          </div>
          {!busy && !routes.length && (
            <Empty>
              {copy.empty}{" "}
              <button className="text-button" onClick={() => go(15)}>
                قولنا محتاج تروح فين
              </button>
            </Empty>
          )}
        </>
      );
    if ([12, 13, 16, 17, 18, 19].includes(screen)) {
      if (screen === 19)
        return booking ? (
          <>
            <BookingCard b={booking} />
            <p>{copy.pay}</p>
          </>
        ) : (
          <Empty>راجع اشتراكاتك عشان تتأكد من حالة الحجز.</Empty>
        );
      if (!selectedRoute)
        return (
          <Empty>
            اختار خط من البحث الأول.{" "}
            <button onClick={() => go(8)}>دوّر على خط</button>
          </Empty>
        );
      if (screen === 18)
        return (
          <Panel>
            <h2>تأمين الحجز</h2>
            <p>{copy.security}</p>
            <p>رصيدك المتاح: {money(balance.available)}</p>
            <p>{copy.moneyDisabled}</p>
            <button className="secondary" onClick={() => go(17)}>
              ارجع لمراجعة الحجز
            </button>
          </Panel>
        );
      return (
        <>
          <Panel>
            <span className="category" dir="ltr">
              {selectedRoute.category}
            </span>
            <h2>
              {selectedRoute.origin} ← {selectedRoute.destination}
            </h2>
            <p>
              {selectedRoute.outbound.slice(0, 5)}{" "}
              {selectedRoute.return_time &&
                ` · العودة ${selectedRoute.return_time.slice(0, 5)}`}
            </p>
            <p>
              {selectedRoute.captain_name} · {selectedRoute.vehicle_model} ·{" "}
              {selectedRoute.plate}
            </p>
            <p className="muted">
              {selectedRoute.seats} مقاعد منشورة. التوفر النهائي بيتأكد وقت
              الحجز.
            </p>
            <p>السعر الكامل للدورة:</p>
            {selectedRoute.prices?.map((p) => (
              <p key={p.period + p.direction}>
                {periodLabel(p.period)} · {directionLabel(p.direction)}{" "}
                <strong>{money(p.amount)}</strong>
              </p>
            ))}
            <div className="actions">
              <button
                className="secondary"
                onClick={() =>
                  void run(async () => {
                    await api("favorite.toggle", { routeId: selectedRoute.id });
                    setNotice("المفضلة اتحدثت.");
                  })
                }
              >
                المفضلة
              </button>
              <button
                className="secondary"
                onClick={() =>
                  void run(async () => {
                    await api("waitlist.join", { routeId: selectedRoute.id });
                    setNotice("اسمك اتسجل في قائمة الانتظار.");
                  })
                }
              >
                قائمة الانتظار
              </button>
              <button
                className="secondary"
                onClick={() =>
                  void run(async () => {
                    const c = await api<{ id: string }>("conversation.open", {
                      captainId: selectedRoute.captain_id,
                    });
                    setConversation(c.id);
                    go(32);
                  })
                }
              >
                كلّم الكابتن
              </button>
            </div>
          </Panel>
          <form
            className="panel"
            onSubmit={submit(async () => {
              const q = await api<Quote>("quote", {
                routeId: selectedRoute.id,
                period,
                direction,
              });
              setQuote(q);
              setIdempotencyKey(crypto.randomUUID());
              if (screen !== 17) go(17);
            })}
          >
            <h2>اختار اشتراكك</h2>
            <Select
              label="المدة"
              value={period}
              onChange={(v) => {
                setPeriod(v);
                setQuote(null);
              }}
              options={{ weekly: "أسبوعي", monthly: "شهري" }}
            />
            <Select
              label="الاتجاه"
              value={direction}
              onChange={(v) => {
                setDirection(v);
                setQuote(null);
              }}
              options={{
                outbound: "ذهاب",
                return: "عودة",
                round_trip: "ذهاب وعودة",
              }}
            />
            <p className="muted">
              البداية بتتحسب تلقائيًا بتوقيت مصر، مع استبعاد الجمعة والسبت
              والإجازات الرسمية.
            </p>
            <button disabled={busy}>احسب اشتراكي</button>
          </form>
          {quote && (
            <Panel>
              <h2>{money(quote.price)}</h2>
              <dl>
                <div>
                  <dt>البداية</dt>
                  <dd>{quote.start}</dd>
                </div>
                <div>
                  <dt>نهاية الدورة — غير شاملة</dt>
                  <dd>{quote.endExclusive}</dd>
                </div>
                <div>
                  <dt>أيام الخدمة المتبقية</dt>
                  <dd>
                    {quote.remainingDays} من {quote.totalDays}
                  </dd>
                </div>
              </dl>
              <p>{copy.security}</p>
              <p>{copy.pay}</p>
              <button
                disabled={busy || !health?.realMoneyEnabled}
                onClick={() =>
                  void run(async () => {
                    const b = await api<Booking>("book", {
                      routeId: selectedRoute.id,
                      period,
                      direction,
                      expectedQuote: quote,
                      idempotencyKey,
                    });
                    setBooking({
                      ...b,
                      origin: selectedRoute.origin,
                      destination: selectedRoute.destination,
                    });
                    go(19);
                  })
                }
              >
                أكد الحجز
              </button>
              {!health?.realMoneyEnabled && (
                <p className="muted">{copy.moneyDisabled}</p>
              )}
            </Panel>
          )}
        </>
      );
    }
    if (screen === 14)
      return (
        <div className="cards">
          {routes.length ? (
            routes.map((r) => <RouteCard key={r.id} r={r} />)
          ) : (
            <Empty />
          )}
        </div>
      );
    if (screen === 15)
      return (
        <form
          className="panel"
          onSubmit={submit(async () => {
            await api("request.create", {
              origin,
              destination,
              departure,
              direction,
            });
            setNotice("طلب خطك اتسجل.");
          })}
        >
          <Field
            label="منين؟"
            required
            minLength={2}
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
          />
          <Field
            label="لفين؟"
            required
            minLength={2}
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          />
          <Field
            label="الميعاد"
            type="time"
            required
            value={departure}
            onChange={(e) => setDeparture(e.target.value)}
          />
          <Select
            label="المشوار"
            value={direction}
            onChange={setDirection}
            options={{
              outbound: "ذهاب",
              return: "عودة",
              round_trip: "ذهاب وعودة",
            }}
          />
          <button disabled={busy}>سجّل احتياجي</button>
        </form>
      );
    if ([20, 21, 22, 23, 53, 54].includes(screen)) {
      if (!booking)
        return (
          <Empty>
            اختار اشتراكك الأول.{" "}
            <button onClick={() => go(profile?.role === "captain" ? 52 : 29)}>
              الاشتراكات
            </button>
          </Empty>
        );
      return (
        <>
          <BookingCard b={booking} />
          <Panel>
            <p>{copy.pay}</p>
            <p>
              {booking.rider_paid_at
                ? "الراكب أكد الدفع."
                : "مستنيين تأكيد الراكب."}
            </p>
            <p>
              {booking.captain_received_at
                ? "الكابتن أكد الاستلام."
                : "مستنيين تأكيد الكابتن."}
            </p>
            <button
              disabled={
                busy ||
                booking.status === "disputed" ||
                (profile?.role === "captain"
                  ? Boolean(booking.captain_received_at)
                  : Boolean(booking.rider_paid_at))
              }
              onClick={() =>
                void run(async () => {
                  const b = await api<Booking>(
                    profile?.role === "captain"
                      ? "payment.received"
                      : "payment.paid",
                    { bookingId: booking.id },
                  );
                  setBooking({ ...booking, ...b });
                  setRevision((v) => v + 1);
                })
              }
            >
              {profile?.role === "captain" ? "تم الاستلام" : "تم الدفع"}
            </button>
            <p>{copy.renewalDisabled}</p>
            <Field
              label="فيه مشكلة؟ وضّحها للدعم"
              minLength={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <button
              className="secondary"
              disabled={busy || body.trim().length < 5}
              onClick={() =>
                void run(async () => {
                  await api("dispute.open", {
                    bookingId: booking.id,
                    reason: body,
                  });
                  setBooking({ ...booking, status: "disputed" });
                  setNotice("الحالة اتبعتت للمراجعة.");
                })
              }
            >
              افتح مراجعة للحجز
            </button>
          </Panel>
        </>
      );
    }
    if ([29, 30, 52, 55, 56, 58, 61].includes(screen)) {
      const bs = bookings.filter((b) =>
        screen === 55
          ? b.status === "confirmed"
          : screen === 30 || screen === 58
            ? ["completed", "cancelled"].includes(b.status)
            : screen === 56
              ? b.starts_on >
                new Intl.DateTimeFormat("en-CA", {
                  timeZone: "Africa/Cairo",
                }).format(new Date())
              : true,
      );
      return (
        <div className="cards">
          {bs.length ? (
            bs.map((b) => <BookingCard key={b.id} b={b} />)
          ) : (
            <Empty />
          )}
        </div>
      );
    }
    if ([24, 25, 26, 27, 28].includes(screen))
      return (
        <>
          <Panel>
            <p>الرصيد المتاح</p>
            <h2 className="balance">{money(balance.available)}</h2>
            <p className="muted">المحجوز: {money(balance.reserved)}</p>
            <p>{copy.security}</p>
            <p>{copy.moneyDisabled}</p>
            <div className="actions">
              <button disabled>شحن الرصيد</button>
              <button disabled className="secondary">
                سحب الرصيد
              </button>
              <button className="secondary" onClick={() => go(28)}>
                سجل المعاملات
              </button>
            </div>
          </Panel>
          {screen === 26 ? (
            <Empty>مفيش عملية شحن مكتملة.</Empty>
          ) : (
            <JsonRows rows={rows} />
          )}
        </>
      );
    if ([31, 63].includes(screen))
      return (
        <>
          {rows.map((row) => (
            <Panel key={String(row.id)}>
              <p>محادثة محفوظة</p>
              <button
                onClick={() => {
                  setConversation(String(row.id));
                  go(32);
                }}
              >
                افتح المحادثة
              </button>
            </Panel>
          ))}
          {!rows.length && <Empty>اختار خط عشان تفتح محادثة مع الكابتن.</Empty>}
          {screen === 63 && <button onClick={() => go(36)}>كلّم الدعم</button>}
        </>
      );
    if (screen === 32)
      return conversation ? (
        <>
          <JsonRows rows={rows} />
          <form
            className="panel"
            onSubmit={submit(async () => {
              await api("message.send", { conversationId: conversation, body });
              setBody("");
              setRevision((v) => v + 1);
            })}
          >
            <Field
              label="رسالتك"
              required
              maxLength={2000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <button disabled={busy}>ابعت الرسالة</button>
          </form>
        </>
      ) : (
        <Empty>اختار محادثة الأول.</Empty>
      );
    if ([33, 62].includes(screen)) return <JsonRows rows={rows} />;
    if (screen === 34)
      return (
        <Panel>
          <h2>{profile?.full_name}</h2>
          <p>{profile?.role === "captain" ? "كابتن" : "راكب"}</p>
          <div className="actions">
            <button onClick={() => go(35)}>تعديل بياناتي</button>
            <button onClick={() => go(24)}>محفظتي</button>
            <button onClick={() => go(36)}>المساعدة</button>
            <button
              className="secondary"
              onClick={() =>
                void run(async () => {
                  if (client) await client.auth.signOut();
                  setProfile(null);
                  go(8);
                })
              }
            >
              تسجيل الخروج
            </button>
          </div>
        </Panel>
      );
    if (screen === 36)
      return (
        <form
          className="panel"
          onSubmit={submit(async () => {
            await api("support.create", { body });
            setBody("");
            setNotice("رسالتك وصلت للدعم.");
          })}
        >
          <label className="field">
            <span>قولنا نساعدك إزاي؟</span>
            <textarea
              required
              minLength={5}
              maxLength={4000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <button disabled={busy}>ابعت للدعم</button>
        </form>
      );
    if ([38, 42].includes(screen))
      return (
        <form
          className="panel"
          onSubmit={submit(async () => {
            await api("captain.save", { experience: body });
            go(39);
          })}
        >
          <Field
            label="عرّفنا بخبرتك وخطوطك"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <button disabled={busy}>احفظ وكمّل</button>
          <button type="button" className="secondary" onClick={() => go(43)}>
            تابع حالة الاعتماد
          </button>
        </form>
      );
    if ([39, 41].includes(screen))
      return (
        <Panel>
          <Select
            label="نوع المستند"
            value={documentKind}
            onChange={setDocumentKind}
            options={
              screen === 39
                ? { driving_license: "رخصة القيادة", identity: "إثبات الهوية" }
                : {
                    vehicle_license: "رخصة العربية",
                    vehicle_photo: "صورة العربية",
                  }
            }
          />
          <Field
            label="تاريخ الانتهاء — لو موجود"
            type="date"
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
          />
          <Field
            label="صورة المستند — حتى 5 ميجابايت"
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              void run(async () => {
                if (!client || !profile) throw new Error("AUTH_REQUIRED");
                if (
                  file.size > 5 * 1024 * 1024 ||
                  !["image/jpeg", "image/png", "application/pdf"].includes(
                    file.type,
                  )
                )
                  throw new Error("INVALID_FILE");
                const path = `${profile.id}/${crypto.randomUUID()}`;
                const { error } = await client.storage
                  .from("sekka-v2-documents")
                  .upload(path, file, {
                    contentType: file.type,
                    upsert: false,
                  });
                if (error) throw error;
                await api("document.save", {
                  kind: documentKind,
                  path,
                  expiresOn,
                });
                setNotice("المستند اترفع للمراجعة.");
              });
            }}
          />
          <button onClick={() => go(screen === 39 ? 40 : 42)}>
            كمّل البيانات
          </button>
        </Panel>
      );
    if (screen === 40)
      return (
        <form
          className="panel"
          onSubmit={submit(async () => {
            await api("vehicle.save", {
              category: category || "PRIME",
              model,
              plate,
            });
            go(41);
          })}
        >
          <Select
            label="الفئة"
            value={category || "PRIME"}
            onChange={setCategory}
            options={{
              PRIME: "PRIME",
              SAVER: "SAVER",
              SPACE: "SPACE",
              MAX: "MAX",
            }}
          />
          <Field
            label="موديل العربية"
            required
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />
          <Field
            label="رقم اللوحة"
            required
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
          />
          <button disabled={busy}>احفظ وكمّل</button>
        </form>
      );
    if ([43, 59, 60].includes(screen))
      return (
        <>
          <JsonRows rows={rows} />
          <button onClick={() => go(38)}>كمّل أو عدّل بياناتك</button>
        </>
      );
    if ([44, 45].includes(screen))
      return (
        <>
          <button onClick={() => go(46)}>أضف خطك</button>
          <JsonRows rows={rows} />
        </>
      );
    if (screen === 57) return <JsonRows rows={rows} />;
    if (screen >= 46 && screen <= 51)
      return (
        <form
          className="panel"
          onSubmit={submit(async () => {
            if (screen < 51) {
              go(screen + 1);
              return;
            }
            await api("route.create", {
              origin,
              destination,
              outbound: departure,
              returnTime: direction === "outbound" ? "" : returnTime,
              anchor,
              seats: Number(seats),
              prices: [
                { period: "weekly", direction, amount: Number(weekly) },
                { period: "monthly", direction, amount: Number(monthly) },
              ],
            });
            go(45);
          })}
        >
          {screen === 46 && (
            <>
              <Field
                label="نقطة الانطلاق"
                required
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
              />
              <Field
                label="الوجهة"
                required
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              />
            </>
          )}
          {screen === 47 && (
            <>
              <Select
                label="الاتجاه المتاح"
                value={direction}
                onChange={setDirection}
                options={{
                  outbound: "ذهاب",
                  return: "عودة",
                  round_trip: "ذهاب وعودة",
                }}
              />
              <Field
                label="ميعاد الذهاب"
                type="time"
                required
                value={departure}
                onChange={(e) => setDeparture(e.target.value)}
              />
              {direction !== "outbound" && (
                <Field
                  label="ميعاد العودة"
                  type="time"
                  required
                  value={returnTime}
                  onChange={(e) => setReturnTime(e.target.value)}
                />
              )}
            </>
          )}
          {screen === 48 && (
            <>
              <p>التشغيل من الأحد للخميس، باستثناء الإجازات الرسمية.</p>
              <Field
                label="بداية دورة تشغيل الخط القائم"
                type="date"
                required
                value={anchor}
                onChange={(e) => setAnchor(e.target.value)}
              />
              <p className="muted">
                دي بداية دورة الخط. بداية اشتراك الراكب هتتحسب تلقائيًا.
              </p>
            </>
          )}
          {screen === 49 && (
            <>
              <p>الفئة بتتحدد من العربية المعتمدة.</p>
              <Field
                label="المقاعد اللي هتتيحها على سِكّة"
                type="number"
                min="1"
                max="13"
                required
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
              />
            </>
          )}
          {screen === 50 && (
            <>
              <Field
                label="السعر الأسبوعي — جنيه"
                type="number"
                min="1"
                required
                value={weekly}
                onChange={(e) => setWeekly(e.target.value)}
              />
              <Field
                label="السعر الشهري — جنيه"
                type="number"
                min="1"
                required
                value={monthly}
                onChange={(e) => setMonthly(e.target.value)}
              />
            </>
          )}
          {screen === 51 && (
            <>
              <h2>
                {origin} ← {destination}
              </h2>
              <p>
                {departure} · {returnTime}
              </p>
              <p>
                {seats} مقاعد · بداية الدورة {anchor}
              </p>
              <p>
                {money(Number(weekly))} أسبوعي · {money(Number(monthly))} شهري
              </p>
            </>
          )}
          <button disabled={busy}>
            {screen === 51 ? "انشر خطك" : "احفظ وكمّل"}
          </button>
        </form>
      );
    if (screen >= 64)
      return (
        <>
          <div className="admin-tabs">
            {Object.keys(adminResources).map((id) => (
              <button
                className="secondary"
                key={id}
                onClick={() => go(Number(id))}
              >
                {screenTitles[Number(id) - 1]}
              </button>
            ))}
          </div>
          <JsonRows rows={rows} />
          {[65, 66].includes(screen) &&
            rows.map((row) => (
              <Panel key={String(row.id ?? row.user_id)}>
                <p>مراجعة {String(row.id ?? row.user_id)}</p>
                <div className="actions">
                  {["approved", "changes_requested", "rejected"].map(
                    (status) => (
                      <button
                        className="secondary"
                        key={status}
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await api("admin.review", {
                              resource: adminResources[screen],
                              id: row.id ?? row.user_id,
                              status,
                            });
                            setRevision((v) => v + 1);
                          })
                        }
                      >
                        {status === "approved"
                          ? "اعتماد"
                          : status === "rejected"
                            ? "رفض"
                            : "محتاج تعديل"}
                      </button>
                    ),
                  )}
                </div>
              </Panel>
            ))}
          {screen === 75 && (
            <p>
              تعديل الصلاحيات وتشغيل الأموال الحقيقية محتاجين اعتماد منفصل. سجل
              التدقيق ظاهر للمراجعة.
            </p>
          )}
        </>
      );
    return <Empty />;
  }
  if (bookingScreens.includes(screen) || screen === 23)
    return (
      <BookingFlow
        screen={screen === 23 ? 22 : screen}
        theme={theme}
        onTheme={changeTheme}
        go={go}
        offer={bookingOffer}
        route={route}
        period={period}
        direction={direction}
        quote={quote}
        booking={booking}
        balance={balance}
        signedIn={signedIn}
        busy={busy}
        error={error}
        onQuote={async () => {
          if (!signedIn) throw new Error("AUTH_REQUIRED");
          if (!route) throw new Error("ROUTE_UNAVAILABLE");
          const next = await api<Quote>("quote", {
            routeId: route.id,
            period,
            direction,
          });
          setQuote(next);
          return next;
        }}
        onPaid={async () => {
          if (!booking || !signedIn || profile?.role !== "rider")
            throw new Error("AUTH_REQUIRED");
          const result = await api<Booking>("payment.paid", {
            bookingId: booking.id,
          });
          const next = { ...booking, ...result };
          setBooking(next);
          setRevision((v) => v + 1);
          return next;
        }}
        onRefresh={async () => {
          if (!booking || !signedIn) throw new Error("AUTH_REQUIRED");
          const items = await api<Booking[]>("bookings");
          const next = items.find((b) => b.id === booking.id) || null;
          setBookings(items);
          setBooking(next);
          return next;
        }}
        onDispute={async (reason) => {
          if (!booking || !signedIn) throw new Error("AUTH_REQUIRED");
          await api("dispute.open", { bookingId: booking.id, reason });
          setBooking({ ...booking, status: "disputed" });
          setRevision((v) => v + 1);
        }}
      />
    );
  if (discoveryScreens.includes(screen) || screen === 9)
    return (
      <Discovery
        screen={screen}
        theme={theme}
        onTheme={changeTheme}
        go={go}
        routes={routes}
        route={route}
        bookings={bookings}
        signedIn={signedIn}
        busy={busy}
        error={error}
        onSearch={(q) => {
          setOrigin(q.origin);
          setDestination(q.destination);
          setDeparture(q.outbound);
          setReturnTime(q.returnTime);
          setPeriod(q.period);
          setCategory(q.category);
        }}
        onSelect={(r, offerPeriod, offerDirection) => {
          setRoute(r);
          setPeriod(offerPeriod);
          setDirection(offerDirection);
          go(12, r.id);
        }}
        onBook={(offer) => {
          setBookingOffer(offer);
          setPeriod(offer.period);
          setDirection(offer.direction);
          setQuote(null);
          go(16, offer.routeId);
          const url = new URL(location.href);
          if (offer.id.startsWith("preview-"))
            url.searchParams.set("offer", offer.id);
          url.searchParams.set("offerPeriod", offer.period);
          url.searchParams.set("offerDirection", offer.direction);
          history.replaceState({}, "", url);
        }}
        onBooking={(id) => {
          const b = bookings.find((b) => b.id === id);
          if (b) {
            setBooking(b);
            go(19, undefined, b.id);
          }
        }}
        onRequest={async (payload) => {
          await api("request.create", payload);
        }}
        onFavorite={async (routeId) => {
          await api("favorite.toggle", { routeId });
          setRevision((v) => v + 1);
        }}
      />
    );
  if ([1, 2, 3, 4, 5, 6, 7, 37].includes(screen))
    return (
      <Onboarding
        screen={screen}
        theme={theme}
        onTheme={changeTheme}
        go={go}
        role={role}
        onRole={setRole}
      >
        {error && (
          <div className="status error" role="alert">
            {error}
          </div>
        )}
        {busy && <p role="status">{copy.loading}</p>}
        {![1, 2, 3, 37].includes(screen) && content()}
      </Onboarding>
    );
  return (
    <div className="app">
      <a className="skip" href="#content">
        روح للمحتوى
      </a>
      <header>
        <a
          href="?screen=8"
          onClick={(e) => {
            e.preventDefault();
            go(8);
          }}
          className="brand"
        >
          <Wordmark />
          <span>
            {copy.brand}
            <small>{copy.tagline}</small>
          </span>
        </a>
        <div className="header-actions">
          <button
            className="text-button"
            onClick={() => changeTheme(theme === "light" ? "dark" : "light")}
            aria-label="تغيير المظهر"
          >
            ◐
          </button>
          <button className="secondary" onClick={() => go(signedIn ? 34 : 3)}>
            {signedIn ? (profile?.full_name ?? "حسابي") : "سجّل دخولك"}
          </button>
        </div>
      </header>
      <div className="workspace">
        <aside>
          <p className="eyebrow">مشوارك اليومي، متظبّط.</p>
          {(profile?.role === "captain"
            ? [44, 45, 52, 55, 59, 62, 63]
            : [8, 14, 29, 24, 31, 33, 34]
          ).map((id) => (
            <button
              className={screen === id ? "active" : "text-button"}
              key={id}
              onClick={() => go(id)}
            >
              {screenTitles[id - 1]}
            </button>
          ))}
          {Boolean(profile?.permissions?.length) && (
            <button onClick={() => go(64)}>الإدارة</button>
          )}
          <div className="sidebar-note">
            اشتراكات ثابتة
            <br />
            الأحد للخميس
            <br />
            <span>القاهرة الكبرى</span>
          </div>
        </aside>
        <main id="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                seKKa / {String(screen).padStart(2, "0")}
              </p>
              <h2>{screenTitles[screen - 1]}</h2>
            </div>
            {screen !== 8 && (
              <button
                className="text-button"
                onClick={() => go(profile?.role === "captain" ? 44 : 8)}
              >
                الرئيسية ←
              </button>
            )}
          </div>
          {!client && (
            <div className="status warning">
              النسخة الجديدة تحت التجهيز. الخطوط والحجز هيتاحوا بعد توصيل بيئة
              الاختبار.
            </div>
          )}
          {error && (
            <div role="alert" className="status error">
              {error}
              <button
                className="text-button"
                onClick={() => setRevision((v) => v + 1)}
              >
                {copy.retry}
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="status">
              {notice}
            </div>
          )}
          {busy && (
            <p role="status" className="muted">
              {copy.loading}
            </p>
          )}
          {content()}
          <footer>سِكّة · معاك في السِكّة</footer>
        </main>
      </div>
      <nav className="bottom-nav" aria-label="التنقل الرئيسي">
        {(profile?.role === "captain" ? [44, 45, 52, 59] : [8, 29, 24, 34]).map(
          (id) => (
            <button
              key={id}
              className={screen === id ? "active" : "text-button"}
              onClick={() => go(id)}
            >
              {screenTitles[id - 1]}
            </button>
          ),
        )}
      </nav>
    </div>
  );
}
