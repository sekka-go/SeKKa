export { canonicalTitles as screenTitles } from "./screenMap";
export type Screen = number;
export const screenRole = (id: number) =>
  id >= 62 ? "admin" : id >= 35 ? "captain" : "rider";
export const publicScreens = new Set([1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 16, 37]);
export const adminResources: Record<number, string> = {
  64: "analytics",
  65: "captains",
  66: "vehicles",
  67: "routes",
  68: "profiles",
  69: "bookings",
  70: "ledger",
  71: "disputes",
  72: "route_requests",
  73: "notifications",
  74: "analytics",
  75: "audit_log",
};
