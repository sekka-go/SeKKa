import {usePreferences} from "./preferences";
import {translate} from "./translations";
import { readPublishedPreviews } from "./CaptainRoutes";
import { selectStops, matchesStops, type Stop } from "../../../packages/domain/stops";
import { publicScreen } from "./screenMap";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import { Wordmark } from "./Onboarding";
import type { Appearance } from "./Onboarding";
import type { Route, Booking } from "./api";
import "./discovery.css";
import LiveRouteSearch from "./LiveRouteSearch";
import type {LiveSelection} from "./LiveRouteSearch";

export const discoveryScreens = [8, 9, 10, 11, 12, 14];
const titles: Record<number, string> = {
  8: "الرئيسية للراكب",
  9: "البحث عن خط",
  10: "تصفية البحث",
  11: "نتائج البحث",
  12: "تفاصيل الخط",
  13: "بيانات الكابتن والعربية",
  14: "المفضلة",
  29: "اشتراكاتي",
  15: "مراجعة طلب رحلة",
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
  // Preview-only snapshot of available seats when a captain pauses new bookings.
  pausedAvailableSeats?: number;
  outbound: string;
  returnTime: string;
  period: string;
  direction: string;
  amount: number | null;
  stops?: Stop[];
  returnStops?: Stop[];
  selectedStops?: ReturnType<typeof selectStops>;
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
// Published fixture stops, not inferred for real offers.
examples.forEach(line => {
  const stops: Stop[] = [
    {id: 'maadi', name: 'ميدان الجزائر', area: 'المعادي', pickup: true, dropoff: false},
    {id: 'nasr', name: 'مدينة نصر', area: 'مدينة نصر', pickup: true, dropoff: true},
    {id: 'tagamoa', name: 'شارع التسعين', area: 'التجمع', pickup: false, dropoff: true},
  ];
  line.stops = line.direction === 'return' ? [...stops].reverse().map(s => ({...s, pickup: s.dropoff, dropoff: s.pickup})) : stops;
  if (line.direction === 'round_trip') line.returnStops = [...stops].reverse().map(s => ({...s, pickup: s.dropoff, dropoff: s.pickup}));
});
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
const money = (v: number | null, language: "en" | "ar") =>
  v === null ? translate("السعر مش متاح",language) : `${v.toLocaleString("en-US")} ${language === "en" ? "EGP" : "ج.م"}`;
function time(v: string, language: "en" | "ar") {
  if (!v) return "—";
  const [hh, mm] = v.split(":");
  const h = Number(hh);
  return `${String(h % 12 || 12).padStart(2, "0")}:${mm} ${translate(h < 12 ? "ص" : "م", language)}`;
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
  const {language} = usePreferences();
  const tr=(text:string)=>translate(text,language);
  return (
    <div className={`d-journey ${compact ? "compact" : ""}`}>
      <div className="d-locations">
        <span>
          <DiscoveryIcon name="pin" />
          {tr(line.origin)}
        </span>
        <DiscoveryIcon name="swap" />
        <span>
          <DiscoveryIcon name="pin" />
          {tr(line.destination)}
        </span>
      </div>
      <div className="d-times">
        <span>
          <DiscoveryIcon name="sun" />
          <span>
            {tr("الذهاب")}{compact ? ":" : ""} <b dir="auto">{time(line.outbound,language)}</b>
          </span>
        </span>
        <span>
          <DiscoveryIcon name="moon" />
          <span>
            {tr("العودة")}{compact ? ":" : ""} <b dir="auto">{time(line.returnTime,language)}</b>
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
  production?: boolean;
  riderId?: string | null;
  serviceAreas?: {id:number;name_ar:string;name_en:string}[];
  liveSelection?: LiveSelection | null;
  onLiveSelect?: (selection:LiveSelection)=>void;
  theme: Appearance;
  onTheme: (t: Appearance) => void;
  go: (id: number) => void;
  routes: Route[];
  route: Route | null;
  bookings: Booking[];
  signedIn: boolean;
  contact?: Record<string, unknown> | null;
  onContactChat?: () => void;
  busy: boolean;
  error: string;
  onSearch: (p: {
    origin: string;
    destination: string;
    outbound: string;
    returnTime: string;
    period: string;
    category: string;
    direction?: string;
    maxPrice?: string;
  }) => void;
  onSelect: (r: Route, period: string, direction: string) => void;
  onRequest: (p: Record<string, unknown>) => Promise<void>;
  onFavorite: (id: string) => Promise<void>;
  onBook: (offer: Line) => void;
  onBooking: (id: string) => void;
};
// Keep the rider's unfinished search and stop selections when a prerequisite
// (such as sign-in) temporarily unmounts the discovery screen. Session only.
const riderDraftKey = "sekka.rider.discoveryDraft.v31";
type RiderDraft = {
  origin?: string; destination?: string; outbound?: string; returnTime?: string;
  period?: string; categories?: string[]; selectedId?: string; favoriteDetail?: Line | null;
  searched?: boolean; pickup?: string; dropoff?: string; filterDirection?: string;
  filterPrice?: string; onlyAvailable?: boolean; appliedFilters?: boolean;
};

/* Per-Google-account local search shortcuts: no fake route inventory, and no
 * sharing saved home/work areas between users of the same device. */
type RiderSavedAreas = {
  home?: string; work?: string; recent?: {origin:string;destination:string}[];
};
function readRiderSavedAreas(riderId?:string|null):RiderSavedAreas{
 if(!riderId)return {};
 try{
  const stored:unknown=JSON.parse(localStorage.getItem('sekka.rider.savedAreas.v1.'+riderId)||'null');
  if(!stored||typeof stored!=='object'||Array.isArray(stored))return {};
  const saved=stored as RiderSavedAreas;
  const valid=(value:unknown)=>typeof value==='string'&&value.length<=120;
  return {
   home:valid(saved.home)?saved.home:undefined,
   work:valid(saved.work)?saved.work:undefined,
   recent:Array.isArray(saved.recent)?saved.recent.filter((item):item is {origin:string;destination:string}=>
    !!item&&valid(item.origin)&&valid(item.destination)).slice(0,3):[]
  };
 }catch{return {};}
}

function readRiderDraft(): RiderDraft {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(riderDraftKey) || "null");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value as RiderDraft;
  } catch { return {}; }
}
export default function Discovery(p: DiscoveryProps) {
  const { screen, theme, onTheme, go } = p;
  const {language}=usePreferences();
  const tr=(text:string)=>translate(text,language);
  const demo = !p.production && new URLSearchParams(location.search).get("preview") === "phase2";
  const restored = useMemo(readRiderDraft, []);
  const [savedAreas,setSavedAreas]=useState<RiderSavedAreas>(()=>readRiderSavedAreas(p.riderId));
  useEffect(()=>{setSavedAreas(readRiderSavedAreas(p.riderId));},[p.riderId]);
  const storedAreaNames=new Set(p.serviceAreas?.map(area=>area.name_ar)||[]);
  const savedHome=savedAreas.home&&storedAreaNames.has(savedAreas.home)?savedAreas.home:undefined;
  const savedWork=savedAreas.work&&storedAreaNames.has(savedAreas.work)?savedAreas.work:undefined;
  const savedRecent=(savedAreas.recent||[]).filter(item=>storedAreaNames.has(item.origin)&&storedAreaNames.has(item.destination)&&item.origin!==item.destination);
  const areaDisplay=(name:string)=>language==='en'?(p.serviceAreas?.find(area=>area.name_ar===name)?.name_en||name):name;
  function persistSavedAreas(next:RiderSavedAreas){
   if(!p.production||!p.signedIn||!p.riderId)return;
   setSavedAreas(next);
   try{localStorage.setItem('sekka.rider.savedAreas.v1.'+p.riderId,JSON.stringify(next));}
   catch{/* The active search is still usable if browser storage is restricted. */}
  }
  const [origin, setOrigin] = useState(restored.origin ?? (demo ? "المعادي" : "")),
    [destination, setDestination] = useState(restored.destination ?? (demo ? "التجمع" : ""));
  const [outbound, setOutbound] = useState(restored.outbound ?? "07:30"),
    [returnTime, setReturnTime] = useState(restored.returnTime ?? "17:00"),
    [period, setPeriod] = useState(restored.period ?? "monthly");
  const [categories, setCategories] = useState<string[]>(Array.isArray(restored.categories) ? restored.categories.filter(v => typeof v === "string") : []),
    [selectedId, setSelectedId] = useState(restored.selectedId ?? examples[0].id),
    [favorites, setFavorites] = useState<string[]>(() => {
      try {
        const stored: unknown = JSON.parse(sessionStorage.getItem("sekka.preview.favoriteOfferIds") || "null");
        if (Array.isArray(stored) && stored.every(id => typeof id === "string")) return stored;
      } catch { /* Fall back to the sample favorites. */ }
      return favoriteExamples.map(row => row.id);
    });
  const [favoriteDetail, setFavoriteDetail] = useState<Line | null>(restored.favoriteDetail ?? null);
  const [searched, setSearched] = useState(() => new URLSearchParams(location.search).get("screen") === "11" && restored.searched === true);
  const [favoriteSignInRequired, setFavoriteSignInRequired] = useState(false);
  const [favoriteRetryId, setFavoriteRetryId] = useState<string | null>(null);
  const [requestSent, setRequestSent] = useState(false);
  const [pickup, setPickup] = useState(restored.pickup ?? "");
  const [dropoff, setDropoff] = useState(restored.dropoff ?? "");
  const [past, setPast] = useState(false),
    [notes, setNotes] = useState(""),
    [message, setMessage] = useState(""),
    [modal, setModal] = useState("");
  const lines = demo ? [...examples, ...readPublishedPreviews()].filter(l => l.available > 0) : p.routes.flatMap(toLines);
  const live=p.liveSelection;
  const liveRouteLine:Line|null=p.production&&live?{
    id:live.route.id+':'+(live.reverse?'return':'outbound'),routeId:live.route.id,
    origin:p.serviceAreas?.find(a=>a.id===live.from.area_id)?.name_ar||live.from.name,
    destination:p.serviceAreas?.find(a=>a.id===live.to.area_id)?.name_ar||live.to.name,
    category:live.route.category,available:live.remaining,
    outbound:live.route.outbound_time?.slice(0,5)||'',returnTime:live.route.return_time?.slice(0,5)||'',
    period:live.route.period,direction:live.reverse?'return':live.route.direction==='round_trip'?'round_trip':'outbound',amount:live.route.price_egp,
    stops:(live.reverse?[...live.stops].reverse():live.stops).map(s=>({
      id:s.id,name:s.name,area:p.serviceAreas?.find(a=>a.id===s.area_id)?.name_ar||s.name,
      pickup:live.reverse?s.dropoff_allowed:s.pickup_allowed,
      dropoff:live.reverse?s.pickup_allowed:s.dropoff_allowed
    })),
    returnStops:live.route.direction==='round_trip'&&live.route.return_supported
     ?[...live.stops].reverse().map(s=>({
       id:s.id,name:s.name,area:p.serviceAreas?.find(a=>a.id===s.area_id)?.name_ar||s.name,
       pickup:s.dropoff_allowed,dropoff:s.pickup_allowed
     })):undefined
  }:null;
  const selected = p.production ? liveRouteLine : demo
    ? favoriteDetail || lines.find((l) => l.id === selectedId) || examples[0]
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
    origin: origin || tr("منطقة الانطلاق"),
    destination: destination || tr("منطقة الوصول"),
    outbound,
    returnTime,
  };
  const [filterDirection, setFilterDirection] = useState(restored.filterDirection ?? "");
  const [filterPrice, setFilterPrice] = useState(restored.filterPrice ?? "");
  const [onlyAvailable, setOnlyAvailable] = useState(restored.onlyAvailable ?? false);
  const [appliedFilters, setAppliedFilters] = useState(restored.appliedFilters ?? false);
  useEffect(() => {
    const draft: RiderDraft = {origin,destination,outbound,returnTime,period,categories,selectedId,
      favoriteDetail:demo ? favoriteDetail : null,searched,pickup,dropoff,filterDirection,
      filterPrice,onlyAvailable,appliedFilters};
    try { sessionStorage.setItem(riderDraftKey, JSON.stringify(draft)); }
    catch { /* Keep the active screen usable when session storage is unavailable. */ }
  }, [origin,destination,outbound,returnTime,period,categories,selectedId,favoriteDetail,
      demo,searched,pickup,dropoff,filterDirection,filterPrice,onlyAvailable,appliedFilters]);
  const filtered = lines.filter(
    (l) =>
      (!searched || (matchesStops(l.stops || [], origin, destination) && (!outbound || l.outbound === outbound) && (!returnTime || l.returnTime === returnTime))) &&
      (!categories.length || categories.includes(l.category)) &&
      (!appliedFilters || l.period === period) &&
      (!filterDirection || l.direction === filterDirection) &&
      (!filterPrice ||
        (l.amount !== null && l.amount <= Number(filterPrice))) &&
      (!onlyAvailable || l.available > 0),
  );
  const favoritesList = demo
    ? [...favoriteExamples, ...lines].filter((line) => favorites.includes(line.id))
    : lines;
  const heading = tr(titles[screen]);
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
    setFavoriteSignInRequired(false);
    setFavoriteRetryId(null);
    go(id);
  }
  function openLine(l: Line) {
    setPickup(""); setDropoff("");
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
      setMessage(tr("اختار منطقة الانطلاق والوصول عشان نكمل."));
      return;
    }
    if (origin === destination) {
      setMessage(tr("اختار منطقتين مختلفتين."));
      return;
    }
    if(p.production&&p.riderId){
      persistSavedAreas({...savedAreas,recent:[
       {origin,destination},...savedRecent.filter(item=>item.origin!==origin||item.destination!==destination)
      ].slice(0,3)});
    }
    setSearched(true); setRequestSent(false);
    if (demo) nav(11);
    else {
      p.onSearch({
        origin,
        destination,
        outbound,
        returnTime,
        period,
        category: categories.length === 1 ? categories[0] : "",
        direction: filterDirection || "outbound",
        maxPrice: filterPrice,
      });
      nav(11);
    }
  }
  async function favorite(id: string) {
    setFavoriteSignInRequired(false);
    setFavoriteRetryId(null);
    if (demo) {
      const next = favorites.includes(id) ? favorites.filter(value => value !== id) : [...favorites, id];
      setFavorites(next);
      try { sessionStorage.setItem("sekka.preview.favoriteOfferIds", JSON.stringify(next)); } catch { /* Keep the current session view usable. */ }
    } else if (!p.signedIn) {
      // The sign-in prerequisite uses App.go(), which remembers this offer's URL for return.
      setMessage(tr("سجّل الدخول عشان تحفظ العرض في المفضلة."));
      setFavoriteSignInRequired(true);
    } else {
      try {
        await p.onFavorite(id);
      } catch {
        setMessage(tr("تعذّر حفظ العرض. جرّب تاني."));
        setFavoriteRetryId(id);
      }
    }
  }
  async function request(e: FormEvent) {
    e.preventDefault();
    if (!searched || filtered.length || requestSent) return;
    setRequestSent(true);
    setMessage(tr("تم تأكيد الطلب في المعاينة فقط. لا يوجد حجز مقعد أو تأمين."));
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
      {(p.production ? (p.serviceAreas || []).map(a => ({value:a.name_ar,label:language==='en'?a.name_en||a.name_ar:a.name_ar})) : servedAreas.map(a=>({value:a,label:tr(a)}))).map((a) => (
        <option key={a.value} value={a.value}>{a.label}</option>
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
          {v === "monthly" ? tr("شهري") : tr("أسبوعي")}
          <span className="d-radio" />
        </button>
      ))}
    </div>
  );
  return (
    <div className={`phase-one-stage discovery-stage ${theme}`}>
      {!p.production && <nav
        className="phase-review-bar d-review"
        aria-label={tr("معاينة المرحلة الثانية")}
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
            aria-label={tr("الشاشة السابقة")}
          >
            ‹
          </button>
          <label>
            {tr("الشاشة")}{" "}
            <select
              aria-label={tr("شاشة المرحلة الثانية")}
              value={screen}
              onChange={(e) => nav(Number(e.target.value))}
            >
              {discoveryScreens.map((id) => (
                <option key={id} value={id}>
                  {String(publicScreen(id)).padStart(2, "0")} · {tr(titles[id])}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() =>
              nav(
                discoveryScreens[
                  Math.min(discoveryScreens.length - 1, discoveryScreens.indexOf(screen) + 1)
                ],
              )
            }
            aria-label={tr("الشاشة التالية")}
          >
            ›
          </button>
        </div>
        <div className="review-themes">
          <button
            aria-pressed={theme === "dark"}
            onClick={() => onTheme("dark")}
          >
            {tr("دارك")}</button>
          <button
            aria-pressed={theme === "light"}
            onClick={() => onTheme("light")}
          >
            {tr("لايت")}</button>
        </div>
      </nav>}
      {!p.production && <p className="phase-preview-note">
        {demo
          ? tr("معاينة المرحلة الثانية · كل الأسماء والأسعار والحجوزات بيانات توضيحية فقط.")
          : tr("سِكّة · القاهرة والجيزة")}
      </p>}
      <main className={`phase-canvas d-canvas d-screen-${screen}`}>
        <header className="d-header">
          <button
            className="phase-back"
            aria-label={tr("رجوع")}
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
            {tr("بنحمّل البيانات…")}</p>
        )}
        {p.error && !demo && (
          <div className="d-feedback" role="alert">
            <p>{/OTP|verify|verification|تحقق|موبايل|بجوجل|Google/i.test(p.error) ? p.error : tr("الخدمة مش متاحة دلوقتي. جرّب تاني بعد شوية.")}</p>
            <button type="button" className="d-outline" onClick={() => nav(9)}>
              {tr("ارجع للبحث")}
            </button>
          </div>
        )}
        {message && (
          <div className="d-feedback" role="status">
            <p>{message}</p>
            {favoriteSignInRequired && (
              <button type="button" className="d-primary" onClick={() => nav(4)}>
                {tr("تسجيل الدخول أو إنشاء حساب")}
              </button>
            )}
            {favoriteRetryId && (
              <button type="button" className="d-outline" onClick={() => void favorite(favoriteRetryId)}>
                {tr("حاول تاني")}
              </button>
            )}
          </div>
        )}
        {[8, 9].includes(screen) && (
          <>
            <p className="d-subtitle">
              {tr("حدد نقطة الانطلاق والوجهة، وابدأ رحلتك بسهولة")}</p>
            <form
              className="d-planner"
              onSubmit={(e) => {
                e.preventDefault();
                search();
              }}
            >
              <div className="d-planner-places">
                <label className="d-place">
                  <span className="sr-only">{tr("من أين؟")}</span>
                  {areaSelect(origin, setOrigin, tr("من أين؟"))}
                  <span className="d-origin-dot" />
                </label>
                <button
                  type="button"
                  className="d-swap"
                  aria-label={tr("تبديل الانطلاق والوصول")}
                  onClick={() => {
                    setOrigin(destination);
                    setDestination(origin);
                  }}
                >
                  <DiscoveryIcon name="swap" />
                </button>
                <label className="d-place">
                  <span className="sr-only">{tr("إلى أين؟")}</span>
                  {areaSelect(destination, setDestination, tr("إلى أين؟"))}
                  <DiscoveryIcon name="pin" />
                </label>
              </div>
              {p.production&&p.signedIn&&p.riderId&&<div className="sekka-search-shortcuts" aria-label={tr("اختصارات المناطق المحفوظة")}>
                <div className="sekka-search-shortcuts__actions">
                  <button type="button" disabled={!origin||!storedAreaNames.has(origin)}
                   onClick={()=>persistSavedAreas({...savedAreas,home:origin})}>
                    {savedHome===origin?tr("✓ البيت محفوظ"):tr("احفظ البداية كبيت")}
                  </button>
                  <button type="button" disabled={!destination||!storedAreaNames.has(destination)}
                   onClick={()=>persistSavedAreas({...savedAreas,work:destination})}>
                    {savedWork===destination?tr("✓ الشغل محفوظ"):tr("احفظ الوصول كشغل")}
                  </button>
                </div>
                {savedHome&&savedWork&&savedHome!==savedWork&&<div className="sekka-search-shortcuts__actions">
                  <button type="button" onClick={()=>{setOrigin(savedHome);setDestination(savedWork);}}>
                   {tr("البيت ← الشغل")}
                  </button>
                  <button type="button" onClick={()=>{setOrigin(savedWork);setDestination(savedHome);}}>
                   {tr("الشغل ← البيت")}
                  </button>
                </div>}
                {savedRecent.length>0&&<div className="sekka-search-shortcuts__recent">
                  <span>{tr("آخر عمليات البحث")}</span>
                  {savedRecent.map((item,index)=><button type="button" key={item.origin+':'+item.destination+':'+index}
                   onClick={()=>{setOrigin(item.origin);setDestination(item.destination);}}
                   aria-label={tr("إعادة البحث عن ")+areaDisplay(item.origin)+' - '+areaDisplay(item.destination)}>
                    {areaDisplay(item.origin)} ← {areaDisplay(item.destination)}
                  </button>)}
                </div>}
              </div>}
              <div className="d-box d-time-picker">
                <label>
                  <DiscoveryIcon name="calendar" />
                  <span>{tr("الذهاب")}</span>
                  <input
                    aria-label={tr("وقت الذهاب")}
                    type="time"
                    value={outbound}
                    onChange={(e) => setOutbound(e.target.value)}
                    required
                  />
                </label>
                <label>
                  <DiscoveryIcon name="calendar" />
                  <span>{tr("العودة")}</span>
                  <input
                    aria-label={tr("وقت العودة")}
                    type="time"
                    value={returnTime}
                    onChange={(e) => setReturnTime(e.target.value)}
                    required
                  />
                </label>
              </div>
              <button className="d-primary" type="submit">
                {tr("ابحث عن الرحلات")}<DiscoveryIcon name="arrow" />
              </button>
            </form>
            <div className="d-road" aria-hidden="true" />
          </>
        )}
        {screen === 10 && (
          <>
            <p className="d-subtitle">
              {tr("خصص بحثك للعثور على الاشتراك المناسب لك")}</p>
            <section className="d-filter-section">
              <h2>
                <DiscoveryIcon name="car" />
                {tr("الفئة")}</h2>
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
                      {c.seats} {c.seats === 13 ? tr("مقعدًا") : tr("مقاعد")}
                    </span>
                  </button>
                ))}
              </div>
            </section>
            <section className="d-filter-section">
              <h2>
                <DiscoveryIcon name="calendar" />
                {tr("مدة الاشتراك")}</h2>
              {periodChoices}
            </section>
            <section className="d-box">
              <label className="w-field">
                <span>{tr("اتجاه الاشتراك")}</span>
                <select
                  value={filterDirection}
                  onChange={(e) => setFilterDirection(e.target.value)}
                >
                  <option value="">{tr("كل الاتجاهات")}</option>
                  <option value="outbound">{tr("ذهاب فقط")}</option>
                  <option value="return">{tr("عودة فقط")}</option>
                  <option value="round_trip">{tr("ذهاب وعودة")}</option>
                </select>
              </label>
              <label className="w-field">
                <span>{tr("أقصى سعر للاشتراك")}</span>
                <input
                  type="number"
                  min="0"
                  value={filterPrice}
                  onChange={(e) => setFilterPrice(e.target.value)}
                />
              </label>
              <button
                className="d-outline"
                aria-pressed={onlyAvailable}
                onClick={() => setOnlyAvailable(!onlyAvailable)}
              >
                {tr("مقاعد متاحة فقط")}</button>
              <button
                className="d-outline"
                onClick={() => {
                  setCategories([]);
                  setFilterDirection("");
                  setFilterPrice("");
                  setOnlyAvailable(false);
                  setAppliedFilters(false);
                }}
              >
                {tr("مسح الفلاتر")}</button>
            </section>
            <section className="d-filter-section">
              <h2>
                <DiscoveryIcon name="pin" />
                {tr("نطاق الخدمة")}</h2>
              <div className="d-box d-region">
                <div>
                  <strong>{tr("القاهرة والجيزة فقط")}</strong>
                  <span>{tr("داخل المناطق والأحياء")}</span>
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
                    direction: filterDirection || "outbound",
                    maxPrice: filterPrice,
                  });
                nav(11);
              }}
            >
              {tr("عرض النتائج")}</Action>
          </>
        )}
        {screen === 8 && (
          <section className="d-box">
            <h2>{tr("أهلًا بيك في سِكّة")}</h2>
            <p>{tr("مشوارك المنتظم يبدأ من هنا.")}</p>
            {!p.production&&<div className="d-period-options d-home-quick-actions">
              <button onClick={() => nav(29)}>{tr("اشتراكاتي")}</button>
              <button onClick={() => nav(14)}>{tr("المفضلة")}</button>
              {!p.production && <button onClick={() => nav(24)}>{tr("المحفظة")}</button>}
              <button onClick={() => nav(33)}>{tr("الإشعارات")}</button>
            </div>}
          </section>
        )}
        {screen === 11 && !demo && <LiveRouteSearch origin={origin} destination={destination} outbound={outbound} returnTime={returnTime} period={appliedFilters?period:""} requestPeriod={period} direction={filterDirection} categories={categories} onSelect={p.production?p.onLiveSelect:undefined} onSignIn={()=>nav(4)} />}
        {screen === 11 && demo && (
          <>
            <p className="d-subtitle">{tr("اختر عرض الاشتراك المناسب لك")}</p>
            <section className="d-box d-results-summary">
              <span>
                <DiscoveryIcon name="pin" />
                {tr(queryLine.origin)}
              </span>
              <DiscoveryIcon name="swap" />
              <strong>{tr(queryLine.destination)}</strong>
              <button aria-label={tr("تعديل الفلاتر")} onClick={() => nav(10)}>
                <DiscoveryIcon name="calendar" />
                {tr("عروض متاحة:")}{filtered.length}
              </button>
            </section>
            <div className="d-result-list">
              {filtered.map((l) => (
                <article className="d-box d-result" key={l.id}>
                  <div className="d-offer-top">
                    <strong>
                      <DiscoveryIcon name="user" />
                      {tr("عرض اشتراك")}
                    </strong>
                    <span className="d-available">
                      <DiscoveryIcon name="seat" />
                      {tr("متاح")}{l.available} {tr("مقاعد")}</span>
                  </div>
                  <button
                    className="d-offer-select"
                    onClick={() => openLine(l)}
                    aria-label={`${language === "en" ? "View details" : "عرض تفاصيل"} ${l.category} ${tr(periodLabel(l.period))} ${tr(directionLabel(l.direction))}`}
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
                      <b>{tr(directionLabel(l.direction))}</b>
                    </span>
                    <span className="d-offer-period">
                      <DiscoveryIcon name="calendar" />
                      {tr(periodLabel(l.period))}
                    </span>
                    <span className="d-offer-price">
                      <strong dir="auto">{money(l.amount,language)}</strong>
                      <small>{tr("سعر الاشتراك")}</small>
                    </span>
                    <DiscoveryIcon name="back" />
                  </button>
                  <div className="d-times d-offer-times">
                    <span>
                      <DiscoveryIcon name="sun" />
                      {tr("وقت الذهاب")}<b dir="auto">{time(l.outbound,language)}</b>
                    </span>
                    <span>
                      <DiscoveryIcon name="moon" />
                      {tr("وقت العودة")}<b dir="auto">{time(l.returnTime,language)}</b>
                    </span>
                  </div>
                </article>
              ))}
            </div>
            {!filtered.length && <Empty>{tr("لسه مفيش خط مناسب.")}</Empty>}
            {searched && !filtered.length && <button className="d-text-action" onClick={() => nav(15)}>{tr("اطلب رحلة")}</button>}
          </>
        )}
        {screen === 12 &&
          (selected ? (
            <>
              <section className="d-box d-detail-journey">
                <Journey line={current} compact />
              </section>
              <section className="d-box d-offer-facts">
                <Meta label={tr("اتجاه الاشتراك")} icon="swap">
                  {tr(directionLabel(current.direction))}
                </Meta>
                <Meta label={tr("نوع الاشتراك")} icon="calendar">
                  {tr(periodLabel(current.period))}
                </Meta>
                <Meta label={tr("الفئة")} icon="seat">
                  {current.category}
                </Meta>
                <Meta label={tr(p.production?"المقاعد المتاحة الآن":"المقاعد المتاحة")} icon="user">
                  {current.available} {tr("مقاعد")}</Meta>
              </section>
              <div className="d-box d-fixed-price">
                <span>
                  <DiscoveryIcon name="clipboard" />
                  {tr("سعر الاشتراك")}</span>
                <strong dir="auto">{money(current.amount,language)}</strong>
              </div>
              <div className="d-box d-information">
                <p>
                  {tr("الاشتراك من الأحد للخميس، باستثناء الإجازات الرسمية المصرية، وفق مواعيد العرض طوال مدة الاشتراك.")}</p>
                <DiscoveryIcon name="info" />
              </div>
              <section className="d-box"><h2>{tr("نقاط المسار")}</h2>
                <ol>{(current.stops || []).map(s => <li key={s.id}>{tr(s.name)}</li>)}</ol>
                <label>{tr("نقطة الركوب")}<select aria-label={tr("نقطة الركوب")} value={pickup} onChange={e => {setPickup(e.target.value); setDropoff("");}}><option value="">{tr("اختر نقطة الركوب")}</option>{(current.stops || []).filter(s => s.pickup).map(s => <option key={s.id} value={s.id}>{tr(s.name)}</option>)}</select></label>
                <label>{tr("نقطة النزول")}<select aria-label={tr("نقطة النزول")} value={dropoff} onChange={e => setDropoff(e.target.value)}><option value="">{tr("اختر نقطة النزول")}</option>{(current.stops || []).filter((s,i) => s.dropoff && i > (current.stops || []).findIndex(p => p.id === pickup)).map(s => <option key={s.id} value={s.id}>{tr(s.name)}</option>)}</select></label>
                {current.direction === "round_trip" && pickup && dropoff && <p>{tr("العودة تلقائيًا:")}{current.stops?.find(s => s.id === dropoff)?.name} ← {current.stops?.find(s => s.id === pickup)?.name}</p>}
                {!current.stops?.length && <p>{tr("نقاط العرض غير متاحة؛ الحجز غير متاح حتى نشر النقاط.")}</p>}
              </section>
              <Action
                onClick={() => {try {const selectedStops = selectStops(current.stops || [], pickup, dropoff, current.direction === "round_trip" ? current.returnStops || [] : undefined); p.onBook({...current, selectedStops});} catch {setMessage(tr("اختار نقطتين صالحين؛ يجب أن يدعم مسار العودة عكس النقطتين."));}}}
                disabled={current.amount === null || current.available<1 || !pickup || !dropoff}
              >
                {tr("حجز الاشتراك")}</Action>
              {!p.production && <button
                className="d-text-action"
                onClick={() => void favorite(demo ? current.id : current.routeId || current.id)}
              >
                <DiscoveryIcon name="heart" />
                {demo && favorites.includes(current.id) ? (language==="en" ? "Remove from favorites" : "إزالة من المفضلة") : tr("حفظ في المفضلة")}</button>}
            </>
          ) : (
            <><Empty>{tr("اختار خط من نتائج البحث عشان تشوف تفاصيله.")}</Empty><Action onClick={() => nav(9)}>{tr("البحث عن خط")}</Action></>
          ))}
        {screen === 14 && (
          <>
            <p className="d-subtitle">
              {tr("حفظ العرض مش حجز مقعد، والسعر والتوافر ممكن يتغيروا.")}</p>
            <div className="d-favorites">
              {favoritesList.map((l) => (
                <article key={l.id} className="d-box d-favorite">
                  <button
                    className="d-heart"
                    aria-label={language==="en" ? `Remove ${tr(l.origin)} to ${tr(l.destination)} from favorites` : `إزالة ${l.origin} إلى ${l.destination} من المفضلة`}
                    onClick={() => void favorite(l.id)}
                  >
                    <DiscoveryIcon name="heart" />
                  </button>
                  <Journey line={l} compact />
                  <div className="d-three-meta">
                    <Meta
                      label={tr("الفئة")}
                      icon={l.category === "SPACE" ? "bus" : "car"}
                    >
                      {l.category}
                    </Meta>
                    <Meta label={tr("المقاعد المتاحة")} icon="seat">
                      {l.available} {tr("مقاعد")}</Meta>
                    <Meta label={tr(periodLabel(l.period))} icon="">
                      {money(l.amount,language)}
                    </Meta>
                  </div>
                  <Action onClick={() => openLine(l)}>{tr("عرض التفاصيل")}</Action>
                </article>
              ))}
            </div>
            {!favoritesList.length && (
              <Empty>
                {p.signedIn || demo
                  ? tr("لسه مفيش خطوط محفوظة.")
                  : tr("سجّل الدخول عشان تشوف المفضلة.")}
                <Action onClick={()=>go(p.signedIn || demo ? 9 : 4)}>{p.signedIn || demo ? tr("البحث عن خط") : tr("تسجيل الدخول")}</Action>
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
                {tr("الاشتراكات الحالية")}{demo ? "(2)" : ""}
              </button>
              <button
                aria-pressed={past}
                className={past ? "selected" : ""}
                onClick={() => setPast(true)}
              >
                {tr("الاشتراكات السابقة")}</button>
            </div>
            {demo ? (
              past ? (
                <Empty>{tr("مفيش اشتراكات سابقة في المعاينة.")}</Empty>
              ) : (
                <div className="d-subscriptions">
                  {[examples[0], favoriteExamples[1]].map((l, i) => (
                    <article key={l.id} className="d-box d-subscription">
                      <div className="d-subscription-head">
                        <span>
                          <DiscoveryIcon name="calendar" />
                          {tr("اشتراك")}{i ? tr("أسبوعي") : tr("شهري")}
                        </span>
                        <b>
                          <DiscoveryIcon name="check" />
                          {tr("نشط")}</b>
                      </div>
                      <Journey line={l} compact />
                      <div className="d-three-meta">
                        <Meta label={tr("الفئة")} icon={i ? "bus" : "car"}>
                          {l.category}
                        </Meta>
                        <Meta label={tr("المقاعد")} icon="seat">
                          {i ? 6 : 3}
                        </Meta>
                        <Meta label={tr("نهاية الاشتراك")} icon="calendar">
                          {i ? tr("22 يونيو") : tr("30 يونيو")}
                        </Meta>
                      </div>
                      <button
                        className="d-manage"
                        onClick={() =>
                          setModal(
                            tr("إدارة الاشتراك محتاجة حجزًا فعليًا. البيانات المعروضة توضيحية فقط."),
                          )
                        }
                      >
                        <DiscoveryIcon name="settings" />
                        {tr("إدارة الاشتراك")}<DiscoveryIcon name="back" />
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
                      {money(b.price,language)} · {b.starts_on} — {b.ends_before}
                    </p>
                    <button
                      className="d-outline"
                      onClick={() => p.onBooking(b.id)}
                    >
                      {tr("تفاصيل اشتراكي")}</button>
                  </article>
                ))
            )}
            {!demo && !p.bookings.length && (
              <><Empty>
                {p.signedIn
                  ? tr("لسه مفيش اشتراكات.")
                  : tr("سجّل الدخول عشان تشوف اشتراكاتك.")}
              </Empty><Action onClick={() => p.signedIn ? nav(9) : go(4)}>{tr(p.signedIn ? "البحث عن خط" : "تسجيل الدخول")}</Action></>
            )}
          </>
        )}
        {screen === 15 && (searched && !filtered.length ? <form className="d-request" onSubmit={e => void request(e)}>
          <section className="d-box"><h2>{tr("راجع بيانات البحث")}</h2><Journey line={queryLine} />
          <p>{tr("الطلب لا يحجز مقعدًا ولا يخصم تأمينًا ولا يضمن توافر كابتن.")}</p></section>
          <label>{tr("ملاحظات اختيارية")}<textarea value={notes} onChange={e => setNotes(e.target.value)} maxLength={1000}/></label>
          <button className="d-primary" disabled={requestSent} type="submit">{requestSent ? tr("تم تأكيد الطلب في المعاينة") : tr("تأكيد الطلب")}</button>
        </form> : <><Empty>{tr("ابدأ بالبحث؛ طلب الرحلة متاح فقط عندما لا توجد عروض مطابقة.")}</Empty><Action onClick={()=>go(9)}>{tr("البحث عن خط")}</Action></>)}
      </main>
      {modal && (
        <div className="d-modal-backdrop">
          <section
            className="d-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="d-modal-title"
          >
            <h2 id="d-modal-title">{tr("معاينة سِكّة")}</h2>
            <p>{modal}</p>
            <button
              autoFocus
              className="d-primary"
              onClick={() => setModal("")}
            >
              {tr("تمام")}</button>
          </section>
        </div>
      )}
    </div>
  );
}
