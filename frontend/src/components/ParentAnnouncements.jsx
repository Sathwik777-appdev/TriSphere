import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../services/firebase';
import { safeLocalStorage } from '../utils/storage';

export const ParentAnnouncements = ({ childClass, parentId, schoolName }) => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const userData = safeLocalStorage.get('userData', {});
        const isDeveloper = userData?.role === 'developer';
        const schoolFilter = isDeveloper ? [] : [where('schoolName', '==', schoolName || '')];

        // Fetch all announcements from the collection for this school
        const snapshot = await getDocs(query(collection(db, 'announcements'), ...schoolFilter));

        // Filter announcements to show both admin and teacher announcements
        const announcementsData = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          .filter(announcement => {
            // Show admin announcements (have targetAudience field)
            if (announcement.targetAudience) {
              return announcement.targetAudience === 'all' || announcement.targetAudience === 'parents';
            }
            // Show teacher announcements (have class field matching child's class)
            if (announcement.class) {
              return announcement.class === childClass;
            }
            return false;
          })
          .sort((a, b) => {
            const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
            const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
            return dateB - dateA;
          });

        setAnnouncements(announcementsData);

        // Mark as seen by parent
        for (const announcement of announcementsData) {
          if (!announcement.seenByParents?.includes(parentId)) {
            try {
              await updateDoc(doc(db, 'announcements', announcement.id), {
                seenByParents: arrayUnion(parentId)
              });
            } catch (error) {
              console.error('Error marking announcement as seen:', error);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching announcements:', error);
      } finally {
        setLoading(false);
      }
    };

    if (parentId && childClass) {
      fetchAnnouncements();

      // Refresh every 30 seconds
      const interval = setInterval(fetchAnnouncements, 30000);
      return () => clearInterval(interval);
    }
  }, [childClass, parentId]);

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate?.() || new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
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
      <h3>📢 School Announcements</h3>

      {announcements.length > 0 ? (
        <div style={styles.announcementsList}>
          {announcements.map((ann) => (
            <div key={ann.id} style={styles.announcementCard}>
              <div style={styles.announcementTop}>
                <span style={{ fontSize: '24px', marginRight: '12px' }}>
                  {getAnnouncementIcon(ann.type)}
                </span>
                <div style={{ flex: 1 }}>
                  <h4 style={styles.announcementTitle}>{ann.title}</h4>
                  <div style={styles.announcementMeta}>
                    <span style={styles.date}>{formatDate(ann.createdAt)}</span>
                    <span style={styles.sender}> • Posted by {ann.createdByName || 'TriSphere Team'}</span>
                  </div>
                </div>
              </div>
              <p style={styles.announcementMessage}>{ann.message}</p>
              {ann.type === 'assignment' && (
                <div style={{
                  backgroundColor: '#fef3c7',
                  color: '#92400e',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  display: 'inline-block',
                  marginTop: '8px'
                }}>
                  📝 New Assignment
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p style={styles.noData}>No announcements for this class</p>
      )}
    </div>
  );
};

const styles = {
  container: {
    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 58, 95, 0.85))',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    padding: '20px',
    borderRadius: '12px',
    marginBottom: '20px',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    color: '#ffffff'
  },
  announcementsList: {
    marginTop: '15px'
  },
  announcementCard: {
    padding: '20px',
    background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.6), rgba(15, 23, 42, 0.8))',
    borderLeft: '4px solid #60a5fa',
    marginBottom: '16px',
    borderRadius: '10px',
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
    backdropFilter: 'blur(5px)'
  },
  announcementTop: {
    display: 'flex',
    alignItems: 'flex-start',
    marginBottom: '12px',
    gap: '8px'
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '16px'
  },
  oldAnnouncementTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px'
  },
  announcementTitle: {
    margin: 0,
    fontSize: '15px',
    fontWeight: '600',
    color: '#ffffff'
  },
  announcementMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: '4px'
  },
  date: {
    fontSize: '12px',
    color: '#60a5fa'
  },
  sender: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '400'
  },
  announcementMessage: {
    margin: '10px 0',
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: '1.5'
  },
  readButton: {
    padding: '8px 16px',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500'
  },
  noData: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontStyle: 'italic'
  }
};
