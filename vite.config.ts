import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mcpPlugin(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon-32.png", "apple-touch-icon.png"],
      manifest: {
        name: "Aptis Kỳ Tích",
        short_name: "Aptis Kỳ Tích",
        description: "Luyện thi Aptis mô phỏng 100% đề thật, AI Kỳ Tích chấm Speaking & Writing.",
        lang: "vi",
        theme_color: "#CC1C01",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,

        navigateFallbackDenylist: [/^\/~/],
        // Don't precache index.html — always fetch fresh from network
        globIgnores: ["**/index.html", "**/exceljs-*.js", "**/recharts-*.js"],
        navigateFallback: null,
        runtimeCaching: [
          {
            // Navigations / HTML documents: NetworkFirst so users get newest index.html
            urlPattern: ({ request }) => request.mode === "navigate" || request.destination === "document",
            handler: "NetworkFirst",
            options: {
              cacheName: "html-cache",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  build: {
    target: "safari14",
    // Vite's default preload helper eagerly registers every dynamic-import
    // chunk (including exceljs) via a static side-effect import in the parent
    // chunk. Disabling the polyfill/registration keeps heavy chunks like
    // exceljs and recharts out of the initial page load — they only load when
    // the actual dynamic import executes at runtime.
    modulePreload: false,
    rollupOptions: {
      output: {
        // Rollup hoists a lazy chunk's transitive imports up into its parent
        // as static side-effect imports for perf. That's what drags exceljs
        // (and any large lazy dep) into the initial entry chunk. Disable it so
        // heavy chunks only load when their dynamic import actually runs.
        hoistTransitiveImports: false,
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          // Keep tiny shared utilities in a stable "utils" chunk so heavy vendor
          // chunks (recharts, exceljs) can't absorb them and drag themselves
          // into the initial entry graph via a shared symbol like `clsx`.
          if (
            id.includes("/node_modules/clsx/") ||
            id.includes("/node_modules/tailwind-merge/") ||
            id.includes("/node_modules/class-variance-authority/")
          )
            return "utils";
          if (id.includes("framer-motion")) return "framer-motion";
          if (id.includes("@radix-ui")) return "radix-ui";
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
