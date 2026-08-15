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
  const ref = useRef(null);

  useEffect(() => {
    if (!pickerOpen) return undefined;
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setPickerOpen(false);
    };
    const handleKey = (e) => {
      if (e.key === "Escape") setPickerOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [pickerOpen]);

  const activeEntries = REACTIONS.filter((r) => reactions[r.type] > 0);
  const viewerReactionDef = REACTIONS.find((r) => r.type === viewerReaction);

  const handlePick = (type) => {
    setPickerOpen(false);
    if (disabled) return;
    if (viewerReaction === type) onRemove();
    else onReact(type);
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
        <div className="reaction-bar__picker" role="menu">
          {REACTIONS.map((r) => (
            <button
              key={r.type}
              type="button"
              role="menuitemradio"
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
