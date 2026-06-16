import React, { useState, useEffect } from 'react';
import { collection, doc, setDoc, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { logActivity, awardBadge } from '../services/firestoreService';
import { callAIProxy, generateReplacementQuestions } from '../services/aiService';
import { safeLocalStorage } from '../utils/storage';
import { speak, stopSpeaking } from '../utils/browserTTS';

// Custom hooks
import { useQuizzes } from '../hooks/useQuizzes';
import { useAntiCheat } from '../hooks/useAntiCheat';

// Subcomponents
import { QuizGrid } from './quiz/QuizGrid';
import { QuizFlashcards } from './quiz/QuizFlashcards';
import { QuizTest } from './quiz/QuizTest';
import { QuizResults } from './quiz/QuizResults';

export const QuizletStyle = ({ selectedSubject }) => {
  const { userData } = useAuth();
  
  // Navigation & selection states
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [mode, setMode] = useState('flashcards'); // flashcards, test
  const [testStarted, setTestStarted] = useState(false);
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);

  // AI & tutoring states
  const [showAITutoring, setShowAITutoring] = useState(false);
  const [aiExplanations, setAiExplanations] = useState({});
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [attemptHistory, setAttemptHistory] = useState([]);
  const [preparingRetake, setPreparingRetake] = useState(false);
  const [isSubmittingTest, setIsSubmittingTest] = useState(false);

  // Voice synthesis states
  const [speakingIndex, setSpeakingIndex] = useState(null);

  // Load quizzes via custom hook
  const {
    quizzes,
    loading,
    banQuizForUser,
    loadCompletedQuizzesAndAttempts,
    saveMalpracticeRecord,
    isQuizBanned,
    isQuizCompleted,
    getAttemptCount
  } = useQuizzes(userData, selectedSubject);

  // Anti-cheat via custom hook
  const {
    cheatingDetected,
    setCheatingDetected,
    violationCount,
    setViolationCount,
    cheatingDetectedRef,
    testStartedRef,
    showResultsRef,
    selectedQuizRef
  } = useAntiCheat({
    mode,
    testStarted,
    showResults,
    selectedQuiz,
    saveMalpracticeRecord,
    banQuizForUser
  });

  // Reload completed quizzes and attempts when a quiz is selected
  useEffect(() => {
    if (selectedQuiz && userData?.uid) {
      loadCompletedQuizzesAndAttempts();
    }
  }, [selectedQuiz, userData?.uid, loadCompletedQuizzesAndAttempts]);

  // Log activity when taking quiz in test mode
  useEffect(() => {
    if (mode === 'test' && testStarted && userData?.uid) {
      logActivity(userData.uid, selectedSubject, 'quiz_test_start').catch(console.error);

      const activityInterval = setInterval(() => {
        if (!showResults) {
          logActivity(userData.uid, selectedSubject, 'quiz_test_ongoing').catch(console.error);
        }
      }, 5 * 60 * 1000);

      return () => clearInterval(activityInterval);
    }
  }, [mode, testStarted, userData, showResults, selectedSubject]);

  // Unmount protection (detects if user uses BottomNav to leave the page)
  useEffect(() => {
    return () => {
      if (testStartedRef.current && !showResultsRef.current && !cheatingDetectedRef.current) {
        cheatingDetectedRef.current = true;
        const qToUse = selectedQuizRef.current;
        if (qToUse && userData?.uid) {
           addDoc(collection(db, 'quizResults'), {
             studentId: userData.uid,
             studentName: userData.name || 'Student',
             quizId: qToUse.id,
             chapterName: qToUse.chapterName,
             subject: qToUse.subject,
             class: userData.class || userData.classNumber,
             totalQuestions: qToUse.questions?.length || 0,
             correctAnswers: 0,
             score: 0,
             answers: {},
             completedAt: Timestamp.now(),
             malpractice: true,
             malpracticeReason: 'Navigated to another tab or closed app during test'
           }).catch(console.error);

           setDoc(doc(db, 'bannedQuizzes', `${userData.uid}_${qToUse.id}`), {
             studentId: userData.uid,
             quizId: qToUse.id,
             bannedAt: Timestamp.now(),
             reason: 'Navigated to another tab or closed app during test'
           }).catch(console.error);
        }
      }
    };
  }, [userData, testStartedRef, showResultsRef, cheatingDetectedRef, selectedQuizRef]);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  // Reset quiz states
  const resetQuiz = () => {
    setAnswers({});
    setShowResults(false);
    setViolationCount(0);
    setTestStarted(false);
    setCheatingDetected(false);
  };

  // Start test taking
  const startTest = () => {
    if (selectedQuiz && isQuizBanned(selectedQuiz.id)) {
      alert('⛔ Quiz Banned\n\nYou are permanently banned from taking this quiz due to previous malpractice.\n\nContact your teacher if you believe this is an error.');
      return;
    }

    const maxAttempts = selectedQuiz.maxAttempts || 2;
    const currentAttempts = getAttemptCount(selectedQuiz.id);
    if (currentAttempts >= maxAttempts) {
      alert(`⛔ Maximum Attempts Reached\n\nYou have already taken this quiz ${maxAttempts} times.\n\nNo more attempts are allowed for this quiz.`);
      return;
    }

    setTestStarted(true);
    setCheatingDetected(false);
    setViolationCount(0);

    const attemptsRemaining = maxAttempts - currentAttempts - 1;
    const attemptMessage = currentAttempts === 0
      ? `This is your 1st attempt. You have ${attemptsRemaining} more chance${attemptsRemaining === 1 ? '' : 's'} after this.`
      : attemptsRemaining === 0
        ? 'This is your FINAL attempt. Make it count!'
        : `Attempt ${currentAttempts + 1} of ${maxAttempts}. ${attemptsRemaining} chance${attemptsRemaining === 1 ? '' : 's'} remaining.`;

    alert(`⚠️ Test Rules:\n\n1. Do NOT switch apps, exit, or minimize the app\n2. Do NOT open other applications\n3. Do NOT take screenshots or copy content\n4. Do NOT use back button\n5. Stay focused on this test screen\n\n${attemptMessage}\n\n⚠️ IMPORTANT: Any malpractice will PERMANENTLY BAN you from this quiz!\n\nViolations include: switching apps, exiting, minimizing, copying, screenshots, going back.`);
  };

  const handleAnswerSelect = (questionIndex, answerIndex) => {
    setAnswers({
      ...answers,
      [questionIndex]: answerIndex
    });
  };

  const handleSubmitTest = async () => {
    if (isSubmittingTest) return;
    setIsSubmittingTest(true);
    let correct = 0;
    selectedQuiz.questions.forEach((q, idx) => {
      if (answers[idx] === (q.correctAnswer || 0)) correct++;
    });

    const totalQuestions = selectedQuiz.questions.length;
    const percentage = Math.round((correct / totalQuestions) * 100);

    try {
      const attemptNumber = attemptHistory.length + 1;
      const previousScore = attemptHistory.length > 0 ? attemptHistory[attemptHistory.length - 1].score : null;
      const improvement = previousScore ? percentage - previousScore : null;

      const quizResult = {
        studentId: userData?.uid,
        studentName: userData?.name || userData?.username || 'Student',
        quizId: selectedQuiz.id,
        chapterName: selectedQuiz.chapterName,
        subject: selectedQuiz.subject || selectedSubject,
        class: userData?.class || userData?.classNumber,
        totalQuestions: totalQuestions,
        correctAnswers: correct,
        score: percentage,
        answers: answers,
        completedAt: Timestamp.now(),
        malpractice: false,
        malpracticeReason: null,
        attemptNumber: attemptNumber,
        previousScore: previousScore,
        improvement: improvement,
        usedAITutoring: attemptNumber > 1
      };

      if (selectedQuiz.subject && selectedQuiz.subject !== selectedSubject) {
        console.warn(`⚠️ SUBJECT MISMATCH: Saving quiz result for "${selectedQuiz.chapterName}" with subject "${selectedQuiz.subject}" but currently viewing "${selectedSubject}".`);
      }

      await addDoc(collection(db, 'quizResults'), quizResult);

      if (correct === totalQuestions) {
        try {
          await awardBadge(userData?.uid, 'genius');
        } catch (e) {
          console.warn('Failed to award genius badge:', e);
        }
      }

      const existingResults = safeLocalStorage.get('quizResults', []);
      existingResults.push({ ...quizResult, completedAt: new Date() });
      safeLocalStorage.set('quizResults', existingResults);

      const currentStats = safeLocalStorage.get(`studentStats_${userData?.uid}`, {});
      const isFirstAttempt = attemptNumber === 1;
      const updatedStats = {
        ...currentStats,
        quizzesCompleted: isFirstAttempt ? (currentStats.quizzesCompleted || 0) + 1 : currentStats.quizzesCompleted,
        totalQuizScore: isFirstAttempt ? (currentStats.totalQuizScore || 0) + percentage : (currentStats.totalQuizScore || 0) - (previousScore || 0) + percentage,
        averageScore: Math.round(((currentStats.totalQuizScore || 0) + (isFirstAttempt ? percentage : -previousScore + percentage)) / (currentStats.quizzesCompleted || (isFirstAttempt ? 1 : 0))),
        lastActivity: new Date().toISOString()
      };
      safeLocalStorage.set(`studentStats_${userData?.uid}`, updatedStats);

      await loadCompletedQuizzesAndAttempts();
    } catch (err) {
      console.error('Error saving quiz result:', err);
    } finally {
      setIsSubmittingTest(false);
    }

    setShowResults(true);
  };

  const generateAITutoring = async (incorrectQuestions) => {
    setIsLoadingAI(true);
    const newExplanations = { ...aiExplanations };
    for (const item of incorrectQuestions) {
      try {
        const prompt = `You are an expert tutor helping a student understand why their answer was wrong.
 
 Question: ${item.question}
 
 Student's incorrect answer: ${item.studentAnswer}
 Correct answer: ${item.correctAnswer}
 
 Provide a clear, friendly explanation that:
 1. Explains the concept in simple terms
 2. Why the correct answer is right
 3. Why the student's answer was wrong
 4. A helpful tip to remember this concept
 
 Keep it under 150 words and use simple language suitable for students.`;

        const response = await callAIProxy(
          [{ role: 'user', content: prompt }],
          {
            model: 'openai/gpt-oss-120b',
            temperature: 0.7,
            max_tokens: 300
          }
        );

        newExplanations[item.index] = response.choices[0].message.content;
      } catch (error) {
        console.error('Error generating AI explanation:', error);
        newExplanations[item.index] = 'Unable to generate explanation. Please review the correct answer and try the quiz again.';
      }
    }

    setAiExplanations(newExplanations);
    setIsLoadingAI(false);
  };

  const handleSpeak = async (text, index) => {
    if (speakingIndex === index) {
      await stopSpeaking();
      setSpeakingIndex(null);
      return;
    }

    // Stop current speech if any
    await stopSpeaking();
    setSpeakingIndex(index);

    try {
      await speak(text, {
        rate: 0.9,
        preferFemale: true,
        lang: 'en-IN'
      });
      // Reset only if we are still speaking this specific index
      setSpeakingIndex(null);
    } catch (e) {
      console.error('Quiz AI speech error:', e);
      setSpeakingIndex(null);
    }
  };

  const handleRetake = async (percentage) => {
    setPreparingRetake(true);
    try {
      const originals = selectedQuiz.questions;
      const wrongIdx = originals
        .map((q, i) => (answers[i] !== (q.correctAnswer || 0) ? i : -1))
        .filter((i) => i >= 0);
      const wrongQs = wrongIdx.map((i) => originals[i]);
      const need = Math.max(0, originals.length - wrongQs.length);

      const chapterText =
        selectedQuiz.extractedText ||
        selectedQuiz.notes ||
        `${selectedQuiz.chapterName || ''} — ${selectedQuiz.subject || ''}`;

      let fresh = [];
      if (need > 0) {
        fresh = await generateReplacementQuestions(
          chapterText,
          originals,
          need
        );
      }

      if (fresh.length < need) {
        const correctOrig = originals.filter(
          (q, i) => answers[i] === (q.correctAnswer || 0)
        );
        fresh = fresh.concat(
          correctOrig.slice(0, need - fresh.length)
        );
      }

      const newQuestions = [...wrongQs, ...fresh];

      setAttemptHistory((prev) => [
        ...prev,
        { score: percentage, date: new Date() },
      ]);

      setSelectedQuiz((q) => ({
        ...q,
        questions: newQuestions,
      }));

      resetQuiz();
      setShowAITutoring(false);
      setAiExplanations({});
      await loadCompletedQuizzesAndAttempts();
      startTest();
    } catch (err) {
      console.error('Failed to prepare retake:', err);
      alert('Could not prepare your second attempt. Please try again in a moment.');
    } finally {
      setPreparingRetake(false);
    }
  };

  if (loading) {
    return <div style={styles.loading}>Loading quizzes...</div>;
  }

  // 1. Show Quiz Library
  if (!selectedQuiz) {
    return (
      <div style={styles.container}>
        <h2 style={styles.title}>📚 Interactive Quiz Library</h2>
        <p style={styles.subtitle}>Select a chapter to start learning</p>
        <QuizGrid
          quizzes={quizzes}
          isQuizBanned={isQuizBanned}
          isQuizCompleted={isQuizCompleted}
          getAttemptCount={getAttemptCount}
          setSelectedQuiz={setSelectedQuiz}
          resetQuiz={resetQuiz}
          styles={styles}
        />
      </div>
    );
  }

  // 2. Show Quiz Results
  if (showResults) {
    return (
      <QuizResults
        selectedQuiz={selectedQuiz}
        setMode={setMode}
        setSelectedQuiz={setSelectedQuiz}
        answers={answers}
        showAITutoring={showAITutoring}
        setShowAITutoring={setShowAITutoring}
        generateAITutoring={generateAITutoring}
        isLoadingAI={isLoadingAI}
        aiExplanations={aiExplanations}
        speakingIndex={speakingIndex}
        handleSpeak={handleSpeak}
        getAttemptCount={getAttemptCount}
        preparingRetake={preparingRetake}
        handleRetake={handleRetake}
        styles={styles}
      />
    );
  }

  // 3. Show Flashcards
  if (mode === 'flashcards') {
    return (
      <QuizFlashcards
        selectedQuiz={selectedQuiz}
        setMode={setMode}
        setSelectedQuiz={setSelectedQuiz}
        isQuizBanned={isQuizBanned}
        isQuizCompleted={isQuizCompleted}
        styles={styles}
      />
    );
  }

  // 4. Show Test Mode
  if (mode === 'test') {
    return (
      <QuizTest
        selectedQuiz={selectedQuiz}
        setMode={setMode}
        setSelectedQuiz={setSelectedQuiz}
        isQuizBanned={isQuizBanned}
        isQuizCompleted={isQuizCompleted}
        getAttemptCount={getAttemptCount}
        testStarted={testStarted}
        startTest={startTest}
        cheatingDetected={cheatingDetected}
        violationCount={violationCount}
        answers={answers}
        handleAnswerSelect={handleAnswerSelect}
        handleSubmitTest={handleSubmitTest}
        isSubmittingTest={isSubmittingTest}
        styles={styles}
      />
    );
  }

  return null;
};

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px'
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    fontSize: '18px',
    color: '#666'
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#ffffff',
    margin: '0 0 8px 0'
  },
  subtitle: {
    fontSize: '16px',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: '24px'
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#999'
  },
  quizGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '20px',
    marginTop: '20px'
  },
  quizCard: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '16px',
    padding: '24px',
    position: 'relative',
    transition: 'all 0.3s ease',
    overflow: 'hidden',
    backdropFilter: 'blur(4px)',
    cursor: 'pointer',
    ':hover': {
      transform: 'translateY(-4px)',
      boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
    }
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  subjectBadge: {
    backgroundColor: '#e3f2fd',
    color: '#1976d2',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: '600'
  },
  questionCount: {
    fontSize: '13px',
    color: '#666'
  },
  cardTitle: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: '16px'
  },
  cardFooter: {
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid #f0f0f0',
    color: '#6200ea',
    fontWeight: '500'
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '12px',
    marginBottom: '24px',
    width: '100%'
  },
  backButton: {
    backgroundColor: 'transparent',
    border: 'none',
    fontSize: '16px',
    color: '#cbd5e1',
    cursor: 'pointer',
    padding: '4px 0',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px'
  },
  quizTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#ffffff',
    margin: '8px 0 0 0',
    textAlign: 'left',
    width: '100%',
    lineHeight: '1.3'
  },
  modeSelector: {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px',
    borderBottom: '2px solid rgba(255, 255, 255, 0.1)',
    paddingBottom: '12px'
  },
  modeButton: {
    backgroundColor: 'transparent',
    border: 'none',
    padding: '12px 24px',
    fontSize: '16px',
    cursor: 'pointer',
    borderRadius: '8px',
    transition: 'all 0.2s',
    color: 'rgba(255, 255, 255, 0.6)'
  },
  modeButtonActive: {
    backgroundColor: '#6200ea',
    color: 'white',
    fontWeight: '600'
  },
  flashcardContainer: {
    maxWidth: '700px',
    margin: '0 auto'
  },
  progress: {
    textAlign: 'center',
    fontSize: '14px',
    color: '#666',
    marginBottom: '16px'
  },
  flashcard: {
    backgroundColor: 'white',
    border: '3px solid #6200ea',
    borderRadius: '16px',
    minHeight: '400px',
    padding: '40px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    transition: 'transform 0.3s',
    boxShadow: '0 4px 12px rgba(98, 0, 234, 0.1)'
  },
  flashcardFlipped: {
    backgroundColor: '#f3e5f5'
  },
  cardFront: {
    width: '100%'
  },
  cardBack: {
    width: '100%'
  },
  cardLabel: {
    fontSize: '14px',
    color: '#6200ea',
    fontWeight: '600',
    marginBottom: '16px',
    textTransform: 'uppercase'
  },
  cardContent: {
    fontSize: '22px',
    lineHeight: '1.6',
    color: '#333',
    fontWeight: '500'
  },
  tapHint: {
    marginTop: '24px',
    fontSize: '14px',
    color: '#999'
  },
  explanation: {
    marginTop: '24px',
    padding: '16px',
    backgroundColor: '#fff9c4',
    borderRadius: '8px',
    fontSize: '16px',
    color: '#666',
    textAlign: 'left'
  },
  navigation: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '24px',
    gap: '12px'
  },
  navButton: {
    flex: 1,
    padding: '14px 24px',
    backgroundColor: '#6200ea',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  navButtonDisabled: {
    backgroundColor: '#e0e0e0',
    color: '#999',
    cursor: 'not-allowed'
  },
  testContainer: {
    maxWidth: '800px',
    margin: '0 auto'
  },
  questionBlock: {
    backgroundColor: 'white',
    border: '2px solid #e0e0e0',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '24px'
  },
  questionNumber: {
    fontSize: '14px',
    color: '#6200ea',
    fontWeight: '600',
    marginBottom: '12px'
  },
  questionText: {
    fontSize: '18px',
    color: '#333',
    marginBottom: '20px',
    lineHeight: '1.6'
  },
  optionsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  optionButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    backgroundColor: 'white',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'left'
  },
  optionSelected: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4caf50',
    boxShadow: '0 2px 8px rgba(76, 175, 80, 0.2)'
  },
  optionLetter: {
    width: '32px',
    height: '32px',
    backgroundColor: '#f5f5f5',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '600',
    fontSize: '14px',
    flexShrink: 0
  },
  optionText: {
    fontSize: '16px',
    color: '#333',
    flex: 1
  },
  submitButton: {
    width: '100%',
    padding: '16px',
    backgroundColor: '#6200ea',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '18px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '24px'
  },
  resultsContainer: {
    maxWidth: '800px',
    margin: '0 auto'
  },
  resultsTitle: {
    textAlign: 'center',
    fontSize: '32px',
    marginBottom: '24px'
  },
  scoreCircle: {
    textAlign: 'center',
    padding: '40px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '16px',
    marginBottom: '32px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
    backdropFilter: 'blur(8px)'
  },
  scoreNumber: {
    fontSize: '64px',
    fontWeight: '700',
    color: '#4caf50',
    marginBottom: '8px'
  },
  scoreText: {
    fontSize: '18px',
    color: '#e0e7ff'
  },
  resultsList: {
    marginBottom: '24px'
  },
  resultItem: {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '16px',
    backdropFilter: 'blur(4px)'
  },
  resultHeader: {
    marginBottom: '12px'
  },
  correctBadge: {
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
    padding: '6px 12px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600'
  },
  incorrectBadge: {
    backgroundColor: '#ffebee',
    color: '#c62828',
    padding: '6px 12px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600'
  },
  resultQuestion: {
    fontSize: '16px',
    color: '#e0e7ff',
    marginBottom: '12px',
    fontWeight: '500'
  },
  resultAnswer: {
    fontSize: '15px',
    color: '#666',
    marginBottom: '8px'
  },
  resultCorrect: {
    fontSize: '15px',
    color: '#2e7d32',
    fontWeight: '500'
  },
  resultActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    flexWrap: 'wrap'
  },
  retryButton: {
    padding: '14px 28px',
    backgroundColor: '#6200ea',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  reviewButton: {
    padding: '14px 28px',
    backgroundColor: '#fff',
    color: '#6200ea',
    border: '2px solid #6200ea',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  exitButton: {
    padding: '14px 28px',
    backgroundColor: '#f5f5f5',
    color: '#666',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  aiTutoringSection: {
    background: 'rgba(98, 0, 234, 0.08)',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '32px',
    border: '2px solid rgba(98, 0, 234, 0.4)',
    backdropFilter: 'blur(8px)'
  },
  aiTutoringHeader: {
    textAlign: 'center',
    marginBottom: '20px'
  },
  aiTutoringTitle: {
    fontSize: '24px',
    color: '#6200ea',
    marginBottom: '8px',
    fontWeight: '700'
  },
  aiTutoringSubtitle: {
    fontSize: '16px',
    color: '#666',
    margin: 0
  },
  aiTutorButton: {
    width: '100%',
    padding: '16px 32px',
    backgroundColor: '#6200ea',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '18px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s',
    boxShadow: '0 4px 12px rgba(98, 0, 234, 0.3)'
  },
  aiExplanationsContainer: {
    marginTop: '20px'
  },
  loadingAI: {
    textAlign: 'center',
    padding: '40px',
    color: '#6200ea'
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '5px solid #e0e0e0',
    borderTop: '5px solid #6200ea',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 20px'
  },
  explanationsTitle: {
    fontSize: '20px',
    color: '#6200ea',
    marginBottom: '16px',
    fontWeight: '600'
  },
  aiExplanationCard: {
    background: 'rgba(255, 255, 255, 0.04)',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '16px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
  },
  explanationQuestion: {
    fontSize: '16px',
    color: '#333',
    marginBottom: '12px',
    fontWeight: '500'
  },
  explanationAnswers: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '16px'
  },
  wrongAnswer: {
    fontSize: '14px',
    color: '#c62828',
    backgroundColor: '#ffebee',
    padding: '8px 12px',
    borderRadius: '6px'
  },
  rightAnswer: {
    fontSize: '14px',
    color: '#2e7d32',
    backgroundColor: '#e8f5e9',
    padding: '8px 12px',
    borderRadius: '6px'
  },
  aiExplanationText: {
    fontSize: '15px',
    color: '#555',
    lineHeight: '1.6',
    backgroundColor: '#f9f9f9',
    padding: '16px',
    borderRadius: '8px',
    borderLeft: '4px solid #6200ea'
  },
  explanationHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  voiceButton: {
    padding: '8px 16px',
    backgroundColor: '#6200ea',
    color: 'white',
    border: 'none',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.3s',
    boxShadow: '0 2px 8px rgba(98, 0, 234, 0.2)'
  },
  voiceButtonActive: {
    backgroundColor: '#ff6b6b',
    animation: 'pulse 1.5s ease-in-out infinite'
  },
  retakeSection: {
    textAlign: 'center',
    marginTop: '24px',
    padding: '24px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
  },
  retakeMessage: {
    fontSize: '16px',
    color: '#666',
    marginBottom: '16px'
  },
  retakeButton: {
    padding: '16px 40px',
    backgroundColor: '#4caf50',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '18px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)',
    transition: 'all 0.3s'
  },
  testIntro: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px',
    padding: '20px'
  },
  testRules: {
    background: 'rgba(0, 0, 0, 0.3)',
    border: '2px solid #ff6b6b',
    borderRadius: '16px',
    padding: '40px',
    maxWidth: '600px',
    boxShadow: '0 8px 32px rgba(255, 107, 107, 0.15)',
    backdropFilter: 'blur(10px)',
    color: '#e0e7ff'
  },
  rulesTitle: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#c62828',
    marginBottom: '24px',
    textAlign: 'center'
  },
  rulesList: {
    listStyle: 'none',
    padding: '0',
    margin: '0 0 24px 0'
  },
  rulesWarning: {
    backgroundColor: '#fff3cd',
    border: '2px solid #ffc107',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '24px',
    textAlign: 'center',
    color: '#856404'
  },
  startTestButton: {
    width: '100%',
    padding: '16px',
    backgroundColor: '#2e7d32',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '18px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.3s'
  },
  warningBanner: {
    backgroundColor: '#fff3cd',
    border: '2px solid #ffc107',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '20px',
    textAlign: 'center',
    fontSize: '16px',
    fontWeight: '600',
    color: '#856404'
  },
  cheatingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '500px',
    backgroundColor: 'white',
    border: '4px solid #c62828',
    borderRadius: '16px',
    padding: '60px 40px',
    textAlign: 'center',
    boxShadow: '0 8px 32px rgba(198,40,40,0.3)'
  },
  cheatingIcon: {
    fontSize: '80px',
    marginBottom: '24px'
  },
  cheatingTitle: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#c62828',
    marginBottom: '16px'
  },
  cheatingText: {
    fontSize: '18px',
    color: '#666',
    marginBottom: '32px',
    maxWidth: '500px'
  },
  violationList: {
    backgroundColor: '#ffebee',
    border: '2px solid #ef5350',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '32px',
    textAlign: 'left'
  },
  cheatingWarning: {
    backgroundColor: '#fff3cd',
    border: '2px solid #ffc107',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '24px',
    fontSize: '16px',
    fontWeight: '600',
    color: '#856404'
  },
  cheatingNote: {
    fontSize: '14px',
    color: '#999',
    fontStyle: 'italic',
    marginBottom: '24px'
  },
  bannedCard: {
    border: '3px solid #c62828',
    backgroundColor: '#ffebee'
  },
  bannedBadge: {
    backgroundColor: '#c62828',
    color: 'white',
    padding: '4px 10px',
    borderRadius: '16px',
    fontSize: '11px',
    fontWeight: '700',
    display: 'inline-block'
  }
};

export default QuizletStyle;
