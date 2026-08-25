const form = document.querySelector("#form-livro");
const statusEl = document.querySelector("#status");

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
      return config.publicUrl;
    };

    const capaUrl = await enviarArquivo(capa, "capa");
    const pdfUrl = await enviarArquivo(pdf, "pdf");
    statusEl.textContent = "Salvando informações…";
    const response = await fetch("/api/livros", {
      method: "POST",
      headers: { authorization: `Bearer ${senha}`, "content-type": "application/json" },
      body: JSON.stringify({
        titulo: data.get("titulo"),
        autores: String(data.get("autores")).split(";").map((v) => v.trim()).filter(Boolean),
        tags: String(data.get("tags")).split(",").map((v) => v.trim()).filter(Boolean),
        ano: data.get("ano"),
        capa: capaUrl,
        pdf: pdfUrl,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Não foi possível adicionar o livro.");
    const senhaInput = form.elements.senha.value;
    form.reset();
    form.elements.senha.value = senhaInput;
    statusEl.textContent = "Livro adicionado ao acervo.";
  } catch (error) {
    statusEl.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = "Adicionar ao acervo";
  }
});
