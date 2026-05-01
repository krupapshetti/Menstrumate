const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, index: true },
  role: { type: String, enum: ["user", "doctor"], required: true },
  otp: { type: String, required: true },
  expiresAt: Number
}, { minimize: false });

otpSchema.index({ email: 1, role: 1 });

module.exports = mongoose.model("Otp", otpSchema);
