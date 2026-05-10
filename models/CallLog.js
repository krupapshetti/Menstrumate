const mongoose = require("mongoose");

const callLogSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  targetId: { type: String, required: true },
  direction: { type: String, enum: ["incoming", "outgoing"] },
  status: { type: String, enum: ["missed", "answered", "rejected"] },
  callType: { type: String, enum: ["audio", "video"] },
  duration: { type: Number, default: 0 },
  createdAt: { type: String, default: () => new Date().toISOString() }
});

module.exports = mongoose.model("CallLog", callLogSchema);