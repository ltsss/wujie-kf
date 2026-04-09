// 客服后台逻辑
class AdminChat {
  constructor() {
    this.agentId = 'agent_001';
    this.agentName = '客服小珍';
    this.apiUrl = '/api';
    this.currentConversation = null;
    this.conversations = [];
    
    this.initElements();
    this.bindEvents();
    this.login();
    this.startPolling();
  }

  initElements() {
    this.conversationListEl = document.getElementById('conversationList');
    this.messagesEl = document.getElementById('messages');
    this.chatTitleEl = document.getElementById('chatTitle');
    this.inputAreaEl = document.getElementById('inputArea');
    this.messageInputEl = document.getElementById('messageInput');
    this.sendBtnEl = document.getElementById('sendBtn');
  }

  bindEvents() {
    this.sendBtnEl.addEventListener('click', () => this.sendMessage());
    this.messageInputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
  }

  async login() {
    try {
      await fetch(`${this.apiUrl}/agent/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: this.agentId, password: '123456' })
      });
      console.log('客服登录成功');
    } catch (error) {
      console.error('登录失败:', error);
    }
  }

  async loadConversations() {
    try {
      const response = await fetch(`${this.apiUrl}/agent/conversations`);
      const data = await response.json();
      
      if (data.success) {
        this.conversations = data.conversations;
        this.renderConversationList();
      }
    } catch (error) {
      console.error('加载会话失败:', error);
    }
  }

  renderConversationList() {
    this.conversationListEl.innerHTML = '';
    
    this.conversations.forEach(conv => {
      const item = document.createElement('div');
      item.className = `conversation-item ${this.currentConversation?.id === conv.id ? 'active' : ''}`;
      
      const lastMsg = conv.messages[conv.messages.length - 1];
      const preview = lastMsg ? lastMsg.content : '暂无消息';
      
      item.innerHTML = `
        <div class="name">用户 ${conv.userId.slice(-6)}</div>
        <div class="preview">${this.escapeHtml(preview)}</div>
        <div class="time">${this.formatTime(conv.createdAt)}</div>
      `;
      
      item.addEventListener('click', () => this.selectConversation(conv));
      this.conversationListEl.appendChild(item);
    });
  }

  async selectConversation(conv) {
    this.currentConversation = conv;
    this.chatTitleEl.textContent = `用户 ${conv.userId.slice(-6)}`;
    this.inputAreaEl.style.display = 'flex';
    
    // 加载消息
    await this.loadMessages(conv.id);
    this.renderConversationList();
  }

  async loadMessages(conversationId) {
    try {
      const response = await fetch(`${this.apiUrl}/conversation/${conversationId}/messages`);
      const data = await response.json();
      
      if (data.success) {
        this.messagesEl.innerHTML = '';
        data.messages.forEach(msg => {
          this.addMessage(msg.content, msg.senderType === 'user' ? 'user' : 'bot', false);
        });
      }
    } catch (error) {
      console.error('加载消息失败:', error);
    }
  }

  async sendMessage() {
    const content = this.messageInputEl.value.trim();
    if (!content || !this.currentConversation) return;

    this.messageInputEl.value = '';
    this.addMessage(content, 'bot', true);

    try {
      await fetch(`${this.apiUrl}/message/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: this.currentConversation.id,
          senderType: 'agent',
          senderId: this.agentId,
          content: content
        })
      });
    } catch (error) {
      console.error('发送失败:', error);
    }
  }

  addMessage(content, type, animate = true) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${type}`;
    if (animate) messageEl.style.animation = 'fadeIn 0.3s ease';
    
    const avatar = type === 'bot' ? '👤' : '👤';
    
    messageEl.innerHTML = `
      <div class="avatar">${avatar}</div>
      <div class="content">${this.escapeHtml(content)}</div>
    `;
    
    this.messagesEl.appendChild(messageEl);
    this.scrollToBottom();
  }

  startPolling() {
    // 每2秒刷新会话列表
    setInterval(() => {
      this.loadConversations();
      
      // 如果有当前会话，刷新消息
      if (this.currentConversation) {
        this.loadMessages(this.currentConversation.id);
      }
    }, 2000);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  formatTime(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }

  scrollToBottom() {
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }
}

// 启动
document.addEventListener('DOMContentLoaded', () => {
  new AdminChat();
});
