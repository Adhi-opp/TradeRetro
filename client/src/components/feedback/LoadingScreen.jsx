/**
 * Reusable loading screen wrapper.
 */
export default function LoadingScreen({ children, className = '', ...props }) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}
