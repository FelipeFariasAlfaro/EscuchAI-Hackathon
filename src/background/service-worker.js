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
  // El offscreen avisa que su listener ya está activo: ahora sí es seguro
  // enviarle la orden de captura guardada.
  if (msg.target === "background" && msg.type === "offscreen-ready") {
    if (pendingStart) {
      chrome.runtime.sendMessage(pendingStart).catch(() => {});
      pendingStart = null;
    }
    return;
  }

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

// Guarda la orden de inicio hasta que el offscreen avise que está listo.
let pendingStart = null;

async function startRecording(tabId, lang) {
  // Cerrar cualquier captura previa ANTES de pedir el stream: si un offscreen
  // anterior sigue agarrando el audio de la pestaña, getMediaStreamId falla con
  // "Cannot capture a tab with an active stream".
  if (await hasOffscreen()) {
    await chrome.runtime.sendMessage({ target: "offscreen", type: "stop-capture" }).catch(() => {});
    await chrome.offscreen.closeDocument().catch(() => {});
    // Dar un instante a Chrome para liberar el stream de la pestaña antes de
    // volver a pedirlo; si no, puede seguir marcándolo como ocupado.
    await new Promise((r) => setTimeout(r, 300));
  }

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

  // Handshake: el offscreen registra su listener al cargar y recién entonces
  // envía "offscreen-ready". Si mandamos start-capture antes, el mensaje se
  // pierde (el listener aún no existe) y la captura nunca arranca aunque el
  // modelo sí cargue. Guardamos la orden y la disparamos al recibir el ready.
  pendingStart = { target: "offscreen", type: "start-capture", streamId, lang: lang || "es" };
  await ensureOffscreen();

  // Pedir al content script de Meet que empiece a reportar quién habla.
  // Si Meet ya estaba abierto cuando se instaló/recargó la extensión, el content
  // script declarado en el manifest no existe todavía: lo inyectamos y reintentamos.
  if (tabId) await startSpeakerWatch(tabId);
}

async function startSpeakerWatch(tabId) {
  const message = { target: "content", type: "start-watch" };
  try {
    await chrome.tabs.sendMessage(tabId, message);
    return;
  } catch (firstError) {
    // Es normal justo después de recargar la extensión: los content scripts no
    // se insertan retroactivamente en pestañas que ya estaban abiertas.
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["src/content/meet-speaker.js"],
      });
      await chrome.tabs.sendMessage(tabId, message);
    } catch (injectError) {
      console.warn("[EscuchAI] No se pudo iniciar la detección del hablante:", injectError || firstError);
      chrome.runtime.sendMessage({
        target: "sidepanel",
        type: "speaker-status",
        text: "No se pudo leer quién habla en Meet; se usará Participante Indistinguible.",
      }).catch(() => {});
    }
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
