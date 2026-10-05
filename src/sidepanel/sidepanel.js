// Side panel principal: navegación, grabación, transcripción, pulido y chat.
// Implementa `spec.md > Components` (Side Panel UI).

import { renderSettings } from "./settings.js";
import { renderAbout } from "./about.js";
import { getAiConfig, isConfigured } from "../lib/storage.js";
import { polishTranscript, generateContent } from "../lib/gemini.js";
import { findEcho, dominantSpeaker, renderMiniMarkdown } from "../lib/transcript-utils.js";

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
const langSelect = document.getElementById("langSelect");
const chatInput = document.getElementById("chatInput");
const chatSend = document.getElementById("chatSend");

const MEET_RE = /^https:\/\/meet\.google\.com\//;
const MIC_PAGE = "src/permissions/mic-permission.html";
const MAX_SPEAKER_LOG = 500;
const MAX_RECENT = 12;
const MAX_POLISH_BACKLOG = 8;
const MAX_CHAT_CONTEXT_CHARS = 60000;
const MIC_SPEAKER = "Tú";
const UNKNOWN_SPEAKER = "Participante Indistinguible";

let recording = false;
let recordingTabId = null;
let aiConfig = null;
let lang = "es";

// Cada entrada: { speaker, text, ts, source, el, removed }
const transcript = [];
// Últimas líneas por canal, para detectar eco: { text, source, ts, entry }
let recent = [];
// Quién habló y desde cuándo (solo cambios): { name, ts }
let speakerLog = [];

function setRecordingUI(on) {
  recording = on;
  recBtn.classList.toggle("recording", on);
  recLabel.textContent = on ? "Grabando" : "Iniciar grabación";
  langSelect.disabled = on;
}

/* ---------------- Idioma de la reunión ---------------- */
async function initLang() {
  try {
    const data = await chrome.storage.local.get("lang");
    if (["es", "en", "auto"].includes(data.lang)) lang = data.lang;
  } catch (_) { /* se queda el valor por defecto */ }
  langSelect.value = lang;
}
langSelect.addEventListener("change", () => {
  lang = langSelect.value;
  chrome.storage.local.set({ lang }).catch(() => {});
});

/* ---------------- Mensajes desde offscreen y content script ---------------- */
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.target !== "sidepanel") return;
  if (msg.type === "status") {
    showStatusLine(msg.text);
  } else if (msg.type === "raw-chunk") {
    handleRawChunk(msg);
  } else if (msg.type === "speaker") {
    if (!msg.name) return;
    speakerLog.push({ name: msg.name, ts: Date.now() });
    if (speakerLog.length > MAX_SPEAKER_LOG) speakerLog.shift();
  } else if (msg.type === "latency") {
    console.log(`[EscuchAI] latencia ${msg.stage}: ${msg.ms} ms`);
  }
});

/* ---------------- Grabación ---------------- */
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// El micrófono es OPCIONAL: sirve solo para transcribir TU voz ("Tú"); la de los
// demás llega por el audio de la pestaña. Por eso NO bloquea la grabación. Si aún
// no está concedido, se ofrece abrir la pestaña de permiso una vez, pero la
// grabación arranca igual con el audio de la pestaña. Así nunca se queda atascado
// en un bucle de "pulsar Grabar -> reabrir pestaña de permiso".
async function maybeOfferMic() {
  let state = "prompt";
  try {
    state = (await navigator.permissions.query({ name: "microphone" })).state;
  } catch (_) {
    return;   // no se puede consultar: el offscreen intentará y degradará solo
  }
  if (state === "granted" || state === "denied") return;

  // Solo ofrecerlo una vez por instalación, sin frenar la grabación.
  const { micOffered } = await chrome.storage.local.get("micOffered").catch(() => ({}));
  if (micOffered) return;
  await chrome.storage.local.set({ micOffered: true }).catch(() => {});

  const open = await showModal(
    "Opcional: para transcribir también TU voz, EscuchAI necesita el micrófono. " +
    "Puedo abrir una pestaña para concederlo. La grabación empieza igual con el audio " +
    "de la reunión; sin micrófono solo no se transcribe tu propia voz.",
    { confirm: true }
  );
  if (open) await chrome.tabs.create({ url: chrome.runtime.getURL(MIC_PAGE) });
}

async function startRecording() {
  aiConfig = await getAiConfig();
  if (!isConfigured(aiConfig)) {
    await showModal("Primero debes configurar la IA en la tab Ajustes.");
    activateTab("ajustes");
    return;
  }

  // La pestaña de Meet se lee ANTES de abrir cualquier otra pestaña.
  const tab = await getActiveTab();
  if (!tab || !MEET_RE.test(tab.url || "")) {
    await showModal("La grabación solo está disponible en una reunión de Google Meet.");
    return;
  }

  // Estado limpio ANTES de arrancar: el content script reporta al primer
  // hablante en cuanto recibe start-watch, y ese mensaje puede llegar antes de
  // que la respuesta de start-recording vuelva aquí.
  speakerLog = [];
  recent = [];

  const resp = await chrome.runtime.sendMessage({
    target: "background",
    type: "start-recording",
    tabId: tab.id,
    lang,
  });
  if (!resp || !resp.ok) {
    const err = resp?.error || "error desconocido";
    if (/not been invoked|activeTab/i.test(err)) {
      await showModal(
        "Chrome necesita que actives EscuchAI sobre esta pestaña. " +
        "Haz clic en el icono de EscuchAI en la barra de extensiones (estando en la pestaña de Meet) " +
        "y vuelve a pulsar Iniciar grabación."
      );
    } else {
      await showModal(`No se pudo iniciar la grabación: ${err}`);
    }
    return;
  }

  // El texto de grabaciones anteriores se conserva en pantalla.
  if (transcript.length) addDivider("Nueva grabación");
  recordingTabId = tab.id;
  clearPlaceholder();
  setRecordingUI(true);
  showStatusLine("Grabando… la primera vez el modelo de transcripción puede tardar en descargarse.");

  // Ofrecer el micrófono SIN bloquear: la grabación ya está en marcha.
  maybeOfferMic().catch(() => {});
}

async function stopRecording() {
  await chrome.runtime.sendMessage({
    target: "background",
    type: "stop-recording",
    tabId: recordingTabId,
  }).catch(() => {});
  recordingTabId = null;
  setRecordingUI(false);
  showStatusLine("Grabación detenida.");
}

recBtn.addEventListener("click", () => {
  (recording ? stopRecording() : startRecording())
    .catch((err) => showModal(`Error: ${err.message}`));
});

/* ---------------- Render ---------------- */
function clearPlaceholder() {
  if (placeholder && placeholder.parentNode) placeholder.remove();
}

function scrollToEnd() {
  transcriptArea.scrollTop = transcriptArea.scrollHeight;
}

function showStatusLine(text) {
  clearPlaceholder();
  let el = document.getElementById("statusLine");
  if (!el) {
    el = document.createElement("p");
    el.id = "statusLine";
    el.className = "placeholder";
  }
  el.textContent = text;
  transcriptArea.appendChild(el);   // (re)colocar al final para que se vea
  scrollToEnd();
}

function addDivider(label) {
  const p = document.createElement("p");
  p.className = "placeholder";
  p.textContent = `— ${label} —`;
  transcriptArea.appendChild(p);
}

function createLineEl(speaker, text) {
  const lineEl = document.createElement("p");
  lineEl.className = "line polishing";
  if (speaker === UNKNOWN_SPEAKER) lineEl.classList.add("indistinguible");
  const sp = document.createElement("span");
  sp.className = "speaker";
  sp.textContent = `${speaker}:`;
  const body = document.createElement("span");
  body.className = "body";
  body.textContent = text;
  lineEl.append(sp, document.createTextNode(" "), body);
  return lineEl;
}

/* ---------------- Transcripción + pulido ---------------- */
function handleRawChunk(msg) {
  const text = String(msg.text || "").trim();
  if (!text || !recording) return;

  const source = msg.source === "mic" ? "mic" : "tab";
  const now = Date.now();
  const start = Number.isFinite(msg.start) ? msg.start : now - 5000;
  const end = Number.isFinite(msg.end) ? msg.end : now;

  // Eco: la voz de los demás llega por la pestaña (limpia) y también por el
  // micrófono (distorsionada). Nos quedamos con la copia de la pestaña.
  const echo = findEcho(recent, text, source, now);
  if (echo) {
    if (source === "mic") return;        // la copia nueva es el eco
    removeEntry(echo.entry);             // la vieja (mic) era el eco
  }

  const speaker = source === "mic"
    ? MIC_SPEAKER
    : dominantSpeaker(speakerLog, start, end) || UNKNOWN_SPEAKER;

  clearPlaceholder();
  const entry = { speaker, text, ts: msg.ts || now, source, el: createLineEl(speaker, text), removed: false };
  transcript.push(entry);
  recent.push({ text, source, ts: now, entry });
  if (recent.length > MAX_RECENT) recent.shift();
  transcriptArea.appendChild(entry.el);
  scrollToEnd();

  queuePolish(entry);
}

function removeEntry(entry) {
  entry.removed = true;
  entry.el.remove();
  const i = transcript.indexOf(entry);
  if (i >= 0) transcript.splice(i, 1);
  recent = recent.filter((r) => r.entry !== entry);
}

// El pulido va de uno en uno: respeta los límites de la API y permite pasar la
// línea anterior ya corregida como contexto (palabras partidas entre ventanas).
let polishChain = Promise.resolve();
let polishBacklog = 0;

function queuePolish(entry) {
  if (polishBacklog >= MAX_POLISH_BACKLOG) {
    entry.el.classList.remove("polishing");   // la API no da abasto: queda el crudo
    return;
  }
  polishBacklog++;
  polishChain = polishChain.then(() => polishEntry(entry)).finally(() => { polishBacklog--; });
}

async function polishEntry(entry) {
  if (entry.removed) return;
  const idx = transcript.indexOf(entry);
  const previous = idx > 0 ? transcript[idx - 1].text : "";
  const t0 = performance.now();
  try {
    const res = await polishTranscript(aiConfig.apiKey, aiConfig.model, entry.text, { lang, previous });
    console.log(`[EscuchAI] pulido en ${Math.round(performance.now() - t0)} ms (ok=${res.ok})`);
    if (entry.removed) return;
    // Si falla, se queda el texto crudo (failure mode del spec).
    entry.text = res.text;
    entry.el.querySelector(".body").textContent = res.text;
  } catch (err) {
    console.warn("[EscuchAI] pulido:", err);
  } finally {
    entry.el.classList.remove("polishing");
  }
}

// Exponer la transcripción (chat y futuras funciones).
export function getTranscript() { return transcript; }

/* ---------------- Chat con la IA (slice 5) ---------------- */
const chatHistory = [];   // { role: "user" | "model", text }
let chatBusy = false;

function addChatMsg(role, text, extraClass = "") {
  clearPlaceholder();
  const el = document.createElement("div");
  el.className = `chat-msg ${role} ${extraClass}`.trim();
  if (role === "model" && !extraClass) renderMiniMarkdown(el, text);
  else el.textContent = text;
  transcriptArea.appendChild(el);
  scrollToEnd();
  return el;
}

function buildChatSystem() {
  let body = transcript.map((e) => `${e.speaker}: ${e.text}`).join("\n");
  if (body.length > MAX_CHAT_CONTEXT_CHARS) {
    body = "[…transcripción recortada al final…]\n" + body.slice(-MAX_CHAT_CONTEXT_CHARS);
  }
  return (
    "Eres el asistente de EscuchAI. Respondes preguntas sobre una reunión usando SOLO la " +
    "transcripción de abajo. Si la respuesta no está en ella, dilo claramente; no inventes. " +
    "La transcripción es automática y puede tener errores de reconocimiento. " +
    "Responde en el idioma de la pregunta, de forma breve. Puedes usar listas con guiones y **negrita**.\n\n" +
    `TRANSCRIPCIÓN:\n${body}`
  );
}

async function sendChat() {
  const question = chatInput.value.trim();
  if (!question || chatBusy) return;

  const cfg = await getAiConfig();
  if (!isConfigured(cfg)) {
    await showModal("Primero debes configurar la IA en la tab Ajustes.");
    activateTab("ajustes");
    return;
  }
  const tab = await getActiveTab();
  if (!tab || !MEET_RE.test(tab.url || "")) {
    await showModal("El chat solo está disponible en una reunión de Google Meet.");
    return;
  }

  chatInput.value = "";
  addChatMsg("user", question);

  if (!transcript.length) {
    addChatMsg("model", "Aún no hay nada transcrito. Inicia la grabación y pregúntame cuando haya conversación.");
    return;
  }

  chatBusy = true;
  chatSend.disabled = true;
  chatHistory.push({ role: "user", text: question });
  const bubble = addChatMsg("model", "Pensando…", "pending");
  try {
    const res = await generateContent(cfg.apiKey, cfg.model, chatHistory, buildChatSystem());
    if (res.ok && res.text) {
      chatHistory.push({ role: "model", text: res.text });
      bubble.className = "chat-msg model";
      renderMiniMarkdown(bubble, res.text);
    } else {
      chatHistory.pop();   // la pregunta no obtuvo respuesta: no contamina el historial
      bubble.className = "chat-msg model error";
      bubble.textContent = `No se pudo obtener respuesta: ${res.error || "respuesta vacía"}`;
    }
  } catch (err) {
    chatHistory.pop();
    bubble.className = "chat-msg model error";
    bubble.textContent = `No se pudo obtener respuesta: ${err.message}`;
  } finally {
    chatBusy = false;
    chatSend.disabled = false;
    scrollToEnd();
  }
}

chatSend.addEventListener("click", () => {
  sendChat().catch((err) => showModal(`Error: ${err.message}`));
});
chatInput.addEventListener("keydown", (ev) => {
  if (ev.key === "Enter" && !ev.shiftKey && !ev.isComposing) {
    ev.preventDefault();
    sendChat().catch((err) => showModal(`Error: ${err.message}`));
  }
});

/* ---------------- Render de tabs dinámicas ---------------- */
initLang();
renderSettings(document.getElementById("settingsRoot"), { showModal }).catch((err) =>
  console.error("Error al renderizar Ajustes:", err)
);
renderAbout(document.getElementById("aboutRoot"));
