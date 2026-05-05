const express = require("express");
const bcrypt = require("bcrypt");

const router = express.Router();

const asyncRoute = require("../middleware/asyncMiddleware");
const { requireAuth } = require("../middleware/authMiddleware");

const { readDb, writeDb } = require("../services/db");

const { requireFields } = require("../utils/validators");
const { logActivity } = require("../utils/activity");

const {
  createToken,
  publicAccount,
  publicDoctor
} = require("../utils/auth");

// ==================== REQUEST OTP ====================
router.post(
  "/request-otp",
  asyncRoute(async (req, res) => {
    const { email, role } = req.body;

    if (!email || !["user", "doctor"].includes(role)) {
      return res.status(400).json({ error: "Valid email and role required" });
    }

    const db = await readDb();

    const otp = String(Math.floor(100000 + Math.random() * 900000));

    db.otps = db.otps.filter(
      (item) => !(item.email === email.toLowerCase() && item.role === role)
    );

    db.otps.push({
      email: email.toLowerCase(),
      role,
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000
    });

    await writeDb(db);

    res.json({
      success: true,
      message: "OTP generated successfully",
      otp
    });
  })
);

// ==================== SIGNUP ====================
router.post(
  "/signup",
  asyncRoute(async (req, res) => {
    const {
      role,
      name,
      email,
      otp,
      password,
      confirmPassword,
      specialty,
      specialization,
      experience,
      clinic,
      cycleLength,
      lastPeriod
    } = req.body;

    const requiredError = requireFields(req.body, [
      "role",
      "name",
      "email",
      "otp",
      "password",
      "confirmPassword"
    ]);

    if (requiredError) {
      return res.status(400).json({ error: requiredError });
    }

    if (!["user", "doctor"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const doctorSpecialty = String(specialization || specialty || "").trim();
    if (role === "doctor" && !doctorSpecialty) {
      return res.status(400).json({ error: "Specialization is required for doctors" });
    }

    const db = await readDb();
    const normalizedEmail = email.toLowerCase();
    const listName = role === "doctor" ? "doctors" : "users";

    if (db[listName].some((account) => account.email === normalizedEmail)) {
      return res.status(409).json({ error: "Account already exists" });
    }

    const otpRecord = db.otps.find(
      (item) =>
        item.email === normalizedEmail &&
        item.role === role &&
        item.otp === otp
    );

    if (!otpRecord || otpRecord.expiresAt < Date.now()) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    const account = {
      id: `${role}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      role,
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, 10),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (role === "doctor") {
      account.specialty = doctorSpecialty;
      account.isOnline = true;
      account.lastSeen = new Date().toISOString();
    } else {
      account.cycleLength = Number(cycleLength) || 28;
      account.lastPeriod = lastPeriod || new Date().toISOString().slice(0, 10);

      db.cycles[account.id] = [];
      logActivity(db, account.id, "signup", "Patient account created");
    }

    db[listName].push(account);
    db.otps = db.otps.filter((item) => item !== otpRecord);

    await writeDb(db);

    const publicData =
      role === "doctor"
        ? publicDoctor(account)
        : publicAccount(account);

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      token: createToken(account), // ✅ FIXED
      account: publicData,
      user: publicData
    });
  })
);

// ==================== LOGIN ====================
router.post(
  "/login",
  asyncRoute(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required"
      });
    }

    const db = await readDb();

    let account =
      db.users.find((u) => u.email === email.toLowerCase()) ||
      db.doctors.find((d) => d.email === email.toLowerCase());

    if (!account || !(await bcrypt.compare(password, account.passwordHash))) {
      return res.status(401).json({
        error: "Invalid email or password"
      });
    }

    if (account.role === "doctor") {
      account.isOnline = true;
      account.lastSeen = new Date().toISOString();
      await writeDb(db);
    }

    const publicData =
      account.role === "doctor"
        ? publicDoctor(account)
        : publicAccount(account);

    res.json({
      success: true,
      message: "Login successful",
      token: createToken(account), // ✅ FIXED
      account: publicData,
      user: publicData
    });
  })
);

// ==================== LOGOUT ====================
router.post(
  "/logout",
  requireAuth,
  asyncRoute(async (req, res) => {
    const db = await readDb();

    if (req.auth.role === "doctor") {
      const doctor = db.doctors.find((d) => d.id === req.auth.id);
      if (doctor) {
        doctor.isOnline = false;
        doctor.lastSeen = new Date().toISOString();
        await writeDb(db);
      }
    }

    res.json({
      success: true,
      message: "Logged out successfully"
    });
  })
);

// ==================== REFRESH TOKEN ====================
router.post(
  "/refresh-token",
  requireAuth,
  asyncRoute(async (req, res) => {
    const db = await readDb();

    let account =
      db.users.find((u) => u.id === req.auth.id) ||
      db.doctors.find((d) => d.id === req.auth.id);

    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    const newToken = createToken(account); // ✅ FIXED

    res.json({
      success: true,
      token: newToken
    });
  })
);

module.exports = router;