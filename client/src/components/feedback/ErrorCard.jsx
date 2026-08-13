/**
 * Reusable card-level error wrapper.
 */
export default function ErrorCard({ title, message, children, className = '', ...props }) {
  return (
    <div className={className} {...props}>
      {title}
      {message}
      {children}
    </div>
  );
}
