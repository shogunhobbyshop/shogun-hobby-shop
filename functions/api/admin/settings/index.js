import { requireAdmin, jsonError } from "../_auth.js";

export async function onRequestGet({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  if (!env.DB) return jsonError("D1 chưa được kết nối.", 503);
  const { results } = await env.DB.prepare("SELECT key,value FROM settings ORDER BY key").all();
  return Response.json(Object.fromEntries(results.map(x => [x.key, x.value])));
}

export async function onRequestPut({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  if (!env.DB) return jsonError("D1 chưa được kết nối.", 503);
  const body = await request.json();
  const allowed = ["shop_name", "tagline", "phone", "zalo", "facebook"];
  const stmt = env.DB.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
  const batch = allowed.map(key => stmt.bind(key, String(body[key] ?? "")));
  await env.DB.batch(batch);
  return Response.json({ ok: true });
}
