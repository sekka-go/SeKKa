import { createClient, type SupabaseClient } from "@supabase/supabase-js";
// Google Auth can be enabled without connecting the old domain RPCs.
function frontendClient(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
}
export const client = frontendClient();
export async function api<T = unknown>(
  operation: string,
  ...args: [Record<string, unknown>?]
): Promise<T> {
  void operation;
  void args;
  // Do not let v3.1 screens mutate legacy v2 database tables or RPCs.
  throw new Error("V31_DOMAIN_BACKEND_NOT_READY");
}
export type Profile = {
  id: string;
  full_name: string;
  role: "rider" | "captain";
  permissions: string[];
  balance: { available: number; reserved: number };
};
export type Route = {
  id: string;
  origin: string;
  destination: string;
  category: string;
  seats: number;
  outbound: string;
  return_time: string | null;
  captain_id?: string;
  captain_name?: string;
  vehicle_model?: string;
  model?: string;
  plate?: string;
  prices: { period: string; direction: string; amount: number }[];
};
export type Quote = {
  start: string;
  cycleStart: string;
  endExclusive: string;
  totalDays: number;
  remainingDays: number;
  fullPrice: number;
  price: number;
  securityEgp: number;
};
export type Booking = {
  id: string;
  origin: string;
  destination: string;
  price: number;
  starts_on: string;
  ends_before: string;
  status: string;
  rider_paid_at: string | null;
  captain_received_at: string | null;
};
