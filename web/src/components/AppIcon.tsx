import type { ReactNode } from "react";

export type AppIconName =
  | "home" | "route" | "trips" | "bell" | "settings" | "menu" | "close"
  | "user" | "map" | "refresh" | "arrow" | "support" | "logout" | "calendar"
  | "users" | "plus" | "search" | "shield" | "chart" | "send" | "chevron"
  | "check" | "car" | "pin" | "clock" | "inbox" | "filter" | "wallet";

const icons: Record<AppIconName, ReactNode> = {
  home: <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-6h6v6"/></>,
  route: <><circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8 18h3a3 3 0 0 0 3-3v-3a3 3 0 0 1 3-3h1"/></>,
  trips: <><path d="M4 19h16M5 16l2-8h10l2 8M8 8l1-3h6l1 3"/><circle cx="8" cy="17" r="1"/><circle cx="16" cy="17" r="1"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.1.9-1.5 2.6-1.4-.5a7.7 7.7 0 0 1-1.7 1l-.3 1.5h-3l-.3-1.5a7.7 7.7 0 0 1-1.7-1l-1.4.5-1.5-2.6 1.1-.9a7 7 0 0 1 0-2l-1.1-.9 1.5-2.6 1.4.5a7.7 7.7 0 0 1 1.7-1l.3-1.5h3l.3 1.5a7.7 7.7 0 0 1 1.7 1l1.4-.5 1.5 2.6-1.1.9a7 7 0 0 1 0 2Z"/></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
  close: <><path d="m18 6-12 12M6 6l12 12"/></>,
  user: <><circle cx="12" cy="8" r="3.5"/><path d="M5 21c.5-4 2.8-6 7-6s6.5 2 7 6"/></>,
  map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15m6-12v15"/></>,
  refresh: <><path d="M20 7v5h-5M4.8 9A8 8 0 0 1 18 6l2 6M4 17v-5h5m10.2 3A8 8 0 0 1 6 18l-2-6"/></>,
  arrow: <><path d="M19 12H5m7 7-7-7 7-7"/></>,
  support: <><path d="M4 13v-2a8 8 0 0 1 16 0v2"/><path d="M4 13h3v6H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 1-2Zm16 0h-3v6h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-1-2Zm0 6c-1 2-3 3-6 3"/></>,
  logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
  users: <><circle cx="9" cy="8" r="3"/><path d="M3 20c.3-3.5 2.3-5 6-5s5.7 1.5 6 5M16 5a3 3 0 0 1 0 6m2 3c2 .7 3 2.2 3 5"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></>,
  shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>,
  chart: <><path d="M4 20V10m5 10V4m5 16v-7m5 7V7"/></>,
  send: <><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></>,
  chevron: <path d="m9 18 6-6-6-6"/>,
  check: <path d="m5 12 4 4L19 6"/>,
  car: <><path d="m5 11 2-5h10l2 5M3 11h18v8H3z"/><path d="M6 19v2m12-2v2"/><circle cx="7" cy="15" r="1"/><circle cx="17" cy="15" r="1"/></>,
  pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  inbox: <><path d="M4 4h16v16H4zM4 13h4l2 3h4l2-3h4"/></>,
  filter: <><path d="M4 6h16M7 12h10m-7 6h4"/><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="12" cy="18" r="1.5"/></>,
  wallet: <><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18m-5 5h2"/></>,
};

export default function AppIcon({ name, size = 20, strokeWidth = 1.8, className }: {
  name: AppIconName; size?: number; strokeWidth?: number; className?: string;
}) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{icons[name]}</svg>;
}
