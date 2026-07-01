/**
 * ═══════════════════════════════════════════════════════════════
 * <nb-header> — Page Header
 * Features: title, breadcrumbs, search, actions slot.
 * ═══════════════════════════════════════════════════════════════
 */
import { NbComponent, defineComponent } from '@core/component.js';

class NbHeader extends NbComponent {
  static get observedAttributes() {
    return ['title', 'subtitle', 'show-search'];
  }

  attributeChangedCallback() {
    this.update();
  }

  styles() {
    return `
      ${NbComponent.sharedStyles()}
      :host {
        display: flex;
        align-items: center;
        height: var(--header-height, 56px);
        padding: 0 24px;
        border-bottom: 1px solid var(--color-border, hsla(0,0%,100%,0.08));
        background: var(--color-bg-primary, hsl(230, 21%, 11%));
        flex-shrink: 0;
        gap: 16px;
      }

      .header__info {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;
        min-width: 0;
      }

      .header__title {
        font-size: 1rem;
        font-weight: 600;
        color: var(--color-text-primary, #f2f2f2);
        letter-spacing: -0.01em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .header__subtitle {
        font-size: 0.75rem;
        color: var(--color-text-tertiary, #7a7a7a);
      }

      .header__search {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 7px 14px;
        border-radius: var(--radius-md, 10px);
        background: var(--color-bg-secondary, hsl(230, 18%, 14%));
        border: 1px solid var(--color-border, hsla(0,0%,100%,0.08));
        color: var(--color-text-muted, #616161);
        cursor: pointer;
        font-size: 0.8125rem;
        transition: all var(--duration-fast, 150ms) var(--ease-default, ease);
        min-width: 200px;
      }

      .header__search:hover {
        border-color: var(--color-border-hover, hsla(0,0%,100%,0.14));
        background: var(--color-bg-elevated, hsl(230, 15%, 18%));
      }

      .header__search kbd {
        font-size: 0.6875rem;
        padding: 2px 6px;
        border-radius: 4px;
        background: var(--color-bg-hover, hsl(230, 14%, 21%));
        border: 1px solid var(--color-border, hsla(0,0%,100%,0.08));
        color: var(--color-text-muted, #616161);
        font-family: var(--font-sans);
        margin-left: auto;
      }

      .header__actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    `;
  }

  render() {
    const title = this.getAttribute('title') || '';
    const subtitle = this.getAttribute('subtitle') || '';
    const showSearch = this.hasAttribute('show-search');

    return `
      <div class="header__info">
        <div class="header__title">${title}</div>
        ${subtitle ? `<div class="header__subtitle">${subtitle}</div>` : ''}
      </div>

      ${showSearch ? `
        <div class="header__search" id="search-trigger">
          <nb-icon name="search" size="14"></nb-icon>
          <span>Search documents...</span>
          <kbd>⌘K</kbd>
        </div>
      ` : ''}

      <div class="header__actions">
        <slot name="actions"></slot>
      </div>
    `;
  }

  onMount() {
    // Keyboard shortcut for search
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        this.emit('search-open');
      }
    });

    const searchTrigger = this.$('#search-trigger');
    if (searchTrigger) {
      this.on(searchTrigger, 'click', () => {
        this.emit('search-open');
      });
    }
  }
}

defineComponent('nb-header', NbHeader);
export default NbHeader;
