const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema({
  appointmentId: { type: String, required: true, unique: true, index: true },
  patientId: { type: String, required: true, index: true },
  doctorId: { type: String, required: true, index: true },
  date: { type: String, required: true, index: true },
  time: { type: String, required: true },
  status: { type: String, enum: ["scheduled", "cancelled", "completed"], default: "scheduled" },
  createdAt: String,
  updatedAt: String
}, { minimize: false });

module.exports = mongoose.model("Appointment", appointmentSchema);
