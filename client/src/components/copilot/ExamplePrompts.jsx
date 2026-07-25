const prompts = [
  'Why did this strategy lose money?',
  'Explain Sharpe Ratio',
  'Improve this EMA crossover strategy',
  'When should I avoid mean reversion strategies?',
];

export default function ExamplePrompts() {
  return (
    <section className="ai-example-prompts" aria-label="Example prompts">
      <p className="ai-ep-heading">Example prompts</p>
      <div className="ai-ep-list">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            className="ai-ep-chip"
            disabled
            title={prompt}
            aria-label={`Try: ${prompt}`}
          >
            {prompt}
          </button>
        ))}
      </div>
    </section>
  );
}
