/**
 * Lightweight custom chart legend container.
 */
export default function ChartLegend({ items = [], className = '', ...props }) {
  if (!items.length) return null;

  return (
    <div className={className} {...props}>
      {items.map((item) => (
        <span key={item.label} className={item.className}>
          {item.color && <span style={{ background: item.color }} />}
          {item.label}
        </span>
      ))}
    </div>
  );
}
