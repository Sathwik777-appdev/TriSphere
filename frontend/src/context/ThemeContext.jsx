import React, { createContext, useState, useEffect, useContext, useMemo, useCallback } from 'react';

// Create Theme Context
export const ThemeContext = createContext(null);

// Custom hook to use theme context
export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

export const ThemeProvider = ({ children }) => {
    // Force 'standard' theme as the only supported standard theme
    const theme = 'standard';

    // Apply theme class to body and set CSS custom properties
    useEffect(() => {
        document.body.className = 'standard-theme';

        // Set CSS custom properties for the standard theme colors
        const root = document.documentElement;
        
        // standard theme colors
        root.style.setProperty('--bg-primary', 'rgba(15, 23, 42, 0.95)');
        root.style.setProperty('--bg-secondary', 'rgba(30, 58, 95, 0.95)');
        root.style.setProperty('--bg-card', 'rgba(15, 23, 42, 0.98)');
        root.style.setProperty('--bg-header', 'linear-gradient(135deg, #0f172a, #1e3a5f, #0f172a)');
        root.style.setProperty('--text-primary', '#ffffff');
        root.style.setProperty('--text-secondary', 'rgba(255, 255, 255, 0.9)');
        root.style.setProperty('--text-muted', 'rgba(255, 255, 255, 0.7)');
        root.style.setProperty('--border-color', 'rgba(59, 130, 246, 0.3)');
        root.style.setProperty('--shadow-color', 'rgba(0, 0, 0, 0.3)');

        // Clear any old stored themes to avoid confusion
        try {
            localStorage.setItem('trisphere_theme', 'standard');
        } catch (e) {
            // Silently ignore
        }
    }, []);

    // Theme switching functions are now no-ops to maintain backward compatibility
    const setTheme = useCallback(async () => {
        console.info('Theme is standardized to Standard mode.');
    }, []);

    const toggleTheme = useCallback(() => {
        console.info('Theme is standardized to RGB mode.');
    }, []);

    // Always returns true as RGB is a dark-based theme
    const isDark = true;

    // Memoize the context value to prevent unnecessary re-renders
    const value = useMemo(() => ({
        theme,
        setTheme,
        toggleTheme,
        isDark
    }), [theme, setTheme, toggleTheme, isDark]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

