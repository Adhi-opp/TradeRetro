import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Activity,
  Target,
  IndianRupee,
  Gauge,
  Zap,
} from 'lucide-react';

const ICON_MAP = {
  'Total Return': TrendingUp,
  'Buy & Hold': BarChart3,
  'Max Drawdown': TrendingDown,
  'Sharpe Ratio': Activity,
  'Win Rate': Target,
  'Net Profit': IndianRupee,
  'Strategy CAGR': TrendingUp,
  'Benchmark CAGR': BarChart3,
  'Alpha': Zap,
  'Info Ratio': Gauge,
};

export default function MetricsCard({ label, value, format }) {
  const num = Number(value);

  let display;
  if (format === 'percent') {
    display = `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
  } else if (format === 'currency') {
    display = `${num >= 0 ? '+' : ''}₹${Math.abs(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (num < 0) display = `-₹${Math.abs(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else {
    display = num.toFixed(2);
  }

  // Color logic: drawdown is always negative but "less negative = better", so we keep it red
  const neutralLabels = new Set(['Win Rate', 'Sharpe Ratio', 'Info Ratio', 'Benchmark CAGR']);
  const colorClass =
    label === 'Max Drawdown'
      ? 'negative'
      : neutralLabels.has(label)
        ? 'neutral'
        : num >= 0
          ? 'positive'
          : 'negative';

  const Icon = ICON_MAP[label] || Activity;

  return (
    <div className="metric-card">
      <div className="metric-card-label">
        <Icon />
        {label}
      </div>
      <div className={`metric-card-value ${colorClass}`}>{display}</div>
    </div>
  );
}
