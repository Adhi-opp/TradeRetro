/**
 * TradeRetro brand mark — "Retro Marker".
 *
 * One coherent symbol: three ascending candlesticks (historical market
 * behaviour) standing on a timeline baseline, wrapped by a counter-clockwise
 * replay arc (looking back through market history) with two direction tips.
 * The candles come from the app's primary text colour and the replay ring
 * from the app's amber accent token, so the mark adapts to dark/light themes.
 */
export default function TradeRetroLogo({ size = 56, className = '' }) {
  return (
    <svg
      className={className ? `tr-logo ${className}` : 'tr-logo'}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      <rect x="1" y="1" width="62" height="62" rx="14" className="tr-logo-tile" />

      <path d="M15.5 50 H 42.5" className="tr-logo-base" />

      <path d="M20 39.5 V46.5" className="tr-logo-wick" />
      <path d="M29 35 V42" className="tr-logo-wick" />
      <path d="M38 30.5 V37.5" className="tr-logo-wick" />
      <rect x="17" y="46.5" width="6" height="3.5" rx="1" className="tr-logo-candle" />
      <rect x="26" y="42" width="6" height="8" rx="1" className="tr-logo-candle" />
      <rect x="35" y="37.5" width="6" height="12.5" rx="1.5" className="tr-logo-candle" />

      <path d="M14.39 46.13 L14.83 39.74 L20.01 43.51" className="tr-logo-ring" />
      <path d="M14.83 39.74 A19.5 19.5 0 1 0 51.93 29.8" className="tr-logo-ring" />
      <path d="M54.53 23.95 L51.93 29.8 L48.35 24.49" className="tr-logo-ring" />
    </svg>
  );
}