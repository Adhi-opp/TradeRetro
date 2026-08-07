import { useCallback } from 'react';
import useAIStore from '../../store/useAIStore';
import { EXAMPLE_PROMPTS } from '../../services/promptTemplates';

export default function ExamplePrompts() {
  const setDraftPrompt = useAIStore((s) => s.setDraftPrompt);

  const handlePrompt = useCallback(
    (prompt) => {
      setDraftPrompt(prompt);
    },
    [setDraftPrompt],
  );

  return (
    <section className="ai-example-prompts" aria-label="Example prompts">
      <p className="ai-ep-heading">Example prompts</p>
      <div className="ai-ep-list">
        {EXAMPLE_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            className="ai-ep-chip"
            onClick={() => handlePrompt(prompt)}
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