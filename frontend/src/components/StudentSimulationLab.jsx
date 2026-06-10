import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, setDoc, getDoc, limit } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../services/firebase';
import { getEmbedUrl } from '../utils/phetSimulations';
import { successToast, errorToast } from '../utils/toast';
import { compressImage } from '../utils/imageCompression';
import { QAForum } from './QAForum';
import { awardBadge } from '../services/firestoreService';
import { offlineDB, isOffline, addConnectivityListeners } from '../utils/offlineDB';

const SUBJECT_UNITS = {
  Physics: [
    'V', 'mV', 'A', 'mA', 'Ω', 'kΩ', 'MΩ',
    'm', 'cm', 'mm', 'km', 's', 'ms', 'min', 'h',
    'N', 'J', 'kJ', 'W', 'kW', 'm/s', 'm/s²', 'rad', '°', 'kg', 'g'
  ],
  Chemistry: [
    'mol/L', 'M', 'g', 'mg', 'kg', 'mL', 'L', 
    '°C', 'K', 'atm', 'Pa', 'kPa', 'bar', 'ppm', 'g/mol', 's', 'min', '%'
  ],
  Biology: [
    '°C', 'g', 'mg', 'mL', 'L', 'μm', 'mm', 'cm', 'm', 's', 'min', 'h', '%'
  ],
  Math: [
    'rad', '°', 'm', 'cm', 'mm', 'unit', 'units', 'sq unit', 'cu unit', '%'
  ]
};

const DEFAULT_UNITS = [
  'V', 'mV', 'A', 'mA', 'Ω', 'kΩ', 'MΩ',
  'm', 'cm', 'mm', 'km', 'kg', 'g', 'mg', 's', 'ms', 'min', 'h',
  'N', 'J', 'kJ', '°C', 'K', 'm/s', 'm/s²', 'L', 'mL', 'rad', '°', '%'
];

const SIMULATION_UNITS = {
  // Physics simulations
  'circuit-construction-kit-dc': ['V', 'mV', 'A', 'mA', 'Ω', 'kΩ', 'MΩ'],
  'ohms-law': ['V', 'mV', 'A', 'mA', 'Ω', 'kΩ', 'MΩ'],
  'capacitor-lab-basics': ['F', 'pF', 'nF', 'V', 'J', 'nJ', 'C', 'pC'],
  'forces-and-motion-basics': ['N', 'kg', 'm/s', 'm/s²', 'm', 's'],
  'projectile-motion': ['m', 's', 'm/s', 'm/s²', '°', 'kg'],
  'gravity-and-orbits': ['kg', 'm', 'km', 'N', 's', 'day', 'days', 'yr'],
  'pendulum-lab': ['s', 'm', 'cm', 'kg', 'g', '°', 'm/s²'],
  'wave-on-a-string': ['Hz', 's', 'cm', 'm', 'm/s'],
  'bending-light': ['°', 'nm', 'index'],
  'energy-skate-park-basics': ['J', 'kJ', 'm', 'kg', 'm/s'],
  'collision-lab': ['kg', 'm/s', 'kg·m/s', 'J', 's'],

  // Chemistry simulations
  'concentration': ['mol/L', 'M', 'L', 'mL', '%'],
  'ph-scale': ['pH', 'mol/L', 'M', 'L', 'mL'],
  'acid-base-solutions': ['pH', 'mol/L', 'M', 'L', 'mL', 'S/cm', 'μS/cm'],
  'gas-properties': ['atm', 'kPa', 'K', '°C', 'pm', 'nm', 's', 'ps'],
  'states-of-matter-basics': ['K', '°C', 'atm', 'Pa', 'kPa'],
  'density': ['g/mL', 'kg/L', 'g', 'kg', 'mL', 'L', 'cm³'],
  'build-an-atom': ['amu', 'element', 'net charge'],
  'balancing-chemical-equations': ['coefficients', 'count'],
  'reactants-products-reversible': ['particles', 'mol', 'count'],

  // Biology simulations
  'natural-selection': ['rabbits', 'wolves', 'generations', '%'],
  'neuron': ['mV', 'ms', 'ions'],
  'enzyme-kinetics': ['mol/s', 'mol/L·s', 'M/s', '°C', 'min', 's'],
  'photosynthesis': ['ppm', 'μmol/m²·s', 'mL', 'min', 'h', '%'],

  // Math simulations (GeoGebra)
  'vd674zrn': ['rad', '°', 'unit'],
  'm94m23vz': ['unit', 'units', 'sq unit'],
  'wwzq7yd8': ['unit', 'units'],
  'cgdcrscz': ['slope', 'unit']
};

const getSubjectUnits = (subject) => {
  if (!subject) return DEFAULT_UNITS;
  const normalized = subject.trim().charAt(0).toUpperCase() + subject.trim().slice(1).toLowerCase();
  return SUBJECT_UNITS[normalized] || DEFAULT_UNITS;
};

const getSimulationUnits = (slug, subject) => {
  if (slug && SIMULATION_UNITS[slug]) {
    return SIMULATION_UNITS[slug];
  }
  return getSubjectUnits(subject);
};

export default function StudentSimulationLab({ studentId, studentName, classNumber, schoolName, subject }) {
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState(null);
  const [expandedQA, setExpandedQA] = useState(false);
  
  // Student input form state
  const [recordedValues, setRecordedValues] = useState({});
  const [inputAnswers, setInputAnswers] = useState({});
  const [selectedUnits, setSelectedUnits] = useState({});
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // Resize listener for responsive layout
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth <= 768;

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

  // Fetch student's class assignments and their existing submissions
  const fetchData = async () => {
    if (!studentId || !classNumber) return;
    try {
      setLoading(true);
      
      if (isOffline()) {
        const cachedAssignments = await offlineDB.getSimulationAssignments(classNumber, subject);
        setAssignments(cachedAssignments);
        
        const cachedSubmissions = await offlineDB.getQueuedSubmissions();
        const subMap = {};
        cachedSubmissions.forEach(sub => {
          if (sub.studentId === studentId) {
            subMap[sub.assignmentId] = sub;
          }
        });
        setSubmissions(subMap);
        return;
      }
      
      // 1. Fetch simulation assignments for this class
      const classInt = parseInt(classNumber);
      const constraints = [where('class', '==', classInt)];
      if (subject) {
        constraints.push(where('subject', '==', subject));
      }
      
      let q = query(
        collection(db, 'simulationAssignments'),
        ...constraints
      );
      let snap = await getDocs(q);
      
      // Try string class fallback if empty
      if (snap.empty) {
        const fallbackConstraints = [where('class', '==', String(classNumber))];
        if (subject) {
          fallbackConstraints.push(where('subject', '==', subject));
        }
        q = query(
          collection(db, 'simulationAssignments'),
          ...fallbackConstraints
        );
        snap = await getDocs(q);
      }

      const list = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      // Save fetched assignments to offline DB
      try {
        await offlineDB.saveSimulationAssignments(list);
      } catch (e) {
        console.warn('Failed to cache simulation assignments:', e);
      }

      // 2. Fetch student's submissions for simulation assignments (limited to 50)
      const subQ = query(
        collection(db, 'simulationSubmissions'),
        where('studentId', '==', studentId),
        limit(50)
      );
      const subSnap = await getDocs(subQ);
      const subMap = {};
      subSnap.docs.forEach(d => {
        const data = d.data();
        subMap[data.assignmentId] = {
          id: d.id,
          ...data
        };
      });

      setAssignments(list);
      setSubmissions(subMap);
    } catch (err) {
      console.error(err);
      errorToast('Failed to load simulation tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [studentId, classNumber, subject]);

  const syncOfflineSubmissions = async () => {
    if (isOffline()) return;
    try {
      const queued = await offlineDB.getQueuedSubmissions();
      if (queued.length === 0) return;

      console.log(`Syncing ${queued.length} offline simulation submissions...`);
      for (const sub of queued) {
        let screenshotUrl = sub.screenshotUrl;

        if (sub.isLocalBase64) {
          const response = await fetch(sub.screenshotUrl);
          const blob = await response.blob();
          const file = new File([blob], `screenshot_${sub.assignmentId}.png`, { type: 'image/png' });

          const storageRef = ref(storage, `submissions/${sub.studentId}/simulations/${sub.assignmentId}_${Date.now()}.png`);
          const uploadResult = await uploadBytes(storageRef, file);
          screenshotUrl = await getDownloadURL(uploadResult.ref);
        }

        const docRef = doc(db, 'simulationSubmissions', sub.id);
        await setDoc(docRef, {
          id: sub.id,
          assignmentId: sub.assignmentId,
          assignmentTitle: sub.assignmentTitle,
          subject: sub.subject,
          studentId: sub.studentId,
          studentName: sub.studentName,
          recordedValues: sub.recordedValues,
          screenshotUrl,
          status: 'pending',
          submittedAt: new Date(sub.submittedAt)
        });

        try {
          await awardBadge(sub.studentId, 'lab_explorer');
        } catch (e) {
          console.warn('Failed to award badge during sync:', e);
        }

        await offlineDB.markSubmissionSynced(sub.id);
      }
      
      successToast('Offline simulation submissions synced successfully!');
      fetchData();
    } catch (error) {
      console.error('Error syncing offline submissions:', error);
    }
  };

  useEffect(() => {
    if (!isOffline()) {
      syncOfflineSubmissions();
    }

    const removeListeners = addConnectivityListeners(
      () => {
        console.log('Connectivity restored: Online. Triggering sync...');
        syncOfflineSubmissions();
      },
      () => {
        console.log('Connection lost: Offline mode active.');
      }
    );

    return () => removeListeners();
  }, [studentId, classNumber, subject]);

  // Start Simulation Task
  const handleStartTask = (task) => {
    setActiveTask(task);
    setIsMobileDrawerOpen(false);
    
    const initialValues = {};
    const initialAnswers = {};
    const initialUnits = {};
    
    // Check if there's already a submission
    const existing = submissions[task.id];
    
    task.fieldsToRecord.forEach(field => {
      let savedVal = '';
      if (existing && existing.recordedValues && existing.recordedValues[field]) {
        savedVal = existing.recordedValues[field];
      }
      
      // Parse savedVal (e.g. "12 mA" -> val="12", unit="mA")
      let val = savedVal;
      let unit = '';
      if (savedVal) {
        const parts = savedVal.trim().split(/\s+/);
        if (parts.length > 1) {
          val = parts[0];
          unit = parts[1];
        } else {
          val = parts[0];
        }
      } else {
        // Try to guess default unit from field name like "Voltage (V)"
        const match = field.match(/\(([^)]+)\)/);
        if (match && match[1]) {
          unit = match[1];
        }
      }
      
      initialAnswers[field] = val;
      initialUnits[field] = unit;
      initialValues[field] = (val + (unit ? ' ' + unit : '')).trim();
    });
    
    setInputAnswers(initialAnswers);
    setSelectedUnits(initialUnits);
    setRecordedValues(initialValues);
    setScreenshotFile(null);
  };

  // Handle answer value change for parameter fields
  const handleAnswerChange = (field, val) => {
    setInputAnswers(prev => {
      const newAnswers = { ...prev, [field]: val };
      const currentUnit = selectedUnits[field] || '';
      const combined = (val + (currentUnit ? ' ' + currentUnit : '')).trim();
      setRecordedValues(r => ({ ...r, [field]: combined }));
      return newAnswers;
    });
  };

  // Handle unit selection change for parameter fields
  const handleUnitChange = (field, unit) => {
    setSelectedUnits(prev => {
      const newUnits = { ...prev, [field]: unit };
      const currentAnswer = inputAnswers[field] || '';
      const combined = (currentAnswer + (unit ? ' ' + unit : '')).trim();
      setRecordedValues(r => ({ ...r, [field]: combined }));
      return newUnits;
    });
  };

  // Handle file picker
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setScreenshotFile(file);
    } else {
      errorToast('Please upload a valid image file (PNG/JPG)');
      setScreenshotFile(null);
    }
  };

  // Submit Simulation Submissions
  const handleSubmitTask = async (e) => {
    e.preventDefault();
    if (!activeTask) return;

    // Validate parameter inputs
    const missingFields = activeTask.fieldsToRecord.filter(field => !recordedValues[field]?.trim());
    if (missingFields.length > 0) {
      errorToast(`Please record values for all parameters: ${missingFields.join(', ')}`);
      return;
    }

    if (!screenshotFile) {
      errorToast('Please upload a verification screenshot of your simulation');
      return;
    }

    setSubmitting(true);
    try {
      if (isOffline()) {
        const base64Screenshot = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(screenshotFile);
        });

        const submissionId = `${studentId}_${activeTask.id}`;
        const submissionData = {
          id: submissionId,
          assignmentId: activeTask.id,
          assignmentTitle: activeTask.title || 'Simulation Lab Task',
          subject: activeTask.subject || 'Physics',
          studentId: studentId,
          studentName: studentName || 'Student',
          recordedValues: recordedValues,
          screenshotUrl: base64Screenshot,
          isLocalBase64: true,
          status: 'pending',
          submittedAt: new Date()
        };

        await offlineDB.queueOfflineSubmission(submissionData);
        successToast('Saved offline! Will sync automatically when online.');

        setActiveTask(null);
        setIsMobileDrawerOpen(false);
        fetchData();
        return;
      }

      // 1. Compress and Upload Screenshot to Storage under user-specific path
      const compressedFile = await compressImage(screenshotFile, {
        maxSizeMB: 0.3,
        maxWidthOrHeight: 1280
      });
      const storageRef = ref(storage, `submissions/${studentId}/simulations/${activeTask.id}_${Date.now()}.png`);
      const uploadResult = await uploadBytes(storageRef, compressedFile);
      const screenshotUrl = await getDownloadURL(uploadResult.ref);

      // 2. Create/Update document in Firestore using a unique ID of studentUid_assignmentId
      const submissionId = `${studentId}_${activeTask.id}`;
      const docRef = doc(db, 'simulationSubmissions', submissionId);
      
      const submissionData = {
        id: submissionId,
        assignmentId: activeTask.id,
        assignmentTitle: activeTask.title || 'Simulation Lab Task',
        subject: activeTask.subject || 'Physics',
        studentId: studentId,
        studentName: studentName || 'Student',
        recordedValues: recordedValues,
        screenshotUrl: screenshotUrl,
        status: 'pending',
        submittedAt: new Date()
      };

      await setDoc(docRef, submissionData);
      
      try {
        await awardBadge(studentId, 'lab_explorer');
      } catch (e) {
        console.warn('Failed to award lab_explorer badge:', e);
      }
      
      successToast('Lab simulation assignment submitted successfully!');
      
      // Close workspace and drawer
      setActiveTask(null);
      setIsMobileDrawerOpen(false);
      
      // Refresh assignments data
      fetchData();
    } catch (err) {
      console.error(err);
      errorToast('Failed to submit simulation. Please check your connection.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div style={styles.loader}>Loading virtual simulation lab...</div>;
  }

  // WORKSPACE VIEW (Active Lab running)
  if (activeTask) {
    const embedUrl = getEmbedUrl(activeTask.simulationType, activeTask.simulationSlug);
    const existingSubmission = submissions[activeTask.id];

    return (
      <div style={{
        ...styles.workspaceContainer,
        ...(isMobile ? {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          height: '100vh',
          zIndex: 95,
          backgroundColor: '#070912'
        } : {})
      }}>
        {/* Workspace Header */}
        <div style={styles.workspaceHeader}>
          <button style={styles.exitBtn} onClick={() => setActiveTask(null)}>
            ← Exit Lab
          </button>
          <div>
            <h3 style={styles.workspaceTitle}>{activeTask.title}</h3>
            <span style={styles.workspaceSimMeta}>💻 {activeTask.simulationName}</span>
          </div>
          {isMobile && (
            <button
              style={styles.drawerTriggerBtn}
              onClick={() => setIsMobileDrawerOpen(!isMobileDrawerOpen)}
            >
              📋 {isMobileDrawerOpen ? 'Close Submit Form' : 'Submit Experiment'}
            </button>
          )}
        </div>

        {/* Workspace Body */}
        <div style={styles.workspaceBody}>
          {/* Iframe Viewport (always active and largest) */}
          <div style={styles.iframeWrapper}>
            {embedUrl ? (
              <iframe
                src={embedUrl}
                title={activeTask.title}
                style={styles.iframe}
                allow="geolocation; microphone; camera; midi; encrypted-media; fullscreen"
              />
            ) : (
              <div style={styles.noIframe}>Unable to load simulation preview.</div>
            )}
          </div>

          {/* Submission panel: Drawer on mobile, Sidebar on desktop */}
          <div style={{
            ...styles.formSidebar,
            ...(isMobile ? (isMobileDrawerOpen ? styles.mobileDrawerOpen : styles.mobileDrawerClosed) : {})
          }}>
            <div style={styles.sidebarHeader}>
              <h4 style={styles.sidebarTitle}>Lab Notebook & Submission</h4>
              {isMobile && (
                <button
                  style={styles.drawerCloseX}
                  onClick={() => setIsMobileDrawerOpen(false)}
                >
                  ✕
                </button>
              )}
            </div>

            <div style={styles.sidebarScrollable}>
              {/* Instructions */}
              <div style={styles.sidebarSection}>
                <h5 style={styles.sectionHeader}>Experiment Instructions</h5>
                <p style={styles.instructionsText}>{activeTask.instructions || 'No instructions provided.'}</p>
              </div>

              {/* Form Input */}
              <form onSubmit={handleSubmitTask} style={styles.submissionForm}>
                <h5 style={styles.sectionHeader}>Record Parameters</h5>
                {activeTask.fieldsToRecord.map(field => (
                  <div key={field} style={styles.inputGroup}>
                    <label style={styles.label}>{field}</label>
                    <div style={styles.inputWithUnitRow}>
                      <input
                        type="text"
                        style={styles.inputWithUnitField}
                        value={inputAnswers[field] || ''}
                        onChange={(e) => handleAnswerChange(field, e.target.value)}
                        placeholder="Enter value..."
                        disabled={existingSubmission?.status === 'graded'}
                        required
                      />
                      <select
                        style={styles.unitSelect}
                        value={selectedUnits[field] || ''}
                        onChange={(e) => handleUnitChange(field, e.target.value)}
                        disabled={existingSubmission?.status === 'graded'}
                      >
                        <option value="">Unit</option>
                        {getSimulationUnits(activeTask.simulationSlug, activeTask.subject).map(u => (
                          <option key={u} value={u}>{u || 'none'}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}

                {/* Screenshot Uploader */}
                <h5 style={styles.sectionHeader}>Lab Evidence</h5>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Upload Verification Screenshot</label>
                  <input
                    type="file"
                    accept="image/*"
                    style={styles.fileInput}
                    onChange={handleFileChange}
                    disabled={existingSubmission?.status === 'graded'}
                  />
                  <small style={styles.fileHelperText}>
                    Perform the simulation, take a screenshot of your results, and upload it here.
                  </small>
                  {screenshotFile && (
                    <div style={styles.selectedFileDisplay}>
                      📸 {screenshotFile.name} (Ready to upload)
                    </div>
                  )}
                </div>

                {existingSubmission && (
                  <div style={styles.existingSubmissionAlert}>
                    <strong>Already Submitted</strong>
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
                      Status: {existingSubmission.status.toUpperCase()}
                      {existingSubmission.grade !== undefined && ` | Grade: ${existingSubmission.grade}/10`}
                    </p>
                    {existingSubmission.feedback && (
                      <p style={styles.feedbackText}>
                        <strong>Teacher Comments:</strong> {existingSubmission.feedback}
                      </p>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  style={styles.submitBtn}
                  disabled={submitting || existingSubmission?.status === 'graded'}
                >
                  {submitting ? 'Uploading Submission...' : 'Submit Lab Report'}
                </button>
              </form>

              {/* Collapsible Q&A Forum */}
              <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setExpandedQA(!expandedQA)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px',
                    color: '#cbd5e1',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontWeight: '700',
                    fontSize: '13px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: expandedQA ? '12px' : '0',
                    outline: 'none'
                  }}
                >
                  <span>💬 Classroom Discussion Forum</span>
                  <span>{expandedQA ? '▲ Hide' : '▼ Show'}</span>
                </button>
                {expandedQA && (
                  <div style={{ marginTop: '10px' }}>
                    <QAForum
                      itemId={activeTask.id}
                      userId={studentId}
                      userName={studentName}
                      userRole="student"
                      schoolName={schoolName}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // DASHBOARD LIST VIEW
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>🧪 Virtual Simulation Lab</h2>
        <p style={styles.subtitle}>Interact with live experiments, record your findings, and upload lab reports.</p>
      </div>

      {assignments.length === 0 ? (
        <div style={styles.emptyState}>
          No simulation assignments have been assigned to your class yet. Check back later!
        </div>
      ) : (
        <div style={styles.grid}>
          {assignments.map(task => {
            const submission = submissions[task.id];
            let statusBadge = { text: 'Not Started', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)' };
            
            if (submission) {
              if (submission.status === 'graded') {
                statusBadge = { text: `Graded (${submission.grade}/10)`, color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' };
              } else {
                statusBadge = { text: 'Submitted (Pending Review)', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' };
              }
            }

            return (
              <div key={task.id} style={styles.card}>
                <div style={styles.cardHeaderRow}>
                  <span style={styles.subjectTag}>{task.subject}</span>
                  <span style={{
                    ...styles.statusTag,
                    color: statusBadge.color,
                    backgroundColor: statusBadge.bg
                  }}>
                    {statusBadge.text}
                  </span>
                </div>

                <h3 style={styles.cardTitle}>{task.title}</h3>
                
                {task.dueDate && (
                  <div style={{ ...styles.cardDetails, color: '#f59e0b', fontWeight: '600', marginBottom: '8px' }}>
                    ⏳ Due: {formatDueDate(task.dueDate)}
                  </div>
                )}

                <div style={styles.cardDetails}>
                  <strong>Simulation:</strong> {task.simulationName}
                </div>

                <div style={styles.cardFooter}>
                  {submission?.feedback && (
                    <div style={styles.feedbackPreview}>
                      💬 <em>"{submission.feedback.substring(0, 50)}{submission.feedback.length > 50 ? '...' : ''}"</em>
                    </div>
                  )}
                  
                  <button
                    style={{
                      ...styles.startBtn,
                      backgroundColor: submission ? 'rgba(255, 255, 255, 0.08)' : '#3b82f6',
                      color: submission ? '#cbd5e1' : 'white',
                      borderColor: submission ? 'rgba(255,255,255,0.1)' : 'transparent'
                    }}
                    onClick={() => handleStartTask(task)}
                  >
                    {submission ? '🔬 Open Lab Again' : '🔬 Start Experiment'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: '20px',
    color: 'white',
    fontFamily: 'Inter, system-ui, sans-serif'
  },
  header: {
    marginBottom: '24px'
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
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '20px'
  },
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: '200px'
  },
  cardHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  subjectTag: {
    fontSize: '11px',
    fontWeight: 'bold',
    padding: '4px 8px',
    borderRadius: '4px',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    color: '#60a5fa'
  },
  statusTag: {
    fontSize: '11px',
    fontWeight: '600',
    padding: '4px 8px',
    borderRadius: '4px'
  },
  cardTitle: {
    margin: '0 0 8px 0',
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#f8fafc'
  },
  cardDetails: {
    fontSize: '13px',
    color: '#94a3b8',
    marginBottom: '16px'
  },
  cardFooter: {
    marginTop: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  feedbackPreview: {
    fontSize: '12px',
    color: '#34d399',
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
    padding: '6px 10px',
    borderRadius: '6px'
  },
  startBtn: {
    width: '100%',
    padding: '10px',
    border: '1px solid transparent',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '14px',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px'
  },
  
  // WORKSPACE VIEW STYLES
  workspaceContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 100px)', // dynamic offset for dashboard navbar
    color: 'white',
    fontFamily: 'Inter, system-ui, sans-serif'
  },
  workspaceHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 20px',
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    flexWrap: 'wrap',
    gap: '8px'
  },
  exitBtn: {
    padding: '8px 16px',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    color: '#e2e8f0',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '500',
    fontSize: '13px'
  },
  workspaceTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 'bold'
  },
  workspaceSimMeta: {
    fontSize: '12px',
    color: '#94a3b8'
  },
  drawerTriggerBtn: {
    padding: '8px 16px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '13px'
  },
  workspaceBody: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
    position: 'relative'
  },
  iframeWrapper: {
    flex: 1,
    height: '100%',
    backgroundColor: '#1e293b',
    position: 'relative'
  },
  iframe: {
    width: '100%',
    height: '100%',
    border: 'none',
    backgroundColor: '#1e293b'
  },
  noIframe: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#64748b'
  },
  formSidebar: {
    width: '340px',
    height: '100%',
    backgroundColor: 'rgba(30, 41, 59, 0.98)',
    borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 10,
    transition: 'transform 0.3s ease-in-out'
  },
  sidebarHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0
  },
  sidebarTitle: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 'bold'
  },
  drawerCloseX: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    fontSize: '18px',
    cursor: 'pointer'
  },
  sidebarScrollable: {
    padding: '20px',
    overflowY: 'auto',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  sidebarSection: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    padding: '14px',
    borderRadius: '8px'
  },
  sectionHeader: {
    margin: '0 0 10px 0',
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  instructionsText: {
    margin: 0,
    fontSize: '13px',
    color: '#cbd5e1',
    lineHeight: '1.5',
    whiteSpace: 'pre-wrap'
  },
  submissionForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  label: {
    fontSize: '12px',
    color: '#cbd5e1',
    fontWeight: '500'
  },
  input: {
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '6px',
    padding: '8px 12px',
    color: 'white',
    fontSize: '13px',
    outline: 'none',
    '&:focus': {
      borderColor: '#3b82f6'
    }
  },
  fileInput: {
    fontSize: '12px',
    color: '#94a3b8'
  },
  fileHelperText: {
    fontSize: '11px',
    color: '#64748b',
    marginTop: '2px'
  },
  selectedFileDisplay: {
    fontSize: '12px',
    color: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    padding: '6px 10px',
    borderRadius: '6px',
    marginTop: '4px'
  },
  existingSubmissionAlert: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '13px',
    color: '#93c5fd'
  },
  feedbackText: {
    margin: '8px 0 0 0',
    paddingTop: '8px',
    borderTop: '1px solid rgba(59, 130, 246, 0.2)',
    color: '#34d399'
  },
  submitBtn: {
    padding: '12px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '14px',
    marginTop: '10px'
  },
  loader: {
    textAlign: 'center',
    padding: '40px',
    color: '#94a3b8'
  },

  // MOBILE DRAWER TRANSITIONS (Absolute positioning overlay on mobile)
  mobileDrawerOpen: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '100%',
    transform: 'translateX(0)'
  },
  mobileDrawerClosed: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '100%',
    transform: 'translateX(100%)'
  },
  inputWithUnitRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    width: '100%'
  },
  inputWithUnitField: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '6px',
    padding: '8px 12px',
    color: 'white',
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box',
    width: '100%',
  },
  unitSelect: {
    width: '90px',
    flexShrink: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '6px',
    padding: '8px 10px',
    color: 'white',
    fontSize: '13px',
    outline: 'none',
    cursor: 'pointer',
    boxSizing: 'border-box',
  }
};
