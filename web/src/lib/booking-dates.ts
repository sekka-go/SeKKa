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
export function serviceWeek() {
  const today = todayInCairo();
  const day = new Date(`${today}T12:00:00Z`).getUTCDay();
  const sunday = shiftDate(today, day === 0 ? 7 : 7 - day);
  return Array.from({ length: 5 }, (_, index) => shiftDate(sunday, index));
}
export function serviceMonth() {
  const today = todayInCairo();
  const parts = today.split("-").map(Number);
  for (let offset = 1; offset <= 4; offset++) {
    const monthStart = new Date(Date.UTC(parts[0]!, parts[1]! - 1 + offset, 1, 12));
    const month = monthStart.toISOString().slice(0, 7);
    const last = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0, 12)).getUTCDate();
    const days: string[] = [];
    for (let day = 1; day <= last; day++) {
      const date = `${month}-${String(day).padStart(2, "0")}`;
      if (isServiceDay(date)) days.push(date);
    }
    if (days.length >= 22) return days;
  }
  return [];
}
export function defaultDates(type: "daily" | "weekly" | "monthly") {
  if (type === "weekly") return serviceWeek();
  if (type === "monthly") return serviceMonth().slice(0, 22);
  let date = shiftDate(todayInCairo(), 1);
  while (!isServiceDay(date)) date = shiftDate(date, 1);
  return [date];
}
export function readDates(value: string) { try { return JSON.parse(value) as string[]; } catch { return []; } }
export function pointLabel(point: MapPoint | null) {
  if (!point) return "اضغط على الخريطة لتحديد الموقع";
  if (point.label) return point.label;
  if (typeof point.lat !== "number" || typeof point.lng !== "number") return "الموقع غير متاح";
  return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
}
