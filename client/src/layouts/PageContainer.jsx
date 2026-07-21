/**
 * Generic page content container.
 *
 * The `as` prop allows callers to preserve existing DOM tags and class names
 * while still using a shared layout primitive.
 */
export default function PageContainer({
  as: Component = 'div',
  children,
  className = '',
  ...props
}) {
  return (
    <Component className={className} {...props}>
      {children}
    </Component>
  );
}
