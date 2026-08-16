import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";

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
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events
        <div
          className="history-overflow-menu__panel"
          role="menu"
          tabIndex={-1}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export default OverflowMenu;
