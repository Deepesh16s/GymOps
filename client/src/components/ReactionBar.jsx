import { useEffect, useRef, useState } from "react";
import "./ReactionBar.css";

const REACTIONS = [
  { type: "fire", emoji: "🔥", label: "Fire" },
  { type: "strong", emoji: "💪", label: "Strong" },
  { type: "respect", emoji: "👏", label: "Respect" },
  { type: "rocket", emoji: "🚀", label: "Progress" },
  { type: "heart", emoji: "❤️", label: "Love" },
];

function ReactionBar({ reactions = {}, viewerReaction, onReact, onRemove, disabled = false }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const ref = useRef(null);
  const triggerRef = useRef(null);
  const itemRefs = useRef([]);

  useEffect(() => {
    if (!pickerOpen) return undefined;
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setPickerOpen(false);
    };
    const handleKey = (e) => {
      if (e.key === "Escape") {
        setPickerOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [pickerOpen]);

  useEffect(() => {
    if (!pickerOpen) return;
    const activeIndex = REACTIONS.findIndex((r) => r.type === viewerReaction);
    const startIndex = activeIndex >= 0 ? activeIndex : 0;
    setFocusedIndex(startIndex);
    itemRefs.current[startIndex]?.focus();
  }, [pickerOpen]);

  const activeEntries = REACTIONS.filter((r) => reactions[r.type] > 0);
  const viewerReactionDef = REACTIONS.find((r) => r.type === viewerReaction);

  const handlePick = (type) => {
    setPickerOpen(false);
    triggerRef.current?.focus();
    if (disabled) return;
    if (viewerReaction === type) onRemove();
    else onReact(type);
  };

  const handlePickerKeyDown = (e) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const count = REACTIONS.length;
    const current = itemRefs.current.indexOf(document.activeElement);
    const from = current >= 0 ? current : focusedIndex;
    let next = from;
    if (e.key === "ArrowRight") next = (from + 1) % count;
    else if (e.key === "ArrowLeft") next = (from - 1 + count) % count;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = count - 1;
    setFocusedIndex(next);
    itemRefs.current[next]?.focus();
  };

  return (
    <div className="reaction-bar" ref={ref}>
      <div className="reaction-bar__counts">
        {activeEntries.map((r) => (
          <button
            key={r.type}
            type="button"
            className={`reaction-bar__chip${viewerReaction === r.type ? " reaction-bar__chip--active" : ""}`}
            onClick={() => handlePick(r.type)}
            disabled={disabled}
            aria-pressed={viewerReaction === r.type}
            aria-label={`${r.label} reaction, ${reactions[r.type]} ${
              reactions[r.type] === 1 ? "person" : "people"
            }${viewerReaction === r.type ? ", you reacted" : ""}`}
          >
            <span aria-hidden="true">{r.emoji}</span>
            {reactions[r.type]}
          </button>
        ))}

        <button
          ref={triggerRef}
          type="button"
          className={`reaction-bar__add${viewerReaction ? " reaction-bar__add--active" : ""}`}
          onClick={() => setPickerOpen((v) => !v)}
          disabled={disabled}
          aria-haspopup="true"
          aria-expanded={pickerOpen}
          aria-label={viewerReaction ? `Change your reaction (currently ${viewerReactionDef?.label})` : "Add a reaction"}
        >
          {viewerReactionDef ? <span aria-hidden="true">{viewerReactionDef.emoji}</span> : "+"}
        </button>
      </div>

      {pickerOpen && (
        <div className="reaction-bar__picker" role="menu" tabIndex={-1} onKeyDown={handlePickerKeyDown}>
          {REACTIONS.map((r, i) => (
            <button
              key={r.type}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              role="menuitemradio"
              tabIndex={i === focusedIndex ? 0 : -1}
              aria-checked={viewerReaction === r.type}
              aria-label={r.label}
              className={`reaction-bar__picker-btn${
                viewerReaction === r.type ? " reaction-bar__picker-btn--active" : ""
              }`}
              onClick={() => handlePick(r.type)}
            >
              <span aria-hidden="true">{r.emoji}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default ReactionBar;
