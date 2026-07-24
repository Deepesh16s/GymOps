import { useState, useEffect, useCallback, useRef } from "react";
import api from "../services/api";

const STORAGE_KEY = "gymops_active_workout_session";
const SUCCESS_MESSAGE_DURATION = 4500;
// Workout Session Editing & Time Tracking discovery moment #1: for the
// first few workouts saved after this feature shipped, the success
// message also mentions where to fix the timing if it's wrong — after
// that it stops appearing, so it doesn't become permanent banner clutter.
const TIMING_TIP_SHOWN_COUNT_KEY = "gymops_timing_tip_shown_count";
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
  // Phase 13B — set only when this session was started via "Start
  // Planned Workout" rather than "New Workout"; threaded through to
  // POST /workouts/session so the server can link the plan to the real
  // session it produced (see workoutController.js).
  plannedWorkoutId: null,
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

  // Transient, never persisted: true only for a session started in THIS
  // tab (startSession sets it), false when a session was instead
  // hydrated from localStorage on mount — i.e. it survived a refresh or
  // the browser being closed. Dashboard uses this to decide whether to
  // silently show the live session card (justStarted) or ask "Resume
  // Workout?" first (an active session that wasn't just started here).
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
      sessionNote: null,
      plannedWorkoutId: null,
    });
    setJustStarted(true);
    setSaveError("");
    clearSaveSuccess();
  }, [clearSaveSuccess]);

  // Phase 13B — "Start Planned Workout": auto-populates type, notes, and
  // (when the plan itemized any) exercises with no sets yet — the same
  // "pending first set" shape ExerciseSessionCard already renders for
  // any freshly-added exercise, so a plan's exercises show up ready to
  // log real weight/reps, not with invented placeholder numbers.
  // plannedWorkoutId rides along in session state so finishWorkout can
  // tell the server which plan this session completes.
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

  // Called when the user explicitly chooses "Resume" on the Resume
  // Workout prompt — just clears the prompt condition, no session data
  // changes.
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

  // Swaps an entry with its immediate neighbor in the exercise list.
  // direction: "up" | "down". A no-op at either end of the list.
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

  // Inserts a copy of an entry (same exercise/cardio activity, no sets
  // yet) directly after the original — for logging the same exercise
  // again later in the workout (e.g. supersets, a repeated circuit).
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

  // Swaps out the exercise a strength entry is logging against — e.g. the
  // wrong one was picked from the exercise list. Sets logged so far are
  // cleared rather than carried over, since they were performed against
  // the old exercise and would misattribute volume/PRs to the new one.
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

    // One sessionId per Finish Workout action, shared by every workout
    // document this session produces. Never generated for a discarded
    // session — discardSession never calls this function.
    const sessionId = generateId();

    // Captured once so the elapsed-time math and the startedAt/endedAt
    // sent to the backend agree exactly with each other.
    const finishTime = Date.now();
    const elapsedMs = session.startTime ? finishTime - session.startTime : 0;
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
        // Real timing captured by the live workout timer, so the session
        // shows an accurate start/end time by default (Workout Session
        // Editing & Time Tracking) — no manual edit required unless it's
        // wrong (e.g. phone died mid-workout).
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

      // Phase 13A — instant notification feedback: the session-save
      // response already carries whatever PR/milestone/goal-completion
      // notifications the server generated for this save, so the bell
      // can show them immediately instead of waiting for its next poll.
      // Same custom-event pattern ProfileDropdown already uses
      // (gymops:user-updated) for cross-component updates without a
      // shared store.
      if (res.data?.notifications?.length) {
        window.dispatchEvent(
          new CustomEvent("gymops:notifications-created", {
            detail: res.data.notifications,
          })
        );
      }

      localStorage.removeItem(STORAGE_KEY);
      setSession(getDefaultSession());
      setJustStarted(false);

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