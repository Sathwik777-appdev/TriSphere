/**
 * Achievement Badges Component
 * Displays student achievements with unlock animations and progress tracking
 */
import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { successToast } from '../utils/toast';

// Badge definitions with requirements
const BADGE_DEFINITIONS = [
    {
        id: 'first_quiz',
        name: 'Quiz Rookie',
        description: 'Complete your first quiz',
        icon: '🎯',
        xpReward: 50,
        rarity: 'common',
        requirement: { type: 'quiz_count', target: 1 }
    },
    {
        id: 'quiz_master',
        name: 'Quiz Master',
        description: 'Complete 10 quizzes with 80%+ score',
        icon: '🏆',
        xpReward: 500,
        rarity: 'rare',
        requirement: { type: 'quiz_high_score_count', target: 10, minScore: 80 }
    },
    {
        id: 'perfect_score',
        name: 'Perfectionist',
        description: 'Score 100% on any quiz',
        icon: '💯',
        xpReward: 200,
        rarity: 'rare',
        requirement: { type: 'perfect_quiz', target: 1 }
    },
    {
        id: 'streak_5',
        name: 'Consistent Learner',
        description: 'Maintain a 5-day login streak',
        icon: '🔥',
        xpReward: 150,
        rarity: 'common',
        requirement: { type: 'streak', target: 5 }
    },
    {
        id: 'streak_30',
        name: 'Dedication Champion',
        description: 'Maintain a 30-day login streak',
        icon: '⚡',
        xpReward: 1000,
        rarity: 'legendary',
        requirement: { type: 'streak', target: 30 }
    },
    {
        id: 'xp_1000',
        name: 'Rising Star',
        description: 'Earn 1,000 total XP',
        icon: '⭐',
        xpReward: 100,
        rarity: 'common',
        requirement: { type: 'total_xp', target: 1000 }
    },
    {
        id: 'xp_5000',
        name: 'XP Legend',
        description: 'Earn 5,000 total XP',
        icon: '🌟',
        xpReward: 500,
        rarity: 'epic',
        requirement: { type: 'total_xp', target: 5000 }
    },
    {
        id: 'assignment_star',
        name: 'Assignment Star',
        description: 'Submit 5 assignments',
        icon: '📝',
        xpReward: 200,
        rarity: 'common',
        requirement: { type: 'assignment_count', target: 5 }
    },
    {
        id: 'astra_rookie',
        name: 'Astra Rookie',
        description: 'Complete your first Astra check-in',
        icon: '🤖',
        xpReward: 100,
        rarity: 'common',
        requirement: { type: 'astra_count', target: 1 }
    },
    {
        id: 'astra_streak_7',
        name: 'Astra Confidant',
        description: 'Maintain a 7-day Astra check-in streak',
        icon: '✨',
        xpReward: 400,
        rarity: 'epic',
        requirement: { type: 'astra_streak', target: 7 }
    },
    {
        id: 'discussion_hero',
        name: 'Discussion Hero',
        description: 'Post 10 messages in the forum',
        icon: '💬',
        xpReward: 200,
        rarity: 'rare',
        requirement: { type: 'forum_posts', target: 10 }
    },
    {
        id: 'early_bird',
        name: 'Early Bird',
        description: 'Submit an assignment before deadline',
        icon: '🐦',
        xpReward: 100,
        rarity: 'common',
        requirement: { type: 'early_submission', target: 1 }
    },
    {
        id: 'subject_explorer',
        name: 'Subject Explorer',
        description: 'Complete quizzes in 5 different subjects',
        icon: '🧭',
        xpReward: 300,
        rarity: 'rare',
        requirement: { type: 'subject_variety', target: 5 }
    }
];

const RARITY_COLORS = {
    common: { bg: 'linear-gradient(135deg, #6b7280, #9ca3af)', glow: 'rgba(107, 114, 128, 0.4)' },
    rare: { bg: 'linear-gradient(135deg, #3b82f6, #60a5fa)', glow: 'rgba(59, 130, 246, 0.5)' },
    epic: { bg: 'linear-gradient(135deg, #8b5cf6, #a78bfa)', glow: 'rgba(139, 92, 246, 0.5)' },
    legendary: { bg: 'linear-gradient(135deg, #f59e0b, #fbbf24)', glow: 'rgba(245, 158, 11, 0.6)' }
};

// Get current season ID (format: YYYY-MM)
const getCurrentSeasonId = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

// Get season display name
const getSeasonDisplayName = (seasonId) => {
    const [year, month] = seasonId.split('-');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
};

export const AchievementBadges = ({ compact = false }) => {
    const { user, userData } = useAuth();
    const [unlockedBadges, setUnlockedBadges] = useState([]);
    const [badgeProgress, setBadgeProgress] = useState({});
    const [loading, setLoading] = useState(true);
    const [newlyUnlocked, setNewlyUnlocked] = useState(null);
    const [showUnlockAnimation, setShowUnlockAnimation] = useState(false);
    const currentSeason = getCurrentSeasonId();

    // Fetch user's unlocked badges and calculate progress
    useEffect(() => {
        const fetchBadgesAndProgress = async () => {
            if (!user?.uid) return;

            try {
                setLoading(true);

                const badgesQuery = query(
                    collection(db, 'userBadges'),
                    where('userId', '==', user.uid),
                    where('seasonId', '==', currentSeason)
                );
                const badgesSnapshot = await getDocs(badgesQuery);
                const unlocked = badgesSnapshot.docs.map(doc => ({
                    ...doc.data(),
                    id: doc.id
                }));
                setUnlockedBadges(unlocked);

                // Calculate progress for each badge
                const progress = await calculateBadgeProgress(user.uid);
                setBadgeProgress(progress);

                // Check for newly earned badges
                await checkForNewBadges(user.uid, unlocked, progress);

            } catch (error) {
                console.error('Error fetching badges:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchBadgesAndProgress();
    }, [user?.uid]);

    // Calculate progress for all badges
    const calculateBadgeProgress = async (userId) => {
        const progress = {};

        try {
            // Fetch quiz results
            const quizQuery = query(
                collection(db, 'quizResults'),
                where('studentId', '==', userId)
            );
            const quizSnapshot = await getDocs(quizQuery);
            const quizzes = quizSnapshot.docs.map(doc => doc.data()).filter(q => !q.malpractice);

            // Fetch assignments
            const assignmentQuery = query(
                collection(db, 'studentSubmissions'),
                where('studentId', '==', userId)
            );
            const assignmentSnapshot = await getDocs(assignmentQuery);
            const assignments = assignmentSnapshot.docs.map(doc => doc.data());

            // Fetch forum posts
            const forumQuery = query(
                collection(db, 'discussions'),
                where('authorId', '==', userId)
            );
            const forumSnapshot = await getDocs(forumQuery);
            const forumPosts = forumSnapshot.size;

            // Fetch Astra check-ins
            const astraQuery = query(
                collection(db, 'studentMoods'),
                where('userId', '==', userId)
            );
            const astraSnapshot = await getDocs(astraQuery);
            const astraCheckins = astraSnapshot.docs.map(doc => doc.data());

            // Calculate metrics
            const quizCount = quizzes.length;
            const highScoreQuizzes = quizzes.filter(q => q.score >= 80).length;
            const perfectQuizzes = quizzes.filter(q => q.score === 100).length;
            const assignmentCount = assignments.length;
            const uniqueSubjects = new Set(quizzes.map(q => q.subject)).size;

            // Calculate total XP
            const xpFromQuizzes = quizzes.reduce((sum, q) => sum + (q.score || 0), 0);
            const xpFromAssignments = assignments
                .filter(a => a.grade != null)
                .reduce((sum, a) => {
                    let marks = 0;
                    if (typeof a.grade === 'object') {
                        marks = Number(a.grade.marks) || 0;
                    } else {
                        marks = Number(a.grade) || 0;
                    }
                    const scaledMarks = marks <= 10 ? marks * 10 : marks;
                    return sum + scaledMarks;
                }, 0);
            const totalXP = xpFromQuizzes + xpFromAssignments;

            // Calculate streak
            const streak = userData?.stats?.streak || 0;
            const astraStreak = calculateAstraStreak(astraCheckins);
            const astraCount = astraCheckins.length;

            // Map progress for each badge
            BADGE_DEFINITIONS.forEach(badge => {
                const req = badge.requirement;
                let current = 0;

                switch (req.type) {
                    case 'quiz_count':
                        current = quizCount;
                        break;
                    case 'quiz_high_score_count':
                        current = highScoreQuizzes;
                        break;
                    case 'perfect_quiz':
                        current = perfectQuizzes;
                        break;
                    case 'streak':
                        current = streak;
                        break;
                    case 'total_xp':
                        current = totalXP;
                        break;
                    case 'assignment_count':
                        current = assignmentCount;
                        break;
                    case 'forum_posts':
                        current = forumPosts;
                        break;
                    case 'subject_variety':
                        current = uniqueSubjects;
                        break;
                    case 'early_submission':
                        // Check if any assignment was submitted early (simplified check)
                        current = assignments.filter(a => a.submittedEarly).length;
                        break;
                    case 'astra_count':
                        current = astraCount;
                        break;
                    case 'astra_streak':
                        current = astraStreak;
                        break;
                }

                progress[badge.id] = {
                    current,
                    target: req.target,
                    percentage: Math.min(100, Math.round((current / req.target) * 100))
                };
            });

        } catch (error) {
            console.error('Error calculating progress:', error);
        }

        return progress;
    };


    // Calculate Astra check-in streak
    const calculateAstraStreak = (checkins) => {
        if (checkins.length === 0) return 0;
        
        const dates = checkins
            .map(c => {
                if (c.date) return new Date(c.date).toDateString();
                const timestamp = c.timestamp?.toDate?.() || new Date();
                return timestamp.toDateString();
            })
            .filter(Boolean);

        const uniqueDates = [...new Set(dates)].sort((a, b) => new Date(b) - new Date(a));
        if (uniqueDates.length === 0) return 0;

        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();

        if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) {
            return 0;
        }

        let streak = 1;
        for (let i = 1; i < uniqueDates.length; i++) {
            const currentDate = new Date(uniqueDates[i - 1]);
            const prevDate = new Date(uniqueDates[i]);
            // Convert timezone offset safely by just parsing the date string difference
            const diffDays = Math.round((currentDate - prevDate) / 86400000);

            if (diffDays === 1) {
                streak++;
            } else {
                break;
            }
        }
        return streak;
    };

    // Check and award new badges
    const checkForNewBadges = async (userId, currentUnlocked, progress) => {
        const unlockedIds = currentUnlocked.map(b => b.badgeId);

        for (const badge of BADGE_DEFINITIONS) {
            if (unlockedIds.includes(badge.id)) continue;

            const prog = progress[badge.id];
            if (prog && prog.current >= prog.target) {
                // Award this badge!
                try {
                    const badgeDocId = `${userId}_${badge.id}_${currentSeason}`;
                    await setDoc(doc(db, 'userBadges', badgeDocId), {
                        userId,
                        badgeId: badge.id,
                        seasonId: currentSeason,
                        unlockedAt: serverTimestamp(),
                        xpAwarded: badge.xpReward
                    });

                    // Show unlock animation
                    setNewlyUnlocked(badge);
                    setShowUnlockAnimation(true);
                    successToast(`🎉 Badge Unlocked: ${badge.name}! +${badge.xpReward} XP`);

                    // Update local state
                    setUnlockedBadges(prev => [...prev, { badgeId: badge.id, userId }]);

                    // Hide animation after 3 seconds
                    setTimeout(() => {
                        setShowUnlockAnimation(false);
                        setNewlyUnlocked(null);
                    }, 3000);

                    // Only show one badge at a time
                    break;
                } catch (error) {
                    console.error('Error awarding badge:', error);
                }
            }
        }
    };

    // Check if badge is unlocked
    const isBadgeUnlocked = (badgeId) => {
        return unlockedBadges.some(b => b.badgeId === badgeId);
    };

    // Sort badges: unlocked first, then by progress
    const sortedBadges = useMemo(() => {
        return [...BADGE_DEFINITIONS].sort((a, b) => {
            const aUnlocked = isBadgeUnlocked(a.id);
            const bUnlocked = isBadgeUnlocked(b.id);

            if (aUnlocked && !bUnlocked) return -1;
            if (!aUnlocked && bUnlocked) return 1;

            const aProgress = badgeProgress[a.id]?.percentage || 0;
            const bProgress = badgeProgress[b.id]?.percentage || 0;
            return bProgress - aProgress;
        });
    }, [unlockedBadges, badgeProgress]);

    if (loading) {
        return (
            <div style={styles.container}>
                <div style={styles.loading}>Loading achievements...</div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <div>
                    <h3 style={styles.title}>🏅 Achievements</h3>
                    <span style={styles.seasonBadge}>🗓️ {getSeasonDisplayName(currentSeason)} Season</span>
                </div>
                <span style={styles.counter}>
                    {unlockedBadges.length} / {BADGE_DEFINITIONS.length} Unlocked
                </span>
            </div>

            {/* Unlock Animation Overlay */}
            {showUnlockAnimation && newlyUnlocked && (
                <div style={styles.unlockOverlay}>
                    <div style={styles.unlockModal}>
                        <div style={styles.confetti}>🎊</div>
                        <div style={{
                            ...styles.unlockBadgeIcon,
                            background: RARITY_COLORS[newlyUnlocked.rarity].bg,
                            boxShadow: `0 0 40px ${RARITY_COLORS[newlyUnlocked.rarity].glow}`
                        }}>
                            {newlyUnlocked.icon}
                        </div>
                        <h2 style={styles.unlockTitle}>Badge Unlocked!</h2>
                        <p style={styles.unlockName}>{newlyUnlocked.name}</p>
                        <p style={styles.unlockDesc}>{newlyUnlocked.description}</p>
                        <div style={styles.xpReward}>+{newlyUnlocked.xpReward} XP</div>
                    </div>
                </div>
            )}

            {/* Badge Grid */}
            <div style={compact ? styles.compactGrid : styles.badgeGrid}>
                {(compact ? sortedBadges.slice(0, 6) : sortedBadges).map(badge => {
                    const unlocked = isBadgeUnlocked(badge.id);
                    const progress = badgeProgress[badge.id] || { current: 0, target: badge.requirement.target, percentage: 0 };

                    return (
                        <div
                            key={badge.id}
                            style={{
                                ...styles.badgeCard,
                                ...(unlocked ? styles.badgeUnlocked : styles.badgeLocked),
                                background: unlocked ? RARITY_COLORS[badge.rarity].bg : 'rgba(30, 41, 59, 0.8)',
                                boxShadow: unlocked ? `0 4px 20px ${RARITY_COLORS[badge.rarity].glow}` : 'none'
                            }}
                        >
                            <div style={{
                                ...styles.badgeIcon,
                                filter: unlocked ? 'none' : 'grayscale(1) opacity(0.5)'
                            }}>
                                {badge.icon}
                            </div>
                            <div style={styles.badgeInfo}>
                                <p style={styles.badgeName}>{badge.name}</p>
                                <p style={styles.badgeDesc}>{badge.description}</p>
                                {!unlocked && (
                                    <div style={styles.progressContainer}>
                                        <div style={styles.progressBar}>
                                            <div style={{
                                                ...styles.progressFill,
                                                width: `${progress.percentage}%`
                                            }} />
                                        </div>
                                        <span style={styles.progressText}>
                                            {progress.current}/{progress.target}
                                        </span>
                                    </div>
                                )}
                                {unlocked && (
                                    <span style={styles.unlockedLabel}>✓ Unlocked</span>
                                )}
                            </div>
                            <div style={{
                                ...styles.rarityBadge,
                                background: RARITY_COLORS[badge.rarity].bg
                            }}>
                                {badge.rarity}
                            </div>
                        </div>
                    );
                })}
            </div>

            {compact && (
                <button style={styles.viewAllBtn}>
                    View All Achievements →
                </button>
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
        marginBottom: '20px'
    },
    title: {
        margin: 0,
        fontSize: '20px',
        fontWeight: 700,
        color: '#ffffff'
    },
    counter: {
        fontSize: '14px',
        color: '#94a3b8',
        fontWeight: 500
    },
    seasonBadge: {
        display: 'inline-block',
        marginTop: '4px',
        padding: '4px 10px',
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(139, 92, 246, 0.2))',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: 600,
        color: '#a78bfa',
        border: '1px solid rgba(139, 92, 246, 0.3)'
    },
    loading: {
        textAlign: 'center',
        padding: '40px',
        color: '#94a3b8'
    },
    badgeGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '16px'
    },
    compactGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '12px'
    },
    badgeCard: {
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '16px',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        transition: 'transform 0.2s, box-shadow 0.2s'
    },
    badgeUnlocked: {
        cursor: 'pointer'
    },
    badgeLocked: {
        opacity: 0.8
    },
    badgeIcon: {
        fontSize: '40px',
        flexShrink: 0
    },
    badgeInfo: {
        flex: 1,
        minWidth: 0
    },
    badgeName: {
        margin: '0 0 4px 0',
        fontSize: '15px',
        fontWeight: 600,
        color: '#ffffff'
    },
    badgeDesc: {
        margin: 0,
        fontSize: '12px',
        color: 'rgba(255, 255, 255, 0.7)',
        lineHeight: 1.4
    },
    progressContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginTop: '8px'
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
        background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
        borderRadius: '3px',
        transition: 'width 0.3s'
    },
    progressText: {
        fontSize: '11px',
        color: 'rgba(255, 255, 255, 0.6)',
        fontWeight: 500
    },
    unlockedLabel: {
        display: 'inline-block',
        marginTop: '6px',
        fontSize: '11px',
        color: '#10b981',
        fontWeight: 600
    },
    rarityBadge: {
        position: 'absolute',
        top: '8px',
        right: '8px',
        padding: '2px 8px',
        borderRadius: '10px',
        fontSize: '10px',
        fontWeight: 700,
        color: '#ffffff',
        textTransform: 'uppercase'
    },
    viewAllBtn: {
        width: '100%',
        marginTop: '16px',
        padding: '12px',
        background: 'transparent',
        border: '1px solid rgba(59, 130, 246, 0.5)',
        borderRadius: '8px',
        color: '#60a5fa',
        fontSize: '14px',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.2s'
    },
    // Unlock animation styles
    unlockOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        animation: 'fadeIn 0.3s ease-out'
    },
    unlockModal: {
        textAlign: 'center',
        padding: '40px',
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95))',
        borderRadius: '24px',
        border: '2px solid rgba(245, 158, 11, 0.5)',
        animation: 'scaleIn 0.4s ease-out'
    },
    confetti: {
        fontSize: '60px',
        animation: 'bounce 0.5s ease-out'
    },
    unlockBadgeIcon: {
        width: '100px',
        height: '100px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '50px',
        margin: '20px auto',
        animation: 'glow 1s ease-in-out infinite alternate'
    },
    unlockTitle: {
        margin: '0 0 8px 0',
        fontSize: '28px',
        fontWeight: 700,
        color: '#fbbf24'
    },
    unlockName: {
        margin: '0 0 8px 0',
        fontSize: '20px',
        fontWeight: 600,
        color: '#ffffff'
    },
    unlockDesc: {
        margin: '0 0 16px 0',
        fontSize: '14px',
        color: 'rgba(255, 255, 255, 0.7)'
    },
    xpReward: {
        display: 'inline-block',
        padding: '8px 24px',
        background: 'linear-gradient(135deg, #10b981, #059669)',
        borderRadius: '20px',
        fontSize: '18px',
        fontWeight: 700,
        color: '#ffffff'
    }
};

// Add CSS animations
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes scaleIn {
    from { transform: scale(0.5); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-20px); }
  }
  @keyframes glow {
    from { box-shadow: 0 0 20px rgba(245, 158, 11, 0.4); }
    to { box-shadow: 0 0 40px rgba(245, 158, 11, 0.8); }
  }
`;
document.head.appendChild(styleSheet);

export default AchievementBadges;
