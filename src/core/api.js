/**
 * ═══════════════════════════════════════════════════════════════
 * API Client — HTTP, WebSocket, and SSE communication
 * Features: fetch wrapper, WebSocket manager, SSE handler,
 *           retry logic, error handling, request cancellation.
 * ═══════════════════════════════════════════════════════════════
 */

const BASE_URL = '/api';
const WS_URL = `ws://${window.location.hostname}:8741/ws`;

/* ── HTTP Client ─────────────────────────────────────────── */

/**
 * @typedef {Object} ApiResponse
 * @property {boolean} ok
 * @property {number} status
 * @property {*} data
 * @property {string|null} error
 */

/**
 * Make an HTTP request to the backend API.
 * @param {string} endpoint — API path (e.g. '/notebooks')
 * @param {Object} [options]
 * @param {string} [options.method='GET']
 * @param {Object|FormData} [options.body]
 * @param {Object} [options.headers]
 * @param {AbortSignal} [options.signal]
 * @param {number} [options.timeout=30000]
 * @param {number} [options.retries=0]
 * @returns {Promise<ApiResponse>}
 */
export async function apiRequest(endpoint, options = {}) {
  const {
    method = 'GET',
    body,
    headers = {},
    signal,
    timeout = 30000,
    retries = 0,
  } = options;

  const url = `${BASE_URL}${endpoint}`;

  // Build fetch options
  const fetchOptions = {
    method,
    headers: { ...headers },
    signal,
  };

  if (body) {
    if (body instanceof FormData) {
      fetchOptions.body = body;
      // Don't set Content-Type; browser sets multipart boundary
    } else {
      fetchOptions.headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify(body);
    }
  }

  // Timeout wrapper
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  if (signal) {
    signal.addEventListener('abort', () => controller.abort());
  }
  fetchOptions.signal = controller.signal;

  let lastError = null;
  const maxAttempts = retries + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      let data = null;
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          data: null,
          error: data?.detail || data?.message || `HTTP ${response.status}`,
        };
      }

      return { ok: true, status: response.status, data, error: null };

    } catch (err) {
      lastError = err;
      clearTimeout(timeoutId);

      if (err.name === 'AbortError') {
        return { ok: false, status: 0, data: null, error: 'Request cancelled or timed out' };
      }

      // Retry with exponential backoff
      if (attempt < maxAttempts) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  return {
    ok: false,
    status: 0,
    data: null,
    error: lastError?.message || 'Network error',
  };
}

/* ── Convenience Methods ─────────────────────────────────── */

/** @param {string} endpoint */
export const api = {
  get: (endpoint, opts) => apiRequest(endpoint, { method: 'GET', ...opts }),
  post: (endpoint, body, opts) => apiRequest(endpoint, { method: 'POST', body, ...opts }),
  put: (endpoint, body, opts) => apiRequest(endpoint, { method: 'PUT', body, ...opts }),
  patch: (endpoint, body, opts) => apiRequest(endpoint, { method: 'PATCH', body, ...opts }),
  delete: (endpoint, opts) => apiRequest(endpoint, { method: 'DELETE', ...opts }),

  /**
   * Upload a file via multipart.
   * @param {string} endpoint
   * @param {File|File[]} files
   * @param {Object} [extraFields]
   * @param {Object} [opts]
   */
  upload: (endpoint, files, extraFields = {}, opts = {}) => {
    const formData = new FormData();
    const fileArr = Array.isArray(files) ? files : [files];
    fileArr.forEach((file, i) => formData.append(`file${i}`, file));
    Object.entries(extraFields).forEach(([k, v]) => formData.append(k, v));
    return apiRequest(endpoint, { method: 'POST', body: formData, timeout: 120000, ...opts });
  },
};


/* ── Server-Sent Events (SSE) ────────────────────────────── */

/**
 * Create an SSE connection for streaming responses (chat, progress).
 * @param {string} endpoint — Full URL or API path
 * @param {Object} [options]
 * @param {string} [options.method='POST']
 * @param {Object} [options.body]
 * @param {Function} options.onMessage — (data: Object) => void
 * @param {Function} [options.onError] — (error: Error) => void
 * @param {Function} [options.onComplete] — () => void
 * @returns {{ abort: Function }}
 */
export function createSSEStream(endpoint, options = {}) {
  const {
    method = 'POST',
    body,
    onMessage,
    onError,
    onComplete,
  } = options;

  const controller = new AbortController();
  const url = endpoint.startsWith('/api') ? endpoint : `${BASE_URL}${endpoint}`;

  (async () => {
    try {
      const fetchOptions = {
        method,
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
        signal: controller.signal,
      };

      if (body) {
        fetchOptions.body = JSON.stringify(body);
      }

      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') {
              onComplete?.();
              return;
            }
            try {
              const data = JSON.parse(dataStr);
              onMessage?.(data);
            } catch {
              // Plain text data
              onMessage?.({ content: dataStr });
            }
          }
        }
      }

      onComplete?.();
    } catch (err) {
      if (err.name !== 'AbortError') {
        onError?.(err);
      }
    }
  })();

  return {
    abort: () => controller.abort(),
  };
}


/* ── WebSocket Manager ───────────────────────────────────── */

class WebSocketManager {
  /** @type {WebSocket|null} */
  #ws = null;

  /** @type {Map<string, Set<Function>>} */
  #handlers = new Map();

  /** @type {number} */
  #reconnectAttempts = 0;

  /** @type {number} */
  #maxReconnects = 10;

  /** @type {number|null} */
  #reconnectTimer = null;

  /** @type {boolean} */
  #intentionallyClosed = false;

  /** @type {'connected'|'disconnected'|'connecting'} */
  #status = 'disconnected';

  /** @type {Function[]} */
  #statusListeners = [];

  /**
   * Connect to the WebSocket server.
   * @param {string} [url]
   */
  connect(url = WS_URL) {
    if (this.#ws?.readyState === WebSocket.OPEN) return;

    this.#intentionallyClosed = false;
    this.#setStatus('connecting');

    try {
      this.#ws = new WebSocket(url);

      this.#ws.onopen = () => {
        this.#reconnectAttempts = 0;
        this.#setStatus('connected');
        console.log('[WS] Connected');
      };

      this.#ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const type = message.type || 'message';
          this.#emit(type, message);
          this.#emit('*', message); // Wildcard handler
        } catch (err) {
          console.error('[WS] Parse error:', err);
        }
      };

      this.#ws.onclose = () => {
        this.#setStatus('disconnected');
        if (!this.#intentionallyClosed) {
          this.#scheduleReconnect(url);
        }
      };

      this.#ws.onerror = (err) => {
        console.error('[WS] Error:', err);
      };
    } catch (err) {
      console.error('[WS] Connection error:', err);
      this.#setStatus('disconnected');
      this.#scheduleReconnect(url);
    }
  }

  /**
   * Disconnect from the WebSocket server.
   */
  disconnect() {
    this.#intentionallyClosed = true;
    clearTimeout(this.#reconnectTimer);
    this.#ws?.close();
    this.#ws = null;
    this.#setStatus('disconnected');
  }

  /**
   * Send a message to the server.
   * @param {string} type
   * @param {Object} payload
   */
  send(type, payload = {}) {
    if (this.#ws?.readyState !== WebSocket.OPEN) {
      console.warn('[WS] Not connected, cannot send');
      return;
    }
    this.#ws.send(JSON.stringify({ type, ...payload }));
  }

  /**
   * Register a message handler.
   * @param {string} type — Message type (or '*' for all)
   * @param {Function} handler
   * @returns {Function} Unsubscribe
   */
  on(type, handler) {
    if (!this.#handlers.has(type)) {
      this.#handlers.set(type, new Set());
    }
    this.#handlers.get(type).add(handler);
    return () => this.#handlers.get(type)?.delete(handler);
  }

  /**
   * Watch connection status.
   * @param {Function} listener — (status: string) => void
   * @returns {Function} Unsubscribe
   */
  onStatus(listener) {
    this.#statusListeners.push(listener);
    listener(this.#status); // Immediate call with current status
    return () => {
      this.#statusListeners = this.#statusListeners.filter(l => l !== listener);
    };
  }

  /** @returns {'connected'|'disconnected'|'connecting'} */
  get status() {
    return this.#status;
  }

  /* ── Private ───────────────────────────────────────────── */

  #emit(type, data) {
    this.#handlers.get(type)?.forEach(handler => {
      try { handler(data); }
      catch (err) { console.error(`[WS] Handler error for "${type}":`, err); }
    });
  }

  #setStatus(status) {
    this.#status = status;
    this.#statusListeners.forEach(fn => fn(status));
  }

  #scheduleReconnect(url) {
    if (this.#reconnectAttempts >= this.#maxReconnects) {
      console.warn('[WS] Max reconnect attempts reached');
      return;
    }
    this.#reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.#reconnectAttempts - 1), 30000);
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.#reconnectAttempts})`);
    this.#reconnectTimer = setTimeout(() => this.connect(url), delay);
  }
}

/** Singleton WebSocket manager */
export const ws = new WebSocketManager();

export default api;
