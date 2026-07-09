import React from "react";
import { CheckCircle2, AlertTriangle, TrendingUp } from "lucide-react";

const EXERCISE_IMAGES = {
  squat: "/assets/exercises/squat.png",
  bench: "/assets/exercises/bench.png",
  deadlift: "/assets/exercises/deadlift.png",
  ohp: "/assets/exercises/overhead-press.png",
  row: "/assets/exercises/barbell-row.png",
  pullup: "/assets/exercises/pullup.png",
};

function BulletList({ items, tone }) {
  return (
    <ul className="guide-ul">
      {items.map((item) => (
        <li key={item} className={tone === "warn" ? "guide-li-warn" : "guide-li-good"}>
          {item}
        </li>
      ))}
    </ul>
  );
}

export function ExerciseIllustration({ exercise }) {
  const { id, name, cues, mistakes, science } = exercise;
  const src = EXERCISE_IMAGES[id];

  return (
    <div className="guide-card-body">
      {src && (
        <div className="exercise-illustration-wrap">
          <img
            src={src}
            alt={`${name} form guide showing correct technique, common mistakes, and key cues`}
            className="exercise-illustration-image"
            loading="lazy"
            decoding="async"
          />
        </div>
      )}

      <div className="guide-section">
        <div className="guide-section-label guide-label-good">
          <CheckCircle2 size={13} strokeWidth={1.8} />
          Key cues
        </div>
        <BulletList items={cues} tone="good" />
      </div>

      <div className="guide-section">
        <div className="guide-section-label guide-label-warn">
          <AlertTriangle size={13} strokeWidth={1.8} />
          Common mistakes
        </div>
        <BulletList items={mistakes} tone="warn" />
      </div>

      <div className="guide-suitability">
        <div className="guide-section-label guide-label-good">
          <TrendingUp size={13} strokeWidth={1.8} />
          Why it works
        </div>
        <p>{science}</p>
      </div>
    </div>
  );
}