import React from 'react';

export const QuizGrid = ({
  quizzes,
  isQuizBanned,
  isQuizCompleted,
  getAttemptCount,
  setSelectedQuiz,
  resetQuiz,
  styles
}) => {
  if (quizzes.length === 0) {
    return <div style={styles.noQuizzes}>No quizzes available for this subject yet.</div>;
  }

  return (
    <div style={styles.quizGrid}>
      {quizzes.map(quiz => {
        const isBanned = isQuizBanned(quiz.id);
        const isCompleted = isQuizCompleted(quiz.id);
        const attemptCount = getAttemptCount(quiz.id);
        const maxAttempts = quiz.maxAttempts || 2;
        const attemptsRemaining = maxAttempts - attemptCount;

        return (
          <div
            key={quiz.id}
            style={{
              ...styles.quizCard,
              ...(isBanned ? styles.bannedCard : {}),
              cursor: isBanned ? 'not-allowed' : 'pointer',
              opacity: isBanned ? 0.6 : 1
            }}
            onClick={() => {
              if (!isBanned) {
                setSelectedQuiz(quiz);
                resetQuiz();
              } else {
                alert('⛔ Quiz Banned\\n\\nYou are permanently banned from taking this quiz due to previous malpractice.\\n\\nContact your teacher if you believe this is an error.');
              }
            }}
          >
            <div style={styles.cardHeader}>
              <span style={styles.subjectBadge}>{quiz.subject}</span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                {isBanned && (
                  <div style={styles.bannedBadge}>⛔ BANNED</div>
                )}
                {!isBanned && attemptCount >= maxAttempts && (
                  <div style={{ ...styles.bannedBadge, backgroundColor: '#ff6b6b', color: 'white' }}>🚫 MAX ATTEMPTS</div>
                )}
                {!isBanned && attemptCount > 0 && attemptCount < maxAttempts && (
                  <div style={{ ...styles.bannedBadge, backgroundColor: '#2196f3', color: 'white' }}>
                    📝 {attemptCount}/{maxAttempts} attempts
                  </div>
                )}
                {isCompleted && !isBanned && attemptCount < maxAttempts && (
                  <div style={{ ...styles.bannedBadge, backgroundColor: '#10b981', color: 'white' }}>✅ COMPLETED</div>
                )}
                <span style={styles.questionCount}>
                  {quiz.questions?.length || 0} questions
                </span>
              </div>
            </div>
            <h3 style={styles.cardTitle}>{quiz.chapterName}</h3>
            <div style={styles.cardFooter}>
              <span>
                {isBanned
                  ? '⛔ Access Denied'
                  : attemptCount >= maxAttempts
                    ? '🚫 No attempts left'
                    : attemptsRemaining === 1
                      ? `🔄 ${attemptsRemaining} retake available`
                      : attemptsRemaining === maxAttempts
                        ? '📖 Start Quiz'
                        : `🔄 ${attemptsRemaining} retakes available`}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
