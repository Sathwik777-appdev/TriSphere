import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getAuth } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';

import { API_BASE_URL } from '../utils/apiBase';
import { useIsMobile } from '../hooks/useMediaQuery';

/**
 * Check if current date is in the download window (25th to last day of month).
 */
function isDownloadWindowOpen() {
    const now = new Date();
    const day = now.getDate();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return day >= 25 && day <= lastDay;
}

/**
 * Get current month and year for display.
 */
function getReportPeriod() {
    const now = new Date();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    return { month: monthNames[now.getMonth()], year: now.getFullYear() };
}

/**
 * ProgressReport Component
 * 
 * For Parents: shows download button for their child's report.
 * For Teachers: shows individual + batch download for their class.
 * For Admin/Principal: shows school-wide report access.
 */
export const ProgressReport = ({ role = 'parent', childId = null, classNumber = null, schoolName = '' }) => {
    const { user } = useAuth();
    const isMobile = useIsMobile();
    const [downloadEnabled, setDownloadEnabled] = useState(false);
    const [loading, setLoading] = useState(false);
    const [batchLoading, setBatchLoading] = useState(false);
    const [students, setStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Analytics States
    const [viewMode, setViewMode] = useState('download'); // 'download' or 'analytics'
    const [quizResults, setQuizResults] = useState([]);
    const [studentMoods, setStudentMoods] = useState([]);
    const [loadingAnalytics, setLoadingAnalytics] = useState(false);

    const { month, year } = getReportPeriod();

    useEffect(() => {
        setDownloadEnabled(isDownloadWindowOpen());
        // Check every minute for date changes
        const interval = setInterval(() => setDownloadEnabled(isDownloadWindowOpen()), 60000);
        return () => clearInterval(interval);
    }, []);

    // For teachers/admins: load student list
    useEffect(() => {
        if ((role === 'teacher' || role === 'principal' || role === 'admin') && classNumber) {
            loadStudents();
        }
    }, [classNumber, role]);

    const loadStudents = async () => {
        try {
            const classInt = parseInt(classNumber);
            const q = query(
                collection(db, 'users'),
                where('role', '==', 'student'),
                where('schoolName', '==', schoolName)
            );
            const snapshot = await getDocs(q);
            const filtered = snapshot.docs
                .filter(doc => {
                    const c = doc.data().class;
                    return c === classInt || String(c) === String(classNumber);
                })
                .map(doc => ({ id: doc.id, ...doc.data() }));
            setStudents(filtered);
        } catch (err) {
            console.error('Error loading students:', err);
        }
    };

    const fetchAnalytics = async () => {
        if (!classNumber || students.length === 0) return;
        setLoadingAnalytics(true);
        try {
            const classInt = parseInt(classNumber);
            const quizQ = query(
                collection(db, 'quizResults'),
                where('class', 'in', [classNumber, classInt])
            );
            const quizSnapshot = await getDocs(quizQ);
            const quizzes = quizSnapshot.docs.map(doc => doc.data());
            setQuizResults(quizzes);

            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const moodQ = query(
                collection(db, 'studentMoods'),
                where('createdAt', '>=', thirtyDaysAgo)
            );
            const moodSnapshot = await getDocs(moodQ);
            const classStudentIds = new Set(students.map(s => s.id));
            const moods = moodSnapshot.docs
                .map(doc => doc.data())
                .filter(m => classStudentIds.has(m.userId));
            setStudentMoods(moods);
        } catch (err) {
            console.error('Error fetching analytics:', err);
        } finally {
            setLoadingAnalytics(false);
        }
    };

    useEffect(() => {
        if (viewMode === 'analytics' && students.length > 0) {
            fetchAnalytics();
        }
    }, [viewMode, students]);

    const scoreDistribution = useMemo(() => {
        const brackets = {
            'Below 50%': 0,
            '50% - 70%': 0,
            '70% - 90%': 0,
            '90% - 100%': 0
        };
        quizResults.forEach(r => {
            const s = r.score;
            if (s < 50) brackets['Below 50%']++;
            else if (s < 70) brackets['50% - 70%']++;
            else if (s < 90) brackets['70% - 90%']++;
            else brackets['90% - 100%']++;
        });
        return Object.keys(brackets).map(key => ({
            bracket: key,
            count: brackets[key]
        }));
    }, [quizResults]);

    const sentimentBreakdown = useMemo(() => {
        const counts = {};
        studentMoods.forEach(m => {
            const emo = m.emotion || 'neutral';
            const formattedEmo = emo.charAt(0).toUpperCase() + emo.slice(1);
            counts[formattedEmo] = (counts[formattedEmo] || 0) + 1;
        });
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        return Object.keys(counts).map(key => ({
            name: key,
            value: counts[key],
            percentage: total > 0 ? Math.round((counts[key] / total) * 100) : 0
        }));
    }, [studentMoods]);

    const classStats = useMemo(() => {
        if (students.length === 0) return { avgStreak: 0, avgXP: 0, avgTasks: 0 };
        let totalStreak = 0;
        let totalXP = 0;
        let totalTasks = 0;
        let countWithStats = 0;

        students.forEach(s => {
            if (s.stats) {
                totalStreak += s.stats.streak || 0;
                totalXP += s.stats.xpBalance || s.stats.xp || 0;
                totalTasks += s.stats.tasksCompleted || 0;
                countWithStats++;
            }
        });

        return {
            avgStreak: countWithStats > 0 ? Math.round(totalStreak / countWithStats) : 0,
            avgXP: countWithStats > 0 ? Math.round(totalXP / countWithStats) : 0,
            avgTasks: countWithStats > 0 ? Math.round(totalTasks / countWithStats) : 0
        };
    }, [students]);

    const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];

    const getIdToken = async () => {
        const auth = getAuth();
        if (auth.currentUser) {
            return await auth.currentUser.getIdToken();
        }
        throw new Error('Not authenticated');
    };

    const downloadReport = useCallback(async (studentId) => {
        setLoading(true);
        setError('');
        setSuccess('');
        try {
            const token = await getIdToken();
            const response = await fetch(`${API_BASE_URL}/api/reports/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    studentId,
                    classNumber: classNumber || null,
                    schoolName
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to generate report');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `progress_report_${month}_${year}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            setSuccess('Report downloaded successfully!');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [classNumber, schoolName, month, year]);

    const downloadBatchReports = useCallback(async () => {
        setBatchLoading(true);
        setError('');
        setSuccess('');
        try {
            const token = await getIdToken();
            const response = await fetch(`${API_BASE_URL}/api/reports/generate-batch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ classNumber, schoolName })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to generate batch reports');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `class_${classNumber}_reports_${month}_${year}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            setSuccess('Class reports downloaded successfully!');
        } catch (err) {
            setError(err.message);
        } finally {
            setBatchLoading(false);
        }
    }, [classNumber, schoolName, month, year]);

    // ==================== PARENT VIEW ====================
    if (role === 'parent') {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={styles.container}
            >
                <div style={styles.header}>
                    <span style={styles.icon}>📊</span>
                    <div>
                        <h3 style={styles.title}>Monthly Progress Report</h3>
                        <p style={styles.subtitle}>{month} {year}</p>
                    </div>
                </div>

                <div style={styles.body}>
                    {!downloadEnabled && (
                        <div style={styles.infoBox}>
                            <span style={styles.infoIcon}>🔒</span>
                            <p style={styles.infoText}>
                                Reports will be available for download from the <strong>25th</strong> of every month.
                            </p>
                        </div>
                    )}

                    {downloadEnabled && (
                        <div style={styles.successBox}>
                            <span style={styles.infoIcon}>✅</span>
                            <p style={styles.infoText}>Reports are available for download!</p>
                        </div>
                    )}

                    <button
                        onClick={() => downloadReport(childId)}
                        disabled={!downloadEnabled || loading || !childId}
                        style={{
                            ...styles.downloadButton,
                            ...((!downloadEnabled || loading) ? styles.downloadButtonDisabled : {})
                        }}
                    >
                        {loading ? (
                            <span style={styles.loadingContent}>
                                <span style={styles.spinner}></span>
                                Generating Report...
                            </span>
                        ) : (
                            <>📥 Download Report</>
                        )}
                    </button>

                    <AnimatePresence>
                        {error && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={styles.errorMsg}>
                                ❌ {error}
                            </motion.div>
                        )}
                        {success && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={styles.successMsg}>
                                ✅ {success}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        );
    }

    // ==================== TEACHER / ADMIN VIEW ====================
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={styles.container}
        >
            <div style={styles.header}>
                <span style={styles.icon}>📊</span>
                <div style={{ flex: 1 }}>
                    <h3 style={styles.title}>Student Progress Reports</h3>
                    <p style={styles.subtitle}>Class {classNumber} • {month} {year}</p>
                </div>
                {(role === 'teacher' || role === 'principal' || role === 'admin') && (
                    <div style={styles.toggleContainer}>
                        <button
                            onClick={() => setViewMode('download')}
                            style={{
                                ...styles.toggleButton,
                                ...(viewMode === 'download' ? styles.toggleButtonActive : {})
                            }}
                        >
                            📥 Download Center
                        </button>
                        <button
                            onClick={() => setViewMode('analytics')}
                            style={{
                                ...styles.toggleButton,
                                ...(viewMode === 'analytics' ? styles.toggleButtonActive : {})
                            }}
                        >
                            📊 Class Analytics
                        </button>
                    </div>
                )}
                {viewMode === 'download' && (
                    <button
                        onClick={downloadBatchReports}
                        disabled={batchLoading || students.length === 0}
                        style={{
                            ...styles.batchButton,
                            ...(batchLoading ? styles.downloadButtonDisabled : {}),
                            marginLeft: '12px'
                        }}
                    >
                        {batchLoading ? (
                            <span style={styles.loadingContent}>
                                <span style={styles.spinner}></span>
                                Generating...
                            </span>
                        ) : (
                            <>📦 Download All (ZIP)</>
                        )}
                    </button>
                )}
            </div>

            <div style={styles.body}>
                {viewMode === 'download' ? (
                    students.length === 0 ? (
                        <div style={styles.emptyState}>
                            <p style={styles.emptyText}>No students found for Class {classNumber}.</p>
                        </div>
                    ) : (
                        <div style={styles.studentList}>
                            {students.map((student, index) => (
                                <motion.div
                                    key={student.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    style={styles.studentCard}
                                >
                                    <div style={styles.studentInfo}>
                                        <div style={styles.studentAvatar}>
                                            {student.photoUrl ? (
                                                <img src={student.photoUrl} alt="" style={styles.avatarImg} />
                                            ) : (
                                                <span>{(student.username || 'S')[0].toUpperCase()}</span>
                                            )}
                                        </div>
                                        <div>
                                            <p style={styles.studentName}>{student.username || 'Student'}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setSelectedStudent(student.id);
                                            downloadReport(student.id);
                                        }}
                                        disabled={loading && selectedStudent === student.id}
                                        style={styles.individualDownloadBtn}
                                    >
                                        {loading && selectedStudent === student.id ? (
                                            <span style={styles.spinner}></span>
                                        ) : (
                                            '📥'
                                        )}
                                    </button>
                                </motion.div>
                            ))}
                        </div>
                    )
                ) : (
                    /* Performance Analytics View */
                    loadingAnalytics ? (
                        <div style={styles.loadingAnalytics}>
                            <span style={styles.spinner}></span>
                            <span style={{ marginLeft: '10px' }}>Loading class metrics...</span>
                        </div>
                    ) : (
                        <div style={styles.analyticsPanel}>
                            {/* Class Stats Row */}
                            <div style={styles.analyticsGrid}>
                                <div style={styles.statBoxCard}>
                                    <span style={styles.statBoxEmoji}>🔥</span>
                                    <div>
                                        <div style={styles.statBoxVal}>{classStats.avgStreak} days</div>
                                        <div style={styles.statBoxLabel}>Avg Study Streak</div>
                                    </div>
                                </div>
                                <div style={{ ...styles.statBoxCard, borderLeft: '3px solid #f59e0b' }}>
                                    <span style={styles.statBoxEmoji}>⭐</span>
                                    <div>
                                        <div style={styles.statBoxVal}>{classStats.avgXP.toLocaleString()}</div>
                                        <div style={styles.statBoxLabel}>Avg Student XP</div>
                                    </div>
                                </div>
                                <div style={{ ...styles.statBoxCard, borderLeft: '3px solid #10b981' }}>
                                    <span style={styles.statBoxEmoji}>✅</span>
                                    <div>
                                        <div style={styles.statBoxVal}>{classStats.avgTasks}</div>
                                        <div style={styles.statBoxLabel}>Avg Tasks Completed</div>
                                    </div>
                                </div>
                            </div>

                            {/* Charts Row */}
                            <div style={{
                                ...styles.chartsContainer,
                                gridTemplateColumns: `repeat(auto-fit, minmax(${isMobile ? '260px' : '320px'}, 1fr))`
                            }}>
                                {/* Bar Chart */}
                                <div style={{ ...styles.chartCard, padding: isMobile ? '12px' : '20px' }}>
                                    <h4 style={styles.chartTitle}>Quiz Score Distribution</h4>
                                    {quizResults.length === 0 ? (
                                        <div style={styles.chartEmpty}>No quiz data recorded yet.</div>
                                    ) : (
                                        <div style={{ width: '100%', height: '220px' }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={scoreDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                    <XAxis dataKey="bracket" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                                                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                                    <Tooltip 
                                                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                                        labelStyle={{ color: '#fff', fontWeight: 600 }}
                                                    />
                                                    <Bar dataKey="count" fill="#6366f1" radius={[8, 8, 0, 0]}>
                                                        {scoreDistribution.map((entry, index) => {
                                                            const barColors = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'];
                                                            return <Cell key={`cell-${index}`} fill={barColors[index % barColors.length]} />;
                                                        })}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    )}
                                </div>

                                {/* Pie Chart */}
                                <div style={{ ...styles.chartCard, padding: isMobile ? '12px' : '20px' }}>
                                    <h4 style={styles.chartTitle}>ASTRA Sentiment Breakdown</h4>
                                    {studentMoods.length === 0 ? (
                                        <div style={styles.chartEmpty}>No mood logs recorded in the last 30 days.</div>
                                    ) : (
                                        <div style={{
                                            width: '100%',
                                            height: isMobile ? 'auto' : '220px',
                                            display: 'flex',
                                            flexDirection: isMobile ? 'column' : 'row',
                                            alignItems: 'center',
                                            gap: isMobile ? '16px' : '0'
                                        }}>
                                            <div style={{
                                                width: isMobile ? '100%' : 'auto',
                                                flex: isMobile ? 'none' : 1.2,
                                                height: isMobile ? '180px' : '100%'
                                            }}>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie
                                                            data={sentimentBreakdown}
                                                            cx="50%"
                                                            cy="50%"
                                                            innerRadius={60}
                                                            outerRadius={80}
                                                            paddingAngle={4}
                                                            dataKey="value"
                                                        >
                                                            {sentimentBreakdown.map((entry, index) => (
                                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                            ))}
                                                        </Pie>
                                                        <Tooltip
                                                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                                            itemStyle={{ color: '#fff' }}
                                                        />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </div>
                                            <div style={{
                                                ...styles.legendContainer,
                                                width: isMobile ? '100%' : 'auto',
                                                flexDirection: isMobile ? 'row' : 'column',
                                                flexWrap: isMobile ? 'wrap' : 'nowrap',
                                                justifyContent: isMobile ? 'center' : 'flex-start',
                                                gap: isMobile ? '10px 16px' : '8px'
                                            }}>
                                                {sentimentBreakdown.map((entry, index) => (
                                                    <div key={entry.name} style={styles.legendItem}>
                                                        <span style={{ ...styles.legendDot, backgroundColor: COLORS[index % COLORS.length] }} />
                                                        <span style={styles.legendName}>{entry.name}</span>
                                                        <span style={styles.legendVal}>{entry.percentage}%</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                )}

                <AnimatePresence>
                    {error && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={styles.errorMsg}>
                            ❌ {error}
                        </motion.div>
                    )}
                    {success && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={styles.successMsg}>
                            ✅ {success}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};

// ==================== STYLES ====================
const styles = {
    container: {
        background: 'rgba(255, 255, 255, 0.04)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '20px 24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(99, 102, 241, 0.06)',
    },
    icon: {
        fontSize: '32px',
    },
    title: {
        margin: 0,
        fontSize: '18px',
        fontWeight: 700,
        color: '#f1f5f9',
    },
    subtitle: {
        margin: '2px 0 0 0',
        fontSize: '13px',
        color: '#94a3b8',
    },
    body: {
        padding: '20px 24px',
    },
    infoBox: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '14px 18px',
        background: 'rgba(234, 179, 8, 0.08)',
        border: '1px solid rgba(234, 179, 8, 0.2)',
        borderRadius: '10px',
        marginBottom: '16px',
    },
    successBox: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '14px 18px',
        background: 'rgba(52, 211, 153, 0.08)',
        border: '1px solid rgba(52, 211, 153, 0.2)',
        borderRadius: '10px',
        marginBottom: '16px',
    },
    infoIcon: {
        fontSize: '20px',
    },
    infoText: {
        margin: 0,
        fontSize: '13px',
        color: '#cbd5e1',
        lineHeight: '1.5',
    },
    downloadButton: {
        width: '100%',
        padding: '14px 24px',
        background: 'linear-gradient(135deg, #4338ca, #7c3aed)',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        fontSize: '15px',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)',
        letterSpacing: '0.5px',
    },
    downloadButtonDisabled: {
        background: 'rgba(255, 255, 255, 0.05)',
        color: '#64748b',
        cursor: 'not-allowed',
        boxShadow: 'none',
    },
    batchButton: {
        padding: '10px 20px',
        background: 'linear-gradient(135deg, #059669, #10b981)',
        color: 'white',
        border: 'none',
        borderRadius: '10px',
        fontSize: '13px',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
        whiteSpace: 'nowrap',
    },
    loadingContent: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
    },
    spinner: {
        display: 'inline-block',
        width: '16px',
        height: '16px',
        border: '2px solid rgba(255, 255, 255, 0.3)',
        borderTop: '2px solid white',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
    },
    studentList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        maxHeight: '400px',
        overflowY: 'auto',
    },
    studentCard: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.07)',
        borderRadius: '10px',
        transition: 'all 0.2s ease',
    },
    studentInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    studentAvatar: {
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #4338ca, #7c3aed)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: '14px',
        fontWeight: 700,
        overflow: 'hidden',
    },
    avatarImg: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        borderRadius: '50%',
    },
    studentName: {
        margin: 0,
        fontSize: '14px',
        fontWeight: 600,
        color: '#f1f5f9',
    },
    studentMeta: {
        margin: '2px 0 0 0',
        fontSize: '11px',
        color: '#64748b',
    },
    individualDownloadBtn: {
        width: '36px',
        height: '36px',
        background: 'rgba(99, 102, 241, 0.15)',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s ease',
        color: '#818cf8',
    },
    emptyState: {
        textAlign: 'center',
        padding: '40px 20px',
    },
    emptyText: {
        color: '#64748b',
        fontSize: '14px',
    },
    errorMsg: {
        marginTop: '12px',
        padding: '10px 14px',
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: '8px',
        color: '#fca5a5',
        fontSize: '13px',
    },
    successMsg: {
        marginTop: '12px',
        padding: '10px 14px',
        background: 'rgba(52, 211, 153, 0.1)',
        border: '1px solid rgba(52, 211, 153, 0.3)',
        borderRadius: '8px',
        color: '#6ee7b7',
        fontSize: '13px',
    },
    toggleContainer: {
        display: 'flex',
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '14px',
        padding: '3px',
        gap: '2px',
    },
    toggleButton: {
        padding: '6px 14px',
        border: 'none',
        borderRadius: '10px',
        background: 'transparent',
        color: '#94a3b8',
        fontSize: '12px',
        fontWeight: '700',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    toggleButtonActive: {
        background: 'rgba(99, 102, 241, 0.15)',
        color: '#c7d2fe',
        border: '1px solid rgba(99, 102, 241, 0.25)',
        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.15)',
    },
    loadingAnalytics: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        color: '#94a3b8',
        fontSize: '14px',
    },
    analyticsPanel: {
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
    },
    analyticsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
    },
    statBoxCard: {
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderLeft: '3px solid #6366f1',
        borderRadius: '14px',
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
    },
    statBoxEmoji: {
        fontSize: '24px',
    },
    statBoxVal: {
        fontSize: '18px',
        fontWeight: '900',
        color: '#fff',
    },
    statBoxLabel: {
        fontSize: '11px',
        color: '#64748b',
        fontWeight: '700',
        marginTop: '2px',
    },
    chartsContainer: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '20px',
    },
    chartCard: {
        background: 'rgba(255, 255, 255, 0.01)',
        border: '1px solid rgba(255, 255, 255, 0.04)',
        borderRadius: '18px',
        padding: '20px',
    },
    chartTitle: {
        margin: '0 0 16px 0',
        fontSize: '14px',
        fontWeight: '800',
        color: '#e2e8f0',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
    },
    chartEmpty: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '220px',
        color: '#475569',
        fontSize: '13px',
        fontWeight: '500',
    },
    legendContainer: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        paddingLeft: '12px',
    },
    legendItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    legendDot: {
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        flexShrink: 0,
    },
    legendName: {
        fontSize: '11px',
        color: '#94a3b8',
        fontWeight: '600',
        flex: 1,
    },
    legendVal: {
        fontSize: '11px',
        color: '#f1f5f9',
        fontWeight: '700',
    },
};

export default ProgressReport;
