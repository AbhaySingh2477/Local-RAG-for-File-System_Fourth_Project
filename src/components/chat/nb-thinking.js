/**
 * ═══════════════════════════════════════════════════════════════
 * nb-thinking — Animated thinking/loading indicator
 * Shows retrieval and generation phase status with animated dots.
 * ═══════════════════════════════════════════════════════════════
 */

import { NbComponent, defineComponent } from '@core/component.js';

class NbThinking extends NbComponent {
  onMount() {
    this.setState({
      message: this.getAttribute('message') || 'Thinking',
      visible: true,
    });
  }

  /**
   * Update the thinking message.
   * @param {string} msg
   */
  setMessage(msg) {
    this.setState({ message: msg });
  }

  show() { this.setState({ visible: true }); }
  hide() { this.setState({ visible: false }); }

  styles() {
    return `
      ${NbComponent.sharedStyles()}

      :host {
        display: block;
      }

      .thinking {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 20px;
        max-width: 480px;
        background: var(--glass-bg, hsla(230, 15%, 18%, 0.7));
        backdrop-filter: var(--glass-blur, blur(20px));
        -webkit-backdrop-filter: var(--glass-blur, blur(20px));
        border: var(--glass-border, 1px solid hsla(0, 0%, 100%, 0.08));
        border-radius: var(--radius-lg, 16px);
        animation: thinking-enter 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .thinking.hidden {
        display: none;
      }

      @keyframes thinking-enter {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .dots {
        display: flex;
        gap: 4px;
        align-items: center;
      }

      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--color-accent, hsl(250, 85%, 65%));
        animation: dot-pulse 1.4s ease-in-out infinite;
      }

      .dot:nth-child(2) { animation-delay: 0.2s; }
      .dot:nth-child(3) { animation-delay: 0.4s; }

      @keyframes dot-pulse {
        0%, 80%, 100% {
          opacity: 0.3;
          transform: scale(0.8);
        }
        40% {
          opacity: 1;
          transform: scale(1.1);
        }
      }

      .message {
        font-size: 0.875rem;
        color: var(--color-text-secondary, hsl(0, 0%, 68%));
        font-family: var(--font-sans, 'Inter', system-ui, sans-serif);
        letter-spacing: 0.01em;
      }

      .shimmer {
        display: inline-block;
        background: linear-gradient(
          90deg,
          var(--color-text-secondary, hsl(0, 0%, 68%)) 25%,
          var(--color-text-primary, hsl(0, 0%, 95%)) 50%,
          var(--color-text-secondary, hsl(0, 0%, 68%)) 75%
        );
        background-size: 200% 100%;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        animation: shimmer 2s linear infinite;
      }

      @keyframes shimmer {
        0% { background-position: 200% center; }
        100% { background-position: -200% center; }
      }
    `;
  }

  render() {
    const { message, visible } = this.state;
    return `
      <div class="thinking ${visible ? '' : 'hidden'}" role="status" aria-live="polite">
        <div class="dots">
          <div class="dot"></div>
          <div class="dot"></div>
          <div class="dot"></div>
        </div>
        <span class="message shimmer">${message || 'Thinking'}…</span>
      </div>
    `;
  }
}

defineComponent('nb-thinking', NbThinking);
export default NbThinking;
