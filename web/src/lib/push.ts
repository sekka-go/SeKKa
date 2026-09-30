import { api } from "../api";

function decodeApplicationServerKey(value: string): ArrayBuffer {
  const padded = `${value}${"=".repeat((4 - value.length % 4) % 4)}`;
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

function sameApplicationServerKey(subscription: PushSubscription, expected: ArrayBuffer) {
  const current = subscription.options.applicationServerKey;
  if (!current) return false;
  const currentBytes = new Uint8Array(current);
  const expectedBytes = new Uint8Array(expected);
  return currentBytes.length === expectedBytes.length && currentBytes.every((byte, index) => byte === expectedBytes[index]);
}

export async function subscribeToPush(token: string) {
  if (!import.meta.env.PROD) throw new Error("إشعارات الجهاز تتاح بعد نشر التطبيق عبر HTTPS.");
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    throw new Error("المتصفح الحالي لا يدعم إشعارات الجهاز.");
  }

  let permission = Notification.permission;
  if (permission === "default") permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("اسمح بالإشعارات من إعدادات المتصفح لتفعيلها.");

  const { public_key: publicKey } = await api<{ public_key: string }>("/pool/push/vapid-public-key");
  const registration = await navigator.serviceWorker.ready;
  const applicationServerKey = decodeApplicationServerKey(publicKey);
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && !sameApplicationServerKey(subscription, applicationServerKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  }

  await api("/pool/push/subscriptions", {
    method: "PUT",
    token,
    body: subscription.toJSON(),
  });
}

export async function hasPushSubscription() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return false;
  const registration = await navigator.serviceWorker.ready;
  return Boolean(await registration.pushManager.getSubscription());
}

export async function unsubscribeFromPush(token: string) {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  await api("/pool/push/subscriptions", {
    method: "DELETE",
    token,
    body: { endpoint: subscription.endpoint },
  });
  await subscription.unsubscribe();
}
