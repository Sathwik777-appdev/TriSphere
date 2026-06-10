import React, { createContext, useState, useEffect, useCallback, useContext, useMemo } from 'react';
import { setupAuthListener, getUserRole, getUserData } from '../services/authService';
import { safeLocalStorage } from '../utils/storage';

export const AuthContext = createContext(null);

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // If there's an active session saved in localStorage, start with isAppLoading = true
  const [isAppLoading, setIsAppLoading] = useState(() => {
    try {
      const active = safeLocalStorage.get('trisphere_has_active_session');
      return active === 'true' || active === true;
    } catch (e) {
      return false;
    }
  });

  const triggerAppLoader = useCallback(() => {
    setIsAppLoading(true);
  }, []);

  // Timer to turn off loading screen after 5 seconds
  useEffect(() => {
    if (isAppLoading) {
      const timer = setTimeout(() => {
        setIsAppLoading(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isAppLoading]);

  useEffect(() => {
    const unsubscribe = setupAuthListener(async (authUser) => {
      try {
        setLoading(true);
        setError(null);

        if (authUser) {
          console.log('🔐 Auth State Changed: USER DETECTED', { uid: authUser.uid, email: authUser.email });
          setUser(authUser);

          // Fetch full user data once (efficient)
          console.log('📡 Fetching User Profile for:', authUser.uid);
          const data = await getUserData(authUser.uid);

          if (data) {
            console.log('📊 Profile Result:', { role: data.role });
            setRole(data.role);
            setUserData({ ...data, uid: authUser.uid });
            safeLocalStorage.set('trisphere_has_active_session', 'true');
          } else {
            console.warn('⚠️ No profile document found for user.');
            setRole(null);
            setUserData(null);
            safeLocalStorage.remove('trisphere_has_active_session');
          }
        } else {
          console.log('🔓 Auth State Changed: NO USER');
          setUser(null);
          setRole(null);
          setUserData(null);
          safeLocalStorage.remove('trisphere_has_active_session');
        }
      } catch (err) {
        console.error('🔥 Error in auth listener:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    user,
    role,
    userData,
    loading,
    error,
    isAuthenticated: !!user,
    isTeacher: role === 'teacher',
    isStudent: role === 'student',
    isParent: role === 'parent',
    isAdmin: role === 'admin' || role === 'principal',
    isPrincipal: role === 'principal',
    isAppLoading,
    triggerAppLoader
  }), [user, role, userData, loading, error, isAppLoading, triggerAppLoader]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
