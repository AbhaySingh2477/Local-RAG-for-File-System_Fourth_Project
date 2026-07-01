/**
 * ═══════════════════════════════════════════════════════════════
 * <nb-button> — Button Component
 * Variants: primary, secondary, ghost, danger
 * Sizes: sm, md, lg
 * States: loading, disabled
 * ═══════════════════════════════════════════════════════════════
 */
import { NbComponent, defineComponent } from '@core/component.js';

class NbButton extends NbComponent {
  static get observedAttributes() {
    return ['variant', 'size', 'loading', 'disabled', 'icon', 'icon-right', 'full-width'];
  }

  attributeChangedCallback() {
    this.update();
  }

  styles() {
    return `
      ${NbComponent.sharedStyles()}
      :host {
        display: inline-flex;
      }
      :host([full-width]) {
        display: flex;
        width: 100%;
      }

      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        border: 1px solid transparent;
        border-radius: var(--radius-md, 10px);
        font-weight: 500;
        font-size: 0.875rem;
        line-height: 1;
        white-space: nowrap;
        cursor: pointer;
        user-select: none;
        transition:
          background var(--duration-fast, 150ms) var(--ease-default, ease),
          border-color var(--duration-fast, 150ms) var(--ease-default, ease),
          color var(--duration-fast, 150ms) var(--ease-default, ease),
          box-shadow var(--duration-fast, 150ms) var(--ease-default, ease),
          transform var(--duration-instant, 50ms) var(--ease-default, ease);
        position: relative;
        overflow: hidden;
      }

      .btn:active:not(:disabled) {
        transform: scale(0.97);
      }

      .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        pointer-events: none;
      }

      .btn:focus-visible {
        outline: 2px solid var(--color-accent, #7c6bf5);
        outline-offset: 2px;
      }

      /* ── Sizes ─────────── */
      .btn--sm {
        height: 32px;
        padding: 0 12px;
        font-size: 0.8125rem;
        border-radius: var(--radius-sm, 6px);
      }

      .btn--md {
        height: 38px;
        padding: 0 16px;
      }

      .btn--lg {
        height: 44px;
        padding: 0 24px;
        font-size: 0.9375rem;
        border-radius: var(--radius-lg, 14px);
      }

      /* ── Variants ──────── */
      .btn--primary {
        background: var(--color-accent, hsl(0, 0%, 75%));
        color: var(--color-text-on-accent, #fff);
        border-color: transparent;
      }
      .btn--primary:hover:not(:disabled) {
        background: var(--color-accent-hover, hsl(0, 0%, 90%));
        box-shadow: 0 0 16px hsla(250, 85%, 65%, 0.3);
      }

      .btn--secondary {
        background: var(--color-bg-elevated, hsl(230, 15%, 18%));
        color: var(--color-text-primary, #f2f2f2);
        border-color: var(--color-border, hsla(0,0%,100%,0.08));
      }
      .btn--secondary:hover:not(:disabled) {
        background: var(--color-bg-hover, hsl(230, 14%, 21%));
        border-color: var(--color-border-hover, hsla(0,0%,100%,0.14));
      }

      .btn--ghost {
        background: transparent;
        color: var(--color-text-secondary, #adadad);
        border-color: transparent;
      }
      .btn--ghost:hover:not(:disabled) {
        background: var(--color-bg-hover, hsl(230, 14%, 21%));
        color: var(--color-text-primary, #f2f2f2);
      }

      .btn--danger {
        background: var(--color-danger-subtle, hsla(0, 84%, 60%, 0.12));
        color: var(--color-danger, hsl(0, 84%, 60%));
        border-color: transparent;
      }
      .btn--danger:hover:not(:disabled) {
        background: var(--color-danger, hsl(0, 84%, 60%));
        color: #fff;
      }

      /* ── Icon only ─────── */
      .btn--icon-only {
        padding: 0;
        aspect-ratio: 1;
      }
      .btn--icon-only.btn--sm { width: 32px; }
      .btn--icon-only.btn--md { width: 38px; }
      .btn--icon-only.btn--lg { width: 44px; }

      /* ── Loading ─────── */
      .btn__spinner {
        width: 16px;
        height: 16px;
        border: 2px solid transparent;
        border-top-color: currentColor;
        border-radius: 50%;
        animation: spin 0.6s linear infinite;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      .btn__content {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      .btn--loading .btn__content {
        visibility: hidden;
      }

      .btn--loading .btn__spinner {
        position: absolute;
      }

      /* ── Full width ────── */
      :host([full-width]) .btn {
        width: 100%;
      }
    `;
  }

  render() {
    const variant = this.getAttribute('variant') || 'secondary';
    const size = this.getAttribute('size') || 'md';
    const loading = this.hasAttribute('loading');
    const disabled = this.hasAttribute('disabled');
    const icon = this.getAttribute('icon');
    const iconRight = this.getAttribute('icon-right');
    const isIconOnly = icon && !this.textContent?.trim();

    const classes = [
      'btn',
      `btn--${variant}`,
      `btn--${size}`,
      loading ? 'btn--loading' : '',
      isIconOnly ? 'btn--icon-only' : '',
    ].filter(Boolean).join(' ');

    const iconSize = size === 'sm' ? '14' : size === 'lg' ? '18' : '16';

    return `
      <button class="${classes}" ${disabled || loading ? 'disabled' : ''}>
        ${loading ? '<span class="btn__spinner"></span>' : ''}
        <span class="btn__content">
          ${icon ? `<nb-icon name="${icon}" size="${iconSize}"></nb-icon>` : ''}
          <slot></slot>
          ${iconRight ? `<nb-icon name="${iconRight}" size="${iconSize}"></nb-icon>` : ''}
        </span>
      </button>
    `;
  }

  onMount() {
    // Forward click from shadow button to host
    this.on('.btn', 'click', (e) => {
      if (this.hasAttribute('disabled') || this.hasAttribute('loading')) {
        e.preventDefault();
        e.stopPropagation();
      }
    });
  }
}

defineComponent('nb-button', NbButton);
export default NbButton;
