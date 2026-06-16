import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './styles/responsive.css';
// Mobile-specific GPU / touch / scroll optimizations. Loaded last so it
// takes precedence in the cascade where rules collide.
import './styles/mobile-optimizations.css';
import { clearAllData } from './utils/clearData';
import { safeSessionStorage } from './utils/storage';
import { logGlobalError, logUnhandledRejection } from './services/errorLogger';
import { detectAndApplyDeviceTier } from './utils/deviceTier';
import { initializeAdMob } from './services/adMobService';
import { Capacitor } from '@capacitor/core';

// Run device-tier detection before React mounts so the body class is set
// in time for the first paint — low-tier devices skip heavy visuals from
// frame one rather than rendering them once and then degrading.
detectAndApplyDeviceTier();

// Make clearAllData available globally in browser console
if (typeof window !== 'undefined') {
  window.clearAllData = clearAllData;
}

// Register Service Worker for offline support (production only).
//
// Update strategy — preserves in-memory state across home-button trips:
//   1. When a new SW finishes installing in the background, we fetch the new
//      asset-manifest.json (written by the vite plugin).
//   2. We compute "download size" = sum of sizes of assets in the new manifest
//      that are NOT already in the browser's cache. Because Vite hashes file
//      names by content, an unchanged chunk has the same URL and is already
//      cached; only TRULY new bytes count.
//   3. < 20 MB → install silently and let the new SW sit in the `waiting`
//      state. It activates naturally on the next cold start (when the user
//      fully closes the PWA / tab). We DO NOT auto-reload — pressing the
//      home button and returning must NEVER cause a refresh.
//   4. >= 20 MB → emit `trisphere:update-available` with size info so a UI
//      component can show a non-blocking prompt (handled in App.jsx). The
//      user opts in to the reload by clicking the prompt.
const UPDATE_PROMPT_THRESHOLD_BYTES = 20 * 1024 * 1024; // 20 MB

async function calculateUncachedBytes(manifest) {
  if (!manifest || !Array.isArray(manifest.assets)) return 0;
  let bytes = 0;
  for (const asset of manifest.assets) {
    try {
      const hit = await caches.match(asset.name);
      if (!hit) bytes += asset.size || 0;
    } catch (e) {
      // If cache check fails, conservatively count as new
      bytes += asset.size || 0;
    }
  }
  return bytes;
}

if ('serviceWorker' in navigator && !Capacitor.isNativePlatform()) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { updateViaCache: 'none' })
        .then((registration) => {
          console.log('✅ Service Worker registered:', registration.scope);

          // ── Cold-start update flush ──────────────────────────────────────
          // If the previous session installed a new SW that's still
          // sitting in `waiting`, activate it RIGHT NOW. This is what
          // makes "close the app from recents, reopen it" actually
          // deliver the new code — without this the waiting SW sits
          // there indefinitely on the Android TWA and the user sees
          // the old JS bundle until they fully force-stop the app via
          // Settings.
          //
          // We only do this on cold start (when this script runs
          // fresh) — mid-session updates still defer per the
          // updatefound handler below, so we don't yank state out
          // from under an ASTRA conversation.
          if (registration.waiting && navigator.serviceWorker.controller) {
            console.log('🆕 Applying pending update from previous session');
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }

          // When the new SW takes control, the JS bundles already in
          // memory are still the old ones — a single reload swaps the
          // user onto the new code. We dedupe with a flag so the
          // event firing twice (which it sometimes does on Chromium)
          // doesn't trigger a reload loop.
          let _swReloaded = false;
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (_swReloaded) return;
            _swReloaded = true;
            console.log('🔄 New SW took control — reloading once');
            window.location.reload();
          });

          // Check for new versions in the background.
          registration.update();

          // ── Keep checking for updates while the app is open ──────────────
          // Every time the tab regains focus AND once every 5 minutes, ask
          // the browser to fetch /sw.js again and see if it changed. This
          // is cheap (a tiny HEAD-ish request — only the SW bytes), and
          // it's the only reliable way to pick up new deploys WITHOUT the
          // user fully closing and reopening the app. When a new SW is
          // found, the updatefound handler below installs it silently.
          const recheckUpdate = () => {
            try { registration.update(); } catch (e) {}
          };
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') recheckUpdate();
          });
          window.addEventListener('focus', recheckUpdate);
          window.addEventListener('online', recheckUpdate);
          setInterval(recheckUpdate, 5 * 60 * 1000); // 5-minute poll

          // ── Update-available handling ────────────────────────────────────
          // Auto-apply small updates the instant the user looks away from the
          // tab. Prompt for big ones. Never interrupt mid-task.
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (!newWorker) return;
            newWorker.addEventListener('statechange', async () => {
              if (newWorker.state !== 'installed' || !navigator.serviceWorker.controller) return;

              let downloadBytes = 0;
              try {
                // Bust cache on the manifest itself so we get the new version.
                const res = await fetch('/asset-manifest.json?v=' + Date.now(), { cache: 'no-store' });
                if (res.ok) {
                  const manifest = await res.json();
                  downloadBytes = await calculateUncachedBytes(manifest);
                }
              } catch (e) {
                console.warn('Update size check failed, will treat as small update', e);
              }

              const MB = downloadBytes / 1024 / 1024;
              if (downloadBytes < UPDATE_PROMPT_THRESHOLD_BYTES) {
                console.log(`🔄 Small update (${MB.toFixed(2)} MB) — installed silently. Will activate on next cold start.`);
                // Intentionally do NOT call SKIP_WAITING or trigger a reload.
                // The new SW stays in the `waiting` state and activates only
                // when ALL tabs of this app close — i.e. the user fully
                // dismisses the PWA. This guarantees that pressing the home
                // button and returning preserves in-memory state.
              } else {
                console.log(`📦 Large update (${MB.toFixed(2)} MB) — asking permission.`);
                try {
                  window.dispatchEvent(new CustomEvent('trisphere:update-available', {
                    detail: {
                      bytes: downloadBytes,
                      mb: parseFloat(MB.toFixed(1)),
                      // Caller invokes apply() to install + reload.
                      apply: () => {
                        try { newWorker.postMessage({ type: 'SKIP_WAITING' }); } catch (e) {}
                        // Tiny delay to let SW activate before reload
                        setTimeout(() => window.location.reload(), 200);
                      },
                    },
                  }));
                } catch (e) {}
              }
            });
          });
        })
        .catch((error) => {
          console.error('❌ Service Worker registration failed:', error);
        });
    });
  } else {
    // In dev, unregister any existing service workers to avoid offline caching during development
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => {
        console.log('🧹 Unregistering service worker in dev:', reg.scope);
        reg.unregister();
      });
    }).catch((err) => {
      console.warn('Could not get service worker registrations:', err);
    });
  }
}

// Global error handler for uncaught errors
window.onerror = function (message, source, lineno, colno, error) {
  console.error('Global error:', message, source, lineno, colno, error);
  logGlobalError(message, source, lineno, error);
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="padding: 30px; font-family: sans-serif; min-height: 100vh; background: linear-gradient(135deg, #0f172a, #1e3a5f); color: white; box-sizing: border-box;">
        <h2 style="color: #ef4444;">⚠️ JavaScript Error</h2>
        <p style="color: rgba(255,255,255,0.8);">An error occurred while loading the app.</p>
        <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; font-size: 12px; margin-top: 20px; word-break: break-word;">
          <strong>Error:</strong> ${message}<br/>
          <strong>Source:</strong> ${source}<br/>
          <strong>Line:</strong> ${lineno}
        </div>
        <button onclick="window.location.reload()" style="margin-top: 20px; padding: 12px 24px; background: linear-gradient(135deg, #3b82f6, #1e40af); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px;">
          🔄 Reload App
        </button>
      </div>
    `;
  }
  return true;
};

// Catch unhandled promise rejections
window.onunhandledrejection = function (event) {
  console.error('Unhandled rejection:', event.reason);
  logUnhandledRejection(event.reason);
};

// ─── Block pinch-zoom on mobile ───
// The viewport meta tag with `user-scalable=no` covers most browsers, but
// iOS Safari (≥10) intentionally ignores it for accessibility.
// `gesturestart` is iOS-only and fires for two-finger pinch — calling
// preventDefault here stops the zoom.
if (typeof document !== 'undefined') {
  document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });
}

try {
  // Initialize native AdMob before React boots (only runs on Capacitor native Android app)
  initializeAdMob();

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
} catch (error) {
  console.error('React render error:', error);
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="padding: 30px; font-family: sans-serif; min-height: 100vh; background: linear-gradient(135deg, #0f172a, #1e3a5f); color: white; box-sizing: border-box;">
        <h2 style="color: #ef4444;">⚠️ App Failed to Load</h2>
        <p style="color: rgba(255,255,255,0.8);">Error: ${error.message}</p>
        <button onclick="window.location.reload()" style="margin-top: 20px; padding: 12px 24px; background: linear-gradient(135deg, #3b82f6, #1e40af); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px;">
          🔄 Reload App
        </button>
      </div>
    `;
  }
}
