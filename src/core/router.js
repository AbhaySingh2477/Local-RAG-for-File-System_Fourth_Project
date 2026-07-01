/**
 * ═══════════════════════════════════════════════════════════════
 * SPA Hash Router — Zero-dependency client-side routing
 * Features: hash-based routes, guards, transitions, lazy loading,
 *           wildcard/parameterized routes, navigation stack.
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * @typedef {Object} Route
 * @property {string} path — Hash path, e.g. '/notebooks/:id'
 * @property {Function} component — Returns a DOM element or Web Component tag
 * @property {string} [title] — Document title
 * @property {Function} [guard] — Route guard: return false to prevent navigation
 * @property {Function} [loader] — Async data loader called before render
 */

class Router {
  /** @type {Route[]} */
  #routes = [];

  /** @type {HTMLElement|null} */
  #outlet = null;

  /** @type {Route|null} */
  #currentRoute = null;

  /** @type {Object} */
  #currentParams = {};

  /** @type {Function[]} */
  #beforeEachGuards = [];

  /** @type {Function[]} */
  #afterEachHooks = [];

  /** @type {string[]} */
  #history = [];

  /**
   * @param {HTMLElement|string} outlet — Container element or selector
   * @param {Route[]} routes — Route definitions
   */
  constructor(outlet, routes = []) {
    this.#outlet = typeof outlet === 'string'
      ? document.querySelector(outlet)
      : outlet;

    if (!this.#outlet) {
      throw new Error(`[Router] Outlet element not found: ${outlet}`);
    }

    this.#routes = routes;
    this.#bindEvents();
    this.#handleRoute();
  }

  /* ── Public API ────────────────────────────────────────── */

  /**
   * Navigate to a hash path.
   * @param {string} path
   * @param {Object} [options]
   * @param {boolean} [options.replace=false] — Replace current history entry
   */
  navigate(path, { replace = false } = {}) {
    if (replace) {
      window.history.replaceState(null, '', `#${path}`);
    } else {
      window.location.hash = path;
    }
  }

  /**
   * Go back in history.
   */
  back() {
    if (this.#history.length > 1) {
      this.#history.pop();
      const prev = this.#history[this.#history.length - 1];
      this.navigate(prev, { replace: true });
    }
  }

  /**
   * Register a before-each guard.
   * @param {Function} fn — (to, from) => boolean|Promise<boolean>
   */
  beforeEach(fn) {
    this.#beforeEachGuards.push(fn);
  }

  /**
   * Register an after-each hook.
   * @param {Function} fn — (to, from) => void
   */
  afterEach(fn) {
    this.#afterEachHooks.push(fn);
  }

  /**
   * Get current route params.
   * @returns {Object}
   */
  get params() {
    return { ...this.#currentParams };
  }

  /**
   * Get current route path.
   * @returns {string}
   */
  get currentPath() {
    return this.#getHashPath();
  }

  /**
   * Get current route object.
   * @returns {Route|null}
   */
  get current() {
    return this.#currentRoute;
  }

  /**
   * Get query params from hash.
   * @returns {URLSearchParams}
   */
  get query() {
    const hash = window.location.hash.slice(1);
    const queryIndex = hash.indexOf('?');
    if (queryIndex === -1) return new URLSearchParams();
    return new URLSearchParams(hash.slice(queryIndex));
  }

  /* ── Private ───────────────────────────────────────────── */

  #bindEvents() {
    window.addEventListener('hashchange', () => this.#handleRoute());

    // Intercept clicks on <a href="#/..."> for SPA navigation
    document.addEventListener('click', (e) => {
      const anchor = e.target.closest('a[href^="#"]');
      if (anchor) {
        e.preventDefault();
        const path = anchor.getAttribute('href').slice(1);
        this.navigate(path);
      }
    });
  }

  #getHashPath() {
    const hash = window.location.hash.slice(1) || '/';
    const queryIndex = hash.indexOf('?');
    return queryIndex === -1 ? hash : hash.slice(0, queryIndex);
  }

  /**
   * Match a route definition against a path.
   * Supports :param and * wildcard.
   * @param {string} routePath
   * @param {string} currentPath
   * @returns {{ matched: boolean, params: Object }}
   */
  #matchRoute(routePath, currentPath) {
    const routeParts = routePath.split('/').filter(Boolean);
    const pathParts = currentPath.split('/').filter(Boolean);
    const params = {};

    // Wildcard catch-all
    if (routePath === '*') return { matched: true, params };

    if (routeParts.length !== pathParts.length) {
      return { matched: false, params };
    }

    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(':')) {
        params[routeParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
      } else if (routeParts[i] !== pathParts[i]) {
        return { matched: false, params };
      }
    }

    return { matched: true, params };
  }

  async #handleRoute() {
    const path = this.#getHashPath();
    const previousRoute = this.#currentRoute;

    // Find matching route
    let matchedRoute = null;
    let matchedParams = {};

    for (const route of this.#routes) {
      const { matched, params } = this.#matchRoute(route.path, path);
      if (matched) {
        matchedRoute = route;
        matchedParams = params;
        break;
      }
    }

    if (!matchedRoute) {
      // Try wildcard/404 route
      const fallback = this.#routes.find(r => r.path === '*');
      if (fallback) {
        matchedRoute = fallback;
      } else {
        console.warn(`[Router] No route matched: ${path}`);
        return;
      }
    }

    // Run route-level guard
    if (matchedRoute.guard) {
      const allowed = await matchedRoute.guard(matchedParams);
      if (allowed === false) return;
    }

    // Run global before-each guards
    for (const guard of this.#beforeEachGuards) {
      const allowed = await guard(
        { path, route: matchedRoute, params: matchedParams },
        { path: this.#history[this.#history.length - 1], route: previousRoute }
      );
      if (allowed === false) return;
    }

    // Update state
    this.#currentRoute = matchedRoute;
    this.#currentParams = matchedParams;
    this.#history.push(path);

    // Update document title
    if (matchedRoute.title) {
      document.title = `${matchedRoute.title} — NotebookLM Local`;
    }

    // Run loader if present
    let loaderData = null;
    if (matchedRoute.loader) {
      try {
        loaderData = await matchedRoute.loader(matchedParams);
      } catch (err) {
        console.error(`[Router] Loader failed for ${path}:`, err);
      }
    }

    // Render
    await this.#render(matchedRoute, matchedParams, loaderData);

    // Run after-each hooks
    for (const hook of this.#afterEachHooks) {
      hook(
        { path, route: matchedRoute, params: matchedParams },
        { route: previousRoute }
      );
    }
  }

  /**
   * Render the matched route into the outlet.
   * @param {Route} route
   * @param {Object} params
   * @param {*} loaderData
   */
  async #render(route, params, loaderData) {
    // Exit animation on old content
    const oldContent = this.#outlet.firstElementChild;
    if (oldContent) {
      oldContent.classList.add('page-exit');
      await new Promise(r => setTimeout(r, 100));
    }

    // Clear outlet
    this.#outlet.innerHTML = '';

    // Get component
    let component;
    const result = route.component(params, loaderData);

    if (result instanceof Promise) {
      // Lazy-loaded component
      component = await result;
    } else if (typeof result === 'string') {
      // Web Component tag name
      component = document.createElement(result);
    } else if (result instanceof HTMLElement) {
      component = result;
    } else {
      console.error(`[Router] Invalid component returned for route: ${route.path}`);
      return;
    }

    // Pass params and data to component
    if (component.setRouteParams) {
      component.setRouteParams(params);
    }
    if (component.setLoaderData) {
      component.setLoaderData(loaderData);
    }

    // Set data attributes for params
    Object.entries(params).forEach(([key, value]) => {
      component.setAttribute(`data-${key}`, value);
    });

    // Enter animation
    component.classList.add('page-enter');
    this.#outlet.appendChild(component);
  }
}

// Singleton
let routerInstance = null;

/**
 * Create and return the router singleton.
 * @param {HTMLElement|string} outlet
 * @param {Route[]} routes
 * @returns {Router}
 */
export function createRouter(outlet, routes) {
  routerInstance = new Router(outlet, routes);
  return routerInstance;
}

/**
 * Get the router singleton.
 * @returns {Router}
 */
export function useRouter() {
  if (!routerInstance) {
    throw new Error('[Router] Router not initialized. Call createRouter() first.');
  }
  return routerInstance;
}

export default Router;
