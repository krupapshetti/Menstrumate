const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  amount: Number,
  status: String,
  items: [mongoose.Schema.Types.Mixed],
  qrCode: String,
  createdAt: String,
  paidAt: String
}, { minimize: false });

module.exports = mongoose.model("Payment", paymentSchema);
