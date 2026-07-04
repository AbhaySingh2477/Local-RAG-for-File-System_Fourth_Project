/**
 * ═══════════════════════════════════════════════════════════════
 * Chat Page — Full chat interface with session management
 * Layout: Left sidebar (session list) + Main area (chat panel)
 * ═══════════════════════════════════════════════════════════════
 */

import { NbComponent, defineComponent } from '@core/component.js';
import chatService from '@services/chat-service.js';
import { api } from '@core/api.js';

class ChatPage extends NbComponent {
  onMount() {
    this.setState({
      sessions: [],
      activeSessionId: '',
      notebookId: '',
      notebooks: [],
      sidebarCollapsed: false,
      loading: true,
    });

    this._loadInitialData();
  }

  async _loadInitialData() {
    // Load notebooks for the selector
    const nbResult = await api.get('/documents');
    let notebooks = [];
    if (nbResult.ok && nbResult.data?.documents) {
      // Extract unique notebook IDs from documents
      const nbMap = new Map();
      for (const doc of nbResult.data.documents) {
        if (doc.notebook_id && !nbMap.has(doc.notebook_id)) {
          nbMap.set(doc.notebook_id, doc.notebook_id);
        }
      }
      notebooks = Array.from(nbMap.entries()).map(([id]) => ({ id, name: `Notebook ${id.slice(0, 8)}` }));
    }

    // Use first notebook or "default"
    const notebookId = notebooks[0]?.id || 'default';

    this.setState({ notebooks, notebookId });

    await this._loadSessions(notebookId);
    this.setState({ loading: false });

    requestAnimationFrame(() => this._bindEvents());
  }

  async _loadSessions(notebookId) {
    const result = await chatService.listSessions(notebookId);
    if (result.ok && result.data) {
      const sessions = result.data.sessions || [];
      this.setState({
        sessions,
        notebookId,
      });

      // Auto-select or auto-create
      if (!this.state.activeSessionId && sessions.length > 0) {
        this._selectSession(sessions[0].id);
      } else if (sessions.length === 0) {
        this._createNewSession();
      } else if (this.state.activeSessionId) {
        this._loadSessionInPanel(this.state.activeSessionId);
      }
    }
  }

  _bindEvents() {
    const newChatBtn = this.$('.new-chat-btn');
    if (newChatBtn) {
      this.on(newChatBtn, 'click', () => this._createNewSession());
    }

    const toggleBtn = this.$('.sidebar-toggle');
    if (toggleBtn) {
      this.on(toggleBtn, 'click', () => {
        this.setState({ sidebarCollapsed: !this.state.sidebarCollapsed });
        requestAnimationFrame(() => this._bindEvents());
      });
    }

    // Session list click handlers
    this.$$('.session-item').forEach(item => {
      this.on(item, 'click', () => {
        const sessionId = item.dataset.sessionId;
        this._selectSession(sessionId);
      });
    });

    // Delete buttons
    this.$$('.session-delete-btn').forEach(btn => {
      this.on(btn, 'click', (e) => {
        e.stopPropagation();
        const sessionId = btn.dataset.sessionId;
        this._deleteSession(sessionId);
      });
    });

    // Listen for title updates from chat panel
    const panel = this.$('nb-chat-panel');
    if (panel) {
      this.on(panel, 'session-title-updated', (e) => {
        const { sessionId, title } = e.detail;
        const sessions = this.state.sessions.map(s =>
          s.id === sessionId ? { ...s, title } : s
        );
        this.setState({ sessions });
        requestAnimationFrame(() => this._bindEvents());
      });
    }

    // Notebook selector
    const nbSelect = this.$('.notebook-select');
    if (nbSelect) {
      this.on(nbSelect, 'change', (e) => {
        this._loadSessions(e.target.value);
      });
    }
  }

  async _createNewSession() {
    const { notebookId } = this.state;
    const result = await chatService.createSession(notebookId || 'default');

    if (result.ok && result.data) {
      const newSession = result.data;
      const sessions = [newSession, ...this.state.sessions];
      this.setState({ sessions, activeSessionId: newSession.id });

      requestAnimationFrame(() => {
        this._bindEvents();
        this._loadSessionInPanel(newSession.id);
      });
    }
  }

  async _selectSession(sessionId) {
    this.setState({ activeSessionId: sessionId });
    requestAnimationFrame(() => {
      this._bindEvents();
      this._loadSessionInPanel(sessionId);
    });
  }

  _loadSessionInPanel(sessionId) {
    const panel = this.$('nb-chat-panel');
    if (panel) {
      panel.loadSession(sessionId, this.state.notebookId);
    }
  }

  async _deleteSession(sessionId) {
    const result = await chatService.deleteSession(sessionId);
    if (result.ok) {
      const sessions = this.state.sessions.filter(s => s.id !== sessionId);
      const activeSessionId = this.state.activeSessionId === sessionId
        ? (sessions[0]?.id || '')
        : this.state.activeSessionId;

      this.setState({ sessions, activeSessionId });

      requestAnimationFrame(() => {
        this._bindEvents();
        if (activeSessionId) {
          this._loadSessionInPanel(activeSessionId);
        }
      });
    }
  }

  _formatRelativeTime(dateStr) {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch {
      return '';
    }
  }

  styles() {
    return `
      ${NbComponent.sharedStyles()}

      :host {
        display: block;
        height: 100%;
      }

      .chat-layout {
        display: flex;
        height: 100%;
        overflow: hidden;
      }

      /* ── Sidebar ───────────────────────────────── */
      .sidebar {
        width: 280px;
        min-width: 280px;
        background: var(--color-bg-secondary, hsl(230, 18%, 14%));
        border-right: 1px solid var(--color-border, hsl(230, 10%, 28%));
        display: flex;
        flex-direction: column;
        transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                    min-width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .sidebar.collapsed {
        width: 0;
        min-width: 0;
        overflow: hidden;
        border-right: none;
      }

      .sidebar-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px;
        border-bottom: 1px solid var(--color-border, hsl(230, 10%, 28%));
      }

      .sidebar-title {
        font-size: 0.85rem;
        font-weight: 700;
        color: var(--color-text-primary, hsl(0, 0%, 95%));
        letter-spacing: 0.02em;
        text-transform: uppercase;
      }

      .new-chat-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        font-size: 0.8rem;
        font-weight: 600;
        color: white;
        background: linear-gradient(135deg, hsl(250, 85%, 55%), hsl(280, 75%, 55%));
        border-radius: var(--radius-full, 9999px);
        transition: all var(--transition-fast, 150ms);
      }

      .new-chat-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px hsla(250, 85%, 55%, 0.35);
      }

      .new-chat-btn:active {
        transform: scale(0.97);
      }

      .new-chat-btn svg {
        width: 14px;
        height: 14px;
      }

      .notebook-selector {
        padding: 10px 16px;
        border-bottom: 1px solid hsla(0, 0%, 100%, 0.04);
      }

      .notebook-select {
        width: 100%;
        padding: 8px 12px;
        background: var(--color-bg-primary, hsl(230, 21%, 11%));
        border: 1px solid var(--color-border, hsl(230, 10%, 28%));
        border-radius: var(--radius-sm, 6px);
        color: var(--color-text-primary, hsl(0, 0%, 95%));
        font-size: 0.8rem;
        font-family: var(--font-sans, 'Inter', system-ui, sans-serif);
        outline: none;
      }

      .session-list {
        flex: 1;
        overflow-y: auto;
        padding: 8px;
      }

      .session-list::-webkit-scrollbar {
        width: 4px;
      }
      .session-list::-webkit-scrollbar-thumb {
        background: hsla(0, 0%, 100%, 0.08);
        border-radius: 2px;
      }

      .session-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 14px;
        border-radius: var(--radius-md, 10px);
        cursor: pointer;
        transition: background var(--transition-fast, 150ms);
        margin-bottom: 2px;
      }

      .session-item:hover {
        background: hsla(0, 0%, 100%, 0.04);
      }

      .session-item.active {
        background: hsla(250, 85%, 65%, 0.1);
        border: 1px solid hsla(250, 85%, 65%, 0.15);
      }

      .session-icon {
        width: 18px;
        height: 18px;
        opacity: 0.5;
        flex-shrink: 0;
      }

      .session-info {
        flex: 1;
        min-width: 0;
      }

      .session-title {
        font-size: 0.82rem;
        font-weight: 600;
        color: var(--color-text-primary, hsl(0, 0%, 95%));
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .session-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 3px;
      }

      .session-time {
        font-size: 0.7rem;
        color: var(--color-text-secondary, hsl(0, 0%, 68%));
        opacity: 0.6;
      }

      .session-count {
        font-size: 0.65rem;
        color: var(--color-text-secondary, hsl(0, 0%, 68%));
        background: hsla(0, 0%, 100%, 0.06);
        padding: 1px 6px;
        border-radius: var(--radius-sm, 6px);
      }

      .session-delete-btn {
        opacity: 0;
        padding: 4px;
        border-radius: var(--radius-sm, 6px);
        color: var(--color-text-secondary, hsl(0, 0%, 68%));
        transition: all var(--transition-fast, 150ms);
      }

      .session-item:hover .session-delete-btn {
        opacity: 0.5;
      }

      .session-delete-btn:hover {
        opacity: 1 !important;
        background: hsla(0, 84%, 55%, 0.15);
        color: hsl(0, 84%, 65%);
      }

      .session-delete-btn svg {
        width: 14px;
        height: 14px;
      }

      .empty-sessions {
        padding: 32px 20px;
        text-align: center;
        color: var(--color-text-secondary, hsl(0, 0%, 68%));
        font-size: 0.82rem;
        opacity: 0.6;
      }

      /* ── Main Area ─────────────────────────────── */
      .main-area {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        position: relative;
      }

      .main-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 20px;
        background: var(--glass-bg, hsla(230, 15%, 18%, 0.7));
        backdrop-filter: var(--glass-blur, blur(20px));
        -webkit-backdrop-filter: var(--glass-blur, blur(20px));
        border-bottom: var(--glass-border, 1px solid hsla(0, 0%, 100%, 0.08));
        z-index: 10;
      }

      .sidebar-toggle {
        padding: 6px;
        border-radius: var(--radius-sm, 6px);
        color: var(--color-text-secondary, hsl(0, 0%, 68%));
        transition: all var(--transition-fast, 150ms);
      }

      .sidebar-toggle:hover {
        background: hsla(0, 0%, 100%, 0.06);
        color: var(--color-text-primary, hsl(0, 0%, 95%));
      }

      .sidebar-toggle svg {
        width: 20px;
        height: 20px;
      }

      .main-title {
        font-size: 0.95rem;
        font-weight: 600;
        color: var(--color-text-primary, hsl(0, 0%, 95%));
        flex: 1;
      }

      .chat-area {
        flex: 1;
        overflow: hidden;
      }

      /* Loading state */
      .loading-container {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: var(--color-text-secondary, hsl(0, 0%, 68%));
      }
    `;
  }

  render() {
    const {
      sessions = [], 
      activeSessionId = '', 
      sidebarCollapsed = false,
      notebooks = [], 
      notebookId = '', 
      loading = true,
    } = this.state;

    if (loading) {
      return `
        <div class="chat-layout">
          <div class="loading-container">Loading chat...</div>
        </div>
      `;
    }

    // Sidebar
    const chatIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
    const plusIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
    const trashIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
    const menuIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`;

    let sessionListHtml = '';
    if (sessions.length === 0) {
      sessionListHtml = `<div class="empty-sessions">No conversations yet.<br>Click "New Chat" to start.</div>`;
    } else {
      sessionListHtml = sessions.map(s => `
        <div class="session-item ${s.id === activeSessionId ? 'active' : ''}" data-session-id="${s.id}">
          <svg class="session-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <div class="session-info">
            <div class="session-title">${this._escapeHtml(s.title || 'New Chat')}</div>
            <div class="session-meta">
              <span class="session-time">${this._formatRelativeTime(s.updated_at || s.created_at)}</span>
              ${s.message_count ? `<span class="session-count">${s.message_count} msgs</span>` : ''}
            </div>
          </div>
          <button class="session-delete-btn" data-session-id="${s.id}" title="Delete">${trashIcon}</button>
        </div>
      `).join('');
    }

    // Notebook selector
    let nbSelectHtml = '';
    if (notebooks.length > 1) {
      const options = notebooks.map(nb =>
        `<option value="${nb.id}" ${nb.id === notebookId ? 'selected' : ''}>${nb.name}</option>`
      ).join('');
      nbSelectHtml = `
        <div class="notebook-selector">
          <select class="notebook-select">${options}</select>
        </div>
      `;
    }

    // Active session title
    const activeSession = sessions.find(s => s.id === activeSessionId);
    const mainTitle = activeSession ? activeSession.title : 'Chat with Documents';

    return `
      <div class="chat-layout">
        <aside class="sidebar ${sidebarCollapsed ? 'collapsed' : ''}">
          <div class="sidebar-header">
            <span class="sidebar-title">Chats</span>
            <button class="new-chat-btn">${plusIcon} New Chat</button>
          </div>
          ${nbSelectHtml}
          <div class="session-list">
            ${sessionListHtml}
          </div>
        </aside>

        <div class="main-area">
          <div class="main-header">
            <button class="sidebar-toggle" title="Toggle sidebar">${menuIcon}</button>
            <span class="main-title">${this._escapeHtml(mainTitle)}</span>
          </div>
          <div class="chat-area">
            <nb-chat-panel></nb-chat-panel>
          </div>
        </div>
      </div>
    `;
  }

  _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

defineComponent('chat-page', ChatPage);
export default ChatPage;
