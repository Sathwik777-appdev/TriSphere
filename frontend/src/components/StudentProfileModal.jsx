import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ProfilePhoto } from './ProfilePhoto';
import { CloseIcon, TargetIcon, FireIcon } from './Icons';
import { BADGES } from '../utils/badges';

const AVATAR_MAP = {
    'avatar_robot': { name: 'Robot', img: '/avatars/robot.png', quality: 'legendary' },
    'avatar_wizard': { name: 'Wizard', img: '/avatars/wizard.png', quality: 'epic' },
    'avatar_astronaut': { name: 'Astronaut', img: '/avatars/astronaut.png', quality: 'epic' },
    'avatar_ninja': { name: 'Ninja', img: '/avatars/ninja.png', quality: 'rare' },
    'avatar_superhero': { name: 'Learn Hero', img: '/avatars/superhero.png', quality: 'rare' },
    'avatar_alien': { name: 'Space Explorer', img: '/avatars/alien.png', quality: 'rare' },
    'avatar_dragon': { name: 'Scholar Dragon', img: '/avatars/dragon.png', quality: 'legendary' },
    'avatar_unicorn': { name: 'Magic Unicorn', img: '/avatars/unicorn.png', quality: 'epic' },
    'avatar_shonen': { name: 'Shonen Hero', img: '/avatars/shonen_hero.png', quality: 'legendary' },
    'avatar_shinobi': { name: 'Mystic Shinobi', img: '/avatars/mystic_shinobi.png', quality: 'epic' },
    'avatar_ethereal': { name: 'Ethereal Spirit', img: '/avatars/ethereal_spirit.png', quality: 'legendary' },
    'avatar_inferno': { name: 'Inferno Knight', img: '/avatars/inferno_knight.jpg', quality: 'legendary' }
};

const VerifiedBadge = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginLeft: '4px' }}>
        <path d="M10.29 3.86L1.82 18.27C1.64545 18.5724 1.55298 18.915 1.55201 19.2635C1.55103 19.612 1.6416 19.9541 1.81451 20.2556C1.98741 20.5571 2.2364 20.8066 2.5361 20.9789C2.8358 21.1512 3.1754 21.2404 3.52 21.237H20.48C20.8246 21.2404 21.1642 21.1512 21.4639 20.9789C21.7636 20.8066 22.0126 20.5571 22.1855 20.2556C22.3584 19.9541 22.449 19.612 22.448 19.2635C22.447 18.915 22.3546 18.5724 22.18 18.27L13.71 3.86C13.535 3.55835 13.285 3.30883 12.985 3.13621C12.685 2.96359 12.345 2.87354 12 2.87451C11.655 2.87354 11.315 2.96359 11.015 3.13621C10.715 3.30883 10.465 3.55835 10.29 3.86Z" fill="#3B82F6" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 17L11 19L15 15" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export const StudentProfileModal = ({ student, onClose }) => {
    const [storeData, setStoreData] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStudentData = async () => {
            if (!student?.id) return;
            try {
                const storeDoc = await getDoc(doc(db, 'userStore', student.id));
                if (storeDoc.exists()) {
                    setStoreData(storeDoc.data());
                }
                const userDoc = await getDoc(doc(db, 'users', student.id));
                if (userDoc.exists()) {
                    setUserData(userDoc.data());
                }
            } catch (error) {
                console.error('Error fetching student store/user data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchStudentData();
    }, [student?.id]);

    if (!student) return null;

    const ownedAvatars = (storeData?.ownedItems || []).filter(id => id.startsWith('avatar_'));
    const level = Math.floor((storeData?.xpBalance || 0) / 1000) + 1;
    const currentXp = (storeData?.xpBalance || 0) % 1000;
    const progressToNextLevel = (currentXp / 1000) * 100;

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div className="profile-modal" style={styles.modal} onClick={e => e.stopPropagation()}>
                {/* Advanced Mesh Banner */}
                <div style={styles.banner}>
                    <div style={styles.bannerMesh} />
                    <div style={styles.bannerGlass} />
                    <div 
                        style={styles.closeBtn} 
                        onClick={onClose}
                        role="button"
                        aria-label="Close Profile"
                    >
                        <CloseIcon size={20} color="#fff" />
                    </div>
                    <div style={styles.schoolBadge}>
                        <span style={styles.schoolIcon}>🏫</span>
                        <span style={styles.schoolName}>{student.schoolName || 'Trinity Central Academy'}</span>
                    </div>
                </div>

                <div style={styles.header}>
                    <div style={styles.photoWrapper}>
                        <div style={styles.photoGlow} />
                        <div style={styles.photoRing}>
                            <ProfilePhoto size={140} editable={false} userData={student} uid={student.id} />
                        </div>
                        <div style={styles.levelIndicator}>
                            <span style={styles.levelTitle}>LVL</span>
                            <span style={styles.levelNum}>{level}</span>
                        </div>
                    </div>

                    <div style={styles.mainInfo}>
                        <div style={styles.usernameRow}>
                            <h2 style={styles.username}>@{student.username}</h2>
                            <VerifiedBadge />
                        </div>
                        <p style={styles.statusText}>Official Student • Verified Profile</p>
                    </div>

                    <div style={styles.badgeGrid}>
                        <div style={styles.pillBadge}>
                            <span style={styles.pillIcon}>🎓</span>
                            Class {student.class}
                        </div>
                        <div style={{ ...styles.pillBadge, ...styles.pillBadgeAccent }}>
                            <span style={styles.pillIcon}>🎖️</span>
                            Master Scholar
                        </div>
                    </div>

                    {/* Pro XP Rail */}
                    <div style={styles.xpRailContainer}>
                        <div style={styles.xpLabelRow}>
                            <span style={styles.xpTextTitle}>EXPERIENCE POINTS</span>
                            <span style={styles.xpValueText}>{currentXp} / 1000 XP</span>
                        </div>
                        <div style={styles.xpRailBg}>
                            <div style={{ ...styles.xpRailFill, width: `${progressToNextLevel}%` }}>
                                <div style={styles.xpRailGlow} />
                            </div>
                        </div>
                    </div>
                </div>

                <div style={styles.body}>
                    <div className="stats-layout" style={styles.statsLayout}>
                        <div style={styles.statCardRefined}>
                            <div style={styles.statIconBox}>
                                <FireIcon size={22} color="#f97316" />
                            </div>
                            <div style={styles.statInfo}>
                                <div style={styles.statValLarge}>{storeData?.xpBalance?.toLocaleString() || 0}</div>
                                <div style={styles.statLabelSmall}>LIFE-TIME XP</div>
                            </div>
                        </div>
                        <div style={{ ...styles.statCardRefined, ...styles.statCardPurple }}>
                            <div style={styles.statIconBox}>
                                <TargetIcon size={22} color="#8b5cf6" />
                            </div>
                            <div style={styles.statInfo}>
                                <div style={styles.statValLarge}>{ownedAvatars.length}</div>
                                <div style={styles.statLabelSmall}>COLLECTIBLES</div>
                            </div>
                        </div>
                    </div>

                    <div style={styles.inventorySection}>
                        <div style={styles.sectionHeading}>
                            <h3 style={styles.sectionTitleRefined}>
                                <span style={styles.sectionTitleIcon}>🏛️</span>
                                Avatar Inventory
                            </h3>
                            <div style={styles.inventoryCount}>{ownedAvatars.length} items</div>
                        </div>

                        <div style={styles.inventoryShelf}>
                            <div className="shelf-grid" style={styles.shelfGrid}>
                                {ownedAvatars.length > 0 ? (
                                    ownedAvatars.map(avatarId => (
                                        <div 
                                            key={avatarId} 
                                            className="item-card"
                                            style={{
                                                ...styles.itemCard,
                                                ...(styles[`cardQuality_${AVATAR_MAP[avatarId]?.quality}`] || {})
                                            }}
                                        >
                                            <div style={styles.itemImgWrapper}>
                                                <img 
                                                    src={AVATAR_MAP[avatarId]?.img} 
                                                    alt={AVATAR_MAP[avatarId]?.name} 
                                                    style={styles.itemImg} 
                                                />
                                            </div>
                                            <div style={styles.itemNameTag}>{AVATAR_MAP[avatarId]?.name}</div>
                                        </div>
                                    ))
                                ) : (
                                    <div style={styles.shelfEmpty}>
                                        <div style={styles.emptyIconLarge}>📦</div>
                                        <div style={styles.emptyTextLarge}>Inventory is empty</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div style={{ ...styles.inventorySection, marginTop: '24px' }}>
                        <div style={styles.sectionHeading}>
                            <h3 style={styles.sectionTitleRefined}>
                                <span style={styles.sectionTitleIcon}>🏆</span>
                                Achievement Badges
                            </h3>
                            <div style={styles.inventoryCount}>
                                {(userData?.badges || student?.badges || []).length} / {Object.keys(BADGES).length} unlocked
                            </div>
                        </div>

                        <div style={styles.inventoryShelf}>
                            <div className="shelf-grid" style={styles.shelfGrid}>
                                {Object.values(BADGES).map(badge => {
                                    const isUnlocked = (userData?.badges || student?.badges || []).includes(badge.id);
                                    return (
                                        <div 
                                            key={badge.id} 
                                            className="badge-card"
                                            style={{
                                                ...styles.badgeCard,
                                                ...(isUnlocked ? {
                                                    border: `1px solid ${badge.color}60`,
                                                    background: `linear-gradient(135deg, ${badge.color}15, rgba(15, 23, 42, 0.4))`
                                                } : styles.badgeCardLocked)
                                            }}
                                        >
                                            <div style={{
                                                ...styles.badgeIcon,
                                                textShadow: isUnlocked ? `0 0 15px ${badge.color}` : 'none',
                                                opacity: isUnlocked ? 1 : 0.25,
                                                filter: isUnlocked ? 'none' : 'grayscale(100%)'
                                            }}>
                                                {badge.icon}
                                            </div>
                                            <div style={{
                                                ...styles.badgeNameTag,
                                                color: isUnlocked ? '#f1f5f9' : '#475569'
                                            }}>
                                                {badge.name}
                                            </div>
                                            <div className="badge-tooltip" style={styles.badgeTooltip}>
                                                {badge.description}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const styles = {
    overlay: {
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(2, 6, 23, 0.9)',
        backdropFilter: 'blur(20px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
    },
    modal: {
        width: '100%',
        maxWidth: '480px',
        maxHeight: '90vh',
        overflowY: 'auto',
        backgroundColor: '#0c0e14',
        borderRadius: '36px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 40px 100px rgba(0, 0, 0, 0.8), 0 0 40px rgba(59, 130, 246, 0.1)',
        position: 'relative',
        animation: 'masterEntrance 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)'
    },
    banner: {
        height: '160px',
        position: 'relative',
        overflow: 'hidden'
    },
    bannerMesh: {
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(135deg, #1e3a8a 0%, #312e81 25%, #4c1d95 50%, #7c3aed 75%, #db2714 100%)',
        backgroundSize: '400% 400%',
        animation: 'meshMove 15s ease infinite',
        opacity: 0.8
    },
    bannerGlass: {
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(to bottom, rgba(12, 14, 20, 0) 0%, rgba(12, 14, 20, 0.8) 100%)'
    },
    closeBtn: {
        position: 'absolute',
        top: '20px',
        right: '20px',
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '14px',
        width: '40px',
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        zIndex: 20,
        transition: 'all 0.3s ease',
        color: '#fff'
    },
    schoolBadge: {
        position: 'absolute',
        top: '20px',
        left: '20px',
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(12px)',
        padding: '8px 16px',
        borderRadius: '14px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
        zIndex: 10
    },
    schoolIcon: { fontSize: '14px' },
    schoolName: {
        color: '#f8fafc',
        fontSize: '11px',
        fontWeight: '700',
        letterSpacing: '0.05em',
        textTransform: 'uppercase'
    },
    header: {
        padding: '0 40px 30px',
        textAlign: 'center',
        marginTop: '-80px'
    },
    photoWrapper: {
        position: 'relative',
        display: 'inline-block',
        marginBottom: '20px',
        zIndex: 5
    },
    photoRing: {
        position: 'relative',
        padding: '5px',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.2), transparent)',
        borderRadius: '50%',
        boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
        border: '1px solid rgba(255, 255, 255, 0.1)'
    },
    photoGlow: {
        position: 'absolute',
        inset: '-10px',
        background: 'radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(10px)',
        zIndex: -1
    },
    levelIndicator: {
        position: 'absolute',
        bottom: '8px',
        right: '8px',
        background: 'linear-gradient(135deg, #fbbf24, #d97706)',
        border: '4px solid #0c0e14',
        width: '42px',
        height: '42px',
        borderRadius: '50%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 8px 20px rgba(0, 0, 0, 0.5)',
        zIndex: 6
    },
    levelTitle: { fontSize: '8px', fontWeight: '900', color: 'rgba(0,0,0,0.6)', lineHeight: 1 },
    levelNum: { fontSize: '16px', fontWeight: '900', color: '#000', lineHeight: 1 },
    mainInfo: { marginBottom: '20px' },
    usernameRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        marginBottom: '4px'
    },
    username: {
        fontSize: '28px',
        fontWeight: '900',
        color: '#fff',
        margin: 0,
        letterSpacing: '-0.03em'
    },
    statusText: {
        fontSize: '13px',
        color: '#64748b',
        fontWeight: '600',
        margin: 0,
        opacity: 0.8
    },
    badgeGrid: {
        display: 'flex',
        gap: '10px',
        justifyContent: 'center',
        marginBottom: '24px'
    },
    pillBadge: {
        background: 'rgba(255, 255, 255, 0.03)',
        color: '#94a3b8',
        padding: '8px 18px',
        borderRadius: '50px',
        fontSize: '12px',
        fontWeight: '700',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    },
    pillBadgeAccent: {
        background: 'rgba(59, 130, 246, 0.08)',
        color: '#60a5fa',
        border: '1px solid rgba(59, 130, 246, 0.15)'
    },
    xpRailContainer: {
        width: '100%',
        maxWidth: '320px',
        margin: '0 auto'
    },
    xpLabelRow: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '9px',
        fontWeight: '900',
        color: '#475569',
        marginBottom: '8px',
        letterSpacing: '0.15em'
    },
    xpRailBg: {
        height: '10px',
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '20px',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.05)'
    },
    xpRailFill: {
        height: '100%',
        background: 'linear-gradient(to right, #3b82f6, #8b5cf6, #d946ef)',
        borderRadius: '20px',
        position: 'relative',
        transition: 'width 1.2s cubic-bezier(0.4, 0, 0.2, 1)'
    },
    xpRailGlow: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: '20px',
        background: 'rgba(255, 255, 255, 0.3)',
        filter: 'blur(10px)'
    },
    body: { padding: '0 32px 32px' },
    statsLayout: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
        marginBottom: '32px'
    },
    statCardRefined: {
        background: 'rgba(255, 255, 255, 0.02)',
        padding: '18px',
        borderRadius: '24px',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        transition: 'transform 0.3s ease',
        '&:hover': { transform: 'translateY(-4px)', background: 'rgba(255, 255, 255, 0.04)' }
    },
    statCardPurple: {
        background: 'rgba(139, 92, 246, 0.02)',
        border: '1px solid rgba(139, 92, 246, 0.06)'
    },
    statIconBox: {
        width: '44px',
        height: '44px',
        borderRadius: '16px',
        background: 'rgba(12, 14, 20, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 6px 15px rgba(0,0,0,0.3)'
    },
    statInfo: { display: 'flex', flexDirection: 'column' },
    statValLarge: { fontSize: '20px', fontWeight: '900', color: '#fff', lineHeight: 1 },
    statLabelSmall: { fontSize: '10px', color: '#475569', fontWeight: '800', marginTop: '4px', letterSpacing: '0.05em' },
    inventorySection: { marginTop: '8px' },
    sectionHeading: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '18px'
    },
    sectionTitleRefined: {
        fontSize: '16px',
        fontWeight: '800',
        color: '#f1f5f9',
        margin: 0,
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
    },
    inventoryCount: {
        fontSize: '11px',
        color: '#64748b',
        fontWeight: '700',
        background: 'rgba(255, 255, 255, 0.05)',
        padding: '4px 12px',
        borderRadius: '10px',
        border: '1px solid rgba(255, 255, 255, 0.05)'
    },
    inventoryShelf: {
        background: 'rgba(255, 255, 255, 0.01)',
        borderRadius: '28px',
        padding: '20px',
        border: '1px solid rgba(255, 255, 255, 0.04)'
    },
    shelfGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '14px',
        maxHeight: '220px',
        overflowY: 'auto'
    },
    itemCard: {
        aspectRatio: '0.85',
        background: 'rgba(15, 23, 42, 0.4)',
        borderRadius: '20px',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        transition: 'all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)',
        cursor: 'default',
        position: 'relative',
        overflow: 'hidden'
    },
    cardQuality_legendary: { border: '1px solid rgba(245, 158, 11, 0.3)', background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.05), rgba(15, 23, 42, 0.4))' },
    cardQuality_epic: { border: '1px solid rgba(168, 85, 247, 0.3)', background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.05), rgba(15, 23, 42, 0.4))' },
    cardQuality_rare: { border: '1px solid rgba(59, 130, 246, 0.3)', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(15, 23, 42, 0.4))' },
    itemImgWrapper: { width: '100%', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    itemImg: { width: '90%', height: '90%', objectFit: 'contain', filter: 'drop-shadow(0 8px 12px rgba(0, 0, 0, 0.6))' },
    itemNameTag: {
        fontSize: '9px',
        fontWeight: '800',
        color: '#64748b',
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        width: '100%',
        marginTop: '8px'
    },
    shelfEmpty: { gridColumn: 'span 4', textAlign: 'center', padding: '40px 0', opacity: 0.4 },
    emptyIconLarge: { fontSize: '32px', marginBottom: '8px' },
    emptyTextLarge: { fontSize: '13px', fontWeight: '600' },
    badgeCard: {
        aspectRatio: '0.85',
        background: 'rgba(15, 23, 42, 0.4)',
        borderRadius: '20px',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        transition: 'all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'visible'
    },
    badgeCardLocked: {
        opacity: 0.4,
        border: '1px dashed rgba(255, 255, 255, 0.08)'
    },
    badgeIcon: {
        fontSize: '32px',
        marginBottom: '8px',
        transition: 'all 0.3s ease'
    },
    badgeNameTag: {
        fontSize: '9px',
        fontWeight: '800',
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        width: '100%',
        marginTop: '4px'
    },
    badgeTooltip: {
        position: 'absolute',
        bottom: '105%',
        left: '50%',
        transform: 'translateX(-50%) translateY(10px)',
        backgroundColor: '#0f172a',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        color: '#94a3b8',
        padding: '8px 12px',
        borderRadius: '12px',
        fontSize: '10px',
        fontWeight: '600',
        width: '160px',
        textAlign: 'center',
        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
        pointerEvents: 'none',
        opacity: 0,
        transition: 'all 0.2s ease',
        zIndex: 50
    }
};

// Advanced animations
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
        @keyframes masterEntrance {
            from { transform: scale(0.96) translateY(20px); opacity: 0; filter: blur(10px); }
            to { transform: scale(1) translateY(0); opacity: 1; filter: blur(0); }
        }
        @keyframes meshMove {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
        .profile-modal::-webkit-scrollbar {
            width: 6px;
        }
        .profile-modal::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.2);
            border-radius: 36px;
        }
        .profile-modal::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.15);
            border-radius: 36px;
        }
        .profile-modal::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.3);
        }
        .shelf-grid::-webkit-scrollbar { width: 5px; }
        .shelf-grid::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); border-radius: 10px; }
        
        .shelf-grid {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 14px !important;
        }
        .badge-card, .item-card {
            aspect-ratio: auto !important;
            min-height: 110px !important;
            padding: 12px 6px !important;
        }
        
        @media (max-width: 600px) {
            .shelf-grid {
                grid-template-columns: repeat(3, 1fr) !important;
                gap: 10px !important;
            }
            .badge-card, .item-card {
                min-height: 105px !important;
            }
            .stats-layout {
                grid-template-columns: 1fr !important;
                gap: 12px !important;
            }
        }
        @media (max-width: 420px) {
            .shelf-grid {
                grid-template-columns: repeat(2, 1fr) !important;
                gap: 8px !important;
            }
            .badge-card, .item-card {
                min-height: 95px !important;
            }
        }
        
        .badge-card {
            position: relative;
        }
        .badge-card:hover .badge-tooltip {
            opacity: 1 !important;
            transform: translateX(-50%) translateY(0) !important;
        }
    `;
    document.head.appendChild(styleSheet);
}

export default StudentProfileModal;
