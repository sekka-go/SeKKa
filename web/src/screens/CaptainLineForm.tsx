import { useEffect, useState, type FormEvent } from "react";
import { sekkaApi } from "../lib/sekka-api";
import { captainLinePricingError, isCaptainLinePaymentMethod, validateCaptainLinePricing } from "../../../shared/captainLinePricing.ts";

type Place = { label: string; primary: string; secondary: string; lat: number; lng: number };
type Line = { id: string; vehicle_type_id: string; origin_label: string; origin_lat: number; origin_lng: number; destination_label: string; destination_lat: number; destination_lng: number; arrival_time: string; return_arrival_time: string | null; service_days: number[]; seats: number; price_per_seat: number | null; payment_methods: string[] };
type Props = { mode: "new" | "edit"; line?: Line; onBack: () => void; onSaved: () => void };
const days = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const paymentOptions = [{ id: "cash", name: "نقدًا" }, { id: "wallet", name: "محفظة إلكترونية خارجية" }, { id: "instapay", name: "InstaPay" }];

export default function CaptainLineForm({ mode, line, onBack, onSaved }: Props) {
  const editing = mode === "edit";
  const [profile, setProfile] = useState<any>(null);
  const [origin, setOrigin] = useState<Place | null>(line ? { label: line.origin_label, primary: line.origin_label, secondary: "", lat: line.origin_lat, lng: line.origin_lng } : null);
  const [destination, setDestination] = useState<Place | null>(line ? { label: line.destination_label, primary: line.destination_label, secondary: "", lat: line.destination_lat, lng: line.destination_lng } : null);
  const [originQuery, setOriginQuery] = useState(line?.origin_label ?? "");
  const [destinationQuery, setDestinationQuery] = useState(line?.destination_label ?? "");
  const [originOptions, setOriginOptions] = useState<Place[]>([]);
  const [destinationOptions, setDestinationOptions] = useState<Place[]>([]);
  const [serviceDays, setServiceDays] = useState<number[]>(line?.service_days ?? []);
  const [arrival, setArrival] = useState(line?.arrival_time?.slice(0, 5) ?? "08:00");
  const [returnArrival, setReturnArrival] = useState(line?.return_arrival_time?.slice(0, 5) ?? "");
  const [seats, setSeats] = useState(String(line?.seats ?? 1));
  const [price, setPrice] = useState(line?.price_per_seat == null ? "" : String(line.price_per_seat));
  const [paymentMethods, setPaymentMethods] = useState<string[]>(() => line ? line.payment_methods.filter(isCaptainLinePaymentMethod) : ["cash"]);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState("");

  useEffect(() => { let active = true; sekkaApi<{ profile: any }>("/captain/profile").then(({ profile: data }) => { if (active) setProfile(data); }).catch((cause) => { if (active) setError(message(cause)); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);

  async function searchLocation(query: string, setter: (value: Place[]) => void) {
    if (query.trim().length < 3) return;
    try { const { suggestions } = await sekkaApi<{ suggestions: Place[] }>("/locations/search", { method: "POST", body: { query: query.trim() } }); setter(suggestions ?? []); }
    catch (cause) { setError(message(cause)); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    if (!profile?.vehicle_type_id) { setError("أكمل بيانات المركبة في ملف الكابتن أولًا."); return; }
    if (editing && !line) { setError("لم يتم العثور على العرض المطلوب تعديله. ارجع إلى قائمة العروض واختر عرضًا صالحًا."); return; }
    if (!origin || !destination) { setError("اختر نقطتي البداية والوصول من نتائج البحث عن المواقع."); return; }
    if (!serviceDays.length) { setError("اختر يوم تشغيل واحدًا على الأقل."); return; }
    const pricing = validateCaptainLinePricing(price, paymentMethods);
    if (!pricing.ok) { setError(captainLinePricingError(pricing.reason)); return; }
    const body = { vehicle_type_id: profile.vehicle_type_id, origin_label: origin.label, origin_lat: origin.lat, origin_lng: origin.lng, destination_label: destination.label, destination_lat: destination.lat, destination_lng: destination.lng, service_days: serviceDays, arrival_time: arrival, return_arrival_time: returnArrival || null, seats: Number(seats), price_per_seat: pricing.pricePerSeat, payment_methods: pricing.paymentMethods };
    setSaving(true);
    try { await sekkaApi(editing ? `/captain/lines/${line!.id}` : "/captain/lines", { method: editing ? "PUT" : "POST", body }); onSaved(); }
    catch (cause) { setError(message(cause)); }
    finally { setSaving(false); }
  }

  const choose = (place: Place, isOrigin: boolean) => { if (isOrigin) { setOrigin(place); setOriginQuery(place.label); setOriginOptions([]); } else { setDestination(place); setDestinationQuery(place.label); setDestinationOptions([]); } };
  const toggle = (value: number | string, values: Array<number | string>, setter: (next: any) => void) => setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value].sort());
  const renderPlace = (isOrigin: boolean) => { const query = isOrigin ? originQuery : destinationQuery; const setter = isOrigin ? setOriginQuery : setDestinationQuery; const options = isOrigin ? originOptions : destinationOptions; const setOptions = isOrigin ? setOriginOptions : setDestinationOptions; const selected = isOrigin ? origin : destination; return <label className="journey-form-label captain-place-field">{isOrigin ? "نقطة البداية" : "نقطة الوصول"}<div><input value={query} placeholder="ابحث عن عنوان داخل القاهرة الكبرى" onChange={(event) => { setter(event.target.value); isOrigin ? setOrigin(null) : setDestination(null); }}/><button type="button" onClick={() => void searchLocation(query, setOptions)}>بحث</button></div>{selected && <small>الموقع المختار: {selected.label}</small>}{options.length > 0 && <div className="captain-place-options">{options.map((item) => <button type="button" key={`${item.lat}:${item.lng}`} onClick={() => choose(item, isOrigin)}><strong>{item.primary}</strong><small>{item.secondary}</small></button>)}</div>}</label>; };

  return <form className="journey-data-card captain-line-form" onSubmit={submit}>
    <h2>{editing ? "تعديل عرض التنقل" : "إنشاء عرض تنقل"}</h2>
    {loading ? <p>جارٍ تحميل ملف المركبة…</p> : !profile?.vehicle_type_id ? <p className="journey-alert">لا يوجد نوع مركبة محفوظ في ملفك. أكمل الملف قبل نشر عرض.</p> : <>
      {editing && !line ? <p className="journey-alert">العرض المطلوب غير موجود. ارجع إلى قائمة العروض واختر عرضًا صالحًا.</p> : <><div className="journey-info"><span>فئة المركبة المعتمدة</span><strong>{profile.vehicle_type_id}</strong></div>
      {renderPlace(true)}{renderPlace(false)}
      <fieldset className="captain-line-checks"><legend>أيام التشغيل</legend>{days.map((label, index) => <label key={label}><input type="checkbox" checked={serviceDays.includes(index)} onChange={() => toggle(index, serviceDays, setServiceDays)}/>{label}</label>)}</fieldset>
      <div className="captain-line-grid"><label className="journey-form-label">موعد الوصول<input type="time" value={arrival} onChange={(event) => setArrival(event.target.value)} required/></label><label className="journey-form-label">موعد العودة (اختياري)<input type="time" value={returnArrival} onChange={(event) => setReturnArrival(event.target.value)}/></label></div>
      <div className="captain-line-grid"><label className="journey-form-label">سعر الرحلة الواحدة لكل مقعد (جنيه)<input type="number" min="0.01" max="99999999.99" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="أدخل سعر الرحلة لكل مقعد" required/></label><label className="journey-form-label">عدد المقاعد<input type="number" min="1" max="13" value={seats} onChange={(event) => setSeats(event.target.value)} required/></label></div>
      {line?.payment_methods.some((method) => !isCaptainLinePaymentMethod(method)) && <p className="journey-note" role="status">يتضمن العرض وسيلة دفع غير معروفة في النموذج الحالي. راجع الوسائل قبل الحفظ.</p>}
      <fieldset className="captain-line-checks"><legend>وسائل الدفع المباشر خارج سِكّة</legend>{paymentOptions.map((item) => <label key={item.id}><input type="checkbox" checked={paymentMethods.includes(item.id)} onChange={() => toggle(item.id, paymentMethods, setPaymentMethods)}/>{item.name}</label>)}</fieldset>
      <p className="journey-note">تدفع مباشرة للكابتن. لا تستقبل سِكّة الأموال ولا تحتفظ بها، والمحفظة الإلكترونية لدى مزود خارجي.</p>
      <p className="journey-note">النشر متاح بعد توثيق الهاتف واعتماد الحساب. تسجيل العرض لا يضمن قبول طلب أو اكتمال مجموعة.</p>
    </>}</>}
    {error && <p className="journey-alert error" role="alert">{error}</p>}
    <div className="captain-line-actions"><button type="button" className="journey-secondary" onClick={onBack}>رجوع</button><button className="journey-primary" type="submit" disabled={saving || loading || !profile?.vehicle_type_id || (editing && !line)}>{saving ? "جارٍ الإرسال…" : editing ? "حفظ التعديل" : "إرسال العرض"}</button></div>
  </form>;
}

function message(cause: unknown) { const value = cause instanceof Error ? cause.message : ""; return value || "تعذر حفظ العرض. تحقق من البيانات وحاول مرة أخرى."; }
