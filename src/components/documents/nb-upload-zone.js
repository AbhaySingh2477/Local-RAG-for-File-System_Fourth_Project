/**
 * ═══════════════════════════════════════════════════════════════
 * nb-upload-zone — Drag-and-drop file upload component
 * Features: dropzone visual feedback, multi-file, validation,
 *           upload progress, glassmorphism styling.
 * ═══════════════════════════════════════════════════════════════
 */

import { NbComponent, defineComponent } from '@core/component.js';
import { uploadDocuments, formatFileSize } from '@services/document-service.js';

class NbUploadZone extends NbComponent {

  onMount() {
    this.setState({ dragging: false, uploading: false, error: null });

    // File input
    const fileInput = this.$('.upload-input');
    if (fileInput) {
      this.on(fileInput, 'change', (e) => this._handleFiles(e.target.files));
    }

    // Dropzone events
    const zone = this.$('.upload-zone');
    if (zone) {
      this.on(zone, 'dragenter', (e) => { e.preventDefault(); this._setDragging(true); });
      this.on(zone, 'dragover', (e) => { e.preventDefault(); this._setDragging(true); });
      this.on(zone, 'dragleave', (e) => { e.preventDefault(); this._setDragging(false); });
      this.on(zone, 'drop', (e) => { e.preventDefault(); this._setDragging(false); this._handleFiles(e.dataTransfer.files); });
      this.on(zone, 'click', () => fileInput?.click());
    }
  }

  _setDragging(value) {
    const zone = this.$('.upload-zone');
    if (zone) {
      zone.classList.toggle('upload-zone--dragging', value);
    }
  }

  async _handleFiles(fileList) {
    if (!fileList?.length) return;

    const notebookId = this.getAttribute('notebook-id') || 'default';
    const files = Array.from(fileList);

    this.setState({ uploading: true, error: null });

    // Update UI to show uploading state
    const zone = this.$('.upload-zone');
    if (zone) zone.classList.add('upload-zone--uploading');

    const statusEl = this.$('.upload-status');
    if (statusEl) {
      statusEl.textContent = `Uploading ${files.length} file${files.length > 1 ? 's' : ''}...`;
      statusEl.style.display = 'block';
    }

    try {
      const result = await uploadDocuments(notebookId, files);

      if (result.ok) {
        this.emit('documents-uploaded', result.data);
        if (statusEl) {
          statusEl.textContent = `✓ ${result.data.documents.length} file${result.data.documents.length > 1 ? 's' : ''} uploaded`;
          setTimeout(() => { statusEl.style.display = 'none'; }, 2000);
        }
      } else {
        this.setState({ error: result.error });
        if (statusEl) {
          statusEl.textContent = `✗ ${result.error}`;
          statusEl.classList.add('upload-status--error');
        }
      }
    } catch (err) {
      this.setState({ error: err.message });
    } finally {
      this.setState({ uploading: false });
      if (zone) zone.classList.remove('upload-zone--uploading');
      // Reset file input
      const fileInput = this.$('.upload-input');
      if (fileInput) fileInput.value = '';
    }
  }

  styles() {
    return `
      ${NbComponent.sharedStyles()}

      :host {
        display: block;
      }

      .upload-zone {
        border: 2px dashed var(--color-border);
        border-radius: var(--radius-lg);
        padding: 24px;
        text-align: center;
        cursor: pointer;
        transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);
        background: transparent;
        position: relative;
        overflow: hidden;
      }

      .upload-zone::before {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg,
          hsla(0, 0%, 100%, 0.02),
          hsla(0, 0%, 100%, 0.05));
        opacity: 0;
        transition: opacity 250ms;
      }

      .upload-zone:hover {
        border-color: var(--color-text-secondary);
        background: hsla(0, 0%, 100%, 0.02);
      }

      .upload-zone:hover::before {
        opacity: 1;
      }

      .upload-zone--dragging {
        border-color: var(--color-accent);
        background: hsla(0, 0%, 100%, 0.04);
        border-style: solid;
        transform: scale(1.01);
        box-shadow: 0 0 24px hsla(0, 0%, 100%, 0.05);
      }

      .upload-zone--uploading {
        pointer-events: none;
        opacity: 0.7;
      }

      .upload-icon {
        margin-bottom: 12px;
        color: var(--color-text-secondary);
        transition: color 250ms, transform 250ms;
      }

      .upload-zone:hover .upload-icon,
      .upload-zone--dragging .upload-icon {
        color: var(--color-text-primary);
        transform: translateY(-2px);
      }

      .upload-title {
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--color-text-primary);
        margin-bottom: 4px;
      }

      .upload-subtitle {
        font-size: 0.75rem;
        color: var(--color-text-secondary);
        line-height: 1.5;
      }

      .upload-input {
        display: none;
      }

      .upload-status {
        display: none;
        margin-top: 12px;
        font-size: 0.75rem;
        color: var(--color-success);
        font-weight: 500;
        animation: fadeIn 200ms ease;
      }

      .upload-status--error {
        color: var(--color-danger);
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
      }

      /* Spinner for uploading state */
      .upload-zone--uploading .upload-icon {
        animation: spin 1.2s linear infinite;
      }

      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;
  }

  render() {
    return `
      <div class="upload-zone">
        <div class="upload-icon">
          <nb-icon name="upload-cloud" size="28"></nb-icon>
        </div>
        <div class="upload-title">Drop files here or click to upload</div>
        <div class="upload-subtitle">
          PDF, DOCX, TXT, CSV, JSON, HTML, Markdown, code files
        </div>
        <div class="upload-status"></div>
      </div>
      <input class="upload-input" type="file" multiple
        accept=".pdf,.docx,.doc,.txt,.md,.csv,.json,.html,.htm,.xlsx,.xls,.xml,.py,.js,.ts,.rs,.java,.cpp,.c,.go,.rb,.php,.yaml,.yml,.toml" />
    `;
  }
}

defineComponent('nb-upload-zone', NbUploadZone);
export default NbUploadZone;
