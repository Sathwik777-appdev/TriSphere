import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { successToast, errorToast } from '../utils/toast';

export const TeacherMeetingsPanel = ({ userId }) => {
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('pending'); // pending, upcoming, past

    useEffect(() => {
        const fetchMeetings = async () => {
            if (!userId) return;

            try {
                setLoading(true);
                const q = query(
                    collection(db, 'meetings'),
                    where('teacherId', '==', userId)
                );

                const snapshot = await getDocs(q);
                const meetingList = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    scheduledAt: doc.data().scheduledAt?.toDate() || new Date(doc.data().scheduledAt)
                }));

                // Sort by date desc
                meetingList.sort((a, b) => b.scheduledAt - a.scheduledAt);
                setMeetings(meetingList);
            } catch (error) {
                console.error('Error fetching meetings:', error);
                errorToast('Failed to load meetings');
            } finally {
                setLoading(false);
            }
        };

        fetchMeetings();
    }, [userId]);

    const handleStatusUpdate = async (meetingId, newStatus) => {
        try {
            const meetingRef = doc(db, 'meetings', meetingId);
            await updateDoc(meetingRef, { status: newStatus });

            setMeetings(prev => prev.map(m =>
                m.id === meetingId ? { ...m, status: newStatus } : m
            ));

            successToast(`Meeting ${newStatus}`);
        } catch (error) {
            console.error('Error updating meeting status:', error);
            errorToast('Failed to update status');
        }
    };

    const getFilteredMeetings = () => {
        const now = new Date();
        switch (activeTab) {
            case 'pending':
                return meetings.filter(m => m.status === 'scheduled' && m.scheduledAt >= now);
            case 'upcoming':
                return meetings.filter(m => m.status === 'accepted' && m.scheduledAt >= now);
            case 'past':
                return meetings.filter(m => m.scheduledAt < now || ['rejected', 'cancelled', 'completed'].includes(m.status));
            default:
                return meetings;
        }
    };

    const filteredMeetings = getFilteredMeetings();

    if (loading) {
        return <div style={styles.loading}>Loading meetings...</div>;
    }

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h2 style={styles.title}>📅 Parent Meetings</h2>
                <div style={styles.tabs}>
                    <button
                        style={{ ...styles.tab, ...(activeTab === 'pending' ? styles.activeTab : {}) }}
                        onClick={() => setActiveTab('pending')}
                    >
                        Pending Requests
                        {meetings.filter(m => m.status === 'scheduled' && m.scheduledAt >= new Date()).length > 0 && (
                            <span style={styles.badge}>{meetings.filter(m => m.status === 'scheduled' && m.scheduledAt >= new Date()).length}</span>
                        )}
                    </button>
                    <button
                        style={{ ...styles.tab, ...(activeTab === 'upcoming' ? styles.activeTab : {}) }}
                        onClick={() => setActiveTab('upcoming')}
                    >
                        Upcoming
                    </button>
                    <button
                        style={{ ...styles.tab, ...(activeTab === 'past' ? styles.activeTab : {}) }}
                        onClick={() => setActiveTab('past')}
                    >
                        Past / History
                    </button>
                </div>
            </div>

            <div style={styles.list}>
                {filteredMeetings.length === 0 ? (
                    <div style={styles.emptyState}>No {activeTab} meetings found</div>
                ) : (
                    filteredMeetings.map(meeting => (
                        <div key={meeting.id} style={styles.card}>
                            <div style={styles.cardHeader}>
                                <div style={styles.dateInfo}>
                                    <span style={styles.date}>
                                        {meeting.scheduledAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                    </span>
                                    <span style={styles.time}>
                                        {meeting.scheduledAt.toLocaleTimeString('en-US', { 
                                            hour: 'numeric', 
                                            minute: '2-digit', 
                                            hour12: true 
                                        })}
                                    </span>
                                    <span style={{
                                        ...styles.statusBadge,
                                        backgroundColor: getStatusColor(meeting.status),
                                        color: getStatusTextColor(meeting.status)
                                    }}>
                                        {meeting.status}
                                    </span>
                                </div>
                            </div>

                            <div style={styles.cardBody}>
                                <div style={styles.infoRow}>
                                    <span style={styles.label}>Parent:</span>
                                    <span style={styles.value}>{meeting.parentName}</span>
                                </div>
                                <div style={styles.infoRow}>
                                    <span style={styles.label}>Child:</span>
                                    <span style={styles.value}>{meeting.childName} (Class {meeting.childClass})</span>
                                </div>
                                {meeting.notes && (
                                    <div style={styles.notes}>
                                        <span style={styles.label}>Notes:</span>
                                        <p style={styles.noteText}>{meeting.notes}</p>
                                    </div>
                                )}
                            </div>

                            {activeTab === 'pending' && meeting.status === 'scheduled' && (
                                <div style={styles.actions}>
                                    <button
                                        onClick={() => handleStatusUpdate(meeting.id, 'accepted')}
                                        style={styles.acceptBtn}
                                    >
                                        ✅ Accept
                                    </button>
                                    <button
                                        onClick={() => handleStatusUpdate(meeting.id, 'rejected')}
                                        style={styles.rejectBtn}
                                    >
                                        ❌ Reject
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

const getStatusColor = (status) => {
    switch (status) {
        case 'scheduled': return 'rgba(59, 130, 246, 0.2)';
        case 'accepted': return 'rgba(16, 185, 129, 0.2)';
        case 'rejected': return 'rgba(239, 68, 68, 0.2)';
        case 'cancelled': return 'rgba(239, 68, 68, 0.2)';
        default: return 'rgba(107, 114, 128, 0.2)';
    }
};

const getStatusTextColor = (status) => {
    switch (status) {
        case 'scheduled': return '#60a5fa';
        case 'accepted': return '#34d399';
        case 'rejected': return '#f87171';
        case 'cancelled': return '#f87171';
        default: return '#9ca3af';
    }
};

const styles = {
    container: {
        padding: '20px',
        maxWidth: '1000px',
        margin: '0 auto',
        color: 'white',
        minHeight: '600px'
    },
    header: {
        marginBottom: '30px'
    },
    title: {
        fontSize: '24px',
        marginBottom: '20px'
    },
    loading: {
        textAlign: 'center',
        padding: '40px',
        color: '#9ca3af'
    },
    tabs: {
        display: 'flex',
        gap: '10px',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        padding: '4px',
        borderRadius: '8px',
        width: 'fit-content'
    },
    tab: {
        padding: '8px 16px',
        backgroundColor: 'transparent',
        border: 'none',
        color: '#9ca3af',
        cursor: 'pointer',
        borderRadius: '6px',
        fontSize: '14px',
        fontWeight: '500',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.2s'
    },
    activeTab: {
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        color: '#60a5fa'
    },
    badge: {
        backgroundColor: '#ef4444',
        color: 'white',
        fontSize: '11px',
        padding: '1px 6px',
        borderRadius: '10px',
        fontWeight: 'bold'
    },
    list: {
        display: 'grid',
        gap: '16px'
    },
    emptyState: {
        textAlign: 'center',
        padding: '40px',
        color: '#6b7280',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.05)'
    },
    card: {
        backgroundColor: 'rgba(30, 41, 59, 0.6)',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        transition: 'transform 0.2s',
        ':hover': {
            transform: 'translateY(-2px)'
        }
    },
    cardHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '16px'
    },
    dateInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap'
    },
    date: {
        fontSize: '16px',
        fontWeight: 'bold',
        color: '#e2e8f0'
    },
    time: {
        color: '#94a3b8',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '13px'
    },
    statusBadge: {
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: '600',
        textTransform: 'uppercase'
    },
    cardBody: {
        marginBottom: '20px'
    },
    infoRow: {
        display: 'flex',
        marginBottom: '8px',
        fontSize: '14px'
    },
    label: {
        color: '#94a3b8',
        width: '80px',
        flexShrink: 0
    },
    value: {
        color: '#e2e8f0',
        fontWeight: '500'
    },
    notes: {
        marginTop: '12px',
        padding: '12px',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        borderRadius: '6px'
    },
    noteText: {
        margin: '4px 0 0 0',
        color: '#cbd5e1',
        fontSize: '14px',
        fontStyle: 'italic'
    },
    actions: {
        display: 'flex',
        gap: '12px',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        paddingTop: '16px'
    },
    acceptBtn: {
        flex: 1,
        padding: '10px',
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        color: '#34d399',
        border: '1px solid rgba(16, 185, 129, 0.4)',
        borderRadius: '6px',
        cursor: 'pointer',
        fontWeight: '600',
        transition: 'all 0.2s',
        ':hover': {
            backgroundColor: 'rgba(16, 185, 129, 0.3)'
        }
    },
    rejectBtn: {
        flex: 1,
        padding: '10px',
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        color: '#f87171',
        border: '1px solid rgba(239, 68, 68, 0.4)',
        borderRadius: '6px',
        cursor: 'pointer',
        fontWeight: '600',
        transition: 'all 0.2s',
        ':hover': {
            backgroundColor: 'rgba(239, 68, 68, 0.3)'
        }
    }
};
