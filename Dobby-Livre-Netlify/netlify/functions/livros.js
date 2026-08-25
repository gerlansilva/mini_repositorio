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

const cleanName = (name) => name.normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-zA-Z0-9._-]/g, "-")
  .slice(-120);

export default async (request) => {
  const acervo = store();

  if (request.method === "GET") {
    const raw = await acervo.get("catalogo.json");
    return respond({ livros: raw ? JSON.parse(raw) : [] });
  }

  if (request.method !== "POST") return respond({ error: "Método não permitido." }, 405);
  if (!authorized(request)) return respond({ error: "Senha administrativa incorreta." }, 401);

  const data = await request.formData();
  const titulo = String(data.get("titulo") || "").trim();
  const autores = String(data.get("autores") || "").split(";").map((v) => v.trim()).filter(Boolean);
  const tags = String(data.get("tags") || "").split(",").map((v) => v.trim()).filter(Boolean);
  const anoTexto = String(data.get("ano") || "").trim();
  const capa = data.get("capa");
  const pdf = data.get("pdf");

  if (!titulo || !autores.length || !tags.length || !(capa instanceof File) || !(pdf instanceof File)) {
    return respond({ error: "Preencha todos os campos obrigatórios." }, 400);
  }
  if (!capa.type.startsWith("image/")) return respond({ error: "A capa precisa ser uma imagem." }, 400);
  if (pdf.type !== "application/pdf") return respond({ error: "O documento precisa ser um PDF." }, 400);

  const id = crypto.randomUUID();
  const capaKey = `capas/${id}-${cleanName(capa.name)}`;
  const pdfKey = `pdfs/${id}-${cleanName(pdf.name)}`;

  await Promise.all([
    acervo.set(capaKey, await capa.arrayBuffer(), { metadata: { contentType: capa.type } }),
    acervo.set(pdfKey, await pdf.arrayBuffer(), { metadata: { contentType: "application/pdf" } }),
  ]);

  const raw = await acervo.get("catalogo.json");
  const livros = raw ? JSON.parse(raw) : [];
  livros.unshift({
    id,
    titulo,
    autores,
    ano: anoTexto ? Number(anoTexto) : null,
    tags,
    capa: `/api/arquivos/${encodeURIComponent(capaKey)}`,
    pdf: `/api/arquivos/${encodeURIComponent(pdfKey)}`,
    criadoEm: new Date().toISOString(),
  });
  await acervo.set("catalogo.json", JSON.stringify(livros), { metadata: { contentType: "application/json" } });

  return respond({ ok: true, id }, 201);
};
