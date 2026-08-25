import { getStore } from "@netlify/blobs";

const store = () => getStore({ name: "dobby-livre", consistency: "strong" });

const respond = (body, status = 200) => Response.json(body, {
  status,
  headers: { "cache-control": "no-store" },
});

const authorized = (request) => {
  const password = process.env.ADMIN_PASSWORD;
  const header = request.headers.get("authorization") || "";
  return Boolean(password) && header === `Bearer ${password}`;
};

export default async (request) => {
  const acervo = store();

  if (request.method === "GET") {
    const raw = await acervo.get("catalogo.json");
    return respond({ livros: raw ? JSON.parse(raw) : [] });
  }

  if (request.method !== "POST") return respond({ error: "Método não permitido." }, 405);
  if (!authorized(request)) return respond({ error: "Senha administrativa incorreta." }, 401);

  const data = await request.json().catch(() => ({}));
  const titulo = String(data.titulo || "").trim();
  const autores = Array.isArray(data.autores) ? data.autores.map((v) => String(v).trim()).filter(Boolean) : [];
  const tags = Array.isArray(data.tags) ? data.tags.map((v) => String(v).trim()).filter(Boolean) : [];
  const anoTexto = String(data.ano || "").trim();
  const capaUrl = String(data.capa || "").trim();
  const pdfUrl = String(data.pdf || "").trim();

  if (!titulo || !autores.length || !tags.length || !capaUrl || !pdfUrl) {
    return respond({ error: "Preencha todos os campos obrigatórios." }, 400);
  }
  const id = crypto.randomUUID();

  const raw = await acervo.get("catalogo.json");
  const livros = raw ? JSON.parse(raw) : [];
  livros.unshift({
    id,
    titulo,
    autores,
    ano: anoTexto ? Number(anoTexto) : null,
    tags,
    capa: capaUrl,
    pdf: pdfUrl,
    criadoEm: new Date().toISOString(),
  });
  await acervo.set("catalogo.json", JSON.stringify(livros), { metadata: { contentType: "application/json" } });

  return respond({ ok: true, id }, 201);
};
