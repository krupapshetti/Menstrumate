const mongoose = require("mongoose");

const patientRecommendationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  patientId: { type: String, required: true, index: true },
  doctorId: { type: String, required: true, index: true },
  recommendation: String,
  followUpDate: String,
  createdAt: String
}, { minimize: false });

module.exports = mongoose.model("PatientRecommendation", patientRecommendationSchema);
