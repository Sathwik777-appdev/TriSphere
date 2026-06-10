import React, { useState, useEffect } from 'react';
import { getActiveStudents } from '../services/firestoreService';
import { collection, query, where, getDocs, doc, getDoc, orderBy, limit } from 'firebase/firestore';
import { db } from '../services/firebase';

export const ActivityPanel = ({ classNumber }) => {
  const [activeStudents, setActiveStudents] = useState([]);
  const [inactiveStudents, setInactiveStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAttendance, setShowAttendance] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  useEffect(() => {
    const loadActivity = async () => {
      try {
        const active = await getActiveStudents(classNumber, 24); // Last 24 hours
        setActiveStudents(active);
        setInactiveStudents([]);
      } catch (err) {
        console.error('Error loading activity:', err);
      } finally {
        setLoading(false);
      }
    };

    if (classNumber) {
      loadActivity();
    }
  }, [classNumber]);

  const checkTodayAttendance = async () => {
    setLoadingAttendance(true);
    setShowAttendance(true);

    try {
      // Get the start of the week (Sunday) and end of today
      const today = new Date();
      const dayOfWeek = today.getDay();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - dayOfWeek);
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(today);
      weekEnd.setHours(23, 59, 59, 999);

      // Create array of days in the week
      const daysOfWeek = [];
      for (let i = 0; i < 7; i++) {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + i);
        daysOfWeek.push({
          date: new Date(day),
          label: day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        });
      }

      // Fetch all activity logs (limited to 100)
      const activityQuery = query(
        collection(db, 'activityLogs'),
        orderBy('timestamp', 'desc'),
        limit(100)
      );
      const activitySnapshot = await getDocs(activityQuery);

      // Filter by this week's date range
      const weekLogs = activitySnapshot.docs.filter(doc => {
        const data = doc.data();
        const timestamp = data.timestamp?.toDate?.() || new Date(data.timestamp);
        return timestamp >= weekStart && timestamp <= weekEnd;
      });

      // Get all students from the class
      const usersQuery = query(collection(db, 'users'), where('role', '==', 'student'));
      const usersSnapshot = await getDocs(usersQuery);

      const classInt = parseInt(classNumber);
      const classStr = String(classNumber);

      const studentsInClass = usersSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(student => {
          const studentClass = student.class || student.classNumber;
          return studentClass === classInt || String(studentClass) === classStr;
        });

      // Build attendance data for each student
      const studentsWithAttendance = studentsInClass.map(student => {
        const studentLogs = weekLogs.filter(log => log.data().userId === student.id);

        // Check attendance for each day
        const weekAttendance = daysOfWeek.map(day => {
          const dayStart = new Date(day.date);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(day.date);
          dayEnd.setHours(23, 59, 59, 999);

          const dayLogs = studentLogs.filter(log => {
            const timestamp = log.data().timestamp?.toDate?.() || new Date(log.data().timestamp);
            return timestamp >= dayStart && timestamp <= dayEnd;
          });

          if (dayLogs.length > 0) {
            const timestamps = dayLogs.map(log => log.data().timestamp?.toDate?.() || new Date(log.data().timestamp));
            timestamps.sort((a, b) => a - b);

            // Calculate total active time (sum of intervals between consecutive logs, max 10 min gap per session)
            let totalActiveMinutes = 0;
            for (let i = 0; i < timestamps.length - 1; i++) {
              const timeDiff = (timestamps[i + 1] - timestamps[i]) / (1000 * 60); // minutes
              // If gap is less than 10 minutes, count it as active time
              if (timeDiff <= 10) {
                totalActiveMinutes += timeDiff;
              }
            }

            // Add 5 minutes for the last activity session
            if (timestamps.length > 0) {
              totalActiveMinutes += 5;
            }

            // Mark present if student has any activity (at least logged in once)
            const isPresent = timestamps.length > 0; // Changed from 30 minutes to any activity

            return {
              present: isPresent,
              firstLogin: timestamps[0].toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
              lastActivity: timestamps[timestamps.length - 1].toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
              activeMinutes: Math.round(totalActiveMinutes)
            };
          }
          return { present: false };
        });

        return {
          id: student.id,
          name: student.username || student.email?.split('@')[0] || 'Student',
          weekAttendance: weekAttendance
        };
      }).sort((a, b) => a.name.localeCompare(b.name));

      setTodayAttendance({ students: studentsWithAttendance, days: daysOfWeek });
      console.log('Week attendance:', studentsWithAttendance);
    } catch (err) {
      console.error('Error checking attendance:', err);
      alert('Error loading attendance data');
    } finally {
      setLoadingAttendance(false);
    }
  };

  if (loading) {
    return <div style={styles.container}>Loading activity...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 style={{ margin: 0 }}>Attendance</h3>
        <button onClick={checkTodayAttendance} style={styles.attendanceButton}>
          📋 View Weekly Attendance
        </button>
      </div>

      {/* Today's Attendance Modal */}
      {showAttendance && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0 }}>📋 Weekly Attendance - Class {classNumber}</h3>
              <button onClick={() => setShowAttendance(false)} style={styles.closeButton}>✕</button>
            </div>
            <div style={styles.modalBody}>
              {loadingAttendance ? (
                <p>Loading attendance...</p>
              ) : todayAttendance.students && todayAttendance.students.length > 0 ? (
                <div style={styles.weeklyAttendanceTable}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={styles.tableHeaderCell}>Student Name</th>
                        {todayAttendance.days.map((day, idx) => (
                          <th key={idx} style={styles.tableHeaderCell}>{day.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {todayAttendance.students.map((student, studentIdx) => (
                        <tr key={student.id} style={styles.tableRowStyle(studentIdx)}>
                          <td style={styles.tableCell}>{student.name}</td>
                          {student.weekAttendance.map((attendance, dayIdx) => (
                            <td
                              key={dayIdx}
                              style={{
                                ...styles.tableCell,
                                backgroundColor: attendance.present ? '#d4edda' : '#f8d7da',
                                textAlign: 'center',
                                cursor: attendance.present ? 'pointer' : 'default'
                              }}
                              title={attendance.present ? `First Login: ${attendance.firstLogin}\nLast Activity: ${attendance.lastActivity}\nActive Time: ${attendance.activeMinutes} min` : 'No activity logged'}
                            >
                              {attendance.present ? '✓' : 'X'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={styles.summaryRow}>
                    <strong>Total Students: {todayAttendance.students.length}</strong>
                  </div>
                </div>
              ) : (
                <p style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                  No attendance data available.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Dark-theme design system ──────────────────────────────────────────
// Matches the rest of the app — dark glass cards, white text, subtle
// purple/blue accent borders. The previous styles below were light-mode
// only and rendered as a jarring white block on the otherwise dark
// dashboard pages.
const styles = {
  container: {
    background: 'rgba(15, 23, 42, 0.55)',
    border: '1px solid rgba(255,255,255,0.08)',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    color: '#f1f5f9',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
  },
  section: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.05)',
    padding: 15,
    borderRadius: 12,
    marginTop: 15,
  },
  sectionTitle: {
    margin: '0 0 10px 0',
    fontSize: 15,
    fontWeight: 700,
    color: '#f1f5f9',
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  listItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    fontSize: 14,
    color: '#e2e8f0',
  },
  badge: {
    padding: '3px 10px',
    background: 'rgba(34,197,94,0.18)',
    color: '#86efac',
    border: '1px solid rgba(34,197,94,0.35)',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
  },
  badgeInactive: {
    padding: '3px 10px',
    background: 'rgba(239,68,68,0.18)',
    color: '#fca5a5',
    border: '1px solid rgba(239,68,68,0.35)',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
  },
  noData: {
    color: '#64748b',
    fontStyle: 'italic',
    margin: 0,
  },
  attendanceButton: {
    background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
    color: '#fff',
    border: 'none',
    padding: '10px 20px',
    borderRadius: 10,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    boxShadow: '0 6px 20px rgba(59,130,246,0.25)',
  },
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)',
  },
  modalContent: {
    background: 'linear-gradient(180deg, rgba(15,23,42,0.96), rgba(11,18,38,0.98))',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 16,
    width: '90%',
    maxWidth: 800,
    maxHeight: '80vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    color: '#f1f5f9',
    boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '18px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  closeButton: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    fontSize: 18,
    cursor: 'pointer',
    color: '#cbd5e1',
    padding: '6px 12px',
    borderRadius: 8,
  },
  modalBody: {
    padding: 20,
    overflow: 'auto',
    flex: 1,
  },
  attendanceTable: {
    width: '100%',
  },
  tableHeader: {
    display: 'flex',
    padding: 12,
    background: 'rgba(255,255,255,0.04)',
    borderBottom: '1px solid rgba(255,255,255,0.10)',
    fontWeight: 700,
    color: '#cbd5e1',
  },
  tableRow: (index) => ({
    display: 'flex',
    padding: 12,
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    background: index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
    color: '#e2e8f0',
  }),
  summaryRow: {
    padding: 14,
    background: 'rgba(59,130,246,0.10)',
    border: '1px solid rgba(59,130,246,0.25)',
    marginTop: 10,
    borderRadius: 10,
    textAlign: 'center',
    color: '#bfdbfe',
  },
  weeklyAttendanceTable: {
    width: '100%',
    overflowX: 'auto',
  },
  tableHeaderCell: {
    padding: 12,
    background: 'rgba(255,255,255,0.04)',
    borderBottom: '1px solid rgba(255,255,255,0.10)',
    fontWeight: 700,
    textAlign: 'left',
    fontSize: 13,
    color: '#cbd5e1',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  tableRowStyle: (index) => ({
    background: index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
  }),
  tableCell: {
    padding: 12,
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    fontSize: 14,
    color: '#e2e8f0',
  },
};
