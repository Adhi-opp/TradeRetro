import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';

const NSE_STOCKS = [
  'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK',
  'HINDUNILVR', 'SBIN', 'BAJFINANCE', 'BHARTIARTL', 'WIPRO',
];

export default function AiVerifyForm({ onVerify, isLoading }) {
  const [stock, setStock] = useState('RELIANCE');
  const [entryBody, setEntryBody] = useState(
    'return candle.rsi_14 < 35 and candle.macd > candle.macd_signal'
  );
  const [exitBody, setExitBody] = useState(
    'p = (candle.close - entry_price) / entry_price\nreturn p > 0.08 or p < -0.04'
  );
  const [claimedWinRate, setClaimedWinRate] = useState('');
  const [claimedReturn, setClaimedReturn] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      stock,
      entry_body: entryBody,
      exit_body: exitBody,
      ai_claims: {},
    };
    if (claimedWinRate !== '') payload.ai_claims.win_rate = Number(claimedWinRate);
    if (claimedReturn !== '') payload.ai_claims.total_return = Number(claimedReturn);

    onVerify(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="form-panel">
      <div className="form-panel-title">AI Strategy Verification</div>

      <div className="form-grid">
        <div className="form-field">
          <label htmlFor="stock">NSE Stock</label>
          <select
            id="stock"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            disabled={isLoading}
          >
            {NSE_STOCKS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="form-field form-field-wide">
          <label htmlFor="entryBody">Entry Condition (Python)</label>
          <textarea
            id="entryBody"
            value={entryBody}
            onChange={(e) => setEntryBody(e.target.value)}
            disabled={isLoading}
            required
            rows={3}
            spellCheck={false}
            className="code-input"
            placeholder="return candle.rsi_14 < 30"
          />
        </div>

        <div className="form-field form-field-wide">
          <label htmlFor="exitBody">Exit Condition (Python)</label>
          <textarea
            id="exitBody"
            value={exitBody}
            onChange={(e) => setExitBody(e.target.value)}
            disabled={isLoading}
            required
            rows={3}
            spellCheck={false}
            className="code-input"
            placeholder="return candle.rsi_14 > 70"
          />
        </div>

        <div className="form-field">
          <label htmlFor="claimedWinRate">AI Claimed Win Rate %</label>
          <input
            id="claimedWinRate"
            type="number"
            value={claimedWinRate}
            onChange={(e) => setClaimedWinRate(e.target.value)}
            disabled={isLoading}
            min="0"
            max="100"
            step="0.1"
            placeholder="e.g. 80"
          />
        </div>

        <div className="form-field">
          <label htmlFor="claimedReturn">AI Claimed Return %</label>
          <input
            id="claimedReturn"
            type="number"
            value={claimedReturn}
            onChange={(e) => setClaimedReturn(e.target.value)}
            disabled={isLoading}
            step="0.1"
            placeholder="e.g. 40"
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-verify" disabled={isLoading}>
            {isLoading ? (
              <>
                <span className="spinner" />
                Verifying...
              </>
            ) : (
              <>
                <ShieldAlert size={15} />
                Verify AI Claims
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
