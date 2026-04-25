import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

function fmtXAxis(tick) {
  const d = new Date(tick);
  return `${d.toLocaleString('default', { month: 'short' })} ${String(d.getFullYear()).slice(-2)}`;
}

function DDTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = new Date(label).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
  return (
    <div className="custom-tooltip">
      <div className="date">{d}</div>
      <div style={{ color: '#ef4444', marginTop: 2 }}>
        Drawdown: {Number(payload[0].value).toFixed(2)}%
      </div>
    </div>
  );
}

export default function DrawdownChart({ data }) {
  if (!data?.length) return null;
  const maxDD = Math.min(...data.map((d) => d.drawdown));

  return (
    <div className="panel drawdown-panel">
      <div className="panel-title-row">
        <span className="panel-title">Underwater Plot</span>
        <span className="panel-sub">Worst: {maxDD.toFixed(2)}%</span>
      </div>
      <div className="chart-wrapper" style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
            <defs>
              <linearGradient id="ddFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.05} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0.45} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2736" vertical={false} />
            <XAxis dataKey="date" stroke="#475569" tickFormatter={fmtXAxis} minTickGap={40} tickMargin={8} fontSize={11} />
            <YAxis stroke="#475569" tickFormatter={(v) => `${v.toFixed(0)}%`} width={55} fontSize={11} />
            <Tooltip content={<DDTooltip />} />
            <ReferenceLine y={0} stroke="#475569" />
            <Area
              type="monotone"
              dataKey="drawdown"
              stroke="#ef4444"
              strokeWidth={1.5}
              fill="url(#ddFill)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
