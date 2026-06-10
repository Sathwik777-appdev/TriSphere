// Styles for Teacher Dashboard
export const styles = {
    container: {
        minHeight: '100vh',
        background: 'transparent',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        overflowY: 'visible'
    },
    header: {
        background: 'linear-gradient(135deg, #0f172a, #1e3a5f, #0f172a)',
        color: 'white',
        padding: 'clamp(10px, 2vh, 15px) clamp(16px, 4vw, 20px)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 4px 20px rgba(30, 58, 95, 0.5), 0 0 40px rgba(59, 130, 246, 0.3)',
        flexWrap: 'wrap',
        gap: '10px',
        minHeight: '70px',
        borderBottom: '1px solid rgba(59, 130, 146, 0.3)',
        zIndex: 1000,
    },
    headerLeft: {
        display: 'flex',
        alignItems: 'center'
    },
    logoSection: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
    },
    logoImage: {
        width: '40px',
        height: '40px',
        objectFit: 'contain',
        filter: 'drop-shadow(0 0 10px rgba(59, 130, 246, 0.5))',
        borderRadius: '50%',
        flexShrink: 0,
        mixBlendMode: 'lighten'
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
    welcomeMessage: {
        marginTop: '10px',
        padding: '12px 16px',
        background: 'rgba(255,255,255,0.15)',
        borderRadius: '10px',
        border: '1px solid rgba(255,255,255,0.2)',
        maxWidth: '350px'
    },
    welcomeMainText: {
        margin: 0,
        fontSize: '15px',
        fontWeight: '600',
        marginBottom: '4px',
        color: 'white'
    },
    welcomeSubText: {
        margin: 0,
        fontSize: '11px',
        opacity: 0.85,
        color: 'white',
        lineHeight: '1.4'
    },
    headerCenter: {
        flex: 1,
        display: 'flex',
        justifyContent: 'center'
    },
    classDisplay: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.15)',
        padding: '12px 24px',
        borderRadius: '12px',
    },
    classLabel: {
        fontSize: '11px',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        opacity: 0.8,
        marginBottom: '4px'
    },
    classValue: {
        fontSize: '16px',
        fontWeight: '700'
    },
    settingsContainer: {
        position: 'relative'
    },
    settingsBtn: {
        padding: '12px',
        background: 'transparent',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        cursor: 'pointer',
        fontWeight: '700',
        fontSize: '24px',
        transition: 'all 0.3s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        flexShrink: 0,
        whiteSpace: 'nowrap'
    },
    settingsDropdown: {
        position: 'absolute',
        top: '65px',
        right: '0',
        background: 'rgba(15, 23, 42, 0.85)',
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
    settingsSection: {
        marginBottom: '12px'
    },
    settingsLabel: {
        fontSize: '12px',
        color: 'rgba(255, 255, 255, 0.6)',
        marginBottom: '4px',
        fontWeight: '600',
        textTransform: 'uppercase'
    },
    settingsValue: {
        fontSize: '16px',
        color: '#ffffff',
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
        backgroundColor: '#7928ca',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
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
        backgroundColor: '#ef4444',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: '600',
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        transition: 'all 0.3s ease'
    },
    statsContainer: {
        maxWidth: '1400px',
        margin: '20px auto 20px',
        padding: '0 clamp(16px, 4vw, 20px)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(clamp(180px, 20vw, 200px), 1fr))',
        gap: 'clamp(12px, 2vw, 20px)'
    },
    statCard: {
        background: 'rgba(15, 23, 42, 0.9)',
        border: '1px solid rgba(59, 130, 246, 0.25)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
        padding: '24px',
        borderRadius: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        backdropFilter: 'blur(10px)',
        '&:hover': {
            transform: 'translateY(-5px)',
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(59, 130, 246, 0.2)',
            borderColor: 'rgba(59, 130, 246, 0.6)'
        }
    },
    statIcon: {
        fontSize: '28px',
        background: 'rgba(59, 130, 246, 0.1)',
        width: '50px',
        height: '50px',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    statContent: {
        flex: 1
    },
    statValue: {
        fontSize: '24px',
        fontWeight: '700',
        color: 'white'
    },
    statLabel: {
        fontSize: '13px',
        color: 'rgba(255,255,255,0.6)'
    },
    classButton: {
        padding: '12px 24px',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        background: 'rgba(255, 255, 255, 0.05)',
        color: 'rgba(255, 255, 255, 0.8)',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        whiteSpace: 'nowrap',
        fontSize: '14px',
        fontWeight: '700',
        backdropFilter: 'blur(5px)'
    },
    classButtonActive: {
        background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
        borderColor: '#3b82f6',
        color: '#ffffff',
        boxShadow: '0 0 20px rgba(59, 130, 246, 0.4), 0 4px 15px rgba(0, 0, 0, 0.3)',
        transform: 'translateY(-1px)'
    },
    viewNavigation: {
        margin: '0 20px 20px',
        display: 'flex',
        gap: '10px',
        overflowX: 'auto',
        paddingBottom: '10px',
        msOverflowStyle: 'auto',
        WebkitOverflowScrolling: 'touch'
    },
    viewButton: {
        padding: '8px 14px',
        borderRadius: '10px',
        border: 'none',
        background: 'rgba(255,255,255,0.1)',
        color: 'white',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.3s ease',
        whiteSpace: 'nowrap',
        fontWeight: '600',
        flexShrink: 0
    },
    viewIcon: {
        fontSize: '18px'
    },
    viewLabel: {
        fontSize: '14px'
    },
    content: {
        maxWidth: '1400px',
        margin: '0 auto',
        paddingBottom: '100px'
    },
    viewContent: {
        padding: 'clamp(12px, 3vw, 20px)',
        minHeight: '400px'
    },
    uploadContainer: {
        maxWidth: '800px',
        margin: '0 auto'
    },
    uploadSection: {
        background: 'rgba(15, 23, 42, 0.8)',
        padding: '30px',
        borderRadius: '20px',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
    },
    uploadTitle: {
        color: 'white',
        marginTop: 0,
        marginBottom: '20px',
        fontSize: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
    }
};
