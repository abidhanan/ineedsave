// Article pages: view/like/share counters, share buttons, "Artikel Populer" (order + counts), and the
// one-line copyright footer. Counters come from /api/stats; without a database every count shows 0
// (likes and shares done on this device are still reflected) and popular articles stay newest-first.
(() => {
  const toast = document.getElementById('toast');
  let toastTimer = null;
  const showToast = (message) => {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 3000);
  };
  const store = {
    get: (s, k) => { try { return s.getItem(k); } catch { return null; } },
    set: (s, k, v) => { try { s.setItem(k, v); } catch { /* storage disabled */ } },
  };
  const T = window.INS_T || { copied: 'Link copied.', copyPrompt: 'Copy this link:' };
  const locale = document.documentElement.lang || 'id';
  const formatCount = (n) => {
    const options = { notation: n >= 10000 ? 'compact' : 'standard' };
    try { return new Intl.NumberFormat(locale, options).format(n || 0); } catch { return new Intl.NumberFormat('en', options).format(n || 0); }
  };
  const api = (body) => fetch('/api/stats', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => r.json()).catch(() => null);

  // ---------- this article: views, likes, shares ----------
  const bar = document.querySelector('.post-stats');
  if (bar) {
    const slug = bar.dataset.slug;
    const el = { views: bar.querySelector('[data-views]'), likes: bar.querySelector('[data-likes]'), shares: bar.querySelector('[data-shares]') };
    const likeBtn = bar.querySelector('[data-like]');
    const likedKey = `ins-liked:${slug}`;
    let liked = store.get(localStorage, likedKey) === '1';
    let enabled = false;
    const counts = { views: 0, likes: 0, shares: 0 };

    const render = () => {
      el.views.textContent = formatCount(counts.views);
      el.likes.textContent = formatCount(enabled ? counts.likes : Math.max(counts.likes, liked ? 1 : 0));
      el.shares.textContent = formatCount(counts.shares);
      likeBtn.setAttribute('aria-pressed', String(liked));
    };
    const apply = (data) => {
      if (!data || !data.enabled) return;
      enabled = true;
      Object.assign(counts, { views: data.views, likes: data.likes, shares: data.shares });
      render();
    };

    const viewedKey = `ins-viewed:${slug}`;
    if (store.get(sessionStorage, viewedKey) !== '1') {
      store.set(sessionStorage, viewedKey, '1');
      api({ slug, action: 'view' }).then(apply);
    } else {
      fetch(`/api/stats?slugs=${slug}`).then((r) => r.json()).then((d) => d?.enabled && apply({ enabled: true, ...d.stats[slug] })).catch(() => {});
    }
    render();

    likeBtn.addEventListener('click', async () => {
      liked = !liked;
      store.set(localStorage, likedKey, liked ? '1' : '0');
      counts.likes = Math.max(0, counts.likes + (liked ? 1 : -1));
      render();
      apply(await api({ slug, action: liked ? 'like' : 'unlike' }));
    });

    const shared = async () => {
      counts.shares += 1;
      render();
      apply(await api({ slug, action: 'share' }));
    };
    const copyLink = async () => {
      try {
        await navigator.clipboard.writeText(bar.dataset.url);
        showToast(T.copied);
      } catch {
        window.prompt(T.copyPrompt, bar.dataset.url);
      }
      shared();
    };

    // Share button: the device's share sheet where available, otherwise copy the link.
    bar.querySelector('[data-share]').addEventListener('click', async () => {
      if (navigator.share) {
        try {
          await navigator.share({ title: bar.dataset.title, url: bar.dataset.url });
          shared();
        } catch { /* cancelled */ }
        return;
      }
      copyLink();
    });
    bar.querySelectorAll('[data-share-link]').forEach((a) => a.addEventListener('click', shared));
    bar.querySelector('[data-copy]').addEventListener('click', copyLink);
  }

  // ---------- "Artikel Populer": most viewed first (when stats are on) + their counts ----------
  const popularList = document.querySelector('[data-popular]');
  const fillCounts = (stats) => {
    for (const li of popularList.querySelectorAll('li[data-slug]')) {
      const s = stats?.[li.dataset.slug] || {};
      for (const key of ['views', 'likes', 'shares']) li.querySelector(`[data-${key}]`).textContent = formatCount(s[key]);
    }
  };
  if (popularList && Array.isArray(window.INS_ARTICLES)) {
    const template = popularList.querySelector('li');
    fetch('/api/stats?popular=8').then((r) => r.json()).then(async (data) => {
      if (!data || !data.enabled) return;
      const known = new Set(window.INS_ARTICLES.map((a) => a.slug));
      const current = popularList.dataset.current;
      const ranked = (data.popular || []).filter((s) => known.has(s) && s !== current);
      const rest = window.INS_ARTICLES.map((a) => a.slug).filter((s) => s !== current && !ranked.includes(s));
      const top = [...ranked, ...rest].slice(0, 4);
      const bySlug = Object.fromEntries(window.INS_ARTICLES.map((a) => [a.slug, a]));
      popularList.replaceChildren(...top.map((s) => {
        const li = template.cloneNode(true);
        li.dataset.slug = s;
        li.querySelector('a').href = `/artikel/${s}/`;
        li.querySelector('img').src = `/artikel/img/${s}.webp`;
        li.querySelector('.popular-title').textContent = bySlug[s].title;
        return li;
      }));
      const stats = await fetch(`/api/stats?slugs=${top.join(',')}`).then((r) => r.json()).catch(() => null);
      if (stats?.enabled) fillCounts(stats.stats);
    }).catch(() => {});
  }

  // ---------- /artikel/: category labels filter the list ----------
  const filter = document.querySelector('[data-category-filter]');
  if (filter) {
    const cards = [...document.querySelectorAll('.article-grid .article-card')];
    filter.addEventListener('click', (event) => {
      const chip = event.target.closest('[data-category]');
      if (!chip) return;
      const key = chip.dataset.category;
      for (const button of filter.querySelectorAll('[data-category]')) button.setAttribute('aria-pressed', String(button === chip));
      for (const card of cards) card.hidden = Boolean(key) && !card.dataset.categories.split('|').includes(key);
    });
  }

  // ---------- one-line copyright footer ----------
  const copyLine = document.querySelector('.footer-copy');
  function fitCopyLine() {
    if (!copyLine) return;
    copyLine.style.fontSize = '';
    copyLine.style.whiteSpace = '';
    let size = parseFloat(getComputedStyle(copyLine).fontSize);
    while (copyLine.scrollWidth > copyLine.clientWidth && size > 9) {
      size -= 0.5;
      copyLine.style.fontSize = `${size}px`;
    }
    if (copyLine.scrollWidth > copyLine.clientWidth) copyLine.style.whiteSpace = 'normal';
  }
  fitCopyLine();
  document.fonts?.ready.then(fitCopyLine);
  window.addEventListener('resize', fitCopyLine);
})();
