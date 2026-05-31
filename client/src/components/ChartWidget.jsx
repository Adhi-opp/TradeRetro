import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  createSeriesMarkers,
} from 'lightweight-charts';
import { RefreshCw } from 'lucide-react';

const THEME_CONFIG = {
  dark: {
    layout: { background: { color: '#1E1E2E' }, textColor: '#D4D4D4' },
    grid: {
      vertLines: { color: 'rgba(197, 203, 206, 0.08)' },
      horzLines: { color: 'rgba(197, 203, 206, 0.08)' },
    },
    upColor: '#26a69a',
    downColor: '#ef5350',
    borderUpColor: '#26a69a',
    borderDownColor: '#ef5350',
    wickUpColor: '#26a69a',
    wickDownColor: '#ef5350',
  },
  light: {
    layout: { background: { color: '#FFFFFF' }, textColor: '#333333' },
    grid: {
      vertLines: { color: 'rgba(197, 203, 206, 0.3)' },
      horzLines: { color: 'rgba(197, 203, 206, 0.3)' },
    },
    upColor: '#089981',
    downColor: '#F23645',
    borderUpColor: '#089981',
    borderDownColor: '#F23645',
    wickUpColor: '#089981',
    wickDownColor: '#F23645',
  },
};

// Overlay colors per indicator key
const OVERLAY_COLORS = {
  sma_20: 'rgba(255, 235, 59, 0.85)',
  sma_50: 'rgba(41, 98, 255, 0.9)',
  sma_200: 'rgba(255, 152, 0, 0.9)',
  bb_upper: 'rgba(156, 39, 176, 0.85)',
  bb_middle: 'rgba(156, 39, 176, 0.45)',
  bb_lower: 'rgba(156, 39, 176, 0.85)',
  donchian_high: 'rgba(0, 188, 212, 0.85)',
  donchian_low: 'rgba(0, 188, 212, 0.85)',
  donchian_mid: 'rgba(0, 188, 212, 0.35)',
  vwap: 'rgba(255, 87, 34, 0.95)',
};

const OVERLAY_LABELS = {
  sma_20: 'SMA 20',
  sma_50: 'SMA 50',
  sma_200: 'SMA 200',
  bb_upper: 'BB Upper',
  bb_middle: 'BB Mid',
  bb_lower: 'BB Lower',
  donchian_high: 'Donchian High',
  donchian_low: 'Donchian Low',
  donchian_mid: 'Donchian Mid',
};

const MAX_MARKERS = 500;

// Layout via lightweight-charts price-scale margins (single canvas).
// Dynamically chosen based on what's being shown:
//   - candles + volume always
//   - subplot (RSI/MACD) only when strategy needs one
//   - equity only when backtest results are available
function computeMargins({ hasSubplot, hasEquity }) {
  if (hasSubplot && hasEquity) {
    return {
      price:   { top: 0.04, bottom: 0.46 },  // 50%
      volume:  { top: 0.56, bottom: 0.32 },  // 12%
      subplot: { top: 0.70, bottom: 0.18 },  // 12%
      equity:  { top: 0.84, bottom: 0.00 },  // 16%
    };
  }
  if (hasEquity) {
    return {
      price:   { top: 0.04, bottom: 0.34 },  // 62%
      volume:  { top: 0.68, bottom: 0.20 },  // 12%
      equity:  { top: 0.82, bottom: 0.00 },  // 18%
    };
  }
  if (hasSubplot) {
    return {
      price:   { top: 0.04, bottom: 0.32 },  // 64%
      volume:  { top: 0.70, bottom: 0.18 },  // 12%
      subplot: { top: 0.84, bottom: 0.00 },  // 16%
    };
  }
  return {
    price:  { top: 0.04, bottom: 0.20 },  // 76%
    volume: { top: 0.82, bottom: 0.00 },  // 18%
  };
}

function tradesToMarkers(trades, theme) {
  if (!trades || trades.length === 0) return [];
  const buyColor = theme === 'light' ? '#089981' : '#26a69a';
  const sellColor = theme === 'light' ? '#F23645' : '#ef5350';
  const markers = [];
  for (const trade of trades) {
    markers.push({
      time: trade.entryDate.slice(0, 10),
      position: 'belowBar',
      color: buyColor,
      shape: 'arrowUp',
      text: `B ${trade.shares}`,
    });
    markers.push({
      time: trade.exitDate.slice(0, 10),
      position: 'aboveBar',
      color: sellColor,
      shape: 'arrowDown',
      text: `S ${trade.pnlPct >= 0 ? '+' : ''}${trade.pnlPct.toFixed(1)}%`,
    });
  }
  markers.sort((a, b) => a.time.localeCompare(b.time));
  return markers.slice(0, MAX_MARKERS);
}

function buildChartUrl(symbol, startDate, endDate, strategyParams) {
  const params = new URLSearchParams();
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  if (strategyParams?.strategyType) {
    params.set('strategyType', strategyParams.strategyType);
    if (strategyParams.fastSma) params.set('fastSma', strategyParams.fastSma);
    if (strategyParams.slowSma) params.set('slowSma', strategyParams.slowSma);
    if (strategyParams.rsiPeriod) params.set('rsiPeriod', strategyParams.rsiPeriod);
    if (strategyParams.bbPeriod) params.set('bbPeriod', strategyParams.bbPeriod);
    if (strategyParams.bbStdDev) params.set('bbStdDev', strategyParams.bbStdDev);
    if (strategyParams.dcPeriod) params.set('dcPeriod', strategyParams.dcPeriod);
  }
  const query = params.toString();
  return `http://localhost:8000/api/signals/unified/${encodeURIComponent(symbol)}${query ? `?${query}` : ''}`;
}

function hasCoverageGap(requestedRange, actualRange, truncated) {
  if (truncated) return true;
  if (!actualRange?.startDate || !actualRange?.endDate) return Boolean(requestedRange?.startDate || requestedRange?.endDate);
  if (requestedRange?.startDate && actualRange.startDate > requestedRange.startDate) return true;
  if (requestedRange?.endDate && actualRange.endDate < requestedRange.endDate) return true;
  return false;
}

export default function ChartWidget({
  theme,
  ticker: externalTicker,
  trades = [],
  backtestTicker,
  strategyParams,
  dateRange,
  equityCurve = null,
  showCosts = true,
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const markersRef = useRef(null);
  const overlaySeriesRef = useRef([]);    // SMA / BB / Donchian
  const subplotSeriesRef = useRef([]);    // RSI / MACD lines + histogram
  const equitySeriesRef = useRef([]);     // strategy equity + B&H benchmark

  const [ticker, setTicker] = useState(externalTicker || 'RELIANCE');
  const [inputValue, setInputValue] = useState(externalTicker || 'RELIANCE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dataInfo, setDataInfo] = useState(null);
  const [coverageWarning, setCoverageWarning] = useState(null);
  const [legendEntries, setLegendEntries] = useState([]);

  const rangeStart = dateRange?.startDate || '';
  const rangeEnd = dateRange?.endDate || '';

  const clearSeriesGroup = useCallback((groupRef) => {
    if (!chartRef.current) return;
    for (const { series } of groupRef.current) {
      try { chartRef.current.removeSeries(series); } catch { /* ignore */ }
    }
    groupRef.current = [];
  }, []);

  // ── Chart initialization ────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return undefined;

    const config = THEME_CONFIG[theme] || THEME_CONFIG.dark;
    // Default margins (no subplot, no equity) — re-applied dynamically after each load
    const initialMargins = computeMargins({ hasSubplot: false, hasEquity: false });
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth || 800,
      height: containerRef.current.clientHeight || 400,
      layout: config.layout,
      grid: config.grid,
      crosshair: { mode: 0 },
      rightPriceScale: {
        borderColor: 'rgba(197, 203, 206, 0.2)',
        scaleMargins: initialMargins.price,
      },
      timeScale: {
        borderColor: 'rgba(197, 203, 206, 0.2)',
        timeVisible: false,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: config.upColor,
      downColor: config.downColor,
      borderUpColor: config.borderUpColor,
      borderDownColor: config.borderDownColor,
      wickUpColor: config.wickUpColor,
      wickDownColor: config.wickDownColor,
    });

    // Volume pane — separate price scale so volume doesn't compress candles
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: 'rgba(120, 130, 145, 0.55)',
      priceScaleId: 'volume',
      priceFormat: { type: 'volume' },
      priceLineVisible: false,
      lastValueVisible: false,
    });
    chart.priceScale('volume').applyOptions({ scaleMargins: initialMargins.volume });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    markersRef.current = createSeriesMarkers(candleSeries, []);

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.resize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      clearSeriesGroup(overlaySeriesRef);
      clearSeriesGroup(subplotSeriesRef);
      clearSeriesGroup(equitySeriesRef);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      markersRef.current = null;
    };
  }, [theme, clearSeriesGroup]);

  // Re-apply margins for all scales — call after series mutations
  const applyMargins = useCallback((opts) => {
    if (!chartRef.current) return;
    const m = computeMargins(opts);
    try {
      chartRef.current.priceScale('right').applyOptions({ scaleMargins: m.price });
      chartRef.current.priceScale('volume').applyOptions({ scaleMargins: m.volume });
      if (m.subplot) chartRef.current.priceScale('subplot').applyOptions({ scaleMargins: m.subplot });
      if (m.equity) chartRef.current.priceScale('equity').applyOptions({ scaleMargins: m.equity });
    } catch { /* scale may not exist yet — safe to ignore */ }
  }, []);

  const applyMarkers = useCallback((symbol) => {
    if (!markersRef.current) return;
    if (backtestTicker && symbol.toUpperCase() === backtestTicker.toUpperCase() && trades.length > 0) {
      markersRef.current.setMarkers(tradesToMarkers(trades, theme));
    } else {
      markersRef.current.setMarkers([]);
    }
  }, [backtestTicker, trades, theme]);

  // ── Overlay rendering (SMA / Bollinger / Donchian) ───
  // Fallback color palette for arbitrary SMA periods (sma_10, sma_30, etc.)
  // — picked from a hash of the period so each ticker/period gets a stable hue.
  const dynamicOverlayColor = (key) => {
    const m = key.match(/^sma_(\d+)$/);
    if (!m) return null;
    const period = Number(m[1]);
    // Hue stepped by period — 137° golden-angle-ish for good separation
    const hue = (period * 137) % 360;
    return `hsl(${hue}, 75%, 60%)`;
  };

  const renderOverlays = useCallback((data, attached) => {
    clearSeriesGroup(overlaySeriesRef);
    if (!chartRef.current || !data?.length || !attached?.length) return [];

    const legend = [];

    for (const key of attached) {
      const color = OVERLAY_COLORS[key] || dynamicOverlayColor(key);
      if (!color) continue; // not an overlay-able key (RSI/MACD handled in renderSubplot)

      const points = data
        .filter((row) => row[key] != null)
        .map((row) => ({ time: row.time, value: row[key] }));
      if (points.length === 0) continue;

      const isMiddle = key.includes('middle') || key.includes('mid');
      const series = chartRef.current.addSeries(LineSeries, {
        color,
        lineWidth: isMiddle ? 1 : 2,
        lineStyle: isMiddle ? 2 : 0, // dashed for middle bands
        crosshairMarkerVisible: false,
        priceLineVisible: false,
        lastValueVisible: false,
        title: OVERLAY_LABELS[key] || key.toUpperCase().replace('_', ' '),
      });
      series.setData(points);
      overlaySeriesRef.current.push({ key, series });
      legend.push({ key, label: OVERLAY_LABELS[key] || key.toUpperCase().replace('_', ' '), color });
    }
    return legend;
  }, [clearSeriesGroup]);

  // ── Subplot rendering (RSI / MACD bottom pane) ──────────────
  const renderSubplot = useCallback((data, attached) => {
    clearSeriesGroup(subplotSeriesRef);
    if (!chartRef.current || !data?.length || !attached?.length) return [];

    const SUBPLOT_SCALE = 'subplot';
    const legend = [];

    const ensureScale = () => {
      chartRef.current.priceScale(SUBPLOT_SCALE).applyOptions({
        borderColor: 'rgba(197, 203, 206, 0.15)',
      });
    };

    if (attached.includes('rsi')) {
      const points = data.filter((r) => r.rsi != null).map((r) => ({ time: r.time, value: r.rsi }));
      if (points.length > 0) {
        const rsi = chartRef.current.addSeries(LineSeries, {
          color: 'rgba(255, 152, 0, 0.95)',
          lineWidth: 2,
          priceScaleId: SUBPLOT_SCALE,
          priceLineVisible: false,
          lastValueVisible: false,
          title: 'RSI',
        });
        rsi.setData(points);
        rsi.createPriceLine({ price: 70, color: 'rgba(239, 83, 80, 0.55)', lineStyle: 2, lineWidth: 1, axisLabelVisible: true, title: '70' });
        rsi.createPriceLine({ price: 30, color: 'rgba(38, 166, 154, 0.55)', lineStyle: 2, lineWidth: 1, axisLabelVisible: true, title: '30' });
        subplotSeriesRef.current.push({ key: 'rsi', series: rsi });
        legend.push({ key: 'rsi', label: 'RSI 14', color: 'rgba(255, 152, 0, 0.95)' });
        ensureScale();
      }
    }

    if (attached.includes('macd')) {
      const macdLine = data.filter((r) => r.macd != null).map((r) => ({ time: r.time, value: r.macd }));
      const signalLine = data.filter((r) => r.macd_signal != null).map((r) => ({ time: r.time, value: r.macd_signal }));
      const histPoints = data
        .filter((r) => r.macd_hist != null)
        .map((r) => ({
          time: r.time,
          value: r.macd_hist,
          color: r.macd_hist >= 0 ? 'rgba(38, 166, 154, 0.55)' : 'rgba(239, 83, 80, 0.55)',
        }));

      if (histPoints.length > 0) {
        const hist = chartRef.current.addSeries(HistogramSeries, {
          priceScaleId: SUBPLOT_SCALE,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        hist.setData(histPoints);
        subplotSeriesRef.current.push({ key: 'macd_hist', series: hist });
        ensureScale();
      }
      if (macdLine.length > 0) {
        const ml = chartRef.current.addSeries(LineSeries, {
          color: 'rgba(41, 98, 255, 0.95)',
          lineWidth: 2,
          priceScaleId: SUBPLOT_SCALE,
          priceLineVisible: false,
          lastValueVisible: false,
          title: 'MACD',
        });
        ml.setData(macdLine);
        subplotSeriesRef.current.push({ key: 'macd', series: ml });
        legend.push({ key: 'macd', label: 'MACD', color: 'rgba(41, 98, 255, 0.95)' });
      }
      if (signalLine.length > 0) {
        const sl = chartRef.current.addSeries(LineSeries, {
          color: 'rgba(255, 152, 0, 0.95)',
          lineWidth: 1,
          priceScaleId: SUBPLOT_SCALE,
          priceLineVisible: false,
          lastValueVisible: false,
          title: 'Signal',
        });
        sl.setData(signalLine);
        subplotSeriesRef.current.push({ key: 'macd_signal', series: sl });
        legend.push({ key: 'macd_signal', label: 'Signal', color: 'rgba(255, 152, 0, 0.95)' });
      }
    }

    return legend;
  }, [clearSeriesGroup]);

  // ── Equity-curve pane (bottom of chart, synced time axis) ─────
  // Renders strategy equity + buy-and-hold benchmark on a dedicated
  // bottom price scale. Sourced from the backtest result so dates
  // automatically align with the candle chart's x-axis.
  const renderEquity = useCallback((curve, candleData, useNetEquity) => {
    clearSeriesGroup(equitySeriesRef);
    if (!chartRef.current || !curve?.length || !candleData?.length) return [];

    const EQUITY_SCALE = 'equity';
    const equityKey = useNetEquity ? 'equity' : 'grossEquity';

    // Backtest's first point has the initial capital. Compute B&H from candle close.
    const initialEquity = curve[0][equityKey] ?? curve[0].equity;
    const initialPrice = curve[0].price ?? candleData[0].close;

    const stratPoints = curve
      .map((d) => ({
        time: (d.date || '').slice(0, 10),
        value: Number(d[equityKey] ?? d.equity),
      }))
      .filter((p) => p.time && Number.isFinite(p.value));

    // Buy & hold = initial_equity × (price[t] / price[0])
    // Use candle data as the price source so B&H extends across all dates
    const bhPoints = candleData.map((c) => ({
      time: c.time,
      value: initialEquity * (c.close / initialPrice),
    }));

    if (stratPoints.length === 0) return [];

    const stratSeries = chartRef.current.addSeries(LineSeries, {
      color: 'rgba(34, 197, 94, 0.95)',
      lineWidth: 2,
      priceScaleId: EQUITY_SCALE,
      priceLineVisible: false,
      lastValueVisible: false,
      title: useNetEquity ? 'Equity (Net)' : 'Equity (Gross)',
    });
    stratSeries.setData(stratPoints);
    equitySeriesRef.current.push({ key: 'equity', series: stratSeries });

    const bhSeries = chartRef.current.addSeries(LineSeries, {
      color: 'rgba(99, 102, 241, 0.85)',
      lineWidth: 1.5,
      lineStyle: 2, // dashed
      priceScaleId: EQUITY_SCALE,
      priceLineVisible: false,
      lastValueVisible: false,
      title: 'Buy & Hold',
    });
    bhSeries.setData(bhPoints);
    equitySeriesRef.current.push({ key: 'buyHold', series: bhSeries });

    chartRef.current.priceScale(EQUITY_SCALE).applyOptions({
      borderColor: 'rgba(197, 203, 206, 0.15)',
    });

    const finalStrat = stratPoints[stratPoints.length - 1].value;
    const finalBH = bhPoints[bhPoints.length - 1].value;
    const stratPct = ((finalStrat - initialEquity) / initialEquity) * 100;
    const bhPct = ((finalBH - initialEquity) / initialEquity) * 100;
    const alpha = stratPct - bhPct;

    return [
      { key: 'equity', label: `Equity ${stratPct >= 0 ? '+' : ''}${stratPct.toFixed(1)}%`, color: 'rgba(34, 197, 94, 0.95)' },
      { key: 'buyHold', label: `B&H ${bhPct >= 0 ? '+' : ''}${bhPct.toFixed(1)}%`, color: 'rgba(99, 102, 241, 0.85)' },
      { key: 'alpha', label: `α ${alpha >= 0 ? '+' : ''}${alpha.toFixed(1)}%`, color: alpha >= 0 ? '#22c55e' : '#ef4444' },
    ];
  }, [clearSeriesGroup]);

  // ── Data fetch + render ────────────────────────────────────
  const fetchAndRenderData = useCallback(async (symbol) => {
    setLoading(true);
    setError(null);
    setDataInfo(null);
    setCoverageWarning(null);
    setLegendEntries([]);

    try {
      // Only attach strategy indicators when viewing the backtested ticker
      const isBacktestedTicker = backtestTicker && symbol.toUpperCase() === backtestTicker.toUpperCase();
      const stratParams = isBacktestedTicker ? strategyParams : null;

      const res = await fetch(buildChartUrl(symbol, rangeStart, rangeEnd, stratParams));
      const json = await res.json();

      if (!res.ok) throw new Error(json.message || json.error || `No data for ${symbol}`);
      if (!candleSeriesRef.current || !chartRef.current) return;

      const candles = json.data.map((item) => ({
        time: item.time,
        open: item.open, high: item.high, low: item.low, close: item.close,
      }));
      candleSeriesRef.current.setData(candles);

      // Volume bars — colored by candle direction
      const volumeBars = json.data.map((item) => ({
        time: item.time,
        value: item.volume,
        color: item.close >= item.open
          ? 'rgba(38, 166, 154, 0.35)'
          : 'rgba(239, 83, 80, 0.35)',
      }));
      volumeSeriesRef.current?.setData(volumeBars);

      const attached = json.indicators?.attached || [];
      const overlayLegend = renderOverlays(json.data, attached);
      const subplotLegend = renderSubplot(json.data, attached);

      // Equity pane — only when viewing the backtested ticker and results exist
      const equityLegend = isBacktestedTicker && equityCurve?.length > 0
        ? renderEquity(equityCurve, json.data, showCosts)
        : (clearSeriesGroup(equitySeriesRef), []);

      // Re-apply scale margins now that we know what's present
      applyMargins({
        hasSubplot: subplotLegend.length > 0,
        hasEquity: equityLegend.length > 0,
      });

      applyMarkers(symbol);
      chartRef.current.timeScale().fitContent();

      const requestedRange = json.requestedRange || { startDate: rangeStart || null, endDate: rangeEnd || null };
      const actualRange = json.actualRange || {
        startDate: json.data[0]?.time || null,
        endDate: json.data[json.data.length - 1]?.time || null,
      };

      const overlayLabel = attached.length > 0
        ? ` · indicators: ${attached.join(', ')}`
        : '';
      const loadedLabel = ` · ${actualRange.startDate || 'n/a'} → ${actualRange.endDate || 'n/a'}`;
      setDataInfo(`${json.ticker} — ${json.count} candles${overlayLabel}${loadedLabel}`);
      setLegendEntries([...overlayLegend, ...subplotLegend, ...equityLegend]);

      if (hasCoverageGap(requestedRange, actualRange, json.truncated)) {
        setCoverageWarning(
          `Chart data covers ${actualRange.startDate || 'n/a'} → ${actualRange.endDate || 'n/a'}. Backfill raw.historical_prices to match the selected backtest range.`,
        );
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch chart data');
    } finally {
      setLoading(false);
    }
  }, [applyMarkers, rangeStart, rangeEnd, backtestTicker, strategyParams, renderOverlays, renderSubplot, renderEquity, applyMargins, clearSeriesGroup, equityCurve, showCosts]);

  useEffect(() => {
    if (chartRef.current && candleSeriesRef.current) {
      fetchAndRenderData(ticker);
    }
  }, [ticker, theme, fetchAndRenderData]);

  useEffect(() => {
    applyMarkers(ticker);
  }, [trades, backtestTicker, applyMarkers, ticker]);

  useEffect(() => {
    if (externalTicker && externalTicker !== ticker) {
      setTicker(externalTicker);
      setInputValue(externalTicker);
    }
  }, [externalTicker, ticker]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const cleaned = inputValue.trim().toUpperCase();
    if (!cleaned) return;
    if (cleaned !== ticker) { setTicker(cleaned); return; }
    fetchAndRenderData(cleaned);
  };

  return (
    <div className="chart-widget">
      <div className="chart-widget-toolbar">
        <form onSubmit={handleSubmit} className="chart-ticker-form">
          <input
            type="text"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value.toUpperCase())}
            placeholder="SYMBOL"
            className="chart-ticker-input"
            spellCheck={false}
          />
          <button type="submit" className="chart-ticker-btn" disabled={loading} title="Load chart">
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
        </form>
        {legendEntries.length > 0 && (
          <div className="chart-legend">
            {legendEntries.map((e) => (
              <span key={e.key} className="chart-legend-item">
                <span className="chart-legend-swatch" style={{ background: e.color }} />
                {e.label}
              </span>
            ))}
          </div>
        )}
        {dataInfo && <span className="chart-data-info">{dataInfo}</span>}
        {coverageWarning && <span className="chart-warning-info">{coverageWarning}</span>}
        {error && <span className="chart-error-info">{error}</span>}
      </div>
      <div className="chart-canvas" ref={containerRef} />
    </div>
  );
}
