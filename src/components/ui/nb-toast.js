/**
 * ═══════════════════════════════════════════════════════════════
 * <nb-toast> — Toast Notification System
 * Usage: eventBus.emit(Events.TOAST_SHOW, { message, type })
 * Types: success, error, warning, info
 * ═══════════════════════════════════════════════════════════════
 */
import { NbComponent, defineComponent } from '@core/component.js';
import { eventBus, Events } from '@core/events.js';

class NbToast extends NbComponent {
  /** @type {{ id: number, message: string, type: string }[]} */
  #toasts = [];
  #nextId = 0;
  #unsub = null;

  styles() {
    return `
      ${NbComponent.sharedStyles()}
      :host {
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: var(--z-toast, 500);
        display: flex;
        flex-direction: column;
        gap: 8px;
        pointer-events: none;
        max-width: 420px;
        width: 100%;
      }

      .toast {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 12px 16px;
        border-radius: var(--radius-md, 10px);
        backdrop-filter: var(--glass-blur, blur(24px));
        border: var(--glass-border, 1px solid hsla(0,0%,100%,0.06));
        box-shadow: var(--shadow-lg, 0 10px 25px hsla(0,0%,0%,0.2));
        pointer-events: auto;
        cursor: pointer;
        animation: toast-in 300ms var(--ease-spring, cubic-bezier(0.175, 0.885, 0.32, 1.275)) both;
        font-size: 0.875rem;
        line-height: 1.5;
        color: var(--color-text-primary, #f2f2f2);
      }

      .toast--exiting {
        animation: toast-out 200ms var(--ease-in, ease-in) both;
      }

      .toast--success {
        background: hsla(142, 55%, 18%, 0.85);
        border-color: hsla(142, 71%, 45%, 0.25);
      }
      .toast--success .toast__icon { color: hsl(142, 71%, 45%); }

      .toast--error {
        background: hsla(0, 55%, 18%, 0.85);
        border-color: hsla(0, 84%, 60%, 0.25);
      }
      .toast--error .toast__icon { color: hsl(0, 84%, 60%); }

      .toast--warning {
        background: hsla(38, 55%, 18%, 0.85);
        border-color: hsla(38, 92%, 50%, 0.25);
      }
      .toast--warning .toast__icon { color: hsl(38, 92%, 50%); }

      .toast--info {
        background: var(--glass-bg-strong, hsla(230, 18%, 14%, 0.85));
        border-color: hsla(210, 90%, 60%, 0.2);
      }
      .toast--info .toast__icon { color: hsl(210, 90%, 60%); }

      .toast__icon {
        flex-shrink: 0;
        margin-top: 1px;
      }

      .toast__message {
        flex: 1;
      }

      .toast__close {
        flex-shrink: 0;
        opacity: 0.5;
        transition: opacity 150ms;
        cursor: pointer;
        color: inherit;
      }
      .toast__close:hover {
        opacity: 1;
      }

      @keyframes toast-in {
        from {
          opacity: 0;
          transform: translateX(100%) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateX(0) scale(1);
        }
      }
      @keyframes toast-out {
        from {
          opacity: 1;
          transform: translateX(0) scale(1);
        }
        to {
          opacity: 0;
          transform: translateX(100%) scale(0.95);
        }
      }
    `;
  }

  render() {
    const icons = {
      success: 'check',
      error: 'alert-circle',
      warning: 'alert-circle',
      info: 'info',
    };

    return this.#toasts.map(t => `
      <div class="toast toast--${t.type}" data-id="${t.id}">
        <nb-icon class="toast__icon" name="${icons[t.type] || 'info'}" size="18"></nb-icon>
        <span class="toast__message">${t.message}</span>
        <span class="toast__close" data-close="${t.id}">
          <nb-icon name="x" size="14"></nb-icon>
        </span>
      </div>
    `).join('');
  }

  onMount() {
    this.#unsub = eventBus.on(Events.TOAST_SHOW, (data) => {
      this.#show(data);
    });

    // Delegate close clicks
    this.shadowRoot.addEventListener('click', (e) => {
      const closeBtn = e.target.closest('[data-close]');
      if (closeBtn) {
        const id = parseInt(closeBtn.dataset.close);
        this.#dismiss(id);
      }
      // Also dismiss on toast body click
      const toast = e.target.closest('.toast');
      if (toast && !closeBtn) {
        const id = parseInt(toast.dataset.id);
        this.#dismiss(id);
      }
    });
  }

  onUnmount() {
    this.#unsub?.();
  }

  /**
   * Show a toast notification.
   * @param {{ message: string, type?: string, duration?: number }}
   */
  #show({ message, type = 'info', duration = 4000 }) {
    const id = this.#nextId++;
    this.#toasts.push({ id, message, type });
    this.update();

    // Auto-dismiss
    if (duration > 0) {
      setTimeout(() => this.#dismiss(id), duration);
    }
  }

  /**
   * Dismiss a toast with exit animation.
   * @param {number} id
   */
  #dismiss(id) {
    const el = this.$(`[data-id="${id}"]`);
    if (el) {
      el.classList.add('toast--exiting');
      setTimeout(() => {
        this.#toasts = this.#toasts.filter(t => t.id !== id);
        this.update();
      }, 200);
    } else {
      this.#toasts = this.#toasts.filter(t => t.id !== id);
      this.update();
    }
  }
}

defineComponent('nb-toast', NbToast);

/* ── Convenience helper ────────────────────────────────────── */

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'warning'|'info'} [type='info']
 * @param {number} [duration=4000]
 */
export function showToast(message, type = 'info', duration = 4000) {
  eventBus.emit(Events.TOAST_SHOW, { message, type, duration });
}

export default NbToast;
