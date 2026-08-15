/**
 * Generic validation message.
 *
 * Use for non-fatal field validation text. Existing validation logic remains
 * owned by the caller.
 */
export default function ValidationMessage({ children, className = '', ...props }) {
  if (!children) return null;
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}
