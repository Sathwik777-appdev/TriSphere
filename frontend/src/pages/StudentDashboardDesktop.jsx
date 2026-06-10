import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { logoutUser } from '../services/authService';
import { logActivity } from '../services/firestoreService';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { safeLocalStorage } from '../utils/storage';
import { warningToast, successToast, errorToast } from '../utils/toast';
import { SubjectList } from '../components/SubjectList';
import { LernixAIChat } from '../components/LernixAIChat';
import { ToolsPanel } from '../components/ToolsPanel';
import { MyProgress } from '../components/MyProgress';
import { MyNotes } from '../components/MyNotes';
import StudentAssignmentSubmit from '../components/StudentAssignmentSubmit';
import TodoPanel from '../components/TodoPanel';
import { PrivacyPolicy } from '../components/PrivacyPolicy';
import GradedAssignments from '../components/GradedAssignments';
import { QuizletStyle } from '../components/QuizletStyle';
import StudentAnnouncements from '../components/StudentAnnouncements';
import AstraCheckIn from '../components/AstraCheckIn';
import AnimatedLogo from '../components/AnimatedLogo';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, setDoc, getDoc, limit, orderBy, onSnapshot, runTransaction } from 'firebase/firestore';
import { db } from '../services/firebase';
import { styles } from './studentDashboardStyles';
import { getThemedStyles } from '../styles/theme';
import AssignmentReminder from '../components/AssignmentReminder';
import DiscussionForum from '../components/DiscussionForum';
import VideoBackground from '../components/VideoBackground';
import { useSwipeNavigation } from '../hooks/useSwipeNavigation';
import { AchievementBadges } from '../components/AchievementBadges';
import { Leaderboard } from '../components/Leaderboard';
import { DailyChallenges } from '../components/DailyChallenges';
import { RewardsStore } from '../components/RewardsStore';
import { StudyPath } from '../components/StudyPath';
import { RevisionReminder } from '../components/RevisionReminder';
import { ProfilePhoto } from '../components/ProfilePhoto';
import { AccountSettings } from '../components/AccountSettings';
import Skeleton from '../components/Skeleton';
import ErrorBoundary from '../components/ErrorBoundary';
import { getFinalQuizScores } from '../utils/quizUtils';
import { StudentProfileModal } from '../components/StudentProfileModal';
import StudentSimulationLab from '../components/StudentSimulationLab';
import {
  SettingsIcon,
  LogoutIcon,
  CloseIcon,
  MessageIcon,
  FeedbackIcon,
  ShieldIcon,
  ForumIcon,
  AnnouncementIcon,
  CheckCircleIcon,
  TimerIcon,
  TargetIcon,
  FireIcon,
  TaskIcon,
  BookIcon,
  NotesIcon,
  QuizIcon,
  AssignmentIcon,
  ToolsIcon,
  AIIcon,
  SearchIcon
} from '../components/Icons';


const AVATAR_IMAGES = {
  'avatar_robot': { img: '/avatars/robot.png', name: 'Robot' },
  'avatar_wizard': { img: '/avatars/wizard.png', name: 'Wizard' },
  'avatar_astronaut': { img: '/avatars/astronaut.png', name: 'Astronaut' },
  'avatar_ninja': { img: '/avatars/ninja.png', name: 'Ninja' },
  'avatar_superhero': { img: '/avatars/superhero.png', name: 'Learn Hero' },
  'avatar_alien': { img: '/avatars/alien.png', name: 'Space Explorer' },
  'avatar_dragon': { img: '/avatars/dragon.png', name: 'Scholar Dragon' },
  'avatar_unicorn': { img: '/avatars/unicorn.png', name: 'Magic Unicorn' }
};



export const StudentDashboard = () => {


  const { user, userData, loading } = useAuth();
  const navigate = useNavigate();
  // Move these state declarations to the top
  const [chapters, setChapters] = useState([]); // List of chapter names
  const [selectedChapter, setSelectedChapter] = useState('');
  const [latestTopic, setLatestTopic] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('Physics');
  const [activeTab, setActiveTab] = useState('todo');
  const [firstLogin, setFirstLogin] = useState(true);
  const [currentQuote, setCurrentQuote] = useState(0);
  const [stats, setStats] = useState({
    tasksCompleted: 0,
    studyHours: 0,
    averageScore: 0,
    streak: 0
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [isAiMaximized, setIsAiMaximized] = useState(false);
  const [theme, setTheme] = useState(userData?.theme || 'rgb');
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [showDiscussion, setShowDiscussion] = useState(false);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [equippedAvatar, setEquippedAvatar] = useState(null);
  const [equippedAvatarName, setEquippedAvatarName] = useState('');
  const [showAccountSettings, setShowAccountSettings] = useState(false);

  // ASTRA Gating State
  const [isGated, setIsGated] = useState(true);
  const [astraLoading, setAstraLoading] = useState(true);

  useEffect(() => {
    let unsubscribe = null;
    
    if (!user?.uid || userData?.role !== 'student') {
      setAstraLoading(false);
      return;
    }

    try {
      const todayKey = () => {
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      };
      
      const docRef = doc(db, 'studentMoods', `${user.uid}_${todayKey()}`);
      unsubscribe = onSnapshot(docRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.modality !== 'skipped') {
            setIsGated(false);
          } else {
            setIsGated(true);
          }
        } else {
          setIsGated(true);
        }
        setAstraLoading(false);
      }, (err) => {
        console.warn('ASTRA gate check failed', err);
        setAstraLoading(false);
      });
    } catch (err) {
      console.warn('Failed to setup ASTRA listener', err);
      setAstraLoading(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.uid, userData?.role]);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showStudentProfile, setShowStudentProfile] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef(null);
  const lastSearchIdRef = useRef(0);
  // Cached student pool — one Firestore read per session funds every
  // keystroke after that, and the search-by-username case (where
  // searchName never matched) just works because we substring-match on
  // both fields at once.
  const searchPoolRef = useRef(null);

  // Theme-aware styles (Forced Standard RGB Theme)
  const { isDark } = useTheme();
  const themedStyles = useMemo(() => getThemedStyles(), []);

  // Check if user is in class 8, 9, or 10 for AI Assistant access
  const isAllowedClass = useMemo(() => {
    if (!userData) return false;
    return [8, 9, 10, '8', '9', '10'].includes(userData?.class);
  }, [userData?.class]);
  
  const handleSearch = useCallback(async (queryText) => {
    setSearchQuery(queryText);

    // No debounced network call any more \u2014 the entire pool lives in
    // memory after the first fetch, so each keystroke just runs a
    // synchronous filter. We still clear any stale timeout from a
    // previous version of this state.
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (queryText.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    const searchId = Date.now();
    lastSearchIdRef.current = searchId;
    setIsSearching(true);

    try {
      // \u2500\u2500 Why /publicProfiles, not /users? \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
      // The Firestore rule on /users restricts `list` to staff
      // (teachers / admins / developers). A student running
      // getDocs(collection(db, 'users'), ...) gets PERMISSION_DENIED,
      // which surfaces as "no user found" in the UI. /publicProfiles
      // is a Cloud-Function-maintained mirror of safe fields, readable
      // by any signed-in user, and is the canonical place to look up
      // peers from a student account.
      if (!searchPoolRef.current) {
        const mySchool = String(userData?.schoolName || '').trim();
        const isDeveloper = userData?.role === 'developer';
        const baseClauses = [where('role', '==', 'student')];
        const scoped = mySchool && !isDeveloper
          ? [...baseClauses, where('schoolName', '==', mySchool)]
          : baseClauses;

        let snap = await getDocs(
          query(collection(db, 'publicProfiles'), ...scoped, limit(500))
        );
        // Whitespace / casing drift in schoolName between the searcher
        // and the targets would silently hide everyone. If the scoped
        // fetch comes back empty AND we had a school filter, retry
        // without it \u2014 surface the names rather than show "no user".
        if (snap.empty && mySchool && !isDeveloper) {
          snap = await getDocs(
            query(collection(db, 'publicProfiles'), ...baseClauses, limit(500))
          );
        }

        const myUid = user?.uid;
        const pool = [];
        snap.forEach((d) => {
          if (d.id === myUid) return;
          const u = d.data();
          pool.push({
            id: d.id,
            username: u.username || 'Student',
            name: u.name || '',
            class: u.class ?? u.classNumber ?? '\u2014',
            schoolName: u.schoolName || '',
            profilePhoto: u.profilePhoto || u.photoURL || null,
            // Lowercase haystack joining both username and name so a
            // typed "sathwik" matches publicProfiles whose `name` is
            // "Sathwik J Poojary" AND whose `username` is "sathwik123".
            _hay: (
              (u.searchUsername || u.username || '') + ' ' +
              (u.searchName || u.name || '')
            ).toLowerCase(),
          });
        });
        searchPoolRef.current = pool;
      }

      const term = queryText.trim().toLowerCase();
      const filtered = searchPoolRef.current
        .filter((p) => p._hay.includes(term))
        // Prefix matches first so "san" hits "Sandeep" before "Sanchez".
        .sort((a, b) => {
          const aStarts = a._hay.startsWith(term) ? 0 : 1;
          const bStarts = b._hay.startsWith(term) ? 0 : 1;
          if (aStarts !== bStarts) return aStarts - bStarts;
          return a._hay.localeCompare(b._hay);
        })
        .slice(0, 5);

      // Race-condition guard: a faster keystroke after this one should
      // win even if its filter completed first.
      if (searchId !== lastSearchIdRef.current) return;

      setSearchResults(filtered);
      setShowSearchResults(filtered.length > 0);
    } catch (error) {
      console.error('Error searching students:', error);
    } finally {
      if (searchId === lastSearchIdRef.current) {
        setIsSearching(false);
      }
    }
  }, [userData?.schoolName, userData?.role, user?.uid]);

  const handleGoSearch = useCallback(async () => {
    let currentResults = searchResults;
    if (currentResults.length === 0 && searchQuery.trim().length >= 2) {
      currentResults = await handleSearch(searchQuery);
    }

    if (currentResults && currentResults.length > 0) {
      setSelectedStudent(currentResults[0]);
      setShowStudentProfile(true);
      setShowSearchResults(false);
    } else if (searchQuery.trim().length >= 2) {
      warningToast("No students found matching your search.");
    }
  }, [searchResults, searchQuery, handleSearch]);

  // Show skeleton loading state while auth or user data is loading
  // Loading state moved relative to render return



  // Defensive sweep — explicitly RESTORE document scroll on mount.
  // Some other page or modal could leave residual `overflow: hidden`,
  // `position: fixed`, or stale class names on <html>/<body>. We strip
  // all of them on every dashboard mount so the dashboard ALWAYS has
  // a scrollable document body.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    // Class flag that the simulation page used to set.
    body.classList.remove('simulation-page-active');
    // Inline overflow/position/height leftovers from modals or pages.
    ['overflow', 'overflowY', 'overflowX', 'position', 'height', 'maxHeight'].forEach((p) => {
      if (body.style[p]) body.style[p] = '';
      if (html.style[p]) html.style[p] = '';
    });
  }, []);

  // Fetch equipped avatar
  useEffect(() => {
    const fetchEquippedAvatar = async () => {
      if (!user?.uid) return;
      try {
        const storeDoc = await getDoc(doc(db, 'userStore', user.uid));
        if (storeDoc.exists()) {
          const avatarId = storeDoc.data().equippedItems?.avatar;
          if (avatarId && AVATAR_IMAGES[avatarId]) {
            setEquippedAvatar(AVATAR_IMAGES[avatarId].img);
            setEquippedAvatarName(AVATAR_IMAGES[avatarId].name);
          } else {
            setEquippedAvatar(null);
            setEquippedAvatarName('');
          }
        }
      } catch (error) {
        console.error('Error fetching equipped avatar:', error);
      }
    };
    fetchEquippedAvatar();
  }, [user?.uid, activeTab]); // Re-fetch when switching tabs (e.g., after visiting store)

  // Check Privacy Policy Acceptance (One-time)
  useEffect(() => {
    if (!loading && userData) {
      // We rely on userData being ready. 
      if (userData.privacyAccepted !== true) {
        setShowPrivacyPolicy(true);
      }
    }
  }, [loading, userData]);

  const handlePrivacyAccept = async () => {
    try {
      if (user?.uid) {
        await updateDoc(doc(db, 'users', user.uid), {
          privacyAccepted: true,
          privacyAcceptedAt: new Date().toISOString()
        });
        successToast("Privacy Policy Accepted");
      }
      setShowPrivacyPolicy(false);
    } catch (err) {
      console.error("Error saving privacy acceptance:", err);
      // Allow close even on error to not block user, but warn
      setShowPrivacyPolicy(false);
    }
  };




  // Reset chapter selection when subject changes to ensure correct data fetching
  useEffect(() => {
    setSelectedChapter('');
  }, [selectedSubject]);

  // Debug: log loaded YouTube URLs

  // Fetch chapters for the selected subject
  useEffect(() => {
    let cancelled = false;
    const fetchChapters = async () => {
      const userClass = userData?.class || userData?.classNumber;
      if (!userClass) return;

      try {
        const isDeveloper = userData?.role === 'developer';
        const userClassInt = parseInt(userClass);
        
        const schoolName = userData?.schoolName || '';
        console.log(`[fetchChapters] Fetching for Class: ${userClass}, Subject: ${selectedSubject}, School: "${schoolName}"`);
        
        // Query by class only (both int and string variants). Subject is
        // filtered case-insensitively in JS below — Firestore `where()` is
        // case-sensitive, so a doc saved as "Physics" wouldn't match a UI value
        // of "physics", which was silently dropping legit content.
        const subjectMatches = (docSubject) =>
          String(docSubject || '').trim().toLowerCase() === String(selectedSubject || '').trim().toLowerCase();

        // 1. Fetch from 'textbooks' collection (int & string)
        let textbookDocs = [];
        const textbookIntQ = query(collection(db, 'textbooks'), where('class', '==', userClassInt));
        const textbookStrQ = query(collection(db, 'textbooks'), where('class', '==', String(userClass)));

        const [textbookIntSnap, textbookStrSnap] = await Promise.all([getDocs(textbookIntQ), getDocs(textbookStrQ)]);
        textbookIntSnap.forEach(d => { const data = d.data(); if (subjectMatches(data.subject)) textbookDocs.push(data); });
        textbookStrSnap.forEach(d => { const data = d.data(); if (subjectMatches(data.subject)) textbookDocs.push(data); });

        // 2. Fetch from 'aiGeneratedContent' collection (int & string)
        let aiDocs = [];
        const aiIntQ = query(collection(db, 'aiGeneratedContent'), where('class', '==', userClassInt));
        const aiStrQ = query(collection(db, 'aiGeneratedContent'), where('class', '==', String(userClass)));

        const [aiIntSnap, aiStrSnap] = await Promise.all([getDocs(aiIntQ), getDocs(aiStrQ)]);
        aiIntSnap.forEach(d => { const data = d.data(); if (subjectMatches(data.subject)) aiDocs.push(data); });
        aiStrSnap.forEach(d => { const data = d.data(); if (subjectMatches(data.subject)) aiDocs.push(data); });

        console.log(`[fetchChapters] Found ${textbookDocs.length} docs in textbooks and ${aiDocs.length} in aiGeneratedContent`);

        const allDocs = [...textbookDocs, ...aiDocs];
        const chapterSet = new Set();
        
        allDocs.forEach(data => {
          // Manual school filter - more lenient
          const docSchool = data.schoolName || '';
          const schoolMatch = isDeveloper || !schoolName || !docSchool || docSchool === schoolName;
          
          if (schoolMatch && data.chapterName) {
            chapterSet.add(data.chapterName);
          } else if (!schoolMatch) {
            console.log(`[fetchChapters] Skipping "${data.chapterName}" due to school mismatch: Doc("${docSchool}") vs User("${schoolName}")`);
          }
        });

        if (cancelled) return;
        const firestoreChapters = Array.from(chapterSet).sort();
        console.log(`[fetchChapters] Final chapter list:`, firestoreChapters);
        setChapters(firestoreChapters);

        // Auto-select the first chapter when none is selected or the current
        // selection isn't part of the new subject's list. Use the functional
        // setter form because this useEffect doesn't depend on selectedChapter.
        setSelectedChapter(prev => {
          if (firestoreChapters.length === 0) return '';
          if (prev && firestoreChapters.includes(prev)) return prev;
          return firestoreChapters[0];
        });
      } catch (err) {
        console.error('Error fetching chapters:', err);
        if (!cancelled) {
          setChapters([]);
          setSelectedChapter('');
        }
      }
    };
    fetchChapters();
    return () => { cancelled = true; };
  }, [selectedSubject, userData?.class, userData?.classNumber, userData?.schoolName]);



  const motivationalQuotes = [
    { text: "\"Dream, Dream, Dream. Dreams transform into thoughts and thoughts result in action.\"", author: "Dr. APJ Abdul Kalam", icon: "🚀" },
    { text: "\"Imagination is more important than knowledge. Knowledge is limited. Imagination encircles the world.\"", author: "Albert Einstein", icon: "✨" },
    { text: "\"If I have seen further, it is by standing on the shoulders of giants.\"", author: "Isaac Newton", icon: "🔭" },
    { text: "\"The only way to do great work is to love what you do.\"", author: "Steve Jobs", icon: "💡" },
    { text: "\"Education is the most powerful weapon which you can use to change the world.\"", author: "Nelson Mandela", icon: "📚" },
    { text: "\"Success is not final, failure is not fatal: It is the courage to continue that counts.\"", author: "Winston Churchill", icon: "💪" },
    { text: "\"Learning gives creativity, creativity leads to thinking, thinking provides knowledge, knowledge makes you great.\"", author: "Dr. APJ Abdul Kalam", icon: "🌟" },
    { text: "\"The important thing is not to stop questioning. Curiosity has its own reason for existing.\"", author: "Albert Einstein", icon: "🤔" },
    { text: "\"Be the change that you wish to see in the world.\"", author: "Mahatma Gandhi", icon: "🕊️" },
    { text: "\"Science is a way of thinking much more than it is a body of knowledge.\"", author: "Carl Sagan", icon: "🔬" },
    { text: "\"Live as if you were to die tomorrow. Learn as if you were to live forever.\"", author: "Mahatma Gandhi", icon: "📖" },
    { text: "\"You have to dream before your dreams can come true.\"", author: "Dr. APJ Abdul Kalam", icon: "⭐" }
  ];

  // Rotate motivational quotes every 30 seconds
  useEffect(() => {
    const quoteInterval = setInterval(() => {
      setCurrentQuote((prev) => (prev + 1) % motivationalQuotes.length);
    }, 30000);
    return () => clearInterval(quoteInterval);
  }, []);

  // ── Streak (date-based logic to prevent loss and minimize database reads) ──
  const syncStreak = async (uid) => {
    try {
      const todayStr = new Date().toDateString();
      const yesterdayStr = new Date(Date.now() - 86400000).toDateString();
      const userRef = doc(db, 'users', uid);
      
      await runTransaction(db, async (transaction) => {
        const userSnap = await transaction.get(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          const currentStats = data.stats || {};
          const currentStreak = currentStats.streak || 0;
          const lastActive = currentStats.lastActiveDate;
          
          let newStreak = currentStreak;
          let shouldUpdate = false;
          
          if (!lastActive) {
            newStreak = 1;
            shouldUpdate = true;
          } else if (lastActive === todayStr) {
            newStreak = currentStreak === 0 ? 1 : currentStreak;
            shouldUpdate = currentStreak === 0;
          } else if (lastActive === yesterdayStr) {
            newStreak = currentStreak + 1;
            shouldUpdate = true;
          } else {
            newStreak = 1;
            shouldUpdate = true;
          }
          
          if (shouldUpdate) {
            transaction.update(userRef, {
              'stats.streak': newStreak,
              'stats.lastActiveDate': todayStr
            });

          }
        }
      });
    } catch (err) {
      console.error('Error syncing streak:', err);
    }
  };

  const hasLoggedVisit = useRef(false);

  useEffect(() => {
    // Sync UI stats with official backend-synced data
    const syncStats = () => {
      if (!userData?.stats) return;

      const { tasksCompleted, averageScore, xpBalance, streak } = userData.stats;
      
      setStats({
        tasksCompleted: tasksCompleted || 0,
        averageScore: averageScore || 0,
        xp: xpBalance || 0,
        streak: streak || 0,
        studyHours: Math.floor(((tasksCompleted || 0) * 30) / 60)
      });
    };

    syncStats();
  }, [userData?.stats]);

  // Consolidated session-level activity logging and streak calculation
  useEffect(() => {
    // Log session visit once per mount when user is loaded
    if (user?.uid && userData && !hasLoggedVisit.current) {
      hasLoggedVisit.current = true;
      logActivity(user.uid, null, 'dashboard_visit').then(async () => {
        await syncStreak(user.uid);
      }).catch(console.error);
    }
  }, [user?.uid, userData]);

  // Log activity when subject changes
  useEffect(() => {
    if (user?.uid && selectedSubject) {
      logActivity(user.uid, selectedSubject, 'subject_view').catch(console.error);
    }
  }, [selectedSubject, user?.uid]);




  const handleLogout = async () => {
    try {
      await logoutUser();
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const fetchMessages = async () => {
    if (!user?.uid && !userData?.uid) return;

    setLoadingMessages(true);
    try {
      const studentId = userData?.uid || user?.uid;
      const isDeveloper = userData?.role === 'developer';
      const schoolFilter = isDeveloper ? [] : [where('schoolName', '==', userData?.schoolName || '')];

      // messages has no schoolName field - filter by toId only
      const messagesQuery = query(
        collection(db, 'messages'),
        where('toId', '==', studentId)
      );
      const messagesSnapshot = await getDocs(messagesQuery);
      const fetchedMessages = messagesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Sort by timestamp (newest first)
      fetchedMessages.sort((a, b) => {
        const aTime = a.timestamp?.toDate?.() || new Date(0);
        const bTime = b.timestamp?.toDate?.() || new Date(0);
        return bTime - aTime;
      });

      setMessages(fetchedMessages);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleViewMessages = () => {
    setShowSettings(false);
    setShowMessages(true);
    fetchMessages();
  };

  const markMessageAsRead = async (messageId) => {
    try {
      const messageRef = doc(db, 'messages', messageId);
      await updateDoc(messageRef, { read: true });
      setMessages(messages.map(msg =>
        msg.id === messageId ? { ...msg, read: true } : msg
      ));
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const handleThemeChange = async (newTheme) => {
    setTheme(newTheme);
    document.body.className = newTheme + '-theme';

    // Save to Firestore
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, { theme: newTheme });
    } catch (err) {
      console.error('Error saving theme:', err);
    }
  };

  useEffect(() => {
    document.body.className = theme + '-theme';
  }, [theme]);

  const handleFeedbackSubmit = async () => {
    if (!feedbackText.trim()) {
      warningToast('Please enter your feedback');
      return;
    }

    setFeedbackSubmitting(true);
    try {
      // Store feedback in Firestore
      await addDoc(collection(db, 'feedback'), {
        userId: user.uid,
        userName: userData?.username || 'Unknown',
        userRole: 'student',
        userClass: userData?.class,
        feedback: feedbackText,
        timestamp: new Date(),
        email: userData?.email || user.email
      });

      successToast('Thank you for your feedback!');
      setFeedbackText('');
      setShowFeedback(false);
    } catch (err) {
      console.error('Error submitting feedback:', err);
      errorToast('Error submitting feedback. Please try again.');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const handleSelectSubject = (subject) => {
    setSelectedSubject(subject);
  };

  const tabs = [
    // Learn tab removed — its YouTube video panel was unreliable and the
    // chapter notes/quiz/assignment access lives on its own tabs already.
    { id: 'todo', label: 'TO DO', icon: <TaskIcon size={18} color="currentColor" /> },
    { id: 'notes', label: 'Notes', icon: <NotesIcon size={18} color="currentColor" /> },
    { id: 'quiz', label: 'Quizzes', icon: <QuizIcon size={18} color="currentColor" /> },
    { id: 'assignments', label: 'Assignment', icon: <AssignmentIcon size={18} color="currentColor" /> },
    { id: 'grades', label: 'My Grades', icon: <TargetIcon size={18} color="currentColor" /> },
    { id: 'studypath', label: 'Study Path', icon: <BookIcon size={18} color="currentColor" /> },
    { id: 'achievements', label: 'Achievements', icon: <TargetIcon size={18} color="currentColor" /> },
    { id: 'leaderboard', label: 'Leaderboard', icon: <TargetIcon size={18} color="currentColor" /> },
    { id: 'challenges', label: 'Challenges', icon: <FireIcon size={18} color="currentColor" /> },
    { id: 'rewards', label: 'Rewards', icon: <TargetIcon size={18} color="currentColor" /> },
    { id: 'simulations', label: 'Simulation Lab', icon: <ToolsIcon size={18} color="currentColor" /> },
    { id: 'tools', label: 'Tools', icon: <ToolsIcon size={18} color="currentColor" /> }
  ];

  // Swipe navigation handlers
  const handleSwipeLeft = useCallback(() => {
    const currentIndex = tabs.findIndex(t => t.id === activeTab);
    if (currentIndex < tabs.length - 1) {
      setActiveTab(tabs[currentIndex + 1].id);
    }
  }, [activeTab, tabs]);

  const handleSwipeRight = useCallback(() => {
    const currentIndex = tabs.findIndex(t => t.id === activeTab);
    if (currentIndex > 0) {
      setActiveTab(tabs[currentIndex - 1].id);
    }
  }, [activeTab, tabs]);

  const { swipeHandlers } = useSwipeNavigation({
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    threshold: 50
  });

  // No AI-generated topic logic; just set latestTopic to selectedSubject
  useEffect(() => {
    setLatestTopic(selectedSubject);
  }, [selectedSubject]);

  const renderActiveTab = () => {
    switch (activeTab) {

      case 'quiz':
        return (
          <ErrorBoundary mini context="Quizzes">
            <QuizletStyle selectedSubject={selectedSubject} />
          </ErrorBoundary>
        );
      case 'assignments':
        return (
          <ErrorBoundary mini context="Assignments">
            <StudentAssignmentSubmit
              studentId={userData?.uid || user?.uid}
              classNumber={userData?.class || userData?.classNumber || '6'}
              subject={selectedSubject}
              schoolName={userData?.schoolName || ''}
            />
          </ErrorBoundary>
        );
      case 'grades':
        return (
          <ErrorBoundary mini context="My Grades">
            <GradedAssignments studentId={userData?.uid || user?.uid} schoolName={userData?.schoolName || ''} />
          </ErrorBoundary>
        );
      case 'announcements':
        return (
          <ErrorBoundary mini context="Announcements">
            <StudentAnnouncements userId={user?.uid} classNumber={userData?.class} schoolName={userData?.schoolName || ''} />
          </ErrorBoundary>
        );
      case 'todo':
        return (
          <ErrorBoundary mini context="Todo List">
            <div
              onClick={() => isGated ? window.dispatchEvent(new Event('open-astra')) : null}
              style={{
                background: isGated ? 'linear-gradient(135deg, rgba(30,27,75,0.7) 0%, rgba(88,28,135,0.7) 100%)' : 'rgba(16, 185, 129, 0.1)',
                border: isGated ? '1px solid rgba(139,92,246,0.32)' : '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '18px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                cursor: isGated ? 'pointer' : 'default',
                marginBottom: '24px',
                boxShadow: isGated ? '0 2px 6px rgba(0,0,0,0.4), 0 12px 32px rgba(139,92,246,0.20)' : 'none',
                transition: 'transform 0.2s ease',
              }}
              onMouseEnter={(e) => { if(isGated) e.currentTarget.style.transform = 'scale(1.02)' }}
              onMouseLeave={(e) => { if(isGated) e.currentTarget.style.transform = 'scale(1)' }}
            >
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: isGated ? 'radial-gradient(circle at center, rgba(167,139,250,0.4) 0%, transparent 70%)' : 'radial-gradient(circle at center, rgba(16, 185, 129, 0.4) 0%, transparent 70%)',
                boxShadow: isGated ? '0 0 20px rgba(167,139,250,0.4)' : '0 0 20px rgba(16, 185, 129, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{ fontSize: '22px' }}>{isGated ? '🎧' : '✅'}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#fff' }}>
                  {isGated ? 'ASTRA daily check-in' : 'ASTRA Check-in Completed'}
                </div>
                <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '2px', lineHeight: 1.4 }}>
                  {isGated ? "Open a private voice check-in to track today's mood" : "You've successfully completed your check-in for today."}
                </div>
              </div>
              {isGated && <div style={{ fontSize: '20px', color: '#a78bfa', paddingRight: '8px' }}>›</div>}
            </div>
            <TodoPanel allSubjects={true} />
          </ErrorBoundary>
        );
      case 'tools':
        return (
          <ErrorBoundary mini context="Tools">
            <ToolsPanel />
          </ErrorBoundary>
        );
      case 'simulations':
        return (
          <ErrorBoundary mini context="Simulation Lab">
            <StudentSimulationLab
              studentId={userData?.uid || user?.uid}
              studentName={userData?.username || userData?.name || 'Student'}
              classNumber={userData?.class || userData?.classNumber || '6'}
              schoolName={userData?.schoolName || ''}
            />
          </ErrorBoundary>
        );
      case 'notes':
        return (
          <ErrorBoundary mini context="My Notes">
            <MyNotes selectedSubject={selectedSubject} />
          </ErrorBoundary>
        );
      case 'achievements':
        return (
          <ErrorBoundary mini context="Achievements">
            <AchievementBadges />
          </ErrorBoundary>
        );
      case 'leaderboard':
        return (
          <ErrorBoundary mini context="Leaderboard">
            <Leaderboard schoolName={userData?.schoolName || ''} />
          </ErrorBoundary>
        );
      case 'challenges':
        return (
          <ErrorBoundary mini context="Daily Challenges">
            <DailyChallenges />
          </ErrorBoundary>
        );
      case 'rewards':
        return (
          <ErrorBoundary mini context="Rewards Store">
            <RewardsStore />
          </ErrorBoundary>
        );
      case 'studypath':
        return (
          <ErrorBoundary mini context="Study Path">
            <StudyPath selectedSubject={selectedSubject} />
          </ErrorBoundary>
        );
      default:
        return (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            backgroundColor: 'rgba(255,255,255,0.1)',
            borderRadius: '12px'
          }}>
            <p style={{ fontSize: '18px' }}>Select a tab to view content</p>
          </div>
        );
    }
  };

  return (
    <>
      <VideoBackground />
      <div style={styles.container} className="dashboard-bg">

        <header style={{ ...styles.header, ...themedStyles.header, color: themedStyles.text.primary }} className="header-responsive">

            <div style={styles.headerLeft}>
              <div style={styles.logoSection}>
                <AnimatedLogo variant="header" size={36} withWordmark={false} />
                <div>
                  <h1 style={themedStyles.goldenText}>TriSphere Student</h1>
                  <p style={{ ...styles.subtitle, color: themedStyles.text.muted }}>Learning Portal • <span style={{ color: '#60a5fa', fontWeight: '600' }}>Powered by Yugnext-AI</span></p>
                </div>
              </div>
            </div>

            <div style={{ ...styles.searchContainer, minWidth: '250px', flex: '0 0 auto', margin: '0 30px', zIndex: 1100 }}>
              <div style={styles.searchIcon}>
                <SearchIcon size={18} color="#94a3b8" />
              </div>
              <input
                type="text"
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => setShowSearchResults(searchResults.length > 0)}
                style={styles.searchInput}
              />
              <button 
                style={styles.goButton}
                onClick={handleGoSearch}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.filter = 'brightness(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.filter = 'brightness(1)';
                }}
              >
                GO
              </button>
              
              {showSearchResults && (
                <>
                  <div 
                    style={{ position: 'fixed', inset: 0, zIndex: 1000 }} 
                    onClick={() => setShowSearchResults(false)} 
                  />
                  <div style={{...styles.searchResultsDropdown, backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(59, 130, 246, 0.3)'}}>
                    {searchResults.map((student) => (
                      <div
                        key={student.id}
                        style={{...styles.searchResultItem, color: '#ffffff'}}
                        onClick={() => {
                          setSelectedStudent(student);
                          setShowStudentProfile(true);
                          setShowSearchResults(false);
                          setSearchQuery('');
                        }}
                      >
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', background: '#3b82f6' }}>
                          {student.photoUrl ? (
                            <img src={student.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>
                              {student.username?.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '14px' }}>{student.username}</div>
                          <div style={{ fontSize: '12px', opacity: 0.7 }}>Class {student.class} Student</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div style={styles.headerCenter} className="header-center-greeting">
              <div style={styles.greeting}>
                <span style={styles.greetingEmoji}>👋</span>
                <div>
                  <p style={{ ...styles.greetingText, color: themedStyles.text.primary }}>
                    {firstLogin ? 'Hello' : 'Welcome back'}, <strong>@{userData?.username || 'Student'}</strong>!
                  </p>
                  <p style={{ ...styles.classInfo, color: themedStyles.text.muted }}>Class {userData?.class || '6'} • {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>

                </div>
              </div>
            </div>

            <div style={styles.settingsContainer} className="settings-container">
              <button
                onClick={() => setShowSettings(!showSettings)}
                style={styles.settingsBtn}
                className="settings-icon-btn"
                aria-label="Open student settings menu"
                aria-expanded={showSettings}
                aria-haspopup="menu"
              >
                ⚙️
              </button>
              {isAllowedClass && (
                <button onClick={() => setShowAI(!showAI)} style={styles.todoBtn} className="ai-assistant-btn">
                  <AIIcon size={20} color="#ffffff" />
                  <span className="ai-btn-text" style={{ marginLeft: '6px' }}>Lernix AI</span>
                </button>
              )}
              {showSettings && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 999 }}
                    onClick={() => setShowSettings(false)}
                  />
                  <div style={styles.settingsDropdown}>
                    {/* Profile Identity Section */}
                    <div style={{ ...styles.settingsSection, textAlign: 'center', marginBottom: '20px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          padding: '4px',
                          borderRadius: '50%',
                          background: 'linear-gradient(45deg, #3b82f6, #8b5cf6)',
                          boxShadow: '0 0 20px rgba(139, 92, 246, 0.3)'
                        }}>
                          <ProfilePhoto size={70} editable={false} />
                        </div>
                        <div>
                          <div style={{ ...styles.settingsValue, fontSize: '18px', fontWeight: '700' }}>
                            {userData?.username || 'Student'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <span style={{ padding: '2px 8px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' }}>
                              Class {userData?.class || '6'}
                            </span>
                            {equippedAvatarName && (
                              <>
                                <span style={{ opacity: 0.5 }}>•</span>
                                <span style={{ color: '#fbbf24' }}>✨ {equippedAvatarName}</span>
                              </>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              setShowSettings(false);
                              setSelectedStudent({
                                id: user?.uid,
                                username: userData?.username,
                                class: userData?.class,
                                schoolName: userData?.schoolName,
                                profilePhoto: userData?.profilePhoto || userData?.photoUrl || null,
                                role: userData?.role
                              });
                              setShowStudentProfile(true);
                            }}
                            style={{
                              marginTop: '10px',
                              background: 'rgba(59, 130, 246, 0.1)',
                              border: '1px solid rgba(59, 130, 246, 0.2)',
                              color: '#60a5fa',
                              padding: '4px 12px',
                              borderRadius: '20px',
                              fontSize: '11px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              transition: 'all 0.2s'
                            }}
                          >
                            🏆 View Profile & Badges
                          </button>
                        </div>
                      </div>
                    </div>

                    <div style={styles.settingsDivider}></div>

                    {/* Workspace Tools Grid */}
                    <div style={styles.settingsSection}>
                      <div style={{ ...styles.settingsLabel, marginBottom: '12px' }}>Workspace Tools</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <button
                          onClick={() => {
                            setShowSettings(false);
                            setShowMessages(true);
                          }}
                          style={{
                            ...styles.feedbackBtn,
                            backgroundColor: 'rgba(139, 92, 246, 0.1)',
                            border: '1px solid rgba(139, 92, 246, 0.2)',
                            flexDirection: 'column',
                            padding: '16px 8px',
                            height: 'auto',
                            borderRadius: '16px'
                          }}
                        >
                          <span style={{ fontSize: '24px', marginBottom: '8px' }}>📬</span>
                          <span style={{ fontSize: '12px' }}>Messages</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowSettings(false);
                            setShowDiscussion(true);
                          }}
                          style={{
                            ...styles.feedbackBtn,
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            flexDirection: 'column',
                            padding: '16px 8px',
                            height: 'auto',
                            borderRadius: '16px'
                          }}
                        >
                          <span style={{ fontSize: '24px', marginBottom: '8px' }}>💬</span>
                          <span style={{ fontSize: '12px' }}>Discussions</span>
                        </button>
                      </div>
                    </div>

                    <div style={styles.settingsDivider}></div>

                    {/* Account & Security */}
                    <div style={styles.settingsSection}>
                      <div style={{ ...styles.settingsLabel, marginBottom: '8px' }}>Account & Security</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button
                          onClick={() => {
                            setShowSettings(false);
                            setShowAccountSettings(true);
                          }}
                          style={{
                            ...styles.feedbackBtn,
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            justifyContent: 'flex-start',
                            paddingLeft: '16px',
                            height: '45px',
                            borderRadius: '12px'
                          }}
                        >
                          📱 Phone & Password
                        </button>
                        <button
                          onClick={() => {
                            setShowSettings(false);
                            setShowPrivacyPolicy(true);
                          }}
                          style={{
                            ...styles.feedbackBtn,
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            justifyContent: 'flex-start',
                            paddingLeft: '16px',
                            height: '45px',
                            borderRadius: '12px'
                          }}
                        >
                          🛡️ Privacy Policy
                        </button>
                        <button
                          onClick={() => {
                            setShowSettings(false);
                            setShowFeedback(true);
                          }}
                          style={{
                            ...styles.feedbackBtn,
                            backgroundColor: 'rgba(121, 40, 202, 0.1)',
                            border: '1px solid rgba(121, 40, 202, 0.2)',
                            justifyContent: 'flex-start',
                            paddingLeft: '16px',
                            height: '45px',
                            borderRadius: '12px'
                          }}
                        >
                          📢 Share Feedback
                        </button>
                      </div>
                    </div>

                    <div style={styles.settingsDivider}></div>

                    {/* Session */}
                    <div style={{ marginTop: '10px' }}>
                      <button
                        onClick={handleLogout}
                        style={{
                          ...styles.logoutBtnDropdown,
                          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(220, 38, 38, 0.2))',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: '12px',
                          color: '#ef4444',
                          height: '45px'
                        }}
                      >
                        🔓 Logout Session
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </header>

        {/* Motivational Banner */}
        <div style={styles.motivationalBanner}>
          <span style={styles.motivationIcon}>{motivationalQuotes[currentQuote].icon}</span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <p style={styles.motivationText}>{motivationalQuotes[currentQuote].text}</p>
            <span style={{ fontSize: '12px', color: '#ffffff', fontStyle: 'italic' }}>
              — {motivationalQuotes[currentQuote].author}
            </span>
          </div>
        </div>

        {/* Assignment Due Date Reminders */}
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
          <AssignmentReminder subject={selectedSubject} />
        </div>

        {/* Stats Cards */}
        <div style={styles.statsContainer} className="stats-container">
          <div style={{ ...styles.statCard, ...themedStyles.statCard }} className="stat-card">
            <div style={styles.statIcon}><CheckCircleIcon size={28} color="#10b981" /></div>
            <div style={styles.statContent}>
              <div style={{ ...styles.statValue, color: themedStyles.text.primary }}>{stats.tasksCompleted}</div>
              <div style={{ ...styles.statLabel, color: themedStyles.text.muted }}>Tasks Done</div>
            </div>
          </div>
          <div style={{ ...styles.statCard, ...themedStyles.statCard }} className="stat-card">
            <div style={styles.statIcon}><TimerIcon size={28} color="#3b82f6" /></div>
            <div style={styles.statContent}>
              <div style={{ ...styles.statValue, color: themedStyles.text.primary }}>{stats.studyHours}h</div>
              <div style={{ ...styles.statLabel, color: themedStyles.text.muted }}>Study Time</div>
            </div>
          </div>
          <div style={{ ...styles.statCard, ...themedStyles.statCard }} className="stat-card">
            <div style={styles.statIcon}><TargetIcon size={28} color="#8b5cf6" /></div>
            <div style={styles.statContent}>
              <div style={{ ...styles.statValue, color: themedStyles.text.primary }}>{stats.averageScore}%</div>
              <div style={{ ...styles.statLabel, color: themedStyles.text.muted }}>Avg Score</div>
            </div>
          </div>
          <div style={{ ...styles.statCard, ...themedStyles.statCard }} className="stat-card">
            <div style={styles.statIcon}><FireIcon size={28} color="#f59e0b" /></div>
            <div style={styles.statContent}>
              <div style={{ ...styles.statValue, color: themedStyles.text.primary }}>{stats.streak}</div>
              <div style={{ ...styles.statLabel, color: themedStyles.text.muted }}>Day Streak</div>
            </div>
          </div>
        </div>

        {loading ? (
          <div style={styles.content}>
            <Skeleton.Dashboard cardCount={3} showTable={false} />
          </div>
        ) : (
          <div className="dashboard-content-scroll">
            {/* Stats Overview */}
            <div style={styles.content} className="dashboard-content-mobile">
              <SubjectList onSelectSubject={handleSelectSubject} studentClass={userData?.class} selectedSubject={selectedSubject} />


              {/* Modern Tab Navigation */}
              <div style={{ ...styles.tabNavigation, ...themedStyles.tabNavigation }} className="tab-navigation hide-on-mobile">
                  {tabs.map(tab => (
                    <button
                      key={tab.id}
                      data-tab={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      style={{
                        ...styles.tabButton,
                        ...(activeTab === tab.id ? themedStyles.buttonPrimary : themedStyles.buttonInactive),
                        color: activeTab === tab.id ? '#ffffff' : themedStyles.text.primary
                      }}
                    >
                      <span style={styles.tabIcon}>{tab.icon}</span>
                      <span style={styles.tabLabel}>{tab.label.replace(/^\S+\s/, '')}</span>
                    </button>
                  ))}
                </div>

              {/* Active Tab Content - Swipeable */}
              <div
                style={{ ...styles.tabContent, ...themedStyles.tabContent, position: 'relative' }}
                {...swipeHandlers}
              >
                {/* Gated UI Overlay */}
                {isGated && !astraLoading && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 50,
                    backdropFilter: 'blur(12px)',
                    backgroundColor: 'rgba(15, 23, 42, 0.4)',
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '32px',
                    textAlign: 'center',
                    border: '1px solid rgba(139, 92, 246, 0.3)'
                  }}>
                    <motion.img 
                      src="/photorealistic-lock.png" 
                      alt="Locked"
                      initial={{ scale: 0.95 }}
                      animate={{ 
                        scale: [0.95, 1.02, 0.95],
                      }}
                      transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                      style={{ 
                        width: '120px', 
                        height: '120px', 
                        objectFit: 'contain', 
                        marginBottom: '20px',
                        filter: 'drop-shadow(0 0 20px rgba(139, 92, 246, 0.45))'
                      }} 
                    />
                    <h3 style={{ color: '#ffffff', fontSize: '24px', fontWeight: '700', marginBottom: '12px' }}>ASTRA is waiting for you</h3>
                    <p style={{ color: '#cbd5e1', fontSize: '16px', marginBottom: '24px', maxWidth: '400px' }}>
                      Complete your daily check-in to unlock your tasks, notes, and quizzes for today.
                    </p>
                    <button
                      onClick={() => window.dispatchEvent(new Event('open-astra'))}
                      style={{
                        padding: '12px 24px',
                        background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '16px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)',
                        transition: 'transform 0.2s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      Talk to ASTRA to Unlock
                    </button>
                  </div>
                )}
                
                {/* Wrap the content to allow it to be blurred underneath */}
                <div style={{ 
                  filter: isGated && !astraLoading ? 'blur(4px) grayscale(0.5)' : 'none', 
                  pointerEvents: isGated && !astraLoading ? 'none' : 'auto',
                  opacity: isGated && !astraLoading ? 0.6 : 1,
                  transition: 'all 0.3s ease',
                  minHeight: isGated && !astraLoading ? '400px' : 'auto'
                }}>
                  {renderActiveTab()}
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Feedback Modal */}
      {
        showFeedback && (
          <div style={styles.feedbackModal}>
            <div style={styles.feedbackModalContent}>
              <div style={styles.feedbackModalHeader}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FeedbackIcon size={22} color="#10b981" /> Submit Feedback
                </h3>
                <button onClick={() => setShowFeedback(false)} style={styles.closeButton}>
                  <CloseIcon size={20} color="#ffffff" />
                </button>
              </div>
              <div style={styles.feedbackModalBody}>
                <p style={{ marginBottom: '10px', color: '#666' }}>We'd love to hear your thoughts and suggestions!</p>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Enter your feedback here..."
                  style={styles.feedbackTextarea}
                  rows={6}
                />
                <div style={styles.feedbackModalFooter}>
                  <button onClick={() => setShowFeedback(false)} style={styles.cancelButton}>
                    Cancel
                  </button>
                  <button
                    onClick={handleFeedbackSubmit}
                    disabled={feedbackSubmitting}
                    style={styles.submitButton}
                  >
                    {feedbackSubmitting ? 'Submitting...' : 'Submit Feedback'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Privacy Policy Modal */}
      {
        showPrivacyPolicy && (
          <PrivacyPolicy
            onAccept={handlePrivacyAccept}
            viewOnly={!!userData?.privacyAccepted}
          />
        )
      }

      {/* Messages Modal */}
      {
        showMessages && (
          <div style={styles.feedbackModal}>
            <div style={{ ...styles.feedbackModalContent, maxWidth: '700px' }}>
              <div style={styles.feedbackModalHeader}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MessageIcon size={22} color="#8b5cf6" /> My Messages
                </h3>
                <button onClick={() => setShowMessages(false)} style={styles.closeButton}>
                  <CloseIcon size={20} color="#ffffff" />
                </button>
              </div>
              <div style={{ ...styles.feedbackModalBody, maxHeight: '500px', overflowY: 'auto' }}>
                {loadingMessages ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                    Loading messages...
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                    <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>📭</p>
                    <p style={{ fontSize: '16px', fontWeight: 600 }}>No messages yet</p>
                    <p style={{ fontSize: '14px', marginTop: 8 }}>Messages from teachers and administrators will appear here</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {messages.map(message => (
                      <div
                        key={message.id}
                        style={{
                          padding: '16px',
                          background: message.read ? '#f9fafb' : 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(99, 102, 241, 0.1))',
                          borderRadius: '12px',
                          border: message.read ? '1px solid #e5e7eb' : '2px solid rgba(139, 92, 246, 0.3)',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease'
                        }}
                        onClick={() => !message.read && markMessageAsRead(message.id)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '14px', color: '#111827', marginBottom: '4px' }}>
                              From: {message.fromName || 'Admin'}
                            </div>
                            <div style={{ fontSize: '12px', color: '#6b7280' }}>
                              {message.timestamp?.toDate ? message.timestamp.toDate().toLocaleString() : 'Recently'}
                            </div>
                          </div>
                          {!message.read && (
                            <span style={{
                              background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                              color: 'white',
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '4px 8px',
                              borderRadius: '6px'
                            }}>
                              NEW
                            </span>
                          )}
                        </div>
                        <div style={{
                          fontSize: '14px',
                          color: '#374151',
                          lineHeight: '1.6',
                          whiteSpace: 'pre-wrap'
                        }}>
                          {message.message}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }

      {/* Discussion Forum Modal */}
      {
        showDiscussion && (
          <div style={styles.feedbackModal}>
            <div style={{ ...styles.feedbackModalContent, maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={styles.feedbackModalHeader}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ForumIcon size={22} color="#10b981" /> Discussion Forum
                </h3>
                <button onClick={() => setShowDiscussion(false)} style={styles.closeButton}>
                  <CloseIcon size={20} color="#ffffff" />
                </button>
              </div>
              <div style={{ ...styles.feedbackModalBody, maxHeight: 'calc(90vh - 80px)', overflowY: 'auto', padding: 0 }}>
                <DiscussionForum classNumber={userData?.class} subject={selectedSubject} />
              </div>
            </div>
          </div>
        )
      }

      {/* Lernix AI Modal — full-viewport overlay that catches clicks
          (closes on backdrop tap) and renders the chat as a fixed-height
          right-side panel so its internal scroll works. */}
      {
        (showAI && isAllowedClass) && (
          <div
            style={{ ...styles.feedbackModal, padding: isAiMaximized ? '0' : '20px', justifyContent: 'flex-end' }}
            onClick={() => setShowAI(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                ...styles.feedbackModalContent,
                maxWidth: isAiMaximized ? '100%' : '500px',
                width: '100%',
                // CRITICAL: a fixed height. The internal chat uses
                // `height: 100%` for its scroll region — that only works
                // if the parent has a real, non-auto height. Previously
                // this was `auto`, which is why nothing scrolled and the
                // panel grew unbounded.
                height: isAiMaximized ? '100vh' : '90vh',
                maxHeight: isAiMaximized ? '100vh' : '90vh',
                borderRadius: isAiMaximized ? '0' : '16px',
                margin: '0',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <div style={{ ...styles.feedbackModalHeader, borderRadius: isAiMaximized ? '0' : '16px 16px 0 0', flexShrink: 0 }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AIIcon size={24} color="#3b82f6" /> Lernix AI
                </h3>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <button onClick={() => setIsAiMaximized(!isAiMaximized)} style={{ ...styles.closeButton, background: 'none', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isAiMaximized ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      </svg>
                    )}
                  </button>
                  <button onClick={() => setShowAI(false)} style={styles.closeButton}>
                    <CloseIcon size={20} color="#ffffff" />
                  </button>
                </div>
              </div>
              <div style={{
                ...styles.feedbackModalBody,
                // flex:1 fills the rest of the modal vertically so the
                // chat's own scroller has a real height to work with.
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
                padding: 0,
              }}>
                <LernixAIChat isMaximized={isAiMaximized} />
              </div>
            </div>
          </div>
        )
      }

      {/* Account Settings Modal */}
      {
        (showAccountSettings && isAllowedClass) && (
          <AccountSettings onClose={() => setShowAccountSettings(false)} />
        )
      }


      {/* ASTRA — open-ended daily emotional check-in. Self-throttles via
          studentMoods/{uid}_{YYYY-MM-DD}, so this is safe to mount globally. */}
      <AstraCheckIn />

      
      {showStudentProfile && selectedStudent && (
        <StudentProfileModal 
          student={selectedStudent} 
          onClose={() => setShowStudentProfile(false)} 
        />
      )}
    </>
  );
};

// Styles are now imported from './studentDashboardStyles'
export default StudentDashboard;
