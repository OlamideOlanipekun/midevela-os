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
      --primary: ${config.theme.accentColor};
      --on-primary: ${onPrimary};
      --bg: #ffffff;
      --bg-soft: #f8fafc;
      --text: #111827;
      --muted: #6b7280;
      --border: #e5e7eb;
      --card: #ffffff;
      --success: #22c55e;
      --error: #ef4444;
      --radius-xs: 8px;
      --radius-sm: 12px;
      --radius-md: 18px;
      --radius-lg: 20px;
      --radius-xl: 28px;
      --radius-full: 999px;
      --font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.06);
      --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.08);
      --shadow-lg: 0 12px 40px rgba(0, 0, 0, 0.12);
      --shadow-xl: 0 24px 60px rgba(0, 0, 0, 0.16);
      --bubble-shadow: 0 4px 18px rgba(0, 0, 0, 0.08);
      --user-gradient: linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 85%, #000) 100%);
      --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    /* ─── FAB LAUNCHER ─── */
    .fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      cursor: pointer;
      border: none;
      outline: none;
      background: var(--primary);
      border-radius: 22px;
      padding: 0;
      box-shadow: 0 8px 28px rgba(37, 99, 235, 0.28);
      transition: transform 0.28s var(--ease-out), box-shadow 0.28s var(--ease-out);
      display: flex;
      align-items: center;
      font-family: var(--font);
      overflow: hidden;
    }

    .fab:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 36px rgba(37, 99, 235, 0.35);
    }
    .fab:active { transform: scale(0.96); }

    .fab-inner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 20px;
      transition: opacity 0.2s var(--ease-out), transform 0.2s var(--ease-out);
    }

    .fab.open .fab-inner {
      opacity: 0;
      transform: scale(0.8);
      pointer-events: none;
    }

    .fab-icon {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .fab-icon svg { width: 16px; height: 16px; fill: var(--on-primary); }

    .fab-text { text-align: left; color: var(--on-primary); }
    .fab-text-top { font-size: 13px; font-weight: 500; opacity: 0.9; display: block; line-height: 1.3; }
    .fab-text-bot { font-size: 15px; font-weight: 700; display: block; line-height: 1.3; }

    .fab-close-icon {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transform: scale(0.5);
      transition: opacity 0.2s var(--ease-out), transform 0.2s var(--ease-out);
      pointer-events: none;
    }
    .fab-close-icon svg { width: 22px; height: 22px; fill: var(--on-primary); }
    .fab.open .fab-close-icon {
      opacity: 1;
      transform: scale(1);
      pointer-events: auto;
    }

    .fab-pulse-ring {
      position: absolute;
      inset: -4px;
      border-radius: 24px;
      border: 2px solid var(--primary);
      animation: pulseRing 2.4s infinite;
      pointer-events: none;
    }

    @keyframes pulseRing {
      0% { transform: scale(1); opacity: 0.35; }
      100% { transform: scale(1.5); opacity: 0; }
    }

    .backdrop { display: none; }

    /* ─── CHAT PANEL ─── */
    .chat-panel {
      position: fixed;
      top: 50%;
      right: 24px;
      transform: translateY(-50%) translateX(calc(100% + 24px));
      width: 400px;
      height: min(700px, calc(100vh - 48px));
      max-width: calc(100vw - 48px);
      background: var(--bg);
      border-radius: var(--radius-xl);
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

    /* ─── HEADER ─── */
    .header {
      padding: 18px 20px 14px;
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
      gap: 10px;
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
      font-size: 14px;
      flex-shrink: 0;
    }

    .header-name {
      font-size: 14px;
      font-weight: 700;
      color: var(--text);
      line-height: 1.2;
    }

    .header-subtitle {
      font-size: 11px;
      color: var(--muted);
      line-height: 1.3;
      margin-top: 1px;
    }

    .header-status {
      font-size: 11px;
      color: var(--muted);
      display: flex;
      align-items: center;
      gap: 5px;
      margin-top: 2px;
    }

    .header-status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--success);
    }

    .header-actions {
      display: flex;
      gap: 2px;
    }

    .header-btn {
      background: none;
      border: none;
      width: 30px;
      height: 30px;
      border-radius: var(--radius-xs);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--muted);
      transition: background 0.18s var(--ease-out), color 0.18s;
    }
    .header-btn:hover { background: var(--bg-soft); color: var(--text); }
    .header-btn svg { width: 16px; height: 16px; fill: currentColor; }

    .header-divider {
      height: 1px;
      background: var(--border);
      margin-top: 12px;
      opacity: 0.6;
    }

    /* ─── BODY ─── */
    .body {
      flex: 1;
      overflow-y: auto;
      padding: 20px 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      background: var(--bg-soft);
      scroll-behavior: smooth;
    }

    .body::-webkit-scrollbar { display: none; }
    .body { scrollbar-width: none; }

    /* ─── MESSAGES ─── */
    .msg-row {
      display: flex;
      gap: 10px;
      max-width: 82%;
      animation: msgIn 0.25s var(--ease-out) both;
      margin-bottom: 10px;
    }
    .msg-row.ai { align-self: flex-start; }
    .msg-row.customer { align-self: flex-end; }

    @keyframes msgIn {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .msg-avatar {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 70%, #000) 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      flex-shrink: 0;
      align-self: flex-start;
      margin-top: 3px;
    }

    .msg-col { display: flex; flex-direction: column; min-width: 0; max-width: 100%; gap: 2px; }
    .customer .msg-col { align-items: flex-end; }

    .msg-sender {
      font-size: 12px;
      font-weight: 600;
      color: var(--muted);
      letter-spacing: 0.01em;
      margin-left: 2px;
    }

    .msg-bubble {
      font-size: 14px;
      line-height: 1.6;
      color: var(--text);
      word-wrap: break-word;
      overflow-wrap: anywhere;
    }

    .ai .msg-bubble {
      background: var(--bg);
      color: var(--text);
      border-radius: var(--radius-lg);
      padding: 14px 16px;
      box-shadow: var(--bubble-shadow);
      white-space: pre-wrap;
    }

    .customer .msg-bubble {
      background: var(--user-gradient);
      color: var(--on-primary);
      border-radius: var(--radius-lg);
      border-bottom-right-radius: 4px;
      padding: 12px 16px;
      max-width: 78%;
    }

    .msg-time {
      font-size: 11px;
      color: var(--muted);
      margin-top: 6px;
      opacity: 0.5;
    }
    .customer .msg-time { text-align: right; }

    /* ─── CHIPS (after message chip suggestions) ─── */
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding-left: 38px;
      margin-top: -6px;
      margin-bottom: 18px;
      animation: msgIn 0.3s var(--ease-out);
    }

    .chip {
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--text);
      border-radius: var(--radius-full);
      padding: 12px 16px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      font-family: var(--font);
      transition: background 0.18s, transform 0.18s, border-color 0.18s, box-shadow 0.18s;
    }
    .chip:hover { background: var(--bg-soft); border-color: var(--primary); transform: translateY(-1px); box-shadow: var(--bubble-shadow); }
    .chip:active { transform: scale(0.97); background: color-mix(in srgb, var(--primary) 6%, var(--bg)); }
    .chip:disabled { opacity: 0.4; cursor: default; transform: none; box-shadow: none; }

    /* ─── CATEGORY GRID ─── */
    .cat-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      padding-left: 36px;
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
      gap: 12px;
      overflow-x: auto;
      padding: 10px 0;
      width: 100%;
      scrollbar-width: none;
    }
    .reco-container::-webkit-scrollbar { display: none; }

    .reco-card {
      flex-shrink: 0;
      width: 170px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 18px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: transform 0.2s var(--ease-out), box-shadow 0.2s;
    }
    .reco-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.08);
    }
    .reco-card.selected { border-color: var(--primary); border-width: 2px; }

    .reco-img {
      width: 100%;
      height: 108px;
      background: var(--bg-soft);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      overflow: hidden;
      cursor: pointer;
    }
    .reco-img img { width: 100%; height: 100%; object-fit: cover; }

    .reco-body {
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
    }
    .reco-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: pointer;
    }
    .reco-price { font-size: 14px; color: var(--text); font-weight: 700; }
    .reco-why {
      font-size: 11px;
      color: var(--muted);
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      margin-bottom: 4px;
    }
    .reco-actions { display: flex; gap: 6px; }

    .reco-btn {
      flex: 1;
      display: block;
      text-align: center;
      padding: 9px;
      font-size: 12px;
      font-weight: 600;
      color: var(--on-primary);
      background: var(--primary);
      text-decoration: none;
      cursor: pointer;
      transition: filter 0.18s;
      border: none;
      border-radius: 0;
    }
    .reco-btn:hover { filter: brightness(0.92); }

    .reco-compare-btn {
      flex-shrink: 0;
      background: var(--bg);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 0;
      font-size: 11px;
      font-weight: 600;
      padding: 9px 8px;
      cursor: pointer;
      font-family: var(--font);
    }
    .reco-compare-btn.active { border-color: var(--primary); color: var(--primary); }

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

    /* ─── INPUT COMPOSER ─── */
    .input-area {
      padding: 12px 16px;
      background: var(--bg);
      flex-shrink: 0;
      border-top: 1px solid var(--border);
    }

    .input-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--bg-soft);
      border: 1.5px solid var(--border);
      border-radius: var(--radius-full);
      padding: 4px 4px 4px 16px;
      height: 48px;
      transition: border-color 0.2s, box-shadow 0.2s;
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
      font-size: 14px;
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
    <button class="fab" id="midevela-fab">
      <div class="fab-pulse-ring"></div>
      <span class="fab-inner">
        <span class="fab-icon">
          <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/></svg>
        </span>
        <span class="fab-text">
          <span class="fab-text-top">Need help shopping?</span>
          <span class="fab-text-bot">Ask ${escapeHtml(aiName)}</span>
        </span>
      </span>
      <span class="fab-close-icon">
        <svg viewBox="0 0 24 24"><path d="M18.3 5.71L12 12l6.3 6.29a1 1 0 11-1.42 1.42L12 13.41l-5.88 5.89a1 1 0 01-1.42-1.42L10.59 12 4.7 5.71a1 1 0 011.42-1.42L12 10.59l5.88-5.88a1 1 0 111.42 1.42z"/></svg>
      </span>
    </button>

    <div class="backdrop" id="midevela-backdrop"></div>

    <div class="chat-panel" id="midevela-chat">
      <div class="header">
        <div class="header-top">
          <div class="header-info">
            <div class="header-avatar">${escapeHtml(avatarLetter)}</div>
            <div>
              <div class="header-name">${escapeHtml(aiName)}</div>
              <div class="header-subtitle">Helping you shop smarter</div>
            </div>
          </div>
          <div class="header-actions">
            <button class="header-btn minimize-btn" id="midevela-minimize" aria-label="Minimize">
              <svg viewBox="0 0 24 24"><path d="M19 13H5v-2h14v2z"/></svg>
            </button>
            <button class="header-btn close-btn" id="midevela-close" aria-label="Close">
              <svg viewBox="0 0 24 24"><path d="M18.3 5.71L12 12l6.3 6.29a1 1 0 11-1.42 1.42L12 13.41l-5.88 5.89a1 1 0 01-1.42-1.42L10.59 12 4.7 5.71a1 1 0 011.42-1.42L12 10.59l5.88-5.88a1 1 0 111.42 1.42z"/></svg>
            </button>
          </div>
        </div>
        <div class="header-divider"></div>
      </div>

      <div class="body" id="midevela-body"></div>

      <div class="input-area">
        <div class="input-wrap">
          <button class="input-smiley-btn" aria-label="Emoji" type="button">😊</button>
          <input type="text" class="input-field" id="midevela-input" maxlength="2000" placeholder="Ask anything…" aria-label="Type your message">
          <button class="input-send-btn" id="midevela-send" aria-label="Send message">
            <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>
      </div>

      <div class="footer-brand">
        Powered by <a href="https://midvella.com" target="_blank" rel="noopener">Midevela</a>
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

    // ─── Panel open/close ───
    const toggleChat = (focusInput) => {
      const isOpen = chat.classList.toggle('open');
      fab.classList.toggle('open', isOpen);
      if (isOpen) {
        trackEvent('widget_opened', { view: funnel.view });
        if (focusInput && funnel.view === 'conversation') input.focus();
      } else {
        markAutoOpened();
        trackEvent('widget_dismissed', { view: funnel.view });
        persistFunnel();
      }
    };

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

    function appendAiBubble(text, extraHTML) {
      // Message grouping: if the last message is also AI, append to it
      var lastChild = body.lastElementChild;
      var isGrouped = false;
      if (lastChild && lastChild.classList.contains('msg-row') && lastChild.classList.contains('ai')) {
        var lastCol = lastChild.querySelector('.msg-col');
        if (lastCol && !lastChild.querySelector('.reco-container') && !lastChild.querySelector('.chips')) {
          var lastBubble = lastCol.querySelector('.msg-bubble');
          var lastTime = lastCol.querySelector('.msg-time');
          if (lastTime) lastTime.remove();
          if (lastBubble) {
            lastBubble.textContent += '\n\n' + text;
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
        avatar.textContent = '\u{1F33F}';
        var col = document.createElement('div');
        col.className = 'msg-col';
        var sender = document.createElement('div');
        sender.className = 'msg-sender';
        sender.textContent = aiName;
        col.appendChild(sender);
        var bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        bubble.textContent = text;
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
        '<div class="typing-avatar">\u{1F33F}</div>' +
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
      strip.innerHTML = '<div class="memory-header">\u{1F9E0} Here\'s what I know</div><div class="memory-items" id="midevela-memory-items"></div>';
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
        return '<div class="memory-item">\u2713 ' + escapeHtml(item) + '</div>';
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
        el.textContent = (chip.icon || '') + (chip.icon ? ' ' : '') + chip.label;
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

    function showState(stateKey) {
      var text = stateTexts[stateKey] || stateTexts.thinking;
      appendTyping(text.replace('{name}', aiName));
      scrollToBottom();
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

    // Follow-up chips shown after recommendations
    function recommendationFollowUpChips() {
      return [
        { icon: '\u{1F50D}', label: 'Compare them', action: function () {
          // Trigger compare mode by selecting first two products
          if (funnel.lastRecommendations && funnel.lastRecommendations.length >= 2) {
            funnel.compareSelection = [funnel.lastRecommendations[0].id, funnel.lastRecommendations[1].id];
            renderRecommendations(funnel.lastRecommendations);
            runCompare();
          }
        } },
        { icon: '\u{1F4B0}', label: 'Cheaper options', action: function () {
          sendMessage('show me cheaper options');
        } },
        { icon: '\u{1F4D6}', label: 'Learn more', action: function () {
          if (funnel.lastRecommendations && funnel.lastRecommendations.length > 0) {
            sendMessage('tell me more about ' + funnel.lastRecommendations[0].name);
          }
        } },
        { icon: '\u{1F4AC}', label: 'Ask something else', action: function () {
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
        { icon: '\u{1F6CD}', label: 'Continue shopping', action: function () {
          if (funnel.categoryId) {
            selectCategory({ id: funnel.categoryId, name: funnel.categoryName });
          } else {
            renderWelcome();
          }
        } },
        { icon: '\u{1F4AC}', label: 'Ask another question', action: function () {
          input.focus();
        } },
      ];
    }

    // ─── Error Bubble ───
    function renderErrorBubble(message, retryFn) {
      var el = document.createElement('div');
      el.className = 'error-bubble';
      el.innerHTML =
        '<div class="error-icon">\u{1F4A1}</div>' +
        '<div class="error-text">' + escapeHtml(message || 'Oops. Something went wrong. Let\u2019s try again.') + '</div>';
      if (typeof retryFn === 'function') {
        var btn = document.createElement('button');
        btn.className = 'error-retry-btn';
        btn.textContent = '\u{1F504} Retry';
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
        '<div class="compare-placeholder-title">\u{2696}\u{FE0F} Compare Products</div>' +
        '<div class="compare-placeholder-row">' +
          '<div class="compare-placeholder-item">' + escapeHtml(productA || 'Product A') + '</div>' +
          '<div class="compare-placeholder-item">' + escapeHtml(productB || 'Product B') + '</div>' +
        '</div>';
      if (typeof compareFn === 'function') {
        var btn = document.createElement('button');
        btn.className = 'compare-placeholder-btn';
        btn.textContent = '\u{2696}\u{FE0F} Compare';
        btn.addEventListener('click', compareFn);
        el.appendChild(btn);
      }
      body.appendChild(el);
      scrollToBottom();
      return el;
    }

    function renderRecoCard(r, source) {
      const url = isHttpUrl(r && r.url) ? r.url : '';
      const imageUrl = showProductImages && isHttpUrl(r && r.imageUrl) ? r.imageUrl : '';
      const isSelected = funnel.compareSelection.indexOf(r.id) !== -1;
      const card = document.createElement('div');
      card.className = 'reco-card' + (isSelected ? ' selected' : '');
      card.innerHTML = `
        <div class="reco-img" data-role="view">${
          imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(r.name)}" loading="lazy">` : '🛍️'
        }</div>
        <div class="reco-body">
          <span class="reco-name" data-role="view">${escapeHtml(r.name)}</span>
          <span class="reco-price">${escapeHtml(r.price)}</span>
          <span class="reco-why">${escapeHtml(r.whyThis || '')}</span>
          <div class="reco-actions">
            ${url ? `<a class="reco-btn" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" data-role="checkout">View</a>` : ''}
            ${source === 'funnel' ? `<button type="button" class="reco-compare-btn${isSelected ? ' active' : ''}" data-role="compare">${isSelected ? '✓' : '+ Compare'}</button>` : ''}
          </div>
        </div>
      `;

      if (imageUrl) {
        const img = card.querySelector('.reco-img img');
        if (img) {
          img.addEventListener('error', () => {
            const imgEl = card.querySelector('.reco-img');
            if (imgEl) imgEl.textContent = '🛍️';
          }, { once: true });
        }
      }

      const viewEls = card.querySelectorAll('[data-role="view"]');
      viewEls.forEach((el) => el.addEventListener('click', () => trackEvent('product_viewed', { productId: r.id, source })));

      const checkoutLink = card.querySelector('[data-role="checkout"]');
      if (checkoutLink) {
        checkoutLink.addEventListener('click', () => {
          if (source === 'funnel') trackEvent('recommendation_clicked', { productId: r.id });
          trackEvent('checkout_clicked', { productId: r.id, url });
        });
      }

      const compareBtn = card.querySelector('[data-role="compare"]');
      if (compareBtn) {
        compareBtn.addEventListener('click', () => toggleCompareSelection(r.id));
      }

      return card;
    }

    function renderRecoContainer(products, source) {
      const container = document.createElement('div');
      container.className = 'reco-container';
      products.forEach((p) => container.appendChild(renderRecoCard(p, source)));
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
      // Remove follow-up chips to avoid stale suggestions
      // (renderRecommendations will re-add them)
      if (funnel.compareSelection.length === 2) runCompare();
    }

    function runCompare() {
      showState('comparing');
      scrollToBottom();
      fetch(compareApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgetKey, productIds: funnel.compareSelection }),
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          removeTyping();
          if (!data || !Array.isArray(data.rows)) {
            appendAiBubble("I couldn\u2019t compare those two right now \u2014 please try again.");
            return;
          }
          var table = document.createElement('table');
          table.className = 'compare-table';
          var header = '<tr><th></th>' + data.products.map(function (p) { return '<th>' + escapeHtml(p.name) + '</th>'; }).join('') + '</tr>';
          var rows = data.rows
            .map(function (r) { return '<tr><td>' + escapeHtml(r.label) + '</td>' + r.values.map(function (v) { return '<td>' + escapeHtml(v) + '</td>'; }).join('') + '</tr>'; })
            .join('');
          table.innerHTML = header + rows;
          appendAiBubble(data.recommendation || naturalComparison());
          body.appendChild(table);
          // Follow-up chips after comparison
          renderSuggestionChips([
            { icon: '\u{2705}', label: 'Pick one', action: function () {
              if (funnel.compareSelection.length > 0) {
                var picked = funnel.compareSelection[0];
                trackEvent('comparison_pick', { productId: picked });
                funnel.compareSelection = [];
                if (funnel.lastRecommendations) {
                  renderRecommendations(funnel.lastRecommendations);
                }
              }
            } },
            { icon: '\u{1F4AC}', label: 'Ask something else', action: function () {
              funnel.view = 'conversation';
              persistFunnel();
              clearBody();
              renderEmptyConversation();
              input.focus();
            } },
          ]);
          trackEvent('comparison_viewed', { productIds: funnel.compareSelection });
          scrollToBottom();
        })
        .catch(function () {
          removeTyping();
          appendAiBubble("I couldn\u2019t compare those two right now \u2014 please try again.");
        });
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
        avatar.textContent = '\u{1F33F}';
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
                if (iconEl) iconEl.textContent = cat.icon || '\u{1F4E6}';
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
      askChip.textContent = '\u{1F4AC} Ask anything';
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
          icon: '\u{1F6CD}',
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
          icon: '\u{1F4C2}',
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
          icon: '\u{1F4AC}',
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
      prefix.textContent = 'Welcome back 👋';
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
          icon: '🛍',
          title: 'Continue with ' + cat.name,
          desc: 'Pick up where you left off',
          fn: function () { selectCategory(cat); },
        },
        {
          icon: '📂',
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
          icon: '🔄',
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

      var icon = document.createElement('div');
      icon.className = 'empty-conversation-icon';
      icon.textContent = '💬';
      container.appendChild(icon);

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
        chip.textContent = (opt.icon ? opt.icon + ' ' : '') + opt.label;
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
              { icon: '\u{1F504}', label: 'Try different budget', action: function () {
                sendMessage('show me options with a different budget');
              } },
              { icon: '\u{1F4AC}', label: 'Ask something else', action: function () {
                funnel.view = 'conversation';
                persistFunnel();
                clearBody();
                renderEmptyConversation();
                input.focus();
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

      // Natural intro text explaining why these products were chosen
      appendAiBubble(naturalRecommendationIntro());

      var block = document.createElement('div');
      block.id = 'midevela-reco-block';
      block.appendChild(renderRecoContainer(products, 'funnel'));
      body.appendChild(block);

      // Follow-up suggestions
      renderSuggestionChips(recommendationFollowUpChips());

      trackEvent('recommendation_shown', { productIds: products.map(function (p) { return p.id; }) });
      scrollToBottom();
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

      appendCustomerBubble(text);
      scrollToBottom();

      // Detect intent for appropriate state text
      var stateKey = 'thinking';
      var lower = text.toLowerCase();
      if (lower.indexOf('compar') !== -1 || lower.indexOf('vs ') !== -1) stateKey = 'comparing';
      else if (lower.indexOf('cheap') !== -1 || lower.indexOf('affordable') !== -1 || lower.indexOf('budget') !== -1) stateKey = 'searching';
      else if (lower.indexOf('shipping') !== -1 || lower.indexOf('return') !== -1 || lower.indexOf('delivery') !== -1 || lower.indexOf('contact') !== -1) stateKey = 'answering';
      else if (lower.indexOf('recommend') !== -1 || lower.indexOf('suggest') !== -1 || lower.indexOf('best') !== -1) stateKey = 'searching';
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

    function handleAIResponse(data) {
      if (data && data.isNewConversation) {
        resetVisitLocalState();
      }

      var replyText = (data && data.replyText) || "Sorry, I didn\u2019t quite catch that. Could you rephrase?";
      var recommendations = Array.isArray(data && data.recommendations) ? data.recommendations : [];

      // Update memory strip if we have context
      if (data && data.contextSnapshot) {
        if (data.contextSnapshot.categoryName) funnel.categoryName = data.contextSnapshot.categoryName;
        if (data.contextSnapshot.answers) funnel.answers = data.contextSnapshot.answers;
        if (data.contextSnapshot.categoryId) funnel.categoryId = data.contextSnapshot.categoryId;
        persistFunnel();
      }

      // Render AI message with new format
      if (recommendations.length > 0) {
        // Show recommendations with natural intro
        appendAiBubble(naturalRecommendationIntro());
        var container = renderRecoContainer(recommendations, 'chat');
        var block = document.createElement('div');
        block.id = 'midevela-reco-block';
        block.appendChild(container);
        body.appendChild(block);
        renderSuggestionChips(recommendationFollowUpChips());
        funnel.lastRecommendations = recommendations;
      } else {
        appendAiBubble(replyText);
        // Intelligent follow-up chips based on conversation content
        var lowerReply = replyText.toLowerCase();
        var chips = [];
        // Check if reply contains business/support info
        if (lowerReply.indexOf('shipping') !== -1 || lowerReply.indexOf('return') !== -1 ||
            lowerReply.indexOf('hour') !== -1 || lowerReply.indexOf('payment') !== -1 ||
            lowerReply.indexOf('contact') !== -1) {
          chips = businessFollowUpChips();
        } else if (lowerReply.indexOf('product') !== -1 || lowerReply.indexOf('recommend') !== -1) {
          chips = recommendationFollowUpChips();
        }
        if (chips.length > 0) {
          renderSuggestionChips(chips);
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
            avatar.textContent = '\u{1F33F}';
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
