let items = [];
let tagAtiva = "";

const busca = document.querySelector("#busca");
const grid = document.querySelector("#livros");
const tagsEl = document.querySelector("#tags");
const vazio = document.querySelector("#vazio");
const totalEl = document.querySelector("#total");

const normalizar = (texto) => String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
const escapeHtml = (text) => String(text ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[c]));

const tagPalette = [
  ["#fff3ea", "#f3c29e", "#9b4311"],
  ["#eef3f8", "#b9cad9", "#173e61"],
  ["#fff8e8", "#ead19a", "#765514"],
  ["#f1f2f3", "#d8dadd", "#4b5055"],
];

function tagStyle(tag) {
  const hash = [...normalizar(tag)].reduce((total, char) => ((total * 31) + char.charCodeAt(0)) >>> 0, 0);
  const [bg, border, text] = tagPalette[hash % tagPalette.length];
  return `--tag-bg:${bg};--tag-border:${border};--tag-text:${text}`;
}

function displayCover(item) {
  if (item.capa) return `<img src="${escapeHtml(item.capa)}" alt="Capa de ${escapeHtml(item.titulo)}" loading="lazy">`;
  const sigla = String(item.tipo || "publicação").slice(0, 1).toUpperCase();
  return `<div class="fallback-cover"><span>${escapeHtml(sigla)}</span><strong>${escapeHtml(item.titulo)}</strong></div>`;
}

function displayUrl(item) {
  return item.pdf || item.urlExterna || (item.doi ? `https://doi.org/${String(item.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")}` : "");
}

function renderTags() {
  const tags = [...new Set(items.flatMap(item => Array.isArray(item.tags) ? item.tags : []))].sort((a,b) => a.localeCompare(b, "pt-BR"));
  tagsEl.innerHTML = ["", ...tags].map(tag => `
    <button class="tag-button${tag === tagAtiva ? " active" : ""}${tag ? " colored" : ""}" ${tag ? `style="${tagStyle(tag)}"` : ""} data-tag="${escapeHtml(tag)}">
      ${tag || "Todas"}
    </button>`).join("");
  tagsEl.querySelectorAll("button").forEach(button => button.addEventListener("click", () => {
    tagAtiva = button.dataset.tag;
    renderTags();
    renderItems();
  }));
}

function renderItems() {
  const termo = normalizar(busca.value.trim());
  const filtrados = items.filter(item => {
    const haystack = [item.titulo, ...(item.autores || []), item.periodico, item.doi, ...(item.tags || [])].join(" ");
    return (!termo || normalizar(haystack).includes(termo)) && (!tagAtiva || (item.tags || []).includes(tagAtiva));
  });
  totalEl.textContent = filtrados.length;
  vazio.hidden = filtrados.length > 0;
  grid.innerHTML = filtrados.map(item => {
    const url = displayUrl(item);
    const content = `
      <div class="cover">${displayCover(item)}<span class="type-badge">${escapeHtml(item.tipo || "publicação")}</span></div>
      <div class="card-info">
        <strong>${escapeHtml(item.titulo)}</strong>
        <span>${escapeHtml((item.autores || []).join("; "))}${item.ano ? ` · ${item.ano}` : ""}</span>
        ${item.periodico ? `<small class="source-line">${escapeHtml(item.periodico)}</small>` : ""}
        <div class="card-tags">${(item.tags || []).slice(0,3).map(tag => `<small style="${tagStyle(tag)}">${escapeHtml(tag)}</small>`).join("")}</div>
      </div>`;
    return url ? `<a class="book-card" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${content}</a>` : `<article class="book-card unavailable">${content}</article>`;
  }).join("");
}

async function loadCatalog() {
  try {
    const res = await fetch(`/data/catalogo.json?v=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error();
    const data = await res.json();
    items = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : [];
  } catch {
    items = [];
  }
  renderTags();
  renderItems();
}

busca.addEventListener("input", renderItems);
loadCatalog();
