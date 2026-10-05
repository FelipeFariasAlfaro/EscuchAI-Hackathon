// Ajustes de IA: flujo elegir proveedor -> key -> validar -> modelos -> elegir -> guardar.
// Implementa `prd.md > Configuración de IA (Ajustes)` y `spec.md > Components` (Settings / Storage).

import { getAiConfig, setAiConfig, isConfigured } from "../lib/storage.js";
import { validateAndListModels } from "../lib/gemini.js";

export async function renderSettings(root, { showModal } = {}) {
  const existing = await getAiConfig();

  root.innerHTML = `
    <div class="field">
      <label for="providerSel">Proveedor de IA</label>
      <select id="providerSel">
        <option value="gemini">Gemini (Google)</option>
        <option value="openai" disabled>OpenAI (próximamente)</option>
        <option value="claude" disabled>Claude (próximamente)</option>
        <option value="ollama" disabled>Ollama local (próximamente)</option>
      </select>
    </div>

    <div class="field">
      <label for="apiKeyInput">API key</label>
      <div class="row">
        <input id="apiKeyInput" type="password" placeholder="Pega tu API key de Gemini"
               value="${existing?.apiKey ? escapeHtml(existing.apiKey) : ""}" />
        <button id="validateBtn" class="btn-accent" style="flex:0 0 auto">Validar</button>
      </div>
      <span id="validateStatus"></span>
    </div>

    <div class="field" id="modelField" style="${existing?.model ? "" : "display:none"}">
      <label for="modelSel">Modelo</label>
      <select id="modelSel"></select>
    </div>

    <div class="row">
      <button id="saveBtn" class="btn-accent" ${existing?.model ? "" : "disabled"}>Guardar</button>
    </div>
    <span id="saveStatus">${isConfigured(existing) ? '<span class="saved-badge">Configuración guardada.</span>' : ""}</span>
  `;

  const providerSel = root.querySelector("#providerSel");
  const apiKeyInput = root.querySelector("#apiKeyInput");
  const validateBtn = root.querySelector("#validateBtn");
  const validateStatus = root.querySelector("#validateStatus");
  const modelField = root.querySelector("#modelField");
  const modelSel = root.querySelector("#modelSel");
  const saveBtn = root.querySelector("#saveBtn");
  const saveStatus = root.querySelector("#saveStatus");

  if (existing?.provider) providerSel.value = existing.provider;

  // Si ya había modelo guardado, mostrarlo como única opción inicial hasta re-validar.
  if (existing?.model) {
    modelSel.innerHTML = `<option value="${escapeHtml(existing.model)}">${escapeHtml(existing.model)}</option>`;
    modelField.style.display = "";
  }

  validateBtn.addEventListener("click", async () => {
    const key = apiKeyInput.value.trim();
    validateStatus.textContent = "Validando…";
    validateStatus.className = "";
    saveBtn.disabled = true;

    const result = await validateAndListModels(key);
    if (!result.ok) {
      validateStatus.textContent = "";
      if (showModal) await showModal(`API key inválida: ${result.error}`);
      return;
    }

    validateStatus.textContent = "Key válida.";
    validateStatus.className = "status-ok";
    modelSel.innerHTML = result.models
      .map((m) => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.displayName)}</option>`)
      .join("");
    // Preseleccionar el modelo previo si sigue disponible.
    if (existing?.model && result.models.some((m) => m.id === existing.model)) {
      modelSel.value = existing.model;
    }
    modelField.style.display = "";
    saveBtn.disabled = false;
  });

  saveBtn.addEventListener("click", async () => {
    const config = {
      provider: providerSel.value,
      apiKey: apiKeyInput.value.trim(),
      model: modelSel.value,
    };
    await setAiConfig(config);
    saveStatus.innerHTML = '<span class="saved-badge">Configuración guardada.</span>';
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}
