import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';

// Doc id format used by ASTRA: `{userId}_{YYYY-MM-DD}`.
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

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

/**
 * @param {string} selectedSubject
 * @param {boolean} allSubjects
 * @param {(tab: 'assignments'|'quiz') => void} [onNavigate]
 *   Optional navigation callback. The desktop dashboard uses DOM-based tab
 *   buttons (`data-tab="..."`) which we click via querySelector. Mobile
 *   uses React state for tabs — those DOM elements don't exist — so the
 *   mobile dashboard passes onNavigate to wire up the Start / Take Quiz
 *   buttons properly. When omitted, falls back to the desktop DOM click.
 */
export const TodoPanel = ({ selectedSubject, allSubjects = false, onNavigate }) => {
  const { userData, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [todos, setTodos] = useState({
    pendingAssignments: [],
    availableQuizzes: [],
    unwatchedVideos: [],
    recommendedActions: []
  });
  const [motivationalQuote, setMotivationalQuote] = useState('');
  // Today's ASTRA check-in result. mood ∈ 'low' | 'neutral' | 'high' | null.
  // Used to adapt how heavy the to-do list looks today: low = lighter load
  // + softer encouragement, high = full load + a challenge nudge, neutral
  // (or no check-in) = the default view.
  const [todayMood, setTodayMood] = useState(null);
  const [astraMessage, setAstraMessage] = useState('');
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const motivationalQuotes = [
    "🌟 Today is your day to shine! Start with the pending assignments.",
    "💪 Every task you complete brings you closer to your goals!",
    "🚀 Small steps every day lead to big achievements!",
    "✨ You're doing amazing! Keep up the momentum!",
    "🎯 Focus on progress, not perfection. Let's tackle today's tasks!",
    "🌈 Your future self will thank you for the work you do today!",
    "🔥 Stay consistent! Complete one task at a time.",
    "⭐ Believe in yourself! You've got this!",
    "🎓 Learning is a journey. Enjoy every step!",
    "💎 Your dedication today builds your success tomorrow!"
  ];

  useEffect(() => {
    fetchTodos();
    setMotivationalQuote(motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)]);
  }, [userData, selectedSubject, allSubjects]);

  // Read today's ASTRA mood once on mount. The mood adapts the visible
  // task load: low-mood students get a lighter list + a softer message;
  // high-mood students see a normal list + a "challenge" prompt.
  useEffect(() => {
    let cancelled = false;
    const fetchMood = async () => {
      const uid = userData?.uid || user?.uid;
      if (!uid) return;
      try {
        const snap = await getDoc(doc(db, 'studentMoods', `${uid}_${todayKey()}`));
        if (cancelled) return;
        if (snap.exists()) {
          const data = snap.data();
          const emotion = (data.emotion || 'neutral').toLowerCase();
          
          // Translate ASTRA emotion to our internal UI mood state ('low', 'high', 'neutral')
          // "stressed" gets a lighter load. "happy", "normal", "overwhelmed" get the normal load.
          let internalMood = 'neutral';
          if (['stressed', 'sad', 'anxious', 'low'].includes(emotion)) {
             internalMood = 'low';
          } else if (['happy', 'excited', 'high'].includes(emotion)) {
             internalMood = 'high';
          }
          
          setTodayMood(internalMood);
          setAstraMessage(data.message || '');
        } else {
          setTodayMood('neutral');
        }
      } catch (e) {
        // If the mood read fails, default to neutral so the panel still works.
        if (!cancelled) setTodayMood('neutral');
      }
    };
    fetchMood();
    return () => { cancelled = true; };
  }, [userData?.uid, user?.uid]);

  const fetchTodos = async () => {
    if (!userData?.uid && !user?.uid) return;

    setLoading(true);
    try {
      const studentId = userData?.uid || user?.uid;
      const studentClass = userData?.class || userData?.classNumber || '6';

      // Fetch pending assignments
      let assignmentsQuery;
      if (allSubjects) {
        // Get all assignments for all subjects
        assignmentsQuery = query(
          collection(db, 'assignments'),
          where('class', '==', parseInt(studentClass))
        );
      } else {
        // Get assignments for selected subject only
        assignmentsQuery = query(
          collection(db, 'assignments'),
          where('class', '==', parseInt(studentClass)),
          where('subject', '==', selectedSubject)
        );
      }
      const assignmentsSnapshot = await getDocs(assignmentsQuery);
      const assignmentIds = assignmentsSnapshot.docs.map(doc => doc.id);
      let submittedAssignmentIds = [];
      if (assignmentIds.length > 0) {
        const chunkedIds = assignmentIds.slice(0, 30);
        const submissionsQuery = query(
          collection(db, 'studentSubmissions'),
          where('studentId', '==', studentId),
          where('assignmentId', 'in', chunkedIds)
        );
        const submissionsSnapshot = await getDocs(submissionsQuery);
        submittedAssignmentIds = submissionsSnapshot.docs.map(doc => doc.data().assignmentId);
      }

      // Fetch simulation assignments
      let simAssignmentsQuery;
      if (allSubjects) {
        simAssignmentsQuery = query(
          collection(db, 'simulationAssignments'),
          where('class', '==', parseInt(studentClass))
        );
      } else {
        simAssignmentsQuery = query(
          collection(db, 'simulationAssignments'),
          where('class', '==', parseInt(studentClass)),
          where('subject', '==', selectedSubject)
        );
      }
      let simSnapshot = await getDocs(simAssignmentsQuery);
      
      // Fallback for string class type
      if (simSnapshot.empty) {
        let simAssignmentsQueryFallback;
        if (allSubjects) {
          simAssignmentsQueryFallback = query(
            collection(db, 'simulationAssignments'),
            where('class', '==', String(studentClass))
          );
        } else {
          simAssignmentsQueryFallback = query(
            collection(db, 'simulationAssignments'),
            where('class', '==', String(studentClass)),
            where('subject', '==', selectedSubject)
          );
        }
        simSnapshot = await getDocs(simAssignmentsQueryFallback);
      }

      // Get student's simulation submissions
      const simAssignmentIds = simSnapshot.docs.map(doc => doc.id);
      let submittedSimAssignmentIds = [];
      if (simAssignmentIds.length > 0) {
        const chunkedIds = simAssignmentIds.slice(0, 30);
        const simSubmissionsQuery = query(
          collection(db, 'simulationSubmissions'),
          where('studentId', '==', studentId),
          where('assignmentId', 'in', chunkedIds)
        );
        const simSubmissionsSnapshot = await getDocs(simSubmissionsQuery);
        submittedSimAssignmentIds = simSubmissionsSnapshot.docs.map(doc => doc.data().assignmentId);
      }

      // Filter pending assignments
      const now = new Date();
      now.setHours(0, 0, 0, 0); // Start of today

      const pendingNormal = assignmentsSnapshot.docs
        .filter(doc => !submittedAssignmentIds.includes(doc.id))
        .map(doc => {
          const data = doc.data();
          let parsedDueDate = parseFirebaseDate(data.dueDate);
          if (!parsedDueDate) {
            const baseDate = parseFirebaseDate(data.createdAt) || 
                             parseFirebaseDate(data.timestamp) || 
                             new Date();
            parsedDueDate = new Date(baseDate.getTime() + 3 * 24 * 60 * 60 * 1000);
          }
          return {
            id: doc.id,
            ...data,
            dueDate: parsedDueDate,
            isSimulation: false
          };
        });

      const pendingSim = simSnapshot.docs
        .filter(doc => !submittedSimAssignmentIds.includes(doc.id))
        .map(doc => {
          const data = doc.data();
          let parsedDueDate = parseFirebaseDate(data.dueDate);
          if (!parsedDueDate) {
            const baseDate = parseFirebaseDate(data.createdAt) || new Date();
            parsedDueDate = new Date(baseDate.getTime() + 3 * 24 * 60 * 60 * 1000);
          }
          return {
            id: doc.id,
            ...data,
            title: data.title || 'Simulation Experiment',
            chapterName: data.simulationName || 'Simulation Lab',
            dueDate: parsedDueDate,
            isSimulation: true
          };
        });

      const pendingAssignments = [...pendingNormal, ...pendingSim]
        .filter(item => {
          const itemDue = new Date(item.dueDate);
          itemDue.setHours(23, 59, 59, 999); // End of due date
          return itemDue >= now; // Only show if due date is today or later
        })
        .sort((a, b) => {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate - b.dueDate;
        });

      // Fetch available quizzes
      let quizzesQuery;
      if (allSubjects) {
        // Get all quizzes for all subjects
        quizzesQuery = query(
          collection(db, 'aiGeneratedContent'),
          where('class', '==', parseInt(studentClass))
        );
      } else {
        // Get quizzes for selected subject only
        quizzesQuery = query(
          collection(db, 'aiGeneratedContent'),
          where('class', '==', parseInt(studentClass)),
          where('subject', '==', selectedSubject)
        );
      }
      const quizzesSnapshot = await getDocs(quizzesQuery);
      const quizIds = quizzesSnapshot.docs.map(doc => doc.id);
      let completedQuizIds = [];
      if (quizIds.length > 0) {
        const chunkedIds = quizIds.slice(0, 30);
        const quizResultsQuery = query(
          collection(db, 'quizResults'),
          where('studentId', '==', studentId),
          where('quizId', 'in', chunkedIds),
          where('malpractice', '==', false)
        );
        const quizResultsSnapshot = await getDocs(quizResultsQuery);
        completedQuizIds = quizResultsSnapshot.docs.map(doc => doc.data().quizId);
      }

      const availableQuizzes = quizzesSnapshot.docs
        .filter(doc => {
          const data = doc.data();
          return data.quiz && Array.isArray(data.quiz) && data.quiz.length > 0 && !completedQuizIds.includes(doc.id);
        })
        .map(doc => ({
          id: doc.id,
          chapterName: doc.data().chapterName,
          subject: doc.data().subject,
          questionCount: doc.data().quiz?.length || 0
        }));

      // Generate personalized recommendations
      const recommendations = [];

      if (pendingAssignments.length === 0 && availableQuizzes.length === 0) {
        recommendations.push({
          icon: '🎉',
          text: 'Awesome! You\'re all caught up!',
          action: 'Review your notes or watch video lectures to reinforce learning.',
          priority: 'low'
        });
      } else {
        if (pendingAssignments.length > 0) {
          const urgent = pendingAssignments.filter(a => {
            if (!a.dueDate) return false;
            const daysUntilDue = Math.ceil((a.dueDate - new Date()) / (1000 * 60 * 60 * 24));
            return daysUntilDue <= 2;
          });

          if (urgent.length > 0) {
            recommendations.push({
              icon: '⚠️',
              text: `${urgent.length} assignment${urgent.length > 1 ? 's' : ''} due soon!`,
              action: 'Complete urgent assignments first.',
              priority: 'high'
            });
          } else {
            recommendations.push({
              icon: '📝',
              text: `${pendingAssignments.length} pending assignment${pendingAssignments.length > 1 ? 's' : ''}`,
              action: 'Start with the earliest due date.',
              priority: 'medium'
            });
          }
        }

        if (availableQuizzes.length > 0) {
          recommendations.push({
            icon: '📚',
            text: `${availableQuizzes.length} quiz${availableQuizzes.length > 1 ? 'zes' : ''} available`,
            action: 'Test your knowledge and identify areas to improve.',
            priority: 'medium'
          });
        }

        // Daily learning goal
        recommendations.push({
          icon: '🎯',
          text: 'Daily Goal',
          action: 'Spend at least 30 minutes studying today.',
          priority: 'low'
        });
      }

      if (isMountedRef.current) {
        setTodos({
          pendingAssignments,
          availableQuizzes,
          recommendedActions: recommendations
        });
      }
    } catch (error) {
      console.error('Error fetching todos:', error);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const formatDueDate = (dueDate) => {
    if (!dueDate) return 'No due date';
    const now = new Date();
    const diff = dueDate - now;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    if (days < 0) return '⚠️ Overdue';
    if (days === 0) return '🔥 Due today!';
    if (days === 1) return '⚠️ Due tomorrow';
    if (days <= 7) return `Due in ${days} days`;
    return dueDate.toLocaleDateString();
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p>Loading your tasks...</p>
        </div>
      </div>
    );
  }

  // ── Mood-adaptive task slicing ─────────────────────────────────────────
  // - low: show only the single most urgent assignment + one quiz, hide
  //        deadlines, replace urgent recommendations with a calming one.
  // - high: full list + a "challenge of the day" highlight.
  // - neutral / null: full list, default behaviour.
  const moodCaps = todayMood === 'low'
    ? { assignments: 1, quizzes: 1 }
    : { assignments: Infinity, quizzes: Infinity };

  const visibleAssignments = todos.pendingAssignments.slice(0, moodCaps.assignments);
  const visibleQuizzes = todos.availableQuizzes.slice(0, moodCaps.quizzes);
  const hiddenAssignmentsCount = todos.pendingAssignments.length - visibleAssignments.length;
  const hiddenQuizzesCount = todos.availableQuizzes.length - visibleQuizzes.length;

  // Tone-aware quote that overrides the random one if a mood is detected.
  // Low-mood students get gentle validation; high-mood students get a push.
  const moodQuote = todayMood === 'low'
    ? "🤍 Tough days are okay. Just one small step today is enough."
    : todayMood === 'high'
      ? "🚀 You're flying — channel that energy into one challenging thing today."
      : motivationalQuote;

  // Visible task counts (after mood slicing) for the summary card.
  const totalTasks = visibleAssignments.length + visibleQuizzes.length;

  // Mood-keyed accent color for the gentle banner at the top.
  const moodAccent = {
    low: { bg: 'rgba(167, 139, 250, 0.10)', border: 'rgba(167, 139, 250, 0.35)', text: '#c4b5fd' },
    high: { bg: 'rgba(20, 184, 166, 0.10)', border: 'rgba(20, 184, 166, 0.35)', text: '#5eead4' },
    neutral: { bg: 'rgba(96, 165, 250, 0.10)', border: 'rgba(96, 165, 250, 0.30)', text: '#93c5fd' },
  }[todayMood || 'neutral'];

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .todo-panel-container {
            padding: 16px !important;
          }
          .todo-task-card {
            flex-wrap: wrap !important;
          }
          .todo-task-card > div:last-child {
            width: 100% !important;
            margin-top: 8px !important;
          }
          .todo-task-card > div:last-child button {
            width: 100% !important;
            padding: 12px !important;
          }
        }
      `}</style>
      <div style={styles.container} className="todo-panel-container">
      {/* Motivational Header */}
      <div style={styles.motivationalHeader}>
        <div style={styles.motivationalIcon}>✨</div>
        <div>
          <h2 style={styles.title}>Your Daily To-Do List</h2>
          <p style={styles.motivationalQuote}>{moodQuote}</p>
        </div>
      </div>

      {/* ASTRA mood banner — only when the student completed today's
          check-in. Surfaces ASTRA's tailored message + signals that the
          to-do load was adapted to how they said they're feeling. */}
      {todayMood && astraMessage && (
        <div style={{
          marginTop: 14, marginBottom: 6,
          padding: '14px 16px',
          borderRadius: 14,
          background: moodAccent.bg,
          border: `1px solid ${moodAccent.border}`,
          color: '#e2e8f0',
          fontSize: 13.5,
          lineHeight: 1.55,
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>
            {todayMood === 'low' ? '🤍' : todayMood === 'high' ? '🌟' : '💬'}
          </span>
          <div>
            <div style={{ fontWeight: 700, color: moodAccent.text, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>
              From ASTRA
            </div>
            <div>{astraMessage}</div>
            {todayMood === 'low' && hiddenAssignmentsCount + hiddenQuizzesCount > 0 && (
              <div style={{ marginTop: 8, color: '#94a3b8', fontSize: 12.5, fontStyle: 'italic' }}>
                Showing a lighter load today — the rest will wait for you.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Task Summary */}
      <div style={styles.summaryCard}>
        <div style={styles.summaryItem}>
          <div style={styles.summaryNumber}>{totalTasks}</div>
          <div style={styles.summaryLabel}>Today's Focus</div>
        </div>
        <div style={styles.summaryDivider}></div>
        <div style={styles.summaryItem}>
          <div style={styles.summaryNumber}>{visibleAssignments.length}</div>
          <div style={styles.summaryLabel}>Assignments</div>
        </div>
        <div style={styles.summaryDivider}></div>
        <div style={styles.summaryItem}>
          <div style={styles.summaryNumber}>{visibleQuizzes.length}</div>
          <div style={styles.summaryLabel}>Quizzes</div>
        </div>
      </div>

      {/* Recommended Actions — on low-mood days, swap the entire list for
          a single calming card so urgency messaging doesn't pile on. */}
      {todayMood === 'low' && (todos.pendingAssignments.length + todos.availableQuizzes.length > 0) ? (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>📌 Today's Focus</h3>
          <div style={styles.recommendationsList}>
            <div style={{ ...styles.recommendationCard, borderLeft: '4px solid #a78bfa' }}>
              <div style={styles.recIcon}>🌱</div>
              <div style={styles.recContent}>
                <div style={styles.recText}>One small win is enough today</div>
                <div style={styles.recAction}>
                  Pick the easiest task. Finishing one thing beats trying to do everything.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        todos.recommendedActions.length > 0 && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>
              {todayMood === 'high' ? '🚀 Today\'s Focus — go big' : '📌 Today\'s Focus'}
            </h3>
            <div style={styles.recommendationsList}>
              {todos.recommendedActions.map((rec, idx) => (
                <div
                  key={idx}
                  style={{
                    ...styles.recommendationCard,
                    borderLeft: `4px solid ${getPriorityColor(rec.priority)}`
                  }}
                >
                  <div style={styles.recIcon}>{rec.icon}</div>
                  <div style={styles.recContent}>
                    <div style={styles.recText}>{rec.text}</div>
                    <div style={styles.recAction}>{rec.action}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* Pending Assignments — sliced to `visibleAssignments` so low-mood
          students see only the single most urgent one. */}
      {visibleAssignments.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>
            📝 {todayMood === 'low' ? 'Just One Thing for Today' : 'Pending Assignments'}
          </h3>
          <div style={styles.tasksList}>
            {visibleAssignments.map((assignment, idx) => (
              <div key={assignment.id} style={styles.taskCard} className="todo-task-card">
                <div style={styles.taskNumber}>{idx + 1}</div>
                <div style={styles.taskContent}>
                  <div style={styles.taskTitle}>{assignment.title || assignment.assignmentTitle}</div>
                  <div style={styles.taskMeta}>
                    {allSubjects && (
                      <span style={styles.taskSubject}>
                        📖 {assignment.subject}
                      </span>
                    )}
                    {assignment.isSimulation && (
                      <span style={{ ...styles.taskSubject, color: '#ec4899' }}>
                        🧪 Simulation
                      </span>
                    )}
                    <span style={styles.taskChapter}>
                      📖 {assignment.chapterName || 'General'}
                    </span>
                    <span style={styles.taskDueDate}>
                      {formatDueDate(assignment.dueDate)}
                    </span>
                  </div>
                </div>
                <div style={styles.taskAction}>
                  <button
                    style={styles.actionButton}
                    onClick={() => {
                      if (assignment.isSimulation) {
                        if (onNavigate) { onNavigate('simulations'); return; }
                        const simulationsTab = document.querySelector('[data-tab="simulations"]');
                        if (simulationsTab) simulationsTab.click();
                      } else {
                        if (onNavigate) { onNavigate('assignments'); return; }
                        const assignmentsTab = document.querySelector('[data-tab="assignments"]');
                        if (assignmentsTab) assignmentsTab.click();
                      }
                    }}
                  >
                    Start →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Quizzes — sliced to `visibleQuizzes` so low-mood
          students see only one. */}
      {visibleQuizzes.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>
            {todayMood === 'high' ? '🌟 Challenge Yourself' : '🎯 Available Quizzes'}
          </h3>
          <div style={styles.tasksList}>
            {visibleQuizzes.map((quiz, idx) => (
              <div key={quiz.id} style={styles.taskCard} className="todo-task-card">
                <div style={styles.taskNumber}>{idx + 1}</div>
                <div style={styles.taskContent}>
                  <div style={styles.taskTitle}>{quiz.chapterName}</div>
                  <div style={styles.taskMeta}>
                    {allSubjects && (
                      <span style={styles.taskSubject}>
                        📖 {quiz.subject}
                      </span>
                    )}
                    <span style={styles.taskChapter}>
                      ❓ {quiz.questionCount} questions
                    </span>
                  </div>
                </div>
                <div style={styles.taskAction}>
                  <button
                    style={styles.actionButton}
                    onClick={() => {
                      if (onNavigate) { onNavigate('quiz'); return; }
                      const quizTab = document.querySelector('[data-tab="quiz"]');
                      if (quizTab) quizTab.click();
                    }}
                  >
                    Take Quiz →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Caught Up */}
      {totalTasks === 0 && (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>🎉</div>
          <h3 style={styles.emptyTitle}>You're All Caught Up!</h3>
          <p style={styles.emptyText}>
            Great job staying on top of your work! Keep the momentum going by:
          </p>
          <ul style={styles.emptyList}>
            <li>Reviewing notes and video lectures</li>
            <li>Practicing with flashcards</li>
            <li>Exploring additional study materials</li>
          </ul>
        </div>
      )}

      {/* Encouraging Footer */}
      <div style={styles.footer}>
        <p style={styles.footerText}>
          💡 <strong>Tip:</strong> Break large tasks into smaller steps and tackle them one at a time!
        </p>
      </div>
    </div>
    </>
  );
};

const styles = {
  container: {
    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 58, 95, 0.85))',
    borderRadius: '12px',
    padding: '24px',
    maxWidth: '900px',
    margin: '0 auto',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(59, 130, 246, 0.3)'
  },
  loadingContainer: {
    textAlign: 'center',
    padding: '60px 20px',
    color: 'rgba(255, 255, 255, 0.6)'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid rgba(59, 130, 246, 0.3)',
    borderTop: '4px solid #60a5fa',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 16px'
  },
  motivationalHeader: {
    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(139, 92, 246, 0.2))',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    border: '1px solid rgba(59, 130, 246, 0.3)'
  },
  motivationalIcon: {
    fontSize: '48px',
    animation: 'bounce 2s ease-in-out infinite'
  },
  title: {
    margin: '0 0 8px 0',
    fontSize: '24px',
    fontWeight: '700',
    color: '#ffffff'
  },
  motivationalQuote: {
    margin: 0,
    fontSize: '16px',
    color: '#60a5fa',
    fontWeight: '600'
  },
  summaryCard: {
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.6), rgba(15, 23, 42, 0.8))',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '24px',
    border: '1px solid rgba(59, 130, 246, 0.25)'
  },
  summaryItem: {
    textAlign: 'center',
    flex: 1
  },
  summaryNumber: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#60a5fa',
    marginBottom: '4px'
  },
  summaryLabel: {
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500'
  },
  summaryDivider: {
    width: '1px',
    height: '40px',
    backgroundColor: 'rgba(59, 130, 246, 0.3)'
  },
  section: {
    marginBottom: '24px'
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  recommendationsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  recommendationCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '16px',
    background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.6), rgba(15, 23, 42, 0.8))',
    borderRadius: '8px',
    border: '1px solid rgba(59, 130, 246, 0.25)'
  },
  recIcon: {
    fontSize: '24px',
    flexShrink: 0
  },
  recContent: {
    flex: 1
  },
  recText: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: '4px'
  },
  recAction: {
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.6)'
  },
  tasksList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  taskCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px',
    background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.6), rgba(15, 23, 42, 0.8))',
    borderRadius: '8px',
    border: '1px solid rgba(59, 130, 246, 0.25)',
    transition: 'all 0.3s ease'
  },
  taskNumber: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '14px',
    flexShrink: 0
  },
  taskContent: {
    flex: 1,
    minWidth: 0
  },
  taskTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: '6px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  taskMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px 12px',
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.6)'
  },
  taskChapter: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    whiteSpace: 'nowrap',
    flexShrink: 0
  },
  taskSubject: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontWeight: '600',
    color: '#60a5fa',
    whiteSpace: 'nowrap',
    flexShrink: 0
  },
  taskDueDate: {
    fontWeight: '600',
    whiteSpace: 'nowrap',
    flexShrink: 0
  },
  taskAction: {
    flexShrink: 0
  },
  actionButton: {
    padding: '8px 16px',
    background: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    whiteSpace: 'nowrap',
    boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)'
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.6), rgba(15, 23, 42, 0.8))',
    borderRadius: '12px',
    border: '2px dashed rgba(59, 130, 246, 0.4)'
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '16px'
  },
  emptyTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: '8px'
  },
  emptyText: {
    fontSize: '16px',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: '16px'
  },
  emptyList: {
    textAlign: 'left',
    display: 'inline-block',
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: '14px'
  },
  footer: {
    marginTop: '24px',
    padding: '16px',
    background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(245, 158, 11, 0.15))',
    borderRadius: '8px',
    border: '1px solid rgba(251, 191, 36, 0.4)'
  },
  footerText: {
    margin: 0,
    fontSize: '14px',
    color: '#fcd34d'
  }
};

export default TodoPanel;
