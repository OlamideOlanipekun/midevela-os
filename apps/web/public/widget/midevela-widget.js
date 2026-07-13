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

  const messageApiUrl = apiBase + '/api/widget/message';
  const configApiUrl = apiBase + '/api/widget/config?key=' + encodeURIComponent(widgetKey);

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

  // Once-per-session guard for the proactive auto-open.
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

  function nowTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Per-org presentation config, fetched from the app. The widget must
  // still work if this fetch fails, so everything has a neutral fallback.
  const fallbackConfig = {
    orgName: '',
    aiName: 'AI Sales Assistant',
    greeting: 'Good day! How can I help you today?',
    accentColor: '',
    engagementDelay: 0,
    showProductImages: true,
  };

  fetch(configApiUrl)
    .then(function (res) {
      return res.ok ? res.json() : null;
    })
    .catch(function () {
      return null;
    })
    .then(function (remote) {
      const config = Object.assign({}, fallbackConfig, remote || {});
      if (!isHexColor(config.accentColor)) {
        config.accentColor = isHexColor(attrThemeColor) ? attrThemeColor : '#1EE67A';
      }
      if (document.body) {
        init(config);
      } else {
        document.addEventListener('DOMContentLoaded', function () {
          init(config);
        });
      }
    });

  function init(config) {
    // Best-on-accent text colour, so filled accent buttons/bubbles stay
    // readable whatever accent the merchant configures.
    const onPrimary = contrastText(config.accentColor);

    // Stylesheet to inject into the Shadow DOM
    const styleText = `
    :host {
      --primary: ${config.accentColor};
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

    /* ─── CHAT PANEL (Right-docked sidebar) ─── */
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

    /* Messages List */
    .msg-list {
      flex: 1;
      overflow-y: auto;
      padding: 18px 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      background: var(--bg-soft);
    }

    .msg-list::-webkit-scrollbar { width: 6px; }
    .msg-list::-webkit-scrollbar-thumb { background: rgba(20, 24, 31, 0.14); border-radius: 3px; }

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

    .msg-col { display: flex; flex-direction: column; min-width: 0; }
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

    /* Quick-reply chips */
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

    /* Product recommendation cards inside chat flow */
    .reco-container {
      display: flex;
      gap: 12px;
      overflow-x: auto;
      padding: 8px 0;
      width: 100%;
      scrollbar-width: none; /* Hide scrollbar on Firefox */
    }

    .reco-container::-webkit-scrollbar {
      display: none; /* Hide scrollbar on Chrome/Safari */
    }

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

    .reco-img {
      width: 100%;
      height: 96px;
      background: var(--bg-soft);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 26px;
      overflow: hidden;
    }

    .reco-img img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

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
    }

    .reco-price {
      font-size: 13px;
      color: var(--text);
      font-weight: 700;
    }

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

    .reco-btn {
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
    }

    .reco-btn:hover { filter: brightness(0.95); }

    /* Chat Input */
    .input-area {
      padding: 12px 14px;
      border-top: 1px solid var(--border);
      display: flex;
      gap: 10px;
      align-items: center;
      background: var(--bg);
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

    .send-btn svg {
      width: 17px;
      height: 17px;
      fill: var(--on-primary);
    }

    .footer-brand {
      text-align: center;
      padding: 8px 0;
      font-size: 10px;
      color: var(--muted);
      background: var(--bg);
      border-top: 1px solid var(--border);
    }

    .footer-brand a {
      color: var(--text);
      text-decoration: none;
      font-weight: 600;
    }

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

    /* Mobile: the sidebar becomes a full-width sheet, still sliding in from
       the right. The base translateX transitions already handle open/close. */
    @media (max-width: 480px) {
      .chat-panel {
        width: 100%;
        border-left: none;
      }
    }
  `;

    // Create Shadow Host & Attach Shadow Root
    const container = document.createElement('div');
    container.id = 'midevela-widget-container';
    document.body.appendChild(container);

    const shadow = container.attachShadow({ mode: 'open' });

    // Create Wrapper
    const wrapper = document.createElement('div');

    // Insert styling rules
    const style = document.createElement('style');
    style.textContent = styleText;
    shadow.appendChild(style);
    shadow.appendChild(wrapper);

    const aiName = String(config.aiName || fallbackConfig.aiName);
    const greeting = String(config.greeting || fallbackConfig.greeting);
    const avatarLetter = aiName.charAt(0).toUpperCase() || 'A';

    // Template HTML
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

      <div class="msg-list" id="midevela-msg-list">
        <div class="msg-row ai">
          <div class="msg-avatar">${escapeHtml(avatarLetter)}</div>
          <div class="msg-col">
            <div class="msg-bubble">${escapeHtml(greeting)}</div>
            <span class="msg-time">${nowTime()}</span>
          </div>
        </div>
        <div class="chips" id="midevela-chips"></div>
      </div>

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

    // UI Event bindings
    const fab = shadow.getElementById('midevela-fab');
    const chat = shadow.getElementById('midevela-chat');
    const close = shadow.getElementById('midevela-close');
    const backdrop = shadow.getElementById('midevela-backdrop');
    const input = shadow.getElementById('midevela-input');
    const send = shadow.getElementById('midevela-send');
    const msgList = shadow.getElementById('midevela-msg-list');
    const chipsEl = shadow.getElementById('midevela-chips');

    // Toggle chat panel open state. Only a deliberate user open should
    // focus the input — the proactive auto-open must never steal focus
    // from whatever the shopper is doing on the page.
    const toggleChat = (focusInput) => {
      const isOpen = chat.classList.toggle('open');
      backdrop.classList.toggle('open', isOpen);
      fab.classList.toggle('open', isOpen);
      if (isOpen && focusInput) {
        input.focus();
      }
    };

    fab.addEventListener('click', () => toggleChat(true));
    close.addEventListener('click', () => toggleChat(true));
    backdrop.addEventListener('click', () => toggleChat(true));

    // Quick-reply chips disappear once the conversation actually starts.
    const hideChips = () => {
      if (chipsEl && chipsEl.parentNode) chipsEl.remove();
    };

    // Send a message — shared by the input box and the quick-reply chips.
    const sendMessage = (raw) => {
      const text = String(raw || '').trim();
      if (!text) return;

      hideChips();
      appendMessage(text, 'customer');
      scrollToBottom();
      appendTyping();
      scrollToBottom();

      fetch(messageApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          widgetKey,
          customerId,
          messageText: text,
        }),
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
          appendMessage("Sorry, I'm having trouble connecting right now. Please try again in a moment.", 'ai');
        });
    };

    const handleSend = () => {
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      sendMessage(text);
    };

    // Starter prompts so the shopper has an obvious first move instead of a
    // blank box. They map to things the assistant can actually answer.
    const QUICK_REPLIES = ['What do you sell?', 'Recommend something for me', 'Shipping & delivery', 'Payment options'];
    if (chipsEl) {
      QUICK_REPLIES.forEach((q) => {
        const chip = document.createElement('button');
        chip.className = 'chip';
        chip.type = 'button';
        chip.textContent = q;
        chip.addEventListener('click', () => sendMessage(q));
        chipsEl.appendChild(chip);
      });
    }

    send.addEventListener('click', handleSend);
    input.addEventListener('keydown', (e) => {
      // isComposing: Enter during IME composition (e.g. Japanese input)
      // confirms the composition, not the message.
      if (e.key === 'Enter' && !e.isComposing) handleSend();
    });

    const appendMessage = (text, role, extraHTML = '') => {
      const row = document.createElement('div');
      row.className = `msg-row ${role}`;

      const avatar = role === 'ai' ? `<div class="msg-avatar">${escapeHtml(avatarLetter)}</div>` : '';
      row.innerHTML = `
      ${avatar}
      <div class="msg-col">
        <div class="msg-bubble">${escapeHtml(text)}</div>
        ${extraHTML}
        <span class="msg-time">${nowTime()}</span>
      </div>
    `;

      msgList.appendChild(row);
    };

    const appendTyping = () => {
      const typeIndicator = document.createElement('div');
      typeIndicator.id = 'midevela-typing';
      typeIndicator.className = 'typing';
      typeIndicator.innerHTML = '<span></span><span></span><span></span>';
      msgList.appendChild(typeIndicator);
    };

    const removeTyping = () => {
      const typeIndicator = shadow.getElementById('midevela-typing');
      if (typeIndicator) typeIndicator.remove();
    };

    const scrollToBottom = () => {
      msgList.scrollTop = msgList.scrollHeight;
    };

    const renderRecoCard = (r) => {
      const url = isHttpUrl(r && r.url) ? r.url : '';
      const imageUrl = config.showProductImages && isHttpUrl(r && r.imageUrl) ? r.imageUrl : '';
      return `
        <div class="reco-card">
          <div class="reco-img">${
            imageUrl
              ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(r.name)}" loading="lazy">`
              : '🛍️'
          }</div>
          <div class="reco-body">
            <span class="reco-name">${escapeHtml(r.name)}</span>
            <span class="reco-price">${escapeHtml(r.price)}</span>
            <span class="reco-why">${escapeHtml(r.whyThis || '')}</span>
          </div>
          ${
            url
              ? `<a class="reco-btn" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">View Product</a>`
              : ''
          }
        </div>
      `;
    };

    const handleAIResponse = (data) => {
      const replyText = (data && data.replyText) || "Sorry, I didn't quite catch that. Could you rephrase?";
      const recommendations = Array.isArray(data && data.recommendations) ? data.recommendations : [];

      let recoHTML = '';
      if (recommendations.length > 0) {
        recoHTML = `
        <div class="reco-container">
          ${recommendations.map(renderRecoCard).join('')}
        </div>
      `;
      }

      appendMessage(replyText, 'ai', recoHTML);
      scrollToBottom();
    };

    // Proactive engagement: open once per browser session after the
    // merchant-configured delay. 0 (or unset) disables it entirely.
    const delaySec = Number(config.engagementDelay);
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
