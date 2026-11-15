export type MobileTab =
  | "home"
  | "search"
  | "booking"
  | "captain-onboarding"
  | "routes"
  | "bookings"
  | "notifications"
  | "admin"
  | "login"
  | "profile";

type SimpleTab = "home" | "booking" | "bookings" | "notifications" | "profile";
type OnboardingView = 2 | 3 | 4 | 6;
type DiscoveryView = 9 | 10 | 11 | 12;
type CaptainOnboardingView = 35 | 36 | 37 | 38 | 39 | 40 | 41;
type CaptainRoutesView = 42 | 43 | 44 | 45 | 46 | 47 | 48 | 49;
type AdminView = 62 | 63 | 64 | 65 | 66 | 67 | 68 | 69 | 70 | 71 | 72 | 73;

export type MobileRoute =
  | { tab: SimpleTab }
  | { tab: "login"; view: OnboardingView }
  | { tab: "search"; view: DiscoveryView }
  | { tab: "captain-onboarding"; view: CaptainOnboardingView }
  | { tab: "routes"; view: CaptainRoutesView }
  | { tab: "admin"; view: AdminView };

export type RouteSelection = {
  routeId: string;
  pickupId: string;
  dropoffId: string;
  reverse: boolean;
};

function inRange(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

export function readMobileRoute(href: string | URL = window.location.href): MobileRoute {
  const url = new URL(href);
  const tab = url.searchParams.get("tab");
  const view = Number(url.searchParams.get("view"));

  switch (tab) {
    case "login":
      return {
        tab,
        view: ([2, 3, 4, 6] as number[]).includes(view)
          ? (view as OnboardingView)
          : 2,
      };
    case "search":
      return {
        tab,
        view: inRange(view, 9, 12) ? (view as DiscoveryView) : 9,
      };
    case "captain-onboarding":
      return {
        tab,
        view: inRange(view, 35, 41) ? (view as CaptainOnboardingView) : 35,
      };
    case "routes":
      return {
        tab,
        view: inRange(view, 42, 49) ? (view as CaptainRoutesView) : 42,
      };
    case "admin":
      return {
        tab,
        view: inRange(view, 62, 73) ? (view as AdminView) : 62,
      };
    case "booking":
    case "bookings":
    case "notifications":
    case "profile":
    case "home":
    default:
      return { tab: tab === "booking" || tab === "bookings" ||
        tab === "notifications" || tab === "profile" ? tab : "home" };
  }
}

export function mobileRouteHref(
  route: MobileRoute,
  currentHref: string | URL = window.location.href,
  selection?: RouteSelection,
): string {
  const url = new URL(currentHref);
  url.searchParams.delete("screen");
  url.searchParams.delete("preview");
  url.searchParams.delete("inspect");

  if (route.tab === "home") url.searchParams.delete("tab");
  else url.searchParams.set("tab", route.tab);

  if ("view" in route) url.searchParams.set("view", String(route.view));
  else url.searchParams.delete("view");

  const keepsSelection =
    route.tab === "booking" || (route.tab === "search" && route.view === 12);
  if (!keepsSelection) {
    url.searchParams.delete("route");
    url.searchParams.delete("pickup");
    url.searchParams.delete("dropoff");
    url.searchParams.delete("reverse");
    url.searchParams.delete("booking");
  }

  if (selection) {
    url.searchParams.set("route", selection.routeId);
    url.searchParams.set("pickup", selection.pickupId);
    url.searchParams.set("dropoff", selection.dropoffId);
    url.searchParams.set("reverse", selection.reverse ? "1" : "0");
    url.searchParams.delete("booking");
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
