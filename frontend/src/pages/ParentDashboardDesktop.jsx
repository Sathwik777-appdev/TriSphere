import React, { useState, useEffect, useMemo, useCallback } from 'react';
// Cache buster: v1.0.3 - Fix Feedback Modal naming and exports (Parent Dashboard Refresh)
import { logoutUser, getUserData } from '../services/authService';
import AnimatedLogo from '../components/AnimatedLogo';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { safeLocalStorage } from '../utils/storage';
import { warningToast, successToast, errorToast } from '../utils/toast';
import { getFinalQuizScores } from '../utils/quizUtils';
import { ChildSelector } from '../components/ChildSelector';
import { ParentAnnouncements } from '../components/ParentAnnouncements';
import { ParentPerformance } from '../components/ParentPerformance';
import { ParentEngagement } from '../components/ParentEngagement';
import { PrivacyPolicy } from '../components/PrivacyPolicy';
import { AccountSettings } from '../components/AccountSettings';
import { collection, query, where, getDocs, orderBy, limit, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import VideoBackground from '../components/VideoBackground';
import { getThemedStyles } from '../styles/theme';
import { useSwipeNavigation } from '../hooks/useSwipeNavigation';
import { MeetingBooking } from '../components/MeetingBooking';
import { ProgressReport } from '../components/ProgressReport';
import Skeleton from '../components/Skeleton';
import ErrorBoundary from '../components/ErrorBoundary';
import { ProfilePhoto } from '../components/ProfilePhoto';
import {
  SettingsIcon,
  LogoutIcon,
  ShieldIcon,
  FeedbackIcon,
  AnnouncementIcon,
  VideoIcon,
  CloseIcon,
  CheckCircleIcon,
  TargetIcon,
  AssignmentIcon
} from '../components/Icons';
import { colors, gradients, shadows, commonStyles } from '../styles/theme';

// Score aggregation lives in utils/quizUtils — it implements the
// two-attempt rule (perfect first attempt counts alone; otherwise the
// final mark is the average of all valid attempts on that chapter).

export const ParentDashboard = () => {
  console.log(`[${new Date().toLocaleTimeString()}] ParentDashboard: COMPONENT MOUNTING`);
  const { user, userData } = useAuth();
  const navigate = useNavigate();
  // Start with no selected child. The fetch below resolves it from
  // childrenIds → children → reverse parentId lookup. We deliberately
  // removed the old hardcoded "Arjun Kumar / Class 8" placeholder
  // because it made the dashboard render with a NON-EXISTENT student
  // id, so every panel silently returned no data and looked broken.
  const [selectedChild, setSelectedChild] = useState(null);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('performance');
  const [stats, setStats] = useState({
    attendance: 0,
    averageScore: 0,
    assignmentsCompleted: 0,
    teacherMessages: 0
  });
  const [showSettings, setShowSettings] = useState(false);
  const { isDark } = useTheme();
  const themedStyles = useMemo(() => getThemedStyles(), []);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showVideoActivity, setShowVideoActivity] = useState(false);
  const [videoActivityLogs, setVideoActivityLogs] = useState([]);
  const [loadingVideoActivity, setLoadingVideoActivity] = useState(false);
  const [recentActivity, setRecentActivity] = useState([]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneEditing, setPhoneEditing] = useState(false);
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [showAccountSettings, setShowAccountSettings] = useState(false);

  // ── Resolve the parent's linked children (3-path lookup) ─────────
  // Tries THREE shapes the data has had over time, in order:
  //   1) `userData.childrenIds: string[]`  (canonical / current)
  //   2) `userData.children: {id, ...}[]`  (legacy object-array)
  //   3) Reverse lookup — `users` where role:'student' AND parentId
  //      matches this parent's uid
  // If anything other than path 1 resolves the children, we auto-write
  // `childrenIds` back to the parent doc so subsequent loads hit the
  // fast path and the data drifts back into a consistent shape.
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
            return d ? {
              id,
              name: d.username || d.name || 'Child',
              class: d.class ?? d.classNumber ?? '—',
              email: d.email || '',
            } : null;
          } catch (err) {
            console.warn(`ParentDashboard: getUserData failed for ${id}`, err);
            return null;
          }
        };

        // Path 1: childrenIds
        const ids = Array.isArray(userData.childrenIds) ? userData.childrenIds : [];
        if (ids.length > 0) {
          resolved = (await Promise.all(ids.map(enrichById))).filter(Boolean);
          if (resolved.length > 0) resolvedVia = 'childrenIds';
        }

        // Path 2: children (object array)
        if (resolved.length === 0 && Array.isArray(userData.children) && userData.children.length > 0) {
          const objIds = userData.children
            .map((c) => (typeof c === 'string' ? c : c?.id))
            .filter(Boolean);
          resolved = (await Promise.all(objIds.map(enrichById))).filter(Boolean);
          if (resolved.length > 0) resolvedVia = 'children-array';
        }

        // Path 3: reverse parentId
        if (resolved.length === 0) {
          try {
            const snap = await getDocs(query(
              collection(db, 'users'),
              where('role', '==', 'student'),
              where('parentId', '==', user.uid),
              limit(20)
            ));
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
            console.warn('ParentDashboard: reverse parentId lookup failed', err);
          }
        }

        if (cancelled) return;

        if (resolved.length > 0) {
          console.info(`ParentDashboard: linked ${resolved.length} child(ren) via ${resolvedVia}`);
          // Auto-repair: backfill childrenIds if we found kids any other way.
          if (resolvedVia !== 'childrenIds') {
            try {
              const resolvedIds = resolved.map((c) => c.id);
              const existingIds = Array.isArray(userData.childrenIds) ? userData.childrenIds : [];
              const same = existingIds.length === resolvedIds.length &&
                existingIds.every((id, i) => id === resolvedIds[i]);
              if (!same) {
                await updateDoc(doc(db, 'users', user.uid), { childrenIds: resolvedIds });
                console.info('ParentDashboard: backfilled childrenIds on parent doc.');
              }
            } catch (err) {
              console.warn('ParentDashboard: childrenIds backfill failed', err);
            }
          }
        }

        setChildren(resolved);
        if (resolved.length > 0) {
          setSelectedChild(resolved[0]);
          try {
            const childStats = safeLocalStorage.get(`studentStats_${resolved[0].id}`);
            if (childStats) {
              setStats({
                attendance: 0,
                averageScore: childStats.averageScore || 0,
                assignmentsCompleted: childStats.tasksCompleted || 0,
                teacherMessages: 0,
              });
            }
          } catch (e) { /* localStorage unavailable */ }
        }
      } catch (e) {
        console.warn('ParentDashboard: child resolution failed', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [userData, user?.uid]);

  // Emergency timeout: if still loading after 5 seconds, show a "Force Load" button
  const [showBypass, setShowBypass] = useState(false);
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        if (loading) setShowBypass(true);
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      setShowBypass(false);
    }
  }, [loading]);

  // Fetch real stats and activity when selected child changes
  useEffect(() => {
    const fetchChildData = async () => {
      if (!selectedChild?.id) return;
      try {
        const isDeveloper = userData?.role === 'developer';
        // Only use schoolName filter for collections that store it (e.g. announcements)
        const schoolFilter = isDeveloper ? [] : [where('schoolName', '==', userData?.schoolName || '')];

        // quizResults has no schoolName field — filter by studentId only
        const quizQuery = query(
          collection(db, 'quizResults'),
          where('studentId', '==', selectedChild.id)
        );
        const quizSnapshot = await getDocs(quizQuery);
        const allQuizResults = quizSnapshot.docs.map(doc => doc.data());
        const finalQuizResults = getFinalQuizScores(allQuizResults);
        const quizScores = finalQuizResults.filter(result => !result.malpractice).map(result => result.score || 0);
        const averageScore = quizScores.length > 0 ? Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length) : 0;
        // studentSubmissions has no schoolName field — filter by studentId only
        const submissionsQuery = query(
          collection(db, 'studentSubmissions'),
          where('studentId', '==', selectedChild.id)
        );
        const submissionsSnapshot = await getDocs(submissionsQuery);
        const assignmentsCompleted = submissionsSnapshot.size;
        // announcements does have schoolName — filter applies
        const announcementsQuery = query(
          collection(db, 'announcements'),
          where('class', '==', selectedChild.class),
          ...schoolFilter
        );
        const announcementsSnapshot = await getDocs(announcementsQuery);
        const teacherMessages = announcementsSnapshot.size;

        setStats(prev => ({ ...prev, averageScore, assignmentsCompleted, teacherMessages }));
      } catch (error) {
        console.error('Error fetching child details:', error);
      }
    };
    fetchChildData();
  }, [selectedChild]);

  const handleLogout = async () => {
    try {
      await logoutUser();
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };



  // Load phone number from userData
  useEffect(() => {
    if (userData?.phoneNumber) {
      setPhoneNumber(userData.phoneNumber);
      setPhoneInput(userData.phoneNumber);
    }
  }, [userData]);

  const handleSavePhone = async () => {
    if (!/^[0-9]{10}$/.test(phoneInput.trim())) {
      warningToast('Please enter a valid 10-digit mobile number');
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

  const handleFeedbackSubmit = async () => {
    if (!feedbackText.trim()) {
      warningToast('Please enter your feedback');
      return;
    }
    setFeedbackSubmitting(true);
    try {
      await addDoc(collection(db, 'feedback'), {
        userId: user.uid,
        userName: userData?.username || 'Unknown',
        userRole: 'parent',
        childName: selectedChild?.name,
        feedback: feedbackText,
        timestamp: new Date(),
        email: userData?.email || user.email
      });
      successToast('Thank you for your feedback!');
      setFeedbackText('');
      setShowFeedback(false);
    } catch (err) {
      errorToast('Error submitting feedback');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const tabs = [
    { id: 'performance', label: '📈 Performance', icon: '📈' },
    { id: 'engagement', label: '💬 Engagement', icon: '💬' },
    { id: 'reports', label: '📊 Reports', icon: '📊' },
    { id: 'meetings', label: '📅 Meetings', icon: '📅' },
    { id: 'announcements', label: '📢 Announcements', icon: '📢' }
  ];

  const handleSwipeLeft = useCallback(() => {
    const currentIndex = tabs.findIndex(t => t.id === activeTab);
    if (currentIndex < tabs.length - 1) setActiveTab(tabs[currentIndex + 1].id);
  }, [activeTab, tabs]);

  const handleSwipeRight = useCallback(() => {
    const currentIndex = tabs.findIndex(t => t.id === activeTab);
    if (currentIndex > 0) setActiveTab(tabs[currentIndex - 1].id);
  }, [activeTab, tabs]);

  const { swipeHandlers } = useSwipeNavigation({
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    threshold: 50
  });

  const handleViewVideoActivity = async () => {
    if (!selectedChild?.id) return;
    setShowVideoActivity(true);
    setLoadingVideoActivity(true);
    setShowSettings(false);
    try {
      const videoLogsQuery = query(collection(db, 'videoActivityLogs'), where('studentId', '==', selectedChild.id), limit(50));
      const snapshot = await getDocs(videoLogsQuery);
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      logs.sort((a, b) => (b.timestamp?.toDate?.() || 0) - (a.timestamp?.toDate?.() || 0));
      setVideoActivityLogs(logs);
    } catch (error) {
      console.error('Error fetching video logs:', error);
    } finally {
      setLoadingVideoActivity(false);
    }
  };

  const markVideoLogAsRead = async (logId) => {
    try {
      await updateDoc(doc(db, 'videoActivityLogs', logId), { read: true });
      setVideoActivityLogs(prev => prev.map(log => log.id === logId ? { ...log, read: true } : log));
    } catch (error) {
      console.error('Error marking log read:', error);
    }
  };

  const renderActiveTab = () => {
    // Without a selected child every panel below would crash on
    // `selectedChild.id`. Render a friendly placeholder instead so the
    // dashboard remains usable while the school admin links the parent.
    if (!selectedChild) {
      return (
        <div style={{
          padding: '40px 24px',
          textAlign: 'center',
          background: 'rgba(15, 23, 42, 0.4)',
          borderRadius: 16,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          color: '#cbd5e1',
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>👨‍👩‍👧</div>
          <h3 style={{ margin: 0, color: '#fff' }}>No child linked yet</h3>
          <p style={{ margin: '10px 0 0', fontSize: 14, color: '#94a3b8' }}>
            Your account isn't yet connected to a student. Please contact your
            school administrator to link your child's account.
          </p>
        </div>
      );
    }
    switch (activeTab) {
      case 'performance':
        return (
          <ErrorBoundary mini context="Child Performance">
            <ParentPerformance childId={selectedChild.id} childName={selectedChild.name} childClass={selectedChild.class} schoolName={userData?.schoolName || ''} />
          </ErrorBoundary>
        );
      case 'engagement':
        return (
          <ErrorBoundary mini context="Child Engagement">
            <ParentEngagement childId={selectedChild.id} childName={selectedChild.name} schoolName={userData?.schoolName || ''} />
          </ErrorBoundary>
        );
      case 'reports':
        return (
          <ErrorBoundary mini context="Progress Reports">
            <ProgressReport role="parent" childId={selectedChild.id} classNumber={selectedChild.class} schoolName={userData?.schoolName || ''} />
          </ErrorBoundary>
        );
      case 'announcements':
        return (
          <ErrorBoundary mini context="Announcements">
            <ParentAnnouncements childClass={selectedChild.class} parentId={user?.uid} schoolName={userData?.schoolName || ''} />
          </ErrorBoundary>
        );
      case 'meetings':
        return (
          <ErrorBoundary mini context="Meetings Booking">
            <MeetingBooking childId={selectedChild.id} childName={selectedChild.name} childClass={selectedChild.class} schoolName={userData?.schoolName || ''} />
          </ErrorBoundary>
        );
      default: return null;
    }
  };

  return (
    <>
      <VideoBackground />
      {showAccountSettings && (
        <AccountSettings onClose={() => setShowAccountSettings(false)} />
      )}

      {/* Desktop Header */}
      <header style={{ ...styles.header, ...themedStyles.header, color: themedStyles.text.primary }}>
          <div style={styles.headerLeft}>
            <div style={styles.logoSection}>
              <AnimatedLogo variant="header" size={40} withWordmark={false} />
              <div>
                <h1 style={{ ...styles.title, color: themedStyles.text.primary }}>Parent Hub</h1>
                <p style={{ ...styles.subtitle, color: themedStyles.text.muted }}>
                  <span style={themedStyles.goldenText}>TriSphere</span> Family Connect
                </p>
              </div>
            </div>
          </div>

          <div style={styles.headerCenter}>
            <div style={styles.greeting}>
              <span style={styles.greetingEmoji}>👋</span>
              <div>
                <p style={{ ...styles.greetingText, color: themedStyles.text.primary }}>Hello, <strong>{userData?.username || 'Parent'}</strong>!</p>
                <p style={{ ...styles.dateInfo, color: themedStyles.text.muted }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
              </div>
            </div>
          </div>

          <div style={styles.settingsContainer}>
            <button onClick={() => setShowSettings(!showSettings)} style={styles.settingsBtn}>
              <SettingsIcon size={18} color="#ffffff" />
            </button>
            {showSettings && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={() => setShowSettings(false)} />
                <div style={{ ...styles.settingsDropdown, ...themedStyles.dropdown, zIndex: 1000 }}>
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
                            {userData?.username || 'Parent'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <span style={{ padding: '2px 8px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' }}>
                              Child: {selectedChild?.name || 'Loading...'}
                            </span>
                          </div>
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
                            setActiveTab('meetings');
                          }}
                          style={{
                            ...styles.feedbackBtn,
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            border: '1px solid rgba(59, 130, 246, 0.2)',
                            flexDirection: 'column',
                            padding: '16px 8px',
                            height: 'auto',
                            borderRadius: '16px',
                            marginBottom: 0
                          }}
                        >
                          <span style={{ fontSize: '24px', marginBottom: '8px' }}>📅</span>
                          <span style={{ fontSize: '12px' }}>Meetings</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowSettings(false);
                            handleViewVideoActivity();
                          }}
                          style={{
                            ...styles.feedbackBtn,
                            backgroundColor: 'rgba(245, 158, 11, 0.1)',
                            border: '1px solid rgba(245, 158, 11, 0.2)',
                            flexDirection: 'column',
                            padding: '16px 8px',
                            height: 'auto',
                            borderRadius: '16px',
                            marginBottom: 0
                          }}
                        >
                          <span style={{ fontSize: '24px', marginBottom: '8px' }}>🎥</span>
                          <span style={{ fontSize: '12px' }}>Activity</span>
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
                            borderRadius: '12px',
                            marginBottom: 0
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
                            borderRadius: '12px',
                            marginBottom: 0
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
                            borderRadius: '12px',
                            marginBottom: 0
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

      <div style={styles.container} className="dashboard-bg">
        {loading ? (
          <div style={styles.content}>
            <Skeleton.Dashboard cardCount={3} showTable={false} />
            {showBypass && (
              <div style={{ textAlign: 'center', marginTop: '20px', padding: '20px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                <p style={{ color: '#ef4444', marginBottom: '10px' }}>Taking longer than usual...</p>
                <button onClick={() => setLoading(false)} style={{ padding: '10px 20px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                  ⚠️ Skip Loading
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div style={styles.statsContainer}>
              <div style={{ ...styles.statCard, ...themedStyles.statCard }}>
                <div style={styles.statIcon}><CheckCircleIcon size={28} color="#10b981" /></div>
                <div style={styles.statContent}>
                  <div style={{ ...styles.statValue, color: themedStyles.text.primary }}>{stats.attendance}%</div>
                  <div style={{ ...styles.statLabel, color: themedStyles.text.muted }}>Attendance</div>
                </div>
              </div>
              <div style={{ ...styles.statCard, ...themedStyles.statCard }}>
                <div style={styles.statIcon}><TargetIcon size={28} color="#3b82f6" /></div>
                <div style={styles.statContent}>
                  <div style={{ ...styles.statValue, color: themedStyles.text.primary }}>{stats.averageScore}%</div>
                  <div style={{ ...styles.statLabel, color: themedStyles.text.muted }}>Avg Score</div>
                </div>
              </div>
              <div style={{ ...styles.statCard, ...themedStyles.statCard }}>
                <div style={styles.statIcon}><AssignmentIcon size={28} color="#8b5cf6" /></div>
                <div style={styles.statContent}>
                  <div style={{ ...styles.statValue, color: themedStyles.text.primary }}>{stats.assignmentsCompleted}</div>
                  <div style={{ ...styles.statLabel, color: themedStyles.text.muted }}>Assignments</div>
                </div>
              </div>
            </div>

            <div style={styles.content}>
              <ChildSelector 
                children={children} 
                selectedChildId={selectedChild?.id} 
                onSelectChild={setSelectedChild} 
              />
              {/* View Selection - Desktop only as Hamburger handles mobile */}
                <div style={{ ...styles.tabNavigation, ...themedStyles.tabNavigation }}>
                  {tabs.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ ...styles.tabButton, ...(activeTab === tab.id ? themedStyles.buttonPrimary : themedStyles.buttonInactive) }}>
                      <span>{tab.icon}</span> <span>{tab.label.split(' ')[1]}</span>
                    </button>
                  ))}
                </div>
              <div style={styles.tabContent} {...swipeHandlers}>{renderActiveTab()}</div>
            </div>

          </>
        )}
      </div>

      {showFeedback && (
        <div style={styles.feedbackModal} onClick={() => setShowFeedback(false)}>
          <div style={styles.feedbackModalContent} onClick={e => e.stopPropagation()}>
            <div style={styles.feedbackModalHeader}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><FeedbackIcon size={20} color="#ffffff" /> Feedback</h3>
              <button onClick={() => setShowFeedback(false)} style={styles.closeBtn}><CloseIcon size={20} color="#ffffff" /></button>
            </div>
            <div style={styles.feedbackModalBody}>
              <textarea value={feedbackText} onChange={e => setFeedbackText(e.target.value)} style={styles.feedbackTextarea} rows={6} />
              <div style={styles.feedbackModalFooter}><button onClick={handleFeedbackSubmit}>{feedbackSubmitting ? '...' : 'Submit'}</button></div>
            </div>
          </div>
        </div>
      )}
      {showPrivacyPolicy && <PrivacyPolicy viewOnly onAccept={() => setShowPrivacyPolicy(false)} />}
      {showVideoActivity && (
        <div style={styles.feedbackModal} onClick={() => setShowVideoActivity(false)}>
          <div style={{ ...styles.feedbackModalContent, maxWidth: '800px' }} onClick={e => e.stopPropagation()}>
            <div style={styles.feedbackModalHeader}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><VideoIcon size={20} color="#ffffff" /> Video Activity</h3>
              <button onClick={() => setShowVideoActivity(false)} style={styles.closeBtn}><CloseIcon size={20} color="#ffffff" /></button>
            </div>
            <div style={{ padding: '20px', maxHeight: '70vh', overflowY: 'auto' }}>
              {videoActivityLogs.map(log => (
                <div key={log.id} style={{ marginBottom: '10px', padding: '10px', border: '1px solid #ddd', borderRadius: '8px' }}>
                  <strong>{log.subject}</strong> - {log.eventType} at {log.timestamp?.toDate?.().toLocaleString()}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </>
  );
};

const styles = {
  container: { minHeight: '100vh', background: 'transparent', overflowY: 'visible' },
  header: {
    background: 'linear-gradient(135deg, #0f172a, #1e3a5f)',
    padding: 'clamp(10px, 2vh, 15px) clamp(16px, 4vw, 20px)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 1000
  },
  headerLeft: { display: 'flex', alignItems: 'center' },
  logoSection: { display: 'flex', alignItems: 'center', gap: '12px' },
  logoImage: { width: '40px', height: '40px', borderRadius: '50%' },
  title: { margin: 0, fontSize: '20px' },
  subtitle: { margin: 0, fontSize: '12px' },
  headerCenter: { flex: 1, display: 'flex', justifyContent: 'center' },
  greeting: { display: 'flex', alignItems: 'center', gap: '12px' },
  greetingEmoji: { fontSize: '24px' },
  greetingText: { margin: 0 },
  dateInfo: { margin: '4px 0 0 0', fontSize: '12px' },
  settingsContainer: { position: 'relative' },
  settingsBtn: {
    padding: '8px',
    background: 'transparent',
    color: 'white',
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.3s ease'
  },
  settingsDropdown: {
    position: 'absolute',
    top: '65px',
    right: '0',
    background: 'rgba(15, 23, 42, 0.8)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRadius: '24px',
    boxShadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 40px rgba(59, 130, 246, 0.1)',
    padding: '24px',
    minWidth: '320px',
    zIndex: 1000,
    border: '1px solid rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    animation: 'fadeIn 0.3s ease-out'
  },
  settingsSection: { marginBottom: '12px' },
  settingsLabel: { fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px', fontWeight: '600' },
  settingsValue: { fontWeight: '600', color: 'white', fontSize: '16px' },
  settingsDivider: { height: '1px', background: 'rgba(255, 255, 255, 0.08)', margin: '16px 0' },
  feedbackBtn: {
    width: '100%',
    padding: '12px',
    marginBottom: '8px',
    borderRadius: '50px',
    cursor: 'pointer',
    border: 'none',
    color: 'white',
    fontSize: '14px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    transition: 'all 0.3s ease'
  },
  logoutBtnDropdown: {
    width: '100%',
    padding: '12px',
    background: 'rgba(239, 64, 64, 0.2)',
    color: 'white',
    border: '1px solid rgba(239, 64, 64, 0.4)',
    borderRadius: '50px',
    cursor: 'pointer',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.3s ease'
  },
  statsContainer: {
    maxWidth: '1200px',
    margin: '20px auto 20px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(clamp(180px, 20vw, 200px), 1fr))',
    gap: 'clamp(12px, 2vw, 20px)',
    padding: '0 clamp(16px, 4vw, 20px)'
  },
  statCard: {
    background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.8))',
    padding: '24px',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    border: '1px solid rgba(51, 65, 85, 0.5)',
    backdropFilter: 'blur(10px)'
  },
  statIcon: {
    width: '56px',
    height: '56px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'inset 0 0 10px rgba(255, 255, 255, 0.05)'
  },
  statContent: { flex: 1 },
  statValue: { fontSize: '28px', fontWeight: '800', letterSpacing: '-0.5px' },
  statLabel: { fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)', fontWeight: '500', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  closeBtn: { background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', borderRadius: '4px', transition: 'all 0.2s' },
  content: { maxWidth: '1200px', margin: '0 auto', padding: 'clamp(12px, 3vw, 20px)' },
  tabNavigation: { display: 'flex', gap: '10px', marginBottom: '20px', overflowX: 'auto' },
  tabButton: { flex: 1, padding: '10px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' },
  tabContent: { marginTop: '20px' },
  feedbackModal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(8px)' },
  feedbackModalContent: { background: 'linear-gradient(135deg, #0f172a, #1e293b)', borderRadius: '24px', width: '90%', maxWidth: '500px', padding: '32px', border: '1px solid rgba(59, 130, 246, 0.3)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' },
  feedbackModalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  feedbackModalBody: { display: 'flex', flexDirection: 'column', gap: '15px' },
  feedbackTextarea: { width: '100%', borderRadius: '8px', padding: '10px' },
  feedbackModalFooter: { display: 'flex', justifyContent: 'flex-end' }
};

export default ParentDashboard;
