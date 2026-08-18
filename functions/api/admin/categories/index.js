import { requireAdmin, slugify, jsonError } from "../_auth.js";

async function uniqueSlug(db, base, ignoreId = null) {
  const slug = slugify(base);
  let candidate = slug;
  let n = 2;
  while (true) {
    const row = ignoreId == null
      ? await db.prepare("SELECT id FROM categories WHERE slug=? LIMIT 1").bind(candidate).first()
      : await db.prepare("SELECT id FROM categories WHERE slug=? AND id!=? LIMIT 1").bind(candidate, ignoreId).first();
    if (!row) return candidate;
    candidate = `${slug}-${n++}`;
  }
}

export async function onRequestGet({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  if (!env.DB) return jsonError("D1 chưa được kết nối.", 503);
  const { results } = await env.DB.prepare("SELECT * FROM categories ORDER BY sort_order,id").all();
  return Response.json(results);
}

export async function onRequestPost({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  if (!env.DB) return jsonError("D1 chưa được kết nối.", 503);
  const b = await request.json();
  if (!b.name?.trim()) return jsonError("Tên danh mục không được để trống.");
  const slug = await uniqueSlug(env.DB, b.slug || b.name);
  const result = await env.DB.prepare(`
    INSERT INTO categories(name,slug,image_url,sort_order,visible) VALUES(?,?,?,?,?)
  `).bind(
    b.name.trim(), slug, b.image_url || "", Number(b.sort_order || 0), b.visible ? 1 : 0
  ).run();
  return Response.json({ ok: true, id: result.meta.last_row_id });
}

export async function onRequestPut({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  if (!env.DB) return jsonError("D1 chưa được kết nối.", 503);
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return jsonError("Thiếu id danh mục.");
  const b = await request.json();
  if (!b.name?.trim()) return jsonError("Tên danh mục không được để trống.");
  const slug = await uniqueSlug(env.DB, b.slug || b.name, id);
  const result = await env.DB.prepare(`
    UPDATE categories SET name=?,slug=?,image_url=?,sort_order=?,visible=? WHERE id=?
  `).bind(
    b.name.trim(), slug, b.image_url || "", Number(b.sort_order || 0), b.visible ? 1 : 0, id
  ).run();
  if (!result.meta.changes) return jsonError("Không tìm thấy danh mục.", 404);
  return Response.json({ ok: true });
}

export async function onRequestDelete({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  if (!env.DB) return jsonError("D1 chưa được kết nối.", 503);
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return jsonError("Thiếu id danh mục.");

  const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM products WHERE category_id=?").bind(id).first();
  if (Number(count?.count || 0) > 0) return jsonError("Danh mục này đang có sản phẩm. Hãy chuyển sản phẩm sang danh mục khác trước khi xóa.", 409);

  const result = await env.DB.prepare("DELETE FROM categories WHERE id=?").bind(id).run();
  if (!result.meta.changes) return jsonError("Không tìm thấy danh mục.", 404);
  return Response.json({ ok: true });
}
