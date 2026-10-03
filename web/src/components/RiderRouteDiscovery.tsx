import { useCallback, useEffect, useRef, useState } from "react";
import MapPicker, { type MapPickMode, type MapPoint } from "../MapPicker";
import { api, type Category, type PoolDiscoveryMatch, type SavedPlace } from "../api";
import LocationSearchField from "./LocationSearchField";
import { categoryName, errorText, formatDate, money } from "../lib/formatters";

const pointFromSaved = (place: SavedPlace | undefined, kind: MapPickMode): MapPoint | null => place
  ? { lat: place.lat, lng: place.lng, kind, label: place.label }
  : null;

export default function RiderRouteDiscovery({ token, savedPlaces, categories, onJoin, onJoinByCode }: {
  token: string;
  savedPlaces: SavedPlace[];
  categories: Category[];
  onJoin: (match: PoolDiscoveryMatch, pickup: MapPoint, dropoff: MapPoint) => void;
  onJoinByCode: () => void;
}) {
  const home = savedPlaces.find((place) => place.place_type === "home");
  const work = savedPlaces.find((place) => place.place_type === "work");
  const [pickup, setPickup] = useState<MapPoint | null>(() => pointFromSaved(home, "pickup"));
  const [dropoff, setDropoff] = useState<MapPoint | null>(() => pointFromSaved(work, "dropoff"));
  const [pickupSearch, setPickupSearch] = useState(home?.label ?? "");
  const [dropoffSearch, setDropoffSearch] = useState(work?.label ?? "");
  const [matches, setMatches] = useState<PoolDiscoveryMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const [mapTarget, setMapTarget] = useState<MapPickMode>("pickup");
  const searchRequest = useRef(0);

  const searchMatches = useCallback(async (origin: MapPoint, destination: MapPoint) => {
    if (typeof origin.lat !== "number" || typeof origin.lng !== "number" || typeof destination.lat !== "number" || typeof destination.lng !== "number") return;
    const requestId = ++searchRequest.current;
    setSearching(true); setSearched(true); setError("");
    try {
      const result = await api<{ matches: PoolDiscoveryMatch[] }>("/rider/pool/discover", {
        method: "POST", token,
        body: { pickup_lat: origin.lat, pickup_lng: origin.lng, dropoff_lat: destination.lat, dropoff_lng: destination.lng },
      });
      if (requestId === searchRequest.current) setMatches(result.matches ?? []);
    } catch (cause) {
      if (requestId === searchRequest.current) { setMatches([]); setError(errorText(cause)); }
    } finally { if (requestId === searchRequest.current) setSearching(false); }
  }, [token]);

  useEffect(() => {
    if (typeof pickup?.lat !== "number" || typeof pickup.lng !== "number" || typeof dropoff?.lat !== "number" || typeof dropoff.lng !== "number") return;
    let active = true;
    const timer = window.setTimeout(() => {
      void searchMatches(pickup, dropoff).catch(() => { if (active) setError("تعذر تحميل الرحلات المطابقة."); });
    }, 300);
    return () => { active = false; window.clearTimeout(timer); searchRequest.current++; };
  }, [pickup, dropoff, searchMatches]);

  const selectSavedRoute = (reverse = false) => {
    const nextPickup = pointFromSaved(reverse ? work : home, "pickup");
    const nextDropoff = pointFromSaved(reverse ? home : work, "dropoff");
    if (nextPickup) { setPickup(nextPickup); setPickupSearch(nextPickup.label ?? ""); }
    if (nextDropoff) { setDropoff(nextDropoff); setDropoffSearch(nextDropoff.label ?? ""); }
    setMatches([]); setSearched(false);
  };

  const chooseMap = (kind: MapPickMode) => { setMapTarget(kind); setMapOpen(true); };
  const setMapPoint = (kind: MapPickMode, point: MapPoint) => {
    const label = `${point.lat?.toFixed(5)}, ${point.lng?.toFixed(5)}`;
    const selected = { ...point, kind, label };
    if (kind === "pickup") { setPickup(selected); setPickupSearch(label); }
    else { setDropoff(selected); setDropoffSearch(label); }
  };

  return <section className="surface rider-discovery-card" aria-labelledby="rider-discovery-title">
    <div className="rider-discovery-header"><div><span className="eyebrow">اقتراحات على طريقك</span><h3 id="rider-discovery-title">رحلات بتجمع ركاب</h3><p>هنعرض مجموعات لسه بتجمع ركاب ونقطك قريبة من خط سيرها.</p></div><span className="rider-discovery-mark" aria-hidden="true">⌖</span></div>
    {home && work && <div className="rider-discovery-presets"><span>المسار المحفوظ</span><button type="button" onClick={() => selectSavedRoute(false)}>⌂ المنزل <i>←</i> ▣ العمل</button><button type="button" onClick={() => selectSavedRoute(true)}>▣ العمل <i>←</i> ⌂ المنزل</button></div>}
    <div className="rider-discovery-locations">
      <LocationSearchField kind="pickup" title="نقطة الركوب" value={pickupSearch} token={token} onChange={(value) => { setPickupSearch(value); setPickup(null); setMatches([]); setSearched(false); }} onSelect={(point) => { setPickup({ ...point, kind: "pickup" }); setPickupSearch(point.label ?? ""); }} onChooseMap={() => chooseMap("pickup")} onFocus={() => undefined} pointSelected={typeof pickup?.lat === "number" && typeof pickup.lng === "number"} />
      <LocationSearchField kind="dropoff" title="نقطة الوصول" value={dropoffSearch} token={token} onChange={(value) => { setDropoffSearch(value); setDropoff(null); setMatches([]); setSearched(false); }} onSelect={(point) => { setDropoff({ ...point, kind: "dropoff" }); setDropoffSearch(point.label ?? ""); }} onChooseMap={() => chooseMap("dropoff")} onFocus={() => undefined} pointSelected={typeof dropoff?.lat === "number" && typeof dropoff.lng === "number"} />
    </div>
    <div className="rider-discovery-actions"><small>الانضمام متاح للمجموعات التي ما زالت تستقبل ركابًا، ونقطتاك في نطاق ٣ كم من مسارها.</small><button type="button" className="button button-outline button-small" onClick={() => { if (pickup && dropoff) void searchMatches(pickup, dropoff); }} disabled={searching || !pickup || !dropoff}>{searching ? "جاري البحث…" : "تحديث النتائج ↻"}</button></div>
    {mapOpen && <section className="booking-map-panel rider-discovery-map" aria-label="اختيار الموقع من الخريطة"><div className="booking-map-toolbar"><p className="map-instruction">حدد {mapTarget === "pickup" ? "نقطة الركوب" : "نقطة الوصول"} على الخريطة.</p><button type="button" className="map-close-button" onClick={() => setMapOpen(false)} aria-label="إغلاق الخريطة">×</button></div><div className="booking-map"><MapPicker pickup={pickup} dropoff={dropoff} mode={mapTarget} restrictToGreaterCairo onOutsidePick={() => setError("اختار نقطة داخل القاهرة الكبرى فقط.")} onPick={setMapPoint} /></div></section>}
    {error && <p className="rider-discovery-error" role="alert">{error}</p>}
    {searching && !matches.length && <p className="rider-discovery-status" role="status">بنبحث عن مجموعات مناسبة لخطك…</p>}
    {!searching && searched && !error && matches.length === 0 && <div className="rider-discovery-empty"><strong>مفيش مجموعة مناسبة لخطك حاليًا</strong><span>جرّب تعديل النقط أو ارجع شوف الاقتراحات بعد شوية.</span><button type="button" className="text-action" onClick={onJoinByCode}>معاك رقم مجموعة؟ انضم بالكود ←</button></div>}
    {matches.length > 0 && <div className="rider-discovery-results" aria-live="polite"><div className="rider-discovery-results-heading"><strong>مجموعات مناسبة لخطك</strong><span>{matches.length} نتيجة</span></div>{matches.map((match) => {
      const group = match.group;
      const category = categories.find((item) => item.id === group.category_id);
      let firstDate = "";
      try { firstDate = (JSON.parse(group.service_dates) as string[])[0] ?? ""; } catch { firstDate = ""; }
      return <article className="rider-discovery-result" key={group.id}><div className="rider-discovery-result-top"><span className="status-chip status-waiting">بتجمع ركاب</span><span>مجموعة #{group.id}</span></div><div className="rider-discovery-result-main"><strong>{category ? categoryName(category) : "مجموعة مشوار"}</strong><b>{group.seat_day_fare === null ? "السعر بيتحدث" : `${money(group.seat_day_fare)} للفرد / يوم`}</b></div><div className="rider-discovery-result-meta"><span>متاح {match.seats_available} {match.seats_available === 1 ? "مقعد" : "مقاعد"}</span><span>{group.package_type === "daily" ? "يومي" : group.package_type === "weekly" ? "أسبوعي" : "شهري"}{firstDate ? ` · يبدأ ${formatDate(firstDate)}` : ""}</span><span>ذهاب {group.morning_departure.slice(0, 5)} · عودة {group.return_departure.slice(0, 5)}</span><span>الركوب والوصول ضمن ٣ كم من المسار</span></div><button type="button" className="button button-primary button-small" onClick={() => onJoin(match, pickup!, dropoff!)}>انضم للمجموعة <span>←</span></button></article>;
    })}</div>}
    <small className="rider-discovery-attribution">مواقع البحث من OpenStreetMap</small>
  </section>;
}

