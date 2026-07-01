/**
 * ═══════════════════════════════════════════════════════════════
 * Utility Functions
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Generate a UUID v4.
 * @returns {string}
 */
export function uuid() {
  return crypto.randomUUID();
}

/**
 * Debounce a function.
 * @param {Function} fn
 * @param {number} delay — Milliseconds
 * @returns {Function}
 */
export function debounce(fn, delay = 300) {
  let timer;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

/**
 * Throttle a function.
 * @param {Function} fn
 * @param {number} limit — Milliseconds
 * @returns {Function}
 */
export function throttle(fn, limit = 200) {
  let inThrottle = false;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => { inThrottle = false; }, limit);
    }
  };
}

/**
 * Format a timestamp to a human-readable relative time.
 * @param {string|Date} date
 * @returns {string}
 */
export function timeAgo(date) {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = now - then;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

/**
 * Format file size in bytes to human-readable.
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format a number with thousand separators.
 * @param {number} num
 * @returns {string}
 */
export function formatNumber(num) {
  return new Intl.NumberFormat().format(num);
}

/**
 * Truncate text with ellipsis.
 * @param {string} str
 * @param {number} max
 * @returns {string}
 */
export function truncate(str, max = 100) {
  if (str.length <= max) return str;
  return str.slice(0, max - 3) + '...';
}

/**
 * Escape HTML to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Simple slugify.
 * @param {string} str
 * @returns {string}
 */
export function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Clamp a number between min and max.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Wait for a given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get file extension from filename.
 * @param {string} filename
 * @returns {string}
 */
export function getFileExtension(filename) {
  return filename.split('.').pop()?.toLowerCase() || '';
}

/**
 * Get file type category from extension.
 * @param {string} ext
 * @returns {string}
 */
export function getFileTypeCategory(ext) {
  const map = {
    pdf: 'pdf', docx: 'word', doc: 'word',
    txt: 'text', md: 'markdown', markdown: 'markdown',
    csv: 'data', json: 'data', xml: 'data',
    xlsx: 'excel', xls: 'excel',
    pptx: 'presentation', ppt: 'presentation',
    html: 'web', htm: 'web',
    png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image',
    py: 'code', js: 'code', ts: 'code', rs: 'code', java: 'code',
    cpp: 'code', c: 'code', go: 'code', rb: 'code', php: 'code',
    zip: 'archive', tar: 'archive', gz: 'archive',
  };
  return map[ext] || 'unknown';
}

/**
 * Get icon name for a file type.
 * @param {string} ext
 * @returns {string}
 */
export function getFileIcon(ext) {
  const icons = {
    pdf: 'file-text', word: 'file-text', text: 'file-text',
    markdown: 'file-text', data: 'table', excel: 'table',
    presentation: 'presentation', web: 'globe', image: 'image',
    code: 'code', archive: 'archive', unknown: 'file',
  };
  const category = getFileTypeCategory(ext);
  return icons[category] || 'file';
}

/**
 * Color hash — generate a consistent HSL color from a string.
 * @param {string} str
 * @returns {string} HSL color string
 */
export function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

/**
 * Copy text to clipboard.
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
