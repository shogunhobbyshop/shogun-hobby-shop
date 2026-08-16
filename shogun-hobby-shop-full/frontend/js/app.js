const demoCategories=[
 {id:1,name:"Gundam"},{id:2,name:"LEGO"},{id:3,name:"Diecast"},{id:4,name:"Model Kit"}
];
const demoProducts=[
 {name:"HG 1/144 Model Kit",price:450000,category_id:1},
 {name:"Botanicals Flower",price:320000,category_id:2},
 {name:"F1 Diecast 1:64",price:280000,category_id:3},
 {name:"MG 1/100 Model Kit",price:890000,category_id:4}
];
const money=n=>new Intl.NumberFormat("vi-VN").format(n)+"đ";
function renderCategories(cats){
 const box=document.querySelector("#category-list"), sel=document.querySelector("#category-filter");
 box.innerHTML=cats.map(c=>`<div class="category">${c.name}</div>`).join("");
 sel.innerHTML='<option value="">Tất cả danh mục</option>'+cats.map(c=>`<option value="${c.id}">${c.name}</option>`).join("");
}
function renderProducts(ps,cats){
 const box=document.querySelector("#product-list");
 box.innerHTML=ps.map(p=>`<article class="product"><div class="pic">PRODUCT</div><div class="info"><small>${cats.find(c=>c.id==p.category_id)?.name||""}</small><h3>${p.name}</h3><div class="price">${money(p.price)}</div></div></article>`).join("");
}
async function load(){
 try{
  const [cr,pr]=await Promise.all([fetch("/api/categories"),fetch("/api/products")]);
  if(cr.ok&&pr.ok){const cats=await cr.json(), ps=await pr.json(); renderCategories(cats); renderProducts(ps,cats); return;}
 }catch(e){}
 renderCategories(demoCategories); renderProducts(demoProducts,demoCategories);
}
document.querySelector("#category-filter").addEventListener("change", async e=>{
 try{
  const url=e.target.value?`/api/products?category_id=${e.target.value}`:"/api/products";
  const r=await fetch(url); if(r.ok){const ps=await r.json(); renderProducts(ps,demoCategories);}
 }catch(e){}
});
load();