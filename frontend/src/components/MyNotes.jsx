import React, { useState, useEffect, useRef, useMemo } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { getThemedStyles } from '../styles/theme';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { logActivity } from '../services/firestoreService';
import { safeLocalStorage } from '../utils/storage';
import { warningToast, successToast } from '../utils/toast';
import { jsPDF } from 'jspdf';
import { QAForum } from './QAForum';
import { speak, stopSpeaking } from '../utils/browserTTS';

export const MyNotes = ({ selectedSubject }) => {
  const { userData, user } = useAuth();
  const [expandedChapter, setExpandedChapter] = useState(null);
  const [aiNotes, setAiNotes] = useState([]);
  const [teacherNotes, setTeacherNotes] = useState([]);
  const [personalNotes, setPersonalNotes] = useState([]);
  const [newNote, setNewNote] = useState({ title: '', content: '' });
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ai'); // 'ai', 'teacher', or 'personal'
  const [expandedQA, setExpandedQA] = useState(null);

  // Theme-aware styles
  const { theme: currentTheme, isDark } = useTheme();
  const themedStyles = useMemo(() => getThemedStyles(currentTheme), [currentTheme]);

  // Text-to-Speech state
  const [speaking, setSpeaking] = useState(false);
  const [currentSpeakingId, setCurrentSpeakingId] = useState(null);

  // Log activity when reading notes
  useEffect(() => {
    if (expandedChapter && userData?.uid) {
      // Log when opening a chapter to read notes
      logActivity(userData.uid, selectedSubject, 'notes_read').catch(console.error);

      // Log every 5 minutes while chapter is open
      const activityInterval = setInterval(() => {
        if (expandedChapter) {
          logActivity(userData.uid, selectedSubject, 'notes_ongoing_read').catch(console.error);
        }
      }, 5 * 60 * 1000);

      return () => clearInterval(activityInterval);
    }
  }, [expandedChapter, userData, selectedSubject]);

  useEffect(() => {
    let cancelled = false;
    const fetchAIGeneratedNotes = async () => {
      const userClass = userData?.class || userData?.classNumber;
      if (!userClass) {
        console.log('No class data available:', userData);
        return;
      }

      try {
        setLoading(true);
        const userClassInt = parseInt(userClass);
        console.log('Fetching AI notes for class:', userClassInt, 'subject:', selectedSubject);

        // Query by class (integer) and subject
        let q = query(
          collection(db, 'aiGeneratedContent'),
          where('class', '==', userClassInt),
          where('subject', '==', selectedSubject)
        );
        let snapshot = await getDocs(q);
        console.log('Found', snapshot.docs.length, 'documents with class (int) + subject filter');

        // If no results, try with string class
        if (snapshot.docs.length === 0) {
          console.log('Trying with string class...');
          q = query(
            collection(db, 'aiGeneratedContent'),
            where('class', '==', String(userClass)),
            where('subject', '==', selectedSubject)
          );
          snapshot = await getDocs(q);
          console.log('Found', snapshot.docs.length, 'documents with class (string) + subject filter');
        }

        // If no results, try with 'classNumber' field (integer)
        if (snapshot.docs.length === 0) {
          console.log('Trying with classNumber field (int)...');
          q = query(
            collection(db, 'aiGeneratedContent'),
            where('classNumber', '==', userClassInt),
            where('subject', '==', selectedSubject)
          );
          snapshot = await getDocs(q);
          console.log('Found', snapshot.docs.length, 'documents with classNumber (int) + subject filter');
        }

        // If still no results, fetch all and filter in code
        if (snapshot.docs.length === 0) {
          console.log('No filtered results. Fetching documents matching subject and filtering...');
          const subQ = query(
            collection(db, 'aiGeneratedContent'),
            where('subject', '==', selectedSubject)
          );
          const allSnapshot = await getDocs(subQ);
          console.log('Total subject-matching documents in aiGeneratedContent:', allSnapshot.docs.length);

          // Log first few for debugging
          allSnapshot.docs.slice(0, 3).forEach(doc => {
            const data = doc.data();
            console.log('Sample doc:', {
              id: doc.id,
              class: data.class,
              classType: typeof data.class,
              classNumber: data.classNumber,
              subject: data.subject,
              chapterName: data.chapterName
            });
          });

          // Filter by class and subject in code
          snapshot = {
            docs: allSnapshot.docs.filter(doc => {
              const data = doc.data();
              const docClass = data.class || data.classNumber;
              const classMatch = String(docClass) === String(userClass);
              const subjectMatch = data.subject === selectedSubject;
              return classMatch && subjectMatch;
            })
          };

          console.log('After manual filter:', snapshot.docs.length, 'documents');
        }

        const schoolName = userData?.schoolName;
        const isDeveloper = userData?.role === 'developer';

        const notesData = snapshot.docs
          .filter(doc => {
            if (isDeveloper || !schoolName) return true;
            const docSchool = doc.data().schoolName;
            return !docSchool || docSchool === schoolName;
          })
          .map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              chapterName: data.chapterName || 'Untitled',
              subject: data.subject || 'General',
              notes: data.notes || 'No notes available',
              generatedAt: data.generatedAt,
              type: 'ai'
            };
          });

        console.log('Loaded', notesData.length, 'AI notes for', selectedSubject);
        if (!cancelled) setAiNotes(notesData);
      } catch (error) {
        console.error('Error fetching AI notes:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAIGeneratedNotes();
    return () => { cancelled = true; };
  }, [userData?.class, userData?.classNumber, selectedSubject]);

  useEffect(() => {
    let cancelled = false;
    const fetchTeacherNotes = async () => {
      const userClass = userData?.class || userData?.classNumber;
      if (!userClass) {
        console.log('No class data available for teacher notes');
        return;
      }

      try {
        const userClassInt = parseInt(userClass);
        console.log('Fetching teacher notes for class:', userClassInt, 'subject:', selectedSubject);

        // Try with integer class first
        let q = query(
          collection(db, 'teacherNotes'),
          where('class', '==', userClassInt),
          where('subject', '==', selectedSubject)
        );
        let snapshot = await getDocs(q);
        console.log('Found', snapshot.docs.length, 'teacher notes with class (int) + subject filter');

        // If no results, try with string class
        if (snapshot.docs.length === 0) {
          console.log('Trying teacher notes with string class...');
          q = query(
            collection(db, 'teacherNotes'),
            where('class', '==', String(userClass)),
            where('subject', '==', selectedSubject)
          );
          snapshot = await getDocs(q);
          console.log('Found', snapshot.docs.length, 'teacher notes with class (string) + subject filter');
        }

        // If still no results, fetch all and filter manually
        if (snapshot.docs.length === 0) {
          console.log('No filtered results for teacher notes. Fetching documents matching subject and filtering...');
          const subQ = query(
            collection(db, 'teacherNotes'),
            where('subject', '==', selectedSubject)
          );
          const allSnapshot = await getDocs(subQ);
          console.log('Total subject-matching teacher notes documents:', allSnapshot.docs.length);

          // Filter manually
          const filtered = allSnapshot.docs.filter(doc => {
            const data = doc.data();
            const docClass = data.class;
            const classMatches = (docClass === userClassInt || docClass === String(userClass));
            const subjectMatches = data.subject === selectedSubject;

            if (classMatches && subjectMatches) {
              console.log('Manually matched teacher note:', {
                id: doc.id,
                class: data.class,
                subject: data.subject,
                chapterName: data.chapterName
              });
            }

            return classMatches && subjectMatches;
          });

          snapshot = { docs: filtered };
        }

        const schoolName = userData?.schoolName;
        const isDeveloper = userData?.role === 'developer';

        const notesData = snapshot.docs
          .filter(doc => {
            if (isDeveloper || !schoolName) return true;
            const docSchool = doc.data().schoolName;
            return !docSchool || docSchool === schoolName;
          })
          .map(doc => ({
            id: doc.id,
            ...doc.data(),
            type: 'teacher'
          }));

        console.log('Loaded', notesData.length, 'teacher notes for', selectedSubject);
        if (!cancelled) setTeacherNotes(notesData);
      } catch (error) {
        console.error('Error fetching teacher notes:', error);
      }
    };

    fetchTeacherNotes();
    return () => { cancelled = true; };
  }, [userData?.class, userData?.classNumber, selectedSubject]);

  // Load personal notes from localStorage on mount
  useEffect(() => {
    const savedNotes = safeLocalStorage.get('studentNotes');
    if (savedNotes) {
      setPersonalNotes(savedNotes);
    }
  }, []);

  // Save personal notes to localStorage whenever they change
  useEffect(() => {
    if (personalNotes.length > 0) {
      safeLocalStorage.set('studentNotes', personalNotes);
    }
  }, [personalNotes]);

  const handleAddNote = () => {
    if (!newNote.title.trim() || !newNote.content.trim()) {
      warningToast('Please enter both title and content');
      return;
    }

    const note = {
      id: Date.now(),
      chapterName: newNote.title,
      notes: newNote.content,
      createdAt: new Date().toISOString(),
      type: 'personal'
    };

    setPersonalNotes([note, ...personalNotes]);
    setNewNote({ title: '', content: '' });
    setIsAdding(false);
  };

  const handleDeleteNote = (id) => {
    if (window.confirm('Delete this note?')) {
      setPersonalNotes(personalNotes.filter(n => n.id !== id));
    }
  };

  // Text-to-Speech functions
  const handleSpeak = async (text, noteId) => {
    if (!text) return;

    if (currentSpeakingId === noteId && speaking) {
      stopSpeaking();
      setSpeaking(false);
      setCurrentSpeakingId(null);
      return;
    }

    // Stop any current speech
    stopSpeaking();
    setSpeaking(true);
    setCurrentSpeakingId(noteId);

    // Clean text from markdown and special characters
    const cleanText = text
      .replace(/#{1,6}\s/g, '') // Remove headers
      .replace(/\*\*/g, '') // Remove bold markers
      .replace(/\*/g, '') // Remove italic markers
      .replace(/`/g, '') // Remove code markers
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links but keep text
      .replace(/\n\n/g, '. ') // Replace double line breaks with periods
      .replace(/\n/g, ' '); // Replace single line breaks with spaces

    // Use our safe robust wrapper instead of direct SpeechSynthesisUtterance
    await speak(cleanText, { rate: 0.9, preferFemale: true });

    setSpeaking(false);
    setCurrentSpeakingId(null);
  };

  // Cleanup speech on unmount
  useEffect(() => {
    return () => stopSpeaking();
  }, []);

  const handleDownloadPDF = (note, e) => {
    e.stopPropagation();
    try {
      const doc = new jsPDF();
      
      doc.setFontSize(18);
      doc.setTextColor(0, 0, 0);
      const titleLines = doc.splitTextToSize(note.chapterName || 'Untitled Notes', 170);
      doc.text(titleLines, 20, 20);
      
      let currentY = 20 + (titleLines.length * 10);
      
      doc.setFontSize(11);
      doc.setTextColor(100, 100, 100);
      doc.text(`Subject: ${note.subject || 'General'} | Source: ${note.type === 'ai' ? 'AI Generated' : note.type === 'teacher' ? 'Teacher Notes' : 'Personal'}`, 20, currentY);
      
      currentY += 15;
      
      const cleanText = (note.notes || '')
        .replace(/#{1,6}\s/g, '') // Remove headers hashes
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
        .replace(/\*(.*?)\*/g, '$1') // Remove italic
        .replace(/`(.*?)`/g, '$1');
        
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      
      const splitText = doc.splitTextToSize(cleanText, 170);
      
      for (let i = 0; i < splitText.length; i++) {
        if (currentY > 280) {
          doc.addPage();
          currentY = 20;
        }
        doc.text(splitText[i], 20, currentY);
        currentY += 7;
      }
      
      doc.save(`${(note.chapterName || 'Notes').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}.pdf`);
      successToast('PDF Downloaded successfully!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      warningToast('Failed to generate PDF');
    }
  };

  const currentNotes = activeTab === 'ai' ? aiNotes : activeTab === 'teacher' ? teacherNotes : personalNotes;

  // Dynamic container style based on theme
  const containerStyle = {
    ...styles.container,
    background: themedStyles.card.background,
    border: `1px solid ${themedStyles.border.default}`,
    color: themedStyles.text.primary
  };

  return (
    <div style={containerStyle}>
      <div style={{ marginBottom: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <div>
            <h3 style={{ margin: '0 0 5px 0', color: themedStyles.text.primary }}>📚 My Notes</h3>
            <p style={{ ...styles.subtitle, color: themedStyles.text.muted }}>AI-generated notes, teacher notes, and video notes.</p>
          </div>
          {activeTab === 'personal' && !isAdding && (
            <button onClick={() => setIsAdding(true)} style={styles.addButton}>
              ➕ Create Note
            </button>
          )}
        </div>

        {/* Tab Buttons */}
        <div style={styles.tabContainer}>
          <button
            onClick={() => setActiveTab('ai')}
            style={activeTab === 'ai' ? styles.activeTabButton : styles.tabButton}
          >
            🤖 AI Generated ({aiNotes.length})
          </button>
          <button
            onClick={() => setActiveTab('teacher')}
            style={activeTab === 'teacher' ? styles.activeTabButton : styles.tabButton}
          >
            ✍️ Teacher Notes ({teacherNotes.length})
          </button>
          <button
            onClick={() => setActiveTab('personal')}
            style={activeTab === 'personal' ? styles.activeTabButton : styles.tabButton}
          >
            📝 My Notes ({personalNotes.length})
          </button>
        </div>
      </div>

      {activeTab === 'personal' && isAdding && (
        <div style={{
          ...styles.addNoteForm,
          backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f9fafb',
          borderColor: '#8b5cf6',
          padding: '20px',
          borderRadius: '12px',
          marginBottom: '20px',
          border: '2px solid #8b5cf6'
        }}>
          <input
            type="text"
            placeholder="Note Title (e.g., Chapter 1: Physics)"
            value={newNote.title}
            onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
            style={{
              ...styles.input,
              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.8)' : 'white',
              color: themedStyles.text.primary,
              borderColor: themedStyles.border.default,
              width: '100%',
              padding: '12px',
              marginBottom: '12px',
              borderRadius: '6px',
              fontSize: '14px',
              boxSizing: 'border-box'
            }}
          />
          <textarea
            placeholder="Write your notes here..."
            value={newNote.content}
            onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
            style={{
              ...styles.textarea,
              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.8)' : 'white',
              color: themedStyles.text.primary,
              borderColor: themedStyles.border.default,
              width: '100%',
              padding: '12px',
              marginBottom: '8px',
              borderRadius: '6px',
              fontSize: '14px',
              fontFamily: 'monospace',
              resize: 'vertical',
              boxSizing: 'border-box'
            }}
            rows="6"
          />
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleAddNote} style={styles.saveButton}>
              💾 Save Note
            </button>
            <button onClick={() => {
              setIsAdding(false);
              setNewNote({ title: '', content: '' });
            }} style={styles.cancelButton}>
              ❌ Cancel
            </button>
          </div>
        </div>
      )}

      {loading && activeTab === 'ai' ? (
        <div style={styles.loadingState}>
          <p>⏳ Loading AI-generated notes...</p>
        </div>
      ) : (
        <div style={styles.notesList}>
          {currentNotes.length === 0 ? (
            <div style={styles.emptyState}>
              {activeTab === 'ai' ? (
                <p>🤖 No AI-generated notes yet. Your teacher needs to upload textbooks and generate study materials!</p>
              ) : activeTab === 'teacher' ? (
                <p>✍️ No teacher notes yet. Your teacher hasn't uploaded any notes for your class!</p>
              ) : (
                <div>
                  <p>📝 No personal notes yet. Create your first note!</p>
                  <button onClick={() => setIsAdding(true)} style={styles.addButton}>
                    ➕ Create Your First Note
                  </button>
                </div>
              )}
            </div>
          ) : (
            currentNotes.map((note) => (
              <div key={note.id} style={styles.noteItem}>
                <div
                  style={styles.noteHeader}
                  onClick={() => setExpandedChapter(expandedChapter === note.id ? null : note.id)}
                >
                  <div>
                    <h4 style={styles.chapterName} className="chapter-name-light-bg">
                      {note.type === 'ai' ? '🤖 ' : note.type === 'teacher' ? '✍️ ' : '📝 '}
                      {note.chapterName}
                    </h4>
                    {note.subject && (
                      <span style={styles.subjectTag}>{note.subject}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {expandedChapter === note.id && (
                      <>
                        <button
                          onClick={(e) => handleDownloadPDF(note, e)}
                          style={{
                            ...styles.speakButtonCompact,
                            backgroundColor: 'rgba(59, 130, 246, 0.2)',
                            color: '#60a5fa'
                          }}
                          title="Download as PDF"
                        >
                          📄
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSpeak(note.notes, note.id);
                          }}
                          style={{
                            ...styles.speakButtonCompact,
                            ...(currentSpeakingId === note.id && speaking ? styles.speakButtonActive : {})
                          }}
                          title={currentSpeakingId === note.id && speaking ? "Stop speaking" : "Listen to notes"}
                        >
                          {currentSpeakingId === note.id && speaking ? '⏸️' : '🔊'}
                        </button>
                      </>
                    )}
                    <span style={styles.expandIcon}>
                      {expandedChapter === note.id ? '▼' : '▶'}
                    </span>
                  </div>
                </div>
                {expandedChapter === note.id && (
                  <div style={{
                    ...styles.noteContent,
                    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.4)' : '#ffffff',
                    borderTopColor: themedStyles.border.default
                  }}>
                    <div style={{
                      ...styles.notesText,
                      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : '#ffffff',
                      color: themedStyles.text.primary,
                      border: `1px solid ${themedStyles.border.default}`
                    }}>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          h1: ({ node, ...props }) => <h1 style={{ ...styles.h1, color: isDark ? '#60a5fa' : '#2563eb', borderBottomColor: isDark ? 'rgba(96, 165, 250, 0.3)' : '#2563eb' }} {...props} />,
                          h2: ({ node, ...props }) => <h2 style={{ ...styles.h2, color: isDark ? '#93c5fd' : '#3b82f6', borderLeftColor: '#3b82f6' }} {...props} />,
                          h3: ({ node, ...props }) => <h3 style={{ ...styles.h3, color: isDark ? '#bfdbfe' : '#1e40af' }} {...props} />,
                          p: ({ node, ...props }) => <p style={{ ...styles.paragraph, color: themedStyles.text.secondary }} {...props} />,
                          ul: ({ node, ...props }) => <ul style={{ ...styles.ul, color: themedStyles.text.secondary }} {...props} />,
                          ol: ({ node, ...props }) => <ol style={{ ...styles.ol, color: themedStyles.text.secondary }} {...props} />,
                          li: ({ node, ...props }) => <li style={{ ...styles.li, color: themedStyles.text.secondary }} {...props} />,
                          strong: ({ node, ...props }) => <strong style={{ ...styles.strong, color: isDark ? '#60a5fa' : '#6200ea', backgroundColor: isDark ? 'rgba(96, 165, 250, 0.1)' : '#f3e5f5' }} {...props} />,
                          em: ({ node, ...props }) => <em style={{ ...styles.em, color: isDark ? '#93c5fd' : '#555' }} {...props} />,
                          code: ({ node, inline, ...props }) =>
                            inline ?
                              <code style={{ ...styles.inlineCode, backgroundColor: isDark ? 'rgba(96, 165, 250, 0.1)' : '#f5f5f5', color: isDark ? '#bfdbfe' : '#d32f2f', borderColor: themedStyles.border.default }} {...props} /> :
                              <code style={{ ...styles.blockCode, backgroundColor: isDark ? 'rgba(15, 23, 42, 0.8)' : '#282c34', color: isDark ? '#e2e8f0' : '#abb2bf' }} {...props} />,
                          blockquote: ({ node, ...props }) => <blockquote style={{ ...styles.blockquote, borderLeftColor: '#ffc107', backgroundColor: isDark ? 'rgba(255, 193, 7, 0.05)' : '#fffbf0', color: themedStyles.text.muted }} {...props} />
                        }}
                      >
                        {note.notes}
                      </ReactMarkdown>
                    </div>

                    {note.type !== 'personal' && (
                      <div style={{ marginTop: '16px', marginBottom: '12px' }}>
                        <button
                          onClick={() => setExpandedQA(expandedQA === note.id ? null : note.id)}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '10px',
                            color: '#cbd5e1',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontWeight: '700',
                            fontSize: '13px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: expandedQA === note.id ? '10px' : '0',
                            outline: 'none'
                          }}
                        >
                          <span>💬 Chapter Discussion Forum</span>
                          <span>{expandedQA === note.id ? '▲ Hide' : '▼ Show'}</span>
                        </button>
                        {expandedQA === note.id && (
                          <QAForum
                            itemId={note.id}
                            userId={userData?.uid || user?.uid}
                            userName={userData?.username || userData?.name || 'Student'}
                            userRole={userData?.role || 'student'}
                            schoolName={userData?.schoolName || ''}
                          />
                        )}
                      </div>
                    )}

                    {note.type === 'personal' && (
                      <div style={styles.buttonGroup}>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          style={styles.deleteButton}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
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
    padding: '20px',
    borderRadius: '12px',
    marginBottom: '20px',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    color: '#ffffff'
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: '14px',
    margin: '0'
  },
  notesList: {
    marginTop: '15px'
  },
  noteItem: {
    border: '1px solid rgba(59, 130, 246, 0.25)',
    borderRadius: '10px',
    marginBottom: '10px',
    overflow: 'hidden',
    background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.6), rgba(15, 23, 42, 0.8))'
  },
  noteHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '15px',
    background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.5), rgba(15, 23, 42, 0.6))',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  // Chapter heading sits on the dark navy glass card — needs WHITE text to
  // be readable. The original color #000000 was leftover from a light-mode
  // design and made the chapter title invisible.
  chapterName: {
    margin: 0,
    fontSize: '15px',
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: '-0.01em',
  },
  expandIcon: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.6)'
  },
  noteContent: {
    padding: '15px',
    backgroundColor: '#ffffff',
    borderTop: '1px solid rgba(59, 130, 246, 0.2)'
  },
  notesText: {
    padding: '20px',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    fontFamily: '"Product Sans", "Google Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    overflowX: 'hidden',
    overflowY: 'auto',
    maxHeight: '600px',
    wordWrap: 'break-word',
    color: '#000000',
    border: '1px solid rgba(59, 130, 246, 0.15)'
  },
  h1: {
    color: '#2563eb',
    fontSize: '32px',
    fontWeight: '700',
    marginTop: '0',
    marginBottom: '24px',
    paddingBottom: '12px',
    borderBottom: '3px solid #2563eb',
    fontFamily: '"Product Sans", "Google Sans", -apple-system, sans-serif'
  },
  h2: {
    color: '#3b82f6',
    fontSize: '26px',
    fontWeight: '600',
    marginTop: '32px',
    marginBottom: '16px',
    paddingLeft: '12px',
    borderLeft: '4px solid #3b82f6',
    fontFamily: '"Product Sans", "Google Sans", -apple-system, sans-serif'
  },
  h3: {
    color: '#1e40af',
    fontSize: '20px',
    fontWeight: '600',
    marginTop: '24px',
    marginBottom: '12px',
    fontFamily: '"Product Sans", "Google Sans", -apple-system, sans-serif'
  },
  paragraph: {
    fontSize: '16px',
    lineHeight: '1.8',
    color: '#000000',
    marginBottom: '16px',
    textAlign: 'justify'
  },
  ul: {
    paddingLeft: '28px',
    marginBottom: '16px',
    listStyleType: 'disc',
    color: '#000000'
  },
  ol: {
    paddingLeft: '28px',
    marginBottom: '16px',
    color: '#000000'
  },
  li: {
    fontSize: '15px',
    lineHeight: '1.7',
    color: '#000000',
    marginBottom: '8px',
    display: 'list-item'
  },
  strong: {
    fontWeight: '700',
    color: '#6200ea',
    backgroundColor: '#f3e5f5',
    padding: '2px 6px',
    borderRadius: '3px'
  },
  em: {
    fontStyle: 'italic',
    color: '#555'
  },
  inlineCode: {
    backgroundColor: '#f5f5f5',
    color: '#d32f2f',
    padding: '3px 6px',
    borderRadius: '4px',
    fontSize: '14px',
    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
    border: '1px solid #e0e0e0'
  },
  blockCode: {
    display: 'block',
    backgroundColor: '#282c34',
    color: '#abb2bf',
    padding: '16px',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
    overflowX: 'auto',
    marginBottom: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    maxWidth: '100%',
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap'
  },
  blockquote: {
    borderLeft: '4px solid #ffc107',
    backgroundColor: '#fffbf0',
    padding: '12px 16px',
    margin: '16px 0',
    fontStyle: 'italic',
    color: '#666',
    borderRadius: '4px'
  },
  noteLine: {
    margin: '8px 0',
    fontSize: '14px',
    lineHeight: '1.6',
    color: '#333'
  },
  subjectTag: {
    display: 'inline-block',
    padding: '4px 8px',
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
    color: '#60a5fa',
    borderRadius: '4px',
    fontSize: '12px',
    marginTop: '5px',
    fontWeight: '500'
  },
  tabContainer: {
    display: 'flex',
    gap: '10px',
    borderBottom: '2px solid rgba(59, 130, 246, 0.3)',
    paddingBottom: '10px'
  },
  tabButton: {
    padding: '8px 16px',
    background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.5), rgba(15, 23, 42, 0.6))',
    color: 'rgba(255, 255, 255, 0.7)',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    borderRadius: '6px 6px 0 0',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s'
  },
  activeTabButton: {
    padding: '8px 16px',
    background: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
    color: 'white',
    border: 'none',
    borderRadius: '6px 6px 0 0',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)'
  },
  loadingState: {
    textAlign: 'center',
    padding: '40px',
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '15px'
  },
  downloadButton: {
    marginTop: '10px',
    padding: '8px 16px',
    background: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  },
  deleteButton: {
    padding: '8px 16px',
    backgroundColor: '#f44336',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    marginLeft: '10px'
  },
  speakButton: {
    padding: '8px 16px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s ease'
  },
  speakButtonCompact: {
    padding: '6px 10px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '500',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    minWidth: '36px',
    height: '36px'
  },
  speakButtonActive: {
    backgroundColor: '#059669',
    animation: 'pulse 1.5s ease-in-out infinite'
  },
  buttonGroup: {
    display: 'flex',
    marginTop: '15px'
  },
  addButton: {
    padding: '8px 16px',
    background: 'linear-gradient(135deg, #ff0080, #40e0d0)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600'
  },
  addNoteForm: {
    background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.6), rgba(15, 23, 42, 0.8))',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '20px',
    border: '1px solid rgba(59, 130, 246, 0.3)'
  },
  input: {
    width: '100%',
    padding: '12px',
    fontSize: '14px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '6px',
    marginBottom: '10px',
    boxSizing: 'border-box',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    color: '#ffffff'
  },
  textarea: {
    width: '100%',
    padding: '12px',
    fontSize: '14px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '6px',
    marginBottom: '10px',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    resize: 'vertical',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    color: '#ffffff'
  },
  saveButton: {
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600'
  },
  cancelButton: {
    padding: '10px 20px',
    backgroundColor: 'rgba(107, 114, 128, 0.8)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600'
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px',
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '15px'
  }
};
