/**
 * Model grouping helpers for the AI Copilot UI.
 *
 * Providers are represented structurally (LOCAL vs CLOUD) while keeping
 * the raw backend provider identifiers (e.g. "openai-compatible") internal.
 * These strings must never surface in user-facing labels.
 */

export function isLocalModel(model) {
  return !!(
    model &&
    (model.local === true ||
      model.provider === 'openai-compatible' ||
      model.provider === 'ollama' ||
      model.provider === 'mock')
  );
}

export function groupModels(models = []) {
  const local = models.filter(isLocalModel);
  const cloud = models.filter((m) => !isLocalModel(m));
  const groups = [];
  if (local.length) groups.push({ key: 'local', label: 'LOCAL', models: local });
  if (cloud.length) groups.push({ key: 'cloud', label: 'CLOUD', models: cloud });
  return groups;
}
