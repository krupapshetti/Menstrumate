const mongoose = require("mongoose");

const communityMessageSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ["user", "doctor"], required: true },
  room: { type: String, default: "General Chat" },
  message: { type: String, required: true },
  createdAt: { type: String, required: true }
});

module.exports = mongoose.model("CommunityMessage", communityMessageSchema);
