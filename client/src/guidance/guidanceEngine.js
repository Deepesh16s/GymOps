const PLATEAU_ITEM_CAP = 3;

function plateauItems(plateaus) {
  const confirmed = plateaus.filter((p) => p.plateauLevel === "Confirmed").slice(0, PLATEAU_ITEM_CAP);
  if (confirmed.length > 0) {
    return confirmed.map((p) => ({
      id: `plateau-${p.muscle}`,
      category: "Plateau",
      tone: "attention",
      title: `Plateau in ${p.muscle}`,
      message: `${p.muscle} hasn't shown a clear upward trend across your recent sessions. Consider varying rep ranges, exercises, or adding volume.`,
      confidence: p.confidence,
      confidenceReason: p.confidenceReason,
    }));
  }

  const possible = plateaus.filter((p) => p.plateauLevel === "Possible");
  if (possible.length > 0) {
    const names = possible.slice(0, PLATEAU_ITEM_CAP).map((p) => p.muscle);
    return [
      {
        id: "plateau-possible",
        category: "Plateau",
        tone: "neutral",
        title: "Early plateau signs",
        message: `${names.join(", ")} ${names.length === 1 ? "is" : "are"} showing early signs of stalling — worth watching over the next few sessions.`,
      },
    ];
  }

  return [];
}

function muscleBalanceItems(trainingBalance) {
  if (!trainingBalance.available) return [];

  const { imbalance, confidence, confidenceReason } = trainingBalance;
  if (!imbalance.balanced) {
    return [
      {
        id: "balance-imbalance",
        category: "Muscle Balance",
        tone: "attention",
        title: `${imbalance.dominant} is ahead of ${imbalance.least}`,
        message: `There's roughly a ${Math.round(imbalance.gap)}% gap in training share between ${imbalance.dominant} and ${imbalance.least}. Shifting a session or two toward ${imbalance.least} would even things out.`,
        confidence,
        confidenceReason,
      },
    ];
  }

  return [
    {
      id: "balance-even",
      category: "Muscle Balance",
      tone: "positive",
      title: "Training is well balanced",
      message: "Your training share across muscle groups is even — no group is being significantly neglected.",
      confidence,
      confidenceReason,
    },
  ];
}

function consistencyItems(weeklyCoachReport) {
  if (!weeklyCoachReport.available || !weeklyCoachReport.consistency) return [];

  const { trained, total } = weeklyCoachReport.consistency;
  if (!total) return [];

  const ratio = trained / total;
  if (ratio < 0.5) {
    return [
      {
        id: "consistency-low",
        category: "Consistency",
        tone: "attention",
        title: "Consistency has dipped",
        message: `You trained ${trained} of the last ${total} planned days. Getting back to a regular rhythm matters more than any single hard session.`,
      },
    ];
  }

  return [
    {
      id: "consistency-good",
      category: "Consistency",
      tone: "positive",
      title: "Consistency is on track",
      message: `You trained ${trained} of the last ${total} planned days — a solid, sustainable rhythm.`,
    },
  ];
}

function progressionItems(weeklyGrade) {
  if (!weeklyGrade.grade || !Array.isArray(weeklyGrade.factors)) return [];

  const overload = weeklyGrade.factors.find((f) => f.key === "overload");
  if (!overload || typeof overload.value !== "number") return [];

  if (overload.value < 50) {
    return [
      {
        id: "progression-stalled",
        category: "Progression",
        tone: "attention",
        title: "Progressive overload has stalled",
        message: `Your progressive overload score is ${Math.round(overload.value)}/100 this week. Try adding a small amount of weight or a rep or two on your main lifts.`,
        confidence: weeklyGrade.confidence,
        confidenceReason: weeklyGrade.confidenceReason,
      },
    ];
  }

  return [
    {
      id: "progression-trending",
      category: "Progression",
      tone: "positive",
      title: "Progressive overload is trending well",
      message: `Your progressive overload score is ${Math.round(overload.value)}/100 this week — keep building on your current lifts.`,
      confidence: weeklyGrade.confidence,
      confidenceReason: weeklyGrade.confidenceReason,
    },
  ];
}

function trainingFocusItems(musclePriorities) {
  if (!musclePriorities.available) return [];

  const { mostOverdue } = musclePriorities;
  if (!mostOverdue) return [];

  const { muscle, daysAgo } = mostOverdue;
  const since = daysAgo <= 0 ? "today" : daysAgo === 1 ? "1 day ago" : `${daysAgo} days ago`;

  return [
    {
      id: "focus-overdue",
      category: "Training Focus",
      tone: "neutral",
      title: `Focus: ${muscle}`,
      message: `${muscle} was last trained ${since} — a candidate for your next session.`,
      confidence: musclePriorities.confidence,
      confidenceReason: musclePriorities.confidenceReason,
    },
  ];
}

const GOAL_ITEM_CAP = 3;

function goalItems(goalEntries) {
  const behind = goalEntries.filter((g) => g.analytics.health === "Behind").slice(0, GOAL_ITEM_CAP);
  const ahead = goalEntries.filter((g) => g.analytics.health === "Ahead" || g.analytics.health === "Completed");

  const items = behind.map(({ goal, analytics }) => ({
    id: `goal-behind-${goal._id}`,
    category: "Goals",
    tone: "attention",
    title: `Behind pace: ${goal.title}`,
    message: analytics.insight || `${goal.title} is behind the pace needed to hit its target.`,
  }));

  if (items.length === 0 && ahead.length > 0) {
    const { goal, analytics } = ahead[0];
    items.push({
      id: `goal-ahead-${goal._id}`,
      category: "Goals",
      tone: "positive",
      title: analytics.health === "Completed" ? `Completed: ${goal.title}` : `Ahead of pace: ${goal.title}`,
      message: analytics.insight || `${goal.title} is ahead of pace.`,
    });
  }

  return items;
}

const TONE_ORDER = { attention: 0, neutral: 1, positive: 2 };

export function buildGuidance(data) {
  const items = [
    ...progressionItems(data.weeklyGrade),
    ...plateauItems(data.plateaus),
    ...muscleBalanceItems(data.trainingBalance),
    ...consistencyItems(data.weeklyCoachReport),
    ...goalItems(data.goals),
    ...trainingFocusItems(data.musclePriorities),
  ];

  return items.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
}
