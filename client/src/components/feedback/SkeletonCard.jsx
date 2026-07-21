/**
 * Reusable skeleton block for card-like loading placeholders.
 */
export default function SkeletonCard({ className = '', style, ...props }) {
  const classes = ['skeleton-card', className].filter(Boolean).join(' ');
  return <div className={classes} style={style} {...props} />;
}
