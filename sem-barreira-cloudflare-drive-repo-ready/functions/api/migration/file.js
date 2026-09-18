import { verifySession } from "../../_lib/auth.js";
import { json, readJson } from "../../_lib/http.js";

function safeName(value, fallback) {
  const clean = String(value || fallback).replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();
  return clean.slice(0, 180) || fallback;
}

export async function onRequestPost({ request, env }) {
  if (!await verifySession(request, env)) return json({ error: "Sessão expirada." }, 401);
  const token = request.headers.get("x-google-access-token") || "";
  if (!token) return json({ error: "Conecte o Google Drive antes de migrar os arquivos." }, 401);

  const { url, folderId, name } = await readJson(request);
  if (!url || !folderId) return json({ error: "URL de origem e pasta de destino são obrigatórias." }, 400);

  let parsed;
  try { parsed = new URL(url); } catch { return json({ error: "URL de origem inválida." }, 400); }
  if (parsed.protocol !== "https:") return json({ error: "Somente URLs HTTPS podem ser migradas." }, 400);

  try {
    const source = await fetch(parsed.toString(), { redirect: "follow" });
    if (!source.ok || !source.body) return json({ error: `Arquivo antigo indisponível (${source.status}).` }, 502);

    const contentType = source.headers.get("content-type") || "application/octet-stream";
    const contentLength = source.headers.get("content-length") || "";
    const fallback = decodeURIComponent(parsed.pathname.split("/").pop() || "arquivo");
    const fileName = safeName(name, fallback);

    const initHeaders = {
      authorization: `Bearer ${token}`,
      "content-type": "application/json; charset=UTF-8",
      "x-upload-content-type": contentType,
    };
    if (contentLength) initHeaders["x-upload-content-length"] = contentLength;

    const init = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink,webContentLink", {
      method: "POST",
      headers: initHeaders,
      body: JSON.stringify({ name: fileName, parents: [folderId] }),
    });
    if (!init.ok) {
      const info = await init.text();
      return json({ error: `Google Drive recusou o envio: ${info.slice(0, 400)}` }, 502);
    }
    const location = init.headers.get("location");
    if (!location) return json({ error: "Google Drive não retornou a URL de envio." }, 502);

    const uploadHeaders = { authorization: `Bearer ${token}`, "content-type": contentType };
    if (contentLength) uploadHeaders["content-length"] = contentLength;
    const upload = await fetch(location, { method: "PUT", headers: uploadHeaders, body: source.body });
    const file = await upload.json().catch(() => ({}));
    if (!upload.ok || !file.id) return json({ error: file.error?.message || `Falha no envio para o Drive (${upload.status}).` }, 502);

    const perm = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}/permissions?sendNotificationEmail=false`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    });

    const isImage = contentType.startsWith("image/");
    return json({
      ok: true,
      id: file.id,
      name: file.name || fileName,
      publicPermission: perm.ok,
      url: isImage
        ? `https://drive.google.com/thumbnail?id=${file.id}&sz=w1200`
        : `https://drive.google.com/file/d/${file.id}/view?usp=sharing`,
      downloadUrl: `https://drive.google.com/uc?export=download&id=${file.id}`,
    });
  } catch (error) {
    return json({ error: `Falha na migração do arquivo: ${error.message}` }, 502);
  }
}
