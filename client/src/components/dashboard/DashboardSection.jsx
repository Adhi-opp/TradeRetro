/**
 * Reusable dashboard section wrapper.
 */
export default function DashboardSection({ children, className = '', ...props }) {
  return (
    <section className={className} {...props}>
      {children}
    </section>
  );
}
