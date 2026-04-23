import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { metaImagesPlugin } from "./vite-plugin-meta-images";

function swCacheVersionPlugin(): Plugin {
  const buildHash = crypto.randomBytes(6).toString("hex");
  const cacheVersion = `noti-app-${buildHash}`;

  return {
    name: "sw-cache-version",

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== "/sw.js") return next();
        const swPath = path.resolve(import.meta.dirname, "client/public/sw.js");
        try {
          const content = fs.readFileSync(swPath, "utf-8");
          const replaced = content.replaceAll("__SW_CACHE_VERSION__", cacheVersion);
          res.setHeader("Content-Type", "application/javascript");
          res.setHeader("Cache-Control", "no-store");
          res.end(replaced);
        } catch {
          next();
        }
      });
    },

    closeBundle() {
      const swDist = path.resolve(import.meta.dirname, "dist/public/sw.js");
      if (!fs.existsSync(swDist)) return;
      const content = fs.readFileSync(swDist, "utf-8");
      const replaced = content.replaceAll("__SW_CACHE_VERSION__", cacheVersion);
      fs.writeFileSync(swDist, replaced, "utf-8");
      console.log(`[sw-cache-version] Cache version set to: ${cacheVersion}`);
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    tailwindcss(),
    metaImagesPlugin(),
    swCacheVersionPlugin(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
