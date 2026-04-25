import { TrendingUp, TrendingDown, Calendar, Layers } from 'lucide-react';

function fmtINR(n) {
  return `\u20B9${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function fmtDate(s) {
  if (!s) return '\u2014';
  return new Date(s).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
}

function strategyLabel(s) {
  if (!s) return 'Strategy';
  return ({
    MOVING_AVERAGE_CROSSOVER: 'SMA Crossover',
    RSI: 'RSI Mean Reversion',
    MACD: 'MACD Momentum',
  })[s] || s;
}

export default function SummaryRibbon({ metrics, ticker, strategy, range }) {
  if (!metrics) return null;

  const start = range?.startDate || metrics.startDate;
  const end = range?.endDate || metrics.endDate;
  const ret = metrics.totalReturn;
  const isWin = ret >= 0;
  const vsBench = (metrics.totalReturn ?? 0) - (metrics.buyHoldReturn ?? 0);

  return (
    <div className="summary-ribbon">
      <div className="sr-identity">
        <div className="sr-ticker">{ticker || '\u2014'}</div>
        <div className="sr-meta">
          <span><Layers size={11} /> {strategyLabel(strategy?.strategyType)}</span>
          <span><Calendar size={11} /> {fmtDate(start)} &rarr; {fmtDate(end)}</span>
          <span>{metrics.totalDays}d window</span>
        </div>
      </div>

      <div className="sr-capital">
        <div className="sr-capital-col">
          <div className="sr-capital-label">Initial</div>
          <div className="sr-capital-val">{fmtINR(metrics.initialCapital)}</div>
        </div>
        <div className="sr-arrow">&rarr;</div>
        <div className="sr-capital-col">
          <div className="sr-capital-label">Final</div>
          <div className={`sr-capital-val sr-capital-val-hero ${isWin ? 'positive' : 'negative'}`}>
            {fmtINR(metrics.finalValue)}
          </div>
        </div>
      </div>

      <div className="sr-headline">
        <div className={`sr-return ${isWin ? 'positive' : 'negative'}`}>
          {isWin ? <TrendingUp size={22} /> : <TrendingDown size={22} />}
          <span>{isWin ? '+' : ''}{ret.toFixed(2)}%</span>
        </div>
        <div className="sr-vs-bench">
          <span className="sr-vs-label">vs Buy &amp; Hold</span>
          <span className={vsBench >= 0 ? 'positive' : 'negative'}>
            {vsBench >= 0 ? '+' : ''}{vsBench.toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );
}
