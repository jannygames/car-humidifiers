import { enqueueCartWrite } from '@theme/cart-queue';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function initReveal(root = document) {
  const items = root.querySelectorAll('.co-reveal:not([data-co-revealed])');
  if (!items.length) return;

  if (reduceMotion || !('IntersectionObserver' in window)) {
    items.forEach((el) => {
      el.dataset.coRevealed = 'true';
      el.classList.add('is-visible');
    });
    return;
  }

  const createObserver = (threshold) => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold }
    );
    return observer;
  };

  const observer = createObserver(0.06);
  const tallObserver = createObserver(0);

  items.forEach((el) => {
    el.dataset.coRevealed = 'true';
    const tall = el.offsetHeight * 0.06 > window.innerHeight * 0.5;
    (tall ? tallObserver : observer).observe(el);
  });
}

function initGalleries(root = document) {
  root.querySelectorAll('[data-co-gallery]:not([data-co-ready])').forEach((gallery) => {
    gallery.dataset.coReady = 'true';

    const viewport = gallery.querySelector('[data-co-gallery-viewport]');
    const slides = [...gallery.querySelectorAll('[data-co-slide]')];
    const thumbs = [...gallery.querySelectorAll('[data-co-thumb]')];
    const counter = gallery.querySelector('[data-co-gallery-counter]');
    if (!viewport || slides.length === 0) return;

    // Centre the slide rather than aligning its left edge: full-width gallery slides are
    // unaffected (centre and flush-left coincide), while a peeking carousel needs it.
    const scrollTargetFor = (slide) =>
      slide.offsetLeft - viewport.offsetLeft - (viewport.clientWidth - slide.offsetWidth) / 2;

    const setActive = (index) => {
      thumbs.forEach((thumb, i) => {
        const active = i === index;
        thumb.setAttribute('aria-current', active ? 'true' : 'false');
        thumb.classList.toggle('is-active', active);
      });
      if (counter) counter.textContent = `${index + 1} / ${slides.length}`;
    };

    thumbs.forEach((thumb, index) => {
      thumb.addEventListener('click', () => {
        const slide = slides[index];
        if (!slide) return;
        viewport.scrollTo({ left: scrollTargetFor(slide), behavior: reduceMotion ? 'auto' : 'smooth' });
        setActive(index);
      });
    });

    gallery.querySelectorAll('[data-co-gallery-step]').forEach((button) => {
      button.addEventListener('click', () => {
        const step = Number(button.dataset.coGalleryStep) || 1;
        const current = slides.findIndex((slide) => slide.classList.contains('is-current'));
        const next = Math.min(slides.length - 1, Math.max(0, (current === -1 ? 0 : current) + step));
        viewport.scrollTo({
          left: scrollTargetFor(slides[next]),
          behavior: reduceMotion ? 'auto' : 'smooth',
        });
      });
    });

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const index = slides.indexOf(entry.target);
            slides.forEach((slide, i) => slide.classList.toggle('is-current', i === index));
            if (index > -1) setActive(index);
          });
        },
        { root: viewport, threshold: 0.55 }
      );
      slides.forEach((slide) => observer.observe(slide));
    }

    slides[0]?.classList.add('is-current');
    setActive(0);

    const lightbox = gallery.querySelector('[data-co-lightbox]');
    if (!lightbox) return;

    const openLightbox = initLightbox(lightbox, (mediaId) => {
      const slide = slides.find((item) => item.dataset.coMediaId === mediaId);
      if (slide) viewport.scrollTo({ left: scrollTargetFor(slide), behavior: 'auto' });
    });

    gallery.querySelectorAll('[data-co-zoom]').forEach((button) => {
      button.addEventListener('click', () => openLightbox(button.dataset.coZoom));
    });
  });
}

function initLightbox(dialog, onClose) {
  const track = dialog.querySelector('[data-co-lightbox-viewport]');
  const items = [...dialog.querySelectorAll('[data-co-lightbox-slide]')];
  const counter = dialog.querySelector('[data-co-lightbox-counter]');
  const prev = dialog.querySelector('[data-co-lightbox-step="-1"]');
  const next = dialog.querySelector('[data-co-lightbox-step="1"]');
  let index = 0;
  let synced = true;

  const finish = () => {
    if (synced) return;
    synced = true;
    onClose(items[index]?.dataset.coMediaId);
  };

  const render = () => {
    if (counter) counter.textContent = `${index + 1} / ${items.length}`;
    if (prev) prev.disabled = index === 0;
    if (next) next.disabled = index === items.length - 1;
    [index - 1, index, index + 1].forEach((i) => {
      const image = items[i]?.querySelector('img');
      if (image) image.loading = 'eager';
    });
  };

  const goTo = (target, smooth = true) => {
    index = Math.min(items.length - 1, Math.max(0, target));
    track.scrollTo({ left: index * track.clientWidth, behavior: smooth && !reduceMotion ? 'smooth' : 'auto' });
    render();
  };

  const close = () => {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
    finish();
  };

  track.addEventListener(
    'scroll',
    () => {
      const current = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
      if (current === index) return;
      index = Math.min(items.length - 1, Math.max(0, current));
      render();
    },
    { passive: true }
  );

  dialog.addEventListener('click', (event) => {
    if (event.target.closest('[data-co-lightbox-close]')) return close();
    const step = event.target.closest('[data-co-lightbox-step]');
    if (step) return goTo(index + Number(step.dataset.coLightboxStep));
    if (!event.target.closest('.co-lightbox__image, .co-lightbox__counter')) close();
  });

  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    goTo(index + (event.key === 'ArrowRight' ? 1 : -1));
  });

  let touchStart = null;
  track.addEventListener(
    'touchstart',
    (event) => {
      touchStart =
        event.touches.length === 1
          ? { x: event.touches[0].clientX, y: event.touches[0].clientY, atTop: (items[index]?.scrollTop || 0) <= 0 }
          : null;
    },
    { passive: true }
  );
  track.addEventListener(
    'touchend',
    (event) => {
      if (!touchStart || !touchStart.atTop || (window.visualViewport?.scale || 1) > 1.01) return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - touchStart.x;
      const dy = touch.clientY - touchStart.y;
      touchStart = null;
      if (dy > 90 && Math.abs(dx) < dy * 0.6) close();
    },
    { passive: true }
  );

  window.addEventListener('resize', () => {
    if (dialog.open) track.scrollLeft = index * track.clientWidth;
  });

  dialog.addEventListener('cancel', finish);
  dialog.addEventListener('close', finish);

  return (mediaId) => {
    const target = items.findIndex((item) => item.dataset.coMediaId === mediaId);
    synced = false;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    goTo(target === -1 ? 0 : target, false);
  };
}

function initCarousels(root = document) {
  root.querySelectorAll('[data-co-carousel]:not([data-co-ready])').forEach((carousel) => {
    carousel.dataset.coReady = 'true';

    const track = carousel.querySelector('[data-co-carousel-track]');
    const prev = carousel.querySelector('[data-co-carousel-prev]');
    const next = carousel.querySelector('[data-co-carousel-next]');
    if (!track) return;

    const step = () => {
      const first = track.firstElementChild;
      if (!first) return track.clientWidth;
      const gap = parseFloat(getComputedStyle(track).columnGap || '0');
      return first.getBoundingClientRect().width + gap;
    };

    const update = () => {
      const max = track.scrollWidth - track.clientWidth - 2;
      if (prev) prev.disabled = track.scrollLeft <= 2;
      if (next) next.disabled = track.scrollLeft >= max;
      const overflowing = track.scrollWidth > track.clientWidth + 4;
      carousel.querySelectorAll('[data-co-carousel-nav]').forEach((nav) => {
        nav.hidden = !overflowing;
      });
    };

    prev?.addEventListener('click', () =>
      track.scrollBy({ left: -step(), behavior: reduceMotion ? 'auto' : 'smooth' })
    );
    next?.addEventListener('click', () =>
      track.scrollBy({ left: step(), behavior: reduceMotion ? 'auto' : 'smooth' })
    );
    track.addEventListener('scroll', () => window.requestAnimationFrame(update), { passive: true });
    window.addEventListener('resize', update);
    update();
  });
}

function initQuantity(root = document) {
  root.querySelectorAll('[data-co-qty]:not([data-co-ready])').forEach((widget) => {
    widget.dataset.coReady = 'true';
    const input = widget.querySelector('input');
    if (!input) return;

    widget.querySelectorAll('[data-co-qty-step]').forEach((button) => {
      button.addEventListener('click', () => {
        const step = Number(button.dataset.coQtyStep) || 1;
        const min = Number(input.min) || 1;
        const max = Number(input.max) || Infinity;
        const value = Math.min(max, Math.max(min, (Number(input.value) || min) + step));
        input.value = String(value);
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  });
}

function initStickyVariant(bar) {
  const picker = bar.querySelector('[data-co-sticky-variant]');
  if (!picker) return;

  const submit = bar.querySelector('[data-co-sticky-submit]');
  const form = document.getElementById(submit?.dataset.coStickySubmit || '')?.closest('form');
  const idInput = form?.querySelector('input[name="id"]');
  const price = bar.querySelector('[data-co-sticky-price]');
  const compare = bar.querySelector('[data-co-sticky-compare]');
  const buttonPrice = bar.querySelector('[data-co-sticky-btn-price]');

  const paint = () => {
    const option = picker.selectedOptions[0];
    if (!option) return;
    if (price) price.textContent = option.dataset.coPrice || '';
    if (buttonPrice) buttonPrice.textContent = option.dataset.coPrice || '';
    if (compare) {
      compare.textContent = option.dataset.coCompare || '';
      compare.hidden = !option.dataset.coCompare;
    }
  };

  const selectedBarSelects = () => {
    const block = document.querySelector('kaching-bundles-block');
    if (!block) return [];
    return [...block.querySelectorAll('select.kaching-bundles__bar-variant-select')].filter((select) => {
      let node = select.parentElement;
      while (node && node !== block) {
        const radio = node.querySelector(':scope input[type="radio"]');
        if (radio) return radio.checked;
        node = node.parentElement;
      }
      return false;
    });
  };

  picker.addEventListener('change', () => {
    paint();
    let values = [];
    try {
      values = JSON.parse(picker.selectedOptions[0]?.dataset.coOptions || '[]');
    } catch (error) {}

    const selects = selectedBarSelects();
    if (selects.length) {
      selects.forEach((select) => {
        const match = values.find((value) => [...select.options].some((option) => option.value === value));
        if (!match || select.value === match) return;
        select.value = match;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
      return;
    }

    if (idInput) {
      idInput.value = picker.value;
      idInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  const fromPage = () => {
    const id = idInput?.value;
    if (!id || id === picker.value) return;
    const option = [...picker.options].find((candidate) => candidate.value === id);
    if (!option) return;
    picker.value = id;
    paint();
  };

  ['change', 'click'].forEach((type) => {
    document.addEventListener(type, (event) => {
      if (event.target.closest?.('kaching-bundles-block, variant-picker')) window.setTimeout(fromPage, 80);
    });
  });
  window.setTimeout(fromPage, 1500);
}

function initMainVariantSync(root = document) {
  root.querySelectorAll('[data-co-main-variant]:not([data-co-ready])').forEach((wrapper) => {
    wrapper.dataset.coReady = 'true';
    const scope = wrapper.closest('section') || document;

    const pickedValues = () => [
      ...[...wrapper.querySelectorAll('input[type="radio"]:checked')].map((input) => input.value),
      ...[...wrapper.querySelectorAll('select')].map((select) => select.value),
    ];

    const selectedBar = () => scope.querySelector('kaching-bundle .kaching-bundles__bar--selected');

    const push = () => {
      const bar = selectedBar();
      if (!bar) return;
      const values = pickedValues();
      bar.querySelectorAll('select.kaching-bundles__bar-variant-select').forEach((select) => {
        const match = values.find((value) => [...select.options].some((option) => option.value === value));
        if (!match || select.value === match) return;
        select.value = match;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
    };

    const pull = (select) => {
      const input = [...wrapper.querySelectorAll('input[type="radio"]')].find(
        (candidate) => candidate.value === select.value
      );
      if (input && !input.checked) input.click();
    };

    wrapper.addEventListener('change', () => window.setTimeout(push, 0));

    scope.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest('kaching-bundle')) return;
      if (target.matches('input[type="radio"]')) {
        window.setTimeout(push, 80);
      } else if (target.matches('select.kaching-bundles__bar-variant-select') && event.isTrusted) {
        pull(target);
      }
    });

    const waitForKaching = new MutationObserver(() => {
      if (!selectedBar()) return;
      waitForKaching.disconnect();
      push();
    });
    waitForKaching.observe(scope, { childList: true, subtree: true });
    window.setTimeout(() => waitForKaching.disconnect(), 15000);
    push();
  });
}

function initStickyBar(root = document) {
  root.querySelectorAll('[data-co-sticky-bar]:not([data-co-ready])').forEach((bar) => {
    bar.dataset.coReady = 'true';
    const anchorId = bar.dataset.coStickyAnchor;
    const anchor = anchorId ? document.getElementById(anchorId) : null;
    const footerTrigger = document.querySelector('[data-co-sticky-stop]');

    const show = (visible) => {
      bar.classList.toggle('translate-y-full', !visible);
      bar.classList.toggle('opacity-0', !visible);
      bar.setAttribute('aria-hidden', visible ? 'false' : 'true');
      document.documentElement.style.setProperty('--co-sticky-bar-height', `${bar.offsetHeight}px`);
      document.documentElement.toggleAttribute('data-co-sticky-bar-visible', visible);
    };

    if (!anchor || !('IntersectionObserver' in window)) {
      show(false);
      return;
    }

    let anchorPassed = false;
    let atFooter = false;
    const sync = () => show(anchorPassed && !atFooter);

    new IntersectionObserver(
      ([entry]) => {
        anchorPassed = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        sync();
      },
      { threshold: 0 }
    ).observe(anchor);

    if (footerTrigger) {
      new IntersectionObserver(
        ([entry]) => {
          atFooter = entry.isIntersecting;
          sync();
        },
        { threshold: 0 }
      ).observe(footerTrigger);
    }

    initStickyVariant(bar);

    bar.querySelectorAll('[data-co-sticky-submit]').forEach((button) => {
      button.addEventListener('click', (event) => {
        const target = document.getElementById(button.dataset.coStickySubmit || '');
        if (!target) return;
        event.preventDefault();
        target.click();
      });
    });

    show(false);
  });
}

function initTiltGuard() {
  document.querySelectorAll('[data-co-marquee]').forEach((marquee) => {
    const track = marquee.querySelector('[data-co-marquee-track]');
    if (!track || track.dataset.coReady) return;
    track.dataset.coReady = 'true';
  });
}


async function addBundleToCart(button) {
  const ids = (button.dataset.coBundleAdd || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  if (!ids.length) return;

  const original = button.textContent;
  button.disabled = true;
  button.dataset.coLoading = 'true';
  button.textContent = button.dataset.coLoadingLabel || 'Adding…';

  const routes = window.Theme?.routes || {};
  const addUrl = routes.cart_add_url || '/cart/add.js';
  const cartUrl = routes.cart_url || '/cart';

  try {
    const response = await fetch(addUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ items: ids.map((id) => ({ id: Number(id), quantity: 1 })) }),
    });

    if (!response.ok) throw new Error('Add to cart failed');

    let dispatched = false;
    try {
      const { CartLinesUpdateEvent } = await import('@shopify/events');
      button.dispatchEvent(
        new CartLinesUpdateEvent({
          action: 'add',
          context: 'product',
          lines: ids.map((id) => ({ merchandiseId: id, quantity: 1 })),
        })
      );
      dispatched = true;
    } catch (error) {
      dispatched = false;
    }

    button.textContent = button.dataset.coAddedLabel || 'Added to cart';

    if (!dispatched) {
      window.location.href = cartUrl;
      return;
    }

    window.setTimeout(() => {
      button.textContent = original;
      button.disabled = false;
      delete button.dataset.coLoading;
    }, 2200);
  } catch (error) {
    button.textContent = original;
    button.disabled = false;
    delete button.dataset.coLoading;
    window.location.href = cartUrl;
  }
}

async function initAddToCartRedirect() {
  if (document.documentElement.dataset.coCartRedirect === 'true') return;
  document.documentElement.dataset.coCartRedirect = 'true';

  let eventName = 'shopify:cart:lines-update';
  try {
    const { StandardEvents } = await import('@shopify/events');
    if (StandardEvents?.cartLinesUpdate) eventName = StandardEvents.cartLinesUpdate;
  } catch (error) {}

  const cartUrl = window.Theme?.routes?.cart_url || '/cart';

  document.addEventListener(eventName, (event) => {
    if (event.action !== 'add' || window.location.pathname === cartUrl) return;
    const settle = event.promise || Promise.resolve(null);
    settle
      .then((result) => {
        if (result?.detail?.didError) return;
        window.location.assign(cartUrl);
      })
      .catch(() => {});
  });
}

function initBundles(root = document) {
  root.querySelectorAll('[data-co-bundle-add]:not([data-co-ready])').forEach((button) => {
    button.dataset.coReady = 'true';
    button.addEventListener('click', () => addBundleToCart(button));
  });
}


// Pops the cart bubble whenever the cart changes. Rides Horizon's standard
// cart event so it fires for every add path (PDP, quick add, bundle, drawer).


const blockedDemoVideos = new Map();
let demoRetryArmed = false;

function armDemoVideoRetry() {
  if (demoRetryArmed) return;
  demoRetryArmed = true;
  const events = ['pointerup', 'touchend', 'click', 'keydown'];
  const retry = (event) => {
    if (event.target?.closest?.('[data-co-demo-toggle]')) return;
    events.forEach((type) => document.removeEventListener(type, retry, true));
    demoRetryArmed = false;
    const resumes = [...blockedDemoVideos.values()];
    blockedDemoVideos.clear();
    resumes.forEach((resume) => resume());
  };
  events.forEach((type) => document.addEventListener(type, retry, { capture: true, passive: true }));
}

// Demo clips behave like GIFs: autoplay, muted, looping. They pause when scrolled
// out of view (battery, and Safari throttles offscreen video anyway), and a manual
// pause always wins over the observer.
function initDemoVideos(root = document) {
  root.querySelectorAll('[data-co-demo-video]:not([data-co-ready])').forEach((video) => {
    video.dataset.coReady = 'true';

    const card = video.closest('.co-demo-media');
    const toggle = card?.querySelector('[data-co-demo-toggle]');
    const pauseIcon = toggle?.querySelector('[data-co-demo-icon-pause]');
    const playIcon = toggle?.querySelector('[data-co-demo-icon-play]');
    let pausedByUser = false;
    let inView = !('IntersectionObserver' in window);
    const slide = video.closest('[data-co-slide]');
    const desktop = window.matchMedia('(min-width: 64rem)');
    const isActive = () =>
      inView && (desktop.matches || !slide || slide.classList.contains('is-current'));

    const paint = (playing) => {
      if (!toggle) return;
      if (pauseIcon) pauseIcon.hidden = !playing;
      if (playIcon) playIcon.hidden = playing;
      toggle.setAttribute('aria-label', playing ? 'Pause clip' : 'Play clip');
    };

    const play = () => {
      const attempt = video.play();
      if (!attempt?.catch) return;
      attempt.catch(() => {
        paint(false);
        blockedDemoVideos.set(video, () => {
          if (isActive() && !pausedByUser) play();
        });
        armDemoVideoRetry();
      });
    };

    const pause = () => {
      video.pause();
    };

    const sync = () => {
      if (pausedByUser) return;
      if (isActive()) {
        if (video.paused) play();
      } else if (!video.paused) {
        pause();
      }
    };

    video.addEventListener('play', () => {
      blockedDemoVideos.delete(video);
      paint(true);
    });
    video.addEventListener('playing', () => paint(true));
    video.addEventListener('pause', () => paint(false));
    paint(!video.paused);

    toggle?.addEventListener('click', () => {
      pausedByUser = !video.paused;
      if (video.paused) play();
      else pause();
    });

    const prime = () => {
      if (video.dataset.coPoster) {
        video.poster = video.dataset.coPoster;
        delete video.dataset.coPoster;
      }
      if (video.preload === 'none') video.preload = 'metadata';
    };

    if ('IntersectionObserver' in window) {
      const nearby = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          prime();
          nearby.disconnect();
        },
        { rootMargin: '600px 0px' }
      );
      nearby.observe(video.closest('section') || video);

      new IntersectionObserver(
        ([entry]) => {
          inView = entry.isIntersecting;
          sync();
        },
        { threshold: 0.25 }
      ).observe(video);
    } else {
      prime();
      sync();
    }

    if (slide) {
      new MutationObserver(sync).observe(slide, { attributes: true, attributeFilter: ['class'] });
    }
    desktop.addEventListener?.('change', sync);
  });
}


// Grows an embedded app frame to its real content height. Shopify serves /apps/… proxies
// from the storefront domain, so the frame is same-origin and can be measured directly —
// no inner scrollbar, no guessed height. A cross-origin frame keeps its minimum height.
function initEmbeds(root = document) {
  root.querySelectorAll('[data-co-embed]:not([data-co-ready])').forEach((frame) => {
    frame.dataset.coReady = 'true';
    const min = Number(frame.dataset.coEmbedMin) || 600;

    const measure = () => {
      let doc;
      try {
        doc = frame.contentDocument;
      } catch (error) {
        return false; // cross-origin, nothing more we can do
      }
      if (!doc?.body) return false;
      const height = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight, min);
      // Resizing the frame can change the inner document's height, which would re-fire the
      // ResizeObserver. Only write when it actually moved, so the pair settles.
      if (Math.abs(height - frame.offsetHeight) > 1) frame.style.height = `${height}px`;
      return true;
    };

    // The app paints its button with an inline style attribute, so overriding it needs
    // !important. Injected as a stylesheet rather than set on the element, so it survives
    // the app re-rendering its own markup.
    const injectStyles = (doc) => {
      const bg = frame.dataset.coEmbedButtonBg;
      const text = frame.dataset.coEmbedButtonText;
      const extra = frame.dataset.coEmbedCss;
      const radius = frame.dataset.coEmbedRadius;
      const blend = frame.dataset.coEmbedBlend === 'true';
      if (!bg && !text && !extra && !radius && !blend) return;
      if (doc.getElementById('co-embed-styles')) return;

      const rules = [];
      if (bg || text) {
        rules.push(
          `.track123_form_button, [class*="form_button"], [class*="submit-button"] {` +
            (bg ? `background: ${bg} !important;` : '') +
            (text ? `color: ${text} !important;` : '') +
            `}`
        );
        if (text) {
          rules.push(`.track123_form_button *, [class*="form_button"] * { color: ${text} !important; }`);
        }
      }
      if (radius && Number(radius) > 0) {
        // overflow:hidden makes the children actually follow the corner, instead of
        // squaring it off at the edges.
        rules.push(
          `.track123_track_wrapper, [class*="track_wrapper"] {` +
            `border-radius: ${Number(radius)}px !important;` +
            `overflow: hidden !important;` +
          `}`
        );
      }
      if (frame.dataset.coEmbedBlend === 'true') {
        // Lets our section background show through, so the rounded corners read as ours
        // instead of framing a white rectangle.
        rules.push('html, body { background: transparent !important; }');
      }
      if (extra) rules.push(extra);

      const style = doc.createElement('style');
      style.id = 'co-embed-styles';
      style.textContent = rules.join('\n');
      doc.head?.appendChild(style);
    };

    const attach = () => {
      if (!measure()) return;

      let doc;
      try {
        doc = frame.contentDocument;
        // The app ships its own body margin, which would read as a stray gap in our layout.
        doc.body.style.margin = '0';
      } catch (error) {
        return;
      }

      injectStyles(doc);

      if ('ResizeObserver' in window) {
        new ResizeObserver(measure).observe(doc.body);
      } else {
        // Apps load their content asynchronously, so keep checking for a short while.
        let ticks = 0;
        const timer = window.setInterval(() => {
          measure();
          if (++ticks > 40) window.clearInterval(timer);
        }, 500);
      }
    };

    frame.addEventListener('load', attach);
    if (frame.contentDocument?.readyState === 'complete') attach();
  });
}


// Single-open accordions. Native <details> gives no close animation — the browser hides
// the content the instant `open` is removed — so closing is driven here: the panel
// collapses first, then `open` comes off. Opening the new one at the same moment makes
// the pair read as one pushing the other out.
function initAccordions(root = document) {
  root.querySelectorAll('[data-co-accordion]:not([data-co-ready])').forEach((group) => {
    group.dataset.coReady = 'true';
    const items = [...group.querySelectorAll('details.co-details')];
    if (items.length < 2) return;

    const collapse = (item) => {
      const panel = item.querySelector('.co-details__panel');
      if (!item.open) return;

      if (reduceMotion || !panel) {
        item.open = false;
        return;
      }

      item.classList.add('is-closing');

      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        item.open = false;
        item.classList.remove('is-closing');
        panel.removeEventListener('transitionend', onEnd);
      };
      const onEnd = (event) => {
        if (event.propertyName === 'grid-template-rows') finish();
      };

      panel.addEventListener('transitionend', onEnd);
      // Belt and braces: a dropped transitionend would otherwise strand it open.
      window.setTimeout(finish, 500);
    };

    items.forEach((item) => {
      const summary = item.querySelector('summary');
      if (!summary) return;

      summary.addEventListener('click', (event) => {
        event.preventDefault();

        if (item.open && !item.classList.contains('is-closing')) {
          collapse(item);
          return;
        }

        items.forEach((other) => {
          if (other !== item) collapse(other);
        });
        item.classList.remove('is-closing');
        item.open = true;
      });
    });
  });
}


// Self-advancing snap carousel, mobile only.
//
// Index-driven rather than scrollBy-driven: repeated relative scrolls accumulate
// rounding error and drift out of alignment, so each step scrolls to a card's exact
// centred position instead. The cards are rendered twice, and once a step lands in the
// duplicate half the track is silently repositioned to the identical card in the first
// half — the frame on screen is the same, so the loop is invisible.
function initAutoScroll(root = document) {
  root.querySelectorAll('[data-co-autoscroll]:not([data-co-ready])').forEach((track) => {
    track.dataset.coReady = 'true';

    const seconds = parseFloat(track.dataset.coAutoscrollInterval) || 2.5;
    const mobile = window.matchMedia('(max-width: 639px)');
    const cards = () => [...track.children];
    const realCount = () => Math.max(1, Math.round(cards().length / 2));

    let index = 0;
    let timer = null;
    let resumeTimer = null;
    let rewindTimer = null;

    // Position that puts a card's centre on the track's centre.
    const centreOf = (card) => card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2;

    const goTo = (i, smooth) => {
      const card = cards()[i];
      if (!card) return;
      track.scrollTo({
        left: Math.max(0, centreOf(card)),
        behavior: smooth && !reduceMotion ? 'smooth' : 'auto',
      });
    };

    const advance = () => {
      const half = realCount();
      index += 1;
      goTo(index, true);

      if (index >= half) {
        // Let the smooth scroll finish, then hop back to the twin card in the first half.
        window.clearTimeout(rewindTimer);
        rewindTimer = window.setTimeout(() => {
          index -= half;
          goTo(index, false);
        }, 600);
      }
    };

    const start = () => {
      stop();
      if (reduceMotion || !mobile.matches) return;
      timer = window.setInterval(advance, seconds * 1000);
    };

    const stop = () => {
      window.clearInterval(timer);
      timer = null;
    };

    // A reader who takes hold of it keeps hold of it, and we resync to wherever
    // they left off rather than jumping back to our own idea of the position.
    const hold = () => {
      stop();
      window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(() => {
        index = nearestIndex();
        start();
      }, 6000);
    };

    const nearestIndex = () => {
      const list = cards();
      let best = 0;
      let bestDistance = Infinity;
      list.forEach((card, i) => {
        const distance = Math.abs(centreOf(card) - track.scrollLeft);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = i;
        }
      });
      return best;
    };

    track.addEventListener('pointerdown', hold, { passive: true });
    track.addEventListener('touchstart', hold, { passive: true });
    track.addEventListener('wheel', hold, { passive: true });
    track.addEventListener('mouseenter', stop);
    track.addEventListener('mouseleave', start);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    mobile.addEventListener('change', () => {
      index = 0;
      goTo(0, false);
      start();
    });

    goTo(0, false);
    start();
  });
}

// Multiplying the displayed price by the quantity keeps the buy box honest about the
// price: the figure beside the quantity stepper reflects what will actually be
// added, not the unit price. Uses Horizon's own money formatter so the output matches
// the `money` filter exactly rather than being reimplemented here.
let moneyFormatter = null;
let moneyFormatterLoaded = false;

async function getMoneyFormatter() {
  if (moneyFormatterLoaded) return moneyFormatter;
  moneyFormatterLoaded = true;
  try {
    const mod = await import('@theme/money-formatting');
    moneyFormatter = mod.formatMoney ?? null;
  } catch (error) {
    moneyFormatter = null; // prices stay as the server rendered them
  }
  return moneyFormatter;
}

async function initSoldOutNotes(root = document) {
  const notes = [...root.querySelectorAll('[data-co-soldout-note]:not([data-co-ready])')].filter(
    (note) => !note.closest('[data-co-variant-dialog]')
  );
  if (!notes.length) return;
  notes.forEach((note) => (note.dataset.coReady = 'true'));

  let eventName = 'shopify:product:select';
  try {
    const { StandardEvents } = await import('@shopify/events');
    if (StandardEvents?.productSelect) eventName = StandardEvents.productSelect;
  } catch (error) {}

  notes.forEach((note) => {
    note.closest('.shopify-section')?.addEventListener(eventName, (event) => {
      if (!(event.target instanceof Element) || event.target.closest('product-card')) return;
      event.promise
        ?.then(({ detail }) => {
          if (!detail?.html) return;
          const available = detail.resource?.available !== false;
          const fresh = detail.html.querySelector('[data-co-soldout-note]');
          if (fresh) {
            note.innerHTML = fresh.innerHTML;
            note.dataset.coSoldoutKey = fresh.dataset.coSoldoutKey || '';
            note.hidden = fresh.hidden;
          } else {
            note.hidden = true;
          }
          document.querySelectorAll('[data-co-sticky-label]').forEach((label) => {
            label.textContent = available ? label.dataset.coAdd : label.dataset.coSoldOut;
            const submit = label.closest('button');
            if (submit) submit.disabled = !available;
          });
        })
        .catch(() => {});
    });
  });
}

function initLivePrice(root = document) {
  root.querySelectorAll('[data-co-price-group]:not([data-co-ready])').forEach(async (group) => {
    group.dataset.coReady = 'true';

    const input = group.querySelector('[data-co-qty] input');
    if (!input) return;

    const format = await getMoneyFormatter();
    if (!format) return;

    // Matches money_without_trailing_zeros: drop the decimals only when they are zeros.
    const money = (cents, template, currency) =>
      format(cents, template, currency).replace(/([.,])00(?!\d)/, '');

    let updating = false;
    const update = () => {
      if (updating) return;
      const price = group.querySelector('[data-co-price]');
      if (!price) return;
      updating = true;

      const qty = Math.max(1, Math.floor(Number(input.value) || 1));
      const unit = Number(price.dataset.coUnitPrice) || 0;
      const compare = Number(price.dataset.coUnitCompare) || 0;
      const template = price.dataset.coMoneyFormat || '{{amount}}';
      const currency = price.dataset.coCurrency || 'EUR';

      if (unit) {
        const value = price.querySelector('[data-co-price-value]');
        if (value) value.textContent = money(unit * qty, template, currency);

        const was = price.querySelector('[data-co-price-compare]');
        if (was && compare > unit) was.textContent = money(compare * qty, template, currency);

        const save = price.querySelector('[data-co-price-save]');
        if (save && compare > unit) {
          const pattern = save.dataset.coSaveTemplate || 'Save [amount]';
          const amount =
            'coSavePercent' in save.dataset
              ? `${Math.round(((compare - unit) / compare) * 100)}%`
              : money((compare - unit) * qty, template, currency);
          save.textContent = pattern.replace('[amount]', amount);
        }
      }

      updating = false;
    };

    input.addEventListener('change', update);
    input.addEventListener('input', update);

    // The variant picker swaps [ref=priceContainer] for freshly rendered markup, which
    // comes back at quantity 1 — reapply the multiplier whenever that happens.
    //
    // childList only, no subtree: the swap replaces a direct child of <product-price>,
    // while update() writes textContent on grandchildren. Watching the subtree would see
    // its own writes and re-enter forever.
    const host = group.querySelector('product-price');
    if (host) {
      new MutationObserver(() => {
        if (updating) return;
        update();
      }).observe(host, { childList: true });
    }

    update();
  });
}

async function initCartPop() {
  if (document.documentElement.dataset.coCartPop === 'true') return;
  document.documentElement.dataset.coCartPop = 'true';

  let eventName = 'cart:update';
  try {
    const { StandardEvents } = await import('@shopify/events');
    if (StandardEvents?.cartLinesUpdate) eventName = StandardEvents.cartLinesUpdate;
  } catch (error) {
    // Fall back to the default name; a missing bundle just means no pop.
  }

  document.addEventListener(eventName, () => {
    document.querySelectorAll('.header-actions__cart-icon').forEach((icon) => {
      delete icon.dataset.coCartPop;
      // Force a reflow so the animation restarts on repeat adds.
      void icon.offsetWidth;
      icon.dataset.coCartPop = 'true';
    });
  });
}

// <details> has no notion of "click away to dismiss", so add the two behaviours a
// dropdown is expected to have. Everything else about the control is native.
function initLangSwitcher(root = document) {
  root.querySelectorAll('[data-co-lang]:not([data-co-ready])').forEach((wrap) => {
    wrap.dataset.coReady = 'true';
    const details = wrap.querySelector('[data-co-lang-details]');
    if (!details) return;

    const close = () => {
      details.open = false;
    };

    document.addEventListener('click', (event) => {
      if (details.open && !wrap.contains(event.target)) close();
    });

    details.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !details.open) return;
      close();
      details.querySelector('summary')?.focus();
    });
  });
}

function initReviewWidget() {
  const widget = document.querySelector('.jm-review-widget, [data-widget="review"]');
  if (!widget) return;

  const section = widget.closest('[data-co-carousel]');

  const stamp = () => {
    widget.querySelectorAll('.jm-reviewer-info__name:not([data-initial])').forEach((name) => {
      const label = (name.getAttribute('title') || name.textContent || '').trim();
      if (!label) return;
      name.setAttribute('data-initial', label.charAt(0).toUpperCase());
    });
  };

  const bindNav = () => {
    if (!section) return;
    const nav = section.querySelector('[data-co-carousel-nav]');
    const prev = widget.querySelector('.jdgm-carousel-review-list__nav--prev');
    const next = widget.querySelector('.jdgm-carousel-review-list__nav--next');
    if (!nav || !prev || !next || nav.dataset.coJmBound) return;

    nav.dataset.coJmBound = 'true';
    nav.hidden = false;
    section.querySelector('[data-co-carousel-prev]')?.addEventListener('click', () => prev.click());
    section.querySelector('[data-co-carousel-next]')?.addEventListener('click', () => next.click());
  };

  const starPath =
    'M10 1.6l2.47 5.35 5.53.66-4.09 3.9 1.09 5.6L10 14.3l-5 2.81 1.09-5.6L2 7.61l5.53-.66L10 1.6z';

  const starRow = (filled) => {
    const svg =
      '<svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="' +
      starPath +
      '" fill="' +
      (filled ? 'currentColor' : 'none') +
      '" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/></svg>';
    return (
      '<span class="co-stars__row' + (filled ? ' co-stars__row--fill' : '') + '">' +
      svg.repeat(5) +
      '</span>'
    );
  };

  const injectAverageStars = () => {
    const cluster = widget.querySelector('.jm-average-rating-display .jm-cluster');
    if (!cluster || cluster.querySelector('.co-stars')) return;

    const value = parseFloat((cluster.querySelector('.jm-text')?.textContent || '').replace(',', '.'));
    if (!Number.isFinite(value)) return;

    const stars = document.createElement('span');
    stars.className = 'co-stars';
    stars.setAttribute('aria-hidden', 'true');
    stars.style.setProperty('--co-stars-fill', Math.max(0, Math.min(100, value * 20)) + '%');
    stars.innerHTML = starRow(false) + starRow(true);
    cluster.prepend(stars);
  };

  const sync = () => {
    stamp();
    bindNav();
    injectAverageStars();
  };

  sync();
  new MutationObserver(sync).observe(widget, { childList: true, subtree: true });
}

function initHeroFill() {
  const hero = document.querySelector('.co-hero-banner');
  if (!hero) return;

  const ticker = document.querySelector('[data-co-marquee]')?.closest('section');
  const mobile = window.matchMedia('(max-width: 749px)');

  const apply = () => {
    if (!mobile.matches) {
      hero.style.removeProperty('--co-hero-fill');
      return;
    }

    const chrome = [...document.querySelectorAll('.shopify-section-group-header-group')].reduce(
      (total, el) => total + el.getBoundingClientRect().height,
      0
    );
    const tickerHeight = ticker ? ticker.getBoundingClientRect().height : 0;
    const fill = Math.max(360, window.innerHeight - chrome - tickerHeight);

    hero.style.setProperty('--co-hero-fill', Math.round(fill) + 'px');
  };

  apply();
  window.addEventListener('resize', apply, { passive: true });
  mobile.addEventListener('change', apply);
}

function initVariantDialogs(root = document) {
  root.querySelectorAll('[data-co-variant-open]:not([data-co-ready])').forEach((trigger) => {
    trigger.dataset.coReady = 'true';

    const dialog = document.getElementById(trigger.getAttribute('aria-controls'));
    if (!dialog) return;

    trigger.addEventListener('click', () => {
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    });
  });

  root.querySelectorAll('[data-co-variant-dialog]:not([data-co-ready])').forEach((dialog) => {
    dialog.dataset.coReady = 'true';

    const input = dialog.querySelector('[data-co-variant-input]');
    const choices = [...dialog.querySelectorAll('[data-co-variant-choice]')];
    const button = dialog.querySelector('button[type="submit"]');
    const notes = [...dialog.querySelectorAll('[data-co-soldout-note]')];

    const sync = () => {
      const checked = choices.find((choice) => choice.checked);
      const soldOut = checked?.dataset.coSoldOut !== undefined;
      if (input && checked) input.value = checked.value;
      if (button) button.disabled = !checked || soldOut;
      notes.forEach((note) => (note.hidden = !soldOut || note.dataset.coSoldoutKey !== checked.dataset.coSoldOut));
      dialog.querySelectorAll('[data-co-atc-add]').forEach((label) => (label.hidden = soldOut));
      dialog.querySelectorAll('[data-co-atc-sold-out]').forEach((label) => (label.hidden = !soldOut));
    };

    choices.forEach((choice) => choice.addEventListener('change', sync));
    sync();

    dialog.querySelectorAll('[data-co-variant-close]').forEach((close) => {
      close.addEventListener('click', () => dialog.close());
    });

    // The panel fills the dialog, so anything landing on the dialog itself is the backdrop.
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });

    dialog.querySelector('form')?.addEventListener('submit', () => {
      // Let the cart drawer take over the screen once the item is on its way.
      setTimeout(() => dialog.close(), 150);
    });
  });
}

// MakeCommerce requires a purchase-terms tick in the cart before payment. The checkbox
// lives in cart-summary.liquid, which both the drawer and the cart page render, so this
// gates whichever copy is on screen. Consent is remembered for the session only, since
// the cart re-renders its markup on every quantity change.
let cartConsentGiven = false;
let cartConsentFrame = 0;

function applyCartConsent() {
  document.querySelectorAll('[data-co-cart-consent]').forEach((consent) => {
    const input = consent.querySelector('[data-co-cart-consent-input]');
    if (!input) return;

    // Both copies of the consent track one value, in both directions — propagating only
    // the tick would leave the other still checked after someone changed their mind.
    if (input.checked !== cartConsentGiven) input.checked = cartConsentGiven;

    // Once agreed there is nothing left to read, so the sticky bar reclaims the space.
    consent.classList.toggle('is-collapsed', cartConsentGiven);

    const ctas = consent.parentElement?.querySelector('.cart__ctas');
    ctas?.classList.toggle('co-cart-consent__pending', !input.checked);

    const button = ctas?.querySelector('#checkout, [name="checkout"]');
    if (button) {
      // An empty cart ships the button already disabled; never undo that.
      if (button.dataset.coGateBase === undefined) {
        button.dataset.coGateBase = button.disabled ? 'true' : 'false';
      }
      button.disabled = button.dataset.coGateBase === 'true' || !input.checked;
    }

    if (input.checked) {
      const error = consent.querySelector('.co-cart-consent__error');
      if (error) error.hidden = true;
    }
  });
}

function scheduleCartConsent() {
  // Same reasoning as scheduleFreeShippingLabels: a dropped rAF must not wedge the guard.
  clearTimeout(cartConsentFrame);
  cartConsentFrame = setTimeout(applyCartConsent, 50);
}

// Bring an unmet requirement into view rather than leaving the shopper to hunt for why
// checkout did nothing. Honours reduced-motion, and offsets for the sticky header.
function scrollToCartIssue(element) {
  if (!element) return;
  const header = document.querySelector('#header-group');
  const offset = (header?.getBoundingClientRect().height || 0) + 24;
  const top = element.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' });
}

function flagMissingConsent() {
  // Prefer whichever copy the shopper can actually see — scrolling to a hidden one would
  // look like the button simply did nothing.
  const all = [...document.querySelectorAll('[data-co-cart-consent]')];
  const consent = all.find((el) => el.getClientRects().length > 0) || all[0];
  if (!consent) return false;
  const input = consent.querySelector('[data-co-cart-consent-input]');
  if (!input || input.checked) return false;

  const error = consent.querySelector('.co-cart-consent__error');
  if (error) error.hidden = false;
  scrollToCartIssue(consent);
  // Focus after the scroll settles, so the browser does not fight it with its own jump.
  setTimeout(() => input.focus({ preventScroll: true }), reduceMotion ? 0 : 420);
  return true;
}

// The shipping module validates on its own and writes an error into the widget. Watch for
// one appearing just after a checkout attempt and bring it into view.
function watchForShippingError() {
  const wrapper = document.querySelector('#mc-shipping-wrapper');
  if (!wrapper) return;

  const deadline = Date.now() + 2500;
  const check = () => {
    const error = wrapper.querySelector('.mc-error-message');
    const shown = error && error.textContent.trim() !== '' && error.offsetHeight > 0;
    if (shown) {
      observer.disconnect();
      scrollToCartIssue(wrapper);
      return;
    }
    if (Date.now() > deadline) observer.disconnect();
  };

  const observer = new MutationObserver(check);
  observer.observe(wrapper, { childList: true, subtree: true, characterData: true });
  setTimeout(() => observer.disconnect(), 2600);
  check();
}

function initCartConsent() {
  if (document.documentElement.dataset.coCartConsentReady === 'true') return;
  document.documentElement.dataset.coCartConsentReady = 'true';

  document.addEventListener('change', (event) => {
    const input = event.target.closest?.('[data-co-cart-consent-input]');
    if (!input) return;
    cartConsentGiven = input.checked;
    applyCartConsent();
  });

  // The terms link sits inside the label, so a click on it would also tick the box.
  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('.co-cart-consent__text a');
    if (link) event.stopPropagation();
  });

  // A disabled button fires no click, so catch the attempt on the wrapper instead.
  document.addEventListener(
    'click',
    (event) => {
      const pending = event.target.closest?.('.co-cart-consent__pending');
      if (!pending) return;
      flagMissingConsent();
    },
    true
  );

  // The real checkout button gets the same treatment as the sticky one: if the shipping
  // module rejects the attempt, take the shopper to what it is complaining about.
  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('#checkout, .cart__checkout-button');
    if (!button || button.disabled) return;
    watchForShippingError();
  });

  document.addEventListener('cart:update', scheduleCartConsent);
  // The drawer swaps its whole subtree on every cart change, which fires no section event.
  new MutationObserver(scheduleCartConsent).observe(document.body, { childList: true, subtree: true });

  applyCartConsent();
}

// The MakeCommerce widget renders carrier prices from its own config and has no notion
// of a free-shipping label — a zero just prints as "€0,00". Swap any genuinely zero price
// for the translated word. This reads the rendered price rather than guessing at discounts,
// so it can only ever say "free" when the shopper is actually being charged nothing.
let freeShippingFrame = 0;

function applyFreeShippingLabels() {
  const holder = document.querySelector('[data-co-free-shipping-label]');
  const label = holder?.dataset.coFreeShippingLabel;
  if (!label) return;

  document.querySelectorAll('#mc-shipping-wrapper .mc-carrier-price').forEach((price) => {
    const raw = (price.textContent || '').trim();
    if (!raw) return;

    if (price.dataset.coFreeApplied === 'true') {
      // Already swapped; only revert if the module re-rendered a real amount.
      if (raw !== label) delete price.dataset.coFreeApplied;
      else return;
    }

    // Strip currency symbols and separators, then check the number is zero.
    const digits = raw.replace(/[^0-9.,-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
    const amount = Number.parseFloat(digits);
    if (!Number.isFinite(amount) || amount > 0) return;

    price.textContent = label;
    price.dataset.coFreeApplied = 'true';
    price.closest('.mc-carrier-btn')?.setAttribute('data-co-free', 'true');
  });
}

function scheduleFreeShippingLabels() {
  // Debounced with a timer rather than requestAnimationFrame: rAF does not fire in a
  // backgrounded tab, so a pending id would never clear and the guard below would wedge
  // the observer shut for the rest of the session.
  clearTimeout(freeShippingFrame);
  freeShippingFrame = setTimeout(applyFreeShippingLabels, 50);
}

function initFreeShippingLabels() {
  if (document.documentElement.dataset.coFreeShipping === 'true') return;
  if (!document.querySelector('[data-co-free-shipping-label]')) return;
  document.documentElement.dataset.coFreeShipping = 'true';

  // The widget builds itself asynchronously and rebuilds on every cart or carrier change.
  new MutationObserver(scheduleFreeShippingLabels).observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  document.addEventListener('cart:update', scheduleFreeShippingLabels);
  applyFreeShippingLabels();
}

// Mobile cart: a pinned checkout that steps aside once the real one is on screen.
function initCartStickyBar() {
  // The guard flag must not share a name with the component's own attribute — dataset
  // writes it onto <html>, which then matches the selector and wins on document order.
  if (document.documentElement.dataset.coCartStickyReady === 'true') return;
  const bar = document.querySelector('[data-co-cart-sticky]');
  const ctas = document.querySelector('.cart__ctas');
  if (!bar || !ctas) return;
  document.documentElement.dataset.coCartStickyReady = 'true';

  const mobile = window.matchMedia('(max-width: 749px)');

  const setVisible = (visible) => {
    bar.hidden = !visible;
    bar.classList.toggle('is-visible', visible);
  };

  let ctasOnScreen = false;
  const sync = () => setVisible(mobile.matches && !ctasOnScreen);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      ([entry]) => {
        ctasOnScreen = entry.isIntersecting;
        sync();
      },
      // A sliver is enough: once the real button is reachable the bar is redundant.
      { threshold: 0, rootMargin: '0px 0px -80px 0px' }
    ).observe(ctas);
  }

  mobile.addEventListener('change', sync);

  bar.querySelector('[data-co-cart-sticky-submit]')?.addEventListener('click', () => {
    if (flagMissingConsent()) return;
    const checkout = ctas.querySelector('#checkout, [name="checkout"]');
    if (!checkout) return;
    watchForShippingError();
    checkout.click();
  });

  sync();
}

function keepShippingWidget() {
  const widget = document.querySelector('#mc-shipping-wrapper');
  const parent = widget?.parentElement;
  if (!widget || !parent?.classList.length) return;

  const parentSelector = `.${CSS.escape(parent.classList[0])}`;
  const next = widget.nextElementSibling;
  const nextSelector = next?.classList.length ? `:scope > .${CSS.escape(next.classList[0])}` : null;
  widget.remove();

  const restore = () => {
    if (widget.isConnected || document.querySelector('#mc-shipping-wrapper')) return;
    const host = document.querySelector(parentSelector);
    if (!host) return;
    host.insertBefore(widget, nextSelector ? host.querySelector(nextSelector) : host.firstChild);
  };

  [0, 60, 400].forEach((delay) => window.setTimeout(restore, delay));
}

let pageReloadAllowed = false;
let makeCommerceGuardUntil = 0;
let makeCommerceRefreshTimer = 0;

function reloadPage() {
  pageReloadAllowed = true;
  window.location.reload();
}

function makeCommerceReady() {
  return typeof MakeCommerceSnippet !== 'undefined' && typeof MakeCommerceSnippet.getRateConfiguration === 'function';
}

async function refreshMakeCommerce() {
  if (!makeCommerceReady() || !document.querySelector('cart-items-component')) return;
  const root = window.Shopify?.routes?.root || '/';

  try {
    const cart = await cartFetch(`${root}cart.js`, { credentials: 'same-origin' }).then((response) => response.json());
    if (!cart.item_count) return;

    const current =
      document.querySelector('#mc-shipping-wrapper') &&
      cart.total_weight === cartTotalWeight &&
      cart.total_price === Math.round(totalPrice * 100);
    if (current) return;

    cartDetails = cart;
    cartTotalWeight = cart.total_weight;
    totalPrice = cart.total_price / 100;
    ratesPromise = null;
    MakeCommerceSnippet.getRateConfiguration();
  } catch (error) {
    reloadPage();
  }
}

function scheduleMakeCommerceRefresh() {
  clearTimeout(makeCommerceRefreshTimer);
  makeCommerceRefreshTimer = setTimeout(refreshMakeCommerce, 120);
}

async function initMakeCommerceBridge() {
  if (document.documentElement.dataset.coMcBridge === 'true') return;
  if (!('navigation' in window)) return;
  document.documentElement.dataset.coMcBridge = 'true';

  window.navigation.addEventListener('navigate', (event) => {
    if (event.navigationType !== 'reload' || event.userInitiated || !event.cancelable) return;
    if (pageReloadAllowed || performance.now() > makeCommerceGuardUntil || !makeCommerceReady()) return;
    event.preventDefault();
    scheduleMakeCommerceRefresh();
  });

  let names = ['shopify:cart:lines-update', 'shopify:cart:discount-update'];
  try {
    const { StandardEvents } = await import('@shopify/events');
    names = [StandardEvents.cartLinesUpdate, StandardEvents.cartDiscountUpdate].filter(Boolean);
  } catch (error) {}

  names.forEach((name) => {
    document.addEventListener(name, (event) => {
      makeCommerceGuardUntil = performance.now() + 15000;
      const settle = event.promise ? event.promise.catch(() => null) : Promise.resolve();
      settle.then(scheduleMakeCommerceRefresh);
    });
  });
}

let cartVariantSwapReady = false;

async function swapCartVariant(select) {
  const key = select.dataset.coLineKey;
  const variantId = Number(select.value);
  const previous = [...select.options].find((option) => option.defaultSelected)?.value;
  if (!key || !variantId || String(variantId) === previous) return;

  const routes = window.Theme?.routes || {};
  const addUrl = routes.cart_add_url || '/cart/add.js';
  const changeUrl = routes.cart_change_url || '/cart/change';
  const sections = [...document.querySelectorAll('cart-items-component')]
    .map((el) => el.dataset.sectionId)
    .filter(Boolean);

  const root = window.Shopify?.routes?.root || '/';
  const current = await cartFetch(`${root}cart.js`, { credentials: 'same-origin' })
    .then((response) => response.json())
    .then((cart) => (cart.items || []).find((line) => line.key === key))
    .catch(() => null);

  const properties =
    current?.properties && !Array.isArray(current.properties) && typeof current.properties === 'object'
      ? current.properties
      : {};

  const item = {
    id: variantId,
    quantity: Math.max(1, Number(current?.quantity || select.dataset.coQuantity) || 1),
    properties,
  };
  const sellingPlan = current?.selling_plan_allocation?.selling_plan?.id || select.dataset.coSellingPlan;
  if (sellingPlan) item.selling_plan = Number(sellingPlan);

  const post = (url, body) =>
    cartFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    }).then(async (response) => {
      const json = await response.json().catch(() => ({}));
      if (!response.ok || json.status) throw new Error(json.description || json.message || 'Cart update failed');
      return json;
    });

  const row = select.closest('[data-key]');
  const wrapper = select.closest('.co-cart-variant');
  wrapper?.parentElement?.querySelector('.co-cart-variant__error')?.remove();
  select.disabled = true;
  row?.classList.add('co-cart-row--swapping');
  let added = false;

  try {
    await post(addUrl, { items: [item] });
    added = true;
    const cart = await post(changeUrl, {
      id: key,
      quantity: 0,
      sections: sections.join(','),
      sections_url: window.location.pathname,
    });

    try {
      const { CartLinesUpdateEvent } = await import('@shopify/events');
      keepShippingWidget();
      select.dispatchEvent(
        new CartLinesUpdateEvent({
          action: 'update',
          context: 'cart',
          lines: [{ id: key, quantity: 0 }],
          promise: Promise.resolve({
            cart: CartLinesUpdateEvent.createCartFromAjaxResponse(cart),
            detail: { sections: cart.sections, items: cart.items, source: 'drivemist-variant-swap', didError: false },
          }),
        })
      );
    } catch (error) {
      reloadPage();
    }
  } catch (error) {
    if (added) {
      reloadPage();
      return;
    }
    if (previous) select.value = previous;
    select.disabled = false;
    row?.classList.remove('co-cart-row--swapping');
    if (wrapper) {
      const message = document.createElement('p');
      message.className = 'co-cart-variant__error';
      message.setAttribute('role', 'alert');
      message.textContent = error.message;
      wrapper.after(message);
    }
  }
}

function initCartVariantSwap() {
  if (cartVariantSwapReady) return;
  cartVariantSwapReady = true;
  document.addEventListener('change', (event) => {
    const select = event.target;
    if (select instanceof HTMLSelectElement && select.matches('[data-co-variant-swap]')) {
      enqueueCartWrite(() => swapCartVariant(select));
    }
  });
}

const KACHING_PROP = '__kaching_bundles';
const GIFT_SYNC_SOURCE = 'drivemist-gift-sync';
const GIFT_DEAL_TTL = 30 * 60 * 1000;
const giftDealCache = new Map();
const giftSyncFailed = new Set();
let giftSyncRunning = false;
let giftSyncQueued = null;
let giftOrphanCheck = 0;

function cartFetch(...args) {
  return (window.__kachingBundlesRawFetch || window.fetch).apply(window, args);
}

function kachingProps(item) {
  const raw = item.properties?.[KACHING_PROP];
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function kachingGroupId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  let id = '';
  for (let i = 0; i < 4; i += 1) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function readKachingDeals(doc) {
  const variants = {};
  const handles = {};
  doc.querySelectorAll('script.kaching-bundles-product').forEach((script) => {
    try {
      const product = JSON.parse(script.textContent);
      handles[product.id] = product.handle;
      variants[product.id] = (product.variants || []).map((variant) => ({
        id: variant.id,
        available: variant.availableForSale !== false,
      }));
    } catch (error) {}
  });

  const deals = {};
  doc.querySelectorAll('script.kaching-bundles-deal-block-settings').forEach((script) => {
    const productId = Number(script.dataset.productId);
    if (!productId || deals[productId]) return;
    let block;
    try {
      block = JSON.parse(script.textContent);
    } catch (error) {
      return;
    }
    if (!block.nanoId || !block.versionId) return;

    const bars = (block.dealBars || [])
      .filter((bar) => bar.dealBarType === 'quantity-break')
      .map((bar) => ({
        id: bar.id,
        quantity: Number(bar.quantity) || 1,
        gifts: (bar.freeGifts || [])
          .filter((gift) => gift.giftType === 'product' && gift.productGID && !gift.applyOnlyForSubscriptions)
          .map((gift) => {
            const giftProductId = Number(String(gift.productGID).split('/').pop());
            const allowed = (gift.variantGIDs || []).map((value) => Number(String(value).split('/').pop()));
            const pool = (variants[giftProductId] || []).filter(
              (variant) => variant.available && (!allowed.length || allowed.includes(variant.id))
            );
            return { id: gift.id, quantity: Number(gift.quantity) || 1, variantId: pool[0]?.id || allowed[0] || null };
          })
          .filter((gift) => gift.variantId),
      }))
      .filter((bar) => bar.gifts.length);

    deals[productId] = {
      handle: handles[productId],
      deal: bars.length ? { deal: block.nanoId, version: block.versionId, productId, bars } : null,
    };
  });
  return deals;
}

function storeKachingDeal(handle, deal) {
  const cacheKey = `co-kaching-deal:${handle}`;
  giftDealCache.set(cacheKey, deal);
  try {
    window.localStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), deal }));
  } catch (error) {}
}

function forgetKachingDeal(handle) {
  const cacheKey = `co-kaching-deal:${handle}`;
  giftDealCache.delete(cacheKey);
  try {
    window.localStorage.removeItem(cacheKey);
  } catch (error) {}
}

function seedKachingDeals() {
  Object.values(readKachingDeals(document)).forEach(({ handle, deal }) => {
    if (handle) storeKachingDeal(handle, deal);
  });
}

async function kachingDealFor(item) {
  const cacheKey = `co-kaching-deal:${item.handle}`;
  if (giftDealCache.has(cacheKey)) return giftDealCache.get(cacheKey);

  try {
    const stored = JSON.parse(window.localStorage.getItem(cacheKey) || 'null');
    if (stored && Date.now() - stored.at < GIFT_DEAL_TTL) {
      giftDealCache.set(cacheKey, stored.deal);
      return stored.deal;
    }
  } catch (error) {}

  const root = window.Shopify?.routes?.root || '/';
  try {
    const response = await cartFetch(`${root}products/${item.handle}`, { credentials: 'same-origin' });
    if (!response.ok) return null;
    const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
    const deal = readKachingDeals(doc)[item.product_id]?.deal || null;
    storeKachingDeal(item.handle, deal);
    return deal;
  } catch (error) {
    return null;
  }
}

function kachingBarFor(deal, quantity) {
  return deal.bars
    .filter((bar) => bar.quantity <= quantity)
    .sort((a, b) => b.quantity - a.quantity)[0];
}

function cartSectionIds() {
  return [...document.querySelectorAll('cart-items-component')]
    .map((el) => el.dataset.sectionId)
    .filter(Boolean);
}

async function postCart(url, body) {
  const response = await cartFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error('Cart update failed');
  return response.json();
}

async function syncKachingGifts({ items = null, removeOrphans = true } = {}) {
  if (giftSyncRunning) {
    giftSyncQueued = { removeOrphans: removeOrphans || Boolean(giftSyncQueued?.removeOrphans) };
    return;
  }
  giftSyncRunning = true;

  const root = window.Shopify?.routes?.root || '/';

  try {
    let lines = items;
    if (!Array.isArray(lines) || lines.some((line) => !line.handle)) {
      const cart = await cartFetch(`${root}cart.js`, { credentials: 'same-origin' }).then((response) => response.json());
      lines = cart.items || [];
    }

    const parsed = lines.map((item) => ({ item, props: kachingProps(item) }));
    const mainIds = new Set(parsed.filter(({ props }) => props?.main).map(({ props }) => props.id));
    const orphans = parsed.filter(({ props }) => props?.gift && !mainIds.has(props.id));

    const removals = {};
    if (removeOrphans) {
      orphans.forEach(({ item }) => {
        removals[item.key] = 0;
      });
    } else if (orphans.length && !giftOrphanCheck) {
      giftOrphanCheck = window.setTimeout(() => {
        giftOrphanCheck = 0;
        queueGiftSync();
      }, 1500);
    }

    const plain = parsed.filter(
      ({ item, props }) => !props && item.final_price > 0 && item.price > 0 && !giftSyncFailed.has(item.key)
    );
    const deals = await Promise.all(plain.map(({ item }) => kachingDealFor(item)));

    const giftItems = [];
    const converts = [];
    plain.forEach(({ item }, index) => {
      const deal = deals[index];
      const bar = deal && kachingBarFor(deal, item.quantity);
      if (!bar) return;

      const groupId = kachingGroupId();
      const change = {
        id: item.key,
        quantity: item.quantity,
        properties: {
          ...(item.properties || {}),
          [KACHING_PROP]: JSON.stringify({ deal: deal.deal, pp: deal.productId, main: true, v: deal.version, id: groupId, bid: bar.id }),
        },
      };
      if (item.selling_plan_allocation?.selling_plan?.id) change.selling_plan = item.selling_plan_allocation.selling_plan.id;

      bar.gifts.forEach((gift) => {
        giftItems.push({
          id: gift.variantId,
          quantity: gift.quantity,
          properties: { [KACHING_PROP]: JSON.stringify({ id: groupId, deal: deal.deal, v: deal.version, gift: gift.id }) },
        });
      });
      converts.push({ item, groupId, change });
    });

    if (!converts.length && !Object.keys(removals).length) return;

    const sectionIds = cartSectionIds();
    const sectionParams = sectionIds.length ? { sections: sectionIds.join(','), sections_url: window.location.pathname } : {};
    let cart = null;
    const added = [];

    if (converts.length) {
      try {
        await postCart(`${root}cart/add.js`, { items: giftItems });
        for (const convert of converts) {
          cart = await postCart(`${root}cart/change.js`, { ...convert.change, ...sectionParams });
          added.push(convert);
        }
      } catch (error) {
        converts.forEach(({ item }) => giftSyncFailed.add(item.key));
        const fresh = await cartFetch(`${root}cart.js`, { credentials: 'same-origin' }).then((response) => response.json());
        const freshMains = new Set((fresh.items || []).map(kachingProps).filter((props) => props?.main).map((props) => props.id));
        (fresh.items || []).forEach((line) => {
          const props = kachingProps(line);
          if (props?.gift && !freshMains.has(props.id)) removals[line.key] = 0;
        });
      }
    }

    if (Object.keys(removals).length) {
      cart = await postCart(`${root}cart/update.js`, { updates: removals, ...sectionParams });
    }

    if (!cart) return;

    const unpaid = {};
    added.forEach(({ item, groupId }) => {
      const gifts = (cart.items || []).filter((line) => {
        const props = kachingProps(line);
        return props?.gift && props.id === groupId;
      });
      if (gifts.some((line) => line.final_price > 0)) {
        forgetKachingDeal(item.handle);
        gifts.forEach((line) => {
          unpaid[line.key] = 0;
        });
      }
    });
    if (Object.keys(unpaid).length) {
      cart = await postCart(`${root}cart/update.js`, { updates: unpaid, ...sectionParams });
    }

    await announceCart(cart);
  } catch (error) {
    console.warn('[drivemist] gift sync failed', error);
  } finally {
    giftSyncRunning = false;
    if (giftSyncQueued) {
      const next = giftSyncQueued;
      giftSyncQueued = null;
      queueGiftSync(next);
    }
  }
}

async function announceCart(cart) {
  keepShippingWidget();
  try {
    const { CartLinesUpdateEvent } = await import('@shopify/events');
    document.dispatchEvent(
      new CartLinesUpdateEvent({
        action: 'update',
        context: 'cart',
        lines: [],
        promise: Promise.resolve({
          cart: CartLinesUpdateEvent.createCartFromAjaxResponse(cart),
          detail: {
            sections: cart.sections || {},
            items: cart.items,
            itemCount: cart.item_count,
            source: GIFT_SYNC_SOURCE,
            didError: false,
          },
        }),
      })
    );
  } catch (error) {
    if (cartSectionIds().length) reloadPage();
  }
}

function queueGiftSync(options) {
  if (!document.querySelector('cart-items-component')) return Promise.resolve();
  return enqueueCartWrite(() => syncKachingGifts({ ...options, items: null }));
}

async function initKachingGiftSync() {
  if (document.documentElement.dataset.coGiftSync === 'true') return;
  document.documentElement.dataset.coGiftSync = 'true';

  seedKachingDeals();

  let eventName = 'shopify:cart:lines-update';
  try {
    const { StandardEvents } = await import('@shopify/events');
    if (StandardEvents?.cartLinesUpdate) eventName = StandardEvents.cartLinesUpdate;
  } catch (error) {}

  document.addEventListener(eventName, (event) => {
    const removing =
      event.action === 'remove' || (Array.isArray(event.lines) && event.lines.some((line) => line.quantity === 0));
    const settle = event.promise ? event.promise.catch(() => null) : Promise.resolve(null);

    settle.then((result) => {
      if (result?.detail?.source === GIFT_SYNC_SOURCE) return;
      queueGiftSync({ items: result?.detail?.items || null, removeOrphans: removing });
    });
  });

  queueGiftSync();
}

function initBeforeAfter(root = document) {
  const sliders = [...root.querySelectorAll('img-comparison-slider.co-ba:not([data-co-ready])')];
  if (!sliders.length || reduceMotion || !('IntersectionObserver' in window)) return;

  const wiggle = (slider) => {
    const start = Number(slider.value) || 50;
    const keys = [start, start - 14, start + 10, start - 5, start];
    const segment = 380;
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
    let begin = 0;
    let stopped = false;
    const stop = () => {
      stopped = true;
    };
    slider.addEventListener('pointerdown', stop, { once: true });
    slider.addEventListener('keydown', stop, { once: true });

    const step = (now) => {
      if (stopped) return;
      if (!begin) begin = now;
      const elapsed = now - begin;
      const index = Math.min(Math.floor(elapsed / segment), keys.length - 2);
      const t = Math.min((elapsed - index * segment) / segment, 1);
      slider.value = keys[index] + (keys[index + 1] - keys[index]) * ease(t);
      if (elapsed < segment * (keys.length - 1)) window.requestAnimationFrame(step);
      else slider.value = start;
    };
    window.requestAnimationFrame(step);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const tallerThanView = entry.boundingClientRect.height > window.innerHeight;
        const fullyShown = entry.intersectionRatio >= 0.98 || (tallerThanView && entry.intersectionRect.height >= window.innerHeight * 0.9);
        if (!fullyShown) return;
        observer.unobserve(entry.target);
        customElements.whenDefined('img-comparison-slider').then(() => {
          window.setTimeout(() => wiggle(entry.target), 250);
        });
      });
    },
    { threshold: Array.from({ length: 21 }, (_, i) => i / 20).concat(0.98) }
  );

  sliders.forEach((slider) => {
    slider.dataset.coReady = 'true';
    observer.observe(slider);
  });
}

function initReviewJump() {
  if (document.documentElement.dataset.coReviewJump === 'true') return;
  document.documentElement.dataset.coReviewJump = 'true';

  const triggers = '.jdgm-prev-badge__stars, .jdgm-prev-badge__text';

  const jump = (event) => {
    const trigger = event.target.closest?.(triggers);
    if (!trigger || trigger.closest('article, a')) return;
    if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;

    const widget = document.querySelector('#judgeme_product_reviews, .jdgm-review-widget, .jm-review-widget');
    if (!widget) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    (widget.closest('.shopify-section') || widget).scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  };

  document.addEventListener('click', jump, true);
  document.addEventListener('keydown', jump, true);
}

function initMessengerClose() {
  const root = document.documentElement;
  const storageKey = 'co-chat-closed';
  try {
    if (window.sessionStorage.getItem(storageKey) === 'true') root.dataset.coChatClosed = 'true';
  } catch (error) {}

  const button = document.querySelector('[data-co-messenger-close]:not([data-co-ready])');
  if (!button) return;
  button.dataset.coReady = 'true';
  button.addEventListener('click', () => {
    root.dataset.coChatClosed = 'true';
    try {
      window.sessionStorage.setItem(storageKey, 'true');
    } catch (error) {}
  });
}

function initAll(root = document) {
  initReveal(root);
  initGalleries(root);
  initCarousels(root);
  initQuantity(root);
  initStickyBar(root);
  initMainVariantSync(root);
  initBundles(root);
  initDemoVideos(root);
  initBeforeAfter(root);
  initEmbeds(root);
  initAccordions(root);
  initAutoScroll(root);
  initLangSwitcher(root);
  initLivePrice(root);
  initVariantDialogs(root);
  initSoldOutNotes(root);
  initCartPop();
  initAddToCartRedirect();
  initCartConsent();
  initFreeShippingLabels();
  initCartStickyBar();
  initCartVariantSwap();
  initMakeCommerceBridge();
  initKachingGiftSync();
  initTiltGuard();
  initReviewWidget();
  initReviewJump();
  initMessengerClose();
  initHeroFill();
}

document.addEventListener('DOMContentLoaded', () => initAll());
initAll();

document.addEventListener('shopify:section:load', (event) => initAll(event.target));
document.addEventListener('shopify:section:select', (event) => initAll(event.target));
