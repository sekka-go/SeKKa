export type Period = "weekly" | "monthly";
export type Direction = "outbound" | "return" | "round_trip";
export const categories = { PRIME: 3, SAVER: 4, SPACE: 9, MAX: 13 } as const;
export type Category = keyof typeof categories;
export type HolidayCalendar = {
  coveredFrom: string;
  coveredThrough: string;
  excluded: readonly string[];
};
const DAY = 86_400_000;
export function parseDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("INVALID_DATE");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(+date) || date.toISOString().slice(0, 10) !== value)
    throw new Error("INVALID_DATE");
  return date;
}
export const iso = (date: Date) => date.toISOString().slice(0, 10);
export const addDays = (day: string, count: number) =>
  iso(new Date(+parseDate(day) + count * DAY));
// Always derive from the ORIGINAL anchor: Jan 31 -> Feb 28 -> Mar 31.
export function boundary(
  anchor: string,
  period: Period,
  offset: number,
): string {
  const date = parseDate(anchor);
  if (period === "weekly") return addDays(anchor, offset * 7);
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1),
  );
  const last = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), last));
  return iso(target);
}
export function eligible(day: string, calendar: HolidayCalendar): boolean {
  parseDate(day);
  if (day < calendar.coveredFrom || day > calendar.coveredThrough)
    throw new Error("HOLIDAY_CALENDAR_UNAPPROVED");
  return parseDate(day).getUTCDay() < 5 && !calendar.excluded.includes(day);
}
export function startDate(now: Date, calendar: HolidayCalendar): string {
  if (!Number.isFinite(+now)) throw new Error("INVALID_INSTANT");
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Cairo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  let day = `${parts.year}-${parts.month}-${parts.day}`;
  if (Number(parts.hour) > 0 || Number(parts.minute) > 0) day = addDays(day, 1);
  for (let attempts = 0; attempts < 370; attempts++, day = addDays(day, 1))
    if (eligible(day, calendar)) return day;
  throw new Error("NO_ELIGIBLE_DAY");
}
export function quote(input: {
  anchor: string;
  period: Period;
  fullPrice: number;
  now: Date;
  calendar: HolidayCalendar;
}) {
  if (!Number.isSafeInteger(input.fullPrice) || input.fullPrice <= 0)
    throw new Error("INVALID_PRICE");
  const start = startDate(input.now, input.calendar);
  if (start < input.anchor) throw new Error("CYCLE_NOT_STARTED");
  const a = parseDate(input.anchor),
    s = parseDate(start);
  let index =
    input.period === "weekly"
      ? Math.floor((+s - +a) / DAY / 7)
      : (s.getUTCFullYear() - a.getUTCFullYear()) * 12 +
        s.getUTCMonth() -
        a.getUTCMonth();
  if (boundary(input.anchor, input.period, index) > start) index--;
  const cycleStart = boundary(input.anchor, input.period, index),
    endExclusive = boundary(input.anchor, input.period, index + 1);
  let totalDays = 0,
    remainingDays = 0;
  for (let day = cycleStart; day < endExclusive; day = addDays(day, 1))
    if (eligible(day, input.calendar)) {
      totalDays++;
      if (day >= start) remainingDays++;
    }
  if (!totalDays || !remainingDays) throw new Error("NO_ELIGIBLE_DAY");
  return Object.freeze({
    start,
    cycleStart,
    endExclusive,
    totalDays,
    remainingDays,
    fullPrice: input.fullPrice,
    price: Math.floor(
      (input.fullPrice * remainingDays * 2 + totalDays) / (totalDays * 2),
    ),
    securityEgp: 100,
  });
}
export function normalizePhone(value: string): string {
  const p = value.trim().replace(/[\s()-]/g, "");
  if (/^01[0125]\d{8}$/.test(p)) return "+20" + p.slice(1);
  if (/^\+201[0125]\d{8}$/.test(p)) return p;
  throw new Error("INVALID_EGYPTIAN_PHONE");
}
