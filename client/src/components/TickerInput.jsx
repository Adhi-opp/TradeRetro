import { useEffect, useRef, useState } from 'react';
import { Plus, AlertCircle, Loader } from 'lucide-react';

const API = 'http://localhost:8000';

export default function TickerInput({ value, onChange, onAdded, assetClassFilter, label = 'Select Asset', disabled }) {
  const [universe, setUniverse] = useState([]);
  const [localValue, setLocalValue] = useState(value || '');
  const [addOpen, setAddOpen] = useState(false);
  const [addQuery, setAddQuery] = useState('');
  const [addState, setAddState] = useState({ status: 'idle' });
  const pollRef = useRef(null);

  useEffect(() => setLocalValue(value || ''), [value]);

  async function refreshUniverse() {
    try {
      const res = await fetch(`${API}/api/universe`);
      const data = await res.json();
      setUniverse(Array.isArray(data) ? data : []);
    } catch (e) {}
  }

  useEffect(() => {
    refreshUniverse();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const filtered = assetClassFilter
    ? universe.filter(u => assetClassFilter.includes(u.asset_class))
    : universe;

  const pollJob = (jobId, symbol) => {
    setAddState({ status: 'polling', jobId, symbol });
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${API}/api/ingest/status/${jobId}`);
        const d = await r.json();
        if (d.status === 'completed') {
          clearInterval(pollRef.current);
          await refreshUniverse();
          setAddState({ status: 'idle' });
          setAddOpen(false);
          setAddQuery('');
          if (onAdded) onAdded(symbol);
          setLocalValue(symbol);
          onChange(symbol);
        } else if (d.status === 'failed') {
          clearInterval(pollRef.current);
          setAddState({ status: 'error', message: d.error || 'backfill failed' });
        }
      } catch (e) {
        clearInterval(pollRef.current);
        setAddState({ status: 'error', message: 'status poll failed' });
      }
    }, 2000);
  };

  const handleAdd = async () => {
    const raw = addQuery.trim();
    if (!raw) return;
    setAddState({ status: 'adding' });
    try {
      const res = await fetch(`${API}/api/universe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: raw, period: '2y' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddState({ status: 'error', message: data.detail || data.message || 'add failed' });
        return;
      }
      if (data.backfill_status === 'completed') {
        await refreshUniverse();
        setAddState({ status: 'idle' });
        setAddOpen(false);
        setAddQuery('');
        onChange(data.symbol);
        setLocalValue(data.symbol);
        if (onAdded) onAdded(data.symbol);
      } else if (data.job_id) {
        pollJob(data.job_id, data.symbol);
      } else {
        setAddState({ status: 'idle' });
        setAddOpen(false);
      }
    } catch (e) {
      setAddState({ status: 'error', message: e.message });
    }
  };

  const handleSelect = (symbol) => {
    setLocalValue(symbol);
    onChange(symbol);
  };

  return (
    <div className="form-field ticker-input">
      <label>{label}</label>
      <div className="ticker-select-row">
        <select
          value={localValue}
          onChange={(e) => handleSelect(e.target.value)}
          disabled={disabled || addState.status === 'polling' || addState.status === 'adding'}
          className="ticker-select"
        >
          <option value="" disabled>— Select an asset —</option>
          {filtered.map(u => (
            <option key={u.symbol} value={u.symbol}>
              {u.symbol} — {u.display_name} ({u.asset_class})
            </option>
          ))}
        </select>
        <button
          type="button"
          className="ticker-open-add-btn"
          onClick={() => { setAddOpen(true); setAddState({ status: 'idle' }); }}
          disabled={disabled}
          title="Add a new ticker"
        >
          <Plus size={14} />
        </button>
      </div>

      {addOpen && (
        <div className="ticker-add-panel">
          <div className="ticker-add-row">
            <input
              type="text"
              value={addQuery}
              onChange={(e) => setAddQuery(e.target.value)}
              placeholder="Symbol (e.g. MARUTI.NS, AAPL)"
              disabled={addState.status === 'adding' || addState.status === 'polling'}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAddOpen(false); }}
            />
            <button
              type="button"
              className="ticker-add-btn"
              onClick={handleAdd}
              disabled={!addQuery.trim() || addState.status === 'adding' || addState.status === 'polling'}
            >
              {addState.status === 'adding' || addState.status === 'polling'
                ? <Loader size={14} className="spin-icon" />
                : <Plus size={14} />}
              {addState.status === 'polling' ? 'Backfilling...' : 'Add & Backfill'}
            </button>
            <button
              type="button"
              className="ticker-cancel-btn"
              onClick={() => { setAddOpen(false); setAddState({ status: 'idle' }); }}
            >
              Cancel
            </button>
          </div>
          {addState.status === 'polling' && (
            <div className="ticker-add-status">
              <Loader size={12} className="spin-icon" />
              Backfilling {addState.symbol}… (~5-15s)
            </div>
          )}
          {addState.status === 'error' && (
            <div className="ticker-add-status ticker-add-error">
              <AlertCircle size={12} />
              {addState.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
