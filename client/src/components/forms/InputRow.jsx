/**
 * Reusable row wrapper for compact input groups.
 *
 * This component is layout-only and does not own any input state.
 */
export default function InputRow({ children, className = '', ...props }) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}
