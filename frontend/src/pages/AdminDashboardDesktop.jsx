
import React, { useState, useEffect, useMemo, useCallback } from 'react';
// Cache buster: v1.0.3 - Fix Feedback Modal naming and exports
import { logoutUser } from '../services/authService';
import AnimatedLogo from '../components/AnimatedLogo';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, Timestamp, addDoc, setDoc, getDoc, getCountFromServer, limit, startAfter, orderBy, arrayUnion } from 'firebase/firestore';
import { db, auth, secondaryAuth, functions } from '../services/firebase';
import { httpsCallable } from 'firebase/functions';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, deleteUser, updatePassword } from 'firebase/auth';
import { migrateParentDataToStudents } from '../utils/migrateParentData';
import { API_BASE_URL } from '../utils/apiBase';
import adminStyles from './adminDashboardStyles';
import { SkeletonDashboard, SkeletonStatCard } from '../components/Skeleton';
import { successToast, errorToast, warningToast, infoToast } from '../utils/toast';
import { getFinalQuizScores } from '../utils/quizUtils';
import VideoBackground from '../components/VideoBackground';
import { getThemedStyles } from '../styles/theme';
import { AdminPhotoUpload } from '../components/AdminPhotoUpload';
import { ProfilePhoto } from '../components/ProfilePhoto';
import { PrivacyPolicy } from '../components/PrivacyPolicy';
import { AccountSettings } from '../components/AccountSettings';
import ErrorBoundary from '../components/ErrorBoundary';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area
} from 'recharts';
import ProgressReport from '../components/ProgressReport';

// Professional SVG Icons
const TeacherIcon = ({ size = 24, color = '#ffffff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const StudentIcon = ({ size = 24, color = '#ffffff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
    <path d="M6 12v5c3 3 9 3 12 0v-5" />
  </svg>
);

const PrivacyIcon = ({ size = 24, color = '#ffffff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const ParentIcon = ({ size = 24, color = '#ffffff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <circle cx="17" cy="7" r="3" />
  </svg>
);

const OverviewIcon = ({ size = 24, color = '#ffffff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);

const TrophyIcon = ({ size = 24, color = '#ffffff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
);

const MegaphoneIcon = ({ size = 24, color = '#ffffff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 11 18-5v12L3 13v-2z" />
    <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
  </svg>
);

const PlusIcon = ({ size = 24, color = '#ffffff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const SchoolIcon = ({ size = 24, color = '#ffffff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
    <path d="M6 12v5c3 3 9 3 12 0v-5" />
  </svg>
);

const ReportIcon = ({ size = 24, color = '#ffffff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const DatabaseIcon = ({ size = 24, color = '#ffffff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
  </svg>
);


// Score aggregation moved to utils/quizUtils — perfect first attempt
// counts alone, otherwise the chapter's mark is the average of every
// valid attempt. Imported at module top.

export const AdminDashboard = () => {
  const { user, userData } = useAuth();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('overview');
  const [showSettings, setShowSettings] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const isMobile = false; // Web app is now desktop-dedicated
  const currentSession = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0 is January, 5 is June
    return month >= 5 ? `${year} - ${year + 1}` : `${year - 1} - ${year}`;
  }, []);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneEditing, setPhoneEditing] = useState(false);
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');

  // Theme-aware styles (Forced Standard RGB Theme)
  const { isDark } = useTheme();
  const themedStyles = useMemo(() => getThemedStyles(), []);

  const [stats, setStats] = useState({
    totalTeachers: 0,
    totalStudents: 0,
    totalParents: 0,
    totalClasses: 0
  });
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [analytics, setAnalytics] = useState({
    totalTextbooks: 0,
    totalAssignments: 0,
    totalQuizzes: 0,
    activeTeachersWeek: 0,
    activeStudentsWeek: 0,
    averageQuizScore: 0,
    assignmentCompletionRate: 0,
    topPerformingClass: 'N/A',
    dailyEngagement: 0,
    weeklyTeacherActivity: 0
  });
  const [announcementData, setAnnouncementData] = useState({
    title: '',
    message: '',
    targetAudience: 'all'
  });
  const [announcementLoading, setAnnouncementLoading] = useState(false);
  const [announcementSuccess, setAnnouncementSuccess] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [selectedClass, setSelectedClass] = useState('all');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showLessonPlansModal, setShowLessonPlansModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userType, setUserType] = useState('');
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [messageText, setMessageText] = useState('');
  const [editFormData, setEditFormData] = useState({});
  const [actionLoading, setActionLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [parentSearch, setParentSearch] = useState('');
  const [teacherSearch, setTeacherSearch] = useState('');
  const [pastMessages, setPastMessages] = useState([]);
  const [showPastMessages, setShowPastMessages] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [studentPerformance, setStudentPerformance] = useState(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [teacherLessons, setTeacherLessons] = useState([]);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [allFeedbacks, setAllFeedbacks] = useState([]);
  const [loadingFeedbacks, setLoadingFeedbacks] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [weeklyData, setWeeklyData] = useState([]);

  // FAQ Manager states
  const [faqs, setFaqs] = useState([]);
  const [suggestedFaqs, setSuggestedFaqs] = useState([]);
  const [loadingFaqs, setLoadingFaqs] = useState(false);
  const [faqFormData, setFaqFormData] = useState({ question: '', answer: '', category: 'General' });

  // Pagination State
  const [lastStudent, setLastStudent] = useState(null);
  const [lastTeacher, setLastTeacher] = useState(null);
  const [lastParent, setLastParent] = useState(null);
  const [hasMoreStudents, setHasMoreStudents] = useState(true);
  const [hasMoreTeachers, setHasMoreTeachers] = useState(true);
  const [hasMoreParents, setHasMoreParents] = useState(true);
  const PAGE_SIZE = 10;

  // Video Activity Logs states
  const [showVideoActivity, setShowVideoActivity] = useState(false);
  const [videoActivityLogs, setVideoActivityLogs] = useState([]);
  const [loadingVideoActivity, setLoadingVideoActivity] = useState(false);

  // Create User states
  const [createUserData, setCreateUserData] = useState({
    userType: 'student',
    name: '',
    email: '',
    password: '',
    class: '6',
    subject: '',
    classes: [], // For teacher: array of class numbers they teach
    parentName: '',
    parentEmail: '',
    parentPassword: ''
  });


  const [createUserLoading, setCreateUserLoading] = useState(false);
  const [createUserSuccess, setCreateUserSuccess] = useState(false);
  const [createUserError, setCreateUserError] = useState('');

  // Bulk Import state variables
  const [importType, setImportType] = useState(null); // 'student', 'teacher', 'parent'
  const [importFile, setImportFile] = useState(null);
  const [validationRows, setValidationRows] = useState([]); // Array of parsed & validated rows
  const [isValidating, setIsValidating] = useState(false);
  const [isExecutingImport, setIsExecutingImport] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, percentage: 0, logs: [] });
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState(false);

  // Notification state
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });

  // Auto-hide notification after 5 seconds
  useEffect(() => {
    if (notification.show) {
      const timer = setTimeout(() => {
        setNotification({ show: false, message: '', type: '' });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification.show]);

  useEffect(() => {
    // Set RGB theme
    document.body.className = 'standard-theme';
    fetchOverviewStats();
    fetchAnnouncements();

    // Cleanup on unmount
    return () => {
      document.body.className = '';
    };
  }, []);

  // Load phone number from userData when it becomes available
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

  // Refresh leaderboard or FAQs when view changes
  useEffect(() => {
    if (activeView === 'leaderboard' && !loading) {
      fetchLeaderboardData();
    } else if (activeView === 'faq-manager') {
      fetchFaqs();
    }
  }, [activeView]);

  const fetchOverviewStats = async () => {
    setLoading(true);
    try {


      const isDeveloper = userData?.role === 'developer';
      const schoolFilter = isDeveloper ? [] : [where('schoolName', '==', userData?.schoolName || '')];

      // Use getCountFromServer for efficient stats
      const teachersCountQuery = query(collection(db, 'users'), where('role', '==', 'teacher'), ...schoolFilter);
      const studentsCountQuery = query(collection(db, 'users'), where('role', '==', 'student'), ...schoolFilter);
      const parentsCountQuery = query(collection(db, 'users'), where('role', '==', 'parent'), ...schoolFilter);

      const [teachersCount, studentsCount, parentsCount] = await Promise.all([
        getCountFromServer(teachersCountQuery),
        getCountFromServer(studentsCountQuery),
        getCountFromServer(parentsCountQuery)
      ]);

      const statsData = {
        totalTeachers: teachersCount.data().count,
        totalStudents: studentsCount.data().count,
        totalParents: parentsCount.data().count,
        totalClasses: 0 // Will be updated when students are loaded or through a separate efficient query
      };

      setStats(statsData);

      // Initial load of first page for each category
      await Promise.all([
        handleLoadMoreUsers('teacher', true),
        handleLoadMoreUsers('student', true),
        handleLoadMoreUsers('parent', true)
      ]);

    } catch (error) {
      console.error('❌ Error fetching overview stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMoreUsers = async (role, isInitial = false) => {
    const lastDoc = role === 'student' ? lastStudent : role === 'teacher' ? lastTeacher : lastParent;
    const currentList = role === 'student' ? students : role === 'teacher' ? teachers : parents;

    // Safety check: if not initial and no more to load, return
    if (!isInitial) {
      if (role === 'student' && !hasMoreStudents) return;
      if (role === 'teacher' && !hasMoreTeachers) return;
      if (role === 'parent' && !hasMoreParents) return;
    }

    try {
      const isDeveloper = userData?.role === 'developer';
      const schoolFilter = isDeveloper ? [] : [where('schoolName', '==', userData?.schoolName || '')];

      let q = query(
        collection(db, 'users'),
        where('role', '==', role),
        ...schoolFilter,
        orderBy('username'),
        limit(PAGE_SIZE)
      );

      if (!isInitial && lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const snapshot = await getDocs(q);
      const newUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (isInitial) {
        if (role === 'student') setStudents(newUsers);
        else if (role === 'teacher') setTeachers(newUsers);
        else if (role === 'parent') setParents(newUsers);
      } else {
        if (role === 'student') setStudents([...students, ...newUsers]);
        else if (role === 'teacher') setTeachers([...teachers, ...newUsers]);
        else if (role === 'parent') setParents([...parents, ...newUsers]);
      }

      // Update pagination cursor
      const lastVisible = snapshot.docs[snapshot.docs.length - 1];
      if (role === 'student') {
        setLastStudent(lastVisible);
        setHasMoreStudents(newUsers.length === PAGE_SIZE);
      } else if (role === 'teacher') {
        setLastTeacher(lastVisible);
        setHasMoreTeachers(newUsers.length === PAGE_SIZE);
      } else if (role === 'parent') {
        setLastParent(lastVisible);
        setHasMoreParents(newUsers.length === PAGE_SIZE);
      }

      // If initial student load, calculate unique classes for stats
      if (isInitial && role === 'student') {
        const uniqueClasses = new Set(newUsers.map(s => s.class).filter(c => c));
        setStats(prev => ({ ...prev, totalClasses: uniqueClasses.size }));
        await fetchAnalyticsData(teachers, newUsers);
      }

    } catch (error) {
      console.error(`Error loading ${role}s:`, error);
    }
  };



  const fetchAnnouncements = async () => {
    try {
      const announcementsRef = collection(db, 'announcements');
      const isDeveloper = userData?.role === 'developer';
      const schoolFilter = isDeveloper ? [] : [where('schoolName', '==', userData?.schoolName || '')];
      const q = query(announcementsRef, ...schoolFilter);
      const snapshot = await getDocs(q);

      const announcementsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Sort by creation date, newest first
      announcementsList.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB - dateA;
      });

      setAnnouncements(announcementsList);
    } catch (error) {
      console.error('Error fetching announcements:', error);
    } finally {
    }
  };

  const fetchAnalyticsData = async (teachersData = teachers, studentsData = students) => {
    try {
      // Filter students by selected class
      const filteredStudents = selectedClass === 'all'
        ? studentsData
        : studentsData.filter(s => s.class?.toString() === selectedClass);

      // Fetch textbooks/chapters (optionally filter by class)
      let textbooksQuery = collection(db, 'textbooks');
      if (selectedClass !== 'all') {
        textbooksQuery = query(textbooksQuery, where('class', '==', parseInt(selectedClass)));
      }
      const textbooksSnapshot = await getDocs(textbooksQuery);
      const totalTextbooks = textbooksSnapshot.size;

      // Fetch assignments (optionally filter by class)
      // ...existing code...

      // Fetch assignments (optionally filter by class)
      // Fetch assignments (optionally filter by class)
      let assignmentsQuery = collection(db, 'assignments');
      if (selectedClass !== 'all') {
        assignmentsQuery = query(assignmentsQuery, where('class', '==', parseInt(selectedClass)));
      }
      // Note: If no class selected, we still fetch all, which is heavy for admin but unavoidable for "Overview"
      // Added limit to prevent massive reads if dataset grows too large
      if (selectedClass === 'all') {
        // Could add limits here or pagination later
      }
      const assignmentsSnapshot = await getDocs(assignmentsQuery);
      const totalAssignments = assignmentsSnapshot.size;

      // Fetch quiz results (filter by class if selected)
      const quizResultsQuery = query(
        collection(db, 'quizResults'),
        orderBy('completedAt', 'desc'),
        limit(500)
      );
      if (selectedClass !== 'all') {
        // Note: For complex where + orderBy, a composite index will be required. 
        // We'll prioritize recent results for big overview.
      }
      const quizResultsSnapshot = await getDocs(quizResultsQuery);
      const allQuizResults = quizResultsSnapshot.docs.map(doc => doc.data());

      // Get only final scores for each student-chapter combination
      const quizResults = getFinalQuizScores(allQuizResults);
      const totalQuizzes = quizResults.length;

      // Calculate average quiz score
      const validQuizzes = quizResults.filter(q => !q.malpractice && q.score != null);
      const averageQuizScore = validQuizzes.length > 0
        ? Math.round(validQuizzes.reduce((sum, q) => sum + q.score, 0) / validQuizzes.length)
        : 0;

      // Calculate assignment completion rate (filter submissions by class)
      let submissionsQuery = collection(db, 'studentSubmissions');
      if (selectedClass !== 'all') {
        const classStudentIds = filteredStudents.map(s => s.uid || s.id);
        if (classStudentIds.length > 0) {
          submissionsQuery = query(submissionsQuery, where('studentId', 'in', classStudentIds.slice(0, 10)));
        }
      }
      const submissionsSnapshot = await getDocs(submissionsQuery);
      const totalSubmissions = submissionsSnapshot.size;
      const assignmentCompletionRate = totalAssignments > 0 && filteredStudents.length > 0
        ? Math.round((totalSubmissions / (totalAssignments * filteredStudents.length)) * 100)
        : 0;

      // --- NEW ANALYTICS: Principal's Morning Coffee View ---

      // 1. Daily Engagement: % of students who submitted something TODAY
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todaySubmissionsQuery = query(
        collection(db, 'studentSubmissions'),
        where('submittedAt', '>=', Timestamp.fromDate(todayStart))
      );
      const todaySubmissionsSnapshot = await getDocs(todaySubmissionsQuery);

      const uniqueStudentsToday = new Set();
      todaySubmissionsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        // Filter by class if selected
        if (selectedClass === 'all' ||
          filteredStudents.some(s => (s.uid || s.id) === data.studentId)) {
          uniqueStudentsToday.add(data.studentId);
        }
      });

      const dailyEngagement = filteredStudents.length > 0
        ? Math.round((uniqueStudentsToday.size / filteredStudents.length) * 100)
        : 0;

      // 2. Weekly Teacher Activity: Assignments posted in last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const weeklyAssignmentsQuery = query(
        collection(db, 'assignments'),
        where('createdAt', '>=', Timestamp.fromDate(sevenDaysAgo))
      );
      const weeklyAssignmentsSnapshot = await getDocs(weeklyAssignmentsQuery);
      const weeklyTeacherActivity = weeklyAssignmentsSnapshot.size;

      // Find top performing class based on average quiz scores
      const topPerformingClass = 'N/A'; // Placeholder for now

      setAnalytics({
        totalTextbooks,
        totalAssignments,
        totalQuizzes,
        activeTeachersWeek: 0, // Placeholder if needed
        activeStudentsWeek: 0, // Placeholder if needed
        averageQuizScore,
        assignmentCompletionRate,
        topPerformingClass,
        dailyEngagement,
        weeklyTeacherActivity
      });
    } catch (error) {
      console.error('Error in fetchAnalyticsData:', error);
    } finally {
    }
  };
  const handleLogout = async () => {
    try {
      await logoutUser();
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
    }
  };

  const handleMigrateParentData = async () => {
    const confirmed = window.confirm(
      '🔄 This will update all existing students with their parent information.\n\n' +
      'Students that already have parent details will be skipped.\n\n' +
      'Continue?'
    );

    if (!confirmed) return;

    setLoading(true);
    try {
      const results = await migrateParentDataToStudents();

      let message = `✅ Migration Complete!\n\n`;
      message += `📊 Total students: ${results.total}\n`;
      message += `✅ Updated: ${results.updated}\n`;
      message += `⏭️ Skipped: ${results.skipped}\n`;

      if (results.errors.length > 0) {
        message += `\n⚠️ Errors: ${results.errors.length}\n`;
        message += `Check console for details.`;
      }

      alert(message);

      // Refresh the overview stats to show updated data
      await fetchOverviewStats();

      setNotification({
        show: true,
        message: `Successfully updated ${results.updated} student(s)`,
        type: 'success'
      });
    } catch (error) {
      console.error('❌ Migration error:', error);
      alert('❌ Migration failed. Check console for details.');
      setNotification({
        show: true,
        message: 'Migration failed: ' + error.message,
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTeacherLessons = async (teacherId) => {
    setLessonsLoading(true);
    try {

    } catch (error) {
      console.error('❌ Error fetching teacher lessons:', error);
      setTeacherLessons([]);
    } finally {
      setLessonsLoading(false);
    }
  };

  const handleViewLessonPlans = async (teacher) => {
    setSelectedUser(teacher);
    setShowLessonPlansModal(true);
    await fetchTeacherLessons(teacher.uid || teacher.id);
  };



  const handleUpdateLessonStatus = async (lessonId, newStatus) => {
    try {
      const lessonRef = doc(db, 'teacherLessons', lessonId);
      await updateDoc(lessonRef, {
        status: newStatus,
        reviewedAt: Timestamp.now(),
        reviewedBy: userData?.username || 'Principal'
      });



      // Refresh lessons to show updated status
      await fetchTeacherLessons(selectedUser.uid || selectedUser.id);

      setNotification({
        show: true,
        message: `Lesson status updated to: ${newStatus}`,
        type: 'success'
      });
    } catch (error) {
      console.error('Error updating lesson status:', error);
      setNotification({
        show: true,
        message: 'Failed to update lesson status',
        type: 'error'
      });
    } finally {
    }
  };

  const handleViewFeedback = async () => {
    setShowSettings(false);
    setShowFeedbackModal(true);
    setLoadingFeedbacks(true);

    try {
      const feedbackQuery = query(
        collection(db, 'feedback'),
        where('timestamp', '!=', null)
      );
      const feedbackSnapshot = await getDocs(feedbackQuery);
      const feedbackList = feedbackSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Sort by timestamp (newest first)
      feedbackList.sort((a, b) => {
        const aTime = a.timestamp?.toDate?.() || new Date(0);
        const bTime = b.timestamp?.toDate?.() || new Date(0);
        return bTime - aTime;
      });

      setAllFeedbacks(feedbackList);
    } catch (err) {
      console.error('Error fetching feedbacks:', err);
      setNotification({ show: true, message: 'Error loading feedbacks. Please try again.', type: 'error' });
    } finally {
      setLoadingFeedbacks(false);
    }
  };

  const fetchFaqs = async () => {
    setLoadingFaqs(true);
    const isDeveloper = userData?.role === 'developer';
    const schoolFilter = isDeveloper ? [] : [where('schoolName', '==', userData?.schoolName || '')];
    try {
      const kbSnapshot = await getDocs(query(collection(db, 'knowledge_base'), ...schoolFilter));
      setFaqs(kbSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const suggestionsSnapshot = await getDocs(query(collection(db, 'suggested_faqs'), ...schoolFilter));
      const suggestionsList = suggestionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      suggestionsList.sort((a, b) => (b.count || 0) - (a.count || 0));
      setSuggestedFaqs(suggestionsList);
    } catch (error) {
      console.error('Error fetching FAQs:', error);
    } finally {
      setLoadingFaqs(false);
    }
  };

  const handleAddFaq = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const normalized = faqFormData.question.toLowerCase().trim()
        .replace(/[?.,!@#$%^&*()_+-=\[\]{};':"\\|,.<>\/?]/g, "")
        .replace(/\s+/g, " ");

      await addDoc(collection(db, 'knowledge_base'), {
        ...faqFormData,
        normalizedQuestion: normalized,
        schoolName: userData?.schoolName || '',
        usageCount: 0,
        createdAt: Timestamp.now(),
        createdBy: userData?.username || 'Admin'
      });
      setFaqFormData({ question: '', answer: '', category: 'General' });
      setNotification({ show: true, message: 'FAQ added successfully!', type: 'success' });
      fetchFaqs();
    } catch (error) {
      console.error('Error adding FAQ:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteFaq = async (id) => {
    if (!confirm('Delete this FAQ?')) return;
    try {
      await deleteDoc(doc(db, 'knowledge_base', id));
      setNotification({ show: true, message: 'FAQ deleted.', type: 'success' });
      fetchFaqs();
    } catch (error) {
      console.error('Error deleting FAQ:', error);
    }
  };

  const handleConvertSuggestion = async (suggestion) => {
    const answer = prompt(`Provide an answer for: "${suggestion.question}"`, "");
    if (!answer) return;
    setActionLoading(true);
    try {
      await addDoc(collection(db, 'knowledge_base'), {
        question: suggestion.question,
        normalizedQuestion: suggestion.normalizedQuestion,
        answer: answer,
        category: 'Suggested',
        schoolName: userData?.schoolName || '',
        usageCount: 0,
        createdAt: Timestamp.now(),
        createdBy: userData?.username || 'Admin'
      });
      await deleteDoc(doc(db, 'suggested_faqs', suggestion.id));
      setNotification({ show: true, message: 'Suggestion converted!', type: 'success' });
      fetchFaqs();
    } catch (error) {
      console.error('Error converting suggestion:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDismissSuggestion = async (id) => {
    try {
      await deleteDoc(doc(db, 'suggested_faqs', id));
      fetchFaqs();
    } catch (error) {
      console.error('Error dismissing suggestion:', error);
    }
  };

  // Cache buster: v1.0.1 - Ensuring relative API path is picked up
  const fetchLeaderboardData = async () => {
    setLeaderboardLoading(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        throw new Error('Not authenticated');
      }
      const response = await fetch(`${API_BASE_URL}/api/leaderboard`, {
        headers: { Authorization: `Bearer ${idToken}` }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard');
      }

      const data = await response.json();

      if (data.leaderboard) {
        setLeaderboardData(data.leaderboard);
        setWeeklyData(data.weeklyActivity || []);

        // Populate chart data (Top 5 classes)
        const topClasses = data.leaderboard.slice(0, 5);
        if (topClasses.length > 0) {
          // Chart state removed to resolve ReferenceError as it's not used in rendering
        }
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      // Fallback or empty state could be handled here
    } finally {
      setLeaderboardLoading(false);
    }
  };



  const handleViewDetails = async (user, type) => {
    // If student, try to fetch parent info if missing
    if (type === 'student') {
      let updatedUser = { ...user };
      // 1. If parentId exists but parentName/email missing, fetch parent info
      if (user.parentId && (!user.parentName || !user.parentEmail)) {
        try {
          const parentDoc = await getDoc(doc(db, 'users', user.parentId));
          if (parentDoc.exists()) {
            const parentData = parentDoc.data();
            updatedUser.parentName = parentData.username || '';
            updatedUser.parentEmail = parentData.email || '';
          }
        } catch (err) {
          console.error('Error fetching parent info:', err);
        } finally {
        }
      }
      // 2. If no parentId, search all parents for one whose children array contains this student
      if (!updatedUser.parentId) {
        try {
          const parentsQuery = query(collection(db, 'users'), where('role', '==', 'parent'));
          const parentsSnapshot = await getDocs(parentsQuery);
          for (const parentDoc of parentsSnapshot.docs) {
            const parentData = parentDoc.data();
            if (Array.isArray(parentData.children)) {
              const found = parentData.children.find(child => child.id === (user.uid || user.id));
              if (found) {
                updatedUser.parentId = parentDoc.id;
                updatedUser.parentName = parentData.username || '';
                updatedUser.parentEmail = parentData.email || '';
                break;
              }
            }
          }
        } catch (err) {
          console.error('Error searching parents for student:', err);
        } finally {
        }
      }
      setSelectedUser(updatedUser);
      setUserType(type);
      setShowDetailsModal(true);
      await fetchStudentPerformance(updatedUser);
      return;
    }

    // If parent, fetch children details from BOTH the parent's children array AND student records
    if (type === 'parent') {
      let updatedUser = { ...user };
      const parentId = user.id || user.uid;
      const childrenMap = new Map(); // Deduplicate by child ID

      // 1. Start with existing children array on the parent doc
      if (Array.isArray(user.children)) {
        for (const child of user.children) {
          if (child.id) childrenMap.set(child.id, child);
        }
      }

      // 2. Also query students whose parentId references this parent
      try {
        const studentsQuery = query(
          collection(db, 'users'),
          where('parentId', '==', parentId),
          where('role', '==', 'student')
        );
        const studentsSnapshot = await getDocs(studentsQuery);
        for (const studentDoc of studentsSnapshot.docs) {
          const studentData = studentDoc.data();
          childrenMap.set(studentDoc.id, {
            id: studentDoc.id,
            name: studentData.username || 'Unknown',
            email: studentData.email || '',
            class: studentData.class || 'N/A'
          });
        }
      } catch (err) {
        console.error('Error querying students by parentId:', err);
      }

      // 3. Enrich all children with latest Firestore data
      try {
        const enrichedChildren = await Promise.all(
          Array.from(childrenMap.values()).map(async (child) => {
            try {
              const childDoc = await getDoc(doc(db, 'users', child.id));
              if (childDoc.exists()) {
                const childData = childDoc.data();
                return {
                  ...child,
                  name: childData.username || child.name || 'Unknown',
                  email: childData.email || '',
                  class: childData.class || child.class || 'N/A'
                };
              }
              return child;
            } catch (err) {
              return child;
            }
          })
        );
        updatedUser.children = enrichedChildren;


        // 4. Auto-repair: update parent's children/childrenIds in Firestore if they were stale
        const existingChildIds = (user.childrenIds || []);
        const enrichedIds = enrichedChildren.map(c => c.id);
        const isMissing = enrichedIds.some(id => !existingChildIds.includes(id));
        if (isMissing) {
          try {
            await updateDoc(doc(db, 'users', parentId), {
              children: enrichedChildren.map(c => ({ id: c.id, name: c.name, class: c.class })),
              childrenIds: enrichedIds
            });

          } catch (repairErr) {
            console.error('Error auto-repairing parent data:', repairErr);
          }
        }
      } catch (err) {
        console.error('Error fetching children details:', err);
      }

      setSelectedUser(updatedUser);
      setUserType(type);
      setShowDetailsModal(true);
      return;
    }

    setSelectedUser(user);
    setUserType(type);
    setShowDetailsModal(true);
  };


  const fetchStudentPerformance = async (student) => {
    setPerformanceLoading(true);
    setStudentPerformance(null);

    try {
      const studentId = student.uid || student.id;
      const studentClass = student.class;

      console.log('Fetching performance for student:', { studentId, studentClass, student });

      // Fetch quiz results
      const quizResultsQuery = query(
        collection(db, 'quizResults'),
        where('studentId', '==', studentId)
      );
      const quizSnapshot = await getDocs(quizResultsQuery);
      const allQuizResults = quizSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Get only final scores for this student
      const quizResults = getFinalQuizScores(allQuizResults);

      const validQuizzes = quizResults.filter(q => !q.malpractice && q.score != null);
      const averageQuizScore = validQuizzes.length > 0
        ? Math.round(validQuizzes.reduce((sum, q) => sum + q.score, 0) / validQuizzes.length)
        : 0;

      // Fetch assignments for student's class
      const assignmentsQuery = query(
        collection(db, 'assignments'),
        where('class', '==', parseInt(studentClass))
      );
      const assignmentsSnapshot = await getDocs(assignmentsQuery);
      const totalAssignments = assignmentsSnapshot.size;

      // Fetch student's submissions
      const submissionsQuery = query(
        collection(db, 'studentSubmissions'),
        where('studentId', '==', studentId)
      );
      const submissionsSnapshot = await getDocs(submissionsQuery);
      const completedAssignments = submissionsSnapshot.size;

      const assignmentCompletionRate = totalAssignments > 0
        ? Math.round((completedAssignments / totalAssignments) * 100)
        : 0;

      // Get graded submissions
      const gradedSubmissions = submissionsSnapshot.docs
        .map(doc => doc.data())
        .filter(sub => sub.grade != null);

      const averageAssignmentGrade = gradedSubmissions.length > 0
        ? Math.round(gradedSubmissions.reduce((sum, sub) => sum + sub.grade, 0) / gradedSubmissions.length)
        : 0;

      const performanceData = {
        totalQuizzes: quizResults.length,
        averageQuizScore,
        totalAssignments,
        completedAssignments,
        assignmentCompletionRate,
        gradedAssignments: gradedSubmissions.length,
        averageAssignmentGrade,
        malpracticeCount: quizResults.filter(q => q.malpractice).length
      };



      setStudentPerformance(performanceData);
    } catch (error) {
      console.error('Error fetching student performance:', error);
      setStudentPerformance({
        error: 'Failed to load performance data'
      });
    } finally {
      setPerformanceLoading(false);
    }
  };

  const handleSendMessage = async () => {
    setShowMessageModal(true);
    // Load past messages with this user
    await loadPastMessages(selectedUser);
  };

  const loadPastMessages = async (user) => {
    if (!user) return;

    setMessagesLoading(true);
    try {
      const q = query(
        collection(db, 'messages'),
        where('toId', '==', user.uid || user.id)
      );
      const snapshot = await getDocs(q);
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Sort by timestamp (newest first)
      messages.sort((a, b) => {
        const timeA = a.timestamp?.toDate?.() || new Date(a.timestamp || 0);
        const timeB = b.timestamp?.toDate?.() || new Date(b.timestamp || 0);
        return timeB - timeA;
      });

      setPastMessages(messages);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setMessagesLoading(false);
    }
  };

  const markMessageAsRead = async (messageId) => {
    try {
      await updateDoc(doc(db, 'messages', messageId), {
        read: true,
        readAt: Timestamp.now()
      });

      // Update local state
      setPastMessages(prev => prev.map(msg =>
        msg.id === messageId ? { ...msg, read: true, readAt: Timestamp.now() } : msg
      ));
    } catch (error) {
      console.error('Error marking message as read:', error);
    } finally {
    }
  };

  const handleSubmitMessage = async (e) => {
    e.preventDefault();
    if (!messageText.trim()) {
      setNotification({ show: true, message: 'Please enter a message', type: 'error' });
      return;
    }

    setActionLoading(true);
    try {
      await addDoc(collection(db, 'messages'), {
        to: selectedUser.email,
        toId: selectedUser.uid || selectedUser.id,
        toName: selectedUser.username,
        from: userData?.email,
        fromId: user?.uid,
        fromName: userData?.username || 'Principal',
        message: messageText,
        timestamp: Timestamp.now(),
        read: false
      });

      setNotification({ show: true, message: 'Message sent successfully!', type: 'success' });
      setMessageText('');
      setShowMessageModal(false);
    } catch (error) {
      console.error('Error sending message:', error);
      setNotification({ show: true, message: 'Failed to send message. Please try again.', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditProfile = () => {
    setEditFormData({
      username: selectedUser.username || '',
      email: selectedUser.email || '',
      class: selectedUser.class || '',
      subject: selectedUser.subject || ''
    });
    setShowEditModal(true);
  };

  const handleSubmitEdit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const userDocRef = doc(db, 'users', selectedUser.uid || selectedUser.id);
      await updateDoc(userDocRef, {
        username: editFormData.username,
        ...(userType === 'student' && { class: editFormData.class }),
        ...(userType === 'teacher' && { subject: editFormData.subject })
      });

      setNotification({ show: true, message: 'Profile updated successfully!', type: 'success' });
      setShowEditModal(false);
      setShowDetailsModal(false);
      // Refresh data
      fetchOverviewStats();
    } catch (error) {
      console.error('Error updating profile:', error);
      setNotification({ show: true, message: 'Failed to update profile. Please try again.', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = () => {
    // Reset form and show modal
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordModal(true);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();

    const trimmedNewPassword = newPassword.trim();
    const trimmedConfirmPassword = confirmPassword.trim();

    if (!trimmedNewPassword || !trimmedConfirmPassword) {
      setNotification({ show: true, message: 'Please fill in both password fields.', type: 'error' });
      return;
    }

    if (trimmedNewPassword.length < 6) {
      setNotification({ show: true, message: 'Password must be at least 6 characters long.', type: 'error' });
      return;
    }

    if (trimmedNewPassword !== trimmedConfirmPassword) {
      setNotification({ show: true, message: 'Passwords do not match.', type: 'error' });
      return;
    }

    setActionLoading(true);
    try {
      const adminUpdatePassword = httpsCallable(functions, 'adminUpdateUserPassword');
      
      const result = await adminUpdatePassword({
        uid: selectedUser.uid || selectedUser.id,
        newPassword: trimmedNewPassword,
        callerUid: user?.uid
      });

      if (result.data.success) {
        setShowPasswordModal(false);
        setNewPassword('');
        setConfirmPassword('');
        setNotification({ 
          show: true, 
          message: `Success! Password for ${selectedUser.username} has been updated via security protocol.`, 
          type: 'success' 
        });
      }
    } catch (error) {
      console.error('Error changing password via Cloud Function:', error);
      setNotification({ 
        show: true, 
        message: `Security Error: ${error.message || 'Failed to update password. Please try again.'}`, 
        type: 'error' 
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspendAccount = async () => {
    if (!confirm(`Are you sure you want to suspend the account for ${selectedUser.username}? This will prevent them from logging in.`)) {
      return;
    }

    setActionLoading(true);
    try {
      const userDocRef = doc(db, 'users', selectedUser.uid || selectedUser.id);
      await updateDoc(userDocRef, {
        suspended: true,
        suspendedBy: userData?.username || 'Principal',
        suspendedAt: Timestamp.now()
      });

      setNotification({ show: true, message: `Account for ${selectedUser.username} has been suspended.`, type: 'success' });
      setShowDetailsModal(false);
      fetchOverviewStats();
    } catch (error) {
      console.error('Error suspending account:', error);
      setNotification({ show: true, message: 'Failed to suspend account. Please try again.', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnsuspendAccount = async () => {
    if (!confirm(`Are you sure you want to unsuspend the account for ${selectedUser.username}? This will allow them to login again.`)) {
      return;
    }

    setActionLoading(true);
    try {
      const userDocRef = doc(db, 'users', selectedUser.uid || selectedUser.id);
      await updateDoc(userDocRef, {
        suspended: false,
        unsuspendedBy: userData?.username || 'Principal',
        unsuspendedAt: Timestamp.now()
      });

      setNotification({ show: true, message: `Account for ${selectedUser.username} has been unsuspended.`, type: 'success' });
      setShowDetailsModal(false);
      fetchOverviewStats();
    } catch (error) {
      console.error('Error unsuspending account:', error);
      setNotification({ show: true, message: 'Failed to unsuspend account. Please try again.', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm(`⚠️ WARNING: Are you sure you want to DELETE the account for ${selectedUser.username}?\n\nThis action:\n- Will permanently delete the user account\n- Cannot be undone\n- Will remove all user data`)) {
      return;
    }

    const adminPassword = prompt('Enter your admin password to authorize deletion:');
    if (!adminPassword) {
      setNotification({ show: true, message: 'Account deletion cancelled - password required.', type: 'error' });
      return;
    }

    setActionLoading(true);

    try {
      const adminEmail = user?.email || userData?.email;
      if (!adminEmail) throw new Error('Admin email not found');

      await signInWithEmailAndPassword(auth, adminEmail, adminPassword);

      const userDocRef = doc(db, 'users', selectedUser.uid || selectedUser.id);
      const userDoc = await getDoc(userDocRef);

      // Try deleting user's auth using stored password
      const userPassword = userDoc.data()?._tempPassword;
      let authDeleted = false;

      if (userPassword) {
        try {
          const userCredential = await signInWithEmailAndPassword(secondaryAuth, selectedUser.email, userPassword);
          await deleteUser(userCredential.user);
          await secondaryAuth.signOut();
          authDeleted = true;

        } catch (err) {
          console.warn('Could not delete user from Auth:', err);
        }
      }

      // Show warning if auth deletion failed
      if (!authDeleted) {
        setNotification({
          show: true,
          message: `⚠️ User removed from database, but you need to manually delete from Firebase Auth.\n\nGo to: Firebase Console → Authentication → Users → Find "${selectedUser.email}" → Delete`,
          type: 'warning'
        });
      }

      // If student, try to remove any parent auth accounts that reference this student
      if (selectedUser.role === 'student' && userDoc.exists()) {
        const parentsQuery = query(collection(db, 'users'), where('role', '==', 'parent'));
        const parentsSnapshot = await getDocs(parentsQuery);

        for (const parentDoc of parentsSnapshot.docs) {
          const parentData = parentDoc.data();
          if (Array.isArray(parentData.children) && parentData.children.some(c => c.id === (selectedUser.uid || selectedUser.id))) {
            const parentPassword = parentData._tempPassword;
            if (parentPassword) {
              try {
                const parentCredential = await signInWithEmailAndPassword(secondaryAuth, parentData.email, parentPassword);
                await deleteUser(parentCredential.user);
                await secondaryAuth.signOut();
              } catch (err) {
                console.warn('Failed to delete parent auth account:', err);
              }
            } else {
              setNotification({ show: true, message: `⚠️ Database entry deleted for ${selectedUser.username}. Parent auth deletion skipped (no saved password).`, type: 'success' });
            }
          }
        }
      }

      // Remove user document from Firestore
      await deleteDoc(userDocRef);
      setNotification({ show: true, message: `Account for ${selectedUser.username} deleted successfully.`, type: 'success' });
      setShowDetailsModal(false);
      fetchOverviewStats();
    } catch (error) {
      console.error('Error deleting account:', error);
      setNotification({ show: true, message: 'Failed to delete account. Please try again.', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePromoteStudents = async () => {
    if (!confirm('⚠️ Are you sure you want to promote all students to the next grade for the June 2025 - March 2026 academic year?\n\nThis will:\n- Increment the class of all students from Class 1-9 by 1.\n- Mark Class 10 students as "Alumni".\n- Update their parent records.\n\nThis action cannot be easily undone.')) {
      return;
    }

    const adminPassword = prompt('To authorize this academic roll-over, please enter your admin password:');
    if (!adminPassword) {
      setNotification({ show: true, message: 'Academic roll-over cancelled. Admin password required.', type: 'error' });
      return;
    }

    setActionLoading(true);
    try {
      const adminEmail = user?.email || userData?.email;
      if (!adminEmail) throw new Error('Admin email not found');

      await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE_URL}/api/admin/promote-students`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        }
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Promotion failed');
      }

      setNotification({ 
        show: true, 
        message: `🎉 Success: ${resData.message} (Promoted: ${resData.promotedCount}, Graduated: ${resData.graduatedCount})`, 
        type: 'success' 
      });

      fetchOverviewStats();
    } catch (error) {
      console.error('Error promoting students:', error);
      setNotification({ 
        show: true, 
        message: `Error: ${error.message || 'Academic roll-over failed. Please try again.'}`, 
        type: 'error' 
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAnnouncementSubmit = async (e) => {
    e.preventDefault();
    if (!announcementData.title.trim() || !announcementData.message.trim()) {
      setNotification({ show: true, message: 'Please fill in both title and message', type: 'error' });
      return;
    }

    setAnnouncementLoading(true);
    try {
      await addDoc(collection(db, 'announcements'), {
        title: announcementData.title,
        message: announcementData.message,
        targetAudience: announcementData.targetAudience,
        schoolName: userData?.schoolName || '',
        createdBy: user?.uid,
        createdByName: userData?.username || 'Principal',
        createdAt: Timestamp.now(),
        isActive: true,
        seenByStudents: [],
        seenByParents: []
      });

      setAnnouncementSuccess(true);
      setAnnouncementData({ title: '', message: '', targetAudience: 'all' });

      // Refresh announcements list
      await fetchAnnouncements();

      setTimeout(() => setAnnouncementSuccess(false), 3000);
    } catch (error) {
      console.error('Error creating announcement:', error);
      setNotification({ show: true, message: 'Failed to create announcement. Please try again.', type: 'error' });
    } finally {
      setAnnouncementLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateUserError('');

    // Validation
    if (!createUserData.name.trim() || !createUserData.email.trim() || !createUserData.password.trim()) {
      setCreateUserError('Please fill in all required fields');
      return;
    }

    if (createUserData.password.length < 6) {
      setCreateUserError('Password must be at least 6 characters');
      return;
    }

    if (createUserData.userType === 'student' && (!createUserData.parentName.trim() || !createUserData.parentEmail.trim() || !createUserData.parentPassword.trim())) {
      setCreateUserError('Please fill in all parent fields');
      return;
    }

    if (createUserData.userType === 'student' && createUserData.parentPassword.length < 6) {
      setCreateUserError('Parent password must be at least 6 characters');
      return;
    }

    setCreateUserLoading(true);

    try {
      // Store admin email to sign back in after creating users
      const adminEmail = user.email;
      const adminPassword = prompt('Enter your admin password (required to maintain your session after creating new users):');

      if (!adminPassword) {
        setCreateUserError('Admin password is required to create users');
        setCreateUserLoading(false);
        return;
      }

      // Pre-processing: Trim all credentials
      const studentEmail = createUserData.email?.trim();
      const studentPassword = createUserData.password?.trim();
      const parentEmail = createUserData.parentEmail?.trim();
      const parentPassword = createUserData.parentPassword?.trim();

      let studentId = null;
      let newUser;

      // Use secondary auth to create user without affecting admin session
      try {
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, studentEmail, studentPassword);
        newUser = userCredential.user;
      } catch (authError) {
        if (authError.code === 'auth/email-already-in-use' && createUserData.userType === 'student') {
          // Student auth may exist from a previous failed attempt — try to sign in and reuse
          try {
            const existingCredential = await signInWithEmailAndPassword(secondaryAuth, studentEmail, studentPassword);
            newUser = existingCredential.user;
            // Check if Firestore doc already exists and is complete
            const existingDoc = await getDoc(doc(db, 'users', newUser.uid));
            if (existingDoc.exists() && existingDoc.data().parentId) {
              // Account fully exists — this is truly a duplicate
              setCreateUserError('This student account already exists and is fully set up.');
              setCreateUserLoading(false);
              return;
            }
            // Otherwise, proceed — the auth exists but Firestore setup was incomplete

          } catch (signInError) {
            // Can't sign in — password doesn't match the existing account
            throw authError; // Re-throw original "email already in use" error
          }
        } else {
          throw authError; // Re-throw for non-student or non-email-in-use errors
        }
      }

      // Create user document in Firestore
      const userDocData = {
        uid: newUser.uid,
        email: studentEmail,
        username: createUserData.name,
        role: createUserData.userType,
        schoolName: userData?.schoolName || '', // Inherit from principal
        createdAt: Timestamp.now(),
        createdBy: userData?.username || 'Admin',
        createdById: user?.uid,
        // Store password temporarily for account deletion (admin use only)
        _tempPassword: studentPassword
      };

      // Add role-specific fields
      if (createUserData.userType === 'student') {
        userDocData.class = parseInt(createUserData.class);
        userDocData.children = []; // Will be populated if parent is created
        studentId = newUser.uid;
      } else if (createUserData.userType === 'teacher') {
        userDocData.subject = createUserData.subject;
        userDocData.classes = createUserData.classes.map(c => parseInt(c)); // Array of class numbers teacher teaches
      } else if (createUserData.userType === 'parent') {
        userDocData.children = []; // Can be linked later
        userDocData.childrenIds = []; // Can be linked later
      }

      await setDoc(doc(db, 'users', newUser.uid), userDocData);


      // Create or link parent for student (always required)
      if (createUserData.userType === 'student') {
        // Check if a parent with this email already exists in Firestore
        const parentQuery = query(
          collection(db, 'users'),
          where('email', '==', parentEmail),
          where('role', '==', 'parent')
        );
        const parentSnapshot = await getDocs(parentQuery);

        if (!parentSnapshot.empty) {
          // Parent already exists — just add the new child to their arrays
          const existingParentDoc = parentSnapshot.docs[0];
          const existingParentId = existingParentDoc.id;

          await updateDoc(doc(db, 'users', existingParentId), {
            children: arrayUnion({
              id: studentId,
              name: createUserData.name,
              class: parseInt(createUserData.class)
            }),
            childrenIds: arrayUnion(studentId)
          });



          // Update student document with existing parent information
          await updateDoc(doc(db, 'users', studentId), {
            parentId: existingParentId,
            parentName: existingParentDoc.data().username || createUserData.parentName,
            parentEmail: parentEmail
          });


        } else {
          // Parent does not exist — create a new parent account
          const parentCredential = await createUserWithEmailAndPassword(secondaryAuth, parentEmail, parentPassword);
          const newParent = parentCredential.user;

          await setDoc(doc(db, 'users', newParent.uid), {
            uid: newParent.uid,
            email: parentEmail,
            username: createUserData.parentName,
            role: 'parent',
            schoolName: userData?.schoolName || '', // Inherit from principal
            children: [{
              id: studentId,
              name: createUserData.name,
              class: parseInt(createUserData.class)
            }],
            childrenIds: [studentId],
            createdAt: Timestamp.now(),
            createdBy: userData?.username || 'Admin',
            createdById: user?.uid,
            // Store password temporarily for account deletion (admin use only)
            _tempPassword: parentPassword
          });



          // Update student document with new parent information
          await updateDoc(doc(db, 'users', studentId), {
            parentId: newParent.uid,
            parentName: createUserData.parentName,
            parentEmail: parentEmail
          });


        }
      }

      // Sign out from secondary auth to clean up
      await secondaryAuth.signOut();


      // Show success message
      setCreateUserSuccess(true);
      setCreateUserData({
        userType: 'student',
        name: '',
        email: '',
        password: '',
        class: '6',
        subject: '',
        classes: [],
        parentName: '',
        parentEmail: '',
        parentPassword: ''
      });

      // Refresh data
      await fetchOverviewStats();

      setTimeout(() => setCreateUserSuccess(false), 5000);
    } catch (error) {
      console.error('Error creating user:', error);
      if (error.code === 'auth/email-already-in-use') {
        setCreateUserError('Email is already in use. This usually happens when:\n1. A user with this email already exists\n2. You recently deleted this account but the Firebase Authentication entry still exists\n\nSolutions:\n1. Use a different email address\n2. Go to Firebase Console > Authentication > Users and manually delete the auth entry for this email\n3. Wait 24 hours and try again');
      } else if (error.code === 'auth/invalid-email') {
        setCreateUserError('Invalid email address');
      } else if (error.code === 'auth/weak-password') {
        setCreateUserError('Password is too weak');
      } else {
        setCreateUserError('Failed to create user. Please try again.');
      }
    } finally {
      setCreateUserLoading(false);
    }
  };

  const parseCSV = (text) => {
    const lines = [];
    let row = [""];
    let insideQuote = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];
      if (char === '"') {
        if (insideQuote && nextChar === '"') {
          row[row.length - 1] += '"';
          i++;
        } else {
          insideQuote = !insideQuote;
        }
      } else if (char === ',' && !insideQuote) {
        row.push('');
      } else if ((char === '\r' || char === '\n') && !insideQuote) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        lines.push(row);
        row = [''];
      } else {
        row[row.length - 1] += char;
      }
    }
    if (row.length > 1 || row[0] !== '') {
      lines.push(row);
    }
    return lines;
  };

  const getColumnValue = (headers, row, aliases) => {
    for (const alias of aliases) {
      const idx = headers.indexOf(alias.toLowerCase());
      if (idx !== -1 && idx < row.length) {
        return row[idx];
      }
    }
    return '';
  };

  const downloadCSVTemplate = (type) => {
    let headers = '';
    let sample = '';
    let filename = '';

    if (type === 'student') {
      headers = 'Name,Email,Class,Password\n';
      sample = 'John Doe,john.doe@trinityicse.com,6,password123\nJane Smith,jane.smith@trinityicse.com,7,studentPass456';
      filename = 'students_template.csv';
    } else if (type === 'teacher') {
      headers = 'Name,Email,Subject,Classes,Password\n';
      sample = 'Sarah Connor,sarah.c@trinityicse.com,Physics,"6,7,8",teacherPass123\nJames Hook,james.h@trinityicse.com,English,"9,10",englishPass456';
      filename = 'teachers_template.csv';
    } else if (type === 'parent') {
      headers = 'Name,Email,Linked Child Username,Password\n';
      sample = 'Robert Doe,robert.doe@parent.com,"john.doe@trinityicse.com,jane.smith@trinityicse.com",parentPass123\nMary Watson,mary.watson@parent.com,alex.w@trinityicse.com,parentPass456';
      filename = 'parents_template.csv';
    }

    const blob = new Blob([headers + sample], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCSVUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    setImportType(type);
    setImportFile(file);
    setValidationRows([]);
    setImportError('');
    setImportSuccess(false);
    setIsValidating(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const parsedData = parseCSV(text);
        if (parsedData.length < 2) {
          throw new Error('CSV file is empty or missing data rows.');
        }

        const headers = parsedData[0].map(h => h.trim().toLowerCase());
        const rows = parsedData.slice(1);

        const validated = [];
        let rowIdx = 1;

        for (const r of rows) {
          if (r.length === 1 && r[0].trim() === '') continue;
          rowIdx++;

          const name = getColumnValue(headers, r, ['name', 'full name', 'username'])?.trim() || '';
          const email = getColumnValue(headers, r, ['email', 'email address', 'username'])?.trim() || '';
          const password = getColumnValue(headers, r, ['password', 'pwd'])?.trim() || '';

          const errors = [];
          const validatedRow = {
            rowNum: rowIdx,
            name,
            email,
            password,
            errors,
            status: 'Ready'
          };

          if (!name) errors.push('Name is required');
          if (!email) {
            errors.push('Email is required');
          } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.push('Invalid email format');
          }

          if (!password) {
            errors.push('Password is required');
          } else if (password.length < 6) {
            errors.push('Password must be at least 6 characters');
          }

          if (type === 'student') {
            const classVal = getColumnValue(headers, r, ['class', 'grade'])?.trim() || '';
            validatedRow.class = classVal;
            if (!classVal) {
              errors.push('Class is required');
            } else {
              const classNum = parseInt(classVal);
              if (isNaN(classNum) || classNum < 1 || classNum > 12) {
                errors.push('Class must be a number between 1 and 12');
              }
            }
          } else if (type === 'teacher') {
            const subject = getColumnValue(headers, r, ['subject', 'course'])?.trim() || '';
            const classesVal = getColumnValue(headers, r, ['classes', 'grades taught'])?.trim() || '';
            validatedRow.subject = subject;
            validatedRow.classes = classesVal;

            if (!subject) errors.push('Subject is required');
            if (!classesVal) {
              errors.push('Classes are required');
            } else {
              const classesArray = classesVal.split(',').map(c => parseInt(c.trim()));
              if (classesArray.some(isNaN) || classesArray.some(c => c < 1 || c > 12)) {
                errors.push('Classes must be a comma-separated list of numbers between 1 and 12');
              }
            }
          } else if (type === 'parent') {
            const childEmailsVal = getColumnValue(headers, r, ['linked child username', 'child email', 'child emails'])?.trim() || '';
            validatedRow.childEmails = childEmailsVal;

            if (!childEmailsVal) {
              errors.push('Linked child email(s) are required');
            } else {
              const emails = childEmailsVal.split(',').map(e => e.trim());
              validatedRow.parsedChildEmails = emails;
              for (const childEmail of emails) {
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(childEmail)) {
                  errors.push(`Invalid child email format: "${childEmail}"`);
                }
              }
            }
          }

          if (errors.length === 0) {
            try {
              const emailQuery = query(collection(db, 'users'), where('email', '==', email));
              const emailSnapshot = await getDocs(emailQuery);

              if (!emailSnapshot.empty) {
                const existingUser = emailSnapshot.docs[0].data();
                if (type === 'parent' && existingUser.role === 'parent') {
                  validatedRow.status = 'Update';
                  validatedRow.existingParentId = emailSnapshot.docs[0].id;
                } else {
                  errors.push('Email is already registered in the database');
                }
              }

              if (type === 'parent' && validatedRow.parsedChildEmails) {
                validatedRow.childData = [];
                for (const childEmail of validatedRow.parsedChildEmails) {
                  const studentQuery = query(
                    collection(db, 'users'),
                    where('email', '==', childEmail),
                    where('role', '==', 'student')
                  );
                  const studentSnapshot = await getDocs(studentQuery);

                  if (studentSnapshot.empty) {
                    errors.push(`Student with email "${childEmail}" does not exist`);
                  } else {
                    const docRef = studentSnapshot.docs[0];
                    validatedRow.childData.push({
                      id: docRef.id,
                      name: docRef.data().username,
                      class: docRef.data().class
                    });
                  }
                }
              }
            } catch (dbError) {
              console.error('Database validation error:', dbError);
              errors.push('Database query failed during validation');
            }
          }

          if (errors.length > 0) {
            validatedRow.status = 'Error';
          }
          validated.push(validatedRow);
        }

        setValidationRows(validated);
      } catch (err) {
        console.error(err);
        setImportError(err.message || 'Failed to parse CSV file.');
      } finally {
        setIsValidating(false);
      }
    };
    reader.readAsText(file);
  };

  const executeImport = async () => {
    if (validationRows.length === 0) return;
    const errorsCount = validationRows.filter(r => r.status === 'Error').length;
    if (errorsCount > 0) {
      errorToast('Please fix all CSV errors before importing.');
      return;
    }

    setIsExecutingImport(true);
    setImportProgress({
      current: 0,
      total: validationRows.length,
      percentage: 0,
      logs: ['Starting batch import process...']
    });

    try {
      let count = 0;
      for (const row of validationRows) {
        const logMsg = `Processing row ${row.rowNum}: ${row.name} (${row.email})...`;
        setImportProgress(prev => ({
          ...prev,
          logs: [...prev.logs, logMsg]
        }));

        if (importType === 'student') {
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, row.email, row.password);
          const newUser = userCredential.user;
          const userDocData = {
            uid: newUser.uid,
            email: row.email,
            username: row.name,
            role: 'student',
            schoolName: userData?.schoolName || '',
            class: parseInt(row.class),
            children: [],
            createdAt: Timestamp.now(),
            createdBy: userData?.username || 'Admin',
            createdById: user?.uid,
            _tempPassword: row.password
          };
          await setDoc(doc(db, 'users', newUser.uid), userDocData);

        } else if (importType === 'teacher') {
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, row.email, row.password);
          const newUser = userCredential.user;
          const classesArray = row.classes.split(',').map(c => parseInt(c.trim()));
          const userDocData = {
            uid: newUser.uid,
            email: row.email,
            username: row.name,
            role: 'teacher',
            schoolName: userData?.schoolName || '',
            subject: row.subject,
            classes: classesArray,
            createdAt: Timestamp.now(),
            createdBy: userData?.username || 'Admin',
            createdById: user?.uid,
            _tempPassword: row.password
          };
          await setDoc(doc(db, 'users', newUser.uid), userDocData);

        } else if (importType === 'parent') {
          let parentId = null;
          if (row.status === 'Update' && row.existingParentId) {
            parentId = row.existingParentId;
            await updateDoc(doc(db, 'users', parentId), {
              children: arrayUnion(...row.childData),
              childrenIds: arrayUnion(...row.childData.map(c => c.id))
            });
            const updateLog = `Updated existing parent account ${row.email} with new children links.`;
            setImportProgress(prev => ({
              ...prev,
              logs: [...prev.logs, updateLog]
            }));
          } else {
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, row.email, row.password);
            const newParent = userCredential.user;
            parentId = newParent.uid;

            await setDoc(doc(db, 'users', parentId), {
              uid: parentId,
              email: row.email,
              username: row.name,
              role: 'parent',
              schoolName: userData?.schoolName || '',
              children: row.childData,
              childrenIds: row.childData.map(c => c.id),
              createdAt: Timestamp.now(),
              createdBy: userData?.username || 'Admin',
              createdById: user?.uid,
              _tempPassword: row.password
            });
            const createLog = `Created new parent account ${row.email}.`;
            setImportProgress(prev => ({
              ...prev,
              logs: [...prev.logs, createLog]
            }));
          }

          for (const student of row.childData) {
            await updateDoc(doc(db, 'users', student.id), {
              parentId: parentId,
              parentName: row.name,
              parentEmail: row.email
            });
          }
        }

        count++;
        const pct = Math.round((count / validationRows.length) * 100);
        setImportProgress(prev => ({
          ...prev,
          current: count,
          percentage: pct,
          logs: [...prev.logs, `Successfully imported ${row.email}.`]
        }));
      }

      await secondaryAuth.signOut();

      setImportSuccess(true);
      successToast(`Successfully imported ${count} users!`);
      setValidationRows([]);
      setImportFile(null);
      await fetchOverviewStats();
    } catch (err) {
      console.error('Execution import error:', err);
      errorToast(`Import failed: ${err.message}`);
      setImportProgress(prev => ({
        ...prev,
        logs: [...prev.logs, `❌ Error: ${err.message}`]
      }));
    } finally {
      setIsExecutingImport(false);
    }
  };

  const renderBulkImport = () => {
    const localStyles = {
      card: {
        background: 'rgba(30, 41, 59, 0.4)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius: '20px',
        padding: '24px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        transition: 'all 0.3s ease'
      },
      cardHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '4px'
      },
      cardTitle: {
        fontSize: '18px',
        fontWeight: '700',
        color: '#ffffff',
        margin: 0
      },
      cardDesc: {
        fontSize: '13px',
        color: '#94a3b8',
        lineHeight: '1.5',
        margin: 0
      },
      btnDownload: {
        background: 'rgba(96, 165, 250, 0.1)',
        color: '#60a5fa',
        border: '1px solid rgba(96, 165, 250, 0.2)',
        borderRadius: '10px',
        padding: '10px 16px',
        fontSize: '13px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px'
      },
      btnUpload: {
        background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
        color: '#ffffff',
        border: 'none',
        borderRadius: '10px',
        padding: '12px 20px',
        fontSize: '13px',
        fontWeight: '700',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
      },
      resultsContainer: {
        marginTop: '32px',
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: '24px',
        padding: '32px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)'
      },
      badgeReady: {
        background: 'rgba(16, 185, 129, 0.1)',
        color: '#34d399',
        padding: '4px 8px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: '700',
        display: 'inline-block'
      },
      badgeUpdate: {
        background: 'rgba(245, 158, 11, 0.1)',
        color: '#fbbf24',
        padding: '4px 8px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: '700',
        display: 'inline-block'
      },
      badgeError: {
        background: 'rgba(239, 68, 68, 0.1)',
        color: '#f87171',
        padding: '4px 8px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: '700',
        display: 'inline-block'
      },
      progressBarOuter: {
        width: '100%',
        height: '8px',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '4px',
        overflow: 'hidden',
        marginTop: '16px'
      },
      progressBarInner: {
        height: '100%',
        background: 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%)',
        transition: 'width 0.3s ease'
      },
      terminalLog: {
        background: '#090d16',
        borderRadius: '12px',
        padding: '16px',
        fontFamily: "'Fira Code', 'Courier New', Courier, monospace",
        fontSize: '12px',
        color: '#a7f3d0',
        height: '200px',
        overflowY: 'auto',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        marginTop: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }
    };

    const hasErrors = validationRows.some(row => row.status === 'Error');
    const validCount = validationRows.filter(row => row.status !== 'Error').length;

    return (
      <div style={{ padding: '8px 24px 24px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '32px' }}>
          <h2 style={{ ...styles.sectionTitle, margin: 0, fontSize: '26px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <DatabaseIcon size={28} color="#60a5fa" />
            Bulk CSV Enrollment
          </h2>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '14px', maxWidth: '800px', lineHeight: '1.6' }}>
            Enroll students, teachers, and parent profiles in batches by uploading a CSV list.
            Download the templates below, fill in the data, validate, and execute the import.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          <div style={localStyles.card}>
            <div style={localStyles.cardHeader}>
              <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <StudentIcon size={24} color="#60a5fa" />
              </div>
              <h3 style={localStyles.cardTitle}>Students Import</h3>
            </div>
            <p style={localStyles.cardDesc}>
              Bulk create student user credentials and records. Links parents to student emails during parent list upload.
            </p>
            <div style={{ display: 'flex', gap: '12px', marginTop: 'auto', paddingTop: '8px' }}>
              <button onClick={() => downloadCSVTemplate('student')} style={localStyles.btnDownload}>
                📋 Sample CSV
              </button>
              <label style={localStyles.btnUpload}>
                📁 Upload CSV
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => handleCSVUpload(e, 'student')}
                  style={{ display: 'none' }}
                  disabled={isValidating || isExecutingImport}
                />
              </label>
            </div>
          </div>

          <div style={localStyles.card}>
            <div style={localStyles.cardHeader}>
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TeacherIcon size={24} color="#34d399" />
              </div>
              <h3 style={localStyles.cardTitle}>Teachers Import</h3>
            </div>
            <p style={localStyles.cardDesc}>
              Batch create teacher accounts. Requires Name, Email, Subject, Classes (comma separated integers e.g. "6,7"), and Password.
            </p>
            <div style={{ display: 'flex', gap: '12px', marginTop: 'auto', paddingTop: '8px' }}>
              <button onClick={() => downloadCSVTemplate('teacher')} style={localStyles.btnDownload}>
                📋 Sample CSV
              </button>
              <label style={{ ...localStyles.btnUpload, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}>
                📁 Upload CSV
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => handleCSVUpload(e, 'teacher')}
                  style={{ display: 'none' }}
                  disabled={isValidating || isExecutingImport}
                />
              </label>
            </div>
          </div>

          <div style={localStyles.card}>
            <div style={localStyles.cardHeader}>
              <div style={{ background: 'rgba(139, 92, 246, 0.1)', padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ParentIcon size={24} color="#a78bfa" />
              </div>
              <h3 style={localStyles.cardTitle}>Parents Import</h3>
            </div>
            <p style={localStyles.cardDesc}>
              Create parent profiles and establish child links. Links to multiple children via comma-separated student emails.
            </p>
            <div style={{ display: 'flex', gap: '12px', marginTop: 'auto', paddingTop: '8px' }}>
              <button onClick={() => downloadCSVTemplate('parent')} style={localStyles.btnDownload}>
                📋 Sample CSV
              </button>
              <label style={{ ...localStyles.btnUpload, background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)', boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)' }}>
                📁 Upload CSV
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => handleCSVUpload(e, 'parent')}
                  style={{ display: 'none' }}
                  disabled={isValidating || isExecutingImport}
                />
              </label>
            </div>
          </div>
        </div>

        {isValidating && (
          <div style={{ ...localStyles.resultsContainer, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '48px' }}>
            <div style={styles.spinner}></div>
            <span style={{ fontSize: '15px', color: '#e2e8f0', fontWeight: '600' }}>Validating CSV file data & database records...</span>
          </div>
        )}

        {isExecutingImport && (
          <div style={localStyles.resultsContainer}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '700', color: '#ffffff' }}>
              Importing User Accounts...
            </h3>
            <div style={{ fontSize: '14px', color: '#94a3b8', fontWeight: '600' }}>
              Processed: {importProgress.current} / {importProgress.total} ({importProgress.percentage}%)
            </div>
            <div style={localStyles.progressBarOuter}>
              <div style={{ ...localStyles.progressBarInner, width: `${importProgress.percentage}%` }}></div>
            </div>
            <div style={localStyles.terminalLog}>
              {importProgress.logs.map((log, idx) => (
                <div key={idx}>{log}</div>
              ))}
            </div>
          </div>
        )}

        {!isValidating && !isExecutingImport && validationRows.length > 0 && (
          <div style={localStyles.resultsContainer}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: '800', color: '#ffffff' }}>
                  Validation Results: {importFile?.name} ({importType?.toUpperCase()})
                </h3>
                <span style={{ fontSize: '14px', color: hasErrors ? '#f87171' : '#34d399', fontWeight: '600' }}>
                  {hasErrors 
                    ? `⚠️ Found ${validationRows.filter(r => r.status === 'Error').length} error(s). Please fix the CSV and re-upload.`
                    : `✓ All ${validCount} rows validated successfully and are ready for import.`
                  }
                </span>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  onClick={() => {
                    setValidationRows([]);
                    setImportFile(null);
                    setImportType(null);
                  }}
                  style={{ ...styles.cancelBtn, border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '12px 24px', borderRadius: '10px' }}
                >
                  Clear Results
                </button>
                <button
                  disabled={hasErrors}
                  onClick={executeImport}
                  style={{ 
                    ...localStyles.btnUpload, 
                    opacity: hasErrors ? 0.5 : 1, 
                    cursor: hasErrors ? 'not-allowed' : 'pointer',
                    background: hasErrors ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    boxShadow: hasErrors ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.3)',
                    padding: '12px 24px',
                    borderRadius: '10px'
                  }}
                >
                  🚀 Execute Import
                </button>
              </div>
            </div>

            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeader}>
                    <th style={{ ...styles.th, width: '80px' }}>Row</th>
                    <th style={styles.th}>Name</th>
                    <th style={styles.th}>Email</th>
                    <th style={styles.th}>
                      {importType === 'student' ? 'Class' : importType === 'teacher' ? 'Subject / Classes' : 'Child Emails'}
                    </th>
                    <th style={{ ...styles.th, width: '120px' }}>Status</th>
                    <th style={styles.th}>Validation Notes / Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {validationRows.map((row, idx) => (
                    <tr 
                      key={idx} 
                      style={{ 
                        ...styles.tableRow, 
                        backgroundColor: row.status === 'Error' ? 'rgba(239, 68, 68, 0.05)' : 'transparent' 
                      }}
                    >
                      <td style={styles.td}>{row.rowNum}</td>
                      <td style={{ ...styles.td, fontWeight: '700' }}>{row.name || <em style={{ color: '#64748b' }}>empty</em>}</td>
                      <td style={styles.td}>{row.email || <em style={{ color: '#64748b' }}>empty</em>}</td>
                      <td style={styles.td}>
                        {importType === 'student' && (row.class || <em style={{ color: '#64748b' }}>empty</em>)}
                        {importType === 'teacher' && `${row.subject || 'N/A'} (Classes: ${row.classes || 'None'})`}
                        {importType === 'parent' && (row.childEmails || <em style={{ color: '#64748b' }}>empty</em>)}
                      </td>
                      <td style={styles.td}>
                        {row.status === 'Ready' && <span style={localStyles.badgeReady}>Ready</span>}
                        {row.status === 'Update' && <span style={localStyles.badgeUpdate}>Update</span>}
                        {row.status === 'Error' && <span style={localStyles.badgeError}>Error</span>}
                      </td>
                      <td style={{ ...styles.td, color: row.status === 'Error' ? '#f87171' : '#34d399', fontSize: '13px' }}>
                        {row.status === 'Error' 
                          ? row.errors.join('; ')
                          : row.status === 'Update'
                            ? '✓ Account exists. Linking to student(s).'
                            : '✓ Ready'
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const views = [
    { id: 'overview', label: 'Overview', icon: <OverviewIcon size={20} color="currentColor" /> },
    { id: 'teachers', label: 'Teachers', icon: <TeacherIcon size={20} color="currentColor" /> },
    { id: 'students', label: 'Students', icon: <StudentIcon size={20} color="currentColor" /> },
    { id: 'parents', label: 'Parents', icon: <ParentIcon size={20} color="currentColor" /> },
    { id: 'leaderboard', label: 'Leaderboard', icon: <TrophyIcon size={20} color="currentColor" /> },
    { id: 'progress-reports', label: 'Progress Reports', icon: <ReportIcon size={20} color="currentColor" /> },
    { id: 'faq-manager', label: 'Knowledge Base', icon: <PlusIcon size={20} color="currentColor" /> },
    { id: 'announcements', label: 'Broadcast', icon: <MegaphoneIcon size={20} color="currentColor" /> },
    { id: 'createUser', label: 'Enroll User', icon: <PlusIcon size={20} color="currentColor" /> },
    { id: 'bulk-import', label: 'Bulk Import', icon: <DatabaseIcon size={20} color="currentColor" /> }
  ];

const AdminProgressRing = ({ percentage, color, emoji, isMobile }) => {
  const size = isMobile ? 44 : 56;
  const radius = isMobile ? 17 : 22;
  const strokeWidth = isMobile ? 2.5 : 3;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, parseFloat(percentage) || 0)) / 100) * circumference;

  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', transform: 'rotate(-90deg)', top: 0, left: 0 }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255, 255, 255, 0.05)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      </svg>
      <div style={{ position: 'relative', zIndex: 1, fontSize: isMobile ? '20px' : '26px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {emoji}
      </div>
    </div>
  );
};

  const renderOverview = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={styles.overviewContainer}
    >
      <motion.h2
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        style={{
          ...styles.sectionTitle,
          fontSize: '28px',
          background: 'linear-gradient(135deg, #ffffff 0%, #94a3b8 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '32px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}
      >
        <SchoolIcon size={32} color="#60a5fa" />
        Trinity Central School Overview
      </motion.h2>

      {/* Principal's Morning Coffee View - Premium Analytics */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
        style={{
          marginBottom: '40px',
          padding: '40px',
          background: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(32px) saturate(180%)',
          borderRadius: '32px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 30px 60px rgba(0, 0, 0, 0.4)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Glow Effects */}
        <div style={{
          position: 'absolute',
          top: '-30%',
          left: '-10%',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, rgba(0,0,0,0) 70%)',
          borderRadius: '50%',
          pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-20%',
          right: '-5%',
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.08) 0%, rgba(0,0,0,0) 70%)',
          borderRadius: '50%',
          pointerEvents: 'none'
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '32px'
          }}>
            <div>
              <h3 style={{
                margin: 0,
                fontSize: '22px',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                letterSpacing: '-0.3px',
                fontWeight: '800'
              }}>
                <span style={{ fontSize: '28px' }}>☕</span> Morning Coffee Report
              </h3>
              <p style={{ margin: '4px 0 0 0', color: 'rgba(148, 163, 184, 0.8)', fontSize: '14px' }}>
                Quick briefing on today's school performance
              </p>
            </div>
            <motion.span
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 2 }}
              style={{
                fontSize: '12px',
                color: '#60a5fa',
                background: 'rgba(59, 130, 246, 0.1)',
                padding: '8px 16px',
                borderRadius: '30px',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                fontWeight: 700,
                letterSpacing: '0.5px',
                textTransform: 'uppercase'
              }}
            >
              ● Live Updates
            </motion.span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : `repeat(auto-fit, minmax(260px, 1fr))`,
            gap: isMobile ? '12px' : '24px'
          }}>
            {/* Daily Engagement Card */}
            <motion.div
              whileHover={{ y: -5, scale: 1.02 }}
              style={{
                background: 'linear-gradient(135deg, rgba(52, 211, 153, 0.1), rgba(15, 23, 42, 0.4))',
                padding: isMobile ? '16px' : '24px',
                borderRadius: '24px',
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: isMobile ? 'flex-start' : 'center',
                gap: isMobile ? '12px' : '20px',
                border: '1px solid rgba(52, 211, 153, 0.2)',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 10px 20px rgba(0, 0, 0, 0.2)'
              }}
            >
              <AdminProgressRing percentage={analytics.dailyEngagement} color="#34D399" emoji="🚀" isMobile={isMobile} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: isMobile ? '28px' : '36px', fontWeight: '900', color: '#fff', lineHeight: 1, letterSpacing: '-1.5px' }}>
                  {analytics.dailyEngagement}%
                </div>
                <div style={{ fontSize: isMobile ? '12px' : '14px', color: 'rgba(255, 255, 255, 0.8)', margin: '6px 0 2px', fontWeight: '600' }}>Engagement</div>
                <div style={{ fontSize: '10px', color: '#34d399', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {selectedClass === 'all' ? 'Daily' : `Class ${selectedClass}`}
                </div>
              </div>
            </motion.div>

            {/* Average Quiz Score Card */}
            <motion.div
              whileHover={{ y: -5, scale: 1.02 }}
              style={{
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(15, 23, 42, 0.4))',
                padding: isMobile ? '16px' : '24px',
                borderRadius: '24px',
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: isMobile ? 'flex-start' : 'center',
                gap: isMobile ? '12px' : '20px',
                border: '1px solid rgba(139, 92, 246, 0.2)',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 10px 20px rgba(0, 0, 0, 0.2)'
              }}
            >
              <AdminProgressRing percentage={analytics.averageQuizScore} color="#a78bfa" emoji="🎯" isMobile={isMobile} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: isMobile ? '28px' : '36px', fontWeight: '900', color: '#fff', lineHeight: 1, letterSpacing: '-1.5px' }}>
                  {analytics.averageQuizScore}%
                </div>
                <div style={{ fontSize: isMobile ? '12px' : '14px', color: 'rgba(255, 255, 255, 0.8)', margin: '6px 0 2px', fontWeight: '600' }}>Avg Score</div>
                <div style={{ fontSize: '10px', color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Performance
                </div>
              </div>
            </motion.div>

            {/* Weekly Activity Card */}
            <motion.div
              whileHover={{ y: -5, scale: 1.02 }}
              style={{
                background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.1), rgba(15, 23, 42, 0.4))',
                padding: isMobile ? '16px' : '24px',
                borderRadius: '24px',
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: isMobile ? 'flex-start' : 'center',
                gap: isMobile ? '12px' : '20px',
                border: '1px solid rgba(251, 191, 36, 0.2)',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 10px 20px rgba(0, 0, 0, 0.2)'
              }}
            >
              <div style={{
                width: isMobile ? '44px' : '56px',
                height: isMobile ? '44px' : '56px',
                borderRadius: '16px',
                background: 'rgba(251, 191, 36, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: isMobile ? '20px' : '28px',
                color: '#fbbf24',
                border: '1px solid rgba(251, 191, 36, 0.3)'
              }}>
                👨‍🏫
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: isMobile ? '28px' : '36px', fontWeight: '900', color: '#fff', lineHeight: 1, letterSpacing: '-1.5px' }}>
                  {analytics.weeklyTeacherActivity}
                </div>
                <div style={{ fontSize: isMobile ? '12px' : '14px', color: 'rgba(255, 255, 255, 0.8)', margin: '6px 0 2px', fontWeight: '600' }}>Assignments</div>
                <div style={{ fontSize: '10px', color: '#fbbf24', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Weekly
                </div>
              </div>
            </motion.div>

            {/* Completion Rate Card */}
            <motion.div
              whileHover={{ y: -5, scale: 1.02 }}
              style={{
                background: 'linear-gradient(135deg, rgba(96, 165, 250, 0.1), rgba(15, 23, 42, 0.4))',
                padding: isMobile ? '16px' : '24px',
                borderRadius: '24px',
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: isMobile ? 'flex-start' : 'center',
                gap: isMobile ? '12px' : '20px',
                border: '1px solid rgba(96, 165, 250, 0.2)',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 10px 20px rgba(0, 0, 0, 0.2)'
              }}
            >
              <AdminProgressRing percentage={analytics.assignmentCompletionRate} color="#60a5fa" emoji="📋" isMobile={isMobile} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: isMobile ? '28px' : '36px', fontWeight: '900', color: '#fff', lineHeight: 1, letterSpacing: '-1.5px' }}>
                  {analytics.assignmentCompletionRate}%
                </div>
                <div style={{ fontSize: isMobile ? '12px' : '14px', color: 'rgba(255, 255, 255, 0.8)', margin: '6px 0 2px', fontWeight: '600' }}>Completion</div>
                <div style={{ fontSize: '10px', color: '#60a5fa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Submitted
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>

      <div style={adminStyles.statsGrid}>
        <div style={styles.overviewCard}>
          <div style={styles.overviewIcon}><TeacherIcon size={32} /></div>
          <div style={styles.overviewContent}>
            <div style={styles.overviewValue}>{stats.totalTeachers}</div>
            <div style={styles.overviewLabel}>Total Teachers</div>
          </div>
        </div>
        <div style={styles.overviewCard}>
          <div style={styles.overviewIcon}><StudentIcon size={32} /></div>
          <div style={styles.overviewContent}>
            <div style={styles.overviewValue}>{stats.totalStudents}</div>
            <div style={styles.overviewLabel}>Total Students</div>
          </div>
        </div>
        <div style={styles.overviewCard}>
          <div style={styles.overviewIcon}><ParentIcon size={32} /></div>
          <div style={styles.overviewContent}>
            <div style={styles.overviewValue}>{stats.totalParents}</div>
            <div style={styles.overviewLabel}>Total Parents</div>
          </div>
        </div>
      </div>

      <div style={styles.quickActions}>
        <h3 style={styles.quickActionsSubtitle}>Quick Actions</h3>
        <div style={styles.actionsGrid}>
          <button onClick={() => setActiveView('teachers')} style={styles.actionButton}>
            <TeacherIcon size={18} color="white" /> Manage Teachers
          </button>
          <button onClick={() => setActiveView('students')} style={styles.actionButton}>
            <StudentIcon size={18} color="white" /> Manage Students
          </button>
          <button onClick={() => setActiveView('announcements')} style={styles.actionButton}>
            <MegaphoneIcon size={18} color="white" /> Create Announcement
          </button>
          <button onClick={handleMigrateParentData} style={styles.actionButton}>
            <OverviewIcon size={18} color="white" /> Fix Parent Data
          </button>
        </div>
      </div>
    </motion.div>
  );

  const renderTeachers = () => {
    // Filter teachers based on search
    const filteredTeachers = teachers.filter(teacher => {
      const searchLower = teacherSearch.toLowerCase();
      return (
        teacher.username?.toLowerCase().includes(searchLower) ||
        teacher.email?.toLowerCase().includes(searchLower)
      );
    });

    return (
      <div style={styles.tableContainer}>
        <div style={styles.tableTitleRow}>
          <h2 style={styles.sectionTitle}>👨‍🏫 Teachers Management</h2>
          <div style={styles.searchContainer}>
            <input
              type="text"
              placeholder="🔍 Search by name or email..."
              value={teacherSearch}
              onChange={(e) => setTeacherSearch(e.target.value)}
              style={styles.searchInput}
            />
            {teacherSearch && (
              <button
                onClick={() => setTeacherSearch('')}
                style={styles.clearSearchButton}
              >
                ✕
              </button>
            )}
          </div>
        </div>
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeader}>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Joined Date</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTeachers.map((teacher, index) => (
                <tr
                  key={teacher.id}
                  style={{
                    ...styles.tableRow,
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    borderBottom: '2px solid #ffffff'
                  }}
                >
                  <td style={styles.td} data-label="Name">{teacher.username || 'N/A'}</td>
                  <td style={styles.td} data-label="Email">{teacher.email}</td>
                  <td style={styles.td} data-label="Joined Date">
                    {teacher.createdAt?.toDate
                      ? teacher.createdAt.toDate().toLocaleDateString()
                      : 'N/A'}
                  </td>
                  <td style={styles.td} data-label="Actions">
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button onClick={() => handleViewDetails(teacher, 'teacher')} style={styles.tableViewButton}>👁️ View Details</button>
                      <button onClick={() => handleViewLessonPlans(teacher)} style={{ ...styles.tableViewButton, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>📅 Lesson Plans</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredTeachers.length === 0 && (
            <div style={styles.userEmptyState}>
              {teacherSearch ? `No teachers found matching "${teacherSearch}"` : 'No teachers found'}
            </div>
          )}
        </div>
        {hasMoreTeachers && !teacherSearch && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
            <button
              onClick={() => handleLoadMoreUsers('teacher')}
              style={{ ...styles.actionButton, backgroundColor: '#6366f1', padding: '10px 30px' }}
            >
              Load More Teachers
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderStudents = () => {
    // Filter students based on search
    const filteredStudents = students.filter(student => {
      const searchLower = studentSearch.toLowerCase();
      return (
        student.username?.toLowerCase().includes(searchLower) ||
        student.email?.toLowerCase().includes(searchLower) ||
        student.class?.toString().includes(searchLower)
      );
    });

    return (
      <div style={styles.messagesTableContainer}>
        <div style={styles.tableTitleRow}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <h2 style={styles.sectionTitle}>👨‍🎓 Students Management</h2>
            <button
              onClick={handlePromoteStudents}
              disabled={actionLoading}
              className="promote-students-btn"
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #7928ca, #ff0080)',
                color: '#fff',
                border: 'none',
                fontWeight: 'bold',
                cursor: actionLoading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(121, 40, 202, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                transition: 'opacity 0.2s'
              }}
            >
              🎓 Promote Students
            </button>
          </div>
          <div style={styles.searchContainer}>
            <input
              type="text"
              placeholder="🔍 Search by name, email, or class..."
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              style={styles.searchInput}
            />
            {studentSearch && (
              <button
                onClick={() => setStudentSearch('')}
                style={styles.clearSearchButton}
              >
                ✕
              </button>
            )}
          </div>
        </div>
        <div style={styles.tableWrapper}>
          <table style={styles.messagesTable}>
            <thead>
              <tr style={styles.messagesTableHeader}>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Class</th>
                <th style={styles.th}>Joined Date</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student, index) => (
                <tr
                  key={student.id}
                  style={{
                    ...styles.tableRow,
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    borderBottom: '2px solid #ffffff'
                  }}
                >
                  <td style={styles.td} data-label="Name">{student.username || 'N/A'}</td>
                  <td style={styles.td} data-label="Email">{student.email}</td>
                  <td style={styles.td} data-label="Class">Class {student.class || 'N/A'}</td>
                  <td style={styles.td} data-label="Joined Date">
                    {student.createdAt?.toDate
                      ? student.createdAt.toDate().toLocaleDateString()
                      : 'N/A'}
                  </td>
                  <td style={styles.td} data-label="Actions">
                    <button onClick={() => handleViewDetails(student, 'student')} style={styles.tableViewButton}>👁️ View Details</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredStudents.length === 0 && (
            <div style={styles.userEmptyState}>
              {studentSearch ? `No students found matching "${studentSearch}"` : 'No students found'}
            </div>
          )}
        </div>
        {hasMoreStudents && !studentSearch && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
            <button
              onClick={() => handleLoadMoreUsers('student')}
              style={{ ...styles.actionButton, backgroundColor: '#6366f1', padding: '10px 30px' }}
            >
              Load More Students
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderParents = () => {
    // Filter parents based on search
    const filteredParents = parents.filter(parent => {
      const searchLower = parentSearch.toLowerCase();
      return (
        parent.username?.toLowerCase().includes(searchLower) ||
        parent.email?.toLowerCase().includes(searchLower)
      );
    });

    return (
      <div style={styles.messagesTableContainer}>
        <div style={styles.tableTitleRow}>
          <h2 style={styles.sectionTitle}>👪 Parents Management</h2>
          <div style={styles.searchContainer}>
            <input
              type="text"
              placeholder="🔍 Search by name or email..."
              value={parentSearch}
              onChange={(e) => setParentSearch(e.target.value)}
              style={styles.searchInput}
            />
            {parentSearch && (
              <button
                onClick={() => setParentSearch('')}
                style={styles.clearSearchButton}
              >
                ✕
              </button>
            )}
          </div>
        </div>
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeader}>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Joined Date</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredParents.map((parent, index) => (
                <tr
                  key={parent.id}
                  style={{
                    ...styles.tableRow,
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    borderBottom: '2px solid #ffffff'
                  }}
                >
                  <td style={styles.td} data-label="Name">{parent.username || 'N/A'}</td>
                  <td style={styles.td} data-label="Email">{parent.email}</td>
                  <td style={styles.td} data-label="Joined Date">
                    {parent.createdAt?.toDate
                      ? parent.createdAt.toDate().toLocaleDateString()
                      : 'N/A'}
                  </td>
                  <td style={styles.td} data-label="Actions">
                    <button onClick={() => handleViewDetails(parent, 'parent')} style={styles.tableViewButton}>👁️ View Details</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredParents.length === 0 && (
            <div style={styles.userEmptyState}>
              {parentSearch ? `No parents found matching "${parentSearch}"` : 'No parents found'}
            </div>
          )}
        </div>
        {hasMoreParents && !parentSearch && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
            <button
              onClick={() => handleLoadMoreUsers('parent')}
              style={{ ...styles.actionButton, backgroundColor: '#6366f1', padding: '10px 30px' }}
            >
              Load More Parents
            </button>
          </div>
        )}
      </div>
    );
  };



  const renderCreateUser = () => (
    <div style={styles.createUserContainer}>
      <h2 style={styles.sectionTitle}>➕ Create New User</h2>

      {createUserSuccess && (
        <div style={styles.successMessage}>
          ✅ User created successfully! Login credentials have been set up.
        </div>
      )}

      {createUserError && (
        <div style={styles.errorMessage}>
          ❌ {createUserError}
        </div>
      )}

      <form onSubmit={handleCreateUser} style={styles.createUserForm}>
        {/* User Type Selection */}
        <div style={styles.formGroup}>
          <label style={styles.formLabel}>User Type *</label>
          <select
            value={createUserData.userType}
            onChange={(e) => setCreateUserData({ ...createUserData, userType: e.target.value })}
            style={styles.formSelect}
            required
          >
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
          </select>
        </div>

        {/* Basic Information */}
        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Full Name *</label>
            <input
              type="text"
              name="user-fullname"
              value={createUserData.name}
              onChange={(e) => setCreateUserData({ ...createUserData, name: e.target.value })}
              style={styles.formInput}
              placeholder="Enter full name"
              autoComplete="off"
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Email Address *</label>
            <input
              type="email"
              name="user-email-new"
              value={createUserData.email}
              onChange={(e) => setCreateUserData({ ...createUserData, email: e.target.value })}
              onFocus={(e) => e.target.removeAttribute('readonly')}
              style={styles.formInput}
              placeholder="user@example.com"
              autoComplete="new-email"
              readOnly
              required
            />
          </div>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.formLabel}>Password *</label>
          <input
            type="password"
            name="user-password-new"
            value={createUserData.password}
            onChange={(e) => setCreateUserData({ ...createUserData, password: e.target.value })}
            onFocus={(e) => e.target.removeAttribute('readonly')}
            style={styles.formInput}
            placeholder="Minimum 6 characters"
            autoComplete="new-password"
            readOnly
            minLength="6"
            required
          />
          <small style={styles.formHint}>Password must be at least 6 characters long</small>
        </div>

        {/* Student-specific fields */}
        {createUserData.userType === 'student' && (
          <>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Class *</label>
              <select
                value={createUserData.class}
                onChange={(e) => setCreateUserData({ ...createUserData, class: e.target.value })}
                style={styles.formSelect}
                required
              >
                <option value="1">Class 1</option>
                <option value="2">Class 2</option>
                <option value="3">Class 3</option>
                <option value="4">Class 4</option>
                <option value="5">Class 5</option>
                <option value="6">Class 6</option>
                <option value="7">Class 7</option>
                <option value="8">Class 8</option>
                <option value="9">Class 9</option>
                <option value="10">Class 10</option>
              </select>
            </div>

            {/* Parent Information (Required) */}
            <div style={styles.parentSection}>
              <h3 style={styles.subsectionTitle}>Parent Account Details (Required)</h3>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Parent Name *</label>
                  <input
                    type="text"
                    name="parent-fullname"
                    value={createUserData.parentName}
                    onChange={(e) => setCreateUserData({ ...createUserData, parentName: e.target.value })}
                    style={styles.formInput}
                    placeholder="Enter parent's full name"
                    autoComplete="off"
                    required
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Parent Email *</label>
                  <input
                    type="email"
                    name="parent-email-new"
                    value={createUserData.parentEmail}
                    onChange={(e) => setCreateUserData({ ...createUserData, parentEmail: e.target.value })}
                    onFocus={(e) => e.target.removeAttribute('readonly')}
                    style={styles.formInput}
                    placeholder="parent@example.com"
                    autoComplete="new-email"
                    readOnly
                    required
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Parent Password *</label>
                <input
                  type="password"
                  name="parent-password-new"
                  value={createUserData.parentPassword}
                  onChange={(e) => setCreateUserData({ ...createUserData, parentPassword: e.target.value })}
                  onFocus={(e) => e.target.removeAttribute('readonly')}
                  style={styles.formInput}
                  placeholder="Minimum 6 characters"
                  autoComplete="new-password"
                  readOnly
                  minLength="6"
                  required
                />
                <small style={styles.formHint}>Parent password must be at least 6 characters long</small>
              </div>
            </div>
          </>
        )}

        {/* Teacher-specific fields */}
        {createUserData.userType === 'teacher' && (
          <>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Subject *</label>
              <select
                value={createUserData.subject}
                onChange={(e) => setCreateUserData({ ...createUserData, subject: e.target.value })}
                style={styles.formSelect}
                required
              >
                <option value="">Select Subject</option>
                <option value="Physics">Physics</option>
                <option value="Chemistry">Chemistry</option>
                <option value="Biology">Biology</option>
                <option value="Mathematics">Mathematics</option>
                <option value="Computer Studies">Computer Studies</option>
                <option value="Geography">Geography</option>
                <option value="History & Civics">History & Civics</option>
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Assign Classes *</label>
              <small style={styles.formHint}>Select which classes this teacher will teach</small>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                gap: '10px',
                marginTop: '10px',
                padding: '15px',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '12px',
                border: '1px solid rgba(121, 40, 202, 0.2)'
              }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((classNum) => (
                  <label
                    key={classNum}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 12px',
                      background: createUserData.classes.includes(classNum.toString())
                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                        : 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      border: createUserData.classes.includes(classNum.toString())
                        ? '2px solid rgba(255, 255, 255, 0.3)'
                        : '2px solid rgba(121, 40, 202, 0.2)',
                      color: createUserData.classes.includes(classNum.toString()) ? 'white' : '#e2e8f0',
                      fontWeight: createUserData.classes.includes(classNum.toString()) ? 600 : 400
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={createUserData.classes.includes(classNum.toString())}
                      onChange={(e) => {
                        const classStr = classNum.toString();
                        if (e.target.checked) {
                          setCreateUserData({ ...createUserData, classes: [...createUserData.classes, classStr] });
                        } else {
                          setCreateUserData({ ...createUserData, classes: createUserData.classes.filter(c => c !== classStr) });
                        }
                      }}
                      style={{ accentColor: '#764ba2', width: '16px', height: '16px' }}
                    />
                    Class {classNum}
                  </label>
                ))}
              </div>
              {createUserData.classes.length === 0 && (
                <small style={{ color: '#ef4444', marginTop: '8px', display: 'block' }}>
                  Please select at least one class
                </small>
              )}
            </div>
          </>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          style={styles.messageSubmitButton}
          disabled={createUserLoading}
        >
          {createUserLoading ? (
            <>
              <div style={styles.buttonSpinner}></div>
              Creating User...
            </>
          ) : (
            <>✨ Create User</>
          )}
        </button>
      </form>
    </div>
  );

  const renderAnnouncements = () => (
    <div style={styles.announcementsContainer}>
      <h2 style={styles.sectionTitle}>📢 School-wide Announcements</h2>

      {announcementSuccess && (
        <div style={styles.successMessage}>
          ✅ Announcement created successfully!
        </div>
      )}

      <form onSubmit={handleAnnouncementSubmit} style={styles.announcementForm}>
        <div style={styles.formGroup}>
          <label style={styles.formLabel}>Target Audience *</label>
          <select
            value={announcementData.targetAudience}
            onChange={(e) => setAnnouncementData({ ...announcementData, targetAudience: e.target.value })}
            style={styles.formSelect}
            required
          >
            <option value="all">All Users (Teachers, Students & Parents)</option>
            <option value="teachers">Teachers Only</option>
            <option value="students">Students Only</option>
            <option value="parents">Parents Only</option>
          </select>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.formLabel}>Announcement Title *</label>
          <input
            type="text"
            value={announcementData.title}
            onChange={(e) => setAnnouncementData({ ...announcementData, title: e.target.value })}
            placeholder="Enter announcement title"
            style={styles.formInput}
            required
            maxLength={100}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.formLabel}>Message *</label>
          <textarea
            value={announcementData.message}
            onChange={(e) => setAnnouncementData({ ...announcementData, message: e.target.value })}
            placeholder="Enter announcement message"
            style={styles.formTextarea}
            required
            rows={6}
            maxLength={500}
          />
          <div style={styles.charCount}>
            {announcementData.message.length}/500 characters
          </div>
        </div>

        <button
          type="submit"
          style={styles.announcementSubmitButton}
          disabled={announcementLoading}
        >
          {announcementLoading ? '📤 Posting...' : '📢 Post Announcement'}
        </button>
      </form>

      {/* Announcement History */}
      <div style={styles.announcementHistory}>
        <h3 style={styles.announcementSubtitle}>📜 Announcement History</h3>

        {announcements.length === 0 ? (
          <div style={styles.announcementEmptyState}>No announcements yet</div>
        ) : (
          <div style={styles.announcementsList}>
            {announcements.map((announcement) => (
              <div key={announcement.id} style={styles.announcementCard}>
                <div style={styles.announcementHeader}>
                  <div>
                    <h4 className="leaderboard-dark-text" style={styles.announcementTitle}>{announcement.title}</h4>
                    <div style={styles.announcementMeta}>
                      <span style={styles.announcementBadge}>
                        {announcement.targetAudience === 'all' ? '🌍 All Users' :
                          announcement.targetAudience === 'teachers' ? '👨‍🏫 Teachers' :
                            announcement.targetAudience === 'students' ? '👨‍🎓 Students' : '👪 Parents'}
                      </span>
                      <span style={styles.announcementDate}>
                        {announcement.createdAt?.toDate?.().toLocaleDateString() || 'N/A'}
                      </span>
                      <span style={styles.announcementAuthor}>
                        By {announcement.createdBy || 'Admin'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      if (confirm('Are you sure you want to delete this announcement?')) {
                        try {
                          await deleteDoc(doc(db, 'announcements', announcement.id));
                          setNotification({ show: true, message: 'Announcement deleted successfully!', type: 'success' });
                          await fetchAnnouncements();
                        } catch (error) {
                          console.error('Error deleting announcement:', error);
                          setNotification({ show: true, message: 'Failed to delete announcement.', type: 'error' });
                        } finally {
                        }
                      }
                    }}
                    style={styles.deleteAnnouncementBtn}
                  >
                    🗑️
                  </button>
                </div>
                <p style={styles.announcementMessage}>{announcement.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderLeaderboard = () => {
    if (leaderboardLoading) {
      return (
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p>Loading leaderboard data...</p>
        </div>
      );
    }

    const mostInteractive = leaderboardData[0];
    const leastInteractive = leaderboardData[leaderboardData.length - 1];

    return (
      <div className="leaderboard-white-bg" style={styles.leaderboardContainer}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 32,
          flexWrap: 'wrap',
          gap: 16,
          padding: '24px 28px',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)',
          borderRadius: 16,
          border: '2px solid rgba(99, 102, 241, 0.2)',
          boxShadow: '0 4px 20px rgba(99, 102, 241, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Decorative corner elements */}
          <div style={{
            position: 'absolute',
            top: -20,
            right: -20,
            width: 100,
            height: 100,
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%)',
            borderRadius: '50%',
            pointerEvents: 'none'
          }}></div>
          <div style={{
            position: 'absolute',
            bottom: -30,
            left: -30,
            width: 120,
            height: 120,
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.1) 0%, transparent 70%)',
            borderRadius: '50%',
            pointerEvents: 'none'
          }}></div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, zIndex: 1 }}>
            <div style={{
              fontSize: 42,
              background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)',
              padding: '12px 16px',
              borderRadius: 16,
              boxShadow: '0 8px 24px rgba(251, 191, 36, 0.4), 0 2px 8px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '3px solid rgba(255, 255, 255, 0.3)',
              animation: 'trophy-glow 3s ease-in-out infinite',
              position: 'relative'
            }}>
              <style>
                {`
                  @keyframes trophy-glow {
                    0%, 100% { 
                      box-shadow: 0 8px 24px rgba(251, 191, 36, 0.4), 0 2px 8px rgba(0, 0, 0, 0.15);
                      transform: scale(1);
                    }
                    50% { 
                      box-shadow: 0 12px 32px rgba(251, 191, 36, 0.6), 0 4px 12px rgba(0, 0, 0, 0.2);
                      transform: scale(1.05);
                    }
                  }
                `}
              </style>
              🏆
            </div>
            <div>
              <div style={{
                display: 'inline-block',
                padding: '4px 12px',
                background: '#f3f4f6',
                borderRadius: 6,
                marginBottom: 8,
                border: '1px solid #e5e7eb'
              }}>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#000000',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  fontFamily: '"Times New Roman", Times, serif'
                }}>Class Performance</span>
              </div>
              <h2 className="leaderboard-dark-text" style={{
                fontSize: 24,
                fontWeight: 800,
                color: '#000000',
                margin: '0',
                letterSpacing: '-0.3px',
                fontFamily: '"Times New Roman", Times, serif',
                opacity: 1
              }}>
                Class Interaction Leaderboard
              </h2>
            </div>
          </div>
          <button
            onClick={fetchLeaderboardData}
            style={{
              padding: '10px 16px',
              background: '#ffffff',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s ease',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
            }}
            disabled={leaderboardLoading}
            onMouseEnter={(e) => {
              if (!leaderboardLoading) {
                e.currentTarget.style.background = '#f9fafb';
                e.currentTarget.style.borderColor = '#9ca3af';
              }
            }}
            onMouseLeave={(e) => {
              if (!leaderboardLoading) {
                e.currentTarget.style.background = '#ffffff';
                e.currentTarget.style.borderColor = '#d1d5db';
              }
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>

        {leaderboardData.length === 0 ? (
          <div style={styles.announcementEmptyState}>No data available yet. Students need to start using the platform.</div>
        ) : (
          <>
            {/* Top and Bottom Performers - Professional Design */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 20, marginBottom: 24 }}>
              {mostInteractive && (
                <div style={{
                  ...styles.highlightCard,
                  background: '#ffffff'
                }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)';
                  }}
                >
                  <div style={{ marginBottom: 20 }}>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 12px',
                      background: '#f0fdf4',
                      borderRadius: 6,
                      marginBottom: 12
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Top Performer</span>
                    </div>
                    <h3 className="leaderboard-dark-text" style={{
                      fontSize: 20,
                      margin: '0 0 8px 0',
                      fontWeight: 900,
                      color: '#000000',
                      letterSpacing: '-0.3px',
                      fontFamily: '"Times New Roman", Times, serif',
                      opacity: 1
                    }}>Most Interactive Class</h3>
                    <div style={{
                      fontSize: 36,
                      fontWeight: 900,
                      color: '#000000',
                      letterSpacing: '-0.5px',
                      fontFamily: '"Times New Roman", Times, serif'
                    }}>Class {mostInteractive.class}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{
                      ...styles.highlightStat
                    }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#000000', marginBottom: 4, fontFamily: '"Times New Roman", Times, serif' }}>{mostInteractive.score}</div>
                      <div style={{ fontSize: 12, color: '#000000', fontWeight: 500, fontFamily: '"Times New Roman", Times, serif' }}>Interaction Score</div>
                    </div>
                    <div style={{
                      ...styles.highlightStat
                    }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#000000', marginBottom: 4, fontFamily: '"Times New Roman", Times, serif' }}>{mostInteractive.studentCount}</div>
                      <div style={{ fontSize: 12, color: '#000000', fontWeight: 500, fontFamily: '"Times New Roman", Times, serif' }}>Students</div>
                    </div>
                    <div style={{
                      ...styles.highlightStat
                    }}>
                      <div style={{ fontSize: 20, fontWeight: 600, color: '#000000', marginBottom: 4, fontFamily: '"Times New Roman", Times, serif' }}>{mostInteractive.avgQuizzes}</div>
                      <div style={{ fontSize: 12, color: '#000000', fontWeight: 500, fontFamily: '"Times New Roman", Times, serif' }}>Avg Quizzes</div>
                    </div>
                    <div style={{
                      ...styles.highlightStat
                    }}>
                      <div style={{ fontSize: 20, fontWeight: 600, color: '#000000', marginBottom: 4, fontFamily: '"Times New Roman", Times, serif' }}>{mostInteractive.avgSubmissions}</div>
                      <div style={{ fontSize: 12, color: '#000000', fontWeight: 500, fontFamily: '"Times New Roman", Times, serif' }}>Avg Assignments</div>
                    </div>
                  </div>
                </div>
              )}

              {leastInteractive && leaderboardData.length > 1 && (
                <div style={{
                  ...styles.highlightCard,
                  background: '#ffffff'
                }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)';
                  }}
                >
                  <div style={{ marginBottom: 20 }}>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 12px',
                      background: '#fffbeb',
                      borderRadius: 6,
                      marginBottom: 12
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Needs Attention</span>
                    </div>
                    <h3 className="leaderboard-dark-text" style={{
                      fontSize: 20,
                      margin: '0 0 8px 0',
                      fontWeight: 900,
                      color: '#000000',
                      letterSpacing: '-0.3px',
                      fontFamily: '"Times New Roman", Times, serif',
                      opacity: 1
                    }}>Least Interactive Class</h3>
                    <div style={{
                      fontSize: 36,
                      fontWeight: 900,
                      color: '#000000',
                      letterSpacing: '-0.5px',
                      fontFamily: '"Times New Roman", Times, serif'
                    }}>Class {leastInteractive.class}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{
                      ...styles.highlightStat
                    }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#000000', marginBottom: 4, fontFamily: '"Times New Roman", Times, serif' }}>{leastInteractive.score}</div>
                      <div style={{ fontSize: 12, color: '#000000', fontWeight: 500, fontFamily: '"Times New Roman", Times, serif' }}>Interaction Score</div>
                    </div>
                    <div style={{
                      ...styles.highlightStat
                    }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#000000', marginBottom: 4, fontFamily: '"Times New Roman", Times, serif' }}>{leastInteractive.studentCount}</div>
                      <div style={{ fontSize: 12, color: '#000000', fontWeight: 500, fontFamily: '"Times New Roman", Times, serif' }}>Students</div>
                    </div>
                    <div style={{
                      ...styles.highlightStat
                    }}>
                      <div style={{ fontSize: 20, fontWeight: 600, color: '#000000', marginBottom: 4, fontFamily: '"Times New Roman", Times, serif' }}>{leastInteractive.avgQuizzes}</div>
                      <div style={{ fontSize: 12, color: '#000000', fontWeight: 500, fontFamily: '"Times New Roman", Times, serif' }}>Avg Quizzes</div>
                    </div>
                    <div style={{
                      ...styles.highlightStat
                    }}>
                      <div style={{ fontSize: 20, fontWeight: 600, color: '#000000', marginBottom: 4, fontFamily: '"Times New Roman", Times, serif' }}>{leastInteractive.avgSubmissions}</div>
                      <div style={{ fontSize: 12, color: '#000000', fontWeight: 500, fontFamily: '"Times New Roman", Times, serif' }}>Avg Assignments</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Full Leaderboard Table */}
            <div className="leaderboard-white-bg" style={styles.leaderboardTable}>
              <h3 className="leaderboard-dark-text" style={{ fontSize: 20, fontWeight: 800, marginBottom: 20, color: '#000000', letterSpacing: '-0.3px', fontFamily: '"Times New Roman", Times, serif', opacity: 1 }}>Complete Rankings</h3>
              <div className="leaderboard-white-bg" style={styles.leaderboardTableContainer}>
                <table className="leaderboard-table" style={styles.leaderboardTableEl}>
                  <thead>
                    <tr style={styles.tableHeaderRow}>
                      <th style={styles.leaderboardTableHeader}>Rank</th>
                      <th style={styles.leaderboardTableHeader}>Class</th>
                      <th style={styles.leaderboardTableHeader}>Students</th>
                      <th style={styles.leaderboardTableHeader}>Quizzes</th>
                      <th style={styles.leaderboardTableHeader}>Assignments</th>
                      <th style={styles.leaderboardTableHeader}>Activities</th>
                      <th style={styles.leaderboardTableHeader}>Avg Quiz/Student</th>
                      <th style={styles.leaderboardTableHeader}>Avg Assign/Student</th>
                      <th style={styles.leaderboardTableHeader}>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboardData.map((item, index) => (
                      <tr
                        key={item.class}
                        style={{
                          ...styles.leaderboardTableRow,
                          backgroundColor: index === 0 ? '#ecfdf5' : index === 1 ? '#fef3c7' : index === 2 ? '#fee2e2' : index === leaderboardData.length - 1 ? '#fef2f2' : 'white'
                        }}
                        onMouseEnter={(e) => {
                          if (index > 2 && index !== leaderboardData.length - 1) {
                            e.currentTarget.style.backgroundColor = '#f8fafc';
                            e.currentTarget.style.transform = 'scale(1.01)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (index > 2 && index !== leaderboardData.length - 1) {
                            e.currentTarget.style.backgroundColor = 'white';
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = 'none';
                          }
                        }}
                      >
                        <td style={{ ...styles.tableCell, fontSize: 16 }}>
                          {index === 0 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', color: '#fff', fontWeight: 700, fontSize: 18, boxShadow: '0 4px 10px rgba(251, 191, 36, 0.4)' }}>🥇</span>
                          ) : index === 1 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg, #9ca3af, #6b7280)', color: '#fff', fontWeight: 700, fontSize: 18, boxShadow: '0 4px 10px rgba(156, 163, 175, 0.4)' }}>🥈</span>
                          ) : index === 2 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg, #fb923c, #f97316)', color: '#fff', fontWeight: 700, fontSize: 18, boxShadow: '0 4px 10px rgba(251, 146, 60, 0.4)' }}>🥉</span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 8, background: '#f1f5f9', color: '#475569', fontWeight: 700, fontSize: 14 }}>{index + 1}</span>
                          )}
                        </td>
                        <td style={{ ...styles.tableCell, fontWeight: 700, fontSize: 15 }}>Class {item.class}</td>
                        <td style={styles.tableCell}>{item.studentCount}</td>
                        <td style={styles.tableCell}>{item.quizzes}</td>
                        <td style={styles.tableCell}>{item.submissions}</td>
                        <td style={styles.tableCell}>{item.activities}</td>
                        <td style={styles.tableCell}>{item.avgQuizzes}</td>
                        <td style={styles.tableCell}>{item.avgSubmissions}</td>
                        <td style={{ ...styles.tableCell, fontWeight: 700, fontSize: 15 }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '6px 14px',
                            borderRadius: 8,
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            color: '#fff',
                            fontWeight: 700,
                            boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)'
                          }}>
                            {item.score}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{
                marginTop: 24,
                padding: '20px 24px',
                background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                borderRadius: 12,
                fontSize: 14,
                color: '#78350f',
                border: '1px solid #fbbf24',
                boxShadow: '0 4px 12px rgba(251, 191, 36, 0.2)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 20 }}>📊</span>
                  <strong style={{ fontSize: 15, fontWeight: 700 }}>Score Calculation</strong>
                </div>
                <div style={{ marginLeft: 28, lineHeight: 1.7 }}>
                  Interaction Score = (Avg Quizzes × 10) + (Avg Assignments × 15) + (Avg Activities × 0.5)
                  <br />
                  <strong>Note:</strong> Scores are normalized per student for fair comparison between classes of different sizes.
                </div>
              </div>
            </div>

            {/* Weekly Interaction Graph */}
            <div className="leaderboard-white-bg" style={styles.weeklyGraphContainer}>
              <h3 className="leaderboard-dark-text" style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: '#0f172a', letterSpacing: '-0.5px' }}>📈 User Interaction - Past 7 Days</h3>
              <div style={styles.graphDescription}>
                Total activities (quizzes, assignments, notes, videos) across all users
              </div>
              <div style={styles.barChartContainer}>
                {weeklyData.map((day, index) => {
                  const maxCount = Math.max(...weeklyData.map(d => d.count), 1);
                  const heightPercent = (day.count / maxCount) * 100;
                  const isToday = index === weeklyData.length - 1;

                  return (
                    <div
                      key={index}
                      style={styles.barWrapper}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-4px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <div style={styles.barLabel}>{day.count}</div>
                      <div
                        style={{
                          ...styles.bar,
                          height: `${Math.max(heightPercent, 5)}%`,
                          background: isToday
                            ? 'linear-gradient(180deg, #8b5cf6 0%, #6366f1 100%)'
                            : 'linear-gradient(180deg, #10b981 0%, #059669 100%)',
                          opacity: 1
                        }}
                        title={`${day.date}: ${day.count} activities`}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'scaleY(1.05)';
                          e.currentTarget.style.boxShadow = isToday
                            ? '0 8px 20px rgba(139, 92, 246, 0.4), 0 4px 8px rgba(0, 0, 0, 0.15)'
                            : '0 8px 20px rgba(16, 185, 129, 0.4), 0 4px 8px rgba(0, 0, 0, 0.15)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scaleY(1)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)';
                        }}
                      >
                      </div>
                      <div style={styles.barDateLabel}>{day.date}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{
                marginTop: 24,
                padding: '14px 20px',
                textAlign: 'center',
                fontSize: 13,
                fontWeight: 600,
                background: '#f8fafc',
                borderRadius: 10,
                border: '1px solid #e2e8f0'
              }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'inline-block', width: 16, height: 16, background: 'linear-gradient(135deg, #10b981, #059669)', marginRight: 0, borderRadius: 4, boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)' }}></span>
                  <span style={{ color: '#475569' }}>Past Days</span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 24 }}>
                  <span style={{ display: 'inline-block', width: 16, height: 16, background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', marginRight: 0, borderRadius: 4, boxShadow: '0 2px 4px rgba(139, 92, 246, 0.3)' }}></span>
                  <span style={{ color: '#475569' }}>Today</span>
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderActiveView = () => {
    switch (activeView) {
      case 'overview':
        return <ErrorBoundary mini context="Overview Tab">{renderOverview()}</ErrorBoundary>;
      case 'teachers':
        return <ErrorBoundary mini context="Teachers Tab">{renderTeachers()}</ErrorBoundary>;
      case 'students':
        return <ErrorBoundary mini context="Students Tab">{renderStudents()}</ErrorBoundary>;
      case 'parents':
        return <ErrorBoundary mini context="Parents Tab">{renderParents()}</ErrorBoundary>;
      case 'leaderboard':
        return <ErrorBoundary mini context="Leaderboard Tab">{renderLeaderboard()}</ErrorBoundary>;
      case 'announcements':
        return <ErrorBoundary mini context="Announcements Tab">{renderAnnouncements()}</ErrorBoundary>;
      case 'createUser':
        return <ErrorBoundary mini context="Create User Tab">{renderCreateUser()}</ErrorBoundary>;
      case 'faq-manager':
        return <ErrorBoundary mini context="FAQ Manager Tab">{renderFAQManager()}</ErrorBoundary>;
      case 'progress-reports':
        return <ErrorBoundary mini context="Progress Reports Tab">{renderProgressReports()}</ErrorBoundary>;
      case 'bulk-import':
        return <ErrorBoundary mini context="Bulk Import Tab">{renderBulkImport()}</ErrorBoundary>;
      default:
        return <ErrorBoundary mini context="Overview Tab">{renderOverview()}</ErrorBoundary>;
    }
  };

  const renderProgressReports = () => {
    return (
      <div style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <h2 style={{ ...styles.sectionTitle, margin: 0 }}>📊 Student Progress Reports</h2>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <label style={{ color: '#94a3b8', fontSize: '14px', fontWeight: 600 }}>Select Class:</label>
            <select
              value={selectedClass === 'all' ? '6' : selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              style={{
                ...styles.formSelect,
                width: '120px',
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '8px 12px',
                borderRadius: '8px'
              }}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                <option key={num} value={num}>Class {num}</option>
              ))}
            </select>
          </div>
        </div>

        <ProgressReport 
          role="admin" 
          classNumber={selectedClass === 'all' ? '6' : selectedClass} 
          schoolName={userData?.schoolName || ''} 
        />
      </div>
    );
  };

  const renderFAQManager = () => {
    return (
      <div style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ ...styles.sectionTitle, margin: 0 }}>🤖 Chatbot FAQ Manager</h2>
          <button onClick={fetchFaqs} disabled={loadingFaqs} style={{ ...styles.actionButton, backgroundColor: '#6366f1' }}>
            {loadingFaqs ? '🔄 Refreshing...' : '🔄 Refresh Lists'}
          </button>
        </div>

        {/* Add New FAQ Form */}
        <div style={{ ...styles.formSection, marginBottom: '40px', padding: '24px', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <h3 style={{ ...styles.subsectionTitle, color: '#818cf8', marginTop: 0 }}>✨ Add New Knowledge Base Entry</h3>
          <form onSubmit={handleAddFaq}>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Question</label>
              <input
                type="text"
                value={faqFormData.question}
                onChange={(e) => setFaqFormData({ ...faqFormData, question: e.target.value })}
                placeholder="What is the capital of France?"
                style={styles.formInput}
                required
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Answer</label>
              <textarea
                value={faqFormData.answer}
                onChange={(e) => setFaqFormData({ ...faqFormData, answer: e.target.value })}
                placeholder="The capital of France is Paris."
                style={{ ...styles.formInput, minHeight: '100px', resize: 'vertical' }}
                required
              />
            </div>
            <button type="submit" style={{ ...styles.submitButton, width: 'auto', padding: '12px 24px' }} disabled={actionLoading}>
              {actionLoading ? 'Saving...' : '💾 Save to Knowledge Base'}
            </button>
          </form>
        </div>

        {/* Suggested FAQs from Students */}
        <div style={{ marginBottom: '40px' }}>
          <h3 style={{ ...styles.subsectionTitle, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px' }}>
            💡 Suggested from Students
            <span style={{ fontSize: '12px', background: 'rgba(245, 158, 11, 0.2)', padding: '2px 8px', borderRadius: '10px' }}>{suggestedFaqs.length}</span>
          </h3>
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Question</th>
                  <th style={styles.th}>Hits</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {suggestedFaqs.map((s) => (
                  <tr key={s.id}>
                    <td style={styles.td}>{s.question}</td>
                    <td style={styles.td}>
                      <span style={{ color: s.count > 5 ? '#f87171' : '#fbbf24', fontWeight: 'bold' }}>
                        {s.count} asks
                      </span>
                    </td>
                    <td style={styles.td}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleConvertSuggestion(s)} style={{ ...styles.actionButton, backgroundColor: '#10b981', padding: '6px 12px', fontSize: '12px' }}>✅ Add FAQ</button>
                        <button onClick={() => handleDismissSuggestion(s.id)} style={{ ...styles.actionButton, backgroundColor: '#ef4444', padding: '6px 12px', fontSize: '12px' }}>🗑️ Dismiss</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {suggestedFaqs.length === 0 && <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>No pending suggestions.</div>}
          </div>
        </div>

        {/* Existing Knowledge Base */}
        <div>
          <h3 style={{ ...styles.subsectionTitle, color: '#10b981' }}>📚 Current Knowledge Base</h3>
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Question</th>
                  <th style={styles.th}>Answer (Preview)</th>
                  <th style={styles.th}>Hits</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {faqs.map((f) => (
                  <tr key={f.id}>
                    <td style={{ ...styles.td, fontWeight: 'bold' }}>{f.question}</td>
                    <td style={styles.td}>{f.answer?.substring(0, 50)}...</td>
                    <td style={styles.td}>{f.usageCount || 0} hits</td>
                    <td style={styles.td}>
                      <button onClick={() => handleDeleteFaq(f.id)} style={{ ...styles.actionButton, backgroundColor: '#ef4444', padding: '6px 12px', fontSize: '12px' }}>🗑️ Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {faqs.length === 0 && <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>Knowledge base is empty.</div>}
          </div>
        </div>
      </div>
    );
  };

  const renderDetailsModal = () => {
    if (!showDetailsModal || !selectedUser) return null;

    return (
      <div style={styles.modalOverlay} onClick={() => setShowDetailsModal(false)}>
        <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
          <div style={styles.modalHeader}>
            <h2 style={styles.modalTitle}>
              {userType === 'teacher' && '👨‍🏫 Teacher Details'}
              {userType === 'student' && '👨‍🎓 Student Details'}
              {userType === 'parent' && '👪 Parent Details'}
            </h2>
            <button onClick={() => setShowDetailsModal(false)} style={styles.closeButton}>✕</button>
          </div>

          {selectedUser.suspended && (
            <div style={styles.suspendedBanner}>
              <span style={styles.suspendedIcon}>⚠️</span>
              <div style={styles.suspendedText}>
                <strong>Account Suspended</strong>
                <p>Suspended by {selectedUser.suspendedBy || 'Admin'} on {selectedUser.suspendedAt?.toDate?.().toLocaleDateString() || 'N/A'}</p>
              </div>
            </div>
          )}

          <div style={styles.modalBody}>
            {/* Profile Photo Section for Students */}
            {userType === 'student' && (
              <div style={styles.detailSection}>
                <h3 style={styles.detailSectionTitle}>📷 Profile Photo</h3>
                <AdminPhotoUpload
                  userId={selectedUser.uid || selectedUser.id}
                  currentPhotoUrl={selectedUser.photoUrl}
                  username={selectedUser.username}
                  onPhotoUpdated={(url) => setSelectedUser(prev => ({ ...prev, photoUrl: url }))}
                />
              </div>
            )}

            {/* Profile Photo Section for Teachers */}
            {userType === 'teacher' && (
              <div style={styles.detailSection}>
                <h3 style={styles.detailSectionTitle}>📷 Profile Photo</h3>
                <AdminPhotoUpload
                  userId={selectedUser.uid || selectedUser.id}
                  currentPhotoUrl={selectedUser.photoUrl}
                  username={selectedUser.username}
                  onPhotoUpdated={(url) => setSelectedUser(prev => ({ ...prev, photoUrl: url }))}
                />
              </div>
            )}

            <div style={styles.detailSection}>
              <h3 style={styles.detailSectionTitle}>📋 Basic Information</h3>
              <div style={styles.detailGrid}>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Name:</span>
                  <span style={styles.detailValue}>{selectedUser.username || 'N/A'}</span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Email:</span>
                  <span style={styles.detailValue}>{selectedUser.email || 'N/A'}</span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Joined Date:</span>
                  <span style={styles.detailValue}>
                    {selectedUser.createdAt?.toDate ? selectedUser.createdAt.toDate().toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                {userType === 'student' && (
                  <div style={styles.detailItem}>
                    <span style={styles.detailLabel}>Class:</span>
                    <span style={styles.detailValue}>Class {selectedUser.class || 'N/A'}</span>
                  </div>
                )}
                {userType === 'teacher' && (
                  <>
                    <div style={styles.detailItem}>
                      <span style={styles.detailLabel}>Subject Teaching:</span>
                      <span style={styles.detailValue}>{selectedUser.subject || 'N/A'}</span>
                    </div>
                    <div style={styles.detailItem}>
                      <span style={styles.detailLabel}>Classes Teaching:</span>
                      <span style={styles.detailValue}>
                        {selectedUser.classes && selectedUser.classes.length > 0
                          ? selectedUser.classes.map(c => `Class ${c}`).join(', ')
                          : 'Not assigned'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {userType === 'student' && (
              <>
                <div style={styles.detailSection}>
                  <h3 style={styles.detailSectionTitle}>📊 Academic Performance</h3>

                  {performanceLoading ? (
                    <div style={styles.detailNote}>
                      <div style={styles.spinner}></div>
                      <span>Loading performance data...</span>
                    </div>
                  ) : studentPerformance?.error ? (
                    <p style={styles.detailNote}>{studentPerformance.error}</p>
                  ) : studentPerformance ? (
                    <div style={styles.performanceGrid}>
                      <div style={styles.performanceCard}>
                        <div style={styles.performanceIcon}>📝</div>
                        <div style={styles.performanceData}>
                          <div style={styles.performanceValue}>{studentPerformance.totalQuizzes}</div>
                          <div style={styles.performanceLabel}>Total Quizzes</div>
                        </div>
                      </div>

                      <div style={styles.performanceCard}>
                        <div style={styles.performanceIcon}>🎯</div>
                        <div style={styles.performanceData}>
                          <div style={styles.performanceValue}>{studentPerformance.averageQuizScore}%</div>
                          <div style={styles.performanceLabel}>Avg Quiz Score</div>
                        </div>
                      </div>

                      <div style={styles.performanceCard}>
                        <div style={styles.performanceIcon}>📚</div>
                        <div style={styles.performanceData}>
                          <div style={styles.performanceValue}>
                            {studentPerformance.completedAssignments}/{studentPerformance.totalAssignments}
                          </div>
                          <div style={styles.performanceLabel}>Assignments Done</div>
                        </div>
                      </div>

                      <div style={styles.performanceCard}>
                        <div style={styles.performanceIcon}>✅</div>
                        <div style={styles.performanceData}>
                          <div style={styles.performanceValue}>{studentPerformance.assignmentCompletionRate}%</div>
                          <div style={styles.performanceLabel}>Completion Rate</div>
                        </div>
                      </div>

                      {studentPerformance.gradedAssignments > 0 && (
                        <div style={styles.performanceCard}>
                          <div style={styles.performanceIcon}>⭐</div>
                          <div style={styles.performanceData}>
                            <div style={styles.performanceValue}>{studentPerformance.averageAssignmentGrade}%</div>
                            <div style={styles.performanceLabel}>Avg Assignment Grade</div>
                          </div>
                        </div>
                      )}

                      {studentPerformance.malpracticeCount > 0 && (
                        <div style={{ ...styles.performanceCard, borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                          <div style={styles.performanceIcon}>⚠️</div>
                          <div style={styles.performanceData}>
                            <div style={{ ...styles.performanceValue, color: '#dc2626' }}>
                              {studentPerformance.malpracticeCount}
                            </div>
                            <div style={styles.performanceLabel}>Malpractice Cases</div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p style={styles.detailNote}>
                      No performance data available yet.
                    </p>
                  )}
                </div>

                <div style={styles.detailSection}>
                  <h3 style={styles.detailSectionTitle}>👨‍👩‍👧 Parent Information</h3>
                  <div style={styles.detailGrid}>
                    <div style={styles.detailItem}>
                      <span style={styles.detailLabel}>Parent Name:</span>
                      <span style={styles.detailValue}>{selectedUser.parentName || 'N/A'}</span>
                    </div>
                    <div style={styles.detailItem}>
                      <span style={styles.detailLabel}>Parent Email:</span>
                      <span style={styles.detailValue}>{selectedUser.parentEmail || 'N/A'}</span>
                    </div>
                    {/* Parent ID removed as per request */}
                  </div>
                  {!selectedUser.parentName && !selectedUser.parentEmail && (
                    <p style={styles.detailNote}>
                      No parent information available for this student.
                    </p>
                  )}
                </div>
              </>
            )}

            {userType === 'parent' && (
              <div style={styles.detailSection}>
                <h3 style={styles.detailSectionTitle}>👶 Linked Children</h3>
                {selectedUser.children && selectedUser.children.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {selectedUser.children.map((child, index) => (
                      <div key={index} style={{
                        padding: '16px',
                        backgroundColor: 'rgba(30, 58, 95, 0.6)',
                        borderRadius: '8px',
                        border: '1px solid rgba(59, 130, 246, 0.3)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: '16px', fontWeight: '600', color: '#ffffff' }}>
                              {child.name || 'N/A'}
                            </div>
                            {child.email && (
                              <div style={{ fontSize: '13px', color: 'rgba(148, 163, 184, 1)', marginTop: '4px' }}>
                                {child.email}
                              </div>
                            )}
                          </div>
                          <span style={{
                            ...styles.badge,
                            backgroundColor: 'rgba(59, 130, 246, 0.3)',
                            color: '#ffffff'
                          }}>
                            Class {child.class || 'N/A'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={styles.detailNote}>
                    No linked children found.
                  </p>
                )}
              </div>
            )}

            <div style={styles.detailSection}>
              <h3 style={styles.detailSectionTitle}>⚙️ Account Actions</h3>
              <div style={styles.actionButtonsGrid}>
                <button
                  onClick={handleSendMessage}
                  disabled={actionLoading}
                  style={{ ...styles.actionBtn, background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}
                >
                  ✉️ Send Message
                </button>
                <button
                  onClick={handleEditProfile}
                  disabled={actionLoading}
                  style={{ ...styles.actionBtn, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                >
                  ✏️ Edit Profile
                </button>
                <button
                  onClick={handleResetPassword}
                  disabled={actionLoading}
                  style={{ ...styles.actionBtn, background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
                >
                  Reset Password
                </button>
                {selectedUser.suspended ? (
                  <button
                    onClick={handleUnsuspendAccount}
                    disabled={actionLoading}
                    style={{ ...styles.actionBtn, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                  >
                    ✅ Unsuspend Account
                  </button>
                ) : (
                  <button
                    onClick={handleSuspendAccount}
                    disabled={actionLoading}
                    style={{ ...styles.actionBtn, background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}
                  >
                    🚫 Suspend Account
                  </button>
                )}
                <button
                  onClick={handleDeleteAccount}
                  disabled={actionLoading}
                  style={{ ...styles.actionBtn, background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)', gridColumn: 'span 2' }}
                >
                  🗑️ Delete Account
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPrivacy = () => (
    <PrivacyPolicy />
  );

  const renderMessageModal = () => {
    if (!showMessageModal) return null;

    return (
      <div style={styles.modalOverlay} onClick={() => setShowMessageModal(false)}>
        <div style={{ ...styles.modalContent, maxWidth: '700px' }} onClick={(e) => e.stopPropagation()}>
          <div style={styles.modalHeader}>
            <h2 style={styles.modalTitle}>✉️ Send Message to {selectedUser?.username}</h2>
            <button onClick={() => setShowMessageModal(false)} style={styles.closeButton}>✕</button>
          </div>

          {/* Toggle between new message and past messages */}
          <div style={{ display: 'flex', gap: '10px', padding: '10px 20px', borderBottom: '1px solid #e5e7eb' }}>
            <button
              onClick={() => setShowPastMessages(false)}
              style={{
                padding: '8px 16px',
                backgroundColor: !showPastMessages ? '#4F46E5' : '#f3f4f6',
                color: !showPastMessages ? 'white' : '#374151',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              📝 New Message
            </button>
            <button
              onClick={() => setShowPastMessages(true)}
              style={{
                padding: '8px 16px',
                backgroundColor: showPastMessages ? '#4F46E5' : '#f3f4f6',
                color: showPastMessages ? 'white' : '#374151',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              📬 Past Messages ({pastMessages.length})
            </button>
          </div>

          {!showPastMessages ? (
            <form onSubmit={handleSubmitMessage} style={styles.modalBody}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>To:</label>
                <input
                  type="text"
                  value={selectedUser?.email || ''}
                  disabled
                  style={{ ...styles.formInput, backgroundColor: '#f3f4f6', cursor: 'not-allowed' }}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Message *</label>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type your message here..."
                  style={styles.formTextarea}
                  required
                  rows={8}
                  maxLength={1000}
                />
                <div style={styles.charCount}>
                  {messageText.length}/1000 characters
                </div>
              </div>

              <button
                type="submit"
                style={styles.submitButton}
                disabled={actionLoading}
              >
                {actionLoading ? '📤 Sending...' : '📧 Send Message'}
              </button>
            </form>
          ) : (
            <div style={{ padding: '20px', maxHeight: '500px', overflowY: 'auto' }}>
              {messagesLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                  <div>Loading messages...</div>
                </div>
              ) : pastMessages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                  <div style={{ fontSize: '48px', marginBottom: '10px' }}>📭</div>
                  <div>No messages sent yet</div>
                </div>
              ) : (
                pastMessages.map(msg => (
                  <div
                    key={msg.id}
                    style={{
                      padding: '15px',
                      marginBottom: '15px',
                      backgroundColor: msg.read ? '#f9fafb' : '#eff6ff',
                      borderRadius: '8px',
                      border: `1px solid ${msg.read ? '#e5e7eb' : '#3b82f6'}`,
                      position: 'relative'
                    }}
                  >
                    {/* Read/Unread indicator */}
                    <div style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '12px',
                      fontWeight: '500',
                      color: msg.read ? '#10b981' : '#3b82f6'
                    }}>
                      {msg.read ? (
                        <>
                          <span>✓✓</span>
                          <span>Read</span>
                        </>
                      ) : (
                        <>
                          <span>✓</span>
                          <span>Sent</span>
                        </>
                      )}
                    </div>

                    <div style={{ marginBottom: '8px', fontSize: '13px', color: '#6b7280' }}>
                      <strong>From:</strong> {msg.fromName} ({msg.from})
                    </div>

                    <div style={{
                      padding: '12px',
                      backgroundColor: 'white',
                      borderRadius: '6px',
                      marginBottom: '8px',
                      whiteSpace: 'pre-wrap',
                      fontSize: '14px',
                      lineHeight: '1.6'
                    }}>
                      {msg.message}
                    </div>

                    <div style={{
                      fontSize: '12px',
                      color: '#9ca3af',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span>
                        Sent: {msg.timestamp?.toDate?.().toLocaleString() || 'Unknown'}
                      </span>
                      {msg.read && msg.readAt && (
                        <span>
                          Read: {msg.readAt?.toDate?.().toLocaleString()}
                        </span>
                      )}
                    </div>

                    {!msg.read && (
                      <button
                        onClick={() => markMessageAsRead(msg.id)}
                        style={{
                          marginTop: '10px',
                          padding: '6px 12px',
                          backgroundColor: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Mark as Read
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderEditModal = () => {
    if (!showEditModal) return null;

    return (
      <div style={styles.modalOverlay} onClick={() => setShowEditModal(false)}>
        <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
          <div style={styles.modalHeader}>
            <h2 style={styles.modalTitle}>✏️ Edit Profile - {selectedUser?.username}</h2>
            <button onClick={() => setShowEditModal(false)} style={styles.closeButton}>✕</button>
          </div>

          <form onSubmit={handleSubmitEdit} style={styles.modalBody}>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Full Name *</label>
              <input
                type="text"
                value={editFormData.username}
                onChange={(e) => setEditFormData({ ...editFormData, username: e.target.value })}
                style={styles.formInput}
                required
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Email</label>
              <input
                type="email"
                value={editFormData.email}
                disabled
                style={{ ...styles.formInput, backgroundColor: '#f3f4f6', cursor: 'not-allowed' }}
              />
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                Email cannot be changed
              </div>
            </div>

            {userType === 'student' && (
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Class *</label>
                <select
                  value={editFormData.class}
                  onChange={(e) => setEditFormData({ ...editFormData, class: e.target.value })}
                  style={styles.formSelect}
                  required
                >
                  <option value="">Select Class</option>
                  <option value="6">Class 6</option>
                  <option value="7">Class 7</option>
                  <option value="8">Class 8</option>
                  <option value="9">Class 9</option>
                  <option value="10">Class 10</option>
                </select>
              </div>
            )}

            {userType === 'teacher' && (
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Subject</label>
                <select
                  value={editFormData.subject}
                  onChange={(e) => setEditFormData({ ...editFormData, subject: e.target.value })}
                  style={styles.formSelect}
                >
                  <option value="">Select Subject</option>
                  <option value="Physics">Physics</option>
                  <option value="Chemistry">Chemistry</option>
                  <option value="Biology">Biology</option>
                  <option value="Mathematics">Mathematics</option>
                  <option value="Computer Studies">Computer Studies</option>
                  <option value="Geography">Geography</option>
                  <option value="History & Civics">History & Civics</option>
                </select>
              </div>
            )}

            <button
              type="submit"
              style={styles.submitButton}
              disabled={actionLoading}
            >
              {actionLoading ? '💾 Saving...' : '💾 Save Changes'}
            </button>
          </form>
        </div>
      </div>
    );
  };

  const renderLessonPlansModal = () => {
    if (!showLessonPlansModal || !selectedUser) return null;

    return (
      <div style={styles.modalOverlay} onClick={() => setShowLessonPlansModal(false)}>
        <div style={{ ...styles.modalContent, maxWidth: '900px' }} onClick={(e) => e.stopPropagation()}>
          <div style={styles.modalHeader}>
            <h2 style={styles.modalTitle}>📅 Lesson Plans - {selectedUser.username}</h2>
            <button onClick={() => setShowLessonPlansModal(false)} style={styles.closeButton}>✕</button>
          </div>

          <div style={styles.modalBody}>
            {lessonsLoading ? (
              <div style={styles.detailNote}>
                <div style={styles.spinner}></div>
                <span>Loading lesson plans...</span>
              </div>
            ) : teacherLessons.length === 0 ? (
              <p style={styles.detailNote}>
                No lesson plans uploaded yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {teacherLessons.map((lesson) => (
                  <div key={lesson.id} style={styles.lessonCard}>
                    <div style={styles.lessonHeader}>
                      <div style={styles.lessonTitle}>
                        {lesson.chapterName || 'Lesson Plan'}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {lesson.lessonType && (
                          <span style={{
                            ...styles.badge,
                            backgroundColor: lesson.lessonType === 'monthly' ? '#dbeafe' : '#fef3c7',
                            color: lesson.lessonType === 'monthly' ? '#1e40af' : '#92400e'
                          }}>
                            {lesson.lessonType === 'monthly' ? '📅 Monthly' : '📆 Weekly'}
                          </span>
                        )}
                        {lesson.subject && (
                          <span style={{ ...styles.badge, backgroundColor: '#dbeafe', color: '#1e40af' }}>
                            {lesson.subject}
                          </span>
                        )}
                        {lesson.class && (
                          <span style={{ ...styles.badge, backgroundColor: '#fce7f3', color: '#9f1239' }}>
                            Class {lesson.class}
                          </span>
                        )}
                        <span style={{
                          ...styles.badge,
                          backgroundColor: lesson.status === 'Accepted' ? '#d1fae5' : lesson.status === 'Needs Improvement' ? '#fee2e2' : '#fef3c7',
                          color: lesson.status === 'Accepted' ? '#065f46' : lesson.status === 'Needs Improvement' ? '#991b1b' : '#92400e',
                          fontWeight: 600
                        }}>
                          {lesson.status === 'Accepted' ? '✅ Accepted' : lesson.status === 'Needs Improvement' ? '🔄 Improvement in Progress' : '⏳ Under Review'}
                        </span>
                      </div>
                    </div>
                    <div style={styles.lessonContent}>
                      {lesson.notes}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                      {lesson.createdAt && (
                        <div style={styles.lessonFooter}>
                          Created: {lesson.createdAt?.toDate?.().toLocaleDateString() || 'N/A'}
                        </div>
                      )}
                      {(!lesson.status || lesson.status === 'Under Review') ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleUpdateLessonStatus(lesson.id, 'Accepted')}
                            style={{
                              padding: '8px 16px',
                              backgroundColor: '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontWeight: 600,
                              fontSize: '14px'
                            }}
                          >
                            ✅ Accept
                          </button>
                          <button
                            onClick={() => handleUpdateLessonStatus(lesson.id, 'Needs Improvement')}
                            style={{
                              padding: '8px 16px',
                              backgroundColor: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontWeight: 600,
                              fontSize: '14px'
                            }}
                          >
                            ⚠️ Needs Improvement
                          </button>
                        </div>
                      ) : (
                        <div style={{
                          padding: '8px 16px',
                          backgroundColor: lesson.status === 'Accepted' ? '#d1fae5' : '#fee2e2',
                          color: lesson.status === 'Accepted' ? '#065f46' : '#991b1b',
                          borderRadius: '6px',
                          fontWeight: 600,
                          fontSize: '14px'
                        }}>
                          {lesson.status === 'Accepted' ? '✅ Accepted' : '🔄 Improvement in Progress'}
                          {lesson.reviewedAt && ` - ${lesson.reviewedAt?.toDate?.().toLocaleDateString()}`}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderFeedbackModal = () => {
    if (!showFeedbackModal) return null;

    return (
      <div style={styles.modalOverlay} onClick={() => setShowFeedbackModal(false)}>
        <div style={{ ...styles.modalContent, maxWidth: '800px', maxHeight: '80vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
          <div style={styles.modalHeader}>
            <h2 style={styles.modalTitle}>👁️ All Feedback ({allFeedbacks.length})</h2>
            <button onClick={() => setShowFeedbackModal(false)} style={styles.closeButton}>✕</button>
          </div>
          <div style={{ ...styles.modalBody, maxHeight: 'calc(80vh - 80px)', overflowY: 'auto', padding: '10px 20px' }}>
            {loadingFeedbacks ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                <div style={styles.spinner}></div>
                <span>Loading feedbacks...</span>
              </div>
            ) : allFeedbacks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                No feedback submitted yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {allFeedbacks.map((fb) => (
                  <div key={fb.id} style={styles.feedbackCard}>
                    <div style={styles.feedbackCardHeader}>
                      <div>
                        <div style={styles.feedbackUserName}>
                          {fb.userName || 'Anonymous'}
                          <span style={styles.feedbackUserRole}>
                            {fb.userRole === 'teacher' ? '👨‍🏫 Teacher' :
                              fb.userRole === 'student' ? '🎓 Student' :
                                fb.userRole === 'parent' ? '👨‍👩‍👧 Parent' : '👤 User'}
                          </span>
                        </div>
                        {fb.userClass && (
                          <div style={styles.feedbackUserClass}>Class {fb.userClass}</div>
                        )}
                        {fb.childName && (
                          <div style={styles.feedbackUserClass}>Child: {fb.childName}</div>
                        )}
                      </div>
                      <div style={styles.feedbackTimestamp}>
                        {fb.timestamp?.toDate?.().toLocaleString() || 'Unknown'}
                      </div>
                    </div>
                    <div style={styles.feedbackText}>{fb.feedback}</div>
                    {fb.email && (
                      <div style={styles.feedbackEmail}>📧 {fb.email}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Handle View Video Activity - fetch ALL video activity logs from Firestore
  const handleViewVideoActivity = async () => {
    setShowVideoActivity(true);
    setLoadingVideoActivity(true);
    try {
      const videoLogsQuery = query(
        collection(db, 'videoActivityLogs'),
        limit(100)
      );
      const snapshot = await getDocs(videoLogsQuery);
      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort by timestamp descending (most recent first)
      logs.sort((a, b) => {
        const dateA = a.timestamp?.toDate?.() || new Date(0);
        const dateB = b.timestamp?.toDate?.() || new Date(0);
        return dateB - dateA;
      });
      setVideoActivityLogs(logs);
    } catch (error) {
      console.error('Error fetching video activity logs:', error);
    } finally {
      setLoadingVideoActivity(false);
    }
  };


  // Mark video activity log as read (update in-place instead of hiding)
  const markVideoLogAsRead = async (logId) => {
    try {
      await updateDoc(doc(db, 'videoActivityLogs', logId), { read: true });
      // Update the log in the list instead of removing it
      setVideoActivityLogs(prev => prev.map(log =>
        log.id === logId ? { ...log, read: true } : log
      ));
    } catch (error) {
      console.error('Error marking log as read:', error);
    }
  };

  // Render Video Activity Modal
  const renderVideoActivityModal = () => {
    if (!showVideoActivity) return null;

    return (
      <div style={styles.modalOverlay} onClick={() => setShowVideoActivity(false)}>
        <div style={{ ...styles.modalContent, maxWidth: '900px', maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
          <div style={styles.modalHeader}>
            <h2 style={styles.modalTitle}>
              📺 Video Activity Logs
              <span style={{ fontSize: '14px', fontWeight: 'normal', marginLeft: '10px' }}>
                ({videoActivityLogs.length} total, {videoActivityLogs.filter(l => !l.read).length} unread)
              </span>
            </h2>
            <button onClick={() => setShowVideoActivity(false)} style={styles.closeButton}>✕</button>
          </div>
          <div style={{ ...styles.modalBody, maxHeight: 'calc(85vh - 80px)', overflowY: 'auto', padding: '16px 24px' }}>
            {loadingVideoActivity ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                <div style={styles.spinner}></div>
                <span>Loading video activity logs...</span>
              </div>
            ) : videoActivityLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>📺</p>
                <p style={{ fontSize: '16px', fontWeight: 600 }}>No video activity recorded</p>
                <p style={{ fontSize: '14px', marginTop: 8, color: '#999' }}>When students watch videos, their activity history will appear here</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {videoActivityLogs.map((log) => (
                  <div key={log.id} style={{
                    padding: '16px',
                    background: log.eventType === 'video_switch'
                      ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(249, 115, 22, 0.12))'
                      : log.eventType === 'tab_switch'
                        ? 'linear-gradient(135deg, rgba(249, 115, 22, 0.12), rgba(251, 146, 60, 0.12))'
                        : 'linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(236, 72, 153, 0.08))',
                    borderRadius: '12px',
                    border: log.eventType === 'video_switch'
                      ? '2px solid rgba(239, 68, 68, 0.4)'
                      : log.eventType === 'tab_switch'
                        ? '2px solid rgba(249, 115, 22, 0.4)'
                        : '1px solid rgba(139, 92, 246, 0.2)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    opacity: log.read ? 0.6 : 1,
                    transition: 'opacity 0.3s ease'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '15px', color: '#1e293b' }}>
                          👨‍🎓 {log.studentName}
                          <span style={{
                            marginLeft: '10px',
                            background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                            color: 'white',
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: '6px'
                          }}>
                            Class {log.classNumber}
                          </span>
                          {log.eventType === 'video_switch' && (
                            <span style={{
                              marginLeft: '8px',
                              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                              color: 'white',
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '3px 10px',
                              borderRadius: '6px',
                              animation: 'pulse 2s infinite'
                            }}>
                              ⚠️ VIDEO SWITCH DETECTED
                            </span>
                          )}
                          {log.eventType === 'tab_switch' && (
                            <span style={{
                              marginLeft: '8px',
                              background: 'linear-gradient(135deg, #f97316, #ea580c)',
                              color: 'white',
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '3px 10px',
                              borderRadius: '6px',
                            }}>
                              🚪 LEFT VIDEO TAB
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                          📚 {log.subject} - {log.chapter}
                        </div>
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'right' }}>
                        🕐 {log.timestamp?.toDate?.()?.toLocaleString() || 'Recently'}
                      </div>
                    </div>

                    {/* Show tab switch warning if this is a tab_switch event */}
                    {log.eventType === 'tab_switch' && (
                      <div style={{
                        padding: '12px',
                        background: 'rgba(249, 115, 22, 0.15)',
                        borderRadius: '8px',
                        fontSize: '13px',
                        color: '#c2410c',
                        border: '1px solid rgba(249, 115, 22, 0.4)'
                      }}>
                        <div style={{ fontWeight: 700, marginBottom: '8px', fontSize: '14px' }}>
                          🚨 SUSPICIOUS ACTIVITY DETECTED
                        </div>
                        <div>
                          <strong>⏱️ Duration:</strong> Left video tab for <strong>{log.duration ? Math.round(log.duration) : 'several'} seconds</strong>
                        </div>
                        <div style={{ marginTop: '6px', fontSize: '12px', color: '#9a3412' }}>
                          ⚠️ Student may have been watching other content in a different browser tab/window.
                          We cannot track external tab content due to browser security restrictions.
                        </div>
                      </div>
                    )}

                    {/* Show original video if this is a switch event */}
                    {log.eventType === 'video_switch' && log.originalVideoUrl && (
                      <div style={{
                        padding: '10px 12px',
                        background: 'rgba(34, 197, 94, 0.1)',
                        borderRadius: '8px',
                        fontSize: '13px',
                        color: '#166534',
                        border: '1px solid rgba(34, 197, 94, 0.3)'
                      }}>
                        <strong>✅ Original Assigned Video:</strong>{' '}
                        <a
                          href={log.originalVideoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#15803d', wordBreak: 'break-all' }}
                        >
                          {log.originalVideoUrl}
                        </a>
                      </div>
                    )}

                    <div style={{
                      padding: '10px 12px',
                      background: log.eventType === 'video_switch'
                        ? 'rgba(239, 68, 68, 0.1)'
                        : log.eventType === 'tab_switch'
                          ? 'rgba(34, 197, 94, 0.1)'
                          : 'rgba(255, 255, 255, 0.7)',
                      borderRadius: '8px',
                      fontSize: '13px',
                      color: log.eventType === 'video_switch' ? '#991b1b' : log.eventType === 'tab_switch' ? '#166534' : '#334155',
                      border: log.eventType === 'video_switch' ? '1px solid rgba(239, 68, 68, 0.3)' : log.eventType === 'tab_switch' ? '1px solid rgba(34, 197, 94, 0.3)' : 'none'
                    }}>
                      <strong>{log.eventType === 'video_switch' ? '⚠️ Switched To Video:' : log.eventType === 'tab_switch' ? '📺 Assigned Video (was supposed to watch):' : 'Video URL:'}</strong>{' '}
                      <a
                        href={log.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: log.eventType === 'video_switch' ? '#dc2626' : log.eventType === 'tab_switch' ? '#15803d' : '#8b5cf6', wordBreak: 'break-all' }}
                      >
                        {log.videoUrl}
                      </a>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {log.read && (
                        <span style={{
                          fontSize: '12px',
                          color: '#6b7280',
                          fontStyle: 'italic',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          ✓ Reviewed
                        </span>
                      )}
                      {!log.read && <span></span>}
                      <button
                        onClick={() => markVideoLogAsRead(log.id)}
                        disabled={log.read}
                        style={{
                          padding: '8px 16px',
                          background: log.read
                            ? '#9ca3af'
                            : 'linear-gradient(135deg, #10b981, #059669)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: log.read ? 'default' : 'pointer',
                          transition: 'all 0.3s ease',
                          opacity: log.read ? 0.6 : 1
                        }}
                      >
                        {log.read ? '✓ Already Read' : '✓ Mark as Read'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <VideoBackground />
      <div style={styles.container} className="dashboard-bg">
        <AnimatePresence>
          {showDetailsModal && renderDetailsModal()}
          {showMessageModal && renderMessageModal()}
          {showEditModal && renderEditModal()}
          {showLessonPlansModal && renderLessonPlansModal()}
          {showFeedbackModal && renderFeedbackModal()}
          {showVideoActivity && renderVideoActivityModal()}
        </AnimatePresence>

        {showPrivacyPolicy && (
          <PrivacyPolicy
            viewOnly={true}
            onAccept={() => setShowPrivacyPolicy(false)}
          />
        )}
        {showAccountSettings && (
          <AccountSettings onClose={() => setShowAccountSettings(false)} />
        )}



        {/* Header */}
        <header style={styles.header} className="admin-header">
          <div style={styles.headerLeft} className="admin-header-left">
            <motion.div
              whileHover={{ scale: 1.02 }}
              onClick={() => setActiveView('overview')}
              style={styles.logoSection}
              className="admin-logo-section"
            >
              <AnimatedLogo variant="header" size={40} withWordmark={false} />
              <div className="admin-title-section">
                <h1 style={themedStyles.goldenText}>Principal Hub</h1>
                <p style={styles.subtitle} className="admin-subtitle">Trinity Central School</p>
              </div>
            </motion.div>
          </div>

          <div style={styles.headerCenter}>
            <div style={styles.schoolDisplay}>
              <span style={styles.schoolLabel}>Current Session</span>
              <span style={styles.schoolValue}>{currentSession}</span>
            </div>
          </div>

          <div style={styles.settingsContainer}>
            <motion.button
              whileHover={{ scale: 1.1, rotate: 15 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowSettings(!showSettings)}
              style={styles.settingsBtn}
              className="settings-icon-btn"
              aria-label="Open principal console menu"
              aria-expanded={showSettings}
              aria-haspopup="menu"
            >
              <PlusIcon size={20} />
              <span>Menu</span>
            </motion.button>

            <AnimatePresence>
              {showSettings && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ position: 'fixed', inset: 0, zIndex: 999 }}
                    onClick={() => setShowSettings(false)}
                  />
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      // The old drawer inherited a purple gradient + heavy
                      // shadow from `styles.settingsBtn`, which leaked
                      // through every child button as a blue-purple wash.
                      // This block deliberately does NOT spread that base
                      // style — every surface here is defined locally
                      // (SS object below) so the drawer is its own
                      // self-contained dark-glass component.
                      style={{
                        ...SS.drawer,
                        zIndex: 1000,
                        ...(isMobile
                          ? {
                              position: 'fixed',
                              top: 70,
                              right: 16,
                              width: 'calc(100% - 32px)',
                              minWidth: 'unset',
                              maxWidth: 360,
                            }
                          : {}),
                      }}
                    >
                      {/* Profile Identity */}
                      <div style={SS.hero}>
                        <div style={SS.avatarRing}>
                          <ProfilePhoto size={64} editable={true} />
                        </div>
                        <div style={SS.heroName}>
                          {userData?.username || 'Admin User'}
                        </div>
                        <div style={SS.heroBadge}>
                          <span style={SS.heroBadgeDot} />
                          Principal Console
                        </div>
                      </div>

                      {/* Management Tools */}
                      <div style={SS.group}>
                        <div style={SS.groupLabel}>Management Tools</div>
                        <button
                          onClick={() => {
                            setShowSettings(false);
                            handleViewFeedback();
                          }}
                          style={SS.row}
                          onMouseEnter={(e) => Object.assign(e.currentTarget.style, SS.rowHover)}
                          onMouseLeave={(e) => Object.assign(e.currentTarget.style, SS.row)}
                        >
                          <span
                            style={{
                              ...SS.rowIcon,
                              background: 'rgba(16,185,129,0.12)',
                              color: '#10b981',
                              borderColor: 'rgba(16,185,129,0.25)',
                            }}
                          >
                            📊
                          </span>
                          <span style={SS.rowMain}>
                            <span style={SS.rowLabel}>Surveys</span>
                            <span style={SS.rowSub}>Feedback &amp; insights</span>
                          </span>
                          <span style={SS.rowChev}>›</span>
                        </button>
                      </div>

                      {/* Account & Security */}
                      <div style={SS.group}>
                        <div style={SS.groupLabel}>Account &amp; Security</div>
                        <button
                          onClick={() => {
                            setShowSettings(false);
                            setShowAccountSettings(true);
                          }}
                          style={SS.row}
                          onMouseEnter={(e) => Object.assign(e.currentTarget.style, SS.rowHover)}
                          onMouseLeave={(e) => Object.assign(e.currentTarget.style, SS.row)}
                        >
                          <span
                            style={{
                              ...SS.rowIcon,
                              color: '#60a5fa',
                              background: 'rgba(96,165,250,0.10)',
                              borderColor: 'rgba(96,165,250,0.22)',
                            }}
                          >
                            📱
                          </span>
                          <span style={SS.rowMain}>
                            <span style={SS.rowLabel}>Account Security</span>
                            <span style={SS.rowSub}>Phone, password &amp; sessions</span>
                          </span>
                          <span style={SS.rowChev}>›</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowSettings(false);
                            setShowPrivacyPolicy(true);
                          }}
                          style={SS.row}
                          onMouseEnter={(e) => Object.assign(e.currentTarget.style, SS.rowHover)}
                          onMouseLeave={(e) => Object.assign(e.currentTarget.style, SS.row)}
                        >
                          <span
                            style={{
                              ...SS.rowIcon,
                              color: '#a78bfa',
                              background: 'rgba(167,139,250,0.10)',
                              borderColor: 'rgba(167,139,250,0.22)',
                            }}
                          >
                            🛡️
                          </span>
                          <span style={SS.rowMain}>
                            <span style={SS.rowLabel}>Privacy Policy</span>
                            <span style={SS.rowSub}>How we handle your data</span>
                          </span>
                          <span style={SS.rowChev}>›</span>
                        </button>
                      </div>

                      {/* Session */}
                      <button
                        onClick={handleLogout}
                        style={SS.logout}
                        onMouseEnter={(e) => Object.assign(e.currentTarget.style, SS.logoutHover)}
                        onMouseLeave={(e) => Object.assign(e.currentTarget.style, SS.logout)}
                      >
                        <span style={SS.logoutDot} />
                        Terminate Session
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </header>

        {/* Stats Summary Bar */}
        <div style={{
          ...styles.statsContainer,
          padding: isMobile ? '20px' : styles.statsContainer.padding,
          gridTemplateColumns: `repeat(auto-fit, minmax(${isMobile ? '160px' : '260px'}, 1fr))`
        }}>
          <motion.div whileHover={{ y: -5 }} style={{
            ...styles.statCard,
            padding: isMobile ? '20px' : styles.statCard.padding,
            gap: isMobile ? '12px' : styles.statCard.gap
          }}>
            <div style={{
              ...styles.statIcon,
              width: isMobile ? '48px' : styles.statIcon.width,
              height: isMobile ? '48px' : styles.statIcon.height,
              fontSize: isMobile ? '24px' : styles.statIcon.fontSize
            }}><TeacherIcon size={isMobile ? 22 : 28} color="#60a5fa" /></div>
            <div style={styles.statContent}>
              <div style={{
                ...styles.statValue,
                fontSize: isMobile ? '24px' : styles.statValue.fontSize
              }}>{stats.totalTeachers}</div>
              <div style={{
                ...styles.statLabel,
                fontSize: isMobile ? '12px' : styles.statLabel.fontSize
              }}>Faculty Members</div>
            </div>
          </motion.div>
          <motion.div whileHover={{ y: -5 }} style={{
            ...styles.statCard,
            padding: isMobile ? '20px' : styles.statCard.padding,
            gap: isMobile ? '12px' : styles.statCard.gap
          }}>
            <div style={{
              ...styles.statIcon,
              width: isMobile ? '48px' : styles.statIcon.width,
              height: isMobile ? '48px' : styles.statIcon.height,
              fontSize: isMobile ? '24px' : styles.statIcon.fontSize
            }}><StudentIcon size={isMobile ? 22 : 28} color="#60a5fa" /></div>
            <div style={styles.statContent}>
              <div style={{
                ...styles.statValue,
                fontSize: isMobile ? '24px' : styles.statValue.fontSize
              }}>{stats.totalStudents}</div>
              <div style={{
                ...styles.statLabel,
                fontSize: isMobile ? '12px' : styles.statLabel.fontSize
              }}>Active Students</div>
            </div>
          </motion.div>
          <motion.div whileHover={{ y: -5 }} style={{
            ...styles.statCard,
            padding: isMobile ? '20px' : styles.statCard.padding,
            gap: isMobile ? '12px' : styles.statCard.gap
          }}>
            <div style={{
              ...styles.statIcon,
              width: isMobile ? '48px' : styles.statIcon.width,
              height: isMobile ? '48px' : styles.statIcon.height,
              fontSize: isMobile ? '24px' : styles.statIcon.fontSize
            }}><ParentIcon size={isMobile ? 22 : 28} color="#60a5fa" /></div>
            <div style={styles.statContent}>
              <div style={{
                ...styles.statValue,
                fontSize: isMobile ? '24px' : styles.statValue.fontSize
              }}>{stats.totalParents}</div>
              <div style={{
                ...styles.statLabel,
                fontSize: isMobile ? '12px' : styles.statLabel.fontSize
              }}>Guardian Profiles</div>
            </div>
          </motion.div>
        </div>

        <div style={{
          ...styles.content,
          padding: isMobile ? '0 20px 40px 20px' : styles.content.padding
        }}>
          {/* View Navigation */}
          <div style={styles.viewNavigation}>
            {views.map(view => (
              <motion.button
                key={view.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveView(view.id)}
                style={{
                  ...styles.viewButton,
                  ...(activeView === view.id ? styles.viewButtonActive : {})
                }}
              >
                <span style={styles.viewIcon}>{view.icon}</span>
                <span style={styles.viewLabel}>{view.label}</span>
              </motion.button>
            ))}
          </div>

          {/* Active View Content */}
          <motion.div
            key={activeView}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            style={styles.viewContent}
          >
            {renderActiveView()}
          </motion.div>
        </div>

        {/* Password Change Modal */}
        <AnimatePresence>
          {showPasswordModal && (
            <div style={styles.modalOverlay}>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                style={styles.modalContent}
              >
                <div style={styles.modalHeader}>
                  <h3 style={styles.modalTitle}>Security Update</h3>
                  <button
                    onClick={() => setShowPasswordModal(false)}
                    style={styles.closeButton}
                  >
                    ✕
                  </button>
                </div>
                <div style={styles.modalBody}>
                  <form onSubmit={handlePasswordChange}>
                    <p style={{ marginBottom: '24px', color: 'rgba(148, 163, 184, 1)', fontSize: '14px', lineHeight: '1.6' }}>
                      Updating access credentials for <span style={{ fontWeight: 'bold', color: '#ffffff' }}>{selectedUser?.username}</span>.
                    </p>

                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>New Access Key</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        style={styles.formInput}
                        placeholder="••••••••"
                        minLength="6"
                        required
                      />
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Verify Access Key</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        style={styles.formInput}
                        placeholder="••••••••"
                        minLength="6"
                        required
                      />
                    </div>

                    <div style={styles.modalActions}>
                      <button
                        type="button"
                        onClick={() => setShowPasswordModal(false)}
                        style={styles.cancelBtn}
                      >
                        Keep Existing
                      </button>
                      <button
                        type="submit"
                        disabled={actionLoading}
                        style={styles.saveBtn}
                      >
                        {actionLoading ? 'Updating...' : 'Authorize Change'}
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </>
  );
};

export default AdminDashboard;

// End of AdminDashboard component
const styles = adminStyles; /* original styles object commented out below */

// ─────────────────────────────────────────────────────────────────────────
// Settings-drawer styles (SS)
// ─────────────────────────────────────────────────────────────────────────
// Self-contained design system for the principal-console drawer. Nothing
// here inherits `styles.settingsBtn` or any other base — the old drawer
// did and that's where the blue-purple gradient leaked through every
// button. Surfaces use a dark glass background with subtle borders;
// accent comes from the per-tool icon tint, not the surface itself.
const SS_FONT =
  '"Inter", "Google Sans", "Product Sans", -apple-system, BlinkMacSystemFont, sans-serif';

const SS = {
  drawer: {
    position: 'absolute',
    top: 'calc(100% + 10px)',
    right: 0,
    width: 320,
    minWidth: 280,
    maxHeight: 'calc(100vh - 100px)',
    overflowY: 'auto',
    padding: 16,
    background: 'rgba(11, 18, 38, 0.96)',
    backdropFilter: 'blur(18px) saturate(140%)',
    WebkitBackdropFilter: 'blur(18px) saturate(140%)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 18,
    boxShadow:
      '0 24px 60px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.02) inset',
    color: '#f1f5f9',
    fontFamily: SS_FONT,
  },

  // Profile hero
  hero: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    padding: '14px 12px 18px',
    marginBottom: 12,
    background:
      'radial-gradient(120% 80% at 50% 0%, rgba(99,102,241,0.18), rgba(99,102,241,0) 65%)',
    borderRadius: 14,
  },
  avatarRing: {
    padding: 3,
    borderRadius: '50%',
    background:
      'conic-gradient(from 140deg, #60a5fa, #a78bfa, #f0abfc, #60a5fa)',
    boxShadow: '0 8px 24px rgba(99, 102, 241, 0.28)',
  },
  heroName: {
    fontSize: 16,
    fontWeight: 700,
    color: '#f1f5f9',
    letterSpacing: '-0.01em',
  },
  heroBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: '#a5b4fc',
    padding: '4px 10px',
    background: 'rgba(99, 102, 241, 0.12)',
    border: '1px solid rgba(99, 102, 241, 0.28)',
    borderRadius: 999,
  },
  heroBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#a5b4fc',
    boxShadow: '0 0 8px rgba(165, 180, 252, 0.85)',
  },

  // Section groups
  group: { marginTop: 14 },
  groupLabel: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: '#64748b',
    margin: '0 4px 8px',
  },

  // Management-tools tiles (two-column grid)
  toolGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  },
  tool: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 6,
    padding: '14px 12px',
    background: 'rgba(255, 255, 255, 0.025)',
    border: '1px solid rgba(255, 255, 255, 0.07)',
    borderRadius: 14,
    cursor: 'pointer',
    color: '#e2e8f0',
    fontFamily: SS_FONT,
    textAlign: 'left',
    transition: 'transform 160ms ease, background 160ms ease, border-color 160ms ease',
  },
  toolHover: {
    background: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.14)',
    transform: 'translateY(-1px)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 6,
    padding: '14px 12px',
    borderRadius: 14,
    color: '#e2e8f0',
    fontFamily: SS_FONT,
    textAlign: 'left',
  },
  toolIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    border: '1px solid',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    marginBottom: 2,
  },
  toolLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: '#f1f5f9',
  },
  toolSub: {
    fontSize: 11,
    color: '#94a3b8',
  },

  // Account-row buttons (full-width list)
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    padding: '10px 12px',
    marginBottom: 6,
    background: 'rgba(255, 255, 255, 0.025)',
    border: '1px solid rgba(255, 255, 255, 0.07)',
    borderRadius: 12,
    cursor: 'pointer',
    color: '#e2e8f0',
    fontFamily: SS_FONT,
    textAlign: 'left',
    transition: 'background 160ms ease, border-color 160ms ease',
  },
  rowHover: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    padding: '10px 12px',
    marginBottom: 6,
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    borderRadius: 12,
    cursor: 'pointer',
    color: '#f1f5f9',
    fontFamily: SS_FONT,
    textAlign: 'left',
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    border: '1px solid',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    flexShrink: 0,
  },
  rowMain: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  rowLabel: { fontSize: 13, fontWeight: 700, color: '#f1f5f9' },
  rowSub: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  rowChev: {
    color: '#475569',
    fontSize: 20,
    lineHeight: 1,
    flexShrink: 0,
    marginLeft: 2,
  },

  // Terminate-session — destructive, but quiet (outline + subtle dot)
  logout: {
    marginTop: 14,
    width: '100%',
    padding: '12px 14px',
    background: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.30)',
    borderRadius: 12,
    color: '#fca5a5',
    fontFamily: SS_FONT,
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 0.2,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    transition: 'background 160ms ease, border-color 160ms ease',
  },
  logoutHover: {
    marginTop: 14,
    width: '100%',
    padding: '12px 14px',
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.50)',
    borderRadius: 12,
    color: '#fecaca',
    fontFamily: SS_FONT,
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 0.2,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  logoutDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#ef4444',
    boxShadow: '0 0 10px rgba(239, 68, 68, 0.75)',
  },
};

/*
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  },
  header: {
    padding: '20px 40px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(10px)',
    borderBottom: '2px solid rgba(121, 40, 202, 0.1)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)'
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 15
  },
  logoSection: {
    display: 'flex',
    alignItems: 'center',
    gap: 15
  },
  logoImage: {
    width: 60,
    height: 60,
    borderRadius: '50%',
    objectFit: 'cover',
    border: '3px solid rgba(121, 40, 202, 0.3)',
    boxShadow: '0 4px 12px rgba(121, 40, 202, 0.2)'
  },
  title: {
    margin: 0,
    fontSize: 26,
    fontWeight: 700,
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text'
  },
  subtitle: {
    margin: '4px 0 8px 0',
    fontSize: 14,
    color: '#6b7280',
    fontWeight: 500
  },
  welcomeMessage: {
    marginTop: 8
  },
  welcomeMainText: {
    margin: 0,
    fontSize: 15,
    fontWeight: 600,
    color: '#111827'
  },
  welcomeSubText: {
    margin: '4px 0 0 0',
    fontSize: 13,
    color: '#6b7280'
  },
  headerCenter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1
  },
  schoolDisplay: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '12px 24px',
    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1))',
    borderRadius: 12,
    border: '2px solid rgba(121, 40, 202, 0.2)'
  },
  schoolLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  schoolValue: {
    fontSize: 16,
    fontWeight: 700,
    color: '#e2e8f0',
    marginTop: 2,
    letterSpacing: '0.5px'
  },
  settingsContainer: {
    position: 'relative'
  },
  settingsBtn: {
    padding: '10px 20px',
    background: 'rgba(15, 23, 42, 0.6)',
    color: '#f8fafc',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
    backdropFilter: 'blur(10px)',
    transition: 'all 0.3s ease'
  },
  settingsDropdown: {
    position: 'absolute',
    top: 'calc(100% + 10px)',
    right: 0,
    background: 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.95) 100%)',
    backdropFilter: 'blur(10px)',
    borderRadius: 12,
    boxShadow: '0 8px 32px rgba(121, 40, 202, 0.3)',
    padding: 16,
    minWidth: 250,
    zIndex: 1000,
    border: '2px solid rgba(121, 40, 202, 0.2)'
  },
  settingsSection: {
    padding: '12px 0'
  },
  settingsLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6
  },
  settingsValue: {
    fontSize: 14,
    fontWeight: 600,
    color: '#111827'
  },
  settingsDivider: {
    height: 1,
    background: 'linear-gradient(90deg, transparent, rgba(121, 40, 202, 0.2), transparent)',
    margin: '8px 0'
  },
  logoutBtnDropdown: {
    width: '100%',
    padding: '10px 16px',
    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    marginTop: 8,
    transition: 'all 0.3s ease'
  },
  statsContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: 24,
    padding: '30px 40px 20px 40px',
    maxWidth: 1400,
    margin: '0 auto'
  },
  statCard: {
    background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.9) 100%)',
    backdropFilter: 'blur(10px)',
    borderRadius: 16,
    padding: 24,
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    boxShadow: '0 8px 32px rgba(121, 40, 202, 0.15)',
    border: '2px solid transparent',
    backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,255,255,0.9)), linear-gradient(135deg, #667eea, #764ba2)',
    backgroundOrigin: 'border-box',
    backgroundClip: 'padding-box, border-box',
    transition: 'all 0.3s ease',
    cursor: 'pointer'
  },
  statIcon: {
    fontSize: 48,
    filter: 'drop-shadow(0 4px 8px rgba(121, 40, 202, 0.3))'
  },
  statContent: {
    flex: 1
  },
  statValue: {
    fontSize: 32,
    fontWeight: 700,
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    marginBottom: 4
  },
  statLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  content: {
    padding: '20px 40px 40px 40px',
    maxWidth: 1400,
    margin: '0 auto'
  },
  viewNavigation: {
    display: 'flex',
    gap: 12,
    marginBottom: 30,
    flexWrap: 'wrap',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.9) 100%)',
    backdropFilter: 'blur(10px)',
    padding: 20,
    borderRadius: 16,
    boxShadow: '0 8px 32px rgba(121, 40, 202, 0.15)',
    border: '2px solid rgba(121, 40, 202, 0.1)'
  },
  viewButton: {
    padding: '12px 24px',
    background: 'rgba(15, 23, 42, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    color: '#94a3b8',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    transition: 'all 0.3s ease',
    backdropFilter: 'blur(8px)'
  },
  viewButtonActive: {
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#f8fafc',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
  },
  viewIcon: {
    fontSize: 18
  },
  viewLabel: {
    fontSize: 14,
    fontWeight: 600
  },
  viewContent: {
    minHeight: 400
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 400,
    color: '#6b7280',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.9) 100%)',
    backdropFilter: 'blur(10px)',
    borderRadius: 16,
    boxShadow: '0 8px 32px rgba(121, 40, 202, 0.15)',
    border: '2px solid rgba(121, 40, 202, 0.1)'
  },
  spinner: {
    width: 50,
    height: 50,
    border: '4px solid rgba(121, 40, 202, 0.1)',
    borderTop: '4px solid #667eea',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: 16
  },
  overviewContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 30
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 700,
    color: '#000000',
    marginBottom: 20
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: 20
  },
  overviewCard: {
    background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.9) 100%)',
    backdropFilter: 'blur(10px)',
    borderRadius: 16,
    padding: 24,
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    boxShadow: '0 8px 32px rgba(121, 40, 202, 0.15)',
    border: '2px solid transparent',
    backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,255,255,0.9)), linear-gradient(135deg, #667eea, #764ba2)',
    backgroundOrigin: 'border-box',
    backgroundClip: 'padding-box, border-box',
    transition: 'all 0.3s ease',
    cursor: 'pointer'
  },
  overviewIcon: {
    fontSize: 48,
    filter: 'drop-shadow(0 4px 8px rgba(121, 40, 202, 0.3))'
  },
  overviewContent: {
    flex: 1
  },
  overviewValue: {
    fontSize: 32,
    fontWeight: 700,
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    marginBottom: 4
  },
  overviewLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  quickActions: {
    background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.9) 100%)',
    backdropFilter: 'blur(10px)',
    borderRadius: 16,
    padding: 30,
    boxShadow: '0 8px 32px rgba(121, 40, 202, 0.15)',
    border: '2px solid rgba(121, 40, 202, 0.1)'
  },
  quickActionsSubtitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#111827',
    marginBottom: 20
  },
  actionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 15
  },
  actionButton: {
    padding: '16px 24px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    fontSize: 15,
    fontWeight: 600,
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 12px rgba(121, 40, 202, 0.3)'
  },
  messagesTableContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 30,
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    border: '1px solid #e5e7eb'
  },
  tableTitleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 15
  },
  searchContainer: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  searchInput: {
    padding: '12px 40px 12px 16px',
    border: '2px solid rgba(121, 40, 202, 0.2)',
    borderRadius: 10,
    fontSize: 14,
    width: 320,
    outline: 'none',
    transition: 'all 0.3s ease',
    background: 'rgba(255, 255, 255, 0.8)'
  },
  clearSearchButton: {
    position: 'absolute',
    right: 8,
    background: 'rgba(121, 40, 202, 0.1)',
    border: 'none',
    borderRadius: 6,
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: 14,
    color: '#667eea',
    transition: 'all 0.2s ease'
  },
  tableWrapper: {
    overflowX: 'auto',
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    marginTop: 20,
    backgroundColor: 'white'
  },
  messagesTable: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  messagesTableHeader: {
    background: 'white',
    borderBottom: '2px solid #e5e7eb'
  },
  th: {
    padding: '16px',
    textAlign: 'left',
    fontSize: 12,
    fontWeight: 700,
    color: '#7928ca',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  tableRow: {
    borderBottom: '1px solid #f3f4f6',
    transition: 'all 0.2s ease',
    cursor: 'pointer'
  },
  td: {
    padding: '18px 16px',
    fontSize: 14,
    color: '#374151',
    fontWeight: 500
  },
  tableViewButton: {
    padding: '8px 16px',
    background: 'linear-gradient(135deg, #7928ca 0%, #5b21b6 100%)',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    transition: 'all 0.3s ease',
    boxShadow: '0 2px 8px rgba(121, 40, 202, 0.2)'
  },
  userEmptyState: {
    textAlign: 'center',
    padding: 40,
    color: '#6b7280',
    fontSize: 14
  },
  analyticsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20
  },
  analyticsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: 20
  },
  analyticsCard: {
    background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.9) 100%)',
    backdropFilter: 'blur(10px)',
    borderRadius: 16,
    padding: 24,
    boxShadow: '0 8px 32px rgba(121, 40, 202, 0.15)',
    border: '2px solid rgba(121, 40, 202, 0.1)'
  },
  analyticsTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: '#111827',
    marginBottom: 16
  },
  analyticsContent: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 1.8
  },
  analyticsItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid rgba(121, 40, 202, 0.1)'
  },
  analyticsLabel: {
    color: '#6b7280',
    fontSize: 14
  },
  analyticsValue: {
    color: '#111827',
    fontSize: 18,
    fontWeight: 700
  },
  announcementsContainer: {
    background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.9) 100%)',
    backdropFilter: 'blur(10px)',
    borderRadius: 16,
    padding: 30,
    boxShadow: '0 8px 32px rgba(121, 40, 202, 0.15)',
    border: '2px solid rgba(121, 40, 202, 0.1)'
  },
  announcementForm: {
    maxWidth: 700,
    display: 'flex',
    flexDirection: 'column',
    gap: 20
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8
  },
  formLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: '#374151',
    letterSpacing: 0.3
  },
  formSelect: {
    padding: '12px 16px',
    fontSize: 14,
    border: '2px solid rgba(121, 40, 202, 0.2)',
    borderRadius: 10,
    background: 'rgba(255, 255, 255, 0.9)',
    color: '#111827',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    outline: 'none'
  },
  formInput: {
    padding: '12px 16px',
    fontSize: 14,
    border: '2px solid rgba(121, 40, 202, 0.2)',
    borderRadius: 10,
    background: 'rgba(255, 255, 255, 0.9)',
    color: '#111827',
    transition: 'all 0.3s ease',
    outline: 'none'
  },
  formTextarea: {
    padding: '12px 16px',
    fontSize: 14,
    border: '2px solid rgba(121, 40, 202, 0.2)',
    borderRadius: 10,
    background: 'rgba(255, 255, 255, 0.9)',
    color: '#111827',
    transition: 'all 0.3s ease',
    outline: 'none',
    fontFamily: 'inherit',
    resize: 'vertical',
    minHeight: 120
  },
  charCount: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'right',
    marginTop: 4
  },
  messageSubmitButton: {
    padding: '14px 28px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    fontSize: 15,
    fontWeight: 600,
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 12px rgba(121, 40, 202, 0.3)',
    marginTop: 10
  },
  successMessage: {
    padding: '12px 20px',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: 'white',
    borderRadius: 10,
    marginBottom: 20,
    fontSize: 14,
    fontWeight: 600,
    textAlign: 'center',
    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
  },
  refreshButton: {
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 12px rgba(121, 40, 202, 0.3)'
  },
  classSelect: {
    padding: '10px 16px',
    fontSize: 14,
    border: '2px solid rgba(121, 40, 202, 0.2)',
    borderRadius: 8,
    background: 'rgba(255, 255, 255, 0.95)',
    color: '#111827',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    outline: 'none',
    minWidth: 150
  },
  classSelectLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)'
  },
  modalContent: {
    background: 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.95) 100%)',
    borderRadius: 20,
    maxWidth: 700,
    width: '90%',
    maxHeight: '85vh',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(121, 40, 202, 0.4)',
    border: '2px solid rgba(121, 40, 202, 0.2)',
    display: 'flex',
    flexDirection: 'column'
  },
  modalHeader: {
    padding: '24px 30px',
    borderBottom: '2px solid rgba(121, 40, 202, 0.1)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1))'
  },
  modalTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 700,
    color: '#111827'
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    fontSize: 28,
    cursor: 'pointer',
    color: '#6b7280',
    padding: 8,
    lineHeight: 1,
    transition: 'all 0.2s ease'
  },
  modalBody: {
    padding: 30,
    overflowY: 'auto',
    flex: 1
  },
  detailSection: {
    marginBottom: 24
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: '#111827',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottom: '2px solid rgba(121, 40, 202, 0.1)'
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 16
  },
  detailItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  detailValue: {
    fontSize: 15,
    fontWeight: 600,
    color: '#111827'
  },
  detailNote: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
    padding: 16,
    background: 'rgba(102, 126, 234, 0.05)',
    borderRadius: 10,
    border: '1px solid rgba(121, 40, 202, 0.1)'
  },
  actionButtonsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: 12
  },
  actionBtn: {
    padding: '12px 16px',
    color: 'white',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
  },
  suspendedBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 15,
    padding: '16px 20px',
    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.1) 100%)',
    border: '2px solid rgba(239, 68, 68, 0.3)',
    borderRadius: 10,
    margin: '0 20px 20px 20px'
  },
  suspendedIcon: {
    fontSize: 32,
    flexShrink: 0
  },
  suspendedText: {
    flex: 1
  },
  createUserContainer: {
    background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.9) 100%)',
    backdropFilter: 'blur(10px)',
    borderRadius: 16,
    padding: 30,
    boxShadow: '0 8px 32px rgba(121, 40, 202, 0.15)',
    border: '2px solid rgba(121, 40, 202, 0.1)'
  },
  container: {
    display: 'flex',
    minHeight: '100vh',
    fontFamily: '"Product Sans", "Google Sans", sans-serif',
    color: '#ffffff',
    position: 'relative',
    zIndex: 1
  },
  sidebar: {
    width: '280px',
    background: 'rgba(15, 23, 42, 0.65)',
    backdropFilter: 'blur(20px)',
    borderRight: '1px solid rgba(255, 255, 255, 0.1)',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px',
    position: 'fixed',
    height: '95vh',
    top: '2.5vh',
    left: '20px',
    borderRadius: '24px',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
    zIndex: 100,
    transition: 'all 0.3s ease'
  },
  mainContent: {
    flex: 1,
    padding: '40px',
    marginLeft: '320px', // Adjusted for floating sidebar
    overflowY: 'auto'
  },
  createUserForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 20
  },
  checkboxGroup: {
    padding: 16,
    background: 'rgba(102, 126, 234, 0.05)',
    borderRadius: 10,
    border: '1px solid rgba(121, 40, 202, 0.1)'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 15,
    fontWeight: 500,
    color: '#111827',
    cursor: 'pointer'
  },
  checkbox: {
    width: 18,
    height: 18,
    cursor: 'pointer',
    accentColor: '#667eea'
  },
  parentSection: {
    padding: 20,
    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)',
    borderRadius: 12,
    border: '2px solid rgba(121, 40, 202, 0.15)',
    display: 'flex',
    flexDirection: 'column',
    gap: 15
  },
  formHint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4
  },
  announcementSubmitButton: {
    padding: '16px 32px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
    fontSize: 16,
    fontWeight: 600,
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 16px rgba(121, 40, 202, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 10
  },
  buttonSpinner: {
    width: 16,
    height: 16,
    border: '2px solid rgba(255, 255, 255, 0.3)',
    borderTop: '2px solid white',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite'
  },
  errorMessage: {
    padding: 16,
    background: 'rgba(239, 68, 68, 0.1)',
    border: '2px solid rgba(239, 68, 68, 0.3)',
    borderRadius: 10,
    color: '#dc2626',
    fontSize: 14,
    fontWeight: 500
  },
  notificationToast: {
    position: 'fixed',
    top: 20,
    right: 20,
    minWidth: 320,
    maxWidth: 500,
    padding: '16px 20px',
    borderRadius: 12,
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    zIndex: 10000,
    animation: 'slideInRight 0.3s ease-out'
  },
  notificationSuccess: {
    background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.95) 0%, rgba(22, 163, 74, 0.95) 100%)',
    border: '2px solid rgba(34, 197, 94, 0.5)',
    color: 'white'
  },
  notificationError: {
    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.95) 0%, rgba(220, 38, 38, 0.95) 100%)',
    border: '2px solid rgba(239, 68, 68, 0.5)',
    color: 'white'
  },
  notificationContent: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flex: 1
  },
  notificationIcon: {
    fontSize: 20,
    flexShrink: 0
  },
  notificationMessage: {
    fontSize: 14,
    fontWeight: 500,
    lineHeight: 1.5
  },
  notificationClose: {
    background: 'rgba(255, 255, 255, 0.2)',
    border: 'none',
    borderRadius: 6,
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: 18,
    color: 'white',
    transition: 'all 0.2s ease',
    flexShrink: 0
  },
  announcementHistory: {
    marginTop: 32,
    paddingTop: 32,
    borderTop: '2px dashed rgba(121, 40, 202, 0.2)'
  },
  announcementSubtitle: {
    fontSize: 20,
    fontWeight: 700,
    color: '#111827',
    marginBottom: 20
  },
  announcementsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16
  },
  announcementCard: {
    background: 'rgba(255, 255, 255, 0.85)',
    border: '2px solid rgba(121, 40, 202, 0.15)',
    borderRadius: 12,
    padding: 20,
    transition: 'all 0.3s ease',
    '&:hover': {
      borderColor: 'rgba(121, 40, 202, 0.3)',
      transform: 'translateY(-2px)',
      boxShadow: '0 8px 24px rgba(121, 40, 202, 0.15)'
    }
  },
  announcementHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  announcementTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#000000',
    marginBottom: 8
  },
  announcementMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'center'
  },
  announcementBadge: {
    padding: '4px 12px',
    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 100%)',
    border: '1px solid rgba(121, 40, 202, 0.3)',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    color: '#5b21b6'
  },
  announcementDate: {
    fontSize: 13,
    color: '#374151',
    fontWeight: 500
  },
  announcementAuthor: {
    fontSize: 13,
    color: '#4b5563',
    fontStyle: 'italic'
  },
  announcementMessage: {
    fontSize: 15,
    color: '#000000',
    lineHeight: 1.6,
    margin: 0
  },
  deleteAnnouncementBtn: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '2px solid rgba(239, 68, 68, 0.3)',
    borderRadius: 8,
    padding: 8,
    cursor: 'pointer',
    fontSize: 18,
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    '&:hover': {
      background: 'rgba(239, 68, 68, 0.2)',
      borderColor: 'rgba(239, 68, 68, 0.5)',
      transform: 'scale(1.1)'
    }
  },
  announcementEmptyState: {
    textAlign: 'center',
    padding: 40,
    color: '#6b7280',
    fontSize: 15,
    fontStyle: 'italic'
  },
  performanceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 16
  },
  performanceCard: {
    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05), rgba(118, 75, 162, 0.05))',
    border: '2px solid rgba(121, 40, 202, 0.15)',
    borderRadius: 12,
    padding: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    transition: 'all 0.3s ease'
  },
  performanceIcon: {
    fontSize: 32,
    flexShrink: 0
  },
  performanceData: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4
  },
  performanceValue: {
    fontSize: 24,
    fontWeight: 700,
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    lineHeight: 1
  },
  performanceLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.3
  },
  lessonCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    border: '1px solid #e5e7eb',
    transition: 'transform 0.2s, box-shadow 0.2s'
  },
  lessonHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  lessonTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#1f2937'
  },
  lessonContent: {
    marginTop: 12,
    whiteSpace: 'pre-wrap',
    color: '#374151',
    fontSize: 14,
    lineHeight: 1.6,
    padding: 12,
    backgroundColor: 'white',
    borderRadius: 8,
    border: '1px solid #e5e7eb'
  },
  lessonFooter: {
    marginTop: 8,
    fontSize: 12,
    color: '#9ca3af'
  },
  badge: {
    padding: '4px 10px',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600
  },
  feedbackCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    border: '1px solid #e5e7eb',
    transition: 'transform 0.2s, box-shadow 0.2s'
  },
  feedbackCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  feedbackUserName: {
    fontSize: 16,
    fontWeight: 700,
    color: '#1f2937',
    display: 'flex',
    alignItems: 'center',
    gap: 8
  },
  feedbackUserRole: {
    fontSize: 13,
    fontWeight: 600,
    backgroundColor: '#ddd6fe',
    color: '#7928ca',
    padding: '4px 10px',
    borderRadius: 12
  },
  feedbackUserClass: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4
  },
  feedbackTimestamp: {
    fontSize: 12,
    color: '#9ca3af',
    whiteSpace: 'nowrap'
  },
  feedbackText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 1.6,
    padding: 12,
    backgroundColor: 'white',
    borderRadius: 8,
    border: '1px solid #e5e7eb',
    marginBottom: 8,
    whiteSpace: 'pre-wrap'
  },
  feedbackEmail: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic'
  },
  feedbackBtn: {
    padding: '10px 20px',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.3s ease',
    color: 'white'
  },
  leaderboardContainer: {
    padding: '20px',
    backgroundColor: 'white',
    borderRadius: '16px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    marginBottom: 20,
    width: '100%',
    boxSizing: 'border-box'
  },
  highlightCard: {
    padding: 30,
    borderRadius: 16,
    boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
    textAlign: 'center',
    position: 'relative',
    overflow: 'hidden'
  },
  highlightStat: {
    padding: '12px',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    backdropFilter: 'blur(10px)'
  },
  leaderboardTable: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    width: '100%'
  },
  leaderboardTableContainer: {
    overflowX: 'auto',
    borderRadius: 8,
    border: '1px solid #e5e7eb',
    width: '100%'
  },
  leaderboardTableEl: {
    width: '100%',
    minWidth: '100%',
    borderCollapse: 'collapse',
    fontSize: 14,
    tableLayout: 'fixed'
  },
  tableHeaderRow: {
    backgroundColor: '#f9fafb',
    borderBottom: '2px solid #e5e7eb'
  },
  leaderboardTableHeader: {
    padding: '12px 16px',
    textAlign: 'left',
    fontWeight: 700,
    color: '#374151',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  leaderboardTableRow: {
    borderBottom: '1px solid #f3f4f6',
    transition: 'background-color 0.2s'
  },
  tableCell: {
    padding: '14px 16px',
    color: '#111827',
    textAlign: 'left'
  },
  weeklyGraphContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 30,
    marginTop: 30,
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
  },
  graphDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 25,
    textAlign: 'center'
  },
  barChartContainer: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 300,
    padding: '20px 10px',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    border: '1px solid #e5e7eb',
    gap: 10
  },
  barWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end'
  },
  bar: {
    width: '100%',
    maxWidth: 80,
    borderRadius: '8px 8px 0 0',
    transition: 'all 0.3s ease',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    position: 'relative',
    minHeight: 20
  },
  barLabel: {
    fontSize: 14,
    fontWeight: 700,
    color: '#374151',
    marginBottom: 8
  },
  barDateLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
    fontWeight: 500
  }
*/
