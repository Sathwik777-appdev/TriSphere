import { useState, useEffect } from 'react';

/**
 * Custom hook to detect screen size via media query
 * @param {string} query - Media query string (e.g., '(max-width: 768px)')
 * @returns {boolean} - True if query matches
 */
export const useMediaQuery = (query) => {
  // CRITICAL: read matchMedia synchronously in the initializer so the FIRST
  // render returns the correct value. The previous version defaulted to
  // `false` and only updated inside useEffect, which caused a one-frame
  // flash of the desktop dashboard before the mobile one swapped in.
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    try { return window.matchMedia(query).matches; } catch (e) { return false; }
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia(query);
    // Sync any change that may have happened between mount and effect-flush.
    setMatches(media.matches);
    const listener = (e) => setMatches(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
};

/**
 * Convenience hook for mobile detection
 * @returns {boolean} - True if screen width is <= 768px
 */
export const useIsMobile = () => {
  return useMediaQuery('(max-width: 768px)');
};
