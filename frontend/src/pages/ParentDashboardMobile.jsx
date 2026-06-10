/**
 * ParentDashboardMobile
 * ───────────────────────────────────────────────────────────────────
 * Mobile-first parent portal. Architecture mirrors StudentDashboardMobile:
 *   • Glass-card visual language on a starfield
 *   • Sticky greeting header (compact on inner tabs)
 *   • 5-slot bottom nav (Home / Performance / Reports / Meetings / More)
 *   • Right-slide settings drawer (Phone & Password, Privacy, Feedback, Logout)
 *   • Smart bottom inset so the nav clears 3-button Android nav
 *   • Lazy-fetch on tab visit; never re-mount kept tabs
 *
 * Data model: each parent has 1..N children (userData.childrenIds). One child
 * is "selected" at a time — every panel that takes a child works off that
 * single source of truth.
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
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
  getDoc,
  updateDoc,
  addDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { logoutUser, getUserData } from '../services/authService';
import { useAuth } from '../hooks/useAuth';
import { useBottomInset } from '../hooks/useBottomInset';
import { safeLocalStorage } from '../utils/storage';
import { warningToast, successToast, errorToast } from '../utils/toast';
import { getFinalQuizScores } from '../utils/quizUtils';
import ErrorBoundary from '../components/ErrorBoundary';
import { colors } from '../styles/theme';
import { useOffline } from '../hooks/useOffline';
import AnimatedLogo from '../components/AnimatedLogo';
// VideoBackground (Three.js Earth + 25K particles) intentionally NOT
// imported here — it was the main source of mobile heating on this
// dashboard. The static dark navy from `S.container` is enough on a
// phone screen; desktop still keeps the immersive 3D backdrop.
import { LogoLoader } from '../components/AnimatedLogo';
import { AccountSettings } from '../components/AccountSettings';
import { PrivacyPolicy } from '../components/PrivacyPolicy';
import { ParentPerformance } from '../components/ParentPerformance';
import { ParentEngagement } from '../components/ParentEngagement';
import { ParentAnnouncements } from '../components/ParentAnnouncements';
import { ProgressReport } from '../components/ProgressReport';
import { MeetingBooking } from '../components/MeetingBooking';
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
  MessageIcon,
  FireIcon,
  TimerIcon,
} from '../components/Icons';

// ── Palette ─────────────────────────────────────────────────────────
const C = {
  bg: '#070b1a',
  surface: 'rgba(15, 23, 42, 0.85)',
  surfaceSoft: 'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.07)',
  text: '#f1f5f9',
  textDim: '#cbd5e1',
  textFaint: '#94a3b8',
  blue: colors.accent.blue,        // #3b82f6
  indigo: colors.accent.indigo,    // #6366f1
  purple: colors.accent.purple,    // #8b5cf6
  success: colors.accent.success,
  warning: colors.accent.warning,
  danger: colors.accent.error,
};

const G = {
  statBlue:   'linear-gradient(135deg, rgba(59,130,246,0.18), rgba(59,130,246,0.04))',
  statIndigo: 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(99,102,241,0.04))',
  statPurple: 'linear-gradient(135deg, rgba(139,92,246,0.18), rgba(139,92,246,0.04))',
  statAmber:  'linear-gradient(135deg, rgba(251,191,36,0.18), rgba(251,191,36,0.04))',
  statGreen:  'linear-gradient(135deg, rgba(34,197,94,0.18), rgba(34,197,94,0.04))',
  statRose:   'linear-gradient(135deg, rgba(244,63,94,0.18), rgba(244,63,94,0.04))',
};

const AUTO_REFRESH_THROTTLE_MS = 60 * 1000;

// Score aggregation (perfect first attempt or average of valid attempts)
// is implemented once in utils/quizUtils — imported at module top.

export default function ParentDashboardMobile() {
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

  // ── Core state ─────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('home');
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [showChildPicker, setShowChildPicker] = useState(false);
  // Pill DOM ref + measured rect — the dropdown is rendered through a
  // portal at <body> level (so it escapes every `backdrop-filter` /
  // transform stacking context in the page) and positioned with
  // `position: fixed` using the pill's bounding rect. This makes
  // "second child gets painted under the Wellbeing card" structurally
  // impossible — there is nothing above the portal to stack against.
  const pillRef = useRef(null);
  const [dropdownRect, setDropdownRect] = useState(null);

  const openChildPicker = useCallback(() => {
    if (pillRef.current) {
      const r = pillRef.current.getBoundingClientRect();
      setDropdownRect({ top: r.bottom + 8, left: r.left, width: r.width });
    }
    setShowChildPicker(true);
  }, []);

  const toggleChildPicker = useCallback(() => {
    setShowChildPicker((open) => {
      if (open) return false;
      if (pillRef.current) {
        const r = pillRef.current.getBoundingClientRect();
        setDropdownRect({ top: r.bottom + 8, left: r.left, width: r.width });
      }
      return true;
    });
  }, []);

  // If the viewport changes while the picker is open (rotation, keyboard
  // dismiss), the cached rect is stale — easiest fix is to just close it.
  useEffect(() => {
    if (!showChildPicker) return;
    const onResize = () => setShowChildPicker(false);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [showChildPicker]);

  // While the child-switcher dropdown is open, freeze the page scroll.
  // Without this, any touch outside the dropdown (or even a slight drag
  // on the catcher) scrolls the home feed underneath, making it look
  // like the dropdown "doesn't scroll" — the page is just sliding past it.
  useEffect(() => {
    if (!showChildPicker) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [showChildPicker]);

  const [stats, setStats] = useState({
    averageScore: 0,
    assignmentsCompleted: 0,
    teacherMessages: 0,
    streak: 0,
    xpBalance: 0,
    lowAlerts: 0,
  });
  const [recentMoods, setRecentMoods] = useState([]);
  const [lastFetchAt, setLastFetchAt] = useState(0);

  // ── Modals / drawers ───────────────────────────────────────────────
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  // ── Keep-mounted tab set (visited tabs stay alive for instant return) ─
  const [mountedTabs, setMountedTabs] = useState(new Set(['home']));
  useEffect(() => {
    setMountedTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  // ── Load the parent's linked children ─────────────────────────────
  // Tries THREE shapes the data has had over time, in order, so old +
  // new + half-migrated accounts all work:
  //   1) `userData.childrenIds: string[]` — canonical / current shape
  //   2) `userData.children: {id, ...}[]` — legacy object-array shape
  //   3) Reverse lookup — students where `parentId === user.uid`
  // If any later path resolves children but `childrenIds` was empty, we
  // also auto-write the resolved IDs back to the parent doc so the next
  // page load uses the fast path (and the data stays consistent).
  useEffect(() => {
    if (!userData || !user?.uid) return;
    let cancelled = false;

    (async () => {
      try {
        let resolved = [];
        let resolvedVia = 'none';

        const enrichById = async (id) => {
          try {
            const d = await getUserData(id);
            return d
              ? {
                  id,
                  name: d.username || d.name || 'Child',
                  class: d.class ?? d.classNumber ?? '—',
                  email: d.email || '',
                }
              : null;
          } catch (err) {
            console.warn(`ParentMobile: getUserData failed for ${id}`, err);
            return null;
          }
        };

        // ── Path 1: childrenIds (string array) ──────────────────────
        const ids = Array.isArray(userData.childrenIds) ? userData.childrenIds : [];
        if (ids.length > 0) {
          resolved = (await Promise.all(ids.map(enrichById))).filter(Boolean);
          if (resolved.length > 0) resolvedVia = 'childrenIds';
        }

        // ── Path 2: children (object array) ─────────────────────────
        if (resolved.length === 0 && Array.isArray(userData.children) && userData.children.length > 0) {
          const objIds = userData.children
            .map((c) => (typeof c === 'string' ? c : c?.id))
            .filter(Boolean);
          resolved = (await Promise.all(objIds.map(enrichById))).filter(Boolean);
          if (resolved.length > 0) resolvedVia = 'children-array';
        }

        // ── Path 3: reverse parentId lookup ─────────────────────────
        if (resolved.length === 0) {
          try {
            const snap = await getDocs(
              query(
                collection(db, 'users'),
                where('role', '==', 'student'),
                where('parentId', '==', user.uid),
                limit(20)
              )
            );
            resolved = snap.docs.map((d) => {
              const x = d.data();
              return {
                id: d.id,
                name: x.username || x.name || 'Child',
                class: x.class ?? x.classNumber ?? '—',
                email: x.email || '',
              };
            });
            if (resolved.length > 0) resolvedVia = 'parentId-reverse';
          } catch (err) {
            console.warn('ParentMobile: reverse parentId lookup failed', err);
          }
        }

        if (cancelled) return;

        if (resolved.length > 0) {
          console.info(
            `ParentMobile: linked ${resolved.length} child(ren) via ${resolvedVia}.`
          );

          // ── Auto-repair: backfill childrenIds on the parent doc so
          // future visits use the fast path. Only when we found kids
          // via a non-canonical path AND the parent doesn't already
          // have them recorded. Best effort — failure isn't fatal.
          if (resolvedVia !== 'childrenIds') {
            try {
              const resolvedIds = resolved.map((c) => c.id);
              const existingIds = Array.isArray(userData.childrenIds)
                ? userData.childrenIds
                : [];
              const same =
                existingIds.length === resolvedIds.length &&
                existingIds.every((id, i) => id === resolvedIds[i]);
              if (!same) {
                await updateDoc(doc(db, 'users', user.uid), {
                  childrenIds: resolvedIds,
                });
                console.info('ParentMobile: backfilled childrenIds on parent doc.');
              }
            } catch (err) {
              console.warn('ParentMobile: childrenIds backfill failed', err);
            }
          }
        }

        setChildren(resolved);
        if (resolved.length > 0) setSelectedChild(resolved[0]);
      } catch (e) {
        console.warn('ParentMobile: child fetch failed', e);
      } finally {
        if (!cancelled) setLoadingChildren(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userData, user?.uid]);

  // ── Load per-child stats + wellbeing whenever the selected child changes ─
  const loadChildData = useCallback(async () => {
    if (!selectedChild?.id) return;
    setLastFetchAt(Date.now());
    try {
      const isDeveloper = userData?.role === 'developer';
      const schoolName = userData?.schoolName || '';
      const schoolFilter = isDeveloper ? [] : [where('schoolName', '==', schoolName)];

      // Performance: best/recent quiz scores
      const quizSnap = await getDocs(
        query(collection(db, 'quizResults'), where('studentId', '==', selectedChild.id))
      );
      const allQ = quizSnap.docs.map((d) => d.data());
      const finals = getFinalQuizScores(allQ).filter((r) => !r.malpractice);
      const avg =
        finals.length > 0
          ? Math.round(finals.reduce((s, r) => s + (r.score || 0), 0) / finals.length)
          : 0;
      const lowAlerts = finals.filter((r) => (r.score || 0) < 40).length;

      // Submissions
      const subSnap = await getDocs(
        query(
          collection(db, 'studentSubmissions'),
          where('studentId', '==', selectedChild.id)
        )
      );

      // Announcements visible to the child's class
      const annSnap = await getDocs(
        query(
          collection(db, 'announcements'),
          where('class', '==', selectedChild.class),
          ...schoolFilter
        )
      );

      // Child's gamification stats (xp, streak).
      //
      // Two source-of-truth fixes vs. the old code:
      //   - XP lives in `userStore/{uid}.xpBalance`, NOT
      //     `users/{uid}.stats.xpBalance`. The user doc rarely carries
      //     this field, so we were reading undefined → 0.
      //   - Streak is not persisted on the user doc either; the student
      //     dashboard computes it on the fly from `activityLogs`. We do
      //     the same here so the parent sees a real number.
      let streak = 0;
      let xpBalance = 0;

      try {
        const storeSnap = await getDoc(doc(db, 'userStore', selectedChild.id));
        if (storeSnap.exists()) {
          xpBalance = storeSnap.data().xpBalance || 0;
        }
      } catch (err) {
        console.warn('ParentMobile: userStore read failed', err);
      }

      try {
        const childSnap = await getDoc(doc(db, 'users', selectedChild.id));
        if (childSnap.exists()) {
          streak = childSnap.data().stats?.streak || 0;
        }
      } catch (err) {
        console.warn('ParentMobile: child user doc read failed', err);
      }

      // Wellbeing — last 5 ASTRA mood check-ins
      const moodSnap = await getDocs(
        query(
          collection(db, 'studentMoods'),
          where('userId', '==', selectedChild.id),
          orderBy('createdAt', 'desc'),
          limit(5)
        )
      ).catch(() => null);
      const moods = moodSnap
        ? moodSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
        : [];

      setStats({
        averageScore: avg,
        assignmentsCompleted: subSnap.size,
        teacherMessages: annSnap.size,
        streak,
        xpBalance,
        lowAlerts,
      });
      setRecentMoods(moods);
    } catch (e) {
      console.warn('ParentMobile: child data load failed', e);
    }
  }, [selectedChild, userData]);

  useEffect(() => {
    if (selectedChild?.id) loadChildData();
  }, [selectedChild?.id, loadChildData]);

  // Auto-refresh on tab focus / online (throttled). Mirrors the student dashboard.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastFetchAt < AUTO_REFRESH_THROTTLE_MS) return;
      loadChildData();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener('online', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('online', onVisible);
    };
  }, [lastFetchAt, loadChildData]);

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
        userName: userData?.username || 'Parent',
        userRole: 'parent',
        childName: selectedChild?.name || '',
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
  }, [feedbackText, selectedChild, user, userData]);

  // ── Derived ────────────────────────────────────────────────────────
  const isHome = activeTab === 'home';
  const tabTitles = {
    home: '',
    performance: 'Performance',
    reports: 'Reports',
    meetings: 'Meetings',
    announcements: 'Announcements',
    engagement: 'Engagement',
  };

  const firstName = useMemo(() => {
    const raw = (userData?.username || userData?.name || user?.displayName || '').trim();
    const first = raw.split(' ')[0];
    return first || 'Parent';
  }, [userData, user]);

  // ── Loading shell ─────────────────────────────────────────────────
  if (loadingChildren) {
    return (
      <div style={S.bootShell}>
        <LogoLoader size={80} label="Connecting Parent Portal…" />
      </div>
    );
  }

  // ── No children linked yet ─────────────────────────────────────────
  if (children.length === 0) {
    return (
      <div style={S.bootShell}>
        <div style={S.emptyCard}>
          <div style={S.emptyIcon}>👨‍👩‍👧</div>
          <h2 style={S.emptyTitle}>No children linked yet</h2>
          <p style={S.emptyDesc}>
            Your account isn't yet connected to a student. Please contact your
            school administrator to link your child's account.
          </p>
          <button onClick={handleLogout} style={S.emptyLogout}>
            <LogoutIcon size={16} color="#fca5a5" /> Logout
          </button>
        </div>
      </div>
    );
  }

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
      {/* ── Settings drawer ───────────────────────────────────────── */}
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
                <div style={S.drawerAvatar}>{firstName.charAt(0).toUpperCase()}</div>
                <h2 style={S.drawerName}>{userData?.username || 'Parent'}</h2>
                <span style={S.drawerRoleBadge}>Parent · {userData?.schoolName || 'School'}</span>
              </div>

              <div style={S.drawerGroup}>
                <h3 style={S.drawerGroupLabel}>Workspace</h3>
                <SettingsRow
                  icon={<AnnouncementIcon size={18} color={C.blue} />}
                  label="Announcements"
                  onClick={() => {
                    setIsSettingsOpen(false);
                    setActiveTab('announcements');
                  }}
                />
                <SettingsRow
                  icon={<MessageIcon size={18} color={C.indigo} />}
                  label="Engagement"
                  onClick={() => {
                    setIsSettingsOpen(false);
                    setActiveTab('engagement');
                  }}
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

      {/* ── Account settings modal ───────────────────────────────── */}
      {showAccountSettings && (
        <AccountSettings onClose={() => setShowAccountSettings(false)} />
      )}

      {/* ── Privacy modal ───────────────────────────────────────── */}
      {showPrivacyPolicy && (
        <PrivacyPolicy
          onAccept={handlePrivacyAccept}
          viewOnly={!!userData?.privacyAccepted}
        />
      )}

      {/* ── Feedback bottom sheet ───────────────────────────────── */}
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
                Tell us what's working or what we can improve for {selectedChild?.name || 'your child'}.
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
                style={{ ...S.fbSubmit, opacity: feedbackSubmitting ? 0.7 : 1 }}
              >
                {feedbackSubmitting ? 'Sending…' : 'Submit Feedback'}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Header ────────────────────────────────────────────────── */}
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
                  {children.length === 1
                    ? `Watching over ${selectedChild?.name}`
                    : `${children.length} children · viewing ${selectedChild?.name}`}
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

        {/* Child switcher pill. The dropdown itself is rendered via a
            portal (see below the header) anchored at <body>, so it
            escapes every parent stacking context in the page —
            particularly the Wellbeing card's backdrop-filter context. */}
        {children.length > 1 && (
          <button
            ref={pillRef}
            onClick={toggleChildPicker}
            style={{
              ...S.childPill,
              marginTop: 12,
              ...(showChildPicker ? S.childPillActive : null),
            }}
            aria-haspopup="listbox"
            aria-expanded={showChildPicker}
          >
            <div style={S.childPillAvatar}>
              {(selectedChild?.name || '?').charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={S.childPillName}>{selectedChild?.name}</div>
              <div style={S.childPillMeta}>
                Class {selectedChild?.class} · tap to switch
              </div>
            </div>
            <div
              style={{
                display: 'inline-flex',
                transform: showChildPicker ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 180ms ease',
              }}
            >
              <ChevronRightIcon size={16} color="#94a3b8" />
            </div>
          </button>
        )}

        {/* Portaled dropdown — lives at <body>, so backdrop-filter on
            any card below cannot paint over it regardless of how the
            stacking-context tree is built up by the page. */}
        {children.length > 1 && typeof document !== 'undefined' &&
          createPortal(
            <AnimatePresence>
              {showChildPicker && dropdownRect && (
                <>
                  <div
                    style={S.childDropdownCatcher}
                    onClick={() => setShowChildPicker(false)}
                    onTouchMove={(e) => e.preventDefault()}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.16, ease: 'easeOut' }}
                    style={{
                      ...S.childDropdown,
                      position: 'fixed',
                      top: dropdownRect.top,
                      left: dropdownRect.left,
                      width: dropdownRect.width,
                    }}
                    role="listbox"
                  >
                    {children.map((c) => {
                      const isActive = c.id === selectedChild?.id;
                      return (
                        <button
                          key={c.id}
                          role="option"
                          aria-selected={isActive}
                          onClick={() => {
                            setSelectedChild(c);
                            setShowChildPicker(false);
                          }}
                          style={{
                            ...S.childOption,
                            borderColor: isActive
                              ? C.blue
                              : 'rgba(255,255,255,0.08)',
                            background: isActive
                              ? 'linear-gradient(135deg, rgba(59,130,246,0.18), rgba(99,102,241,0.10))'
                              : 'rgba(255,255,255,0.03)',
                          }}
                        >
                          <div style={S.childAvatar}>
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex: 1, textAlign: 'left' }}>
                            <div style={S.childName}>{c.name}</div>
                            <div style={S.childMeta}>Class {c.class}</div>
                          </div>
                          {isActive && (
                            <CheckCircleIcon size={20} color={C.blue} />
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

        {/* Quick stats on the Home view */}
        {isHome && (
          <div style={S.statsGrid}>
            <StatBox
              label="Avg score"
              value={`${stats.averageScore}%`}
              icon={<TargetIcon size={16} color={C.purple} />}
              tint={G.statPurple}
            />
            <StatBox
              label="Submitted"
              value={stats.assignmentsCompleted}
              icon={<AssignmentIcon size={16} color={C.blue} />}
              tint={G.statBlue}
            />
            <StatBox
              label="Day streak"
              value={stats.streak}
              icon={<FireIcon size={16} color={C.warning} />}
              tint={G.statAmber}
            />
            <StatBox
              label="Alerts"
              value={stats.lowAlerts}
              icon={<TimerIcon size={16} color={stats.lowAlerts > 0 ? C.danger : C.success} />}
              tint={stats.lowAlerts > 0 ? G.statRose : G.statGreen}
            />
          </div>
        )}
      </div>

      {/* ── Main content ─────────────────────────────────────────── */}
      <main style={{ ...S.main, paddingBottom: bottomInset + 92 }}>
        {mountedTabs.has('home') && (
          <div style={{ display: activeTab === 'home' ? 'block' : 'none' }}>
            <ErrorBoundary mini context="Home View">
              <HomeView
                stats={stats}
                moods={recentMoods}
                child={selectedChild}
                onGoPerformance={() => setActiveTab('performance')}
                onGoReports={() => setActiveTab('reports')}
                onGoMeetings={() => setActiveTab('meetings')}
                onGoAnnouncements={() => setActiveTab('announcements')}
                onGoEngagement={() => setActiveTab('engagement')}
              />
            </ErrorBoundary>
          </div>
        )}

        {mountedTabs.has('performance') && selectedChild && (
          <div style={{ display: activeTab === 'performance' ? 'block' : 'none' }}>
            <PanelWrap>
              <ErrorBoundary mini context="Performance">
                <ParentPerformance
                  childId={selectedChild.id}
                  childName={selectedChild.name}
                  childClass={selectedChild.class}
                  schoolName={userData?.schoolName || ''}
                />
              </ErrorBoundary>
            </PanelWrap>
          </div>
        )}

        {mountedTabs.has('reports') && selectedChild && (
          <div style={{ display: activeTab === 'reports' ? 'block' : 'none' }}>
            <PanelWrap>
              <ErrorBoundary mini context="Progress Reports">
                <ProgressReport
                  role="parent"
                  childId={selectedChild.id}
                  classNumber={selectedChild.class}
                  schoolName={userData?.schoolName || ''}
                />
              </ErrorBoundary>
            </PanelWrap>
          </div>
        )}

        {mountedTabs.has('meetings') && selectedChild && (
          <div style={{ display: activeTab === 'meetings' ? 'block' : 'none' }}>
            <PanelWrap>
              <ErrorBoundary mini context="Meetings Booking">
                <MeetingBooking
                  childId={selectedChild.id}
                  childName={selectedChild.name}
                  childClass={selectedChild.class}
                  schoolName={userData?.schoolName || ''}
                />
              </ErrorBoundary>
            </PanelWrap>
          </div>
        )}

        {mountedTabs.has('announcements') && selectedChild && (
          <div style={{ display: activeTab === 'announcements' ? 'block' : 'none' }}>
            <PanelWrap>
              <ErrorBoundary mini context="Announcements">
                <ParentAnnouncements
                  childClass={selectedChild.class}
                  parentId={user?.uid}
                  schoolName={userData?.schoolName || ''}
                />
              </ErrorBoundary>
            </PanelWrap>
          </div>
        )}

        {mountedTabs.has('engagement') && selectedChild && (
          <div style={{ display: activeTab === 'engagement' ? 'block' : 'none' }}>
            <PanelWrap>
              <ErrorBoundary mini context="Parent Engagement">
                <ParentEngagement
                  childId={selectedChild.id}
                  childName={selectedChild.name}
                  schoolName={userData?.schoolName || ''}
                />
              </ErrorBoundary>
            </PanelWrap>
          </div>
        )}
      </main>

      {/* ── Bottom nav (5 slots) ────────────────────────────────── */}
      <nav style={{ ...S.bottomNav, marginBottom: bottomInset }}>
        <NavItem
          icon={<TargetIcon size={20} color="currentColor" />}
          label="Home"
          active={activeTab === 'home'}
          onClick={() => setActiveTab('home')}
        />
        <NavItem
          icon={<CheckCircleIcon size={20} color="currentColor" />}
          label="Perform"
          active={activeTab === 'performance'}
          onClick={() => setActiveTab('performance')}
        />
        <NavItem
          icon={<AssignmentIcon size={20} color="currentColor" />}
          label="Reports"
          active={activeTab === 'reports'}
          onClick={() => setActiveTab('reports')}
        />
        <NavItem
          icon={<TimerIcon size={20} color="currentColor" />}
          label="Meet"
          active={activeTab === 'meetings'}
          onClick={() => setActiveTab('meetings')}
        />
        <NavItem
          icon={<AnnouncementIcon size={20} color="currentColor" />}
          label="Updates"
          active={activeTab === 'announcements'}
          onClick={() => setActiveTab('announcements')}
        />
      </nav>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Home view — quick glance into the child's day, with shortcuts to deep tabs
// ─────────────────────────────────────────────────────────────────────────────
function HomeView({ stats, moods, child, onGoPerformance, onGoReports, onGoMeetings, onGoAnnouncements, onGoEngagement }) {
  const lastMood = moods?.[0];
  const moodLabel = lastMood?.feeling || lastMood?.message || 'No recent check-in';
  const moodSeverity = lastMood?.severity || (lastMood?.needsAttention ? 'high' : 'low');
  const moodTint =
    moodSeverity === 'high'
      ? 'rgba(239,68,68,0.18)'
      : moodSeverity === 'medium'
      ? 'rgba(251,191,36,0.18)'
      : 'rgba(34,197,94,0.18)';
  const moodEdge =
    moodSeverity === 'high'
      ? 'rgba(239,68,68,0.45)'
      : moodSeverity === 'medium'
      ? 'rgba(251,191,36,0.45)'
      : 'rgba(34,197,94,0.45)';

  return (
    <div style={{ padding: '16px 14px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Alert banner if there are low-score quizzes */}
      {stats.lowAlerts > 0 && (
        <button onClick={onGoPerformance} style={S.alertBanner}>
          <div style={S.alertIcon}>⚠️</div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={S.alertTitle}>Academic attention needed</div>
            <div style={S.alertSub}>
              {stats.lowAlerts} recent quiz{stats.lowAlerts > 1 ? 'zes' : ''} below 40% · tap to view
            </div>
          </div>
          <ChevronRightIcon size={16} color="#fca5a5" />
        </button>
      )}

      {/* Wellbeing card */}
      <div 
        onClick={onGoEngagement}
        style={{ 
          ...S.glassCard, 
          padding: 16, 
          cursor: 'pointer',
          transition: 'transform 0.2s ease, background-color 0.2s ease',
          WebkitTapHighlightColor: 'transparent'
        }}
        onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
        onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <div style={S.sectionHeader}>
          <h3 style={S.sectionTitle}>Wellbeing</h3>
          <span style={S.sectionMeta}>Last check-in</span>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 14,
            alignItems: 'center',
            padding: '14px 12px',
            borderRadius: 14,
            background: moodTint,
            border: `1px solid ${moodEdge}`,
          }}
        >
          <div style={{ fontSize: 26 }}>
            {moodSeverity === 'high' ? '🤍' : moodSeverity === 'medium' ? '🟡' : '🟢'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
              {moodSeverity === 'high'
                ? 'Needs your attention'
                : moodSeverity === 'medium'
                ? 'Mild signals'
                : 'Doing well'}
            </div>
            <div
              style={{
                fontSize: 12,
                color: C.textDim,
                marginTop: 2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 220,
              }}
            >
              {moodLabel}
            </div>
          </div>
        </div>

        {moods && moods.length > 1 && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {moods.slice(1).map((m) => (
              <div key={m.id} style={S.miniMoodRow}>
                <span style={{ fontSize: 18 }}>
                  {m.severity === 'high' ? '🤍' : m.severity === 'medium' ? '🟡' : '🟢'}
                </span>
                <span style={{ flex: 1, fontSize: 12, color: C.textDim }}>
                  {m.feeling || m.message || 'Check-in'}
                </span>
                <span style={{ fontSize: 11, color: C.textFaint }}>
                  {(m.createdAt?.toDate?.() || new Date())
                    .toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', fontSize: 11, color: C.blue, fontWeight: 600 }}>
          View Wellbeing Trends →
        </div>
      </div>

      {/* Shortcut grid */}
      <div style={{ ...S.glassCard, padding: 16 }}>
        <div style={S.sectionHeader}>
          <h3 style={S.sectionTitle}>Quick actions</h3>
          <span style={S.sectionMeta}>Tap to open</span>
        </div>
        <div style={S.actionGrid}>
          <ActionTile
            icon={<CheckCircleIcon size={20} color={C.purple} />}
            label="Performance"
            sub="Quiz + assignment trends"
            tint={G.statPurple}
            onClick={onGoPerformance}
          />
          <ActionTile
            icon={<AssignmentIcon size={20} color={C.blue} />}
            label="Progress report"
            sub="Subject-wise insight"
            tint={G.statBlue}
            onClick={onGoReports}
          />
          <ActionTile
            icon={<TimerIcon size={20} color={C.indigo} />}
            label="Book a meeting"
            sub="Connect with teachers"
            tint={G.statIndigo}
            onClick={onGoMeetings}
          />
          <ActionTile
            icon={<AnnouncementIcon size={20} color={C.success} />}
            label="Class updates"
            sub={`${stats.teacherMessages} this month`}
            tint={G.statGreen}
            onClick={onGoAnnouncements}
          />
        </div>
      </div>

      {/* Engagement footnote */}
      <div style={{ ...S.glassCard, padding: 16 }}>
        <div style={S.sectionHeader}>
          <h3 style={S.sectionTitle}>This week</h3>
          <span style={S.sectionMeta}>{child?.name || 'Your child'}</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <MiniMetric label="XP" value={stats.xpBalance?.toLocaleString?.() || 0} accent={C.warning} />
          <MiniMetric label="Submissions" value={stats.assignmentsCompleted} accent={C.blue} />
          <MiniMetric label="Avg" value={`${stats.averageScore}%`} accent={C.purple} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────
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

const MiniMetric = ({ label, value, accent }) => (
  <div style={{ ...S.miniMetric, borderColor: `${accent}33` }}>
    <div style={S.miniMetricValue}>{value}</div>
    <div style={S.miniMetricLabel}>{label}</div>
  </div>
);

const ActionTile = ({ icon, label, sub, tint, onClick }) => (
  <button onClick={onClick} style={{ ...S.actionTile, background: tint }}>
    <div style={S.actionIcon}>{icon}</div>
    <div style={S.actionLabel}>{label}</div>
    <div style={S.actionSub}>{sub}</div>
  </button>
);

const NavItem = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      ...S.navItem,
      color: active ? C.blue : '#94a3b8',
    }}
  >
    {active && <div style={S.navActivePill} />}
    <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex' }}>{icon}</span>
    <span style={{ ...S.navLab, position: 'relative', zIndex: 1 }}>{label}</span>
  </button>
);

const SettingsRow = ({ icon, label, onClick }) => (
  <button onClick={onClick} style={S.settingsRow}>
    <span style={S.settingsRowIcon}>{icon}</span>
    <span style={S.settingsRowLabel}>{label}</span>
    <ChevronRightIcon size={16} color="#475569" />
  </button>
);

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
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
  bootShell: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.bg,
    color: C.text,
    fontFamily: FONT,
    padding: 24,
    flexDirection: 'column',
    gap: 24,
  },

  // Header
  header: {
    paddingTop: 'calc(env(safe-area-inset-top, 0px) + 18px)',
    paddingBottom: '16px',
    paddingLeft: '14px',
    paddingRight: '14px',
    background:
      'linear-gradient(180deg, rgba(59,130,246,0.10) 0%, rgba(7,11,26,0.0) 100%)',
  },
  headerCompact: {
    paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px)',
    paddingBottom: '12px',
    paddingLeft: '14px',
    paddingRight: '14px',
    background:
      'linear-gradient(180deg, rgba(59,130,246,0.10) 0%, rgba(7,11,26,0.0) 100%)',
  },
  headerTop: {
    display: 'grid',
    gridTemplateColumns: '44px 1fr 40px',
    alignItems: 'center',
    gap: 12,
  },
  headerLogo: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
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
  greetingName: { color: C.blue },
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

  // Wrapper that establishes the positioning context for the inline
  // dropdown. Owns the top-margin so the pill itself can stay anchored.
  // The z-index has to clear anything in <main> that opens its own
  // stacking context — the Wellbeing card uses backdrop-filter, which
  // does exactly that, and would otherwise paint over the dropdown's
  // 2nd/3rd child rows. 100 keeps us above main content but the
  // bottom-nav (z 50) stays above the page; the dropdown is anchored
  // to the header so it never reaches the nav region anyway.
  childSwitchWrap: {
    position: 'relative',
    marginTop: 12,
    zIndex: 100,
  },
  childPill: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 12px',
    background: 'rgba(59,130,246,0.10)',
    border: '1px solid rgba(59,130,246,0.25)',
    borderRadius: 14,
    color: C.text,
    cursor: 'pointer',
    fontFamily: FONT,
    transition: 'background 160ms ease, border-color 160ms ease',
  },
  childPillActive: {
    background: 'rgba(59,130,246,0.18)',
    borderColor: 'rgba(59,130,246,0.50)',
  },
  // Tap-away catcher behind the dropdown — fixed full-viewport so any
  // outside tap dismisses, but visually transparent so the page stays lit.
  // `touchAction: none` so a drag on the catcher doesn't bleed through
  // and pan the page underneath. Rendered through a portal at <body>
  // so the z-index is absolute (no stacking context to fight).
  childDropdownCatcher: {
    position: 'fixed',
    inset: 0,
    background: 'transparent',
    zIndex: 9000,
    touchAction: 'none',
  },
  // Dropdown panel — anchored to the bottom of the pill, full pill width.
  childDropdown: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    left: 0,
    right: 0,
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
    // Sits above the catcher so taps on a child option still land.
    zIndex: 9001,
    transformOrigin: 'top center',
    // Internal scroll never bleeds into the page scroll (matters once
    // the list is long enough to need its own scrollbar).
    overscrollBehavior: 'contain',
  },
  childPillAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 15,
    color: '#fff',
    flexShrink: 0,
  },
  childPillName: { fontSize: 14, fontWeight: 700, color: C.text },
  childPillMeta: { fontSize: 11, color: C.textDim, marginTop: 2 },

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
    background: 'rgba(239,68,68,0.10)',
    border: '1px solid rgba(239,68,68,0.30)',
    color: C.text,
    cursor: 'pointer',
    fontFamily: FONT,
  },
  alertIcon: { fontSize: 22 },
  alertTitle: { fontSize: 14, fontWeight: 700, color: '#fca5a5' },
  alertSub: { fontSize: 12, color: '#fecaca', marginTop: 2 },

  // Mood mini row
  miniMoodRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 10px',
    background: 'rgba(255,255,255,0.025)',
    border: '1px solid rgba(255,255,255,0.04)',
    borderRadius: 10,
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

  // Mini metric tiles
  miniMetric: {
    flex: 1,
    padding: '12px 10px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12,
    textAlign: 'center',
  },
  miniMetricValue: { fontSize: 16, fontWeight: 800, color: C.text },
  miniMetricLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: C.textDim,
    marginTop: 4,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
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
    background: C.blue,
    transform: 'translateX(-50%)',
    boxShadow: '0 0 12px rgba(59,130,246,0.6)',
  },
  navLab: { fontSize: 10, fontWeight: 700, letterSpacing: 0.3 },

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
    background: 'linear-gradient(135deg, rgba(59,130,246,0.16), rgba(99,102,241,0.06))',
    border: '1px solid rgba(59,130,246,0.18)',
    borderRadius: 16,
    padding: '18px 14px',
    textAlign: 'center',
  },
  drawerAvatar: {
    width: 64,
    height: 64,
    borderRadius: 18,
    background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
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
    background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
    color: '#fff',
    fontWeight: 800,
    fontSize: 15,
    cursor: 'pointer',
    fontFamily: FONT,
  },

  // Child picker rows
  childOption: {
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
  childAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 16,
    color: '#fff',
    flexShrink: 0,
  },
  childName: { fontSize: 14, fontWeight: 700, color: C.text },
  childMeta: { fontSize: 11, color: C.textDim, marginTop: 2 },

  // Empty state (no children)
  emptyCard: {
    maxWidth: 360,
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 20,
    padding: '28px 22px',
    textAlign: 'center',
  },
  emptyIcon: { fontSize: 48, marginBottom: 14 },
  emptyTitle: { margin: 0, fontSize: 18, fontWeight: 800, color: C.text },
  emptyDesc: {
    margin: '10px 0 18px',
    fontSize: 13,
    color: C.textDim,
    lineHeight: 1.5,
  },
  emptyLogout: {
    padding: '10px 18px',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.3)',
    color: '#fca5a5',
    borderRadius: 12,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
  },
};
