/**
 * ═══════════════════════════════════════════════════════════════
 * Chat Page — Unified Search & Chat Interface
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
      
      // Search state
      searchQuery: '',
      isSearching: false,
      searchResults: null, // null = hidden, [] = no results, [...] = results
      pinnedChunks: [],
    });

    this._loadInitialData();
  }

  async _loadInitialData() {
    const nbResult = await api.get('/documents');
    let notebooks = [];
    if (nbResult.ok && nbResult.data?.documents) {
      const nbMap = new Map();
      for (const doc of nbResult.data.documents) {
        if (doc.notebook_id && !nbMap.has(doc.notebook_id)) {
          nbMap.set(doc.notebook_id, doc.notebook_id);
        }
      }
      notebooks = Array.from(nbMap.entries()).map(([id]) => ({ id, name: `Notebook ${id.slice(0, 8)}` }));
    }

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
      this.setState({ sessions, notebookId });

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
    if (newChatBtn) this.on(newChatBtn, 'click', () => this._createNewSession());

    const toggleBtn = this.$('.sidebar-toggle');
    if (toggleBtn) {
      this.on(toggleBtn, 'click', () => {
        this.setState({ sidebarCollapsed: !this.state.sidebarCollapsed });
        requestAnimationFrame(() => this._bindEvents());
      });
    }

    // Session list clicks
    this.$$('.session-item').forEach(item => {
      this.on(item, 'click', () => this._selectSession(item.dataset.sessionId));
    });

    // Delete buttons
    this.$$('.session-delete-btn').forEach(btn => {
      this.on(btn, 'click', (e) => {
        e.stopPropagation();
        this._deleteSession(btn.dataset.sessionId);
      });
    });

    // Search input
    const searchForm = this.$('.search-bar-form');
    if (searchForm) {
      this.on(searchForm, 'submit', (e) => {
        e.preventDefault();
        const input = this.$('.search-input');
        if (input && input.value.trim()) {
          this._performSearch(input.value.trim());
        }
      });
    }

    const clearSearchBtn = this.$('.clear-search-btn');
    if (clearSearchBtn) {
      this.on(clearSearchBtn, 'click', () => {
        const input = this.$('.search-input');
        if (input) input.value = '';
        this.setState({ searchResults: null });
        requestAnimationFrame(() => this._bindEvents());
      });
    }

    // Pinning results
    this.$$('.pin-btn').forEach(btn => {
      this.on(btn, 'click', (e) => {
        const id = e.currentTarget.dataset.id;
        this._togglePin(id);
      });
    });

    // Chat panel events
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

      this.on(panel, 'message-sent', () => {
        // Auto-collapse search results when chatting
        if (this.state.searchResults !== null) {
          this.setState({ searchResults: null });
          requestAnimationFrame(() => this._bindEvents());
        }
      });
    }

    const nbSelect = this.$('.notebook-select');
    if (nbSelect) {
      this.on(nbSelect, 'change', (e) => this._loadSessions(e.target.value));
    }
  }

  async _performSearch(query) {
    this.setState({ isSearching: true, searchResults: [] });
    requestAnimationFrame(() => this._bindEvents());

    try {
      const res = await api.get('/search', { 
        q: query, 
        notebook_id: this.state.notebookId,
        top_k: 15,
      });
      if (res.ok && res.data) {
        this.setState({ searchResults: res.data.results || [], isSearching: false });
      } else {
        this.setState({ searchResults: [], isSearching: false });
      }
    } catch (err) {
      console.error('Search failed', err);
      this.setState({ searchResults: [], isSearching: false });
    }
    requestAnimationFrame(() => this._bindEvents());
  }

  _togglePin(chunkId) {
    const { searchResults, pinnedChunks } = this.state;
    const chunk = searchResults.find(c => c.id === chunkId);
    if (!chunk) return;

    let newPins;
    if (pinnedChunks.find(c => c.id === chunkId)) {
      // Unpin
      newPins = pinnedChunks.filter(c => c.id !== chunkId);
    } else {
      // Pin
      newPins = [...pinnedChunks, chunk];
    }
    
    this.setState({ pinnedChunks: newPins });
    
    // Sync with chat panel
    const panel = this.$('nb-chat-panel');
    if (panel && panel.setPinnedChunks) {
      panel.setPinnedChunks(newPins);
    }

    requestAnimationFrame(() => this._bindEvents());
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
      if (panel.setPinnedChunks) {
        panel.setPinnedChunks(this.state.pinnedChunks);
      }
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

      .notebook-selector {
        padding: 10px 16px;
        border-bottom: 1px solid hsla(0, 0%, 100%, 0.04);
      }
      .notebook-select {
        width: 100%;
        padding: 8px 12px;
        background: var(--color-bg-primary);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        color: var(--color-text-primary);
        font-size: 0.8rem;
      }

      .session-list {
        flex: 1;
        overflow-y: auto;
        padding: 8px;
      }
      .session-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 14px;
        border-radius: var(--radius-md, 10px);
        cursor: pointer;
        transition: background 150ms;
        margin-bottom: 2px;
      }
      .session-item:hover { background: hsla(0, 0%, 100%, 0.04); }
      .session-item.active {
        background: hsla(250, 85%, 65%, 0.1);
        border: 1px solid hsla(250, 85%, 65%, 0.15);
      }
      .session-icon { width: 18px; height: 18px; opacity: 0.5; flex-shrink: 0; }
      .session-info { flex: 1; min-width: 0; }
      .session-title { font-size: 0.82rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .session-meta { display: flex; align-items: center; gap: 8px; margin-top: 3px; }
      .session-time { font-size: 0.7rem; color: var(--color-text-secondary); opacity: 0.6; }
      .session-count { font-size: 0.65rem; color: var(--color-text-secondary); background: hsla(0,0%,100%,0.06); padding: 1px 6px; border-radius: 6px; }
      
      .session-delete-btn { opacity: 0; padding: 4px; border-radius: 6px; color: var(--color-text-secondary); }
      .session-item:hover .session-delete-btn { opacity: 0.5; }
      .session-delete-btn:hover { opacity: 1 !important; background: hsla(0, 84%, 55%, 0.15); color: hsl(0, 84%, 65%); }
      
      .empty-sessions { padding: 32px 20px; text-align: center; color: var(--color-text-secondary); font-size: 0.82rem; opacity: 0.6; }

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
        background: var(--glass-bg);
        backdrop-filter: var(--glass-blur);
        border-bottom: 1px solid var(--color-border);
        z-index: 10;
      }
      .sidebar-toggle { padding: 6px; border-radius: 6px; color: var(--color-text-secondary); }
      .sidebar-toggle:hover { background: hsla(0,0%,100%,0.06); color: var(--color-text-primary); }
      
      .search-bar-form {
        flex: 1;
        display: flex;
        align-items: center;
        background: var(--color-bg-primary);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-full);
        padding: 0 14px;
        height: 38px;
        max-width: 600px;
        margin: 0 auto;
        position: relative;
        transition: border-color 150ms;
      }
      .search-bar-form:focus-within {
        border-color: hsl(250, 85%, 65%);
        box-shadow: 0 0 0 3px hsla(250, 85%, 65%, 0.15);
      }
      .search-icon { color: var(--color-text-secondary); width: 16px; height: 16px; }
      .search-input {
        flex: 1;
        background: transparent;
        border: none;
        color: var(--color-text-primary);
        padding: 0 10px;
        font-size: 0.85rem;
        outline: none;
      }
      .clear-search-btn {
        background: transparent;
        border: none;
        color: var(--color-text-secondary);
        cursor: pointer;
        display: flex;
        padding: 4px;
        border-radius: 50%;
      }
      .clear-search-btn:hover { color: var(--color-text-primary); background: hsla(0,0%,100%,0.06); }

      /* ── Search Results Panel ──────────────────── */
      .search-results-panel {
        position: absolute;
        top: 63px;
        left: 0;
        right: 0;
        bottom: 0;
        background: var(--color-bg-primary);
        z-index: 5;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        padding: 20px;
        animation: slideDown 200ms cubic-bezier(0.16, 1, 0.3, 1);
      }
      @keyframes slideDown {
        from { transform: translateY(-10px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .search-results-header {
        font-size: 0.95rem;
        font-weight: 600;
        margin-bottom: 16px;
        color: var(--color-text-primary);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .result-cards {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 16px;
      }
      
      .result-card {
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        transition: border-color 150ms;
      }
      .result-card:hover { border-color: hsl(250, 50%, 40%); }
      .result-card.is-pinned { border-color: hsl(250, 85%, 65%); background: hsla(250, 85%, 65%, 0.03); }
      
      .result-meta {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        font-size: 0.75rem;
        color: var(--color-text-secondary);
      }
      .level-badge {
        background: hsla(0,0%,100%,0.08);
        padding: 2px 8px;
        border-radius: 4px;
        font-weight: 500;
        color: var(--color-text-primary);
      }
      .doc-name { margin-top: 4px; font-weight: 500; color: var(--color-text-primary); font-size: 0.85rem;}
      
      .result-content {
        font-size: 0.8rem;
        line-height: 1.5;
        color: var(--color-text-secondary);
        display: -webkit-box;
        -webkit-line-clamp: 4;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      
      .result-actions {
        margin-top: auto;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-top: 10px;
        border-top: 1px solid var(--color-border);
      }
      
      .relevance-score {
        font-size: 0.7rem;
        font-weight: 500;
        color: hsl(150, 80%, 40%);
        background: hsla(150, 80%, 40%, 0.1);
        padding: 2px 6px;
        border-radius: 4px;
      }
      
      .pin-btn {
        background: transparent;
        border: 1px solid var(--color-border);
        color: var(--color-text-primary);
        padding: 4px 12px;
        border-radius: var(--radius-full);
        font-size: 0.75rem;
        font-weight: 500;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 150ms;
      }
      .pin-btn:hover { background: hsla(0,0%,100%,0.06); }
      .result-card.is-pinned .pin-btn {
        background: hsl(250, 85%, 65%);
        border-color: hsl(250, 85%, 65%);
        color: white;
      }

      .chat-area { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
      .loading-container { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-text-secondary); }
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
      searchResults,
      isSearching,
      pinnedChunks = [],
    } = this.state;

    if (loading) return `<div class="chat-layout"><div class="loading-container">Loading workspace...</div></div>`;

    // ── Icons ──────────────────────────────────────────────────
    const searchIcon = `<svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
    const xIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    const pinIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`;
    const checkIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg>`;

    // ── Sidebar ────────────────────────────────────────────────
    let sessionListHtml = sessions.length === 0 
      ? `<div class="empty-sessions">No conversations yet.<br>Click "New Chat" to start.</div>`
      : sessions.map(s => `
        <div class="session-item ${s.id === activeSessionId ? 'active' : ''}" data-session-id="${s.id}">
          <svg class="session-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <div class="session-info">
            <div class="session-title">${this._escapeHtml(s.title || 'New Chat')}</div>
            <div class="session-meta">
              <span class="session-time">${this._formatRelativeTime(s.updated_at || s.created_at)}</span>
              ${s.message_count ? `<span class="session-count">${s.message_count} msgs</span>` : ''}
            </div>
          </div>
          <button class="session-delete-btn" data-session-id="${s.id}" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      `).join('');

    let nbSelectHtml = notebooks.length > 1 ? `
      <div class="notebook-selector">
        <select class="notebook-select">
          ${notebooks.map(nb => `<option value="${nb.id}" ${nb.id === notebookId ? 'selected' : ''}>${nb.name}</option>`).join('')}
        </select>
      </div>
    ` : '';

    // ── Search Results Panel ───────────────────────────────────
    let searchPanelHtml = '';
    if (searchResults !== null) {
      if (isSearching) {
        searchPanelHtml = `<div class="search-results-panel"><div class="loading-container">Searching documents...</div></div>`;
      } else if (searchResults.length === 0) {
        searchPanelHtml = `<div class="search-results-panel"><div class="loading-container">No results found.</div></div>`;
      } else {
        const cards = searchResults.map(r => {
          const isPinned = pinnedChunks.some(c => c.id === r.id);
          const levelLabel = r.level ? r.level.charAt(0).toUpperCase() + r.level.slice(1) : 'Chunk';
          return `
            <div class="result-card ${isPinned ? 'is-pinned' : ''}">
              <div class="result-meta">
                <span class="level-badge">${levelLabel}</span>
                <span>${r.page_number ? `p. ${r.page_number}` : ''}</span>
              </div>
              <div class="doc-name">${this._escapeHtml(r.section_title || r.document_name)}</div>
              <div class="result-content">${this._escapeHtml(r.content)}</div>
              <div class="result-actions">
                <span class="relevance-score">Match: ${Math.round((r.score || 0)*100)}%</span>
                <button class="pin-btn" data-id="${r.id}">
                  ${isPinned ? `${checkIcon} Pinned` : `${pinIcon} Pin to Chat`}
                </button>
              </div>
            </div>
          `;
        }).join('');
        
        searchPanelHtml = `
          <div class="search-results-panel">
            <div class="search-results-header">
              <span>Search Results (${searchResults.length})</span>
              <button class="clear-search-btn" title="Close results">${xIcon}</button>
            </div>
            <div class="result-cards">${cards}</div>
          </div>
        `;
      }
    }

    return `
      <div class="chat-layout">
        <aside class="sidebar ${sidebarCollapsed ? 'collapsed' : ''}">
          <div class="sidebar-header">
            <span class="sidebar-title">Chats</span>
            <button class="new-chat-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Chat
            </button>
          </div>
          ${nbSelectHtml}
          <div class="session-list">${sessionListHtml}</div>
        </aside>

        <div class="main-area">
          <div class="main-header">
            <button class="sidebar-toggle" title="Toggle sidebar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <form class="search-bar-form">
              ${searchIcon}
              <input type="text" class="search-input" placeholder="Search across documents..." value="${this._escapeHtml(this.state.searchQuery)}">
              ${this.state.searchResults !== null ? `<button type="button" class="clear-search-btn">${xIcon}</button>` : ''}
            </form>
          </div>
          
          ${searchPanelHtml}

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
