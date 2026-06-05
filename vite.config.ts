import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  base: '/rmb-spend-tracker/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Activate the new SW immediately on next load instead of waiting for all
      // tabs to close — without this, users get stuck on stale bundles.
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: '/rmb-spend-tracker/index.html',
        // CRITICAL: don't fall back to index.html for download requests. Without
        // this, clicking <a download href="blob:..."> in PWA standalone mode
        // can trigger a navigate event the SW serves index.html for, hanging
        // the app on a route it can't render.
        navigateFallbackDenylist: [
          /\.[a-z0-9]+$/i,  // anything that looks like a file (has an extension)
          /^blob:/,
        ],
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Spend Tracker',
        short_name: 'Spends',
        description: 'Personal spend and loan tracker',
        theme_color: '#0f172a',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/rmb-spend-tracker/',
        scope: '/rmb-spend-tracker/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
    })
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  }
});
