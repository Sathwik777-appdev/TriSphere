/**
 * Bottom Sheet Modal Component
 * iOS-style bottom sheet with swipe-to-dismiss and snap points
 */
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';

const BottomSheet = ({
    isOpen,
    onClose,
    title,
    children,
    snapPoints = ['50%', '90%'],
    initialSnap = 0
}) => {
    const [currentSnap, setCurrentSnap] = useState(initialSnap);
    const sheetRef = useRef(null);
    const dragControls = useDragControls();

    // Prevent body scroll when sheet is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Close on escape key
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    const getSnapHeight = () => {
        const snap = snapPoints[currentSnap] || '50%';
        return snap;
    };

    const handleDragEnd = (event, info) => {
        const velocity = info.velocity.y;
        const offset = info.offset.y;

        // If dragged down significantly or with high velocity, close
        if (offset > 100 || velocity > 500) {
            onClose();
        } else if (offset < -50 && currentSnap < snapPoints.length - 1) {
            // Dragged up - expand to next snap point
            setCurrentSnap(currentSnap + 1);
        } else if (offset > 50 && currentSnap > 0) {
            // Dragged down but not enough to close - shrink to previous snap
            setCurrentSnap(currentSnap - 1);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        style={styles.backdrop}
                    />

                    {/* Sheet */}
                    <motion.div
                        ref={sheetRef}
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                        drag="y"
                        dragControls={dragControls}
                        dragConstraints={{ top: 0 }}
                        dragElastic={{ top: 0, bottom: 0.5 }}
                        onDragEnd={handleDragEnd}
                        style={{
                            ...styles.sheet,
                            height: getSnapHeight()
                        }}
                    >
                        {/* Handle */}
                        <div
                            style={styles.handleContainer}
                            onPointerDown={(e) => dragControls.start(e)}
                        >
                            <div style={styles.handle} />
                        </div>

                        {/* Header */}
                        {title && (
                            <div style={styles.header}>
                                <h3 style={styles.title}>{title}</h3>
                                <button onClick={onClose} style={styles.closeBtn}>
                                    ✕
                                </button>
                            </div>
                        )}

                        {/* Content */}
                        <div style={styles.content}>
                            {children}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

const styles = {
    backdrop: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        zIndex: 2000,
        backdropFilter: 'blur(4px)'
    },
    sheet: {
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'linear-gradient(180deg, #0f172a, #1e293b)',
        borderRadius: '24px 24px 0 0',
        zIndex: 2001,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.5)',
        border: '1px solid rgba(59, 130, 246, 0.2)',
        borderBottom: 'none',
        touchAction: 'none'
    },
    handleContainer: {
        padding: '12px',
        cursor: 'grab',
        touchAction: 'none'
    },
    handle: {
        width: '40px',
        height: '4px',
        background: 'rgba(255, 255, 255, 0.3)',
        borderRadius: '2px',
        margin: '0 auto'
    },
    header: {
        padding: '0 20px 16px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    title: {
        margin: 0,
        fontSize: '18px',
        fontWeight: 600,
        color: '#fff'
    },
    closeBtn: {
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        border: 'none',
        background: 'rgba(255, 255, 255, 0.1)',
        color: '#fff',
        fontSize: '14px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    content: {
        flex: 1,
        overflowY: 'auto',
        padding: '20px',
        paddingBottom: 'max(20px, env(safe-area-inset-bottom))'
    }
};

export default BottomSheet;
