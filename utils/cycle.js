function addDays(dateText, days) {
  const date = new Date(dateText);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  if (!a || !b) return 28;
  const date1 = new Date(a);
  const date2 = new Date(b);
  const diffTime = Math.abs(date2 - date1);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays);
}

function calculateCycle(lastPeriod, cycleLength) {
  const cycle = [];
  const validLength = Math.min(45, Math.max(20, cycleLength || 28));
  
  for (let i = 0; i < validLength; i += 1) {
    let phase = "Luteal";
    if (i < 5) {
      phase = "Menstruation";
    } else if (i < validLength - 16) {
      phase = "Follicular";
    } else if (i < validLength - 13) {
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
  const validLength = Math.min(45, Math.max(20, cycleLength || 28));
  const nextPeriod = addDays(lastPeriod, validLength);
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

// Handle both array and object format for cycles
function cycleStarts(db, user) {
  let userCycles = [];
  
  if (db.cycles && Array.isArray(db.cycles)) {
    userCycles = db.cycles.filter(c => c.userId === user.id);
  } else if (db.cycles && typeof db.cycles === 'object' && db.cycles[user.id]) {
    userCycles = db.cycles[user.id];
  }
  
  const starts = userCycles
    .map((item) => ({
      startDate: item.startDate || item.date || item.lastPeriod,
      cycleLength: Number(item.cycleLength)
    }))
    .filter((item) => item.startDate)
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

  if (user.lastPeriod && !starts.some((item) => item.startDate === user.lastPeriod)) {
    starts.push({
      startDate: user.lastPeriod,
      cycleLength: Number(user.cycleLength) || 28
    });
  }
  
  return starts.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
}

function smartCyclePrediction(db, user) {
  const starts = cycleStarts(db, user);
  
  const lengths = [];
  for (let i = 0; i < starts.length - 1; i++) {
    const days = daysBetween(starts[i].startDate, starts[i + 1].startDate);
    if (days >= 20 && days <= 45) {
      lengths.push(days);
    }
  }
  
  const userCycleLength = Number(user.cycleLength);
  if (userCycleLength >= 20 && userCycleLength <= 45) {
    lengths.push(userCycleLength);
  }
  
  const fallback = (userCycleLength >= 20 && userCycleLength <= 45) ? userCycleLength : 28;
  let averageLength = fallback;
  
  if (lengths.length > 0) {
    const recentLengths = lengths.slice(-6);
    let weightedSum = 0;
    let weightTotal = 0;
    
    for (let i = 0; i < recentLengths.length; i++) {
      const weight = i + 1;
      weightedSum += recentLengths[i] * weight;
      weightTotal += weight;
    }
    averageLength = weightedSum / weightTotal;
  }
  
  let variance = 0;
  if (lengths.length > 1) {
    variance = lengths.reduce((sum, value) => sum + Math.abs(value - averageLength), 0) / lengths.length;
  }
  
  const irregular = averageLength < 21 || averageLength > 35 || variance > 4;
  const latestStart = starts.length > 0 ? starts[starts.length - 1]?.startDate : user.lastPeriod;
  const today = new Date().toISOString().slice(0, 10);
  const dayInCycle = Math.max(1, daysBetween(latestStart, today) + 1);
  
  averageLength = Math.min(45, Math.max(20, Math.round(averageLength)));
  
  const currentCycle = calculateCycle(latestStart, averageLength);
  const dayIndex = ((dayInCycle - 1) % averageLength);
  const phase = currentCycle[dayIndex]?.phase || "Luteal";
  
  let confidence = 60;
  if (lengths.length >= 5) confidence = 92;
  else if (lengths.length >= 3) confidence = 85;
  else if (lengths.length >= 1) confidence = 75;
  if (irregular) confidence -= 10;
  
  const lastCycleDate = starts.length > 0 ? starts[starts.length - 1]?.startDate : null;
  if (lastCycleDate) {
    const daysSinceLastCycle = daysBetween(lastCycleDate, today);
    if (daysSinceLastCycle > 45) confidence -= 5;
    if (daysSinceLastCycle > 60) confidence -= 10;
  }
  
  confidence = Math.max(35, Math.min(98, Math.round(confidence)));
  
  const nextPeriodDate = addDays(latestStart, averageLength);
  
  return {
    nextPeriod: nextPeriodDate,
    alertDate: addDays(nextPeriodDate, -3),
    ovulation: addDays(nextPeriodDate, -14),
    fertileStart: addDays(addDays(nextPeriodDate, -14), -4),
    fertileEnd: addDays(addDays(nextPeriodDate, -14), 1),
    averageCycleLength: averageLength,
    predictionConfidence: confidence,
    irregularCycle: irregular,
    variabilityDays: Number(variance.toFixed(1)),
    todayPhase: phase,
    dayInCycle: dayInCycle,
    historyCount: starts.length,
    cyclesUsed: lengths.length
  };
}

function expectedSymptomsForPhase(phase) {
  const map = {
    Menstruation: ["Cramps", "Fatigue", "Back pain", "Bloating", "Headache"],
    Follicular: ["Higher energy", "Clearer mood", "Improved skin"],
    Ovulation: ["Mild cramps", "Bloating", "Increased libido"],
    Luteal: ["Mood swings", "Acne", "Bloating", "Food cravings", "Breast tenderness"]
  };
  return map[phase] || [];
}

function recommendedActionsForPhase(phase) {
  const map = {
    Menstruation: ["Use heat therapy", "Iron-rich foods", "Gentle yoga", "Stay hydrated"],
    Follicular: ["High-intensity workouts", "Try new activities", "Balanced meals"],
    Ovulation: ["Stay hydrated", "Track symptoms", "Social activities"],
    Luteal: ["Reduce salt", "Prioritize sleep", "Complex carbs", "Gentle exercise"]
  };
  return map[phase] || ["Listen to your body"];
}

// ============ NEW: SEVERITY INDICATORS ============
function getSymptomSeverity(symptom, phase) {
  const severityMap = {
    Menstruation: {
      "Cramps": { level: "high", color: "#e91e63", description: "Most intense first 2-3 days" },
      "Fatigue": { level: "medium", color: "#ff9800", description: "Energy levels may be low" },
      "Back pain": { level: "medium", color: "#ff9800", description: "Lower back discomfort" },
      "Bloating": { level: "low", color: "#4caf50", description: "Mild fluid retention" },
      "Headache": { level: "medium", color: "#ff9800", description: "Hormonal headaches possible" }
    },
    Follicular: {
      "Higher energy": { level: "positive", color: "#4caf50", description: "Energy levels rising" },
      "Clearer mood": { level: "positive", color: "#4caf50", description: "Mood stability improving" },
      "Improved skin": { level: "positive", color: "#4caf50", description: "Skin clarity increases" }
    },
    Ovulation: {
      "Mild cramps": { level: "low", color: "#4caf50", description: "Brief, mild discomfort" },
      "Bloating": { level: "low", color: "#ff9800", description: "Mild fluid retention" },
      "Increased libido": { level: "positive", color: "#4caf50", description: "Natural hormonal change" }
    },
    Luteal: {
      "Mood swings": { level: "medium", color: "#ff9800", description: "Emotional fluctuations" },
      "Acne": { level: "low", color: "#ff9800", description: "Hormonal breakouts possible" },
      "Bloating": { level: "medium", color: "#ff9800", description: "Water retention common" },
      "Food cravings": { level: "low", color: "#4caf50", description: "Increased appetite for carbs" },
      "Breast tenderness": { level: "medium", color: "#ff9800", description: "Soreness before period" }
    }
  };
  return severityMap[phase]?.[symptom] || { level: "unknown", color: "#9e9e9e", description: "Symptom may appear" };
}

// ============ NEW: PERSONALIZED FROM HISTORY ============
function getPersonalizedExpectedSymptoms(db, userId, currentPhase, cycleLength) {
  const user = db.users?.find(u => u.id === userId);
  if (!user) return [];
  
  const symptoms = db.symptoms?.filter(s => s.userId === userId) || [];
  if (symptoms.length === 0) return [];
  
  const phaseSymptoms = {
    Menstruation: [],
    Follicular: [],
    Ovulation: [],
    Luteal: []
  };
  
  symptoms.forEach(symptomEntry => {
    if (!user.lastPeriod) return;
    const dayInCycle = daysBetween(user.lastPeriod, symptomEntry.date);
    const cycleDay = dayInCycle % cycleLength;
    
    let phase = "Luteal";
    if (cycleDay < 5) phase = "Menstruation";
    else if (cycleDay < cycleLength - 16) phase = "Follicular";
    else if (cycleDay < cycleLength - 13) phase = "Ovulation";
    
    if (phaseSymptoms[phase]) {
      symptomEntry.symptoms.forEach(s => {
        phaseSymptoms[phase].push(s);
      });
    }
  });
  
  const frequency = {};
  phaseSymptoms[currentPhase].forEach(s => {
    frequency[s] = (frequency[s] || 0) + 1;
  });
  
  const total = phaseSymptoms[currentPhase].length || 1;
  
  const personalized = Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([symptom, count]) => ({ 
      symptom, 
      probability: Math.round((count / total) * 100),
      type: "personalized",
      severity: getSymptomSeverity(symptom, currentPhase)
    }));
  
  return personalized;
}

// ============ NEW: CONFIDENCE LEVELS ============
function getPredictionConfidenceLevel(userCycleCount, loggingFrequency, variability) {
  let score = 0;
  let reasons = [];
  
  if (userCycleCount >= 10) {
    score += 40;
    reasons.push("✅ Excellent: 10+ cycles tracked");
  } else if (userCycleCount >= 5) {
    score += 30;
    reasons.push("👍 Good: 5+ cycles tracked");
  } else if (userCycleCount >= 2) {
    score += 20;
    reasons.push("📊 Fair: 2+ cycles tracked");
  } else if (userCycleCount >= 1) {
    score += 10;
    reasons.push("📈 Learning: First cycles being tracked");
  } else {
    reasons.push("🔄 Starting: No cycles tracked yet");
  }
  
  if (loggingFrequency >= 80) {
    score += 30;
    reasons.push("📝 Excellent: Regular symptom logging");
  } else if (loggingFrequency >= 50) {
    score += 20;
    reasons.push("📝 Good: Consistent logging");
  } else if (loggingFrequency >= 20) {
    score += 10;
    reasons.push("📝 Fair: Some symptoms logged");
  } else {
    reasons.push("⚠️ Limited: Log more symptoms for better predictions");
  }
  
  if (variability <= 2) {
    score += 30;
    reasons.push("🎯 Very consistent cycle");
  } else if (variability <= 5) {
    score += 20;
    reasons.push("📊 Moderately consistent cycle");
  } else if (variability <= 8) {
    score += 10;
    reasons.push("🔄 Variable cycle detected");
  } else {
    reasons.push("⚠️ Highly variable cycle - predictions less accurate");
  }
  
  let level = "low";
  let color = "#f44336";
  let message = "Low confidence - keep tracking!";
  
  if (score >= 70) {
    level = "high";
    color = "#4caf50";
    message = "High confidence - predictions are reliable";
  } else if (score >= 40) {
    level = "medium";
    color = "#ff9800";
    message = "Medium confidence - getting better";
  }
  
  return {
    score,
    level,
    color,
    message,
    reasons,
    percentage: score
  };
}

// ============ NEW: PREVENTIVE ACTIONS ============
function getPreventiveActions(expectedSymptoms, phase) {
  const actionMap = {
    "Cramps": ["Apply heat pack", "Take magnesium", "Gentle stretching", "Stay hydrated"],
    "Bloating": ["Reduce salt intake", "Drink more water", "Avoid carbonated drinks", "Eat potassium-rich foods"],
    "Fatigue": ["Iron-rich foods (spinach, lentils)", "Early bedtime", "Light exercise", "Stay hydrated"],
    "Mood swings": ["Magnesium supplements", "Avoid caffeine", "Take breaks", "Deep breathing exercises"],
    "Headache": ["Stay hydrated", "Regular meals", "Reduce screen time", "Cold compress"],
    "Back pain": ["Heat therapy", "Gentle stretching", "Good posture", "Supportive chair"],
    "Acne": ["Gentle cleansing", "Avoid touching face", "Zinc-rich foods", "Clean pillowcases"],
    "Breast tenderness": ["Supportive bra", "Reduce caffeine", "Vitamin E", "Cold compress"],
    "Higher energy": ["Plan important tasks", "Exercise routine", "Social activities", "Creative work"],
    "Food cravings": ["Healthy alternatives", "Small portions", "Protein-rich snacks", "Plan ahead"]
  };
  
  const generalActions = {
    Menstruation: ["Rest more than usual", "Use heat therapy", "Iron-rich foods", "Gentle yoga"],
    Follicular: ["Exercise regularly", "Try new activities", "Balanced meals", "Set goals"],
    Ovulation: ["Stay hydrated", "Track symptoms", "Social activities", "Important meetings"],
    Luteal: ["Reduce stress", "Get extra sleep", "Complex carbs", "Gentle exercise"]
  };
  
  const actions = [];
  
  expectedSymptoms.forEach(symptom => {
    if (actionMap[symptom]) {
      actions.push(...actionMap[symptom]);
    }
  });
  
  if (generalActions[phase]) {
    actions.push(...generalActions[phase]);
  }
  
  return [...new Set(actions)].slice(0, 5);
}

// ============ NEW: SYMPTOM TRENDS ============
function getSymptomTrends(db, userId, cycleLength) {
  const user = db.users?.find(u => u.id === userId);
  if (!user || !user.lastPeriod) return { cycles: [], trends: {} };
  
  const symptoms = db.symptoms?.filter(s => s.userId === userId) || [];
  if (symptoms.length === 0) return { cycles: [], trends: {} };
  
  const cycles = [];
  let currentStart = new Date(user.lastPeriod);
  
  for (let i = 0; i < Math.min(6, symptoms.length / 3); i++) {
    const cycleEnd = addDays(currentStart, cycleLength);
    const cycleSymptoms = symptoms.filter(s => 
      s.date >= currentStart.toISOString().slice(0, 10) && 
      s.date <= cycleEnd
    );
    
    const symptomCounts = {};
    cycleSymptoms.forEach(s => {
      s.symptoms.forEach(symptom => {
        symptomCounts[symptom] = (symptomCounts[symptom] || 0) + 1;
      });
    });
    
    cycles.push({
      cycleNumber: i + 1,
      startDate: currentStart.toISOString().slice(0, 10),
      symptoms: Object.entries(symptomCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, count]) => ({ name, count })),
      symptomCount: cycleSymptoms.length
    });
    
    currentStart.setDate(currentStart.getDate() - cycleLength);
  }
  
  const trends = {};
  cycles.slice().reverse().forEach((cycle, index) => {
    cycle.symptoms.forEach(s => {
      if (!trends[s.name]) {
        trends[s.name] = { counts: [], direction: "stable" };
      }
      trends[s.name].counts[index] = s.count;
    });
  });
  
  Object.keys(trends).forEach(symptom => {
    const counts = trends[symptom].counts.filter(c => c !== undefined);
    if (counts.length >= 3) {
      const first = counts[0];
      const last = counts[counts.length - 1];
      if (last > first * 1.5) trends[symptom].direction = "increasing";
      else if (last < first * 0.5) trends[symptom].direction = "decreasing";
    }
  });
  
  return { cycles: cycles.reverse(), trends };
}

// ============ NEW: SEASONAL TRENDS ============
function getSeasonalTrends(db, userId) {
  const symptoms = db.symptoms?.filter(s => s.userId === userId) || [];
  if (symptoms.length === 0) return { seasons: {}, bestSeason: null, worstSeason: null, insights: [] };
  
  const seasonal = {
    Winter: { months: [11, 0, 1], symptoms: [], avgPain: 0, symptomCount: 0 },
    Spring: { months: [2, 3, 4], symptoms: [], avgPain: 0, symptomCount: 0 },
    Summer: { months: [5, 6, 7], symptoms: [], avgPain: 0, symptomCount: 0 },
    Fall: { months: [8, 9, 10], symptoms: [], avgPain: 0, symptomCount: 0 }
  };
  
  Object.keys(seasonal).forEach(season => {
    const seasonSymptoms = symptoms.filter(s => {
      const month = new Date(s.date).getMonth();
      return seasonal[season].months.includes(month);
    });
    
    const symptomCounts = {};
    seasonSymptoms.forEach(s => {
      s.symptoms.forEach(symptom => {
        symptomCounts[symptom] = (symptomCounts[symptom] || 0) + 1;
      });
    });
    
    seasonal[season].symptoms = Object.entries(symptomCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
    
    seasonal[season].avgPain = seasonSymptoms.length 
      ? seasonSymptoms.reduce((sum, s) => sum + (s.painLevel || 0), 0) / seasonSymptoms.length 
      : 0;
    
    seasonal[season].symptomCount = seasonSymptoms.length;
  });
  
  const seasonEntries = Object.entries(seasonal);
  const bestSeason = seasonEntries.sort((a, b) => a[1].avgPain - b[1].avgPain)[0];
  const worstSeason = seasonEntries.sort((a, b) => b[1].avgPain - a[1].avgPain)[0];
  
  const insights = [];
  const winter = seasonal.Winter;
  const summer = seasonal.Summer;
  
  if (winter.avgPain > summer.avgPain + 1) {
    insights.push("❄️ Your pain levels are higher in winter. Consider vitamin D supplements and staying warm.");
  } else if (summer.avgPain > winter.avgPain + 1) {
    insights.push("☀️ Your pain levels are higher in summer. Stay hydrated and avoid overheating.");
  }
  
  return {
    seasons: seasonal,
    bestSeason: bestSeason ? { name: bestSeason[0], avgPain: bestSeason[1].avgPain } : null,
    worstSeason: worstSeason ? { name: worstSeason[0], avgPain: worstSeason[1].avgPain } : null,
    currentSeason: getCurrentSeason(),
    insights
  };
}

function getCurrentSeason() {
  const month = new Date().getMonth();
  if (month >= 11 || month <= 1) return "Winter";
  if (month >= 2 && month <= 4) return "Spring";
  if (month >= 5 && month <= 7) return "Summer";
  return "Fall";
}

// ============ ENHANCED: Expected Symptoms with all features ============
function getEnhancedExpectedSymptoms(db, userId, phase, cycleLength) {
  const personalized = getPersonalizedExpectedSymptoms(db, userId, phase, cycleLength);
  const general = expectedSymptomsForPhase(phase);
  
  const userCycles = db.cycles?.filter(c => c.userId === userId) || [];
  const symptoms = db.symptoms?.filter(s => s.userId === userId) || [];
  const loggingFrequency = symptoms.length > 0 ? Math.min(100, (symptoms.length / 30) * 100) : 0;
  
  const cycleLengths = userCycles.map(c => c.cycleLength);
  let variability = 5;
  if (cycleLengths.length > 1) {
    const mean = cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length;
    variability = cycleLengths.reduce((sum, val) => sum + Math.abs(val - mean), 0) / cycleLengths.length;
  }
  
  const confidence = getPredictionConfidenceLevel(userCycles.length, loggingFrequency, variability);
  const preventiveActions = getPreventiveActions(general, phase);
  
  return {
    personalized: personalized.slice(0, 5),
    general: general,
    confidence,
    preventiveActions,
    hasPersonalized: personalized.length > 0
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

function generateInsightList(db, user, sharedOnly = false) {
  const analytics = symptomAnalytics(db, user.id, sharedOnly);
  const prediction = smartCyclePrediction(db, user);
  const insights = [];
  
  const frequent = analytics.frequency.filter((item) => item.count >= 2);
  const insightRules = db.insightRules || [];
  
  frequent.forEach((item) => {
    const rule = insightRules.find(
      (entry) => entry.symptom && entry.symptom.toLowerCase() === item.symptom.toLowerCase()
    );
    insights.push({
      type: "symptom",
      title: item.symptom,
      message: rule?.message || `${item.symptom} appears frequently (${item.count} times).`,
      action: rule?.action || "Continue tracking for better insights."
    });
  });
  
  if (analytics.highPainAlerts.length) {
    insights.push({
      type: "risk",
      title: "High pain pattern",
      message: `You reported pain above 8 on ${analytics.highPainAlerts.length} day(s).`,
      action: "Consider consulting a doctor if this persists."
    });
  }
  
  if (prediction.irregularCycle) {
    insights.push({
      type: "cycle",
      title: "Irregular cycle detected",
      message: `Your cycle varies by ${prediction.variabilityDays} days.`,
      action: "Regular tracking will improve predictions over time."
    });
  }
  
  if (insights.length === 0) {
    insights.push({
      type: "general",
      title: "You're on track!",
      message: "No significant patterns detected.",
      action: "Continue logging symptoms daily for better insights."
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
  
  if (db.activityLogs[userId].length > 100) {
    db.activityLogs[userId] = db.activityLogs[userId].slice(-100);
  }
}

module.exports = {
  addDays,
  daysBetween,
  calculateCycle,
  cycleInsights,
  cycleStarts,
  smartCyclePrediction,
  expectedSymptomsForPhase,
  recommendedActionsForPhase,
  symptomAnalytics,
  generateInsightList,
  buildPatientDetails,
  logActivity,
  // New exports
  getSymptomSeverity,
  getPersonalizedExpectedSymptoms,
  getPredictionConfidenceLevel,
  getPreventiveActions,
  getSymptomTrends,
  getSeasonalTrends,
  getEnhancedExpectedSymptoms
};