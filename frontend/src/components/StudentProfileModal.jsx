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
                {/* Advanced Premium Banner */}
                <div style={styles.banner}>
                    <div style={styles.bannerMesh} />
                    <div style={styles.bannerGlass} />
                    
                    <div 
                        style={styles.closeBtn} 
                        onClick={onClose}
                        role="button"
                    >
                        <CloseIcon size={24} color="#ffffff" />
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
                            <div style={styles.photoInner}>
                                <ProfilePhoto size={130} editable={false} userData={student} uid={student.id} />
                            </div>
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
                        <p style={styles.statusText}>
                            <span style={styles.roleText}>{student.role === 'developer' ? 'Developer' : 'Student'}</span> 
                            <span style={styles.dotSeparator}>•</span> 
                            {student.schoolName}
                        </p>
                    </div>

                    <div style={styles.badgeGrid}>
                        <div style={styles.pillBadge}>
                            <span style={styles.pillIcon}>🎓</span>
                            Class {student.class || 'N/A'}
                        </div>
                        {((userData?.badges || student?.badges || []).length > 0) && (
                            <div style={styles.pillBadgeAccent}>
                                <span style={styles.pillIcon}>🎖️</span>
                                {Object.values(BADGES).find(b => (userData?.badges || student?.badges || []).includes(b.id))?.name || 'Scholar'}
                            </div>
                        )}
                    </div>

                    {/* Premium XP Rail */}
                    <div style={styles.xpRailContainer}>
                        <div style={styles.xpLabelRow}>
                            <span style={styles.xpTextTitle}>EXPERIENCE</span>
                            <span style={styles.xpValueText}>
                                <strong style={{color: '#fff'}}>{currentXp}</strong> / 1000 XP
                            </span>
                        </div>
                        <div style={styles.xpRailBg}>
                            <div style={{ ...styles.xpRailFill, width: `${progressToNextLevel}%` }}>
                                <div style={styles.xpRailGlow} />
                                <div style={styles.xpRailThumb} />
                            </div>
                        </div>
                    </div>
                </div>

                <div style={styles.body}>
                    <div className="stats-layout" style={styles.statsLayout}>
                        <div style={styles.statCardGlass}>
                            <div style={{...styles.statIconBox, background: 'rgba(249, 115, 22, 0.15)', borderColor: 'rgba(249, 115, 22, 0.3)'}}>
                                <FireIcon size={24} color="#f97316" />
                            </div>
                            <div style={styles.statInfo}>
                                <div style={styles.statValLarge}>{storeData?.xpBalance?.toLocaleString() || 0}</div>
                                <div style={styles.statLabelSmall}>LIFETIME XP</div>
                            </div>
                        </div>
                        <div style={styles.statCardGlass}>
                            <div style={{...styles.statIconBox, background: 'rgba(139, 92, 246, 0.15)', borderColor: 'rgba(139, 92, 246, 0.3)'}}>
                                <TargetIcon size={24} color="#a78bfa" />
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
                                <span style={styles.sectionTitleIcon}>✨</span>
                                Avatar Inventory
                            </h3>
                            <div style={styles.inventoryCount}>{ownedAvatars.length} ITEMS</div>
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

                    <div style={{ ...styles.inventorySection, marginTop: '28px' }}>
                        <div style={styles.sectionHeading}>
                            <h3 style={styles.sectionTitleRefined}>
                                <span style={styles.sectionTitleIcon}>🏆</span>
                                Achievement Badges
                            </h3>
                            <div style={styles.inventoryCount}>
                                {(userData?.badges || student?.badges || []).length} / {Object.keys(BADGES).length} UNLOCKED
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
                                                    border: `1px solid ${badge.color}50`,
                                                    background: `linear-gradient(145deg, rgba(30, 41, 59, 0.4), ${badge.color}15)`,
                                                    boxShadow: `inset 0 0 20px ${badge.color}05`
                                                } : styles.badgeCardLocked)
                                            }}
                                        >
                                            <div style={{
                                                ...styles.badgeIcon,
                                                textShadow: isUnlocked ? `0 0 20px ${badge.color}80` : 'none',
                                                opacity: isUnlocked ? 1 : 0.15,
                                                filter: isUnlocked ? 'none' : 'grayscale(100%)'
                                            }}>
                                                {badge.icon}
                                            </div>
                                            <div style={{
                                                ...styles.badgeNameTag,
                                                color: isUnlocked ? '#f8fafc' : '#475569'
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
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(24px) saturate(150%)',
        WebkitBackdropFilter: 'blur(24px) saturate(150%)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
    },
    modal: {
        width: '100%',
        maxWidth: '460px',
        maxHeight: '92vh',
        overflowY: 'auto',
        backgroundColor: '#0a0d14',
        borderRadius: '32px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 25px 80px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        position: 'relative',
        animation: 'masterEntrance 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
    },
    banner: {
        height: '180px',
        position: 'relative',
        overflow: 'hidden',
        borderTopLeftRadius: '32px',
        borderTopRightRadius: '32px',
    },
    bannerMesh: {
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(120deg, #0f172a 0%, #1e1b4b 30%, #312e81 60%, #1e1b4b 100%)',
        backgroundSize: '200% 200%',
        animation: 'meshMove 20s ease infinite',
        opacity: 1
    },
    bannerGlass: {
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(to bottom, rgba(10, 13, 20, 0) 0%, rgba(10, 13, 20, 1) 100%)'
    },
    closeBtn: {
        position: 'absolute',
        top: '20px',
        right: '20px',
        background: 'transparent',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        zIndex: 20,
        color: 'rgba(255,255,255,0.7)',
        transition: 'color 0.2s',
        padding: '8px'
    },
    schoolBadge: {
        position: 'absolute',
        top: '24px',
        left: '24px',
        background: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: 'blur(16px)',
        padding: '8px 14px',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        zIndex: 10
    },
    schoolIcon: { fontSize: '13px' },
    schoolName: {
        color: '#e2e8f0',
        fontSize: '11px',
        fontWeight: '700',
        letterSpacing: '0.06em',
        textTransform: 'uppercase'
    },
    header: {
        padding: '0 32px 24px',
        textAlign: 'center',
        marginTop: '-70px'
    },
    photoWrapper: {
        position: 'relative',
        display: 'inline-block',
        marginBottom: '20px',
        zIndex: 5
    },
    photoRing: {
        position: 'relative',
        padding: '6px',
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.8), rgba(139, 92, 246, 0.8), rgba(236, 72, 153, 0.8), rgba(59, 130, 246, 0.8))',
        backgroundSize: '300% 300%',
        borderRadius: '50%',
        boxShadow: '0 12px 35px rgba(0,0,0,0.5), inset 0 0 0 2px rgba(255,255,255,0.2)',
        animation: 'gradientSpin 4s ease infinite'
    },
    photoInner: {
        borderRadius: '50%',
        background: '#0a0d14',
        padding: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    photoGlow: {
        position: 'absolute',
        inset: '-20px',
        background: 'radial-gradient(circle, rgba(99, 102, 241, 0.4) 0%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(20px)',
        zIndex: -1
    },
    levelIndicator: {
        position: 'absolute',
        bottom: '4px',
        right: '4px',
        background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
        border: '4px solid #0a0d14',
        width: '44px',
        height: '44px',
        borderRadius: '50%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 8px 20px rgba(0, 0, 0, 0.6), inset 0 2px 4px rgba(255,255,255,0.4)',
        zIndex: 6
    },
    levelTitle: { fontSize: '8px', fontWeight: '900', color: 'rgba(255,255,255,0.9)', lineHeight: 1, letterSpacing: '0.5px' },
    levelNum: { fontSize: '18px', fontWeight: '900', color: '#fff', lineHeight: 1, textShadow: '0 2px 4px rgba(0,0,0,0.3)' },
    mainInfo: { marginBottom: '24px' },
    usernameRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        marginBottom: '6px'
    },
    username: {
        fontSize: '30px',
        fontWeight: '800',
        background: 'linear-gradient(to right, #ffffff, #94a3b8)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        margin: 0,
        letterSpacing: '-0.02em'
    },
    statusText: {
        fontSize: '13px',
        color: '#64748b',
        fontWeight: '500',
        margin: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px'
    },
    roleText: {
        color: '#94a3b8',
        fontWeight: '600'
    },
    dotSeparator: {
        color: '#334155',
        fontSize: '16px'
    },
    badgeGrid: {
        display: 'flex',
        gap: '12px',
        justifyContent: 'center',
        marginBottom: '32px'
    },
    pillBadge: {
        background: 'rgba(30, 41, 59, 0.6)',
        backdropFilter: 'blur(8px)',
        color: '#e2e8f0',
        padding: '8px 20px',
        borderRadius: '100px',
        fontSize: '13px',
        fontWeight: '600',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
    },
    pillBadgeAccent: {
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(139, 92, 246, 0.15))',
        backdropFilter: 'blur(8px)',
        color: '#a78bfa',
        padding: '8px 20px',
        borderRadius: '100px',
        fontSize: '13px',
        fontWeight: '600',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        boxShadow: '0 4px 15px rgba(139, 92, 246, 0.15)'
    },
    xpRailContainer: {
        width: '100%',
        maxWidth: '340px',
        margin: '0 auto',
        padding: '16px',
        background: 'rgba(15, 23, 42, 0.4)',
        borderRadius: '20px',
        border: '1px solid rgba(255, 255, 255, 0.05)'
    },
    xpLabelRow: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '10px',
        fontWeight: '800',
        color: '#64748b',
        marginBottom: '10px',
        letterSpacing: '0.1em'
    },
    xpValueText: {
        color: '#94a3b8',
        fontFamily: 'monospace',
        fontSize: '11px'
    },
    xpRailBg: {
        height: '8px',
        background: '#0f172a',
        borderRadius: '10px',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)'
    },
    xpRailFill: {
        height: '100%',
        background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)',
        borderRadius: '10px',
        position: 'relative',
        transition: 'width 1.5s cubic-bezier(0.2, 0.8, 0.2, 1)'
    },
    xpRailGlow: {
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4))',
        filter: 'blur(4px)'
    },
    xpRailThumb: {
        position: 'absolute',
        right: 0,
        top: '50%',
        transform: 'translateY(-50%)',
        width: '12px',
        height: '12px',
        background: '#fff',
        borderRadius: '50%',
        boxShadow: '0 0 10px rgba(236, 72, 153, 0.8), 0 0 20px rgba(139, 92, 246, 0.6)'
    },
    body: { padding: '0 28px 32px' },
    statsLayout: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
        marginBottom: '36px'
    },
    statCardGlass: {
        background: 'rgba(30, 41, 59, 0.4)',
        padding: '20px',
        borderRadius: '24px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)',
        backdropFilter: 'blur(12px)',
        transition: 'transform 0.3s ease, background 0.3s ease',
        '&:hover': { transform: 'translateY(-4px)', background: 'rgba(30, 41, 59, 0.6)' }
    },
    statIconBox: {
        width: '48px',
        height: '48px',
        borderRadius: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid',
        boxShadow: '0 8px 16px rgba(0,0,0,0.2)'
    },
    statInfo: { display: 'flex', flexDirection: 'column' },
    statValLarge: { fontSize: '24px', fontWeight: '800', color: '#f8fafc', lineHeight: 1 },
    statLabelSmall: { fontSize: '10px', color: '#64748b', fontWeight: '700', marginTop: '6px', letterSpacing: '0.08em' },
    inventorySection: { marginTop: '8px' },
    sectionHeading: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
    },
    sectionTitleRefined: {
        fontSize: '17px',
        fontWeight: '700',
        color: '#e2e8f0',
        margin: 0,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        letterSpacing: '-0.01em'
    },
    inventoryCount: {
        fontSize: '10px',
        color: '#94a3b8',
        fontWeight: '800',
        background: 'rgba(30, 41, 59, 0.6)',
        padding: '6px 14px',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        letterSpacing: '0.05em'
    },
    inventoryShelf: {
        background: 'rgba(15, 23, 42, 0.3)',
        borderRadius: '28px',
        padding: '24px',
        border: '1px solid rgba(255, 255, 255, 0.04)',
        boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.3)'
    },
    shelfGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        maxHeight: '240px',
        overflowY: 'auto'
    },
    itemCard: {
        aspectRatio: '0.85',
        background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.4), rgba(15, 23, 42, 0.6))',
        borderRadius: '20px',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        transition: 'all 0.3s ease',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 8px 20px rgba(0,0,0,0.2)'
    },
    cardQuality_legendary: { border: '1px solid rgba(245, 158, 11, 0.4)', background: 'linear-gradient(145deg, rgba(245, 158, 11, 0.1), rgba(15, 23, 42, 0.8))' },
    cardQuality_epic: { border: '1px solid rgba(168, 85, 247, 0.4)', background: 'linear-gradient(145deg, rgba(168, 85, 247, 0.1), rgba(15, 23, 42, 0.8))' },
    cardQuality_rare: { border: '1px solid rgba(59, 130, 246, 0.4)', background: 'linear-gradient(145deg, rgba(59, 130, 246, 0.1), rgba(15, 23, 42, 0.8))' },
    itemImgWrapper: { 
        width: '100%', 
        flex: 1, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        position: 'relative',
        minHeight: '60px' // Ensure it doesn't collapse
    },
    itemImg: { 
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%', 
        height: '100%', 
        objectFit: 'contain', 
        filter: 'drop-shadow(0 10px 15px rgba(0, 0, 0, 0.6))' 
    },
    itemNameTag: {
        fontSize: '9px',
        fontWeight: '800',
        color: '#94a3b8',
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        width: '100%',
        marginTop: '10px'
    },
    shelfEmpty: { gridColumn: 'span 4', textAlign: 'center', padding: '50px 0', opacity: 0.5 },
    emptyIconLarge: { fontSize: '36px', marginBottom: '12px' },
    emptyTextLarge: { fontSize: '14px', fontWeight: '600', color: '#64748b' },
    badgeCard: {
        aspectRatio: '0.85',
        background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.4), rgba(15, 23, 42, 0.6))',
        borderRadius: '20px',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        transition: 'all 0.3s ease',
        cursor: 'pointer',
        position: 'relative',
        boxShadow: '0 8px 20px rgba(0,0,0,0.2)'
    },
    badgeCardLocked: {
        opacity: 0.5,
        border: '1px dashed rgba(255, 255, 255, 0.1)',
        background: 'rgba(15, 23, 42, 0.2)'
    },
    badgeIcon: {
        fontSize: '34px',
        marginBottom: '10px',
        transition: 'all 0.3s ease'
    },
    badgeNameTag: {
        fontSize: '9px',
        fontWeight: '800',
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        width: '100%',
        marginTop: '6px'
    },
    badgeTooltip: {
        position: 'absolute',
        bottom: '108%',
        left: '50%',
        transform: 'translateX(-50%) translateY(10px)',
        backgroundColor: '#0f172a',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        color: '#cbd5e1',
        padding: '10px 14px',
        borderRadius: '14px',
        fontSize: '11px',
        fontWeight: '600',
        width: '180px',
        textAlign: 'center',
        boxShadow: '0 15px 35px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
        pointerEvents: 'none',
        opacity: 0,
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
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
        @keyframes gradientSpin {
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
