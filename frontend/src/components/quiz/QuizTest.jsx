import React from 'react';

export const QuizTest = ({
  selectedQuiz,
  setMode,
  setSelectedQuiz,
  isQuizBanned,
  isQuizCompleted,
  getAttemptCount,
  testStarted,
  startTest,
  cheatingDetected,
  violationCount,
  answers,
  handleAnswerSelect,
  handleSubmitTest,
  isSubmittingTest,
  styles
}) => {
  const banned = isQuizBanned(selectedQuiz.id);
  const completed = isQuizCompleted(selectedQuiz.id);

  // Show cheating detected (terminated) screen
  if (cheatingDetected) {
    return (
      <div style={styles.container}>
        <div style={styles.cheatingContainer}>
          <div style={styles.cheatingIcon}>⚠️</div>
          <h2 style={styles.cheatingTitle}>Test Terminated</h2>
          <p style={styles.cheatingText}>
            Malpractice detected! You violated test rules by:
          </p>
          <ul style={styles.violationList}>
            <li>Switching apps, exiting, or minimizing the app</li>
            <li>Opening other applications</li>
            <li>Attempting to copy content</li>
          </ul>
          <p style={styles.cheatingWarning}>
            This test attempt has been marked as <strong>INVALID</strong>.
          </p>
          <p style={styles.cheatingNote}>
            Violations detected: <strong>{violationCount}</strong>
          </p>
          <button
            onClick={() => setSelectedQuiz(null)}
            style={styles.exitButton}
          >
            Back to Quiz Library
          </button>
        </div>
      </div>
    );
  }

  const questions = selectedQuiz.questions || [];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={() => setSelectedQuiz(null)} style={styles.backButton}>
          ← Back
        </button>
        <h2 style={styles.quizTitle || styles.title}>{selectedQuiz.chapterName}</h2>
      </div>

      <div style={styles.modeSelector}>
        <button
          onClick={() => {
            if (testStarted) {
              const confirmExit = window.confirm('⚠️ Leaving test mode will terminate your test and mark it as malpractice! Are you sure?');
              if (!confirmExit) return;
            }
            setMode('flashcards');
          }}
          style={styles.modeButton}
        >
          🎴 Flashcards
        </button>
        <button
          onClick={() => {}}
          style={{
            ...styles.modeButton,
            ...styles.modeButtonActive,
            ...(banned || completed ? { opacity: 0.5, cursor: 'not-allowed' } : {})
          }}
        >
          📝 Test {banned || completed ? '🔒' : ''}
        </button>
      </div>

      {!testStarted ? (
        <div style={styles.testIntro}>
          <div style={styles.testRules}>
            <h3 style={styles.rulesTitle}>⚠️ Test Rules</h3>
            <ul style={styles.rulesList}>
              <li><strong>DO NOT</strong> switch apps, exit, or minimize the app</li>
              <li><strong>DO NOT</strong> open other applications</li>
              <li><strong>DO NOT</strong> copy or paste content</li>
              <li><strong>Stay focused</strong> inside this app screen only</li>
            </ul>
            <div style={styles.rulesWarning}>
              <strong>⚠️ Warning:</strong> Any violation will immediately terminate your test and mark it as invalid!
            </div>
            <button onClick={startTest} style={styles.startTestButton}>
              I Understand - Start Test
            </button>
          </div>
        </div>
      ) : (
        <div style={styles.testContainer}>
          {violationCount > 0 && (
            <div style={styles.warningBanner}>
              ⚠️ Warning: Suspicious activity detected! ({violationCount} violations)
            </div>
          )}

          {questions.map((q, qIdx) => (
            <div key={qIdx} style={styles.questionBlock}>
              <div style={styles.questionNumber}>Question {qIdx + 1}</div>
              <div style={styles.questionText}>{q?.question || `Question ${qIdx + 1}`}</div>
              <div style={styles.optionsContainer}>
                {(q?.options || ['Option A', 'Option B', 'Option C', 'Option D']).map((option, oIdx) => (
                  <button
                    key={oIdx}
                    onClick={() => handleAnswerSelect(qIdx, oIdx)}
                    className={`quiz-option-btn ${answers[qIdx] === oIdx ? 'selected' : ''}`}
                    style={{
                      ...styles.optionButton,
                      ...(answers[qIdx] === oIdx ? styles.optionSelected : {})
                    }}
                  >
                    <span style={styles.optionLetter}>
                      {String.fromCharCode(65 + oIdx)}
                    </span>
                    <span style={styles.optionText}>{option}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}

          <button
            onClick={handleSubmitTest}
            style={{
              ...styles.submitButton,
              ...((isSubmittingTest || Object.keys(answers).length !== questions.length) ? { opacity: 0.5, cursor: 'not-allowed' } : {})
            }}
            disabled={isSubmittingTest || Object.keys(answers).length !== questions.length}
          >
            {isSubmittingTest ? 'Submitting...' : 'Submit Test'}
          </button>
        </div>
      )}
    </div>
  );
};
