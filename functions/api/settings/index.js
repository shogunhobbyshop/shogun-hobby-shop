export async function onRequestGet({ env }) {
  if (!env.DB) return Response.json({shop_name:"ShogunHobbyShop",tagline:"Thế giới hobby không giới hạn.",phone:"0900 000 000",zalo:"#",facebook:"#"});
  const {results}=await env.DB.prepare("SELECT key,value FROM settings").all();
  return Response.json(Object.fromEntries(results.map(x=>[x.key,x.value])));
}
