import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { loginUser } from '../services/authService';
import { successToast, errorToast } from '../utils/toast';
import { validateEmail } from '../utils/validation';
import { useAuth } from '../hooks/useAuth';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

/**
 * TRISPHERE — Mobile Login (reference-matched build)
 *
 * Matches the design the user provided:
 *  • Dark navy card on a starfield background
 *  • Horizontal brand row: TriSphere logo (left) + cyan wordmark + tagline (right)
 *  • Labels ABOVE inputs (autofill-safe), white pill inputs
 *  • Blue gradient "Login" pill CTA
 *  • Footer with divider → POWERED BY → Yugnext-AI brand row → visit/contact
 */
export const LoginPageMobile = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { triggerAppLoader } = useAuth();

  // Tiny stars sprinkled across the canvas. Sized/positioned once on mount.
  const stars = useMemo(
    () =>
      Array.from({ length: 80 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 0.8 + Math.random() * 1.8,
        alpha: 0.25 + Math.random() * 0.65,
        twinkleDelay: -Math.random() * 6,
        twinkleDuration: 3 + Math.random() * 4,
      })),
    [],
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      Haptics.impact({ style: ImpactStyle.Light });
    } catch (err) {}
    const tEmail = email.trim();
    const tPass = password.trim();
    const v = validateEmail(tEmail);
    if (!v.valid) return errorToast(v.error);
    if (!tPass) return errorToast('Password is required');

    setLoading(true);
    try {
      const u = await loginUser(tEmail, tPass);
      triggerAppLoader();
      successToast('Welcome back');
      const r = u.role;
      if (r === 'teacher') navigate('/dashboard/teacher');
      else if (r === 'student') navigate('/dashboard/student');
      else if (r === 'parent') navigate('/dashboard/parent');
      else if (r === 'admin' || r === 'principal') navigate('/dashboard/admin');
      else if (r === 'developer') navigate('/dashboard/developer');
      else navigate('/');
    } catch (err) {
      const m = err?.message || 'Login failed';
      if (m.includes('user-not-found') || m.includes('not registered') || m.includes('not found in database'))
        errorToast('User not found. Ask your school admin to create an account.');
      else if (m.includes('Invalid') || m.includes('wrong-password'))
        errorToast('Incorrect email or password.');
      else if (m.includes('too-many-requests'))
        errorToast('Too many attempts. Try again in a few minutes.');
      else errorToast(m);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={S.page}>
      {/* Starfield */}
      <div style={S.starfield} aria-hidden>
        {stars.map(s => (
          <span
            key={s.id}
            style={{
              position: 'absolute',
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: s.size,
              height: s.size,
              borderRadius: '50%',
              background: `rgba(255, 255, 255, ${s.alpha})`,
              boxShadow: `0 0 ${s.size * 2.5}px rgba(255,255,255,${s.alpha * 0.4})`,
              animation: `lpmTwinkle ${s.twinkleDuration}s ease-in-out infinite`,
              animationDelay: `${s.twinkleDelay}s`,
              willChange: 'opacity',
            }}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        style={S.card}
        className="lpm-card-wrapper"
      >
        {/* ── Brand row ───────────────────────────────────────────── */}
        <div style={S.brandRow} className="lpm-brand-row">
          <div style={S.logoWrap} className="lpm-brand-logo-wrap">
            <img src="/logo.png" alt="TriSphere" style={S.logoImg} className="lpm-brand-logo-img" />
          </div>
          <div style={S.brandText}>
            <h1 style={S.brand} className="lpm-brand-title">TriSphere</h1>
            <p style={S.tagline}>AI-POWERED SCHOOL DASHBOARD</p>
          </div>
        </div>

        {/* ── Form ────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} style={S.form} className="lpm-form">
          <div style={S.field} className="lpm-field">
            <label htmlFor="email" style={S.label}>Email</label>
            <div className="lpm-pill" style={S.inputPill}>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@school.com"
                autoComplete="email"
                className="lpm-input"
                style={S.inputInner}
                required
              />
            </div>
          </div>

          <div style={S.field} className="lpm-field">
            <label htmlFor="password" style={S.label}>Password</label>
            {/* Pure flex-row: input is flex:1, eye button is a fixed-width
                sibling on the right. No absolute positioning, no overlap. */}
            <div className="lpm-pill" style={S.inputPillRow}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                className="lpm-input"
                style={S.inputInnerFlex}
                required
              />
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()} /* keep input focused */
                onClick={() => setShowPassword((s) => !s)}
                className="lpm-eye"
                style={S.eyeBtnFlex}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Login button */}
          <motion.button
            type="submit"
            disabled={loading}
            whileTap={{ scale: 0.985 }}
            style={{ ...S.loginBtn, ...(loading ? S.loginBtnLoading : {}) }}
            className="lpm-login-btn"
          >
            {loading ? (
              <>
                <span style={S.spinner} />
                Logging you in
              </>
            ) : (
              'Login'
            )}
          </motion.button>

          <button type="button" onClick={() => {
            import('../utils/storage').then(({ safeLocalStorage }) => {
              safeLocalStorage.remove('has_seen_landing');
              navigate('/');
            });
          }} style={S.backLink}>
            Go to Landing Page
          </button>
        </form>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <div style={S.divider} className="lpm-divider" />
        <div style={S.footer} className="lpm-footer">
          <p style={S.poweredBy}>POWERED BY</p>
          <div style={S.yugnextRow}>
            <img src="/yugnext-logo.png" alt="Yugnext-AI" style={S.yugnextLogo} />
            <span style={S.yugnextName}>Yugnext-AI</span>
          </div>
          <div style={{ padding: '10px 0' }}>
            <p style={{ ...S.footerLine, marginBottom: '12px' }}>
              Visit:{' '}
              <a
                href="https://www.yugnext-ai.com"
                target="_blank"
                rel="noopener noreferrer"
                onClick={async (e) => {
                  e.preventDefault();
                  if (Capacitor.isNativePlatform()) {
                      await Browser.open({ url: 'https://www.yugnext-ai.com' });
                  } else {
                      window.open('https://www.yugnext-ai.com', '_blank', 'noopener,noreferrer');
                  }
                }}
                style={{ ...S.footerLink, padding: '10px' }}
              >
                www.yugnext-ai.com
              </a>
            </p>
            <p style={{ ...S.footerLine, marginTop: '12px' }}>
              Contact: <a href="mailto:contact@yugnext-ai.com" style={{ ...S.footerLink, padding: '10px' }}>contact@yugnext-ai.com</a>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const FONT = '"Inter", "SF Pro Display", "Google Sans", "Product Sans", -apple-system, BlinkMacSystemFont, sans-serif';
const CYAN = '#67e8f9';

const S = {
  page: {
    minHeight: '100vh',
    width: '100%',
    background: '#070b1c',
    color: '#f1f5f9',
    fontFamily: FONT,
    position: 'relative',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '28px 18px',
    boxSizing: 'border-box',
  },
  // Subtle navy ambient glow on top (very faint, doesn't compete with stars)
  starfield: {
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(30, 58, 138, 0.15), transparent 70%)',
    zIndex: 0,
  },

  // ── Card ──
  card: {
    position: 'relative',
    width: '100%',
    maxWidth: 430,
    background: 'linear-gradient(180deg, rgba(15, 23, 47, 0.85) 0%, rgba(10, 16, 36, 0.92) 100%)',
    border: '1px solid rgba(99, 102, 241, 0.22)',
    borderRadius: 22,
    padding: '24px 22px 22px',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    boxShadow:
      '0 1px 0 rgba(255, 255, 255, 0.06) inset, ' +
      '0 20px 60px rgba(0, 0, 0, 0.55), ' +
      '0 0 40px rgba(59, 130, 246, 0.08)',
    zIndex: 2,
  },

  // ── Brand row ──
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginBottom: 22,
  },
  logoWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    flexShrink: 0,
  },
  logoImg: {
    width: 52,
    height: 52,
    objectFit: 'contain',
    filter: 'drop-shadow(0 0 14px rgba(139, 92, 246, 0.45))',
  },
  brandText: { flex: 1, minWidth: 0 },
  brand: {
    fontSize: 24,
    fontWeight: 800,
    margin: 0,
    color: CYAN,
    letterSpacing: '-0.015em',
    fontFamily: FONT,
    lineHeight: 1.1,
  },
  tagline: {
    fontSize: 9.5,
    fontWeight: 700,
    letterSpacing: 1.3,
    color: 'rgba(255,255,255,0.50)',
    margin: '4px 0 0',
    textTransform: 'uppercase',
  },

  // ── Form ──
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  field: { display: 'flex', flexDirection: 'column', gap: 8 },
  label: {
    fontSize: 13,
    fontWeight: 700,
    color: '#f1f5f9',
    letterSpacing: 0.2,
    marginLeft: 2,
    fontFamily: FONT,
  },

  // Visual pill — fixed-size block with the input filling it.
  inputPill: {
    position: 'relative',
    width: '100%',
    height: 46,
    background: 'rgba(241, 245, 249, 0.96)',
    border: '1px solid rgba(255, 255, 255, 0.10)',
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.20) inset',
    transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
    boxSizing: 'border-box',
  },
  // The input fills the pill.
  inputInner: {
    width: '100%',
    height: '100%',
    padding: '0 16px',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#1e293b',
    fontSize: 14.5,
    fontFamily: FONT,
    fontWeight: 500,
    letterSpacing: 0.1,
    boxSizing: 'border-box',
    display: 'block',
  },
  eyeBtn: {
    position: 'absolute',
    right: 6,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 36,
    height: 36,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    padding: 0,
    zIndex: 2,
    WebkitTapHighlightColor: 'transparent',
  },

  // ── Password field — pure flex-row, no absolute positioning ──
  inputPillRow: {
    display: 'flex',
    alignItems: 'stretch',
    width: '100%',
    height: 46,
    background: 'rgba(241, 245, 249, 0.96)',
    border: '1px solid rgba(255, 255, 255, 0.10)',
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.20) inset',
    transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
    boxSizing: 'border-box',
  },
  inputInnerFlex: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    padding: '0 4px 0 16px',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#1e293b',
    fontSize: 15,
    fontFamily: FONT,
    fontWeight: 500,
    letterSpacing: 0.1,
    boxSizing: 'border-box',
    display: 'block',
  },
  eyeBtnFlex: {
    flex: '0 0 44px',
    height: '100%',
    padding: 0,
    margin: 0,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#475569',
    WebkitTapHighlightColor: 'transparent',
    outline: 'none',
    appearance: 'none',
    WebkitAppearance: 'none',
  },

  // ── Login button (blue gradient pill) ──
  loginBtn: {
    marginTop: 10,
    height: 48,
    padding: '0 22px',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    borderRadius: 12,
    color: '#fff',
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: 0.3,
    cursor: 'pointer',
    background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 50%, #4f46e5 100%)',
    boxShadow:
      '0 1px 0 rgba(255,255,255,0.22) inset, ' +
      '0 8px 26px rgba(37, 99, 235, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.22s ease',
    fontFamily: FONT,
  },
  loginBtnLoading: { opacity: 0.85, cursor: 'wait' },
  spinner: {
    width: 14,
    height: 14,
    border: '2px solid rgba(255,255,255,0.35)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    marginRight: 10,
    animation: 'lpmSpin 0.7s linear infinite',
  },

  // Back link
  backLink: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 12.5,
    fontWeight: 500,
    cursor: 'pointer',
    marginTop: 4,
    padding: 6,
    fontFamily: FONT,
  },

  // ── Footer ──
  divider: {
    height: 1,
    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)',
    margin: '16px -22px 14px',
  },
  footer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  poweredBy: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 2.2,
    color: 'rgba(255, 255, 255, 0.55)',
    margin: '0 0 6px',
  },
  yugnextRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  yugnextLogo: {
    width: 28,
    height: 28,
    borderRadius: 7,
    objectFit: 'cover',
  },
  yugnextName: {
    fontSize: 17,
    fontWeight: 800,
    color: '#fff',
    letterSpacing: '-0.01em',
  },
  footerLine: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.45)',
    margin: 0,
    textAlign: 'center',
  },
  footerLink: {
    color: 'rgba(255, 255, 255, 0.55)',
    textDecoration: 'none',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Keyframes + Chrome-autofill override + placeholder color.
// ─────────────────────────────────────────────────────────────────────────────
if (typeof document !== 'undefined' && !document.getElementById('lpm-kf')) {
  const style = document.createElement('style');
  style.id = 'lpm-kf';
  style.textContent = `
    /* Overrides to protect mobile input sizing from global overrides in index.css */
    input.lpm-input,
    .lpm-pill input.lpm-input {
      min-height: 100% !important;
      height: 100% !important;
      padding: 0 16px !important;
      font-size: 14.5px !important;
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      color: #1e293b !important;
      box-sizing: border-box !important;
    }
    
    .lpm-pill input#password.lpm-input {
      padding: 0 4px 0 16px !important;
    }

    /* Kill Chrome's autofill yellow on the (transparent) input — match the
       pill's cream colour so the input visually stays inside the pill */
    input.lpm-input:-webkit-autofill,
    input.lpm-input:-webkit-autofill:hover,
    input.lpm-input:-webkit-autofill:focus,
    input.lpm-input:-webkit-autofill:active {
      -webkit-text-fill-color: #1e293b !important;
      -webkit-box-shadow: 0 0 0 1000px rgba(241, 245, 249, 0.96) inset !important;
      box-shadow: 0 0 0 1000px rgba(241, 245, 249, 0.96) inset !important;
      transition: background-color 600000s ease-in-out 0s, color 600000s ease-in-out 0s;
      caret-color: #1e293b !important;
    }
    input.lpm-input::placeholder {
      color: rgba(30, 41, 59, 0.40);
      font-weight: 500;
    }
    /* Focus glow lives on the parent pill, triggered by :focus-within */
    .lpm-pill:focus-within {
      border-color: rgba(59, 130, 246, 0.55) !important;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.18), 0 2px 8px rgba(0,0,0,0.20) inset !important;
    }
    .lpm-eye:hover, .lpm-eye:active {
      background: rgba(30, 41, 59, 0.08) !important;
    }
    /* Kill browser default icons inside inputs */
    input.lpm-input::-ms-reveal,
    input.lpm-input::-ms-clear,
    input.lpm-input::-webkit-credentials-auto-fill-button,
    input.lpm-input::-webkit-contacts-auto-fill-button,
    input.lpm-input::-webkit-caps-lock-indicator,
    input.lpm-input::-webkit-strong-password-auto-fill-button {
      display: none !important;
      visibility: hidden !important;
      pointer-events: none !important;
      width: 0 !important;
      height: 0 !important;
      margin: 0 !important;
    }
    /* Clicks on the eye's inner SVG / span should bubble to button */
    .lpm-eye * { pointer-events: none; }
    @keyframes lpmSpin {
      from { transform: rotate(0); }
      to   { transform: rotate(360deg); }
    }
    @keyframes lpmTwinkle {
      0%, 100% { opacity: 1; }
      50%      { opacity: 0.3; }
    }

    /* Handle short screen heights / landscape mode on mobile */
    @media screen and (max-height: 700px) {
      .lpm-card-wrapper {
        padding: 16px 18px 16px !important;
        border-radius: 16px !important;
      }
      .lpm-brand-row {
        margin-bottom: 12px !important;
      }
      .lpm-brand-logo-wrap {
        width: 44px !important;
        height: 44px !important;
      }
      .lpm-brand-logo-img {
        width: 40px !important;
        height: 40px !important;
      }
      .lpm-brand-title {
        font-size: 20px !important;
      }
      .lpm-form {
        gap: 10px !important;
      }
      .lpm-field {
        gap: 6px !important;
      }
      .lpm-pill, .lpm-pill-row {
        height: 40px !important;
      }
      .lpm-login-btn {
        height: 42px !important;
        margin-top: 6px !important;
      }
      .lpm-footer {
        gap: 4px !important;
      }
      .lpm-divider {
        margin: 10px -18px 8px !important;
      }
    }

    @media screen and (max-height: 560px) {
      .lpm-brand-row {
        margin-bottom: 8px !important;
      }
      .lpm-brand-logo-wrap {
        display: none !important; /* Hide logo image to save massive vertical space */
      }
      .lpm-footer {
        display: none !important; /* Hide footer on super short screens to fit the form */
      }
      .lpm-divider {
        display: none !important;
      }
    }
  `;
  document.head.appendChild(style);
}
