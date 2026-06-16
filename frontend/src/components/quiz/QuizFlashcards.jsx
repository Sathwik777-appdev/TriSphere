import React, { useState } from 'react';

export const QuizFlashcards = ({
  selectedQuiz,
  setMode,
  setSelectedQuiz,
  isQuizBanned,
  isQuizCompleted,
  styles
}) => {
  const [currentCard, setCurrentCard] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const questions = selectedQuiz?.questions || [];
  const question = questions[currentCard];
  const correctOption = question?.options?.[question.correctAnswer] || 'No answer available';

  const handleFlipCard = () => {
    setIsFlipped(!isFlipped);
  };

  const handleNextCard = (e) => {
    e.stopPropagation(); // Prevent flipping when clicking next
    if (currentCard < questions.length - 1) {
      setCurrentCard(currentCard + 1);
      setIsFlipped(false);
    }
  };

  const handlePrevCard = (e) => {
    e.stopPropagation(); // Prevent flipping when clicking prev
    if (currentCard > 0) {
      setCurrentCard(currentCard - 1);
      setIsFlipped(false);
    }
  };

  if (!question) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <p>This quiz has no questions available.</p>
          <button onClick={() => setSelectedQuiz(null)} style={styles.backButton}>← Back</button>
        </div>
      </div>
    );
  }

  const banned = isQuizBanned(selectedQuiz.id);
  const completed = isQuizCompleted(selectedQuiz.id);

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
          onClick={() => setMode('flashcards')}
          style={{ ...styles.modeButton, ...styles.modeButtonActive }}
        >
          🎴 Flashcards
        </button>
        <button
          onClick={() => {
            if (banned) {
              alert('⛔ Test Mode Blocked\n\nYou are permanently banned from taking this quiz in test mode due to previous malpractice.\n\nYou can still use Flashcard mode to study.');
              return;
            }
            if (completed) {
              alert('✅ Quiz Already Completed\n\nYou have already attempted this quiz. Each quiz can only be taken once.\n\nYou can review the material using Flashcard mode.');
              return;
            }
            setMode('test');
          }}
          style={{
            ...styles.modeButton,
            ...(banned || completed ? { opacity: 0.5, cursor: 'not-allowed' } : {})
          }}
        >
          📝 Test {banned || completed ? '🔒' : ''}
        </button>
      </div>

      <div style={styles.flashcardContainer}>
        <div style={styles.progress}>
          Card {currentCard + 1} of {questions.length}
        </div>

        <div
          style={{
            ...styles.flashcard,
            ...(isFlipped ? styles.flashcardFlipped : {})
          }}
          onClick={handleFlipCard}
        >
          {!isFlipped ? (
            <div style={styles.cardFront}>
              <div style={styles.cardLabel}>Question</div>
              <div style={styles.cardContent}>{question.question}</div>
              <div style={styles.tapHint}>👆 Tap to reveal answer</div>
            </div>
          ) : (
            <div style={styles.cardBack}>
              <div style={styles.cardLabel}>Answer</div>
              <div style={styles.cardContent}>{correctOption}</div>
              {question.explanation && (
                <div style={styles.explanation}>
                  💡 {question.explanation}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={styles.navigation}>
          <button
            onClick={handlePrevCard}
            disabled={currentCard === 0}
            style={{
              ...styles.navButton,
              ...(currentCard === 0 ? styles.navButtonDisabled : {})
            }}
          >
            ← Previous
          </button>
          <button
            onClick={handleNextCard}
            disabled={currentCard >= questions.length - 1}
            style={{
              ...styles.navButton,
              ...(currentCard >= questions.length - 1 ? styles.navButtonDisabled : {})
            }}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
};
