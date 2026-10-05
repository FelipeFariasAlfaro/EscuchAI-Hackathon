---
doc: prd
status: approved
---

# EscuchAI — Requisitos del Producto

Extensión de Chrome que transcribe una reunión de Google Meet en vivo y permite preguntarle a Gemini sobre lo que se dice, mientras ocurre. Para el propio autor, en reuniones de trabajo y estudio.
Fuente: `scope.md > The Unique Kernel`, `scope.md > The Core Loop`.

## The Core Journey
Desarrolla `scope.md > The Core Loop` y `scope.md > What "Working" Looks Like`.

1. El usuario está en una reunión de Google Meet y abre el panel de EscuchAI.
2. Ve la tab **Reunión** activa, con el botón **Iniciar grabación**, las sub-tabs (Transcripción activa) y el área de transcripción con el texto "La transcripción aparecerá aquí al iniciar la grabación."
3. Pulsa **Iniciar grabación**. El botón pasa a rojo con el texto **"Grabando"** y un punto rojo.
4. A medida que la gente habla, aparecen líneas de transcripción en vivo, cada una con el nombre de quien habla: `Nombre: frase`.
5. El usuario escribe una pregunta en la caja de chat de abajo (por ejemplo "resume lo que dijo Pepito sobre el sistema X") y la envía.
6. La IA (Gemini) recibe toda la transcripción disponible hasta ese momento y responde. La respuesta se añade al chat, que conserva el historial.
7. El usuario puede seguir preguntando mientras la grabación sigue activa, usando lo que haya transcrito hasta cada momento.
8. **Éxito:** el usuario ve texto en vivo con nombres y obtiene respuestas de la IA basadas en lo dicho, sin esperar a una transcripción posterior. Demostrable en un minuto en pantalla.

## Screens and Layout
Cuatro tabs principales en la cabecera, junto al icono de micrófono y el nombre "EscuchAI": **Reunión**, **Historial**, **Ajustes**, **Sobre**.

### Reunión (única tab funcional en la PoC)
- Arriba: botón **Iniciar grabación** / **Grabando** (con punto que pasa a rojo al grabar).
- Sub-tabs: **Transcripción** (funcional), **Tareas**, **Conflictos**, **Participación**, **Alertas** (visibles pero deshabilitadas / "Próximamente").
- Centro: área de transcripción en vivo. Placeholder antes de grabar.
- Abajo (fila de acciones): **Resumir**, **Copiar**, **TXT**, **MD** (activadas en la PoC por decisión en la revisión final; ver `checklist.md > Revisions`). Copiar/TXT/MD son locales y exportan solo la transcripción; Resumir usa Gemini y muestra el resumen en el flujo.
- Pie: caja de **chat con la IA** con placeholder y botón de enviar.

### Ajustes
Flujo de configuración de IA. En la PoC solo **Gemini**: elegir proveedor, ingresar API key, **validar**, obtener modelos disponibles, elegir modelo, **guardar**.

### Historial y Sobre
Visibles como tabs. Historial queda diferido (ver más abajo). **Sobre** entra en la PoC: pantalla estática con el icono de la app al centro, título y versión, nombre, email, LinkedIn, GitHub y link al repositorio.

## Look and Feel
Tomado del mock aportado por el usuario:
- Tema **oscuro** (fondo azul-grisáceo oscuro).
- Color de **acento turquesa / cian** para botones y elementos activos.
- Botón de grabación: estado normal en acento claro; estado activo en **rojo** con texto "Grabando".
- Tipografía **sans-serif** limpia; texto de placeholder en itálica y color atenuado.
- Layout de panel vertical angosto (panel lateral de extensión).
- Tabs con subrayado en la activa.

## Features and Behavior

### Grabación y transcripción en vivo
Desarrolla `scope.md > The Core Loop`.
- El usuario inicia y detiene la grabación con el botón superior.
- Al grabar, el botón muestra "Grabando" en rojo con punto rojo.
- El audio de la pestaña de Meet se transcribe en el equipo del usuario (ES e inglés).
- Cada frase se muestra como una línea `Nombre: frase`.
- El nombre de quien habla se obtiene leyendo el DOM de Meet (indicador de participante activo) y se cruza con el momento de la transcripción. La atribución es **aproximada** y se acepta como suficiente para la PoC.
- Si no se puede determinar el hablante en ese momento, la línea se atribuye a **"Participante Indistinguible"**.

Acceptance criteria:
- [ ] Al pulsar Iniciar grabación, el botón cambia a rojo con "Grabando".
- [ ] Mientras alguien habla, aparecen líneas de texto nuevas con el formato `Nombre: frase`.
- [ ] Cuando no hay nombre disponible, la línea usa "Participante Indistinguible".
- [ ] La transcripción funciona con audio en español e inglés.

### Chat con la IA sobre la reunión
Desarrolla `scope.md > The Unique Kernel`.
- El usuario escribe una pregunta y la envía.
- La IA recibe **toda la transcripción disponible** hasta ese momento como contexto.
- Se puede preguntar **mientras sigue grabando**, usando lo transcrito hasta entonces.
- El chat conserva **historial**: los mensajes nuevos se añaden sin borrar los anteriores.
- Proveedor en la PoC: **Gemini**.

Acceptance criteria:
- [ ] Enviar una pregunta añade la pregunta y la respuesta al chat sin borrar mensajes previos.
- [ ] La respuesta refleja contenido de la transcripción (p. ej. preguntar por lo que dijo una persona concreta).
- [ ] Se puede enviar una pregunta durante la grabación.

### Configuración de IA (Ajustes)
Desarrolla `scope.md > The POC Boundary`.
- Flujo: elegir Gemini → ingresar API key → validar → cargar modelos disponibles → elegir modelo → guardar.
- La API key y la configuración se guardan en **local storage** y persisten entre sesiones.

Acceptance criteria:
- [ ] Con una API key válida, al validar se cargan los modelos y se puede elegir y guardar.
- [ ] Con una API key inválida, aparece un **modal** avisando del error.
- [ ] Tras guardar y reabrir el navegador, la configuración sigue presente.

## States and Boundaries
- **Primer uso / sin configurar IA** — Al intentar usar el chat sin Gemini configurado, aparece un **modal/advertencia** indicando que primero hay que configurar la IA en Ajustes.
- **Antes de grabar** — El área de transcripción muestra "La transcripción aparecerá aquí al iniciar la grabación."
- **Fuera de Google Meet** — Al intentar grabar en una pestaña que no es Meet, se indica que la función **solo está disponible en Google Meet**.
- **API key inválida** — Modal de error en Ajustes.
- **Hablante indeterminado** — La línea se atribuye a "Participante Indistinguible".
- **Persistencia** — La configuración de IA (proveedor, API key, modelo) persiste en local storage. Nada se guarda en la nube.
- **Sub-tabs y acciones diferidas** — Tareas, Conflictos, Participación, Alertas, Resumir, Copiar, TXT, MD se muestran deshabilitadas o con "Próximamente".

## Product Decisions
- **Mostrar la UI completa, construir solo el núcleo** — las sub-tabs y botones diferidos aparecen deshabilitados para que la demo muestre la visión completa sin construirla.
- **Atribución de hablante por DOM de Meet, aproximada** — es la única vía realista en una extensión; se acepta imprecisión en la PoC.
- **"Participante Indistinguible"** como etiqueta cuando no hay nombre disponible.
- **Chat con historial** y contexto = transcripción completa disponible, consultable durante la grabación.
- **Config en local storage**, persistente, sin nube.
- **Solo Google Meet y solo Gemini** en la PoC.
- La tab **Sobre** entra en la PoC (confirmado): pantalla estática de acerca de.

## What We're Building
- Tab Reunión con botón Grabar/Grabando.
- Transcripción en vivo (ES/EN) con nombre de hablante por línea y "Participante Indistinguible" como respaldo.
- Chat con Gemini sobre la transcripción, con historial, consultable durante la grabación.
- Ajustes con el flujo completo de Gemini (validar key, cargar modelos, guardar), persistido en local storage.
- Estados: sin configurar, antes de grabar, fuera de Meet, key inválida.
- Sub-tabs y botones diferidos visibles pero deshabilitados.

## Deferred From the POC
- Sub-tabs **Tareas**, **Conflictos**, **Participación**, **Alertas** — valiosas, pero no prueban el núcleo; se muestran deshabilitadas.
- **Resumir**, **Copiar**, **Exportar TXT/MD** — fuera del núcleo demostrable.
- **Historial** (buscar por título/fecha, modal al abrir, borrar con confirmación) — requiere persistir grabaciones; diferido.
- Proveedores **OpenAI, Claude, Ollama** — solo Gemini en la PoC.
- **Teams, Skype, Discord** — solo Meet en la PoC.
- Tab **Sobre** — se incluye si sobra tiempo.

## Possible Later Enhancements
- Análisis en vivo (tareas, conflictos, participación, alertas por diccionario de palabras).
- Exportación y resumen de transcripciones.
- Historial local navegable y buscable.
- Soporte multi-proveedor y multiplataforma de reuniones.

## Non-Goals
- No se guardan transcripciones ni datos en la nube ni en bases de datos externas.
- No se busca atribución de hablante perfecta.
- No se soportan otras plataformas de reunión en esta PoC.

## Open Questions
- **Motor de transcripción local y captura del audio de la pestaña** — cómo se implementa (Web Speech API, modelo local, etc.) se decide en `4-spec`. Es la restricción técnica clave que el usuario quiere resolver antes de escribir código. **Debe resolverse en `4-spec`.**
- **Lectura del DOM de Meet para el hablante** — viabilidad concreta y selectores; se valida en `4-spec`.
- **Inclusión de la tab Sobre** — puede decidirse durante el build.
