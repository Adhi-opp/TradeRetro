/**
 * Reusable full-state error wrapper.
 */
export default function ErrorScreen({ icon, title, description, className = '', titleClassName = '', descriptionClassName = '', ...props }) {
  return (
    <div className={className} {...props}>
      {icon}
      {title && <p className={titleClassName}>{title}</p>}
      {description && <p className={descriptionClassName}>{description}</p>}
    </div>
  );
}
