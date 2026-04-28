const users = require("../models/User");

exports.addToCart = (userId, productId, quantity) => {
  const user = users.find(u => u.id === userId);

  if (!user) throw new Error("User not found");

  const existing = user.cart.find(i => i.productId === productId);

  if (existing) {
    existing.quantity += quantity;
  } else {
    user.cart.push({ productId, quantity });
  }

  return user.cart;
};