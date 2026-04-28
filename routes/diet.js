const express = require("express");
const router = express.Router();
const { getDiet } = require("../services/dietService");

router.get("/:phase", async (req, res) => {
  const diet = await getDiet(req.params.phase);
  res.json({ diet });
});

module.exports = router;