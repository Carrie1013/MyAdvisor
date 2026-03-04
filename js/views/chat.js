/* =========================================================
   views/chat.js — AI Assistant with RAG + file upload
   ========================================================= */

const CHAT_SYSTEM_PROMPT = `You are a sophisticated financial advisor AI for Intelligence Platform — a professional wealth management system.

Your expertise covers:
1. **General Financial Knowledge** — markets, macroeconomics, valuation, risk theory
2. **Portfolio Analysis** — performance attribution, factor exposure, risk decomposition
3. **ETF Selection** — fund comparison, expense ratios, liquidity, tax efficiency
4. **Investment Strategy** — asset allocation, diversification, rebalancing
5. **Tax-Efficient Investing** — asset location, tax-loss harvesting, wash-sale rules
6. **Regulatory Compliance** — SEC rules, fiduciary standards, concentration limits

**Core Investment Philosophy:**
We follow the Markowitz-Michaud framework — we do not predict markets, we construct optimally diversified portfolios:
1. Asset Universe Selection — liquid, diversified ETFs from established providers
2. Risk & Return Estimation — historical data + forward-looking adjustments
3. Portfolio Construction — Michaud Resampled Efficient Frontier (REF) for robustness
4. Monitor & Rebalance — systematic drift detection, threshold-based rebalancing

**Response Style:**
- Professional, precise, and educational
- Use tables and bullet points for clarity
- Cite specific data, numbers, and academic references when relevant
- Flag risks and alternatives clearly
- Always note that responses are informational, not personalized investment advice

**Client Context:**
- Client: Carrie Feng, Moderate Growth profile, $1.5M portfolio
- Primary holdings: Tech stocks, US Treasury bonds, Gold (GLD)
- Investment horizon: Long-term (10+ years)`;

const STARTER_PROMPTS = [
  "What is the Michaud Resampled Efficient Frontier and why is it better?",
  "Explain tax-loss harvesting and wash-sale rules",
  "How should I think about asset location across taxable vs tax-advantaged accounts?",
  "What are the key differences between VTI, VOO, and SPY?",
  "Analyze my current portfolio concentration risk",
  "What is the Capital Market Line and how does it guide portfolio construction?",
];

const ChatView = {
  _chartInstances: {},

  render(container, state) {
    container.innerHTML = `
      <div class="chat-layout">
        <div class="chat-topbar">
          <div>
            <div class="chat-topbar-title">Efficient Asset Management Assistant</div>
            <div class="chat-topbar-sub"></div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <span id="ragStatus" class="highlight-chip chip-blue" style="font-size:11px;">
              &#9679; RAG Ready
            </span>
            <button class="btn-secondary btn-sm" id="clearChat">Clear Chat</button>
          </div>
        </div>

        <div class="chat-messages" id="chatMessages">
          ${state.chatHistory.length === 0 ? this._welcomeHTML() : ''}
        </div>

        <div class="chat-input-area">
          <div class="docs-indicator" id="docsIndicator"></div>
          <div class="chat-input-row">
            <label class="file-upload-btn" title="Upload document for RAG context">
              &#128206;
              <input type="file" id="fileInput" accept=".txt,.md,.json,.pdf,.csv" style="display:none" multiple>
            </label>
            <textarea class="chat-textarea" id="chatInput"
              placeholder="Ask about finance, markets, your portfolio, or ETF strategies..."
              rows="1"></textarea>
            <button class="send-btn" id="sendBtn" title="Send (Enter)">&#10148;</button>
          </div>
          <div style="margin-top:6px;font-size:11px;color:var(--text-muted);">
            Press Enter to send · Shift+Enter for new line · Upload files for RAG context
          </div>
        </div>
      </div>
    `;

    // Restore history
    if (state.chatHistory.length > 0) {
      const msgs = document.getElementById('chatMessages');
      state.chatHistory.forEach(m => {
        msgs.insertAdjacentHTML('beforeend', this._msgHTML(m.role, m.content));
      });
      msgs.scrollTop = msgs.scrollHeight;
    }

    this._renderDocs(state);
    this._bindEvents(state);
  },

  _welcomeHTML() {
    return `
      <div class="chat-welcome">
        <div class="welcome-icon">&#129504;</div>
        <div class="welcome-title">AI Assistant</div>
        <div class="welcome-sub">
          Ask me anything about financial markets, portfolio strategy, ETFs,
          or your current investment holdings. Upload research documents below
          and I'll incorporate them into my analysis.
        </div>
        <div class="starter-prompts">
          ${STARTER_PROMPTS.map(p => `<div class="starter-chip" data-prompt="${p}">${p}</div>`).join('')}
        </div>
      </div>
    `;
  },

  _msgHTML(role, content) {
    const isUser = role === 'user';
    const avatarClass = isUser ? 'avatar-user' : 'avatar-assistant';
    const avatarLabel = isUser ? 'CF' : 'N';
    const bubbleClass  = isUser ? 'bubble-user' : 'bubble-assistant';
    const parsed = isUser ? content : (typeof marked !== 'undefined' ? marked.parse(content) : content);

    return `
      <div class="chat-message ${role}">
        <div class="chat-avatar ${avatarClass}">${avatarLabel}</div>
        <div class="chat-bubble ${bubbleClass}">${parsed}</div>
      </div>
    `;
  },

  _appendMsg(role, content, state) {
    const msgs = document.getElementById('chatMessages');
    if (!msgs) return;
    // Remove welcome screen on first message
    const welcome = msgs.querySelector('.chat-welcome');
    if (welcome) welcome.remove();

    msgs.insertAdjacentHTML('beforeend', this._msgHTML(role, content));
    msgs.scrollTop = msgs.scrollHeight;

    // Save to history
    state.chatHistory.push({ role, content });
    if (state.chatHistory.length > 60) state.chatHistory.splice(0, 2);
  },

  _appendTyping() {
    const msgs = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.className = 'chat-message assistant';
    div.id = 'typingIndicator';
    div.innerHTML = `
      <div class="chat-avatar avatar-assistant">N</div>
      <div class="chat-bubble bubble-assistant">
        <div class="chat-typing">
          <div class="typing-dots"><span></span><span></span><span></span></div>
          <span>Thinking...</span>
        </div>
      </div>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  },

  _removeTyping() {
    document.getElementById('typingIndicator')?.remove();
  },

  _buildMessages(state) {
    // Build message array for Claude API
    return state.chatHistory.map(m => ({ role: m.role, content: m.content }));
  },

  _buildSystemWithDocs(state) {
    let sys = CHAT_SYSTEM_PROMPT;
    if (state.uploadedDocs.length > 0) {
      sys += '\n\n---\n## Uploaded Research Documents (RAG Context)\n\n';
      state.uploadedDocs.forEach(doc => {
        sys += `### Document: ${doc.name}\n\`\`\`\n${doc.content.slice(0, 8000)}\n\`\`\`\n\n`;
      });
    }
    return sys;
  },

  async _sendMessage(state) {
    const input = document.getElementById('chatInput');
    const btn   = document.getElementById('sendBtn');
    const text  = input.value.trim();
    if (!text) return;

    input.value = '';
    input.style.height = 'auto';
    btn.disabled = true;

    this._appendMsg('user', text, state);
    this._appendTyping();

    try {
      const apiKey = state.settings.claudeApiKey;
      const msgs   = this._buildMessages(state);
      // Remove last user message from history (we just added it above), pass full conv
      const conversation = msgs.slice(0, -1).concat({ role: 'user', content: text });

      const resp = await API.callClaude(
        conversation,
        this._buildSystemWithDocs(state),
        apiKey
      );

      this._removeTyping();
      const reply = resp?.content?.[0]?.text || 'I encountered an issue generating a response. Please try again.';
      this._appendMsg('assistant', reply, state);
    } catch (err) {
      this._removeTyping();
      const errMsg = err.message.includes('API key')
        ? '**API Key Required**\n\nPlease add your Claude API key in ⚙️ Settings to use the AI Assistant.'
        : `**Error:** ${err.message}`;
      this._appendMsg('assistant', errMsg, state);
    }

    btn.disabled = false;
    input.focus();
  },

  _renderDocs(state) {
    const ind = document.getElementById('docsIndicator');
    if (!ind) return;
    ind.innerHTML = state.uploadedDocs.map((doc, i) => `
      <div class="doc-chip">
        &#128206; ${doc.name}
        <button onclick="ChatView._removeDoc(${i}, App.state)">&#10005;</button>
      </div>
    `).join('');
  },

  _removeDoc(idx, state) {
    state.uploadedDocs.splice(idx, 1);
    this._renderDocs(state);
  },

  async _handleFileUpload(files, state) {
    for (const file of files) {
      try {
        const content = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload  = e => resolve(e.target.result);
          reader.onerror = reject;
          reader.readAsText(file);
        });
        state.uploadedDocs.push({ name: file.name, content });
        App.toast(`Uploaded: ${file.name}`, 'success');
      } catch {
        App.toast(`Failed to read: ${file.name}`, 'error');
      }
    }
    this._renderDocs(state);
  },

  _bindEvents(state) {
    const input  = document.getElementById('chatInput');
    const btn    = document.getElementById('sendBtn');
    const fileEl = document.getElementById('fileInput');

    // Auto-resize textarea
    input?.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 160) + 'px';
    });

    // Send on Enter (Shift+Enter = newline)
    input?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._sendMessage(state); }
    });

    btn?.addEventListener('click', () => this._sendMessage(state));

    // File upload
    fileEl?.addEventListener('change', e => {
      const files = Array.from(e.target.files);
      this._handleFileUpload(files, state);
      e.target.value = '';
    });

    // Starter prompts
    document.querySelectorAll('.starter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (input) { input.value = chip.dataset.prompt; input.focus(); }
      });
    });

    // Clear chat
    document.getElementById('clearChat')?.addEventListener('click', () => {
      state.chatHistory = [];
      const msgs = document.getElementById('chatMessages');
      if (msgs) msgs.innerHTML = this._welcomeHTML();
    });
  },
};
