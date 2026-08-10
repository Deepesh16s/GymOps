import "./WeeklyCoachReport.css";
import ConfidenceBadge from "./ConfidenceBadge";
import RecoveryBreakdownDisclosure from "./RecoveryBreakdownDisclosure";

const GRADE_TONE = {
  "A+": "excellent",
  A: "excellent",
  "A-": "excellent",
  "B+": "good",
  B: "good",
  "B-": "good",
  "C+": "fair",
  C: "fair",
  D: "poor",
  F: "poor",
};

function WeeklyCoachReport({ report }) {
  if (!report?.available) return null;

  const gradeTone = GRADE_TONE[report.grade] || "fair";
  const hasVolumeChange = report.volumeChangePct != null;

  return (
    <section className="section">
      <p className="section__label">Weekly Coach Report</p>
      <div className="coach-report">
        <div className="coach-report__header">
          <span className="coach-report__period">Last Week</span>
          <div className="coach-report__grade-col">
            <span className={`coach-report__grade coach-report__grade--${gradeTone}`}>{report.grade}</span>
            <ConfidenceBadge level={report.gradeConfidence} reason={report.gradeConfidenceReason} label="Weekly grade" />
          </div>
        </div>

        <div className="coach-report__stats">
          {report.recovery != null && (
            <div className="coach-report__stat">
              <span className="coach-report__stat-label">Recovery</span>
              <span className="coach-report__stat-value">{report.recovery}</span>
              <ConfidenceBadge
                level={report.recoveryConfidence}
                reason={report.recoveryConfidenceReason}
                label="Recovery estimate"
              />
              <RecoveryBreakdownDisclosure score={report.recovery} breakdown={report.recoveryBreakdown} />
            </div>
          )}

          <div className="coach-report__stat">
            <span className="coach-report__stat-label">Consistency</span>
            <span className="coach-report__stat-value">
              {report.consistency.trained} / {report.consistency.total}
            </span>
          </div>

          {hasVolumeChange && (
            <div className="coach-report__stat">
              <span className="coach-report__stat-label">Volume</span>
              <span
                className={`coach-report__stat-value ${
                  report.volumeChangePct >= 0 ? "coach-report__stat-value--up" : "coach-report__stat-value--down"
                }`}
              >
                {report.volumeChangePct >= 0 ? "+" : ""}
                {report.volumeChangePct}%
              </span>
            </div>
          )}

          {report.mostImproved && (
            <div className="coach-report__stat">
              <span className="coach-report__stat-label">Most Improved</span>
              <span className="coach-report__stat-value">{report.mostImproved}</span>
            </div>
          )}

          {report.needsAttention && (
            <div className="coach-report__stat">
              <span className="coach-report__stat-label">Needs Attention</span>
              <span className="coach-report__stat-value">{report.needsAttention}</span>
            </div>
          )}

          {report.suggestedFocus && (
            <div className="coach-report__stat coach-report__stat--focus">
              <span className="coach-report__stat-label">Suggested Focus</span>
              <span className="coach-report__stat-value">{report.suggestedFocus}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default WeeklyCoachReport;
