const { publicAccount, publicDoctor } = require("./auth");

function buildPatientSummary(db, user) {
  // Get last activity from various sources
  const lastActivity = user.lastSeen || user.updatedAt || user.createdAt;
  
  // Determine condition based on symptoms and activity
  let condition = "Cycle tracking";
  const hasSymptoms = db.symptoms.some(s => s.userId === user.id);
  const hasSharedSymptoms = db.symptoms.some(s => s.userId === user.id && s.sharedWithDoctor);
  
  if (hasSharedSymptoms) {
    condition = "Symptoms shared";
  } else if (hasSymptoms) {
    condition = "Symptoms logged";
  }
  
  // Calculate risk level
  let riskLevel = "Low";
  const riskReasons = [];
  
  // Check for high pain
  const hasHighPain = db.symptoms.some(s => s.userId === user.id && s.painLevel > 8);
  if (hasHighPain) {
    riskReasons.push("High pain levels reported (>8/10)");
    riskLevel = "High";
  }
  
  // Check for severe symptoms
  const severeSymptoms = ["severe", "heavy bleeding", "faint", "dizzy", "vomit", "unbearable", "fever", "clot"];
  const symptomText = db.symptoms
    .filter(s => s.userId === user.id)
    .flatMap(s => s.symptoms || [])
    .join(" ")
    .toLowerCase();
  
  const hasSevereSymptoms = severeSymptoms.some(word => symptomText.includes(word));
  if (hasSevereSymptoms) {
    riskReasons.push("Severe symptoms reported");
    riskLevel = "High";
  }
  
  // Check for irregular cycle
  const cycleHistory = db.cycles[user.id] || [];
  const hasIrregularCycle = cycleHistory.some(c => c.cycleLength < 21 || c.cycleLength > 35);
  if (hasIrregularCycle) {
    riskReasons.push("Irregular cycle pattern");
    if (riskLevel !== "High") riskLevel = "Medium";
  }
  
  // Check for inactivity
  const daysInactive = Math.floor((Date.now() - new Date(lastActivity).getTime()) / 86400000);
  if (daysInactive > 30) {
    riskReasons.push(`No activity for ${daysInactive} days`);
    if (riskLevel !== "High") riskLevel = "Medium";
  }
  
  // Add default reason if no risks found
  if (riskReasons.length === 0) {
    riskReasons.push("Regular monitoring");
  }
  
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    profileType: user.role,
    condition,
    lastActivity,
    riskLevel,
    riskReasons,
    createdAt: user.createdAt,
    lastPeriod: user.lastPeriod,
    cycleLength: user.cycleLength
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
  
  const messages = db.patientMessages?.filter((item) => item.patientId === user.id) || [];
  const recommendations = db.patientRecommendations?.filter((item) => item.patientId === user.id) || [];
  const followUps = db.followUps?.filter((item) => item.patientId === user.id) || [];
  
  return {
    ...summary,
    symptoms: symptomHistory.length > 0 
      ? symptomHistory.map(s => ({ date: s.date, symptoms: s.symptoms, painLevel: s.painLevel }))
      : [],
    cycle: {
      lastPeriod: user.lastPeriod,
      cycleLength: user.cycleLength,
      history
    },
    activityLogs: (db.activityLogs?.[user.id] || []).filter((log) => log.type !== "symptoms"),
    messages,
    recommendations,
    followUps,
    symptomHistory,
    symptomInsights: {
      frequentSymptoms,
      highPainEntries: symptomHistory.filter((entry) => Number(entry.painLevel) > 7),
      averagePain: symptomHistory.length
        ? Number((symptomHistory.reduce((sum, entry) => sum + Number(entry.painLevel || 0), 0) / symptomHistory.length).toFixed(1))
        : 0,
      totalEntries: symptomHistory.length
    }
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

// REMOVED duplicate publicDoctor function - it's imported from auth

module.exports = {
  buildPatientSummary,
  buildPatientDetails,
  symptomAnalytics,
  logActivity
};