import { assertEquals } from "jsr:@std/assert@1.0.19";
import { allowedCorsOrigin, corsHeaders } from "./cors.ts";

Deno.test("CORS allows only the production and local development origins by default", () => {
  assertEquals(
    allowedCorsOrigin("https://sekka-go.pages.dev"),
    "https://sekka-go.pages.dev",
  );
  assertEquals(
    allowedCorsOrigin("http://localhost:5173"),
    "http://localhost:5173",
  );
  assertEquals(allowedCorsOrigin("https://preview.sekka-go.pages.dev"), null);
  assertEquals(allowedCorsOrigin("null"), null);
});

Deno.test("CORS supports explicitly configured exact preview origins", () => {
  assertEquals(
    allowedCorsOrigin(
      "https://review-123.pages.dev",
      "https://review-123.pages.dev",
    ),
    "https://review-123.pages.dev",
  );
  assertEquals(
    allowedCorsOrigin(
      "https://evil-review-123.pages.dev",
      "https://review-123.pages.dev",
    ),
    null,
  );
  assertEquals(
    allowedCorsOrigin(
      "http://review-123.pages.dev",
      "http://review-123.pages.dev",
    ),
    null,
  );
  assertEquals(
    allowedCorsOrigin(
      "https://review-123.pages.dev",
      "https://review-123.pages.dev/",
    ),
    null,
  );
});

Deno.test("disallowed or absent origins do not receive Access-Control-Allow-Origin", () => {
  const headers = new Headers(corsHeaders("https://untrusted.example"));
  assertEquals(headers.get("Access-Control-Allow-Origin"), null);
  assertEquals(headers.get("Vary"), "Origin");
});
