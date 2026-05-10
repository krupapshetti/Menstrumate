const mongoose = require("mongoose");

const symptomSchema = new mongoose.Schema({
  symptomId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  date: { type: String, required: true, index: true },
  symptoms: [{ type: String }],
  painLevel: Number,
  notes: String,
  sharedWithDoctor: { type: Boolean, default: false, index: true },
  createdAt: String,
  updatedAt: String
}, { minimize: false });

symptomSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Symptom", symptomSchema);
