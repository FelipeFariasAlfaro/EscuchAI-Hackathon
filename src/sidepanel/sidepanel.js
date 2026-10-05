// Side panel principal: navegación, grabación, transcripción y pulido.
// Implementa `spec.md > Components` (Side Panel UI).

import { renderSettings } from "./settings.js";
import { renderAbout } from "./about.js";
import { getAiConfig, isConfigured } from "../lib/storage.js";
import { polishTranscript } from "../lib/gemini.js";

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
tabs.forEach((tab) => tab.addEventListener("click", () => activateTab(tab.dataset.tab)));

const subtabs = document.querySelectorAll(".subtab");
subtabs.forEach((st) => st.addEventListener("click", () => {
  if (st.classList.contains("disabled")) return;
  subtabs.forEach((s) => s.classList.toggle("active", s === st));
}));

/* ---------------- Estado ---------------- */
const transcriptArea = document.getElementById("transcriptArea");
const placeholder = document.getElementById("transcriptPlaceholder");
const recBtn = document.getElementById("recBtn");
const recLabel = recBtn.querySelector(".rec-label");

let recording = false;
let aiConfig = null;
const transcript = [];   // { speaker, text, ts }

function setRecordingUI(on) {
  recording = on;
  recBtn.classList.toggle("recording", on);
  recLabel.textContent = on ? "Grabando" : "Iniciar grabación";
}

/* ---------------- Hablante actual (lo setea el content script en slice 4) ---------------- */
let currentSpeaker = null;
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.target !== "sidepanel") return;
  if (msg.type === "status") {
    showStatusLine(msg.text);
  } else if (msg.type === "raw-chunk") {
    handleRawChunk(msg.text, msg.ts);
  } else if (msg.type === "speaker") {
    currentSpeaker = msg.name || null;
  } else if (msg.type === "latency") {
    console.log(`[EscuchAI] latencia ${msg.stage}: ${msg.ms} ms`);
  }
});

/* ---------------- Grabación ---------------- */
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function toggleRecording() {
  if (recording) {
    await chrome.runtime.sendMessage({ target: "background", type: "stop-recording" });
    setRecordingUI(false);
    showStatusLine("Grabación detenida.");
    return;
  }

  aiConfig = await getAiConfig();
  if (!isConfigured(aiConfig)) {
    await showModal("Primero debes configurar la IA en la tab Ajustes.");
    activateTab("ajustes");
    return;
  }

  const tab = await getActiveTab();
  if (!tab || !/^https:\/\/meet\.google\.com\//.test(tab.url || "")) {
    await showModal("La grabación solo está disponible en una reunión de Google Meet.");
    return;
  }

  const resp = await chrome.runtime.sendMessage({
    target: "background",
    type: "start-recording",
    tabId: tab.id,
  });
  if (!resp || !resp.ok) {
    await showModal(`No se pudo iniciar la grabación: ${resp?.error || "error desconocido"}`);
    return;
  }
  clearPlaceholder();
  setRecordingUI(true);
}

recBtn.addEventListener("click", () => {
  toggleRecording().catch((err) => showModal(`Error: ${err.message}`));
});

/* ---------------- Transcripción + pulido ---------------- */
function clearPlaceholder() {
  if (placeholder && placeholder.parentNode) placeholder.remove();
}

function showStatusLine(text) {
  clearPlaceholder();
  let el = document.getElementById("statusLine");
  if (!el) {
    el = document.createElement("p");
    el.id = "statusLine";
    el.className = "placeholder";
    transcriptArea.appendChild(el);
  }
  el.textContent = text;
}

async function handleRawChunk(rawText, ts) {
  clearPlaceholder();
  const speaker = currentSpeaker || "Participante Indistinguible";

  // Línea provisional mientras Gemini pule.
  const lineEl = document.createElement("p");
  lineEl.className = "line polishing";
  const indist = speaker === "Participante Indistinguible";
  if (indist) lineEl.classList.add("indistinguible");
  lineEl.innerHTML = `<span class="speaker"></span> <span class="body"></span>`;
  lineEl.querySelector(".speaker").textContent = `${speaker}:`;
  lineEl.querySelector(".body").textContent = rawText;
  transcriptArea.appendChild(lineEl);
  transcriptArea.scrollTop = transcriptArea.scrollHeight;

  // Pulir con Gemini; si falla, se queda el texto crudo (failure mode del spec).
  const t0 = performance.now();
  const polished = await polishTranscript(aiConfig.apiKey, aiConfig.model, rawText);
  const elapsed = Math.round(performance.now() - t0);
  console.log(`[EscuchAI] pulido Gemini en ${elapsed} ms`);

  lineEl.classList.remove("polishing");
  lineEl.querySelector(".body").textContent = polished.text;
  transcript.push({ speaker, text: polished.text, ts });
  transcriptArea.scrollTop = transcriptArea.scrollHeight;
}

// Exponer la transcripción para el chat (slice 5).
export function getTranscript() { return transcript; }

/* ---------------- Render de tabs dinámicas ---------------- */
renderSettings(document.getElementById("settingsRoot"), { showModal }).catch((err) =>
  console.error("Error al renderizar Ajustes:", err)
);
renderAbout(document.getElementById("aboutRoot"));
