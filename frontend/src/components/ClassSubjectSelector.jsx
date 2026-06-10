import React, { useState, useEffect } from 'react';

export const ClassSubjectSelector = ({ onSelect }) => {
  const [selectedClass, setSelectedClass] = useState(6);
  const [selectedSubject, setSelectedSubject] = useState('Physics');

  const classes = [6, 7, 8, 9, 10];
  const subjects = ['Physics', 'Chemistry', 'Biology', 'Mathematics', 'Computer Studies', 'Geography', 'History & Civics'];

  const handleSelect = () => {
    onSelect({ class: selectedClass, subject: selectedSubject });
  };

  // Auto-load content when class or subject changes
  useEffect(() => {
    handleSelect();
  }, [selectedClass, selectedSubject]);

  // Load initial content on component mount
  useEffect(() => {
    handleSelect();
  }, []);

  return (
    <div style={styles.container}>
      <h2>Select Class & Subject</h2>
      <div style={styles.selectorGroup}>
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Class:</label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(parseInt(e.target.value))}
            style={styles.select}
          >
            {classes.map(cls => (
              <option key={cls} value={cls}>Class {cls}</option>
            ))}
          </select>
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>Subject:</label>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            style={styles.select}
          >
            {subjects.map(subject => (
              <option key={subject} value={subject}>{subject}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: '#f9f9f9',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '20px'
  },
  selectorGroup: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '15px',
    alignItems: 'flex-end'
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column'
  },
  label: {
    marginBottom: '5px',
    fontSize: '14px',
    fontWeight: '500'
  },
  select: {
    padding: '8px 12px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontFamily: 'inherit'
  }
};
