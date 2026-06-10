import React from 'react';

export const TeacherStats = ({ stats, styles }) => {
    return (
        <div style={styles.statsContainer}>
            <div style={styles.statCard}>
                <div style={styles.statIcon}>👥</div>
                <div style={styles.statContent}>
                    <div style={styles.statValue}>{stats.totalStudents}</div>
                    <div style={styles.statLabel}>Students</div>
                </div>
            </div>
            <div style={styles.statCard}>
                <div style={styles.statIcon}>✅</div>
                <div style={styles.statContent}>
                    <div style={styles.statValue}>{stats.avgAttendance}%</div>
                    <div style={styles.statLabel}>Avg Attendance</div>
                </div>
            </div>
            <div style={styles.statCard}>
                <div style={styles.statIcon}>📝</div>
                <div style={styles.statContent}>
                    <div style={styles.statValue}>{stats.quizzesCompleted}</div>
                    <div style={styles.statLabel}>Quizzes</div>
                </div>
            </div>
        </div>
    );
};
