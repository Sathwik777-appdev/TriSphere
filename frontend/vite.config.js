import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

// One build → one version. Generated at config-load time and shared by:
//   • the `define` injection (available in app code as __APP_VERSION__)
//   • the sw.js cache-version stamp
//   • the asset-manifest.json header
// Keeping all three on the same string means "v" shown on the loader is
// the exact version the user is running.
const BUILD_VERSION = `v-${Date.now()}`

// Replaces the __BUILD_VERSION__ placeholder in dist/sw.js with a unique
// timestamp at the end of every build. Without this, the service worker's
// CACHE_VERSION stays constant across deploys, so users keep serving stale JS
// bundles from the SW cache no matter how many hard-refreshes they do.
//
// Also writes dist/asset-manifest.json — a list of every JS/CSS asset with
// its byte size. The runtime SW-update flow reads this on the client to
// decide whether the update is "small enough to apply silently" or "big
// enough to ask permission first" (the 20MB threshold).
function bumpServiceWorkerVersion() {
  return {
    name: 'bump-sw-version',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist')
      const swPath = path.join(distDir, 'sw.js')
      const buildVersion = BUILD_VERSION

      if (fs.existsSync(swPath)) {
        let content = fs.readFileSync(swPath, 'utf-8')
        content = content.replace(/__BUILD_VERSION__/g, buildVersion)
        fs.writeFileSync(swPath, content)
        console.log(`✓ Service worker CACHE_VERSION bumped to ${buildVersion}`)
      }

      // Walk dist/ and record every meaningful asset's size. Skip the
      // manifest itself + service worker (those bypass the update check).
      const assetsDir = path.join(distDir, 'assets')
      const assets = []
      let totalBytes = 0
      try {
        if (fs.existsSync(assetsDir)) {
          for (const name of fs.readdirSync(assetsDir)) {
            const full = path.join(assetsDir, name)
            const stat = fs.statSync(full)
            if (!stat.isFile()) continue
            assets.push({
              name: `/assets/${name}`,
              size: stat.size,
            })
            totalBytes += stat.size
          }
        }
        // Also include the top-level index.html since it changes every build.
        const indexPath = path.join(distDir, 'index.html')
        if (fs.existsSync(indexPath)) {
          const stat = fs.statSync(indexPath)
          assets.push({ name: '/index.html', size: stat.size })
          totalBytes += stat.size
        }
      } catch (e) {
        console.warn('asset-manifest: failed to scan dist', e)
      }

      const manifest = {
        version: buildVersion,
        builtAt: new Date().toISOString(),
        totalBytes,
        assets,
      }
      try {
        fs.writeFileSync(
          path.join(distDir, 'asset-manifest.json'),
          JSON.stringify(manifest),
        )
        const mb = (totalBytes / 1024 / 1024).toFixed(2)
        console.log(`✓ Asset manifest written (${assets.length} assets, ${mb} MB total)`)
      } catch (e) {
        console.warn('asset-manifest: failed to write', e)
      }
    }
  }
}

export default defineConfig({
  // Expose the build version to runtime code. Referenced as the literal
  // identifier __APP_VERSION__ anywhere in the React source — Vite inlines
  // the actual string at build time, so there's zero runtime cost.
  define: {
    __APP_VERSION__: JSON.stringify(BUILD_VERSION),
    __APP_BUILT_AT__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [react(), bumpServiceWorkerVersion()],
  server: {
    port: 3000,
    host: '0.0.0.0', // Allow connections from mobile devices
    strictPort: true,
    hmr: {
      protocol: 'ws'
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  // Strip console.log / console.info / console.debug / debugger from the
  // PRODUCTION bundle. Errors and warnings stay (we still want real
  // problems to surface in browser DevTools and our errorLogs collection).
  // Dev builds are unaffected — the drop only happens when `vite build`
  // runs, which is what production deploys do.
  esbuild: {
    drop: ['debugger'],
    pure: ['console.log', 'console.info', 'console.debug', 'console.trace'],
  },
  build: {
    // Explicitly disable source maps in production. Without this users could
    // open DevTools and read your original (un-minified, commented) source
    // via the Sources tab. With it off they only see minified gibberish.
    sourcemap: false,
    // Optimize bundle size with code splitting
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          'ai': ['groq-sdk', 'tesseract.js'],
          'pdf': ['pdfjs-dist', 'react-pdf'],
          'ui': ['react-markdown', 'remark-gfm'],
          'charts': ['recharts'],
          'three': ['three']
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom']
  }
})
