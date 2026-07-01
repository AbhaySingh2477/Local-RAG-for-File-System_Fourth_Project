/**
 * ═══════════════════════════════════════════════════════════════
 * NbComponent — Base Web Component Class
 * Features: Shadow DOM, reactive props, template rendering,
 *           lifecycle hooks, event helpers, style injection.
 * All custom components extend this class.
 * ═══════════════════════════════════════════════════════════════
 */

export class NbComponent extends HTMLElement {
  /** @type {ShadowRoot} */
  #shadow;

  /** @type {Object} internal reactive state */
  #state = {};

  /** @type {boolean} */
  #mounted = false;

  /** @type {Function[]} cleanup functions for subscriptions */
  #cleanups = [];

  /** @type {AbortController} for event listeners */
  #abortController;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: 'open' });
    this.#abortController = new AbortController();
  }

  /* ── Lifecycle (Override in subclasses) ─────────────────── */

  /**
   * Called after the component is first rendered.
   * Override this instead of connectedCallback.
   */
  onMount() {}

  /**
   * Called before the component is removed from DOM.
   * Override for cleanup.
   */
  onUnmount() {}

  /**
   * Called after any state change triggers a re-render.
   */
  onUpdate() {}

  /**
   * Called when route params are set on this component.
   * @param {Object} params
   */
  onRouteParams(params) {}

  /* ── Template (Override in subclasses) ──────────────────── */

  /**
   * Return the component's HTML template string.
   * @returns {string}
   */
  render() {
    return '';
  }

  /**
   * Return component-scoped CSS.
   * @returns {string}
   */
  styles() {
    return '';
  }

  /* ── Web Component Lifecycle ───────────────────────────── */

  connectedCallback() {
    this.#renderTemplate();
    this.#mounted = true;
    this.onMount();
  }

  disconnectedCallback() {
    this.onUnmount();

    // Clean up subscriptions
    this.#cleanups.forEach(fn => fn());
    this.#cleanups = [];

    // Abort event listeners
    this.#abortController.abort();
  }

  /* ── Reactive State ────────────────────────────────────── */

  /**
   * Get component-local state.
   * @returns {Object}
   */
  get state() {
    return this.#state;
  }

  /**
   * Update component-local state and re-render.
   * @param {Object} partial — Partial state update
   */
  setState(partial) {
    let changed = false;
    Object.entries(partial).forEach(([key, value]) => {
      if (!Object.is(this.#state[key], value)) {
        this.#state[key] = value;
        changed = true;
      }
    });

    if (changed && this.#mounted) {
      this.#renderTemplate();
      this.onUpdate();
    }
  }

  /* ── Rendering ─────────────────────────────────────────── */

  /**
   * Force a re-render.
   */
  update() {
    if (this.#mounted) {
      this.#renderTemplate();
      this.onUpdate();
    }
  }

  #renderTemplate() {
    const css = this.styles();
    const html = this.render();

    this.#shadow.innerHTML = `
      ${css ? `<style>${css}</style>` : ''}
      ${html}
    `;
  }

  /* ── DOM Helpers ────────────────────────────────────────── */

  /**
   * Query an element within the shadow DOM.
   * @param {string} selector
   * @returns {Element|null}
   */
  $(selector) {
    return this.#shadow.querySelector(selector);
  }

  /**
   * Query all elements within the shadow DOM.
   * @param {string} selector
   * @returns {NodeList}
   */
  $$(selector) {
    return this.#shadow.querySelectorAll(selector);
  }

  /**
   * Add an event listener within the shadow DOM (auto-cleaned up).
   * @param {string|Element} selectorOrEl
   * @param {string} event
   * @param {Function} handler
   * @param {Object} [options]
   */
  on(selectorOrEl, event, handler, options = {}) {
    const el = typeof selectorOrEl === 'string'
      ? this.$(selectorOrEl)
      : selectorOrEl;

    if (!el) return;

    el.addEventListener(event, handler, {
      ...options,
      signal: this.#abortController.signal,
    });
  }

  /**
   * Emit a custom event from this component.
   * @param {string} name — Event name
   * @param {*} [detail] — Event detail payload
   * @param {Object} [options]
   */
  emit(name, detail = null, options = {}) {
    this.dispatchEvent(new CustomEvent(name, {
      detail,
      bubbles: true,
      composed: true,
      ...options,
    }));
  }

  /* ── Store Binding ─────────────────────────────────────── */

  /**
   * Subscribe to a store and auto-cleanup on unmount.
   * @param {Object} store — A store returned by createStore
   * @param {string} key — State key to watch
   * @param {Function} callback — (newValue, oldValue) => void
   */
  watch(store, key, callback) {
    const unsub = store.subscribe(key, callback);
    this.#cleanups.push(unsub);
  }

  /**
   * Subscribe to a store and re-render on change.
   * @param {Object} store — A store returned by createStore
   * @param {string|string[]} keys — State key(s) to watch
   */
  bindStore(store, keys) {
    const keyArr = Array.isArray(keys) ? keys : [keys];
    keyArr.forEach(key => {
      const unsub = store.subscribe(key, () => this.update());
      this.#cleanups.push(unsub);
    });
  }

  /* ── Route Params ──────────────────────────────────────── */

  /** @type {Object} */
  #routeParams = {};

  /**
   * Called by the router to pass params to this component.
   * @param {Object} params
   */
  setRouteParams(params) {
    this.#routeParams = params;
    this.onRouteParams(params);
  }

  /**
   * Get the current route params.
   * @returns {Object}
   */
  get routeParams() {
    return { ...this.#routeParams };
  }

  /** @type {*} */
  #loaderData = null;

  /**
   * Called by the router to pass loader data.
   * @param {*} data
   */
  setLoaderData(data) {
    this.#loaderData = data;
  }

  /**
   * Get loader data.
   * @returns {*}
   */
  get loaderData() {
    return this.#loaderData;
  }

  /* ── Utility ───────────────────────────────────────────── */

  /**
   * Import shared styles (returns @import string for global tokens).
   * @returns {string}
   */
  static sharedStyles() {
    return `
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      :host { display: block; }
      :host([hidden]) { display: none; }

      a { color: var(--color-accent); text-decoration: none; }
      a:hover { color: var(--color-accent-hover); }

      button {
        cursor: pointer;
        border: none;
        background: none;
        font: inherit;
        color: inherit;
      }

      .sr-only {
        position: absolute;
        width: 1px; height: 1px;
        padding: 0; margin: -1px;
        overflow: hidden;
        clip: rect(0,0,0,0);
        white-space: nowrap;
        border: 0;
      }
    `;
  }
}

/**
 * Register a Web Component with a tag name.
 * @param {string} tagName — e.g. 'nb-button'
 * @param {typeof NbComponent} componentClass
 */
export function defineComponent(tagName, componentClass) {
  if (!customElements.get(tagName)) {
    customElements.define(tagName, componentClass);
  }
}

export default NbComponent;
