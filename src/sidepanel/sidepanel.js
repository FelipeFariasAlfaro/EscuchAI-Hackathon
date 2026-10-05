// Side panel principal: navegación, estado de grabación y wiring de la UI.
// Implementa `spec.md > Components` (Side Panel UI).

import { renderSettings } from "./settings.js";
import { renderAbout } from "./about.js";

/* ---------------- Modal helper ---------------- */
const modalBackdrop = document.getElementById("modalBackdrop");
const modalMessage = document.getElementById("modalMessage");
const modalOk = document.getElementById("modalOk");
const modalCancel = document.getElementById("modalCancel");

export function showModal(message, { confirm = false } = {}) {
  return new Promise((resolve) => {
    modalMessage.textContent = message;
    modalCancel.classList.toggle("hidden", !confirm);
    modalBackdrop.classList.remove("hidden");

    const cleanup = () => {
      modalBackdrop.classList.add("hidden");
      modalOk.removeEventListener("click", onOk);
      modalCancel.removeEventListener("click", onCancel);
    };
    const onOk = () => { cleanup(); resolve(true); };
    const onCancel = () => { cleanup(); resolve(false); };

    modalOk.addEventListener("click", onOk);
    modalCancel.addEventListener("click", onCancel);
  });
}

/* ---------------- Tab navigation ---------------- */
const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");

function activateTab(name) {
  tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  panels.forEach((p) => p.classList.toggle("active", p.dataset.panel === name));
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => activateTab(tab.dataset.tab));
});

/* ---------------- Sub-tab navigation (solo Transcripción activa) ---------------- */
const subtabs = document.querySelectorAll(".subtab");
subtabs.forEach((st) => {
  st.addEventListener("click", () => {
    if (st.classList.contains("disabled")) return;
    subtabs.forEach((s) => s.classList.toggle("active", s === st));
  });
});

/* ---------------- Record button (toggle visual; lógica real en slices 3-5) ---------------- */
const recBtn = document.getElementById("recBtn");
const recLabel = recBtn.querySelector(".rec-label");
let recording = false;

export function setRecordingUI(on) {
  recording = on;
  recBtn.classList.toggle("recording", on);
  recLabel.textContent = on ? "Grabando" : "Iniciar grabación";
}

// Handler placeholder; se reemplaza con la lógica de captura en slices posteriores.
recBtn.addEventListener("click", () => {
  if (window.__escuchaiRecordHandler) {
    window.__escuchaiRecordHandler(!recording);
  } else {
    setRecordingUI(!recording);
  }
});

/* ---------------- Render de las tabs con contenido dinámico ---------------- */
renderSettings(document.getElementById("settingsRoot"), { showModal }).catch((err) =>
  console.error("Error al renderizar Ajustes:", err)
);
renderAbout(document.getElementById("aboutRoot"));
