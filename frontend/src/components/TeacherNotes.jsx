import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, Timestamp, updateDoc } from 'firebase/firestore';
import { extractTextFromImage } from '../services/aiService';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { getThemedStyles } from '../styles/theme';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export const TeacherNotes = ({ classNumber, subject, schoolName }) => {
  const { userData } = useAuth();
  const [expandedNote, setExpandedNote] = useState(null);
  const [aiNotes, setAiNotes] = useState([]);
  const [teacherNotes, setTeacherNotes] = useState([]);
  const [newNote, setNewNote] = useState({
    title: '',
    content: '',
    classNumber: classNumber || 6,
    subject: subject || 'Physics'
  });
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ai');
  const [editingNote, setEditingNote] = useState(null);
  const [editedContent, setEditedContent] = useState('');


  // Theme-aware styles
  const { theme: currentTheme, isDark } = useTheme();
  const themedStyles = useMemo(() => getThemedStyles(currentTheme), [currentTheme]);

  // Update newNote when classNumber or subject changes
  useEffect(() => {
    setNewNote(prev => ({
      ...prev,
      classNumber: classNumber || 6,
      subject: subject || 'Physics'
    }));
  }, [classNumber, subject]);

  // Fetch AI-generated notes
  useEffect(() => {
    const fetchAIGeneratedNotes = async () => {
      const targetClass = classNumber || 6;
      const targetSubject = subject || 'Physics';

      try {
        setLoading(true);
        console.log('Fetching AI notes for class:', targetClass, 'subject:', targetSubject);

        const isDeveloper = userData?.role === 'developer';
        const schoolFilter = isDeveloper ? [] : [where('schoolName', '==', schoolName || '')];

        let q = query(
          collection(db, 'aiGeneratedContent'),
          where('class', '==', targetClass),
          where('subject', '==', targetSubject)
        );
        let snapshot = await getDocs(q);

        if (snapshot.docs.length === 0) {
          q = query(
            collection(db, 'aiGeneratedContent'),
            where('classNumber', '==', targetClass),
            where('subject', '==', targetSubject)
          );
          snapshot = await getDocs(q);
        }

        const notesData = snapshot.docs.map(doc => {
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

        setAiNotes(notesData);
      } catch (error) {
        console.error('Error fetching AI notes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAIGeneratedNotes();
  }, [classNumber, subject]);

  // Fetch teacher-created notes (exclude lesson plans)
  useEffect(() => {
    const fetchTeacherNotes = async () => {
      try {
        const q = query(
          collection(db, 'teacherNotes'),
          where('teacherId', '==', userData?.uid)
        );
        const snapshot = await getDocs(q);

        // Filter out lesson plans (which should be in teacherLessons collection)
        const notesData = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data(),
            type: 'teacher'
          }))
          .filter(note => {
            const title = (note.chapterName || '').toLowerCase();
            // Exclude anything that looks like a lesson plan
            return !title.includes('lesson plan') && !title.includes('monthly') && !title.includes('weekly');
          });

        setTeacherNotes(notesData);
      } catch (error) {
        console.error('Error fetching teacher notes:', error);
      }
    };

    if (userData?.uid) {
      fetchTeacherNotes();
    }
  }, [userData?.uid]);

  const handleAddNote = async () => {
    if (!newNote.title.trim() || !newNote.content.trim()) {
      alert('Please enter both title and content');
      return;
    }

    try {
      const noteData = {
        teacherId: userData?.uid,
        teacherName: userData?.username || userData?.email || 'Teacher',
        chapterName: newNote.title,
        notes: newNote.content,
        class: parseInt(newNote.classNumber),
        subject: newNote.subject,
        schoolName: schoolName || '',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      const docRef = await addDoc(collection(db, 'teacherNotes'), noteData);

      setTeacherNotes([{
        id: docRef.id,
        ...noteData,
        type: 'teacher'
      }, ...teacherNotes]);

      setNewNote({
        title: '',
        content: '',
        classNumber: classNumber || 6,
        subject: subject || 'Physics'
      });
      setIsAdding(false);
      alert('✅ Note uploaded successfully! Students can now view it.');
    } catch (error) {
      console.error('Error adding note:', error);
      alert('Error uploading note. Please try again.');
    }
  };

  const handleDeleteNote = async (id) => {
    if (window.confirm('Delete this note? Students will no longer be able to view it.')) {
      try {
        await deleteDoc(doc(db, 'teacherNotes', id));
        setTeacherNotes(teacherNotes.filter(n => n.id !== id));
        alert('Note deleted successfully');
      } catch (error) {
        console.error('Error deleting note:', error);
        alert('Error deleting note');
      }
    }
  };
  const handleEditAINote = (note) => {
    setEditingNote(note.id);
    setEditedContent(note.notes);
  };

  const handleSaveAINote = async (noteId) => {
    try {
      // Update the aiGeneratedContent document in Firestore
      const noteRef = doc(db, 'aiGeneratedContent', noteId);
      await updateDoc(noteRef, {
        notes: editedContent,
        lastEditedAt: Timestamp.now(),
        editedBy: userData?.uid
      });

      // Update local state
      setAiNotes(aiNotes.map(note =>
        note.id === noteId ? { ...note, notes: editedContent } : note
      ));

      setEditingNote(null);
      setEditedContent('');
      alert('✅ Notes updated successfully! Changes will be visible to students.');
    } catch (error) {
      console.error('Error updating AI note:', error);
      alert('❌ Error updating notes. Please try again.');
    }
  };

  const handleCancelEdit = () => {
    setEditingNote(null);
    setEditedContent('');
  };
  const currentNotes = activeTab === 'ai' ? aiNotes : teacherNotes;

  return (
    <div style={{
      ...styles.container,
      backgroundColor: themedStyles.card.background,
      borderColor: themedStyles.border.default,
      color: themedStyles.text.primary
    }}>
      <div style={{ marginBottom: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <div>
            <h3 style={{ margin: '0 0 5px 0', color: themedStyles.text.primary }}>📚 Notes Management</h3>
            <p style={{ ...styles.subtitle, color: themedStyles.text.muted }}>View AI-generated notes and create your own notes for students</p>
          </div>
          {activeTab === 'teacher' && (
            <button onClick={() => setIsAdding(!isAdding)} style={styles.addButton}>
              {isAdding ? '❌ Cancel' : '➕ Create Note'}
            </button>
          )}
        </div>

        {/* Tab Buttons */}
        <div style={{ ...styles.tabContainer, borderBottomColor: themedStyles.border.default }}>
          <button
            onClick={() => setActiveTab('ai')}
            style={activeTab === 'ai' ? styles.activeTabButton : {
              ...styles.tabButton,
              backgroundColor: themedStyles.card.background,
              color: themedStyles.text.muted,
              borderColor: themedStyles.border.default
            }}
          >
            🤖 AI Generated ({aiNotes.length})
          </button>
          <button
            onClick={() => setActiveTab('teacher')}
            style={activeTab === 'teacher' ? styles.activeTabButton : {
              ...styles.tabButton,
              backgroundColor: themedStyles.card.background,
              color: themedStyles.text.muted,
              borderColor: themedStyles.border.default
            }}
          >
            ✍️ My Notes ({teacherNotes.length})
          </button>
        </div>
      </div>

      {activeTab === 'teacher' && isAdding && (
        <div style={{
          ...styles.addNoteForm,
          backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f9fafb',
          borderColor: '#8b5cf6'
        }}>
          <input
            type="text"
            placeholder="Note Title (e.g., Chapter 1: Motion)"
            value={newNote.title}
            onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
            style={{
              ...styles.input,
              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.8)' : 'white',
              color: themedStyles.text.primary,
              borderColor: themedStyles.border.default
            }}
          />
          <textarea
            placeholder="Write your notes here... (You can use Markdown formatting)"
            value={newNote.content}
            onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
            style={{
              ...styles.textarea,
              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.8)' : 'white',
              color: themedStyles.text.primary,
              borderColor: themedStyles.border.default
            }}
            rows="8"
          />
          <div style={{ ...styles.markdownHint, color: themedStyles.text.muted }}>
            💡 Tip: Use Markdown formatting - **bold**, *italic*, # Heading, - List items
          </div>
          <button onClick={handleAddNote} style={styles.saveButton}>
            📤 Upload Note to Students
          </button>
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
                <p>🤖 No AI-generated notes yet. Upload textbooks and generate study materials!</p>
              ) : (
                <p>✍️ No notes created yet. Click "Create Note" to write notes for your students!</p>
              )}
            </div>
          ) : (
            currentNotes.map((note) => (
              <div key={note.id} style={styles.noteItem}>
                <div
                  style={styles.noteHeader}
                  onClick={() => setExpandedNote(expandedNote === note.id ? null : note.id)}
                >
                  <div>
                    <h4 style={styles.chapterName} className="chapter-name-light-bg">
                      {note.type === 'ai' ? '🤖 ' : '✍️ '}
                      {note.chapterName}
                    </h4>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {note.subject && (
                        <span style={styles.subjectTag}>{note.subject}</span>
                      )}
                      {note.class && (
                        <span style={styles.classTag}>Class {note.class}</span>
                      )}
                    </div>
                  </div>
                  <span style={styles.expandIcon}>
                    {expandedNote === note.id ? '▼' : '▶'}
                  </span>
                </div>
                {expandedNote === note.id && (
                  <div style={styles.noteContent}>
                    {editingNote === note.id ? (
                      <div style={styles.editContainer}>
                        <div style={styles.editHeader}>
                          <span style={styles.editLabel}>✏️ Edit AI-Generated Notes</span>
                          <span style={styles.editHint}>Changes will be visible to all students</span>
                        </div>
                        <textarea
                          value={editedContent}
                          onChange={(e) => setEditedContent(e.target.value)}
                          style={styles.editTextarea}
                          rows="15"
                        />
                        <div style={styles.editButtonGroup}>
                          <button
                            onClick={() => handleSaveAINote(note.id)}
                            style={styles.saveEditButton}
                          >
                            ✅ Save Changes
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            style={styles.cancelEditButton}
                          >
                            ❌ Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{
                          ...styles.notesText,
                          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : '#ffffff',
                          color: themedStyles.text.primary,
                          padding: '20px',
                          borderRadius: '8px'
                        }}>
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              h1: ({ node, ...props }) => <h1 style={{ ...styles.h1, color: isDark ? '#a78bfa' : '#7c3aed', borderBottomColor: isDark ? 'rgba(167, 139, 250, 0.3)' : '#7c3aed' }} {...props} />,
                              h2: ({ node, ...props }) => <h2 style={{ ...styles.h2, color: isDark ? '#c4b5fd' : '#8b5cf6' }} {...props} />,
                              h3: ({ node, ...props }) => <h3 style={{ ...styles.h3, color: isDark ? '#ddd6fe' : '#a78bfa' }} {...props} />,
                              p: ({ node, ...props }) => <p style={{ ...styles.paragraph, color: themedStyles.text.secondary }} {...props} />,
                              ul: ({ node, ...props }) => <ul style={{ ...styles.ul, color: themedStyles.text.secondary }} {...props} />,
                              ol: ({ node, ...props }) => <ol style={{ ...styles.ol, color: themedStyles.text.secondary }} {...props} />,
                              li: ({ node, ...props }) => <li style={{ ...styles.li, color: themedStyles.text.secondary }} {...props} />,
                              strong: ({ node, ...props }) => <strong style={{ ...styles.strong, color: isDark ? '#a78bfa' : '#7c3aed' }} {...props} />,
                              em: ({ node, ...props }) => <em style={{ ...styles.em, color: isDark ? '#c4b5fd' : '#8b5cf6' }} {...props} />,
                              code: ({ node, inline, ...props }) =>
                                inline ?
                                  <code style={{ ...styles.inlineCode, backgroundColor: isDark ? 'rgba(167, 139, 250, 0.1)' : '#f3e8ff', color: isDark ? '#c4b5fd' : '#7c3aed' }} {...props} /> :
                                  <code style={{ ...styles.blockCode, backgroundColor: isDark ? 'rgba(15, 23, 42, 0.8)' : '#f3e8ff', color: isDark ? '#e2e8f0' : '#5b21b6' }} {...props} />,
                              blockquote: ({ node, ...props }) => <blockquote style={{ ...styles.blockquote, borderLeftColor: '#8b5cf6', backgroundColor: isDark ? 'rgba(139, 92, 246, 0.1)' : '#f9fafb', color: themedStyles.text.muted }} {...props} />
                            }}
                          >
                            {note.notes}
                          </ReactMarkdown>
                        </div>
                        <div style={styles.buttonGroup}>
                          {note.type === 'ai' && (
                            <button
                              onClick={() => handleEditAINote(note)}
                              style={styles.editButton}
                            >
                              ✏️ Edit Notes
                            </button>
                          )}
                          {note.type === 'teacher' && (
                            <button
                              onClick={() => handleDeleteNote(note.id)}
                              style={styles.deleteButton}
                            >
                              🗑️ Delete Note
                            </button>
                          )}
                        </div>
                      </>
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
    backgroundColor: 'white',
    border: '1px solid #ddd',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '20px'
  },
  subtitle: {
    color: '#000000',
    fontSize: '14px',
    margin: '0'
  },
  tabContainer: {
    display: 'flex',
    gap: '10px',
    borderBottom: '2px solid #eee',
    paddingBottom: '10px'
  },
  tabButton: {
    padding: '8px 16px',
    border: '1px solid #ddd',
    backgroundColor: 'white',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.3s ease'
  },
  activeTabButton: {
    padding: '8px 16px',
    border: '1px solid #8b5cf6',
    backgroundColor: '#f3e8ff',
    color: '#8b5cf6',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600'
  },
  addButton: {
    padding: '10px 20px',
    backgroundColor: '#8b5cf6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'background-color 0.3s ease'
  },
  addNoteForm: {
    backgroundColor: '#f9fafb',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '20px',
    border: '2px solid #8b5cf6'
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '15px',
    marginBottom: '15px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column'
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    marginBottom: '5px',
    color: '#374151'
  },
  select: {
    padding: '10px',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    fontSize: '14px',
    backgroundColor: 'white'
  },
  input: {
    width: '100%',
    padding: '12px',
    marginBottom: '12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    boxSizing: 'border-box'
  },
  textarea: {
    width: '100%',
    padding: '12px',
    marginBottom: '8px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: 'monospace',
    resize: 'vertical',
    boxSizing: 'border-box'
  },
  markdownHint: {
    fontSize: '12px',
    color: '#6b7280',
    marginBottom: '12px',
    fontStyle: 'italic'
  },
  saveButton: {
    padding: '12px 24px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600'
  },
  notesList: {
    marginTop: '15px'
  },
  noteItem: {
    border: '1px solid #eee',
    borderRadius: '6px',
    marginBottom: '10px',
    overflow: 'hidden'
  },
  noteHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '15px',
    backgroundColor: '#f9fafb',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  chapterName: {
    margin: '0 0 5px 0',
    fontSize: '16px',
    color: '#000000',
    fontWeight: '600'
  },
  subjectTag: {
    display: 'inline-block',
    padding: '4px 10px',
    backgroundColor: '#dbeafe',
    color: '#1e40af',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '500'
  },
  classTag: {
    display: 'inline-block',
    padding: '4px 10px',
    backgroundColor: '#fce7f3',
    color: '#9f1239',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '500'
  },
  expandIcon: {
    fontSize: '14px',
    color: '#6b7280'
  },
  noteContent: {
    padding: '20px',
    backgroundColor: 'white'
  },
  notesText: {
    lineHeight: '1.8',
    color: '#1f2937'
  },
  buttonGroup: {
    marginTop: '20px',
    paddingTop: '15px',
    borderTop: '1px solid #e5e7eb',
    display: 'flex',
    gap: '10px'
  },
  editButton: {
    padding: '8px 16px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  },
  deleteButton: {
    padding: '8px 16px',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  editContainer: {
    padding: '20px',
    backgroundColor: '#f8fafc'
  },
  editHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px',
    paddingBottom: '10px',
    borderBottom: '2px solid #e2e8f0'
  },
  editLabel: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1e293b'
  },
  editHint: {
    fontSize: '12px',
    color: '#64748b',
    fontStyle: 'italic'
  },
  editTextarea: {
    width: '100%',
    padding: '15px',
    fontSize: '14px',
    fontFamily: 'monospace',
    border: '2px solid #cbd5e1',
    borderRadius: '8px',
    resize: 'vertical',
    backgroundColor: 'white',
    lineHeight: '1.6',
    boxSizing: 'border-box'
  },
  editButtonGroup: {
    marginTop: '15px',
    display: 'flex',
    gap: '10px'
  },
  saveEditButton: {
    padding: '10px 20px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600'
  },
  cancelEditButton: {
    padding: '10px 20px',
    backgroundColor: '#6b7280',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600'
  },
  loadingState: {
    textAlign: 'center',
    padding: '40px',
    color: '#6b7280'
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px',
    color: '#6b7280',
    backgroundColor: '#f9fafb',
    borderRadius: '8px'
  },
  // Markdown styles
  h1: {
    fontSize: '28px',
    fontWeight: '700',
    marginTop: '24px',
    marginBottom: '16px',
    color: '#7c3aed',
    fontFamily: '"Product Sans", "Google Sans", -apple-system, sans-serif',
    borderBottom: '3px solid #7c3aed',
    paddingBottom: '8px'
  },
  h2: {
    fontSize: '24px',
    fontWeight: '600',
    marginTop: '20px',
    marginBottom: '12px',
    color: '#8b5cf6',
    fontFamily: '"Product Sans", "Google Sans", -apple-system, sans-serif'
  },
  h3: {
    fontSize: '20px',
    fontWeight: '600',
    marginTop: '16px',
    marginBottom: '10px',
    color: '#a78bfa',
    fontFamily: '"Product Sans", "Google Sans", -apple-system, sans-serif'
  },
  paragraph: {
    fontSize: '16px',
    lineHeight: '1.8',
    marginBottom: '12px',
    color: '#374151',
    fontFamily: '"Product Sans", "Google Sans", -apple-system, sans-serif'
  },
  ul: {
    marginLeft: '24px',
    marginBottom: '12px',
    color: '#374151'
  },
  ol: {
    marginLeft: '24px',
    marginBottom: '12px',
    color: '#374151'
  },
  li: {
    marginBottom: '6px',
    lineHeight: '1.6',
    fontFamily: '"Product Sans", "Google Sans", -apple-system, sans-serif'
  },
  strong: {
    fontWeight: '700',
    color: '#7c3aed'
  },
  em: {
    fontStyle: 'italic',
    color: '#8b5cf6'
  },
  inlineCode: {
    backgroundColor: '#f3e8ff',
    color: '#7c3aed',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '14px',
    fontFamily: 'monospace'
  },
  blockCode: {
    display: 'block',
    backgroundColor: '#f3e8ff',
    color: '#5b21b6',
    padding: '12px',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: 'monospace',
    overflowX: 'auto',
    marginBottom: '12px'
  },
  blockquote: {
    borderLeft: '4px solid #8b5cf6',
    paddingLeft: '16px',
    marginLeft: '0',
    fontStyle: 'italic',
    color: '#6b7280',
    backgroundColor: '#f9fafb',
    padding: '12px 16px',
    borderRadius: '4px',
    marginBottom: '12px'
  }
};
