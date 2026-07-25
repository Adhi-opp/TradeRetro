const actions = [
  { label: 'Explain Strategy', description: 'Get a plain-English breakdown of any strategy' },
  { label: 'Generate Backtest Summary', description: 'Summarize the latest backtest results' },
  { label: 'Explain Metrics', description: 'Understand what each metric means' },
  { label: 'Improve Strategy', description: 'Suggest optimizations for your strategy' },
];

export default function QuickActions() {
  return (
    <section className="ai-quick-actions" aria-label="Quick actions">
      <div className="ai-qa-grid">
        {actions.map(({ label, description }) => (
          <button
            key={label}
            className="ai-qa-card"
            disabled
            title={description}
            aria-label={description}
          >
            <span className="ai-qa-label">{label}</span>
            <span className="ai-qa-desc">{description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
