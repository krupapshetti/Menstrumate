const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  items: [{
    productId: String,
    quantity: Number
  }]
}, { minimize: false });

module.exports = mongoose.model("Cart", cartSchema);
