const mongoose = require("mongoose");

const onlineStatusSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  isOnline: { type: Boolean, default: false },
  socketId: String,
  lastSeen: { type: Date, default: Date.now }
});

module.exports = mongoose.model("OnlineStatus", onlineStatusSchema);