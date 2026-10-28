export type DeviceLocation = {
  lat: number;
  lng: number;
  accuracy: number;
  updatedAt: number;
};

let latestLocation: DeviceLocation | null = null;
const subscribers = new Set<(location: DeviceLocation | null) => void>();

function publish(location: DeviceLocation | null) {
  latestLocation = location;
  subscribers.forEach((subscriber) => subscriber(location));
}

export function rememberDeviceLocation(position: GeolocationPosition) {
  publish({
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy,
    updatedAt: Date.now(),
  });
}

export function getRecentDeviceLocation(maxAgeMs = 30_000) {
  if (!latestLocation || Date.now() - latestLocation.updatedAt > maxAgeMs) return null;
  return latestLocation;
}

export function subscribeToDeviceLocation(subscriber: (location: DeviceLocation | null) => void) {
  subscribers.add(subscriber);
  if (latestLocation) subscriber(latestLocation);
  return () => { subscribers.delete(subscriber); };
}

export function startPermissionAwareDeviceLocation() {
  if (!navigator.geolocation || !navigator.permissions) return () => undefined;

  let active = true;
  let watchId: number | null = null;
  let permission: PermissionStatus | null = null;

  const stopWatching = () => {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    watchId = null;
  };
  const updatePermission = () => {
    if (!active) return;
    if (permission?.state === "granted") {
      if (document.visibilityState === "hidden") { stopWatching(); return; }
      if (watchId !== null) return;
      watchId = navigator.geolocation.watchPosition(rememberDeviceLocation, () => undefined, {
        enableHighAccuracy: false,
        maximumAge: 30_000,
        timeout: 15_000,
      });
    } else {
      stopWatching();
      publish(null);
    }
  };

  void navigator.permissions.query({ name: "geolocation" }).then((status) => {
    if (!active) return;
    permission = status;
    permission.addEventListener("change", updatePermission);
    document.addEventListener("visibilitychange", updatePermission);
    updatePermission();
  }).catch(() => undefined);

  return () => {
    active = false;
    stopWatching();
    permission?.removeEventListener("change", updatePermission);
    document.removeEventListener("visibilitychange", updatePermission);
    publish(null);
  };
}
