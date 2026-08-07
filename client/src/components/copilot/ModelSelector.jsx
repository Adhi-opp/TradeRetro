import { ChevronDown } from 'lucide-react';
import useAIStore from '../../store/useAIStore';

export default function ModelSelector() {
  const models = useAIStore((s) => s.models);
  const selectedModel = useAIStore((s) => s.selectedModel);
  const setSelectedModel = useAIStore((s) => s.setSelectedModel);

  const hasModels = models.length > 0;

  const handleChange = (e) => {
    setSelectedModel(e.target.value || null);
  };

  return (
    <label className="ai-model-selector">
      <span className="ai-model-selector-label">AI Model</span>
      <div className="ai-select-wrap">
        <select
          className="ai-model-select"
          value={selectedModel || ''}
          onChange={handleChange}
          disabled={!hasModels}
          aria-label="Select AI model"
        >
          <option value="">Default model</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.display_name}
            </option>
          ))}
        </select>
        <ChevronDown size={14} className="ai-select-chevron" aria-hidden="true" />
      </div>
    </label>
  );
}