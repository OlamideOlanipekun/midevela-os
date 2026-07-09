(function () {
  // Prevent duplicate load
  if (window.__MIDEVELA_WIDGET_LOADED__) return;
  window.__MIDEVELA_WIDGET_LOADED__ = true;

  // Configuration
  const widgetKey = document.currentScript ? document.currentScript.getAttribute('data-widget-key') : '';
  const themeColor = document.currentScript ? document.currentScript.getAttribute('data-theme-color') : '#1EE67A';
  // The widget is served from the Midevela app itself, so the API lives at the same origin as this script.
  const scriptSrc = document.currentScript ? document.currentScript.src : '';
  const apiBase = scriptSrc ? new URL(scriptSrc).origin : '';
  const messageApiUrl = `${apiBase}/api/widget/message`;

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getOrCreateCustomerId() {
    try {
      const key = 'midevela_customer_id';
      let id = window.localStorage.getItem(key);
      if (!id) {
        id = 'visitor-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
        window.localStorage.setItem(key, id);
      }
      return id;
    } catch (e) {
      return 'anonymous-shopper';
    }
  }

  const customerId = getOrCreateCustomerId();
  let conversationHistory = [];

  // Stylesheet to inject into the Shadow DOM
  const styleText = `
    :host {
      --primary: ${themeColor};
      --bg: #111827;
      --bg-header: linear-gradient(135deg, #0c3e21 0%, #0b2d18 100%);
      --text: #F0F4FF;
      --muted: #8892A4;
      --border: rgba(255, 255, 255, 0.08);
      --card: rgba(255, 255, 255, 0.04);
      --font: 'Outfit', sans-serif;
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

    /* ─── BACKDROP OVERLAY ─── */
    .backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      z-index: 999998;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
    }

    .backdrop.open {
      opacity: 1;
      pointer-events: all;
    }

    /* ─── CHAT PANEL (Centered Modal) ─── */
    .chat-panel {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0.95);
      width: 520px;
      height: 640px;
      max-width: 90vw;
      max-height: 85vh;
      border-radius: 24px;
      background: var(--bg);
      border: 1px solid var(--border);
      box-shadow: 0 30px 90px rgba(0, 0, 0, 0.6), 0 0 40px rgba(30, 230, 122, 0.1);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 999999;
      font-family: var(--font);
      opacity: 0;
      pointer-events: none;
      transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .chat-panel.open {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
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
    }

    .reco-body {
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
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

    /* Mobile responsive override */
    @media (max-width: 480px) {
      .chat-panel {
        bottom: 0;
        right: 0;
        width: 100%;
        height: 100%;
        border-radius: 0;
        border: none;
      }
    }
  `;

  // Create Shadow Host & Attach Shadow Root
  const container = document.createElement('div');
  container.id = 'midevela-widget-container';
  document.body.appendChild(container);

  const shadow = container.attachShadow({ mode: 'open' });

  // Add Outfit font link inside head of main document so it loads correctly
  if (!document.getElementById('midevela-font-link')) {
    const link = document.createElement('link');
    link.id = 'midevela-font-link';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap';
    document.head.appendChild(link);
  }

  // Create Wrapper
  const wrapper = document.createElement('div');

  // Insert styling rules
  const style = document.createElement('style');
  style.textContent = styleText;
  shadow.appendChild(style);
  shadow.appendChild(wrapper);

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
          <div class="header-avatar">M</div>
          <div>
            <div class="header-title">LuxeStyle Sales Assistant</div>
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
          <span class="msg-badge">⚡ Midevela AI</span>
          <div class="msg-bubble">
            Good day! Welcome to LuxeStyle. How can I help you find the perfect outfit today?
          </div>
          <span class="msg-time">11:15 PM</span>
        </div>
      </div>

      <div class="input-area">
        <input type="text" class="input-field" id="midevela-input" placeholder="Ask me anything...">
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

  // Toggle chat panel open state
  const toggleChat = () => {
    const isOpen = chat.classList.toggle('open');
    backdrop.classList.toggle('open', isOpen);
    fab.classList.toggle('open', isOpen);
    if (isOpen) {
      input.focus();
    }
  };

  fab.addEventListener('click', toggleChat);
  close.addEventListener('click', toggleChat);
  backdrop.addEventListener('click', toggleChat);

  // Send message
  const handleSend = () => {
    const text = input.value.trim();
    if (!text) return;

    // Add customer message
    appendMessage(text, 'customer');
    conversationHistory.push({ role: 'customer', content: text });
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
    if (e.key === 'Enter') handleSend();
  });

  const appendMessage = (text, role, extraHTML = '') => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msg = document.createElement('div');
    msg.className = `msg-group ${role}`;

    msg.innerHTML = `
      ${role === 'ai' ? '<span class="msg-badge">⚡ Midevela AI</span>' : ''}
      <div class="msg-bubble">${escapeHtml(text)}</div>
      ${extraHTML}
      <span class="msg-time">${time}</span>
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

  const handleAIResponse = (data) => {
    const replyText = (data && data.replyText) || "Sorry, I didn't quite catch that. Could you rephrase?";
    const recommendations = Array.isArray(data && data.recommendations) ? data.recommendations : [];

    let recoHTML = '';
    if (recommendations.length > 0) {
      recoHTML = `
        <div class="reco-container">
          ${recommendations
            .map(
              (r) => `
            <div class="reco-card">
              <div class="reco-img">🛍️</div>
              <div class="reco-body">
                <span class="reco-name">${escapeHtml(r.name)}</span>
                <span class="reco-price">${escapeHtml(r.price)}</span>
                <span class="reco-why">${escapeHtml(r.whyThis || '')}</span>
              </div>
              <div class="reco-btn">View Product</div>
            </div>
          `
            )
            .join('')}
        </div>
      `;
    }

    appendMessage(replyText, 'ai', recoHTML);
    conversationHistory.push({ role: 'ai', content: replyText });
    scrollToBottom();
  };

  // Proactive trigger mockup based on config delay
  setTimeout(() => {
    // Only open if the user hasn't interacted yet
    if (!chat.classList.contains('open')) {
      toggleChat();
    }
  }, 1000 * 10); // 10s delay

})();
