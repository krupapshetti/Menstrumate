const express = require("express");
const router = express.Router();

const { requireAuth, requireDoctor } = require("../middleware/authMiddleware");
const asyncRoute = require("../middleware/asyncMiddleware"); // Fixed path

const { readDb, writeDb } = require("../services/db");

const {
  findChat,
  createChat,
  publicChat,
  getAccountById,
  buildPatientSummary,
  logActivity
} = require("../utils/chatUtils");

// ==================== GET OR CREATE CHAT ====================
router.get(
  "/:doctorId",
  requireAuth,
  asyncRoute(async (req, res) => {
    const db = await readDb();

    const doctor = db.doctors.find(
      (account) => account.id === req.params.doctorId
    );

    if (!doctor) {
      return res.status(404).json({
        error: "Doctor not found"
      });
    }

    const userId =
      req.auth.role === "doctor"
        ? req.query.userId
        : req.auth.id;

    if (!userId) {
      return res.status(400).json({
        error: "Patient ID is required"
      });
    }

    if (
      req.auth.role === "doctor" &&
      req.auth.id !== req.params.doctorId
    ) {
      return res.status(403).json({
        error: "Cannot access another doctor's chat"
      });
    }

    const user = db.users.find(
      (account) => account.id === userId
    );

    if (!user) {
      return res.status(404).json({
        error: "Patient not found"
      });
    }

    let chat = findChat(db, doctor.id, user.id);

    if (!chat) {
      chat = createChat(doctor.id, user.id);
      db.chats.push(chat);
      await writeDb(db);
    }

    // Mark messages as seen when opening chat
    const now = new Date().toISOString();
    let hasNewMessages = false;
    
    chat.messages = (chat.messages || []).map((msg) => {
      if (msg.receiverId === req.auth.id && msg.status !== "seen") {
        hasNewMessages = true;
        return { ...msg, status: "seen", seenAt: now };
      }
      return msg;
    });
    
    if (hasNewMessages) {
      chat.updatedAt = now;
      await writeDb(db);
    }

    res.json({
      success: true,
      chat: publicChat(db, chat)
    });
  })
);

// ==================== SEND MESSAGE ====================
router.post(
  "/send",
  requireAuth,
  asyncRoute(async (req, res) => {
    const {
      senderId,
      receiverId,
      message,
      timestamp
    } = req.body;

    if (
      !senderId ||
      !receiverId ||
      !String(message || "").trim()
    ) {
      return res.status(400).json({
        error: "Sender, receiver, and message are required"
      });
    }

    if (senderId !== req.auth.id) {
      return res.status(403).json({
        error: "Cannot send as another account"
      });
    }

    const trimmedMessage = String(message).trim();
    if (trimmedMessage.length > 5000) {
      return res.status(400).json({
        error: "Message cannot exceed 5000 characters"
      });
    }

    const db = await readDb();

    const sender = getAccountById(db, senderId);
    const receiver = getAccountById(db, receiverId);

    if (!sender || !receiver) {
      return res.status(404).json({
        error: "Sender or receiver not found"
      });
    }

    if (sender.role === receiver.role) {
      return res.status(400).json({
        error: "Chats must be between a patient and a doctor"
      });
    }

    const doctorId =
      sender.role === "doctor"
        ? senderId
        : receiverId;

    const userId =
      sender.role === "user"
        ? senderId
        : receiverId;

    let chat = findChat(db, doctorId, userId);

    if (!chat) {
      chat = createChat(doctorId, userId);
      db.chats.push(chat);
    }

    const chatMessage = {
      id: `chatmsg_${Date.now()}_${Math.random()
        .toString(16)
        .slice(2)}`,
      sender: senderId,
      text: trimmedMessage,
      senderId,
      receiverId,
      senderRole: sender.role,
      message: trimmedMessage,
      timestamp: timestamp || new Date().toISOString(),
      status: "delivered",
      seenAt: null,
      readAt: null
    };

    chat.messages.push(chatMessage);
    chat.typing = {
      ...(chat.typing || {}),
      [senderId]: false
    };
    chat.updatedAt = chatMessage.timestamp;

    logActivity(
      db,
      userId,
      "chat-message",
      sender.role === "doctor"
        ? "Doctor replied in chat"
        : "Patient messaged a doctor"
    );

    await writeDb(db);

    res.status(201).json({
      success: true,
      message: "Message sent",
      chat: publicChat(db, chat),
      sentMessage: chatMessage
    });
  })
);

// ==================== TYPING INDICATOR ====================
router.post(
  "/typing",
  requireAuth,
  asyncRoute(async (req, res) => {
    const {
      doctorId,
      userId,
      isTyping = false
    } = req.body;

    const db = await readDb();

    const resolvedDoctorId =
      req.auth.role === "doctor"
        ? req.auth.id
        : doctorId;

    const resolvedUserId =
      req.auth.role === "user"
        ? req.auth.id
        : userId;

    if (!resolvedDoctorId || !resolvedUserId) {
      return res.status(400).json({
        error: "Doctor and user are required"
      });
    }

    let chat = findChat(
      db,
      resolvedDoctorId,
      resolvedUserId
    );

    if (!chat) {
      chat = createChat(
        resolvedDoctorId,
        resolvedUserId
      );
      db.chats.push(chat);
    }

    chat.typing = {
      ...(chat.typing || {}),
      [req.auth.id]: Boolean(isTyping)
    };
    chat.updatedAt = new Date().toISOString();

    await writeDb(db);

    res.json({
      success: true,
      typing: chat.typing
    });
  })
);

// ==================== MARK MESSAGES AS SEEN ====================
router.post(
  "/seen",
  requireAuth,
  asyncRoute(async (req, res) => {
    const { doctorId, userId } = req.body;

    const db = await readDb();

    const resolvedDoctorId =
      req.auth.role === "doctor"
        ? req.auth.id
        : doctorId;

    const resolvedUserId =
      req.auth.role === "user"
        ? req.auth.id
        : userId;

    const chat = findChat(
      db,
      resolvedDoctorId,
      resolvedUserId
    );

    if (!chat) {
      return res.json({
        success: true,
        message: "No chat yet",
        unreadCount: 0
      });
    }

    const now = new Date().toISOString();
    let unreadCount = 0;

    chat.messages = (chat.messages || []).map((item) => {
      if (item.receiverId === req.auth.id && item.status !== "seen") {
        unreadCount++;
        return {
          ...item,
          status: "seen",
          seenAt: now
        };
      }
      return item;
    });

    if (unreadCount > 0) {
      chat.updatedAt = now;
      await writeDb(db);
    }

    res.json({
      success: true,
      message: `${unreadCount} messages marked as seen`,
      unreadCount: 0
    });
  })
);

// ==================== GET UNREAD COUNT ====================
router.get(
  "/unread",
  requireAuth,
  asyncRoute(async (req, res) => {
    const db = await readDb();
    
    let unreadCount = 0;
    
    if (req.auth.role === "user") {
      // Patient: count unread messages from all doctors
      const userChats = db.chats.filter(chat => chat.userId === req.auth.id);
      userChats.forEach(chat => {
        unreadCount += (chat.messages || []).filter(
          msg => msg.receiverId === req.auth.id && msg.status !== "seen"
        ).length;
      });
    } else if (req.auth.role === "doctor") {
      // Doctor: count unread messages from all patients
      const doctorChats = db.chats.filter(chat => chat.doctorId === req.auth.id);
      doctorChats.forEach(chat => {
        unreadCount += (chat.messages || []).filter(
          msg => msg.receiverId === req.auth.id && msg.status !== "seen"
        ).length;
      });
    }
    
    res.json({
      success: true,
      unreadCount
    });
  })
);

// ==================== GET DOCTOR'S CHAT LIST ====================
router.get(
  "/doctor/chats",
  requireAuth,
  requireDoctor,
  asyncRoute(async (req, res) => {
    const db = await readDb();

    const chats = db.chats
      .filter((chat) => chat.doctorId === req.auth.id)
      .map((chat) => {
        const patient = db.users.find((user) => user.id === chat.userId);
        const messages = Array.isArray(chat.messages) ? chat.messages : [];
        const lastMessage = messages[messages.length - 1] || null;
        
        // Count unread messages for this doctor
        const unreadCount = messages.filter(
          msg => msg.receiverId === req.auth.id && msg.status !== "seen"
        ).length;

        return {
          chatId: chat.chatId,
          doctorId: chat.doctorId,
          userId: chat.userId,
          patient: patient ? buildPatientSummary(db, patient) : null,
          lastMessage: lastMessage ? {
            text: lastMessage.text || lastMessage.message,
            timestamp: lastMessage.timestamp,
            sender: lastMessage.sender,
            status: lastMessage.status
          } : null,
          unreadCount,
          updatedAt: chat.updatedAt
        };
      })
      .filter((chat) => chat.patient)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    res.json({
      success: true,
      chats,
      totalUnread: chats.reduce((sum, chat) => sum + chat.unreadCount, 0)
    });
  })
);

// ==================== GET PATIENT'S CHAT LIST ====================
router.get(
  "/patient/chats",
  requireAuth,
  asyncRoute(async (req, res) => {
    if (req.auth.role !== "user") {
      return res.status(403).json({
        error: "Only patients can access this endpoint"
      });
    }

    const db = await readDb();

    const chats = db.chats
      .filter((chat) => chat.userId === req.auth.id)
      .map((chat) => {
        const doctor = db.doctors.find((doc) => doc.id === chat.doctorId);
        const messages = Array.isArray(chat.messages) ? chat.messages : [];
        const lastMessage = messages[messages.length - 1] || null;
        
        // Count unread messages for this patient
        const unreadCount = messages.filter(
          msg => msg.receiverId === req.auth.id && msg.status !== "seen"
        ).length;

        return {
          chatId: chat.chatId,
          doctorId: chat.doctorId,
          userId: chat.userId,
          doctor: doctor ? {
            id: doctor.id,
            name: doctor.name,
            specialization: doctor.specialization,
            isOnline: doctor.isOnline
          } : null,
          lastMessage: lastMessage ? {
            text: lastMessage.text || lastMessage.message,
            timestamp: lastMessage.timestamp,
            sender: lastMessage.sender,
            status: lastMessage.status
          } : null,
          unreadCount,
          updatedAt: chat.updatedAt
        };
      })
      .filter((chat) => chat.doctor)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    res.json({
      success: true,
      chats,
      totalUnread: chats.reduce((sum, chat) => sum + chat.unreadCount, 0)
    });
  })
);

// ==================== DELETE MESSAGE (Doctor/Admin only) ====================
router.delete(
  "/messages/:messageId",
  requireAuth,
  requireDoctor,
  asyncRoute(async (req, res) => {
    const { messageId } = req.params;
    const { chatId } = req.body;

    if (!chatId) {
      return res.status(400).json({
        error: "Chat ID is required"
      });
    }

    const db = await readDb();
    
    const chat = db.chats.find((c) => c.chatId === chatId);
    
    if (!chat) {
      return res.status(404).json({
        error: "Chat not found"
      });
    }

    if (chat.doctorId !== req.auth.id) {
      return res.status(403).json({
        error: "Can only delete messages from your own chats"
      });
    }

    const messageIndex = chat.messages.findIndex((m) => m.id === messageId);
    
    if (messageIndex === -1) {
      return res.status(404).json({
        error: "Message not found"
      });
    }

    // Soft delete - mark as deleted instead of removing
    chat.messages[messageIndex] = {
      ...chat.messages[messageIndex],
      deleted: true,
      deletedAt: new Date().toISOString(),
      text: "[Message deleted]",
      message: "[Message deleted]"
    };

    await writeDb(db);

    res.json({
      success: true,
      message: "Message deleted successfully"
    });
  })
);

module.exports = router;