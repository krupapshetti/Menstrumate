const express = require("express");
const router = express.Router();

const { requireAuth, requireDoctor } = require("../middleware/authMiddleware");
const asyncRoute = require("../middleware/asyncMiddleware");

const { readDb, writeDb } = require("../services/db");

const {
  calculateCycle,
  smartCyclePrediction,
  expectedSymptomsForPhase,
  recommendedActionsForPhase,
  daysBetween,
  cycleStarts,
  symptomAnalytics,
  generateInsightList,
  buildPatientDetails,
  logActivity
} = require("../utils/cycle");

// Helper function
function addDays(dateText, days) {
  const date = new Date(dateText);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function getPhaseTips(phase) {
  const tips = {
    Menstruation: ["Rest more than usual", "Use heat therapy for cramps", "Stay hydrated", "Iron-rich foods help with fatigue"],
    Follicular: ["Energy levels are rising - great time for exercise", "Skin may be clearer", "Good time for social activities", "Focus on complex carbohydrates"],
    Ovulation: ["Highest energy of the month", "Libido may be increased", "Great time for important meetings", "Stay protected if not planning pregnancy"],
    Luteal: ["You might crave comfort foods - that's normal", "Gentle exercise helps with mood", "Practice stress reduction techniques", "Get extra sleep if possible"]
  };
  return tips[phase] || ["Listen to your body and rest when needed"];
}

// ==================== GET CURRENT CYCLE ====================
router.get(
  "/",
  requireAuth,
  asyncRoute(async (req, res) => {
    if (req.auth.role !== "user") {
      return res.status(403).json({ success: false, error: "Only users have cycle tracking" });
    }

    const db = await readDb();
    const user = db.users.find((item) => item.id === req.auth.id);

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const insights = smartCyclePrediction(db, user);
    const currentCycle = calculateCycle(user.lastPeriod, user.cycleLength);
    const nextPeriodDate = insights.nextPeriod;
    const daysUntilPeriod = Math.max(0, Math.round((new Date(nextPeriodDate) - new Date()) / 86400000));

    res.json({
      success: true,
      insights,
      cycle: currentCycle,
      expectedSymptoms: expectedSymptomsForPhase(insights.todayPhase),
      recommendedActions: recommendedActionsForPhase(insights.todayPhase),
      history: db.cycles[user.id] || [],
      summary: {
        lastPeriod: user.lastPeriod,
        cycleLength: user.cycleLength,
        nextPeriod: nextPeriodDate,
        daysUntilPeriod,
        currentPhase: insights.todayPhase,
        dayInCycle: insights.dayInCycle,
        isIrregular: insights.irregularCycle
      }
    });
  })
);

// ==================== UPDATE CYCLE ====================
router.post(
  "/",
  requireAuth,
  asyncRoute(async (req, res) => {
    if (req.auth.role !== "user") {
      return res.status(403).json({ success: false, error: "Only users can update cycle tracking" });
    }

    const { lastPeriod, cycleLength } = req.body;

    if (!lastPeriod) {
      return res.status(400).json({ success: false, error: "Last period date is required" });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(lastPeriod)) {
      return res.status(400).json({ success: false, error: "Invalid date format. Use YYYY-MM-DD" });
    }

    const periodDate = new Date(lastPeriod);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (periodDate > today) {
      return res.status(400).json({ success: false, error: "Last period date cannot be in the future" });
    }

    const db = await readDb();
    const user = db.users.find((item) => item.id === req.auth.id);

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const previousStart = user.lastPeriod;
    const oldCycleLength = user.cycleLength;

    user.lastPeriod = lastPeriod;
    user.cycleLength = Number(cycleLength) || daysBetween(previousStart, lastPeriod);
    user.updatedAt = new Date().toISOString();

    const cycleEntry = {
      startDate: lastPeriod,
      cycleLength: user.cycleLength,
      recordedAt: new Date().toISOString(),
      previousCycleLength: oldCycleLength
    };

    db.cycles[user.id] = [...(db.cycles[user.id] || []), cycleEntry];

    logActivity(db, user.id, "cycle-update", `Cycle updated: ${lastPeriod}, ${user.cycleLength} days (was ${oldCycleLength} days)`);
    await writeDb(db);

    const insights = smartCyclePrediction(db, user);
    const currentCycle = calculateCycle(user.lastPeriod, user.cycleLength);

    res.json({
      success: true,
      message: "Cycle updated successfully",
      cycle: currentCycle,
      insights,
      lastUpdated: cycleEntry.recordedAt
    });
  })
);

// ==================== GET CYCLE HISTORY ====================
router.get(
  "/history",
  requireAuth,
  asyncRoute(async (req, res) => {
    if (req.auth.role !== "user") {
      return res.status(403).json({ success: false, error: "Only users can view cycle history" });
    }

    const db = await readDb();
    const user = db.users.find((account) => account.id === req.auth.id);

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const cycleHistory = cycleStarts(db, user);
    const analytics = symptomAnalytics(db, user.id, false);
    const insights = generateInsightList(db, user, false);

    const avgCycleLength = cycleHistory.length > 0
      ? Math.round(cycleHistory.reduce((sum, item) => sum + item.cycleLength, 0) / cycleHistory.length)
      : user.cycleLength;

    res.json({
      success: true,
      cycleHistory: cycleHistory.map((item, index) => ({
        ...item,
        cycleNumber: index + 1,
        predictedNextPeriod: addDays(item.startDate, item.cycleLength)
      })),
      symptomAnalytics: {
        frequency: analytics.frequency,
        averagePain: analytics.averagePain,
        highPainDays: analytics.highPainAlerts.length,
        totalEntries: analytics.entries.length
      },
      insights: insights.insights,
      stats: {
        totalCyclesTracked: cycleHistory.length,
        averageCycleLength: avgCycleLength,
        currentCycleLength: user.cycleLength,
        trackingSince: user.createdAt
      }
    });
  })
);

// ==================== GET INSIGHTS ====================
router.post(
  "/insights",
  requireAuth,
  asyncRoute(async (req, res) => {
    const db = await readDb();
    const userId = req.auth.role === "doctor" ? req.body.userId : req.auth.id;

    if (!userId) {
      return res.status(400).json({ success: false, error: "User ID is required" });
    }

    const user = db.users.find((account) => account.id === userId);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const isDoctor = req.auth.role === "doctor";
    const insightData = generateInsightList(db, user, isDoctor);

    const response = {
      success: true,
      insights: insightData.insights,
      prediction: insightData.prediction,
      analytics: {
        frequentSymptoms: insightData.analytics.frequency.slice(0, 5),
        averagePain: insightData.analytics.averagePain,
        painTrend: insightData.analytics.painTrend.slice(-7)
      }
    };

    if (isDoctor) {
      const details = buildPatientDetails(db, user);
      response.sharedSymptoms = details.symptomHistory;
      response.patientSummary = {
        name: user.name,
        email: user.email,
        lastPeriod: user.lastPeriod,
        cycleLength: user.cycleLength
      };
    }

    res.json(response);
  })
);

// ==================== GET ANALYTICS ====================
router.get(
  "/analytics/:userId",
  requireAuth,
  asyncRoute(async (req, res) => {
    const db = await readDb();

    if (req.auth.role === "user" && req.auth.id !== req.params.userId) {
      return res.status(403).json({ success: false, error: "Cannot view another user's analytics" });
    }

    const user = db.users.find((account) => account.id === req.params.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const sharedOnly = req.auth.role === "doctor";
    const analytics = symptomAnalytics(db, user.id, sharedOnly);
    const prediction = smartCyclePrediction(db, user);

    const symptomFrequencyChart = analytics.frequency.map(item => ({ name: item.symptom, value: item.count }));
    const painTrendChart = analytics.painTrend.map(point => ({ date: point.date, painLevel: point.painLevel }));
    const recentPain = analytics.painTrend.slice(-7);
    const painTrendDirection = recentPain.length >= 2 ? recentPain[recentPain.length - 1].painLevel - recentPain[0].painLevel : 0;

    res.json({
      success: true,
      summary: {
        totalEntries: analytics.entries.length,
        averagePain: analytics.averagePain,
        highPainDays: analytics.highPainAlerts.length,
        mostFrequentSymptom: analytics.frequency[0]?.symptom || "None",
        painTrend: painTrendDirection > 0 ? "increasing" : painTrendDirection < 0 ? "decreasing" : "stable"
      },
      analytics: {
        frequency: analytics.frequency,
        painTrend: analytics.painTrend,
        highPainAlerts: analytics.highPainAlerts
      },
      charts: { symptomFrequency: symptomFrequencyChart, painTrend: painTrendChart },
      prediction: {
        nextPeriod: prediction.nextPeriod,
        ovulation: prediction.ovulation,
        fertileWindow: { start: prediction.fertileStart, end: prediction.fertileEnd },
        confidence: prediction.predictionConfidence,
        isIrregular: prediction.irregularCycle,
        currentPhase: prediction.todayPhase,
        dayInCycle: prediction.dayInCycle
      }
    });
  })
);

// ==================== GET PHASE INFORMATION ====================
router.get(
  "/phase/:phase",
  requireAuth,
  asyncRoute(async (req, res) => {
    const { phase } = req.params;
    const validPhases = ["Menstruation", "Follicular", "Ovulation", "Luteal"];

    if (!validPhases.includes(phase)) {
      return res.status(400).json({ success: false, error: "Invalid phase" });
    }

    res.json({
      success: true,
      phase,
      expectedSymptoms: expectedSymptomsForPhase(phase),
      recommendedActions: recommendedActionsForPhase(phase),
      tips: getPhaseTips(phase)
    });
  })
);

// ==================== PREDICT NEXT PERIOD ====================
router.get(
  "/predict",
  requireAuth,
  asyncRoute(async (req, res) => {
    if (req.auth.role !== "user") {
      return res.status(403).json({ success: false, error: "Only users can predict cycles" });
    }

    const db = await readDb();
    const user = db.users.find((account) => account.id === req.auth.id);

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const prediction = smartCyclePrediction(db, user);
    const today = new Date().toISOString().slice(0, 10);
    const daysUntil = Math.round((new Date(prediction.nextPeriod) - new Date(today)) / 86400000);

    res.json({
      success: true,
      nextPeriodDate: prediction.nextPeriod,
      daysUntil,
      confidence: prediction.predictionConfidence,
      isIrregular: prediction.irregularCycle,
      averageCycleLength: prediction.averageCycleLength,
      variability: prediction.variabilityDays,
      ovulationDate: prediction.ovulation,
      fertileWindow: { start: prediction.fertileStart, end: prediction.fertileEnd }
    });
  })
);

module.exports = router;