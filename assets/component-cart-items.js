import { Component } from '@theme/component';
import {
  fetchConfig,
  onAnimationEnd,
  prefersReducedMotion,
  resetShimmer,
  startViewTransition,
} from '@theme/utilities';
import { morphSection, sectionRenderer } from '@theme/section-renderer';
import { ThemeEvents, QuantitySelectorUpdateEvent } from '@theme/events';
import { cartPerformance } from '@theme/performance';
import { enqueueCartWrite, renderWhenSettled } from '@theme/cart-queue';
import {
  createViewEventElement,
  CartErrorEvent,
  CartDiscountUpdateEvent,
  CartLinesUpdateEvent,
  CartNoteUpdateEvent,
  StandardEvents,
} from '@shopify/events';

/** @typedef {import('./utilities').TextComponent} TextComponent */

/**
 * A custom element that displays a cart items component.
 *
 * @typedef {object} Refs
 * @property {HTMLElement[]} quantitySelectors - The quantity selector elements.
 * @property {HTMLTableRowElement[]} cartItemRows - The cart item rows.
 * @property {TextComponent} cartTotal - The cart total.
 *
 * @extends {Component<Refs>}
 */
export class CartItemsComponent extends createViewEventElement(Component) {
  #pendingQuantities = new Map();

  #debouncedOnChange = (event) => {
    if (!(event instanceof QuantitySelectorUpdateEvent)) return;
    if (!(event.target instanceof Element) || !this.contains(event.target)) return;

    const row = event.target.closest('tr[data-key]');
    const key = row?.dataset.key;
    if (!row || !key) return;

    const { quantity } = event.detail;

    if (quantity === 0) {
      this.#pendingQuantities.delete(key);
      this.#removeRow(row);
      return;
    }

    const pending = this.#pendingQuantities.get(key);
    if (pending) {
      pending.quantity = quantity;
      pending.at = performance.now();
      return;
    }

    const entry = { quantity, at: performance.now() };
    this.#pendingQuantities.set(key, entry);
    row.querySelector('text-component')?.shimmer();

    this.updateQuantity({
      row,
      action: 'change',
      settle: async () => {
        while (performance.now() - entry.at < 300) {
          await new Promise((resolve) => setTimeout(resolve, 300 - (performance.now() - entry.at)));
        }
        if (this.#pendingQuantities.get(key) !== entry) return null;
        this.#pendingQuantities.delete(key);

        const input = row.querySelector('input[data-cart-line]');
        if (input instanceof HTMLInputElement && Number(input.defaultValue) === entry.quantity) return null;
        return entry.quantity;
      },
    });
  };
  /** @type {Promise<any> | null} */
  #pendingCartFetch = null;

  /**
   * True when the event was dispatched from outside this cart-items-component (e.g.
   * `Shopify.actions.updateCart(...)` from an external app, or the SFAPI default
   * handler). Internal dispatchers (cart-discount-component, cart-note) live inside
   * `this` and either morph the section themselves or don't need a refresh — running
   * a fallback render in that case double-renders and can clobber form state.
   * @param {Event} event
   */
  #isExternalCartUpdate(event) {
    return !(event.target instanceof Node) || !this.contains(event.target);
  }

  /** @param {CartDiscountUpdateEvent} event */
  #handleDiscountUpdate = (event) => {
    const external = this.#isExternalCartUpdate(event);
    event.promise
      ?.then(({ detail }) => {
        const sectionsHtml = detail?.sections?.[this.sectionId];
        if (sectionsHtml) {
          morphSection(this.sectionId, sectionsHtml, { mode: this.isDrawer ? 'hydration' : 'full' });
          this.#updateCartQuantitySelectorButtonStates();
        } else if (external) {
          // External caller (Shopify.actions.updateCart or SFAPI default handler) didn't
          // attach sections; refetch so the discount UI reflects the post-mutation cart.
          // Internal cart-discount-component morphs the section itself — no fallback needed.
          sectionRenderer.renderSection(this.sectionId, {
            cache: false,
            mode: this.isDrawer ? 'hydration' : 'full',
          });
        }
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') console.warn('[cart-items] Event promise rejected:', error);
      });
  };

  /** @param {CartNoteUpdateEvent} event */
  #handleNoteUpdate = (event) => {
    // Internal cart-note dispatches don't need a section refresh — the user typed the
    // value and the textarea retains it. Only external callers need the UI synced.
    if (!this.#isExternalCartUpdate(event)) return;
    event.promise
      ?.then(({ detail }) => {
        const sections = /** @type {Record<string, string> | undefined} */ (detail?.sections);
        const sectionsHtml = sections?.[this.sectionId];
        if (sectionsHtml) {
          morphSection(this.sectionId, sectionsHtml, { mode: this.isDrawer ? 'hydration' : 'full' });
        } else {
          sectionRenderer.renderSection(this.sectionId, {
            cache: false,
            mode: this.isDrawer ? 'hydration' : 'full',
          });
        }
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') console.warn('[cart-items] Event promise rejected:', error);
      });
  };

  connectedCallback() {
    super.connectedCallback();

    document.addEventListener(StandardEvents.cartLinesUpdate, this.#handleCartUpdate);
    document.addEventListener(ThemeEvents.quantitySelectorUpdate, this.#debouncedOnChange);
    document.addEventListener(StandardEvents.cartDiscountUpdate, this.#handleDiscountUpdate);
    document.addEventListener(StandardEvents.cartNoteUpdate, this.#handleNoteUpdate);
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    document.removeEventListener(StandardEvents.cartLinesUpdate, this.#handleCartUpdate);
    document.removeEventListener(ThemeEvents.quantitySelectorUpdate, this.#debouncedOnChange);
    document.removeEventListener(StandardEvents.cartDiscountUpdate, this.#handleDiscountUpdate);
    document.removeEventListener(StandardEvents.cartNoteUpdate, this.#handleNoteUpdate);
  }

  onLineItemRemove(line, event) {
    const target = event?.target;
    const row =
      (target instanceof Element ? target.closest('tr[data-key]') : null) ?? this.refs.cartItemRows[line - 1];
    if (row instanceof HTMLTableRowElement) this.#removeRow(row);
  }

  #bundleProps(row) {
    try {
      return JSON.parse(row.dataset.coKaching || 'null');
    } catch (error) {
      return null;
    }
  }

  #linkedGiftRows(row) {
    const props = this.#bundleProps(row);
    if (!props?.main || !props.id) return [];

    return this.refs.cartItemRows.filter((candidate) => {
      if (candidate === row) return false;
      const candidateProps = this.#bundleProps(candidate);
      return Boolean(candidateProps?.gift) && candidateProps?.id === props.id;
    });
  }

  #removeRow(row) {
    if (row.classList.contains('removing')) return;

    const rows = this.refs.cartItemRows;
    const rowsToRemove = [
      ...new Set([
        row,
        ...rows.filter((candidate) => candidate.dataset.parentKey === row.dataset.key),
        ...this.#linkedGiftRows(row),
      ]),
    ];

    this.updateQuantity({
      row,
      quantity: 0,
      action: 'clear',
      extraKeys: rowsToRemove.filter((candidate) => candidate !== row).map((candidate) => candidate.dataset.key ?? ''),
    });

    const remaining = rows.filter((candidate) => !candidate.classList.contains('removing') && !rowsToRemove.includes(candidate));

    const template = document.getElementById('empty-cart-template');
    if (remaining.length === 0 && template instanceof HTMLTemplateElement) {
      const clone = document.importNode(template.content, true);

      startViewTransition(() => {
        document.getElementById('cart-drawer-heading')?.remove();
        this.replaceChildren(clone);
      }, [this.isDrawer ? 'empty-cart-drawer' : 'empty-cart-page']);

      return;
    }

    rowsToRemove.forEach((candidate) => {
      candidate.classList.add('removing');
      const remove = () => candidate.remove();

      if (prefersReducedMotion()) return remove();

      candidate.style.setProperty('--row-height', `${candidate.clientHeight}px`);
      onAnimationEnd(candidate, remove);
    });
  }

  updateQuantity(config) {
    const row = config.row ?? this.refs.cartItemRows[(config.line ?? 0) - 1];
    const key = row?.dataset.key;
    if (!row || !key) return;

    const { action, extraKeys = [] } = config;
    const mode = this.isDrawer ? 'hydration' : 'full';
    const rerender = () => sectionRenderer.renderSection(this.sectionId, { cache: false, mode });

    this.refs.cartTotal?.shimmer();

    enqueueCartWrite(async () => {
      const quantity = config.settle ? await config.settle() : config.quantity;
      if (quantity === null || quantity === undefined) {
        resetShimmer(this);
        return;
      }

      const cartPerformaceUpdateMarker = cartPerformance.createStartingMarker(`${action}:user-action`);

      const sectionsToUpdate = new Set([this.sectionId]);
      document.querySelectorAll('cart-items-component').forEach((item) => {
        if (item instanceof HTMLElement && item.dataset.sectionId) sectionsToUpdate.add(item.dataset.sectionId);
      });

      const updates = { [key]: quantity };
      extraKeys.filter(Boolean).forEach((extraKey) => {
        updates[extraKey] = 0;
      });

      const deferredUpdatePromise = CartLinesUpdateEvent.createPromise();
      this.dispatchEvent(
        new CartLinesUpdateEvent({
          action: action === 'change' && quantity > 0 ? 'update' : 'remove',
          context: 'cart',
          lines: Object.entries(updates).map(([id, lineQuantity]) => ({ id, quantity: lineQuantity })),
          promise: deferredUpdatePromise.promise,
        })
      );

      try {
        const response = await fetch(
          `${Theme.routes.cart_update_url}.js`,
          fetchConfig('json', {
            body: JSON.stringify({
              updates,
              sections: Array.from(sectionsToUpdate).join(','),
              sections_url: window.location.pathname,
            }),
          })
        );
        const cart = await response.json();

        if (!response.ok || cart.status || cart.errors) {
          const message = cart.description || cart.message || cart.errors || 'Cart update failed';
          deferredUpdatePromise.reject(new Error(message));
          this.dispatchEvent(new CartErrorEvent({ error: message, code: 'INVALID' }));

          if (quantity === 0 || !row.isConnected) {
            renderWhenSettled(rerender);
          } else {
            this.#handleCartError(row, message);
          }
          return;
        }

        this.#updateQuantitySelectors(cart);

        deferredUpdatePromise.resolve({
          cart: CartLinesUpdateEvent.createCartFromAjaxResponse(cart),
          detail: {
            sections: cart.sections,
            items: cart.items,
            itemCount: cart.item_count,
            source: 'cart-items-component',
            didError: false,
          },
        });

        const sectionHtml = cart.sections?.[this.sectionId];
        renderWhenSettled(() => {
          if (sectionHtml) {
            morphSection(this.sectionId, sectionHtml, { mode });
            this.#updateCartQuantitySelectorButtonStates();
          } else {
            rerender();
          }
        });
      } catch (error) {
        console.error(error);
        deferredUpdatePromise.reject(error);
        this.dispatchEvent(
          new CartErrorEvent({
            error: error instanceof Error ? error.message : 'Failed to update cart',
            code: 'SERVICE_UNAVAILABLE',
          })
        );
        renderWhenSettled(rerender);
      } finally {
        resetShimmer(this);
        cartPerformance.measureFromMarker(cartPerformaceUpdateMarker);
      }
    });
  }

  #handleCartError(row, message) {
    const quantityInput = row.querySelector('input[data-cart-line]');
    if (quantityInput instanceof HTMLInputElement) {
      quantityInput.value = quantityInput.defaultValue;
      const selector = quantityInput.closest('cart-quantity-selector-component');
      selector?.updateButtonStates?.();
    }

    const errorContainer = row.querySelector('.cart-items__error');
    const errorText = row.querySelector('.cart-item__error-text');
    if (errorText) errorText.textContent = message;
    errorContainer?.classList.remove('hidden');
  }

  /**
   * Handles the cart update.
   *
   * @param {CartLinesUpdateEvent} event
   */
  #handleCartUpdate = (event) => {
    if (event.target === this) return;

    event.promise
      ?.then(({ detail }) => renderWhenSettled(() => this.#renderExternalUpdate(detail)))
      .catch((error) => {
        if (error?.name !== 'AbortError') console.warn('[cart-items] Event promise rejected:', error);
      });
  };

  async #renderExternalUpdate(detail) {
    const sections = detail?.sections;
    const cartItemsHtml = sections?.[this.sectionId];
    // Animate empty → non-empty in the drawer (possible in squeeze mode
    // where the page is interactive alongside the open drawer). This also
    // needs the response stylesheet because it adds the cart summary markup.
    const wasEmptyCartDrawer = this.isDrawer && this.querySelector('[data-cart-drawer-empty]') !== null;
    /** @type {'hydration' | 'full'} */
    const mode = this.isDrawer ? 'hydration' : 'full';
    const morphOptions = {
      mode,
      injectStylesheet: wasEmptyCartDrawer,
    };

    if (cartItemsHtml) {
      const existingKeys = new Set(this.refs.cartItemRows?.map((row) => row.dataset.key) ?? []);

      if (wasEmptyCartDrawer) {
        startViewTransition(() => {
          morphSection(this.sectionId, cartItemsHtml, morphOptions);
        }, ['fill-cart-drawer']);
      } else {
        await morphSection(this.sectionId, cartItemsHtml, morphOptions);
      }

      // Animate newly added rows (reverse of the remove animation).
      if (!wasEmptyCartDrawer && !prefersReducedMotion()) {
        for (const row of this.refs.cartItemRows ?? []) {
          if (!existingKeys.has(row.dataset.key)) {
            row.classList.add('adding');
            onAnimationEnd(row, () => row.classList.remove('adding'));
          }
        }
      }

      // Update button states for all cart quantity selectors after morph
      this.#updateCartQuantitySelectorButtonStates();
    } else {
      sectionRenderer.renderSection(this.sectionId, { cache: false, ...morphOptions });
    }
  }

  /**
   * Updates quantity selectors for all matching variants in the cart.
   * @param {Object} updatedCart - The updated cart object.
   * @param {Array<{variant_id: number, quantity: number}>} [updatedCart.items] - The cart items.
   */
  #updateQuantitySelectors(updatedCart) {
    if (!updatedCart.items) return;

    for (const item of updatedCart.items) {
      const variantId = item.variant_id.toString();
      const selectors = document.querySelectorAll(`quantity-selector-component[data-variant-id="${variantId}"]`);

      for (const selector of selectors) {
        const input = selector.querySelector('input[data-cart-quantity]');
        if (!input) continue;

        input.setAttribute('data-cart-quantity', item.quantity.toString());

        // Update the quantity selector's internal state
        if ('updateCartQuantity' in selector && typeof selector.updateCartQuantity === 'function') {
          selector.updateCartQuantity();
        }
      }
    }
  }

  /**
   * Updates button states for all cart quantity selector components.
   */
  #updateCartQuantitySelectorButtonStates() {
    for (const selector of document.querySelectorAll('cart-quantity-selector-component')) {
      /** @type {any} */ (selector).updateButtonStates?.();
    }
  }

  async fetchCartData() {
    if (this.#pendingCartFetch) return this.#pendingCartFetch;

    this.#pendingCartFetch = (async () => {
      const response = await fetch(`${Theme.routes.cart_url}.json`, {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      });
      if (!response.ok) throw new Error(`Failed to fetch cart: ${response.status} ${response.statusText}`);
      const data = await response.json();
      return data;
    })().finally(() => {
      this.#pendingCartFetch = null;
    });

    return this.#pendingCartFetch;
  }

  /**
   * Gets the section id.
   * @returns {string} The section id.
   */
  get sectionId() {
    const { sectionId } = this.dataset;

    if (!sectionId) throw new Error('Section id missing');

    return sectionId;
  }

  /**
   * @returns {boolean} Whether the component is a drawer.
   */
  get isDrawer() {
    return this.dataset.drawer !== undefined;
  }
}

if (!customElements.get('cart-items-component')) {
  customElements.define('cart-items-component', CartItemsComponent);
}
