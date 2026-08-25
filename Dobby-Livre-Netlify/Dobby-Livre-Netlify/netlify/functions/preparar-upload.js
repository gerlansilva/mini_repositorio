import { createClient } from "@supabase/supabase-js";

const respond = (body, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
const authorized = (request) => {
  const password = process.env.ADMIN_PASSWORD;
  return Boolean(password) && request.headers.get("authorization") === `Bearer ${password}`;
};
const cleanName = (name) => String(name).normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-zA-Z0-9._-]/g, "-")
  .slice(-120);

export default async (request) => {
  if (request.method !== "POST") return respond({ error: "Método não permitido." }, 405);
  if (!authorized(request)) return respond({ error: "Senha administrativa incorreta." }, 401);

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const bucket = process.env.SUPABASE_BUCKET || "livros";
  if (!supabaseUrl || !serviceKey || !anonKey) return respond({ error: "Supabase ainda não foi configurado no Netlify." }, 500);

  const { nome, tipo, classe } = await request.json().catch(() => ({}));
  const isCapa = classe === "capa" && String(tipo).startsWith("image/");
  const isPdf = classe === "pdf" && tipo === "application/pdf";
  if (!isCapa && !isPdf) return respond({ error: "Tipo de arquivo inválido." }, 400);

  const path = `${classe === "capa" ? "capas" : "pdfs"}/${crypto.randomUUID()}-${cleanName(nome)}`;
  const client = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.storage.from(bucket).createSignedUploadUrl(path);
  if (error) return respond({ error: `Não foi possível preparar o envio: ${error.message}` }, 500);

  const publicUrl = client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  return respond({ supabaseUrl, anonKey, bucket, path, token: data.token, publicUrl });
};
