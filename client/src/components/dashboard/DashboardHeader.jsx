/**
 * Reusable dashboard header wrapper.
 */
export default function DashboardHeader({ children, className = 'panel-title-row' }) {
  return <div className={className}>{children}</div>;
}
