// Página visible de la extensión dedicada a obtener el permiso de micrófono.
// Ni el side panel ni el offscreen document pueden mostrar el diálogo de
// permisos; una pestaña normal sí. El permiso queda asociado al origen de la
// extensión, así que luego el offscreen lo hereda.

const state = document.getElementById("state");

async function request() {
  state.textContent = "Esperando tu confirmación…";
  state.className = "";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Solo interesaba el permiso: liberar el dispositivo de inmediato.
    stream.getTracks().forEach((t) => t.stop());
    state.textContent = "Listo. Vuelve a Meet y pulsa Iniciar grabación.";
    state.className = "ok";
    setTimeout(() => window.close(), 2000);
  } catch (err) {
    state.textContent = `No se concedió (${err?.name || err}). Puedes habilitarlo en el icono de la barra de direcciones.`;
    state.className = "err";
  }
}

document.getElementById("btn").addEventListener("click", request);
// Intento automático al abrir: si el permiso ya existe, se resuelve sin diálogo.
request();
