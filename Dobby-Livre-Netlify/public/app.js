const amostra = [
  { id: "amostra-1", titulo: "Educação estatística no curso de licenciatura em matemática", autores: ["Celi Espasandin Lopes"], ano: 2013, tags: ["Educação Estatística", "Formação de professores"] },
  { id: "amostra-2", titulo: "A educação estocástica na infância", autores: ["Celi Espasandin Lopes"], ano: 2012, tags: ["Infância", "Probabilidade"] },
  { id: "amostra-3", titulo: "Investigação estatística nas aulas de matemática", autores: ["Celi Espasandin Lopes"], ano: 2020, tags: ["Investigação estatística", "Ensino de Matemática"] },
];

let livros = amostra;
let tagAtiva = "";
const busca = document.querySelector("#busca");
const grid = document.querySelector("#livros");
const tagsEl = document.querySelector("#tags");
const vazio = document.querySelector("#vazio");
const normalizar = (texto) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
const escapeHtml = (text) => String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function renderTags() {
  const todas = [...new Set(livros.flatMap((l) => l.tags))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  tagsEl.innerHTML = ["", ...todas].map((tag) => `<button class="${tag === tagAtiva ? "active" : ""}" data-tag="${escapeHtml(tag)}">${tag || "Todos"}</button>`).join("");
  tagsEl.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => { tagAtiva = button.dataset.tag; renderTags(); renderLivros(); }));
}

function renderLivros() {
  const termo = normalizar(busca.value.trim());
  const filtrados = livros.filter((l) => (!termo || normalizar([l.titulo, l.autores.join(" "), l.tags.join(" ")].join(" ")).includes(termo)) && (!tagAtiva || l.tags.includes(tagAtiva)));
  vazio.hidden = filtrados.length > 0;
  grid.innerHTML = filtrados.map((l, index) => {
    const capa = l.capa ? `<img src="${escapeHtml(l.capa)}" alt="Capa de ${escapeHtml(l.titulo)}">` : `<div class="fallback-cover"><span>${escapeHtml(l.tags[0] || "Educação")}</span><strong>${escapeHtml(l.titulo)}</strong><small>${escapeHtml(l.autores.join("; "))}</small></div>`;
    const inner = `<div class="cover cover-${index % 3}">${capa}</div><div class="card-info"><strong>${escapeHtml(l.titulo)}</strong><span>${escapeHtml(l.autores.join("; "))}${l.ano ? ` · ${l.ano}` : ""}</span><div>${l.tags.slice(0, 2).map((t) => `<small>${escapeHtml(t)}</small>`).join("")}</div></div>`;
    return l.pdf ? `<a class="book-card" href="${escapeHtml(l.pdf)}" target="_blank" rel="noreferrer">${inner}</a>` : `<article class="book-card unavailable">${inner}</article>`;
  }).join("");
}

busca.addEventListener("input", renderLivros);
fetch("/api/livros").then((r) => r.ok ? r.json() : Promise.reject()).then((data) => { if (Array.isArray(data.livros) && data.livros.length) livros = data.livros; renderTags(); renderLivros(); }).catch(() => { renderTags(); renderLivros(); });
