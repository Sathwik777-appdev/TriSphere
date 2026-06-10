import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';

/**
 * TimerContext — global Pomodoro study timer state.
 *
 * Why a context (and not local state inside ToolsPanel):
 *   The student starts a 25-min focus session in Tools, then navigates to
 *   Home / Learn / Lernix to keep studying. The timer has to keep ticking
 *   regardless of which tab they're on, and a small floating clock widget
 *   (rendered at the dashboard root) needs to read the same state.
 *
 * Phases:
 *   idle  → nothing running, widget hidden
 *   focus → 25-min countdown
 *   break → 5-min countdown (auto-starts after a focus session completes)
 *
 * Actions:
 *   startFocus / startBreak / pause / resume / reset / dismissFloating
 *
 * The widget visibility is independent of the timer running — dismissing
 * the floating clock with the `–` button only hides it; the timer keeps
 * ticking in the background. Re-opening Tools shows it again.
 */

const FOCUS_MIN_DEFAULT = 25;
const BREAK_MIN_DEFAULT = 5;

const TimerContext = createContext(null);

export const TimerProvider = ({ children }) => {
    // 'idle' | 'focus' | 'break'
    const [phase, setPhase] = useState('idle');
    const [secondsLeft, setSecondsLeft] = useState(FOCUS_MIN_DEFAULT * 60);
    const [isRunning, setIsRunning] = useState(false);
    const [showFloating, setShowFloating] = useState(true);
    // Configurable durations so a "Settings" panel could change them later
    const [focusMin, setFocusMin] = useState(FOCUS_MIN_DEFAULT);
    const [breakMin, setBreakMin] = useState(BREAK_MIN_DEFAULT);

    // Use a ref + setInterval rather than putting `secondsLeft` in the
    // interval closure — keeps drift minimal and survives re-renders.
    const tickRef = useRef(null);

    useEffect(() => {
        if (!isRunning) {
            if (tickRef.current) {
                clearInterval(tickRef.current);
                tickRef.current = null;
            }
            return;
        }
        tickRef.current = setInterval(() => {
            setSecondsLeft(prev => {
                if (prev <= 1) {
                    // End of phase — auto-advance
                    setIsRunning(false);
                    // Notify by vibration + (best-effort) audio. Browsers ignore
                    // if these aren't permitted; that's fine.
                    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) {}
                    // Schedule auto-phase-switch on next tick so React processes
                    // the previous setIsRunning(false) first.
                    setTimeout(() => {
                        setPhase(prevPhase => {
                            if (prevPhase === 'focus') {
                                setSecondsLeft(breakMin * 60);
                                setIsRunning(true);
                                return 'break';
                            }
                            // After break, return to idle (don't auto-start another focus)
                            setSecondsLeft(focusMin * 60);
                            setIsRunning(false);
                            return 'idle';
                        });
                    }, 0);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => {
            if (tickRef.current) {
                clearInterval(tickRef.current);
                tickRef.current = null;
            }
        };
    }, [isRunning, focusMin, breakMin]);

    const startFocus = useCallback((minutes) => {
        const m = typeof minutes === 'number' && minutes > 0 ? minutes : focusMin;
        setPhase('focus');
        setSecondsLeft(m * 60);
        setIsRunning(true);
        setShowFloating(true);
    }, [focusMin]);

    const startBreak = useCallback((minutes) => {
        const m = typeof minutes === 'number' && minutes > 0 ? minutes : breakMin;
        setPhase('break');
        setSecondsLeft(m * 60);
        setIsRunning(true);
        setShowFloating(true);
    }, [breakMin]);

    const pause = useCallback(() => setIsRunning(false), []);
    const resume = useCallback(() => {
        if (phase === 'idle' || secondsLeft <= 0) {
            startFocus();
        } else {
            setIsRunning(true);
        }
    }, [phase, secondsLeft, startFocus]);

    const reset = useCallback(() => {
        setIsRunning(false);
        setPhase('idle');
        setSecondsLeft(focusMin * 60);
    }, [focusMin]);

    const dismissFloating = useCallback(() => setShowFloating(false), []);
    const showFloatingWidget = useCallback(() => setShowFloating(true), []);

    const value = {
        phase, secondsLeft, isRunning, showFloating, focusMin, breakMin,
        startFocus, startBreak, pause, resume, reset,
        dismissFloating, showFloatingWidget,
        setFocusMin, setBreakMin,
    };

    return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
};

export const useTimer = () => {
    const ctx = useContext(TimerContext);
    if (!ctx) {
        // Fallback for components that mount outside the provider — they
        // get a no-op stub so they don't crash.
        return {
            phase: 'idle', secondsLeft: 0, isRunning: false, showFloating: false,
            focusMin: FOCUS_MIN_DEFAULT, breakMin: BREAK_MIN_DEFAULT,
            startFocus: () => {}, startBreak: () => {},
            pause: () => {}, resume: () => {}, reset: () => {},
            dismissFloating: () => {}, showFloatingWidget: () => {},
            setFocusMin: () => {}, setBreakMin: () => {},
        };
    }
    return ctx;
};

// Helper — "25:00" formatter
export const formatSeconds = (s) => {
    const total = Math.max(0, Math.floor(s));
    const m = Math.floor(total / 60);
    const sec = total % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

export default TimerContext;
