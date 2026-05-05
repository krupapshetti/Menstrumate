
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