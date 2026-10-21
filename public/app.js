(() => {
  const form = document.getElementById('form');
  const input = document.getElementById('url');
  const submit = document.getElementById('submit');
  const pasteBtn = document.getElementById('paste');
  const clearBtn = document.getElementById('clear');
  const results = document.getElementById('results');
  const toast = document.getElementById('toast');

  const PLATFORM_NAMES = {
    youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram', facebook: 'Facebook',
    twitter: 'X / Twitter', pinterest: 'Pinterest', reddit: 'Reddit', soundcloud: 'SoundCloud',
    vimeo: 'Vimeo', twitch: 'Twitch', dailymotion: 'Dailymotion', tumblr: 'Tumblr',
    linkedin: 'LinkedIn', bluesky: 'Bluesky', bilibili: 'Bilibili', snapchat: 'Snapchat',
    imgur: 'Imgur', '9gag': '9GAG',
  };
  const GROUPS = [
    { type: 'video', title: 'group.video' },
    { type: 'audio', title: 'group.audio' },
    { type: 'image', title: 'group.image' },
  ];
  // "@key" / "@key:n" labels from /api/extract -> translation keys.
  const LABELS = {
    thumbnail: 'label.thumbnail', photo: 'label.photo', video: 'label.video',
    original_audio: 'label.original_audio', original_quality: 'note.original_quality',
    no_audio: 'note.no_audio', watermark: 'note.watermark',
  };
  const NUMBERED = { photo: 'label.photoN', video: 'label.videoN', audio: 'label.audioN' };
  const t = (key, vars) => window.i18n.t(key, vars);
  const VISIBLE_PER_GROUP = 4;
  const canPaste = !!(navigator.clipboard && navigator.clipboard.readText);

  let controller = null;
  let toastTimer = null;
  let shown = null; // what the results area shows, re-rendered when the language changes

  // ---------- helpers ----------
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value === null || value === undefined || value === false) continue;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else node.setAttribute(key, value === true ? '' : value);
    }
    for (const child of [].concat(children)) if (child) node.append(child);
    return node;
  }

  function icon(path, size = 18) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', path);
    svg.append(p);
    return svg;
  }
  const ICON_DOWNLOAD = 'M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 20h14';
  const ICON_ALERT = 'M12 8v5m0 3.5v.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z';
  const ICON_IMAGE = 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01';

  function formatSize(bytes) {
    if (!bytes) return null;
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let n = bytes;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return `${n.toLocaleString(window.i18n.lang, { maximumFractionDigits: n < 10 && i > 1 ? 1 : 0 })} ${units[i]}`;
  }

  function formatDuration(sec) {
    if (!sec) return null;
    sec = Math.round(sec);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = String(sec % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
  }

  function label(text) {
    if (!text || text[0] !== '@') return text;
    const [key, n] = text.slice(1).split(':');
    if (n && NUMBERED[key]) return t(NUMBERED[key], { n });
    return LABELS[key] ? t(LABELS[key]) : key;
  }

  function errorText(code) {
    const key = `error.${code}`;
    const text = t(key);
    return text === key ? t('error.failed') : text;
  }

  function platformName(key) {
    if (!key) return '';
    const k = String(key).toLowerCase();
    for (const [id, name] of Object.entries(PLATFORM_NAMES)) if (k.startsWith(id)) return name;
    return key;
  }

  function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 4000);
  }

  function syncFieldButtons() {
    const hasValue = input.value.trim().length > 0;
    clearBtn.hidden = !hasValue;
    pasteBtn.hidden = hasValue || !canPaste;
  }

  function setLoading(on) {
    submit.disabled = on;
    submit.classList.toggle('is-loading', on);
    if (on) submit.setAttribute('aria-label', t('form.processing'));
    else submit.removeAttribute('aria-label');
  }

  function scrollToResults() {
    const top = results.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  // ---------- rendering ----------
  function renderLoading() {
    shown = { loading: true };
    const skeleton = document.getElementById('tpl-loading').content.cloneNode(true);
    skeleton.querySelector('.loading-text').textContent = t('results.loading');
    results.replaceChildren(skeleton);
    results.hidden = false;
  }

  function renderError(code) {
    shown = { error: code };
    results.replaceChildren(el('div', { class: 'alert', role: 'alert' }, [icon(ICON_ALERT, 20), el('span', { text: errorText(code) })]));
    results.hidden = false;
  }

  // The download response sets a dl_<key> cookie (1 = started, 0 = failed); poll for it.
  function watchDownload(key, done) {
    const started = Date.now();
    const timer = setInterval(() => {
      const found = document.cookie.match(new RegExp(`(?:^|; )dl_${key}=(\\d)`));
      if (!found && Date.now() - started < 300000) return;
      clearInterval(timer);
      document.cookie = `dl_${key}=; Max-Age=0; Path=/`;
      done(found ? found[1] === '1' : null);
    }, 500);
  }

  // Straight from the platform's CDN (option.direct, only for CDNs that allow it): the file never passes
  // through our server. Read into memory, then saved under our file name. Throws if anything goes wrong.
  const DIRECT_MAX_BYTES = 300 * 1024 * 1024; // bigger files go through /api/download (phone memory)
  async function directDownload(option, onProgress) {
    const res = await fetch(option.direct, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const total = Number(res.headers.get('content-length')) || option.size || 0;
    if (total > DIRECT_MAX_BYTES) { res.body.cancel(); throw new Error('too big'); }
    const reader = res.body.getReader();
    const chunks = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (received > DIRECT_MAX_BYTES) { reader.cancel(); throw new Error('too big'); }
      if (total) onProgress(Math.min(99, Math.floor((received / total) * 100)));
    }
    if (!received) throw new Error('empty');
    const blobUrl = URL.createObjectURL(new Blob(chunks, { type: res.headers.get('content-type') || 'application/octet-stream' }));
    const a = el('a', { href: blobUrl, download: option.filename || '' });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  }

  // Through our server (/api/download), which also does merging/conversion. Its response sets a
  // dl_<key> cookie (1 = started, 0 = failed) that watchDownload() polls for.
  function serverDownload(option, done) {
    const key = Math.random().toString(36).slice(2, 12).padEnd(8, '0');
    const a = el('a', { href: `${option.url}&k=${key}`, download: '', rel: 'nofollow' });
    document.body.append(a);
    a.click();
    a.remove();
    watchDownload(key, done);
  }

  function renderOption(option) {
    const quality = label(option.quality);
    const details = [option.ext && option.ext.toUpperCase(), formatSize(option.size), label(option.note)].filter(Boolean).join(' · ');
    const text = el('span', { text: t('download.button') });
    const link = el('a', {
      class: 'btn btn-outline',
      href: option.url,
      download: '',
      rel: 'nofollow',
      'aria-label': `${t('download.button')} ${quality} ${option.ext || ''}`.trim(),
    }, [icon(ICON_DOWNLOAD), el('span', { class: 'spinner', 'aria-hidden': 'true' }), text]);
    link.addEventListener('click', async (event) => {
      event.preventDefault();
      if (link.classList.contains('is-busy')) return;
      link.classList.add('is-busy');
      text.textContent = t('download.preparing');
      showToast(t('toast.preparing'));
      const event_ = { platform: platformName(option.platform), media_type: option.type, quality: option.quality, format: option.ext };
      window.track?.('download_click', event_);
      const finish = (ok, via) => {
        link.classList.remove('is-busy');
        text.textContent = t('download.button');
        if (ok !== null) showToast(t(ok ? 'toast.started' : 'toast.failed'));
        if (ok !== null) window.track?.(ok ? 'download_started' : 'download_failed', { ...event_, via });
      };
      if (option.direct && !(option.size > DIRECT_MAX_BYTES)) {
        try {
          await directDownload(option, (pct) => { text.textContent = `${t('download.preparing')} ${pct}%`; });
          finish(true, 'direct');
          return;
        } catch { /* CDN refused, link expired, too big... fall back to our server */ }
        text.textContent = t('download.preparing');
      }
      serverDownload(option, (ok) => finish(ok, 'server'));
    });
    return el('li', { class: 'option' }, [
      el('div', { class: 'option-info' }, [
        el('div', { class: 'option-quality', text: quality }),
        details ? el('div', { class: 'option-detail', text: details }) : null,
      ]),
      link,
    ]);
  }

  function renderGroup(title, options) {
    const list = el('ul', { class: 'options' }, options.slice(0, VISIBLE_PER_GROUP).map(renderOption));
    const group = el('div', { class: 'group' }, [el('h3', { class: 'group-title', text: t(title) }), list]);
    const hidden = options.slice(VISIBLE_PER_GROUP);
    if (hidden.length) {
      const more = el('button', { class: 'more', type: 'button', text: t('results.more', { n: hidden.length }) });
      more.addEventListener('click', () => {
        list.append(...hidden.map(renderOption));
        more.remove();
      });
      group.append(more);
    }
    return group;
  }

  function renderThumb(item) {
    const thumb = el('div', { class: 'thumb' });
    const fallback = el('div', { class: 'thumb-fallback' }, [icon(ICON_IMAGE, 32)]);
    if (item.thumbnail) {
      const proxied = `${item.thumbnail}&inline=1`;
      const img = el('img', {
        src: item.thumbnail_direct || proxied, // straight from the platform when it allows it
        alt: '',
        loading: 'lazy',
        decoding: 'async',
        referrerpolicy: 'no-referrer',
      });
      img.addEventListener('error', () => {
        if (img.getAttribute('src') !== proxied) img.src = proxied;
        else img.replaceWith(fallback);
      });
      img.addEventListener('load', () => {
        // Match the box to the media shape (portrait for TikTok/Reels, wide for YouTube).
        const ratio = Math.min(16 / 9, Math.max(3 / 4, img.naturalWidth / img.naturalHeight || 1));
        thumb.style.setProperty('--ratio', ratio.toFixed(3));
      });
      thumb.append(img);
    } else {
      thumb.append(fallback);
    }
    const duration = formatDuration(item.duration);
    if (duration) thumb.append(el('span', { class: 'badge', text: duration }));
    return thumb;
  }

  function renderItem(item) {
    const meta = [platformName(item.platform), item.uploader].filter(Boolean).join(' · ');
    const body = el('div', { class: 'result-body' }, [
      el('div', {}, [
        el('h3', { class: 'result-title', text: item.title || 'Media' }),
        meta ? el('p', { class: 'result-meta', text: meta }) : null,
      ]),
    ]);
    for (const { type, title } of GROUPS) {
      const options = item.options.filter((o) => o.type === type).map((o) => ({ ...o, platform: item.platform }));
      if (options.length) body.append(renderGroup(title, options));
    }
    return el('article', { class: 'card result' }, [el('div', { class: 'result-media' }, [renderThumb(item)]), body]);
  }

  function renderResults(data) {
    shown = { data };
    const items = data.items || [];
    const nodes = [];
    if (items.length > 1) {
      nodes.push(el('div', { class: 'results-head' }, [
        el('h2', { text: t('results.found', { n: items.length }) }),
        el('span', { text: platformName(data.platform) }),
      ]));
    }
    nodes.push(...items.map(renderItem));
    results.replaceChildren(...nodes);
    results.hidden = false;
  }

  // ---------- actions ----------
  async function run(url) {
    url = url.trim();
    if (!url) {
      input.focus();
      renderError('empty');
      return;
    }

    if (controller) controller.abort();
    controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 75000);
    const { signal } = controller;

    setLoading(true);
    renderLoading();
    scrollToResults();

    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
        signal,
      });
      let data = null;
      try { data = await res.json(); } catch { /* non-JSON error page */ }
      if (!res.ok || !data || !data.items) {
        throw new Error((data && data.error) || 'busy');
      }
      renderResults(data);
      window.track?.('extract_success', { platform: platformName(data.platform), media_count: data.items.length });
      history.replaceState(null, '', `?url=${encodeURIComponent(url)}`);
    } catch (err) {
      if (signal.aborted && controller.signal === signal) {
        renderError('timeout');
        window.track?.('extract_error', { reason: 'timeout' });
      } else if (!signal.aborted) {
        const reason = err instanceof TypeError ? 'offline' : err.message;
        renderError(reason);
        window.track?.('extract_error', { reason });
      }
    } finally {
      clearTimeout(timeout);
      if (controller && controller.signal === signal) {
        setLoading(false);
        controller = null;
      }
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    input.blur(); // closes the on-screen keyboard on phones
    run(input.value);
  });

  input.addEventListener('input', syncFieldButtons);

  pasteBtn.addEventListener('click', async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) return showToast(t('toast.clipboardEmpty'));
      input.value = text;
      syncFieldButtons();
      run(text);
    } catch {
      input.focus();
      showToast(t('toast.clipboardDenied'));
    }
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    syncFieldButtons();
    input.focus();
  });

  document.addEventListener('i18n:change', () => {
    if (!shown || shown.loading) {
      const loadingText = results.querySelector('.loading-text');
      if (loadingText) loadingText.textContent = t('results.loading');
    } else if (shown.error) renderError(shown.error);
    else renderResults(shown.data);
  });

  // The copyright line stays on one line: on narrow phones (or long translations) shrink its font just enough.
  const copyLine = document.querySelector('.footer-copy');
  function fitCopyLine() {
    copyLine.style.fontSize = '';
    copyLine.style.whiteSpace = '';
    let size = parseFloat(getComputedStyle(copyLine).fontSize);
    while (copyLine.scrollWidth > copyLine.clientWidth && size > 9) {
      size -= 0.5;
      copyLine.style.fontSize = `${size}px`;
    }
    // Still too long at the smallest readable size (very narrow screens): let it wrap rather than overflow.
    if (copyLine.scrollWidth > copyLine.clientWidth) copyLine.style.whiteSpace = 'normal';
  }
  fitCopyLine();
  document.fonts?.ready.then(fitCopyLine);
  window.addEventListener('resize', fitCopyLine);
  document.addEventListener('i18n:change', fitCopyLine);

  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Articles carousel: moves only on its own (it can't be scrolled by hand), every few seconds, also
  // under the mouse cursor. Reduced-motion users get instant steps.
  const carousel = document.querySelector('[data-carousel]');
  if (carousel) {
    const track = carousel.querySelector('.carousel-track');
    const rtl = () => document.documentElement.dir === 'rtl';
    const step = () => (track.firstElementChild?.getBoundingClientRect().width || 0) + parseFloat(getComputedStyle(track).columnGap || 0);
    const atEnd = () => Math.abs(track.scrollLeft) + track.clientWidth >= track.scrollWidth - 4;
    const behavior = () => (reducedMotion() ? 'auto' : 'smooth');
    setInterval(() => {
      if (document.hidden) return;
      if (atEnd()) track.scrollTo({ left: 0, behavior: behavior() });
      else track.scrollBy({ left: step() * (rtl() ? -1 : 1), behavior: behavior() });
    }, 4000);

    // The cards are pre-rendered per language; after a switch in the picker, take them from that
    // language's page.
    document.addEventListener('i18n:change', async ({ detail }) => {
      try {
        const res = await fetch(`/_l/${detail.lang}.html`);
        if (!res.ok) return;
        const page = new DOMParser().parseFromString(await res.text(), 'text/html');
        const cards = page.querySelector('.carousel-track');
        if (cards && window.i18n?.lang === detail.lang) {
          track.replaceChildren(...[...cards.children].map((card) => document.importNode(card, true)));
          track.scrollTo({ left: 0, behavior: 'auto' });
        }
      } catch { /* keep the current cards */ }
    });
  }

  // Navbar marker: highlights the link of the section currently on screen while scrolling.
  const navLinks = [...document.querySelectorAll('.nav a[href^="#"]')];
  const sections = navLinks.map((a) => document.getElementById(a.getAttribute('href').slice(1)));
  const updateNav = () => {
    const line = document.querySelector('.header').offsetHeight + window.innerHeight * 0.3;
    let current = 0;
    sections.forEach((section, i) => { if (section && section.getBoundingClientRect().top <= line) current = i; });
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) current = sections.length - 1;
    navLinks.forEach((a, i) => (i === current ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
  };
  window.addEventListener('scroll', updateNav, { passive: true });
  window.addEventListener('resize', updateNav);
  updateNav();

  // In-page links (navbar, skip link) scroll to their section without putting "#..." in the address bar.
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    const target = link && document.getElementById(link.getAttribute('href').slice(1));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' });
    if (link.classList.contains('skip')) target.focus({ preventScroll: true });
  });
  if (location.hash) {
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    history.replaceState(null, '', location.pathname + location.search);
    if (target) target.scrollIntoView({ behavior: 'instant' });
  }

  // Support links like /?url=https://... (and share-sheet text with extra words).
  const shared = new URLSearchParams(location.search).get('url') || new URLSearchParams(location.search).get('text');
  syncFieldButtons();
  if (shared) {
    const match = shared.match(/https?:\/\/\S+/);
    input.value = match ? match[0] : shared;
    syncFieldButtons();
    window.i18n.ready.finally(() => run(input.value));
  }
})();
