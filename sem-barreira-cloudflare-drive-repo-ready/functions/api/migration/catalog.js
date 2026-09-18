import { verifySession } from "../../_lib/auth.js";
import { json } from "../../_lib/http.js";

export async function onRequestGet({ request, env }) {
  if (!await verifySession(request, env)) return json({ error: "Sessão expirada." }, 401);
  const source = env.LEGACY_CATALOG_URL || "https://sembarreira.netlify.app/api/livros";
  try {
    const res = await fetch(source, { headers: { accept: "application/json" }, cf: { cacheTtl: 0 } });
    if (!res.ok) return json({ error: `O site antigo respondeu ${res.status}.` }, 502);
    const data = await res.json();
    const livros = Array.isArray(data) ? data : Array.isArray(data.livros) ? data.livros : [];
    return json({ source, total: livros.length, livros });
  } catch (error) {
    return json({ error: `Não foi possível ler o catálogo antigo: ${error.message}` }, 502);
  }
}
