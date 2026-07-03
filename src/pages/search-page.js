/**
 * ═══════════════════════════════════════════════════════════════
 * search-page — Dedicated search page with premium UI.
 * Features: hero search bar, mode pills, filter sidebar,
 *           result cards with highlights, stats bar,
 *           glassmorphism, micro-animations, dark theme.
 * ═══════════════════════════════════════════════════════════════
 */

import { NbComponent, defineComponent } from '@core/component.js';
import { search as executeSearch, SEARCH_MODES } from '@services/search-service.js';

class SearchPage extends NbComponent {

  onMount() {
    this.setState({
      hasSearched: false,
    });

    // ── Wire up search bar ────────────────────────────────
    const searchBar = this.$('nb-search-bar');
    if (searchBar) {
      // Debounced search on typing
      let debounceTimer = null;

      this.on(searchBar, 'search-input', (e) => {
        const { query, mode } = e.detail;
        clearTimeout(debounceTimer);

        if (!query || !query.trim()) {
          const results = this.$('nb-search-results');
          if (results) results.clear();
          return;
        }

        debounceTimer = setTimeout(() => {
          this._executeSearch(query, mode);
        }, 350);
      });

      this.on(searchBar, 'search-submitted', (e) => {
        clearTimeout(debounceTimer);
        this._executeSearch(e.detail.query, e.detail.mode);
      });

      this.on(searchBar, 'mode-changed', (e) => {
        // Re-execute current query with new mode if we have results
        if (this.state.hasSearched) {
          const input = searchBar.$('.search-input');
          const query = input?.value?.trim();
          if (query) {
            this._executeSearch(query, e.detail.mode);
          }
        }
      });

      this.on(searchBar, 'search-cleared', () => {
        const results = this.$('nb-search-results');
        if (results) results.clear();
        this.setState({ hasSearched: false });
      });

      // Auto-focus on mount
      setTimeout(() => searchBar.focus(), 100);
    }

    // ── Wire up filters ────────────────────────────────────
    const filters = this.$('nb-search-filters');
    if (filters) {
      this.on(filters, 'filters-changed', () => {
        // Re-execute with current query
        const searchBar = this.$('nb-search-bar');
        const input = searchBar?.$('.search-input');
        const query = input?.value?.trim();
        if (query) {
          const mode = searchBar?.state?.mode || 'hybrid';
          this._executeSearch(query, mode);
        }
      });
    }
  }

  async _executeSearch(query, mode) {
    if (!query?.trim()) return;

    const searchBar = this.$('nb-search-bar');
    const resultsEl = this.$('nb-search-results');

    // Show loading
    searchBar?.setLoading(true);
    resultsEl?.setLoading(true);

    // Get filter state
    const filtersEl = this.$('nb-search-filters');
    const filterState = filtersEl?.getFilters?.() || {};

    try {
      const result = await executeSearch(query, {
        mode,
        limit: filterState.limit || 10,
        filters: filterState.filters,
      });

      if (result.ok && result.data) {
        resultsEl?.setResults(result.data);
      } else {
        resultsEl?.setError(result.error || 'Search failed');
      }
    } catch (err) {
      resultsEl?.setError(err.message || 'Search error');
    } finally {
      searchBar?.setLoading(false);
      this.state.hasSearched = true;
    }
  }

  styles() {
    return `
      ${NbComponent.sharedStyles()}

      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--color-bg-primary);
        color: var(--color-text-primary);
        overflow-y: auto;
      }

      /* ── Hero Section ────────────────────────────────────── */
      .search-hero {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 48px 32px 32px;
        text-align: center;
        position: relative;
        overflow: hidden;
      }

      /* Gradient accent glow behind search bar */
      .search-hero::before {
        content: '';
        position: absolute;
        top: 0;
        left: 50%;
        transform: translateX(-50%);
        width: 600px;
        height: 300px;
        background: radial-gradient(
          ellipse at center,
          hsla(250, 85%, 65%, 0.08) 0%,
          transparent 70%
        );
        pointer-events: none;
      }

      .search-hero__title {
        font-size: 1.75rem;
        font-weight: 700;
        margin-bottom: 8px;
        background: linear-gradient(
          135deg,
          var(--color-text-primary) 0%,
          var(--color-accent, hsl(250, 85%, 65%)) 100%
        );
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .search-hero__subtitle {
        font-size: 0.9375rem;
        color: var(--color-text-secondary);
        margin-bottom: 32px;
        max-width: 500px;
      }

      .search-bar-wrapper {
        width: 100%;
        max-width: 720px;
        position: relative;
        z-index: 1;
      }

      /* ── Content Layout ──────────────────────────────────── */
      .search-content {
        display: grid;
        grid-template-columns: 260px 1fr;
        gap: 24px;
        padding: 0 32px 40px;
        max-width: 1200px;
        margin: 0 auto;
        width: 100%;
        flex: 1;
      }

      .search-sidebar {
        position: sticky;
        top: 16px;
        align-self: start;
      }

      .search-results-area {
        min-width: 0;
      }

      /* ── Index Stats ─────────────────────────────────────── */
      .index-stats {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 24px;
        padding: 16px 0 0;
        margin-top: 16px;
      }

      .stat-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.8125rem;
        color: var(--color-text-tertiary);
      }

      .stat-item nb-icon {
        opacity: 0.6;
      }

      .stat-value {
        font-weight: 600;
        color: var(--color-text-secondary);
        font-family: var(--font-mono, monospace);
      }

      /* ── Responsive ──────────────────────────────────────── */
      @media (max-width: 800px) {
        .search-content {
          grid-template-columns: 1fr;
          padding: 0 16px 32px;
        }
        .search-sidebar {
          position: static;
        }
        .search-hero {
          padding: 32px 16px 24px;
        }
        .search-hero__title {
          font-size: 1.5rem;
        }
      }
    `;
  }

  render() {
    return `
      <!-- Hero Section -->
      <div class="search-hero">
        <h1 class="search-hero__title">Semantic Search</h1>
        <p class="search-hero__subtitle">
          Search across all your indexed documents using semantic understanding,
          keyword matching, or hybrid fusion.
        </p>
        <div class="search-bar-wrapper">
          <nb-search-bar mode="hybrid"></nb-search-bar>
        </div>
      </div>

      <!-- Content: Sidebar + Results -->
      <div class="search-content">
        <div class="search-sidebar">
          <nb-search-filters></nb-search-filters>
        </div>
        <div class="search-results-area">
          <nb-search-results></nb-search-results>
        </div>
      </div>
    `;
  }
}

defineComponent('search-page', SearchPage);
export default SearchPage;
