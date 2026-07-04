/**
 * ═══════════════════════════════════════════════════════════════
 * Chat Service — Frontend API client for chat-with-documents
 * Handles session CRUD and SSE streaming for chat messages.
 * ═══════════════════════════════════════════════════════════════
 */

import { api, createSSEStream } from '@core/api.js';

/**
 * Create a new chat session.
 * @param {string} notebookId
 * @param {string} [modelId]
 * @param {string} [title]
 * @returns {Promise<import('@core/api.js').ApiResponse>}
 */
export function createSession(notebookId, modelId = '', title = 'New Chat') {
  return api.post('/chat/sessions', {
    notebook_id: notebookId,
    model_id: modelId,
    title,
  });
}

/**
 * List chat sessions.
 * @param {string} [notebookId] — Optional filter
 * @returns {Promise<import('@core/api.js').ApiResponse>}
 */
export function listSessions(notebookId = '') {
  const params = notebookId ? `?notebook_id=${encodeURIComponent(notebookId)}` : '';
  return api.get(`/chat/sessions${params}`);
}

/**
 * Get a chat session with its message history.
 * @param {string} sessionId
 * @returns {Promise<import('@core/api.js').ApiResponse>}
 */
export function getSession(sessionId) {
  return api.get(`/chat/sessions/${sessionId}`);
}

/**
 * Delete a chat session.
 * @param {string} sessionId
 * @returns {Promise<import('@core/api.js').ApiResponse>}
 */
export function deleteSession(sessionId) {
  return api.delete(`/chat/sessions/${sessionId}`);
}

/**
 * Send a chat message with SSE streaming response.
 *
 * @param {string} sessionId
 * @param {string} content — The user's message
 * @param {Object} callbacks
 * @param {Function} callbacks.onStatus    — (message: string) => void
 * @param {Function} callbacks.onRetrieval — (data: {chunks, count}) => void
 * @param {Function} callbacks.onToken     — (content: string) => void
 * @param {Function} callbacks.onCitations — (citations: Array) => void
 * @param {Function} callbacks.onDone      — (data: {message_id, latency_ms}) => void
 * @param {Function} callbacks.onError     — (message: string) => void
 * @param {string}   [model] — Optional model override
 * @returns {{ abort: Function }}
 */
export function sendMessage(sessionId, content, callbacks = {}, model = null) {
  const {
    onStatus,
    onRetrieval,
    onToken,
    onCitations,
    onDone,
    onError,
  } = callbacks;

  return createSSEStream(`/chat/sessions/${sessionId}/messages`, {
    method: 'POST',
    body: { content, model },
    onMessage: (data) => {
      switch (data.type) {
        case 'status':
          onStatus?.(data.message);
          break;
        case 'retrieval':
          onRetrieval?.(data);
          break;
        case 'token':
          onToken?.(data.content);
          break;
        case 'citations':
          onCitations?.(data.data);
          break;
        case 'done':
          onDone?.(data);
          break;
        case 'error':
          onError?.(data.message);
          break;
        default:
          console.debug('[ChatService] Unknown event type:', data.type);
      }
    },
    onError: (err) => {
      onError?.(err.message || 'Connection lost');
    },
    onComplete: () => {
      // Stream finished — onDone should have already fired
    },
  });
}

export default {
  createSession,
  listSessions,
  getSession,
  deleteSession,
  sendMessage,
};
