/**
 * Input validation utilities
 * Add proper validation for forms and user inputs
 */

/**
 * Validate email format
 */
export const validateEmail = (email) => {
  const trimmedEmail = typeof email === 'string' ? email.trim() : email;
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!trimmedEmail || !regex.test(trimmedEmail)) {
    return { valid: false, error: 'Invalid email format' };
  }
  return { valid: true };
};

/**
 * Validate password strength
 */
export const validatePassword = (password) => {
  if (!password || password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }
  return { valid: true };
};

/**
 * Validate username
 */
export const validateUsername = (username) => {
  if (!username || username.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters' };
  }
  if (username.length > 30) {
    return { valid: false, error: 'Username must not exceed 30 characters' };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { valid: false, error: 'Username can only contain letters, numbers, and underscores' };
  }
  return { valid: true };
};

/**
 * Validate text input (assignments, announcements, etc.)
 */
export const validateText = (text, minLength = 10, maxLength = 5000) => {
  if (!text || text.trim().length < minLength) {
    return { valid: false, error: `Text must be at least ${minLength} characters` };
  }
  if (text.length > maxLength) {
    return { valid: false, error: `Text must not exceed ${maxLength} characters` };
  }
  return { valid: true };
};

/**
 * Validate title/name
 */
export const validateTitle = (title, minLength = 3, maxLength = 100) => {
  if (!title || title.trim().length < minLength) {
    return { valid: false, error: `Title must be at least ${minLength} characters` };
  }
  if (title.length > maxLength) {
    return { valid: false, error: `Title must not exceed ${maxLength} characters` };
  }
  return { valid: true };
};

/**
 * Validate file upload
 */
export const validateFile = (file, allowedTypes, maxSizeMB = 10) => {
  if (!file) {
    return { valid: false, error: 'No file selected' };
  }
  
  // Check file type
  const fileType = file.type || '';
  const fileName = file.name || '';
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  if (allowedTypes && allowedTypes.length > 0) {
    const isTypeAllowed = allowedTypes.some(type => {
      if (type.startsWith('.')) {
        return extension === type.substring(1);
      }
      return fileType.includes(type);
    });
    
    if (!isTypeAllowed) {
      return { valid: false, error: `File type not allowed. Allowed: ${allowedTypes.join(', ')}` };
    }
  }
  
  // Check file size
  const maxBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxBytes) {
    return { valid: false, error: `File size must not exceed ${maxSizeMB}MB` };
  }
  
  return { valid: true };
};

/**
 * Validate date
 */
export const validateDate = (date, allowPast = false) => {
  if (!date) {
    return { valid: false, error: 'Date is required' };
  }
  
  const dateObj = date instanceof Date ? date : new Date(date);
  
  if (isNaN(dateObj.getTime())) {
    return { valid: false, error: 'Invalid date format' };
  }
  
  if (!allowPast && dateObj < new Date()) {
    return { valid: false, error: 'Date cannot be in the past' };
  }
  
  return { valid: true };
};

/**
 * Validate class number
 */
export const validateClass = (classNumber) => {
  const num = parseInt(classNumber);
  if (isNaN(num) || num < 1 || num > 12) {
    return { valid: false, error: 'Class must be between 1 and 12' };
  }
  return { valid: true };
};

/**
 * Sanitize HTML to prevent XSS
 */
export const sanitizeHTML = (html) => {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
};

/**
 * Validate URL
 */
export const validateURL = (url) => {
  try {
    new URL(url);
    return { valid: true };
  } catch (e) {
    return { valid: false, error: 'Invalid URL format' };
  }
};



/**
 * Batch validation for forms
 */
export const validateForm = (fields) => {
  const errors = {};
  let isValid = true;
  
  Object.entries(fields).forEach(([key, { value, validator, ...options }]) => {
    const result = validator(value, options);
    if (!result.valid) {
      errors[key] = result.error;
      isValid = false;
    }
  });
  
  return { valid: isValid, errors };
};
