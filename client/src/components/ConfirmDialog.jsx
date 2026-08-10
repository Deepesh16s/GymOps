import { AlertTriangle } from "lucide-react";
import useModalEscapeAndFocus from "../hooks/useModalEscapeAndFocus";
import "./ConfirmDialog.css";

function ConfirmDialog({
  open,
  icon: Icon = AlertTriangle,
  title,
  body,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  confirmDisabled = false,
  danger = true,
}) {
  useModalEscapeAndFocus(open, onCancel);

  if (!open) return null;

  return (
    <div className="confirm-dialog-overlay">
      <div
        className="confirm-dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <div className={`confirm-dialog-icon ${danger ? "confirm-dialog-icon--danger" : ""}`}>
          <Icon size={22} strokeWidth={1.8} />
        </div>
        <p className="confirm-dialog-title" id="confirm-dialog-title">{title}</p>
        {body && <p className="confirm-dialog-body">{body}</p>}
        {children}

        <div className="confirm-dialog-actions">
          <button type="button" className="confirm-dialog-btn confirm-dialog-btn--cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`confirm-dialog-btn ${danger ? "confirm-dialog-btn--danger" : "confirm-dialog-btn--confirm"}`}
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
