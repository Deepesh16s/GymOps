const mongoose = require("mongoose");
const PlannedWorkout = require("../models/PlannedWorkout");
const { generateRecurrenceDates, selectEditTargets } = require("./plannedWorkoutRecurrence");

async function flipOverdueToMissed(userId) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  await PlannedWorkout.updateMany(
    { user: userId, status: "Planned", scheduledDate: { $lt: startOfToday } },
    { status: "Missed" }
  );
}

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
