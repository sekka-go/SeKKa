import type { User } from "./api";

export type Session = { token: string; user: User };
export type Toast = { tone: "success" | "error" | "info"; text: string };
export type NavKey = "home" | "booking" | "trips" | "requests" | "notifications" | "messages" | "account" | "settings" | "offers" | "publish" | "captainTrips" | "admin" | "adminUsers" | "adminDocuments" | "adminTrips" | "adminComplaints" | "adminFinance" | "adminFinanceAdjustment" | "adminPricing" | "adminAudit" | "broadcast";
export type RiderWorkspaceTrip = {
  id: number;
  groupId: number;
  categoryId: string;
  service_date: string;
  direction: "outbound" | "return";
  departure_at: string;
  status: string;
  fare: number | null;
};
