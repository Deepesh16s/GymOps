import { useState, useEffect, useCallback, useRef } from "react";
import api from "../services/api";

const STORAGE_KEY = "gymops_active_workout_session";
const SUCCESS_MESSAGE_DURATION = 4500;

const generateId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `ex_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

const getDefaultSession = () => ({
  active: false,
  startTime: null,
  entries: [],
  sessionType: null,
  customSessionType: null,
});

const loadSession = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultSession();

    const parsed = JSON.parse(raw);

    // Backward-compatible migration (Phase 8A): sessions saved before the
    // exercises -> entries rename stored the array under `exercises`.
    // If `entries` is already present, use it as-is. Otherwise, if the
    // legacy `exercises` key exists, migrate it into `entries`. No other
    // migration logic is applied.
    let entries;
    if (Array.isArray(parsed.entries)) {
      entries = parsed.entries;
    } else if (Array.isArray(parsed.exercises)) {
      entries = parsed.exercises;
    } else {
      entries = [];
    }

    return {
      active: !!parsed.active,
      startTime: parsed.startTime ?? null,
      entries,
      sessionType: parsed.sessionType ?? null,
      customSessionType: parsed.customSessionType ?? null,
    };
  } catch (error) {
    console.log(error);
    return getDefaultSession();
  }
};

const saveSession = (session) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (error) {
    console.log(error);
  }
};

// Mirrors the minutes-label formatting used in WorkoutSession's finish
// confirmation, kept local to the hook since it's the only other place
// that needs a duration string (the post-save success message).
const formatMinutesLabel = (ms) => {
  const minutes = Math.floor(Math.max(0, ms) / 60000);
  return minutes < 1 ? "<1 min" : `${minutes} min`;
};

function useWorkoutSession() {
  const [session, setSession] = useState(loadSession);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const isSavingRef = useRef(false);
  const successTimeoutRef = useRef(null);

  useEffect(() => {
    saveSession(session);
  }, [session]);

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    };
  }, []);

  const clearSaveSuccess = useCallback(() => {
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
    setSaveSuccess("");
  }, []);

  // sessionType/customSessionType are collected up front (via the Start
  // Workout modal) and passed in here, rather than being editable mid
  // session — they're session metadata decided at the moment the
  // session starts, same as startTime.
  const startSession = useCallback((sessionType, customSessionType) => {
    setSession({
      active: true,
      startTime: Date.now(),
      entries: [],
      sessionType: sessionType ?? null,
      customSessionType: customSessionType ?? null,
    });
    setSaveError("");
    clearSaveSuccess();
  }, [clearSaveSuccess]);

  const addExercise = useCallback(({ exercise, firstSet }) => {
    const entry = {
      id: generateId(),
      entryType: "strength",
      exercise: {
        _id: exercise._id,
        name: exercise.name,
        muscleGroup: exercise.muscleGroup,
      },
      sets: [
        {
          id: generateId(),
          weight: firstSet.weight,
          reps: firstSet.reps,
        },
      ],
    };

    setSession((prev) => ({
      ...prev,
      entries: [...prev.entries, entry],
    }));
  }, []);

  // Adds a cardio entry to the active session. `cardio` is the
  // {activityType, data} shape returned by AddCardioModal, already
  // shaped to match what the backend expects for a cardio entry.
  const addCardioEntry = useCallback(({ cardio }) => {
    const entry = {
      id: generateId(),
      entryType: "cardio",
      cardio,
    };

    setSession((prev) => ({
      ...prev,
      entries: [...prev.entries, entry],
    }));
  }, []);

  const addSet = useCallback((exerciseId, set) => {
    setSession((prev) => ({
      ...prev,
      entries: prev.entries.map((entry) =>
        entry.id === exerciseId
          ? {
              ...entry,
              sets: [
                ...entry.sets,
                {
                  id: generateId(),
                  weight: set.weight,
                  reps: set.reps,
                },
              ],
            }
          : entry
      ),
    }));
  }, []);

  const deleteSet = useCallback((exerciseId, setId) => {
    setSession((prev) => {
      const exercise = prev.entries.find((entry) => entry.id === exerciseId);
      if (!exercise) return prev;

      const remainingSets = exercise.sets.filter((s) => s.id !== setId);

      if (remainingSets.length === 0) {
        const remainingEntries = prev.entries.filter(
          (entry) => entry.id !== exerciseId
        );

        if (remainingEntries.length === 0) {
          return getDefaultSession();
        }

        return { ...prev, entries: remainingEntries };
      }

      return {
        ...prev,
        entries: prev.entries.map((entry) =>
          entry.id === exerciseId ? { ...entry, sets: remainingSets } : entry
        ),
      };
    });
  }, []);

  const updateSet = useCallback((exerciseId, setId, updatedSet) => {
    setSession((prev) => ({
      ...prev,
      entries: prev.entries.map((entry) =>
        entry.id === exerciseId
          ? {
              ...entry,
              sets: entry.sets.map((s) =>
                s.id === setId
                  ? { ...s, weight: updatedSet.weight, reps: updatedSet.reps }
                  : s
              ),
            }
          : entry
      ),
    }));
  }, []);
  const removeEntry = useCallback((id) => {
    setSession((prev) => {
      const remaining = prev.entries.filter((entry) => entry.id !== id);

      if (remaining.length === 0) {
        return getDefaultSession();
      }

      return {
        ...prev,
        entries: remaining,
      };
    });
  }, []);

  const discardSession = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(getDefaultSession());
    setSaveError("");
    clearSaveSuccess();
  }, [clearSaveSuccess]);

  const finishWorkout = useCallback(async () => {
    if (isSavingRef.current) return false;
    if (!session.active || session.entries.length === 0) return false;

    isSavingRef.current = true;
    setIsSaving(true);
    setSaveError("");
    clearSaveSuccess();

    const strengthEntries = session.entries.filter(
      (entry) => entry.entryType !== "cardio"
    );
    const cardioEntries = session.entries.filter(
      (entry) => entry.entryType === "cardio"
    );
    const totalSetCount = strengthEntries.reduce(
      (sum, entry) => sum + entry.sets.length,
      0
    );

    // One sessionId per Finish Workout action, shared by every workout
    // document this session produces. Never generated for a discarded
    // session — discardSession never calls this function.
    const sessionId = generateId();

    const elapsedMs = session.startTime ? Date.now() - session.startTime : 0;
    const sessionDurationMinutes = Math.max(0, Math.round(elapsedMs / 60000));
    const durationLabel = session.startTime
      ? formatMinutesLabel(elapsedMs)
      : null;

    try {
      // API-boundary translation (Phase 8A): the backend contract for
      // POST /workouts/session is UNCHANGED — it still expects the
      // payload key `exercises`. Only the in-memory/localStorage
      // session state is called `entries` now. Each entry is mapped
      // back into the exact shape the existing endpoint expects,
      // branching on entryType so cardio entries send
      // {entryType, cardio} instead of {exercise, workoutSets}.
      const payload = {
        sessionId,
        sessionDuration: sessionDurationMinutes,
        sessionType: session.sessionType,
        customSessionType: session.customSessionType,
        exercises: session.entries.map((entry) =>
          entry.entryType === "cardio"
            ? {
                entryType: "cardio",
                cardio: entry.cardio,
              }
            : {
                entryType: "strength",
                exercise: entry.exercise._id,
                workoutSets: entry.sets.map((s) => ({
                  weight: s.weight,
                  reps: s.reps,
                })),
              }
        ),
      };

      await api.post("/workouts/session", payload);

      localStorage.removeItem(STORAGE_KEY);
      setSession(getDefaultSession());

      // Message generalizes to describe whichever mix of strength/cardio
      // entries was actually saved, rather than assuming strength-only.
      const messageParts = [];
      if (strengthEntries.length) {
        messageParts.push(
          `${strengthEntries.length} ${
            strengthEntries.length === 1 ? "exercise" : "exercises"
          }`
        );
      }
      if (cardioEntries.length) {
        messageParts.push(
          `${cardioEntries.length} ${
            cardioEntries.length === 1 ? "cardio entry" : "cardio entries"
          }`
        );
      }
      if (totalSetCount > 0) {
        messageParts.push(
          `${totalSetCount} ${totalSetCount === 1 ? "set" : "sets"}`
        );
      }

      const message = `Workout saved! ${messageParts.join(", ")}${
        durationLabel ? `, ${durationLabel}` : ""
      } added to your history.`;
      setSaveSuccess(message);
      successTimeoutRef.current = setTimeout(() => {
        setSaveSuccess("");
      }, SUCCESS_MESSAGE_DURATION);

      return true;
    } catch (error) {
      console.log(error);
      setSaveError(
        "Failed to finish workout. Please check Workout History before " +
          "trying again to avoid duplicate entries."
      );
      return false;
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, [session, clearSaveSuccess]);

  return {
    active: session.active,
    startTime: session.startTime,
    entries: session.entries,
    sessionType: session.sessionType,
    customSessionType: session.customSessionType,
    isSaving,
    saveError,
    saveSuccess,
    clearSaveSuccess,
    startSession,
    addExercise,
    addCardioEntry,
    addSet,
    deleteSet,
    updateSet,
    removeEntry,
    discardSession,
    finishWorkout,
  };
}

export default useWorkoutSession;