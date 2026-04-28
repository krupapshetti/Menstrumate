// routes/payment.js

const express = require("express");
const router = express.Router();

const paymentService = require("../services/paymentService");

// ✅ GET QR CODE
router.get("/qr", (req, res) => {
  const qr = paymentService.getQR();
  res.json({ qrCode: qr });
});

// ✅ CONFIRM PAYMENT
router.post("/confirm", (req, res) => {
  const message = paymentService.confirmPayment();
  res.json({ message });
});

module.exports = router;