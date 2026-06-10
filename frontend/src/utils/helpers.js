/**
 * Debounce utility to limit function calls
 */
export function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle utility to limit function execution rate
 */
export function throttle(func, limit = 300) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Format file size to human readable format
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Robustly parse various date formats from Firestore into a Date object.
 * Handles: Firebase Timestamp objects, JS Date objects, ISO strings, and numeric milliseconds.
 * 
 * @param {any} date - The raw date data
 * @returns {Date|null} - A valid JS Date object or null if invalid
 */
export function parseToDate(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Format date to readable string
 */
export function formatDate(date) {
  const d = parseToDate(date);
  if (!d) return '';

  const options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };

  return d.toLocaleDateString('en-US', options);
}


/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
  const now = new Date();
  const diffMs = now - d;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;

  return formatDate(d);
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text, maxLength = 100) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Generate random ID
 */
export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    }
  } catch (err) {
    console.error('Failed to copy text:', err);
    return false;
  }
}

/**
 * Check if user is on mobile device
 */
export function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * Sleep/delay utility
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum retry attempts (default 3)
 * @param {number} delay - Initial delay in ms (doubles each attempt)
 */
export async function retryWithBackoff(fn, maxRetries = 3, delay = 1000) {
  for (let i = 1; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      const isLast = i === maxRetries;
      // Don't retry user-facing validation errors (standard behavior)
      const isRetryable = !error?.message?.includes('400') && !error?.message?.includes('401');
      if (isLast || !isRetryable) throw error;

      console.warn(`[Retry] Attempt ${i}/${maxRetries} failed: ${error.message}. Retrying in ${delay}ms...`);
      await sleep(delay);
      delay *= 2;
    }
  }
}

/**
 * Deep clone object
 */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if object is empty
 */
export function isEmpty(obj) {
  if (obj == null) return true;
  if (Array.isArray(obj) || typeof obj === 'string') return obj.length === 0;
  return Object.keys(obj).length === 0;
}

/**
 * Capitalize first letter
 */
export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Generate color from string (for avatars, etc.)
 */
export function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `hsl(${hue}, 65%, 50%)`;
}
