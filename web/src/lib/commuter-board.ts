import type { CommuterBoardCard, CommuterCardAction, GroupView, PoolDiscoveryMatch, RiderCommuterPreferences, SavedPlace } from "../api";

const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const time = (value: string) => value.slice(0, 5);

export function nextCommuterCardIndex(current: number, count: number, direction = 1) {
  return count > 0 ? (current + direction + count) % count : 0;
}

export function commuterCardDurationMs(card?: Pick<CommuterBoardCard, "display_duration">) {
  return Math.max(5, card?.display_duration ?? 10) * 1000;
}

export function commuterSwipeDirection(deltaX: number) {
  return Math.abs(deltaX) > 45 ? (deltaX > 0 ? -1 : 1) : 0;
}

export function runCommuterCardAction(action: CommuterCardAction, handlers: {
  openBooking: (packageType?: "daily" | "weekly" | "monthly") => void;
  openTrips: () => void; inviteFriends: () => void; managePreferences: () => void; joinGroup: () => void;
}, cardType?: CommuterBoardCard["type"]) {
  if (action === "open-booking") handlers.openBooking(cardType === "weekly_reminder" ? "weekly" : cardType === "monthly_reminder" ? "monthly" : undefined);
  else if (action === "open-trips") handlers.openTrips();
  else if (action === "invite-friends") handlers.inviteFriends();
  else if (action === "manage-preferences") handlers.managePreferences();
  else if (action === "join-group") handlers.joinGroup();
}

export function buildPersonalizedCommuterCards({ home, work, matches, groups, preferences, campaigns, now = Date.now() }: {
  home?: SavedPlace; work?: SavedPlace; matches: PoolDiscoveryMatch[]; groups: GroupView[];
  preferences: RiderCommuterPreferences; campaigns: CommuterBoardCard[]; now?: number;
}): CommuterBoardCard[] {
  const generated: CommuterBoardCard[] = [];
  const route = Boolean(home && work);
  if (home && work) {
    matches.slice(0, 3).forEach((match, index) => {
      const group = match.group;
      generated.push({ id: `match-${group.id}`, type: index === 0 ? "new_match" : "commute_match", title: index === 0 ? "لقيت لك ناس رايحين نفس طريقك" : "رحلة مناسبة لمشوارك", description: `${home.label} → ${work.label}\nموعد مناسب: ${time(group.morning_departure)} · متاح ${match.seats_available} ${match.seats_available === 1 ? "مقعد" : "مقاعد"}`, icon: "⌖", cta_text: "شوف الرحلة", cta_action: "join-group", priority: 100 - index, targeting_rules: { scope: "greater-cairo", home: home.label, destination: work.label }, start_date: null, end_date: null, active: true, display_duration: 10, group_id: group.id });
    });
  }
  const recurring = groups.find(({ group }) => group.package_type === "weekly" || group.package_type === "monthly");
  if (recurring && home && work) {
    const group = recurring.group;
    const days = [...new Set(preferences.usual_days)].sort((a, b) => a - b).map((day) => DAYS[day]).join(" - ");
    generated.push({ id: `recurring-${group.id}`, type: "recurring_commute", title: "مشوارك المعتاد", description: `${home.label} → ${work.label}\n${days || "أيامك المعتادة"} · ${time(group.morning_departure)} صباحًا`, icon: "↻", cta_text: "افتح رحلتك", cta_action: "open-trips", priority: 85, targeting_rules: { scope: "greater-cairo", group_id: group.id }, start_date: null, end_date: null, active: true, display_duration: 10, group_id: group.id });
  }
  const weekly = groups.some(({ group }) => group.package_type === "weekly" && ["waiting", "active", "forming"].includes(group.status));
  const monthly = groups.some(({ group }) => group.package_type === "monthly" && ["waiting", "active", "forming"].includes(group.status));
  if (route && !weekly) generated.push({ id: "weekly-reminder", type: "weekly_reminder", title: "رتّب مشاوير أسبوعك", description: "حدد أيامك المعتادة وخلي مشوارك الأسبوعي جاهزًا من بدري.", icon: "▦", cta_text: "رتّب الأسبوع", cta_action: "open-booking", priority: 60, targeting_rules: { scope: "greater-cairo" }, start_date: null, end_date: null, active: true, display_duration: 10 });
  if (route && !monthly) generated.push({ id: "monthly-reminder", type: "monthly_reminder", title: "رتّب مشاويرك الشهرية", description: "نظّم مشاويرك المتكررة للشهر على طريقك المعتاد.", icon: "▤", cta_text: "إدارة المشاوير", cta_action: "open-booking", priority: 55, targeting_rules: { scope: "greater-cairo" }, start_date: null, end_date: null, active: true, display_duration: 10 });
  if (!route) generated.push({ id: "empty-route", type: "empty", title: "خلّي سكة تعرف مشوارك", description: "حدد نقطة الركوب والوصول المعتادتين عشان نرتب لك اقتراحات على طريقك.", icon: "⌖", cta_text: "حدد مشواري", cta_action: "manage-preferences", priority: 80, targeting_rules: { scope: "greater-cairo" }, start_date: null, end_date: null, active: true, display_duration: 10 });
  else if (matches.length === 0 && home && work) generated.push({ id: "no-matches", type: "empty", title: "مفيش رحلة مناسبة دلوقتي", description: "هنعرض لك أي مجموعة تستقبل ركابًا على خطك داخل القاهرة الكبرى أول ما تتوفر.", icon: "⌖", cta_text: "أنشئ مشوارك", cta_action: "open-booking", priority: 75, targeting_rules: { scope: "greater-cairo", home: home.label, destination: work.label }, start_date: null, end_date: null, active: true, display_duration: 10 });
  generated.push({ id: "invite-friends", type: "invite_friends", title: "أصحابك بيروحوا نفس الطريق؟", description: "اعزمهم على سِكّة وخلي مشواركم أسهل.", icon: "↗", cta_text: "ادعُ أصحابك", cta_action: "invite-friends", priority: 40, targeting_rules: { scope: "greater-cairo" }, start_date: null, end_date: null, active: true, display_duration: 10 });
  const activeCampaigns = campaigns.filter((card) => card.active && (!card.start_date || Date.parse(card.start_date) <= now) && (!card.end_date || Date.parse(card.end_date) > now));
  return [...generated, ...activeCampaigns].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id)).slice(0, 8);
}
