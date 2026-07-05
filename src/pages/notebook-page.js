import { NbComponent, defineComponent } from '@core/component.js';
import { appStore } from '@core/store.js';
import { onDocumentProgress, listDocuments } from '@services/document-service.js';
import { createSession, listSessions } from '@services/chat-service.js';
import { api } from '@core/api.js';

class NotebookPage extends NbComponent {

  onMount() {
    appStore.state.sidebarCollapsed = true;

    this._notebookId = this.routeParams?.id || 'default-notebook';
    this._documents = [];
    this._processingDocs = new Map();
    this._sessionId = null;
    this._ollamaOk = null; // null=checking, true/false

    this._loadDocuments();
    this._initChatSession();
    this._checkOllama();

    const uploadZone = this.$('nb-upload-zone');
    if (uploadZone) {
      uploadZone.setAttribute('notebook-id', this._notebookId);
      this.on(uploadZone, 'documents-uploaded', (e) => this._onDocumentsUploaded(e.detail));
    }

    this._unsubProgress = onDocumentProgress((data) => this._onProgress(data));
  }

  onUnmount() {
    this._unsubProgress?.();
  }

  // ── Ollama status ────────────────────────────────────────────

  async _checkOllama() {
    try {
      const result = await api.get('/models');
      this._ollamaOk = result.ok;
    } catch {
      this._ollamaOk = false;
    }
    this._renderOllamaBanner();
  }

  _renderOllamaBanner() {
    const banner = this.$('.ollama-banner');
    if (!banner) return;
    if (this._ollamaOk === true) {
      banner.style.display = 'none';
      return;
    }
    if (this._ollamaOk === false) {
      banner.style.display = 'flex';
      banner.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" style="flex-shrink:0">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>Ollama is not running. <strong>Start Ollama</strong> to enable AI chat.</span>
        <button class="ollama-retry-btn" id="nb-ollama-retry">Retry</button>
      `;
      this.$('#nb-ollama-retry')?.addEventListener('click', () => {
        banner.innerHTML = '<span style="opacity:.6">Checking Ollama\u2026</span>';
        this._ollamaOk = null;
        this._checkOllama();
      });
    }
  }

  // ── Chat session ─────────────────────────────────────────────

  async _initChatSession() {
    // Reuse existing session or create new one
    const listResult = await listSessions(this._notebookId);
    let session = null;
    if (listResult.ok && listResult.data?.length > 0) {
      session = listResult.data[0];
    } else {
      const createResult = await createSession(this._notebookId, '', 'Notebook Chat');
      if (createResult.ok && createResult.data) {
        session = createResult.data;
      }
    }

    if (session?.id) {
      this._sessionId = session.id;
      const chatPanel = this.$('nb-chat-panel');
      if (chatPanel?.loadSession) {
        chatPanel.loadSession(session.id, this._notebookId);
      }
    }
  }

  // ── Documents ────────────────────────────────────────────────

  async _loadDocuments() {
    const result = await listDocuments(this._notebookId);
    if (result.ok && result.data) {
      this._documents = result.data;
      this._renderDocumentList();
    }
  }

  _onDocumentsUploaded(data) {
    if (!data?.documents) return;
    for (const doc of data.documents) {
      if (!this._documents.find(d => d.id === doc.id)) this._documents.unshift(doc);
      this._processingDocs.set(doc.id, { stage: 'pending', progress: 0 });
    }
    this._renderDocumentList();
    this._updateSourceCount();
  }

  _onProgress(data) {
    const { document_id, stage, progress, error } = data;
    if (stage === 'indexed' || stage === 'complete') {
      this._processingDocs.delete(document_id);
      const doc = this._documents.find(d => d.id === document_id);
      if (doc) { doc.status = 'indexed'; doc.processing_progress = 1.0; }
    } else if (stage === 'failed') {
      this._processingDocs.delete(document_id);
      const doc = this._documents.find(d => d.id === document_id);
      if (doc) { doc.status = 'failed'; doc.error_message = error; }
    } else {
      this._processingDocs.set(document_id, { stage, progress });
    }
    const card = this.$(`nb-document-card[doc-id="${document_id}"]`);
    if (card) card.setProgress(stage, progress);
    this._renderProcessingStatus();
    this._updateSourceCount();
  }

  _renderDocumentList() {
    const container = this.$('.sources-list');
    const emptyState = this.$('.sources-empty');
    if (!container) return;
    if (this._documents.length === 0) {
      container.innerHTML = '';
      if (emptyState) emptyState.style.display = 'flex';
      return;
    }
    if (emptyState) emptyState.style.display = 'none';
    container.innerHTML = this._documents.map(doc => `
      <nb-document-card
        doc-id="${doc.id}" filename="${doc.filename}"
        file-type="${doc.file_type}" file-size="${doc.file_size}"
        status="${doc.status}" progress="${doc.processing_progress}"
        error="${doc.error_message || ''}"
      ></nb-document-card>
    `).join('');
    container.querySelectorAll('nb-document-card').forEach(card => {
      card.addEventListener('document-deleted', (e) => {
        this._documents = this._documents.filter(d => d.id !== e.detail.id);
        this._updateSourceCount();
      });
    });
  }

  _renderProcessingStatus() {
    const container = this.$('.processing-container');
    if (!container) return;
    if (this._processingDocs.size === 0) { container.innerHTML = ''; return; }
    const [docId, info] = [...this._processingDocs.entries()][0];
    const doc = this._documents.find(d => d.id === docId);
    container.innerHTML = `
      <nb-processing-status stage="${info.stage}" progress="${info.progress}"
        doc-name="${doc?.filename || 'Document'}"></nb-processing-status>
    `;
  }

  _updateSourceCount() {
    const indexed = this._documents.filter(d => d.status === 'indexed').length;
    const total = this._documents.length;
    const countEl = this.$('.source-count');
    if (countEl) countEl.textContent = `${indexed} / ${total} source${total !== 1 ? 's' : ''}`;
  }

  // ── Styles ───────────────────────────────────────────────────

  styles() {
    return `
      ${NbComponent.sharedStyles()}
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--color-bg-primary);
        color: var(--color-text-primary);
        overflow: hidden;
      }

      /* Ollama status banner */
      .ollama-banner {
        display: none;
        align-items: center;
        gap: 10px;
        padding: 9px 20px;
        background: hsla(35, 90%, 45%, 0.12);
        border-bottom: 1px solid hsla(35, 90%, 45%, 0.25);
        color: hsl(35, 90%, 65%);
        font-size: 0.8125rem;
        flex-shrink: 0;
      }
      .ollama-retry-btn {
        margin-left: auto;
        padding: 4px 14px;
        border-radius: 12px;
        border: 1px solid hsla(35, 90%, 45%, 0.4);
        background: transparent;
        color: hsl(35, 90%, 65%);
        font-size: 0.75rem;
        cursor: pointer;
        transition: background 150ms;
      }
      .ollama-retry-btn:hover { background: hsla(35, 90%, 45%, 0.15); }

      /* ── Header ─────────────────────────────────────────── */
      .nb-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 20px;
        border-bottom: 1px solid var(--color-border);
        flex-shrink: 0;
      }
      .nb-header__left { display: flex; align-items: center; gap: 14px; }
      .nb-header__back {
        width: 30px; height: 30px; border-radius: 8px;
        background: var(--color-bg-secondary);
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; transition: background 150ms;
      }
      .nb-header__back:hover { background: var(--color-bg-hover); }
      .nb-header__title { font-size: 1rem; font-weight: 600; }
      .nb-header__right { display: flex; align-items: center; gap: 10px; }
      .header-btn {
        display: flex; align-items: center; gap: 6px;
        padding: 7px 14px; border-radius: 20px;
        font-size: 0.8125rem; font-weight: 500; cursor: pointer;
        border: 1px solid var(--color-border); background: transparent;
        color: var(--color-text-secondary); transition: all 150ms;
      }
      .header-btn:hover { background: var(--color-bg-hover); color: var(--color-text-primary); }

      /* ── Layout ─────────────────────────────────────────── */
      .nb-content {
        display: grid;
        grid-template-columns: 300px 1fr 290px;
        gap: 12px;
        padding: 12px;
        flex: 1;
        min-height: 0;
        overflow: hidden;
      }
      .panel {
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        display: flex; flex-direction: column; overflow: hidden;
      }
      .panel-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 12px 14px;
        border-bottom: 1px solid var(--color-border);
        flex-shrink: 0;
      }
      .panel-title { font-size: 0.9375rem; font-weight: 600; }
      .panel-body { flex: 1; overflow-y: auto; padding: 12px 14px 14px; }

      /* ── Sources ────────────────────────────────────────── */
      .sources-list { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; }
      .processing-container { margin-top: 8px; }
      .sources-empty {
        display: flex; flex-direction: column; align-items: center;
        text-align: center; color: var(--color-text-secondary);
        padding: 28px 12px; gap: 8px; margin-top: 20px;
      }

      /* ── Chat panel ─────────────────────────────────────── */
      .chat-panel { background: transparent; border: none; }

      /* ── Studio panel ───────────────────────────────────── */
      .studio-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .studio-card {
        background: var(--color-bg-elevated); border: 1px solid var(--color-border);
        border-radius: var(--radius-md); padding: 12px;
        display: flex; flex-direction: column; gap: 12px;
        cursor: pointer; transition: all 150ms;
      }
      .studio-card:hover { background: var(--color-bg-hover); transform: translateY(-1px); }
      .studio-card__label { font-size: 0.8rem; font-weight: 500; display: flex; align-items: center; justify-content: space-between; }
      .studio-footer { margin-top: 16px; text-align: center; color: var(--color-text-secondary); font-size: 0.8125rem; }
      .add-note-btn {
        display: inline-flex; align-items: center; gap: 8px;
        background: var(--color-text-primary); color: var(--color-bg-app);
        padding: 7px 16px; border-radius: 20px; font-weight: 500; margin-top: 12px; cursor: pointer;
        font-size: 0.8125rem;
      }
    `;
  }

  // ── Render ───────────────────────────────────────────────────

  render() {
    return `
      <!-- Ollama status banner (hidden until check fails) -->
      <div class="ollama-banner"></div>

      <!-- Header -->
      <div class="nb-header">
        <div class="nb-header__left">
          <div class="nb-header__back" onclick="window.location.hash='/'">
            <nb-icon name="chevron-left" size="18"></nb-icon>
          </div>
          <div class="nb-header__title">Notebook</div>
        </div>
        <div class="nb-header__right">
          <button class="header-btn">
            <nb-icon name="settings" size="15"></nb-icon> Settings
          </button>
        </div>
      </div>

      <!-- Main 3-column layout -->
      <div class="nb-content">

        <!-- Sources Panel -->
        <div class="panel sources-panel">
          <div class="panel-header">
            <div class="panel-title">Sources</div>
            <span class="source-count" style="font-size:0.8rem;color:var(--color-text-secondary)">0 sources</span>
          </div>
          <div class="panel-body">
            <nb-upload-zone notebook-id="${this._notebookId || 'default-notebook'}"></nb-upload-zone>
            <div class="processing-container"></div>
            <div class="sources-list"></div>
            <div class="sources-empty">
              <nb-icon name="file" size="26"></nb-icon>
              <div style="font-weight:500">No sources yet</div>
              <div style="font-size:0.8rem;line-height:1.5">
                Drop files above to add PDFs, DOCX, text and more.
              </div>
            </div>
          </div>
        </div>

        <!-- Chat Panel — wired to nb-chat-panel with real session -->
        <div class="panel chat-panel" style="display:flex;flex-direction:column;">
          <div class="panel-header">
            <div class="panel-title">Chat</div>
          </div>
          <nb-chat-panel style="flex:1;min-height:0;"></nb-chat-panel>
        </div>

        <!-- Studio Panel -->
        <div class="panel studio-panel">
          <div class="panel-header">
            <div class="panel-title">Studio</div>
          </div>
          <div class="panel-body">
            <div class="studio-grid">
              <div class="studio-card">
                <nb-icon name="file-text" size="16"></nb-icon>
                <div class="studio-card__label">Study Guide <nb-icon name="chevron-right" size="12"></nb-icon></div>
              </div>
              <div class="studio-card">
                <nb-icon name="file" size="16"></nb-icon>
                <div class="studio-card__label">Briefing Doc <nb-icon name="chevron-right" size="12"></nb-icon></div>
              </div>
              <div class="studio-card">
                <nb-icon name="copy" size="16"></nb-icon>
                <div class="studio-card__label">Flashcards <nb-icon name="chevron-right" size="12"></nb-icon></div>
              </div>
              <div class="studio-card">
                <nb-icon name="help-circle" size="16"></nb-icon>
                <div class="studio-card__label">Quiz <nb-icon name="chevron-right" size="12"></nb-icon></div>
              </div>
            </div>
            <div class="studio-footer">
              <div>Add sources to generate content.</div>
              <div class="add-note-btn">
                <nb-icon name="plus" size="14"></nb-icon> Add note
              </div>
            </div>
          </div>
        </div>

      </div>
    `;
  }
}

defineComponent('notebook-page', NotebookPage);
export default NotebookPage;
