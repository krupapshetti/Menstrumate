// ==================== websocket-server.js ====================

const WebSocket = require("ws");
const jwt = require("jsonwebtoken");
const url = require("url");

const SECRET = process.env.JWT_SECRET || "menstrumate-dev-secret";
const connectedClients = new Map(); // userId -> { ws, socketId, userName }
const activeCalls = new Map(); // callId -> { caller, receiver, type, startTime }

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server, path: "/ws/community" });

  wss.on("connection", async (ws, req) => {
    let userId = null;
    let userName = null;

    const params = new url.URLSearchParams(req.url.split("?")[1]);
    const token = params.get("token");

    if (!token) {
      ws.close(4001, "Authentication required");
      return;
    }

    try {
      const decoded = jwt.verify(token, SECRET);
      userId = decoded.id;
      userName = decoded.name || "User";
    } catch (error) {
      ws.close(4002, "Invalid token");
      return;
    }

    const socketId = `socket_${Date.now()}_${Math.random()}`;
    connectedClients.set(userId, { ws, socketId, userName });

    // Update online status in DB
    try {
      const { readDb, writeDb } = require("./services/db");
      const db = await readDb();
      db.onlineStatuses = db.onlineStatuses || [];
      const idx = db.onlineStatuses.findIndex(s => s.userId === userId);
      if (idx !== -1) {
        db.onlineStatuses[idx].isOnline = true;
        db.onlineStatuses[idx].socketId = socketId;
        db.onlineStatuses[idx].lastSeen = new Date().toISOString();
      } else {
        db.onlineStatuses.push({ userId, isOnline: true, socketId, lastSeen: new Date().toISOString() });
      }
      await writeDb(db);
    } catch (err) {
      console.error("Failed to update online status:", err);
    }

    broadcastToAll({ type: "user_online", userId, userName }, userId);
    console.log(`✅ User ${userName} (${userId}) connected`);

    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data);
        console.log(`📨 Message from ${userId}:`, message.type);
        
        switch (message.type) {
          case "ping":
            ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
            break;
          case "send_message":
            await handleSendMessage(userId, userName, message);
            break;
          case "typing":
            await handleTyping(userId, userName, message);
            break;
          case "mark_read":
            await handleMarkRead(userId, message);
            break;
          case "call_request":
            await handleCallRequest(userId, userName, message);
            break;
          case "call_accepted":
            await handleCallAccepted(userId, message);
            break;
          case "call_rejected":
            await handleCallRejected(userId, message);
            break;
          case "call_ended":
            await handleCallEnded(userId, message);
            break;
          case "call_busy":
            await handleCallBusy(userId, message);
            break;
          case "webrtc_offer":
          case "webrtc_answer":
          case "ice_candidate":
            await handleWebRTCSignal(userId, message);
            break;
          default:
            console.log("Unknown message type:", message.type);
        }
      } catch (err) {
        console.error("Message parsing error:", err);
        ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
      }
    });

    ws.on("close", async () => {
      console.log(`🔌 User ${userName} (${userId}) disconnected`);
      connectedClients.delete(userId);
      
      try {
        const { readDb, writeDb } = require("./services/db");
        const db = await readDb();
        db.onlineStatuses = db.onlineStatuses || [];
        const s = db.onlineStatuses.find(s => s.userId === userId);
        if (s) {
          s.isOnline = false;
          s.lastSeen = new Date().toISOString();
        }
        await writeDb(db);
      } catch (err) {
        console.error("Failed to update offline status:", err);
      }

      broadcastToAll({ type: "user_offline", userId }, userId);

      // End any active calls
      for (const [callId, call] of activeCalls) {
        if (call.caller.userId === userId || call.receiver.userId === userId) {
          const otherId = call.caller.userId === userId ? call.receiver.userId : call.caller.userId;
          sendToUser(otherId, { type: "call_ended", callId, reason: "user_disconnected" });
          activeCalls.delete(callId);
        }
      }
    });

    ws.on("error", (err) => {
      console.error(`WebSocket error for user ${userId}:`, err);
    });
  });

  console.log("✅ WebSocket server initialized on /ws/community");
}

// ==================== MESSAGE HANDLERS ====================

async function handleSendMessage(userId, userName, data) {
  const { message } = data;
  
  if (!message || !message.chatId || !message.content) {
    console.error("Invalid send_message data:", data);
    return;
  }
  
  try {
    const { readDb, writeDb } = require("./services/db");
    const db = await readDb();
    
    db.communityChats = db.communityChats || [];
    const chat = db.communityChats.find(c => c.chatId === message.chatId);
    
    if (!chat) {
      console.error("Chat not found:", message.chatId);
      return;
    }

    // Save message to database
    db.communityMessages = db.communityMessages || [];
    const messageId = require("uuid").v4();
    const newMessage = {
      messageId: messageId,
      chatId: message.chatId,
      senderId: userId,
      senderName: userName,
      content: message.content,
      type: message.type || "text",
      fileName: message.fileName,
      readBy: [userId],
      createdAt: new Date().toISOString()
    };
    db.communityMessages.push(newMessage);

    // Update chat's last message
    chat.lastMessage = message.type === "voice" ? "🎤 Voice message" : 
                       message.type === "image" ? "📷 Image" :
                       message.type === "file" ? "📎 File" :
                       (message.content.length > 50 ? message.content.substring(0, 50) + "..." : message.content);
    chat.lastMessageTime = newMessage.createdAt;
    
    await writeDb(db);

    // Get all members in the chat
    let recipients = [];
    if (chat.type === "group") {
      recipients = (chat.members || []).filter(m => m.userId !== userId).map(m => m.userId);
    } else {
      recipients = (chat.members || []).filter(m => m.userId !== userId).map(m => m.userId);
    }

    // Format message for sending
    const formattedMessage = {
      id: messageId,
      chatId: message.chatId,
      senderId: userId,
      senderName: userName,
      content: message.content,
      type: message.type || "text",
      fileName: message.fileName,
      timestamp: newMessage.createdAt,
      status: "sent"
    };

    // Send to all recipients
    recipients.forEach(recipientId => {
      sendToUser(recipientId, {
        type: "new_message",
        chatId: message.chatId,
        message: formattedMessage
      });
    });

    // Also send back to sender for confirmation
    sendToUser(userId, {
      type: "message_sent",
      messageId: messageId,
      chatId: message.chatId
    });

    console.log(`📤 Message sent from ${userName} to chat ${message.chatId}`);
    
  } catch (err) {
    console.error("handleSendMessage error:", err);
  }
}

async function handleTyping(userId, userName, data) {
  const { chatId, targetId } = data;
  
  if (targetId) {
    // Direct typing to specific user
    sendToUser(targetId, {
      type: "typing",
      chatId: chatId,
      userId: userId,
      userName: userName
    });
  } else if (chatId) {
    // Broadcast to all in chat
    await sendToChat(chatId, {
      type: "typing",
      chatId: chatId,
      userId: userId,
      userName: userName
    }, userId);
  }
}

async function handleMarkRead(userId, data) {
  const { chatId } = data;
  
  try {
    const { readDb, writeDb } = require("./services/db");
    const db = await readDb();
    db.communityMessages = db.communityMessages || [];
    
    let updated = false;
    db.communityMessages.forEach(m => {
      if (m.chatId === chatId && m.senderId !== userId) {
        m.readBy = m.readBy || [];
        if (!m.readBy.includes(userId)) {
          m.readBy.push(userId);
          updated = true;
        }
      }
    });
    
    if (updated) {
      await writeDb(db);
      
      // Notify senders that messages were read
      const uniqueSenders = [...new Set(db.communityMessages
        .filter(m => m.chatId === chatId && m.senderId !== userId)
        .map(m => m.senderId))];
      
      uniqueSenders.forEach(senderId => {
        sendToUser(senderId, {
          type: "messages_read",
          chatId: chatId,
          readBy: userId
        });
      });
    }
  } catch (err) {
    console.error("handleMarkRead error:", err);
  }
}

// ==================== CALL HANDLERS ====================

async function handleCallRequest(userId, userName, data) {
  const { targetId, callType } = data;
  
  // Check if target is online
  const targetClient = connectedClients.get(targetId);
  if (!targetClient || targetClient.ws.readyState !== WebSocket.OPEN) {
    sendToUser(userId, { type: "call_error", error: "User is offline" });
    return;
  }
  
  // Check if target is already in a call
  let isInCall = false;
  for (const [_, call] of activeCalls) {
    if (call.caller.userId === targetId || call.receiver.userId === targetId) {
      isInCall = true;
      break;
    }
  }
  
  if (isInCall) {
    sendToUser(userId, { type: "call_busy", targetId });
    sendToUser(targetId, { type: "call_request", callerId: userId, callerName: userName, callType, busy: true });
    return;
  }
  
  const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  activeCalls.set(callId, {
    caller: { userId, userName },
    receiver: { userId: targetId },
    type: callType,
    startTime: null
  });
  
  sendToUser(targetId, {
    type: "call_incoming",
    callId,
    callerId: userId,
    callerName: userName,
    callType: callType
  });
  
  sendToUser(userId, {
    type: "call_initiated",
    callId,
    targetId: targetId
  });
  
  console.log(`📞 Call request from ${userName} to ${targetId}, callId: ${callId}`);
}

async function handleCallAccepted(userId, data) {
  const { targetId, callId } = data;
  
  let call = activeCalls.get(callId);
  if (!call) {
    // Find call by participants
    for (const [cid, c] of activeCalls) {
      if ((c.caller.userId === userId && c.receiver.userId === targetId) ||
          (c.caller.userId === targetId && c.receiver.userId === userId)) {
        call = c;
        call.callId = cid;
        break;
      }
    }
  }
  
  if (call) {
    call.startTime = Date.now();
    sendToUser(targetId, {
      type: "call_accepted",
      callId: call.callId || callId,
      userId: userId
    });
    
    sendToUser(userId, {
      type: "call_connected",
      callId: call.callId || callId,
      targetId: targetId
    });
    
    console.log(`✅ Call accepted between ${userId} and ${targetId}`);
  } else {
    sendToUser(userId, { type: "call_error", error: "Call not found" });
  }
}

async function handleCallRejected(userId, data) {
  const { targetId, callId } = data;
  
  let call = activeCalls.get(callId);
  if (!call) {
    for (const [cid, c] of activeCalls) {
      if ((c.caller.userId === userId && c.receiver.userId === targetId) ||
          (c.caller.userId === targetId && c.receiver.userId === userId)) {
        call = c;
        call.callId = cid;
        break;
      }
    }
  }
  
  if (call) {
    sendToUser(targetId, {
      type: "call_rejected",
      callId: call.callId || callId,
      userId: userId
    });
    
    if (call.callId) activeCalls.delete(call.callId);
    console.log(`❌ Call rejected by ${userId}`);
  } else {
    sendToUser(targetId, { type: "call_rejected", userId: userId });
  }
}

async function handleCallEnded(userId, data) {
  const { targetId, callId, duration } = data;
  
  let call = null;
  if (callId) {
    call = activeCalls.get(callId);
  } else {
    for (const [cid, c] of activeCalls) {
      if ((c.caller.userId === userId && c.receiver.userId === targetId) ||
          (c.caller.userId === targetId && c.receiver.userId === userId)) {
        call = c;
        call.callId = cid;
        break;
      }
    }
  }
  
  if (call) {
    const otherId = call.caller.userId === userId ? call.receiver.userId : call.caller.userId;
    sendToUser(otherId, {
      type: "call_ended",
      callId: call.callId,
      duration: duration || (call.startTime ? Math.floor((Date.now() - call.startTime) / 1000) : 0)
    });
    
    if (call.callId) activeCalls.delete(call.callId);
    console.log(`📞 Call ended between ${userId} and ${otherId}`);
  } else if (targetId) {
    sendToUser(targetId, { type: "call_ended", userId: userId });
  }
}

async function handleCallBusy(userId, data) {
  const { targetId } = data;
  sendToUser(targetId, { type: "call_busy", userId: userId, reason: "busy" });
  console.log(`📞 Call busy: ${userId} is busy`);
}

async function handleWebRTCSignal(userId, data) {
  const { targetId, type, sdp, candidate } = data;
  
  sendToUser(targetId, {
    type: type,
    fromId: userId,
    sdp: sdp,
    candidate: candidate
  });
  
  console.log(`🔗 WebRTC signal: ${type} from ${userId} to ${targetId}`);
}

// ==================== UTILITY FUNCTIONS ====================

function sendToUser(userId, data) {
  const client = connectedClients.get(userId);
  if (client && client.ws && client.ws.readyState === WebSocket.OPEN) {
    try {
      client.ws.send(JSON.stringify(data));
      return true;
    } catch (err) {
      console.error(`Failed to send to user ${userId}:`, err);
      return false;
    }
  }
  return false;
}

function broadcastToAll(data, excludeUserId = null) {
  let sentCount = 0;
  connectedClients.forEach((client, uid) => {
    if (excludeUserId && uid === excludeUserId) return;
    if (client.ws && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(data));
        sentCount++;
      } catch (err) {
        console.error(`Failed to broadcast to ${uid}:`, err);
      }
    }
  });
  return sentCount;
}

async function sendToChat(chatId, data, excludeUserId = null) {
  try {
    const { readDb } = require("./services/db");
    const db = await readDb();
    db.communityChats = db.communityChats || [];
    const chat = db.communityChats.find(c => c.chatId === chatId);
    
    if (chat && chat.members) {
      let sentCount = 0;
      chat.members.forEach(m => {
        if (m.userId !== excludeUserId) {
          if (sendToUser(m.userId, data)) sentCount++;
        }
      });
      return sentCount;
    }
  } catch (err) {
    console.error("sendToChat error:", err);
  }
  return 0;
}

// ==================== HEALTH CHECK ====================
function getWebSocketStats() {
  return {
    connectedUsers: connectedClients.size,
    activeCalls: activeCalls.size,
    users: Array.from(connectedClients.keys())
  };
}

module.exports = { setupWebSocket, getWebSocketStats };