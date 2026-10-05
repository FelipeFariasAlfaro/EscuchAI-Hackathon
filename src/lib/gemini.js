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
 * Pule un bloque de texto crudo de transcripción (puntuación, mayúsculas, correcciones leves).
 * No inventa contenido; devuelve el texto crudo si falla.
 */
export async function polishTranscript(apiKey, model, rawText) {
  const system =
    "Eres un corrector de transcripciones. Devuelve EXACTAMENTE el mismo contenido " +
    "con puntuación y mayúsculas correctas y errores evidentes de reconocimiento corregidos. " +
    "No agregues, resumas ni comentes nada. Responde solo con el texto corregido.";
  const result = await generateContent(apiKey, model, [{ role: "user", text: rawText }], system);
  if (!result.ok || !result.text) return { ok: false, text: rawText, error: result.error };
  return { ok: true, text: result.text.trim() };
}
