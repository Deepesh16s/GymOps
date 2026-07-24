import { X } from "lucide-react";
import "./Drawer.css";

// Generic slide-in side panel — first consumer is ExerciseHistoryDrawer
// (Phase 11, Module 7), but deliberately not exercise-specific so any
// future "view more without leaving the page" surface can reuse it.
function Drawer({ open, onClose, title, children }) {
  if (!open) return null;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div
        className="drawer-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="drawer-panel__head">
          <p className="drawer-panel__title">{title}</p>
          <button
            type="button"
            className="drawer-panel__close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        <div className="drawer-panel__body">{children}</div>
      </div>
    </div>
  );
}

export default Drawer;
