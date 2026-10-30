import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sekkaApi, type SekkaUser } from "../lib/sekka-api";
import "./rider-home-screen.css";

export type HomeAction =
  | "explore"
  | "myTrips"
  | "conversations"
  | "mySubscriptions"
  | "myRequests"
  | "newTrip"
  | "support"
  | "profile"
  | "notifications"
  | "home"
  | "allTrips"
  | "featuredTrips"
  | "recentTrip";

type Props = {
  supabase: SupabaseClient | null;
  user: SekkaUser | null;
  onLogout: () => Promise<void>;
  onAction?: (action: HomeAction) => void;
};

type RecentRide = {
  id: string;
  joined_at: string;
  group: {
    status: string;
    starts_on: string | null;
    line: { origin_name: string; destination_name: string; departure_time: string | null; operating_days: number[] } | null;
  } | null;
};

function Icon({ name }: { name: string }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (name) {
    case "bell":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
      );

    case "search":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <circle cx="10.8" cy="10.8" r="7.2" />
          <path d="m16.2 16.2 5 5" />
        </svg>
      );

    case "pin":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );

    case "route":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M5 19c-2 0-3-1.3-3-3s1-3 3-3 3 1.3 3 3-1 3-3 3Zm14-8c-2 0-3-1.3-3-3s1-3 3-3 3 1.3 3 3-1 3-3 3Z" />
          <path d="M8 16c5 0 2-8 8-8" />
        </svg>
      );

    case "list":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M9 3V1h6v2M9 8h6M9 12h6M9 16h6" />
        </svg>
      );

    case "headset":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M3 13v-2a9 9 0 0 1 18 0v2" />
          <rect x="2" y="12" width="4" height="7" rx="2" />
          <rect x="18" y="12" width="4" height="7" rx="2" />
          <path d="M18 19c-1 2-3 3-6 3" />
        </svg>
      );

    case "users":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <circle cx="9" cy="8" r="3" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M3 20c0-3.5 2.5-6 6-6s6 2.5 6 6M16 15c3 0 5 1.8 5 5" />
        </svg>
      );

    case "clock":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );

    case "calendar":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M7 3v4M17 3v4M3 10h18" />
        </svg>
      );

    case "car":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="m5 11 2-5h10l2 5 2 2v6h-2v-2H5v2H3v-6l2-2Z" />
          <path d="M5 11h14M6.5 14h.1M17.5 14h.1" />
        </svg>
      );

    case "home":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-7h6v7" />
        </svg>
      );

    case "user":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <circle cx="12" cy="7" r="4" />
          <path d="M4 21c0-5 3-8 8-8s8 3 8 8" />
        </svg>
      );

    case "chat":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M4 5h16v12H9l-5 4V5Z" />
          <path d="M8 11h.1M12 11h.1M16 11h.1" />
        </svg>
      );

    case "bag":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <rect x="3" y="7" width="18" height="14" rx="2" />
          <path d="M8 7V5a4 4 0 0 1 8 0v2M8 12h8" />
        </svg>
      );

    default:
      return null;
  }
}

export default function RiderHomeScreen({ user, onAction }: Props) {
  const [userName, setUserName] = useState("ضيف");
  const [recentRide, setRecentRide] = useState<RecentRide | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadHome() {
      try {
        const { requests } = await sekkaApi<{ requests: Array<Record<string, any>> }>("/rider/demand-requests");
        if (!active) return;
        setUserName(user?.full_name || "ضيف");
        const latest = requests[0];
        setRecentRide(latest ? { id: String(latest.id), joined_at: latest.created_at, group: { status: latest.demand_groups?.status ?? latest.status, starts_on: latest.trip_date, line: latest.line ? { origin_name: latest.line.origin_label, destination_name: latest.line.destination_label, departure_time: latest.line.arrival_time, operating_days: [] } : null } } : null);
      } catch {
        if (active) setLoadError(true);
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadHome();
    return () => { active = false; };
  }, [user, refreshKey]);

  const retry = () => {
    setLoading(true);
    setLoadError(false);
    setRefreshKey((value) => value + 1);
  };

  const go = (action: HomeAction) => onAction?.(action);

  return (
    <main className="sekka-home" dir="rtl">

      {/* HEADER */}

      <header className="home-header">

        <button
          className="avatar"
          onClick={() => go("profile")}
          aria-label="حسابي"
        >
          <Icon name="user" />
        </button>

        <div className="welcome">
          <strong>مرحباً {userName}</strong>
          <span>رحلات جديدة .. تجارب أجمل</span>
        </div>

        <div className="brand-logo">
          <img
            src="/brand/sekka-mark.png"
            alt="SeKKa"
          />
        </div>

        <button
          className="notification"
          onClick={() => go("notifications")}
          aria-label="الإشعارات"
        >
          <Icon name="bell" />
          <i />
        </button>

      </header>

      {/* HERO */}

      <section className="home-hero">

        <div className="hero-copy">
          <h1>اكتشف رحلتك القادمة</h1>
          <p>قارن عروض الرحلات وتواصل مباشرة مع الكابتن. ظهور العرض لا يضمن تنفيذه.</p>
        </div>

        <button
          className="search-bar"
          onClick={() => go("explore")}
        >
          <span>ابحث عن وجهتك أو رحلة</span>
          <Icon name="search" />
        </button>

      </section>

      {/* QUICK ACTIONS */}

      <nav className="quick-actions" aria-label="اختصارات سريعة">
        <button onClick={() => go("myRequests")}><Icon name="list" /><span>طلباتي</span></button>
        <button onClick={() => go("mySubscriptions")}><Icon name="bag" /><span>اشتراكاتي</span></button>
        <button onClick={() => go("support")}><Icon name="headset" /><span>الدعم</span></button>
      </nav>

      {/* FEATURED */}

      <section className="featured-card">

        <div className="featured-copy">

          <span className="featured-tag">
            رحلات مميزة
          </span>

          <h2>اكتشف أجمل الوجهات</h2>

          <p>
            قارن المسار والمواعيد والسعر المعلن قبل التواصل
          </p>

          <button onClick={() => go("featuredTrips")}>
            تصفح الرحلات
            <b>←</b>
          </button>

        </div>

      </section>

      {/* RECENT TRIPS */}

      <section className="recent-section">

        <div className="section-heading">

          <h2>
            <Icon name="clock" />
            رحلاتك الأخيرة
          </h2>

          <button onClick={() => go("allTrips")}>
            عرض الكل ←
          </button>

        </div>

        {loading ? <div className="recent-empty" role="status">جارٍ تحميل رحلاتك…</div> : loadError ? (
          <div className="recent-empty" role="status">
            <p>تعذر تحميل رحلاتك الآن.</p>
            <button onClick={retry}>إعادة المحاولة</button>
          </div>
        ) : recentRide?.group?.line ? (
        <article className="recent-card">

          <div className="route-points">

            <div>
              <Icon name="pin" />
              <span>
                <strong>{recentRide.group.line.origin_name}</strong>
              </span>
            </div>

            <div className="route-dash" />

            <div>
              <Icon name="pin" />
              <span>
                <strong>{recentRide.group.line.destination_name}</strong>
              </span>
            </div>

          </div>

          <div className="trip-meta">

            <span>
              <Icon name="calendar" />
              {recentRide.group.starts_on ? "موعد الرحلة " : "انضممت في "}
              {new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" }).format(new Date(recentRide.group.starts_on || recentRide.joined_at))}
            </span>

            <span>
              <Icon name="clock" />
              {recentRide.group.line.departure_time?.slice(0, 5) || "—"}
            </span>

          </div>

          <div className="trip-actions">

            <span className="trip-type">
              <Icon name="car" />
              رحلة مجدولة
            </span>

            <button onClick={() => go("recentTrip")}>
              التفاصيل ←
            </button>

          </div>

        </article>
        ) : (
          <div className="recent-empty">
            <p>{loadError ? "تعذر تحميل رحلاتك الآن." : "لا توجد رحلات مسجلة بعد."}</p>
            {loadError ? <button onClick={retry}>إعادة المحاولة</button> : <button onClick={() => go("explore")}>استكشف الرحلات</button>}
          </div>
        )}

      </section>

      {/* BOTTOM NAVIGATION */}

      <nav className="bottom-nav" aria-label="التنقل الرئيسي">
        <button className="selected" aria-current="page" onClick={() => go("home")}><Icon name="home" /><span>الرئيسية</span></button>
        <button onClick={() => go("explore")}><Icon name="search" /><span>البحث</span></button>
        <button onClick={() => go("myRequests")}><Icon name="bag" /><span>طلباتي</span></button>
        <button onClick={() => go("conversations")}><Icon name="chat" /><span>المحادثات</span></button>
        <button onClick={() => go("profile")}><Icon name="user" /><span>المزيد</span></button>
      </nav>

    </main>
  );
}

