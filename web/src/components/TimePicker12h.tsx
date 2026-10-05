import type { ChangeEvent } from "react";

type TimePicker12hProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

const parseTime = (value: string) => {
  const [rawHour, rawMinute] = value.slice(0, 5).split(":");
  const hour = Number(rawHour);
  const minute = Number(rawMinute);
  const safeHour = Number.isFinite(hour) ? hour : 0;
  return {
    hour12: safeHour % 12 || 12,
    minute: Number.isFinite(minute) ? Math.max(0, Math.min(59, minute)) : 0,
    period: safeHour < 12 ? "am" : "pm",
  };
};

export const formatTime12h = (value: string) => {
  const { hour12, minute, period } = parseTime(value);
  return `${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${period === "am" ? "ص" : "م"}`;
};

export default function TimePicker12h({ label, value, onChange }: TimePicker12hProps) {
  const parsed = parseTime(value);
  const update = (field: "hour" | "minute" | "period", event: ChangeEvent<HTMLSelectElement>) => {
    const hour12 = field === "hour" ? Number(event.target.value) : parsed.hour12;
    const minute = field === "minute" ? Number(event.target.value) : parsed.minute;
    const period = field === "period" ? event.target.value : parsed.period;
    const hour24 = period === "م" ? hour12 % 12 + 12 : hour12 % 12;
    onChange(`${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
  };

  return <label className="time-picker-field">{label}
    <span className="time-picker-control" dir="ltr">
      <select aria-label={`ساعة ${label}`} value={parsed.hour12} onChange={(event) => update("hour", event)}>
        {Array.from({ length: 12 }, (_, index) => index + 1).map((hour) => <option key={hour} value={hour}>{String(hour).padStart(2, "0")}</option>)}
      </select>
      <span aria-hidden="true">:</span>
      <select aria-label={`دقيقة ${label}`} value={parsed.minute} onChange={(event) => update("minute", event)}>
        {Array.from({ length: 60 }, (_, minute) => minute).map((minute) => <option key={minute} value={minute}>{String(minute).padStart(2, "0")}</option>)}
      </select>
      <select aria-label={`صباحًا أم مساءً ${label}`} dir="rtl" value={parsed.period === "am" ? "ص" : "م"} onChange={(event) => update("period", event)}>
        <option value="ص">ص</option>
        <option value="م">م</option>
      </select>
    </span>
  </label>;
}
