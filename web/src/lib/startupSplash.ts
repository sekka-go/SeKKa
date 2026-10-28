const listeners = new Set<() => void>();
let active = true;

export function isStartupSplashActive() {
  return active;
}

export function subscribeToStartupSplash(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function finishStartupSplash() {
  if (!active) return;
  active = false;
  listeners.forEach((listener) => listener());
}
