// Offscreen document: captura el audio de la reunión y lo transcribe con Whisper
// (transformers.js, WebAssembly, 100% local).
// Implementa `spec.md > Components` (Offscreen Document) y los pasos 3-4 de
// `spec.md > The Core Journey Through the System`.
//
// Decisiones que vienen de haber probado esto antes (ver devpost/checklist.md >
// Revisions):
//  - MediaRecorder graba DIRECTO del MediaStream de tabCapture. Grabar desde un
//    MediaStreamAudioDestinationNode o con ScriptProcessor entrega audio vacío.
//  - El AudioContext se usa SOLO para devolver el audio a los parlantes:
//    tabCapture silencia la pestaña por defecto.
//  - Pestaña y micrófono se graban por separado: lo que suena en la reunión son
//    los demás; lo que entra por el micrófono eres tú (tu voz no viaja por el
//    audio de la pestaña).
//  - El WASM de ONNX va en vendor/ y se fija con wasmPaths: la CSP de MV3 bloquea
//    scripts remotos, así que el valor por defecto (CDN) no carga.
//  - La captura se abre ANTES de cargar el modelo: el streamId caduca en segundos
//    y la primera descarga del modelo puede tardar minutos.

import { pipeline, env } from "../../vendor/transformers.min.js";

env.allowRemoteModels = true;   // el modelo se descarga la 1ª vez y queda en caché
env.allowLocalModels = false;
env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL("vendor/");
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.proxy = false;

const MODEL_ID = "Xenova/whisper-base";   // plan B registrado: whisper-tiny si la latencia es alta
const SAMPLE_RATE = 16000;                // Whisper espera 16 kHz
const WINDOW_MS = 5000;                   // ventana de audio por transcripción
const MIN_BLOB_BYTES = 2500;              // por debajo: la ventana no trae señal
const SILENCE_RMS = 0.006;                // por debajo: silencio, no se transcribe
const MAX_QUEUE = 4;                      // si el equipo no da abasto, se descarta lo más viejo

let transcriber = null;
let modelLoading = null;
let running = false;
let lang = "es";                          // "es" | "en" | "auto"
let tabStream = null;
let micStream = null;
let playbackCtx = null;
let busy = false;                         // Whisper atiende una ventana a la vez
let queue = [];                           // [{ blob, source, start, end }]

/* ---------------- Mensajería ---------------- */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.target !== "offscreen") return;
  if (msg.type === "start-capture") {
    startCapture(msg.streamId, msg.lang).then(
      () => sendResponse({ ok: true }),
      (err) => {
        // El SW ya no espera esta respuesta (handshake asíncrono): avisar al
        // panel para que el error sea visible.
        sendStatus(`No se pudo iniciar la captura: ${err.message}`);
        sendResponse({ ok: false, error: err.message });
      }
    );
    return true; // respuesta asíncrona
  }
  if (msg.type === "stop-capture") {
    stopCapture();
    sendResponse({ ok: true });
  }
});

// Avisar al service worker de que el listener ya está activo. El SW espera este
// mensaje antes de enviar start-capture (si no, el mensaje se perdería).
chrome.runtime.sendMessage({ target: "background", type: "offscreen-ready" }).catch(() => {});

function sendStatus(text) {
  chrome.runtime.sendMessage({ target: "sidepanel", type: "status", text });
}

/* ---------------- Modelo ---------------- */
function ensureModel() {
  if (transcriber) return Promise.resolve();
  if (modelLoading) return modelLoading;
  sendStatus("Cargando modelo de transcripción… (puede tardar la primera vez)");
  modelLoading = pipeline("automatic-speech-recognition", MODEL_ID, {
    dtype: "q8",
    progress_callback: (p) => {
      if (p?.status === "progress" && p?.file && p?.progress != null) {
        sendStatus(`Descargando modelo: ${Math.round(p.progress)}%`);
      }
    },
  }).then((t) => {
    transcriber = t;
    sendStatus("Modelo listo.");
  }).catch((err) => {
    modelLoading = null;
    console.error("[EscuchAI] No se pudo cargar Whisper:", err);
    sendStatus(`No se pudo cargar el modelo: ${err.message}`);
    throw err;
  });
  return modelLoading;
}

/* ---------------- Captura ---------------- */
async function startCapture(streamId, requestedLang) {
  if (running) return;
  if (!streamId) throw new Error("No se recibió el streamId de la pestaña.");
  lang = ["es", "en", "auto"].includes(requestedLang) ? requestedLang : "es";

  // 1. Audio de la pestaña (los demás participantes). Si esto falla, se avisa.
  tabStream = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId } },
  });

  // 2. Devolver el audio a los parlantes (tabCapture lo silencia).
  try {
    playbackCtx = new AudioContext();
    playbackCtx.createMediaStreamSource(tabStream).connect(playbackCtx.destination);
  } catch (err) {
    console.warn("[EscuchAI] No se pudo redirigir el audio a los parlantes:", err);
  }

  // 3. Micrófono (tu voz). Opcional: sin permiso se sigue solo con la pestaña.
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    micStream = null;
    sendStatus("Sin acceso al micrófono: solo se transcribe a los demás participantes.");
  }

  running = true;
  queue = [];
  recordLoop(tabStream, "tab");
  if (micStream) recordLoop(micStream, "mic");
  consumeQueue();

  // 4. El modelo carga en segundo plano: la captura ya está abierta.
  ensureModel().catch(() => { /* ya se informó en sendStatus */ });
}

// Cada ventana usa un MediaRecorder nuevo: así cada blob es un webm completo y
// autónomo, decodificable por separado (con timeslice solo el 1º trae cabecera).
async function recordLoop(stream, source) {
  const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : "audio/webm";

  while (running) {
    const parts = [];
    let rec;
    try {
      rec = new MediaRecorder(stream, { mimeType: mime });
    } catch (err) {
      console.error("[EscuchAI] MediaRecorder:", err);
      sendStatus(`No se pudo grabar (${source}): ${err.message}`);
      return;
    }
    rec.ondataavailable = (ev) => { if (ev.data?.size) parts.push(ev.data); };
    const finished = new Promise((resolve) => { rec.onstop = resolve; });

    const start = Date.now();
    rec.start();
    await sleep(WINDOW_MS);
    try { if (rec.state !== "inactive") rec.stop(); } catch (_) { /* ya parado */ }
    await finished;
    const end = Date.now();

    if (!running) return;
    if (!parts.length) continue;
    const blob = new Blob(parts, { type: mime });
    if (blob.size < MIN_BLOB_BYTES) continue;   // ventana sin señal

    queue.push({ blob, source, start, end });
    while (queue.length > MAX_QUEUE) queue.shift();
  }
}

/* ---------------- Transcripción (una ventana a la vez) ---------------- */
async function consumeQueue() {
  while (running) {
    if (busy || !transcriber || !queue.length) { await sleep(200); continue; }
    const item = queue.shift();
    busy = true;
    try {
      await transcribeWindow(item);
    } catch (err) {
      console.error("[EscuchAI] Error transcribiendo:", err);
      sendStatus(`Error al transcribir: ${err.message}`);
    } finally {
      busy = false;
    }
  }
}

async function transcribeWindow({ blob, source, start, end }) {
  // webm → PCM mono Float32 @16kHz (lo que espera Whisper).
  const buf = await blob.arrayBuffer();
  const ctx = new AudioContext();
  let decoded;
  try {
    decoded = await ctx.decodeAudioData(buf);
  } catch (err) {
    console.warn(`[EscuchAI] No se pudo decodificar la ventana (${source}):`, err);
    return;
  } finally {
    ctx.close().catch(() => {});
  }

  const mono = toMono(decoded);
  if (rms(mono) < SILENCE_RMS) return;   // silencio: evita que Whisper invente texto

  const samples = decoded.sampleRate === SAMPLE_RATE
    ? mono
    : downsample(mono, decoded.sampleRate, SAMPLE_RATE);

  const t0 = performance.now();
  const result = await transcriber(samples, {
    language: lang === "auto" ? null : lang,
    task: "transcribe",
    return_timestamps: false,
    no_repeat_ngram_size: 4,   // corta bucles tipo "hola hola hola" sobre audio pobre
  });
  const elapsed = Math.round(performance.now() - t0);
  chrome.runtime.sendMessage({ target: "sidepanel", type: "latency", stage: "whisper", ms: elapsed });

  const text = cleanText(result?.text);
  if (!text) return;
  chrome.runtime.sendMessage({
    target: "sidepanel",
    type: "raw-chunk",
    text,
    source,          // "tab" | "mic": el panel etiqueta "Tú" y descarta el eco
    start, end,      // ventana de audio, para cruzarla con quién hablaba
    ts: Date.now(),
  });
}

/* ---------------- Parada ---------------- */
function stopCapture() {
  running = false;
  queue = [];
  for (const s of [tabStream, micStream]) {
    try { s?.getTracks().forEach((t) => t.stop()); } catch (_) { /* ya parado */ }
  }
  try { playbackCtx?.close(); } catch (_) { /* ya cerrado */ }
  tabStream = micStream = playbackCtx = null;
}

/* ---------------- Utilidades de audio ---------------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function toMono(audioBuffer) {
  const len = audioBuffer.length;
  const channels = audioBuffer.numberOfChannels;
  const mono = new Float32Array(len);
  for (let ch = 0; ch < channels; ch++) {
    const data = audioBuffer.getChannelData(ch);
    for (let i = 0; i < len; i++) mono[i] += data[i];
  }
  if (channels > 1) for (let i = 0; i < len; i++) mono[i] /= channels;
  return mono;
}

function rms(samples) {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / (samples.length || 1));
}

// Interpolación lineal: suficiente para voz.
function downsample(input, fromRate, toRate) {
  const ratio = fromRate / toRate;
  const outLen = Math.floor(input.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const idx = i * ratio;
    const i0 = Math.floor(idx);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = idx - i0;
    out[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return out;
}

// Whisper "rellena" sobre audio pobre: estas son sus muletillas más típicas.
const HALLUCINATIONS = [
  /subt[ií]tulos?\s+(realizados|creados|por|y)/i,
  /gracias por (ver|mirar|su atenci[óo]n)/i,
  /thanks for watching|please subscribe/i,
  /^[\s.·\-¡¿!?,]*$/,
  /^\[.*\]$/,
  /amara\.org/i,
  /suscr[íi]b(ete|anse)|dale like|comparte el v[íi]deo/i,
  /^\s*(m[úu]sica|aplausos|risas|silencio|music|applause)\s*$/i,
];

function cleanText(raw) {
  const text = (raw || "").trim();
  if (!text) return "";
  if (HALLUCINATIONS.some((re) => re.test(text))) return "";
  // Una sola palabra sin contexto suele ser ruido mal interpretado.
  if (text.replace(/[^\p{L}\p{N}]/gu, "").length < 4) return "";
  return text;
}
