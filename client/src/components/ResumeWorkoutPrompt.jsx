import { useState } from "react";
import { RotateCcw, Trash2, Dumbbell } from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import "./ResumeWorkoutPrompt.css";

function formatElapsedLabel(startTime) {
  if (!startTime) return "a while ago";
  const minutes = Math.round((Date.now() - startTime) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"} ago`;
}

function ResumeWorkoutPrompt({ startTime, onResume, onDiscard }) {
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const handleCancelDiscardConfirm = () => setShowDiscardConfirm(false);
  const handleConfirmDiscard = () => {
    setShowDiscardConfirm(false);
    onDiscard();
  };

  return (
    <div className="resume-prompt">
      <div className="resume-prompt__icon">
        <Dumbbell size={20} strokeWidth={1.8} />
      </div>
      <div className="resume-prompt__body">
        <p className="resume-prompt__title">Resume Workout?</p>
        <p className="resume-prompt__sub">Started {formatElapsedLabel(startTime)}</p>
      </div>
      <div className="resume-prompt__actions">
        <button
          type="button"
          className="resume-prompt__btn resume-prompt__btn--discard"
          onClick={() => setShowDiscardConfirm(true)}
        >
          <Trash2 size={14} strokeWidth={2} />
          Discard
        </button>
        <button
          type="button"
          className="resume-prompt__btn resume-prompt__btn--resume"
          onClick={onResume}
        >
          <RotateCcw size={14} strokeWidth={2} />
          Resume
        </button>
      </div>
      <ConfirmDialog
        open={showDiscardConfirm}
        title="Discard Workout?"
        body="This in-progress session will be discarded and can't be recovered."
        confirmLabel="Discard"
        onConfirm={handleConfirmDiscard}
        onCancel={handleCancelDiscardConfirm}
      />
    </div>
  );
}

export default ResumeWorkoutPrompt;
