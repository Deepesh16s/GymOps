function HistorySkeleton({ count = 4 }) {
  return (
    <div className="history-list" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div className="history-card history-card--skeleton" key={i}>
          <div className="history-card__head history-card__head--skeleton">
            <div className="history-card__top">
              <div className="history-card__heading-block">
                <div className="history-card__title-row">
                  <span className="history-skeleton" style={{ width: 24, height: 24, borderRadius: 8 }} />
                  <span className="history-skeleton" style={{ width: 110, height: 18, borderRadius: 6 }} />
                </div>
                <span className="history-skeleton" style={{ width: 160, height: 13, borderRadius: 6, marginTop: 8 }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                <span className="history-skeleton" style={{ width: 56, height: 13, borderRadius: 6 }} />
                <span className="history-skeleton" style={{ width: 40, height: 11, borderRadius: 6 }} />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default HistorySkeleton;
