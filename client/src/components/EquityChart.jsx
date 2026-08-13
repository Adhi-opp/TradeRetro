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
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const strategy = payload.find((e) => e.dataKey === 'displayEquity');
  const buyHold = payload.find((e) => e.dataKey === 'buyHold');
  const gap = strategy && buyHold ? strategy.value - buyHold.value : null;

  return (
    <div className="custom-tooltip">
      <div className="date">{formatted}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} style={{ color: entry.color, marginTop: 2 }}>
          {entry.name}: ₹
          {Number(entry.value).toLocaleString('en-IN', {
            minimumFractionDigits: 2, maximumFractionDigits: 2,
          })}
        </div>
      ))}
      {gap !== null && (
        <div style={{ color: gap >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 4, fontWeight: 600 }}>
          Gap: {gap >= 0 ? '+' : ''}₹{Math.abs(gap).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </div>
      )}
    </div>
  );
}

const formatXAxis = (tick) => {
  const d = new Date(tick);
  return `${d.toLocaleString('default', { month: 'short' })} ${String(d.getFullYear()).slice(-2)}`;
};
const formatYAxis = (val) =>
  `₹${Number(val).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const formatPct = (pct) =>
  `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
const formatINR = (n) =>
  `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function EquityChart({ data, showCosts = true }) {
  const equityKey = showCosts ? 'equity' : 'grossEquity';

  const { chartData, summary } = useMemo(() => {
    if (!data || data.length === 0) {
      return { chartData: [], summary: null };
    }
    const initialPrice = data[0].price;
    const initialEquity = data[0][equityKey] || data[0].equity;

    const points = data.map((d) => {
      const equity = d[equityKey] || d.equity;
      const buyHold = (d.price / initialPrice) * initialEquity;
      return { ...d, displayEquity: equity, buyHold };
    });

    const finalEquity = points[points.length - 1].displayEquity;
    const finalBuyHold = points[points.length - 1].buyHold;
    const stratPct = ((finalEquity - initialEquity) / initialEquity) * 100;
    const bhPct = ((finalBuyHold - initialEquity) / initialEquity) * 100;
    const alpha = stratPct - bhPct;

    return {
      chartData: points,
      summary: {
        initialEquity, finalEquity, finalBuyHold,
        stratPct, bhPct, alpha, beatsBH: alpha >= 0,
      },
    };
  }, [data, equityKey]);

  if (!summary) return null;

  return (
    <div className="panel">
      <div className="panel-title-row">
        <span className="panel-title">Equity Curve Analysis</span>
        <div className="equity-summary-row">
          <span className="equity-summary-chip">
            <span className="equity-summary-label">Strategy</span>
            <span className="equity-summary-value" style={{ color: 'var(--primary)' }}>
              {formatINR(summary.finalEquity)} <small>{formatPct(summary.stratPct)}</small>
            </span>
          </span>
          <span className="equity-summary-chip">
            <span className="equity-summary-label">Buy &amp; Hold</span>
            <span className="equity-summary-value" style={{ color: 'var(--text-secondary)' }}>
              {formatINR(summary.finalBuyHold)} <small>{formatPct(summary.bhPct)}</small>
            </span>
          </span>
          <span className={`equity-summary-chip equity-alpha ${summary.beatsBH ? 'pos' : 'neg'}`}>
            <span className="equity-summary-label">Alpha</span>
            <span className="equity-summary-value">{formatPct(summary.alpha)}</span>
          </span>
        </div>
      </div>
      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="var(--text-muted)"
              tickFormatter={formatXAxis}
              minTickGap={40}
              tickMargin={10}
              fontSize={11}
            />
            <YAxis
              stroke="var(--text-muted)"
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
              name="Buy & Hold"
              type="monotone"
              dataKey="buyHold"
              stroke="var(--text-secondary)"
              strokeWidth={1.75}
              strokeDasharray="6 3"
              dot={false}
              activeDot={{ r: 4, fill: 'var(--text-secondary)', stroke: '#090909', strokeWidth: 2 }}
              isAnimationActive={false}
            />
            <Line
              name={showCosts ? 'Strategy (Net)' : 'Strategy (Gross)'}
              type="monotone"
              dataKey="displayEquity"
              stroke="var(--primary)"
              strokeWidth={2.25}
              dot={false}
              activeDot={{ r: 5, fill: 'var(--primary)', stroke: '#090909', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
