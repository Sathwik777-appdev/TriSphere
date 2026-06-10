import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, setDoc, getDoc, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { logActivity, awardBadge } from '../services/firestoreService';
import { callAIProxy, generateReplacementQuestions } from '../services/aiService';
import { safeLocalStorage } from '../utils/storage';
import { offlineDB, isOffline } from '../utils/offlineDB';

export const QuizletStyle = ({ selectedSubject }) => {
  const { userData } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [mode, setMode] = useState('flashcards'); // flashcards, test, learn
  const [currentCard, setCurrentCard] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Add refs to prevent infinite loop and unmounted state updates
  const isMountedRef = useRef(true);
  const bannedRef = useRef(false);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const [isFlipped, setIsFlipped] = useState(false);
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cheatingDetected, setCheatingDetected] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const [testStarted, setTestStarted] = useState(false);
  const [bannedQuizzes, setBannedQuizzes] = useState([]);
  const [completedQuizzes, setCompletedQuizzes] = useState([]);
  const [showAITutoring, setShowAITutoring] = useState(false);
  const [aiExplanations, setAiExplanations] = useState({});
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [attemptHistory, setAttemptHistory] = useState([]);
  const [speakingIndex, setSpeakingIndex] = useState(null);
  const [speechSynthesis] = useState(() => window.speechSynthesis);
  const [quizAttempts, setQuizAttempts] = useState({});
  // True while we're calling the AI to generate fresh questions for the
  // second attempt (so the retake button can show a spinner and we don't
  // start the test until the new questions land).
  const [preparingRetake, setPreparingRetake] = useState(false);
  const [isSubmittingTest, setIsSubmittingTest] = useState(false);

  useEffect(() => {
    let isMounted = true;
    fetchQuizzes(isMounted);
    loadBannedQuizzes();
    loadCompletedQuizzesAndAttempts();
    return () => { isMounted = false; };
  }, [userData, selectedSubject]);

  // Reload completed quizzes and attempts when a quiz is selected
  useEffect(() => {
    // Handle Visibility Change (Tab Switch/Minimize)
    const handleVisibilityChange = async () => {
      if (document.hidden && hasStarted && !isCompleted && !bannedRef.current) {
        bannedRef.current = true;
        try {
          await saveMalpracticeRecord(
            userId,
            studentName,
            schoolName,
            subject,
            chapterName,
            quizId,
            "Navigated away from tab/minimized window during active quiz."
          );
        } catch (err) {
          console.error("Failed to save malpractice:", err);
        }
        
        if (!isMountedRef.current) return;
        
        setMalpracticeWarning("You navigated away from the quiz tab. Your attempt is invalidated and your teacher has been notified.");
        setIsCompleted(true);
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(err => console.error(err));
        }
      }
    };

    // Handle Window Blur (Split Screen/Losing Focus)
    const handleBlur = async () => {
      if (hasStarted && !isCompleted && !bannedRef.current) {
        blurTimeout.current = setTimeout(async () => {
          if (!isCompleted && !bannedRef.current) {
            bannedRef.current = true;
            try {
              await saveMalpracticeRecord(
                userId,
                studentName,
                schoolName,
                subject,
                chapterName,
                quizId,
                "Quiz window lost focus (potential split-screen or switching apps)."
              );
            } catch (err) {
              console.error("Failed to save malpractice:", err);
            }
            
            if (!isMountedRef.current) return;
            
            setMalpracticeWarning("You opened another app or split screen. Your attempt is invalidated and your teacher has been notified.");
            setIsCompleted(true);
            if (document.fullscreenElement) {
              document.exitFullscreen().catch(err => console.error(err));
            }
          }
        }, 3000);
      }
    };
    if (selectedQuiz && userData?.uid) {
      loadCompletedQuizzesAndAttempts();
    }
  }, [selectedQuiz, userData?.uid]);

  // Log activity when taking quiz in test mode
  useEffect(() => {
    if (mode === 'test' && testStarted && userData?.uid) {
      // Log immediately when quiz starts
      logActivity(userData.uid, selectedSubject, 'quiz_test_start').catch(console.error);

      // Log every 5 minutes during quiz
      const activityInterval = setInterval(() => {
        if (!showResults) {
          logActivity(userData.uid, selectedSubject, 'quiz_test_ongoing').catch(console.error);
        }
      }, 5 * 60 * 1000);

      return () => clearInterval(activityInterval);
    }
  }, [mode, testStarted, userData, showResults]);

  // Anti-cheating detection for test mode
  useEffect(() => {
    if (mode === 'test' && testStarted && !showResults && !cheatingDetected) {
      let violations = 0;
      let blurTimeout = null;

      // Detect tab/window switch (visibility change) - Most reliable method
      const handleVisibilityChange = async () => {
        if (document.hidden) {
          violations++;
          setViolationCount(prev => prev + 1);
          console.warn('⚠️ Cheating detected: Tab switched or minimized');

          setCheatingDetected(true);

          // Save malpractice record
          const reason = 'Switched tabs or minimized window during test';
          await saveMalpracticeRecord(reason);

          // Ban this quiz permanently for this user
          if (selectedQuiz?.id) {
            banQuizForUser(selectedQuiz.id);
          }

          alert('⚠️ Malpractice Detected!\n\nYou switched tabs or minimized the window during the test.\n\nYour test has been terminated and marked as invalid.\n\n⛔ You are now PERMANENTLY BANNED from taking this quiz again!');
        }
      };

      // Detect when user tries to leave the page
      const handleBeforeUnload = (e) => {
        e.preventDefault();
        e.returnValue = 'You are in the middle of a test. Are you sure you want to leave?';
        return e.returnValue;
      };

      // Detect focus loss with delay to avoid false positives from alerts/browser UI
      const handleBlur = () => {
        // Only trigger if window stays unfocused for 2 seconds (user actually left)
        blurTimeout = setTimeout(async () => {
          if (!document.hasFocus() && !document.hidden) {
            violations++;
            setViolationCount(prev => prev + 1);
            console.warn('⚠️ Cheating detected: Window lost focus for extended period');

            setCheatingDetected(true);

            // Save malpractice record
            const reason = 'Switched to another application during test';
            await saveMalpracticeRecord(reason);

            // Ban this quiz permanently for this user
            if (selectedQuiz?.id) {
              banQuizForUser(selectedQuiz.id);
            }

            alert('⚠️ Malpractice Detected!\n\nYou switched to another application during the test.\n\nYour test has been terminated and marked as invalid.\n\n⛔ You are now PERMANENTLY BANNED from taking this quiz again!');
          }
        }, 2000);
      };

      const handleFocus = () => {
        // Cancel blur timeout if user comes back quickly (was just clicking browser UI)
        if (blurTimeout) {
          clearTimeout(blurTimeout);
          blurTimeout = null;
        }
      };

      // Detect right-click (prevent copying)
      const handleContextMenu = (e) => {
        e.preventDefault();
        alert('Right-click is disabled during the test.');
      };

      // Detect copy/paste attempts
      const handleCopy = async (e) => {
        e.preventDefault();
        violations++;
        setViolationCount(prev => prev + 1);

        setCheatingDetected(true);

        // Save malpractice record
        const reason = 'Attempted to copy content (Ctrl+C) during test';
        await saveMalpracticeRecord(reason);

        // Ban this quiz permanently for this user
        if (selectedQuiz?.id) {
          banQuizForUser(selectedQuiz.id);
        }

        alert('⚠️ Malpractice Detected!\n\nYou attempted to copy content during the test.\n\nYour test has been terminated and marked as invalid.\n\n⛔ You are now PERMANENTLY BANNED from taking this quiz again!');
      };

      // Detect screenshot attempts (various methods)
      const handleKeyDown = async (e) => {
        // Print Screen, Windows+Shift+S, etc.
        if (
          e.key === 'PrintScreen' ||
          (e.key === 'Print') ||
          (e.metaKey && e.shiftKey && e.key === 's') ||
          (e.metaKey && e.shiftKey && e.key === 'S')
        ) {
          e.preventDefault();
          violations++;
          setViolationCount(prev => prev + 1);

          setCheatingDetected(true);

          const reason = 'Attempted to take screenshot during test';
          await saveMalpracticeRecord(reason);

          if (selectedQuiz?.id) {
            banQuizForUser(selectedQuiz.id);
          }

          alert('⚠️ Malpractice Detected!\n\nYou attempted to take a screenshot during the test.\n\nYour test has been terminated and marked as invalid.\n\n⛔ You are now PERMANENTLY BANNED from taking this quiz again!');
        }
      };

      // Detect back button
      const handlePopState = async (e) => {
        e.preventDefault();
        violations++;
        setViolationCount(prev => prev + 1);

        setCheatingDetected(true);

        const reason = 'Attempted to navigate back during test';
        await saveMalpracticeRecord(reason);

        if (selectedQuiz?.id) {
          banQuizForUser(selectedQuiz.id);
        }

        alert('⚠️ Malpractice Detected!\n\nYou attempted to navigate back during the test.\n\nYour test has been terminated and marked as invalid.\n\n⛔ You are now PERMANENTLY BANNED from taking this quiz again!');
      };

      // Add event listeners
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('beforeunload', handleBeforeUnload);
      window.addEventListener('blur', handleBlur);
      window.addEventListener('focus', handleFocus);
      document.addEventListener('contextmenu', handleContextMenu);
      document.addEventListener('copy', handleCopy);
      document.addEventListener('paste', handleCopy);
      document.addEventListener('cut', handleCopy);
      document.addEventListener('keydown', handleKeyDown);
      window.addEventListener('popstate', handlePopState);

      // Cleanup
      return () => {
        if (blurTimeout) clearTimeout(blurTimeout);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('beforeunload', handleBeforeUnload);
        window.removeEventListener('blur', handleBlur);
        window.removeEventListener('focus', handleFocus);
        document.removeEventListener('contextmenu', handleContextMenu);
        document.removeEventListener('copy', handleCopy);
        document.removeEventListener('paste', handleCopy);
        document.removeEventListener('cut', handleCopy);
        document.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [mode, testStarted, showResults, cheatingDetected]);

  const fetchQuizzes = async (isMounted = true) => {
    try {
      setLoading(true);
      console.log('=== QUIZLET FETCH DEBUG ===');
      console.log('User data:', userData);
      console.log('Class from userData.class:', userData?.class);
      console.log('Class from userData.classNumber:', userData?.classNumber);

      const userClass = userData?.class || userData?.classNumber || 6;
      console.log('Using class:', userClass);

      // Check if offline - use cached data
      if (isOffline()) {
        console.log('📵 Offline mode - loading quizzes from cache');
        try {
          const cachedQuizzes = await offlineDB.getQuizzes(userClass, selectedSubject);
          if (cachedQuizzes.length > 0) {
            console.log('Found', cachedQuizzes.length, 'cached quizzes');
            setQuizzes(cachedQuizzes);
            setLoading(false);
            return;
          }
        } catch (cacheErr) {
          console.warn('Cache read failed:', cacheErr);
        }
        console.log('No cached quizzes available');
        setQuizzes([]);
        setLoading(false);
        return;
      }

      // Fetch only the relevant quizzes for this subject from Firestore
      const allQuery = query(
        collection(db, 'aiGeneratedContent'),
        where('subject', '==', selectedSubject)
      );
      const allSnapshot = await getDocs(allQuery);

      console.log('Total documents in aiGeneratedContent:', allSnapshot.docs.length);

      const allQuizzes = [];
      allSnapshot.docs.forEach(doc => {
        const data = doc.data();
        console.log(`Doc ${doc.id}:`, {
          class: data.class,
          classNumber: data.classNumber,
          subject: data.subject,
          chapterName: data.chapterName,
          quizLength: data.quiz?.length || 0
        });

        // Check both class and classNumber fields AND subject
        const docClass = data.class || data.classNumber;
        if (String(docClass) === String(userClass) &&
          data.subject === selectedSubject &&
          data.quiz && Array.isArray(data.quiz) && data.quiz.length > 0) {

          // Validate subject-chapter match
          const chapterName = (data.chapterName || '').toLowerCase();
          const physicsKeywords = ['force', 'motion', 'energy', 'velocity', 'acceleration', 'gravity', 'friction'];
          const chemistryKeywords = ['atom', 'molecule', 'chemical', 'reaction', 'acid', 'base', 'element', 'compound', 'ion'];
          const mathKeywords = ['algebra', 'geometry', 'trigonometry', 'calculus', 'equation', 'function'];
          const biologyKeywords = ['cell', 'organism', 'evolution', 'ecosystem', 'dna', 'gene', 'tissue', 'photosynthesis'];

          let expectedSubject = null;
          if (physicsKeywords.some(keyword => chapterName.includes(keyword))) expectedSubject = 'Physics';
          else if (chemistryKeywords.some(keyword => chapterName.includes(keyword))) expectedSubject = 'Chemistry';
          else if (mathKeywords.some(keyword => chapterName.includes(keyword))) expectedSubject = 'Mathematics';
          else if (biologyKeywords.some(keyword => chapterName.includes(keyword))) expectedSubject = 'Biology';

          if (expectedSubject && expectedSubject !== data.subject) {
            console.warn(`⚠️ SUBJECT MISMATCH DETECTED: Chapter "${data.chapterName}" is stored as "${data.subject}" but appears to be "${expectedSubject}" content. Document ID: ${doc.id}`);
          }

          allQuizzes.push({
            id: doc.id,
            chapterName: data.chapterName || 'Unknown Chapter',
            subject: data.subject || 'Unknown',
            questions: data.quiz,
            class: userClass,
            ...data
          });
        }
      });

      console.log('Filtered quizzes for class', userClass, 'subject', selectedSubject, ':', allQuizzes.length);
      if (!isMounted) return;
      setQuizzes(allQuizzes);

      // Cache quizzes for offline use
      if (allQuizzes.length > 0) {
        try {
          await offlineDB.saveQuizzes(allQuizzes);
          console.log('✅ Quizzes cached for offline use');
        } catch (cacheErr) {
          console.warn('Failed to cache quizzes:', cacheErr);
        }
      }
    } catch (err) {
      console.error('Error fetching quizzes:', err);
      // Try to load from cache on error
      try {
        const userClass = userData?.class || userData?.classNumber || 6;
        const cachedQuizzes = await offlineDB.getQuizzes(userClass, selectedSubject);
        if (cachedQuizzes.length > 0) {
          console.log('📦 Loaded', cachedQuizzes.length, 'quizzes from cache after fetch error');
          if (!isMounted) return;
          setQuizzes(cachedQuizzes);
          return;
        }
      } catch (cacheErr) {
        console.warn('Cache fallback failed:', cacheErr);
      }
      if (!isMounted) return;
      setQuizzes([]);
    } finally {
      if (isMounted) setLoading(false);
    }
  };

  const loadBannedQuizzes = async () => {
    if (!userData?.uid) return;

    try {
      const banDocRef = doc(db, 'quizBans', userData.uid);
      const banDoc = await getDoc(banDocRef);

      if (banDoc.exists()) {
        const bannedIds = banDoc.data().bannedQuizzes || [];
        setBannedQuizzes(bannedIds);
        console.log('Loaded banned quizzes:', bannedIds);
      }
    } catch (err) {
      console.error('Error loading banned quizzes:', err);
    }
  };

  const banQuizForUser = async (quizId) => {
    if (!userData?.uid) return;

    try {
      const banDocRef = doc(db, 'quizBans', userData.uid);
      const banDoc = await getDoc(banDocRef);

      const currentBanned = banDoc.exists() ? (banDoc.data().bannedQuizzes || []) : [];
      const updatedBanned = [...currentBanned, quizId];

      await setDoc(banDocRef, {
        userId: userData.uid,
        bannedQuizzes: updatedBanned,
        lastUpdated: new Date()
      });

      setBannedQuizzes(updatedBanned);
      console.log('Quiz banned:', quizId);
    } catch (err) {
      console.error('Error banning quiz:', err);
    }
  };

  const isQuizBanned = (quizId) => {
    return bannedQuizzes.includes(quizId);
  };

  const loadCompletedQuizzesAndAttempts = async () => {
    if (!userData?.uid) return;

    try {
      const q = query(
        collection(db, 'quizResults'),
        where('studentId', '==', userData.uid)
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const completedIds = snapshot.docs.map(doc => doc.data().quizId);
        setCompletedQuizzes(completedIds);
        console.log('Loaded completed quizzes:', completedIds);

        const attempts = {};
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.malpractice === false) {
            const quizId = data.quizId;
            attempts[quizId] = (attempts[quizId] || 0) + 1;
          }
        });
        setQuizAttempts(attempts);
        console.log('Loaded quiz attempts:', attempts);
      } else {
        setCompletedQuizzes([]);
        setQuizAttempts({});
      }
    } catch (err) {
      console.error('Error loading completed quizzes and attempts:', err);
    }
  };

  const isQuizCompleted = (quizId) => {
    return completedQuizzes.includes(quizId);
  };

  const getAttemptCount = (quizId) => {
    return quizAttempts[quizId] || 0;
  };

  const saveMalpracticeRecord = async (reason) => {
    if (!userData?.uid || !selectedQuiz) return;

    try {
      await addDoc(collection(db, 'quizResults'), {
        studentId: userData.uid,
        studentName: userData.name || 'Student',
        quizId: selectedQuiz.id,
        chapterName: selectedQuiz.chapterName,
        subject: selectedQuiz.subject,
        class: userData.class || userData.classNumber,
        totalQuestions: selectedQuiz.questions.length,
        correctAnswers: 0,
        score: 0,
        answers: {},
        completedAt: Timestamp.now(),
        malpractice: true,
        malpracticeReason: reason
      });
      console.log('Malpractice record saved');
    } catch (err) {
      console.error('Error saving malpractice record:', err);
    }
  };

  const handleFlipCard = () => {
    setIsFlipped(!isFlipped);
  };

  const handleNextCard = () => {
    if (currentCard < selectedQuiz.questions.length - 1) {
      setCurrentCard(currentCard + 1);
      setIsFlipped(false);
    }
  };

  const handlePrevCard = () => {
    if (currentCard > 0) {
      setCurrentCard(currentCard - 1);
      setIsFlipped(false);
    }
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

    // Save quiz result to Firestore with attempt tracking
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

      // Validate subject matches selected subject
      if (selectedQuiz.subject && selectedQuiz.subject !== selectedSubject) {
        console.warn(`⚠️ SUBJECT MISMATCH: Saving quiz result for "${selectedQuiz.chapterName}" with subject "${selectedQuiz.subject}" but currently viewing "${selectedSubject}". This quiz may appear in the wrong subject category.`);
      }

      await addDoc(collection(db, 'quizResults'), quizResult);

      if (correct === totalQuestions) {
        try {
          await awardBadge(userData?.uid, 'genius');
        } catch (e) {
          console.warn('Failed to award genius badge:', e);
        }
      }

      // Save to localStorage for immediate progress display
      const existingResults = safeLocalStorage.get('quizResults', []);
      existingResults.push({ ...quizResult, completedAt: new Date() });
      safeLocalStorage.set('quizResults', existingResults);

      // Update student progress stats - only count the best score
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

      // Mark quiz as completed
      setCompletedQuizzes(prev => [...prev, selectedQuiz.id]);
      console.log(`Quiz result saved successfully - Attempt ${attemptNumber}, Score: ${percentage}%${improvement ? `, Improvement: ${improvement > 0 ? '+' : ''}${improvement}%` : ''}`);

      // Reload attempts to update count
      await loadCompletedQuizzesAndAttempts();
    } catch (err) {
      console.error('Error saving quiz result:', err);
    } finally {
      setIsSubmittingTest(false);
    }

    setShowResults(true);
  };

  const resetQuiz = () => {
    setCurrentCard(0);
    setIsFlipped(false);
    setAnswers({});
    setShowResults(false);
    // Don't reset cheatingDetected - ban should persist
    setViolationCount(0);
    setTestStarted(false);
  };

  const startTest = () => {
    // Check if quiz is banned before starting
    if (selectedQuiz && isQuizBanned(selectedQuiz.id)) {
      alert('⛔ Quiz Banned\n\nYou are permanently banned from taking this quiz due to previous malpractice.\n\nContact your teacher if you believe this is an error.');
      return;
    }

    // Check attempt limit (use quiz-specific maxAttempts or default to 2)
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

    alert(`⚠️ Test Rules:\n\n1. Do NOT switch tabs or minimize the window\n2. Do NOT open other applications\n3. Do NOT take screenshots or copy content\n4. Do NOT use back button\n5. Stay focused on this test\n\n${attemptMessage}\n\n⚠️ IMPORTANT: Any malpractice will PERMANENTLY BAN you from this quiz!\n\nViolations include: switching tabs, minimizing, copying (Ctrl+C), screenshots, going back.`);
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

  const handleSpeak = (text, index) => {
    // Stop any ongoing speech
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }

    // If clicking the same one that's speaking, just stop
    if (speakingIndex === index) {
      setSpeakingIndex(null);
      return;
    }

    // Create new utterance
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9; // Slightly slower for clarity
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.lang = 'en-IN'; // Indian English

    // Set Indian English voice if available
    const voices = speechSynthesis.getVoices();
    const indianVoice = voices.find(voice =>
      voice.lang === 'en-IN' ||
      voice.lang.startsWith('en-IN') ||
      voice.name.toLowerCase().includes('india')
    );
    if (indianVoice) {
      utterance.voice = indianVoice;
    }

    utterance.onstart = () => setSpeakingIndex(index);
    utterance.onend = () => setSpeakingIndex(null);
    utterance.onerror = () => setSpeakingIndex(null);

    speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
      setSpeakingIndex(null);
    }
  };

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
      }
    };
  }, []);

  if (loading) {
    return <div style={styles.loading}>Loading quizzes...</div>;
  }

  if (!selectedQuiz) {
    return (
      <div style={styles.container}>
        <h2 style={styles.title}>📚 Interactive Quiz Library</h2>
        <p style={styles.subtitle}>Select a chapter to start learning</p>

        {quizzes.length === 0 ? (
          <div style={styles.emptyState}>
            <p>No quizzes available yet.</p>
            <p>Your teacher needs to upload study materials first.</p>
          </div>
        ) : (
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
                      alert('⛔ Quiz Banned\n\nYou are permanently banned from taking this quiz due to previous malpractice.\n\nContact your teacher if you believe this is an error.');
                    }
                  }}
                >
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
                    <div style={{ ...styles.bannedBadge, backgroundColor: '#10b981', color: 'white', marginTop: '8px' }}>✅ COMPLETED</div>
                  )}
                  <div style={styles.cardHeader}>
                    <span style={styles.subjectBadge}>{quiz.subject}</span>
                    <span style={styles.questionCount}>
                      {quiz.questions.length} questions
                    </span>
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
        )}
      </div>
    );
  }

  // Flashcard Mode
  if (mode === 'flashcards') {
    const question = selectedQuiz.questions[currentCard];
    const correctOption = question?.options?.[question.correctAnswer] || 'No answer available';

    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <button onClick={() => setSelectedQuiz(null)} style={styles.backButton}>
            ← Back
          </button>
          <h2 style={styles.title}>{selectedQuiz.chapterName}</h2>
        </div>

        <div style={styles.modeSelector}>
          <button
            onClick={() => setMode('flashcards')}
            style={{ ...styles.modeButton, ...(mode === 'flashcards' ? styles.modeButtonActive : {}) }}
          >
            🎴 Flashcards
          </button>
          <button
            onClick={() => { setMode('test'); resetQuiz(); }}
            style={{ ...styles.modeButton, ...(mode === 'test' ? styles.modeButtonActive : {}) }}
          >
            📝 Test
          </button>
        </div>

        <div style={styles.flashcardContainer}>
          <div style={styles.progress}>
            Card {currentCard + 1} of {selectedQuiz.questions.length}
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
              style={{ ...styles.navButton, ...(currentCard === 0 ? styles.navButtonDisabled : {}) }}
            >
              ← Previous
            </button>
            <button
              onClick={handleNextCard}
              disabled={currentCard === selectedQuiz.questions.length - 1}
              style={{ ...styles.navButton, ...(currentCard === selectedQuiz.questions.length - 1 ? styles.navButtonDisabled : {}) }}
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Test Mode
  if (mode === 'test') {
    // Show cheating detected screen
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
              <li>Switching tabs or minimizing the window</li>
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

    if (showResults) {
      const correctCount = selectedQuiz.questions.filter(
        (q, idx) => (q && typeof q.correctAnswer === 'number' && answers[idx] === q.correctAnswer) ||
          (!q.correctAnswer && answers[idx] === 0)
      ).length;
      const percentage = Math.round((correctCount / selectedQuiz.questions.length) * 100);
      const incorrectCount = selectedQuiz.questions.length - correctCount;

      // Prepare incorrect questions for AI tutoring
      const incorrectQuestions = selectedQuiz.questions
        .map((q, idx) => ({
          index: idx,
          question: q.question,
          studentAnswer: (q.options || ['A', 'B', 'C', 'D'])[answers[idx]],
          correctAnswer: (q.options || ['A', 'B', 'C', 'D'])[q.correctAnswer || 0],
          isCorrect: answers[idx] === (q.correctAnswer || 0)
        }))
        .filter(item => !item.isCorrect);

      return (
        <div style={styles.container}>
          <div style={styles.resultsContainer}>
            <h2 style={styles.resultsTitle}>📊 Test Results</h2>
            <div style={styles.scoreCircle}>
              <div style={styles.scoreNumber}>{percentage}%</div>
              <div style={styles.scoreText}>
                {correctCount} / {selectedQuiz.questions.length} correct
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
                          {getAttemptCount(selectedQuiz.id) >= 2 ? (
                            <>
                              <p style={{ ...styles.retakeMessage, color: '#c62828', fontWeight: '600' }}>
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
                              <p style={{ ...styles.retakeMessage, fontSize: '14px', color: '#3b82f6', fontWeight: '600' }}>
                                📚 Attempt 2/2 will reuse the {incorrectCount} question
                                {incorrectCount > 1 ? 's' : ''} you got wrong, plus
                                {' '}{selectedQuiz.questions.length - incorrectCount} brand-new
                                question{(selectedQuiz.questions.length - incorrectCount) === 1 ? '' : 's'} on the same chapter.
                              </p>
                              <p style={{ ...styles.retakeMessage, fontSize: '13px', color: '#64748b' }}>
                                Your final mark for this chapter will be the <strong>average</strong> of both attempts.
                              </p>
                              <button
                                disabled={preparingRetake}
                                onClick={async () => {
                                  // ── Compose attempt 2 question set ──────────
                                  // = the questions wrong on attempt 1, PLUS
                                  //   freshly-generated questions on the same
                                  //   chapter to bring the total back to the
                                  //   original count (default 10). If the AI
                                  //   doesn't return enough, we pad from
                                  //   correctly-answered originals so the
                                  //   student still gets a full-length quiz.
                                  setPreparingRetake(true);
                                  try {
                                    const originals = selectedQuiz.questions;
                                    const wrongIdx = originals
                                      .map((q, i) => (answers[i] !== (q.correctAnswer || 0) ? i : -1))
                                      .filter((i) => i >= 0);
                                    const wrongQs = wrongIdx.map((i) => originals[i]);
                                    const need = Math.max(0, originals.length - wrongQs.length);

                                    // Source text for the AI: prefer the
                                    // raw chapter extract if it was saved,
                                    // otherwise fall back to the generated
                                    // notes (always present), and finally
                                    // to "<chapter> – <subject>" as a last
                                    // resort.
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

                                    // Pad with correctly-answered originals
                                    // if AI returned fewer than needed —
                                    // better a slightly-easier full quiz
                                    // than a 3-question retake.
                                    if (fresh.length < need) {
                                      const correctOrig = originals.filter(
                                        (q, i) => answers[i] === (q.correctAnswer || 0)
                                      );
                                      fresh = fresh.concat(
                                        correctOrig.slice(0, need - fresh.length)
                                      );
                                    }

                                    const newQuestions = [...wrongQs, ...fresh];

                                    // Save attempt 1 to history so we can
                                    // compute the average later if needed.
                                    setAttemptHistory((prev) => [
                                      ...prev,
                                      { score: percentage, date: new Date() },
                                    ]);

                                    // Swap the quiz's question set in
                                    // place. handleSubmitTest reads from
                                    // selectedQuiz.questions on submit, so
                                    // the second attempt now grades
                                    // against this rearranged 10-pack.
                                    setSelectedQuiz((q) => ({
                                      ...q,
                                      questions: newQuestions,
                                    }));

                                    // Reset answers / showResults / etc.
                                    resetQuiz();
                                    setShowAITutoring(false);
                                    setAiExplanations({});
                                    await loadCompletedQuizzesAndAttempts();
                                    startTest();
                                  } catch (err) {
                                    console.error('Failed to prepare retake:', err);
                                    alert(
                                      'Could not prepare your second attempt. Please try again in a moment.'
                                    );
                                  } finally {
                                    setPreparingRetake(false);
                                  }
                                }}
                                style={{
                                  ...styles.retakeButton,
                                  ...(preparingRetake
                                    ? { opacity: 0.7, cursor: 'wait' }
                                    : null),
                                }}
                              >
                                {preparingRetake
                                  ? '⏳ Building your second attempt…'
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
              {selectedQuiz.questions.map((q, idx) => {
                const isCorrect = answers[idx] === (q.correctAnswer || 0);
                return (
                  <div key={idx} style={styles.resultItem}>
                    <div style={styles.resultHeader}>
                      <span style={isCorrect ? styles.correctBadge : styles.incorrectBadge}>
                        {isCorrect ? '✓ Correct' : '✗ Incorrect'}
                      </span>
                    </div>
                    <div style={styles.resultQuestion}>{q.question || `Question ${idx + 1}`}</div>
                    <div style={styles.resultAnswer}>
                      <strong>Your answer:</strong> {(q.options || ['A', 'B', 'C', 'D'])[answers[idx]] || 'Not answered'}
                    </div>
                    {!isCorrect && (
                      <div style={styles.resultCorrect}>
                        <strong>Correct answer:</strong> {(q.options || ['A', 'B', 'C', 'D'])[q.correctAnswer || 0]}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={styles.resultActions}>
              <button onClick={() => setMode('flashcards')} style={styles.reviewButton}>
                📖 Review Flashcards
              </button>
              <button onClick={() => setSelectedQuiz(null)} style={styles.exitButton}>
                ← Back to Quizzes
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <button onClick={() => setSelectedQuiz(null)} style={styles.backButton}>
            ← Back
          </button>
          <h2 style={styles.title}>{selectedQuiz.chapterName}</h2>
        </div>

        <div style={styles.modeSelector}>
          <button
            onClick={() => { setMode('flashcards'); resetQuiz(); }}
            style={{ ...styles.modeButton, ...(mode === 'flashcards' ? styles.modeButtonActive : {}) }}
          >
            🎴 Flashcards
          </button>
          <button
            onClick={() => {
              // Check if quiz is banned or completed
              if (selectedQuiz && isQuizBanned(selectedQuiz.id)) {
                alert('⛔ Test Mode Blocked\n\nYou are permanently banned from taking this quiz in test mode due to previous malpractice.\n\nYou can still use Flashcard mode to study.');
                return;
              }

              if (selectedQuiz && isQuizCompleted(selectedQuiz.id)) {
                alert('✅ Quiz Already Completed\n\nYou have already attempted this quiz. Each quiz can only be taken once.\n\nYou can review the material using Flashcard mode.');
                return;
              }

              setMode('test');
            }}
            style={{
              ...styles.modeButton,
              ...(mode === 'test' ? styles.modeButtonActive : {}),
              ...(selectedQuiz && (isQuizBanned(selectedQuiz.id) || isQuizCompleted(selectedQuiz.id)) ? { opacity: 0.5, cursor: 'not-allowed' } : {})
            }}
          >
            📝 Test {selectedQuiz && (isQuizBanned(selectedQuiz.id) || isQuizCompleted(selectedQuiz.id)) ? '🔒' : ''}
          </button>
        </div>

        {!testStarted ? (
          <div style={styles.testIntro}>
            <div style={styles.testRules}>
              <h3 style={styles.rulesTitle}>⚠️ Test Rules</h3>
              <ul style={styles.rulesList}>
                <li><strong>DO NOT</strong> switch tabs or minimize the window</li>
                <li><strong>DO NOT</strong> open other applications</li>
                <li><strong>DO NOT</strong> copy or paste content</li>
                <li><strong>Stay focused</strong> on this test window only</li>
                <li>Right-click is disabled during the test</li>
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

            {selectedQuiz.questions.map((q, qIdx) => (
              <div key={qIdx} style={styles.questionBlock}>
                <div style={styles.questionNumber}>Question {qIdx + 1}</div>
                <div style={styles.questionText}>{q.question || `Question ${qIdx + 1}`}</div>
                <div style={styles.optionsContainer}>
                  {(q.options || ['Option A', 'Option B', 'Option C', 'Option D']).map((option, oIdx) => (
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
                ...((isSubmittingTest || Object.keys(answers).length !== selectedQuiz.questions.length) ? { opacity: 0.5, cursor: 'not-allowed' } : {})
              }}
              disabled={isSubmittingTest || Object.keys(answers).length !== selectedQuiz.questions.length}
            >
              {isSubmittingTest ? 'Submitting...' : 'Submit Test'}
            </button>
          </div>
        )}
      </div>
    );
  }
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
    alignItems: 'center',
    gap: '16px',
    marginBottom: '24px'
  },
  backButton: {
    backgroundColor: 'transparent',
    border: 'none',
    fontSize: '16px',
    color: '#666',
    cursor: 'pointer',
    padding: '8px'
  },
  modeSelector: {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px',
    borderBottom: '2px solid #f0f0f0',
    paddingBottom: '12px'
  },
  modeButton: {
    backgroundColor: 'transparent',
    border: 'none',
    padding: '12px 24px',
    fontSize: '16px',
    cursor: 'pointer',
    borderRadius: '8px',
    transition: 'all 0.2s'
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
  // AI Tutoring Styles
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
    position: 'absolute',
    top: '10px',
    right: '10px',
    backgroundColor: '#c62828',
    color: 'white',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '700',
    zIndex: 10
  }
};

export default QuizletStyle;
