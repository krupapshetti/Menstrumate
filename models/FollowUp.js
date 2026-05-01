const mongoose = require("mongoose");

const followUpSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  patientId: { type: String, required: true, index: true },
  doctorId: { type: String, required: true, index: true },
  date: String,
  status: String,
  createdAt: String
}, { minimize: false });

module.exports = mongoose.model("FollowUp", followUpSchema);
