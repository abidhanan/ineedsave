// Google Analytics 4 + Microsoft Clarity. IDs come from the GA4_ID / CLARITY_ID env vars, injected
// into the page as window.INS_ANALYTICS by scripts/build.mjs. Both libraries are loaded only after
// the page has finished loading and the browser is idle, so they never slow down the first paint;
// events sent before that are queued by the stubs below and delivered once the scripts arrive.
(() => {
  const { ga4, clarity } = window.INS_ANALYTICS || {};
  const lang = document.documentElement.lang;

  if (ga4) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', ga4);
    window.gtag('set', 'user_properties', { ui_language: lang });
  }
  if (clarity) {
    window.clarity = window.clarity || function c() { (window.clarity.q = window.clarity.q || []).push(arguments); };
    window.clarity('set', 'ui_language', lang);
  }

  /** Records an event in both tools; safe to call when neither is configured. */
  window.track = (name, params = {}) => {
    if (ga4) window.gtag('event', name, params);
    if (clarity) window.clarity('event', name);
  };

  if (!ga4 && !clarity) return;
  const inject = (src) => {
    const script = document.createElement('script');
    script.async = true;
    script.src = src;
    document.head.append(script);
  };
  const load = () => {
    if (ga4) inject(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4)}`);
    if (clarity) inject(`https://www.clarity.ms/tag/${encodeURIComponent(clarity)}`);
  };
  const whenIdle = () => (window.requestIdleCallback ? requestIdleCallback(load, { timeout: 3000 }) : setTimeout(load, 1500));
  if (document.readyState === 'complete') whenIdle();
  else window.addEventListener('load', whenIdle, { once: true });
})();
