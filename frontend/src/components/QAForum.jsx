import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, Timestamp, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { db } from '../services/firebase';

export const QAForum = ({ itemId, userId, userName, userRole, schoolName }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyInputs, setReplyInputs] = useState({}); // commentId -> replyText
  const [loading, setLoading] = useState(false);
  const [activeReplyBox, setActiveReplyBox] = useState(null); // commentId

  useEffect(() => {
    fetchComments();
  }, [itemId]);

  const fetchComments = async () => {
    if (!itemId) return;
    try {
      const q = query(
        collection(db, 'qaDiscussions'),
        where('itemId', '==', itemId),
        where('schoolName', '==', schoolName || '')
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort by newest first
      data.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
        const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
        return dateB - dateA;
      });
      setComments(data);
    } catch (err) {
      console.error('Error fetching QA comments:', err);
    }
  };

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'qaDiscussions'), {
        itemId,
        schoolName: schoolName || '',
        userId,
        userName,
        userRole,
        message: newComment.trim(),
        createdAt: Timestamp.now(),
        verified: false,
        verifiedBy: '',
        replies: []
      });
      setNewComment('');
      fetchComments();
    } catch (err) {
      console.error('Error posting comment:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePostReply = async (commentId) => {
    const text = replyInputs[commentId];
    if (!text || !text.trim()) return;

    try {
      const commentRef = doc(db, 'qaDiscussions', commentId);
      await updateDoc(commentRef, {
        replies: arrayUnion({
          userId,
          userName,
          userRole,
          message: text.trim(),
          createdAt: new Date().toISOString()
        })
      });
      setReplyInputs(prev => ({ ...prev, [commentId]: '' }));
      setActiveReplyBox(null);
      fetchComments();
    } catch (err) {
      console.error('Error posting reply:', err);
    }
  };

  const handleVerify = async (commentId, verifiedState) => {
    if (userRole !== 'teacher' && userRole !== 'admin' && userRole !== 'principal' && userRole !== 'developer') return;
    try {
      const commentRef = doc(db, 'qaDiscussions', commentId);
      await updateDoc(commentRef, {
        verified: verifiedState,
        verifiedBy: verifiedState ? userName : ''
      });
      fetchComments();
    } catch (err) {
      console.error('Error verifying comment:', err);
    }
  };

  return (
    <div style={styles.container}>
      <h4 style={styles.title}>💬 Classroom Discussion Forum</h4>
      
      <form onSubmit={handlePostComment} style={styles.postForm}>
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Ask a question or share a thought on this topic..."
          style={styles.textarea}
          rows={3}
          disabled={loading}
        />
        <button type="submit" disabled={loading} style={styles.postBtn}>
          {loading ? 'Posting...' : 'Post Question'}
        </button>
      </form>

      <div style={styles.commentsList}>
        {comments.length === 0 ? (
          <p style={styles.noComments}>No discussions yet. Be the first to ask a question!</p>
        ) : (
          comments.map((comment) => {
            const isStaff = userRole === 'teacher' || userRole === 'admin' || userRole === 'principal' || userRole === 'developer';
            return (
              <div
                key={comment.id}
                style={{
                  ...styles.commentCard,
                  ...(comment.verified ? styles.verifiedCard : {})
                }}
              >
                <div style={styles.commentHeader}>
                  <div style={styles.authorInfo}>
                    <span style={styles.authorName}>{comment.userName}</span>
                    <span style={styles.authorRole}>{comment.userRole.toUpperCase()}</span>
                  </div>
                  <span style={styles.commentTime}>
                    {comment.createdAt?.toDate?.().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                
                <p style={styles.commentMessage}>{comment.message}</p>

                {comment.verified && (
                  <div style={styles.verifiedBadge}>
                    <span>✅ Verified Answer by {comment.verifiedBy || 'Staff'}</span>
                  </div>
                )}

                <div style={styles.commentActions}>
                  <button
                    onClick={() => setActiveReplyBox(activeReplyBox === comment.id ? null : comment.id)}
                    style={styles.actionBtn}
                  >
                    Reply ({comment.replies?.length || 0})
                  </button>
                  {isStaff && (
                    <button
                      onClick={() => handleVerify(comment.id, !comment.verified)}
                      style={{
                        ...styles.actionBtn,
                        color: comment.verified ? '#ef4444' : '#10b981'
                      }}
                    >
                      {comment.verified ? 'Unverify' : 'Verify Answer'}
                    </button>
                  )}
                </div>

                {/* Replies view */}
                {comment.replies && comment.replies.length > 0 && (
                  <div style={styles.repliesList}>
                    {comment.replies.map((reply, ridx) => (
                      <div key={ridx} style={styles.replyCard}>
                        <div style={styles.replyHeader}>
                          <span style={styles.replyAuthor}>{reply.userName}</span>
                          <span style={styles.replyRole}>{reply.userRole.toUpperCase()}</span>
                        </div>
                        <p style={styles.replyText}>{reply.message}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply box */}
                {activeReplyBox === comment.id && (
                  <div style={styles.replyBox}>
                    <input
                      type="text"
                      value={replyInputs[comment.id] || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setReplyInputs(prev => ({ ...prev, [comment.id]: val }));
                      }}
                      placeholder="Write a reply..."
                      style={styles.replyInput}
                    />
                    <button
                      onClick={() => handlePostReply(comment.id)}
                      style={styles.replyBtn}
                    >
                      Reply
                    </button>
                  </div>
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
    padding: '16px',
    background: 'rgba(15, 23, 42, 0.45)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '14px',
    color: '#f1f5f9',
  },
  title: {
    margin: '0 0 14px 0',
    fontSize: '14px',
    fontWeight: '700',
    color: '#cbd5e1',
    letterSpacing: '0.5px'
  },
  postForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '20px',
  },
  textarea: {
    width: '100%',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '10px',
    padding: '10px',
    fontFamily: 'inherit',
    fontSize: '13px',
    color: '#f1f5f9',
    outline: 'none',
    resize: 'vertical',
    boxSizing: 'border-box'
  },
  postBtn: {
    alignSelf: 'flex-end',
    padding: '8px 16px',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '700',
    fontSize: '12px',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)'
  },
  commentsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  noComments: {
    color: '#64748b',
    fontSize: '13px',
    fontStyle: 'italic',
    textAlign: 'center',
    margin: '20px 0'
  },
  commentCard: {
    padding: '14px',
    background: 'rgba(255, 255, 255, 0.025)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    textAlign: 'left'
  },
  verifiedCard: {
    borderLeft: '4px solid #10b981',
    background: 'rgba(16, 185, 129, 0.04)',
    borderColor: '#10b981'
  },
  commentHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  authorInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  authorName: {
    fontWeight: '700',
    fontSize: '13px',
    color: '#e2e8f0',
  },
  authorRole: {
    fontSize: '9px',
    background: 'rgba(99, 102, 241, 0.2)',
    color: '#a5b4fc',
    padding: '2px 6px',
    borderRadius: '4px',
    fontWeight: '800',
    letterSpacing: '0.5px'
  },
  commentTime: {
    fontSize: '11px',
    color: '#64748b',
  },
  commentMessage: {
    margin: '4px 0',
    fontSize: '13px',
    color: '#cbd5e1',
    lineHeight: '1.5',
    whiteSpace: 'pre-wrap'
  },
  commentActions: {
    display: 'flex',
    gap: '12px',
    marginTop: '4px',
  },
  actionBtn: {
    background: 'none',
    border: 'none',
    padding: 0,
    fontSize: '11px',
    fontWeight: '700',
    color: '#818cf8',
    cursor: 'pointer',
    outline: 'none',
  },
  verifiedBadge: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '11px',
    fontWeight: '700',
    color: '#34d399',
    background: 'rgba(52, 211, 153, 0.08)',
    padding: '6px 10px',
    borderRadius: '6px',
    alignSelf: 'flex-start',
  },
  repliesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    paddingLeft: '16px',
    borderLeft: '1px solid rgba(255, 255, 255, 0.06)',
    marginTop: '10px',
  },
  replyCard: {
    padding: '8px 10px',
    background: 'rgba(255, 255, 255, 0.015)',
    border: '1px solid rgba(255, 255, 255, 0.03)',
    borderRadius: '6px',
  },
  replyHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '4px',
  },
  replyAuthor: {
    fontWeight: '700',
    fontSize: '12px',
    color: '#cbd5e1',
  },
  replyRole: {
    fontSize: '8px',
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#94a3b8',
    padding: '1px 4px',
    borderRadius: '3px',
    fontWeight: '800',
  },
  replyText: {
    margin: 0,
    fontSize: '12px',
    color: '#94a3b8',
    lineHeight: '1.4',
  },
  replyBox: {
    display: 'flex',
    gap: '8px',
    marginTop: '10px',
  },
  replyInput: {
    flex: 1,
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '6px',
    padding: '6px 10px',
    fontSize: '12px',
    color: '#f1f5f9',
    outline: 'none',
  },
  replyBtn: {
    padding: '6px 12px',
    background: 'rgba(99, 102, 241, 0.2)',
    border: '1px solid rgba(99, 102, 241, 0.4)',
    color: '#c7d2fe',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
  }
};
