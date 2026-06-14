/**
 * Profile Photo Component
 * Allows users to upload and display their profile photo with equipped frame
 */
import React, { useState, useRef, useEffect } from 'react';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { successToast, errorToast, warningToast } from '../utils/toast';
import imageCompression from 'browser-image-compression';
import { uploadImageToStorage } from '../services/storageService';

// Frame mapping
const FRAME_IMAGES = {
    'frame_bronze': '/frames/bronze.png',
    'frame_silver': '/frames/silver.png',
    'frame_gold': '/frames/gold.png',
    'frame_platinum': '/frames/platinum.png',
    'frame_diamond': '/frames/diamond.png'
};

const AVATAR_IMAGES = {
    'avatar_robot': '/avatars/robot.png',
    'avatar_wizard': '/avatars/wizard.png',
    'avatar_astronaut': '/avatars/astronaut.png',
    'avatar_ninja': '/avatars/ninja.png',
    'avatar_superhero': '/avatars/superhero.png',
    'avatar_alien': '/avatars/alien.png',
    'avatar_dragon': '/avatars/dragon.png',
    'avatar_unicorn': '/avatars/unicorn.png'
};

const FRAME_GLOWS = {
    'frame_bronze': 'rgba(205, 127, 50, 0.4)',  // Bronze
    'frame_silver': 'rgba(192, 192, 192, 0.4)', // Silver
    'frame_gold': 'rgba(255, 215, 0, 0.5)',     // Gold
    'frame_platinum': 'rgba(229, 228, 226, 0.5)', // Platinum
    'frame_diamond': 'rgba(185, 242, 255, 0.6)'  // Diamond
};

export const ProfilePhoto = ({ size = 80, editable = true, userData: passedUserData = null, uid: passedUid = null }) => {
    const { user: currentUser, userData: currentUserData } = useAuth();
    const user = passedUserData ? { uid: passedUid } : currentUser;
    const userData = passedUserData || currentUserData;
    const [uploading, setUploading] = useState(false);
    const [photoUrl, setPhotoUrl] = useState(userData?.photoUrl || null);
    const [equippedFrame, setEquippedFrame] = useState(null);
    const [equippedFrameId, setEquippedFrameId] = useState(null);
    const [equippedAvatar, setEquippedAvatar] = useState(null);
    const fileInputRef = useRef(null);

    // Fetch equipped frame
    useEffect(() => {
        const fetchEquippedFrame = async () => {
            if (!user?.uid) return;
            try {
                const storeDoc = await getDoc(doc(db, 'userStore', user.uid));
                if (storeDoc.exists()) {
                    const data = storeDoc.data();
                    const frameId = data.equippedItems?.frame;
                    const purchaseDates = data.purchaseDates || {};

                    // Handle Frame
                    if (frameId && FRAME_IMAGES[frameId]) {
                        // Check for expiration (30 days)
                        const now = new Date();
                        const purchaseDate = purchaseDates[frameId]?.toDate() || now; // Default to now for existing items
                        const daysDiff = (now - purchaseDate) / (1000 * 60 * 60 * 24);

                        // CRITICAL FIX: Only attempt to auto-unequip if the current user IS the owner of this data
                        // This prevents "insufficient permissions" errors when viewing another student's profile
                        const isOwner = currentUser?.uid === user.uid;

                        if (daysDiff > 30 && isOwner) {
                            // Automatically unequip expired frame
                            console.log('Frame expired, auto-unequipping...');
                            const newEquipped = { ...data.equippedItems, frame: null };
                            const activeOwned = (data.ownedItems || []).filter(id => id !== frameId);

                            try {
                                await updateDoc(doc(db, 'userStore', user.uid), {
                                    equippedItems: newEquipped,
                                    ownedItems: activeOwned
                                });
                                setEquippedFrame(null);
                                setEquippedFrameId(null);
                            } catch (updateErr) {
                                console.warn('Could not auto-unequip expired frame:', updateErr);
                                // Still show the frame for now even if update failed
                                setEquippedFrame(FRAME_IMAGES[frameId]);
                                setEquippedFrameId(frameId);
                            }
                        } else {
                            setEquippedFrame(FRAME_IMAGES[frameId]);
                            setEquippedFrameId(frameId);
                        }
                    }

                    // Handle Avatar
                    const avatarId = data.equippedItems?.avatar;
                    if (avatarId && AVATAR_IMAGES[avatarId]) {
                        setEquippedAvatar(AVATAR_IMAGES[avatarId]);
                    } else {
                        setEquippedAvatar(null);
                    }
                }
            } catch (error) {
                // If we get a permission error, it's likely because we're not allowed to see this specific store
                console.error(`Error fetching equipped frame for ${user.uid}:`, error);
            }
        };
        fetchEquippedFrame();
    }, [user?.uid, currentUser?.uid]);

    // Update photoUrl when userData changes
    useEffect(() => {
        setPhotoUrl(userData?.photoUrl || null);
    }, [userData?.photoUrl]);

    // Handle file selection
    const handleFileSelect = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            warningToast('Please select an image file');
            return;
        }

        try {
            setUploading(true);

            // Options for image compression
            const options = {
                maxSizeMB: 0.03, // Max 30KB
                maxWidthOrHeight: 300,
                useWebWorker: false
            };

            // Compress image
            const compressedFile = await imageCompression(file, options);

            await uploadPhoto(compressedFile);
        } catch (error) {
            console.error('Compression/Upload error:', error);
            // Fallback for original file
            await uploadPhoto(file);
        }
    };

    const uploadPhoto = async (file) => {
        if (!user?.uid) {
            setUploading(false);
            return;
        }

        try {
            // Upload to Firebase Storage
            const result = await uploadImageToStorage(file, 'profile_photos', user?.uid);
            const downloadUrl = result.url;

            // Update user document with photo URL
            await updateDoc(doc(db, 'users', user.uid), {
                photoUrl: downloadUrl
            });

            setPhotoUrl(downloadUrl);
            successToast('Profile photo updated!');

        } catch (error) {
            console.error('Upload error:', error);
            errorToast('Upload failed. Please try a different photo or check connection.');
        } finally {
            setUploading(false);
        }
    };

    // Remove photo
    const removePhoto = async () => {
        if (!user?.uid) return;

        try {
            await updateDoc(doc(db, 'users', user.uid), {
                photoUrl: null
            });
            setPhotoUrl(null);
            successToast('Photo removed');
        } catch (error) {
            console.error('Error removing photo:', error);
        }
    };

    // Get initials for placeholder
    const getInitials = () => {
        const name = userData?.username || 'Student';
        return name.charAt(0).toUpperCase();
    };

    // Calculate frame size (larger than photo to create border effect)
    const frameSize = size * 1.4;
    return (
        <div style={styles.container}>
            <div style={{
                ...styles.photoContainer,
                width: size * 1.5,
                height: size * 1.5
            }}>
                {/* Frame Overlay - Much larger to show as a grand reward */}
                {equippedFrame && (
                    <img
                        src={equippedFrame}
                        alt="Reward Frame"
                        style={{
                            ...styles.frameOverlay,
                            width: '100%',
                            height: '100%',
                            filter: `drop-shadow(0 0 10px ${FRAME_GLOWS[equippedFrameId] || 'rgba(59, 130, 246, 0.3)'})`
                        }}
                    />
                )}

                {/* Photo/Placeholder - Smaller to let the frame breathe */}
                <div
                    style={{
                        ...styles.photoWrapper,
                        width: size * 0.95,
                        height: size * 0.95,
                        border: equippedFrame ? 'none' : '3px solid rgba(59, 130, 246, 0.5)',
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        boxShadow: equippedFrame ? 'none' : styles.photoWrapper.boxShadow
                    }}
                    onClick={() => editable && fileInputRef.current?.click()}
                >
                    {photoUrl ? (
                        <img
                            src={photoUrl}
                            alt="Profile"
                            style={{
                                ...styles.photo,
                                width: '100%',
                                height: '100%'
                            }}
                        />
                    ) : equippedAvatar ? (
                        <img
                            src={equippedAvatar}
                            alt="Avatar"
                            style={{
                                ...styles.photo,
                                objectFit: 'contain',
                                width: '100%',
                                height: '100%',
                                background: '#1e293b' // Give it a dark background since it's a transparent PNG
                            }}
                        />
                    ) : (
                        <div style={{
                            ...styles.placeholder,
                            width: '100%',
                            height: '100%',
                            fontSize: size * 0.4
                        }}>
                            {getInitials()}
                        </div>
                    )}

                    {uploading && (
                        <div style={styles.uploadingOverlay}>
                            <div style={styles.spinnerWrapper}>
                                <div style={styles.spinner} />
                                <span style={styles.loadingText}>Optimizing...</span>
                            </div>
                        </div>
                    )}

                    {editable && !uploading && (
                        <div style={styles.editOverlay}>
                            <span style={styles.editIcon}>📷</span>
                        </div>
                    )}
                </div>
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
            />

            {editable && photoUrl && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        removePhoto();
                    }}
                    style={styles.removeBtn}
                >
                    Remove
                </button>
            )}
        </div>
    );
};

const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px'
    },
    photoContainer: {
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        backgroundColor: 'transparent',
        overflow: 'hidden', // Aggressively clip square image corners
        WebkitClipPath: 'circle(50%)', // Multi-layer clipping for Safari/Chrome
        clipPath: 'circle(50%)'
    },
    frameOverlay: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        objectFit: 'contain',
        zIndex: 1,
        pointerEvents: 'none'
    },
    photoWrapper: {
        position: 'relative',
        borderRadius: '50%',
        overflow: 'hidden',
        cursor: 'pointer',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
        zIndex: 2
    },
    photo: {
        objectFit: 'cover',
        display: 'block'
    },
    placeholder: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
        color: '#ffffff',
        fontWeight: 700,
        fontFamily: 'inherit'
    },
    uploadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)'
    },
    spinnerWrapper: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px'
    },
    loadingText: {
        color: '#ffffff',
        fontSize: '11px',
        fontWeight: 600
    },
    spinner: {
        width: '24px',
        height: '24px',
        border: '3px solid rgba(255, 255, 255, 0.3)',
        borderTopColor: '#ffffff',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
    },
    editOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.4)',
        opacity: 0,
        transition: 'opacity 0.2s'
    },
    editIcon: {
        fontSize: '24px'
    },
    removeBtn: {
        padding: '4px 12px',
        background: 'transparent',
        border: '1px solid rgba(239, 68, 68, 0.5)',
        borderRadius: '4px',
        color: '#ef4444',
        fontSize: '11px',
        cursor: 'pointer'
    }
};

// Add CSS for hover effect and spinner animation
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
if (!document.getElementById('profile-photo-styles')) {
    styleSheet.id = 'profile-photo-styles';
    document.head.appendChild(styleSheet);
}

export default ProfilePhoto;
