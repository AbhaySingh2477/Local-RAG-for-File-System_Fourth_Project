/**
 * ═══════════════════════════════════════════════════════════════
 * nb-search-filters — Filter panel for search results.
 * Features: document filter, file type filter, result limit
 *           slider, active filter badges, reset button.
 * ═══════════════════════════════════════════════════════════════
 */

import { NbComponent, defineComponent } from '@core/component.js';
import { listDocuments } from '@services/document-service.js';

class NbSearchFilters extends NbComponent {

  onMount() {
    this.setState({
      documents: [],
      selectedDocId: null,
      selectedFileType: null,
      limit: 10,
      expanded: true,
    });

    this._loadDocuments();

    // Event delegation
    this.on(this.shadowRoot, 'click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;

      const action = target.dataset.action;
      if (action === 'toggle') this._toggleExpand();
      if (action === 'clear-doc') this._clearDocFilter();
      if (action === 'clear-type') this._clearTypeFilter();
      if (action === 'clear-all') this._clearAll();
      if (action === 'select-doc') this._selectDoc(target.dataset.docId);
      if (action === 'select-type') this._selectType(target.dataset.type);
    });

    // Limit slider
    const slider = this.$('.limit-slider');
    if (slider) {
      this.on(slider, 'input', (e) => {
        const limit = parseInt(e.target.value, 10);
        this.state.limit = limit;
        const label = this.$('.limit-value');
        if (label) label.textContent = limit;
        this._emitChange();
      });
    }
  }

  async _loadDocuments() {
    const result = await listDocuments();
    if (result.ok && result.data) {
      this.setState({ documents: result.data });
    }
  }

  _toggleExpand() {
    this.setState({ expanded: !this.state.expanded });
  }

  _selectDoc(docId) {
    const newId = this.state.selectedDocId === docId ? null : docId;
    this.setState({ selectedDocId: newId });
    this._emitChange();
  }

  _selectType(type) {
    const newType = this.state.selectedFileType === type ? null : type;
    this.setState({ selectedFileType: newType });
    this._emitChange();
  }

  _clearDocFilter() {
    this.setState({ selectedDocId: null });
    this._emitChange();
  }

  _clearTypeFilter() {
    this.setState({ selectedFileType: null });
    this._emitChange();
  }

  _clearAll() {
    this.setState({ selectedDocId: null, selectedFileType: null, limit: 10 });
    this._emitChange();
  }

  _emitChange() {
    const filters = {};
    if (this.state.selectedDocId) {
      filters.document_id = this.state.selectedDocId;
    }
    if (this.state.selectedFileType) {
      filters.file_type = this.state.selectedFileType;
    }

    this.emit('filters-changed', {
      filters: Object.keys(filters).length > 0 ? filters : null,
      limit: this.state.limit,
    });
  }

  /** Get current filter state */
  getFilters() {
    const filters = {};
    if (this.state.selectedDocId) filters.document_id = this.state.selectedDocId;
    if (this.state.selectedFileType) filters.file_type = this.state.selectedFileType;
    return {
      filters: Object.keys(filters).length > 0 ? filters : null,
      limit: this.state.limit,
    };
  }

  _escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  styles() {
    return `
      ${NbComponent.sharedStyles()}

      :host {
        display: block;
      }

      .filters-panel {
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg, 16px);
        overflow: hidden;
      }

      .filters-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px;
        cursor: pointer;
        user-select: none;
        transition: background var(--transition-fast, 150ms);
      }
      .filters-header:hover {
        background: var(--color-bg-elevated);
      }

      .filters-header__left {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--color-text-primary);
      }

      .filters-header__chevron {
        transition: transform var(--transition-fast, 150ms);
        color: var(--color-text-secondary);
      }
      .filters-header__chevron--open {
        transform: rotate(180deg);
      }

      .filters-body {
        padding: 0 16px 16px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .filters-body--collapsed {
        display: none;
      }

      /* ── Section ────────────────────────────────────────── */
      .filter-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .filter-section__title {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--color-text-tertiary);
      }

      /* ── Document List ──────────────────────────────────── */
      .doc-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
        max-height: 200px;
        overflow-y: auto;
      }

      .doc-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        border-radius: var(--radius-sm, 6px);
        font-size: 0.8125rem;
        color: var(--color-text-secondary);
        cursor: pointer;
        transition: all var(--transition-fast, 150ms);
        overflow: hidden;
      }
      .doc-item:hover {
        background: var(--color-bg-elevated);
        color: var(--color-text-primary);
      }
      .doc-item--active {
        background: hsla(250, 85%, 65%, 0.1);
        color: var(--color-accent, hsl(250, 85%, 65%));
      }

      .doc-item__name {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .doc-item__check {
        flex-shrink: 0;
        opacity: 0;
        transition: opacity var(--transition-fast, 150ms);
      }
      .doc-item--active .doc-item__check {
        opacity: 1;
      }

      /* ── Type Pills ─────────────────────────────────────── */
      .type-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .type-pill {
        padding: 4px 12px;
        border-radius: var(--radius-full, 9999px);
        font-size: 0.75rem;
        font-weight: 500;
        cursor: pointer;
        background: var(--color-bg-elevated);
        color: var(--color-text-secondary);
        border: 1px solid transparent;
        transition: all var(--transition-fast, 150ms);
      }
      .type-pill:hover {
        color: var(--color-text-primary);
        border-color: var(--color-border);
      }
      .type-pill--active {
        background: hsla(250, 85%, 65%, 0.1);
        color: var(--color-accent);
        border-color: hsla(250, 85%, 65%, 0.3);
      }

      /* ── Limit Slider ───────────────────────────────────── */
      .limit-row {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .limit-slider {
        flex: 1;
        -webkit-appearance: none;
        appearance: none;
        height: 4px;
        border-radius: 2px;
        background: var(--color-bg-elevated);
        outline: none;
      }

      .limit-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--color-accent);
        cursor: pointer;
        transition: transform var(--transition-fast, 150ms);
      }
      .limit-slider::-webkit-slider-thumb:hover {
        transform: scale(1.2);
      }

      .limit-value {
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--color-text-primary);
        font-family: var(--font-mono, monospace);
        min-width: 24px;
        text-align: right;
      }

      /* ── Active Filters ─────────────────────────────────── */
      .active-filters {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        padding: 12px 16px;
        border-top: 1px solid var(--color-border);
      }

      .active-badge {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        background: hsla(250, 85%, 65%, 0.1);
        color: var(--color-accent);
        border-radius: var(--radius-full, 9999px);
        font-size: 0.75rem;
        font-weight: 500;
      }

      .active-badge__dismiss {
        display: flex;
        cursor: pointer;
        opacity: 0.6;
        transition: opacity var(--transition-fast, 150ms);
      }
      .active-badge__dismiss:hover {
        opacity: 1;
      }

      .clear-all-btn {
        font-size: 0.75rem;
        color: var(--color-text-tertiary);
        cursor: pointer;
        padding: 4px 8px;
        transition: color var(--transition-fast, 150ms);
      }
      .clear-all-btn:hover {
        color: var(--color-danger);
      }

      .no-docs {
        font-size: 0.8125rem;
        color: var(--color-text-tertiary);
        padding: 8px 0;
      }
    `;
  }

  render() {
    const { documents = [], selectedDocId = null, selectedFileType = null, limit = 10, expanded = true } = this.state || {};
    const hasFilters = selectedDocId || selectedFileType;

    // Derive unique file types
    const fileTypes = [...new Set((documents || []).map(d => d.file_type).filter(Boolean))].sort();

    return `
      <div class="filters-panel">
        <div class="filters-header" data-action="toggle">
          <div class="filters-header__left">
            <nb-icon name="sliders" size="16"></nb-icon>
            Filters
          </div>
          <div class="filters-header__chevron ${expanded ? 'filters-header__chevron--open' : ''}">
            <nb-icon name="chevron-down" size="16"></nb-icon>
          </div>
        </div>

        <div class="filters-body ${expanded ? '' : 'filters-body--collapsed'}">

          <!-- Document Filter -->
          <div class="filter-section">
            <div class="filter-section__title">Document</div>
            ${documents.length > 0 ? `
              <div class="doc-list">
                ${documents.map(doc => `
                  <div
                    class="doc-item ${selectedDocId === doc.id ? 'doc-item--active' : ''}"
                    data-action="select-doc"
                    data-doc-id="${doc.id}"
                  >
                    <nb-icon name="file" size="14"></nb-icon>
                    <span class="doc-item__name">${this._escapeHtml(doc.filename)}</span>
                    <span class="doc-item__check">
                      <nb-icon name="check" size="12"></nb-icon>
                    </span>
                  </div>
                `).join('')}
              </div>
            ` : `
              <div class="no-docs">No documents indexed yet</div>
            `}
          </div>

          <!-- File Type Filter -->
          ${fileTypes.length > 0 ? `
            <div class="filter-section">
              <div class="filter-section__title">File Type</div>
              <div class="type-pills">
                ${fileTypes.map(type => `
                  <button
                    class="type-pill ${selectedFileType === type ? 'type-pill--active' : ''}"
                    data-action="select-type"
                    data-type="${type}"
                  >${type.toUpperCase()}</button>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Result Limit -->
          <div class="filter-section">
            <div class="filter-section__title">Results Limit</div>
            <div class="limit-row">
              <input
                class="limit-slider"
                type="range"
                min="5"
                max="50"
                step="5"
                value="${limit}"
              />
              <span class="limit-value">${limit}</span>
            </div>
          </div>

        </div>

        ${hasFilters ? `
          <div class="active-filters">
            ${selectedDocId ? `
              <div class="active-badge">
                <nb-icon name="file" size="12"></nb-icon>
                ${this._escapeHtml(documents.find(d => d.id === selectedDocId)?.filename || 'Document')}
                <span class="active-badge__dismiss" data-action="clear-doc">
                  <nb-icon name="x" size="10"></nb-icon>
                </span>
              </div>
            ` : ''}
            ${selectedFileType ? `
              <div class="active-badge">
                <nb-icon name="filter" size="12"></nb-icon>
                ${selectedFileType.toUpperCase()}
                <span class="active-badge__dismiss" data-action="clear-type">
                  <nb-icon name="x" size="10"></nb-icon>
                </span>
              </div>
            ` : ''}
            <button class="clear-all-btn" data-action="clear-all">Clear all</button>
          </div>
        ` : ''}
      </div>
    `;
  }
}

defineComponent('nb-search-filters', NbSearchFilters);
export default NbSearchFilters;
