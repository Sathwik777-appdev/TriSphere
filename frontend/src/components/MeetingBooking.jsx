/**
 * Meeting Booking Component
 * Allows parents to schedule meetings with teachers
 */
import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, setDoc, getDoc, serverTimestamp, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { successToast, errorToast, warningToast } from '../utils/toast';

export const MeetingBooking = ({ childId, childName, childClass, schoolName }) => {
    const { user, userData } = useAuth();
    const [teachers, setTeachers] = useState([]);
    const [selectedTeacher, setSelectedTeacher] = useState(null);
    const [availableSlots, setAvailableSlots] = useState([]);
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedTime, setSelectedTime] = useState('');
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [booking, setBooking] = useState(false);
    const [notes, setNotes] = useState('');
    const [showBookingForm, setShowBookingForm] = useState(false);

    // Fetch teachers and existing meetings
    useEffect(() => {
        if (!user?.uid || !childClass) return;

        let unsubscribe;

        const fetchData = async () => {
            try {
                setLoading(true);

                const isDeveloper = userData?.role === 'developer';
                const schoolFilter = isDeveloper ? [] : [where('schoolName', '==', schoolName || '')];

                // Fetch teachers via /publicProfiles, not /users.
                //
                // Why: the /users `list` rule is restricted to staff
                // (teachers / admins / developers) because the doc holds
                // private fields (email, phone, FCM tokens, _tempPassword
                // mirror). Parents calling getDocs(...) on users → 'teacher'
                // returns permission-denied → empty list → "No teachers
                // available" in the UI.
                //
                // /publicProfiles is a Cloud-Function-maintained mirror of
                // just the safe fields (username, role, schoolName,
                // profilePhoto, …) and is readable by every signed-in
                // user. The doc id is the teacher's uid, so downstream
                // code that uses `selectedTeacher.id` keeps working.
                const teachersQuery = query(
                    collection(db, 'publicProfiles'),
                    where('role', '==', 'teacher'),
                    ...schoolFilter
                );
                const teachersSnapshot = await getDocs(teachersQuery);
                const teacherList = teachersSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setTeachers(teacherList);

                // Set up real-time listener for parent's meetings
                const meetingsQuery = query(
                    collection(db, 'meetings'),
                    where('parentId', '==', user.uid),
                    ...schoolFilter
                );

                unsubscribe = onSnapshot(meetingsQuery, (snapshot) => {
                    const meetingList = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));

                    // Sort by date
                    meetingList.sort((a, b) => {
                        const dateA = a.scheduledAt?.toDate?.() || new Date(a.scheduledAt);
                        const dateB = b.scheduledAt?.toDate?.() || new Date(b.scheduledAt);
                        return dateB - dateA;
                    });

                    setMeetings(meetingList);
                }, (error) => {
                    console.error('Error listening to meetings:', error);
                });

            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        // Cleanup listener on unmount
        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [user?.uid, childClass]);

    // Generate available time slots for next 14 days
    const generateTimeSlots = () => {
        const slots = [];
        const now = new Date();

        for (let day = 1; day <= 14; day++) {
            const date = new Date(now);
            date.setDate(date.getDate() + day);

            // Skip weekends
            if (date.getDay() === 0 || date.getDay() === 6) continue;

            const dateStr = date.toISOString().split('T')[0];

            // Available times: 2 PM - 5 PM, every 30 min
            const times = ['14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'];

            slots.push({
                date: dateStr,
                displayDate: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                times
            });
        }

        return slots;
    };

    // Handle teacher selection
    const handleTeacherSelect = (teacher) => {
        setSelectedTeacher(teacher);
        setAvailableSlots(generateTimeSlots());
        setShowBookingForm(true);
    };

    // Book meeting
    const bookMeeting = async () => {
        if (!selectedTeacher) {
            warningToast('Please select a teacher');
            return;
        }
        if (!selectedDate) {
            warningToast('Please select a date for the meeting');
            return;
        }
        if (!selectedTime) {
            warningToast('ACTION REQUIRED: Please select a specific time slot');
            return;
        }

        try {
            setBooking(true);

            const scheduledAt = new Date(`${selectedDate}T${selectedTime}:00`);
            const meetingId = `meeting_${user.uid}_${Date.now()}`;

            const meetingData = {
                parentId: user.uid,
                parentName: userData?.username || 'Parent',
                teacherId: selectedTeacher.id,
                teacherName: selectedTeacher.username || 'Teacher',
                childId: childId || '',
                childName: childName || '',
                childClass: childClass || '',
                schoolName: (userData?.role === 'developer') ? (selectedTeacher.schoolName || '') : (schoolName || ''),
                scheduledAt,
                duration: 30, // 30 minutes
                status: 'scheduled',
                notes: notes || '',
                createdAt: serverTimestamp()
            };

            await setDoc(doc(db, 'meetings', meetingId), meetingData);

            setMeetings(prev => [{
                id: meetingId,
                ...meetingData
            }, ...prev]);

            successToast('Meeting scheduled successfully!');
            setShowBookingForm(false);
            setSelectedTeacher(null);
            setSelectedDate('');
            setSelectedTime('');
            setNotes('');

        } catch (error) {
            console.error('Error booking meeting:', error);
            errorToast('Failed to book meeting');
        } finally {
            setBooking(false);
        }
    };

    // Cancel meeting
    const cancelMeeting = async (meetingId) => {
        try {
            await setDoc(doc(db, 'meetings', meetingId), { status: 'cancelled' }, { merge: true });
            setMeetings(prev => prev.map(m =>
                m.id === meetingId ? { ...m, status: 'cancelled' } : m
            ));
            successToast('Meeting cancelled');
        } catch (error) {
            console.error('Error cancelling meeting:', error);
        }
    };

    // Get status color
    const getStatusStyle = (status) => {
        const styles = {
            scheduled: { bg: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', text: 'Scheduled' },
            accepted: { bg: 'rgba(16, 185, 129, 0.2)', color: '#10b981', text: 'Accepted' },
            rejected: { bg: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', text: 'Rejected' },
            completed: { bg: 'rgba(107, 114, 128, 0.2)', color: '#9ca3af', text: 'Completed' },
            cancelled: { bg: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', text: 'Cancelled' }
        };
        return styles[status] || styles.scheduled;
    };

    if (loading) {
        return (
            <div style={styles.container}>
                <div style={styles.loading}>Loading...</div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <div>
                    <h3 style={styles.title}>📅 Parent-Teacher Meetings</h3>
                    <p style={styles.subtitle}>Schedule meetings with {childName}'s teachers</p>
                </div>
                {!showBookingForm && (
                    <button
                        onClick={() => setShowBookingForm(true)}
                        style={styles.newMeetingBtn}
                    >
                        + New Meeting
                    </button>
                )}
            </div>

            {/* Booking Form */}
            {showBookingForm && (
                <div style={styles.bookingForm}>
                    <div style={styles.formHeader}>
                        <h4 style={styles.formTitle}>Book a Meeting</h4>
                        <button
                            onClick={() => setShowBookingForm(false)}
                            style={styles.closeBtn}
                        >
                            ✕
                        </button>
                    </div>

                    {/* Step 1: Select Teacher */}
                    {!selectedTeacher ? (
                        <div style={styles.teacherGrid}>
                            <p style={styles.stepLabel}>Step 1: Select a Teacher</p>
                            {teachers.length === 0 ? (
                                <p style={styles.emptyText}>No teachers available</p>
                            ) : (
                                teachers.map(teacher => (
                                    <div
                                        key={teacher.id}
                                        onClick={() => handleTeacherSelect(teacher)}
                                        style={styles.teacherCard}
                                    >
                                        <div style={styles.teacherAvatar}>👨‍🏫</div>
                                        <div style={styles.teacherInfo}>
                                            <p style={styles.teacherName}>{teacher.username}</p>
                                            <p style={styles.teacherSubject}>{teacher.subject || 'All Subjects'}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Selected Teacher */}
                            <div style={styles.selectedTeacher}>
                                <span style={styles.teacherAvatar}>👨‍🏫</span>
                                <span style={styles.teacherName}>{selectedTeacher.username}</span>
                                <button
                                    onClick={() => setSelectedTeacher(null)}
                                    style={styles.changeBtn}
                                >
                                    Change
                                </button>
                            </div>

                            {/* Step 2: Select Date/Time */}
                            <div style={styles.dateTimeSection}>
                                <p style={styles.stepLabel}>Step 2: Select Date & Time</p>

                                <div style={styles.dateGrid}>
                                    {availableSlots.map(slot => (
                                        <button
                                            key={slot.date}
                                            onClick={() => setSelectedDate(slot.date)}
                                            style={{
                                                ...styles.dateBtn,
                                                ...(selectedDate === slot.date ? styles.dateBtnActive : {})
                                            }}
                                        >
                                            {slot.displayDate}
                                        </button>
                                    ))}
                                </div>

                                {selectedDate && (
                                    <div style={styles.timeGrid}>
                                        {availableSlots.find(s => s.date === selectedDate)?.times.map(time => (
                                            <button
                                                key={time}
                                                onClick={() => setSelectedTime(time)}
                                                style={{
                                                    ...styles.timeBtn,
                                                    ...(selectedTime === time ? styles.timeBtnActive : {})
                                                }}
                                            >
                                                {/* Robust manual 24h to 12h conversion */}
                                                {(() => {
                                                    const [h, m] = time.split(':');
                                                    const hour = parseInt(h);
                                                    const ampm = hour >= 12 ? 'PM' : 'AM';
                                                    const h12 = hour % 12 || 12;
                                                    return `${h12}:${m} ${ampm}`;
                                                })()}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Step 3: Notes */}
                            <div style={styles.notesSection}>
                                <p style={styles.stepLabel}>Step 3: Add Notes (Optional)</p>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Topics you'd like to discuss..."
                                    style={styles.notesInput}
                                    rows={3}
                                />
                            </div>

                            {/* Book Button */}
                            <button
                                onClick={bookMeeting}
                                disabled={booking}
                                style={{
                                    ...styles.bookBtn,
                                    opacity: booking ? 0.7 : 1,
                                    cursor: booking ? 'wait' : 'pointer'
                                }}
                            >
                                {booking ? 'Booking...' : 'Book Meeting'}
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Upcoming Meetings */}
            <div style={styles.meetingsList}>
                <h4 style={styles.sectionTitle}>Your Meetings</h4>

                {meetings.length === 0 ? (
                    <div style={styles.empty}>
                        <p>No meetings scheduled yet</p>
                    </div>
                ) : (
                    meetings.map(meeting => {
                        const statusStyle = getStatusStyle(meeting.status);
                        const meetingDate = meeting.scheduledAt?.toDate?.() || new Date(meeting.scheduledAt);

                        return (
                            <div key={meeting.id} style={styles.meetingCard}>
                                <div style={styles.meetingMain}>
                                    <div style={styles.meetingIcon}>📅</div>
                                    <div style={styles.meetingInfo}>
                                        <p style={styles.meetingTeacher}>
                                            {meeting.teacherName}
                                            <span style={{
                                                ...styles.statusBadge,
                                                background: statusStyle.bg,
                                                color: statusStyle.color
                                            }}>
                                                {statusStyle.text}
                                            </span>
                                        </p>
                                        <p style={styles.meetingDate}>
                                            {meetingDate.toLocaleDateString('en-US', {
                                                weekday: 'long',
                                                month: 'short',
                                                day: 'numeric',
                                                hour: 'numeric',
                                                minute: '2-digit',
                                                hour12: true
                                            })}
                                        </p>
                                        <p style={styles.meetingChild}>
                                            Re: {meeting.childName} (Class {meeting.childClass})
                                        </p>
                                        {meeting.notes && (
                                            <p style={styles.meetingNotes}>📝 {meeting.notes}</p>
                                        )}
                                    </div>
                                </div>

                                {meeting.status === 'scheduled' && (
                                    <button
                                        onClick={() => cancelMeeting(meeting.id)}
                                        style={styles.cancelBtn}
                                    >
                                        Cancel
                                    </button>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

const styles = {
    container: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        backdropFilter: 'blur(10px)'
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
    },
    title: {
        margin: 0,
        fontSize: '20px',
        fontWeight: 700,
        color: '#ffffff'
    },
    subtitle: {
        margin: '4px 0 0 0',
        fontSize: '13px',
        color: '#94a3b8'
    },
    newMeetingBtn: {
        padding: '10px 20px',
        background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
        border: 'none',
        borderRadius: '8px',
        color: '#ffffff',
        fontSize: '14px',
        fontWeight: 600,
        cursor: 'pointer'
    },
    loading: {
        textAlign: 'center',
        padding: '40px',
        color: '#94a3b8'
    },
    bookingForm: {
        padding: '20px',
        background: 'rgba(30, 41, 59, 0.6)',
        borderRadius: '12px',
        marginBottom: '20px',
        border: '1px solid rgba(59, 130, 246, 0.3)'
    },
    formHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
    },
    formTitle: {
        margin: 0,
        fontSize: '16px',
        fontWeight: 600,
        color: '#ffffff'
    },
    closeBtn: {
        background: 'transparent',
        border: 'none',
        color: '#94a3b8',
        fontSize: '18px',
        cursor: 'pointer'
    },
    stepLabel: {
        margin: '0 0 12px 0',
        fontSize: '13px',
        fontWeight: 600,
        color: '#60a5fa'
    },
    teacherGrid: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
    },
    teacherCard: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px',
        background: 'rgba(59, 130, 246, 0.1)',
        borderRadius: '8px',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        cursor: 'pointer',
        transition: 'all 0.2s'
    },
    teacherAvatar: {
        fontSize: '28px'
    },
    teacherInfo: {
        flex: 1
    },
    teacherName: {
        margin: 0,
        fontSize: '14px',
        fontWeight: 600,
        color: '#ffffff'
    },
    teacherSubject: {
        margin: '2px 0 0 0',
        fontSize: '12px',
        color: '#94a3b8'
    },
    selectedTeacher: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '20px',
        padding: '12px',
        background: 'rgba(16, 185, 129, 0.1)',
        borderRadius: '8px',
        border: '1px solid rgba(16, 185, 129, 0.3)'
    },
    changeBtn: {
        marginLeft: 'auto',
        padding: '4px 12px',
        background: 'transparent',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        borderRadius: '4px',
        color: '#94a3b8',
        fontSize: '12px',
        cursor: 'pointer'
    },
    dateTimeSection: {
        marginBottom: '20px'
    },
    dateGrid: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        marginBottom: '16px'
    },
    dateBtn: {
        padding: '8px 12px',
        background: 'rgba(30, 41, 59, 0.8)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '6px',
        color: '#94a3b8',
        fontSize: '12px',
        cursor: 'pointer'
    },
    dateBtnActive: {
        background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
        border: '1px solid #3b82f6',
        color: '#ffffff'
    },
    timeGrid: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px'
    },
    timeBtn: {
        padding: '10px 18px',
        background: 'rgba(186, 230, 253, 0.12)',
        border: '1px solid rgba(186, 230, 253, 0.25)',
        borderRadius: '10px',
        color: '#bae6fd',
        fontSize: '13px',
        fontWeight: 600,
        cursor: 'pointer',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        transition: 'all 0.2s ease',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
    },
    timeBtnActive: {
        background: 'rgba(56, 189, 248, 0.35)',
        border: '1px solid rgba(56, 189, 248, 0.6)',
        color: '#ffffff',
        boxShadow: '0 0 20px rgba(56, 189, 248, 0.3)',
        transform: 'translateY(-1px)'
    },
    notesSection: {
        marginBottom: '20px'
    },
    notesInput: {
        width: '100%',
        padding: '12px',
        background: 'rgba(30, 41, 59, 0.8)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        color: '#ffffff',
        fontSize: '14px',
        resize: 'none',
        boxSizing: 'border-box'
    },
    bookBtn: {
        width: '100%',
        padding: '14px',
        background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
        border: 'none',
        borderRadius: '8px',
        color: '#ffffff',
        fontSize: '15px',
        fontWeight: 600,
        cursor: 'pointer'
    },
    meetingsList: {
        marginTop: '20px'
    },
    sectionTitle: {
        margin: '0 0 16px 0',
        fontSize: '16px',
        fontWeight: 600,
        color: '#ffffff'
    },
    empty: {
        textAlign: 'center',
        padding: '40px',
        color: '#64748b'
    },
    emptyText: {
        textAlign: 'center',
        color: '#64748b'
    },
    meetingCard: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: '16px',
        background: 'rgba(30, 41, 59, 0.6)',
        borderRadius: '12px',
        marginBottom: '12px',
        border: '1px solid rgba(255, 255, 255, 0.05)'
    },
    meetingMain: {
        display: 'flex',
        gap: '12px'
    },
    meetingIcon: {
        fontSize: '28px'
    },
    meetingInfo: {
        flex: 1
    },
    meetingTeacher: {
        margin: 0,
        fontSize: '15px',
        fontWeight: 600,
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
    },
    statusBadge: {
        padding: '2px 8px',
        borderRadius: '8px',
        fontSize: '11px',
        fontWeight: 600
    },
    meetingDate: {
        margin: '4px 0',
        fontSize: '13px',
        color: '#60a5fa'
    },
    meetingChild: {
        margin: 0,
        fontSize: '12px',
        color: '#94a3b8'
    },
    meetingNotes: {
        margin: '8px 0 0 0',
        fontSize: '12px',
        color: '#94a3b8',
        fontStyle: 'italic'
    },
    cancelBtn: {
        padding: '6px 12px',
        background: 'transparent',
        border: '1px solid rgba(239, 68, 68, 0.5)',
        borderRadius: '6px',
        color: '#ef4444',
        fontSize: '12px',
        cursor: 'pointer'
    }
};

export default MeetingBooking;
