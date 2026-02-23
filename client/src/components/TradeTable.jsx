export default function TradeTable({ trades, applyCosts = true }) {
  if (!trades || trades.length === 0) return null;

  // --- CSV EXPORT LOGIC ---
  const handleExportCSV = () => {
    const headers = [
      "Trade #", "Entry Date", "Exit Date", "Shares", 
      "Entry Price", "Exit Price", "P&L", "Return %", "Days Held"
    ];

    const rows = trades.map((t, i) => {
      // Respect the UI toggle for gross vs net exports
      const pnl = applyCosts ? t.profitLoss : (t.grossProfitLoss ?? t.profitLoss);
      const returnPct = applyCosts ? t.pnlPct : (t.grossPnlPct ?? t.pnlPct);

      return [
        i + 1,
        new Date(t.entryDate).toLocaleDateString('en-IN'),
        t.exitDate ? new Date(t.exitDate).toLocaleDateString('en-IN') : 'OPEN',
        t.shares,
        t.entryPrice.toFixed(2),
        t.exitPrice ? t.exitPrice.toFixed(2) : 'OPEN',
        pnl.toFixed(2),
        `${returnPct.toFixed(2)}%`,
        t.holdingPeriod ?? 'OPEN'
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `TradeRetro_Ledger_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  // ------------------------

  const fmtDate = (d) =>
    new Date(d).toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
      year: '2-digit',
    });

  const fmtPrice = (p) => `₹${Number(p).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const fmtPnl = (val) => {
    const n = Number(val);
    const sign = n >= 0 ? '+' : '';
    return `${sign}${n.toFixed(2)}%`;
  };

  return (
    <div className="panel">
      {/* Updated Header with Export Button */}
      <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Trade Ledger</span>
        <button 
          onClick={handleExportCSV}
          style={{
            padding: '4px 10px',
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '600',
            letterSpacing: '0.5px'
          }}
        >
          ⬇ Export CSV
        </button>
      </div>
      
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
              const pnl = applyCosts ? t.profitLoss : (t.grossProfitLoss ?? t.profitLoss);
              const isWin = applyCosts ? t.isWin : (t.isGrossWin ?? t.pnlPct > 0);
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
                    {pnl != null
                      ? `${pnl >= 0 ? '+' : '-'}₹${Math.abs(pnl).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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