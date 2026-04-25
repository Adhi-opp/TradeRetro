const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function cellColor(v) {
  if (v == null || Number.isNaN(v)) return 'transparent';
  const clamped = Math.max(-10, Math.min(10, v));
  const abs = Math.abs(clamped) / 10;
  if (clamped >= 0) return `rgba(34,197,94,${0.12 + abs * 0.55})`;
  return `rgba(239,68,68,${0.12 + abs * 0.55})`;
}

export default function MonthlyHeatmap({ data }) {
  if (!data || !data.years) return null;
  const years = Object.keys(data.years).sort();
  if (!years.length) return null;

  const yearTotals = {};
  years.forEach((y) => {
    const months = data.years[y];
    const product = months.reduce((acc, r) => (r == null ? acc : acc * (1 + r / 100)), 1);
    yearTotals[y] = (product - 1) * 100;
  });

  const monthlyAverages = Array(12).fill(null).map((_, m) => {
    const vals = years.map((y) => data.years[y][m]).filter((v) => v != null);
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  });

  return (
    <div className="panel heatmap-panel">
      <div className="panel-title-row">
        <span className="panel-title">Monthly Returns</span>
        <span className="panel-sub">Compound by month and year</span>
      </div>
      <div className="heatmap-scroll">
        <table className="heatmap-table">
          <thead>
            <tr>
              <th>Year</th>
              {MONTHS.map((m) => <th key={m}>{m}</th>)}
              <th className="heatmap-total">YTD</th>
            </tr>
          </thead>
          <tbody>
            {years.map((y) => (
              <tr key={y}>
                <td className="heatmap-year">{y}</td>
                {data.years[y].map((v, i) => (
                  <td
                    key={i}
                    className="heatmap-cell"
                    style={{ background: cellColor(v), color: v != null && Math.abs(v) > 4 ? '#fff' : 'var(--text-primary)' }}
                    title={v != null ? `${MONTHS[i]} ${y}: ${v.toFixed(2)}%` : 'no data'}
                  >
                    {v == null ? '' : v.toFixed(1)}
                  </td>
                ))}
                <td className={`heatmap-total ${yearTotals[y] >= 0 ? 'positive' : 'negative'}`}>
                  {yearTotals[y] >= 0 ? '+' : ''}{yearTotals[y].toFixed(1)}%
                </td>
              </tr>
            ))}
            <tr className="heatmap-avg-row">
              <td className="heatmap-year">Avg</td>
              {monthlyAverages.map((v, i) => (
                <td
                  key={i}
                  className="heatmap-cell"
                  style={{ background: cellColor(v), opacity: 0.78 }}
                >
                  {v == null ? '' : v.toFixed(1)}
                </td>
              ))}
              <td className="heatmap-total">&nbsp;</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
