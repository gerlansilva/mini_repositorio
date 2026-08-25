const form = document.querySelector("#form-livro");
const statusEl = document.querySelector("#status");
const listaEl = document.querySelector("#lista-livros");
const atualizarLista = document.querySelector("#atualizar-lista");
const escapeHtml = (text) => String(text).replace(/[&<>\"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;" }[c]));

async function carregarLivros() {
  listaEl.innerHTML = "<p>Carregando…</p>";
  try {
    const response = await fetch("/api/livros", { cache: "no-store" });
    const data = await response.json();
    const livros = Array.isArray(data.livros) ? data.livros : [];
    listaEl.innerHTML = livros.length ? livros.map((livro) => `
      <article class="admin-book">
        <div>
          <strong>${escapeHtml(livro.titulo)}</strong>
          <span>${escapeHtml((livro.autores || []).join("; "))}${livro.ano ? ` · ${livro.ano}` : ""}</span>
          <small>${escapeHtml((livro.tags || []).join(" · "))}</small>
        </div>
        <button type="button" data-delete="${escapeHtml(livro.id)}">Excluir</button>
      </article>`).join("") : "<p>Nenhum livro cadastrado.</p>";
    listaEl.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", () => excluirLivro(button.dataset.delete, button)));
  } catch { listaEl.innerHTML = "<p>Não foi possível carregar a lista.</p>"; }
}

async function excluirLivro(id, button) {
  const senha = form.elements.senha.value;
  if (!senha) { statusEl.textContent = "Informe a senha administrativa para excluir."; form.elements.senha.focus(); return; }
  if (!confirm("Excluir este livro do acervo?")) return;
  button.disabled = true;
  const response = await fetch("/api/livros", {
    method: "DELETE",
    headers: { authorization: `Bearer ${senha}`, "content-type": "application/json" },
    body: JSON.stringify({ id }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) { statusEl.textContent = result.error || "Não foi possível excluir o livro."; button.disabled = false; return; }
  statusEl.textContent = "Livro excluído do acervo.";
  await carregarLivros();
}

atualizarLista.addEventListener("click", carregarLivros);
carregarLivros();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector("button");
  const data = new FormData(form);
  const senha = data.get("senha");
  button.disabled = true;
  button.textContent = "Enviando…";
  statusEl.textContent = "Enviando livro…";

  try {
    const capa = data.get("capa");
    const pdf = data.get("pdf");
    const enviarArquivo = async (arquivo, classe) => {
      statusEl.textContent = classe === "capa" ? "Enviando capa…" : "Enviando PDF…";
      const preparo = await fetch("/api/preparar-upload", {
        method: "POST",
        headers: { authorization: `Bearer ${senha}`, "content-type": "application/json" },
        body: JSON.stringify({ nome: arquivo.name, tipo: arquivo.type, classe }),
      });
      const config = await preparo.json().catch(() => ({}));
      if (!preparo.ok) throw new Error(config.error || "Não foi possível preparar o arquivo.");
      const client = window.supabase.createClient(config.supabaseUrl, config.anonKey);
      const { error } = await client.storage.from(config.bucket).uploadToSignedUrl(config.path, config.token, arquivo, { contentType: arquivo.type });
      if (error) throw new Error(`Falha no envio: ${error.message}`);
      return config;
    };

    const capaUpload = await enviarArquivo(capa, "capa");
    const pdfUpload = await enviarArquivo(pdf, "pdf");
    statusEl.textContent = "Salvando informações…";
    const response = await fetch("/api/livros", {
      method: "POST",
      headers: { authorization: `Bearer ${senha}`, "content-type": "application/json" },
      body: JSON.stringify({
        titulo: data.get("titulo"),
        autores: String(data.get("autores")).split(";").map((v) => v.trim()).filter(Boolean),
        tags: String(data.get("tags")).split(",").map((v) => v.trim()).filter(Boolean),
        ano: data.get("ano"),
        capa: capaUpload.publicUrl,
        pdf: pdfUpload.publicUrl,
        capaPath: capaUpload.path,
        pdfPath: pdfUpload.path,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Não foi possível adicionar o livro.");
    const senhaInput = form.elements.senha.value;
    form.reset();
    form.elements.senha.value = senhaInput;
    statusEl.textContent = "Livro adicionado ao acervo.";
    await carregarLivros();
  } catch (error) {
    statusEl.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = "Adicionar ao acervo";
  }
});
