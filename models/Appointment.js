const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  patientId: { type: String, required: true, index: true },
  doctorId: { type: String, required: true, index: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  notes: { type: String, default: "" },
  status: { type: String, enum: ["scheduled", "cancelled", "completed", "no-show"], default: "scheduled" },
  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: { type: String, default: () => new Date().toISOString() }
}, { minimize: false });

// Remove the appointmentId requirement if not needed
module.exports = mongoose.model("Appointment", appointmentSchema);