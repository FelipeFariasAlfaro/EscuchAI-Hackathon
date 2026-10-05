// Service worker (coordinador).
// Implementa `spec.md > Components` (Service Worker) y los pasos 2-3 de
// `spec.md > The Core Journey Through the System`.

chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((err) => console.warn("No se pudo configurar el side panel:", err));
  }
});

const OFFSCREEN_PATH = "src/offscreen/offscreen.html";

async function hasOffscreen() {
  if (chrome.runtime.getContexts) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
    });
    return contexts.length > 0;
  }
  return false;
}

async function ensureOffscreen() {
  if (await hasOffscreen()) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: ["USER_MEDIA"],
    justification: "Transcribir el audio de la pestaña con Whisper en local.",
  });
}

/* ---------------- Mensajes del side panel ---------------- */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.target !== "background") return;

  if (msg.type === "start-recording") {
    startRecording(msg.tabId).then(
      () => sendResponse({ ok: true }),
      (err) => sendResponse({ ok: false, error: err.message })
    );
    return true;
  }

  if (msg.type === "stop-recording") {
    stopRecording().then(() => sendResponse({ ok: true }));
    return true;
  }
});

async function startRecording(tabId) {
  // Obtener el id del stream de audio de la pestaña.
  const streamId = await new Promise((resolve, reject) => {
    chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (id) => {
      if (chrome.runtime.lastError || !id) {
        reject(new Error(chrome.runtime.lastError?.message || "No se pudo capturar la pestaña."));
      } else {
        resolve(id);
      }
    });
  });

  await ensureOffscreen();

  const resp = await chrome.runtime.sendMessage({
    target: "offscreen",
    type: "start-capture",
    streamId,
  });
  if (!resp || !resp.ok) {
    throw new Error(resp?.error || "El documento offscreen no pudo iniciar la captura.");
  }
}

async function stopRecording() {
  if (await hasOffscreen()) {
    await chrome.runtime.sendMessage({ target: "offscreen", type: "stop-capture" });
    await chrome.offscreen.closeDocument().catch(() => {});
  }
}
