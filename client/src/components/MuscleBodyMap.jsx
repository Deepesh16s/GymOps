import { useMemo, useState, useRef } from "react";
import "./MuscleBodyMap.css";

/* maps each dashboard muscle group name to the svg region(s) that
   should light up for it. some groups touch more than one region
   (legs covers both quads + calves outlines) */
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

/* 5-step intensity scale, light -> dark. index 0 = no sets logged
   (kept neutral/very light so it doesn't read as "trained").
   index 5 = highest volume group, darkest/most saturated green. */
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

function MuscleBodyMap({ muscleData }) {
  const [hovered, setHovered] = useState(null);
  const wrapRef = useRef(null);

  const { setsByMuscle, maxSets } = useMemo(() => {
    const map = {};
    let max = 0;
    muscleData.forEach((m) => {
      map[m.name] = m.value;
      if (m.value > max) max = m.value;
    });
    return { setsByMuscle: map, maxSets: max };
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

  /* sorted list for the side legend - highest volume first */
  const legendEntries = useMemo(() => {
    return Object.keys(MUSCLE_TO_REGIONS)
      .map((muscle) => ({ muscle, sets: setsByMuscle[muscle] || 0 }))
      .filter((e) => e.sets > 0)
      .sort((a, b) => b.sets - a.sets);
  }, [setsByMuscle]);

  const handleEnter = (region, e) => {
    const info = regionFill[region];
    if (!info) return;
    const wrapBox = wrapRef.current?.getBoundingClientRect();
    const targetBox = e.currentTarget.getBoundingClientRect();
    if (!wrapBox) return;
    setHovered({
      muscle: info.muscle,
      sets: info.sets,
      x: targetBox.left - wrapBox.left + targetBox.width / 2,
      y: targetBox.top - wrapBox.top,
    });
  };

  const handleLeave = () => setHovered(null);

  const regionProps = (region) => ({
    fill: regionFill[region]?.color || INTENSITY_COLORS[0],
    onMouseEnter: (e) => handleEnter(region, e),
    onMouseLeave: handleLeave,
    className: "body-region",
  });

  const hasData = muscleData.length > 0;
  const legendMax = legendEntries.length > 0 ? legendEntries[0].sets : 0;

  return (
    <div className="muscle-map" ref={wrapRef}>
      {!hasData ? (
        <div className="muscle-map__empty">
          <p>No muscle data yet.</p>
        </div>
      ) : (
        <>
          <div className="muscle-map__main">
            <div className="muscle-map__bodies">
              {/* FRONT VIEW */}
              <div className="muscle-map__body">
                <svg viewBox="0 0 160 340" className="body-svg">
                  {/* head + neck - static, not a tracked group */}
                  <circle cx="80" cy="20" r="15" className="body-static" />
                  <rect x="73" y="33" width="14" height="12" className="body-static" />

                  {/* shoulders end at y=69 (cy58 + ry11) */}
                  <ellipse cx="44" cy="58" rx="15" ry="11" {...regionProps("shoulderL")} />
                  <ellipse cx="116" cy="58" rx="15" ry="11" {...regionProps("shoulderR")} />

                  {/* chest starts at y=64, clearing the shoulder seam */}
                  <path
                    d="M60 64 H100 V98 Q80 108 60 98 Z"
                    {...regionProps("chest")}
                  />

                  <rect x="64" y="100" width="32" height="46" rx="4" {...regionProps("abs")} />

                  {/* biceps start at y=72, clear of shoulder bottom edge */}
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

              {/* BACK VIEW */}
              <div className="muscle-map__body">
                <svg viewBox="0 0 160 340" className="body-svg">
                  <circle cx="80" cy="20" r="15" className="body-static" />
                  <rect x="73" y="33" width="14" height="12" className="body-static" />

                  {/* upper back / traps - no separate shoulder ellipse on
                     this view, so no seam to manage */}
                  <path
                    d="M54 58 H106 V94 Q80 102 54 94 Z"
                    {...regionProps("upperBack")}
                  />

                  <rect x="64" y="96" width="32" height="38" rx="4" {...regionProps("lowerBack")} />

                  {/* triceps match the front-view bicep y-range exactly */}
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

            {/* side legend: muscle name + mini proportional bar */}
            <div className="muscle-map__sidelist">
              {legendEntries.map((e) => (
                <div className="muscle-map__sidelist-row" key={e.muscle}>
                  <div className="muscle-map__sidelist-bar">
                    <div
                      className="muscle-map__sidelist-fill"
                      style={{ width: `${Math.max((e.sets / legendMax) * 100, 8)}%` }}
                    />
                  </div>
                  <span className="muscle-map__sidelist-name">{e.muscle}</span>
                  <span className="muscle-map__sidelist-count">{e.sets}</span>
                </div>
              ))}
            </div>
          </div>

          {hovered && (
            <div
              className="muscle-map__tooltip-card"
              style={{ left: hovered.x, top: hovered.y }}
            >
              <span className="muscle-map__tooltip-card-name">{hovered.muscle}</span>
              <span className="muscle-map__tooltip-card-sets">{hovered.sets} sets</span>
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