/**
 * ═══════════════════════════════════════════════════════════════
 * Global Event Bus — Cross-component communication
 * Features: typed events, once, wildcard, namespaces.
 * ═══════════════════════════════════════════════════════════════
 */

class EventBus {
  /** @type {Map<string, Set<Function>>} */
  #handlers = new Map();

  /**
   * Subscribe to an event.
   * @param {string} event — Event name (supports namespace: 'chat.message')
   * @param {Function} handler
   * @returns {Function} Unsubscribe function
   */
  on(event, handler) {
    if (!this.#handlers.has(event)) {
      this.#handlers.set(event, new Set());
    }
    this.#handlers.get(event).add(handler);
    return () => this.off(event, handler);
  }

  /**
   * Subscribe to an event — fires once then auto-unsubscribes.
   * @param {string} event
   * @param {Function} handler
   * @returns {Function} Unsubscribe function
   */
  once(event, handler) {
    const wrapper = (...args) => {
      this.off(event, wrapper);
      handler(...args);
    };
    return this.on(event, wrapper);
  }

  /**
   * Unsubscribe from an event.
   * @param {string} event
   * @param {Function} handler
   */
  off(event, handler) {
    this.#handlers.get(event)?.delete(handler);
  }

  /**
   * Emit an event.
   * @param {string} event
   * @param {*} [data]
   */
  emit(event, data) {
    // Exact match handlers
    this.#handlers.get(event)?.forEach(handler => {
      try { handler(data); }
      catch (err) { console.error(`[EventBus] Error in handler for "${event}":`, err); }
    });

    // Wildcard handlers
    this.#handlers.get('*')?.forEach(handler => {
      try { handler(event, data); }
      catch (err) { console.error('[EventBus] Error in wildcard handler:', err); }
    });

    // Namespace handlers (e.g., 'chat.*' catches 'chat.message')
    const parts = event.split('.');
    if (parts.length > 1) {
      const namespace = parts[0] + '.*';
      this.#handlers.get(namespace)?.forEach(handler => {
        try { handler(event, data); }
        catch (err) { console.error(`[EventBus] Error in namespace handler "${namespace}":`, err); }
      });
    }
  }

  /**
   * Remove all handlers for an event, or all handlers entirely.
   * @param {string} [event] — If omitted, clears everything
   */
  clear(event) {
    if (event) {
      this.#handlers.delete(event);
    } else {
      this.#handlers.clear();
    }
  }

  /**
   * Check if any listeners exist for an event.
   * @param {string} event
   * @returns {boolean}
   */
  has(event) {
    return (this.#handlers.get(event)?.size || 0) > 0;
  }
}

/* ── Pre-defined event names (constants) ─────────────────── */
export const Events = {
  // App lifecycle
  APP_READY: 'app.ready',
  APP_ERROR: 'app.error',
  THEME_CHANGED: 'app.theme_changed',

  // Backend connection
  BACKEND_CONNECTED: 'backend.connected',
  BACKEND_DISCONNECTED: 'backend.disconnected',
  BACKEND_ERROR: 'backend.error',

  // Notebook events
  NOTEBOOK_CREATED: 'notebook.created',
  NOTEBOOK_UPDATED: 'notebook.updated',
  NOTEBOOK_DELETED: 'notebook.deleted',
  NOTEBOOK_SELECTED: 'notebook.selected',

  // Document events
  DOCUMENT_UPLOADED: 'document.uploaded',
  DOCUMENT_PROCESSING: 'document.processing',
  DOCUMENT_INDEXED: 'document.indexed',
  DOCUMENT_FAILED: 'document.failed',
  DOCUMENT_DELETED: 'document.deleted',
  DOCUMENT_PROGRESS: 'document.progress',

  // Chat events
  CHAT_MESSAGE_SENT: 'chat.message_sent',
  CHAT_STREAM_START: 'chat.stream_start',
  CHAT_STREAM_TOKEN: 'chat.stream_token',
  CHAT_STREAM_END: 'chat.stream_end',
  CHAT_STREAM_ERROR: 'chat.stream_error',
  CHAT_SESSION_CREATED: 'chat.session_created',

  // Search events
  SEARCH_STARTED: 'search.started',
  SEARCH_COMPLETED: 'search.completed',
  SEARCH_ERROR: 'search.error',

  // Model events
  MODEL_DOWNLOAD_START: 'model.download_start',
  MODEL_DOWNLOAD_PROGRESS: 'model.download_progress',
  MODEL_DOWNLOAD_COMPLETE: 'model.download_complete',

  // UI events
  TOAST_SHOW: 'ui.toast_show',
  MODAL_OPEN: 'ui.modal_open',
  MODAL_CLOSE: 'ui.modal_close',
  SIDEBAR_TOGGLE: 'ui.sidebar_toggle',
  NAVIGATE: 'ui.navigate',
};

/** Singleton event bus */
export const eventBus = new EventBus();

export default eventBus;
