import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "gymops_active_workout_session";

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
function useWorkoutSession() {
  const [session, setSession] = useState(loadSession);

  useEffect(() => {
    saveSession(session);
  }, [session]);

  const startSession = useCallback(() => {
    setSession({
      active: true,
      startTime: Date.now(),
      exercises: [],
    });
  }, []);
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
  const discardSession = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(getDefaultSession());
  }, []);

  return {
    active: session.active,
    startTime: session.startTime,
    exercises: session.exercises,
    startSession,
    addExercise,
    discardSession,
  };
}

export default useWorkoutSession;