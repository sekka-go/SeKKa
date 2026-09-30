import webpush from "web-push";
import type { DatabaseSync } from "node:sqlite";

type StoredSubscription = {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type VapidConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

function readVapidConfig(): VapidConfig | null {
  const publicKey = process.env.SEKKA_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.SEKKA_VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.SEKKA_VAPID_SUBJECT?.trim();
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null;
}

export function getWebPushPublicKey(): string | null {
  return readVapidConfig()?.publicKey ?? null;
}

function messageForEvent(eventKey: string) {
  if (eventKey.includes("price")) return { title: "مراجعة سعر المشوار", body: "في سعر جديد محتاج موافقتك." };
  if (eventKey.includes("captain")) return { title: "تحديث الكابتن", body: "في تحديث جديد على رحلة من رحلاتك." };
  if (eventKey.includes("wait")) return { title: "المجموعة في انتظار ركاب", body: "افتح سِكّة لمراجعة الخيارات المتاحة." };
  if (eventKey.includes("invite")) return { title: "دعوة لمجموعة مشوار", body: "افتح سِكّة لمراجعة الدعوة." };
  return { title: "تحديث جديد على سِكّة", body: "افتح التطبيق لمراجعة آخر تحديث." };
}

export function sendWebPushToUser(db: DatabaseSync, userId: number, eventKey: string) {
  const vapid = readVapidConfig();
  if (!vapid) return;

  try {
    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  } catch {
    return;
  }

  const subscriptions = db.prepare("SELECT id,endpoint,p256dh,auth FROM push_subscriptions WHERE user_id=?")
    .all(userId) as unknown as StoredSubscription[];
  if (!subscriptions.length) return;
  const message = messageForEvent(eventKey);
  const payload = JSON.stringify({ ...message, url: "/" });

  for (const subscription of subscriptions) {
    void webpush.sendNotification({
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    }, payload, { TTL: 3600 }).catch((error: unknown) => {
      const statusCode = typeof error === "object" && error !== null && "statusCode" in error
        ? Number((error as { statusCode?: unknown }).statusCode)
        : 0;
      if (statusCode === 404 || statusCode === 410) {
        db.prepare("DELETE FROM push_subscriptions WHERE id=?").run(subscription.id);
      }
    });
  }
}
