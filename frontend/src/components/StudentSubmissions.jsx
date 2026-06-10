import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, doc, updateDoc, getDoc, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { autoGradeAssignment } from '../services/aiService';
const StudentSubmissions = ({ classNumber, subject, schoolName }) => {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'graded', 'pending'
  const [editingId, setEditingId] = useState(null);
  const [editMarks, setEditMarks] = useState('');
  const [editFeedback, setEditFeedback] = useState('');
  const [gradingId, setGradingId] = useState(null);
  const [questionGrades, setQuestionGrades] = useState([]);
  const [expandedSubmissions, setExpandedSubmissions] = useState({});

  const toggleExpand = (id) => {
    setExpandedSubmissions(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  useEffect(() => {
    fetchSubmissions();
  }, [classNumber, subject]);

  const initManualGrading = (submission) => {
    const numQuestions = submission.questions?.length || 0;
    const initialGrades = Array.from({ length: numQuestions }, (_, i) => {
      const existing = submission.grade?.detailedFeedback?.find(d => d.questionNumber === i + 1);
      return {
        questionNumber: i + 1,
        marks: existing ? Number(existing.marks) : 1, // default to 1
        maxMarks: existing ? Number(existing.maxMarks) : 1, // default to 1
        feedback: existing ? existing.feedback : ''
      };
    });
    setQuestionGrades(initialGrades);
    setEditMarks(submission.grade?.marks || '');
    setEditFeedback(submission.grade?.teacherFeedback || '');
    setEditingId(submission.id);
  };

  const handleQuestionMarkChange = (idx, value) => {
    const updated = [...questionGrades];
    const numValue = Number(value);
    updated[idx].marks = isNaN(numValue) ? 0 : numValue;
    if (numValue > updated[idx].maxMarks) {
      updated[idx].maxMarks = numValue; // dynamically expand max marks if custom is higher
    }
    setQuestionGrades(updated);
  };

  const handleQuestionFeedbackChange = (idx, value) => {
    const updated = [...questionGrades];
    updated[idx].feedback = value;
    setQuestionGrades(updated);
  };

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      console.log('Fetching submissions for:', { classNumber, subject });

      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      const isDeveloper = userData?.role === 'developer';

      // Fetch submissions matching subject, ordered by date and limited to 100
      const allQuery = query(
        collection(db, 'studentSubmissions'),
        where('subject', '==', subject),
        orderBy('submittedAt', 'desc'),
        limit(100)
      );
      const allSnapshot = await getDocs(allQuery);

      // Filter by class in memory
      const submissionsList = allSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(sub => {
          // Check both 'class' and 'classNumber' fields
          const subClass = sub.class || sub.classNumber;
          return (subClass === classNumber || subClass === String(classNumber));
        });


      // Sort by submission date (newest first)
      submissionsList.sort((a, b) => {
        const dateA = a.submittedAt?.toDate?.() || new Date(a.submittedAt || 0);
        const dateB = b.submittedAt?.toDate?.() || new Date(b.submittedAt || 0);
        return dateB - dateA;
      });

      // Fetch student names for each submission
      const enrichedSubmissions = await Promise.all(
        submissionsList.map(async (sub) => {
          let studentName = 'Unknown Student';
          if (sub.studentId) {
            try {
              const studentDocRef = doc(db, 'users', sub.studentId);
              const studentDoc = await getDoc(studentDocRef);
              if (studentDoc.exists()) {
                const studentData = studentDoc.data();
                studentName = studentData.username || studentData.email?.split('@')[0] || 'Student';
              }
            } catch (err) {
              console.error('Error fetching student name:', err);
            }
          }
          return { ...sub, studentName };
        })
      );

      console.log('Fetched submissions:', enrichedSubmissions.length);
      console.log('Sample submission:', enrichedSubmissions[0]);

      setSubmissions(enrichedSubmissions);
    } catch (err) {
      console.error('Error fetching submissions:', err);
      console.error('Error details:', err.message, err.code);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCorrections = async (submission) => {
    try {
      const ref = doc(db, 'studentSubmissions', submission.id);
      
      let newGrade;
      if (questionGrades.length > 0) {
        const totalMarks = questionGrades.reduce((sum, q) => sum + Number(q.marks || 0), 0);
        const totalMax = questionGrades.reduce((sum, q) => sum + Number(q.maxMarks || 1), 0);
        newGrade = {
          marks: totalMarks,
          feedback: `Overall score: ${totalMarks}/${totalMax}`,
          teacherFeedback: editFeedback,
          detailedFeedback: questionGrades
        };
      } else {
        newGrade = {
          marks: Number(editMarks),
          feedback: `Overall score: ${editMarks}/10`,
          teacherFeedback: editFeedback,
          detailedFeedback: []
        };
      }

      await updateDoc(ref, {
        grade: newGrade,
        status: 'graded'
      });
      setEditingId(null);
      fetchSubmissions();
    } catch (err) {
      console.error('Failed to save corrections:', err);
      alert('Failed to save corrections');
    }
  };

  const handleAutoGrade = async (submission) => {
    try {
      setGradingId(submission.id);
      
      const questionsWithAnswers = (submission.questions || []).map((q, idx) => ({
        question: q,
        answer: submission.answers?.[idx] || ''
      }));

      const referenceText = submission.chapterName || "Teacher's Assignment"; 
      const gradeResult = await autoGradeAssignment(questionsWithAnswers, referenceText);
      
      const ref = doc(db, 'studentSubmissions', submission.id);
      await updateDoc(ref, {
        grade: gradeResult,
        status: 'graded'
      });
      
      fetchSubmissions();
    } catch (err) {
      console.error('Failed to auto-grade:', err);
      alert('Failed to auto-grade: ' + err.message);
    } finally {
      setGradingId(null);
    }
  };

  const renderManualGradingForm = (submission) => {
    if (editingId !== submission.id) return null;

    const totalMarks = questionGrades.reduce((sum, q) => sum + Number(q.marks || 0), 0);
    const totalMax = questionGrades.reduce((sum, q) => sum + Number(q.maxMarks || 1), 0);

    return (
      <div style={{
        marginTop: '20px',
        backgroundColor: '#ffffff',
        padding: '24px',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
        transition: 'all 0.3s ease'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
          <h5 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>✏️</span> Manual Assignment Correction
          </h5>
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', backgroundColor: '#f1f5f9', padding: '4px 10px', borderRadius: '12px' }}>
            {submission.questions?.length || 0} Questions
          </span>
        </div>
        
        {submission.questions && submission.questions.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginBottom: '24px' }}>
            {submission.questions.map((question, idx) => {
              const qGrade = questionGrades[idx] || { marks: 1, maxMarks: 1, feedback: '' };
              const currentMarks = qGrade.marks;
              const currentFeedback = qGrade.feedback;
              
              // Handle studentAnswer safe reading
              let studentAnswer = 'No answer';
              if (submission.answers) {
                const ans = submission.answers[idx];
                studentAnswer = (ans && typeof ans === 'object') ? (ans.answer || JSON.stringify(ans)) : (ans || 'No answer');
              }

              return (
                <div key={idx} style={{
                  padding: '16px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  backgroundColor: '#f8fafc',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.02)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#334155', lineHeight: '1.5', flex: 1 }}>
                      Q{idx + 1}: {typeof question === 'object' ? (question.question || JSON.stringify(question)) : question}
                    </p>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: currentMarks === 1 ? '#0f766e' : currentMarks === 0.5 ? '#b45309' : '#b91c1c', backgroundColor: currentMarks === 1 ? '#ccfbf1' : currentMarks === 0.5 ? '#fef3c7' : '#fee2e2', padding: '2px 8px', borderRadius: '12px', whiteSpace: 'nowrap' }}>
                      {currentMarks} Mark{currentMarks !== 1 ? 's' : ''}
                    </span>
                  </div>
                  
                  <p style={{
                    margin: 0,
                    fontSize: '13px',
                    color: '#475569',
                    fontStyle: 'italic',
                    backgroundColor: '#ffffff',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    borderLeft: '4px solid #94a3b8',
                    lineHeight: '1.5'
                  }}>
                    <strong>Student\'s Answer:</strong> {studentAnswer}
                  </p>
                  
                  {/* Marks selector row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Evaluate:</span>
                    <div style={{ display: 'flex', gap: '6px', backgroundColor: '#e2e8f0', padding: '3px', borderRadius: '20px' }}>
                      <button
                        type="button"
                        onClick={() => handleQuestionMarkChange(idx, 1)}
                        style={{
                          padding: '5px 12px',
                          fontSize: '11px',
                          cursor: 'pointer',
                          borderRadius: '16px',
                          border: 'none',
                          backgroundColor: currentMarks === 1 ? '#10b981' : 'transparent',
                          color: currentMarks === 1 ? 'white' : '#475569',
                          fontWeight: '700',
                          transition: 'all 0.2s'
                        }}
                      >
                        Correct (1.0)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuestionMarkChange(idx, 0.5)}
                        style={{
                          padding: '5px 12px',
                          fontSize: '11px',
                          cursor: 'pointer',
                          borderRadius: '16px',
                          border: 'none',
                          backgroundColor: currentMarks === 0.5 ? '#f59e0b' : 'transparent',
                          color: currentMarks === 0.5 ? 'white' : '#475569',
                          fontWeight: '700',
                          transition: 'all 0.2s'
                        }}
                      >
                        Partial (0.5)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuestionMarkChange(idx, 0)}
                        style={{
                          padding: '5px 12px',
                          fontSize: '11px',
                          cursor: 'pointer',
                          borderRadius: '16px',
                          border: 'none',
                          backgroundColor: currentMarks === 0 ? '#ef4444' : 'transparent',
                          color: currentMarks === 0 ? 'white' : '#475569',
                          fontWeight: '700',
                          transition: 'all 0.2s'
                        }}
                      >
                        Incorrect (0)
                      </button>
                    </div>
                    
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>or</span>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={currentMarks}
                        onChange={(e) => handleQuestionMarkChange(idx, e.target.value)}
                        placeholder="Custom"
                        style={{
                          width: '65px',
                          padding: '5px 8px',
                          border: '1.5px solid #cbd5e1',
                          borderRadius: '6px',
                          fontSize: '12px',
                          textAlign: 'center',
                          fontWeight: '600',
                          color: '#334155',
                          outline: 'none'
                        }}
                      />
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>marks</span>
                    </div>
                  </div>

                  {/* Corrections for this answer */}
                  <div style={{ marginTop: '4px' }}>
                    <input
                      type="text"
                      value={currentFeedback}
                      onChange={(e) => handleQuestionFeedbackChange(idx, e.target.value)}
                      placeholder="Enter specific correction note or explanation here..."
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1.5px solid #cbd5e1',
                        borderRadius: '8px',
                        fontSize: '12px',
                        boxSizing: 'border-box',
                        color: '#334155',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '13px', color: '#475569', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Total Marks (0-10):</label>
            <input 
              type="number" 
              value={editMarks} 
              onChange={(e) => setEditMarks(e.target.value)}
              placeholder="Marks (0-10)"
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1.5px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
        )}

        {/* Overall Summary Feedback */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '13px', color: '#475569', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Overall Evaluation & Summary Notes:</label>
          <textarea
            value={editFeedback}
            onChange={(e) => setEditFeedback(e.target.value)}
            placeholder="Type general feedback, overall corrections, or notes of encouragement..."
            style={{
              width: '100%',
              padding: '12px 14px',
              minHeight: '100px',
              border: '1.5px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '13px',
              resize: 'vertical',
              fontFamily: 'inherit',
              outline: 'none',
              boxSizing: 'border-box',
              lineHeight: '1.5'
            }}
          />
        </div>

        {/* Calculated Total Score */}
        {submission.questions && submission.questions.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '24px' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#eef2ff',
              color: '#4f46e5',
              padding: '10px 18px',
              borderRadius: '30px',
              fontWeight: '700',
              fontSize: '15px',
              border: '1.5px solid #c7d2fe',
              boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.05)'
            }}>
              📊 Total Score: {totalMarks} / {totalMax} Marks
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '18px' }}>
          <button
            onClick={() => handleSaveCorrections(submission)}
            style={{
              padding: '10px 22px',
              background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '13px',
              boxShadow: '0 4px 12px 0 rgba(79, 70, 229, 0.25)',
              transition: 'opacity 0.2s'
            }}
          >
            Save Corrections
          </button>
          <button
            onClick={() => setEditingId(null)}
            style={{
              padding: '10px 22px',
              backgroundColor: '#f1f5f9',
              color: '#475569',
              border: '1.5px solid #cbd5e1',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '13px',
              transition: 'all 0.2s'
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  };

  const getScoreColor = (score) => {
    const percentage = score <= 10 ? score * 10 : score;
    if (percentage >= 90) return '#10b981';
    if (percentage >= 75) return '#3b82f6';
    if (percentage >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const getScoreEmoji = (score) => {
    const percentage = score <= 10 ? score * 10 : score;
    if (percentage >= 90) return '🌟';
    if (percentage >= 75) return '😊';
    if (percentage >= 60) return '👍';
    return '💪';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredSubmissions = submissions.filter(sub => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'graded') return sub.status === 'graded';
    if (filterStatus === 'pending') return sub.status === 'pending';
    return true;
  });

  const stats = {
    total: submissions.length,
    graded: submissions.filter(s => s.status === 'graded').length,
    pending: submissions.filter(s => s.status === 'pending').length,
    avgScore: submissions.filter(s => s.grade != null).length > 0
      ? Math.round(submissions.filter(s => s.grade != null).reduce((acc, s) => {
          let score = s.grade.marks || 0;
          return acc + (score <= 10 ? score * 10 : score);
        }, 0) / submissions.filter(s => s.grade != null).length)
      : 0
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <p style={styles.loading}>⏳ Loading submissions...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h3 style={{ margin: '0 0 5px 0' }}>📝 Student Submissions</h3>
          <p style={styles.subtitle}>Class {classNumber} - {subject}</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>{stats.total}</div>
          <div style={styles.statLabel}>Total Submissions</div>
        </div>
        <div style={{ ...styles.statCard, borderLeft: '4px solid #10b981' }}>
          <div style={{ ...styles.statNumber, color: '#10b981' }}>{stats.graded}</div>
          <div style={styles.statLabel}>Graded</div>
        </div>
        <div style={{ ...styles.statCard, borderLeft: '4px solid #f59e0b' }}>
          <div style={{ ...styles.statNumber, color: '#f59e0b' }}>{stats.pending}</div>
          <div style={styles.statLabel}>Pending</div>
        </div>
        <div style={{ ...styles.statCard, borderLeft: '4px solid #667eea' }}>
          <div style={{ ...styles.statNumber, color: '#667eea' }}>{stats.avgScore}%</div>
          <div style={styles.statLabel}>Average Score</div>
        </div>
      </div>

      {/* Filter Buttons */}
      <div style={styles.filterContainer}>
        <button
          onClick={() => setFilterStatus('all')}
          style={filterStatus === 'all' ? styles.filterButtonActive : styles.filterButton}
        >
          All ({stats.total})
        </button>
        <button
          onClick={() => setFilterStatus('graded')}
          style={filterStatus === 'graded' ? styles.filterButtonActive : styles.filterButton}
        >
          ✅ Graded ({stats.graded})
        </button>
        <button
          onClick={() => setFilterStatus('pending')}
          style={filterStatus === 'pending' ? styles.filterButtonActive : styles.filterButton}
        >
          ⏳ Pending ({stats.pending})
        </button>
      </div>

      {/* Submissions List */}
      {filteredSubmissions.length === 0 ? (
        <div style={styles.emptyState}>
          <p>📭 No submissions found for this filter.</p>
        </div>
      ) : (
        <div style={styles.submissionsList}>
          {filteredSubmissions.map((submission) => (
            <div key={submission.id} style={styles.submissionCard}>
              <div style={styles.submissionHeader}>
                <div style={styles.studentInfo}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                    <h4 style={{ ...styles.studentName, margin: 0 }}>
                      👤 {submission.studentName || submission.studentId?.substring(0, 8)}
                    </h4>
                    <button
                      onClick={() => toggleExpand(submission.id)}
                      style={{
                        padding: '4px 10px',
                        backgroundColor: expandedSubmissions[submission.id] ? '#f1f5f9' : '#e0e7ff',
                        color: expandedSubmissions[submission.id] ? '#475569' : '#4f46e5',
                        border: '1px solid ' + (expandedSubmissions[submission.id] ? '#cbd5e1' : '#c7d2fe'),
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        outline: 'none',
                        transition: 'all 0.2s'
                      }}
                    >
                      {expandedSubmissions[submission.id] ? '👁️ Hide Full' : '👁️ View Full'}
                    </button>
                  </div>
                  <p style={styles.assignmentTitle}>{submission.assignmentTitle || 'Assignment'}</p>
                  <p style={styles.chapterName}>{submission.chapterName}</p>
                </div>
                <div style={styles.scoreContainer}>
                  {submission.grade ? (
                    <>
                      <div style={{ ...styles.scoreCircle, borderColor: getScoreColor(submission.grade.marks) }}>
                        <span style={{ fontSize: '24px' }}>{getScoreEmoji(submission.grade.marks)}</span>
                        <div style={{ ...styles.score, color: getScoreColor(submission.grade.marks) }}>
                          {submission.grade.marks}{submission.grade.marks <= 10 ? '/10' : '%'}
                        </div>
                      </div>
                      <span style={{ ...styles.statusBadge, ...styles.statusGraded }}>
                        ✅ Graded
                      </span>
                    </>
                  ) : (
                    <span style={{ ...styles.statusBadge, ...styles.statusPending }}>
                      ⏳ Pending Grading
                    </span>
                  )}
                </div>
              </div>

              {expandedSubmissions[submission.id] && (
                <div style={{ marginTop: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                  <div style={styles.submissionMeta}>
                    <span style={styles.metaItem}>📅 {formatDate(submission.submittedAt)}</span>
                    {submission.pdfUrl && (
                      <a
                        href={submission.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={styles.viewButton}
                      >
                        📄 View PDF
                      </a>
                    )}
                  </div>

                  {(submission.content || submission.submittedText) && (
                    <div style={styles.contentSection}>
                      <h5 style={styles.sectionTitle}>Student's Answer:</h5>
                      <pre style={styles.answerText}>{submission.content || submission.submittedText}</pre>
                    </div>
                  )}

                  {!submission.grade && (
                    <div style={{ marginTop: '15px' }}>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          onClick={() => handleAutoGrade(submission)}
                          style={{ ...styles.filterButtonActive, background: 'linear-gradient(135deg, #10b981, #059669)' }}
                          disabled={gradingId === submission.id}
                        >
                          {gradingId === submission.id ? '⏳ Grading...' : '🤖 Auto-Grade with AI'}
                        </button>
                        <button
                          onClick={() => {
                            initManualGrading(submission);
                          }}
                          style={{ ...styles.filterButtonActive, background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}
                          disabled={gradingId === submission.id}
                        >
                          ✏️ Grade Manually
                        </button>
                      </div>
                      
                      {renderManualGradingForm(submission)}
                    </div>
                  )}

                  {submission.grade && (
                    <div style={styles.feedbackSection}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h5 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#333' }}>AI Feedback:</h5>
                        <button 
                          onClick={() => {
                            initManualGrading(submission);
                          }}
                          style={styles.editButton}
                        >
                          ✏️ Edit Grade & Add Corrections
                        </button>
                      </div>
                      <p style={styles.feedbackText}>{submission.grade.feedback || submission.grade}</p>
                      {submission.grade.teacherFeedback && (
                        <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#eef2ff', borderRadius: '6px', borderLeft: '3px solid #667eea' }}>
                          <h6 style={{ margin: '0 0 5px 0', fontSize: '13px', color: '#667eea' }}>Teacher Corrections:</h6>
                          <p style={{ margin: 0, fontSize: '14px', color: '#333', whiteSpace: 'pre-wrap' }}>{submission.grade.teacherFeedback}</p>
                        </div>
                      )}

                      {renderManualGradingForm(submission)}

                      {submission.grade.detailedFeedback && submission.grade.detailedFeedback.length > 0 && !editingId && (
                        <div style={styles.detailedFeedback}>
                          <h6 style={styles.detailedTitle}>Detailed Breakdown:</h6>
                          {submission.grade.detailedFeedback.map((item, idx) => (
                            <div key={idx} style={styles.feedbackItem}>
                              <span style={styles.questionNum}>Q{item.questionNumber}</span>
                              <span style={styles.questionScore}>
                                {item.marks}/{item.maxMarks} marks
                              </span>
                              <p style={styles.questionFeedback}>{item.feedback}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: 'white',
    border: '1px solid #ddd',
    padding: '20px',
    borderRadius: '12px',
    marginBottom: '20px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    paddingBottom: '15px',
    borderBottom: '2px solid #f0f0f0'
  },
  subtitle: {
    color: '#666',
    fontSize: '14px',
    margin: 0
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '15px',
    marginBottom: '25px'
  },
  statCard: {
    backgroundColor: '#f8f9fa',
    padding: '20px',
    borderRadius: '10px',
    borderLeft: '4px solid #667eea',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
  },
  statNumber: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#667eea',
    marginBottom: '5px'
  },
  statLabel: {
    fontSize: '13px',
    color: '#666',
    fontWeight: '500'
  },
  filterContainer: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
    flexWrap: 'wrap'
  },
  filterButton: {
    padding: '8px 16px',
    backgroundColor: '#f5f5f5',
    border: '1px solid #ddd',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    color: '#666',
    transition: 'all 0.2s'
  },
  filterButtonActive: {
    padding: '8px 16px',
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    color: 'white'
  },
  submissionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px'
  },
  submissionCard: {
    border: '1px solid #e0e0e0',
    borderRadius: '10px',
    padding: '20px',
    backgroundColor: '#fafafa',
    transition: 'box-shadow 0.2s',
    ':hover': {
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
    }
  },
  submissionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '15px'
  },
  studentInfo: {
    flex: 1
  },
  studentName: {
    margin: '0 0 8px 0',
    fontSize: '16px',
    fontWeight: '600',
    color: '#333'
  },
  assignmentTitle: {
    margin: '0 0 4px 0',
    fontSize: '14px',
    color: '#667eea',
    fontWeight: '500'
  },
  chapterName: {
    margin: 0,
    fontSize: '13px',
    color: '#999'
  },
  scoreContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px'
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
    backgroundColor: 'white'
  },
  score: {
    fontSize: '18px',
    fontWeight: '700'
  },
  statusBadge: {
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '600'
  },
  statusGraded: {
    backgroundColor: '#d1fae5',
    color: '#10b981'
  },
  statusPending: {
    backgroundColor: '#fef3c7',
    color: '#f59e0b'
  },
  submissionMeta: {
    display: 'flex',
    gap: '15px',
    alignItems: 'center',
    paddingTop: '12px',
    borderTop: '1px solid #e0e0e0',
    marginTop: '12px'
  },
  metaItem: {
    fontSize: '13px',
    color: '#666'
  },
  viewButton: {
    padding: '6px 12px',
    backgroundColor: '#667eea',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '500',
    transition: 'opacity 0.2s',
    ':hover': {
      opacity: 0.9
    }
  },
  feedbackSection: {
    marginTop: '15px',
    padding: '15px',
    backgroundColor: 'white',
    borderRadius: '8px',
    border: '1px solid #e0e0e0'
  },
  feedbackTitle: {
    margin: '0 0 10px 0',
    fontSize: '14px',
    fontWeight: '600',
    color: '#333'
  },
  feedbackText: {
    margin: 0,
    fontSize: '14px',
    color: '#555',
    lineHeight: '1.6'
  },
  detailedFeedback: {
    marginTop: '15px'
  },
  detailedTitle: {
    margin: '0 0 10px 0',
    fontSize: '13px',
    fontWeight: '600',
    color: '#667eea'
  },
  feedbackItem: {
    padding: '10px',
    backgroundColor: '#f8f9fa',
    borderRadius: '6px',
    marginBottom: '8px',
    borderLeft: '3px solid #667eea'
  },
  questionNum: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#667eea',
    marginRight: '10px'
  },
  questionScore: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#10b981'
  },
  questionFeedback: {
    margin: '5px 0 0 0',
    fontSize: '13px',
    color: '#666'
  },
  contentSection: {
    marginTop: '15px',
    padding: '15px',
    backgroundColor: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: '8px'
  },
  sectionTitle: {
    margin: '0 0 10px 0',
    fontSize: '14px',
    fontWeight: '600',
    color: '#333'
  },
  answerText: {
    margin: 0,
    fontSize: '14px',
    color: '#444',
    whiteSpace: 'pre-wrap',
    fontFamily: 'inherit',
    lineHeight: '1.5'
  },
  editButton: {
    background: 'none',
    border: '1px solid #667eea',
    color: '#667eea',
    padding: '4px 8px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500'
  },
  editForm: {
    marginTop: '15px',
    paddingTop: '15px',
    borderTop: '1px dashed #ccc'
  },
  editInput: {
    width: '100%',
    padding: '8px',
    marginBottom: '10px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '14px'
  },
  editTextarea: {
    width: '100%',
    padding: '8px',
    minHeight: '80px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '14px',
    resize: 'vertical',
    fontFamily: 'inherit'
  },
  saveButton: {
    padding: '6px 16px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '500'
  },
  cancelButton: {
    padding: '6px 16px',
    backgroundColor: '#f3f4f6',
    color: '#4b5563',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '500'
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    color: '#666',
    fontSize: '15px'
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px',
    color: '#999',
    fontSize: '15px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px'
  }
};

export default StudentSubmissions;
