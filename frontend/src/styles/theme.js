/**
 * TriSphere Theme Configuration
 * Central theme file for consistent styling across all components.
 * Consolidated to a single standard theme.
 */

// ==================== STANDARD THEME ====================
export const standardTheme = {
    name: 'standard',

    colors: {
        primary: {
            darkest: '#0a0a1a',
            dark: '#1a0a2e',
            medium: '#2563eb',
            light: '#60a5fa',
            lighter: '#bfdbfe',
        },
        background: {
            main: '#0a0a1a',
            card: 'rgba(15, 23, 42, 0.95)',
            cardHover: 'rgba(30, 41, 59, 0.95)',
            input: 'rgba(15, 23, 42, 0.9)',
            overlay: 'rgba(0, 0, 0, 0.5)',
            header: 'rgba(10, 10, 26, 0.95)',
        },
        text: {
            primary: '#ffffff',
            secondary: 'rgba(255, 255, 255, 0.9)',
            muted: 'rgba(255, 255, 255, 0.7)',
            subtle: 'rgba(255, 255, 255, 0.5)',
            inverse: '#0a0a1a',
            white: '#ffffff',
        },
        border: {
            default: 'rgba(59, 130, 246, 0.3)',
            light: 'rgba(59, 130, 246, 0.15)',
            focus: 'rgba(59, 130, 246, 0.6)',
            glow: 'rgba(99, 102, 241, 0.4)',
        },
        accent: {
            blue: '#3b82f6',
            indigo: '#6366f1',
            purple: '#8b5cf6',
            success: '#10b981',
            warning: '#f59e0b',
            error: '#ef4444',
            info: '#3b82f6',
        },
        shadow: {
            default: 'rgba(0, 0, 0, 0.4)',
            blue: 'rgba(59, 130, 246, 0.3)',
            indigo: 'rgba(99, 102, 241, 0.3)',
            purple: 'rgba(128, 0, 255, 0.3)',
        },
    },

    gradients: {
        header: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 58, 95, 0.95))',
        card: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 58, 95, 0.85))',
        button: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
        buttonHover: 'linear-gradient(135deg, #3b82f6, #2563eb)',
        buttonIndigo: 'linear-gradient(135deg, #4f46e5, #4338ca)',
        buttonPurple: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
        success: 'linear-gradient(135deg, #10b981, #059669)',
        warning: 'linear-gradient(135deg, #f59e0b, #d97706)',
        error: 'linear-gradient(135deg, #ef4444, #dc2626)',
        glow: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(99, 102, 241, 0.2))',
    },
};

// ==================== THEME HELPER ====================
export const getTheme = () => standardTheme;

// ==================== LEGACY EXPORTS ====================
export const colors = {
    ...standardTheme.colors,
    primary: standardTheme.colors.primary,
    background: standardTheme.colors.background,
    text: standardTheme.colors.text,
    border: standardTheme.colors.border,
    accent: standardTheme.colors.accent,
    shadow: standardTheme.colors.shadow,
    blue: standardTheme.colors.primary.medium,
    white: '#ffffff',
};

export const gradients = {
    ...standardTheme.gradients,
    header: standardTheme.gradients.header,
    cardDark: standardTheme.gradients.card,
    buttonBlue: standardTheme.gradients.button,
    buttonInactive: 'rgba(30, 58, 95, 0.8)',
    success: standardTheme.gradients.success,
};

export const shadows = {
    ...standardTheme.colors.shadow,
    card: `0 4px 20px ${standardTheme.colors.shadow.default}`,
    cardHover: `0 8px 30px ${standardTheme.colors.shadow.blue}`,
    header: `0 4px 20px ${standardTheme.colors.shadow.blue}`,
    button: `0 4px 20px ${standardTheme.colors.shadow.blue}`,
    dropdown: `0 8px 32px ${standardTheme.colors.shadow.default}`,
};

export const commonStyles = getThemedStyles();

export function getThemedStyles() {
    const theme = standardTheme;
    const t = theme.colors;

    return {
        container: {
            background: t.background.main,
            color: t.text.primary,
        },
        card: {
            background: t.background.card,
            borderRadius: '16px',
            border: `1px solid ${t.border.default}`,
            boxShadow: `0 4px 20px ${t.shadow.default}`,
            padding: '20px',
        },
        header: {
            background: theme.gradients.header,
            color: t.text.primary,
            borderBottom: `1px solid ${t.border.default}`,
            boxShadow: `0 4px 20px ${t.shadow.blue}`,
        },
        statCard: {
            background: t.background.card,
            padding: '20px',
            borderRadius: '16px',
            border: `1px solid ${t.border.default}`,
            boxShadow: `0 4px 20px ${t.shadow.default}`,
            transition: 'all 0.3s ease',
            cursor: 'pointer',
        },
        buttonPrimary: {
            background: theme.gradients.button,
            color: '#ffffff',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: '600',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 20px rgba(59, 130, 246, 0.4)',
        },
        buttonSecondary: {
            background: theme.gradients.buttonIndigo,
            color: '#ffffff',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: '600',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 20px rgba(99, 102, 241, 0.4)',
        },
        buttonHighlight: {
            background: theme.gradients.error,
            color: '#ffffff',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: '600',
            transition: 'all 0.3s ease',
        },
        buttonInactive: {
            background: 'rgba(15, 23, 42, 0.8)',
            border: `1px solid ${t.border.default}`,
            borderRadius: '12px',
            cursor: 'pointer',
            color: t.text.muted,
            transition: 'all 0.3s ease',
            backdropFilter: 'blur(10px)',
        },
        tabNavigation: {
            background: t.background.card,
            padding: '12px',
            borderRadius: '16px',
            border: `1px solid ${t.border.default}`,
            boxShadow: `0 4px 20px ${t.shadow.default}`,
        },
        tabContent: {
            marginTop: '20px',
            background: t.background.card,
            borderRadius: '16px',
            padding: '24px',
            border: `1px solid ${t.border.default}`,
            boxShadow: `0 4px 20px ${t.shadow.default}`,
            minHeight: '400px',
        },
        dropdown: {
            background: t.background.card,
            border: `1px solid ${t.border.default}`,
            borderRadius: '12px',
            boxShadow: `0 8px 32px ${t.shadow.default}`,
            backdropFilter: 'blur(20px)',
        },
        goldenText: {
            fontFamily: '"Google Sans", "Product Sans", sans-serif',
            fontWeight: '700',
            color: t.text.primary,
            letterSpacing: '0.5px',
            textShadow: 'none',
        },
        input: {
            background: t.background.input,
            color: t.text.primary,
            border: `1px solid ${t.border.default}`,
            borderRadius: '10px',
            padding: '12px 16px',
            fontSize: '14px',
            transition: 'all 0.3s ease',
        },
        inputFocus: {
            borderColor: t.border.focus,
            boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)',
        },
        text: {
            primary: t.text.primary,
            secondary: t.text.secondary,
            muted: t.text.muted,
            subtle: t.text.subtle,
        },
        accent: t.accent,
        background: t.background,
        border: t.border,
        gradients: theme.gradients,
    };
}

export default {
    colors,
    gradients,
    shadows,
    commonStyles,
};
