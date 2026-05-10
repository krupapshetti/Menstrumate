require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const connectDB = require("./config/db");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// YouTube videos endpoint with caching
let videoCache = { data: null, timestamp: 0 };
const CACHE_DURATION = 6 * 60 * 60 * 1000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
const notificationRoutes = require("./routes/notificationRoutes");
const communityRoutes = require("./routes/community-routes");
const dietRoutes = require("./routes/dietRoutes");               // ← ADDED

// ================= API MOUNTING =================
app.use("/api/auth", authRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/cycle", cycleRoutes);
app.use("/api/doctor", doctorRoutes);
app.use("/api/products", productRoutes);
app.use("/api/symptoms", symptomRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/community", communityRoutes);
app.use("/api/diet-plan", dietRoutes);                           // ← ADDED

// ================= DIRECT ENDPOINTS =================
app.get("/api/yoga", async (req, res) => {
  try {
    const { readDb } = require("./services/db");
    const db = await readDb();
    res.json({ success: true, yoga: db.yoga || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/doctors", async (req, res) => {
  try {
    const { readDb } = require("./services/db");
    const db = await readDb();
    const doctors = (db.doctors || []).map(d => ({
      id: d.id,
      name: d.name,
      email: d.email,
      specialty: d.specialty || "Gynecology",
      clinic: d.clinic || "Menstrumate Clinic",
      isOnline: d.isOnline !== false,
      initials: d.name ? d.name.split(' ').map(n => n[0]).join('').toUpperCase() : "DR"
    }));
    res.json({ success: true, doctors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/education", async (req, res) => {
  try {
    const { readDb } = require("./services/db");
    const db = await readDb();
    res.json({ success: true, education: db.education || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/education/videos", async (req, res) => {
  try {
    if (videoCache.data && (Date.now() - videoCache.timestamp) < CACHE_DURATION) {
      console.log("📦 Serving videos from cache");
      return res.json({ videos: videoCache.data });
    }
    
    if (!process.env.YOUTUBE_API_KEY) {
      console.log("⚠️ No YouTube API key");
      return res.json({ videos: [] });
    }
    
    console.log("🔄 Fetching fresh videos from YouTube...");
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=8&q=women+health+educational+videos&type=video&key=${process.env.YOUTUBE_API_KEY}`
    );
    const data = await response.json();
    
    const videos = (data.items || []).map(item => ({
      id: item.id.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails.medium.url,
      channelTitle: item.snippet.channelTitle
    }));
    
    videoCache = { data: videos, timestamp: Date.now() };
    console.log(`✅ Cached ${videos.length} videos`);
    res.json({ videos });
  } catch (err) {
    console.log("❌ YouTube API error:", err.message);
    if (videoCache.data) {
      console.log("📦 Serving expired cache");
      return res.json({ videos: videoCache.data });
    }
    res.json({ videos: [] });
  }
});

app.get("/api/profile/history", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Login required" });
  }
  
  const token = authHeader.slice(7);
  const jwt = require("jsonwebtoken");
  const SECRET = process.env.JWT_SECRET || "menstrumate-dev-secret";
  const { readDb } = require("./services/db");
  
  try {
    const decoded = jwt.verify(token, SECRET);
    const db = await readDb();
    
    let userCycles = [];
    if (db.cycles && Array.isArray(db.cycles)) {
      userCycles = db.cycles.filter(c => c.userId === decoded.id);
    }
    
    const cycleHistory = userCycles.map(cycle => ({
      startDate: cycle.startDate,
      endDate: cycle.endDate || cycle.startDate,
      cycleLength: cycle.cycleLength
    }));
    
    const symptoms = db.symptoms?.filter(s => s.userId === decoded.id) || [];
    
    const frequencyMap = {};
    symptoms.forEach(symptom => {
      (symptom.symptoms || []).forEach(s => {
        frequencyMap[s] = (frequencyMap[s] || 0) + 1;
      });
    });
    
    const frequency = Object.entries(frequencyMap).map(([symptom, count]) => ({ symptom, count }));
    const painTrend = symptoms.map(s => ({ date: s.date, painLevel: s.painLevel }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    res.json({ cycleHistory, symptomAnalytics: { frequency, painTrend }, reports: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/profile", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Login required" });
  }
  
  const token = authHeader.slice(7);
  const jwt = require("jsonwebtoken");
  const SECRET = process.env.JWT_SECRET || "menstrumate-dev-secret";
  const { readDb, writeDb } = require("./services/db");
  
  try {
    const decoded = jwt.verify(token, SECRET);
    const { cycleLength, lastPeriod, name } = req.body;
    const db = await readDb();
    
    const userIndex = db.users.findIndex(u => u.id === decoded.id);
    if (userIndex === -1) {
      return res.status(404).json({ error: "User not found" });
    }
    
    if (cycleLength !== undefined) db.users[userIndex].cycleLength = parseInt(cycleLength);
    if (lastPeriod !== undefined) db.users[userIndex].lastPeriod = lastPeriod;
    if (name !== undefined) db.users[userIndex].name = name;
    
    await writeDb(db);
    
    res.json({ 
      success: true, 
      message: "Profile updated successfully",
      account: {
        id: db.users[userIndex].id,
        name: db.users[userIndex].name,
        email: db.users[userIndex].email,
        role: db.users[userIndex].role,
        cycleLength: db.users[userIndex].cycleLength,
        lastPeriod: db.users[userIndex].lastPeriod
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/debug/db", async (req, res) => {
  const { readDb } = require("./services/db");
  const db = await readDb();
  res.json({
    dbPath: require("./services/db").DB_PATH || "unknown",
    doctors: db.doctors.map(d => ({ id: d.id, name: d.name, email: d.email })),
    totalDoctors: db.doctors.length
  });
});

app.get("/api/debug/appointments", async (req, res) => {
  try {
    const { readDb } = require("./services/db");
    const db = await readDb();
    res.json({
      total: db.appointments.length,
      appointments: db.appointments,
      sampleFields: db.appointments.length > 0 ? Object.keys(db.appointments[0]) : []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/debug/cycles", async (req, res) => {
  try {
    const { readDb } = require("./services/db");
    const db = await readDb();
    res.json({
      cyclesType: typeof db.cycles,
      isArray: Array.isArray(db.cycles),
      cyclesCount: db.cycles?.length || 0,
      cycles: db.cycles || [],
      sampleCycle: db.cycles?.length > 0 ? db.cycles[0] : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

// ================= WEBSOCKET SETUP =================
const { setupWebSocket } = require("./websocket-server");
setupWebSocket(server);

// Start server
server.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
});