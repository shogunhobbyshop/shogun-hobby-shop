import { requireAdmin, jsonError } from "../../_auth.js";

async function getVariant(db, id) {
  const variant = await db.prepare(`
    SELECT
      id,
      product_id,
      sku,
      name,
      price,
      compare_price,
      stock,
      image_media_id,
      is_default,
      is_active,
      created_at,
      updated_at
    FROM product_variants
    WHERE id = ?
    LIMIT 1
  `).bind(id).first();

  if (!variant) return null;

  const { results } = await db.prepare(`
    SELECT
      pov.id,
      pov.option_group_id,
      pov.name,
      pov.value,
      pog.name AS group_name
    FROM variant_option_values vov
    JOIN product_option_values pov
      ON pov.id = vov.option_value_id
    JOIN product_option_groups pog
      ON pog.id = pov.option_group_id
    WHERE vov.variant_id = ?
    ORDER BY pog.sort_order ASC, pov.sort_order ASC, pov.id ASC
  `).bind(id).all();

  variant.options = results;

  return variant;
}


/*
 * GET
 * /api/admin/products/variants?product_id=123
 */
export async function onRequestGet({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  if (!env.DB) {
    return jsonError("D1 chưa được kết nối.", 503);
  }

  const productId = Number(
    new URL(request.url).searchParams.get("product_id")
  );

  if (!productId) {
    return jsonError("Thiếu product_id.");
  }

  const product = await env.DB.prepare(`
    SELECT id, name
    FROM products
    WHERE id = ?
    LIMIT 1
  `).bind(productId).first();

  if (!product) {
    return jsonError("Không tìm thấy sản phẩm.", 404);
  }

  const { results } = await env.DB.prepare(`
    SELECT
      id,
      product_id,
      sku,
      name,
      price,
      compare_price,
      stock,
      image_media_id,
      is_default,
      is_active,
      created_at,
      updated_at
    FROM product_variants
    WHERE product_id = ?
    ORDER BY is_default DESC, id ASC
  `).bind(productId).all();

  for (const variant of results) {
    const { results: options } = await env.DB.prepare(`
      SELECT
        pov.id,
        pov.option_group_id,
        pov.name,
        pov.value,
        pog.name AS group_name
      FROM variant_option_values vov
      JOIN product_option_values pov
        ON pov.id = vov.option_value_id
      JOIN product_option_groups pog
        ON pog.id = pov.option_group_id
      WHERE vov.variant_id = ?
      ORDER BY pog.sort_order ASC, pov.sort_order ASC, pov.id ASC
    `).bind(variant.id).all();

    variant.options = options;
  }

  return Response.json({
    product,
    variants: results
  });
}


/*
 * POST
 * /api/admin/products/variants
 *
 * Body:
 * {
 *   product_id: 1,
 *   sku: "BUR-FER-RED",
 *   name: "Ferrari / Đỏ",
 *   price: 350000,
 *   compare_price: 390000,
 *   stock: 5,
 *   image_media_id: null,
 *   is_default: false,
 *   is_active: true,
 *   option_value_ids: [10, 25]
 * }
 */
export async function onRequestPost({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  if (!env.DB) {
    return jsonError("D1 chưa được kết nối.", 503);
  }

  const body = await request.json();

  const productId = Number(body.product_id);
  const name = String(body.name || "").trim();

  if (!productId) {
    return jsonError("Thiếu product_id.");
  }

  if (!name) {
    return jsonError("Tên biến thể không được để trống.");
  }

  const product = await env.DB.prepare(`
    SELECT id
    FROM products
    WHERE id = ?
    LIMIT 1
  `).bind(productId).first();

  if (!product) {
    return jsonError("Không tìm thấy sản phẩm.", 404);
  }

  let optionValueIds = Array.isArray(body.option_value_ids)
    ? body.option_value_ids
        .map(Number)
        .filter(Boolean)
    : [];

  optionValueIds = [...new Set(optionValueIds)];

  /*
   * Kiểm tra toàn bộ option_value có thuộc sản phẩm này không.
   */
  if (optionValueIds.length) {
    const placeholders = optionValueIds.map(() => "?").join(",");

    const { results } = await env.DB.prepare(`
      SELECT
        pov.id,
        pog.product_id
      FROM product_option_values pov
      JOIN product_option_groups pog
        ON pog.id = pov.option_group_id
      WHERE pov.id IN (${placeholders})
        AND pog.product_id = ?
    `).bind(...optionValueIds, productId).all();

    if (results.length !== optionValueIds.length) {
      return jsonError(
        "Một hoặc nhiều option không thuộc sản phẩm này."
      );
    }
  }

  /*
   * Không cho tạo 2 variant có cùng bộ option.
   */
  if (optionValueIds.length) {
    const { results: existingVariants } = await env.DB.prepare(`
      SELECT id
      FROM product_variants
      WHERE product_id = ?
    `).bind(productId).all();

    for (const existing of existingVariants) {
      const { results: existingOptions } = await env.DB.prepare(`
        SELECT option_value_id
        FROM variant_option_values
        WHERE variant_id = ?
        ORDER BY option_value_id
      `).bind(existing.id).all();

      const existingIds = existingOptions.map(x => x.option_value_id);

      if (
        existingIds.length === optionValueIds.length &&
        existingIds.every((id, i) => id === optionValueIds.sort((a, b) => a - b)[i])
      ) {
        return jsonError("Biến thể với bộ option này đã tồn tại.");
      }
    }
  }

  /*
   * Nếu đặt làm variant mặc định,
   * bỏ mặc định của các variant khác.
   */
  if (body.is_default) {
    await env.DB.prepare(`
      UPDATE product_variants
      SET is_default = 0
      WHERE product_id = ?
    `).bind(productId).run();
  }

  const result = await env.DB.prepare(`
    INSERT INTO product_variants
      (
        product_id,
        sku,
        name,
        price,
        compare_price,
        stock,
        image_media_id,
        is_default,
        is_active
      )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    productId,
    body.sku ? String(body.sku).trim() : null,
    name,
    Number(body.price || 0),
    body.compare_price != null
      ? Number(body.compare_price || 0)
      : null,
    Number(body.stock || 0),
    body.image_media_id
      ? Number(body.image_media_id)
      : null,
    body.is_default ? 1 : 0,
    body.is_active === false ? 0 : 1
  ).run();

  const variantId = result.meta.last_row_id;

  /*
   * Lưu các option của variant.
   */
  for (const optionValueId of optionValueIds) {
    await env.DB.prepare(`
      INSERT INTO variant_option_values
        (variant_id, option_value_id)
      VALUES (?, ?)
    `).bind(
      variantId,
      optionValueId
    ).run();
  }

  return Response.json({
    ok: true,
    id: variantId
  });
}


/*
 * PUT
 * /api/admin/products/variants?id=123
 */
export async function onRequestPut({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  if (!env.DB) {
    return jsonError("D1 chưa được kết nối.", 503);
  }

  const id = Number(
    new URL(request.url).searchParams.get("id")
  );

  if (!id) {
    return jsonError("Thiếu id variant.");
  }

  const body = await request.json();

  const current = await env.DB.prepare(`
    SELECT *
    FROM product_variants
    WHERE id = ?
    LIMIT 1
  `).bind(id).first();

  if (!current) {
    return jsonError("Không tìm thấy biến thể.", 404);
  }

  const name = String(body.name || "").trim();

  if (!name) {
    return jsonError("Tên biến thể không được để trống.");
  }

  /*
   * Nếu đổi option thì kiểm tra option thuộc đúng sản phẩm.
   */
  let optionValueIds = Array.isArray(body.option_value_ids)
    ? body.option_value_ids
        .map(Number)
        .filter(Boolean)
    : null;

  if (optionValueIds) {
    optionValueIds = [...new Set(optionValueIds)];

    if (optionValueIds.length) {
      const placeholders = optionValueIds.map(() => "?").join(",");

      const { results } = await env.DB.prepare(`
        SELECT pov.id
        FROM product_option_values pov
        JOIN product_option_groups pog
          ON pog.id = pov.option_group_id
        WHERE pov.id IN (${placeholders})
          AND pog.product_id = ?
      `).bind(...optionValueIds, current.product_id).all();

      if (results.length !== optionValueIds.length) {
        return jsonError(
          "Một hoặc nhiều option không thuộc sản phẩm này."
        );
      }
    }
  }

  if (body.is_default) {
    await env.DB.prepare(`
      UPDATE product_variants
      SET is_default = 0
      WHERE product_id = ?
      AND id != ?
    `).bind(
      current.product_id,
      id
    ).run();
  }

  const result = await env.DB.prepare(`
    UPDATE product_variants
    SET
      sku = ?,
      name = ?,
      price = ?,
      compare_price = ?,
      stock = ?,
      image_media_id = ?,
      is_default = ?,
      is_active = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    body.sku ? String(body.sku).trim() : null,
    name,
    Number(body.price || 0),
    body.compare_price != null
      ? Number(body.compare_price || 0)
      : null,
    Number(body.stock || 0),
    body.image_media_id
      ? Number(body.image_media_id)
      : null,
    body.is_default ? 1 : 0,
    body.is_active === false ? 0 : 1,
    id
  ).run();

  if (!result.meta.changes) {
    return jsonError("Không thể cập nhật biến thể.", 400);
  }

  /*
   * Nếu request có option_value_ids,
   * thay toàn bộ option của variant.
   */
  if (optionValueIds) {
    await env.DB.prepare(`
      DELETE FROM variant_option_values
      WHERE variant_id = ?
    `).bind(id).run();

    for (const optionValueId of optionValueIds) {
      await env.DB.prepare(`
        INSERT INTO variant_option_values
          (variant_id, option_value_id)
        VALUES (?, ?)
      `).bind(
        id,
        optionValueId
      ).run();
    }
  }

  return Response.json({
    ok: true
  });
}


/*
 * DELETE
 * /api/admin/products/variants?id=123
 */
export async function onRequestDelete({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  if (!env.DB) {
    return jsonError("D1 chưa được kết nối.", 503);
  }

  const id = Number(
    new URL(request.url).searchParams.get("id")
  );

  if (!id) {
    return jsonError("Thiếu id variant.");
  }

  const variant = await env.DB.prepare(`
    SELECT id
    FROM product_variants
    WHERE id = ?
    LIMIT 1
  `).bind(id).first();

  if (!variant) {
    return jsonError("Không tìm thấy biến thể.", 404);
  }

  /*
   * Xóa liên kết option trước.
   */
  await env.DB.prepare(`
    DELETE FROM variant_option_values
    WHERE variant_id = ?
  `).bind(id).run();

  const result = await env.DB.prepare(`
    DELETE FROM product_variants
    WHERE id = ?
  `).bind(id).run();

  if (!result.meta.changes) {
    return jsonError("Không thể xóa biến thể.", 400);
  }

  return Response.json({
    ok: true
  });
}
