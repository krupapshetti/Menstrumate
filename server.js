const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");

const User = require("./models/User");

// ROUTES (kept from second file because they don't exist in first)
const cartRoutes = require("./routes/cart");
const paymentRoutes = require("./routes/payment");
const dietRoutes = require("./routes/diet");

const app = express();

// 🔐 Secret key (kept from FIRST file)
const SECRET = "mysecretkey";

// ======================
// ✅ MIDDLEWARE
// ======================
app.use(cors());
app.use(express.json());

// kept FIRST version
app.use(express.static("public"));

// ======================
// ✅ API ROUTES
// ======================
app.use("/api/cart", cartRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/diet", dietRoutes);

// ======================
// 🔐 AUTH MIDDLEWARE
// ======================
function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];

  if (!authHeader) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// ======================
// 📄 PAGE ROUTES
// ======================

// added from second file
app.get("/shop", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "shop.html"));
});

// kept from FIRST file
app.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "signup.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/dashboard-page", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// kept from FIRST file
app.get("/guidance", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "guidance.html"));
});

// added from second file
app.get("/cart-page", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "cart.html"));
});

// ======================
// 🗄️ DATABASE
// ======================
mongoose.connect("mongodb://127.0.0.1:27017/menstrualApp")
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

// ======================
// 🧠 CYCLE LOGIC
// ======================

// kept FIRST version
function calculateCyclePhases(lastPeriod, cycleLength) {
  const startDate = new Date(lastPeriod);
  const days = [];

  for (let i = 1; i <= cycleLength; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + (i - 1));

    let phase = "";

    if (i >= 1 && i <= 6) phase = "Menstruation";
    else if (i >= 7 && i <= (cycleLength - 17)) phase = "Follicular";
    else if (i >= (cycleLength - 16) && i <= (cycleLength - 14)) phase = "Ovulation";
    else phase = "Luteal";

    days.push({
      day: i,
      date: date.toISOString().split("T")[0],
      phase
    });
  }

  return days;
}

// kept from FIRST file
function calculateInsights(lastPeriod, cycleLength) {
  const start = new Date(lastPeriod);

  const ovulationDay = cycleLength - 14;

  const ovulationDate = new Date(start);
  ovulationDate.setDate(start.getDate() + ovulationDay - 1);

  const fertileStart = new Date(ovulationDate);
  fertileStart.setDate(ovulationDate.getDate() - 5);

  const fertileEnd = new Date(ovulationDate);

  const nextPeriod = new Date(start);
  nextPeriod.setDate(start.getDate() + cycleLength);

  return {
    nextPeriod: nextPeriod.toISOString().split("T")[0],
    ovulation: ovulationDate.toISOString().split("T")[0],
    fertileStart: fertileStart.toISOString().split("T")[0],
    fertileEnd: fertileEnd.toISOString().split("T")[0]
  };
}

// kept from FIRST file
function updateCycleLength(oldCycle, previousCycle) {
  return Math.round((4 * oldCycle + previousCycle) / 5);
}

// kept FIRST version
function getPhaseGuidance(phase) {
  const data = {
    Menstruation: {
      diet: ["Spinach", "Lentils", "Herbal tea"],
      yoga: ["Child Pose", "Cat-Cow"],
      exercise: "Light walking only"
    },
    Follicular: {
      diet: ["Fruits", "Protein foods"],
      yoga: ["Sun Salutation"],
      exercise: "Cardio + gym"
    },
    Ovulation: {
      diet: ["Fruits", "Nuts"],
      yoga: ["Power yoga"],
      exercise: "HIIT + strength training"
    },
    Luteal: {
      diet: ["Oats", "Bananas"],
      yoga: ["Meditation"],
      exercise: "Moderate workouts"
    }
  };

  return data[phase];
}

// ======================
// 📝 SIGNUP
// ======================
app.post("/signup", async (req, res) => {
  try {
    const {
      name,
      username,
      password,
      age,
      weight,
      height,
      cycleLength,
      lastPeriod
    } = req.body;

    if (cycleLength < 20 || cycleLength > 40) {
      return res.status(400).json({ error: "Invalid cycle length" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      username,
      password: hashedPassword,
      age,
      weight,
      height,
      cycleLength,
      lastPeriod
    });

    await newUser.save();

    res.json({ message: "User created successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "User already exists or error occurred"
    });
  }
});

// ======================
// 🔑 LOGIN
// ======================
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });

    if (!user) {
      return res.json({ error: "User not found" });
    }

    const isMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!isMatch) {
      return res.json({ error: "Wrong password" });
    }

    const token = jwt.sign(
      { id: user._id },
      SECRET,
      { expiresIn: "1d" }
    );

    res.json({ token });

  } catch (err) {
    res.status(500).json({ error: "Login error" });
  }
});

// ======================
// 📊 DASHBOARD
// ======================
app.get("/dashboard", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    const cycleData = calculateCyclePhases(
      user.lastPeriod,
      user.cycleLength
    );

    // kept from FIRST file
    const insights = calculateInsights(
      user.lastPeriod,
      user.cycleLength
    );

    const today = new Date()
      .toISOString()
      .split("T")[0];

    const todayData = cycleData.find(
      d => d.date === today
    );

    const guidance = todayData
      ? getPhaseGuidance(todayData.phase)
      : null;

    res.json({
      user,
      cycle: cycleData,
      insights,
      guidance
    });

  } catch (err) {
    res.status(500).json({
      error: "Error loading dashboard"
    });
  }
});

// ======================
// 🩸 LOG CYCLE
// ======================
app.post("/log-cycle", authMiddleware, async (req, res) => {
  try {
    const { newStartDate } = req.body;

    const user = await User.findById(req.user.id);

    const lastDate = new Date(user.lastPeriod);
    const newDate = new Date(newStartDate);

    const diffDays = Math.round(
      (newDate - lastDate) /
      (1000 * 60 * 60 * 24)
    );

    user.cycleHistory.push({
      cycleLength: diffDays,
      startDate: newDate
    });

    user.cycleLength = updateCycleLength(
      user.cycleLength,
      diffDays
    );

    user.lastPeriod = newDate;

    await user.save();

    res.json({
      message: "Cycle updated",
      newCycleLength: user.cycleLength
    });

  } catch (err) {
    res.status(500).json({
      error: "Error updating cycle"
    });
  }
});

// ======================
// 🚀 START SERVER
// ======================
app.listen(3000, () => {
  console.log(
    "Server running on http://localhost:3000"
  );
});