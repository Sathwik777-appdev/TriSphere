import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import DesktopView from './AdminDashboardDesktop';
import { useIsMobile } from '../hooks/useMediaQuery';
import { logoutUser } from '../services/authService';
import AnimatedLogo from '../components/AnimatedLogo';
import VideoBackground from '../components/VideoBackground';
import MaintenanceGate from '../components/MaintenanceGate';

// ─────────────────────────────────────────────────────────────────────────
// AdminDashboard — viewport gate + maintenance gate
// ─────────────────────────────────────────────────────────────────────────
// The principal / admin console is intentionally desktop-only: it controls
// every school, user, payment and policy in the ecosystem, and we don't
// want anyone driving that surface from a 5-inch screen where mis-taps
// have outsized consequences. On a phone we render an explicit "use a
// laptop" notice (with a logout escape) instead of crashing into the
// desktop layout.
//
// MaintenanceGate wraps EVERYTHING — so when the developer flips the
// platform-wide flag, both the desktop console AND the mobile-blocked
// screen get replaced by the maintenance banner. Developer role is the
// only one that bypasses, by design.
export default function AdminDashboard(props) {
  return (
    <MaintenanceGate>
      <AdminInner {...props} />
    </MaintenanceGate>
  );
}

function AdminInner(props) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <AdminMobileBlocked />;
  }

  return <DesktopView {...props} />;
}

function AdminMobileBlocked() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (e) {
      // Surface to console — the user can still continue to /login
      console.error('Admin mobile logout failed', e);
    } finally {
      navigate('/login');
    }
  };

  return (
    <div style={S.shell}>
      <VideoBackground />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        style={S.card}
      >
        <div style={S.logoRow}>
          <AnimatedLogo variant="auth" withWordmark={false} withTagline={false} />
        </div>

        <div style={S.deviceIcon} aria-hidden>
          💻
        </div>

        <h1 style={S.title}>Desktop-only console</h1>
        <p style={S.body}>
          Respected Admin / Principal — this dashboard is dedicated to
          laptop or desktop for best performance and is unavailable on
          mobile, as it is the control panel of the entire ecosystem.
        </p>

        <div style={S.checklist}>
          <Bullet>School-wide user management &amp; audits</Bullet>
          <Bullet>Bulk operations &amp; data exports</Bullet>
          <Bullet>Crisis alerts &amp; wellbeing reviews</Bullet>
          <Bullet>Subscription &amp; billing controls</Bullet>
        </div>

        <p style={S.hint}>
          Please open <strong style={S.hintBrand}>trisphere-4b121.web.app</strong> on
          your laptop / desktop browser to continue.
        </p>

        <button onClick={handleLogout} style={S.logout}>
          <span style={S.logoutDot} />
          Logout from this device
        </button>
      </motion.div>
    </div>
  );
}

const Bullet = ({ children }) => (
  <li style={S.bullet}>
    <span style={S.bulletDot} />
    <span>{children}</span>
  </li>
);

const FONT =
  '"Google Sans", "Product Sans", "Inter", -apple-system, BlinkMacSystemFont, sans-serif';

const S = {
  shell: {
    minHeight: '100dvh',
    width: '100%',
    backgroundColor: '#070b1a',
    color: '#f1f5f9',
    fontFamily: FONT,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 18px',
    position: 'relative',
    boxSizing: 'border-box',
  },
  card: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: 420,
    padding: '28px 22px 24px',
    background:
      'linear-gradient(180deg, rgba(15,23,42,0.88), rgba(11,18,38,0.96))',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 22,
    boxShadow:
      '0 30px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03) inset',
    backdropFilter: 'blur(18px) saturate(140%)',
    WebkitBackdropFilter: 'blur(18px) saturate(140%)',
    textAlign: 'center',
  },
  logoRow: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 14,
  },
  deviceIcon: {
    fontSize: 38,
    lineHeight: 1,
    marginBottom: 8,
    filter: 'drop-shadow(0 4px 12px rgba(99, 102, 241, 0.35))',
  },
  title: {
    margin: '6px 0 8px',
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: '#f1f5f9',
  },
  body: {
    margin: '0 0 16px',
    fontSize: 14,
    lineHeight: 1.55,
    color: '#cbd5e1',
  },
  checklist: {
    listStyle: 'none',
    padding: '12px 14px',
    margin: '0 auto 16px',
    background: 'rgba(255,255,255,0.025)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 14,
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  bullet: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 12.5,
    color: '#e2e8f0',
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
    background: 'linear-gradient(135deg, #a78bfa, #60a5fa)',
    boxShadow: '0 0 8px rgba(167, 139, 250, 0.6)',
  },
  hint: {
    margin: '0 0 18px',
    fontSize: 12.5,
    color: '#94a3b8',
    lineHeight: 1.5,
  },
  hintBrand: {
    color: '#c4b5fd',
    fontWeight: 700,
    letterSpacing: 0.2,
  },
  logout: {
    width: '100%',
    padding: '12px 14px',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.32)',
    borderRadius: 12,
    color: '#fca5a5',
    fontFamily: FONT,
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
