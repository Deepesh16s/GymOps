import { useEffect, useState } from "react";
import { Flag } from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import { submitReport } from "../services/reportService";
import "./ReportDialog.css";

const REASONS = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "inappropriate_content", label: "Inappropriate content" },
  { value: "impersonation", label: "Impersonation" },
  { value: "other", label: "Other" },
];

function ReportDialog({ open, targetType, targetId, onClose, onSubmitted }) {
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setReason("");
      setDescription("");
      setError("");
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!reason || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await submitReport({ targetType, targetId, reason, description: description.trim() });
      onSubmitted(res.data.message || "Report submitted.");
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Could not submit report.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ConfirmDialog
      open={open}
      icon={Flag}
      title="Report this content"
      body="Reports are reviewed. The person you report won't be notified."
      confirmLabel={submitting ? "Submitting..." : "Submit report"}
      onConfirm={handleConfirm}
      onCancel={onClose}
      confirmDisabled={!reason || submitting}
      danger
    >
      <select
        className="report-dialog-select"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        disabled={submitting}
      >
        <option value="" disabled>
          Select a reason
        </option>
        {REASONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      <textarea
        className="report-dialog-textarea"
        placeholder="Additional details (optional)"
        value={description}
        maxLength={500}
        onChange={(e) => setDescription(e.target.value)}
        disabled={submitting}
        rows={3}
      />
      {error && <p className="report-dialog-error">{error}</p>}
    </ConfirmDialog>
  );
}

export default ReportDialog;
