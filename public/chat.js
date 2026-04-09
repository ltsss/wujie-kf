// 用户端聊天逻辑
class UserChat {
  constructor() {
    this.userId = this.getUserId();
    this.conversationId = null;
    this.apiUrl = '/api';
    
    this.initElements();
    this.bindEvents();
    this.initConversation();
  }

  getUserId() {
    let userId = localStorage.getItem('kf_user_id');
    if (!userId) {
      userId = 'user_' + Date.now();
      localStorage.setItem('kf_user_id', userId);
    }
    return userId;
  }

  initElements() {
    this.messagesEl = document.getElementById('messages');
    this.inputEl = document.getElementById('messageInput');
    this.sendBtn = document.getElementById('sendBtn');
  }

  bindEvents() {
    this.sendBtn.addEventListener('click', () => this.sendMessage());
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.sendMessage();
    });
  }

  async initConversation() {
    try {
      const response = await fetch(`${this.apiUrl}/conversation/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: this.userId })
      });
      
      const data = await response.json();
      if (data.success) {
        this.conversationId = data.conversationId;
        this.addMessage('您好！我是無界茶台客服，有什么可以帮您？', 'bot');
        
        // 开始轮询消息
        this.startPolling();
      }
    } catch (error) {
      console.error('创建会话失败:', error);
      this.addMessage('连接失败，请刷新页面重试', 'bot');
    }
  }

  async sendMessage() {
    const content = this.inputEl.value.trim();
    if (!content || !this.conversationId) return;

    this.inputEl.value = '';
    this.addMessage(content, 'user');

    try {
      await fetch(`${this.apiUrl}/message/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: this.conversationId,
          senderType: 'user',
          senderId: this.userId,
          content: content
        })
      });
    } catch (error) {
      console.error('发送失败:', error);
    }
  }

  async startPolling() {
    // 每3秒轮询一次新消息
    setInterval(async () => {
      if (!this.conversationId) return;
      
      try {
        const response = await fetch(`${this.apiUrl}/conversation/${this.conversationId}/messages`);
        const data = await response.json();
        
        if (data.success && data.messages) {
          // 显示客服的新消息
          data.messages.forEach(msg => {
            if (msg.senderType === 'agent' && !msg.displayed) {
              this.addMessage(msg.content, 'bot');
              msg.displayed = true;
            }
          });
        }
      } catch (error) {
        console.error('轮询失败:', error);
      }
    }, 3000);
  }

  addMessage(content, type) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${type}`;
    
    const avatar = type === 'bot' ? '🍵' : '👤';
    
    messageEl.innerHTML = `
      <div class="avatar">${avatar}</div>
      <div class="content">${this.escapeHtml(content)}</div>
    `;
    
    this.messagesEl.appendChild(messageEl);
    this.scrollToBottom();
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  scrollToBottom() {
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }
}

// 启动
document.addEventListener('DOMContentLoaded', () => {
  new UserChat();
});
