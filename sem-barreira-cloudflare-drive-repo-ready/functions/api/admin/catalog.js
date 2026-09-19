import { verifySession } from "../../_lib/auth.js";
import { json, readJson } from "../../_lib/http.js";
import { readCatalog, writeCatalog } from "../../_lib/github.js";

function cleanList(value, separator = /[;,]/) {
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  return String(value || "").split(separator).map(v => v.trim()).filter(Boolean);
}

function normalizeItem(input, existing = null) {
  const now = new Date().toISOString();
  const item = {
    ...(existing || {}),
    id: String(input.id || existing?.id || crypto.randomUUID()),
    tipo: "livro",
    titulo: String(input.titulo || "").trim(),
    autores: cleanList(input.autores, /[;]/),
    ano: input.ano ? Number(input.ano) : null,
    tags: input.tags !== undefined ? cleanList(input.tags) : (existing?.tags || []),
    periodico: input.periodico !== undefined ? String(input.periodico || "").trim() : String(existing?.periodico || ""),
    doi: input.doi !== undefined ? String(input.doi || "").trim() : String(existing?.doi || ""),
    urlExterna: input.urlExterna !== undefined ? String(input.urlExterna || "").trim() : String(existing?.urlExterna || ""),
    resumo: input.resumo !== undefined ? String(input.resumo || "").trim() : String(existing?.resumo || ""),
    capa: String(input.capa || existing?.capa || "").trim(),
    pdf: String(input.pdf || existing?.pdf || "").trim(),
    storage: {
      provider: "google-drive",
      capaFileId: String(input.capaFileId || existing?.storage?.capaFileId || ""),
      pdfFileId: String(input.pdfFileId || existing?.storage?.pdfFileId || ""),
    },
    criadoEm: existing?.criadoEm || input.criadoEm || now,
    atualizadoEm: now,
  };
  if (input.legacy || existing?.legacy) item.legacy = input.legacy || existing.legacy;
  if (!item.titulo || !item.autores.length) throw new Error("Título e autoria são obrigatórios.");
  return item;
}

export async function onRequestGet({ request, env }) {
  if (!await verifySession(request, env)) return json({ error: "Sessão expirada." }, 401);
  try {
    const { catalog } = await readCatalog(env);
    return json(catalog);
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  if (!await verifySession(request, env)) return json({ error: "Sessão expirada." }, 401);
  try {
    const body = await readJson(request);
    const { catalog, sha } = await readCatalog(env);
    const items = Array.isArray(catalog.items) ? catalog.items : [];

    if (body.action === "delete") {
      const id = String(body.id || "");
      const next = items.filter(item => item.id !== id);
      if (next.length === items.length) return json({ error: "Registro não encontrado." }, 404);
      catalog.items = next;
    } else if (body.action === "replaceAll") {
      if (!Array.isArray(body.items)) return json({ error: "Itens de importação inválidos." }, 400);
      catalog.items = body.items.map(raw => normalizeItem(raw, raw));
    } else {
      const input = body.item || body;
      const id = String(input.id || "");
      const index = id ? items.findIndex(item => item.id === id) : -1;
      const normalized = normalizeItem(input, index >= 0 ? items[index] : null);
      if (index >= 0) items[index] = normalized;
      else items.unshift(normalized);
      catalog.items = items;
    }

    catalog.version = 2;
    catalog.updatedAt = new Date().toISOString();
    await writeCatalog(env, catalog, sha, body.action === "replaceAll" ? "Migra acervo para Google Drive" : "Atualiza catálogo do Quero um PDF");
    return json({ ok: true, catalog });
  } catch (error) {
    return json({ error: error.message }, error.status === 409 ? 409 : 500);
  }
}
