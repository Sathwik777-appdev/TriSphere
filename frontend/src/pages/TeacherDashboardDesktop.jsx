import React, { useState, useEffect, useMemo, useCallback } from 'react';
// Cache buster: v1.0.3 - Fix Feedback Modal naming and exports (Teacher Dashboard Refresh)
import { logoutUser } from '../services/authService';
import { logActivity } from '../services/firestoreService';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { TextbookUploader } from '../components/TextbookUploader';
import { StudyMaterialPanel } from '../components/StudyMaterialPanel';
import { PrivacyPolicy } from '../components/PrivacyPolicy';
import { StudentProgressTable } from '../components/StudentProgressTable';
import { AnnouncementsPanel } from '../components/AnnouncementsPanel';
import { ActivityPanel } from '../components/ActivityPanel';
import { MyUploads } from '../components/MyUploads';
import StudentSubmissions from '../components/StudentSubmissions';
import { TeacherNotes } from '../components/TeacherNotes';
import MyLessons from '../components/MyLessons';
import DiscussionForum from '../components/DiscussionForum';
import { TeacherMeetingsPanel } from '../components/TeacherMeetingsPanel';
import { collection, query, where, getDocs, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { successToast, errorToast, warningToast, infoToast } from '../utils/toast';
import VideoBackground from '../components/VideoBackground';
import { getThemedStyles } from '../styles/theme';
import { useSwipeNavigation } from '../hooks/useSwipeNavigation';
import Skeleton from '../components/Skeleton';
import ErrorBoundary from '../components/ErrorBoundary';
import { styles } from './TeacherDashboard.styles';
import { getFinalQuizScores } from '../utils/quizUtils';
import { TeacherHeader } from '../components/teacher/TeacherHeader';
import { TeacherStats } from '../components/teacher/TeacherStats';
import { TeacherClassSelector } from '../components/teacher/TeacherClassSelector';
import { TeacherViewNav } from '../components/teacher/TeacherViewNav';
import { AccountSettings } from '../components/AccountSettings';
import { ProgressReport } from '../components/ProgressReport';
import SimulationAssignment from '../components/SimulationAssignment';



export const TeacherDashboard = () => {
  const { user, userData, loading } = useAuth();
  const navigate = useNavigate();
  const [selectedClass, setSelectedClass] = useState(6);
  const [selectedSubject, setSelectedSubject] = useState(userData?.subject || 'Physics');
  const [chapters, setChapters] = useState([]);
  const [activeView, setActiveView] = useState('upload');
  const [uploadTimestamp, setUploadTimestamp] = useState(Date.now());
  const [stats, setStats] = useState({
    totalStudents: 0,
    avgAttendance: 0,
    quizzesCompleted: 0
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showDiscussion, setShowDiscussion] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneEditing, setPhoneEditing] = useState(false);
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  // Theme-aware styles (Forced Standard RGB Theme)
  const { isDark } = useTheme();
  const themedStyles = useMemo(() => getThemedStyles(), []);

  // Loading state moved relative to render return
  // if (loading) { ... }

  // Available classes for this teacher (from userData.classes or fallback)
  const availableClasses = useMemo(() => {
    if (userData?.classes && Array.isArray(userData.classes) && userData.classes.length > 0) {
      return userData.classes.map(c => parseInt(c)).sort((a, b) => a - b);
    }
    // Fallback for legacy teachers without assigned classes
    return [6, 7, 8, 9, 10];
  }, [userData?.classes]);

  // Set initial selected class based on available classes
  useEffect(() => {
    if (availableClasses.length > 0 && !availableClasses.includes(selectedClass)) {
      setSelectedClass(availableClasses[0]);
    }
  }, [availableClasses]);

  useEffect(() => {
    const fetchStats = async () => {
      if (!selectedClass || !selectedSubject) return;

      try {
        const classInt = parseInt(selectedClass);
        const schoolName = userData?.schoolName || '';
        const isDeveloper = userData?.role === 'developer';

        // Base filters
        const schoolFilter = isDeveloper ? [] : [where('schoolName', '==', schoolName)];

        // 1. Fetch Students (One query, handle both types for safety)
        const studentsQuery = query(
          collection(db, 'users'),
          where('role', '==', 'student'),
          ...schoolFilter
        );
        const studentsSnapshot = await getDocs(studentsQuery);
        
        const studentsInClass = studentsSnapshot.docs.filter(doc => {
          const c = doc.data().class;
          return c === classInt || String(c) === String(selectedClass);
        });
        const totalStudents = studentsInClass.length;

        // 2. Parallel Fetch Content and Results
        const [quizResultsSnap, assignmentsSnap, textbooksSnap] = await Promise.all([
          getDocs(query(collection(db, 'quizResults'), where('subject', '==', selectedSubject), ...schoolFilter)),
          getDocs(query(collection(db, 'assignments'), where('subject', '==', selectedSubject), ...schoolFilter)),
          getDocs(query(collection(db, 'textbooks'), where('subject', '==', selectedSubject), ...schoolFilter))
        ]);

        // Filter Content by Class locally to avoid complex Firestore indexing requirements
        const filteredQuizzes = quizResultsSnap.docs.filter(d => d.data().class === classInt || String(d.data().class) === String(selectedClass));
        const filteredAssignments = assignmentsSnap.docs.filter(d => d.data().class === classInt || String(d.data().class) === String(selectedClass));
        const filteredTextbooks = textbooksSnap.docs.filter(d => d.data().class === classInt || String(d.data().class) === String(selectedClass));

        const quizzesCompleted = getFinalQuizScores(filteredQuizzes.map(d => d.data())).length;
        const totalAssignments = filteredAssignments.length;
        const totalChapters = filteredTextbooks.length;
        const assignmentIds = filteredAssignments.map(d => d.id);

        // 3. Fetch Submissions for these assignments
        let matchingSubmissions = 0;
        if (assignmentIds.length > 0) {
          const submissionsSnap = await getDocs(query(
            collection(db, 'studentSubmissions'),
            where('subject', '==', selectedSubject)
          ));
          matchingSubmissions = submissionsSnap.docs.filter(d => assignmentIds.includes(d.data().assignmentId)).length;
        }

        // Calculate Average Attendance
        const totalActivitiesPerStudent = totalAssignments + totalChapters;
        const totalParticipation = matchingSubmissions + quizzesCompleted;
        const expectedParticipation = totalStudents * totalActivitiesPerStudent;

        const avgAttendance = expectedParticipation > 0
          ? Math.min(Math.round((totalParticipation / expectedParticipation) * 100), 100)
          : 0;

        setStats({
          totalStudents,
          avgAttendance,
          quizzesCompleted
        });
      } catch (err) {
        console.error('Error fetching teacher stats:', err);
      }
    };

    fetchStats();
  }, [selectedClass, selectedSubject, userData?.schoolName]);

  useEffect(() => {
    // Update subject when userData loads or changes
    if (userData?.subject) {
      setSelectedSubject(userData.subject);
    }
  }, [userData]);

  useEffect(() => {
    // Log activity
    if (user?.uid) {
      logActivity(user.uid, null, 'teacher_dashboard_visit').catch(console.error);
    }
  }, [user]);

  // Load phone number from userData
  useEffect(() => {
    if (userData?.phoneNumber) {
      setPhoneNumber(userData.phoneNumber);
      setPhoneInput(userData.phoneNumber);
    }
  }, [userData]);

  const handleSavePhone = async () => {
    if (!/^[0-9]{10}$/.test(phoneInput.trim())) {
      errorToast('Please enter a valid 10-digit mobile number');
      return;
    }
    setPhoneSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { phoneNumber: phoneInput.trim() });
      setPhoneNumber(phoneInput.trim());
      setPhoneEditing(false);
      successToast('Mobile number saved!');
    } catch (err) {
      errorToast('Failed to save mobile number');
    } finally {
      setPhoneSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };


  // When a new chapter is uploaded, append it so assignment uploader can select it immediately
  const handleChapterUploaded = (chapter) => {
    if (!chapter || !chapter.id) return;
    setChapters(prev => {
      // avoid duplicates
      if (prev.find(p => p.id === chapter.id)) return prev;
      return [{ id: chapter.id, chapterName: chapter.chapterName }, ...prev];
    });
    // Trigger MyUploads refresh
    setUploadTimestamp(Date.now());
  };

  const views = [
    { id: 'upload', label: '📤 Upload Content', icon: '📤' },
    { id: 'myuploads', label: '📁 My Uploads', icon: '📁' },
    { id: 'notes', label: '📝 Notes', icon: '📝' },
    { id: 'mylessons', label: '📒 My Lessons', icon: '📒' },
    { id: 'students', label: '👥 Student Progress', icon: '👥' },
    { id: 'announcements', label: '📢 Announcements', icon: '📢' },
    { id: 'simulations', label: '🧪 Simulation Lab', icon: '🧪' },
    { id: 'reports', label: '📊 Reports', icon: '📊' }
  ];

  // Swipe navigation handlers
  const handleSwipeLeft = useCallback(() => {
    const currentIndex = views.findIndex(v => v.id === activeView);
    if (currentIndex < views.length - 1) {
      setActiveView(views[currentIndex + 1].id);
    }
  }, [activeView, views]);

  const handleSwipeRight = useCallback(() => {
    const currentIndex = views.findIndex(v => v.id === activeView);
    if (currentIndex > 0) {
      setActiveView(views[currentIndex - 1].id);
    }
  }, [activeView, views]);

  const { swipeHandlers } = useSwipeNavigation({
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    threshold: 50
  });

  const renderActiveView = () => {
    switch (activeView) {
      case 'upload':
        return (
          <ErrorBoundary mini context="Upload Textbook PDF">
            <div style={styles.uploadContainer}>
              <div style={styles.uploadSection}>
                <h3 style={styles.uploadTitle}>📚 Upload Chapter PDF</h3>
                <TextbookUploader
                  userId={user?.uid}
                  classNumber={selectedClass}
                  subject={selectedSubject}
                  schoolName={userData?.schoolName || ''}
                  onUploadSuccess={handleChapterUploaded}
                />
              </div>
            </div>
          </ErrorBoundary>
        );
      case 'myuploads':
        return (
          <ErrorBoundary mini context="My Uploads">
            <MyUploads userId={user?.uid} classNumber={selectedClass} subject={selectedSubject} schoolName={userData?.schoolName || ''} refreshTrigger={uploadTimestamp} />
          </ErrorBoundary>
        );
      case 'notes':
        return (
          <ErrorBoundary mini context="Teacher Notes">
            <TeacherNotes classNumber={selectedClass} subject={selectedSubject} schoolName={userData?.schoolName || ''} />
          </ErrorBoundary>
        );
      case 'mylessons':
        return (
          <ErrorBoundary mini context="My Lessons">
            <MyLessons classNumber={selectedClass} subject={selectedSubject} userId={user?.uid} schoolName={userData?.schoolName || ''} />
          </ErrorBoundary>
        );
      case 'students':
        return (
          <ErrorBoundary mini context="Student Progress">
            <StudentProgressTable classNumber={selectedClass} subject={selectedSubject} schoolName={userData?.schoolName || ''} />
          </ErrorBoundary>
        );
      case 'meetings':
        return (
          <ErrorBoundary mini context="Meetings Booking">
            <TeacherMeetingsPanel userId={user?.uid} />
          </ErrorBoundary>
        );
      case 'announcements':
        return (
          <ErrorBoundary mini context="Announcements">
            <AnnouncementsPanel
              userId={user?.uid}
              userName={userData?.username || 'Teacher'}
              schoolName={userData?.schoolName || ''}
              classNumber={selectedClass}
            />
          </ErrorBoundary>
        );
      case 'activity':
        return (
          <ErrorBoundary mini context="Activity Log">
            <ActivityPanel classNumber={selectedClass} />
          </ErrorBoundary>
        );
      case 'reports':
        return (
          <ErrorBoundary mini context="Progress Reports">
            <ProgressReport role="teacher" classNumber={selectedClass} schoolName={userData?.schoolName || ''} />
          </ErrorBoundary>
        );
      case 'simulations':
        return (
          <ErrorBoundary mini context="Simulation Lab">
            <SimulationAssignment
              userId={user?.uid}
              classNumber={selectedClass}
              schoolName={userData?.schoolName || ''}
              teacherSubject={userData?.subject}
              userRole={userData?.role}
            />
          </ErrorBoundary>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <VideoBackground />
      <div style={styles.container} className="dashboard-bg">
        {showAccountSettings && (
          <AccountSettings onClose={() => setShowAccountSettings(false)} />
        )}



        <TeacherHeader
            themedStyles={themedStyles}
            userData={userData}
            selectedClass={selectedClass}
            selectedSubject={selectedSubject}
            showSettings={showSettings}
            setShowSettings={setShowSettings}
            setShowPrivacyPolicy={setShowPrivacyPolicy}
            setShowDiscussion={setShowDiscussion}
            handleLogout={handleLogout}
            styles={styles}
            phoneNumber={phoneNumber}
            phoneEditing={phoneEditing}
            phoneSaving={phoneSaving}
            phoneInput={phoneInput}
            setPhoneInput={setPhoneInput}
            setPhoneEditing={setPhoneEditing}
            handleSavePhone={handleSavePhone}
            setShowAccountSettings={setShowAccountSettings}
            setActiveView={setActiveView}
          />
        {loading ? (
          <div style={styles.content}>
            <Skeleton.Dashboard cardCount={3} showTable={false} />
          </div>
        ) : (
          <div className="dashboard-content-scroll">
            <div style={styles.content} className="dashboard-content-mobile">
              <TeacherStats stats={stats} styles={styles} />

              <TeacherClassSelector
                availableClasses={availableClasses}
                selectedClass={selectedClass}
                setSelectedClass={setSelectedClass}
                styles={styles}
              />

              <TeacherViewNav
                views={views}
                activeView={activeView}
                setActiveView={setActiveView}
                themedStyles={themedStyles}
                styles={styles}
              />

              {/* Active View Content - Swipeable */}
              <div
                style={{ ...styles.viewContent, ...themedStyles.tabContent }}
                {...swipeHandlers}
              >
                {renderActiveView()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Privacy Policy Modal */}
      {
        showPrivacyPolicy && (
          <PrivacyPolicy viewOnly={true} onAccept={() => setShowPrivacyPolicy(false)} />
        )
      }

      {/* Discussion Forum Modal */}

      {
        showDiscussion && (
          <div
            onClick={() => setShowDiscussion(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}>
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'linear-gradient(135deg, rgba(15, 15, 35, 0.98), rgba(30, 40, 70, 0.98))',
                borderRadius: '16px',
                width: '90%',
                maxWidth: '900px',
                maxHeight: '90vh',
                overflowY: 'auto',
                border: '1px solid rgba(0, 255, 255, 0.3)'
              }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 20px',
                borderBottom: '1px solid rgba(0, 255, 255, 0.2)'
              }}>
                <h3 style={{ margin: 0, color: '#ffffff' }}>💬 Discussion Forum</h3>
                <button
                  onClick={() => setShowDiscussion(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    color: '#ffffff'
                  }}
                >
                  ✕
                </button>
              </div>
              <div style={{ maxHeight: 'calc(90vh - 80px)', overflowY: 'auto' }}>
                <DiscussionForum classNumber={selectedClass} subject={selectedSubject} />
              </div>
            </div>
          </div>
        )
      }
    </>
  );
};

export default TeacherDashboard;
