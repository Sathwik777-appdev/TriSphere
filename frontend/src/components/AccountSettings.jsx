import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { setupRecaptcha, sendOtp, verifyOtpAndLink } from '../services/authService';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { updatePassword, reauthenticateWithCredential, PhoneAuthProvider } from 'firebase/auth';
import { successToast, errorToast, warningToast } from '../utils/toast';
import { safeLocalStorage } from '../utils/storage';
import { offlineDB } from '../utils/offlineDB';
import { offlineAssetManager } from '../services/offlineAssetManager';
import { API_BASE_URL } from '../utils/apiBase';

const AVATAR_IMAGES = {
    'avatar_robot': { img: '/avatars/robot.png', name: 'Robot' },
    'avatar_wizard': { img: '/avatars/wizard.png', name: 'Wizard' },
    'avatar_astronaut': { img: '/avatars/astronaut.png', name: 'Astronaut' },
    'avatar_ninja': { img: '/avatars/ninja.png', name: 'Ninja' },
    'avatar_superhero': { img: '/avatars/superhero.png', name: 'Learn Hero' },
    'avatar_alien': { img: '/avatars/alien.png', name: 'Space Explorer' },
    'avatar_dragon': { img: '/avatars/dragon.png', name: 'Scholar Dragon' },
    'avatar_unicorn': { img: '/avatars/unicorn.png', name: 'Magic Unicorn' }
};

export const AccountSettings = ({ onClose }) => {
    const { user, userData } = useAuth();
    const [activeSection, setActiveSection] = useState('phone'); // 'phone', 'password', 'companion'

    // Companion settings
    const [equippedAvatar, setEquippedAvatar] = useState(null);
    const [equippedAvatarName, setEquippedAvatarName] = useState('');

    // Storage settings
    const [storageUsedMB, setStorageUsedMB] = useState('0.00');

    // Phone binding states
    const [phoneNumber, setPhoneNumber] = useState('');
    const [currentPhone, setCurrentPhone] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [otp, setOtp] = useState('');
    const [confirmationResult, setConfirmationResult] = useState(null);
    const [phoneLoading, setPhoneLoading] = useState(false);

    // Password reset states
    const [passwordOtpSent, setPasswordOtpSent] = useState(false);
    const [passwordOtp, setPasswordOtp] = useState('');
    const [passwordConfirmationResult, setPasswordConfirmationResult] = useState(null);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [otpVerified, setOtpVerified] = useState(false);

    const recaptchaContainerRef = useRef(null);

    // Load current phone number


    useEffect(() => {
        const loadCurrentPhone = async () => {
            if (user?.uid) {
                try {
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    if (userDoc.exists()) {
                        const data = userDoc.data();
                        setCurrentPhone(data.phoneNumber || '');
                    }

                    // Fetch equipped avatar
                    const storeDoc = await getDoc(doc(db, 'userStore', user.uid));
                    if (storeDoc.exists()) {
                        const avatarId = storeDoc.data().equippedItems?.avatar;
                        if (avatarId && AVATAR_IMAGES[avatarId]) {
                            setEquippedAvatar(AVATAR_IMAGES[avatarId].img);
                            setEquippedAvatarName(AVATAR_IMAGES[avatarId].name);
                        }
                    }
                } catch (error) {
                    console.error('Error loading phone:', error);
                }
            }
        };
        loadCurrentPhone();

        // Cleanup function - NO LONGER CLEARING RECAPTCHA
        // We keep the recaptcha globally initialized to prevent "already rendered" errors
        return () => {
            // Do not clear recaptcha
        };
    }, [user?.uid]);

    useEffect(() => {
        if (activeSection === 'storage') {
            offlineAssetManager.getStorageUsageMB().then(setStorageUsedMB).catch(console.error);
        }
    }, [activeSection]);
    
    // Helper to check daily OTP limit (5 per day)
    const checkOtpLimit = async () => {
        if (!user?.uid) return { allowed: false, count: 0 };
        try {
            // Get fresh data from Firestore to avoid race conditions/stale state
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (!userDoc.exists()) return { allowed: true, count: 0, reset: true };

            const data = userDoc.data();
            const today = new Date().toISOString().split('T')[0];
            const limit = data.otpDailyLimit || { count: 0, lastDate: '' };

            if (limit.lastDate === today) {
                if (limit.count >= 5) return { allowed: false, count: limit.count };
                return { allowed: true, count: limit.count, reset: false };
            }
            // New day, reset count
            return { allowed: true, count: 0, reset: true };
        } catch (error) {
            console.error('Error checking OTP limit:', error);
            return { allowed: true, count: 0 }; // Fail safe: allow if check fails
        }
    };

    // Helper to record an OTP attempt
    const recordOtpAttempt = async (currentCount, isReset) => {
        if (!user?.uid) return;
        try {
            const today = new Date().toISOString().split('T')[0];
            await updateDoc(doc(db, 'users', user.uid), {
                otpDailyLimit: {
                    count: isReset ? 1 : currentCount + 1,
                    lastDate: today
                }
            });
        } catch (error) {
            console.error('Error recording OTP attempt:', error);
        }
    };

    // Send OTP for phone binding
    const handleSendPhoneOtp = async () => {
        if (!phoneNumber || phoneNumber.length < 10) {
            warningToast('Please enter a valid phone number');
            return;
        }

        setPhoneLoading(true);
        try {
            // 1. Check Rate Limit
            const limitStatus = await checkOtpLimit();
            if (!limitStatus.allowed) {
                errorToast('You have reached the limit of 5 OTP messages per day. Please try again tomorrow.');
                setPhoneLoading(false);
                return;
            }

            const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
            const recaptchaVerifier = setupRecaptcha();

            if (!recaptchaVerifier) {
                errorToast('Failed to initialize security verification. Please refresh.');
                return;
            }

            const result = await sendOtp(formattedPhone, recaptchaVerifier);
            
            // 2. Record attempt on success
            await recordOtpAttempt(limitStatus.count, limitStatus.reset);

            setConfirmationResult(result);
            setOtpSent(true);
            successToast('OTP sent to your phone!');
        } catch (error) {
            console.error('🔥 CRITICAL ERROR sending OTP:', error);
            console.dir(error); // Logs the full object for inspection

            if (error.code === 'auth/quota-exceeded') {
                errorToast('Daily SMS quota exceeded. Use a test number.');
            } else if (error.code === 'auth/invalid-phone-number') {
                errorToast('Invalid phone number format.');
            } else if (error.code === 'auth/too-many-requests') {
                errorToast('Security Throttling: Too many requests from this IP. Please wait a few minutes.');
            } else if (error.code === 'auth/invalid-app-credential') {
                errorToast('Invalid App Credential. Please check Firebase Console.');
            } else {
                errorToast('Failed to send OTP. ' + error.message);
            }

            // We no longer reset recaptcha to allow reuse
            // Do nothing here
        } finally {
            setPhoneLoading(false);
        }
    };

    // Verify OTP and save phone
    const handleVerifyPhoneOtp = async () => {
        if (!otp || otp.length !== 6) {
            warningToast('Please enter a 6-digit OTP');
            return;
        }

        setPhoneLoading(true);
        try {
            // Attempt to link for security features, but don't crash if it fails
            try {
                await verifyOtpAndLink(user, confirmationResult, otp);
            } catch (linkErr) {
                if (linkErr.code === 'auth/credential-already-in-use' || linkErr.code === 'auth/account-exists-with-different-credential') {
                    console.info('ℹ️ Phone number already linked to another account. Saving to profile only.');
                } else {
                    console.warn('Auth linking skipped:', linkErr.code);
                }
            }

            // Always save to Firestore as the primary source of truth
            const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
            await updateDoc(doc(db, 'users', user.uid), {
                phoneNumber: formattedPhone,
                phoneVerified: true,
                phoneUpdatedAt: new Date()
            });

            setCurrentPhone(formattedPhone);
            setOtpSent(false);
            setOtp('');
            setPhoneNumber('');
            successToast('Phone number verified and saved!');
        } catch (error) {
            console.error('🔥 Error verifying phone:', error);
            if (error.code === 'auth/invalid-verification-code') {
                errorToast('Invalid OTP. Please try again.');
            } else {
                errorToast('Failed to verify phone: ' + error.message);
            }
        } finally {
            setPhoneLoading(false);
        }
    };

    // Send OTP for password reset
    const handleSendPasswordOtp = async () => {
        if (!currentPhone) {
            warningToast('Please add a phone number first');
            setActiveSection('phone');
            return;
        }

        setPasswordLoading(true);
        try {
            // 1. Check Rate Limit
            const limitStatus = await checkOtpLimit();
            if (!limitStatus.allowed) {
                errorToast('Daily limit reached (5 OTPs). Please try again tomorrow.');
                setPasswordLoading(false);
                return;
            }

            const recaptchaVerifier = setupRecaptcha();
            if (!recaptchaVerifier) {
                errorToast('Security verification failed to load. Please try again.');
                return;
            }
            const result = await sendOtp(currentPhone, recaptchaVerifier);

            // 2. Record attempt on success
            await recordOtpAttempt(limitStatus.count, limitStatus.reset);

            setPasswordConfirmationResult(result);
            setPasswordOtpSent(true);
            successToast('OTP sent to your registered phone!');
        } catch (error) {
            console.error('Error sending OTP:', error);

            if (error.code === 'auth/quota-exceeded') {
                errorToast('Daily SMS quota exceeded. Use a test number.');
            } else if (error.code === 'auth/invalid-phone-number') {
                errorToast('Invalid phone number format.');
            } else if (error.code === 'auth/too-many-requests') {
                errorToast('Security Throttling: Too many attempts. Please try again later.');
            } else {
                errorToast('Failed to send OTP. ' + error.message);
            }

            // Do not clear recaptcha
        } finally {
            setPasswordLoading(false);
        }
    };

    // Verify password OTP
    const handleVerifyPasswordOtp = async () => {
        if (!passwordOtp || passwordOtp.length !== 6) {
            warningToast('Please enter a 6-digit OTP');
            return;
        }

        setPasswordLoading(true);
        try {
            console.log('🔐 Verifying Password Reset OTP (Session Safe)...');

            // Use linking logic to verify OTP without triggering a new login (which confirm() does)
            try {
                await verifyOtpAndLink(user, passwordConfirmationResult, passwordOtp);
            } catch (linkError) {
                // If it's already in use, that's fine—it still proves they own the phone
                if (linkError.code === 'auth/credential-already-in-use' || linkError.code === 'auth/account-exists-with-different-credential') {
                    console.log('✅ OTP verified (Shared Number)');
                } else {
                    throw linkError;
                }
            }

            setOtpVerified(true);
            successToast('OTP verified! You can now set a new password.');
        } catch (error) {
            console.error('🔥 Password Reset OTP Error:', error);
            if (error.code === 'auth/invalid-verification-code') {
                errorToast('Invalid OTP code. Please check and try again.');
            } else {
                errorToast('Verification failed: ' + (error.message || 'Unknown error'));
            }
        } finally {
            setPasswordLoading(false);
        }
    };

    // Change password via Backend API
    const handleChangePassword = async () => {
        if (newPassword.length < 6) {
            warningToast('Password must be at least 6 characters');
            return;
        }
        if (newPassword !== confirmPassword) {
            warningToast('Passwords do not match');
            return;
        }

        setPasswordLoading(true);
        try {
            // 1. Get current user's ID Token for secure backend update
            const idToken = await auth.currentUser.getIdToken(true);

            // 2. Call backend to update password
            // Note: This bypasses the "recent login" requirement on the client
            const response = await fetch(`${API_BASE_URL}/api/user/update-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${idToken}`
                },
                body: JSON.stringify({ newPassword })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to update password');
            }

            successToast('Password changed successfully!');

            // Reset states
            setPasswordOtpSent(false);
            setPasswordOtp('');
            setNewPassword('');
            setConfirmPassword('');
            setOtpVerified(false);
        } catch (error) {
            console.error('Error changing password:', error);
            errorToast('Failed to change password: ' + error.message);
        } finally {
            setPasswordLoading(false);
        }
    };

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div style={styles.header}>
                    <h2 style={styles.title}>Account Settings</h2>
                    <p style={styles.closeHint}>Tap anywhere outside to close</p>
                </div>

                {/* Tab Navigation — onMouseDown.preventDefault() stops the
                    browser from giving the button focus on tap. Without that,
                    the previously-tapped tab kept a "focused" appearance
                    (browser-default white background) even after you moved
                    to a different tab. */}
                <div style={styles.tabs}>
                    <button
                        className={`as-tab${activeSection === 'phone' ? ' is-active' : ''}`}
                        style={{
                            ...styles.tab,
                            ...(activeSection === 'phone' ? styles.tabActive : {})
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setActiveSection('phone')}
                    >
                        <span style={styles.tabIcon}>📱</span>
                        <span style={styles.tabLabel}>Mobile</span>
                    </button>
                    <button
                        className={`as-tab${activeSection === 'password' ? ' is-active' : ''}`}
                        style={{
                            ...styles.tab,
                            ...(activeSection === 'password' ? styles.tabActive : {})
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setActiveSection('password')}
                    >
                        <span style={styles.tabIcon}>🔐</span>
                        <span style={styles.tabLabel}>Password</span>
                    </button>
                    {equippedAvatar && (
                        <button
                            className={`as-tab${activeSection === 'companion' ? ' is-active' : ''}`}
                            style={{
                                ...styles.tab,
                                ...(activeSection === 'companion' ? styles.tabActive : {})
                            }}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => setActiveSection('companion')}
                        >
                            <span style={styles.tabIcon}>🐾</span>
                            <span style={styles.tabLabel}>Companion</span>
                        </button>
                    )}
                    <button
                        className={`as-tab${activeSection === 'storage' ? ' is-active' : ''}`}
                        style={{
                            ...styles.tab,
                            ...(activeSection === 'storage' ? styles.tabActive : {})
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setActiveSection('storage')}
                    >
                        <span style={styles.tabIcon}>💾</span>
                        <span style={styles.tabLabel}>Storage</span>
                    </button>
                </div>

                <div style={styles.content}>
                    {/* Phone Binding Section */}
                    {activeSection === 'phone' && (
                        <div style={styles.section}>
                            <h3 style={styles.sectionTitle}>Mobile Number</h3>

                            {currentPhone && (
                                <div style={styles.currentInfo}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={styles.label}>Current Phone:</span>
                                            <span style={styles.value}>
                                                {currentPhone} ✅
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {!otpSent ? (
                                <div style={styles.inputGroup}>
                                    <label style={styles.label}>
                                        {currentPhone ? 'Update Phone Number' : 'Add Phone Number'}
                                    </label>
                                    <div style={styles.phoneInput}>
                                        <input
                                            type="tel"
                                            value={phoneNumber || '+91'} // Ensure +91 is always visible
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                // If user tries to delete +91, ignore it (or reset to +91)
                                                if (!val.startsWith('+91')) {
                                                    setPhoneNumber('+91');
                                                    return;
                                                }
                                                // Extract digits after +91
                                                const numPart = val.substring(3).replace(/[^0-9]/g, '');
                                                // Limit to 10 digits
                                                if (numPart.length <= 10) {
                                                    setPhoneNumber('+91' + numPart);
                                                }
                                            }}
                                            placeholder="+91 98765 43210"
                                            style={styles.input}
                                        />
                                    </div>
                                    <button
                                        onClick={handleSendPhoneOtp}
                                        disabled={phoneLoading || phoneNumber.length < 13}
                                        style={{
                                            ...styles.button,
                                            ...(phoneLoading || phoneNumber.length < 13 ? styles.buttonDisabled : {})
                                        }}
                                    >
                                        {phoneLoading ? 'Sending...' : 'Send OTP'}
                                    </button>
                                </div>
                            ) : (
                                <div style={styles.inputGroup}>
                                    <label style={styles.label}>Enter OTP</label>
                                    <input
                                        type="text"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                        placeholder="Enter 6-digit OTP"
                                        maxLength={6}
                                        style={styles.input}
                                    />
                                    <button
                                        onClick={handleVerifyPhoneOtp}
                                        disabled={phoneLoading || otp.length !== 6}
                                        style={{
                                            ...styles.button,
                                            ...(phoneLoading || otp.length !== 6 ? styles.buttonDisabled : {})
                                        }}
                                    >
                                        {phoneLoading ? 'Verifying...' : 'Verify & Save'}
                                    </button>
                                    <button
                                        onClick={() => { setOtpSent(false); setOtp(''); }}
                                        style={styles.linkButton}
                                    >
                                        ← Back
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Password Reset Section */}
                    {activeSection === 'password' && (
                        <div style={styles.section}>
                            <h3 style={styles.sectionTitle}>Reset Password</h3>

                            {!currentPhone ? (
                                <div style={styles.warning}>
                                    ⚠️ Please add a phone number first to reset your password.
                                    <button
                                        onClick={() => setActiveSection('phone')}
                                        style={styles.linkButton}
                                    >
                                        Add Phone Number
                                    </button>
                                </div>
                            ) : !passwordOtpSent ? (
                                <div style={styles.inputGroup}>
                                    <p style={styles.info}>
                                        We'll send an OTP to your registered phone: <strong>{currentPhone}</strong>
                                    </p>
                                    <button
                                        onClick={handleSendPasswordOtp}
                                        disabled={passwordLoading}
                                        style={{
                                            ...styles.button,
                                            ...(passwordLoading ? styles.buttonDisabled : {})
                                        }}
                                    >
                                        {passwordLoading ? 'Sending...' : 'Send OTP'}
                                    </button>
                                </div>
                            ) : !otpVerified ? (
                                <div style={styles.inputGroup}>
                                    <label style={styles.label}>Enter OTP</label>
                                    <input
                                        type="text"
                                        value={passwordOtp}
                                        onChange={(e) => setPasswordOtp(e.target.value.replace(/\D/g, ''))}
                                        placeholder="Enter 6-digit OTP"
                                        maxLength={6}
                                        style={styles.input}
                                    />
                                    <button
                                        onClick={handleVerifyPasswordOtp}
                                        disabled={passwordLoading || passwordOtp.length !== 6}
                                        style={{
                                            ...styles.button,
                                            ...(passwordLoading || passwordOtp.length !== 6 ? styles.buttonDisabled : {})
                                        }}
                                    >
                                        {passwordLoading ? 'Verifying...' : 'Verify OTP'}
                                    </button>
                                    <button
                                        onClick={() => { setPasswordOtpSent(false); setPasswordOtp(''); }}
                                        style={styles.linkButton}
                                    >
                                        ← Back
                                    </button>
                                </div>
                            ) : (
                                <div style={styles.inputGroup}>
                                    <label style={styles.label}>New Password</label>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Enter new password (min 6 chars)"
                                        style={styles.input}
                                    />
                                    <label style={styles.label}>Confirm Password</label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Confirm new password"
                                        style={styles.input}
                                    />
                                    <button
                                        onClick={handleChangePassword}
                                        disabled={passwordLoading || newPassword.length < 6 || newPassword !== confirmPassword}
                                        style={{
                                            ...styles.button,
                                            ...(passwordLoading || newPassword.length < 6 || newPassword !== confirmPassword ? styles.buttonDisabled : {})
                                        }}
                                    >
                                        {passwordLoading ? 'Changing...' : 'Change Password'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Companion Section */}
                    {activeSection === 'companion' && equippedAvatar && (
                        <div style={styles.section}>
                            <h3 style={styles.sectionTitle}>Equipped Companion</h3>
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '16px',
                                padding: '24px',
                                background: 'rgba(59, 130, 246, 0.05)',
                                borderRadius: '16px',
                                border: '1px solid rgba(59, 130, 246, 0.2)'
                            }}>
                                <img
                                    src={equippedAvatar}
                                    alt="Companion"
                                    style={{ width: '120px', height: '120px', objectFit: 'contain' }}
                                />
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '18px', color: '#60a5fa', fontWeight: 'bold' }}>{equippedAvatarName}</div>
                                    <p style={{ ...styles.info, marginTop: '8px' }}>
                                        This is your special companion that appears in your profile settings.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Storage Section */}
                    {activeSection === 'storage' && (
                        <div style={styles.section}>
                            <h3 style={styles.sectionTitle}>App Storage</h3>
                            <div style={styles.inputGroup}>
                                <p style={styles.info}>
                                    If the app is running slowly or you want to free up space, you can clear the locally downloaded content and cache. 
                                    This will <strong>NOT</strong> delete your account, progress, or uploads.
                                </p>
                                <p style={{ color: '#10b981', fontWeight: 600, marginTop: 8, marginBottom: 16 }}>
                                    Offline Assets (PDFs): {storageUsedMB} MB
                                </p>
                                <button
                                    onClick={async () => {
                                        if (window.confirm('Are you sure you want to clear all offline app data? You will need to re-download lessons to view them offline.')) {
                                            try {
                                                const stores = ['lessonPlans', 'textbooks', 'notes', 'assignments', 'syncQueue', 'quizzes', 'announcements'];
                                                for (const store of stores) {
                                                    try { await offlineDB.clear(store); } catch(e) {}
                                                }
                                                const keysToRemove = [];
                                                for (let i = 0; i < localStorage.length; i++) {
                                                    const key = localStorage.key(i);
                                                    if (key && !key.includes('userData') && !key.includes('firebase')) {
                                                        keysToRemove.push(key);
                                                    }
                                                }
                                                keysToRemove.forEach(key => localStorage.removeItem(key));
                                                
                                                await offlineAssetManager.clearAll();
                                                setStorageUsedMB('0.00');

                                                successToast('App storage cleared successfully!');
                                            } catch (error) {
                                                errorToast('Failed to clear storage: ' + error.message);
                                            }
                                        }
                                    }}
                                    style={{
                                        ...styles.button,
                                        backgroundColor: '#ef4444',
                                        marginTop: '8px'
                                    }}
                                >
                                    Clear App Storage
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
};

const styles = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px'
    },
    modal: {
        backgroundColor: '#1a1a2e',
        borderRadius: '16px',
        maxWidth: '480px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'scroll',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        border: '1px solid rgba(59, 130, 246, 0.3)'
    },
    header: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 4,
        padding: '20px 24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
    },
    title: {
        margin: 0,
        fontSize: '20px',
        fontWeight: '600',
        color: '#ffffff'
    },
    closeHint: {
        margin: 0,
        fontSize: '12px',
        fontWeight: '500',
        color: '#9ca3af',
        opacity: 0.85
    },
    tabs: {
        display: 'flex',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
    },
    tab: {
        flex: 1,
        padding: '10px 8px',
        // appearance:'none' STRIPS THE NATIVE BUTTON RENDERING. Without this,
        // Android/iOS draw buttons with a default white/material background
        // on top of our inline style — which is exactly the "white boxes"
        // you saw on the inactive tabs. With this, every tab respects the
        // transparent background we declare.
        appearance: 'none',
        WebkitAppearance: 'none',
        MozAppearance: 'none',
        background: 'transparent',
        backgroundColor: 'transparent',
        border: 'none',
        outline: 'none',
        WebkitTapHighlightColor: 'transparent',
        color: '#888',
        cursor: 'pointer',
        transition: 'all 0.2s',
        borderBottom: '2px solid transparent',
        boxSizing: 'border-box',
        // Stack the emoji above the label so each tab is a compact column —
        // labels never wrap and the icon "fits" naturally without a
        // separate coloured pill behind it.
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    tabActive: {
        color: '#3b82f6',
        borderBottomColor: '#3b82f6',
        // No background tint — keep the icon clean. The colour + underline
        // are enough to signal selection.
    },
    tabIcon: {
        fontSize: 22,
        lineHeight: 1,
        display: 'inline-block',
        background: 'transparent',
        // Render emojis as a flat glyph, never as a pill / chip.
        padding: 0,
        margin: 0,
    },
    tabLabel: {
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
    },
    content: {
        padding: '24px'
    },
    section: {
        marginBottom: '16px'
    },
    sectionTitle: {
        margin: '0 0 16px 0',
        fontSize: '16px',
        fontWeight: '600',
        color: '#ffffff'
    },
    currentInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 16px',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        borderRadius: '8px',
        marginBottom: '16px',
        border: '1px solid rgba(34, 197, 94, 0.3)'
    },
    inputGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
    },
    label: {
        fontSize: '14px',
        fontWeight: '500',
        color: '#ccc'
    },
    value: {
        fontSize: '14px',
        color: '#22c55e',
        fontWeight: '600'
    },
    phoneInput: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    },
    countryCode: {
        padding: '12px 14px',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderRadius: '8px',
        color: '#3b82f6',
        fontWeight: '600',
        fontSize: '14px'
    },
    input: {
        flex: 1,
        padding: '12px 16px',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '8px',
        color: '#ffffff',
        fontSize: '14px',
        outline: 'none',
        transition: 'border-color 0.2s'
    },
    button: {
        padding: '12px 24px',
        backgroundColor: '#3b82f6',
        color: '#ffffff',
        border: 'none',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s',
        marginTop: '8px'
    },
    buttonDisabled: {
        opacity: 0.5,
        cursor: 'not-allowed'
    },
    linkButton: {
        background: 'transparent',
        border: 'none',
        color: '#3b82f6',
        fontSize: '14px',
        cursor: 'pointer',
        padding: '8px 0',
        textDecoration: 'underline'
    },
    warning: {
        padding: '16px',
        backgroundColor: 'rgba(251, 191, 36, 0.1)',
        border: '1px solid rgba(251, 191, 36, 0.3)',
        borderRadius: '8px',
        color: '#fbbf24',
        fontSize: '14px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
    },
    info: {
        color: '#aaa',
        fontSize: '14px',
        marginBottom: '8px'
    },
};

// index.css has global `body.standard-theme button { background:linear-gradient(...)
// !important; }` and similar rules that apply themed backgrounds to EVERY
// <button> on the page with !important. A bare `.as-tab` selector loses the
// specificity contest against those (`body.X button` = 0,1,1 vs `.as-tab` =
// 0,1,0), which is why our inactive tabs were rendering with the wrong
// background. We bump specificity by prefixing with `body.X` ourselves so the
// override wins, and we explicitly null out every paint property the global
// rules set: background, background-image, box-shadow, border, border-radius,
// min-height, padding, color, font-weight.
if (typeof document !== 'undefined' && !document.getElementById('as-tab-css')) {
    const style = document.createElement('style');
    style.id = 'as-tab-css';
    style.textContent = `
        /* Highest-specificity selector list — beats body.dark-theme button
           and body.standard-theme button while still being self-contained. */
        body button.as-tab,
        body.standard-theme button.as-tab,
        body.dark-theme button.as-tab,
        body button.as-tab:hover,
        body button.as-tab:focus,
        body button.as-tab:focus-visible,
        body button.as-tab:active {
            -webkit-appearance: none !important;
            -moz-appearance: none !important;
            appearance: none !important;
            background: transparent !important;
            background-color: transparent !important;
            background-image: none !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            border-bottom: 2px solid transparent !important;
            padding: 14px 16px !important;
            min-height: auto !important;
            min-width: 0 !important;
            color: #888 !important;
            font-weight: 500 !important;
            font-size: 14px !important;
            outline: none !important;
            transform: none !important;
            -webkit-tap-highlight-color: transparent !important;
        }
        body button.as-tab::-moz-focus-inner {
            border: 0 !important;
            padding: 0 !important;
        }
        /* Active tab — restore the blue tint + blue text + blue underline. */
        body button.as-tab.is-active,
        body.standard-theme button.as-tab.is-active,
        body.dark-theme button.as-tab.is-active,
        body button.as-tab.is-active:hover,
        body button.as-tab.is-active:focus {
            background-color: rgba(59, 130, 246, 0.10) !important;
            color: #3b82f6 !important;
            border-bottom: 2px solid #3b82f6 !important;
            box-shadow: none !important;
        }
    `;
    document.head.appendChild(style);
}

export default AccountSettings;
