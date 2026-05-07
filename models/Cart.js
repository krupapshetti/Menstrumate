const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  items: [{
    productId: String,
    id: String,
    name: String,
    price: Number,
    image: String,
    category: String,
    quantity: Number
  }]
}, { minimize: false });

module.exports = mongoose.model("Cart", cartSchema);
