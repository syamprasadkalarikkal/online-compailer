const WebSocket = require('ws');
const http = require('http');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

// Store active chat sessions
const chatRooms = new Map();

class ChatRoom {
    constructor(codeId) {
        this.codeId = codeId;
        this.clients = new Map(); // userId -> { ws, userEmail, lastSeen }
    }

    addClient(userId, userEmail, ws) {
        this.clients.set(userId, { ws, userEmail, lastSeen: Date.now() });
    }

    removeClient(userId) {
        this.clients.delete(userId);
        return this.clients.size === 0;
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

wss.on('connection', (ws) => {
    let userId = null;
    let currentCodeId = null;

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());

            switch (message.type) {
                case 'join':
                    userId = message.userId;
                    currentCodeId = message.codeId;
                    const userEmail = message.userEmail;

                    let room = chatRooms.get(currentCodeId);
                    if (!room) {
                        room = new ChatRoom(currentCodeId);
                        chatRooms.set(currentCodeId, room);
                    }
                    room.addClient(userId, userEmail, ws);
                    break;

                case 'chat_message':
                    if (currentCodeId && userId) {
                        const room = chatRooms.get(currentCodeId);
                        if (room) {
                            room.broadcast({
                                type: 'chat_message',
                                id: message.id,
                                code_id: message.codeId,
                                user_id: message.userId,
                                message: message.message,
                                created_at: message.created_at || new Date().toISOString()
                            }, message.userId); // Exclude sender
                        }
                    }
                    break;

                case 'ping':
                    ws.send(JSON.stringify({ type: 'pong' }));
                    if (currentCodeId && userId) {
                        const room = chatRooms.get(currentCodeId);
                        room?.updateLastSeen(userId);
                    }
                    break;
            }
        } catch (e) {
            console.error('Error processing message:', e);
        }
    });

    ws.on('close', () => {
        if (currentCodeId && userId) {
            const room = chatRooms.get(currentCodeId);
            if (room) {
                if (room.removeClient(userId)) {
                    chatRooms.delete(currentCodeId);
                }
            }
        }
    });
});

// Cleanup inactive sessions every 5 minutes
setInterval(() => {
    const now = Date.now();
    const INACTIVE_TIMEOUT = 5 * 60 * 1000;

    chatRooms.forEach((room, codeId) => {
        room.clients.forEach((client, userId) => {
            if (now - client.lastSeen > INACTIVE_TIMEOUT) {
                client.ws.close();
                room.removeClient(userId);
            }
        });
        if (room.clients.size === 0) chatRooms.delete(codeId);
    });
}, 5 * 60 * 1000);

const PORT = 8081;
server.listen(PORT, () => {
    console.log(`Chat server running on port ${PORT}`);
});
