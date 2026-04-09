// 自建客服系统 - 服务端
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;

// 内存存储
const storage = {
  conversations: new Map(), // 会话列表
  messages: new Map(),      // 消息列表
  agents: new Map(),        // 客服列表
  onlineAgents: new Set()   // 在线客服
};

// 初始化一个测试客服
storage.agents.set('agent_001', {
  id: 'agent_001',
  name: '客服小珍',
  status: 'offline',
  currentSessions: 0
});

// 简单的 HTTP 服务 + WebSocket
const server = http.createServer((req, res) => {
  const url = req.url;
  const method = req.method;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  console.log(`${method} ${url}`);

  // API 路由
  if (url === '/api/health' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      onlineAgents: storage.onlineAgents.size,
      activeConversations: storage.conversations.size
    }));
    return;
  }

  // 用户创建会话
  if (url === '/api/conversation/create' && method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const userId = data.userId || 'user_' + Date.now();
        
        const conversationId = 'conv_' + Date.now();
        const conversation = {
          id: conversationId,
          userId: userId,
          agentId: null,
          status: 'waiting', // waiting, active, closed
          createdAt: new Date(),
          messages: []
        };
        
        storage.conversations.set(conversationId, conversation);
        
        // 分配给在线客服
        const availableAgent = findAvailableAgent();
        if (availableAgent) {
          conversation.agentId = availableAgent.id;
          conversation.status = 'active';
          availableAgent.currentSessions++;
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          conversationId: conversationId,
          agentId: conversation.agentId,
          status: conversation.status
        }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // 发送消息
  if (url === '/api/message/send' && method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { conversationId, senderType, senderId, content } = data;
        
        const conversation = storage.conversations.get(conversationId);
        if (!conversation) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: '会话不存在' }));
          return;
        }
        
        const message = {
          id: 'msg_' + Date.now(),
          conversationId,
          senderType, // 'user' 或 'agent'
          senderId,
          content,
          timestamp: new Date()
        };
        
        conversation.messages.push(message);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // 获取会话消息
  if (url.startsWith('/api/conversation/') && url.endsWith('/messages') && method === 'GET') {
    const conversationId = url.split('/')[3];
    const conversation = storage.conversations.get(conversationId);
    
    if (!conversation) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: '会话不存在' }));
      return;
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: true, 
      messages: conversation.messages 
    }));
    return;
  }

  // 客服登录
  if (url === '/api/agent/login' && method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { agentId, password } = data;
        
        // 简单验证（实际应该用密码）
        const agent = storage.agents.get(agentId);
        if (!agent) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: '客服不存在' }));
          return;
        }
        
        agent.status = 'online';
        storage.onlineAgents.add(agentId);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          agent: { id: agent.id, name: agent.name }
        }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // 获取客服会话列表
  if (url === '/api/agent/conversations' && method === 'GET') {
    const conversations = Array.from(storage.conversations.values())
      .filter(c => c.status !== 'closed')
      .sort((a, b) => b.createdAt - a.createdAt);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, conversations }));
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// 查找可用客服
function findAvailableAgent() {
  for (const agent of storage.agents.values()) {
    if (agent.status === 'online' && agent.currentSessions < 5) {
      return agent;
    }
  }
  return null;
}

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║     自建客服系统已启动               ║
╠══════════════════════════════════════╣
║  端口: ${PORT}                         ║
║  客服后台: http://localhost:${PORT}/admin ║
╚══════════════════════════════════════╝
  `);
});

module.exports = { storage };
