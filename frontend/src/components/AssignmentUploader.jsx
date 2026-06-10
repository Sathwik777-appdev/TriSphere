import React, { useState } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { generateAssignmentQuestions } from '../services/aiService';
import { extractTextFromURL } from '../services/pdfHelper';

export const AssignmentUploader = ({ userId, classNumber, subject, schoolName, chapters, onUploadSuccess }) => {
  const [chapterName, setChapterName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [processingStage, setProcessingStage] = useState('');
  const [generatedQuestions, setGeneratedQuestions] = useState([]);

  // Default to 3 days from now
  const getDefaultDueDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  };
  const [dueDateStr, setDueDateStr] = useState(getDefaultDueDate());



  const handleGenerateQuestions = async () => {
    if (!chapterName) {
      setError('Please select a chapter first');
      return;
    }

    setLoading(true);
    setError('');
    setProcessingStage('🔍 Finding chapter content...');

    try {
      // Find the selected chapter's textbook to get content
      const { query, collection: firestoreCollection, where, getDocs } = await import('firebase/firestore');
      const q = query(
        firestoreCollection(db, 'textbooks'),
        where('chapterName', '==', chapterName),
        where('class', '==', classNumber),
        where('subject', '==', subject)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setError('Chapter not found. Please upload the chapter textbook first.');
        setLoading(false);
        return;
      }

      const textbookData = snapshot.docs[0].data();

      // Get chapter text from PDF or notes
      setProcessingStage('📄 Extracting chapter content...');
      let chapterText = '';

      if (textbookData.pdfURL) {
        chapterText = await extractTextFromURL(textbookData.pdfURL);
      }

      if (!chapterText || chapterText.length < 100) {
        setError('Could not extract enough content from chapter. Please ensure the chapter PDF is uploaded.');
        setLoading(false);
        return;
      }

      // Generate 10 questions using AI
      setProcessingStage('🤖 AI is generating 10 assignment questions...');
      const questions = await generateAssignmentQuestions(chapterText);

      setGeneratedQuestions(questions);
      setSuccess(`✅ Generated ${questions.length} assignment questions!`);
      setProcessingStage('');
    } catch (err) {
      console.error('Question generation error:', err);
      setError('Failed to generate questions: ' + err.message);
      setProcessingStage('');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!chapterName || generatedQuestions.length === 0) {
      setError('Please generate questions before creating the assignment');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setProcessingStage('💾 Saving assignment...');

    try {
      let finalDueDate = null;
      if (dueDateStr) {
        finalDueDate = new Date(dueDateStr);
        finalDueDate.setHours(23, 59, 59, 999);
      } else {
        finalDueDate = new Date();
        finalDueDate.setDate(finalDueDate.getDate() + 3);
        finalDueDate.setHours(23, 59, 59, 999);
      }

      // Create assignment with AI-generated questions
      const assignmentData = {
        assignmentTitle: chapterName, // Use chapter name as assignment title
        chapterName,
        class: parseInt(classNumber), // Store as number for consistency
        subject,
        schoolName: schoolName || '', // Add schoolName
        dueDate: Timestamp.fromDate(finalDueDate),
        questions: generatedQuestions,
        createdBy: userId,
        createdAt: Timestamp.now()
      };

      const docRef = await addDoc(collection(db, 'assignments'), assignmentData);

      setSuccess(`✅ ${chapterName} assignment created successfully with ${generatedQuestions.length} questions!`);
      setChapterName('');
      setGeneratedQuestions([]);
      setDueDateStr(getDefaultDueDate());
      setProcessingStage('');
      if (onUploadSuccess) onUploadSuccess();
    } catch (err) {
      console.error('Assignment creation error:', err);
      setError('Failed to create assignment: ' + err.message);
      setProcessingStage('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h3>Upload Assignment</h3>
      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Chapter Name:</label>
          <input
            type="text"
            value={chapterName}
            onChange={(e) => setChapterName(e.target.value)}
            placeholder="Enter chapter name (e.g., Chapter 1: Introduction)"
            style={styles.input}
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Deadline Date:</label>
          <input
            type="date"
            value={dueDateStr}
            onChange={(e) => setDueDateStr(e.target.value)}
            style={styles.input}
            disabled={loading}
            required
          />
        </div>

        <div style={styles.infoBox}>
          <p style={styles.infoText}>
            📝 <strong>Assignment Title:</strong> Will be same as chapter name
          </p>
        </div>

        <div style={styles.formGroup}>
          <button
            type="button"
            onClick={handleGenerateQuestions}
            disabled={loading || !chapterName}
            style={{
              ...styles.generateButton,
              opacity: loading || !chapterName ? 0.6 : 1,
              cursor: loading || !chapterName ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? '⏳ Generating...' : '🤖 Generate 10 Questions with AI'}
          </button>
          {generatedQuestions.length > 0 && (
            <div style={styles.questionsPreview}>
              <h4 style={styles.previewTitle}>📝 Generated Questions ({generatedQuestions.length}):</h4>
              <ol style={styles.questionsList}>
                {generatedQuestions.map((q, idx) => (
                  <li key={idx} style={styles.questionItem}>{q}</li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}

        {loading && (
          <div style={styles.loadingBox}>
            <div style={styles.spinner}></div>
            <p style={styles.processingText}>{processingStage || 'Processing...'}</p>
            <small style={styles.loadingHint}>AI is generating assignment questions...</small>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || generatedQuestions.length === 0}
          style={{
            ...styles.button,
            opacity: loading || generatedQuestions.length === 0 ? 0.6 : 1,
            cursor: loading || generatedQuestions.length === 0 ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? '⏳ Creating...' : '📤 Create Assignment'}
        </button>
      </form>
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: 'white',
    border: '1px solid #ddd',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '20px'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column'
  },
  label: {
    marginBottom: '5px',
    fontSize: '14px',
    fontWeight: '500'
  },
  input: {
    padding: '10px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontFamily: 'inherit'
  },
  select: {
    padding: '10px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontFamily: 'inherit'
  },
  fileButton: {
    padding: '8px 12px',
    backgroundColor: '#4f46e5',
    color: '#fff',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: 13,
    border: 'none',
    display: 'inline-block'
  },
  fileName: {
    fontSize: '14px',
    color: '#333',
    fontWeight: '500'
  },
  filename: {
    fontSize: 13,
    color: '#333'
  },
  button: {
    padding: '10px 20px',
    backgroundColor: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '500'
  },
  cancelButton: {
    padding: '10px 20px',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '500',
    minWidth: '100px'
  },
  error: {
    padding: '10px',
    backgroundColor: '#fee',
    color: '#c33',
    borderRadius: '4px'
  },
  success: {
    padding: '10px',
    backgroundColor: '#efe',
    color: '#3c3',
    borderRadius: '4px'
  },
  loadingBox: {
    padding: '15px',
    backgroundColor: '#f0f9ff',
    border: '2px solid #3b82f6',
    borderRadius: '8px',
    textAlign: 'center',
    marginTop: '10px'
  },
  spinner: {
    width: '40px',
    height: '40px',
    margin: '0 auto 10px',
    border: '4px solid #e5e7eb',
    borderTop: '4px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  processingText: {
    margin: '10px 0 5px 0',
    fontSize: '15px',
    fontWeight: '500',
    color: '#1e40af'
  },
  loadingHint: {
    color: '#6b7280',
    fontSize: '12px'
  },
  generateButton: {
    padding: '12px 20px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '15px',
    marginTop: '10px'
  },
  questionsPreview: {
    marginTop: '16px',
    padding: '16px',
    backgroundColor: '#f0fdf4',
    border: '2px solid #10b981',
    borderRadius: '8px'
  },
  previewTitle: {
    margin: '0 0 12px 0',
    fontSize: '16px',
    fontWeight: '700',
    color: '#065f46'
  },
  questionsList: {
    margin: 0,
    paddingLeft: '24px',
    maxHeight: '400px',
    overflowY: 'auto'
  },
  questionItem: {
    marginBottom: '12px',
    fontSize: '14px',
    color: '#374151',
    lineHeight: '1.6'
  },
  infoBox: {
    padding: '12px',
    backgroundColor: '#eff6ff',
    border: '1px solid #3b82f6',
    borderRadius: '8px',
    marginBottom: '16px'
  },
  infoText: {
    margin: '4px 0',
    fontSize: '14px',
    color: '#1e40af'
  }
};
