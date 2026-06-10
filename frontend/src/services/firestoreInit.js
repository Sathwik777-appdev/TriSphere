/**
 * Firestore Initialization Script
 * Run this once to populate sample data
 * 
 * Usage: Copy to browser console or create a separate function to call
 */

import { db } from './firebase';
import { collection, doc, setDoc, addDoc, Timestamp } from 'firebase/firestore';

export const initializeSampleData = async () => {
  try {
    console.log('Initializing sample data...');

    // Sample Users
    const sampleUsers = [
      {
        uid: 'teacher1',
        email: 'teacher@trinitytech.com',
        username: 'John Smith',
        role: 'teacher',
        class: null,
        createdAt: Timestamp.now()
      },
      {
        uid: 'student1',
        email: 'student@trinityicse.com',
        username: 'Arjun Kumar',
        role: 'student',
        class: 8,
        createdAt: Timestamp.now()
      },
      {
        uid: 'parent1',
        email: 'parent@tinitypar.com',
        username: 'Rajesh Kumar',
        role: 'parent',
        class: null,
        createdAt: Timestamp.now()
      }
    ];

    // Add sample users
    for (const user of sampleUsers) {
      await setDoc(doc(db, 'users', user.uid), user);
      console.log(`✓ Created user: ${user.email}`);
    }

    // Sample Textbooks
    const sampleTextbooks = [
      {
        class: 8,
        subject: 'Physics',
        chapterName: 'Motion and Force',
        pdfURL: 'https://example.com/chapter1.pdf',
        createdBy: 'teacher1',
        createdAt: Timestamp.now(),
        notesText: 'Chapter on motion and force with comprehensive explanations...',
        quizData: [
          {
            type: 'mcq',
            question: 'What is Newton\'s first law?',
            options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
            correctAnswer: 0
          }
        ],
        youtubeLinks: []
      }
    ];

    // Add sample textbooks
    for (const textbook of sampleTextbooks) {
      const docRef = await addDoc(collection(db, 'textbooks'), textbook);
      console.log(`✓ Created textbook: ${docRef.id}`);
    }

    // Sample Assignments
    const sampleAssignments = [
      {
        chapterId: 'chapter1',
        assignmentTitle: 'Practice Problems Set 1',
        assignmentPdfURL: 'https://example.com/assignment1.pdf',
        dueDate: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
        class: 8,
        subject: 'Physics',
        createdBy: 'teacher1',
        createdAt: Timestamp.now()
      }
    ];

    // Add sample assignments
    for (const assignment of sampleAssignments) {
      const docRef = await addDoc(collection(db, 'assignments'), assignment);
      console.log(`✓ Created assignment: ${docRef.id}`);
    }

    // Sample Announcements
    const sampleAnnouncements = [
      {
        title: 'Mid-Term Exams Scheduled',
        message: 'Mid-term examinations will be held from January 15-20. Students should review all chapters thoroughly.',
        class: 8,
        createdBy: 'teacher1',
        createdAt: Timestamp.now(),
        seenByStudents: ['student1'],
        seenByParents: ['parent1']
      }
    ];

    // Add sample announcements
    for (const announcement of sampleAnnouncements) {
      const docRef = await addDoc(collection(db, 'announcements'), announcement);
      console.log(`✓ Created announcement: ${docRef.id}`);
    }

    // Sample Analytics
    const sampleAnalytics = [
      {
        progressPercentage: 85,
        weeklyUsage: 15.5,
        streakDays: 7,
        lastActiveAt: Timestamp.now(),
        sessionsPerWeek: 12
      }
    ];

    // Add sample analytics
    for (const analytics of sampleAnalytics) {
      await setDoc(doc(db, 'analytics', 'student1'), analytics);
      console.log(`✓ Created analytics for student1`);
    }

    // Sample Gamification
    await setDoc(doc(db, 'gamification', 'student1'), {
      xp: 2500,
      level: 3,
      badges: ['First Assignment', 'Quiz Master', 'Perfect Score']
    });
    console.log(`✓ Created gamification for student1`);

    // Sample Parent Data
    await setDoc(doc(db, 'parents', 'parent1'), {
      email: 'parent@tinitypar.com',
      childrenIds: ['student1'],
      createdAt: Timestamp.now()
    });
    console.log(`✓ Created parent profile`);

    console.log('✓ Sample data initialization complete!');
    alert('Sample data has been added to Firestore. You can now test the application.');

  } catch (error) {
    console.error('Error initializing sample data:', error);
    alert('Error: ' + error.message);
  }
};

/**
 * Clear all data (use with caution!)
 */
export const clearAllData = async () => {
  if (!window.confirm('Are you sure? This will delete ALL data from Firestore!')) {
    return;
  }

  try {
    const collections = ['users', 'textbooks', 'assignments', 'studentSubmissions', 'announcements', 'analytics', 'gamification', 'parents'];

    for (const collName of collections) {
      const snapshot = await getDocs(collection(db, collName));
      for (const docSnapshot of snapshot.docs) {
        await deleteDoc(doc(db, collName, docSnapshot.id));
      }
      console.log(`✓ Cleared collection: ${collName}`);
    }

    console.log('✓ All data cleared!');
  } catch (error) {
    console.error('Error clearing data:', error);
  }
};

/**
 * Call this from your app initialization or browser console
 * 
 * Example:
 * In your App.jsx, add this to useEffect after AuthProvider loads:
 * 
 * useEffect(() => {
 *   if (process.env.NODE_ENV === 'development') {
 *     window.initializeSampleData = initializeSampleData;
 *     window.clearAllData = clearAllData;
 *   }
 * }, []);
 * 
 * Then in browser console, run:
 * initializeSampleData()
 */
