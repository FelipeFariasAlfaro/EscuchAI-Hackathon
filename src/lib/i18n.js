// i18n de la interfaz: idioma completo de la app (es | en), elegido al primer
// uso y persistido en chrome.storage.local bajo "uiLang". No confundir con el
// idioma de la reunión ("lang"), que afecta a Whisper y al pulido de la IA.

const STRINGS = {
  es: {
    // Tabs
    "tab.reunion": "Reunión",
    "tab.historial": "Historial",
    "tab.ajustes": "Ajustes",
    "tab.sobre": "Sobre",
    // Cabecera
    "app.minimize": "Minimizar",
    // Reunión
    "rec.start": "Iniciar grabación",
    "rec.recording": "Grabando",
    "lang.meeting": "Idioma de la reunión",
    "lang.es": "Español",
    "lang.en": "English",
    "lang.auto": "Auto",
    "subtab.transcripcion": "Transcripción",
    "subtab.tareas": "Tareas",
    "subtab.conflictos": "Conflictos",
    "subtab.participacion": "Participación",
    "subtab.alertas": "Alertas",
    "subtab.soon": "Próximamente",
    "transcript.placeholder": "La transcripción aparecerá aquí al iniciar la grabación.",
    "action.summarize": "Resumir",
    "action.summarize.title": "Resumir la reunión con la IA",
    "action.copy": "Copiar",
    "action.copy.title": "Copiar la transcripción",
    "action.copied": "Copiado",
    "action.txt": "TXT",
    "action.txt.title": "Exportar como TXT",
    "action.md": "MD",
    "action.md.title": "Exportar como Markdown",
    "chat.placeholder": "Pregunta a la IA, ej: resume lo que dijo Pepito sobre el sistema X",
    "chat.send": "Enviar",
    // Historial
    "history.title": "Historial de grabaciones.",
    "history.soon": "Próximamente.",
    // Modal
    "modal.cancel": "Cancelar",
    "modal.ok": "Entendido",
    // Selección de idioma (primer uso)
    "setup.title": "Elige el idioma de EscuchAI",
    "setup.subtitle": "Puedes cambiarlo luego en Ajustes.",
    "setup.continue": "Continuar",
    // Ajustes
    "settings.uiLang": "Idioma de la aplicación",
    "settings.provider": "Proveedor de IA",
    "settings.apiKey": "API key",
    "settings.apiKey.placeholder": "Pega tu API key de Gemini",
    "settings.validate": "Validar",
    "settings.validating": "Validando…",
    "settings.keyValid": "Key válida.",
    "settings.keyInvalid": "API key inválida: ",
    "settings.model": "Modelo",
    "settings.save": "Guardar",
    "settings.saved": "Configuración guardada.",
    "settings.soon": "próximamente",
    // Sobre
    "about.devBy": "Software desarrollado por ",
    "about.oss": "Este es un proyecto de código abierto",
    // Estados / mensajes
    "status.recording": "Grabando… la primera vez el modelo de transcripción puede tardar en descargarse.",
    "status.stopped": "Grabación detenida.",
    "status.newRecording": "Nueva grabación",
    "chat.thinking": "Pensando…",
    "chat.summarizing": "Resumiendo…",
    "chat.noTranscriptYet": "Aún no hay nada transcrito. Inicia la grabación y pregúntame cuando haya conversación.",
    "chat.noResponse": "No se pudo obtener respuesta: ",
    "chat.emptyResponse": "respuesta vacía",
    "summary.failed": "No se pudo resumir: ",
    "err.configFirst": "Primero debes configurar la IA en la tab Ajustes.",
    "err.onlyMeetRec": "La grabación solo está disponible en una reunión de Google Meet.",
    "err.onlyMeetChat": "El chat solo está disponible en una reunión de Google Meet.",
    "err.noTranscript": "Aún no hay nada transcrito. Inicia la grabación primero.",
    "err.startFailed": "No se pudo iniciar la grabación: ",
    "err.copyFailed": "No se pudo copiar: ",
    "err.generic": "Error: ",
    "err.notInvoked":
      "Chrome necesita que actives EscuchAI sobre esta pestaña. Haz clic en el icono de EscuchAI en la barra de extensiones (estando en la pestaña de Meet) y vuelve a pulsar Iniciar grabación.",
    "mic.offer":
      "Opcional: para transcribir también TU voz, EscuchAI necesita el micrófono. Puedo abrir una pestaña para concederlo. La grabación empieza igual con el audio de la reunión; sin micrófono solo no se transcribe tu propia voz.",
    "speaker.unknown": "Participante Indistinguible",
  },
  en: {
    "tab.reunion": "Meeting",
    "tab.historial": "History",
    "tab.ajustes": "Settings",
    "tab.sobre": "About",
    "app.minimize": "Minimize",
    "rec.start": "Start recording",
    "rec.recording": "Recording",
    "lang.meeting": "Meeting language",
    "lang.es": "Spanish",
    "lang.en": "English",
    "lang.auto": "Auto",
    "subtab.transcripcion": "Transcript",
    "subtab.tareas": "Tasks",
    "subtab.conflictos": "Conflicts",
    "subtab.participacion": "Participation",
    "subtab.alertas": "Alerts",
    "subtab.soon": "Coming soon",
    "transcript.placeholder": "The transcript will appear here once you start recording.",
    "action.summarize": "Summarize",
    "action.summarize.title": "Summarize the meeting with AI",
    "action.copy": "Copy",
    "action.copy.title": "Copy the transcript",
    "action.copied": "Copied",
    "action.txt": "TXT",
    "action.txt.title": "Export as TXT",
    "action.md": "MD",
    "action.md.title": "Export as Markdown",
    "chat.placeholder": "Ask the AI, e.g. summarize what Pepito said about system X",
    "chat.send": "Send",
    "history.title": "Recording history.",
    "history.soon": "Coming soon.",
    "modal.cancel": "Cancel",
    "modal.ok": "Got it",
    "setup.title": "Choose EscuchAI's language",
    "setup.subtitle": "You can change it later in Settings.",
    "setup.continue": "Continue",
    "settings.uiLang": "App language",
    "settings.provider": "AI provider",
    "settings.apiKey": "API key",
    "settings.apiKey.placeholder": "Paste your Gemini API key",
    "settings.validate": "Validate",
    "settings.validating": "Validating…",
    "settings.keyValid": "Valid key.",
    "settings.keyInvalid": "Invalid API key: ",
    "settings.model": "Model",
    "settings.save": "Save",
    "settings.saved": "Settings saved.",
    "settings.soon": "coming soon",
    "about.devBy": "Software developed by ",
    "about.oss": "This is an open source project",
    "status.recording": "Recording… the first time, the transcription model may take a while to download.",
    "status.stopped": "Recording stopped.",
    "status.newRecording": "New recording",
    "chat.thinking": "Thinking…",
    "chat.summarizing": "Summarizing…",
    "chat.noTranscriptYet": "Nothing has been transcribed yet. Start recording and ask me once there's some conversation.",
    "chat.noResponse": "Couldn't get a response: ",
    "chat.emptyResponse": "empty response",
    "summary.failed": "Couldn't summarize: ",
    "err.configFirst": "You must configure the AI in the Settings tab first.",
    "err.onlyMeetRec": "Recording is only available in a Google Meet meeting.",
    "err.onlyMeetChat": "Chat is only available in a Google Meet meeting.",
    "err.noTranscript": "Nothing has been transcribed yet. Start recording first.",
    "err.startFailed": "Couldn't start recording: ",
    "err.copyFailed": "Couldn't copy: ",
    "err.generic": "Error: ",
    "err.notInvoked":
      "Chrome needs you to activate EscuchAI on this tab. Click the EscuchAI icon in the extensions bar (while on the Meet tab) and press Start recording again.",
    "mic.offer":
      "Optional: to also transcribe YOUR voice, EscuchAI needs the microphone. I can open a tab to grant it. Recording starts anyway with the meeting audio; without the microphone, only your own voice won't be transcribed.",
    "speaker.unknown": "Unrecognized participant",
  },
};

let current = "es";

export function getUiLang() {
  return current;
}

export function t(key) {
  return (STRINGS[current] && STRINGS[current][key]) || STRINGS.es[key] || key;
}

/** Carga el idioma guardado. Devuelve el código o null si nunca se eligió. */
export async function loadUiLang() {
  try {
    const { uiLang } = await chrome.storage.local.get("uiLang");
    if (uiLang === "es" || uiLang === "en") { current = uiLang; return uiLang; }
  } catch (_) { /* queda el por defecto */ }
  return null;
}

export async function setUiLang(lang) {
  current = lang === "en" ? "en" : "es";
  try { await chrome.storage.local.set({ uiLang: current }); } catch (_) { /* no crítico */ }
}

/** Traduce todos los nodos con data-i18n / data-i18n-title / data-i18n-placeholder. */
export function applyStaticTranslations(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll("[data-i18n-title]").forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  document.documentElement.lang = current;
}
