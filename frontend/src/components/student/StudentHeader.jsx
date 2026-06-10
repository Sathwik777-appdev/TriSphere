import React from 'react';
import { SettingsIcon, HamburgerMenuIcon, LogoutIcon } from '../../components/Icons';

export const StudentHeader = ({
    themedStyles,
    userData,
    equippedAvatar,
    handleLogout,
    setShowSettings,
    setShowAccountSettings,
    setShowPrivacyPolicy,
    setShowDiscussion,
    setShowFeedback,
    setShowMessages,
    showSettings,
    styles
}) => {
    return (
        <header style={{ ...styles.header, ...themedStyles.header }}>
            <div style={styles.headerLeft}>
                <div style={styles.logoSection}>
                    <div style={styles.avatarWrapper}>
                        <div style={styles.logo}>3️⃣</div>
                    </div>
                    <div>
                        <h1 style={{ ...styles.title, ...themedStyles.goldenText }}>TriSphere</h1>
                        <p style={{ ...styles.subtitle, color: themedStyles.text.muted }}>Learning Hub</p>
                    </div>
                </div>
            </div>

            <div style={styles.headerRight}>
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    style={{ ...styles.iconButton, ...themedStyles.buttonSecondary }}
                    className="settings-btn"
                >
                    <SettingsIcon size={20} color={themedStyles.text.primary} />
                </button>

                <button
                    onClick={handleLogout}
                    style={{ ...styles.logoutBtn, ...themedStyles.buttonHighlight }}
                    className="hide-on-mobile"
                >
                    <LogoutIcon size={18} color="#ffffff" />
                    <span>Logout</span>
                </button>

                {showSettings && (
                    <>
                        <div
                            style={{ position: 'fixed', inset: 0, zIndex: 999 }}
                            onClick={() => setShowSettings(false)}
                        />
                        <div style={{ ...styles.settingsDropdown, ...themedStyles.dropdown }}>
                            <div style={styles.settingsSection}>
                                <div style={{ ...styles.settingsLabel, color: themedStyles.text.muted }}>Student</div>
                                <div style={{ ...styles.settingsValue, color: themedStyles.text.primary }}>
                                    {userData?.username || 'Learner'}
                                </div>
                            </div>
                            <div style={{ ...styles.settingsDivider, backgroundColor: themedStyles.borderColor }}></div>

                            <button
                                onClick={() => {
                                    setShowSettings(false);
                                    setShowAccountSettings(true);
                                }}
                                style={{ ...styles.settingsItem, color: themedStyles.text.primary }}
                            >
                                👤 Account Settings
                            </button>

                            <button
                                onClick={() => {
                                    setShowSettings(false);
                                    setShowPrivacyPolicy(true);
                                }}
                                style={{ ...styles.settingsItem, color: themedStyles.text.primary }}
                            >
                                🛡️ Privacy Policy
                            </button>

                            <button
                                onClick={() => {
                                    setShowSettings(false);
                                    setShowDiscussion(true);
                                }}
                                style={{ ...styles.settingsItem, color: themedStyles.text.primary }}
                            >
                                💬 Discussion Forum
                            </button>

                            <button
                                onClick={() => {
                                    setShowSettings(false);
                                    setShowFeedback(true);
                                }}
                                style={{ ...styles.settingsItem, color: themedStyles.text.primary }}
                            >
                                📝 Give Feedback
                            </button>

                            <button
                                onClick={setShowMessages}
                                style={{ ...styles.settingsItem, color: themedStyles.text.primary }}
                            >
                                ✉️ Messages
                            </button>

                            <div style={{ ...styles.settingsDivider, backgroundColor: themedStyles.borderColor }}></div>

                            <button
                                onClick={handleLogout}
                                style={styles.logoutBtnDropdown}
                            >
                                🔓 Logout
                            </button>
                        </div>
                    </>
                )}
            </div>
        </header>
    );
};
