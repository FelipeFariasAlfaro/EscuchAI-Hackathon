---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast

## Slices

- [x] **1. La extensión carga en Chrome y el side panel muestra la UI del mock**
  Becomes usable: Puedes cargar la extensión descomprimida, abrir el side panel y ver las tabs (Reunión, Historial, Ajustes, Sobre), las sub-tabs, el botón Grabar, el área de transcripción con su placeholder, la fila de acciones deshabilitadas y la caja de chat. Nada funciona aún, pero la cáscara es navegable.
  Why now: Es el bootstrapping (manifest, estructura de archivos, side panel) y deja dónde aterrizar todo lo demás. Verifica temprano que `chrome.sidePanel` y el manifest MV3 cargan sin errores.
  PRD ref: `prd.md > Screens and Layout`, `prd.md > Look and Feel`
  Spec ref: `spec.md > File Structure`, `spec.md > Components` (Side Panel UI), `spec.md > Look and Feel`
  Build: Crear `manifest.json` (MV3, permisos sidePanel/storage, host meet.google.com), `src/sidepanel/*` con el HTML/CSS/JS del mock (tema oscuro, acento turquesa), tabs y sub-tabs navegables, botones deshabilitados con "Próximamente", icono placeholder.
  Verify (mechanical): Cargar en `chrome://extensions` sin errores en la consola de la extensión; confirmar que el side panel abre y que cambiar de tab/sub-tab funciona. (Reporto lo que observo.)
  Learner check: Cargar la extensión, abrir el side panel en cualquier pestaña y confirmar que se ve como tu mock y que las tabs cambian.
  Commit: `Scaffold MV3 extension and side panel UI`

- [x] **2. Configurar Gemini en Ajustes (validar key, listar modelos, guardar y persistir)**
  Becomes usable: En Ajustes eliges Gemini, pones la API key, validas, se cargan los modelos, eliges uno y guardas. Al reabrir el navegador la config sigue ahí. Key inválida muestra modal de error.
  Why now: El resto del núcleo (pulido y chat) depende de tener Gemini configurado. Verifica temprano el contrato real de la API de Gemini (riesgo externo).
  PRD ref: `prd.md > Configuración de IA (Ajustes)`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > Components` (Gemini Client, Settings/Storage), `spec.md > External Services and Dependencies`, `spec.md > Data Model`
  Build: `src/lib/gemini.js` (validar key + listar modelos vía `GET /v1beta/models` con header `x-goog-api-key`), `src/lib/storage.js` (wrapper de `chrome.storage.local`), UI de Ajustes con el flujo completo y modal de error.
  Verify (mechanical): Con una key real validar y confirmar que la lista de modelos llega; con una key falsa confirmar modal de error; guardar, recargar la extensión y confirmar que la config persiste.
  Learner check: Configurar tu Gemini de verdad en Ajustes, guardar, cerrar y reabrir, y confirmar que sigue configurado.
  Commit: `Add Gemini settings flow with validation and persistence`

- [ ] **3. Probar la latencia: capturar audio de la pestaña, transcribir con Whisper y pulir con Gemini**
  Becomes usable: Con una pestaña de Meet (o una pestaña con audio para la prueba), pulsar Grabar captura el audio, Whisper transcribe un bloque y Gemini lo pule, y aparece una línea de texto. El botón pasa a rojo "Grabando". Esto mide la incertidumbre clave: ¿el delay end-to-end es aceptable?
  Why now: Es el riesgo técnico central del spec (`Decisions and Open Issues`). Si la latencia es demasiado alta, aquí decidimos el plan B antes de construir el resto. El kernel aparece temprano.
  PRD ref: `prd.md > Grabación y transcripción en vivo`
  Spec ref: `spec.md > Components` (Service Worker, Offscreen Document, Gemini Client), `spec.md > The Core Journey Through the System` (pasos 3-5), `spec.md > Important Failure Modes`
  Build: `src/background/service-worker.js` (lanzar `chrome.tabCapture`, crear offscreen, enrutar), `src/offscreen/*` (Whisper vía transformers.js, cortar en bloques, estado "cargando modelo…"), conectar el pulido de Gemini por bloque y renderizar la línea. Medir y registrar la latencia de un bloque end-to-end.
  Verify (mechanical): Grabar en una pestaña con audio; confirmar que aparece al menos una línea transcrita y pulida; medir el tiempo desde fin del bloque hasta que la línea aparece y anotarlo. Si es inaceptable, registrar revisión y aplicar plan B (whisper-tiny / bloques más cortos / pulido bajo demanda).
  Learner check: Pulsar Grabar en una pestaña con voz, ver aparecer una línea pulida, y decirme si el retraso te parece usable para una reunión.
  Commit: `Capture tab audio, transcribe with Whisper, polish with Gemini`

- [ ] **4. Identificar quién habla leyendo el DOM de Meet**
  Becomes usable: En una reunión real de Meet, cada línea aparece como `Nombre: frase`, usando el participante que Meet marca como "hablando". Sin dato → "Participante Indistinguible".
  Why now: Segundo riesgo del spec (selectores del DOM de Meet). Se construye sobre la transcripción ya funcionando.
  PRD ref: `prd.md > Grabación y transcripción en vivo` (nombre por línea)
  Spec ref: `spec.md > Components` (Content Script), `spec.md > Important Failure Modes`
  Build: `src/content/meet-speaker.js` (observar el DOM de Meet para el participante activo, reportar al service worker con marca de tiempo), cruzar con el bloque de audio, aplicar fallback.
  Verify (mechanical): En una reunión de Meet con otra persona (o dos pestañas), confirmar que las líneas llevan nombre cuando Meet lo marca y "Participante Indistinguible" cuando no.
  Learner check: Entrar a un Meet, grabar mientras alguien habla, y confirmar que las líneas muestran el nombre correcto la mayoría de las veces.
  Commit: `Attribute transcript lines to Meet speaker via DOM`

- [ ] **5. Chat con la IA sobre la reunión, con historial, durante la grabación**
  Becomes usable: Escribes una pregunta en la caja de abajo, se envía a Gemini con toda la transcripción disponible, y la respuesta se añade al chat sin borrar lo anterior. Funciona mientras sigues grabando. Sin IA configurada → modal "configura la IA primero". Fuera de Meet → aviso "solo en Google Meet".
  Why now: Es la otra mitad del kernel y cierra la demo (grabar → preguntar). Depende de la transcripción y de Gemini ya listos.
  PRD ref: `prd.md > Chat con la IA sobre la reunión`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > Components` (Gemini Client, Side Panel UI), `spec.md > The Core Journey Through the System` (paso 8)
  Build: Conectar la caja de chat al cliente de Gemini (`generateContent` con la transcripción como contexto), render de chat con historial, guardas de "sin IA" y "fuera de Meet".
  Verify (mechanical): Con transcripción presente, enviar una pregunta y confirmar que la respuesta refleja lo dicho y se encadena; enviar durante la grabación; probar sin IA (modal) y fuera de Meet (aviso).
  Learner check: Grabar una interacción, preguntarle a la IA sobre ella y confirmar que responde con base en lo transcrito, encadenando mensajes.
  Commit: `Add live AI chat about the meeting with history`

- [ ] **6. Tab Sobre (pantalla de acerca de)**
  Becomes usable: La tab Sobre muestra el icono al centro, título y versión, nombre, email, LinkedIn, GitHub y el link al repositorio.
  Why now: Pieza estática y barata, confirmada para la PoC; se deja al final por no ser parte del núcleo demostrable.
  PRD ref: `prd.md > Screens and Layout` (Historial y Sobre)
  Spec ref: `spec.md > Decisions and Open Issues` (Tab Sobre)
  Build: Vista estática en el side panel con los datos del autor y el link al repositorio.
  Verify (mechanical): Abrir la tab Sobre y confirmar que todos los campos y el link se muestran correctamente.
  Learner check: Abrir Sobre y confirmar que tus datos y el link al repo están bien.
  Commit: `Add About tab`

## Hands-on Checkpoints

- [ ] Early usable behavior explored — tras el slice 3 (medición de latencia Whisper + Gemini), donde tu feedback puede cambiar el resto del build (plan B).
- [ ] Final kick-the-tires exploration and feedback completed

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: [pendiente]
Route and stops: [pendiente]
Edit outcome: [pendiente]
Reflection: [pendiente]
Activity mode: [pendiente]

## Revisions
