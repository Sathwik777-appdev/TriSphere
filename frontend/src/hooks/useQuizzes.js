import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, doc, setDoc, getDoc, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { offlineDB, isOffline } from '../utils/offlineDB';

export const useQuizzes = (userData, selectedSubject) => {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bannedQuizzes, setBannedQuizzes] = useState([]);
  const [completedQuizzes, setCompletedQuizzes] = useState([]);
  const [quizAttempts, setQuizAttempts] = useState({});

  const fetchQuizzes = useCallback(async (isMounted = true) => {
    try {
      setLoading(true);
      const userClass = userData?.class || userData?.classNumber || 6;

      if (isOffline()) {
        try {
          const cachedQuizzes = await offlineDB.getQuizzes(userClass, selectedSubject);
          if (cachedQuizzes.length > 0) {
            setQuizzes(cachedQuizzes);
            setLoading(false);
            return;
          }
        } catch (cacheErr) {
          console.warn('Cache read failed:', cacheErr);
        }
        setQuizzes([]);
        setLoading(false);
        return;
      }

      const allQuery = query(
        collection(db, 'aiGeneratedContent'),
        where('subject', '==', selectedSubject)
      );
      const allSnapshot = await getDocs(allQuery);

      const allQuizzes = [];
      allSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const docClass = data.class || data.classNumber;
        
        if (String(docClass) === String(userClass) &&
            data.subject === selectedSubject &&
            data.quiz && Array.isArray(data.quiz) && data.quiz.length > 0) {
            
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

      if (!isMounted) return;
      setQuizzes(allQuizzes);

      if (allQuizzes.length > 0) {
        offlineDB.saveQuizzes(allQuizzes).catch(err => console.warn('Cache save failed', err));
      }
    } catch (err) {
      console.error('Error fetching quizzes:', err);
      try {
        const userClass = userData?.class || userData?.classNumber || 6;
        const cachedQuizzes = await offlineDB.getQuizzes(userClass, selectedSubject);
        if (cachedQuizzes.length > 0) {
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
  }, [userData, selectedSubject]);

  const loadBannedQuizzes = useCallback(async () => {
    if (!userData?.uid) return;
    try {
      const banDocRef = doc(db, 'quizBans', userData.uid);
      const banDoc = await getDoc(banDocRef);
      if (banDoc.exists()) {
        setBannedQuizzes(banDoc.data().bannedQuizzes || []);
      }
    } catch (err) {
      console.error('Error loading banned quizzes:', err);
    }
  }, [userData?.uid]);

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
    } catch (err) {
      console.error('Error banning quiz:', err);
    }
  };

  const loadCompletedQuizzesAndAttempts = useCallback(async () => {
    if (!userData?.uid) return;
    try {
      const q = query(collection(db, 'quizResults'), where('studentId', '==', userData.uid));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        setCompletedQuizzes(snapshot.docs.map(doc => doc.data().quizId));
        const attempts = {};
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.malpractice === false) {
            attempts[data.quizId] = (attempts[data.quizId] || 0) + 1;
          }
        });
        setQuizAttempts(attempts);
      } else {
        setCompletedQuizzes([]);
        setQuizAttempts({});
      }
    } catch (err) {
      console.error('Error loading completed quizzes and attempts:', err);
    }
  }, [userData?.uid]);

  const saveMalpracticeRecord = async (reason, selectedQuiz) => {
    if (!userData?.uid || !selectedQuiz) return;
    try {
      await addDoc(collection(db, 'quizResults'), {
        studentId: userData.uid,
        studentName: userData.name || 'Student',
        quizId: selectedQuiz.id,
        chapterName: selectedQuiz.chapterName,
        subject: selectedQuiz.subject,
        class: userData.class || userData.classNumber,
        totalQuestions: selectedQuiz.questions?.length || 0,
        correctAnswers: 0,
        score: 0,
        answers: {},
        completedAt: Timestamp.now(),
        malpractice: true,
        malpracticeReason: reason
      });
    } catch (err) {
      console.error('Error saving malpractice record:', err);
    }
  };

  useEffect(() => {
    let isMounted = true;
    if (userData && selectedSubject) {
      fetchQuizzes(isMounted);
      loadBannedQuizzes();
      loadCompletedQuizzesAndAttempts();
    }
    return () => { isMounted = false; };
  }, [userData, selectedSubject, fetchQuizzes, loadBannedQuizzes, loadCompletedQuizzesAndAttempts]);

  const isQuizBanned = useCallback((quizId) => bannedQuizzes.includes(quizId), [bannedQuizzes]);
  const isQuizCompleted = useCallback((quizId) => completedQuizzes.includes(quizId), [completedQuizzes]);
  const getAttemptCount = useCallback((quizId) => quizAttempts[quizId] || 0, [quizAttempts]);

  return {
    quizzes,
    loading,
    bannedQuizzes,
    completedQuizzes,
    quizAttempts,
    fetchQuizzes,
    loadBannedQuizzes,
    banQuizForUser,
    loadCompletedQuizzesAndAttempts,
    saveMalpracticeRecord,
    isQuizBanned,
    isQuizCompleted,
    getAttemptCount
  };
};
