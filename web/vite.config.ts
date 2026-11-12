import { defineConfig } from "vite";
// New frontend calls only the isolated subscription RPC using explicit V2 configuration.
export default defineConfig({
  server: { host: "0.0.0.0", port: 5173, strictPort: true },
});
