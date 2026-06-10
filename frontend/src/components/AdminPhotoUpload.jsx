/**
 * Admin Photo Upload Component
 * Allows admin to upload profile photos for students and teachers
 */
import React, { useState, useRef, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { successToast, errorToast, warningToast } from '../utils/toast';
import imageCompression from 'browser-image-compression';
import { uploadImageToStorage } from '../services/storageService';

export const AdminPhotoUpload = ({ userId, currentPhotoUrl, username, onPhotoUpdated }) => {
    const [uploading, setUploading] = useState(false);
    const [photoUrl, setPhotoUrl] = useState(currentPhotoUrl || null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        setPhotoUrl(currentPhotoUrl || null);
    }, [currentPhotoUrl]);

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
                maxSizeMB: 0.1, // Max 100KB
                maxWidthOrHeight: 500,
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
        if (!userId) {
            setUploading(false);
            return;
        }

        try {
            // Upload to Firebase Storage
            const result = await uploadImageToStorage(file, 'profile_photos', userId);
            const downloadUrl = result.url;

            // Update user document with photo URL
            await updateDoc(doc(db, 'users', userId), {
                photoUrl: downloadUrl
            });

            setPhotoUrl(downloadUrl);
            successToast('Profile photo updated!');

            if (onPhotoUpdated) {
                onPhotoUpdated(downloadUrl);
            }

        } catch (error) {
            console.error('Upload error:', error);
            errorToast('Upload failed. Please try a different photo or check connection.');
        } finally {
            setUploading(false);
        }
    };

    // Remove photo
    const removePhoto = async () => {
        if (!userId) return;

        try {
            await updateDoc(doc(db, 'users', userId), {
                photoUrl: null
            });
            setPhotoUrl(null);
            successToast('Photo removed');

            if (onPhotoUpdated) {
                onPhotoUpdated(null);
            }
        } catch (error) {
            console.error('Error removing photo:', error);
        }
    };

    // Get initials for placeholder
    const getInitials = () => {
        const name = username || 'User';
        return name.charAt(0).toUpperCase();
    };

    return (
        <div style={styles.container}>
            <div style={styles.photoSection}>
                <div
                    style={styles.photoWrapper}
                    onClick={() => fileInputRef.current?.click()}
                >
                    {photoUrl ? (
                        <img
                            src={photoUrl}
                            alt="Profile"
                            style={styles.photo}
                        />
                    ) : (
                        <div style={styles.placeholder}>
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

                    <div style={styles.editOverlay}>
                        <span style={styles.editIcon}>📷</span>
                    </div>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                />
            </div>

            <div style={styles.buttonsSection}>
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    style={styles.uploadBtn}
                >
                    {uploading ? 'Uploading...' : photoUrl ? 'Change Photo' : 'Upload Photo'}
                </button>

                {photoUrl && (
                    <button
                        onClick={removePhoto}
                        disabled={uploading}
                        style={styles.removeBtn}
                    >
                        Remove
                    </button>
                )}
            </div>

            <p style={styles.hint}>JPG, PNG supported</p>
        </div>
    );
};

const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        padding: '16px',
        background: 'rgba(30, 41, 59, 0.6)',
        borderRadius: '12px',
        border: '1px solid rgba(59, 130, 246, 0.3)'
    },
    photoSection: {
        position: 'relative'
    },
    photoWrapper: {
        width: '100px',
        height: '100px',
        borderRadius: '50%',
        overflow: 'hidden',
        cursor: 'pointer',
        border: '3px solid rgba(59, 130, 246, 0.5)',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
        position: 'relative'
    },
    photo: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        display: 'block'
    },
    placeholder: {
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
        color: '#ffffff',
        fontSize: '40px',
        fontWeight: 700
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
        background: 'rgba(0, 0, 0, 0.6)',
        borderRadius: '50%'
    },
    spinnerWrapper: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px'
    },
    loadingText: {
        color: '#ffffff',
        fontSize: '12px',
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
        transition: 'opacity 0.2s',
        borderRadius: '50%'
    },
    editIcon: {
        fontSize: '28px'
    },
    buttonsSection: {
        display: 'flex',
        gap: '8px'
    },
    uploadBtn: {
        padding: '8px 16px',
        background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
        border: 'none',
        borderRadius: '6px',
        color: '#ffffff',
        fontSize: '13px',
        fontWeight: 600,
        cursor: 'pointer'
    },
    removeBtn: {
        padding: '8px 16px',
        background: 'transparent',
        border: '1px solid rgba(239, 68, 68, 0.5)',
        borderRadius: '6px',
        color: '#ef4444',
        fontSize: '13px',
        fontWeight: 600,
        cursor: 'pointer'
    },
    hint: {
        margin: 0,
        fontSize: '11px',
        color: '#64748b'
    }
};

// Add CSS for hover effect
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
if (!document.getElementById('admin-photo-upload-styles')) {
    styleSheet.id = 'admin-photo-upload-styles';
    document.head.appendChild(styleSheet);
}

export default AdminPhotoUpload;
