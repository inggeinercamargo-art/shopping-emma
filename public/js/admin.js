/* ═══════════════════════════════════════════════════════════
   Shopping Emma — JS Admin Panel
═══════════════════════════════════════════════════════════ */

const fmt = n => '$' + parseInt(n).toLocaleString('es-CO');
let categorias = [];
let editingImages = [];

// ── Utilidades ───────────────────────────────────────────────
function showToast(msg, type='ok') {
  let t = document.getElementById('adminToast');
  if (!t) { t=document.createElement('div'); t.id='adminToast'; t.className='toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.style.background = type==='err' ? '#c0392b' : '#1a1a1a';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

async function api(url, opts={}) {
  const res = await fetch(url, { headers:{'Content-Type':'application/json'}, ...opts });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error');
  return data;
}

// ── Sesión ───────────────────────────────────────────────────
async function checkSession() {
  try {
    const d = await api('/admin/session');
    if (!d.loggedIn) { window.location.href='/admin/login'; return; }
    document.getElementById('adminName').textContent = d.nombre;
  } catch { window.location.href='/admin/login'; }
}

async function doLogout() {
  await fetch('/admin/logout', {method:'POST'});
  window.location.href = '/admin/login';
}

// ── Navegación ───────────────────────────────────────────────
const TITLES = {
  dashboard:'Resumen', productos:'Productos',
  'nuevo-producto':'Nuevo producto', pedidos:'Pedidos',
  reportes:'Reportes', barrios:'Barrios'
};

function showSection(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`section-${id}`)?.classList.add('active');
  document.querySelector(`.nav-item[data-section="${id}"]`)?.classList.add('active');
  document.getElementById('pageTitle').textContent = TITLES[id] || id;

  // Cargar datos según sección
  if (id === 'dashboard')       loadDashboard();
  if (id === 'productos')       loadAdminProductos();
  if (id === 'nuevo-producto')  resetProductoForm();
  if (id === 'pedidos')         loadPedidos();
  if (id === 'reportes')        showReporte('dia', document.querySelector('.tab'));
  if (id === 'barrios')         loadBarriosList();

  // Sidebar mobile
  document.getElementById('sidebar').classList.remove('open');
}

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => showSection(btn.dataset.section));
});

// ── DASHBOARD ────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const [dias, meses, tops, pedidos] = await Promise.all([
      api('/api/pedidos/reportes/dia'),
      api('/api/pedidos/reportes/mes'),
      api('/api/pedidos/reportes/productos-top'),
      api('/api/pedidos?limit=5')
    ]);

    // Stats
    const hoy       = new Date().toISOString().split('T')[0];
    const diaHoy    = dias.find(d => d.fecha?.split('T')[0] === hoy) || {};
    const mesActual = meses[0] || {};
    const mesAnt    = meses[1] || {};
    const deltaMsg  = mesAnt.ingresos
      ? ((mesActual.ingresos - mesAnt.ingresos) / mesAnt.ingresos * 100).toFixed(1)
      : null;

    document.getElementById('statsGrid').innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Ventas hoy</div>
        <div class="stat-val">${diaHoy.pedidos || 0}</div>
        <div class="stat-delta up">${fmt(diaHoy.ingresos || 0)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Ingresos del mes</div>
        <div class="stat-val">${fmt(mesActual.ingresos || 0)}</div>
        ${deltaMsg ? `<div class="stat-delta ${parseFloat(deltaMsg)>=0?'up':'down'}">${parseFloat(deltaMsg)>=0?'+':''}${deltaMsg}% vs mes ant.</div>` : ''}
      </div>
      <div class="stat-card">
        <div class="stat-label">Pedidos del mes</div>
        <div class="stat-val">${mesActual.pedidos || 0}</div>
        <div class="stat-delta up">${mesActual.unidades || 0} unidades</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Pendientes hoy</div>
        <div class="stat-val">${pedidos.pedidos?.filter(p=>p.estado==='pendiente').length || 0}</div>
        <div class="stat-delta">para entregar</div>
      </div>
    `;

    // Gráfica 7 días
    const last7 = dias.slice(0, 7).reverse();
    const maxV  = Math.max(...last7.map(d => parseFloat(d.ingresos) || 0), 1);
    document.getElementById('chartDia').innerHTML =
      last7.map(d => {
        const pct = Math.round((parseFloat(d.ingresos)||0) / maxV * 100);
        const fecha = new Date(d.fecha).toLocaleDateString('es-CO',{weekday:'short'});
        return `<div class="bar-col">
          <div class="b-val">${fmt(d.ingresos||0)}</div>
          <div class="bar" style="height:${pct}%"></div>
          <div class="b-lbl">${fecha}</div>
        </div>`;
      }).join('');

    // Top productos
    document.getElementById('topProductos').innerHTML =
      `<table><thead><tr><th>Producto</th><th>Unidades</th><th>Ingresos</th></tr></thead><tbody>` +
      (tops.slice(0,6).map(p => `<tr><td>${p.nombre}</td><td>${p.unidades_vendidas}</td><td>${fmt(p.ingresos)}</td></tr>`).join('') || '<tr><td colspan="3" style="color:var(--text-3);text-align:center;padding:1rem">Sin datos aún</td></tr>') +
      '</tbody></table>';

    // Pedidos recientes
    renderTablaPedidos(pedidos.pedidos || [], document.getElementById('pedidosRecientes'), true);
  } catch(e) { console.error(e); }
}

// ── PRODUCTOS ────────────────────────────────────────────────
async function loadAdminProductos() {
  try {
    const data = await api('/api/productos/admin/lista');
    const prods = data.productos || [];
    const search = document.getElementById('searchProductos')?.value?.toLowerCase() || '';
    const filtered = search ? prods.filter(p => p.nombre.toLowerCase().includes(search) || p.categoria.toLowerCase().includes(search)) : prods;

    if (!filtered.length) {
      document.getElementById('tablaProductos').innerHTML = '<p style="padding:2rem;color:var(--text-3);text-align:center">No hay productos</p>';
      return;
    }

    document.getElementById('tablaProductos').innerHTML = `
      <table>
        <thead><tr><th>Imagen</th><th>Producto</th><th>Categoría</th><th>Precio</th><th>Tallas</th><th>Disponible</th><th>Acciones</th></tr></thead>
        <tbody>
          ${filtered.map(p => `
            <tr>
              <td>${p.imagen_principal ? `<img class="td-img" src="${p.imagen_principal}" alt="${p.nombre}">` : '<div class="td-img" style="display:flex;align-items:center;justify-content:center;font-size:20px">👗</div>'}</td>
              <td><strong>${p.nombre}</strong>${p.destacado?'<span class="pill" style="background:#FEF3C7;color:#92400E;margin-left:6px">⭐ Dest.</span>':''}</td>
              <td>${p.categoria}</td>
              <td>${fmt(p.precio)}</td>
              <td><span style="font-size:12px;color:var(--text-2)">${p.tallas}</span></td>
              <td>
                <button class="${p.disponible?'btn-toggle-on':'btn-toggle-off'}"
                  onclick="toggleDisponible(${p.id},${p.disponible})">
                  ${p.disponible ? '✓ Visible' : '✗ Oculto'}
                </button>
              </td>
              <td style="white-space:nowrap">
                <button class="btn-sm btn-edit" onclick="editProducto(${p.id})">Editar</button>
                <button class="btn-sm btn-del" onclick="deleteProducto(${p.id},'${p.nombre.replace(/'/g,"\\'")}')">Eliminar</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch(e) { showToast('Error cargando productos','err'); }
}

async function toggleDisponible(id, current) {
  try {
    await api(`/api/productos/${id}/disponible`, {
      method:'PATCH',
      body: JSON.stringify({ disponible: !current })
    });
    loadAdminProductos();
    showToast(current ? 'Producto ocultado' : 'Producto publicado');
  } catch(e) { showToast(e.message,'err'); }
}

async function deleteProducto(id, nombre) {
  if (!confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) return;
  try {
    await api(`/api/productos/${id}`, { method:'DELETE' });
    showToast('Producto eliminado');
    loadAdminProductos();
  } catch(e) { showToast(e.message,'err'); }
}

async function editProducto(id) {
  try {
    const res = await fetch(`/api/productos/${id}`);
    const p   = await res.json();
    document.getElementById('prodId').value    = p.id;
    document.getElementById('pNombre').value   = p.nombre;
    document.getElementById('pPrecio').value   = p.precio;
    document.getElementById('pTallas').value   = p.tallas;
    document.getElementById('pColores').value  = p.colores;
    document.getElementById('pDesc').value     = p.descripcion || '';
    if (p.disponible) document.getElementById('toggleDisponible').classList.add('on');
    else              document.getElementById('toggleDisponible').classList.remove('on');
    if (p.destacado)  document.getElementById('toggleDestacado').classList.add('on');
    else              document.getElementById('toggleDestacado').classList.remove('on');

    // Select categoría
    await loadCategorias();
    document.getElementById('pCategoria').value = p.categoria_id;

    // Preview imágenes existentes
    editingImages = p.imagenes || [];
    document.getElementById('imgPreviews').innerHTML = editingImages.map(img =>
      `<div class="img-preview-wrap"><img src="${img.url}" alt="img"><span style="font-size:10px;color:var(--text-3)">Existente</span></div>`
    ).join('');

    document.getElementById('formProdTitle').textContent = 'Editar producto';
    document.getElementById('btnSaveProd').textContent   = 'Actualizar producto';
    showSection('nuevo-producto');
  } catch(e) { showToast('Error cargando producto','err'); }
}

function resetProductoForm() {
  document.getElementById('formProducto').reset();
  document.getElementById('prodId').value = '';
  document.getElementById('imgPreviews').innerHTML = '';
  document.getElementById('formProdTitle').textContent = 'Nuevo producto';
  document.getElementById('btnSaveProd').textContent   = 'Guardar producto';
  document.getElementById('toggleDisponible').classList.add('on');
  document.getElementById('toggleDestacado').classList.remove('on');
  editingImages = [];
  loadCategorias();
}

async function loadCategorias() {
  if (categorias.length) {
    fillCatSelect(); return;
  }
  try {
    categorias = await api('/api/productos/categorias/lista');
    fillCatSelect();
  } catch(e) {}
}

function fillCatSelect() {
  const sel = document.getElementById('pCategoria');
  sel.innerHTML = categorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
}

function previewImages(input) {
  const wrap = document.getElementById('imgPreviews');
  wrap.innerHTML = '';
  const files = Array.from(input.files).slice(0,5);
  files.forEach((file, i) => {
    const url  = URL.createObjectURL(file);
    const div  = document.createElement('div');
    div.className = 'img-preview-wrap';
    div.innerHTML = `<img src="${url}" alt="preview"><button class="img-remove" onclick="removePreview(this,${i})">×</button>`;
    wrap.appendChild(div);
  });
}

function removePreview(btn, idx) { btn.parentElement.remove(); }

async function submitProducto(e) {
  e.preventDefault();
  const btn = document.getElementById('btnSaveProd');
  btn.disabled = true; btn.textContent = 'Guardando...';

  try {
    const id   = document.getElementById('prodId').value;
    const fd   = new FormData();
    fd.append('nombre',       document.getElementById('pNombre').value);
    fd.append('descripcion',  document.getElementById('pDesc').value);
    fd.append('categoria_id', document.getElementById('pCategoria').value);
    fd.append('precio',       document.getElementById('pPrecio').value);
    fd.append('tallas',       document.getElementById('pTallas').value);
    fd.append('colores',      document.getElementById('pColores').value);
    fd.append('disponible',   document.getElementById('toggleDisponible').classList.contains('on') ? 1 : 0);
    fd.append('destacado',    document.getElementById('toggleDestacado').classList.contains('on') ? 1 : 0);

    const files = document.getElementById('fileInput').files;
    for (const f of Array.from(files).slice(0,5)) fd.append('imagenes', f);

    const method = id ? 'PUT' : 'POST';
    const url    = id ? `/api/productos/${id}` : '/api/productos';

    const res = await fetch(url, { method, body: fd });
    const data= await res.json();
    if (!res.ok) throw new Error(data.error);

    showToast(id ? 'Producto actualizado' : 'Producto creado');
    showSection('productos');
  } catch(e) {
    showToast(e.message, 'err');
  }
  btn.disabled=false; btn.textContent = document.getElementById('prodId').value ? 'Actualizar producto' : 'Guardar producto';
}

// ── PEDIDOS ──────────────────────────────────────────────────
async function loadPedidos() {
  try {
    const estado = document.getElementById('filterEstado')?.value || '';
    const fecha  = document.getElementById('filterFecha')?.value  || '';
    const params = new URLSearchParams({ limit:50 });
    if (estado) params.set('estado', estado);
    if (fecha)  params.set('fecha',  fecha);
    const data = await api('/api/pedidos?' + params);
    renderTablaPedidos(data.pedidos || [], document.getElementById('tablaPedidos'), false);
  } catch(e) { showToast('Error cargando pedidos','err'); }
}

function renderTablaPedidos(pedidos, container, mini=false) {
  if (!pedidos.length) {
    container.innerHTML = '<p style="padding:2rem;color:var(--text-3);text-align:center">No hay pedidos</p>';
    return;
  }
  container.innerHTML = `
    <table>
      <thead><tr><th>#</th><th>Cliente</th><th>Barrio</th><th>Total</th><th>Entrega</th><th>Estado</th>${mini?'':' <th>Acciones</th>'}</tr></thead>
      <tbody>
        ${pedidos.map(p => `
          <tr>
            <td style="font-weight:500">#${p.id}</td>
            <td>
              <div style="font-weight:500">${p.cliente_nombre}</div>
              <div style="font-size:12px;color:var(--text-3)">${p.cliente_celular}</div>
            </td>
            <td>${p.barrio || '—'}<div style="font-size:11px;color:var(--text-3)">${p.ciudad||''}</div></td>
            <td style="font-weight:500;color:var(--rose)">${fmt(p.total)}</td>
            <td>${new Date(p.fecha_entrega+'T12:00:00').toLocaleDateString('es-CO')}</td>
            <td><span class="pill ${p.estado}">${p.estado.replace('_',' ')}</span></td>
            ${mini ? '' : `<td style="white-space:nowrap">
              <button class="btn-sm btn-edit" onclick="verPedido(${p.id})">Ver</button>
              <select class="btn-sm" style="font-size:12px" onchange="cambiarEstado(${p.id},this.value,this)">
                <option value="">Cambiar estado</option>
                <option value="pendiente">Pendiente</option>
                <option value="en_camino">En camino</option>
                <option value="entregado">Entregado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </td>`}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function verPedido(id) {
  try {
    const p = await api(`/api/pedidos/${id}`);
    document.getElementById('pedidoDetalle').innerHTML = `
      <div style="padding:1.5rem">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.25rem">
          <div><strong>Cliente</strong><br>${p.cliente_nombre}</div>
          <div><strong>Celular</strong><br>${p.cliente_celular}</div>
          <div><strong>Dirección</strong><br>${p.direccion}</div>
          <div><strong>Barrio</strong><br>${p.barrio_nombre} · ${p.ciudad}</div>
          <div><strong>Fecha entrega</strong><br>${new Date(p.fecha_entrega+'T12:00:00').toLocaleDateString('es-CO',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
          <div><strong>Estado</strong><br><span class="pill ${p.estado}">${p.estado.replace('_',' ')}</span></div>
        </div>
        ${p.notas ? `<div style="background:var(--bg);padding:10px 14px;border-radius:8px;font-size:13.5px;margin-bottom:1rem"><strong>Notas:</strong> ${p.notas}</div>` : ''}
        <h4 style="font-family:var(--font-title);font-size:16px;margin-bottom:.75rem">Productos</h4>
        <table>
          <thead><tr><th>Producto</th><th>Talla</th><th>Color</th><th>Cant.</th><th>Subtotal</th></tr></thead>
          <tbody>
            ${(p.items||[]).map(i=>`<tr><td>${i.nombre_snap}</td><td>${i.talla}</td><td>${i.color}</td><td>${i.cantidad}</td><td>${fmt(i.subtotal)}</td></tr>`).join('')}
          </tbody>
        </table>
        <div style="text-align:right;font-size:17px;font-weight:600;color:var(--rose);margin-top:1rem;padding-top:10px;border-top:1px solid var(--border)">Total: ${fmt(p.total)}</div>
      </div>
    `;
    document.getElementById('pedidoModal').classList.add('open');
  } catch(e) { showToast('Error','err'); }
}

function closePedidoModal(e) {
  if (e.target.id==='pedidoModal') document.getElementById('pedidoModal').classList.remove('open');
}

async function cambiarEstado(id, estado, el) {
  if (!estado) return;
  try {
    await api(`/api/pedidos/${id}/estado`, { method:'PATCH', body: JSON.stringify({estado}) });
    showToast('Estado actualizado');
    loadPedidos();
  } catch(e) { showToast(e.message,'err'); }
  el.value = '';
}

// ── REPORTES ─────────────────────────────────────────────────
async function showReporte(tipo, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn?.classList.add('active');
  const cont = document.getElementById('reporteContent');
  cont.innerHTML = '<p style="color:var(--text-3);padding:1rem">Cargando...</p>';

  try {
    if (tipo === 'dia') {
      const rows = await api('/api/pedidos/reportes/dia');
      cont.innerHTML = `<h3 class="card-title">Ventas por día</h3>
        <table><thead><tr><th>Fecha</th><th>Pedidos</th><th>Unidades</th><th>Ingresos</th></tr></thead>
        <tbody>${rows.map(r=>`<tr><td>${new Date(r.fecha+'T12:00:00').toLocaleDateString('es-CO',{weekday:'short',day:'2-digit',month:'short',year:'numeric'})}</td><td>${r.pedidos}</td><td>${r.unidades}</td><td>${fmt(r.ingresos)}</td></tr>`).join('')||'<tr><td colspan="4" style="text-align:center;color:var(--text-3)">Sin datos</td></tr>'}</tbody></table>`;
    }
    if (tipo === 'mes') {
      const rows = await api('/api/pedidos/reportes/mes');
      const meses = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      cont.innerHTML = `<h3 class="card-title">Ventas por mes</h3>
        <table><thead><tr><th>Mes</th><th>Año</th><th>Pedidos</th><th>Unidades</th><th>Ingresos</th></tr></thead>
        <tbody>${rows.map(r=>`<tr><td>${meses[r.mes]}</td><td>${r.anio}</td><td>${r.pedidos}</td><td>${r.unidades}</td><td>${fmt(r.ingresos)}</td></tr>`).join('')||'<tr><td colspan="5" style="text-align:center;color:var(--text-3)">Sin datos</td></tr>'}</tbody></table>`;
    }
    if (tipo === 'barrios') {
      const rows = await api('/api/pedidos/reportes/barrios');
      cont.innerHTML = `<h3 class="card-title">Ventas por barrio</h3>
        <table><thead><tr><th>Barrio</th><th>Ciudad</th><th>Pedidos</th><th>Unidades</th><th>Ingresos</th></tr></thead>
        <tbody>${rows.map(r=>`<tr><td><strong>${r.barrio}</strong></td><td>${r.ciudad}</td><td>${r.pedidos}</td><td>${r.unidades}</td><td>${fmt(r.ingresos)}</td></tr>`).join('')||'<tr><td colspan="5" style="text-align:center;color:var(--text-3)">Sin datos</td></tr>'}</tbody></table>`;
    }
    if (tipo === 'productos') {
      const rows = await api('/api/pedidos/reportes/productos-top');
      cont.innerHTML = `<h3 class="card-title">Productos más vendidos</h3>
        <table><thead><tr><th>#</th><th>Producto</th><th>Categoría</th><th>Unidades</th><th>Ingresos</th></tr></thead>
        <tbody>${rows.map((r,i)=>`<tr><td><strong>${i+1}</strong></td><td>${r.nombre}</td><td>${r.categoria}</td><td>${r.unidades_vendidas}</td><td>${fmt(r.ingresos)}</td></tr>`).join('')||'<tr><td colspan="5" style="text-align:center;color:var(--text-3)">Sin datos</td></tr>'}</tbody></table>`;
    }
  } catch(e) { cont.innerHTML = '<p style="color:var(--red);padding:1rem">Error cargando reporte</p>'; }
}

// ── BARRIOS ───────────────────────────────────────────────────
async function loadBarriosList() {
  try {
    const rows = await api('/api/barrios');
    document.getElementById('listaBarrios').innerHTML = `
      <table><thead><tr><th>Barrio</th><th>Ciudad</th></tr></thead>
      <tbody>${rows.map(b=>`<tr><td>${b.nombre}</td><td>${b.ciudad}</td></tr>`).join('')}</tbody></table>
    `;
  } catch(e) {}
}

async function addBarrio() {
  const nombre  = document.getElementById('barrioNombre').value.trim();
  const ciudad  = document.getElementById('barrioCiudad').value;
  if (!nombre) { showToast('Escribe el nombre del barrio','err'); return; }
  try {
    await api('/api/barrios', { method:'POST', body: JSON.stringify({nombre, ciudad}) });
    showToast('Barrio agregado');
    document.getElementById('barrioNombre').value = '';
    loadBarriosList();
  } catch(e) { showToast(e.message,'err'); }
}

// ── INIT ─────────────────────────────────────────────────────
(async function init() {
  await checkSession();
  await loadCategorias();
  loadDashboard();
})();
