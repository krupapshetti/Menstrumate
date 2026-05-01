const mongoose = require("mongoose");

const patientMessageSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  patientId: { type: String, required: true, index: true },
  doctorId: { type: String, required: true, index: true },
  message: String,
  createdAt: String
}, { minimize: false });

module.exports = mongoose.model("PatientMessage", patientMessageSchema);
