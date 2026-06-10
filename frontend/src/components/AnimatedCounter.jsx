/**
 * Animated Counter Component
 * Smooth counting animation for XP, stats, and numbers
 */
import React, { useState, useEffect, useRef } from 'react';

export const AnimatedCounter = ({
    value,
    duration = 1000,
    prefix = '',
    suffix = '',
    className = '',
    style = {},
    onComplete = null
}) => {
    const [count, setCount] = useState(0);
    const prevValue = useRef(0);
    const startTime = useRef(null);
    const animationFrame = useRef(null);

    useEffect(() => {
        const startValue = prevValue.current;
        const endValue = value;
        const diff = endValue - startValue;

        if (diff === 0) return;

        startTime.current = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime.current;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function: easeOutExpo
            const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

            const currentValue = Math.round(startValue + (diff * easeProgress));
            setCount(currentValue);

            if (progress < 1) {
                animationFrame.current = requestAnimationFrame(animate);
            } else {
                prevValue.current = endValue;
                if (onComplete) onComplete();
            }
        };

        animationFrame.current = requestAnimationFrame(animate);

        return () => {
            if (animationFrame.current) {
                cancelAnimationFrame(animationFrame.current);
            }
        };
    }, [value, duration, onComplete]);

    return (
        <span className={className} style={style}>
            {prefix}{count.toLocaleString()}{suffix}
        </span>
    );
};

/**
 * XP Counter with glow effect on change
 */
export const XPCounter = ({ value, showGlow = true }) => {
    const [glowing, setGlowing] = useState(false);
    const prevValue = useRef(value);

    useEffect(() => {
        if (showGlow && value > prevValue.current) {
            setGlowing(true);
            const timer = setTimeout(() => setGlowing(false), 600);
            return () => clearTimeout(timer);
        }
        prevValue.current = value;
    }, [value, showGlow]);

    return (
        <div
            className={glowing ? 'xp-gain-animation' : ''}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.2))',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                borderRadius: '12px',
                transition: 'all 0.3s ease'
            }}
        >
            <span style={{ fontSize: '18px' }}>⭐</span>
            <AnimatedCounter
                value={value}
                duration={800}
                style={{
                    fontSize: '18px',
                    fontWeight: 700,
                    color: '#fbbf24'
                }}
            />
            <span style={{ fontSize: '12px', color: 'rgba(251, 191, 36, 0.7)' }}>XP</span>
        </div>
    );
};

/**
 * Stat Counter with icon
 */
export const StatCounter = ({ value, label, icon, color = '#60a5fa' }) => (
    <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px'
    }}>
        <span style={{ fontSize: '24px' }}>{icon}</span>
        <AnimatedCounter
            value={value}
            duration={1200}
            style={{
                fontSize: '24px',
                fontWeight: 800,
                color
            }}
        />
        <span style={{
            fontSize: '12px',
            color: '#94a3b8',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
        }}>
            {label}
        </span>
    </div>
);

/**
 * Streak Counter with fire animation
 */
export const StreakCounter = ({ value }) => {
    const isActive = value > 0;

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            background: isActive
                ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.1))'
                : 'rgba(30, 41, 59, 0.6)',
            border: `1px solid ${isActive ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
            borderRadius: '10px'
        }}>
            <span style={{
                fontSize: '20px',
                animation: isActive ? 'pulse 1.5s ease infinite' : 'none'
            }}>
                🔥
            </span>
            <AnimatedCounter
                value={value}
                duration={600}
                style={{
                    fontSize: '18px',
                    fontWeight: 700,
                    color: isActive ? '#fca5a5' : '#64748b'
                }}
            />
            <span style={{
                fontSize: '12px',
                color: isActive ? 'rgba(252, 165, 165, 0.7)' : '#64748b'
            }}>
                day streak
            </span>
        </div>
    );
};

export default AnimatedCounter;
