/**
 * ═══════════════════════════════════════════════════════════════
 * nb-search-bar — Full-width search input with mode toggle.
 * Features: debounced real-time search, mode pills, loading
 *           spinner, Cmd+K shortcut, glassmorphism styling.
 * ═══════════════════════════════════════════════════════════════
 */

import { NbComponent, defineComponent } from '@core/component.js';
import { SEARCH_MODES } from '@services/search-service.js';

class NbSearchBar extends NbComponent {

  onMount() {
    this.state.query = '';
    this.state.mode = this.getAttribute('mode') || 'hybrid';
    this.state.loading = false;

    // Use event delegation on shadowRoot — survives re-renders
    this.on(this.shadowRoot, 'input', (e) => {
      if (e.target.classList.contains('search-input')) {
        this._onInput(e);
      }
    });

    this.on(this.shadowRoot, 'keydown', (e) => {
      if (e.target.classList.contains('search-input')) {
        if (e.key === 'Enter') this._onSubmit();
        if (e.key === 'Escape') this._onClear();
      }
    });

    this.on(this.shadowRoot, 'click', (e) => {
      const pill = e.target.closest('.mode-pill');
      if (pill) {
        const mode = pill.dataset.mode;
        if (mode === this.state.mode) return;
        this._switchMode(mode);
        return;
      }

      const clearBtn = e.target.closest('.search-clear');
      if (clearBtn) {
        this._onClear();
      }
    });

    // Global keyboard shortcut: Cmd+K / Ctrl+K
    this._keyHandler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        this.$('.search-input')?.focus();
      }
    };
    document.addEventListener('keydown', this._keyHandler);
  }

  onUnmount() {
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
    }
  }

  _onInput(e) {
    const query = e.target.value;
    this.state.query = query; // Direct update (no re-render)

    // Update clear button visibility
    const clearBtn = this.$('.search-clear');
    if (clearBtn) {
      clearBtn.style.opacity = query ? '1' : '0';
      clearBtn.style.pointerEvents = query ? 'auto' : 'none';
    }

    this.emit('search-input', { query, mode: this.state.mode });
  }

  _switchMode(mode) {
    this.state.mode = mode;

    // Update pill active state via DOM — no re-render needed
    this.$$('.mode-pill').forEach(pill => {
      if (pill.dataset.mode === mode) {
        pill.classList.add('mode-pill--active');
      } else {
        pill.classList.remove('mode-pill--active');
      }
    });

    this.emit('mode-changed', { mode });

    // Re-search with new mode if we have a query
    if (this.state.query) {
      this.emit('search-submitted', {
        query: this.state.query,
        mode,
      });
    }
  }

  _onSubmit() {
    const query = this.state.query?.trim();
    if (!query) return;
    this.emit('search-submitted', { query, mode: this.state.mode });
  }

  _onClear() {
    const input = this.$('.search-input');
    if (input) {
      input.value = '';
      input.focus();
    }
    this.state.query = '';

    const clearBtn = this.$('.search-clear');
    if (clearBtn) {
      clearBtn.style.opacity = '0';
      clearBtn.style.pointerEvents = 'none';
    }

    this.emit('search-cleared');
  }

  /** Called externally to show/hide loading state */
  setLoading(isLoading) {
    const spinner = this.$('.search-spinner');
    const icon = this.$('.search-icon');
    if (spinner) spinner.style.display = isLoading ? 'flex' : 'none';
    if (icon) icon.style.display = isLoading ? 'none' : 'flex';
  }

  /** Focus the search input programmatically */
  focus() {
    this.$('.search-input')?.focus();
  }

  styles() {
    return `
      ${NbComponent.sharedStyles()}

      :host {
        display: block;
      }

      .search-container {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      /* ── Input Row ─────────────────────────────────────── */
      .search-input-wrapper {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 20px;
        background: var(--glass-bg, hsla(230, 15%, 18%, 0.7));
        backdrop-filter: var(--glass-blur, blur(20px));
        -webkit-backdrop-filter: var(--glass-blur, blur(20px));
        border: var(--glass-border, 1px solid hsla(0, 0%, 100%, 0.08));
        border-radius: var(--radius-lg, 16px);
        transition: border-color var(--transition-fast, 150ms),
                    box-shadow var(--transition-fast, 150ms);
      }

      .search-input-wrapper:focus-within {
        border-color: var(--color-accent, hsl(250, 85%, 65%));
        box-shadow: 0 0 0 3px hsla(250, 85%, 65%, 0.15),
                    var(--shadow-md, 0 4px 12px hsla(0,0%,0%,0.4));
      }

      .search-icon {
        display: flex;
        align-items: center;
        color: var(--color-text-secondary);
        flex-shrink: 0;
      }

      .search-spinner {
        display: none;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        flex-shrink: 0;
      }
      .search-spinner::after {
        content: '';
        width: 16px;
        height: 16px;
        border: 2px solid var(--color-border);
        border-top-color: var(--color-accent);
        border-radius: 50%;
        animation: spin 0.6s linear infinite;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      .search-input {
        flex: 1;
        background: transparent;
        border: none;
        color: var(--color-text-primary);
        font-size: 1.0625rem;
        font-family: var(--font-sans, 'Inter', system-ui, sans-serif);
        outline: none;
        min-width: 0;
      }

      .search-input::placeholder {
        color: var(--color-text-tertiary, hsla(0, 0%, 100%, 0.3));
      }

      .search-clear {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: var(--color-bg-elevated);
        color: var(--color-text-secondary);
        cursor: pointer;
        opacity: 0;
        pointer-events: none;
        transition: all var(--transition-fast, 150ms);
        flex-shrink: 0;
      }
      .search-clear:hover {
        background: var(--color-danger, hsl(0, 84%, 60%));
        color: #fff;
      }

      .search-shortcut {
        display: flex;
        align-items: center;
        gap: 4px;
        color: var(--color-text-tertiary, hsla(0, 0%, 100%, 0.3));
        font-size: 0.75rem;
        flex-shrink: 0;
        user-select: none;
      }

      .shortcut-key {
        padding: 2px 6px;
        background: var(--color-bg-elevated);
        border-radius: 4px;
        font-size: 0.6875rem;
        font-family: var(--font-mono, monospace);
      }

      /* ── Mode Pills ────────────────────────────────────── */
      .mode-pills {
        display: flex;
        gap: 8px;
        padding: 0 4px;
      }

      .mode-pill {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 14px;
        border-radius: var(--radius-full, 9999px);
        font-size: 0.8125rem;
        font-weight: 500;
        cursor: pointer;
        color: var(--color-text-secondary);
        background: transparent;
        border: 1px solid transparent;
        transition: all var(--transition-fast, 150ms);
        user-select: none;
      }

      .mode-pill:hover {
        color: var(--color-text-primary);
        background: var(--color-bg-elevated);
      }

      .mode-pill--active {
        color: var(--color-accent, hsl(250, 85%, 65%));
        background: hsla(250, 85%, 65%, 0.1);
        border-color: hsla(250, 85%, 65%, 0.3);
      }
      .mode-pill--active:hover {
        background: hsla(250, 85%, 65%, 0.15);
      }

      .mode-pill nb-icon {
        flex-shrink: 0;
      }
    `;
  }

  render() {
    const mode = this.state.mode || 'hybrid';

    const modePills = SEARCH_MODES.map(m => `
      <button
        class="mode-pill ${m.id === mode ? 'mode-pill--active' : ''}"
        data-mode="${m.id}"
        title="${m.description}"
      >
        <nb-icon name="${m.icon}" size="14"></nb-icon>
        ${m.label}
      </button>
    `).join('');

    return `
      <div class="search-container">
        <div class="search-input-wrapper">
          <div class="search-icon">
            <nb-icon name="search" size="20"></nb-icon>
          </div>
          <div class="search-spinner"></div>
          <input
            class="search-input"
            type="text"
            placeholder="Search across your documents…"
            autocomplete="off"
            spellcheck="false"
          />
          <div class="search-clear" title="Clear search">
            <nb-icon name="x" size="14"></nb-icon>
          </div>
          <div class="search-shortcut">
            <span class="shortcut-key">⌘</span>
            <span class="shortcut-key">K</span>
          </div>
        </div>
        <div class="mode-pills">
          ${modePills}
        </div>
      </div>
    `;
  }
}

defineComponent('nb-search-bar', NbSearchBar);
export default NbSearchBar;
