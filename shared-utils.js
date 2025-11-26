/**
 * shared-utils.js
 * Congregation Volunteer Scheduler — Shared Utilities Library
 * 
 * Centralizes common functionality to prevent code duplication:
 * - Modal management with accessibility
 * - Toast notifications
 * - Date/time utilities
 * - Validation helpers
 * - LocalStorage with error handling and versioning
 * - Error boundary and logging
 * - Performance utilities (debounce, lazy load)
 */

const SharedUtils = (function() {
  'use strict';

  /* -------------------------
     Constants
     ------------------------- */
  const STORAGE_VERSION = '1.0.0';
  const STORAGE_KEYS = {
    VERSION: 'cvsa_version',
    LOCATIONS: 'cvsa_locations',
    VOLUNTEERS: 'cvsa_volunteers',
    BOOKINGS: 'cvsa_bookings',
    SESSION: 'cvsa_session',
    SCHEDULES: 'cvsa_location_slots',
    PREFERENCES: 'cvsa_preferences'
  };

  /* -------------------------
     Error Handling & Logging
     ------------------------- */
  const ErrorHandler = {
    logs: [],
    maxLogs: 100,

    log(level, message, data = null) {
      const entry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        data,
        stack: new Error().stack
      };
      this.logs.push(entry);
      if (this.logs.length > this.maxLogs) {
        this.logs.shift();
      }
      
      // Console logging
      const logFn = console[level] || console.log;
      logFn(`[${level.toUpperCase()}] ${message}`, data || '');
      
      return entry;
    },

    error(message, data) { return this.log('error', message, data); },
    warn(message, data) { return this.log('warn', message, data); },
    info(message, data) { return this.log('info', message, data); },
    debug(message, data) { return this.log('debug', message, data); },

    getLogs() { return [...this.logs]; },

    exportLogs() {
      const json = JSON.stringify(this.logs, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cvsa-logs-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  /* -------------------------
     LocalStorage with Error Handling & Versioning
     ------------------------- */
  const Storage = {
    save(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return { success: true };
      } catch (err) {
        ErrorHandler.error(`Storage save failed for key: ${key}`, err);
        if (err.name === 'QuotaExceededError') {
          Toast.error('Storage quota exceeded. Please clear some data.');
        }
        return { success: false, error: err };
      }
    },

    load(key, defaultValue = null) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return defaultValue;
        return JSON.parse(raw);
      } catch (err) {
        ErrorHandler.error(`Storage load failed for key: ${key}`, err);
        return defaultValue;
      }
    },

    remove(key) {
      try {
        localStorage.removeItem(key);
        return { success: true };
      } catch (err) {
        ErrorHandler.error(`Storage remove failed for key: ${key}`, err);
        return { success: false, error: err };
      }
    },

    clear() {
      try {
        localStorage.clear();
        return { success: true };
      } catch (err) {
        ErrorHandler.error('Storage clear failed', err);
        return { success: false, error: err };
      }
    },

    backup() {
      try {
        const backup = {};
        Object.values(STORAGE_KEYS).forEach(key => {
          const value = localStorage.getItem(key);
          if (value) backup[key] = value;
        });
        const json = JSON.stringify(backup, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cvsa-backup-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        Toast.success('Backup created successfully');
      } catch (err) {
        ErrorHandler.error('Backup failed', err);
        Toast.error('Failed to create backup');
      }
    },

    restore(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const backup = JSON.parse(e.target.result);
            Object.entries(backup).forEach(([key, value]) => {
              localStorage.setItem(key, value);
            });
            Toast.success('Backup restored successfully');
            resolve();
          } catch (err) {
            ErrorHandler.error('Restore failed', err);
            Toast.error('Failed to restore backup');
            reject(err);
          }
        };
        reader.onerror = reject;
        reader.readAsText(file);
      });
    },

    // Version management
    getVersion() {
      return this.load(STORAGE_KEYS.VERSION, '0.0.0');
    },

    setVersion(version) {
      this.save(STORAGE_KEYS.VERSION, version);
    },

    migrate() {
      const currentVersion = this.getVersion();
      if (currentVersion === STORAGE_VERSION) return;

      ErrorHandler.info(`Migrating from ${currentVersion} to ${STORAGE_VERSION}`);

      // Add migration logic here as schema evolves
      // Example:
      // if (compareVersions(currentVersion, '1.0.0') < 0) {
      //   // Perform migration
      // }

      this.setVersion(STORAGE_VERSION);
      Toast.info('Data migrated to latest version');
    }
  };

  /* -------------------------
     Modal Management with Accessibility
     ------------------------- */
  const Modal = {
    activeModal: null,
    previousFocus: null,

    getElements() {
      return {
        backdrop: document.getElementById('modal-backdrop'),
        title: document.getElementById('modal-title'),
        body: document.getElementById('modal-body'),
        confirm: document.getElementById('modal-confirm'),
        cancel: document.getElementById('modal-cancel'),
        close: document.getElementById('modal-close')
      };
    },

    open(options = {}) {
      const {
        title = '',
        content = '',
        showConfirm = false,
        confirmText = 'Confirm',
        confirmClass = '',
        onConfirm = null,
        showCancel = true,
        cancelText = 'Cancel',
        onClose = null,
        keyboard = true,
        backdrop = true
      } = options;

      const elements = this.getElements();
      if (!elements.backdrop || !elements.title || !elements.body) {
        ErrorHandler.warn('Modal elements not found, falling back to alert');
        this._fallback(options);
        return null;
      }

      // Store previous focus for restoration
      this.previousFocus = document.activeElement;

      // Set content
      elements.title.innerHTML = Sanitizer.escape(title);
      if (typeof content === 'string') {
        elements.body.innerHTML = content;
      } else {
        elements.body.innerHTML = '';
        elements.body.appendChild(content);
      }

      // Configure buttons
      if (elements.confirm) {
        elements.confirm.textContent = confirmText;
        elements.confirm.className = confirmClass || 'success';
        elements.confirm.style.display = showConfirm ? 'inline-block' : 'none';
        if (showConfirm) {
          elements.confirm.onclick = () => {
            if (onConfirm && onConfirm() === false) return; // Allow onConfirm to prevent close
            this.close();
          };
        }
      }

      if (elements.cancel) {
        elements.cancel.textContent = cancelText;
        elements.cancel.style.display = showCancel ? 'inline-block' : 'none';
        elements.cancel.onclick = () => this.close();
      }

      if (elements.close) {
        elements.close.onclick = () => this.close();
      }

      // Show modal
      elements.backdrop.style.display = 'flex';
      elements.backdrop.setAttribute('aria-hidden', 'false');
      this.activeModal = elements.backdrop;

      // Trap focus
      this._trapFocus(elements.backdrop);

      // Keyboard handling
      if (keyboard) {
        this._keyHandler = (e) => {
          if (e.key === 'Escape') this.close();
          if (e.key === 'Enter' && showConfirm && document.activeElement.tagName !== 'TEXTAREA') {
            if (onConfirm && onConfirm() === false) return;
            this.close();
          }
        };
        document.addEventListener('keydown', this._keyHandler);
      }

      // Backdrop click
      if (backdrop) {
        this._backdropHandler = (e) => {
          if (e.target === elements.backdrop) this.close();
        };
        elements.backdrop.addEventListener('click', this._backdropHandler);
      }

      // Store close callback
      this._onClose = onClose;

      // Focus first focusable element
      setTimeout(() => {
        const focusable = elements.backdrop.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusable.length > 0) focusable[0].focus();
      }, 100);

      return {
        close: () => this.close(),
        elements
      };
    },

    close() {
      const elements = this.getElements();
      if (!elements.backdrop) return;

      elements.backdrop.style.display = 'none';
      elements.backdrop.setAttribute('aria-hidden', 'true');

      // Cleanup
      if (elements.confirm) elements.confirm.onclick = null;
      if (elements.cancel) elements.cancel.onclick = null;
      if (elements.close) elements.close.onclick = null;

      if (this._keyHandler) {
        document.removeEventListener('keydown', this._keyHandler);
        this._keyHandler = null;
      }

      if (this._backdropHandler) {
        elements.backdrop.removeEventListener('click', this._backdropHandler);
        this._backdropHandler = null;
      }

      // Restore focus
      if (this.previousFocus && this.previousFocus.focus) {
        this.previousFocus.focus();
      }

      // Call close callback
      if (this._onClose) {
        this._onClose();
        this._onClose = null;
      }

      this.activeModal = null;
    },

    confirm(message, onConfirm) {
      return this.open({
        title: 'Confirm',
        content: `<p>${Sanitizer.escape(message)}</p>`,
        showConfirm: true,
        confirmText: 'Confirm',
        onConfirm
      });
    },

    alert(message, title = 'Notice') {
      return this.open({
        title,
        content: `<p>${Sanitizer.escape(message)}</p>`,
        showConfirm: false,
        showCancel: true,
        cancelText: 'OK'
      });
    },

    _fallback(options) {
      const { title, content, showConfirm, onConfirm } = options;
      const message = (title ? title + '\n\n' : '') + (typeof content === 'string' ? content.replace(/<[^>]+>/g, '') : '');
      
      if (showConfirm) {
        if (window.confirm(message) && onConfirm) onConfirm();
      } else {
        window.alert(message);
      }
    },

    _trapFocus(container) {
      const focusableElements = container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];

      container.addEventListener('keydown', function trapHandler(e) {
        if (e.key !== 'Tab') return;

        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            lastFocusable.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            firstFocusable.focus();
            e.preventDefault();
          }
        }
      });
    }
  };

  /* -------------------------
     Toast Notifications
     ------------------------- */
  const Toast = {
    container: null,
    queue: [],

    init() {
      if (!this.container) {
        this.container = document.createElement('div');
        this.container.id = 'toast-container';
        this.container.setAttribute('aria-live', 'polite');
        this.container.setAttribute('aria-atomic', 'true');
        this.container.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 10000;
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-width: 400px;
        `;
        document.body.appendChild(this.container);
      }
    },

    show(message, type = 'info', duration = 3000) {
      this.init();

      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.setAttribute('role', 'alert');
      
      const colors = {
        success: { bg: '#10b981', icon: '✓' },
        error: { bg: '#ef4444', icon: '✕' },
        warning: { bg: '#f59e0b', icon: '⚠' },
        info: { bg: '#3b82f6', icon: 'ℹ' }
      };

      const config = colors[type] || colors.info;

      toast.style.cssText = `
        background: ${config.bg};
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 10px;
        animation: slideIn 0.3s ease;
        max-width: 100%;
        word-wrap: break-word;
      `;

      toast.innerHTML = `
        <span style="font-size: 18px; font-weight: bold;">${config.icon}</span>
        <span style="flex: 1;">${Sanitizer.escape(message)}</span>
        <button style="background: transparent; border: none; color: white; cursor: pointer; font-size: 18px; padding: 0 4px;" aria-label="Close">&times;</button>
      `;

      const closeBtn = toast.querySelector('button');
      closeBtn.onclick = () => this.hide(toast);

      this.container.appendChild(toast);

      // Auto-hide
      if (duration > 0) {
        setTimeout(() => this.hide(toast), duration);
      }

      return toast;
    },

    hide(toast) {
      if (!toast || !toast.parentNode) return;
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    },

    success(message, duration) { return this.show(message, 'success', duration); },
    error(message, duration) { return this.show(message, 'error', duration); },
    warning(message, duration) { return this.show(message, 'warning', duration); },
    info(message, duration) { return this.show(message, 'info', duration); }
  };

  // Add animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
  `;
  document.head.appendChild(style);

  /* -------------------------
     Date & Time Utilities
     ------------------------- */
  const DateUtils = {
    format(date, format = 'YYYY-MM-DD') {
      const d = date instanceof Date ? date : new Date(date);
      if (isNaN(d.getTime())) return '';

      const parts = {
        YYYY: d.getFullYear(),
        MM: String(d.getMonth() + 1).padStart(2, '0'),
        DD: String(d.getDate()).padStart(2, '0'),
        HH: String(d.getHours()).padStart(2, '0'),
        mm: String(d.getMinutes()).padStart(2, '0'),
        ss: String(d.getSeconds()).padStart(2, '0')
      };

      return format.replace(/YYYY|MM|DD|HH|mm|ss/g, match => parts[match]);
    },

    parse(dateStr) {
      if (!dateStr) return null;
      const [y, m, d] = dateStr.split('-').map(Number);
      if (!y || !m || !d) return null;
      return new Date(y, m - 1, d);
    },

    today() {
      return this.format(new Date());
    },

    addDays(dateStr, days) {
      const d = this.parse(dateStr) || new Date();
      d.setDate(d.getDate() + days);
      return this.format(d);
    },

    isPast(dateStr) {
      const d = this.parse(dateStr);
      if (!d) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return d < today;
    },

    isFuture(dateStr) {
      const d = this.parse(dateStr);
      if (!d) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return d > today;
    },

    isToday(dateStr) {
      return dateStr === this.today();
    },

    daysBetween(date1Str, date2Str) {
      const d1 = this.parse(date1Str);
      const d2 = this.parse(date2Str);
      if (!d1 || !d2) return 0;
      const diff = d2 - d1;
      return Math.floor(diff / (1000 * 60 * 60 * 24));
    },

    getSlotStartDateTime(dateStr, slot) {
      const d = this.parse(dateStr);
      if (!d) return null;
      d.setHours(slot.startHour || 0, 0, 0, 0);
      return d;
    },

    hoursUntilSlot(dateStr, slot) {
      const slotStart = this.getSlotStartDateTime(dateStr, slot);
      if (!slotStart) return 0;
      const diffMs = slotStart - Date.now();
      return diffMs / (1000 * 60 * 60);
    }
  };

  /* -------------------------
     Validation Helpers
     ------------------------- */
  const Validator = {
    email(email) {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return re.test(String(email).toLowerCase());
    },

    phone(phone) {
      // Flexible phone validation (supports various formats)
      const cleaned = String(phone).replace(/\D/g, '');
      return cleaned.length >= 10 && cleaned.length <= 15;
    },

    required(value, fieldName = 'Field') {
      if (!value || String(value).trim() === '') {
        return { valid: false, error: `${fieldName} is required` };
      }
      return { valid: true };
    },

    minLength(value, min, fieldName = 'Field') {
      if (String(value).length < min) {
        return { valid: false, error: `${fieldName} must be at least ${min} characters` };
      }
      return { valid: true };
    },

    maxLength(value, max, fieldName = 'Field') {
      if (String(value).length > max) {
        return { valid: false, error: `${fieldName} must be no more than ${max} characters` };
      }
      return { valid: true };
    },

    number(value, fieldName = 'Field') {
      if (isNaN(Number(value))) {
        return { valid: false, error: `${fieldName} must be a number` };
      }
      return { valid: true };
    },

    range(value, min, max, fieldName = 'Field') {
      const num = Number(value);
      if (isNaN(num) || num < min || num > max) {
        return { valid: false, error: `${fieldName} must be between ${min} and ${max}` };
      }
      return { valid: true };
    },

    date(dateStr, fieldName = 'Date') {
      const d = DateUtils.parse(dateStr);
      if (!d || isNaN(d.getTime())) {
        return { valid: false, error: `${fieldName} is invalid` };
      }
      return { valid: true };
    },

    futureDate(dateStr, fieldName = 'Date') {
      const check = this.date(dateStr, fieldName);
      if (!check.valid) return check;
      
      if (DateUtils.isPast(dateStr)) {
        return { valid: false, error: `${fieldName} cannot be in the past` };
      }
      return { valid: true };
    }
  };

  /* -------------------------
     Sanitization
     ------------------------- */
  const Sanitizer = {
    escape(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },

    stripTags(str) {
      return String(str).replace(/<[^>]*>/g, '');
    }
  };

  /* -------------------------
     Performance Utilities
     ------------------------- */
  const Performance = {
    debounce(func, wait = 300) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    },

    throttle(func, limit = 300) {
      let inThrottle;
      return function(...args) {
        if (!inThrottle) {
          func.apply(this, args);
          inThrottle = true;
          setTimeout(() => inThrottle = false, limit);
        }
      };
    }
  };

  /* -------------------------
     Loading States
     ------------------------- */
  const Loading = {
    show(target, message = 'Loading...') {
      const container = typeof target === 'string' ? document.querySelector(target) : target;
      if (!container) return;

      const loader = document.createElement('div');
      loader.className = 'loading-overlay';
      loader.setAttribute('aria-busy', 'true');
      loader.setAttribute('aria-live', 'polite');
      loader.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.9);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 100;
        border-radius: inherit;
      `;

      loader.innerHTML = `
        <div class="spinner" style="
          border: 4px solid #f3f3f3;
          border-top: 4px solid #2c3e50;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
        "></div>
        <div style="margin-top: 12px; color: #2c3e50; font-weight: 600;">${Sanitizer.escape(message)}</div>
      `;

      container.style.position = container.style.position || 'relative';
      container.appendChild(loader);

      return loader;
    },

    hide(loader) {
      if (loader && loader.parentNode) {
        loader.parentNode.removeChild(loader);
      }
    }
  };

  // Add spinner animation
  const spinnerStyle = document.createElement('style');
  spinnerStyle.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(spinnerStyle);

  /* -------------------------
     Unique ID Generator
     ------------------------- */
  function uid(prefix = '') {
    return prefix + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  /* -------------------------
     Initialize
     ------------------------- */
  function init() {
    ErrorHandler.info('SharedUtils initialized', { version: STORAGE_VERSION });
    Toast.init();
    Storage.migrate();
    
    // Global error handler
    window.addEventListener('error', (event) => {
      ErrorHandler.error('Uncaught error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      ErrorHandler.error('Unhandled promise rejection', event.reason);
    });
  }

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* -------------------------
     Public API
     ------------------------- */
  return {
    version: STORAGE_VERSION,
    Storage,
    Modal,
    Toast,
    DateUtils,
    Validator,
    Sanitizer,
    Performance,
    Loading,
    ErrorHandler,
    uid,
    STORAGE_KEYS
  };
})();

// Make available globally
if (typeof window !== 'undefined') {
  window.SharedUtils = SharedUtils;
}
