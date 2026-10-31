import {
  detectEvidenceMimeType,
  evidenceExtension,
  REPORT_CATEGORIES,
  validateReportFields,
} from "./report-validation.ts";

const base = {
  subjectType: "user",
  category: "fraud",
  description: "هذا وصف كافٍ للبلاغ يشرح ما حدث بوضوح.",
  targetUserId: 21,
  lineId: null,
  reporterUserId: 10,
};

Deno.test("report fields accept valid user, offer, and behavior targets", () => {
  for (
    const fields of [
      base,
      { ...base, subjectType: "offer", targetUserId: null, lineId: 95 },
      { ...base, subjectType: "behavior", lineId: 95 },
      ...REPORT_CATEGORIES.map((category) => ({ ...base, category })),
    ]
  ) {
    if (!validateReportFields(fields)) {
      throw new Error(`Valid report was rejected: ${JSON.stringify(fields)}`);
    }
  }
});

Deno.test("report fields reject missing, mismatched, self, and malformed targets", () => {
  const invalid = [
    { ...base, subjectType: "unknown" },
    { ...base, category: "not-a-category" },
    { ...base, description: "وصف قصير" },
    { ...base, targetUserId: 10 },
    { ...base, targetUserId: null },
    { ...base, lineId: 0 },
    { ...base, subjectType: "offer", targetUserId: 21, lineId: 95 },
    { ...base, subjectType: "offer", targetUserId: null, lineId: null },
    { ...base, subjectType: "behavior", targetUserId: null, lineId: null },
  ];

  for (const fields of invalid) {
    if (validateReportFields(fields)) {
      throw new Error(`Invalid report was accepted: ${JSON.stringify(fields)}`);
    }
  }
});

Deno.test("evidence MIME detection checks actual supported file signatures", () => {
  const cases: Array<[Uint8Array, string]> = [
    [new Uint8Array([0xff, 0xd8, 0xff, 0x00]), "image/jpeg"],
    [new Uint8Array([0x89, 0x50, 0x4e, 0x47]), "image/png"],
    [
      new Uint8Array([
        0x52,
        0x49,
        0x46,
        0x46,
        0,
        0,
        0,
        0,
        0x57,
        0x45,
        0x42,
        0x50,
      ]),
      "image/webp",
    ],
    [new TextEncoder().encode("%PDF-1.7"), "application/pdf"],
  ];

  for (const [bytes, mimeType] of cases) {
    if (detectEvidenceMimeType(bytes) !== mimeType) {
      throw new Error(`Expected evidence signature ${mimeType}.`);
    }
  }
  if (detectEvidenceMimeType(new TextEncoder().encode("not-a-file")) !== null) {
    throw new Error("Unsupported file signature was accepted.");
  }
});

Deno.test("evidence extensions are allowlisted", () => {
  const expected: Array<[string, string]> = [
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
    ["image/webp", "webp"],
    ["application/pdf", "pdf"],
  ];
  for (const [mimeType, extension] of expected) {
    if (evidenceExtension(mimeType) !== extension) {
      throw new Error(`Unexpected extension for ${mimeType}.`);
    }
  }
  if (evidenceExtension("text/html") !== null) {
    throw new Error("Unapproved evidence extension was accepted.");
  }
});
