// Detecta quién habla en Google Meet y lo reporta al side panel.
// Implementa `spec.md > Components` (Content Script).
//
// Meet ofusca sus clases CSS, así que se combinan señales semánticas:
//   1. Subtítulos nativos, cuando están activos.
//   2. Una única contraparte: si solo hay otra persona, el audio de la pestaña
//      solo puede pertenecerle.
//   3. Indicadores accesibles/atributos de actividad de voz dentro de un tile.
//
// El script puede inyectarse desde el manifest o dinámicamente si Meet ya estaba
// abierto al recargar la extensión. El guard evita listeners duplicados.

(() => {
  if (globalThis.__escuchaiSpeakerDetector?.installed) return;

  const state = globalThis.__escuchaiSpeakerDetector = {
    installed: true,
    watching: false,
    pollTimer: null,
    captionObserver: null,
    captionContainer: null,
    lastSpeaker: "",
    lastReportAt: 0,
  };

  const HEARTBEAT_MS = 1200;
  const SELF_MARK_RE = /(?:^|\s)\((?:t[úu]|you)\)\s*$/i;
  const EXACT_SELF_RE = /^\s*(?:t[úu]|you)\s*$/i;
  const SPEAKING_RE = /(?:est[áa]\s+hablando|habla\s+ahora|is\s+speaking|speaking\s+now)/i;
  const PARTICIPANT_ROOT_SELECTOR = [
    "[data-participant-id]",
    "[data-requested-participant-id]",
    "[data-participant-identifier]",
  ].join(",");

  function rawText(el) {
    if (!el) return "";
    return [
      el.getAttribute?.("data-self-name"),
      el.getAttribute?.("aria-label"),
      el.getAttribute?.("data-tooltip"),
      el.getAttribute?.("data-tooltip-text"),
      el.getAttribute?.("title"),
      el.textContent,
    ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  }

  function esPropio(el) {
    if (!el) return false;
    if (el.matches?.("[data-self-name]") || el.querySelector?.("[data-self-name]")) return true;

    // Solo inspeccionar etiquetas de identidad y textos hoja. Nunca todo el
    // subárbol: una frase remota como "you need to…" no indica que sea el usuario.
    const nodes = [el, ...el.querySelectorAll("[aria-label], [title], div, span")];
    return nodes.some((node) => {
      const values = [node.getAttribute?.("aria-label"), node.getAttribute?.("title")];
      if (node.children?.length === 0) values.push(node.textContent);
      return values.filter(Boolean).some((value) => {
        const compact = String(value).replace(/\s+/g, " ").trim();
        return EXACT_SELF_RE.test(compact) || SELF_MARK_RE.test(compact);
      });
    });
  }

  function limpiarNombre(raw) {
    let n = String(raw || "").replace(/\s+/g, " ").trim();
    n = n.replace(/\s*\((t[úu]|you|anfitri[óo]n|host|organizador|presenta)\)\s*/gi, " ");
    n = n.replace(/\s*(est[áa] hablando|is speaking|habla ahora|speaking now)\s*$/i, "");
    // Meet suele concatenar estados accesibles al nombre: "Ana, microphone muted".
    n = n.replace(/,\s*(micr[oó]fono|microphone|c[aá]mara|camera|silenciado|muted|presentando|presenting)\b.*$/i, "");
    n = n.replace(/^[•·\-\s]+|[•·\-\s]+$/g, "").trim();
    if (n.length < 2 || n.length > 60 || n.split(/\s+/).length > 6) return "";
    if (/^(t[úu]|you|participante|participant|unknown|desconocido)$/i.test(n)) return "";
    if (/^(micr[oó]fono|microphone|c[aá]mara|camera|m[aá]s opciones|more options|fijar|pin|silenciado|muted)$/i.test(n)) return "";
    if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(n)) return "";
    return n;
  }

  function textosHoja(root) {
    if (!root?.querySelectorAll) return [];
    const result = [];
    root.querySelectorAll("[data-self-name], [aria-label], [title], div, span").forEach((el) => {
      if (el !== root && el.children.length > 0 && !el.hasAttribute("data-self-name")) return;
      const values = [
        el.getAttribute("data-self-name"),
        el.getAttribute("aria-label"),
        el.getAttribute("title"),
        el.textContent,
      ];
      for (const value of values) {
        const n = limpiarNombre(value);
        if (n && !result.includes(n)) result.push(n);
      }
    });
    return result;
  }

  function nombreDelParticipante(root) {
    if (!root) return "";

    // La marca "(Tú)" debe leerse ANTES de limpiar el texto; era el fallo que
    // hacía contar al propio usuario como una contraparte.
    const selfNode = root.matches?.("[data-self-name]")
      ? root
      : root.querySelector?.("[data-self-name]");
    const selfValue = selfNode?.getAttribute("data-self-name") || selfNode?.textContent;
    if (selfValue && !/^(true|false)$/i.test(selfValue.trim())) {
      const n = limpiarNombre(selfValue);
      if (n) return n;
    }

    const rootLabel = limpiarNombre(root.getAttribute?.("aria-label"));
    if (rootLabel && !SPEAKING_RE.test(rootLabel)) return rootLabel;

    return textosHoja(root)[0] || "";
  }

  function reportar(nombre, via) {
    const limpio = limpiarNombre(nombre);
    if (!limpio) return;
    const now = Date.now();
    const changed = limpio !== state.lastSpeaker;
    const due = now - state.lastReportAt >= HEARTBEAT_MS;
    // Los cambios salen inmediatamente; las repeticiones respetan el heartbeat.
    if (!changed && !due) return;
    state.lastSpeaker = limpio;
    state.lastReportAt = now;
    chrome.runtime.sendMessage({
      target: "sidepanel",
      type: "speaker",
      name: limpio,
      via,
      detectedAt: now,
      meetingUrl: location.href,
    }).catch(() => {});
  }

  /* ---------- Participantes ---------- */
  function participantRoots() {
    const roots = [...document.querySelectorAll(PARTICIPANT_ROOT_SELECTOR)];
    // Evitar contar un mismo tile varias veces si hay atributos anidados.
    return roots.filter((root) => !roots.some((other) => other !== root && other.contains(root)));
  }

  function listarParticipantes() {
    const participants = [];
    const seenIds = new Set();

    for (const [index, root] of participantRoots().entries()) {
      const name = nombreDelParticipante(root);
      if (!name) continue;
      const id = root.getAttribute("data-participant-id") ||
        root.getAttribute("data-requested-participant-id") ||
        root.getAttribute("data-participant-identifier") || `tile-${index}`;
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      participants.push({ name, self: esPropio(root), root, id });
    }

    // Los tiles preservan identidades homónimas mediante participant-id. Solo
    // recurrir al roster cuando Meet no expone ningún tile utilizable.
    if (participants.length) return participants;

    const rosterByName = new Map();
    const rosterSelectors = [
      '[aria-label*="personas" i]',
      '[aria-label*="people" i]',
      '[aria-label*="participantes" i]',
      '[aria-label*="participants" i]',
    ];
    for (const roster of document.querySelectorAll(rosterSelectors.join(","))) {
      roster.querySelectorAll('[role="listitem"]').forEach((item) => {
        const name = limpiarNombre(item.getAttribute("aria-label")) || textosHoja(item)[0];
        if (!name || rosterByName.has(name)) return;
        rosterByName.set(name, {
          name,
          self: esPropio(item),
          root: item,
          id: `roster-${rosterByName.size}`,
        });
      });
    }
    return [...rosterByName.values()];
  }

  /* ---------- Subtítulos nativos ---------- */
  function buscarContenedorSubtitulos(participants) {
    const knownNames = participants.map((p) => p.name.toLowerCase());
    let best = null;
    let bestScore = 0;
    for (const candidate of document.querySelectorAll('[aria-live="polite"], [aria-live="assertive"]')) {
      const text = rawText(candidate).toLowerCase();
      const leaves = textosHoja(candidate);
      let score = leaves.length >= 2 ? 1 : 0;
      if (knownNames.some((name) => text.includes(name))) score += 3;
      if (candidate.querySelector("img")) score += 1;
      if (score > bestScore) { best = candidate; bestScore = score; }
    }
    return bestScore >= 2 ? best : null;
  }

  function nombreDeEntradaSubtitulo(entry, participants) {
    const text = rawText(entry).toLowerCase();
    const known = participants.find((p) => text.includes(p.name.toLowerCase()));
    if (known) return known.self ? "" : known.name;

    // Sin coincidencia con el roster no usamos texto libre: podría ser la frase
    // subtitulada, no un nombre. Es preferible el fallback a inventar identidad.
    return "";
  }

  function observarSubtitulos(participants = listarParticipantes()) {
    const container = buscarContenedorSubtitulos(participants);
    if (!container) return false;
    if (state.captionContainer === container && state.captionObserver) return true;

    state.captionObserver?.disconnect();
    state.captionContainer = container;
    state.captionObserver = new MutationObserver(() => {
      if (!state.watching) return;
      const currentParticipants = listarParticipantes();
      const entries = [...container.children];
      const last = entries[entries.length - 1] || container;
      const name = nombreDeEntradaSubtitulo(last, currentParticipants);
      if (name) reportar(name, "subtitulos");
    });
    state.captionObserver.observe(container, { childList: true, subtree: true, characterData: true });
    return true;
  }

  /* ---------- Indicador visual de voz ---------- */
  function tileEstaHablando(root) {
    if (!root) return false;
    if (root.matches?.('[data-is-speaking="true"]') || root.querySelector?.('[data-is-speaking="true"]')) return true;
    const labelled = [root, ...root.querySelectorAll?.("[aria-label]") || []]
      .some((el) => SPEAKING_RE.test(el.getAttribute?.("aria-label") || ""));
    if (labelled) return true;
    return [...root.querySelectorAll?.('[class*="speaking" i]') || []].some((el) => {
      const style = getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden";
    });
  }

  function detectarPorIndicador(participants) {
    const active = participants.find((p) => !p.self && tileEstaHablando(p.root));
    if (active) return active.name;

    const generic = document.querySelector([
      '[data-is-speaking="true"]',
      '[aria-label*="está hablando" i]',
      '[aria-label*="is speaking" i]',
      '[aria-label*="habla ahora" i]',
    ].join(","));
    if (!generic) return "";
    const tile = generic.closest(PARTICIPANT_ROOT_SELECTOR) || generic;
    return esPropio(tile) ? "" : nombreDelParticipante(tile);
  }

  /* ---------- Bucle ---------- */
  function tick() {
    if (!state.watching) return;

    const participants = listarParticipantes();
    if (!state.captionObserver || !state.captionContainer?.isConnected) {
      state.captionObserver?.disconnect();
      state.captionObserver = null;
      state.captionContainer = null;
      observarSubtitulos(participants);
    }

    const others = participants.filter((p) => !p.self);

    // En una llamada de dos personas, esta es la atribución más fiable: todo el
    // audio remoto pertenece a la única contraparte. Se emite heartbeat para que
    // cada ventana de audio de 5 s tenga evidencia temporal superpuesta.
    if (others.length === 1) {
      reportar(others[0].name, "unico-participante");
      return;
    }

    const active = detectarPorIndicador(participants);
    if (active) reportar(active, "indicador");
  }

  function startWatch() {
    state.watching = true;
    state.lastSpeaker = "";
    state.lastReportAt = 0;
    state.captionObserver?.disconnect();
    state.captionObserver = null;
    state.captionContainer = null;
    observarSubtitulos();
    if (state.pollTimer) clearInterval(state.pollTimer);
    state.pollTimer = setInterval(tick, 1000);
    tick();
  }

  function stopWatch() {
    state.watching = false;
    if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }
    state.captionObserver?.disconnect();
    state.captionObserver = null;
    state.captionContainer = null;
    state.lastSpeaker = "";
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.target !== "content") return;
    if (msg.type === "start-watch") startWatch();
    if (msg.type === "stop-watch") stopWatch();
  });
})();
