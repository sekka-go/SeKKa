import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import "./captain-home-screen.css";

type CaptainLine = { id: string; origin_name: string; destination_name: string; operating_days: number[]; departure_time: string; monthly_price: number | null; currency: string; status: string; vehicle: { name_ar: string } | null };
const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export default function CaptainHomeScreen({ supabase }: { supabase: SupabaseClient | null }) {
  const [name, setName] = useState("كابتن");
  const [lines, setLines] = useState<CaptainLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase) { if (active) { setError(true); setLoading(false); } return; }
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!auth.user) { window.location.replace("/login"); return; }
        const [{ data: profile }, { data, error: linesError }] = await Promise.all([
          supabase.from("profiles").select("full_name,role").eq("id", auth.user.id).maybeSingle(),
          supabase.from("captain_lines").select("id,origin_name,destination_name,operating_days,departure_time,monthly_price,currency,status,vehicle:vehicle_types(name_ar)").eq("captain_id", auth.user.id).order("updated_at", { ascending: false }),
        ]);
        if (linesError) throw linesError;
        if (profile?.role !== "captain") { window.location.replace(profile?.role === "rider" ? "/home" : "/login"); return; }
        if (active) { setName(profile.full_name || "كابتن"); setLines((data ?? []) as unknown as CaptainLine[]); }
      } catch { if (active) setError(true); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [supabase]);

  const published = lines.filter((line) => line.status === "published").length;
  return <main className="captain-home" dir="rtl" lang="ar">
    <header className="captain-home-header"><div><span>لوحة الكابتن</span><h1>مرحبًا {name}</h1><p>تابع خطوط رحلاتك وحالة نشرها.</p></div><img src="/brand/sekka-mark.png" alt="سِكّة"/></header>
    <section className="captain-home-summary"><article><strong>{lines.length}</strong><span>إجمالي الخطوط</span></article><article><strong>{published}</strong><span>خطوط منشورة</span></article></section>
    <section className="captain-home-lines"><div className="captain-home-heading"><h2>خطوطي</h2><span>من بيانات حسابك</span></div>
      {loading ? <div className="captain-home-state">جارٍ تحميل خطوطك…</div> : error ? <div className="captain-home-state" role="alert">تعذر تحميل البيانات الآن. تحقق من الاتصال وحاول مجددًا.</div> : lines.length ? lines.map((line) => <article className="captain-line-card" key={line.id}><div className="captain-line-route"><strong>{line.origin_name}</strong><i/><strong>{line.destination_name}</strong></div><div className="captain-line-meta"><span>{line.vehicle?.name_ar ?? "مركبة غير محددة"}</span><span>{line.operating_days.map((day) => dayNames[day]).filter(Boolean).join("، ")}</span><span>{line.departure_time.slice(0, 5)}</span>{line.monthly_price !== null && <span>{new Intl.NumberFormat("ar-EG").format(line.monthly_price)} {line.currency.trim() === "EGP" ? "ج.م" : line.currency}</span>}</div><span className={`captain-line-status ${line.status === "published" ? "is-published" : ""}`}>{line.status === "published" ? "منشور" : line.status === "draft" ? "مسودة" : line.status}</span></article>) : <div className="captain-home-state"><strong>لا توجد خطوط محفوظة بعد</strong><p>ستظهر هنا الخطوط التي تنشئها وتنشرها.</p></div>}
    </section>
    <nav className="captain-home-nav"><a className="active" href="/captain/home">الرئيسية</a><a href="/trips">استكشاف الخطوط المنشورة</a></nav>
  </main>;
}
