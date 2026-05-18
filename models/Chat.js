const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  id: String,
  sender: String,
  text: String,
  senderId: String,
  receiverId: String,
  senderRole: String,
  message: String,
  timestamp: String,
  status: String,
  seenAt: String
}, { _id: false, minimize: false });

const chatSchema = new mongoose.Schema({
  chatId: { type: String, required: true, unique: true, index: true },
  doctorId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  messages: [messageSchema],
  typing: { type: Map, of: Boolean, default: {} },
  createdAt: String,
  updatedAt: String
}, { minimize: false });

chatSchema.index({ doctorId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("Chat", chatSchema);
