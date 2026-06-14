import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { safeLocalStorage } from '../utils/storage';

export const PrivacyPolicy = ({ onAccept, viewOnly = false }) => {
  // Removed internal localStorage check to rely on parent state (Firestore)

  const handleAccept = () => {
    // Parent handles persistence (writing to Firestore)
    if (onAccept) onAccept();
  };

  const handleClose = () => {
    if (onAccept) onAccept();
  };

  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div style={styles.overlay}>
      <style>
        {`
          #privacy-title-id {
            color: #ffffff !important;
            text-shadow: 0 0 15px rgba(255, 255, 255, 0.4) !important;
            -webkit-text-fill-color: #ffffff !important;
          }
          div#privacy-title-id {
            color: #ffffff !important;
          }
        `}
      </style>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div id="privacy-title-id" style={styles.title}>PRIVACY POLICY</div>
          <p style={styles.subtitle}>TriSphere Learning Platform</p>
          <p style={styles.effectiveDate}>Effective Date: January 20, 2026</p>
          <p style={styles.effectiveDate}>Last Updated: May 17, 2026</p>
          <p style={styles.effectiveDate}>Showing: {currentDate}</p>
        </div>

        <div style={styles.content}>
          {/* Introduction */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>1. INTRODUCTION</h2>
            <p style={styles.paragraph}>
              Welcome to TriSphere Learning Platform - TriSphere, we, us, or our. This Privacy Policy
              explains how we collect, use, disclose, and safeguard your information when you use our educational
              platform and related services. We are committed to protecting the privacy and security of all users,
              including students, parents/guardians, teachers, and administrators.
            </p>
            <p style={styles.paragraph}>
              By accessing or using TriSphere, you acknowledge that you have read, understood, and agree to be
              bound by this Privacy Policy. If you do not agree with the terms of this Privacy Policy, please
              do not access or use the platform.
            </p>
          </div>

          {/* Definitions */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>2. DEFINITIONS</h2>
            <p style={styles.paragraph}>For the purposes of this Privacy Policy:</p>
            <ul style={styles.list}>
              <li style={styles.listItem}><strong>Personal Data</strong> - means any information relating to an identified or identifiable individual.</li>
              <li style={styles.listItem}><strong>Educational Data</strong> - means information directly related to a student's educational records, including grades, assessments, and academic progress.</li>
              <li style={styles.listItem}><strong>User</strong> - refers to any individual who accesses or uses the TriSphere platform, including students, parents, teachers, and administrators.</li>
              <li style={styles.listItem}><strong>Platform</strong> - refers to the TriSphere web application, including all features, services, and content therein.</li>
              <li style={styles.listItem}><strong>Third-Party Services</strong> - means external services integrated with our platform to enhance functionality.</li>
            </ul>
          </div>

          {/* Information We Collect */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>3. INFORMATION WE COLLECT</h2>

            <h3 style={styles.subSectionTitle}>3.1 Personal Information</h3>
            <p style={styles.paragraph}>We collect the following categories of personal information:</p>
            <ul style={styles.list}>
              <li style={styles.listItem}><strong>Account Information:</strong> Full name, email address, phone number (for verification), username, password (encrypted), user role (student/teacher/parent/admin), and class/grade level.</li>
              <li style={styles.listItem}><strong>Profile Information:</strong> Profile photographs (stored in Firebase Storage), display preferences, equipped avatar and frame, and other customization settings.</li>
              <li style={styles.listItem}><strong>Contact Information:</strong> Email addresses and phone numbers for account recovery, multi-factor authentication, and security communication purposes.</li>
            </ul>

            <h3 style={styles.subSectionTitle}>3.2 Educational Data</h3>
            <p style={styles.paragraph}>For students, we collect and process:</p>
            <ul style={styles.list}>
              <li style={styles.listItem}><strong>Academic Records:</strong> Quiz scores, assignment submissions, grades, and assessment results.</li>
              <li style={styles.listItem}><strong>Learning Progress:</strong> Course completion rates, learning milestones, and educational achievements.</li>
              <li style={styles.listItem}><strong>Study Materials:</strong> Notes, uploaded assignments, PDFs, and other educational content created by users.</li>
              <li style={styles.listItem}><strong>Performance Analytics:</strong> Subject-wise performance metrics and progress tracking data.</li>
            </ul>

            <h3 style={styles.subSectionTitle}>3.3 Gamification Data</h3>
            <p style={styles.paragraph}>Our platform incorporates gamification elements, and we collect:</p>
            <ul style={styles.list}>
              <li style={styles.listItem}><strong>Experience Points (XP):</strong> Points earned through platform engagement and academic activities.</li>
              <li style={styles.listItem}><strong>Rewards and Achievements:</strong> Owned items, equipped avatars, frames, and badges.</li>
              <li style={styles.listItem}><strong>Leaderboard Rankings:</strong> Comparative performance data visible to other users.</li>
              <li style={styles.listItem}><strong>Streak Data:</strong> Login consistency and engagement patterns.</li>
            </ul>

            <h3 style={styles.subSectionTitle}>3.4 Usage and Activity Data</h3>
            <p style={styles.paragraph}>We automatically collect:</p>
            <ul style={styles.list}>
              <li style={styles.listItem}><strong>Access Logs:</strong> Login timestamps, session duration, and access frequency.</li>
              <li style={styles.listItem}><strong>Content Interaction:</strong> Videos watched, resources accessed, and features utilized.</li>
              <li style={styles.listItem}><strong>Device Information:</strong> Browser type, device type, and screen resolution for optimization purposes.</li>
              <li style={styles.listItem}><strong>AI Chat Interactions:</strong> Conversations with the Lernix AI tutor, subject to age-appropriate daily message caps that differ for younger and older students. Chat history is stored against your account so it follows you across your devices.</li>
              <li style={styles.listItem}><strong>Push Notification Tokens:</strong> If you grant notification permission, an opaque device token is stored against your account so we can deliver the in-app alerts you opted into (new study material, gentle activity reminders, wellbeing alerts).</li>
              <li style={styles.listItem}><strong>Public Profile Data:</strong> A limited subset of your account — username, name, class, school, profile photo, and aggregate progress stats (XP, average score, tasks completed, day streak) — is available to other students within <em>your own school</em> via the in-app student-search feature. Sensitive fields (email, phone number, authentication tokens, password-related data) are NEVER exposed to peers under any circumstance.</li>
            </ul>

            <h3 style={styles.subSectionTitle}>3.5 Uploaded Content</h3>
            <p style={styles.paragraph}>Users may upload:</p>
            <ul style={styles.list}>
              <li style={styles.listItem}>Profile photographs and avatars</li>
              <li style={styles.listItem}>Assignment submissions and documents</li>
              <li style={styles.listItem}>Study notes and educational materials</li>
              <li style={styles.listItem}>Any other files relevant to educational activities</li>
            </ul>

            <h3 style={styles.subSectionTitle}>3.6 Audio and Voice Data</h3>
            <p style={styles.paragraph}>
              The standalone "Hey Lernix" voice assistant has been retired. The platform no longer
              listens for wake words and no longer stores any voice-gender preference.
            </p>
            <p style={styles.paragraph}>The remaining voice-related features are:</p>
            <ul style={styles.list}>
              <li style={styles.listItem}><strong>Voice messages in Lernix Chat:</strong> If you choose to record a spoken message inside the AI chat, the audio is processed only to convert it to text. The audio itself is not retained; only the resulting text is saved as part of your chat history.</li>
              <li style={styles.listItem}><strong>Text-to-speech playback:</strong> The "Listen" button on AI responses uses your device's built-in speech synthesis — no audio data leaves your device.</li>
              <li style={styles.listItem}><strong>ASTRA wellbeing check-in:</strong> The daily wellbeing check-in converts a short spoken response to text. Only the resulting text transcript is retained. Additionally, when you open the check-in modal, the platform compiles a 7-day summary of your app learning telemetry (such as your login streak, assignments completed, virtual simulation labs run, quizzes taken, textbook notes read, and chat messages sent) to contextually tailor ASTRA's verbal responses, offer academic encouragement, and suggest relevant next steps. This activity context is processed ephemerally on-the-fly and is not permanently stored inside your wellbeing records.</li>
            </ul>
          </div>

          {/* How We Use Your Information */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>4. HOW WE USE YOUR INFORMATION</h2>
            <p style={styles.paragraph}>We use collected information for the following purposes:</p>

            <h3 style={styles.subSectionTitle}>4.1 Educational Services</h3>
            <ul style={styles.list}>
              <li style={styles.listItem}>Providing personalized learning experiences inside the platform</li>
              <li style={styles.listItem}>Tracking and reporting academic progress to appropriate stakeholders</li>
              <li style={styles.listItem}>Generating AI-powered study materials, quizzes, and assessments</li>
              <li style={styles.listItem}>Facilitating communication via SMS and email between teachers, students, and parents</li>
              <li style={styles.listItem}>Enabling submission and grading of assignments and assessments</li>
              <li style={styles.listItem}>Sending opt-in push notifications — alerts when new study material is published for your class, gentle reminders during extended periods of inactivity, and wellbeing alerts delivered to authorised guardians or administrators when distress signals are detected</li>
              <li style={styles.listItem}>Enabling in-school student discovery — letting students find each other's public profile within their own school via the search bar</li>
            </ul>

            <h3 style={styles.subSectionTitle}>4.2 Platform Operations</h3>
            <ul style={styles.list}>
              <li style={styles.listItem}>User authentication and account management</li>
              <li style={styles.listItem}>Maintaining platform security and preventing unauthorized access</li>
              <li style={styles.listItem}>Providing technical support and responding to user inquiries</li>
              <li style={styles.listItem}>Improving platform functionality and user experience</li>
              <li style={styles.listItem}>Sending important notifications and announcements</li>
            </ul>

            <h3 style={styles.subSectionTitle}>4.3 Gamification and Engagement</h3>
            <ul style={styles.list}>
              <li style={styles.listItem}>Managing experience points, rewards, and achievement systems</li>
              <li style={styles.listItem}>Displaying leaderboards and comparative rankings</li>
              <li style={styles.listItem}>Tracking streaks and engagement metrics</li>
              <li style={styles.listItem}>Operating the rewards store and item management</li>
            </ul>

            <h3 style={styles.subSectionTitle}>4.4 Analytics and Improvement</h3>
            <ul style={styles.list}>
              <li style={styles.listItem}>Analyzing usage patterns to improve educational outcomes</li>
              <li style={styles.listItem}>Generating aggregated, anonymized reports for educational insights</li>
              <li style={styles.listItem}>Identifying and resolving technical issues</li>
              <li style={styles.listItem}>Developing new features and services</li>
            </ul>
          </div>

          {/* Data Protection and Security */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>5. DATA PROTECTION AND SECURITY</h2>
            <p style={styles.paragraph}>
              We implement comprehensive security measures to protect your information:
            </p>

            <h3 style={styles.subSectionTitle}>5.1 Technical Safeguards</h3>
            <ul style={styles.list}>
              <li style={styles.listItem}><strong>Encryption:</strong> All passwords and sensitive tokens are encrypted using industry-standard hashing algorithms.</li>
              <li style={styles.listItem}><strong>Secure Transmission:</strong> Data transmitted between your device and our servers is protected using TLS/SSL encryption.</li>
              <li style={styles.listItem}><strong>Bot Protection:</strong> Integrated Google reCAPTCHA v3/Verifier to prevent automated attacks and secure the OTP verification flow.</li>
              <li style={styles.listItem}><strong>Secure Storage:</strong> All data is stored securely in Firebase/Firestore with enterprise-grade security measures.</li>
              <li style={styles.listItem}><strong>Autoscaling Infrastructure:</strong> Powered by Google Cloud Run with redundant instances to ensure 99.9% availability during traffic spikes.</li>
            </ul>

            <h3 style={styles.subSectionTitle}>5.2 Access Controls</h3>
            <ul style={styles.list}>
              <li style={styles.listItem}><strong>Role-Based Access:</strong> Access to data is strictly restricted based on user roles (student, teacher, parent, administrator).</li>
              <li style={styles.listItem}><strong>Authentication:</strong> Secure login mechanisms with session management.</li>
              <li style={styles.listItem}><strong>Parental Access:</strong> Parents can only view data related to their own children.</li>
              <li style={styles.listItem}><strong>Teacher Access:</strong> Teachers can only access data for students in their classes.</li>
            </ul>

            <h3 style={styles.subSectionTitle}>5.3 Data Retention</h3>
            <p style={styles.paragraph}>
              We retain personal data only for as long as necessary to fulfill the purposes outlined in this
              Privacy Policy, unless a longer retention period is required by law. Educational records may be
              retained for the duration of the student's enrollment and for a reasonable period thereafter as
              required for academic records management.
            </p>
          </div>

          {/* Data Sharing and Disclosure */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>6. DATA SHARING AND DISCLOSURE</h2>

            <h3 style={styles.subSectionTitle}>6.1 Information Visible to Other Users</h3>
            <ul style={styles.list}>
              <li style={styles.listItem}><strong>Leaderboards:</strong> Your username, class, profile picture, avatar, and XP are visible to other students in ranking displays.</li>
              <li style={styles.listItem}><strong>Class Participation:</strong> Your name and academic contributions may be visible to teachers and classmates within your assigned classes.</li>
              <li style={styles.listItem}><strong>Achievement Badges:</strong> Earned badges and achievements may be displayed publicly within the platform.</li>
              <li style={styles.listItem}><strong>Student Search:</strong> Other students <em>in your own school</em> can search for you by username/name and view your public profile card (profile photo, equipped avatar and frame, your avatar/frame collection, total XP, level, tasks done, average score, and day streak). Email, phone number, authentication tokens, and any password-related data are NEVER exposed to peers. Students from other schools cannot see your profile.</li>
            </ul>

            <h3 style={styles.subSectionTitle}>6.2 Information Shared with Service Providers</h3>
            <p style={styles.paragraph}>
              We rely on trusted third-party processors to deliver the platform. Each is bound by its own
              privacy commitments and is used strictly to operate the service — never for advertising or
              profiling. We disclose categories of processing rather than specific internal product
              identifiers, but the providers fall into the following groups:
            </p>
            <ul style={styles.list}>
              <li style={styles.listItem}><strong>Cloud platform (Google):</strong> Authentication, database, file storage, hosting, push notification delivery, and serverless background processing.</li>
              <li style={styles.listItem}><strong>AI provider:</strong> Powers the in-app tutor, content generation, and personalised learning responses. Conversations are processed transiently to generate replies and are not used to train external models.</li>
              <li style={styles.listItem}><strong>Educational video lookup:</strong> A video search API is used to surface relevant learning videos. Embedded videos play through the provider's standard player.</li>
              <li style={styles.listItem}><strong>Transactional email:</strong> A standard email delivery service is used to send wellbeing alerts and feedback notifications to authorised recipients only.</li>
            </ul>

            <h3 style={styles.subSectionTitle}>6.3 What We Do NOT Do</h3>
            <ul style={styles.list}>
              <li style={styles.listItem}>We do NOT sell personal information to third parties.</li>
              <li style={styles.listItem}>We do NOT share personal contact information with advertisers.</li>
              <li style={styles.listItem}>We do NOT use student data for targeted advertising.</li>
              <li style={styles.listItem}>We do NOT share educational records with unauthorized parties.</li>
            </ul>

            <h3 style={styles.subSectionTitle}>6.4 Legal Disclosure</h3>
            <p style={styles.paragraph}>
              We may disclose personal information if required to do so by law, or in the good faith belief that
              such disclosure is necessary to comply with legal obligations, protect our rights or property,
              prevent fraud, or ensure the safety of users.
            </p>
          </div>

          {/* Third-Party Services */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>7. THIRD-PARTY SERVICES AND INTEGRATIONS</h2>
            <p style={styles.paragraph}>
              TriSphere integrates with various third-party services to enhance functionality. Each of these
              services operates under their own privacy policies:
            </p>

            <div style={styles.serviceBox}>
              <h4 style={styles.serviceTitle}>Firebase (Google Cloud)</h4>
              <p style={styles.serviceDesc}>
                Provides authentication, database, and hosting services. Subject to Google's Privacy Policy
                and Terms of Service. For more information, visit: <a
                  href="https://firebase.google.com/support/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ ...styles.brandingLink, wordBreak: 'break-all' }}
                  onClick={async (e) => {
                    e.preventDefault();
                    if (Capacitor.isNativePlatform()) {
                        await Browser.open({ url: "https://firebase.google.com/support/privacy" });
                    } else {
                        window.open("https://firebase.google.com/support/privacy", "_blank");
                    }
                  }}
                >https://firebase.google.com/support/privacy</a>
              </p>
            </div>

            <div style={styles.serviceBox}>
              <h4 style={styles.serviceTitle}>Groq AI / Lernix AI</h4>
              <p style={styles.serviceDesc}>
                Powers AI tutoring features and content generation. Conversations may be processed to provide
                responses but are not used to train AI models without explicit consent.
              </p>
            </div>



            <div style={styles.serviceBox}>
              <h4 style={styles.serviceTitle}>Push Notification Delivery</h4>
              <p style={styles.serviceDesc}>
                A push messaging service is used to deliver the in-app alerts you opted into.
                Notification device tokens are stored only against your account and are removed
                automatically when they become invalid (e.g. app uninstall or permission revoke).
              </p>
            </div>

            <div style={styles.serviceBox}>
              <h4 style={styles.serviceTitle}>Server-Side Automation</h4>
              <p style={styles.serviceDesc}>
                Background server processes handle tasks such as syncing role-based access,
                maintaining the in-school search index, fanning out opt-in notifications, and
                routing wellbeing alerts to authorised recipients. These processes never expose
                data directly to the client and operate under our role-based access policy.
              </p>
            </div>
          </div>

          {/* Parental Rights and COPPA Compliance */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>8. PARENTAL RIGHTS AND CHILDREN'S PRIVACY</h2>

            <h3 style={styles.subSectionTitle}>8.1 Age Range and Children's Privacy Protection</h3>
            <p style={styles.paragraph}>
              TriSphere is designed for educational use in school environments and serves students from
              <strong> Class 1 to Class 10 (approximately ages 6 to 16)</strong>. We are fully committed to protecting
              the privacy of all children, especially our youngest learners. We comply with applicable laws
              regarding children's privacy, including the Children's Online Privacy Protection Act (COPPA)
              for children under 13 years of age.
            </p>

            <h3 style={styles.subSectionTitle}>8.2 Enhanced Protections for Younger Children (Class 1-5)</h3>
            <p style={styles.paragraph}>
              For our younger students in Classes 1 through 5 (approximately ages 6-11), we implement
              additional safeguards:
            </p>
            <ul style={styles.list}>
              <li style={styles.listItem}><strong>Parental Consent:</strong> Student accounts for children under 13 are created only by school administrators or with verified parental consent.</li>
              <li style={styles.listItem}><strong>Limited Data Collection:</strong> We collect only the minimum data necessary for educational purposes.</li>
              <li style={styles.listItem}><strong>No Direct Contact:</strong> Young children cannot be contacted directly by other users outside their class or school.</li>
              <li style={styles.listItem}><strong>Age-Appropriate Content:</strong> All content, including AI-generated responses, is filtered for age-appropriateness.</li>
              <li style={styles.listItem}><strong>Simplified Leaderboards:</strong> For younger students, leaderboard visibility may be limited to encourage healthy engagement.</li>
              <li style={styles.listItem}><strong>Parent/Guardian Oversight:</strong> Parents of younger children have enhanced monitoring capabilities through linked parent accounts.</li>
            </ul>

            <h3 style={styles.subSectionTitle}>8.3 Parental Consent Requirements</h3>
            <p style={styles.paragraph}>
              In accordance with COPPA and applicable data protection laws, we require verifiable parental
              consent before collecting personal information from children under 13. This consent is typically
              obtained through the school enrollment process, where schools act as agents for parents in
              providing consent for educational technology purposes.
            </p>

            <h3 style={styles.subSectionTitle}>8.4 Parental Access Rights</h3>
            <p style={styles.paragraph}>Parents and guardians have the right to:</p>
            <ul style={styles.list}>
              <li style={styles.listItem}>View their child's academic progress, grades, and assessments</li>
              <li style={styles.listItem}>Monitor their child's activity and engagement on the platform</li>
              <li style={styles.listItem}>View their child's gamification data (XP, rewards, achievements)</li>
              <li style={styles.listItem}>Communicate with teachers through the platform's messaging features</li>
              <li style={styles.listItem}>Request access to all personal data collected about their child</li>
              <li style={styles.listItem}>Request correction of inaccurate personal data</li>
              <li style={styles.listItem}>Request deletion of their child's personal data</li>
              <li style={styles.listItem}>Revoke consent and request account termination at any time</li>
            </ul>

            <h3 style={styles.subSectionTitle}>8.5 Exercising Parental Rights</h3>
            <p style={styles.paragraph}>
              To exercise any of these rights, parents should contact their child's school administrator.
              Verification of parental identity may be required before processing requests. We respond to
              all verified parental requests within 30 days.
            </p>
          </div>

          {/* User Rights */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>9. YOUR RIGHTS AND CHOICES</h2>
            <p style={styles.paragraph}>Depending on your jurisdiction, you may have the following rights:</p>
            <ul style={styles.list}>
              <li style={styles.listItem}><strong>Right to Access:</strong> Request a copy of the personal data we hold about you.</li>
              <li style={styles.listItem}><strong>Right to Rectification:</strong> Request correction of inaccurate or incomplete data.</li>
              <li style={styles.listItem}><strong>Right to Erasure:</strong> Request deletion of your personal data, subject to legal retention requirements.</li>
              <li style={styles.listItem}><strong>Right to Data Portability:</strong> Request transfer of your data in a machine-readable format.</li>
              <li style={styles.listItem}><strong>Right to Object:</strong> Object to certain processing activities.</li>
              <li style={styles.listItem}><strong>Right to Withdraw Consent:</strong> Withdraw consent where processing is based on consent.</li>
            </ul>
            <p style={styles.paragraph}>
              To exercise these rights, please contact your school administrator or our support team.
            </p>

            <h3 style={styles.subSectionTitle}>9.1 Notification Preferences</h3>
            <p style={styles.paragraph}>
              Push notifications are opt-in: the app asks for permission on first launch and you can
              revoke it at any time via your phone or browser's notification settings. Revoking
              permission stops all opt-in alerts. Critical wellbeing alerts are sent only to
              authorised guardians/administrators, not the affected student — see §10.
            </p>

            <h3 style={styles.subSectionTitle}>9.2 Removing Yourself From Student Search</h3>
            <p style={styles.paragraph}>
              The in-school student search is on by default for all student accounts so classmates
              can find each other. If you would prefer to be excluded, please contact your school
              administrator and we will remove you from the discovery list. Note that your name and
              class may still appear in leaderboards or classroom rosters, which are separate features.
            </p>
          </div>

          {/* Student Safety */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>10. STUDENT SAFETY AND ACADEMIC INTEGRITY</h2>

            <h3 style={styles.subSectionTitle}>10.1 Safety Measures</h3>
            <ul style={styles.list}>
              <li style={styles.listItem}>Platform is designed exclusively for educational use in school environments.</li>
              <li style={styles.listItem}>Inappropriate content should be immediately reported to teachers or administrators.</li>
              <li style={styles.listItem}>AI features include content moderation to ensure age-appropriate responses.</li>
            </ul>

            <h3 style={styles.subSectionTitle}>10.2 Academic Integrity</h3>
            <ul style={styles.list}>
              <li style={styles.listItem}>Quiz malpractice detection systems are in place and violations are logged.</li>
              <li style={styles.listItem}>Tab-switching and window-focus changes during assessments may be recorded.</li>
              <li style={styles.listItem}>Malpractice reports are accessible to teachers and administrators.</li>
              <li style={styles.listItem}>Violations may result in score adjustments or disciplinary action as per school policy.</li>
            </ul>
          </div>

          {/* ASTRA Wellbeing and Telemetry */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>11. ASTRA WELLBEING, FRONT CAMERA, TELEMETRY & CRISIS ALERTS</h2>
            <p style={styles.paragraph}>
              ASTRA is our daily emotional check-in companion, designed to support student mental wellbeing.
            </p>
            <h3 style={styles.subSectionTitle}>11.1 Opt-in Camera Emotion Tracking</h3>
            <p style={styles.paragraph}>
              You can optionally enable your front-facing camera to allow ASTRA to analyze your facial expressions
              for mood detection. This feature is disabled by default and requires explicit user consent.
              When enabled:
            </p>
            <ul style={styles.list}>
              <li style={styles.listItem}>Video frames are processed in real-time and transmitted securely via API strictly for immediate LLM expression analysis.</li>
              <li style={styles.listItem}><strong>We never save, store, or log these camera frames or images anywhere on our servers or your device.</strong> Visual analysis is completely ephemeral.</li>
            </ul>
            <h3 style={styles.subSectionTitle}>11.2 7-Day Learning Telemetry Integration</h3>
            <p style={styles.paragraph}>
              To provide contextually aware support, when opening the check-in modal, the platform compiles a summary of your app activity over the past 7 days (assignments completed, virtual simulation labs run, quizzes taken, textbook notes read, chatbot messages sent, and login streak). This activity context is processed ephemerally on-the-fly to personalize ASTRA's responses and suggest next steps; it is not permanently logged as part of your wellbeing record.
            </p>
            <h3 style={styles.subSectionTitle}>11.3 Crisis Alerts</h3>
            <p style={styles.paragraph}>
              If a check-in transcript indicates a student is in severe distress (e.g. self-harm or safety risks), an automated safety notification containing the transcript text is dispatched to school administrators and the student's linked parent.
            </p>
          </div>

          {/* Reward System Policies */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>12. GAMIFICATION AND REWARDS POLICY</h2>
            <ul style={styles.list}>
              <li style={styles.listItem}><strong>XP and Rewards:</strong> Experience points are earned through legitimate platform engagement and cannot be purchased with real currency.</li>
              <li style={styles.listItem}><strong>Frame Duration:</strong> Certain reward items (such as profile frames) have a 30-day usage period, after which they must be renewed using XP.</li>
              <li style={styles.listItem}><strong>Monthly Resets:</strong> Certain achievement metrics may reset monthly to encourage continued engagement.</li>
              <li style={styles.listItem}><strong>Non-Transferable:</strong> Rewards and XP are non-transferable between accounts.</li>
              <li style={styles.listItem}><strong>No Monetary Value:</strong> Virtual items and XP have no real-world monetary value and cannot be exchanged for cash.</li>
            </ul>
          </div>

          {/* Cookies and Local Storage */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>13. COOKIES AND THIRD-PARTY ADVERTISING</h2>
            <p style={styles.paragraph}>
              TriSphere uses browser local storage and cookies for the following purposes:
            </p>
            <ul style={styles.list}>
              <li style={styles.listItem}><strong>Authentication:</strong> Maintaining user sessions and login state.</li>
              <li style={styles.listItem}><strong>Preferences:</strong> Storing user preferences such as theme settings and display options.</li>
              <li style={styles.listItem}><strong>Performance:</strong> Caching data to improve load times and user experience.</li>
              <li style={styles.listItem}><strong>PWA Functionality:</strong> Enabling offline access and progressive web app features.</li>
              <li style={styles.listItem}><strong>Advertising:</strong> We use third-party vendors, including Google, to serve ads based on our users' prior visits to our website or other websites.</li>
            </ul>

            <h3 style={styles.subSectionTitle}>13.1 Google AdSense Disclosures</h3>
            <p style={styles.paragraph}>
              In accordance with Google AdSense terms, we disclose the following:
            </p>
            <ul style={styles.list}>
              <li style={styles.listItem}>Third-party vendors, including Google, use cookies to serve ads based on your prior visits to TriSphere or other websites.</li>
              <li style={styles.listItem}>Google's use of advertising cookies enables it and its partners to serve ads to you based on your visit to our site and/or other sites on the Internet.</li>
              <li style={styles.listItem}>You may opt out of personalized advertising by visiting <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer" style={styles.brandingLink}>Ads Settings</a>. Alternatively, you can opt out of a third-party vendor's use of cookies for personalized advertising by visiting <a href="http://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer" style={styles.brandingLink}>www.aboutads.info</a>.</li>
            </ul>

            <p style={styles.paragraph}>
              Essential cookies are required for platform functionality. By using TriSphere, you consent to
              the use of these essential and third-party advertising cookies.
            </p>
          </div>

          {/* Changes to Privacy Policy */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>14. CHANGES TO THIS PRIVACY POLICY</h2>
            <p style={styles.paragraph}>
              We reserve the right to update this Privacy Policy at any time. When we make changes, we will:
            </p>
            <ul style={styles.list}>
              <li style={styles.listItem}>Update the "Last Updated" date at the top of this policy.</li>
              <li style={styles.listItem}>Notify users of material changes through platform announcements.</li>
              <li style={styles.listItem}>Require re-acceptance of the policy for significant changes.</li>
            </ul>
            <p style={styles.paragraph}>
              Continued use of the platform after changes constitutes acceptance of the updated Privacy Policy.
            </p>
          </div>

          {/* Contact Information */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>15. CONTACT INFORMATION</h2>
            <p style={styles.paragraph}>
              For questions, concerns, or requests regarding this Privacy Policy or our data practices,
              please contact:
            </p>
            <div style={styles.contactBox}>
              <p style={styles.contactItem}><strong>School Administrator:</strong> Contact your school's administrative office</p>
              <p style={styles.contactItem}><strong>Platform Support:</strong> Reach out through your teacher or school administrator</p>
              <p style={styles.contactItem}><strong>Data Protection Inquiries:</strong> Submit requests through your school's official channels</p>
            </div>
            <p style={styles.paragraph}>
              We aim to respond to all legitimate requests within 30 days. Complex requests may require
              additional time, and we will notify you if an extension is necessary.
            </p>
          </div>

          {/* Governing Law */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>16. GOVERNING LAW</h2>
            <p style={styles.paragraph}>
              This Privacy Policy shall be governed by and construed in accordance with applicable data
              protection laws and regulations in the jurisdiction where the educational institution operates.
              Users agree to submit to the jurisdiction of courts in the applicable jurisdiction for the
              resolution of any disputes arising from this Privacy Policy.
            </p>
          </div>

          {/* Acknowledgment */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>17. ACKNOWLEDGMENT</h2>
            <p style={styles.paragraph}>
              By using TriSphere Learning Platform, you acknowledge that you have read this Privacy Policy
              in its entirety, understand its contents, and agree to be bound by its terms. If you are a
              parent or guardian accepting on behalf of a minor, you confirm that you have the authority
              to do so and accept responsibility for ensuring the minor's compliance with this policy.
            </p>
          </div>

          {/* Footer */}
          <div style={styles.footer}>
            <div style={styles.footerDivider}></div>
            {viewOnly ? (
              <>
                <p style={styles.footerText}>
                  You have previously acknowledged and accepted this Privacy Policy.
                </p>
                <button onClick={handleClose} style={styles.acceptButton}>
                  Close
                </button>
              </>
            ) : (
              <>
                <p style={styles.footerText}>
                  By clicking "I Accept," you acknowledge that you have read, understood, and agree to be
                  bound by this Privacy Policy. If you do not agree with any part of this policy, please
                  do not use the TriSphere platform.
                </p>
                <button onClick={handleAccept} style={styles.acceptButton}>
                  I Accept the Privacy Policy
                </button>
              </>
            )}
            <p style={styles.legalFooter}>
              © 2026 TriSphere Learning Platform. All Rights Reserved.
            </p>
            <div style={styles.brandingBox}>
              <img src="/yugnext-logo.png" alt="Yugnext-AI logo" style={styles.brandingLogo} />
              <p style={styles.brandingText}>Powered by <strong>Yugnext-AI</strong></p>
              <div style={{ padding: '8px 0' }}>
                <p style={{ ...styles.brandingInfo, margin: '8px 0' }}>Visit: <a
                  href="https://www.yugnext-ai.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ ...styles.brandingLink, padding: '10px' }}
                  onClick={async (e) => {
                    e.preventDefault();
                    if (Capacitor.isNativePlatform()) {
                        await Browser.open({ url: "https://www.yugnext-ai.com" });
                    } else {
                        window.open("https://www.yugnext-ai.com", "_blank");
                    }
                  }}
                >www.yugnext-ai.com</a></p>
              </div>
              <div style={{ padding: '8px 0' }}>
                <p style={{ ...styles.brandingInfo, margin: '8px 0' }}>Contact: <a href="mailto:contact@yugnext-ai.com" style={{ ...styles.brandingLink, padding: '10px' }}>contact@yugnext-ai.com</a></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(7, 9, 18, 0.8)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    zIndex: 10000,
    padding: '20px',
    overflowY: 'auto'
  },
  modal: {
    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95))',
    borderRadius: '24px',
    maxWidth: '900px',
    width: '100%',
    margin: '20px auto',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 2px rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    overflow: 'hidden'
  },
  header: {
    background: 'linear-gradient(135deg, #0f172a, #1e293b)',
    color: '#ffffff',
    padding: '48px 40px 40px',
    textAlign: 'center',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    position: 'relative'
  },
  title: {
    margin: '0 0 12px 0',
    fontSize: '32px',
    fontWeight: '800',
    fontFamily: '"Outfit", "Inter", system-ui, sans-serif',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    color: '#ffffff',
    display: 'block',
    textShadow: '0 0 20px rgba(59, 130, 246, 0.3)'
  },
  subtitle: {
    margin: '0 0 16px 0',
    fontSize: '16px',
    fontFamily: '"Inter", system-ui, sans-serif',
    fontWeight: '600',
    color: '#60a5fa',
    letterSpacing: '1px',
    textTransform: 'uppercase'
  },
  effectiveDate: {
    margin: '4px 0',
    fontSize: '13px',
    fontFamily: '"Inter", system-ui, sans-serif',
    color: '#94a3b8'
  },
  content: {
    padding: '40px 48px',
    fontFamily: '"Inter", system-ui, sans-serif',
    fontSize: '14px',
    lineHeight: '1.7',
    color: '#cbd5e1',
    background: 'rgba(255, 255, 255, 0.01)'
  },
  section: {
    marginBottom: '40px',
    paddingBottom: '32px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '700',
    fontFamily: '"Outfit", "Inter", system-ui, sans-serif',
    color: '#ffffff',
    marginBottom: '18px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    borderLeft: '4px solid #3b82f6',
    paddingLeft: '16px'
  },
  subSectionTitle: {
    fontSize: '15px',
    fontWeight: '700',
    fontFamily: '"Inter", system-ui, sans-serif',
    color: '#38bdf8',
    marginTop: '24px',
    marginBottom: '12px'
  },
  paragraph: {
    marginBottom: '16px',
    textAlign: 'justify',
    fontFamily: '"Inter", system-ui, sans-serif',
    color: '#cbd5e1'
  },
  list: {
    marginLeft: '20px',
    marginTop: '8px',
    marginBottom: '16px',
    paddingLeft: '10px'
  },
  listItem: {
    marginBottom: '10px',
    lineHeight: '1.6',
    fontFamily: '"Inter", system-ui, sans-serif',
    color: '#cbd5e1'
  },
  serviceBox: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    padding: '18px 24px',
    marginBottom: '16px'
  },
  serviceTitle: {
    fontSize: '14px',
    fontWeight: '700',
    fontFamily: '"Inter", system-ui, sans-serif',
    color: '#38bdf8',
    marginBottom: '6px',
    marginTop: '0'
  },
  serviceDesc: {
    fontSize: '13px',
    fontFamily: '"Inter", system-ui, sans-serif',
    color: '#94a3b8',
    margin: 0,
    lineHeight: '1.6'
  },
  contactBox: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    padding: '24px',
    marginTop: '16px',
    marginBottom: '16px'
  },
  contactItem: {
    margin: '8px 0',
    fontFamily: '"Inter", system-ui, sans-serif',
    fontSize: '13px',
    color: '#cbd5e1'
  },
  footer: {
    textAlign: 'center',
    paddingTop: '32px',
    marginTop: '20px'
  },
  footerDivider: {
    height: '1px',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: '32px'
  },
  footerText: {
    fontSize: '13px',
    fontFamily: '"Inter", system-ui, sans-serif',
    color: '#94a3b8',
    marginBottom: '28px',
    lineHeight: '1.7',
    maxWidth: '640px',
    margin: '0 auto 28px auto'
  },
  acceptButton: {
    background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '12px',
    padding: '16px 48px',
    fontSize: '15px',
    fontWeight: '700',
    fontFamily: '"Inter", system-ui, sans-serif',
    cursor: 'pointer',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)',
    outline: 'none'
  },
  legalFooter: {
    marginTop: '32px',
    fontSize: '12px',
    fontFamily: '"Inter", system-ui, sans-serif',
    color: '#64748b',
    fontStyle: 'italic'
  },
  brandingBox: {
    marginTop: '32px',
    padding: '24px',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px'
  },
  brandingLogo: {
    height: '36px',
    width: 'auto',
    marginBottom: '4px'
  },
  brandingText: {
    fontSize: '13px',
    color: '#ffffff',
    marginBottom: '4px',
    fontFamily: '"Inter", system-ui, sans-serif'
  },
  brandingInfo: {
    fontSize: '12px',
    color: '#94a3b8',
    margin: '2px 0',
    fontFamily: '"Inter", system-ui, sans-serif'
  },
  brandingLink: {
    color: '#38bdf8',
    textDecoration: 'none',
    fontWeight: '600'
  }
};
