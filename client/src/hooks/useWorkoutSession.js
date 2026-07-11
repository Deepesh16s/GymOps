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
  exercises: [],
});

const loadSession = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultSession();

    const parsed = JSON.parse(raw);
    return {
      active: !!parsed.active,
      startTime: parsed.startTime ?? null,
      exercises: Array.isArray(parsed.exercises) ? parsed.exercises : [],
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

  const startSession = useCallback(() => {
    setSession({
      active: true,
      startTime: Date.now(),
      exercises: [],
    });
    setSaveError("");
    clearSaveSuccess();
  }, [clearSaveSuccess]);

  const addExercise = useCallback(({ exercise, firstSet }) => {
    const entry = {
      id: generateId(),
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
      exercises: [...prev.exercises, entry],
    }));
  }, []);

  const addSet = useCallback((exerciseId, set) => {
    setSession((prev) => ({
      ...prev,
      exercises: prev.exercises.map((entry) =>
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
      const exercise = prev.exercises.find((entry) => entry.id === exerciseId);
      if (!exercise) return prev;

      const remainingSets = exercise.sets.filter((s) => s.id !== setId);

      if (remainingSets.length === 0) {
        const remainingExercises = prev.exercises.filter(
          (entry) => entry.id !== exerciseId
        );

        if (remainingExercises.length === 0) {
          return getDefaultSession();
        }

        return { ...prev, exercises: remainingExercises };
      }

      return {
        ...prev,
        exercises: prev.exercises.map((entry) =>
          entry.id === exerciseId ? { ...entry, sets: remainingSets } : entry
        ),
      };
    });
  }, []);

  const updateSet = useCallback((exerciseId, setId, updatedSet) => {
    setSession((prev) => ({
      ...prev,
      exercises: prev.exercises.map((entry) =>
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

  const removeExercise = useCallback((id) => {
    setSession((prev) => {
      const remaining = prev.exercises.filter((entry) => entry.id !== id);

      if (remaining.length === 0) {
        return getDefaultSession();
      }

      return {
        ...prev,
        exercises: remaining,
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
    if (!session.active || session.exercises.length === 0) return false;

    isSavingRef.current = true;
    setIsSaving(true);
    setSaveError("");
    clearSaveSuccess();

    const exerciseCount = session.exercises.length;
    const totalSetCount = session.exercises.reduce(
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
      // Single request for the whole session — replaces the previous
      // per-exercise POST /workouts loop. The backend creates every
      // Workout document and recalculates goals exactly once.
      const payload = {
        sessionId,
        sessionDuration: sessionDurationMinutes,
        exercises: session.exercises.map((entry) => ({
          exercise: entry.exercise._id,
          workoutSets: entry.sets.map((s) => ({
            weight: s.weight,
            reps: s.reps,
          })),
        })),
      };

      await api.post("/workouts/session", payload);

      localStorage.removeItem(STORAGE_KEY);
      setSession(getDefaultSession());

      const message = `Workout saved! ${exerciseCount} ${
        exerciseCount === 1 ? "exercise" : "exercises"
      }, ${totalSetCount} ${totalSetCount === 1 ? "set" : "sets"}${
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
    exercises: session.exercises,
    isSaving,
    saveError,
    saveSuccess,
    clearSaveSuccess,
    startSession,
    addExercise,
    addSet,
    deleteSet,
    updateSet,
    removeExercise,
    discardSession,
    finishWorkout,
  };
}

export default useWorkoutSession;