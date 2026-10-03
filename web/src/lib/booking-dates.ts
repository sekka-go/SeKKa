import type { MapPoint } from "../MapPicker";

export function todayInCairo() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
}
export function shiftDate(value: string, amount: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
export function isServiceDay(value: string) {
  const day = new Date(`${value}T12:00:00Z`).getUTCDay();
  return day >= 0 && day <= 4;
}
export function serviceDatesFromStart(start: string, type: "daily" | "weekly" | "monthly") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !isServiceDay(start)) return [];
  const count = type === "daily" ? 1 : type === "weekly" ? 5 : 22;
  const dates = [start];
  while (dates.length < count) {
    let next = shiftDate(dates[dates.length - 1]!, 1);
    while (!isServiceDay(next)) next = shiftDate(next, 1);
    dates.push(next);
  }
  return dates;
}
export function defaultDates(type: "daily" | "weekly" | "monthly") {
  let start = shiftDate(todayInCairo(), 1);
  while (!isServiceDay(start)) start = shiftDate(start, 1);
  return serviceDatesFromStart(start, type);
}
export function readDates(value: string) { try { return JSON.parse(value) as string[]; } catch { return []; } }
export function pointLabel(point: MapPoint | null) {
  if (!point) return "اضغط على الخريطة لتحديد الموقع";
  if (point.label) return point.label;
  if (typeof point.lat !== "number" || typeof point.lng !== "number") return "الموقع غير متاح";
  return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
}
