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

  // Persistent shopping-funnel state — category/budget/brand/answers, so a
  // returning visitor (or a page reload mid-funnel) never repeats
  // themselves. Mirrored server-side on Conversation.context once chat
  // starts (see /api/widget/message's `context` patch).
  const FUNNEL_KEY = 'midevela_funnel_state';
  function loadFunnelState() {
    try {
      const raw = window.localStorage.getItem(FUNNEL_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
  function saveFunnelState(state) {
    try {
      window.localStorage.setItem(FUNNEL_KEY, JSON.stringify(state));
    } catch (e) {
      /* storage blocked — funnel simply won't persist across reloads */
    }
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
  };

  fetch(initApiUrl)
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
      --bg-soft: #f6f7f9;
      --text: #14181f;
      --muted: #6b7280;
      --border: #e9ebee;
      --card: #ffffff;
      --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    /* ─── FAB BUTTON ─── */
    .fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: var(--primary);
      box-shadow: 0 8px 24px rgba(20, 24, 31, 0.18);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s;
      border: none;
      outline: none;
    }

    .fab:hover {
      transform: translateY(-2px) scale(1.04);
      box-shadow: 0 12px 30px rgba(20, 24, 31, 0.26);
    }

    .fab:active { transform: scale(0.96); }

    .fab svg {
      width: 26px;
      height: 26px;
      fill: var(--on-primary);
      transition: transform 0.3s;
    }

    .fab.open svg {
      transform: rotate(90deg) scale(0.9);
    }

    .fab-pulse-ring {
      position: absolute;
      inset: -4px;
      border-radius: 50%;
      border: 2px solid var(--primary);
      animation: pulseRing 2.4s infinite;
      pointer-events: none;
    }

    @keyframes pulseRing {
      0% { transform: scale(1); opacity: 0.35; }
      100% { transform: scale(1.7); opacity: 0; }
    }

    /* No page-blocking backdrop — this is a docked sidebar. The page stays
       fully visible and interactive while the assistant is open, so a
       shopper can keep browsing products while they chat. */
    .backdrop {
      display: none;
    }

    /* ─── CHAT PANEL (Right-docked sidebar; bottom sheet on mobile) ─── */
    .chat-panel {
      position: fixed;
      top: 0;
      right: 0;
      height: 100%;
      width: 400px;
      max-width: 100vw;
      background: var(--bg);
      border-left: 1px solid var(--border);
      box-shadow: -14px 0 50px rgba(20, 24, 31, 0.14);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 999999;
      font-family: var(--font);
      transform: translateX(100%);
      pointer-events: none;
      transition: transform 0.38s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .chat-panel.open {
      transform: translateX(0);
      pointer-events: all;
    }

    /* Header */
    .header {
      background: var(--bg);
      padding: 15px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }

    .header-info {
      display: flex;
      align-items: center;
      gap: 11px;
    }

    .header-avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: var(--primary);
      color: var(--on-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 15px;
      flex-shrink: 0;
    }

    .header-title {
      font-size: 14.5px;
      font-weight: 600;
      color: var(--text);
      line-height: 1.2;
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
      background: #22c55e;
      box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.15);
    }

    .close-btn {
      background: none;
      border: none;
      color: var(--muted);
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
      padding: 4px 6px;
      border-radius: 8px;
      transition: color 0.2s, background 0.2s;
    }

    .close-btn:hover {
      color: var(--text);
      background: var(--bg-soft);
    }

    /* Body — swapped per funnel state */
    .body {
      flex: 1;
      overflow-y: auto;
      padding: 18px 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      background: var(--bg-soft);
    }

    .body::-webkit-scrollbar { width: 6px; }
    .body::-webkit-scrollbar-thumb { background: rgba(20, 24, 31, 0.14); border-radius: 3px; }

    .msg-row {
      display: flex;
      gap: 8px;
      max-width: 88%;
      animation: msgIn 0.28s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .msg-row.ai { align-self: flex-start; }
    .msg-row.customer { align-self: flex-end; }

    @keyframes msgIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .msg-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--primary);
      color: var(--on-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 12px;
      flex-shrink: 0;
      align-self: flex-end;
    }

    .msg-col { display: flex; flex-direction: column; min-width: 0; max-width: 100%; }
    .customer .msg-col { align-items: flex-end; }

    .msg-bubble {
      padding: 10px 14px;
      border-radius: 16px;
      font-size: 13.5px;
      line-height: 1.5;
      color: var(--text);
      word-wrap: break-word;
      overflow-wrap: anywhere;
    }

    .customer .msg-bubble {
      background: var(--primary);
      color: var(--on-primary);
      border-bottom-right-radius: 5px;
    }

    .ai .msg-bubble {
      background: var(--bg);
      border: 1px solid var(--border);
      border-bottom-left-radius: 5px;
    }

    .msg-time {
      font-size: 10px;
      color: var(--muted);
      margin-top: 4px;
    }

    /* Chips — used for quick replies, category grid buttons, and
       qualification/budget options (same visual language throughout). */
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 2px 0 2px 36px;
      animation: msgIn 0.3s ease;
    }

    .chip {
      background: var(--bg);
      border: 1px solid var(--primary);
      color: var(--text);
      border-radius: 100px;
      padding: 7px 13px;
      font-size: 12.5px;
      font-weight: 500;
      cursor: pointer;
      font-family: var(--font);
      transition: background 0.18s, transform 0.18s;
    }

    .chip:hover { background: var(--bg-soft); transform: translateY(-1px); }
    .chip:active { transform: scale(0.97); }
    .chip:disabled { opacity: 0.5; cursor: default; transform: none; }

    /* Category grid (Welcome Card) */
    .cat-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      padding-left: 36px;
      animation: msgIn 0.3s ease;
    }

    .cat-tile {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 12px 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s;
      font-family: var(--font);
      text-align: center;
    }

    .cat-tile:hover {
      transform: translateY(-2px);
      border-color: var(--primary);
      box-shadow: 0 8px 20px rgba(20, 24, 31, 0.08);
    }

    .cat-tile-icon {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--bg-soft);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 19px;
      overflow: hidden;
    }

    .cat-tile-icon img { width: 100%; height: 100%; object-fit: cover; }

    .cat-tile-name {
      font-size: 12px;
      font-weight: 600;
      color: var(--text);
    }

    /* Product recommendation cards */
    .reco-container {
      display: flex;
      gap: 12px;
      overflow-x: auto;
      padding: 8px 0;
      width: 100%;
      scrollbar-width: none;
    }

    .reco-container::-webkit-scrollbar { display: none; }

    .reco-card {
      flex-shrink: 0;
      width: 158px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .reco-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(20, 24, 31, 0.1);
    }

    .reco-card.selected { border-color: var(--primary); border-width: 2px; }

    .reco-img {
      width: 100%;
      height: 96px;
      background: var(--bg-soft);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 26px;
      overflow: hidden;
      cursor: pointer;
    }

    .reco-img img { width: 100%; height: 100%; object-fit: cover; }

    .reco-body {
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 3px;
      flex: 1;
    }

    .reco-name {
      font-size: 12px;
      font-weight: 600;
      color: var(--text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: pointer;
    }

    .reco-price { font-size: 13px; color: var(--text); font-weight: 700; }

    .reco-why {
      font-size: 10px;
      color: var(--muted);
      line-height: 1.35;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      margin-bottom: 2px;
    }

    .reco-actions { display: flex; gap: 6px; }

    .reco-btn {
      flex: 1;
      display: block;
      text-align: center;
      padding: 8px;
      font-size: 11.5px;
      font-weight: 600;
      color: var(--on-primary);
      background: var(--primary);
      text-decoration: none;
      cursor: pointer;
      transition: filter 0.18s;
      border: none;
    }

    .reco-btn:hover { filter: brightness(0.95); }

    .reco-compare-btn {
      flex-shrink: 0;
      background: var(--bg);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 0;
      font-size: 10.5px;
      font-weight: 600;
      padding: 8px 8px;
      cursor: pointer;
      font-family: var(--font);
    }

    .reco-compare-btn.active { border-color: var(--primary); color: var(--primary); }

    /* Comparison table */
    .compare-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11.5px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
    }

    .compare-table th, .compare-table td {
      padding: 7px 8px;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }

    .compare-table th { color: var(--muted); font-weight: 600; font-size: 10.5px; }
    .compare-table tr:last-child td { border-bottom: none; }

    /* Chat Input */
    .input-area {
      padding: 12px 14px;
      border-top: 1px solid var(--border);
      display: flex;
      gap: 10px;
      align-items: center;
      background: var(--bg);
      flex-shrink: 0;
    }

    .input-field {
      flex: 1;
      background: var(--bg-soft);
      border: 1px solid var(--border);
      border-radius: 100px;
      padding: 11px 16px;
      color: var(--text);
      font-size: 13.5px;
      outline: none;
      font-family: var(--font);
      transition: border-color 0.18s, background 0.18s;
    }

    .input-field::placeholder { color: var(--muted); }

    .input-field:focus {
      border-color: var(--primary);
      background: var(--bg);
    }

    .send-btn {
      background: var(--primary);
      border: none;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: transform 0.18s, filter 0.18s;
    }

    .send-btn:hover { filter: brightness(0.96); }
    .send-btn:active { transform: scale(0.92); }

    .send-btn svg { width: 17px; height: 17px; fill: var(--on-primary); }

    .footer-brand {
      text-align: center;
      padding: 8px 0;
      font-size: 10px;
      color: var(--muted);
      background: var(--bg);
      border-top: 1px solid var(--border);
      flex-shrink: 0;
    }

    .footer-brand a { color: var(--text); text-decoration: none; font-weight: 600; }

    /* Typing indicator */
    .typing {
      display: flex;
      gap: 4px;
      padding: 12px 14px;
      align-self: flex-start;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      border-bottom-left-radius: 5px;
      margin-left: 36px;
      animation: msgIn 0.28s ease;
    }

    .typing span {
      width: 7px;
      height: 7px;
      background: var(--muted);
      border-radius: 50%;
      animation: dotPulse 1.4s infinite ease-in-out;
    }

    .typing span:nth-child(2) { animation-delay: 0.2s; }
    .typing span:nth-child(3) { animation-delay: 0.4s; }

    @keyframes dotPulse {
      0%, 80%, 100% { transform: scale(0.5); opacity: 0.3; }
      40% { transform: scale(1); opacity: 1; }
    }

    /* Mobile: true bottom sheet, slides up from the bottom rather than in
       from the side, with a drag-handle affordance. */
    @media (max-width: 480px) {
      .chat-panel {
        top: auto;
        bottom: 0;
        left: 0;
        right: 0;
        width: 100%;
        height: 85vh;
        max-height: 85vh;
        border-left: none;
        border-top-left-radius: 20px;
        border-top-right-radius: 20px;
        transform: translateY(100%);
        box-shadow: 0 -14px 50px rgba(20, 24, 31, 0.18);
      }

      .chat-panel.open { transform: translateY(0); }

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
      }

      .header { padding-top: 20px; }
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
      <svg viewBox="0 0 24 24">
        <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/>
      </svg>
    </button>

    <div class="backdrop" id="midevela-backdrop"></div>

    <div class="chat-panel" id="midevela-chat">
      <div class="header">
        <div class="header-info">
          <div class="header-avatar">${escapeHtml(avatarLetter)}</div>
          <div>
            <div class="header-title">${escapeHtml(aiName)}</div>
            <div class="header-status">
              <span class="header-status-dot"></span>
              Online
            </div>
          </div>
        </div>
        <button class="close-btn" id="midevela-close">✕</button>
      </div>

      <div class="body" id="midevela-body"></div>

      <div class="input-area">
        <input type="text" class="input-field" id="midevela-input" maxlength="2000" placeholder="Ask anything…">
        <button class="send-btn" id="midevela-send">
          <svg viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>

      <div class="footer-brand">
        Powered by <a href="https://midvella.com" target="_blank">Midevela</a>
      </div>
    </div>
  `;

    const fab = shadow.getElementById('midevela-fab');
    const chat = shadow.getElementById('midevela-chat');
    const close = shadow.getElementById('midevela-close');
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
        markAutoOpened(); // never auto-pop again this session once dismissed
        trackEvent('widget_dismissed', { view: funnel.view });
        persistFunnel();
      }
    };

    fab.addEventListener('click', () => toggleChat(true));
    close.addEventListener('click', () => toggleChat(true));
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
      body.scrollTop = body.scrollHeight;
    }

    function appendAiBubble(text, extraHTML) {
      const row = document.createElement('div');
      row.className = 'msg-row ai';
      row.innerHTML = `
        <div class="msg-avatar">${escapeHtml(avatarLetter)}</div>
        <div class="msg-col">
          <div class="msg-bubble">${escapeHtml(text)}</div>
          ${extraHTML || ''}
          <span class="msg-time">${nowTime()}</span>
        </div>
      `;
      body.appendChild(row);
      return row;
    }

    function appendCustomerBubble(text) {
      const row = document.createElement('div');
      row.className = 'msg-row customer';
      row.innerHTML = `
        <div class="msg-col">
          <div class="msg-bubble">${escapeHtml(text)}</div>
          <span class="msg-time">${nowTime()}</span>
        </div>
      `;
      body.appendChild(row);
    }

    function appendTyping() {
      const el = document.createElement('div');
      el.id = 'midevela-typing';
      el.className = 'typing';
      el.innerHTML = '<span></span><span></span><span></span>';
      body.appendChild(el);
    }

    function removeTyping() {
      const el = shadow.getElementById('midevela-typing');
      if (el) el.remove();
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
      const idx = funnel.compareSelection.indexOf(productId);
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
      appendTyping();
      scrollToBottom();
      fetch(compareApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgetKey, productIds: funnel.compareSelection }),
      })
        .then((res) => res.json())
        .then((data) => {
          removeTyping();
          if (!data || !Array.isArray(data.rows)) {
            appendAiBubble("I couldn't compare those two right now — please try again.");
            return;
          }
          const table = document.createElement('table');
          table.className = 'compare-table';
          const header = `<tr><th></th>${data.products.map((p) => `<th>${escapeHtml(p.name)}</th>`).join('')}</tr>`;
          const rows = data.rows
            .map((r) => `<tr><td>${escapeHtml(r.label)}</td>${r.values.map((v) => `<td>${escapeHtml(v)}</td>`).join('')}</tr>`)
            .join('');
          table.innerHTML = header + rows;
          appendAiBubble(data.recommendation || 'Here\'s how they compare:', table.outerHTML);
          trackEvent('comparison_viewed', { productIds: funnel.compareSelection });
          scrollToBottom();
        })
        .catch(() => {
          removeTyping();
          appendAiBubble("I couldn't compare those two right now — please try again.");
        });
    }

    // ─── Views ───
    function renderWelcome() {
      funnel.view = 'welcome';
      persistFunnel();
      clearBody();
      appendAiBubble(greeting);

      if (config.categories.length > 0) {
        const label = document.createElement('div');
        label.className = 'msg-row ai';
        label.innerHTML = `<div class="msg-avatar" style="visibility:hidden"></div><div class="msg-col"><div class="msg-bubble">What are you shopping for today?</div></div>`;
        body.appendChild(label);

        const grid = document.createElement('div');
        grid.className = 'cat-grid';
        config.categories.forEach((cat) => {
          const tile = document.createElement('button');
          tile.type = 'button';
          tile.className = 'cat-tile';
          tile.innerHTML = `
            <div class="cat-tile-icon">${cat.image ? `<img src="${escapeHtml(cat.image)}" alt="">` : escapeHtml(cat.icon || '📦')}</div>
            <span class="cat-tile-name">${escapeHtml(cat.name)}</span>
          `;
          tile.addEventListener('click', () => selectCategory(cat));
          grid.appendChild(tile);
        });
        body.appendChild(grid);
      }

      const chipsWrap = document.createElement('div');
      chipsWrap.className = 'chips';
      const askChip = document.createElement('button');
      askChip.type = 'button';
      askChip.className = 'chip';
      askChip.textContent = '💬 Ask anything';
      askChip.addEventListener('click', () => {
        funnel.view = 'conversation';
        persistFunnel();
        clearBody();
        appendAiBubble("Sure — what would you like to know?");
        input.focus();
      });
      chipsWrap.appendChild(askChip);
      body.appendChild(chipsWrap);
      scrollToBottom();
    }

    function selectCategory(cat) {
      funnel.categoryId = cat.id;
      funnel.categoryName = cat.name;
      funnel.answers = {};
      trackEvent('category_selected', { categoryId: cat.id, categoryName: cat.name });
      appendCustomerBubble(cat.name);
      fetchQualificationStep();
    }

    function fetchQualificationStep() {
      funnel.view = 'qualification';
      persistFunnel();
      appendTyping();
      scrollToBottom();
      fetch(qualificationApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgetKey, categoryId: funnel.categoryId, answers: funnel.answers }),
      })
        .then((res) => res.json())
        .then((data) => {
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
        .catch(() => {
          removeTyping();
          // Config walk failed — degrade straight to recommendations rather
          // than dead-end the funnel.
          fetchRecommendations();
        });
    }

    function renderQualificationStep(step) {
      appendAiBubble(step.question);
      const chipsWrap = document.createElement('div');
      chipsWrap.className = 'chips';
      (step.options || []).forEach((opt) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip';
        chip.textContent = (opt.icon ? opt.icon + ' ' : '') + opt.label;
        chip.addEventListener('click', () => answerQualificationStep(step, opt, chipsWrap));
        chipsWrap.appendChild(chip);
      });
      body.appendChild(chipsWrap);
      scrollToBottom();
    }

    function answerQualificationStep(step, opt, chipsWrap) {
      Array.prototype.forEach.call(chipsWrap.querySelectorAll('.chip'), (c) => (c.disabled = true));
      funnel.answers[step.key] = opt.value;
      persistFunnel();
      trackEvent('qualification_answered', { step: step.key, value: opt.value });
      if (step.key === 'budget') trackEvent('budget_selected', { value: opt.value });
      appendCustomerBubble(opt.label);
      fetchQualificationStep();
    }

    function fetchRecommendations() {
      appendTyping();
      scrollToBottom();
      fetch(recommendApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgetKey, categoryId: funnel.categoryId, answers: funnel.answers }),
      })
        .then((res) => res.json())
        .then((data) => {
          removeTyping();
          const products = Array.isArray(data && data.products) ? data.products : [];
          funnel.lastRecommendations = products;
          if (products.length === 0) {
            appendAiBubble("I couldn't find a match for that just yet — ask me anything and I'll help directly.");
            funnel.view = 'conversation';
            persistFunnel();
            return;
          }
          renderRecommendations(products);
        })
        .catch(() => {
          removeTyping();
          appendAiBubble("I couldn't load recommendations right now — ask me anything and I'll help directly.");
          funnel.view = 'conversation';
          persistFunnel();
        });
    }

    function renderRecommendations(products) {
      funnel.view = 'recommendations';
      funnel.lastRecommendations = products;
      persistFunnel();

      // Replace any prior recommendation block (re-render on compare toggle)
      const prior = shadow.getElementById('midevela-reco-block');
      if (prior) prior.remove();

      const block = document.createElement('div');
      block.id = 'midevela-reco-block';
      block.appendChild(renderRecoContainer(products, 'funnel'));
      body.appendChild(block);
      trackEvent('recommendation_shown', { productIds: products.map((p) => p.id) });
      scrollToBottom();
    }

    // ─── Free-form conversation (typed messages bypass the funnel anytime) ───
    function sendMessage(raw) {
      const text = String(raw || '').trim();
      if (!text) return;

      const isFirstMessage = !funnel.conversationStarted;
      funnel.conversationStarted = true;
      funnel.view = 'conversation';
      persistFunnel();
      if (isFirstMessage) trackEvent('conversation_started', {});

      appendCustomerBubble(text);
      scrollToBottom();
      appendTyping();
      scrollToBottom();

      const contextPatch = isFirstMessage
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
        .then((res) => {
          if (!res.ok) throw new Error('Widget API request failed with status ' + res.status);
          return res.json();
        })
        .then((data) => {
          removeTyping();
          handleAIResponse(data);
        })
        .catch((err) => {
          console.error('Midevela widget error:', err);
          removeTyping();
          appendAiBubble("Sorry, I'm having trouble connecting right now. Please try again in a moment.");
        });
    }

    function handleAIResponse(data) {
      const replyText = (data && data.replyText) || "Sorry, I didn't quite catch that. Could you rephrase?";
      const recommendations = Array.isArray(data && data.recommendations) ? data.recommendations : [];

      // Built as real DOM nodes (not an HTML string) so the recommendation
      // cards' click listeners (checkout/compare/view tracking) survive —
      // serializing to outerHTML and reparsing would silently drop them.
      const row = document.createElement('div');
      row.className = 'msg-row ai';

      const avatar = document.createElement('div');
      avatar.className = 'msg-avatar';
      avatar.textContent = avatarLetter;

      const col = document.createElement('div');
      col.className = 'msg-col';

      const bubble = document.createElement('div');
      bubble.className = 'msg-bubble';
      bubble.textContent = replyText;
      col.appendChild(bubble);

      if (recommendations.length > 0) {
        col.appendChild(renderRecoContainer(recommendations, 'chat'));
      }

      const time = document.createElement('span');
      time.className = 'msg-time';
      time.textContent = nowTime();
      col.appendChild(time);

      row.appendChild(avatar);
      row.appendChild(col);
      body.appendChild(row);
      scrollToBottom();
    }

    const handleSend = () => {
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      sendMessage(text);
    };

    send.addEventListener('click', handleSend);
    input.addEventListener('keydown', (e) => {
      // isComposing: Enter during IME composition (e.g. Japanese input)
      // confirms the composition, not the message.
      if (e.key === 'Enter' && !e.isComposing) handleSend();
    });

    // ─── Boot: fresh welcome, or resume a saved funnel/conversation ───
    const saved = loadFunnelState();
    if (saved && saved.categoryId && (saved.view === 'recommendations' || saved.view === 'conversation')) {
      funnel.categoryId = saved.categoryId;
      funnel.categoryName = saved.categoryName;
      funnel.answers = saved.answers || {};
      funnel.view = 'conversation';
      clearBody();
      appendAiBubble(
        `Welcome back! Continuing from ${saved.categoryName || 'where you left off'} — ask me anything.`
      );
      // Note: the message transcript itself isn't replayed on a fresh page
      // load (no message-history endpoint in v1) — but the category/budget/
      // brand context IS remembered, both here and server-side on the
      // Conversation, so the shopper never has to re-answer qualification.
    } else if (saved && saved.categoryId && saved.view === 'qualification') {
      funnel.categoryId = saved.categoryId;
      funnel.categoryName = saved.categoryName;
      funnel.answers = saved.answers || {};
      clearBody();
      appendAiBubble(`Picking back up on ${saved.categoryName}…`);
      fetchQualificationStep();
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
  }
})();
