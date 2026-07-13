import { useMemo, useState, useRef, useEffect } from "react";
import {
  Flame,
  TrendingDown,
  Info,
  Trophy,
  Dumbbell,
  Calendar,
} from "lucide-react";
import { startOfWeek, startOfMonth } from "../utils/dateUtils";
import { computeMuscleBreakdown, MUSCLE_SPLIT_CATEGORY } from "../utils/workoutUtils";
import "./MuscleBodyMap.css";

// "Legs" stays mapped (quads+calves combined) as a legacy fallback for
// exercises already seeded/created with that muscleGroup — no backend
// data migration has been run to reclassify them, so removing "Legs"
// entirely would make that existing data invisible on the map. Quads/
// Glutes/Calves/Forearms are new, more granular groups going forward:
// any exercise created with one of these muscleGroup values (the
// AddWorkoutModal dropdown now offers them) lights up its own region
// and its own line in the breakdown, without touching existing data.
// Forearms and the glutes region reuse shapes that already existed in
// the SVG as non-interactive "body-static" fills — not new anatomy.
const MUSCLE_TO_REGIONS = {
  Chest: ["chest"],
  Back: ["upperBack", "lowerBack"],
  Shoulders: ["shoulderL", "shoulderR"],
  Biceps: ["bicepL", "bicepR"],
  Triceps: ["tricepL", "tricepR"],
  Forearms: ["forearmL", "forearmR"],
  Legs: ["quadL", "quadR", "calfL", "calfR"],
  Quads: ["quadL", "quadR"],
  Glutes: ["glutes"],
  Calves: ["calfL", "calfR"],
  Hamstrings: ["hamstringL", "hamstringR"],
  Abs: ["abs"],
};

const KNOWN_MUSCLES = Object.keys(MUSCLE_TO_REGIONS);

// Named intensity tiers instead of a flat 6-step color array — each maps
// to an SVG gradient (defined once in <defs> below) so a region reads as
// having depth/glow rather than a single flat swatch. "None" (zero sets)
// stays a plain neutral fill, matching the previous behavior.
const INTENSITY_LEVELS = ["none", "light", "moderate", "high", "extreme"];
const INTENSITY_LABELS = {
  none: "None",
  light: "Light",
  moderate: "Moderate",
  high: "High",
  extreme: "Extreme",
};

function intensityLevel(sets, max) {
  if (!sets || max === 0) return "none";
  const ratio = sets / max;
  if (ratio > 0.75) return "extreme";
  if (ratio > 0.5) return "high";
  if (ratio > 0.25) return "moderate";
  return "light";
}

const MODE_OPTIONS = [
  { key: "week", label: "Weekly" },
  { key: "month", label: "Monthly" },
  { key: "90days", label: "Last 90 Days" },
  { key: "lifetime", label: "Lifetime" },
];

function ninetyDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 89);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getCutoffForMode(mode) {
  if (mode === "week") return startOfWeek();
  if (mode === "month") return startOfMonth();
  if (mode === "90days") return ninetyDaysAgo();
  return null; // lifetime — no cutoff
}

function formatLastTrained(date) {
  if (!date) return "Not yet trained";
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Cross-references a muscle's contributing exercises (ranked by sets,
// from computeMuscleBreakdown) against the already-fetched
// personal-records map to find whichever has the highest recorded PR.
// Real data only — an exercise only appears here if the backend's
// /dashboard/personal-records endpoint actually returned a weight for it.
function getPrForMuscle(entry, personalRecords) {
  if (!entry?.exercises?.length || !personalRecords) return null;
  let best = null;
  entry.exercises.forEach((name) => {
    const weight = personalRecords[name];
    if (typeof weight === "number" && (!best || weight > best.weight)) {
      best = { exercise: name, weight };
    }
  });
  return best;
}

// workouts: raw Workout documents (Muscle Body Map enhancement) —
// breakdown for every mode is derived client-side from this single
// array via the shared computeMuscleBreakdown utility, so switching
// Weekly/Monthly/90 Days/Lifetime is instant (no extra request).
// personalRecords: the exercise-name -> weight map already fetched by
// Dashboard's session-summary pipeline (see getPrForMuscle above).
function MuscleBodyMap({ workouts = [], loading = false, personalRecords = {} }) {
  const [mode, setMode] = useState("month");
  const [hovered, setHovered] = useState(null);
  const [expandedMuscle, setExpandedMuscle] = useState(null);
  const [isNarrow, setIsNarrow] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= 560
  );
  const [activeBodyView, setActiveBodyView] = useState("front");
  const wrapRef = useRef(null);

  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth <= 560);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const breakdownByMode = useMemo(() => {
    const result = {};
    MODE_OPTIONS.forEach(({ key }) => {
      result[key] = computeMuscleBreakdown(workouts, getCutoffForMode(key));
    });
    return result;
  }, [workouts]);

  const currentBreakdown = breakdownByMode[mode];

  const { entryByMuscle, maxSets, totalSets } = useMemo(() => {
    const map = new Map();
    let max = 0;
    let total = 0;
    currentBreakdown.forEach((entry) => {
      map.set(entry.muscle, entry);
      total += entry.sets;
      if (entry.sets > max) max = entry.sets;
    });
    return { entryByMuscle: map, maxSets: max, totalSets: total };
  }, [currentBreakdown]);

  const regionFill = useMemo(() => {
    const fills = {};
    KNOWN_MUSCLES.forEach((muscle) => {
      const entry = entryByMuscle.get(muscle);
      const sets = entry?.sets || 0;
      const level = intensityLevel(sets, maxSets);
      MUSCLE_TO_REGIONS[muscle].forEach((region) => {
        const existing = fills[region];
        // Several muscle names can share a region (legacy "Legs" vs the
        // newer "Quads"/"Calves" covering the same shapes) — whichever
        // actually has real data for this region should win the visual
        // claim, not just whichever happens to be processed last.
        if (!existing || sets > existing.sets) {
          fills[region] = { muscle, sets, level };
        }
      });
    });
    return fills;
  }, [entryByMuscle, maxSets]);

  const legendEntries = useMemo(() => {
    return KNOWN_MUSCLES.map((muscle) => ({
      muscle,
      entry: entryByMuscle.get(muscle) || null,
      sets: entryByMuscle.get(muscle)?.sets || 0,
    }))
      .filter((e) => e.sets > 0)
      .sort((a, b) => b.sets - a.sets);
  }, [entryByMuscle]);

  const topMuscle = legendEntries.length > 0 ? legendEntries[0].muscle : null;

  // Summary panel — every figure here is a plain, disclosed count over
  // real logged sets (Push/Pull/Legs/Core is the same standard split
  // Guide.jsx already explains to users). Nothing here is estimated.
  const summary = useMemo(() => {
    const trained = legendEntries;
    // "Legs" is a legacy fallback for exercises created before Quads/
    // Glutes/Calves existed as their own groups — new exercises use the
    // finer-grained groups instead, so "Legs" would otherwise show as
    // perpetually "neglected" for every new user who never logs
    // anything under that exact legacy tag.
    const neglected = KNOWN_MUSCLES.filter(
      (m) => m !== "Legs" && !entryByMuscle.get(m)?.sets
    );
    const least = trained.length > 1 ? trained[trained.length - 1] : null;

    const byCategory = { Push: 0, Pull: 0, Legs: 0, Core: 0 };
    KNOWN_MUSCLES.forEach((muscle) => {
      const cat = MUSCLE_SPLIT_CATEGORY[muscle];
      byCategory[cat] += entryByMuscle.get(muscle)?.sets || 0;
    });
    const categoryTotal = Object.values(byCategory).reduce((a, b) => a + b, 0) || 1;

    return {
      most: trained[0] || null,
      least,
      neglected,
      trainedCount: trained.length,
      categoryPct: Object.fromEntries(
        Object.entries(byCategory).map(([k, v]) => [k, Math.round((v / categoryTotal) * 100)])
      ),
    };
  }, [legendEntries, entryByMuscle]);

  const pctOf = (sets) => (totalSets > 0 ? Math.round((sets / totalSets) * 100) : 0);

  const handleEnter = (region, e) => {
    const info = regionFill[region];
    if (!info) return;
    const wrapBox = wrapRef.current?.getBoundingClientRect();
    const targetBox = e.currentTarget.getBoundingClientRect();
    if (!wrapBox) return;
    setHovered({
      muscle: info.muscle,
      x: targetBox.left - wrapBox.left + targetBox.width / 2,
      y: targetBox.top - wrapBox.top,
    });
  };

  const handleLeave = () => setHovered(null);

  const handleRegionClick = (region) => {
    const info = regionFill[region];
    if (!info) return;
    setExpandedMuscle((prev) => (prev === info.muscle ? null : info.muscle));
  };

  const regionProps = (region) => {
    const info = regionFill[region];
    const isTop = info && info.sets > 0 && info.muscle === topMuscle;
    const isExpanded = info && info.muscle === expandedMuscle;
    return {
      fill: info ? `url(#muscle-heat-${info.level})` : "url(#muscle-heat-none)",
      onMouseEnter: (e) => handleEnter(region, e),
      onMouseLeave: handleLeave,
      onClick: () => handleRegionClick(region),
      // Keyboard-operable, matching the sidelist rows below — without
      // this, a keyboard-only user could reach the trained muscles via
      // the sidelist but had no way to reach an untrained one (which
      // has no corresponding sidelist row) since <rect>/<path>/<ellipse>
      // aren't natively focusable or clickable via Enter/Space.
      tabIndex: info ? 0 : -1,
      role: info ? "button" : undefined,
      "aria-label": info ? `${info.muscle}, ${info.sets} sets` : undefined,
      onKeyDown: info
        ? (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleRegionClick(region);
            }
          }
        : undefined,
      className: `body-region${isTop ? " body-region--top" : ""}${
        isExpanded ? " body-region--expanded" : ""
      }`,
    };
  };

  const hasData = workouts.length > 0;
  const legendMax = legendEntries.length > 0 ? legendEntries[0].sets : 0;
  const modeLabel = MODE_OPTIONS.find((m) => m.key === mode)?.label || "";

  const hoveredEntry = hovered ? entryByMuscle.get(hovered.muscle) : null;
  const hoveredPr = hoveredEntry ? getPrForMuscle(hoveredEntry, personalRecords) : null;

  const expandedEntry = expandedMuscle ? entryByMuscle.get(expandedMuscle) : null;
  const expandedPr = expandedEntry ? getPrForMuscle(expandedEntry, personalRecords) : null;

  const showFront = !isNarrow || activeBodyView === "front";
  const showBack = !isNarrow || activeBodyView === "back";

  if (loading && !hasData) {
    return (
      <div className="muscle-map muscle-map--loading">
        <span
          className="skeleton"
          style={{ width: "100%", height: 220, borderRadius: 12, display: "block" }}
        />
      </div>
    );
  }

  return (
    <div className="muscle-map" ref={wrapRef}>
      <div className="muscle-map__head">
        <div>
          <p className="muscle-map__title">Muscle Split</p>
          <p className="muscle-map__caption-inline">
            {hasData ? (
              <>
                <strong>{totalSets}</strong> total sets · {modeLabel.toLowerCase()}
              </>
            ) : (
              "Sets distribution by muscle group"
            )}
          </p>
        </div>
        <div className="muscle-map__mode-toggle">
          {MODE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={`muscle-map__mode-btn ${
                mode === opt.key ? "muscle-map__mode-btn--active" : ""
              }`}
              onClick={() => setMode(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <div className="muscle-map__empty">
          <p>No sets logged yet.</p>
          <span className="muscle-map__empty-sub">
            Log a session to see your muscle split.
          </span>
        </div>
      ) : (
        <>
          {isNarrow && (
            <div className="muscle-map__view-toggle">
              <button
                type="button"
                className={`muscle-map__view-btn ${
                  activeBodyView === "front" ? "muscle-map__view-btn--active" : ""
                }`}
                onClick={() => setActiveBodyView("front")}
              >
                Front
              </button>
              <button
                type="button"
                className={`muscle-map__view-btn ${
                  activeBodyView === "back" ? "muscle-map__view-btn--active" : ""
                }`}
                onClick={() => setActiveBodyView("back")}
              >
                Back
              </button>
            </div>
          )}

          <div className="muscle-map__main">
            <div className="muscle-map__bodies">
              <svg width="0" height="0" style={{ position: "absolute" }}>
                <defs>
                  <linearGradient id="muscle-heat-none" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--heat-none)" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="var(--heat-none)" stopOpacity="0.35" />
                  </linearGradient>
                  {/* Cool-to-hot thermal scale (blue -> teal -> amber -> red)
                      instead of shades of the brand color — reads as
                      "intensity" at a glance and stays consistent whether
                      the brand primary is green (light theme) or blue
                      (dark theme). */}
                  <linearGradient id="muscle-heat-light" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--heat-light-a)" />
                    <stop offset="100%" stopColor="var(--heat-light-b)" />
                  </linearGradient>
                  <linearGradient id="muscle-heat-moderate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--heat-moderate-a)" />
                    <stop offset="100%" stopColor="var(--heat-moderate-b)" />
                  </linearGradient>
                  <linearGradient id="muscle-heat-high" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--heat-high-a)" />
                    <stop offset="100%" stopColor="var(--heat-high-b)" />
                  </linearGradient>
                  <linearGradient id="muscle-heat-extreme" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--heat-extreme-a)" />
                    <stop offset="100%" stopColor="var(--heat-extreme-b)" />
                  </linearGradient>
                </defs>
              </svg>

              {showFront && (
                <div className="muscle-map__body">
                  <svg viewBox="0 0 160 340" className="body-svg">
                    <circle cx="80" cy="20" r="16" className="body-static" />
                    <rect x="72" y="33" width="16" height="13" rx="4" className="body-static" />

                    <ellipse cx="44" cy="58" rx="16" ry="12" {...regionProps("shoulderL")} />
                    <ellipse cx="116" cy="58" rx="16" ry="12" {...regionProps("shoulderR")} />

                    <path
                      d="M58 64 H102 V99 Q80 110 58 99 Z"
                      {...regionProps("chest")}
                    />

                    <rect x="63" y="101" width="34" height="47" rx="11" {...regionProps("abs")} />

                    <rect x="27" y="72" width="15" height="44" rx="7.5" {...regionProps("bicepL")} />
                    <rect x="118" y="72" width="15" height="44" rx="7.5" {...regionProps("bicepR")} />

                    <rect x="25" y="118" width="14" height="40" rx="7" {...regionProps("forearmL")} />
                    <rect x="121" y="118" width="14" height="40" rx="7" {...regionProps("forearmR")} />

                    <rect x="61" y="148" width="17" height="63" rx="8" {...regionProps("quadL")} />
                    <rect x="82" y="148" width="17" height="63" rx="8" {...regionProps("quadR")} />

                    <rect x="62" y="212" width="15" height="56" rx="7" className="body-static" />
                    <rect x="83" y="212" width="15" height="56" rx="7" className="body-static" />
                  </svg>
                  <p className="muscle-map__label">Front</p>
                </div>
              )}

              {showBack && (
                <div className="muscle-map__body">
                  <svg viewBox="0 0 160 340" className="body-svg">
                    <circle cx="80" cy="20" r="16" className="body-static" />
                    <rect x="72" y="33" width="16" height="13" rx="4" className="body-static" />

                    <path
                      d="M52 58 H108 V95 Q80 104 52 95 Z"
                      {...regionProps("upperBack")}
                    />

                    <rect x="63" y="97" width="34" height="39" rx="10" {...regionProps("lowerBack")} />

                    <rect x="27" y="72" width="15" height="44" rx="7.5" {...regionProps("tricepL")} />
                    <rect x="118" y="72" width="15" height="44" rx="7.5" {...regionProps("tricepR")} />

                    <rect x="25" y="118" width="14" height="40" rx="7" {...regionProps("forearmL")} />
                    <rect x="121" y="118" width="14" height="40" rx="7" {...regionProps("forearmR")} />

                    <path d="M59 137 H101 V153 Q80 161 59 153 Z" {...regionProps("glutes")} />

                    <rect x="61" y="155" width="17" height="56" rx="8" {...regionProps("hamstringL")} />
                    <rect x="82" y="155" width="17" height="56" rx="8" {...regionProps("hamstringR")} />

                    <rect x="62" y="212" width="15" height="56" rx="7" {...regionProps("calfL")} />
                    <rect x="83" y="212" width="15" height="56" rx="7" {...regionProps("calfR")} />
                  </svg>
                  <p className="muscle-map__label">Back</p>
                </div>
              )}
            </div>

            <div className="muscle-map__sidelist">
              {legendEntries.map((e, i) => {
                const isTop = i === 0;
                const pct = pctOf(e.sets);
                return (
                  <div
                    className={`muscle-map__sidelist-row${
                      isTop ? " muscle-map__sidelist-row--top" : ""
                    }${e.muscle === expandedMuscle ? " muscle-map__sidelist-row--active" : ""}`}
                    key={e.muscle}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setExpandedMuscle((prev) => (prev === e.muscle ? null : e.muscle))
                    }
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" || ev.key === " ") {
                        ev.preventDefault();
                        setExpandedMuscle((prev) => (prev === e.muscle ? null : e.muscle));
                      }
                    }}
                  >
                    <div className="muscle-map__sidelist-bar">
                      <div
                        className="muscle-map__sidelist-fill"
                        style={{ width: `${Math.max((e.sets / legendMax) * 100, 8)}%` }}
                      />
                    </div>
                    <span className="muscle-map__sidelist-name">
                      {e.muscle}
                      {isTop && <span className="muscle-map__top-badge">Top</span>}
                    </span>
                    <span className="muscle-map__sidelist-count">
                      {e.sets}
                      <span className="muscle-map__sidelist-pct"> ({pct}%)</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {hovered && (
            <div
              className="muscle-map__tooltip-card"
              style={{ left: hovered.x, top: hovered.y }}
            >
              <span className="muscle-map__tooltip-card-name">
                {hovered.muscle}
                {hovered.muscle === topMuscle && (
                  <span className="muscle-map__tooltip-badge">Top</span>
                )}
              </span>
              {hoveredEntry ? (
                <>
                  <span className="muscle-map__tooltip-row">
                    <Dumbbell size={10} strokeWidth={2} /> {hoveredEntry.sets} sets ·{" "}
                    {Math.round(hoveredEntry.volume).toLocaleString()} kg
                  </span>
                  <span className="muscle-map__tooltip-row">
                    <Calendar size={10} strokeWidth={2} /> {formatLastTrained(hoveredEntry.lastTrained)}
                  </span>
                  {hoveredEntry.bestExercise && (
                    <span className="muscle-map__tooltip-row">
                      <Flame size={10} strokeWidth={2} /> Most trained: {hoveredEntry.bestExercise}
                    </span>
                  )}
                  {hoveredPr && (
                    <span className="muscle-map__tooltip-row">
                      <Trophy size={10} strokeWidth={2} /> PR: {hoveredPr.exercise} — {hoveredPr.weight} kg
                    </span>
                  )}
                </>
              ) : (
                <span className="muscle-map__tooltip-row">
                  <Calendar size={10} strokeWidth={2} /> Not trained {modeLabel.toLowerCase()}
                </span>
              )}
              <span className="muscle-map__tooltip-row muscle-map__tooltip-row--muted">
                <Info size={10} strokeWidth={2} /> Recovery tracking coming soon
              </span>
            </div>
          )}

          {expandedMuscle && (
            <div className="muscle-map__detail">
              <div className="muscle-map__detail-head">
                <span className="muscle-map__detail-title">{expandedMuscle} Detail</span>
                <button
                  type="button"
                  className="muscle-map__detail-close"
                  onClick={() => setExpandedMuscle(null)}
                  aria-label="Close detail"
                >
                  ×
                </button>
              </div>
              {expandedEntry ? (
                <>
                  <div className="muscle-map__detail-grid">
                    <div className="muscle-map__detail-item">
                      <span>Sets ({modeLabel})</span>
                      <strong>{expandedEntry.sets}</strong>
                    </div>
                    <div className="muscle-map__detail-item">
                      <span>Volume ({modeLabel})</span>
                      <strong>{Math.round(expandedEntry.volume).toLocaleString()} kg</strong>
                    </div>
                    <div className="muscle-map__detail-item">
                      <span>Sessions</span>
                      <strong>{expandedEntry.sessionCount}</strong>
                    </div>
                    <div className="muscle-map__detail-item">
                      <span>Last trained</span>
                      <strong>{formatLastTrained(expandedEntry.lastTrained)}</strong>
                    </div>
                    <div className="muscle-map__detail-item">
                      <span>Most-trained exercise</span>
                      <strong>{expandedEntry.bestExercise || "—"}</strong>
                    </div>
                    <div className="muscle-map__detail-item">
                      <span>Personal record</span>
                      <strong>{expandedPr ? `${expandedPr.exercise} — ${expandedPr.weight} kg` : "—"}</strong>
                    </div>
                  </div>
                  <p className="muscle-map__detail-note">
                    <Info size={11} strokeWidth={2} /> Full progression history for individual
                    muscles is coming in a future update.
                  </p>
                </>
              ) : (
                <p className="muscle-map__detail-note">
                  <Info size={11} strokeWidth={2} /> Not trained {modeLabel.toLowerCase()} yet —
                  log a session that includes {expandedMuscle.toLowerCase()} to see stats here.
                </p>
              )}
            </div>
          )}

          <div className="muscle-map__summary">
            <div className="muscle-map__summary-item">
              <span className="muscle-map__summary-label">Most trained</span>
              <strong>{summary.most?.muscle || "—"}</strong>
            </div>
            <div className="muscle-map__summary-item">
              <span className="muscle-map__summary-label">Least trained</span>
              <strong>{summary.least?.muscle || "—"}</strong>
            </div>
            <div className="muscle-map__summary-item muscle-map__summary-item--wide">
              <span className="muscle-map__summary-label">
                <TrendingDown size={11} strokeWidth={2} /> Neglected
              </span>
              <strong>
                {summary.neglected.length > 0 ? summary.neglected.join(", ") : "None"}
              </strong>
            </div>
            <div className="muscle-map__summary-item muscle-map__summary-item--wide">
              <span className="muscle-map__summary-label">Push / Pull / Legs / Core</span>
              <div className="muscle-map__ppl-bar">
                <span
                  className="muscle-map__ppl-seg muscle-map__ppl-seg--push"
                  style={{ width: `${summary.categoryPct.Push}%` }}
                  title={`Push ${summary.categoryPct.Push}%`}
                />
                <span
                  className="muscle-map__ppl-seg muscle-map__ppl-seg--pull"
                  style={{ width: `${summary.categoryPct.Pull}%` }}
                  title={`Pull ${summary.categoryPct.Pull}%`}
                />
                <span
                  className="muscle-map__ppl-seg muscle-map__ppl-seg--legs"
                  style={{ width: `${summary.categoryPct.Legs}%` }}
                  title={`Legs ${summary.categoryPct.Legs}%`}
                />
                <span
                  className="muscle-map__ppl-seg muscle-map__ppl-seg--core"
                  style={{ width: `${summary.categoryPct.Core}%` }}
                  title={`Core ${summary.categoryPct.Core}%`}
                />
              </div>
              <span className="muscle-map__ppl-legend">
                <i className="muscle-map__ppl-dot muscle-map__ppl-dot--push" />Push {summary.categoryPct.Push}%
                <i className="muscle-map__ppl-dot muscle-map__ppl-dot--pull" />Pull {summary.categoryPct.Pull}%
                <i className="muscle-map__ppl-dot muscle-map__ppl-dot--legs" />Legs {summary.categoryPct.Legs}%
                <i className="muscle-map__ppl-dot muscle-map__ppl-dot--core" />Core {summary.categoryPct.Core}%
              </span>
            </div>
          </div>

          <div className="muscle-map__legend">
            {INTENSITY_LEVELS.map((level) => (
              <span key={level} className="muscle-map__legend-item">
                <span className={`muscle-map__legend-swatch muscle-map__legend-swatch--${level}`} />
                {INTENSITY_LABELS[level]}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default MuscleBodyMap;
