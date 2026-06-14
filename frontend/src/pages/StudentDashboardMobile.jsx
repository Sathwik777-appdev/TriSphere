import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, query, where, getDocs, limit, doc, getDoc, addDoc, updateDoc, onSnapshot, runTransaction } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { logoutUser } from '../services/authService';
import { LogoLoader } from '../components/AnimatedLogo';
import AnimatedLogo from '../components/AnimatedLogo';
import AstraCheckIn from '../components/AstraCheckIn';
import ErrorBoundary from '../components/ErrorBoundary';
import FloatingTimer from '../components/FloatingTimer';
import { colors } from '../styles/theme';
import { useBottomInset } from '../hooks/useBottomInset';
import {
  TaskIcon,
  BookIcon,
  QuizIcon,
  NotesIcon,
  AssignmentIcon,
  TargetIcon,
  FireIcon,
  SettingsIcon,
  TimerIcon,
  CheckCircleIcon,
  ProgressIcon,
  ToolsIcon,
  MessageIcon,
  ForumIcon,
  ShieldIcon,
  FeedbackIcon,
  LogoutIcon,
  AIIcon,
  SparklesIcon,
  ChevronRightIcon,
  SearchIcon,
} from '../components/Icons';
import { offlineDB, isOffline } from '../utils/offlineDB';
import { useOffline } from '../hooks/useOffline';
import { requestNotificationPermission } from '../services/notificationService';

// Tab content components — exact same components the desktop uses, so the
// data they read from Firestore is 1:1 synced.
import { LernixAIChatMobile } from '../components/LernixAIChatMobile';
import QuizletStyle from '../components/QuizletStyle';
import StudentAssignmentSubmit from '../components/StudentAssignmentSubmit';
import { MyNotes } from '../components/MyNotes';
import { UserSearchOverlay } from '../components/UserSearchOverlay';
import { RewardsStore } from '../components/RewardsStore';
import AchievementBadges from '../components/AchievementBadges';
import Leaderboard from '../components/Leaderboard';
import TodoPanel from '../components/TodoPanel';
import GradedAssignments from '../components/GradedAssignments';

import RevisionReminder from '../components/RevisionReminder';
import DailyChallenges from '../components/DailyChallenges';
import { ToolsPanel } from '../components/ToolsPanel';
import { AccountSettings } from '../components/AccountSettings';
import { PrivacyPolicy } from '../components/PrivacyPolicy';
import StudentSimulationLab from '../components/StudentSimulationLab';
import { StudentProfileModal } from '../components/StudentProfileModal';
import { successToast, warningToast, errorToast } from '../utils/toast';

import { logActivity } from '../services/firestoreService';

// Avatar bitmap assets — exact same set the desktop dashboard uses, so the
// student's chosen avatar from the Rewards store renders identically on
// both surfaces.
// Map the avatar ID stored in `userStore/{uid}.equippedItems.avatar` →
// the actual image asset + display name. Mirror of the desktop's map.
const AVATAR_IMAGES = {
  avatar_robot:     { img: '/avatars/robot.png',     name: 'Robot' },
  avatar_wizard:    { img: '/avatars/wizard.png',    name: 'Wizard' },
  avatar_astronaut: { img: '/avatars/astronaut.png', name: 'Astronaut' },
  avatar_ninja:     { img: '/avatars/ninja.png',     name: 'Ninja' },
  avatar_superhero: { img: '/avatars/superhero.png', name: 'Learn Hero' },
  avatar_alien:     { img: '/avatars/alien.png',     name: 'Space Explorer' },
  avatar_dragon:    { img: '/avatars/dragon.png',    name: 'Scholar Dragon' },
  avatar_unicorn:   { img: '/avatars/unicorn.png',   name: 'Magic Unicorn' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Student Dashboard — Mobile
//
// Goals
//  - Visual parity with desktop: same blue→indigo→purple palette, same data,
//    same Firestore reads (so a chat / mood / grade / assignment created on
//    desktop appears here instantly).
//  - 5-tab bottom nav (mobile-native) that GROUPS the desktop's 12 tabs:
//      Home    →  TODO + ASTRA + leaderboard preview
//      Learn   →  Notes / Quizzes / Assignments / Grades  (sub-tabs)
//      Lernix  →  Lernix AI Chat
//      Progress→  Achievements / Challenges / Study path / Revision
//      More    →  Rewards / Tools / Messages / Discussions / Leaderboard
//  - Photorealistic glass surfaces — frosted blur + multi-layer shadow +
//    inset top-edge highlight to mimic the way real glass catches light.
// ─────────────────────────────────────────────────────────────────────────────

// ──────────────────────── Design tokens ───────────────────────────────────────
const C = {
  bg: '#070912',                                            // deeper navy than desktop, makes glass pop
  text: '#f1f5f9',
  textDim: 'rgba(255, 255, 255, 0.82)',
  textMuted: 'rgba(255, 255, 255, 0.65)',
  blue: colors.accent.blue,      // #3b82f6
  indigo: colors.accent.indigo,  // #6366f1
  purple: colors.accent.purple,  // #8b5cf6
  success: colors.accent.success,
  warning: colors.accent.warning,
  danger: colors.accent.error,
};

// Photorealistic glass — frosted surface with a top highlight and a soft
// drop shadow. Used as a base style mixin throughout.
const GLASS = {
  base: 'linear-gradient(160deg, rgba(30, 41, 80, 0.55) 0%, rgba(15, 23, 42, 0.75) 100%)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  blur: 'blur(22px) saturate(180%)',
  // Layered shadow → ambient + direct light + brand glow + inset highlight
  shadow:
    '0 1px 1px rgba(255, 255, 255, 0.04) inset, ' +
    '0 -1px 1px rgba(0, 0, 0, 0.25) inset, ' +
    '0 2px 6px rgba(0, 0, 0, 0.35), ' +
    '0 16px 40px rgba(0, 0, 0, 0.30)',
  shadowBlue:
    '0 1px 1px rgba(255, 255, 255, 0.06) inset, ' +
    '0 -1px 1px rgba(0, 0, 0, 0.25) inset, ' +
    '0 2px 6px rgba(0, 0, 0, 0.35), ' +
    '0 16px 40px rgba(59, 130, 246, 0.16)',
};

const G = {
  primaryButton: 'linear-gradient(135deg, #3b82f6, #6366f1)',
  accentSheen: 'linear-gradient(120deg, #93c5fd 0%, #ffffff 35%, #c4b5fd 75%, #93c5fd 100%)',
  // Soft aurora orbs for the canvas
  auroraTop: 'radial-gradient(ellipse 60% 40% at 30% 0%, rgba(59,130,246,0.20) 0%, transparent 60%)',
  auroraBottom: 'radial-gradient(ellipse 70% 50% at 80% 100%, rgba(139,92,246,0.18) 0%, transparent 60%)',
  // Stat backgrounds — three brand-aligned tints (used in repeat)
  statBlue: 'linear-gradient(135deg, rgba(59, 130, 246, 0.20), rgba(37, 99, 235, 0.04))',
  statIndigo: 'linear-gradient(135deg, rgba(99, 102, 241, 0.20), rgba(79, 70, 229, 0.04))',
  statPurple: 'linear-gradient(135deg, rgba(139, 92, 246, 0.20), rgba(124, 58, 237, 0.04))',
  statAmber: 'linear-gradient(135deg, rgba(245, 158, 11, 0.20), rgba(217, 119, 6, 0.04))',
  astraCard: 'linear-gradient(135deg, rgba(139, 92, 246, 0.22), rgba(99, 102, 241, 0.10))',
};

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ─────────────────────────────────────────────────────────────────────────────
//   The main dashboard
// ─────────────────────────────────────────────────────────────────────────────
export default function StudentDashboardMobile() {
  const { user, userData } = useAuth();
  const { offline } = useOffline();
  // Top-level tab (matches the 5 nav buttons)
  const [activeTab, setActiveTab] = useState('home');
  // Tabs that have ever been visited — once a tab is in this set, it stays
  // mounted (just hidden via display:none when inactive). That preserves
  // scroll position, Firestore subscriptions, the Lernix chat thread, etc.
  // The home tab is pre-mounted because that's where everyone lands.
  const [mountedTabs, setMountedTabs] = useState(() => new Set(['home']));
  // Live-measured bottom inset that clears the device's system nav (iOS
  // home indicator, Android gesture pill, or 3-button bar). Recomputes on
  // viewport changes so the nav follows when the system bar hides/shows.
  const bottomInset = useBottomInset(12);

  // Lock body scroll while dashboard is mounted
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalOverscroll = document.body.style.overscrollBehavior;
    document.body.style.setProperty('overflow', 'hidden', 'important');
    document.body.style.setProperty('overscroll-behavior', 'none', 'important');
    if (!document.getElementById('connectivity-banner-styles')) {
      const styleSheet = document.createElement('style');
      styleSheet.id = 'connectivity-banner-styles';
      styleSheet.textContent = `
        @keyframes slideDown {
          from { transform: translateY(-100%); }
          to { transform: translateY(0); }
        }
      `;
      document.head.appendChild(styleSheet);
    }
    
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.overscrollBehavior = originalOverscroll;
    };
  }, []);

  // Learn tab: subject-first navigation.
  //   learnView      → which screen inside Learn is showing
  //   expandedSubject → which subject card is currently expanded
  // User lands on the subjects list, taps a subject to expand its dropdown
  // (Notes / Assignments / Quizzes), then taps one to enter that view.
  const [learnView, setLearnView] = useState('subjects'); // subjects | notes | assignments | quizzes | grades
  const [expandedSubject, setExpandedSubject] = useState(null);
  const [progressSubtab, setProgressSubtab] = useState('achievements');

  const [loading, setLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState('');
  // Equipped avatar — sourced from `userStore/{uid}.equippedItems.avatar`,
  // same as the desktop dashboard. `null` means "no avatar equipped" → show
  // the initial-letter fallback in the settings drawer.
  const [equippedAvatar, setEquippedAvatar] = useState(null);
  const [equippedAvatarName, setEquippedAvatarName] = useState('');

  // Modal toggles for the Settings drawer rows.
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showStudentProfile, setShowStudentProfile] = useState(false);

  // ASTRA Gating State
  const [isGated, setIsGated] = useState(true);
  const [astraLoading, setAstraLoading] = useState(true);

  // Push Notification State
  const [showNotificationBanner, setShowNotificationBanner] = useState(false);

  useEffect(() => {
    // Only show if the browser supports notifications and they haven't explicitly denied
    if ('Notification' in window && Notification.permission === 'default') {
      setShowNotificationBanner(true);
    }
  }, []);

  const handleEnableNotifications = async () => {
    if (user?.uid) {
      const success = await requestNotificationPermission(user.uid);
      if (success) {
        setShowNotificationBanner(false);
      } else {
        // Even if false (e.g. user denied), we should hide the banner
        setShowNotificationBanner(false);
      }
    }
  };

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

  // Data state — mirrors the desktop's reads
  const [tasks, setTasks] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [todayMood, setTodayMood] = useState(null);
  const [calculatedStreak, setCalculatedStreak] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  // Bumping this counter re-runs the data-fetch effect. Used by the
  // visibility / focus / online listeners below to refresh data whenever
  // the user returns to the app — so new assignments, graded work, mood
  // entries, etc. appear without a manual refresh.
  const [refreshSignal, setRefreshSignal] = useState(0);
  const lastFetchAtRef = useRef(0);
  // Min interval between auto-refreshes (in ms). 60s strikes a balance
  // between "feels live" and "doesn't burn Firestore reads on quick tab
  // swaps". A first-load fetch always goes through regardless.
  const AUTO_REFRESH_THROTTLE_MS = 60 * 1000;

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
            setCalculatedStreak(newStreak);
          } else {
            setCalculatedStreak(newStreak);
          }
        }
      });
    } catch (err) {
      console.error('Error syncing streak:', err);
    }
  };

  const hasLoggedVisit = useRef(false);

  // Log session visit once per mount on mobile, calculate and sync streak to Firestore
  useEffect(() => {
    if (user?.uid && userData && !hasLoggedVisit.current) {
      hasLoggedVisit.current = true;
      logActivity(user.uid, null, 'dashboard_visit').then(async () => {
        await syncStreak(user.uid);
      }).catch(console.error);
    }
  }, [user?.uid, userData]);

  const isAllowedClass = useMemo(() => {
    const uClass = String(userData?.class || userData?.classNumber || '');
    return ['8', '9', '10', 8, 9, 10].includes(uClass);
  }, [userData]);

  // ── Data fetch — runs on mount AND whenever refreshSignal bumps ─────────
  // First mount: refreshSignal === 0, runs immediately.
  // Subsequent runs: triggered by visibility/focus/online listeners (below).
  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      if (!user?.uid) return;
      lastFetchAtRef.current = Date.now();
      try {
        const uid = user.uid;
        const uClass = parseInt(userData?.class || userData?.classNumber || '10');

        // Mood (today)
        const moodSnap = await getDoc(doc(db, 'studentMoods', `${uid}_${todayKey()}`));
        if (!cancelled) {
          if (moodSnap.exists()) setTodayMood(moodSnap.data().emotion);
        }

        // Pending assignments — same query as desktop's TodoPanel
        const assignQ = query(collection(db, 'assignments'), where('class', '==', uClass), limit(5));
        const assignSnap = await getDocs(assignQ);
        const assignmentIds = assignSnap.docs.map(d => d.id);
        
        let subSnapDocs = [];
        if (assignmentIds.length > 0) {
          const subQ = query(
            collection(db, 'studentSubmissions'),
            where('studentId', '==', uid),
            where('assignmentId', 'in', assignmentIds)
          );
          const subSnap = await getDocs(subQ);
          subSnapDocs = subSnap.docs;
        }
        const submittedIds = subSnapDocs.map(d => d.data().assignmentId);
        const pending = assignSnap.docs
          .filter(d => !submittedIds.includes(d.id))
          .map(d => ({ id: d.id, ...d.data() }));
        if (!cancelled) setTasks(pending);

        // Subject discovery — a subject appears in the Learn tab if ANY of:
        //   • a textbook chapter exists (notes)
        //   • AI-generated content exists (quizzes / additional notes)
        //   • an assignment exists
        // ...has been uploaded for this class. Reading only `textbooks` (the
        // previous behaviour) caused subjects with only quizzes or only
        // assignments to disappear from the picker.
        let textbookDocs = [];
        let aiDocs = [];

        if (isOffline()) {
          try {
            const allTextbooks = await offlineDB.getAll('textbooks');
            textbookDocs = allTextbooks.filter(book => String(book.class) === String(uClass));
          } catch (e) {
            console.error('Failed to load cached textbooks:', e);
          }
        } else {
          try {
            const [textbookSnap, aiSnap] = await Promise.all([
              getDocs(query(collection(db, 'textbooks'),         where('class', '==', uClass), limit(50))),
              getDocs(query(collection(db, 'aiGeneratedContent'), where('class', '==', uClass), limit(50))),
            ]);
            textbookDocs = textbookSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            aiDocs = aiSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            for (const book of textbookDocs) {
              await offlineDB.saveTextbook(book);
            }
          } catch (e) {
            console.error('Failed to fetch online textbooks/AI content:', e);
          }
        }

        const subSet = new Set();
        textbookDocs.forEach(d => { const s = d.subject; if (s) subSet.add(s); });
        aiDocs.forEach(d       => { const s = d.subject; if (s) subSet.add(s); });
        // Already-fetched `assignSnap` from the pending-assignments query
        // (line above) — reuse it instead of re-querying.
        assignSnap.forEach(d   => { const s = d.data().subject; if (s) subSet.add(s); });

        // De-dup case-insensitively (so "Physics" and "physics" merge),
        // keeping the prettiest casing we see.
        const byLower = new Map();
        Array.from(subSet).forEach(s => {
          const k = s.toLowerCase().trim();
          if (!byLower.has(k)) byLower.set(k, s);
        });
        const subList = Array.from(byLower.values()).sort();

        if (!cancelled) {
          setSubjects(subList);
          if (subList.length > 0 && !selectedSubject) setSelectedSubject(subList[0]);
        }

        // Unread messages count (used for the "More" tile badge)
        try {
          const msgQ = query(
            collection(db, 'messages'),
            where('recipientId', '==', uid),
            where('read', '==', false),
            limit(50),
          );
          const msgSnap = await getDocs(msgQ);
          if (!cancelled) setUnreadMessages(msgSnap.size);
        } catch (e) { /* not critical */ }

        setTimeout(() => { if (!cancelled) setLoading(false); }, 500);
      } catch (err) {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    const timer = setTimeout(() => setLoading(false), 5000);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, userData, refreshSignal]);

  // ── Auto-refresh on tab visibility / window focus / network re-online ──
  // When the user returns to the app (switched apps, locked phone, swapped
  // tabs, regained network), we silently re-fetch their data so anything
  // a teacher or admin changed while they were away appears immediately —
  // no manual pull-to-refresh needed.
  // Throttled to once every AUTO_REFRESH_THROTTLE_MS (60s) so quick
  // back-and-forth tab swaps don't burn Firestore reads.
  useEffect(() => {
    const trigger = () => {
      if (!user?.uid) return;
      const since = Date.now() - lastFetchAtRef.current;
      if (since < AUTO_REFRESH_THROTTLE_MS) return; // recently fetched, skip
      setRefreshSignal(n => n + 1);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') trigger();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', trigger);
    window.addEventListener('online', trigger);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', trigger);
      window.removeEventListener('online', trigger);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // Fetch the student's equipped avatar from `userStore/{uid}`. Re-runs
  // when the user opens the settings drawer in case they just bought a new
  // one from the Rewards store inside the same session.
  useEffect(() => {
    let cancelled = false;
    const fetchEquippedAvatar = async () => {
      if (!user?.uid) return;
      try {
        const storeDoc = await getDoc(doc(db, 'userStore', user.uid));
        if (cancelled) return;
        if (storeDoc.exists()) {
          const avatarId = storeDoc.data().equippedItems?.avatar;
          if (avatarId && AVATAR_IMAGES[avatarId]) {
            setEquippedAvatar(AVATAR_IMAGES[avatarId].img);
            setEquippedAvatarName(AVATAR_IMAGES[avatarId].name);
            return;
          }
        }
        // No userStore doc / no avatar equipped → show initial-letter fallback
        setEquippedAvatar(null);
        setEquippedAvatarName('');
      } catch (err) {
        console.warn('Equipped avatar fetch failed', err);
      }
    };
    fetchEquippedAvatar();
    return () => { cancelled = true; };
  }, [user?.uid, isSettingsOpen]);

  // Register every primary tab the user visits — once mounted, it stays
  // alive (just hidden) so coming back is instant with no refetch / no
  // reload of the underlying child components.
  useEffect(() => {
    const primary = ['home', 'learn', 'lernix', 'more'];
    if (primary.includes(activeTab) && !mountedTabs.has(activeTab)) {
      setMountedTabs(prev => new Set([...prev, activeTab]));
    }
  }, [activeTab, mountedTabs]);

  if (loading) {
    return (
      <div style={S.loaderPage}>
        <LogoLoader label="Syncing your progress…" />
      </div>
    );
  }

  // ── Derived stats — matches desktop's 4 stat cards EXACTLY ──────────────
  const stats = {
    tasksCompleted: userData?.stats?.tasksCompleted || 0,
    averageScore:   userData?.stats?.averageScore || 0,
    streak:         calculatedStreak || userData?.stats?.streak || 0,
  };
  // Study time = tasksCompleted × 30 min, rounded up to hours (same as desktop)
  const studyHours = Math.ceil((stats.tasksCompleted * 30) / 60);

  // Defensive: handle null / undefined / empty / whitespace-only username so
  // the greeting NEVER renders as "Hi," with no name after it.
  const firstName = (() => {
    const raw = (userData?.username || userData?.name || user?.displayName || '').trim();
    const first = raw.split(' ')[0];
    return first || 'Student';
  })();
  const moodGreeting =
    todayMood === 'low' ? 'Take it easy today 🤍'
    : todayMood === 'high' ? "Big energy today — let's use it"
    : 'Welcome back';

  const handleLogout = async () => {
    try { await logoutUser(); } catch (e) { console.error('Logout failed:', e); }
  };

  // Privacy policy — marks the user's profile as having accepted on submit,
  // matching the desktop's handlePrivacyAccept flow.
  const handlePrivacyAccept = async () => {
    try {
      if (user?.uid) {
        await updateDoc(doc(db, 'users', user.uid), { privacyAccepted: true });
      }
      successToast('Privacy Policy accepted');
    } catch (err) {
      console.warn('Privacy accept failed', err);
    } finally {
      setShowPrivacyPolicy(false);
    }
  };

  // Feedback — writes to the `feedback` collection (same schema desktop uses)
  const handleFeedbackSubmit = async () => {
    const trimmed = feedbackText.trim();
    if (!trimmed) {
      warningToast('Please enter your feedback');
      return;
    }
    setFeedbackSubmitting(true);
    try {
      await addDoc(collection(db, 'feedback'), {
        userId: user.uid,
        userName: userData?.username || 'Unknown',
        userRole: 'student',
        userClass: userData?.class,
        feedback: trimmed,
        timestamp: new Date(),
        email: userData?.email || user.email,
      });
      successToast('Thank you for your feedback!');
      setFeedbackText('');
      setShowFeedback(false);
    } catch (err) {
      console.error('Error submitting feedback:', err);
      errorToast('Could not submit feedback. Please try again.');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  // Tab titles for the compact header
  const tabTitles = {
    home: '',
    learn: 'Learn',
    lernix: 'Lernix AI',
    progress: 'Your progress',
    more: 'More',
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Per-tab content renderers
  // ─────────────────────────────────────────────────────────────────────────
  const renderHome = () => (
    <motion.div key="home" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
      {/* Today's tasks — uses the SAME TodoPanel desktop uses → instant data parity */}
      <SectionHead
        title="Today's tasks"
        action="View all"
        onAction={() => { setLearnView('assignments'); setActiveTab('learn'); }}
      />
      <GlassCard padding={0}>
        <ErrorBoundary mini context="Todo List">
          <TodoPanel
            selectedSubject="All"
            allSubjects={true}
            onNavigate={(tab) => {
              // Bridge desktop-style tab names → mobile Learn views.
              setActiveTab('learn');
              if (tab === 'assignments') setLearnView('assignments');
              else if (tab === 'quiz')    setLearnView('quizzes');
            }}
          />
        </ErrorBoundary>
      </GlassCard>

      {/* ASTRA daily check-in card */}
      <motion.div
        whileTap={isGated ? { scale: 0.98 } : {}}
        onClick={() => isGated ? window.dispatchEvent(new CustomEvent('open-astra')) : null}
        style={{
          ...S.astraCard,
          marginTop: 24,
          background: isGated ? S.astraCard.background : 'rgba(16, 185, 129, 0.1)',
          border: isGated ? S.astraCard.border : '1px solid rgba(16, 185, 129, 0.3)',
          boxShadow: isGated ? S.astraCard.boxShadow : 'none'
        }}
      >
        <div style={S.astraGlow}><span style={{ fontSize: 22 }}>💜</span></div>
        <div style={{ flex: 1 }}>
          <div style={S.astraTitle}>{isGated ? 'ASTRA daily check-in' : 'ASTRA Check-in Completed'}</div>
          <div style={S.astraSub}>{isGated ? "Open a private voice check-in to track today's mood" : "You've successfully completed your check-in for today."}</div>
        </div>
        <ChevronRightIcon size={20} color={C.purple} />
      </motion.div>

      {/* Daily challenges — compact */}
      <SectionHead title="Today's challenges" />
      <GlassCard>
        <ErrorBoundary mini context="Daily Challenges">
          <DailyChallenges compact={true} />
        </ErrorBoundary>
      </GlassCard>

    </motion.div>
  );

  // Open a content view for a specific subject (or all-subjects fallback).
  const enterLearnView = (view, subject) => {
    if (subject) setSelectedSubject(subject);
    setLearnView(view);
  };

  const renderLearn = () => {
    // ── Content views (Notes / Assignments / Quizzes / Grades) ──
    if (learnView !== 'subjects') {
      const contentTitle = {
        notes:       selectedSubject ? `${selectedSubject} · Notes` : 'Notes',
        assignments: selectedSubject ? `${selectedSubject} · Assignments` : 'Assignments',
        quizzes:     selectedSubject ? `${selectedSubject} · Quizzes` : 'Quizzes',
        simulations: selectedSubject ? `${selectedSubject} · Simulations` : 'Simulations',
        grades:      'My grades',
      }[learnView];

      return (
        <motion.div
          key={`learn-${learnView}`}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <BackChip
            onClick={() => setLearnView('subjects')}
            label="Back to subjects"
          />
          {contentTitle && (
            <h3 style={S.contentTitle}>{contentTitle}</h3>
          )}
          <GlassCard padding={0}>
            {learnView === 'notes' && (
              <ErrorBoundary mini context="Chapter Notes">
                <MyNotes selectedSubject={selectedSubject || subjects[0] || 'General'} />
              </ErrorBoundary>
            )}
            {learnView === 'assignments' && (
              <ErrorBoundary mini context="Assignment Submit">
                <StudentAssignmentSubmit
                  studentId={user?.uid}
                  classNumber={userData?.class || '10'}
                  subject={selectedSubject || subjects[0] || 'General'}
                  schoolName={userData?.schoolName || ''}
                />
              </ErrorBoundary>
            )}
            {learnView === 'quizzes' && (
              <ErrorBoundary mini context="Quizzes">
                <QuizletStyle selectedSubject={selectedSubject || subjects[0] || 'General'} />
              </ErrorBoundary>
            )}
            {learnView === 'simulations' && (
              <ErrorBoundary mini context="Simulation Lab">
                <StudentSimulationLab
                  studentId={user?.uid}
                  studentName={userData?.username || userData?.name || 'Student'}
                  classNumber={userData?.class || '10'}
                  subject={selectedSubject}
                  schoolName={userData?.schoolName || ''}
                />
              </ErrorBoundary>
            )}
            {learnView === 'grades' && (
              <ErrorBoundary mini context="Grades View">
                <GradedAssignments studentId={user?.uid} schoolName={userData?.schoolName || ''} />
              </ErrorBoundary>
            )}
          </GlassCard>
        </motion.div>
      );
    }

    // ── Subjects list view (initial) ──
    return (
      <motion.div
        key="learn-subjects"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <SectionHead title="Your subjects" />
        <div style={S.subjectList}>
          {subjects.length > 0 ? subjects.map(s => (
            <SubjectAccordion
              key={s}
              name={s}
              expanded={expandedSubject === s}
              onToggle={() => setExpandedSubject(prev => prev === s ? null : s)}
              onPickNotes={()       => enterLearnView('notes', s)}
              onPickAssignments={() => enterLearnView('assignments', s)}
              onPickQuizzes={()     => enterLearnView('quizzes', s)}
              onPickSimulations={() => enterLearnView('simulations', s)}
            />
          )) : <Empty text="No subjects yet — your teacher will add them soon." />}
        </div>

        {/* Grades — separate global view, not tied to one subject */}
        <SectionHead title="Performance" />
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => setLearnView('grades')}
          style={S.gradesTile}
        >
          <span style={S.gradesTileIcon}>
            <CheckCircleIcon size={26} color={C.success} />
          </span>
          <div style={S.gradesTileText}>
            <span style={S.gradesTileTitle}>My grades</span>
            <span style={S.gradesTileDesc}>See teacher feedback on submitted work</span>
          </div>
          <ChevronRightIcon size={18} color={C.textMuted} />
        </motion.button>
      </motion.div>
    );
  };

  const renderProgress = () => (
    <motion.div key="progress" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
      <SubTabBar
        active={progressSubtab}
        onChange={setProgressSubtab}
        tabs={[
          { key: 'achievements', label: 'Badges', icon: <SparklesIcon size={16} color="currentColor" /> },
          { key: 'challenges',   label: 'Challenges', icon: <FireIcon size={16} color="currentColor" /> },

        ]}
      />

      <AnimatePresence mode="wait">
        {progressSubtab === 'achievements' && (
          <motion.div key="ach" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <GlassCard>
              <ErrorBoundary mini context="Badges">
                <AchievementBadges />
              </ErrorBoundary>
            </GlassCard>
          </motion.div>
        )}
        {progressSubtab === 'challenges' && (
          <motion.div key="chal" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <GlassCard padding={0}>
              <ErrorBoundary mini context="Challenges">
                <DailyChallenges />
              </ErrorBoundary>
            </GlassCard>
          </motion.div>
        )}


      </AnimatePresence>
    </motion.div>
  );

  const renderMore = () => (
    <motion.div key="more" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
      <SectionHead title="Quick actions" />
      <div style={S.actionGrid}>
        <ActionTile
          icon={<ProgressIcon size={22} color={C.success} />}
          tint="linear-gradient(135deg, rgba(16, 185, 129, 0.20), rgba(5, 150, 105, 0.04))"
          label="Progress"
          desc="Badges & challenges"
          onClick={() => setActiveTab('more-progress')}
        />
        <ActionTile
          icon={<TargetIcon size={22} color={C.purple} />}
          tint={G.statPurple}
          label="Rewards store"
          desc="Spend your XP"
          onClick={() => setActiveTab('more-rewards')}
        />
        <ActionTile
          icon={<ToolsIcon size={22} color={C.indigo} />}
          tint={G.statIndigo}
          label="Tools"
          desc="Study calculators"
          onClick={() => setActiveTab('more-tools')}
        />
        <ActionTile
          icon={<MessageIcon size={22} color={C.blue} />}
          tint={G.statBlue}
          label="Messages"
          desc="From teachers"
          badge={unreadMessages || null}
          onClick={() => setActiveTab('more-messages')}
        />
        <ActionTile
          icon={<ForumIcon size={22} color={C.success} />}
          tint="linear-gradient(135deg, rgba(16, 185, 129, 0.20), rgba(5, 150, 105, 0.04))"
          label="Discussions"
          desc="Class forum"
          onClick={() => setActiveTab('more-forum')}
        />
        <ActionTile
          icon={<SparklesIcon size={22} color={C.warning} />}
          tint={G.statAmber}
          label="Leaderboard"
          desc="Class ranking"
          onClick={() => setActiveTab('more-leaderboard')}
        />
        <ActionTile
          icon={<SettingsIcon size={22} color="#94a3b8" />}
          tint="linear-gradient(135deg, rgba(148, 163, 184, 0.18), rgba(71, 85, 105, 0.04))"
          label="Settings"
          desc="Account & privacy"
          onClick={() => setIsSettingsOpen(true)}
        />
      </div>
    </motion.div>
  );

  // Sub-pages inside More — each is just a different value of activeTab
  const renderMoreProgress = () => (
    <motion.div key="mr-progress" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <BackChip onClick={() => setActiveTab('more')} label="Back to more" />
      {renderProgress()}
    </motion.div>
  );

  const renderMoreRewards = () => (
    <motion.div key="mr-rewards" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <BackChip onClick={() => setActiveTab('more')} label="Back to more" />
      <ErrorBoundary mini context="Rewards Store">
        <RewardsStore />
      </ErrorBoundary>
    </motion.div>
  );

  const renderMoreTools = () => (
    <motion.div key="mr-tools" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <BackChip onClick={() => setActiveTab('more')} label="Back to more" />
      <GlassCard padding={0}>
        <ErrorBoundary mini context="Tools Panel">
          <ToolsPanel />
        </ErrorBoundary>
      </GlassCard>
    </motion.div>
  );

  const renderMoreLeaderboard = () => (
    <motion.div key="mr-lead" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <BackChip onClick={() => setActiveTab('more')} label="Back to more" />
      <GlassCard padding={0}>
        <ErrorBoundary mini context="Leaderboard">
          <Leaderboard compact={false} />
        </ErrorBoundary>
      </GlassCard>
    </motion.div>
  );

  const renderMoreMessages = () => (
    <motion.div key="mr-msg" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <BackChip onClick={() => setActiveTab('more')} label="Back to more" />
      <ComingSoon
        icon={<MessageIcon size={42} color={C.blue} />}
        title="Messages"
        desc="Inbox for messages from your teachers will appear here."
      />
    </motion.div>
  );

  const renderMoreForum = () => (
    <motion.div key="mr-forum" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <BackChip onClick={() => setActiveTab('more')} label="Back to more" />
      <ComingSoon
        icon={<ForumIcon size={42} color={C.success} />}
        title="Class discussions"
        desc="Open a thread, ask a doubt — your classmates and teachers can chime in."
      />
    </motion.div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  const isHome = activeTab === 'home';
  const isLernix = activeTab === 'lernix';

  return (
    <div style={S.container}>
      {offline && (
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          background: 'hsla(350, 80%, 55%, 0.15)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid hsla(350, 80%, 55%, 0.3)',
          color: '#fca5a5',
          padding: '10px 16px',
          textAlign: 'center',
          fontSize: '13px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
          animation: 'slideDown 0.3s ease-out'
        }}>
          <span style={{ fontSize: '15px' }}>📵</span>
          <span>Offline Mode Active. Cached content is loaded.</span>
        </div>
      )}

      {showNotificationBanner && !offline && (
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 999,
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          color: 'white',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
          animation: 'slideDown 0.3s ease-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
            <span style={{ fontSize: '18px' }}>🔔</span>
            <span style={{ fontSize: '13px', fontWeight: '500', lineHeight: 1.4 }}>
              Enable notifications to get daily ASTRA and deadline reminders!
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => setShowNotificationBanner(false)}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.3)',
                color: 'white',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600'
              }}
            >
              Later
            </button>
            <button 
              onClick={handleEnableNotifications}
              style={{
                background: 'white',
                border: 'none',
                color: '#2563eb',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '700'
              }}
            >
              Enable
            </button>
          </div>
        </div>
      )}

      {/* Background — twin aurora orbs + subtle radial wash */}
      <div style={S.bgWashTop} aria-hidden />
      <div style={S.bgWashBottom} aria-hidden />
      <div style={S.grainOverlay} aria-hidden />

      <ErrorBoundary context="AstraCheckIn">
        <AstraCheckIn />
      </ErrorBoundary>

      {/* Pomodoro floating widget — appears top-right whenever the study
          timer is running, draggable, dismissible. Rendered here at the
          dashboard root so it persists across every tab. */}
      <FloatingTimer />

      {/* ── Account Settings modal (Phone & Password) ─────────────────── */}
      {showAccountSettings && isAllowedClass && (
        <AccountSettings onClose={() => setShowAccountSettings(false)} />
      )}

      {/* ── User search overlay ───────────────────────────────────────── */}
      <UserSearchOverlay
        open={showUserSearch}
        onClose={() => setShowUserSearch(false)}
      />

      {/* ── Privacy Policy modal ──────────────────────────────────────── */}
      {showPrivacyPolicy && (
        <PrivacyPolicy
          onAccept={handlePrivacyAccept}
          viewOnly={!!userData?.privacyAccepted}
        />
      )}

      {/* ── Student Profile Modal ────────────────────────────────────── */}
      {showStudentProfile && selectedStudent && (
        <StudentProfileModal
          student={selectedStudent}
          onClose={() => setShowStudentProfile(false)}
        />
      )}

      {/* ── Feedback modal — mobile-native bottom sheet ───────────────── */}
      <AnimatePresence>
        {showFeedback && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={S.feedbackBackdrop}
            onClick={(e) => { if (e.target === e.currentTarget) setShowFeedback(false); }}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 280 }}
              style={S.feedbackSheet}
            >
              <div style={S.feedbackGrabber} />
              <div style={S.feedbackHead}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <h3 style={S.feedbackTitle}>Share feedback</h3>
                  <p style={S.feedbackSub}>What can we improve? Tell us anything.</p>
                </div>
                <button onClick={() => setShowFeedback(false)} style={S.feedbackClose} aria-label="Close">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M6 6l12 12M6 18L18 6" />
                  </svg>
                </button>
              </div>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Type your thoughts here…"
                rows={5}
                style={S.feedbackTextarea}
                autoFocus
              />
              <button
                onClick={handleFeedbackSubmit}
                disabled={feedbackSubmitting || !feedbackText.trim()}
                style={{
                  ...S.feedbackSubmit,
                  opacity: feedbackSubmitting || !feedbackText.trim() ? 0.6 : 1,
                  cursor: feedbackSubmitting ? 'wait' : 'pointer',
                }}
              >
                {feedbackSubmitting ? 'Sending…' : 'Send feedback'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Settings drawer ────────────────────────────────────────────── */}
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            style={S.settingsOverlay}
          >
            <button onClick={() => setIsSettingsOpen(false)} className="close-settings-btn" aria-label="Close settings">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M6 6l12 12M6 18L18 6" />
              </svg>
            </button>

            <div style={S.settingsHeader}>
              <AnimatedLogo variant="header" size={28} withWordmark={false} />
            </div>

            <div style={S.profileSection}>
              {/* Swipeable Instagram-style profile carousel:
                  • Slide 1: real profile photo (from users/{uid}.photoUrl,
                    uploadable only by admin) — falls back to initial letter
                  • Slide 2: equipped gamification avatar (Robot, Wizard, etc.)
                  Swipe left/right to switch, or tap the dot indicators below. */}
              <SwipeableProfile
                photoUrl={userData?.photoUrl}
                firstName={firstName}
                avatar={equippedAvatar}
                avatarName={equippedAvatarName}
                size={108}
              />

              <h2 style={S.settingsName}>{userData?.username || 'Student'}</h2>

              <div style={S.badgeRow}>
                <span style={S.classBadge}>Class {userData?.class || '10'}</span>
                <span style={S.schoolBadge}>{userData?.schoolName || 'School'}</span>
              </div>

              <button
                onClick={() => {
                  setIsSettingsOpen(false);
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
                  marginTop: '12px',
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  color: '#60a5fa',
                  padding: '6px 16px',
                  borderRadius: '20px',
                  fontSize: '12px',
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

            <div style={S.settingsGroup}>
              <h3 style={S.groupLabel}>Workspace</h3>
              <SettingsRow icon={<MessageIcon size={18} color={C.blue} />}    label="Messages"          onClick={() => { setIsSettingsOpen(false); setActiveTab('more-messages'); }} />
              <SettingsRow icon={<ForumIcon size={18} color={C.success} />}   label="Class discussions" onClick={() => { setIsSettingsOpen(false); setActiveTab('more-forum'); }} />
            </div>

            <div style={S.settingsGroup}>
              <h3 style={S.groupLabel}>Account</h3>
              {isAllowedClass && (
                <SettingsRow
                  icon={<SettingsIcon size={18} color="#cbd5e1" />}
                  label="Phone & Password"
                  onClick={() => { setIsSettingsOpen(false); setShowAccountSettings(true); }}
                />
              )}
              <SettingsRow
                icon={<ShieldIcon size={18} color={C.indigo} />}
                label="Privacy Policy"
                onClick={() => { setIsSettingsOpen(false); setShowPrivacyPolicy(true); }}
              />
              <SettingsRow
                icon={<FeedbackIcon size={18} color={C.purple} />}
                label="Share Feedback"
                onClick={() => { setIsSettingsOpen(false); setShowFeedback(true); }}
              />
            </div>

            <button style={S.logoutBtn} onClick={handleLogout}>
              <LogoutIcon size={16} color="#fca5a5" />
              <span>Logout</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header — always present, full on Home / compact elsewhere ───── */}
      {/* Grid layout: [logo] [greeting (grows)] [settings] — explicit column
          sizing prevents the settings button from inflating and squeezing
          the greeting into a 1-character-per-line column on narrow viewports. */}
      <div style={isHome ? S.header : S.headerCompact}>
        <div style={S.headerTop}>
          <div style={S.headerLogo}>
            <AnimatedLogo variant="header" size={36} withWordmark={false} />
          </div>
          <div style={S.headerText}>
            {isHome ? (
              <>
                <h1 style={S.greeting}>
                  Hi, <span style={S.greetingName}>{firstName}</span>
                </h1>
                <p style={S.tagline}>{moodGreeting}</p>
              </>
            ) : (
              <h1 style={S.tabTitle}>{tabTitles[activeTab] || ''}</h1>
            )}
          </div>
          {/* Search — opens a full-screen overlay where students can find
              classmates in their school and view their public profile. */}
          <button
            onClick={() => setShowUserSearch(true)}
            style={S.searchBtn}
            aria-label="Search students"
          >
            <SearchIcon size={18} color="#cbd5e1" />
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            style={S.settingsBtn}
            aria-label="Open settings"
          >
            <SettingsIcon size={18} color="#cbd5e1" />
          </button>
        </div>

        {/* 4-stat grid — only on Home — matches desktop's 4 cards */}
        {isHome && (
          <div style={S.statsGrid}>
            <StatBox label="Tasks done"  value={stats.tasksCompleted}    icon={<TaskIcon size={16} color={C.blue} />}    tint={G.statBlue} />
            <StatBox label="Study time"  value={`${studyHours}h`}        icon={<TimerIcon size={16} color={C.indigo} />}  tint={G.statIndigo} />
            <StatBox label="Avg score"   value={`${stats.averageScore}%`} icon={<CheckCircleIcon size={16} color={C.purple} />} tint={G.statPurple} />
            <StatBox label="Day streak"  value={stats.streak}             icon={<FireIcon size={16} color={C.warning} />}  tint={G.statAmber} />
          </div>
        )}
      </div>

      {/* ── Main ───────────────────────────────────────────────────────── */}
      {/* Primary tabs are lazy-mounted on first visit and then KEPT MOUNTED
          (display:none when inactive). That means navigating away and back
          doesn't trigger a fresh fetch / reload — scroll position, in-flight
          chats, and any internal state are preserved. The transient "more-*"
          sub-pages still mount/unmount on each visit (they're deep links). */}
      <main style={{
        ...S.main,
        paddingTop: 0,
        paddingLeft: activeTab === 'lernix' ? 0 : 20,
        paddingRight: activeTab === 'lernix' ? 0 : 20,
        paddingBottom: activeTab === 'lernix' ? 0 : 16,
        position: 'relative',
        overflowY: activeTab === 'lernix' ? 'hidden' : 'auto'
      }}>
        {/* Gated UI Overlay */}
        {isGated && !astraLoading && activeTab !== 'lernix' && (
          <div style={{
            position: 'absolute',
            inset: 0,
            zIndex: 100, // Make sure it covers the content
            backdropFilter: 'blur(12px)',
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px 20px',
            textAlign: 'center',
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
            <p style={{ color: '#cbd5e1', fontSize: '15px', marginBottom: '24px', maxWidth: '320px', lineHeight: 1.5 }}>
              Complete your daily check-in to unlock your tasks, notes, and quizzes for today.
            </p>
            <button
              onClick={() => window.dispatchEvent(new Event('open-astra'))}
              style={{
                padding: '14px 28px',
                background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)',
              }}
            >
              Talk to ASTRA to Unlock
            </button>
          </div>
        )}

        {/* Wrap content for blur effect */}
        <div style={{ 
          filter: isGated && !astraLoading && activeTab !== 'lernix' ? 'blur(6px) grayscale(0.5)' : 'none', 
          pointerEvents: isGated && !astraLoading && activeTab !== 'lernix' ? 'none' : 'auto',
          opacity: isGated && !astraLoading && activeTab !== 'lernix' ? 0.6 : 1,
          transition: 'all 0.3s ease',
          height: '100%',
        }}>
          {mountedTabs.has('home') && (
            <div style={{ display: activeTab === 'home' ? 'block' : 'none' }}>
              {renderHome()}
            </div>
          )}
          {mountedTabs.has('learn') && (
            <div style={{ display: activeTab === 'learn' ? 'block' : 'none' }}>
              {renderLearn()}
            </div>
          )}
          {mountedTabs.has('lernix') && (
            <div
              style={{
                ...S.lernixWrap,
                display: activeTab === 'lernix' ? 'flex' : 'none',
              }}
            >
              <LernixAIChatMobile onBack={() => setActiveTab('home')} />
            </div>
          )}

          {mountedTabs.has('more') && (
            <div style={{ display: activeTab === 'more' ? 'block' : 'none' }}>
              {renderMore()}
            </div>
          )}

          {/* "More → X" sub-pages — kept transient (mount on visit, unmount on
              leave) since they're deep-link views the user enters from the
              More grid. Re-mounting on each visit means fresh leaderboard /
              rewards data, which is the right behaviour for those views. */}
          {activeTab === 'more-progress'     && renderMoreProgress()}
          {activeTab === 'more-rewards'      && renderMoreRewards()}
          {activeTab === 'more-tools'        && renderMoreTools()}
          {activeTab === 'more-leaderboard'  && renderMoreLeaderboard()}
          {activeTab === 'more-messages'     && renderMoreMessages()}
          {activeTab === 'more-forum'        && renderMoreForum()}
        </div>
      </main>

      {/* ── Bottom navigation — 5 uniform tabs ─────────────────────────── */}
      {/* marginBottom comes from useBottomInset() — dynamically computed so
          the tabs always clear the device's system navigation, whether the
          back/home/recents buttons are visible right now or hidden. */}
      <nav style={{ ...S.bottomNav, marginBottom: bottomInset }}>
        <NavItem
          icon={<TaskIcon size={20} color="currentColor" />}
          label="Home"
          active={activeTab === 'home'}
          onClick={() => setActiveTab('home')}
        />
        <NavItem
          icon={<BookIcon size={20} color="currentColor" />}
          label="Learn"
          active={activeTab === 'learn'}
          onClick={() => {
            // iOS-style: tapping the same tab while already on it pops
            // back to the root subjects view.
            if (activeTab === 'learn' && learnView !== 'subjects') {
              setLearnView('subjects');
            } else {
              setActiveTab('learn');
            }
          }}
        />
        <NavItem
          icon={<AIIcon size={20} color="currentColor" />}
          label="Lernix"
          active={activeTab === 'lernix'}
          onClick={() => setActiveTab('lernix')}
        />

        <NavItem
          icon={<ChevronRightIcon size={20} color="currentColor" />}
          label="More"
          active={activeTab.startsWith('more')}
          onClick={() => setActiveTab('more')}
        />
      </nav>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Photorealistic glass card — frosted blur, gradient surface, inset highlight.
 * Use `padding={0}` for child components that bring their own padding.
 */
const GlassCard = ({ children, padding = 16, glow = false, style = {} }) => (
  <div
    style={{
      ...S.glassCard,
      padding,
      boxShadow: glow ? GLASS.shadowBlue : GLASS.shadow,
      ...style,
    }}
  >
    {/* Top-edge specular highlight — gives it the "wet glass" look */}
    <div style={S.glassHighlight} aria-hidden />
    {children}
  </div>
);

/**
 * SwipeableProfile — Instagram-style 2-in-1 profile carousel.
 *
 *   Slide 1 = real profile photo (from users/{uid}.photoUrl, set by admin)
 *             → falls back to initial letter if no photo
 *   Slide 2 = equipped gamification avatar (only if one is equipped)
 *
 *   Touch:  drag horizontally to switch slides
 *   Tap:    tap any dot indicator to jump to that slide
 *   Render: simple gradient ring around the active slide so both photo and
 *           avatar share one unified look
 */
const SwipeableProfile = ({ photoUrl, firstName, avatar, avatarName, size = 108 }) => {
  // Compose the slide list dynamically — only what actually exists.
  const slides = [];
  slides.push({
    kind: 'photo',
    label: 'Profile',
    render: photoUrl ? (
      <img
        src={photoUrl}
        alt="Profile photo"
        style={SP.media}
        draggable={false}
      />
    ) : (
      <span style={SP.letter}>
        {(firstName && firstName[0]) ? firstName[0].toUpperCase() : 'S'}
      </span>
    ),
  });
  if (avatar) {
    slides.push({
      kind: 'avatar',
      label: avatarName || 'Avatar',
      render: (
        <img
          src={avatar}
          alt={avatarName || 'Avatar'}
          style={SP.media}
          draggable={false}
        />
      ),
    });
  }

  const [idx, setIdx] = useState(0);
  const slideCount = slides.length;

  // Clean circle, no gradient ring. The slide content fills the full
  // diameter; a soft brand-tinted drop-shadow provides depth without a
  // visible border.
  const INNER = size;
  const trackWidth = INNER * slideCount;

  // If only one slide, render statically (no drag).
  if (slideCount === 1) {
    return (
      <div style={SP.wrap}>
        <div style={{ ...SP.viewport, width: size, height: size }}>
          <div style={{ width: INNER, height: INNER, ...SP.slide }}>
            {slides[0].render}
          </div>
        </div>
      </div>
    );
  }

  // 2 slides → swipeable carousel. No indicator dots, no caption label —
  // just the swipeable circle. The swipe itself is the affordance.
  const goTo = (i) => setIdx(Math.max(0, Math.min(slideCount - 1, i)));

  return (
    <div style={SP.wrap}>
      <div style={{ ...SP.viewport, width: size, height: size }}>
        <motion.div
          drag="x"
          dragConstraints={{ left: -INNER * (slideCount - 1), right: 0 }}
          dragElastic={0.18}
          dragMomentum={false}
          animate={{ x: -idx * INNER }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          onDragEnd={(_, info) => {
            const threshold = INNER * 0.22;
            if (info.offset.x < -threshold) goTo(idx + 1);
            else if (info.offset.x > threshold) goTo(idx - 1);
            else goTo(idx); // snap back if not far enough
          }}
          style={{
            display: 'flex',
            width: trackWidth,
            height: '100%',
            cursor: 'grab',
            touchAction: 'pan-y', // vertical scroll still works
          }}
        >
          {slides.map((s, i) => (
            <div key={i} style={{ width: INNER, height: INNER, ...SP.slide }}>
              {s.render}
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

// SwipeableProfile-specific styles (kept local for clarity).
const SP = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  // Clean circular viewport — no ring, no border. A soft brand-tinted
  // outer glow gives it presence without a visible square/colored frame.
  viewport: {
    borderRadius: '50%',
    overflow: 'hidden',
    background: '#1e293b',
    boxShadow: '0 0 28px rgba(99, 102, 241, 0.30)',
  },
  slide: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#1e293b',
    userSelect: 'none',
  },
  media: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
    pointerEvents: 'none',
  },
  letter: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 42,
    fontWeight: 800,
    color: '#fff',
    background: 'linear-gradient(135deg, #3b82f6, #6366f1, #8b5cf6)',
    letterSpacing: '-0.02em',
    fontFamily: '"Google Sans","Inter",sans-serif',
  },
};

const CircularProgressWrap = ({ value, color, children }) => {
  const num = parseFloat(value) || 0;
  const radius = 14;
  const strokeWidth = 2.5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, num)) / 100) * circumference;

  return (
    <div style={{ position: 'relative', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width="36" height="36" viewBox="0 0 36 36" style={{ position: 'absolute', transform: 'rotate(-90deg)', top: 0, left: 0 }}>
        <circle cx="18" cy="18" r={radius} fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth={strokeWidth} />
        <circle
          cx="18"
          cy="18"
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
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </div>
    </div>
  );
};

const StatBox = ({ label, value, icon, tint }) => {
  const isPercent = typeof value === 'string' && value.endsWith('%');
  const iconColor = icon?.props?.color || '#3b82f6';

  return (
    <div style={{ ...S.statBox, background: tint }}>
      {isPercent ? (
        <CircularProgressWrap value={value} color={iconColor}>
          {icon}
        </CircularProgressWrap>
      ) : (
        <span style={S.statIconWrap}>{icon}</span>
      )}
      <div style={S.statContent}>
        <span style={S.statVal}>{value}</span>
        <span style={S.statLab}>{label}</span>
      </div>
    </div>
  );
};

const SectionHead = ({ title, action, onAction }) => (
  <div style={S.sectionHead}>
    <h2 style={S.sectionTitle}>{title}</h2>
    {action && <button onClick={onAction} style={S.sectionAction}>{action} →</button>}
  </div>
);

const SubTabBar = ({ tabs, active, onChange }) => (
  <div style={S.subTabBar}>
    {tabs.map(t => (
      <button
        key={t.key}
        onClick={() => onChange(t.key)}
        style={{
          ...S.subTabChip,
          ...(active === t.key ? S.subTabChipActive : {}),
        }}
      >
        <span style={{ display: 'inline-flex', marginRight: 6 }}>{t.icon}</span>
        {t.label}
      </button>
    ))}
  </div>
);

// Emoji map for subject icons — distinctive at small sizes and adds warmth
// to the otherwise SVG-icon-heavy dashboard. Unknown subjects fall back to 📚.
const subjectIcon = (name) => {
  const key = String(name || '').toLowerCase().trim();
  if (key.includes('physic'))   return '⚛️';
  if (key.includes('chem'))     return '🧪';
  if (key.includes('bio'))      return '🧬';
  if (key.includes('math'))     return '🔢';
  if (key.includes('computer')) return '💻';
  if (key.includes('english') || key.includes('language') || key.includes('literature')) return '📖';
  if (key.includes('history'))  return '📜';
  if (key.includes('civic'))    return '⚖️';
  if (key.includes('geo'))      return '🗺️';
  if (key.includes('art'))      return '🎨';
  if (key.includes('music'))    return '🎵';
  if (key.includes('phys ed') || key.includes('sport') || key.includes('pe')) return '⚽';
  return '📚';
};

/**
 * Subject accordion — header shows the subject icon + name + chevron.
 * Tapping the header expands to reveal Notes / Assignments / Quizzes
 * options for that subject. Only one subject can be expanded at a time.
 */
const SubjectAccordion = ({ name, expanded, onToggle, onPickNotes, onPickAssignments, onPickQuizzes, onPickSimulations }) => {
  const hasSimulations = ['Physics', 'Chemistry', 'Biology', 'Mathematics'].includes(name);
  return (
    <div style={{ ...S.subjectAccordion, ...(expanded ? S.subjectAccordionOpen : {}) }}>
      <motion.button
        whileTap={{ scale: 0.99 }}
        onClick={onToggle}
        style={{ ...S.subjectHead, ...(expanded ? S.subjectHeadExpanded : {}) }}
      >
        <span style={S.subjectEmoji}>{subjectIcon(name)}</span>
        <span style={S.subjectName}>{name}</span>
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          style={S.subjectChevron}
          aria-hidden
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </motion.span>
      </motion.button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={S.dropdownOptions}>
              <DropdownOption
                icon={<NotesIcon size={22} color={C.blue} />}
                label="Notes"
                desc="Read chapters & study materials"
                onClick={onPickNotes}
              />
              <DropdownOption
                icon={<AssignmentIcon size={22} color={C.purple} />}
                label="Assignments"
                desc="Submit your work"
                onClick={onPickAssignments}
              />
              {hasSimulations && (
                <DropdownOption
                  icon={<ToolsIcon size={22} color={C.warning} />}
                  label="Simulation Lab"
                  desc="Perform virtual experiments"
                  onClick={onPickSimulations}
                />
              )}
              <DropdownOption
                icon={<QuizIcon size={22} color={C.indigo} />}
                label="Quizzes"
                desc="Practice tests"
                onClick={onPickQuizzes}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const DropdownOption = ({ icon, label, desc, onClick }) => (
  <motion.button whileTap={{ scale: 0.97 }} onClick={onClick} style={S.dropdownOption}>
    <span style={S.dropdownOptionIcon}>{icon}</span>
    <div style={S.dropdownOptionText}>
      <span style={S.dropdownOptionLabel}>{label}</span>
      <span style={S.dropdownOptionDesc}>{desc}</span>
    </div>
    <ChevronRightIcon size={14} color="rgba(255,255,255,0.42)" />
  </motion.button>
);

const ActionTile = ({ icon, label, desc, tint, onClick, badge }) => (
  <motion.button
    whileTap={{ scale: 0.97 }}
    onClick={onClick}
    style={{
      ...S.actionTile,
      background: tint,
    }}
  >
    {badge && badge > 0 ? <span style={S.tileBadge}>{badge > 9 ? '9+' : badge}</span> : null}
    <div style={S.actionTileIconWrap}>{icon}</div>
    <div style={S.actionTileLabel}>{label}</div>
    <div style={S.actionTileDesc}>{desc}</div>
  </motion.button>
);

const NavItem = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      ...S.navItem,
      color: active ? '#fff' : 'rgba(255, 255, 255, 0.40)',
    }}
  >
    {active && (
      <motion.div
        layoutId="nav-active-pill"
        style={S.navActivePill}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      />
    )}
    <div style={{ position: 'relative', zIndex: 1 }}>{icon}</div>
    <span style={{ ...S.navLab, position: 'relative', zIndex: 1 }}>{label}</span>
  </button>
);

const Empty = ({ text }) => <div style={S.empty}>{text}</div>;

const BackChip = ({ onClick, label }) => (
  <button onClick={onClick} style={S.backChip}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
    <span>{label}</span>
  </button>
);

const SettingsRow = ({ icon, label, onClick }) => (
  <button onClick={onClick} style={S.settingsRow}>
    <span style={S.settingsRowIcon}>{icon}</span>
    <span style={S.settingsRowLabel}>{label}</span>
    <ChevronRightIcon size={16} color="#475569" />
  </button>
);

const ComingSoon = ({ icon, title, desc }) => (
  <div style={S.comingSoon}>
    <div style={S.comingSoonIcon}>{icon}</div>
    <div style={S.comingSoonTitle}>{title}</div>
    <div style={S.comingSoonDesc}>{desc}</div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const FONT = '"Google Sans", "Product Sans", "Inter", -apple-system, BlinkMacSystemFont, sans-serif';

const S = {
  // ── App shell: fixed-height flex column ──
  // Container is locked to one viewport (100dvh handles iOS address bar
  // dynamically). Header sits at top, main flex-grows AND scrolls internally,
  // and the bottom nav is the last flex item — so it's permanently docked at
  // the bottom of the visible area without relying on `position: fixed`
  // (which gets broken by any transformed ancestor).
  container: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: C.bg,
    color: C.text,
    fontFamily: FONT,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    overscrollBehavior: 'none'
  },
  // Twin aurora orbs that drift gently behind the content for depth
  bgWashTop: {
    position: 'fixed',
    inset: 0,
    background: G.auroraTop,
    pointerEvents: 'none',
    zIndex: 0,
  },
  bgWashBottom: {
    position: 'fixed',
    inset: 0,
    background: G.auroraBottom,
    pointerEvents: 'none',
    zIndex: 0,
  },
  // Subtle film grain — sells the photoreal look
  grainOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E\")",
    opacity: 0.03,
    mixBlendMode: 'overlay',
    pointerEvents: 'none',
    zIndex: 1,
  },
  loaderPage: {
    height: '100vh',
    backgroundColor: C.bg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Header — production-grade grid layout ──
  // Grid columns: [logo: auto] [text: 1fr] [settings: auto]
  // The text column grows to fill remaining space; logo + button
  // stay their content size. minWidth: 0 on the text column lets it
  // shrink below content size (with ellipsis) instead of pushing the
  // settings button off-screen.
  header: {
    position: 'relative',
    paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)',
    paddingBottom: '20px',
    paddingLeft: '20px',
    paddingRight: '20px',
    zIndex: 2,
  },
  headerCompact: {
    position: 'relative',
    paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)',
    paddingBottom: '16px',
    paddingLeft: '20px',
    paddingRight: '20px',
    zIndex: 2,
  },
  headerTop: {
    display: 'grid',
    gridTemplateColumns: 'auto minmax(0, 1fr) auto',
    alignItems: 'center',
    columnGap: 14,
    marginBottom: 18,
  },
  headerLogo: {
    width: 44,
    height: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerText: {
    minWidth: 0,
    overflow: 'hidden',
  },
  greeting: {
    fontSize: 20,
    fontWeight: 700,
    margin: 0,
    letterSpacing: '-0.015em',
    fontFamily: FONT,
    color: '#fff',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    lineHeight: 1.2,
  },
  // Solid cyan — reliable across every mobile browser. The previous
  // `background-clip: text` trick was rendering as invisible text on some
  // Android WebViews because the gradient layer failed to paint.
  greetingName: {
    color: '#67e8f9',
    fontWeight: 800,
  },
  tabTitle: {
    fontSize: 19,
    fontWeight: 800,
    margin: 0,
    letterSpacing: '-0.015em',
    fontFamily: FONT,
    color: '#fff',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  tagline: {
    fontSize: 12.5,
    color: C.textDim,
    margin: '2px 0 0',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  // Settings button — explicit fixed size so it can NEVER inflate and
  // push the greeting into vertical character wrapping.
  settingsBtn: {
    width: 44,
    height: 44,
    padding: 0,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 14,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxSizing: 'border-box',
    transition: 'background 0.2s ease, border-color 0.2s ease',
  },
  // Search button — same shape as settings, sits in the gap between the
  // greeting and the settings icon.
  searchBtn: {
    width: 44,
    height: 44,
    padding: 0,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 14,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxSizing: 'border-box',
    transition: 'background 0.2s ease, border-color 0.2s ease',
    marginRight: 8,
  },

  // 4-card stats grid (matches desktop)
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 10,
  },
  statBox: {
    border: '1px solid rgba(255, 255, 255, 0.08)',
    padding: '14px 14px',
    borderRadius: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    backdropFilter: GLASS.blur,
    WebkitBackdropFilter: GLASS.blur,
    boxShadow: GLASS.shadow,
    position: 'relative',
    overflow: 'hidden',
  },
  statIconWrap: {
    display: 'inline-flex',
    width: 36,
    height: 36,
    borderRadius: 12,
    background: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statContent: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  statVal: { fontSize: 18, fontWeight: 800, color: C.text, lineHeight: 1, fontFamily: FONT },
  statLab: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: 0.8,
    color: C.textDim,
    textTransform: 'uppercase',
    marginTop: 3,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  // ── Main ──
  // Main scrolls INTERNALLY — content overflows here, not on the body, so
  // the bottom nav stays put. iOS momentum scroll via -webkit-overflow.
  main: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    overscrollBehavior: 'contain',
    padding: '0 20px 16px',
    position: 'relative',
    zIndex: 2,
  },
  lernixWrap: {
    margin: '0',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },

  // Section heads
  sectionHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    margin: 0,
    letterSpacing: '-0.015em',
    fontFamily: FONT,
  },
  sectionAction: {
    background: 'none',
    border: 'none',
    color: C.blue,
    fontWeight: 600,
    fontSize: 12.5,
    cursor: 'pointer',
    padding: 0,
  },

  // ── Glass card mix-in ──
  glassCard: {
    background: GLASS.base,
    border: GLASS.border,
    borderRadius: 18,
    backdropFilter: GLASS.blur,
    WebkitBackdropFilter: GLASS.blur,
    boxShadow: GLASS.shadow,
    position: 'relative',
    overflow: 'hidden',
  },
  // The signature top highlight that makes it look like real glass
  glassHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)',
    pointerEvents: 'none',
  },

  // ── Sub-tab bar ──
  subTabBar: {
    display: 'flex',
    gap: 8,
    overflowX: 'auto',
    paddingBottom: 6,
    marginBottom: 8,
    margin: '0 -20px 8px',
    paddingLeft: 20,
    paddingRight: 20,
    scrollbarWidth: 'none',
  },
  subTabChip: {
    flexShrink: 0,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.62)',
    padding: '8px 14px',
    borderRadius: 999,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    transition: 'all 0.2s ease',
    fontFamily: FONT,
  },
  subTabChipActive: {
    background: 'linear-gradient(135deg, rgba(59,130,246,0.18), rgba(99,102,241,0.18))',
    color: '#fff',
    borderColor: 'rgba(59,130,246,0.45)',
    boxShadow: '0 0 16px rgba(59,130,246,0.25)',
  },

  // ── Subject tiles (Learn → Notes) ──
  subjectGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 10,
  },
  subjectTile: {
    background: GLASS.base,
    border: GLASS.border,
    borderRadius: 14,
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    cursor: 'pointer',
    backdropFilter: GLASS.blur,
    WebkitBackdropFilter: GLASS.blur,
    boxShadow: GLASS.shadow,
  },
  subjectTileIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    background: 'rgba(59, 130, 246, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectTileName: { flex: 1, fontSize: 14.5, fontWeight: 600, color: C.text },

  // ── Subject accordion (new Learn layout) ──
  subjectList: { display: 'flex', flexDirection: 'column', gap: 10 },
  subjectAccordion: {
    background: GLASS.base,
    border: GLASS.border,
    borderRadius: 16,
    overflow: 'hidden',
    backdropFilter: GLASS.blur,
    WebkitBackdropFilter: GLASS.blur,
    boxShadow: GLASS.shadow,
    transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
  },
  subjectAccordionOpen: {
    borderColor: 'rgba(59, 130, 246, 0.30)',
    boxShadow: '0 1px 0 rgba(255,255,255,0.08) inset, 0 12px 32px rgba(0,0,0,0.30), 0 0 24px rgba(59,130,246,0.15)',
  },
  subjectHead: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '14px 16px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    gap: 14,
    color: C.text,
    fontFamily: FONT,
    boxSizing: 'border-box',
  },
  subjectHeadExpanded: {
    background: 'rgba(59, 130, 246, 0.06)',
  },
  subjectEmoji: {
    fontSize: 22,
    width: 28,
    textAlign: 'center',
    lineHeight: 1,
    filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.30))',
  },
  subjectName: {
    flex: 1,
    textAlign: 'left',
    fontSize: 15,
    fontWeight: 700,
    fontFamily: FONT,
    letterSpacing: '-0.005em',
  },
  subjectChevron: {
    display: 'inline-flex',
    color: 'rgba(255,255,255,0.55)',
  },
  // Dropdown that opens under the subject header
  dropdownOptions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: '4px 8px 8px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  dropdownOption: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '12px 10px',
    borderRadius: 12,
    color: '#e2e8f0',
    fontFamily: FONT,
    gap: 14,
    transition: 'background 0.15s ease',
    boxSizing: 'border-box',
    textAlign: 'left',
  },
  // Bare icon slot — no background or border. The icon's own color carries
  // the visual weight; we just reserve a consistent 28px width so every
  // row's label/desc lines up perfectly down the left edge.
  dropdownOptionIcon: {
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  // Wrapper that explicitly stacks the label + description as flex column.
  // Without an explicit `display`/`flexDirection` the children can collapse
  // inline on some browsers when nested inside <button>, which is exactly
  // what was making "NotesRead chapters…" render as one squished line.
  dropdownOptionText: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 3,
  },
  dropdownOptionLabel: {
    display: 'block',
    fontSize: 14.5,
    fontWeight: 700,
    color: '#fff',
    lineHeight: 1.25,
    letterSpacing: '-0.005em',
    fontFamily: FONT,
  },
  dropdownOptionDesc: {
    display: 'block',
    fontSize: 12,
    fontWeight: 500,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 1.35,
    fontFamily: FONT,
  },

  // Title shown above a content view (e.g. "Physics · Notes")
  contentTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#fff',
    margin: '12px 2px 12px',
    fontFamily: FONT,
    letterSpacing: '-0.01em',
  },

  // Grades tile — appears at the bottom of the subjects list
  gradesTile: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    width: '100%',
    padding: '14px 16px',
    background: GLASS.base,
    border: GLASS.border,
    borderRadius: 16,
    cursor: 'pointer',
    backdropFilter: GLASS.blur,
    WebkitBackdropFilter: GLASS.blur,
    boxShadow: GLASS.shadow,
    color: C.text,
    fontFamily: FONT,
    boxSizing: 'border-box',
  },
  // Bare check icon — no background box, matches the bare-icon style used
  // by the Notes / Assignments / Quizzes dropdown options.
  gradesTileIcon: {
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  gradesTileText: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 3,
    textAlign: 'left',
  },
  gradesTileTitle: {
    display: 'block',
    fontSize: 14.5,
    fontWeight: 700,
    color: '#fff',
    lineHeight: 1.25,
    fontFamily: FONT,
  },
  gradesTileDesc: {
    display: 'block',
    fontSize: 12,
    fontWeight: 500,
    color: C.textDim,
    lineHeight: 1.35,
    fontFamily: FONT,
  },

  // ── More → action grid ──
  actionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 12,
  },
  actionTile: {
    position: 'relative',
    minHeight: 130,
    padding: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 18,
    backdropFilter: GLASS.blur,
    WebkitBackdropFilter: GLASS.blur,
    boxShadow: GLASS.shadow,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 8,
    textAlign: 'left',
    color: C.text,
    overflow: 'hidden',
  },
  actionTileIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    background: 'rgba(255,255,255,0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTileLabel: {
    fontSize: 15,
    fontWeight: 700,
    color: '#fff',
    marginTop: 4,
    fontFamily: FONT,
  },
  actionTileDesc: { fontSize: 12, color: C.textDim },
  tileBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    minWidth: 22,
    height: 22,
    padding: '0 6px',
    background: C.danger,
    color: '#fff',
    fontSize: 11,
    fontWeight: 800,
    borderRadius: 999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(239,68,68,0.4)',
  },

  // ── Coming soon (placeholder for Messages / Forum) ──
  comingSoon: {
    background: GLASS.base,
    border: GLASS.border,
    borderRadius: 22,
    padding: '40px 24px',
    textAlign: 'center',
    backdropFilter: GLASS.blur,
    WebkitBackdropFilter: GLASS.blur,
    boxShadow: GLASS.shadow,
    marginTop: 14,
  },
  comingSoonIcon: { marginBottom: 12 },
  comingSoonTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: '#fff',
    marginBottom: 8,
    fontFamily: FONT,
  },
  comingSoonDesc: { fontSize: 13, color: C.textDim, lineHeight: 1.5 },

  // ── ASTRA card ──
  astraCard: {
    background: G.astraCard,
    border: '1px solid rgba(139,92,246,0.32)',
    borderRadius: 18,
    padding: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    cursor: 'pointer',
    backdropFilter: GLASS.blur,
    WebkitBackdropFilter: GLASS.blur,
    boxShadow:
      '0 1px 0 rgba(255,255,255,0.08) inset, ' +
      '0 2px 6px rgba(0,0,0,0.4), ' +
      '0 12px 32px rgba(139,92,246,0.20)',
  },
  astraGlow: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(196,181,253,0.4), rgba(139,92,246,0.1) 70%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  astraTitle: { fontSize: 14.5, fontWeight: 700, color: '#fff' },
  astraSub: { fontSize: 12, color: C.textDim, marginTop: 2, lineHeight: 1.4 },

  // ── Back chip ──
  backChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#cbd5e1',
    padding: '7px 13px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 6,
    marginBottom: 14,
  },

  // ── Bottom nav — STRUCTURALLY docked at the bottom of the flex shell ──
  // No `position: fixed` (which gets broken by transformed ancestors). The
  // nav is the last flex child of the container, so it always sits at the
  // bottom of the viewport, never scrolls with content. `flexShrink: 0`
  // guarantees it keeps its height even if main content pushes hard.
  // marginBottom is applied INLINE via useBottomInset() so the spacing
  // adapts to the current device's system nav state.
  bottomNav: {
    flexShrink: 0,
    marginTop: 8,
    marginLeft: 16,
    marginRight: 16,
    height: 68,
    background: 'rgba(7, 9, 18, 0.85)',
    backdropFilter: 'blur(28px) saturate(180%)',
    WebkitBackdropFilter: 'blur(28px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 22,
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    zIndex: 10,
    boxShadow:
      '0 1px 0 rgba(255,255,255,0.08) inset, ' +
      '0 10px 40px rgba(0,0,0,0.55), ' +
      '0 0 30px rgba(59,130,246,0.10)',
  },
  navItem: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    padding: '8px 12px',
    position: 'relative',
    flex: 1,
    transition: 'color 0.2s ease',
  },
  navActivePill: {
    position: 'absolute',
    inset: '6px 8px',
    background: 'rgba(59, 130, 246, 0.18)',
    border: '1px solid rgba(59, 130, 246, 0.42)',
    borderRadius: 12,
    zIndex: 0,
  },
  navLab: { fontSize: 10, fontWeight: 700, letterSpacing: 0.3 },

  // ── Floating mic ──
  // `bottom` is set INLINE via useBottomInset() so it always sits exactly
  // 16px above the dynamically-positioned nav.
  floatingVoice: {
    position: 'fixed',
    right: 22,
    zIndex: 1100,
    width: 56,
    height: 56,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
    boxShadow:
      '0 1px 0 rgba(255,255,255,0.20) inset, ' +
      '0 8px 28px rgba(59,130,246,0.55), ' +
      '0 0 0 4px rgba(7,9,18,1)',
    border: '1px solid rgba(255,255,255,0.18)',
  },

  // ── Empty ──
  empty: {
    padding: '32px 20px',
    textAlign: 'center',
    color: C.textDim,
    fontSize: 13,
    background: 'rgba(255,255,255,0.02)',
    borderRadius: 18,
    border: '1px dashed rgba(255,255,255,0.08)',
  },

  // ── Settings drawer ──
  settingsOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'linear-gradient(180deg, #0a0e23 0%, #070912 100%)',
    zIndex: 2000,
    paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)',
    paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 40px)',
    paddingLeft: '20px',
    paddingRight: '20px',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    boxSizing: 'border-box',
  },
  settingsHeader: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: 24,
  },
  closeSettings: {
    position: 'fixed',
    top: 'calc(env(safe-area-inset-top, 0px) + 20px)',
    right: '20px',
    background: 'transparent',
    border: 'none',
    color: '#cbd5e1',
    cursor: 'pointer',
    width: 36,
    height: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2010,
    outline: 'none',
  },
  profileSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 28,
  },
  settingsName: {
    fontSize: 21,
    fontWeight: 800,
    color: '#fff',
    margin: '4px 0 8px 0',
    textAlign: 'center',
    letterSpacing: '-0.015em',
    fontFamily: FONT,
  },
  badgeRow: { display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  classBadge: {
    padding: '4px 12px',
    background: 'rgba(59, 130, 246, 0.18)',
    color: C.blue,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.3,
  },
  schoolBadge: {
    padding: '4px 12px',
    background: 'rgba(99, 102, 241, 0.18)',
    color: C.indigo,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
  },
  settingsGroup: { marginBottom: 22 },
  groupLabel: {
    fontSize: 11,
    fontWeight: 800,
    color: '#64748b',
    letterSpacing: 1.5,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  settingsRow: {
    width: '100%',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: '13px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    cursor: 'pointer',
    marginBottom: 8,
    color: '#e2e8f0',
    fontFamily: FONT,
  },
  settingsRowIcon: {
    // No background pill — icon sits flat against the row, vertically
    // centred. Width matches the largest tap-area we previously used so
    // labels still line up under each other across rows.
    width: 28,
    height: 28,
    background: 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  settingsRowLabel: { flex: 1, fontSize: 14, fontWeight: 600, textAlign: 'left' },
  // ── Feedback bottom-sheet ──
  feedbackBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.55)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    zIndex: 2500,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  feedbackSheet: {
    width: '100%',
    maxWidth: 460,
    background: 'linear-gradient(180deg, rgba(20, 28, 60, 0.95), rgba(10, 14, 30, 0.98))',
    border: '1px solid rgba(99, 102, 241, 0.28)',
    borderRadius: '22px 22px 0 0',
    padding: '14px 20px calc(28px + env(safe-area-inset-bottom, 0px))',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.55)',
    fontFamily: FONT,
  },
  feedbackGrabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    background: 'rgba(255, 255, 255, 0.20)',
    margin: '0 auto 14px',
  },
  feedbackHead: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  feedbackTitle: {
    fontSize: 18,
    fontWeight: 800,
    margin: 0,
    color: '#fff',
    letterSpacing: '-0.015em',
    fontFamily: FONT,
  },
  feedbackSub: {
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.55)',
    margin: '4px 0 0',
    lineHeight: 1.4,
  },
  feedbackClose: {
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.10)',
    color: '#cbd5e1',
    width: '32px',
    minWidth: '32px',
    maxWidth: '32px',
    height: '32px',
    borderRadius: 10,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    padding: 0,
  },
  feedbackTextarea: {
    width: '100%',
    minHeight: 110,
    padding: '14px 14px',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.10)',
    borderRadius: 14,
    color: '#f1f5f9',
    fontSize: 14.5,
    fontFamily: FONT,
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box',
    lineHeight: 1.5,
  },
  feedbackSubmit: {
    width: '100%',
    marginTop: 14,
    padding: '14px',
    background: `linear-gradient(135deg, ${C.blue}, ${C.indigo}, ${C.purple})`,
    border: '1px solid rgba(255, 255, 255, 0.18)',
    borderRadius: 14,
    color: '#fff',
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: 0.3,
    fontFamily: FONT,
    boxShadow: '0 8px 24px rgba(99, 102, 241, 0.45)',
  },

  logoutBtn: {
    marginTop: 'auto',
    background: 'linear-gradient(135deg, rgba(239,68,68,0.14), rgba(153,27,27,0.24))',
    border: '1px solid rgba(239,68,68,0.32)',
    borderRadius: 14,
    padding: '16px',
    color: '#fca5a5',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    marginBottom: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
};
