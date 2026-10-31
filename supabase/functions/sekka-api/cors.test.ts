import { allowedCorsOrigin, corsHeaders } from "./cors.ts";

Deno.test("CORS permits only production, local development, and explicit valid origins", () => {
  if (
    allowedCorsOrigin("https://sekka-go.pages.dev") !==
      "https://sekka-go.pages.dev"
  ) {
    throw new Error("Production origin was rejected.");
  }
  if (allowedCorsOrigin("http://localhost:5173") !== "http://localhost:5173") {
    throw new Error("Local development origin was rejected.");
  }
  if (
    allowedCorsOrigin(
      "https://preview.example.test",
      "https://preview.example.test",
    ) !== "https://preview.example.test"
  ) {
    throw new Error("Explicit HTTPS preview origin was rejected.");
  }
  if (allowedCorsOrigin("https://attacker.example") !== null) {
    throw new Error("Unconfigured origin was accepted.");
  }
  if (
    allowedCorsOrigin("http://192.168.1.4:5173", "http://192.168.1.4:5173") !==
      null
  ) {
    throw new Error("Non-local insecure origin was accepted.");
  }
});

Deno.test("CORS omits allow-origin for requests without an approved origin", () => {
  const headers = new Headers(corsHeaders("https://attacker.example"));
  if (headers.has("Access-Control-Allow-Origin")) {
    throw new Error("Unapproved origin received CORS access.");
  }
});
