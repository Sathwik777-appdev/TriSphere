/**
 * Daily Challenges Component
 * Displays daily and weekly challenges with XP rewards and progress tracking
 */
import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, setDoc, getDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { successToast } from '../utils/toast';

// Challenge definitions
const DAILY_CHALLENGES = [
    {
        id: 'daily_quiz_1',
        type: 'daily',
        title: 'Quiz Warrior',
        description: 'Complete 1 quiz today',
        icon: '🎯',
        xpReward: 50,
        requirement: { type: 'quiz_count', target: 1 }
    },
    {
        id: 'daily_quiz_3',
        type: 'daily',
        title: 'Quiz Champion',
        description: 'Complete 3 quizzes today',
        icon: '🏆',
        xpReward: 150,
        requirement: { type: 'quiz_count', target: 3 }
    },
    {
        id: 'daily_high_score',
        type: 'daily',
        title: 'Excellence Seeker',
        description: 'Score 80%+ on any quiz',
        icon: '⭐',
        xpReward: 75,
        requirement: { type: 'high_score', target: 80 }
    },
    {
        id: 'daily_video',
        type: 'daily',
        title: 'Video Learner',
        description: 'Watch 1 educational video',
        icon: '📺',
        xpReward: 30,
        requirement: { type: 'video_watch', target: 1 }
    },
    {
        id: 'daily_notes',
        type: 'daily',
        title: 'Note Taker',
        description: 'Review notes for any chapter',
        icon: '📝',
        xpReward: 25,
        requirement: { type: 'notes_view', target: 1 }
    }
];

const WEEKLY_CHALLENGES = [
    {
        id: 'weekly_quiz_10',
        type: 'weekly',
        title: 'Weekly Quiz Master',
        description: 'Complete 10 quizzes this week',
        icon: '🎯',
        xpReward: 500,
        requirement: { type: 'quiz_count', target: 10 }
    },
    {
        id: 'weekly_streak',
        type: 'weekly',
        title: 'Streak Hero',
        description: 'Login every day this week',
        icon: '🔥',
        xpReward: 300,
        requirement: { type: 'login_streak', target: 7 }
    },
    {
        id: 'weekly_perfect',
        type: 'weekly',
        title: 'Perfectionist',
        description: 'Get 100% on 3 quizzes',
        icon: '💯',
        xpReward: 400,
        requirement: { type: 'perfect_quizzes', target: 3 }
    },
    {
        id: 'weekly_subjects',
        type: 'weekly',
        title: 'All-Rounder',
        description: 'Study 5 different subjects',
        icon: '📚',
        xpReward: 350,
        requirement: { type: 'subject_variety', target: 5 }
    },
    {
        id: 'weekly_assignment',
        type: 'weekly',
        title: 'Assignment Crusher',
        description: 'Submit 2 assignments',
        icon: '✅',
        xpReward: 250,
        requirement: { type: 'assignment_submit', target: 2 }
    }
];

export const DailyChallenges = ({ compact = false }) => {
    const { user, userData } = useAuth();
    const [activeTab, setActiveTab] = useState('daily');
    const [challenges, setChallenges] = useState({ daily: [], weekly: [] });
    const [progress, setProgress] = useState({});
    const [completedToday, setCompletedToday] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [timeUntilReset, setTimeUntilReset] = useState('');

    // Calculate time until daily reset (midnight)
    useEffect(() => {
        const updateTimer = () => {
            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);

            const diff = tomorrow - now;
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

            setTimeUntilReset(`${hours}h ${minutes}m`);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 60000); // Update every minute
        return () => clearInterval(interval);
    }, []);

    // Fetch challenges and progress
    useEffect(() => {
        const fetchChallengesAndProgress = async () => {
            if (!user?.uid) return;

            try {
                setLoading(true);

                // Get today's date string for daily challenges
                const today = new Date().toISOString().split('T')[0];

                // Get start of week for weekly challenges
                const now = new Date();
                const startOfWeek = new Date(now);
                startOfWeek.setDate(now.getDate() - now.getDay());
                startOfWeek.setHours(0, 0, 0, 0);

                // Fetch completed challenges
                const completedQuery = query(
                    collection(db, 'challengeProgress'),
                    where('userId', '==', user.uid)
                );
                const completedSnapshot = await getDocs(completedQuery);
                const completed = new Set();

                completedSnapshot.docs.forEach(doc => {
                    const data = doc.data();
                    const completedAt = data.completedAt?.toDate?.() || new Date(data.completedAt);

                    // Check if daily challenge was completed today
                    if (data.type === 'daily' && completedAt.toISOString().split('T')[0] === today) {
                        completed.add(data.challengeId);
                    }

                    // Check if weekly challenge was completed this week
                    if (data.type === 'weekly' && completedAt >= startOfWeek) {
                        completed.add(data.challengeId);
                    }
                });

                setCompletedToday(completed);

                // Calculate current progress
                const currentProgress = await calculateProgress(user.uid, today, startOfWeek);
                setProgress(currentProgress);

                // Filter available challenges (show only relevant ones based on current time)
                const availableDaily = selectDailyChallenges(DAILY_CHALLENGES, 3);
                const availableWeekly = selectWeeklyChallenges(WEEKLY_CHALLENGES, 3);

                setChallenges({
                    daily: availableDaily,
                    weekly: availableWeekly
                });

            } catch (error) {
                console.error('Error fetching challenges:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchChallengesAndProgress();
    }, [user?.uid]);

    // Select random challenges for the day
    const selectDailyChallenges = (allChallenges, count) => {
        // Use date as seed for consistent daily selection
        const today = new Date().toISOString().split('T')[0];
        const seed = today.split('-').reduce((a, b) => a + parseInt(b), 0);

        const shuffled = [...allChallenges].sort((a, b) => {
            return (a.id.charCodeAt(0) + seed) - (b.id.charCodeAt(0) + seed);
        });

        return shuffled.slice(0, count);
    };

    const selectWeeklyChallenges = (allChallenges, count) => {
        // Use week number as seed
        const now = new Date();
        const weekNum = Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000));

        const shuffled = [...allChallenges].sort((a, b) => {
            return (a.id.charCodeAt(0) + weekNum) - (b.id.charCodeAt(0) + weekNum);
        });

        return shuffled.slice(0, count);
    };

    // Calculate progress for all challenge types
    const calculateProgress = async (userId, today, startOfWeek) => {
        const prog = {};

        try {
            // Fetch today's quiz results (limited to 100)
            const quizQuery = query(
                collection(db, 'quizResults'),
                where('studentId', '==', userId),
                limit(100)
            );
            const quizSnapshot = await getDocs(quizQuery);

            let todayQuizzes = 0;
            let todayHighScores = 0;
            let weeklyQuizzes = 0;
            let weeklyPerfect = 0;
            const weeklySubjects = new Set();

            quizSnapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.malpractice) return;

                const timestamp = data.completedAt?.toDate?.() || data.timestamp?.toDate?.() || new Date(data.timestamp || 0);
                const quizDate = timestamp.toISOString().split('T')[0];

                // Today's quizzes
                if (quizDate === today) {
                    todayQuizzes++;
                    if (data.score >= 80) todayHighScores++;
                }

                // Weekly quizzes
                if (timestamp >= startOfWeek) {
                    weeklyQuizzes++;
                    if (data.score === 100) weeklyPerfect++;
                    if (data.subject) weeklySubjects.add(data.subject);
                }
            });

            // Fetch today's activities (limited to 100)
            const activityQuery = query(
                collection(db, 'activityLogs'),
                where('userId', '==', userId),
                orderBy('timestamp', 'desc'),
                limit(100)
            );
            const activitySnapshot = await getDocs(activityQuery);

            let todayVideos = 0;
            let todayNotes = 0;
            let weeklyLoginDays = new Set();

            activitySnapshot.docs.forEach(doc => {
                const data = doc.data();
                const timestamp = data.timestamp?.toDate?.() || new Date(data.timestamp || 0);
                const actDate = timestamp.toISOString().split('T')[0];

                if (actDate === today) {
                    if (data.type === 'video_watch') todayVideos++;
                    if (data.type === 'notes_view') todayNotes++;
                }

                if (timestamp >= startOfWeek) {
                    weeklyLoginDays.add(actDate);
                }
            });

            // Fetch weekly assignments (limited to 100)
            const assignmentQuery = query(
                collection(db, 'studentSubmissions'),
                where('studentId', '==', userId),
                limit(100)
            );
            const assignmentSnapshot = await getDocs(assignmentQuery);

            let weeklyAssignments = 0;
            assignmentSnapshot.docs.forEach(doc => {
                const data = doc.data();
                const timestamp = data.submittedAt?.toDate?.() || new Date(data.submittedAt || 0);
                if (timestamp >= startOfWeek) {
                    weeklyAssignments++;
                }
            });

            // Map progress
            prog['daily_quiz_1'] = todayQuizzes;
            prog['daily_quiz_3'] = todayQuizzes;
            prog['daily_high_score'] = todayHighScores > 0 ? 1 : 0;
            prog['daily_video'] = todayVideos;
            prog['daily_notes'] = todayNotes;

            prog['weekly_quiz_10'] = weeklyQuizzes;
            prog['weekly_streak'] = weeklyLoginDays.size;
            prog['weekly_perfect'] = weeklyPerfect;
            prog['weekly_subjects'] = weeklySubjects.size;
            prog['weekly_assignment'] = weeklyAssignments;

        } catch (error) {
            console.error('Error calculating progress:', error);
        }

        return prog;
    };

    // Claim challenge reward
    const claimReward = async (challenge) => {
        if (!user?.uid) return;

        const currentProgress = progress[challenge.id] || 0;
        if (currentProgress < challenge.requirement.target) return;
        if (completedToday.has(challenge.id)) return;

        try {
            const docId = `${user.uid}_${challenge.id}_${new Date().toISOString().split('T')[0]}`;

            await setDoc(doc(db, 'challengeProgress', docId), {
                userId: user.uid,
                challengeId: challenge.id,
                type: challenge.type,
                xpAwarded: challenge.xpReward,
                completedAt: serverTimestamp()
            });

            setCompletedToday(prev => new Set([...prev, challenge.id]));
            successToast(`🎉 Challenge completed! +${challenge.xpReward} XP`);

        } catch (error) {
            console.error('Error claiming reward:', error);
        }
    };

    const displayChallenges = activeTab === 'daily' ? challenges.daily : challenges.weekly;

    if (loading) {
        return (
            <div style={styles.container}>
                <div style={styles.loading}>Loading challenges...</div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <div>
                    <h3 style={styles.title}>⚔️ Daily Challenges</h3>
                    <p style={styles.resetTimer}>Resets in {timeUntilReset}</p>
                </div>
            </div>

            {/* Tab Toggle */}
            {!compact && (
                <div style={styles.tabToggle}>
                    <button
                        onClick={() => setActiveTab('daily')}
                        style={{
                            ...styles.tabBtn,
                            ...(activeTab === 'daily' ? styles.tabBtnActive : {})
                        }}
                    >
                        📅 Daily
                    </button>
                    <button
                        onClick={() => setActiveTab('weekly')}
                        style={{
                            ...styles.tabBtn,
                            ...(activeTab === 'weekly' ? styles.tabBtnActive : {})
                        }}
                    >
                        📆 Weekly
                    </button>
                </div>
            )}

            {/* Challenges List */}
            <div style={styles.challengeList}>
                {displayChallenges.map(challenge => {
                    const currentProgress = progress[challenge.id] || 0;
                    const target = challenge.requirement.target;
                    const percentage = Math.min(100, Math.round((currentProgress / target) * 100));
                    const isComplete = currentProgress >= target;
                    const isClaimed = completedToday.has(challenge.id);

                    return (
                        <div
                            key={challenge.id}
                            style={{
                                ...styles.challengeCard,
                                ...(isClaimed ? styles.challengeClaimed : {}),
                                ...(isComplete && !isClaimed ? styles.challengeComplete : {})
                            }}
                        >
                            <div style={styles.challengeIcon}>{challenge.icon}</div>

                            <div style={styles.challengeInfo}>
                                <p style={styles.challengeTitle}>{challenge.title}</p>
                                <p style={styles.challengeDesc}>{challenge.description}</p>

                                <div style={styles.progressContainer}>
                                    <div style={styles.progressBar}>
                                        <div
                                            style={{
                                                ...styles.progressFill,
                                                width: `${percentage}%`,
                                                background: isComplete
                                                    ? 'linear-gradient(90deg, #10b981, #059669)'
                                                    : 'linear-gradient(90deg, #3b82f6, #60a5fa)'
                                            }}
                                        />
                                    </div>
                                    <span style={styles.progressText}>
                                        {currentProgress}/{target}
                                    </span>
                                </div>
                            </div>

                            <div style={styles.rewardSection}>
                                <div style={styles.xpBadge}>+{challenge.xpReward} XP</div>

                                {isClaimed ? (
                                    <span style={styles.claimedBadge}>✓ Claimed</span>
                                ) : isComplete ? (
                                    <button
                                        onClick={() => claimReward(challenge)}
                                        style={styles.claimBtn}
                                    >
                                        Claim!
                                    </button>
                                ) : (
                                    <span style={styles.inProgressLabel}>In Progress</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Bonus XP for completing all */}
            {!compact && (
                <div style={styles.bonusSection}>
                    <div style={styles.bonusIcon}>🌟</div>
                    <div style={styles.bonusInfo}>
                        <p style={styles.bonusTitle}>Complete All {activeTab === 'daily' ? 'Daily' : 'Weekly'} Challenges</p>
                        <p style={styles.bonusDesc}>Earn bonus {activeTab === 'daily' ? '100' : '500'} XP!</p>
                    </div>
                    <div style={styles.bonusProgress}>
                        {displayChallenges.filter(c => completedToday.has(c.id)).length}/{displayChallenges.length}
                    </div>
                </div>
            )}
        </div>
    );
};

const styles = {
    container: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        backdropFilter: 'blur(10px)'
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
    },
    title: {
        margin: 0,
        fontSize: '20px',
        fontWeight: 700,
        color: '#ffffff'
    },
    resetTimer: {
        margin: '4px 0 0 0',
        fontSize: '12px',
        color: '#f59e0b'
    },
    loading: {
        textAlign: 'center',
        padding: '40px',
        color: '#94a3b8'
    },
    tabToggle: {
        display: 'flex',
        gap: '8px',
        marginBottom: '16px'
    },
    tabBtn: {
        flex: 1,
        padding: '10px',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: '8px',
        background: 'transparent',
        color: '#94a3b8',
        fontSize: '13px',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.2s'
    },
    tabBtnActive: {
        background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
        borderColor: '#3b82f6',
        color: '#ffffff'
    },
    challengeList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
    },
    challengeCard: {
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '16px',
        background: 'rgba(30, 41, 59, 0.6)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        transition: 'all 0.2s'
    },
    challengeComplete: {
        background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.15))',
        border: '1px solid rgba(16, 185, 129, 0.4)'
    },
    challengeClaimed: {
        opacity: 0.6
    },
    challengeIcon: {
        fontSize: '32px',
        flexShrink: 0
    },
    challengeInfo: {
        flex: 1,
        minWidth: 0
    },
    challengeTitle: {
        margin: '0 0 4px 0',
        fontSize: '15px',
        fontWeight: 600,
        color: '#ffffff'
    },
    challengeDesc: {
        margin: '0 0 8px 0',
        fontSize: '12px',
        color: 'rgba(255, 255, 255, 0.6)'
    },
    progressContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    },
    progressBar: {
        flex: 1,
        height: '6px',
        background: 'rgba(255, 255, 255, 0.2)',
        borderRadius: '3px',
        overflow: 'hidden'
    },
    progressFill: {
        height: '100%',
        borderRadius: '3px',
        transition: 'width 0.3s'
    },
    progressText: {
        fontSize: '11px',
        color: 'rgba(255, 255, 255, 0.6)',
        fontWeight: 500,
        minWidth: '35px'
    },
    rewardSection: {
        textAlign: 'center',
        minWidth: '80px'
    },
    xpBadge: {
        display: 'inline-block',
        padding: '4px 10px',
        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 700,
        color: '#ffffff',
        marginBottom: '8px'
    },
    claimBtn: {
        display: 'block',
        width: '100%',
        padding: '8px 12px',
        background: 'linear-gradient(135deg, #10b981, #059669)',
        border: 'none',
        borderRadius: '8px',
        color: '#ffffff',
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'pointer',
        animation: 'pulse 1.5s ease-in-out infinite'
    },
    claimedBadge: {
        display: 'block',
        fontSize: '11px',
        color: '#10b981',
        fontWeight: 600
    },
    inProgressLabel: {
        display: 'block',
        fontSize: '11px',
        color: '#64748b'
    },
    bonusSection: {
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        marginTop: '16px',
        padding: '16px',
        background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.1), rgba(217, 119, 6, 0.1))',
        border: '1px dashed rgba(245, 158, 11, 0.4)',
        borderRadius: '12px'
    },
    bonusIcon: {
        fontSize: '32px'
    },
    bonusInfo: {
        flex: 1
    },
    bonusTitle: {
        margin: 0,
        fontSize: '14px',
        fontWeight: 600,
        color: '#fbbf24'
    },
    bonusDesc: {
        margin: '2px 0 0 0',
        fontSize: '12px',
        color: 'rgba(251, 191, 36, 0.7)'
    },
    bonusProgress: {
        fontSize: '18px',
        fontWeight: 700,
        color: '#fbbf24'
    }
};

// Add pulse animation
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }
`;
document.head.appendChild(styleSheet);

export default DailyChallenges;
