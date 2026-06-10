import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, getDoc, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { SIMULATIONS } from '../utils/phetSimulations';
import { successToast, errorToast } from '../utils/toast';

export default function SimulationAssignment({ userId, schoolName, classNumber, teacherSubject, userRole }) {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'submissions'

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth <= 768;
  const isDeveloper = userRole === 'developer';

  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [gradingSubmission, setGradingSubmission] = useState(null);
  const [grade, setGrade] = useState('');
  const [feedback, setFeedback] = useState('');
  const [submittingGrade, setSubmittingGrade] = useState(false);
  const [aiGrading, setAiGrading] = useState(false);

  // Form State
  const [formSubject, setFormSubject] = useState(teacherSubject || 'Physics');

  useEffect(() => {
    if (teacherSubject) {
      setFormSubject(teacherSubject);
    }
  }, [teacherSubject]);

  const [formSimSlug, setFormSimSlug] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formInstructions, setFormInstructions] = useState('');
  const [formClass, setFormClass] = useState(classNumber || '6');
  const [formDueDate, setFormDueDate] = useState(''); // YYYY-MM-DD
  const [formFields, setFormFields] = useState(['Voltage (V)', 'Current (mA)']);
  const [newFieldName, setNewFieldName] = useState('');
  const [creatingAssignment, setCreatingAssignment] = useState(false);

  // Fetch Assignments
  const fetchAssignments = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const q = query(
        collection(db, 'simulationAssignments'),
        where('teacherId', '==', userId),
        limit(100)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      // Sort client-side by createdAt desc
      list.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      setAssignments(list);
    } catch (err) {
      console.error(err);
      errorToast('Failed to load assignments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, [userId]);

  // Set default simulation slug when subject changes
  useEffect(() => {
    if (SIMULATIONS[formSubject] && SIMULATIONS[formSubject].length > 0) {
      setFormSimSlug(SIMULATIONS[formSubject][0].slug);
    } else {
      setFormSimSlug('');
    }
  }, [formSubject]);

  // Fetch Submissions for selected assignment
  const handleSelectAssignment = async (assignment) => {
    setSelectedAssignment(assignment);
    setSubmissions([]);
    setLoadingSubmissions(true);
    try {
      const q = query(
        collection(db, 'simulationSubmissions'),
        where('assignmentId', '==', assignment.id),
        limit(100)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      setSubmissions(list);
    } catch (err) {
      console.error(err);
      errorToast('Failed to load student submissions');
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const handleResetForm = () => {
    setFormTitle('');
    setFormInstructions('');
    setFormDueDate('');
    setFormFields(['Voltage (V)', 'Current (mA)']);
    setNewFieldName('');
  };

  // Create Assignment
  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      errorToast('Please enter an assignment title');
      return;
    }
    if (!formSimSlug) {
      errorToast('Please select a simulation');
      return;
    }
    if (formFields.length === 0) {
      errorToast('Please specify at least one parameter field for students to record');
      return;
    }

    setCreatingAssignment(true);
    try {
      const selectedSim = SIMULATIONS[formSubject].find(s => s.slug === formSimSlug);
      
      let parsedDueDate = null;
      if (formDueDate) {
        parsedDueDate = new Date(formDueDate);
        parsedDueDate.setHours(23, 59, 59, 999);
      } else {
        // Fallback: 3 days from now
        parsedDueDate = new Date();
        parsedDueDate.setDate(parsedDueDate.getDate() + 3);
        parsedDueDate.setHours(23, 59, 59, 999);
      }

      const newAssignment = {
        teacherId: userId,
        schoolName: schoolName || '',
        class: isNaN(Number(formClass)) ? formClass : Number(formClass),
        subject: formSubject,
        title: formTitle.trim(),
        instructions: formInstructions.trim(),
        simulationType: selectedSim?.type || 'phet',
        simulationSlug: formSimSlug,
        simulationName: selectedSim?.label || formSimSlug,
        fieldsToRecord: formFields,
        dueDate: parsedDueDate,
        createdAt: new Date()
      };

      await addDoc(collection(db, 'simulationAssignments'), newAssignment);
      successToast('Simulation assignment created successfully!');
      
      // Reset form
      handleResetForm();
      
      // Redirect to submissions review and reload list
      setActiveTab('submissions');
      fetchAssignments();
    } catch (err) {
      console.error(err);
      errorToast('Failed to create assignment');
    } finally {
      setCreatingAssignment(false);
    }
  };

  // Add Dynamic Field
  const handleAddField = () => {
    if (!newFieldName.trim()) return;
    if (formFields.includes(newFieldName.trim())) {
      errorToast('This parameter name already exists');
      return;
    }
    setFormFields([...formFields, newFieldName.trim()]);
    setNewFieldName('');
  };

  // Remove Dynamic Field
  const handleRemoveField = (indexToRemove) => {
    setFormFields(formFields.filter((_, idx) => idx !== indexToRemove));
  };

  // Submit Grade
  const handleSubmitGrade = async (e) => {
    e.preventDefault();
    if (!gradingSubmission) return;
    if (grade === '') {
      errorToast('Please enter a grade');
      return;
    }

    setSubmittingGrade(true);
    try {
      const submissionRef = doc(db, 'simulationSubmissions', gradingSubmission.id);
      await updateDoc(submissionRef, {
        grade: Number(grade),
        feedback: feedback.trim(),
        status: 'graded',
        gradedAt: new Date()
      });

      successToast('Grade submitted successfully!');
      
      // Update local state
      setSubmissions(prev => prev.map(s => 
        s.id === gradingSubmission.id 
          ? { ...s, grade: Number(grade), feedback: feedback.trim(), status: 'graded' } 
          : s
      ));

      setGradingSubmission(null);
      setGrade('');
      setFeedback('');
    } catch (err) {
      console.error(err);
      errorToast('Failed to submit grade');
    } finally {
      setSubmittingGrade(false);
    }
  };

  // AI Auto-Grading Function
  const handleAIGrade = async () => {
    if (!gradingSubmission || !selectedAssignment) return;
    setAiGrading(true);
    try {
      const { autoGradeSimulation } = await import('../services/aiService');
      const result = await autoGradeSimulation(gradingSubmission, selectedAssignment);
      setGrade(result.grade.toString());
      setFeedback(result.feedback);
      successToast('AI feedback generated! You can review and tweak it before saving.');
    } catch (err) {
      console.error(err);
      errorToast('AI grading failed. Please enter the grade manually.');
    } finally {
      setAiGrading(false);
    }
  };

  const parseFirebaseDate = (dateField) => {
    if (!dateField) return null;
    if (dateField.toDate) return dateField.toDate();
    if (typeof dateField === 'object' && dateField.seconds !== undefined) {
      return new Date(dateField.seconds * 1000);
    }
    const d = new Date(dateField);
    return isNaN(d.getTime()) ? null : d;
  };

  const formatDueDate = (dateField) => {
    const d = parseFirebaseDate(dateField);
    if (!d) return 'No due date';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div style={styles.container}>
      {/* Header Panel */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>🧪 Simulation Lab Dashboard</h2>
          <p style={styles.subtitle}>Assign virtual experiments and review data-driven lab submissions.</p>
        </div>
      </div>

      {/* Side-by-side Tab Options */}
      <div style={styles.tabContainer}>
        <button
          type="button"
          style={{
            ...styles.tabBtn,
            ...(activeTab === 'create' ? styles.activeTabBtn : {})
          }}
          onClick={() => setActiveTab('create')}
        >
          📝 Creation
          {activeTab === 'create' && <div style={styles.tabIndicator} />}
        </button>
        <button
          type="button"
          style={{
            ...styles.tabBtn,
            ...(activeTab === 'submissions' ? styles.activeTabBtn : {})
          }}
          onClick={() => {
            setActiveTab('submissions');
            setSelectedAssignment(null);
          }}
        >
          📥 Submission
          {activeTab === 'submissions' && <div style={styles.tabIndicator} />}
        </button>
      </div>

      {/* TAB CONTENTS */}
      {activeTab === 'create' && (
        <div style={{ ...styles.card, padding: isMobile ? '16px' : '24px' }}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>Create Simulation Assignment</h3>
          </div>
          <form onSubmit={handleCreateAssignment} style={styles.form}>
            <div style={{ ...styles.formGrid, gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)' }}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Class / Grade</label>
                <input
                  type="text"
                  style={styles.input}
                  value={formClass}
                  onChange={(e) => setFormClass(e.target.value)}
                  placeholder="e.g. 6"
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Subject</label>
                <select
                  style={styles.select}
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  disabled={!!teacherSubject && !isDeveloper}
                >
                  <option value="Physics">Physics (PhET)</option>
                  <option value="Chemistry">Chemistry (PhET)</option>
                  <option value="Biology">Biology (PhET)</option>
                  <option value="Mathematics">Mathematics (GeoGebra)</option>
                </select>
              </div>

              <div style={{ ...styles.inputGroup, gridColumn: isMobile ? 'span 1' : 'span 2' }}>
                <label style={styles.label}>Simulation Topic</label>
                <select
                  style={styles.select}
                  value={formSimSlug}
                  onChange={(e) => setFormSimSlug(e.target.value)}
                >
                  {(SIMULATIONS[formSubject] || []).map(sim => (
                    <option key={sim.slug} value={sim.slug}>
                      {sim.label} ({sim.type.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ ...styles.inputGroup, gridColumn: isMobile ? 'span 1' : 'span 2' }}>
                <label style={styles.label}>Experiment Title</label>
                <input
                  type="text"
                  style={styles.input}
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Ohm's Law Verification Lab"
                />
              </div>

              <div style={{ ...styles.inputGroup, gridColumn: isMobile ? 'span 1' : 'span 2' }}>
                <label style={styles.label}>Deadline Date</label>
                <input
                  type="date"
                  style={styles.input}
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                  required
                />
              </div>

              <div style={{ ...styles.inputGroup, gridColumn: isMobile ? 'span 1' : 'span 2' }}>
                <label style={styles.label}>Instructions & Task Description</label>
                <textarea
                  style={styles.textarea}
                  value={formInstructions}
                  onChange={(e) => setFormInstructions(e.target.value)}
                  placeholder="Explain what parameters students should change, what values they should record, and what to verify."
                  rows={4}
                />
              </div>

              {/* Dynamic Parameter Fields Recorder */}
              <div style={{ ...styles.inputGroup, gridColumn: isMobile ? 'span 1' : 'span 2' }}>
                <label style={styles.label}>Parameters Students Must Record</label>
                <div style={{ ...styles.fieldBuilder, flexDirection: isMobile ? 'column' : 'row' }}>
                  <input
                    type="text"
                    style={{ ...styles.input, flex: 1 }}
                    value={newFieldName}
                    onChange={(e) => setNewFieldName(e.target.value)}
                    placeholder="e.g. Resistance (Ω) or Angle (deg)"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddField())}
                  />
                  <button
                    type="button"
                    style={{ ...styles.addParamBtn, width: isMobile ? '100%' : 'auto', marginTop: isMobile ? '8px' : '0' }}
                    onClick={handleAddField}
                  >
                    Add Parameter
                  </button>
                </div>

                <div style={styles.fieldsContainer}>
                  {formFields.length === 0 ? (
                    <span style={styles.noFieldsText}>No parameters specified yet. (Add at least one)</span>
                  ) : (
                    formFields.map((field, index) => (
                      <span key={index} style={styles.fieldTag}>
                        {field}
                        <button
                          type="button"
                          style={styles.removeFieldBtn}
                          onClick={() => handleRemoveField(index)}
                        >
                          ✕
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div style={styles.formActions}>
              <button type="button" style={styles.cancelBtn} onClick={handleResetForm}>
                Reset Form
              </button>
              <button type="submit" style={styles.submitBtn} disabled={creatingAssignment}>
                {creatingAssignment ? 'Creating...' : 'Create & Publish'}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'submissions' && (
        selectedAssignment ? (
          <div>
            <button style={styles.backLink} onClick={() => setSelectedAssignment(null)}>
              ← Back to Active Lab Assignments
            </button>
            
            <div style={styles.card}>
              <div style={styles.assignmentDetailsHeader}>
                <div>
                  <span style={styles.subjectBadge}>{selectedAssignment.subject}</span>
                  <h3 style={styles.assignmentDetailsTitle}>{selectedAssignment.title}</h3>
                  <p style={styles.simulationMeta}>
                    <strong>Simulation:</strong> {selectedAssignment.simulationName} (Slug: <code>{selectedAssignment.simulationSlug}</code>)
                  </p>
                </div>
                <div style={styles.classMeta}>Class {selectedAssignment.class}</div>
              </div>
              
              <div style={styles.instructionsBox}>
                <strong>Instructions:</strong>
                <p style={{ margin: '6px 0 0 0', whiteSpace: 'pre-wrap', color: '#e2e8f0' }}>
                  {selectedAssignment.instructions || 'No instructions provided.'}
                </p>
              </div>

              <div style={{ marginTop: '24px' }}>
                <h4 style={styles.sectionHeader}>Submissions</h4>
                
                {loadingSubmissions ? (
                  <div style={styles.loader}>Loading submissions...</div>
                ) : submissions.length === 0 ? (
                  <div style={styles.emptyState}>No submissions received for this experiment yet.</div>
                ) : (
                  <div style={styles.submissionsTableWrapper}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Student</th>
                          <th style={styles.th}>Submitted At</th>
                          <th style={styles.th}>Recorded Data</th>
                          <th style={styles.th}>Grade</th>
                          <th style={styles.th}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {submissions.map(sub => (
                          <tr key={sub.id} style={styles.tr}>
                            <td style={styles.td}>
                              <strong>{sub.studentName}</strong>
                            </td>
                            <td style={styles.td}>
                              {sub.submittedAt ? new Date(sub.submittedAt.seconds ? sub.submittedAt.seconds * 1000 : sub.submittedAt).toLocaleString() : 'N/A'}
                            </td>
                            <td style={styles.td}>
                              <div style={styles.miniDataGrid}>
                                {Object.entries(sub.recordedValues || {}).map(([key, val]) => (
                                  <span key={key} style={styles.miniDataTag}>
                                    <strong>{key}:</strong> {val}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td style={styles.td}>
                              {sub.status === 'graded' ? (
                                <span style={styles.gradedScoreTag}>{sub.grade}/10</span>
                              ) : (
                                <span style={styles.pendingScoreTag}>Pending</span>
                              )}
                            </td>
                            <td style={styles.td}>
                              <button
                                style={styles.gradeBtn}
                                onClick={() => {
                                  setGradingSubmission(sub);
                                  setGrade(sub.grade !== undefined ? sub.grade.toString() : '');
                                  setFeedback(sub.feedback || '');
                                }}
                              >
                                {sub.status === 'graded' ? '✏️ Edit Grade' : '🎓 Grade'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ASSIGNMENT LIST OVERVIEW */
          <div>
            {loading ? (
              <div style={styles.loader}>Loading active simulation tasks...</div>
            ) : assignments.length === 0 ? (
              <div style={styles.emptyState}>
                No simulation assignments have been created yet. Select the "Creation" tab to create one.
              </div>
            ) : (
              <div style={styles.grid}>
                {assignments.map(assign => (
                  <div key={assign.id} style={styles.assignmentCard}>
                    <div style={styles.cardSubjectRow}>
                      <span style={{
                        ...styles.subjectTag,
                        backgroundColor: getSubjectColor(assign.subject)
                      }}>
                        {assign.subject}
                      </span>
                      <span style={styles.classTag}>Class {assign.class}</span>
                    </div>
                    
                    <h4 style={styles.assignmentTitle}>{assign.title}</h4>
                    {assign.dueDate && (
                      <div style={{ fontSize: '13px', color: '#f59e0b', fontWeight: '600', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        ⏳ Due: {formatDueDate(assign.dueDate)}
                      </div>
                    )}
                    <p style={styles.assignmentInstructionsPreview}>
                      {assign.instructions ? assign.instructions.substring(0, 100) + (assign.instructions.length > 100 ? '...' : '') : 'No instructions.'}
                    </p>
                    
                    <div style={styles.assignmentFooter}>
                      <div style={styles.simBadge}>
                        💻 {assign.simulationName}
                      </div>
                      <button
                        style={styles.viewSubmissionsBtn}
                        onClick={() => handleSelectAssignment(assign)}
                      >
                        Submissions →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      )}

      {/* GRADING OVERLAY */}
      {gradingSubmission && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContainer}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Grade Submission: {gradingSubmission.studentName}</h3>
              <button style={styles.closeBtn} onClick={() => setGradingSubmission(null)}>✕</button>
            </div>
            
            <div style={styles.modalContent}>
              {/* Screenshot Panel */}
              <div style={styles.screenshotPanel}>
                <div style={styles.modalSectionTitle}>Verification Screenshot</div>
                {gradingSubmission.screenshotUrl ? (
                  <a href={gradingSubmission.screenshotUrl} target="_blank" rel="noreferrer" style={styles.screenshotLink}>
                    <img
                      src={gradingSubmission.screenshotUrl}
                      alt="Student Lab Screenshot"
                      style={styles.screenshotImage}
                    />
                    <div style={styles.zoomHint}>🔍 Click to open full size</div>
                  </a>
                ) : (
                  <div style={styles.noScreenshot}>No verification screenshot uploaded.</div>
                )}
              </div>

              {/* Data Panel */}
              <div style={styles.dataPanel}>
                <div style={styles.modalSectionTitle}>Recorded Values</div>
                <div style={styles.dataValuesGrid}>
                  {Object.entries(gradingSubmission.recordedValues || {}).map(([key, val]) => (
                    <div key={key} style={styles.dataValueCard}>
                      <div style={styles.dataValueKey}>{key}</div>
                      <div style={styles.dataValueVal}>{val || '—'}</div>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleSubmitGrade} style={styles.gradingForm}>
                  <div style={styles.inputGroup}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={styles.label}>Grade (out of 10)</label>
                      <button
                        type="button"
                        onClick={handleAIGrade}
                        disabled={aiGrading || submittingGrade}
                        style={{
                          padding: '4px 10px',
                          backgroundColor: 'rgba(139, 92, 246, 0.15)',
                          color: '#c4b5fd',
                          border: '1px solid rgba(139, 92, 246, 0.3)',
                          borderRadius: '6px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        {aiGrading ? '🤖 Grading...' : '🤖 AI Auto-Grade'}
                      </button>
                    </div>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      style={styles.input}
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      placeholder="e.g. 9.5"
                    />
                  </div>

                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Feedback Comments</label>
                    <textarea
                      style={styles.textarea}
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="Provide helpful analysis feedback to the student..."
                      rows={4}
                    />
                  </div>

                  <div style={styles.modalActions}>
                    <button
                      type="button"
                      style={styles.cancelBtn}
                      onClick={() => setGradingSubmission(null)}
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      style={styles.submitBtn}
                      disabled={submittingGrade}
                    >
                      {submittingGrade ? 'Saving Grade...' : 'Save & Close'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const getSubjectColor = (subject) => {
  switch (subject) {
    case 'Physics': return '#3b82f6';
    case 'Chemistry': return '#10b981';
    case 'Biology': return '#ec4899';
    case 'Mathematics': return '#f59e0b';
    default: return '#6b7280';
  }
};

const styles = {
  container: {
    padding: '20px',
    color: 'white',
    fontFamily: 'Inter, system-ui, sans-serif',
    boxSizing: 'border-box'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '12px',
    boxSizing: 'border-box'
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    margin: 0
  },
  subtitle: {
    fontSize: '14px',
    color: '#94a3b8',
    margin: '4px 0 0 0'
  },
  tabContainer: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    paddingBottom: '2px',
    boxSizing: 'border-box'
  },
  tabBtn: {
    padding: '10px 20px',
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    position: 'relative',
    transition: 'all 0.2s',
    outline: 'none',
    boxSizing: 'border-box'
  },
  activeTabBtn: {
    color: '#3b82f6'
  },
  tabIndicator: {
    position: 'absolute',
    bottom: '-3px',
    left: 0,
    right: 0,
    height: '3px',
    backgroundColor: '#3b82f6',
    borderRadius: '3px 3px 0 0'
  },
  card: {
    position: 'relative',
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '24px',
    boxSizing: 'border-box',
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden'
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    paddingBottom: '12px',
    boxSizing: 'border-box'
  },
  cardTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 'bold'
  },
  closeBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#94a3b8',
    fontSize: '20px',
    cursor: 'pointer',
    zIndex: 10,
    transition: 'color 0.2s',
    '&:hover': {
      color: 'white'
    }
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    boxSizing: 'border-box',
    width: '100%'
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
    boxSizing: 'border-box',
    width: '100%'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    boxSizing: 'border-box',
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden'
  },
  label: {
    fontSize: '13px',
    color: '#94a3b8',
    fontWeight: '500'
  },
  input: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    padding: '10px 14px',
    color: 'white',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    width: '100%',
    maxWidth: '100%',
    '&:focus': {
      borderColor: '#3b82f6'
    }
  },
  select: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    padding: '10px 14px',
    color: 'white',
    fontSize: '14px',
    outline: 'none',
    cursor: 'pointer',
    boxSizing: 'border-box',
    width: '100%',
    maxWidth: '100%'
  },
  textarea: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    padding: '10px 14px',
    color: 'white',
    fontSize: '14px',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    width: '100%',
    maxWidth: '100%'
  },
  fieldBuilder: {
    display: 'flex',
    gap: '12px',
    marginBottom: '8px',
    boxSizing: 'border-box',
    width: '100%'
  },
  addParamBtn: {
    padding: '10px 16px',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    color: '#60a5fa',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '500',
    fontSize: '13px',
    boxSizing: 'border-box',
    whiteSpace: 'nowrap'
  },
  fieldsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    padding: '12px',
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: '8px',
    minHeight: '44px',
    alignItems: 'center',
    boxSizing: 'border-box',
    width: '100%'
  },
  noFieldsText: {
    color: '#64748b',
    fontSize: '13px'
  },
  fieldTag: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#e2e8f0'
  },
  removeFieldBtn: {
    background: 'none',
    border: 'none',
    color: '#ef4444',
    cursor: 'pointer',
    fontSize: '12px',
    padding: 0
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '12px'
  },
  cancelBtn: {
    padding: '10px 20px',
    backgroundColor: 'transparent',
    color: '#94a3b8',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '500'
  },
  submitBtn: {
    padding: '10px 20px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600'
  },
  backLink: {
    background: 'none',
    border: 'none',
    color: '#60a5fa',
    cursor: 'pointer',
    fontSize: '14px',
    marginBottom: '16px',
    display: 'inline-block',
    padding: 0
  },
  assignmentDetailsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    paddingBottom: '16px',
    marginBottom: '16px'
  },
  subjectBadge: {
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    color: '#60a5fa',
    display: 'inline-block',
    marginBottom: '8px'
  },
  assignmentDetailsTitle: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 'bold'
  },
  simulationMeta: {
    margin: '4px 0 0 0',
    fontSize: '13px',
    color: '#94a3b8'
  },
  classMeta: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#e2e8f0'
  },
  instructionsBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    padding: '16px',
    borderRadius: '8px',
    fontSize: '14px'
  },
  sectionHeader: {
    fontSize: '16px',
    fontWeight: 'bold',
    margin: '0 0 16px 0',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    paddingBottom: '8px'
  },
  loader: {
    textAlign: 'center',
    padding: '40px',
    color: '#94a3b8'
  },
  emptyState: {
    textAlign: 'center',
    padding: '48px',
    color: '#64748b',
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: '12px',
    border: '1px dashed rgba(255, 255, 255, 0.1)'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '20px'
  },
  assignmentCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: '180px',
    transition: 'transform 0.2s, border-color 0.2s',
    '&:hover': {
      transform: 'translateY(-2px)',
      borderColor: 'rgba(255, 255, 255, 0.12)'
    }
  },
  cardSubjectRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  subjectTag: {
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 'bold',
    color: 'white'
  },
  classTag: {
    color: '#94a3b8',
    fontSize: '12px'
  },
  assignmentTitle: {
    margin: '0 0 8px 0',
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#f8fafc'
  },
  assignmentInstructionsPreview: {
    margin: '0 0 16px 0',
    fontSize: '13px',
    color: '#94a3b8',
    lineHeight: '1.4'
  },
  assignmentFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto'
  },
  simBadge: {
    fontSize: '12px',
    color: '#cbd5e1',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: '4px 8px',
    borderRadius: '4px'
  },
  viewSubmissionsBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#60a5fa',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 'bold',
    padding: 0
  },
  submissionsTableWrapper: {
    overflowX: 'auto'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px',
    color: '#cbd5e1'
  },
  th: {
    textAlign: 'left',
    padding: '12px 16px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#94a3b8',
    fontWeight: '600'
  },
  tr: {
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.02)'
    }
  },
  td: {
    padding: '14px 16px',
    verticalAlign: 'middle'
  },
  miniDataGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px'
  },
  miniDataTag: {
    fontSize: '12px',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    padding: '3px 8px',
    borderRadius: '4px',
    color: '#e2e8f0',
    border: '1px solid rgba(255, 255, 255, 0.03)'
  },
  gradedScoreTag: {
    color: '#10b981',
    fontWeight: 'bold',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    padding: '4px 8px',
    borderRadius: '4px'
  },
  pendingScoreTag: {
    color: '#f59e0b',
    fontWeight: '500',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    padding: '4px 8px',
    borderRadius: '4px'
  },
  gradeBtn: {
    padding: '6px 12px',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    color: '#60a5fa',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 'bold',
    transition: 'all 0.2s',
    '&:hover': {
      backgroundColor: 'rgba(59, 130, 246, 0.3)'
    }
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: '20px'
  },
  modalContainer: {
    position: 'relative',
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '960px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
  },
  modalTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 'bold',
    color: 'white'
  },
  modalContent: {
    padding: '24px',
    overflowY: 'auto',
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr',
    gap: '24px',
    '@media (max-width: 768px)': {
      gridTemplateColumns: '1fr'
    }
  },
  modalSectionTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '12px'
  },
  screenshotPanel: {
    display: 'flex',
    flexDirection: 'column'
  },
  screenshotLink: {
    display: 'block',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '8px',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000',
    cursor: 'pointer'
  },
  screenshotImage: {
    width: '100%',
    height: 'auto',
    maxHeight: '340px',
    objectFit: 'contain',
    display: 'block'
  },
  zoomHint: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    padding: '8px',
    textAlign: 'center',
    fontSize: '12px',
    color: '#e2e8f0',
    fontWeight: '500'
  },
  noScreenshot: {
    height: '240px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '8px',
    color: '#64748b',
    border: '1px dashed rgba(255, 255, 255, 0.1)',
    fontSize: '14px'
  },
  dataPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  dataValuesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '10px'
  },
  dataValueCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    border: '1px solid rgba(255, 255, 255, 0.04)',
    borderRadius: '8px',
    padding: '12px'
  },
  dataValueKey: {
    fontSize: '12px',
    color: '#94a3b8',
    marginBottom: '4px'
  },
  dataValueVal: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#f1f5f9'
  },
  gradingForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    paddingTop: '20px'
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '8px'
  }
};
