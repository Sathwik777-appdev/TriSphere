import React, { useState, useEffect } from 'react';
import { collection, addDoc, doc, getDoc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../services/firebase';
import { extractTextFromPDF, extractTextFromURL } from '../services/pdfHelper';
import { autoGradeAssignment, extractAssignmentQuestions } from '../services/aiService';
import { useAuth } from '../hooks/useAuth';

const parseFirebaseDate = (val) => {
  if (!val) return null;
  if (typeof val.toDate === 'function') {
    const d = val.toDate();
    if (d instanceof Date && !isNaN(d.getTime())) return d;
  }
  if (val && typeof val === 'object' && typeof val.seconds === 'number') {
    const d = new Date(val.seconds * 1000);
    if (d instanceof Date && !isNaN(d.getTime())) return d;
  }
  const d = new Date(val);
  if (d instanceof Date && !isNaN(d.getTime())) return d;
  return null;
};

const StudentAssignmentSubmit = ({ studentId, classNumber, subject, schoolName }) => {
  const { userData } = useAuth();
  const isDeveloper = userData?.role === 'developer';
  const [assignments, setAssignments] = useState([]);
  const [overdueAssignments, setOverdueAssignments] = useState([]);
  const [submittedAssignments, setSubmittedAssignments] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState('');
  const [submissionText, setSubmissionText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [processingStage, setProcessingStage] = useState('');
  const [showQuestions, setShowQuestions] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Log activity when working on assignment
  useEffect(() => {
    if (showQuestions && questions.length > 0 && studentId) {
      // Log immediately when starting assignment
      logActivity(studentId, subject, 'assignment_start').catch(console.error);

      // Log every 5 minutes while working on assignment
      const activityInterval = setInterval(() => {
        logActivity(studentId, subject, 'assignment_ongoing').catch(console.error);
      }, 5 * 60 * 1000);

      return () => clearInterval(activityInterval);
    }
  }, [showQuestions, questions, studentId]);

  const loadQuestions = async () => {
    if (!selectedAssignment) return;

    setLoadingQuestions(true);
    setError('');
    try {
      const assignment = assignments.find(a => a.id === selectedAssignment);

      // Check if assignment has pre-generated questions (AI-generated)
      if (assignment?.questions && Array.isArray(assignment.questions)) {
        setQuestions(assignment.questions);
        // Initialize answers
        const initialAnswers = {};
        assignment.questions.forEach((_, index) => {
          initialAnswers[index] = '';
        });
        setAnswers(initialAnswers);
        setLoadingQuestions(false);
        return;
      }

      // Fallback: Try to extract from PDF if it exists
      if (assignment?.assignmentPdfURL) {
        const extractedText = await extractTextFromURL(assignment.assignmentPdfURL);

        if (!extractedText) {
          setError('Could not extract text from the assignment PDF');
          return;
        }

        // Extract questions using AI
        const extractedQuestions = await extractAssignmentQuestions(extractedText);

        setQuestions(extractedQuestions);
        // Initialize answers
        const initialAnswers = {};
        extractedQuestions.forEach((_, index) => {
          initialAnswers[index] = '';
        });
        setAnswers(initialAnswers);
      } else {
        setError('No questions available for this assignment');
      }
    } catch (error) {
      console.error('Error loading questions:', error);
      setError('Failed to load assignment questions: ' + error.message);
    } finally {
      setLoadingQuestions(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, [classNumber, subject]);

  const fetchAssignments = async () => {
    try {
      setLoadingAssignments(true);
      const classInt = parseInt(classNumber);
      console.log('Fetching assignments for class:', classInt, 'subject:', subject);

      const schoolFilter = isDeveloper ? [] : [where('schoolName', '==', schoolName || '')];

      // Try with integer class
      let q = query(
        collection(db, 'assignments'),
        where('class', '==', classInt),
        where('subject', '==', subject),
        ...schoolFilter
      );
      let snapshot = await getDocs(q);
      console.log('Found', snapshot.docs.length, 'assignments with class (int) filter');

      // If no results, try with string class
      if (snapshot.docs.length === 0) {
        console.log('Trying with string class...');
        q = query(
          collection(db, 'assignments'),
          where('class', '==', String(classNumber)),
          where('subject', '==', subject),
          ...schoolFilter
        );
        snapshot = await getDocs(q);
        console.log('Found', snapshot.docs.length, 'assignments with class (string) filter');
      }

      // If still no results, fetch all and filter manually
      if (snapshot.docs.length === 0) {
        console.log('No filtered results. Fetching ALL assignments and filtering...');
        const allQ = collection(db, 'assignments');
        const allSnapshot = await getDocs(allQ);
        console.log('Total assignments in DB:', allSnapshot.docs.length);

        // Log first few for debugging
        allSnapshot.docs.slice(0, 3).forEach(doc => {
          const data = doc.data();
          console.log('Sample assignment:', {
            id: doc.id,
            class: data.class,
            classType: typeof data.class,
            subject: data.subject,
            chapterName: data.chapterName || data.assignmentTitle
          });
        });

        // Filter manually
        snapshot = {
          docs: allSnapshot.docs.filter(doc => {
            const data = doc.data();
            const classMatch = data.class === classInt || data.class === String(classNumber);
            const subjectMatch = data.subject === subject;
            return classMatch && subjectMatch;
          })
        };

        console.log('After manual filter:', snapshot.docs.length, 'assignments');
      }

      const assignmentsList = snapshot.docs.map(doc => {
        const data = doc.data();
        let parsedDueDate = parseFirebaseDate(data.dueDate);
        if (!parsedDueDate) {
          const createdDate = parseFirebaseDate(data.createdAt) || 
                              parseFirebaseDate(data.timestamp) || 
                              new Date();
          parsedDueDate = new Date(createdDate.getTime() + 3 * 24 * 60 * 60 * 1000);
        }
        return {
          id: doc.id,
          ...data,
          dueDate: parsedDueDate
        };
      });

      // Fetch student's past submissions to prevent duplicate submissions
      const submissionsQ = query(
        collection(db, 'studentSubmissions'),
        where('studentId', '==', studentId)
      );
      const subSnapshot = await getDocs(submissionsQ);
      
      const submissionsMap = {};
      subSnapshot.docs.forEach(d => {
        const data = d.data();
        submissionsMap[data.assignmentId] = { id: d.id, ...data };
      });
      const submittedAssignmentIds = new Set(Object.keys(submissionsMap));

      // Filter out assignments that are past their due date
      const now = new Date();
      now.setHours(23, 59, 59, 999); // End of today

      const activeAssignments = assignmentsList.filter(assignment => {
        if (submittedAssignmentIds.has(assignment.id)) return false; // Already submitted
        const dueDate = new Date(assignment.dueDate);
        dueDate.setHours(23, 59, 59, 999); // End of due date
        return dueDate >= now; // Only show if due date is today or later
      });

      const overdueAssignments = assignmentsList.filter(assignment => {
        if (submittedAssignmentIds.has(assignment.id)) return false; // Already submitted
        const dueDate = new Date(assignment.dueDate);
        dueDate.setHours(23, 59, 59, 999);
        return dueDate < now;
      });

      const alreadySubmittedList = assignmentsList
        .filter(assignment => submittedAssignmentIds.has(assignment.id))
        .map(assignment => ({
           ...assignment,
           submissionData: submissionsMap[assignment.id]
        }));

      console.log('Active assignments:', activeAssignments.length);
      console.log('Overdue assignments (blocked):', overdueAssignments.length);
      console.log('Submitted assignments:', alreadySubmittedList.length);

      setAssignments(activeAssignments);
      setOverdueAssignments(overdueAssignments);
      setSubmittedAssignments(alreadySubmittedList);
    } catch (err) {
      console.error('Error fetching assignments:', err);
    } finally {
      setLoadingAssignments(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setError('');
    } else {
      setError('Please select a PDF file');
      setSelectedFile(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) return;

    if (!selectedAssignment) {
      setError('Please select an assignment');
      return;
    }

    // Validate that all questions have answers
    const hasEmptyAnswers = Object.values(answers).some(answer => !answer.trim());
    if (hasEmptyAnswers || Object.keys(answers).length === 0) {
      setError('❌ Please answer all questions before submitting');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const assignment = assignments.find(a => a.id === selectedAssignment);

      // Check if assignment is past due date
      if (assignment?.dueDate) {
        const now = new Date();
        const dueDate = new Date(assignment.dueDate);
        dueDate.setHours(23, 59, 59, 999); // End of due date

        if (now > dueDate) {
          setError('❌ This assignment is past its due date and can no longer be submitted.');
          setLoading(false);
          return;
        }
      }

      // Combine all answers into submission text
      setProcessingStage('📝 Preparing your submission...');
      let submissionContent = '';
      questions.forEach((question, index) => {
        submissionContent += `Question ${index + 1}: ${question}\n\nAnswer: ${answers[index]}\n\n---\n\n`;
      });

      // Save submission to Firestore (no grading)
      setProcessingStage('💾 Saving your submission...');
      const submissionData = {
        studentId,
        assignmentId: selectedAssignment,
        assignmentTitle: assignment.assignmentTitle || assignment.title || 'Untitled Assignment',
        chapterName: assignment.chapterName || 'N/A',
        classNumber,
        subject,
        schoolName: isDeveloper ? (assignment.schoolName || '') : (schoolName || ''),
        questions: questions,
        answers: answers,
        submittedText: submissionContent,
        submittedAt: new Date().toISOString(),
        status: 'submitted'
      };

      console.log('Saving submission with data:', submissionData);
      const docRef = await addDoc(collection(db, 'studentSubmissions'), submissionData);
      console.log('Submission saved with ID:', docRef.id);

      // Update student stats
      const statsKey = `studentStats_${studentId}`;
      const savedStats = safeLocalStorage.get(statsKey);
      if (savedStats) {
        const stats = savedStats;
        stats.tasksCompleted = (stats.tasksCompleted || 0) + 1;
        safeLocalStorage.set(statsKey, stats);
      }

      setSuccess('✅ Assignment submitted successfully!');
      setProcessingStage('');
      setSelectedAssignment('');
      setSubmissionText('');
      setQuestions([]);
      setAnswers({});
      setShowQuestions(false);
      setSelectedFile(null);

      const fileInput = document.getElementById('student-submission-file');
      if (fileInput) fileInput.value = '';

    } catch (err) {
      console.error('Submission error:', err);
      setError('Submission failed: ' + err.message);
      setProcessingStage('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h3>📝 Submit Assignment</h3>

      <div style={styles.disclaimer}>
        <strong>⚠️ Important Notice:</strong> All your answers will be recorded and saved in our system.
        Please cooperate and answer all questions relevantly and honestly. Your submission will be reviewed by your teacher.
      </div>

      {loadingAssignments ? (
        <p>Loading assignments...</p>
      ) : assignments.length === 0 ? (
        <div style={styles.noAssignments}>
          <p>No assignments available for submission.</p>
          <p style={{ fontSize: '13px', marginTop: '8px' }}>All assignments may have passed their due date, or no assignments have been created yet.</p>
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Select Assignment:</label>
              <select
                value={selectedAssignment}
                onChange={(e) => {
                  setSelectedAssignment(e.target.value);
                  setShowQuestions(false);
                  setQuestions([]);
                  setAnswers({});
                }}
                style={styles.select}
                disabled={loading}
              >
                <option value="">-- Choose an assignment --</option>
                {assignments.map(assignment => (
                  <option key={assignment.id} value={assignment.id}>
                    {assignment.assignmentTitle} - Due: {new Date(assignment.dueDate).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>

            {selectedAssignment && (
              <div style={styles.assignmentPreview}>
                <h4 style={styles.previewTitle}>📄 Assignment Questions</h4>
                <button
                  type="button"
                  onClick={() => {
                    setShowQuestions(!showQuestions);
                    if (!showQuestions && questions.length === 0) {
                      loadQuestions();
                    }
                  }}
                  style={styles.viewPdfButton}
                >
                  {showQuestions ? '🙈 Hide Assignment Questions' : '👁️ View Assignment Questions'}
                </button>
                {showQuestions && (
                  <div style={styles.questionsViewer}>
                    {loadingQuestions ? (
                      <p>Loading questions...</p>
                    ) : questions.length > 0 ? (
                      questions.map((question, index) => (
                        <div key={index} style={styles.questionItem}>
                          <h4 style={styles.questionTitle}>Question {index + 1}:</h4>
                          <p style={styles.questionText}>{question}</p>
                          <textarea
                            value={answers[index] || ''}
                            onChange={(e) => setAnswers({ ...answers, [index]: e.target.value })}
                            placeholder="Type your answer here..."
                            style={styles.answerTextarea}
                            rows={4}
                          />
                        </div>
                      ))
                    ) : (
                      <p>No questions found in this assignment.</p>
                    )}
                  </div>
                )}
                <p style={styles.previewInfo}>
                  📚 Chapter: {assignments.find(a => a.id === selectedAssignment)?.chapterName || 'N/A'}
                </p>
                <p style={styles.previewInfo}>
                  📅 Due Date: {new Date(assignments.find(a => a.id === selectedAssignment)?.dueDate).toLocaleDateString()}
                </p>
              </div>
            )}

            {error && <div style={styles.error}>{error}</div>}
            {success && <div style={styles.success}>{success}</div>}

            {loading && (
              <div style={styles.loadingBox}>
                <div style={styles.spinner}></div>
                <p style={styles.processingText}>{processingStage || 'Processing...'}</p>
                <small style={styles.loadingHint}>Submitting your assignment...</small>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !selectedAssignment || Object.keys(answers).length === 0}
              style={{
                ...styles.button,
                opacity: loading || !selectedAssignment || Object.keys(answers).length === 0 ? 0.6 : 1,
                cursor: loading || !selectedAssignment || Object.keys(answers).length === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? '⏳ Submitting...' : '📤 Submit Assignment'}
            </button>
          </form>
        </>
      )}

      {/* Assignment History - Shows overdue & submitted assignments */}
      {(overdueAssignments.length > 0 || submittedAssignments.length > 0) && (
        <div style={styles.historySection}>
          <button
            onClick={() => setShowHistory(!showHistory)}
            style={styles.historyToggle}
          >
            📚 {showHistory ? 'Hide' : 'Show'} Assignment History ({overdueAssignments.length} overdue, {submittedAssignments.length} submitted)
          </button>

          {showHistory && (
            <div style={styles.historyList}>
              {submittedAssignments.map(assignment => (
                <div key={`sub-${assignment.id}`} style={{...styles.historyCard, background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.1))', borderColor: 'rgba(16, 185, 129, 0.3)'}}>
                  <div style={styles.historyHeader}>
                    <span style={{...styles.historyTitle, color: '#34d399'}}>{assignment.assignmentTitle || assignment.title}</span>
                    <span style={{...styles.overdueTag, background: 'linear-gradient(135deg, #10b981, #059669)'}}>✅ Submitted</span>
                  </div>
                  <div style={styles.historyDetails}>
                    <p>📚 Chapter: {assignment.chapterName || 'N/A'}</p>
                    <p>📅 Due Date: {assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : 'No due date'}</p>
                    <p style={{...styles.missedText, color: '#34d399'}}>✅ You have successfully completed this assignment. Check My Grades for your score.</p>
                  </div>
                </div>
              ))}

              {overdueAssignments.map(assignment => (
                <div key={`over-${assignment.id}`} style={styles.historyCard}>
                  <div style={styles.historyHeader}>
                    <span style={styles.historyTitle}>{assignment.assignmentTitle || assignment.title}</span>
                    <span style={styles.overdueTag}>⏰ Overdue</span>
                  </div>
                  <div style={styles.historyDetails}>
                    <p>📚 Chapter: {assignment.chapterName || 'N/A'}</p>
                    <p>📅 Due Date: {new Date(assignment.dueDate).toLocaleDateString()}</p>
                    <p style={styles.missedText}>❌ This assignment can no longer be submitted</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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
  disclaimer: {
    padding: '16px',
    background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(245, 158, 11, 0.15))',
    border: '1px solid rgba(251, 191, 36, 0.4)',
    borderRadius: '8px',
    marginBottom: '20px',
    fontSize: '14px',
    lineHeight: '1.6',
    color: '#fcd34d'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  assignmentPreview: {
    padding: '16px',
    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(30, 58, 95, 0.4))',
    border: '1px solid rgba(59, 130, 246, 0.4)',
    borderRadius: '10px',
    marginBottom: '16px'
  },
  previewTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#60a5fa',
    margin: '0 0 12px 0'
  },
  viewPdfButton: {
    display: 'inline-block',
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    marginBottom: '12px',
    transition: 'all 0.2s',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)'
  },
  pdfViewer: {
    marginTop: '16px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '8px',
    padding: '16px',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    maxHeight: '600px',
    overflowY: 'auto'
  },
  questionsViewer: {
    marginTop: '16px',
    maxHeight: '600px',
    overflowY: 'auto'
  },
  questionItem: {
    marginBottom: '24px',
    padding: '16px',
    border: '1px solid rgba(59, 130, 246, 0.25)',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.5), rgba(15, 23, 42, 0.6))'
  },
  questionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#ffffff',
    margin: '0 0 8px 0'
  },
  questionText: {
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.85)',
    margin: '0 0 12px 0',
    lineHeight: '1.5'
  },
  answerTextarea: {
    width: '100%',
    padding: '12px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: 'inherit',
    resize: 'vertical',
    minHeight: '80px',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    color: '#ffffff'
  },
  previewInfo: {
    fontSize: '14px',
    color: '#60a5fa',
    margin: '4px 0',
    fontWeight: '500'
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)'
  },
  select: {
    padding: '10px',
    fontSize: '14px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '8px',
    fontFamily: 'inherit',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    color: '#ffffff',
    cursor: 'pointer'
  },
  textarea: {
    padding: '12px',
    fontSize: '14px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '8px',
    fontFamily: 'inherit',
    resize: 'vertical',
    minHeight: '150px',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    color: '#ffffff'
  },
  fileButton: {
    padding: '10px 16px',
    background: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
    color: 'white',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    border: 'none',
    display: 'inline-block'
  },
  fileName: {
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500'
  },
  button: {
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #10b981, #34d399)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '15px',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)'
  },
  error: {
    padding: '12px',
    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.15))',
    color: '#fca5a5',
    borderRadius: '8px',
    fontSize: '14px',
    border: '1px solid rgba(239, 68, 68, 0.4)'
  },
  success: {
    padding: '12px',
    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.15))',
    color: '#34d399',
    borderRadius: '8px',
    fontSize: '14px',
    border: '1px solid rgba(16, 185, 129, 0.4)'
  },
  loadingBox: {
    padding: '20px',
    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(30, 58, 95, 0.4))',
    border: '1px solid rgba(59, 130, 246, 0.4)',
    borderRadius: '12px',
    textAlign: 'center'
  },
  spinner: {
    width: '40px',
    height: '40px',
    margin: '0 auto 12px',
    border: '4px solid rgba(59, 130, 246, 0.3)',
    borderTop: '4px solid #60a5fa',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  processingText: {
    margin: '8px 0',
    fontSize: '15px',
    fontWeight: '600',
    color: '#60a5fa'
  },
  loadingHint: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '13px'
  },
  noAssignments: {
    padding: '20px',
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.6)',
    fontStyle: 'italic'
  },
  historySection: {
    marginTop: '24px',
    paddingTop: '24px',
    borderTop: '2px dashed rgba(59, 130, 246, 0.3)'
  },
  historyToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 20px',
    background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.5), rgba(15, 23, 42, 0.6))',
    color: 'rgba(255, 255, 255, 0.8)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'all 0.2s ease'
  },
  historyList: {
    marginTop: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  historyCard: {
    padding: '16px',
    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(220, 38, 38, 0.1))',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '10px'
  },
  historyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  historyTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#fca5a5'
  },
  overdueTag: {
    padding: '4px 10px',
    background: 'linear-gradient(135deg, #dc2626, #ef4444)',
    color: 'white',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600'
  },
  historyDetails: {
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.7)'
  },
  missedText: {
    marginTop: '8px',
    fontWeight: '600',
    color: '#f87171'
  }
};

export default StudentAssignmentSubmit;
