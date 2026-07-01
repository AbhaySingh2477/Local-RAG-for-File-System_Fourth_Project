import { NbComponent, defineComponent } from '@core/component.js';
import { appStore } from '@core/store.js';
import { eventBus, Events } from '@core/events.js';

class NotebookPage extends NbComponent {
  styles() {
    return `
      ${NbComponent.sharedStyles()}
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--color-bg-primary);
        color: var(--color-text-primary);
        overflow: hidden;
      }

      /* ── Top Header ────────────────────────────────────────── */
      .nb-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 24px;
        border-bottom: 1px solid var(--color-border);
        background: var(--color-bg-primary);
      }
      
      .nb-header__left {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      
      .nb-header__back {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: var(--color-bg-secondary);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: background 150ms;
      }
      .nb-header__back:hover {
        background: var(--color-bg-hover);
      }

      .nb-header__title {
        font-size: 1.125rem;
        font-weight: 500;
        color: var(--color-text-primary);
      }

      .nb-header__right {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .header-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 0.8125rem;
        font-weight: 500;
        cursor: pointer;
        border: 1px solid var(--color-border);
        background: transparent;
        color: var(--color-text-primary);
        transition: all 150ms;
      }
      .header-btn:hover {
        background: var(--color-bg-hover);
      }
      .header-btn--primary {
        background: var(--color-text-primary);
        color: var(--color-bg-app);
        border-color: transparent;
      }
      .header-btn--primary:hover {
        background: var(--color-text-secondary);
      }

      /* ── 3-Column Layout ────────────────────────────────────── */
      .nb-content {
        display: grid;
        grid-template-columns: 320px 1fr 340px;
        gap: 16px;
        padding: 16px;
        flex: 1;
        min-height: 0;
        background: var(--color-bg-primary);
      }

      .panel {
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px;
      }

      .panel-title {
        font-size: 1rem;
        font-weight: 500;
        color: var(--color-text-primary);
      }

      .panel-body {
        flex: 1;
        overflow-y: auto;
        padding: 0 16px 16px 16px;
      }

      /* ── Sources Panel ──────────────────────────────────────── */
      .sources-search {
        display: flex;
        align-items: center;
        gap: 8px;
        background: var(--color-bg-primary);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        padding: 8px 12px;
        margin-top: 12px;
        margin-bottom: 24px;
      }
      .sources-search input {
        background: transparent;
        border: none;
        color: var(--color-text-primary);
        outline: none;
        flex: 1;
        font-size: 0.8125rem;
      }

      .sources-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        color: var(--color-text-secondary);
        padding: 40px 20px;
        gap: 12px;
        margin-top: 40px;
      }
      .sources-empty nb-icon {
        color: var(--color-text-tertiary);
        margin-bottom: 8px;
      }

      /* ── Chat Panel ─────────────────────────────────────────── */
      .chat-panel {
        background: transparent;
        border: none;
      }
      
      .chat-hero {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        flex: 1;
        text-align: center;
      }
      
      .chat-hero__icon {
        width: 56px;
        height: 56px;
        border-radius: 12px;
        background: linear-gradient(135deg, hsl(0, 0%, 25%), hsl(0, 0%, 15%));
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 24px;
        box-shadow: 0 8px 24px hsla(0, 0%, 0%, 0.4);
        border: 1px solid hsla(0, 0%, 100%, 0.1);
      }

      .chat-hero__title {
        font-size: 2rem;
        font-weight: 600;
        margin-bottom: 8px;
      }

      .chat-hero__subtitle {
        color: var(--color-text-secondary);
        font-size: 0.875rem;
      }

      .chat-input-container {
        padding: 16px;
        background: var(--color-bg-secondary);
        border-radius: var(--radius-lg);
        border: 1px solid var(--color-border);
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 16px;
      }

      .chat-input-container input {
        flex: 1;
        background: transparent;
        border: none;
        color: var(--color-text-primary);
        font-size: 0.9375rem;
        outline: none;
      }

      .chat-input__actions {
        display: flex;
        align-items: center;
        gap: 12px;
        color: var(--color-text-secondary);
        font-size: 0.8125rem;
      }

      .send-btn {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: var(--color-bg-elevated);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }

      /* ── Studio Panel ───────────────────────────────────────── */
      .studio-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      .studio-card {
        background: var(--color-bg-elevated);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        cursor: pointer;
        transition: all 150ms;
        position: relative;
        overflow: hidden;
      }

      .studio-card:hover {
        background: var(--color-bg-hover);
        border-color: var(--color-border-hover);
        transform: translateY(-2px);
      }

      /* Monochromatic Silver Gradients for Cards */
      .studio-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 4px;
        height: 100%;
        opacity: 0.8;
      }
      .studio-card--guide::before { background: linear-gradient(to bottom, #d4d4d8, #71717a); }
      .studio-card--briefing::before { background: linear-gradient(to bottom, #e4e4e7, #52525b); }
      .studio-card--flashcards::before { background: linear-gradient(to bottom, #a1a1aa, #3f3f46); }
      .studio-card--quiz::before { background: linear-gradient(to bottom, #f4f4f5, #a1a1aa); }
      .studio-card--faq::before { background: linear-gradient(to bottom, #d4d4d8, #52525b); }
      .studio-card--mindmap::before { background: linear-gradient(to bottom, #71717a, #3f3f46); }

      .studio-card__icon {
        color: var(--color-text-primary);
        opacity: 0.9;
      }
      
      .studio-card__label {
        font-size: 0.8125rem;
        font-weight: 500;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      
      .studio-card__arrow {
        opacity: 0;
        transform: translateX(-4px);
        transition: all 150ms;
      }
      .studio-card:hover .studio-card__arrow {
        opacity: 1;
        transform: translateX(0);
      }

      .studio-footer {
        margin-top: 24px;
        text-align: center;
        color: var(--color-text-secondary);
        font-size: 0.8125rem;
      }
      
      .add-note-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: var(--color-text-primary);
        color: var(--color-bg-app);
        padding: 8px 16px;
        border-radius: 20px;
        font-weight: 500;
        margin-top: 16px;
        cursor: pointer;
      }
    `;
  }

  render() {
    return `
      <!-- Header -->
      <div class="nb-header">
        <div class="nb-header__left">
          <div class="nb-header__back" onclick="window.location.hash='/'">
            <nb-icon name="chevron-left" size="18"></nb-icon>
          </div>
          <div class="nb-header__title">Untitled notebook</div>
        </div>
        <div class="nb-header__right">
          <button class="header-btn header-btn--primary">
            <nb-icon name="plus" size="16"></nb-icon> Create notebook
          </button>
          <button class="header-btn">
            <nb-icon name="settings" size="16"></nb-icon> Settings
          </button>
        </div>
      </div>

      <!-- Main Layout -->
      <div class="nb-content">
        
        <!-- Sources Panel -->
        <div class="panel sources-panel">
          <div class="panel-header">
            <div class="panel-title">Sources</div>
            <nb-icon name="layout" size="18" color="var(--color-text-secondary)"></nb-icon>
          </div>
          <div class="panel-body">
            <nb-button variant="secondary" full-width="true" icon="plus">Add sources</nb-button>
            
            <div class="sources-search">
              <nb-icon name="search" size="16" color="var(--color-text-secondary)"></nb-icon>
              <input type="text" placeholder="Search the web for new sources" />
            </div>

            <div class="sources-empty">
              <nb-icon name="file" size="32"></nb-icon>
              <div style="font-weight:500">Saved sources will appear here</div>
              <div style="font-size:0.8125rem; line-height:1.5;">
                Click Add source above to add PDFs, websites, text, videos, or audio files. Or import a file directly from Google Drive.
              </div>
            </div>
          </div>
        </div>

        <!-- Chat Panel -->
        <div class="panel chat-panel">
          <div class="panel-header" style="padding: 0 0 16px 0;">
            <div class="panel-title">Chat</div>
            <nb-icon name="more-vertical" size="18" color="var(--color-text-secondary)"></nb-icon>
          </div>
          
          <div class="chat-hero">
            <div class="chat-hero__icon">
              <nb-icon name="book-open" size="28" color="#fff"></nb-icon>
            </div>
            <div class="chat-hero__title">Untitled notebook</div>
            <div class="chat-hero__subtitle">0 sources • Jul 1, 2026</div>
          </div>

          <div class="chat-input-container">
            <input type="text" placeholder="Start typing..." />
            <div class="chat-input__actions">
              <span style="color:var(--color-accent)">●</span>
              <span>0 sources</span>
              <div class="send-btn">
                <nb-icon name="send" size="14"></nb-icon>
              </div>
            </div>
          </div>
        </div>

        <!-- Studio Panel -->
        <div class="panel studio-panel">
          <div class="panel-header">
            <div class="panel-title">Studio</div>
            <nb-icon name="layout" size="18" color="var(--color-text-secondary)"></nb-icon>
          </div>
          <div class="panel-body">
            
            <div class="studio-grid">
              <div class="studio-card studio-card--guide">
                <div class="studio-card__icon"><nb-icon name="file-text" size="18"></nb-icon></div>
                <div class="studio-card__label">Study Guide <nb-icon class="studio-card__arrow" name="chevron-right" size="14"></nb-icon></div>
              </div>
              <div class="studio-card studio-card--briefing">
                <div class="studio-card__icon"><nb-icon name="file" size="18"></nb-icon></div>
                <div class="studio-card__label">Briefing Doc <nb-icon class="studio-card__arrow" name="chevron-right" size="14"></nb-icon></div>
              </div>
              <div class="studio-card studio-card--flashcards">
                <div class="studio-card__icon"><nb-icon name="copy" size="18"></nb-icon></div>
                <div class="studio-card__label">Flashcards <nb-icon class="studio-card__arrow" name="chevron-right" size="14"></nb-icon></div>
              </div>
              <div class="studio-card studio-card--quiz">
                <div class="studio-card__icon"><nb-icon name="help-circle" size="18"></nb-icon></div>
                <div class="studio-card__label">Quiz <nb-icon class="studio-card__arrow" name="chevron-right" size="14"></nb-icon></div>
              </div>
              <div class="studio-card studio-card--faq">
                <div class="studio-card__icon"><nb-icon name="message-square" size="18"></nb-icon></div>
                <div class="studio-card__label">FAQ <nb-icon class="studio-card__arrow" name="chevron-right" size="14"></nb-icon></div>
              </div>
              <div class="studio-card studio-card--mindmap">
                <div class="studio-card__icon"><nb-icon name="network" size="18"></nb-icon></div>
                <div class="studio-card__label">Mind Map <nb-icon class="studio-card__arrow" name="chevron-right" size="14"></nb-icon></div>
              </div>
            </div>

            <div class="studio-footer">
              <div>Studio output will be saved here.</div>
              <div style="margin-top:4px;">After adding sources, click to add a Study Guide, Briefing Doc and more!</div>
              <div class="add-note-btn">
                <nb-icon name="plus" size="16"></nb-icon> Add note
              </div>
            </div>

          </div>
        </div>

      </div>
    `;
  }
  
  onMount() {
    // Hide global sidebar when entering Notebook page to match the screenshot layout
    appStore.state.sidebarCollapsed = true;
    const shell = document.getElementById('shell');
    if (shell) {
      shell.classList.add('shell--collapsed');
    }
  }
}

defineComponent('notebook-page', NotebookPage);
export default NotebookPage;
