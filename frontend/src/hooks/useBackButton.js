import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { warningToast } from '../utils/toast';

/**
 * Android-style back button handling for both Native App (Capacitor) and PWA / browser.
 *
 * Goals:
 *   • Single back on a sub-route (e.g. /video-player, /simulation, /privacy) → behaves
 *     like a normal browser back: returns to the previous in-app page.
 *   • Single back on a "root" route (dashboards, landing, login) → does NOT
 *     close the app. Instead shows a toast: "Press back again to exit".
 *   • Second back within 2 seconds → exit the native app or close the window.
 */

const ROOT_PATHS = new Set([
  '/',
  '/login',
  '/dashboard/student',
  '/dashboard/teacher',
  '/dashboard/parent',
  '/dashboard/admin',
  '/dashboard/developer',
]);

const EXIT_WINDOW_MS = 2000;

const isRootPath = (path) => ROOT_PATHS.has(path);

export function useBackButton() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const lastBackRef = useRef(0);
  const armedPathRef = useRef(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // ─── NATIVE APP ENVIRONMENT (Capacitor Listener) ───
    const handleNativeBack = async () => {
      // 1. Check if there are active modals or tabs to close first
      if (window.activeModals && window.activeModals.length > 0) {
        const closeTopmostModal = window.activeModals.pop();
        if (closeTopmostModal) {
          closeTopmostModal();
          return;
        }
      }

      const currentPath = window.location.pathname;
      const now = Date.now();

      if (isRootPath(currentPath)) {
        const withinExitWindow = now - lastBackRef.current < EXIT_WINDOW_MS;
        if (withinExitWindow) {
          App.exitApp();
        } else {
          lastBackRef.current = now;
          warningToast('Press back again to exit');
        }
      } else {
        // If there is back history in the app, go back, otherwise go to home page
        if (window.history.state && typeof window.history.state.idx === 'number' && window.history.state.idx > 0) {
          navigate(-1);
        } else {
          navigate('/');
        }
      }
    };

    const backButtonListener = App.addListener('backButton', handleNativeBack);

    return () => {
      backButtonListener.then(listener => listener.remove());
    };
  }, [navigate]);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;

    // ─── BROWSER / PWA ENVIRONMENT (Popstate duplicate-history-trap) ───
    if (!isRootPath(pathname)) {
      armedPathRef.current = null;
      return;
    }

    // Push duplicate entry for root path
    if (armedPathRef.current !== pathname) {
      navigate(pathname);
      armedPathRef.current = pathname;
    }

    const onPopState = () => {
      // 1. Check if there are active modals or tabs to close first
      if (window.activeModals && window.activeModals.length > 0) {
        const closeTopmostModal = window.activeModals.pop();
        if (closeTopmostModal) {
          closeTopmostModal();
          // Push duplicate entry again so the browser history stack stays armed
          navigate(pathname);
          armedPathRef.current = pathname;
          return;
        }
      }

      const now = Date.now();
      const withinExitWindow = now - lastBackRef.current < EXIT_WINDOW_MS;

      if (withinExitWindow) {
        armedPathRef.current = null;
        try { window.close(); } catch (e) {}
        return;
      }

      lastBackRef.current = now;
      navigate(pathname);
      armedPathRef.current = pathname;
      warningToast('Press back again to exit');
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [pathname, navigate]);
}
