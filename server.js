require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// DB
connectDB();

// ================= ROUTES =================
const authRoutes = require("./routes/authRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const cartRoutes = require("./routes/cartRoutes");
const chatRoutes = require("./routes/chatRoutes");
const cycleRoutes = require("./routes/cycleRoutes");
const doctorRoutes = require("./routes/doctorRoutes");
const productRoutes = require("./routes/productRoutes");
const symptomRoutes = require("./routes/symptomRoutes");

// 🔥 FIX: ADD THIS (you were missing it)
const notificationRoutes = require("./routes/notificationRoutes");

// ================= API MOUNTING =================
app.use("/api/auth", authRoutes);

app.use("/api/appointments", appointmentRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/cycle", cycleRoutes);
app.use("/api/doctor", doctorRoutes);
app.use("/api/products", productRoutes);
app.use("/api/symptoms", symptomRoutes);

// 🔥 FIX: THIS WAS MISSING (main bug fix)
app.use("/api/notifications", notificationRoutes);

// ================= /api/me =================
const jwt = require("jsonwebtoken");
const SECRET = process.env.JWT_SECRET || "menstrumate-dev-secret";
const { readDb } = require("./services/db");
const { publicAccount, publicDoctor } = require("./utils/auth");

app.get("/api/me", async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Login required" });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, SECRET);

    const db = await readDb();
    const list = decoded.role === "doctor" ? db.doctors : db.users;

    const account = list.find(u => u.id === decoded.id);

    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    const safe =
      decoded.role === "doctor"
        ? publicDoctor(account)
        : publicAccount(account);

    res.json({ account: safe });

  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});





// ================= SPA fallback =================
app.use((req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({
      success: false,
      error: "API not found",
      path: req.path
    });
  }

  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Add this after your routes
app.get("/api/debug/products-check", async (req, res) => {
  try {
    const { readDb } = require("./services/db");
    const db = await readDb();
    res.json({
      productsExist: db.products?.length > 0,
      productCount: db.products?.length || 0,
      sampleProducts: db.products?.slice(0, 3) || [],
      categoriesExist: db.categories?.length > 0,
      categories: db.categories || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});