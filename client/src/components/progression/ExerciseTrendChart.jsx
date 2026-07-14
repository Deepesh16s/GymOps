import TrendChart from "./TrendChart";

// Exercise-context preset over TrendChart — mirrors MuscleTrendChart's
// role for a single exercise's history.
function ExerciseTrendChart({ exercise, metricDef, series, trend, showMovingAverage, loading }) {
  return (
    <TrendChart
      title={exercise}
      subtitle={metricDef.label}
      series={series}
      metricKey={metricDef.key}
      metricDef={metricDef}
      trend={trend}
      showMovingAverage={showMovingAverage}
      loading={loading}
      emptyTitle={`No sets logged for ${exercise} yet`}
      emptyMessage="Log this exercise in a session to start its progression graph."
    />
  );
}

export default ExerciseTrendChart;
