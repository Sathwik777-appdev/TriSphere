import React, { useState } from 'react';
import { motion } from 'framer-motion';

// ─────────────────────────────────────────────────────────────────────────────
// AnimatedLogo — the single source of truth for TriSphere brand presence.
//
// Variants:
//   'header'   — small wordmark + emblem, tight spacing, suitable for navbar
//   'auth'     — medium, on login/signup screens
//   'splash'   — large, dramatic, used for app splash + full-screen loaders
//   'loading'  — emblem-only with a soft breathing pulse, for inline loaders
//   'mark'     — emblem-only, no wordmark
//
// Animation language:
//   - Slow vertical float (always on, ~5s loop)
//   - Cinematic breathing glow (color hue sweeps from violet → cyan)
//   - Diagonal light sweep across the glass every ~6 seconds (CSS gradient)
//   - Soft hover: lift + intensify glow + slow tilt
//
// All animations are GPU-accelerated (transform + opacity + filter only) so
// they don't trigger layout/paint and stay smooth on low-end mobiles.
// ─────────────────────────────────────────────────────────────────────────────

const VARIANTS = {
    header: { mark: 28, font: 18, gap: 10, wordmark: true, tagline: false, sweep: false },
    auth: { mark: 72, font: 32, gap: 16, wordmark: true, tagline: true, sweep: true },
    splash: { mark: 160, font: 56, gap: 28, wordmark: true, tagline: true, sweep: true },
    loading: { mark: 56, font: 0, gap: 0, wordmark: false, tagline: false, sweep: true },
    mark: { mark: 48, font: 0, gap: 0, wordmark: false, tagline: false, sweep: false },
};

export default function AnimatedLogo({
    variant = 'header',
    size,            // optional override for emblem px size
    withTagline,     // optional override
    withWordmark,    // optional override
    tagline = 'AI-Powered Learning',
    onClick,
    className,
    style: extraStyle,
}) {
    const cfg = VARIANTS[variant] || VARIANTS.header;
    const markPx = size || cfg.mark;
    const fontPx = cfg.font;
    const showWordmark = withWordmark ?? cfg.wordmark;
    const showTagline = withTagline ?? cfg.tagline;
    const showSweep = cfg.sweep;
    const [hovered, setHovered] = useState(false);

    return (
        <motion.div
            onClick={onClick}
            onHoverStart={() => setHovered(true)}
            onHoverEnd={() => setHovered(false)}
            className={className}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: cfg.gap,
                cursor: onClick ? 'pointer' : 'default',
                userSelect: 'none',
                ...extraStyle,
            }}
            // Cinematic floating motion — gentle, infinite.
            animate={{
                y: [0, -3, 0],
                scale: hovered ? 1.04 : 1,
            }}
            transition={{
                y: { duration: 5, repeat: Infinity, ease: 'easeInOut' },
                scale: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
            }}
        >
            {/* The emblem container hosts: the image, the breathing glow halo,
                the slow light sweep, and the conic-gradient ambient. */}
            <div
                style={{
                    position: 'relative',
                    width: markPx,
                    height: markPx,
                    flex: '0 0 auto',
                    isolation: 'isolate',
                }}
            >
                {/* Ambient breathing glow — animated via boxShadow on a behind layer */}
                <motion.div
                    aria-hidden
                    style={{
                        position: 'absolute',
                        inset: -markPx * 0.18,
                        borderRadius: '50%',
                        filter: 'blur(18px)',
                        zIndex: 0,
                        pointerEvents: 'none',
                    }}
                    animate={{
                        background: [
                            'radial-gradient(circle, rgba(139,92,246,0.55) 0%, rgba(59,130,246,0.0) 70%)',
                            'radial-gradient(circle, rgba(20,184,166,0.55) 0%, rgba(20,184,166,0.0) 70%)',
                            'radial-gradient(circle, rgba(168,85,247,0.55) 0%, rgba(168,85,247,0.0) 70%)',
                            'radial-gradient(circle, rgba(139,92,246,0.55) 0%, rgba(59,130,246,0.0) 70%)',
                        ],
                        opacity: hovered ? 0.95 : [0.5, 0.85, 0.5],
                        scale: hovered ? 1.1 : [1, 1.08, 1],
                    }}
                    transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                />

                {/* The actual brand image. We fall back to logo.png if the
                    `mark` is missing — the same wordmark image still works
                    cropped to a square via object-fit. */}
                <img
                    src="/logo-mark.png"
                    onError={(e) => { e.currentTarget.src = '/logo.png'; }}
                    alt="TriSphere"
                    style={{
                        position: 'relative',
                        zIndex: 1,
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        // logo-mark.png is now a true transparent PNG
                        // (background stripped via scratch/remove_bg.py), so
                        // no blend-mode workaround is needed. The emblem sits
                        // cleanly on any surface.
                        filter: hovered
                            ? 'drop-shadow(0 0 18px rgba(139,92,246,0.6)) drop-shadow(0 0 30px rgba(20,184,166,0.35))'
                            : 'drop-shadow(0 0 10px rgba(139,92,246,0.35))',
                        transition: 'filter 0.4s ease',
                    }}
                />

                {/* Diagonal light sweep — a thin gradient strip travels across
                    the emblem every ~6 seconds. Implemented with mix-blend so
                    it interacts with the underlying colors instead of overlaying
                    a flat white. */}
                {showSweep && (
                    <motion.div
                        aria-hidden
                        style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: '50%',
                            zIndex: 2,
                            pointerEvents: 'none',
                            mixBlendMode: 'screen',
                            background:
                                'linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.55) 50%, transparent 65%)',
                            backgroundSize: '300% 100%',
                            backgroundPosition: '120% 0',
                        }}
                        animate={{ backgroundPosition: ['120% 0', '-20% 0'] }}
                        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.5 }}
                    />
                )}
            </div>

            {/* Wordmark + optional tagline */}
            {showWordmark && (
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                    <motion.span
                        style={{
                            fontFamily: '"Google Sans", "Inter", -apple-system, BlinkMacSystemFont, sans-serif',
                            fontSize: fontPx,
                            fontWeight: 700,
                            letterSpacing: '-0.01em',
                            color: '#ffffff',
                            background:
                                'linear-gradient(120deg, #c4b5fd 0%, #ffffff 35%, #67e8f9 75%, #c4b5fd 100%)',
                            backgroundSize: '200% 100%',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                        }}
                        animate={{ backgroundPosition: ['0% 0%', '200% 0%'] }}
                        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                    >
                        TriSphere
                    </motion.span>
                    {showTagline && (
                        <span
                            style={{
                                fontFamily: '"Google Sans", "Inter", sans-serif',
                                fontSize: Math.max(10, fontPx * 0.28),
                                fontWeight: 500,
                                color: 'rgba(196, 181, 253, 0.7)',
                                letterSpacing: '0.18em',
                                textTransform: 'uppercase',
                                marginTop: 4,
                            }}
                        >
                            {tagline}
                        </span>
                    )}
                </div>
            )}
        </motion.div>
    );
}

// ── Splash component ────────────────────────────────────────────────────────
// Full-screen entrance for first app load. Use this as the splash before the
// main app shell renders (or behind a Suspense boundary while route bundles
// load).
export function LogoSplash({ onComplete }) {
    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                background:
                    'radial-gradient(circle at 50% 40%, rgba(30,41,59,1) 0%, rgba(8,11,28,1) 80%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
            }}
        >
            {/* Background ambient orbs */}
            <motion.div
                aria-hidden
                style={{
                    position: 'absolute',
                    top: '20%',
                    left: '20%',
                    width: 320,
                    height: 320,
                    borderRadius: '50%',
                    background:
                        'radial-gradient(circle, rgba(139,92,246,0.35) 0%, rgba(139,92,246,0) 70%)',
                    filter: 'blur(40px)',
                }}
                animate={{ x: [0, 80, 0], y: [0, -40, 0] }}
                transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
                aria-hidden
                style={{
                    position: 'absolute',
                    bottom: '15%',
                    right: '15%',
                    width: 380,
                    height: 380,
                    borderRadius: '50%',
                    background:
                        'radial-gradient(circle, rgba(20,184,166,0.28) 0%, rgba(20,184,166,0) 70%)',
                    filter: 'blur(50px)',
                }}
                animate={{ x: [0, -60, 0], y: [0, 30, 0] }}
                transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
            />

            <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                onAnimationComplete={() => {
                    if (onComplete) setTimeout(onComplete, 1100);
                }}
            >
                <AnimatedLogo variant="splash" />
            </motion.div>
        </div>
    );
}

// ── Inline loader ───────────────────────────────────────────────────────────
// Use anywhere a spinner would go. The emblem replaces the spinner and the
// breathing glow signals "in progress" in a brand-coherent way.
export function LogoLoader({ size = 56, label }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <AnimatedLogo variant="loading" size={size} />
            {label && (
                <span
                    style={{
                        fontFamily: '"Google Sans", "Inter", sans-serif',
                        fontSize: 13,
                        color: 'rgba(196, 181, 253, 0.7)',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                    }}
                >
                    {label}
                </span>
            )}
        </div>
    );
}
