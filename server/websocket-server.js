// server/websocket-server.js
const WebSocket = require('ws');
const http = require('http');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

// Store active collaboration sessions
const collaborationRooms = new Map();

class CollaborationRoom {
  constructor(codeId) {
    this.codeId = codeId;
    this.clients = new Map(); // userId -> { ws, userEmail, lastSeen }
    this.currentCode = '';
    this.currentEditor = null;
    this.editStartTime = null;
  }

  addClient(userId, userEmail, ws) {
    this.clients.set(userId, { ws, userEmail, lastSeen: Date.now() });
    this.broadcastCollaborators();
    this.broadcast({
      type: 'user_joined',
      userId,
      userEmail,
      timestamp: new Date().toISOString()
    }, userId);
  }

  removeClient(userId) {
    const client = this.clients.get(userId);
    this.clients.delete(userId);
    
    // If the user who left was editing, release the lock
    if (this.currentEditor === userId) {
      this.releaseEdit(userId);
    }

    if (client) {
      this.broadcast({
        type: 'user_left',
        userId,
        userEmail: client.userEmail,
        timestamp: new Date().toISOString()
      });
    }

    this.broadcastCollaborators();

    // Clean up room if empty
    return this.clients.size === 0;
  }

  requestEdit(userId, userEmail) {
    // Check if someone else is editing
    if (this.currentEditor && this.currentEditor !== userId) {
      return false;
    }

    this.currentEditor = userId;
    this.editStartTime = Date.now();

    this.broadcast({
      type: 'edit_started',
      userId,
      userEmail,
      timestamp: new Date().toISOString()
    });

    return true;
  }

  releaseEdit(userId) {
    if (this.currentEditor !== userId) return;

    this.currentEditor = null;
    this.editStartTime = null;

    this.broadcast({
      type: 'edit_stopped',
      userId,
      timestamp: new Date().toISOString()
    });
  }

  updateCode(userId, code) {
    if (this.currentEditor !== userId) return false;

    this.currentCode = code;
    this.broadcast({
      type: 'code_update',
      userId,
      code,
      timestamp: new Date().toISOString()
    }, userId); // Don't send back to sender

    return true;
  }

  broadcastCollaborators() {
    const collaborators = Array.from(this.clients.entries()).map(([userId, client]) => ({
      userId,
      userEmail: client.userEmail,
      isEditing: this.currentEditor === userId
    }));

    this.broadcast({
      type: 'collaborators',
      collaborators,
      currentEditor: this.currentEditor
    });
  }

  broadcast(message, excludeUserId = null) {
    const messageStr = JSON.stringify(message);
    
    this.clients.forEach((client, userId) => {
      if (userId !== excludeUserId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(messageStr);
      }
    });
  }

  updateLastSeen(userId) {
    const client = this.clients.get(userId);
    if (client) {
      client.lastSeen = Date.now();
    }
  }
}

// Handle WebSocket connections
wss.on('connection', (ws) => {
  console.log('New WebSocket connection');
  
  let userId = null;
  let currentCodeId = null;

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'join':
          handleJoin(ws, message);
          break;

        case 'start_edit':
          handleStartEdit(message);
          break;

        case 'stop_edit':
          handleStopEdit(message);
          break;

        case 'code_update':
          handleCodeUpdate(message);
          break;

        case 'cursor_position':
          handleCursorPosition(message);
          break;

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          if (currentCodeId && userId) {
            const room = collaborationRooms.get(currentCodeId);
            room?.updateLastSeen(userId);
          }
          break;

        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', () => {
    if (currentCodeId && userId) {
      const room = collaborationRooms.get(currentCodeId);
      if (room) {
        const isEmpty = room.removeClient(userId);
        if (isEmpty) {
          collaborationRooms.delete(currentCodeId);
          console.log(`Room ${currentCodeId} closed`);
        }
      }
    }
    console.log('WebSocket connection closed');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  function handleJoin(ws, message) {
    userId = message.userId;
    currentCodeId = message.codeId;
    const userEmail = message.userEmail;

    // Get or create room
    let room = collaborationRooms.get(currentCodeId);
    if (!room) {
      room = new CollaborationRoom(currentCodeId);
      collaborationRooms.set(currentCodeId, room);
      console.log(`Created new room for code: ${currentCodeId}`);
    }

    room.addClient(userId, userEmail, ws);
    
    // Send current code state if available
    if (room.currentCode) {
      ws.send(JSON.stringify({
        type: 'code_update',
        code: room.currentCode,
        userId: null // System message
      }));
    }

    console.log(`User ${userEmail} joined room ${currentCodeId}`);
  }

  function handleStartEdit(message) {
    const room = collaborationRooms.get(message.codeId);
    if (!room) return;

    const success = room.requestEdit(message.userId, message.userEmail);
    
    // Send confirmation back to requester
    ws.send(JSON.stringify({
      type: success ? 'edit_granted' : 'edit_denied',
      currentEditor: room.currentEditor
    }));
  }

  function handleStopEdit(message) {
    const room = collaborationRooms.get(message.codeId);
    if (!room) return;

    room.releaseEdit(message.userId);
  }

  function handleCodeUpdate(message) {
    const room = collaborationRooms.get(message.codeId);
    if (!room) return;

    room.updateCode(message.userId, message.code);
  }

  function handleCursorPosition(message) {
    const room = collaborationRooms.get(message.codeId);
    if (!room) return;

    room.broadcast({
      type: 'cursor_position',
      userId: message.userId,
      position: message.position
    }, message.userId);
  }
});

// Cleanup inactive sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  const INACTIVE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  collaborationRooms.forEach((room, codeId) => {
    room.clients.forEach((client, userId) => {
      if (now - client.lastSeen > INACTIVE_TIMEOUT) {
        console.log(`Removing inactive user ${userId} from room ${codeId}`);
        client.ws.close();
        room.removeClient(userId);
      }
    });

    if (room.clients.size === 0) {
      collaborationRooms.delete(codeId);
    }
  });
}, 5 * 60 * 1000);

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  wss.clients.forEach(client => {
    client.close();
  });
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});