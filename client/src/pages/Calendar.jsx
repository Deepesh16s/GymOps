import "./calendar.css";
import Navbar from "../components/Navbar";
import { useEffect, useState } from "react";
import api from "../services/api";

function CalendarPage() {
  const [workouts, setWorkouts] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);

  const today = new Date();

  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  useEffect(() => {
    const fetchWorkouts = async () => {
      try {
        const res = await api.get(
          "/dashboard/calendar-workouts"
        );

        setWorkouts(res.data);
      } catch (error) {
        console.log(error);
      }
    };

    fetchWorkouts();
  }, []);

  // yyyy-mm-dd
  const workoutDates = new Set(
    workouts.map((w) =>
      new Date(w.date)
        .toISOString()
        .split("T")[0]
    )
  );

  const firstDay = new Date(
    currentYear,
    currentMonth,
    1
  ).getDay();

  const daysInMonth = new Date(
    currentYear,
    currentMonth + 1,
    0
  ).getDate();

  const calendarDays = [];

  // empty cells
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }

  // month days
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }

  const getDateKey = (day) => {
    return `${currentYear}-${String(
      currentMonth + 1
    ).padStart(2, "0")}-${String(day).padStart(
      2,
      "0"
    )}`;
  };

  const selectedWorkouts = selectedDate
    ? workouts.filter(
        (w) =>
          new Date(w.date)
            .toISOString()
            .split("T")[0] === selectedDate
      )
    : [];

  return (
    <div className="calendar-page">
      <Navbar />

      <main className="calendar-main">
        <div className="calendar-card">
          <h1 className="calendar-title">
            Workout Calendar
          </h1>

          <div className="calendar-grid">
            {[
              "Sun",
              "Mon",
              "Tue",
              "Wed",
              "Thu",
              "Fri",
              "Sat",
            ].map((day) => (
              <div
                key={day}
                className="calendar-weekday"
              >
                {day}
              </div>
            ))}

            {calendarDays.map((day, index) => {
              if (!day) {
                return (
                  <div
                    key={index}
                    className="calendar-cell empty"
                  />
                );
              }

              const dateKey =
                getDateKey(day);

              const hasWorkout =
                workoutDates.has(dateKey);

              return (
                <div
                  key={index}
                  className={`calendar-cell ${
                    hasWorkout
                      ? "workout-day"
                      : ""
                  }`}
                  onClick={() =>
                    setSelectedDate(
                      dateKey
                    )
                  }
                >
                  <span>{day}</span>

                  {hasWorkout && (
                    <div className="calendar-dot" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="calendar-details-card">
          <h2>
            {selectedDate
              ? selectedDate
              : "Select a day"}
          </h2>

          {selectedDate &&
            selectedWorkouts.length ===
              0 && (
              <p>
                No workouts on this day.
              </p>
            )}

          {selectedWorkouts.map(
            (workout) => (
              <div
                key={workout._id}
                className="workout-entry"
              >
                <h3>
                  {
                    workout.exercise
                      ?.name
                  }
                </h3>

                {workout.workoutSets.map(
                  (set, i) => (
                    <p key={i}>
                      Set {i + 1}:{" "}
                      {set.weight}kg ×{" "}
                      {set.reps}
                    </p>
                  )
                )}
              </div>
            )
          )}
        </div>
      </main>
    </div>
  );
}

export default CalendarPage;