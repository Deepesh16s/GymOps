import { useState, useEffect, useCallback, useRef } from "react";
import api from "../services/api";

const STORAGE_KEY = "repvyn_active_workout_session";
const SUCCESS_MESSAGE_DURATION = 4500;
const TIMING_TIP_SHOWN_COUNT_KEY = "repvyn_timing_tip_shown_count";
const TIMING_TIP_MAX_SHOWS = 3;

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
  sessionNote: null,
  plannedWorkoutId: null,
});

const loadSession = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultSession();

    const parsed = JSON.parse(raw);

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
      sessionNote: parsed.sessionNote ?? null,
      plannedWorkoutId: parsed.plannedWorkoutId ?? null,
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

  const [justStarted, setJustStarted] = useState(false);

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

  const startSession = useCallback((sessionType, customSessionType) => {
    setSession({
      active: true,
      startTime: Date.now(),
      entries: [],
      sessionType: sessionType ?? null,
      customSessionType: customSessionType ?? null,
      sessionNote: null,
      plannedWorkoutId: null,
    });
    setJustStarted(true);
    setSaveError("");
    clearSaveSuccess();
  }, [clearSaveSuccess]);

  const startSessionFromPlan = useCallback(
    (plannedWorkout) => {
      const entries =
        plannedWorkout.workoutType === "Cardio"
          ? [
              {
                id: generateId(),
                entryType: "cardio",
                cardio: {
                  activityType: plannedWorkout.cardioActivityType || "Other",
                  data: {},
                },
              },
            ]
          : (plannedWorkout.exercises || [])
              .filter((e) => e.exercise)
              .map((e) => ({
                id: generateId(),
                entryType: "strength",
                exercise: {
                  _id: e.exercise._id,
                  name: e.exercise.name,
                  muscleGroup: e.exercise.muscleGroup,
                },
                sets: [],
              }));

      setSession({
        active: true,
        startTime: Date.now(),
        entries,
        sessionType: plannedWorkout.workoutType ?? null,
        customSessionType: null,
        sessionNote: plannedWorkout.notes || null,
        plannedWorkoutId: plannedWorkout._id,
      });
      setJustStarted(true);
      setSaveError("");
      clearSaveSuccess();
    },
    [clearSaveSuccess]
  );

  const confirmResume = useCallback(() => {
    setJustStarted(true);
  }, []);

  const setSessionNote = useCallback((note) => {
    setSession((prev) => ({ ...prev, sessionNote: note }));
  }, []);

  const updateEntryNote = useCallback((entryId, note) => {
    setSession((prev) => ({
      ...prev,
      entries: prev.entries.map((entry) =>
        entry.id === entryId ? { ...entry, note } : entry
      ),
    }));
  }, []);

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

  const reorderEntry = useCallback((id, direction) => {
    setSession((prev) => {
      const index = prev.entries.findIndex((entry) => entry.id === id);
      if (index === -1) return prev;

      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.entries.length) return prev;

      const entries = [...prev.entries];
      [entries[index], entries[targetIndex]] = [
        entries[targetIndex],
        entries[index],
      ];

      return { ...prev, entries };
    });
  }, []);

  const duplicateEntry = useCallback((id) => {
    setSession((prev) => {
      const index = prev.entries.findIndex((entry) => entry.id === id);
      if (index === -1) return prev;

      const original = prev.entries[index];
      const copy =
        original.entryType === "cardio"
          ? { id: generateId(), entryType: "cardio", cardio: original.cardio }
          : {
              id: generateId(),
              entryType: "strength",
              exercise: original.exercise,
              sets: [],
            };

      const entries = [...prev.entries];
      entries.splice(index + 1, 0, copy);

      return { ...prev, entries };
    });
  }, []);

  const replaceEntryExercise = useCallback((id, exercise) => {
    setSession((prev) => ({
      ...prev,
      entries: prev.entries.map((entry) =>
        entry.id === id && entry.entryType !== "cardio"
          ? {
              ...entry,
              exercise: {
                _id: exercise._id,
                name: exercise.name,
                muscleGroup: exercise.muscleGroup,
              },
              sets: [],
            }
          : entry
      ),
    }));
  }, []);

  const discardSession = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(getDefaultSession());
    setJustStarted(false);
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

    const sessionId = generateId();

    const finishTime = Date.now();
    const elapsedMs = session.startTime ? finishTime - session.startTime : 0;
    const sessionDurationMinutes = Math.max(0, Math.round(elapsedMs / 60000));
    const durationLabel = session.startTime
      ? formatMinutesLabel(elapsedMs)
      : null;

    try {
      const payload = {
        sessionId,
        sessionDuration: sessionDurationMinutes,
        sessionType: session.sessionType,
        customSessionType: session.customSessionType,
        startedAt: session.startTime
          ? new Date(session.startTime).toISOString()
          : null,
        endedAt: session.startTime ? new Date(finishTime).toISOString() : null,
        sessionNote: session.sessionNote,
        plannedWorkoutId: session.plannedWorkoutId || undefined,
        exercises: session.entries.map((entry) =>
          entry.entryType === "cardio"
            ? {
                entryType: "cardio",
                cardio: entry.cardio,
                note: entry.note ?? null,
              }
            : {
                entryType: "strength",
                exercise: entry.exercise._id,
                workoutSets: entry.sets.map((s) => ({
                  weight: s.weight,
                  reps: s.reps,
                })),
                note: entry.note ?? null,
              }
        ),
      };

      const res = await api.post("/workouts/session", payload);

      if (res.data?.notifications?.length) {
        window.dispatchEvent(
          new CustomEvent("repvyn:notifications-created", {
            detail: res.data.notifications,
          })
        );
      }

      localStorage.removeItem(STORAGE_KEY);
      setSession(getDefaultSession());
      setJustStarted(false);

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

      let message = `Workout saved! ${messageParts.join(", ")}${
        durationLabel ? `, ${durationLabel}` : ""
      } added to your history.`;

      const timingTipShownCount = Number(
        localStorage.getItem(TIMING_TIP_SHOWN_COUNT_KEY) || 0
      );
      if (timingTipShownCount < TIMING_TIP_MAX_SHOWS) {
        message += " Need to adjust the recorded time? Edit it anytime from Workouts.";
        localStorage.setItem(
          TIMING_TIP_SHOWN_COUNT_KEY,
          String(timingTipShownCount + 1)
        );
      }

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
    sessionNote: session.sessionNote,
    plannedWorkoutId: session.plannedWorkoutId,
    justStarted,
    isSaving,
    saveError,
    saveSuccess,
    clearSaveSuccess,
    startSession,
    startSessionFromPlan,
    confirmResume,
    addExercise,
    addCardioEntry,
    addSet,
    deleteSet,
    updateSet,
    removeEntry,
    reorderEntry,
    duplicateEntry,
    replaceEntryExercise,
    setSessionNote,
    updateEntryNote,
    discardSession,
    finishWorkout,
  };
}

export default useWorkoutSession;