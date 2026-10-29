import { useEffect, useState } from "react";
import { api, type VehicleType } from "../api";
import { errorText } from "./formatters";

export function useVehicleTypes(token: string) {
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void api<{ vehicle_types: VehicleType[] }>("/config", { token, signal: controller.signal })
      .then((config) => setVehicleTypes((config.vehicle_types ?? []).filter((vehicle) =>
        ["prime", "daily", "space", "max"].includes(vehicle.id)
        && Number.isInteger(vehicle.capacity_max)
        && vehicle.capacity_max > 0,
      )))
      .catch((cause) => { if (!controller.signal.aborted) { setVehicleTypes([]); setError(errorText(cause)); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, attempt]);

  return { vehicleTypes, loading, error, retry: () => setAttempt((current) => current + 1) };
}
