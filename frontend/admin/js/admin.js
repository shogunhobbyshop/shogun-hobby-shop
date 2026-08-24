const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const money = (n) =>
  new Intl.NumberFormat("vi-VN").format(Number(n || 0)) + "đ";

const esc = (v) =>
  String(v ?? "").replace(/[&<>'"]/g, c => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    "'":"&#39;",
    '"':"&quot;"
  }[c]));

let token =
  sessionStorage.getItem("shogun_admin_token") || "";

let products = [];
let categories = [];

let editingProduct = null;
let editingCategory = null;


/* =========================
   UI
========================= */

function toast(msg, type="ok") {

  const el = $("#toast");

  el.textContent = msg;
  el.className = `toast show ${type}`;

  setTimeout(() => {
    el.className = "toast";
  }, 2600);
}


function openModal(id) {
  $("#" + id).classList.remove("hidden");
}


function closeModal(id) {
  $("#" + id).classList.add("hidden");
}


/* =========================
   AUTH
========================= */

function authHeaders(json=false) {

  const h = {
    Authorization: `Bearer ${token}`
  };

  if(json){
    h["Content-Type"] = "application/json";
  }

  return h;
}


async function api(url, opts={}) {

  const res = await fetch(url, {
    ...opts,
    headers: {
      ...authHeaders(!!opts.body),
      ...(opts.headers || {})
    }
  });

  let data = {};

  try {
    data = await res.json();
  } catch {}

  if(res.status === 401){

    logout(false);

    throw new Error(
      "Phiên đăng nhập đã hết."
    );
  }

  if(!res.ok){

    throw new Error(
      data.error || "Có lỗi xảy ra."
    );
  }

  return data;
}


/* =========================
   APP
========================= */

function showApp(){

  $("#login-view").classList.add("hidden");

  $("#app-view").classList.remove("hidden");

  loadAll();

  route();
}


function logout(show=true){

  sessionStorage.removeItem(
    "shogun_admin_token"
  );

  token = "";

  $("#app-view").classList.add("hidden");

  $("#login-view").classList.remove("hidden");

  if(show){
    toast("Đã đăng xuất.");
  }
}


/* LOGIN */

$("#login-form").addEventListener(
  "submit",
  async e => {

    e.preventDefault();

    const p =
      $("#login-password").value.trim();

    if(!p) return;

    token = p;

    try{

      await api(
        "/api/admin/dashboard"
      );

      sessionStorage.setItem(
        "shogun_admin_token",
        token
      );

      $("#login-password").value = "";

      $("#login-error").textContent = "";

      showApp();

    }catch(err){

      token = "";

      $("#login-error").textContent =
        err.message;
    }

  }
);


$("#logout").onclick = () =>
  logout(true);


/* =========================
   LOAD DATA
========================= */

async function loadAll(){

  try{

    const [
      dashboard,
      categoryData,
      productData,
      settings
    ] = await Promise.all([

      api("/api/admin/dashboard"),

      api("/api/admin/categories"),

      api("/api/admin/products"),

      api("/api/admin/settings")

    ]);


    renderStats(dashboard);

    categories = categoryData;

    products = productData;

    renderCategorySelects();

    renderProducts();

    renderCategories();

    fillSettings(settings);

  }catch(e){

    toast(
      e.message,
      "error"
    );

  }
}


/* =========================
   DASHBOARD
========================= */

function renderStats(d){

  $("#stat-products").textContent =
    d.products ?? 0;

  $("#stat-categories").textContent =
    d.categories ?? 0;

  $("#stat-visible").textContent =
    d.visibleProducts ?? 0;

  $("#stat-out").textContent =
    d.outOfStock ?? 0;
}


/* =========================
   CATEGORY SELECT
========================= */

function renderCategorySelects(){

  const filter =
    $("#product-category-filter");

  const old =
    filter.value;

  filter.innerHTML =
    '<option value="">Tất cả danh mục</option>' +

    categories.map(c => `
      <option value="${c.id}">
        ${esc(c.name)}
      </option>
    `).join("");

  filter.value = old;


  const select =
    $("#product-category");

  select.innerHTML =
    '<option value="">— Chưa chọn —</option>' +

    categories.map(c => `
      <option value="${c.id}">
        ${esc(c.name)}
      </option>
    `).join("");
}


/* =========================
   PRODUCTS
========================= */

function renderProducts(){

  const q =
    $("#product-search")
      .value
      .toLowerCase()
      .trim();

  const cat =
    $("#product-category-filter")
      .value;


  const list =
    products.filter(p =>

      (!q ||
        String(p.name || "")
          .toLowerCase()
          .includes(q)
      )

      &&

      (!cat ||
        String(p.category_id) ===
        String(cat)
      )

    );


  if(!list.length){

    $("#product-table").innerHTML =
      `
      <div class="empty">
        <b>Chưa có sản phẩm phù hợp.</b>
        <br>
        <small>
          Hãy thêm sản phẩm mới hoặc thay đổi bộ lọc.
        </small>
      </div>
      `;

    return;
  }


  $("#product-table").innerHTML = `

    <table>

      <thead>

        <tr>
          <th>Sản phẩm</th>
          <th>Danh mục</th>
          <th>Giá</th>
          <th>Tồn kho</th>
          <th>Trạng thái</th>
          <th></th>
        </tr>

      </thead>

      <tbody>

        ${list.map(p => `

          <tr>

            <td>

              <div class="prod-name">

                ${
                  p.image_url
                  ?
                  `<img
                    src="${esc(p.image_url)}"
                    alt=""
                  >`
                  :
                  `<div
                    class="prod-name-placeholder"
                    style="
                      width:52px;
                      height:52px;
                      border-radius:8px;
                      background:#eee;
                      display:grid;
                      place-items:center;
                      color:#aaa;
                    "
                  >
                    ?
                  </div>`
                }

                <div>

                  <b>
                    ${esc(p.name)}
                  </b>

                  <small>
                    #${p.id}
                  </small>

                </div>

              </div>

            </td>


            <td>
              ${esc(p.category_name || "—")}
            </td>


            <td>
              ${money(p.price)}
            </td>


            <td>
              ${p.stock ?? 0}
            </td>


            <td>

              <span
                class="badge ${p.visible ? "on" : "off"}"
              >
                ${
                  p.visible
                  ? "Đang bán"
                  : "Đang ẩn"
                }
              </span>

            </td>


            <td class="actions">

              <button
                class="link edit-product"
                data-id="${p.id}"
              >
                Sửa
              </button>

              <button
                class="link danger delete-product"
                data-id="${p.id}"
              >
                Xóa
              </button>

            </td>

          </tr>

        `).join("")}

      </tbody>

    </table>
  `;


  $$(".edit-product")
    .forEach(btn => {

      btn.onclick = () =>
        openProduct(
          Number(btn.dataset.id)
        );

    });


  $$(".delete-product")
    .forEach(btn => {

      btn.onclick = () =>
        deleteProduct(
          Number(btn.dataset.id)
        );

    });
}


/* =========================
   PRODUCT MODAL
========================= */

function openProduct(id=null){

  editingProduct =
    id
      ? products.find(
          p => p.id === id
        )
      : null;


  $("#product-modal-title")
    .textContent =
      editingProduct
      ? "Sửa sản phẩm"
      : "Thêm sản phẩm";


  $("#product-id").value =
    editingProduct?.id || "";


  $("#product-name").value =
    editingProduct?.name || "";


  $("#product-price").value =
    editingProduct?.price || 0;


  $("#product-category").value =
    editingProduct?.category_id || "";


  $("#product-stock").value =
    editingProduct?.stock || 0;


  $("#product-image").value =
    editingProduct?.image_url || "";


  $("#product-description").value =
    editingProduct?.description || "";


  $("#product-visible").checked =
    editingProduct
      ? !!editingProduct.visible
      : true;


  updateImagePreview();

  openModal("product-modal");
}


/* IMAGE PREVIEW */

function updateImagePreview(){

  const url =
    $("#product-image").value.trim();

  const box =
    $("#product-image-preview");


  if(!url){

    box.innerHTML =
      "<span>Chưa có ảnh</span>";

    return;
  }


  box.innerHTML = `
    <img
      src="${esc(url)}"
      alt="Preview"
      onerror="
        this.parentElement.innerHTML =
        '<span>Không tải được ảnh</span>'
      "
    >
  `;
}


$("#product-image")
  .addEventListener(
    "input",
    updateImagePreview
  );


/* SAVE PRODUCT */

$("#product-form")
  .addEventListener(
    "submit",
    async e => {

      e.preventDefault();


      const body = {

        name:
          $("#product-name")
            .value
            .trim(),

        price:
          Number(
            $("#product-price")
              .value || 0
          ),

        category_id:
          $("#product-category")
            .value || null,

        stock:
          Number(
            $("#product-stock")
              .value || 0
          ),

        image_url:
          $("#product-image")
            .value
            .trim(),

        description:
          $("#product-description")
            .value,

        visible:
          $("#product-visible")
            .checked

      };


      try{

        await api(

          editingProduct

            ? `/api/admin/products?id=${editingProduct.id}`

            : "/api/admin/products",

          {

            method:
              editingProduct
              ? "PUT"
              : "POST",

            body:
              JSON.stringify(body)

          }

        );


        closeModal(
          "product-modal"
        );


        toast(
          editingProduct
          ? "Đã cập nhật sản phẩm."
          : "Đã thêm sản phẩm."
        );


        await loadAll();


      }catch(err){

        toast(
          err.message,
          "error"
        );

      }

    }
  );


/* DELETE PRODUCT */

async function deleteProduct(id){

  const p =
    products.find(
      x => x.id === id
    );

  if(
    !p ||
    !confirm(
      `Xóa sản phẩm “${p.name}”?`
    )
  ){
    return;
  }


  try{

    await api(
      `/api/admin/products?id=${id}`,
      {
        method:"DELETE"
      }
    );


    toast(
      "Đã xóa sản phẩm."
    );


    await loadAll();

  }catch(e){

    toast(
      e.message,
      "error"
    );

  }
}


/* =========================
   CATEGORIES
========================= */

function renderCategories(){

  if(!categories.length){

    $("#category-table").innerHTML =
      `
      <div class="empty">
        Chưa có danh mục.
      </div>
      `;

    return;
  }


  $("#category-table").innerHTML = `

    <table>

      <thead>

        <tr>
          <th>Tên</th>
          <th>Slug</th>
          <th>Thứ tự</th>
          <th>Trạng thái</th>
          <th></th>
        </tr>

      </thead>

      <tbody>

        ${categories.map(c => `

          <tr>

            <td>
              <b>${esc(c.name)}</b>
            </td>

            <td>
              ${esc(c.slug)}
            </td>

            <td>
              ${c.sort_order}
            </td>

            <td>

              <span
                class="badge ${c.visible ? "on" : "off"}"
              >
                ${
                  c.visible
                  ? "Hiển thị"
                  : "Đang ẩn"
                }
              </span>

            </td>

            <td class="actions">

              <button
                class="link edit-category"
                data-id="${c.id}"
              >
                Sửa
              </button>

              <button
                class="link danger delete-category"
                data-id="${c.id}"
              >
                Xóa
              </button>

            </td>

          </tr>

        `).join("")}

      </tbody>

    </table>
  `;


  $$(".edit-category")
    .forEach(btn => {

      btn.onclick = () =>
        openCategory(
          Number(btn.dataset.id)
        );

    });


  $$(".delete-category")
    .forEach(btn => {

      btn.onclick = () =>
        deleteCategory(
          Number(btn.dataset.id)
        );

    });
}


function openCategory(id=null){

  editingCategory =
    id
      ? categories.find(
          c => c.id === id
        )
      : null;


  $("#category-modal-title")
    .textContent =
      editingCategory
      ? "Sửa danh mục"
      : "Thêm danh mục";


  $("#category-id").value =
    editingCategory?.id || "";


  $("#category-name").value =
    editingCategory?.name || "";


  $("#category-order").value =
    editingCategory?.sort_order || 0;


  $("#category-image").value =
    editingCategory?.image_url || "";


  $("#category-visible").checked =
    editingCategory
      ? !!editingCategory.visible
      : true;


  openModal(
    "category-modal"
  );
}


/* CATEGORY SAVE */

$("#category-form")
  .addEventListener(
    "submit",
    async e => {

      e.preventDefault();


      const body = {

        name:
          $("#category-name")
            .value
            .trim(),

        sort_order:
          Number(
            $("#category-order")
              .value || 0
          ),

        image_url:
          $("#category-image")
            .value
            .trim(),

        visible:
          $("#category-visible")
            .checked

      };


      try{

        await api(

          editingCategory

            ? `/api/admin/categories?id=${editingCategory.id}`

            : "/api/admin/categories",

          {

            method:
              editingCategory
              ? "PUT"
              : "POST",

            body:
              JSON.stringify(body)

          }

        );


        closeModal(
          "category-modal"
        );


        toast(
          editingCategory
          ? "Đã cập nhật danh mục."
          : "Đã thêm danh mục."
        );


        await loadAll();


      }catch(e){

        toast(
          e.message,
          "error"
        );

      }

    }
  );


/* DELETE CATEGORY */

async function deleteCategory(id){

  const c =
    categories.find(
      x => x.id === id
    );

  if(
    !c ||
    !confirm(
      `Xóa danh mục “${c.name}”?`
    )
  ){
    return;
  }


  try{

    await api(
      `/api/admin/categories?id=${id}`,
      {
        method:"DELETE"
      }
    );


    toast(
      "Đã xóa danh mục."
    );


    await loadAll();

  }catch(e){

    toast(
      e.message,
      "error"
    );

  }
}


/* =========================
   SETTINGS
========================= */

function fillSettings(s){

  [
    "shop_name",
    "tagline",
    "phone",
    "zalo",
    "facebook"
  ].forEach(k => {

    $("#" + k).value =
      s[k] || "";

  });
}


$("#settings-form")
  .addEventListener(
    "submit",
    async e => {

      e.preventDefault();


      const body =
        Object.fromEntries(

          [
            "shop_name",
            "tagline",
            "phone",
            "zalo",
            "facebook"
          ].map(k => [
            k,
            $("#" + k).value
          ])

        );


      try{

        await api(
          "/api/admin/settings",
          {
            method:"PUT",
            body:JSON.stringify(body)
          }
        );


        toast(
          "Đã lưu thông tin shop."
        );

      }catch(e){

        toast(
          e.message,
          "error"
        );

      }

    }
  );


/* =========================
   EVENTS
========================= */

$("#add-product").onclick =
  () => openProduct();

$("#quick-add").onclick =
  () => openProduct();

$("#quick-product").onclick =
  () => openProduct();

$("#add-category").onclick =
  () => openCategory();

$("#quick-category").onclick =
  () => openCategory();


$("#product-search")
  .oninput =
  renderProducts;


$("#product-category-filter")
  .onchange =
  renderProducts;


$$("[data-close]")
  .forEach(btn => {

    btn.onclick =
      () =>
        closeModal(
          btn.dataset.close
        );

  });


$$(".modal")
  .forEach(modal => {

    modal.addEventListener(
      "click",
      e => {

        if(e.target === modal){

          modal.classList.add(
            "hidden"
          );

        }

      }
    );

  });


/* =========================
   ROUTER
========================= */

function route(){

  const hash =
    location.hash
      .replace("#","")
      || "dashboard";


  const allowed = [
    "dashboard",
    "products",
    "categories",
    "settings"
  ];


  const id =
    allowed.includes(hash)
      ? hash
      : "dashboard";


  $$(".page-section")
    .forEach(section => {

      section.classList.toggle(
        "hidden",
        section.id !== id
      );

    });


  $$("[data-nav]")
    .forEach(link => {

      link.classList.toggle(
        "active",
        link.dataset.nav === id
      );

    });
}


window.addEventListener(
  "hashchange",
  route
);


$("#mobile-menu").onclick =
  () =>
    $(".sidebar")
      .classList
      .toggle("open");


/* =========================
   AUTO LOGIN
========================= */

if(token){

  api("/api/admin/dashboard")
    .then(showApp)
    .catch(
      () => logout(false)
    );

}
