let items = [];

const busca = document.querySelector('#busca');
const searchForm = document.querySelector('#search-form');
const grid = document.querySelector('#livros');
const vazio = document.querySelector('#vazio');
const totalEl = document.querySelector('#total');
const supportDialog = document.querySelector('#support-dialog');

const normalizar = (texto) => String(texto || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR');

const escapeHtml = (text) => String(text ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
}[c]));

function displayCover(item) {
  if (item.capa) return `<img src="${escapeHtml(item.capa)}" alt="Capa de ${escapeHtml(item.titulo)}" loading="lazy">`;
  return `<div class="fallback-cover"><span>PDF</span><strong>${escapeHtml(item.titulo)}</strong></div>`;
}

function driveId(item) {
  if (item?.storage?.pdfFileId) return item.storage.pdfFileId;
  const match = String(item.pdf || '').match(/\/d\/([^/]+)/);
  return match?.[1] || '';
}

function readUrl(item) {
  return item.pdf || item.urlExterna || (item.doi
    ? `https://doi.org/${String(item.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')}`
    : '');
}

function downloadUrl(item) {
  const id = driveId(item);
  return id ? `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}` : readUrl(item);
}

function personIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></svg>`;
}

function pdfIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5"/><path d="M9 13h6M9 17h4"/></svg>`;
}

function renderAuthors(item) {
  const autores = Array.isArray(item.autores) ? item.autores.filter(Boolean) : [];
  if (!autores.length) return '';
  return `<div class="author-list">${autores.map(autor => `<span class="author-line">${personIcon()}<span>${escapeHtml(autor)}</span></span>`).join('')}</div>`;
}

function track(event, id = '') {
  fetch('/api/stats', {
    method: 'POST',
    headers: {'content-type':'application/json'},
    body: JSON.stringify({event, id}),
    keepalive: true,
    credentials: 'same-origin'
  }).catch(() => {});
}

function renderItems() {
  const termo = normalizar(busca.value.trim());
  const filtrados = items.filter(item => {
    const haystack = [item.titulo, ...(item.autores || []), item.periodico, item.doi, ...(item.tags || [])].join(' ');
    return !termo || normalizar(haystack).includes(termo);
  });

  totalEl.textContent = filtrados.length;
  vazio.hidden = filtrados.length > 0;

  grid.innerHTML = filtrados.map(item => {
    const open = readUrl(item);
    const down = downloadUrl(item);
    return `
      <article class="book-card" data-id="${escapeHtml(item.id)}">
        <a class="book-main" href="${escapeHtml(open || '#')}" ${open ? 'target="_blank" rel="noopener noreferrer"' : ''} data-read="${escapeHtml(item.id)}">
          <div class="cover">${displayCover(item)}</div>
          <div class="card-info">
            <strong class="document-title">${escapeHtml(item.titulo)}</strong>
            ${renderAuthors(item)}
            ${item.ano ? `<span class="card-year">${escapeHtml(item.ano)}</span>` : ''}
            ${item.periodico ? `<small class="source-line">${escapeHtml(item.periodico)}</small>` : ''}
          </div>
        </a>
        <a class="download-link" href="${escapeHtml(down || '#')}" ${down ? 'target="_blank" rel="noopener noreferrer"' : ''} data-download="${escapeHtml(item.id)}" aria-label="Baixar ${escapeHtml(item.titulo)}" title="Baixar PDF">
          ${pdfIcon()}
        </a>
      </article>`;
  }).join('');

  grid.querySelectorAll('[data-read]').forEach(link => {
    link.addEventListener('click', () => track('read', link.dataset.read));
  });
  grid.querySelectorAll('[data-download]').forEach(link => {
    link.addEventListener('click', () => track('download', link.dataset.download));
  });
}

async function loadCatalog() {
  try {
    const res = await fetch(`/data/catalogo.json?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error();
    const data = await res.json();
    items = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : [];
  } catch {
    items = [];
  }
  renderItems();
}

function countSiteView() {
  try {
    if (sessionStorage.getItem('quero-um-pdf-view')) return;
    sessionStorage.setItem('quero-um-pdf-view', '1');
    track('site-view');
  } catch {
    track('site-view');
  }
}

busca.addEventListener('input', renderItems);
searchForm.addEventListener('submit', event => {
  event.preventDefault();
  renderItems();
  document.querySelector('.catalog-heading')?.scrollIntoView({behavior:'smooth', block:'start'});
});

document.querySelector('#support-open').addEventListener('click', () => supportDialog.showModal());
document.querySelector('#support-close').addEventListener('click', () => supportDialog.close());
supportDialog.addEventListener('click', event => {
  if (event.target === supportDialog) supportDialog.close();
});
document.querySelector('#copy-pix').addEventListener('click', async () => {
  const status = document.querySelector('#copy-status');
  try {
    await navigator.clipboard.writeText('gerlanmatfis@gmail.com');
    status.textContent = 'Chave Pix copiada.';
  } catch {
    status.textContent = 'Selecione e copie a chave acima.';
  }
});

countSiteView();
loadCatalog();
