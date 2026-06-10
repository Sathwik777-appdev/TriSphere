import { useEffect, useState } from 'react';

/**
 * useBottomInset — intelligently figures out how much breathing room the
 * bottom of the UI needs so it doesn't collide with the device's system
 * navigation (Android 3-button bar, gesture pill, iOS home indicator).
 *
 * It listens to three signals and recomputes the right pixel value:
 *
 *  1. CSS `env(safe-area-inset-bottom)` — gold standard. Reported by:
 *     • iOS Safari for the home-indicator area
 *     • Modern Chrome on Android when the system nav overlays content
 *     • PWAs in standalone mode with viewport-fit=cover
 *     If > 0, we trust it (plus a small visual buffer).
 *
 *  2. `window.visualViewport` vs `window.innerHeight` — when the system
 *     UI overlaps (rather than resizes) the page, visualViewport.height
 *     is less than innerHeight. The delta is the system UI eating space.
 *
 *  3. Platform heuristic — Android needs more buffer than desktop because
 *     even gesture nav reserves a 16-24dp invisible swipe area.
 *
 * The hook subscribes to `resize`, `orientationchange`, and the
 * VisualViewport events so it RECOMPUTES dynamically — when the user
 * shows/hides the system bar, the nav moves with it.
 *
 * @param {number} minPx — minimum inset regardless of measurement (default 12)
 * @returns {number} inset in CSS pixels to apply to bottom margin
 */
export const useBottomInset = (minPx = 12) => {
    const [inset, setInset] = useState(minPx);

    useEffect(() => {
        const measure = () => {
            // ─── 1. Probe CSS env(safe-area-inset-bottom) ───
            // Inject a 0×0 probe with padding-bottom set to the env var,
            // read back the computed padding-bottom, then remove. This is
            // the cleanest cross-browser way to read the actual safe area
            // in JavaScript.
            let safeArea = 0;
            try {
                const probe = document.createElement('div');
                probe.style.cssText =
                    'position:fixed;left:0;bottom:0;width:0;height:0;' +
                    'padding-bottom:env(safe-area-inset-bottom);' +
                    'visibility:hidden;pointer-events:none;';
                document.body.appendChild(probe);
                safeArea = parseFloat(window.getComputedStyle(probe).paddingBottom) || 0;
                document.body.removeChild(probe);
            } catch (e) { /* SSR or weird env */ }

            // ─── 2. VisualViewport delta — overlapping system UI ───
            let overlap = 0;
            try {
                const winH = window.innerHeight || 0;
                const visH = window.visualViewport?.height || winH;
                overlap = Math.max(0, winH - visH);
                // Soft keyboard also widens this delta — but on the dashboard
                // there's no input mounted at the body level, so this should
                // be system-UI driven. Cap at 60px to avoid keyboard skew.
                if (overlap > 60) overlap = 0;
            } catch (e) {}

            // ─── 3. Platform + display-mode heuristic ───
            const isAndroid = typeof navigator !== 'undefined' &&
                /Android/i.test(navigator.userAgent || '');
            const isStandalonePWA = typeof window !== 'undefined' && (
                window.matchMedia?.('(display-mode: standalone)').matches ||
                window.navigator?.standalone === true
            );

            // ─── 4. Screen-vs-viewport delta — what shape of nav is in use? ───
            // In a standalone PWA on Android, `window.screen.height` is the
            // FULL screen including the system bars, while
            // `window.innerHeight` is just the area the app can draw into.
            // The difference is everything the OS is reserving for itself
            // (status bar on top + navigation area on bottom).
            //
            //   • Gesture nav phone:  status bar (~24px) only → delta ≈ 24
            //   • 3-button nav phone: status (~24) + nav (~48) → delta ≈ 72
            //
            // We use that delta to TELL THEM APART so we don't over-pad
            // gesture-nav phones AND don't under-pad 3-button phones.
            let screenDelta = 0;
            try {
                const scrH = window.screen?.height || 0;
                const winH = window.innerHeight || 0;
                if (scrH > 0 && winH > 0 && scrH > winH) {
                    screenDelta = scrH - winH;
                }
            } catch (e) {}

            // ─── Decide ───
            let resolved;
            if (safeArea > 0) {
                // Trusted safe-area report (iOS home indicator, gesture-nav
                // Android that reports the inset). Exact value + tiny buffer.
                resolved = safeArea + 4;
            } else if (overlap > 0) {
                // System UI is overlapping the viewport (rare) — clear it.
                resolved = overlap + 4;
            } else if (isAndroid) {
                // Gesture-nav Android without safe area reports (older Chrome).
                // Use a modest 16px buffer rather than trying to calculate 
                // screen deltas, which often double-pads 3-button navs.
                resolved = Math.max(minPx, 16);
            } else {
                // Desktop / iPad / older devices — minimum breathing room.
                resolved = minPx;
            }

            // Always honor the floor.
            resolved = Math.max(minPx, Math.round(resolved));
            setInset(resolved);
        };

        measure();

        // Subscribe to every event that could change the inset.
        window.addEventListener('resize', measure);
        window.addEventListener('orientationchange', measure);
        const vv = window.visualViewport;
        if (vv) {
            vv.addEventListener('resize', measure);
            vv.addEventListener('scroll', measure);
        }
        return () => {
            window.removeEventListener('resize', measure);
            window.removeEventListener('orientationchange', measure);
            if (vv) {
                vv.removeEventListener('resize', measure);
                vv.removeEventListener('scroll', measure);
            }
        };
    }, [minPx]);

    return inset;
};
