/**
 * ═══════════════════════════════════════════════════════════════
 * Search Service — Frontend API client for semantic search.
 * Wraps the /api/search endpoint with convenience methods
 * and a debounced search helper for real-time search-as-you-type.
 * ═══════════════════════════════════════════════════════════════
 */

import { api } from '@core/api.js';

/**
 * Execute a search query against the backend.
 *
 * @param {string} query - Search query text
 * @param {Object} [options]
 * @param {string} [options.mode='hybrid'] - Search mode: 'vector' | 'keyword' | 'hybrid'
 * @param {number} [options.limit=10] - Max results
 * @param {string} [options.notebookId] - Scope to a notebook
 * @param {boolean} [options.rerank=true] - Apply cross-encoder reranking
 * @param {Object} [options.filters] - Optional filters
 * @returns {Promise<{ok: boolean, data: SearchResponse|null, error: string|null}>}
 */
export async function search(query, options = {}) {
  const {
    mode = 'hybrid',
    limit = 10,
    notebookId = null,
    rerank = true,
    filters = null,
  } = options;

  if (!query || !query.trim()) {
    return {
      ok: true,
      data: { results: [], total: 0, query: '', mode, latency_ms: 0 },
      error: null,
    };
  }

  const body = {
    query: query.trim(),
    mode,
    limit,
    rerank,
  };

  if (notebookId) body.notebook_id = notebookId;
  if (filters) body.filters = filters;

  return api.post('/search', body);
}

/**
 * Get search index statistics.
 *
 * @param {string} [notebookId] - Optional notebook scope
 * @returns {Promise<{ok: boolean, data: Object|null, error: string|null}>}
 */
export async function getSearchStats(notebookId = null) {
  const params = notebookId ? `?notebook_id=${encodeURIComponent(notebookId)}` : '';
  return api.get(`/search/stats${params}`);
}


/* ── Debounced Search Helper ──────────────────────────────── */

/**
 * Create a debounced search function that cancels the previous
 * request when a new one is made.
 *
 * @param {Function} onResults - Callback: (results: SearchResponse) => void
 * @param {Function} [onError] - Callback: (error: string) => void
 * @param {number} [delayMs=300] - Debounce delay in milliseconds
 * @returns {{ search: Function, cancel: Function }}
 */
export function createDebouncedSearch(onResults, onError, delayMs = 300) {
  let timer = null;
  let abortController = null;

  function doSearch(query, options = {}) {
    // Cancel previous
    clearTimeout(timer);
    if (abortController) {
      abortController.abort();
    }

    if (!query || !query.trim()) {
      onResults({ results: [], total: 0, query: '', mode: options.mode || 'hybrid', latency_ms: 0 });
      return;
    }

    timer = setTimeout(async () => {
      abortController = new AbortController();

      try {
        const result = await search(query, {
          ...options,
          signal: abortController.signal,
        });

        if (result.ok) {
          onResults(result.data);
        } else {
          onError?.(result.error || 'Search failed');
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          onError?.(err.message || 'Search error');
        }
      }
    }, delayMs);
  }

  function cancel() {
    clearTimeout(timer);
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  }

  return { search: doSearch, cancel };
}


/* ── Search Modes ─────────────────────────────────────────── */

export const SEARCH_MODES = [
  {
    id: 'hybrid',
    label: 'Hybrid',
    description: 'Vector + keyword search with RRF fusion',
    icon: 'layers',
  },
  {
    id: 'vector',
    label: 'Semantic',
    description: 'Pure embedding-based similarity search',
    icon: 'brain',
  },
  {
    id: 'keyword',
    label: 'Keyword',
    description: 'Full-text BM25 keyword search',
    icon: 'type',
  },
];

export default { search, getSearchStats, createDebouncedSearch, SEARCH_MODES };
