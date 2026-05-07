const mongoose = require("mongoose");

const appStateSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  products: [mongoose.Schema.Types.Mixed],
  yoga: [mongoose.Schema.Types.Mixed],
  education: [mongoose.Schema.Types.Mixed],
  notifications: [String],
  symptomOptions: [String],
  insightRules: [mongoose.Schema.Types.Mixed],
  appointmentSlots: [String],
  shopRules: [mongoose.Schema.Types.Mixed],
  entertainment: [mongoose.Schema.Types.Mixed]
}, { minimize: false });

module.exports = mongoose.model("AppState", appStateSchema);
