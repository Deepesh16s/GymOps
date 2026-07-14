import { Activity } from "lucide-react";
import "./progression-charts.css";

// Non-chart empty state — same icon+message shape as ChartStates'
// ChartEmptyState, so a panel with nothing logged yet reads as an
// intentional state rather than a large card with one line of tiny text
// and no visual weight.
function PanelEmptyState({ message, icon: Icon = Activity }) {
  return (
    <div className="panel-empty-state">
      <div className="panel-empty-state__icon">
        <Icon size={20} strokeWidth={1.6} />
      </div>
      <p className="panel-empty-state__message">{message}</p>
    </div>
  );
}

export default PanelEmptyState;
