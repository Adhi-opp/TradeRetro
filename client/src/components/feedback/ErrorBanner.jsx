/**
 * Reusable inline error banner.
 */
export default function ErrorBanner({ children, className = '', ...props }) {
  if (!children) return null;
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}
