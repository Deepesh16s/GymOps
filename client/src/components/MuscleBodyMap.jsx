import { useMemo, useState, useRef } from "react";
import "./MuscleBodyMap.css";

const MUSCLE_TO_REGIONS = {
  Chest: ["chest"],
  Back: ["upperBack", "lowerBack"],
  Shoulders: ["shoulderL", "shoulderR"],
  Biceps: ["bicepL", "bicepR"],
  Triceps: ["tricepL", "tricepR"],
  Legs: ["quadL", "quadR", "calfL", "calfR"],
  Hamstrings: ["hamstringL", "hamstringR"],
  Abs: ["abs"],
};

const INTENSITY_COLORS = [
  "#e2f5ee",
  "#a7f3d0",
  "#6ee7b7",
  "#34d399",
  "#10b981",
  "#054436",
];

function bucketFor(sets, max) {
  if (!sets || sets === 0) return 0;
  if (max === 0) return 0;
  const ratio = sets / max;
  if (ratio > 0.8) return 5;
  if (ratio > 0.6) return 4;
  if (ratio > 0.4) return 3;
  if (ratio > 0.2) return 2;
  return 1;
}

// rangeLabel (optional) — e.g. "Week" / "Month" / "Year", passed down
// from Dashboard's existing RANGE_OPTIONS state. Used only for the
// caption/empty-state copy below; does not affect data fetching or the
// underlying entry-based calculation.
function MuscleBodyMap({ muscleData, loading = false, rangeLabel }) {
  const [hovered, setHovered] = useState(null);
  const wrapRef = useRef(null);

  const { setsByMuscle, maxSets, totalSets } = useMemo(() => {
    const map = {};
    let max = 0;
    let total = 0;
    muscleData.forEach((m) => {
      map[m.name] = m.value;
      total += m.value;
      if (m.value > max) max = m.value;
    });
    return { setsByMuscle: map, maxSets: max, totalSets: total };
  }, [muscleData]);

  const regionFill = useMemo(() => {
    const fills = {};
    Object.entries(MUSCLE_TO_REGIONS).forEach(([muscle, regions]) => {
      const sets = setsByMuscle[muscle] || 0;
      const bucket = bucketFor(sets, maxSets);
      const color = INTENSITY_COLORS[bucket];
      regions.forEach((region) => {
        fills[region] = { muscle, sets, color };
      });
    });
    return fills;
  }, [setsByMuscle, maxSets]);

  const legendEntries = useMemo(() => {
    return Object.keys(MUSCLE_TO_REGIONS)
      .map((muscle) => ({ muscle, sets: setsByMuscle[muscle] || 0 }))
      .filter((e) => e.sets > 0)
      .sort((a, b) => b.sets - a.sets);
  }, [setsByMuscle]);

  // Most-trained muscle — just the top of the already-sorted legend list,
  // no new computation. Used to add a highlight badge/ring to that one
  // muscle's regions and legend row, and (this round) a subtle
  // "Most trained" note inside the tooltip when hovering it.
  const topMuscle = legendEntries.length > 0 ? legendEntries[0].muscle : null;

  const pctOf = (sets) =>
    totalSets > 0 ? Math.round((sets / totalSets) * 100) : 0;

  const handleEnter = (region, e) => {
    const info = regionFill[region];
    if (!info) return;
    const wrapBox = wrapRef.current?.getBoundingClientRect();
    const targetBox = e.currentTarget.getBoundingClientRect();
    if (!wrapBox) return;
    setHovered({
      muscle: info.muscle,
      sets: info.sets,
      pct: pctOf(info.sets),
      isTop: info.sets > 0 && info.muscle === topMuscle,
      x: targetBox.left - wrapBox.left + targetBox.width / 2,
      y: targetBox.top - wrapBox.top,
    });
  };

  const handleLeave = () => setHovered(null);

  const regionProps = (region) => {
    const info = regionFill[region];
    const isTop = info && info.sets > 0 && info.muscle === topMuscle;
    return {
      fill: info?.color || INTENSITY_COLORS[0],
      onMouseEnter: (e) => handleEnter(region, e),
      onMouseLeave: handleLeave,
      className: `body-region${isTop ? " body-region--top" : ""}`,
    };
  };

  const hasData = muscleData.length > 0;
  const legendMax = legendEntries.length > 0 ? legendEntries[0].sets : 0;
  const rangeSuffix = rangeLabel ? ` this ${rangeLabel.toLowerCase()}` : "";

  // First load (or a range switch) with nothing to show yet: render a skeleton
  // instead of flashing the "no data" empty state.
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
      {!hasData ? (
        <div className="muscle-map__empty">
          <p>No sets logged{rangeSuffix}.</p>
          <span className="muscle-map__empty-sub">
            Log a session to see your muscle split.
          </span>
        </div>
      ) : (
        <>
          <p className="muscle-map__caption">
            <strong>{totalSets}</strong> total sets{rangeSuffix}
          </p>

          <div className="muscle-map__main">
            <div className="muscle-map__bodies">
              <div className="muscle-map__body">
                <svg viewBox="0 0 160 340" className="body-svg">
                  <circle cx="80" cy="20" r="15" className="body-static" />
                  <rect x="73" y="33" width="14" height="12" className="body-static" />

                  <ellipse cx="44" cy="58" rx="15" ry="11" {...regionProps("shoulderL")} />
                  <ellipse cx="116" cy="58" rx="15" ry="11" {...regionProps("shoulderR")} />

                  <path
                    d="M60 64 H100 V98 Q80 108 60 98 Z"
                    {...regionProps("chest")}
                  />

                  <rect x="64" y="100" width="32" height="46" rx="4" {...regionProps("abs")} />

                  <rect x="28" y="72" width="14" height="44" rx="6" {...regionProps("bicepL")} />
                  <rect x="118" y="72" width="14" height="44" rx="6" {...regionProps("bicepR")} />

                  <rect x="26" y="118" width="13" height="40" rx="6" className="body-static" />
                  <rect x="121" y="118" width="13" height="40" rx="6" className="body-static" />

                  <rect x="62" y="148" width="16" height="62" rx="6" {...regionProps("quadL")} />
                  <rect x="82" y="148" width="16" height="62" rx="6" {...regionProps("quadR")} />

                  <rect x="63" y="212" width="14" height="56" rx="5" className="body-static" />
                  <rect x="83" y="212" width="14" height="56" rx="5" className="body-static" />
                </svg>
                <p className="muscle-map__label">Front</p>
              </div>

              <div className="muscle-map__body">
                <svg viewBox="0 0 160 340" className="body-svg">
                  <circle cx="80" cy="20" r="15" className="body-static" />
                  <rect x="73" y="33" width="14" height="12" className="body-static" />

                  <path
                    d="M54 58 H106 V94 Q80 102 54 94 Z"
                    {...regionProps("upperBack")}
                  />

                  <rect x="64" y="96" width="32" height="38" rx="4" {...regionProps("lowerBack")} />

                  <rect x="28" y="72" width="14" height="44" rx="6" {...regionProps("tricepL")} />
                  <rect x="118" y="72" width="14" height="44" rx="6" {...regionProps("tricepR")} />

                  <rect x="26" y="118" width="13" height="40" rx="6" className="body-static" />
                  <rect x="121" y="118" width="13" height="40" rx="6" className="body-static" />

                  <path d="M60 136 H100 V152 Q80 160 60 152 Z" className="body-static" />

                  <rect x="62" y="154" width="16" height="56" rx="6" {...regionProps("hamstringL")} />
                  <rect x="82" y="154" width="16" height="56" rx="6" {...regionProps("hamstringR")} />

                  <rect x="63" y="212" width="14" height="56" rx="5" {...regionProps("calfL")} />
                  <rect x="83" y="212" width="14" height="56" rx="5" {...regionProps("calfR")} />
                </svg>
                <p className="muscle-map__label">Back</p>
              </div>
            </div>

            <div className="muscle-map__sidelist">
              {legendEntries.map((e, i) => {
                const isTop = i === 0;
                const pct = pctOf(e.sets);
                return (
                  <div
                    className={`muscle-map__sidelist-row${
                      isTop ? " muscle-map__sidelist-row--top" : ""
                    }`}
                    key={e.muscle}
                  >
                    <div className="muscle-map__sidelist-bar">
                      <div
                        className="muscle-map__sidelist-fill"
                        style={{ width: `${Math.max((e.sets / legendMax) * 100, 8)}%` }}
                      />
                    </div>
                    <span className="muscle-map__sidelist-name">
                      {e.muscle}
                      {isTop && (
                        <span className="muscle-map__top-badge">Top</span>
                      )}
                    </span>
                    <span className="muscle-map__sidelist-count">
                      {e.sets}
                      <span className="muscle-map__sidelist-pct">
                        {" "}
                        ({pct}%)
                      </span>
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
                {hovered.isTop && (
                  <span className="muscle-map__tooltip-badge">Top</span>
                )}
              </span>
              <span className="muscle-map__tooltip-card-sets">
                {hovered.sets} sets · {hovered.pct}%
              </span>
              {hovered.isTop && (
                <span className="muscle-map__tooltip-subtle">
                  Most trained
                </span>
              )}
            </div>
          )}

          <div className="muscle-map__legend">
            <span className="muscle-map__legend-label">Less</span>
            {INTENSITY_COLORS.slice(1).map((color, i) => (
              <span
                key={i}
                className="muscle-map__legend-swatch"
                style={{ background: color }}
              />
            ))}
            <span className="muscle-map__legend-label">More</span>
          </div>
        </>
      )}
    </div>
  );
}

export default MuscleBodyMap;