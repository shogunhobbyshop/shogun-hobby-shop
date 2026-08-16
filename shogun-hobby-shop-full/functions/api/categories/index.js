export async function onRequestGet({ env }) {
  if (!env.DB) return Response.json([{id:1,name:"Gundam"},{id:2,name:"LEGO"},{id:3,name:"Diecast"},{id:4,name:"Model Kit"}]);
  const { results } = await env.DB.prepare("SELECT * FROM categories WHERE visible=1 ORDER BY sort_order,id").all();
  return Response.json(results);
}
export async function onRequestPost({ request, env }) {
  if (!env.DB) return Response.json({error:"D1 chưa được kết nối"}, {status:503});
  const body=await request.json();
  const r=await env.DB.prepare("INSERT INTO categories(name,slug,sort_order,visible) VALUES(?,?,?,?)").bind(body.name,body.slug,body.sort_order||0,body.visible??1).run();
  return Response.json({id:r.meta.last_row_id});
}
