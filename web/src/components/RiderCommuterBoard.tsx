import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type { MapPoint } from "../MapPicker";
import { api, type Category, type CommuterBoardCard, type GroupView, type PoolDiscoveryMatch, type RiderCommuterPreferences, type SavedPlace } from "../api";
import { categoryName, money } from "../lib/formatters";
import { buildPersonalizedCommuterCards, commuterSwipeDirection, nextCommuterCardIndex, runCommuterCardAction } from "../lib/commuter-board";

const DEFAULT_PREFERENCES: RiderCommuterPreferences = { usual_days: [0, 1, 2, 3, 4], usual_departure_time: "07:30", usual_return_time: "17:00", frequent_places: [] };
const pointFrom = (place: SavedPlace, kind: "pickup" | "dropoff"): MapPoint => ({ lat: place.lat, lng: place.lng, label: place.label, kind });
const packageLabel = (value: string) => value === "weekly" ? "أسبوعي" : value === "monthly" ? "شهري" : "يومي";

export default function RiderCommuterBoard({ token, places, groups, categories, onCreateTrip, onOpenTrips, onJoin, onManagePreferences, onInviteFriends }: {
  token: string; places: SavedPlace[]; groups: GroupView[]; categories: Category[];
  onCreateTrip: (packageType?: "daily" | "weekly" | "monthly") => void;
  onOpenTrips: () => void;
  onJoin: (match: PoolDiscoveryMatch, pickup: MapPoint, dropoff: MapPoint) => void;
  onManagePreferences: () => void;
  onInviteFriends: () => void;
}) {
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [matches, setMatches] = useState<PoolDiscoveryMatch[]>([]);
  const [campaigns, setCampaigns] = useState<CommuterBoardCard[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<"up" | "down">("up");
  const [reducedMotion, setReducedMotion] = useState(false);
  const pointerStart = useRef<number | null>(null);
  const home = places.find((place) => place.place_type === "home");
  const work = places.find((place) => place.place_type === "work");

  useEffect(() => {
    let active = true;
    void Promise.all([
      api<{ preferences: RiderCommuterPreferences }>("/rider/commuter-preferences", { token }),
      api<{ cards: CommuterBoardCard[] }>("/rider/commuter-board-cards", { token }),
    ]).then(([preferenceResult, cardResult]) => {
      if (!active) return;
      setPreferences({ ...DEFAULT_PREFERENCES, ...preferenceResult.preferences, frequent_places: preferenceResult.preferences?.frequent_places ?? [] });
      setCampaigns(cardResult.cards ?? []);
    }).catch(() => { if (active) setPreferences(DEFAULT_PREFERENCES); });
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    let active = true;
    if (!home || !work) { setMatches([]); return () => { active = false; }; }
    void api<{ matches: PoolDiscoveryMatch[] }>("/rider/pool/discover", { method: "POST", token, body: { pickup_lat: home.lat, pickup_lng: home.lng, dropoff_lat: work.lat, dropoff_lng: work.lng } })
      .then((result) => { if (active) setMatches(result.matches ?? []); })
      .catch(() => { if (active) setMatches([]); });
    return () => { active = false; };
  }, [home?.lat, home?.lng, work?.lat, work?.lng, token]);

  const cards = useMemo(() => buildPersonalizedCommuterCards({ home, work, matches, groups, preferences, campaigns }), [campaigns, groups, home, matches, preferences, work]);

  useEffect(() => { setActiveIndex((index) => cards.length ? index % cards.length : 0); }, [cards.length]);
  useEffect(() => {
    if (cards.length < 2 || reducedMotion) return;
    const timer = window.setTimeout(() => {
      setSlideDirection("up");
      setActiveIndex((index) => (index + 1) % cards.length);
    }, 5_000);
    return () => window.clearTimeout(timer);
  }, [activeIndex, cards.length, reducedMotion]);
  const navigate = (index: number) => {
    setSlideDirection(index >= activeIndex ? "up" : "down");
    setActiveIndex(nextCommuterCardIndex(activeIndex, cards.length, index - activeIndex));
  };
  const act = (card: CommuterBoardCard) => {
    runCommuterCardAction(card.cta_action, {
      openBooking: onCreateTrip, openTrips: onOpenTrips, inviteFriends: onInviteFriends, managePreferences: onManagePreferences,
      joinGroup: () => {
      const match = matches.find((item) => item.group.id === card.group_id);
      if (match && home && work) onJoin(match, pointFrom(home, "pickup"), pointFrom(work, "dropoff"));
      },
    }, card.type);
  };
  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    pointerStart.current = event.clientY;
  };
  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    if (pointerStart.current === null) return;
    const delta = event.clientY - pointerStart.current;
    pointerStart.current = null;
    const direction = commuterSwipeDirection(delta);
    if (direction) navigate(activeIndex + direction);
  };
  const card = cards[activeIndex];

  return <section className="surface commuter-board" aria-label="اقتراحات مشاويرك الشخصية">
    <div className="commuter-board-viewport" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { pointerStart.current = null; }}>
      {card && <article key={card.id} className={`commuter-board-card slide-${slideDirection}`} aria-live="off">
        <div className="commuter-board-copy"><span className="commuter-board-icon" aria-hidden="true">{card.icon}</span><span className="eyebrow">{card.type === "campaign" ? "اقتراح من سِكّة" : "اقتراح على طريقك"}</span><h2>{card.title}</h2><p>{card.description.split("\n").map((line, index) => <span key={index}>{line}{index < card.description.split("\n").length - 1 && <br />}</span>)}</p>
          {card.group_id && (() => { const item = groups.find(({ group }) => group.id === card.group_id); const category = categories.find(({ id }) => id === item?.group.category_id); return item ? <small className="commuter-board-meta">{category ? categoryName(category) : "رحلة مشتركة"} · {packageLabel(item.group.package_type)}{item.group.seat_day_fare === null ? "" : ` · ${money(item.group.seat_day_fare)} للفرد / يوم`}</small> : null; })()}
          <button type="button" className="button button-primary commuter-board-cta" onClick={() => act(card)}>{card.cta_text}<span aria-hidden="true">←</span></button>
        </div>
      </article>}
    </div>
    <div className="commuter-board-controls">
      <div className="commuter-board-indicators" role="group" aria-label="اختيار بطاقة الاقتراح">{cards.map((item, index) => <button key={item.id} type="button" className={index === activeIndex ? "active" : ""} aria-label={`عرض البطاقة ${index + 1} من ${cards.length}`} aria-current={index === activeIndex ? "true" : undefined} onClick={() => navigate(index)} />)}</div>
    </div>
    {cards.length > 1 && <small className="commuter-board-swipe-hint">اسحب لأعلى أو لأسفل للتنقل</small>}
  </section>;
}
