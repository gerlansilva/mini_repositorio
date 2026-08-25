import { getStore } from "@netlify/blobs";

export default async (request) => {
  const key = new URL(request.url).searchParams.get("key");
  if (!key || (!key.startsWith("capas/") && !key.startsWith("pdfs/"))) {
    return new Response("Arquivo inválido.", { status: 400 });
  }

  const acervo = getStore("dobby-livre");
  const result = await acervo.getWithMetadata(decodeURIComponent(key), { type: "arrayBuffer" });
  if (!result) return new Response("Arquivo não encontrado.", { status: 404 });

  return new Response(result.data, {
    headers: {
      "content-type": result.metadata?.contentType || "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
};
