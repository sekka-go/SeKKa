import { useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import { Wordmark } from "./Onboarding";
import type { Appearance } from "./Onboarding";
import type { Route, Booking } from "./api";
import "./discovery.css";

export const discoveryScreens = [8, 10, 11, 12, 13, 14, 29, 15];
const titles: Record<number, string> = {
  8: "تخطيط رحلة",
  9: "تخطيط رحلة",
  10: "تصفية البحث",
  11: "نتائج البحث",
  12: "تفاصيل الخط",
  13: "تفاصيل الحجز",
  14: "المفضلة",
  29: "اشتراكاتي",
  15: "اطلب خط",
};
const areas = [
  "المعادي",
  "التجمع",
  "الزمالك",
  "الشيخ زايد",
  "مدينة نصر",
  "6 أكتوبر",
  "الدقي",
  "المهندسين",
  "مصر الجديدة",
  "العبور",
  "الشروق",
];
// Only Cairo and Giza districts are available in this launch region.
const servedAreas = areas.filter((a) => !["العبور", "الشروق"].includes(a));
const categoryList = [
  { name: "PRIME", seats: 3 },
  { name: "SAVER", seats: 4 },
  { name: "SPACE", seats: 9 },
  { name: "MAX", seats: 13 },
];
export type Line = {
  id: string;
  routeId?: string;
  origin: string;
  destination: string;
  category: string;
  available: number;
  outbound: string;
  returnTime: string;
  period: string;
  direction: string;
  amount: number | null;
  captain?: string;
  rating?: number;
};
export const examples: Line[] = [
  {
    id: "preview-prime",
    origin: "المعادي",
    destination: "التجمع",
    category: "PRIME",
    available: 3,
    outbound: "07:30",
    returnTime: "17:00",
    period: "monthly",
    direction: "round_trip",
    amount: 2800,
    captain: "كابتن أحمد",
    rating: 4.8,
  },
  {
    id: "preview-saver",
    origin: "المعادي",
    destination: "التجمع",
    category: "SAVER",
    available: 2,
    outbound: "07:30",
    returnTime: "",
    period: "weekly",
    direction: "outbound",
    amount: 850,
    captain: "كابتن محمد",
    rating: 4.7,
  },
  {
    id: "preview-space",
    origin: "المعادي",
    destination: "التجمع",
    category: "SPACE",
    available: 6,
    outbound: "",
    returnTime: "17:00",
    period: "monthly",
    direction: "return",
    amount: 3400,
    captain: "كابتن كريم",
    rating: 4.9,
  },
];
export const favoriteExamples: Line[] = [
  { ...examples[0], id: "preview-favorite-prime", amount: 3200 },
  {
    ...examples[2],
    id: "preview-favorite-space",
    origin: "الزمالك",
    destination: "الشيخ زايد",
    outbound: "08:00",
    returnTime: "18:00",
    direction: "round_trip",
    amount: 4800,
  },
  {
    ...examples[1],
    id: "preview-favorite-saver",
    origin: "مدينة نصر",
    destination: "6 أكتوبر",
    outbound: "07:00",
    returnTime: "16:30",
    period: "monthly",
    direction: "round_trip",
    amount: 2600,
  },
];
const periodLabel = (v: string) => (v === "monthly" ? "شهري" : "أسبوعي");
const directionLabel = (v: string) =>
  v === "round_trip"
    ? "ذهاب وعودة"
    : v === "outbound"
      ? "ذهاب فقط"
      : "عودة فقط";
function toLines(r: Route): Line[] {
  return r.prices.map((price) => ({
    id: `${r.id}:${price.period}:${price.direction}`,
    routeId: r.id,
    origin: r.origin,
    destination: r.destination,
    category: r.category,
    available: Math.min(
      r.seats,
      categoryList.find((c) => c.name === r.category)?.seats ?? r.seats,
    ),
    outbound: price.direction === "return" ? "" : r.outbound?.slice(0, 5) || "",
    returnTime:
      price.direction === "outbound" ? "" : r.return_time?.slice(0, 5) || "",
    period: price.period,
    direction: price.direction,
    amount: price.amount,
  }));
}
const iconPaths: Record<string, ReactNode> = {
  back: <path d="m19 5-10 11 10 11" />,
  arrow: <path d="M4 16h24m-9-9 9 9-9 9" />,
  swap: (
    <>
      <path d="M3 10h26m-6-6 6 6-6 6M29 23H3m6-6-6 6 6 6" />
    </>
  ),
  pin: (
    <>
      <path d="M16 29S6 18 6 11a10 10 0 0 1 20 0c0 7-10 18-10 18Z" />
      <circle cx="16" cy="11" r="3" />
    </>
  ),
  car: (
    <>
      <path d="m5 13 3-8h16l3 8M3 14h26v11H3Zm3 11v3m20-3v3M7 18h3m12 0h3" />
    </>
  ),
  bus: (
    <>
      <rect x="2" y="7" width="28" height="18" rx="4" />
      <path d="M3 18h26M10 8v10m10-10v10" />
      <circle cx="8" cy="26" r="3" />
      <circle cx="24" cy="26" r="3" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="6" width="24" height="23" rx="3" />
      <path d="M10 3v7m12-7v7M4 14h24m-18 5h2m5 0h2m5 0h1m-15 5h2m5 0h2" />
    </>
  ),
  sun: (
    <>
      <circle cx="16" cy="16" r="7" />
      <path d="M16 1v4m0 22v4M1 16h4m22 0h4M5 5l3 3m16 16 3 3M5 27l3-3M24 8l3-3" />
    </>
  ),
  moon: <path d="M27 21A13 13 0 0 1 11 3a13 13 0 1 0 16 18Z" />,
  seat: (
    <>
      <path d="M10 13V6c0-5 12-5 12 0v7m-14 0h16l2 12H6Zm1 12v4m14-4v4M9 20h14" />
    </>
  ),
  filter: <path d="M3 3h26L19 16v12l-6-3v-9Z" />,
  heart: <path d="M16 28 4 16C-5 5 10-1 16 8 22-1 37 5 28 16Z" />,
  check: (
    <>
      <circle cx="16" cy="16" r="12" />
      <path d="m10 16 4 4 8-9" />
    </>
  ),
  route: (
    <>
      <circle cx="8" cy="24" r="4" />
      <circle cx="24" cy="8" r="4" />
      <path d="M8 20v-4c0-7 16 7 16-4" />
    </>
  ),
  clipboard: (
    <>
      <rect x="6" y="5" width="21" height="25" rx="3" />
      <path d="M12 3h10v5H12Zm0 11h10m-10 6h10m-10 6h10" />
    </>
  ),
  wifi: (
    <>
      <path d="M2 10a23 23 0 0 1 28 0M7 16a15 15 0 0 1 18 0m-13 6a7 7 0 0 1 8 0" />
      <circle cx="16" cy="28" r="1" />
    </>
  ),
  snow: (
    <path d="M16 2v28M4 9l24 14M4 23 28 9M11 5l5 5 5-5M11 27l5-5 5 5M5 5l1 7-6 2m31 4-6 2 1 7M5 27l1-7-6-2m31-4-6-2 1-7" />
  ),
  user: (
    <>
      <circle cx="16" cy="9" r="6" />
      <path d="M4 29v-4c0-11 24-11 24 0v4Z" />
    </>
  ),
  chat: (
    <>
      <path d="M4 4h24v18H14l-8 8v-8H4Z" />
      <path d="M9 12h1m5 0h1m5 0h1" />
    </>
  ),
  phone: <path d="M8 3 3 8c0 10 11 21 21 21l5-5-8-6-4 4-7-7 4-4Z" />,
  settings: (
    <>
      <path d="m12 3-2 5-5 1-2 5 4 4-1 6 5 3 5-3 5 3 5-3-1-6 4-4-2-5-5-1-2-5Z" />
      <circle cx="16" cy="16" r="5" />
    </>
  ),
  pen: <path d="m3 29 3-10L24 1l7 7-18 18Zm4-10 6 7M20 5l7 7" />,
  send: <path d="m2 13 28-11-9 28-6-12Zm13 5L30 2" />,
  star: <path d="m16 2 4 9 10 1-8 7 3 11-9-6-9 6 3-11-8-7 10-1Z" />,
  info: (
    <>
      <circle cx="16" cy="16" r="13" />
      <path d="M16 14v9m0-16v2" />
    </>
  ),
};
export function DiscoveryIcon({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  return (
    <svg
      className={`discovery-icon ${className}`}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconPaths[name] || iconPaths.car}
    </svg>
  );
}
function Art({
  source,
  crop,
  theme,
  className = "",
}: {
  source: number;
  crop: [number, number, number, number];
  theme: Appearance;
  className?: string;
}) {
  const [x, y, w, h] = crop;
  const style = {
    aspectRatio: `${w}/${h}`,
    "--source-width": `${(1536 / w) * 100}%`,
    "--source-left": `${(-(x + (theme === "light" ? 768 : 0)) / w) * 100}%`,
    "--source-top": `${(-y / h) * 100}%`,
  } as CSSProperties;
  return (
    <span
      className={`reference-art ${className}`}
      style={style}
      aria-hidden="true"
    >
      <img src={`/references/phase-2/${source}.png`} alt="" draggable={false} />
    </span>
  );
}
const money = (v: number | null) =>
  v === null ? "السعر مش متاح" : `${v.toLocaleString("en-US")} ج.م`;
function time(v: string) {
  if (!v) return "—";
  const [hh, mm] = v.split(":");
  const h = Number(hh);
  return `${String(h % 12 || 12).padStart(2, "0")}:${mm} ${h < 12 ? "ص" : "م"}`;
}
function Action({
  children,
  onClick,
  disabled = false,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`d-primary ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
      <DiscoveryIcon name="arrow" />
    </button>
  );
}
function Journey({ line, compact = false }: { line: Line; compact?: boolean }) {
  return (
    <div className={`d-journey ${compact ? "compact" : ""}`}>
      <div className="d-locations">
        <span>
          <DiscoveryIcon name="pin" />
          {line.origin}
        </span>
        <DiscoveryIcon name="swap" />
        <span>
          <DiscoveryIcon name="pin" />
          {line.destination}
        </span>
      </div>
      <div className="d-times">
        <span>
          <DiscoveryIcon name="sun" />
          <span>
            الذهاب{compact ? ":" : ""} <b dir="auto">{time(line.outbound)}</b>
          </span>
        </span>
        <span>
          <DiscoveryIcon name="moon" />
          <span>
            العودة{compact ? ":" : ""} <b dir="auto">{time(line.returnTime)}</b>
          </span>
        </span>
      </div>
    </div>
  );
}
function Meta({
  label,
  children,
  icon,
}: {
  label: string;
  children: ReactNode;
  icon: string;
}) {
  return (
    <div className="d-meta">
      {icon && <DiscoveryIcon name={icon} />}
      <span>
        <small>{label}</small>
        <strong>{children}</strong>
      </span>
    </div>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="d-empty" role="status">
      <DiscoveryIcon name="info" />
      <p>{children}</p>
    </div>
  );
}
export type DiscoveryProps = {
  screen: number;
  theme: Appearance;
  onTheme: (t: Appearance) => void;
  go: (id: number) => void;
  routes: Route[];
  route: Route | null;
  bookings: Booking[];
  signedIn: boolean;
  busy: boolean;
  error: string;
  onSearch: (p: {
    origin: string;
    destination: string;
    outbound: string;
    returnTime: string;
    period: string;
    category: string;
  }) => void;
  onSelect: (r: Route, period: string, direction: string) => void;
  onRequest: (p: Record<string, unknown>) => Promise<void>;
  onFavorite: (id: string) => Promise<void>;
  onBook: (offer: Line) => void;
  onBooking: (id: string) => void;
};
export default function Discovery(p: DiscoveryProps) {
  const { screen, theme, onTheme, go } = p;
  const demo = new URLSearchParams(location.search).get("preview") === "phase2";
  const [origin, setOrigin] = useState(demo ? "المعادي" : ""),
    [destination, setDestination] = useState(demo ? "التجمع" : "");
  const [outbound, setOutbound] = useState("07:30"),
    [returnTime, setReturnTime] = useState("17:00"),
    [period, setPeriod] = useState("monthly");
  const [categories, setCategories] = useState<string[]>([]),
    [selectedId, setSelectedId] = useState(examples[0].id),
    [favorites, setFavorites] = useState(favoriteExamples.map((r) => r.id));
  const [favoriteDetail, setFavoriteDetail] = useState<Line | null>(null);
  const [past, setPast] = useState(false),
    [notes, setNotes] = useState(""),
    [message, setMessage] = useState(""),
    [sending, setSending] = useState(false),
    [modal, setModal] = useState("");
  const lines = demo ? examples : p.routes.flatMap(toLines);
  const selected = demo
    ? favoriteDetail || examples.find((l) => l.id === selectedId) || examples[0]
    : p.route
      ? toLines(p.route).find((l) => l.id === selectedId) ||
        toLines(p.route)[0] ||
        null
      : null;
  const current: Line = selected || {
    ...examples[0],
    origin,
    destination,
    outbound,
    returnTime,
  };
  const queryLine = {
    ...current,
    origin: origin || "منطقة الانطلاق",
    destination: destination || "منطقة الوصول",
    outbound,
    returnTime,
  };
  const [appliedFilters, setAppliedFilters] = useState(false);
  const filtered = lines.filter(
    (l) =>
      (!categories.length || categories.includes(l.category)) &&
      (!appliedFilters || l.period === period),
  );
  const favoritesList = demo
    ? favoriteExamples.filter((l) => favorites.includes(l.id))
    : lines;
  const heading = titles[screen];
  const titleIcon = (
    {
      8: "route",
      9: "route",
      10: "filter",
      11: "car",
      12: "clipboard",
      13: "calendar",
      14: "heart",
      29: "calendar",
      15: "bus",
    } as Record<number, string>
  )[screen];
  function nav(id: number) {
    setMessage("");
    go(id);
  }
  function openLine(l: Line) {
    setFavoriteDetail(l);
    setSelectedId(l.id);
    if (!demo) {
      const r = p.routes.find((r) => r.id === l.routeId);
      if (r) p.onSelect(r, l.period, l.direction);
    } else nav(12);
  }
  function search() {
    setMessage("");
    if (!origin || !destination) {
      setMessage("اختار منطقة الانطلاق والوصول عشان نكمل.");
      return;
    }
    if (origin === destination) {
      setMessage("اختار منطقتين مختلفتين.");
      return;
    }
    if (demo) nav(11);
    else {
      p.onSearch({
        origin,
        destination,
        outbound,
        returnTime,
        period,
        category: categories.length === 1 ? categories[0] : "",
      });
      nav(11);
    }
  }
  async function favorite(id: string) {
    if (demo) {
      setFavorites((v) =>
        v.includes(id) ? v.filter((x) => x !== id) : [...v, id],
      );
    } else {
      try {
        await p.onFavorite(id);
      } catch {
        setMessage("حفظ الخط محتاج تسجيل الدخول واتصال بالخدمة.");
      }
    }
  }
  async function request(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    if (!origin || !destination || origin === destination) {
      setMessage("اختار منطقتين مختلفتين للانطلاق والوصول.");
      return;
    }
    if (demo) {
      setMessage("دي معاينة للطلب بس. لم يتم إرسال طلب فعلي.");
      return;
    }
    if (!p.signedIn) {
      setMessage("سجّل الدخول الأول عشان تبعت طلبك.");
      return;
    }
    setSending(true);
    try {
      await p.onRequest({
        origin,
        destination,
        departure: outbound,
        returnTime,
        period,
        direction: "round_trip",
        body: notes,
      });
      setMessage("طلبك اتسجل. هنبلغك لما يظهر خط مناسب.");
    } catch {
      setMessage("الطلب متبعتش. جرّب تاني لما الخدمة تبقى متاحة.");
    } finally {
      setSending(false);
    }
  }
  const areaSelect = (
    value: string,
    onChange: (v: string) => void,
    label: string,
  ) => (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required
    >
      <option value="" disabled>
        {label}
      </option>
      {servedAreas.map((a) => (
        <option key={a}>{a}</option>
      ))}
    </select>
  );
  const periodChoices = (
    <div className="d-periods">
      {["monthly", "weekly"].map((v) => (
        <button
          type="button"
          key={v}
          aria-pressed={period === v}
          className={period === v ? "selected" : ""}
          onClick={() => setPeriod(v)}
        >
          <DiscoveryIcon name="calendar" />
          {v === "monthly" ? "شهري" : "أسبوعي"}
          <span className="d-radio" />
        </button>
      ))}
    </div>
  );
  return (
    <div className={`phase-one-stage discovery-stage ${theme}`}>
      <nav
        className="phase-review-bar d-review"
        aria-label="معاينة المرحلة الثانية"
      >
        <div className="review-screen-nav">
          <button
            onClick={() =>
              nav(
                discoveryScreens[
                  Math.max(0, discoveryScreens.indexOf(screen) - 1)
                ],
              )
            }
            aria-label="الشاشة السابقة"
          >
            ‹
          </button>
          <label>
            الشاشة{" "}
            <select
              aria-label="شاشة المرحلة الثانية"
              value={screen === 9 ? 8 : screen}
              onChange={(e) => nav(Number(e.target.value))}
            >
              {discoveryScreens.map((id) => (
                <option key={id} value={id}>
                  {String(id).padStart(2, "0")} · {titles[id]}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() =>
              nav(
                discoveryScreens[
                  Math.min(7, discoveryScreens.indexOf(screen) + 1)
                ],
              )
            }
            aria-label="الشاشة التالية"
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
          ? "معاينة المرحلة الثانية · كل الأسماء والأسعار والحجوزات بيانات توضيحية فقط."
          : "سِكّة · القاهرة والجيزة"}
      </p>
      <main className={`phase-canvas d-canvas d-screen-${screen}`}>
        <header className="d-header">
          <button
            className="phase-back"
            aria-label="رجوع"
            onClick={() =>
              nav(
                screen === 8 ? 2 : screen === 13 ? 29 : screen === 12 ? 11 : 8,
              )
            }
          >
            <DiscoveryIcon name="back" />
          </button>
          <Wordmark />
        </header>
        <h1 className="d-title">
          <DiscoveryIcon name={titleIcon} />
          {heading}
        </h1>
        {p.busy && !demo && (
          <p className="d-feedback" role="status">
            بنحمّل البيانات…
          </p>
        )}
        {p.error && !demo && (
          <p className="d-feedback" role="alert">
            الخدمة مش متاحة دلوقتي. جرّب تاني بعد شوية.
          </p>
        )}
        {message && (
          <p className="d-feedback" role="status">
            {message}
          </p>
        )}
        {[8, 9].includes(screen) && (
          <>
            <p className="d-subtitle">
              حدد نقطة الانطلاق والوجهة، وابدأ رحلتك بسهولة
            </p>
            <form
              className="d-planner"
              onSubmit={(e) => {
                e.preventDefault();
                search();
              }}
            >
              <div className="d-planner-places">
                <label className="d-place">
                  <span className="sr-only">من أين؟</span>
                  {areaSelect(origin, setOrigin, "من أين؟")}
                  <span className="d-origin-dot" />
                </label>
                <button
                  type="button"
                  className="d-swap"
                  aria-label="تبديل الانطلاق والوصول"
                  onClick={() => {
                    setOrigin(destination);
                    setDestination(origin);
                  }}
                >
                  <DiscoveryIcon name="swap" />
                </button>
                <label className="d-place">
                  <span className="sr-only">إلى أين؟</span>
                  {areaSelect(destination, setDestination, "إلى أين؟")}
                  <DiscoveryIcon name="pin" />
                </label>
              </div>
              <div className="d-box d-time-picker">
                <label>
                  <DiscoveryIcon name="calendar" />
                  <span>الذهاب</span>
                  <input
                    aria-label="وقت الذهاب"
                    type="time"
                    value={outbound}
                    onChange={(e) => setOutbound(e.target.value)}
                    required
                  />
                </label>
                <label>
                  <DiscoveryIcon name="calendar" />
                  <span>العودة</span>
                  <input
                    aria-label="وقت العودة"
                    type="time"
                    value={returnTime}
                    onChange={(e) => setReturnTime(e.target.value)}
                    required
                  />
                </label>
              </div>
              <button className="d-primary" type="submit">
                ابحث عن الرحلات
                <DiscoveryIcon name="arrow" />
              </button>
            </form>
            <div className="d-road" aria-hidden="true" />
          </>
        )}
        {screen === 10 && (
          <>
            <p className="d-subtitle">
              خصص بحثك للعثور على الاشتراك المناسب لك
            </p>
            <section className="d-filter-section">
              <h2>
                <DiscoveryIcon name="car" />
                الفئة
              </h2>
              <div className="d-category-grid">
                {categoryList.map((c) => (
                  <button
                    key={c.name}
                    aria-pressed={categories.includes(c.name)}
                    onClick={() =>
                      setCategories((v) =>
                        v.includes(c.name)
                          ? v.filter((x) => x !== c.name)
                          : [...v, c.name],
                      )
                    }
                    className={categories.includes(c.name) ? "selected" : ""}
                  >
                    <DiscoveryIcon name={c.seats > 4 ? "bus" : "car"} />
                    <b dir="ltr">{c.name}</b>
                    <span>
                      {c.seats} {c.seats === 13 ? "مقعدًا" : "مقاعد"}
                    </span>
                  </button>
                ))}
              </div>
            </section>
            <section className="d-filter-section">
              <h2>
                <DiscoveryIcon name="calendar" />
                مدة الاشتراك
              </h2>
              {periodChoices}
            </section>
            <section className="d-filter-section">
              <h2>
                <DiscoveryIcon name="pin" />
                نطاق الخدمة
              </h2>
              <div className="d-box d-region">
                <div>
                  <strong>القاهرة والجيزة فقط</strong>
                  <span>داخل المناطق والأحياء</span>
                </div>
                <Art source={10} crop={[102, 746, 190, 88]} theme={theme} />
                <DiscoveryIcon name="info" />
              </div>
            </section>
            <Action
              onClick={() => {
                setAppliedFilters(true);
                if (!demo)
                  p.onSearch({
                    origin,
                    destination,
                    outbound,
                    returnTime,
                    period,
                    category: categories.length === 1 ? categories[0] : "",
                  });
                nav(11);
              }}
            >
              عرض النتائج
            </Action>
          </>
        )}
        {screen === 11 && (
          <>
            <p className="d-subtitle">اختر عرض الاشتراك المناسب لك</p>
            <section className="d-box d-results-summary">
              <span>
                <DiscoveryIcon name="pin" />
                {queryLine.origin}
              </span>
              <DiscoveryIcon name="swap" />
              <strong>{queryLine.destination}</strong>
              <button aria-label="تعديل الفلاتر" onClick={() => nav(10)}>
                <DiscoveryIcon name="calendar" />
                عروض متاحة: {filtered.length}
              </button>
            </section>
            <div className="d-result-list">
              {filtered.map((l) => (
                <article className="d-box d-result" key={l.id}>
                  <div className="d-offer-top">
                    <strong>
                      <DiscoveryIcon name="user" />
                      {l.captain || "عرض خط"}
                    </strong>
                    {l.rating && (
                      <b>
                        <DiscoveryIcon name="star" />
                        {l.rating}
                      </b>
                    )}
                    <span className="d-available">
                      <DiscoveryIcon name="seat" />
                      متاح {l.available} مقاعد
                    </span>
                  </div>
                  <button
                    className="d-offer-select"
                    onClick={() => openLine(l)}
                    aria-label={`عرض تفاصيل ${l.captain || l.category} ${periodLabel(l.period)} ${directionLabel(l.direction)}`}
                  >
                    <span className="d-category-badge">
                      <DiscoveryIcon
                        name={
                          l.category === "SPACE" || l.category === "MAX"
                            ? "bus"
                            : "car"
                        }
                      />
                      <b>{l.category}</b>
                    </span>
                    <span className="d-offer-direction">
                      <DiscoveryIcon
                        name={l.direction === "round_trip" ? "swap" : "arrow"}
                      />
                      <b>{directionLabel(l.direction)}</b>
                    </span>
                    <span className="d-offer-period">
                      <DiscoveryIcon name="calendar" />
                      {periodLabel(l.period)}
                    </span>
                    <span className="d-offer-price">
                      <strong dir="auto">{money(l.amount)}</strong>
                      <small>سعر الاشتراك</small>
                    </span>
                    <DiscoveryIcon name="back" />
                  </button>
                  <div className="d-times d-offer-times">
                    <span>
                      <DiscoveryIcon name="sun" />
                      وقت الذهاب <b dir="auto">{time(l.outbound)}</b>
                    </span>
                    <span>
                      <DiscoveryIcon name="moon" />
                      وقت العودة <b dir="auto">{time(l.returnTime)}</b>
                    </span>
                  </div>
                </article>
              ))}
            </div>
            {!filtered.length && <Empty>لسه مفيش خط مناسب.</Empty>}
            <button className="d-text-action" onClick={() => nav(15)}>
              لسه ملقتش خط مناسب؟ اطلب خط
            </button>
          </>
        )}
        {screen === 12 &&
          (selected ? (
            <>
              <section className="d-box d-detail-journey">
                <Journey line={current} compact />
              </section>
              <section className="d-box d-offer-facts">
                <Meta label="اتجاه الاشتراك" icon="swap">
                  {directionLabel(current.direction)}
                </Meta>
                <Meta label="نوع الاشتراك" icon="calendar">
                  {periodLabel(current.period)}
                </Meta>
                <Meta label="الفئة" icon="seat">
                  {current.category}
                </Meta>
                <Meta label="المقاعد المتاحة" icon="user">
                  {current.available} مقاعد
                </Meta>
              </section>
              <div className="d-box d-fixed-price">
                <span>
                  <DiscoveryIcon name="clipboard" />
                  سعر الاشتراك
                </span>
                <strong dir="auto">{money(current.amount)}</strong>
              </div>
              <div className="d-box d-information">
                <p>
                  الاشتراك يشمل الرحلات اليومية وفق المواعيد المحددة طوال مدة
                  الاشتراك.
                </p>
                <DiscoveryIcon name="info" />
              </div>
              <Action
                onClick={() => p.onBook(current)}
                disabled={current.amount === null}
              >
                حجز الاشتراك
              </Action>
              <button
                className="d-text-action"
                onClick={() => void favorite(current.routeId || current.id)}
              >
                <DiscoveryIcon name="heart" />
                حفظ في المفضلة
              </button>
            </>
          ) : (
            <Empty>اختار خط من نتائج البحث عشان تشوف تفاصيله.</Empty>
          ))}
        {screen === 13 &&
          (demo ? (
            <>
              <div className="d-booked-banner">
                <DiscoveryIcon name="check" />
                تم تأكيد حجزك
              </div>
              <section className="d-box">
                <Journey line={examples[0]} />
              </section>
              <section className="d-box d-three-meta">
                <Meta label="الاشتراك" icon="calendar">
                  شهري
                </Meta>
                <Meta label="الفئة" icon="car">
                  PRIME
                </Meta>
                <Meta label="عدد المقاعد" icon="seat">
                  3
                </Meta>
              </section>
              <section>
                <h2>
                  <DiscoveryIcon name="user" />
                  بيانات الكابتن
                </h2>
                <div className="d-box d-captain">
                  <Art
                    source={13}
                    crop={[602, 606, 99, 100]}
                    theme={theme}
                    className="d-avatar"
                  />
                  <div>
                    <strong>أحمد مصطفى</strong>
                    <span>
                      <DiscoveryIcon name="star" />
                      4.8 <small>(286 تقييمًا)</small>
                    </span>
                  </div>
                  <button
                    className="d-icon-button"
                    aria-label="محادثة الكابتن"
                    onClick={() =>
                      setModal("المحادثة مش متاحة لبيانات المعاينة.")
                    }
                  >
                    <DiscoveryIcon name="chat" />
                  </button>
                  <button
                    className="d-icon-button"
                    aria-label="اتصال بالكابتن"
                    onClick={() =>
                      setModal("بيانات الكابتن توضيحية. مفيش رقم فعلي للاتصال.")
                    }
                  >
                    <DiscoveryIcon name="phone" />
                  </button>
                </div>
              </section>
              <section>
                <h2>
                  <DiscoveryIcon name="car" />
                  بيانات السيارة
                </h2>
                <div className="d-box d-vehicle">
                  <Art
                    source={13}
                    crop={[500, 784, 215, 104]}
                    theme={theme}
                    className="d-car-art"
                  />
                  <div>
                    <strong>تويوتا كورولا</strong>
                    <span>
                      أبيض <i className="d-color-dot" />
                    </span>
                  </div>
                  <div className="d-plate">
                    <small>ر ل م</small>
                    <strong>7284</strong>
                  </div>
                </div>
              </section>
              <button
                className="d-outline"
                onClick={() =>
                  setModal(
                    "موقع الالتقاء بيتحدد من بيانات الحجز الفعلية. المعاينة لا تعرض موقعًا حقيقيًا.",
                  )
                }
              >
                <DiscoveryIcon name="pin" />
                موقع الالتقاء
                <DiscoveryIcon name="back" />
              </button>
            </>
          ) : (
            <Empty>
              بيانات الكابتن والعربية بتظهر بعد تأكيد حجزك. مفيش حجز مؤكد مختار
              دلوقتي.
            </Empty>
          ))}
        {screen === 14 && (
          <>
            <p className="d-subtitle">الخطوط التي قمت بحفظها</p>
            <div className="d-favorites">
              {favoritesList.map((l) => (
                <article key={l.id} className="d-box d-favorite">
                  <button
                    className="d-heart"
                    aria-label={`إزالة ${l.origin} إلى ${l.destination} من المفضلة`}
                    onClick={() => void favorite(l.id)}
                  >
                    <DiscoveryIcon name="heart" />
                  </button>
                  <Journey line={l} compact />
                  <div className="d-three-meta">
                    <Meta
                      label="الفئة"
                      icon={l.category === "SPACE" ? "bus" : "car"}
                    >
                      {l.category}
                    </Meta>
                    <Meta label="المقاعد المتاحة" icon="seat">
                      {l.available} مقاعد
                    </Meta>
                    <Meta label="اشتراك شهري" icon="">
                      {money(l.amount)}
                    </Meta>
                  </div>
                  <Action onClick={() => openLine(l)}>عرض التفاصيل</Action>
                </article>
              ))}
            </div>
            {!favoritesList.length && (
              <Empty>
                {p.signedIn || demo
                  ? "لسه مفيش خطوط محفوظة."
                  : "سجّل الدخول عشان تشوف المفضلة."}
              </Empty>
            )}
          </>
        )}
        {screen === 29 && (
          <>
            <div className="d-tabs">
              <button
                aria-pressed={!past}
                className={!past ? "selected" : ""}
                onClick={() => setPast(false)}
              >
                الاشتراكات الحالية {demo ? "(2)" : ""}
              </button>
              <button
                aria-pressed={past}
                className={past ? "selected" : ""}
                onClick={() => setPast(true)}
              >
                الاشتراكات السابقة
              </button>
            </div>
            {demo ? (
              past ? (
                <Empty>مفيش اشتراكات سابقة في المعاينة.</Empty>
              ) : (
                <div className="d-subscriptions">
                  {[examples[0], favoriteExamples[1]].map((l, i) => (
                    <article key={l.id} className="d-box d-subscription">
                      <div className="d-subscription-head">
                        <span>
                          <DiscoveryIcon name="calendar" />
                          اشتراك {i ? "أسبوعي" : "شهري"}
                        </span>
                        <b>
                          <DiscoveryIcon name="check" />
                          نشط
                        </b>
                      </div>
                      <Journey line={l} compact />
                      <div className="d-three-meta">
                        <Meta label="الفئة" icon={i ? "bus" : "car"}>
                          {l.category}
                        </Meta>
                        <Meta label="المقاعد" icon="seat">
                          {i ? 6 : 3}
                        </Meta>
                        <Meta label="نهاية الاشتراك" icon="calendar">
                          {i ? "22 يونيو" : "30 يونيو"}
                        </Meta>
                      </div>
                      <button
                        className="d-manage"
                        onClick={() =>
                          setModal(
                            "إدارة الاشتراك محتاجة حجزًا فعليًا. البيانات المعروضة توضيحية فقط.",
                          )
                        }
                      >
                        <DiscoveryIcon name="settings" />
                        إدارة الاشتراك
                        <DiscoveryIcon name="back" />
                      </button>
                    </article>
                  ))}
                </div>
              )
            ) : (
              p.bookings
                .filter((b) =>
                  past
                    ? ["completed", "cancelled"].includes(b.status)
                    : !["completed", "cancelled"].includes(b.status),
                )
                .map((b) => (
                  <article className="d-box d-live-booking" key={b.id}>
                    <h2>
                      {b.origin} ← {b.destination}
                    </h2>
                    <p>
                      {money(b.price)} · {b.starts_on} — {b.ends_before}
                    </p>
                    <button
                      className="d-outline"
                      onClick={() => p.onBooking(b.id)}
                    >
                      تفاصيل اشتراكي
                    </button>
                  </article>
                ))
            )}
            {!demo && !p.bookings.length && (
              <Empty>
                {p.signedIn
                  ? "لسه مفيش اشتراكات."
                  : "سجّل الدخول عشان تشوف اشتراكاتك."}
              </Empty>
            )}
          </>
        )}
        {screen === 15 && (
          <>
            <p className="d-subtitle">
              لم تجد الخط المناسب؟ اطلب خط جديد وسنقوم
              <br />
              بدراسة الطلب وإعلامك عند توفره.
            </p>
            <form className="d-request" onSubmit={(e) => void request(e)}>
              <section className="d-box d-request-areas">
                <label>
                  <span>
                    <DiscoveryIcon name="pin" />
                    من (منطقة الانطلاق)
                  </span>
                  {areaSelect(origin, setOrigin, "منطقة الانطلاق")}
                </label>
                <button
                  type="button"
                  aria-label="تبديل مناطق الطلب"
                  onClick={() => {
                    setOrigin(destination);
                    setDestination(origin);
                  }}
                >
                  <DiscoveryIcon name="swap" />
                </button>
                <label>
                  <span>
                    <DiscoveryIcon name="pin" />
                    إلى (منطقة الوصول)
                  </span>
                  {areaSelect(destination, setDestination, "منطقة الوصول")}
                </label>
              </section>
              <section className="d-box d-request-times">
                <label>
                  <span>
                    <DiscoveryIcon name="sun" />
                    وقت الذهاب
                  </span>
                  <input
                    type="time"
                    aria-label="وقت الذهاب"
                    value={outbound}
                    onChange={(e) => setOutbound(e.target.value)}
                    required
                  />
                </label>
                <label>
                  <span>
                    <DiscoveryIcon name="moon" />
                    وقت العودة
                  </span>
                  <input
                    type="time"
                    aria-label="وقت العودة"
                    value={returnTime}
                    onChange={(e) => setReturnTime(e.target.value)}
                    required
                  />
                </label>
              </section>
              <section className="d-box">
                <h2>
                  <DiscoveryIcon name="calendar" />
                  نوع الاشتراك
                </h2>
                {periodChoices}
              </section>
              <section className="d-box">
                <label className="d-notes">
                  <span>
                    <DiscoveryIcon name="pen" />
                    ملاحظات إضافية (اختياري)
                  </span>
                  <textarea
                    aria-label="ملاحظات إضافية"
                    placeholder="مثال: أفضل وجود محطة في مدينة نصر…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={1000}
                  />
                </label>
              </section>
              <button className="d-primary" type="submit" disabled={sending}>
                {sending ? "جاري الإرسال…" : "إرسال الطلب"}
                <DiscoveryIcon name="send" />
              </button>
            </form>
          </>
        )}
      </main>
      {modal && (
        <div className="d-modal-backdrop">
          <section
            className="d-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="d-modal-title"
          >
            <h2 id="d-modal-title">معاينة سِكّة</h2>
            <p>{modal}</p>
            <button
              autoFocus
              className="d-primary"
              onClick={() => setModal("")}
            >
              تمام
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
