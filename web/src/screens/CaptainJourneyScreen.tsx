import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sekkaApi, sekkaApiForm, logoutSekkaSession } from "../lib/sekka-api";
import CaptainLineForm from "./CaptainLineForm";
import "./rider-journey-screen.css";

export type CaptainJourneyKey = "home" | "approval" | "documents" | "vehicle" | "offers" | "new-offer" | "edit-offer" | "rider-requests" | "rider-request" | "groups" | "group" | "riders" | "subscriptions" | "payments" | "payment" | "confirm-receipt" | "send-code" | "payment-status" | "renewal" | "replacement" | "conversations" | "notifications" | "ratings-reports" | "profile";
type Props = { supabase: SupabaseClient | null; screen: CaptainJourneyKey; onNavigate: (path: string) => void };
type Meta = { title: string; subtitle: string; icon: string };
const meta: Record<CaptainJourneyKey, Meta> = {
  home:{title:"الرئيسية للكابتن",subtitle:"ملخص خطوطك ومجموعاتك والإجراءات المنتظرة.",icon:"⌂"},approval:{title:"حالة اعتماد الحساب",subtitle:"تابع مراجعة ملفك والوثائق والخطوة التالية.",icon:"✓"},documents:{title:"استكمال الملف والوثائق",subtitle:"راجع مستنداتك وحالة مراجعتها.",icon:"▤"},vehicle:{title:"بيانات المركبة",subtitle:"الفئة والسعة المعتمدة والبيانات المرتبطة بها.",icon:"▱"},offers:{title:"عروض التنقل",subtitle:"العروض المنشورة والمسودات وحالاتها.",icon:"⇄"},"new-offer":{title:"إنشاء عرض جديد",subtitle:"أدخل تفاصيل الخط ومواعيده وفئته وسعره.",icon:"＋"},"edit-offer":{title:"تعديل العرض",subtitle:"راجع بيانات العرض قبل طلب تحديثها.",icon:"✎"},"rider-requests":{title:"طلبات الركاب",subtitle:"طلبات الانضمام على خطوطك المنشورة.",icon:"♧"},"rider-request":{title:"تفاصيل طلب الراكب",subtitle:"راجع بيانات الطلب والخط المرتبط به.",icon:"◎"},groups:{title:"إدارة المجموعات",subtitle:"مجموعات الرحلات المرتبطة بعروضك.",icon:"⌘"},group:{title:"تفاصيل المجموعة",subtitle:"المسار والجدول وحالة المجموعة.",icon:"⌂"},riders:{title:"قائمة الركاب",subtitle:"قائمة الركاب المرتبطين بالمجموعات التي تديرها.",icon:"♙"},subscriptions:{title:"اشتراكات المجموعة",subtitle:"فترات الاشتراك وحالاتها والمبالغ المسجلة.",icon:"▤"},payments:{title:"طلبات الدفع",subtitle:"عمليات الدفع المباشرة التي تنتظر إجراءً.",icon:"◈"},payment:{title:"تفاصيل طلب الدفع",subtitle:"المبلغ والوسيلة والإثبات وحالة العملية.",icon:"▧"},"confirm-receipt":{title:"تأكيد استلام المبلغ",subtitle:"أكد الاستلام الفعلي فقط بعد قبض كامل المبلغ.",icon:"✓"},"send-code":{title:"إرسال كود الدفع",subtitle:"إصدار الكود يأتي بعد تسجيل تأكيد الاستلام بالخادم.",icon:"▣"},"payment-status":{title:"متابعة حالة الدفع",subtitle:"تابع حالة تأكيد الكود والاشتراك.",icon:"◷"},renewal:{title:"التجديد الشهري",subtitle:"قرارات الاستمرار والمهل المسجلة للمجموعات.",icon:"↻"},replacement:{title:"طلب البحث عن بديل",subtitle:"تابع طلب تعذر الاستمرار والبحث عن كابتن بديل.",icon:"⌕"},conversations:{title:"المحادثات",subtitle:"المحادثات المرتبطة بمجموعاتك.",icon:"☏"},notifications:{title:"الإشعارات",subtitle:"تنبيهات الدفع والمجموعات والتجديد.",icon:"♧"},"ratings-reports":{title:"التقييمات والبلاغات",subtitle:"التقييمات والبلاغات المتعلقة بحسابك.",icon:"★"},profile:{title:"الملف الشخصي والإعدادات",subtitle:"بيانات الحساب والتفضيلات وإدارة الجلسة.",icon:"◉"}
};
const links: Array<[CaptainJourneyKey,string]> = [["home","الرئيسية"],["approval","الاعتماد"],["documents","الوثائق"],["vehicle","المركبة"],["offers","العروض"],["new-offer","عرض جديد"],["edit-offer","تعديل العرض"],["rider-requests","طلبات الركاب"],["rider-request","تفاصيل طلب راكب"],["groups","المجموعات"],["group","تفاصيل المجموعة"],["riders","قائمة الركاب"],["subscriptions","اشتراكات المجموعة"],["payments","طلبات الدفع"],["payment","تفاصيل الدفع"],["confirm-receipt","تأكيد الاستلام"],["send-code","إرسال الكود"],["payment-status","حالة الدفع"],["renewal","التجديد الشهري"],["replacement","البحث عن بديل"],["conversations","المحادثات"],["notifications","الإشعارات"],["ratings-reports","التقييمات والبلاغات"],["profile","الملف الشخصي والإعدادات"]];
const linkGroups: Array<[string,CaptainJourneyKey[]]> = [["الحساب والجاهزية",["approval","documents","vehicle","profile"]],["العروض",["offers","new-offer","edit-offer"]],["طلبات الركاب والمجموعات",["rider-requests","rider-request","groups","group","riders","subscriptions"]],["المدفوعات",["payments","payment","confirm-receipt","send-code","payment-status","renewal"]],["التواصل",["replacement","conversations","notifications","ratings-reports"]]];
const writeNotice = "هذه العملية تحتاج إلى إجراء آمن على الخادم، ولم يتم حفظ أي تغيير.";

export default function CaptainJourneyScreen({screen,onNavigate}:Props){
  const [profile,setProfile]=useState<any>(null);const [captain,setCaptain]=useState<any>(null);const [records,setRecords]=useState<any[]>([]);const [selectedConversation,setSelectedConversation]=useState<any>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState("");const [notice,setNotice]=useState("");const [file,setFile]=useState<File|null>(null);const [uploading,setUploading]=useState(false);const [confirmingPayment,setConfirmingPayment]=useState<string|null>(null);const [sendingMessage,setSendingMessage]=useState(false);
  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true); setError(""); setNotice(""); setSelectedConversation(null);
      try {
        const [{ user }, verification] = await Promise.all([
          sekkaApi<{ user: any }>("/auth/me"),
          sekkaApi<any>("/verification"),
        ]);
        if (user?.role !== "captain") { onNavigate(user?.role === "rider" ? "/home" : "/login"); return; }
        if (active) {
          setProfile({ ...user, phone: user.phone_number });
          setCaptain({ verification_status: verification.verification_status, status: verification.captain_status, reviewed_at: null, review_note: null });
        }
        let result: any[] = [];
        if (["home", "offers", "new-offer", "edit-offer", "vehicle"].includes(screen)) {
          const { lines } = await sekkaApi<{ lines: any[] }>("/captain/lines");
          result = (lines ?? []).map((line) => ({ ...line, id: String(line.id), captain_id: String(line.captain_user_id), origin_name: line.origin_label, destination_name: line.destination_label, operating_days: line.service_days ?? [], departure_time: line.arrival_time, return_time: line.return_arrival_time, seat_count: line.seats, monthly_price: line.price_per_seat, currency: "EGP", vehicle_details: null, vehicle: null }));
          if (screen === "home") {
            const { groups } = await sekkaApi<{ groups: any[] }>("/captain/demand-groups");
            result = [...result, ...((groups ?? []).map((group) => ({ ...group, id: String(group.id), captain_line_id: String(group.captain_line_id), members: group.requests ?? [] })))];
          }
        } else if (["approval", "documents"].includes(screen)) {
          result = (verification.documents ?? []).map((document: any) => ({ ...document, verification_status: document.status }));
          if (active) setCaptain((value: any) => ({ ...value, verification_status: verification.verification_status, status: verification.captain_status, phone_verified: verification.phone_verified }));
        } else if (["rider-requests", "rider-request", "groups", "group", "riders", "subscriptions", "renewal", "replacement"].includes(screen)) {
          const [{ groups }, { lines }] = await Promise.all([sekkaApi<{ groups: any[] }>("/captain/demand-groups"), sekkaApi<{ lines: any[] }>("/captain/lines")]);
          const lineById = new Map((lines ?? []).map((line) => [String(line.id), line]));
          const normalized = (groups ?? []).map((group) => { const line = lineById.get(String(group.captain_line_id)); return { ...group, id: String(group.id), captain_line_id: String(group.captain_line_id), line: { origin_name: line?.origin_label ?? "", destination_name: line?.destination_label ?? "", departure_time: group.arrival_time }, members: group.requests ?? [] }; });
          result = ["rider-requests", "rider-request"].includes(screen) ? normalized.flatMap((group) => group.members.map((request: any) => ({ ...request, id: String(request.id), line_id: String(group.captain_line_id), group }))) : normalized;
        } else if (screen === "profile") {
          try { const { profile: captainProfile } = await sekkaApi<{ profile: any }>("/captain/profile"); if (active) setCaptain((value: any) => ({ ...value, ...captainProfile })); }
          catch (cause) { if ((cause as any)?.status !== 404) throw cause; }
        } else if (screen === "conversations") {
          const { conversations } = await sekkaApi<{ conversations: any[] }>("/messages/conversations");
          const conversationId = new URLSearchParams(window.location.search).get("id");
          if (conversationId) {
            const conversation = (conversations ?? []).find((item) => String(item.id) === conversationId);
            if (!conversation) throw new Error("المحادثة غير موجودة أو لا تملك صلاحية الوصول إليها.");
            const [{ messages }] = await Promise.all([
              sekkaApi<{ messages: any[] }>(`/messages/conversations/${encodeURIComponent(conversationId)}/messages`),
              sekkaApi(`/messages/conversations/${encodeURIComponent(conversationId)}/read`, { method: "POST" }),
            ]);
            if (active) setSelectedConversation(conversation);
            result = messages ?? [];
          } else result = conversations ?? [];
        } else if (screen === "notifications") {
          const { notifications } = await sekkaApi<{ notifications: any[] }>("/pool/notifications"); result = (notifications ?? []).map((item) => ({ ...item, type: item.kind ?? "إشعار", payload: { message: item.body ?? item.title }, read_at: item.read_at }));
        } else if (["payments", "payment", "confirm-receipt", "send-code", "payment-status"].includes(screen)) {
          const { earnings } = await sekkaApi<{ earnings: any[] }>("/captain/earnings");
          result = (earnings ?? []).map(({ trip, stops, payment }: any) => ({ ...payment, id: String(trip.id), trip, stops, payment, payment_method: payment?.payment_method ?? "cash", amount: payment?.amount ?? trip.total_amount, status: payment?.status ?? "awaiting_captain_confirmation" }));
        } else {
          setNotice("لا توجد واجهة API مفعّلة لهذه العملية حتى الآن. لم يُرسل أي طلب أو يُعرض نجاح غير مؤكد.");
        }
        if (active) setRecords(result);
      } catch (cause) {
        if (active) setError(apiError(cause));
      } finally { if (active) setLoading(false); }
    }
    void load(); return () => { active = false; };
  }, [screen]);
  async function signOut() { try { await logoutSekkaSession(); } finally { onNavigate("/login"); } }
  async function markRead(id: string) {
    try { await sekkaApi(`/pool/notifications/${id}/read`, { method: "POST" }); setRecords((items) => items.map((item) => String(item.id) === id ? { ...item, read_at: new Date().toISOString() } : item)); }
    catch { setError("تعذر تحديث الإشعار. حاول مرة أخرى."); }
  }
  async function uploadDocument(kind: string, selectedFile: File | null) {
    if (!selectedFile) { setError("اختر ملف الوثيقة أولًا."); return; }
    if (selectedFile.size > 8 * 1024 * 1024) { setError("حجم الملف يتجاوز الحد الأقصى وهو 8 ميجابايت."); return; }
    if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(selectedFile.type)) { setError("ارفع صورة بصيغة JPEG أو PNG أو WebP، أو ملف PDF."); return; }
    setUploading(true); setError(""); setNotice("");
    try {
      const form = new FormData(); form.append("file", selectedFile);
      const result = await sekkaApiForm<{ document: any }>(`/verification/documents/${encodeURIComponent(kind)}`, form);
      if (result?.document) setRecords((items) => [ ...items.filter((item) => item.document_type !== result.document.document_type), { ...result.document, verification_status: result.document.status ?? result.document.verification_status } ]);
      setFile(null); setNotice("تم إرسال الوثيقة للمراجعة بنجاح.");
    } catch (cause) { setError(apiError(cause)); }
    finally { setUploading(false); }
  }
  async function confirmPayment(tripId: string, amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) { setError("أدخل مبلغًا صحيحًا استلمته فعليًا."); return; }
    if (confirmingPayment) return;
    setConfirmingPayment(tripId); setError(""); setNotice("");
    try {
      const { payment } = await sekkaApi<{ payment: any }>(`/captain/trips/${encodeURIComponent(tripId)}/confirm-payment`, { method: "POST", body: { amount } });
      setRecords((items) => items.map((item) => item.id === tripId ? { ...item, payment, status: payment?.status ?? "confirmed", amount: payment?.amount ?? amount } : item));
      setNotice("تم تسجيل تأكيد استلام المبلغ من الخادم."); setError("");
    } catch (cause) { setError(apiError(cause)); }
    finally { setConfirmingPayment(null); }
  }
  async function sendMessage(body: string): Promise<boolean> {
    const conversationId = new URLSearchParams(window.location.search).get("id");
    if (!conversationId || sendingMessage) return false;
    const message = body.trim();
    if (!message || message.length > 2000) { setError("اكتب رسالة من حرف واحد إلى 2000 حرف."); return false; }
    setSendingMessage(true); setError(""); setNotice("");
    try {
      const { message: saved } = await sekkaApi<{ message: any }>(`/messages/conversations/${encodeURIComponent(conversationId)}/messages`, { method: "POST", body: { body: message } });
      setRecords((items) => [...items, saved]); setNotice(""); return true;
    } catch (cause) { setError(apiError(cause)); return false; }
    finally { setSendingMessage(false); }
  }
  async function toggleLineStatus(id: string, currentStatus: string) {
    const nextStatus = currentStatus === "active" ? "paused" : "active";
    try {
      const { line } = await sekkaApi<{ line: any }>(`/captain/lines/${id}/status`, { method: "PATCH", body: { status: nextStatus } });
      setRecords((items) => items.map((item) => String(item.id) === id ? { ...item, ...line, id: String(line.id), status: nextStatus } : item));
    } catch (cause) { setError(apiError(cause)); }
  }
  const title=meta[screen];const action=(text:string)=>setNotice(`${text}: ${writeNotice}`);
  return <main className="rider-journey" dir="rtl" lang="ar"><header className="journey-topbar"><button className="journey-back" onClick={()=>{if(document.referrer.startsWith(window.location.origin))window.history.back();else onNavigate("/captain/home");}} aria-label="رجوع">‹</button><a href="/captain/home" className="journey-brand"><img src="/brand/sekka-mark.png" alt="سِكّة"/></a><button className="journey-avatar" onClick={()=>onNavigate("/captain/journey/profile")} aria-label="الملف الشخصي">{profile?.full_name?.slice(0,1)??"ك"}</button></header><section className="journey-hero"><span className="journey-eyebrow">لوحة الكابتن</span><h1>{title.title}</h1><p>{title.subtitle}</p><div className="journey-hero-icon" aria-hidden="true">{title.icon}</div></section><details className="journey-directory"><summary>خدمات الكابتن <span>استعرض الأقسام</span></summary><nav className="journey-shortcuts" aria-label="أقسام الكابتن">{linkGroups.map(([group,keys])=><section className="journey-link-group" key={group}><h2>{group}</h2><div>{links.filter(([key])=>keys.includes(key)).map(([key,label])=><a key={key} href={key==="home"?"/captain/home":`/captain/journey/${key}`} className={key===screen?"active":""} aria-current={key===screen?"page":undefined}>{label}</a>)}</div></section>)}</nav></details><section className="journey-content">{loading&&<div className="journey-state"><span className="journey-spinner"/> جارٍ تحميل بياناتك…</div>}{error&&!loading&&<div className="journey-alert error" role="alert">{error}<button onClick={()=>{setError("");void window.location.reload();}}>إعادة المحاولة</button></div>}{notice&&<div className="journey-alert">{notice}</div>}{!loading&&<CaptainBody screen={screen} records={records} profile={profile} captain={captain} selectedConversation={selectedConversation} onNavigate={onNavigate} onAction={action} onSignOut={signOut} onMarkRead={markRead} onToggleLine={toggleLineStatus} onUploadDocument={uploadDocument} onConfirmPayment={confirmPayment} onSendMessage={sendMessage} sendingMessage={sendingMessage} confirmingPayment={confirmingPayment} uploading={uploading} file={file} setFile={setFile}/>}</section><nav className="journey-bottom-nav" aria-label="تنقل الكابتن"><a className={screen==="home"?"active":""} aria-current={screen==="home"?"page":undefined} href="/captain/home">⌂<span>الرئيسية</span></a><a className={["offers","new-offer","edit-offer"].includes(screen)?"active":""} aria-current={["offers","new-offer","edit-offer"].includes(screen)?"page":undefined} href="/captain/journey/offers">⇄<span>العروض</span></a><a className={["groups","group","riders","subscriptions"].includes(screen)?"active":""} aria-current={["groups","group","riders","subscriptions"].includes(screen)?"page":undefined} href="/captain/journey/groups">⌘<span>المجموعات</span></a><a className={screen==="notifications"?"active":""} aria-current={screen==="notifications"?"page":undefined} href="/captain/journey/notifications">♧<span>الإشعارات</span></a><a className={!['home','offers','new-offer','edit-offer','groups','group','riders','subscriptions','notifications'].includes(screen)?"active":""} aria-current={!['home','offers','new-offer','edit-offer','groups','group','riders','subscriptions','notifications'].includes(screen)?"page":undefined} href="/captain/journey/profile">⋯<span>المزيد</span></a></nav></main>
}

function apiError(cause: unknown) {
  if (cause && typeof cause === "object" && "status" in cause && (cause as any).status === 401) return "انتهت جلسة الدخول. سجّل الدخول مجددًا.";
  const message = cause instanceof Error ? cause.message : "";
  if (message.includes("الاتصال") || message.includes("الإنترنت")) return "تعذر الاتصال بخدمة سِكّة. تحقق من الإنترنت وحاول مجددًا.";
  return message || "تعذر تحميل بيانات الكابتن الآن. حاول مرة أخرى.";
}

function CaptainBody({screen,records,profile,captain,selectedConversation,onNavigate,onAction,onSignOut,onMarkRead,onToggleLine,onUploadDocument,onConfirmPayment,onSendMessage,sendingMessage,confirmingPayment,uploading,file,setFile}:{screen:CaptainJourneyKey;records:any[];profile:any;captain:any;selectedConversation:any;onNavigate:(path:string)=>void;onAction:(text:string)=>void;onSignOut:()=>void;onMarkRead:(id:string)=>void;onToggleLine:(id:string,status:string)=>void;onUploadDocument:(kind:string,file:File|null)=>void;onConfirmPayment:(tripId:string,amount:number)=>void;onSendMessage:(body:string)=>Promise<boolean>;sendingMessage:boolean;confirmingPayment:string|null;uploading:boolean;file:File|null;setFile:(file:File|null)=>void}){
  const [messageDraft,setMessageDraft]=useState("");
  const [documentKind,setDocumentKind]=useState("national_id_front");
  const lines=records.filter((x)=>x.origin_name);const groups=records.filter((x)=>x.captain_line_id);const requests=records.filter((x)=>x.line_id);const payments=records.filter((x)=>x.payment_method);const action=(label:string)=> <button className="journey-secondary" onClick={()=>onAction(label)}>{label}</button>;
  if(screen==="profile")return <article className="journey-data-card profile-card"><span className="profile-initial">{profile?.full_name?.slice(0,1)??"ك"}</span><h2>{profile?.full_name??"كابتن سِكّة"}</h2><p>{profile?.phone??"بيانات التواصل محفوظة في حسابك"}</p><div className="journey-info-grid"><Info label="الدور" value="كابتن"/><Info label="حالة الاعتماد" value={status(captain?.verification_status)}/></div><button className="journey-secondary" onClick={onSignOut}>تسجيل الخروج</button><div className="profile-links"><a href="/privacy">الخصوصية</a><a href="/terms">الشروط والأحكام</a><a href="/captain/journey/notifications">الإشعارات</a></div></article>;
  if(screen==="new-offer"||screen==="edit-offer"){const id=new URLSearchParams(window.location.search).get("id");const offer=screen==="edit-offer"?lines.find((line)=>String(line.id)===id):undefined;return <CaptainLineForm mode={screen==="new-offer"?"new":"edit"} line={offer} onBack={()=>onNavigate("/captain/journey/offers")} onSaved={()=>onNavigate("/captain/journey/offers")}/>;}
  if(screen==="documents")return <><div className="journey-data-card"><h2>وثائق الحساب</h2>{records.length?records.map((doc)=><Info key={doc.id} label={doc.document_type} value={status(doc.verification_status)}/>):<Empty title="لا توجد وثائق مرفوعة" body="اختر نوع الوثيقة وارفع ملفًا واضحًا لإرساله للمراجعة."/>}<label className="journey-info" htmlFor="captain-document-kind"><span>نوع الوثيقة</span></label><select id="captain-document-kind" className="journey-document-kind" value={documentKind} onChange={(e)=>setDocumentKind(e.target.value)}><option value="national_id_front">الرقم القومي — الوجه الأمامي</option><option value="national_id_back">الرقم القومي — الوجه الخلفي</option><option value="driving_license_front">رخصة القيادة — الوجه الأمامي</option><option value="driving_license_back">رخصة القيادة — الوجه الخلفي</option><option value="vehicle_license_front">رخصة المركبة — الوجه الأمامي</option><option value="vehicle_license_back">رخصة المركبة — الوجه الخلفي</option><option value="criminal_record">صحيفة الحالة الجنائية</option><option value="drug_test">تحليل المخدرات</option></select><label className="journey-upload">{file?file.name:"اختيار ملف وثيقة (JPEG أو PNG أو WebP أو PDF، حتى 8MB)"}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e)=>setFile(e.target.files?.[0]??null)}/></label><button className="journey-primary" disabled={uploading} onClick={()=>onUploadDocument(documentKind,file)}>{uploading?"جارٍ الإرسال…":"إرسال للمراجعة"}</button></div></>;
  if(screen==="approval")return <><DataCard title="حالة مراجعة الحساب" badge={status(captain?.verification_status)}><Info label="آخر تحديث" value={date(captain?.reviewed_at)}/><Info label="ملاحظة المراجعة" value={captain?.review_note??"لا توجد ملاحظات مسجلة"}/></DataCard><p className="journey-note">نشر العروض متاح بعد استيفاء متطلبات الاعتماد.</p></>;
  if(screen==="vehicle")return records.length?<div className="journey-list">{lines.map((line)=><DataCard key={line.id} title={line.vehicle?.name_ar??line.vehicle_type_id} badge={`${line.vehicle?.capacity_max??"—"} مقاعد`}><Info label="رقم العرض" value={line.id.slice(0,8)}/><Info label="السعة المستخدمة" value={`${line.seat_count??line.vehicle?.capacity_max??"—"} مقاعد`}/><Info label="بيانات المركبة" value={JSON.stringify(line.vehicle_details??{})}/></DataCard>)}</div>:<Empty title="لا توجد مركبة مرتبطة بعروضك" body="أضف بيانات المركبة ضمن ملف الكابتن."/>;
  if(screen==="offers"||screen==="home")return <><div className="journey-info-grid"><DataCard title="العروض"><Info label="الإجمالي" value={`${lines.length}`}/><Info label="منشور" value={`${lines.filter((x)=>x.status==="active").length}`}/></DataCard><DataCard title="الإجراءات"><button className="journey-primary" onClick={()=>onNavigate("/captain/journey/new-offer")}>إنشاء عرض جديد</button><Info label="طلبات الركاب" value="عرض الطلبات"/><Info label="طلبات الدفع" value="عرض المدفوعات"/></DataCard></div>{lines.length?<div className="journey-list">{lines.map((line)=><DataCard key={line.id} title={`${line.origin_name} ← ${line.destination_name}`} badge={status(line.status)}><Info label="المركبة" value={line.vehicle?.name_ar??line.vehicle_type_id}/><Info label="المواعيد" value={`${(line.operating_days??[]).join("، ")} • ${line.departure_time?.slice(0,5)}`}/><Info label="السعر الشهري" value={money(line.monthly_price,line.currency)}/><button className="journey-secondary" onClick={()=>onNavigate(`/captain/journey/edit-offer?id=${line.id}`)}>تعديل العرض</button><button className="journey-secondary" onClick={()=>onToggleLine(String(line.id),line.status)}>{line.status==="active"?"إيقاف العرض مؤقتًا":"استئناف العرض"}</button></DataCard>)}</div>:<Empty title="لا توجد عروض محفوظة بعد" body="أنشئ عرض تنقل ليظهر هنا بعد ربط عملية الحفظ."/>}</>;
  if(screen==="rider-requests"||screen==="rider-request")return requests.length?<div className="journey-list">{requests.map((r)=><DataCard key={r.id} title={`طلب انضمام • ${r.id.slice(0,8)}`} badge={status(r.status)}><Info label="العرض" value={r.line_id.slice(0,8)}/><Info label="تاريخ الطلب" value={date(r.created_at)}/><Info label="ملاحظة الراكب" value={r.passenger_note??"لا توجد ملاحظة"}/>{action("قبول أو رفض الطلب")}</DataCard>)}</div>:<Empty title="لا توجد طلبات ركاب" body="ستظهر طلبات الانضمام المرتبطة بخطوطك هنا."/>;
  if(["groups","group","riders","subscriptions","renewal","replacement"].includes(screen))return groups.length?<div className="journey-list">{groups.map((group)=><DataCard key={group.id} title={`${group.line?.origin_name??""} ← ${group.line?.destination_name??""}`} badge={status(group.status)}><Info label="الموعد" value={group.line?.departure_time?.slice(0,5)??"—"}/><Info label="الركاب المرتبطون" value={`${group.members?.length??0}`}/><Info label="حالة الاشتراكات" value={group.members?.map((m:any)=>status(m.subscription?.status??m.status)).join("، ")||"لا توجد اشتراكات"}/>{screen==="replacement"&&action("طلب البحث عن بديل")}{screen==="renewal"&&<p className="journey-note">لا توجد مهلة تجديد مؤكدة مسجلة لهذه المجموعة.</p>}</DataCard>)}</div>:<Empty title="لا توجد مجموعات مرتبطة" body="ستظهر المجموعات بعد اكتمال طلبات الانضمام واعتمادها."/>;
  if(["payments","payment","confirm-receipt","send-code","payment-status"].includes(screen))return payments.length?<div className="journey-list">{payments.map((p)=><DataCard key={p.id} title={`رحلة مكتملة • ${p.id.slice(0,8)}`} badge={status(p.status)}><Info label="المبلغ المستحق" value={money(p.amount,p.currency)}/><Info label="حالة الرحلة" value={status(p.trip?.status)}/><Info label="تاريخ الإكمال" value={date(p.trip?.completed_at)}/>{!p.payment&&<><label className="journey-form-label">المبلغ الذي استلمته فعليًا<input className="journey-document-kind" type="number" min="0.01" step="0.01" defaultValue={p.amount??""} id={`received-amount-${p.id}`}/></label><button className="journey-primary" disabled={confirmingPayment!==null} onClick={()=>{const input=document.getElementById(`received-amount-${p.id}`) as HTMLInputElement|null;onConfirmPayment(p.id,Number(input?.value));}}>{confirmingPayment===p.id?"جارٍ التأكيد…":"تأكيد استلام المبلغ"}</button></>}{p.payment&&<Info label="تأكيد الدفع" value="تم تسجيله من الخادم"/>}</DataCard>)}</div>:<Empty title="لا توجد رحلات مكتملة بانتظار تأكيد الدفع" body="ستظهر هنا الرحلات المكتملة المسجلة على حسابك."/>;
  if(screen==="conversations"&&selectedConversation)return <section className="journey-chat"><header className="journey-data-card journey-chat-header"><button className="journey-secondary" onClick={()=>onNavigate("/captain/journey/conversations")}>رجوع للمحادثات</button><strong>{selectedConversation.other_user?.full_name??"محادثة"}</strong><span>{selectedConversation.other_user?.role==="rider"?"راكب":"كابتن"}</span></header><div className="journey-chat-messages" aria-live="polite">{records.length?records.map((message)=><article key={message.id} className={`journey-chat-message ${Number(message.sender_user_id)===Number(profile?.id)?"mine":"theirs"}`}><p>{message.body}</p><time>{date(message.created_at)}</time></article>):<Empty title="ابدأ المحادثة" body="اكتب رسالتك للتواصل مع الطرف الآخر."/>}</div><form className="journey-chat-compose" onSubmit={(event)=>{event.preventDefault();if(messageDraft.trim())void onSendMessage(messageDraft).then((sent)=>{if(sent)setMessageDraft("");});}}><textarea aria-label="اكتب رسالة" maxLength={2000} value={messageDraft} onChange={(event)=>setMessageDraft(event.target.value)} placeholder="اكتب رسالتك هنا"/><button className="journey-primary" disabled={sendingMessage||!messageDraft.trim()}>{sendingMessage?"جارٍ الإرسال…":"إرسال الرسالة"}</button></form></section>;
  if(screen==="conversations")return records.length?<div className="journey-list">{records.map((c)=><a className="journey-data-card journey-conversation" href={`/captain/journey/conversations?id=${c.id}`} key={c.id}><span className="journey-card-icon">☏</span><div><strong>{c.other_user?.full_name??"محادثة"}</strong><p>{c.last_message_body??"لا توجد رسائل بعد"}</p></div>{Number(c.unread_count)>0&&<span className="journey-badge">{c.unread_count} غير مقروءة</span>}<time>{date(c.last_message_at??c.created_at)}</time></a>)}</div>:<Empty title="لا توجد محادثات" body="ستظهر المحادثات المرتبطة برحلاتك ومجموعاتك هنا."/>;
  if(screen==="notifications")return records.length?<div className="journey-list">{records.map((n)=><article className="journey-data-card journey-notification" key={n.id}><span className="journey-card-icon">♧</span><div><strong>{n.type}</strong><p>{n.payload?.message??"تحديث جديد"}</p><time>{date(n.created_at)}</time></div>{!n.read_at&&<button onClick={()=>onMarkRead(n.id)}>تمت القراءة</button>}</article>)}</div>:<Empty title="لا توجد إشعارات" body="سنُظهر هنا تحديثات الحساب والمجموعات والدفع."/>;
  if(screen==="ratings-reports")return records.length?<div className="journey-list">{records.map((x)=><DataCard key={x.id} title={x.recordType==="rating"?`تقييم ${x.score} من 5`:`بلاغ #${x.id.slice(0,8)}`} badge={status(x.status)}><p>{x.comment??x.description}</p><Info label="التاريخ" value={date(x.created_at)}/></DataCard>)}</div>:<Empty title="لا توجد تقييمات أو بلاغات" body="ستظهر السجلات المتعلقة بحسابك هنا."/>;
  return <Empty title="لا توجد بيانات متاحة" body="لم تُسجل بيانات لهذه الشاشة بعد."/>;
}
function DataCard({title,badge,children}:{title:string;badge?:string;children:React.ReactNode}){return <article className="journey-data-card"><header className="journey-card-heading"><h2>{title}</h2>{badge&&<span className="journey-badge">{badge}</span>}</header>{children}</article>}
function Info({label,value}:{label:string;value:string}){return <div className="journey-info"><span>{label}</span><strong>{value}</strong></div>}
function Empty({title,body}:{title:string;body:string}){return <div className="journey-empty"><span>⌂</span><h2>{title}</h2><p>{body}</p></div>}
function status(s?:string){const map:Record<string,string>={approved:"معتمد",pending:"قيد المراجعة",rejected:"مرفوض",active:"نشط",paused:"متوقف مؤقتًا",published:"منشور",draft:"مسودة",forming:"قيد التجميع",confirmed:"مؤكد",awaiting_captain_confirmation:"بانتظار تأكيد الكابتن",initiated:"بدأت العملية",received:"تم الاستلام",open:"مفتوح",closed:"مغلق",cancelled:"ملغي",searching:"جارٍ البحث",completed:"مكتملة"};return s?map[s]??s:"غير متاح"}
function money(amount?:number|null,currency?:string){return amount==null?"غير محدد":`${new Intl.NumberFormat("ar-EG").format(amount)} ${currency==="EGP"||!currency?"ج.م":currency}`}
function date(value?:string){return value?new Intl.DateTimeFormat("ar-EG",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value)):"—"}
