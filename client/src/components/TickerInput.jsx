import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Check, AlertCircle, Loader } from 'lucide-react';

const API = 'http://localhost:8000';

/**
 * Free-text ticker input with autocomplete over the user universe
 * and an "add ticker" flow that triggers on-demand backfill.
 *
 * Props:
 *   value: controlled storage key (e.g. "RELIANCE.NS")
 *   onChange: fires with the resolved storage key
 *   onAdded: optional, fires after a brand-new ticker finishes backfill
 *   assetClassFilter: optional array, e.g. ['equity','index']
 *   label: input label
 */
export default function TickerInput({ value, onChange, onAdded, assetClassFilter, label = 'Ticker', disabled }) {
  const [universe, setUniverse] = useState([]);
  const [query, setQuery] = useState(value || '');
  const [focused, setFocused] = useState(false);
  const [addState, setAddState] = useState({ status: 'idle' }); // idle | adding | polling | error
  const pollRef = useRef(null);

  useEffect(() => setQuery(value || ''), [value]);

  async function refreshUniverse() {
    try {
      const res = await fetch(`${API}/api/universe`);
      const data = await res.json();
      setUniverse(Array.isArray(data) ? data : []);
    } catch (e) {
      // non-fatal; autocomplete just won't populate
    }
  }

  useEffect(() => {
    refreshUniverse();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    const base = assetClassFilter
      ? universe.filter(u => assetClassFilter.includes(u.asset_class))
      : universe;
    if (!q) return base.slice(0, 8);
    return base
      .filter(u => u.symbol.toUpperCase().includes(q) || (u.display_name || '').toUpperCase().includes(q))
      .slice(0, 8);
  }, [query, universe, assetClassFilter]);

  const existsInUniverse = useMemo(() => {
    const q = query.trim().toUpperCase();
    return universe.some(u =>
      u.symbol.toUpperCase() === q
      || u.symbol.toUpperCase() === `${q}.NS`
      || (u.display_name || '').toUpperCase() === q
    );
  }, [query, universe]);

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
          if (onAdded) onAdded(symbol);
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
    const raw = query.trim();
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
        onChange(data.symbol);
        if (onAdded) onAdded(data.symbol);
      } else if (data.job_id) {
        pollJob(data.job_id, data.symbol);
      } else {
        setAddState({ status: 'idle' });
      }
    } catch (e) {
      setAddState({ status: 'error', message: e.message });
    }
  };

  const handleSelect = (u) => {
    onChange(u.symbol);
    setQuery(u.symbol);
    setFocused(false);
  };

  return (
    <div className="form-field ticker-input">
      <label>{label}</label>
      <div className="ticker-input-row">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          placeholder="Type ticker (e.g. RELIANCE, TCS.NS, USDINR)"
          disabled={disabled || addState.status === 'polling' || addState.status === 'adding'}
          spellCheck={false}
          autoComplete="off"
        />
        {!existsInUniverse && query.trim() && (
          <button
            type="button"
            className="ticker-add-btn"
            onClick={handleAdd}
            disabled={disabled || addState.status === 'polling' || addState.status === 'adding'}
            title="Add to universe and backfill history"
          >
            {addState.status === 'adding' || addState.status === 'polling'
              ? <Loader size={14} className="spin-icon" />
              : <Plus size={14} />}
            Add
          </button>
        )}
        {existsInUniverse && (
          <span className="ticker-ok-badge" title="In universe">
            <Check size={13} />
          </span>
        )}
      </div>

      {focused && filtered.length > 0 && (
        <div className="ticker-dropdown">
          {filtered.map(u => (
            <button
              key={u.symbol}
              type="button"
              className="ticker-option"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(u)}
            >
              <span className="ticker-option-sym">{u.symbol}</span>
              <span className="ticker-option-name">{u.display_name}</span>
              <span className={`ticker-option-ac ac-${u.asset_class}`}>{u.asset_class}</span>
            </button>
          ))}
        </div>
      )}

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
  );
}
