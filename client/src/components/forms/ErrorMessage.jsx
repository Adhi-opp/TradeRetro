/**
 * Generic error message.
 *
 * Use for request or validation errors while preserving existing class names
 * through the `className` prop.
 */
export default function ErrorMessage({ children, className = '', ...props }) {
  if (!children) return null;
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}
