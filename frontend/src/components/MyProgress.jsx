import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { safeLocalStorage } from '../utils/storage';
import { successToast } from '../utils/toast';
import ProgressCharts from './ProgressCharts';

export const MyProgress = ({ studentId, selectedSubject }) => {
  const [progress, setProgress] = useState({
    assignmentScore: 0,
    quizScore: 0,
    weeklyEngagement: 0,
    xp: 0,
    level: 1,
    streakDays: 0
  });
  const [loading, setLoading] = useState(true);
  const [showXpAnimation, setShowXpAnimation] = useState(false);

  // Fetch real progress data from Firestore
  useEffect(() => {
    const fetchProgress = async () => {
      try {
        setLoading(true);
        console.log('=== MyProgress: Fetching data for studentId:', studentId, 'subject:', selectedSubject);

        // Fetch all assignment submissions and filter by subject in code
        const submissionsQuery = query(
          collection(db, 'studentSubmissions'),
          where('studentId', '==', studentId)
        );
        const submissionsSnapshot = await getDocs(submissionsQuery);
        const allSubmissions = submissionsSnapshot.docs.map(doc => doc.data());

        // Filter by selected subject
        const submissions = allSubmissions.filter(s => s.subject === selectedSubject);
        console.log('Found', submissions.length, 'assignment submissions for', selectedSubject);

        // Calculate assignment average score
        const assignmentScores = submissions
          .filter(s => s.grade != null && s.grade.marks !== undefined)
          .map(s => {
            const marks = Number(s.grade.marks) || 0;
            return marks <= 10 ? marks * 10 : marks;
          });
        const avgAssignmentScore = assignmentScores.length > 0
          ? Math.round(assignmentScores.reduce((a, b) => a + b, 0) / assignmentScores.length)
          : 0;
        console.log('Average assignment score:', avgAssignmentScore);

        // Fetch all quiz results and filter by subject in code
        const quizQuery = query(
          collection(db, 'quizResults'),
          where('studentId', '==', studentId)
        );
        const quizSnapshot = await getDocs(quizQuery);
        const allQuizResults = quizSnapshot.docs.map(doc => doc.data());

        // Filter by subject and exclude malpractice quizzes
        const quizResults = allQuizResults.filter(q =>
          q.malpractice !== true && q.subject === selectedSubject
        );

        // Also check localStorage for recent quiz results
        const localQuizResults = safeLocalStorage.get('quizResults', []);
        const localSubjectQuizzes = localQuizResults.filter(q => q.subject === selectedSubject);

        // Combine and deduplicate quiz results
        const allQuizzes = [...quizResults, ...localSubjectQuizzes];
        const uniqueQuizzes = allQuizzes.filter((quiz, index, self) =>
          index === self.findIndex(q => q.quizId === quiz.quizId && q.studentId === quiz.studentId)
        );

        console.log('Found', quizResults.length, 'Firestore quiz results +', localSubjectQuizzes.length, 'local quiz results for', selectedSubject);
        console.log('Combined unique quiz results:', uniqueQuizzes.length);

        const quizScores = uniqueQuizzes.map(q => q.score || 0);
        const avgQuizScore = quizScores.length > 0
          ? Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length)
          : 0;
        console.log('Quiz scores:', quizScores, 'Average:', avgQuizScore);

        // Calculate weekly engagement - fetch all activities and filter in code
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const activityQuery = query(
          collection(db, 'studentActivity'),
          where('studentId', '==', studentId),
          where('timestamp', '>=', oneWeekAgo)
        );
        const activitySnapshot = await getDocs(activityQuery);
        const allActivities = activitySnapshot.docs.map(doc => doc.data());

        // Filter by subject
        const subjectActivities = allActivities.filter(a => a.subject === selectedSubject);
        const weeklySessions = subjectActivities.length;

        // Calculate XP based on completed assignments and quizzes for this subject
        const xp = (submissions.length * 100) + (quizResults.length * 150); // 100 XP per assignment, 150 XP per quiz
        const level = Math.floor(xp / 1000) + 1;

        // Calculate study streak for this subject
        const streakDays = await calculateStreak(studentId, selectedSubject);

        setProgress({
          assignmentScore: avgAssignmentScore,
          quizScore: avgQuizScore,
          weeklyEngagement: weeklySessions,
          xp: xp,
          level: level,
          streakDays: streakDays
        });

      } catch (error) {
        console.error('Error fetching progress:', error);
      } finally {
        setLoading(false);
      }
    };

    if (studentId && selectedSubject) {
      fetchProgress();
    }
  }, [studentId, selectedSubject]);

  // Calculate consecutive days of activity for a specific subject
  const calculateStreak = async (studentId, selectedSubject) => {
    try {
      // Fetch all activities and filter by subject in code
      const activityQuery = query(
        collection(db, 'studentActivity'),
        where('studentId', '==', studentId)
      );
      const snapshot = await getDocs(activityQuery);

      if (snapshot.empty) return 0;

      // Filter by subject and get unique activity dates
      const dates = snapshot.docs
        .map(doc => {
          const data = doc.data();
          if (data.subject !== selectedSubject) return null;

          const timestamp = data.timestamp;
          if (timestamp?.toDate) {
            return timestamp.toDate().toDateString();
          }
          return null;
        })
        .filter(Boolean);

      const uniqueDates = [...new Set(dates)].sort((a, b) => new Date(b) - new Date(a));

      if (uniqueDates.length === 0) return 0;

      // Check if there's activity today or yesterday
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();

      if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) {
        return 0; // Streak broken
      }

      // Count consecutive days
      let streak = 1;
      for (let i = 1; i < uniqueDates.length; i++) {
        const currentDate = new Date(uniqueDates[i - 1]);
        const prevDate = new Date(uniqueDates[i]);
        const diffDays = Math.floor((currentDate - prevDate) / 86400000);

        if (diffDays === 1) {
          streak++;
        } else {
          break;
        }
      }

      return streak;
    } catch (error) {
      console.error('Error calculating streak:', error);
      return 0;
    }
  };

  return (
    <div style={styles.container}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3>📈 My Progress - {selectedSubject}</h3>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
          <p>Loading your progress for {selectedSubject}...</p>
        </div>
      ) : (
        <div style={styles.gridContainer}>
          <div style={styles.card}>
            <h4>Assignment Score</h4>
            <div style={styles.progressBar}>
              <div style={{ ...styles.progressFill, width: `${progress.assignmentScore}%` }}></div>
            </div>
            <span style={styles.percentage}>{progress.assignmentScore}%</span>
          </div>

          <div style={styles.card}>
            <h4>Quiz Score</h4>
            <div style={styles.progressBar}>
              <div style={{ ...styles.progressFill, width: `${progress.quizScore}%`, backgroundColor: '#4caf50' }}></div>
            </div>
            <span style={styles.percentage}>{progress.quizScore}%</span>
          </div>

          <div style={styles.card}>
            <h4>Weekly Sessions</h4>
            <div style={styles.bigNumber}>{progress.weeklyEngagement}</div>
            <span style={styles.label}>sessions this week</span>
          </div>

          <div style={styles.card}>
            <h4>XP & Level</h4>
            <div style={styles.xpContainer}>
              <span style={styles.xp}>{progress.xp} XP</span>
              <span style={styles.level}>Level {progress.level}</span>
              {showXpAnimation && (
                <div style={styles.xpPopup}>+10 XP!</div>
              )}
            </div>
            <div style={{ marginTop: '10px', fontSize: '11px', color: '#999' }}>
              Next level: {(progress.level * 1000) - progress.xp} XP
            </div>
          </div>

          <div style={styles.card}>
            <h4>Study Streak 🔥</h4>
            <div style={styles.bigNumber}>{progress.streakDays}</div>
            <span style={styles.label}>days in a row</span>
          </div>
        </div>
      )}

      {/* Progress Charts */}
      {!loading && (
        <ProgressCharts studentId={studentId} selectedSubject={selectedSubject} />
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
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '15px',
    marginTop: '15px'
  },
  card: {
    padding: '20px',
    backgroundColor: '#f9f9f9',
    borderRadius: '6px',
    border: '1px solid #eee',
    textAlign: 'center',
    position: 'relative'
  },
  progressBar: {
    width: '100%',
    height: '8px',
    backgroundColor: '#ddd',
    borderRadius: '4px',
    overflow: 'hidden',
    margin: '10px 0'
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#667eea',
    transition: 'width 0.3s'
  },
  percentage: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#333'
  },
  bigNumber: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#667eea',
    margin: '10px 0'
  },
  label: {
    fontSize: '12px',
    color: '#999'
  },
  xpContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    margin: '10px 0'
  },
  xp: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#f59e0b'
  },
  level: {
    fontSize: '14px',
    color: '#667eea',
    fontWeight: '600'
  },
  addXpButton: {
    padding: '8px 16px',
    background: 'linear-gradient(135deg, #f59e0b, #f97316)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'transform 0.2s'
  },
  xpPopup: {
    position: 'absolute',
    top: '10px',
    right: '10px',
    background: 'linear-gradient(135deg, #10b981, #059669)',
    color: 'white',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: 'bold',
    animation: 'floatUp 1s ease-out forwards',
    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)'
  }
};
