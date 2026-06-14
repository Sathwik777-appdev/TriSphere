import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import VideoBackground from '../components/VideoBackground';

const PrivacyPolicy = () => {
    const navigate = useNavigate();

    return (
        <div style={styles.pageWrapper}>
            <VideoBackground />
            
            <nav style={styles.nav}>
                <img src="/logo.png" alt="TriSphere" style={styles.navLogo} onClick={() => navigate('/')} />
                <motion.button
                    whileHover={{ scale: 1.05, background: 'rgba(255, 255, 255, 0.12)' }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                        if (window.history.length > 1) {
                            navigate(-1);
                        } else {
                            navigate('/');
                        }
                    }}
                    style={styles.backButton}
                >
                    ← Go Back
                </motion.button>
            </nav>

            <main style={styles.content}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <h1 style={styles.title}>Privacy Policy</h1>
                    <p style={styles.lastUpdated}>Last Updated: May 29, 2026</p>

                    <section style={styles.section}>
                        <h2 style={styles.subTitle}>1. Introduction</h2>
                        <p style={styles.paragraph}>
                            Welcome to TriSphere. TriSphere (referred to as "the Platform", "we", "us", or "our") is owned and operated by <strong>Yugnext-AI</strong>. We are committed to protecting the privacy of all our users, including students, teachers, parents, and administrators. This Privacy Policy explains how we collect, use, and safeguard your information when you use our platform — both the web app and the installable mobile PWA.
                        </p>
                    </section>

                    <section style={styles.section}>
                        <h2 style={styles.subTitle}>2. Information We Collect</h2>
                        <h3 style={styles.innerTitle}>2.1 Personal Data</h3>
                        <p style={styles.paragraph}>
                            To provide our educational services, we collect:
                        </p>
                        <ul style={styles.list}>
                            <li>Name, username, and email address for account creation.</li>
                            <li>School affiliation and class/grade level.</li>
                            <li>Phone number (when you bind it for OTP-based password reset).</li>
                            <li>Profile photos (stored in Firebase Storage) and avatar/frame preferences.</li>
                            <li>Performance data — quiz scores, assignment submissions, average score, tasks done, and day streak.</li>
                        </ul>

                        <h3 style={styles.innerTitle}>2.2 Academic & Gamification Data</h3>
                        <p style={styles.paragraph}>
                            We track academic progress including XP earned, level, badges unlocked, study streaks, and avatar/frame inventory to power our rewards store and provide insights to teachers and parents.
                        </p>

                        <h3 style={styles.innerTitle}>2.3 Push Notification Tokens</h3>
                        <p style={styles.paragraph}>
                            If you allow notifications, an opaque device token is stored against your account so we can deliver the in-app alerts you opted into — for example, new study material in your class, gentle activity reminders, and wellbeing alerts routed to authorised guardians/administrators. Invalid tokens are pruned automatically.
                        </p>

                        <h3 style={styles.innerTitle}>2.4 Public Profile Data</h3>
                        <p style={styles.paragraph}>
                            A limited subset of your account — username, name, class, school, profile photo, and aggregate progress stats (XP, average score, tasks completed, day streak) — is available to other students <strong>in your own school</strong> via the in-app search bar. Sensitive fields (email, phone number, authentication tokens, password-related data) are <strong>never</strong> exposed to peers.
                        </p>

                        <h3 style={styles.innerTitle}>2.5 Hardware & Device Permissions</h3>
                        <p style={styles.paragraph}>
                            Depending on your platform and settings, TriSphere requests the following permissions to operate its features:
                        </p>
                        <ul style={styles.list}>
                            <li><strong>Microphone (RECORD_AUDIO):</strong> Used to voice-chat with ASTRA during your daily wellbeing check-ins and parse your voice replies.</li>
                            <li><strong>Camera:</strong> Used to snap photos of assignments or documents to ask Lernix AI for assistance, and (optionally) for ASTRA's real-time emotion tracking via your front camera.</li>
                            <li><strong>Files and Storage (Media Access):</strong> Used on your device to let you select and upload PDF/image homework documents, profile photos, and save local session configuration.</li>
                            <li><strong>Push Notifications (POST_NOTIFICATIONS):</strong> Used optionally to alert you of new classroom notes, streaks, and wellbeing messages.</li>
                        </ul>
                    </section>

                    <section style={styles.section}>
                        <h2 style={styles.subTitle}>3. How We Use Your Information</h2>
                        <ul style={styles.list}>
                            <li>Personalise the Lernix AI study experience, with age-appropriate daily message limits.</li>
                            <li>Provide teachers with automated grading, AI-generated study material, and classroom insights.</li>
                            <li>Enable parents to monitor their child's academic development.</li>
                            <li>Facilitate the rewards store, leaderboards, and gamification features.</li>
                            <li>Send opt-in push notifications (study material alerts, activity reminders, wellbeing alerts).</li>
                            <li>Power the in-school student search so classmates can view each other's public profile.</li>
                            <li>Improve platform security and prevent malpractice during assessments.</li>
                        </ul>
                    </section>

                    <section style={styles.section}>
                        <h2 style={styles.subTitle}>4. Data Sharing and Security</h2>
                        <p style={styles.paragraph}>
                            <strong>We do not sell your personal data to third parties.</strong> Data is shared only with:
                        </p>
                        <ul style={styles.list}>
                            <li>Authorised school teachers and administrators associated with your account.</li>
                            <li>Linked parent accounts for student monitoring.</li>
                            <li>Other students <strong>in your own school</strong> via the public-profile features (safe fields only).</li>
                            <li>
                                Trusted infrastructure providers under strict confidentiality, including:
                                a major cloud platform (authentication, database, file storage, hosting,
                                serverless processing, push delivery), an AI provider (powering the in-app tutor),
                                an educational video lookup API, and a transactional email service. Each is bound by
                                its own privacy commitments and is used strictly to operate the service.
                            </li>
                        </ul>
                        <p style={styles.paragraph}>
                            We apply industry-standard security measures, including HTTPS/TLS encryption in transit, role-based access controls, bot protection on sensitive flows, and rate-limiting on our APIs.
                        </p>
                    </section>

                    <section style={styles.section}>
                        <h2 style={styles.subTitle}>5. ASTRA Wellbeing, Front Camera & Crisis Alerts</h2>
                        <p style={styles.paragraph}>
                            ASTRA is our daily emotional check-in companion. 
                        </p>
                        <p style={styles.paragraph}>
                            <strong>Opt-in Camera Emotion Tracking:</strong> You can optionally enable your front-facing camera to allow ASTRA to scan your facial expressions. This feature is off by default and requires explicit student consent. When enabled:
                        </p>
                        <ul style={styles.list}>
                            <li>Video frames are analyzed in real-time locally and sent via secure API strictly for immediate LLM expression inference.</li>
                            <li><strong>We never save, store, or log these camera frames or images anywhere on our servers or your device.</strong> The visual processing is completely ephemeral.</li>
                        </ul>
                        <p style={styles.paragraph}>
                            <strong>7-Day Learning Telemetry Integration:</strong> To provide contextually relevant academic encouragement and suggests, when you open the check-in modal, the platform compiles a summary of your recent 7-day app activities (assignments completed, virtual simulation labs run, quizzes taken, textbook notes read, AI chat messages sent, and login streak). This learning context is passed to the AI engine solely on-the-fly to personalize ASTRA's responses and suggest next steps; it is not permanently logged or saved.
                        </p>
                        <p style={styles.paragraph}>
                            <strong>Crisis Alerts:</strong> When a check-in transcript indicates a student needs urgent attention (e.g., severe distress or safety risks), an automated notification is sent to the student's school admin(s) and linked parent. The alert includes the transcript of what the student shared. This is strictly a safety feature.
                        </p>
                    </section>

                    <section style={styles.section}>
                        <h2 style={styles.subTitle}>6. Cookies, Local Storage, and Advertisements</h2>
                        <p style={styles.paragraph}>
                            TriSphere uses browser local storage for session continuity, theme preferences, AI chat history, and PWA offline support. We use Google AdSense to serve advertisements; AdSense may use cookies to serve ads based on your visit to this and other websites. You may opt out of personalised advertising via Google's Ad Settings.
                        </p>
                    </section>

                    <section style={styles.section}>
                        <h2 style={styles.subTitle}>7. Your Rights</h2>
                        <p style={styles.paragraph}>
                            You have the right to access, update, or request deletion of your personal data, to revoke push-notification permission (via your phone/browser settings), and to ask your school administrator to exclude you from the in-school student search. Please contact our support team to exercise these rights.
                        </p>
                    </section>

                    <section style={styles.section}>
                        <h2 style={styles.subTitle}>8. Contact Us</h2>
                        <p style={styles.paragraph}>
                            If you have questions about this policy, please contact us at:<br />
                            <strong>Email:</strong> <a href="mailto:contact@yugnext-ai.com" style={{ color: '#38bdf8', textDecoration: 'none' }}>contact@yugnext-ai.com</a><br />
                            <strong>Website:</strong> <a 
                                href="https://www.yugnext-ai.com" 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                style={{ color: '#38bdf8', textDecoration: 'none' }}
                                onClick={async (e) => {
                                    e.preventDefault();
                                    const { Capacitor } = await import('@capacitor/core');
                                    const { Browser } = await import('@capacitor/browser');
                                    if (Capacitor.isNativePlatform()) {
                                        await Browser.open({ url: "https://www.yugnext-ai.com" });
                                    } else {
                                        window.open("https://www.yugnext-ai.com", "_blank");
                                    }
                                }}
                            >www.yugnext-ai.com</a><br />
                            <strong>Entity:</strong> Yugnext-AI
                        </p>
                    </section>
                </motion.div>
            </main>
        </div>
    );
};

const styles = {
    pageWrapper: {
        minHeight: '100vh',
        color: '#ffffff',
        fontFamily: '"Product Sans", sans-serif',
        padding: '0 20px'
    },
    nav: {
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '30px 0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'relative',
        zIndex: 10
    },
    navLogo: {
        height: '40px',
        cursor: 'pointer',
        borderRadius: '8px'
    },
    backButton: {
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        color: '#fff',
        padding: '8px 16px',
        borderRadius: '8px',
        cursor: 'pointer'
    },
    content: {
        maxWidth: '800px',
        margin: '0 auto',
        padding: '40px 0 100px',
        position: 'relative',
        zIndex: 1
    },
    title: {
        fontSize: '2.5rem',
        fontWeight: '900',
        marginBottom: '10px'
    },
    lastUpdated: {
        color: '#64748b',
        marginBottom: '40px',
        fontSize: '0.9rem'
    },
    section: {
        background: 'rgba(30, 41, 59, 0.4)',
        padding: '30px',
        borderRadius: '20px',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(10px)',
        marginBottom: '20px'
    },
    subTitle: {
        fontSize: '1.25rem',
        color: '#3b82f6',
        marginBottom: '15px',
        fontWeight: '700'
    },
    innerTitle: {
        fontSize: '1.1rem',
        color: '#fff',
        margin: '20px 0 10px 0',
        fontWeight: '600'
    },
    paragraph: {
        fontSize: '1rem',
        lineHeight: '1.6',
        color: '#cbd5e1',
        marginBottom: '15px'
    },
    list: {
        paddingLeft: '20px',
        color: '#cbd5e1',
        lineHeight: '1.8',
        marginBottom: '15px'
    }
};

export default PrivacyPolicy;
