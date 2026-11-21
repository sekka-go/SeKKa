import { useEffect, useState, type ReactNode } from "react";
import "./launch-splash.css";

const STATIC_SPLASH_DURATION_MS = 1600;

/* Show on an app open or reload, but not OAuth callbacks or browser back/forward.
 * Neither the user's route nor their Google session should be changed. */
export function shouldPlayLaunchSplash() {
  const current = new URL(window.location.href);
  if ((current.pathname === "/dev/screens" || current.pathname === "/dev/screens/") ||
      current.searchParams.has("code") ||
      current.searchParams.has("error") ||
      current.hash.includes("access_token=")) return false;

  const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (navigation) return navigation.type === "navigate" || navigation.type === "reload";

  const legacy = (performance as Performance & { navigation?: { type: number } }).navigation;
  return legacy?.type !== 2;
}

/** One static owner-provided brand image, then the existing real application.
 * No street animation, Arabic wordmark, delayed logo reveal or intermediate page.
 */
export default function LaunchSplash({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(shouldPlayLaunchSplash);

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => setVisible(false), STATIC_SPLASH_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [visible]);

  return (
    <>
      {children}
      {visible && (
        <div className="sekka-launch" role="status" aria-label="جاري فتح سِكّة">
          <img className="sekka-launch__artwork"
            src="/brand/sekka-go-512.png"
            alt="سِكّة"
            draggable={false}
            fetchPriority="high" />
        </div>
      )}
    </>
  );
}
