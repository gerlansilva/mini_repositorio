let items = [];

const busca = document.querySelector("#busca");
const grid = document.querySelector("#livros");
const vazio = document.querySelector("#vazio");
const totalEl = document.querySelector("#total");

const normalizar = (texto) => String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
const escapeHtml = (text) => String(text ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[c]));

function displayCover(item) {
  if (item.capa) return `<img src="${escapeHtml(item.capa)}" alt="Capa de ${escapeHtml(item.titulo)}" loading="lazy">`;
  const sigla = String(item.tipo || "publicação").slice(0, 1).toUpperCase();
  return `<div class="fallback-cover"><span>${escapeHtml(sigla)}</span><strong>${escapeHtml(item.titulo)}</strong></div>`;
}

function displayUrl(item) {
  return item.pdf || item.urlExterna || (item.doi ? `https://doi.org/${String(item.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")}` : "");
}

function authorIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></svg>`;
}

function renderAuthors(item) {
  const autores = Array.isArray(item.autores) ? item.autores.filter(Boolean) : [];
  if (!autores.length) return "";
  return `<div class="author-list">${autores.map(autor => `<span class="author-line">${authorIcon()}<span>${escapeHtml(autor)}</span></span>`).join("")}</div>`;
}

function renderItems() {
  const termo = normalizar(busca.value.trim());
  const filtrados = items.filter(item => {
    const haystack = [item.titulo, ...(item.autores || []), item.periodico, item.doi].join(" ");
    return !termo || normalizar(haystack).includes(termo);
  });

  totalEl.textContent = filtrados.length;
  vazio.hidden = filtrados.length > 0;
  grid.innerHTML = filtrados.map(item => {
    const url = displayUrl(item);
    const content = `
      <div class="cover">${displayCover(item)}<span class="type-badge">${escapeHtml(item.tipo || "publicação")}</span></div>
      <div class="card-info">
        <strong class="document-title">${escapeHtml(item.titulo)}</strong>
        ${renderAuthors(item)}
        ${item.ano ? `<span class="card-year">${escapeHtml(item.ano)}</span>` : ""}
        ${item.periodico ? `<small class="source-line">${escapeHtml(item.periodico)}</small>` : ""}
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
  renderItems();
}

busca.addEventListener("input", renderItems);
loadCatalog();
