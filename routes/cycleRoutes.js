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
  logActivity,
  // New enhanced functions
  getSymptomSeverity,
  getPersonalizedExpectedSymptoms,
  getPredictionConfidenceLevel,
  getPreventiveActions,
  getSymptomTrends,
  getSeasonalTrends,
  getEnhancedExpectedSymptoms
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

    // Get user's cycle history from cycles array
    let userCycles = [];
    if (db.cycles && Array.isArray(db.cycles)) {
      userCycles = db.cycles.filter(c => c.userId === req.auth.id);
    } else if (db.cycles && typeof db.cycles === 'object') {
      userCycles = db.cycles[req.auth.id] || [];
    }

    res.json({
      success: true,
      insights,
      cycle: currentCycle,
      expectedSymptoms: expectedSymptomsForPhase(insights.todayPhase),
      recommendedActions: recommendedActionsForPhase(insights.todayPhase),
      history: userCycles,
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

    const { lastPeriod, cycleLength, force = false } = req.body;

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

    const previousLastPeriod = user.lastPeriod;
    let autoRemoved = false;
    let removeMessage = "";

    // ========== VALIDATION RULES ==========
    if (previousLastPeriod) {
      const previousDate = new Date(previousLastPeriod);
      const newDate = new Date(lastPeriod);
      const daysDifference = Math.round((newDate - previousDate) / (1000 * 60 * 60 * 24));
      
      // Rule 1: NO NEGATIVE DATES - Prevent going backwards
      if (daysDifference < 0) {
        return res.status(400).json({
          success: false,
          error: `Cannot set period date before previous period (${previousLastPeriod}). Please enter a date after your last period.`
        });
      }
      
      // Rule 2: If difference is less than 15 days (too short for a normal cycle)
      if (daysDifference > 0 && daysDifference < 15) {
        if (!force) {
          return res.status(409).json({
            success: false,
            requiresForce: true,
            warning: `Only ${daysDifference} days since your last period (${previousLastPeriod}).`,
            suggestion: "This is unusually short for a menstrual cycle. If this is correct, confirm to proceed.",
            newData: { lastPeriod, cycleLength: cycleLength || daysDifference }
          });
        } else {
          console.log(`⚠️ Unusually short cycle: ${daysDifference} days (user confirmed)`);
        }
      }
      
      // Rule 3: If difference is more than 60 days
      if (daysDifference > 60) {
        if (!force) {
          return res.status(409).json({
            success: false,
            requiresForce: true,
            warning: `${daysDifference} days since your last period.`,
            suggestion: "This is longer than typical. If your cycle is irregular, confirm to proceed.",
            newData: { lastPeriod, cycleLength: cycleLength || daysDifference }
          });
        }
      }
    }

    // ========== CYCLE LENGTH CALCULATION - FIXED ==========
    let newCycleLength = cycleLength;
    let calculatedLength = null;
    
    if (previousLastPeriod) {
      const prevDate = new Date(previousLastPeriod);
      const newDate = new Date(lastPeriod);
      const diffTime = Math.abs(newDate - prevDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      calculatedLength = diffDays;
      console.log(`📊 Date difference: ${previousLastPeriod} to ${lastPeriod} = ${calculatedLength} days`);
    }
    
    // Determine final cycle length
    if (newCycleLength && !isNaN(newCycleLength)) {
      if (newCycleLength < 20 || newCycleLength > 45) {
        return res.status(400).json({
          success: false,
          error: "Cycle length must be between 20 and 45 days"
        });
      }
      console.log(`📊 Using user-provided cycle length: ${newCycleLength} days`);
    } else if (calculatedLength && calculatedLength >= 20 && calculatedLength <= 45) {
      newCycleLength = calculatedLength;
      console.log(`📊 Using calculated cycle length: ${newCycleLength} days`);
    } else if (calculatedLength && calculatedLength > 0 && calculatedLength < 20) {
      newCycleLength = calculatedLength;
      if (!force) {
        return res.status(409).json({
          success: false,
          requiresForce: true,
          warning: `This creates a ${calculatedLength}-day cycle (unusually short).`,
          suggestion: "If this is correct (e.g., irregular cycle), confirm to proceed.",
          newData: { lastPeriod, cycleLength: calculatedLength }
        });
      }
    } else if (calculatedLength && calculatedLength > 45 && calculatedLength <= 90) {
      newCycleLength = calculatedLength;
      if (!force) {
        return res.status(409).json({
          success: false,
          requiresForce: true,
          warning: `This creates a ${calculatedLength}-day cycle (longer than typical).`,
          suggestion: "If your cycle is irregular, confirm to proceed.",
          newData: { lastPeriod, cycleLength: calculatedLength }
        });
      }
    } else {
      newCycleLength = (user.cycleLength && user.cycleLength >= 20 && user.cycleLength <= 45) ? user.cycleLength : 28;
      console.log(`⚠️ Using fallback cycle length: ${newCycleLength} days`);
    }
    
    if (!newCycleLength || newCycleLength < 20) {
      newCycleLength = 28;
      console.log(`🔄 Reset invalid cycle length to default: 28 days`);
    }
    
    newCycleLength = Math.min(45, Math.max(20, Math.round(newCycleLength)));
    console.log(`✅ Final cycle length: ${newCycleLength} days`);

    // Update user profile
    user.lastPeriod = lastPeriod;
    user.cycleLength = newCycleLength;
    user.updatedAt = new Date().toISOString();

    // Ensure cycles collection is an array
    if (!db.cycles) {
      db.cycles = [];
    }
    if (!Array.isArray(db.cycles)) {
      db.cycles = [];
    }
    
    const cycleEntry = {
      id: Date.now(),
      userId: req.auth.id,
      startDate: lastPeriod,
      cycleLength: newCycleLength,
      calculatedFrom: calculatedLength,
      recordedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    db.cycles.push(cycleEntry);
    console.log(`✅ Cycle saved: ${lastPeriod} (${newCycleLength} days)`);

    if (typeof logActivity === 'function') {
      logActivity(db, user.id, "cycle-update", `Cycle updated: ${lastPeriod}, ${newCycleLength} days`);
    }
    
    await writeDb(db);

    const insights = smartCyclePrediction(db, user);
    const currentCycle = calculateCycle(user.lastPeriod, user.cycleLength);

    const responseMessage = autoRemoved 
      ? `Cycle updated successfully. ${removeMessage}`
      : "Cycle updated successfully";

    res.json({
      success: true,
      message: responseMessage,
      data: {
        cycle: currentCycle,
        insights,
        user: {
          lastPeriod: user.lastPeriod,
          cycleLength: user.cycleLength
        }
      },
      lastUpdated: cycleEntry.recordedAt,
      autoRemoved: autoRemoved,
      calculatedLength: calculatedLength
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

    let userCycles = [];
    if (db.cycles && Array.isArray(db.cycles)) {
      userCycles = db.cycles.filter(c => c.userId === req.auth.id);
    } else if (db.cycles && typeof db.cycles === 'object') {
      userCycles = db.cycles[req.auth.id] || [];
    }
    
    const cycleHistory = userCycles.map(cycle => ({
      startDate: cycle.startDate,
      cycleLength: cycle.cycleLength,
      recordedAt: cycle.recordedAt
    }));

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
    const requestedUserId = req.params.userId;
    
    let userId;
    if (typeof requestedUserId === 'string' && requestedUserId.startsWith('user_')) {
      userId = requestedUserId;
    } else {
      userId = parseInt(requestedUserId);
    }

    if (req.auth.role === "user" && req.auth.id !== userId) {
      return res.status(403).json({ 
        success: false, 
        error: "Cannot view another user's analytics" 
      });
    }

    const user = db.users.find((account) => account.id === userId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: "User not found" 
      });
    }

    const sharedOnly = req.auth.role === "doctor";
    const analytics = symptomAnalytics(db, user.id, sharedOnly);
    const prediction = smartCyclePrediction(db, user);

    const symptomFrequencyChart = analytics.frequency.map(item => ({ 
      name: item.symptom, 
      value: item.count 
    }));
    
    const painTrendChart = analytics.painTrend.map(point => ({ 
      date: point.date, 
      painLevel: point.painLevel 
    }));
    
    const recentPain = analytics.painTrend.slice(-7);
    const painTrendDirection = recentPain.length >= 2 
      ? recentPain[recentPain.length - 1].painLevel - recentPain[0].painLevel 
      : 0;

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
      charts: { 
        symptomFrequency: symptomFrequencyChart, 
        painTrend: painTrendChart 
      },
      prediction: {
        nextPeriod: prediction.nextPeriod,
        ovulation: prediction.ovulation,
        fertileWindow: { 
          start: prediction.fertileStart, 
          end: prediction.fertileEnd 
        },
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

// ==================== ENHANCED EXPECTED SYMPTOMS (NEW) ====================
router.get(
  "/enhanced-symptoms",
  requireAuth,
  asyncRoute(async (req, res) => {
    if (req.auth.role !== "user") {
      return res.status(403).json({ success: false, error: "Only users can view symptoms" });
    }

    const db = await readDb();
    const user = db.users.find((item) => item.id === req.auth.id);
    
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const insights = smartCyclePrediction(db, user);
    const enhancedSymptoms = getEnhancedExpectedSymptoms(
      db, 
      user.id, 
      insights.todayPhase, 
      insights.averageCycleLength || user.cycleLength
    );
    
    const symptomTrends = getSymptomTrends(db, user.id, user.cycleLength);
    const seasonalTrends = getSeasonalTrends(db, user.id);

    res.json({
      success: true,
      data: {
        phase: insights.todayPhase,
        dayInCycle: insights.dayInCycle,
        enhancedSymptoms,
        symptomTrends,
        seasonalTrends
      }
    });
  })
);

// ==================== GET SYMPTOM TRENDS (NEW) ====================
router.get(
  "/symptom-trends",
  requireAuth,
  asyncRoute(async (req, res) => {
    if (req.auth.role !== "user") {
      return res.status(403).json({ success: false, error: "Only users can view trends" });
    }

    const db = await readDb();
    const user = db.users.find((item) => item.id === req.auth.id);
    
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const trends = getSymptomTrends(db, user.id, user.cycleLength);

    res.json({
      success: true,
      data: trends
    });
  })
);

// ==================== GET SEASONAL TRENDS (NEW) ====================
router.get(
  "/seasonal-trends",
  requireAuth,
  asyncRoute(async (req, res) => {
    if (req.auth.role !== "user") {
      return res.status(403).json({ success: false, error: "Only users can view trends" });
    }

    const db = await readDb();
    const user = db.users.find((item) => item.id === req.auth.id);
    
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const seasonal = getSeasonalTrends(db, user.id);

    res.json({
      success: true,
      data: seasonal
    });
  })
);

module.exports = router;