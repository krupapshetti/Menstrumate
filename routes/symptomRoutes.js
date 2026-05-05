const express = require("express");

const router = express.Router();

const {
  requireAuth,
  requireDoctor
} = require("../middleware/authMiddleware");

const asyncRoute = require("../middleware/asyncMiddleware");

const {
  readDb,
  writeDb
} = require("../services/db");

const {
  logActivity,
  publicAccount
} = require("../utils/helpers");


// ==================== LOG SYMPTOMS ====================
// POST /api/symptoms
router.post(
  "/",
  requireAuth,
  asyncRoute(async (req, res) => {
    if (req.auth.role !== "user") {
      return res.status(403).json({
        success: false,
        error: "Only users can log symptoms"
      });
    }

    const {
      date,
      symptoms = [],
      painLevel,
      notes = "",
      sharedWithDoctor = false
    } = req.body;

    const entryDate = date || new Date().toISOString().slice(0, 10);

    const today = new Date().toISOString().slice(0, 10);
    if (entryDate > today) {
      return res.status(400).json({
        success: false,
        error: "Cannot log symptoms for future dates"
      });
    }

    const parsedPain = Number(painLevel);

    if (!Array.isArray(symptoms) || symptoms.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Select at least one symptom"
      });
    }

    if (symptoms.length > 10) {
      return res.status(400).json({
        success: false,
        error: "Maximum 10 symptoms per entry"
      });
    }

    if (!Number.isFinite(parsedPain) || parsedPain < 0 || parsedPain > 10) {
      return res.status(400).json({
        success: false,
        error: "Pain level must be between 0 and 10"
      });
    }

    const db = await readDb();

    const user = db.users.find(u => u.id === req.auth.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    const cleanedSymptoms = [
      ...new Set(symptoms.map(s => String(s).trim()).filter(Boolean))
    ];

    const existing = db.symptoms.find(
      e => e.userId === req.auth.id && e.date === entryDate
    );

    const payload = {
      symptomId:
        existing?.symptomId ||
        `symptom_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      userId: req.auth.id,
      date: entryDate,
      symptoms: cleanedSymptoms,
      painLevel: parsedPain,
      notes: String(notes || "").trim().substring(0, 500),
      sharedWithDoctor: Boolean(sharedWithDoctor),
      updatedAt: new Date().toISOString()
    };

    if (existing) {
      Object.assign(existing, payload);
    } else {
      db.symptoms.push({
        ...payload,
        createdAt: new Date().toISOString()
      });
    }

    if (user.isFirstLogin) user.isFirstLogin = false;

    logActivity(
      db,
      req.auth.id,
      "symptoms",
      `${cleanedSymptoms.join(", ")} | pain ${parsedPain}/10`
    );

    await writeDb(db);

    res.status(existing ? 200 : 201).json({
      success: true,
      message: existing
        ? "Symptoms updated successfully"
        : "Symptoms logged successfully",
      data: {
        symptom: existing || db.symptoms[db.symptoms.length - 1],
        isUpdate: !!existing
      }
    });
  })
);


// ======================= GET SYMPTOMS ====================
// GET /api/symptoms
router.get(
  "/",
  requireAuth,
  asyncRoute(async (req, res) => {
    if (req.auth.role !== "user") {
      return res.status(403).json({
        success: false,
        error: "Only users can view their symptoms"
      });
    }

    const { startDate, endDate, limit = 30 } = req.query;
    const db = await readDb();

    let entries = db.symptoms
      .filter(e => e.userId === req.auth.id)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (startDate) entries = entries.filter(e => e.date >= startDate);
    if (endDate) entries = entries.filter(e => e.date <= endDate);

    entries = entries.slice(0, parseInt(limit));

    const stats = {
      totalEntries: entries.length,
      averagePain: entries.length
        ? Number(
            (
              entries.reduce((s, e) => s + (e.painLevel || 0), 0) /
              entries.length
            ).toFixed(1)
          )
        : 0,
      mostCommonSymptom: getMostCommonSymptom(entries),
      symptomsSharedCount: entries.filter(e => e.sharedWithDoctor).length,
      highPainDays: entries.filter(e => (e.painLevel || 0) > 7).length
    };

    res.json({
      success: true,
      data: { symptoms: entries, stats, total: entries.length }
    });
  })
);


// ==================== GET BY DATE ====================
// GET /api/symptoms/date/:date
router.get(
  "/date/:date",
  requireAuth,
  asyncRoute(async (req, res) => {
    const db = await readDb();

    const entry = db.symptoms.find(
      e => e.userId === req.auth.id && e.date === req.params.date
    );

    if (!entry) {
      return res.status(404).json({
        success: false,
        error: "No symptoms found for this date"
      });
    }

    res.json({ success: true, data: entry });
  })
);


// ==================== DELETE ====================
// DELETE /api/symptoms/:entryId
router.delete(
  "/:entryId",
  requireAuth,
  asyncRoute(async (req, res) => {
    const db = await readDb();

    const idx = db.symptoms.findIndex(
      e => e.symptomId === req.params.entryId && e.userId === req.auth.id
    );

    if (idx === -1) {
      return res.status(404).json({
        success: false,
        error: "Symptom not found"
      });
    }

    const removed = db.symptoms.splice(idx, 1)[0];

    logActivity(db, req.auth.id, "symptoms-delete", removed.date);

    await writeDb(db);

    res.json({
      success: true,
      message: "Deleted successfully"
    });
  })
);


// ==================== SHARE ====================
// PATCH /api/symptoms/:entryId/share
router.patch(
  "/:entryId/share",
  requireAuth,
  asyncRoute(async (req, res) => {
    const db = await readDb();

    const entry = db.symptoms.find(
      e => e.symptomId === req.params.entryId && e.userId === req.auth.id
    );

    if (!entry) {
      return res.status(404).json({
        success: false,
        error: "Not found"
      });
    }

    entry.sharedWithDoctor = Boolean(req.body.sharedWithDoctor);
    entry.updatedAt = new Date().toISOString();

    await writeDb(db);

    res.json({
      success: true,
      sharedWithDoctor: entry.sharedWithDoctor
    });
  })
);


// ==================== HELPERS ====================
function getMostCommonSymptom(entries) {
  const map = {};

  entries.forEach(e =>
    (e.symptoms || []).forEach(s => {
      map[s] = (map[s] || 0) + 1;
    })
  );

  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

module.exports = router;