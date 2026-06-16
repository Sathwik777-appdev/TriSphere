import React from 'react';

export const QuizResults = ({
  selectedQuiz,
  setMode,
  setSelectedQuiz,
  answers,
  showAITutoring,
  setShowAITutoring,
  generateAITutoring,
  isLoadingAI,
  aiExplanations,
  speakingIndex,
  handleSpeak,
  getAttemptCount,
  preparingRetake,
  handleRetake,
  styles
}) => {
  const questionsArray = selectedQuiz?.questions || [];
  const correctCount = questionsArray.filter(
    (q, idx) => (q && typeof q.correctAnswer === 'number' && answers[idx] === q.correctAnswer) ||
      (!q?.correctAnswer && answers[idx] === 0)
  ).length;
  const percentage = Math.round((correctCount / Math.max(1, questionsArray.length)) * 100);
  const incorrectCount = questionsArray.length - correctCount;

  // Prepare incorrect questions for AI tutoring
  const incorrectQuestions = questionsArray
    .map((q, idx) => ({
      index: idx,
      question: q.question,
      studentAnswer: (q.options || ['A', 'B', 'C', 'D'])[answers[idx]],
      correctAnswer: (q.options || ['A', 'B', 'C', 'D'])[q.correctAnswer || 0],
      isCorrect: answers[idx] === (q.correctAnswer || 0)
    }))
    .filter(item => !item.isCorrect);

  const attemptCount = getAttemptCount(selectedQuiz.id);

  return (
    <div style={styles.container}>
      <div style={styles.resultsContainer}>
        <h2 style={styles.resultsTitle}>📊 Test Results</h2>
        <div style={styles.scoreCircle}>
          <div style={styles.scoreNumber}>{percentage}%</div>
          <div style={styles.scoreText}>
            {correctCount} / {questionsArray.length} correct
          </div>
        </div>

        {/* AI Tutoring Section */}
        {incorrectCount > 0 && (
          <div style={styles.aiTutoringSection}>
            <div style={styles.aiTutoringHeader}>
              <h3 style={styles.aiTutoringTitle}>🤖 AI Tutor - Let's Learn Together!</h3>
              <p style={styles.aiTutoringSubtitle}>
                You got {incorrectCount} question{incorrectCount > 1 ? 's' : ''} wrong.
                Let me help you understand the concepts better.
              </p>
            </div>

            {!showAITutoring ? (
              <button
                onClick={async () => {
                  setShowAITutoring(true);
                  await generateAITutoring(incorrectQuestions);
                }}
                style={styles.aiTutorButton}
                disabled={isLoadingAI}
              >
                {isLoadingAI ? '🔄 AI Tutor is preparing explanations...' : '🎓 Get AI Tutoring & Try Again'}
              </button>
            ) : (
              <div style={styles.aiExplanationsContainer}>
                {isLoadingAI ? (
                  <div style={styles.loadingAI}>
                    <div style={styles.spinner}></div>
                    <p>AI Tutor is analyzing your mistakes and preparing personalized explanations...</p>
                  </div>
                ) : (
                  <>
                    <h4 style={styles.explanationsTitle}>📚 Personalized Explanations</h4>
                    {incorrectQuestions.map((item) => (
                      <div key={item.index} style={styles.aiExplanationCard}>
                        <div style={styles.explanationQuestion}>
                          <strong>Question {item.index + 1}:</strong> {item.question}
                        </div>
                        <div style={styles.explanationAnswers}>
                          <div style={styles.wrongAnswer}>
                            ❌ Your answer: {item.studentAnswer}
                          </div>
                          <div style={styles.rightAnswer}>
                            ✅ Correct answer: {item.correctAnswer}
                          </div>
                        </div>
                        <div style={styles.aiExplanationText}>
                          <div style={styles.explanationHeader}>
                            <strong>💡 AI Tutor Explains:</strong>
                            <button
                              onClick={() => handleSpeak(
                                `Question ${item.index + 1}. ${item.question}. Your answer was ${item.studentAnswer}, which is incorrect. The correct answer is ${item.correctAnswer}. ${aiExplanations[item.index]}`,
                                item.index
                              )}
                              style={{
                                ...styles.voiceButton,
                                ...(speakingIndex === item.index ? styles.voiceButtonActive : {})
                              }}
                              title={speakingIndex === item.index ? 'Stop voice' : 'Listen to explanation'}
                            >
                              {speakingIndex === item.index ? '⏸️ Stop' : '🔊 Listen'}
                            </button>
                          </div>
                          <p>{aiExplanations[item.index] || 'Loading explanation...'}</p>
                        </div>
                      </div>
                    ))}

                    <div style={styles.retakeSection}>
                      {attemptCount >= 2 ? (
                        <>
                          <p style={{ ...styles.retakeMessage, color: '#ff6b6b', fontWeight: '600' }}>
                            ⛔ Maximum Attempts Reached
                          </p>
                          <p style={styles.retakeMessage}>
                            You have used both attempts for this quiz (1st attempt + 1 retake).
                            No more attempts are allowed.
                          </p>
                        </>
                      ) : (
                        <>
                          <p style={styles.retakeMessage}>
                            ✨ Now that you've learned the concepts, ready to improve your score?
                          </p>
                          <p style={{ ...styles.retakeMessage, fontSize: '14px', color: '#2196f3', fontWeight: '600' }}>
                            📚 Attempt 2/2 will reuse the {incorrectCount} question
                            {incorrectCount > 1 ? 's' : ''} you got wrong, plus
                            {' '}{questionsArray.length - incorrectCount} brand-new
                            question{(questionsArray.length - incorrectCount) === 1 ? '' : 's'} on the same chapter.
                          </p>
                          <p style={{ ...styles.retakeMessage, fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)' }}>
                            Your final mark for this chapter will be the <strong>average</strong> of both attempts.
                          </p>
                          <button
                            disabled={preparingRetake}
                            onClick={() => handleRetake(percentage)}
                            style={{
                              ...styles.retakeButton,
                              ...(preparingRetake ? { opacity: 0.7, cursor: 'wait' } : {})
                            }}
                          >
                            {preparingRetake
                              ? '⏳ Building your second attempt...'
                              : '🔄 Take Final Attempt (2/2)'}
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <div style={styles.resultsList}>
          {questionsArray.map((q, idx) => {
            const isCorrect = answers[idx] === (q?.correctAnswer || 0);
            return (
              <div key={idx} style={styles.resultItem}>
                <div style={styles.resultHeader}>
                  <span style={isCorrect ? styles.correctBadge : styles.incorrectBadge}>
                    {isCorrect ? '✓ Correct' : '✗ Incorrect'}
                  </span>
                </div>
                <div style={styles.resultQuestion}>{q?.question || `Question ${idx + 1}`}</div>
                <div style={styles.resultAnswer}>
                  <strong>Your answer:</strong> {(q?.options || ['A', 'B', 'C', 'D'])[answers[idx]] || 'Not answered'}
                </div>
                {!isCorrect && (
                  <div style={styles.resultCorrect}>
                    <strong>Correct answer:</strong> {(q?.options || ['A', 'B', 'C', 'D'])[q?.correctAnswer || 0]}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={styles.resultActions}>
          <button onClick={() => setMode('flashcards')} style={styles.reviewButton}>
            Review Flashcards
          </button>
          <button onClick={() => setSelectedQuiz(null)} style={styles.exitButton}>
            ← Back to Quizzes
          </button>
        </div>
      </div>
    </div>
  );
};
