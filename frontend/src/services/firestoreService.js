import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  addDoc,
  arrayUnion,
  arrayRemove,
  Timestamp,
  runTransaction
} from 'firebase/firestore';
import { db } from './firebase';
import { uploadPDFToStorage } from './storageService';
import { safeLocalStorage } from '../utils/storage';

// Helper to detect mock/demo mode (when mockUser is stored in localStorage)
const isMockMode = () => {
  try {
    return !!safeLocalStorage.get('mockUser');
  } catch (e) {
    return false;
  }
};

// Some small mock datasets used when Firebase is not available to speed up dev/demo flows
const MOCK_TEXTBOOKS = [
  { id: 'm1', class: 6, subject: 'Physics', chapterName: 'Introduction', pdfURL: '#' }
];
const MOCK_ANNOUNCEMENTS = [
  { id: 'a1', title: 'Welcome', message: 'Welcome to TriSphere demo', class: 6, createdAt: new Date() }
];


// ============ TEXTBOOK MANAGEMENT ============

export const uploadTextbook = async (
  file, classNumber, subject, chapterName, userId, phetSlug = '', schoolName = ''
) => {
  try {
    if (isMockMode()) {
      // simulate upload in demo mode and persist a mock record
      const id = `mock-textbook-${Date.now()}`;
      try {
        const existing = safeLocalStorage.get('mockTextbooks', {});
        existing[id] = {
          id,
          class: classNumber,
          subject,
          chapterName,
          pdfURL: '#',
          phetSlug: phetSlug || '',
          createdBy: userId,
          createdAt: Date.now()
        };
        safeLocalStorage.set('mockTextbooks', existing);
      } catch (e) {
        console.debug('Unable to persist mock textbook:', e);
      }
      console.debug('Mock uploadTextbook called for', chapterName);
      return { uploadPromise: Promise.resolve(id), task: null, onProgress: null };
    }

    // Upload PDF to Firebase Storage
    const { uploadPDFToStorage } = await import('./storageService');
    const storageResult = await uploadPDFToStorage(file, `textbooks/${classNumber}/${subject}`);
    const pdfURL = storageResult.url;

    // Sanitize chapter name for folder use (replace spaces and special chars with _)
    const safeChapter = String(chapterName).replace(/[^a-zA-Z0-9_-]/g, '_');

    // Always create/update a matching document in Firebase 'textbooks' collection
    // Use chapterName + classNumber + subject as a unique key, sanitized
    const sanitize = str => String(str).replace(/[^a-zA-Z0-9_-]/g, '_');
    const docId = `${classNumber}_${sanitize(subject)}_${sanitize(safeChapter)}`;
    await setDoc(doc(db, 'textbooks', docId), {
      chapterName,
      class: Number(classNumber),
      subject,
      schoolName: schoolName || '',
      pdfURL,
      phetSlug,
      createdBy: userId,
      uploadedAt: new Date(),
    });

    return { uploadPromise: Promise.resolve(docId), task: null, storageResult };
  } catch (error) {
    console.error('Error uploading textbook:', error);
    throw error;
  }
};

export const getTextbooks = async (classNumber, subject) => {
  if (isMockMode()) {
    try {
      const persisted = safeLocalStorage.get('mockTextbooks', {});
      const persistedList = Object.values(persisted || {});
      const combined = [...MOCK_TEXTBOOKS, ...persistedList];
      return combined.filter(t => (!classNumber || t.class === classNumber) && (!subject || t.subject === subject));
    } catch (e) {
      return MOCK_TEXTBOOKS.filter(t => (!classNumber || t.class === classNumber) && (!subject || t.subject === subject));
    }
  }
  try {
    const userData = safeLocalStorage.get('userData');
    const isDeveloper = userData?.role === 'developer';

    const constraints = [
      where('class', '==', Number(classNumber)),
      where('subject', '==', subject)
    ];

    if (!isDeveloper) {
      constraints.push(where('schoolName', '==', userData?.schoolName || ''));
    }

    const q = query(collection(db, 'textbooks'), ...constraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting textbooks:', error);
    throw error;
  }
};

export const updateTextbookContent = async (textbookId, notesText, quizData) => {
  try {
    if (isMockMode()) {
      try {
        const existing = safeLocalStorage.get('mockTextbooks', {});
        if (!existing[textbookId]) {
          existing[textbookId] = { id: textbookId };
        }
        existing[textbookId].notesText = notesText;
        existing[textbookId].quizData = quizData;
        existing[textbookId].youtubeLinks = [];
        existing[textbookId].updatedAt = Date.now();
        safeLocalStorage.set('mockTextbooks', existing);
      } catch (e) {
        console.debug('Unable to persist mock textbook update:', e);
      }
      return;
    }
    await updateDoc(doc(db, 'textbooks', textbookId), {
      notesText,
      quizData,
      youtubeLinks: [],
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error updating textbook content:', error);
    throw error;
  }
};

// ============ ASSIGNMENT MANAGEMENT ============

export const uploadAssignment = async (file, chapterId, assignmentTitle, dueDate, classNumber, subject, userId) => {
  try {
    if (isMockMode()) {
      console.debug('Mock uploadAssignment called for', assignmentTitle);
      const mockPromise = Promise.resolve(`mock-assignment-${Date.now()}`);
      return { uploadPromise: mockPromise, task: null };
    }

    // Upload PDF to Firebase Storage
    const { uploadPDFToStorage } = await import('./storageService');
    const storageResult = await uploadPDFToStorage(file, `assignments/${classNumber}/${subject}`);
    const assignmentPdfURL = storageResult.url;

    // Save assignment metadata (simulate Firestore, or use localStorage/mock)
    // You may want to implement a GitHub metadata save or use a JSON file in the repo
    // For now, just return the URL
    return { uploadPromise: Promise.resolve(assignmentPdfURL), task: null };
  } catch (error) {
    console.error('Error uploading assignment:', error);
    throw error;
  }
};

export const getAssignments = async (classNumber, subject) => {
  if (isMockMode()) {
    return [];
  }
  try {
    const userData = safeLocalStorage.get('userData');
    const isDeveloper = userData?.role === 'developer';

    const constraints = [
      where('class', '==', Number(classNumber)),
      where('subject', '==', subject)
    ];

    if (!isDeveloper) {
      constraints.push(where('schoolName', '==', userData?.schoolName || ''));
    }

    const q = query(collection(db, 'assignments'), ...constraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting assignments:', error);
    throw error;
  }
};

// ============ STUDENT PROGRESS ============

export const getStudentProgress = async (classNumber) => {
  if (isMockMode()) {
    return [
      { id: 's1', name: 'Demo Student', completionPercent: 75, quizScore: 80, overallPerformance: 78 }
    ];
  }
  try {
    const schoolName = safeLocalStorage.get('userData')?.schoolName || '';

    // 1. Get all students in class
    const studentsQuery = query(
      collection(db, 'users'),
      where('class', '==', Number(classNumber)),
      where('role', '==', 'student'),

      where('schoolName', '==', schoolName)
    );
    const studentsSnapshot = await getDocs(studentsQuery);
    const students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (students.length === 0) return [];

    // 2. Get all assignments for this class once
    const assignmentsQuery = query(
      collection(db, 'assignments'),
      where('class', '==', Number(classNumber))
    );
    const assignmentsSnapshot = await getDocs(assignmentsQuery);
    const totalAssignments = assignmentsSnapshot.size;

    // 3. Get all submissions relevant to these students
    // Optimization: Fetch only submissions for the students in this class using chunked "in" queries
    const studentIds = students.map(s => s.id);
    const allSubmissions = [];
    
    // Firestore "in" query limit is 30 elements
    for (let i = 0; i < studentIds.length; i += 30) {
      const chunk = studentIds.slice(i, i + 30);
      const subQuery = query(
        collection(db, 'studentSubmissions'),
        where('studentId', 'in', chunk)
      );
      const subSnapshot = await getDocs(subQuery);
      subSnapshot.docs.forEach(doc => allSubmissions.push(doc.data()));
    }

    const progressData = students.map(student => {
      const studentSubmissions = allSubmissions.filter(s => s.studentId === student.id);
      const completedAssignments = studentSubmissions.length;
      const completionPercent = totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0;

      const gradedSubmissions = studentSubmissions.filter(s => s.marks !== undefined);
      const avgScore = gradedSubmissions.length > 0
        ? Math.round(gradedSubmissions.reduce((sum, s) => sum + (s.marks || 0), 0) / gradedSubmissions.length)
        : 0;

      return {
        id: student.id,
        name: student.username,
        completionPercent,
        quizScore: avgScore,
        overallPerformance: avgScore
      };
    });

    return progressData;
  } catch (error) {
    console.error('Error getting student progress:', error);
    throw error;
  }
};

// ============ SUBMISSIONS ============

export const submitAssignment = async (submissionData) => {
  try {
    const submissionRef = await addDoc(collection(db, 'studentSubmissions'), {
      ...submissionData,
      submittedAt: Timestamp.now(),
      marks: submissionData.marks || 0,
      feedback: submissionData.feedback || ''
    });

    return submissionRef.id;
  } catch (error) {
    console.error('Error submitting assignment:', error);
    throw error;
  }
};

export const updateSubmissionGrade = async (submissionId, marks, feedback) => {
  try {
    await updateDoc(doc(db, 'studentSubmissions', submissionId), {
      marks,
      feedback,
      gradedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error updating submission grade:', error);
    throw error;
  }
};

export const getStudentSubmissions = async (studentId) => {
  try {
    const q = query(collection(db, 'studentSubmissions'), where('studentId', '==', studentId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting student submissions:', error);
    throw error;
  }
};

// ============ ANNOUNCEMENTS ============

export const createAnnouncement = async (title, message, classNumber, userId) => {
  try {
    const announcementRef = await addDoc(collection(db, 'announcements'), {
      title,
      message,
      class: classNumber,
      createdBy: userId,
      createdAt: Timestamp.now(),
      seenByStudents: [],
      seenByParents: []
    });

    return announcementRef.id;
  } catch (error) {
    console.error('Error creating announcement:', error);
    throw error;
  }
};

export const getAnnouncements = async (classNumber) => {
  if (isMockMode()) {
    return MOCK_ANNOUNCEMENTS.filter(a => !classNumber || a.class === classNumber);
  }
  try {
    const userData = safeLocalStorage.get('userData');
    const isDeveloper = userData?.role === 'developer';

    const constraints = [where('class', '==', Number(classNumber))];

    if (!isDeveloper) {
      constraints.push(where('schoolName', '==', userData?.schoolName || ''));
    }

    const q = query(collection(db, 'announcements'), ...constraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting announcements:', error);
    throw error;
  }
};

export const markAnnouncementAsRead = async (announcementId, userId, userRole) => {
  try {
    const field = userRole === 'student' ? 'seenByStudents' : 'seenByParents';
    await updateDoc(doc(db, 'announcements', announcementId), {
      [field]: arrayUnion(userId)
    });
  } catch (error) {
    console.error('Error marking announcement as read:', error);
    throw error;
  }
};

// ============ ANALYTICS & ACTIVITY ============

export const logActivity = async (userId, subject = null, action = 'dashboard_visit') => {
  if (isMockMode()) {
    // quick no-op for demo
    return Promise.resolve();
  }
  try {
    // Update analytics collection
    const analyticsRef = doc(db, 'analytics', userId);
    const analyticsDoc = await getDoc(analyticsRef);

    if (analyticsDoc.exists()) {
      const data = analyticsDoc.data();
      await updateDoc(analyticsRef, {
        lastActiveAt: Timestamp.now(),
        sessionsPerWeek: (data.sessionsPerWeek || 0) + 1
      });
    } else {
      await setDoc(analyticsRef, {
        progressPercentage: 0,
        weeklyUsage: 0,
        streakDays: 0,
        lastActiveAt: Timestamp.now(),
        sessionsPerWeek: 1
      });
    }

    // Also create an activity log entry for attendance tracking
    await addDoc(collection(db, 'activityLogs'), {
      userId: userId,
      timestamp: Timestamp.now(),
      action: action
    });

    // Create subject-specific activity for streak tracking
    if (subject) {
      await addDoc(collection(db, 'studentActivity'), {
        studentId: userId,
        subject: subject,
        timestamp: Timestamp.now(),
        action: action,
        date: new Date().toDateString()
      });
    }
  } catch (error) {
    console.error('Error logging activity:', error);
    throw error;
  }
};

export const getAnalytics = async (userId) => {
  try {
    const analyticsDoc = await getDoc(doc(db, 'analytics', userId));
    if (analyticsDoc.exists()) {
      return analyticsDoc.data();
    }
    return null;
  } catch (error) {
    console.error('Error getting analytics:', error);
    throw error;
  }
};

export const getActiveStudents = async (classNumber, hoursThreshold = 24) => {
  if (isMockMode()) {
    return [];
  }
  try {
    const cutoffTime = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000);
    const students = [];

    const userData = safeLocalStorage.get('userData');
    const isDeveloper = userData?.role === 'developer';

    const constraints = [
      where('class', '==', Number(classNumber)),
      where('role', '==', 'student')
    ];

    if (!isDeveloper) {
      constraints.push(where('schoolName', '==', userData?.schoolName || ''));
    }

    const q = query(collection(db, 'users'), ...constraints);
    const studentsSnapshot = await getDocs(q);

    for (const studentDoc of studentsSnapshot.docs) {
      const analyticsDoc = await getDoc(doc(db, 'analytics', studentDoc.id));
      if (analyticsDoc.exists()) {
        const lastActive = analyticsDoc.data().lastActiveAt?.toDate();
        if (lastActive && lastActive > cutoffTime) {
          students.push({
            id: studentDoc.id,
            ...studentDoc.data(),
            lastActive
          });
        }
      }
    }

    return students;
  } catch (error) {
    console.error('Error getting active students:', error);
    throw error;
  }
};

// ============ GAMIFICATION ============

export const getGamificationData = async (studentId) => {
  if (isMockMode()) {
    return {
      xp: 1200,
      level: 2,
      badges: ['demo-badge']
    };
  }
  try {
    const gamificationDoc = await getDoc(doc(db, 'gamification', studentId));
    if (gamificationDoc.exists()) {
      return gamificationDoc.data();
    }
    return {
      xp: 0,
      level: 1,
      badges: []
    };
  } catch (error) {
    console.error('Error getting gamification data:', error);
    throw error;
  }
};

export const addXP = async (studentId, xpPoints) => {
  try {
    const gamificationRef = doc(db, 'gamification', studentId);
    await runTransaction(db, async (transaction) => {
      const gamificationDoc = await transaction.get(gamificationRef);

      if (gamificationDoc.exists()) {
        const data = gamificationDoc.data();
        const newXP = (data.xp || 0) + xpPoints;
        const newLevel = Math.floor(newXP / 1000) + 1;

        transaction.update(gamificationRef, {
          xp: newXP,
          level: newLevel
        });
      } else {
        transaction.set(gamificationRef, {
          xp: xpPoints,
          level: 1,
          badges: []
        });
      }
    });
  } catch (error) {
    console.error('Error adding XP:', error);
    throw error;
  }
};

export const addBadge = async (studentId, badgeName) => {
  try {
    await updateDoc(doc(db, 'gamification', studentId), {
      badges: arrayUnion(badgeName)
    });
  } catch (error) {
    console.error('Error adding badge:', error);
    throw error;
  }
};

// ============ PARENT FUNCTIONALITY ============

export const getParentChildren = async (parentId) => {
  try {
    const parentDoc = await getDoc(doc(db, 'parents', parentId));
    if (!parentDoc.exists()) {
      return [];
    }

    const childrenIds = parentDoc.data().childrenIds || parentDoc.data().childIds || [];
    const children = await Promise.all(
      childrenIds.map(async (childId) => {
        const childDoc = await getDoc(doc(db, 'users', childId));
        if (childDoc.exists()) {
          return { id: childId, ...childDoc.data() };
        }
        return null;
      })
    );

    return children.filter(child => child !== null);
  } catch (error) {
    console.error('Error getting parent children:', error);
    throw error;
  }
};

export const getChildAnalytics = async (studentId) => {
  try {
    const submissions = await getStudentSubmissions(studentId);
    const analytics = await getAnalytics(studentId);

    const totalMarks = submissions.reduce((sum, s) => sum + (s.marks || 0), 0);
    const avgScore = submissions.length > 0 ? Math.round(totalMarks / submissions.length) : 0;

    return {
      avgScore,
      completedAssignments: submissions.length,
      lastActive: analytics?.lastActiveAt?.toDate(),
      weeklyEngagement: analytics?.sessionsPerWeek || 0
    };
  } catch (error) {
    console.error('Error getting child analytics:', error);
    throw error;
  }
};

export const markParentAnnouncementRead = async (announcementId, parentId) => {
  try {
    await updateDoc(doc(db, 'announcements', announcementId), {
      seenByParents: arrayUnion(parentId)
    });
  } catch (error) {
    console.error('Error marking announcement as read by parent:', error);
    throw error;
  }
};
// ============ CHAT SYNCHRONIZATION ============

/**
 * Saves a chat session or message to Firestore for cross-device synchronization.
 */
export const saveChatSession = async (userId, sessionId, messages) => {
  if (!userId || !sessionId || isMockMode()) return;

  try {
    const sessionRef = doc(db, 'studentChats', `${userId}_${sessionId}`);
    const firstUserMsg = messages.find(m => m.role === 'user')?.content || 'New Chat';
    const title = firstUserMsg.substring(0, 40) + (firstUserMsg.length > 40 ? '...' : '');

    await setDoc(sessionRef, {
      userId,
      sessionId,
      title,
      messages,
      updatedAt: Timestamp.now(),
      device: 'cross-platform'
    });
  } catch (error) {
    console.error('Error saving chat to cloud:', error);
  }
};

/**
 * Fetches all chat sessions for a specific user from Firestore.
 */
export const getChatSessions = async (userId) => {
  if (!userId || isMockMode()) return [];

  try {
    const q = query(
      collection(db, 'studentChats'),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data()).sort((a, b) => {
      const timeA = a.updatedAt?.toMillis() || 0;
      const timeB = b.updatedAt?.toMillis() || 0;
      return timeB - timeA;
    });
  } catch (error) {
    console.error('Error fetching chats from cloud:', error);
    return [];
  }
};

// ============ AI RESPONSE CACHING ============

/**
 * Searches Firestore for a previously generated AI lesson to save API calls
 */
export const getCachedLesson = async (topic, classNumber, subject) => {
  if (isMockMode()) return null;
  
  try {
    const sanitize = str => String(str).replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const docId = `cache_${classNumber}_${sanitize(subject)}_${sanitize(topic)}`;
    
    const cacheDoc = await getDoc(doc(db, 'cachedLessons', docId));
    if (cacheDoc.exists()) {
      return cacheDoc.data();
    }
    return null;
  } catch (error) {
    console.error('Error getting cached lesson:', error);
    return null; // Fail silently so the app can fallback to normal generation
  }
};

/**
 * Saves a newly generated AI lesson to Firestore for future users
 */
export const saveCachedLesson = async (topic, classNumber, subject, data) => {
  if (isMockMode()) return;
  
  try {
    const sanitize = str => String(str).replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const docId = `cache_${classNumber}_${sanitize(subject)}_${sanitize(topic)}`;
    
    await setDoc(doc(db, 'cachedLessons', docId), {
      ...data,
      topic,
      classNumber,
      subject,
      cachedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error saving cached lesson:', error);
  }
};

// ============ AI DAILY CHAT LIMITS ============

export const getDailyChatUsage = async (userId) => {
  if (!userId || userId === 'guest' || isMockMode()) return 0;
  try {
    const today = new Date().toDateString();
    const sanitizeDate = today.replace(/[^a-zA-Z0-9_-]/g, '_');
    const docId = `${userId}_${sanitizeDate}`;
    
    const docSnap = await getDoc(doc(db, 'aiChatUsage', docId));
    if (docSnap.exists()) {
      return docSnap.data().count || 0;
    }
    return 0;
  } catch (error) {
    console.error('Error getting daily chat usage:', error);
    return 0;
  }
};

export const incrementDailyChatUsage = async (userId) => {
  if (!userId || userId === 'guest' || isMockMode()) return 0;
  try {
    const today = new Date().toDateString();
    const sanitizeDate = today.replace(/[^a-zA-Z0-9_-]/g, '_');
    const docId = `${userId}_${sanitizeDate}`;
    
    const docRef = doc(db, 'aiChatUsage', docId);
    let newCount = 1;
    
    await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(docRef);
      if (docSnap.exists()) {
        newCount = (docSnap.data().count || 0) + 1;
        transaction.update(docRef, {
          count: newCount,
          lastUsed: Timestamp.now()
        });
      } else {
        transaction.set(docRef, {
          userId,
          count: 1,
          dateString: today,
          lastUsed: Timestamp.now()
        });
      }
    });
    return newCount;
  } catch (error) {
    console.error('Error incrementing daily chat usage:', error);
    return 0;
  }
};

// ============ GAMIFIED ACHIEVEMENTS (BADGES) ============

export const awardBadge = async (userId, badgeId) => {
  if (!userId || userId === 'guest' || isMockMode()) return;
  try {
    const userRef = doc(db, 'users', userId);
    
    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const currentBadges = userData.badges || [];
        if (!currentBadges.includes(badgeId)) {
          transaction.update(userRef, {
            badges: arrayUnion(badgeId)
          });
          console.log(`🏆 Badge awarded: ${badgeId} to user ${userId}`);
          
          // Update local storage user cache if active session
          try {
            const cachedUser = JSON.parse(localStorage.getItem('userData') || '{}');
            if (cachedUser.uid === userId) {
              cachedUser.badges = [...(cachedUser.badges || []), badgeId];
              localStorage.setItem('userData', JSON.stringify(cachedUser));
              // Dispatch storage event to trigger immediate UI refreshes
              window.dispatchEvent(new Event('storage'));
            }
          } catch (e) {
            console.warn('Failed to update local storage user cache:', e);
          }
        }
      }
    });
  } catch (error) {
    console.error('Error awarding badge:', error);
  }
};

