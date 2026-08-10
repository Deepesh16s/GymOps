import { Activity } from "lucide-react";
import "./progression-charts.css";

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
