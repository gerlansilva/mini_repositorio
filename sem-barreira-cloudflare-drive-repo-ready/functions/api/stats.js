import { verifySession } from "../_lib/auth.js";
import { json, readJson } from "../_lib/http.js";

function safeId(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 120);
}

async function increment(namespace, key) {
  const current = Number(await namespace.get(key) || 0);
  const next = current + 1;
  await namespace.put(key, String(next));
  return next;
}

export async function onRequestPost({ request, env }) {
  if (!env.STATS) return json({ ok: true, configured: false });

  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "Origem não permitida." }, 403);

  try {
    const body = await readJson(request);
    const event = String(body.event || "");
    const id = safeId(body.id);

    if (event === "site-view") {
      const count = await increment(env.STATS, "site:views");
      return json({ ok: true, configured: true, count });
    }
    if ((event === "read" || event === "download") && id) {
      const count = await increment(env.STATS, `item:${id}:${event}`);
      return json({ ok: true, configured: true, count });
    }
    return json({ error: "Evento inválido." }, 400);
  } catch (error) {
    return json({ error: error.message }, 400);
  }
}

export async function onRequestGet({ request, env }) {
  if (!await verifySession(request, env)) return json({ error: "Sessão expirada." }, 401);
  if (!env.STATS) return json({ configured: false, totals: { siteViews: 0, reads: 0, downloads: 0 }, items: [] });

  const siteViews = Number(await env.STATS.get("site:views") || 0);
  const list = await env.STATS.list({ prefix: "item:" });
  const map = new Map();

  await Promise.all((list.keys || []).map(async entry => {
    const parts = entry.name.split(":");
    if (parts.length !== 3) return;
    const [, id, event] = parts;
    const value = Number(await env.STATS.get(entry.name) || 0);
    if (!map.has(id)) map.set(id, { id, reads: 0, downloads: 0 });
    const row = map.get(id);
    if (event === "read") row.reads = value;
    if (event === "download") row.downloads = value;
  }));

  const items = [...map.values()];
  const reads = items.reduce((sum, row) => sum + row.reads, 0);
  const downloads = items.reduce((sum, row) => sum + row.downloads, 0);

  return json({ configured: true, totals: { siteViews, reads, downloads }, items });
}
