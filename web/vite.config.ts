import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const supabaseUrl = env.VITE_SUPABASE_URL;
  return {
    server: {
      port: 5173,
      strictPort: true,
      proxy: supabaseUrl ? {
        "/__sekka-api": {
          target: supabaseUrl,
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/__sekka-api/, "/functions/v1/sekka-api"),
        },
      } : undefined,
    },
  };
});
