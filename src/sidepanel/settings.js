// Ajustes de IA: flujo elegir proveedor -> key -> validar -> modelos -> elegir -> guardar.
// Implementa `prd.md > Configuración de IA (Ajustes)` y `spec.md > Components` (Settings / Storage).

import { getAiConfig, setAiConfig, isConfigured } from "../lib/storage.js";
import { validateAndListModels } from "../lib/gemini.js";
import { t, getUiLang } from "../lib/i18n.js";

export async function renderSettings(root, { showModal, onUiLangChange } = {}) {
  const existing = await getAiConfig();
  const soon = t("settings.soon");

  root.innerHTML = `
    <div class="field">
      <label for="uiLangSel">${t("settings.uiLang")}</label>
      <select id="uiLangSel">
        <option value="es">${t("lang.es")}</option>
        <option value="en">${t("lang.en")}</option>
      </select>
    </div>

    <div class="field">
      <label for="providerSel">${t("settings.provider")}</label>
      <select id="providerSel">
        <option value="gemini">Gemini (Google)</option>
        <option value="openai" disabled>OpenAI (${soon})</option>
        <option value="claude" disabled>Claude (${soon})</option>
        <option value="ollama" disabled>Ollama local (${soon})</option>
      </select>
    </div>

    <div class="field">
      <label for="apiKeyInput">${t("settings.apiKey")}</label>
      <div class="row">
        <input id="apiKeyInput" type="password" placeholder="${t("settings.apiKey.placeholder")}"
               value="${existing?.apiKey ? escapeHtml(existing.apiKey) : ""}" />
        <button id="validateBtn" class="btn-accent" style="flex:0 0 auto">${t("settings.validate")}</button>
      </div>
      <span id="validateStatus"></span>
    </div>

    <div class="field" id="modelField" style="${existing?.model ? "" : "display:none"}">
      <label for="modelSel">${t("settings.model")}</label>
      <select id="modelSel"></select>
    </div>

    <div class="row">
      <button id="saveBtn" class="btn-accent" ${existing?.model ? "" : "disabled"}>${t("settings.save")}</button>
    </div>
    <span id="saveStatus">${isConfigured(existing) ? `<span class="saved-badge">${t("settings.saved")}</span>` : ""}</span>
  `;

  const uiLangSel = root.querySelector("#uiLangSel");
  uiLangSel.value = getUiLang();
  uiLangSel.addEventListener("change", () => {
    if (onUiLangChange) onUiLangChange(uiLangSel.value);
  });

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
    validateStatus.textContent = t("settings.validating");
    validateStatus.className = "";
    saveBtn.disabled = true;

    const result = await validateAndListModels(key);
    if (!result.ok) {
      validateStatus.textContent = "";
      if (showModal) await showModal(t("settings.keyInvalid") + result.error);
      return;
    }

    validateStatus.textContent = t("settings.keyValid");
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
    saveStatus.innerHTML = `<span class="saved-badge">${t("settings.saved")}</span>`;
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}
