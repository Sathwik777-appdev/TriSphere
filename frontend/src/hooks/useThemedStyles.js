/**
 * useThemedStyles Hook
 * Returns theme-aware styles for components based on the current theme
 */
import { useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';
import { getThemedStyles, standardTheme } from '../styles/theme';

/**
 * Custom hook that returns theme-aware styles
 * @returns {object} Object containing themed styles and colors
 */
export const useThemedStyles = () => {
    const { theme, isDark } = useTheme();

    const themedStyles = useMemo(() => {
        return getThemedStyles(theme);
    }, [theme]);

    const themeColors = useMemo(() => {
        return standardTheme.colors;
    }, []);

    const themeGradients = useMemo(() => {
        return standardTheme.gradients;
    }, []);

    return {
        styles: themedStyles,
        colors: themeColors,
        gradients: themeGradients,
        isDark,
        theme,
    };
};

export default useThemedStyles;
