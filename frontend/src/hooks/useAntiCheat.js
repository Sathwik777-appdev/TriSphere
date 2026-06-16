import { useEffect, useRef, useState } from 'react';
import { App } from '@capacitor/app';
import { PrivacyScreen } from '@capacitor/privacy-screen';
import { logError } from '../services/errorLogger';

export const useAntiCheat = ({
  mode,
  testStarted,
  showResults,
  selectedQuiz,
  saveMalpracticeRecord,
  banQuizForUser,
}) => {
  const [cheatingDetected, setCheatingDetected] = useState(false);
  const [violationCount, setViolationCount] = useState(0);

  // Refs for tracking unmount during test inside event listeners
  const testStartedRef = useRef(false);
  const showResultsRef = useRef(false);
  const cheatingDetectedRef = useRef(false);
  const selectedQuizRef = useRef(null);

  useEffect(() => { testStartedRef.current = testStarted; }, [testStarted]);
  useEffect(() => { showResultsRef.current = showResults; }, [showResults]);
  useEffect(() => { cheatingDetectedRef.current = cheatingDetected; }, [cheatingDetected]);
  useEffect(() => { selectedQuizRef.current = selectedQuiz; }, [selectedQuiz]);

  // Anti-cheating: Hardware-level Screenshot/Screen Recording Blocker (Capacitor Privacy Screen)
  useEffect(() => {
    const applyPrivacyScreen = async () => {
      try {
        if (mode === 'test' && testStarted && !showResults && !cheatingDetected) {
          await PrivacyScreen.enable();
        } else {
          await PrivacyScreen.disable();
        }
      } catch (err) {
        console.warn('PrivacyScreen not available (likely running on web):', err);
      }
    };

    applyPrivacyScreen();

    // Ensure we disable it when component unmounts or mode changes
    return () => {
      PrivacyScreen.disable().catch(() => {});
    };
  }, [mode, testStarted, showResults, cheatingDetected]);

  // Anti-cheating detection for test mode
  useEffect(() => {
    if (mode === 'test' && testStarted && !showResults && !cheatingDetected) {
      let violations = 0;
      let blurTimeout = null;
      let appStateListener = null;

      // Detect Split Screen, Google Circle to Search, and Backgrounding
      const setupAppStateListener = async () => {
        appStateListener = await App.addListener('appStateChange', async ({ isActive }) => {
          if (!isActive && testStartedRef.current && !showResultsRef.current && !cheatingDetectedRef.current) {
            console.warn('⚠️ Cheating detected: App moved to background');
            setCheatingDetected(true);
            cheatingDetectedRef.current = true;
            
            const reason = 'App moved to background (Split screen, Circle to Search, or Home button)';
            try {
              await saveMalpracticeRecord(reason, selectedQuizRef.current);
              if (selectedQuizRef.current?.id) {
                await banQuizForUser(selectedQuizRef.current.id);
              }
            } catch (err) {
              logError(err, 'useAntiCheat.appStateChange');
            }
            alert('⚠️ Malpractice Detected!\n\nYou moved the app to the background during the test.\n\nYour test has been terminated and marked as invalid.\n\n⛔ You are now PERMANENTLY BANNED from taking this quiz again!');
          }
        });
      };
      
      // Only attach App listener if we are running in Capacitor (native)
      if (window.Capacitor?.isNative) {
        setupAppStateListener();
      }

      // Detect tab/window switch (visibility change) - Most reliable method
      const handleVisibilityChange = async () => {
        if (document.hidden) {
          violations++;
          setViolationCount(prev => prev + 1);
          console.warn('⚠️ Cheating detected: Tab switched or minimized');

          setCheatingDetected(true);

          const reason = 'Switched tabs or minimized window during test';
          try {
            await saveMalpracticeRecord(reason, selectedQuizRef.current);
            if (selectedQuizRef.current?.id) {
              await banQuizForUser(selectedQuizRef.current.id);
            }
          } catch (err) {
            logError(err, 'useAntiCheat.visibilitychange');
          }

          alert('⚠️ Malpractice Detected!\n\nYou exited, switched apps, or minimized the app during the test.\n\nYour test has been terminated and marked as invalid.\n\n⛔ You are now PERMANENTLY BANNED from taking this quiz again!');
        }
      };

      // Detect when user tries to leave the page
      const handleBeforeUnload = (e) => {
        e.preventDefault();
        e.returnValue = 'You are in the middle of a test. Are you sure you want to leave?';
        return e.returnValue;
      };

      // Detect focus loss with delay to avoid false positives from alerts/browser UI
      const handleBlur = () => {
        blurTimeout = setTimeout(async () => {
          if (!document.hasFocus() && !document.hidden) {
            violations++;
            setViolationCount(prev => prev + 1);
            console.warn('⚠️ Cheating detected: Window lost focus for extended period');

            setCheatingDetected(true);

            const reason = 'Switched to another application during test';
            try {
              await saveMalpracticeRecord(reason, selectedQuizRef.current);
              if (selectedQuizRef.current?.id) {
                await banQuizForUser(selectedQuizRef.current.id);
              }
            } catch (err) {
              logError(err, 'useAntiCheat.blur');
            }

            alert('⚠️ Malpractice Detected!\n\nYou switched to another application during the test.\n\nYour test has been terminated and marked as invalid.\n\n⛔ You are now PERMANENTLY BANNED from taking this quiz again!');
          }
        }, 2000);
      };

      const handleFocus = () => {
        if (blurTimeout) {
          clearTimeout(blurTimeout);
          blurTimeout = null;
        }
      };

      // Detect long-press/right-click context menu (prevent copying)
      const handleContextMenu = (e) => {
        e.preventDefault();
        alert('Context menu is disabled during the test.');
      };

      // Detect copy/paste attempts
      const handleCopy = async (e) => {
        e.preventDefault();
        violations++;
        setViolationCount(prev => prev + 1);
        setCheatingDetected(true);

        const reason = 'Attempted to copy content (Ctrl+C) during test';
        try {
          await saveMalpracticeRecord(reason, selectedQuizRef.current);
          if (selectedQuizRef.current?.id) {
            await banQuizForUser(selectedQuizRef.current.id);
          }
        } catch (err) {
          logError(err, 'useAntiCheat.copy');
        }

        alert('⚠️ Malpractice Detected!\n\nYou attempted to copy content during the test.\n\nYour test has been terminated and marked as invalid.\n\n⛔ You are now PERMANENTLY BANNED from taking this quiz again!');
      };

      // Detect screenshot attempts (various methods)
      const handleKeyDown = async (e) => {
        if (
          e.key === 'PrintScreen' ||
          (e.key === 'Print') ||
          (e.metaKey && e.shiftKey && e.key === 's') ||
          (e.metaKey && e.shiftKey && e.key === 'S')
        ) {
          e.preventDefault();
          violations++;
          setViolationCount(prev => prev + 1);
          setCheatingDetected(true);

          const reason = 'Attempted to take screenshot during test';
          try {
            await saveMalpracticeRecord(reason, selectedQuizRef.current);
            if (selectedQuizRef.current?.id) {
              await banQuizForUser(selectedQuizRef.current.id);
            }
          } catch (err) {
            logError(err, 'useAntiCheat.screenshot');
          }

          alert('⚠️ Malpractice Detected!\n\nYou attempted to take a screenshot during the test.\n\nYour test has been terminated and marked as invalid.\n\n⛔ You are now PERMANENTLY BANNED from taking this quiz again!');
        }
      };

      // Detect back button
      const handlePopState = async (e) => {
        e.preventDefault();
        violations++;
        setViolationCount(prev => prev + 1);
        setCheatingDetected(true);

        const reason = 'Attempted to navigate back during test';
        try {
          await saveMalpracticeRecord(reason, selectedQuizRef.current);
          if (selectedQuizRef.current?.id) {
            await banQuizForUser(selectedQuizRef.current.id);
          }
        } catch (err) {
          logError(err, 'useAntiCheat.popstate');
        }

        alert('⚠️ Malpractice Detected!\n\nYou attempted to navigate back during the test.\n\nYour test has been terminated and marked as invalid.\n\n⛔ You are now PERMANENTLY BANNED from taking this quiz again!');
      };

      // Add event listeners
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('beforeunload', handleBeforeUnload);
      window.addEventListener('blur', handleBlur);
      window.addEventListener('focus', handleFocus);
      document.addEventListener('contextmenu', handleContextMenu);
      document.addEventListener('copy', handleCopy);
      document.addEventListener('paste', handleCopy);
      document.addEventListener('cut', handleCopy);
      document.addEventListener('keydown', handleKeyDown);
      window.addEventListener('popstate', handlePopState);

      // Cleanup
      return () => {
        if (blurTimeout) clearTimeout(blurTimeout);
        if (appStateListener) appStateListener.remove();
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('beforeunload', handleBeforeUnload);
        window.removeEventListener('blur', handleBlur);
        window.removeEventListener('focus', handleFocus);
        document.removeEventListener('contextmenu', handleContextMenu);
        document.removeEventListener('copy', handleCopy);
        document.removeEventListener('paste', handleCopy);
        document.removeEventListener('cut', handleCopy);
        document.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [mode, testStarted, showResults, cheatingDetected, banQuizForUser, saveMalpracticeRecord]);

  return {
    cheatingDetected,
    setCheatingDetected,
    violationCount,
    setViolationCount,
    cheatingDetectedRef,
    testStartedRef,
    showResultsRef,
    selectedQuizRef
  };
};
