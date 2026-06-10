import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, query, where, getDocs, doc, deleteDoc, getDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { errorToast, successToast } from '../utils/toast';

export const MyUploads = ({ userId, classNumber, subject, refreshTrigger }) => {
  const { userData } = useAuth();
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  // Error state for the initial fetch. When set, the panel renders a
  // friendly error card with a Retry button instead of an empty list —
  // important on flaky connections where the previous behavior was a
  // permanently-spinning loader (errors were swallowed into a toast).
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'textbooks', 'assignments'
  const [showQuizSettings, setShowQuizSettings] = useState(null); // Upload ID for settings modal
  const [quizSettings, setQuizSettings] = useState({ maxAttempts: 2 });
  const [showEditDeadline, setShowEditDeadline] = useState(null); // Assignment object being edited
  const [newDeadline, setNewDeadline] = useState(''); // Selected date YYYY-MM-DD



  useEffect(() => {
    if (userData) {
      fetchUploads();
    }
  }, [refreshTrigger, userData, classNumber, subject]);

  const fetchUploads = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch textbook uploads from Firebase
      const isDeveloper = userData?.role === 'developer';
      const classInt = parseInt(classNumber);
      const classStr = String(classNumber);

      // Query both int and string class
      // Fetch ALL textbooks from Firebase to guarantee we don't miss anything due to query mismatch
      const allTextbooksQuery = query(collection(db, 'textbooks'));
      const s1 = await getDocs(allTextbooksQuery);
      const firebaseTextbooks = [];
      const seenTb = new Set();

      s1.docs.forEach(docSnap => {
        if (!seenTb.has(docSnap.id)) {
          const data = docSnap.data();
          // school filter fallback
          const schoolMatch = !userData?.schoolName || !data.schoolName || data.schoolName === userData.schoolName;
          if (schoolMatch) {
            firebaseTextbooks.push({
              id: docSnap.id,
              chapterName: data.chapterName,
              class: data.class,
              subject: data.subject,
              pdfURL: data.pdfURL,
              type: 'textbook',
              createdAt: data.uploadedAt?.toDate ? data.uploadedAt.toDate() : data.uploadedAt
            });
            seenTb.add(docSnap.id);
          }
        }
      });

      // List files from GitHub repo using REST API
      const GITHUB_OWNER = 'Sathwik777-appdev';
      const GITHUB_REPO = 'trisphere-pdfs';
      const folders = ['textbooks', 'assignments'];
      let githubUploads = [];
      for (const folder of folders) {
        try {
          const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${folder}`);
          if (res.ok) {
            const files = await res.json();
            const folderUploads = files.filter(f => f.type === 'file' && f.name.endsWith('.pdf')).map(f => ({
              id: f.sha,
              name: f.name,
              url: f.download_url,
              path: f.path,
              type: folder.slice(0, -1), // 'textbook' or 'assignment'
              uploadedAt: f.git_url // Not a date, but can be used for sorting
            }));
            githubUploads = githubUploads.concat(folderUploads);
          } else {
            console.warn(`GitHub API failed for ${folder}:`, res.statusText);
          }
        } catch (githubErr) {
          console.error(`Error fetching from GitHub (${folder}):`, githubErr);
        }
      }

      // Merge Firebase and GitHub uploads for textbooks
      const mergedUploads = firebaseTextbooks.map(fb => {
        const git = githubUploads.find(g => g.name && fb.chapterName && g.name.includes(fb.chapterName));
        return {
          ...fb,
          pdfURL: git ? git.url : fb.pdfURL
        };
      });

      // Fetch ALL assignments from Firebase to guarantee we don't miss anything
      const allAssignmentsQuery = query(collection(db, 'assignments'));
      const as1 = await getDocs(allAssignmentsQuery);
      const firebaseAssignments = [];
      const seenAs = new Set();

      as1.docs.forEach(docSnap => {
        if (!seenAs.has(docSnap.id)) {
          const data = docSnap.data();
          const schoolMatch = !userData?.schoolName || !data.schoolName || data.schoolName === userData.schoolName;
          if (schoolMatch) {
            firebaseAssignments.push({
              id: docSnap.id,
              assignmentTitle: data.assignmentTitle,
              chapterName: data.chapterName,
              class: data.class,
              subject: data.subject,
              type: 'assignment',
              dueDate: data.dueDate,
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt)
            });
            seenAs.add(docSnap.id);
          }
        }
      });

      // Fetch ALL simulation assignments from Firebase
      const allSimAssignmentsQuery = query(collection(db, 'simulationAssignments'));
      const simSnap = await getDocs(allSimAssignmentsQuery);
      const firebaseSimAssignments = [];
      const seenSim = new Set();

      simSnap.docs.forEach(docSnap => {
        if (!seenSim.has(docSnap.id)) {
          const data = docSnap.data();
          const schoolMatch = !userData?.schoolName || !data.schoolName || data.schoolName === userData.schoolName;
          if (schoolMatch) {
            firebaseSimAssignments.push({
              id: docSnap.id,
              assignmentTitle: data.title,
              chapterName: data.simulationName || 'Simulation Lab',
              class: data.class,
              subject: data.subject,
              type: 'simulationAssignment',
              dueDate: data.dueDate,
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now())
            });
            seenSim.add(docSnap.id);
          }
        }
      });

      setUploads([...mergedUploads, ...firebaseAssignments, ...firebaseSimAssignments]);
    } catch (err) {
      console.error('Error fetching uploads:', err);
      // Surface a friendly message in-card AND a transient toast.
      // The card error stays visible (with a Retry button) even after
      // the toast dismisses, so the user has a clear recovery path.
      setError(err?.message || 'Could not load your uploads.');
      errorToast('Failed to load uploads. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (uploadId, uploadType) => {
    const confirmMessage = uploadType === 'simulationAssignment'
      ? 'Are you sure you want to delete this simulation assignment?'
      : 'Are you sure you want to delete this upload? This also removes the auto-generated assignment and announcement for this chapter.';

    if (!confirm(confirmMessage)) return;

    try {
      let collectionName;
      if (uploadType === 'textbook') {
        collectionName = 'textbooks';
      } else if (uploadType === 'simulationAssignment') {
        collectionName = 'simulationAssignments';
      } else {
        collectionName = 'assignments';
      }

      // ── Cascade-delete plan for textbooks ────────────────────────────────
      // A chapter upload writes to FIVE places: textbooks, aiGeneratedContent,
      // studyMaterial (legacy), assignments (auto-created), and announcements
      // (chapter + assignment). Previously only the first two were cleaned up,
      // so students still saw stale assignments and announcement banners after
      // the teacher "deleted" the chapter.
      if (uploadType === 'textbook') {
        // 1. Read the textbook doc first so we know what to match in the
        //    related collections (assignments/announcements use chapterName,
        //    not the textbookId, so a key lookup isn't enough).
        let chapterMeta = null;
        try {
          const tbSnap = await getDoc(doc(db, 'textbooks', uploadId));
          if (tbSnap.exists()) chapterMeta = tbSnap.data();
        } catch (e) {
          console.warn('Could not read textbook before delete:', e);
        }

        // 2. Delete the primary docs (key lookups, fast and exact).
        await deleteDoc(doc(db, collectionName, uploadId));
        try { await deleteDoc(doc(db, 'aiGeneratedContent', uploadId)); } catch (e) {}
        try { await deleteDoc(doc(db, 'studyMaterial', uploadId)); } catch (e) {}

        // 3. Cascade to assignments + announcements, matched by
        //    chapterName + class + subject (+ schoolName when present).
        if (chapterMeta && chapterMeta.chapterName) {
          const { chapterName, subject, schoolName } = chapterMeta;
          const classInt = typeof chapterMeta.class === 'number' ? chapterMeta.class : parseInt(chapterMeta.class);

          const cascadeDelete = async (collName) => {
            try {
              // Try int and string class variants — older docs may use either.
              const queries = [
                query(collection(db, collName),
                  where('chapterName', '==', chapterName),
                  where('class', '==', classInt),
                  where('subject', '==', subject)
                ),
                query(collection(db, collName),
                  where('chapterName', '==', chapterName),
                  where('class', '==', String(classInt)),
                  where('subject', '==', subject)
                ),
              ];
              const snaps = await Promise.all(queries.map(q => getDocs(q)));
              const seen = new Set();
              for (const snap of snaps) {
                for (const d of snap.docs) {
                  if (seen.has(d.id)) continue;
                  seen.add(d.id);
                  // Match school too if both sides have one set.
                  const docSchool = d.data().schoolName || '';
                  if (schoolName && docSchool && docSchool !== schoolName) continue;
                  await deleteDoc(d.ref);
                }
              }
              console.log(`Cascade: removed ${seen.size} doc(s) from ${collName}`);
            } catch (e) {
              console.warn(`Cascade delete failed for ${collName}:`, e);
            }
          };

          await Promise.all([
            cascadeDelete('assignments'),
            cascadeDelete('announcements'),
          ]);
        }
      } else {
        // Standalone assignment (not from a chapter upload) or simulation assignment — just delete it.
        await deleteDoc(doc(db, collectionName, uploadId));
      }

      successToast('Deleted — chapter, quiz, videos, assignment and announcement all cleared.');

      // Refresh the list
      await fetchUploads();
    } catch (err) {
      console.error('Error deleting upload:', err);
      errorToast('Failed to delete upload');
    }
  };

  // Open quiz settings modal for a textbook
  const openQuizSettings = async (uploadId) => {
    try {
      const docRef = doc(db, 'aiGeneratedContent', uploadId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setQuizSettings({ maxAttempts: data.maxAttempts || 2 });
      } else {
        setQuizSettings({ maxAttempts: 2 });
      }
      setShowQuizSettings(uploadId);
    } catch (err) {
      console.error('Error loading quiz settings:', err);
      errorToast('Failed to load quiz settings');
    }
  };

  // Save quiz settings
  const saveQuizSettings = async () => {
    if (!showQuizSettings) return;

    try {
      const docRef = doc(db, 'aiGeneratedContent', showQuizSettings);
      await updateDoc(docRef, {
        maxAttempts: parseInt(quizSettings.maxAttempts) || 2
      });
      successToast(`Quiz attempts limit set to ${quizSettings.maxAttempts}`);
      setShowQuizSettings(null);
    } catch (err) {
      console.error('Error saving quiz settings:', err);
      errorToast('Failed to save quiz settings');
    }
  };

  const filteredUploads = uploads.filter(upload => {
    // Only show uploads matching selected class and subject
    const classMatch = !classNumber || String(upload.class) === String(classNumber);
    const subjectMatch = !subject || String(upload.subject).toLowerCase() === String(subject).toLowerCase();
    if (!classMatch || !subjectMatch) return false;
    if (filter === 'all') return true;
    if (filter === 'textbooks') return upload.type === 'textbook';
    if (filter === 'assignments') return upload.type === 'assignment' || upload.type === 'simulationAssignment';
    return true;
  });

  const parseFirebaseDate = (dateField) => {
    if (!dateField) return null;
    if (dateField.toDate) return dateField.toDate();
    if (typeof dateField === 'object' && dateField.seconds !== undefined) {
      return new Date(dateField.seconds * 1000);
    }
    const d = new Date(dateField);
    return isNaN(d.getTime()) ? null : d;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = parseFirebaseDate(timestamp);
    if (!date) return 'N/A';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const openEditDeadline = (assignment) => {
    const parsed = parseFirebaseDate(assignment.dueDate);
    if (parsed) {
      const yyyy = parsed.getFullYear();
      const mm = String(parsed.getMonth() + 1).padStart(2, '0');
      const dd = String(parsed.getDate()).padStart(2, '0');
      setNewDeadline(`${yyyy}-${mm}-${dd}`);
    } else {
      setNewDeadline('');
    }
    setShowEditDeadline(assignment);
  };

  const saveDeadline = async () => {
    if (!showEditDeadline || !newDeadline) return;

    try {
      const collectionName = showEditDeadline.type === 'simulationAssignment'
        ? 'simulationAssignments'
        : 'assignments';
      const docRef = doc(db, collectionName, showEditDeadline.id);
      const selectedDate = new Date(newDeadline);
      // Give students full day to submit
      selectedDate.setHours(23, 59, 59, 999);
      
      await updateDoc(docRef, {
        dueDate: selectedDate
      });
      successToast('Assignment deadline updated successfully!');
      setShowEditDeadline(null);
      await fetchUploads();
    } catch (err) {
      console.error('Error saving deadline:', err);
      errorToast('Failed to update deadline');
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading uploads...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div
          style={{
            padding: 24,
            margin: 16,
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.30)',
            borderRadius: 14,
            color: '#fca5a5',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
          <h3 style={{ margin: '0 0 6px', fontSize: 16, color: '#fecaca' }}>
            Couldn't load uploads
          </h3>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: '#fca5a5', lineHeight: 1.5 }}>
            Check your internet connection and try again. If this keeps
            happening, the chapter files may not be reachable.
          </p>
          <button
            onClick={fetchUploads}
            style={{
              padding: '10px 22px',
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>📁 My Uploads</h2>
        <div style={styles.headerActions}>
          <div style={styles.filterButtons}>
            <button
              onClick={() => setFilter('all')}
              style={{
                ...styles.filterButton,
                ...(filter === 'all' ? styles.filterButtonActive : {})
              }}
            >
              All ({uploads.filter(u => (!classNumber || u.class === classNumber) && (!subject || u.subject === subject)).length})
            </button>
            <button
              onClick={() => setFilter('textbooks')}
              style={{
                ...styles.filterButton,
                ...(filter === 'textbooks' ? styles.filterButtonActive : {})
              }}
            >
              Textbooks ({uploads.filter(u => u.type === 'textbook' && (!classNumber || u.class === classNumber) && (!subject || u.subject === subject)).length})
            </button>
            <button
              onClick={() => setFilter('assignments')}
              style={{
                ...styles.filterButton,
                ...(filter === 'assignments' ? styles.filterButtonActive : {})
              }}
            >
              Assignments ({uploads.filter(u => u.type === 'assignment' && (!classNumber || u.class === classNumber) && (!subject || u.subject === subject)).length})
            </button>
          </div>
        </div>
      </div>

      {filteredUploads.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>📭</div>
          <p style={styles.emptyText}>No uploads yet</p>
          <p style={styles.emptySubtext}>Start by uploading textbooks or assignments</p>
        </div>
      ) : (
        <div style={styles.uploadsList}>
          {filteredUploads.map(upload => (
            <div key={upload.id} style={styles.uploadCard}>
              <div style={styles.uploadIcon}>
                {upload.type === 'textbook' ? '📚' : '📝'}
              </div>
              <div style={styles.uploadContent}>
                <div style={styles.uploadHeader}>
                  <h3 style={styles.uploadTitle}>
                    {upload.chapterName || upload.assignmentTitle || 'Untitled'}
                  </h3>
                  <span style={{
                    ...styles.typeBadge,
                    backgroundColor: upload.type === 'textbook' ? '#dbeafe' : upload.type === 'simulationAssignment' ? '#e0f2fe' : '#fef3c7',
                    color: upload.type === 'textbook' ? '#1e40af' : upload.type === 'simulationAssignment' ? '#0369a1' : '#92400e'
                  }}>
                    {upload.type === 'textbook' ? 'Textbook' : upload.type === 'simulationAssignment' ? 'Simulation' : 'Assignment'}
                  </span>
                </div>
                <div style={styles.uploadMeta}>
                  <span style={styles.metaItem}>
                    🎓 Class {upload.class}
                  </span>
                  <span style={styles.metaItem}>
                    📖 {upload.subject}
                  </span>
                  <span style={styles.metaItem}>
                    📅 Created: {formatDate(upload.createdAt)}
                  </span>
                  {(upload.type === 'assignment' || upload.type === 'simulationAssignment') && (
                    <span style={{ ...styles.metaItem, color: '#d97706', fontWeight: '600' }}>
                      ⏳ Due: {formatDate(upload.dueDate)}
                    </span>
                  )}
                  {upload.phetSlug && (
                    <span style={styles.metaItem}>
                      🔬 Has Simulation
                    </span>
                  )}
                </div>
                <div style={styles.uploadActions}>

                  {upload.type === 'textbook' && (
                    <button
                      onClick={() => openQuizSettings(upload.id)}
                      style={styles.settingsButton}
                    >
                      ⚙️ Quiz Settings
                    </button>
                  )}
                  {(upload.type === 'assignment' || upload.type === 'simulationAssignment') && (
                    <button
                      onClick={() => openEditDeadline(upload)}
                      style={styles.settingsButton}
                    >
                      📅 Edit Deadline
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(upload.id, upload.type)}
                    style={styles.deleteButton}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quiz Settings Modal */}
      {showQuizSettings && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0 }}>⚙️ Quiz Settings</h3>
              <button
                onClick={() => setShowQuizSettings(null)}
                style={styles.closeButton}
              >
                ✕
              </button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.settingRow}>
                <label style={styles.settingLabel}>
                  🔄 Maximum Quiz Attempts
                </label>
                <p style={styles.settingDescription}>
                  Set how many times students can attempt this quiz
                </p>
                <select
                  value={quizSettings.maxAttempts}
                  onChange={(e) => setQuizSettings({
                    ...quizSettings,
                    maxAttempts: parseInt(e.target.value)
                  })}
                  style={styles.settingSelect}
                >
                  <option value={1}>1 attempt (no retakes)</option>
                  <option value={2}>2 attempts (1 retake)</option>
                  <option value={3}>3 attempts (2 retakes)</option>
                  <option value={5}>5 attempts</option>
                  <option value={10}>10 attempts</option>
                  <option value={999}>Unlimited attempts</option>
                </select>
              </div>
              <div style={styles.modalFooter}>
                <button
                  onClick={() => setShowQuizSettings(null)}
                  style={styles.cancelButton}
                >
                  Cancel
                </button>
                <button
                  onClick={saveQuizSettings}
                  style={styles.saveButton}
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Edit Deadline Modal */}
      {showEditDeadline && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0 }}>📅 Edit Assignment Deadline</h3>
              <button
                onClick={() => setShowEditDeadline(null)}
                style={styles.closeButton}
              >
                ✕
              </button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.settingRow}>
                <label style={styles.settingLabel}>
                  Select New Deadline Date
                </label>
                <p style={styles.settingDescription}>
                  Choose the final date for students to submit this assignment.
                </p>
                <input
                  type="date"
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                  style={styles.settingSelect}
                  required
                />
              </div>
              <div style={styles.modalFooter}>
                <button
                  onClick={() => setShowEditDeadline(null)}
                  style={styles.cancelButton}
                >
                  Cancel
                </button>
                <button
                  onClick={saveDeadline}
                  style={styles.saveButton}
                >
                  Save Deadline
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '16px'
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#1a202c',
    margin: 0
  },
  headerActions: {
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  bulkGenerateButton: {
    padding: '10px 20px',
    backgroundColor: '#7c3aed',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: '600',
    transition: 'all 0.2s',
    boxShadow: '0 2px 4px rgba(124, 58, 237, 0.3)'
  },
  filterButtons: {
    display: 'flex',
    gap: '8px'
  },
  filterButton: {
    padding: '8px 16px',
    backgroundColor: '#f3f4f6',
    border: '2px solid transparent',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    color: '#6b7280',
    transition: 'all 0.2s'
  },
  filterButtonActive: {
    backgroundColor: '#7c3aed',
    color: 'white',
    borderColor: '#7c3aed'
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    color: '#6b7280',
    fontSize: '16px'
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px'
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '16px'
  },
  emptyText: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#374151',
    margin: '0 0 8px 0'
  },
  emptySubtext: {
    fontSize: '14px',
    color: '#6b7280',
    margin: 0
  },
  uploadsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  uploadCard: {
    display: 'flex',
    gap: '16px',
    padding: '20px',
    backgroundColor: '#f9fafb',
    border: '2px solid #e5e7eb',
    borderRadius: '12px',
    transition: 'all 0.2s',
    alignItems: 'start'
  },
  checkbox: {
    width: '20px',
    height: '20px',
    cursor: 'pointer',
    accentColor: '#7c3aed',
    marginTop: '5px'
  },
  uploadIcon: {
    fontSize: '40px',
    flexShrink: 0
  },
  uploadContent: {
    flex: 1
  },
  uploadHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'start',
    marginBottom: '12px',
    gap: '12px'
  },
  uploadTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#000000',
    margin: 0
  },
  typeBadge: {
    padding: '4px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600'
  },
  uploadMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
    marginBottom: '16px'
  },
  metaItem: {
    fontSize: '14px',
    color: '#333333'
  },
  uploadActions: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap'
  },
  viewButton: {
    padding: '8px 16px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    textDecoration: 'none',
    display: 'inline-block',
    transition: 'all 0.2s'
  },
  generateButton: {
    padding: '8px 16px',
    backgroundColor: '#7c3aed',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s'
  },
  deleteButton: {
    padding: '8px 16px',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s'
  },
  progressBar: {
    marginTop: '12px',
    padding: '12px',
    backgroundColor: '#f0f9ff',
    border: '2px solid #3b82f6',
    borderRadius: '8px'
  },
  progressText: {
    fontSize: '14px',
    color: '#1e40af',
    fontWeight: '500'
  },
  errorBox: {
    marginTop: '12px',
    padding: '12px',
    backgroundColor: '#fee2e2',
    border: '2px solid #ef4444',
    borderRadius: '8px',
    color: '#991b1b',
    fontSize: '14px'
  },
  settingsButton: {
    padding: '8px 16px',
    backgroundColor: '#8b5cf6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '400px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    borderBottom: '1px solid #e5e7eb'
  },
  modalBody: {
    padding: '20px'
  },
  modalFooter: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    marginTop: '20px'
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#6b7280'
  },
  settingRow: {
    marginBottom: '16px'
  },
  settingLabel: {
    display: 'block',
    fontSize: '16px',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '4px'
  },
  settingDescription: {
    fontSize: '14px',
    color: '#6b7280',
    margin: '4px 0 12px 0'
  },
  settingSelect: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    backgroundColor: 'white',
    cursor: 'pointer'
  },
  cancelButton: {
    padding: '10px 20px',
    backgroundColor: '#f3f4f6',
    color: '#374151',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '500',
    fontSize: '14px'
  },
  saveButton: {
    padding: '10px 20px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px'
  }
};
