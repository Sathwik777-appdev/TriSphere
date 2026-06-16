import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { offlineAssetManager } from '../services/offlineAssetManager';
import { useOffline } from '../hooks/useOffline';
import { offlineDB } from '../utils/offlineDB';
import { BookIcon, CheckCircleIcon, TimerIcon } from './Icons';

export default function TextbookViewer({ selectedSubject }) {
  const { userData } = useAuth();
  const { offline } = useOffline();
  const [textbooks, setTextbooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState({});
  const [downloadProgress, setDownloadProgress] = useState({});

  useEffect(() => {
    let cancelled = false;
    const fetchTextbooks = async () => {
      const uClass = String(userData?.class || userData?.classNumber || '10');
      try {
        let books = [];
        if (offline) {
          const cached = await offlineDB.getAll('textbooks');
          books = cached.filter(b => String(b.class) === uClass && b.subject === selectedSubject);
        } else {
          const q = query(
            collection(db, 'textbooks'),
            where('class', '==', parseInt(uClass)),
            where('subject', '==', selectedSubject)
          );
          const snapshot = await getDocs(q);
          if (snapshot.empty) {
            // fallback string class
            const qStr = query(collection(db, 'textbooks'), where('class', '==', uClass), where('subject', '==', selectedSubject));
            const snapStr = await getDocs(qStr);
            books = snapStr.docs.map(d => ({ id: d.id, ...d.data() }));
          } else {
            books = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          }
          // Cache for metadata
          for (const b of books) await offlineDB.saveTextbook(b);
        }

        // Check local download status
        for (const book of books) {
          book.isDownloaded = offlineAssetManager.isDownloaded(book.id);
        }

        if (!cancelled) {
          setTextbooks(books);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error fetching textbooks:', err);
        if (!cancelled) setLoading(false);
      }
    };
    fetchTextbooks();
    return () => { cancelled = true; };
  }, [userData, selectedSubject, offline]);

  const handleDownload = async (book) => {
    if (!book.pdfURL) return alert('No PDF URL available');
    if (offline) return alert('You must be online to download textbooks.');

    setDownloading(prev => ({ ...prev, [book.id]: true }));
    setDownloadProgress(prev => ({ ...prev, [book.id]: 'Downloading...' }));
    
    try {
      await offlineAssetManager.downloadAsset(book.pdfURL, book.id, '.pdf');
      setTextbooks(prev => prev.map(b => b.id === book.id ? { ...b, isDownloaded: true } : b));
    } catch (err) {
      console.error('Download failed', err);
      alert('Download failed. Make sure you have enough storage.');
    } finally {
      setDownloading(prev => ({ ...prev, [book.id]: false }));
    }
  };

  const handleOpen = async (book) => {
    if (book.isDownloaded) {
      const localUri = await offlineAssetManager.getLocalUrl(book.id);
      if (localUri) {
        window.open(localUri, '_blank');
        return;
      }
    }
    
    // Fallback to web
    if (offline) {
      alert("This textbook is not downloaded for offline viewing.");
    } else {
      window.open(book.pdfURL, '_blank');
    }
  };

  if (loading) return <div style={{ padding: 20, color: '#fff' }}>Loading textbooks...</div>;

  if (textbooks.length === 0) {
    return (
      <div style={{ padding: 30, textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>
        <BookIcon size={48} color="rgba(255,255,255,0.2)" />
        <p style={{ marginTop: 15 }}>No textbooks uploaded for {selectedSubject} yet.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 15 }}>
      {textbooks.map(book => (
        <div key={book.id} style={styles.card}>
          <div style={styles.info}>
            <h4 style={styles.title}>{book.chapterName || 'Untitled Chapter'}</h4>
            <p style={styles.subtitle}>Original PDF Textbook</p>
          </div>
          
          <div style={styles.actions}>
            {book.isDownloaded ? (
              <span style={styles.badge}><CheckCircleIcon size={16} color="#10b981" /> Available Offline</span>
            ) : downloading[book.id] ? (
              <span style={styles.badge}><TimerIcon size={16} color="#3b82f6" /> {downloadProgress[book.id]}</span>
            ) : (
              <button style={styles.btnSecondary} onClick={() => handleDownload(book)}>
                Download
              </button>
            )}
            <button style={styles.btnPrimary} onClick={() => handleOpen(book)}>
              Read
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

const styles = {
  card: {
    background: 'linear-gradient(135deg, rgba(30, 41, 80, 0.55), rgba(15, 23, 42, 0.75))',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12
  },
  info: {},
  title: { margin: 0, color: '#fff', fontSize: 16, fontWeight: 600 },
  subtitle: { margin: '4px 0 0 0', color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  actions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8
  },
  badge: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    background: 'rgba(255,255,255,0.1)',
    padding: '4px 10px',
    borderRadius: 20
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
    border: 'none',
    color: '#fff',
    padding: '8px 16px',
    borderRadius: 8,
    fontWeight: 600,
    cursor: 'pointer'
  },
  btnSecondary: {
    background: 'transparent',
    border: '1px solid rgba(59, 130, 246, 0.5)',
    color: '#60a5fa',
    padding: '8px 16px',
    borderRadius: 8,
    fontWeight: 500,
    cursor: 'pointer'
  }
};
