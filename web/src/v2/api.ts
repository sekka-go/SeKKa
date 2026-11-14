import type { SupabaseClient } from "@supabase/supabase-js";
// PRD v3.1 frontend-only build. Historical integration is deliberately disconnected.
function frontendClient(): SupabaseClient | null { return null; }
export const client = frontendClient();
export async function api<T = unknown>(
  operation: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  if (!client) throw new Error("V2_BACKEND_NOT_CONFIGURED");
  const { data, error } = await client.rpc("sekka_v2_api", {
    operation,
    payload,
  });
  if (error) throw new Error(error.message);
  return data as T;
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
