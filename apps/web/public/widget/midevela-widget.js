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
    // Stylesheet to inject into the Shadow DOM
    const styleText = `
    :host {
      --primary: ${config.accentColor};
      --bg: #111827;
      --bg-header: linear-gradient(135deg, #0c3e21 0%, #0b2d18 100%);
      --text: #F0F4FF;
      --muted: #8892A4;
      --border: rgba(255, 255, 255, 0.08);
      --card: rgba(255, 255, 255, 0.04);
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
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--primary);
      box-shadow: 0 4px 16px rgba(30, 230, 122, 0.3);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      border: none;
      outline: none;
    }

    .fab:hover {
      transform: scale(1.05);
      box-shadow: 0 8px 24px rgba(30, 230, 122, 0.4);
    }

    .fab svg {
      width: 24px;
      height: 24px;
      fill: #080C14;
      transition: transform 0.3s;
    }

    .fab.open svg {
      transform: rotate(90deg);
    }

    .fab-pulse-ring {
      position: absolute;
      inset: -4px;
      border-radius: 50%;
      border: 2px solid var(--primary);
      animation: pulseRing 2s infinite;
      pointer-events: none;
    }

    @keyframes pulseRing {
      0% { transform: scale(1); opacity: 0.4; }
      100% { transform: scale(1.6); opacity: 0; }
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
      box-shadow: -12px 0 48px rgba(0, 0, 0, 0.45);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 999999;
      font-family: var(--font);
      transform: translateX(100%);
      pointer-events: none;
      transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .chat-panel.open {
      transform: translateX(0);
      pointer-events: all;
    }

    /* Header */
    .header {
      background: var(--bg-header);
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border);
      color: #fff;
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
      color: #080C14;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 14px;
    }

    .header-title {
      font-size: 14px;
      font-weight: 600;
      line-height: 1.2;
    }

    .header-status {
      font-size: 11px;
      color: var(--primary);
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .header-status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--primary);
      box-shadow: 0 0 8px var(--primary);
    }

    .close-btn {
      background: none;
      border: none;
      color: var(--muted);
      cursor: pointer;
      font-size: 16px;
      transition: color 0.2s;
    }

    .close-btn:hover {
      color: #fff;
    }

    /* Messages List */
    .msg-list {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .msg-group {
      display: flex;
      flex-direction: column;
      max-width: 80%;
    }

    .msg-group.customer {
      align-self: flex-end;
    }

    .msg-group.ai {
      align-self: flex-start;
    }

    .msg-badge {
      font-size: 10px;
      color: var(--primary);
      background: rgba(30, 230, 122, 0.1);
      padding: 2px 8px;
      border-radius: 100px;
      align-self: flex-start;
      margin-bottom: 4px;
      font-weight: 600;
    }

    .msg-bubble {
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 13px;
      line-height: 1.5;
      color: var(--text);
    }

    .customer .msg-bubble {
      background: rgba(255, 255, 255, 0.06);
      border-bottom-right-radius: 3px;
    }

    .ai .msg-bubble {
      background: #0c3e21;
      border-bottom-left-radius: 3px;
    }

    .msg-time {
      font-size: 10px;
      color: var(--muted);
      margin-top: 4px;
      align-self: flex-end;
    }

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
      width: 160px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .reco-img {
      width: 100%;
      height: 90px;
      background: rgba(255, 255, 255, 0.02);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      overflow: hidden;
    }

    .reco-img img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .reco-body {
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
    }

    .reco-name {
      font-size: 11px;
      font-weight: 600;
      color: var(--text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .reco-price {
      font-size: 12px;
      color: var(--primary);
      font-weight: 600;
    }

    .reco-why {
      font-size: 9px;
      color: var(--muted);
      line-height: 1.3;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .reco-btn {
      display: block;
      text-align: center;
      padding: 7px 8px;
      font-size: 11px;
      font-weight: 600;
      color: #080C14;
      background: var(--primary);
      text-decoration: none;
      cursor: pointer;
    }

    /* Chat Input */
    .input-area {
      padding: 12px 20px;
      border-top: 1px solid var(--border);
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .input-field {
      flex: 1;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 14px;
      color: var(--text);
      font-size: 13px;
      outline: none;
      font-family: var(--font);
    }

    .input-field:focus {
      border-color: var(--primary);
    }

    .send-btn {
      background: var(--primary);
      border: none;
      width: 36px;
      height: 36px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .send-btn svg {
      width: 16px;
      height: 16px;
      fill: #080C14;
    }

    .footer-brand {
      text-align: center;
      padding: 6px 0;
      font-size: 9px;
      color: var(--muted);
      border-top: 1px solid rgba(255, 255, 255, 0.03);
    }

    .footer-brand a {
      color: var(--primary);
      text-decoration: none;
      font-weight: 600;
    }

    /* Typing indicator */
    .typing {
      display: flex;
      gap: 4px;
      padding: 8px 12px;
      align-self: flex-start;
      background: #0c3e21;
      border-radius: 12px;
    }

    .typing span {
      width: 6px;
      height: 6px;
      background: var(--primary);
      border-radius: 50%;
      animation: dotPulse 1.5s infinite ease-in-out;
    }

    .typing span:nth-child(2) { animation-delay: 0.2s; }
    .typing span:nth-child(3) { animation-delay: 0.4s; }

    @keyframes dotPulse {
      0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
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
              AI Active
            </div>
          </div>
        </div>
        <button class="close-btn" id="midevela-close">✕</button>
      </div>

      <div class="msg-list" id="midevela-msg-list">
        <div class="msg-group ai">
          <span class="msg-badge">⚡ ${escapeHtml(aiName)}</span>
          <div class="msg-bubble">${escapeHtml(greeting)}</div>
          <span class="msg-time">${nowTime()}</span>
        </div>
      </div>

      <div class="input-area">
        <input type="text" class="input-field" id="midevela-input" maxlength="2000" placeholder="Ask me anything...">
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

    // Send message
    const handleSend = () => {
      const text = input.value.trim();
      if (!text) return;

      // Add customer message
      appendMessage(text, 'customer');
      input.value = '';

      // Scroll to bottom
      scrollToBottom();

      // Trigger typing state
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

    send.addEventListener('click', handleSend);
    input.addEventListener('keydown', (e) => {
      // isComposing: Enter during IME composition (e.g. Japanese input)
      // confirms the composition, not the message.
      if (e.key === 'Enter' && !e.isComposing) handleSend();
    });

    const appendMessage = (text, role, extraHTML = '') => {
      const msg = document.createElement('div');
      msg.className = `msg-group ${role}`;

      msg.innerHTML = `
      ${role === 'ai' ? `<span class="msg-badge">⚡ ${escapeHtml(aiName)}</span>` : ''}
      <div class="msg-bubble">${escapeHtml(text)}</div>
      ${extraHTML}
      <span class="msg-time">${nowTime()}</span>
    `;

      msgList.appendChild(msg);
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
