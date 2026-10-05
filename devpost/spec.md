---
doc: spec
status: approved
---

# EscuchAI — Spec Técnico

## How This Works, In Plain Language
EscuchAI es una extensión de Chrome (Manifest V3) que vive en el **side panel** del navegador. Cuando estás en una pestaña de Google Meet y pulsas Grabar, la extensión toma el audio de esa pestaña y lo convierte en texto en tu propio equipo, sin enviar el audio a ningún servidor. Luego cada bloque de texto se manda a Gemini solo para pulirlo (puntuación, mayúsculas, correcciones) y se muestra como una línea con el nombre de quien habló. Abajo tienes un chat donde le preguntas a Gemini sobre lo dicho, con toda la transcripción disponible como contexto.

La extensión tiene cuatro piezas, porque Manifest V3 obliga a repartir el trabajo:

- **Side panel** — la interfaz (tus tabs y sub-tabs del mock). Es lo que ves y con lo que interactúas.
- **Service worker** — el coordinador. Arranca la captura de audio de la pestaña y pasa mensajes entre las piezas. En MV3 no puede correr código pesado ni usar APIs de audio por mucho tiempo, por eso delega.
- **Offscreen document** — una página oculta donde corre Whisper (el modelo de transcripción) sobre el audio capturado. MV3 no permite hacer esto en el service worker, así que se usa este documento.
- **Content script** — se inyecta en la página de Meet y lee el DOM para saber quién está hablando en cada momento.

El audio nunca sale de tu equipo. Lo único que viaja a Gemini es texto: los bloques a pulir y tus preguntas del chat. La configuración (proveedor, API key, modelo) se guarda en el almacenamiento local de la extensión.

## The Core Journey Through the System
Implementa `prd.md > The Core Journey`.

1. Abres el side panel en una pestaña de Meet. El panel pregunta al service worker si hay IA configurada.
2. Pulsas **Iniciar grabación**. Si no hay Gemini configurado → modal "configura la IA primero". Si la pestaña no es Meet → aviso "solo disponible en Google Meet".
3. El service worker llama a `chrome.tabCapture` para obtener el stream de audio de la pestaña y lo entrega al **offscreen document**.
4. El offscreen document corta el audio en bloques y los pasa por **Whisper (transformers.js)** → texto crudo del bloque.
5. Ese texto crudo se envía a **Gemini** (endpoint `generateContent`) para pulirlo → texto final del bloque.
6. En paralelo, el **content script** en Meet reporta quién tenía el indicador de "hablando" durante ese bloque. Si no hay dato → "Participante Indistinguible".
7. El side panel muestra la línea `Nombre: frase pulida`. El botón está en estado rojo "Grabando".
8. Escribes una pregunta en el chat → se envía a Gemini junto con toda la transcripción acumulada → la respuesta se añade al chat (con historial).
9. **Éxito:** líneas en vivo con nombre + respuestas de IA basadas en lo dicho.

## Stack
- **Manifest V3 Chrome Extension** (JavaScript). Docs: https://developer.chrome.com/docs/extensions/develop
- **`chrome.tabCapture`** para el audio de la pestaña. Docs: https://developer.chrome.com/docs/extensions/reference/api/tabCapture
- **`chrome.offscreen`** para correr Whisper fuera del service worker. Docs: https://developer.chrome.com/docs/extensions/reference/api/offscreen
- **`chrome.sidePanel`** para la UI. Docs: https://developer.chrome.com/docs/extensions/reference/api/sidePanel
- **transformers.js (Hugging Face)** con un modelo Whisper (p. ej. `Xenova/whisper-base` o `whisper-tiny` para menos peso/latencia). WebGPU si está disponible, con respaldo WASM. Docs: https://huggingface.co/docs/transformers.js · WebGPU: https://huggingface.co/docs/transformers.js/guides/webgpu · Referencia: https://github.com/xenova/whisper-web
- **Gemini API** (`v1beta`), llamada REST directa con la API key del usuario. Docs: https://ai.google.dev/api/models · https://ai.google.dev/gemini-api/docs
- **Sin framework de UI**: HTML/CSS/JS plano, acorde al mock. Mantiene el build pequeño.

Rationale de las decisiones del usuario:
- **Whisper local + pulido con Gemini por bloque**: cumple "audio en el equipo" (Whisper es local) y mejora la calidad del texto. Tradeoff aceptado: latencia por línea = Whisper + ida/vuelta a Gemini, y muchas llamadas a Gemini durante la grabación (posibles rate limits del plan gratuito).
- **IA obligatoria para grabar**: como el pulido pasa por Gemini, no tiene sentido grabar sin IA configurada.

Sin verificar en vivo, a confirmar temprano en el build: versión exacta de transformers.js y el modelo Whisper que mejor equilibra latencia/calidad; comportamiento de `tabCapture` + offscreen en la versión de Chrome del usuario.

## Where It Runs and How Someone Tries It
- **Runtime:** Chrome de escritorio (idealmente con WebGPU; WASM como respaldo). Requiere una API key de Gemini.
- **Instalación:** `chrome://extensions` → activar modo desarrollador → "Cargar descomprimida" → seleccionar la carpeta del proyecto.
- **Uso / grabación de la demo:** abrir una reunión de Google Meet, abrir el side panel de EscuchAI, ir a Ajustes y configurar Gemini (key → validar → elegir modelo → guardar), volver a Reunión, pulsar Iniciar grabación, hablar, ver las líneas aparecer, y hacerle una pregunta a la IA.
- **Despliegue:** no aplica. El entregable es el video de demo + el repositorio público en GitHub. La extensión corre en local.

## Look and Feel
Carga desde `prd.md > Look and Feel` (basado en el mock del usuario):
- Tema oscuro, fondo azul-grisáceo (~`#1a2130` / `#0f1420`).
- Acento turquesa/cian (~`#39c0c8`) para botones y la tab/sub-tab activa.
- Botón de grabación: estado normal en acento; estado activo en **rojo** con punto rojo y texto "Grabando".
- Tipografía sans-serif del sistema; placeholders en itálica atenuada.
- Panel vertical angosto; tab activa subrayada.
- CSS plano, sin framework.

## Components

### Side Panel UI
La interfaz: tabs (Reunión, Historial, Ajustes, Sobre), sub-tabs de Reunión, área de transcripción, fila de acciones (deshabilitadas) y caja de chat. Las sub-tabs Tareas/Conflictos/Participación/Alertas y los botones Resumir/Copiar/TXT/MD se renderizan deshabilitados ("Próximamente").
PRD ref: `prd.md > Screens and Layout`, `prd.md > Grabación y transcripción en vivo`, `prd.md > Chat con la IA sobre la reunión`.

### Service Worker (coordinador)
Escucha el botón Grabar, verifica que la pestaña sea Meet y que haya IA configurada, lanza `chrome.tabCapture`, crea el offscreen document y enruta mensajes entre side panel ↔ offscreen ↔ content script.
PRD ref: `prd.md > Grabación y transcripción en vivo`, `prd.md > States and Boundaries`.

### Offscreen Document (transcripción)
Recibe el stream de audio, lo corta en bloques, corre Whisper (transformers.js) sobre cada bloque y devuelve el texto crudo. Carga el modelo una vez (descarga inicial, luego caché).
PRD ref: `prd.md > Grabación y transcripción en vivo`.

### Content Script (hablante en Meet)
Inyectado en `meet.google.com`. Observa el DOM para detectar el participante con indicador de "hablando" y lo reporta con marca de tiempo. Mejor esfuerzo; fallback "Participante Indistinguible".
PRD ref: `prd.md > Grabación y transcripción en vivo` (nombre por línea).

### Gemini Client
Módulo compartido con dos usos: (a) pulir cada bloque de texto, (b) responder el chat con la transcripción como contexto. También valida la key y lista modelos en Ajustes.
PRD ref: `prd.md > Chat con la IA sobre la reunión`, `prd.md > Configuración de IA (Ajustes)`.

### Settings / Storage
Flujo de Ajustes (proveedor → key → validar → modelos → elegir → guardar) y persistencia en `chrome.storage.local`.
PRD ref: `prd.md > Configuración de IA (Ajustes)`, `prd.md > States and Boundaries` (persistencia).

## Data Model
Datos en `chrome.storage.local` (persisten entre sesiones, nunca en la nube):
```
aiConfig = {
  provider: "gemini",
  apiKey: "<string>",
  model: "<modelId elegido>"
}
```
Datos en memoria durante la sesión (se pierden al cerrar; no se persisten transcripciones en la PoC):
```
transcript = [ { speaker: "Nombre" | "Participante Indistinguible", text: "...", ts } ]
chatHistory = [ { role: "user" | "model", text: "..." } ]
```
- **aiConfig**: se escribe al guardar en Ajustes; se lee al abrir el panel y antes de grabar.
- **transcript / chatHistory**: viven mientras el panel esté abierto. (El historial persistente es "Después".)

## File Structure
```
escuchai-2/
├── manifest.json              # MV3: permisos (tabCapture, offscreen, sidePanel, storage), host meet.google.com
├── src/
│   ├── sidepanel/
│   │   ├── sidepanel.html      # UI del mock
│   │   ├── sidepanel.css       # tema oscuro + acento turquesa
│   │   └── sidepanel.js        # tabs, render de transcripción, chat
│   ├── background/
│   │   └── service-worker.js   # coordinador, tabCapture, routing de mensajes
│   ├── offscreen/
│   │   ├── offscreen.html
│   │   └── offscreen.js        # Whisper (transformers.js), bloques de audio
│   ├── content/
│   │   └── meet-speaker.js      # lee el DOM de Meet, reporta hablante
│   └── lib/
│       ├── gemini.js            # validar key, listar modelos, pulir, chat
│       └── storage.js           # wrapper de chrome.storage.local
├── vendor/
│   └── transformers.min.js      # transformers.js (o import vía CDN con fallback)
├── assets/
│   └── icon.png
├── devpost/                     # workspace de planificación
└── README.md
```

## External Services and Dependencies

### Gemini API
- **Validar key + listar modelos:** `GET https://generativelanguage.googleapis.com/v1beta/models` con header `x-goog-api-key: <API_KEY>`. Respuesta: lista de modelos con `name`, límites y capacidades. Éxito ⇒ key válida; error 400/403 ⇒ key inválida (modal). Docs: https://ai.google.dev/api/models
- **Pulir bloque y chat:** `POST https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent` con `x-goog-api-key` y cuerpo `{ contents: [...] }`. Docs: https://ai.google.dev/gemini-api/docs
- **Key:** la provee el usuario. **Rate limits:** el plan gratuito tiene límites por minuto; el pulido por bloque puede acercarse a ellos. **Coste:** gratuito dentro de la cuota.

### transformers.js (Whisper)
- Librería cliente, sin servicio externo. Descarga el modelo Whisper (cientos de MB) la primera vez desde Hugging Face Hub; luego queda en caché del navegador. Docs: https://huggingface.co/docs/transformers.js

## Important Failure Modes
- **Selectores del DOM de Meet cambian / no detecta hablante** → la línea usa "Participante Indistinguible". Validar temprano en el build.
- **Gemini lento o rate-limited al pulir** → mostrar la línea en estado "puliendo…" y, si falla, caer al texto crudo de Whisper para no perder la frase. (Mínimo: mensaje de error visible.)
- **El modelo Whisper tarda en descargar/cargar** → mostrar estado "cargando modelo…" al iniciar la grabación la primera vez.
- **API key inválida** → modal de error en Ajustes.
- **WebGPU no disponible** → transformers.js cae a WASM (más lento). Validar en el equipo del usuario.

## What Was Simplified and Why
- **Sin persistencia de transcripciones** (viven en memoria) en vez de un historial local navegable — el Historial es "Después" en el PRD. La versión completa requeriría guardar y buscar grabaciones.
- **Solo Gemini y solo Meet** — un proveedor y una plataforma para que el build quepa en la PoC. Los demás proveedores y plataformas son "Después".
- **UI sin framework** — HTML/CSS/JS plano, suficiente para el mock y más rápido de construir.

## Decisions and Open Issues
Decisiones del usuario:
- **Whisper local + pulido con Gemini por bloque** (no diferido). Tradeoff aceptado: mayor latencia por línea y más llamadas a Gemini.
- **IA configurada obligatoria para grabar.**
- **Nombre del hablante por DOM de Meet, mejor esfuerzo, con fallback.**
- **Reparto en 4 piezas** (side panel, service worker, offscreen, content script).

Incertidumbre genuina del usuario (su objetivo de aprendizaje = que las restricciones técnicas salgan en el spec, no en el código): **si Whisper-WASM en el navegador puede dar un "en vivo" aceptable encadenado con el pulido de Gemini.** Cómo se verifica: en el primer paso del build se mide la latencia real de un bloque end-to-end; si es demasiado alta, el plan B registrado es usar `whisper-tiny`, bloques más cortos, o diferir el pulido a bajo demanda.

Abierto para el build:
- Confirmar selectores reales del DOM de Meet para el hablante.
- Elegir modelo Whisper concreto según latencia/calidad medidas.
- **Tab Sobre:** entra en la PoC (confirmado por el usuario). Pantalla estática: icono, título, versión, nombre, email, LinkedIn, GitHub, link al repositorio.
