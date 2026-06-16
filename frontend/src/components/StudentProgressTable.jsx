import React, { useState, useEffect, useMemo } from 'react';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import StudentSubmissions from './StudentSubmissions';
import { useIsMobile } from '../hooks/useMediaQuery';
import { safeLocalStorage } from '../utils/storage';

export const StudentProgressTable = ({ students = [], classNumber, subject, schoolName }) => {
  const [studentData, setStudentData] = useState([]);
  const [activeTab, setActiveTab] = useState('progress'); // 'progress' or 'submissions'
  const [expandedStudent, setExpandedStudent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  // Phone-shaped viewports get a compact card list; the 4-column table
  // doesn't fit and was creating huge whitespace rows on mobile (each <td>
  // wrapping its content vertically to fit a 60-90 px column).
  const isMobile = useIsMobile();


  useEffect(() => {
    // Load all student data from Firestore
    const loadStudentData = async () => {
      try {
        // Get all students from the users collection
        // Query by role first, then filter by class locally to handle type mismatches
        const userData = safeLocalStorage.get('userData', {});
        const isDeveloper = userData?.role === 'developer';
        const schoolFilter = isDeveloper ? [] : [where('schoolName', '==', schoolName || '')];

        const usersQuery = query(
          collection(db, 'users'),
          where('role', '==', 'student'),
          ...schoolFilter
        );
        const usersSnapshot = await getDocs(usersQuery);

        // Filter by class locally to handle both string and integer types
        const classAsInt = parseInt(classNumber);
        const classAsString = String(classNumber);
        const filteredDocs = usersSnapshot.docs.filter(doc => {
          const data = doc.data();
          const studentClass = data.class || data.classNumber;
          return studentClass === classAsInt || studentClass === classAsString ||
            String(studentClass) === classAsString || parseInt(studentClass) === classAsInt;
        });

        console.log(`Found ${filteredDocs.length} students in class ${classNumber} (checked as int: ${classAsInt}, string: "${classAsString}")`);


        const allStudents = [];

        for (const userDoc of filteredDocs) {
          const userData = userDoc.data();
          const userId = userDoc.id;
          const userName = userData.username || userData.email?.split('@')[0] || 'Student';

          // Fetch quiz results for this student (quizResults has no schoolName field)
          const quizQuery = query(
            collection(db, 'quizResults'),
            where('studentId', '==', userId),
            where('subject', '==', subject)
          );
          const quizSnapshot = await getDocs(quizQuery);

          // Calculate average quiz score and collect quiz details
          let totalScore = 0;
          let quizCount = 0;
          const quizDetails = [];
          quizSnapshot.docs.forEach(doc => {
            const quizData = doc.data();

            // Validate subject match
            if (quizData.subject !== subject) {
              console.warn(`⚠️ DATA INTEGRITY ISSUE: Quiz "${quizData.chapterName}" has subject "${quizData.subject}" but was fetched under "${subject}". This indicates incorrect subject labeling in database. Student: ${userName}, Quiz ID: ${doc.id}`);
            }

            if (!quizData.malpractice) { // Only count non-malpractice quizzes
              totalScore += quizData.score || 0;
              quizCount++;
              quizDetails.push({
                chapterName: quizData.chapterName || 'Unknown',
                score: quizData.score || 0,
                date: quizData.submittedAt
              });
            }
          });
          const averageQuizScore = quizCount > 0 ? Math.round(totalScore / quizCount) : 0;

          // Fetch assignment submissions for this student (studentSubmissions has no schoolName field)
          const submissionsQuery = query(
            collection(db, 'studentSubmissions'),
            where('studentId', '==', userId),
            where('subject', '==', subject)
          );
          const submissionsSnapshot = await getDocs(submissionsQuery);

          // Collect assignment submission details
          const assignmentDetails = submissionsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              assignmentTitle: data.assignmentTitle || data.chapterName || 'Unknown',
              status: data.status || 'submitted',
              submittedAt: data.submittedAt
            };
          });

          const assignmentCount = submissionsSnapshot.docs.length;
          const completionPercent = Math.min(assignmentCount * 10, 100);

          allStudents.push({
            id: userId,
            name: userName,
            completionPercent: completionPercent,
            quizScore: averageQuizScore,
            quizCount: quizCount,
            assignmentCount: assignmentCount,
            quizDetails: quizDetails,
            assignmentDetails: assignmentDetails,
            overallPerformance: Math.round((averageQuizScore + completionPercent) / 2)
          });
        }

        setStudentData(allStudents);
      } catch (error) {
        console.error('Error loading student data:', error);
      }
    };

    if (classNumber && subject) {
      loadStudentData();

      // Refresh data every 10 seconds to catch updates
      const interval = setInterval(loadStudentData, 10000);
      return () => clearInterval(interval);
    }
  }, [classNumber, subject]);
  
  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return studentData;
    const lowerSearch = searchTerm.toLowerCase();
    return studentData.filter(student => 
      student.name?.toLowerCase().includes(lowerSearch) ||
      student.id?.toLowerCase().includes(lowerSearch)
    );
  }, [studentData, searchTerm]);

  const data = filteredData;

  const getPerformanceColor = (score) => {
    if (score >= 80) return { bg: 'linear-gradient(135deg, #10b981, #059669)', text: '#ffffff' };
    if (score >= 60) return { bg: 'linear-gradient(135deg, #f59e0b, #d97706)', text: '#ffffff' };
    return { bg: 'linear-gradient(135deg, #ef4444, #dc2626)', text: '#ffffff' };
  };

  const getScoreColor = (score) => {
    if (score >= 75) return { bg: '#dcfce7', text: '#166534', border: '#86efac' };
    if (score >= 50) return { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' };
    return { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' };
  };

  return (
    <div
      style={isMobile ? styles.containerMobile : styles.container}
      className="student-progress-container"
    >
      {/* Header Section */}
      <div style={isMobile ? styles.headerMobile : styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.iconWrapper}>
            <span style={styles.headerIcon}>👥</span>
          </div>
          <div>
            <h3
              style={isMobile ? styles.titleMobile : styles.title}
              className="student-overview-title"
            >
              Student Overview
            </h3>
            <p style={isMobile ? styles.subtitleMobile : styles.subtitle}>
              {data.length} students enrolled • {subject}
            </p>
          </div>
        </div>
        <div style={isMobile ? styles.tabButtonsMobile : styles.tabButtons}>
          <button
            onClick={() => setActiveTab('progress')}
            style={activeTab === 'progress'
              ? (isMobile ? styles.activeTabButtonMobile : styles.activeTabButton)
              : (isMobile ? styles.tabButtonMobile : styles.tabButton)}
          >
            <span style={styles.tabIcon}>📊</span> Progress
          </button>
          <button
            onClick={() => setActiveTab('submissions')}
            style={activeTab === 'submissions'
              ? (isMobile ? styles.activeTabButtonMobile : styles.activeTabButton)
              : (isMobile ? styles.tabButtonMobile : styles.tabButton)}
          >
            <span style={styles.tabIcon}>📝</span> Submissions
          </button>
        </div>
      </div>

      {/* Search Bar */}
      {activeTab === 'progress' && data.length > 0 && (
        <div style={styles.searchContainer}>
          <div
            style={isMobile ? styles.searchInputWrapperMobile : styles.searchInputWrapper}
          >
            <span style={styles.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder="Search students by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={isMobile ? styles.searchInputMobile : styles.searchInput}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={styles.clearSearch}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {activeTab === 'progress' ? (
        data.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📚</div>
            <h4 style={styles.emptyTitle} className="empty-state-title-red">No Student Data Yet</h4>
            <p style={styles.emptyText}>Students will appear here once they start using the platform.</p>
          </div>
        ) : isMobile ? (
          // ── MOBILE: compact card list ─────────────────────────────────
          // Each student is a single ~64 px row. Tap to expand the same
          // quiz / assignment detail panels the desktop table uses.
          <div style={styles.mobileList}>
            {data.map((student) => {
              const isOpen = expandedStudent === student.id;
              const scoreTone = getScoreColor(student.quizScore);
              const perf = student.overallPerformance;
              const perfLabel = perf >= 80 ? 'Excellent' : perf >= 60 ? 'Good' : 'Needs work';
              const perfTint =
                perf >= 80
                  ? 'rgba(16,185,129,0.18)'
                  : perf >= 60
                  ? 'rgba(245,158,11,0.18)'
                  : 'rgba(239,68,68,0.18)';
              const perfEdge =
                perf >= 80
                  ? 'rgba(16,185,129,0.45)'
                  : perf >= 60
                  ? 'rgba(245,158,11,0.45)'
                  : 'rgba(239,68,68,0.45)';
              return (
                <React.Fragment key={student.id}>
                  <button
                    onClick={() => setExpandedStudent(isOpen ? null : student.id)}
                    style={styles.mobileRow}
                  >
                    <div style={styles.mobileAvatar}>
                      {student.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={styles.mobileRowMain}>
                      <div style={styles.mobileName}>{student.name}</div>
                      <div style={styles.mobileMeta}>
                        {student.assignmentCount} submitted ·{' '}
                        {student.quizCount} quiz{student.quizCount === 1 ? '' : 'zes'}
                      </div>
                    </div>
                    <div style={styles.mobileChips}>
                      <span
                        style={{
                          ...styles.mobileChipScore,
                          background: scoreTone.bg,
                          color: scoreTone.text,
                          borderColor: scoreTone.border,
                        }}
                      >
                        {student.quizScore}%
                      </span>
                      <span
                        style={{
                          ...styles.mobileChipPerf,
                          background: perfTint,
                          borderColor: perfEdge,
                        }}
                      >
                        {perfLabel}
                      </span>
                    </div>
                    <span
                      style={{
                        ...styles.mobileChev,
                        transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                      }}
                    >
                      ›
                    </span>
                  </button>
                  {isOpen && (
                    <div style={styles.mobileExpand}>
                      <h4 style={styles.mobileExpandTitle}>📝 Quiz scores</h4>
                      {student.quizDetails.length > 0 ? (
                        student.quizDetails.map((q, i) => (
                          <div key={i} style={styles.mobileDetailRow}>
                            <span style={styles.mobileDetailLabel}>
                              {q.chapterName}
                            </span>
                            <span
                              style={{
                                ...styles.mobileDetailScore,
                                background:
                                  q.score >= 75
                                    ? 'rgba(16,185,129,0.18)'
                                    : 'rgba(239,68,68,0.18)',
                                color: q.score >= 75 ? '#86efac' : '#fca5a5',
                              }}
                            >
                              {q.score}%
                            </span>
                          </div>
                        ))
                      ) : (
                        <div style={styles.mobileEmpty}>No quizzes yet</div>
                      )}

                      <h4 style={{ ...styles.mobileExpandTitle, marginTop: 12 }}>
                        📋 Submissions
                      </h4>
                      {student.assignmentDetails.length > 0 ? (
                        student.assignmentDetails.map((a, i) => (
                          <div key={i} style={styles.mobileDetailRow}>
                            <span style={styles.mobileDetailLabel}>
                              {a.assignmentTitle}
                            </span>
                            <span
                              style={{
                                ...styles.mobileDetailScore,
                                background: 'rgba(59,130,246,0.18)',
                                color: '#93c5fd',
                              }}
                            >
                              ✓
                            </span>
                          </div>
                        ))
                      ) : (
                        <div style={styles.mobileEmpty}>No submissions yet</div>
                      )}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        ) : (
          <div style={{ ...styles.tableWrapper, width: '100%', minWidth: '100%' }}>
            <table style={{ ...styles.table, width: '100%', minWidth: '100%' }}>
              <thead>
                <tr style={styles.theadRow}>
                  <th style={{ ...styles.th, width: '25%' }}>
                    <span style={styles.thContent}>👤 Student Name</span>
                  </th>
                  <th style={{ ...styles.th, width: '25%' }}>
                    <span style={styles.thContent}>📋 Assignments</span>
                  </th>
                  <th style={{ ...styles.th, width: '25%' }}>
                    <span style={styles.thContent}>🎯 Quiz Score</span>
                  </th>
                  <th style={{ ...styles.th, width: '25%' }}>
                    <span style={styles.thContent}>⭐ Performance</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((student, index) => (
                  <React.Fragment key={student.id}>
                    <tr
                      style={{
                        ...styles.tr,
                        backgroundColor: expandedStudent === student.id ? '#f0f9ff' : index % 2 === 0 ? '#ffffff' : '#fafafa',
                        cursor: 'pointer'
                      }}
                      onClick={() => setExpandedStudent(expandedStudent === student.id ? null : student.id)}
                    >
                      <td style={styles.td}>
                        <div style={styles.studentCell}>
                          <div style={styles.avatarWrapper}>
                            <span style={styles.avatar}>{student.name.charAt(0).toUpperCase()}</span>
                          </div>
                          <span style={styles.studentName}>{student.name}</span>
                        </div>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.progressCell}>
                          <div style={styles.progressBar}>
                            <div
                              style={{
                                ...styles.progressFill,
                                width: `${student.completionPercent}%`,
                                background: student.completionPercent >= 80
                                  ? 'linear-gradient(90deg, #10b981, #34d399)'
                                  : student.completionPercent >= 50
                                    ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                                    : 'linear-gradient(90deg, #ef4444, #f87171)'
                              }}
                            />
                          </div>
                          <span style={styles.progressText}>
                            <strong>{student.assignmentCount}</strong> submitted
                          </span>
                        </div>
                      </td>
                      <td style={styles.td}>
                        <div style={{
                          ...styles.scoreBadge,
                          backgroundColor: getScoreColor(student.quizScore).bg,
                          color: getScoreColor(student.quizScore).text,
                          borderColor: getScoreColor(student.quizScore).border
                        }}>
                          <span style={styles.scoreValue}>{student.quizScore}%</span>
                          <span style={styles.scoreLabel}>({student.quizCount} quizzes)</span>
                        </div>
                      </td>
                      <td style={styles.td}>
                        <div style={{
                          ...styles.performanceBadge,
                          background: getPerformanceColor(student.overallPerformance).bg
                        }}>
                          <span style={styles.performanceValue}>{student.overallPerformance}%</span>
                          <span style={styles.performanceLabel}>
                            {student.overallPerformance >= 80 ? 'Excellent' : student.overallPerformance >= 60 ? 'Good' : 'Needs Work'}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {expandedStudent === student.id && (
                      <tr key={`${student.id}-details`}>
                        <td colSpan="4" style={styles.expandedCell}>
                          <div style={styles.expandedContent}>
                            {/* Quiz Details */}
                            <div style={styles.detailSection}>
                              <h4 style={styles.detailTitle}>
                                <span style={styles.detailIcon}>📝</span> Quiz Scores
                              </h4>
                              {student.quizDetails.length > 0 ? (
                                <div style={styles.detailGrid}>
                                  {student.quizDetails.map((quiz, idx) => (
                                    <div key={idx} style={styles.detailCard}>
                                      <div style={styles.detailCardHeader}>
                                        <span style={styles.detailCardTitle}>{quiz.chapterName}</span>
                                        <span style={{
                                          ...styles.detailCardScore,
                                          backgroundColor: quiz.score >= 75 ? '#dcfce7' : '#fee2e2',
                                          color: quiz.score >= 75 ? '#166534' : '#991b1b'
                                        }}>
                                          {quiz.score}%
                                        </span>
                                      </div>
                                      <span style={styles.detailCardDate}>
                                        {quiz.date ? new Date(quiz.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div style={styles.noDataMessage}>No quizzes completed yet</div>
                              )}
                            </div>

                            {/* Assignment Details */}
                            <div style={styles.detailSection}>
                              <h4 style={styles.detailTitle}>
                                <span style={styles.detailIcon}>📋</span> Assignment Submissions
                              </h4>
                              {student.assignmentDetails.length > 0 ? (
                                <div style={styles.detailGrid}>
                                  {student.assignmentDetails.map((assignment, idx) => (
                                    <div key={idx} style={styles.detailCard}>
                                      <div style={styles.detailCardHeader}>
                                        <span style={styles.detailCardTitle}>{assignment.assignmentTitle}</span>
                                        <span style={styles.submittedBadge}>
                                          ✓ Submitted
                                        </span>
                                      </div>
                                      <span style={styles.detailCardDate}>
                                        {assignment.submittedAt ? new Date(assignment.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div style={styles.noDataMessage}>No assignments submitted yet</div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <StudentSubmissions classNumber={classNumber} subject={subject} schoolName={schoolName} />
      )}
    </div>
  );
};

const styles = {
  container: {
    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(248, 250, 252, 0.98))',
    border: '1px solid rgba(59, 130, 246, 0.15)',
    padding: '24px',
    borderRadius: '16px',
    marginBottom: '20px',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(255, 255, 255, 0.5) inset',
    width: '100%',
    minWidth: '100%',
    maxWidth: '100%',
    minHeight: '400px',
    boxSizing: 'border-box',
    flex: 1,
    userSelect: 'none',
    WebkitUserSelect: 'none',
    MozUserSelect: 'none',
    msUserSelect: 'none'
  },
  // ── Mobile overrides ──────────────────────────────────────────────
  // Dark, low-padding container that fits the teacher-mobile theme;
  // and a compact card-list layout for the student data. Each row is
  // ~64px tall instead of the 200px+ rows the table was producing.
  containerMobile: {
    background: 'rgba(15, 23, 42, 0.55)',
    border: '1px solid rgba(255, 255, 255, 0.07)',
    padding: '12px',
    borderRadius: 16,
    marginBottom: 8,
    boxSizing: 'border-box',
    width: '100%',
    color: '#f1f5f9',
  },
  headerMobile: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  titleMobile: {
    margin: 0,
    fontSize: 15,
    fontWeight: 700,
    color: '#f1f5f9',
    letterSpacing: '-0.01em',
  },
  subtitleMobile: {
    margin: '2px 0 0',
    fontSize: 11,
    color: '#94a3b8',
  },
  tabButtonsMobile: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  },
  tabButtonMobile: {
    padding: '8px 10px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700,
    color: '#cbd5e1',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  activeTabButtonMobile: {
    padding: '8px 10px',
    background: 'linear-gradient(135deg, rgba(16,185,129,0.20), rgba(5,150,105,0.10))',
    border: '1px solid rgba(16,185,129,0.45)',
    borderRadius: 10,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 800,
    color: '#86efac',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  searchInputWrapperMobile: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 10px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    marginBottom: 8,
  },
  searchInputMobile: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#f1f5f9',
    fontSize: 13,
  },
  mobileList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  mobileRow: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14,
    color: '#f1f5f9',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  mobileAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#fff',
    fontWeight: 800,
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  mobileRowMain: { flex: 1, minWidth: 0, textAlign: 'left' },
  mobileName: {
    fontSize: 14,
    fontWeight: 700,
    color: '#f1f5f9',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  mobileMeta: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  mobileChips: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
    flexShrink: 0,
  },
  mobileChipScore: {
    fontSize: 11,
    fontWeight: 800,
    padding: '2px 8px',
    borderRadius: 999,
    border: '1px solid',
    letterSpacing: 0.2,
  },
  mobileChipPerf: {
    fontSize: 9,
    fontWeight: 800,
    padding: '2px 6px',
    borderRadius: 999,
    border: '1px solid',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: '#e2e8f0',
  },
  mobileChev: {
    color: '#64748b',
    fontSize: 22,
    lineHeight: 1,
    transition: 'transform 180ms ease',
    flexShrink: 0,
    marginLeft: 2,
  },
  mobileExpand: {
    margin: '0 4px 6px',
    padding: 12,
    background: 'rgba(255,255,255,0.025)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 12,
  },
  mobileExpandTitle: {
    margin: '0 0 8px',
    fontSize: 12,
    fontWeight: 800,
    color: '#cbd5e1',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  mobileDetailRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: '8px 10px',
    background: 'rgba(255,255,255,0.025)',
    border: '1px solid rgba(255,255,255,0.04)',
    borderRadius: 10,
    marginBottom: 6,
  },
  mobileDetailLabel: {
    flex: 1,
    fontSize: 12,
    color: '#e2e8f0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  mobileDetailScore: {
    fontSize: 11,
    fontWeight: 800,
    padding: '2px 8px',
    borderRadius: 999,
  },
  mobileEmpty: {
    padding: 10,
    textAlign: 'center',
    fontSize: 12,
    color: '#64748b',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    paddingBottom: '20px',
    borderBottom: '2px solid rgba(59, 130, 246, 0.1)',
    flexWrap: 'wrap',
    gap: '16px'
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  iconWrapper: {
    width: '48px',
    height: '48px',
    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
  },
  headerIcon: {
    fontSize: '24px'
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: '700',
    color: '#1e293b',
    letterSpacing: '-0.02em'
  },
  subtitle: {
    margin: '4px 0 0 0',
    fontSize: '14px',
    color: '#64748b'
  },
  tabButtons: {
    display: 'flex',
    gap: '12px'
  },
  tabButton: {
    padding: '10px 20px',
    backgroundColor: '#f1f5f9',
    border: '2px solid #e2e8f0',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    color: '#64748b',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  activeTabButton: {
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
    border: '2px solid transparent',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    color: 'white',
    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.35)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  tabIcon: {
    fontSize: '16px'
  },
  tableWrapper: {
    overflowX: 'auto',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
    width: '100%'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px',
    backgroundColor: 'white',
    tableLayout: 'fixed'
  },
  theadRow: {
    background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)'
  },
  th: {
    padding: '16px 20px',
    textAlign: 'left',
    fontWeight: '600',
    color: '#000000',
    borderBottom: '2px solid #e2e8f0',
    fontSize: '13px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    backgroundColor: '#f8fafc'
  },
  thContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  tr: {
    borderBottom: '1px solid #f1f5f9',
    transition: 'all 0.15s ease'
  },
  td: {
    padding: '16px 20px',
    verticalAlign: 'middle',
    color: '#000000'
  },
  studentCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  avatarWrapper: {
    width: '40px',
    height: '40px',
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
  },
  avatar: {
    color: 'white',
    fontWeight: '700',
    fontSize: '16px'
  },
  studentInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  studentName: {
    fontWeight: '600',
    color: '#000000',
    fontSize: '15px'
  },
  expandHint: {
    fontSize: '11px',
    color: '#374151'
  },
  progressCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  progressBar: {
    width: '120px',
    height: '8px',
    backgroundColor: '#e2e8f0',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    transition: 'width 0.5s ease',
    borderRadius: '4px'
  },
  progressText: {
    fontSize: '12px',
    color: '#000000'
  },
  scoreBadge: {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid',
    gap: '2px'
  },
  scoreValue: {
    fontWeight: '700',
    fontSize: '16px'
  },
  scoreLabel: {
    fontSize: '11px',
    opacity: 0.8
  },
  performanceBadge: {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '10px 20px',
    borderRadius: '10px',
    color: 'white',
    gap: '2px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
  },
  performanceValue: {
    fontWeight: '800',
    fontSize: '18px'
  },
  performanceLabel: {
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    opacity: 0.9
  },
  expandedCell: {
    padding: 0,
    backgroundColor: '#f8fafc'
  },
  expandedContent: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '24px',
    padding: '24px'
  },
  detailSection: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
  },
  detailTitle: {
    margin: '0 0 16px 0',
    fontSize: '16px',
    fontWeight: '600',
    color: '#334155',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  detailIcon: {
    fontSize: '18px'
  },
  detailGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  detailCard: {
    padding: '14px 16px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  detailCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  detailCardTitle: {
    fontWeight: '600',
    color: '#334155',
    fontSize: '14px'
  },
  detailCardScore: {
    padding: '4px 10px',
    borderRadius: '6px',
    fontWeight: '700',
    fontSize: '13px'
  },
  detailCardDate: {
    fontSize: '12px',
    color: '#94a3b8'
  },
  submittedBadge: {
    padding: '4px 10px',
    backgroundColor: '#dcfce7',
    color: '#166534',
    borderRadius: '6px',
    fontWeight: '600',
    fontSize: '12px'
  },
  noDataMessage: {
    color: '#94a3b8',
    fontSize: '14px',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: '20px'
  },
  searchContainer: {
    marginBottom: '20px',
    width: '100%'
  },
  searchInputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    maxWidth: '400px'
  },
  searchIcon: {
    position: 'absolute',
    left: '12px',
    fontSize: '14px',
    opacity: 0.6
  },
  searchInput: {
    width: '100%',
    padding: '10px 35px 10px 35px',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    background: '#ffffff',
    fontSize: '14px',
    outline: 'none',
    transition: 'all 0.2s ease',
    '&:focus': {
      borderColor: '#3b82f6',
      boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.1)'
    }
  },
  clearSearch: {
    position: 'absolute',
    right: '10px',
    background: 'none',
    border: 'none',
    fontSize: '14px',
    color: '#94a3b8',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    backgroundColor: '#f8fafc',
    borderRadius: '12px',
    border: '2px dashed #e2e8f0'
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px'
  },
  emptyTitle: {
    margin: '0 0 8px 0',
    fontSize: '18px',
    fontWeight: '600',
    color: '#ef4444'
  },
  emptyText: {
    margin: 0,
    fontSize: '14px',
    color: '#94a3b8'
  }
};
