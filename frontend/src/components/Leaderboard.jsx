/**
 * Leaderboard Component
 * Displays student rankings by class, school, and subject
 */
import React, { useState, useEffect, useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';

const LeaderboardComponent = ({ compact = false, schoolName: propSchoolName, onViewAll }) => {
    const { user, userData } = useAuth();
    const [view, setView] = useState('class'); // class, school, subject
    const [timeRange, setTimeRange] = useState('weekly'); // weekly, monthly, alltime
    const [selectedSubject, setSelectedSubject] = useState('All');
    const [leaderboardData, setLeaderboardData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentUserRank, setCurrentUserRank] = useState(null);

    // Determine the active school name (prop first, then userData)
    const activeSchool = propSchoolName || userData?.schoolName || '';

    const subjects = ['All', 'Physics', 'Chemistry', 'Biology', 'Mathematics', 'Computer Studies', 'Geography', 'History & Civics'];

    // Fetch leaderboard data
    useEffect(() => {
        const fetchLeaderboard = async () => {
            if (!user?.uid) return;

            try {
                setLoading(true);

                const isDeveloper = userData?.role === 'developer';
                const schoolName = activeSchool || userData?.schoolName || '';
                
                // Base filter: Only students in the same school
                let usersQuery = query(
                    collection(db, 'users'),
                    where('role', '==', 'student')
                );

                if (!isDeveloper && schoolName) {
                    usersQuery = query(usersQuery, where('schoolName', '==', schoolName));
                }

                // If viewing by class, filter by class too
                if (view === 'class' && userData?.class) {
                    const classInt = parseInt(userData.class);
                    usersQuery = query(usersQuery, where('class', '==', classInt));
                }

                const usersSnapshot = await getDocs(usersQuery);
                
                // Map users and use their pre-aggregated stats
                const leaderboard = usersSnapshot.docs
                    .map(doc => {
                        const data = doc.data();
                        return {
                            id: doc.id,
                            username: data.username || 'Student',
                            class: data.class || 0,
                            avatar: data.avatar || '👤',
                            totalXP: data.stats?.xpBalance || 0,
                            quizCount: data.stats?.tasksCompleted || 0,
                            avgScore: data.stats?.averageScore || 0
                        };
                    })
                    // Sort by XP descending
                    .sort((a, b) => b.totalXP - a.totalXP)
                    // Take top 5 for compact, top 50 for full
                    .slice(0, compact ? 5 : 50);

                // Assign ranks
                leaderboard.forEach((student, index) => {
                    student.rank = index + 1;
                    if (student.id === user.uid) {
                        setCurrentUserRank(student);
                    }
                });

                setLeaderboardData(leaderboard);

            } catch (error) {
                console.error('Error fetching optimized leaderboard:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchLeaderboard();
    }, [user?.uid, userData?.class, activeSchool, view, compact]);

    // Medal for top 3
    const getMedal = (rank) => {
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return rank;
    };

    // Rank change indicator (placeholder - shows neutral for now until rank history is implemented)
    const getRankChange = (student) => {
        // Rank-change deltas require period-over-period snapshots that
        // aren't persisted yet — return the neutral "no change" glyph
        // so the column doesn't show stale arrows.
        return <span style={styles.rankSame}>―</span>;
    };

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <h3 style={styles.title}>🏆 Leaderboard</h3>
                {!compact && (
                    <div style={styles.filters}>
                        <select
                            value={timeRange}
                            onChange={(e) => setTimeRange(e.target.value)}
                            style={styles.select}
                        >
                            <option value="weekly">This Week</option>
                            <option value="monthly">This Month</option>
                            <option value="alltime">All Time</option>
                        </select>
                    </div>
                )}
            </div>

            {/* View Toggle */}
            {!compact && (
                <div style={styles.viewTabs}>
                    <button
                        onClick={() => setView('class')}
                        style={{
                            ...styles.viewTab,
                            ...(view === 'class' ? styles.viewTabActive : {})
                        }}
                    >
                        📚 My Class
                    </button>
                    <button
                        onClick={() => setView('school')}
                        style={{
                            ...styles.viewTab,
                            ...(view === 'school' ? styles.viewTabActive : {})
                        }}
                    >
                        🏫 School
                    </button>
                    <button
                        onClick={() => setView('subject')}
                        style={{
                            ...styles.viewTab,
                            ...(view === 'subject' ? styles.viewTabActive : {})
                        }}
                    >
                        📖 Subject
                    </button>
                </div>
            )}

            {/* Subject Selector (for subject view) */}
            {view === 'subject' && !compact && (
                <div style={styles.subjectSelector}>
                    {subjects.map(subject => (
                        <button
                            key={subject}
                            onClick={() => setSelectedSubject(subject)}
                            style={{
                                ...styles.subjectBtn,
                                ...(selectedSubject === subject ? styles.subjectBtnActive : {})
                            }}
                        >
                            {subject}
                        </button>
                    ))}
                </div>
            )}

            {loading ? (
                <div style={styles.loading}>Loading rankings...</div>
            ) : leaderboardData.length === 0 ? (
                <div style={styles.empty}>
                    <p>No data available for this period</p>
                </div>
            ) : (
                <>
                    {/* Top 3 Podium (non-compact mode) */}
                    {!compact && leaderboardData.length >= 3 && (
                        <div style={styles.podium}>
                            {/* 2nd Place */}
                            <div style={styles.podiumItem}>
                                <div style={styles.avatar2nd}>{leaderboardData[1]?.avatar || '👤'}</div>
                                <div style={styles.medal}>🥈</div>
                                <p style={styles.podiumName}>{leaderboardData[1]?.username}</p>
                                <p style={styles.podiumXP}>{leaderboardData[1]?.totalXP} XP</p>
                                <div style={styles.podiumBase2nd}></div>
                            </div>

                            {/* 1st Place */}
                            <div style={styles.podiumItem}>
                                <div style={styles.avatar1st}>{leaderboardData[0]?.avatar || '👤'}</div>
                                <div style={styles.medal}>🥇</div>
                                <p style={styles.podiumName}>{leaderboardData[0]?.username}</p>
                                <p style={styles.podiumXP}>{leaderboardData[0]?.totalXP} XP</p>
                                <div style={styles.podiumBase1st}></div>
                            </div>

                            {/* 3rd Place */}
                            <div style={styles.podiumItem}>
                                <div style={styles.avatar3rd}>{leaderboardData[2]?.avatar || '👤'}</div>
                                <div style={styles.medal}>🥉</div>
                                <p style={styles.podiumName}>{leaderboardData[2]?.username}</p>
                                <p style={styles.podiumXP}>{leaderboardData[2]?.totalXP} XP</p>
                                <div style={styles.podiumBase3rd}></div>
                            </div>
                        </div>
                    )}

                    {/* Rankings List */}
                    <motion.div
                        style={styles.rankingsList}
                        initial="hidden"
                        animate="visible"
                        variants={{
                            visible: { transition: { staggerChildren: 0.05 } }
                        }}
                    >
                        {leaderboardData.slice(compact ? 0 : (leaderboardData.length >= 3 ? 3 : 0)).map((student, index) => {
                            const isCurrentUser = student.id === user?.uid;
                            const displayRank = compact ? index + 1 : (leaderboardData.length >= 3 ? index + 4 : index + 1);

                            return (
                                <motion.div
                                    key={student.id}
                                    className="card-3d"
                                    variants={{
                                        hidden: { opacity: 0, x: -20 },
                                        visible: { opacity: 1, x: 0, transition: { duration: 0.3 } }
                                    }}
                                    whileHover={{ scale: 1.02, x: 5 }}
                                    style={{
                                        ...styles.rankingItem,
                                        ...(isCurrentUser ? styles.currentUserRow : {})
                                    }}
                                >
                                    <div style={styles.rankCol}>
                                        <span style={styles.rank}>{compact ? getMedal(displayRank) : displayRank}</span>
                                        {!compact && getRankChange(student)}
                                    </div>
                                    <div style={styles.userCol}>
                                        <span style={styles.userAvatar}>{student.avatar || '👤'}</span>
                                        <div>
                                            <p style={styles.userName}>
                                                {student.username}
                                                {isCurrentUser && <span style={styles.youBadge}>YOU</span>}
                                            </p>
                                            <p style={styles.userMeta}>Class {student.class} • {student.quizCount} quizzes</p>
                                        </div>
                                    </div>
                                    <div style={styles.scoreCol}>
                                        <p style={styles.xpValue}>{student.totalXP}</p>
                                        <p style={styles.xpLabel}>XP</p>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </motion.div>

                    {/* Current User Rank (if not in top list) */}
                    {currentUserRank && currentUserRank.rank > (compact ? 5 : 50) && (
                        <div style={styles.currentUserFixed}>
                            <span style={styles.rank}>#{currentUserRank.rank}</span>
                            <span style={styles.userName}>{currentUserRank.username}</span>
                            <span style={styles.xpValue}>{currentUserRank.totalXP} XP</span>
                        </div>
                    )}
                </>
            )}

            {compact && (
                <button style={styles.viewAllBtn} onClick={onViewAll}>
                    View Full Leaderboard →
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
    filters: {
        display: 'flex',
        gap: '8px'
    },
    select: {
        padding: '8px 12px',
        borderRadius: '8px',
        border: '1px solid rgba(59, 130, 246, 0.4)',
        background: 'rgba(30, 41, 59, 0.8)',
        color: '#ffffff',
        fontSize: '13px',
        cursor: 'pointer'
    },
    viewTabs: {
        display: 'flex',
        gap: '8px',
        marginBottom: '16px'
    },
    viewTab: {
        flex: 1,
        padding: '10px 16px',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: '8px',
        background: 'transparent',
        color: '#94a3b8',
        fontSize: '13px',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.2s'
    },
    viewTabActive: {
        background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
        borderColor: '#3b82f6',
        color: '#ffffff'
    },
    subjectSelector: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
        marginBottom: '16px'
    },
    subjectBtn: {
        padding: '6px 12px',
        borderRadius: '16px',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        background: 'transparent',
        color: '#94a3b8',
        fontSize: '12px',
        cursor: 'pointer'
    },
    subjectBtnActive: {
        background: 'rgba(59, 130, 246, 0.3)',
        borderColor: '#3b82f6',
        color: '#60a5fa'
    },
    loading: {
        textAlign: 'center',
        padding: '40px',
        color: '#94a3b8'
    },
    empty: {
        textAlign: 'center',
        padding: '40px',
        color: '#64748b'
    },
    // Podium styles
    podium: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
        gap: 'clamp(8px, 2vw, 12px)',
        marginBottom: '24px',
        paddingTop: '20px',
        flexWrap: 'wrap'
    },
    podiumItem: {
        textAlign: 'center',
        position: 'relative',
        minWidth: 'clamp(70px, 20vw, 100px)'
    },
    avatar1st: {
        width: 'clamp(45px, 12vw, 60px)',
        height: 'clamp(45px, 12vw, 60px)',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '28px',
        margin: '0 auto 8px',
        border: '3px solid #fbbf24',
        boxShadow: '0 4px 20px rgba(251, 191, 36, 0.4)'
    },
    avatar2nd: {
        width: '50px',
        height: '50px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #94a3b8, #64748b)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px',
        margin: '0 auto 8px',
        border: '3px solid #94a3b8'
    },
    avatar3rd: {
        width: '45px',
        height: '45px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #d97706, #b45309)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '20px',
        margin: '0 auto 8px',
        border: '3px solid #d97706'
    },
    medal: {
        fontSize: '24px',
        marginBottom: '4px'
    },
    podiumName: {
        margin: '0 0 4px 0',
        fontSize: '13px',
        fontWeight: 600,
        color: '#ffffff'
    },
    podiumXP: {
        margin: 0,
        fontSize: '12px',
        color: '#60a5fa',
        fontWeight: 500
    },
    podiumBase1st: {
        width: '80px',
        height: '80px',
        background: 'linear-gradient(180deg, #fbbf24, #d97706)',
        borderRadius: '8px 8px 0 0',
        marginTop: '8px'
    },
    podiumBase2nd: {
        width: '70px',
        height: '60px',
        background: 'linear-gradient(180deg, #94a3b8, #64748b)',
        borderRadius: '8px 8px 0 0',
        marginTop: '8px'
    },
    podiumBase3rd: {
        width: '65px',
        height: '45px',
        background: 'linear-gradient(180deg, #d97706, #92400e)',
        borderRadius: '8px 8px 0 0',
        marginTop: '8px'
    },
    // Rankings list
    rankingsList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
    },
    rankingItem: {
        display: 'flex',
        alignItems: 'center',
        padding: '12px 16px',
        background: 'rgba(30, 41, 59, 0.6)',
        borderRadius: '10px',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        transition: 'all 0.2s'
    },
    currentUserRow: {
        background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.2), rgba(139, 92, 246, 0.2))',
        border: '1px solid rgba(59, 130, 246, 0.4)'
    },
    rankCol: {
        width: '60px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
    },
    rank: {
        fontSize: '16px',
        fontWeight: 700,
        color: '#ffffff'
    },
    rankUp: {
        fontSize: '11px',
        color: '#10b981'
    },
    rankDown: {
        fontSize: '11px',
        color: '#ef4444'
    },
    rankSame: {
        fontSize: '11px',
        color: '#64748b'
    },
    userCol: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
    },
    userAvatar: {
        fontSize: '24px'
    },
    userName: {
        margin: 0,
        fontSize: '14px',
        fontWeight: 600,
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    },
    youBadge: {
        padding: '2px 6px',
        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: 700
    },
    userMeta: {
        margin: '2px 0 0 0',
        fontSize: '11px',
        color: '#64748b'
    },
    scoreCol: {
        textAlign: 'right'
    },
    xpValue: {
        margin: 0,
        fontSize: '16px',
        fontWeight: 700,
        color: '#60a5fa'
    },
    xpLabel: {
        margin: 0,
        fontSize: '10px',
        color: '#64748b'
    },
    currentUserFixed: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        marginTop: '12px',
        background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.3), rgba(139, 92, 246, 0.3))',
        borderRadius: '10px',
        border: '1px solid rgba(59, 130, 246, 0.5)'
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
        cursor: 'pointer'
    }
};

// Wrap with React.memo to prevent unnecessary re-renders
export const Leaderboard = memo(LeaderboardComponent);

export default Leaderboard;
