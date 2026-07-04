/**
 * ═══════════════════════════════════════════════════════════════
 * nb-citation — Citation chip with hover popover
 * Shows a numbered badge [1] that reveals source details on hover.
 * ═══════════════════════════════════════════════════════════════
 */

import { NbComponent, defineComponent } from '@core/component.js';

class NbCitation extends NbComponent {
  static get observedAttributes() {
    return ['index', 'document-name', 'page-number', 'excerpt', 'document-id'];
  }

  onMount() {
    this.setState({
      index: this.getAttribute('index') || '1',
      documentName: this.getAttribute('document-name') || '',
      pageNumber: this.getAttribute('page-number') || '',
      excerpt: this.getAttribute('excerpt') || '',
      documentId: this.getAttribute('document-id') || '',
      showPopover: false,
    });

    // Bind events after render
    requestAnimationFrame(() => this._bindEvents());
  }

  _bindEvents() {
    const chip = this.$('.citation-chip');
    if (!chip) return;

    this.on(chip, 'mouseenter', () => this.setState({ showPopover: true }));
    this.on(chip, 'mouseleave', () => this.setState({ showPopover: false }));
    this.on(chip, 'click', () => {
      this.emit('citation-click', {
        index: this.state.index,
        documentId: this.state.documentId,
        documentName: this.state.documentName,
        pageNumber: this.state.pageNumber,
      });
    });
  }

  /**
   * Set citation data programmatically.
   * @param {Object} data
   */
  setData(data) {
    this.setState({
      index: data.index || '1',
      documentName: data.document_name || data.documentName || '',
      pageNumber: data.page_number || data.pageNumber || '',
      excerpt: data.excerpt || '',
      documentId: data.document_id || data.documentId || '',
    });
    requestAnimationFrame(() => this._bindEvents());
  }

  styles() {
    return `
      ${NbComponent.sharedStyles()}

      :host {
        display: inline-flex;
        position: relative;
        vertical-align: baseline;
      }

      .citation-chip {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 22px;
        height: 22px;
        padding: 0 6px;
        font-size: 0.7rem;
        font-weight: 700;
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        color: var(--color-accent, hsl(250, 85%, 65%));
        background: hsla(250, 85%, 65%, 0.12);
        border: 1px solid hsla(250, 85%, 65%, 0.25);
        border-radius: var(--radius-full, 9999px);
        cursor: pointer;
        transition: all var(--transition-fast, 150ms cubic-bezier(0.4, 0, 0.2, 1));
        user-select: none;
        line-height: 1;
      }

      .citation-chip:hover {
        background: hsla(250, 85%, 65%, 0.22);
        border-color: hsla(250, 85%, 65%, 0.45);
        transform: scale(1.08);
      }

      .citation-chip:active {
        transform: scale(0.95);
      }

      .popover {
        position: absolute;
        bottom: calc(100% + 8px);
        left: 50%;
        transform: translateX(-50%);
        width: 300px;
        padding: 14px 16px;
        background: var(--color-bg-elevated, hsl(230, 15%, 18%));
        border: 1px solid var(--color-border, hsl(230, 10%, 28%));
        border-radius: var(--radius-md, 10px);
        box-shadow: var(--shadow-lg, 0 8px 32px hsla(0,0%,0%,0.5));
        z-index: 100;
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transition: opacity 0.2s ease, transform 0.2s ease;
        transform: translateX(-50%) translateY(4px);
      }

      .popover.visible {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
        transform: translateX(-50%) translateY(0);
      }

      .popover-arrow {
        position: absolute;
        bottom: -6px;
        left: 50%;
        transform: translateX(-50%) rotate(45deg);
        width: 12px;
        height: 12px;
        background: var(--color-bg-elevated, hsl(230, 15%, 18%));
        border-right: 1px solid var(--color-border, hsl(230, 10%, 28%));
        border-bottom: 1px solid var(--color-border, hsl(230, 10%, 28%));
      }

      .popover-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }

      .popover-icon {
        width: 16px;
        height: 16px;
        opacity: 0.6;
      }

      .popover-doc-name {
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--color-text-primary, hsl(0, 0%, 95%));
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
      }

      .popover-page {
        font-size: 0.7rem;
        color: var(--color-text-secondary, hsl(0, 0%, 68%));
        background: hsla(0, 0%, 100%, 0.06);
        padding: 2px 8px;
        border-radius: var(--radius-sm, 6px);
        white-space: nowrap;
      }

      .popover-excerpt {
        font-size: 0.78rem;
        color: var(--color-text-secondary, hsl(0, 0%, 68%));
        line-height: 1.5;
        max-height: 80px;
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
      }
    `;
  }

  render() {
    const { index, documentName, pageNumber, excerpt, showPopover } = this.state;

    const pageInfo = pageNumber ? `<span class="popover-page">p. ${pageNumber}</span>` : '';

    return `
      <span class="citation-chip" title="Source [${index}]: ${documentName}">${index}</span>
      <div class="popover ${showPopover ? 'visible' : ''}">
        <div class="popover-arrow"></div>
        <div class="popover-header">
          <svg class="popover-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          <span class="popover-doc-name">${documentName || 'Document'}</span>
          ${pageInfo}
        </div>
        ${excerpt ? `<div class="popover-excerpt">${this._escapeHtml(excerpt)}</div>` : ''}
      </div>
    `;
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

defineComponent('nb-citation', NbCitation);
export default NbCitation;
