import { useState, useRef, useCallback } from 'react';

/**
 * Custom hook for detecting swipe gestures
 * @param {Object} options - Configuration options
 * @param {Function} options.onSwipeLeft - Callback when swiping left
 * @param {Function} options.onSwipeRight - Callback when swiping right
 * @param {number} options.threshold - Minimum distance for swipe detection (default: 50px)
 */
export const useSwipeNavigation = ({
    onSwipeLeft,
    onSwipeRight,
    threshold = 50
} = {}) => {
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);
    const [isSwiping, setIsSwiping] = useState(false);

    const handleTouchStart = useCallback((e) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
        setIsSwiping(true);
    }, []);

    const handleTouchEnd = useCallback((e) => {
        if (!isSwiping) return;

        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;

        const diffX = touchEndX - touchStartX.current;
        const diffY = touchEndY - touchStartY.current;

        // Only trigger if horizontal swipe is greater than vertical (to avoid conflicts with scrolling)
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > threshold) {
            if (diffX > 0 && onSwipeRight) {
                onSwipeRight();
            } else if (diffX < 0 && onSwipeLeft) {
                onSwipeLeft();
            }
        }

        setIsSwiping(false);
    }, [isSwiping, onSwipeLeft, onSwipeRight, threshold]);

    const handleTouchMove = useCallback((e) => {
        // Optional: Add visual feedback during swipe
    }, []);

    const swipeHandlers = {
        onTouchStart: handleTouchStart,
        onTouchEnd: handleTouchEnd,
        onTouchMove: handleTouchMove,
    };

    return { swipeHandlers, isSwiping };
};

export default useSwipeNavigation;
