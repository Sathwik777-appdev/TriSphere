/**
 * TeacherDashboardMobile
 * ───────────────────────────────────────────────────────────────────────
 * Mobile-first teacher portal. Mirrors every capability of the desktop
 * dashboard (TeacherDashboardDesktop.jsx) in a layout optimised for one
 * thumb on a 4–6.5" screen:
 *
 *   • Sticky greeting header (school name + selected class + subject)
 *   • Class switcher pill (portaled dropdown when teacher has > 1 class)
 *   • Live stats row: Students / Avg attendance / Quizzes done / Pending reviews
 *   • Tab routing — 5-slot bottom nav (Home, Upload, Review, Students, More)
 *   • Settings drawer with: Workspace shortcuts (My Uploads, Notes,
 *     Lessons, Announcements, Discussions, Meetings, Reports, Activity),
 *     Account (phone & password, privacy, feedback), and Logout
 *   • Visited tabs stay mounted so coming back is instant — same trick
 *     the student / parent mobile dashboards use to avoid refetching.
 *   • Auto-refresh on focus / online / visibility (60 s throttle).
 *
 * Data + actions are wired to the same Firestore reads/writes the
 * desktop uses, so live progress, grading, and uploads work identically.
 */

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  doc,
  updateDoc,
  addDoc,
  Timestamp,
  getDoc,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { logoutUser } from '../services/authService';
import { logActivity } from '../services/firestoreService';
import { useAuth } from '../hooks/useAuth';
import { useBottomInset } from '../hooks/useBottomInset';
import { warningToast, successToast, errorToast } from '../utils/toast';
import { colors } from '../styles/theme';
import { useOffline } from '../hooks/useOffline';
import { getFinalQuizScores } from '../utils/quizUtils';
import AnimatedLogo from '../components/AnimatedLogo';
// VideoBackground (Three.js Earth + 25K particles) intentionally NOT
// imported here — it was a major source of mobile heating on this
// dashboard. The static dark navy from `S.container` is enough on a
// phone screen; desktop still keeps the immersive 3D backdrop.
import { LogoLoader } from '../components/AnimatedLogo';
import { AccountSettings } from '../components/AccountSettings';
import { PrivacyPolicy } from '../components/PrivacyPolicy';
import ErrorBoundary from '../components/ErrorBoundary';

// Desktop feature panels — reused verbatim inside <PanelWrap>.
import { TextbookUploader } from '../components/TextbookUploader';
import { MyUploads } from '../components/MyUploads';
import { TeacherNotes } from '../components/TeacherNotes';
import MyLessons from '../components/MyLessons';
import { StudentProgressTable } from '../components/StudentProgressTable';
import { AnnouncementsPanel } from '../components/AnnouncementsPanel';
import { ActivityPanel } from '../components/ActivityPanel';
import { TeacherMeetingsPanel } from '../components/TeacherMeetingsPanel';
import StudentSubmissions from '../components/StudentSubmissions';
import DiscussionForum from '../components/DiscussionForum';
import { ProgressReport } from '../components/ProgressReport';
import SimulationAssignment from '../components/SimulationAssignment';


import {
  SettingsIcon,
  LogoutIcon,
  ShieldIcon,
  FeedbackIcon,
  AnnouncementIcon,
  ChevronRightIcon,
  TargetIcon,
  CheckCircleIcon,
  AssignmentIcon,
  UploadIcon,
  NotesIcon,
  ProgressIcon,
  ForumIcon,
  TimerIcon,
  GraduateIcon,
  TaskIcon,
  CloseIcon,
} from '../components/Icons';

// ── Palette ─────────────────────────────────────────────────────────────
// Teacher accent is emerald to match the desktop branding (vs. parent
// blue, student indigo). The rest of the surface tokens are identical
// to the parent/student mobile dashboards so the visual language stays
// consistent across roles.
const C = {
  bg: '#070b1a',
  surface: 'rgba(15, 23, 42, 0.85)',
  surfaceSoft: 'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.07)',
  text: '#f1f5f9',
  textDim: '#cbd5e1',
  textFaint: '#94a3b8',
  emerald: '#10b981',
  emeraldDeep: '#059669',
  blue: colors.accent.blue,
  indigo: colors.accent.indigo,
  purple: colors.accent.purple,
  success: colors.accent.success,
  warning: colors.accent.warning,
  danger: colors.accent.error,
};

const G = {
  statEmerald: 'linear-gradient(135deg, rgba(16,185,129,0.18), rgba(16,185,129,0.04))',
  statBlue:    'linear-gradient(135deg, rgba(59,130,246,0.18), rgba(59,130,246,0.04))',
  statIndigo:  'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(99,102,241,0.04))',
  statPurple:  'linear-gradient(135deg, rgba(139,92,246,0.18), rgba(139,92,246,0.04))',
  statAmber:   'linear-gradient(135deg, rgba(251,191,36,0.18), rgba(251,191,36,0.04))',
  statGreen:   'linear-gradient(135deg, rgba(34,197,94,0.18), rgba(34,197,94,0.04))',
  statRose:    'linear-gradient(135deg, rgba(244,63,94,0.18), rgba(244,63,94,0.04))',
};

const AUTO_REFRESH_THROTTLE_MS = 60 * 1000;

export default function TeacherDashboardMobile() {
  const { user, userData } = useAuth();
  const navigate = useNavigate();
  const bottomInset = useBottomInset(12);
  const { offline } = useOffline();

  useEffect(() => {
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
  }, []);

  // ── Tab + core selection state ─────────────────────────────────────
  const [activeTab, setActiveTab] = useState('home');
  // The 5-slot bottom nav owns these four IDs. Anything else (notes,
  // lessons, announcements, etc.) is reachable via the More tab or the
  // settings drawer and we treat it as a "secondary" tab — meaning the
  // bottom nav highlights "More" while the inner content swaps.
  const PRIMARY_TABS = useMemo(
    () => new Set(['home', 'upload', 'review', 'students', 'more']),
    []
  );
  const [stats, setStats] = useState({
    totalStudents: 0,
    avgAttendance: 0,
    quizzesCompleted: 0,
    pendingReviews: 0,
  });
  const [recentSubmissions, setRecentSubmissions] = useState([]);
  const [lastFetchAt, setLastFetchAt] = useState(0);

  // Available classes (from userData.classes, fallback to 6-10)
  const availableClasses = useMemo(() => {
    if (
      userData?.classes &&
      Array.isArray(userData.classes) &&
      userData.classes.length > 0
    ) {
      return userData.classes.map((c) => parseInt(c)).sort((a, b) => a - b);
    }
    return [6, 7, 8, 9, 10];
  }, [userData?.classes]);

  const [selectedClass, setSelectedClass] = useState(
    () => availableClasses[0] || 6
  );
  const [selectedSubject, setSelectedSubject] = useState(
    userData?.subject || 'Physics'
  );

  // Keep selected class valid when availableClasses changes (e.g. after
  // userData loads). Without this we could be stuck on a class the
  // teacher doesn't actually teach.
  useEffect(() => {
    if (
      availableClasses.length > 0 &&
      !availableClasses.includes(selectedClass)
    ) {
      setSelectedClass(availableClasses[0]);
    }
  }, [availableClasses, selectedClass]);

  // Sync subject from userData.
  useEffect(() => {
    if (userData?.subject) setSelectedSubject(userData.subject);
  }, [userData?.subject]);

  // Log dashboard visit (same as desktop).
  useEffect(() => {
    if (user?.uid) {
      logActivity(user.uid, null, 'teacher_dashboard_visit').catch(() => {});
    }
  }, [user?.uid]);

  // ── Class switcher dropdown ────────────────────────────────────────
  // Mirrors the parent dashboard's child-switcher: the dropdown is
  // rendered via portal at <body> so it escapes the Wellbeing-style
  // backdrop-filter stacking contexts in the page below.
  const [showClassPicker, setShowClassPicker] = useState(false);
  const pillRef = useRef(null);
  const [dropdownRect, setDropdownRect] = useState(null);

  const toggleClassPicker = useCallback(() => {
    setShowClassPicker((open) => {
      if (open) return false;
      if (pillRef.current) {
        const r = pillRef.current.getBoundingClientRect();
        setDropdownRect({
          top: r.bottom + 8,
          left: r.left,
          width: r.width,
        });
      }
      return true;
    });
  }, []);

  useEffect(() => {
    if (!showClassPicker) return;
    const onResize = () => setShowClassPicker(false);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [showClassPicker]);

  // Body scroll lock while the picker is open (otherwise touch-drag
  // outside the dropdown pans the home feed).
  useEffect(() => {
    if (!showClassPicker) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [showClassPicker]);

  // ── Modals / drawers ───────────────────────────────────────────────
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [showDiscussion, setShowDiscussion] = useState(false);

  // ── Keep-mounted tab set (visited tabs stay alive for instant return)
  const [mountedTabs, setMountedTabs] = useState(new Set(['home']));
  useEffect(() => {
    setMountedTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  // ── Refresh nonce for MyUploads (forces it to refetch when a new
  // chapter is saved). Identical to the desktop's uploadTimestamp.
  const [uploadTimestamp, setUploadTimestamp] = useState(Date.now());
  const handleChapterUploaded = useCallback(() => {
    setUploadTimestamp(Date.now());
  }, []);

  // ── Stats fetch — identical algorithm to desktop's fetchStats. ──────
  // Pulls students in selectedClass, then quizResults / assignments /
  // textbooks filtered by subject + school, then submission counts.
  const loadStats = useCallback(async () => {
    if (!selectedClass || !selectedSubject) return;
    setLastFetchAt(Date.now());

    try {
      const classInt = parseInt(selectedClass);
      const schoolName = userData?.schoolName || '';
      const isDeveloper = userData?.role === 'developer';
      const schoolFilter = isDeveloper
        ? []
        : [where('schoolName', '==', schoolName)];

      // Students
      const studentsSnap = await getDocs(
        query(
          collection(db, 'users'),
          where('role', '==', 'student'),
          ...schoolFilter
        )
      );
      const studentsInClass = studentsSnap.docs.filter((d) => {
        const c = d.data().class;
        return c === classInt || String(c) === String(selectedClass);
      });
      const totalStudents = studentsInClass.length;

      // Content + results in parallel
      const [quizSnap, assignSnap, textSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, 'quizResults'),
            where('subject', '==', selectedSubject),
            ...schoolFilter
          )
        ),
        getDocs(
          query(
            collection(db, 'assignments'),
            where('subject', '==', selectedSubject),
            ...schoolFilter
          )
        ),
        getDocs(
          query(
            collection(db, 'textbooks'),
            where('subject', '==', selectedSubject),
            ...schoolFilter
          )
        ),
      ]);

      const matchesClass = (d) =>
        d.data().class === classInt ||
        String(d.data().class) === String(selectedClass);
      const filteredQuizzes = quizSnap.docs.filter(matchesClass);
      const filteredAssignments = assignSnap.docs.filter(matchesClass);
      const filteredTextbooks = textSnap.docs.filter(matchesClass);

      const quizzesCompleted = getFinalQuizScores(
        filteredQuizzes.map((d) => d.data())
      ).length;
      const totalAssignments = filteredAssignments.length;
      const totalChapters = filteredTextbooks.length;
      const assignmentIds = filteredAssignments.map((d) => d.id);

      // Submissions for these assignments + ungraded count
      let matchingSubmissions = 0;
      let pendingReviews = 0;
      let recent = [];
      if (assignmentIds.length > 0) {
        const subsSnap = await getDocs(
          query(
            collection(db, 'studentSubmissions'),
            where('subject', '==', selectedSubject)
          )
        );
        const subsDocs = subsSnap.docs.filter((d) =>
          assignmentIds.includes(d.data().assignmentId)
        );
        matchingSubmissions = subsDocs.length;
        pendingReviews = subsDocs.filter(
          (d) => !d.data().graded
        ).length;
        const slicedSubmissions = subsDocs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const da =
              a.submittedAt?.toDate?.() || new Date(a.submittedAt || 0);
            const db_ =
              b.submittedAt?.toDate?.() || new Date(b.submittedAt || 0);
            return db_ - da;
          })
          .slice(0, 4);

        recent = await Promise.all(
          slicedSubmissions.map(async (sub) => {
            let studentName = 'Student';
            let profilePhoto = null;
            if (sub.studentId) {
              try {
                const studentDocRef = doc(db, 'users', sub.studentId);
                const studentDoc = await getDoc(studentDocRef);
                if (studentDoc.exists()) {
                  const studentData = studentDoc.data();
                  studentName = studentData.username || studentData.email?.split('@')[0] || 'Student';
                  profilePhoto = studentData.profilePhoto || studentData.photoURL || null;
                }
              } catch (err) {
                console.error('Error fetching student name for recent:', err);
              }
            }
            return { ...sub, studentName, profilePhoto };
          })
        );
      }

      // Avg attendance: identical formula to desktop.
      const totalActivitiesPerStudent = totalAssignments + totalChapters;
      const totalParticipation = matchingSubmissions + quizzesCompleted;
      const expectedParticipation = totalStudents * totalActivitiesPerStudent;
      const avgAttendance =
        expectedParticipation > 0
          ? Math.min(
              Math.round(
                (totalParticipation / expectedParticipation) * 100
              ),
              100
            )
          : 0;

      setStats({
        totalStudents,
        avgAttendance,
        quizzesCompleted,
        pendingReviews,
      });
      setRecentSubmissions(recent);
    } catch (err) {
      console.warn('TeacherMobile: stats fetch failed', err);
    }
  }, [selectedClass, selectedSubject, userData?.schoolName, userData?.role]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Auto-refresh on focus/online/visibility (60 s throttle).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastFetchAt < AUTO_REFRESH_THROTTLE_MS) return;
      loadStats();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener('online', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('online', onVisible);
    };
  }, [lastFetchAt, loadStats]);

  // ── Action handlers ────────────────────────────────────────────────
  const handleLogout = useCallback(async () => {
    try {
      await logoutUser();
      navigate('/login');
    } catch (e) {
      console.error('Logout failed', e);
    }
  }, [navigate]);

  const handlePrivacyAccept = useCallback(async () => {
    try {
      if (user?.uid) {
        await updateDoc(doc(db, 'users', user.uid), { privacyAccepted: true });
      }
      successToast('Privacy Policy accepted');
    } catch (e) {
      console.warn('Privacy accept failed', e);
    } finally {
      setShowPrivacyPolicy(false);
    }
  }, [user?.uid]);

  const handleFeedbackSubmit = useCallback(async () => {
    const trimmed = feedbackText.trim();
    if (!trimmed) {
      warningToast('Please enter your feedback');
      return;
    }
    setFeedbackSubmitting(true);
    try {
      await addDoc(collection(db, 'feedback'), {
        userId: user?.uid,
        userName: userData?.username || 'Teacher',
        userRole: 'teacher',
        schoolName: userData?.schoolName || '',
        feedback: trimmed,
        timestamp: Timestamp.now(),
        email: userData?.email || user?.email || '',
      });
      successToast('Thank you for your feedback!');
      setFeedbackText('');
      setShowFeedback(false);
    } catch (e) {
      errorToast('Could not submit feedback');
    } finally {
      setFeedbackSubmitting(false);
    }
  }, [feedbackText, user, userData]);

  // ── Derived ────────────────────────────────────────────────────────
  const isHome = activeTab === 'home';
  const tabTitles = {
    home: '',
    upload: 'Upload Chapter',
    review: 'Grade Submissions',
    students: 'Student Progress',
    myuploads: 'My Uploads',
    notes: 'Class Notes',
    lessons: 'My Lessons',
    announcements: 'Announcements',
    meetings: 'Meetings',
    reports: 'Reports',
    activity: 'Activity',
    simulations: 'Simulation Lab',
  };

  const firstName = useMemo(() => {
    const raw = (userData?.username || userData?.name || user?.displayName || '').trim();
    const first = raw.split(' ')[0];
    return first || 'Teacher';
  }, [userData, user]);

  // Maps the active inner tab to which slot of the bottom nav lights up.
  const navHighlight = PRIMARY_TABS.has(activeTab) ? activeTab : 'more';

  const goToTab = useCallback((tabId) => {
    setIsSettingsOpen(false);
    setActiveTab(tabId);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────
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
      {/* ── Settings drawer ────────────────────────────────────────── */}
      <AnimatePresence>
        {isSettingsOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={S.drawerBackdrop}
              onClick={() => setIsSettingsOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 280 }}
              style={S.drawer}
            >
              <div style={S.drawerHero}>
                <div style={S.drawerAvatar}>
                  {firstName.charAt(0).toUpperCase()}
                </div>
                <h2 style={S.drawerName}>
                  {userData?.username || 'Teacher'}
                </h2>
                <span style={S.drawerRoleBadge}>
                  Teacher · {userData?.subject || 'Subject'} ·{' '}
                  {userData?.schoolName || 'School'}
                </span>
              </div>

              <div style={S.drawerGroup}>
                <h3 style={S.drawerGroupLabel}>Workspace</h3>
                <SettingsRow
                  icon={<AssignmentIcon size={18} color={C.emerald} />}
                  label="My Uploads"
                  onClick={() => goToTab('myuploads')}
                />
                <SettingsRow
                  icon={<NotesIcon size={18} color={C.blue} />}
                  label="Class Notes"
                  onClick={() => goToTab('notes')}
                />
                <SettingsRow
                  icon={<TaskIcon size={18} color={C.indigo} />}
                  label="My Lessons"
                  onClick={() => goToTab('lessons')}
                />
                <SettingsRow
                  icon={<TaskIcon size={18} color={C.purple} />}
                  label="Simulation Lab"
                  onClick={() => goToTab('simulations')}
                />
                <SettingsRow
                  icon={<AnnouncementIcon size={18} color={C.warning} />}
                  label="Announcements"
                  onClick={() => goToTab('announcements')}
                />
                <SettingsRow
                  icon={<TimerIcon size={18} color={C.purple} />}
                  label="Meetings"
                  onClick={() => goToTab('meetings')}
                />
                <SettingsRow
                  icon={<ForumIcon size={18} color={C.blue} />}
                  label="Discussion Forum"
                  onClick={() => {
                    setIsSettingsOpen(false);
                    setShowDiscussion(true);
                  }}
                />
                <SettingsRow
                  icon={<ProgressIcon size={18} color={C.success} />}
                  label="Reports"
                  onClick={() => goToTab('reports')}
                />
                <SettingsRow
                  icon={<TargetIcon size={18} color={C.warning} />}
                  label="Activity Log"
                  onClick={() => goToTab('activity')}
                />
              </div>

              <div style={S.drawerGroup}>
                <h3 style={S.drawerGroupLabel}>Account</h3>
                <SettingsRow
                  icon={<SettingsIcon size={18} color="#cbd5e1" />}
                  label="Phone & Password"
                  onClick={() => {
                    setIsSettingsOpen(false);
                    setShowAccountSettings(true);
                  }}
                />
                <SettingsRow
                  icon={<ShieldIcon size={18} color={C.indigo} />}
                  label="Privacy Policy"
                  onClick={() => {
                    setIsSettingsOpen(false);
                    setShowPrivacyPolicy(true);
                  }}
                />
                <SettingsRow
                  icon={<FeedbackIcon size={18} color={C.purple} />}
                  label="Share Feedback"
                  onClick={() => {
                    setIsSettingsOpen(false);
                    setShowFeedback(true);
                  }}
                />
              </div>

              <button style={S.drawerLogout} onClick={handleLogout}>
                <LogoutIcon size={16} color="#fca5a5" />
                <span>Logout</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Account settings modal ─────────────────────────────────── */}
      {showAccountSettings && (
        <AccountSettings onClose={() => setShowAccountSettings(false)} />
      )}

      {/* ── Privacy modal ───────────────────────────────────────────── */}
      {showPrivacyPolicy && (
        <PrivacyPolicy
          onAccept={handlePrivacyAccept}
          viewOnly={!!userData?.privacyAccepted}
        />
      )}

      {/* ── Feedback bottom sheet ──────────────────────────────────── */}
      <AnimatePresence>
        {showFeedback && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={S.fbBackdrop}
              onClick={() => setShowFeedback(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 240 }}
              style={S.fbSheet}
            >
              <div style={S.fbHandle} />
              <h3 style={S.fbTitle}>Share Feedback</h3>
              <p style={S.fbDesc}>
                What's working for you in TriSphere, or what should we improve?
              </p>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Type your feedback here…"
                style={S.fbTextarea}
                rows={5}
              />
              <button
                onClick={handleFeedbackSubmit}
                disabled={feedbackSubmitting}
                style={{
                  ...S.fbSubmit,
                  opacity: feedbackSubmitting ? 0.7 : 1,
                }}
              >
                {feedbackSubmitting ? 'Sending…' : 'Submit Feedback'}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Discussion forum full-screen modal ──────────────────────── */}
      <AnimatePresence>
        {showDiscussion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={S.forumModal}
          >
            <div style={S.forumHeader}>
              <h3 style={S.forumTitle}>💬 Discussion Forum</h3>
              <button
                onClick={() => setShowDiscussion(false)}
                style={S.forumClose}
                aria-label="Close discussions"
              >
                <CloseIcon size={20} color="#cbd5e1" />
              </button>
            </div>
            <div style={S.forumBody}>
              <DiscussionForum
                classNumber={selectedClass}
                subject={selectedSubject}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ─────────────────────────────────────────────────── */}
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
                <p style={S.tagline}>
                  {selectedSubject} · {userData?.schoolName || 'School'}
                </p>
              </>
            ) : (
              <h1 style={S.tabTitle}>{tabTitles[activeTab] || ''}</h1>
            )}
          </div>
          <button
            onClick={() => setIsSettingsOpen(true)}
            style={S.settingsBtn}
            aria-label="Open settings"
          >
            <SettingsIcon size={18} color="#cbd5e1" />
          </button>
        </div>

        {/* Class switcher pill (always render — even with 1 class, so the
            teacher sees which class they're working with). */}
        <button
          ref={pillRef}
          onClick={
            availableClasses.length > 1
              ? toggleClassPicker
              : undefined
          }
          style={{
            ...S.classPill,
            ...(showClassPicker ? S.classPillActive : null),
            cursor:
              availableClasses.length > 1 ? 'pointer' : 'default',
          }}
          aria-haspopup={availableClasses.length > 1 ? 'listbox' : undefined}
          aria-expanded={showClassPicker}
        >
          <div style={S.classPillAvatar}>
            <GraduateIcon size={18} color="#fff" />
          </div>
          <div style={{ flex: 1, textAlign: 'left', display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={S.classPillName}>Class {selectedClass}</div>
            <div style={{...S.classPillMeta, marginLeft: '6px', marginTop: 0}}>
              {availableClasses.length > 1
                ? `- ${availableClasses.length} classes · tap to switch`
                : '- Your assigned class'}
            </div>
          </div>
          {availableClasses.length > 1 && (
            <div
              style={{
                display: 'inline-flex',
                transform: showClassPicker
                  ? 'rotate(90deg)'
                  : 'rotate(0deg)',
                transition: 'transform 180ms ease',
              }}
            >
              <ChevronRightIcon size={16} color="#94a3b8" />
            </div>
          )}
        </button>

        {/* Stats grid only on Home view */}
        {isHome && (
          <div style={S.statsGrid}>
            <StatBox
              label="Students"
              value={stats.totalStudents}
              icon={<GraduateIcon size={16} color={C.emerald} />}
              tint={G.statEmerald}
            />
            <StatBox
              label="Avg attend"
              value={`${stats.avgAttendance}%`}
              icon={<TargetIcon size={16} color={C.blue} />}
              tint={G.statBlue}
            />
            <StatBox
              label="Quizzes"
              value={stats.quizzesCompleted}
              icon={<CheckCircleIcon size={16} color={C.purple} />}
              tint={G.statPurple}
            />
            <StatBox
              label="To grade"
              value={stats.pendingReviews}
              icon={
                <TaskIcon
                  size={16}
                  color={stats.pendingReviews > 0 ? C.warning : C.success}
                />
              }
              tint={stats.pendingReviews > 0 ? G.statAmber : G.statGreen}
            />
          </div>
        )}
      </div>

      {/* ── Portaled class-picker dropdown ─────────────────────────── */}
      {availableClasses.length > 1 &&
        typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {showClassPicker && dropdownRect && (
              <>
                <div
                  style={S.dropdownCatcher}
                  onClick={() => setShowClassPicker(false)}
                  onTouchMove={(e) => e.preventDefault()}
                />
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                  style={{
                    ...S.dropdown,
                    top: dropdownRect.top,
                    left: dropdownRect.left,
                    width: dropdownRect.width,
                  }}
                  role="listbox"
                >
                  {availableClasses.map((c) => {
                    const isActive = c === selectedClass;
                    return (
                      <button
                        key={c}
                        role="option"
                        aria-selected={isActive}
                        onClick={() => {
                          setSelectedClass(c);
                          setShowClassPicker(false);
                        }}
                        style={{
                          ...S.classOption,
                          borderColor: isActive
                            ? C.emerald
                            : 'rgba(255,255,255,0.08)',
                          background: isActive
                            ? 'linear-gradient(135deg, rgba(16,185,129,0.18), rgba(5,150,105,0.10))'
                            : 'rgba(255,255,255,0.03)',
                        }}
                      >
                        <div style={S.classOptAvatar}>
                          <GraduateIcon size={18} color="#fff" />
                        </div>
                        <div style={{ flex: 1, textAlign: 'left' }}>
                          <div style={S.classOptName}>Class {c}</div>
                          <div style={S.classOptMeta}>
                            {selectedSubject}
                          </div>
                        </div>
                        {isActive && (
                          <CheckCircleIcon size={20} color={C.emerald} />
                        )}
                      </button>
                    );
                  })}
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* ── Main content ───────────────────────────────────────────── */}
      <main style={{ ...S.main, paddingBottom: bottomInset + 92 }}>
        {mountedTabs.has('home') && (
          <div style={{ display: activeTab === 'home' ? 'block' : 'none' }}>
            <ErrorBoundary mini context="Home View">
              <HomeView
                stats={stats}
                recent={recentSubmissions}
                onGoUpload={() => setActiveTab('upload')}
                onGoReview={() => setActiveTab('review')}
                onGoStudents={() => setActiveTab('students')}
                onGoNotes={() => setActiveTab('notes')}
                onGoLessons={() => setActiveTab('lessons')}
                onGoAnnouncements={() => setActiveTab('announcements')}
                onGoReports={() => setActiveTab('reports')}
                onGoMeetings={() => setActiveTab('meetings')}
                onGoMyUploads={() => setActiveTab('myuploads')}
                onGoDiscussions={() => setShowDiscussion(true)}
              />
            </ErrorBoundary>
          </div>
        )}

        {mountedTabs.has('upload') && (
          <div style={{ display: activeTab === 'upload' ? 'block' : 'none' }}>
            <PanelWrap>
              <h3 style={S.panelHeading}>📚 Upload Chapter PDF</h3>
              <p style={S.panelSub}>
                Generates AI notes + 10 quiz questions + assignment for{' '}
                <strong>Class {selectedClass}</strong> · {selectedSubject}.
              </p>
              <ErrorBoundary mini context="Textbook Uploader">
                <TextbookUploader
                  userId={user?.uid}
                  classNumber={selectedClass}
                  subject={selectedSubject}
                  schoolName={userData?.schoolName || ''}
                  onUploadSuccess={handleChapterUploaded}
                />
              </ErrorBoundary>
            </PanelWrap>
          </div>
        )}

        {mountedTabs.has('review') && (
          <div style={{ display: activeTab === 'review' ? 'block' : 'none' }}>
            <PanelWrap>
              <ErrorBoundary mini context="Student Submissions">
                <StudentSubmissions
                  classNumber={selectedClass}
                  subject={selectedSubject}
                  schoolName={userData?.schoolName || ''}
                />
              </ErrorBoundary>
            </PanelWrap>
          </div>
        )}

        {mountedTabs.has('students') && (
          <div style={{ display: activeTab === 'students' ? 'block' : 'none' }}>
            <PanelWrap>
              <ErrorBoundary mini context="Student Progress">
                <StudentProgressTable
                  classNumber={selectedClass}
                  subject={selectedSubject}
                  schoolName={userData?.schoolName || ''}
                />
              </ErrorBoundary>
            </PanelWrap>
          </div>
        )}

        {/* 'more' = an in-page hub of every secondary section (also reachable
            from the drawer). Keeps the bottom-nav 5th slot useful. */}
        {mountedTabs.has('more') && (
          <div style={{ display: activeTab === 'more' ? 'block' : 'none' }}>
            <ErrorBoundary mini context="More Hub">
              <MoreHub
                onPickTab={setActiveTab}
                onOpenDiscussions={() => setShowDiscussion(true)}
                onOpenSettings={() => setIsSettingsOpen(true)}
              />
            </ErrorBoundary>
          </div>
        )}

        {/* Secondary tabs reachable from drawer / More hub / Home shortcuts */}
        {mountedTabs.has('myuploads') && (
          <div style={{ display: activeTab === 'myuploads' ? 'block' : 'none' }}>
            <PanelWrap>
              <ErrorBoundary mini context="My Uploads">
                <MyUploads
                  userId={user?.uid}
                  classNumber={selectedClass}
                  subject={selectedSubject}
                  schoolName={userData?.schoolName || ''}
                  refreshTrigger={uploadTimestamp}
                />
              </ErrorBoundary>
            </PanelWrap>
          </div>
        )}

        {mountedTabs.has('notes') && (
          <div style={{ display: activeTab === 'notes' ? 'block' : 'none' }}>
            <PanelWrap>
              <ErrorBoundary mini context="Teacher Notes">
                <TeacherNotes
                  classNumber={selectedClass}
                  subject={selectedSubject}
                  schoolName={userData?.schoolName || ''}
                />
              </ErrorBoundary>
            </PanelWrap>
          </div>
        )}

        {mountedTabs.has('lessons') && (
          <div style={{ display: activeTab === 'lessons' ? 'block' : 'none' }}>
            <PanelWrap>
              <ErrorBoundary mini context="My Lessons">
                <MyLessons
                  classNumber={selectedClass}
                  subject={selectedSubject}
                  userId={user?.uid}
                  schoolName={userData?.schoolName || ''}
                />
              </ErrorBoundary>
            </PanelWrap>
          </div>
        )}

        {mountedTabs.has('announcements') && (
          <div
            style={{
              display: activeTab === 'announcements' ? 'block' : 'none',
            }}
          >
            <PanelWrap>
              <ErrorBoundary mini context="Announcements">
                <AnnouncementsPanel
                  userId={user?.uid}
                  userName={userData?.username || 'Teacher'}
                  schoolName={userData?.schoolName || ''}
                  classNumber={selectedClass}
                />
              </ErrorBoundary>
            </PanelWrap>
          </div>
        )}

        {mountedTabs.has('meetings') && (
          <div style={{ display: activeTab === 'meetings' ? 'block' : 'none' }}>
            <PanelWrap>
              <ErrorBoundary mini context="Meetings Booking">
                <TeacherMeetingsPanel userId={user?.uid} />
              </ErrorBoundary>
            </PanelWrap>
          </div>
        )}

        {mountedTabs.has('reports') && (
          <div style={{ display: activeTab === 'reports' ? 'block' : 'none' }}>
            <PanelWrap>
              <ErrorBoundary mini context="Progress Reports">
                <ProgressReport
                  role="teacher"
                  classNumber={selectedClass}
                  schoolName={userData?.schoolName || ''}
                />
              </ErrorBoundary>
            </PanelWrap>
          </div>
        )}

        {mountedTabs.has('simulations') && (
          <div style={{ display: activeTab === 'simulations' ? 'block' : 'none' }}>
            <PanelWrap>
              <ErrorBoundary mini context="Simulation Lab">
                <SimulationAssignment
                  userId={user?.uid}
                  classNumber={selectedClass}
                  schoolName={userData?.schoolName || ''}
                  teacherSubject={userData?.subject}
                  userRole={userData?.role}
                />
              </ErrorBoundary>
            </PanelWrap>
          </div>
        )}

        {mountedTabs.has('activity') && (
          <div style={{ display: activeTab === 'activity' ? 'block' : 'none' }}>
            <PanelWrap>
              <ErrorBoundary mini context="Activity Log">
                <ActivityPanel classNumber={selectedClass} />
              </ErrorBoundary>
            </PanelWrap>
          </div>
        )}
      </main>

      {/* ── Bottom nav (5 slots) ───────────────────────────────────── */}
      <nav style={{ ...S.bottomNav, marginBottom: bottomInset }}>
        <NavItem
          icon={<TargetIcon size={20} color="currentColor" />}
          label="Home"
          active={navHighlight === 'home'}
          onClick={() => setActiveTab('home')}
        />
        <NavItem
          icon={<UploadIcon size={20} color="currentColor" />}
          label="Upload"
          active={navHighlight === 'upload'}
          onClick={() => setActiveTab('upload')}
        />
        <NavItem
          icon={<TaskIcon size={20} color="currentColor" />}
          label="Review"
          active={navHighlight === 'review'}
          onClick={() => setActiveTab('review')}
          badge={stats.pendingReviews}
        />
        <NavItem
          icon={<GraduateIcon size={20} color="currentColor" />}
          label="Students"
          active={navHighlight === 'students'}
          onClick={() => setActiveTab('students')}
        />
        <NavItem
          icon={<NotesIcon size={20} color="currentColor" />}
          label="More"
          active={navHighlight === 'more'}
          onClick={() => setActiveTab('more')}
        />
      </nav>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Home view — overview, recent submissions, quick actions
// ─────────────────────────────────────────────────────────────────────────
function HomeView({
  stats,
  recent,
  onGoUpload,
  onGoReview,
  onGoStudents,
  onGoNotes,
  onGoLessons,
  onGoAnnouncements,
  onGoReports,
  onGoMeetings,
  onGoMyUploads,
  onGoDiscussions,
}) {
  return (
    <div
      style={{
        padding: '16px 14px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {/* Grading alert banner */}
      {stats.pendingReviews > 0 && (
        <button onClick={onGoReview} style={S.alertBanner}>
          <div style={S.alertIcon}>📝</div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={S.alertTitle}>
              {stats.pendingReviews} submission
              {stats.pendingReviews > 1 ? 's' : ''} awaiting your review
            </div>
            <div style={S.alertSub}>Tap to start grading</div>
          </div>
          <ChevronRightIcon size={16} color="#fcd34d" />
        </button>
      )}

      {/* Recent submissions */}
      <div style={{ ...S.glassCard, padding: 16 }}>
        <div style={S.sectionHeader}>
          <h3 style={S.sectionTitle}>Recent submissions</h3>
          <span style={S.sectionMeta}>{recent.length} latest</span>
        </div>
        {recent.length === 0 ? (
          <div style={S.empty}>No submissions yet.</div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              marginTop: 4,
            }}
          >
            {recent.map((s) => {
              const when =
                s.submittedAt?.toDate?.() || new Date(s.submittedAt || 0);
              return (
                <button
                  key={s.id}
                  onClick={onGoReview}
                  style={S.subRow}
                >
                   <div style={S.subAvatar}>
                    {s.profilePhoto ? (
                      <img
                        src={s.profilePhoto}
                        alt={s.studentName}
                        style={{
                          width: '100%',
                          height: '100%',
                          borderRadius: '10px',
                          objectFit: 'cover'
                        }}
                      />
                    ) : (
                      (s.studentName || '?').charAt(0).toUpperCase()
                    )}
                  </div>
                  <div style={{ flex: 1, textAlign: 'left', display: 'flex', flexDirection: 'column' }}>
                    <div style={S.subName}>
                      {s.studentName || 'Student'}
                    </div>
                    <div style={S.subTask}>
                      {s.assignmentTitle || s.subject || 'Assignment'}
                    </div>
                  </div>
                  <span
                    style={{
                      ...S.subTag,
                      background: s.graded
                        ? 'rgba(34,197,94,0.15)'
                        : 'rgba(251,191,36,0.15)',
                      color: s.graded ? '#86efac' : '#fcd34d',
                    }}
                  >
                    {s.graded ? 'Graded' : 'New'}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div style={{ ...S.glassCard, padding: 16 }}>
        <div style={S.sectionHeader}>
          <h3 style={S.sectionTitle}>Quick actions</h3>
          <span style={S.sectionMeta}>Tap to open</span>
        </div>
        <div style={S.actionGrid}>
          <ActionTile
            icon={<UploadIcon size={20} color={C.emerald} />}
            label="Upload chapter"
            sub="PDF → notes + quiz"
            tint={G.statEmerald}
            onClick={onGoUpload}
          />
          <ActionTile
            icon={<TaskIcon size={20} color={C.warning} />}
            label="Grade work"
            sub="Submissions panel"
            tint={G.statAmber}
            onClick={onGoReview}
          />
          <ActionTile
            icon={<GraduateIcon size={20} color={C.blue} />}
            label="Student progress"
            sub="Quiz + assignment data"
            tint={G.statBlue}
            onClick={onGoStudents}
          />
          <ActionTile
            icon={<NotesIcon size={20} color={C.purple} />}
            label="Class notes"
            sub="Write & publish"
            tint={G.statPurple}
            onClick={onGoNotes}
          />
          <ActionTile
            icon={<TaskIcon size={20} color={C.indigo} />}
            label="My lessons"
            sub="Plan & schedule"
            tint={G.statIndigo}
            onClick={onGoLessons}
          />
          <ActionTile
            icon={<AnnouncementIcon size={20} color={C.warning} />}
            label="Announcements"
            sub="Post updates"
            tint={G.statAmber}
            onClick={onGoAnnouncements}
          />
          <ActionTile
            icon={<TimerIcon size={20} color={C.purple} />}
            label="Meetings"
            sub="With parents"
            tint={G.statPurple}
            onClick={onGoMeetings}
          />
          <ActionTile
            icon={<ProgressIcon size={20} color={C.success} />}
            label="Reports"
            sub="Class performance"
            tint={G.statGreen}
            onClick={onGoReports}
          />
          <ActionTile
            icon={<AssignmentIcon size={20} color={C.emerald} />}
            label="My uploads"
            sub="Review past PDFs"
            tint={G.statEmerald}
            onClick={onGoMyUploads}
          />
          <ActionTile
            icon={<ForumIcon size={20} color={C.blue} />}
            label="Discussions"
            sub="Forum & threads"
            tint={G.statBlue}
            onClick={onGoDiscussions}
          />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// More hub — secondary nav surface, mirrors the drawer items inline
// ─────────────────────────────────────────────────────────────────────────
function MoreHub({ onPickTab, onOpenDiscussions, onOpenSettings }) {
  const items = [
    { id: 'myuploads', label: 'My Uploads', icon: <AssignmentIcon size={20} color={C.emerald} />, sub: 'Past chapters' },
    { id: 'notes', label: 'Class Notes', icon: <NotesIcon size={20} color={C.blue} />, sub: 'Write & publish' },
    { id: 'lessons', label: 'My Lessons', icon: <TaskIcon size={20} color={C.indigo} />, sub: 'Plan ahead' },
    { id: 'simulations', label: 'Simulation Lab', icon: <TaskIcon size={20} color={C.purple} />, sub: 'Assign & grade experiments' },
    { id: 'announcements', label: 'Announcements', icon: <AnnouncementIcon size={20} color={C.warning} />, sub: 'Class updates' },
    { id: 'meetings', label: 'Meetings', icon: <TimerIcon size={20} color={C.purple} />, sub: 'Parents & 1:1s' },
    { id: '__discussions', label: 'Discussion Forum', icon: <ForumIcon size={20} color={C.blue} />, sub: 'Threads' },
    { id: 'reports', label: 'Reports', icon: <ProgressIcon size={20} color={C.success} />, sub: 'Performance' },
    { id: 'activity', label: 'Activity Log', icon: <TargetIcon size={20} color={C.warning} />, sub: 'Class history' },
    { id: '__settings', label: 'Settings', icon: <SettingsIcon size={20} color="#cbd5e1" />, sub: 'Account & privacy' },
  ];

  return (
    <div style={{ padding: '16px 14px 0' }}>
      <div style={{ ...S.glassCard, padding: 12 }}>
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => {
              if (it.id === '__discussions') return onOpenDiscussions();
              if (it.id === '__settings') return onOpenSettings();
              onPickTab(it.id);
            }}
            style={S.moreRow}
          >
            <span style={S.moreIcon}>{it.icon}</span>
            <span style={{ flex: 1, textAlign: 'left' }}>
              <span style={S.moreLabel}>{it.label}</span>
              <span style={S.moreSub}>{it.sub}</span>
            </span>
            <ChevronRightIcon size={16} color="#475569" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Sub-components + styles
// ─────────────────────────────────────────────────────────────────────────
const PanelWrap = ({ children }) => (
  <div style={{ padding: '16px 12px 0' }}>{children}</div>
);

const CircularProgressWrap = ({ value, color, children }) => {
  const num = parseFloat(value) || 0;
  const radius = 14;
  const strokeWidth = 2.5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, num)) / 100) * circumference;

  return (
    <div style={{ position: 'relative', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: 2 }}>
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
  const iconColor = icon?.props?.color || '#cbd5e1';

  return (
    <div style={{ ...S.statBox, background: tint }}>
      {isPercent ? (
        <CircularProgressWrap value={value} color={iconColor}>
          {icon}
        </CircularProgressWrap>
      ) : (
        <div style={S.statIcon}>{icon}</div>
      )}
      <div style={S.statValue}>{value}</div>
      <div style={S.statLabel}>{label}</div>
    </div>
  );
};

const ActionTile = ({ icon, label, sub, tint, onClick }) => (
  <button onClick={onClick} style={{ ...S.actionTile, background: tint }}>
    <div style={S.actionIcon}>{icon}</div>
    <div style={S.actionLabel}>{label}</div>
    <div style={S.actionSub}>{sub}</div>
  </button>
);

const NavItem = ({ icon, label, active, onClick, badge }) => (
  <button
    onClick={onClick}
    style={{
      ...S.navItem,
      color: active ? C.emerald : '#94a3b8',
    }}
  >
    {active && <div style={S.navActivePill} />}
    <span
      style={{
        position: 'relative',
        zIndex: 1,
        display: 'inline-flex',
      }}
    >
      {icon}
      {badge > 0 && (
        <span style={S.navBadge}>{badge > 9 ? '9+' : badge}</span>
      )}
    </span>
    <span style={{ ...S.navLab, position: 'relative', zIndex: 1 }}>
      {label}
    </span>
  </button>
);

const SettingsRow = ({ icon, label, onClick }) => (
  <button onClick={onClick} style={S.settingsRow}>
    <span style={S.settingsRowIcon}>{icon}</span>
    <span style={S.settingsRowLabel}>{label}</span>
    <ChevronRightIcon size={16} color="#475569" />
  </button>
);

const FONT =
  '"Google Sans", "Product Sans", "Inter", -apple-system, BlinkMacSystemFont, sans-serif';

const S = {
  container: {
    minHeight: '100dvh',
    width: '100%',
    backgroundColor: C.bg,
    color: C.text,
    fontFamily: FONT,
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
  },

  // Header
  header: {
    paddingTop: 'calc(env(safe-area-inset-top, 0px) + 18px)',
    paddingBottom: '16px',
    paddingLeft: '14px',
    paddingRight: '14px',
    background:
      'linear-gradient(180deg, rgba(16,185,129,0.10) 0%, rgba(7,11,26,0.0) 100%)',
  },
  headerCompact: {
    paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px)',
    paddingBottom: '12px',
    paddingLeft: '14px',
    paddingRight: '14px',
    background:
      'linear-gradient(180deg, rgba(16,185,129,0.10) 0%, rgba(7,11,26,0.0) 100%)',
  },
  headerTop: {
    display: 'grid',
    gridTemplateColumns: '44px 1fr 40px',
    alignItems: 'center',
    gap: 12,
  },
  headerLogo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { minWidth: 0 },
  greeting: {
    margin: 0,
    fontSize: 20,
    fontWeight: 700,
    color: C.text,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  greetingName: { color: C.emerald },
  tagline: {
    margin: '4px 0 0',
    fontSize: 12,
    color: C.textDim,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  tabTitle: { margin: 0, fontSize: 18, fontWeight: 700, color: C.text },
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
  },

  // Class pill (mirrors parent child pill, emerald theme)
  classPill: {
    marginTop: 12,
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 12px',
    background: 'rgba(16,185,129,0.10)',
    border: '1px solid rgba(16,185,129,0.25)',
    borderRadius: 14,
    color: C.text,
    fontFamily: FONT,
    transition: 'background 160ms ease, border-color 160ms ease',
  },
  classPillActive: {
    background: 'rgba(16,185,129,0.18)',
    borderColor: 'rgba(16,185,129,0.50)',
  },
  classPillAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDeep})`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  classPillName: { fontSize: 14, fontWeight: 700, color: C.text },
  classPillMeta: { fontSize: 11, color: C.textDim, marginTop: 2 },

  // Portaled dropdown
  dropdownCatcher: {
    position: 'fixed',
    inset: 0,
    background: 'transparent',
    zIndex: 9000,
    touchAction: 'none',
  },
  dropdown: {
    position: 'fixed',
    padding: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    background: 'rgba(11, 18, 38, 0.96)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 16,
    boxShadow: '0 20px 40px rgba(0,0,0,0.45)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    maxHeight: '60vh',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    zIndex: 9001,
    transformOrigin: 'top center',
  },
  classOption: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 14px',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    color: C.text,
    cursor: 'pointer',
    fontFamily: FONT,
  },
  classOptAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    background: 'linear-gradient(135deg, #10b981, #059669)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  classOptName: { fontSize: 14, fontWeight: 700, color: C.text },
  classOptMeta: { fontSize: 11, color: C.textDim, marginTop: 2 },

  // Stats grid
  statsGrid: {
    marginTop: 14,
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 8,
  },
  statBox: {
    padding: '12px 8px',
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
  },
  statIcon: { display: 'inline-flex', marginBottom: 2 },
  statValue: { fontSize: 18, fontWeight: 800, color: C.text, lineHeight: 1 },
  statLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: C.textDim,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },

  main: { flex: 1, padding: 0, overflowY: 'visible' },

  // Panels
  panelHeading: {
    margin: '0 0 6px',
    fontSize: 18,
    fontWeight: 800,
    color: C.text,
  },
  panelSub: { margin: '0 0 14px', fontSize: 13, color: C.textDim },

  // Cards
  glassCard: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 18,
    boxShadow: '0 18px 40px rgba(0,0,0,0.32)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: { margin: 0, fontSize: 15, fontWeight: 700, color: C.text },
  sectionMeta: { fontSize: 11, color: C.textFaint, fontWeight: 600 },

  // Alert banner
  alertBanner: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    background: 'rgba(251,191,36,0.10)',
    border: '1px solid rgba(251,191,36,0.30)',
    color: C.text,
    cursor: 'pointer',
    fontFamily: FONT,
  },
  alertIcon: { fontSize: 22 },
  alertTitle: { fontSize: 14, fontWeight: 700, color: '#fcd34d' },
  alertSub: { fontSize: 12, color: '#fde68a', marginTop: 2 },

  // Submissions list
  subRow: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.025)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 12,
    color: C.text,
    cursor: 'pointer',
    fontFamily: FONT,
  },
  subAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 14,
    color: '#fff',
    flexShrink: 0,
  },
  subName: { fontSize: 14, fontWeight: 700, color: C.text },
  subTask: {
    fontSize: 12,
    color: C.textDim,
    marginTop: 2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 200,
  },
  subTag: {
    fontSize: 11,
    fontWeight: 700,
    padding: '4px 8px',
    borderRadius: 999,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  empty: {
    padding: 18,
    textAlign: 'center',
    fontSize: 13,
    color: C.textDim,
  },

  // Action grid
  actionGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  },
  actionTile: {
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: '14px 12px',
    color: C.text,
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: FONT,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  actionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    background: 'rgba(255,255,255,0.04)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { fontSize: 13, fontWeight: 700 },
  actionSub: { fontSize: 11, color: C.textDim },

  // More hub rows
  moreRow: {
    width: '100%',
    background: 'rgba(255,255,255,0.025)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: '12px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    cursor: 'pointer',
    marginBottom: 8,
    color: '#e2e8f0',
    fontFamily: FONT,
  },
  moreIcon: {
    width: 32,
    height: 32,
    background: 'transparent',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  moreLabel: {
    display: 'block',
    fontSize: 14,
    fontWeight: 700,
    color: C.text,
  },
  moreSub: {
    display: 'block',
    fontSize: 12,
    color: C.textDim,
    marginTop: 2,
  },

  // Bottom nav
  bottomNav: {
    position: 'sticky',
    bottom: 0,
    height: 68,
    background: 'rgba(7,11,26,0.92)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: '8px 6px',
    boxSizing: 'border-box',
    zIndex: 50,
  },
  navItem: {
    flex: 1,
    background: 'none',
    border: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: '6px 4px',
    cursor: 'pointer',
    position: 'relative',
  },
  navActivePill: {
    position: 'absolute',
    top: 0,
    left: '50%',
    width: 32,
    height: 3,
    borderRadius: 2,
    background: C.emerald,
    transform: 'translateX(-50%)',
    boxShadow: '0 0 12px rgba(16,185,129,0.6)',
  },
  navLab: { fontSize: 10, fontWeight: 700, letterSpacing: 0.3 },
  // Tiny red dot on the Review nav slot whenever there's ungraded work.
  navBadge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 16,
    height: 16,
    padding: '0 4px',
    borderRadius: 999,
    background: '#ef4444',
    color: '#fff',
    fontSize: 10,
    fontWeight: 800,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 0 2px rgba(7,11,26,1)',
  },

  // Settings drawer
  drawerBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    zIndex: 80,
  },
  drawer: {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    width: 'min(320px, 86vw)',
    background: 'linear-gradient(180deg, #0a0f24, #050810)',
    borderLeft: '1px solid rgba(255,255,255,0.05)',
    boxShadow: '-12px 0 40px rgba(0,0,0,0.5)',
    zIndex: 90,
    paddingTop: 'calc(env(safe-area-inset-top, 0px) + 18px)',
    paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)',
    paddingLeft: '16px',
    paddingRight: '16px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  drawerHero: {
    background:
      'linear-gradient(135deg, rgba(16,185,129,0.16), rgba(5,150,105,0.06))',
    border: '1px solid rgba(16,185,129,0.18)',
    borderRadius: 16,
    padding: '18px 14px',
    textAlign: 'center',
  },
  drawerAvatar: {
    width: 64,
    height: 64,
    borderRadius: 18,
    background: `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDeep})`,
    color: '#fff',
    fontWeight: 800,
    fontSize: 26,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 10px',
  },
  drawerName: { margin: 0, fontSize: 18, fontWeight: 800, color: C.text },
  drawerRoleBadge: {
    display: 'inline-block',
    marginTop: 6,
    padding: '4px 10px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 999,
    fontSize: 11,
    color: C.textDim,
  },
  drawerGroup: { display: 'flex', flexDirection: 'column' },
  drawerGroupLabel: {
    margin: '0 0 10px 4px',
    fontSize: 11,
    fontWeight: 800,
    color: '#64748b',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  drawerLogout: {
    marginTop: 'auto',
    width: '100%',
    padding: '12px 14px',
    border: '1px solid rgba(239,68,68,0.32)',
    background: 'rgba(239,68,68,0.08)',
    borderRadius: 14,
    color: '#fca5a5',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    fontFamily: FONT,
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
    width: 28,
    height: 28,
    background: 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  settingsRowLabel: { flex: 1, fontSize: 14, fontWeight: 600, textAlign: 'left' },

  // Feedback bottom sheet
  fbBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    zIndex: 80,
  },
  fbSheet: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    background: 'linear-gradient(180deg, #0b1226, #060914)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: '14px 18px 28px',
    zIndex: 90,
    boxShadow: '0 -12px 40px rgba(0,0,0,0.5)',
    maxHeight: '80vh',
    overflowY: 'auto',
  },
  fbHandle: {
    width: 36,
    height: 4,
    borderRadius: 4,
    background: 'rgba(255,255,255,0.18)',
    margin: '0 auto 14px',
  },
  fbTitle: { margin: 0, fontSize: 17, fontWeight: 800, color: C.text },
  fbDesc: { margin: '6px 0 14px', fontSize: 13, color: C.textDim },
  fbTextarea: {
    width: '100%',
    minHeight: 120,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 14,
    color: C.text,
    fontFamily: FONT,
    fontSize: 14,
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box',
  },
  fbSubmit: {
    marginTop: 14,
    width: '100%',
    padding: 14,
    border: 'none',
    borderRadius: 14,
    background: `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDeep})`,
    color: '#fff',
    fontWeight: 800,
    fontSize: 15,
    cursor: 'pointer',
    fontFamily: FONT,
  },

  // Discussion forum modal
  forumModal: {
    position: 'fixed',
    inset: 0,
    zIndex: 200,
    background: 'linear-gradient(180deg, #060914, #050811)',
    display: 'flex',
    flexDirection: 'column',
  },
  forumHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 18px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(15,23,42,0.6)',
  },
  forumTitle: { margin: 0, fontSize: 16, fontWeight: 800, color: C.text },
  forumClose: {
    width: 36,
    height: 36,
    padding: 0,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  forumBody: { flex: 1, overflowY: 'auto', padding: '0 4px 24px' },
};
