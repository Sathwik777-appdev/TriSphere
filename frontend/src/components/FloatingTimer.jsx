import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTimer, formatSeconds } from '../context/TimerContext';

/**
 * FloatingTimer — clean compact Pomodoro widget. Sits top-right by
 * default, drag anywhere, tap to pause/resume, dismiss with the × icon.
 *
 * Design: Apple Dynamic Island-style pill — solid dark surface for
 * contrast against ANY dashboard background, phase-coloured 3px left
 * accent rail, and a tiny phase dot. No blurry gradients, no oversized
 * halos. Reads cleanly at a glance.
 */
export default function FloatingTimer() {
    const {
        phase, secondsLeft, isRunning, showFloating,
        pause, resume, dismissFloating,
    } = useTimer();

    const [pos, setPos] = useState(() => {
        try {
            const raw = sessionStorage.getItem('floating_timer_pos');
            if (raw) return JSON.parse(raw);
        } catch (e) {}
        return null;
    });

    // Default position = top-right corner with 12px gutter.
    useEffect(() => {
        if (!pos && typeof window !== 'undefined') {
            const x = Math.max(0, window.innerWidth - 174);
            const y = 60;
            setPos({ x, y });
        }
    }, [pos]);

    const handleDragEnd = (_, info) => {
        const next = {
            x: Math.max(8, Math.min(window.innerWidth - 174, (pos?.x || 0) + info.offset.x)),
            y: Math.max(8, Math.min(window.innerHeight - 80, (pos?.y || 0) + info.offset.y)),
        };
        setPos(next);
        try { sessionStorage.setItem('floating_timer_pos', JSON.stringify(next)); } catch (e) {}
    };

    if (!showFloating) return null;
    if (phase === 'idle' && !isRunning) return null;

    const isFocus = phase === 'focus';
    const isBreak = phase === 'break';
    const isPaused = !isRunning && phase !== 'idle';

    // Per-phase accent — used for the left rail, dot, and play button.
    const accent = isBreak ? '#34d399' : isPaused ? '#fb7185' : '#a78bfa';
    const phaseLabel = isPaused ? 'Paused' : isBreak ? 'Break' : 'Focus';

    return (
        <AnimatePresence>
            {showFloating && pos && (
                <motion.div
                    drag
                    dragMomentum={false}
                    dragElastic={0.04}
                    dragConstraints={{
                        left: 8 - (pos?.x || 0),
                        right: window.innerWidth - 174 - (pos?.x || 0),
                        top: 8 - (pos?.y || 0),
                        bottom: window.innerHeight - 80 - (pos?.y || 0),
                    }}
                    onDragEnd={handleDragEnd}
                    initial={{ opacity: 0, scale: 0.9, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -6 }}
                    transition={{ type: 'spring', damping: 24, stiffness: 280 }}
                    style={{
                        ...S.widget,
                        top: pos.y,
                        left: pos.x,
                        borderLeftColor: accent,
                        boxShadow:
                            // Clean drop shadow + a soft phase glow that doesn't bleed
                            '0 6px 18px rgba(0, 0, 0, 0.55), ' +
                            `0 0 0 1px ${accent}33, ` +
                            `0 0 18px ${accent}40`,
                    }}
                >
                    {/* Row 1: phase pill + dismiss */}
                    <div style={S.headerRow}>
                        <span style={S.phasePill}>
                            <span
                                style={{
                                    ...S.phaseDot,
                                    background: accent,
                                    boxShadow: isRunning ? `0 0 8px ${accent}` : 'none',
                                    animation: isRunning ? 'ftPulse 1.4s ease-in-out infinite' : 'none',
                                }}
                            />
                            <span style={{ ...S.phaseLabel, color: accent }}>{phaseLabel}</span>
                        </span>
                        <button
                            onClick={dismissFloating}
                            className="ft-dismiss"
                            aria-label="Hide timer"
                            style={S.dismissBtn}
                        >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                                <line x1="6" y1="6" x2="18" y2="18" />
                                <line x1="6" y1="18" x2="18" y2="6" />
                            </svg>
                        </button>
                    </div>

                    {/* Row 2: time + play/pause */}
                    <div style={S.bodyRow}>
                        <span style={S.timeText}>{formatSeconds(secondsLeft)}</span>
                        <button
                            onClick={isRunning ? pause : resume}
                            className="ft-toggle"
                            aria-label={isRunning ? 'Pause' : 'Resume'}
                            style={{ ...S.playBtn, background: accent, color: '#0a0a0a' }}
                        >
                            {isRunning ? (
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                                    <rect x="6" y="5" width="4" height="14" rx="1" />
                                    <rect x="14" y="5" width="4" height="14" rx="1" />
                                </svg>
                            ) : (
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                                    <polygon points="6,3 20,12 6,21" />
                                </svg>
                            )}
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

const FONT = '"Inter","SF Pro Display","Google Sans",sans-serif';

const S = {
    widget: {
        position: 'fixed',
        width: 164,
        zIndex: 4000,
        padding: '10px 12px 11px 14px',
        // Solid dark surface — contrast against any dashboard background
        background: '#15172a',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderLeftWidth: 3,
        borderLeftStyle: 'solid',
        borderRadius: 14,
        color: '#fff',
        fontFamily: FONT,
        cursor: 'grab',
        userSelect: 'none',
        touchAction: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
    },
    headerRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    phasePill: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
    },
    phaseDot: {
        width: 6,
        height: 6,
        borderRadius: '50%',
        display: 'inline-block',
        flexShrink: 0,
    },
    phaseLabel: {
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        fontFamily: FONT,
    },
    dismissBtn: {
        width: 20,
        height: 20,
        borderRadius: '50%',
        background: 'rgba(255, 255, 255, 0.06)',
        border: '1px solid rgba(255, 255, 255, 0.10)',
        color: 'rgba(255, 255, 255, 0.65)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        flexShrink: 0,
    },
    bodyRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
    },
    timeText: {
        fontSize: 24,
        fontWeight: 800,
        letterSpacing: '-0.02em',
        lineHeight: 1,
        color: '#fff',
        fontVariantNumeric: 'tabular-nums',
        fontFamily: FONT,
    },
    playBtn: {
        width: 30,
        height: 30,
        borderRadius: '50%',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        cursor: 'pointer',
        padding: 0,
        boxShadow: '0 2px 6px rgba(0,0,0,0.30), 0 1px 0 rgba(255,255,255,0.20) inset',
    },
};

// Inject keyframes + defeat the global cosmic-gradient button rules.
if (typeof document !== 'undefined' && !document.getElementById('ft-kf')) {
    const style = document.createElement('style');
    style.id = 'ft-kf';
    style.textContent = `
        @keyframes ftPulse {
            0%, 100% { opacity: 0.55; transform: scale(1); }
            50%      { opacity: 1;    transform: scale(1.3); }
        }
        /* Defeat the global mobile/theme button rules — these would
           otherwise paint a cosmic gradient over our clean buttons. */
        body .ft-dismiss,
        body .ft-toggle,
        body.standard-theme .ft-dismiss,
        body.standard-theme .ft-toggle,
        body.dark-theme .ft-dismiss,
        body.dark-theme .ft-toggle {
            background-image: none !important;
            border-radius: 50% !important;
            padding: 0 !important;
            min-height: 0 !important;
            font-weight: inherit !important;
            transform: none !important;
            box-shadow: none !important;
        }
        body .ft-dismiss {
            width: 20px !important;
            height: 20px !important;
            min-width: 20px !important;
            background: rgba(255,255,255,0.06) !important;
            border: 1px solid rgba(255,255,255,0.10) !important;
        }
        body .ft-toggle {
            width: 30px !important;
            height: 30px !important;
            min-width: 30px !important;
            border: none !important;
        }
    `;
    document.head.appendChild(style);
}
