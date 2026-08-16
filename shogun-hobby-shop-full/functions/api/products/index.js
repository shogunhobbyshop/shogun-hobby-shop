export async function onRequestGet({ request, env }) {
  if (!env.DB) return Response.json([
    {id:1,name:"HG 1/144 Model Kit",price:450000,category_id:1,stock:5},
    {id:2,name:"Botanicals Flower",price:320000,category_id:2,stock:10},
    {id:3,name:"F1 Diecast 1:64",price:280000,category_id:3,stock:8},
    {id:4,name:"MG 1/100 Model Kit",price:890000,category_id:4,stock:3}
  ]);
  const categoryId=new URL(request.url).searchParams.get("category_id");
  const sql=categoryId
    ? "SELECT * FROM products WHERE visible=1 AND category_id=? ORDER BY id DESC"
    : "SELECT * FROM products WHERE visible=1 ORDER BY id DESC";
  const q=categoryId?env.DB.prepare(sql).bind(categoryId):env.DB.prepare(sql);
  const {results}=await q.all();
  return Response.json(results);
}
export async function onRequestPost({ request, env }) {
  if (!env.DB) return Response.json({error:"D1 chưa được kết nối"}, {status:503});
  const b=await request.json();
  const r=await env.DB.prepare(`INSERT INTO products(name,slug,price,category_id,description,image_url,stock,visible) VALUES(?,?,?,?,?,?,?,?)`)
    .bind(b.name,b.slug,b.price||0,b.category_id||null,b.description||"",b.image_url||"",b.stock||0,b.visible??1).run();
  return Response.json({id:r.meta.last_row_id});
}
