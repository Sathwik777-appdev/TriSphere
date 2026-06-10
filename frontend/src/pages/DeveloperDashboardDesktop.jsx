import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { db, secondaryAuth } from '../services/firebase';
import {
    collection,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    Timestamp,
    query,
    orderBy,
    limit,
    setDoc,
    where
} from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { logoutUser } from '../services/authService';
import { successToast, errorToast } from '../utils/toast';
import styles from './adminDashboardStyles';
import VideoBackground from '../components/VideoBackground';
import { ProfilePhoto } from '../components/ProfilePhoto';
import { motion, AnimatePresence } from 'framer-motion';
import { SettingsIcon } from '../components/Icons';
import BudgetFlowPanel from '../components/BudgetFlowPanel';
import AnimatedLogo from '../components/AnimatedLogo';
import { useMaintenanceMode } from '../hooks/useMaintenanceMode';
import { serverTimestamp } from 'firebase/firestore';

// ── Error Logs Panel Component ──────────────────────────────────────────────
const ErrorLogsPanel = ({ fetchLogs, db }) => {
    const [logs, setLogs] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [filter, setFilter] = React.useState('all'); // 'all' | 'unresolved' | 'resolved'

    React.useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const data = await fetchLogs();
                setLogs(data);
            } catch (e) {
                console.error('ErrorLogsPanel: failed to fetch logs', e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [fetchLogs]);

    const handleResolve = async (logId) => {
        try {
            const { doc, updateDoc } = await import('firebase/firestore');
            await updateDoc(doc(db, 'errorLogs', logId), { resolved: true });
            setLogs(prev => prev.map(l => l.id === logId ? { ...l, resolved: true } : l));
            successToast('Error marked as resolved');
        } catch (e) {
            console.error('ErrorLogsPanel: failed to resolve log', e);
            errorToast('Failed to resolve error');
        }
    };

    const handleDelete = async (logId) => {
        if (!window.confirm('Delete this error log permanently?')) return;
        try {
            const { doc, deleteDoc } = await import('firebase/firestore');
            await deleteDoc(doc(db, 'errorLogs', logId));
            setLogs(prev => prev.filter(l => l.id !== logId));
            successToast('Log deleted successfully');
        } catch (e) {
            console.error('ErrorLogsPanel: failed to delete log', e);
            errorToast('Failed to delete log');
        }
    };

    const filtered = filter === 'all' ? logs
        : filter === 'resolved' ? logs.filter(l => l.resolved)
            : logs.filter(l => !l.resolved);

    const panelStyle = {
        padding: 'clamp(12px, 3vw, 24px)',
        maxWidth: '100%',
        overflowY: 'auto'
    };
    const headingStyle = { color: '#e2e8f0', fontSize: 'clamp(18px, 4vw, 22px)', fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 };
    const filterBarStyle = { display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' };
    const filterBtnStyle = (active) => ({
        padding: '7px 18px',
        borderRadius: 20,
        border: 'none',
        cursor: 'pointer',
        fontWeight: 600,
        fontSize: 13,
        background: active ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.08)',
        color: active ? '#fff' : '#94a3b8',
        transition: 'all 0.2s ease'
    });
    const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
    const thStyle = { textAlign: 'left', padding: '10px 14px', background: 'rgba(255,255,255,0.06)', color: '#94a3b8', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap' };
    const tdStyle = { padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#e2e8f0', verticalAlign: 'top', wordBreak: 'break-word', maxWidth: 'min(320px, 40vw)' };
    const resolvedBadge = { display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: '#10b981', color: '#fff' };
    const unresolvedBadge = { display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: '#ef4444', color: '#fff' };
    const btnSmall = (bg) => ({ padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12, background: bg, color: '#fff', transition: 'opacity 0.2s', marginLeft: 6 });

    return (
        <div style={panelStyle}>
            <h2 style={headingStyle}>🛡️ Error Logs <span style={{ fontSize: 14, fontWeight: 400, color: '#94a3b8' }}>({filtered.length} shown)</span></h2>

            <div style={filterBarStyle}>
                {['all', 'unresolved', 'resolved'].map(f => (
                    <button key={f} style={filterBtnStyle(filter === f)} onClick={() => setFilter(f)}>
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                ))}
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading error logs…</div>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>✅ No error logs found for this filter.</div>
            ) : (
                <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
                    <table style={tableStyle}>
                        <thead>
                            <tr>
                                <th style={thStyle}>Time</th>
                                <th style={thStyle}>Context</th>
                                <th style={thStyle}>Message</th>
                                <th style={thStyle}>Status</th>
                                <th style={thStyle}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(log => (
                                <tr key={log.id}>
                                    <td style={{ ...tdStyle, whiteSpace: 'nowrap', maxWidth: 150 }}>
                                        {log.timestamp?.toDate?.().toLocaleString() || '—'}
                                    </td>
                                    <td style={{ ...tdStyle, maxWidth: 120 }}>{log.context || '—'}</td>
                                    <td style={tdStyle}>
                                        <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#fca5a5' }}>{log.message || '—'}</div>
                                        {log.url && <div style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>URL: {log.url}</div>}
                                    </td>
                                    <td style={tdStyle}>
                                        <span style={log.resolved ? resolvedBadge : unresolvedBadge}>
                                            {log.resolved ? 'Resolved' : 'Open'}
                                        </span>
                                    </td>
                                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                                        {!log.resolved && (
                                            <button style={btnSmall('#10b981')} onClick={() => handleResolve(log.id)} title="Mark as resolved">✓ Resolve</button>
                                        )}
                                        <button style={btnSmall('#ef4444')} onClick={() => handleDelete(log.id)} title="Delete log">🗑</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// ── Maintenance-mode control ──────────────────────────────────────────────
// Sits in the developer header. Reads/writes a SINGLE Firestore doc
// (`systemConfig/maintenance`) so the state is persistent — refreshing
// the page or closing the browser doesn't change anything; only the
// developer explicitly flipping this switch does. Confirm prompt on
// the OFF→ON transition because that takes the whole platform offline
// for every non-developer user.
const MaintenanceControl = () => {
    const { userData } = useAuth();
    const { enabled, message: storedMessage, updatedAt, loading: maintLoading } = useMaintenanceMode();
    const [draftMessage, setDraftMessage] = useState('');
    const [expanded, setExpanded] = useState(false);
    const [saving, setSaving] = useState(false);

    // Keep the local draft in sync with the persisted message when it
    // changes (e.g. another tab updated it).
    useEffect(() => {
        setDraftMessage(storedMessage || '');
    }, [storedMessage]);

    const toggle = async (next) => {
        if (next === enabled || saving) return;
        if (next) {
            const ok = window.confirm(
                'Turn maintenance mode ON?\n\n' +
                'Every student, teacher, parent, and admin will be shown the ' +
                'maintenance banner until you flip it back OFF. You will ' +
                'continue to see your developer console.\n\n' +
                'Continue?'
            );
            if (!ok) return;
        }
        setSaving(true);
        try {
            await setDoc(
                doc(db, 'systemConfig', 'maintenance'),
                {
                    enabled: next,
                    message: next ? (draftMessage || '') : '',
                    updatedAt: serverTimestamp(),
                    updatedBy: userData?.username || userData?.uid || 'developer',
                },
                { merge: true }
            );
            successToast(next ? 'Maintenance mode is now ON' : 'Maintenance mode is now OFF');
        } catch (err) {
            console.error('Maintenance toggle failed', err);
            errorToast('Could not update maintenance state. Try again.');
        } finally {
            setSaving(false);
        }
    };

    const saveMessage = async () => {
        if (!enabled || saving) return;
        setSaving(true);
        try {
            await setDoc(
                doc(db, 'systemConfig', 'maintenance'),
                {
                    enabled: true,
                    message: draftMessage,
                    updatedAt: serverTimestamp(),
                    updatedBy: userData?.username || userData?.uid || 'developer',
                },
                { merge: true }
            );
            successToast('Maintenance message updated');
        } catch (err) {
            console.error('Message save failed', err);
            errorToast('Could not save message');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={MS.wrap}>
            <button
                onClick={() => setExpanded((v) => !v)}
                style={{
                    ...MS.pill,
                    ...(enabled ? MS.pillOn : MS.pillOff),
                }}
                aria-expanded={expanded}
                aria-label="Maintenance mode control"
            >
                <span
                    style={{
                        ...MS.dot,
                        background: enabled ? '#ef4444' : '#10b981',
                        boxShadow: enabled
                            ? '0 0 10px rgba(239,68,68,0.85)'
                            : '0 0 10px rgba(16,185,129,0.7)',
                    }}
                />
                <span style={MS.pillLabel}>
                    {maintLoading ? 'Maintenance…' : enabled ? 'Maintenance ON' : 'All systems normal'}
                </span>
                <span style={MS.chev}>{expanded ? '▴' : '▾'}</span>
            </button>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.96 }}
                        transition={{ duration: 0.16, ease: 'easeOut' }}
                        style={MS.panel}
                    >
                        <div style={MS.row}>
                            <div>
                                <div style={MS.heading}>Maintenance Mode</div>
                                <div style={MS.sub}>
                                    Shows a "platform under maintenance" banner to every
                                    student, teacher, parent and admin. You always bypass it.
                                </div>
                            </div>
                            <Switch checked={enabled} onChange={toggle} disabled={saving} />
                        </div>

                        <label style={MS.label}>Optional message shown on the banner</label>
                        <textarea
                            value={draftMessage}
                            onChange={(e) => setDraftMessage(e.target.value)}
                            placeholder="e.g. We're upgrading the AI tutor. Back in ~2 hours."
                            style={MS.textarea}
                            rows={2}
                            disabled={saving}
                        />
                        <div style={MS.actions}>
                            <button
                                onClick={saveMessage}
                                disabled={!enabled || saving || draftMessage === (storedMessage || '')}
                                style={{
                                    ...MS.btnSecondary,
                                    opacity: !enabled || saving || draftMessage === (storedMessage || '') ? 0.4 : 1,
                                    cursor: !enabled || saving ? 'not-allowed' : 'pointer',
                                }}
                            >
                                Save message
                            </button>
                            {updatedAt && (
                                <span style={MS.timestamp}>
                                    Last changed:{' '}
                                    {(updatedAt?.toDate?.() || new Date(updatedAt))?.toLocaleString?.() || '—'}
                                </span>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const Switch = ({ checked, onChange, disabled }) => (
    <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        disabled={disabled}
        style={{
            width: 52,
            height: 28,
            borderRadius: 999,
            border: 'none',
            background: checked
                ? 'linear-gradient(135deg, #ef4444, #b91c1c)'
                : 'linear-gradient(135deg, #1f2937, #111827)',
            position: 'relative',
            cursor: disabled ? 'wait' : 'pointer',
            transition: 'background 200ms ease',
            flexShrink: 0,
            boxShadow: checked
                ? '0 0 18px rgba(239,68,68,0.4)'
                : '0 0 0 1px rgba(255,255,255,0.08)',
        }}
    >
        <span
            style={{
                position: 'absolute',
                top: 3,
                left: checked ? 27 : 3,
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: '#ffffff',
                transition: 'left 200ms ease',
                boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
            }}
        />
    </button>
);

const MS = {
    wrap: { position: 'relative', display: 'inline-flex', flexDirection: 'column' },
    pill: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 14px',
        borderRadius: 999,
        border: '1px solid',
        background: 'rgba(15, 23, 42, 0.65)',
        color: '#f1f5f9',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 13,
        fontWeight: 700,
        transition: 'background 160ms ease, border-color 160ms ease',
    },
    pillOff: { borderColor: 'rgba(16,185,129,0.35)' },
    pillOn: {
        borderColor: 'rgba(239,68,68,0.55)',
        background: 'rgba(239,68,68,0.10)',
    },
    dot: { width: 9, height: 9, borderRadius: '50%' },
    pillLabel: { letterSpacing: 0.3 },
    chev: { color: '#94a3b8', fontSize: 11, marginLeft: 2 },

    panel: {
        position: 'absolute',
        top: 'calc(100% + 10px)',
        right: 0,
        width: 380,
        padding: 16,
        background: 'rgba(11, 18, 38, 0.96)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 16,
        boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        color: '#f1f5f9',
        zIndex: 998,
        fontFamily: 'inherit',
    },
    row: {
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 14,
    },
    heading: { fontSize: 15, fontWeight: 800, marginBottom: 4 },
    sub: { fontSize: 12, color: '#94a3b8', lineHeight: 1.5 },
    label: {
        display: 'block',
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: 1.4,
        textTransform: 'uppercase',
        color: '#64748b',
        marginBottom: 8,
    },
    textarea: {
        width: '100%',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 10,
        padding: 10,
        color: '#f1f5f9',
        fontFamily: 'inherit',
        fontSize: 13,
        resize: 'vertical',
        outline: 'none',
        boxSizing: 'border-box',
    },
    actions: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        marginTop: 12,
    },
    btnSecondary: {
        padding: '8px 14px',
        background: 'rgba(99,102,241,0.18)',
        border: '1px solid rgba(99,102,241,0.40)',
        borderRadius: 10,
        color: '#c7d2fe',
        fontWeight: 700,
        fontSize: 12,
        fontFamily: 'inherit',
    },
    timestamp: { fontSize: 11, color: '#64748b' },
};

export const DeveloperDashboard = () => {
    const { user, userData } = useAuth();
    const navigate = useNavigate();
    const [activeView, setActiveView] = useState('overview');
    const [showSettings, setShowSettings] = useState(false);
    const [loading, setLoading] = useState(false);
    const [schools, setSchools] = useState([]);

    // School Creation State
    const [schoolData, setSchoolData] = useState({
        schoolName: '',
        adminEmail: '',
        adminPassword: ''
    });
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        fetchSchools();
    }, []);

    const fetchSchools = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'users'), where('role', '==', 'admin'));
            const snapshot = await getDocs(q);
            const schoolList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setSchools(schoolList);
        } catch (error) {
            console.error('Error fetching schools:', error);
            errorToast('Failed to load schools');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSchool = async (e) => {
        e.preventDefault();
        if (!schoolData.schoolName || !schoolData.adminEmail || !schoolData.adminPassword) {
            errorToast('Please fill in all fields');
            return;
        }

        setCreating(true);
        try {
            // Create admin account using secondary auth
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, schoolData.adminEmail, schoolData.adminPassword);
            const newAdmin = userCredential.user;

            // Create admin user document in Firestore
            await setDoc(doc(db, 'users', newAdmin.uid), {
                uid: newAdmin.uid,
                email: schoolData.adminEmail,
                username: 'Admin',
                schoolName: schoolData.schoolName,
                role: 'admin',
                createdAt: Timestamp.now(),
                createdBy: userData?.username || 'Developer',
                createdById: user?.uid,
                _tempPassword: schoolData.adminPassword // Temporarily store for management
            });

            successToast(`School "${schoolData.schoolName}" created successfully!`);
            setSchoolData({ schoolName: '', adminEmail: '', adminPassword: '' });
            await secondaryAuth.signOut();
            fetchSchools();
        } catch (error) {
            console.error('Error creating school:', error);
            errorToast(error.message);
        } finally {
            setCreating(false);
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

    const renderOverview = () => (
        <div style={styles.overviewContainer}>
            <h2 style={styles.sectionTitle}>🚀 School Management</h2>

            <div style={{ ...styles.announcementForm, marginBottom: 40 }}>
                <h3 style={{ ...styles.formLabel, fontSize: 16, marginBottom: 12 }}>✨ Create New School/Admin</h3>
                <form onSubmit={handleCreateSchool} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={styles.formGroup}>
                        <label style={styles.formLabel}>School Name</label>
                        <input
                            type="text"
                            value={schoolData.schoolName}
                            onChange={(e) => setSchoolData({ ...schoolData, schoolName: e.target.value })}
                            placeholder="Enter full school name"
                            style={styles.formInput}
                            required
                        />
                    </div>
                    <div style={styles.formGroup}>
                        <label style={styles.formLabel}>Admin Email</label>
                        <input
                            type="email"
                            value={schoolData.adminEmail}
                            onChange={(e) => setSchoolData({ ...schoolData, adminEmail: e.target.value })}
                            placeholder="admin@school.com"
                            style={styles.formInput}
                            required
                        />
                    </div>
                    <div style={styles.formGroup}>
                        <label style={styles.formLabel}>Admin Password</label>
                        <input
                            type="password"
                            value={schoolData.adminPassword}
                            onChange={(e) => setSchoolData({ ...schoolData, adminPassword: e.target.value })}
                            placeholder="Min 6 characters"
                            style={styles.formInput}
                            required
                            minLength={6}
                        />
                    </div>
                    <button
                        type="submit"
                        style={styles.actionButton}
                        disabled={creating}
                    >
                        {creating ? 'Creating...' : '➕ Create School Admin'}
                    </button>
                </form>
            </div>

            <h3 style={styles.sectionTitle}>🏫 Registered Schools ({schools.length})</h3>
            <div style={styles.tableWrapper}>
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>School Name</th>
                            <th style={styles.th}>Admin Email</th>
                            <th style={styles.th}>Created At</th>
                        </tr>
                    </thead>
                    <tbody>
                        {schools.length === 0 ? (
                            <tr>
                                <td colSpan="3" style={styles.userEmptyState}>No schools registered yet.</td>
                            </tr>
                        ) : (
                            schools.map((school) => (
                                <tr key={school.id} style={styles.tableRow}>
                                    <td style={styles.td}>{school.schoolName || 'Legacy / Unassigned'}</td>
                                    <td style={styles.td}>{school.email}</td>
                                    <td style={styles.td}>
                                        {school.createdAt?.toDate?.().toLocaleDateString() || 'N/A'}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const fetchLogs = async () => {
        try {
            const logsSnap = await getDocs(query(collection(db, 'errorLogs'), orderBy('timestamp', 'desc'), limit(100)));
            return logsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (e) {
            console.error('Error fetching logs:', e);
            return [];
        }
    };

    const renderActiveView = () => {
        switch (activeView) {
            case 'overview':
                return renderOverview();
            case 'error-logs':
                return <ErrorLogsPanel fetchLogs={fetchLogs} db={db} />;
            case 'budget-flow':
                return <BudgetFlowPanel />;
            default:
                return renderOverview();
        }
    };

    const views = [
        { id: 'overview', label: 'Schools', icon: '🏫' },
        { id: 'error-logs', label: 'Error Logs', icon: '🛡️' },
        { id: 'budget-flow', label: 'Credit Flow', icon: '💸' }
    ];

    return (
        <>
            <VideoBackground />
            <div style={styles.container} className="dashboard-bg">
                {/* Header */}
                <header style={styles.header}>
                    <div style={styles.headerLeft}>
                        <div style={styles.logoSection}>
                            <AnimatedLogo variant="header" size={40} withWordmark={false} />
                            <div>
                                <h1 style={styles.title}>Developer Space</h1>
                                <p style={styles.subtitle}>Unified Management Console</p>
                            </div>
                        </div>
                    </div>
                    
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            position: 'relative',
                        }}
                    >
                        {/* Always-visible platform-wide maintenance toggle.
                            Surfaced in the header (not buried in the settings
                            drawer) because flipping this affects every single
                            user — the developer should see the current state
                            at a glance every time they open this page. */}
                        <MaintenanceControl />

                        <div style={styles.settingsContainer}>
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                style={{
                                    ...styles.settingsBtn,
                                    border: 'none',
                                    background: 'transparent'
                                }}
                                aria-label="Open developer console menu"
                                aria-expanded={showSettings}
                            >
                                <SettingsIcon size={24} color="#ffffff" stroke={2} />
                            </button>

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
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        style={{
                                            ...styles.settingsDropdown,
                                            zIndex: 1000
                                        }}
                                    >
                                        {/* Profile Identity Section */}
                                        <div style={{ ...styles.settingsSection, textAlign: 'center', marginBottom: '16px' }}>
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
                                                        {userData?.username || 'Developer'}
                                                    </div>
                                                    <div style={{ fontSize: '12px', color: '#60a5fa', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '800' }}>
                                                        🚀 System Root
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div style={styles.settingsDivider}></div>

                                        {/* Dev Tools Grid */}
                                        <div style={styles.settingsSection}>
                                            <div style={{ ...styles.settingsLabel, marginBottom: '12px' }}>System Tools</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                                <button
                                                    onClick={() => {
                                                        setShowSettings(false);
                                                        setActiveView('error-logs');
                                                    }}
                                                    style={{
                                                        ...styles.actionButton,
                                                        flexDirection: 'column',
                                                        padding: '16px 8px',
                                                        height: 'auto',
                                                        borderRadius: '16px',
                                                        margin: 0,
                                                        width: '100%'
                                                    }}
                                                >
                                                    <span style={{ fontSize: '24px', marginBottom: '8px' }}>🛡️</span>
                                                    <span style={{ fontSize: '12px' }}>Logs</span>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setShowSettings(false);
                                                        setActiveView('overview');
                                                    }}
                                                    style={{
                                                        ...styles.actionButton,
                                                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                                        flexDirection: 'column',
                                                        padding: '16px 8px',
                                                        height: 'auto',
                                                        borderRadius: '16px',
                                                        margin: 0,
                                                        width: '100%'
                                                    }}
                                                >
                                                    <span style={{ fontSize: '24px', marginBottom: '8px' }}>🏫</span>
                                                    <span style={{ fontSize: '12px' }}>Schools</span>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setShowSettings(false);
                                                        setActiveView('budget-flow');
                                                    }}
                                                    style={{
                                                        ...styles.actionButton,
                                                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                                        flexDirection: 'column',
                                                        padding: '16px 8px',
                                                        height: 'auto',
                                                        borderRadius: '16px',
                                                        margin: 0,
                                                        width: '100%',
                                                        gridColumn: '1 / -1'
                                                    }}
                                                >
                                                    <span style={{ fontSize: '24px', marginBottom: '8px' }}>💸</span>
                                                    <span style={{ fontSize: '12px' }}>Credit Flow</span>
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
                                                    height: '45px',
                                                    marginTop: 0
                                                }}
                                            >
                                                🔓 Root Logout
                                            </button>
                                        </div>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                        </div>
                    </div>
                </header>

                <div style={styles.content}>
                    {/* View Selection */}
                    <div style={styles.viewNavigation}>
                        {views.map((view) => (
                            <button
                                key={view.id}
                                onClick={() => setActiveView(view.id)}
                                style={{
                                    ...styles.viewButton,
                                    ...(activeView === view.id ? styles.viewButtonActive : {})
                                }}
                            >
                                <span>{view.icon}</span>
                                <span>{view.label}</span>
                            </button>
                        ))}
                    </div>

                    <div style={styles.viewContent}>
                        {renderActiveView()}
                    </div>
                </div>
            </div>
        </>
    );
};

export default DeveloperDashboard;
