const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

// Configure your email service
// Replace with your email credentials
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Cloud Function to send email when feedback is submitted
exports.sendFeedbackEmail = functions.firestore
  .document('feedback/{feedbackId}')
  .onCreate(async (snap, context) => {
    const feedback = snap.data();

    // Build subject line with user details
    let subjectLine = `TriSphere Feedback: ${feedback.userName}`;
    if (feedback.userRole === 'student' && feedback.userClass) {
      subjectLine += ` (Student - Class ${feedback.userClass})`;
    } else if (feedback.userRole === 'teacher') {
      subjectLine += ` (Teacher)`;
    } else if (feedback.userRole === 'parent') {
      subjectLine += ` (Parent)`;
    }

    const mailOptions = {
      from: 'sathwikjpoojary@gmail.com',
      to: 'sathwikjpoojary@gmail.com',
      subject: subjectLine,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #7928ca, #ff0080); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
            .info-row { padding: 10px 0; border-bottom: 1px solid #ddd; }
            .info-label { font-weight: bold; color: #7928ca; }
            .feedback-box { background: white; padding: 15px; margin-top: 15px; border-left: 4px solid #7928ca; border-radius: 4px; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2 style="margin: 0;">📝 New Feedback Received</h2>
              <p style="margin: 5px 0 0 0; opacity: 0.9;">TriSphere Learning Platform</p>
            </div>
            <div class="content">
              <div class="info-row">
                <span class="info-label">User:</span> ${feedback.userName}
              </div>
              <div class="info-row">
                <span class="info-label">Role:</span> ${feedback.userRole.charAt(0).toUpperCase() + feedback.userRole.slice(1)}
              </div>
              ${feedback.userClass ? `
              <div class="info-row">
                <span class="info-label">Class:</span> Class ${feedback.userClass}
              </div>
              ` : ''}
              ${feedback.childName ? `
              <div class="info-row">
                <span class="info-label">Child:</span> ${feedback.childName}
              </div>
              ` : ''}
              <div class="info-row">
                <span class="info-label">Email:</span> ${feedback.email}
              </div>
              <div class="info-row">
                <span class="info-label">Date & Time:</span> ${feedback.timestamp.toDate().toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}
              </div>
              
              <h3 style="margin-top: 20px; color: #7928ca;">Feedback Message:</h3>
              <div class="feedback-box">
                ${feedback.feedback.replace(/\n/g, '<br>')}
              </div>
            </div>
            <div class="footer">
              <p>This is an automated message from TriSphere Feedback System</p>
              <p>View all feedback in <a href="https://console.firebase.google.com" style="color: #7928ca;">Firebase Console</a></p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log('Feedback email sent successfully');
      return null;
    } catch (error) {
      console.error('Error sending email:', error);
      return null;
    }
  });

// Cloud Function to send email when a demo request is submitted
exports.sendDemoRequestEmail = functions.firestore
  .document('demoRequests/{requestId}')
  .onCreate(async (snap, context) => {
    const request = snap.data();

    const mailOptions = {
      from: process.env.EMAIL_USER || 'sathwikjpoojary@gmail.com',
      to: 'contact@yugnext-ai.com',
      subject: `New Demo Request: ${request.institutionName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #7928ca, #ff0080); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
            .info-row { padding: 10px 0; border-bottom: 1px solid #ddd; }
            .info-label { font-weight: bold; color: #7928ca; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2 style="margin: 0;">📅 New Demo Request</h2>
              <p style="margin: 5px 0 0 0; opacity: 0.9;">TriSphere Learning Platform</p>
            </div>
            <div class="content">
              <div class="info-row">
                <span class="info-label">Institution:</span> ${request.institutionName}
              </div>
              <div class="info-row">
                <span class="info-label">Email:</span> ${request.emailId}
              </div>
              <div class="info-row">
                <span class="info-label">Phone:</span> ${request.phoneNumber}
              </div>
              <div class="info-row">
                <span class="info-label">Date & Time:</span> ${request.timestamp ? request.timestamp.toDate().toLocaleString('en-US') : new Date().toLocaleString('en-US')}
              </div>
            </div>
            <div class="footer">
              <p>This is an automated message from TriSphere Demo Request System</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log('Demo request email sent successfully to contact@yugnext-ai.com');
      return null;
    } catch (error) {
      console.error('Error sending demo request email:', error);
      return null;
    }
  });

// Sync the `role` field from users/{uid} onto the user's Auth custom claims.
// Storage rules can then check request.auth.token.role without a Firestore lookup.
// The claim becomes visible on the client after the next ID token refresh
// (forced via user.getIdToken(true) or naturally within 1 hour / on next login).
exports.syncUserClaims = functions.firestore
  .document('users/{uid}')
  .onWrite(async (change, context) => {
    const uid = context.params.uid;
    const after = change.after.exists ? change.after.data() : null;
    const before = change.before.exists ? change.before.data() : null;

    // If the doc was deleted, clear claims (the Auth user is usually deleted too,
    // but if not we still want an unprivileged token).
    if (!after) {
      try {
        await admin.auth().setCustomUserClaims(uid, null);
        console.log(`Cleared claims for deleted user doc ${uid}`);
      } catch (err) {
        if (err.code !== 'auth/user-not-found') {
          console.error(`Failed to clear claims for ${uid}:`, err);
        }
      }
      return null;
    }

    const newRole = after.role || null;
    const oldRole = before ? before.role || null : null;

    // Skip no-op writes (other fields changed, role didn't).
    if (newRole === oldRole) return null;

    if (!newRole) {
      console.warn(`User doc ${uid} written with no role, skipping claim sync.`);
      return null;
    }

    try {
      await admin.auth().setCustomUserClaims(uid, { role: newRole });
      console.log(`Set role="${newRole}" claim on ${uid}`);
    } catch (err) {
      // auth/user-not-found can happen if the Firestore doc is created before
      // the Auth user exists — rare, but don't crash the trigger.
      if (err.code === 'auth/user-not-found') {
        console.warn(`Auth user ${uid} not found while syncing claims, will retry on next doc write.`);
      } else {
        console.error(`Failed to set claims for ${uid}:`, err);
        throw err;
      }
    }
    return null;
  });

// Cloud Function to delete a user from Firebase Authentication
// This uses Admin SDK which can delete any user without needing their password
exports.deleteUserAccount = functions.https.onCall(async (data, context) => {
  // Check if the caller is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to delete accounts.');
  }

  const { uid, callerUid } = data;

  if (!uid) {
    throw new functions.https.HttpsError('invalid-argument', 'User UID is required.');
  }

  // Verify the caller is a principal/admin
  try {
    const callerDoc = await admin.firestore().collection('users').doc(callerUid || context.auth.uid).get();
    const callerData = callerDoc.data();
    if (!callerDoc.exists || (callerData.role !== 'principal' && callerData.role !== 'admin' && callerData.role !== 'developer')) {
      throw new functions.https.HttpsError('permission-denied', 'Only authorized staff can delete user accounts.');
    }
  } catch (error) {
    console.error('Error verifying caller:', error);
    throw new functions.https.HttpsError('internal', 'Failed to verify permissions.');
  }

  // Delete the user from Firebase Authentication
  try {
    await admin.auth().deleteUser(uid);
    console.log(`Successfully deleted user ${uid} from Firebase Auth`);
    return { success: true, message: 'User deleted from Authentication successfully.' };
  } catch (error) {
    console.error('Error deleting user from Auth:', error);
    if (error.code === 'auth/user-not-found') {
      // User doesn't exist in Auth, that's okay - maybe already deleted
      return { success: true, message: 'User was not found in Authentication (may already be deleted).' };
    }
    throw new functions.https.HttpsError('internal', `Failed to delete user: ${error.message}`);
  }
});

// Cloud Function to update a user's password using Admin SDK
exports.adminUpdateUserPassword = functions.https.onCall(async (data, context) => {
  // Check if the caller is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to perform this action.');
  }

  const { uid, newPassword, callerUid } = data;

  if (!uid || !newPassword) {
    throw new functions.https.HttpsError('invalid-argument', 'UID and new password are required.');
  }

  // Verify the caller is a principal/admin
  try {
    const callerDoc = await admin.firestore().collection('users').doc(callerUid || context.auth.uid).get();
    const callerData = callerDoc.data();
    
    if (!callerDoc.exists || (callerData.role !== 'principal' && callerData.role !== 'admin' && callerData.role !== 'developer')) {
      throw new functions.https.HttpsError('permission-denied', 'Only authorized staff can update user passwords.');
    }
  } catch (error) {
    console.error('Error verifying caller:', error);
    throw new functions.https.HttpsError('internal', 'Failed to verify permissions.');
  }

  // Update the user's password in Firebase Authentication
  try {
    await admin.auth().updateUser(uid, {
      password: newPassword
    });
    
    console.log(`Successfully updated password for user ${uid}`);
    
    // Also update history in Firestore for audit log
    await admin.firestore().collection('users').doc(uid).update({
      passwordLastChangedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, message: 'Password updated successfully.' };
  } catch (error) {
    console.error('Error updating password in Auth:', error);
    throw new functions.https.HttpsError('internal', `Failed to update password: ${error.message}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ASTRA crisis alert — triggers when a daily ASTRA check-in is saved with
// `needsAttention: true` (the model + keyword tripwire flagged signs of
// self-harm, suicidal thoughts, abuse, or severe distress).
//
// Sends an immediate email to the student's school admin(s) and linked
// parent, and writes in-app notification docs so dashboards can show a
// banner. Server-side (Admin SDK) so it bypasses client write rules.
// ─────────────────────────────────────────────────────────────────────────────
exports.astraCrisisAlert = functions.firestore
  .document('studentMoods/{moodId}')
  .onCreate(async (snap, context) => {
    const mood = snap.data();
    if (!mood || !mood.needsAttention) return null;

    const db = admin.firestore();
    const studentId = mood.userId;
    if (!studentId) {
      console.warn('astraCrisisAlert: mood doc has no userId, skipping');
      return null;
    }

    try {
      // Pull the student record so we can get parentId + schoolName.
      const studentSnap = await db.collection('users').doc(studentId).get();
      if (!studentSnap.exists) {
        console.warn(`astraCrisisAlert: student ${studentId} not found`);
        return null;
      }
      const student = studentSnap.data();
      const studentName = student.username || mood.studentName || 'A student';
      const studentClass = student.class ?? student.classNumber ?? mood.class ?? 'unknown';
      const schoolName = student.schoolName || mood.schoolName || '';

      // Find recipients: parent (via student.parentId) + admins of the school.
      const recipients = [];
      if (student.parentId) {
        try {
          const parentSnap = await db.collection('users').doc(student.parentId).get();
          if (parentSnap.exists && parentSnap.data().email) {
            recipients.push({
              role: 'parent',
              uid: student.parentId,
              email: parentSnap.data().email,
              name: parentSnap.data().username || 'Parent',
            });
          }
        } catch (e) {
          console.warn('astraCrisisAlert: parent lookup failed', e);
        }
      }

      // Admins of the same school (admin or principal roles).
      try {
        const adminQuery = await db.collection('users')
          .where('schoolName', '==', schoolName)
          .where('role', 'in', ['admin', 'principal'])
          .get();
        adminQuery.forEach(doc => {
          const a = doc.data();
          if (a.email) {
            recipients.push({
              role: a.role,
              uid: doc.id,
              email: a.email,
              name: a.username || 'Admin',
            });
          }
        });
      } catch (e) {
        console.warn('astraCrisisAlert: admin lookup failed', e);
      }

      if (recipients.length === 0) {
        console.warn(`astraCrisisAlert: no recipients for ${studentId}`);
        return null;
      }

      // Build email body. Sensitive — keep tone calm and actionable.
      const feelingText = mood.feeling || '(spoken — see transcript)';
      const transcriptLines = Array.isArray(mood.transcripts)
        ? mood.transcripts.map(t => `${t.role === 'astra' ? 'ASTRA' : studentName}: ${t.text}`).join('\n')
        : '';
      const emotion = mood.emotion || 'unknown';
      const message = mood.message || '';

      const subject = `🚨 Wellbeing alert: ${studentName} (Class ${studentClass}) — please reach out today`;
      const html = `<!DOCTYPE html><html><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #fef3c7, #fde68a); padding: 18px; border-radius: 8px; border-left: 5px solid #d97706;">
            <h2 style="margin: 0; color: #92400e;">⚠️ Wellbeing alert from TriSphere</h2>
            <p style="margin: 6px 0 0 0; color: #78350f; font-size: 13px;">ASTRA daily check-in flagged signs of distress.</p>
          </div>
          <div style="padding: 20px 4px;">
            <p><strong>Student:</strong> ${studentName} (Class ${studentClass}${schoolName ? `, ${schoolName}` : ''})</p>
            <p><strong>Detected emotion:</strong> ${emotion} (severity: ${mood.severity || 'unknown'})</p>
            <p><strong>What they shared:</strong></p>
            <blockquote style="background: #f3f4f6; padding: 12px 14px; border-left: 3px solid #6b7280; margin: 10px 0; font-style: italic;">${(feelingText || '').replace(/\n/g, '<br>')}</blockquote>
            ${transcriptLines ? `<p><strong>Conversation transcript:</strong></p><pre style="background: #f3f4f6; padding: 12px; border-radius: 6px; white-space: pre-wrap; font-family: inherit; font-size: 13px;">${transcriptLines.replace(/</g, '&lt;')}</pre>` : ''}
            ${message ? `<p><strong>ASTRA's response to the student:</strong></p><p style="background: #ecfeff; padding: 12px; border-radius: 6px; border-left: 3px solid #06b6d4;">${message}</p>` : ''}
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
            <h3 style="color: #b45309;">Recommended next steps</h3>
            <ul style="color: #374151;">
              <li>Reach out to ${studentName} privately today.</li>
              <li>Listen first — let them share at their pace.</li>
              <li>If the situation feels acute, contact a school counselor or mental health professional.</li>
              <li>India helpline: <strong>iCall — 9152987821</strong> (free, confidential).</li>
            </ul>
            <p style="color: #6b7280; font-size: 12px; margin-top: 28px;">
              This alert was generated automatically by TriSphere's wellbeing AI based on the student's
              spoken check-in. Please do not share or forward.
            </p>
          </div>
        </div>
      </body></html>`;

      // Send to every recipient.
      const sendPromises = recipients.map(r => transporter.sendMail({
        from: process.env.EMAIL_USER || 'sathwikjpoojary@gmail.com',
        to: r.email,
        subject,
        html,
      }).catch(err => {
        console.error(`astraCrisisAlert: failed to send to ${r.email}`, err);
        return null;
      }));

      // Also write in-app notification docs (dashboards can render a banner).
      const notificationPromises = recipients.map(r =>
        db.collection('crisisAlerts').add({
          studentId,
          studentName,
          studentClass,
          schoolName,
          recipientUid: r.uid,
          recipientRole: r.role,
          recipientEmail: r.email,
          emotion,
          severity: mood.severity || 'high',
          summary: feelingText.slice(0, 280),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          read: false,
          followedUp: false,
        }).catch(err => {
          console.error('astraCrisisAlert: notification doc write failed', err);
          return null;
        })
      );

      // --- NEW: Push Notifications via FCM ---
      const pushPromises = [];
      for (const r of recipients) {
        try {
          const userSnap = await db.collection('users').doc(r.uid).get();
          const userData = userSnap.data();
          const tokens = userData.fcmTokens || [];

          if (tokens.length > 0) {
            const message = {
              notification: {
                title: `🚨 Wellbeing Alert: ${studentName}`,
                body: `Signs of distress detected in Class ${studentClass}. Please check your email or dashboard immediately.`,
              },
              tokens: tokens,
            };

            pushPromises.push(
              admin.messaging().sendEachForMulticast(message)
                .then((response) => {
                  console.log(`FCM success for ${r.email}: ${response.successCount} sent`);
                })
                .catch((err) => {
                  console.error(`FCM failed for ${r.email}:`, err);
                })
            );
          }
        } catch (e) {
          console.error(`Error sending push to ${r.uid}:`, e);
        }
      }

      await Promise.all([...sendPromises, ...notificationPromises, ...pushPromises]);
      console.log(`astraCrisisAlert: sent to ${recipients.length} recipient(s) for ${studentName}`);
      return null;
    } catch (error) {
      console.error('astraCrisisAlert: top-level error', error);
      return null;
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// Sync Student Stats (XP, Average Score, Task Count)
// ─────────────────────────────────────────────────────────────────────────────
async function updateStudentStats(db, studentId) {
  const userStoreRef = db.collection('userStore').doc(studentId);
  const userRef = db.collection('users').doc(studentId);

  try {
    // Parallel fetch for speed
    const [quizSnap, submissionSnap] = await Promise.all([
      db.collection('quizResults')
        .where('studentId', '==', studentId)
        .where('malpractice', '==', false)
        .get(),
      db.collection('studentSubmissions')
        .where('studentId', '==', studentId)
        .get()
    ]);

    let totalScore = 0;
    let scoreCount = 0;
    
    // Quiz scores
    quizSnap.forEach(doc => {
      const data = doc.data();
      if (data.score != null) {
        totalScore += Number(data.score);
        scoreCount++;
      }
    });

    // Submission grades
    submissionSnap.forEach(doc => {
      const data = doc.data();
      if (data.grade != null) {
        totalScore += Number(data.grade);
        scoreCount++;
      }
    });

    const tasksCompleted = quizSnap.size + submissionSnap.size;
    const averageScore = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0;
    const xpBalance = totalScore; // 1 XP per point

    const statsUpdate = {
      xpBalance,
      averageScore,
      tasksCompleted,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    };

    // Update both UserStore (for Rewards) and User Profile (for Dashboard)
    await Promise.all([
      userStoreRef.set(statsUpdate, { merge: true }),
      userRef.update({ stats: statsUpdate })
    ]);

    console.log(`Synced stats for ${studentId}: XP=${xpBalance}, Avg=${averageScore}, Tasks=${tasksCompleted}`);
  } catch (err) {
    console.error(`Error syncing stats for ${studentId}:`, err);
  }
}

exports.syncStudentStatsOnQuiz = functions.firestore
  .document('quizResults/{id}')
  .onWrite(async (change, context) => {
    const data = change.after.exists ? change.after.data() : change.before.data();
    if (!data.studentId) return null;
    return updateStudentStats(admin.firestore(), data.studentId);
  });

exports.syncStudentStatsOnSubmission = functions.firestore
  .document('studentSubmissions/{id}')
  .onWrite(async (change, context) => {
    const data = change.after.exists ? change.after.data() : change.before.data();
    if (!data.studentId) return null;
    return updateStudentStats(admin.firestore(), data.studentId);
  });

// ─────────────────────────────────────────────────────────────────────────────
// Normalize User Search Names for Fast, Single-Query Search
// ─────────────────────────────────────────────────────────────────────────────
exports.normalizeUserSearchNames = functions.firestore
  .document('users/{userId}')
  .onWrite(async (change, context) => {
    if (!change.after.exists) return null;
    const data = change.after.data();
    const searchName = String(data.name || '').toLowerCase();
    const searchUsername = String(data.username || '').toLowerCase();

    // Only update if missing or different to avoid infinite loops
    if (data.searchName !== searchName || data.searchUsername !== searchUsername) {
      return change.after.ref.update({
        searchName,
        searchUsername
      });
    }
    return null;
  });

// ─────────────────────────────────────────────────────────────────────────────
// 🪞 publicProfiles mirror
// ─────────────────────────────────────────────────────────────────────────────
// The /users/{uid} doc holds private fields (email, phone, FCM tokens,
// _tempPassword admin mirror). To let students search and view classmate
// profiles without leaking that data, we mirror ONLY the safe fields into
// /publicProfiles/{uid}. The student search overlay queries this collection.
//
// Fields kept in sync:
//   - identity:  username, name, role, class, classNumber, schoolName
//   - display:   profilePhoto
//   - search:    searchUsername, searchName (lowercased)
//   - stats:     stats { tasksCompleted, averageScore, streak, xpBalance }
//
// Triggers on every users/{uid} write. On delete, the mirror is removed too.
function buildPublicProfile(data) {
  return {
    username: String(data.username || ''),
    name: String(data.name || ''),
    role: String(data.role || ''),
    class: data.class ?? null,
    classNumber: data.classNumber ?? null,
    schoolName: String(data.schoolName || ''),
    profilePhoto: data.profilePhoto || null,
    searchUsername: String(data.username || '').toLowerCase(),
    searchName: String(data.name || '').toLowerCase(),
    stats: {
      tasksCompleted: data.stats?.tasksCompleted ?? 0,
      averageScore: data.stats?.averageScore ?? 0,
      streak: data.stats?.streak ?? 0,
      xpBalance: data.stats?.xpBalance ?? 0,
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

exports.syncPublicProfile = functions.firestore
  .document('users/{uid}')
  .onWrite(async (change, context) => {
    const uid = context.params.uid;
    const db = admin.firestore();
    const mirrorRef = db.collection('publicProfiles').doc(uid);

    if (!change.after.exists) {
      try { await mirrorRef.delete(); } catch (_) {}
      return null;
    }

    try {
      await mirrorRef.set(buildPublicProfile(change.after.data()), { merge: true });
    } catch (err) {
      console.error(`syncPublicProfile(${uid}) failed:`, err);
    }
    return null;
  });

// ─────────────────────────────────────────────────────────────────────────────
// One-shot backfill for /publicProfiles
// ─────────────────────────────────────────────────────────────────────────────
// Existing /users/{uid} docs don't have a mirror until someone writes to them.
// Admins / developers can invoke this once to populate the mirror for every
// existing user. Idempotent — safe to re-run anytime.
//
// From the browser console (signed in as an admin/developer):
//   const { getFunctions, httpsCallable } = await import('firebase/functions');
//   await httpsCallable(getFunctions(), 'backfillPublicProfiles')();
exports.backfillPublicProfiles = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }
  const db = admin.firestore();
  const callerSnap = await db.collection('users').doc(context.auth.uid).get();
  const callerRole = callerSnap.exists ? callerSnap.data().role : null;
  if (!['admin', 'principal', 'developer'].includes(callerRole)) {
    throw new functions.https.HttpsError('permission-denied', 'Admin or developer only.');
  }

  let processed = 0;
  let pageCursor = null;
  // Page through users to keep memory bounded.
  // 500 docs/batch is the Firestore commit limit.
  while (true) {
    let q = db.collection('users').orderBy('__name__').limit(500);
    if (pageCursor) q = q.startAfter(pageCursor);
    const snap = await q.get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach(d => {
      batch.set(
        db.collection('publicProfiles').doc(d.id),
        buildPublicProfile(d.data()),
        { merge: true }
      );
    });
    await batch.commit();

    processed += snap.size;
    pageCursor = snap.docs[snap.docs.length - 1];
    if (snap.size < 500) break;
  }

  console.log(`backfillPublicProfiles: synced ${processed} profiles`);
  return { processed };
});

// ─────────────────────────────────────────────────────────────────────────────
// Push notification helpers
// ─────────────────────────────────────────────────────────────────────────────
// Send a multicast FCM push to every token in `tokens` and clean up tokens
// that the server reports as invalid / unregistered. Returns nothing — failures
// are logged, not thrown, so a single bad device doesn't break the whole batch.
async function sendPushToUser(db, uid, tokens, notification, data = {}) {
  if (!Array.isArray(tokens) || tokens.length === 0) return;
  try {
    const res = await admin.messaging().sendEachForMulticast({
      tokens,
      notification,
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)]) // FCM data values must be strings
      ),
    });

    // Identify dead tokens (uninstalled app, revoked permission, expired) and
    // strip them from the user doc so future sends don't waste quota on them.
    const deadTokens = [];
    res.responses.forEach((r, idx) => {
      if (!r.success) {
        const code = r.error?.code || '';
        if (
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/registration-token-not-registered'
        ) {
          deadTokens.push(tokens[idx]);
        }
      }
    });
    if (deadTokens.length) {
      try {
        await db.collection('users').doc(uid).update({
          fcmTokens: admin.firestore.FieldValue.arrayRemove(...deadTokens),
        });
      } catch (e) {
        console.warn(`Failed to prune dead tokens for ${uid}:`, e.message);
      }
    }
  } catch (err) {
    console.error(`sendPushToUser(${uid}) failed:`, err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 🚀 New chapter → push notification to every student in the target class
// ─────────────────────────────────────────────────────────────────────────────
// Fires when an announcement of type 'material' is created (this happens
// automatically inside TextbookUploader.jsx whenever a teacher/admin uploads
// a new chapter). We don't trigger on the textbook write itself because the
// announcement carries the canonical class + schoolName fields and is the
// single source of truth for "a chapter is now visible to students".
exports.notifyOnNewChapter = functions.firestore
  .document('announcements/{announcementId}')
  .onCreate(async (snap, context) => {
    const ann = snap.data();
    if (!ann || ann.type !== 'material') return null;

    const db = admin.firestore();
    const chapterName = ann.chapterName || ann.title || 'a new chapter';
    const subject = ann.subject || '';
    const targetClass = ann.class;
    const schoolName = ann.schoolName || '';

    if (targetClass === undefined || targetClass === null) {
      console.warn(`notifyOnNewChapter: ${snap.id} has no class, skipping push.`);
      return null;
    }

    try {
      // Find every student in this class for this school. We match on BOTH
      // numeric and string class values because user docs are inconsistent
      // about whether `class` is stored as 10 or "10".
      const classNumeric = Number(targetClass);
      const classString = String(targetClass);

      const [numericSnap, stringSnap] = await Promise.all([
        db.collection('users')
          .where('role', '==', 'student')
          .where('class', '==', classNumeric)
          .get(),
        db.collection('users')
          .where('role', '==', 'student')
          .where('class', '==', classString)
          .get(),
      ]);

      // Dedupe + school filter (skip the school filter when announcement has
      // no schoolName, e.g. legacy cross-school content).
      const seen = new Set();
      const students = [];
      [numericSnap, stringSnap].forEach(qs => qs.forEach(d => {
        if (seen.has(d.id)) return;
        const u = d.data();
        if (schoolName && (u.schoolName || '') !== schoolName) return;
        seen.add(d.id);
        students.push({ uid: d.id, fcmTokens: u.fcmTokens || [] });
      }));

      const notification = {
        title: '📚 Time to start your engine buddy!',
        body: `New chapter uploaded${subject ? ` in ${subject}` : ''}: ${chapterName}`,
      };
      const pushData = {
        type: 'new_chapter',
        announcementId: snap.id,
        subject,
        chapterName,
        class: classString,
      };

      const sendOps = students
        .filter(s => s.fcmTokens.length > 0)
        .map(s => sendPushToUser(db, s.uid, s.fcmTokens, notification, pushData));

      await Promise.all(sendOps);
      console.log(
        `notifyOnNewChapter: fanned out to ${sendOps.length}/${students.length} students for chapter "${chapterName}" (class ${targetClass}, ${schoolName || 'no school'})`
      );
      return null;
    } catch (err) {
      console.error('notifyOnNewChapter: top-level error', err);
      return null;
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// ⏰ Inactive student nudge — runs every 3 hours
// ─────────────────────────────────────────────────────────────────────────────
// Iterates all students. For each:
//   • Reads `userAnalytics/{uid}.lastActiveAt` (updated by logActivity()
//     every dashboard visit / notes read / video watch).
//   • If inactive ≥ 24h AND we haven't sent a nudge in the last 3h, sends
//     a push and stamps `userAnalytics/{uid}.inactivityReminderLastSentAt`.
//
// Throttling on lastSentAt prevents the function from spamming a user even
// if the scheduler fires more often than expected (cold start retry, etc.).
const INACTIVITY_THRESHOLD_MS = 24 * 60 * 60 * 1000;   // 1 day
const REMINDER_INTERVAL_MS    = 3 * 60 * 60 * 1000;    // 3 hours
const REMINDER_QUIET_HOURS    = { startHour: 22, endHour: 7 }; // skip 22:00–07:00 (student timezone-naive)

exports.remindInactiveStudents = functions.pubsub
  .schedule('every 3 hours')
  .timeZone('Asia/Kolkata')
  .onRun(async (context) => {
    const db = admin.firestore();
    const now = Date.now();

    // Respect quiet hours so we don't ping kids in the middle of the night.
    const nowDate = new Date();
    const localHour = nowDate.toLocaleString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      hour12: false,
    });
    const hour = parseInt(localHour, 10);
    const { startHour, endHour } = REMINDER_QUIET_HOURS;
    const inQuietHours = hour >= startHour || hour < endHour;
    if (inQuietHours) {
      console.log(`remindInactiveStudents: quiet hours (${hour}:00 IST), skipping run.`);
      return null;
    }

    try {
      const studentsSnap = await db.collection('users')
        .where('role', '==', 'student')
        .get();

      const notification = {
        title: '👋 Time you get back to study buddy!',
        body: 'Any help? ASTRA is here — share anything 💙',
      };
      const pushData = { type: 'inactivity_nudge' };

      let sent = 0;
      let skippedInactiveOk = 0;
      let skippedThrottled = 0;
      let skippedNoToken = 0;

      const ops = studentsSnap.docs.map(async (doc) => {
        const student = doc.data();
        const uid = doc.id;
        const tokens = student.fcmTokens || [];
        if (tokens.length === 0) { skippedNoToken++; return; }

        try {
          const analyticsSnap = await db.collection('userAnalytics').doc(uid).get();
          if (!analyticsSnap.exists) {
            // Never been active — could be a fresh account. Skip (no point
            // nudging someone who never started).
            return;
          }
          const analytics = analyticsSnap.data();
          const lastActiveTs = analytics.lastActiveAt?.toMillis?.()
            || analytics.lastActiveAt?.toDate?.().getTime();
          if (!lastActiveTs) return;

          const inactiveFor = now - lastActiveTs;
          if (inactiveFor < INACTIVITY_THRESHOLD_MS) { skippedInactiveOk++; return; }

          const lastReminderTs = analytics.inactivityReminderLastSentAt?.toMillis?.()
            || analytics.inactivityReminderLastSentAt?.toDate?.().getTime()
            || 0;
          if (now - lastReminderTs < REMINDER_INTERVAL_MS) { skippedThrottled++; return; }

          await sendPushToUser(db, uid, tokens, notification, pushData);
          await db.collection('userAnalytics').doc(uid).set(
            { inactivityReminderLastSentAt: admin.firestore.Timestamp.now() },
            { merge: true }
          );
          sent++;
        } catch (err) {
          console.warn(`remindInactiveStudents: error for ${uid}:`, err.message);
        }
      });

      await Promise.all(ops);
      console.log(
        `remindInactiveStudents: sent=${sent}, skippedActive=${skippedInactiveOk}, skippedThrottled=${skippedThrottled}, skippedNoToken=${skippedNoToken}, total=${studentsSnap.size}`
      );
      return null;
    } catch (err) {
      console.error('remindInactiveStudents: top-level error', err);
      return null;
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// Parent push — shared helpers + three trigger functions
// ─────────────────────────────────────────────────────────────────────────────
// "Dear parent, this is regarding your child <name> …" notifications fire on:
//   (a) a new chapter being uploaded for that child's class
//   (b) the child being inactive on TriSphere for ≥ 48 hours
//   (c) the child being caught malpracticing during a quiz
//
// The parent ↔ child link can live on either side of the relationship in this
// codebase (`parents.childrenIds[]` is the canonical shape but legacy data
// also has `students.parentId`). `findParentsOfStudent` checks the canonical
// path first, then falls back to the legacy single-parent field.

async function findParentsOfStudent(db, studentUid, studentDataHint = null) {
  if (!studentUid) return [];
  const parents = new Map(); // dedupe by parent uid

  // Canonical path: docs whose `childrenIds` array contains the student
  // uid. We don't combine with `role == parent` here because that would
  // require a composite index — array-contains queries are already very
  // narrow on their own (few hits per student), and we filter the role
  // client-side to stay safe in case of stray data.
  try {
    const snap = await db.collection('users')
      .where('childrenIds', 'array-contains', studentUid)
      .get();
    snap.forEach(d => {
      const p = d.data();
      if (p.role !== 'parent') return;
      parents.set(d.id, {
        uid: d.id,
        username: p.username || p.name || 'Parent',
        fcmTokens: Array.isArray(p.fcmTokens) ? p.fcmTokens : [],
      });
    });
  } catch (err) {
    console.warn(`findParentsOfStudent: childrenIds query failed for ${studentUid}:`, err.message);
  }

  // Legacy fallback: student doc has a `parentId` field pointing at one parent.
  try {
    let studentData = studentDataHint;
    if (!studentData) {
      const s = await db.collection('users').doc(studentUid).get();
      studentData = s.exists ? s.data() : null;
    }
    const parentId = studentData?.parentId;
    if (parentId && !parents.has(parentId)) {
      const pSnap = await db.collection('users').doc(parentId).get();
      if (pSnap.exists) {
        const p = pSnap.data();
        if (p.role === 'parent') {
          parents.set(parentId, {
            uid: parentId,
            username: p.username || p.name || 'Parent',
            fcmTokens: Array.isArray(p.fcmTokens) ? p.fcmTokens : [],
          });
        }
      }
    }
  } catch (err) {
    console.warn(`findParentsOfStudent: parentId fallback failed for ${studentUid}:`, err.message);
  }

  return Array.from(parents.values());
}

// Friendly "first name" for a student record. Used inside the parent-facing
// notification body so the message reads like "regarding your child Aneesh"
// rather than "regarding your child student_abc123".
function studentDisplayName(s) {
  const raw = (s?.username || s?.name || 'your child').trim();
  return raw.split(/\s+/)[0] || 'your child';
}

// ─────────────────────────────────────────────────────────────────────────────
// (a) Parent push on new chapter
// ─────────────────────────────────────────────────────────────────────────────
// notifyOnNewChapter already pushes to every student in the target class.
// This sibling function fans the same trigger out to the linked parents,
// deduped across siblings (a parent with two kids in class 7 gets ONE push
// per chapter, not two).
exports.notifyParentsOnNewChapter = functions.firestore
  .document('announcements/{announcementId}')
  .onCreate(async (snap, context) => {
    const ann = snap.data();
    if (!ann || ann.type !== 'material') return null;

    const db = admin.firestore();
    const chapterName = ann.chapterName || ann.title || 'a new chapter';
    const subject = ann.subject || '';
    const targetClass = ann.class;
    const schoolName = ann.schoolName || '';
    if (targetClass === undefined || targetClass === null) return null;

    try {
      const classNumeric = Number(targetClass);
      const classString = String(targetClass);

      // Find every student in the target class (numeric + string variants).
      const [numericSnap, stringSnap] = await Promise.all([
        db.collection('users').where('role', '==', 'student').where('class', '==', classNumeric).get(),
        db.collection('users').where('role', '==', 'student').where('class', '==', classString).get(),
      ]);

      const seenStudent = new Set();
      const students = [];
      [numericSnap, stringSnap].forEach(qs => qs.forEach(d => {
        if (seenStudent.has(d.id)) return;
        const u = d.data();
        if (schoolName && (u.schoolName || '') !== schoolName) return;
        seenStudent.add(d.id);
        students.push({ uid: d.id, data: u });
      }));

      // For each student, look up parents — aggregate ALL of that parent's
      // matching children in this class into one push so a twin/sibling
      // case reads "regarding your children Aneesh and Sara" instead of
      // dropping one of them on the floor. We send only ONE push per
      // parent per chapter (the chapter is class-wide and the same for
      // every kid in that class — repeating it would be spammy).
      const parentMap = new Map(); // parentUid → { parent, childNames: Set }
      await Promise.all(students.map(async (s) => {
        const parents = await findParentsOfStudent(db, s.uid, s.data);
        const childName = studentDisplayName(s.data);
        parents.forEach(p => {
          if (!parentMap.has(p.uid)) {
            parentMap.set(p.uid, { parent: p, childNames: new Set() });
          }
          parentMap.get(p.uid).childNames.add(childName);
        });
      }));

      // Human-readable join: ["A"] → "A"; ["A","B"] → "A and B";
      // ["A","B","C"] → "A, B and C". The parent-facing copy uses
      // "child" vs "children" depending on count.
      const joinNames = (names) => {
        const arr = Array.from(names);
        if (arr.length === 0) return 'your child';
        if (arr.length === 1) return arr[0];
        if (arr.length === 2) return `${arr[0]} and ${arr[1]}`;
        return `${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}`;
      };

      const pushData = {
        type: 'parent_new_chapter',
        announcementId: snap.id,
        subject,
        chapterName,
        class: classString,
      };

      const ops = [];
      for (const { parent, childNames } of parentMap.values()) {
        if (parent.fcmTokens.length === 0) continue;
        const namesLabel = joinNames(childNames);
        const childWord = childNames.size > 1 ? 'children' : 'child';
        const notification = {
          title: '📚 New chapter for your child',
          body: `Dear parent, this is regarding your ${childWord} ${namesLabel}: new ${subject ? subject + ' ' : ''}chapter "${chapterName}" is now available.`,
        };
        ops.push(sendPushToUser(db, parent.uid, parent.fcmTokens, notification, pushData));
      }

      await Promise.all(ops);
      console.log(
        `notifyParentsOnNewChapter: fanned to ${ops.length}/${parentMap.size} parents for "${chapterName}" (class ${targetClass}, ${schoolName || 'no school'})`
      );
      return null;
    } catch (err) {
      console.error('notifyParentsOnNewChapter: top-level error', err);
      return null;
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// (b) Parent push when a child is inactive for ≥ 48 hours
// ─────────────────────────────────────────────────────────────────────────────
// Mirrors remindInactiveStudents but with a higher threshold (48h vs 24h),
// fires only once per parent-child pair every 24h, and respects the same
// quiet-hours window. Throttle key is stored on userAnalytics under
// `parentInactivityReminderLastSentAt` so it doesn't collide with the
// student-facing reminder stamp.
const PARENT_INACTIVITY_THRESHOLD_MS = 48 * 60 * 60 * 1000; // 48 hours
const PARENT_REMINDER_INTERVAL_MS   = 24 * 60 * 60 * 1000;  // 1 nudge / day max

exports.notifyParentsOfInactiveStudents = functions.pubsub
  .schedule('every 3 hours')
  .timeZone('Asia/Kolkata')
  .onRun(async (context) => {
    const db = admin.firestore();
    const now = Date.now();

    // Skip quiet hours — parents shouldn't get a push at 2am.
    const nowDate = new Date();
    const localHour = nowDate.toLocaleString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      hour12: false,
    });
    const hour = parseInt(localHour, 10);
    const { startHour, endHour } = REMINDER_QUIET_HOURS;
    if (hour >= startHour || hour < endHour) {
      console.log(`notifyParentsOfInactiveStudents: quiet hours (${hour}:00 IST), skipping run.`);
      return null;
    }

    try {
      const studentsSnap = await db.collection('users')
        .where('role', '==', 'student')
        .get();

      let pushed = 0;
      let skippedActive = 0;
      let skippedThrottled = 0;
      let skippedNoParent = 0;

      const ops = studentsSnap.docs.map(async (doc) => {
        const student = doc.data();
        const uid = doc.id;

        // Has the student actually been inactive ≥ 48h?
        try {
          const analyticsSnap = await db.collection('userAnalytics').doc(uid).get();
          if (!analyticsSnap.exists) return;
          const analytics = analyticsSnap.data();
          const lastActiveTs = analytics.lastActiveAt?.toMillis?.()
            || analytics.lastActiveAt?.toDate?.().getTime();
          if (!lastActiveTs) return;
          if (now - lastActiveTs < PARENT_INACTIVITY_THRESHOLD_MS) {
            skippedActive++;
            return;
          }

          const lastSentTs = analytics.parentInactivityReminderLastSentAt?.toMillis?.()
            || analytics.parentInactivityReminderLastSentAt?.toDate?.().getTime()
            || 0;
          if (now - lastSentTs < PARENT_REMINDER_INTERVAL_MS) {
            skippedThrottled++;
            return;
          }

          const parents = await findParentsOfStudent(db, uid, student);
          if (parents.length === 0) { skippedNoParent++; return; }

          const childName = studentDisplayName(student);
          const hoursInactive = Math.floor((now - lastActiveTs) / (60 * 60 * 1000));
          const notification = {
            title: '👀 Quick check-in on your child',
            body: `Dear parent, this is regarding your child ${childName}: no activity on TriSphere for ${hoursInactive}+ hours.`,
          };
          const pushData = {
            type: 'parent_inactivity',
            studentUid: uid,
            childName,
            hoursInactive,
          };

          await Promise.all(parents.map(p =>
            p.fcmTokens.length > 0
              ? sendPushToUser(db, p.uid, p.fcmTokens, notification, pushData)
              : null
          ));

          await db.collection('userAnalytics').doc(uid).set(
            { parentInactivityReminderLastSentAt: admin.firestore.Timestamp.now() },
            { merge: true }
          );
          pushed++;
        } catch (err) {
          console.warn(`notifyParentsOfInactiveStudents: error for ${uid}:`, err.message);
        }
      });

      await Promise.all(ops);
      console.log(
        `notifyParentsOfInactiveStudents: pushed=${pushed}, skippedActive=${skippedActive}, skippedThrottled=${skippedThrottled}, skippedNoParent=${skippedNoParent}, total=${studentsSnap.size}`
      );
      return null;
    } catch (err) {
      console.error('notifyParentsOfInactiveStudents: top-level error', err);
      return null;
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// (c) Parent push on malpractice
// ─────────────────────────────────────────────────────────────────────────────
// Fires whenever a quizResults doc is written with `malpractice === true`
// (the QuizletStyle component flags cheating detections this way).
// Sends a single push to every linked parent of the offending student.
exports.notifyParentOfMalpractice = functions.firestore
  .document('quizResults/{resultId}')
  .onCreate(async (snap, context) => {
    const result = snap.data();
    if (!result || result.malpractice !== true) return null;
    const studentUid = result.studentId;
    if (!studentUid) return null;

    const db = admin.firestore();

    try {
      const studentSnap = await db.collection('users').doc(studentUid).get();
      const studentData = studentSnap.exists ? studentSnap.data() : null;
      const childName = studentDisplayName(studentData);

      const parents = await findParentsOfStudent(db, studentUid, studentData);
      if (parents.length === 0) {
        console.log(`notifyParentOfMalpractice: no parent linked to ${studentUid}, skipping.`);
        return null;
      }

      const subject = result.subject || '';
      const chapterName = result.chapterName || '';
      const reasonRaw = result.malpracticeReason || 'suspicious activity';
      // Keep reason short for the notification body — full detail lives in
      // the in-app crisis/log views, the push is just a heads-up.
      const reason = String(reasonRaw).slice(0, 80);

      const notification = {
        title: '⚠️ Important: quiz integrity flag',
        body: `Dear parent, this is regarding your child ${childName}: flagged for ${reason} during a ${subject || ''} quiz${chapterName ? ` on "${chapterName}"` : ''}.`,
      };
      const pushData = {
        type: 'parent_malpractice',
        studentUid,
        childName,
        subject,
        chapterName,
        resultId: snap.id,
      };

      await Promise.all(parents.map(p =>
        p.fcmTokens.length > 0
          ? sendPushToUser(db, p.uid, p.fcmTokens, notification, pushData)
          : null
      ));
      console.log(
        `notifyParentOfMalpractice: notified ${parents.length} parent(s) of ${childName} (${studentUid}).`
      );
      return null;
    } catch (err) {
      console.error('notifyParentOfMalpractice: top-level error', err);
      return null;
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// 📢 Teacher/Class Announcement push notification trigger
// ─────────────────────────────────────────────────────────────────────────────
exports.notifyOnClassAnnouncement = functions.firestore
  .document('announcements/{announcementId}')
  .onCreate(async (snap, context) => {
    const ann = snap.data();
    if (!ann) return null;

    // We only trigger for class-scoped announcements that are NOT material updates
    // (since material updates are handled by notifyOnNewChapter / notifyParentsOnNewChapter).
    const targetClass = ann.class;
    if (targetClass === undefined || targetClass === null || ann.type === 'material') {
      return null;
    }

    const db = admin.firestore();
    const title = ann.title || 'New Announcement';
    const message = ann.message || '';
    const schoolName = ann.schoolName || '';

    try {
      const classNumeric = Number(targetClass);
      const classString = String(targetClass);

      // 1. Find all students in this class for this school
      const [numericSnap, stringSnap] = await Promise.all([
        db.collection('users')
          .where('role', '==', 'student')
          .where('class', '==', classNumeric)
          .get(),
        db.collection('users')
          .where('role', '==', 'student')
          .where('class', '==', classString)
          .get(),
      ]);

      const seenStudent = new Set();
      const students = [];
      [numericSnap, stringSnap].forEach(qs => qs.forEach(d => {
        if (seenStudent.has(d.id)) return;
        const u = d.data();
        if (schoolName && (u.schoolName || '') !== schoolName) return;
        seenStudent.add(d.id);
        students.push({ uid: d.id, data: u, fcmTokens: u.fcmTokens || [] });
      }));

      // 2. Find all parents of these students
      const parentMap = new Map(); // parentUid -> { parent, childNames: Set }
      await Promise.all(students.map(async (s) => {
        const parents = await findParentsOfStudent(db, s.uid, s.data);
        const childName = studentDisplayName(s.data);
        parents.forEach(p => {
          if (!parentMap.has(p.uid)) {
            parentMap.set(p.uid, { parent: p, childNames: new Set() });
          }
          parentMap.get(p.uid).childNames.add(childName);
        });
      }));

      // 3. Send Push Notifications to Students
      const studentPushOps = [];
      const studentNotification = {
        title: `📢 Class Update: ${title}`,
        body: message,
      };
      const studentPushData = {
        type: 'class_announcement',
        announcementId: snap.id,
        class: classString,
      };

      students.forEach(s => {
        if (s.fcmTokens.length > 0) {
          studentPushOps.push(sendPushToUser(db, s.uid, s.fcmTokens, studentNotification, studentPushData));
        }
      });

      // 4. Send Push Notifications to Parents
      const parentPushOps = [];
      const joinNames = (names) => {
        const arr = Array.from(names);
        if (arr.length === 0) return 'your child';
        if (arr.length === 1) return arr[0];
        if (arr.length === 2) return `${arr[0]} and ${arr[1]}`;
        return `${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}`;
      };

      const parentPushData = {
        type: 'parent_class_announcement',
        announcementId: snap.id,
        class: classString,
      };

      for (const { parent, childNames } of parentMap.values()) {
        if (parent.fcmTokens.length === 0) continue;
        const namesLabel = joinNames(childNames);
        const childWord = childNames.size > 1 ? 'children' : 'child';
        const parentNotification = {
          title: `📢 Update for ${namesLabel}'s Class: ${title}`,
          body: `Dear Parent, ${message}`,
        };
        parentPushOps.push(sendPushToUser(db, parent.uid, parent.fcmTokens, parentNotification, parentPushData));
      }

      await Promise.all([...studentPushOps, ...parentPushOps]);
      console.log(
        `notifyOnClassAnnouncement: fanned out to ${studentPushOps.length} students and ${parentPushOps.length} parents for announcement "${title}" (class ${targetClass}, ${schoolName || 'no school'})`
      );
      return null;
    } catch (err) {
      console.error('notifyOnClassAnnouncement: top-level error', err);
      return null;
    }
  });

