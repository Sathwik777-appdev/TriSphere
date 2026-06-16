import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import Skeleton from './Skeleton';
import { ShieldIcon, WarningIcon, TargetIcon } from './Icons';

export const TeacherEarlyWarning = ({ classNumber, subject, schoolName }) => {
  const [atRiskStudents, setAtRiskStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!classNumber || !subject) return;
      setLoading(true);

      try {
        // Query quiz results for this class and subject
        const q = query(
          collection(db, 'quizResults'),
          where('subject', '==', subject)
        );
        const snapshot = await getDocs(q);

        const classInt = parseInt(classNumber);
        const studentMap = new Map();

        snapshot.docs.forEach(doc => {
          const data = doc.data();
          // Verify class and school manually to avoid needing complex composite indexes
          if (
            (data.class === classInt || String(data.class) === String(classNumber)) &&
            (!schoolName || data.schoolName === schoolName || !data.schoolName)
          ) {
            const sid = data.studentId;
            if (!studentMap.has(sid)) {
              studentMap.set(sid, {
                studentId: sid,
                studentName: data.studentName || 'Unknown Student',
                totalScore: 0,
                quizzesTaken: 0,
                malpracticeCount: 0,
                recentScores: []
              });
            }
            
            const stats = studentMap.get(sid);
            if (data.malpractice) {
              stats.malpracticeCount++;
            } else {
              stats.totalScore += (data.score || 0);
              stats.quizzesTaken++;
              stats.recentScores.push({ score: data.score || 0, date: data.completedAt?.toDate() || new Date() });
            }
          }
        });

        const atRisk = [];

        studentMap.forEach(stats => {
          stats.averageScore = stats.quizzesTaken > 0 ? Math.round(stats.totalScore / stats.quizzesTaken) : 0;
          
          // Calculate trend if they have more than 1 quiz
          stats.trend = 'flat';
          if (stats.recentScores.length > 1) {
            stats.recentScores.sort((a, b) => b.date - a.date); // Newest first
            const latest = stats.recentScores[0].score;
            const previous = stats.recentScores[1].score;
            if (latest < previous - 10) stats.trend = 'down';
            else if (latest > previous + 10) stats.trend = 'up';
          }

          // AT RISK CRITERIA
          // 1. Average below 50%
          // 2. Trend is sharply down
          // 3. ANY malpractice detected
          
          let riskLevel = 'none';
          let riskReasons = [];
          
          if (stats.malpracticeCount > 0) {
            riskLevel = 'critical';
            riskReasons.push(`Detected ${stats.malpracticeCount} malpractice attempts (App switching / Screenshots)`);
          }
          
          if (stats.averageScore < 40 && stats.quizzesTaken > 0) {
            riskLevel = riskLevel === 'none' ? 'high' : riskLevel;
            riskReasons.push(`Critical average score (${stats.averageScore}%)`);
          } else if (stats.averageScore < 55 && stats.quizzesTaken > 0) {
            riskLevel = riskLevel === 'none' ? 'medium' : riskLevel;
            riskReasons.push(`Low average score (${stats.averageScore}%)`);
          }
          
          if (stats.trend === 'down' && stats.quizzesTaken > 1) {
            riskLevel = riskLevel === 'none' ? 'medium' : riskLevel;
            riskReasons.push('Performance dropping rapidly (-10% or more on last quiz)');
          }

          if (riskLevel !== 'none') {
            atRisk.push({
              ...stats,
              riskLevel,
              riskReasons
            });
          }
        });

        // Sort by risk severity (critical > high > medium)
        atRisk.sort((a, b) => {
          const levels = { critical: 3, high: 2, medium: 1 };
          return levels[b.riskLevel] - levels[a.riskLevel];
        });

        setAtRiskStudents(atRisk);
      } catch (err) {
        console.error('Error fetching predictive analytics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [classNumber, subject, schoolName]);

  const getRiskColor = (level) => {
    switch(level) {
      case 'critical': return '#ef4444'; // Red
      case 'high': return '#f97316';     // Orange
      case 'medium': return '#eab308';   // Yellow
      default: return '#22c55e';         // Green
    }
  };

  const styles = {
    container: {
      padding: '24px',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      borderBottom: '1px solid rgba(255,255,255,0.1)',
      paddingBottom: '16px',
    },
    title: {
      fontSize: '24px',
      margin: 0,
      fontWeight: 'bold',
      background: 'linear-gradient(90deg, #f87171, #fcd34d)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
    },
    subtitle: {
      color: '#9ca3af',
      fontSize: '14px',
      margin: '4px 0 0 0',
    },
    emptyState: {
      padding: '40px',
      textAlign: 'center',
      backgroundColor: 'rgba(34, 197, 94, 0.1)',
      borderRadius: '16px',
      border: '1px solid rgba(34, 197, 94, 0.2)',
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
      gap: '20px',
    },
    card: {
      backgroundColor: 'rgba(15, 23, 42, 0.6)',
      borderRadius: '16px',
      padding: '20px',
      borderLeft: '4px solid',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
    },
    cardHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    studentName: {
      margin: 0,
      fontSize: '18px',
      fontWeight: '600',
    },
    badge: {
      padding: '4px 8px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: 'bold',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
    },
    statsRow: {
      display: 'flex',
      gap: '16px',
    },
    stat: {
      display: 'flex',
      flexDirection: 'column',
    },
    statLabel: {
      fontSize: '12px',
      color: '#9ca3af',
    },
    statValue: {
      fontSize: '16px',
      fontWeight: 'bold',
    },
    reasonsContainer: {
      backgroundColor: 'rgba(0,0,0,0.2)',
      borderRadius: '8px',
      padding: '12px',
    },
    reasonTitle: {
      margin: '0 0 8px 0',
      fontSize: '12px',
      color: '#9ca3af',
      textTransform: 'uppercase',
      letterSpacing: '1px',
    },
    reasonList: {
      margin: 0,
      padding: '0 0 0 16px',
      fontSize: '14px',
      color: '#e5e7eb',
    },
    reasonItem: {
      marginBottom: '4px',
    },
    aiIntervention: {
      marginTop: 'auto',
      padding: '12px',
      backgroundColor: 'rgba(99, 102, 241, 0.1)',
      border: '1px solid rgba(99, 102, 241, 0.3)',
      borderRadius: '8px',
      fontSize: '13px',
      color: '#c7d2fe',
      display: 'flex',
      gap: '8px',
      alignItems: 'flex-start',
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <Skeleton.Dashboard cardCount={3} />
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <WarningIcon size={32} color="#f87171" />
        <div>
          <h2 style={styles.title}>Predictive Analysis & Early Warning</h2>
          <p style={styles.subtitle}>AI-driven insights to identify students needing intervention before exams.</p>
        </div>
      </div>

      {atRiskStudents.length === 0 ? (
        <div style={styles.emptyState}>
          <ShieldIcon size={48} color="#22c55e" style={{ marginBottom: '16px' }} />
          <h3 style={{ margin: '0 0 8px 0', color: '#4ade80' }}>Classroom is Healthy!</h3>
          <p style={{ margin: 0, color: '#bbf7d0' }}>
            No students are currently flagged as at-risk. Engagement and scores are stable.
          </p>
        </div>
      ) : (
        <div style={styles.grid}>
          {atRiskStudents.map((student) => (
            <div 
              key={student.studentId} 
              style={{
                ...styles.card,
                borderLeftColor: getRiskColor(student.riskLevel)
              }}
            >
              <div style={styles.cardHeader}>
                <h3 style={styles.studentName}>{student.studentName}</h3>
                <span style={{
                  ...styles.badge,
                  backgroundColor: `${getRiskColor(student.riskLevel)}20`,
                  color: getRiskColor(student.riskLevel)
                }}>
                  {student.riskLevel} RISK
                </span>
              </div>

              <div style={styles.statsRow}>
                <div style={styles.stat}>
                  <span style={styles.statLabel}>AVG SCORE</span>
                  <span style={{
                    ...styles.statValue,
                    color: student.averageScore < 50 ? '#ef4444' : '#fff'
                  }}>
                    {student.averageScore}%
                  </span>
                </div>
                <div style={styles.stat}>
                  <span style={styles.statLabel}>QUIZZES</span>
                  <span style={styles.statValue}>{student.quizzesTaken}</span>
                </div>
                <div style={styles.stat}>
                  <span style={styles.statLabel}>TREND</span>
                  <span style={{
                    ...styles.statValue,
                    color: student.trend === 'down' ? '#ef4444' : student.trend === 'up' ? '#22c55e' : '#9ca3af'
                  }}>
                    {student.trend.toUpperCase()}
                  </span>
                </div>
              </div>

              <div style={styles.reasonsContainer}>
                <h4 style={styles.reasonTitle}>Flagged Reasons</h4>
                <ul style={styles.reasonList}>
                  {student.riskReasons.map((reason, idx) => (
                    <li key={idx} style={styles.reasonItem}>{reason}</li>
                  ))}
                </ul>
              </div>

              <div style={styles.aiIntervention}>
                <TargetIcon size={16} color="#818cf8" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>AI Recommended Action:</strong><br />
                  {student.riskLevel === 'critical' && student.malpracticeCount > 0
                    ? "Schedule a 1-on-1 meeting. Discuss app-switching behavior during quizzes and re-evaluate testing environment."
                    : student.trend === 'down' 
                    ? "Send a gentle check-in message. Sudden drop in performance indicates external distraction or missing a foundational concept."
                    : "Assign a remedial AI Tutor session focused on their weakest chapters from the recent quiz."}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TeacherEarlyWarning;
