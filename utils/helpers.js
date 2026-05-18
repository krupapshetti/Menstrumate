// Import cycle functions from cycleUtils
const {
  addDays,
  daysBetween,
  calculateCycle,
  smartCyclePrediction
} = require("./cycle");

// ==================== PRODUCT RECOMMENDATIONS ====================
function recommendProducts(db, userId) {
  const userSymptoms = db.symptoms
    .filter(s => s.userId === userId)
    .flatMap(s => s.symptoms || [])
    .map(s => s.toLowerCase());

  const uniqueSymptoms = [...new Set(userSymptoms)];

  const shopRules = db.shopRules || [
    { match: "cramps", categories: ["Heating Pads", "Pain Relief"] },
    { match: "back pain", categories: ["Heating Pads", "Pain Relief"] },
    { match: "fatigue", categories: ["Chocolate / Comfort"] },
    { match: "mood swings", categories: ["Chocolate / Comfort"] },
    { match: "bloating", categories: ["Herbal Teas", "Supplements"] },
    { match: "headache", categories: ["Pain Relief"] },
    { match: "acne", categories: ["Skincare"] }
  ];

  // ✅ FIX: partial matching instead of exact match
  const matchedCategories = shopRules
    .filter(rule =>
      uniqueSymptoms.some(symptom =>
        symptom.includes(rule.match.toLowerCase())
      )
    )
    .flatMap(rule => rule.categories || []);

  const uniqueCategories = [...new Set(matchedCategories)];

  let recommendations = db.products.filter(product =>
    uniqueCategories.includes(product.category)
  );

  if (recommendations.length === 0) {
    recommendations = db.products.slice(0, 4);
  }

  return recommendations.slice(0, 6).map(product => ({
    ...product,
    relevance: matchedCategories.includes(product.category) ? "high" : "medium",
    reason: getRecommendationReason(product.category)
  }));
}

function getRecommendationReason(category) {
  const reasons = {
    "Heating Pads": "Helpful for cramps and back pain",
    "Pain Relief": "May help with pain symptoms",
    "Chocolate / Comfort": "Improves mood & fatigue",
    "Herbal Teas": "Reduces bloating",
    "Supplements": "Supports cycle health",
    "Skincare": "Helps hormonal acne"
  };
  return reasons[category] || "Recommended for your wellness";
}

// ==================== SMART NOTIFICATIONS ====================
function smartNotifications(db, user) {
  const today = new Date().toISOString().slice(0, 10);
  const messages = [];

  const prediction = smartCyclePrediction(db, user);

  const daysToPeriod = Math.round(
    (new Date(prediction.nextPeriod) - new Date(today)) / 86400000
  );

  if (daysToPeriod <= 0) {
    messages.push("🎯 Period expected today");
  } else if (daysToPeriod <= 3) {
    messages.push(`📅 Period in ${daysToPeriod} days`);
  }

  if (prediction.todayPhase === "Ovulation") {
    messages.push("🌸 Ovulation phase today");
  }

  if (prediction.irregularCycle) {
    messages.push("📊 Irregular cycle detected");
  }

  const hasTodayLog = db.symptoms.some(
    entry => entry.userId === user.id && entry.date === today
  );

  if (!hasTodayLog) {
    messages.push("📝 Log today's symptoms");
  }

  return messages.slice(0, 5);
}

// ==================== LOG ACTIVITY ====================
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
  recommendProducts,
  smartNotifications,
  logActivity
};