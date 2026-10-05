// Service worker (coordinador).
// Implementa `spec.md > Components` (Service Worker) y los pasos 2-3 de
// `spec.md > The Core Journey Through the System`.

/* ---------------- Icono: abre el panel y habilita la captura ----------------
   NO se usa openPanelOnActionClick: con ese ajuste Chrome abre el panel por su
   cuenta, `action.onClicked` no se dispara y la pestaña nunca queda "invocada",
   así que tabCapture falla con "Extension has not been invoked".
   Abriendo el panel a mano desde onClicked se consiguen las dos cosas.
   sidePanel.open() exige el gesto del usuario, que se pierde con cualquier
   `await`: por eso se llama primero y de forma síncrona. */
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: false }).catch(() => {});
});
chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: false }).catch(() => {});

chrome.action.onClicked.addListener((tab) => {
  if (tab?.windowId != null) {
    chrome.sidePanel.open({ windowId: tab.windowId }).catch((err) => {
      console.warn("[EscuchAI] No se pudo abrir el side panel:", err);
    });
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
  // Siempre partir de un documento limpio: uno con estado residual (modelo a
  // medio cargar, streams colgados) da fallos difíciles de explicar.
  if (await hasOffscreen()) {
    await chrome.offscreen.closeDocument().catch(() => {});
  }
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
    startRecording(msg.tabId, msg.lang).then(
      () => sendResponse({ ok: true }),
      (err) => sendResponse({ ok: false, error: err.message })
    );
    return true;
  }

  if (msg.type === "stop-recording") {
    stopRecording(msg.tabId).then(() => sendResponse({ ok: true }));
    return true;
  }
});

async function startRecording(tabId, lang) {
  // El streamId caduca en pocos segundos: se pide justo antes de consumirlo.
  const streamId = await new Promise((resolve, reject) => {
    const opts = tabId ? { targetTabId: tabId } : {};
    chrome.tabCapture.getMediaStreamId(opts, (id) => {
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
    lang: lang || "es",
  });
  if (!resp || !resp.ok) {
    await stopRecording(tabId);
    throw new Error(resp?.error || "El documento offscreen no pudo iniciar la captura.");
  }

  // Pedir al content script de Meet que empiece a reportar quién habla.
  if (tabId) {
    chrome.tabs.sendMessage(tabId, { target: "content", type: "start-watch" }).catch(() => {
      // Sin content script (p. ej. la pestaña estaba abierta antes de instalar):
      // la transcripción sigue, solo no habrá nombres.
    });
  }
}

async function stopRecording(tabId) {
  if (tabId) {
    chrome.tabs.sendMessage(tabId, { target: "content", type: "stop-watch" }).catch(() => {});
  }
  if (await hasOffscreen()) {
    await chrome.runtime.sendMessage({ target: "offscreen", type: "stop-capture" }).catch(() => {});
    await chrome.offscreen.closeDocument().catch(() => {});
  }
}
