// Service worker (coordinador). Slice 1: abrir el side panel al pulsar el icono.
// La captura de audio y el enrutamiento se agregan en el slice 3.
// Implementa `spec.md > Components` (Service Worker).

chrome.runtime.onInstalled.addListener(() => {
  // Permite que el icono de la barra abra el side panel.
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((err) => console.warn("No se pudo configurar el side panel:", err));
  }
});
