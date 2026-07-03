/**
 * ═══════════════════════════════════════════════════════════════
 * nb-document-card — Document display card with status and actions
 * Shows file info, processing status, progress bar, and delete.
 * ═══════════════════════════════════════════════════════════════
 */

import { NbComponent, defineComponent } from '@core/component.js';
import { deleteDocument, getFileIcon, formatFileSize, getStatusInfo } from '@services/document-service.js';

class NbDocumentCard extends NbComponent {

  static get observedAttributes() {
    return ['doc-id', 'filename', 'file-type', 'file-size', 'status', 'progress', 'error'];
  }

  attributeChangedCallback() {
    this.update();
  }

  onMount() {
    this.on(this.shadowRoot, 'click', (e) => {
      if (e.target.closest('.doc-delete-btn')) {
        e.stopPropagation();
        this._handleDelete();
        return;
      }
      // Emit click for document details
      this.emit('document-click', { id: this.getAttribute('doc-id') });
    });
  }

  async _handleDelete() {
    const docId = this.getAttribute('doc-id');
    const filename = this.getAttribute('filename');

    if (!confirm(`Delete "${filename}"?`)) return;

    const result = await deleteDocument(docId);
    if (result.ok) {
      this.emit('document-deleted', { id: docId });
      this.remove();
    }
  }

  /**
   * Update progress from external source.
   * @param {string} stage
   * @param {number} progress (0-1)
   */
  setProgress(stage, progress) {
    this.setAttribute('status', stage === 'indexed' ? 'indexed' : (stage === 'failed' ? 'failed' : 'processing'));
    this.setAttribute('progress', String(progress));
    if (stage === 'failed') {
      this.setAttribute('error', 'Processing failed');
    }
  }

  styles() {
    return `
      ${NbComponent.sharedStyles()}

      :host {
        display: block;
      }

      .doc-card {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        border-radius: var(--radius-md);
        cursor: pointer;
        transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        border: 1px solid transparent;
      }

      .doc-card:hover {
        background: var(--color-bg-elevated);
        border-color: var(--color-border);
      }

      .doc-icon {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        background: var(--color-bg-elevated);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        border: 1px solid var(--color-border);
        color: var(--color-text-secondary);
      }

      .doc-info {
        flex: 1;
        min-width: 0;
      }

      .doc-name {
        font-size: 0.8125rem;
        font-weight: 500;
        color: var(--color-text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .doc-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 2px;
        font-size: 0.6875rem;
        color: var(--color-text-secondary);
      }

      .doc-status {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-weight: 500;
      }

      .doc-status__dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
      }

      .doc-status--processing .doc-status__dot {
        animation: pulse 1.5s ease-in-out infinite;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }

      .doc-progress {
        height: 2px;
        background: var(--color-bg-elevated);
        border-radius: 1px;
        margin-top: 6px;
        overflow: hidden;
      }

      .doc-progress__bar {
        height: 100%;
        background: linear-gradient(90deg,
          var(--color-accent),
          hsl(0, 0%, 75%));
        border-radius: 1px;
        transition: width 300ms ease;
      }

      .doc-delete-btn {
        opacity: 0;
        width: 24px;
        height: 24px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--color-text-secondary);
        transition: all 150ms;
        flex-shrink: 0;
      }

      .doc-card:hover .doc-delete-btn {
        opacity: 1;
      }

      .doc-delete-btn:hover {
        background: var(--color-danger);
        color: white;
      }

      .doc-error {
        font-size: 0.6875rem;
        color: var(--color-danger);
        margin-top: 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `;
  }

  render() {
    const filename = this.getAttribute('filename') || 'Unknown';
    const fileType = this.getAttribute('file-type') || '';
    const fileSize = parseInt(this.getAttribute('file-size') || '0', 10);
    const status = this.getAttribute('status') || 'pending';
    const progress = parseFloat(this.getAttribute('progress') || '0');
    const error = this.getAttribute('error') || '';

    const icon = getFileIcon(fileType);
    const sizeStr = formatFileSize(fileSize);
    const statusInfo = getStatusInfo(status);
    const isProcessing = status === 'processing';
    const isFailed = status === 'failed';
    const progressPct = Math.round(progress * 100);

    return `
      <div class="doc-card">
        <div class="doc-icon">
          <nb-icon name="${icon}" size="16"></nb-icon>
        </div>
        <div class="doc-info">
          <div class="doc-name" title="${filename}">${filename}</div>
          <div class="doc-meta">
            <span>${sizeStr}</span>
            <span>·</span>
            <span class="doc-status doc-status--${status}">
              <span class="doc-status__dot" style="background:${statusInfo.color}"></span>
              ${statusInfo.label}${isProcessing ? ` ${progressPct}%` : ''}
            </span>
          </div>
          ${isProcessing ? `
            <div class="doc-progress">
              <div class="doc-progress__bar" style="width:${progressPct}%"></div>
            </div>
          ` : ''}
          ${isFailed && error ? `<div class="doc-error" title="${error}">${error}</div>` : ''}
        </div>
        <button class="doc-delete-btn" title="Delete document">
          <nb-icon name="trash-2" size="14"></nb-icon>
        </button>
      </div>
    `;
  }
}

defineComponent('nb-document-card', NbDocumentCard);
export default NbDocumentCard;
