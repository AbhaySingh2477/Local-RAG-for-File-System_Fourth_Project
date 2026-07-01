/**
 * ═══════════════════════════════════════════════════════════════
 * <nb-shell> — Application Shell
 * Orchestrates sidebar + header + router outlet.
 * ═══════════════════════════════════════════════════════════════
 */
import { NbComponent, defineComponent } from '@core/component.js';
import { appStore } from '@core/store.js';
import { eventBus, Events } from '@core/events.js';

class NbShell extends NbComponent {
  styles() {
    return `
      ${NbComponent.sharedStyles()}
      :host {
        display: block;
        height: 100vh;
        width: 100vw;
        overflow: hidden;
      }

      .shell {
        display: grid;
        grid-template-columns: var(--sidebar-width, 260px) 1fr;
        height: 100%;
        transition: grid-template-columns var(--duration-base, 250ms) var(--ease-default, ease);
      }

      .shell--collapsed {
        grid-template-columns: var(--sidebar-collapsed-width, 64px) 1fr;
      }

      .shell__sidebar {
        overflow: hidden;
        min-width: 0;
      }

      .shell__main {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        min-width: 0;
        background: var(--color-bg-primary, hsl(230, 21%, 11%));
      }

      .shell__content {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        position: relative;
      }

      /* ── Loading overlay ─── */
      .shell__loader {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--color-bg-primary, hsl(230, 21%, 11%));
        z-index: 10;
        opacity: 1;
        transition: opacity var(--duration-slow, 400ms);
      }

      .shell__loader--hidden {
        opacity: 0;
        pointer-events: none;
      }

      .shell__loader-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        animation: fade-in-up 500ms var(--ease-out, ease-out) both;
      }

      .shell__loader-logo {
        width: 48px;
        height: 48px;
        border-radius: var(--radius-lg, 14px);
        background: linear-gradient(135deg, hsl(0, 0%, 40%), hsl(0, 0%, 20%));
        display: flex;
        align-items: center;
        justify-content: center;
        animation: pulse 2s ease-in-out infinite;
      }

      .shell__loader-text {
        color: var(--color-text-secondary, #adadad);
        font-size: 0.875rem;
      }

      @keyframes fade-in-up {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.8; transform: scale(0.95); }
      }
    `;
  }

  render() {
    const collapsed = appStore.state.sidebarCollapsed;

    return `
      <div class="shell ${collapsed ? 'shell--collapsed' : ''}" id="shell">
        <div class="shell__sidebar">
          <nb-sidebar></nb-sidebar>
        </div>
        <div class="shell__main">
          <div class="shell__content" id="router-outlet">
            <div class="shell__loader" id="app-loader">
              <div class="shell__loader-content">
                <div class="shell__loader-logo">
                  <nb-icon name="sparkles" size="24" color="#fff"></nb-icon>
                </div>
                <div class="shell__loader-text">Connecting to backend...</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <nb-toast></nb-toast>
    `;
  }

  onMount() {
    // Listen for sidebar toggle
    eventBus.on(Events.SIDEBAR_TOGGLE, () => {
      appStore.state.sidebarCollapsed = !appStore.state.sidebarCollapsed;
      const shell = this.$('#shell');
      if (shell) {
        shell.classList.toggle('shell--collapsed', appStore.state.sidebarCollapsed);
      }
    });

    // Emit that shell is ready (for router initialization)
    requestAnimationFrame(() => {
      this.emit('shell-ready', { outlet: this.$('#router-outlet') });
    });
  }

  /**
   * Hide the loading overlay.
   */
  hideLoader() {
    const loader = this.$('#app-loader');
    if (loader) {
      loader.classList.add('shell__loader--hidden');
      setTimeout(() => loader.remove(), 400);
    }
  }

  /**
   * Get the router outlet element.
   * @returns {HTMLElement}
   */
  getOutlet() {
    return this.$('#router-outlet');
  }
}

defineComponent('nb-shell', NbShell);
export default NbShell;
