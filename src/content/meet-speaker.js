// Content script en Google Meet: averigua QUIÉN habla y lo reporta al side panel.
// Implementa `spec.md > Components` (Content Script).
//
// Meet ofusca sus clases CSS, así que no se depende de un selector concreto. Se
// usan tres vías, de la más fiable a la menos:
//   1. Subtítulos nativos: traen el nombre del hablante junto a su frase. Son la
//      fuente exacta, pero requieren que el usuario los active en Meet.
//   2. Un solo acompañante: si hay una única otra persona, lo que suena por la
//      pestaña es suyo. Sin ambigüedad posible.
//   3. Indicador visual de voz en el tile: heurística de último recurso.
// Si ninguna da un nombre, el panel usa "Participante Indistinguible".

let watching = false;
let pollTimer = null;
let captionObserver = null;
let lastSpeaker = "";

function reportar(nombre) {
  const limpio = limpiarNombre(nombre);
  if (!limpio || limpio === lastSpeaker) return;
  lastSpeaker = limpio;
  chrome.runtime.sendMessage({ target: "sidepanel", type: "speaker", name: limpio }).catch(() => {});
}

// Los nombres vienen con sufijos como "(Tú)" o "(anfitrión)".
function limpiarNombre(raw) {
  let n = String(raw || "").replace(/\s+/g, " ").trim();
  n = n.replace(/\s*\((t[úu]|you|anfitri[óo]n|host|organizador|presenta)\)\s*/gi, "");
  n = n.replace(/\s*(está hablando|is speaking|habla ahora)\s*$/i, "");
  if (n.length < 2 || n.length > 60) return "";
  if (/^(t[úu]|you|participante|unknown)$/i.test(n)) return "";
  return n;
}

// Dentro de un tile hay varios textos (nombre, estado, etiquetas). El nombre
// suele ser el primer texto corto de una sola línea.
function textoMasProbableNombre(root) {
  const hojas = [];
  root.querySelectorAll("div, span").forEach((el) => {
    if (el.children.length === 0) {
      const t = el.textContent.trim();
      if (t && t.length <= 60 && t.split(" ").length <= 5) hojas.push(t);
    }
  });
  return hojas[0] || "";
}

/* ---------- 1. Subtítulos nativos ---------- */
// El contenedor es una región aria-live (semántica estable, no clase ofuscada);
// las entradas de subtítulo llevan el avatar del hablante.
function buscarContenedorSubtitulos() {
  for (const c of document.querySelectorAll('[aria-live="polite"], [aria-live="assertive"]')) {
    if (c.querySelector("img")) return c;
  }
  return null;
}

// De una entrada, el nombre es el texto más corto y el discurso el más largo.
function nombreDeEntradaSubtitulo(entrada) {
  const textos = [];
  entrada.querySelectorAll("div, span").forEach((el) => {
    if (el.children.length === 0) {
      const t = el.textContent.trim();
      if (t) textos.push(t);
    }
  });
  if (textos.length < 2) return "";
  const corto = textos.reduce((a, b) => (a.length <= b.length ? a : b));
  return corto.split(" ").length > 5 ? "" : corto;
}

function observarSubtitulos() {
  const cont = buscarContenedorSubtitulos();
  if (!cont) return false;
  captionObserver?.disconnect();
  captionObserver = new MutationObserver(() => {
    if (!watching) return;
    const ultima = cont.children[cont.children.length - 1];
    if (!ultima) return;
    const nombre = nombreDeEntradaSubtitulo(ultima);
    if (nombre) reportar(nombre);
  });
  captionObserver.observe(cont, { childList: true, subtree: true, characterData: true });
  return true;
}

/* ---------- 2. Participantes de la reunión ---------- */
function listarParticipantes() {
  const nombres = new Set();
  document.querySelectorAll("[data-participant-id]").forEach((tile) => {
    const propio = tile.querySelector("[data-self-name]")?.textContent;
    const n = limpiarNombre(propio || textoMasProbableNombre(tile));
    if (n) nombres.add(n);
  });
  document.querySelectorAll('[role="listitem"]').forEach((li) => {
    const n = limpiarNombre(li.getAttribute("aria-label") || textoMasProbableNombre(li));
    if (n) nombres.add(n);
  });
  return [...nombres];
}

/* ---------- 3. Indicador visual de voz (último recurso) ---------- */
function detectarPorIndicador() {
  const sel = [
    '[data-is-speaking="true"]',
    '[class*="speaking"]',
    '[aria-label*="está hablando"]',
    '[aria-label*="is speaking"]',
  ].join(", ");
  const activo = document.querySelector(sel);
  if (!activo) return "";
  const tile = activo.closest("[data-participant-id], [class*='video']") || activo;
  return limpiarNombre(
    activo.getAttribute("aria-label") ||
    tile.querySelector("[data-self-name]")?.textContent ||
    textoMasProbableNombre(tile)
  );
}

/* ---------- Bucle ---------- */
function tick() {
  if (!watching) return;
  // Si no había subtítulos al empezar, puede que el usuario los active después.
  if (!captionObserver) observarSubtitulos();

  // Caso inequívoco: una sola otra persona en la reunión.
  const otros = listarParticipantes().filter((n) => !/^(t[úu]|you)$/i.test(n));
  if (otros.length === 1) { reportar(otros[0]); return; }

  const porIndicador = detectarPorIndicador();
  if (porIndicador) reportar(porIndicador);
}

function startWatch() {
  if (watching) return;
  watching = true;
  lastSpeaker = "";
  observarSubtitulos();
  pollTimer = setInterval(tick, 1000);
  tick();
}

function stopWatch() {
  watching = false;
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  captionObserver?.disconnect();
  captionObserver = null;
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.target !== "content") return;
  if (msg.type === "start-watch") startWatch();
  if (msg.type === "stop-watch") stopWatch();
});
