import "./calendar.css";
import Navbar from "../components/Navbar";
import { useEffect, useState } from "react";
import api from "../services/api";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Flame,
} from "lucide-react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const getLocalDateKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function CalendarPage() {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);

  const today = new Date();

  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());

  useEffect(() => {
    const fetchWorkouts = async () => {
      try {
        const res = await api.get("/dashboard/calendar-workouts");
        setWorkouts(res.data);
      } catch (error) {
        console.log(error);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkouts();
  }, []);

  const workoutDates = new Set(
    workouts.map((w) => getLocalDateKey(w.date))
  );

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const calendarDays = [];

  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }

  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }

  const getDateKey = (day) => {
    return `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };

  const todayKey = getLocalDateKey(today);

  const selectedWorkouts = selectedDate
    ? workouts.filter((w) => getLocalDateKey(w.date) === selectedDate)
    : [];

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const goToToday = () => {
    setViewMonth(today.getMonth());
    setViewYear(today.getFullYear());
    setSelectedDate(todayKey);
  };

  return (
    <div className="calendar-page">
      <Navbar />

      <main className="calendar-main">
        <div className="calendar-card go-card">
          <div className="calendar-header">
            <div>
              <h1 className="calendar-title go-page-title">
                Workout Calendar
              </h1>

              <p className="go-page-subtitle">
                See every session at a glance.
              </p>
            </div>

            <div className="calendar-nav">
              <button
                type="button"
                className="calendar-nav-btn"
                onClick={goToPrevMonth}
                aria-label="Previous month"
              >
                <ChevronLeft size={18} />
              </button>

              <span className="calendar-month-label">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>

              <button
                type="button"
                className="calendar-nav-btn"
                onClick={goToNextMonth}
                aria-label="Next month"
              >
                <ChevronRight size={18} />
              </button>

              <button
                type="button"
                className="calendar-today-btn"
                onClick={goToToday}
              >
                Today
              </button>
            </div>
          </div>

          {loading ? (
            <div className="calendar-grid">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="calendar-cell go-skeleton" />
              ))}
            </div>
          ) : (
            <div className="calendar-grid">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="calendar-weekday">
                  {day}
                </div>
              ))}

              {calendarDays.map((day, index) => {
                if (!day) {
                  return <div key={index} className="calendar-cell empty" />;
                }

                const dateKey = getDateKey(day);
                const hasWorkout = workoutDates.has(dateKey);
                const isToday = dateKey === todayKey;
                const isSelected = dateKey === selectedDate;

                return (
                  <button
                    type="button"
                    key={index}
                    className={[
                      "calendar-cell",
                      hasWorkout ? "workout-day" : "",
                      isToday ? "is-today" : "",
                      isSelected ? "is-selected" : "",
                    ].join(" ").trim()}
                    onClick={() => setSelectedDate(dateKey)}
                  >
                    <span className="calendar-cell-day">{day}</span>
                    {hasWorkout && <div className="calendar-dot" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="calendar-details-card go-card">
          <div className="calendar-details-header">
            <CalendarDays size={16} strokeWidth={1.8} />
            <h2>{selectedDate ? formatLongDate(selectedDate) : "Select a day"}</h2>
          </div>

          {!selectedDate && (
            <div className="go-empty">
              <div className="go-empty-icon">
                <CalendarDays size={20} strokeWidth={1.8} />
              </div>
              <p className="go-empty-title">No date selected</p>
              <p className="go-empty-sub">
                Tap any day on the calendar to see what you trained.
              </p>
            </div>
          )}

          {selectedDate && selectedWorkouts.length === 0 && (
            <div className="go-empty">
              <div className="go-empty-icon">
                <Flame size={20} strokeWidth={1.8} />
              </div>
              <p className="go-empty-title">Rest day</p>
              <p className="go-empty-sub">No workouts logged on this day.</p>
            </div>
          )}

          <div className="workout-entry-list">
            {selectedWorkouts.map((workout) => (
              <div key={workout._id} className="workout-entry">
                <h3>{workout.exercise?.name}</h3>
                <div className="workout-entry-sets">
                  {workout.workoutSets.map((set, i) => (
                    <span key={i} className="workout-set-chip">
                      Set {i + 1} · {set.weight}kg × {set.reps}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function formatLongDate(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default CalendarPage;