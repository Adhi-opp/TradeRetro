import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Tooltip, Cell,
} from 'recharts';

export default function ReturnDistribution({ data }) {
  if (!data || !data.bins?.length) return null;
  const { bins, mean, var95 } = data;

  return (
    <div className="panel dist-panel">
      <div className="panel-title-row">
        <span className="panel-title">Daily Return Distribution</span>
        <span className="panel-sub">
          Mean {mean.toFixed(2)}% · VaR<sub>95</sub> {var95.toFixed(2)}%
        </span>
      </div>
      <div className="chart-wrapper" style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bins} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <XAxis
              dataKey="label"
              stroke="#475569"
              fontSize={10}
              tickFormatter={(v) => `${v}%`}
              interval={Math.floor(bins.length / 8)}
            />
            <YAxis stroke="#475569" fontSize={10} width={35} />
            <Tooltip
              contentStyle={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
              formatter={(v) => [v, 'days']}
              labelFormatter={(l) => `${l}% bucket`}
            />
            <ReferenceLine x={bins.find((b) => b.mid >= 0)?.label} stroke="#64748b" strokeDasharray="3 3" />
            <Bar dataKey="count" isAnimationActive={false}>
              {bins.map((b, i) => (
                <Cell key={i} fill={b.mid >= 0 ? 'rgba(34,197,94,0.75)' : 'rgba(239,68,68,0.75)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
