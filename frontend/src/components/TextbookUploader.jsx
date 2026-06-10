import React, { useState } from 'react';
import { uploadTextbook } from '../services/firestoreService';
import { extractTextFromPDF } from '../services/pdfHelper';
import { generateStudyMaterial } from '../services/aiService';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { offlineDB, isOffline } from '../utils/offlineDB';
import { useOffline } from '../hooks/useOffline';

export const TextbookUploader = ({ userId, classNumber, subject, schoolName, onUploadSuccess }) => {
  const [chapterName, setChapterName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [phetSlug, setPhetSlug] = useState('');
  const [processingStage, setProcessingStage] = useState('');
  const [uploadTask, setUploadTask] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { offline, addToQueue } = useOffline();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setError('❌ File too large. Please upload a PDF under 10MB for optimal processing.');
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setError('');
    } else {
      setError('Please select a PDF file');
      setSelectedFile(null);
    }
  };

  const handleCancelUpload = () => {
    if (uploadTask) {
      uploadTask.cancel();
      setLoading(false);
      setProcessingStage('');
      setUploadTask(null);
      setUploadProgress(0);
      setError('❌ Upload cancelled');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile || !chapterName || !classNumber || !subject) {
      setError('Please fill all fields');
      return;
    }

    // Handle offline mode
    if (offline || isOffline()) {
      setLoading(true);
      setProcessingStage('💾 Saving offline...');

      try {
        // Convert file to base64 for storage
        const reader = new FileReader();
        const fileData = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(selectedFile);
        });

        // Save to IndexedDB
        const lessonPlan = {
          id: `offline-${Date.now()}`,
          chapterName,
          class: parseInt(classNumber),
          subject,
          teacherId: userId,
          schoolName: schoolName || '',
          phetSlug,
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          fileData, // Base64 encoded file
          createdAt: Date.now(),
          status: 'queued'
        };

        await offlineDB.saveLessonPlan(lessonPlan);

        // Add to sync queue
        await addToQueue({
          type: 'lesson-plan',
          data: lessonPlan,
          timestamp: Date.now()
        });

        setSuccess('✅ Lesson plan saved offline! Will sync when online.');
        setChapterName('');
        setSelectedFile(null);
        setPhetSlug('');
        if (onUploadSuccess) onUploadSuccess();
      } catch (err) {
        console.error('Offline save error:', err);
        setError('❌ Failed to save offline: ' + err.message);
      } finally {
        setLoading(false);
        setProcessingStage('');
      }
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setUploadProgress(0);

    try {
      // Only upload PDF to Firebase Storage
      setProcessingStage('📤 Starting upload...');
      const startTime = Date.now();
      console.log('=== UPLOAD START ===', {
        chapterName,
        fileSize: selectedFile.size,
        fileSizeMB: (selectedFile.size / (1024 * 1024)).toFixed(2) + 'MB',
        time: new Date().toISOString()
      });

      // NOTE: uploadTextbook takes 7 params, not 8. Previously chapterName was
      // accidentally passed twice, which shifted every later argument left by
      // one slot — userId got the chapterName string, phetSlug got the real
      // userId, and so on. That left every textbook doc with a corrupted
      // `createdBy` field.
      const { uploadPromise, task, onProgress } = await uploadTextbook(
        selectedFile,
        classNumber,
        subject,
        chapterName,
        userId,
        phetSlug,
        schoolName || ''
      );

      // Set the task immediately so cancel button works
      setUploadTask(task);

      // Wait for upload to complete
      const textbookId = await uploadPromise;
      const totalTime = Date.now() - startTime;
      console.log('=== UPLOAD COMPLETE ===', {
        textbookId,
        totalTime: totalTime + 'ms',
        seconds: (totalTime / 1000).toFixed(2) + 's'
      });

      // Auto-trigger AI content generation
      setProcessingStage('🤖 Generating AI study materials...');
      console.log('=== AI GENERATION START ===', { classNumber, subject, chapterName });
      try {
        // Extract text from PDF for AI processing
        const pdfText = await extractTextFromPDF(selectedFile);
        console.log('PDF text extracted:', pdfText ? `${pdfText.length} characters` : 'FAILED');

        if (pdfText && pdfText.length > 50) {
          // Generate AI content
          console.log('Calling generateStudyMaterial...');
          const aiContent = await generateStudyMaterial(pdfText, (percent, message) => {
            console.log(`AI Progress: ${percent}% - ${message}`);
            setProcessingStage(message);
          }, chapterName, classNumber, subject);

          console.log('AI content generated:', {
            hasNotes: !!aiContent.notesText,
            notesLength: aiContent.notesText?.length,
            quizCount: aiContent.quizData?.length,
            assignmentCount: aiContent.assignmentQuestions?.length,
            failures: aiContent.failures
          });

          // Save AI-generated content to Firestore
          const docData = {
            textbookId,
            chapterName,
            class: parseInt(classNumber),
            classNumber: parseInt(classNumber),
            subject,
            schoolName: schoolName || '',
            notes: aiContent.notesText,
            youtubeVideos: [],
            quiz: (aiContent.quizData && aiContent.quizData.length > 0) ? aiContent.quizData : [],
            maxAttempts: 2, // Default: 2 attempts (can be changed by teacher)
            generatedAt: new Date().toISOString(),
            pdfTextLength: pdfText.length
          };

          console.log('Saving AI content to Firestore:', { textbookId, ...docData });
          await setDoc(doc(db, 'aiGeneratedContent', textbookId), docData);
          console.log('✅ AI content saved to Firestore successfully!');

          // Create announcement for new chapter upload
          const { addDoc, collection, Timestamp } = await import('firebase/firestore');
          try {
            setProcessingStage('📢 Creating announcement...');
            await addDoc(collection(db, 'announcements'), {
              title: `New Study Material: ${chapterName}`,
              message: `📚 New chapter "${chapterName}" has been uploaded for ${subject} (Class ${classNumber}).\n\n✨ AI-Generated Content Available:\n• 📝 Comprehensive Study Notes\n• ❓ ${aiContent.quizData?.length || 0} Quiz Questions\n\nStart learning now!`,
              type: 'material',
              class: parseInt(classNumber),
              schoolName: schoolName || '',
              subject: subject,
              chapterName: chapterName,
              createdBy: userId,
              createdAt: Timestamp.now(),
              seenByStudents: [],
              seenByParents: []
            });
            console.log('✅ Chapter announcement created');
          } catch (announcementError) {
            console.error('Failed to create chapter announcement:', announcementError);
          }

          // Automatically create assignment with AI-generated questions
          if (aiContent.assignmentQuestions && aiContent.assignmentQuestions.length > 0) {
            setProcessingStage('📝 Creating assignment with 10 questions...');
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 3); // 3 days deadline

            await addDoc(collection(db, 'assignments'), {
              assignmentTitle: chapterName,
              chapterName,
              class: parseInt(classNumber),
              subject,
              schoolName: schoolName || '',
              dueDate: dueDate.toISOString(),
              questions: aiContent.assignmentQuestions,
              createdBy: userId,
              createdAt: new Date().toISOString()
            });
            console.log('✅ Assignment created with', aiContent.assignmentQuestions.length, 'questions');

            // Auto-create announcement for the new assignment
            try {
              await addDoc(collection(db, 'announcements'), {
                title: `New Assignment: ${chapterName}`,
                message: `A new assignment "${chapterName}" has been posted for ${subject}.\n\nDue Date: ${dueDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}\nQuestions: 10\n\nPlease complete and submit before the deadline!`,
                type: 'assignment',
                class: parseInt(classNumber),
                schoolName: schoolName || '',
                subject: subject,
                assignmentTitle: chapterName,
                createdBy: userId,
                createdAt: Timestamp.now(),
                seenByStudents: [],
                seenByParents: []
              });
              console.log('✅ Assignment announcement created');
            } catch (announcementError) {
              console.error('Failed to create announcement:', announcementError);
            }

            // Surface partial-failure honestly so teachers don't think
            // everything worked when quiz/videos are actually missing.
            const f = aiContent.failures || [];
            if (f.length === 0) {
              setSuccess(`✅ ${chapterName} uploaded! AI generated: Notes, 10 Quiz Qs & 10 Assignment Qs. Assignment deadline: 3 days.`);
            } else {
              const failedSteps = f.map(x => x.step).join(', ');
              setSuccess(`⚠️ ${chapterName} uploaded with partial AI content. Failed steps: ${failedSteps}. Notes/quiz may be missing — try regenerating.`);
            }
          } else {
            const f = aiContent.failures || [];
            const failedSteps = f.map(x => x.step).join(', ');
            setSuccess(failedSteps
              ? `⚠️ ${chapterName} uploaded but AI assignment generation failed (${failedSteps}). Notes/quiz may also be partial.`
              : `✅ ${chapterName} uploaded! AI study materials have been generated automatically.`);
          }
        } else {
          setError(`⚠️ ${chapterName} uploaded but the PDF text could not be extracted (it may be a scanned image, password-protected, or empty). AI content was NOT generated.`);
        }
      } catch (aiError) {
        console.error('AI generation failed:', aiError);
        setError(`⚠️ ${chapterName} uploaded but AI generation failed: ${aiError.message || 'unknown error'}. Quiz/notes were NOT created — please retry or generate manually.`);
      }
      setProcessingStage('');
      setChapterName('');
      setPhetSlug('');
      setSelectedFile(null);

      // Reset file input
      const fileInput = document.getElementById('textbook-file-input');
      if (fileInput) fileInput.value = '';

      if (onUploadSuccess) onUploadSuccess({
        id: textbookId,
        chapterName,
        phetSlug
      });
    } catch (err) {
      console.error('Upload error:', err);
      if (err.code === 'storage/canceled') {
        setError('❌ Upload cancelled');
      } else if (err.code === 'storage/retry-limit-exceeded') {
        setError('❌ Upload failed: Connection timeout. Please check your internet connection and try again with a smaller file or better network.');
      } else if (err.code === 'storage/quota-exceeded') {
        setError('❌ Upload failed: Storage quota exceeded. Please contact administrator.');
      } else {
        setError('❌ Upload failed: ' + (err.message || 'Unknown error. Please try again.'));
      }
      setProcessingStage('');
    } finally {
      setLoading(false);
      setUploadTask(null);
      setUploadProgress(0);
    }
  };

  return (
    <div style={styles.container}>
      <h3 style={{ color: '#000000', marginBottom: '15px' }}>Upload Textbook Chapter</h3>
      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Chapter Name:</label>
          <input
            type="text"
            value={chapterName}
            onChange={(e) => setChapterName(e.target.value)}
            placeholder="e.g., Chapter 1: Introduction"
            style={styles.input}
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>PDF File:</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label
              htmlFor="textbook-file-input"
              className="file-button-label"
              style={styles.fileButton}
              aria-disabled={loading}
            >
              Choose file
            </label>
            <input
              id="textbook-file-input"
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              disabled={loading}
            />
            {selectedFile && (
              <span style={{...styles.fileName, minWidth: 0, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                📄 {selectedFile.name}
              </span>
            )}
          </div>
        </div>

        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}

        {loading && (
          <div style={styles.loadingBox}>
            <div style={styles.spinner}></div>
            <p style={styles.processingText}>{processingStage || 'Processing...'}</p>
            {uploadProgress > 0 && (
              <div style={styles.progressBarContainer}>
                <div style={{ ...styles.progressBar, width: `${uploadProgress}%` }}>
                  {uploadProgress}%
                </div>
              </div>
            )}
            <small style={styles.loadingHint}>Large files may take several minutes to upload</small>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="submit"
            disabled={loading || !selectedFile}
            style={{
              ...styles.button,
              opacity: loading || !selectedFile ? 0.6 : 1,
              cursor: loading || !selectedFile ? 'not-allowed' : 'pointer',
              flex: 1
            }}
          >
            {loading ? '⏳ Uploading...' : '📤 Upload Chapter'}
          </button>
          {loading && (
            <button
              type="button"
              onClick={handleCancelUpload}
              style={{ ...styles.cancelButton, flex: 1 }}
            >
              ❌ Cancel
            </button>
          )}
        </div>
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
    fontWeight: '500',
    color: '#000000'
  },
  input: {
    padding: '10px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontFamily: 'inherit',
    color: '#000000'
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
  fileButton: {
    padding: '8px 12px',
    backgroundColor: '#1f2937',
    color: '#fff',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: 13,
    border: 'none',
    display: 'inline-block'
  },
  fileName: {
    fontSize: '14px',
    color: '#000000',
    fontWeight: '500'
  },
  filename: {
    fontSize: 13,
    color: '#000000'
  },
  error: {
    padding: '10px',
    backgroundColor: '#fee',
    color: '#c33',
    borderRadius: '4px',
    fontSize: '14px'
  },
  success: {
    padding: '10px',
    backgroundColor: '#efe',
    color: '#3c3',
    borderRadius: '4px',
    fontSize: '14px'
  },
  loadingBox: {
    padding: '15px',
    backgroundColor: '#f0f9ff',
    border: '2px solid #3b82f6',
    borderRadius: '8px',
    textAlign: 'center',
    marginTop: '10px'
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
  spinner: {
    width: '40px',
    height: '40px',
    margin: '0 auto 10px',
    border: '4px solid #e5e7eb',
    borderTop: '4px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  progressBarContainer: {
    width: '100%',
    height: '20px',
    backgroundColor: '#e5e7eb',
    borderRadius: '10px',
    overflow: 'hidden',
    margin: '10px 0'
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#3b82f6',
    transition: 'width 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: '12px',
    fontWeight: '600'
  }
};
