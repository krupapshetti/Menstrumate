const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  logs: [mongoose.Schema.Types.Mixed]
}, { minimize: false });

module.exports = mongoose.model("ActivityLog", activityLogSchema);
