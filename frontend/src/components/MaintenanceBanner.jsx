import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { logoutUser } from '../services/authService';

/**
 * MaintenanceBanner
 * ───────────────────────────────────────────────────────────────────
 * Full-viewport screen rendered in place of the role dashboards while
 * maintenance mode is ON. Built around the official maintenance
 * illustration (`/public/maintenance-illustration.png`) so the screen
 * matches the brand artwork exactly — title, illustration, and bell
 * card are all part of the single image.
 *
 * Layout strategy:
 *   • Black backdrop bleeds the image edge-to-edge on any viewport.
 *   • The image is `object-fit: contain` and centered, so it scales
 *     down on phones and stays sharp on 4K monitors without ever
 *     being cropped.
 *   • If a developer set a custom maintenance message, we overlay it
 *     as a small glass card at the bottom — keeps the artwork pure
 *     while still surfacing context.
 *   • A "Logout" button sits below the banner so any non-developer
 *     user (student/teacher/parent/admin) can sign out from the
 *     locked screen — useful on shared devices.
 */
export default function MaintenanceBanner({ message }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (e) {
      console.error('Maintenance-screen logout failed', e);
    } finally {
      // Either way, send them to login. If logout failed, the next
      // login attempt will re-auth them cleanly.
      navigate('/login');
    }
  };

  return (
    <div style={S.shell}>
      <motion.img
        src="/maintenance-illustration.png"
        alt="TriSphere is under maintenance to bring you a better experience"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={S.image}
        draggable={false}
      />

      {message && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          style={S.noteCard}
        >
          <span style={S.noteLabel}>Note from the team</span>
          <p style={S.noteBody}>{message}</p>
        </motion.div>
      )}

      <motion.button
        onClick={handleLogout}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.45 }}
        style={S.logoutBtn}
        onMouseEnter={(e) => Object.assign(e.currentTarget.style, S.logoutBtnHover)}
        onMouseLeave={(e) => Object.assign(e.currentTarget.style, S.logoutBtn)}
        aria-label="Log out from this device"
      >
        <span style={S.logoutDot} />
        Logout from this device
      </motion.button>
    </div>
  );
}

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
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    position: 'relative',
    boxSizing: 'border-box',
    overflow: 'hidden',
  },
  image: {
    maxWidth: 'min(560px, 100%)',
    width: '100%',
    height: 'auto',
    objectFit: 'contain',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    pointerEvents: 'none',
    // Soft ambient halo so the rectangular PNG blends with the page
    // background instead of looking like a pasted-in image.
    filter: 'drop-shadow(0 30px 80px rgba(99, 102, 241, 0.20))',
  },
  noteCard: {
    marginTop: 18,
    width: '100%',
    maxWidth: 480,
    padding: '14px 16px',
    background: 'rgba(99, 102, 241, 0.10)',
    border: '1px solid rgba(99, 102, 241, 0.28)',
    borderRadius: 14,
    textAlign: 'left',
    boxShadow: '0 12px 30px rgba(0,0,0,0.4)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
  },
  noteLabel: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: '#a5b4fc',
    display: 'block',
    marginBottom: 4,
  },
  noteBody: {
    margin: 0,
    fontSize: 13,
    color: '#e2e8f0',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
  },

  // Logout button — sits below the illustration so any locked-out
  // user can still sign out cleanly. Quiet red outline so it doesn't
  // compete with the maintenance artwork above.
  logoutBtn: {
    marginTop: 22,
    padding: '12px 22px',
    minWidth: 220,
    background: 'rgba(239,68,68,0.10)',
    border: '1px solid rgba(239,68,68,0.34)',
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
    transition: 'background 160ms ease, border-color 160ms ease, color 160ms ease',
  },
  logoutBtnHover: {
    marginTop: 22,
    padding: '12px 22px',
    minWidth: 220,
    background: 'rgba(239,68,68,0.18)',
    border: '1px solid rgba(239,68,68,0.55)',
    borderRadius: 12,
    color: '#fecaca',
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
