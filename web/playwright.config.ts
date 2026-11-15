import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  // Synthetic Google session fixtures are run only by a separate CI build,
  // never alongside real-staging acceptance tests.
  testIgnore: process.env.SEKKA_AUTH_UI_MOCKS==='true' ? [] : ['**/admin-authorization-mocked.spec.ts'],
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    },
  },
  webServer: {
    command: "python3 -m http.server 4173 --bind 127.0.0.1 --directory dist",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
  reporter: "list",
});
