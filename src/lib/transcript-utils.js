// Lógica pura de la transcripción (sin DOM ni chrome.*): filtro de eco,
// atribución de hablante y mini-markdown seguro. Portada de EscuchAI v1.

export const ECHO_WINDOW_MS = 14000;
export const ECHO_THRESHOLD = 0.6;
export const SPEAKER_SLACK_MS = 1500;

/* ---------------- Eco ----------------
   El micrófono capta lo que suena por los parlantes, así que la voz de los demás
   llega por los dos canales y se transcribiría dos veces (la copia del micrófono,
   además, sale distorsionada). Si un texto se parece a algo que entró por el otro
   canal hace poco, es eco. */

export function normalizar(t) {
  return String(t ?? "").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function palabrasClave(t) {
  return new Set(normalizar(t).split(" ").filter((w) => w.length > 2));
}

// Proporción de palabras compartidas respecto al texto más corto. Con menos de
// 3 palabras clave no se evalúa: dos "sí, claro" no son necesariamente eco.
export function similitud(a, b) {
  const pa = palabrasClave(a);
  const pb = palabrasClave(b);
  if (pa.size < 3 || pb.size < 3) return 0;
  let comunes = 0;
  for (const w of pa) if (pb.has(w)) comunes++;
  return comunes / Math.min(pa.size, pb.size);
}

/**
 * Busca en `recent` una línea del OTRO canal que sea eco de `text`.
 * @param {Array<{text:string, source:string, ts:number}>} recent
 * @returns la entrada coincidente o null
 */
export function findEcho(recent, text, source, now = Date.now()) {
  if (!source) return null;
  for (let i = recent.length - 1; i >= 0; i--) {
    const r = recent[i];
    if (r.source && r.source !== source &&
        now - r.ts < ECHO_WINDOW_MS &&
        similitud(text, r.text) >= ECHO_THRESHOLD) {
      return r;
    }
  }
  return null;
}

/* ---------------- Hablante ----------------
   `log` = [{name, ts}] en orden: cada entrada marca el momento en que empezó a
   hablar ese nombre (solo se registran cambios). Un nombre "sigue hablando" hasta
   la siguiente entrada. Se elige el que más tiempo ocupa la ventana [start,end]. */

export function dominantSpeaker(log, start, end, slackMs = SPEAKER_SLACK_MS) {
  if (!Array.isArray(log) || !log.length) return null;
  const winStart = start;
  const winEnd = end + slackMs;   // el nombre puede llegar un poco después de la voz
  const totals = new Map();
  for (let i = 0; i < log.length; i++) {
    const from = log[i].ts;
    const to = i + 1 < log.length ? log[i + 1].ts : Infinity;
    const overlap = Math.min(to, winEnd) - Math.max(from, winStart);
    if (overlap > 0) totals.set(log[i].name, (totals.get(log[i].name) || 0) + overlap);
  }
  let best = null;
  let bestMs = 0;
  for (const [name, ms] of totals) {
    if (ms > bestMs) { best = name; bestMs = ms; }
  }
  return best;
}

/* ---------------- Mini-markdown seguro ----------------
   Soporta párrafos, listas con "- "/"* "/"1. " y **negrita**. Construye nodos DOM
   con textContent: nunca interpreta HTML de la respuesta de la IA. */

function appendInline(parent, text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  for (const part of parts) {
    if (!part) continue;
    const m = part.match(/^\*\*([^*]+)\*\*$/);
    if (m) {
      const strong = document.createElement("strong");
      strong.textContent = m[1];
      parent.appendChild(strong);
    } else {
      parent.appendChild(document.createTextNode(part));
    }
  }
}

export function renderMiniMarkdown(container, text) {
  container.textContent = "";
  let list = null;
  for (const raw of String(text ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { list = null; continue; }
    const li = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (li) {
      if (!list) { list = document.createElement("ul"); container.appendChild(list); }
      const item = document.createElement("li");
      appendInline(item, li[1]);
      list.appendChild(item);
    } else {
      list = null;
      const p = document.createElement("p");
      appendInline(p, line.replace(/^#{1,6}\s+/, ""));
      container.appendChild(p);
    }
  }
}
