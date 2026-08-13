import KpiRibbon from '../KpiRibbon';

/**
 * Dashboard performance KPI strip.
 */
export default function PerformanceCards({ metrics, analytics }) {
  return <KpiRibbon metrics={metrics} analytics={analytics} />;
}
