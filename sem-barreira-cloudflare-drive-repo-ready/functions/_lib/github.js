const DEFAULT_PATH = "sem-barreira-cloudflare-drive-repo-ready/public/data/catalogo.json";

function base64ToUtf8(value) {
  const binary = atob(String(value || "").replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function utf8ToBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function cfg(env) {
  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;
  const token = env.GITHUB_TOKEN;
  const branch = env.GITHUB_BRANCH || "main";
  const path = env.CATALOG_PATH || DEFAULT_PATH;
  if (!owner || !repo || !token) throw new Error("GitHub não configurado no Cloudflare.");
  return { owner, repo, token, branch, path };
}

async function githubFetch(env, path, init = {}) {
  const { token } = cfg(env);
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
      "user-agent": "sem-barreira-cloudflare",
      ...(init.headers || {}),
    },
  });
}

export async function readCatalog(env) {
  const { owner, repo, branch, path } = cfg(env);
  const res = await githubFetch(env, `/repos/${owner}/${repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(branch)}`);
  if (res.status === 404) return { catalog: { version: 2, updatedAt: null, items: [] }, sha: null };
  if (!res.ok) throw new Error(`GitHub respondeu ${res.status}.`);
  const file = await res.json();
  const raw = base64ToUtf8(file.content);
  const parsed = JSON.parse(raw);
  const catalog = Array.isArray(parsed) ? { version: 2, updatedAt: null, items: parsed } : parsed;
  if (!Array.isArray(catalog.items)) catalog.items = [];
  return { catalog, sha: file.sha };
}

export async function writeCatalog(env, catalog, sha, message = "Atualiza catálogo do Quero um PDF") {
  const { owner, repo, branch, path } = cfg(env);
  const content = JSON.stringify(catalog, null, 2) + "\n";
  const body = { message, content: utf8ToBase64(content), branch };
  if (sha) body.sha = sha;
  const res = await githubFetch(env, `/repos/${owner}/${repo}/contents/${encodeURI(path)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.message || `Não foi possível atualizar o catálogo (${res.status}).`);
    error.status = res.status;
    throw error;
  }
  return data;
}
