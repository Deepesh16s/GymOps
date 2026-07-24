import { Search, Trophy, Star, X } from "lucide-react";
import { SESSION_TYPE_FILTER_OPTIONS } from "../../constants/sessionTypes";
import { DATE_RANGE_ALL, DATE_RANGE_OPTIONS, DATE_RANGE_CUSTOM } from "../../constants/dateRanges";
import { DURATION_RANGE_ALL, DURATION_RANGE_OPTIONS } from "../../constants/durationRanges";

// Applied to a filter <select> whenever its value differs from the
// "show everything" default, so an active filter visually stands out
// instead of carrying the same weight as an untouched one.
const activeSelectClass = (isActive) =>
  `history-select ${isActive ? "history-select--active" : ""}`;

// `filters` holds every control's current value; `onChange(key, value)` is
// the single setter WorkoutHistory.jsx uses to update whichever one
// changed — keeps this component's prop list from growing by one pair
// per filter as new ones are added.
function HistoryFilterBar({ filters, muscleOptions, onChange, onClear, hasActiveFilters }) {
  const isCustomRange = filters.dateRange === DATE_RANGE_CUSTOM;

  return (
    <div className="history-controls">
      <div className="history-controls__row">
        <div className="history-search-wrap">
          <Search size={16} strokeWidth={1.8} className="history-search-wrap__icon" />
          <input
            className="history-search"
            type="text"
            placeholder="Search by workout title or exercise..."
            value={filters.search}
            onChange={(e) => onChange("search", e.target.value)}
            aria-label="Search sessions"
          />
        </div>

        <select
          className="history-select"
          value={filters.order}
          onChange={(e) => onChange("order", e.target.value)}
          aria-label="Sort sessions"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="volume">Highest volume</option>
          <option value="duration">Longest duration</option>
        </select>
      </div>

      <div className="history-controls__row history-controls__row--wrap">
        <select
          className={activeSelectClass(filters.muscle !== "All")}
          value={filters.muscle}
          onChange={(e) => onChange("muscle", e.target.value)}
          aria-label="Filter by muscle group"
        >
          {muscleOptions.map((m) => (
            <option key={m} value={m}>{m === "All" ? "All Muscles" : m}</option>
          ))}
        </select>

        <select
          className={activeSelectClass(filters.sessionType !== "All")}
          value={filters.sessionType}
          onChange={(e) => onChange("sessionType", e.target.value)}
          aria-label="Filter by session type"
        >
          {SESSION_TYPE_FILTER_OPTIONS.map((t) => (
            <option key={t} value={t}>{t === "All" ? "All Types" : t}</option>
          ))}
        </select>

        <select
          className={activeSelectClass(filters.dateRange !== DATE_RANGE_ALL)}
          value={filters.dateRange}
          onChange={(e) => onChange("dateRange", e.target.value)}
          aria-label="Filter by date range"
        >
          {DATE_RANGE_OPTIONS.map((r) => (
            <option key={r} value={r}>{r === DATE_RANGE_ALL ? "All Dates" : r}</option>
          ))}
        </select>

        {isCustomRange && (
          <div className="history-date-range-inputs">
            <input
              type="date"
              className="history-date-input"
              value={filters.customStart}
              onChange={(e) => onChange("customStart", e.target.value)}
              aria-label="Start date"
            />
            <span className="history-date-range-sep">to</span>
            <input
              type="date"
              className="history-date-input"
              value={filters.customEnd}
              onChange={(e) => onChange("customEnd", e.target.value)}
              aria-label="End date"
            />
          </div>
        )}

        <select
          className={activeSelectClass(filters.duration !== DURATION_RANGE_ALL)}
          value={filters.duration}
          onChange={(e) => onChange("duration", e.target.value)}
          aria-label="Filter by duration"
        >
          {DURATION_RANGE_OPTIONS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        <button
          type="button"
          className={`history-toggle-pill ${filters.onlyPR ? "history-toggle-pill--active" : ""}`}
          onClick={() => onChange("onlyPR", !filters.onlyPR)}
          aria-pressed={filters.onlyPR}
        >
          <Trophy size={13} strokeWidth={1.8} />
          PR Workouts
        </button>

        <button
          type="button"
          className={`history-toggle-pill ${filters.onlyFavorites ? "history-toggle-pill--active" : ""}`}
          onClick={() => onChange("onlyFavorites", !filters.onlyFavorites)}
          aria-pressed={filters.onlyFavorites}
        >
          <Star size={13} strokeWidth={1.8} fill={filters.onlyFavorites ? "currentColor" : "none"} />
          Favorites
        </button>

        {hasActiveFilters && (
          <button type="button" className="history-clear-btn" onClick={onClear}>
            <X size={13} strokeWidth={2} />
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}

export default HistoryFilterBar;
