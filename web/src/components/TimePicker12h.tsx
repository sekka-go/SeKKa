import { getDirection, getLanguage, t } from "../i18n/runtime";
import { useState, type ChangeEvent, type FocusEvent } from "react";

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
  const suffix = getLanguage() === "ar" ? (period === "am" ? "ص" : "م") : period.toUpperCase();
  return `${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${suffix}`;
};

export default function TimePicker12h({ label, value, onChange }: TimePicker12hProps) {
  const parsed = parseTime(value);
  const [hourDraft, setHourDraft] = useState(String(parsed.hour12).padStart(2, "0"));
  const [minuteDraft, setMinuteDraft] = useState(String(parsed.minute).padStart(2, "0"));
  const commit = (hour12: number, minute: number, period = parsed.period) => {
    const hour24 = period === "pm" ? hour12 % 12 + 12 : hour12 % 12;
    onChange(`${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
  };
  const handlePartChange = (part: "hour" | "minute", event: ChangeEvent<HTMLInputElement>) => {
    const draft = event.currentTarget.value
      .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
      .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
      .replace(/\D/g, "")
      .slice(0, 2);
    if (part === "hour") setHourDraft(draft);
    else setMinuteDraft(draft);
    const hour = part === "hour" ? Number(draft) : Number(hourDraft);
    const minute = part === "minute" ? Number(draft) : Number(minuteDraft);
    if (hour >= 1 && hour <= 12 && minute >= 0 && minute <= 59) commit(hour, minute);
  };
  const handlePartBlur = (part: "hour" | "minute", event: FocusEvent<HTMLInputElement>) => {
    const raw = Number(event.currentTarget.value);
    if (part === "hour") {
      const hour = Number.isFinite(raw) ? Math.max(1, Math.min(12, raw)) : parsed.hour12;
      setHourDraft(String(hour).padStart(2, "0"));
      commit(hour, parsed.minute);
    } else {
      const minute = Number.isFinite(raw) ? Math.max(0, Math.min(59, raw)) : parsed.minute;
      setMinuteDraft(String(minute).padStart(2, "0"));
      commit(parsed.hour12, minute);
    }
  };
  const togglePeriod = () => commit(Number(hourDraft) || parsed.hour12, Number(minuteDraft) || parsed.minute, parsed.period === "am" ? "pm" : "am");

  const translatedLabel = t(label);
  const unitLabel = getLanguage() === "ar" ? t("ساعة") : "Hour";
  const minuteLabel = getLanguage() === "ar" ? t("دقيقة") : "Minute";
  return <label className="time-picker-field">{translatedLabel}
    <span className="time-picker-control" dir="ltr">
      <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2} aria-label={`${unitLabel} ${translatedLabel}`} value={hourDraft} onChange={(event) => handlePartChange("hour", event)} onBlur={(event) => handlePartBlur("hour", event)} />
      <span aria-hidden="true">:</span>
      <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2} aria-label={`${minuteLabel} ${translatedLabel}`} value={minuteDraft} onChange={(event) => handlePartChange("minute", event)} onBlur={(event) => handlePartBlur("minute", event)} />
      <button type="button" className="time-period-toggle" dir={getDirection()} aria-label={getLanguage() === "ar" ? `${t("التبديل إلى")} ${parsed.period === "am" ? t("مساءً") : t("صباحًا")} · ${translatedLabel}` : `Switch to ${parsed.period === "am" ? "PM" : "AM"} · ${translatedLabel}`} onClick={togglePeriod}>{parsed.period === "am" ? (getLanguage() === "ar" ? "ص" : "AM") : (getLanguage() === "ar" ? "م" : "PM")}</button>
    </span>
  </label>;
}
