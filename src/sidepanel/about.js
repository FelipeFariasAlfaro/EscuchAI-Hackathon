// Tab Sobre: pantalla estática de acerca de.
// Implementa `prd.md > Screens and Layout` (Historial y Sobre).

import { t } from "../lib/i18n.js";

const LINKS = [
  { label: "farias3felipe@gmail.com", href: "mailto:farias3felipe@gmail.com" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/felipefariasalfaro/" },
  { label: "GitHub", href: "https://github.com/FelipeFariasAlfaro" },
];
const REPO = { label: "FelipeFariasAlfaro/EscuchAI", href: "https://github.com/FelipeFariasAlfaro/EscuchAI" };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function link({ label, href }, className = "about-field") {
  const a = el("a", className, label);
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  return a;
}

export function renderAbout(root) {
  root.textContent = "";

  const icon = el("img", "about-img");
  icon.src = "../../assets/icon.png";
  icon.alt = "";
  icon.width = 64;
  icon.height = 64;

  const dev = el("p", "about-field", t("about.devBy"));
  dev.appendChild(el("strong", null, "Felipe Farías A."));

  const links = el("div", "about-links");
  LINKS.forEach((l) => links.appendChild(link(l)));

  const oss = el("div", "about-oss");
  oss.appendChild(el("p", "about-field muted", t("about.oss")));
  oss.appendChild(link(REPO));

  const card = el("div", "about-card");
  card.append(
    icon,
    el("div", "about-title", "EscuchAI"),
    el("div", "about-version", `v${chrome.runtime.getManifest().version}`),
    dev,
    links,
    oss
  );
  root.appendChild(card);
}
