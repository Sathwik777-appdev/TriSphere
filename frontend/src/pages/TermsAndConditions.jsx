import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import VideoBackground from '../components/VideoBackground';

const TermsAndConditions = () => {
    const navigate = useNavigate();

    return (
        <div style={styles.pageWrapper}>
            <VideoBackground />
            
            <nav style={styles.nav}>
                <img src="/logo.png" alt="TriSphere" style={styles.navLogo} onClick={() => navigate('/')} />
                <button onClick={() => navigate('/')} style={styles.backButton}>← Back to Home</button>
            </nav>

            <main style={styles.content}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <h1 style={styles.title}>Terms and Conditions</h1>
                    <p style={styles.lastUpdated}>Last Updated: May 31, 2026</p>

                    <section style={styles.section}>
                        <h2 style={styles.subTitle}>1. Introduction</h2>
                        <p style={styles.paragraph}>
                            Welcome to TriSphere. By accessing or using the Platform, you agree to be bound by these Terms and Conditions. The Platform is owned and operated by <strong>Yugnext-AI</strong>.
                        </p>
                    </section>

                    <section style={styles.section}>
                        <h2 style={styles.subTitle}>2. Use of the Platform</h2>
                        <p style={styles.paragraph}>
                            You agree to use the Platform only for lawful purposes and in a manner that does not infringe the rights of, restrict, or inhibit anyone else's use and enjoyment of the Platform. Educational institutions using the Platform must ensure that all users within their organization comply with these terms.
                        </p>
                    </section>

                    <section style={styles.section}>
                        <h2 style={styles.subTitle}>3. Device Hardware, Permissions & Telemetry</h2>
                        <p style={styles.paragraph}>
                            To function properly, TriSphere requires access to certain hardware features on your device, which you will be prompted to grant sequentially upon setup:
                        </p>
                        <p style={styles.paragraph}>
                            <strong>Mandatory Access:</strong> Access to the Camera, Microphone, and Files/Storage is required to participate in secure core features (e.g. daily ASTRA voice chats, homework worksheet scanning/upload, profile photos). Under our platform security rules, if any mandatory permission is denied, the application will display an alert and exit immediately. You must enable these permissions in your system settings to restore access.
                        </p>
                        <p style={styles.paragraph}>
                            <strong>Opt-in Features & Ephemeral Processing:</strong> Use of your front camera for real-time expression/emotion analysis during ASTRA check-ins is strictly opt-in. By enabling the camera toggle, you consent to the ephemeral transmission of base64 video frames for immediate LLM inference. No visual data is saved, recorded, or permanently stored.
                        </p>
                        <p style={styles.paragraph}>
                            <strong>7-Day Learning Telemetry:</strong> ASTRA Wellbeing Check-Ins also utilize a 7-day student learning telemetry overview (including assignments completed, virtual simulation labs run, quizzes taken, textbook notes read, chatbot messages sent, and login streak) to contextually personalize check-in feedback and suggest relevant study tasks. This telemetry is fetched client-side and sent ephemerally to the ASTRA AI engine; it is never appended to your permanent check-in history.
                        </p>
                    </section>

                    <section style={styles.section}>
                        <h2 style={styles.subTitle}>4. Account Registration</h2>
                        <p style={styles.paragraph}>
                            Users must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
                        </p>
                    </section>

                    <section style={styles.section}>
                        <h2 style={styles.subTitle}>5. Intellectual Property</h2>
                        <p style={styles.paragraph}>
                            All content, trademarks, and data on this Platform, including but not limited to software, databases, text, graphics, icons, hyperlinks, private information, designs, and agreements, are the property of or licensed to Yugnext-AI.
                        </p>
                    </section>

                    <section style={styles.section}>
                        <h2 style={styles.subTitle}>6. Limitations of Liability & Scope of Service</h2>
                        <p style={styles.paragraph}>
                            <strong>Educational Aid Only:</strong> The TriSphere Platform (including but not limited to its automated quiz engines, AI study guides, ASTRA voice check-ins, performance dashboards, and automated grading suggestions) is provided strictly as an educational and supplementary aid. It is intended to assist learning and streamline administrative workflows for educational institutions.
                        </p>
                        <p style={styles.paragraph}>
                            <strong>School Authority & Discretion:</strong> All final academic scoring, official grading, verification of lab experiments, homework evaluation, course credits, disciplinary actions, student counseling, and administrative decisions remain **solely and exclusively under the authority, discretion, and judgment of the School** or the respective educational institution. The Platform does not make binding academic decisions.
                        </p>
                        <p style={styles.paragraph}>
                            Yugnext-AI is a technology service provider and disclaims any and all liability, losses, or disputes arising from academic, grading, behavioral, or disciplinary actions taken by the School based on information, flags, or data displayed on the Platform. Yugnext-AI will not be liable for any direct, indirect, special, punitive, exemplary, or consequential losses or damages of whatsoever kind arising out of your use of or access to the Platform.
                        </p>
                    </section>

                    <section style={styles.section}>
                        <h2 style={styles.subTitle}>7. Contact Information</h2>
                        <p style={styles.paragraph}>
                            If you have questions about these Terms, please contact us at:<br />
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
                            >www.yugnext-ai.com</a>
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
    paragraph: {
        fontSize: '1rem',
        lineHeight: '1.6',
        color: '#cbd5e1',
        marginBottom: '15px'
    }
};

export default TermsAndConditions;
