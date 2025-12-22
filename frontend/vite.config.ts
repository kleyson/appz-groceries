import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { readFileSync, existsSync } from 'fs'

// Read version from VERSION file
function getVersion(): string {
  const possiblePaths = [
    path.join(__dirname, '../VERSION'),
    path.join(__dirname, '../../VERSION'),
  ]

  for (const versionPath of possiblePaths) {
    if (existsSync(versionPath)) {
      return readFileSync(versionPath, 'utf-8').trim()
    }
  }
  return 'dev'
}

const appVersion = getVersion()

// Get HTTPS configuration for development
function getHttpsConfig(): boolean | { key: string; cert: string } | undefined {
  // Check if HTTPS is enabled via environment variable
  if (process.env.VITE_HTTPS !== 'true') {
    return false
  }

  // Look for SSL certificates
  const certPaths = [
    path.join(__dirname, '../.dev-certs/cert.pem'),
    path.join(__dirname, '../../.dev-certs/cert.pem'),
  ]

  const keyPaths = [
    path.join(__dirname, '../.dev-certs/key.pem'),
    path.join(__dirname, '../../.dev-certs/key.pem'),
  ]

  for (let i = 0; i < certPaths.length; i++) {
    if (existsSync(certPaths[i]) && existsSync(keyPaths[i])) {
      return {
        key: readFileSync(keyPaths[i], 'utf-8'),
        cert: readFileSync(certPaths[i], 'utf-8'),
      }
    }
  }

  console.warn(
    '⚠️  VITE_HTTPS=true but certificates not found. Run: make dev-certs',
  )
  return false
}

export default defineConfig({
  plugins: [
    TanStackRouterVite(),
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon-32x32.png', 'favicon-16x16.png', 'apple-touch-icon.png', 'icons/*.png'],
      manifest: false, // We use our own manifest.json
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            // Cache API GET requests
            urlPattern: /^\/api\/.*$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
              networkTimeoutSeconds: 10,
            },
          },
          {
            // Cache Google Fonts
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true, // Enable SW in dev for testing
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true, // Allow access from network
    https: getHttpsConfig(),
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
})
