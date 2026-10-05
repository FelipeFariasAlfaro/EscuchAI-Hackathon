// Acciones sobre la transcripción: Copiar, Exportar TXT/MD y Resumir con IA.
// Implementa `prd.md > Features and Behavior` (acciones de la sección Transcripción,
// promovidas de "Después" a la PoC por decisión del usuario; ver checklist > Revisions).

import { getAiConfig, isConfigured } from "../lib/storage.js";
import { generateContent } from "../lib/gemini.js";

/* ---------------- Formateo de la transcripción ---------------- */
export function transcriptToText(transcript) {
  return transcript.map((e) => `${e.speaker}: ${e.text}`).join("\n");
}

export function transcriptToMarkdown(transcript) {
  const date = new Date().toLocaleString();
  const lines = transcript.map((e) => `**${e.speaker}:** ${e.text}`);
  return `# Transcripción EscuchAI\n\n_${date}_\n\n${lines.join("\n\n")}\n`;
}

/* ---------------- Descarga de archivo ---------------- */
function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Liberar la URL un instante después de iniciar la descarga.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function stamp() {
  // 2026-10-05_00-40
  return new Date().toISOString().slice(0, 16).replace("T", "_").replace(/:/g, "-");
}

export function exportTxt(transcript) {
  download(`escuchai_${stamp()}.txt`, transcriptToText(transcript), "text/plain;charset=utf-8");
}

export function exportMd(transcript) {
  download(`escuchai_${stamp()}.md`, transcriptToMarkdown(transcript), "text/markdown;charset=utf-8");
}

/* ---------------- Copiar al portapapeles ---------------- */
export async function copyTranscript(transcript) {
  await navigator.clipboard.writeText(transcriptToText(transcript));
}

/* ---------------- Resumen con IA ---------------- */
export async function summarize(transcript) {
  const cfg = await getAiConfig();
  if (!isConfigured(cfg)) return { ok: false, needsConfig: true };

  const system =
    "Eres el asistente de EscuchAI. Resume la reunión de forma breve y clara, SOLO con " +
    "la transcripción de abajo. No inventes nada. Estructura: una línea de contexto, " +
    "luego puntos clave con guiones, y si hay acuerdos o tareas, una sección breve. " +
    "Responde en el idioma de la reunión. Puedes usar **negrita** y listas con guiones.";
  const body = transcript.map((e) => `${e.speaker}: ${e.text}`).join("\n");

  const res = await generateContent(
    cfg.apiKey,
    cfg.model,
    [{ role: "user", text: `Resume esta reunión:\n\n${body}` }],
    system
  );
  return res;
}
