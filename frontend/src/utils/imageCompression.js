import imageCompression from 'browser-image-compression';

/**
 * Compresses an image file before upload or processing
 * @param {File} imageFile - The original image file
 * @param {object} options - Optional compression options
 * @returns {Promise<File>} - The compressed image file
 */
export const compressImage = async (imageFile, options = {}) => {
  const defaultOptions = {
    maxSizeMB: 1,            // Max size 1MB (plenty for OCR/Vision)
    maxWidthOrHeight: 1920,   // Max resolution 1080p/4K boundary
    useWebWorker: true,
    fileType: 'image/jpeg'    // Convert to JPEG for better compression
  };

  const finalOptions = { ...defaultOptions, ...options };

  try {
    console.log(`Original image size: ${(imageFile.size / 1024 / 1024).toFixed(2)} MB`);
    
    // If image is already small, don't compress
    if (imageFile.size < finalOptions.maxSizeMB * 1024 * 1024) {
      console.log('Image is already within size limits, skipping compression.');
      return imageFile;
    }

    console.log('Compressing image...');
    const compressedFile = await imageCompression(imageFile, finalOptions);
    
    console.log(`Compressed image size: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);
    return compressedFile;
  } catch (error) {
    console.error('Image compression failed:', error);
    // Return original file as fallback
    return imageFile;
  }
};
