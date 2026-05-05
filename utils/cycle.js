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
    if (i < 5) {
      phase = "Menstruation";
    } else if (i < cycleLength - 16) {
      phase = "Follicular";
    } else if (i < cycleLength - 13) {
      phase = "Ovulation";
    }
    cycle.push({
      day: i + 1,
      date: addDays(lastPeriod, i),
      phase
    });
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
    starts.push({
      startDate: user.lastPeriod,
      cycleLength: Number(user.cycleLength) || 28
    });
  }
  return starts.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
}

function smartCyclePrediction(db, user) {
  const starts = cycleStarts(db, user);
  const lengths = starts
    .map((item, index) => {
      if (Number.isFinite(item.cycleLength) && item.cycleLength >= 15) {
        return Number(item.cycleLength);
      }
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

  const phase = calculateCycle(latestStart, averageLength)
    .find((day) => day.day === ((dayInCycle - 1) % averageLength) + 1)?.phase || "Luteal";

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

// ==================== ADD THESE MISSING FUNCTIONS ====================

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

function generateInsightList(db, user, sharedOnly = false) {
  const analytics = symptomAnalytics(db, user.id, sharedOnly);
  const prediction = smartCyclePrediction(db, user);
  const insights = [];
  
  const frequent = analytics.frequency.filter((item) => item.count >= 2);
  const insightRules = db.insightRules || [];
  
  frequent.forEach((item) => {
    const rule = insightRules.find(
      (entry) => entry.symptom.toLowerCase() === item.symptom.toLowerCase()
    );
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

function buildPatientDetails(db, user) {
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
    symptomHistory,
    symptomInsights: {
      frequentSymptoms,
      highPainEntries: symptomHistory.filter((entry) => Number(entry.painLevel) > 7),
      averagePain: symptomHistory.length
        ? Number((symptomHistory.reduce((sum, entry) => sum + Number(entry.painLevel || 0), 0) / symptomHistory.length).toFixed(1))
        : 0
    }
  };
}

function logActivity(db, userId, type, detail) {
  if (!db.activityLogs) db.activityLogs = {};
  if (!db.activityLogs[userId]) db.activityLogs[userId] = [];
  
  db.activityLogs[userId].push({
    id: `activity_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    type,
    detail,
    createdAt: new Date().toISOString()
  });
  
  // Keep last 100 entries
  if (db.activityLogs[userId].length > 100) {
    db.activityLogs[userId] = db.activityLogs[userId].slice(-100);
  }
}

// ==================== EXPORT ALL FUNCTIONS ====================

module.exports = {
  // Date utilities
  addDays,
  daysBetween,
  
  // Cycle calculations
  calculateCycle,
  cycleInsights,
  cycleStarts,
  smartCyclePrediction,
  
  // Phase guidance
  expectedSymptomsForPhase,
  recommendedActionsForPhase,
  
  // Analytics (NEW)
  symptomAnalytics,
  generateInsightList,
  buildPatientDetails,
  
  // Activity logging (NEW)
  logActivity
};