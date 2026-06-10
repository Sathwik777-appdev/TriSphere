/**
 * Page Transition Component
 * Smooth page transitions with Framer Motion
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Page transition variants
const pageVariants = {
    initial: {
        opacity: 0,
        y: 20,
    },
    in: {
        opacity: 1,
        y: 0,
    },
    out: {
        opacity: 0,
        y: -20,
    }
};

const pageTransition = {
    type: 'tween',
    ease: [0.4, 0, 0.2, 1], // smooth ease
    duration: 0.3
};

/**
 * Wrap content for smooth page-like transitions
 */
export const PageTransition = ({ children, key }) => (
    <motion.div
        key={key}
        initial="initial"
        animate="in"
        exit="out"
        variants={pageVariants}
        transition={pageTransition}
    >
        {children}
    </motion.div>
);

/**
 * Fade in up animation for individual elements
 */
export const FadeInUp = ({ children, delay = 0, duration = 0.4 }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
            delay,
            duration,
            ease: [0.4, 0, 0.2, 1]
        }}
    >
        {children}
    </motion.div>
);

/**
 * Scale in animation
 */
export const ScaleIn = ({ children, delay = 0 }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
            delay,
            duration: 0.3,
            ease: [0.175, 0.885, 0.32, 1.275] // bounce
        }}
    >
        {children}
    </motion.div>
);

/**
 * Staggered list container - use with StaggerItem children
 */
export const StaggerContainer = ({ children, staggerDelay = 0.05 }) => (
    <motion.div
        initial="hidden"
        animate="visible"
        variants={{
            visible: {
                transition: {
                    staggerChildren: staggerDelay
                }
            }
        }}
    >
        {children}
    </motion.div>
);

/**
 * Staggered list item - use inside StaggerContainer
 */
export const StaggerItem = ({ children }) => (
    <motion.div
        variants={{
            hidden: { opacity: 0, x: -20 },
            visible: {
                opacity: 1,
                x: 0,
                transition: {
                    duration: 0.3,
                    ease: [0.4, 0, 0.2, 1]
                }
            }
        }}
    >
        {children}
    </motion.div>
);

/**
 * Hover scale effect wrapper
 */
export const HoverScale = ({ children, scale = 1.02 }) => (
    <motion.div
        whileHover={{ scale }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.2 }}
    >
        {children}
    </motion.div>
);

/**
 * Tap feedback wrapper
 */
export const TapFeedback = ({ children, onClick }) => (
    <motion.div
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        style={{ cursor: 'pointer' }}
    >
        {children}
    </motion.div>
);

/**
 * Slide in from side
 */
export const SlideIn = ({ children, direction = 'left', delay = 0 }) => {
    const x = direction === 'left' ? -50 : 50;

    return (
        <motion.div
            initial={{ opacity: 0, x }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        >
            {children}
        </motion.div>
    );
};

/**
 * Pop animation (for achievements, badges)
 */
export const PopIn = ({ children, delay = 0 }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.3 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
            delay,
            duration: 0.4,
            type: 'spring',
            stiffness: 300,
            damping: 15
        }}
    >
        {children}
    </motion.div>
);

export default PageTransition;
