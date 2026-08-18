import { requireAdmin } from "../_auth.js";

export async function onRequestGet({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  if (!env.DB) return Response.json({ error: "D1 chưa được kết nối." }, { status: 503 });

  const [products, categories, visible, outOfStock] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS count FROM products").first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM categories").first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM products WHERE visible=1").first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM products WHERE stock<=0").first(),
  ]);

  return Response.json({
    products: Number(products?.count || 0),
    categories: Number(categories?.count || 0),
    visibleProducts: Number(visible?.count || 0),
    outOfStock: Number(outOfStock?.count || 0),
  });
}
