/**
 * Toast notification system - Enhanced version
 * Global toast notifications with consistent styling across all dashboards
 */

class ToastManager {
  constructor() {
    this.container = null;
    this.toasts = [];
    this.init();
  }

  init() {
    if (typeof document === 'undefined') return;

    // Create container if it doesn't exist
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      this.container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-width: 400px;
        pointer-events: none;
      `;
      document.body.appendChild(this.container);
    }

    // Add animation styles
    if (!document.querySelector('#toast-animations')) {
      const style = document.createElement('style');
      style.id = 'toast-animations';
      style.textContent = `
        @keyframes toastSlideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes toastSlideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  show(message, type = 'info', duration = 4000) {
    this.init(); // Ensure container exists

    const toast = document.createElement('div');
    const id = Date.now() + Math.random();

    // Enhanced color scheme with softer backgrounds
    const colors = {
      success: {
        bg: '#d1fae5',
        border: '#10b981',
        text: '#065f46',
        icon: '✅'
      },
      error: {
        bg: '#fee2e2',
        border: '#ef4444',
        text: '#991b1b',
        icon: '❌'
      },
      warning: {
        bg: '#fef3c7',
        border: '#f59e0b',
        text: '#92400e',
        icon: '⚠️'
      },
      info: {
        bg: '#dbeafe',
        border: '#3b82f6',
        text: '#1e40af',
        icon: 'ℹ️'
      }
    };

    const color = colors[type] || colors.info;

    toast.style.cssText = `
      background: ${color.bg};
      border: 1px solid ${color.border};
      color: ${color.text};
      padding: 14px 18px;
      border-radius: 10px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      display: flex;
      align-items: center;
      gap: 12px;
      animation: toastSlideIn 0.3s ease-out;
      cursor: pointer;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      max-width: 400px;
      word-wrap: break-word;
      pointer-events: auto;
      min-width: 280px;
    `;

    toast.innerHTML = `
      <span style="font-size: 18px; flex-shrink: 0;">${color.icon}</span>
      <span style="flex: 1; line-height: 1.4;">${message}</span>
      <span style="font-size: 16px; opacity: 0.6; flex-shrink: 0; padding: 4px;">✕</span>
    `;

    // Click to dismiss
    toast.onclick = () => this.dismiss(toast);

    // Hover effect
    toast.onmouseenter = () => {
      toast.style.transform = 'scale(1.02)';
      toast.style.boxShadow = '0 6px 24px rgba(0, 0, 0, 0.2)';
    };
    toast.onmouseleave = () => {
      toast.style.transform = 'scale(1)';
      toast.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.15)';
    };

    this.container.appendChild(toast);
    this.toasts.push({ id, element: toast });

    // Auto dismiss
    if (duration > 0) {
      setTimeout(() => this.dismiss(toast), duration);
    }

    return id;
  }

  dismiss(toast) {
    if (!toast || !toast.parentNode) return;

    toast.style.animation = 'toastSlideOut 0.3s ease-out';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
      this.toasts = this.toasts.filter(t => t.element !== toast);
    }, 300);
  }

  success(message, duration) {
    return this.show(message, 'success', duration);
  }

  error(message, duration) {
    return this.show(message, 'error', duration);
  }

  warning(message, duration) {
    return this.show(message, 'warning', duration);
  }

  info(message, duration) {
    return this.show(message, 'info', duration);
  }

  clear() {
    this.toasts.forEach(({ element }) => this.dismiss(element));
  }
}

// Export singleton
export const toast = new ToastManager();

// Convenience exports - use these in components
export const showToast = (message, type, duration) => toast.show(message, type, duration);
export const successToast = (message, duration) => toast.success(message, duration);
export const errorToast = (message, duration) => toast.error(message, duration);
export const warningToast = (message, duration) => toast.warning(message, duration);
export const infoToast = (message, duration) => toast.info(message, duration);

export default toast;
