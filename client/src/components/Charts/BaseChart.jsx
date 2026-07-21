import { ResponsiveContainer } from 'recharts';

/**
 * Shared responsive chart container.
 */
export default function BaseChart({ children, className = 'chart-wrapper', height, style, ...props }) {
  const mergedStyle = height ? { height, ...style } : style;

  return (
    <div className={className} style={mergedStyle} {...props}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}
