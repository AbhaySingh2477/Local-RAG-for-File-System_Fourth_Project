/**
 * ═══════════════════════════════════════════════════════════════
 * nb-processing-status — Real-time processing stage indicator
 * Shows current pipeline stage with animated progress.
 * ═══════════════════════════════════════════════════════════════
 */

import { NbComponent, defineComponent } from '@core/component.js';

const STAGES = [
  { id: 'parsing', label: 'Parsing', icon: 'file-text' },
  { id: 'analyzing', label: 'Analyzing', icon: 'search' },
  { id: 'chunking', label: 'Chunking', icon: 'scissors' },
  { id: 'embedding', label: 'Embedding', icon: 'cpu' },
  { id: 'indexing', label: 'Indexing', icon: 'database' },
];

class NbProcessingStatus extends NbComponent {

  static get observedAttributes() {
    return ['stage', 'progress', 'doc-name'];
  }

  attributeChangedCallback() {
    this.update();
  }

  styles() {
    return `
      ${NbComponent.sharedStyles()}

      :host {
        display: block;
      }

      .processing {
        background: var(--color-bg-elevated);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        padding: 16px;
        animation: slideIn 300ms ease;
      }

      @keyframes slideIn {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .processing__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
      }

      .processing__title {
        font-size: 0.8125rem;
        font-weight: 500;
        color: var(--color-text-primary);
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .processing__spinner {
        width: 14px;
        height: 14px;
        border: 2px solid var(--color-border);
        border-top-color: var(--color-text-primary);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      .processing__pct {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--color-text-secondary);
        font-variant-numeric: tabular-nums;
      }

      .processing__bar {
        height: 3px;
        background: var(--color-bg-primary);
        border-radius: 2px;
        overflow: hidden;
        margin-bottom: 14px;
      }

      .processing__fill {
        height: 100%;
        background: linear-gradient(90deg,
          hsl(0, 0%, 50%),
          hsl(0, 0%, 85%));
        border-radius: 2px;
        transition: width 400ms cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
      }

      .processing__fill::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(90deg,
          transparent 0%,
          hsla(0, 0%, 100%, 0.3) 50%,
          transparent 100%);
        animation: shimmer 2s ease-in-out infinite;
      }

      @keyframes shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }

      .stages {
        display: flex;
        gap: 4px;
      }

      .stage {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
      }

      .stage__icon {
        width: 28px;
        height: 28px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--color-bg-primary);
        border: 1px solid var(--color-border);
        color: var(--color-text-tertiary);
        transition: all 250ms;
        font-size: 12px;
      }

      .stage--active .stage__icon {
        background: hsl(0, 0%, 20%);
        border-color: hsl(0, 0%, 50%);
        color: var(--color-text-primary);
        box-shadow: 0 0 8px hsla(0, 0%, 100%, 0.1);
      }

      .stage--done .stage__icon {
        background: hsl(142, 30%, 20%);
        border-color: hsl(142, 40%, 35%);
        color: var(--color-success);
      }

      .stage__label {
        font-size: 0.625rem;
        color: var(--color-text-tertiary);
        font-weight: 500;
        transition: color 250ms;
      }

      .stage--active .stage__label {
        color: var(--color-text-primary);
      }

      .stage--done .stage__label {
        color: var(--color-text-secondary);
      }
    `;
  }

  render() {
    const currentStage = this.getAttribute('stage') || 'parsing';
    const progress = parseFloat(this.getAttribute('progress') || '0');
    const docName = this.getAttribute('doc-name') || 'Document';
    const progressPct = Math.round(progress * 100);

    const currentIdx = STAGES.findIndex(s => s.id === currentStage);

    const stagesHtml = STAGES.map((stage, i) => {
      let stateClass = '';
      if (i < currentIdx) stateClass = 'stage--done';
      else if (i === currentIdx) stateClass = 'stage--active';

      const iconName = i < currentIdx ? 'check' : stage.icon;

      return `
        <div class="stage ${stateClass}">
          <div class="stage__icon">
            <nb-icon name="${iconName}" size="12"></nb-icon>
          </div>
          <span class="stage__label">${stage.label}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="processing">
        <div class="processing__header">
          <div class="processing__title">
            <div class="processing__spinner"></div>
            Processing "${docName}"
          </div>
          <div class="processing__pct">${progressPct}%</div>
        </div>
        <div class="processing__bar">
          <div class="processing__fill" style="width:${progressPct}%"></div>
        </div>
        <div class="stages">${stagesHtml}</div>
      </div>
    `;
  }
}

defineComponent('nb-processing-status', NbProcessingStatus);
export default NbProcessingStatus;
