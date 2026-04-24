const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,
  username: { type: String, unique: true },
  password: String,
  age: Number,
  weight: Number,
  height: Number,

  cycleLength: Number,
  lastPeriod: Date,

  // 🔥 NEW: cycle history
  cycleHistory: [
    {
      cycleLength: Number,
      startDate: Date
    }
  ],

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", userSchema);