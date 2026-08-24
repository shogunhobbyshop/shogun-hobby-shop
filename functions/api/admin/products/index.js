import { requireAdmin, slugify, jsonError } from "../_auth.js";

async function uniqueSlug(db, base, ignoreId = null) {
  let slug = slugify(base);
  let candidate = slug;
  let n = 2;

  while (true) {
    const row =
      ignoreId == null
        ? await db
            .prepare("SELECT id FROM products WHERE slug=? LIMIT 1")
            .bind(candidate)
            .first()
        : await db
            .prepare(
              "SELECT id FROM products WHERE slug=? AND id!=? LIMIT 1"
            )
            .bind(candidate, ignoreId)
            .first();

    if (!row) return candidate;

    candidate = `${slug}-${n++}`;
  }
}

function ok(data = {}) {
  return Response.json({ ok: true, ...data });
}

/* =========================================================
   GET
   ========================================================= */

export async function onRequestGet({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  if (!env.DB) {
    return jsonError("D1 chưa được kết nối.", 503);
  }

  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id") || 0);

  /* -------------------------------------------------------
     GET SINGLE PRODUCT - FULL DATA
     /api/admin/products?id=123
     ------------------------------------------------------- */

  if (id) {
    const product = await env.DB
      .prepare(`
        SELECT
          p.*,
          c.name AS category_name
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.id = ?
        LIMIT 1
      `)
      .bind(id)
      .first();

    if (!product) {
      return jsonError("Không tìm thấy sản phẩm.", 404);
    }

    const optionGroups = await env.DB
      .prepare(`
        SELECT *
        FROM product_option_groups
        WHERE product_id = ?
        ORDER BY sort_order ASC, id ASC
      `)
      .bind(id)
      .all();

    const optionGroupIds = optionGroups.results.map(x => x.id);

    let optionValues = [];

    if (optionGroupIds.length) {
      const placeholders = optionGroupIds.map(() => "?").join(",");

      const result = await env.DB
        .prepare(`
          SELECT *
          FROM product_option_values
          WHERE option_group_id IN (${placeholders})
          ORDER BY sort_order ASC, id ASC
        `)
        .bind(...optionGroupIds)
        .all();

      optionValues = result.results;
    }

    const variants = await env.DB
      .prepare(`
        SELECT *
        FROM product_variants
        WHERE product_id = ?
        ORDER BY id ASC
      `)
      .bind(id)
      .all();

    const variantIds = variants.results.map(x => x.id);

    let variantOptions = [];
    let media = [];

    if (variantIds.length) {
      const placeholders = variantIds.map(() => "?").join(",");

      const vo = await env.DB
        .prepare(`
          SELECT *
          FROM variant_option_values
          WHERE variant_id IN (${placeholders})
        `)
        .bind(...variantIds)
        .all();

      variantOptions = vo.results;
    }

    const mediaResult = await env.DB
      .prepare(`
        SELECT *
        FROM product_media
        WHERE product_id = ?
        ORDER BY sort_order ASC, id ASC
      `)
      .bind(id)
      .all();

    media = mediaResult.results;

    return Response.json({
      product,
      option_groups: optionGroups.results,
      option_values: optionValues,
      variants: variants.results,
      variant_option_values: variantOptions,
      media
    });
  }

  /* -------------------------------------------------------
     GET ALL PRODUCTS
     /api/admin/products
     ------------------------------------------------------- */

  const { results } = await env.DB
    .prepare(`
      SELECT
        p.*,
        c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      ORDER BY p.id DESC
    `)
    .all();

  return Response.json(results);
}

/* =========================================================
   POST
   ========================================================= */

export async function onRequestPost({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  if (!env.DB) {
    return jsonError("D1 chưa được kết nối.", 503);
  }

  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "product";

  const b = await request.json();

  /* =====================================================
     CREATE PRODUCT
     ===================================================== */

  if (action === "product") {
    if (!b.name?.trim()) {
      return jsonError("Tên sản phẩm không được để trống.");
    }

    const slug = await uniqueSlug(env.DB, b.slug || b.name);

    const result = await env.DB
      .prepare(`
        INSERT INTO products
          (
            name,
            slug,
            price,
            category_id,
            description,
            image_url,
            stock,
            visible
          )
        VALUES (?,?,?,?,?,?,?,?)
      `)
      .bind(
        b.name.trim(),
        slug,
        Number(b.price || 0),
        b.category_id ? Number(b.category_id) : null,
        b.description || "",
        b.image_url || "",
        Number(b.stock || 0),
        b.visible ? 1 : 0
      )
      .run();

    return ok({
      id: result.meta.last_row_id
    });
  }

  /* =====================================================
     CREATE OPTION GROUP
     ===================================================== */

  if (action === "option-group") {
    if (!b.product_id) {
      return jsonError("Thiếu product_id.");
    }

    if (!b.name?.trim()) {
      return jsonError("Tên option không được để trống.");
    }

    const allowedTypes = ["select", "color", "button", "addon"];

    const type = allowedTypes.includes(b.type)
      ? b.type
      : "select";

    const result = await env.DB
      .prepare(`
        INSERT INTO product_option_groups
          (
            product_id,
            name,
            type,
            sort_order,
            is_required
          )
        VALUES (?,?,?,?,?)
      `)
      .bind(
        Number(b.product_id),
        b.name.trim(),
        type,
        Number(b.sort_order || 0),
        b.is_required === false ? 0 : 1
      )
      .run();

    return ok({
      id: result.meta.last_row_id
    });
  }

  /* =====================================================
     CREATE OPTION VALUE
     ===================================================== */

  if (action === "option-value") {
    if (!b.option_group_id) {
      return jsonError("Thiếu option_group_id.");
    }

    if (!b.name?.trim()) {
      return jsonError("Tên option value không được để trống.");
    }

    const result = await env.DB
      .prepare(`
        INSERT INTO product_option_values
          (
            option_group_id,
            name,
            slug,
            sort_order
          )
        VALUES (?,?,?,?)
      `)
      .bind(
        Number(b.option_group_id),
        b.name.trim(),
        slugify(b.name),
        Number(b.sort_order || 0)
      )
      .run();

    return ok({
      id: result.meta.last_row_id
    });
  }

  /* =====================================================
     CREATE VARIANT
     ===================================================== */

  if (action === "variant") {
    if (!b.product_id) {
      return jsonError("Thiếu product_id.");
    }

    const result = await env.DB
      .prepare(`
        INSERT INTO product_variants
          (
            product_id,
            sku,
            name,
            price,
            stock,
            image_media_id,
            is_active
          )
        VALUES (?,?,?,?,?,?,?)
      `)
      .bind(
        Number(b.product_id),
        b.sku || "",
        b.name || "",
        Number(b.price || 0),
        Number(b.stock || 0),
        b.image_media_id ? Number(b.image_media_id) : null,
        b.is_active === false ? 0 : 1
      )
      .run();

    const variantId = result.meta.last_row_id;

    /* ---------------------------------------------
       OPTION VALUES OF VARIANT
       --------------------------------------------- */

    if (
      Array.isArray(b.option_value_ids) &&
      b.option_value_ids.length
    ) {
      for (const valueId of b.option_value_ids) {
        if (!valueId) continue;

        await env.DB
          .prepare(`
            INSERT INTO variant_option_values
              (
                variant_id,
                option_value_id
              )
            VALUES (?,?)
          `)
          .bind(
            Number(variantId),
            Number(valueId)
          )
          .run();
      }
    }

    return ok({
      id: variantId
    });
  }

  /* =====================================================
     CREATE DEPENDENCY
     ===================================================== */

  if (action === "dependency") {
    if (!b.parent_option_value_id || !b.child_option_value_id) {
      return jsonError(
        "Thiếu parent_option_value_id hoặc child_option_value_id."
      );
    }

    const result = await env.DB
      .prepare(`
        INSERT INTO option_value_dependencies
          (
            parent_option_value_id,
            child_option_value_id
          )
        VALUES (?,?)
      `)
      .bind(
        Number(b.parent_option_value_id),
        Number(b.child_option_value_id)
      )
      .run();

    return ok({
      id: result.meta.last_row_id
    });
  }

  /* =====================================================
     CREATE MEDIA
     ===================================================== */

  if (action === "media") {
    if (!b.product_id) {
      return jsonError("Thiếu product_id.");
    }

    if (!b.url?.trim()) {
      return jsonError("Thiếu URL media.");
    }

    const result = await env.DB
      .prepare(`
        INSERT INTO product_media
          (
            product_id,
            variant_id,
            url,
            media_type,
            sort_order,
            alt_text
          )
        VALUES (?,?,?,?,?,?)
      `)
      .bind(
        Number(b.product_id),
        b.variant_id ? Number(b.variant_id) : null,
        b.url.trim(),
        b.media_type || "image",
        Number(b.sort_order || 0),
        b.alt_text || ""
      )
      .run();

    return ok({
      id: result.meta.last_row_id
    });
  }

  return jsonError("Action không hợp lệ.");
}

/* =========================================================
   PUT
   ========================================================= */

export async function onRequestPut({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  if (!env.DB) {
    return jsonError("D1 chưa được kết nối.", 503);
  }

  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id") || 0);
  const action = url.searchParams.get("action") || "product";

  if (!id) {
    return jsonError("Thiếu id.");
  }

  const b = await request.json();

  /* =====================================================
     UPDATE PRODUCT
     ===================================================== */

  if (action === "product") {
    if (!b.name?.trim()) {
      return jsonError("Tên sản phẩm không được để trống.");
    }

    const slug = await uniqueSlug(
      env.DB,
      b.slug || b.name,
      id
    );

    const result = await env.DB
      .prepare(`
        UPDATE products SET
          name=?,
          slug=?,
          price=?,
          category_id=?,
          description=?,
          image_url=?,
          stock=?,
          visible=?,
          updated_at=CURRENT_TIMESTAMP
        WHERE id=?
      `)
      .bind(
        b.name.trim(),
        slug,
        Number(b.price || 0),
        b.category_id ? Number(b.category_id) : null,
        b.description || "",
        b.image_url || "",
        Number(b.stock || 0),
        b.visible ? 1 : 0,
        id
      )
      .run();

    if (!result.meta.changes) {
      return jsonError(
        "Không tìm thấy sản phẩm.",
        404
      );
    }

    return ok();
  }

  /* =====================================================
     UPDATE OPTION GROUP
     ===================================================== */

  if (action === "option-group") {
    if (!b.name?.trim()) {
      return jsonError("Tên option không được để trống.");
    }

    const allowedTypes = [
      "select",
      "color",
      "button",
      "addon"
    ];

    const type = allowedTypes.includes(b.type)
      ? b.type
      : "select";

    const result = await env.DB
      .prepare(`
        UPDATE product_option_groups SET
          name=?,
          type=?,
          sort_order=?,
          is_required=?
        WHERE id=?
      `)
      .bind(
        b.name.trim(),
        type,
        Number(b.sort_order || 0),
        b.is_required === false ? 0 : 1,
        id
      )
      .run();

    if (!result.meta.changes) {
      return jsonError(
        "Không tìm thấy option group.",
        404
      );
    }

    return ok();
  }

  /* =====================================================
     UPDATE OPTION VALUE
     ===================================================== */

  if (action === "option-value") {
    if (!b.name?.trim()) {
      return jsonError("Tên option value không được để trống.");
    }

    const result = await env.DB
      .prepare(`
        UPDATE product_option_values SET
          name=?,
          slug=?,
          sort_order=?
        WHERE id=?
      `)
      .bind(
        b.name.trim(),
        slugify(b.name),
        Number(b.sort_order || 0),
        id
      )
      .run();

    if (!result.meta.changes) {
      return jsonError(
        "Không tìm thấy option value.",
        404
      );
    }

    return ok();
  }

  /* =====================================================
     UPDATE VARIANT
     ===================================================== */

  if (action === "variant") {
    const result = await env.DB
      .prepare(`
        UPDATE product_variants SET
          sku=?,
          name=?,
          price=?,
          stock=?,
          image_media_id=?,
          is_active=?,
          updated_at=CURRENT_TIMESTAMP
        WHERE id=?
      `)
      .bind(
        b.sku || "",
        b.name || "",
        Number(b.price || 0),
        Number(b.stock || 0),
        b.image_media_id
          ? Number(b.image_media_id)
          : null,
        b.is_active === false ? 0 : 1,
        id
      )
      .run();

    if (!result.meta.changes) {
      return jsonError(
        "Không tìm thấy variant.",
        404
      );
    }

    /* ---------------------------------------------
       REPLACE OPTION VALUES
       --------------------------------------------- */

    await env.DB
      .prepare(
        "DELETE FROM variant_option_values WHERE variant_id=?"
      )
      .bind(id)
      .run();

    if (
      Array.isArray(b.option_value_ids) &&
      b.option_value_ids.length
    ) {
      for (const valueId of b.option_value_ids) {
        if (!valueId) continue;

        await env.DB
          .prepare(`
            INSERT INTO variant_option_values
              (
                variant_id,
                option_value_id
              )
            VALUES (?,?)
          `)
          .bind(
            id,
            Number(valueId)
          )
          .run();
      }
    }

    return ok();
  }

  /* =====================================================
     UPDATE MEDIA
     ===================================================== */

  if (action === "media") {
    const result = await env.DB
      .prepare(`
        UPDATE product_media SET
          url=?,
          media_type=?,
          sort_order=?,
          alt_text=?,
          variant_id=?
        WHERE id=?
      `)
      .bind(
        b.url || "",
        b.media_type || "image",
        Number(b.sort_order || 0),
        b.alt_text || "",
        b.variant_id
          ? Number(b.variant_id)
          : null,
        id
      )
      .run();

    if (!result.meta.changes) {
      return jsonError(
        "Không tìm thấy media.",
        404
      );
    }

    return ok();
  }

  return jsonError("Action không hợp lệ.");
}

/* =========================================================
   DELETE
   ========================================================= */

export async function onRequestDelete({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  if (!env.DB) {
    return jsonError("D1 chưa được kết nối.", 503);
  }

  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id") || 0);
  const action = url.searchParams.get("action") || "product";

  if (!id) {
    return jsonError("Thiếu id.");
  }

  /* =====================================================
     DELETE PRODUCT
     ===================================================== */

  if (action === "product") {
    const result = await env.DB
      .prepare(
        "DELETE FROM products WHERE id=?"
      )
      .bind(id)
      .run();

    if (!result.meta.changes) {
      return jsonError(
        "Không tìm thấy sản phẩm.",
        404
      );
    }

    return ok();
  }

  /* =====================================================
     DELETE OPTION GROUP
     ===================================================== */

  if (action === "option-group") {
    const result = await env.DB
      .prepare(`
        DELETE FROM product_option_groups
        WHERE id=?
      `)
      .bind(id)
      .run();

    if (!result.meta.changes) {
      return jsonError(
        "Không tìm thấy option group.",
        404
      );
    }

    return ok();
  }

  /* =====================================================
     DELETE OPTION VALUE
     ===================================================== */

  if (action === "option-value") {
    const result = await env.DB
      .prepare(`
        DELETE FROM product_option_values
        WHERE id=?
      `)
      .bind(id)
      .run();

    if (!result.meta.changes) {
      return jsonError(
        "Không tìm thấy option value.",
        404
      );
    }

    return ok();
  }

  /* =====================================================
     DELETE VARIANT
     ===================================================== */

  if (action === "variant") {
    const result = await env.DB
      .prepare(`
        DELETE FROM product_variants
        WHERE id=?
      `)
      .bind(id)
      .run();

    if (!result.meta.changes) {
      return jsonError(
        "Không tìm thấy variant.",
        404
      );
    }

    return ok();
  }

  /* =====================================================
     DELETE DEPENDENCY
     ===================================================== */

  if (action === "dependency") {
    const result = await env.DB
      .prepare(`
        DELETE FROM option_value_dependencies
        WHERE id=?
      `)
      .bind(id)
      .run();

    if (!result.meta.changes) {
      return jsonError(
        "Không tìm thấy dependency.",
        404
      );
    }

    return ok();
  }

  /* =====================================================
     DELETE MEDIA
     ===================================================== */

  if (action === "media") {
    const result = await env.DB
      .prepare(`
        DELETE FROM product_media
        WHERE id=?
      `)
      .bind(id)
      .run();

    if (!result.meta.changes) {
      return jsonError(
        "Không tìm thấy media.",
        404
      );
    }

    return ok();
  }

  return jsonError("Action không hợp lệ.");
}
