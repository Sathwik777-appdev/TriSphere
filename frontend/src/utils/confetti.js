/**
 * Confetti Celebration Component
 * Trigger confetti for achievements, level ups, and celebrations
 */
import confetti from 'canvas-confetti';

// Color themes for different celebrations
const CONFETTI_COLORS = {
    default: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'],
    gold: ['#fbbf24', '#f59e0b', '#d97706', '#fcd34d'],
    achievement: ['#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe'],
    xp: ['#fbbf24', '#fcd34d', '#fef3c7'],
    success: ['#10b981', '#34d399', '#6ee7b7']
};

/**
 * Fire confetti celebration
 */
export const fireConfetti = (options = {}) => {
    const defaults = {
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: CONFETTI_COLORS.default,
        disableForReducedMotion: true
    };

    confetti({
        ...defaults,
        ...options
    });
};

/**
 * Gold/XP celebration
 */
export const fireGoldConfetti = () => {
    fireConfetti({
        particleCount: 80,
        spread: 60,
        colors: CONFETTI_COLORS.gold,
        shapes: ['circle', 'square'],
        scalar: 1.2
    });
};

/**
 * Achievement unlock celebration
 */
export const fireAchievementConfetti = () => {
    const count = 200;
    const defaults = {
        origin: { y: 0.7 },
        colors: CONFETTI_COLORS.achievement
    };

    function fire(particleRatio, opts) {
        confetti({
            ...defaults,
            particleCount: Math.floor(count * particleRatio),
            ...opts
        });
    }

    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1, { spread: 120, startVelocity: 45 });
};

/**
 * Level up celebration (from sides)
 */
export const fireLevelUpConfetti = () => {
    const end = Date.now() + 1000;
    const colors = CONFETTI_COLORS.gold;

    (function frame() {
        confetti({
            particleCount: 2,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors
        });
        confetti({
            particleCount: 2,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors
        });

        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    }());
};

/**
 * Success/completion celebration
 */
export const fireSuccessConfetti = () => {
    fireConfetti({
        particleCount: 60,
        spread: 50,
        colors: CONFETTI_COLORS.success,
        origin: { y: 0.7 }
    });
};

/**
 * Stars burst (for perfect scores)
 */
export const fireStarBurst = () => {
    const defaults = {
        spread: 360,
        ticks: 100,
        gravity: 0,
        decay: 0.94,
        startVelocity: 30,
        shapes: ['star'],
        colors: CONFETTI_COLORS.gold
    };

    confetti({
        ...defaults,
        particleCount: 50,
        scalar: 1.2,
        shapes: ['star']
    });

    confetti({
        ...defaults,
        particleCount: 25,
        scalar: 0.75,
        shapes: ['circle']
    });
};

/**
 * Emoji rain (for fun celebrations)
 */
export const fireEmojiConfetti = (emoji = '🎉') => {
    const scalar = 2;
    const emojiShape = confetti.shapeFromText({ text: emoji, scalar });

    confetti({
        shapes: [emojiShape],
        scalar,
        particleCount: 30,
        spread: 100,
        origin: { y: 0.6 }
    });
};

export default {
    fire: fireConfetti,
    gold: fireGoldConfetti,
    achievement: fireAchievementConfetti,
    levelUp: fireLevelUpConfetti,
    success: fireSuccessConfetti,
    stars: fireStarBurst,
    emoji: fireEmojiConfetti
};
