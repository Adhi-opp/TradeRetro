import { ShieldCheck, TrendingUp, AlertTriangle, HelpCircle, Compass, ArrowRight } from 'lucide-react';

function fmtPct(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function evaluateAssessment(metrics, analytics) {
  if (!metrics) return { rating: 'WEAK', tone: 'neg', summary: 'Insufficient metric data.' };

  const ret = metrics.totalReturnPct ?? 0;
  const winRate = metrics.winRate ?? 0;
  const maxDd = Math.abs(metrics.maxDrawdownPct ?? 0);
  const sharpe = metrics.sharpeRatio ?? 0;
  const trades = metrics.totalTrades ?? 0;
  const bnh = analytics?.benchmark?.totalReturn ?? 0;
  const excess = ret - bnh;

  if (trades < 2) {
    return {
      rating: 'MIXED',
      tone: 'warn',
      title: 'Low Trade Frequency',
      summary: 'The strategy generated very few trades during this period, making statistical confidence limited.',
      highlights: [
        { label: 'Return', value: fmtPct(ret), tone: ret >= 0 ? 'pos' : 'neg' },
        { label: 'Total Trades', value: `${trades}`, tone: 'neutral' },
        { label: 'Max Drawdown', value: `-${maxDd.toFixed(1)}%`, tone: 'neutral' },
      ],
      insights: [
        'The strategy traded infrequently over the selected timeframe.',
        'Consider widening the lookback window or reducing indicator periods.',
        'Evaluate whether the signal thresholds are too restrictive.',
      ],
    };
  }

  // Strong: Profitable, Sharpe >= 1.0, winRate >= 50, excess return > 0
  if (ret > 0 && sharpe >= 1.0 && winRate >= 50 && excess > 0 && maxDd < 20) {
    return {
      rating: 'STRONG',
      tone: 'pos',
      title: 'Robust & Outperforming',
      summary: `Your strategy generated strong risk-adjusted returns (${fmtPct(ret)}) and outperformed the buy-and-hold benchmark by ${fmtPct(excess)} with controlled drawdown (-${maxDd.toFixed(1)}%).`,
      highlights: [
        { label: 'Return', value: fmtPct(ret), tone: 'pos' },
        { label: 'Win Rate', value: `${winRate.toFixed(1)}%`, tone: 'pos' },
        { label: 'Sharpe Ratio', value: sharpe.toFixed(2), tone: 'pos' },
        { label: 'vs Buy & Hold', value: fmtPct(excess), tone: 'pos' },
      ],
      insights: [
        'The strategy demonstrated strong momentum capture and risk containment.',
        'Benchmark outperformance confirms edge over passive holding.',
        'Risk-adjusted return (Sharpe >= 1.0) indicates healthy reward per unit of volatility.',
      ],
    };
  }

  // Promising: Profitable and outperforming benchmark OR good Sharpe
  if (ret > 0 && (excess > 0 || sharpe >= 0.5)) {
    return {
      rating: 'PROMISING',
      tone: 'pos',
      title: 'Profitable with Potential',
      summary: `Your strategy achieved a positive return (${fmtPct(ret)}) with a ${winRate.toFixed(1)}% win rate, though drawdown (-${maxDd.toFixed(1)}%) indicates meaningful volatility risk.`,
      highlights: [
        { label: 'Return', value: fmtPct(ret), tone: 'pos' },
        { label: 'Win Rate', value: `${winRate.toFixed(1)}%`, tone: 'pos' },
        { label: 'Max Drawdown', value: `-${maxDd.toFixed(1)}%`, tone: maxDd > 15 ? 'neg' : 'neutral' },
        { label: 'Sharpe Ratio', value: sharpe.toFixed(2), tone: 'neutral' },
      ],
      insights: [
        'The strategy was profitable overall during this historical period.',
        'Drawdown magnitude suggests potential for improvement via stop-loss tuning.',
        'Performance should be validated across additional market regimes.',
      ],
    };
  }

  // Mixed: Small positive return or moderate loss but decent win rate / trades
  if (ret >= -5 && (winRate >= 45 || sharpe >= 0)) {
    return {
      rating: 'MIXED',
      tone: 'warn',
      title: 'Inconclusive / Mixed Edge',
      summary: `The strategy yielded mixed results (${fmtPct(ret)} return, ${winRate.toFixed(1)}% win rate). It traded active signals but lacked decisive risk-adjusted edge over the benchmark (${fmtPct(excess)}).`,
      highlights: [
        { label: 'Return', value: fmtPct(ret), tone: ret >= 0 ? 'pos' : 'neg' },
        { label: 'Win Rate', value: `${winRate.toFixed(1)}%`, tone: 'neutral' },
        { label: 'vs Buy & Hold', value: fmtPct(excess), tone: excess >= 0 ? 'pos' : 'neg' },
        { label: 'Sharpe Ratio', value: sharpe.toFixed(2), tone: 'neutral' },
      ],
      insights: [
        'Returns were close to breakeven with moderate trade frequency.',
        'Benchmark comparison indicates passive holding was competitive or superior.',
        'Slippage and transaction costs may have eroded thin trade margins.',
      ],
    };
  }

  // Weak: Negative return, underperforming benchmark, high drawdown
  return {
    rating: 'WEAK',
    tone: 'neg',
    title: 'Underperforming / High Risk',
    summary: `Your strategy underperformed the market with a total return of ${fmtPct(ret)} and experienced a peak drawdown of -${maxDd.toFixed(1)}%.`,
    highlights: [
      { label: 'Return', value: fmtPct(ret), tone: 'neg' },
      { label: 'Win Rate', value: `${winRate.toFixed(1)}%`, tone: 'neg' },
      { label: 'Max Drawdown', value: `-${maxDd.toFixed(1)}%`, tone: 'neg' },
      { label: 'vs Buy & Hold', value: fmtPct(excess), tone: 'neg' },
    ],
    insights: [
      'The strategy suffered significant capital erosion during trending/volatile periods.',
      'Underperformed the buy-and-hold benchmark over the selected timeframe.',
      'Requires fundamental parameter adjustment or risk guardrail activation.',
    ],
  };
}

export default function StrategyAssessment({ metrics, analytics, ranTicker, ranRange, strategyType }) {
  if (!metrics) return null;
  const evalResult = evaluateAssessment(metrics, analytics);

  return (
    <div className="panel strategy-assessment-panel">
      <div className="sa-header">
        <div className="sa-title-block">
          <span className="sa-badge">STRATEGY ASSESSMENT</span>
          <h3 className="sa-heading">Performance & Risk Interpretation</h3>
          <p className="sa-subtext">
            Automated qualitative evaluation of backtest results for <strong>{ranTicker}</strong> ({ranRange?.startDate} to {ranRange?.endDate}).
          </p>
        </div>
        <div className={`sa-rating-pill sa-rating-${evalResult.tone}`}>
          <span className="sa-rating-label">{evalResult.rating}</span>
          <span className="sa-rating-sub">{evalResult.title}</span>
        </div>
      </div>

      <div className="sa-summary-box">
        <p className="sa-summary-text">{evalResult.summary}</p>
      </div>

      <div className="sa-grid-highlights">
        {evalResult.highlights.map((h, i) => (
          <div key={i} className="sa-highlight-card">
            <span className="sa-hl-label">{h.label}</span>
            <span className={`sa-hl-value sa-hl-${h.tone}`}>{h.value}</span>
          </div>
        ))}
      </div>

      <div className="sa-details-section">
        <h4 className="sa-section-title">
          <Compass size={14} />
          <span>Key Analytical Insights</span>
        </h4>
        <ul className="sa-insights-list">
          {evalResult.insights.map((insight, idx) => (
            <li key={idx}>{insight}</li>
          ))}
        </ul>
      </div>

      <div className="sa-next-steps">
        <h4 className="sa-section-title">
          <ArrowRight size={14} />
          <span>Next Things to Investigate</span>
        </h4>
        <div className="sa-next-grid">
          <div className="sa-next-item">
            <strong>1. Test Different Market Regimes</strong>
            <p>Adjust the lookback period to cover both bull and bear market cycles.</p>
          </div>
          <div className="sa-next-item">
            <strong>2. Enable Risk Model Guardrails</strong>
            <p>Toggle risk management ON in step 3 to evaluate stop-loss protection.</p>
          </div>
          <div className="sa-next-item">
            <strong>3. Parameter Sweep & Optimization</strong>
            <p>Expand Deep Analytics below to test parameter sensitivities across ranges.</p>
          </div>
          <div className="sa-next-item">
            <strong>4. Ask AI Copilot</strong>
            <p>Use the AI Copilot sidecar to analyze trade exit breakdown and drawdown durations.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
