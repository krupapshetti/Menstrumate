const mongoose = require("mongoose");

const communityMessageSchema = new mongoose.Schema({
  messageId: { type: String, required: true, unique: true },
  chatId: { type: String, required: true },
  senderId: { type: String, required: true },
  senderName: String,
  content: String,
  type: { type: String, default: "text" },
  fileName: String,
  readBy: [String]
}, { timestamps: true });

communityMessageSchema.index({ chatId: 1, createdAt: -1 });

module.exports = mongoose.model("CommunityMessage", communityMessageSchema);