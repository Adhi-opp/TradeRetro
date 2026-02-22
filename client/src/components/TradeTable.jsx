export default function TradeTable({ trades }) {
  if (!trades || trades.length === 0) return null;

  const fmtDate = (d) =>
    new Date(d).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: '2-digit',
    });

  const fmtPrice = (p) => `$${Number(p).toFixed(2)}`;

  const fmtPnl = (val) => {
    const n = Number(val);
    const sign = n >= 0 ? '+' : '';
    return `${sign}${n.toFixed(2)}%`;
  };

  return (
    <div className="panel">
      <div className="panel-title">Trade Ledger</div>
      <div className="table-scroll">
        <table className="trade-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Entry</th>
              <th>Exit</th>
              <th>Shares</th>
              <th>Entry Price</th>
              <th>Exit Price</th>
              <th>P&amp;L</th>
              <th>Return</th>
              <th>Days Held</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t, i) => {
              const isWin = t.pnlPct > 0;
              const pnlClass = isWin ? 'positive' : 'negative';
              return (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{fmtDate(t.entryDate)}</td>
                  <td>{t.exitDate ? fmtDate(t.exitDate) : 'OPEN'}</td>
                  <td className="col-shares">{t.shares}</td>
                  <td>{fmtPrice(t.entryPrice)}</td>
                  <td>{t.exitPrice ? fmtPrice(t.exitPrice) : '\u2014'}</td>
                  <td className={`col-pnl ${pnlClass}`}>
                    {t.profitLoss != null
                      ? `${t.profitLoss >= 0 ? '+' : ''}$${Math.abs(t.profitLoss).toFixed(2)}`
                      : '\u2014'}
                  </td>
                  <td className={`col-pnl ${pnlClass}`}>
                    {t.pnlPct != null ? fmtPnl(t.pnlPct) : '\u2014'}
                  </td>
                  <td>{t.holdingPeriod ?? '\u2014'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
