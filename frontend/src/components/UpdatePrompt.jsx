import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * UpdatePrompt — non-blocking "big update ready" toast.
 *
 * Mounts once at the app root. Listens for the `trisphere:update-available`
 * event dispatched from main.jsx when a service-worker update is detected
 * AND the new download size is over the 20 MB threshold (smaller updates
 * apply silently — see main.jsx for the size-aware logic).
 *
 * The toast offers two actions:
 *   • "Update now"  → invokes detail.apply() which posts SKIP_WAITING and
 *                     reloads (the user opted in, so a reload is fine).
 *   • "Later"       → dismisses the toast. The update will be picked up on
 *                     the next natural page load.
 */
export default function UpdatePrompt() {
    const [pending, setPending] = useState(null);
    // { mb: number, apply: () => void }

    useEffect(() => {
        const handler = (e) => {
            if (!e?.detail?.apply) return;
            setPending(e.detail);
        };
        window.addEventListener('trisphere:update-available', handler);
        return () => window.removeEventListener('trisphere:update-available', handler);
    }, []);

    const dismiss = () => setPending(null);
    const update = () => {
        try { pending?.apply?.(); } catch (e) { console.warn(e); }
    };

    return (
        <AnimatePresence>
            {pending && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ type: 'spring', damping: 24, stiffness: 240 }}
                    style={S.toast}
                    role="status"
                    aria-live="polite"
                >
                    <div style={S.iconWrap}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    </div>
                    <div style={S.body}>
                        <div style={S.title}>New update ready</div>
                        <div style={S.sub}>
                            A larger update is available ({pending.mb} MB). Update when you're ready.
                        </div>
                    </div>
                    <div style={S.actions}>
                        <button onClick={dismiss} style={S.btnGhost}>Later</button>
                        <button onClick={update} style={S.btnPrimary}>Update</button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

const S = {
    toast: {
        position: 'fixed',
        // Sits above the bottom-nav on the mobile dashboard but below the
        // floating mic. Safe-area inset for iOS home indicator devices.
        bottom: 'calc(110px + env(safe-area-inset-bottom, 0px))',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(94vw, 460px)',
        zIndex: 5000,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        background: 'linear-gradient(160deg, rgba(20, 30, 60, 0.92) 0%, rgba(12, 18, 38, 0.96) 100%)',
        border: '1px solid rgba(99, 102, 241, 0.32)',
        borderRadius: 16,
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        boxShadow:
            '0 1px 0 rgba(255,255,255,0.08) inset, ' +
            '0 16px 40px rgba(0,0,0,0.45), ' +
            '0 0 30px rgba(99,102,241,0.18)',
        color: '#f1f5f9',
        fontFamily: '"Inter","SF Pro Display","Google Sans",-apple-system,sans-serif',
    },
    iconWrap: {
        width: 36,
        height: 36,
        borderRadius: 11,
        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 0 14px rgba(139,92,246,0.45)',
    },
    body: { flex: 1, minWidth: 0 },
    title: {
        fontSize: 13.5,
        fontWeight: 700,
        color: '#fff',
        letterSpacing: '-0.005em',
    },
    sub: {
        fontSize: 11.5,
        color: 'rgba(255,255,255,0.62)',
        marginTop: 2,
        lineHeight: 1.4,
    },
    actions: {
        display: 'flex',
        gap: 6,
        flexShrink: 0,
    },
    btnGhost: {
        padding: '8px 12px',
        background: 'transparent',
        border: '1px solid rgba(255,255,255,0.14)',
        color: 'rgba(255,255,255,0.78)',
        fontSize: 12,
        fontWeight: 600,
        borderRadius: 10,
        cursor: 'pointer',
    },
    btnPrimary: {
        padding: '8px 14px',
        background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
        border: '1px solid rgba(255,255,255,0.18)',
        color: '#fff',
        fontSize: 12,
        fontWeight: 800,
        borderRadius: 10,
        cursor: 'pointer',
        boxShadow: '0 4px 14px rgba(99,102,241,0.45)',
    },
};
