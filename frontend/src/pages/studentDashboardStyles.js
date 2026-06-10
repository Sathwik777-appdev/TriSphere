/**
 * Student Dashboard Styles
 * Extracted from StudentDashboard.jsx for better maintainability
 * Uses shared theme for consistent colors
 */

import { colors, gradients, shadows, commonStyles } from '../styles/theme';

export const styles = {
    container: {
        minHeight: '100vh',
        background: 'transparent',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        overflowY: 'visible'
    },
    header: {
        ...commonStyles.header,
        padding: 'clamp(10px, 2vh, 15px) clamp(16px, 4vw, 20px)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: `${shadows.header}, 0 0 40px rgba(59, 130, 246, 0.3)`,
        flexWrap: 'wrap',
        gap: '10px',
        minHeight: '70px',
        zIndex: 1000,
    },
    headerLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flex: '0 0 auto',
        minWidth: 'fit-content'
    },
    logoSection: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexShrink: 0
    },
    logoImage: {
        width: '60px',
        height: 'auto',
        objectFit: 'contain',
        filter: 'drop-shadow(0 0 15px rgba(59, 130, 246, 0.6))',
        flexShrink: 0,
        borderRadius: '8px',
        animation: 'pulse 3s infinite ease-in-out'
    },
    logo: {
        fontSize: '36px',
        animation: 'bounce 2s infinite'
    },
    title: {
        margin: 0,
        fontSize: 'clamp(18px, 4vw, 24px)',
        fontWeight: '700',
        letterSpacing: '-0.5px',
        whiteSpace: 'nowrap'
    },
    subtitle: {
        margin: 0,
        fontSize: 'clamp(10px, 2.5vw, 12px)',
        opacity: 0.9,
        fontWeight: '400',
        whiteSpace: 'nowrap'
    },
    avatarWrapper: {
        width: '45px',
        height: '45px',
        borderRadius: '50%',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        border: '2px solid rgba(59, 130, 246, 0.5)',
        boxShadow: '0 0 15px rgba(59, 130, 246, 0.3)'
    },
    equippedAvatar: {
        width: '100%',
        height: '100%',
        objectFit: 'cover'
    },
    headerRight: {
        display: 'flex',
        alignItems: 'center',
        gap: '15px'
    },
    iconButton: {
        background: 'rgba(255, 255, 255, 0.1)',
        border: 'none',
        borderRadius: '12px',
        width: '40px',
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.3s ease'
    },
    headerCenter: {
        flex: 1,
        display: 'flex',
        justifyContent: 'center',
        minWidth: '0',
    },
    greeting: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        flexWrap: 'wrap',
        justifyContent: 'center'
    },
    greetingEmoji: {
        fontSize: '28px',
        animation: 'wave 2s ease-in-out infinite'
    },
    greetingText: {
        margin: 0,
        fontSize: 'clamp(18px, 4vw, 22px)',
        fontWeight: '600',
        textAlign: 'center'
    },
    classInfo: {
        margin: '4px 0 0 0',
        fontSize: 'clamp(13px, 3vw, 16px)',
        opacity: 0.85,
        textAlign: 'center'
    },
    searchContainer: {
        position: 'relative',
        marginLeft: '20px',
        flex: '0 1 400px', // Slightly wider to accommodate joined button
        minWidth: '250px',
        display: 'flex',
        alignItems: 'center'
    },
    searchInput: {
        flex: 1,
        padding: '12px 15px 12px 40px',
        borderRadius: '25px 0 0 25px',
        background: 'rgba(255, 255, 255, 0.07)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRight: 'none',
        color: '#fff',
        fontSize: '14px',
        outline: 'none',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        height: '45px',
        boxSizing: 'border-box',
        '&:focus': {
            background: 'rgba(255, 255, 255, 0.12)',
            borderColor: '#3b82f6',
            boxShadow: '0 0 20px rgba(59, 130, 246, 0.4)'
        }
    },
    goButton: {
        position: 'static', // Change from absolute
        height: '45px', // Match input height
        padding: '0 25px',
        background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
        border: '1px solid rgba(59, 130, 246, 0.5)',
        borderLeft: 'none', // Remove left border to join with input
        borderRadius: '0 25px 25px 0',
        color: 'white',
        fontSize: '14px',
        fontWeight: '700',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s ease',
        boxShadow: '0 4px 15px rgba(37, 99, 235, 0.3)',
        zIndex: 5,
        whiteSpace: 'nowrap'
    },
    searchIcon: {
        position: 'absolute',
        left: '12px',
        opacity: 0.6,
        display: 'flex',
        alignItems: 'center',
        pointerEvents: 'none'
    },
    searchResultsDropdown: {
        position: 'absolute',
        top: 'calc(100% + 10px)',
        left: 0,
        right: 0,
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: '16px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        padding: '8px',
        zIndex: 1001,
        border: '1px solid rgba(255, 255, 255, 0.1)',
        maxHeight: '300px',
        overflowY: 'auto'
    },
    searchResultItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px',
        borderRadius: '10px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        color: '#fff',
        '&:hover': {
            background: 'rgba(255, 255, 255, 0.1)'
        }
    },
    settingsContainer: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        position: 'relative',
        alignItems: 'flex-end'
    },
    todoBtn: {
        padding: '10px 18px',
        background: gradients.success,
        color: colors.text.white,
        border: 'none',
        borderRadius: '50px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '600',
        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
        transition: 'all 0.3s ease',
        whiteSpace: 'nowrap',
        minWidth: '120px'
    },
    settingsBtn: {
        background: 'transparent',
        color: colors.text.white,
        border: 'none',
        borderRadius: '12px',
        cursor: 'pointer',
        fontSize: '24px',
        transition: 'all 0.3s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '42px',
        height: '42px',
    },
    settingsDropdown: {
        position: 'absolute',
        top: '65px',
        right: '0',
        background: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: '24px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 40px rgba(59, 130, 246, 0.1)',
        padding: '24px',
        minWidth: '320px',
        zIndex: 1000,
        border: '1px solid rgba(255, 255, 255, 0.1)',
        overflow: 'hidden',
        animation: 'fadeIn 0.3s ease-out'
    },
    settingsItem: {
        width: '100%',
        padding: '12px 16px',
        background: 'transparent',
        border: 'none',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '14px',
        fontWeight: '500',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.2s ease',
        '&:hover': {
            background: 'rgba(255, 255, 255, 0.1)'
        }
    },
    settingsSection: {
        marginBottom: '12px'
    },
    settingsLabel: {
        fontSize: '12px',
        color: colors.text.subtle,
        marginBottom: '4px',
        fontWeight: '600',
        textTransform: 'uppercase'
    },
    settingsValue: {
        fontSize: '16px',
        color: colors.text.white,
        fontWeight: '500'
    },
    settingsDivider: {
        height: '1px',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        margin: '16px 0'
    },
    feedbackBtn: {
        width: '100%',
        padding: '10px',
        backgroundColor: colors.accent.purple,
        color: colors.text.white,
        border: 'none',
        borderRadius: '50px',
        cursor: 'pointer',
        fontWeight: '600',
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        transition: 'all 0.3s ease',
        marginTop: '8px'
    },
    logoutBtnDropdown: {
        width: '100%',
        padding: '12px',
        backgroundColor: colors.accent.error,
        color: colors.text.white,
        border: 'none',
        borderRadius: '50px',
        cursor: 'pointer',
        fontWeight: '600',
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        transition: 'all 0.3s ease'
    },
    logoutBtn: {
        padding: 'clamp(8px, 2vw, 12px) clamp(16px, 4vw, 28px)',
        background: gradients.logout,
        color: colors.text.white,
        border: 'none',
        borderRadius: '50px',
        cursor: 'pointer',
        fontWeight: '700',
        fontSize: 'clamp(13px, 3vw, 15px)',
        transition: 'all 0.3s ease',
        boxShadow: '0 4px 15px rgba(245, 87, 108, 0.4)',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        flexShrink: 0,
        whiteSpace: 'nowrap',
    },
    logoutIcon: {
        fontSize: '18px',
        display: 'inline-flex',
        alignItems: 'center'
    },
    statsContainer: {
        maxWidth: '1200px',
        margin: '20px auto 20px', // Adjusted margin
        padding: '0 clamp(16px, 4vw, 20px)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(clamp(160px, 20vw, 200px), 1fr))',
        gap: 'clamp(12px, 2vw, 20px)'
    },
    statCard: {
        ...commonStyles.statCard,
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
            transform: 'translateY(-5px)',
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.4), 0 0 20px rgba(59, 130, 246, 0.2)',
            borderColor: 'rgba(59, 130, 246, 0.5)'
        }
    },
    statIcon: {
        ...commonStyles.statIcon,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    statContent: {
        flex: 1
    },
    statValue: {
        fontSize: '28px',
        fontWeight: '700',
        color: colors.text.white,
        lineHeight: 1
    },
    statLabel: {
        fontSize: '13px',
        color: colors.text.subtle,
        marginTop: '4px',
        fontWeight: '500'
    },
    content: {
        maxWidth: '1200px',
        margin: '0 auto',
        padding: 'clamp(12px, 3vw, 20px)'
    },
    tabNavigation: {
        ...commonStyles.tabNavigation,
        display: 'flex',
        gap: '10px',
        marginTop: '20px',
        overflowX: 'auto',
        flexWrap: 'wrap'
    },
    tabButton: {
        ...commonStyles.buttonInactive,
        flex: '1',
        minWidth: '120px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '12px 20px',
        fontSize: '14px',
        fontWeight: '600',
    },
    tabButtonActive: {
        ...commonStyles.buttonPrimary,
        transform: 'scale(1.05)'
    },
    tabIcon: {
        fontSize: '18px'
    },
    tabLabel: {
        fontSize: '14px'
    },
    tabContent: {
        marginTop: '20px',
        background: gradients.cardDark,
        borderRadius: '16px',
        padding: '24px',
        border: `1px solid ${colors.border.blue}`,
        boxShadow: shadows.card,
        minHeight: '400px'
    },
    motivationalBanner: {
        maxWidth: '1200px',
        margin: '10px auto 20px',
        padding: '20px 30px',
        background: 'transparent',
        borderRadius: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '15px',
        animation: 'fadeInSlide 1s ease-out',
        position: 'relative',
        overflow: 'hidden'
    },
    motivationIcon: {
        fontSize: '36px',
        animation: 'bounce 2s ease-in-out infinite',
        filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))'
    },
    motivationText: {
        margin: 0,
        fontSize: '20px',
        fontWeight: '700',
        color: colors.text.white,
        textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
        letterSpacing: '0.5px',
        lineHeight: '1.4'
    },
    feedbackModal: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000
    },
    feedbackModalContent: {
        background: 'linear-gradient(135deg, rgba(15, 15, 35, 0.98), rgba(30, 40, 70, 0.98))',
        borderRadius: '12px',
        width: '90%',
        maxWidth: '500px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        border: '1px solid rgba(0, 255, 255, 0.3)',
        color: '#ffffff'
    },
    feedbackModalHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px',
        borderBottom: '1px solid rgba(0, 255, 255, 0.2)'
    },
    feedbackModalBody: {
        padding: '20px'
    },
    feedbackTextarea: {
        width: '100%',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid #d1d5db',
        fontSize: '14px',
        fontFamily: 'inherit',
        resize: 'vertical',
        marginBottom: '16px'
    },
    feedbackModalFooter: {
        display: 'flex',
        gap: '10px',
        justifyContent: 'flex-end'
    },
    closeButton: {
        background: 'rgba(255, 255, 255, 0.1)',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        color: '#ffffff',
        padding: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s ease'
    },
    cancelButton: {
        padding: '10px 20px',
        backgroundColor: '#e5e7eb',
        color: '#374151',
        border: 'none',
        borderRadius: '50px',
        cursor: 'pointer',
        fontWeight: '600',
        fontSize: '14px'
    },
    submitButton: {
        padding: '10px 20px',
        backgroundColor: colors.accent.purple,
        color: colors.text.white,
        border: 'none',
        borderRadius: '50px',
        cursor: 'pointer',
        fontWeight: '600',
        fontSize: '14px'
    }
};

export default styles;
