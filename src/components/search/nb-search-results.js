/**
 * ═══════════════════════════════════════════════════════════════
 * nb-search-results — Search results display component.
 * Features: result cards with highlights, score bars, document
 *           badges, loading skeletons, empty state, animations.
 * ═══════════════════════════════════════════════════════════════
 */

import { NbComponent, defineComponent } from '@core/component.js';
import { deleteDocument } from '@services/document-service.js';

class NbSearchResults extends NbComponent {

  onMount() {
    this.setState({
      results: [],
      total: 0,
      latency_ms: 0,
      mode: 'hybrid',
      query: '',
      loading: false,
      error: null,
      selectedResult: null,
    });

    // Handle clicks for opening/closing the modal and delete button
    this.on(this.shadowRoot, 'click', async (e) => {
      // Close modal if clicking outside or on close button
      if (e.target.closest('.modal-close') || e.target.classList.contains('modal-backdrop')) {
        this.setState({ selectedResult: null });
        return;
      }

      // Handle delete button click
      const deleteBtn = e.target.closest('.result-card__delete');
      if (deleteBtn) {
        e.stopPropagation();
        const docId = deleteBtn.getAttribute('data-doc-id');
        if (!docId) return;
        
        if (!confirm('Are you sure you want to delete this document?')) return;
        
        deleteBtn.style.opacity = '0.5';
        deleteBtn.style.pointerEvents = 'none';
        
        const result = await deleteDocument(docId);
        if (result.ok) {
          // Remove all results from this document
          this.setState({
            results: this.state.results.filter(r => r.document_id !== docId),
            total: this.state.total - this.state.results.filter(r => r.document_id === docId).length
          });
          // Dispatch global event so the Notebook page also updates
          this.emit('document-deleted', { id: docId });
        } else {
          alert('Failed to delete document');
          deleteBtn.style.opacity = '1';
          deleteBtn.style.pointerEvents = 'auto';
        }
        return;
      }

      // Open modal if clicking a result card
      const card = e.target.closest('.result-card');
      if (card) {
        const index = parseInt(card.dataset.index, 10);
        if (!isNaN(index) && this.state.results[index]) {
          this.setState({ selectedResult: this.state.results[index] });
        }
      }
    });
  }

  /**
   * Update results externally from the search page.
   * @param {Object} data - { results, total, latency_ms, mode, query }
   */
  setResults(data) {
    this.setState({
      results: data.results || [],
      total: data.total || 0,
      latency_ms: data.latency_ms || 0,
      mode: data.mode || 'hybrid',
      query: data.query || '',
      loading: false,
      error: null,
    });
  }

  setLoading(isLoading) {
    this.setState({ loading: isLoading });
  }

  setError(errorMsg) {
    this.setState({ error: errorMsg, loading: false });
  }

  clear() {
    this.setState({
      results: [],
      total: 0,
      latency_ms: 0,
      query: '',
      loading: false,
      error: null,
    });
  }

  _highlightContent(content, query) {
    if (!content || !query) return this._escapeHtml(content);

    const escaped = this._escapeHtml(content);
    const terms = query.split(/\s+/).filter(t => t.length >= 2);
    if (!terms.length) return escaped;

    // Build regex from terms
    const pattern = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const regex = new RegExp(`(${pattern})`, 'gi');

    return escaped.replace(regex, '<mark class="highlight">$1</mark>');
  }

  _escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  _truncate(str, maxLen = 300) {
    if (!str || str.length <= maxLen) return str;
    return str.substring(0, maxLen) + '…';
  }

  _getScoreColor(score) {
    if (score >= 0.8) return 'var(--color-success, hsl(142, 71%, 45%))';
    if (score >= 0.5) return 'var(--color-accent, hsl(250, 85%, 65%))';
    if (score >= 0.3) return 'var(--color-warning, hsl(38, 92%, 50%))';
    return 'var(--color-text-tertiary)';
  }

  _getFileTypeIcon(docName) {
    if (!docName) return 'file';
    const ext = docName.split('.').pop()?.toLowerCase();
    const iconMap = {
      pdf: 'file-text', docx: 'file-text', doc: 'file-text',
      txt: 'file', md: 'file', csv: 'table',
      json: 'braces', xml: 'code', html: 'globe',
      py: 'code', js: 'code', ts: 'code', rs: 'code',
      java: 'code', cpp: 'code', go: 'code',
    };
    return iconMap[ext] || 'file';
  }

  styles() {
    return `
      ${NbComponent.sharedStyles()}

      :host {
        display: block;
      }

      /* ── Stats Bar ──────────────────────────────────────── */
      .results-stats {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 0;
        color: var(--color-text-secondary);
        font-size: 0.8125rem;
      }

      .stats-left {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .stats-count {
        color: var(--color-text-primary);
        font-weight: 600;
      }

      .stats-latency {
        color: var(--color-text-tertiary);
      }

      .stats-mode {
        padding: 2px 10px;
        background: hsla(250, 85%, 65%, 0.1);
        color: var(--color-accent, hsl(250, 85%, 65%));
        border-radius: var(--radius-full, 9999px);
        font-size: 0.75rem;
        font-weight: 500;
        text-transform: capitalize;
      }

      /* ── Results List ───────────────────────────────────── */
      .results-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      /* ── Result Card ────────────────────────────────────── */
      .result-card {
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md, 10px);
        padding: 16px 20px;
        cursor: pointer;
        transition: all var(--transition-fast, 150ms);
        animation: resultFadeIn 0.3s ease forwards;
        opacity: 0;
        transform: translateY(8px);
      }

      .result-card:hover {
        border-color: var(--color-accent, hsl(250, 85%, 65%));
        background: var(--color-bg-elevated);
        box-shadow: 0 4px 16px hsla(250, 85%, 65%, 0.08);
        transform: translateY(-1px);
      }

      @keyframes resultFadeIn {
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .result-card__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 10px;
      }

      .result-card__doc {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--color-text-secondary);
        font-size: 0.8125rem;
      }

      .result-card__doc-icon {
        display: flex;
        align-items: center;
        color: var(--color-accent);
      }

      .result-card__doc-name {
        font-weight: 500;
        color: var(--color-text-primary);
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .result-card__meta {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 0.75rem;
        color: var(--color-text-tertiary);
      }

      .result-card__page {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .result-card__section {
        display: flex;
        align-items: center;
        gap: 4px;
        max-width: 150px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* ── Content ────────────────────────────────────────── */
      .result-card__content {
        font-size: 0.875rem;
        line-height: 1.65;
        color: var(--color-text-secondary);
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 4;
        -webkit-box-orient: vertical;
      }

      .result-card__content .highlight {
        background: hsla(250, 85%, 65%, 0.2);
        color: var(--color-accent-hover, hsl(250, 85%, 72%));
        padding: 1px 3px;
        border-radius: 3px;
        font-weight: 500;
      }

      /* ── Score Bar ──────────────────────────────────────── */
      .result-card__footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 12px;
        padding-top: 10px;
        border-top: 1px solid var(--color-border);
      }

      .score-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.75rem;
        color: var(--color-text-tertiary);
      }

      .score-bar__track {
        width: 60px;
        height: 4px;
        background: var(--color-bg-elevated);
        border-radius: 2px;
        overflow: hidden;
      }

      .score-bar__fill {
        height: 100%;
        border-radius: 2px;
        transition: width 0.4s ease;
      }

      .score-bar__label {
        font-weight: 600;
        font-family: var(--font-mono, monospace);
        font-size: 0.6875rem;
      }

      .result-card__rank {
        font-size: 0.75rem;
        color: var(--color-text-tertiary);
        font-weight: 500;
      }

      /* ── Loading Skeleton ───────────────────────────────── */
      .skeleton-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .skeleton-card {
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md, 10px);
        padding: 16px 20px;
        animation: skeletonPulse 1.5s ease-in-out infinite;
      }

      .skeleton-line {
        height: 12px;
        background: var(--color-bg-elevated);
        border-radius: 6px;
        margin-bottom: 10px;
      }
      .skeleton-line--short { width: 40%; }
      .skeleton-line--medium { width: 70%; }
      .skeleton-line--long { width: 95%; }
      .skeleton-line:last-child { margin-bottom: 0; }

      @keyframes skeletonPulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      /* ── Empty State ────────────────────────────────────── */
      .results-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding: 60px 20px;
        color: var(--color-text-secondary);
        gap: 16px;
      }

      .empty-icon {
        width: 64px;
        height: 64px;
        border-radius: 16px;
        background: linear-gradient(135deg, hsla(250, 85%, 65%, 0.1), hsla(250, 85%, 65%, 0.05));
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--color-accent);
      }

      .empty-title {
        font-size: 1.125rem;
        font-weight: 600;
        color: var(--color-text-primary);
      }

      .empty-desc {
        font-size: 0.875rem;
        max-width: 400px;
        line-height: 1.5;
      }

      /* ── Error State ────────────────────────────────────── */
      .results-error {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 20px;
        background: hsla(0, 84%, 60%, 0.08);
        border: 1px solid hsla(0, 84%, 60%, 0.2);
        border-radius: var(--radius-md, 10px);
        color: var(--color-danger, hsl(0, 84%, 60%));
        font-size: 0.875rem;
      }

      /* ── No Results ─────────────────────────────────────── */
      .no-results {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding: 48px 20px;
        gap: 12px;
        color: var(--color-text-secondary);
      }

      .no-results__title {
        font-size: 1rem;
        font-weight: 600;
        color: var(--color-text-primary);
      }

      /* ── Modal Overlay ──────────────────────────────────── */
      .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: hsla(0, 0%, 0%, 0.6);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        animation: fadeIn 0.2s ease forwards;
      }

      .modal-content {
        background: var(--color-bg-elevated);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg, 16px);
        width: 90%;
        max-width: 800px;
        max-height: 85vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 20px 40px hsla(0, 0%, 0%, 0.4);
        transform: scale(0.95);
        animation: scaleUp 0.2s ease forwards;
      }

      @keyframes fadeIn {
        to { opacity: 1; }
      }

      @keyframes scaleUp {
        to { transform: scale(1); }
      }

      .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 24px;
        border-bottom: 1px solid var(--color-border);
      }

      .modal-header .result-card__doc-name {
        font-size: 1.125rem;
        max-width: none;
      }

      .modal-close {
        color: var(--color-text-secondary);
        padding: 8px;
        border-radius: 8px;
        transition: all 0.2s;
        display: flex;
      }
      .modal-close:hover {
        background: var(--color-bg-secondary);
        color: var(--color-text-primary);
      }

      .modal-body {
        padding: 24px;
        overflow-y: auto;
        font-size: 0.9375rem;
        line-height: 1.7;
        color: var(--color-text-primary);
        white-space: pre-wrap;
      }

      .modal-body .highlight {
        background: hsla(250, 85%, 65%, 0.2);
        color: var(--color-accent-hover, hsl(250, 85%, 72%));
        padding: 1px 3px;
        border-radius: 3px;
        font-weight: 500;
      }
    `;
  }

  render() {
    const { results = [], total = 0, latency_ms = 0, mode = 'hybrid', query = '', loading = false, error = null, selectedResult = null } = this.state || {};

    // Loading state
    if (loading) {
      return this._renderLoading();
    }

    // Error state
    if (error) {
      return `
        <div class="results-error">
          <nb-icon name="alert-circle" size="18"></nb-icon>
          <span>${this._escapeHtml(error)}</span>
        </div>
      `;
    }

    // No query yet — show empty state
    if (!query) {
      return `
        <div class="results-empty">
          <div class="empty-icon">
            <nb-icon name="search" size="28"></nb-icon>
          </div>
          <div class="empty-title">Search your documents</div>
          <div class="empty-desc">
            Enter a query above to find relevant passages across all your
            indexed documents using semantic, keyword, or hybrid search.
          </div>
        </div>
      `;
    }

    // Query executed but no results
    if (query && results.length === 0) {
      return `
        <div class="no-results">
          <nb-icon name="search-x" size="32" color="var(--color-text-tertiary)"></nb-icon>
          <div class="no-results__title">No results found</div>
          <div>Try different keywords or switch to a different search mode.</div>
        </div>
      `;
    }

    // Results
    const resultCards = results.map((r, i) => this._renderCard(r, i)).join('');

    let modalHtml = '';
    if (selectedResult) {
      modalHtml = this._renderModal(selectedResult);
    }

    return `
      <div class="results-stats">
        <div class="stats-left">
          <span class="stats-count">${total} result${total !== 1 ? 's' : ''}</span>
          <span class="stats-latency">in ${latency_ms.toFixed(0)}ms</span>
        </div>
        <span class="stats-mode">${mode}</span>
      </div>
      <div class="results-list">
        ${resultCards}
      </div>
      ${modalHtml}
    `;
  }

  _renderModal(result) {
    const icon = this._getFileTypeIcon(result.document_name);
    const highlightedContent = this._highlightContent(result.content, this.state.query);
    
    return `
      <div class="modal-backdrop">
        <div class="modal-content" aria-modal="true" role="dialog">
          <div class="modal-header">
            <div class="result-card__doc">
              <div class="result-card__doc-icon">
                <nb-icon name="${icon}" size="18"></nb-icon>
              </div>
              <span class="result-card__doc-name">${this._escapeHtml(result.document_name || 'Unknown Document')}</span>
              ${result.page_number ? `
                <span class="result-card__page" style="margin-left: 8px;">
                  <nb-icon name="file" size="14"></nb-icon>
                  p.${result.page_number}
                </span>
              ` : ''}
            </div>
            <button class="modal-close" aria-label="Close">
              <nb-icon name="x" size="20"></nb-icon>
            </button>
          </div>
          <div class="modal-body">
            ${highlightedContent}
          </div>
        </div>
      </div>
    `;
  }

  _renderCard(result, index) {
    const scorePercent = Math.min(Math.max(result.score * 100, 0), 100);
    const scoreColor = this._getScoreColor(result.score);
    const highlightedContent = this._highlightContent(
      this._truncate(result.content),
      this.state.query,
    );
    const icon = this._getFileTypeIcon(result.document_name);
    const delay = index * 0.05;

    return `
      <div class="result-card" data-index="${index}" style="animation-delay: ${delay}s">
        <div class="result-card__header">
          <div class="result-card__doc">
            <div class="result-card__doc-icon">
              <nb-icon name="${icon}" size="14"></nb-icon>
            </div>
            <span class="result-card__doc-name">${this._escapeHtml(result.document_name || 'Unknown')}</span>
          </div>
          <div class="result-card__meta">
            ${result.page_number ? `
              <span class="result-card__page">
                <nb-icon name="file" size="11"></nb-icon>
                p.${result.page_number}
              </span>
            ` : ''}
            ${result.section_title ? `
              <span class="result-card__section" title="${this._escapeHtml(result.section_title)}">
                <nb-icon name="hash" size="11"></nb-icon>
                ${this._escapeHtml(result.section_title)}
              </span>
            ` : ''}
            <button class="result-card__delete" data-doc-id="${result.document_id}" aria-label="Delete document" style="background: none; border: none; cursor: pointer; color: var(--color-danger, #ef4444); display: flex; align-items: center; justify-content: center; padding: 4px; border-radius: 4px; margin-left: 8px;">
              <nb-icon name="trash-2" size="14"></nb-icon>
            </button>
          </div>
        </div>
        <div class="result-card__content">
          ${highlightedContent}
        </div>
        <div class="result-card__footer">
          <div class="score-bar">
            <span>Relevance</span>
            <div class="score-bar__track">
              <div class="score-bar__fill" style="width: ${scorePercent}%; background: ${scoreColor}"></div>
            </div>
            <span class="score-bar__label" style="color: ${scoreColor}">${scorePercent.toFixed(0)}%</span>
          </div>
          <span class="result-card__rank">#${index + 1}</span>
        </div>
      </div>
    `;
  }

  _renderLoading() {
    const skeletons = Array.from({ length: 4 }, (_, i) => `
      <div class="skeleton-card" style="animation-delay: ${i * 0.15}s">
        <div class="skeleton-line skeleton-line--short"></div>
        <div class="skeleton-line skeleton-line--long"></div>
        <div class="skeleton-line skeleton-line--medium"></div>
        <div class="skeleton-line skeleton-line--short"></div>
      </div>
    `).join('');

    return `
      <div class="skeleton-list">
        ${skeletons}
      </div>
    `;
  }
}

defineComponent('nb-search-results', NbSearchResults);
export default NbSearchResults;
