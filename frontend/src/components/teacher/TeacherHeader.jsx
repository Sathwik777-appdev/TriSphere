import React from 'react';
import { ProfilePhoto } from '../ProfilePhoto';
import AnimatedLogo from '../AnimatedLogo';

export const TeacherHeader = ({
    themedStyles,
    userData,
    selectedClass,
    selectedSubject,
    showSettings,
    setShowSettings,
    setShowPrivacyPolicy,
    setShowDiscussion,
    handleLogout,
    styles,
    phoneNumber,
    phoneEditing,
    phoneSaving,
    phoneInput,
    setPhoneInput,
    setPhoneEditing,
    handleSavePhone,
    setShowAccountSettings,
    setActiveView
}) => {
    return (
        <header style={{ ...styles.header, ...themedStyles.header, color: themedStyles.text.primary }}>
            <div style={styles.headerLeft}>
                <div style={styles.logoSection}>
                    <AnimatedLogo variant="header" size={40} withWordmark={false} />
                    <div>
                        <h1 style={themedStyles.goldenText}>Teacher Hub</h1>
                        <p style={{ ...styles.subtitle, color: themedStyles.text.muted }}>
                            <span style={themedStyles.goldenText}>TriSphere</span> Management • <span style={{ color: '#60a5fa', fontWeight: '600' }}>Powered by Yugnext-AI</span>
                        </p>
                        <div style={styles.welcomeMessage}>
                            <p style={{ ...styles.welcomeMainText, color: themedStyles.text.primary }}>
                                Welcome back, {userData?.username || 'Teacher'}! 👋
                            </p>
                            <p style={{ ...styles.welcomeSubText, color: themedStyles.text.muted }}>
                                Here's what's happening with your classes today
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div style={styles.headerCenter}>
                <div style={styles.classDisplay}>
                    <span style={{ ...styles.classLabel, color: themedStyles.text.muted }}>Current Class</span>
                    <span style={{ ...styles.classValue, color: themedStyles.text.primary }}>
                        Class {selectedClass} - {selectedSubject}
                    </span>
                </div>
            </div>

            <div style={styles.settingsContainer}>
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    style={styles.settingsBtn}
                    className="settings-icon-btn"
                    aria-label="Open teacher settings menu"
                    aria-expanded={showSettings}
                    aria-haspopup="menu"
                >
                    ⚙️
                </button>
                {showSettings && (
                    <>
                        <div
                            style={{ position: 'fixed', inset: 0, zIndex: 999 }}
                            onClick={() => setShowSettings(false)}
                        />
                        <div style={styles.settingsDropdown}>
                            {/* Profile Identity Section */}
                            <div style={{ ...styles.settingsSection, textAlign: 'center', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        padding: '4px',
                                        borderRadius: '50%',
                                        background: 'linear-gradient(45deg, #3b82f6, #8b5cf6)',
                                        boxShadow: '0 0 20px rgba(139, 92, 246, 0.3)'
                                    }}>
                                        <ProfilePhoto size={70} editable={false} />
                                    </div>
                                    <div>
                                        <div style={{ ...styles.settingsValue, fontSize: '18px', fontWeight: '700' }}>
                                            {userData?.username || 'Teacher'}
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                            <span style={{ padding: '2px 8px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' }}>
                                                Class {selectedClass}
                                            </span>
                                            <span style={{ opacity: 0.5 }}>•</span>
                                            <span>{selectedSubject}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={styles.settingsDivider}></div>

                            {/* Management Section / Tools Grid */}
                            <div style={styles.settingsSection}>
                                <div style={{ ...styles.settingsLabel, marginBottom: '12px' }}>Workspace Tools</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <button
                                        onClick={() => {
                                            setShowSettings(false);
                                            setActiveView('meetings');
                                        }}
                                        style={{
                                            ...styles.feedbackBtn,
                                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                            border: '1px solid rgba(59, 130, 246, 0.2)',
                                            flexDirection: 'column',
                                            padding: '16px 8px',
                                            height: 'auto',
                                            borderRadius: '16px'
                                        }}
                                    >
                                        <span style={{ fontSize: '24px', marginBottom: '8px' }}>🎥</span>
                                        <span style={{ fontSize: '12px' }}>Meetings</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowSettings(false);
                                            setActiveView('activity');
                                        }}
                                        style={{
                                            ...styles.feedbackBtn,
                                            backgroundColor: 'rgba(139, 92, 246, 0.1)',
                                            border: '1px solid rgba(139, 92, 246, 0.2)',
                                            flexDirection: 'column',
                                            padding: '16px 8px',
                                            height: 'auto',
                                            borderRadius: '16px'
                                        }}
                                    >
                                        <span style={{ fontSize: '24px', marginBottom: '8px' }}>📋</span>
                                        <span style={{ fontSize: '12px' }}>Attendance</span>
                                    </button>
                                </div>
                            </div>

                            <div style={styles.settingsDivider}></div>

                            {/* Account & Security */}
                            <div style={styles.settingsSection}>
                                <div style={{ ...styles.settingsLabel, marginBottom: '8px' }}>Account & Security</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <button
                                        onClick={() => {
                                            setShowSettings(false);
                                            setShowAccountSettings(true);
                                        }}
                                        style={{
                                            ...styles.feedbackBtn,
                                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            justifyContent: 'flex-start',
                                            paddingLeft: '16px'
                                        }}
                                    >
                                        📱 Phone & Password
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowSettings(false);
                                            setShowPrivacyPolicy(true);
                                        }}
                                        style={{
                                            ...styles.feedbackBtn,
                                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            justifyContent: 'flex-start',
                                            paddingLeft: '16px'
                                        }}
                                    >
                                        🛡️ Privacy Policy
                                    </button>
                                </div>
                            </div>

                            <div style={styles.settingsDivider}></div>

                            {/* Community */}
                            <div style={styles.settingsSection}>
                                <div style={{ ...styles.settingsLabel, marginBottom: '8px' }}>Community</div>
                                <button
                                    onClick={() => {
                                        setShowSettings(false);
                                        setShowDiscussion(true);
                                    }}
                                    style={{
                                        ...styles.feedbackBtn,
                                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                        border: '1px solid rgba(16, 185, 129, 0.2)',
                                        justifyContent: 'flex-start',
                                        paddingLeft: '16px'
                                    }}
                                >
                                    💬 Discussion Forum
                                </button>
                            </div>

                            <div style={{ marginTop: '20px' }}>
                                <button
                                    onClick={handleLogout}
                                    style={{
                                        ...styles.logoutBtnDropdown,
                                        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(220, 38, 38, 0.2))',
                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                        borderRadius: '12px',
                                        color: '#ef4444'
                                    }}
                                >
                                    🔓 Logout Session
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </header>
    );
};
