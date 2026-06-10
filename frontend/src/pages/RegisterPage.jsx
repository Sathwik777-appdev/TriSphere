import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerUser } from '../services/authService';
import { getThemedStyles } from '../styles/theme';

export const RegisterPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [role] = useState('student'); // Restricted to student only
  const [classNumber, setClassNumber] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();
  const themedStyles = React.useMemo(() => getThemedStyles(), []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // Pre-processing
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    // Validation
    if (trimmedPassword !== confirmPassword.trim()) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (trimmedPassword.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    // Role is now selected from the dropdown
    if (!role) {
      setError('Please select a role');
      setLoading(false);
      return;
    }

    // Students must provide class number
    if (role === 'student' && !classNumber) {
      setError('Students must provide their class (1-10)');
      setLoading(false);
      return;
    }

    try {
      await registerUser(
        trimmedEmail,
        trimmedPassword,
        username,
        role,
        role === 'student' ? parseInt(classNumber) : null,
        null // No phone credential
      );

      setSuccess('Registration successful! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      let errorMessage = 'Registration failed';
      if (err.message.includes('already registered')) {
        errorMessage = 'Email is already registered. Please login instead.';
      } else if (err.message.includes('email-already-in-use')) {
        errorMessage = 'This email is already in use';
      } else if (err.message.includes('invalid-email')) {
        errorMessage = 'Invalid email address';
      } else if (err.message.includes('weak-password')) {
        errorMessage = 'Password is too weak';
      } else {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.formWrapper}>
        <div style={styles.header}>
          <h1 style={themedStyles.goldenText}>Join TriSphere</h1>
          <p style={styles.subtitle}>Create your account</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your name"
              required
              style={styles.input}
              disabled={loading}
            />
          </div>

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
            <label style={styles.label}>Registering as</label>
            <input 
              type="text" 
              value="Student" 
              readOnly 
              style={{ ...styles.input, backgroundColor: 'rgba(255,255,255,0.05)', cursor: 'default' }} 
            />
          </div>

          {role === 'student' && (
            <div style={styles.formGroup}>
              <label style={styles.label}>Class</label>
              <select
                value={classNumber}
                onChange={(e) => setClassNumber(e.target.value)}
                required
                style={styles.input}
                disabled={loading}
              >
                <option value="">Select your class</option>
                <option value="1">Class 1</option>
                <option value="2">Class 2</option>
                <option value="3">Class 3</option>
                <option value="4">Class 4</option>
                <option value="5">Class 5</option>
                <option value="6">Class 6</option>
                <option value="7">Class 7</option>
                <option value="8">Class 8</option>
                <option value="9">Class 9</option>
                <option value="10">Class 10</option>
              </select>
            </div>
          )}

          <div style={styles.formGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password (min 6 characters)"
              required
              style={styles.input}
              disabled={loading}
              minLength={6}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              required
              style={styles.input}
              disabled={loading}
            />
          </div>

          {error && (
            <div style={styles.error}>
              <strong>Error:</strong> {error}
            </div>
          )}

          {success && (
            <div style={styles.success}>
              <strong>Success!</strong> {success}
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
            {loading ? 'Creating Account...' : 'Register'}
          </button>
        </form>

        <div style={styles.footer}>
          <p>Already have an account? <a href="/login" style={styles.link}>Login here</a></p>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: 'transparent',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '20px'
  },
  formWrapper: {
    background: 'rgba(15, 23, 42, 0.95)',
    borderRadius: '24px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(59, 130, 246, 0.1)',
    padding: '40px',
    width: '100%',
    maxWidth: '450px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    backdropFilter: 'blur(20px)'
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px'
  },
  title: {
    margin: '0 0 10px 0',
    fontSize: '42px',
    fontWeight: '900',
    background: 'linear-gradient(135deg, #60a5fa, #3b82f6)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent'
  },
  subtitle: {
    margin: 0,
    fontSize: '15px',
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '500'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column'
  },
  label: {
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#60a5fa'
  },
  input: {
    padding: '12px 16px',
    fontSize: '14px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '12px',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'all 0.3s',
    boxSizing: 'border-box',
    background: 'rgba(15, 23, 42, 0.8)',
    color: 'white'
  },
  hint: {
    marginTop: '6px',
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.4)'
  },
  button: {
    padding: '14px 24px',
    fontSize: '16px',
    fontWeight: '700',
    color: 'white',
    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
    border: 'none',
    borderRadius: '12px',
    marginTop: '10px',
    boxShadow: '0 6px 20px rgba(37, 99, 235, 0.3)',
    transition: 'all 0.3s ease',
    cursor: 'pointer'
  },
  error: {
    padding: '12px 16px',
    background: 'rgba(239, 68, 68, 0.1)',
    color: '#ef4444',
    borderRadius: '12px',
    fontSize: '14px',
    border: '1px solid rgba(239, 68, 68, 0.2)'
  },
  success: {
    padding: '12px 16px',
    background: 'rgba(16, 185, 129, 0.1)',
    color: '#10b981',
    borderRadius: '12px',
    fontSize: '14px',
    border: '1px solid rgba(16, 185, 129, 0.2)'
  },
  footer: {
    marginTop: '20px',
    textAlign: 'center',
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.6)'
  },
  link: {
    color: '#60a5fa',
    fontWeight: '600',
    textDecoration: 'none'
  }
};
