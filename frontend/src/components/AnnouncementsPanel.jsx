import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

export const AnnouncementsPanel = ({ userId, userName, classNumber, schoolName, onAnnouncementCreated }) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [announcements, setAnnouncements] = useState([]);
  const [expandedAnnouncement, setExpandedAnnouncement] = useState(null);

  // Fetch announcements
  useEffect(() => {
    const fetchAnnouncements = async () => {
      if (!classNumber) return;

      try {
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        const isDeveloper = userData?.role === 'developer';
        const schoolFilter = isDeveloper ? [] : [where('schoolName', '==', schoolName || '')];

        // Fetch all announcements from the collection for this school
        const snapshot = await getDocs(query(collection(db, 'announcements'), ...schoolFilter));

        // Filter announcements that are either for 'all' users, 'teachers', or match the teacher's class
        const filteredDocs = snapshot.docs.filter(docSnap => {
          const data = docSnap.data();
          return (
            data.targetAudience === 'all' ||
            data.targetAudience === 'teachers' ||
            (data.class && data.class === classNumber)
          );
        });

        const announcementsData = [];
        for (const docSnap of filteredDocs) {
          const data = docSnap.data();

          // Fetch student-parent pairs
          const studentParentPairs = [];
          const orphanParents = []; // Parents whose children didn't view

          if (data.seenByStudents && data.seenByStudents.length > 0) {
            for (const studentId of data.seenByStudents) {
              try {
                const studentDoc = await getDoc(doc(db, 'users', studentId));
                if (studentDoc.exists()) {
                  const studentData = studentDoc.data();
                  const studentName = studentData.username || studentData.email?.split('@')[0] || 'Student';

                  // Find parent(s) of this student from seenByParents
                  const parentNames = [];
                  if (data.seenByParents && data.seenByParents.length > 0) {
                    for (const parentId of data.seenByParents) {
                      try {
                        const parentDoc = await getDoc(doc(db, 'users', parentId));
                        if (parentDoc.exists()) {
                          const parentData = parentDoc.data();
                          // Check if this parent's childrenIds includes this student
                          if (parentData.childrenIds && parentData.childrenIds.includes(studentId)) {
                            parentNames.push(parentData.username || parentData.email?.split('@')[0] || 'Parent');
                          }
                        }
                      } catch (err) {
                        console.error('Error fetching parent:', err);
                      }
                    }
                  }

                  studentParentPairs.push({
                    studentName,
                    parentNames: parentNames.length > 0 ? parentNames : ['No parent viewed']
                  });
                }
              } catch (err) {
                console.error('Error fetching student:', err);
              }
            }
          }

          // Find parents who viewed but their children didn't
          if (data.seenByParents && data.seenByParents.length > 0) {
            for (const parentId of data.seenByParents) {
              try {
                const parentDoc = await getDoc(doc(db, 'users', parentId));
                if (parentDoc.exists()) {
                  const parentData = parentDoc.data();
                  const parentName = parentData.username || parentData.email?.split('@')[0] || 'Parent';

                  // Check if any of this parent's children viewed
                  const hasChildViewed = parentData.childrenIds?.some(childId =>
                    data.seenByStudents?.includes(childId)
                  );

                  if (!hasChildViewed) {
                    orphanParents.push(parentName);
                  }
                }
              } catch (err) {
                console.error('Error fetching parent:', err);
              }
            }
          }

          announcementsData.push({
            id: docSnap.id,
            ...data,
            studentParentPairs,
            orphanParents
          });
        }

        // Sort by creation date (newest first)
        announcementsData.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
          const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
          return dateB - dateA;
        });

        setAnnouncements(announcementsData);
      } catch (err) {
        console.error('Error fetching announcements:', err);
      }
    };

    fetchAnnouncements();

    // Refresh every 30 seconds to get updated view counts
    const interval = setInterval(fetchAnnouncements, 30000);
    return () => clearInterval(interval);
  }, [classNumber]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !message) {
      setError('Please fill all fields');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'announcements'), {
        title,
        message,
        type: 'general',
        class: classNumber,
        schoolName: schoolName || '',
        createdBy: userId,
        createdByName: userName || 'Teacher',
        createdAt: Timestamp.now(),
        seenByStudents: [],
        seenByParents: []
      });

      setSuccess('Announcement created successfully!');
      setTitle('');
      setMessage('');
      setError('');

      // Reload announcements
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      const isDeveloper = userData?.role === 'developer';
      const schoolFilter = isDeveloper ? [] : [where('schoolName', '==', schoolName || '')];

      const q = query(
        collection(db, 'announcements'),
        where('class', '==', classNumber),
        ...schoolFilter
      );
      const snapshot = await getDocs(q);
      const announcementsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAnnouncements(announcementsData);

      if (onAnnouncementCreated) onAnnouncementCreated();
    } catch (err) {
      setError('Failed to create announcement: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h3>Announcements</h3>

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Title:</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Announcement title"
            style={styles.input}
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Message:</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write your announcement"
            style={{ ...styles.input, minHeight: '100px', resize: 'vertical' }}
            disabled={loading}
          />
        </div>

        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}

        <button
          type="submit"
          disabled={loading}
          style={styles.button}
        >
          {loading ? 'Creating...' : 'Post Announcement'}
        </button>
      </form>

      <div style={styles.announcementsListContainer}>
        <h4>Recent Announcements:</h4>
        {announcements.length > 0 ? (
          announcements.map((ann, idx) => (
            <div key={idx} style={styles.announcementItem}>
              <h5 style={styles.announcementTitle}>{ann.title}</h5>
              <div style={styles.announcementMeta}>
                Posted by {ann.createdByName || 'TriSphere Team'}
              </div>
              <p style={styles.announcementMessage}>{ann.message}</p>

              <div
                onClick={() => setExpandedAnnouncement(expandedAnnouncement === ann.id ? null : ann.id)}
                style={{ ...styles.announcementMeta, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <span>
                  Seen by {ann.seenByStudents?.length || 0} students, {ann.seenByParents?.length || 0} parents
                </span>
                <span style={{ fontSize: '11px' }}>
                  {expandedAnnouncement === ann.id ? '▲ Hide' : '▼ Show'}
                </span>
              </div>

              {expandedAnnouncement === ann.id && (
                <div style={styles.viewersContainer}>
                  {(ann.studentParentPairs && ann.studentParentPairs.length > 0) && (
                    <div style={styles.viewersSection}>
                      <strong style={styles.viewersTitle}>Students and their Parents who viewed:</strong>
                      <div style={styles.pairsTable}>
                        <div style={styles.tableHeader}>
                          <div style={styles.tableHeaderCell}>Student</div>
                          <div style={styles.tableDivider}></div>
                          <div style={styles.tableHeaderCell}>Parent(s)</div>
                        </div>
                        {ann.studentParentPairs.map((pair, pairIdx) => (
                          <div key={pairIdx} style={styles.tableRow}>
                            <div style={styles.tableCell}>{pair.studentName}</div>
                            <div style={styles.tableCellDivider}></div>
                            <div style={styles.tableCell}>
                              {pair.parentNames.join(', ')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(ann.orphanParents && ann.orphanParents.length > 0) && (
                    <div style={styles.viewersSection}>
                      <strong style={styles.viewersTitle}>Parents who viewed (student not viewed):</strong>
                      <ul style={styles.viewersList}>
                        {ann.orphanParents.map((name, nameIdx) => (
                          <li key={nameIdx} style={styles.viewerItem}>{name}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {(!ann.studentParentPairs || ann.studentParentPairs.length === 0) &&
                    (!ann.orphanParents || ann.orphanParents.length === 0) && (
                      <p style={styles.noViewers}>
                        No one has viewed this announcement yet
                      </p>
                    )}
                </div>
              )}
            </div>
          ))
        ) : (
          <p style={styles.noData}>No announcements yet</p>
        )}
      </div>
    </div>
  );
};

// ── Dark-theme design system ──────────────────────────────────────────
// Was full light-mode (white card, light grey rows, indigo button). Now
// matches the rest of the dashboards: dark glass surface, subtle borders,
// white text, blue/indigo accents only on interactive elements.
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
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 15,
    marginBottom: 20,
    paddingBottom: 20,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
  },
  label: {
    marginBottom: 6,
    fontSize: 13,
    fontWeight: 700,
    color: '#cbd5e1',
    letterSpacing: 0.2,
  },
  input: {
    padding: 10,
    fontSize: 14,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 10,
    fontFamily: 'inherit',
    color: '#f1f5f9',
    outline: 'none',
  },
  button: {
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    fontWeight: 700,
    boxShadow: '0 6px 18px rgba(99,102,241,0.25)',
  },
  error: {
    padding: '10px 12px',
    background: 'rgba(239,68,68,0.10)',
    border: '1px solid rgba(239,68,68,0.30)',
    color: '#fca5a5',
    borderRadius: 10,
    fontSize: 13,
  },
  success: {
    padding: '10px 12px',
    background: 'rgba(34,197,94,0.10)',
    border: '1px solid rgba(34,197,94,0.30)',
    color: '#86efac',
    borderRadius: 10,
    fontSize: 13,
  },
  announcementsListContainer: {
    marginTop: 20,
  },
  announcementItem: {
    padding: 14,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderLeft: '4px solid #818cf8',
    marginBottom: 10,
    borderRadius: 10,
  },
  announcementTitle: {
    margin: '0 0 5px 0',
    fontSize: 15,
    fontWeight: 700,
    color: '#f1f5f9',
  },
  announcementMessage: {
    margin: '0 0 8px 0',
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 1.5,
  },
  announcementMeta: {
    color: '#64748b',
    fontSize: 12,
  },
  noData: {
    color: '#64748b',
    fontStyle: 'italic',
  },
  viewersContainer: {
    marginTop: 12,
    padding: 12,
    background: 'rgba(255,255,255,0.025)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 10,
  },
  viewersSection: {
    marginBottom: 12,
  },
  viewersTitle: {
    fontSize: 11,
    color: '#a5b4fc',
    display: 'block',
    marginBottom: 6,
    fontWeight: 700,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  viewersList: {
    margin: 0,
    paddingLeft: 20,
    listStyleType: 'disc',
  },
  viewerItem: {
    fontSize: 13,
    color: '#e2e8f0',
    marginBottom: 3,
  },
  noViewers: {
    color: '#64748b',
    fontStyle: 'italic',
    fontSize: 13,
    margin: 0,
  },
  pairsTable: {
    marginTop: 8,
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  tableHeader: {
    display: 'grid',
    gridTemplateColumns: '1fr 1px 1fr',
    background: 'rgba(99,102,241,0.18)',
    color: '#e0e7ff',
    fontWeight: 700,
    fontSize: 13,
    letterSpacing: 0.3,
  },
  tableHeaderCell: {
    padding: '12px 16px',
    textAlign: 'left',
  },
  tableDivider: {
    background: 'rgba(255,255,255,0.10)',
    width: 1,
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1px 1fr',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    background: 'transparent',
    transition: 'background-color 0.2s',
  },
  tableCell: {
    fontSize: 13,
    color: '#e2e8f0',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
  },
  tableCellDivider: {
    background: 'rgba(255,255,255,0.06)',
    width: 1,
  },
};
