# EscuchAI

Extensión de Chrome que transcribe una reunión de **Google Meet** en vivo y te permite preguntarle a una IA sobre lo que se dice, mientras ocurre.

El audio se transcribe **en tu propio equipo** con Whisper (ejecutado en el navegador vía [transformers.js](https://huggingface.co/docs/transformers.js)). A la IA solo viaja **texto**: el pulido de cada línea, el resumen y las preguntas del chat. No se usan bases de datos ni almacenamiento en la nube; la configuración vive solo en tu navegador.

## Qué hace

- **Transcripción en vivo** del audio de la pestaña de Meet, en español e inglés.
- **Identifica quién habla**: cada línea aparece como `Nombre: frase`. Tu propia voz se marca como `Tú`; si no se puede determinar el hablante, se usa `Participante Indistinguible`.
- **Chat con la IA** sobre la reunión, con historial, usando toda la transcripción disponible como contexto. Funciona mientras sigues grabando.
- **Resumir** la reunión con la IA.
- **Copiar** la transcripción y **exportarla** como TXT o Markdown.

## Requisitos

- Google Chrome de escritorio (idealmente con WebGPU; si no, usa WebAssembly, más lento).
- Una **API key de Google Gemini**. Puedes obtenerla en [Google AI Studio](https://aistudio.google.com/apikey).
- Conexión a internet la primera vez (para descargar el modelo Whisper, que luego queda en caché, y para las llamadas a la IA).

## Instalación

1. Descarga o clona este repositorio:
   ```bash
   git clone https://github.com/FelipeFariasAlfaro/EscuchAI-Hackathon.git
   ```
2. Abre Chrome y ve a `chrome://extensions`.
3. Activa el **Modo de desarrollador** (interruptor arriba a la derecha).
4. Pulsa **Cargar descomprimida** y selecciona la carpeta del proyecto (la que contiene `manifest.json`).
5. El icono de EscuchAI (una oreja) aparecerá en la barra de extensiones. Puedes fijarlo con el icono de puzzle para tenerlo a mano.

## Configurar la IA (Gemini)

1. Haz clic en el icono de EscuchAI para abrir el panel lateral.
2. Ve a la pestaña **Ajustes**.
3. Elige **Gemini** como proveedor y pega tu API key.
4. Pulsa **Validar**: se cargará la lista de modelos disponibles para tu key. Si la key es inválida, verás un aviso.
5. Elige un modelo y pulsa **Guardar**. La configuración queda guardada localmente y persiste entre sesiones.

> La API key se guarda solo en el almacenamiento local de tu navegador (`chrome.storage.local`). No se sube a ningún servidor ni se incluye en el repositorio.

## Uso

1. Entra a una reunión de **Google Meet** (`https://meet.google.com/...`).
2. Con esa pestaña activa, **haz clic en el icono de EscuchAI** para abrir el panel lateral.
   - Este clic es importante: Chrome solo permite capturar el audio de la pestaña si "invocas" la extensión sobre ella desde el icono.
3. Pulsa **Iniciar grabación**. El botón se pone rojo con el texto "Grabando".
   - La primera vez, el modelo de transcripción se descarga (unos cientos de MB) y puede tardar un momento. Verás el progreso en el panel.
4. A medida que se habla en la reunión, aparecen las líneas de transcripción en vivo.
5. Escribe una pregunta en la caja de abajo para consultarle a la IA sobre la reunión. Puedes usar **Resumir**, **Copiar** y exportar en **TXT/MD**.

### Permiso de micrófono (opcional)

El micrófono sirve solo para transcribir **tu propia voz** (etiquetada como `Tú`). La voz de los demás participantes llega por el audio de la pestaña y **no** necesita el micrófono.

- La grabación **arranca igual sin micrófono**: en ese caso solo no se transcribe tu voz.
- Si quieres incluir tu voz, EscuchAI te ofrecerá, una sola vez, abrir una pestaña para conceder el permiso. Pulsa **Permitir micrófono** y acepta el diálogo de Chrome. Luego vuelve a Meet y graba.
- Si lo bloqueaste por error, puedes rehabilitarlo desde el icono de permisos en la barra de direcciones de Chrome.

## Privacidad

- El audio de la reunión se captura y transcribe **localmente**; el audio nunca sale de tu equipo.
- Lo único que se envía a la IA (Gemini) es **texto**: líneas a pulir, el resumen y tus preguntas del chat.
- No hay bases de datos ni almacenamiento en la nube. La configuración se guarda solo en tu navegador.

## Cómo está construido

Extensión Manifest V3 con cuatro piezas:

- **Side panel** (`src/sidepanel/`): la interfaz.
- **Service worker** (`src/background/`): coordina la captura y el paso de mensajes.
- **Offscreen document** (`src/offscreen/`): ejecuta Whisper sobre el audio capturado.
- **Content script** (`src/content/`): lee el DOM de Meet para identificar al hablante.

La planificación del proyecto (scope, PRD, spec, checklist y un mapa de la app) está en la carpeta [`devpost/`](devpost/).

## Limitaciones

- Solo Google Meet por ahora.
- Solo el proveedor Gemini por ahora (OpenAI, Claude y Ollama quedan como trabajo futuro).
- La identificación del hablante es de "mejor esfuerzo": depende del DOM de Meet y puede fallar en algunos casos.
