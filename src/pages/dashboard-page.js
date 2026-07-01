/**
 * ═══════════════════════════════════════════════════════════════
 * <dashboard-page> — Landing page / Dashboard
 * Shows: quick stats, recent activity, getting started guide.
 * ═══════════════════════════════════════════════════════════════
 */
import { NbComponent, defineComponent } from '@core/component.js';
import { appStore, notebookStore, documentStore } from '@core/store.js';
import { api } from '@core/api.js';
import { eventBus, Events } from '@core/events.js';

class DashboardPage extends NbComponent {
  #stats = { notebooks: 0, documents: 0, chunks: 0, models: 0 };

  styles() {
    return `
      ${NbComponent.sharedStyles()}
      :host {
        display: block;
        height: 100%;
        overflow-y: auto;
      }

      .dashboard {
        max-width: 960px;
        margin: 0 auto;
        padding: 40px 32px;
        animation: fade-in-up 400ms var(--ease-out, ease-out) both;
      }

      @keyframes fade-in-up {
        from { opacity: 0; transform: translateY(16px); }
        to { opacity: 1; transform: translateY(0); }
      }

      /* ── Welcome ──────────── */
      .dashboard__welcome {
        margin-bottom: 40px;
      }

      .dashboard__greeting {
        font-size: 1.875rem;
        font-weight: 700;
        color: var(--color-text-primary, #f2f2f2);
        letter-spacing: -0.02em;
        margin-bottom: 8px;
      }

      .dashboard__greeting span {
        background: linear-gradient(135deg, hsl(250, 85%, 65%), hsl(310, 85%, 65%));
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .dashboard__subtitle {
        font-size: 1rem;
        color: var(--color-text-secondary, #adadad);
        line-height: 1.6;
      }

      /* ── Stats Grid ──────── */
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
        margin-bottom: 40px;
      }

      .stat-card {
        padding: 20px;
        border-radius: var(--radius-lg, 14px);
        background: var(--color-bg-secondary, hsl(230, 18%, 14%));
        border: 1px solid var(--color-border, hsla(0,0%,100%,0.08));
        transition: all var(--duration-fast, 150ms) var(--ease-default, ease);
        cursor: default;
      }

      .stat-card:hover {
        border-color: var(--color-border-hover, hsla(0,0%,100%,0.14));
        transform: translateY(-2px);
        box-shadow: var(--shadow-md, 0 4px 6px hsla(0,0%,0%,0.15));
      }

      .stat-card__icon {
        width: 40px;
        height: 40px;
        border-radius: var(--radius-md, 10px);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 12px;
      }

      .stat-card__icon--purple  { background: hsla(250, 85%, 65%, 0.12); color: hsl(250, 85%, 65%); }
      .stat-card__icon--blue    { background: hsla(210, 90%, 60%, 0.12); color: hsl(210, 90%, 60%); }
      .stat-card__icon--green   { background: hsla(142, 71%, 45%, 0.12); color: hsl(142, 71%, 45%); }
      .stat-card__icon--amber   { background: hsla(38, 92%, 50%, 0.12);  color: hsl(38, 92%, 50%); }

      .stat-card__value {
        font-size: 1.75rem;
        font-weight: 700;
        color: var(--color-text-primary, #f2f2f2);
        margin-bottom: 4px;
        letter-spacing: -0.02em;
      }

      .stat-card__label {
        font-size: 0.8125rem;
        color: var(--color-text-tertiary, #7a7a7a);
      }

      /* ── Quick Actions ───── */
      .section-title {
        font-size: 1rem;
        font-weight: 600;
        color: var(--color-text-primary, #f2f2f2);
        margin-bottom: 16px;
      }

      .actions-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        margin-bottom: 40px;
      }

      .action-card {
        padding: 20px;
        border-radius: var(--radius-lg, 14px);
        border: 1px solid var(--color-border, hsla(0,0%,100%,0.08));
        background: var(--color-bg-secondary, hsl(230, 18%, 14%));
        cursor: pointer;
        transition: all var(--duration-fast, 150ms) var(--ease-default, ease);
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .action-card:hover {
        border-color: var(--color-accent, hsl(250, 85%, 65%));
        background: var(--color-bg-elevated, hsl(230, 15%, 18%));
        box-shadow: 0 0 0 1px var(--color-accent, hsl(250, 85%, 65%)),
                    0 0 24px hsla(250, 85%, 65%, 0.1);
        transform: translateY(-2px);
      }

      .action-card:active {
        transform: scale(0.98);
      }

      .action-card__icon {
        width: 44px;
        height: 44px;
        border-radius: var(--radius-md, 10px);
        background: var(--color-accent-subtle, hsla(250, 85%, 65%, 0.12));
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--color-accent, hsl(250, 85%, 65%));
      }

      .action-card__title {
        font-weight: 600;
        font-size: 0.9375rem;
        color: var(--color-text-primary, #f2f2f2);
      }

      .action-card__desc {
        font-size: 0.8125rem;
        color: var(--color-text-tertiary, #7a7a7a);
        line-height: 1.5;
      }

      /* ── Getting Started ──── */
      .getting-started {
        padding: 24px;
        border-radius: var(--radius-lg, 14px);
        background: linear-gradient(135deg,
          hsla(250, 85%, 65%, 0.06),
          hsla(280, 85%, 65%, 0.04)
        );
        border: 1px solid hsla(250, 85%, 65%, 0.12);
      }

      .steps {
        display: flex;
        flex-direction: column;
        gap: 16px;
        margin-top: 16px;
      }

      .step {
        display: flex;
        align-items: flex-start;
        gap: 12px;
      }

      .step__number {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: var(--color-accent-subtle, hsla(250, 85%, 65%, 0.12));
        color: var(--color-accent, hsl(250, 85%, 65%));
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.75rem;
        font-weight: 700;
        flex-shrink: 0;
      }

      .step__content {
        padding-top: 4px;
      }

      .step__title {
        font-weight: 500;
        font-size: 0.875rem;
        color: var(--color-text-primary, #f2f2f2);
        margin-bottom: 2px;
      }

      .step__desc {
        font-size: 0.8125rem;
        color: var(--color-text-tertiary, #7a7a7a);
      }

      /* ── Responsive ──────── */
      @media (max-width: 800px) {
        .stats-grid { grid-template-columns: repeat(2, 1fr); }
        .actions-grid { grid-template-columns: 1fr; }
      }
    `;
  }

  render() {
    const s = this.#stats;

    return `
      <div class="dashboard">
        <div class="dashboard__welcome">
          <h1 class="dashboard__greeting">
            Welcome to <span>NotebookLM Local</span>
          </h1>
          <p class="dashboard__subtitle">
            Your private, AI-powered document research assistant. Upload documents,
            ask questions, and get answers with citations — all running locally on your machine.
          </p>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-card__icon stat-card__icon--purple">
              <nb-icon name="book-open" size="20"></nb-icon>
            </div>
            <div class="stat-card__value">${s.notebooks}</div>
            <div class="stat-card__label">Notebooks</div>
          </div>
          <div class="stat-card">
            <div class="stat-card__icon stat-card__icon--blue">
              <nb-icon name="file-text" size="20"></nb-icon>
            </div>
            <div class="stat-card__value">${s.documents}</div>
            <div class="stat-card__label">Documents</div>
          </div>
          <div class="stat-card">
            <div class="stat-card__icon stat-card__icon--green">
              <nb-icon name="database" size="20"></nb-icon>
            </div>
            <div class="stat-card__value">${s.chunks}</div>
            <div class="stat-card__label">Indexed Chunks</div>
          </div>
          <div class="stat-card">
            <div class="stat-card__icon stat-card__icon--amber">
              <nb-icon name="cpu" size="20"></nb-icon>
            </div>
            <div class="stat-card__value">${s.models}</div>
            <div class="stat-card__label">AI Models</div>
          </div>
        </div>

        <h2 class="section-title">Quick Actions</h2>
        <div class="actions-grid">
          <div class="action-card" data-action="new-notebook">
            <div class="action-card__icon">
              <nb-icon name="plus" size="22"></nb-icon>
            </div>
            <div class="action-card__title">Create Notebook</div>
            <div class="action-card__desc">Start a new notebook to organize your documents and research.</div>
          </div>
          <div class="action-card" data-action="upload">
            <div class="action-card__icon">
              <nb-icon name="upload" size="22"></nb-icon>
            </div>
            <div class="action-card__title">Upload Documents</div>
            <div class="action-card__desc">Import PDF, DOCX, Markdown, and more into your notebooks.</div>
          </div>
          <div class="action-card" data-action="chat">
            <div class="action-card__icon">
              <nb-icon name="message-square" size="22"></nb-icon>
            </div>
            <div class="action-card__title">Chat with Documents</div>
            <div class="action-card__desc">Ask questions and get AI answers with citations from your docs.</div>
          </div>
        </div>

        <div class="getting-started">
          <h2 class="section-title" style="margin-bottom:0">Getting Started</h2>
          <div class="steps">
            <div class="step">
              <div class="step__number">1</div>
              <div class="step__content">
                <div class="step__title">Install Ollama</div>
                <div class="step__desc">Download and install Ollama from ollama.com, then pull a model like llama3.2.</div>
              </div>
            </div>
            <div class="step">
              <div class="step__number">2</div>
              <div class="step__content">
                <div class="step__title">Create a Notebook</div>
                <div class="step__desc">Organize your research by creating a notebook for each topic or project.</div>
              </div>
            </div>
            <div class="step">
              <div class="step__number">3</div>
              <div class="step__content">
                <div class="step__title">Upload Documents</div>
                <div class="step__desc">Add PDFs, DOCX, Markdown, or any text files. They'll be automatically parsed and indexed.</div>
              </div>
            </div>
            <div class="step">
              <div class="step__number">4</div>
              <div class="step__content">
                <div class="step__title">Start Chatting</div>
                <div class="step__desc">Ask questions about your documents. Every answer includes citations linking back to source material.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async onMount() {
    // Fetch stats from backend
    try {
      const result = await api.get('/stats');
      if (result.ok) {
        this.#stats = result.data;
        this.update();
      }
    } catch {
      // Backend not connected yet — show zeros
    }

    // Handle quick action clicks
    this.shadowRoot.addEventListener('click', (e) => {
      const card = e.target.closest('[data-action]');
      if (!card) return;

      const action = card.dataset.action;
      switch (action) {
        case 'new-notebook':
          window.location.hash = '/notebooks';
          break;
        case 'upload':
          window.location.hash = '/notebooks';
          break;
        case 'chat':
          window.location.hash = '/chat';
          break;
      }
    });
  }
}

defineComponent('dashboard-page', DashboardPage);
export default DashboardPage;
