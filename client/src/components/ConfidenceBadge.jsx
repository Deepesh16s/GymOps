import { useState, useId, useRef, useEffect } from "react";
import { Info } from "lucide-react";
import "./ConfidenceBadge.css";

// User feedback — a prominent "LOW CONFIDENCE" pill sitting right next
// to "Recovered" reads as a contradiction ("so am I recovered or not?").
// Confidence is about how much evidence backs the READ, not whether the
// read itself is good or bad news — it doesn't deserve equal visual
// weight to the actual answer. This is now a quiet (i) info trigger,
// collapsed by default; clicking it reveals the level + reason in a
// small on-demand disclosure instead of a permanent badge. Every
// intelligence engine still returns the same
// `{ confidence: "High"|"Medium"|"Low", confidenceReason: "..." }` shape
// — this is still the ONE component every surface renders it through.
// Kept the outer element's className as "confidence-badge" (not renamed
// to something like "confidence-info") on purpose — every consumer page
// (dashboard.css, calendar.css, WeeklyCoachReport.css, analytics.css,
// progression-charts.css's DistributionRow) already has spacing rules
// keyed off `.confidence-badge`/`> .confidence-badge`; keeping the root
// class stable means this redesign is a self-contained internal change,
// not a second round of edits across every one of those files.
//
// Several of these badges can sit on the same page at once (Analytics'
// Training Intelligence tab has 8+) — a lightweight window CustomEvent
// lets each instance announce "I just opened" so every OTHER open
// instance closes itself, without needing React Context/a global store
// for something this small.
const CLOSE_EVENT = "confidence-badge-open";

function ConfidenceBadge({ level, reason, label = "Confidence" }) {
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  const ref = useRef(null);

  // Close on outside click, Escape, or another confidence badge opening —
  // same "one popover open at a time" convention this app's other
  // dropdowns (workoutHistory's OverflowMenu) already follow.
  useEffect(() => {
    if (!open) return undefined;

    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const handleKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    const handleOtherOpen = (e) => {
      if (e.detail !== popoverId) setOpen(false);
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    window.addEventListener(CLOSE_EVENT, handleOtherOpen);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener(CLOSE_EVENT, handleOtherOpen);
    };
  }, [open, popoverId]);

  if (!level) return null;

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) window.dispatchEvent(new CustomEvent(CLOSE_EVENT, { detail: popoverId }));
      return next;
    });
  };

  return (
    <span className="confidence-badge" ref={ref}>
      <button
        type="button"
        className="confidence-badge__trigger"
        aria-expanded={open}
        aria-controls={popoverId}
        aria-label={`${label} details`}
        onClick={toggle}
      >
        <Info size={12} strokeWidth={2} />
      </button>
      {open && (
        // Purely informational, non-interactive content — "tooltip" is
        // the correct role (not "status", which is for screen readers
        // announcing dynamic/live updates, and this isn't one).
        <span id={popoverId} className="confidence-badge__popover" role="tooltip">
          <span className="confidence-badge__label">{label}</span>
          <strong className={`confidence-badge__level confidence-badge__level--${level.toLowerCase()}`}>
            {level} confidence
          </strong>
          {reason && <span className="confidence-badge__reason">{reason}</span>}
        </span>
      )}
    </span>
  );
}

export default ConfidenceBadge;
