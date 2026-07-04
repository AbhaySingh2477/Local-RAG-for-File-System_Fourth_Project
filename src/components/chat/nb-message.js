/**
 * ═══════════════════════════════════════════════════════════════
 * nb-message — Chat message bubble
 * Renders user and assistant messages with markdown, code blocks,
 * inline citations, copy button, and streaming animation.
 * ═══════════════════════════════════════════════════════════════
 */

import { NbComponent, defineComponent } from '@core/component.js';

class NbMessage extends NbComponent {
  onMount() {
    this.setState({
      role: 'user',
      content: '',
      citations: [],
      timestamp: '',
      isStreaming: false,
      latencyMs: 0,
    });
  }

  /**
   * Set message data.
   * @param {Object} data
   */
  setData(data) {
    this.setState({
      role: data.role || 'user',
      content: data.content || '',
      citations: data.citations || [],
      timestamp: data.created_at || data.timestamp || '',
      isStreaming: data.isStreaming || false,
      latencyMs: data.latency_ms || data.latencyMs || 0,
    });
    requestAnimationFrame(() => this._bindEvents());
  }

  /**
   * Append streaming content.
   * @param {string} token
   */
  appendToken(token) {
    const newContent = (this.state.content || '') + token;
    this.setState({ content: newContent, isStreaming: true });
  }

  /**
   * Finalize streaming.
   * @param {Array} citations
   */
  finishStreaming(citations = []) {
    this.setState({
      isStreaming: false,
      citations: citations || [],
    });
    requestAnimationFrame(() => this._bindEvents());
  }

  _bindEvents() {
    const copyBtn = this.$('.copy-btn');
    if (copyBtn) {
      this.on(copyBtn, 'click', () => this._copyContent());
    }
  }

  async _copyContent() {
    try {
      await navigator.clipboard.writeText(this.state.content);
      const btn = this.$('.copy-btn');
      if (btn) {
        btn.textContent = '✓ Copied';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
      }
    } catch { /* clipboard not available */ }
  }

  /**
   * Lightweight markdown → HTML renderer.
   * Handles: code blocks, inline code, bold, italic, links, lists, headers, line breaks.
   */
  _renderMarkdown(text) {
    if (!text) return '';

    let html = this._escapeHtml(text);

    // Code blocks: ```lang\n...\n```
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre class="code-block"><code class="lang-${lang || 'text'}">${code.trim()}</code></pre>`;
    });

    // Inline code: `...`
    html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

    // Headers: ### Header
    html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');

    // Bold: **text**
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic: *text*
    html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

    // Links: [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    // Unordered lists: - item
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/gs, '<ul>$&</ul>');

    // Numbered lists: 1. item
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // Citation markers [1], [2] → clickable chips
    html = html.replace(/\[(\d+)\]/g, (_, num) => {
      const citation = this.state.citations?.find(c => c.index === parseInt(num));
      if (citation) {
        return `<span class="citation-inline" data-index="${num}" title="${this._escapeAttr(citation.document_name || '')}">[${num}]</span>`;
      }
      return `<span class="citation-inline" data-index="${num}">[${num}]</span>`;
    });

    // Paragraphs: double newlines
    html = html.replace(/\n\n/g, '</p><p>');
    // Single newlines → <br>
    html = html.replace(/\n/g, '<br>');

    return `<p>${html}</p>`;
  }

  _escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  _escapeAttr(text) {
    return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  _formatTime(timestamp) {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  styles() {
    return `
      ${NbComponent.sharedStyles()}

      :host {
        display: block;
        animation: msg-enter 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      @keyframes msg-enter {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .message {
        display: flex;
        gap: 12px;
        padding: 8px 0;
        max-width: 100%;
      }

      .message.user {
        flex-direction: row-reverse;
      }

      .avatar {
        width: 36px;
        height: 36px;
        min-width: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.85rem;
        font-weight: 700;
        flex-shrink: 0;
      }

      .message.user .avatar {
        background: linear-gradient(135deg, hsl(250, 85%, 65%), hsl(280, 85%, 60%));
        color: white;
      }

      .message.assistant .avatar {
        background: linear-gradient(135deg, hsl(200, 85%, 50%), hsl(170, 85%, 45%));
        color: white;
      }

      .bubble {
        max-width: 78%;
        min-width: 60px;
        position: relative;
      }

      .bubble-content {
        padding: 14px 18px;
        border-radius: var(--radius-lg, 16px);
        font-size: 0.9rem;
        line-height: 1.7;
        font-family: var(--font-sans, 'Inter', system-ui, sans-serif);
        word-break: break-word;
      }

      .message.user .bubble-content {
        background: linear-gradient(135deg, hsl(250, 85%, 55%), hsl(250, 75%, 50%));
        color: white;
        border-bottom-right-radius: var(--radius-sm, 6px);
      }

      .message.assistant .bubble-content {
        background: var(--color-bg-elevated, hsl(230, 15%, 18%));
        color: var(--color-text-primary, hsl(0, 0%, 95%));
        border: 1px solid var(--color-border, hsl(230, 10%, 28%));
        border-bottom-left-radius: var(--radius-sm, 6px);
      }

      /* Markdown elements */
      .bubble-content h2, .bubble-content h3, .bubble-content h4 {
        margin: 16px 0 8px;
        color: var(--color-text-primary, hsl(0, 0%, 95%));
      }
      .bubble-content h2 { font-size: 1.1rem; }
      .bubble-content h3 { font-size: 1rem; }
      .bubble-content h4 { font-size: 0.92rem; }

      .bubble-content p {
        margin: 0 0 8px;
      }
      .bubble-content p:last-child {
        margin-bottom: 0;
      }

      .bubble-content ul, .bubble-content ol {
        margin: 8px 0;
        padding-left: 20px;
      }

      .bubble-content li {
        margin: 4px 0;
      }

      .bubble-content strong {
        font-weight: 700;
        color: var(--color-text-primary, hsl(0, 0%, 95%));
      }

      .bubble-content a {
        color: var(--color-accent, hsl(250, 85%, 65%));
        text-decoration: underline;
        text-decoration-style: dotted;
      }

      .code-block {
        margin: 12px 0;
        padding: 14px 16px;
        background: hsl(230, 25%, 10%);
        border-radius: var(--radius-md, 10px);
        border: 1px solid hsla(0, 0%, 100%, 0.06);
        overflow-x: auto;
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        font-size: 0.82rem;
        line-height: 1.6;
        white-space: pre;
      }

      .inline-code {
        padding: 2px 6px;
        background: hsla(0, 0%, 100%, 0.08);
        border-radius: 4px;
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        font-size: 0.85em;
      }

      /* Citation inline chips */
      .citation-inline {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0 5px;
        font-size: 0.7rem;
        font-weight: 700;
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        color: var(--color-accent, hsl(250, 85%, 65%));
        background: hsla(250, 85%, 65%, 0.1);
        border-radius: var(--radius-full, 9999px);
        cursor: pointer;
        vertical-align: super;
        line-height: 1;
        margin: 0 1px;
        transition: background var(--transition-fast, 150ms);
      }

      .citation-inline:hover {
        background: hsla(250, 85%, 65%, 0.25);
      }

      /* Streaming cursor */
      .streaming-cursor {
        display: inline-block;
        width: 2px;
        height: 1.1em;
        background: var(--color-accent, hsl(250, 85%, 65%));
        margin-left: 2px;
        vertical-align: text-bottom;
        animation: cursor-blink 0.8s ease-in-out infinite;
      }

      @keyframes cursor-blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0; }
      }

      /* Meta bar */
      .meta {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 6px;
        padding: 0 4px;
      }

      .meta-time {
        font-size: 0.72rem;
        color: var(--color-text-secondary, hsl(0, 0%, 68%));
        opacity: 0.6;
      }

      .meta-latency {
        font-size: 0.68rem;
        color: var(--color-text-secondary, hsl(0, 0%, 68%));
        opacity: 0.5;
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
      }

      .copy-btn {
        font-size: 0.72rem;
        color: var(--color-text-secondary, hsl(0, 0%, 68%));
        opacity: 0;
        transition: opacity var(--transition-fast, 150ms);
        padding: 2px 8px;
        border-radius: var(--radius-sm, 6px);
      }

      .message:hover .copy-btn {
        opacity: 0.6;
      }

      .copy-btn:hover {
        opacity: 1 !important;
        background: hsla(0, 0%, 100%, 0.06);
      }

      /* Citations bar */
      .citations-bar {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
        padding: 0 4px;
      }
    `;
  }

  render() {
    const { role, content, citations, timestamp, isStreaming, latencyMs } = this.state;
    const isUser = role === 'user';
    const avatarText = isUser ? 'U' : 'AI';

    const bodyHtml = isUser
      ? `<div class="text">${this._escapeHtml(content)}</div>`
      : `<div class="text">${this._renderMarkdown(content)}${isStreaming ? '<span class="streaming-cursor"></span>' : ''}</div>`;

    const timeStr = this._formatTime(timestamp);
    const latencyStr = latencyMs > 0 ? `${(latencyMs / 1000).toFixed(1)}s` : '';

    // Citations chips (for assistant messages)
    let citationsHtml = '';
    if (!isUser && citations?.length > 0 && !isStreaming) {
      citationsHtml = `
        <div class="citations-bar">
          ${citations.map(c => `
            <nb-citation
              index="${c.index}"
              document-name="${this._escapeAttr(c.document_name || c.documentName || '')}"
              page-number="${c.page_number || c.pageNumber || ''}"
              excerpt="${this._escapeAttr(c.excerpt || '')}"
              document-id="${c.document_id || c.documentId || ''}"
            ></nb-citation>
          `).join('')}
        </div>
      `;
    }

    return `
      <div class="message ${role}">
        <div class="avatar">${avatarText}</div>
        <div class="bubble">
          <div class="bubble-content">${bodyHtml}</div>
          ${citationsHtml}
          <div class="meta">
            ${timeStr ? `<span class="meta-time">${timeStr}</span>` : ''}
            ${!isUser && latencyStr ? `<span class="meta-latency">${latencyStr}</span>` : ''}
            ${!isUser && content ? '<button class="copy-btn">Copy</button>' : ''}
          </div>
        </div>
      </div>
    `;
  }
}

defineComponent('nb-message', NbMessage);
export default NbMessage;
