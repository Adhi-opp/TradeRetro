/**
 * Reusable controlled form field wrapper.
 *
 * This component owns only structure: label, field body, helper text, and
 * validation text. Input values and change handlers stay controlled by callers.
 */
export default function FormField({
  id,
  label,
  helper,
  error,
  children,
  className = '',
  labelClassName = '',
  ...props
}) {
  return (
    <div className={className} {...props}>
      {label && (
        <label htmlFor={id} className={labelClassName}>
          {label}
        </label>
      )}
      {children}
      {helper}
      {error}
    </div>
  );
}
