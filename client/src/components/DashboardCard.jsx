import "./DashboardCard.css";

function DashboardCard({
  title,
  value,
  icon,
}) {
  return (
    <div className="dashboard-card">
      <div className="card-top">
        <span>{icon}</span>
      </div>

      <h3>{value}</h3>

      <p>{title}</p>
    </div>
  );
}

export default DashboardCard;