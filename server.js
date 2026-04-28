const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");

const User = require("./models/User");

// ROUTES
const cartRoutes = require("./routes/cart");
const paymentRoutes = require("./routes/payment");
const dietRoutes = require("./routes/diet");

const app = express();

// SECRET
const SECRET = process.env.JWT_SECRET || "mysecretkey";

// ======================
// ✅ MIDDLEWARE
// ======================
app.use(cors());
app.use(express.json());

// ✅ STATIC FILES (VERY IMPORTANT)
app.use(express.static(path.join(__dirname, "public")));

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
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "shop.html"));
});

app.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "signup.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/dashboard-page", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

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
// 📝 SIGNUP
// ======================
app.post("/signup", async (req, res) => {
  try {
    const {
      name, username, password,
      age, weight, height,
      cycleLength, lastPeriod
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
    res.status(500).json({ error: "User already exists or error occurred" });
  }
});

// ======================
// 🔑 LOGIN
// ======================
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) return res.json({ error: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.json({ error: "Wrong password" });

    const token = jwt.sign(
      { id: user._id },
      SECRET,
      { expiresIn: "1d" }
    );

    res.json({ token });

  } catch {
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

    const today = new Date().toISOString().split("T")[0];
    const todayData = cycleData.find(d => d.date === today);

    res.json({
      user,
      cycle: cycleData,
      guidance: todayData ? getPhaseGuidance(todayData.phase) : null
    });

  } catch {
    res.status(500).json({ error: "Error loading dashboard" });
  }
});

// ======================
// 🚀 START SERVER
// ======================
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});

// ======================
// 📊 HELPERS
// ======================
function calculateCyclePhases(lastPeriod, cycleLength) {
  const startDate = new Date(lastPeriod);
  const days = [];

  for (let i = 1; i <= cycleLength; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + (i - 1));

    let phase = "";
    if (i <= 6) phase = "Menstruation";
    else if (i <= cycleLength - 17) phase = "Follicular";
    else if (i <= cycleLength - 14) phase = "Ovulation";
    else phase = "Luteal";

    days.push({
      day: i,
      date: date.toISOString().split("T")[0],
      phase
    });
  }

  return days;
}

function getPhaseGuidance(phase) {
  return {
    Menstruation: { diet: ["Spinach", "Tea"], exercise: "Rest" },
    Follicular: { diet: ["Fruits"], exercise: "Light workout" },
    Ovulation: { diet: ["Nuts"], exercise: "Intense workout" },
    Luteal: { diet: ["Bananas"], exercise: "Moderate workout" }
  }[phase];
}