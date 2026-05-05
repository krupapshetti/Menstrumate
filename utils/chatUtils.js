const {
  publicAccount,
  publicDoctor
} = require("./auth");

function getAccountById(db, id) {
  const user = db.users.find(
    (account) => account.id === id
  );

  if (user) {
    return {
      ...user,
      role: "user"
    };
  }

  const doctor = db.doctors.find(
    (account) => account.id === id
  );

  if (doctor) {
    return {
      ...doctor,
      role: "doctor"
    };
  }

  return null;
}

function findChat(db, doctorId, userId) {
  return db.chats.find(
    (chat) =>
      chat.doctorId === doctorId &&
      chat.userId === userId
  );
}

function createChat(doctorId, userId) {
  return {
    chatId: `chat_${doctorId}_${userId}`,
    doctorId,
    userId,
    messages: [],
    typing: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function publicChat(db, chat) {
  const doctor = db.doctors.find(
    (account) => account.id === chat.doctorId
  );

  const user = db.users.find(
    (account) => account.id === chat.userId
  );

  const messages = Array.isArray(chat.messages)
    ? chat.messages.map((item) => ({
        ...item,
        sender: item.sender || item.senderId,
        text: item.text || item.message,
        senderId: item.senderId || item.sender,
        message: item.message || item.text,
        timestamp: item.timestamp || item.createdAt || new Date().toISOString(),
        status: item.status || "delivered",
        seenAt: item.seenAt || null,
        deleted: item.deleted || false
      }))
    : [];

  // Calculate unread count for the current user
  const unreadCount = messages.filter(
    m => !m.deleted && m.receiverId === (doctor?.id || user?.id) && m.status !== "seen"
  ).length;

  return {
    ...chat,
    messages,
    typing: chat.typing || {},
    unreadCount,
    doctor: doctor ? publicDoctor(doctor) : null,
    patient: user ? publicAccount(user) : null
  };
}

// ==================== ADD THESE MISSING FUNCTIONS ====================

function buildPatientSummary(db, user) {
  // Get last activity from various sources
  const lastActivity = user.lastSeen || user.updatedAt || user.createdAt;
  
  // Simple risk assessment based on data
  let riskLevel = "Low";
  const riskReasons = [];
  
  // Check if user has shared symptoms
  const hasSymptoms = db.symptoms.some(s => s.userId === user.id);
  if (!hasSymptoms) {
    riskReasons.push("No symptoms logged");
    riskLevel = "Medium";
  }
  
  // Check for high pain entries
  const hasHighPain = db.symptoms.some(s => s.userId === user.id && s.painLevel > 8);
  if (hasHighPain) {
    riskReasons.push("High pain levels reported");
    riskLevel = "High";
  }
  
  // Check if inactive
  const daysInactive = Math.floor((Date.now() - new Date(lastActivity).getTime()) / 86400000);
  if (daysInactive > 30) {
    riskReasons.push("Inactive for over 30 days");
    riskLevel = riskLevel === "High" ? "High" : "Medium";
  }
  
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    profileType: user.role,
    condition: hasSymptoms ? "Active tracking" : "New user",
    lastActivity: lastActivity,
    riskLevel: riskLevel,
    riskReasons: riskReasons.length ? riskReasons : ["Regular monitoring"],
    createdAt: user.createdAt
  };
}

function logActivity(db, userId, type, detail) {
  if (!db.activityLogs) {
    db.activityLogs = {};
  }
  
  if (!db.activityLogs[userId]) {
    db.activityLogs[userId] = [];
  }
  
  db.activityLogs[userId].push({
    id: `activity_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    type,
    detail,
    createdAt: new Date().toISOString()
  });
  
  // Keep only last 100 activities per user to prevent unbounded growth
  if (db.activityLogs[userId].length > 100) {
    db.activityLogs[userId] = db.activityLogs[userId].slice(-100);
  }
}

// Optional: Get chat preview for lists
function getChatPreview(chat, db, currentUserId) {
  const messages = chat.messages || [];
  const lastMessage = messages[messages.length - 1];
  
  const otherParticipantId = chat.doctorId === currentUserId ? chat.userId : chat.doctorId;
  const otherParticipant = db.users.find(u => u.id === otherParticipantId) || 
                          db.doctors.find(d => d.id === otherParticipantId);
  
  const unreadCount = messages.filter(
    m => m.receiverId === currentUserId && m.status !== "seen" && !m.deleted
  ).length;
  
  return {
    chatId: chat.chatId,
    with: otherParticipant ? {
      id: otherParticipant.id,
      name: otherParticipant.name,
      role: otherParticipant.role || (otherParticipant.specialization ? "doctor" : "user"),
      isOnline: otherParticipant.isOnline || false
    } : null,
    lastMessage: lastMessage ? {
      text: lastMessage.deleted ? "[Message deleted]" : (lastMessage.text || lastMessage.message),
      timestamp: lastMessage.timestamp,
      sender: lastMessage.senderId === currentUserId ? "You" : otherParticipant?.name || "Unknown",
      isRead: lastMessage.status === "seen"
    } : null,
    unreadCount,
    updatedAt: chat.updatedAt
  };
}

module.exports = {
  getAccountById,
  findChat,
  createChat,
  publicChat,
  buildPatientSummary,  // ADDED
  logActivity,          // ADDED
  getChatPreview        // ADDED (optional)
};