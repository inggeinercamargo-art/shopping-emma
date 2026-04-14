/* ═══════════════════════════════════════════════════════════
   Shopping Emma — JS Tienda
═══════════════════════════════════════════════════════════ */

// ── Estado ───────────────────────────────────────────────────
const state = {
  cart:      JSON.parse(localStorage.getItem('emma_cart') || '[]'),
  page:      1,
  total:     0,
  catFilter: '',
  priceMin:  null,
  priceMax:  null,
  search:    '',
  currentProduct: null,
  currentQty:     1,
  barrios:   []
};

// Colores CSS para swatches
const COLOR_MAP = {
  'Rojo':'#D4537E','Negro':'#1a1a1a','Blanco':'#f5f5f5','Azul':'#378ADD',
  'Verde':'#3B9B5A','Amarillo':'#F5C131','Naranja':'#E8773A','Rosa':'#F4A3BE',
  'Morado':'#8B5CF6','Café':'#8B6345','Beige':'#D4B896','Gris':'#9CA3AF',
  'Coral':'#E8775A','Turquesa':'#2ABFBF','Vino':'#6B2D48','Fucsia':'#D4537E'
};

function getColorCSS(name) {
  const n = name.trim();
  return COLOR_MAP[n] || ('#' + [...n].reduce((h,c)=>((h<<5)-h+c.charCodeAt(0))|0,0).toString(16).padStart(6,'0').slice(-6));
}

// ── Formato precio ────────────────────────────────────────────
const fmt = n => '$' + parseInt(n).toLocaleString('es-CO');

// ── Cargar categorías ─────────────────────────────────────────
async function loadCategorias() {
  try {
    const res  = await fetch('/api/productos/categorias/lista');
    const cats = await res.json();
    const cont = document.getElementById('catFilters');
    cont.innerHTML = cats.map(c => `
      <label class="filter-check" data-cat="${c.nombre}">
        <input type="radio" name="cat" value="${c.nombre}"> ${c.nombre}
      </label>
    `).join('');
    cont.querySelectorAll('.filter-check').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll('.filter-check').forEach(x => x.classList.remove('active-check'));
        el.classList.add('active-check');
        state.catFilter = el.dataset.cat;
        state.page = 1;
        loadProducts();
      });
    });
  } catch(e) { console.error(e); }
}

// ── Cargar barrios ────────────────────────────────────────────
async function loadBarrios() {
  try {
    const res = await fetch('/api/barrios');
    state.barrios = await res.json();
    const optBq = document.getElementById('optBarranquilla');
    const optSol= document.getElementById('optSoledad');
    state.barrios.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = b.nombre;
      if (b.ciudad === 'Soledad') optSol.appendChild(opt);
      else optBq.appendChild(opt);
    });
  } catch(e) { console.error(e); }
}

// ── Cargar productos ──────────────────────────────────────────
async function loadProducts() {
  const grid = document.getElementById('productsGrid');
  grid.innerHTML = '<div class="loading-grid">' + Array(6).fill('<div class="skeleton-card"></div>').join('') + '</div>';

  const params = new URLSearchParams({ page: state.page, limit: 16 });
  if (state.catFilter) params.set('categoria', state.catFilter);
  if (state.search)    params.set('buscar', state.search);

  try {
    const res  = await fetch('/api/productos?' + params);
    const data = await res.json();

    state.total = data.total;
    document.getElementById('productsCount').textContent =
      `${data.total} producto${data.total !== 1 ? 's' : ''}`;

    if (!data.productos.length) {
      grid.innerHTML = '<p style="color:var(--text-3);padding:2rem;text-align:center;grid-column:1/-1">No se encontraron productos.</p>';
      document.getElementById('pagination').innerHTML = '';
      return;
    }

    // Sort
    const sort = document.getElementById('sortSelect').value;
    let prods = [...data.productos];
    if (sort === 'precio_asc')  prods.sort((a,b) => a.precio - b.precio);
    if (sort === 'precio_desc') prods.sort((a,b) => b.precio - a.precio);
    if (sort === 'destacado')   prods.sort((a,b) => b.destacado - a.destacado);

    // Price filter (client-side)
    if (state.priceMin) prods = prods.filter(p => p.precio >= state.priceMin);
    if (state.priceMax) prods = prods.filter(p => p.precio <= state.priceMax);

    grid.innerHTML = prods.map(p => renderCard(p)).join('');
    renderPagination(data.total, data.limit);
  } catch(e) {
    grid.innerHTML = '<p style="color:#e55;padding:2rem;grid-column:1/-1">Error cargando productos.</p>';
  }
}

function renderCard(p) {
  const colors = p.colores ? p.colores.split(',').slice(0,4).map(c =>
    `<span class="color-swatch" style="background:${getColorCSS(c)}" title="${c.trim()}"></span>`
  ).join('') : '';
  const sizes = p.tallas ? p.tallas.split(',').slice(0,5).map(s =>
    `<span class="size-chip">${s.trim()}</span>`
  ).join('') : '';
  const img = p.imagen_principal
    ? `<img src="${p.imagen_principal}" alt="${p.nombre}" loading="lazy">`
    : `<div class="card-img-placeholder">👗</div>`;
  const badge = p.destacado ? '<span class="card-badge badge-dest">Destacado</span>' : '<span class="card-badge">Nuevo</span>';

  return `
  <article class="product-card" onclick="openProductModal(${p.id})">
    <div class="card-img-wrap">${img}${badge}</div>
    <div class="card-body">
      <p class="card-cat">${p.categoria}</p>
      <h3 class="card-name">${p.nombre}</h3>
      <p class="card-price">${fmt(p.precio)}</p>
      <div class="card-colors">${colors}</div>
      <div class="card-sizes">${sizes}</div>
      <button class="btn-ver">Ver producto</button>
    </div>
  </article>`;
}

function renderPagination(total, limit) {
  const pages = Math.ceil(total / limit);
  if (pages <= 1) { document.getElementById('pagination').innerHTML=''; return; }
  let html = '';
  for (let i = 1; i <= pages; i++) {
    html += `<button class="page-btn${i===state.page?' active':''}" onclick="goPage(${i})">${i}</button>`;
  }
  document.getElementById('pagination').innerHTML = html;
}

function goPage(n) { state.page = n; loadProducts(); window.scrollTo({top:400,behavior:'smooth'}); }

// Debounce búsqueda
let searchTimeout;
function debounceSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => { state.search = document.getElementById('searchInput').value; state.page=1; loadProducts(); }, 400);
}

function applyPriceFilter() {
  state.priceMin = parseFloat(document.getElementById('precioMin').value) || null;
  state.priceMax = parseFloat(document.getElementById('precioMax').value) || null;
  loadProducts();
}

function clearFilters() {
  state.catFilter=''; state.search=''; state.priceMin=null; state.priceMax=null; state.page=1;
  document.getElementById('searchInput').value = '';
  document.getElementById('precioMin').value = '';
  document.getElementById('precioMax').value = '';
  document.querySelectorAll('.filter-check').forEach(x => x.classList.remove('active-check'));
  document.querySelector('.filter-check[data-cat=""]')?.classList.add('active-check');
  loadProducts();
}

// ── Modal producto ────────────────────────────────────────────
async function openProductModal(id) {
  try {
    const res  = await fetch(`/api/productos/${id}`);
    const prod = await res.json();
    state.currentProduct = prod;
    state.currentQty = 1;

    document.getElementById('modalCat').textContent  = prod.categoria;
    document.getElementById('modalName').textContent = prod.nombre;
    document.getElementById('modalPrice').textContent= fmt(prod.precio);
    document.getElementById('modalDesc').textContent = prod.descripcion || '';
    document.getElementById('qtyVal').textContent    = '1';

    // Imágenes
    const mainImg = document.getElementById('mainImg');
    if (prod.imagenes?.length) {
      mainImg.src = prod.imagenes[0].url;
      mainImg.alt = prod.nombre;
      document.getElementById('thumbsRow').innerHTML = prod.imagenes.map((img, i) =>
        `<img src="${img.url}" alt="${prod.nombre}" class="thumb-img${i===0?' active':''}"
         onclick="selectThumb(this,'${img.url}')">`
      ).join('');
    } else {
      mainImg.src = ''; mainImg.alt = '';
      document.getElementById('thumbsRow').innerHTML = '';
    }

    // Colores
    const colors = prod.colores ? prod.colores.split(',') : [];
    document.getElementById('colorPicker').innerHTML = colors.map((c,i) =>
      `<div class="color-opt${i===0?' active':''}" style="background:${getColorCSS(c)}"
       title="${c.trim()}" data-color="${c.trim()}"
       onclick="selectColor(this,'${c.trim()}')"></div>`
    ).join('');
    document.getElementById('selectedColorName').textContent = colors[0]?.trim() || '';

    // Tallas
    const sizes = prod.tallas ? prod.tallas.split(',') : [];
    document.getElementById('sizePicker').innerHTML = sizes.map((s,i) =>
      `<button class="size-opt${i===0?' active':''}" onclick="selectSize(this)">${s.trim()}</button>`
    ).join('');

    document.getElementById('productModal').classList.add('open');
    document.body.style.overflow = 'hidden';
  } catch(e) {
    showToast('Error cargando el producto');
  }
}

function selectThumb(el, url) {
  document.querySelectorAll('.thumb-img').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('mainImg').src = url;
}

function selectColor(el, name) {
  document.querySelectorAll('.color-opt').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('selectedColorName').textContent = name;
}

function selectSize(el) {
  document.querySelectorAll('.size-opt').forEach(s => s.classList.remove('active'));
  el.classList.add('active');
}

function changeQty(d) {
  state.currentQty = Math.max(1, state.currentQty + d);
  document.getElementById('qtyVal').textContent = state.currentQty;
}

function closeModal(e) {
  if (e.target.id === 'productModal') closeModalBtn();
}
function closeModalBtn() {
  document.getElementById('productModal').classList.remove('open');
  document.body.style.overflow = '';
}

// ── Carrito ───────────────────────────────────────────────────
function saveCart() {
  localStorage.setItem('emma_cart', JSON.stringify(state.cart));
  updateCartCount();
}

function updateCartCount() {
  const total = state.cart.reduce((s, i) => s + i.cantidad, 0);
  document.getElementById('cartCount').textContent = total;
}

function addToCart() {
  const prod    = state.currentProduct;
  const color   = document.querySelector('.color-opt.active')?.dataset?.color || (prod.colores?.split(',')[0]?.trim() || '');
  const talla   = document.querySelector('.size-opt.active')?.textContent?.trim() || (prod.tallas?.split(',')[0]?.trim() || '');
  const key     = `${prod.id}_${color}_${talla}`;
  const exists  = state.cart.find(i => i.key === key);

  if (exists) {
    exists.cantidad += state.currentQty;
  } else {
    state.cart.push({
      key, producto_id: prod.id,
      nombre: prod.nombre,
      precio: prod.precio,
      imagen: prod.imagenes?.[0]?.url || '',
      color, talla,
      cantidad: state.currentQty
    });
  }
  saveCart();
  renderCart();
  closeModalBtn();
  showToast('Producto agregado al carrito');
}

function renderCart() {
  const cont = document.getElementById('cartItems');
  const foot = document.getElementById('cartFooter');

  if (!state.cart.length) {
    cont.innerHTML = '<div class="cart-empty">Tu carrito está vacío</div>';
    foot.innerHTML = '';
    return;
  }

  cont.innerHTML = state.cart.map(item => `
    <div class="cart-item">
      ${item.imagen ? `<img src="${item.imagen}" class="cart-item-img" alt="${item.nombre}">` : `<div class="cart-item-img" style="display:flex;align-items:center;justify-content:center;font-size:28px">👗</div>`}
      <div>
        <p class="ci-name">${item.nombre}</p>
        <p class="ci-detail">${item.talla} · ${item.color}</p>
        <p class="ci-price">${fmt(item.precio * item.cantidad)}</p>
        <div class="ci-qty">
          <button onclick="updateItemQty('${item.key}',-1)">−</button>
          <span>${item.cantidad}</span>
          <button onclick="updateItemQty('${item.key}',1)">+</button>
        </div>
      </div>
      <button class="btn-remove" onclick="removeItem('${item.key}')">×</button>
    </div>
  `).join('');

  const total = state.cart.reduce((s,i) => s + i.precio * i.cantidad, 0);
  foot.innerHTML = `
    <div class="cart-total-row"><span>Total</span><span>${fmt(total)}</span></div>
    <button class="btn-checkout" onclick="openCheckout()">Confirmar pedido →</button>
  `;
}

function updateItemQty(key, d) {
  const item = state.cart.find(i => i.key === key);
  if (!item) return;
  item.cantidad = Math.max(1, item.cantidad + d);
  saveCart(); renderCart();
}

function removeItem(key) {
  state.cart = state.cart.filter(i => i.key !== key);
  saveCart(); renderCart();
}

function toggleCart() {
  const panel   = document.getElementById('cartPanel');
  const overlay = document.getElementById('cartOverlay');
  const open    = panel.classList.toggle('open');
  overlay.classList.toggle('open', open);
  document.body.style.overflow = open ? 'hidden' : '';
  if (open) renderCart();
}

document.getElementById('cartBtn').addEventListener('click', toggleCart);

// ── Checkout ──────────────────────────────────────────────────
function openCheckout() {
  // Cerrar carrito
  document.getElementById('cartPanel').classList.remove('open');
  document.getElementById('cartOverlay').classList.remove('open');

  // Resumen
  const total = state.cart.reduce((s,i) => s + i.precio * i.cantidad, 0);
  document.getElementById('checkoutSummary').innerHTML = `
    <h3 class="summary-title">Resumen del pedido</h3>
    ${state.cart.map(i => `<div class="summary-item"><span>${i.nombre} (${i.talla}, ${i.color}) ×${i.cantidad}</span><span>${fmt(i.precio*i.cantidad)}</span></div>`).join('')}
    <div class="summary-total"><span>Total a pagar</span><span>${fmt(total)}</span></div>
    <p style="font-size:12px;color:var(--text-3);margin-top:8px">Pago contraentrega al recibir</p>
  `;

  // Fechas
  const today = new Date();
  const max3  = new Date(); max3.setDate(max3.getDate()+3);
  const min1  = new Date(); min1.setDate(min1.getDate()+1);
  const fmt2  = d => d.toISOString().split('T')[0];
  const dateInput = document.getElementById('cFecha');
  dateInput.min   = fmt2(min1);
  dateInput.max   = fmt2(max3);

  document.getElementById('checkoutContent').style.display = 'block';
  document.getElementById('checkoutSuccess').style.display = 'none';
  document.getElementById('checkoutOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCheckout() {
  document.getElementById('checkoutOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function toggleBarrioOtro() {
  const val = document.getElementById('cBarrioSelect').value;
  const isOtro = val === 'otro';
  document.getElementById('barrioOtroGroup').style.display = isOtro ? 'block' : 'none';
  document.getElementById('ciudadGroup').style.display = isOtro ? 'block' : 'flex';
  if (isOtro) {
    document.getElementById('cBarrioOtro').required = true;
  } else {
    document.getElementById('cBarrioOtro').required = false;
  }
}

async function submitOrder(e) {
  e.preventDefault();
  const btn = document.getElementById('btnConfirm');
  btn.disabled = true; btn.textContent = 'Enviando...';

  const barrioSel = document.getElementById('cBarrioSelect').value;
  const isOtro    = barrioSel === 'otro';

  const body = {
    cliente_nombre:  document.getElementById('cNombre').value,
    cliente_celular: document.getElementById('cCelular').value,
    direccion:       document.getElementById('cDireccion').value,
    barrio_id:       isOtro ? null : (barrioSel || null),
    barrio_otro:     isOtro ? document.getElementById('cBarrioOtro').value : null,
    ciudad:          document.getElementById('cCiudad').value || 'Barranquilla',
    fecha_entrega:   document.getElementById('cFecha').value,
    notas:           document.getElementById('cNotas').value,
    items: state.cart.map(i => ({
      producto_id: i.producto_id,
      nombre:      i.nombre,
      precio:      i.precio,
      talla:       i.talla,
      color:       i.color,
      cantidad:    i.cantidad
    }))
  };

  try {
    const res  = await fetch('/api/pedidos', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Error al procesar pedido');

    // Éxito
    document.getElementById('checkoutContent').style.display = 'none';
    document.getElementById('successNum').textContent = `Pedido #${data.pedido_id}`;
    document.getElementById('checkoutSuccess').style.display = 'block';
    state.cart = [];
    saveCart();
    renderCart();
  } catch(err) {
    showToast(err.message);
    btn.disabled = false; btn.textContent = 'Confirmar pedido';
  }
}

function resetCheckout() {
  closeCheckout();
  document.getElementById('checkoutForm').reset();
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ── Nav links ──────────────────────────────────────────────────
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', e => {
    const cat = link.dataset.cat;
    if (cat !== undefined) {
      e.preventDefault();
      state.catFilter = cat;
      state.page = 1;
      document.querySelectorAll('.filter-check').forEach(x => x.classList.remove('active-check'));
      loadProducts();
      document.getElementById('catalogo').scrollIntoView({ behavior:'smooth' });
    }
  });
});

// ── Init ──────────────────────────────────────────────────────
(async function init() {
  updateCartCount();
  await loadCategorias();
  await loadBarrios();
  await loadProducts();
})();
