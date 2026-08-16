import useAIStore from '../../store/useAIStore';
import ModelPickerDropdown from './ModelPickerDropdown';

/**
 * Standalone model picker surface.
 *
 * Kept as a thin wrapper over the shared grouped dropdown for any future
 * surface that needs model selection. Custom API key configuration lives in
 * the Copilot Settings dialog only.
 */
export default function ModelSelector() {
  const models = useAIStore((s) => s.models);
  const selectedModel = useAIStore((s) => s.selectedModel);
  const setSelectedModel = useAIStore((s) => s.setSelectedModel);

  const handleChange = (modelId) => {
    setSelectedModel(modelId || null);
  };

  return (
    <div className="ai-config-card">
      <div className="ai-config-field">
        <label className="ai-config-label">AI MODEL</label>
        <ModelPickerDropdown
          models={models}
          selectedModel={selectedModel}
          onSelect={handleChange}
          disabled={models.length === 0}
        />
      </div>
    </div>
  );
}
