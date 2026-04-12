import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, CandlestickSeries, LineSeries, createSeriesMarkers } from 'lightweight-charts';
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

const SMA_COLORS = {
  sma_20: 'rgba(255, 235, 59, 0.85)',
  sma_50: 'rgba(41, 98, 255, 0.9)',
  sma_200: 'rgba(255, 152, 0, 0.9)',
};

const SMA_LABELS = {
  sma_20: 'SMA 20',
  sma_50: 'SMA 50',
  sma_200: 'SMA 200',
};

const PRECOMPUTED_PERIODS = [20, 50, 200];
const MAX_MARKERS = 500;

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

function getSmaKeysForStrategy(strategyParams) {
  if (!strategyParams || strategyParams.strategyType !== 'MOVING_AVERAGE_CROSSOVER') return [];

  const keys = [];
  if (strategyParams.fastSma && PRECOMPUTED_PERIODS.includes(strategyParams.fastSma)) {
    keys.push(`sma_${strategyParams.fastSma}`);
  }
  if (strategyParams.slowSma && PRECOMPUTED_PERIODS.includes(strategyParams.slowSma)) {
    keys.push(`sma_${strategyParams.slowSma}`);
  }

  return keys;
}

function buildChartUrl(symbol, startDate, endDate) {
  const params = new URLSearchParams();
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
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

function getIndicatorWarmupWarning(symbol, data, smaKeys) {
  if (!data?.length || smaKeys.length === 0) return null;

  const firstRow = data[0];
  const coldIndicators = smaKeys.filter((key) => firstRow[key] == null);
  if (coldIndicators.length === 0) return null;

  const tickerForCommand = symbol.endsWith('.NS') ? symbol : `${symbol}.NS`;
  const labels = coldIndicators.map((key) => SMA_LABELS[key] || key.toUpperCase()).join(', ');

  return `Indicator warm-up incomplete: ${labels} need earlier price history before ${firstRow.time}. Run python src/ingestion/fetch_ohlcv.py --symbol ${tickerForCommand} --period 10y to backfill.`;
}

export default function ChartWidget({
  theme,
  ticker: externalTicker,
  trades = [],
  backtestTicker,
  strategyParams,
  dateRange,
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const markersRef = useRef(null);
  const smaSeriesRefs = useRef([]);

  const [ticker, setTicker] = useState(externalTicker || 'RELIANCE');
  const [inputValue, setInputValue] = useState(externalTicker || 'RELIANCE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dataInfo, setDataInfo] = useState(null);
  const [coverageWarning, setCoverageWarning] = useState(null);
  const [indicatorWarmupWarning, setIndicatorWarmupWarning] = useState(null);

  const rangeStart = dateRange?.startDate || '';
  const rangeEnd = dateRange?.endDate || '';

  const clearSmaSeries = useCallback(() => {
    if (!chartRef.current || smaSeriesRefs.current.length === 0) return;

    for (const { series } of smaSeriesRefs.current) {
      try {
        chartRef.current.removeSeries(series);
      } catch {
        // Ignore already removed series.
      }
    }
    smaSeriesRefs.current = [];
  }, []);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const config = THEME_CONFIG[theme] || THEME_CONFIG.dark;
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth || 800,
      height: containerRef.current.clientHeight || 400,
      layout: config.layout,
      grid: config.grid,
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: 'rgba(197, 203, 206, 0.2)' },
      timeScale: {
        borderColor: 'rgba(197, 203, 206, 0.2)',
        timeVisible: false,
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: config.upColor,
      downColor: config.downColor,
      borderUpColor: config.borderUpColor,
      borderDownColor: config.borderDownColor,
      wickUpColor: config.wickUpColor,
      wickDownColor: config.wickDownColor,
    });

    chartRef.current = chart;
    seriesRef.current = series;
    markersRef.current = createSeriesMarkers(series, []);

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.resize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      clearSmaSeries();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      markersRef.current = null;
    };
  }, [theme, clearSmaSeries]);

  const applyMarkers = useCallback((symbol) => {
    if (!markersRef.current) return;

    if (backtestTicker && symbol.toUpperCase() === backtestTicker.toUpperCase() && trades.length > 0) {
      markersRef.current.setMarkers(tradesToMarkers(trades, theme));
    } else {
      markersRef.current.setMarkers([]);
    }
  }, [backtestTicker, trades, theme]);

  const fetchAndRenderData = useCallback(async (symbol) => {
    setLoading(true);
    setError(null);
    setDataInfo(null);
    setCoverageWarning(null);
    setIndicatorWarmupWarning(null);

    try {
      const res = await fetch(buildChartUrl(symbol, rangeStart, rangeEnd));
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message || json.error || `No data for ${symbol}`);
      }

      if (!seriesRef.current || !chartRef.current) return;

      const candles = json.data.map((item) => ({
        time: item.time,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
      }));
      seriesRef.current.setData(candles);

      clearSmaSeries();
      const smaKeys = getSmaKeysForStrategy(strategyParams);
      for (const key of smaKeys) {
        const smaData = json.data
          .filter((item) => item[key] != null)
          .map((item) => ({ time: item.time, value: item[key] }));

        if (smaData.length === 0) continue;

        const smaSeries = chartRef.current.addSeries(LineSeries, {
          color: SMA_COLORS[key] || 'rgba(150, 150, 150, 0.8)',
          lineWidth: 2,
          crosshairMarkerVisible: false,
          title: SMA_LABELS[key] || key,
          priceLineVisible: false,
        });
        smaSeries.setData(smaData);
        smaSeriesRefs.current.push({ key, series: smaSeries });
      }

      applyMarkers(symbol);
      chartRef.current.timeScale().fitContent();

      const requestedRange = json.requestedRange || {
        startDate: rangeStart || null,
        endDate: rangeEnd || null,
      };
      const actualRange = json.actualRange || {
        startDate: json.data[0]?.time || null,
        endDate: json.data[json.data.length - 1]?.time || null,
      };

      const smaLabel = smaSeriesRefs.current.length > 0
        ? ` | SMA: ${smaSeriesRefs.current.map((item) => item.key.replace('sma_', '')).join('/')}`
        : '';
      const requestedLabel = requestedRange.startDate || requestedRange.endDate
        ? ` | Requested: ${requestedRange.startDate || 'start'} -> ${requestedRange.endDate || 'end'}`
        : '';
      const loadedLabel = ` | Loaded: ${actualRange.startDate || 'n/a'} -> ${actualRange.endDate || 'n/a'}`;
      setDataInfo(`${json.ticker} - ${json.count} candles${smaLabel}${requestedLabel}${loadedLabel}`);

      if (hasCoverageGap(requestedRange, actualRange, json.truncated)) {
        setCoverageWarning(
          `PostgreSQL chart data only covers ${actualRange.startDate || 'n/a'} -> ${actualRange.endDate || 'n/a'}. Backfill raw.historical_prices to match the selected backtest range.`,
        );
      }

      const warmupWarning = getIndicatorWarmupWarning(symbol, json.data, smaKeys);
      if (warmupWarning) {
        setIndicatorWarmupWarning(warmupWarning);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch chart data');
    } finally {
      setLoading(false);
    }
  }, [applyMarkers, clearSmaSeries, strategyParams, rangeStart, rangeEnd]);

  useEffect(() => {
    if (chartRef.current && seriesRef.current) {
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

    if (cleaned !== ticker) {
      setTicker(cleaned);
      return;
    }

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
        {dataInfo && <span className="chart-data-info">{dataInfo}</span>}
        {coverageWarning && <span className="chart-warning-info">{coverageWarning}</span>}
        {indicatorWarmupWarning && <span className="chart-warning-info">{indicatorWarmupWarning}</span>}
        {error && <span className="chart-error-info">{error}</span>}
      </div>
      <div className="chart-canvas" ref={containerRef} />
    </div>
  );
}
