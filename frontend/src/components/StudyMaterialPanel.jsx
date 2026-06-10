import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { extractTextFromPDF } from '../services/pdfHelper';
import { generateStudyMaterial } from '../services/aiService';
import { setDoc } from 'firebase/firestore';
import { offlineDB, isOffline } from '../utils/offlineDB';
import { useOfflineCache } from '../hooks/useOffline';

export const StudyMaterialPanel = ({ textbookId, chapterName, onMaterialGenerated }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [material, setMaterial] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [processingStage, setProcessingStage] = useState('');
  const [hasExistingContent, setHasExistingContent] = useState(false);
  const { cached: cachedTextbooks, cacheData } = useOfflineCache('textbooks');
  const offline = isOffline();

  useEffect(() => {
    fetchChapters();
  }, []);

  useEffect(() => {
    if (chapters.length > 0) {
      checkExistingContent(chapters[0].id);
    }
  }, [chapters]);

  const fetchChapters = async () => {
    try {
      // Try offline first if offline
      if (offline && cachedTextbooks.length > 0) {
        setChapters(cachedTextbooks);
        return;
      }

      const q = query(collection(db, 'textbooks'));
      const snapshot = await getDocs(q);
      const chaptersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setChapters(chaptersList);
      
      // Cache for offline use
      if (chaptersList.length > 0) {
        await cacheData(chaptersList);
      }
    } catch (err) {
      console.error('Error fetching chapters:', err);
      
      // Fallback to cached data
      if (cachedTextbooks.length > 0) {
        setChapters(cachedTextbooks);
        setError('Using cached data (offline)');
      }
    }
  };

  const checkExistingContent = async (chapterId) => {
    try {
      const contentDoc = await getDoc(doc(db, 'aiGeneratedContent', chapterId));
      setHasExistingContent(contentDoc.exists());
      if (contentDoc.exists()) {
        setMaterial(contentDoc.data());
      }
    } catch (err) {
      console.error('Error checking existing content:', err);
    }
  };

  const handleDeleteChapter = async (chapterId, chapterName) => {
    if (!confirm(`Are you sure you want to delete "${chapterName}"? This cannot be undone.`)) {
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'textbooks', chapterId));
      // Also delete AI content if exists
      try {
        await deleteDoc(doc(db, 'aiGeneratedContent', chapterId));
      } catch (e) {
        // AI content might not exist, that's okay
      }
      
      // Refresh the list
      await fetchChapters();
      if (selectedChapterId === chapterId) {
        setSelectedChapterId('');
        setMaterial(null);
      }
      setSuccess('Chapter deleted successfully');
    } catch (err) {
      console.error('Error deleting chapter:', err);
      setError('Failed to delete chapter');
    }
  };

  const handleGenerateMaterial = async () => {
    // Use the most recently uploaded chapter
    const latestChapter = chapters[0];
    if (!latestChapter) {
      setError('Please upload a chapter first');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setMaterial(null);
    
    try {
      // Get chapter data
      setProcessingStage('📚 Loading chapter data...');
      const chapterDoc = await getDoc(doc(db, 'textbooks', latestChapter.id));
      if (!chapterDoc.exists()) {
        throw new Error('Chapter not found');
      }
      
      const chapterData = chapterDoc.data();
      
      // Check if we already have extracted text saved
      let pdfText;
      
      const existingContent = await getDoc(doc(db, 'aiGeneratedContent', latestChapter.id));
      if (existingContent.exists() && existingContent.data().extractedText) {
        console.log('Using previously extracted text from database');
        pdfText = existingContent.data().extractedText;
      } else {
        // Need to extract text from PDF
        setProcessingStage('📥 Downloading PDF from GitHub...');
        console.log('Chapter data:', chapterData);
        console.log('PDF URL:', chapterData.pdfURL);
        
        try {
          const response = await fetch(chapterData.pdfURL);
          console.log('GitHub fetch response:', response.status, response.ok);
          
          if (!response.ok) {
            throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`);
          }
          
          const pdfBlob = await response.blob();
          console.log('PDF blob size:', pdfBlob.size, 'bytes');
          
          if (pdfBlob.size < 1000) {
            throw new Error('PDF file too small - may be corrupted or inaccessible');
          }
          
          const pdfFile = new File([pdfBlob], 'chapter.pdf', { type: 'application/pdf' });
          
          // Extract text from PDF
          setProcessingStage('📄 Extracting text from PDF...');
          pdfText = await extractTextFromPDF(pdfFile);
          console.log('Text extracted, length:', pdfText.length);
          console.log('First 500 chars:', pdfText.substring(0, 500));
        } catch (err) {
          console.error('PDF download/extraction error:', err);
          throw new Error(`Unable to process PDF: ${err.message}. Please try re-uploading the chapter PDF.`);
        }
      }
      console.log('First 200 chars:', pdfText.substring(0, 200));
      
      // Check if extraction failed (getting watermark text only)
      if (pdfText.length < 100 || pdfText.includes('Downloaded from') && pdfText.split('Downloaded from').length > 5) {
        // Ask teacher to paste the text manually
        const manualText = prompt(
          'PDF text extraction failed (possibly a scanned PDF or has watermarks).\n\n' +
          'Please copy and paste the chapter text here to generate study materials:\n\n' +
          '(Or click Cancel to abort)'
        );
        
        if (!manualText || manualText.trim().length < 100) {
          throw new Error('PDF text extraction failed. The PDF may be:\n' +
            '1. A scanned image (not text-based)\n' +
            '2. Password protected\n' +
            '3. Has watermarks blocking text\n\n' +
            'Please use a text-based PDF or paste the chapter content manually.');
        }
        
        pdfText = manualText.trim();
        console.log('Using manually provided text, length:', pdfText.length);
      }
      
      // Generate AI content
      setProcessingStage('🤖 Generating AI content (notes, quiz)...');
      const aiContent = await generateStudyMaterial(pdfText, null, chapterData.chapterName, chapterData.class, chapterData.subject);
      console.log('AI content generated:', {
        notesLength: aiContent.notesText?.length || 0,
        quizCount: aiContent.quizData?.length || 0
      });
      
      // Save to Firestore
      setProcessingStage('💾 Saving generated content to database...');
      console.log('Saving quiz data:', aiContent.quizData);
      
      // Save to aiGeneratedContent collection
      await setDoc(doc(db, 'aiGeneratedContent', latestChapter.id), {
        textbookId: latestChapter.id,
        chapterName: chapterData.chapterName,
        class: chapterData.class,
        classNumber: chapterData.class,
        subject: chapterData.subject,
        notes: aiContent.notesText,
        youtubeVideos: [],
        quiz: aiContent.quizData || [],
        generatedAt: new Date().toISOString(),
        pdfTextLength: pdfText.length,
        extractedText: pdfText.substring(0, 50000) // Save first 50k chars (enough for most chapters)
      });
      
      // Also save to studyMaterial collection for EduTube panel
      await setDoc(doc(db, 'studyMaterial', latestChapter.id), {
        textbookId: latestChapter.id,
        chapterName: chapterData.chapterName,
        class: chapterData.class,
        subject: chapterData.subject,
        youtubeVideos: [],
        generatedAt: new Date().toISOString()
      });
      console.log('Saved to Firestore with', aiContent.quizData?.length || 0, 'quiz questions');
      
      setMaterial(aiContent);
      setSuccess(`✅ Generated ${aiContent.quizData?.length || 0} quiz questions!`);
      setProcessingStage('');
      setHasExistingContent(true);

      if (onMaterialGenerated) {
        onMaterialGenerated(aiContent);
      }
    } catch (err) {
      console.error('Generation error:', err);
      console.error('Error stack:', err.stack);
      console.error('Error details:', {
        message: err.message,
        name: err.name,
        code: err.code
      });
      setError('Failed to generate material: ' + (err.message || 'Unknown error. Check console for details.'));
      setProcessingStage('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>AI Study Material Generator</h3>
        <p style={styles.subtitle}>Upload a textbook chapter first, then AI will automatically generate study materials</p>
      </div>

      {hasExistingContent && (
        <div style={styles.warningBox}>
          ⚠️ AI content already exists for this chapter. Generating again will overwrite it.
        </div>
      )}

      {loading && (
        <div style={styles.loadingBox}>
          <div style={styles.spinner}></div>
          <p style={styles.processingText}>{processingStage || 'Processing...'}</p>
          <small style={styles.loadingHint}>This may take 1-2 minutes for AI content generation</small>
        </div>
      )}

      <button
        onClick={handleGenerateMaterial}
        disabled={loading || chapters.length === 0}
        style={{
          ...styles.button,
          opacity: loading || chapters.length === 0 ? 0.6 : 1,
          cursor: loading || chapters.length === 0 ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? '⏳ Generating...' : chapters.length === 0 ? '📚 Upload a chapter first' : '🤖 Generate Study Material for Latest Upload'}
      </button>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      {material && (
        <div style={styles.materialContainer}>
          <div style={styles.materialSection}>
            <h4>📝 Generated Notes:</h4>
            <p style={styles.materialText}>{material.notes?.substring(0, 500)}...</p>
          </div>

          <div style={styles.materialSection}>
            <h4>📊 Quiz Questions: ({material.quiz?.length || material.questions?.length} questions)</h4>
            <ul style={styles.list}>
              {(material.quiz || material.questions)?.slice(0, 3).map((q, idx) => (
                <li key={idx}>{q.question}</li>
              ))}
            </ul>
          </div>


        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: 'white',
    border: '1px solid #e2e8f0',
    padding: '24px',
    borderRadius: '12px',
    marginBottom: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
  },
  header: {
    marginBottom: '20px'
  },
  title: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#1a202c',
    margin: '0 0 8px 0'
  },
  subtitle: {
    fontSize: '14px',
    color: '#718096',
    margin: 0
  },
  formGroup: {
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '8px'
  },
  select: {
    width: '100%',
    padding: '10px',
    fontSize: '14px',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    fontFamily: 'inherit',
    backgroundColor: 'white',
    cursor: 'pointer'
  },
  warningBox: {
    padding: '12px 16px',
    backgroundColor: '#fef3c7',
    border: '1px solid #fbbf24',
    borderRadius: '8px',
    color: '#92400e',
    fontSize: '14px',
    marginBottom: '16px'
  },
  loadingBox: {
    padding: '20px',
    backgroundColor: '#f0f9ff',
    border: '2px solid #3b82f6',
    borderRadius: '12px',
    textAlign: 'center',
    marginBottom: '16px'
  },
  spinner: {
    width: '40px',
    height: '40px',
    margin: '0 auto 12px',
    border: '4px solid #e5e7eb',
    borderTop: '4px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  processingText: {
    margin: '8px 0',
    fontSize: '15px',
    fontWeight: '600',
    color: '#1e40af'
  },
  loadingHint: {
    color: '#6b7280',
    fontSize: '12px'
  },
  button: {
    width: '100%',
    padding: '14px 24px',
    backgroundColor: '#7c3aed',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '16px',
    transition: 'all 0.3s ease',
    marginBottom: '16px'
  },
  deleteButton: {
    marginTop: '10px',
    padding: '10px 16px',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '500',
    fontSize: '14px',
    transition: 'all 0.3s ease'
  },
  error: {
    padding: '12px 16px',
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    borderRadius: '8px',
    marginTop: '12px',
    fontSize: '14px',
    border: '1px solid #fca5a5'
  },
  success: {
    padding: '12px 16px',
    backgroundColor: '#d1fae5',
    color: '#065f46',
    borderRadius: '8px',
    marginTop: '12px',
    fontSize: '14px',
    border: '1px solid #6ee7b7'
  },
  materialContainer: {
    marginTop: '24px',
    padding: '20px',
    backgroundColor: '#f9fafb',
    borderRadius: '10px',
    border: '1px solid #e5e7eb'
  },
  materialSection: {
    marginBottom: '20px',
    paddingBottom: '20px',
    borderBottom: '1px solid #e5e7eb'
  },
  materialText: {
    fontSize: '14px',
    color: '#374151',
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap'
  },
  list: {
    margin: '8px 0',
    paddingLeft: '20px',
    fontSize: '14px',
    color: '#4b5563',
    lineHeight: '1.8'
  }
};
