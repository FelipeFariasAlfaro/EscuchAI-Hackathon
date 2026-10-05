// Cliente de la API de Gemini.
// Implementa `spec.md > External Services and Dependencies` y `spec.md > Components` (Gemini Client).
// Docs: https://ai.google.dev/api/models · https://ai.google.dev/gemini-api/docs

const BASE = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Valida la API key listando los modelos disponibles.
 * GET /v1beta/models con header x-goog-api-key.
 * @returns {Promise<{ok:boolean, models?:Array, error?:string}>}
 */
export async function validateAndListModels(apiKey) {
  if (!apiKey || !apiKey.trim()) {
    return { ok: false, error: "La API key está vacía." };
  }
  try {
    const res = await fetch(`${BASE}/models`, {
      headers: { "x-goog-api-key": apiKey.trim() },
    });
    if (!res.ok) {
      let detail = `Error ${res.status}`;
      try {
        const body = await res.json();
        detail = body?.error?.message || detail;
      } catch (_) { /* respuesta no-JSON */ }
      return { ok: false, error: detail };
    }
    const data = await res.json();
    const models = (data.models || [])
      // Solo modelos que sirven para generar texto (chat / pulido).
      .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
      .map((m) => ({
        id: m.name.replace(/^models\//, ""),
        displayName: m.displayName || m.name,
      }));
    if (models.length === 0) {
      return { ok: false, error: "La key es válida pero no hay modelos de generación disponibles." };
    }
    return { ok: true, models };
  } catch (err) {
    return { ok: false, error: `No se pudo conectar con Gemini: ${err.message}` };
  }
}

/**
 * Llamada genérica a generateContent.
 * @param {string} apiKey
 * @param {string} model  id del modelo (sin prefijo "models/")
 * @param {Array<{role:string, text:string}>} messages  historial en orden
 * @param {string} [systemText]  instrucción de sistema opcional
 * @returns {Promise<{ok:boolean, text?:string, error?:string}>}
 */
export async function generateContent(apiKey, model, messages, systemText) {
  try {
    const body = {
      contents: messages.map((m) => ({
        role: m.role === "model" ? "model" : "user",
        parts: [{ text: m.text }],
      })),
    };
    if (systemText) {
      body.systemInstruction = { parts: [{ text: systemText }] };
    }
    const res = await fetch(`${BASE}/models/${model}:generateContent`, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let detail = `Error ${res.status}`;
      try {
        const b = await res.json();
        detail = b?.error?.message || detail;
      } catch (_) { /* ignore */ }
      return { ok: false, error: detail };
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text)
      .filter(Boolean)
      .join("") || "";
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Segunda capa sobre Whisper: pule un fragmento crudo (acentos, puntuación,
 * términos en inglés castellanizados, palabras partidas en el borde del audio).
 * Es correctivo, nunca creativo. Si falla, devuelve el texto crudo.
 *
 * @param {string} apiKey
 * @param {string} model
 * @param {string} rawText  fragmento a corregir
 * @param {{lang?: "es"|"en"|"auto", previous?: string}} [opts]
 *        previous: línea ya corregida anterior, solo como contexto.
 */
export async function polishTranscript(apiKey, model, rawText, opts = {}) {
  const { lang = "es", previous = "" } = opts;
  const idioma =
    lang === "en" ? "inglés" : lang === "auto" ? "el que se hable (español o inglés)" : "español";
  const system =
    "Corriges transcripciones automáticas de reuniones. Devuelve SOLO la línea corregida.\n" +
    "Reglas:\n" +
    `- Idioma base: ${idioma}. Corrige ortografía, acentos y puntuación.\n` +
    "- Términos técnicos, marcas y palabras en inglés se escriben en inglés correcto " +
    '(ej. "deploy", "sprint", "testing"), NO castellanizados.\n' +
    "- El audio se corta en fragmentos: las palabras del inicio y del final pueden estar " +
    "partidas o incompletas. Recompón la palabra usando el contexto previo si se da.\n" +
    "- NUNCA acortes ni elimines palabras: conserva todo lo que se dijo. " +
    "Si una palabra quedó a medias, complétala; no la borres.\n" +
    "- NO añadas, resumas ni inventes contenido. Si es ininteligible, devuélvela igual.\n" +
    "- No repitas el contexto previo. Responde sin comentarios ni comillas.";
  const user = previous
    ? `CONTEXTO PREVIO (no lo devuelvas): ...${previous.slice(-120)}\n\nLÍNEA A CORREGIR:\n${rawText}`
    : rawText;

  const result = await generateContent(apiKey, model, [{ role: "user", text: user }], system);
  if (!result.ok || !result.text) return { ok: false, text: rawText, error: result.error };

  let text = result.text.trim();
  // Red de seguridad: si el largo se aleja mucho del original, la IA acortó o
  // inventó; preferimos el crudo (el spec prohíbe perder contenido).
  // Si la IA devolvió contexto + línea, quedarse con lo último.
  text = text.replace(/^[\s\S]*?l[ií]nea a corregir:?\s*/i, "");
  if (text.length < rawText.length * 0.6 || text.length > rawText.length * 2 + 40) {
    return { ok: false, text: rawText, error: "respuesta fuera de rango" };
  }
  return { ok: true, text };
}
