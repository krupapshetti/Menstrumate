const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const SECRET = process.env.JWT_SECRET || "menstrumate-dev-secret";

// Import Models
const CommunityChat = require("../models/CommunityChat");
const CommunityMessage = require("../models/CommunityMessage");
const OnlineStatus = require("../models/OnlineStatus");
const User = require("../models/User");

// Ensure upload directory exists
const uploadDir = "uploads/community/";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage, 
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Auth middleware
function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Login required" });
  }
  try {
    req.user = jwt.verify(authHeader.slice(7), SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
}

// ==================== MESSAGES (FIXED) ====================

router.post("/messages", auth, async (req, res) => {
  try {
    const { chatId, content, type = "text", fileName } = req.body;
    
    console.log("📝 POST /messages received:", { chatId, content: content?.substring(0, 50), type, userId: req.user.id });
    
    // Validation
    if (!chatId) {
      return res.status(400).json({ error: "chatId is required" });
    }
    
    if (!content && type !== 'voice') {
      return res.status(400).json({ error: "Message content required" });
    }
    
    // Verify user is in the chat
    const chat = await CommunityChat.findOne({ chatId: chatId });
    if (!chat) {
      console.log("❌ Chat not found:", chatId);
      return res.status(404).json({ error: "Chat not found" });
    }
    
    const isMember = chat.members?.some(m => m.userId === req.user.id);
    if (!isMember) {
      console.log("❌ User not a member:", req.user.id);
      return res.status(403).json({ error: "Not a member of this chat" });
    }
    
    // Create message
    const messageId = uuidv4();
    const message = new CommunityMessage({
      messageId: messageId,
      chatId: chatId,
      senderId: req.user.id,
      senderName: req.user.name || "User",
      content: content,
      type: type,
      fileName: fileName,
      readBy: [req.user.id]
    });
    
    await message.save();
    console.log("✅ Message saved:", messageId);
    
    // Update chat's last message
    let lastMessageText = content;
    if (type === 'voice') lastMessageText = '🎤 Voice message';
    else if (type === 'image') lastMessageText = '📷 Image';
    else if (type === 'file') lastMessageText = '📎 File';
    else if (content && content.length > 50) lastMessageText = content.substring(0, 50) + '...';
    
    await CommunityChat.updateOne(
      { chatId: chatId },
      { 
        $set: { 
          lastMessage: lastMessageText,
          lastMessageTime: new Date().toISOString()
        }
      }
    );
    
    res.json({ 
      messageId: messageId,
      message: {
        id: messageId,
        chatId: chatId,
        senderId: req.user.id,
        senderName: req.user.name,
        content: content,
        type: type,
        timestamp: message.createdAt
      }
    });
    
  } catch (err) {
    console.error("❌ POST /messages error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==================== GET CHATS ====================

router.get("/chats", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const chats = await CommunityChat.find({
      "members.userId": userId
    });
    
    const onlineStatuses = await OnlineStatus.find({ isOnline: true });
    const onlineUserIds = onlineStatuses.map(s => s.userId);
    
    const formattedChats = await Promise.all(chats.map(async (chat) => {
      const lastMsg = await CommunityMessage.findOne({ chatId: chat.chatId })
        .sort({ createdAt: -1 });
      
      const unreadCount = await CommunityMessage.countDocuments({
        chatId: chat.chatId,
        readBy: { $ne: userId }
      });
      
      let chatName = chat.name;
      let isOnline = false;
      
      if (chat.type === 'direct') {
        const otherMember = chat.members.find(m => m.userId !== userId);
        if (otherMember) {
          const otherUser = await User.findOne({ id: otherMember.userId });
          chatName = otherUser?.name || 'User';
          isOnline = onlineUserIds.includes(otherMember.userId);
        }
      }
      
      return {
        id: chat.chatId,
        type: chat.type,
        name: chatName || 'Chat',
        icon: chat.icon || (chat.type === "group" ? "👥" : "👤"),
        color: chat.color,
        memberCount: chat.members?.length || 0,
        lastMessage: lastMsg?.content || 'No messages yet',
        lastMessageTime: lastMsg?.createdAt || chat.createdAt,
        unreadCount: unreadCount,
        online: isOnline
      };
    }));
    
    res.json({ chats: formattedChats });
  } catch (err) {
    console.error("GET /chats error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==================== GET MESSAGES FOR A CHAT ====================

router.get("/chats/:chatId/messages", auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;
    
    // Verify access
    const chat = await CommunityChat.findOne({ chatId: chatId });
    if (!chat || !chat.members?.some(m => m.userId === userId)) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    // Get messages
    const messages = await CommunityMessage.find({ chatId: chatId })
      .sort({ createdAt: 1 })
      .limit(100);
    
    // Mark as read (update all messages where user hasn't read)
    await CommunityMessage.updateMany(
      { chatId: chatId, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    );
    
    const formattedMessages = messages.map(m => ({
      id: m.messageId,
      chatId: m.chatId,
      senderId: m.senderId,
      senderName: m.senderName,
      content: m.content,
      type: m.type,
      timestamp: m.createdAt,
      status: 'sent',
      fileName: m.fileName
    }));
    
    res.json({ messages: formattedMessages });
  } catch (err) {
    console.error("GET /chats/:chatId/messages error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==================== CREATE DIRECT CHAT ====================

router.post("/chats/direct", auth, async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const userId = req.user.id;
    
    if (userId === targetUserId) {
      return res.status(400).json({ error: "Cannot chat with yourself" });
    }
    
    // Check if chat exists
    let existingChat = await CommunityChat.findOne({
      type: "direct",
      "members.userId": { $all: [userId, targetUserId] }
    });
    
    if (existingChat) {
      return res.json({ chatId: existingChat.chatId });
    }
    
    // Get target user
    const targetUser = await User.findOne({ id: targetUserId });
    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Create new chat
    const chatId = uuidv4();
    const newChat = new CommunityChat({
      chatId: chatId,
      type: "direct",
      name: targetUser.name,
      members: [
        { userId: userId, role: "member", joinedAt: new Date().toISOString() },
        { userId: targetUserId, role: "member", joinedAt: new Date().toISOString() }
      ],
      created_by: userId,
      createdAt: new Date().toISOString()
    });
    
    await newChat.save();
    res.json({ chatId: chatId });
    
  } catch (err) {
    console.error("POST /chats/direct error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==================== GROUPS ====================

router.get("/groups", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const groups = await CommunityChat.find({ type: "group" });
    
    const formattedGroups = groups.map(g => ({
      id: g.chatId,
      name: g.name,
      icon: g.icon || "👥",
      color: g.color,
      color2: g.color2,
      description: g.description || "",
      category: g.category || "general",
      privacy: g.privacy || "public",
      memberCount: g.members?.length || 0,
      isMember: g.members?.some(m => m.userId === userId),
      isAdmin: g.members?.some(m => m.userId === userId && m.role === "admin")
    }));
    
    res.json({ groups: formattedGroups });
  } catch (err) {
    console.error("GET /groups error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/groups", auth, async (req, res) => {
  try {
    const { name, description, category, privacy, icon } = req.body;
    
    if (!name?.trim()) {
      return res.status(400).json({ error: "Group name required" });
    }
    
    const colorOptions = [
      ["#667eea", "#764ba2"],
      ["#f093fb", "#f5576c"],
      ["#4facfe", "#00f2fe"],
      ["#43e97b", "#38f9d7"],
      ["#fa709a", "#fee140"],
      ["#30cfd0", "#330867"]
    ];
    const [color, color2] = colorOptions[Math.floor(Math.random() * colorOptions.length)];
    
    const chatId = uuidv4();
    const newGroup = new CommunityChat({
      chatId: chatId,
      type: "group",
      name: name.trim(),
      icon: icon || "👥",
      color: color,
      color2: color2,
      description: description || "",
      category: category || "general",
      privacy: privacy || "public",
      created_by: req.user.id,
      members: [{ userId: req.user.id, role: "admin", joinedAt: new Date().toISOString() }],
      createdAt: new Date().toISOString()
    });
    
    await newGroup.save();
    res.json({ 
      group: {
        id: newGroup.chatId,
        name: newGroup.name,
        icon: newGroup.icon,
        color: newGroup.color,
        color2: newGroup.color2,
        description: newGroup.description,
        category: newGroup.category,
        privacy: newGroup.privacy,
        memberCount: 1,
        isMember: true,
        isAdmin: true
      }
    });
  } catch (err) {
    console.error("POST /groups error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/groups/:groupId/join", auth, async (req, res) => {
  try {
    const group = await CommunityChat.findOne({ chatId: req.params.groupId });
    
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }
    
    if (group.members?.some(m => m.userId === req.user.id)) {
      return res.status(400).json({ error: "Already a member" });
    }
    
    group.members.push({ 
      userId: req.user.id, 
      role: "member", 
      joinedAt: new Date().toISOString() 
    });
    await group.save();
    
    res.json({ message: "Joined group successfully" });
  } catch (err) {
    console.error("POST /groups/:groupId/join error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/groups/:groupId/leave", auth, async (req, res) => {
  try {
    const group = await CommunityChat.findOne({ chatId: req.params.groupId });
    
    if (group) {
      group.members = (group.members || []).filter(m => m.userId !== req.user.id);
      await group.save();
    }
    
    res.json({ message: "Left group" });
  } catch (err) {
    console.error("POST /groups/:groupId/leave error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/groups/:groupId/members", auth, async (req, res) => {
  try {
    const group = await CommunityChat.findOne({ chatId: req.params.groupId });
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }
    
    const onlineStatuses = await OnlineStatus.find({ isOnline: true });
    const onlineUserIds = onlineStatuses.map(s => s.userId);
    
    const members = await Promise.all((group.members || []).map(async (m) => {
      const user = await User.findOne({ id: m.userId });
      return {
        id: m.userId,
        name: user?.name || "Unknown",
        avatar: user?.avatar || "👤",
        role: m.role,
        online: onlineUserIds.includes(m.userId),
        joinedAt: m.joinedAt
      };
    }));
    
    res.json({ members });
  } catch (err) {
    console.error("GET /groups/:groupId/members error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==================== USERS ====================

router.get("/online-users", auth, async (req, res) => {
  try {
    const onlineStatuses = await OnlineStatus.find({ isOnline: true });
    const onlineIds = onlineStatuses.map(s => s.userId);
    const users = await User.find({ id: { $in: onlineIds }, role: "user" });
    
    res.json({
      users: users.map(u => ({
        id: u.id,
        name: u.name,
        avatar: u.avatar || "👤",
        online: true
      }))
    });
  } catch (err) {
    console.error("GET /online-users error:", err);
    res.json({ users: [] });
  }
});

router.get("/users/search", auth, async (req, res) => {
  try {
    const q = (req.query.q || "").toLowerCase().trim();
    
    if (q.length < 2) {
      return res.json({ users: [] });
    }
    
    const users = await User.find({
      id: { $ne: req.user.id },
      name: { $regex: q, $options: "i" },
      role: "user"
    }).limit(20);
    
    res.json({
      users: users.map(u => ({ id: u.id, name: u.name, avatar: u.avatar || "👤" }))
    });
  } catch (err) {
    console.error("GET /users/search error:", err);
    res.json({ users: [] });
  }
});

router.get("/users/suggested", auth, async (req, res) => {
  try {
    const users = await User.find({
      id: { $ne: req.user.id },
      role: "user"
    }).limit(10);
    
    res.json({
      users: users.map(u => ({ id: u.id, name: u.name, avatar: u.avatar || "👤" }))
    });
  } catch (err) {
    console.error("GET /users/suggested error:", err);
    res.json({ users: [] });
  }
});

// ==================== UPLOADS ====================

router.post("/upload/voice", auth, upload.single("audio"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided" });
    }
    const fileUrl = `/uploads/community/${req.file.filename}`;
    res.json({ url: fileUrl });
  } catch (err) {
    console.error("POST /upload/voice error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/upload/file", auth, upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }
    const fileUrl = `/uploads/community/${req.file.filename}`;
    res.json({
      url: fileUrl,
      fileName: req.file.originalname,
      type: req.file.mimetype
    });
  } catch (err) {
    console.error("POST /upload/file error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==================== CALL LOGS ====================

router.post("/call-logs", auth, async (req, res) => {
  try {
    const CallLog = require("../models/CallLog");
    const { targetId, direction, status, callType } = req.body;
    
    const callLog = new CallLog({
      id: uuidv4(),
      userId: req.user.id,
      targetId: targetId,
      direction: direction,
      status: status,
      callType: callType,
      duration: 0,
      createdAt: new Date().toISOString()
    });
    
    await callLog.save();
    res.json({ success: true });
  } catch (err) {
    console.error("POST /call-logs error:", err);
    res.json({ success: false });
  }
});

router.put("/call-logs/update", auth, async (req, res) => {
  try {
    const CallLog = require("../models/CallLog");
    const { targetId, status, duration } = req.body;
    
    await CallLog.updateOne(
      { userId: req.user.id, targetId: targetId, status: "missed" },
      { $set: { status: status, duration: duration || 0 } }
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error("PUT /call-logs/update error:", err);
    res.json({ success: false });
  }
});

module.exports = router;