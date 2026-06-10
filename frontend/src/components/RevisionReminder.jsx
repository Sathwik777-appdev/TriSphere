/**
 * Revision Reminder Component
 * Implements spaced repetition using Ebbinghaus forgetting curve
 * Schedule: Day 1 → Day 3 → Day 7 → Day 14 → Day 30
 */
import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { successToast } from '../utils/toast';

// Spaced repetition intervals (in days)
const REVIEW_INTERVALS = [1, 3, 7, 14, 30];

export const RevisionReminder = ({ compact = false }) => {
    const { user } = useAuth();
    const [revisions, setRevisions] = useState([]);
    const [overdueCount, setOverdueCount] = useState(0);
    const [loading, setLoading] = useState(true);

    // Fetch revision schedule
    useEffect(() => {
        const fetchRevisions = async () => {
            if (!user?.uid) return;

            try {
                setLoading(true);

                // Get user's revision schedule
                const revisionQuery = query(
                    collection(db, 'revisionSchedule'),
                    where('userId', '==', user.uid)
                );
                const revisionSnapshot = await getDocs(revisionQuery);

                const now = new Date();
                const revisionList = [];
                let overdue = 0;

                revisionSnapshot.docs.forEach(docSnap => {
                    const data = docSnap.data();
                    const nextReview = data.nextReview?.toDate?.() || new Date(data.nextReview);
                    const isOverdue = nextReview <= now;

                    if (isOverdue) overdue++;

                    revisionList.push({
                        id: docSnap.id,
                        ...data,
                        nextReview,
                        isOverdue,
                        daysUntil: Math.ceil((nextReview - now) / (1000 * 60 * 60 * 24))
                    });
                });

                // Sort: overdue first, then by next review date
                revisionList.sort((a, b) => {
                    if (a.isOverdue && !b.isOverdue) return -1;
                    if (!a.isOverdue && b.isOverdue) return 1;
                    return a.nextReview - b.nextReview;
                });

                setRevisions(revisionList);
                setOverdueCount(overdue);

                // If no revisions exist, auto-create from quiz results
                if (revisionList.length === 0) {
                    await createRevisionsFromQuizzes(user.uid);
                }

            } catch (error) {
                console.error('Error fetching revisions:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchRevisions();
    }, [user?.uid]);

    // Create initial revision schedule from quiz history
    const createRevisionsFromQuizzes = async (userId) => {
        try {
            const quizQuery = query(
                collection(db, 'quizResults'),
                where('studentId', '==', userId)
            );
            const quizSnapshot = await getDocs(quizQuery);

            const chaptersProcessed = new Set();
            const newRevisions = [];
            const batch = writeBatch(db);
            let hasWrites = false;

            for (const docSnap of quizSnapshot.docs) {
                const data = docSnap.data();
                if (data.malpractice) continue;

                const key = `${data.subject}_${data.chapterName}`;
                if (chaptersProcessed.has(key)) continue;
                chaptersProcessed.add(key);

                const completedAt = data.completedAt?.toDate?.() || new Date(data.completedAt || Date.now());
                const nextReview = new Date(completedAt);
                nextReview.setDate(nextReview.getDate() + REVIEW_INTERVALS[0]);

                const revisionDoc = {
                    userId,
                    subject: data.subject,
                    chapterName: data.chapterName,
                    lastReviewed: completedAt,
                    nextReview,
                    reviewCount: 0,
                    masteryLevel: data.score ? data.score / 100 : 0.5,
                    createdAt: serverTimestamp()
                };

                const revisionId = `${userId}_${data.subject}_${data.chapterName}`.replace(/\s+/g, '_');
                batch.set(doc(db, 'revisionSchedule', revisionId), revisionDoc);
                hasWrites = true;

                newRevisions.push({
                    id: revisionId,
                    ...revisionDoc,
                    isOverdue: nextReview <= new Date(),
                    daysUntil: Math.ceil((nextReview - new Date()) / (1000 * 60 * 60 * 24))
                });
            }

            if (hasWrites) {
                await batch.commit();
            }

            setRevisions(newRevisions);
        } catch (error) {
            console.error('Error creating revisions:', error);
        }
    };

    // Mark chapter as reviewed
    const markAsReviewed = async (revision) => {
        if (!user?.uid) return;

        try {
            const newReviewCount = (revision.reviewCount || 0) + 1;
            const intervalIndex = Math.min(newReviewCount, REVIEW_INTERVALS.length - 1);
            const nextInterval = REVIEW_INTERVALS[intervalIndex];

            const nextReview = new Date();
            nextReview.setDate(nextReview.getDate() + nextInterval);

            await updateDoc(doc(db, 'revisionSchedule', revision.id), {
                lastReviewed: serverTimestamp(),
                nextReview,
                reviewCount: newReviewCount,
                masteryLevel: Math.min(1, (revision.masteryLevel || 0.5) + 0.1)
            });

            setRevisions(prev => prev.map(r =>
                r.id === revision.id
                    ? { ...r, reviewCount: newReviewCount, nextReview, isOverdue: false, daysUntil: nextInterval }
                    : r
            ));

            successToast(`✓ Reviewed! Next review in ${nextInterval} days`);

        } catch (error) {
            console.error('Error marking as reviewed:', error);
        }
    };

    // Mark as mastered (skip future reviews)
    const markAsMastered = async (revision) => {
        if (!user?.uid) return;

        try {
            const nextReview = new Date();
            nextReview.setDate(nextReview.getDate() + 90); // Set far in future

            await updateDoc(doc(db, 'revisionSchedule', revision.id), {
                masteryLevel: 1,
                nextReview,
                lastReviewed: serverTimestamp()
            });

            setRevisions(prev => prev.filter(r => r.id !== revision.id));
            successToast('🏆 Marked as mastered!');

        } catch (error) {
            console.error('Error marking as mastered:', error);
        }
    };

    // Get urgency badge
    const getUrgencyBadge = (revision) => {
        if (revision.isOverdue) {
            return { text: 'OVERDUE', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.2)' };
        }
        if (revision.daysUntil <= 1) {
            return { text: 'TODAY', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.2)' };
        }
        if (revision.daysUntil <= 3) {
            return { text: `${revision.daysUntil}d`, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.2)' };
        }
        return { text: `${revision.daysUntil}d`, color: '#64748b', bg: 'rgba(100, 116, 139, 0.2)' };
    };

    // Get mastery progress
    const getMasteryProgress = (level) => {
        return Math.round((level || 0) * 100);
    };

    if (loading) {
        return (
            <div style={styles.container}>
                <div style={styles.loading}>Loading revision schedule...</div>
            </div>
        );
    }

    const displayRevisions = compact ? revisions.slice(0, 3) : revisions;

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <div>
                    <h3 style={styles.title}>🧠 Smart Revision</h3>
                    <p style={styles.subtitle}>Spaced repetition for better retention</p>
                </div>
                {overdueCount > 0 && (
                    <div style={styles.overdueBadge}>
                        {overdueCount} overdue
                    </div>
                )}
            </div>

            {/* Legend */}
            {!compact && (
                <div style={styles.legend}>
                    <span style={styles.legendItem}>
                        <span style={{ ...styles.legendDot, background: '#ef4444' }} /> Overdue
                    </span>
                    <span style={styles.legendItem}>
                        <span style={{ ...styles.legendDot, background: '#f59e0b' }} /> Due Today
                    </span>
                    <span style={styles.legendItem}>
                        <span style={{ ...styles.legendDot, background: '#3b82f6' }} /> Upcoming
                    </span>
                </div>
            )}

            {/* Revision List */}
            {displayRevisions.length === 0 ? (
                <div style={styles.empty}>
                    <p>No revisions scheduled yet!</p>
                    <p style={styles.emptyHint}>Complete quizzes to start your revision schedule.</p>
                </div>
            ) : (
                <div style={styles.revisionList}>
                    {displayRevisions.map(revision => {
                        const urgency = getUrgencyBadge(revision);
                        const masteryPercent = getMasteryProgress(revision.masteryLevel);

                        return (
                            <div
                                key={revision.id}
                                style={{
                                    ...styles.revisionCard,
                                    ...(revision.isOverdue ? styles.overdueCard : {})
                                }}
                            >
                                <div style={styles.cardMain}>
                                    <div style={styles.subjectIcon}>📚</div>

                                    <div style={styles.cardInfo}>
                                        <div style={styles.cardHeader}>
                                            <h4 style={styles.chapterName}>{revision.chapterName}</h4>
                                            <span style={{
                                                ...styles.urgencyBadge,
                                                color: urgency.color,
                                                background: urgency.bg
                                            }}>
                                                {urgency.text}
                                            </span>
                                        </div>

                                        <p style={styles.subjectName}>{revision.subject}</p>

                                        <div style={styles.masteryRow}>
                                            <span style={styles.masteryLabel}>Mastery:</span>
                                            <div style={styles.masteryBar}>
                                                <div style={{
                                                    ...styles.masteryFill,
                                                    width: `${masteryPercent}%`
                                                }} />
                                            </div>
                                            <span style={styles.masteryPercent}>{masteryPercent}%</span>
                                        </div>

                                        <p style={styles.reviewInfo}>
                                            Reviews: {revision.reviewCount || 0} •
                                            Next interval: {REVIEW_INTERVALS[Math.min(revision.reviewCount || 0, REVIEW_INTERVALS.length - 1)]}d
                                        </p>
                                    </div>
                                </div>

                                <div style={styles.cardActions}>
                                    <button
                                        onClick={() => markAsReviewed(revision)}
                                        style={styles.reviewBtn}
                                    >
                                        ✓ Reviewed
                                    </button>
                                    <button
                                        onClick={() => markAsMastered(revision)}
                                        style={styles.masteredBtn}
                                    >
                                        🏆 Mastered
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {compact && revisions.length > 3 && (
                <button style={styles.viewAllBtn}>
                    View All Revisions ({revisions.length}) →
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
        marginBottom: '16px'
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
    overdueBadge: {
        padding: '6px 12px',
        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
        borderRadius: '16px',
        fontSize: '12px',
        fontWeight: 600,
        color: '#ffffff'
    },
    loading: {
        textAlign: 'center',
        padding: '40px',
        color: '#94a3b8'
    },
    legend: {
        display: 'flex',
        gap: '16px',
        marginBottom: '16px',
        fontSize: '12px',
        color: '#94a3b8'
    },
    legendItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
    },
    legendDot: {
        width: '8px',
        height: '8px',
        borderRadius: '50%'
    },
    empty: {
        textAlign: 'center',
        padding: '40px',
        color: '#64748b'
    },
    emptyHint: {
        fontSize: '13px',
        marginTop: '8px'
    },
    revisionList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
    },
    revisionCard: {
        padding: '16px',
        background: 'rgba(30, 41, 59, 0.6)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.05)'
    },
    overdueCard: {
        background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.1), rgba(30, 41, 59, 0.6))',
        border: '1px solid rgba(239, 68, 68, 0.3)'
    },
    cardMain: {
        display: 'flex',
        gap: '16px'
    },
    subjectIcon: {
        fontSize: '32px',
        flexShrink: 0
    },
    cardInfo: {
        flex: 1,
        minWidth: 0
    },
    cardHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '4px'
    },
    chapterName: {
        margin: 0,
        fontSize: '15px',
        fontWeight: 600,
        color: '#ffffff'
    },
    urgencyBadge: {
        padding: '2px 8px',
        borderRadius: '8px',
        fontSize: '11px',
        fontWeight: 700
    },
    subjectName: {
        margin: '0 0 8px 0',
        fontSize: '12px',
        color: '#94a3b8'
    },
    masteryRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '6px'
    },
    masteryLabel: {
        fontSize: '11px',
        color: '#64748b'
    },
    masteryBar: {
        flex: 1,
        height: '6px',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '3px',
        overflow: 'hidden'
    },
    masteryFill: {
        height: '100%',
        background: 'linear-gradient(90deg, #10b981, #059669)',
        borderRadius: '3px',
        transition: 'width 0.3s'
    },
    masteryPercent: {
        fontSize: '11px',
        color: '#10b981',
        fontWeight: 600,
        minWidth: '32px'
    },
    reviewInfo: {
        margin: 0,
        fontSize: '11px',
        color: '#64748b'
    },
    cardActions: {
        display: 'flex',
        gap: '8px',
        marginTop: '12px'
    },
    reviewBtn: {
        flex: 1,
        padding: '8px 12px',
        background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
        border: 'none',
        borderRadius: '8px',
        color: '#ffffff',
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'pointer'
    },
    masteredBtn: {
        padding: '8px 12px',
        background: 'transparent',
        border: '1px solid rgba(16, 185, 129, 0.5)',
        borderRadius: '8px',
        color: '#10b981',
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'pointer'
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

export default RevisionReminder;
