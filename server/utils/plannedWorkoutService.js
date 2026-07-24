// Phase 13B — the business-logic layer between plannedWorkoutController
// and the PlannedWorkout model: recurrence expansion at creation time,
// the "flip overdue Planned -> Missed" lazy check (no background
// scheduler — this runs whenever the planner is actually fetched, same
// in-app-only philosophy Phase 13A's client-triggered notifications
// already established), and scoped edits/cancellation across a
// recurring series.
const mongoose = require("mongoose");
const PlannedWorkout = require("../models/PlannedWorkout");
const { generateRecurrenceDates, selectEditTargets } = require("./plannedWorkoutRecurrence");

// Any "Planned" instance whose day has fully passed with nothing logged
// against it becomes "Missed" — checked opportunistically on every
// fetch rather than by a background job. Scoped to scheduledDate before
// TODAY (not just before "now") so a workout planned for later today
// isn't marked missed while the day is still in progress.
async function flipOverdueToMissed(userId) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  await PlannedWorkout.updateMany(
    { user: userId, status: "Planned", scheduledDate: { $lt: startOfToday } },
    { status: "Missed" }
  );
}

// Creates one instance (recurrence.type === "none") or a whole series
// (every other recurrence type) in a single insertMany, all sharing one
// recurrenceGroupId when there's more than one instance. Returns the
// full array of created documents — the FIRST one is always the
// originally-requested scheduledDate.
async function createPlannedWorkout(userId, fields) {
  const dates = generateRecurrenceDates(fields.scheduledDate, fields.recurrence);
  const recurrenceGroupId = dates.length > 1 ? new mongoose.Types.ObjectId().toString() : null;

  const docs = dates.map((scheduledDate) => ({
    user: userId,
    title: fields.title,
    workoutType: fields.workoutType,
    cardioActivityType: fields.cardioActivityType || null,
    scheduledDate,
    scheduledTime: fields.scheduledTime || null,
    exercises: fields.exercises || [],
    estimatedDuration: fields.estimatedDuration || null,
    notes: fields.notes || null,
    priority: fields.priority || "Medium",
    recurrence: fields.recurrence || { type: "none" },
    recurrenceGroupId,
    status: "Planned",
  }));

  const created = await PlannedWorkout.insertMany(docs, { ordered: true });
  return created;
}

// Applies `updates` to either just `instance`, `instance` + every later
// sibling in its series, or the entire series — see
// plannedWorkoutRecurrence.selectEditTargets for the actual scope logic.
// Returns the updated documents.
async function updatePlannedWorkoutScoped(userId, instance, updates, editScope) {
  let targets = [instance];

  if (editScope !== "only" && instance.recurrenceGroupId) {
    const siblings = await PlannedWorkout.find({
      user: userId,
      recurrenceGroupId: instance.recurrenceGroupId,
    });
    targets = selectEditTargets(editScope, instance, siblings);
  }

  const ids = targets.map((doc) => doc._id);
  await PlannedWorkout.updateMany({ _id: { $in: ids } }, updates);
  return PlannedWorkout.find({ _id: { $in: ids } });
}

module.exports = {
  flipOverdueToMissed,
  createPlannedWorkout,
  updatePlannedWorkoutScoped,
};
