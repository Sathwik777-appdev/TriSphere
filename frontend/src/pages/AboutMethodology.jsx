import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import VideoBackground from '../components/VideoBackground';

const AboutMethodology = () => {
    const navigate = useNavigate();

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };

    return (
        <div style={styles.pageWrapper}>
            <VideoBackground />
            
            <nav style={styles.nav}>
                <img src="/logo.png" alt="TriSphere" style={styles.navLogo} onClick={() => navigate('/')} />
                <button onClick={() => navigate('/')} style={styles.backButton}>← Back to Home</button>
            </nav>

            <main style={styles.content}>
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    <motion.h1 style={styles.title} variants={itemVariants}>
                        TriSphere Methodology: The Science of Modern Learning
                    </motion.h1>

                    <motion.section style={styles.section} variants={itemVariants}>
                        <h2 style={styles.subTitle}>1. Paradigm Shift: From Passive to Active Learning</h2>
                        <p style={styles.paragraph}>
                            At TriSphere, we believe that the traditional "listen-and-recall" method of education is no longer sufficient in a world driven by rapid technological evolution. Our methodology centers on <strong>Active Learning</strong>—a process where students "learn by doing" rather than just watching. By integrating tools like PhET Interactive Simulations and GeoGebra, TriSphere transforms abstract concepts in Physics, Chemistry, and Geometry into tactile, digital experiments that students can manipulate in real-time.
                        </p>
                        <p style={styles.paragraph}>
                            Our research indicates that when a student can visually manipulate a chemical reaction or observe the effects of gravity on a virtual pendulum, their conceptual retention increases by up to 40% compared to textbook-only learning.
                        </p>
                    </motion.section>

                    <motion.section style={styles.section} variants={itemVariants}>
                        <h2 style={styles.subTitle}>2. Lernix AI: The Personalized Study Companion</h2>
                        <p style={styles.paragraph}>
                            Education has historically struggled with "The 2-Sigma Problem"—the observation that students tutored one-on-one perform significantly better than those in a classroom. TriSphere's <strong>Lernix AI</strong> is designed to bridge this gap. Using advanced neural language models, Lernix acts as a 24/7 personal tutor. 
                        </p>
                        <p style={styles.paragraph}>
                            Unlike standard search engines, Lernix is context-aware. If a student is struggling with "Photosynthesis," Lernix doesn't just provide a definition; it asks clarifying questions, suggests relevant study notes, and generates tailored quizzes to ensure the student has truly mastered the material before moving forward.
                        </p>
                    </motion.section>

                    <motion.section style={styles.section} variants={itemVariants}>
                        <h2 style={styles.subTitle}>3. The Psychology of Gamification (XP & Rewards)</h2>
                        <p style={styles.paragraph}>
                            Motivation is the engine of education. TriSphere utilizes behavioral psychology to drive consistent study habits. Our <strong>Experience Points (XP)</strong> and <strong>Streak</strong> systems are mapped to educational milestones, not just empty engagement. When a student unlocks a "Legendary Inferno Knight" avatar or a "Diamond Frame," they aren't just playing a game—they are receiving positive reinforcement for completing their Physics assignments on time.
                        </p>
                        <p style={styles.paragraph}>
                            This gamified approach converts the "dread" of homework into a "quest" for mastery. By building a digital identity within TriSphere, students develop a sense of ownership over their academic progress.
                        </p>
                    </motion.section>



                    <motion.section style={styles.section} variants={itemVariants}>
                        <h2 style={styles.subTitle}>4. Holistic Collaboration: Connecting the Three Pillars</h2>
                        <p style={styles.paragraph}>
                            No student is an island. The "Tri" in TriSphere represents the crucial connection between the <strong>Student</strong>, the <strong>Teacher</strong>, and the <strong>Parent</strong>. 
                        </p>
                        <ul style={styles.list}>
                            <li><strong>Teachers:</strong> Use our smart dashboards to automate grading and monitor academic integrity through malpractice detection AI.</li>
                            <li><strong>Parents:</strong> Receive real-time insight into their child's engagement patterns, not just final grades.</li>
                            <li><strong>Students:</strong> Benefit from a unified environment where home and school are in perfect sync.</li>
                        </ul>
                        <p style={styles.paragraph}>
                            By reducing the administrative burden on teachers and the anxiety of the "unknown" for parents, we allow both to focus on their primary role: supporting the child's growth.
                        </p>
                    </motion.section>

                    <motion.section style={styles.section} variants={itemVariants}>
                        <h2 style={styles.subTitle}>5. Ethics, Privacy & Yugenxt-AI</h2>
                        <p style={styles.paragraph}>
                            Building tools for students requires the highest level of trust. TriSphere, powered by <strong>yugenxt-ai</strong>, adheres to strict data protection standards. We do not sell student data, and our AI is designed with strict educational guardrails to prevent misuse and ensure a safe, supportive environment for all ages.
                        </p>
                    </motion.section>

                    <motion.div style={styles.cta} variants={itemVariants}>
                        <button onClick={() => navigate('/login')} style={styles.primaryButton}>
                            Experience TriSphere Today
                        </button>
                    </motion.div>
                </motion.div>
            </main>

            <footer style={styles.footer}>
                <p>© 2026 TriSphere by yugenxt-ai. All Rights Reserved.</p>
            </footer>
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
        height: '50px',
        cursor: 'pointer',
        borderRadius: '12px'
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
        maxWidth: '900px',
        margin: '0 auto',
        padding: '60px 0 100px',
        position: 'relative',
        zIndex: 1
    },
    title: {
        fontSize: '3rem',
        fontWeight: '900',
        marginBottom: '60px',
        textAlign: 'center',
        background: 'linear-gradient(to right, #fff, #94a3b8)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent'
    },
    section: {
        background: 'rgba(30, 41, 59, 0.4)',
        padding: '40px',
        borderRadius: '24px',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(20px)',
        marginBottom: '30px'
    },
    subTitle: {
        fontSize: '1.5rem',
        color: '#3b82f6',
        marginBottom: '20px',
        fontWeight: '700'
    },
    paragraph: {
        fontSize: '1.1rem',
        lineHeight: '1.8',
        color: '#cbd5e1',
        marginBottom: '20px'
    },
    list: {
        marginBottom: '20px',
        paddingLeft: '20px',
        color: '#cbd5e1',
        lineHeight: '2',
        fontSize: '1.1rem'
    },
    cta: {
        textAlign: 'center',
        marginTop: '60px'
    },
    primaryButton: {
        padding: '16px 40px',
        fontSize: '1.1rem',
        fontWeight: '700',
        backgroundColor: '#3b82f6',
        color: '#fff',
        border: 'none',
        borderRadius: '12px',
        cursor: 'pointer',
        boxShadow: '0 10px 20px rgba(59, 130, 246, 0.3)'
    },
    footer: {
        textAlign: 'center',
        padding: '40px 0',
        color: '#64748b',
        borderTop: '1px solid rgba(255,255,255,0.05)'
    }
};

export default AboutMethodology;
