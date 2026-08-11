import { useState, useId, useRef, useEffect, useLayoutEffect } from "react";
import { Info } from "lucide-react";
import "./ConfidenceBadge.css";

const CLOSE_EVENT = "confidence-badge-open";

function ConfidenceBadge({ level, reason, label = "Confidence" }) {
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

  if (!level) return null;

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
        <span
          id={popoverId}
          ref={popoverRef}
          className={`confidence-badge__popover confidence-badge__popover--${align}`}
          role="tooltip"
        >
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
