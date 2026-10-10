import { assertEquals, assertRejects } from "@std/assert";
import {
  readJsonObjectBody,
  RequestBodyTooLargeError,
} from "./request-body.ts";

Deno.test("reads bounded JSON objects including UTF-8 content", async () => {
  const request = new Request("https://example.test", {
    method: "POST",
    body: JSON.stringify({ message: "رحلة" }),
  });

  assertEquals(await readJsonObjectBody(request, 100), { message: "رحلة" });
});

Deno.test("returns an empty object for an empty body or non-object JSON", async () => {
  assertEquals(
    await readJsonObjectBody(new Request("https://example.test")),
    {},
  );
  assertEquals(
    await readJsonObjectBody(
      new Request("https://example.test", { method: "POST", body: "[]" }),
    ),
    {},
  );
  assertEquals(
    await readJsonObjectBody(
      new Request("https://example.test", { method: "POST", body: "null" }),
    ),
    {},
  );
});

Deno.test("accepts a body exactly at the configured byte limit", async () => {
  const body = JSON.stringify({ value: "ok" });
  assertEquals(
    await readJsonObjectBody(
      new Request("https://example.test", { method: "POST", body }),
      new TextEncoder().encode(body).byteLength,
    ),
    { value: "ok" },
  );
});

Deno.test("rejects an oversized streamed body and cancels further reads", async () => {
  let canceled = false;
  let pulls = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls++;
      controller.enqueue(new Uint8Array([123, 125]));
    },
    cancel() {
      canceled = true;
    },
  }, { highWaterMark: 0 });
  const request = new Request("https://example.test", { method: "POST", body });

  await assertRejects(
    () => readJsonObjectBody(request, 3),
    RequestBodyTooLargeError,
  );
  assertEquals(canceled, true);
  assertEquals(pulls, 2);
});

Deno.test("rejects malformed JSON after reading the bounded body", async () => {
  const request = new Request("https://example.test", {
    method: "POST",
    body: "{",
  });
  await assertRejects(() => readJsonObjectBody(request), SyntaxError);
});
