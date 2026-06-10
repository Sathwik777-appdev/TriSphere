import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, where, getDocs, deleteDoc, doc, addDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { getThemedStyles } from '../styles/theme';

const MyLessons = ({ classNumber, subject, userId, schoolName }) => {
  const { userData } = useAuth();
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  // Error state for the fetch — previously errors were silently logged,
  // leaving the teacher staring at an empty list with no signal of why.
  const [error, setError] = useState(null);
  const [lessonTitle, setLessonTitle] = useState('Monthly Lesson Plan');
  const [weeklyContent, setWeeklyContent] = useState(['', '', '', '', '']);
  const [editingLessonId, setEditingLessonId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingContent, setEditingContent] = useState('');

  // Theme-aware styles
  const { theme: currentTheme, isDark } = useTheme();
  const themedStyles = useMemo(() => getThemedStyles(currentTheme), [currentTheme]);

  const fetchLessons = async () => {
    try {
      setLoading(true);
      setError(null);
      const isDeveloper = userData?.role === 'developer';
      const schoolFilter = isDeveloper ? [] : [where('schoolName', '==', schoolName || '')];

      const q = query(
        collection(db, 'teacherLessons'),
        where('teacherId', '==', userData?.uid || userId),
        ...schoolFilter
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setLessons(list);
    } catch (err) {
      console.error('Error fetching lessons:', err);
      setError(err?.message || "Couldn't load your lesson plans.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userData?.uid || userId) fetchLessons();
  }, [userData?.uid, userId]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this lesson?')) return;
    try {
      await deleteDoc(doc(db, 'teacherLessons', id));
      setLessons(prev => prev.filter(l => l.id !== id));
      alert('Lesson deleted');
    } catch (err) {
      console.error('Delete error:', err);
      alert('Error deleting lesson');
    }
  };

  const handleEdit = (lesson) => {
    setEditingLessonId(lesson.id);
    setEditingTitle(lesson.chapterName || '');
    setEditingContent(lesson.notes || '');
  };

  const handleCancelEdit = () => {
    setEditingLessonId(null);
    setEditingTitle('');
    setEditingContent('');
  };

  const handleUpdateLesson = async (lessonId) => {
    try {
      const lessonRef = doc(db, 'teacherLessons', lessonId);
      await updateDoc(lessonRef, {
        chapterName: editingTitle,
        notes: editingContent,
        status: 'Under Review',
        updatedAt: Timestamp.now()
      });
      setEditingLessonId(null);
      setEditingTitle('');
      setEditingContent('');
      alert('✅ Lesson updated and resubmitted for review');
      fetchLessons();
    } catch (err) {
      console.error('Update error:', err);
      alert('Error updating lesson');
    }
  };

  const handleSaveLessonPlan = async () => {
    const weekContent = weeklyContent
      .map((content, idx) => content.trim() ? `Week ${idx + 1}:\n${content}` : '')
      .filter(c => c)
      .join('\n\n');

    if (!weekContent) {
      alert('Please enter content for at least one week.');
      return;
    }
    try {
      const noteData = {
        teacherId: userData?.uid,
        teacherName: userData?.username || userData?.email || 'Teacher',
        chapterName: lessonTitle || 'Lesson Plan',
        notes: weekContent,
        lessonType: 'monthly',
        class: parseInt(classNumber) || 6,
        subject: subject || 'General',
        schoolName: schoolName || '',
        status: 'Under Review',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      await addDoc(collection(db, 'teacherLessons'), noteData);
      setWeeklyContent(['', '', '', '', '']);
      setLessonTitle('Monthly Lesson Plan');
      alert('✅ Lesson plan saved to My Lessons');
      alert('✅ Lesson plan saved to My Lessons');
      fetchLessons();
    } catch (err) {
      console.error('Error saving lesson:', err);
      alert('Error saving lesson. Please try again.');
    }
  };

  return (
    <div style={{
      background: 'transparent',
      padding: '24px',
      borderRadius: '16px',
      color: themedStyles.text.primary
    }}>
      <h3 style={{ marginTop: 0, fontSize: '24px', fontWeight: '700', marginBottom: '20px' }}>📒 My Lessons Hub</h3>

      {/* Visible fetch-error card with a Retry button. The form for
          creating a new lesson stays usable below — only the saved-list
          fetch is blocked, not the whole panel. */}
      {error && !loading && (
        <div
          style={{
            padding: 18,
            marginBottom: 20,
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.30)',
            borderRadius: 14,
            color: '#fecaca',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <span style={{ fontSize: 22 }}>⚠️</span>
          <span style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>
            Couldn't load your saved lesson plans. Check your connection and try again.
          </span>
          <button
            onClick={fetchLessons}
            style={{
              padding: '8px 16px',
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            🔄 Retry
          </button>
        </div>
      )}

      {/* Create Lesson Plan */}
      <div style={{
        background: isDark ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 58, 95, 0.95))' : 'white',
        padding: '24px',
        borderRadius: '16px',
        border: `1px solid ${themedStyles.border.default}`,
        marginBottom: '24px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(10px)'
      }}>
        <h4 style={{ margin: '0 0 20px 0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📅</span> Create Monthly Lesson Plan
        </h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ fontSize: '13px', color: themedStyles.text.muted, display: 'block', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Plan Title</label>
            <input
              value={lessonTitle}
              onChange={(e) => setLessonTitle(e.target.value)}
              placeholder="e.g., Monthly Lesson Plan - January"
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '10px',
                border: `1px solid ${themedStyles.border.default}`,
                background: isDark ? 'rgba(15, 23, 42, 0.6)' : '#f9fafb',
                color: themedStyles.text.primary,
                fontSize: '15px'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '13px', color: themedStyles.text.muted, display: 'block', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Weekly Topics & Activities</label>
            <div style={{ border: `1px solid ${themedStyles.border.default}`, borderRadius: '12px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: isDark ? 'rgba(59, 130, 246, 0.1)' : '#f3f4f6' }}>
                    <th style={{ padding: '16px', textAlign: 'left', borderBottom: `1px solid ${themedStyles.border.default}`, width: '80px', fontWeight: '700', color: themedStyles.text.primary }}>Week</th>
                    <th style={{ padding: '16px', textAlign: 'left', borderBottom: `1px solid ${themedStyles.border.default}`, fontWeight: '700', color: themedStyles.text.primary }}>Topics / Activities</th>
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4, 5].map((week, idx) => (
                    <tr key={week} style={{ borderBottom: idx < 4 ? `1px solid ${themedStyles.border.default}` : 'none' }}>
                      <td style={{
                        padding: '16px',
                        fontWeight: '700',
                        color: themedStyles.text.primary,
                        background: isDark ? 'rgba(15, 23, 42, 0.4)' : '#fafafa',
                        verticalAlign: 'top'
                      }}>
                        Week {week}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <textarea
                          value={weeklyContent[idx]}
                          onChange={(e) => {
                            const newContent = [...weeklyContent];
                            newContent[idx] = e.target.value;
                            setWeeklyContent(newContent);
                          }}
                          placeholder={`Enter topics and activities for Week ${week}...`}
                          rows={6}
                          style={{
                            width: '100%',
                            padding: '14px',
                            border: `1px solid ${themedStyles.border.default}`,
                            borderRadius: '8px',
                            fontFamily: 'inherit',
                            resize: 'vertical',
                            background: isDark ? 'rgba(15, 23, 42, 0.6)' : 'white',
                            color: themedStyles.text.primary,
                            fontSize: '14px',
                            transition: 'all 0.3s ease',
                            outline: 'none',
                            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = themedStyles.border.default}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button
              onClick={handleSaveLessonPlan}
              style={{
                padding: '14px 28px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '15px',
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
            >
              💾 Save Monthly Plan
            </button>
            <button
              onClick={() => { setWeeklyContent(['', '', '', '', '']); setLessonTitle('Monthly Lesson Plan'); }}
              style={{
                padding: '14px 24px',
                background: isDark ? 'rgba(107, 114, 128, 0.3)' : '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      <h4 style={{ margin: '32px 0 16px 0', fontSize: '20px', fontWeight: '700' }}>📚 Published Plans</h4>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: themedStyles.text.muted }}>⏳ Loading published plans...</div>
      ) : lessons.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          background: isDark ? 'rgba(15, 23, 42, 0.3)' : '#f3f4f6',
          borderRadius: '12px',
          color: themedStyles.text.muted,
          border: `1px dashed ${themedStyles.border.default}`
        }}>
          📭 No plans uploaded yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {lessons.map(lesson => (
            <div key={lesson.id} style={{
              padding: '20px',
              border: `1px solid ${themedStyles.border.default}`,
              borderRadius: '16px',
              background: isDark ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.8), rgba(30, 58, 95, 0.7))' : 'white',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  {editingLessonId === lesson.id ? (
                    <input
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      style={{
                        fontWeight: '700',
                        fontSize: '18px',
                        padding: '10px 14px',
                        border: `1px solid #3b82f6`,
                        borderRadius: '8px',
                        width: '400px',
                        background: isDark ? 'rgba(15, 23, 42, 0.8)' : 'white',
                        color: themedStyles.text.primary
                      }}
                    />
                  ) : (
                    <div style={{ fontWeight: '700', fontSize: '18px', color: themedStyles.text.primary }}>{lesson.chapterName || 'Lesson Plan'}</div>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '12px' }}>
                    {lesson.lessonType && <span style={{ background: lesson.lessonType === 'monthly' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(245, 158, 11, 0.2)', color: lesson.lessonType === 'monthly' ? '#60a5fa' : '#fbbf24', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>{lesson.lessonType === 'monthly' ? '📅 Monthly' : '📆 Weekly'}</span>}
                    {lesson.subject && <span style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>{lesson.subject}</span>}
                    {lesson.class && <span style={{ background: 'rgba(236, 72, 153, 0.2)', color: '#f472b6', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>Class {lesson.class}</span>}
                    <span style={{
                      background: lesson.status === 'Accepted' ? 'rgba(16, 185, 129, 0.2)' : lesson.status === 'Needs Improvement' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                      color: lesson.status === 'Accepted' ? '#34d399' : lesson.status === 'Needs Improvement' ? '#f87171' : '#fbbf24',
                      padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700'
                    }}>
                      {lesson.status === 'Accepted' ? '✅ Accepted' : lesson.status === 'Needs Improvement' ? '🔄 Needs Improvement' : '⏳ Under Review'}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {editingLessonId === lesson.id ? (
                    <>
                      <button onClick={() => handleUpdateLesson(lesson.id)} style={{ background: '#10b981', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>✅ Save</button>
                      <button onClick={handleCancelEdit} style={{ background: '#6b7280', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
                    </>
                  ) : (
                    <>
                      {lesson.status !== 'Accepted' && (
                        <button onClick={() => handleEdit(lesson)} style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Edit</button>
                      )}
                      <button onClick={() => handleDelete(lesson.id)} style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>Delete</button>
                    </>
                  )}
                </div>
              </div>
              {editingLessonId === lesson.id ? (
                <textarea
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                  rows={10}
                  style={{
                    marginTop: '20px',
                    width: '100%',
                    padding: '16px',
                    border: `1px solid #3b82f6`,
                    borderRadius: '10px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    background: isDark ? 'rgba(15, 23, 42, 0.8)' : 'white',
                    color: themedStyles.text.primary,
                    fontSize: '15px',
                    lineHeight: '1.6'
                  }}
                />
              ) : (
                <div style={{
                  marginTop: '20px',
                  whiteSpace: 'pre-wrap',
                  color: themedStyles.text.secondary,
                  padding: '20px',
                  background: isDark ? 'rgba(15, 23, 42, 0.4)' : '#f8fafc',
                  borderRadius: '12px',
                  border: `1px solid ${themedStyles.border.default}`,
                  fontSize: '15px',
                  lineHeight: '1.6'
                }}>{lesson.notes}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyLessons;
