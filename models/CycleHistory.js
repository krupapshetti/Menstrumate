const mongoose = require("mongoose");

const cycleHistorySchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  history: [mongoose.Schema.Types.Mixed]
}, { minimize: false });

module.exports = mongoose.model("CycleHistory", cycleHistorySchema);
