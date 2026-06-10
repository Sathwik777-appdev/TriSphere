/**
 * Assignment Reminder Component
 * Checks for upcoming assignments and shows push notifications
 */
import React, { useEffect, useState, useCallback } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import {
    isNotificationSupported,
    requestNotificationPermission,
    showAssignmentReminder,
    checkAssignmentReminders,
    getNotificationPreferences,
    getShownNotificationsToday,
    markNotificationShown
} from '../services/notificationService';
import { infoToast, successToast } from '../utils/toast';

export const AssignmentReminder = ({ subject }) => {
    const { user, userData } = useAuth();
    const [permissionStatus, setPermissionStatus] = useState('default');
    const [upcomingAssignments, setUpcomingAssignments] = useState([]);
    const [showBanner, setShowBanner] = useState(false);

    // Check permission status on mount
    useEffect(() => {
        if (isNotificationSupported()) {
            setPermissionStatus(Notification.permission);
        }
    }, []);

    // Request permission handler
    const handleEnableNotifications = async () => {
        const permission = await requestNotificationPermission();
        setPermissionStatus(permission);

        if (permission === 'granted') {
            successToast('🔔 Notifications enabled! You\'ll be reminded before due dates.');
            checkForReminders();
        }
    };

    // Fetch and check assignments
    const checkForReminders = useCallback(async () => {
        if (!user?.uid && !userData?.uid) return;
        if (!userData?.class) return;

        const prefs = getNotificationPreferences();
        if (!prefs.enabled || !prefs.assignmentReminders) return;

        try {
            // Fetch active assignments for student's class
            const classInt = parseInt(userData.class);
            const classStr = String(userData.class);

            let assignmentsList = [];

            // Try with integer class
            let q = query(
                collection(db, 'assignments'),
                where('class', '==', classInt)
            );
            let snapshot = await getDocs(q);

            if (snapshot.docs.length === 0) {
                // Try with string class
                q = query(
                    collection(db, 'assignments'),
                    where('class', '==', classStr)
                );
                snapshot = await getDocs(q);
            }

            const schoolName = userData?.schoolName;
            const isDeveloper = userData?.role === 'developer';

            assignmentsList = snapshot.docs
                .filter(doc => {
                    if (isDeveloper || !schoolName) return true;
                    const docSchool = doc.data().schoolName;
                    return !docSchool || docSchool === schoolName;
                })
                .map(doc => ({ id: doc.id, ...doc.data() }));

            // Filter by subject if provided
            if (subject) {
                assignmentsList = assignmentsList.filter(a => a.subject === subject);
            }

            // Check for reminders
            const shownNotifications = getShownNotificationsToday();
            const reminders = await checkAssignmentReminders(assignmentsList, shownNotifications);

            // Update state for UI
            setUpcomingAssignments(reminders.map(r => ({
                ...r.assignment,
                daysLeft: r.daysLeft
            })));

            // Show notification banner if permission not granted
            if (reminders.length > 0 && permissionStatus !== 'granted' && permissionStatus !== 'denied') {
                setShowBanner(true);
            }

            // Show push notifications
            if (permissionStatus === 'granted') {
                reminders.forEach(({ assignment, daysLeft, notificationKey }) => {
                    showAssignmentReminder(assignment, daysLeft);
                    markNotificationShown(notificationKey);
                });
            }

        } catch (error) {
            console.error('Error checking assignment reminders:', error);
        }
    }, [user?.uid, userData?.uid, userData?.class, subject, permissionStatus]);

    // Check for reminders on mount and periodically
    useEffect(() => {
        checkForReminders();

        // Check every 30 minutes
        const interval = setInterval(checkForReminders, 30 * 60 * 1000);
        return () => clearInterval(interval);
    }, [checkForReminders]);

    // Don't render if no upcoming assignments
    if (upcomingAssignments.length === 0 && !showBanner) {
        return null;
    }

    return (
        <>
            {/* Permission Request Banner */}
            {showBanner && permissionStatus !== 'granted' && permissionStatus !== 'denied' && (
                <div style={styles.permissionBanner}>
                    <span style={styles.bellIcon}>🔔</span>
                    <div style={styles.bannerContent}>
                        <p style={styles.bannerText}>
                            <strong>Enable notifications</strong> to get reminders before assignment due dates!
                        </p>
                    </div>
                    <button onClick={handleEnableNotifications} style={styles.enableBtn}>
                        Enable
                    </button>
                    <button onClick={() => setShowBanner(false)} style={styles.dismissBtn}>
                        ✕
                    </button>
                </div>
            )}

            {/* Upcoming Due Dates Warning */}
            {upcomingAssignments.length > 0 && (
                <div style={styles.warningContainer}>
                    <div style={styles.warningHeader}>
                        <span style={styles.warningIcon}>⏰</span>
                        <span style={styles.warningTitle}>Upcoming Due Dates</span>
                    </div>
                    <div style={styles.assignmentList}>
                        {upcomingAssignments.map((assignment) => (
                            <div
                                key={assignment.id}
                                style={{
                                    ...styles.assignmentItem,
                                    ...(assignment.daysLeft <= 1 ? styles.urgent : {})
                                }}
                            >
                                <div style={styles.assignmentInfo}>
                                    <span style={styles.assignmentName}>
                                        {assignment.chapterName || assignment.assignmentTitle}
                                    </span>
                                    <span style={styles.subject}>{assignment.subject}</span>
                                </div>
                                <div style={styles.dueInfo}>
                                    {assignment.daysLeft === 0 && (
                                        <span style={styles.dueToday}>🚨 Due Today!</span>
                                    )}
                                    {assignment.daysLeft === 1 && (
                                        <span style={styles.dueTomorrow}>⚠️ Due Tomorrow</span>
                                    )}
                                    {assignment.daysLeft === 2 && (
                                        <span style={styles.dueSoon}>⏰ Due in 2 days</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
};

const styles = {
    permissionBanner: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        background: 'linear-gradient(135deg, #dbeafe, #ede9fe)',
        borderRadius: '12px',
        marginBottom: '16px',
        border: '1px solid #93c5fd'
    },
    bellIcon: {
        fontSize: '24px',
        animation: 'shake 0.5s ease-in-out infinite'
    },
    bannerContent: {
        flex: 1
    },
    bannerText: {
        margin: 0,
        fontSize: '14px',
        color: '#1e40af'
    },
    enableBtn: {
        padding: '8px 16px',
        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        fontWeight: '600',
        cursor: 'pointer',
        fontSize: '13px'
    },
    dismissBtn: {
        padding: '6px 10px',
        background: 'transparent',
        border: 'none',
        color: '#64748b',
        cursor: 'pointer',
        fontSize: '16px'
    },
    warningContainer: {
        background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
        border: '2px solid #f59e0b'
    },
    warningHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '12px'
    },
    warningIcon: {
        fontSize: '20px'
    },
    warningTitle: {
        fontSize: '16px',
        fontWeight: '700',
        color: '#92400e'
    },
    assignmentList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
    },
    assignmentItem: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 12px',
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderRadius: '8px',
        border: '1px solid #fbbf24'
    },
    urgent: {
        backgroundColor: '#fee2e2',
        border: '2px solid #ef4444'
    },
    assignmentInfo: {
        display: 'flex',
        flexDirection: 'column',
        gap: '2px'
    },
    assignmentName: {
        fontSize: '14px',
        fontWeight: '600',
        color: '#1f2937'
    },
    subject: {
        fontSize: '12px',
        color: '#6b7280'
    },
    dueInfo: {
        flexShrink: 0
    },
    dueToday: {
        padding: '4px 10px',
        backgroundColor: '#dc2626',
        color: 'white',
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: '700'
    },
    dueTomorrow: {
        padding: '4px 10px',
        backgroundColor: '#f59e0b',
        color: 'white',
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: '600'
    },
    dueSoon: {
        padding: '4px 10px',
        backgroundColor: '#3b82f6',
        color: 'white',
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: '600'
    }
};

// Add shake animation
if (typeof document !== 'undefined' && !document.querySelector('#shake-animation')) {
    const style = document.createElement('style');
    style.id = 'shake-animation';
    style.textContent = `
    @keyframes shake {
      0%, 100% { transform: rotate(0deg); }
      25% { transform: rotate(15deg); }
      75% { transform: rotate(-15deg); }
    }
  `;
    document.head.appendChild(style);
}

export default AssignmentReminder;
