const { OTHER_SESSION_TYPE } = require("../constants/sessionTypes");

function dateKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function isCardioEntry(workout) {
  return workout?.entryType === "cardio";
}

function getWorkoutVolume(workout) {
  return (workout.workoutSets || []).reduce((sum, s) => sum + s.reps * s.weight, 0);
}

function groupWorkoutsIntoSessions(workouts) {
  const sessionMap = new Map();
  const keyOrder = [];

  workouts.forEach((w) => {
    const key = w.sessionId ? `session:${w.sessionId}` : `standalone:${w._id}`;

    if (!sessionMap.has(key)) {
      sessionMap.set(key, {
        key,
        sessionId: w.sessionId || null,
        date: w.date,
        sessionDuration:
          w.sessionDuration !== undefined && w.sessionDuration !== null ? w.sessionDuration : null,
        startedAt: w.startedAt || null,
        endedAt: w.endedAt || null,
        timingMode: w.timingMode || "AUTO",
        sessionType: w.sessionType || null,
        customSessionType: w.customSessionType || null,
        workouts: [],
      });
      keyOrder.push(key);
    }

    const session = sessionMap.get(key);
    session.workouts.push(w);

    if (new Date(w.date) < new Date(session.date)) {
      session.date = w.date;
    }
    if (session.sessionDuration == null && w.sessionDuration != null) {
      session.sessionDuration = w.sessionDuration;
    }
    if (session.startedAt == null && w.startedAt != null) {
      session.startedAt = w.startedAt;
    }
    if (session.endedAt == null && w.endedAt != null) {
      session.endedAt = w.endedAt;
    }
    if (session.timingMode === "AUTO" && w.timingMode === "MANUAL") {
      session.timingMode = w.timingMode;
    }
    if (session.sessionType == null && w.sessionType != null) {
      session.sessionType = w.sessionType;
      session.customSessionType = w.customSessionType || null;
    }
  });

  return keyOrder.map((key) => sessionMap.get(key));
}

function getSessionVolume(session) {
  return session.workouts.reduce((sum, w) => {
    if (isCardioEntry(w)) return sum;
    return sum + getWorkoutVolume(w);
  }, 0);
}

function countAllSessions(workouts) {
  return groupWorkoutsIntoSessions(workouts).length;
}

function getLongestStreak(trainedDateKeys) {
  const dates = [...trainedDateKeys].map((k) => new Date(k)).sort((a, b) => a - b);

  let longest = 0;
  let current = 0;
  let prev = null;

  for (const d of dates) {
    if (prev && Math.round((d - prev) / 86400000) === 1) {
      current += 1;
    } else {
      current = 1;
    }
    if (current > longest) longest = current;
    prev = d;
  }

  return longest;
}

function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMon);
  d.setHours(0, 0, 0, 0);
  return d;
}

function tierFor(volume, max) {
  if (!volume || !max) return 0;
  const ratio = volume / max;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

function getSessionTypeLabel(session) {
  const { sessionType, customSessionType } = session;
  if (!sessionType) return "Session";
  if (sessionType === OTHER_SESSION_TYPE) {
    return customSessionType ? `${customSessionType} Session` : "Session";
  }
  return `${sessionType} Session`;
}

module.exports = {
  dateKey,
  isCardioEntry,
  getWorkoutVolume,
  groupWorkoutsIntoSessions,
  getSessionVolume,
  countAllSessions,
  getLongestStreak,
  startOfWeek,
  tierFor,
  getSessionTypeLabel,
};
