import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '../services/authService';
import { useAuth } from '../hooks/useAuth';
import { errorToast, successToast } from '../utils/toast';
import VideoBackground from '../components/VideoBackground';
import { validateEmail } from '../utils/validation';
import AnimatedLogo from '../components/AnimatedLogo';

import { useIsMobile } from '../hooks/useMediaQuery';
import { LoginPageMobile } from './LoginPageMobile';

export const LoginPage = () => {
  // ⚠️  ALL hooks MUST be called before any conditional return — otherwise
  // when `useIsMobile` flips from its `false` initial state to `true` after
  // the media-query listener fires, the hook count changes between renders
  // and React throws (Minified React error #300/#310).
  const isMobile = useIsMobile();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated, role, triggerAppLoader } = useAuth();

  useEffect(() => {
    // Redirect if already logged in
    if (isAuthenticated) {
      if (role === 'teacher') navigate('/dashboard/teacher');
      else if (role === 'student') navigate('/dashboard/student');
      else if (role === 'parent') navigate('/dashboard/parent');
      else if (role === 'admin') navigate('/dashboard/admin');
      else if (role === 'developer') navigate('/dashboard/developer');
    }
  }, [isAuthenticated, role, navigate]);

  // Safe to short-circuit AFTER all hooks have run.
  if (isMobile) return <LoginPageMobile />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Pre-processing: Trim inputs to prevent accidental spaces
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    // Validate email format
    const emailValidation = validateEmail(trimmedEmail);
    if (!emailValidation.valid) {
      setError(emailValidation.error);
      return;
    }

    // Validate password is not empty
    if (!trimmedPassword || trimmedPassword.length < 1) {
      setError('Password is required');
      return;
    }

    // Validate password minimum length
    if (trimmedPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const loggedInUser = await loginUser(trimmedEmail, trimmedPassword);
      // Route based on role from Firestore (attached to user object by loginUser)
      const userRole = loggedInUser.role;

      // Start the 5-second loading overlay before navigating to dashboard
      triggerAppLoader();

      successToast('Login successful!');
      if (userRole === 'teacher') navigate('/dashboard/teacher');
      else if (userRole === 'student') navigate('/dashboard/student');
      else if (userRole === 'parent') navigate('/dashboard/parent');
      else if (userRole === 'admin' || userRole === 'principal') navigate('/dashboard/admin');
      else if (userRole === 'developer') navigate('/dashboard/developer');
      else {
        // Fallback: show error if role is unknown
        setError('Unknown user role. Please contact admin.');
        errorToast('Unknown user role');
      }
    } catch (err) {
      let errorMessage = 'Login failed';
      if (err.message.includes('not registered') || err.message.includes('user-not-found') || err.message.includes('not found in database')) {
        errorMessage = 'User not found! Please ask your Admin/Principal to create an account for you.';
      } else if (err.message.includes('Invalid') || err.message.includes('wrong-password')) {
        errorMessage = 'Invalid email or password. Please check and try again.';
      } else if (err.message.includes('suspended')) {
        errorMessage = 'Your account has been suspended. Please contact the administrator.';
      } else {
        errorMessage = err.message;
      }
      setError(errorMessage);
      errorToast(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <VideoBackground isLoginPage={true} />
      <style>{`
        @media (max-width: 768px) {
          .login-container {
            padding-left: 20px !important;
            justify-content: center !important;
          }
          .login-form-wrapper {
            padding: 25px !important;
            max-width: 95% !important;
          }
        }
        @media (max-height: 750px) {
          .login-container {
            padding: 15px !important;
            justify-content: center !important;
            padding-left: 15px !important;
          }
          .login-form-wrapper {
            padding: 25px 30px !important;
            max-width: 400px !important;
          }
        }
        @media (max-height: 600px) {
          .login-form-wrapper {
            padding: 15px 20px !important;
          }
        }
      `}</style>

      <div style={styles.container} className="dashboard-bg login-container">
        <div style={styles.formWrapper} className="login-form-wrapper">
          <div style={styles.header}>
            <AnimatedLogo variant="auth" tagline="AI-Powered School Dashboard" />
          </div>



          <form
            onSubmit={handleSubmit}
            style={styles.form}
          >
            <div style={styles.formGroup}>
              <label style={styles.label}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@domain.com"
                required
                style={styles.input}
                disabled={loading}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Password</label>
              <div style={styles.passwordWrapper}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  style={styles.passwordInput}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  tabIndex="-1"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  )}
                </button>
              </div>
            </div>
            {error && (
              <div style={styles.error}>
                <strong>Error:</strong> {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              style={{
                ...styles.button,
                opacity: loading ? 0.7 : 1,
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>

          </form>

          <div style={{ textAlign: 'center', marginTop: '15px' }}>
            <button
              onClick={() => {
                import('../utils/storage').then(({ safeLocalStorage }) => {
                  safeLocalStorage.remove('has_seen_landing');
                  navigate('/');
                });
              }}
              style={{ ...styles.brandingLink, background: 'none', border: 'none', cursor: 'pointer', opacity: 0.8 }}
            >
              Go to Landing Page
            </button>
          </div>

          <div style={styles.footer}>
            <p style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', textAlign: 'center', margin: '0 0 10px 0', letterSpacing: '1px', textTransform: 'uppercase' }}>
              Powered by
            </p>
            <div style={styles.brandingContent}>
              <img src="/yugnext-logo.png" alt="Yugnext-AI" style={styles.brandingLogo} />
              <span style={styles.brandingName}>Yugnext-AI</span>
            </div>
            <div style={{...styles.brandingInfo, gap: '12px' }}>
              <div style={{ padding: '8px 0' }}>
                <a
                  href="https://www.yugnext-ai.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ ...styles.brandingLink, cursor: 'pointer', padding: '10px' }}
                >
                  Visit: www.yugnext-ai.com
                </a>
              </div>
              <div style={{ padding: '8px 0' }}>
                <a href="mailto:contact@yugnext-ai.com" style={{ ...styles.brandingLink, padding: '10px' }}>
                  Contact: contact@yugnext-ai.com
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingLeft: '10%',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '20px',
    boxSizing: 'border-box'
  },
  formWrapper: {
    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 58, 95, 0.95))',
    borderRadius: '20px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4), 0 0 40px rgba(59, 130, 246, 0.2)',
    padding: '40px',
    width: '100%',
    maxWidth: '420px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    backdropFilter: 'blur(10px)',
    fontFamily: '"Product Sans", "Google Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px'
  },
  logo: {
    width: '180px',
    height: 'auto',
    marginBottom: '16px',
    filter: 'drop-shadow(0 0 20px rgba(59, 130, 246, 0.5))',
    borderRadius: '12px'
  },
  title: {
    margin: '0 0 10px 0',
    fontSize: '42px',
    fontWeight: '900',
    color: '#ffffff',
    textShadow: '0 0 30px rgba(59, 130, 246, 0.5)'
  },
  subtitle: {
    margin: 0,
    fontSize: '15px',
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column'
  },
  label: {
    marginBottom: '10px',
    fontSize: '16px',
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    letterSpacing: '0.3px'
  },
  input: {
    padding: '14px 16px',
    fontSize: '15px',
    border: '1px solid rgba(59, 130, 246, 0.4)',
    borderRadius: '12px',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'all 0.3s',
    boxSizing: 'border-box',
    background: 'rgba(15, 23, 42, 0.9)',
    color: '#ffffff'
  },
  passwordWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  passwordInput: {
    padding: '14px 45px 14px 16px',
    fontSize: '15px',
    border: '1px solid rgba(59, 130, 246, 0.4)',
    borderRadius: '12px',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'all 0.3s',
    boxSizing: 'border-box',
    background: 'rgba(15, 23, 42, 0.9)',
    color: '#ffffff',
    width: '100%'
  },
  eyeButton: {
    position: 'absolute',
    right: '10px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'color 0.2s ease',
    outline: 'none',
    color: 'rgba(148, 163, 184, 0.8)'
  },
  eyeButtonHover: {
    color: 'rgba(59, 130, 246, 1)'
  },
  hint: {
    marginTop: '6px',
    fontSize: '12px',
    color: '#999'
  },
  button: {
    padding: '16px 24px',
    fontSize: '16px',
    fontWeight: '700',
    color: 'white',
    background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
    border: 'none',
    borderRadius: '12px',
    marginTop: '12px',
    boxShadow: '0 6px 20px rgba(59, 130, 246, 0.4)',
    transition: 'all 0.3s ease',
    cursor: 'pointer'
  },
  reloadButton: {
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#ffffff',
    background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.9), rgba(15, 23, 42, 0.9))',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '10px',
    marginTop: '10px',
    transition: 'all 0.3s ease',
    cursor: 'pointer'
  },
  error: {
    padding: '8px 0',
    background: 'transparent',
    color: '#ff4444',
    borderRadius: '0',
    fontSize: '14px',
    fontFamily: '"Product Sans", "Google Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    border: 'none',
    textAlign: 'center'
  },
  infoBox: {
    marginTop: '30px',
    padding: '20px',
    background: 'rgba(30, 58, 95, 0.4)',
    borderRadius: '12px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    fontSize: '13px'
  },
  infoTitle: {
    margin: '0 0 12px 0',
    fontSize: '15px',
    fontWeight: '700',
    background: 'linear-gradient(135deg, #ff0080, #40e0d0)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent'
  },
  footer: {
    marginTop: '20px',
    padding: '15px 0 0 0',
    borderTop: '1px solid rgba(59, 130, 246, 0.2)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  brandingContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '8px'
  },
  brandingLogo: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    boxShadow: '0 0 15px rgba(59, 130, 246, 0.3)'
  },
  brandingName: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: '0.5px'
  },
  brandingInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px'
  },
  brandingLink: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '11px',
    textDecoration: 'none',
    transition: 'all 0.3s ease'
  }
};
