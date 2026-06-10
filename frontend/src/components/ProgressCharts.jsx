/**
 * Progress Charts Component
 * Visual charts showing student progress over time using Recharts
 */
import React, { useState, useEffect } from 'react';
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer, Area, AreaChart
} from 'recharts';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';

export const ProgressCharts = ({ studentId, selectedSubject }) => {
    const [quizData, setQuizData] = useState([]);
    const [subjectData, setSubjectData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [chartView, setChartView] = useState('timeline'); // 'timeline' or 'subjects'

    useEffect(() => {
        if (studentId) {
            fetchProgressData();
        }
    }, [studentId, selectedSubject]);

    const fetchProgressData = async () => {
        setLoading(true);
        try {
            // Fetch quiz results for the student
            const q = query(
                collection(db, 'quizResults'),
                where('studentId', '==', studentId),
                where('malpractice', '==', false)
            );
            const snapshot = await getDocs(q);

            const results = [];
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                results.push({
                    id: doc.id,
                    subject: data.subject,
                    chapterName: data.chapterName,
                    score: data.score || Math.round((data.correctAnswers / data.totalQuestions) * 100),
                    date: data.completedAt?.toDate?.() || new Date(data.completedAt)
                });
            });

            // Sort by date
            results.sort((a, b) => a.date - b.date);

            // Format for timeline chart
            const timelineData = results.map((r, idx) => ({
                name: r.chapterName?.substring(0, 15) || `Quiz ${idx + 1}`,
                score: r.score,
                date: r.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                subject: r.subject
            }));

            // Filter by selected subject if specified
            const filteredData = selectedSubject
                ? timelineData.filter(d => d.subject === selectedSubject)
                : timelineData;

            setQuizData(filteredData.slice(-10)); // Last 10 quizzes

            // Aggregate by subject for bar chart
            const subjectScores = {};
            results.forEach(r => {
                if (!subjectScores[r.subject]) {
                    subjectScores[r.subject] = { total: 0, count: 0 };
                }
                subjectScores[r.subject].total += r.score;
                subjectScores[r.subject].count += 1;
            });

            const subjectChartData = Object.entries(subjectScores).map(([subject, data]) => ({
                subject,
                average: Math.round(data.total / data.count),
                quizzes: data.count
            }));

            setSubjectData(subjectChartData);

        } catch (err) {
            console.error('Error fetching progress data:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div style={styles.loadingContainer}>
                <div style={styles.loadingText}>📊 Loading charts...</div>
            </div>
        );
    }

    if (quizData.length === 0) {
        return (
            <div style={styles.emptyState}>
                <span style={styles.emptyIcon}>📈</span>
                <p style={styles.emptyText}>No quiz data yet</p>
                <p style={styles.emptySubtext}>Complete some quizzes to see your progress charts!</p>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h3 style={styles.title}>📊 Progress Charts</h3>
                <div style={styles.viewToggle}>
                    <button
                        onClick={() => setChartView('timeline')}
                        style={{
                            ...styles.toggleButton,
                            ...(chartView === 'timeline' ? styles.toggleButtonActive : {})
                        }}
                    >
                        📈 Timeline
                    </button>
                    <button
                        onClick={() => setChartView('subjects')}
                        style={{
                            ...styles.toggleButton,
                            ...(chartView === 'subjects' ? styles.toggleButtonActive : {})
                        }}
                    >
                        📊 By Subject
                    </button>
                </div>
            </div>

            {chartView === 'timeline' ? (
                <div style={styles.chartContainer}>
                    <h4 style={styles.chartTitle}>Quiz Scores Over Time</h4>
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={quizData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis
                                dataKey="date"
                                stroke="#6b7280"
                                fontSize={12}
                            />
                            <YAxis
                                domain={[0, 100]}
                                stroke="#6b7280"
                                fontSize={12}
                                tickFormatter={(value) => `${value}%`}
                            />
                            <Tooltip
                                contentStyle={styles.tooltip}
                                formatter={(value) => [`${value}%`, 'Score']}
                            />
                            <Area
                                type="monotone"
                                dataKey="score"
                                stroke="#8b5cf6"
                                strokeWidth={3}
                                fill="url(#scoreGradient)"
                                dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 5 }}
                                activeDot={{ r: 8, fill: '#7c3aed' }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                    <div style={styles.chartLegend}>
                        <span style={styles.legendDot}></span>
                        <span style={styles.legendText}>Quiz Score (%)</span>
                    </div>
                </div>
            ) : (
                <div style={styles.chartContainer}>
                    <h4 style={styles.chartTitle}>Average Score by Subject</h4>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={subjectData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis
                                dataKey="subject"
                                stroke="#6b7280"
                                fontSize={12}
                            />
                            <YAxis
                                domain={[0, 100]}
                                stroke="#6b7280"
                                fontSize={12}
                                tickFormatter={(value) => `${value}%`}
                            />
                            <Tooltip
                                contentStyle={styles.tooltip}
                                formatter={(value, name) => [
                                    name === 'average' ? `${value}%` : value,
                                    name === 'average' ? 'Avg Score' : 'Quizzes'
                                ]}
                            />
                            <Bar
                                dataKey="average"
                                fill="#10b981"
                                radius={[8, 8, 0, 0]}
                                name="average"
                            />
                        </BarChart>
                    </ResponsiveContainer>
                    <div style={styles.statsRow}>
                        {subjectData.map(s => (
                            <div key={s.subject} style={styles.statBadge}>
                                <span style={styles.statSubject}>{s.subject}</span>
                                <span style={styles.statValue}>{s.average}%</span>
                                <span style={styles.statQuizzes}>{s.quizzes} quiz{s.quizzes > 1 ? 'zes' : ''}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const styles = {
    container: {
        background: 'linear-gradient(135deg, #fafafa, #f5f5f5)',
        borderRadius: '16px',
        padding: '20px',
        marginTop: '20px'
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '12px'
    },
    title: {
        margin: 0,
        fontSize: '18px',
        fontWeight: '700',
        color: '#1f2937'
    },
    viewToggle: {
        display: 'flex',
        gap: '8px'
    },
    toggleButton: {
        padding: '8px 16px',
        borderRadius: '8px',
        border: 'none',
        backgroundColor: '#e5e7eb',
        color: '#6b7280',
        fontSize: '13px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s'
    },
    toggleButtonActive: {
        backgroundColor: '#8b5cf6',
        color: 'white'
    },
    chartContainer: {
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
    },
    chartTitle: {
        margin: '0 0 16px 0',
        fontSize: '14px',
        fontWeight: '600',
        color: '#374151'
    },
    chartLegend: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        marginTop: '16px'
    },
    legendDot: {
        width: '12px',
        height: '12px',
        borderRadius: '50%',
        backgroundColor: '#8b5cf6'
    },
    legendText: {
        fontSize: '13px',
        color: '#6b7280'
    },
    tooltip: {
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
    },
    statsRow: {
        display: 'flex',
        gap: '12px',
        marginTop: '16px',
        flexWrap: 'wrap',
        justifyContent: 'center'
    },
    statBadge: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '12px 16px',
        backgroundColor: '#f3f4f6',
        borderRadius: '10px',
        minWidth: '80px'
    },
    statSubject: {
        fontSize: '12px',
        color: '#6b7280',
        fontWeight: '500'
    },
    statValue: {
        fontSize: '20px',
        fontWeight: '700',
        color: '#10b981'
    },
    statQuizzes: {
        fontSize: '11px',
        color: '#9ca3af'
    },
    loadingContainer: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '40px',
        backgroundColor: '#f9fafb',
        borderRadius: '12px'
    },
    loadingText: {
        fontSize: '16px',
        color: '#6b7280'
    },
    emptyState: {
        textAlign: 'center',
        padding: '40px 20px',
        backgroundColor: '#f9fafb',
        borderRadius: '12px'
    },
    emptyIcon: {
        fontSize: '48px',
        display: 'block',
        marginBottom: '12px'
    },
    emptyText: {
        fontSize: '16px',
        fontWeight: '600',
        color: '#374151',
        margin: '0 0 4px 0'
    },
    emptySubtext: {
        fontSize: '14px',
        color: '#6b7280',
        margin: 0
    }
};

export default ProgressCharts;
