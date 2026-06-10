import React, { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import PerformanceComparisonChart from './PerformanceComparisonChart';

export const ParentPerformance = ({ childId, childName, childClass, schoolName }) => {
  const { userData } = useAuth();
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(true);
  // Surface fetch errors in the UI so parents on flaky networks get a
  // clear "couldn't load" + Retry instead of a stuck "Loading…" text.
  const [error, setError] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [quizResults, setQuizResults] = useState([]);

  // Lifted out of the useEffect so the Retry button below can call it
  // directly without restarting the effect / changing dependencies.
  const fetchPerformance = useCallback(async () => {
    if (!childId || !childClass) return;

    try {
      setLoading(true);
      setError(null);

        const isDeveloper = userData?.role === 'developer';
        // Only use schoolName filter for collections that store it (e.g. assignments)
        const schoolFilter = isDeveloper ? [] : [where('schoolName', '==', schoolName || '')];

        // Fetch all quiz results for the child (quizResults has no schoolName field)
        const quizQuery = query(
          collection(db, 'quizResults'),
          where('studentId', '==', childId)
        );
        const quizSnapshot = await getDocs(quizQuery);
        const allQuizResults = quizSnapshot.docs.map(doc => doc.data());
        setQuizResults(allQuizResults);

        // Fetch all submissions for the child (studentSubmissions has no schoolName field)
        const submissionsQuery = query(
          collection(db, 'studentSubmissions'),
          where('studentId', '==', childId)
        );
        const submissionsSnapshot = await getDocs(submissionsQuery);

        // Group by chapter
        const chapterData = {};

        // Process quiz results
        quizSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const chapterName = data.chapterName || 'Unknown Chapter';
          const subject = data.subject || 'Unknown';

          if (!chapterData[chapterName]) {
            chapterData[chapterName] = {
              subject,
              quizScores: [],
              totalQuizzes: 0,
              assignmentSubmitted: false,
              hasAssignment: false,
              malpracticeCount: 0,
              malpracticeReasons: []
            };
          }

          // Check for malpractice
          if (data.malpractice) {
            chapterData[chapterName].malpracticeCount++;
            if (data.malpracticeReason) {
              chapterData[chapterName].malpracticeReasons.push(data.malpracticeReason);
            }
          } else {
            // Only count non-malpractice scores in average
            chapterData[chapterName].quizScores.push(data.score || 0);
          }

          chapterData[chapterName].totalQuizzes++;
        });

        // Process assignment submissions
        submissionsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const chapterName = data.chapterName || data.assignmentTitle || 'Unknown Chapter';
          const subject = data.subject || 'Unknown';

          if (!chapterData[chapterName]) {
            chapterData[chapterName] = {
              subject,
              quizScores: [],
              totalQuizzes: 0,
              assignmentSubmitted: false,
              hasAssignment: false,
              malpracticeCount: 0,
              malpracticeReasons: []
            };
          }

          chapterData[chapterName].assignmentSubmitted = true;
        });

        // Get all assignments for this class
        const assignmentsQuery = query(
          collection(db, 'assignments'),
          where('class', '==', childClass),
          ...schoolFilter
        );
        const assignmentsSnapshot = await getDocs(assignmentsQuery);
        assignmentsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const chapterName = data.chapterName || data.assignmentTitle || 'Unknown Chapter';
          const subject = data.subject || 'Unknown';

          if (!chapterData[chapterName]) {
            chapterData[chapterName] = {
              subject,
              quizScores: [],
              totalQuizzes: 0,
              assignmentSubmitted: false,
              hasAssignment: false,
              malpracticeCount: 0,
              malpracticeReasons: []
            };
          }

          chapterData[chapterName].hasAssignment = true;
        });

        // Calculate metrics for each chapter
        const performanceData = {};
        Object.entries(chapterData).forEach(([chapterName, data]) => {
          const avgMarks = data.quizScores.length > 0
            ? Math.round(data.quizScores.reduce((a, b) => a + b, 0) / data.quizScores.length)
            : 0;

          const completion = data.hasAssignment && data.assignmentSubmitted ? 100 : 0;

          performanceData[chapterName] = {
            subject: data.subject,
            completion,
            avgMarks,
            quizzesTaken: data.totalQuizzes,
            assignmentStatus: data.hasAssignment
              ? (data.assignmentSubmitted ? 'Submitted' : 'Pending')
              : 'No Assignment',
            malpracticeCount: data.malpracticeCount,
            malpracticeReasons: data.malpracticeReasons
          };
        });

        setPerformance(performanceData);
      } catch (err) {
        // The "building" check below preserves prior behavior of
        // suppressing the noisy "index is still building" startup error
        // from Firestore — but for every OTHER kind of fetch failure we
        // now surface a friendly retry card to the parent.
        if (!err?.message?.includes('building')) {
          console.error('Error fetching performance:', err);
          setError(err?.message || "Couldn't load your child's performance data.");
        }
      } finally {
        setLoading(false);
      }
  }, [childId, childClass, schoolName, userData?.role]);

  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  // All available subjects
  const allSubjects = [
    'Physics',
    'Chemistry',
    'Mathematics',
    'Biology',
    'Computer Studies',
    'Geography',
    'History and Civics'
  ];

  // Filter by subject
  const filteredPerformance = performance && selectedSubject === 'all'
    ? performance
    : performance && Object.fromEntries(
      Object.entries(performance).filter(([_, data]) => data.subject === selectedSubject)
    );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>📊 Performance Overview - {childName}</h3>

        <div style={styles.filterContainer}>
          <label style={styles.filterLabel}>Filter by Subject:</label>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            style={styles.select}
          >
            <option value="all">All Subjects</option>
            {allSubjects.map(subject => (
              <option key={subject} value={subject}>{subject}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grading Rules & Malpractice Insights Guide */}
      <div style={{
        padding: '12px 16px',
        background: 'rgba(59, 130, 246, 0.08)',
        border: '1px solid rgba(59, 130, 246, 0.25)',
        borderRadius: '10px',
        marginBottom: '20px',
        fontSize: '12px',
        color: '#cbd5e1',
        lineHeight: '1.5',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <span style={{ fontSize: '20px' }}>💡</span>
        <div>
          <strong style={{ color: '#60a5fa' }}>How TriSphere Grades Work:</strong> A perfect first attempt counts alone. Otherwise, the final mark is the average of all valid attempts on that chapter. Malpractice alerts indicate screen-switching or banned aids during a quiz attempt.
        </div>
      </div>

      {!loading && !error && (
        <PerformanceComparisonChart quizResults={quizResults} />
      )}

      {loading ? (
        <p style={styles.noData}>Loading performance data...</p>
      ) : error ? (
        // Friendly fetch-error fallback with retry. Previously these
        // panels would land on the "No performance data" empty state
        // even when the issue was a network blip — misleading parents
        // into thinking their child had no records.
        <div
          style={{
            padding: 18,
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.30)',
            borderRadius: 14,
            color: '#fecaca',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <span style={{ fontSize: 22 }}>⚠️</span>
          <span style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>
            Couldn't load performance data. Check your internet connection and try again.
          </span>
          <button
            onClick={fetchPerformance}
            style={{
              padding: '8px 16px',
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            🔄 Retry
          </button>
        </div>
      ) : filteredPerformance && Object.keys(filteredPerformance).length > 0 ? (
        <div style={styles.subjectsGrid}>
          {Object.entries(filteredPerformance).map(([chapterName, data]) => (
            <div 
              key={chapterName} 
              style={{
                ...styles.subjectCard,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              onMouseOver={e => {
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(59, 130, 246, 0.15)';
              }}
              onMouseOut={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.25)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <h4 style={styles.subjectName}>{chapterName}</h4>

              <div style={styles.subjectBadgeContainer}>
                <span style={styles.subjectBadge}>{data.subject}</span>
              </div>

              <div style={styles.metricContainer}>
                <label style={styles.metricLabel}>Assignment Status</label>
                <div style={{
                  ...styles.statusBadge,
                  backgroundColor: data.assignmentStatus === 'Submitted' ? 'rgba(52, 211, 153, 0.1)' :
                    data.assignmentStatus === 'Pending' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                  border: data.assignmentStatus === 'Submitted' ? '1px solid rgba(52, 211, 153, 0.3)' :
                    data.assignmentStatus === 'Pending' ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                  color: data.assignmentStatus === 'Submitted' ? '#34d399' :
                    data.assignmentStatus === 'Pending' ? '#fbbf24' : '#94a3b8',
                  padding: '6px 12px',
                  borderRadius: '6px'
                }}>
                  {data.assignmentStatus}
                </div>
              </div>

              <div style={styles.metricContainer}>
                <label style={styles.metricLabel}>Quiz Average</label>
                <div style={{
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: data.avgMarks >= 80 ? '#4caf50' : data.avgMarks >= 70 ? '#ffc107' : data.avgMarks > 0 ? '#f44336' : '#999'
                }}>
                  {data.avgMarks > 0 ? `${data.avgMarks}%` : 'No quizzes'}
                </div>
                {data.quizzesTaken > 0 && (
                  <div style={styles.quizCount}>{data.quizzesTaken} quiz{data.quizzesTaken > 1 ? 'zes' : ''} taken</div>
                )}
              </div>

              {data.malpracticeCount > 0 && (
                <div style={styles.malpracticeContainer}>
                  <div style={styles.malpracticeWarning}>
                    ⚠️ {data.malpracticeCount} quiz{data.malpracticeCount > 1 ? 'zes' : ''} banned due to malpractice
                  </div>
                  {data.malpracticeReasons.length > 0 && (
                    <div style={styles.malpracticeReasons}>
                      {data.malpracticeReasons.map((reason, idx) => (
                        <div key={idx} style={styles.malpracticeReason}>• {reason}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p style={styles.noData}>No performance data available yet</p>
      )}
    </div>
  );
};

const styles = {
  container: {
    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 58, 95, 0.85))',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    padding: '20px',
    borderRadius: '12px',
    marginBottom: '20px',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px',
    flexWrap: 'wrap',
    gap: '10px'
  },
  title: {
    margin: 0,
    color: '#ffffff'
  },
  filterContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  filterLabel: {
    fontSize: '14px',
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)'
  },
  select: {
    padding: '8px 12px',
    fontSize: '14px',
    border: '1px solid rgba(59, 130, 246, 0.4)',
    borderRadius: '6px',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    color: '#ffffff',
    cursor: 'pointer',
    minWidth: '150px'
  },
  subjectsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '15px',
    marginTop: '15px'
  },
  subjectCard: {
    padding: '15px',
    background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.6), rgba(15, 23, 42, 0.8))',
    borderRadius: '10px',
    border: '1px solid rgba(59, 130, 246, 0.25)',
    backdropFilter: 'blur(5px)'
  },
  subjectName: {
    margin: '0 0 10px 0',
    fontSize: '15px',
    fontWeight: '600',
    color: '#ffffff'
  },
  subjectBadgeContainer: {
    marginBottom: '12px',
    paddingBottom: '12px',
    borderBottom: '1px solid rgba(59, 130, 246, 0.3)'
  },
  subjectBadge: {
    display: 'inline-block',
    padding: '4px 10px',
    fontSize: '11px',
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
    color: '#60a5fa',
    borderRadius: '12px',
    fontWeight: '500'
  },
  statusBadge: {
    display: 'inline-block',
    padding: '6px 12px',
    fontSize: '13px',
    borderRadius: '4px',
    fontWeight: '500'
  },
  quizCount: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: '4px'
  },
  malpracticeContainer: {
    marginTop: '12px',
    padding: '10px',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderLeft: '3px solid #ef4444',
    borderRadius: '4px'
  },
  malpracticeWarning: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#fca5a5',
    marginBottom: '6px'
  },
  malpracticeReasons: {
    marginTop: '6px'
  },
  malpracticeReason: {
    fontSize: '12px',
    color: '#f87171',
    marginBottom: '2px'
  },
  metricContainer: {
    marginBottom: '15px'
  },
  metricLabel: {
    display: 'block',
    marginBottom: '5px',
    fontSize: '12px',
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.7)'
  },
  progressBar: {
    width: '100%',
    height: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '5px'
  },
  progressFill: {
    height: '100%',
    transition: 'width 0.3s'
  },
  percentage: {
    fontSize: '13px',
    color: '#ffffff',
    fontWeight: '600'
  },
  noData: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontStyle: 'italic'
  }
};
