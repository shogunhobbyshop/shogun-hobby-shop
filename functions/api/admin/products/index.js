import { requireAdmin, slugify, jsonError } from "../_auth.js";

async function uniqueSlug(db, base, ignoreId = null) {
  let slug = slugify(base);
  let candidate = slug;
  let n = 2;
  while (true) {
    const row = ignoreId == null
      ? await db.prepare("SELECT id FROM products WHERE slug=? LIMIT 1").bind(candidate).first()
      : await db.prepare("SELECT id FROM products WHERE slug=? AND id!=? LIMIT 1").bind(candidate, ignoreId).first();
    if (!row) return candidate;
    candidate = `${slug}-${n++}`;
  }
}

export async function onRequestGet({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  if (!env.DB) return jsonError("D1 chưa được kết nối.", 503);

  const { results } = await env.DB.prepare(`
    SELECT p.*, c.name AS category_name
    FROM products p
    LEFT JOIN categories c ON c.id=p.category_id
    ORDER BY p.id DESC
  `).all();
  return Response.json(results);
}

export async function onRequestPost({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  if (!env.DB) return jsonError("D1 chưa được kết nối.", 503);

  const b = await request.json();
  if (!b.name?.trim()) return jsonError("Tên sản phẩm không được để trống.");

  const slug = await uniqueSlug(env.DB, b.slug || b.name);
  const result = await env.DB.prepare(`
    INSERT INTO products
      (name,slug,price,category_id,description,image_url,stock,visible)
    VALUES (?,?,?,?,?,?,?,?)
  `).bind(
    b.name.trim(),
    slug,
    Number(b.price || 0),
    b.category_id ? Number(b.category_id) : null,
    b.description || "",
    b.image_url || "",
    Number(b.stock || 0),
    b.visible ? 1 : 0
  ).run();

  return Response.json({ ok: true, id: result.meta.last_row_id });
}

export async function onRequestPut({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  if (!env.DB) return jsonError("D1 chưa được kết nối.", 503);

  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return jsonError("Thiếu id sản phẩm.");

  const b = await request.json();
  if (!b.name?.trim()) return jsonError("Tên sản phẩm không được để trống.");

  const slug = await uniqueSlug(env.DB, b.slug || b.name, id);
  const result = await env.DB.prepare(`
    UPDATE products SET
      name=?, slug=?, price=?, category_id=?, description=?, image_url=?, stock=?, visible=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).bind(
    b.name.trim(),
    slug,
    Number(b.price || 0),
    b.category_id ? Number(b.category_id) : null,
    b.description || "",
    b.image_url || "",
    Number(b.stock || 0),
    b.visible ? 1 : 0,
    id
  ).run();

  if (!result.meta.changes) return jsonError("Không tìm thấy sản phẩm.", 404);
  return Response.json({ ok: true });
}

export async function onRequestDelete({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  if (!env.DB) return jsonError("D1 chưa được kết nối.", 503);

  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return jsonError("Thiếu id sản phẩm.");

  const result = await env.DB.prepare("DELETE FROM products WHERE id=?").bind(id).run();
  if (!result.meta.changes) return jsonError("Không tìm thấy sản phẩm.", 404);
  return Response.json({ ok: true });
}
