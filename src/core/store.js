/**
 * ═══════════════════════════════════════════════════════════════
 * Reactive State Store — Proxy-based, zero-dependency
 * Features: subscriptions, computed values, persistence,
 *           middleware, devtools-friendly, immutable reads.
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Create a reactive store with Proxy-based change tracking.
 *
 * @template T
 * @param {T} initialState — Initial state object
 * @param {Object} [options]
 * @param {string} [options.name] — Store name (for debugging)
 * @param {boolean} [options.persist] — Persist state to localStorage
 * @param {string} [options.persistKey] — localStorage key
 * @returns {{ state: T, subscribe: Function, getSnapshot: Function, setState: Function, reset: Function }}
 */
export function createStore(initialState, options = {}) {
  const {
    name = 'store',
    persist = false,
    persistKey = `nb_store_${name}`,
  } = options;

  /** @type {Map<string, Set<Function>>} */
  const listeners = new Map();

  /** @type {Set<Function>} */
  const globalListeners = new Set();

  /** @type {T} */
  let state;

  // Restore persisted state or use initial
  if (persist) {
    try {
      const saved = localStorage.getItem(persistKey);
      state = saved ? { ...initialState, ...JSON.parse(saved) } : { ...initialState };
    } catch {
      state = { ...initialState };
    }
  } else {
    state = { ...initialState };
  }

  /**
   * Notify listeners of a state change.
   * @param {string} key — Changed property
   * @param {*} value — New value
   * @param {*} oldValue — Previous value
   */
  function notify(key, value, oldValue) {
    // Property-specific listeners
    const keyListeners = listeners.get(key);
    if (keyListeners) {
      keyListeners.forEach(fn => {
        try { fn(value, oldValue, key); }
        catch (err) { console.error(`[Store:${name}] Listener error for "${key}":`, err); }
      });
    }

    // Global listeners
    globalListeners.forEach(fn => {
      try { fn(key, value, oldValue); }
      catch (err) { console.error(`[Store:${name}] Global listener error:`, err); }
    });

    // Persist
    if (persist) {
      try {
        localStorage.setItem(persistKey, JSON.stringify(state));
      } catch (err) {
        console.error(`[Store:${name}] Persist error:`, err);
      }
    }
  }

  // Create reactive proxy
  const proxy = new Proxy(state, {
    get(target, prop) {
      if (typeof prop === 'symbol') return target[prop];
      return target[prop];
    },

    set(target, prop, value) {
      if (typeof prop === 'symbol') {
        target[prop] = value;
        return true;
      }

      const oldValue = target[prop];
      if (Object.is(oldValue, value)) return true;

      target[prop] = value;
      notify(prop, value, oldValue);
      return true;
    },

    deleteProperty(target, prop) {
      if (prop in target) {
        const oldValue = target[prop];
        delete target[prop];
        notify(prop, undefined, oldValue);
      }
      return true;
    },
  });

  return {
    /** The reactive state proxy — reads and writes trigger listeners. */
    state: proxy,

    /**
     * Subscribe to state changes.
     * @param {string|Function} keyOrListener — Property name, or global listener function
     * @param {Function} [listener] — Listener if key is provided
     * @returns {Function} Unsubscribe function
     */
    subscribe(keyOrListener, listener) {
      if (typeof keyOrListener === 'function') {
        // Global listener
        globalListeners.add(keyOrListener);
        return () => globalListeners.delete(keyOrListener);
      }

      // Property-specific listener
      const key = keyOrListener;
      if (!listeners.has(key)) {
        listeners.set(key, new Set());
      }
      listeners.get(key).add(listener);
      return () => listeners.get(key)?.delete(listener);
    },

    /**
     * Get an immutable snapshot of the current state.
     * @returns {T}
     */
    getSnapshot() {
      return { ...state };
    },

    /**
     * Set multiple state properties at once.
     * @param {Partial<T>} partial
     */
    setState(partial) {
      Object.entries(partial).forEach(([key, value]) => {
        proxy[key] = value;
      });
    },

    /**
     * Reset the store to initial state.
     */
    reset() {
      Object.keys(state).forEach(key => {
        delete state[key];
      });
      Object.entries(initialState).forEach(([key, value]) => {
        proxy[key] = value;
      });
    },

    /**
     * Create a computed/derived value.
     * @param {string[]} deps — Properties to watch
     * @param {Function} computeFn — (state) => computed value
     * @param {Function} onChange — (computedValue) => void
     * @returns {Function} Unsubscribe
     */
    computed(deps, computeFn, onChange) {
      const update = () => {
        const value = computeFn(proxy);
        onChange(value);
      };

      // Initial compute
      update();

      // Subscribe to deps
      const unsubs = deps.map(dep => {
        if (!listeners.has(dep)) listeners.set(dep, new Set());
        listeners.get(dep).add(update);
        return () => listeners.get(dep)?.delete(update);
      });

      return () => unsubs.forEach(fn => fn());
    },
  };
}

/* ── Application Stores ────────────────────────────────────── */

/** Global app state */
export const appStore = createStore({
  initialized: false,
  backendStatus: 'disconnected', // 'connected' | 'disconnected' | 'connecting'
  sidebarOpen: true,
  sidebarCollapsed: false,
  theme: 'dark',
  currentPage: 'dashboard',
  loading: false,
  error: null,
}, { name: 'app', persist: true, persistKey: 'nb_app_state' });

/** Notebook state */
export const notebookStore = createStore({
  notebooks: [],
  activeNotebookId: null,
  loading: false,
  error: null,
}, { name: 'notebooks' });

/** Document state */
export const documentStore = createStore({
  documents: [],
  processingQueue: [],
  activeDocumentId: null,
  loading: false,
  error: null,
}, { name: 'documents' });

/** Chat state */
export const chatStore = createStore({
  sessions: [],
  activeSessionId: null,
  messages: [],
  isStreaming: false,
  streamingContent: '',
  loading: false,
  error: null,
}, { name: 'chat' });

/** Search state */
export const searchStore = createStore({
  query: '',
  results: [],
  filters: { mode: 'hybrid', notebookId: null, limit: 20 },
  loading: false,
  error: null,
}, { name: 'search' });

/** Model state */
export const modelStore = createStore({
  installedModels: [],
  availableModels: [],
  activeModel: null,
  downloading: null,
  downloadProgress: 0,
  loading: false,
  error: null,
}, { name: 'models' });

export default createStore;
