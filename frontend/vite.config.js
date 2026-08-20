import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Register via the explicit, same-origin /registerSW.js (in public/) so the
      // CSP `script-src 'self'` allows it — the plugin's inline injection would be
      // blocked by the CSP and the service worker would never register.
      injectRegister: false,
      workbox: {
        // Exclude HTML from precache — index.html is served with Cache-Control:
        // no-store so it's always fetched fresh. Precaching it causes stale chunk
        // references after a rebuild (old index.html references hashed chunks that
        // no longer exist on the server → "Failed to fetch dynamically imported module").
        globPatterns: ['**/*.{js,css,ico,png,svg,woff2}'],
        // Don't use precache-backed navigateFallback (it would serve a stale
        // index.html referencing dead chunk hashes). Instead, handle navigations
        // with a runtime NetworkFirst rule below: fresh index.html when online,
        // last-cached shell when offline (so the PWA still opens offline).
        navigateFallback: null,
        runtimeCaching: [
          // App shell — page loads. NetworkFirst keeps chunk hashes fresh online
          // and falls back to the cached shell offline.
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'app-shell',
              networkTimeoutSeconds: 3,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Bible chapter API — NetworkFirst so fresh data wins when online,
          // falls back to cache for offline reading of already-visited chapters.
          {
            urlPattern: /^\/api\/bible\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'bible-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 300, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Commentary — same strategy, slightly smaller cache
          {
            urlPattern: /^\/api\/commentary\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'commentary-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Google Fonts — long-lived CacheFirst
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-css',
              expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-static',
              expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'Scriptura Bible Study',
        short_name: 'Scriptura',
        description: 'Deep Bible study: 13 translations, Greek/Hebrew interlinear, 15 commentaries, AI assistant, maps, and 31 study tools.',
        theme_color: '#2563eb',
        background_color: '#030712',
        display: 'standalone',
        orientation: 'any',
        start_url: '/read',
        scope: '/',
        categories: ['education', 'books', 'lifestyle'],
        shortcuts: [
          { name: 'Read Bible', short_name: 'Read', description: 'Open the Bible reader', url: '/read', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Browse Books', short_name: 'Browse', description: 'Browse Bible books', url: '/browse', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
        ],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
