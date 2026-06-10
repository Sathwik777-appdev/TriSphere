import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const GradedAssignments = ({ studentId, schoolName }) => {
  const [submissions, setSubmissions] = useState([]);
  const [quizResults, setQuizResults] = useState([]);
  const [simSubmissions, setSimSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [selectedSimSubmission, setSelectedSimSubmission] = useState(null);
  const [activeTab, setActiveTab] = useState('quizzes'); // 'quizzes', 'assignments', or 'simulations'
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    fetchSubmissions();
    fetchQuizResults();
    fetchSimSubmissions();
    return () => { isMountedRef.current = false; };
  }, [studentId]);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      const isDeveloper = userData?.role === 'developer';
      // studentSubmissions has no schoolName field — filter by studentId only
      const q = query(
        collection(db, 'studentSubmissions'),
        where('studentId', '==', studentId),
        limit(50)
      );

      const snapshot = await getDocs(q);
      const submissionsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => {
        // Sort in memory instead of using Firestore orderBy
        const dateA = a.submittedAt?.toDate?.() || new Date(a.submittedAt || 0);
        const dateB = b.submittedAt?.toDate?.() || new Date(b.submittedAt || 0);
        return dateB - dateA; // desc order
      });

      if (isMountedRef.current) {
        setSubmissions(submissionsList);
        setFetchError(null);
      }
    } catch (err) {
      console.error('Error fetching submissions:', err);
      if (isMountedRef.current) setFetchError('Could not load your submissions. Please check your connection and try again.');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  const fetchQuizResults = async () => {
    try {
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      const isDeveloper = userData?.role === 'developer';
      // quizResults has no schoolName field — filter by studentId only
      const q = query(
        collection(db, 'quizResults'),
        where('studentId', '==', studentId),
        limit(50)
      );

      const snapshot = await getDocs(q);
      const allResults = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Group by chapter to track attempts
      const groupedByChapter = {};
      allResults.forEach(result => {
        const key = `${result.chapterName}-${result.subject}`;
        if (!groupedByChapter[key]) {
          groupedByChapter[key] = [];
        }
        groupedByChapter[key].push(result);
      });

      // Determine final result for each chapter
      const finalResults = [];
      Object.values(groupedByChapter).forEach(attempts => {
        // Sort by date (oldest first)
        attempts.sort((a, b) => {
          const dateA = a.completedAt?.toDate?.() || new Date(a.completedAt || 0);
          const dateB = b.completedAt?.toDate?.() || new Date(b.completedAt || 0);
          return dateA - dateB;
        });

        // Determine which attempt is the final score
        let finalAttempt;
        const firstAttempt = attempts[0];

        // If first attempt is 100% (and not malpractice), that's the final score
        if (!firstAttempt.malpractice && firstAttempt.score === 100) {
          finalAttempt = { ...firstAttempt };
          finalAttempt.isFinalScore = true;
          finalAttempt.isPerfectFirstAttempt = true;
          finalAttempt.attemptNumber = 1;
          finalAttempt.totalAttempts = attempts.length;
        } else {
          // Otherwise, use the most recent attempt as final
          const lastAttempt = attempts[attempts.length - 1];
          finalAttempt = { ...lastAttempt };
          finalAttempt.isFinalScore = true;
          finalAttempt.attemptNumber = attempts.length;
          finalAttempt.totalAttempts = attempts.length;

          // Calculate improvement if there was a previous valid attempt
          if (attempts.length > 1 && !lastAttempt.malpractice) {
            const previousAttempt = attempts[attempts.length - 2];
            if (!previousAttempt.malpractice) {
              finalAttempt.improvement = lastAttempt.score - previousAttempt.score;
              finalAttempt.previousScore = previousAttempt.score;
            }
          }
        }

        finalResults.push(finalAttempt);
      });

      // Sort all results by date (most recent first) for display
      finalResults.sort((a, b) => {
        const dateA = a.completedAt?.toDate?.() || new Date(a.completedAt || 0);
        const dateB = b.completedAt?.toDate?.() || new Date(b.completedAt || 0);
        return dateB - dateA;
      });

      if (isMountedRef.current) setQuizResults(finalResults);
    } catch (err) {
      console.error('Error fetching quiz results:', err);
    }
  };

  const fetchSimSubmissions = async () => {
    try {
      const q = query(
        collection(db, 'simulationSubmissions'),
        where('studentId', '==', studentId),
        limit(50)
      );

      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => {
        const dateA = a.submittedAt?.toDate?.() || new Date(a.submittedAt || 0);
        const dateB = b.submittedAt?.toDate?.() || new Date(b.submittedAt || 0);
        return dateB - dateA;
      });

      if (isMountedRef.current) setSimSubmissions(list);
    } catch (err) {
      console.error('Error fetching simulation submissions:', err);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 90) return '#10b981';
    if (score >= 75) return '#3b82f6';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const getScoreEmoji = (score) => {
    if (score >= 90) return '🌟';
    if (score >= 75) return '😊';
    if (score >= 60) return '👍';
    return '💪';
  };

  const generateCorrectedPDF = (submission) => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;

      // Ensure submittedAt parses correctly whether it's a timestamp object or a primitive
      const submitDate = submission.submittedAt?.toDate?.() || new Date(submission.submittedAt || Date.now());

      // Header
      doc.setFontSize(20);
      doc.setTextColor(30, 58, 95);
      doc.text("Corrected Assignment", pageWidth / 2, 20, { align: "center" });

      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text(`Assignment: ${String(submission.assignmentTitle || 'N/A')}`, 14, 35);
      doc.text(`Chapter: ${String(submission.chapterName || 'N/A')}`, 14, 42);
      doc.text(`Date Submitted: ${submitDate.toLocaleDateString()}`, 14, 49);

      // Grade Summary
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      if (submission.grade) {
        doc.text(`Overall Score: ${String(submission.grade.marks)}/10`, 14, 60);
        if (submission.grade.feedback) {
          doc.setFontSize(11);
          doc.text(`Feedback: ${String(submission.grade.feedback)}`, 14, 67, { maxWidth: pageWidth - 28 });
        }
        if (submission.grade.teacherFeedback) {
          doc.setFontSize(11);
          doc.setTextColor(102, 126, 234);
          doc.text(`Teacher Notes: ${String(submission.grade.teacherFeedback)}`, 14, 75, { maxWidth: pageWidth - 28 });
        }
      }

      // Detailed Breakdown
      if (submission.grade?.detailedFeedback && submission.grade.detailedFeedback.length > 0 && submission.questions) {
        const tableData = submission.grade.detailedFeedback.map((item, index) => {
          // Access arrays safely. They might contain objects in some data structures, so we cast to string.
          let qText = submission.questions[index] || `Question ${item.questionNumber}`;
          let aText = submission.answers ? (submission.answers[index] || 'No answer') : 'No answer';
          
          if (typeof qText === 'object') qText = qText.question || JSON.stringify(qText);
          if (typeof aText === 'object') aText = aText.answer || JSON.stringify(aText);

          return [
            `Q${item.questionNumber}: ${String(qText)}\n\nYour Answer: ${String(aText)}`,
            `${item.marks}/${item.maxMarks}`,
            String(item.feedback || '-')
          ];
        });

        autoTable(doc, {
          startY: 85,
          head: [['Question & Answer', 'Marks', 'Feedback']],
          body: tableData,
          theme: 'grid',
          headStyles: { fillColor: [30, 58, 95] },
          styles: { fontSize: 10, cellPadding: 4 },
          columnStyles: {
            0: { cellWidth: 90 },
            1: { cellWidth: 20 },
            2: { cellWidth: 70 }
          }
        });
      } else if (submission.content || submission.submittedText) {
         // Fallback if not detailed feedback is present
         doc.setFontSize(12);
         doc.setTextColor(0, 0, 0);
         doc.text("Your Submission:", 14, 90);
         doc.setFontSize(10);
         // Safely extract string content
         let contentStr = submission.content || submission.submittedText || '';
         if (typeof contentStr === 'object') {
           contentStr = JSON.stringify(contentStr);
         }
         doc.text(String(contentStr), 14, 100, { maxWidth: pageWidth - 28 });
      }

      doc.save(`${String(submission.assignmentTitle || 'assignment').replace(/[^a-z0-9]/gi, '_').toLowerCase()}_corrections.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert(`Could not generate PDF. Reason: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <h3>📊 My Grades</h3>
        <p style={styles.loading}>Loading your grades...</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div style={styles.container}>
        <h3>📊 My Grades</h3>
        <p style={{ color: '#ef4444', textAlign: 'center', padding: '20px' }}>{fetchError}</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h3>📊 My Grades</h3>

      {/* Tab Selector */}
      <div style={styles.tabContainer}>
        <button
          onClick={() => setActiveTab('quizzes')}
          style={{ ...styles.tab, ...(activeTab === 'quizzes' ? styles.activeTab : {}) }}
        >
          📝 Quiz Scores ({quizResults.length})
        </button>
        <button
          onClick={() => setActiveTab('assignments')}
          style={{ ...styles.tab, ...(activeTab === 'assignments' ? styles.activeTab : {}) }}
        >
          📄 Assignments ({submissions.length})
        </button>
        <button
          onClick={() => setActiveTab('simulations')}
          style={{ ...styles.tab, ...(activeTab === 'simulations' ? styles.activeTab : {}) }}
        >
          🧪 Simulation Labs ({simSubmissions.length})
        </button>
      </div>

      {/* Quiz Results */}
      {activeTab === 'quizzes' && (
        <div style={styles.resultsContainer}>
          {quizResults.length === 0 ? (
            <p style={styles.empty}>No quiz attempts yet. Take a quiz to see your scores!</p>
          ) : (
            <div style={styles.quizList}>
              {quizResults.map((result, index) => (
                <div key={result.id} style={styles.quizCard}>
                  <div style={styles.quizHeader}>
                    <h4 style={styles.chapterTitle}>
                      {result.chapterName}
                      {result.isFinalScore && (
                        <span style={{
                          marginLeft: '8px',
                          fontSize: '14px',
                          fontWeight: 'normal',
                          color: result.isPerfectFirstAttempt ? '#f59e0b' : '#10b981',
                          backgroundColor: result.isPerfectFirstAttempt ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                          padding: '2px 8px',
                          borderRadius: '4px'
                        }}>
                          {result.isPerfectFirstAttempt
                            ? '⭐ Perfect Score!'
                            : `✓ Final Score${result.totalAttempts > 1 ? ` (Attempt ${result.attemptNumber})` : ''}`}
                        </span>
                      )}
                    </h4>
                    <span style={styles.subject}>{result.subject}</span>
                  </div>

                  {result.malpractice ? (
                    <div style={styles.malpracticeCard}>
                      <div style={styles.malpracticeIcon}>⚠️</div>
                      <div style={styles.malpracticeContent}>
                        <h4 style={styles.malpracticeTitle}>MALPRACTICE DETECTED</h4>
                        <p style={styles.malpracticeReason}>
                          <strong>Reason:</strong> {result.malpracticeReason}
                        </p>
                        <p style={styles.malpracticeNote}>
                          This quiz attempt has been marked as invalid. You have been permanently banned from retaking this quiz.
                        </p>
                        <p style={styles.timestamp}>
                          Date: {result.completedAt?.toDate?.().toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={styles.scoreDisplay}>
                        <div style={{ ...styles.scoreCircle, borderColor: getScoreColor(result.score) }}>
                          <span style={{ ...styles.scoreValue, color: getScoreColor(result.score) }}>
                            {result.score}%
                          </span>
                        </div>
                        <div style={styles.scoreDetails}>
                          <p style={styles.scoreText}>
                            {getScoreEmoji(result.score)} {result.correctAnswers} / {result.totalQuestions} correct
                          </p>
                          {result.improvement !== undefined && (
                            <p style={{
                              fontSize: '14px',
                              fontWeight: '600',
                              color: result.improvement > 0 ? '#10b981' : result.improvement < 0 ? '#ef4444' : '#6b7280',
                              margin: '4px 0'
                            }}>
                              {result.improvement > 0 && '↑ '}
                              {result.improvement < 0 && '↓ '}
                              {result.improvement === 0 && '= '}
                              {result.improvement > 0 ? `Improved +${result.improvement}%` : result.improvement < 0 ? `Decreased ${result.improvement}%` : 'No change'}
                              {result.previousScore !== undefined && ` (was ${result.previousScore}%)`}
                            </p>
                          )}
                          {result.isPerfectFirstAttempt && (
                            <p style={{
                              fontSize: '13px',
                              fontWeight: '500',
                              color: '#f59e0b',
                              margin: '4px 0',
                              fontStyle: 'italic'
                            }}>
                              🎉 Perfect on first try!
                            </p>
                          )}
                          <p style={styles.timestamp}>
                            Completed: {result.completedAt?.toDate?.().toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Assignment Submissions */}
      {activeTab === 'assignments' && (
        submissions.length === 0 ? (
          <p style={styles.empty}>No submissions yet. Submit an assignment to see your grades!</p>
        ) : (
          <div style={styles.submissionsList}>
            {submissions.map(submission => (
              <div
                key={submission.id}
                style={styles.submissionCard}
                onClick={() => setSelectedSubmission(
                  selectedSubmission?.id === submission.id ? null : submission
                )}
              >
                <div style={styles.submissionHeader}>
                  <div style={styles.assignmentInfo}>
                    <h4 style={styles.assignmentTitle}>{submission.assignmentTitle}</h4>
                    <p style={styles.chapterName}>{submission.chapterName}</p>
                    <p style={styles.submittedDate}>
                      Submitted: {new Date(submission.submittedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>

                  <div style={styles.rightHeaderSection}>
                    {submission.grade ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ ...styles.miniScoreCircle, borderColor: getScoreColor(submission.grade.marks * 10) }}>
                          <span style={{ fontSize: '14px' }}>{getScoreEmoji(submission.grade.marks * 10)}</span>
                          <span style={{ ...styles.miniScoreValue, color: getScoreColor(submission.grade.marks * 10) }}>
                            {submission.grade.marks}/10
                          </span>
                        </div>
                        <div style={{ ...styles.statusBadge, backgroundColor: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.4)' }}>
                          <span style={styles.statusIcon}>🎓</span>
                          <span style={{ ...styles.statusText, color: '#60a5fa' }}>Graded</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ ...styles.statusBadge, backgroundColor: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.4)' }}>
                        <span style={styles.statusIcon}>✅</span>
                        <span style={{ ...styles.statusText, color: '#34d399' }}>Submitted</span>
                      </div>
                    )}
                  </div>
                </div>

                {selectedSubmission?.id === submission.id && (
                  <div style={styles.feedbackSection}>
                    {submission.grade && (
                      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', borderLeft: '4px solid #10b981' }}>
                        <h4 style={{ margin: '0 0 10px 0', color: '#10b981' }}>Grade: {submission.grade.marks}/10</h4>
                        {submission.grade.feedback && <p style={{ margin: '0 0 10px 0', fontSize: '14px' }}>{submission.grade.feedback}</p>}
                        {submission.grade.teacherFeedback && (
                          <div style={{ marginTop: '10px', padding: '10px', backgroundColor: 'rgba(102, 126, 234, 0.1)', borderRadius: '6px', borderLeft: '3px solid #667eea' }}>
                            <h6 style={{ margin: '0 0 5px 0', fontSize: '13px', color: '#a5b4fc' }}>Teacher Notes:</h6>
                            <p style={{ margin: 0, fontSize: '14px', whiteSpace: 'pre-wrap' }}>{submission.grade.teacherFeedback}</p>
                          </div>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            generateCorrectedPDF(submission);
                          }}
                          style={{
                            marginTop: '15px',
                            padding: '8px 16px',
                            backgroundColor: '#3b82f6',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '600'
                          }}
                        >
                          📥 Download Corrected Answers (PDF)
                        </button>
                      </div>
                    )}

                    <div style={styles.submissionContent}>
                      <h5 style={styles.contentTitle}>📝 Your Submission</h5>
                      {submission.questions && submission.answers ? (
                        <div style={styles.answersContainer}>
                          {submission.questions.map((question, index) => {
                             const detailedFeedback = submission.grade?.detailedFeedback?.find(d => d.questionNumber === index + 1);
                             return (
                               <div key={index} style={styles.questionAnswerPair}>
                                 <p style={styles.questionDisplay}>
                                   <strong>Question {index + 1}:</strong> {question}
                                 </p>
                                 <p style={styles.answerDisplay}>
                                   <strong>Your Answer:</strong> {submission.answers[index]}
                                 </p>
                                 {detailedFeedback && (
                                   <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                      <p style={{ margin: '0 0 5px 0', fontSize: '13px', color: '#34d399', fontWeight: 'bold' }}>Marks: {detailedFeedback.marks}/{detailedFeedback.maxMarks}</p>
                                      {detailedFeedback.feedback && <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>Feedback: {detailedFeedback.feedback}</p>}
                                   </div>
                                 )}
                               </div>
                             );
                          })}
                        </div>
                      ) : (
                        <p style={styles.submittedText}>{submission.submittedText}</p>
                      )}
                    </div>

                    {submission.pdfUrl && (
                      <div style={styles.pdfLink}>
                        <a href={submission.pdfUrl} target="_blank" rel="noopener noreferrer" style={styles.link}>
                          📄 View Your Submission PDF
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* Simulation Lab Submissions */}
      {activeTab === 'simulations' && (
        simSubmissions.length === 0 ? (
          <p style={styles.empty}>No simulation lab submissions yet. Run a simulation to submit a report!</p>
        ) : (
          <div style={styles.submissionsList}>
            {simSubmissions.map(submission => (
              <div
                key={submission.id}
                style={styles.submissionCard}
                onClick={() => setSelectedSimSubmission(
                  selectedSimSubmission?.id === submission.id ? null : submission
                )}
              >
                <div style={styles.submissionHeader}>
                  <div style={styles.assignmentInfo}>
                    <span style={{
                      backgroundColor: 'rgba(59, 130, 246, 0.2)',
                      color: '#60a5fa',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      display: 'inline-block',
                      marginBottom: '6px'
                    }}>
                      🧪 Simulation ({submission.subject || 'Science'})
                    </span>
                    <h4 style={styles.assignmentTitle}>{submission.assignmentTitle || 'Simulation Experiment'}</h4>
                    <p style={styles.submittedDate}>
                      Submitted: {submission.submittedAt ? new Date(submission.submittedAt.seconds ? submission.submittedAt.seconds * 1000 : submission.submittedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : 'N/A'}
                    </p>
                  </div>

                  <div style={styles.rightHeaderSection}>
                    {submission.status === 'graded' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ ...styles.miniScoreCircle, borderColor: getScoreColor(submission.grade * 10) }}>
                          <span style={{ fontSize: '14px' }}>{getScoreEmoji(submission.grade * 10)}</span>
                          <span style={{ ...styles.miniScoreValue, color: getScoreColor(submission.grade * 10) }}>
                            {submission.grade}/10
                          </span>
                        </div>
                        <div style={{ ...styles.statusBadge, backgroundColor: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.4)' }}>
                          <span style={styles.statusIcon}>🎓</span>
                          <span style={{ ...styles.statusText, color: '#60a5fa' }}>Graded</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ ...styles.statusBadge, backgroundColor: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.4)' }}>
                        <span style={styles.statusIcon}>✅</span>
                        <span style={{ ...styles.statusText, color: '#34d399' }}>Submitted</span>
                      </div>
                    )}
                  </div>
                </div>

                {selectedSimSubmission?.id === submission.id && (
                  <div style={styles.feedbackSection}>
                    {submission.status === 'graded' && (
                      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', borderLeft: '4px solid #10b981' }}>
                        <h4 style={{ margin: '0 0 10px 0', color: '#10b981' }}>Grade: {submission.grade}/10</h4>
                        {submission.feedback && <p style={{ margin: 0, fontSize: '14px', whiteSpace: 'pre-wrap' }}>{submission.feedback}</p>}
                      </div>
                    )}

                    <div style={styles.submissionContent}>
                      <h5 style={styles.contentTitle}>🔬 Recorded Lab Notebook</h5>
                      <div style={styles.answersContainer}>
                        {Object.entries(submission.recordedValues || {}).map(([key, val]) => (
                          <div key={key} style={styles.questionAnswerPair}>
                            <p style={{ margin: 0, fontSize: '14px', color: '#cbd5e1' }}>
                              <strong>{key}:</strong> {val || '—'}
                            </p>
                          </div>
                        ))}
                      </div>
                      
                      {submission.screenshotUrl && (
                        <div style={{ marginTop: '16px' }}>
                          <h6 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#cbd5e1' }}>📸 Screenshot Evidence:</h6>
                          <a href={submission.screenshotUrl} target="_blank" rel="noreferrer">
                            <img
                              src={submission.screenshotUrl}
                              alt="Verification Evidence"
                              style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}
                            />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
};

const styles = {
  container: {
    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 58, 95, 0.85))',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    padding: '24px',
    borderRadius: '12px',
    marginBottom: '20px',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    color: '#ffffff'
  },
  loading: {
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.6)',
    padding: '20px'
  },
  empty: {
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.6)',
    padding: '40px 20px',
    fontStyle: 'italic'
  },
  submissionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginTop: '16px'
  },
  submissionCard: {
    border: '1px solid rgba(59, 130, 246, 0.25)',
    borderRadius: '12px',
    padding: '20px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.6), rgba(15, 23, 42, 0.8))'
  },
  submissionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '20px'
  },
  assignmentInfo: {
    flex: 1
  },
  assignmentTitle: {
    margin: '0 0 8px 0',
    fontSize: '18px',
    fontWeight: '600',
    color: '#ffffff'
  },
  chapterName: {
    margin: '0 0 4px 0',
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.7)'
  },
  submittedDate: {
    margin: 0,
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.5)'
  },
  scoreCircle: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    border: '4px solid',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.6)'
  },
  scoreValue: {
    fontSize: '24px',
    fontWeight: '700',
    lineHeight: 1
  },
  scoreLabel: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: '2px'
  },
  feedbackSection: {
    marginTop: '24px',
    paddingTop: '24px',
    borderTop: '2px solid rgba(59, 130, 246, 0.2)'
  },
  motivationBanner: {
    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(30, 58, 95, 0.4))',
    padding: '16px 20px',
    borderRadius: '12px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  motivationEmoji: {
    fontSize: '32px'
  },
  motivationText: {
    margin: 0,
    fontSize: '15px',
    color: '#60a5fa',
    fontWeight: '500',
    lineHeight: '1.5'
  },
  feedbackGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '16px',
    marginBottom: '20px'
  },
  feedbackCard: {
    background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.5), rgba(15, 23, 42, 0.6))',
    padding: '16px',
    borderRadius: '10px',
    border: '1px solid rgba(59, 130, 246, 0.2)'
  },
  feedbackHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px'
  },
  feedbackIcon: {
    fontSize: '20px'
  },
  feedbackTitle: {
    margin: 0,
    fontSize: '14px',
    fontWeight: '600',
    color: '#ffffff'
  },
  feedbackText: {
    margin: 0,
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: '1.6'
  },
  pdfLink: {
    marginTop: '16px',
    textAlign: 'center'
  },
  link: {
    color: '#60a5fa',
    textDecoration: 'none',
    fontWeight: '500',
    fontSize: '14px'
  },
  rightHeaderSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  miniScoreCircle: {
    width: '55px',
    height: '55px',
    borderRadius: '50%',
    border: '3px solid',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.6)'
  },
  miniScoreValue: {
    fontSize: '11px',
    fontWeight: '700',
    lineHeight: 1,
    marginTop: '2px'
  },
  tabContainer: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
    borderBottom: '2px solid rgba(59, 130, 246, 0.3)',
    paddingBottom: '8px',
    flexWrap: 'wrap'
  },
  tab: {
    padding: '10px 16px',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '3px solid transparent',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
    transition: 'all 0.3s',
    flex: '1 1 auto',
    minWidth: '120px',
    textAlign: 'center',
    borderRadius: '8px 8px 0 0'
  },
  activeTab: {
    color: '#f472b6',
    borderBottomColor: '#f472b6'
  },
  resultsContainer: {
    marginTop: '16px'
  },
  quizList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  quizCard: {
    background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.6), rgba(15, 23, 42, 0.8))',
    border: '1px solid rgba(59, 130, 246, 0.25)',
    borderRadius: '12px',
    padding: '20px',
    transition: 'all 0.3s'
  },
  quizHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  chapterTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '700',
    color: '#ffffff'
  },
  subject: {
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
    color: '#a5b4fc',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: '600'
  },
  scoreDisplay: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px'
  },
  scoreDetails: {
    flex: 1
  },
  scoreText: {
    margin: '0 0 8px 0',
    fontSize: '16px',
    fontWeight: '600',
    color: '#ffffff'
  },
  timestamp: {
    margin: 0,
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.5)'
  },
  malpracticeCard: {
    display: 'flex',
    gap: '16px',
    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(220, 38, 38, 0.1))',
    border: '1px solid rgba(239, 68, 68, 0.4)',
    borderRadius: '8px',
    padding: '16px'
  },
  malpracticeIcon: {
    fontSize: '40px'
  },
  malpracticeContent: {
    flex: 1
  },
  malpracticeTitle: {
    margin: '0 0 8px 0',
    fontSize: '16px',
    fontWeight: '700',
    color: '#fca5a5'
  },
  malpracticeReason: {
    margin: '0 0 8px 0',
    fontSize: '14px',
    color: '#f87171',
    fontWeight: '500'
  },
  malpracticeNote: {
    margin: '0 0 12px 0',
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: '1.6'
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 20px',
    borderRadius: '8px',
    fontWeight: '600'
  },
  statusIcon: {
    fontSize: '20px'
  },
  statusText: {
    color: 'white',
    fontSize: '15px'
  },
  submissionContent: {
    marginBottom: '20px'
  },
  contentTitle: {
    margin: '0 0 16px 0',
    fontSize: '16px',
    fontWeight: '700',
    color: '#ffffff'
  },
  answersContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  questionAnswerPair: {
    background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.5), rgba(15, 23, 42, 0.6))',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    borderRadius: '8px',
    padding: '16px'
  },
  questionDisplay: {
    margin: '0 0 12px 0',
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: '1.6'
  },
  answerDisplay: {
    margin: 0,
    fontSize: '14px',
    color: '#ffffff',
    lineHeight: '1.6',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    padding: '12px',
    borderRadius: '6px',
    border: '1px solid rgba(59, 130, 246, 0.2)'
  },
  submittedText: {
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid rgba(59, 130, 246, 0.2)'
  }
};

export default GradedAssignments;
