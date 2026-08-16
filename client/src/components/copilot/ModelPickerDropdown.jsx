import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check, Cpu, Cloud } from 'lucide-react';
import { groupModels } from './modelGroups';

const DEFAULT_LABEL = 'Default: LM Studio — Qwen 2.5 Coder 1.5B';

/**
 * Small dependency-free, grouped model picker.
 *
 * Renders clean display names under structural provider groups (LM Studio /
 * Cloud). The dropdown is a real DOM surface so it can be opened, inspected,
 * and verified in the browser.
 */
export default function ModelPickerDropdown({ id, models, selectedModel, onSelect, disabled }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const groups = groupModels(models);
  const selected = models.find((m) => m.id === selectedModel) || null;

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="ai-model-picker" ref={rootRef}>
      <button
        type="button"
        id={id}
        className="ai-model-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select AI Model"
        disabled={disabled}
      >
        <span className="ai-model-trigger-label">{selected ? selected.display_name : DEFAULT_LABEL}</span>
        <ChevronDown size={15} className={`ai-model-trigger-chevron ${open ? 'is-open' : ''}`} />
      </button>

      {open && (
        <div className="ai-model-dropdown" role="listbox" aria-label="Select AI Model">
          {groups.map((group) => (
            <div className="ai-model-group" key={group.key}>
              <div className="ai-model-group-label" role="presentation">
                {group.key === 'local' ? <Cpu size={12} /> : <Cloud size={12} />}
                <span>{group.label}</span>
              </div>
              {group.models.map((m) => {
                const active = m.id === selectedModel;
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`ai-model-option ${active ? 'is-selected' : ''}`}
                    onClick={() => {
                      onSelect(m.id);
                      setOpen(false);
                    }}
                  >
                    <span className="ai-model-option-name">{m.display_name}</span>
                    {active && <Check size={14} className="ai-model-option-check" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
