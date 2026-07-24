// Shared shell for every "nothing to show" moment on this page (no
// workouts logged yet, no results for the active filters, no PR
// workouts yet) — one visual language instead of three ad-hoc blocks,
// consistent with Dashboard's empty-state icon-in-a-circle treatment.
function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <div className="history-empty-state history-fade-in">
      <div className="history-empty-state__icon">
        <Icon size={26} strokeWidth={1.6} />
      </div>
      {title && <h2 className="history-empty-state__title">{title}</h2>}
      {message && <p className="history-empty-state__message">{message}</p>}
      {action}
    </div>
  );
}

export default EmptyState;
