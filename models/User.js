const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  role: { type: String, enum: ["user", "doctor"], required: true, index: true },
  name: { type: String, required: true },
  email: { type: String, required: true, lowercase: true, index: true },
  passwordHash: { type: String, required: true },
  specialty: String,
  specialization: String,
  experience: String,
  clinic: String,
  cycleLength: Number,
  lastPeriod: String,
  isFirstLogin: { type: Boolean, default: false },
  isOnline: { type: Boolean, default: false },
  lastSeen: String,
  createdAt: String
}, { minimize: false });

userSchema.index({ email: 1, role: 1 }, { unique: true });

module.exports = mongoose.model("User", userSchema);
