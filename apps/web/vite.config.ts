import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Family Cookbook",
        short_name: "Cookbook",
        display: "standalone",
        start_url: "/",
        background_color: "#FBF6EC",
        theme_color: "#B4552F",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /\/storage\/v1\/object\/public\//,
            handler: "CacheFirst",
            options: { cacheName: "recipe-images" },
          },
        ],
      },
    }),
  ],
});
