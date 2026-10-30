import { readFormDataBody, RequestBodyTooLargeError } from "./request-body.ts";

Deno.test("readFormDataBody parses bounded multipart requests", async () => {
  const original = new FormData();
  original.set("description", "A sufficiently detailed report description.");
  const request = new Request("https://example.test/reports", {
    method: "POST",
    body: original,
  });

  const parsed = await readFormDataBody(request, 2_000);
  if (parsed.get("description") !== "A sufficiently detailed report description.") {
    throw new Error("Multipart field was not preserved.");
  }
});

Deno.test("readFormDataBody rejects oversized bodies without relying on Content-Length", async () => {
  const request = new Request("https://example.test/reports", {
    method: "POST",
    headers: { "content-type": "multipart/form-data; boundary=sekka-test" },
    body: new Uint8Array(32),
  });

  let rejected = false;
  try {
    await readFormDataBody(request, 16);
  } catch (cause) {
    rejected = cause instanceof RequestBodyTooLargeError;
  }
  if (!rejected) throw new Error("Oversized body should be rejected.");
});
