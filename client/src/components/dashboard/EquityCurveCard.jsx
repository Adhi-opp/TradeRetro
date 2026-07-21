import EquityChart from '../EquityChart';

/**
 * Dashboard equity curve card wrapper.
 */
export default function EquityCurveCard({ data, showCosts }) {
  if (!data) return null;
  return <EquityChart data={data} showCosts={showCosts} />;
}
