const router = require('express').Router();
const db     = require('../config/db');

const adminAuth = (req, res, next) => {
  if (req.session?.adminId) return next();
  res.status(401).json({ error: 'No autorizado' });
};

// POST /api/pedidos — crear pedido (cliente)
router.post('/', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const {
      cliente_nombre, cliente_celular, direccion,
      barrio_id, barrio_otro, ciudad, fecha_entrega, notas, items
    } = req.body;

    // Validar fecha (máx 3 días)
    const hoy   = new Date();
    const fEnt  = new Date(fecha_entrega);
    hoy.setHours(0,0,0,0);
    const diffDays = Math.ceil((fEnt - hoy) / 86400000);
    if (diffDays < 1 || diffDays > 3) {
      await conn.rollback();
      return res.status(400).json({ error: 'La fecha de entrega debe ser entre 1 y 3 días desde hoy.' });
    }

    if (!items || !items.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'El pedido no tiene productos.' });
    }

    // Calcular total
    let total = 0;
    for (const item of items) {
      total += parseFloat(item.precio) * parseInt(item.cantidad);
    }

    const [result] = await conn.query(`
      INSERT INTO pedidos
        (cliente_nombre, cliente_celular, direccion, barrio_id, barrio_otro, ciudad, fecha_entrega, total, notas)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      cliente_nombre, cliente_celular, direccion,
      barrio_id || null, barrio_otro || null,
      ciudad || 'Barranquilla', fecha_entrega, total, notas || null
    ]);

    const pedidoId = result.insertId;

    for (const item of items) {
      const subtotal = parseFloat(item.precio) * parseInt(item.cantidad);
      await conn.query(`
        INSERT INTO pedido_items
          (pedido_id, producto_id, nombre_snap, precio_snap, talla, color, cantidad, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [pedidoId, item.producto_id, item.nombre, item.precio, item.talla, item.color, item.cantidad, subtotal]);
    }

    await conn.commit();
    res.json({ success: true, pedido_id: pedidoId, total });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

// GET /api/pedidos — lista admin
router.get('/', adminAuth, async (req, res) => {
  try {
    const { estado, fecha, page = 1, limit = 30 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = 'WHERE 1=1';
    const params = [];

    if (estado) { where += ' AND p.estado=?'; params.push(estado); }
    if (fecha)  { where += ' AND DATE(p.created_at)=?'; params.push(fecha); }

    const [rows] = await db.query(`
      SELECT p.id, p.cliente_nombre, p.cliente_celular, p.direccion,
             COALESCE(b.nombre, p.barrio_otro) AS barrio,
             p.ciudad, p.fecha_entrega, p.total, p.estado, p.created_at,
             COUNT(pi.id) AS num_items
      FROM pedidos p
      LEFT JOIN barrios b ON b.id = p.barrio_id
      LEFT JOIN pedido_items pi ON pi.pedido_id = p.id
      ${where}
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM pedidos p ${where}`, params
    );

    res.json({ pedidos: rows, total });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/pedidos/:id — detalle
router.get('/:id', adminAuth, async (req, res) => {
  try {
    const [[pedido]] = await db.query(`
      SELECT p.*, COALESCE(b.nombre, p.barrio_otro) AS barrio_nombre
      FROM pedidos p LEFT JOIN barrios b ON b.id=p.barrio_id
      WHERE p.id=?
    `, [req.params.id]);

    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

    const [items] = await db.query(
      'SELECT * FROM pedido_items WHERE pedido_id=?', [req.params.id]
    );

    res.json({ ...pedido, items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/pedidos/:id/estado
router.patch('/:id/estado', adminAuth, async (req, res) => {
  try {
    const { estado } = req.body;
    const valid = ['pendiente','en_camino','entregado','cancelado'];
    if (!valid.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });
    await db.query('UPDATE pedidos SET estado=? WHERE id=?', [estado, req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── REPORTES ─────────────────────────────────────────────────

// GET /api/pedidos/reportes/dia
router.get('/reportes/dia', adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM v_ventas_dia ORDER BY fecha DESC LIMIT 30'
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/pedidos/reportes/mes
router.get('/reportes/mes', adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM v_ventas_mes ORDER BY anio DESC, mes DESC LIMIT 24'
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/pedidos/reportes/barrios
router.get('/reportes/barrios', adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM v_ventas_barrio ORDER BY ingresos DESC'
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/pedidos/reportes/productos-top
router.get('/reportes/productos-top', adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM v_productos_top LIMIT 20');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
