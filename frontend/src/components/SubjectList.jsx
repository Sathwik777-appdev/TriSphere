import React, { useState, useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';
import { getThemedStyles } from '../styles/theme';
import { motion, AnimatePresence } from 'framer-motion';

export const SubjectList = ({ onSelectSubject, studentClass, selectedSubject: controlledSubject }) => {
  // SubjectList used to keep its OWN selectedSubject state in addition to the
  // parent's, which led to the highlighted-but-not-fetched bug: clicking
  // Chemistry updated this internal state (highlight flipped) but the parent
  // sometimes never saw the change, so the video fetch effect kept running
  // with the old subject. Now this is a controlled component — single source
  // of truth lives in the parent. We keep a tiny `localFallback` only for
  // pre-controlled callers that don't pass `selectedSubject`.
  const [localFallback, setLocalFallback] = useState('Physics');
  const selectedSubject = controlledSubject !== undefined ? controlledSubject : localFallback;
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const isMobile = false;

  // Theme-aware styles
  const { theme: currentTheme, isDark } = useTheme();
  const themedStyles = useMemo(() => getThemedStyles(currentTheme), [currentTheme]);

  // Subject Mapping based on Class Level (1-10)
  const SUBJECT_MAPPING = useMemo(() => {
    const primary = [
      { name: 'Mathematics', icon: '📐' },
      { name: 'English', icon: '📖' },
      { name: 'Science', icon: '🔬' },
      { name: 'Social Studies', icon: '🌍' },
      { name: 'Computer Science', icon: '💻' },
      { name: 'Hindi', icon: '🕉️' },
      { name: 'EVS', icon: '🌱' }
    ];

    const middle = [
      { name: 'Mathematics', icon: '📐' },
      { name: 'Physics', icon: '⚛️' },
      { name: 'Chemistry', icon: '🧪' },
      { name: 'Biology', icon: '🧬' },
      { name: 'History & Civics', icon: '📜' },
      { name: 'Geography', icon: '🌍' },
      { name: 'English', icon: '📖' },
      { name: 'Computer Science', icon: '💻' }
    ];

    const secondary = [
      { name: 'Mathematics', icon: '📐' },
      { name: 'Computer Applications', icon: '💻' },
      { name: 'Physics', icon: '⚛️' },
      { name: 'Chemistry', icon: '🧪' },
      { name: 'Biology', icon: '🧬' },
      { name: 'History & Civics', icon: '📜' },
      { name: 'Geography', icon: '🌍' },
      { name: 'English', icon: '📖' }
    ];

    return { primary, middle, secondary };
  }, []);

  const subjects = useMemo(() => {
    const classNum = parseInt(studentClass) || 10; // Default to 10 if not provided

    if (classNum >= 1 && classNum <= 5) return SUBJECT_MAPPING.primary;
    if (classNum >= 6 && classNum <= 8) return SUBJECT_MAPPING.middle;
    if (classNum >= 9 && classNum <= 10) return SUBJECT_MAPPING.secondary;

    return SUBJECT_MAPPING.secondary; // Fallback
  }, [studentClass, SUBJECT_MAPPING]);

  const handleSelect = (subject) => {
    // Keep localFallback in sync for the uncontrolled-prop fallback path —
    // when a parent passes `selectedSubject`, this is just a no-op echo.
    setLocalFallback(subject);
    onSelectSubject(subject);
    setIsDropdownOpen(false);
  };

  const getButtonStyle = (isSelected) => ({
    padding: '14px 24px',
    border: isSelected ? '1px solid rgba(139, 92, 246, 0.5)' : '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '30px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
    background: isSelected
      ? 'linear-gradient(135deg, #4338ca, #7c3aed)'
      : 'rgba(255, 255, 255, 0.05)',
    color: '#ffffff',
    minWidth: '140px',
    textAlign: 'center',
    boxShadow: isSelected ? '0 4px 15px rgba(124, 58, 237, 0.4)' : 'none',
    backdropFilter: 'blur(4px)',
    letterSpacing: '0.5px'
  });

  // Dark container for RGB theme
  const containerStyle = {
    background: isMobile ? 'transparent' : 'rgba(255, 255, 255, 0.03)',
    border: isMobile ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
    padding: isMobile ? '0 0 12px 0' : '24px',
    borderRadius: '20px',
    marginBottom: isMobile ? '0' : '24px',
    backdropFilter: isMobile ? 'none' : 'blur(16px)',
    WebkitBackdropFilter: isMobile ? 'none' : 'blur(16px)',
    boxShadow: isMobile ? 'none' : '0 8px 32px rgba(0, 0, 0, 0.3)',
    color: '#ffffff'
  };

  const selectedSubjectInfo = subjects.find(s => s.name === selectedSubject) || subjects[0];

  // Mobile Dropdown View
  if (isMobile) {
    return (
      <div style={containerStyle}>
        {/* Dropdown Button */}
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            background: 'rgba(30, 41, 59, 0.9)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            color: '#fff',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)'
          }}
        >
          <span style={{ fontSize: '18px' }}>{selectedSubjectInfo.icon}</span>
          <span style={{ flex: 1, textAlign: 'left' }}>{selectedSubject}</span>
          <motion.span
            animate={{ rotate: isDropdownOpen ? 180 : 0 }}
            style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.5)' }}
          >
            ▼
          </motion.span>
        </button>

        {/* Dropdown Menu */}
        <AnimatePresence>
          {isDropdownOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{
                position: 'absolute',
                left: '16px',
                right: '16px',
                marginTop: '6px',
                background: 'rgba(22, 33, 52, 0.98)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '6px',
                zIndex: 100,
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)'
              }}
            >
              {subjects.map((subject) => (
                <button
                  key={subject.name}
                  onClick={() => handleSelect(subject.name)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '11px 12px',
                    background: selectedSubject === subject.name ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    color: selectedSubject === subject.name ? '#60a5fa' : 'rgba(255, 255, 255, 0.7)',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <span style={{ fontSize: '16px' }}>{subject.icon}</span>
                  <span style={{ flex: 1 }}>{subject.name}</span>
                  {selectedSubject === subject.name && (
                    <span style={{ color: '#3b82f6', fontWeight: 700, fontSize: '12px' }}>✓</span>
                  )}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Desktop Button View
  return (
    <div style={containerStyle}>
      <h3 style={{ color: '#ffffff', marginBottom: '15px' }}>Subjects</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' }}>
        {subjects.map((subject) => (
          <button
            key={subject.name}
            onClick={() => handleSelect(subject.name)}
            style={getButtonStyle(selectedSubject === subject.name)}
          >
            {subject.icon} {subject.name}
          </button>
        ))}
      </div>
    </div>
  );
};
