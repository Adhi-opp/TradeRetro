/**
 * Reusable form section wrapper.
 *
 * Use this to group related form controls without introducing state or
 * validation behavior.
 */
export default function FormSection({ title, description, actions, children, className = '', ...props }) {
  return (
    <section className={className} {...props}>
      {(title || description || actions) && (
        <div className="form-section-header">
          <div>
            {title && <div className="form-section-title">{title}</div>}
            {description && <div className="form-section-description">{description}</div>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
