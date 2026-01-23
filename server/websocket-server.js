const WebSocket = require('ws');
const http = require('http');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

// Store active collaboration sessions
const collaborationRooms = new Map();

/**
 * Manages a collaboration room for real-time code editing
 * Handles client connections, edit locking, and code synchronization
 */
class CollaborationRoom {
  constructor(codeId) {
    this.codeId = codeId;
    this.clients = new Map(); // userId -> { ws, userEmail, lastSeen }
    this.currentCode = '';
    this.currentEditor = null; // User ID of current editor
    this.editStartTime = null;
  }

  /**
   * Adds a new client to the room and notifies other collaborators
   */
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

  /**
   * Removes a client and releases edit lock if they were editing
   * Returns true if room is now empty
   */
  removeClient(userId) {
    const client = this.clients.get(userId);
    this.clients.delete(userId);

    // Release edit lock if this user was editing
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
    return this.clients.size === 0;
  }

  /**
   * Grants editing permission to a user
   * Returns false if another user is already editing
   */
  requestEdit(userId, userEmail) {
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

  /**
   * Releases editing lock for a user
   */
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

  /**
   * Updates code and broadcasts changes to other clients
   * Only allows updates from the current editor
   */
  updateCode(userId, code) {
    if (this.currentEditor !== userId) return false;

    this.currentCode = code;
    this.broadcast({
      type: 'code_update',
      userId,
      code,
      timestamp: new Date().toISOString()
    }, userId); // Exclude sender from broadcast

    return true;
  }

  /**
   * Sends current list of collaborators to all clients
   */
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

  /**
   * Broadcasts a message to all clients except the excluded one
   */
  broadcast(message, excludeUserId = null) {
    const messageStr = JSON.stringify(message);

    this.clients.forEach((client, userId) => {
      if (userId !== excludeUserId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(messageStr);
      }
    });
  }

  /**
   * Updates the last seen timestamp for a user
   */
  updateLastSeen(userId) {
    const client = this.clients.get(userId);
    if (client) {
      client.lastSeen = Date.now();
    }
  }
}

// WebSocket connection handler
wss.on('connection', (ws) => {
  let userId = null;
  let currentCodeId = null;

  // Handle incoming messages from client
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
          break;
      }
    } catch (error) {
      // Invalid messages are silently ignored
    }
  });

  // Handle client disconnect
  ws.on('close', () => {
    if (currentCodeId && userId) {
      const room = collaborationRooms.get(currentCodeId);
      if (room) {
        const isEmpty = room.removeClient(userId);
        if (isEmpty) {
          collaborationRooms.delete(currentCodeId);
        }
      }
    }
  });

  ws.on('error', () => {
    // Errors are silently handled
  });

  /**
   * Handles user joining a collaboration room
   */
  function handleJoin(ws, message) {
    userId = message.userId;
    currentCodeId = message.codeId;
    const userEmail = message.userEmail;

    // Get existing room or create new one
    let room = collaborationRooms.get(currentCodeId);
    if (!room) {
      room = new CollaborationRoom(currentCodeId);
      collaborationRooms.set(currentCodeId, room);
    }

    room.addClient(userId, userEmail, ws);

    // Send current code state to new user
    if (room.currentCode) {
      ws.send(JSON.stringify({
        type: 'code_update',
        code: room.currentCode,
        userId: null // System message
      }));
    }
  }

  /**
   * Handles request to start editing
   */
  function handleStartEdit(message) {
    const room = collaborationRooms.get(message.codeId);
    if (!room) return;

    const success = room.requestEdit(message.userId, message.userEmail);

    // Send grant/deny response to requester
    ws.send(JSON.stringify({
      type: success ? 'edit_granted' : 'edit_denied',
      currentEditor: room.currentEditor
    }));
  }

  /**
   * Handles request to stop editing
   */
  function handleStopEdit(message) {
    const room = collaborationRooms.get(message.codeId);
    if (!room) return;

    room.releaseEdit(message.userId);
  }

  /**
   * Handles code updates from the current editor
   */
  function handleCodeUpdate(message) {
    const room = collaborationRooms.get(message.codeId);
    if (!room) return;

    room.updateCode(message.userId, message.code);
  }

  /**
   * Handles cursor position updates for collaborative awareness
   */
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
        client.ws.close();
        room.removeClient(userId);
      }
    });

    // Delete empty rooms
    if (room.clients.size === 0) {
      collaborationRooms.delete(codeId);
    }
  });
}, 5 * 60 * 1000);

// Start WebSocket server
const PORT = process.env.PORT || 8080;
server.listen(PORT);

// Graceful shutdown handler
process.on('SIGTERM', () => {
  wss.clients.forEach(client => {
    client.close();
  });
  server.close(() => {
    process.exit(0);
  });
});