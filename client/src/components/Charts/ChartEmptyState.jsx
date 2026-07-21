/**
 * Standard chart empty state.
 */
export default function ChartEmptyState({ children = 'No chart data available.', className = 'ca-empty', ...props }) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}
