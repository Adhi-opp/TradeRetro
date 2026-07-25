export default function LoadingIndicator() {
  return (
    <div className="ai-loading-indicator" role="status" aria-label="AI is thinking">
      <span className="ai-loading-label">Thinking</span>
      <div className="ai-loading-dots" aria-hidden="true">
        <span className="ai-loading-dot" />
        <span className="ai-loading-dot" />
        <span className="ai-loading-dot" />
      </div>
    </div>
  );
}
