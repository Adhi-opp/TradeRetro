import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  const date = new Date(label);
  const formatted = date.toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="custom-tooltip">
      <div className="date">{formatted}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} style={{ color: entry.color, marginTop: 2 }}>
          {entry.name}: ₹
          {Number(entry.value).toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
      ))}
    </div>
  );
}

const formatXAxis = (tick) => {
  const d = new Date(tick);
  return `${d.toLocaleString('default', { month: 'short' })} ${String(d.getFullYear()).slice(-2)}`;
};

const formatYAxis = (val) =>
  `₹${Number(val).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function EquityChart({ data, showCosts = true }) {
  if (!data || data.length === 0) return null;

  const equityKey = showCosts ? 'equity' : 'grossEquity';

  const chartData = useMemo(() => {
    const initialPrice = data[0].price;
    const initialEquity = data[0][equityKey] || data[0].equity;
    return data.map((d) => ({
      ...d,
      displayEquity: d[equityKey] || d.equity,
      buyHold: (d.price / initialPrice) * initialEquity,
    }));
  }, [data, equityKey]);

  return (
    <div className="panel">
      <div className="panel-title">Equity Curve</div>
      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2736" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#475569"
              tickFormatter={formatXAxis}
              minTickGap={40}
              tickMargin={10}
              fontSize={11}
            />
            <YAxis
              stroke="#475569"
              domain={['auto', 'auto']}
              width={80}
              tickFormatter={formatYAxis}
              tickMargin={6}
              fontSize={11}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              height={30}
              iconType="line"
              wrapperStyle={{ fontSize: 12 }}
            />
            <Line
              name={showCosts ? 'Strategy (Net)' : 'Strategy (Gross)'}
              type="monotone"
              dataKey="displayEquity"
              stroke="#22c55e"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, fill: '#22c55e', stroke: '#080c12', strokeWidth: 2 }}
            />
            <Line
              name="Buy & Hold"
              type="monotone"
              dataKey="buyHold"
              stroke="#6366f1"
              strokeWidth={1.5}
              strokeDasharray="6 3"
              dot={false}
              activeDot={{ r: 4, fill: '#6366f1', stroke: '#080c12', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
