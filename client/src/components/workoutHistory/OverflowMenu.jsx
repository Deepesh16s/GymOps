import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";

// Generic "..." trigger + dropdown, used to tuck destructive actions
// (Delete Session, Delete exercise) out of the primary visual hierarchy —
// a red button shouldn't be the first thing a session card draws the eye
// to. Closes on outside click or Escape. Each instance owns its own open
// state, so multiple menus on one card never interfere with each other.
function OverflowMenu({ label = "More actions", children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const handleKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div className="history-overflow-menu" ref={ref}>
      <button
        type="button"
        className="history-overflow-menu__trigger"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={label}
      >
        <MoreHorizontal size={16} strokeWidth={2} />
      </button>
      {open && (
        <div
          className="history-overflow-menu__panel"
          role="menu"
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export default OverflowMenu;
