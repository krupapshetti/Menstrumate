// services/paymentService.js

function getQR() {
  return "/qr.jpeg"; // must match file in public
}

function confirmPayment() {
  return "Payment Successful 🎉";
}

module.exports = {
  getQR,
  confirmPayment
};