const form = document.querySelector("#form-livro");
const statusEl = document.querySelector("#status");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector("button");
  const data = new FormData(form);
  const senha = data.get("senha");
  data.delete("senha");
  button.disabled = true;
  button.textContent = "Enviando…";
  statusEl.textContent = "Enviando livro…";

  try {
    const response = await fetch("/api/livros", { method: "POST", headers: { authorization: `Bearer ${senha}` }, body: data });
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
