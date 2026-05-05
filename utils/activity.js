function logActivity(db, userId, type, detail) {
  db.activityLogs[userId] =
    db.activityLogs[userId] || [];

  db.activityLogs[userId].push({
    id: `activity_${Date.now()}_${Math.random()
      .toString(16)
      .slice(2)}`,

    type,
    detail,

    createdAt: new Date().toISOString()
  });
}

module.exports = {
  logActivity
};