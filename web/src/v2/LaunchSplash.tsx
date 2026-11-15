import { useEffect, useState, type ReactNode } from "react";
import "./launch-splash.css";

const SPLASH_DURATION_MS = 3000;

/**
 * Launch artwork is deliberately separate from auth and route state:
 * it must never reset a session, navigate, or hide the application's contents.
 * The browser's own address/status bars cannot be covered by a web page;
 * the scene fills the entire available PWA viewport.
 */
export default function LaunchSplash({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(() => {
    const current = new URL(window.location.href);
    return !current.pathname.startsWith("/dev/screens") &&
      !current.searchParams.has("code") &&
      !current.hash.includes("access_token=");
  });

  useEffect(() => {
    if (!visible) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setVisible(false), reduced ? 250 : SPLASH_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [visible]);

  return (
    <>
      {children}
      {visible && (
        <div className="sekka-launch" role="status" aria-label="سِكّة — جاري فتح التطبيق">
          <svg
            className="sekka-launch__map"
            viewBox="0 0 390 844"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="sekka-splash-gold" x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#ffc721" />
                <stop offset=".54" stopColor="#b47c08" />
                <stop offset="1" stopColor="#382406" />
              </linearGradient>
              <linearGradient id="sekka-splash-edge" x1="0" y1="1" x2="1" y2="0">
                <stop stopColor="#322205" />
                <stop offset=".62" stopColor="#a97509" />
                <stop offset="1" stopColor="#ffca18" />
              </linearGradient>
              <filter id="sekka-splash-glow" x="-180%" y="-180%" width="460%" height="460%">
                <feGaussianBlur stdDeviation="4" />
              </filter>
            </defs>
            <rect width="390" height="844" fill="#09090b" />
            <g className="sekka-launch__streets" fill="none" stroke="#4f4534" strokeWidth="2.6" opacity=".17">
              <path d="M-22 93L80 103 171 35 262 8M8 197L98 141 220 120 337 152 423 206M-10 307L75 251 163 268 279 224 401 242M28 0L70 90 95 145 74 250 132 313M169-20L181 69 219 126 164 262 197 355M278-12L274 95 337 153 280 232 312 337M-22 470L90 435 188 457 282 412 424 448M75 252L54 375 90 435 118 556M164 262L217 360 190 454 225 546M282 412L344 518 310 615 410 688M-40 602L86 578 186 628 291 615 430 664M6 783L72 702 187 630 224 545" />
              <path d="M-20 346Q135 330 208 372T412 356M-10 540Q115 508 195 545T403 532M0 714Q130 676 223 701T413 745" />
            </g>
            <path fill="url(#sekka-splash-gold)" d="M0 0H185C140 35 125 83 64 104L0 137Z" />
            <path fill="#fbc41c" opacity=".42" d="M0 111Q62 91 95 67L0 148Z" />
            <path fill="url(#sekka-splash-edge)" d="M390 632V844H0Q104 805 169 775T292 680Q343 649 390 632Z" />
            <path fill="#ffd018" opacity=".75" d="M0 828Q110 796 186 757T390 610V617Q275 722 199 762T0 836Z" />

            <g className="sekka-launch__route">
              <path className="sekka-launch__route-halo"
                d="M34 768 C43 681 75 644 107 626 C149 589 202 570 222 532 C265 479 275 453 281 410 C297 349 289 295 298 247 C305 213 314 195 321 180"
                fill="none" stroke="#d3970e" strokeWidth="7" strokeLinecap="round" />
              <path className="sekka-launch__route-line"
                d="M34 768 C43 681 75 644 107 626 C149 589 202 570 222 532 C265 479 275 453 281 410 C297 349 289 295 298 247 C305 213 314 195 321 180"
                fill="none" stroke="#ffcb1b" strokeWidth="2.7" strokeLinecap="round" />
              {([[34, 768], [107, 626], [222, 532], [281, 410], [298, 295], [321, 180]] as const).map(([x, y], index) => (
                <g key={index} className={`sekka-launch__point sekka-launch__point--${index + 1}`}>
                  <circle cx={x} cy={y} r="12" fill="#ffbb00" opacity=".4" filter="url(#sekka-splash-glow)" />
                  <circle cx={x} cy={y} r="4.8" fill="#ffe279" />
                </g>
              ))}
              <g className="sekka-launch__destination" transform="translate(321 157)">
                <path fill="#ffcb17" d="M0-14C-9-14-15-7-15 1c0 11 15 27 15 27S15 12 15 1C15-7 9-14 0-14Z" />
                <circle cy="1" r="5" fill="#14110a" />
              </g>
            </g>
          </svg>

          <img className="sekka-launch__wordmark"
            src="/brand/sekka-splash-wordmark.svg" alt="سِكّة" draggable={false} />

          <div className="sekka-launch__progress" aria-hidden="true">
            <span className="sekka-launch__progress-fill" />
          </div>
        </div>
      )}
    </>
  );
}
