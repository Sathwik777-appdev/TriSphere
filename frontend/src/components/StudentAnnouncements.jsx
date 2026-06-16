import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../services/firebase';
import { offlineDB, isOffline } from '../utils/offlineDB';
import { safeLocalStorage } from '../utils/storage';

const StudentAnnouncements = ({ userId, classNumber, schoolName }) => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        setLoading(true);

        // Check if offline - use cached data
        if (isOffline()) {
          console.log('📵 Offline mode - loading announcements from cache');
          try {
            const cachedAnnouncements = await offlineDB.getAnnouncements(classNumber, 'students');
            if (cachedAnnouncements.length > 0) {
              console.log('Found', cachedAnnouncements.length, 'cached announcements');
              // Sort by date (most recent first)
              cachedAnnouncements.sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt) || new Date(a.savedAt);
                const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt) || new Date(b.savedAt);
                return dateB - dateA;
              });
              setAnnouncements(cachedAnnouncements);
              setLoading(false);
              return;
            }
          } catch (cacheErr) {
            console.warn('Cache read failed:', cacheErr);
          }
          console.log('No cached announcements available');
          setAnnouncements([]);
          setLoading(false);
          return;
        }

        // Targeted queries
        const announcementsRef = collection(db, 'announcements');
        const userData = safeLocalStorage.get('userData', {});
        const isDeveloper = userData?.role === 'developer';
        const schoolFilter = isDeveloper ? [] : [where('schoolName', '==', schoolName || '')];

        // 1. Admin announcements for students
        const adminQuery = query(
          announcementsRef,
          where('targetAudience', 'in', ['all', 'students']),
          ...schoolFilter
        );

        // 2. Teacher announcements for this class
        const teacherQuery = query(
          announcementsRef,
          where('class', '==', classNumber),
          ...schoolFilter
        );

        const [adminSnap, teacherSnap] = await Promise.all([
          getDocs(adminQuery),
          getDocs(teacherQuery)
        ]);

        const adminAnnouncements = adminSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const teacherAnnouncements = teacherSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Merge and remove duplicates (though queries should be disjoint based on fields)
        const combined = [...adminAnnouncements, ...teacherAnnouncements];
        const uniqueMap = new Map();
        combined.forEach(a => uniqueMap.set(a.id, a));

        const announcementsData = Array.from(uniqueMap.values())
          .sort((a, b) => {
            const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
            const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
            return dateB - dateA;
          });

        setAnnouncements(announcementsData);

        // Cache for offline use
        if (announcementsData.length > 0) {
          try {
            await offlineDB.saveAnnouncements(announcementsData);
          } catch (cacheErr) {
            console.warn('Cache read failed:', cacheErr);
          }
        }

        // Efficiently mark as seen (only those NOT already seen)
        const unseen = announcementsData.filter(a => !a.seenByStudents?.includes(userId));
        if (unseen.length > 0) {
          await Promise.all(unseen.map(a =>
            updateDoc(doc(db, 'announcements', a.id), {
              seenByStudents: arrayUnion(userId)
            })
          ));
        }
      } catch (error) {
        console.error('Error fetching announcements:', error);
        // Try to load from cache on error
        try {
          const cachedAnnouncements = await offlineDB.getAnnouncements(classNumber, 'students');
          if (cachedAnnouncements.length > 0) {
            console.log('📦 Loaded', cachedAnnouncements.length, 'announcements from cache after fetch error');
            setAnnouncements(cachedAnnouncements);
            return;
          }
        } catch (cacheErr) {
          console.warn('Cache fallback failed:', cacheErr);
        }
      } finally {
        setLoading(false);
      }
    };

    if (userId && classNumber) {
      fetchAnnouncements();

      // Refresh every 30 seconds
      const interval = setInterval(fetchAnnouncements, 30000);
      return () => clearInterval(interval);
    }
  }, [userId, classNumber]);

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate?.() || new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const getAnnouncementIcon = (type) => {
    if (type === 'assignment') return '📋';
    if (type === 'urgent') return '🚨';
    return '📢';
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading announcements...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>📢 Announcements</h2>
        <span style={styles.badge}>{announcements.length} total</span>
      </div>

      {announcements.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>📭</div>
          <p style={styles.emptyText}>No announcements yet</p>
          <p style={styles.emptySubtext}>Your teacher will post updates here</p>
        </div>
      ) : (
        <div style={styles.announcementsList}>
          {announcements.map((announcement, index) => (
            <div
              key={announcement.id}
              style={{
                ...styles.announcementCard,
                animationDelay: `${index * 0.1}s`
              }}
            >
              <div style={styles.announcementHeader}>
                <div style={styles.announcementIconContainer}>
                  <span style={styles.announcementIcon}>
                    {getAnnouncementIcon(announcement.type)}
                  </span>
                </div>
                <div style={styles.announcementHeaderContent}>
                  <h3 style={styles.announcementTitle}>{announcement.title}</h3>
                  <div style={styles.announcementMeta}>
                    <span style={styles.announcementDate}>
                      {formatDate(announcement.createdAt)}
                    </span>
                    <span style={styles.announcementSender}>
                      • Posted by {announcement.createdByName || 'TriSphere Team'}
                    </span>
                  </div>
                </div>
              </div>
              <p style={styles.announcementMessage}>{announcement.message}</p>
              {announcement.type === 'assignment' && (
                <div style={styles.assignmentBadge}>
                  📝 New Assignment Posted
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 58, 95, 0.85))',
    borderRadius: '12px',
    padding: '24px',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    color: '#ffffff'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    paddingBottom: '16px',
    borderBottom: '2px solid rgba(59, 130, 246, 0.3)'
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#ffffff',
    margin: 0
  },
  badge: {
    background: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
    color: 'white',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600'
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '16px'
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    color: 'rgba(255, 255, 255, 0.6)'
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '16px'
  },
  emptyText: {
    fontSize: '18px',
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: '8px'
  },
  emptySubtext: {
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.6)'
  },
  announcementsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  announcementCard: {
    background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.6), rgba(15, 23, 42, 0.8))',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid rgba(59, 130, 246, 0.25)',
    transition: 'all 0.3s ease',
    animation: 'slideIn 0.4s ease',
    cursor: 'default'
  },
  announcementHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    marginBottom: '12px',
    gap: '12px'
  },
  announcementIconContainer: {
    flexShrink: 0
  },
  announcementIcon: {
    fontSize: '32px',
    display: 'block'
  },
  announcementHeaderContent: {
    flex: 1
  },
  announcementTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#ffffff',
    margin: '0 0 4px 0'
  },
  announcementMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '4px'
  },
  announcementDate: {
    fontSize: '12px',
    color: '#60a5fa',
    fontWeight: '500'
  },
  announcementSender: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '400'
  },
  announcementMessage: {
    fontSize: '15px',
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: '1.6',
    margin: '0 0 12px 0',
    whiteSpace: 'pre-wrap'
  },
  assignmentBadge: {
    display: 'inline-block',
    background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(245, 158, 11, 0.15))',
    color: '#fcd34d',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '600',
    marginTop: '8px',
    border: '1px solid rgba(251, 191, 36, 0.3)'
  }
};

export default StudentAnnouncements;
