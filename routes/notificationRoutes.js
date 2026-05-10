const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/authMiddleware");
const asyncRoute = require("../middleware/asyncMiddleware");
const { readDb } = require("../services/db");

// GET notifications
router.get(
  "/",
  requireAuth,
  asyncRoute(async (req, res) => {
    const db = await readDb();

    const messages = (db.notifications || []).slice(0, 5).map((msg) => ({
      message: msg,
      timestamp: new Date().toISOString(),
      read: false
    }));

    res.json({
      success: true,
      data: {
        messages,
        count: messages.length
      }
    });
  })
);

module.exports = router;