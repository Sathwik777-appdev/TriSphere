/**
 * Rewards Store Component
 * Virtual store where students can spend XP on avatars, themes, and profile frames
 */
import React, { useState, useEffect, memo } from 'react';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { successToast, errorToast, warningToast } from '../utils/toast';
import { showBannerAd, hideBannerAd } from '../services/adMobService';

// Store items
const AVATARS = [
    { id: 'avatar_robot', name: 'Robot', image: '/avatars/robot.png', price: 500, category: 'avatar', rarity: 'Common', preview: 'linear-gradient(135deg, #334155, #475569)' },
    { id: 'avatar_wizard', name: 'Wizard', image: '/avatars/wizard.png', price: 750, category: 'avatar', rarity: 'Common', preview: 'linear-gradient(135deg, #1e1b4b, #312e81)' },
    { id: 'avatar_astronaut', name: 'Astronaut', image: '/avatars/astronaut.png', price: 1000, category: 'avatar', rarity: 'Rare', preview: 'linear-gradient(135deg, #0f172a, #1e293b)' },
    { id: 'avatar_ninja', name: 'Ninja', image: '/avatars/ninja.png', price: 1000, category: 'avatar', rarity: 'Rare', preview: 'linear-gradient(135deg, #1e293b, #0f172a)' },
    { id: 'avatar_superhero', name: 'Learn Hero', image: '/avatars/superhero.png', price: 1500, category: 'avatar', rarity: 'Epic', preview: 'linear-gradient(135deg, #0ea5e9, #6366f1)' },
    { id: 'avatar_alien', name: 'Space Explorer', image: '/avatars/alien.png', price: 2000, category: 'avatar', rarity: 'Epic', preview: 'linear-gradient(135deg, #4f46e5, #7c3aed)' },
    { id: 'avatar_dragon', name: 'Scholar Dragon', image: '/avatars/dragon.png', price: 3000, category: 'avatar', rarity: 'Legendary', preview: 'linear-gradient(135deg, #f59e0b, #d97706)' },
    { id: 'avatar_unicorn', name: 'Magic Unicorn', image: '/avatars/unicorn.png', price: 2500, category: 'avatar', rarity: 'Legendary', preview: 'linear-gradient(135deg, #7e22ce, #a21caf)' },
    { id: 'avatar_shonen', name: 'Shonen Hero', image: '/avatars/shonen_hero.png', price: 1800, category: 'avatar', rarity: 'Epic', preview: 'linear-gradient(135deg, #991b1b, #450a0a)' },
    { id: 'avatar_shinobi', name: 'Mystic Shinobi', image: '/avatars/mystic_shinobi.png', price: 2200, category: 'avatar', rarity: 'Epic', preview: 'linear-gradient(135deg, #0f172a, #1e293b)' },
    { id: 'avatar_ethereal', name: 'Ethereal Spirit', image: '/avatars/ethereal_spirit.png', price: 4000, category: 'avatar', rarity: 'Legendary', preview: 'linear-gradient(135deg, #1e3a8a, #4338ca, #312e81)' },
    { id: 'avatar_inferno', name: 'Inferno Knight', image: '/avatars/inferno_knight.jpg', price: 5000, category: 'avatar', rarity: 'Legendary', preview: 'linear-gradient(135deg, #1a0a0a, #451a03, #1a0a0a)' }
];

const FRAMES = [
    { id: 'frame_bronze', name: 'Bronze', image: '/frames/bronze.png', price: 300, category: 'frame', rarity: 'Common', preview: 'linear-gradient(135deg, #1e293b, #451a03)' },
    { id: 'frame_silver', name: 'Silver', image: '/frames/silver.png', price: 600, category: 'frame', rarity: 'Rare', preview: 'linear-gradient(135deg, #334155, #94a3b8)' },
    { id: 'frame_gold', name: 'Gold', image: '/frames/gold.png', price: 1200, category: 'frame', rarity: 'Epic', preview: 'linear-gradient(135deg, #78350f, #fbbf24)' },
    { id: 'frame_platinum', name: 'Platinum', image: '/frames/platinum.png', price: 2000, category: 'frame', rarity: 'Epic', preview: 'linear-gradient(135deg, #0f172a, #334155, #0f172a)' },
    { id: 'frame_diamond', name: 'Diamond', image: '/frames/diamond.png', price: 3500, category: 'frame', rarity: 'Legendary', preview: 'linear-gradient(135deg, #1e1b4b, #3b82f6, #1e1b4b)' }
];

// Rarity colors
const RARITY_COLORS = {
    'Common': { bg: 'rgba(51, 65, 85, 0.9)', border: '#94a3b8', text: '#ffffff' },
    'Rare': { bg: 'rgba(30, 58, 138, 0.9)', border: '#3b82f6', text: '#ffffff' },
    'Epic': { bg: 'rgba(88, 28, 135, 0.9)', border: '#8b5cf6', text: '#ffffff' },
    'Legendary': { bg: 'rgba(120, 53, 15, 0.9)', border: '#f59e0b', text: '#ffffff' }
};

const RewardsStoreComponent = () => {
    const { user, userData } = useAuth();
    const [activeCategory, setActiveCategory] = useState('avatar');
    const [userXP, setUserXP] = useState(0);
    const [ownedItems, setOwnedItems] = useState([]);
    const [purchaseDates, setPurchaseDates] = useState({});
    const [equippedItems, setEquippedItems] = useState({
        avatar: null,
        frame: null
    });
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState(null);
    const [showSuccessAd, setShowSuccessAd] = useState(false);
    const [lastPurchasedItem, setLastPurchasedItem] = useState(null);

    // Show banner ad when store opens, hide when it closes
    useEffect(() => {
        showBannerAd();
        return () => {
            hideBannerAd();
        };
    }, []);

    // Fetch user's XP and owned items
    useEffect(() => {
        const fetchUserData = async () => {
            if (!user?.uid) return;

            try {
                setLoading(true);

                // Get user's store data
                const storeDocRef = doc(db, 'userStore', user.uid);
                const storeDoc = await getDoc(storeDocRef);

                if (storeDoc.exists()) {
                    const data = storeDoc.data();
                    let currentOwned = data.ownedItems || [];
                    let currentEquipped = data.equippedItems || { avatar: null, frame: null };
                    const dates = data.purchaseDates || {};

                    const now = new Date();
                    const activeOwned = [];
                    let needsUpdate = false;
                    const updatedPurchaseDates = { ...dates };

                    // Recovery Logic: Restore items that have purchase timestamps but were accidentally purged
                    const allStoreItems = [...AVATARS, ...FRAMES];
                    for (const item of allStoreItems) {
                        const itemId = item.id;
                        const purchaseDate = updatedPurchaseDates[itemId]?.toDate();

                        if (purchaseDate) {
                            // If it has a date but isn't in ownedItems, it was purged
                            if (!currentOwned.includes(itemId)) {
                                console.log('Found orphaned item, restoring to ownedItems:', itemId);
                                activeOwned.push(itemId);
                                needsUpdate = true;

                                // Special case: if it was the only frame, maybe we should re-equip it? 
                                // For now, just restoring ownership is the safest.
                            } else {
                                // It's already owned, check for legitimate expiration (30 days)
                                const now = new Date();
                                const daysDiff = (now - purchaseDate) / (1000 * 60 * 60 * 24);

                                // Precise expiration: >= 30 days aligns with "0 Days Left" in UI
                                if (daysDiff >= 30) {
                                    console.log('Item legitimately expired:', itemId);
                                    needsUpdate = true;
                                    // Remove from ownedItems by not adding to activeOwned
                                    if (currentEquipped.frame === itemId) currentEquipped.frame = null;
                                    if (currentEquipped.avatar === itemId) currentEquipped.avatar = null;
                                    // Also remove the purchase date so it can be re-purchased cleanly
                                    delete updatedPurchaseDates[itemId];
                                } else {
                                    activeOwned.push(itemId);
                                }
                            }
                        } else if (currentOwned.includes(itemId)) {
                            // Item is owned but has no purchase date (e.g., old items before date tracking)
                            // Add it to activeOwned and set a purchase date to now for future tracking
                            console.log('Owned item without purchase date, setting date:', itemId);
                            updatedPurchaseDates[itemId] = serverTimestamp();
                            activeOwned.push(itemId);
                            needsUpdate = true;
                        }
                    }

                    // Actually calculate the real XP instead of trusting a potentially stale/zero field
                    const calculatedXP = await calculateUserXP(user.uid);

                    if (needsUpdate || data.xpBalance !== calculatedXP) {
                        await updateDoc(storeDocRef, {
                            ownedItems: activeOwned,
                            equippedItems: currentEquipped,
                            purchaseDates: updatedPurchaseDates,
                            xpBalance: calculatedXP
                        });
                        currentOwned = activeOwned;
                    }

                    setOwnedItems(currentOwned);
                    setPurchaseDates(updatedPurchaseDates);
                    setEquippedItems(currentEquipped);
                    setUserXP(calculatedXP);
                } else {
                    // Initialize store data
                    const initialXP = await calculateUserXP(user.uid);
                    await setDoc(storeDocRef, {
                        userId: user.uid,
                        xpBalance: initialXP,
                        ownedItems: [],
                        equippedItems: { avatar: null, frame: null },
                        createdAt: serverTimestamp()
                    });
                    setUserXP(initialXP);
                    setOwnedItems([]);
                }


            } catch (error) {
                console.error('Error fetching user store data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, [user?.uid]);

    // Calculate user's total XP from activities
    const calculateUserXP = async (userId) => {
        try {
            const { collection, query, where, getDocs } = await import('firebase/firestore');

            // Get quiz results
            const quizQuery = query(
                collection(db, 'quizResults'),
                where('studentId', '==', userId)
            );
            const quizSnapshot = await getDocs(quizQuery);

            let totalXP = 0;
            quizSnapshot.docs.forEach(doc => {
                const data = doc.data();
                if (!data.malpractice) {
                    totalXP += Number(data.score) || 0;
                }
            });

            // Get assignments
            const assignmentQuery = query(
                collection(db, 'studentSubmissions'),
                where('studentId', '==', userId)
            );
            const assignmentSnapshot = await getDocs(assignmentQuery);

            assignmentSnapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.grade && data.grade.marks) {
                    totalXP += Number(data.grade.marks) || 0;
                }
            });

            // Get challenge rewards
            const challengeQuery = query(
                collection(db, 'challengeProgress'),
                where('userId', '==', userId)
            );
            const challengeSnapshot = await getDocs(challengeQuery);

            challengeSnapshot.docs.forEach(doc => {
                const data = doc.data();
                totalXP += Number(data.xpAwarded) || 0;
            });

            // Get badge rewards
            const badgeQuery = query(
                collection(db, 'userBadges'),
                where('userId', '==', userId)
            );
            const badgeSnapshot = await getDocs(badgeQuery);

            badgeSnapshot.docs.forEach(doc => {
                const data = doc.data();
                totalXP += Number(data.xpAwarded) || 0;
            });

            // Get spent XP
            const storeDoc = await getDoc(doc(db, 'userStore', userId));
            let spentXP = 0;
            if (storeDoc.exists()) {
                spentXP = Number(storeDoc.data().xpSpent) || 0;
            }

            const finalXP = totalXP - spentXP;
            return isNaN(finalXP) ? 0 : Math.max(0, finalXP);
        } catch (error) {
            console.error('Error calculating XP:', error);
            return 0;
        }
    };

    // Purchase item
    const purchaseItem = async (item) => {
        if (!user?.uid) return;
        if (ownedItems.includes(item.id)) {
            warningToast('You already own this item!');
            return;
        }

        try {
            setPurchasing(item.id);

            const storeDocRef = doc(db, 'userStore', user.uid);
            
            await runTransaction(db, async (transaction) => {
                const storeDoc = await transaction.get(storeDocRef);
                if (storeDoc.exists()) {
                    const data = storeDoc.data();
                    const currentSpent = data.xpSpent || 0;
                    const owned = data.ownedItems || [];
                    const currentBalance = data.xpBalance || 0;
                    
                    if (owned.includes(item.id)) {
                        throw new Error('ALREADY_OWNED');
                    }
                    
                    if (currentBalance < item.price) {
                        throw new Error('INSUFFICIENT_XP');
                    }
                    
                    transaction.update(storeDocRef, {
                        ownedItems: arrayUnion(item.id),
                        xpSpent: currentSpent + item.price,
                        xpBalance: currentBalance - item.price,
                        lastPurchase: serverTimestamp(),
                        [`purchaseDates.${item.id}`]: serverTimestamp()
                    });
                } else {
                    const initialXP = await calculateUserXP(user.uid);
                    if (initialXP < item.price) {
                        throw new Error('INSUFFICIENT_XP');
                    }
                    transaction.set(storeDocRef, {
                        userId: user.uid,
                        ownedItems: [item.id],
                        xpSpent: item.price,
                        xpBalance: initialXP - item.price,
                        equippedItems: { avatar: null, frame: null },
                        createdAt: serverTimestamp(),
                        lastPurchase: serverTimestamp(),
                        purchaseDates: {
                            [item.id]: serverTimestamp()
                        }
                    });
                }
            });

            setOwnedItems(prev => [...prev, item.id]);
            setPurchaseDates(prev => ({ ...prev, [item.id]: new Date() }));
            setUserXP(prev => prev - item.price);
            setLastPurchasedItem(item);
            setShowSuccessAd(true);

            successToast(`🎉 Purchased ${item.name}!`);

        } catch (error) {
            console.error('Error purchasing item:', error);
            if (error.message === 'ALREADY_OWNED') {
                warningToast('You already own this item!');
            } else if (error.message === 'INSUFFICIENT_XP') {
                warningToast('Not enough XP!');
            } else {
                errorToast('Failed to purchase item');
            }
        } finally {
            setPurchasing(null);
        }
    };

    // Equip item
    const equipItem = async (item) => {
        if (!user?.uid) return;
        if (!ownedItems.includes(item.id)) return;

        try {
            const storeDocRef = doc(db, 'userStore', user.uid);
            const newEquipped = {
                ...equippedItems,
                [item.category]: item.id
            };

            await updateDoc(storeDocRef, {
                equippedItems: newEquipped
            });

            setEquippedItems(newEquipped);
            successToast(`Equipped ${item.name}!`);

        } catch (error) {
            console.error('Error equipping item:', error);
        }
    };

    // Calculate days left
    const calculateDaysLeft = (itemId) => {
        const purchaseDate = purchaseDates[itemId];
        if (!purchaseDate) return 30;

        const dateObj = purchaseDate.toDate ? purchaseDate.toDate() : new Date(purchaseDate);
        const diff = (new Date() - dateObj) / (1000 * 60 * 60 * 24);
        const remaining = Math.max(0, Math.ceil(30 - diff));
        return remaining;
    };

    // Get items for current category
    const getItems = () => {
        switch (activeCategory) {
            case 'avatar': return AVATARS;
            case 'frame': return FRAMES;
            default: return [];
        }
    };

    if (loading) {
        return (
            <div style={styles.container}>
                <div style={styles.loading}>Loading store...</div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            {/* Header with XP Balance */}
            <div style={styles.header}>
                <div>
                    <h3 style={styles.title}>🛒 Rewards Store</h3>
                    <p style={styles.subtitle}>Spend your hard-earned XP!</p>
                </div>
                <div style={styles.xpBalance}>
                    <span style={styles.xpIcon}>⭐</span>
                    <span style={styles.xpAmount}>{userXP.toLocaleString()}</span>
                    <span style={styles.xpLabel}>XP</span>
                </div>
            </div>

            {/* Category Tabs */}
            <div style={styles.categoryTabs} className="rewards-category-tabs">
                <button
                    onClick={() => setActiveCategory('avatar')}
                    className={`rewards-category-tab ${activeCategory === 'avatar' ? 'active' : ''}`}
                    style={{
                        ...styles.categoryTab,
                        ...(activeCategory === 'avatar' ? styles.categoryTabActive : {})
                    }}
                >
                    😀 Avatars
                </button>
                <button
                    onClick={() => setActiveCategory('frame')}
                    className={`rewards-category-tab ${activeCategory === 'frame' ? 'active' : ''}`}
                    style={{
                        ...styles.categoryTab,
                        ...(activeCategory === 'frame' ? styles.categoryTabActive : {})
                    }}
                >
                    🖼️ Frames
                </button>
            </div>

            {/* Items Grid */}
            <div style={styles.itemsGrid} className="rewards-items-grid">
                {getItems().map(item => {
                    const isOwned = ownedItems.includes(item.id);
                    const isEquipped = equippedItems[item.category] === item.id;
                    const canAfford = userXP >= item.price;
                    const isPurchasing = purchasing === item.id;

                    return (
                        <div
                            key={item.id}
                            className="reward-item-card"
                            style={{
                                ...styles.itemCard,
                                ...(isOwned ? styles.itemOwned : {}),
                                ...(isEquipped ? styles.itemEquipped : {}),
                                ...(item.rarity === 'Legendary' ? { boxShadow: `0 0 20px ${RARITY_COLORS[item.rarity]?.border}44` } : {}),
                                ...(item.rarity ? { borderColor: RARITY_COLORS[item.rarity]?.border } : {})
                            }}
                        >
                            {/* Item Preview */}
                            <div
                                className="rewards-item-preview"
                                style={{
                                    ...styles.itemPreview,
                                    background: item.preview || 'rgba(59, 130, 246, 0.2)',
                                    position: 'relative'
                                }}
                            >
                                {/* Rarity Badge (Moved inside preview for better positioning) */}
                                {item.rarity && (
                                    <div style={{
                                        ...styles.rarityBadge,
                                        background: RARITY_COLORS[item.rarity]?.bg,
                                        color: RARITY_COLORS[item.rarity]?.text,
                                        borderColor: RARITY_COLORS[item.rarity]?.border,
                                        top: 'auto',
                                        bottom: '8px',
                                        left: '8px'
                                    }}>
                                        {item.rarity}
                                    </div>
                                )}
                                {item.image ? (
                                    <img
                                        src={item.image}
                                        alt={item.name}
                                        style={styles.avatarImage}
                                    />
                                ) : item.icon ? (
                                    <span style={styles.itemIcon}>{item.icon}</span>
                                ) : null}
                            </div>

                            {/* Item Info */}
                            <div style={styles.itemInfo}>
                                <p style={styles.itemName}>{item.name}</p>

                                {isEquipped && (
                                    <span style={styles.equippedBadge}>✓ Equipped</span>
                                )}

                                {isOwned && !isEquipped && (
                                    <button
                                        onClick={() => equipItem(item)}
                                        style={styles.equipBtn}
                                    >
                                        Equip
                                    </button>
                                )}

                                {!isOwned && (
                                    <div style={styles.priceSection}>
                                        <span style={{
                                            ...styles.price,
                                            color: canAfford ? '#fbbf24' : '#ef4444'
                                        }}>
                                            ⭐ {item.price}
                                        </span>
                                        <button
                                            onClick={() => purchaseItem(item)}
                                            disabled={!canAfford || isPurchasing}
                                            style={{
                                                ...styles.buyBtn,
                                                ...(canAfford ? {} : styles.buyBtnDisabled)
                                            }}
                                        >
                                            {isPurchasing ? '...' : 'Buy'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {isOwned && (
                                <div style={styles.ownedBadge}>OWNED</div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Currently Equipped Section */}
            <div style={styles.equippedSection}>
                <h4 style={styles.equippedTitle}>Currently Equipped</h4>
                <div style={styles.equippedItems} className="rewards-equipped-items">
                    {/* Avatar Card */}
                    <div
                        className="rewards-equipped-card"
                        style={{
                            ...styles.equippedCard,
                            borderColor: AVATARS.find(a => a.id === equippedItems.avatar) ? RARITY_COLORS[AVATARS.find(a => a.id === equippedItems.avatar).rarity].border : 'rgba(255,255,255,0.05)'
                        }}
                    >
                        <div style={styles.cardHeader}>
                            <span style={styles.slotLabel}>ACTIVE AVATAR</span>
                            {equippedItems.avatar && (
                                <span style={{
                                    ...styles.rarityText,
                                    color: RARITY_COLORS[AVATARS.find(a => a.id === equippedItems.avatar).rarity].text
                                }}>
                                    {AVATARS.find(a => a.id === equippedItems.avatar).rarity}
                                </span>
                            )}
                        </div>
                        <div style={{
                            ...styles.cardBody,
                            background: AVATARS.find(a => a.id === equippedItems.avatar)?.preview || 'rgba(255,255,255,0.02)'
                        }}>
                            {equippedItems.avatar ? (
                                <div style={styles.framePreviewWrapper}>
                                    <img
                                        src={AVATARS.find(a => a.id === equippedItems.avatar)?.image}
                                        alt="Equipped Avatar"
                                        style={styles.equippedImageBig}
                                    />
                                    <div style={styles.expiryBadge}>
                                        {calculateDaysLeft(equippedItems.avatar)} Days Left
                                    </div>
                                </div>
                            ) : (
                                <div style={styles.emptySlotIcon}>👤</div>
                            )}
                        </div>
                        <div style={styles.cardFooter}>
                            <div style={styles.itemName}>
                                {AVATARS.find(a => a.id === equippedItems.avatar)?.name || 'Generic Student'}
                            </div>
                        </div>
                    </div>

                    {/* Frame Card with Expiry */}
                    <div
                        className="rewards-equipped-card"
                        style={{
                            ...styles.equippedCard,
                            borderColor: FRAMES.find(f => f.id === equippedItems.frame) ? RARITY_COLORS[FRAMES.find(f => f.id === equippedItems.frame).rarity].border : 'rgba(255,255,255,0.05)'
                        }}
                    >
                        <div style={styles.cardHeader}>
                            <span style={styles.slotLabel}>ACTIVE FRAME</span>
                            {equippedItems.frame && (
                                <span style={{
                                    ...styles.rarityText,
                                    color: RARITY_COLORS[FRAMES.find(f => f.id === equippedItems.frame).rarity].text
                                }}>
                                    {FRAMES.find(f => f.id === equippedItems.frame).rarity}
                                </span>
                            )}
                        </div>
                        <div style={{
                            ...styles.cardBody,
                            background: FRAMES.find(f => f.id === equippedItems.frame)?.preview || 'rgba(255,255,255,0.02)'
                        }}>
                            {equippedItems.frame ? (
                                <div style={styles.framePreviewWrapper}>
                                    <img
                                        src={FRAMES.find(f => f.id === equippedItems.frame)?.image}
                                        alt="Equipped Frame"
                                        style={styles.equippedImageBig}
                                    />
                                    <div style={styles.expiryBadge}>
                                        {calculateDaysLeft(equippedItems.frame)} Days Left
                                    </div>
                                </div>
                            ) : (
                                <div style={styles.emptySlotIcon}>⬜</div>
                            )}
                        </div>
                        <div style={styles.cardFooter}>
                            <div style={styles.itemName}>
                                {FRAMES.find(f => f.id === equippedItems.frame)?.name || 'Standard Border'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Purchase Success Modal with Ad */}
            {showSuccessAd && lastPurchasedItem && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.85)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000,
                    padding: '20px',
                    backdropFilter: 'blur(10px)'
                }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #0f172a, #1e293b)',
                        borderRadius: '24px',
                        padding: '32px',
                        maxWidth: '500px',
                        width: '100%',
                        textAlign: 'center',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                        animation: 'modalFadeIn 0.3s ease-out'
                    }}>
                        <div style={{ fontSize: '60px', marginBottom: '20px' }}>🎁</div>
                        <h2 style={{ color: '#ffffff', marginBottom: '10px' }}>Purchase Successful!</h2>
                        <p style={{ color: '#94a3b8', marginBottom: '24px' }}>
                            You've successfully claimed <strong>{lastPurchasedItem.name}</strong>.
                            Check it out in your profile!
                        </p>

                        <button
                            onClick={() => setShowSuccessAd(false)}
                            style={{
                                padding: '12px 32px',
                                background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                                border: 'none',
                                borderRadius: '12px',
                                color: '#ffffff',
                                fontWeight: '700',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            Back to Store
                        </button>
                    </div>
                </div>
            )}
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
    xpBalance: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 20px',
        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.2))',
        border: '1px solid rgba(245, 158, 11, 0.4)',
        borderRadius: '12px'
    },
    xpIcon: {
        fontSize: '20px'
    },
    xpAmount: {
        fontSize: '20px',
        fontWeight: 700,
        color: '#fbbf24'
    },
    xpLabel: {
        fontSize: '12px',
        color: 'rgba(251, 191, 36, 0.7)'
    },
    loading: {
        textAlign: 'center',
        padding: '40px',
        color: '#94a3b8'
    },
    categoryTabs: {
        display: 'flex',
        gap: '8px',
        marginBottom: '20px'
    },
    categoryTab: {
        flex: 1,
        padding: '12px',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: '10px',
        background: 'transparent',
        color: '#94a3b8',
        fontSize: '14px',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.2s'
    },
    categoryTabActive: {
        background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
        borderColor: '#3b82f6',
        color: '#ffffff'
    },
    itemsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: '16px'
    },
    itemCard: {
        position: 'relative',
        background: 'rgba(30, 41, 59, 0.6)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        overflow: 'hidden',
        transition: 'all 0.2s'
    },
    itemOwned: {
        border: '1px solid rgba(16, 185, 129, 0.4)'
    },
    itemEquipped: {
        border: '2px solid #10b981',
        boxShadow: '0 0 20px rgba(16, 185, 129, 0.3)'
    },
    itemPreview: {
        height: '100px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '8px 8px 0 0'
    },
    itemIcon: {
        fontSize: '48px'
    },
    avatarImage: {
        width: '90%',
        height: '90%',
        objectFit: 'contain',
        borderRadius: '8px',
        filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.4))'
    },
    rarityBadge: {
        position: 'absolute',
        top: '8px',
        left: '8px',
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: 700,
        textTransform: 'uppercase',
        border: '1px solid',
        zIndex: 2
    },
    itemInfo: {
        padding: '12px'
    },
    itemName: {
        margin: '0 0 8px 0',
        fontSize: '14px',
        fontWeight: 600,
        color: '#ffffff',
        textAlign: 'center'
    },
    priceSection: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '8px'
    },
    price: {
        fontSize: '13px',
        fontWeight: 600
    },
    buyBtn: {
        padding: '6px 16px',
        background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
        border: 'none',
        borderRadius: '6px',
        color: '#ffffff',
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'pointer'
    },
    buyBtnDisabled: {
        background: '#475569',
        cursor: 'not-allowed',
        opacity: 0.6
    },
    equipBtn: {
        width: '100%',
        padding: '8px',
        background: 'linear-gradient(135deg, #10b981, #059669)',
        border: 'none',
        borderRadius: '6px',
        color: '#ffffff',
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'pointer'
    },
    equippedBadge: {
        display: 'block',
        textAlign: 'center',
        fontSize: '12px',
        color: '#10b981',
        fontWeight: 600
    },
    ownedBadge: {
        position: 'absolute',
        top: '8px',
        right: '8px',
        padding: '2px 8px',
        background: 'linear-gradient(135deg, #10b981, #059669)',
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: 700,
        color: '#ffffff'
    },
    equippedSection: {
        marginTop: '24px',
        padding: '16px',
        background: 'rgba(30, 41, 59, 0.6)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.05)'
    },
    equippedTitle: {
        margin: '0 0 16px 0',
        fontSize: '14px',
        fontWeight: 600,
        color: '#ffffff'
    },
    equippedItems: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '24px',
        maxWidth: '800px',
        margin: '0 auto'
    },
    equippedCard: {
        background: 'rgba(15, 23, 42, 0.6)',
        borderRadius: '20px',
        padding: '20px',
        border: '2px solid',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
        position: 'relative',
        overflow: 'hidden'
    },
    cardHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: '12px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
    },
    cardBody: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '120px',
        position: 'relative'
    },
    cardFooter: {
        textAlign: 'center'
    },
    rarityText: {
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.5px',
        textTransform: 'uppercase'
    },
    equippedItemName: {
        fontSize: '14px',
        fontWeight: 600,
        color: '#ffffff'
    },
    equippedImageBig: {
        width: '100px',
        height: '100px',
        objectFit: 'contain',
        filter: 'drop-shadow(0 8px 20px rgba(0, 0, 0, 0.6))'
    },
    emptySlotIcon: {
        fontSize: '48px',
        opacity: 0.4,
        color: '#64748b',
        filter: 'drop-shadow(0 0 5px rgba(0,0,0,0.5))'
    },
    slotLabel: {
        fontSize: '9px',
        color: '#64748b',
        fontWeight: 700,
        letterSpacing: '1px'
    },
    framePreviewWrapper: {
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    expiryBadge: {
        position: 'absolute',
        bottom: '-12px',
        background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
        color: 'white',
        fontSize: '9px',
        fontWeight: 700,
        padding: '3px 10px',
        borderRadius: '20px',
        boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)',
        whiteSpace: 'nowrap'
    },
    themePreview: {
        width: '60px',
        height: '40px',
        borderRadius: '8px',
        margin: '0 auto'
    }
};

// Add CSS for animations and hover effects
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
    70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
    100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
  }

  .reward-item-card {
    animation: fadeIn 0.3s ease-out backwards;
  }

  .reward-item-card:hover {
    transform: translateY(-5px);
    background: rgba(51, 65, 85, 0.8) !important;
    border-color: rgba(96, 165, 250, 0.5) !important;
    box-shadow: 0 12px 20px rgba(0, 0, 0, 0.4);
  }

  .reward-item-card:hover img {
    transform: scale(1.1);
  }

  @keyframes legendaryGlow {
    0% { filter: drop-shadow(0 0 5px rgba(245, 158, 11, 0.2)); transform: scale(1); }
    100% { filter: drop-shadow(0 0 15px rgba(245, 158, 11, 0.6)); transform: scale(1.02); }
  }

  .reward-item-card img {
    transition: transform 0.3s ease;
  }

  @media (max-width: 768px) {
    .rewards-items-grid {
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)) !important;
      gap: 12px !important;
    }
    
    .rewards-equipped-items {
      grid-template-columns: 1fr !important;
      gap: 16px !important;
    }

    .rewards-equipped-card {
      padding: 15px !important;
    }

    .rewards-item-preview {
      height: 80px !important;
    }

    .rewards-category-tabs {
      overflow-x: auto !important;
      padding-bottom: 8px !important;
      justify-content: flex-start !important;
      gap: 8px !important;
    }

    .rewards-category-tab {
      padding: 8px 16px !important;
      flex-shrink: 0 !important;
      font-size: 13px !important;
    }
  }
`;
if (!document.getElementById('rewards-store-styles')) {
    styleSheet.id = 'rewards-store-styles';
    document.head.appendChild(styleSheet);
}

// Wrap with React.memo to prevent unnecessary re-renders
export const RewardsStore = memo(RewardsStoreComponent);

export default RewardsStore;
