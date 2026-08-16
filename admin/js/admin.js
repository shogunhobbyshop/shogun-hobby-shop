const demo=[
{id:1,name:"HG 1/144 Model Kit",price:450000,stock:5},
{id:2,name:"Botanicals Flower",price:320000,stock:10},
{id:3,name:"F1 Diecast 1:64",price:280000,stock:8}
];
const money=n=>new Intl.NumberFormat("vi-VN").format(n)+"đ";
function renderProducts(ps){
 document.querySelector("#product-table").innerHTML='<div class="row"><b>Tên sản phẩm</b><b>Giá</b><b>Tồn kho</b><b>Thao tác</b></div>'+ps.map(p=>`<div class="row"><span>${p.name}</span><span>${money(p.price)}</span><span>${p.stock}</span><span class="actions"><button>Sửa</button><button>Xóa</button></span></div>`).join("");
}
function renderCats(){
 document.querySelector("#cat-table").innerHTML='<div class="row"><b>Gundam</b><span>Danh mục</span><span>Hiển thị</span><span><button>Sửa</button></span></div><div class="row"><b>LEGO</b><span>Danh mục</span><span>Hiển thị</span><span><button>Sửa</button></span></div>';
}
document.querySelector("#new-product").onclick=()=>alert("Bản tiếp theo sẽ mở form thêm sản phẩm và lưu vào D1.");
document.querySelector("#save-settings").onclick=()=>alert("Bản tiếp theo sẽ lưu cài đặt vào D1.");
renderProducts(demo);renderCats();