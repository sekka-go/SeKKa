type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const storageKey = "sekka.v31.reservationAttempt";
const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

function readAttempts(storage: StorageLike): Map<string, string> {
  const raw = storage.getItem(storageKey);
  if (!raw) return new Map();

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return new Map();
  }

  const attempts = new Map<string, string>();
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (Array.isArray(entry) && typeof entry[0] === "string" && isUuid(entry[1])) {
        attempts.set(entry[0], entry[1]);
      }
    }
  } else if (
    value !== null &&
    typeof value === "object" &&
    "signature" in value &&
    typeof value.signature === "string" &&
    "idempotency" in value &&
    isUuid(value.idempotency)
  ) {
    attempts.set(value.signature, value.idempotency);
  }
  return attempts;
}

function writeAttempts(storage: StorageLike, attempts: Map<string, string>): void {
  if (attempts.size === 0) {
    storage.removeItem(storageKey);
    return;
  }
  storage.setItem(storageKey, JSON.stringify([...attempts]));
}

export function reservationIdempotencyKey(
  storage: StorageLike,
  signature: string,
  createId: () => string = () => globalThis.crypto.randomUUID(),
): string {
  const attempts = readAttempts(storage);
  const existing = attempts.get(signature);
  if (existing) return existing;

  const idempotency = createId();
  if (!isUuid(idempotency)) throw new Error("INVALID_IDEMPOTENCY_KEY");
  attempts.set(signature, idempotency);
  writeAttempts(storage, attempts);
  return idempotency;
}

export function clearReservationAttempt(storage: StorageLike, signature: string): void {
  const attempts = readAttempts(storage);
  attempts.delete(signature);
  writeAttempts(storage, attempts);
}
