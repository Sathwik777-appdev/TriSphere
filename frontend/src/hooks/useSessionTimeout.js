/**
 * Session Timeout Hook
 * Auto-logout after inactivity for security
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { logoutUser } from '../services/authService';
import { warningToast, infoToast } from '../utils/toast';

// Default timeout: 15 minutes (in milliseconds)
const DEFAULT_TIMEOUT = 15 * 60 * 1000;
// Warning before logout: 2 minutes
const WARNING_TIME = 2 * 60 * 1000;

export const useSessionTimeout = (timeoutMs = DEFAULT_TIMEOUT) => {
    const { user } = useAuth();
    const [lastActivity, setLastActivity] = useState(Date.now());
    const [showWarning, setShowWarning] = useState(false);
    const [timeLeft, setTimeLeft] = useState(timeoutMs);

    // Reset activity timer
    const resetTimer = useCallback(() => {
        setLastActivity(Date.now());
        setShowWarning(false);
        setTimeLeft(timeoutMs);
    }, [timeoutMs]);

    // Handle user activity
    useEffect(() => {
        if (!user) return;

        const activityEvents = [
            'mousedown',
            'mousemove',
            'keydown',
            'scroll',
            'touchstart',
            'click'
        ];

        const handleActivity = () => {
            resetTimer();
        };

        // Add event listeners
        activityEvents.forEach(event => {
            document.addEventListener(event, handleActivity, { passive: true });
        });

        return () => {
            activityEvents.forEach(event => {
                document.removeEventListener(event, handleActivity);
            });
        };
    }, [user, resetTimer]);

    // Check for timeout
    useEffect(() => {
        if (!user) return;

        const checkTimeout = () => {
            const now = Date.now();
            const timeSinceActivity = now - lastActivity;
            const remaining = timeoutMs - timeSinceActivity;

            setTimeLeft(Math.max(0, remaining));

            // Show warning before logout
            if (remaining <= WARNING_TIME && remaining > 0 && !showWarning) {
                setShowWarning(true);
                warningToast(`Session expiring in ${Math.ceil(remaining / 60000)} minutes. Move mouse to stay logged in.`);
            }

            // Auto-logout
            if (remaining <= 0) {
                infoToast('Session expired due to inactivity');
                logoutUser();
                window.location.href = '/login';
            }
        };

        const interval = setInterval(checkTimeout, 10000); // Check every 10 seconds

        return () => clearInterval(interval);
    }, [user, lastActivity, timeoutMs, showWarning]);

    return {
        timeLeft,
        showWarning,
        resetTimer,
        minutesLeft: Math.ceil(timeLeft / 60000)
    };
};

export default useSessionTimeout;
