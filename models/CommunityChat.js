const mongoose = require("mongoose");

const communityChatSchema = new mongoose.Schema({
  chatId: { type: String, required: true, unique: true },
  type: { type: String, enum: ["direct", "group"], required: true },
  name: String,
  icon: { type: String, default: "👤" },
  color: String,
  color2: String,
  description: String,
  category: { type: String, default: "general" },
  privacy: { type: String, default: "public" },
  members: [{
    userId: String,
    role: { type: String, default: "member" },
    joinedAt: { type: Date, default: Date.now }
  }],
  created_by: String,
  lastMessage: String,
  lastMessageTime: Date
}, { timestamps: true });

module.exports = mongoose.model("CommunityChat", communityChatSchema);