---
doc: scope
status: approved
---

# EscuchAI

Extensión de Chrome que transcribe una reunión en vivo desde el audio de la pestaña, lo muestra en un panel lateral y permite preguntarle a una IA sobre la reunión mientras ocurre.

## The Unique Kernel
La sección de **Transcripción** es el núcleo: texto de la reunión en vivo, con el menor retraso posible, sobre el que puedes **interactuar con la IA en tiempo real**, sin esperar a una transcripción que llega tarde.

## Who It's For
Para el propio autor, en reuniones de trabajo y estudio. Las reuniones suelen ser en español; para el hackathon también en inglés. Hoy las transcripciones le llegan muy tarde y no puede trabajar con lo que se dice mientras la reunión sigue.

## The Core Loop
Abre la vista de Transcripción durante una reunión, pulsa Grabar (el botón pasa a rojo con el texto "Grabando"), ve el texto aparecer en vivo y le hace preguntas a la IA sobre lo que se está diciendo.

## Inspiration & Identity
No establecido. Se define en el PRD. (Dirección volunteered: la tab "Mis datos" es una pantalla de acerca de, con el icono de la app al centro.)

## Why This Matters to the Learner
"Las transcripciones llegan muy tarde y no puedo interactuar con el conocimiento generado en la reunión mientras ocurre." Además, el audio y la transcripción se procesan en su equipo, por seguridad.

## What "Working" Looks Like
Demo de un minuto: abre la vista de Transcripción en una reunión de **Google Meet**, graba una interacción básica, ve el texto aparecer en vivo, y le hace preguntas a la IA (**Gemini**) sobre esa interacción y recibe respuestas basadas en lo dicho.

## The POC Boundary
- Solo Google Meet.
- Botón Grabar/Grabando y transcripción en vivo (español e inglés).
- Chat con la IA sobre la reunión, con Gemini.
- Configuración mínima de Gemini para que el chat funcione (API key, validar, elegir modelo, guardar).
- Identificar quién habla, leyendo el DOM de Meet: **pendiente, se resuelve en `3-prd` / `4-spec`** (decidir si entra en la prueba de concepto o pasa a "Después", según la viabilidad técnica).
- Todo se guarda solo localmente en el navegador. Lo único que sale del equipo es el texto que se envía a la IA.

## Later
- Sub-tabs Tareas, Conflictos, Participación (% por participante) y Alertas (palabras configurables, quién y en qué minuto).
- Resumen, copiar y exportar TXT/MD.
- Tab Historial: buscar por título o fecha, modal al abrir, borrar con confirmación.
- Proveedores OpenAI, Claude y Ollama (local).
- Tab Mis datos: icono, título, versión, nombre, email, LinkedIn, GitHub y repositorio.
- Teams, Skype y Discord.

## Explicitly Cut
Nada por ahora. Todo lo mencionado queda en "Later".
