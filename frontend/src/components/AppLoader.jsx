import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import './AppLoader.css';

// Build-time constants injected by Vite (see vite.config.js `define`).
// __APP_VERSION__ is the same string baked into the service worker, so the
// version shown on the splash always matches the running app.
const APP_VERSION =
    (typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__) || 'dev';
const APP_BUILT_AT =
    (typeof __APP_BUILT_AT__ !== 'undefined' && __APP_BUILT_AT__) || '';

// Pretty version string for the loader footer.
// Example: "v1.0.0 · build 8799 · 16 May 2026"
//   - "1.0.0" comes from package.json
//   - "build 8799" is the last 4 digits of the build timestamp — short
//     enough to read at a glance, unique within any reasonable deploy
//     cadence (collisions only happen if you redeploy within a few
//     minutes, in which case the date stamp differentiates them too)
//   - the date is the build date, not today, so it tells the student
//     exactly how fresh the app they're running is.
const formatVersion = () => {
    const APP_NUM = '1.0.0'; // mirrors package.json — update there & here when you bump
    const buildShort = APP_VERSION.replace(/^v-/, '').slice(-4) || '----';
    let dateStr = '';
    try {
        if (APP_BUILT_AT) {
            const d = new Date(APP_BUILT_AT);
            dateStr = d.toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
            });
        }
    } catch (e) { /* ignore */ }
    return dateStr
        ? `v${APP_NUM} · build ${buildShort} · ${dateStr}`
        : `v${APP_NUM} · build ${buildShort}`;
};

/**
 * Premium App Loading Animation — first-impression cinematic experience.
 *
 * Layered design (back to front):
 *   1. Deep gradient background + drifting aurora orbs + dot grid
 *   2. Conic-gradient halo rotating around the logo (signature element)
 *   3. Vertical "data stream" lines flowing into the logo
 *   4. HUD corner brackets framing the emblem like a sci-fi targeting reticle
 *   5. Light rays + orbital particles + shooting stars + sparkles
 *   6. The logo itself — sharp from frame 1, with holographic shimmer
 *   7. Shimmering progress bar with stage messages that morph through
 *      INITIALIZING → CALIBRATING → CONNECTING → READY across the duration
 *
 * All animations are GPU-accelerated (transform / opacity / filter only).
 */

// Stage messages that progress across the splash duration. Each takes ~25%
// of the total time, giving the loader a sense of forward motion instead of
// feeling like it's just sitting there.
const STAGES = [
    'Initializing AI core',
    'Calibrating learning models',
    'Connecting your dashboard',
    'Almost ready',
];

const AppLoader = ({ message, duration = 5000 }) => {
    const [stageIndex, setStageIndex] = useState(0);

    useEffect(() => {
        // Advance through stages so each takes an equal slice of duration.
        const slice = duration / STAGES.length;
        const id = setInterval(() => {
            setStageIndex((i) => (i < STAGES.length - 1 ? i + 1 : i));
        }, slice);
        return () => clearInterval(id);
    }, [duration]);

    const currentMessage = message || STAGES[stageIndex];
    return (
        <div className="app-loader-container">
            <style>
                {`
                @keyframes loadingFill {
                    from { width: 0%; }
                    to { width: 100%; }
                }
                @keyframes shimmerSweep {
                    from { transform: translateX(-120%); }
                    to { transform: translateX(220%); }
                }
                `}
            </style>

            {/* Photorealistic ambient layer — three softly drifting aurora
                orbs paint the dark canvas with depth. No grids, no streams,
                no game-y artifacts. Restraint is the brief. */}
            <div className="app-loader-aurora">
                <div className="aurora-orb aurora-violet" />
                <div className="aurora-orb aurora-teal" />
                <div className="aurora-orb aurora-blue" />
            </div>

            {/* Subtle floating motes — much fewer and softer than before. */}
            <div className="app-loader-particles">
                {[...Array(10)].map((_, i) => (
                    <div key={i} className="particle" style={{
                        '--delay': `${Math.random() * 6}s`,
                        '--x': `${Math.random() * 100}%`,
                        '--duration': `${7 + Math.random() * 4}s`,
                        '--size': `${1.5 + Math.random() * 2}px`,
                    }} />
                ))}
            </div>

            {/* Center vignette glow — focal point pull. */}
            <div className="app-loader-vignette" />

            {/* Layout spacer for balanced flex layout (prevents overlap with footer) */}
            <div className="app-loader-top-spacer" />

            {/* Main loader content */}
            <div className="app-loader-content">
                <div className="app-loader-logo-container">
                    {/* Single soft conic halo — heavily blurred so it reads as
                        ambient light, not as a visible ring. The hint of the
                        OpenAI / Apple Intelligence aesthetic without copying it. */}
                    <div className="app-loader-conic" />

                    {/* Loading-screen-only logo asset (different from /logo.png
                        which is the wordmark used in nav/auth surfaces).
                        Calm entrance — soft fade-in + tiny lift, no flip, no
                        rotate, no blur. Premium = restraint. */}
                    <motion.img
                        src="/loading-logo.png"
                        alt="TriSphere"
                        className="app-loader-logo"
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                    />
                </div>

                {/* Shimmering progress bar — fills smoothly while a sheen
                    sweeps left-to-right repeatedly. */}
                <motion.div
                    className="app-loader-bar-container"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.25, ease: 'easeOut' }}
                >
                    <div
                        className="app-loader-bar"
                        style={{
                            animation: `loadingFill ${duration}ms linear forwards`,
                            width: '0'
                        }}
                    >
                        <span className="bar-shimmer" />
                    </div>
                </motion.div>

                {/* Stage message that morphs through INITIALIZING →
                    CALIBRATING → CONNECTING → READY. AnimatePresence
                    crossfades each transition so it feels alive, not just
                    a string swap. */}
                <div className="app-loader-message-wrap">
                    <AnimatePresence mode="wait">
                        <motion.p
                            key={currentMessage}
                            className="app-loader-message"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.4, ease: 'easeOut' }}
                        >
                            {currentMessage}
                        </motion.p>
                    </AnimatePresence>
                </div>

                {/* Tagline reveals last — small, uppercase, letter-spaced. */}
                <motion.div
                    className="app-loader-tagline"
                    initial={{ opacity: 0, letterSpacing: '0em' }}
                    animate={{ opacity: 1, letterSpacing: '0.4em' }}
                    transition={{ duration: 0.9, delay: 0.3, ease: 'easeOut' }}
                >
                    AI&nbsp;·&nbsp;LEARN&nbsp;·&nbsp;GROW
                </motion.div>
            </div>

            <div className="app-loader-footer">
                <span className="app-loader-powered">Powered by</span>
                <div className="app-loader-brand-container">
                    <img
                        src="/yugnext-logo.png"
                        alt="Yugnext-AI"
                        className="app-loader-brand-logo"
                    />
                    <span className="app-loader-brand">Yugnext-AI</span>
                </div>
                <div style={{ marginTop: '20px' }}>
                    <div style={{ marginBottom: '15px' }}>
                        <a 
                            href="https://www.yugnext-ai.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="app-loader-link"
                            style={{ padding: '10px' }}
                            onClick={async (e) => {
                                e.preventDefault();
                                if (Capacitor.isNativePlatform()) {
                                    await Browser.open({ url: "https://www.yugnext-ai.com" });
                                } else {
                                    window.open("https://www.yugnext-ai.com", "_blank");
                                }
                            }}
                        >
                            Visit: www.yugnext-ai.com
                        </a>
                    </div>
                    <div>
                        <a href="mailto:contact@yugnext-ai.com" className="app-loader-link" style={{ padding: '10px' }}>
                            Contact: contact@yugnext-ai.com
                        </a>
                    </div>
                </div>

                {/* Build version stamp — matches the SW cache version, so
                    students can quote it when reporting bugs. */}
                <div className="app-loader-version" title={APP_VERSION}>
                    {formatVersion()}
                </div>
            </div>
        </div>
    );
};

export default AppLoader;
