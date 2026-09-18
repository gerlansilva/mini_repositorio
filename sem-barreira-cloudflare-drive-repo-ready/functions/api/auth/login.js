import { createSession, sessionCookie } from "../../_lib/auth.js";
import { json, readJson } from "../../_lib/http.js";

export async function onRequestPost({ request, env }) {
  const { password = "" } = await readJson(request);
  if (!env.ADMIN_PASSWORD || String(password) !== String(env.ADMIN_PASSWORD)) {
    return json({ error: "Senha administrativa incorreta." }, 401);
  }
  try {
    const token = await createSession(env);
    return json({ ok: true }, 200, { "set-cookie": sessionCookie(token) });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}
