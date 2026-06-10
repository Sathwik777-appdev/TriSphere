/**
 * Firebase Storage Service for PDF uploads
 * Replaces GitHub storage to avoid CORS issues
 */

import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

/**
 * Upload PDF file to Firebase Storage
 * @param {File} file - The PDF file to upload
 * @param {string} folder - The folder to upload to (textbooks/assignments)
 * @returns {Promise<{url: string, path: string}>}
 */
export const uploadPDFToStorage = async (file, folder = 'textbooks') => {
  try {
    console.log('Starting Firebase Storage upload...', { 
      fileName: file.name, 
      size: file.size,
      folder 
    });
    const startTime = Date.now();

    // Create unique file path
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${folder}/${sanitizedFileName}_${timestamp}.pdf`;

    // Create storage reference
    const storageRef = ref(storage, filePath);

    // Upload file with metadata
    const metadata = {
      contentType: 'application/pdf',
      customMetadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString()
      },
      cacheControl: 'public, max-age=31536000'
    };

    console.log('Uploading to Firebase Storage:', filePath);
    console.log('Storage bucket:', storage.app.options.storageBucket);
    
    try {
      const snapshot = await uploadBytes(storageRef, file, metadata);
      
      // Get download URL
      const downloadUrl = await getDownloadURL(snapshot.ref);
      
      const uploadTime = Date.now() - startTime;
      console.log('Firebase Storage upload complete!', {
        url: downloadUrl,
        time: `${uploadTime}ms`,
        size: snapshot.metadata.size
      });

      return {
        url: downloadUrl,
        path: filePath,
        fullPath: snapshot.ref.fullPath,
        size: snapshot.metadata.size
      };
    } catch (uploadError) {
      console.error('Upload bytes failed:', uploadError);
      
      // Check if it's a CORS or permission error
      if (uploadError.code === 'storage/unauthorized') {
        throw new Error('Upload failed: Permission denied. Please check Firebase Storage rules.');
      } else if (uploadError.message?.includes('CORS') || uploadError.message?.includes('fetch')) {
        throw new Error('Upload failed: CORS error. Please check Firebase Storage CORS configuration.');
      }
      
      throw uploadError;
    }
  } catch (error) {
    console.error('Firebase Storage upload error:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    // Provide helpful error messages
    if (error.code === 'storage/unauthorized') {
      throw new Error('Upload failed: You do not have permission to upload files. Please contact your administrator.');
    } else if (error.code === 'storage/canceled') {
      throw new Error('Upload was cancelled.');
    } else if (error.code === 'storage/quota-exceeded') {
      throw new Error('Upload failed: Storage quota exceeded.');
    } else {
      throw new Error(`Upload failed: ${error.message}`);
    }
  }
};

/**
 * Upload Image file to Firebase Storage
 * @param {File} file - The Image file to upload
 * @param {string} folder - The folder to upload to (profile_photos/announcements/etc)
 * @param {string} userId - Optional userId to create a subfolder (recommended for profile_photos)
 * @returns {Promise<{url: string, path: string}>}
 */
export const uploadImageToStorage = async (file, folder = 'profile_photos', userId = null) => {
  try {
    console.log('Starting Firebase Storage image upload...', { 
      fileName: file.name, 
      size: file.size,
      folder,
      userId
    });
    const startTime = Date.now();

    // Create unique file path
    const timestamp = Date.now();
    const extension = file.name.split('.').pop() || 'jpg';
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').split('.')[0];
    
    // Use user-specific subfolder if provided (essential for security rules)
    const filePath = userId 
      ? `${folder}/${userId}/${sanitizedFileName}_${timestamp}.${extension}`
      : `${folder}/${sanitizedFileName}_${timestamp}.${extension}`;

    // Create storage reference
    const storageRef = ref(storage, filePath);

    // Upload file with metadata
    const metadata = {
      contentType: file.type || 'image/jpeg',
      customMetadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString()
      },
      cacheControl: 'public, max-age=31536000'
    };

    const snapshot = await uploadBytes(storageRef, file, metadata);
    const downloadUrl = await getDownloadURL(snapshot.ref);
    
    console.log('Firebase Storage image upload complete!', {
      url: downloadUrl,
      time: `${Date.now() - startTime}ms`
    });

    return {
      url: downloadUrl,
      path: filePath
    };
  } catch (error) {
    console.error('Firebase Storage image upload error:', error);
    throw new Error(`Upload failed: ${error.message}`);
  }
};

export default {
  uploadPDFToStorage,
  uploadImageToStorage
};
