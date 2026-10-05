// Wrapper mínimo sobre chrome.storage.local para la configuración de IA.
// Implementa `spec.md > Data Model` (aiConfig).

const AI_CONFIG_KEY = "aiConfig";

export async function getAiConfig() {
  const data = await chrome.storage.local.get(AI_CONFIG_KEY);
  return data[AI_CONFIG_KEY] || null;
}

export async function setAiConfig(config) {
  await chrome.storage.local.set({ [AI_CONFIG_KEY]: config });
}

export async function clearAiConfig() {
  await chrome.storage.local.remove(AI_CONFIG_KEY);
}

export function isConfigured(config) {
  return !!(config && config.provider && config.apiKey && config.model);
}
