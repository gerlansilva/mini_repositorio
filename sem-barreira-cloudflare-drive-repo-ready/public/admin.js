let config = null;
let catalog = { version: 2, updatedAt: null, items: [] };
let googleToken = "";
let tokenClient = null;
let legacyItems = [];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const escapeHtml = (text) => String(text ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[c]));
const slug = (value) => String(value || "arquivo").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-|-$/g, "").slice(0,120);

async function api(url, options = {}) {
  const response = await fetch(url, { credentials: "same-origin", ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && !url.includes("/auth/")) showLogin();
    throw new Error(data.error || `Erro ${response.status}`);
  }
  return data;
}

function showLogin() {
  $("#login-view").hidden = false;
  $("#panel-view").hidden = true;
}

function showPanel() {
  $("#login-view").hidden = true;
  $("#panel-view").hidden = false;
}

async function bootstrap() {
  config = await api("/api/config").catch(() => ({ drive: {} }));
  const status = await api("/api/auth/status").catch(() => ({ authenticated: false }));
  if (status.authenticated) {
    showPanel();
    await loadCatalog();
    initGoogle();
  } else showLogin();
}

$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button");
  const status = $("#login-status");
  const password = form.elements.password.value;
  button.disabled = true;
  status.textContent = "Entrando…";
  try {
    await api("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password })
    });
    form.reset();
    status.textContent = "";
    showPanel();
    await loadCatalog();
    initGoogle();
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

$("#logout").addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST" }).catch(() => {});
  googleToken = "";
  showLogin();
});

$$('.admin-tabs button').forEach(button => button.addEventListener('click', () => openTab(button.dataset.tab)));
function openTab(name) {
  $$('.admin-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  $$('.tab-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === name));
  if (name === 'estatisticas') loadStats();
}

async function loadCatalog() {
  catalog = await api("/api/admin/catalog");
  if (!Array.isArray(catalog.items)) catalog.items = [];
  renderAdminList();
}

function renderAdminList() {
  const term = String($("#admin-search").value || "").toLocaleLowerCase("pt-BR");
  const filtered = catalog.items.filter(item => [item.titulo, ...(item.autores || []), item.periodico, ...(item.tags || [])].join(" ").toLocaleLowerCase("pt-BR").includes(term));
  $("#admin-summary").innerHTML = `<strong>${catalog.items.length}</strong> registros no catálogo · <span>${filtered.length} exibidos</span>${catalog.updatedAt ? ` · última atualização ${new Date(catalog.updatedAt).toLocaleString("pt-BR")}` : ""}`;
  $("#admin-list").innerHTML = filtered.length ? filtered.map(item => `
    <article class="admin-record">
      <div class="record-main">
        <span class="record-type">${escapeHtml(item.tipo || "publicação")}</span>
        <strong>${escapeHtml(item.titulo)}</strong>
        <small>${escapeHtml((item.autores || []).join("; "))}${item.ano ? ` · ${item.ano}` : ""}</small>
      </div>
      <div class="record-actions">
        <button class="icon-button" type="button" data-edit="${escapeHtml(item.id)}" aria-label="Editar" title="Editar"><svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg></button>
        <button class="icon-button danger" type="button" data-delete="${escapeHtml(item.id)}" aria-label="Excluir" title="Excluir"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13"/><path d="M10 11v5m4-5v5"/></svg></button>
      </div>
    </article>`).join("") : `<p class="empty-state">Nenhum registro encontrado.</p>`;

  $$("[data-edit]").forEach(button => button.addEventListener("click", () => editItem(button.dataset.edit)));
  $$("[data-delete]").forEach(button => button.addEventListener("click", () => deleteItem(button.dataset.delete)));
}

$("#admin-search").addEventListener("input", renderAdminList);
$("#refresh-list").addEventListener("click", loadCatalog);

function editItem(id) {
  const item = catalog.items.find(row => row.id === id);
  if (!item) return;
  const form = $("#record-form");
  form.elements.id.value = item.id || "";
  form.elements.titulo.value = item.titulo || "";
  form.elements.ano.value = item.ano || "";
  form.elements.autores.value = (item.autores || []).join("; ");
  $("#form-title").textContent = "Editar livro";
  $("#cancel-edit").hidden = false;
  openTab("formulario");
  form.elements.titulo.focus();
}

function resetRecordForm() {
  $("#record-form").reset();
  $("#record-form").elements.id.value = "";
  $("#form-title").textContent = "Novo livro";
  $("#cancel-edit").hidden = true;
  $("#record-status").textContent = "";
}
$("#cancel-edit").addEventListener("click", resetRecordForm);

async function deleteItem(id) {
  const item = catalog.items.find(row => row.id === id);
  if (!item || !confirm(`Excluir “${item.titulo}” do catálogo?\n\nOs arquivos no Google Drive serão preservados.`)) return;
  try {
    const data = await api("/api/admin/catalog", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "delete", id }) });
    catalog = data.catalog;
    renderAdminList();
  } catch (error) { alert(error.message); }
}

function initGoogle() {
  if (!config?.googleClientId || !window.google?.accounts?.oauth2) return;
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: config.googleClientId,
    scope: "https://www.googleapis.com/auth/drive",
    callback: (response) => {
      if (response.error) return setDriveStatus(false, response.error);
      googleToken = response.access_token;
      setDriveStatus(true);
    },
  });
}

function setDriveStatus(connected, message = "") {
  $("#drive-connect").classList.toggle("connected", connected);
  $("#drive-connect").lastChild.textContent = connected ? "Drive conectado" : "Conectar Drive";
  $("#migration-drive-status").textContent = connected ? "Conectado" : (message || "Desconectado");
  $("#run-migration").disabled = !(connected && legacyItems.length);
}

$("#drive-connect").addEventListener("click", () => {
  if (!config?.googleClientId) return alert("Falta configurar GOOGLE_CLIENT_ID no Cloudflare.");
  if (!tokenClient) { initGoogle(); if (!tokenClient) return alert("A biblioteca do Google ainda não carregou. Tente novamente em alguns segundos."); }
  tokenClient.requestAccessToken({ prompt: googleToken ? "" : "consent" });
});

async function uploadToDrive(file, folderId) {
  if (!googleToken) throw new Error("Conecte o Google Drive antes de enviar arquivos.");
  const init = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink,webContentLink", {
    method: "POST",
    headers: { authorization: `Bearer ${googleToken}`, "content-type": "application/json; charset=UTF-8", "x-upload-content-type": file.type, "x-upload-content-length": String(file.size) },
    body: JSON.stringify({ name: file.name, parents: [folderId] }),
  });
  if (init.status === 401) { googleToken = ""; setDriveStatus(false, "Sessão do Google expirada"); throw new Error("A sessão do Google expirou. Conecte o Drive novamente."); }
  if (!init.ok) throw new Error(`Não foi possível preparar o envio ao Drive (${init.status}).`);
  const location = init.headers.get("location");
  const upload = await fetch(location, { method: "PUT", headers: { authorization: `Bearer ${googleToken}`, "content-type": file.type }, body: file });
  const data = await upload.json().catch(() => ({}));
  if (!upload.ok || !data.id) throw new Error(data.error?.message || "Falha no envio ao Drive.");
  const perm = await fetch(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions?sendNotificationEmail=false`, {
    method: "POST", headers: { authorization: `Bearer ${googleToken}`, "content-type": "application/json" }, body: JSON.stringify({ role: "reader", type: "anyone" })
  });
  if (!perm.ok) throw new Error("O arquivo foi enviado, mas não foi possível torná-lo público para leitura.");
  return { id: data.id, url: file.type.startsWith("image/") ? `https://drive.google.com/thumbnail?id=${data.id}&sz=w1200` : `https://drive.google.com/file/d/${data.id}/view?usp=sharing` };
}

$("#record-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type=submit]");
  const status = $("#record-status");
  button.disabled = true;
  try {
    const id = form.elements.id.value;
    const existing = catalog.items.find(row => row.id === id);
    let capa = existing?.capa || "", pdf = existing?.pdf || "";
    let capaFileId = existing?.storage?.capaFileId || "", pdfFileId = existing?.storage?.pdfFileId || "";
    const capaFile = form.elements.capa.files[0];
    const pdfFile = form.elements.pdf.files[0];

    if ((capaFile || pdfFile) && !googleToken) throw new Error("Conecte o Google Drive para enviar novos arquivos.");
    if (capaFile) { status.textContent = "Enviando capa ao Drive…"; const up = await uploadToDrive(capaFile, config.drive.coversFolderId); capa = up.url; capaFileId = up.id; }
    if (pdfFile) { status.textContent = "Enviando PDF ao Drive…"; const up = await uploadToDrive(pdfFile, config.drive.pdfsFolderId); pdf = up.url; pdfFileId = up.id; }

    status.textContent = "Salvando metadados…";
    if (!existing && (!capaFile || !pdfFile)) throw new Error("Para um novo livro, selecione a capa e o PDF.");

    const item = {
      id: id || undefined,
      tipo: "livro",
      titulo: form.elements.titulo.value,
      autores: form.elements.autores.value.split(";").map(v => v.trim()).filter(Boolean),
      ano: form.elements.ano.value || null,
      capa, pdf, capaFileId, pdfFileId,
    };
    const data = await api("/api/admin/catalog", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ item }) });
    catalog = data.catalog;
    status.textContent = "Livro salvo. A Cloudflare atualizará o site após o novo deploy do GitHub.";
    resetRecordForm();
    renderAdminList();
    openTab("acervo");
  } catch (error) { status.textContent = error.message; }
  finally { button.disabled = false; }
});

$("#scan-legacy").addEventListener("click", async () => {
  const report = $("#migration-report");
  report.textContent = "Lendo catálogo importado…";
  try {
    if (!Array.isArray(catalog.items) || !catalog.items.length) await loadCatalog();
    legacyItems = (catalog.items || []).filter(item => String(item.pdf || "").includes("supabase.co") || String(item.capa || "").includes("supabase.co"));
    $("#legacy-status").textContent = `${legacyItems.length} registros encontrados`;
    report.innerHTML = legacyItems.length ? `<strong>${legacyItems.length}</strong> registros ainda apontam para o Supabase.` : `<strong>Migração concluída.</strong> O catálogo atual já aponta para o Google Drive.`;
    $("#run-migration").disabled = !(googleToken && legacyItems.length);
  } catch (error) {
    legacyItems = [];
    $("#legacy-status").textContent = "Falha na leitura";
    report.textContent = error.message;
  }
});

async function migrateRemoteFile(url, folderId, name) {
  if (!url) return null;
  const data = await api("/api/migration/file", {
    method: "POST",
    headers: { "content-type": "application/json", "x-google-access-token": googleToken },
    body: JSON.stringify({ url, folderId, name }),
  });
  return data;
}

$("#run-migration").addEventListener("click", async () => {
  if (!legacyItems.length || !googleToken) return;
  if (!confirm(`Migrar ${legacyItems.length} registros para o Google Drive?\n\nO catálogo antigo não será apagado.`)) return;
  const button = $("#run-migration");
  const report = $("#migration-report");
  const bar = $("#migration-progress");
  button.disabled = true;
  const migrated = [];
  const errors = [];

  for (let i = 0; i < legacyItems.length; i++) {
    const old = legacyItems[i];
    const pct = Math.round((i / legacyItems.length) * 100);
    bar.style.width = `${pct}%`;
    report.innerHTML = `Migrando <strong>${i + 1}/${legacyItems.length}</strong>: ${escapeHtml(old.titulo || "Sem título")}`;
    try {
      const base = `${String(i + 1).padStart(3,"0")}-${slug(old.titulo)}`;
      const coverExt = String(old.capa || "").match(/\.(png|jpe?g|webp)(?:\?|$)/i)?.[1] || "jpg";
      const cover = old.capa ? await migrateRemoteFile(old.capa, config.drive.coversFolderId, `${base}-capa.${coverExt}`) : null;
      const pdf = old.pdf ? await migrateRemoteFile(old.pdf, config.drive.pdfsFolderId, `${base}.pdf`) : null;
      migrated.push({
        id: old.id || crypto.randomUUID(),
        tipo: old.tipo || "publicacao",
        titulo: old.titulo || "Sem título",
        autores: Array.isArray(old.autores) ? old.autores : [],
        ano: old.ano || null,
        tags: Array.isArray(old.tags) ? old.tags : [],
        periodico: old.periodico || "",
        doi: old.doi || "",
        urlExterna: old.urlExterna || "",
        resumo: old.resumo || "",
        capa: cover?.url || "",
        pdf: pdf?.url || "",
        capaFileId: cover?.id || "",
        pdfFileId: pdf?.id || "",
        criadoEm: old.criadoEm || new Date().toISOString(),
        legacy: { sourceId: old.id || "", capa: old.capa || "", pdf: old.pdf || "", capaPath: old.capaPath || "", pdfPath: old.pdfPath || "" },
      });
    } catch (error) {
      errors.push({ index: i + 1, id: old.id || "", titulo: old.titulo || "", error: error.message });
      migrated.push({
        id: old.id || crypto.randomUUID(), tipo: old.tipo || "publicacao", titulo: old.titulo || "Sem título",
        autores: Array.isArray(old.autores) ? old.autores : [], ano: old.ano || null, tags: Array.isArray(old.tags) ? old.tags : [],
        capa: "", pdf: "", criadoEm: old.criadoEm || new Date().toISOString(),
        legacy: { sourceId: old.id || "", capa: old.capa || "", pdf: old.pdf || "", migrationError: error.message },
      });
    }
  }

  try {
    report.innerHTML = "Gravando o novo catálogo no GitHub…";
    const data = await api("/api/admin/catalog", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "replaceAll", items: migrated }) });
    catalog = data.catalog;
    bar.style.width = "100%";
    report.innerHTML = `<strong>Migração concluída.</strong> ${migrated.length} registros processados; ${errors.length} com pendência de arquivo.${errors.length ? `<details><summary>Ver pendências</summary><pre>${escapeHtml(JSON.stringify(errors, null, 2))}</pre></details>` : ""}`;
    renderAdminList();
  } catch (error) {
    report.innerHTML = `<strong>Os arquivos já copiados foram preservados, mas o catálogo não pôde ser gravado:</strong> ${escapeHtml(error.message)}`;
  } finally { button.disabled = false; }
});

function downloadBlob(name, content, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

$("#download-json").addEventListener("click", () => downloadBlob(`quero-um-pdf-catalogo-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(catalog, null, 2), "application/json"));
$("#download-csv").addEventListener("click", () => {
  const q = v => `"${String(v ?? "").replaceAll('"','""')}"`;
  const rows = [["id","tipo","titulo","autores","ano","periodico","doi","urlExterna","tags","pdf","capa"], ...catalog.items.map(i => [i.id,i.tipo,i.titulo,(i.autores||[]).join("; "),i.ano||"",i.periodico||"",i.doi||"",i.urlExterna||"",(i.tags||[]).join("; "),i.pdf||"",i.capa||""])];
  downloadBlob(`quero-um-pdf-catalogo-${new Date().toISOString().slice(0,10)}.csv`, rows.map(r => r.map(q).join(",")).join("\n"), "text/csv;charset=utf-8");
});

$("#drive-backup").addEventListener("click", async () => {
  const status = $("#backup-status");
  try {
    if (!googleToken) throw new Error("Conecte o Google Drive antes de salvar o backup.");
    const content = JSON.stringify(catalog, null, 2);
    const file = new File([content], `catalogo-${new Date().toISOString().replace(/[:.]/g,"-")}.json`, { type: "application/json" });
    await uploadToDrive(file, config.drive.backupCatalogFolderId);
    status.textContent = "Backup salvo no Google Drive.";
  } catch (error) { status.textContent = error.message; }
});


async function loadStats() {
  const status = $("#stats-status");
  const wrap = $("#stats-table-wrap");
  if (!status || !wrap) return;
  status.textContent = "Carregando estatísticas…";
  try {
    const data = await api("/api/stats");
    if (!data.configured) {
      status.textContent = "O contador ainda não está conectado ao Cloudflare KV. Configure a vinculação STATS para começar a registrar.";
      $("#stats-site").textContent = "0";
      $("#stats-reads").textContent = "0";
      $("#stats-downloads").textContent = "0";
      wrap.innerHTML = "";
      return;
    }
    $("#stats-site").textContent = Number(data.totals?.siteViews || 0).toLocaleString("pt-BR");
    $("#stats-reads").textContent = Number(data.totals?.reads || 0).toLocaleString("pt-BR");
    $("#stats-downloads").textContent = Number(data.totals?.downloads || 0).toLocaleString("pt-BR");
    status.textContent = "Atualizado agora.";
    const rows = (data.items || []).map(row => {
      const item = catalog.items.find(i => i.id === row.id);
      return { ...row, titulo: item?.titulo || row.id };
    }).sort((a,b) => (b.downloads + b.reads) - (a.downloads + a.reads));
    wrap.innerHTML = rows.length ? `<table class="stats-table"><thead><tr><th>Documento</th><th>Leituras</th><th>Downloads</th></tr></thead><tbody>${rows.map(row => `<tr><td>${escapeHtml(row.titulo)}</td><td class="num">${Number(row.reads||0).toLocaleString("pt-BR")}</td><td class="num">${Number(row.downloads||0).toLocaleString("pt-BR")}</td></tr>`).join("")}</tbody></table>` : '<p class="empty-state">Ainda não há eventos registrados.</p>';
  } catch (error) {
    status.textContent = error.message;
    wrap.innerHTML = "";
  }
}

bootstrap();
