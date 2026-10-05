// Offscreen document: captura el audio de la pestaña y lo transcribe con Whisper.
// Implementa `spec.md > Components` (Offscreen Document) y los pasos 3-4 de
// `spec.md > The Core Journey Through the System`.

import { pipeline, env } from "../../vendor/transformers.min.js";

// Permite descargar el modelo desde el Hub la primera vez (luego queda en caché).
env.allowRemoteModels = true;
env.allowLocalModels = false;

const MODEL_ID = "Xenova/whisper-base";   // plan B registrado: whisper-tiny si la latencia es alta
const CHUNK_MS = 5000;                     // bloques de 5 s
const SAMPLE_RATE = 16000;                 // Whisper espera 16 kHz

let transcriber = null;
let mediaStream = null;
let audioContext = null;
let processor = null;
let sourceNode = null;
let pcmBuffer = [];
let chunkTimer = null;

/* ---------------- Carga del modelo ---------------- */
async function ensureModel() {
  if (transcriber) return;
  sendStatus("Cargando modelo de transcripción… (puede tardar la primera vez)");
  transcriber = await pipeline("automatic-speech-recognition", MODEL_ID);
  sendStatus("Modelo listo.");
}

/* ---------------- Mensajería con el service worker ---------------- */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.target !== "offscreen") return;
  if (msg.type === "start-capture") {
    startCapture(msg.streamId).then(
      () => sendResponse({ ok: true }),
      (err) => sendResponse({ ok: false, error: err.message })
    );
    return true; // respuesta asíncrona
  }
  if (msg.type === "stop-capture") {
    stopCapture();
    sendResponse({ ok: true });
  }
});

function sendStatus(text) {
  chrome.runtime.sendMessage({ target: "sidepanel", type: "status", text });
}

function sendRawChunk(text) {
  if (text && text.trim()) {
    chrome.runtime.sendMessage({
      target: "sidepanel",
      type: "raw-chunk",
      text: text.trim(),
      ts: Date.now(),
    });
  }
}

/* ---------------- Captura de audio ---------------- */
async function startCapture(streamId) {
  await ensureModel();

  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
      },
    },
  });

  audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
  sourceNode = audioContext.createMediaStreamSource(mediaStream);

  // Mantener el audio audible para el usuario mientras se captura.
  sourceNode.connect(audioContext.destination);

  processor = audioContext.createScriptProcessor(4096, 1, 1);
  sourceNode.connect(processor);
  processor.connect(audioContext.destination);

  pcmBuffer = [];
  processor.onaudioprocess = (e) => {
    pcmBuffer.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  };

  chunkTimer = setInterval(flushChunk, CHUNK_MS);
}

async function flushChunk() {
  if (pcmBuffer.length === 0 || !transcriber) return;
  const chunk = mergeBuffers(pcmBuffer);
  pcmBuffer = [];

  // Silencio: no gastar una transcripción.
  if (isSilent(chunk)) return;

  const t0 = performance.now();
  try {
    const result = await transcriber(chunk, {
      chunk_length_s: 6,
      language: null,       // autodetección ES/EN
      task: "transcribe",
    });
    const elapsed = Math.round(performance.now() - t0);
    console.log(`[EscuchAI] Whisper bloque transcrito en ${elapsed} ms`);
    chrome.runtime.sendMessage({ target: "sidepanel", type: "latency", stage: "whisper", ms: elapsed });
    sendRawChunk(result.text);
  } catch (err) {
    console.error("[EscuchAI] Error transcribiendo bloque:", err);
    sendStatus(`Error al transcribir: ${err.message}`);
  }
}

function stopCapture() {
  if (chunkTimer) { clearInterval(chunkTimer); chunkTimer = null; }
  if (processor) { processor.disconnect(); processor.onaudioprocess = null; processor = null; }
  if (sourceNode) { sourceNode.disconnect(); sourceNode = null; }
  if (audioContext) { audioContext.close(); audioContext = null; }
  if (mediaStream) { mediaStream.getTracks().forEach((t) => t.stop()); mediaStream = null; }
  pcmBuffer = [];
}

/* ---------------- Utilidades de audio ---------------- */
function mergeBuffers(buffers) {
  const total = buffers.reduce((n, b) => n + b.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const b of buffers) { out.set(b, offset); offset += b.length; }
  return out;
}

function isSilent(samples) {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  const rms = Math.sqrt(sum / samples.length);
  return rms < 0.004;
}
