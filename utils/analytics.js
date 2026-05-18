function symptomAnalytics(
  db,
  userId,
  sharedOnly = false
) {
  const entries = db.symptoms
    .filter(
      (entry) => entry.userId === userId
    )
    .filter(
      (entry) =>
        !sharedOnly ||
        entry.sharedWithDoctor
    )
    .sort(
      (a, b) =>
        new Date(a.date) -
        new Date(b.date)
    );

  const frequencyMap = entries.reduce(
    (counts, entry) => {
      (entry.symptoms || []).forEach(
        (symptom) => {
          counts[symptom] =
            (counts[symptom] || 0) + 1;
        }
      );

      return counts;
    },
    {}
  );

  const frequency = Object.entries(
    frequencyMap
  )
    .sort((a, b) => b[1] - a[1])
    .map(([symptom, count]) => ({
      symptom,
      count
    }));

  const painTrend = entries
    .slice(-30)
    .map((entry) => ({
      date: entry.date,
      painLevel: Number(
        entry.painLevel || 0
      )
    }));

  const highPainAlerts = entries.filter(
    (entry) =>
      Number(entry.painLevel) > 8
  );

  const averagePain = entries.length
    ? Number(
        (
          entries.reduce(
            (sum, entry) =>
              sum +
              Number(
                entry.painLevel || 0
              ),
            0
          ) / entries.length
        ).toFixed(1)
      )
    : 0;

  return {
    entries,
    frequency,
    painTrend,
    highPainAlerts,
    averagePain
  };
}

function generateInsightList(
  db,
  user,
  sharedOnly = false
) {
  const analytics = symptomAnalytics(
    db,
    user.id,
    sharedOnly
  );

  const prediction =
    smartCyclePrediction(db, user);

  const insights = [];

  const frequent =
    analytics.frequency.filter(
      (item) => item.count >= 2
    );

  frequent.forEach((item) => {
    const rule = db.insightRules.find(
      (entry) =>
        entry.symptom.toLowerCase() ===
        item.symptom.toLowerCase()
    );

    insights.push({
      type: "symptom",

      title: item.symptom,

      message:
        rule?.message ||
        `${item.symptom} appears frequently in your logs.`,

      action:
        rule?.action ||
        "Keep tracking this pattern for better recommendations."
    });
  });

  if (analytics.highPainAlerts.length) {
    insights.push({
      type: "risk",

      title: "High pain pattern",

      message: `You reported pain above 8 on ${analytics.highPainAlerts.length} day(s).`,

      action:
        "Consider sharing logs with a doctor if this continues."
    });
  }

  if (prediction.irregularCycle) {
    insights.push({
      type: "cycle",

      title:
        "Irregular cycle warning",

      message: `Your cycle variability is about ${prediction.variabilityDays} day(s).`,

      action:
        "Keep cycle starts updated so predictions can improve."
    });
  }

  if (!insights.length) {
    insights.push({
      type: "general",

      title: "Stable tracking",

      message:
        "No strong risk pattern is visible yet.",

      action:
        "Log symptoms daily to unlock better personalization."
    });
  }

  return {
    insights,
    analytics,
    prediction
  };
}

function smartNotifications(
  db,
  user
) {
  const prediction =
    smartCyclePrediction(db, user);

  const today = new Date()
    .toISOString()
    .slice(0, 10);

  const daysToPeriod = Math.round(
    (new Date(prediction.nextPeriod) -
      new Date(today)) /
      86400000
  );

  const yesterday = addDays(today, -1);

  const yesterdayEntry =
    db.symptoms.find(
      (entry) =>
        entry.userId === user.id &&
        entry.date === yesterday
    );

  const messages = [];

  if (
    daysToPeriod >= 0 &&
    daysToPeriod <= 3
  ) {
    messages.push(
      `Period expected in ${daysToPeriod} day${
        daysToPeriod === 1 ? "" : "s"
      }.`
    );
  }

  if (
    prediction.todayPhase ===
    "Ovulation"
  ) {
    messages.push(
      "Ovulation phase today. Hydrate and note any mid-cycle pain."
    );
  }

  if (
    Number(
      yesterdayEntry?.painLevel || 0
    ) > 7
  ) {
    messages.push(
      "You reported high pain yesterday. Take it gently today."
    );
  }

  if (prediction.irregularCycle) {
    messages.push(
      "Cycle irregularity detected. Keep your latest period date updated."
    );
  }

  return messages.length
    ? messages
    : [...db.notifications]
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
}

function recommendProducts(
  db,
  userId
) {
  const analytics =
    symptomAnalytics(
      db,
      userId,
      false
    );

  const symptoms =
    analytics.frequency.map((item) =>
      item.symptom.toLowerCase()
    );

  const matchedTerms =
    db.shopRules
      .filter((rule) =>
        symptoms.includes(
          String(
            rule.match || ""
          ).toLowerCase()
        )
      )
      .flatMap(
        (rule) =>
          rule.categories || []
      );

  return db.products
    .filter((product) =>
      matchedTerms.includes(
        product.category
      )
    )
    .slice(0, 4);
}

module.exports = {
  symptomAnalytics,
  generateInsightList,
  smartNotifications,
  recommendProducts
};