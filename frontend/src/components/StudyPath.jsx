/**
 * Study Path Component
 * AI-powered personalized learning path based on quiz performance and weak areas
 */
import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';

export const StudyPath = ({ selectedSubject = 'Physics' }) => {
    const { user, userData } = useAuth();
    const [chapters, setChapters] = useState([]);
    const [performance, setPerformance] = useState({});
    const [loading, setLoading] = useState(true);
    const [studyPath, setStudyPath] = useState([]);

    // Fetch chapters and performance data
    useEffect(() => {
        const fetchData = async () => {
            if (!user?.uid || !userData?.class) return;

            try {
                setLoading(true);

                // Fetch chapters for the subject
                const textbooksQuery = query(
                    collection(db, 'textbooks'),
                    where('class', '==', parseInt(userData.class)),
                    where('subject', '==', selectedSubject)
                );
                const textbooksSnapshot = await getDocs(textbooksQuery);

                const chapterNames = [...new Set(
                    textbooksSnapshot.docs.map(doc => doc.data().chapterName).filter(Boolean)
                )];

                // Fetch quiz results for performance analysis
                const quizQuery = query(
                    collection(db, 'quizResults'),
                    where('studentId', '==', user.uid),
                    where('subject', '==', selectedSubject)
                );
                const quizSnapshot = await getDocs(quizQuery);

                const performanceMap = {};
                quizSnapshot.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.malpractice) return;

                    const chapter = data.chapterName;
                    if (!performanceMap[chapter]) {
                        performanceMap[chapter] = { scores: [], attempts: 0 };
                    }
                    performanceMap[chapter].scores.push(data.score || 0);
                    performanceMap[chapter].attempts++;
                });

                // Calculate average scores
                Object.keys(performanceMap).forEach(chapter => {
                    const scores = performanceMap[chapter].scores;
                    performanceMap[chapter].avgScore =
                        Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
                    performanceMap[chapter].mastery = calculateMastery(performanceMap[chapter].avgScore);
                });

                setPerformance(performanceMap);
                setChapters(chapterNames);

                // Generate study path
                const path = generateStudyPath(chapterNames, performanceMap);
                setStudyPath(path);

            } catch (error) {
                console.error('Error fetching study path data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user?.uid, userData?.class, selectedSubject]);

    // Calculate mastery level
    const calculateMastery = (avgScore) => {
        if (avgScore >= 90) return 'mastered';
        if (avgScore >= 70) return 'proficient';
        if (avgScore >= 50) return 'learning';
        if (avgScore > 0) return 'needs-work';
        return 'not-started';
    };

    // Generate recommended study path
    const generateStudyPath = (allChapters, performanceMap) => {
        return allChapters.map((chapter, index) => {
            const perf = performanceMap[chapter] || {};
            const mastery = perf.mastery || 'not-started';
            const avgScore = perf.avgScore || 0;
            const attempts = perf.attempts || 0;

            // Calculate priority (lower score = higher priority)
            let priority = 5; // Default for not started
            if (mastery === 'needs-work') priority = 1;
            else if (mastery === 'learning') priority = 2;
            else if (mastery === 'proficient') priority = 3;
            else if (mastery === 'mastered') priority = 4;

            // Calculate estimated time
            let estimatedTime = '30 min';
            if (mastery === 'mastered') estimatedTime = '10 min';
            else if (mastery === 'proficient') estimatedTime = '20 min';
            else if (mastery === 'needs-work') estimatedTime = '45 min';

            return {
                id: index,
                name: chapter,
                mastery,
                avgScore,
                attempts,
                priority,
                estimatedTime,
                isLocked: false, // Could implement sequential unlocking
                recommendation: getRecommendation(mastery, attempts)
            };
        }).sort((a, b) => a.priority - b.priority);
    };

    // Get AI recommendation based on mastery
    const getRecommendation = (mastery, attempts) => {
        if (mastery === 'not-started') {
            return 'Start with video lessons to build foundation';
        }
        if (mastery === 'needs-work') {
            return attempts > 2
                ? 'Review notes and try practice problems'
                : 'Watch videos again and take notes';
        }
        if (mastery === 'learning') {
            return 'Take more quizzes to strengthen understanding';
        }
        if (mastery === 'proficient') {
            return 'Practice application problems for mastery';
        }
        return 'Great job! Move to advanced topics';
    };

    // Mastery colors
    const getMasteryStyle = (mastery) => {
        const colors = {
            'mastered': { bg: 'linear-gradient(135deg, #10b981, #059669)', color: '#ffffff', icon: '🏆' },
            'proficient': { bg: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#ffffff', icon: '⭐' },
            'learning': { bg: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#ffffff', icon: '📖' },
            'needs-work': { bg: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#ffffff', icon: '⚠️' },
            'not-started': { bg: 'rgba(100, 116, 139, 0.5)', color: '#94a3b8', icon: '🔒' }
        };
        return colors[mastery] || colors['not-started'];
    };

    if (loading) {
        return (
            <div style={styles.container}>
                <div style={styles.loading}>Analyzing your learning path...</div>
            </div>
        );
    }

    // Calculate overall stats
    const totalChapters = studyPath.length;
    const masteredCount = studyPath.filter(c => c.mastery === 'mastered').length;
    const needsWorkCount = studyPath.filter(c => c.mastery === 'needs-work').length;
    const overallProgress = totalChapters > 0
        ? Math.round((masteredCount / totalChapters) * 100)
        : 0;

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <div>
                    <h3 style={styles.title}>📚 Your Study Path</h3>
                    <p style={styles.subtitle}>{selectedSubject} - Personalized Learning Journey</p>
                </div>
            </div>

            {/* Overall Progress */}
            <div style={styles.progressSection}>
                <div style={styles.progressRing}>
                    <svg viewBox="0 0 100 100" style={{ width: '80px', height: '80px' }}>
                        <circle
                            cx="50" cy="50" r="40"
                            fill="none"
                            stroke="rgba(255,255,255,0.1)"
                            strokeWidth="8"
                        />
                        <circle
                            cx="50" cy="50" r="40"
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray={`${overallProgress * 2.51} 251`}
                            transform="rotate(-90 50 50)"
                        />
                        <text x="50" y="55" textAnchor="middle" fill="#ffffff" fontSize="18" fontWeight="bold">
                            {overallProgress}%
                        </text>
                    </svg>
                </div>
                <div style={styles.progressStats}>
                    <div style={styles.statItem}>
                        <span style={styles.statValue}>{masteredCount}</span>
                        <span style={styles.statLabel}>Mastered</span>
                    </div>
                    <div style={styles.statItem}>
                        <span style={{ ...styles.statValue, color: '#f59e0b' }}>{totalChapters - masteredCount - needsWorkCount}</span>
                        <span style={styles.statLabel}>In Progress</span>
                    </div>
                    <div style={styles.statItem}>
                        <span style={{ ...styles.statValue, color: '#ef4444' }}>{needsWorkCount}</span>
                        <span style={styles.statLabel}>Needs Work</span>
                    </div>
                </div>
            </div>

            {/* Focus Areas Banner */}
            {needsWorkCount > 0 && (
                <div style={styles.focusBanner}>
                    <span style={styles.focusIcon}>🎯</span>
                    <div>
                        <p style={styles.focusTitle}>Focus Areas</p>
                        <p style={styles.focusDesc}>
                            {studyPath.filter(c => c.mastery === 'needs-work').slice(0, 2).map(c => c.name).join(', ')}
                        </p>
                    </div>
                </div>
            )}

            {/* Study Path Timeline */}
            <div style={styles.timeline}>
                {studyPath.map((chapter, index) => {
                    const masteryStyle = getMasteryStyle(chapter.mastery);

                    return (
                        <div key={chapter.id} style={styles.timelineItem}>
                            {/* Connector Line */}
                            {index < studyPath.length - 1 && (
                                <div style={{
                                    ...styles.connector,
                                    background: chapter.mastery === 'mastered' ? '#10b981' : 'rgba(255,255,255,0.2)'
                                }} />
                            )}

                            {/* Chapter Node */}
                            <div style={{
                                ...styles.nodeIcon,
                                background: masteryStyle.bg
                            }}>
                                {masteryStyle.icon}
                            </div>

                            {/* Chapter Card */}
                            <div style={styles.chapterCard}>
                                <div style={styles.chapterHeader}>
                                    <h4 style={styles.chapterName}>{chapter.name}</h4>
                                    <span style={{
                                        ...styles.masteryBadge,
                                        background: masteryStyle.bg
                                    }}>
                                        {chapter.mastery.replace('-', ' ')}
                                    </span>
                                </div>

                                {chapter.mastery !== 'not-started' && (
                                    <div style={styles.chapterStats}>
                                        <span>Avg Score: <strong>{chapter.avgScore}%</strong></span>
                                        <span>Attempts: <strong>{chapter.attempts}</strong></span>
                                    </div>
                                )}

                                <p style={styles.recommendation}>
                                    💡 {chapter.recommendation}
                                </p>

                                <div style={styles.chapterActions}>
                                    <span style={styles.timeEstimate}>⏱️ {chapter.estimatedTime}</span>
                                    <button style={styles.startBtn}>
                                        {chapter.mastery === 'not-started' ? 'Start' : 'Continue'} →
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
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
        marginBottom: '20px'
    },
    title: {
        margin: 0,
        fontSize: '20px',
        fontWeight: 700,
        color: '#ffffff'
    },
    subtitle: {
        margin: '4px 0 0 0',
        fontSize: '13px',
        color: '#94a3b8'
    },
    loading: {
        textAlign: 'center',
        padding: '40px',
        color: '#94a3b8'
    },
    progressSection: {
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        padding: '20px',
        background: 'rgba(30, 41, 59, 0.6)',
        borderRadius: '12px',
        marginBottom: '20px'
    },
    progressRing: {
        flexShrink: 0
    },
    progressStats: {
        display: 'flex',
        gap: '24px',
        flex: 1
    },
    statItem: {
        textAlign: 'center'
    },
    statValue: {
        display: 'block',
        fontSize: '24px',
        fontWeight: 700,
        color: '#10b981'
    },
    statLabel: {
        fontSize: '12px',
        color: '#94a3b8'
    },
    focusBanner: {
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '16px',
        background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.15), rgba(249, 115, 22, 0.15))',
        border: '1px solid rgba(239, 68, 68, 0.4)',
        borderRadius: '12px',
        marginBottom: '20px'
    },
    focusIcon: {
        fontSize: '32px'
    },
    focusTitle: {
        margin: 0,
        fontSize: '14px',
        fontWeight: 600,
        color: '#fca5a5'
    },
    focusDesc: {
        margin: '4px 0 0 0',
        fontSize: '13px',
        color: 'rgba(252, 165, 165, 0.8)'
    },
    timeline: {
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
    },
    timelineItem: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '16px',
        position: 'relative'
    },
    connector: {
        position: 'absolute',
        left: '20px',
        top: '48px',
        width: '3px',
        height: 'calc(100% + 16px)',
        borderRadius: '2px'
    },
    nodeIcon: {
        width: '44px',
        height: '44px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '20px',
        flexShrink: 0,
        zIndex: 1
    },
    chapterCard: {
        flex: 1,
        padding: '16px',
        background: 'rgba(30, 41, 59, 0.6)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.05)'
    },
    chapterHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px'
    },
    chapterName: {
        margin: 0,
        fontSize: '15px',
        fontWeight: 600,
        color: '#ffffff'
    },
    masteryBadge: {
        padding: '4px 10px',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: 600,
        color: '#ffffff',
        textTransform: 'capitalize'
    },
    chapterStats: {
        display: 'flex',
        gap: '16px',
        marginBottom: '8px',
        fontSize: '12px',
        color: '#94a3b8'
    },
    recommendation: {
        margin: '8px 0',
        fontSize: '13px',
        color: '#60a5fa',
        fontStyle: 'italic'
    },
    chapterActions: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '12px'
    },
    timeEstimate: {
        fontSize: '12px',
        color: '#64748b'
    },
    startBtn: {
        padding: '8px 16px',
        background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
        border: 'none',
        borderRadius: '8px',
        color: '#ffffff',
        fontSize: '13px',
        fontWeight: 600,
        cursor: 'pointer'
    }
};

export default StudyPath;
