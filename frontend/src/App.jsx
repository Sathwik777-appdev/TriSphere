import React, { useState, useEffect, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { usePushNotifications } from './hooks/usePushNotifications';
import { useBackButton } from './hooks/useBackButton';
import { ThemeProvider } from './context/ThemeContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineIndicator from './components/OfflineIndicator';
import { ToastProvider } from './components/Toast';
import AppLoader from './components/AppLoader';
import { PWAProvider } from './context/PWAContext';
import { TimerProvider } from './context/TimerContext';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import UpdatePrompt from './components/UpdatePrompt';
import { safeLocalStorage, safeSessionStorage } from './utils/storage';
import { CLIENT_VERSION } from './utils/version';
import VersionGateModal from './components/VersionGateModal';
import { PermissionsGate } from './components/PermissionsGate';
import { API_BASE_URL } from './utils/apiBase';
import SleepGate from './components/SleepGate';

// Helper to retry lazy components (fixes "Failed to fetch dynamically imported module")
const lazyRetry = (componentImport) => {
  return lazy(async () => {
    const hasRetried = safeSessionStorage.get('retry-lazy-' + componentImport.toString());
    try {
      return await componentImport();
    } catch (error) {
      if (!hasRetried) {
        safeSessionStorage.set('retry-lazy-' + componentImport.toString(), 'true');
        window.location.reload();
        return new Promise(() => { }); // Return a pending promise while page reloads
      }
      throw error;
    }
  });
};

// Lazy load heavy dashboard components for better performance
const LoginPage = lazyRetry(() => import('./pages/LoginPage').then(module => ({ default: module.LoginPage })));
const TeacherDashboard = lazyRetry(() => import('./pages/TeacherDashboard'));
const StudentDashboard = lazyRetry(() => import('./pages/StudentDashboard'));
const ParentDashboard = lazyRetry(() => import('./pages/ParentDashboard'));
const AdminDashboard = lazyRetry(() => import('./pages/AdminDashboard'));
const SimulationPage = lazyRetry(() => import('./pages/SimulationPage'));
const DeveloperDashboard = lazyRetry(() => import('./pages/DeveloperDashboard'));
const LandingPage = lazyRetry(() => import('./pages/LandingPage'));
const AboutMethodology = lazyRetry(() => import('./pages/AboutMethodology'));
const PrivacyPolicy = lazyRetry(() => import('./pages/PrivacyPolicy'));
const TermsAndConditions = lazyRetry(() => import('./pages/TermsAndConditions'));
// Terms of Service intentionally removed from the app — the platform is
// distributed under a B2B master agreement signed by each school's
// principal (hard-copy contract), so no in-app terms page is needed.
// Privacy Policy stays because data-protection law requires an in-app
// notice for every individual user regardless of any school contract.


// HomeRedirect properly routes returning users to bypass LandingPage completely
const HomeRedirect = () => {
  const { isAuthenticated, role, isAppLoading, loading } = useAuth();

  // If auth state is still loading, just return null (the global AppLoader handles the visual)
  if (isAppLoading || loading) return null;

  // If authenticated, redirect to appropriate dashboard
  if (isAuthenticated && role) {
    switch (role) {
      case 'teacher': return <Navigate to="/dashboard/teacher" replace />;
      case 'student': return <Navigate to="/dashboard/student" replace />;
      case 'parent': return <Navigate to="/dashboard/parent" replace />;
      case 'admin':
      case 'principal': return <Navigate to="/dashboard/admin" replace />;
      case 'developer': return <Navigate to="/dashboard/developer" replace />;
      default: return <LandingPage />;
    }
  }

  // Not authenticated - check if they should see landing page
  const hasSeenLanding = safeLocalStorage.get('has_seen_landing') === true;
  if (hasSeenLanding) {
    return <Navigate to="/login" replace />;
  }

  return <LandingPage />;
};

// Lives INSIDE BrowserRouter so useLocation() works. Owns the Android-style
// double-back-to-exit behaviour: sub-routes navigate normally, root routes
// require two presses within 2s to actually close the tab.
function BackButtonHandler() {
  useBackButton();
  return null;
}

function AppContent() {
  usePushNotifications();
  const { isAppLoading, loading, isAuthenticated, role } = useAuth();
  const [sleepLocked, setSleepLocked] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || role !== 'student') {
      setSleepLocked(false);
      return;
    }

    const checkSleepTime = () => {
      const offset = Number(safeSessionStorage.get('server_time_offset') || 0);
      const trueDate = new Date(Date.now() + offset);
      const hour = trueDate.getHours();
      // Block from 12:00 AM (0) to 5:00 AM (5)
      setSleepLocked(hour < 5);
    };

    checkSleepTime();
    const interval = setInterval(checkSleepTime, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [isAuthenticated, role]);

  return (
    <>
      {sleepLocked && <SleepGate />}
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <BackButtonHandler />
        
        {/* 5-second Loading Overlay */}
        <AnimatePresence>
          {(isAppLoading || loading) && (
            <motion.div
              initial={{ opacity: 1, pointerEvents: 'auto' }}
              animate={{ opacity: 1, pointerEvents: 'auto' }}
              exit={{ opacity: 0, pointerEvents: 'none' }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 999999,
                background: '#0a0f1a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <AppLoader duration={5000} />
            </motion.div>
          )}
        </AnimatePresence>

        <Suspense fallback={<AppLoader />}>
          <Routes>
            {/* Public / Marketing Routes (No Permissions Gate) */}
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/about" element={<AboutMethodology />} />
            <Route path="/terms" element={<TermsAndConditions />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />

            {/* Secure App / Dashboard Routes (Wrapped in Permissions Gate) */}
            <Route element={<PermissionsGate><Outlet /></PermissionsGate>}>
              <Route path="/login" element={<Suspense fallback={<AppLoader message="Preparing Login..." />}><LoginPage /></Suspense>} />
              <Route path="/dashboard/teacher" element={<ProtectedRoute requiredRole="teacher" Component={TeacherDashboard} />} />
              <Route path="/dashboard/student" element={<ProtectedRoute requiredRole="student" Component={StudentDashboard} />} />
              <Route path="/dashboard/parent" element={<ProtectedRoute requiredRole="parent" Component={ParentDashboard} />} />
              <Route path="/dashboard/admin" element={<ProtectedRoute requiredRole="admin" Component={AdminDashboard} />} />
              <Route path="/dashboard/developer" element={<ProtectedRoute requiredRole="developer" Component={DeveloperDashboard} />} />
              <Route path="/simulation" element={<SimulationPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </>
  );
}

function App() {
  // Version check states for update gate
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isForceUpdate, setIsForceUpdate] = useState(false);
  const [latestVersion, setLatestVersion] = useState('1.0.0');
  const [androidStoreUrl, setAndroidStoreUrl] = useState('');
  const [iosStoreUrl, setIosStoreUrl] = useState('');

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/app-version`);
        if (!response.ok) throw new Error('Version fetch failed');
        const data = await response.json();
        
        const serverDateHeader = response.headers.get('Date');
        if (serverDateHeader) {
          const offset = new Date(serverDateHeader).getTime() - Date.now();
          safeSessionStorage.set('server_time_offset', offset);
        }
        
        const current = CLIENT_VERSION;
        const minRequired = data.minRequiredVersion;
        const latest = data.latestVersion;

        const parseVersion = (v) => String(v).split('.').map(Number);
        const isOlder = (v1, v2) => {
          const p1 = parseVersion(v1);
          const p2 = parseVersion(v2);
          for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
            const num1 = p1[i] || 0;
            const num2 = p2[i] || 0;
            if (num1 < num2) return true;
            if (num1 > num2) return false;
          }
          return false;
        };

        if (isOlder(current, minRequired)) {
          setLatestVersion(latest);
          setAndroidStoreUrl(data.androidStoreUrl);
          setIosStoreUrl(data.iosStoreUrl);
          setIsForceUpdate(true);
          setShowUpdateModal(true);
        } else if (isOlder(current, latest)) {
          setLatestVersion(latest);
          setAndroidStoreUrl(data.androidStoreUrl);
          setIosStoreUrl(data.iosStoreUrl);
          setIsForceUpdate(false);
          setShowUpdateModal(true);
        }
      } catch (err) {
        console.warn('App version check failed:', err.message);
      }
    };
    checkVersion();
  }, []);

  // Trigger pre-fetching of critical dashboard bundles immediately on mount
  useEffect(() => {
    const prefetchAssets = async () => {
      try {
        // These imports will be cached by the browser while the user is using the app
        import('./pages/TeacherDashboard');
        import('./pages/StudentDashboard');
        import('./pages/ParentDashboard');
        import('./pages/LoginPage');
        console.log('Pre-fetching major dashboard bundles...');
      } catch (err) {
        console.warn('Pre-fetch failed:', err);
      }
    };
    prefetchAssets();
  }, []);

  return (
    <AuthProvider>
      <PWAProvider>
        <ThemeProvider>
         <TimerProvider>
          <ToastProvider>
            <ErrorBoundary>
              <OfflineIndicator />
              <PWAInstallPrompt />
              <UpdatePrompt />

              <VersionGateModal
                isOpen={showUpdateModal}
                isForceUpdate={isForceUpdate}
                latestVersion={latestVersion}
                androidStoreUrl={androidStoreUrl}
                iosStoreUrl={iosStoreUrl}
                onClose={() => setShowUpdateModal(false)}
              />

              <AppContent />
            </ErrorBoundary>
          </ToastProvider>
         </TimerProvider>
        </ThemeProvider>
      </PWAProvider>
    </AuthProvider>
  );
}

const UnauthorizedPage = () => (
  <div style={styles.container}>
    <h1>❌ Unauthorized</h1>
    <p>You don't have permission to access this page.</p>
    <a href="/login" style={styles.link}>Return to Login</a>
  </div>
);

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#000814',
    color: '#ffffff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '20px',
    textAlign: 'center'
  },
  link: {
    marginTop: '20px',
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '8px',
    fontWeight: '600',
    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
  }
};

export default App;
