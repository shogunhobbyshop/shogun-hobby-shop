const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const money = (n) => new Intl.NumberFormat("vi-VN").format(Number(n || 0)) + "đ";
const esc = (v) => String(v ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
let token = sessionStorage.getItem("shogun_admin_token") || "";
let products = [];
let categories = [];
let editingProduct = null;
let editingCategory = null;

function toast(msg, type="ok") { const el=$("#toast"); el.textContent=msg; el.className=`toast show ${type}`; setTimeout(()=>el.className="toast",2600); }
function openModal(id){ $("#"+id).classList.remove("hidden"); }
function closeModal(id){ $("#"+id).classList.add("hidden"); }
function authHeaders(json=false){ const h={Authorization:`Bearer ${token}`}; if(json) h["Content-Type"]="application/json"; return h; }
async function api(url, opts={}) {
  const res = await fetch(url, {...opts, headers:{...authHeaders(!!opts.body), ...(opts.headers||{})}});
  let data={}; try{data=await res.json();}catch{}
  if(res.status===401){ logout(false); throw new Error("Phiên đăng nhập đã hết."); }
  if(!res.ok) throw new Error(data.error || "Có lỗi xảy ra.");
  return data;
}

function showApp(){ $("#login-view").classList.add("hidden"); $("#app-view").classList.remove("hidden"); loadAll(); route(); }
function logout(show=true){ sessionStorage.removeItem("shogun_admin_token"); token=""; $("#app-view").classList.add("hidden"); $("#login-view").classList.remove("hidden"); if(show) toast("Đã đăng xuất."); }

$("#login-form").addEventListener("submit", async e=>{
  e.preventDefault(); const p=$("#login-password").value.trim(); if(!p)return;
  token=p;
  try { await api("/api/admin/dashboard"); sessionStorage.setItem("shogun_admin_token",token); $("#login-password").value=""; $("#login-error").textContent=""; showApp(); }
  catch(err){ token=""; $("#login-error").textContent=err.message; }
});
$("#logout").onclick=()=>logout(true);

async function loadAll(){
  try {
    const [d,c,p,s] = await Promise.all([
      api("/api/admin/dashboard"), api("/api/admin/categories"), api("/api/admin/products"), api("/api/admin/settings")
    ]);
    renderStats(d); categories=c; products=p; renderCategorySelects(); renderProducts(); renderCategories(); fillSettings(s);
  } catch(e) { toast(e.message,"error"); }
}
function renderStats(d){ $("#stat-products").textContent=d.products; $("#stat-categories").textContent=d.categories; $("#stat-visible").textContent=d.visibleProducts; $("#stat-out").textContent=d.outOfStock; }
function renderCategorySelects(){
  const filter=$("#product-category-filter"); const old=filter.value;
  filter.innerHTML='<option value="">Tất cả danh mục</option>'+categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join(""); filter.value=old;
  const sel=$("#product-category"); sel.innerHTML='<option value="">— Chưa chọn —</option>'+categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
}
function renderProducts(){
  const q=$("#product-search").value.toLowerCase().trim(), cat=$("#product-category-filter").value;
  const list=products.filter(p=>(!q||p.name.toLowerCase().includes(q))&&(!cat||String(p.category_id)===String(cat)));
  if(!list.length){ $("#product-table").innerHTML='<div class="empty">Chưa có sản phẩm phù hợp.</div>'; return; }
  $("#product-table").innerHTML=`<table><thead><tr><th>Sản phẩm</th><th>Danh mục</th><th>Giá</th><th>Tồn kho</th><th>Trạng thái</th><th></th></tr></thead><tbody>${list.map(p=>`<tr>
<td><div class="prod-name">${p.image_url?`<img src="${esc(p.image_url)}" alt="">`:''}<div><b>${esc(p.name)}</b><small>#${p.id}</small></div></div></td>
<td>${esc(p.category_name||"—")}</td><td>${money(p.price)}</td><td>${p.stock}</td>
<td><span class="badge ${p.visible?'on':'off'}">${p.visible?'Đang bán':'Đang ẩn'}</span></td>
<td class="actions"><button class="link edit-product" data-id="${p.id}">Sửa</button><button class="link danger delete-product" data-id="${p.id}">Xóa</button></td>
</tr>`).join("")}</tbody></table>`;
  $$(".edit-product").forEach(b=>b.onclick=()=>openProduct(Number(b.dataset.id)));
  $$(".delete-product").forEach(b=>b.onclick=()=>deleteProduct(Number(b.dataset.id)));
}
function renderCategories(){
  if(!categories.length){$("#category-table").innerHTML='<div class="empty">Chưa có danh mục.</div>';return;}
  $("#category-table").innerHTML=`<table><thead><tr><th>Tên</th><th>Slug</th><th>Thứ tự</th><th>Trạng thái</th><th></th></tr></thead><tbody>${categories.map(c=>`<tr><td><b>${esc(c.name)}</b></td><td>${esc(c.slug)}</td><td>${c.sort_order}</td><td><span class="badge ${c.visible?'on':'off'}">${c.visible?'Hiển thị':'Đang ẩn'}</span></td><td class="actions"><button class="link edit-category" data-id="${c.id}">Sửa</button><button class="link danger delete-category" data-id="${c.id}">Xóa</button></td></tr>`).join("")}</tbody></table>`;
  $$(".edit-category").forEach(b=>b.onclick=()=>openCategory(Number(b.dataset.id)));
  $$(".delete-category").forEach(b=>b.onclick=()=>deleteCategory(Number(b.dataset.id)));
}
function fillSettings(s){ ["shop_name","tagline","phone","zalo","facebook"].forEach(k=>$("#"+k).value=s[k]||""); }

function openProduct(id=null){
  editingProduct=id?products.find(p=>p.id===id):null;
  $("#product-modal-title").textContent=editingProduct?"Sửa sản phẩm":"Thêm sản phẩm";
  $("#product-id").value=editingProduct?.id||""; $("#product-name").value=editingProduct?.name||""; $("#product-price").value=editingProduct?.price||0;
  $("#product-category").value=editingProduct?.category_id||""; $("#product-stock").value=editingProduct?.stock||0; $("#product-image").value=editingProduct?.image_url||"";
  $("#product-description").value=editingProduct?.description||""; $("#product-visible").checked=editingProduct?!!editingProduct.visible:true; openModal("product-modal");
}
$("#product-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const body={name:$("#product-name").value,price:Number($("#product-price").value||0),category_id:$("#product-category").value||null,stock:Number($("#product-stock").value||0),image_url:$("#product-image").value,description:$("#product-description").value,visible:$("#product-visible").checked};
  try { await api(editingProduct?`/api/admin/products?id=${editingProduct.id}`:"/api/admin/products",{method:editingProduct?"PUT":"POST",body:JSON.stringify(body)}); closeModal("product-modal"); toast(editingProduct?"Đã cập nhật sản phẩm.":"Đã thêm sản phẩm."); await loadAll(); }
  catch(err){toast(err.message,"error");}
});
async function deleteProduct(id){ const p=products.find(x=>x.id===id); if(!p||!confirm(`Xóa sản phẩm “${p.name}”?`))return; try{await api(`/api/admin/products?id=${id}`,{method:"DELETE"});toast("Đã xóa sản phẩm.");await loadAll();}catch(e){toast(e.message,"error");} }

function openCategory(id=null){
  editingCategory=id?categories.find(c=>c.id===id):null;
  $("#category-modal-title").textContent=editingCategory?"Sửa danh mục":"Thêm danh mục";
  $("#category-id").value=editingCategory?.id||""; $("#category-name").value=editingCategory?.name||""; $("#category-order").value=editingCategory?.sort_order||0; $("#category-image").value=editingCategory?.image_url||""; $("#category-visible").checked=editingCategory?!!editingCategory.visible:true; openModal("category-modal");
}
$("#category-form").addEventListener("submit",async e=>{
  e.preventDefault(); const body={name:$("#category-name").value,sort_order:Number($("#category-order").value||0),image_url:$("#category-image").value,visible:$("#category-visible").checked};
  try{await api(editingCategory?`/api/admin/categories?id=${editingCategory.id}`:"/api/admin/categories",{method:editingCategory?"PUT":"POST",body:JSON.stringify(body)});closeModal("category-modal");toast(editingCategory?"Đã cập nhật danh mục.":"Đã thêm danh mục.");await loadAll();}catch(e){toast(e.message,"error");}
});
async function deleteCategory(id){const c=categories.find(x=>x.id===id);if(!c||!confirm(`Xóa danh mục “${c.name}”?`))return;try{await api(`/api/admin/categories?id=${id}`,{method:"DELETE"});toast("Đã xóa danh mục.");await loadAll();}catch(e){toast(e.message,"error");}}

$("#settings-form").addEventListener("submit",async e=>{e.preventDefault();const body=Object.fromEntries(["shop_name","tagline","phone","zalo","facebook"].map(k=>[k,$("#"+k).value]));try{await api("/api/admin/settings",{method:"PUT",body:JSON.stringify(body)});toast("Đã lưu thông tin shop.");}catch(e){toast(e.message,"error");}});
$("#add-product").onclick=()=>openProduct(); $("#quick-add").onclick=()=>openProduct(); $("#add-category").onclick=()=>openCategory(); $("#product-search").oninput=renderProducts; $("#product-category-filter").onchange=renderProducts;
$$("[data-close]").forEach(b=>b.onclick=()=>closeModal(b.dataset.close));
$$(".modal").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)m.classList.add("hidden");}));

function route(){const hash=location.hash.replace("#","")||"dashboard";const id=["dashboard","products","categories","settings"].includes(hash)?hash:"dashboard";$$('.page-section').forEach(s=>s.classList.toggle("hidden",s.id!==id));$$('[data-nav]').forEach(a=>a.classList.toggle("active",a.dataset.nav===id));}
window.addEventListener("hashchange",route); 
$("#mobile-menu").onclick=()=>$(".sidebar").classList.toggle("open");

if(token){api("/api/admin/dashboard").then(showApp).catch(()=>logout(false));}
