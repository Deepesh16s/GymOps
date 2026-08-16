import { useState, useId, useRef, useEffect, useLayoutEffect } from "react";
import { FlaskConical } from "lucide-react";
import { getSourcesForMetric } from "../constants/evidenceSources";
import "./EvidenceBadge.css";

const CLOSE_EVENT = "evidence-badge-open";

function EvidenceBadge({ strength, explanation, metricKey, label = "Why am I seeing this?" }) {
  const [open, setOpen] = useState(false);
  const [align, setAlign] = useState("left");
  const popoverId = useId();
  const ref = useRef(null);
  const popoverRef = useRef(null);

  useLayoutEffect(() => {
    if (!open) return;
    const el = popoverRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8) setAlign("right");
  }, [open]);

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

  if (!strength) return null;

  const sources = metricKey ? getSourcesForMetric(metricKey).slice(0, 3) : [];

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        setAlign("left");
        window.dispatchEvent(new CustomEvent(CLOSE_EVENT, { detail: popoverId }));
      }
      return next;
    });
  };

  return (
    <span className="evidence-badge" ref={ref}>
      <button
        type="button"
        className="evidence-badge__trigger"
        aria-expanded={open}
        aria-controls={popoverId}
        aria-label={label}
        onClick={toggle}
      >
        <FlaskConical size={12} strokeWidth={2} />
      </button>
      {open && (
        <span
          id={popoverId}
          ref={popoverRef}
          className={`evidence-badge__popover evidence-badge__popover--${align}`}
          role="tooltip"
        >
          <span className="evidence-badge__label">Evidence strength</span>
          <strong className={`evidence-badge__level evidence-badge__level--${strength.toLowerCase()}`}>
            {strength}
          </strong>
          {explanation && <span className="evidence-badge__reason">{explanation}</span>}
          {sources.length > 0 && (
            <span className="evidence-badge__sources">
              {sources.map((s) => (
                <a key={s.id} href={s.url} target="_blank" rel="noreferrer" className="evidence-badge__source">
                  {s.authors.split(",")[0].split(" ")[0]} et al. ({s.year})
                </a>
              ))}
            </span>
          )}
        </span>
      )}
    </span>
  );
}

export default EvidenceBadge;
