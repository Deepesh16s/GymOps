import { useMemo, useState, useRef, useEffect } from "react";
import {
  Flame,
  TrendingDown,
  TrendingUp,
  Info,
  Trophy,
  Dumbbell,
  Calendar,
} from "lucide-react";
import { computeMuscleBreakdown } from "../utils/workoutUtils";
import { MUSCLE_TO_REGIONS } from "../constants/muscles";
import { summarizeMuscleGroupSplit } from "../intelligence/balanceEngine";
import "./MuscleBodyMap.css";

const KNOWN_MUSCLES = Object.keys(MUSCLE_TO_REGIONS);

const INTENSITY_LEVELS = ["none", "light", "moderate", "high", "extreme"];
const INTENSITY_LABELS = {
  none: "None",
  light: "Light",
  moderate: "Moderate",
  high: "High",
  extreme: "Extreme",
};

// Weekly thresholds anchored to the sports-science consensus on hypertrophy volume:
// <5 sets/muscle/week is below the minimum effective dose, 5-9 yields some growth,
// 10-20 is the evidence-based "sweet spot" (ACSM / Schoenfeld et al. dose-response
// reviews), and >20 is past the point of typical diminishing returns. 30d/365d modes
// scale these same per-week thresholds by the number of weeks in the window.
const WEEKLY_INTENSITY_THRESHOLDS = { light: 1, moderate: 5, high: 10, extreme: 21 };
const MODE_WEEKS = { "7d": 1, "30d": 30 / 7, "365d": 365 / 7 };

function intensityLevel(sets, max, mode) {
  if (!sets) return "none";

  const weeks = MODE_WEEKS[mode];
  if (weeks) {
    if (sets >= WEEKLY_INTENSITY_THRESHOLDS.extreme * weeks) return "extreme";
    if (sets >= WEEKLY_INTENSITY_THRESHOLDS.high * weeks) return "high";
    if (sets >= WEEKLY_INTENSITY_THRESHOLDS.moderate * weeks) return "moderate";
    return "light";
  }

  // "Lifetime" has no fixed window to compare against, so fall back to ranking
  // muscles relative to the most-trained one over the account's full history.
  if (max === 0) return "none";
  const ratio = sets / max;
  if (ratio > 0.75) return "extreme";
  if (ratio > 0.5) return "high";
  if (ratio > 0.25) return "moderate";
  return "light";
}

const MODE_OPTIONS = [
  { key: "7d", label: "Last 7 Days", days: 7 },
  { key: "30d", label: "Last 30 Days", days: 30 },
  { key: "365d", label: "Last 365 Days", days: 365 },
  { key: "lifetime", label: "Lifetime", days: null },
];

function getCutoffForMode(mode) {
  const opt = MODE_OPTIONS.find((o) => o.key === mode);
  if (!opt || opt.days == null) return null;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (opt.days - 1));
  return d;
}

function formatLastTrained(date) {
  if (!date) return "Not yet trained";
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

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

function MuscleBodyMap({
  workouts = [],
  loading = false,
  personalRecords = {},
  onSelectMuscle = null,
  selectMuscleLabel = "View full progression",
}) {
  const [mode, setMode] = useState("30d");
  const [hovered, setHovered] = useState(null);
  const [expandedMuscle, setExpandedMuscle] = useState(null);
  const [isNarrow, setIsNarrow] = useState(false);
  const [activeBodyView, setActiveBodyView] = useState("front");
  const wrapRef = useRef(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => {
      setIsNarrow(entry.contentRect.width <= 560);
    });
    observer.observe(el);
    return () => observer.disconnect();
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
      const level = intensityLevel(sets, maxSets, mode);
      MUSCLE_TO_REGIONS[muscle].forEach((region) => {
        const existing = fills[region];
        if (!existing || sets > existing.sets) {
          fills[region] = { muscle, sets, level };
        }
      });
    });
    return fills;
  }, [entryByMuscle, maxSets, mode]);

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

  const summary = useMemo(() => {
    const trained = legendEntries;
    const neglected = KNOWN_MUSCLES.filter(
      (m) => m !== "Legs" && !entryByMuscle.get(m)?.sets
    );
    const least = trained.length > 1 ? trained[trained.length - 1] : null;

    const { pct: categoryPct } = summarizeMuscleGroupSplit(currentBreakdown, { metric: "sets" });

    return {
      most: trained[0] || null,
      least,
      neglected,
      trainedCount: trained.length,
      categoryPct,
    };
  }, [legendEntries, entryByMuscle, currentBreakdown]);

  const pctOf = (sets) => (totalSets > 0 ? Math.round((sets / totalSets) * 100) : 0);

  const handleEnter = (region, view, e) => {
    const info = regionFill[region];
    if (!info) return;
    const wrapBox = wrapRef.current?.getBoundingClientRect();
    const targetBox = e.currentTarget.getBoundingClientRect();
    if (!wrapBox) return;
    setHovered({
      muscle: info.muscle,
      view,
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

  const regionProps = (region, view) => {
    const info = regionFill[region];
    const isTop = info && info.sets > 0 && info.muscle === topMuscle;
    const isExpanded = info && info.muscle === expandedMuscle;
    return {
      fill: info ? `url(#muscle-heat-${info.level})` : "url(#muscle-heat-none)",
      onMouseEnter: (e) => handleEnter(region, view, e),
      onMouseLeave: handleLeave,
      onClick: () => handleRegionClick(region),
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
  const modeLabelPhrase = mode === "lifetime" ? "lifetime" : `in the ${modeLabel.toLowerCase()}`;

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

      <div className="muscle-map__legend">
        {INTENSITY_LEVELS.map((level) => (
          <span key={level} className="muscle-map__legend-item">
            <span className={`muscle-map__legend-swatch muscle-map__legend-swatch--${level}`} />
            {INTENSITY_LABELS[level]}
          </span>
        ))}
      </div>

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
                    <stop offset="0%" stopColor="var(--heat-none)" stopOpacity="0.34" />
                    <stop offset="100%" stopColor="var(--heat-none)" stopOpacity="0.34" />
                  </linearGradient>
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
                <div
                  className={`muscle-map__body${
                    hovered?.view === "back" ? " muscle-map__body--dim" : ""
                  }`}
                >
                  <div className="muscle-map__figure">
                  <svg viewBox="0 0 160 340" className="body-svg">
                    <ellipse cx="80" cy="19" rx="12.5" ry="15.5" className="body-static" />
                    <path
                      d="M74,30 C72,34 71,39 72,44 C72,45 74,46 76,46 L84,46 C86,46 88,45 88,44 C89,39 88,34 86,30 C84,33 76,33 74,30 Z"
                      className="body-static"
                    />

                    <path
                      d="M60,48 C50,43 38,44 30,52 C22,59 21,71 28,78 C35,85 46,85 54,78 C60,72 63,58 60,48 Z"
                      {...regionProps("shoulderL", "front")}
                    />
                    <path
                      d="M100,48 C110,43 122,44 130,52 C138,59 139,71 132,78 C125,85 114,85 106,78 C100,72 97,58 100,48 Z"
                      {...regionProps("shoulderR", "front")}
                    />

                    <path
                      d="M57,56 C56,50 62,46 70,45 C75,45 78,48 78,53 Q76,68 78,83 C78,92 73,98 66,97 C59,95 55,87 55,77 C55,70 56,63 57,56 Z"
                      {...regionProps("chest", "front")}
                    />
                    <path
                      d="M103,56 C104,50 98,46 90,45 C85,45 82,48 82,53 Q84,68 82,83 C82,92 87,98 94,97 C101,95 105,87 105,77 C105,70 104,63 103,56 Z"
                      {...regionProps("chest", "front")}
                    />

                    <path
                      d="M60,98 C60,107 63,114 66,120 C63,127 62,133 64,140 C66,148 72,152 80,152 C88,152 94,148 96,140 C98,133 97,127 94,120 C97,114 100,107 100,98 Z"
                      {...regionProps("abs", "front")}
                    />
                    <path d="M80,104 L80,150" className="body-detail-line" />

                    <path
                      d="M42,72 C46,78 47,88 45,96 C43,104 41,112 40,122 L40,128 C40,130 38,131 36,131 C34,131 32,130 32,128 L32,122 C30,112 27,104 25,96 C23,88 24,78 28,72 C32,69 38,69 42,72 Z"
                      {...regionProps("bicepL", "front")}
                    />
                    <path
                      d="M118,72 C114,78 113,88 115,96 C117,104 119,112 120,122 L120,128 C120,130 122,131 124,131 C126,131 128,130 128,128 L128,122 C130,112 133,104 135,96 C137,88 136,78 132,72 C128,69 122,69 118,72 Z"
                      {...regionProps("bicepR", "front")}
                    />

                    <path
                      d="M39,130 C42,134 43,140 42,148 C41,158 39,166 37,172 L33,172 C31,166 29,158 28,148 C27,140 28,134 31,130 C33,128 37,128 39,130 Z"
                      {...regionProps("forearmL", "front")}
                    />
                    <path
                      d="M121,130 C118,134 117,140 118,148 C119,158 121,166 123,172 L127,172 C129,166 131,158 132,148 C133,140 132,134 129,130 C127,128 123,128 121,130 Z"
                      {...regionProps("forearmR", "front")}
                    />

                    <path
                      d="M76,152 C80,160 81,174 79,188 C77,200 76,212 75,224 L64,224 C63,212 62,200 60,188 C58,174 59,160 63,152 C67,149 73,149 76,152 Z"
                      {...regionProps("quadL", "front")}
                    />
                    <path
                      d="M84,152 C80,160 79,174 81,188 C83,200 84,212 85,224 L96,224 C97,212 98,200 100,188 C102,174 101,160 97,152 C93,149 87,149 84,152 Z"
                      {...regionProps("quadR", "front")}
                    />
                    <path d="M64,224 Q80,229 96,224" className="body-detail-line" />

                    <path
                      d="M63,224 C57,232 55,246 57,260 C58,271 62,281 66,288 L71,288 C74,281 76,271 76,260 C76,246 75,232 71,224 Z"
                      className="body-static"
                    />
                    <path
                      d="M97,224 C103,232 105,246 103,260 C102,271 98,281 94,288 L89,288 C86,281 84,271 84,260 C84,246 85,232 89,224 Z"
                      className="body-static"
                    />

                    <ellipse cx="68" cy="292" rx="8.5" ry="4.5" className="body-static" />
                    <ellipse cx="92" cy="292" rx="8.5" ry="4.5" className="body-static" />
                  </svg>
                  </div>
                  <p className="muscle-map__label">Front</p>
                </div>
              )}

              {showBack && (
                <div
                  className={`muscle-map__body${
                    hovered?.view === "front" ? " muscle-map__body--dim" : ""
                  }`}
                >
                  <div className="muscle-map__figure">
                  <svg viewBox="0 0 160 340" className="body-svg">
                    <ellipse cx="80" cy="19" rx="12.5" ry="15.5" className="body-static" />
                    <path
                      d="M74,30 C72,34 71,39 72,44 C72,45 74,46 76,46 L84,46 C86,46 88,45 88,44 C89,39 88,34 86,30 C84,33 76,33 74,30 Z"
                      {...regionProps("traps", "back")}
                    />

                    <path
                      d="M52,50 C52,46 64,44 80,44 C96,44 108,46 108,50 L108,90 C108,98 100,104 90,102 C86,101 83,99 80,96 C77,99 74,101 70,102 C60,104 52,98 52,90 Z"
                      {...regionProps("upperBack", "back")}
                    />

                    <path
                      d="M58,92 C60,102 64,112 68,120 C65,128 63,136 64,144 C65,150 71,154 80,154 C89,154 95,150 96,144 C97,136 95,128 92,120 C96,112 100,102 102,92 C94,98 87,100 80,100 C73,100 66,98 58,92 Z"
                      {...regionProps("lowerBack", "back")}
                    />
                    <path d="M80,46 L80,152" className="body-detail-line" />

                    <path
                      d="M42,72 C46,78 47,88 45,96 C43,104 41,112 40,122 L40,128 C40,130 38,131 36,131 C34,131 32,130 32,128 L32,122 C30,112 27,104 25,96 C23,88 24,78 28,72 C32,69 38,69 42,72 Z"
                      {...regionProps("tricepL", "back")}
                    />
                    <path
                      d="M118,72 C114,78 113,88 115,96 C117,104 119,112 120,122 L120,128 C120,130 122,131 124,131 C126,131 128,130 128,128 L128,122 C130,112 133,104 135,96 C137,88 136,78 132,72 C128,69 122,69 118,72 Z"
                      {...regionProps("tricepR", "back")}
                    />

                    <path
                      d="M39,130 C42,134 43,140 42,148 C41,158 39,166 37,172 L33,172 C31,166 29,158 28,148 C27,140 28,134 31,130 C33,128 37,128 39,130 Z"
                      {...regionProps("forearmL", "back")}
                    />
                    <path
                      d="M121,130 C118,134 117,140 118,148 C119,158 121,166 123,172 L127,172 C129,166 131,158 132,148 C133,140 132,134 129,130 C127,128 123,128 121,130 Z"
                      {...regionProps("forearmR", "back")}
                    />

                    <path
                      d="M58,148 C58,142 66,138 80,138 C94,138 102,142 102,148 L102,160 C102,168 93,174 80,172 C67,174 58,168 58,160 Z"
                      {...regionProps("glutes", "back")}
                    />
                    <path d="M60,161 Q80,167 100,161" className="body-detail-line" />

                    <path
                      d="M76,161 C80,169 81,182 79,196 C77,208 76,216 75,224 L64,224 C63,216 62,208 60,196 C58,182 59,169 63,161 C67,158 73,158 76,161 Z"
                      {...regionProps("hamstringL", "back")}
                    />
                    <path
                      d="M84,161 C80,169 79,182 81,196 C83,208 84,216 85,224 L96,224 C97,216 98,208 100,196 C102,182 101,169 97,161 C93,158 87,158 84,161 Z"
                      {...regionProps("hamstringR", "back")}
                    />
                    <path d="M64,224 Q80,229 96,224" className="body-detail-line" />

                    <path
                      d="M63,224 C56,232 53,246 56,260 C58,271 62,281 66,288 L71,288 C74,281 76,271 76,260 C76,246 75,232 71,224 C69,222 65,222 63,224 Z"
                      {...regionProps("calfL", "back")}
                    />
                    <path
                      d="M97,224 C104,232 107,246 104,260 C102,271 98,281 94,288 L89,288 C86,281 84,271 84,260 C84,246 85,232 89,224 C91,222 95,222 97,224 Z"
                      {...regionProps("calfR", "back")}
                    />

                    <ellipse cx="68" cy="292" rx="8.5" ry="4.5" className="body-static" />
                    <ellipse cx="92" cy="292" rx="8.5" ry="4.5" className="body-static" />
                  </svg>
                  </div>
                  <p className="muscle-map__label">Back</p>
                </div>
              )}
            </div>

            <div className="muscle-map__sidelist">
              {legendEntries.length === 0 && (
                <div className="muscle-map__sidelist-empty">
                  <Dumbbell size={18} strokeWidth={1.8} />
                  <p>No sets logged yet</p>
                  <span>Log your first workout and this fills in automatically.</span>
                </div>
              )}
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
                  <Calendar size={10} strokeWidth={2} /> Not trained {modeLabelPhrase}
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
                  {onSelectMuscle ? (
                    <button
                      type="button"
                      className="muscle-map__detail-progression-btn"
                      onClick={() => onSelectMuscle(expandedMuscle)}
                    >
                      <TrendingUp size={13} strokeWidth={2} />
                      {selectMuscleLabel}
                    </button>
                  ) : (
                    <p className="muscle-map__detail-note">
                      <Info size={11} strokeWidth={2} /> Full progression history for individual
                      muscles is coming in a future update.
                    </p>
                  )}
                </>
              ) : (
                <p className="muscle-map__detail-note">
                  <Info size={11} strokeWidth={2} /> Not trained {modeLabelPhrase} yet —
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
        </>
    </div>
  );
}

export default MuscleBodyMap;
