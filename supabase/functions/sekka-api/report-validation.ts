export type ReportSubjectType = "user" | "offer" | "behavior";

export const REPORT_CATEGORIES = [
  "fraud",
  "harassment",
  "unsafe_behavior",
  "misleading_offer",
  "other",
] as const;

export type ReportFields = {
  subjectType: string;
  category: string;
  description: string;
  targetUserId: number | null;
  lineId: number | null;
  reporterUserId: number;
};

export function validateReportFields(fields: ReportFields): boolean {
  const {
    subjectType,
    category,
    description,
    targetUserId,
    lineId,
    reporterUserId,
  } = fields;
  if (!(["user", "offer", "behavior"] as string[]).includes(subjectType)) {
    return false;
  }
  if (!(REPORT_CATEGORIES as readonly string[]).includes(category)) {
    return false;
  }
  if (description.length < 20 || description.length > 5000) return false;
  if (
    targetUserId !== null &&
    (!Number.isSafeInteger(targetUserId) || targetUserId < 1 ||
      targetUserId === reporterUserId)
  ) return false;
  if (lineId !== null && (!Number.isSafeInteger(lineId) || lineId < 1)) {
    return false;
  }
  if (subjectType === "user" && (targetUserId === null || lineId !== null)) {
    return false;
  }
  if (subjectType === "offer" && (lineId === null || targetUserId !== null)) {
    return false;
  }
  if (subjectType === "behavior" && targetUserId === null && lineId === null) {
    return false;
  }
  return true;
}

export function detectEvidenceMimeType(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) return "image/png";
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 &&
    bytes[3] === 0x46 && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) return "image/webp";
  if (String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-") {
    return "application/pdf";
  }
  return null;
}

export function evidenceExtension(mimeType: string): string | null {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return null;
}
