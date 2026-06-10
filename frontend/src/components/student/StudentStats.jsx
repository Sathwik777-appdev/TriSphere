import React from 'react';
import { TargetIcon, TimerIcon, CheckCircleIcon, FireIcon } from '../../components/Icons';

export const StudentStats = ({ stats, themedStyles, styles }) => {
    return (
        <div style={styles.statsContainer}>
            <div style={{ ...styles.statCard, ...themedStyles.statCard }}>
                <div style={{ ...styles.statIcon, backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
                    <CheckCircleIcon size={24} color="#3b82f6" />
                </div>
                <div style={styles.statContent}>
                    <div style={{ ...styles.statValue, color: themedStyles.text.primary }}>{stats.tasksCompleted}</div>
                    <div style={{ ...styles.statLabel, color: themedStyles.text.muted }}>Tasks Done</div>
                </div>
            </div>

            <div style={{ ...styles.statCard, ...themedStyles.statCard }}>
                <div style={{ ...styles.statIcon, backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                    <TimerIcon size={24} color="#10b981" />
                </div>
                <div style={styles.statContent}>
                    <div style={{ ...styles.statValue, color: themedStyles.text.primary }}>{stats.studyHours}h</div>
                    <div style={{ ...styles.statLabel, color: themedStyles.text.muted }}>Study Time</div>
                </div>
            </div>

            <div style={{ ...styles.statCard, ...themedStyles.statCard }}>
                <div style={{ ...styles.statIcon, backgroundColor: 'rgba(245, 158, 11, 0.1)' }}>
                    <TargetIcon size={24} color="#f59e0b" />
                </div>
                <div style={styles.statContent}>
                    <div style={{ ...styles.statValue, color: themedStyles.text.primary }}>{stats.averageScore}%</div>
                    <div style={{ ...styles.statLabel, color: themedStyles.text.muted }}>Avg. Score</div>
                </div>
            </div>

            <div style={{ ...styles.statCard, ...themedStyles.statCard }}>
                <div style={{ ...styles.statIcon, backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                    <FireIcon size={24} color="#ef4444" />
                </div>
                <div style={styles.statContent}>
                    <div style={{ ...styles.statValue, color: themedStyles.text.primary }}>{stats.streak}</div>
                    <div style={{ ...styles.statLabel, color: themedStyles.text.muted }}>Day Streak</div>
                </div>
            </div>
        </div>
    );
};
