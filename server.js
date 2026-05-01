const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const fs = require("fs/promises");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || "menstrumate-dev-secret";
const DB_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DB_DIR, "db.json");

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.get([
  "/login.html",
  "/signup.html",
  "/shop.html",
  "/cart.html",
  "/checkout.html",
  "/dashboard.html",
  "/guidance.html"
], (req, res) => res.redirect("/"));
app.use(express.static(path.join(__dirname, "public")));

const seedProducts = [
  { id: "pads-regular", category: "Sanitary Pads", name: "Soft Cotton Sanitary Pads", price: 120, image: "https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=600&q=80" },
  { id: "pads-night", category: "Sanitary Pads", name: "Overnight Flow Pads", price: 180, image: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=600&q=80" },
  { id: "tampons-compact", category: "Tampons", name: "Compact Tampons", price: 210, image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80" },
  { id: "cup-classic", category: "Menstrual Cups", name: "Reusable Menstrual Cup", price: 499, image: "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=600&q=80" },
  { id: "heat-electric", category: "Heating Pads", name: "Portable Heating Pad", price: 699, image: "https://images.unsplash.com/photo-1616699002805-0741e1e4a9c5?auto=format&fit=crop&w=600&q=80" },
  { id: "relief-roll", category: "Pain Relief", name: "Cramp Relief Roll-On", price: 160, image: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=600&q=80" },
  { id: "relief-patch", category: "Pain Relief", name: "Warm Relief Patches", price: 240, image: "https://images.unsplash.com/photo-1603398938378-e54eab446dde?auto=format&fit=crop&w=600&q=80" },
  { id: "comfort-chocolate", category: "Chocolate / Comfort", name: "Dark Chocolate Comfort Bar", price: 95, image: "https://images.unsplash.com/photo-1549007994-cb92caebd54b?auto=format&fit=crop&w=600&q=80" },
  { id: "comfort-tea", category: "Chocolate / Comfort", name: "Ginger Chamomile Tea", price: 175, image: "https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?auto=format&fit=crop&w=600&q=80" }
];

const seedYoga = [
  { id: "child-pose", name: "Child's Pose", duration: 60, instructions: "Fold forward with knees apart, rest your forehead down, and breathe slowly into your lower back.", animation: "fold", image: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=900&q=80" },
  { id: "cat-cow", name: "Cat-Cow Flow", duration: 90, instructions: "Move between rounding and arching your spine with each breath to release cramps and back tension.", animation: "wave", image: "https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?auto=format&fit=crop&w=900&q=80" },
  { id: "cobra", name: "Gentle Cobra", duration: 45, instructions: "Lie on your belly, press palms down, and lift your chest gently without straining your lower back.", animation: "rise", image: "https://images.unsplash.com/photo-1593811167562-9cef47bfc4d7?auto=format&fit=crop&w=900&q=80" },
  { id: "butterfly", name: "Butterfly Stretch", duration: 75, instructions: "Bring soles together, hold your feet, and let your knees soften toward the floor.", animation: "butterfly", image: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=900&q=80" },
  { id: "legs-up", name: "Legs Up Rest", duration: 120, instructions: "Rest on your back with legs elevated against a wall or cushion to calm fatigue.", animation: "legs", image: "https://images.unsplash.com/photo-1599447421416-3414500d18a5?auto=format&fit=crop&w=900&q=80" }
];

const seedEducation = [
  { id: "cycle-basics", topic: "Menstruation Info", title: "Cycle basics", body: "A menstrual cycle is counted from the first day of bleeding to the day before the next period starts. Many cycles are between 21 and 35 days." },
  { id: "hygiene", topic: "Health Tips", title: "Hygiene and comfort", body: "Change pads or tampons regularly, wash hands before and after, stay hydrated, and seek medical advice for severe pain or very heavy bleeding." },
  { id: "consent", topic: "Basic Sex Education", title: "Consent and protection", body: "Consent must be clear, mutual, and reversible. Condoms and medical contraception help reduce pregnancy risk, and condoms also reduce STI risk." },
  { id: "when-doctor", topic: "Health Tips", title: "When to consult a doctor", body: "Talk to a doctor if periods stop unexpectedly, pain disrupts daily life, bleeding is unusually heavy, or cycles suddenly change a lot." }
];

const seedNotifications = [
  "Drink water and keep a warm pad nearby today.",
  "Your body is doing real work. Take the slower option when you can.",
  "A protein-rich snack can help with weakness and mood dips.",
  "Stretch your shoulders, unclench your jaw, and breathe for 30 seconds.",
  "Pack an extra pad, tampon, or cup before heading out."
];

const seedSymptomOptions = [
  "Cramps",
  "Bloating",
  "Headache",
  "Mood swings",
  "Fatigue",
  "Acne",
  "Back pain"
];

const seedInsightRules = [
  { symptom: "Cramps", message: "Frequent cramps detected. Try warm compresses and iron-rich meals.", action: "Add a heating pad or gentle yoga today." },
  { symptom: "Fatigue", message: "Fatigue has appeared often. Prioritize rest, hydration, and protein.", action: "Choose a lighter workout and plan an early night." },
  { symptom: "Bloating", message: "Bloating is recurring. Reduce excess salt and add potassium-rich foods.", action: "Try cucumber water or banana with curd." },
  { symptom: "Headache", message: "Headaches are recurring. Hydration and regular meals may help.", action: "Avoid skipping meals and track caffeine." },
  { symptom: "Mood swings", message: "Mood changes are showing a pattern. Magnesium-rich snacks may help.", action: "Schedule a low-pressure day if possible." }
];

const seedAppointmentSlots = ["09:30", "10:30", "11:30", "14:30", "16:00"];

const seedShopRules = [
  { match: "cramps", categories: ["Heating Pads", "Pain Relief"] },
  { match: "back pain", categories: ["Heating Pads", "Pain Relief"] },
  { match: "fatigue", categories: ["Chocolate / Comfort"] },
  { match: "mood swings", categories: ["Chocolate / Comfort"] }
];

const defaultDb = {
  users: [],
  doctors: [],
  otps: [],
  carts: {},
  payments: [],
  cycles: {},
  patientMessages: [],
  patientRecommendations: [],
  followUps: [],
  activityLogs: {},
  chats: [],
  symptoms: [],
  appointments: [],
  products: seedProducts,
  yoga: seedYoga,
  education: seedEducation,
  notifications: seedNotifications,
  symptomOptions: seedSymptomOptions,
  insightRules: seedInsightRules,
  appointmentSlots: seedAppointmentSlots,
  shopRules: seedShopRules
};

function normalizeDb(parsed = {}) {
  const db = { ...defaultDb, ...parsed };
  db.users = Array.isArray(db.users) ? db.users : [];
  db.doctors = Array.isArray(db.doctors) ? db.doctors : [];
  db.otps = Array.isArray(db.otps) ? db.otps : [];
  db.carts = db.carts && typeof db.carts === "object" ? db.carts : {};
  db.payments = Array.isArray(db.payments) ? db.payments : [];
  db.cycles = db.cycles && typeof db.cycles === "object" ? db.cycles : {};
  db.patientMessages = Array.isArray(db.patientMessages) ? db.patientMessages : [];
  db.patientRecommendations = Array.isArray(db.patientRecommendations) ? db.patientRecommendations : [];
  db.followUps = Array.isArray(db.followUps) ? db.followUps : [];
  db.activityLogs = db.activityLogs && typeof db.activityLogs === "object" ? db.activityLogs : {};
  db.chats = Array.isArray(db.chats) ? db.chats : [];
  db.symptoms = Array.isArray(db.symptoms) ? db.symptoms : [];
  db.symptoms = db.symptoms.map((entry) => ({
    ...entry,
    sharedWithDoctor: Boolean(entry.sharedWithDoctor)
  }));
  db.appointments = Array.isArray(db.appointments) ? db.appointments : [];
  db.products = Array.isArray(db.products) && db.products.length ? db.products : seedProducts;
  db.yoga = Array.isArray(db.yoga) && db.yoga.length
    ? db.yoga.map((pose) => ({ ...(seedYoga.find((item) => item.id === pose.id) || {}), ...pose }))
    : seedYoga;
  db.education = Array.isArray(db.education) && db.education.length ? db.education : seedEducation;
  db.notifications = Array.isArray(db.notifications) && db.notifications.length ? db.notifications : seedNotifications;
  db.symptomOptions = Array.isArray(db.symptomOptions) && db.symptomOptions.length ? db.symptomOptions : seedSymptomOptions;
  db.insightRules = Array.isArray(db.insightRules) && db.insightRules.length ? db.insightRules : seedInsightRules;
  db.appointmentSlots = Array.isArray(db.appointmentSlots) && db.appointmentSlots.length ? db.appointmentSlots : seedAppointmentSlots;
  db.shopRules = Array.isArray(db.shopRules) && db.shopRules.length ? db.shopRules : seedShopRules;
  db.chats = db.chats.map((chat) => ({
    ...chat,
    typing: chat.typing && typeof chat.typing === "object" ? chat.typing : {}
  }));
  db.users = db.users.map((user) => ({ ...user, role: "user" }));
  db.doctors = db.doctors.map((doctor) => ({
    ...doctor,
    role: "doctor",
    isOnline: Boolean(doctor.isOnline),
    lastSeen: doctor.lastSeen || doctor.createdAt || null
  }));
  return db;
}

async function readDb() {
  await fs.mkdir(DB_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(DB_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return normalizeDb(parsed);
  } catch {
    const db = normalizeDb(defaultDb);
    await writeDb(db);
    return structuredClone(db);
  }
}

async function writeDb(db) {
  await fs.mkdir(DB_DIR, { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2));
}

function publicAccount(account) {
  const { passwordHash, ...safe } = account;
  return safe;
}

function publicDoctor(doctor) {
  const safe = publicAccount(doctor);
  return {
    ...safe,
    isOnline: Boolean(safe.isOnline),
    lastSeen: safe.lastSeen || null,
    initials: String(safe.name || "DR")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "DR"
  };
}

function createToken(account, role) {
  return jwt.sign({ id: account.id, role, email: account.email }, SECRET, { expiresIn: "1d" });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Login required" });
  try {
    req.auth = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired session" });
  }
}

function requireDoctor(req, res, next) {
  if (req.auth?.role !== "doctor") {
    return res.status(403).json({ error: "Doctor access required" });
  }
  next();
}

function logActivity(db, userId, type, detail) {
  db.activityLogs[userId] = db.activityLogs[userId] || [];
  db.activityLogs[userId].push({
    id: `activity_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    type,
    detail,
    createdAt: new Date().toISOString()
  });
}

function addDays(dateText, days) {
  const date = new Date(dateText);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  return Math.max(1, Math.round((new Date(b) - new Date(a)) / 86400000));
}

function calculateCycle(lastPeriod, cycleLength) {
  const cycle = [];
  for (let i = 0; i < cycleLength; i += 1) {
    let phase = "Luteal";
    if (i < 5) phase = "Menstruation";
    else if (i < cycleLength - 16) phase = "Follicular";
    else if (i < cycleLength - 13) phase = "Ovulation";
    cycle.push({ day: i + 1, date: addDays(lastPeriod, i), phase });
  }
  return cycle;
}

function cycleInsights(lastPeriod, cycleLength) {
  const nextPeriod = addDays(lastPeriod, cycleLength);
  const reminder = addDays(nextPeriod, -3);
  const ovulation = addDays(nextPeriod, -14);
  return {
    nextPeriod,
    alertDate: reminder,
    ovulation,
    fertileStart: addDays(ovulation, -4),
    fertileEnd: addDays(ovulation, 1)
  };
}

function cycleStarts(db, user) {
  const starts = (db.cycles[user.id] || [])
    .map((item) => ({
      startDate: item.startDate || item.date || item.lastPeriod,
      cycleLength: Number(item.cycleLength)
    }))
    .filter((item) => item.startDate)
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  if (!starts.some((item) => item.startDate === user.lastPeriod)) {
    starts.push({ startDate: user.lastPeriod, cycleLength: Number(user.cycleLength) || 28 });
  }
  return starts.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
}

function smartCyclePrediction(db, user) {
  const starts = cycleStarts(db, user);
  const lengths = starts
    .map((item, index) => {
      if (Number.isFinite(item.cycleLength) && item.cycleLength >= 15) return Number(item.cycleLength);
      const next = starts[index + 1];
      return next ? daysBetween(item.startDate, next.startDate) : null;
    })
    .filter((length) => Number.isFinite(length) && length >= 15 && length <= 60);
  const fallback = Number(user.cycleLength) || 28;
  const averageLength = lengths.length
    ? Math.round(lengths.reduce((sum, value) => sum + value, 0) / lengths.length)
    : fallback;
  const variance = lengths.length > 1
    ? lengths.reduce((sum, value) => sum + Math.abs(value - averageLength), 0) / lengths.length
    : 0;
  const irregular = averageLength < 21 || averageLength > 35 || variance > 4;
  const latestStart = starts[starts.length - 1]?.startDate || user.lastPeriod;
  const today = new Date().toISOString().slice(0, 10);
  const dayInCycle = Math.max(1, daysBetween(latestStart, today) + 1);
  const phase = calculateCycle(latestStart, averageLength).find((day) => day.day === ((dayInCycle - 1) % averageLength) + 1)?.phase || "Luteal";
  const confidence = Math.max(45, Math.min(96, 92 - Math.round(variance * 6) + Math.min(lengths.length, 5) * 2));
  return {
    ...cycleInsights(latestStart, averageLength),
    averageCycleLength: averageLength,
    predictionConfidence: confidence,
    irregularCycle: irregular,
    variabilityDays: Number(variance.toFixed(1)),
    todayPhase: phase,
    dayInCycle,
    historyCount: starts.length
  };
}

function symptomAnalytics(db, userId, sharedOnly = false) {
  const entries = db.symptoms
    .filter((entry) => entry.userId === userId)
    .filter((entry) => !sharedOnly || entry.sharedWithDoctor)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const frequencyMap = entries.reduce((counts, entry) => {
    (entry.symptoms || []).forEach((symptom) => {
      counts[symptom] = (counts[symptom] || 0) + 1;
    });
    return counts;
  }, {});
  const frequency = Object.entries(frequencyMap)
    .sort((a, b) => b[1] - a[1])
    .map(([symptom, count]) => ({ symptom, count }));
  const painTrend = entries.slice(-30).map((entry) => ({
    date: entry.date,
    painLevel: Number(entry.painLevel || 0)
  }));
  const highPainAlerts = entries.filter((entry) => Number(entry.painLevel) > 8);
  const averagePain = entries.length
    ? Number((entries.reduce((sum, entry) => sum + Number(entry.painLevel || 0), 0) / entries.length).toFixed(1))
    : 0;
  return { entries, frequency, painTrend, highPainAlerts, averagePain };
}

function expectedSymptomsForPhase(phase) {
  const map = {
    Menstruation: ["Cramps", "Fatigue", "Back pain"],
    Follicular: ["Higher energy", "Clearer mood"],
    Ovulation: ["Mild cramps", "Bloating"],
    Luteal: ["Mood swings", "Acne", "Bloating"]
  };
  return map[phase] || [];
}

function recommendedActionsForPhase(phase) {
  const map = {
    Menstruation: ["Use heat support", "Choose iron-rich meals", "Try gentle stretching"],
    Follicular: ["Plan moderate exercise", "Prep balanced meals"],
    Ovulation: ["Stay hydrated", "Track any mid-cycle pain"],
    Luteal: ["Reduce salt", "Prioritize sleep", "Keep snacks protein-rich"]
  };
  return map[phase] || ["Hydrate and check in with your body"];
}

function generateInsightList(db, user, sharedOnly = false) {
  const analytics = symptomAnalytics(db, user.id, sharedOnly);
  const prediction = smartCyclePrediction(db, user);
  const insights = [];
  const frequent = analytics.frequency.filter((item) => item.count >= 2);
  frequent.forEach((item) => {
    const rule = db.insightRules.find((entry) => entry.symptom.toLowerCase() === item.symptom.toLowerCase());
    insights.push({
      type: "symptom",
      title: item.symptom,
      message: rule?.message || `${item.symptom} appears frequently in your logs.`,
      action: rule?.action || "Keep tracking this pattern for better recommendations."
    });
  });
  if (analytics.highPainAlerts.length) {
    insights.push({
      type: "risk",
      title: "High pain pattern",
      message: `You reported pain above 8 on ${analytics.highPainAlerts.length} day(s).`,
      action: "Consider sharing logs with a doctor if this continues."
    });
  }
  if (prediction.irregularCycle) {
    insights.push({
      type: "cycle",
      title: "Irregular cycle warning",
      message: `Your cycle variability is about ${prediction.variabilityDays} day(s).`,
      action: "Keep cycle starts updated so predictions can improve."
    });
  }
  if (!insights.length) {
    insights.push({
      type: "general",
      title: "Stable tracking",
      message: "No strong risk pattern is visible yet.",
      action: "Log symptoms daily to unlock better personalization."
    });
  }
  return { insights, analytics, prediction };
}

function smartNotifications(db, user) {
  const prediction = smartCyclePrediction(db, user);
  const today = new Date().toISOString().slice(0, 10);
  const daysToPeriod = Math.round((new Date(prediction.nextPeriod) - new Date(today)) / 86400000);
  const yesterday = addDays(today, -1);
  const yesterdayEntry = db.symptoms.find((entry) => entry.userId === user.id && entry.date === yesterday);
  const messages = [];
  if (daysToPeriod >= 0 && daysToPeriod <= 3) messages.push(`Period expected in ${daysToPeriod} day${daysToPeriod === 1 ? "" : "s"}.`);
  if (prediction.todayPhase === "Ovulation") messages.push("Ovulation phase today. Hydrate and note any mid-cycle pain.");
  if (Number(yesterdayEntry?.painLevel || 0) > 7) messages.push("You reported high pain yesterday. Take it gently today.");
  if (prediction.irregularCycle) messages.push("Cycle irregularity detected. Keep your latest period date updated.");
  return messages.length ? messages : [...db.notifications].sort(() => Math.random() - 0.5).slice(0, 3);
}

function recommendProducts(db, userId) {
  const analytics = symptomAnalytics(db, userId, false);
  const symptoms = analytics.frequency.map((item) => item.symptom.toLowerCase());
  const matchedTerms = db.shopRules
    .filter((rule) => symptoms.includes(String(rule.match || "").toLowerCase()))
    .flatMap((rule) => rule.categories || []);
  return db.products
    .filter((product) => matchedTerms.includes(product.category))
    .slice(0, 4);
}

function latestActivity(db, userId, user) {
  const logs = db.activityLogs[userId] || [];
  const latestLog = logs[logs.length - 1]?.createdAt;
  const dates = [latestLog, user.createdAt, user.lastPeriod].filter(Boolean).map((date) => new Date(date));
  return new Date(Math.max(...dates.map((date) => date.getTime()))).toISOString();
}

function symptomText(db, userId, sharedOnly = false) {
  const symptomEntries = db.symptoms
    .filter((entry) => entry.userId === userId)
    .filter((entry) => !sharedOnly || entry.sharedWithDoctor)
    .flatMap((entry) => entry.symptoms || []);
  const dietEntries = sharedOnly ? [] : (db.activityLogs[userId] || [])
    .filter((log) => log.type === "diet-plan")
    .map((log) => log.detail);
  return [...symptomEntries, ...dietEntries].filter(Boolean).join(", ");
}

function detectPatientRisk(db, user) {
  const symptoms = symptomText(db, user.id).toLowerCase();
  const history = db.cycles[user.id] || [];
  const analytics = symptomAnalytics(db, user.id, true);
  const lastSeen = latestActivity(db, user.id, user);
  const inactiveDays = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 86400000);
  const severeWords = ["severe", "heavy bleeding", "faint", "dizzy", "vomit", "unbearable", "fever", "clot"];
  const hasSevereSymptoms = severeWords.some((word) => symptoms.includes(word));
  const irregularCycle = smartCyclePrediction(db, user).irregularCycle || Number(user.cycleLength) < 21 || Number(user.cycleLength) > 35 || history.some((item) => Number(item.cycleLength) < 21 || Number(item.cycleLength) > 35);
  const highPain = analytics.highPainAlerts.length > 0;
  const noActivity = inactiveDays > 30;
  const reasons = [];
  if (hasSevereSymptoms) reasons.push("Severe symptoms reported");
  if (highPain) reasons.push("Pain above 8 shared with doctor");
  if (irregularCycle) reasons.push("Irregular cycle pattern");
  if (noActivity) reasons.push("No activity for over 30 days");
  const score = (hasSevereSymptoms ? 2 : 0) + (highPain ? 2 : 0) + (irregularCycle ? 1 : 0) + (noActivity ? 1 : 0);
  const level = score >= 2 ? "High" : score === 1 ? "Medium" : "Low";
  return { level, score, reasons, hasSevereSymptoms, highPain, irregularCycle, noActivity, inactiveDays };
}

function patientCondition(db, user) {
  const risk = detectPatientRisk(db, user);
  const symptoms = symptomText(db, user.id);
  if (risk.hasSevereSymptoms) return "Severe symptoms";
  if (risk.irregularCycle) return "Irregular cycle";
  if (symptoms) return "Symptoms logged";
  return "Cycle tracking";
}

function buildPatientSummary(db, user) {
  const risk = detectPatientRisk(db, user);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    profileType: user.role,
    condition: patientCondition(db, user),
    lastActivity: latestActivity(db, user.id, user),
    riskLevel: risk.level,
    riskReasons: risk.reasons,
    createdAt: user.createdAt
  };
}

function buildPatientDetails(db, user) {
  const summary = buildPatientSummary(db, user);
  const history = db.cycles[user.id] || [];
  const symptomHistory = db.symptoms
    .filter((entry) => entry.userId === user.id && entry.sharedWithDoctor)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const symptomCounts = symptomHistory.reduce((counts, entry) => {
    (entry.symptoms || []).forEach((symptom) => {
      counts[symptom] = (counts[symptom] || 0) + 1;
    });
    return counts;
  }, {});
  const frequentSymptoms = Object.entries(symptomCounts)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([symptom, count]) => ({ symptom, count }));
  return {
    ...summary,
    symptoms: symptomText(db, user.id, true) || "No shared symptoms logged yet",
    cycle: {
      lastPeriod: user.lastPeriod,
      cycleLength: user.cycleLength,
      insights: smartCyclePrediction(db, user),
      currentCycle: calculateCycle(user.lastPeriod, user.cycleLength),
      history
    },
    activityLogs: (db.activityLogs[user.id] || []).filter((log) => log.type !== "symptoms"),
    messages: db.patientMessages.filter((item) => item.patientId === user.id),
    recommendations: db.patientRecommendations.filter((item) => item.patientId === user.id),
    followUps: db.followUps.filter((item) => item.patientId === user.id),
    symptomHistory,
    symptomInsights: {
      frequentSymptoms,
      highPainEntries: symptomHistory.filter((entry) => Number(entry.painLevel) > 7),
      averagePain: symptomHistory.length
        ? Number((symptomHistory.reduce((sum, entry) => sum + Number(entry.painLevel || 0), 0) / symptomHistory.length).toFixed(1))
        : 0
    },
    risk: detectPatientRisk(db, user)
  };
}

function getAccountById(db, id) {
  const user = db.users.find((account) => account.id === id);
  if (user) return { account: user, role: "user" };
  const doctor = db.doctors.find((account) => account.id === id);
  if (doctor) return { account: doctor, role: "doctor" };
  return null;
}

function findChat(db, doctorId, userId) {
  return db.chats.find((chat) => chat.doctorId === doctorId && chat.userId === userId);
}

function createChat(doctorId, userId) {
  return {
    chatId: `chat_${doctorId}_${userId}`,
    doctorId,
    userId,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function publicChat(db, chat) {
  const doctor = db.doctors.find((account) => account.id === chat.doctorId);
  const user = db.users.find((account) => account.id === chat.userId);
  const messages = Array.isArray(chat.messages) ? chat.messages.map((item) => ({
    ...item,
    sender: item.sender || item.senderId,
    text: item.text || item.message,
    senderId: item.senderId || item.sender,
    message: item.message || item.text,
    timestamp: item.timestamp || item.createdAt || new Date().toISOString(),
    status: item.status || "delivered",
    seenAt: item.seenAt || null
  })) : [];
  return {
    ...chat,
    messages,
    typing: chat.typing || {},
    doctor: doctor ? publicDoctor(doctor) : null,
    patient: user ? publicAccount(user) : null
  };
}

function makeQrSvg(amount, paymentId) {
  const cells = 21;
  let rects = "";
  for (let y = 0; y < cells; y += 1) {
    for (let x = 0; x < cells; x += 1) {
      const finder =
        (x < 7 && y < 7) ||
        (x > 13 && y < 7) ||
        (x < 7 && y > 13);
      const hash = (x * 17 + y * 31 + amount + paymentId.length) % 5;
      if (finder || hash === 0 || hash === 2) {
        rects += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
      }
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21"><rect width="21" height="21" fill="white"/><g fill="black">${rects}</g></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function requireFields(body, fields) {
  const missing = fields.filter((field) => !String(body[field] || "").trim());
  return missing.length ? `${missing.join(", ")} required` : null;
}

function asyncRoute(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error", details: err.message });
    }
  };
}

app.post("/api/auth/request-otp", asyncRoute(async (req, res) => {
  const { email, role } = req.body;
  if (!email || !["user", "doctor"].includes(role)) {
    return res.status(400).json({ error: "Valid email and role required" });
  }
  const db = await readDb();
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  db.otps = db.otps.filter((item) => !(item.email === email.toLowerCase() && item.role === role));
  db.otps.push({ email: email.toLowerCase(), role, otp, expiresAt: Date.now() + 10 * 60 * 1000 });
  await writeDb(db);
  res.json({ message: "OTP generated", otp });
}));

app.post("/api/auth/signup", asyncRoute(async (req, res) => {
  const { role, name, email, otp, password, confirmPassword, specialty, clinic, cycleLength, lastPeriod } = req.body;
  const requiredError = requireFields(req.body, ["role", "name", "email", "otp", "password", "confirmPassword"]);
  if (requiredError) return res.status(400).json({ error: requiredError });
  if (!["user", "doctor"].includes(role)) return res.status(400).json({ error: "Invalid role" });
  if (password !== confirmPassword) return res.status(400).json({ error: "Passwords do not match" });
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

  const db = await readDb();
  const normalizedEmail = email.toLowerCase();
  const listName = role === "doctor" ? "doctors" : "users";
  if (db[listName].some((account) => account.email === normalizedEmail)) {
    return res.status(409).json({ error: "Account already exists" });
  }
  const otpRecord = db.otps.find((item) => item.email === normalizedEmail && item.role === role && item.otp === otp);
  if (!otpRecord || otpRecord.expiresAt < Date.now()) {
    return res.status(400).json({ error: "Invalid or expired OTP" });
  }

  const account = {
    id: `${role}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    role,
    name,
    email: normalizedEmail,
    passwordHash: await bcrypt.hash(password, 10),
    createdAt: new Date().toISOString()
  };

  if (role === "doctor") {
    account.specialty = specialty || "Gynecology";
    account.clinic = clinic || "Menstrumate Clinic";
    account.isOnline = true;
    account.lastSeen = new Date().toISOString();
  } else {
    account.cycleLength = Number(cycleLength) || 28;
    account.lastPeriod = lastPeriod || new Date().toISOString().slice(0, 10);
    db.cycles[account.id] = [{ startDate: account.lastPeriod, cycleLength: account.cycleLength }];
    logActivity(db, account.id, "signup", "Patient account created");
  }

  db[listName].push(account);
  db.otps = db.otps.filter((item) => item !== otpRecord);
  await writeDb(db);
  res.status(201).json({ token: createToken(account, role), account: publicAccount(account), user: publicAccount(account) });
}));

app.post("/api/auth/login", asyncRoute(async (req, res) => {
  const { role, email, password } = req.body;
  if (!["user", "doctor"].includes(role) || !email || !password) {
    return res.status(400).json({ error: "Role, email, and password required" });
  }
  const db = await readDb();
  const listName = role === "doctor" ? "doctors" : "users";
  const account = db[listName].find((item) => item.email === email.toLowerCase());
  if (!account || !(await bcrypt.compare(password, account.passwordHash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  if (role === "doctor") {
    account.isOnline = true;
    account.lastSeen = new Date().toISOString();
    await writeDb(db);
  }
  res.json({ token: createToken(account, role), account: publicAccount(account), user: publicAccount(account) });
}));

app.get("/api/me", requireAuth, asyncRoute(async (req, res) => {
  const db = await readDb();
  const listName = req.auth.role === "doctor" ? "doctors" : "users";
  const account = db[listName].find((item) => item.id === req.auth.id);
  if (!account) return res.status(404).json({ error: "Account not found" });
  res.json({ account: publicAccount(account) });
}));

app.get("/api/products", requireAuth, async (req, res) => {
  const db = await readDb();
  const categories = [...new Set(db.products.map((product) => product.category))];
  const recommendations = req.auth.role === "user" ? recommendProducts(db, req.auth.id) : [];
  res.json({ categories, products: db.products, recommendations });
});

app.get("/api/cart", requireAuth, async (req, res) => {
  const db = await readDb();
  res.json({ items: db.carts[req.auth.id] || [] });
});

app.post("/api/cart/items", requireAuth, async (req, res) => {
  const { productId, quantity = 1 } = req.body;
  const db = await readDb();
  const product = db.products.find((item) => item.id === productId);
  if (!product) return res.status(404).json({ error: "Product not found" });
  const cart = db.carts[req.auth.id] || [];
  const existing = cart.find((item) => item.productId === productId);
  if (existing) existing.quantity += Number(quantity);
  else cart.push({ productId, quantity: Number(quantity) });
  db.carts[req.auth.id] = cart.filter((item) => item.quantity > 0);
  await writeDb(db);
  res.json({ items: db.carts[req.auth.id] });
});

app.patch("/api/cart/items/:productId", requireAuth, async (req, res) => {
  const db = await readDb();
  const cart = db.carts[req.auth.id] || [];
  const item = cart.find((entry) => entry.productId === req.params.productId);
  if (!item) return res.status(404).json({ error: "Cart item not found" });
  item.quantity = Number(req.body.quantity);
  db.carts[req.auth.id] = cart.filter((entry) => entry.quantity > 0);
  await writeDb(db);
  res.json({ items: db.carts[req.auth.id] });
});

app.delete("/api/cart/items/:productId", requireAuth, async (req, res) => {
  const db = await readDb();
  db.carts[req.auth.id] = (db.carts[req.auth.id] || []).filter((item) => item.productId !== req.params.productId);
  await writeDb(db);
  res.json({ items: db.carts[req.auth.id] });
});

app.post("/api/checkout", requireAuth, async (req, res) => {
  const db = await readDb();
  const cart = db.carts[req.auth.id] || [];
  const items = cart.map((entry) => ({ ...db.products.find((product) => product.id === entry.productId), quantity: entry.quantity }));
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  if (!items.length) return res.status(400).json({ error: "Cart is empty" });
  const payment = {
    id: `pay_${Date.now()}`,
    userId: req.auth.id,
    amount: total,
    status: "pending",
    items,
    createdAt: new Date().toISOString()
  };
  payment.qrCode = makeQrSvg(total, payment.id);
  db.payments.push(payment);
  await writeDb(db);
  res.json({ payment });
});

app.post("/api/payments/:id/confirm", requireAuth, async (req, res) => {
  const db = await readDb();
  const payment = db.payments.find((item) => item.id === req.params.id && item.userId === req.auth.id);
  if (!payment) return res.status(404).json({ error: "Payment not found" });
  payment.status = "paid";
  payment.paidAt = new Date().toISOString();
  db.carts[req.auth.id] = [];
  await writeDb(db);
  res.json({ message: "Payment confirmed", payment });
});

app.post("/api/diet-plan", requireAuth, async (req, res) => {
  const db = await readDb();
  const symptoms = String(req.body.symptoms || "").toLowerCase();
  const focus = {
    bloating: ["Cucumber mint water", "Curd rice", "Banana"],
    cramps: ["Ginger tea", "Spinach dal", "Pumpkin seeds"],
    weakness: ["Eggs or paneer", "Lentil soup", "Dates with nuts"],
    mood: ["Dark chocolate", "Oats", "Walnuts"]
  };
  const matched = Object.keys(focus).filter((key) => symptoms.includes(key));
  const boosts = matched.flatMap((key) => focus[key]);
  const plan = Array.from({ length: 7 }, (_, index) => ({
    day: index + 1,
    protein: `${55 + index * 2}g target`,
    breakfast: boosts[index % Math.max(boosts.length, 1)] || "Oats with milk, chia, and fruit",
    lunch: ["Brown rice with dal and greens", "Paneer wrap with salad", "Chickpea bowl with curd"][index % 3],
    snack: ["Fruit with peanut butter", "Roasted makhana", "Dark chocolate with nuts"][index % 3],
    dinner: ["Vegetable khichdi with curd", "Tofu stir fry with rice", "Lentil soup with toast"][index % 3]
  }));
  if (req.auth.role === "user" && req.body.symptoms) {
    logActivity(db, req.auth.id, "diet-plan", String(req.body.symptoms));
    await writeDb(db);
  }
  res.json({ symptoms: req.body.symptoms || "general cycle support", plan });
});

app.get("/api/yoga", requireAuth, async (req, res) => {
  const db = await readDb();
  res.json({ yoga: db.yoga });
});

app.get("/api/notifications", requireAuth, async (req, res) => {
  const db = await readDb();
  const user = db.users.find((item) => item.id === req.auth.id);
  res.json({ messages: user ? smartNotifications(db, user) : db.notifications.slice(0, 3) });
});

app.get("/api/cycle", requireAuth, async (req, res) => {
  const db = await readDb();
  const user = db.users.find((item) => item.id === req.auth.id);
  if (!user) return res.status(403).json({ error: "Only users have cycle tracking" });
  const insights = smartCyclePrediction(db, user);
  res.json({
    cycle: calculateCycle(user.lastPeriod, user.cycleLength),
    insights,
    expectedSymptoms: expectedSymptomsForPhase(insights.todayPhase),
    recommendedActions: recommendedActionsForPhase(insights.todayPhase),
    history: db.cycles[user.id] || []
  });
});

app.post("/api/cycle", requireAuth, async (req, res) => {
  const { lastPeriod, cycleLength } = req.body;
  if (!lastPeriod) return res.status(400).json({ error: "Last period date required" });
  const db = await readDb();
  const user = db.users.find((item) => item.id === req.auth.id);
  if (!user) return res.status(403).json({ error: "Only users have cycle tracking" });
  const previousStart = user.lastPeriod;
  user.lastPeriod = lastPeriod;
  user.cycleLength = Number(cycleLength) || daysBetween(previousStart, lastPeriod);
  db.cycles[user.id] = [...(db.cycles[user.id] || []), { startDate: lastPeriod, cycleLength: user.cycleLength }];
  logActivity(db, user.id, "cycle-update", `Cycle updated: ${lastPeriod}, ${user.cycleLength} days`);
  await writeDb(db);
  const insights = smartCyclePrediction(db, user);
  res.json({ cycle: calculateCycle(user.lastPeriod, user.cycleLength), insights });
});

app.get("/api/analytics/:userId", requireAuth, asyncRoute(async (req, res) => {
  const db = await readDb();
  if (req.auth.role === "user" && req.auth.id !== req.params.userId) {
    return res.status(403).json({ error: "Cannot view another user's analytics" });
  }
  const user = db.users.find((account) => account.id === req.params.userId);
  if (!user) return res.status(404).json({ error: "User not found" });
  const sharedOnly = req.auth.role === "doctor";
  res.json({
    analytics: symptomAnalytics(db, user.id, sharedOnly),
    prediction: smartCyclePrediction(db, user)
  });
}));

app.post("/api/insights", requireAuth, asyncRoute(async (req, res) => {
  const db = await readDb();
  const userId = req.auth.role === "doctor" ? req.body.userId : req.auth.id;
  if (!userId) return res.status(400).json({ error: "User required" });
  const user = db.users.find((account) => account.id === userId);
  if (!user) return res.status(404).json({ error: "User not found" });
  if (req.auth.role === "doctor") {
    const details = buildPatientDetails(db, user);
    return res.json({ ...generateInsightList(db, user, true), sharedSymptoms: details.symptomHistory });
  }
  res.json(generateInsightList(db, user, false));
}));

app.get("/api/profile/history", requireAuth, asyncRoute(async (req, res) => {
  if (req.auth.role !== "user") return res.status(403).json({ error: "Only users have profile history" });
  const db = await readDb();
  const user = db.users.find((account) => account.id === req.auth.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({
    cycleHistory: cycleStarts(db, user),
    symptomAnalytics: symptomAnalytics(db, user.id, false),
    reports: generateInsightList(db, user).insights
  });
}));

app.get("/api/patients", requireAuth, requireDoctor, async (req, res) => {
  const db = await readDb();
  const patients = db.users.map((user) => buildPatientSummary(db, user));
  const now = Date.now();
  const totalPatients = patients.length;
  const activePatients = patients.filter((patient) => (now - new Date(patient.lastActivity).getTime()) / 86400000 <= 14).length;
  const highRiskPatients = patients.filter((patient) => patient.riskLevel === "High").length;
  const newPatients = patients.filter((patient) => (now - new Date(patient.createdAt).getTime()) / 86400000 <= 7).length;
  const conditions = [...new Set(patients.map((patient) => patient.condition))];
  const alerts = patients.flatMap((patient) =>
    patient.riskReasons.map((reason) => ({
      id: `${patient.id}_${reason.replace(/\W+/g, "_").toLowerCase()}`,
      patientId: patient.id,
      patientName: patient.name,
      riskLevel: patient.riskLevel,
      message: reason,
      createdAt: patient.lastActivity
    }))
  );

  res.json({
    summary: { totalPatients, activePatients, highRiskPatients, newPatients },
    patients,
    conditions,
    alerts
  });
});

app.get("/api/doctor/insights", requireAuth, requireDoctor, asyncRoute(async (req, res) => {
  const db = await readDb();
  const patients = db.users.map((user) => {
    const summary = buildPatientSummary(db, user);
    const analytics = symptomAnalytics(db, user.id, true);
    return { ...summary, analytics };
  });
  const inactiveUsers = patients.filter((patient) => patient.riskReasons.includes("No activity for over 30 days"));
  const highRiskPatients = patients.filter((patient) => patient.riskLevel === "High");
  const highPainAlerts = patients.flatMap((patient) =>
    patient.analytics.highPainAlerts.map((entry) => ({
      patientId: patient.id,
      patientName: patient.name,
      date: entry.date,
      painLevel: entry.painLevel
    }))
  );
  const frequentSymptoms = patients.flatMap((patient) =>
    patient.analytics.frequency.slice(0, 3).map((item) => ({
      patientId: patient.id,
      patientName: patient.name,
      symptom: item.symptom,
      count: item.count
    }))
  );
  res.json({ highRiskPatients, inactiveUsers, highPainAlerts, frequentSymptoms });
}));

app.get("/api/patient/:id", requireAuth, requireDoctor, async (req, res) => {
  const db = await readDb();
  const patient = db.users.find((user) => user.id === req.params.id);
  if (!patient) return res.status(404).json({ error: "Patient not found" });
  res.json({ patient: buildPatientDetails(db, patient) });
});

app.get("/api/doctor/chats", requireAuth, requireDoctor, asyncRoute(async (req, res) => {
  const db = await readDb();
  const chats = db.chats
    .filter((chat) => chat.doctorId === req.auth.id)
    .map((chat) => {
      const patient = db.users.find((user) => user.id === chat.userId);
      const messages = Array.isArray(chat.messages) ? chat.messages : [];
      const lastMessage = messages[messages.length - 1] || null;
      return {
        chatId: chat.chatId,
        doctorId: chat.doctorId,
        userId: chat.userId,
        patient: patient ? buildPatientSummary(db, patient) : null,
        lastMessage,
        updatedAt: chat.updatedAt
      };
    })
    .filter((chat) => chat.patient)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  res.json({ chats });
}));

app.post("/api/patient/message", requireAuth, requireDoctor, async (req, res) => {
  const { patientId, message } = req.body;
  if (!patientId || !message) return res.status(400).json({ error: "Patient and message are required" });
  const db = await readDb();
  const patient = db.users.find((user) => user.id === patientId);
  if (!patient) return res.status(404).json({ error: "Patient not found" });
  const item = {
    id: `msg_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    patientId,
    doctorId: req.auth.id,
    message,
    createdAt: new Date().toISOString()
  };
  db.patientMessages.push(item);
  logActivity(db, patientId, "doctor-message", "Doctor sent a message");
  await writeDb(db);
  res.status(201).json({ message: item });
});

app.post("/api/patient/recommendation", requireAuth, requireDoctor, async (req, res) => {
  const { patientId, recommendation, followUpDate } = req.body;
  if (!patientId || !recommendation) return res.status(400).json({ error: "Patient and recommendation are required" });
  const db = await readDb();
  const patient = db.users.find((user) => user.id === patientId);
  if (!patient) return res.status(404).json({ error: "Patient not found" });
  const item = {
    id: `rec_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    patientId,
    doctorId: req.auth.id,
    recommendation,
    followUpDate: followUpDate || null,
    createdAt: new Date().toISOString()
  };
  db.patientRecommendations.push(item);
  if (followUpDate) {
    db.followUps.push({
      id: `follow_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      patientId,
      doctorId: req.auth.id,
      date: followUpDate,
      status: "scheduled",
      createdAt: new Date().toISOString()
    });
  }
  logActivity(db, patientId, "doctor-recommendation", "Doctor added a recommendation");
  await writeDb(db);
  res.status(201).json({ recommendation: item });
});

app.get("/api/symptom-options", requireAuth, asyncRoute(async (req, res) => {
  const db = await readDb();
  res.json({ symptoms: db.symptomOptions });
}));

app.post("/api/symptoms", requireAuth, asyncRoute(async (req, res) => {
  if (req.auth.role !== "user") return res.status(403).json({ error: "Only users can log symptoms" });
  const { date, symptoms = [], painLevel, notes = "", sharedWithDoctor = false } = req.body;
  const entryDate = date || new Date().toISOString().slice(0, 10);
  const parsedPain = Number(painLevel);
  if (!Array.isArray(symptoms) || symptoms.length === 0) {
    return res.status(400).json({ error: "Select at least one symptom" });
  }
  if (!Number.isFinite(parsedPain) || parsedPain < 1 || parsedPain > 10) {
    return res.status(400).json({ error: "Pain level must be between 1 and 10" });
  }
  const db = await readDb();
  const user = db.users.find((account) => account.id === req.auth.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const cleanedSymptoms = [...new Set(symptoms.map((item) => String(item).trim()).filter(Boolean))];
  const existing = db.symptoms.find((entry) => entry.userId === req.auth.id && entry.date === entryDate);
  const payload = {
    symptomId: existing?.symptomId || `symptom_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    userId: req.auth.id,
    date: entryDate,
    symptoms: cleanedSymptoms,
    painLevel: parsedPain,
    notes: String(notes || "").trim(),
    sharedWithDoctor: Boolean(sharedWithDoctor),
    updatedAt: new Date().toISOString()
  };
  if (existing) Object.assign(existing, payload);
  else db.symptoms.push({ ...payload, createdAt: new Date().toISOString() });
  logActivity(db, req.auth.id, "symptoms", `${cleanedSymptoms.join(", ")} | pain ${parsedPain}/10`);
  await writeDb(db);
  res.status(existing ? 200 : 201).json({ symptom: existing || db.symptoms[db.symptoms.length - 1] });
}));

app.get("/api/symptoms/shared", requireAuth, requireDoctor, asyncRoute(async (req, res) => {
  const db = await readDb();
  const entries = db.symptoms
    .filter((entry) => entry.sharedWithDoctor === true)
    .map((entry) => ({
      ...entry,
      patient: publicAccount(db.users.find((user) => user.id === entry.userId) || {})
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json({ symptoms: entries });
}));

app.get("/api/symptoms/:userId", requireAuth, asyncRoute(async (req, res) => {
  const db = await readDb();
  if (req.auth.role === "user" && req.auth.id !== req.params.userId) {
    return res.status(403).json({ error: "Cannot view another user's symptoms" });
  }
  if (req.auth.role === "doctor" && !db.doctors.some((doctor) => doctor.id === req.auth.id)) {
    return res.status(403).json({ error: "Doctor access required" });
  }
  const entries = db.symptoms
    .filter((entry) => entry.userId === req.params.userId)
    .filter((entry) => req.auth.role === "user" || entry.sharedWithDoctor === true)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json({ symptoms: entries });
}));

app.post("/api/doctor/status", requireAuth, requireDoctor, asyncRoute(async (req, res) => {
  const db = await readDb();
  const doctor = db.doctors.find((account) => account.id === req.auth.id);
  if (!doctor) return res.status(404).json({ error: "Doctor not found" });
  doctor.isOnline = Boolean(req.body.isOnline);
  doctor.lastSeen = new Date().toISOString();
  await writeDb(db);
  res.json({ doctor: publicDoctor(doctor) });
}));

app.post("/api/appointments", requireAuth, asyncRoute(async (req, res) => {
  if (req.auth.role !== "user") return res.status(403).json({ error: "Only users can book appointments" });
  const { doctorId, date, time } = req.body;
  if (!doctorId || !date || !time) return res.status(400).json({ error: "Doctor, date, and time are required" });
  const db = await readDb();
  const doctor = db.doctors.find((account) => account.id === doctorId);
  const patient = db.users.find((account) => account.id === req.auth.id);
  if (!doctor) return res.status(404).json({ error: "Doctor not found" });
  if (!patient) return res.status(404).json({ error: "Patient not found" });
  if (!db.appointmentSlots.includes(time)) return res.status(400).json({ error: "Choose an available time slot" });
  const duplicate = db.appointments.find((item) => item.doctorId === doctorId && item.date === date && item.time === time && item.status === "scheduled");
  if (duplicate) return res.status(409).json({ error: "That appointment slot is already scheduled" });
  const appointment = {
    appointmentId: `appt_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    patientId: req.auth.id,
    doctorId,
    date,
    time,
    status: "scheduled",
    createdAt: new Date().toISOString()
  };
  db.appointments.push(appointment);
  logActivity(db, req.auth.id, "appointment", `Appointment scheduled with ${doctor.name} on ${date} at ${time}`);
  await writeDb(db);
  res.status(201).json({ appointment });
}));

app.get("/api/appointments/doctor/:doctorId", requireAuth, asyncRoute(async (req, res) => {
  if (req.auth.role !== "doctor") {
    return res.status(403).json({ error: "Doctor access required" });
  }
  if (req.auth.role === "doctor" && req.auth.id !== req.params.doctorId) {
    return res.status(403).json({ error: "Cannot view another doctor's appointments" });
  }
  const db = await readDb();
  const appointments = db.appointments
    .filter((item) => item.doctorId === req.params.doctorId)
    .map((item) => ({
      ...item,
      patient: publicAccount(db.users.find((user) => user.id === item.patientId) || {})
    }))
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  res.json({ appointments });
}));

app.get("/api/appointments/user/:userId", requireAuth, asyncRoute(async (req, res) => {
  if (req.auth.role === "user" && req.auth.id !== req.params.userId) {
    return res.status(403).json({ error: "Cannot view another user's appointments" });
  }
  const db = await readDb();
  const appointments = db.appointments
    .filter((item) => item.patientId === req.params.userId)
    .map((item) => ({
      ...item,
      doctor: publicDoctor(db.doctors.find((doctor) => doctor.id === item.doctorId) || {})
    }))
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  res.json({ appointments });
}));

app.get("/api/appointment-slots/:doctorId", requireAuth, asyncRoute(async (req, res) => {
  const db = await readDb();
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: "Date is required" });
  const doctor = db.doctors.find((account) => account.id === req.params.doctorId);
  if (!doctor) return res.status(404).json({ error: "Doctor not found" });
  const booked = db.appointments
    .filter((item) => item.doctorId === doctor.id && item.date === date && item.status === "scheduled")
    .map((item) => item.time);
  res.json({
    slots: db.appointmentSlots.map((time) => ({
      time,
      available: !booked.includes(time)
    }))
  });
}));

app.patch("/api/appointments/:appointmentId", requireAuth, asyncRoute(async (req, res) => {
  const db = await readDb();
  const appointment = db.appointments.find((item) => item.appointmentId === req.params.appointmentId);
  if (!appointment) return res.status(404).json({ error: "Appointment not found" });
  const isPatient = req.auth.role === "user" && appointment.patientId === req.auth.id;
  const isDoctor = req.auth.role === "doctor" && appointment.doctorId === req.auth.id;
  if (!isPatient && !isDoctor) return res.status(403).json({ error: "Cannot update this appointment" });
  const { date, time, status } = req.body;
  if (status && !["scheduled", "cancelled", "completed"].includes(status)) return res.status(400).json({ error: "Invalid appointment status" });
  if (date || time) {
    const nextDate = date || appointment.date;
    const nextTime = time || appointment.time;
    if (!db.appointmentSlots.includes(nextTime)) return res.status(400).json({ error: "Choose an available time slot" });
    const duplicate = db.appointments.find((item) =>
      item.appointmentId !== appointment.appointmentId &&
      item.doctorId === appointment.doctorId &&
      item.date === nextDate &&
      item.time === nextTime &&
      item.status === "scheduled"
    );
    if (duplicate) return res.status(409).json({ error: "That appointment slot is already scheduled" });
    appointment.date = nextDate;
    appointment.time = nextTime;
    appointment.status = "scheduled";
  }
  if (status) appointment.status = status;
  appointment.updatedAt = new Date().toISOString();
  await writeDb(db);
  res.json({ appointment });
}));

app.get("/api/doctors", requireAuth, asyncRoute(async (req, res) => {
  const db = await readDb();
  res.json({ doctors: db.doctors.map(publicDoctor) });
}));

app.get("/api/chat/:doctorId", requireAuth, asyncRoute(async (req, res) => {
  const db = await readDb();
  const doctor = db.doctors.find((account) => account.id === req.params.doctorId);
  if (!doctor) return res.status(404).json({ error: "Doctor not found" });

  const userId = req.auth.role === "doctor" ? req.query.userId : req.auth.id;
  if (!userId) return res.status(400).json({ error: "Patient is required" });
  if (req.auth.role === "doctor" && req.auth.id !== req.params.doctorId) {
    return res.status(403).json({ error: "Cannot access another doctor's chat" });
  }
  const user = db.users.find((account) => account.id === userId);
  if (!user) return res.status(404).json({ error: "Patient not found" });

  let chat = findChat(db, doctor.id, user.id);
  if (!chat) {
    chat = createChat(doctor.id, user.id);
  }
  res.json({ chat: publicChat(db, chat) });
}));

app.post("/api/chat/send", requireAuth, asyncRoute(async (req, res) => {
  const { senderId, receiverId, message, timestamp } = req.body;
  if (!senderId || !receiverId || !String(message || "").trim()) {
    return res.status(400).json({ error: "Sender, receiver, and message are required" });
  }
  if (senderId !== req.auth.id) {
    return res.status(403).json({ error: "Cannot send as another account" });
  }

  const db = await readDb();
  const sender = getAccountById(db, senderId);
  const receiver = getAccountById(db, receiverId);
  if (!sender || !receiver) return res.status(404).json({ error: "Sender or receiver not found" });
  if (sender.role === receiver.role) return res.status(400).json({ error: "Chats must be between a patient and a doctor" });

  const doctorId = sender.role === "doctor" ? senderId : receiverId;
  const userId = sender.role === "user" ? senderId : receiverId;
  let chat = findChat(db, doctorId, userId);
  if (!chat) {
    chat = createChat(doctorId, userId);
    db.chats.push(chat);
  }

  const chatMessage = {
    id: `chatmsg_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    sender: senderId,
    text: String(message).trim(),
    senderId,
    receiverId,
    senderRole: sender.role,
    message: String(message).trim(),
    timestamp: timestamp || new Date().toISOString(),
    status: "delivered",
    seenAt: null
  };
  chat.messages.push(chatMessage);
  chat.typing = { ...(chat.typing || {}), [senderId]: false };
  chat.updatedAt = chatMessage.timestamp;
  logActivity(db, userId, "chat-message", sender.role === "doctor" ? "Doctor replied in chat" : "Patient messaged a doctor");
  await writeDb(db);
  res.status(201).json({ chat: publicChat(db, chat), message: chatMessage });
}));

app.post("/api/chat/typing", requireAuth, asyncRoute(async (req, res) => {
  const { doctorId, userId, isTyping = false } = req.body;
  const db = await readDb();
  const resolvedDoctorId = req.auth.role === "doctor" ? req.auth.id : doctorId;
  const resolvedUserId = req.auth.role === "user" ? req.auth.id : userId;
  if (!resolvedDoctorId || !resolvedUserId) return res.status(400).json({ error: "Doctor and user are required" });
  let chat = findChat(db, resolvedDoctorId, resolvedUserId);
  if (!chat) {
    chat = createChat(resolvedDoctorId, resolvedUserId);
    db.chats.push(chat);
  }
  chat.typing = { ...(chat.typing || {}), [req.auth.id]: Boolean(isTyping) };
  chat.updatedAt = new Date().toISOString();
  await writeDb(db);
  res.json({ chat: publicChat(db, chat) });
}));

app.post("/api/chat/seen", requireAuth, asyncRoute(async (req, res) => {
  const { doctorId, userId } = req.body;
  const db = await readDb();
  const resolvedDoctorId = req.auth.role === "doctor" ? req.auth.id : doctorId;
  const resolvedUserId = req.auth.role === "user" ? req.auth.id : userId;
  const chat = findChat(db, resolvedDoctorId, resolvedUserId);
  if (!chat) return res.json({ message: "No chat yet" });
  const now = new Date().toISOString();
  chat.messages = (chat.messages || []).map((item) => {
    if (item.receiverId === req.auth.id && !item.seenAt) {
      return { ...item, status: "seen", seenAt: now };
    }
    return item;
  });
  chat.updatedAt = now;
  await writeDb(db);
  res.json({ chat: publicChat(db, chat) });
}));

app.get("/api/education", requireAuth, async (req, res) => {
  const db = await readDb();
  res.json({ education: db.education });
});

app.get([
  "/",
  "/login",
  "/signup",
  "/app",
  "/shop",
  "/cart",
  "/checkout",
  "/doctor-dashboard.html",
  "/dashboard-page",
  "/cart-page",
  "/guidance"
], (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Menstrumate running on http://localhost:${PORT}`);
});
