/**
 * Reusable parameter group wrapper.
 *
 * Keeps strategy/sweep parameter blocks composable while leaving every input
 * controlled by the parent component.
 */
export default function ParameterGroup({ label, children, className = '', labelClassName = '', ...props }) {
  return (
    <div className={className} {...props}>
      {label && <label className={labelClassName}>{label}</label>}
      {children}
    </div>
  );
}
