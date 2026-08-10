import { useState } from "react";
import "./RecoveryBreakdownDisclosure.css";

function RecoveryBreakdownDisclosure({ score, breakdown }) {
  const [open, setOpen] = useState(false);
  if (!breakdown?.length) return null;

  return (
    <div className="recovery-breakdown">
      <button
        type="button"
        className="recovery-breakdown__btn"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Why {score}?
      </button>
      {open && (
        <ul className="recovery-breakdown__list">
          {breakdown.map((r) => (
            <li key={r.muscle}>
              <span>{r.muscle}</span>
              <strong>{r.recoveryScore}</strong>
            </li>
          ))}
          <li className="recovery-breakdown__average">
            <span>Average</span>
            <strong>{score}</strong>
          </li>
        </ul>
      )}
    </div>
  );
}

export default RecoveryBreakdownDisclosure;
