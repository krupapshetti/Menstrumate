const express = require("express");
const router = express.Router();

let cart = [];

// add item
router.post("/add", (req, res) => {
  const item = req.body;
  cart.push(item);
  res.json({ message: "Item added", cart });
});

// get cart
router.get("/", (req, res) => {
  res.json(cart);
});

module.exports = router;