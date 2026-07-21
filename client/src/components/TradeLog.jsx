import { Download } from 'lucide-react';

// Fixed-height, component-scrolled trade log. Daily backtests produce tens of
// trades, so all rows render directly; the body is isolated in its own
// scroll container (.tl-scroll) so swapping in react-window later — should an
// intraday engine ever produce thousands of rows — is a localized change.

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: '2-digit' });
}
function fmtPrice(p) {
  return `₹${Number(p).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const REASON_BADGE = {
  signal: { label: 'Signal', cls: 'tl-badge-signal' },
  stop: { label: 'Stop', cls: 'tl-badge-stop' },
  force_close: { label: 'Close', cls: 'tl-badge-close' },
};

export default function TradeLog({ trades, applyCosts = true }) {
  if (!trades || trades.length === 0) {
    return (
      <div className="panel trade-log">
        <div className="panel-title-row">
          <span className="panel-title">Trade History</span>
        </div>
        <div className="tl-empty">No trades — the strategy never opened a position in this window.</div>
      </div>
    );
  }

  const exportCSV = () => {
    const headers = ['#', 'Side', 'Exit Reason', 'Entry Date', 'Exit Date', 'Shares', 'Entry', 'Exit', 'P&L', 'Return %', 'Days'];
    const rows = trades.map((t, i) => {
      const pnl = applyCosts ? t.profitLoss : (t.grossProfitLoss ?? t.profitLoss);
      return [
        i + 1, t.type || 'LONG', t.exitReason || 'signal',
        new Date(t.entryDate).toLocaleDateString('en-IN'),
        t.exitDate ? new Date(t.exitDate).toLocaleDateString('en-IN') : 'OPEN',
        t.shares, t.entryPrice.toFixed(2), t.exitPrice ? t.exitPrice.toFixed(2) : 'OPEN',
        pnl.toFixed(2), `${t.pnlPct.toFixed(2)}%`, t.holdingPeriod ?? 'OPEN',
      ].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `TradeRetro_Ledger_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="panel trade-log">
      <div className="panel-title-row">
        <span className="panel-title">Trade History</span>
        <button className="tl-export" onClick={exportCSV} title="Export ledger as CSV">
          <Download size={13} /> CSV
        </button>
      </div>

      <div className="tl-scroll">
        <table className="tl-table">
          <thead>
            <tr>
              <th>Date</th><th>Type</th><th className="tl-num">Price</th>
              <th className="tl-num">Shares</th><th className="tl-num">P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t, i) => {
              const pnl = applyCosts ? t.profitLoss : (t.grossProfitLoss ?? t.profitLoss);
              const isWin = applyCosts ? t.isWin : (t.isGrossWin ?? t.pnlPct > 0);
              const cls = isWin ? 'positive' : 'negative';
              const badge = REASON_BADGE[t.exitReason] || REASON_BADGE.signal;
              return (
                <tr key={i}>
                  <td className="tl-dim">{fmtDate(t.entryDate)}</td>
                  <td><span className={`tl-badge ${badge.cls}`}>{isWin ? 'BUY' : 'SELL'}</span></td>
                  <td className="tl-num">{fmtPrice(t.entryPrice)}</td>
                  <td className="tl-num">{t.shares}</td>
                  <td className={`tl-num ${cls}`}>
                    {pnl >= 0 ? '+' : '-'}₹{Math.abs(pnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
