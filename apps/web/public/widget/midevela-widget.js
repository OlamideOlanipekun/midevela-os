(function () {
  // Prevent duplicate load
  if (window.__MIDEVELA_WIDGET_LOADED__) return;
  window.__MIDEVELA_WIDGET_LOADED__ = true;

  // Locate our own <script> tag. document.currentScript is null when the
  // tag is injected dynamically (e.g. via Google Tag Manager), so fall
  // back to finding it by its data attribute.
  const scriptEl =
    document.currentScript ||
    document.querySelector('script[data-widget-key][src*="midevela-widget"]');
  const widgetKey = scriptEl ? scriptEl.getAttribute('data-widget-key') : '';
  const attrThemeColor = scriptEl ? scriptEl.getAttribute('data-theme-color') : '';
  const scriptSrc = scriptEl ? scriptEl.src : '';
  // The widget is served from the Midevela app itself, so the API lives at the same origin as this script.
  const apiBase = scriptSrc ? new URL(scriptSrc).origin : '';

  if (!widgetKey || !apiBase) {
    console.warn('Midevela widget: could not find the embed <script> tag with a data-widget-key — widget not loaded.');
    return;
  }

  const initApiUrl = apiBase + '/api/widget/init?key=' + encodeURIComponent(widgetKey);
  const qualificationApiUrl = apiBase + '/api/widget/qualification';
  const recommendApiUrl = apiBase + '/api/widget/recommend';
  const chatApiUrl = apiBase + '/api/widget/chat';
  const compareApiUrl = apiBase + '/api/widget/compare';
  const eventApiUrl = apiBase + '/api/widget/event';
  const historyApiUrl = apiBase + '/api/widget/history';

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function isHttpUrl(value) {
    return typeof value === 'string' && /^https?:\/\//i.test(value);
  }

  function safeUrl(value) {
    if (!value) return '';
    var s = String(value).trim();
    if (/^https?:\/\//i.test(s)) return s;
    if (/^mailto:/i.test(s) || /^tel:/i.test(s)) return s;
    return '';
  }

  function isHexColor(value) {
    return typeof value === 'string' && /^#[0-9a-f]{3,8}$/i.test(value);
  }

  // Pick black or white for text sitting on top of the accent colour, so a
  // filled accent button/bubble stays readable whatever accent the merchant
  // configures (bright green -> dark text; a dark accent -> white text).
  function contrastText(hex) {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return '#08120a';
    let h = m[1];
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? '#08120a' : '#ffffff';
  }

  function makeVisitorId() {
    try {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return 'visitor-' + crypto.randomUUID();
      }
    } catch (e) {
      // crypto unavailable — fall through to the legacy method below
    }
    // Legacy fallback for environments without crypto.randomUUID
    return 'visitor-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  }

  function getOrCreateCustomerId() {
    try {
      const key = 'midevela_customer_id';
      let id = window.localStorage.getItem(key);
      if (!id) {
        id = makeVisitorId();
        window.localStorage.setItem(key, id);
      }
      return id;
    } catch (e) {
      // Storage blocked (private mode, cookie settings). Use a fresh id for
      // this page load — a constant shared by every such visitor would merge
      // strangers into one conversation on the server.
      return makeVisitorId();
    }
  }

  const customerId = getOrCreateCustomerId();

  // Once-per-session guard for the proactive auto-open AND for re-popping
  // after the shopper has explicitly closed the widget once.
  const AUTO_OPEN_FLAG = 'midevela_auto_opened';
  let autoOpenedInMemory = false;
  function hasAutoOpened() {
    try {
      return window.sessionStorage.getItem(AUTO_OPEN_FLAG) === '1';
    } catch (e) {
      return autoOpenedInMemory;
    }
  }
  function markAutoOpened() {
    autoOpenedInMemory = true;
    try {
      window.sessionStorage.setItem(AUTO_OPEN_FLAG, '1');
    } catch (e) {
      /* in-memory flag already set */
    }
  }
  function resetAutoOpened() {
    autoOpenedInMemory = false;
    try {
      window.sessionStorage.removeItem(AUTO_OPEN_FLAG);
    } catch (e) {
      /* in-memory flag already cleared */
    }
  }

  // A "visit" mirrors the server's: the same 30-minute idle window bounds
  // the visitor's current ACTIVE conversation (see VISIT_IDLE_MS in
  // /api/widget/message). Past it, a returning visitor gets a fresh
  // welcome instead of "Continuing from moisturizer…" — this timestamp is
  // only ever updated when a message is actually SENT, matching the
  // server's own activity signal (Message.createdAt), not on every page
  // load/boot.
  const LAST_ACTIVITY_KEY = 'midevela_last_activity';
  const VISIT_IDLE_MS = 30 * 60 * 1000;
  function getLastActivity() {
    try {
      const raw = window.localStorage.getItem(LAST_ACTIVITY_KEY);
      return raw ? Number(raw) : null;
    } catch (e) {
      return null;
    }
  }
  function markActivity() {
    try {
      window.localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    } catch (e) {
      /* storage blocked — visit-boundary detection just won't persist */
    }
  }
  function isNewVisit() {
    const last = getLastActivity();
    return !last || Date.now() - last > VISIT_IDLE_MS;
  }

  // Persistent shopping-funnel state — category/budget/brand/answers, so a
  // returning visitor (or a page reload mid-funnel) never repeats
  // themselves. Mirrored server-side on Conversation.context once chat
  // starts (see /api/widget/message's `context` patch). Expires after the
  // same idle window as belt-and-suspenders alongside the explicit
  // new-visit reset below.
  const FUNNEL_KEY = 'midevela_funnel_state';
  function loadFunnelState() {
    try {
      const raw = window.localStorage.getItem(FUNNEL_KEY);
      if (!raw) return null;
      const state = JSON.parse(raw);
      if (state && typeof state.savedAt === 'number' && Date.now() - state.savedAt > VISIT_IDLE_MS) {
        return null;
      }
      return state;
    } catch (e) {
      return null;
    }
  }
  function saveFunnelState(state) {
    try {
      window.localStorage.setItem(FUNNEL_KEY, JSON.stringify(Object.assign({}, state, { savedAt: Date.now() })));
    } catch (e) {
      /* storage blocked — funnel simply won't persist across reloads */
    }
  }
  // Wipes everything that would otherwise resurrect a previous visit —
  // used both when this pageview's own boot detects the idle window has
  // passed, and when the server tells us (via isNewConversation) that IT
  // just started a fresh conversation, e.g. because this tab was
  // asleep/backgrounded across the boundary and our own boot-time guess
  // was already stale by the time a message was actually sent.
  function resetVisitLocalState() {
    try {
      window.localStorage.removeItem(FUNNEL_KEY);
    } catch (e) {
      /* storage blocked — nothing to clear */
    }
    resetAutoOpened();
  }

  function nowTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Best-effort analytics — never blocks or breaks the widget experience.
  function trackEvent(eventType, metadata) {
    try {
      fetch(eventApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          widgetKey,
          customerId,
          eventType,
          metadata: metadata || {},
          pageUrl: window.location.href,
        }),
        keepalive: true,
      }).catch(function () {});
    } catch (e) {
      /* analytics must never throw */
    }
  }

  const fallbackConfig = {
    business: { name: '', currency: 'NGN' },
    theme: { accentColor: '' },
    greeting: 'Good day! How can I help you today?',
    aiName: 'AI Sales Assistant',
    settings: { engagementDelay: 0, showProductImages: true },
    categories: [],
    lastCategory: null,
  };

  fetch(initApiUrl + '&customerId=' + encodeURIComponent(customerId))
    .then(function (res) {
      return res.ok ? res.json() : null;
    })
    .catch(function () {
      return null;
    })
    .then(function (remote) {
      const config = Object.assign({}, fallbackConfig, remote || {});
      config.settings = Object.assign({}, fallbackConfig.settings, config.settings || {});
      config.theme = Object.assign({}, fallbackConfig.theme, config.theme || {});
      if (!isHexColor(config.theme.accentColor)) {
        config.theme.accentColor = isHexColor(attrThemeColor) ? attrThemeColor : '#1EE67A';
      }
      if (!Array.isArray(config.categories)) config.categories = [];

      if (document.body) {
        init(config);
      } else {
        document.addEventListener('DOMContentLoaded', function () {
          init(config);
        });
      }
    });

  function init(config) {
    const onPrimary = contrastText(config.theme.accentColor);
    const aiName = String(config.aiName || fallbackConfig.aiName);
    const greeting = String(config.greeting || fallbackConfig.greeting);
    const avatarLetter = aiName.charAt(0).toUpperCase() || 'A';
    const showProductImages = config.settings.showProductImages !== false;

    // ─── SVG Icon Registry ───
    var ICONS = {
      bag: '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h14l-1.5 11H4.5z"/><path d="M7 7V4a3 3 0 016 0v3"/></svg>',
      leaf: '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 19A7 7 0 019 6c.7.4 1.3.8 1.8 1.3A7 7 0 0017 12h1a7 7 0 01-7 7z"/><path d="M12 12l-7 7"/></svg>',
      chat: '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12a10 10 0 1110 10H2l2-5a10 10 0 01-2-5z"/></svg>',
      phone: '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13.5l-4-1-2 2a12.6 12.6 0 01-5-5l2-2-1-4H3a15.5 15.5 0 0015 10z"/></svg>',
      mail: '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 5l8 5 8-5"/><path d="M2 5v10a1 1 0 001 1h14a1 1 0 001-1V5"/><path d="M2 5l8 5 8-5"/></svg>',
      star: '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 1l2.4 4.7 5.3.8-3.8 3.7.9 5.2L10 13.3l-4.8 2.4.9-5.2L2.3 6.5l5.3-.8z"/></svg>',
      'star-filled': '<svg class="mdv-icon" viewBox="0 0 20 20" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 1l2.4 4.7 5.3.8-3.8 3.7.9 5.2L10 13.3l-4.8 2.4.9-5.2L2.3 6.5l5.3-.8z"/></svg>',
      check: '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11l4 4L16 6"/></svg>',
      party: '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18L18 6"/><path d="M14 18l-2-4-2 4"/><path d="M6 10l2-4 2 4"/><path d="M18 14l-2-4-2 4"/></svg>',
      truck: '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="16" cy="16" r="2"/><circle cx="6" cy="16" r="2"/><path d="M2 6h12v10H2z"/><path d="M14 8h4l2 3v5h-2"/></svg>',
      package: '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h12v12H4z"/><path d="M4 8h12"/><path d="M8 4v12"/></svg>',
      card: '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="16" height="8" rx="2"/><path d="M2 9h16"/></svg>',
      shield: '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 1l7 3v6a7 7 0 01-7 7 7 7 0 01-7-7V4z"/></svg>',
      trophy: '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16v4M8 20h8"/><path d="M16 6a4 4 0 10-8 0v2a4 4 0 108 0z"/><path d="M6 6H4a2 2 0 000 4h2M18 6h2a2 2 0 010 4h-2"/></svg>',
      search: '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="9" r="7"/><path d="M19 19l-4.3-4.3"/></svg>',
      clock: '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><path d="M10 6v4l3 3"/></svg>',
      file: '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3h8l4 4v13a1 1 0 01-1 1H5a1 1 0 01-1-1z"/><path d="M8 10h4M8 14h4M12 3v4h4"/></svg>',
      pin: '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 18s-6-5.5-6-9a6 6 0 0112 0c0 3.5-6 9-6 9z"/><circle cx="10" cy="9" r="2"/></svg>',
      'arrow-right': '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h10"/><path d="M10 7l5 5-5 5"/></svg>',
      'arrow-left': '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 12H5"/><path d="M10 7l-5 5 5 5"/></svg>',
      'chevron-right': '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 5l5 5-5 5"/></svg>',
      'chevron-left': '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5l-5 5 5 5"/></svg>',
      x: '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l8 8"/><path d="M14 6l-8 8"/></svg>',
      plus: '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4v12"/><path d="M4 10h12"/></svg>',
      minus: '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10h12"/></svg>',
      info: '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><path d="M10 10v4"/><path d="M10 7v1"/></svg>',
      smile: '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><path d="M6 12a4 4 0 008 0"/><circle cx="7.5" cy="8.5" r=".5" fill="currentColor"/><circle cx="12.5" cy="8.5" r=".5" fill="currentColor"/></svg>',
      sparkle: '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l.7 3.3L16 4l-1.7 3.7L18 9l-3.7 1.7L16 14l-3.7-1.3L12 16l-1.3-3.7L7 14l1.7-3.7L5 9l3.7-1.7L7 4l3.3 1.3z"/></svg>',
      heart: '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17s-7-4.5-7-8a4 4 0 018-2 4 4 0 018 2c0 3.5-7 8-7 8z"/></svg>',
      external: '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3h5v5"/><path d="M11 9l7-7"/><path d="M17 13v4a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h4"/></svg>',
      refresh: '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12a10 10 0 1018-4"/><path d="M19 1v6h-6"/></svg>',
      send: '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12l19-9-8 19-4-7z"/></svg>',
      droplet: '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 1l5 8a6 6 0 11-10 0z"/></svg>',
      sun: '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="4"/><path d="M10 1v2M10 17v2M1 10h2M17 10h2M3.5 3.5l1.4 1.4M15.1 15.1l1.4 1.4M3.5 16.5l1.4-1.4M15.1 4.9l1.4-1.4"/></svg>',
      flower: '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="5" r="2.5"/><circle cx="10" cy="10" r="2.5"/><path d="M7 7.5l3 5M13 7.5l-3 5"/><path d="M6 12l4 6M14 12l-4 6"/></svg>',
      eye: '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 10s3-7 9-7 9 7 9 7-3 7-9 7-9-7-9-7z"/><circle cx="10" cy="10" r="3"/></svg>',
      whatsapp: '<svg class="mdv-icon" viewBox="0 0 20 20" fill="currentColor"><path d="M10 0C4.5 0 0 4.5 0 10c0 1.9.5 3.6 1.5 5.2L.5 19.5l4.3-1C6.4 19.4 8.2 20 10 20c5.5 0 10-4.5 10-10S15.5 0 10 0zm0 18.5c-1.7 0-3.3-.5-4.7-1.3l-.3-.2-2.6.7.7-2.5-.2-.3C2.2 13.6 1.7 12 1.7 10c0-4.6 3.7-8.3 8.3-8.3s8.3 3.7 8.3 8.3-3.7 8.3-8.3 8.3zm4.4-6.2c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.6.1-.2.2-.7.8-.9 1-.1.2-.3.2-.5.1-.5-.2-1.1-.4-1.6-.9-.5-.5-.9-1.1-1.2-1.7-.1-.2 0-.4.1-.5.1-.1.2-.2.3-.4.1-.1.1-.2.2-.3.1-.2 0-.4 0-.5-.1-.2-.6-1.5-.8-2-.1-.5-.2-.4-.3-.4h-.5c-.2 0-.5.1-.7.3-.5.5-.8 1.3-.8 2.1 0 .8.3 1.5.6 2.1.3.5.6.9 1 1.3l.5.5c.4.4.9.7 1.4 1 .5.3 1 .5 1.6.6.5.1 1 .1 1.4-.1.3-.1.7-.3.9-.6.3-.3.4-.6.4-.8.1-.2.1-.4 0-.5z"/></svg>',
      list: '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 5h2M6 5h12M2 10h2M6 10h12M2 15h2M6 15h12"/></svg>',
      lock: '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="9" width="12" height="8" rx="2"/><path d="M7 9V6a3 3 0 016 0v3"/></svg>',
      compare: '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17l-5-5 5-5M13 5l5 5-5 5"/></svg>',
      'alert-circle': '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><path d="M10 6v4M10 13v1"/></svg>',
      wallet: '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M12 9h4v4h-4a2 2 0 010-4z"/></svg>',
      gem: '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2h12l3 5-9 11L1 7z"/></svg>',
      tag: '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h6l8 8-6 6-8-8V3z"/><circle cx="6.5" cy="6.5" r="1.5" fill="currentColor"/></svg>',
      'message-circle': '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9a7 7 0 0114 0 7 7 0 01-7 7H2l1.5-3.5A7 7 0 012 9z"/></svg>',
      'chevron-up': '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 13l-5-5-5 5"/></svg>',
      'chevron-down': '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7l5 5 5-5"/></svg>',
      wave: '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11c2 0 3-2 5-2s3 2 5 2 3-2 5-2"/><path d="M3 15c2 0 3-2 5-2s3 2 5 2 3-2 5-2"/><path d="M3 7c2 0 3-2 5-2s3 2 5 2 3-2 5-2"/></svg>',
      folder: '<svg class="mdv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 5a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2z"/></svg>',
    };

    function icon(key) {
      return ICONS[key] || '';
    }

    function renderIcon(key, className) {
      var div = document.createElement('span');
      div.innerHTML = icon(key);
      var svg = div.firstElementChild;
      if (svg && className) svg.classList.add(className);
      return svg || document.createElement('span');
    }

    // ─── Funnel state (in-memory this pageview; persisted to localStorage) ───
    const funnel = {
      view: 'welcome', // welcome | qualification | recommendations | conversation
      categoryId: null,
      categoryName: null,
      answers: {},
      compareSelection: [],
      conversationStarted: false,
    };

    const styleText = `
    :host {
      --primary: ${config.theme.primary || config.theme.accentColor || '#0F62FE'};
      --on-primary: ${config.theme.onPrimary || onPrimary};
      --mv-header: ${config.theme.header || config.theme.primary || config.theme.accentColor || '#0F62FE'};
      --mv-launcher: ${config.theme.launcher || config.theme.primary || config.theme.accentColor || '#0F62FE'};
      --mv-user-bubble: ${config.theme.userBubble || config.theme.primary || config.theme.accentColor || '#0F62FE'};
      --mv-ai-bubble: ${config.theme.assistantBubble || '#ffffff'};
      --mv-background: ${config.theme.background || '#F8FAFC'};
      --mv-quick-reply: ${config.theme.quickReply || '#EFF6FF'};
      --mv-border: ${config.theme.border || '#e5e7eb'};
      --mv-font-family: ${config.theme.fontFamily ? `'${config.theme.fontFamily}', -apple-system, sans-serif` : "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"};

      /* Strict 8px Spacing System */
      --space-1: 8px;
      --space-2: 16px;
      --space-3: 24px;
      --space-4: 32px;

      /* Typography Scale */
      --font-header: 20px;
      --font-title: 16px;
      --font-body: 15px;
      --font-chip: 13px;
      --font-timestamp: 11px;

      /* Border Radius Scale */
      --radius-card: 16px;
      --radius-msg: 20px;
      --radius-btn: 24px;
      --radius-input: 28px;
      --radius-full: 999px;

      /* Bubble Radii */
      --radius-ai-bubble: 20px 20px 20px 6px;
      --radius-user-bubble: 20px 20px 6px 20px;

      /* Structural Tokens */
      --widget-width-desktop: 400px;
      --widget-width-tablet: 380px;
      --input-height: 56px;
      --avatar-size: 32px;
      --avatar-gap: 12px;
      --msg-max-width: 72%;

      --bg: #ffffff;
      --icon-size: 20px;
      --bg-soft: var(--mv-quick-reply);
      --text: #111827;
      --muted: #6b7280;
      --border: var(--mv-border);
      --card: #ffffff;
      --success: #22c55e;
      --error: #ef4444;
      --font: var(--mv-font-family);
      --shadow-lg: 0 12px 40px rgba(0, 0, 0, 0.12);
      --shadow-xl: 0 20px 50px rgba(0, 0, 0, 0.14);
      --bubble-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
      --user-gradient: linear-gradient(135deg, var(--mv-user-bubble) 0%, color-mix(in srgb, var(--mv-user-bubble) 85%, #000) 100%);
      --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
    }

    .mdv-icon {
      width: var(--icon-size);
      height: var(--icon-size);
      vertical-align: middle;
      display: inline-block;
      flex-shrink: 0;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    /* ─── FAB LAUNCHER ─── */
    .fab {
      position: fixed;
      bottom: 24px;
      left: 24px;
      z-index: 999999;
      cursor: pointer;
      border: none;
      outline: none;
      background: var(--mv-launcher);
      border-radius: 50%;
      width: 56px;
      height: 56px;
      padding: 0;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
      transition: transform 0.28s var(--ease-out), box-shadow 0.28s var(--ease-out);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--font);
    }

    .fab:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.24);
    }
    .fab:active { transform: scale(0.94); }

    .fab-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
    }
    .fab-icon svg { width: 22px; height: 22px; fill: var(--on-primary); display: block; }

    .fab.open .fab-icon { display: none; }

    .fab-close-icon {
      display: none;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
    }
    .fab-close-icon svg { width: 22px; height: 22px; fill: var(--on-primary); }
    .fab.open .fab-close-icon { display: flex; }

    .fab-pulse-ring {
      position: absolute;
      inset: -3px;
      border-radius: 50%;
      border: 2px solid var(--primary);
      animation: pulseRing 2.4s infinite;
      pointer-events: none;
    }

    @keyframes pulseRing {
      0% { transform: scale(1); opacity: 0.35; }
      100% { transform: scale(1.5); opacity: 0; }
    }

    /* ─── BACK TO TOP ─── */
    .back-to-top {
      position: fixed;
      bottom: 88px;
      left: 24px;
      z-index: 999999;
      cursor: pointer;
      border: none;
      outline: none;
      background: var(--bg);
      border-radius: 50%;
      width: 40px;
      height: 40px;
      padding: 0;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 0.2s var(--ease-out), transform 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
      opacity: 0;
      transform: translateY(10px);
      pointer-events: none;
      color: var(--muted);
    }
    .back-to-top.visible {
      opacity: 1;
      transform: translateY(0);
      pointer-events: auto;
    }
    .back-to-top:hover {
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.14);
      color: var(--text);
    }
    .back-to-top:active { transform: scale(0.92); }
    .back-to-top svg { width: 18px; height: 18px; display: block; }

    @media (max-width: 768px) {
      .chat-panel { width: var(--widget-width-tablet); }
    }

    @media (max-width: 480px) {
      .fab { bottom: 16px; left: 16px; width: 48px; height: 48px; }
      .back-to-top { bottom: 72px; left: 16px; width: 36px; height: 36px; }
      .back-to-top svg { width: 16px; height: 16px; }
    }

    .backdrop { display: none; }

    /* ─── CHAT PANEL (Phase 1 Layout Foundation) ─── */
    .chat-panel {
      position: fixed;
      top: 50%;
      right: 24px;
      transform: translateY(-50%) translateX(calc(100% + 24px));
      width: var(--widget-width-desktop);
      height: min(700px, calc(100vh - 48px));
      max-width: calc(100vw - 48px);
      background: var(--bg);
      border-radius: 24px;
      box-shadow: var(--shadow-xl);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 999999;
      font-family: var(--font);
      pointer-events: none;
      transition: transform 0.32s var(--ease-out), opacity 0.24s var(--ease-out);
      opacity: 0;
    }

    .chat-panel.open {
      transform: translateY(-50%) translateX(0);
      pointer-events: all;
      opacity: 1;
    }

    /* ─── HEADER (Phase 7 Header Alignment) ─── */
    .header {
      padding: var(--space-2);
      margin-bottom: var(--space-2);
      flex-shrink: 0;
      position: relative;
    }

    .header-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .header-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--primary);
      color: var(--on-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: var(--font-title);
      flex-shrink: 0;
    }

    .header-name {
      font-size: var(--font-title);
      font-weight: 700;
      color: var(--text);
      line-height: 1.2;
    }

    .header-subtitle {
      font-size: 13px;
      color: var(--muted);
      line-height: 1.3;
      margin-top: 2px;
    }

    .header-status {
      font-size: 11px;
      color: var(--muted);
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 2px;
    }

    .header-status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--success);
    }

    .header-actions {
      display: flex;
      gap: 4px;
    }

    .header-btn {
      background: none;
      border: none;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--muted);
      transition: background 0.18s var(--ease-out), color 0.18s;
    }
    .header-btn:hover { background: var(--bg-soft); color: var(--text); }
    .header-btn svg { width: 18px; height: 18px; fill: currentColor; }

    .header-divider {
      height: 1px;
      background: var(--border);
      margin-top: var(--space-2);
      opacity: 0.6;
    }

    /* ─── BODY (Phase 1 & 4 Internal Padding & Message Stack) ─── */
    .body {
      flex: 1;
      overflow-y: auto;
      padding: var(--space-2);
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      background: var(--bg-soft);
      scroll-behavior: smooth;
    }

    .body::-webkit-scrollbar { display: none; }
    .body { scrollbar-width: none; }

    /* ─── MESSAGES (Phase 2, 3, 5 Message Layout & Alignment) ─── */
    .msg-row {
      display: flex;
      gap: var(--avatar-gap);
      width: 100%;
      animation: msgIn 0.25s var(--ease-out) both;
      margin-bottom: var(--space-2);
    }
    .msg-row.ai {
      align-self: flex-start;
      align-items: flex-start;
    }
    .msg-row.customer {
      justify-content: flex-end;
      align-self: flex-end;
    }

    .msg-group-gap {
      margin-bottom: var(--space-3);
    }

    @keyframes msgIn {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Phase 3 — Top Aligned Avatar */
    .msg-avatar {
      width: var(--avatar-size);
      height: var(--avatar-size);
      border-radius: 50%;
      background: linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 70%, #000) 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      flex-shrink: 0;
      align-self: flex-start;
      margin-top: 0;
    }

    .msg-col {
      display: flex;
      flex-direction: column;
      min-width: 0;
      max-width: 100%;
      gap: 4px;
    }
    .customer .msg-col {
      align-items: flex-end;
    }

    .msg-sender {
      font-size: 12px;
      font-weight: 600;
      color: var(--muted);
      letter-spacing: 0.01em;
      margin-left: 2px;
    }

    /* Phase 2 — Bubble Width, Padding & Radius */
    .msg-bubble {
      font-size: var(--font-body);
      line-height: 1.5;
      color: var(--text);
      word-wrap: break-word;
      overflow-wrap: anywhere;
      min-width: fit-content;
    }

    .ai .msg-bubble {
      background: var(--mv-ai-bubble);
      color: var(--text);
      border-radius: var(--radius-ai-bubble);
      padding: 12px var(--space-2);
      border: 1px solid var(--border);
      box-shadow: var(--bubble-shadow);
      white-space: pre-wrap;
      max-width: var(--msg-max-width);
    }

    .customer .msg-bubble {
      background: var(--user-gradient);
      color: var(--on-primary);
      border-radius: var(--radius-user-bubble);
      padding: 12px var(--space-2);
      max-width: var(--msg-max-width);
    }

    /* Phase 5 — Timestamp System */
    .msg-time {
      font-size: var(--font-timestamp);
      color: var(--muted);
      margin-top: 4px;
      opacity: 0.6;
    }
    .ai .msg-time { text-align: left; }
    .customer .msg-time { text-align: right; }

    /* ─── CHIPS / QUICK REPLIES (Phase 6 Quick Reply System) ─── */
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      padding-left: 44px;
      margin-top: 4px;
      margin-bottom: var(--space-2);
      animation: msgIn 0.3s var(--ease-out);
    }

    .chip {
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--text);
      border-radius: var(--radius-btn);
      min-height: 44px;
      padding: 14px 18px;
      font-size: var(--font-chip);
      font-weight: 500;
      cursor: pointer;
      font-family: var(--font);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background 0.18s, transform 0.18s, border-color 0.18s, box-shadow 0.18s;
    }
    .chip:hover { background: var(--bg-soft); border-color: var(--primary); transform: translateY(-1px); box-shadow: var(--bubble-shadow); }
    .chip:active { transform: scale(0.96); background: color-mix(in srgb, var(--primary) 6%, var(--bg)); }
    .chip:disabled { opacity: 0.4; cursor: default; transform: none; box-shadow: none; }

    /* ─── CATEGORY GRID ─── */
    .cat-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      padding-left: 44px;
      animation: msgIn 0.3s var(--ease-out);
    }

    .cat-tile {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 14px 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      transition: transform 0.2s var(--ease-out), box-shadow 0.2s, border-color 0.2s;
      font-family: var(--font);
      text-align: center;
    }
    .cat-tile:hover {
      transform: translateY(-2px);
      border-color: var(--primary);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
    }

    .cat-tile-icon {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--bg-soft);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      overflow: hidden;
    }
    .cat-tile-icon img { width: 100%; height: 100%; object-fit: cover; }

    .cat-tile-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--text);
    }

    /* ─── RECOMMENDATION CARDS ─── */
    .reco-container {
      display: flex;
      gap: 16px;
      overflow-x: auto;
      padding: 12px 0 16px;
      width: 100%;
      scrollbar-width: none;
      scroll-snap-type: x mandatory;
      -webkit-overflow-scrolling: touch;
    }
    .reco-container::-webkit-scrollbar { display: none; }

    @keyframes recoCardIn {
      from { opacity: 0; transform: scale(0.95) translateY(8px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }

    .reco-card {
      flex-shrink: 0;
      width: 220px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 20px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      scroll-snap-align: start;
      transition: transform 0.25s var(--ease-out), box-shadow 0.25s var(--ease-out);
      animation: recoCardIn 0.3s var(--ease-out) both;
    }
    .reco-card:hover {
      transform: translateY(-6px);
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.1);
    }
    .reco-card.selected { border-color: var(--primary); border-width: 2px; }

    .reco-img {
      position: relative;
      width: 100%;
      height: 200px;
      background: var(--bg-soft);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      overflow: hidden;
      cursor: pointer;
      flex-shrink: 0;
    }
    .reco-img img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s var(--ease-out), opacity 0.3s;
    }
    .reco-card:hover .reco-img img { transform: scale(1.04); }

    .reco-img-shimmer {
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, var(--bg-soft) 25%, color-mix(in srgb, var(--primary) 6%, var(--bg)) 50%, var(--bg-soft) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.6s infinite;
    }

    .reco-img-fallback {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      color: var(--muted);
      font-size: 12px;
    }
    .reco-img-fallback span { font-size: 32px; }

    .reco-badge {
      position: absolute;
      top: 10px;
      left: 10px;
      background: var(--primary);
      color: var(--on-primary);
      font-size: 10px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 999px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      z-index: 1;
    }

    .reco-body {
      padding: 14px 14px 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex: 1;
    }

    .reco-name {
      font-size: 15px;
      font-weight: 700;
      color: var(--text);
      line-height: 1.3;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      cursor: pointer;
    }

    .reco-rating {
      font-size: 13px;
      color: #f59e0b;
      letter-spacing: 1px;
    }

    .reco-price {
      font-size: 18px;
      font-weight: 800;
      color: var(--primary);
      line-height: 1.2;
    }

    .reco-why {
      font-size: 12px;
      color: var(--muted);
      line-height: 1.45;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .reco-features {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin-top: 2px;
    }

    .reco-feature-chip {
      background: var(--bg-soft);
      color: var(--muted);
      font-size: 10px;
      font-weight: 500;
      padding: 3px 8px;
      border-radius: 999px;
      line-height: 1.3;
      white-space: nowrap;
    }

    .reco-footer {
      font-size: 11px;
      color: var(--success);
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 0 14px 8px;
    }
    .reco-footer-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--success);
      flex-shrink: 0;
    }
    .reco-footer-out { color: var(--muted); }
    .reco-footer-out .reco-footer-dot { background: var(--muted); }

    .reco-actions {
      display: flex;
      gap: 8px;
      padding: 0 14px 14px;
    }

    .reco-btn {
      flex: 1;
      display: block;
      text-align: center;
      padding: 11px 10px;
      font-size: 13px;
      font-weight: 600;
      color: var(--on-primary);
      background: var(--primary);
      text-decoration: none;
      cursor: pointer;
      transition: filter 0.18s, transform 0.18s;
      border: none;
      border-radius: 999px;
    }
    .reco-btn:hover { filter: brightness(0.92); }
    .reco-btn:active { transform: scale(0.97); }

    .reco-compare-btn {
      flex-shrink: 0;
      background: var(--bg);
      color: var(--text);
      border: 1.5px solid var(--border);
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      padding: 11px 14px;
      cursor: pointer;
      font-family: var(--font);
      transition: background 0.18s, border-color 0.18s, color 0.18s, transform 0.18s;
      white-space: nowrap;
    }
    .reco-compare-btn:hover { border-color: var(--primary); color: var(--primary); }
    .reco-compare-btn:active { transform: scale(0.97); }
    .reco-compare-btn.active {
      background: color-mix(in srgb, var(--primary) 8%, var(--bg));
      border-color: var(--primary);
      color: var(--primary);
    }

    /* ─── EXPANDED PRODUCT DETAILS ─── */
    .reco-expand {
      border-top: 1px solid var(--border);
      margin: 0 14px;
      padding: 10px 0 12px;
      display: none;
      flex-direction: column;
      gap: 8px;
      font-size: 12px;
      color: var(--text);
      line-height: 1.55;
    }
    .reco-expand.open { display: flex; }

    .reco-expand-toggle {
      background: none;
      border: none;
      color: var(--muted);
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      padding: 4px 14px 8px;
      font-family: var(--font);
      text-align: left;
      transition: color 0.18s;
    }
    .reco-expand-toggle:hover { color: var(--text); }

    .reco-expand-section {
      font-weight: 600;
      color: var(--text);
      margin-top: 4px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .reco-expand-text {
      color: var(--muted);
      line-height: 1.55;
    }

    /* ─── COMPARE BAR ─── */
    .compare-bar {
      position: sticky;
      bottom: 0;
      left: 0;
      right: 0;
      background: var(--bg);
      border-top: 1px solid var(--border);
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      animation: compareBarUp 0.25s var(--ease-out);
      z-index: 2;
      margin-top: -1px;
    }

    @keyframes compareBarUp {
      from { transform: translateY(100%); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .compare-bar-info {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--text);
      font-weight: 500;
    }
    .compare-bar-count {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: var(--primary);
      color: var(--on-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
    }

    .compare-bar-btn {
      background: var(--primary);
      color: var(--on-primary);
      border: none;
      border-radius: 999px;
      padding: 10px 20px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      font-family: var(--font);
      transition: filter 0.18s, transform 0.18s;
    }
    .compare-bar-btn:hover { filter: brightness(0.92); }
    .compare-bar-btn:active { transform: scale(0.97); }
    .compare-bar-btn:disabled { opacity: 0.5; cursor: default; transform: none; }

    /* ─── COMPARISON OVERLAY ─── */
    .compare-overlay {
      position: absolute;
      inset: 0;
      background: var(--bg);
      z-index: 10;
      display: flex;
      flex-direction: column;
      animation: compareOverlayIn 0.3s var(--ease-out);
      overflow: hidden;
    }

    @keyframes compareOverlayIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }

    .compare-overlay-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 16px 20px 12px;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }

    .compare-overlay-back {
      background: none;
      border: none;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text);
      font-size: 18px;
      transition: background 0.18s;
    }
    .compare-overlay-back:hover { background: var(--bg-soft); }

    .compare-overlay-title {
      font-size: 16px;
      font-weight: 700;
      color: var(--text);
      flex: 1;
    }

    .compare-overlay-scroll {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      scrollbar-width: none;
    }
    .compare-overlay-scroll::-webkit-scrollbar { display: none; }

    /* Product header row */
    .compare-products-row {
      display: flex;
      gap: 16px;
      margin-bottom: 24px;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
    }
    .compare-products-row::-webkit-scrollbar { display: none; }

    .compare-product-col {
      flex: 1;
      min-width: 220px;
      scroll-snap-align: start;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 8px;
      padding: 16px;
      background: var(--bg-soft);
      border-radius: 18px;
      position: relative;
      animation: compareProductIn 0.3s var(--ease-out) both;
    }
    .compare-product-col:nth-child(2) { animation-delay: 60ms; }

    @keyframes compareProductIn {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .compare-product-img {
      width: 100%;
      height: 140px;
      border-radius: 14px;
      background: var(--bg);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      overflow: hidden;
    }
    .compare-product-img img { width: 100%; height: 100%; object-fit: cover; }

    .compare-product-name {
      font-size: 15px;
      font-weight: 700;
      color: var(--text);
      line-height: 1.3;
    }

    .compare-product-price {
      font-size: 18px;
      font-weight: 800;
      color: var(--primary);
    }

    .compare-product-availability {
      font-size: 11px;
      color: var(--success);
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .compare-product-availability-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--success);
    }

    .compare-product-actions {
      display: flex;
      gap: 6px;
      margin-top: 4px;
    }
    .compare-product-action-btn {
      background: none;
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 5px 12px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      font-family: var(--font);
      color: var(--muted);
      transition: border-color 0.18s, color 0.18s;
    }
    .compare-product-action-btn:hover { border-color: var(--primary); color: var(--primary); }

    .compare-vs {
      display: flex;
      align-items: center;
      font-size: 13px;
      font-weight: 700;
      color: var(--muted);
      padding: 0 4px;
      flex-shrink: 0;
    }

    /* Winner badge */
    .compare-winner-badge {
      position: absolute;
      top: -6px;
      right: -6px;
      background: linear-gradient(135deg, #f59e0b, #f97316);
      color: #fff;
      font-size: 9px;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      animation: badgePop 0.35s var(--ease-out) both;
      animation-delay: 0.3s;
    }
    @keyframes badgePop {
      from { transform: scale(0); }
      60% { transform: scale(1.2); }
      to { transform: scale(1); }
    }

    /* Difference summary */
    .compare-section {
      margin-bottom: 20px;
    }
    .compare-section-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--text);
      margin-bottom: 10px;
    }

    .compare-diff-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .compare-diff-chip {
      background: color-mix(in srgb, var(--primary) 8%, var(--bg));
      color: var(--primary);
      font-size: 11px;
      font-weight: 500;
      padding: 5px 10px;
      border-radius: 999px;
      line-height: 1.3;
      animation: chipIn 0.25s var(--ease-out) both;
    }
    .compare-sim-chip {
      background: var(--bg-soft);
      color: var(--muted);
      font-size: 11px;
      font-weight: 500;
      padding: 5px 10px;
      border-radius: 999px;
      line-height: 1.3;
      animation: chipIn 0.25s var(--ease-out) both;
    }
    @keyframes chipIn {
      from { opacity: 0; transform: scale(0.9); }
      to { opacity: 1; transform: scale(1); }
    }

    /* Compare table */
    .compare-table-wrap {
      background: var(--bg-soft);
      border-radius: 16px;
      overflow: hidden;
      margin-bottom: 20px;
    }

    .compare-data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .compare-data-table th {
      padding: 12px 14px;
      text-align: left;
      font-size: 11px;
      font-weight: 600;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      background: var(--bg);
      border-bottom: 1px solid var(--border);
    }
    .compare-data-table th:first-child { width: 35%; }
    .compare-data-table th:not(:first-child) { text-align: center; width: 32.5%; }

    .compare-data-table td {
      padding: 10px 14px;
      border-bottom: 1px solid var(--border);
      color: var(--text);
      animation: compareRowIn 0.25s var(--ease-out) both;
    }
    .compare-data-table td:not(:first-child) { text-align: center; }
    .compare-data-table tr:last-child td { border-bottom: none; }

    .compare-data-table .compare-winner {
      background: color-mix(in srgb, var(--success) 6%, var(--bg-soft));
    }
    .compare-data-table .compare-winner-value {
      color: var(--success);
      font-weight: 600;
    }

    /* AI Summary */
    .compare-ai-summary {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 16px 18px;
      margin-bottom: 20px;
      line-height: 1.65;
      font-size: 14px;
      color: var(--text);
      animation: msgIn 0.3s var(--ease-out) both;
    }
    .compare-ai-summary strong { color: var(--primary); }

    /* Sticky footer */
    .compare-overlay-footer {
      display: flex;
      gap: 12px;
      padding: 14px 20px;
      border-top: 1px solid var(--border);
      background: var(--bg);
      flex-shrink: 0;
      animation: msgIn 0.25s var(--ease-out);
    }

    .compare-cta {
      flex: 1;
      display: block;
      text-align: center;
      padding: 12px;
      font-size: 13px;
      font-weight: 600;
      color: var(--on-primary);
      background: var(--primary);
      text-decoration: none;
      cursor: pointer;
      border: none;
      border-radius: 999px;
      transition: filter 0.18s, transform 0.18s;
    }
    .compare-cta:hover { filter: brightness(0.92); }
    .compare-cta:active { transform: scale(0.97); }

    /* Loading state */
    .compare-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
      gap: 12px;
      padding: 40px;
      text-align: center;
    }

    .compare-loading-icon {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: color-mix(in srgb, var(--primary) 10%, var(--bg));
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
    }

    .compare-loading-text {
      font-size: 14px;
      color: var(--muted);
      line-height: 1.5;
      animation: pulseText 1.6s ease-in-out infinite;
    }
    @keyframes pulseText {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 1; }
    }

    /* Mobile overlay */
    @media (max-width: 480px) {
      .compare-products-row { flex-direction: column; gap: 12px; }
      .compare-vs { display: none; }
      .compare-product-col { flex-direction: row; text-align: left; padding: 12px; gap: 12px; }
      .compare-product-img { width: 80px; height: 80px; flex-shrink: 0; }
      .compare-product-actions { flex-direction: column; }
      .compare-data-table { font-size: 12px; }
      .compare-data-table th, .compare-data-table td { padding: 8px 10px; }
      .compare-overlay-footer { flex-direction: column; gap: 8px; }
    }

    /* ─── CONTEXT BAR ─── */
    .context-bar {
      background: var(--bg);
      border-top: 1px solid var(--border);
      padding: 10px 16px 8px;
      flex-shrink: 0;
      animation: msgIn 0.2s var(--ease-out);
      display: none;
    }
    .context-bar.open { display: block; }

    .context-bar-header {
      font-size: 11px;
      font-weight: 600;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 6px;
    }

    .context-bar-items {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }

    .context-bar-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: color-mix(in srgb, var(--primary) 8%, var(--bg));
      color: var(--primary);
      font-size: 11px;
      font-weight: 500;
      padding: 4px 10px;
      border-radius: 999px;
      cursor: pointer;
      transition: background 0.15s, transform 0.15s;
      border: none;
      font-family: var(--font);
    }
    .context-bar-chip:hover { background: color-mix(in srgb, var(--primary) 15%, var(--bg)); transform: translateY(-1px); }
    .context-bar-chip:active { transform: scale(0.96); }
    .context-bar-chip .context-bar-chip-remove {
      font-size: 12px;
      opacity: 0.5;
      margin-left: 2px;
    }
    .context-bar-chip:hover .context-bar-chip-remove { opacity: 1; }

    /* ─── DISCOVERY PROGRESS ─── */
    .discovery-progress {
      height: 3px;
      background: var(--bg-soft);
      border-radius: 2px;
      overflow: hidden;
      flex-shrink: 0;
      margin: 0 16px;
      display: none;
    }
    .discovery-progress.open { display: block; }

    .discovery-progress-fill {
      height: 100%;
      background: var(--primary);
      border-radius: 2px;
      transition: width 0.4s var(--ease-out);
      width: 0%;
    }

    /* ─── COMPARE TABLE ─── */
    .compare-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      margin-top: 4px;
    }
    .compare-table th, .compare-table td {
      padding: 8px 10px;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }
    .compare-table th { color: var(--muted); font-weight: 600; font-size: 11px; }
    .compare-table tr:last-child td { border-bottom: none; }

    /* ─── INPUT COMPOSER (Phase 8 Input Bar) ─── */
    .input-area {
      padding: var(--space-2);
      background: var(--bg);
      flex-shrink: 0;
      border-top: 1px solid var(--border);
    }

    .input-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
      background: var(--bg-soft);
      border: 1.5px solid var(--border);
      border-radius: var(--radius-input);
      padding: 0 8px 0 var(--space-2);
      height: var(--input-height);
      transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
    }

    .input-wrap:focus-within {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
      background: var(--bg);
    }

    .input-field {
      flex: 1;
      border: none;
      background: transparent;
      padding: 0;
      color: var(--text);
      font-size: var(--font-body);
      outline: none;
      font-family: var(--font);
      min-width: 0;
      line-height: 1.4;
    }
    .input-field::placeholder { color: var(--muted); }

    .input-smiley-btn {
      width: 28px;
      height: 28px;
      border: none;
      background: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      flex-shrink: 0;
      opacity: 0.5;
      transition: opacity 0.18s;
    }
    .input-smiley-btn:hover { opacity: 1; }

    .input-send-btn {
      width: 40px;
      height: 40px;
      border: none;
      border-radius: 50%;
      background: var(--primary);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: transform 0.18s, filter 0.18s, box-shadow 0.18s;
    }
    .input-send-btn:hover { filter: brightness(0.92); box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3); }
    .input-send-btn:active { transform: scale(0.9); }
    .input-send-btn svg { width: 18px; height: 18px; fill: var(--on-primary); }

    /* ─── FOOTER ─── */
    .footer-brand {
      text-align: center;
      padding: 10px 0;
      font-size: 11px;
      color: var(--muted);
      background: var(--bg);
      border-top: 1px solid var(--border);
      flex-shrink: 0;
    }
    .footer-brand a { color: var(--muted); text-decoration: none; font-weight: 500; transition: color 0.18s; }
    .footer-brand a:hover { color: var(--text); }

    /* ─── WELCOME SCREEN ─── */
    .welcome-screen {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px 16px 8px;
      animation: msgIn 0.3s var(--ease-out);
    }

    .welcome-back-prefix {
      font-size: 20px;
      font-weight: 600;
      color: var(--text);
      margin-bottom: 12px;
      text-align: center;
      line-height: 1.3;
    }

    .welcome-back-explored {
      font-size: 14px;
      color: var(--muted);
      text-align: center;
      line-height: 1.4;
    }

    .welcome-back-category {
      font-size: 26px;
      font-weight: 700;
      color: var(--text);
      text-align: center;
      margin: 6px 0 20px;
      line-height: 1.3;
    }

    .welcome-avatar {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 70%, #000) 100%);
      color: var(--on-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 28px;
      flex-shrink: 0;
      margin-bottom: 16px;
      box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1), 0 8px 24px rgba(37, 99, 235, 0.15);
      animation: welcomeAvatarIn 0.4s var(--ease-out);
    }

    @keyframes welcomeAvatarIn {
      from { opacity: 0; transform: scale(0.85); }
      to { opacity: 1; transform: scale(1); }
    }

    .welcome-title {
      font-size: 22px;
      font-weight: 700;
      color: var(--text);
      text-align: center;
      margin-bottom: 8px;
      line-height: 1.3;
    }

    .welcome-subtitle {
      font-size: 14px;
      color: var(--muted);
      text-align: center;
      line-height: 1.55;
      max-width: 320px;
      margin-bottom: 22px;
    }

    .welcome-card {
      display: flex;
      align-items: center;
      gap: 14px;
      width: 100%;
      min-height: 72px;
      padding: 16px 20px;
      margin-bottom: 10px;
      background: var(--bg);
      border: 1.5px solid var(--border);
      border-radius: 20px;
      cursor: pointer;
      font-family: var(--font);
      text-align: left;
      transition: transform 0.2s var(--ease-out), box-shadow 0.2s, border-color 0.2s, background 0.2s;
      animation: welcomeCardIn 0.35s var(--ease-out) both;
      animation-delay: calc(var(--i, 0) * 60ms);
    }

    .welcome-card:focus-visible {
      outline: 2px solid var(--primary);
      outline-offset: 2px;
    }

    .welcome-card:hover {
      transform: translateY(-2px);
      border-color: var(--primary);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.07);
    }

    .welcome-card:active {
      background: color-mix(in srgb, var(--primary) 6%, var(--bg));
      transform: translateY(0);
    }

    @keyframes welcomeCardIn {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .welcome-card-icon {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--bg-soft);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      flex-shrink: 0;
    }

    .welcome-card-body {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-width: 0;
    }

    .welcome-card-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--text);
      line-height: 1.3;
    }

    .welcome-card-desc {
      font-size: 13px;
      color: var(--muted);
      line-height: 1.4;
    }

    .welcome-suggestions-label {
      font-size: 12px;
      color: var(--muted);
      font-weight: 500;
      margin: 6px 0 10px;
      text-align: center;
      width: 100%;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }

    .welcome-suggestions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px;
      width: 100%;
      padding-bottom: 4px;
    }

    .welcome-suggestion-chip {
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--muted);
      border-radius: 999px;
      padding: 7px 14px;
      font-size: 12.5px;
      font-weight: 500;
      cursor: pointer;
      font-family: var(--font);
      transition: background 0.18s, border-color 0.18s, color 0.18s;
    }
    .welcome-suggestion-chip:hover {
      background: var(--bg-soft);
      border-color: var(--primary);
      color: var(--text);
    }

    /* ─── EMPTY CONVERSATION ─── */
    .empty-conversation {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
      padding: 48px 24px;
      animation: msgIn 0.3s var(--ease-out);
    }

    .empty-conversation-icon {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--bg-soft);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      margin-bottom: 16px;
    }

    .empty-conversation-title {
      font-size: 18px;
      font-weight: 600;
      color: var(--text);
      text-align: center;
      margin-bottom: 6px;
    }

    .empty-conversation-subtitle {
      font-size: 14px;
      color: var(--muted);
      text-align: center;
      line-height: 1.55;
      max-width: 280px;
    }

    /* ─── MEMORY STRIP ─── */
    .memory-strip {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 14px 16px;
      margin-bottom: 16px;
      animation: msgIn 0.3s var(--ease-out);
      flex-shrink: 0;
    }

    .memory-header {
      font-size: 12px;
      font-weight: 600;
      color: var(--muted);
      margin-bottom: 8px;
      letter-spacing: 0.02em;
    }

    .memory-items {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .memory-item {
      font-size: 13px;
      color: var(--text);
      line-height: 1.5;
    }

    .memory-item-empty {
      font-size: 12px;
      color: var(--muted);
      font-style: italic;
      line-height: 1.5;
    }

    .memory-edit {
      background: none;
      border: none;
      color: var(--primary);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      padding: 6px 0 0;
      font-family: var(--font);
      transition: opacity 0.18s;
    }
    .memory-edit:hover { opacity: 0.75; text-decoration: underline; }

    /* ─── LOADING SKELETON ─── */
    .skeleton {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 16px;
      background: var(--bg);
      border-radius: var(--radius-lg);
      box-shadow: var(--bubble-shadow);
      align-self: flex-start;
      max-width: 82%;
      margin-bottom: 10px;
      animation: msgIn 0.25s var(--ease-out) both;
    }

    .skeleton-line {
      height: 12px;
      border-radius: 6px;
      background: linear-gradient(90deg, var(--bg-soft) 25%, color-mix(in srgb, var(--primary) 8%, var(--bg)) 50%, var(--bg-soft) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.6s infinite;
    }
    .skeleton-line:first-child { width: 75%; }
    .skeleton-line:nth-child(2) { width: 55%; }
    .skeleton-line:nth-child(3) { width: 85%; }

    .skeleton-card {
      width: 170px;
      height: 200px;
      border-radius: var(--radius-md);
      background: linear-gradient(90deg, var(--bg-soft) 25%, color-mix(in srgb, var(--primary) 8%, var(--bg)) 50%, var(--bg-soft) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.6s infinite;
      flex-shrink: 0;
    }

    .skeleton-cards {
      display: flex;
      gap: 12px;
      padding: 4px 0;
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* ─── ERROR BUBBLE ─── */
    .error-bubble {
      background: var(--bg);
      border: 1px solid rgba(239, 68, 68, 0.2);
      border-radius: var(--radius-lg);
      padding: 16px 18px;
      align-self: flex-start;
      max-width: 82%;
      margin-bottom: 10px;
      animation: msgIn 0.25s var(--ease-out) both;
    }

    .error-icon {
      font-size: 20px;
      margin-bottom: 6px;
    }

    .error-text {
      font-size: 14px;
      color: var(--text);
      line-height: 1.6;
      margin-bottom: 10px;
    }

    .error-retry-btn {
      background: var(--primary);
      color: var(--on-primary);
      border: none;
      border-radius: var(--radius-full);
      padding: 8px 18px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      font-family: var(--font);
      transition: filter 0.18s;
    }
    .error-retry-btn:hover { filter: brightness(0.92); }

    /* ─── COMPARE PLACEHOLDER ─── */
    .compare-placeholder {
      background: var(--bg);
      border: 1px dashed var(--border);
      border-radius: var(--radius-lg);
      padding: 16px 18px;
      align-self: flex-start;
      max-width: 82%;
      margin-bottom: 10px;
      animation: msgIn 0.25s var(--ease-out) both;
    }

    .compare-placeholder-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text);
      margin-bottom: 8px;
    }

    .compare-placeholder-row {
      display: flex;
      gap: 12px;
      margin-top: 8px;
    }

    .compare-placeholder-item {
      flex: 1;
      padding: 10px 12px;
      background: var(--bg-soft);
      border-radius: var(--radius-sm);
      font-size: 13px;
      color: var(--muted);
      text-align: center;
    }

    .compare-placeholder-btn {
      margin-top: 10px;
      background: var(--primary);
      color: var(--on-primary);
      border: none;
      border-radius: var(--radius-full);
      padding: 8px 18px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      font-family: var(--font);
      transition: filter 0.18s;
    }
    .compare-placeholder-btn:hover { filter: brightness(0.92); }

    /* ─── TYPING INDICATOR ─── */
    .typing {
      display: flex;
      gap: 10px;
      align-self: flex-start;
      animation: msgIn 0.26s var(--ease-out);
      margin-bottom: 12px;
    }

    .typing-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 70%, #000) 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      flex-shrink: 0;
    }

    .typing-content {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .typing-text {
      font-size: 13px;
      color: var(--muted);
      line-height: 1.4;
    }

    .typing-dots {
      display: flex;
      gap: 4px;
      padding: 2px 0;
    }

    .typing-dot {
      width: 6px;
      height: 6px;
      background: var(--muted);
      border-radius: 50%;
      animation: dotPulse 1.4s infinite ease-in-out;
    }
    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot:nth-child(3) { animation-delay: 0.4s; }

    @keyframes dotPulse {
      0%, 80%, 100% { transform: scale(0.5); opacity: 0.3; }
      40% { transform: scale(1); opacity: 1; }
    }

    /* ─── MOBILE ─── */
    @media (max-width: 480px) {
      .fab {
        bottom: 16px;
        right: 16px;
      }
      .fab-inner { padding: 12px 16px; gap: 8px; }
      .fab-text-top { font-size: 12px; }
      .fab-text-bot { font-size: 14px; }

      .chat-panel {
        top: auto;
        bottom: 0;
        left: 0;
        right: 0;
        width: 100%;
        height: 88vh;
        max-width: 100vw;
        border-radius: 24px 24px 0 0;
        transform: translateY(100%);
        opacity: 1;
      }

      .chat-panel.open {
        transform: translateY(0);
      }

      .chat-panel::before {
        content: '';
        position: absolute;
        top: 8px;
        left: 50%;
        transform: translateX(-50%);
        width: 36px;
        height: 4px;
        border-radius: 2px;
        background: var(--border);
        z-index: 1;
      }

      .header { padding-top: 24px; }

      .body { padding: 16px 16px; }

      .input-area { padding: 10px 12px; }

      .msg-row { max-width: 88%; }
      .customer .msg-bubble { max-width: 85%; }
    }

    @keyframes cardSlideIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes badgePop {
      0% { transform: scale(0); }
      70% { transform: scale(1.15); }
      100% { transform: scale(1); }
    }
    .business-card {
      background: #fff; border: 1px solid #e8ecf0; border-radius: 16px;
      padding: 16px; margin: 8px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.04);
      animation: cardSlideIn 0.3s ease-out;
    }
    .business-card-header {
      display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
    }
    .business-card-icon { font-size: 20px; line-height: 1; }
    .business-card-title {
      font-size: 14px; font-weight: 600; color: #0a1c0f;
    }
    .business-card-body {
      font-size: 13px; color: #3a4a42; line-height: 1.55;
    }
    .business-card-list {
      list-style: none; padding: 0; margin: 6px 0 0;
    }
    .business-card-list li {
      padding: 5px 0; font-size: 13px; color: #0a1c0f;
      display: flex; align-items: center; gap: 6px;
    }
    .business-card-list li::before {
      content: '\\2713'; color: var(--primary); font-weight: 700;
    }
    .business-card-link {
      display: inline-block; margin-top: 8px; font-size: 13px;
      color: var(--primary); font-weight: 500; cursor: pointer;
      text-decoration: none;
    }
    .business-card-link:hover { text-decoration: underline; }
    .verified-badge {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 11px; color: #1a7d36; background: #e8f5ee;
      padding: 3px 10px; border-radius: 999px; font-weight: 500;
      margin: 6px 0 4px; animation: badgePop 0.35s ease-out;
    }
    .contact-card {
      background: #fff; border: 1px solid #e8ecf0; border-radius: 16px;
      padding: 20px 16px; margin: 8px 0; text-align: center;
      animation: cardSlideIn 0.3s ease-out;
    }
    .contact-card-title {
      font-size: 14px; font-weight: 600; color: #0a1c0f; margin-bottom: 4px;
    }
    .contact-card-subtitle {
      font-size: 12px; color: #6b7a72; margin-bottom: 16px;
    }
    .contact-card-actions { display: flex; gap: 10px; justify-content: center; }
    .contact-btn {
      flex: 1; display: flex; flex-direction: column; align-items: center;
      gap: 4px; padding: 12px 8px; border-radius: 12px;
      border: 1px solid #e8ecf0; background: #f8faf9; cursor: pointer;
      font-size: 12px; color: #0a1c0f; font-weight: 500;
      transition: all 0.2s; text-decoration: none; font-family: inherit;
    }
    .contact-btn:hover { background: #edf1ef; border-color: #d0d8d4; }
    .contact-btn-icon { font-size: 22px; }
    .contact-btn-label { font-size: 11px; }
    .hours-card {
      background: #fff; border: 1px solid #e8ecf0; border-radius: 16px;
      padding: 16px; margin: 8px 0; animation: cardSlideIn 0.3s ease-out;
    }
    .hours-row { display: flex; justify-content: space-between; align-items: center; }
    .hours-status { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; }
    .hours-status.open { color: #1a7d36; }
    .hours-status.closed { color: #c62828; }
    .hours-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    .hours-dot.open { background: #2e7d32; box-shadow: 0 0 6px rgba(46,125,50,0.4); }
    .hours-dot.closed { background: #c62828; }
    .hours-today { font-size: 13px; color: #3a4a42; margin-top: 6px; }
    .faq-accordion { margin: 8px 0; animation: cardSlideIn 0.3s ease-out; }
    .faq-item {
      background: #fff; border: 1px solid #e8ecf0; border-radius: 12px;
      margin-bottom: 6px; overflow: hidden;
    }
    .faq-question {
      width: 100%; padding: 12px 14px; border: none; background: none;
      font-size: 13px; font-weight: 500; color: #0a1c0f; cursor: pointer;
      display: flex; justify-content: space-between; align-items: center;
      font-family: inherit; text-align: left;
    }
    .faq-question::after { content: '+'; font-size: 16px; color: #8a9a92; transition: transform 0.2s; }
    .faq-item.open .faq-question::after { content: '\\2212'; }
    .faq-answer {
      max-height: 0; overflow: hidden;
      transition: max-height 0.25s ease, padding 0.25s ease;
    }
    .faq-item.open .faq-answer { max-height: 200px; padding: 0 14px 12px; }
    .faq-answer-text { font-size: 13px; color: #3a4a42; line-height: 1.5; }
    .escalation-card {
      background: linear-gradient(135deg, #fef9e7 0%, #fdf2d7 100%);
      border: 1px solid #f0e2b5; border-radius: 16px; padding: 20px 16px;
      margin: 8px 0; text-align: center; animation: cardSlideIn 0.3s ease-out;
    }
    .escalation-card-title {
      font-size: 15px; font-weight: 600; color: #7a5a0a; margin-bottom: 4px;
    }
    .escalation-card-subtitle {
      font-size: 12px; color: #8a7a4a; margin-bottom: 16px;
    }
    .escalation-actions { display: flex; gap: 10px; justify-content: center; }
    .escalation-btn {
      flex: 1; display: flex; flex-direction: column; align-items: center;
      gap: 4px; padding: 12px 8px; border-radius: 12px; border: none;
      cursor: pointer; font-size: 12px; font-weight: 500; color: #fff;
      transition: transform 0.2s, box-shadow 0.2s;
      text-decoration: none; font-family: inherit;
    }
    .escalation-btn:hover { transform: translateY(-1px); box-shadow: 0 2px 8px rgba(0,0,0,0.12); }
    .escalation-btn-whatsapp { background: #25D366; }
    .escalation-btn-call { background: #0a1c0f; }
    .escalation-btn-email { background: #1a73e8; }
    .escalation-btn-icon { font-size: 20px; }
    .business-unknown-card {
      background: #fff; border: 1px solid #e8ecf0; border-radius: 16px;
      padding: 20px 16px; margin: 8px 0; text-align: center;
      animation: cardSlideIn 0.3s ease-out;
    }
    .business-unknown-text {
      font-size: 13px; color: #3a4a42; line-height: 1.5; margin-bottom: 16px;
    }
    .business-unknown-actions { display: flex; gap: 10px; justify-content: center; }
    .policy-card {
      background: #fff; border: 1px solid #e8ecf0; border-radius: 12px;
      padding: 14px; margin: 6px 0; cursor: pointer; display: flex;
      align-items: center; justify-content: space-between;
      animation: cardSlideIn 0.3s ease-out;
    }
    .policy-card-text { font-size: 13px; font-weight: 500; color: #0a1c0f; display: flex; align-items: center; gap: 8px; }
    .policy-card-arrow { color: #8a9a92; font-size: 14px; transition: transform 0.2s; }
    .policy-card.open .policy-card-arrow { transform: rotate(90deg); }
    .continue-cta { margin: 10px 0 4px; text-align: center; }
    .continue-cta-btn {
      background: var(--primary); color: var(--on-primary); border: none;
      border-radius: 999px; padding: 10px 24px; font-size: 13px;
      font-weight: 600; cursor: pointer; font-family: inherit;
      transition: opacity 0.2s, transform 0.2s;
    }
    .continue-cta-btn:hover { opacity: 0.9; transform: translateY(-1px); }
    .escalation-message {
      font-size: 13px; color: #3a4a42; line-height: 1.55; padding: 4px 0; margin: 4px 0;
    }
    .contact-methods { display: flex; flex-direction: column; gap: 8px; margin: 8px 0; }
    .contact-method-card {
      display: flex; align-items: center; gap: 12px; padding: 14px 16px;
      border-radius: 14px; text-decoration: none; cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      animation: cardSlideIn 0.3s ease-out;
    }
    .contact-method-card:hover { transform: translateY(-1px); box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .contact-method-card.whatsapp { background: #eafff0; border: 1px solid #b8e6c8; }
    .contact-method-card.phone { background: #e8f0ff; border: 1px solid #b8cce6; }
    .contact-method-card.email { background: #f8faf9; border: 1px solid #dde3e0; }
    .contact-method-card.disabled { opacity: 0.5; cursor: default; pointer-events: none; }
    .contact-method-card-icon { font-size: 24px; line-height: 1; }
    .contact-method-card-label { font-size: 14px; font-weight: 500; color: #0a1c0f; }
    .contact-method-card-badge {
      margin-left: auto; font-size: 11px; color: #8a9a92;
      background: #f0f2f1; padding: 2px 10px; border-radius: 999px;
    }
    .conversation-summary {
      background: #f8faf9; border: 1px solid #e8ecf0; border-radius: 14px;
      padding: 14px; margin: 8px 0; animation: cardSlideIn 0.3s ease-out;
    }
    .conversation-summary-title {
      font-size: 12px; font-weight: 600; color: #6b7a72;
      text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;
    }
    .summary-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 6px 0; border-bottom: 1px solid #edf1ef;
    }
    .summary-row:last-child { border-bottom: none; }
    .summary-label { font-size: 12px; color: #6b7a72; }
    .summary-value { font-size: 13px; font-weight: 500; color: #0a1c0f; text-align: right; }
    .availability-card {
      background: #fff; border: 1px solid #e8ecf0; border-radius: 14px;
      padding: 14px; margin: 8px 0; display: flex; gap: 16px;
      animation: cardSlideIn 0.3s ease-out;
    }
    .availability-item { flex: 1; }
    .availability-label { font-size: 11px; color: #8a9a92; display: block; margin-bottom: 2px; }
    .availability-value { font-size: 13px; color: #0a1c0f; font-weight: 500; }
    .escalation-closing {
      text-align: center; padding: 12px 0; margin: 4px 0;
      animation: cardSlideIn 0.3s ease-out;
    }
    .escalation-closing-title { font-size: 15px; font-weight: 600; color: #0a1c0f; margin-bottom: 4px; }
    .escalation-closing-sub { font-size: 12px; color: #6b7a72; }
    .escalation-actions-bottom { display: flex; gap: 8px; margin: 12px 0 4px; }
    .escalation-action-btn {
      flex: 1; padding: 10px 8px; border-radius: 12px; border: 1px solid #e8ecf0;
      background: #fff; font-size: 12px; font-weight: 500; color: #0a1c0f;
      cursor: pointer; font-family: inherit;
      transition: background 0.2s, transform 0.2s;
    }
    .escalation-action-btn:hover { background: #f8faf9; transform: translateY(-1px); }
    .streaming-text::after { content: '|'; animation: blink 0.7s steps(1) infinite; margin-left: 1px; }
    @keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
    .btn-press:active { transform: scale(0.97) !important; }
    .ripple { position: relative; overflow: hidden; }
    .ripple::after {
      content: ''; position: absolute; border-radius: 50%;
      background: rgba(255,255,255,0.35); width: 100px; height: 100px;
      margin-top: -50px; margin-left: -50px; top: 50%; left: 50%;
      transform: scale(0); opacity: 1; pointer-events: none;
    }
    .ripple:active::after { transform: scale(2.5); opacity: 0; transition: transform 0.5s, opacity 0.5s; }
    .success-celebration { text-align: center; padding: 16px 0; animation: cardSlideIn 0.4s ease-out; }
    .success-icon { font-size: 36px; margin-bottom: 6px; }
    .success-title { font-size: 15px; font-weight: 600; color: #0a1c0f; margin-bottom: 2px; }
    .success-sub { font-size: 13px; color: #3a4a42; }
    .checkout-card {
      background: #fff; border: 1px solid #e8ecf0; border-radius: 16px;
      padding: 16px; margin: 8px 0; display: flex; align-items: center;
      gap: 12px; animation: cardSlideIn 0.3s ease-out;
    }
    .checkout-img { width: 60px; height: 60px; border-radius: 8px; object-fit: cover; background: #f0f2f1; flex-shrink: 0; }
    .checkout-info { flex: 1; min-width: 0; }
    .checkout-name { font-size: 14px; font-weight: 600; color: #0a1c0f; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .checkout-price { font-size: 15px; font-weight: 700; color: var(--primary); margin-top: 2px; }
    .checkout-actions { display: flex; gap: 8px; margin: 10px 0 4px; }
    .premium-footer { text-align: center; padding: 14px 0 6px; margin-top: 4px; }
    .premium-footer-text { font-size: 11px; color: var(--muted); }
    .premium-footer-brand { font-weight: 600; }
    *:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; border-radius: 4px; }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
      .back-to-top { transition: none; }
    }
  `;

    // Create Shadow Host & Attach Shadow Root
    const container = document.createElement('div');
    container.id = 'midevela-widget-container';
    document.body.appendChild(container);

    const shadow = container.attachShadow({ mode: 'open' });
    const wrapper = document.createElement('div');
    const style = document.createElement('style');
    style.textContent = styleText;
    shadow.appendChild(style);
    shadow.appendChild(wrapper);

    wrapper.innerHTML = `
    <button class="back-to-top" id="midevela-btt" aria-label="Back to top">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
    </button>

    <button class="fab" id="midevela-fab" aria-label="Toggle shopping assistant chat">
      <div class="fab-pulse-ring"></div>
      <span class="fab-icon">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/></svg>
      </span>
      <span class="fab-close-icon">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.3 5.71L12 12l6.3 6.29a1 1 0 11-1.42 1.42L12 13.41l-5.88 5.89a1 1 0 01-1.42-1.42L10.59 12 4.7 5.71a1 1 0 011.42-1.42L12 10.59l5.88-5.88a1 1 0 111.42 1.42z"/></svg>
      </span>
    </button>

    <div class="backdrop" id="midevela-backdrop"></div>

      <div class="chat-panel" id="midevela-chat" role="dialog" aria-label="Shopping assistant chat">
      <div class="header">
        <div class="header-top">
          <div class="header-info">
            <div class="header-avatar" aria-hidden="true">${escapeHtml(avatarLetter)}</div>
            <div>
              <div class="header-name">${escapeHtml(aiName)}</div>
              <div class="header-subtitle">Helping you shop smarter</div>
            </div>
          </div>
          <div class="header-actions">
            <button class="header-btn minimize-btn" id="midevela-minimize" aria-label="Minimize chat">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 13H5v-2h14v2z"/></svg>
            </button>
            <button class="header-btn close-btn" id="midevela-close" aria-label="Close chat">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.3 5.71L12 12l6.3 6.29a1 1 0 11-1.42 1.42L12 13.41l-5.88 5.89a1 1 0 01-1.42-1.42L10.59 12 4.7 5.71a1 1 0 011.42-1.42L12 10.59l5.88-5.88a1 1 0 111.42 1.42z"/></svg>
            </button>
          </div>
        </div>
        <div class="header-divider"></div>
      </div>

      <div class="body" id="midevela-body" role="log" aria-label="Messages" aria-live="polite" aria-relevant="additions"></div>

      <div class="discovery-progress" id="midevela-discovery-progress">
        <div class="discovery-progress-fill" id="midevela-discovery-progress-fill"></div>
      </div>

      <div class="context-bar" id="midevela-context-bar">
        <div class="context-bar-header">Shopping For</div>
        <div class="context-bar-items" id="midevela-context-items"></div>
      </div>

      <div class="input-area">
        <div class="input-wrap">
          <button class="input-smiley-btn" aria-label="Insert emoji" type="button">${icon('smile')}</button>
          <input type="text" class="input-field" id="midevela-input" maxlength="2000" placeholder="Ask anything\u2026" aria-label="Type your message" autocomplete="off">
          <button class="input-send-btn" id="midevela-send" aria-label="Send message">
            <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>
      </div>

      <div class="footer-brand premium-footer">
        <span class="premium-footer-text">Powered by <strong class="premium-footer-brand">Midevela AI</strong> &mdash; Helping you shop smarter.</span>
      </div>
    </div>
  `;

    const fab = shadow.getElementById('midevela-fab');
    const chat = shadow.getElementById('midevela-chat');
    const close = shadow.getElementById('midevela-close');
    const minimize = shadow.getElementById('midevela-minimize');
    const backdrop = shadow.getElementById('midevela-backdrop');
    const input = shadow.getElementById('midevela-input');
    const send = shadow.getElementById('midevela-send');
    const body = shadow.getElementById('midevela-body');
    const contextBar = shadow.getElementById('midevela-context-bar');
    const contextItems = shadow.getElementById('midevela-context-items');
    const progressBar = shadow.getElementById('midevela-discovery-progress');
    const progressFill = shadow.getElementById('midevela-discovery-progress-fill');
    const backToTop = shadow.getElementById('midevela-btt');

    // ─── Panel open/close ───
    const toggleChat = (focusInput) => {
      const isOpen = chat.classList.toggle('open');
      fab.classList.toggle('open', isOpen);
      // Hide Back to Top while chat is open to avoid overlap
      if (isOpen) {
        backToTop.classList.remove('visible');
        trackEvent('widget_opened', { view: funnel.view });
        if (focusInput && funnel.view === 'conversation') input.focus();
      } else {
        clearInterval(stateRotationTimer);
        updateBackToTop();
        markAutoOpened();
        trackEvent('widget_dismissed', { view: funnel.view });
        persistFunnel();
      }
    };

    // ─── Back to Top ───
    function updateBackToTop() {
      if (chat.classList.contains('open')) {
        backToTop.classList.remove('visible');
        return;
      }
      if (window.scrollY > 10) {
        backToTop.classList.add('visible');
      } else {
        backToTop.classList.remove('visible');
      }
    }

    var ticking = false;
    window.addEventListener('scroll', function () {
      if (!ticking) {
        window.requestAnimationFrame(function () {
          updateBackToTop();
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });

    backToTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    fab.addEventListener('click', () => toggleChat(true));
    close.addEventListener('click', () => toggleChat(true));
    if (minimize) minimize.addEventListener('click', () => toggleChat(true));
    backdrop.addEventListener('click', () => toggleChat(true));

    // ─── Persistence ───
    function persistFunnel() {
      saveFunnelState({
        view: funnel.view,
        categoryId: funnel.categoryId,
        categoryName: funnel.categoryName,
        answers: funnel.answers,
      });
    }

    // ─── Shared render helpers ───
    function clearBody() {
      body.innerHTML = '';
    }

    function scrollToBottom() {
      body.scrollTo({ top: body.scrollHeight, behavior: 'smooth' });
    }

    function scrollToBottomInstant() {
      body.scrollTop = body.scrollHeight;
    }

    function appendAiBubble(text, extraHTML, typewriter) {
      var lastChild = body.lastElementChild;
      var isGrouped = false;
      if (lastChild && lastChild.classList.contains('msg-row') && lastChild.classList.contains('ai')) {
        var lastCol = lastChild.querySelector('.msg-col');
        if (lastCol && !lastChild.querySelector('.reco-container') && !lastChild.querySelector('.chips')) {
          var lastBubble = lastCol.querySelector('.msg-bubble');
          var lastTime = lastCol.querySelector('.msg-time');
          if (lastTime) lastTime.remove();
          if (lastBubble) {
            if (typewriter) {
              lastBubble.textContent += '\n\n';
              typewriterText(lastBubble, text, 18);
            } else {
              lastBubble.textContent += '\n\n' + text;
            }
          }
          var newTime = document.createElement('span');
          newTime.className = 'msg-time';
          newTime.textContent = nowTime();
          lastCol.appendChild(newTime);
          isGrouped = true;
        }
      }

      if (!isGrouped) {
        var row = document.createElement('div');
        row.className = 'msg-row ai';
        var avatar = document.createElement('div');
        avatar.className = 'msg-avatar';
        avatar.innerHTML = icon('leaf');
        var col = document.createElement('div');
        col.className = 'msg-col';
        var sender = document.createElement('div');
        sender.className = 'msg-sender';
        sender.textContent = aiName;
        col.appendChild(sender);
        var bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        if (typewriter) {
          col.appendChild(bubble);
          row.appendChild(avatar);
          row.appendChild(col);
          body.appendChild(row);
          typewriterText(bubble, text, 18);
          var time = document.createElement('span');
          time.className = 'msg-time';
          time.textContent = nowTime();
          col.appendChild(time);
          return row;
        } else {
          bubble.textContent = text;
        }
        col.appendChild(bubble);
        if (extraHTML) {
          var extra = document.createElement('div');
          extra.innerHTML = extraHTML;
          col.appendChild(extra);
        }
        var time = document.createElement('span');
        time.className = 'msg-time';
        time.textContent = nowTime();
        col.appendChild(time);
        row.appendChild(avatar);
        row.appendChild(col);
        body.appendChild(row);
      }
      return lastChild || body.lastElementChild;
    }

    function appendCustomerBubble(text) {
      var row = document.createElement('div');
      row.className = 'msg-row customer';
      var col = document.createElement('div');
      col.className = 'msg-col';
      var bubble = document.createElement('div');
      bubble.className = 'msg-bubble';
      bubble.textContent = text;
      col.appendChild(bubble);
      var time = document.createElement('span');
      time.className = 'msg-time';
      time.textContent = nowTime();
      col.appendChild(time);
      row.appendChild(col);
      body.appendChild(row);
    }

    function appendTyping(contextText) {
      removeTyping();
      var el = document.createElement('div');
      el.id = 'midevela-typing';
      el.className = 'typing';
      el.innerHTML =
        '<div class="typing-avatar">' + icon('leaf') + '</div>' +
        '<div class="typing-content">' +
          '<span class="typing-text">' + escapeHtml(contextText || aiName + ' is thinking\u2026') + '</span>' +
          '<span class="typing-dots">' +
            '<span class="typing-dot"></span>' +
            '<span class="typing-dot"></span>' +
            '<span class="typing-dot"></span>' +
          '</span>' +
        '</div>';
      body.appendChild(el);
    }

    function removeTyping() {
      clearInterval(stateRotationTimer);
      var el = shadow.getElementById('midevela-typing');
      if (el) el.remove();
    }

    // ─── AI Memory Strip ───
    // Displays what the assistant knows about the customer, auto-updates
    // as new information is collected.
    var memoryStripEl = null;
    function renderMemoryStrip() {
      removeMemoryStrip();
      var strip = document.createElement('div');
      strip.id = 'midevela-memory';
      strip.className = 'memory-strip';
      strip.innerHTML = '<div class="memory-header">' + icon('sparkle') + ' Here\'s what I know</div><div class="memory-items" id="midevela-memory-items"></div>';
      var container = strip.querySelector('#midevela-memory-items');
      renderMemoryItems(container);
      var editBtn = document.createElement('button');
      editBtn.className = 'memory-edit';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', function () {
        funnel.answers = {};
        funnel.categoryId = null;
        funnel.categoryName = null;
        persistFunnel();
        renderWelcome();
        trackEvent('memory_edit_clicked', {});
      });
      strip.appendChild(editBtn);
      body.insertBefore(strip, body.firstChild);
      memoryStripEl = strip;
    }

    function removeMemoryStrip() {
      var el = shadow.getElementById('midevela-memory');
      if (el) {
        el.remove();
        memoryStripEl = null;
      }
    }

    function updateMemoryStrip() {
      if (!memoryStripEl) return;
      var container = shadow.getElementById('midevela-memory-items');
      if (container) renderMemoryItems(container);
    }

    function renderMemoryItems(container) {
      var items = [];
      if (funnel.categoryName) items.push('Looking for ' + funnel.categoryName);
      var knownLabels = {
        budget: 'Budget',
        brand: 'Preferred brand',
        skinType: 'Skin type',
        hairType: 'Hair type',
        concern: 'Concern',
        size: 'Size preference',
      };
      Object.keys(funnel.answers).forEach(function (k) {
        var label = knownLabels[k] || k;
        var val = funnel.answers[k];
        var display = typeof val === 'string' ? val.replace(/-/g, ' ') : val;
        // Convert slug-like values to readable text
        display = display.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
        items.push(label + ': ' + display);
      });
      if (items.length === 0) {
        container.innerHTML = '<div class="memory-item-empty">No details yet — tell me what you\'re looking for!</div>';
        return;
      }
      container.innerHTML = items.map(function (item) {
        return '<div class="memory-item">' + icon('check') + ' ' + escapeHtml(item) + '</div>';
      }).join('');
    }

    // ─── Context-aware Suggestion Chips ───
    function renderSuggestionChips(chips) {
      var wrap = document.createElement('div');
      wrap.className = 'chips';
      chips.forEach(function (chip) {
        var el = document.createElement('button');
        el.type = 'button';
        el.className = 'chip';
        el.innerHTML = (chip.icon || '') + (chip.icon ? ' ' : '') + escapeHtml(chip.label);
        el.addEventListener('click', function () { chip.action(); });
        wrap.appendChild(el);
      });
      body.appendChild(wrap);
      scrollToBottom();
      return wrap;
    }

    // ─── Conversation State ───
    // Different loading text depending on what the AI is doing
    var stateTexts = {
      thinking: '{name} is thinking\u2026',
      searching: 'Searching products\u2026',
      comparing: 'Comparing products\u2026',
      answering: 'Looking through our knowledge base\u2026',
      recommending: 'Putting together the best options\u2026',
    };

    var stateRotations = {
      thinking: ['Looking through our catalog\u2026', 'Checking product details\u2026', 'Finding the best match\u2026'],
      searching: ['Searching products\u2026', 'Checking availability\u2026', 'Comparing options\u2026'],
      comparing: ['Comparing products\u2026', 'Finding differences\u2026', 'Almost done\u2026'],
      answering: ['Looking through our knowledge base\u2026', 'Verifying information\u2026', 'Putting it together\u2026'],
      recommending: ['Curating the best options\u2026', 'Checking what fits\u2026', 'Finalizing recommendations\u2026'],
    };
    var stateRotationTimer = null;

    function showState(stateKey) {
      var rotations = stateRotations[stateKey] || stateRotations.thinking;
      var idx = 0;
      appendTyping(rotations[0].replace('{name}', aiName));
      scrollToBottom();
      clearInterval(stateRotationTimer);
      stateRotationTimer = setInterval(function () {
        idx = (idx + 1) % rotations.length;
        var el = shadow.getElementById('midevela-typing');
        if (el) {
          var textEl = el.querySelector('.typing-text');
          if (textEl) textEl.textContent = rotations[idx].replace('{name}', aiName);
        }
      }, 2000);
    }

    // ─── Natural Response Helpers ───
    // Conversational text templates that replace robotic prompts
    function naturalGreeting() {
      return 'Hi there! I\u2019m ' + aiName + ', your AI shopping assistant. I can help you find the perfect products, answer questions about our store, and make your shopping experience easy.';
    }

    function naturalAskCategory() {
      return 'What type of product are you looking for today?';
    }

    function naturalAcknowledgeCategory(catName) {
      return 'Great choice! Let\u2019s find the best ' + catName.toLowerCase() + ' for you.';
    }

    function naturalAskBudget() {
      return 'What\u2019s your budget? That helps me avoid recommending products outside your price range.';
    }

    function naturalAskBrand() {
      return 'Do you have a preferred brand? If not, I\u2019ll show you the best options available.';
    }

    function naturalAskSkinType() {
      return 'What\u2019s your skin type? This helps me recommend products that will work best for you.';
    }

    function naturalAskHairType() {
      return 'What\u2019s your hair type? This helps me find the right match.';
    }

    function naturalNoProducts() {
      return 'I couldn\u2019t find an exact match for that just yet. Let\u2019s try a different approach \u2014 what else can I help with?';
    }

    function naturalRecommendationIntro() {
      var items = [];
      if (funnel.categoryName) items.push('fit your interest in ' + funnel.categoryName.toLowerCase());
      if (funnel.answers.budget) items.push('fit your budget');
      if (funnel.answers.brand) items.push('match ' + funnel.answers.brand);
      if (funnel.answers.skinType) items.push('suit ' + funnel.answers.skinType.replace(/_/g, ' ') + ' skin');
      if (items.length === 0) {
        return 'Based on what you\u2019ve told me, here are the products I\u2019d recommend:';
      }
      return 'Based on what you\u2019ve told me, these are the products I\u2019d recommend. I chose them because they ' + items.join(', ') + ':';
    }

    function naturalComparison() {
      return 'Here\u2019s how they compare:';
    }

    function naturalFollowUp() {
      return 'Would you like to compare them, see cheaper options, learn more about a product, or ask something else?';
    }

    function naturalWelcomeBack(catName) {
      return 'Welcome back! You were exploring ' + catName + ' last time. Would you like to continue where you left off?';
    }

    function naturalResumeQualification(catName) {
      return 'Picking back up on ' + catName + ' \u2014 let\u2019s continue finding the perfect product for you.';
    }

    // ─── Intent Parser ───
    // Extracts known information from free-text messages so the AI
    // never asks for something the customer already provided.
    var discoveryFields = [
      { key: 'concern', words: ['acne', 'dryness', 'dry skin', 'oily', 'dark spots', 'wrinkles', 'aging', 'sensitive', 'hydration', 'brightening', 'dandruff', 'frizz', 'damage', 'breakage', 'thinning'] },
      { key: 'productType', words: ['serum', 'moisturizer', 'cleanser', 'toner', 'sunscreen', 'shampoo', 'conditioner', 'oil', 'mask', 'cream', 'lotion', 'treatment'] },
      { key: 'budget', words: ['under \$?(\d+)', 'budget \$?(\d+)', 'less than \$?(\d+)', 'cheap', 'affordable', 'inexpensive', 'premium', 'luxury'] },
      { key: 'skinType', words: ['dry skin', 'oily skin', 'combination', 'sensitive skin', 'normal skin'] },
      { key: 'brand', words: ['from (\w+)\b', 'by (\w+)\b', 'brand (\w+)\b'] },
    ];

    function parseIntent(text) {
      var lower = text.toLowerCase();
      var extracted = {};

      // Category matching (match against available categories)
      if (config.categories) {
        config.categories.forEach(function (cat) {
          var catLower = cat.name.toLowerCase();
          if (lower.indexOf(catLower) !== -1) {
            extracted.categoryId = cat.id;
            extracted.categoryName = cat.name;
          }
        });
      }

      // Product type
      var typeMap = {
        serum: 'Serum', moisturizer: 'Moisturizer', cleanser: 'Cleanser',
        toner: 'Toner', sunscreen: 'Sunscreen', shampoo: 'Shampoo',
        conditioner: 'Conditioner', oil: 'Oil', mask: 'Mask',
        cream: 'Cream', lotion: 'Lotion', treatment: 'Treatment',
      };
      Object.keys(typeMap).forEach(function (type) {
        if (lower.indexOf(type) !== -1) {
          extracted.productType = typeMap[type];
        }
      });

      // Concern
      var concernMap = {
        acne: 'Acne', dryness: 'Dryness', 'dry skin': 'Dryness',
        oily: 'Oily', 'dark spots': 'Dark Spots', wrinkles: 'Wrinkles',
        aging: 'Aging', sensitive: 'Sensitive', hydration: 'Hydration',
        brightening: 'Brightening', dandruff: 'Dandruff', frizz: 'Frizz',
        damage: 'Damage', breakage: 'Breakage', thinning: 'Thinning',
      };
      Object.keys(concernMap).forEach(function (concern) {
        if (lower.indexOf(concern) !== -1) {
          extracted.concern = concernMap[concern];
        }
      });

      // Budget
      var budgetMatch = lower.match(/under\s*\$?\s*(\d+)/) || lower.match(/budget\s*\$?\s*(\d+)/) || lower.match(/less than\s*\$?\s*(\d+)/);
      if (budgetMatch) {
        extracted.budget = budgetMatch[1];
      }
      if (lower.indexOf('cheap') !== -1 || lower.indexOf('affordable') !== -1 || lower.indexOf('inexpensive') !== -1) {
        if (!extracted.budget) extracted.budget = 'budget-friendly';
      }
      if (lower.indexOf('premium') !== -1 || lower.indexOf('luxury') !== -1) {
        extracted.budget = 'premium';
      }

      // Skin type
      var skinMap = {
        'dry skin': 'Dry', 'oily skin': 'Oily', combination: 'Combination',
        'sensitive skin': 'Sensitive', 'normal skin': 'Normal',
      };
      Object.keys(skinMap).forEach(function (st) {
        if (lower.indexOf(st) !== -1) extracted.skinType = skinMap[st];
      });

      // Brand - simple: "from {name}" or "by {name}" pattern
      var brandMatch = lower.match(/from\s+(\w+)/) || lower.match(/by\s+(\w+)/) || lower.match(/brand\s+(\w+)/);
      if (brandMatch) {
        extracted.brand = brandMatch[1].charAt(0).toUpperCase() + brandMatch[1].slice(1);
      }

      return extracted;
    }

    // ─── Adaptive Discovery Flow ───
    // Determines what information is still needed and asks ONE question
    function startDiscoveryFlow(userText) {
      // Parse intent from the message
      var intent = parseIntent(userText);

      // Merge into funnel
      if (intent.categoryId) {
        funnel.categoryId = intent.categoryId;
        funnel.categoryName = intent.categoryName;
      }
      if (intent.productType && !funnel.answers.productType) {
        funnel.answers.productType = intent.productType;
      }
      if (intent.concern && !funnel.answers.concern) {
        funnel.answers.concern = intent.concern;
      }
      if (intent.budget && !funnel.answers.budget) {
        funnel.answers.budget = intent.budget;
      }
      if (intent.skinType && !funnel.answers.skinType) {
        funnel.answers.skinType = intent.skinType;
      }
      if (intent.brand && !funnel.answers.brand) {
        funnel.answers.brand = intent.brand;
      }
      persistFunnel();

      // Determine what's missing
      var missing = determineMissingFields();
      updateContextBar();
      updateProgressBar();

      if (missing.length === 0) {
        // Have enough info — recommend
        fetchRecommendations();
        return;
      }

      // Ask only the first missing question
      var nextField = missing[0];
      askDiscoveryQuestion(nextField);
    }

    function determineMissingFields() {
      var required = ['productType', 'concern'];
      var optional = ['budget', 'skinType', 'brand'];
      var missing = [];

      required.forEach(function (f) {
        if (!funnel.answers[f]) missing.push(f);
      });

      // For optional, check if we have any of them; if we have enough
      // required fields, we can recommend even without optional ones.
      // We ask optional only if required are filled and the specific one is missing.
      optional.forEach(function (f) {
        if (!funnel.answers[f]) missing.push(f);
      });

      return missing;
    }

    function askDiscoveryQuestion(field) {
      var questionText = '';
      var options = [];

      switch (field) {
        case 'productType':
          var cats = config.categories || [];
          if (cats.length === 1) {
            // Auto-select if only one category
            selectCategory(cats[0]);
            return;
          }
          questionText = 'What type of product are you looking for?';
          options = cats.map(function (c) {
            return { icon: c.icon || icon('package'), label: c.name, value: c.name, categoryId: c.id };
          });
          options.push({ icon: icon('sparkle'), label: 'Not sure', value: 'any', categoryId: null });
          break;

        case 'concern':
          questionText = 'What skin concern are you trying to address?';
          if (funnel.answers.productType && funnel.categoryName) {
            questionText = 'Great! What specific concern are you looking to address?';
          }
          options = [
            { icon: icon('droplet'), label: 'Acne', value: 'Acne' },
            { icon: icon('droplet'), label: 'Dryness', value: 'Dryness' },
            { icon: icon('sun'), label: 'Brightening', value: 'Brightening' },
            { icon: icon('clock'), label: 'Aging', value: 'Aging' },
            { icon: icon('sun'), label: 'Dark Spots', value: 'Dark Spots' },
            { icon: icon('sparkle'), label: 'Not sure', value: 'any' },
          ];
          break;

        case 'budget':
          questionText = 'Do you have a budget in mind?';
          if (funnel.answers.concern) {
            questionText = 'What\u2019s your budget? That helps me find the best products for you.';
          }
          options = [
            { icon: icon('card'), label: 'Under $30', value: 'under-30' },
            { icon: icon('wallet'), label: '$30 \u2013 $60', value: '30-60' },
            { icon: icon('money'), label: '$60 \u2013 $100', value: '60-100' },
            { icon: icon('gem'), label: '$100+', value: '100-plus' },
            { icon: icon('sparkle'), label: 'No preference', value: 'any' },
          ];
          break;

        case 'skinType':
          questionText = 'What\u2019s your skin type? This helps me find products that work best for you.';
          options = [
            { icon: icon('droplet'), label: 'Dry', value: 'Dry' },
            { icon: icon('droplet'), label: 'Oily', value: 'Oily' },
            { icon: icon('sparkle'), label: 'Combination', value: 'Combination' },
            { icon: icon('heart'), label: 'Sensitive', value: 'Sensitive' },
            { icon: icon('sparkle'), label: 'Not sure', value: 'any' },
          ];
          break;

        case 'brand':
          var brandOptions = [];
          if (config.brands && Array.isArray(config.brands)) {
            config.brands.forEach(function (b) {
              brandOptions.push({ icon: icon('tag'), label: b, value: b });
            });
          }
          brandOptions.push({ icon: icon('sparkle'), label: 'No preference', value: 'any' });
          questionText = 'Do you have a preferred brand?';
          options = brandOptions;
          break;

        default:
          questionText = 'Could you tell me more about what you\u2019re looking for?';
          options = [];
      }

      appendAiBubble(questionText);
      if (options.length > 0) {
        var chipsWrap = document.createElement('div');
        chipsWrap.className = 'chips';
        options.forEach(function (opt) {
          var chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'chip';
chip.innerHTML = (opt.icon || '') + (opt.icon ? ' ' : '') + escapeHtml(opt.label);
          chip.addEventListener('click', function () {
            answerDiscoveryQuestion(field, opt);
          });
          chipsWrap.appendChild(chip);
        });
        body.appendChild(chipsWrap);
      }
      scrollToBottom();
    }

    function answerDiscoveryQuestion(field, opt) {
      appendCustomerBubble(opt.label);

      if (field === 'productType' && opt.categoryId) {
        // If product type maps to a category, select it
        var matchedCat = null;
        if (config.categories) {
          config.categories.forEach(function (c) {
            if (c.id === opt.categoryId) matchedCat = c;
          });
        }
        if (matchedCat) {
          funnel.categoryId = matchedCat.id;
          funnel.categoryName = matchedCat.name;
        }
      }

      if (opt.value && opt.value !== 'any') {
        funnel.answers[field] = opt.value;
      }
      persistFunnel();
      updateContextBar();
      updateProgressBar();

      // Check if we have enough info now
      var missing = determineMissingFields();
      if (missing.length === 0 || (missing.length === 1 && missing[0] === 'brand')) {
        // Enough info to recommend (brand is optional)
        removeContextBar();
        fetchRecommendations();
      } else {
        // Ask next question
        // Filter out the field we just answered
        var remaining = missing.filter(function (f) { return f !== field; });
        if (remaining.length > 0) {
          askDiscoveryQuestion(remaining[0]);
        } else {
          fetchRecommendations();
        }
      }
    }

    // ─── Context Bar ───
    function renderContextBar() {
      if (!contextBar || !contextItems) return;
      contextBar.classList.add('open');
      updateContextBar();
    }

    function updateContextBar() {
      if (!contextBar || !contextItems) return;
      var hasItems = false;
      contextItems.innerHTML = '';

      function addChip(label, value, fieldKey) {
        hasItems = true;
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'context-bar-chip';
        chip.innerHTML = escapeHtml(label) + ': ' + escapeHtml(value) + ' <span class="context-bar-chip-remove">' + icon('x') + '</span>';
        chip.addEventListener('click', function () {
          // Remove this field from answers
          delete funnel.answers[fieldKey];
          if (fieldKey === 'productType') {
            funnel.categoryId = null;
            funnel.categoryName = null;
          }
          persistFunnel();
          updateContextBar();
          // Restart discovery with remaining context
          removeRecoBlock();
          removeCompareBar();
          removeTyping();
          var missing = determineMissingFields();
          if (missing.length > 0) {
            askDiscoveryQuestion(missing[0]);
          } else {
            fetchRecommendations();
          }
        });
        contextItems.appendChild(chip);
      }

      if (funnel.categoryName) addChip('Category', funnel.categoryName, 'productType');
      if (funnel.answers.productType) addChip('Type', funnel.answers.productType, 'productType');
      if (funnel.answers.concern) addChip('Concern', funnel.answers.concern, 'concern');
      if (funnel.answers.budget) addChip('Budget', funnel.answers.budget, 'budget');
      if (funnel.answers.skinType) addChip('Skin', funnel.answers.skinType, 'skinType');
      if (funnel.answers.brand) addChip('Brand', funnel.answers.brand, 'brand');

      if (!hasItems) {
        contextBar.classList.remove('open');
      }
    }

    function removeContextBar() {
      if (contextBar) contextBar.classList.remove('open');
    }

    // ─── Progress Bar ───
    function showProgressBar() {
      if (progressBar) progressBar.classList.add('open');
    }

    function hideProgressBar() {
      if (progressBar) progressBar.classList.remove('open');
    }

    function updateProgressBar() {
      if (!progressFill) return;
      var required = ['productType', 'concern'];
      var optional = ['budget', 'skinType', 'brand'];
      var total = required.length + Math.min(2, optional.length);
      var filled = 0;
      required.forEach(function (f) { if (funnel.answers[f]) filled++; });
      optional.forEach(function (f) { if (funnel.answers[f]) filled++; });
      var pct = Math.min(100, Math.round((filled / total) * 100));
      progressFill.style.width = pct + '%';
      showProgressBar();
    }

    // ─── Helpers ───
    function removeRecoBlock() {
      var el = shadow.getElementById('midevela-reco-block');
      if (el) el.remove();
    }

    // Update sendMessage to use adaptive discovery for shopping messages
    function handleDiscoveryMessage(text) {
      funnel.conversationStarted = true;
      funnel.view = 'conversation';
      persistFunnel();
      markActivity();

      appendCustomerBubble(text);
      scrollToBottom();
      showState('thinking');
      scrollToBottom();

      // Parse intent and run adaptive discovery
      startDiscoveryFlow(text);
    }

    // ─── Animated Recommendation Refresh ───
    function refreshRecommendations(products) {
      var block = shadow.getElementById('midevela-reco-block');
      if (block) {
        // Fade out old cards
        block.style.transition = 'opacity 0.2s var(--ease-out)';
        block.style.opacity = '0';
        setTimeout(function () {
          block.remove();
          renderRecommendations(products);
        }, 220);
      } else {
        renderRecommendations(products);
      }
    }
    function recommendationFollowUpChips() {
      return [
        { icon: icon('search'), label: 'Compare them', action: function () {
          // Trigger compare mode by selecting first two products
          if (funnel.lastRecommendations && funnel.lastRecommendations.length >= 2) {
            funnel.compareSelection = [funnel.lastRecommendations[0].id, funnel.lastRecommendations[1].id];
            renderRecommendations(funnel.lastRecommendations);
            runCompare();
          }
        } },
        { icon: icon('wallet'), label: 'Cheaper options', action: function () {
          sendMessage('show me cheaper options');
        } },
        { icon: icon('external'), label: 'Learn more', action: function () {
          if (funnel.lastRecommendations && funnel.lastRecommendations.length > 0) {
            sendMessage('tell me more about ' + funnel.lastRecommendations[0].name);
          }
        } },
        { icon: icon('chat'), label: 'Ask something else', action: function () {
          funnel.view = 'conversation';
          persistFunnel();
          clearBody();
          renderEmptyConversation();
          input.focus();
        } },
      ];
    }

    // After any business/support answer, offer to return to shopping
    function businessFollowUpChips() {
      return [
        { icon: icon('bag'), label: 'Continue shopping', action: function () {
          if (funnel.categoryId) {
            selectCategory({ id: funnel.categoryId, name: funnel.categoryName });
          } else {
            renderWelcome();
          }
        } },
        { icon: icon('chat'), label: 'Ask another question', action: function () {
          input.focus();
        } },
      ];
    }

    // ─── Error Bubble ───
    function renderErrorBubble(message, retryFn) {
      var el = document.createElement('div');
      el.className = 'error-bubble';
      el.innerHTML =
        '<div class="error-icon">' + icon('alert-circle') + '</div>' +
        '<div class="error-text">' + escapeHtml(message || 'Oops. Something went wrong. Let\u2019s try again.') + '</div>';
      if (typeof retryFn === 'function') {
        var btn = document.createElement('button');
        btn.className = 'error-retry-btn';
        btn.innerHTML = icon('refresh') + ' Retry';
        btn.addEventListener('click', retryFn);
        el.appendChild(btn);
      }
      body.appendChild(el);
      scrollToBottom();
      return el;
    }

    // ─── Loading Skeleton ───
    function renderSkeletonLoader(type) {
      var el = document.createElement('div');
      el.id = 'midevela-skeleton';
      if (type === 'cards') {
        el.className = 'skeleton';
        var line = document.createElement('div');
        line.className = 'skeleton-line';
        el.appendChild(line);
        var cardsWrap = document.createElement('div');
        cardsWrap.className = 'skeleton-cards';
        for (var i = 0; i < 3; i++) {
          var card = document.createElement('div');
          card.className = 'skeleton-card';
          cardsWrap.appendChild(card);
        }
        el.appendChild(cardsWrap);
      } else {
        el.className = 'skeleton';
        for (var j = 0; j < 3; j++) {
          var ln = document.createElement('div');
          ln.className = 'skeleton-line';
          el.appendChild(ln);
        }
      }
      body.appendChild(el);
      scrollToBottom();
      return el;
    }

    function removeSkeleton() {
      var el = shadow.getElementById('midevela-skeleton');
      if (el) el.remove();
    }

    // ─── Compare Placeholder ───
    function renderComparePlaceholder(productA, productB, compareFn) {
      var el = document.createElement('div');
      el.className = 'compare-placeholder';
      el.innerHTML =
        '<div class="compare-placeholder-title">' + icon('compare') + ' Compare Products</div>' +
        '<div class="compare-placeholder-row">' +
          '<div class="compare-placeholder-item">' + escapeHtml(productA || 'Product A') + '</div>' +
          '<div class="compare-placeholder-item">' + escapeHtml(productB || 'Product B') + '</div>' +
        '</div>';
      if (typeof compareFn === 'function') {
        var btn = document.createElement('button');
        btn.className = 'compare-placeholder-btn';
        btn.innerHTML = icon('compare') + ' Compare';
        btn.addEventListener('click', compareFn);
        el.appendChild(btn);
      }
      body.appendChild(el);
      scrollToBottom();
      return el;
    }

    function renderRecoCard(r, source, index) {
      var url = isHttpUrl(r && r.url) ? r.url : '';
      var imageUrl = showProductImages && isHttpUrl(r && r.imageUrl) ? r.imageUrl : '';
      var isSelected = funnel.compareSelection.indexOf(r.id) !== -1;
      var isExpanded = funnel._expandedProduct === r.id;
      var card = document.createElement('div');
      card.className = 'reco-card' + (isSelected ? ' selected' : '');
      card.style.animationDelay = (index != null ? index * 80 : 0) + 'ms';

      // Badge
      var badgeHTML = '';
      var badgeText = r.badge || '';
      if (!badgeText && index === 0) badgeText = 'Best Match';
      if (badgeText) {
        badgeHTML = '<div class="reco-badge">' + escapeHtml(badgeText) + '</div>';
      }

      // Image
      var imgHTML;
      if (imageUrl) {
        imgHTML = '<div class="reco-img" data-role="view">' +
          '<div class="reco-img-shimmer"></div>' +
          '<img src="' + escapeHtml(imageUrl) + '" alt="' + escapeHtml(r.name) + '" loading="lazy" style="opacity:0">' +
          badgeHTML +
          '</div>';
      } else {
        imgHTML = '<div class="reco-img" data-role="view">' +
          '<div class="reco-img-fallback"><span>' + icon('bag') + '</span>Image unavailable</div>' +
          badgeHTML +
          '</div>';
      }

      // Rating
      var ratingHTML = '';
      if (r.rating) {
        var stars = '';
        var fullStars = Math.floor(Number(r.rating));
        for (var s = 0; s < 5; s++) {
          stars += s < fullStars ? icon('star-filled') : icon('star');
        }
        ratingHTML = '<div class="reco-rating">' + stars + '</div>';
      }

      // Features
      var featuresHTML = '';
      if (Array.isArray(r.features) && r.features.length > 0) {
        featuresHTML = '<div class="reco-features">' +
          r.features.map(function (f) { return '<span class="reco-feature-chip">' + escapeHtml(f) + '</span>'; }).join('') +
          '</div>';
      }

      // Footer (stock status)
      var footerHTML = '';
      if (r.inStock !== undefined) {
        var inStock = r.inStock;
        footerHTML = '<div class="reco-footer' + (!inStock ? ' reco-footer-out' : '') + '">' +
          '<span class="reco-footer-dot"></span>' +
          escapeHtml(inStock ? 'Available \u2022 In Stock' : 'Out of Stock') +
          '</div>';
      }

      // Expanded details
      var expandHTML = '';
      if (r.description || r.benefits || r.ingredients) {
        expandHTML = '<button type="button" class="reco-expand-toggle" data-role="expand">' +
          (isExpanded ? icon('chevron-up') + ' Less details' : icon('chevron-down') + ' More details') +
          '</button>' +
          '<div class="reco-expand' + (isExpanded ? ' open' : '') + '">' +
          (r.description ? '<div class="reco-expand-section">Description</div><div class="reco-expand-text">' + escapeHtml(r.description) + '</div>' : '') +
          (r.benefits ? '<div class="reco-expand-section">Benefits</div><div class="reco-expand-text">' + escapeHtml(r.benefits) + '</div>' : '') +
          (r.ingredients ? '<div class="reco-expand-section">Ingredients</div><div class="reco-expand-text">' + escapeHtml(r.ingredients) + '</div>' : '') +
          '</div>';
      }

      card.innerHTML = imgHTML +
        '<div class="reco-body">' +
          '<span class="reco-name" data-role="view">' + escapeHtml(r.name) + '</span>' +
          ratingHTML +
          '<span class="reco-price">' + escapeHtml(r.price) + '</span>' +
          (r.whyThis ? '<span class="reco-why">' + escapeHtml(r.whyThis) + '</span>' : '') +
          featuresHTML +
        '</div>' +
        footerHTML +
        expandHTML +
        '<div class="reco-actions">' +
          (url ? '<a class="reco-btn" href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer" data-role="checkout">View Product ' + icon('arrow-right') + '</a>' : '') +
          (source === 'funnel' ? '<button type="button" class="reco-compare-btn' + (isSelected ? ' active' : '') + '" data-role="compare">' + (isSelected ? icon('check') + ' Added' : '+ Compare') + '</button>' : '') +
        '</div>';

      // Image loading: remove shimmer when loaded
      if (imageUrl) {
        var img = card.querySelector('.reco-img img');
        var shimmer = card.querySelector('.reco-img-shimmer');
        if (img) {
          img.addEventListener('load', function () {
            if (shimmer) shimmer.remove();
            img.style.opacity = '1';
          }, { once: true });
          img.addEventListener('error', function () {
            var imgEl = card.querySelector('.reco-img');
            if (imgEl) {
              imgEl.innerHTML = '<div class="reco-img-fallback"><span>' + icon('bag') + '</span>Image unavailable</div>' + badgeHTML;
            }
          }, { once: true });
        }
      }

      // Expand/collapse
      var expandBtn = card.querySelector('[data-role="expand"]');
      if (expandBtn) {
        expandBtn.addEventListener('click', function () {
          if (funnel._expandedProduct === r.id) {
            funnel._expandedProduct = null;
          } else {
            funnel._expandedProduct = r.id;
          }
          renderRecommendations(funnel.lastRecommendations || []);
        });
      }

      var viewEls = card.querySelectorAll('[data-role="view"]');
      Array.prototype.forEach.call(viewEls, function (el) {
        el.addEventListener('click', function () { trackEvent('product_viewed', { productId: r.id, source: source }); });
      });

      var checkoutLink = card.querySelector('[data-role="checkout"]');
      if (checkoutLink) {
        checkoutLink.addEventListener('click', function () {
          if (source === 'funnel') trackEvent('recommendation_clicked', { productId: r.id });
          trackEvent('checkout_clicked', { productId: r.id, url: url });
        });
      }

      var compareBtn = card.querySelector('[data-role="compare"]');
      if (compareBtn) {
        compareBtn.addEventListener('click', function () { toggleCompareSelection(r.id); });
      }

      return card;
    }

    function renderRecoContainer(products, source) {
      var container = document.createElement('div');
      container.className = 'reco-container';
      products.forEach(function (p, i) { container.appendChild(renderRecoCard(p, source, i)); });
      return container;
    }

    // ─── Compare ───
    function toggleCompareSelection(productId) {
      var idx = funnel.compareSelection.indexOf(productId);
      if (idx !== -1) {
        funnel.compareSelection.splice(idx, 1);
      } else {
        if (funnel.compareSelection.length >= 2) funnel.compareSelection.shift();
        funnel.compareSelection.push(productId);
      }
      renderRecommendations(funnel.lastRecommendations || []);
      if (funnel.compareSelection.length === 2) runCompare();
    }

    function runCompare() {
      var productIds = funnel.compareSelection;
      if (productIds.length < 2) return;

      // Show loading overlay immediately
      showCompareLoadingOverlay();

      fetch(compareApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgetKey, productIds: productIds }),
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          removeTyping();
          if (!data || !Array.isArray(data.rows)) {
            closeCompareOverlay();
            appendAiBubble("I couldn\u2019t compare those two right now \u2014 please try again.");
            return;
          }
          renderCompareOverlay(data);
          trackEvent('comparison_viewed', { productIds: productIds });
        })
        .catch(function () {
          removeTyping();
          closeCompareOverlay();
          appendAiBubble("I couldn\u2019t compare those two right now \u2014 please try again.");
        });
    }

    // ─── Comparison Overlay ───
    function showCompareLoadingOverlay() {
      var existing = shadow.getElementById('midevela-compare-overlay');
      if (existing) existing.remove();

      var loadingTexts = ['Comparing products\u2026', 'Checking ingredients\u2026', 'Looking for differences\u2026', 'Almost done\u2026'];
      var overlay = document.createElement('div');
      overlay.id = 'midevela-compare-overlay';
      overlay.className = 'compare-overlay';

      var header = document.createElement('div');
      header.className = 'compare-overlay-header';
      header.innerHTML =
        '<button type="button" class="compare-overlay-back" id="midevela-compare-close">&larr;</button>' +
        '<span class="compare-overlay-title">Compare Products</span>';
      overlay.appendChild(header);

      var loadWrap = document.createElement('div');
      loadWrap.className = 'compare-loading';
      loadWrap.innerHTML =
        '<div class="compare-loading-icon">' + icon('search') + '</div>' +
        '<div class="compare-loading-text" id="midevela-compare-loading-text">' + loadingTexts[0] + '</div>';
      overlay.appendChild(loadWrap);

      // Cycle through loading texts
      var idx = 0;
      var loadingInterval = setInterval(function () {
        idx++;
        if (idx < loadingTexts.length) {
          var lt = shadow.getElementById('midevela-compare-loading-text');
          if (lt) lt.textContent = loadingTexts[idx];
        } else {
          clearInterval(loadingInterval);
        }
      }, 1200);

      overlay._loadingInterval = loadingInterval;

      var backBtn = overlay.querySelector('#midevela-compare-close');
      backBtn.addEventListener('click', function () {
        closeCompareOverlay();
      });

      chat.appendChild(overlay);
    }

    function renderCompareOverlay(data) {
      var existing = shadow.getElementById('midevela-compare-overlay');
      if (existing) {
        if (existing._loadingInterval) clearInterval(existing._loadingInterval);
        existing.remove();
      }

      var products = data.products || [];
      var rows = data.rows || [];
      var recommendedIdx = data.recommendedIndex != null ? data.recommendedIndex : -1;
      var aiSummary = data.recommendation || '';

      var overlay = document.createElement('div');
      overlay.id = 'midevela-compare-overlay';
      overlay.className = 'compare-overlay';

      // Header
      var header = document.createElement('div');
      header.className = 'compare-overlay-header';
      header.innerHTML =
        '<button type="button" class="compare-overlay-back" id="midevela-compare-close">&larr;</button>' +
        '<span class="compare-overlay-title">Compare Products</span>';
      overlay.appendChild(header);

      // Scrollable content
      var scroll = document.createElement('div');
      scroll.className = 'compare-overlay-scroll';

      // Product header row
      if (products.length >= 2) {
        var prodRow = document.createElement('div');
        prodRow.className = 'compare-products-row';

        products.forEach(function (p, pi) {
          var col = document.createElement('div');
          col.className = 'compare-product-col';

          // Winner badge
          if (pi === recommendedIdx) {
            var badge = document.createElement('div');
            badge.className = 'compare-winner-badge';
            badge.innerHTML = icon('trophy') + ' Best Match';
            col.appendChild(badge);
          }

          // Image
          var imgWrap = document.createElement('div');
          imgWrap.className = 'compare-product-img';
          var imgUrl = showProductImages && isHttpUrl(p.imageUrl) ? p.imageUrl : '';
          if (imgUrl) {
            imgWrap.innerHTML = '<img src="' + escapeHtml(imgUrl) + '" alt="' + escapeHtml(p.name) + '" loading="lazy">';
          } else {
            imgWrap.innerHTML = icon('bag');
          }
          col.appendChild(imgWrap);

          // Name
          var name = document.createElement('div');
          name.className = 'compare-product-name';
          name.textContent = p.name;
          col.appendChild(name);

          // Price
          var price = document.createElement('div');
          price.className = 'compare-product-price';
          price.textContent = p.price;
          col.appendChild(price);

          // Availability
          var avail = document.createElement('div');
          avail.className = 'compare-product-availability';
          var inStock = p.inStock !== false;
          avail.innerHTML = '<span class="compare-product-availability-dot"></span> ' + escapeHtml(inStock ? 'Available \u2022 In Stock' : 'Out of Stock');
          col.appendChild(avail);

          // Actions
          var actions = document.createElement('div');
          actions.className = 'compare-product-actions';
          var swapBtn = document.createElement('button');
          swapBtn.type = 'button';
          swapBtn.className = 'compare-product-action-btn';
          swapBtn.textContent = 'Swap';
          swapBtn.addEventListener('click', function () {
            // Swap: remove this product and show recommendations to pick another
            funnel.compareSelection = [products[pi === 0 ? 1 : 0].id];
            closeCompareOverlay();
            renderRecommendations(funnel.lastRecommendations || []);
          });
          actions.appendChild(swapBtn);
          var removeBtn = document.createElement('button');
          removeBtn.type = 'button';
          removeBtn.className = 'compare-product-action-btn';
          removeBtn.textContent = 'Remove';
          removeBtn.addEventListener('click', function () {
            funnel.compareSelection = [products[pi === 0 ? 1 : 0].id];
            closeCompareOverlay();
            renderRecommendations(funnel.lastRecommendations || []);
          });
          actions.appendChild(removeBtn);
          col.appendChild(actions);

          prodRow.appendChild(col);

          // VS divider
          if (pi === 0) {
            var vs = document.createElement('div');
            vs.className = 'compare-vs';
            vs.textContent = 'VS';
            prodRow.appendChild(vs);
          }
        });

        scroll.appendChild(prodRow);
      }

      // Difference summary
      if (rows.length > 0) {
        var diffRows = [];
        var simRows = [];
        rows.forEach(function (r) {
          var uniqueValues = {};
          r.values.forEach(function (v) { uniqueValues[v] = (uniqueValues[v] || 0) + 1; });
          if (Object.keys(uniqueValues).length > 1) {
            diffRows.push(r);
          } else {
            simRows.push(r);
          }
        });

        // Show differences first
        if (diffRows.length > 0) {
          var diffSection = document.createElement('div');
          diffSection.className = 'compare-section';
          var diffTitle = document.createElement('div');
          diffTitle.className = 'compare-section-title';
          diffTitle.textContent = 'Main Differences';
          diffSection.appendChild(diffTitle);

          diffRows.slice(0, 4).forEach(function (r, ri) {
            var diffVal = '';
            var bestIdx = -1;
            r.values.forEach(function (v, vi) {
              if (vi === 0 || r.values[bestIdx] !== v) {
                if (bestIdx === -1 || (recommendedIdx > -1 && vi === recommendedIdx)) {
                  bestIdx = vi;
                }
              }
            });
            diffVal = r.label + ': ' + r.values.join(' vs ');
            var chip = document.createElement('span');
            chip.className = 'compare-diff-chip';
            chip.style.animationDelay = (ri * 60) + 'ms';
            chip.textContent = diffVal;
            diffSection.appendChild(chip);
          });

          scroll.appendChild(diffSection);
        }

        // Similarities
        if (simRows.length > 0) {
          var simSection = document.createElement('div');
          simSection.className = 'compare-section';
          var simTitle = document.createElement('div');
          simTitle.className = 'compare-section-title';
          simTitle.textContent = 'Both Products';
          simSection.appendChild(simTitle);

          var simChips = document.createElement('div');
          simChips.className = 'compare-diff-chips';
          simRows.slice(0, 4).forEach(function (r) {
            var chip = document.createElement('span');
            chip.className = 'compare-sim-chip';
            chip.innerHTML = icon('check') + ' ' + escapeHtml(r.label) + ': ' + escapeHtml(r.values[0] || 'Yes');
            simChips.appendChild(chip);
          });
          simSection.appendChild(simChips);
          scroll.appendChild(simSection);
        }
      }

      // Comparison table
      if (rows.length > 0) {
        var tableWrap = document.createElement('div');
        tableWrap.className = 'compare-table-wrap';

        var table = document.createElement('table');
        table.className = 'compare-data-table';

        var thead = '<tr><th>Attribute</th>';
        products.forEach(function (p) { thead += '<th>' + escapeHtml(p.name) + '</th>'; });
        thead += '</tr>';

        var tbody = '';
        rows.forEach(function (r, ri) {
          var isDiffRow = false;
          var uniqueVals = {};
          r.values.forEach(function (v) { uniqueVals[v] = (uniqueVals[v] || 0) + 1; });
          isDiffRow = Object.keys(uniqueVals).length > 1;

          var bestValIdx = -1;
          if (isDiffRow && recommendedIdx >= 0) {
            // Check if this specific product has a better value (simplified: mark the recommended one)
            bestValIdx = recommendedIdx;
          }

          tbody += '<tr style="animation-delay:' + (ri * 40) + 'ms">';
          tbody += '<td>' + escapeHtml(r.label) + '</td>';
          r.values.forEach(function (v, vi) {
            var cls = '';
            if (isDiffRow && vi === bestValIdx) cls = ' class="compare-winner compare-winner-value"';
            else if (isDiffRow && bestValIdx >= 0) cls = ' class="compare-winner"';
            tbody += '<td' + cls + '>' + escapeHtml(v) + '</td>';
          });
          tbody += '</tr>';
        });

        table.innerHTML = thead + tbody;
        tableWrap.appendChild(table);
        scroll.appendChild(tableWrap);
      }

      // AI Summary
      if (aiSummary) {
        var summary = document.createElement('div');
        summary.className = 'compare-ai-summary';
        summary.innerHTML = '<strong>Recommendation</strong><br><br>' + escapeHtml(aiSummary);
        scroll.appendChild(summary);
      }

      overlay.appendChild(scroll);

      // Sticky footer with CTAs
      var footer = document.createElement('div');
      footer.className = 'compare-overlay-footer';
      products.forEach(function (p) {
        var url = isHttpUrl(p.url) ? p.url : '';
        var cta = document.createElement(url ? 'a' : 'button');
        cta.className = 'compare-cta';
        cta.textContent = 'View ' + escapeHtml(p.name);
        if (url) {
          cta.href = url;
          cta.target = '_blank';
          cta.rel = 'noopener noreferrer';
        }
        cta.addEventListener('click', function () {
          trackEvent('comparison_checkout', { productId: p.id });
        });
        footer.appendChild(cta);
      });
      overlay.appendChild(footer);

      // Back button
      var backBtn = overlay.querySelector('#midevela-compare-close');
      backBtn.addEventListener('click', function () {
        closeCompareOverlay();
      });

      chat.appendChild(overlay);
    }

    function closeCompareOverlay() {
      var el = shadow.getElementById('midevela-compare-overlay');
      if (el) {
        if (el._loadingInterval) clearInterval(el._loadingInterval);
        el.remove();
      }
    }

    // ─── Views ───
    // Shared by the plain first-time welcome and the returning-visitor
    // "welcome back" prompt — the category grid + Ask-anything chip are
    // identical in both, just preceded by a different greeting.
    function renderCategoryGridAndChips() {
      if (config.categories.length > 0) {
        var row = document.createElement('div');
        row.className = 'msg-row ai';
        var avatar = document.createElement('div');
        avatar.className = 'msg-avatar';
        avatar.innerHTML = icon('leaf');
        var col = document.createElement('div');
        col.className = 'msg-col';
        var sender = document.createElement('div');
        sender.className = 'msg-sender';
        sender.textContent = aiName;
        col.appendChild(sender);
        var bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        bubble.textContent = naturalAskCategory();
        col.appendChild(bubble);
        row.appendChild(avatar);
        row.appendChild(col);
        body.appendChild(row);

        var grid = document.createElement('div');
        grid.className = 'cat-grid';
        config.categories.forEach(function (cat) {
          var tile = document.createElement('button');
          tile.type = 'button';
          tile.className = 'cat-tile';
          var catImage = isHttpUrl(cat.image) ? cat.image : '';
          tile.innerHTML =
            '<div class="cat-tile-icon">' + (catImage ? '<img src="' + escapeHtml(catImage) + '" alt="">' : escapeHtml(cat.icon || '\u{1F4E6}')) + '</div>' +
            '<span class="cat-tile-name">' + escapeHtml(cat.name) + '</span>';
          if (catImage) {
            (function (imgEl) {
              imgEl.addEventListener('error', function () {
                var iconEl = tile.querySelector('.cat-tile-icon');
                if (iconEl) iconEl.innerHTML = escapeHtml(cat.icon || '\u{1F4E6}');
              }, { once: true });
            })(tile.querySelector('.cat-tile-icon img'));
          }
          tile.addEventListener('click', function () { selectCategory(cat); });
          grid.appendChild(tile);
        });
        body.appendChild(grid);
      }

      var chipsWrap = document.createElement('div');
      chipsWrap.className = 'chips';
      var askChip = document.createElement('button');
      askChip.type = 'button';
      askChip.className = 'chip';
      askChip.innerHTML = icon('chat') + ' Ask anything';
      askChip.addEventListener('click', function () {
        funnel.view = 'conversation';
        persistFunnel();
        clearBody();
        renderEmptyConversation();
        input.focus();
      });
      chipsWrap.appendChild(askChip);
      body.appendChild(chipsWrap);
      scrollToBottom();
    }

    function renderWelcome() {
      funnel.view = 'welcome';
      persistFunnel();
      clearBody();

      var screen = document.createElement('div');
      screen.className = 'welcome-screen';

      // Avatar
      var avatar = document.createElement('div');
      avatar.className = 'welcome-avatar';
      avatar.textContent = avatarLetter;
      screen.appendChild(avatar);

      // Title
      var title = document.createElement('div');
      title.className = 'welcome-title';
      var businessName = config.business && config.business.name ? config.business.name : '';
      title.textContent = 'Welcome to ' + (businessName || 'our store');
      screen.appendChild(title);

      // Subtitle
      var subtitle = document.createElement('div');
      subtitle.className = 'welcome-subtitle';
      subtitle.textContent = "I'm " + aiName + ", your AI shopping assistant. I can help you find products, compare options, and answer your questions.";
      screen.appendChild(subtitle);

      // Action cards
      var actions = [
        {
          icon: icon('bag'),
          title: 'Start Shopping',
          desc: 'Find products with AI recommendations',
          fn: function () {
            clearBody();
            appendAiBubble(naturalGreeting());
            renderCategoryGridAndChips();
            scrollToBottom();
          },
        },
        {
          icon: icon('list'),
          title: 'Browse Categories',
          desc: 'Explore everything we offer',
          fn: function () {
            clearBody();
            appendAiBubble(naturalGreeting());
            renderCategoryGridAndChips();
            scrollToBottom();
          },
        },
        {
          icon: icon('chat'),
          title: 'Ask a Question',
          desc: 'Shipping, returns, delivery and more',
          fn: function () {
            funnel.view = 'conversation';
            persistFunnel();
            renderEmptyConversation();
            input.focus();
          },
        },
      ];

      actions.forEach(function (card, i) {
        var el = document.createElement('button');
        el.type = 'button';
        el.className = 'welcome-card';
        el.setAttribute('style', '--i: ' + i);
        el.innerHTML =
          '<span class="welcome-card-icon">' + card.icon + '</span>' +
          '<span class="welcome-card-body">' +
            '<span class="welcome-card-title">' + escapeHtml(card.title) + '</span>' +
            '<span class="welcome-card-desc">' + escapeHtml(card.desc) + '</span>' +
          '</span>';
        el.addEventListener('click', card.fn);
        screen.appendChild(el);
      });

      // Suggested questions
      var label = document.createElement('div');
      label.className = 'welcome-suggestions-label';
      label.textContent = 'Popular questions';
      screen.appendChild(label);

      var suggestionsWrap = document.createElement('div');
      suggestionsWrap.className = 'welcome-suggestions';
      var questions = [
        'Do you ship internationally?',
        "What's best for acne?",
        "Show today's deals",
        'Track my order',
      ];
      questions.forEach(function (q) {
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'welcome-suggestion-chip';
        chip.textContent = q;
        chip.addEventListener('click', function () {
          funnel.view = 'conversation';
          persistFunnel();
          renderEmptyConversation();
          input.value = q;
          input.focus();
        });
        suggestionsWrap.appendChild(chip);
      });
      screen.appendChild(suggestionsWrap);

      body.appendChild(screen);
    }

    // Shown instead of renderWelcome() on a new visit when the visitor has
    // a recent category on file (config.lastCategory, resolved server-side
    // from their own conversation history) — offers a shortcut into that
    // category's qualification flow, or the full grid as always. Never
    // auto-resumes: picking "Continue" starts a fresh conversation via the
    // exact same selectCategory() a grid click uses, with no old
    // budget/brand/answers carried over.
    function renderWelcomeBack(cat) {
      funnel.view = 'welcome';
      persistFunnel();
      clearBody();

      var screen = document.createElement('div');
      screen.className = 'welcome-screen';

      // Back prefix
      var prefix = document.createElement('div');
      prefix.className = 'welcome-back-prefix';
      prefix.innerHTML = icon('wave') + ' Welcome back';
      screen.appendChild(prefix);

      // Last explored
      var explored = document.createElement('div');
      explored.className = 'welcome-back-explored';
      explored.textContent = 'Last time you explored';
      screen.appendChild(explored);

      // Category
      var catEl = document.createElement('div');
      catEl.className = 'welcome-back-category';
      catEl.textContent = escapeHtml(cat.name);
      screen.appendChild(catEl);

      // Action cards
      var actions = [
        {
          icon: icon('bag'),
          title: 'Continue with ' + cat.name,
          desc: 'Pick up where you left off',
          fn: function () { selectCategory(cat); },
        },
        {
          icon: icon('folder'),
          title: 'Browse Categories',
          desc: 'Explore everything we offer',
          fn: function () {
            clearBody();
            appendAiBubble(naturalGreeting());
            renderCategoryGridAndChips();
            scrollToBottom();
          },
        },
        {
          icon: icon('refresh'),
          title: 'Something Else',
          desc: 'Start fresh with a new search',
          fn: function () { renderWelcome(); },
        },
      ];

      actions.forEach(function (card, i) {
        var el = document.createElement('button');
        el.type = 'button';
        el.className = 'welcome-card';
        el.setAttribute('style', '--i: ' + i);
        el.innerHTML =
          '<span class="welcome-card-icon">' + card.icon + '</span>' +
          '<span class="welcome-card-body">' +
            '<span class="welcome-card-title">' + escapeHtml(card.title) + '</span>' +
            '<span class="welcome-card-desc">' + escapeHtml(card.desc) + '</span>' +
          '</span>';
        el.addEventListener('click', card.fn);
        screen.appendChild(el);
      });

      body.appendChild(screen);
    }

    function renderEmptyConversation() {
      clearBody();

      var container = document.createElement('div');
      container.className = 'empty-conversation';

      var emptyIcon = document.createElement('div');
      emptyIcon.className = 'empty-conversation-icon';
      emptyIcon.innerHTML = icon('chat');
      container.appendChild(emptyIcon);

      var title = document.createElement('div');
      title.className = 'empty-conversation-title';
      title.textContent = 'How can I help you?';
      container.appendChild(title);

      var subtitle = document.createElement('div');
      subtitle.className = 'empty-conversation-subtitle';
      subtitle.textContent = "Ask me anything about our products, orders, or store policies. I'm here to help!";
      container.appendChild(subtitle);

      body.appendChild(container);
    }

    function selectCategory(cat) {
      funnel.categoryId = cat.id;
      funnel.categoryName = cat.name;
      funnel.answers = {};
      trackEvent('category_selected', { categoryId: cat.id, categoryName: cat.name });
      appendCustomerBubble(cat.name);
      // Show acknowledgment and render memory strip
      appendAiBubble(naturalAcknowledgeCategory(cat.name));
      updateMemoryStrip();
      fetchQualificationStep();
    }

    function fetchQualificationStep() {
      funnel.view = 'qualification';
      persistFunnel();
      showState('thinking');
      scrollToBottom();
      fetch(qualificationApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgetKey, categoryId: funnel.categoryId, answers: funnel.answers }),
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          removeTyping();
          if (data && data.done) {
            fetchRecommendations();
            return;
          }
          if (data && data.step) {
            renderQualificationStep(data.step);
          } else {
            fetchRecommendations();
          }
        })
        .catch(function () {
          removeTyping();
          fetchRecommendations();
        });
    }

    function renderQualificationStep(step) {
      renderMemoryStrip();
      // Use natural response templates for known question keys
      var questionMap = {
        budget: naturalAskBudget,
        brand: naturalAskBrand,
        skinType: naturalAskSkinType,
        hairType: naturalAskHairType,
      };
      var questionText = (questionMap[step.key] ? questionMap[step.key]() : step.question);
      appendAiBubble(questionText);
      var chipsWrap = document.createElement('div');
      chipsWrap.className = 'chips';
      (step.options || []).forEach(function (opt) {
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip';
        chip.innerHTML = (opt.icon || '') + (opt.icon ? ' ' : '') + escapeHtml(opt.label);
        chip.addEventListener('click', function () { answerQualificationStep(step, opt, chipsWrap); });
        chipsWrap.appendChild(chip);
      });
      body.appendChild(chipsWrap);
      scrollToBottom();
    }

    function answerQualificationStep(step, opt, chipsWrap) {
      Array.prototype.forEach.call(chipsWrap.querySelectorAll('.chip'), function (c) { c.disabled = true; });
      funnel.answers[step.key] = opt.value;
      persistFunnel();
      trackEvent('qualification_answered', { step: step.key, value: opt.value });
      if (step.key === 'budget') trackEvent('budget_selected', { value: opt.value });
      appendCustomerBubble(opt.label);
      updateMemoryStrip();
      fetchQualificationStep();
    }

    function fetchRecommendations() {
      showState('recommending');
      scrollToBottom();
      fetch(recommendApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgetKey, categoryId: funnel.categoryId, answers: funnel.answers }),
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          removeTyping();
          var products = Array.isArray(data && data.products) ? data.products : [];
          funnel.lastRecommendations = products;
          if (products.length === 0) {
            appendAiBubble(naturalNoProducts());
            funnel.view = 'conversation';
            persistFunnel();
            renderSuggestionChips([
              { icon: icon('refresh'), label: 'Increase budget', action: function () {
                delete funnel.answers.budget;
                persistFunnel();
                startDiscoveryFlow('increase budget');
              } },
              { icon: icon('search'), label: 'Browse similar', action: function () {
                renderWelcome();
              } },
              { icon: icon('chat'), label: 'Contact our team', action: function () {
                sendMessage('I need help contacting the team');
              } },
            ]);
            return;
          }
          renderRecommendations(products);
        })
        .catch(function () {
          removeTyping();
          appendAiBubble("I couldn\u2019t load recommendations right now \u2014 ask me anything and I\u2019ll help directly.");
          funnel.view = 'conversation';
          persistFunnel();
        });
    }

    function renderRecommendations(products) {
      funnel.view = 'recommendations';
      funnel.lastRecommendations = products;
      persistFunnel();

      var prior = shadow.getElementById('midevela-reco-block');
      if (prior) prior.remove();
      var priorBar = shadow.getElementById('midevela-compare-bar');
      if (priorBar) priorBar.remove();

      appendAiBubble(naturalRecommendationIntro());

      var block = document.createElement('div');
      block.id = 'midevela-reco-block';
      block.appendChild(renderRecoContainer(products, 'funnel'));
      body.appendChild(block);

      // Compare bar if 1+ products selected
      if (funnel.compareSelection.length > 0) {
        renderCompareBar();
      }

      renderSuggestionChips(recommendationFollowUpChips());

      trackEvent('recommendation_shown', { productIds: products.map(function (p) { return p.id; }) });
      scrollToBottom();
    }

    // ─── Compare Floating Bar ───
    function renderCompareBar() {
      var prior = shadow.getElementById('midevela-compare-bar');
      if (prior) prior.remove();

      var count = funnel.compareSelection.length;
      var bar = document.createElement('div');
      bar.id = 'midevela-compare-bar';
      bar.className = 'compare-bar';
      bar.innerHTML =
        '<div class="compare-bar-info">' +
          '<span class="compare-bar-count">' + count + '</span>' +
          '<span>' + count + ' Product' + (count !== 1 ? 's' : '') + ' Selected</span>' +
        '</div>' +
        '<button type="button" class="compare-bar-btn"' + (count < 2 ? ' disabled' : '') + '>' +
          'Compare' +
        '</button>';

      var btn = bar.querySelector('.compare-bar-btn');
      if (btn && count === 2) {
        btn.addEventListener('click', function () { runCompare(); });
      }

      body.appendChild(bar);
    }

    function removeCompareBar() {
      var el = shadow.getElementById('midevela-compare-bar');
      if (el) el.remove();
    }

    // ─── Free-form conversation (typed messages bypass the funnel anytime) ───
    function sendMessage(raw) {
      var text = String(raw || '').trim();
      if (!text) return;

      var isFirstMessage = !funnel.conversationStarted;
      funnel.conversationStarted = true;
      funnel.view = 'conversation';
      persistFunnel();
      markActivity();
      if (isFirstMessage) trackEvent('conversation_started', {});

      // Natural closing — handle "thank you" gracefully
      var lowerSend = text.toLowerCase().trim();
      if (lowerSend === 'thank you' || lowerSend === 'thanks' || lowerSend === 'thank you!' ||
          lowerSend === 'thanks!' || lowerSend === 'thank you very much' || lowerSend === 'ty') {
        appendCustomerBubble(text);
        scrollToBottom();
        removeTyping();
        appendAiBubble("You\u2019re very welcome! I hope you find exactly what you\u2019re looking for.\n\nHave a wonderful day! \uD83D\uDE0A", null);
        scrollToBottom();
        return;
      }

      // Smart recovery — when customer says "no" after a suggestion
      if ((lowerSend === 'no' || lowerSend === 'nope' || lowerSend === 'nah' || lowerSend === 'not really') &&
          funnel.lastRecommendations && funnel.lastRecommendations.length > 0) {
        appendCustomerBubble(text);
        scrollToBottom();
        appendAiBubble("No problem! Would you like something cheaper, or would you like a different category?", null);
        renderSuggestionChips([
          { icon: icon('wallet'), label: 'Something cheaper', action: function () {
            delete funnel.answers.budget; persistFunnel();
            startDiscoveryFlow('cheaper');
          }},
          { icon: icon('refresh'), label: 'Different category', action: function () { renderWelcome(); }},
          { icon: icon('chat'), label: 'Ask a question', action: function () { input.focus(); }},
        ]);
        return;
      }

      // Escalation detection — handle client-side for instant handoff
      var escText = lowerSend;
      var isEscalation = escText.indexOf('speak to') !== -1 || escText.indexOf('talk to') !== -1 ||
        escText.indexOf('customer service') !== -1 || escText.indexOf('customer support') !== -1 ||
        escText.indexOf('transfer me') !== -1 || escText.indexOf('connect me') !== -1 ||
        escText.indexOf('i want a human') !== -1 || escText.indexOf('i need a human') !== -1 ||
        escText.indexOf('real person') !== -1 || escText.indexOf('real agent') !== -1 ||
        escText.indexOf('live agent') !== -1 || escText.indexOf('representative') !== -1 ||
        escText.indexOf('refund') !== -1 || escText.indexOf('cancel my') !== -1;
      if (isEscalation) {
        appendCustomerBubble(text);
        scrollToBottom();
        showState('answering');
        scrollToBottom();
        setTimeout(function () {
          removeTyping();
          renderFullEscalation();
        }, 1000);
        return;
      }

      // Check if this is a shopping intent that can use adaptive discovery
      var shoppingIndicators = ['need', 'looking for', 'want', 'recommend', 'show me', 'find',
        'serum', 'moisturizer', 'cleanser', 'acne', 'dryness', 'budget', 'cheap',
        'product', 'skin', 'hair', 'face', 'body'];
      var lowerText = text.toLowerCase();
      var isShoppingIntent = false;
      shoppingIndicators.forEach(function (word) {
        if (lowerText.indexOf(word) !== -1) isShoppingIntent = true;
      });

      // If this looks like shopping and we don't already have context, use discovery flow
      if (isFirstMessage && isShoppingIntent && !funnel.categoryId) {
        appendCustomerBubble(text);
        scrollToBottom();
        showState('thinking');
        scrollToBottom();
        // Parse intent from the message
        var intent = parseIntent(text);
        // Merge into funnel
        if (intent.categoryId) {
          funnel.categoryId = intent.categoryId;
          funnel.categoryName = intent.categoryName;
        }
        if (intent.productType && !funnel.answers.productType) funnel.answers.productType = intent.productType;
        if (intent.concern && !funnel.answers.concern) funnel.answers.concern = intent.concern;
        if (intent.budget && !funnel.answers.budget) funnel.answers.budget = intent.budget;
        if (intent.skinType && !funnel.answers.skinType) funnel.answers.skinType = intent.skinType;
        if (intent.brand && !funnel.answers.brand) funnel.answers.brand = intent.brand;
        persistFunnel();
        removeTyping();

        // Show acknowledgment of what we understood
        var ackParts = [];
        if (funnel.answers.productType) ackParts.push(funnel.answers.productType);
        if (funnel.answers.concern) ackParts.push('for ' + funnel.answers.concern);
        if (funnel.answers.budget) ackParts.push('under ' + funnel.answers.budget);
        var ackText = ackParts.length > 0
          ? 'I\u2019d be happy to help! Let\u2019s find the perfect ' + ackParts.join(' ') + ' for you.'
          : 'I\u2019d be happy to help you find what you\u2019re looking for!';
        appendAiBubble(ackText);

        // Continue with adaptive discovery
        var missing = determineMissingFields();
        updateContextBar();
        updateProgressBar();
        if (missing.length === 0 ||
            (missing.length === 1 && (missing[0] === 'brand' || missing[0] === 'budget' || missing[0] === 'skinType'))) {
          // Enough info to recommend directly
          removeContextBar();
          fetchRecommendations();
        } else {
          askDiscoveryQuestion(missing[0]);
        }
        return;
      }

      // Fall back to standard chat API for non-shopping or follow-up messages
      var stateKey = 'thinking';
      var lower = text.toLowerCase();
      if (lower.indexOf('compar') !== -1 || lower.indexOf('vs ') !== -1) stateKey = 'comparing';
      else if (lower.indexOf('cheap') !== -1 || lower.indexOf('affordable') !== -1 || lower.indexOf('budget') !== -1) stateKey = 'searching';
      else if (lower.indexOf('shipping') !== -1 || lower.indexOf('return') !== -1 || lower.indexOf('delivery') !== -1 || lower.indexOf('contact') !== -1) stateKey = 'answering';
      else if (lower.indexOf('recommend') !== -1 || lower.indexOf('suggest') !== -1 || lower.indexOf('best') !== -1) stateKey = 'searching';

      appendCustomerBubble(text);
      scrollToBottom();
      showState(stateKey);
      scrollToBottom();

      var contextPatch = isFirstMessage
        ? {
            categoryId: funnel.categoryId,
            categoryName: funnel.categoryName,
            budget: funnel.answers.budget,
            brand: funnel.answers.brand,
            answers: funnel.answers,
          }
        : undefined;

      fetch(chatApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgetKey, customerId, messageText: text, context: contextPatch }),
      })
        .then(function (res) {
          if (!res.ok) throw new Error('Widget API request failed with status ' + res.status);
          return res.json();
        })
        .then(function (data) {
          removeTyping();
          handleAIResponse(data);
        })
        .catch(function (err) {
          console.error('Midevela widget error:', err);
          removeTyping();
          appendAiBubble("Sorry, I\u2019m having trouble connecting right now. Please try again in a moment.");
        });
    }

    // ─── Business Cards ───
    function renderVerifiedBadge() {
      var b = document.createElement('div');
      b.className = 'verified-badge';
      b.innerHTML = icon('check') + ' Verified Business Information';
      return b;
    }

    function renderContinueShoppingCTA() {
      var wrap = document.createElement('div');
      wrap.className = 'continue-cta';
      var btn = document.createElement('button');
      btn.className = 'continue-cta-btn';
      btn.textContent = 'Continue Shopping';
      btn.addEventListener('click', function () {
        if (funnel.categoryId) {
          selectCategory({ id: funnel.categoryId, name: funnel.categoryName });
        } else {
          renderWelcome();
        }
      });
      wrap.appendChild(btn);
      return wrap;
    }

    function renderInfoCard(cardIcon, title, body, linkText, linkUrl) {
      var card = document.createElement('div');
      card.className = 'business-card';
      card.innerHTML =
        '<div class="business-card-header">' +
          '<span class="business-card-icon">' + cardIcon + '</span>' +
          '<span class="business-card-title">' + escapeHtml(title) + '</span>' +
        '</div>' +
        '<div class="business-card-body">' + escapeHtml(body) + '</div>' +
        (linkText ? '<a class="business-card-link" href="' + safeUrl(linkUrl) + '" target="_blank">' + escapeHtml(linkText) + ' ' + icon('arrow-right') + '</a>' : '');
      return card;
    }

    function renderShippingCard(text) {
      var clean = text.replace(/^Yes(!|,)?\s*/i, '').trim();
      var card = document.createElement('div');
      card.className = 'business-card';
      card.innerHTML =
        '<div class="business-card-header">' +
          '<span class="business-card-icon">' + icon('truck') + '</span>' +
          '<span class="business-card-title">Shipping</span>' +
        '</div>' +
        '<div class="business-card-body">' + escapeHtml(clean) + '</div>';
      return card;
    }

    function renderReturnsCard(text) {
      var card = document.createElement('div');
      card.className = 'business-card';
      card.innerHTML =
        '<div class="business-card-header">' +
          '<span class="business-card-icon">' + icon('package') + '</span>' +
          '<span class="business-card-title">Returns Policy</span>' +
        '</div>' +
        '<div class="business-card-body">' + escapeHtml(text) + '</div>';
      return card;
    }

    function renderPaymentCard(text) {
      var methods = [];
      if (text.indexOf('Visa') !== -1) methods.push('Visa');
      if (text.indexOf('Mastercard') !== -1) methods.push('Mastercard');
      if (text.indexOf('Apple Pay') !== -1) methods.push('Apple Pay');
      if (text.indexOf('PayPal') !== -1) methods.push('PayPal');
      var list = methods.map(function (m) { return '<li>' + escapeHtml(m) + '</li>'; }).join('');
      var card = document.createElement('div');
      card.className = 'business-card';
      card.innerHTML =
        '<div class="business-card-header">' +
          '<span class="business-card-icon">' + icon('card') + '</span>' +
          '<span class="business-card-title">Payment Methods</span>' +
        '</div>' +
        '<ul class="business-card-list">' + list + '</ul>';
      return card;
    }

    function renderWarrantyCard(text) {
      var card = document.createElement('div');
      card.className = 'business-card';
      card.innerHTML =
        '<div class="business-card-header">' +
          '<span class="business-card-icon">' + icon('shield') + '</span>' +
          '<span class="business-card-title">Warranty</span>' +
        '</div>' +
        '<div class="business-card-body">' + escapeHtml(text) + '</div>';
      return card;
    }

    function renderHoursCard(text) {
      var isOpen = text.toLowerCase().indexOf('open') !== -1 &&
                   text.toLowerCase().indexOf('close') === -1 &&
                   text.toLowerCase().indexOf('closed') === -1;
      var statusClass = isOpen ? 'open' : 'closed';
      var statusText = isOpen ? 'Open Now' : 'Closed';
      var clean = text.replace(/^(yes|currently|we'?re)\s*/i, '').trim();
      var card = document.createElement('div');
      card.className = 'hours-card';
      card.innerHTML =
        '<div class="hours-row">' +
          '<div class="hours-status ' + statusClass + '">' +
            '<span class="hours-dot ' + statusClass + '"></span>' +
            '<span>' + statusText + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="hours-today">' + escapeHtml(clean) + '</div>';
      return card;
    }

    function renderContactCard() {
      var phone = config.business && config.business.phone;
      var whatsapp = config.business && config.business.whatsapp;
      var email = config.business && config.business.email;
      var card = document.createElement('div');
      card.className = 'contact-card';
      card.innerHTML =
        '<div class="contact-card-title">Need Human Assistance?</div>' +
        '<div class="contact-card-subtitle">Our team would be happy to help.</div>' +
        '<div class="contact-card-actions">' +
          (whatsapp ? '<a class="contact-btn" href="' + safeUrl(whatsapp) + '" target="_blank">' +
            '<span class="contact-btn-icon">' + icon('chat') + '</span>' +
            '<span class="contact-btn-label">WhatsApp</span></a>' : '') +
          (phone ? '<a class="contact-btn" href="tel:' + escapeHtml(String(phone).replace(/[^+\d]/g, '')) + '">' +
            '<span class="contact-btn-icon">' + icon('phone') + '</span>' +
            '<span class="contact-btn-label">Call</span></a>' : '') +
          (email ? '<a class="contact-btn" href="mailto:' + escapeHtml(email) + '">' +
            '<span class="contact-btn-icon">' + icon('mail') + '</span>' +
            '<span class="contact-btn-label">Email</span></a>' : '') +
        '</div>';
      return card;
    }

    function renderEscalationCard() {
      var phone = config.business && config.business.phone;
      var whatsapp = config.business && config.business.whatsapp;
      var email = config.business && config.business.email;
      var card = document.createElement('div');
      card.className = 'escalation-card';
      card.innerHTML =
        '<div class="escalation-card-title">Need Personal Assistance?</div>' +
        '<div class="escalation-card-subtitle">Our team would be happy to help.</div>' +
        '<div class="escalation-actions">' +
          (whatsapp ? '<a class="escalation-btn escalation-btn-whatsapp" href="' + safeUrl(whatsapp) + '" target="_blank">' +
            '<span class="escalation-btn-icon">' + icon('chat') + '</span><span>WhatsApp</span></a>' : '') +
          (phone ? '<a class="escalation-btn escalation-btn-call" href="tel:' + escapeHtml(String(phone).replace(/[^+\d]/g, '')) + '">' +
            '<span class="escalation-btn-icon">' + icon('phone') + '</span><span>Call</span></a>' : '') +
          (email ? '<a class="escalation-btn escalation-btn-email" href="mailto:' + escapeHtml(email) + '">' +
            '<span class="escalation-btn-icon">' + icon('mail') + '</span><span>Email</span></a>' : '') +
        '</div>';
      return card;
    }

    function renderUnknownAnswerCard() {
      var phone = config.business && config.business.phone;
      var whatsapp = config.business && config.business.whatsapp;
      var email = config.business && config.business.email;
      var card = document.createElement('div');
      card.className = 'business-unknown-card';
      card.innerHTML =
        '<div class="business-unknown-text">I couldn\u2019t find verified information about that. Would you like me to connect you with our team?</div>' +
        '<div class="business-unknown-actions">' +
          (whatsapp ? '<a class="contact-btn" href="' + safeUrl(whatsapp) + '" target="_blank">' +
            '<span class="contact-btn-icon">' + icon('chat') + '</span>' +
            '<span class="contact-btn-label">WhatsApp</span></a>' : '') +
          (phone ? '<a class="contact-btn" href="tel:' + escapeHtml(String(phone).replace(/[^+\d]/g, '')) + '">' +
            '<span class="contact-btn-icon">' + icon('phone') + '</span>' +
            '<span class="contact-btn-label">Call</span></a>' : '') +
          (email ? '<a class="contact-btn" href="mailto:' + escapeHtml(email) + '">' +
            '<span class="contact-btn-icon">' + icon('mail') + '</span>' +
            '<span class="contact-btn-label">Email</span></a>' : '') +
        '</div>';
      return card;
    }

    function renderFAQAccordion(items) {
      var acc = document.createElement('div');
      acc.className = 'faq-accordion';
      items.forEach(function (item) {
        var faq = document.createElement('div');
        faq.className = 'faq-item';
        var q = document.createElement('button');
        q.className = 'faq-question';
        q.textContent = item.q;
        q.addEventListener('click', function () { faq.classList.toggle('open'); });
        var a = document.createElement('div');
        a.className = 'faq-answer';
        var at = document.createElement('div');
        at.className = 'faq-answer-text';
        at.textContent = item.a;
        a.appendChild(at);
        faq.appendChild(q);
        faq.appendChild(a);
        acc.appendChild(faq);
      });
      return acc;
    }

    function detectBusinessIntent(text) {
      var lower = text.toLowerCase();
      if (lower.indexOf('deliver') !== -1 || lower.indexOf('shipping') !== -1 || lower.indexOf('ship to') !== -1) return 'shipping';
      if (lower.indexOf('return') !== -1 && (lower.indexOf('policy') !== -1 || lower.indexOf('day') !== -1 || lower.indexOf('accepted') !== -1)) return 'returns';
      if ((lower.indexOf('payment') !== -1 || lower.indexOf('pay') !== -1) && (lower.indexOf('visa') !== -1 || lower.indexOf('mastercard') !== -1 || lower.indexOf('paypal') !== -1 || lower.indexOf('apple pay') !== -1)) return 'payment';
      if (lower.indexOf('warranty') !== -1) return 'warranty';
      if ((lower.indexOf('hour') !== -1 || lower.indexOf('open today') !== -1 || lower.indexOf('close') !== -1) && (lower.indexOf('am') !== -1 || lower.indexOf('pm') !== -1 || lower.indexOf('today') !== -1)) return 'hours';
      if (lower.indexOf('speak') !== -1 || lower.indexOf('human') !== -1 || lower.indexOf('person') !== -1 || (lower.indexOf('talk') !== -1 && lower.indexOf('someone') !== -1)) return 'contact';
      if (lower.indexOf('located') !== -1 || lower.indexOf('address') !== -1 || lower.indexOf('where are you') !== -1) return 'store';
      if (lower.indexOf('couldn\'t find') !== -1 || lower.indexOf('couldn\'t verify') !== -1 || lower.indexOf('no verified') !== -1) return 'unknown';
      if (lower.indexOf('policy') !== -1 || lower.indexOf('privacy') !== -1) return 'policy';
      if (lower.indexOf('faq') !== -1 || lower.indexOf('frequent') !== -1) return 'faq';
      return null;
    }

    function renderBusinessResponse(intent, text) {
      var container = document.createElement('div');
      switch (intent) {
        case 'shipping':
          container.appendChild(renderShippingCard(text));
          break;
        case 'returns':
          container.appendChild(renderReturnsCard(text));
          break;
        case 'payment':
          container.appendChild(renderPaymentCard(text));
          break;
        case 'hours':
          container.appendChild(renderHoursCard(text));
          break;
        case 'warranty':
          container.appendChild(renderWarrantyCard(text));
          break;
        case 'store':
          container.appendChild(renderInfoCard(icon('pin'), 'Our Location', text));
          break;
        case 'contact':
          container.appendChild(renderContactCard());
          break;
        case 'unknown':
          container.appendChild(renderUnknownAnswerCard());
          break;
        case 'policy':
          container.appendChild(renderPolicyCard(text));
          break;
        case 'faq':
          container.appendChild(renderFAQAccordion([
            { q: 'What is your shipping policy?', a: 'We deliver worldwide. Delivery times vary by location.' },
            { q: 'What is your return policy?', a: 'Returns accepted within 30 days of delivery.' },
            { q: 'What payment methods do you accept?', a: 'We accept Visa, Mastercard, Apple Pay, and PayPal.' },
          ]));
          break;
        default:
          container.appendChild(renderInfoCard(icon('info'), 'Business Information', text));
      }
      if (intent !== 'unknown' && intent !== 'contact' && intent !== 'faq') {
        container.appendChild(renderVerifiedBadge());
      }
      container.appendChild(renderContinueShoppingCTA());
      body.appendChild(container);
    }

    function renderPolicyCard(text) {
      var card = document.createElement('div');
      card.className = 'policy-card';
      var label = text.indexOf('privacy') !== -1 ? 'Privacy Policy' : 'Policies';
      card.innerHTML =
        '<div class="policy-card-text">' + icon('file') + ' ' + escapeHtml(label) + '</div>' +
        '<span class="policy-card-arrow">' + icon('chevron-right') + '</span>';
      card.addEventListener('click', function () {
        card.classList.toggle('open');
        var existing = card.querySelector('.policy-card-body');
        if (existing) { existing.remove(); return; }
        var body = document.createElement('div');
        body.className = 'business-card-body';
        body.style.padding = '10px 0 0';
        body.textContent = text;
        card.appendChild(body);
      });
      return card;
    }

    // ─── Human Handoff / Escalation ───
    function renderContactMethodCard(method, label, value, disabled) {
      var card = document.createElement('a');
      card.className = 'contact-method-card' + (disabled ? ' disabled' : '') + ' ' + method;
      if (!disabled && value) {
        if (method === 'whatsapp') { card.href = value; }
        else if (method === 'phone') { card.href = 'tel:' + String(value).replace(/[^+\d]/g, ''); }
        else if (method === 'email') { card.href = 'mailto:' + value; }
        card.target = '_blank';
      }
      var iconMap = { whatsapp: icon('chat'), phone: icon('phone'), email: icon('mail'), livechat: icon('chat') };
      card.innerHTML =
        '<span class="contact-method-card-icon">' + (iconMap[method] || '') + '</span>' +
        '<span class="contact-method-card-label">' + escapeHtml(label) + '</span>' +
        (disabled ? '<span class="contact-method-card-badge">Coming Soon</span>' : '');
      return card;
    }

    function renderConversationSummary() {
      var rows = [];
      if (funnel.categoryName) rows.push({ label: 'Category', value: funnel.categoryName });
      if (funnel.answers.budget) rows.push({ label: 'Budget', value: funnel.answers.budget });
      if (funnel.answers.brand) rows.push({ label: 'Brand', value: funnel.answers.brand });
      if (funnel.answers.skinType) rows.push({ label: 'Skin Type', value: funnel.answers.skinType });
      if (funnel.answers.concern) rows.push({ label: 'Concern', value: funnel.answers.concern });
      if (rows.length === 0) return null;
      var card = document.createElement('div');
      card.className = 'conversation-summary';
      var html = '<div class="conversation-summary-title">Conversation Summary</div>';
      rows.forEach(function (r) {
        html += '<div class="summary-row"><span class="summary-label">' + escapeHtml(r.label) + '</span><span class="summary-value">' + escapeHtml(r.value) + '</span></div>';
      });
      card.innerHTML = html;
      return card;
    }

    function renderBusinessAvailability() {
      var card = document.createElement('div');
      card.className = 'availability-card';
      card.innerHTML =
        '<div class="availability-item">' +
          '<span class="availability-label">Hours</span>' +
          '<span class="availability-value">Mon\u2013Fri, 9:00 AM \u2013 6:00 PM</span>' +
        '</div>' +
        '<div class="availability-item">' +
          '<span class="availability-label">Response Time</span>' +
          '<span class="availability-value">Under 10 minutes</span>' +
        '</div>';
      return card;
    }

    function renderEscalationBottomActions() {
      var wrap = document.createElement('div');
      wrap.className = 'escalation-actions-bottom';
      var actions = [
        { label: 'Continue Shopping', icon: icon('bag'), fn: function () {
          if (funnel.categoryId) {
            selectCategory({ id: funnel.categoryId, name: funnel.categoryName });
          } else {
            renderWelcome();
          }
        }},
        { label: 'Start New Search', icon: icon('search'), fn: function () {
          funnel.categoryId = null;
          funnel.categoryName = null;
          funnel.answers = {};
          funnel.view = 'welcome';
          persistFunnel();
          clearBody();
          renderWelcome();
        }},
        { label: 'Close Chat', icon: icon('x'), fn: function () {
          chat.classList.remove('open');
          fab.classList.remove('open');
        }},
      ];
      actions.forEach(function (a) {
        var btn = document.createElement('button');
        btn.className = 'escalation-action-btn';
        btn.innerHTML = a.icon + ' ' + escapeHtml(a.label);
        btn.addEventListener('click', a.fn);
        wrap.appendChild(btn);
      });
      return wrap;
    }

    function renderFullEscalation() {
      var msg = document.createElement('div');
      msg.className = 'escalation-message';
      msg.textContent = "I\u2019d like to connect you with our team so they can give you the most accurate answer.";
      body.appendChild(msg);
      var summary = renderConversationSummary();
      if (summary) body.appendChild(summary);
      body.appendChild(renderBusinessAvailability());
      var methodsWrap = document.createElement('div');
      methodsWrap.className = 'contact-methods';
      var phone = config.business && config.business.phone;
      var whatsapp = config.business && config.business.whatsapp;
      var email = config.business && config.business.email;
      if (whatsapp) methodsWrap.appendChild(renderContactMethodCard('whatsapp', 'Chat on WhatsApp', whatsapp));
      if (phone) methodsWrap.appendChild(renderContactMethodCard('phone', 'Call Business', phone));
      if (email) methodsWrap.appendChild(renderContactMethodCard('email', 'Send Email', email));
      methodsWrap.appendChild(renderContactMethodCard('livechat', 'Live Chat', null, true));
      body.appendChild(methodsWrap);
      var closing = document.createElement('div');
      closing.className = 'escalation-closing';
      closing.innerHTML =
        '<div class="escalation-closing-title">You\u2019re all set.</div>' +
        '<div class="escalation-closing-sub">I\u2019ve prepared everything for our team. Tap any option below.</div>';
      body.appendChild(closing);
      body.appendChild(renderEscalationBottomActions());
      scrollToBottom();
    }

    // ─── Typewriter, Celebration, Checkout, Recovery ───
    function typewriterText(el, text, speed, callback) {
      var i = 0;
      el.textContent = '';
      el.classList.add('streaming-text');
      function tick() {
        if (i < text.length) {
          el.textContent += text.charAt(i);
          i++;
          setTimeout(tick, speed || 20);
        } else {
          el.classList.remove('streaming-text');
          if (typeof callback === 'function') callback();
        }
      }
      tick();
    }

    function renderSuccessCelebration(product) {
      var el = document.createElement('div');
      el.className = 'success-celebration';
      el.innerHTML =
        '<div class="success-icon">' + icon('party') + '</div>' +
        '<div class="success-title">Excellent choice!</div>' +
        '<div class="success-sub">I think this product fits what you\u2019re looking for.</div>';
      return el;
    }

    function renderCheckoutScreen(product) {
      if (!product) return null;
      var block = document.createElement('div');
      var imageUrl = isHttpUrl(product.imageUrl) ? product.imageUrl : '';
      var card = document.createElement('div');
      card.className = 'checkout-card';
      card.innerHTML =
        (imageUrl ? '<img class="checkout-img" src="' + escapeHtml(imageUrl) + '" alt="' + escapeHtml(product.name || '') + '" loading="lazy">' : '<div class="checkout-img">\uD83D\uDCE6</div>') +
        '<div class="checkout-info">' +
          '<div class="checkout-name">' + escapeHtml(product.name || '') + '</div>' +
          (product.price ? '<div class="checkout-price">' + escapeHtml(product.price) + '</div>' : '') +
        '</div>';
      block.appendChild(card);
      var actions = document.createElement('div');
      actions.className = 'checkout-actions';
      var viewBtn = document.createElement('a');
      if (isHttpUrl(product.url)) {
        viewBtn.href = product.url;
        viewBtn.target = '_blank';
      }
      viewBtn.className = 'continue-cta-btn btn-press ripple';
      viewBtn.innerHTML = 'View Product ' + icon('arrow-right');
      viewBtn.style.flex = '1';
      actions.appendChild(viewBtn);
      var shopBtn = document.createElement('button');
      shopBtn.className = 'escalation-action-btn btn-press';
      shopBtn.innerHTML = icon('bag') + ' Continue Shopping';
      shopBtn.addEventListener('click', function () {
        if (funnel.categoryId) {
          selectCategory({ id: funnel.categoryId, name: funnel.categoryName });
        } else {
          renderWelcome();
        }
      });
      actions.appendChild(shopBtn);
      block.appendChild(actions);
      return block;
    }

    function renderEmptyResultRecovery() {
      var el = document.createElement('div');
      el.className = 'business-unknown-card';
      el.innerHTML =
        '<div class="success-icon" style="font-size:28px;">' + icon('alert-circle') + '</div>' +
        '<div class="business-unknown-text">I couldn\u2019t find something that matches exactly.\nLet\u2019s widen the search.</div>';
      body.appendChild(el);
      renderSuggestionChips([
        { icon: icon('wallet'), label: 'Increase budget', action: function () {
          delete funnel.answers.budget; persistFunnel();
          if (funnel.categoryId) selectCategory({ id: funnel.categoryId, name: funnel.categoryName });
          else renderWelcome();
        }},
        { icon: icon('search'), label: 'Show similar', action: function () {
          delete funnel.answers.productType; delete funnel.answers.concern; persistFunnel();
          if (funnel.categoryId) selectCategory({ id: funnel.categoryId, name: funnel.categoryName });
          else renderWelcome();
        }},
        { icon: icon('refresh'), label: 'Start again', action: function () { renderWelcome(); }},
        { icon: icon('chat'), label: 'Ask a question', action: function () { input.focus(); }},
      ]);
    }

    function handleAIResponse(data) {
      if (data && data.isNewConversation) {
        resetVisitLocalState();
      }

      var replyText = (data && data.replyText) || "Sorry, I didn\u2019t quite catch that. Could you rephrase?";
      var recommendations = Array.isArray(data && data.recommendations) ? data.recommendations : [];

      if (data && data.contextSnapshot) {
        if (data.contextSnapshot.categoryName) funnel.categoryName = data.contextSnapshot.categoryName;
        if (data.contextSnapshot.answers) funnel.answers = data.contextSnapshot.answers;
        if (data.contextSnapshot.categoryId) funnel.categoryId = data.contextSnapshot.categoryId;
        persistFunnel();
        updateContextBar();
      }

      if (recommendations.length > 0) {
        appendAiBubble(naturalRecommendationIntro());
        var container = renderRecoContainer(recommendations, 'chat');
        var block = document.createElement('div');
        block.id = 'midevela-reco-block';
        block.appendChild(container);
        body.appendChild(block);
        renderSuggestionChips(recommendationFollowUpChips());
        funnel.lastRecommendations = recommendations;
      } else {
        var intent = detectBusinessIntent(replyText);
        if (intent) {
          renderBusinessResponse(intent, replyText);
        } else {
          appendAiBubble(replyText);
          var lowerReply = replyText.toLowerCase();
          var chips = [];
          if (lowerReply.indexOf('product') !== -1 || lowerReply.indexOf('recommend') !== -1) {
            chips = recommendationFollowUpChips();
          }
          if (chips.length > 0) {
            renderSuggestionChips(chips);
          }
        }
      }

      updateMemoryStrip();
      scrollToBottom();
    }

    const handleSend = () => {
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      sendMessage(text);
    };

    send.addEventListener('click', handleSend);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.isComposing) {
        if (e.shiftKey) {
          // Shift+Enter: insert newline
          return;
        }
        e.preventDefault();
        handleSend();
      }
    });

    // ─── Boot: fresh welcome, or resume a saved funnel/conversation ───
    // A shopper who never picked a category (used "Ask anything" straight
    // away) still has a real conversation going — resuming must not
    // require categoryId, or every page reload/navigation would re-show
    // the full welcome card and repeat the opening line verbatim, which
    // reads as robotic rather than a salesperson picking up where they
    // left off.
    // A visit that's gone idle 30+ minutes is over: wipe anything that
    // would otherwise resume it, so this boot falls through to the plain
    // "What are you shopping for today?" welcome below, and the proactive
    // open fires again as if for a brand-new visitor.
    if (isNewVisit()) {
      resetVisitLocalState();
    }

    const saved = loadFunnelState();
    if (saved && (saved.view === 'recommendations' || saved.view === 'conversation')) {
      funnel.categoryId = saved.categoryId || null;
      funnel.categoryName = saved.categoryName || null;
      funnel.answers = saved.answers || {};
      funnel.view = 'conversation';
      clearBody();
      var welcomeBackText = saved.categoryName
        ? naturalWelcomeBack(saved.categoryName)
        : "Welcome back! What else can I help you find?";
      appendAiBubble(welcomeBackText);
      renderMemoryStrip();
    } else if (saved && saved.categoryId && saved.view === 'qualification') {
      funnel.categoryId = saved.categoryId;
      funnel.categoryName = saved.categoryName;
      funnel.answers = saved.answers || {};
      clearBody();
      appendAiBubble(naturalResumeQualification(saved.categoryName));
      renderMemoryStrip();
      fetchQualificationStep();
    } else if (config.lastCategory) {
      renderWelcomeBack(config.lastCategory);
    } else {
      renderWelcome();
    }

    // Initial Back to Top state (hidden at page load)
    updateBackToTop();

    // Proactive engagement: open once per browser session after the
    // merchant-configured delay. 0 (or unset) disables it entirely.
    const delaySec = Number(config.settings.engagementDelay);
    if (Number.isFinite(delaySec) && delaySec > 0 && !hasAutoOpened()) {
      setTimeout(() => {
        if (!chat.classList.contains('open') && !hasAutoOpened()) {
          markAutoOpened();
          toggleChat(false);
        }
      }, delaySec * 1000);
    }

    // ─── History restoration — page reload / navigation ───
    // If the customer has an active conversation on the server, fetch the
    // recent transcript and replace the boot-time welcome with the actual
    // conversation. Best-effort: any failure falls back to the current UI.
    fetch(historyApiUrl + '?key=' + encodeURIComponent(widgetKey) + '&customerId=' + encodeURIComponent(customerId))
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (!data || !Array.isArray(data.messages) || data.messages.length === 0) return;

        clearBody();

        data.messages.forEach(function (msg) {
          if (msg.role === 'user') {
            appendCustomerBubble(msg.content);
          } else {
            var row = document.createElement('div');
            row.className = 'msg-row ai';
            var avatar = document.createElement('div');
            avatar.className = 'msg-avatar';
            avatar.innerHTML = icon('leaf');
            var col = document.createElement('div');
            col.className = 'msg-col';
            var sender = document.createElement('div');
            sender.className = 'msg-sender';
            sender.textContent = aiName;
            col.appendChild(sender);
            var bubble = document.createElement('div');
            bubble.className = 'msg-bubble';
            bubble.textContent = msg.content;
            col.appendChild(bubble);
            if (msg.recommendations && msg.recommendations.length > 0) {
              col.appendChild(renderRecoContainer(msg.recommendations, 'history'));
            }
            var time = document.createElement('span');
            time.className = 'msg-time';
            time.textContent = nowTime();
            col.appendChild(time);
            row.appendChild(avatar);
            row.appendChild(col);
            body.appendChild(row);
          }
        });

        // Restore memory from conversation data
        if (data.categoryName || data.answers) {
          if (data.categoryName) funnel.categoryName = data.categoryName;
          if (data.answers) funnel.answers = data.answers;
          persistFunnel();
          renderMemoryStrip();
        }

        funnel.conversationStarted = true;
        funnel.view = 'conversation';
        persistFunnel();
        scrollToBottom();
      })
      .catch(function () {
        /* history restore is best-effort — boot UI stays as-is */
      });
  }
})();
