/**
 * Discussion Forum Component
 * Class discussion board where students can ask questions and get answers
 */
import React, { useState, useEffect } from 'react';
import {
    collection, query, where, getDocs, addDoc, updateDoc,
    doc, orderBy, Timestamp, arrayUnion, increment
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { successToast, errorToast } from '../utils/toast';

export const DiscussionForum = ({ classNumber, subject }) => {
    const { user, userData } = useAuth();
    const [discussions, setDiscussions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showNewPost, setShowNewPost] = useState(false);
    const [newQuestion, setNewQuestion] = useState({ title: '', content: '' });
    const [replyContent, setReplyContent] = useState({});
    const [expandedPost, setExpandedPost] = useState(null);
    const [filter, setFilter] = useState('all'); // 'all', 'unanswered', 'mine'
    const [posting, setPosting] = useState(false);

    useEffect(() => {
        fetchDiscussions();
    }, [classNumber, subject, filter]);

    const fetchDiscussions = async () => {
        try {
            setLoading(true);

            let q = query(
                collection(db, 'discussions'),
                where('class', '==', parseInt(classNumber)),
                where('subject', '==', subject),
                orderBy('createdAt', 'desc')
            );

            const snapshot = await getDocs(q);
            let posts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Apply filters
            if (filter === 'unanswered') {
                posts = posts.filter(p => !p.replies || p.replies.length === 0);
            } else if (filter === 'mine') {
                posts = posts.filter(p => p.authorId === (userData?.uid || user?.uid));
            }

            setDiscussions(posts);
        } catch (err) {
            console.error('Error fetching discussions:', err);
            // If index not ready, try without orderBy
            if (err.code === 'failed-precondition') {
                try {
                    const q = query(
                        collection(db, 'discussions'),
                        where('class', '==', parseInt(classNumber)),
                        where('subject', '==', subject)
                    );
                    const snapshot = await getDocs(q);
                    let posts = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    posts.sort((a, b) => {
                        const dateA = a.createdAt?.toDate?.() || new Date(0);
                        const dateB = b.createdAt?.toDate?.() || new Date(0);
                        return dateB - dateA;
                    });
                    setDiscussions(posts);
                } catch (fallbackErr) {
                    console.error('Fallback fetch failed:', fallbackErr);
                }
            }
        } finally {
            setLoading(false);
        }
    };

    const handlePostQuestion = async () => {
        if (!newQuestion.title.trim() || !newQuestion.content.trim()) {
            errorToast('Please fill in both title and content');
            return;
        }

        setPosting(true);
        try {
            await addDoc(collection(db, 'discussions'), {
                title: newQuestion.title.trim(),
                content: newQuestion.content.trim(),
                authorId: userData?.uid || user?.uid,
                authorName: userData?.name || userData?.username || 'Student',
                authorRole: userData?.role || 'student',
                class: parseInt(classNumber),
                subject: subject,
                replies: [],
                likes: 0,
                likedBy: [],
                views: 0,
                createdAt: Timestamp.now(),
                resolved: false
            });

            successToast('Question posted! 🎉');
            setNewQuestion({ title: '', content: '' });
            setShowNewPost(false);
            fetchDiscussions();
        } catch (err) {
            console.error('Error posting question:', err);
            errorToast('Failed to post question');
        } finally {
            setPosting(false);
        }
    };

    const handleReply = async (discussionId) => {
        const content = replyContent[discussionId];
        if (!content?.trim()) {
            errorToast('Please enter a reply');
            return;
        }

        try {
            const reply = {
                id: Date.now().toString(),
                content: content.trim(),
                authorId: userData?.uid || user?.uid,
                authorName: userData?.name || userData?.username || 'User',
                authorRole: userData?.role || 'student',
                createdAt: new Date().toISOString(),
                likes: 0
            };

            await updateDoc(doc(db, 'discussions', discussionId), {
                replies: arrayUnion(reply)
            });

            successToast('Reply posted! 💬');
            setReplyContent({ ...replyContent, [discussionId]: '' });
            fetchDiscussions();
        } catch (err) {
            console.error('Error posting reply:', err);
            errorToast('Failed to post reply');
        }
    };

    const handleLike = async (discussionId) => {
        const userId = userData?.uid || user?.uid;
        const discussion = discussions.find(d => d.id === discussionId);

        if (discussion?.likedBy?.includes(userId)) {
            return; // Already liked
        }

        try {
            await updateDoc(doc(db, 'discussions', discussionId), {
                likes: increment(1),
                likedBy: arrayUnion(userId)
            });
            fetchDiscussions();
        } catch (err) {
            console.error('Error liking post:', err);
        }
    };

    const markResolved = async (discussionId) => {
        try {
            await updateDoc(doc(db, 'discussions', discussionId), {
                resolved: true
            });
            successToast('Marked as resolved ✅');
            fetchDiscussions();
        } catch (err) {
            console.error('Error marking resolved:', err);
        }
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate?.() || new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
        return date.toLocaleDateString();
    };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <div style={styles.headerLeft}>
                    <h3 style={styles.title}>💬 Discussion Forum</h3>
                    <span style={styles.subtitle}>{subject} • Class {classNumber}</span>
                </div>
                <button
                    onClick={() => setShowNewPost(!showNewPost)}
                    style={styles.newPostButton}
                >
                    ➕ Ask Question
                </button>
            </div>

            {/* Filters */}
            <div style={styles.filters}>
                {['all', 'unanswered', 'mine'].map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        style={{
                            ...styles.filterButton,
                            ...(filter === f ? styles.filterButtonActive : {})
                        }}
                    >
                        {f === 'all' ? '📚 All' : f === 'unanswered' ? '❓ Unanswered' : '👤 My Posts'}
                    </button>
                ))}
            </div>

            {/* New Post Form */}
            {showNewPost && (
                <div style={styles.newPostForm}>
                    <h4 style={styles.formTitle}>Ask a Question</h4>
                    <input
                        type="text"
                        placeholder="Question title (e.g., How do I solve quadratic equations?)"
                        value={newQuestion.title}
                        onChange={(e) => setNewQuestion({ ...newQuestion, title: e.target.value })}
                        style={styles.input}
                    />
                    <textarea
                        placeholder="Describe your question in detail..."
                        value={newQuestion.content}
                        onChange={(e) => setNewQuestion({ ...newQuestion, content: e.target.value })}
                        style={styles.textarea}
                        rows={4}
                    />
                    <div style={styles.formActions}>
                        <button onClick={() => setShowNewPost(false)} style={styles.cancelButton}>
                            Cancel
                        </button>
                        <button
                            onClick={handlePostQuestion}
                            style={styles.postButton}
                            disabled={posting}
                        >
                            {posting ? '⏳ Posting...' : '📤 Post Question'}
                        </button>
                    </div>
                </div>
            )}

            {/* Discussions List */}
            {loading ? (
                <div style={styles.loading}>Loading discussions...</div>
            ) : discussions.length === 0 ? (
                <div style={styles.empty}>
                    <span style={styles.emptyIcon}>💭</span>
                    <p style={styles.emptyText}>No discussions yet</p>
                    <p style={styles.emptySubtext}>Be the first to ask a question!</p>
                </div>
            ) : (
                <div style={styles.discussionsList}>
                    {discussions.map(post => (
                        <div
                            key={post.id}
                            style={{
                                ...styles.postCard,
                                ...(post.resolved ? styles.resolvedCard : {})
                            }}
                        >
                            <div style={styles.postHeader}>
                                <div style={styles.authorInfo}>
                                    <span style={styles.avatar}>
                                        {post.authorRole === 'teacher' ? '👨‍🏫' : '👨‍🎓'}
                                    </span>
                                    <div>
                                        <span style={styles.authorName}>{post.authorName}</span>
                                        <span style={styles.authorRole}>
                                            {post.authorRole === 'teacher' ? 'Teacher' : 'Student'}
                                        </span>
                                    </div>
                                </div>
                                <div style={styles.postMeta}>
                                    <span style={styles.time}>{formatTime(post.createdAt)}</span>
                                    {post.resolved && <span style={styles.resolvedBadge}>✅ Resolved</span>}
                                </div>
                            </div>

                            <h4 style={styles.postTitle}>{post.title}</h4>
                            <p style={styles.postContent}>{post.content}</p>

                            <div style={styles.postActions}>
                                <button
                                    onClick={() => handleLike(post.id)}
                                    style={{
                                        ...styles.actionButton,
                                        color: post.likedBy?.includes(userData?.uid || user?.uid) ? '#ef4444' : '#6b7280'
                                    }}
                                >
                                    ❤️ {post.likes || 0}
                                </button>
                                <button
                                    onClick={() => setExpandedPost(expandedPost === post.id ? null : post.id)}
                                    style={styles.actionButton}
                                >
                                    💬 {post.replies?.length || 0} replies
                                </button>
                                {post.authorId === (userData?.uid || user?.uid) && !post.resolved && (
                                    <button onClick={() => markResolved(post.id)} style={styles.resolveButton}>
                                        ✅ Mark Resolved
                                    </button>
                                )}
                            </div>

                            {/* Replies Section */}
                            {expandedPost === post.id && (
                                <div style={styles.repliesSection}>
                                    {post.replies?.map(reply => (
                                        <div key={reply.id} style={styles.replyCard}>
                                            <div style={styles.replyHeader}>
                                                <span style={styles.replyAvatar}>
                                                    {reply.authorRole === 'teacher' ? '👨‍🏫' : '👨‍🎓'}
                                                </span>
                                                <span style={styles.replyAuthor}>{reply.authorName}</span>
                                                <span style={styles.replyTime}>{formatTime(reply.createdAt)}</span>
                                            </div>
                                            <p style={styles.replyContent}>{reply.content}</p>
                                        </div>
                                    ))}

                                    {/* Reply Input */}
                                    <div style={styles.replyInputContainer}>
                                        <input
                                            type="text"
                                            placeholder="Write a reply..."
                                            value={replyContent[post.id] || ''}
                                            onChange={(e) => setReplyContent({
                                                ...replyContent,
                                                [post.id]: e.target.value
                                            })}
                                            style={styles.replyInput}
                                            onKeyPress={(e) => e.key === 'Enter' && handleReply(post.id)}
                                        />
                                        <button
                                            onClick={() => handleReply(post.id)}
                                            style={styles.replyButton}
                                        >
                                            ↵
                                        </button>
                                    </div>
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
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '12px'
    },
    headerLeft: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
    },
    title: {
        margin: 0,
        fontSize: '20px',
        fontWeight: '700',
        color: '#1f2937'
    },
    subtitle: {
        fontSize: '14px',
        color: '#6b7280'
    },
    newPostButton: {
        padding: '12px 24px',
        background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
        color: 'white',
        border: 'none',
        borderRadius: '10px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
    },
    filters: {
        display: 'flex',
        gap: '8px',
        marginBottom: '20px',
        flexWrap: 'wrap'
    },
    filterButton: {
        padding: '8px 16px',
        backgroundColor: '#f3f4f6',
        border: 'none',
        borderRadius: '8px',
        fontSize: '13px',
        fontWeight: '500',
        cursor: 'pointer',
        color: '#6b7280'
    },
    filterButtonActive: {
        backgroundColor: '#8b5cf6',
        color: 'white'
    },
    newPostForm: {
        backgroundColor: '#f9fafb',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '20px',
        border: '2px solid #e5e7eb'
    },
    formTitle: {
        margin: '0 0 16px 0',
        fontSize: '16px',
        fontWeight: '600'
    },
    input: {
        width: '100%',
        padding: '12px',
        border: '2px solid #e5e7eb',
        borderRadius: '8px',
        fontSize: '14px',
        marginBottom: '12px',
        boxSizing: 'border-box'
    },
    textarea: {
        width: '100%',
        padding: '12px',
        border: '2px solid #e5e7eb',
        borderRadius: '8px',
        fontSize: '14px',
        resize: 'vertical',
        fontFamily: 'inherit',
        boxSizing: 'border-box'
    },
    formActions: {
        display: 'flex',
        gap: '12px',
        justifyContent: 'flex-end',
        marginTop: '16px'
    },
    cancelButton: {
        padding: '10px 20px',
        backgroundColor: '#f3f4f6',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: '500'
    },
    postButton: {
        padding: '10px 20px',
        background: 'linear-gradient(135deg, #10b981, #059669)',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: '600'
    },
    loading: {
        textAlign: 'center',
        padding: '40px',
        color: '#6b7280'
    },
    empty: {
        textAlign: 'center',
        padding: '60px 20px'
    },
    emptyIcon: {
        fontSize: '48px',
        display: 'block',
        marginBottom: '12px'
    },
    emptyText: {
        fontSize: '18px',
        fontWeight: '600',
        color: '#374151',
        margin: '0 0 4px 0'
    },
    emptySubtext: {
        fontSize: '14px',
        color: '#6b7280',
        margin: 0
    },
    discussionsList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
    },
    postCard: {
        backgroundColor: '#f9fafb',
        borderRadius: '12px',
        padding: '20px',
        border: '2px solid #e5e7eb',
        transition: 'all 0.2s'
    },
    resolvedCard: {
        borderColor: '#10b981',
        backgroundColor: '#f0fdf4'
    },
    postHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px'
    },
    authorInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
    },
    avatar: {
        fontSize: '24px'
    },
    authorName: {
        fontWeight: '600',
        color: '#1f2937',
        display: 'block'
    },
    authorRole: {
        fontSize: '12px',
        color: '#6b7280'
    },
    postMeta: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    },
    time: {
        fontSize: '13px',
        color: '#9ca3af'
    },
    resolvedBadge: {
        padding: '4px 8px',
        backgroundColor: '#10b981',
        color: 'white',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: '600'
    },
    postTitle: {
        margin: '0 0 8px 0',
        fontSize: '16px',
        fontWeight: '600',
        color: '#1f2937'
    },
    postContent: {
        margin: '0 0 16px 0',
        fontSize: '14px',
        color: '#4b5563',
        lineHeight: '1.6'
    },
    postActions: {
        display: 'flex',
        gap: '16px',
        alignItems: 'center'
    },
    actionButton: {
        background: 'none',
        border: 'none',
        padding: '6px 12px',
        fontSize: '13px',
        color: '#6b7280',
        cursor: 'pointer',
        borderRadius: '6px'
    },
    resolveButton: {
        padding: '6px 12px',
        backgroundColor: '#10b981',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: '600',
        cursor: 'pointer'
    },
    repliesSection: {
        marginTop: '16px',
        paddingTop: '16px',
        borderTop: '1px solid #e5e7eb'
    },
    replyCard: {
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '12px',
        marginBottom: '10px',
        border: '1px solid #e5e7eb'
    },
    replyHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px'
    },
    replyAvatar: {
        fontSize: '16px'
    },
    replyAuthor: {
        fontWeight: '600',
        fontSize: '13px',
        color: '#1f2937'
    },
    replyTime: {
        fontSize: '12px',
        color: '#9ca3af',
        marginLeft: 'auto'
    },
    replyContent: {
        margin: 0,
        fontSize: '14px',
        color: '#4b5563'
    },
    replyInputContainer: {
        display: 'flex',
        gap: '8px',
        marginTop: '12px'
    },
    replyInput: {
        flex: 1,
        padding: '10px 12px',
        border: '2px solid #e5e7eb',
        borderRadius: '8px',
        fontSize: '14px'
    },
    replyButton: {
        padding: '10px 16px',
        background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: '600'
    }
};

export default DiscussionForum;
