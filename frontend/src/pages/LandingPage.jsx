import React, { useEffect, useState } from 'react';
import { registerPlugin, Capacitor } from '@capacitor/core';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';

// Reference our custom Capacitor plugin
let AppPermissions = null;
if (Capacitor.isNativePlatform()) {
  try {
    AppPermissions = registerPlugin('AppPermissions');
  } catch (e) {
    console.warn('AppPermissions plugin registration failed, using web fallback:', e);
  }
}
import { safeLocalStorage } from '../utils/storage';
import { db } from '../services/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import VideoBackground from '../components/VideoBackground';
import AnimatedLogo from '../components/AnimatedLogo';

// Inline media-query hook. The page is rendered as a single component with
// inline `style={}` props, so we can't lean on CSS @media rules to swap
// layout — instead we re-render with a breakpoint-aware boolean and pick
// the right variant/sizes. 768px = "phone or tight portrait tablet".
const useIsMobile = (breakpoint = 768) => {
    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== 'undefined' && window.innerWidth < breakpoint
    );
    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < breakpoint);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [breakpoint]);
    return isMobile;
};

const LandingPage = () => {
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const [isScrolled, setIsScrolled] = useState(false);
    const [activeTab, setActiveTab] = useState('students');
    const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
    const [demoForm, setDemoForm] = useState({ institutionName: '', emailId: '', phoneNumber: '' });
    const [demoStatus, setDemoStatus] = useState('idle');

    const handleDemoSubmit = async (e) => {
        e.preventDefault();
        setDemoStatus('loading');
        try {
            await addDoc(collection(db, 'demoRequests'), {
                ...demoForm,
                timestamp: serverTimestamp()
            });
            setDemoStatus('success');
            setTimeout(() => {
                setIsDemoModalOpen(false);
                setDemoStatus('idle');
                setDemoForm({ institutionName: '', emailId: '', phoneNumber: '' });
            }, 3000);
        } catch (error) {
            console.error('Error submitting demo request:', error);
            setDemoStatus('error');
        }
    };

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.2
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };

    return (
        <div style={styles.pageWrapper}>
            <VideoBackground isLoginPage={false} />
            


            <motion.header
                initial={{ y: -100 }}
                animate={{ y: isScrolled ? 0 : -100 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                style={{
                    ...styles.stickyHeader,
                    ...(isMobile ? styles.stickyHeaderMobile : null)
                }}
            >
                <div style={styles.headerLogoRow} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                    <img src="/logo-mark.png" alt="TriSphere" style={styles.headerLogo} />
                    {!isMobile && <span style={styles.headerBrand}>TriSphere</span>}
                </div>
                {!isMobile && (
                    <div style={styles.headerLinks}>
                        <a href="#features" style={styles.headerLink}>Features</a>
                        <a href="#pillars" style={styles.headerLink}>Pillars</a>
                    </div>
                )}
                <button 
                    onClick={() => {
                        safeLocalStorage.set('has_seen_landing', true);
                        navigate('/login');
                    }}
                    style={styles.headerLoginBtn}
                >
                    Login
                </button>
            </motion.header>

            <main style={styles.mainContent}>
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    style={{
                        ...styles.heroSection,
                        ...(isMobile ? styles.heroSectionMobile : null),
                    }}
                >
                    <motion.div
                        variants={itemVariants}
                        style={{
                            marginBottom: isMobile ? 18 : 32,
                            maxWidth: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: isMobile ? 14 : 0,
                        }}
                    >
                        {/* Desktop keeps the AnimatedLogo "splash" variant
                            which renders the gradient-clipped "TriSphere"
                            wordmark next to the emblem. On mobile the
                            gradient-text-clip was rendering invisibly on some
                            browsers (an empty pill where the brand name
                            should be), so we render the emblem ONLY and put
                            "TriSphere" + tagline below as plain, bulletproof
                            elements that don't depend on -webkit-text-fill-
                            color: transparent + background-clip: text. */}
                        <AnimatedLogo
                            variant={isMobile ? 'auth' : 'splash'}
                            tagline="Holistic Learning Platform"
                            withWordmark={isMobile ? false : undefined}
                            withTagline={isMobile ? false : undefined}
                        />
                        {isMobile && (
                            <div style={styles.heroBrandMobile}>
                                <h1 style={styles.heroBrandNameMobile}>TriSphere</h1>
                                <span style={styles.heroBrandTaglineMobile}>
                                    HOLISTIC LEARNING PLATFORM
                                </span>
                            </div>
                        )}
                    </motion.div>
                    <motion.h1 style={{ ...styles.heroTitle, display: 'none' }} variants={itemVariants}>
                        TriSphere: Holistic Learning Platform
                    </motion.h1>
                    <motion.p
                        style={{
                            ...styles.heroSubtitle,
                            ...(isMobile ? styles.heroSubtitleMobile : null),
                        }}
                        variants={itemVariants}
                    >
                        <span style={{ display: 'block', color: '#c4b5fd', fontWeight: '600', marginBottom: '12px' }}>
                            Because every life matters, and we value your emotions.
                        </span>
                        Bridging the gap between students, teachers, and parents through advanced AI and gamification.
                    </motion.p>
                    <motion.div
                        style={{
                            ...styles.buttonGroup,
                            ...(isMobile ? styles.buttonGroupMobile : null),
                        }}
                        variants={itemVariants}
                    >
                        <button
                            onClick={() => {
                                safeLocalStorage.set('has_seen_landing', true);
                                navigate('/login');
                            }}
                            style={{
                                ...styles.primaryButton,
                                ...(isMobile ? styles.ctaButtonMobile : null),
                            }}
                        >
                            Explore Dashboard
                        </button>
                        <button
                            onClick={() => setIsDemoModalOpen(prev => !prev)}
                            style={{
                                ...styles.secondaryButton,
                                ...(isMobile ? styles.ctaButtonMobile : null),
                            }}
                        >
                            Book a Demo {isDemoModalOpen ? '▲' : '▼'}
                        </button>
                    </motion.div>

                    <AnimatePresence>
                        {isDemoModalOpen && (
                            <motion.div
                                initial={{ height: 0, opacity: 0, marginTop: 0 }}
                                animate={{ height: 'auto', opacity: 1, marginTop: 24 }}
                                exit={{ height: 0, opacity: 0, marginTop: 0 }}
                                style={{ overflow: 'hidden', width: '100%', maxWidth: '480px', margin: '0 auto' }}
                            >
                                <div style={{
                                    padding: '24px',
                                    background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95))',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(139, 92, 246, 0.15)',
                                    borderRadius: '16px',
                                }}>
                                    {demoStatus === 'success' ? (
                                        <div style={styles.modalSuccess}>
                                            <div style={{...styles.successIcon, marginBottom: '12px'}}>✓</div>
                                            <h4 style={{...styles.successTitle, fontSize: '1.2rem', marginBottom: '8px'}}>Request Sent!</h4>
                                            <p style={{...styles.successText, fontSize: '0.9rem'}}>We've received your details. Our team will contact you shortly.</p>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleDemoSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
                                            <div style={styles.inputGroup}>
                                                <label style={styles.inputLabel}>Institution Name</label>
                                                <input 
                                                    type="text" 
                                                    required 
                                                    style={styles.modalInput}
                                                    value={demoForm.institutionName}
                                                    onChange={(e) => setDemoForm({...demoForm, institutionName: e.target.value})}
                                                    placeholder="e.g. Springfield High School"
                                                />
                                            </div>
                                            <div style={styles.inputGroup}>
                                                <label style={styles.inputLabel}>Email ID</label>
                                                <input 
                                                    type="email" 
                                                    required 
                                                    style={styles.modalInput}
                                                    value={demoForm.emailId}
                                                    onChange={(e) => setDemoForm({...demoForm, emailId: e.target.value})}
                                                    placeholder="principal@school.edu"
                                                />
                                            </div>
                                            <div style={styles.inputGroup}>
                                                <label style={styles.inputLabel}>Phone Number</label>
                                                <input 
                                                    type="tel" 
                                                    required 
                                                    style={styles.modalInput}
                                                    value={demoForm.phoneNumber}
                                                    onChange={(e) => setDemoForm({...demoForm, phoneNumber: e.target.value})}
                                                    placeholder="+1 (555) 000-0000"
                                                />
                                            </div>
                                            
                                            {demoStatus === 'error' && (
                                                <p style={styles.errorText}>Something went wrong. Please try again later.</p>
                                            )}
                                            
                                            <button 
                                                type="submit" 
                                                style={{...styles.submitBtn, marginTop: '8px', opacity: demoStatus === 'loading' ? 0.7 : 1}}
                                                disabled={demoStatus === 'loading'}
                                            >
                                                {demoStatus === 'loading' ? 'Sending...' : 'Request Demo'}
                                            </button>
                                        </form>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>

                {/* Emotion-aware banner — anchors the "why" of ASTRA before
                    the feature grid breaks down the "what". Soft entrance on
                    scroll into view. */}
                <motion.section
                    style={{
                        ...styles.emotionsBannerSection,
                        ...(isMobile ? styles.emotionsBannerSectionMobile : null),
                    }}
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                >
                    <div style={styles.emotionsBannerInner}>
                        <img
                            src="/philosophy-banner.png"
                            alt="TriSphere: Education is not just about marks. Supporting theoretical learning, experimental understanding, and mental wellbeing."
                            style={styles.emotionsBannerImage}
                        />
                    </div>
                </motion.section>

                <section
                    id="features"
                    style={{
                        ...styles.section,
                        ...(isMobile ? styles.sectionMobile : null),
                    }}
                >
                    <div style={styles.showcaseContainer}>
                        <FeatureShowcase
                            isMobile={isMobile}
                            imgSrc="/astra-mentor.png"
                            title="ASTRA Daily Check-in"
                            description="A warm AI mentor that opens every day with a real conversation. ASTRA listens, classifies emotional state, and quietly flags students who need a teacher to reach out — so no one slips through the cracks."
                            align="left"
                            gradient="linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(124, 58, 237, 0.05))"
                        />
                        <FeatureShowcase
                            isMobile={isMobile}
                            imgSrc="/ai-notes.png"
                            title="AI-Generated Notes & Quizzes"
                            description="Teachers upload a chapter PDF; TriSphere returns clean notes, ten quiz questions, and a graded assignment ready for the class — automatically. Students get a personalized study path that adapts to performance."
                            align="right"
                            gradient="linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.05))"
                        />
                        <FeatureShowcase
                            isMobile={isMobile}
                            imgSrc="/interactive-sims.png"
                            title="Simulations & Study Tools"
                            description="Master your subjects with world-class integrations including PhET interactive simulations, GeoGebra mathematics, a Pomodoro study timer, an integrated academic dictionary, and many more."
                            align="left"
                            gradient="linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.05))"
                        />
                        <FeatureShowcase
                            isMobile={isMobile}
                            imgSrc="/gamified-xp.png"
                            title="Gamified XP & Streaks"
                            description="Turn education into an adventure. Earn XP for every lesson completed and quiz excelled in. Climb the leaderboard, build daily streaks, and spend rewards in the store on avatars, frames and badges."
                            align="right"
                            gradient="linear-gradient(135deg, rgba(236, 72, 153, 0.2), rgba(219, 39, 119, 0.05))"
                        />
                        <FeatureShowcase
                            isMobile={isMobile}
                            imgSrc="/parents-dashboard.png"
                            title="Parents in the Loop"
                            description="Real-time visibility into a child's progress, attendance, quiz scores and engagement patterns. School and home stay in sync without a single phone call."
                            align="left"
                            gradient="linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(79, 70, 229, 0.05))"
                        />
                    </div>
                </section>


                <section
                    style={{
                        ...styles.textSection,
                        ...(isMobile ? styles.textSectionMobile : null),
                    }}
                >
                    <h2
                        id="pillars"
                        style={{
                            ...styles.sectionTitle,
                            ...(isMobile ? styles.sectionTitleMobile : null),
                        }}
                    >
                        Connecting the Pillars of Education
                    </h2>
                    
                    <div style={{...styles.tabsContainer, ...(isMobile ? styles.tabsContainerMobile : null)}}>
                        <div style={{...styles.tabList, ...(isMobile ? styles.tabListMobile : null)}}>
                            <button 
                                onClick={() => setActiveTab('students')}
                                style={activeTab === 'students' ? styles.activeTabStudents : styles.inactiveTab}
                            >
                                For Students
                            </button>
                            <button 
                                onClick={() => setActiveTab('teachers')}
                                style={activeTab === 'teachers' ? styles.activeTabTeachers : styles.inactiveTab}
                            >
                                For Teachers
                            </button>
                            <button 
                                onClick={() => setActiveTab('parents')}
                                style={activeTab === 'parents' ? styles.activeTabParents : styles.inactiveTab}
                            >
                                For Parents
                            </button>
                            <button 
                                onClick={() => setActiveTab('admins')}
                                style={activeTab === 'admins' ? styles.activeTabAdmins : styles.inactiveTab}
                            >
                                For Admins
                            </button>
                        </div>

                        <div style={{...styles.tabContentArea, ...(isMobile ? styles.tabContentAreaMobile : null)}}>
                            <AnimatePresence mode="wait">
                                {activeTab === 'students' && (
                                    <motion.div 
                                        key="students"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.3 }}
                                        style={styles.tabContentInner}
                                    >
                                        <h3 style={{...styles.tabContentTitle, color: '#60a5fa'}}>The Student Journey</h3>
                                        <p style={styles.tabContentText}>
                                            TriSphere provides students with a personalized learning journey. From the Pomodoro study timer to the integrated academic dictionary,
                                            every tool is designed to optimize focus and consistency. Students aren't just reading—they are interacting, competing on leaderboards,
                                            and building a digital identity through achievements and streaks.
                                        </p>
                                    </motion.div>
                                )}
                                {activeTab === 'teachers' && (
                                    <motion.div 
                                        key="teachers"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.3 }}
                                        style={styles.tabContentInner}
                                    >
                                        <h3 style={{...styles.tabContentTitle, color: '#a78bfa'}}>Empowering Educators</h3>
                                        <p style={styles.tabContentText}>
                                            Empowering educators with smart automation. TriSphere handles the heavy lifting with automated grading,
                                            advanced malpractice detection during assessments, and comprehensive classroom management tools.
                                            Focus on teaching while we handle the data.
                                        </p>
                                    </motion.div>
                                )}
                                {activeTab === 'parents' && (
                                    <motion.div 
                                        key="parents"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.3 }}
                                        style={styles.tabContentInner}
                                    >
                                        <h3 style={{...styles.tabContentTitle, color: '#34d399'}}>Parents in the Loop</h3>
                                        <p style={styles.tabContentText}>
                                            Stay connected to your child's academic growth like never before. TriSphere provides parents with
                                            real-time insights into progress, assessment scores, and engagement patterns, ensuring school
                                            and home are always in sync.
                                        </p>
                                    </motion.div>
                                )}
                                {activeTab === 'admins' && (
                                    <motion.div 
                                        key="admins"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.3 }}
                                        style={styles.tabContentInner}
                                    >
                                        <h3 style={{...styles.tabContentTitle, color: '#fbbf24'}}>Institutional Control</h3>
                                        <p style={styles.tabContentText}>
                                            Equip school administrators with bird's-eye visibility. Manage teacher assignments, monitor school-wide performance analytics, handle subscription tiers, and orchestrate curriculum planning all from a centralized, powerful dashboard.
                                        </p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </section>

                <ROISection isMobile={isMobile} />

                <FAQSection isMobile={isMobile} />

                <footer
                    style={{
                        ...styles.footer,
                        ...(isMobile ? styles.footerMobile : null),
                    }}
                >
                    <div
                        style={{
                            ...styles.footerContent,
                            ...(isMobile ? styles.footerContentMobile : null),
                        }}
                    >
                        {/* Top row: brand statement (left) + three link columns (right) */}
                        <div
                            style={{
                                ...styles.footerTop,
                                ...(isMobile ? styles.footerTopMobile : null),
                            }}
                        >
                            <div style={styles.footerBrandCol}>
                                <div style={styles.footerBrandRow}>
                                    <img src="/logo-mark.png" alt="TriSphere" style={styles.footerBrandMark} />
                                    <span style={styles.footerBrandName}>TriSphere</span>
                                </div>
                                <p style={styles.footerBrandTag}>
                                    AI-powered learning that listens. Built for students, teachers and parents — together.
                                </p>
                                <div style={styles.footerPoweredRow}>
                                    <img src="/yugnext-logo.png" alt="Yugnext-AI" style={styles.footerPoweredLogo} />
                                    <span style={styles.footerPoweredText}>Powered by <strong style={{ color: '#c4b5fd' }}>Yugnext-AI</strong></span>
                                </div>
                            </div>

                            <div
                                style={{
                                    ...styles.footerLinksCols,
                                    ...(isMobile ? styles.footerLinksColsMobile : null),
                                }}
                            >
                                <div style={styles.footerCol}>
                                    <h4 style={styles.footerColHeading}>Platform</h4>
                                    <a href="#features" style={styles.footerLink}>Features</a>
                                    <FooterLink onClick={() => navigate('/about')}>Methodology & Science</FooterLink>
                                    <FooterLink onClick={() => navigate('/login')}>Dashboard</FooterLink>
                                </div>
                                <div style={styles.footerCol}>
                                    <h4 style={styles.footerColHeading}>Support</h4>
                                    <a href="mailto:contact@yugenxt-ai.com" style={styles.footerLink}>Contact Us</a>
                                    <a
                                      href="https://www.yugnext-ai.com"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        window.open('https://www.yugnext-ai.com', '_blank', 'noopener,noreferrer');
                                      }}
                                      style={styles.footerLink}
                                    >Yugenxt Official</a>
                                </div>
                                <div style={styles.footerCol}>
                                    <h4 style={styles.footerColHeading}>Legal</h4>
                                    <FooterLink onClick={() => navigate('/terms')}>Terms and Conditions</FooterLink>
                                    <FooterLink onClick={() => navigate('/privacy')}>Privacy Policy</FooterLink>
                                </div>
                            </div>
                        </div>

                        {/* Bottom bar: subtle divider + copyright + tagline */}
                        <div
                            style={{
                                ...styles.footerBottom,
                                ...(isMobile ? styles.footerBottomMobile : null),
                            }}
                        >
                            <span style={styles.footerCopy}>© 2026 TriSphere Learning Platform · A product of Yugnext-AI</span>
                            <span style={styles.footerMadeIn}>Crafted with care · Designed in India 🇮🇳</span>
                        </div>
                    </div>
                </footer>
            </main>
        </div>
    );
};

// Tiny button styled to look exactly like an <a> footer link, so onClick
// destinations (privacy, methodology, dashboard) sit visually flush with
// real anchor links instead of looking like primary CTAs.
const FooterLink = ({ children, onClick }) => {
    const [hovered, setHovered] = React.useState(false);
    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                ...styles.footerLink,
                color: hovered ? '#e2e8f0' : '#94a3b8',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                font: 'inherit',
                textAlign: 'left',
            }}
        >
            {children}
        </button>
    );
};

const FeatureShowcase = ({ imgSrc, title, description, isMobile, align, gradient }) => {
    const isLeft = align === 'left';
    
    // 3D Tilt State
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    
    const mouseXSpring = useSpring(x, { stiffness: 150, damping: 15 });
    const mouseYSpring = useSpring(y, { stiffness: 150, damping: 15 });
    
    const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ['7.5deg', '-7.5deg']);
    const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ['-7.5deg', '7.5deg']);

    const handleMouseMove = (e) => {
        if (isMobile) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const xPct = mouseX / width - 0.5;
        const yPct = mouseY / height - 0.5;
        x.set(xPct);
        y.set(yPct);
    };

    const handleMouseLeave = () => {
        x.set(0);
        y.set(0);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            style={{
                ...styles.showcaseItem,
                ...(isMobile ? styles.showcaseItemMobile : null),
                flexDirection: isMobile ? 'column' : (isLeft ? 'row' : 'row-reverse'),
            }}
        >
            <div style={{ ...styles.showcaseText, ...(isMobile ? styles.showcaseTextMobile : null) }}>
                <h3 style={{ ...styles.showcaseTitle, ...(isMobile ? styles.showcaseTitleMobile : null) }}>{title}</h3>
                <p style={{ ...styles.showcaseDescription, ...(isMobile ? styles.showcaseDescriptionMobile : null) }}>{description}</p>
            </div>
            <motion.div
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                style={{
                    ...styles.showcaseVisual,
                    ...(isMobile ? styles.showcaseVisualMobile : null),
                    background: gradient,
                    rotateX: isMobile ? 0 : rotateX,
                    rotateY: isMobile ? 0 : rotateY,
                    perspective: 1000,
                    transformStyle: "preserve-3d"
                }}
            >
                <motion.img 
                    src={imgSrc} 
                    alt={title} 
                    style={{ 
                        ...styles.showcaseImage, 
                        ...(isMobile ? styles.showcaseImageMobile : null),
                        transform: "translateZ(30px)" 
                    }} 
                    whileHover={{ scale: 1.05 }}
                    transition={{ duration: 0.5 }}
                />
            </motion.div>
        </motion.div>
    );
};

const faqData = [
    {
        question: "How long does it take to onboard our school?",
        answer: "TriSphere is designed for rapid deployment. With our CSV bulk-import and automated class generation, a typical school can be fully onboarded and ready for teachers to log in within 48 hours."
    },
    {
        question: "Is TriSphere compliant with student privacy laws?",
        answer: "Absolutely. We adhere to strict data protection standards (including FERPA and GDPR guidelines). Student data is fully encrypted, never sold, and access is strictly role-based."
    },
    {
        question: "Do we need to buy new hardware for our classrooms?",
        answer: "No! TriSphere is a cloud-based platform accessible from any modern web browser. It runs flawlessly on existing Chromebooks, iPads, Windows PCs, and even smartphones."
    },
    {
        question: "How does the AI grading work?",
        answer: "Our advanced AI models analyze both multiple-choice and subjective text answers against teacher-provided rubrics. It drastically reduces grading time while still allowing teachers to manually review and override any AI-assigned score."
    }
];

const FAQItem = ({ faq, index, activeIndex, setActiveIndex }) => {
    const isActive = activeIndex === index;
    return (
        <div style={styles.faqItem}>
            <button 
                style={styles.faqButton} 
                onClick={() => setActiveIndex(isActive ? null : index)}
            >
                <span style={{...styles.faqQuestion, color: isActive ? '#c4b5fd' : '#e2e8f0'}}>{faq.question}</span>
                <span style={{...styles.faqIcon, transform: isActive ? 'rotate(180deg)' : 'rotate(0deg)'}}>
                    ▼
                </span>
            </button>
            <AnimatePresence>
                {isActive && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        style={{ overflow: 'hidden' }}
                    >
                        <div style={styles.faqAnswer}>
                            {faq.answer}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const ROISection = ({ isMobile }) => {
    const roiData = [
        { metric: "15 hrs", label: "Admin time saved per teacher, per week" },
        { metric: "40%", label: "Increase in student engagement in STEM" },
        { metric: "3x", label: "Faster grading turnaround using AI assistance" },
        { metric: "24/7", label: "Availability of personalized tutoring for every student" }
    ];

    return (
        <section style={{...styles.roiSection, ...(isMobile ? styles.roiSectionMobile : null)}}>
            <motion.div 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.6 }}
                style={{ textAlign: 'center', marginBottom: '48px' }}
            >
                <h2 style={{...styles.sectionTitle, ...(isMobile ? styles.sectionTitleMobile : null)}}>
                    Proven Institutional Impact
                </h2>
                <p style={{ color: '#94a3b8', fontSize: '1.1rem', maxWidth: '600px', margin: '16px auto 0' }}>
                    Metrics that matter. TriSphere delivers measurable return on investment for your school.
                </p>
            </motion.div>
            
            <div style={{...styles.roiGrid, ...(isMobile ? styles.roiGridMobile : null)}}>
                {roiData.map((item, idx) => (
                    <motion.div 
                        key={idx}
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true, margin: '-50px' }}
                        transition={{ duration: 0.5, delay: idx * 0.1 }}
                        style={styles.roiCard}
                        whileHover={{ y: -5, boxShadow: '0 15px 35px -10px rgba(139, 92, 246, 0.3)' }}
                    >
                        <div style={styles.roiNumber}>{item.metric}</div>
                        <div style={styles.roiLabel}>{item.label}</div>
                    </motion.div>
                ))}
            </div>
        </section>
    );
};

const FAQSection = ({ isMobile }) => {
    const [activeIndex, setActiveIndex] = useState(null);
    return (
        <section style={{...styles.faqSection, ...(isMobile ? styles.faqSectionMobile : null)}}>
            <h2 style={{...styles.sectionTitle, ...(isMobile ? styles.sectionTitleMobile : null)}}>
                Frequently Asked Questions
            </h2>
            <div style={styles.faqList}>
                {faqData.map((faq, index) => (
                    <FAQItem 
                        key={index} 
                        faq={faq} 
                        index={index} 
                        activeIndex={activeIndex} 
                        setActiveIndex={setActiveIndex} 
                    />
                ))}
            </div>
        </section>
    );
};

const styles = {
    pageWrapper: {
        minHeight: '100vh',
        overflowX: 'hidden',
        fontFamily: '"Product Sans", "Google Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#ffffff'
    },
    mainContent: {
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
    },
    heroSection: {
        padding: '100px 20px',
        textAlign: 'center',
        maxWidth: '900px',
        width: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        minHeight: '80vh',
        justifyContent: 'center'
    },
    // Mobile: tighter padding, no forced 80vh (lets the page breathe and
    // keeps the CTA buttons in view without a long blank scroll).
    heroSectionMobile: {
        padding: '56px 16px 32px',
        minHeight: 'auto',
    },
    logo: {
        width: '180px',
        marginBottom: '30px',
        borderRadius: '24px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        border: '2px solid rgba(255,255,255,0.1)'
    },
    heroTitle: {
        fontSize: '3.5rem',
        fontWeight: '900',
        marginBottom: '20px',
        fontFamily: '"Google Sans", "Product Sans", sans-serif',
        background: 'linear-gradient(to bottom, #BF953F 0%, #FCF6BA 25%, #B38728 50%, #FBF5B7 75%, #AA771C 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        lineHeight: 1.1,
        filter: 'drop-shadow(0 0 15px rgba(184, 134, 11, 0.4))',
        textShadow: `
            0 1px 0 #8c6d1d,
            0 2px 0 #8c6d1d,
            0 3px 0 #8c6d1d,
            0 4px 0 #8c6d1d,
            0 5px 0 #a27c1f,
            0 6px 1px rgba(0,0,0,.1),
            0 0 5px rgba(0,0,0,.1),
            0 1px 3px rgba(0,0,0,.3),
            0 3px 5px rgba(0,0,0,.2),
            0 5px 10px rgba(0,0,0,.25),
            0 10px 10px rgba(0,0,0,.2),
            0 20px 20px rgba(0,0,0,.15)
        `
    },
    heroSubtitle: {
        fontSize: '1.25rem',
        color: '#94a3b8',
        marginBottom: '40px',
        maxWidth: '700px'
    },
    heroSubtitleMobile: {
        fontSize: '0.98rem',
        marginBottom: 28,
        lineHeight: 1.55,
        // Constrain to viewport so the text wraps cleanly within the
        // horizontal padding rather than overflowing on the right.
        maxWidth: '100%',
        paddingLeft: 4,
        paddingRight: 4,
    },
    // Mobile-only brand block rendered below the emblem (the AnimatedLogo's
    // built-in gradient-clipped wordmark was rendering invisibly on some
    // mobile browsers). These use plain solid colors and a simple
    // background-clip gradient — no -webkit-text-fill-color transparency,
    // so the text is always visible even if background-clip fails.
    heroBrandMobile: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
    },
    heroBrandNameMobile: {
        margin: 0,
        fontFamily: '"Google Sans", "Product Sans", "Inter", sans-serif',
        fontSize: 38,
        fontWeight: 800,
        letterSpacing: '-0.02em',
        lineHeight: 1,
        color: '#ffffff',
        textShadow: '0 2px 24px rgba(139, 92, 246, 0.45)',
    },
    heroBrandTaglineMobile: {
        fontSize: 11,
        fontWeight: 700,
        color: 'rgba(196, 181, 253, 0.85)',
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
    },
    buttonGroup: {
        display: 'flex',
        gap: '20px',
        flexWrap: 'wrap',
        justifyContent: 'center'
    },
    buttonGroupMobile: {
        gap: 12,
        width: '100%',
        flexDirection: 'column',
    },
    ctaButtonMobile: {
        width: '100%',
        padding: '14px 20px',
        fontSize: 16,
        boxSizing: 'border-box',
        textAlign: 'center',
    },
    primaryButton: {
        padding: '16px 32px',
        fontSize: '18px',
        fontWeight: '700',
        backgroundColor: '#3b82f6',
        color: '#fff',
        border: 'none',
        borderRadius: '12px',
        cursor: 'pointer',
        boxShadow: '0 10px 20px rgba(59, 130, 246, 0.3)',
        transition: 'all 0.3s ease'
    },
    secondaryButton: {
        padding: '16px 32px',
        fontSize: '18px',
        fontWeight: '700',
        backgroundColor: 'rgba(255,255,255,0.05)',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px',
        cursor: 'pointer',
        textDecoration: 'none',
        transition: 'all 0.3s ease'
    },
    section: {
        padding: '60px 20px',
        width: '100%',
        maxWidth: '1200px',
        boxSizing: 'border-box',
    },
    sectionMobile: {
        padding: '32px 16px',
    },
    emotionsBannerSection: {
        width: '100%',
        maxWidth: '1240px',
        padding: '40px 20px 80px',
        display: 'flex',
        justifyContent: 'center',
        boxSizing: 'border-box',
    },
    emotionsBannerSectionMobile: {
        padding: '24px 16px 40px',
    },
    emotionsBannerInner: {
        position: 'relative',
        width: '100%',
        borderRadius: '28px',
        overflow: 'hidden',
        // Subtle premium frame: soft purple glow + glass border so the
        // bright marketing image sits on the dark space backdrop without
        // looking like an abrupt rectangle drop.
        boxShadow:
            '0 20px 60px rgba(139, 92, 246, 0.25),' +
            ' 0 0 0 1px rgba(255, 255, 255, 0.08),' +
            ' inset 0 0 0 1px rgba(255, 255, 255, 0.04)',
        background: 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(20,184,166,0.04))',
        backdropFilter: 'blur(8px)',
    },
    emotionsBannerImage: {
        display: 'block',
        width: '100%',
        height: 'auto',
        objectFit: 'cover',
    },
    showcaseContainer: {
        display: 'flex',
        flexDirection: 'column',
        gap: '80px',
        width: '100%'
    },
    showcaseItem: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '60px',
        width: '100%'
    },
    showcaseItemMobile: {
        gap: '30px'
    },
    showcaseText: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center'
    },
    showcaseTextMobile: {
        alignItems: 'center',
        textAlign: 'center'
    },
    showcaseTitle: {
        fontSize: '2.5rem',
        fontWeight: '800',
        marginBottom: '20px',
        color: '#f8fafc',
        letterSpacing: '-0.02em',
        lineHeight: 1.2
    },
    showcaseTitleMobile: {
        fontSize: '1.8rem'
    },
    showcaseDescription: {
        fontSize: '1.2rem',
        color: '#94a3b8',
        lineHeight: 1.7
    },
    showcaseDescriptionMobile: {
        fontSize: '1.05rem'
    },
    showcaseVisual: {
        flex: 1,
        aspectRatio: '4/3',
        borderRadius: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid rgba(255,255,255,0.05)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(20px)',
        position: 'relative',
        overflow: 'hidden'
    },
    showcaseVisualMobile: {
        width: '100%',
        aspectRatio: '16/9',
        borderRadius: '24px'
    },
    showcaseImage: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        borderRadius: '32px'
    },
    showcaseImageMobile: {
        borderRadius: '24px'
    },
    textSection: {
        padding: '100px 20px',
        width: '100%',
        maxWidth: '1200px',
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: '40px',
        margin: '40px 0',
        boxSizing: 'border-box',
    },
    textSectionMobile: {
        padding: '48px 16px',
        margin: '20px 0',
        borderRadius: 24,
    },
    sectionTitle: {
        fontSize: '2.5rem',
        textAlign: 'center',
        marginBottom: '60px',
        fontWeight: '800'
    },
    sectionTitleMobile: {
        fontSize: '1.6rem',
        marginBottom: 28,
        lineHeight: 1.2,
    },
    tabsContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        maxWidth: '800px',
        margin: '0 auto',
        gap: '30px'
    },
    tabsContainerMobile: {
        gap: '20px'
    },
    tabList: {
        display: 'flex',
        justifyContent: 'center',
        gap: '12px',
        background: 'rgba(15, 23, 42, 0.6)',
        padding: '8px',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(10px)'
    },
    tabListMobile: {
        flexDirection: 'column',
        width: '100%',
        gap: '8px'
    },
    inactiveTab: {
        padding: '12px 24px',
        background: 'transparent',
        border: 'none',
        color: '#94a3b8',
        fontSize: '15px',
        fontWeight: '600',
        borderRadius: '10px',
        cursor: 'pointer',
        transition: 'all 0.3s ease'
    },
    activeTabStudents: {
        padding: '12px 24px',
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.05))',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        color: '#60a5fa',
        fontSize: '15px',
        fontWeight: '600',
        borderRadius: '10px',
        cursor: 'pointer',
        boxShadow: '0 4px 15px rgba(59, 130, 246, 0.15)'
    },
    activeTabTeachers: {
        padding: '12px 24px',
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(124, 58, 237, 0.05))',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        color: '#a78bfa',
        fontSize: '15px',
        fontWeight: '600',
        borderRadius: '10px',
        cursor: 'pointer',
        boxShadow: '0 4px 15px rgba(139, 92, 246, 0.15)'
    },
    activeTabParents: {
        padding: '12px 24px',
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.05))',
        border: '1px solid rgba(16, 185, 129, 0.3)',
        color: '#34d399',
        fontSize: '15px',
        fontWeight: '600',
        borderRadius: '10px',
        cursor: 'pointer',
        boxShadow: '0 4px 15px rgba(16, 185, 129, 0.15)'
    },
    activeTabAdmins: {
        padding: '12px 24px',
        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.05))',
        border: '1px solid rgba(245, 158, 11, 0.3)',
        color: '#fbbf24',
        fontSize: '15px',
        fontWeight: '600',
        borderRadius: '10px',
        cursor: 'pointer',
        boxShadow: '0 4px 15px rgba(245, 158, 11, 0.15)'
    },
    tabContentArea: {
        width: '100%',
        minHeight: '200px',
        padding: '40px',
        background: 'rgba(15, 23, 42, 0.4)',
        borderRadius: '24px',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        boxSizing: 'border-box'
    },
    tabContentAreaMobile: {
        padding: '24px',
        minHeight: '280px'
    },
    tabContentInner: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '20px'
    },
    tabContentTitle: {
        margin: 0,
        fontSize: '1.6rem',
        fontWeight: '800'
    },
    tabContentText: {
        margin: 0,
        fontSize: '1.1rem',
        color: '#cbd5e1',
        lineHeight: 1.8,
        maxWidth: '600px'
    },
    stickyHeader: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '72px',
        background: 'rgba(8, 11, 28, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 40px',
        zIndex: 50,
        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.3)'
    },
    stickyHeaderMobile: {
        padding: '0 20px',
        height: '64px'
    },
    headerLogoRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        cursor: 'pointer'
    },
    headerLogo: {
        width: '32px',
        height: '32px',
        objectFit: 'contain',
        filter: 'drop-shadow(0 0 8px rgba(139,92,246,0.5))'
    },
    headerBrand: {
        fontFamily: '"Google Sans", "Product Sans", sans-serif',
        fontSize: '20px',
        fontWeight: '700',
        letterSpacing: '-0.01em',
        color: '#ffffff',
        textShadow: '0 0 10px rgba(196, 181, 253, 0.3)'
    },
    headerLinks: {
        display: 'flex',
        gap: '30px',
        alignItems: 'center'
    },
    headerLink: {
        color: '#cbd5e1',
        textDecoration: 'none',
        fontSize: '15px',
        fontWeight: '600',
        transition: 'color 0.2s',
        cursor: 'pointer'
    },
    headerLoginBtn: {
        padding: '8px 20px',
        background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: '700',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
    },
    // ── Footer (rebuilt) ──────────────────────────────────────────────────
    // Clean two-tier layout: brand statement (left) + 3 link columns
    // (right), then a subtle bottom bar with copyright. All links share one
    // typography style so nothing screams for attention.
    footer: {
        padding: '80px 20px 28px',
        width: '100%',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        background:
            'linear-gradient(180deg, rgba(15, 23, 42, 0.0) 0%, rgba(8, 11, 28, 0.85) 50%, rgba(8, 11, 28, 0.95) 100%)',
        boxSizing: 'border-box',
    },
    footerMobile: {
        padding: '48px 16px 22px',
    },
    footerContent: {
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 48,
    },
    footerContentMobile: {
        gap: 28,
    },
    footerTop: {
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: '40px',
        alignItems: 'flex-start',
    },
    // On mobile collapse to a single column so the link section sits BELOW
    // the brand block instead of getting pushed off the right edge of the
    // viewport.
    footerTopMobile: {
        flexDirection: 'column',
        gap: '40px',
    },
    // Brand block (left column)
    footerBrandCol: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        maxWidth: '320px',
    },
    footerBrandRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
    },
    footerBrandMark: {
        width: 40,
        height: 40,
        objectFit: 'contain',
        filter: 'drop-shadow(0 0 12px rgba(139,92,246,0.45))',
    },
    footerBrandName: {
        fontFamily: '"Google Sans", "Product Sans", sans-serif',
        fontSize: 22,
        fontWeight: 700,
        letterSpacing: '-0.01em',
        color: '#c4b5fd',
        textShadow: '0 0 10px rgba(196, 181, 253, 0.3)',
    },
    footerBrandTag: {
        color: '#94a3b8',
        fontSize: 14,
        lineHeight: 1.6,
        margin: 0,
        maxWidth: 320,
    },
    footerPoweredRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginTop: 4,
        padding: '8px 12px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 999,
        width: 'fit-content',
    },
    footerPoweredLogo: {
        width: 22,
        height: 22,
        borderRadius: 6,
        objectFit: 'cover',
    },
    footerPoweredText: {
        fontSize: 12,
        color: '#cbd5e1',
        letterSpacing: 0.4,
    },
    // Right side: three link columns
    footerLinksCols: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '60px',
    },
    // 2-column on phones reads better than 3 narrow columns (and keeps the
    // headings + links from word-wrapping mid-label).
    footerLinksColsMobile: {
        gap: '30px',
        flexDirection: 'column',
        width: '100%',
    },
    footerCol: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
    },
    footerColHeading: {
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 2,
        color: '#c4b5fd',
        marginBottom: 6,
        marginTop: 0,
    },
    footerLink: {
        color: '#94a3b8',
        textDecoration: 'none',
        fontSize: 14,
        fontWeight: 500,
        lineHeight: 1.5,
        transition: 'color 0.2s ease',
        cursor: 'pointer',
    },
    // Bottom bar
    footerBottom: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        paddingTop: 24,
        borderTop: '1px solid rgba(255,255,255,0.06)',
    },
    footerBottomMobile: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 6,
        paddingTop: 18,
    },
    footerCopy: {
        color: '#64748b',
        fontSize: 12.5,
        letterSpacing: 0.2,
    },
    footerMadeIn: {
        color: '#64748b',
        fontSize: 12.5,
        letterSpacing: 0.2,
    },
    roiSection: {
        padding: '100px 20px',
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    roiSectionMobile: {
        padding: '60px 20px',
    },
    roiGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '24px',
        width: '100%',
    },
    roiGridMobile: {
        gridTemplateColumns: '1fr',
        gap: '16px',
    },
    roiCard: {
        background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.4), rgba(15, 23, 42, 0.4))',
        border: '1px solid rgba(139, 92, 246, 0.2)',
        borderRadius: '24px',
        padding: '32px 24px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        transition: 'all 0.3s ease',
    },
    roiNumber: {
        fontSize: '3.2rem',
        fontWeight: '800',
        color: '#c4b5fd',
        textShadow: '0 0 20px rgba(196, 181, 253, 0.4)',
        marginBottom: '16px',
        fontFamily: '"Google Sans", "Product Sans", sans-serif',
    },
    roiLabel: {
        fontSize: '1rem',
        color: '#e2e8f0',
        lineHeight: 1.5,
        fontWeight: '500',
    },
    faqSection: {
        padding: '100px 20px',
        width: '100%',
        maxWidth: '800px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
    },
    faqSectionMobile: {
        padding: '60px 16px',
    },
    faqList: {
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
    },
    faqItem: {
        background: 'rgba(15, 23, 42, 0.4)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        borderRadius: '16px',
        overflow: 'hidden'
    },
    faqButton: {
        width: '100%',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '24px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left'
    },
    faqQuestion: {
        fontSize: '1.1rem',
        fontWeight: '600',
        transition: 'color 0.2s',
        marginRight: '20px',
        fontFamily: 'inherit'
    },
    faqIcon: {
        fontSize: '0.9rem',
        color: '#94a3b8',
        transition: 'transform 0.3s ease',
        display: 'inline-block'
    },
    faqAnswer: {
        padding: '0 24px 24px',
        color: '#94a3b8',
        lineHeight: 1.6,
        fontSize: '1rem'
    },
    modalOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px'
    },
    modalContent: {
        background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95))',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(139, 92, 246, 0.15)',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '480px',
        maxHeight: '90vh',
        overflowY: 'auto',
        overflowX: 'hidden'
    },
    modalContentMobile: {
        borderRadius: '20px',
        maxHeight: '85vh'
    },
    modalHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '24px 32px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
    },
    modalTitle: {
        margin: 0,
        fontSize: '1.25rem',
        fontWeight: '700',
        color: '#f8fafc',
        fontFamily: '"Google Sans", "Product Sans", sans-serif'
    },
    modalCloseBtn: {
        background: 'transparent',
        border: 'none',
        color: '#94a3b8',
        fontSize: '1.25rem',
        cursor: 'pointer',
        padding: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'color 0.2s',
        ':hover': { color: '#f8fafc' }
    },
    modalForm: {
        padding: '32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
    },
    inputGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
    },
    inputLabel: {
        fontSize: '0.875rem',
        fontWeight: '600',
        color: '#cbd5e1'
    },
    modalInput: {
        width: '100%',
        padding: '12px 16px',
        background: 'rgba(15, 23, 42, 0.5)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        color: '#f8fafc',
        fontSize: '1rem',
        outline: 'none',
        transition: 'border-color 0.2s',
        boxSizing: 'border-box'
    },
    submitBtn: {
        width: '100%',
        padding: '14px',
        marginTop: '8px',
        background: 'linear-gradient(135deg, #8b5cf6 0%, #c084fc 100%)',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer',
        boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)',
        transition: 'transform 0.2s, box-shadow 0.2s',
    },
    modalSuccess: {
        padding: '48px 32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '16px'
    },
    successIcon: {
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        background: 'rgba(52, 211, 153, 0.1)',
        color: '#34d399',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '2rem',
        border: '2px solid #34d399'
    },
    successTitle: {
        margin: 0,
        fontSize: '1.5rem',
        color: '#f8fafc',
        fontWeight: '700'
    },
    successText: {
        margin: 0,
        color: '#94a3b8',
        lineHeight: 1.6
    },
    errorText: {
        color: '#ef4444',
        fontSize: '0.875rem',
        margin: 0
    },
};

export default LandingPage;
