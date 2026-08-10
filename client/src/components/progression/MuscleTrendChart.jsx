import TrendChart from "./TrendChart";

function MuscleTrendChart({ muscle, metricDef, series, trend, showMovingAverage, loading }) {
  return (
    <TrendChart
      title={`${muscle} Progression`}
      subtitle={metricDef.label}
      series={series}
      metricKey={metricDef.key}
      metricDef={metricDef}
      trend={trend}
      showMovingAverage={showMovingAverage}
      loading={loading}
      emptyTitle={`No ${muscle.toLowerCase()} sets logged yet`}
      emptyMessage={`Log a session that trains ${muscle.toLowerCase()} to see its progression here.`}
    />
  );
}

export default MuscleTrendChart;
