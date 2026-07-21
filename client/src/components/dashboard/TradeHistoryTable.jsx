import TradeLog from '../TradeLog';

/**
 * Dashboard trade history table wrapper.
 */
export default function TradeHistoryTable({ trades, applyCosts }) {
  return <TradeLog trades={trades} applyCosts={applyCosts} />;
}
