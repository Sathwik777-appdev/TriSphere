import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { extractTextFromPDF } from '../services/pdfHelper';
import { submitAssignment, updateSubmissionGrade } from '../services/firestoreService';
import { autoGradeAssignment } from '../services/aiService';
import { useAuth } from '../context/AuthContext';

const styles = {
  container: {
    backgroundColor: 'white',
    border: '1px solid #ddd',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '20px'
  },
  backButton: {
    padding: '8px 16px',
    backgroundColor: '#f0f0f0',
    border: '1px solid #ddd',
    borderRadius: '4px',
    cursor: 'pointer',
    marginBottom: '20px'
  },
  dueDate: {
    color: '#666',
    fontSize: '14px',
    margin: '5px 0 20px 0'
  },
  chapterInfo: {
    color: '#666',
    fontSize: '14px',
    margin: '5px 0 20px 0'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  questionContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  questionLabel: {
    fontWeight: '700',
    fontSize: '16px',
    color: '#1f2937',
    display: 'block',
    marginBottom: '4px'
  },
  textarea: {
    padding: '12px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontFamily: 'inherit',
    minHeight: '100px',
    resize: 'vertical'
  },
  submitButton: {
    padding: '12px 20px',
    backgroundColor: '#4caf50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '500'
  },
  feedback: {
    padding: '20px',
    backgroundColor: '#f0f8ff',
    borderRadius: '6px',
    border: '1px solid #bdd7ee'
  },
  detailedFeedback: {
    marginTop: '15px'
  },
  feedbackItem: {
    marginBottom: '10px',
    paddingBottom: '10px',
    borderBottom: '1px solid #ddd'
  },
  assignmentsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginTop: '15px'
  },
  assignmentCard: {
    padding: '20px',
    border: '2px solid #e5e7eb',
    borderRadius: '12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'start',
    backgroundColor: '#f9fafb',
    transition: 'all 0.2s',
    gap: '16px'
  },
  assignmentInfo: {
    flex: 1
  },
  assignmentTitle: {
    margin: '0 0 8px 0',
    fontSize: '18px',
    fontWeight: '600',
    color: '#1a202c'
  },
  assignmentMeta: {
    color: '#6b7280',
    fontSize: '14px',
    margin: '4px 0'
  },
  actionButtons: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  viewButton: {
    padding: '10px 20px',
    backgroundColor: '#3b82f6',
    color: 'white',
    textDecoration: 'none',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    textAlign: 'center',
    transition: 'all 0.2s'
  },
  openButton: {
    padding: '10px 20px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s'
  },
  emptyState: {
    padding: '40px',
    textAlign: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: '12px',
    border: '2px dashed #d1d5db',
    marginTop: '20px'
  },
  emptyText: {
    fontSize: '16px',
    color: '#6b7280',
    margin: 0
  },
  loadingBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    gap: '16px'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  questionsContainer: {
    marginTop: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  questionBlock: {
    padding: '24px',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    border: '2px solid #e5e7eb',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  answerTextarea: {
    width: '100%',
    padding: '12px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontFamily: 'inherit',
    resize: 'vertical',
    marginTop: '8px'
  },
  progressBar: {
    marginBottom: '32px',
    padding: '16px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    border: '1px solid #e5e7eb'
  },
  progressText: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#374151',
    display: 'block',
    marginBottom: '10px'
  },
  answeredText: {
    fontSize: '13px',
    color: '#6b7280',
    marginTop: '8px',
    display: 'block'
  },
  progressBarContainer: {
    width: '100%',
    height: '10px',
    backgroundColor: '#e5e7eb',
    borderRadius: '5px',
    overflow: 'hidden'
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10b981',
    transition: 'width 0.3s ease',
    borderRadius: '5px'
  },
  questionText: {
    fontSize: '15px',
    color: '#1f2937',
    marginTop: '8px',
    marginBottom: '12px',
    lineHeight: '1.6'
  },
  answerWarning: {
    textAlign: 'center',
    marginTop: '20px',
    padding: '12px',
    backgroundColor: '#fef3c7',
    borderRadius: '6px',
    fontSize: '14px',
    color: '#92400e',
    fontWeight: '500'
  }
};

export const TaskZone = ({ studentId, selectedSubject }) => {
  const { userData } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    fetchAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubject]);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      // Fetch all assignments for the selected subject
      const q = query(
        collection(db, 'assignments'),
        where('subject', '==', selectedSubject)
      );
      const snapshot = await getDocs(q);
      const assignmentsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAssignments(assignmentsList);
    } catch (err) {
      console.error('Error fetching assignments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewQuestions = async (assignment) => {
    setSelectedAssignment(assignment);
    setLoadingQuestions(true);
    setQuestions([]);
    setAnswers({});
    
    try {
      // Fetch and extract text from PDF
      const response = await fetch(assignment.assignmentPdfURL);
      const blob = await response.blob();
      const text = await extractTextFromPDF(blob);
      
      // Parse questions from text (simple parsing - looks for numbered questions)
      const parsedQuestions = parseQuestionsFromText(text);
      setQuestions(parsedQuestions);
    } catch (err) {
      console.error('Error loading questions:', err);
      alert('Failed to load questions. Please try again.');
      setSelectedAssignment(null);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const parseQuestionsFromText = (text) => {
    // Split text by question numbers like "1.", "2.", "3." etc.
    // This regex looks for a number followed by a period and space/text
    const questionPattern = /(\d+\.\s+[^]*?)(?=\d+\.\s+|$)/g;
    const matches = text.match(questionPattern);
    
    if (matches && matches.length > 0) {
      return matches.map((match, index) => ({
        id: index + 1,
        text: match.trim()
      }));
    }
    
    // Fallback: if no pattern found, try splitting by newlines
    const lines = text.split('\n').filter(line => line.trim());
    const questions = [];
    let currentQuestion = null;
    
    lines.forEach((line) => {
      // Check if line starts with question pattern
      const questionMatch = line.match(/^(\d+\.|\d+\)|\bQ\d+[:.]|\bQuestion\s+\d+[:.])/i);
      
      if (questionMatch) {
        // Save previous question if exists
        if (currentQuestion) {
          questions.push(currentQuestion);
        }
        // Start new question
        currentQuestion = {
          id: questions.length + 1,
          text: line.trim()
        };
      } else if (currentQuestion && line.trim()) {
        // Continue current question text
        currentQuestion.text += ' ' + line.trim();
      }
    });
    
    // Add last question
    if (currentQuestion) {
      questions.push(currentQuestion);
    }
    
    // If still no questions found, create generic one
    if (questions.length === 0) {
      questions.push({
        id: 1,
        text: text.substring(0, 500)
      });
    }
    
    return questions;
  };

  const handleAnswerChange = (questionId, value) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleSubmitAssignment = async () => {
    if (Object.keys(answers).length !== questions.length) {
      alert('Please answer all questions');
      return;
    }

    setSubmitting(true);
    try {
      // Create full submission payload for Teacher Dashboard compatibility
      const submissionData = {
        studentId: studentId,
        studentName: userData?.name || 'Unknown Student',
        classNumber: String(userData?.class || userData?.classNumber || '10'),
        subject: selectedSubject || selectedAssignment.subject || 'Science',
        schoolName: userData?.schoolName || '',
        assignmentId: selectedAssignment.id,
        assignmentTitle: selectedAssignment.assignmentTitle || `Assignment ${selectedAssignment.id}`,
        answers: answers,
        status: 'pending',
        content: Object.entries(answers).map(([qid, ans]) => `Q${qid}:\n${ans}`).join('\n\n')
      };

      // Submit assignment
      await submitAssignment(submissionData);

      // Auto-grade using AI
      const questionsWithAnswers = questions.map((q) => ({
        ...q,
        studentAnswer: answers[q.id] || ''
      }));

      const gradingResult = await autoGradeAssignment(questionsWithAnswers, 'Reference text');

      setFeedback({
        marks: gradingResult.marks,
        feedback: gradingResult.feedback,
        details: gradingResult.detailedFeedback
      });

      // Save grade to Firestore
      // In real app: await updateSubmissionGrade(submissionId, marks, feedback);
    } catch (err) {
      alert('Submission failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // If viewing questions for an assignment
  if (selectedAssignment && loadingQuestions) {
    return (
      <div style={styles.container}>
        <button
          onClick={() => {
            setSelectedAssignment(null);
            setQuestions([]);
            setAnswers({});
            setFeedback(null);
          }}
          style={styles.backButton}
        >
          ← Back to Assignments
        </button>
        <div style={styles.loadingBox}>
          <div style={styles.spinner}></div>
          <p>⏳ Loading questions from PDF...</p>
        </div>
      </div>
    );
  }

  if (selectedAssignment && questions.length > 0) {
    return (
      <div style={styles.container}>
        <button
          onClick={() => {
            setSelectedAssignment(null);
            setQuestions([]);
            setAnswers({});
            setFeedback(null);
          }}
          style={styles.backButton}
        >
          ← Back to Assignments
        </button>

        <h3>{selectedAssignment.assignmentTitle}</h3>
        <p style={styles.dueDate}>📅 Due: {new Date(selectedAssignment.dueDate).toLocaleDateString()}</p>
        <p style={styles.chapterInfo}>📚 Chapter: {selectedAssignment.chapterName || 'N/A'}</p>

        {feedback ? (
          <div style={styles.feedback}>
            <h4>📊 Your Score: {feedback.marks}%</h4>
            <p>{feedback.feedback}</p>
            <div style={styles.detailedFeedback}>
              {feedback.details?.map((detail, idx) => (
                <div key={idx} style={styles.feedbackItem}>
                  <span><strong>Question {detail.questionNumber}:</strong> {detail.marks}/{detail.maxMarks}</span>
                  <p>{detail.feedback}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={styles.questionsContainer}>
            <div style={styles.progressBar}>
              <span style={styles.progressText}>
                {questions.length} Questions Total
              </span>
              <div style={styles.progressBarContainer}>
                <div 
                  style={{
                    ...styles.progressBarFill,
                    width: `${(Object.keys(answers).length / questions.length) * 100}%`
                  }}
                />
              </div>
              <span style={styles.answeredText}>
                {Object.keys(answers).length} / {questions.length} answered
              </span>
            </div>

            {questions.map((question, index) => (
              <div key={question.id} style={styles.questionBlock}>
                <label style={styles.questionLabel}>
                  Question {index + 1}:
                </label>
                <p style={styles.questionText}>{question.text}</p>
                <textarea
                  value={answers[question.id] || ''}
                  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                  placeholder="Type your answer here..."
                  style={styles.answerTextarea}
                  rows={6}
                  disabled={submitting}
                />
              </div>
            ))}

            <button
              type="button"
              onClick={handleSubmitAssignment}
              disabled={submitting || Object.keys(answers).length !== questions.length}
              style={{
                ...styles.submitButton,
                opacity: submitting || Object.keys(answers).length !== questions.length ? 0.6 : 1,
                cursor: submitting || Object.keys(answers).length !== questions.length ? 'not-allowed' : 'pointer'
              }}
            >
              {submitting ? '⏳ Submitting...' : '📤 Submit Assignment'}
            </button>

            {Object.keys(answers).length < questions.length && (
              <p style={styles.answerWarning}>
                ⚠️ Please answer all {questions.length - Object.keys(answers).length} remaining question(s) before submitting
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h3>📝 TaskZone - Your Assignments</h3>
      
      {loading ? (
        <p>Loading assignments...</p>
      ) : assignments.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={styles.emptyText}>📭 No assignments available for {selectedSubject} yet.</p>
        </div>
      ) : (
        <div style={styles.assignmentsList}>
          {assignments.map((assignment) => (
            <div key={assignment.id} style={styles.assignmentCard}>
              <div style={styles.assignmentInfo}>
                <h4 style={styles.assignmentTitle}>{assignment.assignmentTitle}</h4>
                <p style={styles.assignmentMeta}>
                  📚 Chapter: {assignment.chapterName || 'N/A'}
                </p>
                <p style={styles.assignmentMeta}>
                  📅 Due: {new Date(assignment.dueDate).toLocaleDateString()}
                </p>
                <p style={styles.assignmentMeta}>
                  🎓 Class {assignment.class} - {assignment.subject}
                </p>
              </div>
              <div style={styles.actionButtons}>
                {assignment.assignmentPdfURL && (
                  <button
                    onClick={() => handleViewQuestions(assignment)}
                    style={styles.viewButton}
                  >
                    👁️ View Questions
                  </button>
                )}
                <button
                  onClick={() => handleViewQuestions(assignment)}
                  style={styles.openButton}
                >
                  📝 Answer Assignment
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
