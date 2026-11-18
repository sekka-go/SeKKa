import { defineConfig } from "vite";
// New frontend calls only the isolated subscription RPC using explicit V2 configuration.
export default defineConfig({
  // Embed the running JS bundle's exact source SHA. build-info.json alone
  // reports the newest deployment and cannot detect an older installed PWA.
  define: {
    __SEKKA_SOURCE_SHA__: JSON.stringify(process.env.CF_PAGES_COMMIT_SHA || ""),
  },
  server: { host: "0.0.0.0", port: 5173, strictPort: true },
  plugins: [{
    name: "sekka-build-metadata",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "build-info.json",
        source: JSON.stringify({
          sourceCommitSha: process.env.CF_PAGES_COMMIT_SHA || null,
          previewUrl: process.env.CF_PAGES_URL || null,
          branch: process.env.CF_PAGES_BRANCH || null,
        }),
      });
    },
  }],
});
