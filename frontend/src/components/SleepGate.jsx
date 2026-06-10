import React from 'react';
import { motion } from 'framer-motion';

export default function SleepGate() {
  return (
    <div style={S.overlay}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={S.card}
      >
        <img
          src="/sleep-buddy.jpg"
          alt="Sleep Time Buddy"
          style={S.image}
        />
        <div style={S.infoContainer}>
          <h2 style={S.title}>Sleep Time Buddy 🌙</h2>
          <p style={S.subtitle}>Better Sleep. Better You.</p>
          <div style={S.divider} />
          <p style={S.description}>
            TriSphere is currently resting to help you get a healthy night's sleep. 
            The app will be available again at <strong>5:00 AM</strong>.
          </p>
          <div style={S.tipCard}>
            <span style={S.tipIcon}>💡</span>
            <span style={S.tipText}>Did you know? Getting 8-10 hours of sleep helps improve your memory, mood, and focus for tomorrow's classes!</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

const S = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999999, // Exceeds all standard modals
    background: 'radial-gradient(circle at center, #0B1528 0%, #050811 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    fontFamily: '"Google Sans", "Product Sans", "Inter", -apple-system, sans-serif',
    overflowY: 'auto',
  },
  card: {
    width: '100%',
    maxWidth: '520px',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '24px',
    overflow: 'hidden',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(99, 102, 241, 0.1)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: 'auto',
    maxHeight: '340px',
    objectFit: 'cover',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  },
  infoContainer: {
    padding: '24px 28px 28px',
    width: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },
  title: {
    fontSize: '22px',
    fontWeight: 800,
    color: '#ffffff',
    margin: '0 0 4px 0',
    letterSpacing: '-0.01em',
  },
  subtitle: {
    fontSize: '14px',
    color: '#a5b4fc',
    margin: '0 0 16px 0',
    fontWeight: 600,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
  },
  divider: {
    width: '60px',
    height: '3px',
    background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
    borderRadius: '2px',
    marginBottom: '16px',
  },
  description: {
    fontSize: '14.5px',
    lineHeight: '1.6',
    color: '#cbd5e1',
    margin: '0 0 20px 0',
  },
  tipCard: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
    padding: '12px 16px',
    borderRadius: '16px',
    background: 'rgba(59, 130, 246, 0.06)',
    border: '1px solid rgba(59, 130, 246, 0.15)',
    textAlign: 'left',
  },
  tipIcon: {
    fontSize: '18px',
    lineHeight: 1,
  },
  tipText: {
    fontSize: '12px',
    lineHeight: '1.5',
    color: '#93c5fd',
  },
};
