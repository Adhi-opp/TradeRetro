/**
 * Generic helper text.
 *
 * Use for secondary explanatory or progress text below a control.
 */
export default function HelperText({ children, className = '', ...props }) {
  if (!children) return null;
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}
