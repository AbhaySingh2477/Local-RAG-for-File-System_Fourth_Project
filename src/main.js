/**
 * ═══════════════════════════════════════════════════════════════
 * Application Entry Point
 * Bootstraps the entire frontend: imports components, initializes
 * router and stores, starts WebSocket connection, checks backend.
 * ═══════════════════════════════════════════════════════════════
 */

/* ── Import Core ─────────────────────────────────────────── */
import { createRouter } from '@core/router.js';
import { appStore } from '@core/store.js';
import { api, ws } from '@core/api.js';
import { eventBus, Events } from '@core/events.js';

/* ── Import Components (registers custom elements) ────── */
import '@components/ui/nb-icon.js';
import '@components/ui/nb-button.js';
import '@components/ui/nb-toast.js';
import '@components/layout/nb-sidebar.js';
import '@components/layout/nb-header.js';
import '@components/layout/nb-shell.js';

/* ── Import Pages ────────────────────────────────────────── */
import '@pages/dashboard-page.js';
import '@pages/notebook-page.js';

/* ── Route Definitions ───────────────────────────────────── */
const routes = [
  {
    path: '/',
    title: 'Dashboard',
    component: () => document.createElement('dashboard-page'),
  },
  {
    path: '/notebooks',
    title: 'Notebooks',
    component: () => document.createElement('notebook-page'),
  },
  {
    path: '/search',
    title: 'Search',
    component: () => {
      const el = document.createElement('div');
      el.innerHTML = `<div style="padding:40px;color:var(--color-text-secondary)">
        <h2 style="color:var(--color-text-primary);margin-bottom:8px">Semantic Search</h2>
        <p>Coming in Phase 3 — Hybrid search with vector + BM25 + cross-encoder reranking.</p>
      </div>`;
      return el;
    },
  },
  {
    path: '/chat',
    title: 'Chat',
    component: () => {
      const el = document.createElement('div');
      el.innerHTML = `<div style="padding:40px;color:var(--color-text-secondary)">
        <h2 style="color:var(--color-text-primary);margin-bottom:8px">Chat with Documents</h2>
        <p>Coming in Phase 4 — RAG chat with streaming responses and citations.</p>
      </div>`;
      return el;
    },
  },
  {
    path: '/models',
    title: 'Models',
    component: () => {
      const el = document.createElement('div');
      el.innerHTML = `<div style="padding:40px;color:var(--color-text-secondary)">
        <h2 style="color:var(--color-text-primary);margin-bottom:8px">Model Manager</h2>
        <p>Coming in Phase 5 — Download and manage Ollama models.</p>
      </div>`;
      return el;
    },
  },
  {
    path: '/settings',
    title: 'Settings',
    component: () => {
      const el = document.createElement('div');
      el.innerHTML = `<div style="padding:40px;color:var(--color-text-secondary)">
        <h2 style="color:var(--color-text-primary);margin-bottom:8px">Settings</h2>
        <p>Coming in Phase 5 — Application configuration.</p>
      </div>`;
      return el;
    },
  },
  {
    path: '*',
    title: '404',
    component: () => {
      const el = document.createElement('div');
      el.innerHTML = `<div style="padding:40px;text-align:center;color:var(--color-text-secondary)">
        <h2 style="color:var(--color-text-primary);font-size:3rem;margin-bottom:8px">404</h2>
        <p>Page not found</p>
        <a href="#/" style="color:var(--color-accent);margin-top:16px;display:inline-block">← Back to Dashboard</a>
      </div>`;
      return el;
    },
  },
];

/* ── Application Bootstrap ───────────────────────────────── */

async function initApp() {
  console.log('[App] Initializing NotebookLM Local...');

  // 1. Apply persisted theme
  const theme = appStore.state.theme || 'dark';
  document.documentElement.setAttribute('data-theme', theme);

  // 2. Mount the app shell
  const appRoot = document.getElementById('app');
  const shell = document.createElement('nb-shell');
  appRoot.appendChild(shell);

  // 3. Wait for shell to be ready, then init router
  await new Promise(resolve => {
    // Small delay to ensure shadow DOM is ready
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  });

  const outlet = shell.getOutlet();
  if (!outlet) {
    console.error('[App] Router outlet not found');
    return;
  }

  // 4. Initialize router
  const router = createRouter(outlet, routes);

  // Track page changes
  router.afterEach((to) => {
    appStore.state.currentPage = to.route?.path === '/' ? 'dashboard' :
      to.path?.slice(1)?.split('/')[0] || 'dashboard';
  });

  // 5. Check backend health
  await checkBackendHealth();

  // 6. Hide boot screen
  const bootScreen = document.getElementById('boot-screen');
  if (bootScreen) {
    bootScreen.classList.add('hidden');
    setTimeout(() => bootScreen.remove(), 400);
  }

  // 7. Hide shell loader
  shell.hideLoader();

  // 8. Connect WebSocket for real-time updates
  try {
    ws.connect();
    ws.onStatus((status) => {
      appStore.state.backendStatus = status;
    });
  } catch {
    // WebSocket is optional for initial load
  }

  // 9. Mark app as initialized
  appStore.state.initialized = true;
  eventBus.emit(Events.APP_READY);

  console.log('[App] NotebookLM Local ready ✓');
}

/**
 * Check if the Python backend is running.
 */
async function checkBackendHealth() {
  appStore.state.backendStatus = 'connecting';

  try {
    const result = await api.get('/health', { timeout: 5000 });
    if (result.ok) {
      appStore.state.backendStatus = 'connected';
      appStore.state.ollamaStatus = result.data?.ollama_status || 'unknown';
      eventBus.emit(Events.BACKEND_CONNECTED, result.data);
      console.log('[App] Backend connected:', result.data);
    } else {
      appStore.state.backendStatus = 'disconnected';
      eventBus.emit(Events.BACKEND_DISCONNECTED);
    }
  } catch {
    appStore.state.backendStatus = 'disconnected';
    eventBus.emit(Events.BACKEND_DISCONNECTED);
    console.warn('[App] Backend not available — start it with: cd backend && python main.py');
  }
}

// Periodically check backend health
setInterval(checkBackendHealth, 30000);

// Start the app
initApp().catch(err => {
  console.error('[App] Fatal initialization error:', err);
});
