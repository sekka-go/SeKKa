import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  // Synthetic Google session fixtures are run only by a separate CI build,
  // never alongside real-staging acceptance tests.
  testIgnore: process.env.SEKKA_AUTH_UI_MOCKS==='true'
    ? []
    : [
      '**/admin-authorization-mocked.spec.ts',
      '**/mobile-navigation-role.spec.ts',
      '**/captain-onboarding-validation.spec.ts',
      '**/captain-document-upload-mocked.spec.ts',
      '**/captain-plate-segments.spec.ts',
      '**/v31-rider-no-match-request-mocked.spec.ts'
    ],
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    },
  },
  webServer: {
    // Vite preview supplies the same SPA history fallback as Cloudflare Pages.
    // Python's bare http.server returned 404 for /dev/screens and deep links.
    command: "npm run preview -- --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
  reporter: "list",
});
