/**
 * ═══════════════════════════════════════════════════════════════
 * nb-chat-input — Chat input area with auto-resize textarea
 * Features: auto-resize, Enter to send, Shift+Enter for newline,
 *           stop generation button, disabled during streaming.
 * ═══════════════════════════════════════════════════════════════
 */

import { NbComponent, defineComponent } from '@core/component.js';

class NbChatInput extends NbComponent {
  onMount() {
    this.setState({
      value: '',
      isStreaming: false,
      disabled: false,
    });
    requestAnimationFrame(() => this._bindEvents());
  }

  _bindEvents() {
    const textarea = this.$('.chat-textarea');
    const sendBtn = this.$('.send-btn');
    const stopBtn = this.$('.stop-btn');

    if (textarea) {
      this.on(textarea, 'input', (e) => {
        this.state.value = e.target.value;
        this._autoResize(e.target);
      });

      this.on(textarea, 'keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this._send();
        }
      });
    }

    if (sendBtn) {
      this.on(sendBtn, 'click', () => this._send());
    }

    if (stopBtn) {
      this.on(stopBtn, 'click', () => {
        this.emit('stop-generation');
      });
    }

    // Focus the textarea
    textarea?.focus();
  }

  _autoResize(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 180) + 'px';
  }

  _send() {
    const value = this.state.value?.trim();
    if (!value || this.state.isStreaming || this.state.disabled) return;

    this.emit('send-message', { content: value });

    // Clear input
    this.state.value = '';
    const textarea = this.$('.chat-textarea');
    if (textarea) {
      textarea.value = '';
      textarea.style.height = 'auto';
    }
  }

  /**
   * Set streaming state.
   * @param {boolean} streaming
   */
  setStreaming(streaming) {
    this.setState({ isStreaming: streaming });
    requestAnimationFrame(() => this._bindEvents());
  }

  /**
   * Set disabled state.
   * @param {boolean} disabled
   */
  setDisabled(disabled) {
    this.setState({ disabled });
  }

  /**
   * Focus the input.
   */
  focusInput() {
    requestAnimationFrame(() => {
      this.$('.chat-textarea')?.focus();
    });
  }

  styles() {
    return `
      ${NbComponent.sharedStyles()}

      :host {
        display: block;
      }

      .input-container {
        display: flex;
        align-items: flex-end;
        gap: 10px;
        padding: 16px 20px;
        background: var(--color-bg-secondary, hsl(230, 18%, 14%));
        border-top: 1px solid var(--color-border, hsl(230, 10%, 28%));
      }

      .textarea-wrapper {
        flex: 1;
        position: relative;
      }

      .chat-textarea {
        width: 100%;
        min-height: 44px;
        max-height: 180px;
        padding: 12px 16px;
        background: var(--color-bg-primary, hsl(230, 21%, 11%));
        border: 1px solid var(--color-border, hsl(230, 10%, 28%));
        border-radius: var(--radius-lg, 16px);
        color: var(--color-text-primary, hsl(0, 0%, 95%));
        font-family: var(--font-sans, 'Inter', system-ui, sans-serif);
        font-size: 0.9rem;
        line-height: 1.5;
        resize: none;
        outline: none;
        transition: border-color var(--transition-fast, 150ms);
        overflow-y: auto;
      }

      .chat-textarea::placeholder {
        color: var(--color-text-secondary, hsl(0, 0%, 68%));
        opacity: 0.5;
      }

      .chat-textarea:focus {
        border-color: var(--color-accent, hsl(250, 85%, 65%));
        box-shadow: 0 0 0 3px hsla(250, 85%, 65%, 0.15);
      }

      .chat-textarea:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .send-btn, .stop-btn {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all var(--transition-fast, 150ms);
        flex-shrink: 0;
      }

      .send-btn {
        background: linear-gradient(135deg, hsl(250, 85%, 55%), hsl(280, 75%, 55%));
        color: white;
      }

      .send-btn:hover:not(:disabled) {
        transform: scale(1.06);
        box-shadow: 0 4px 16px hsla(250, 85%, 55%, 0.4);
      }

      .send-btn:active:not(:disabled) {
        transform: scale(0.95);
      }

      .send-btn:disabled {
        opacity: 0.35;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
      }

      .send-btn svg, .stop-btn svg {
        width: 20px;
        height: 20px;
      }

      .stop-btn {
        background: hsl(0, 84%, 55%);
        color: white;
        animation: pulse-stop 1.5s ease-in-out infinite;
      }

      .stop-btn:hover {
        background: hsl(0, 84%, 60%);
        transform: scale(1.06);
      }

      @keyframes pulse-stop {
        0%, 100% { box-shadow: 0 0 0 0 hsla(0, 84%, 55%, 0.4); }
        50% { box-shadow: 0 0 0 8px hsla(0, 84%, 55%, 0); }
      }

      .hint {
        font-size: 0.7rem;
        color: var(--color-text-secondary, hsl(0, 0%, 68%));
        opacity: 0.4;
        text-align: center;
        padding: 6px 0 2px;
      }

      .hint kbd {
        padding: 1px 5px;
        background: hsla(0, 0%, 100%, 0.06);
        border-radius: 3px;
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        font-size: 0.65rem;
      }
    `;
  }

  render() {
    const { isStreaming, disabled } = this.state;
    const isDisabled = isStreaming || disabled;

    const sendIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
    const stopIcon = `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`;

    return `
      <div class="input-container">
        <div class="textarea-wrapper">
          <textarea
            class="chat-textarea"
            placeholder="Ask about your documents…"
            rows="1"
            ${isDisabled ? 'disabled' : ''}
          ></textarea>
        </div>
        ${isStreaming
          ? `<button class="stop-btn" title="Stop generation">${stopIcon}</button>`
          : `<button class="send-btn" ${isDisabled ? 'disabled' : ''} title="Send message (Enter)">${sendIcon}</button>`
        }
      </div>
      <div class="hint"><kbd>Enter</kbd> to send · <kbd>Shift+Enter</kbd> for new line</div>
    `;
  }
}

defineComponent('nb-chat-input', NbChatInput);
export default NbChatInput;
