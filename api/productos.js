const router  = require('express').Router();
const db      = require('../config/db');
const multer  = require('multer');
const sharp   = require('sharp');
const path    = require('path');
const fs      = require('fs');

// ── Multer config ────────────────────────────────────────────
const storage = multer.memoryStorage();
const upload  = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imágenes'));
  }
});

// GET /api/productos — listado público (solo disponibles)
router.get('/', async (req, res) => {
  try {
    const { categoria, buscar, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = 'WHERE p.disponible = 1';
    const params = [];

    if (categoria) {
      where += ' AND c.nombre = ?';
      params.push(categoria);
    }
    if (buscar) {
      where += ' AND (p.nombre LIKE ? OR p.descripcion LIKE ?)';
      params.push(`%${buscar}%`, `%${buscar}%`);
    }

    const [rows] = await db.query(`
      SELECT p.id, p.nombre, p.descripcion, p.precio, p.tallas, p.colores,
             p.destacado, c.nombre AS categoria,
             (SELECT url FROM producto_imagenes
              WHERE producto_id = p.id ORDER BY orden LIMIT 1) AS imagen_principal
      FROM productos p
      JOIN categorias c ON c.id = p.categoria_id
      ${where}
      ORDER BY p.destacado DESC, p.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM productos p
       JOIN categorias c ON c.id = p.categoria_id ${where}`,
      params
    );

    res.json({ productos: rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/productos/:id — detalle con imágenes
router.get('/:id', async (req, res) => {
  try {
    const [[prod]] = await db.query(`
      SELECT p.*, c.nombre AS categoria
      FROM productos p
      JOIN categorias c ON c.id = p.categoria_id
      WHERE p.id = ? AND p.disponible = 1
    `, [req.params.id]);

    if (!prod) return res.status(404).json({ error: 'Producto no encontrado' });

    const [imagenes] = await db.query(
      'SELECT id, url, orden FROM producto_imagenes WHERE producto_id = ? ORDER BY orden',
      [prod.id]
    );

    res.json({ ...prod, imagenes });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/productos/categorias/lista
router.get('/categorias/lista', async (req, res) => {
  try {
    const [cats] = await db.query('SELECT id, nombre FROM categorias ORDER BY nombre');
    res.json(cats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Rutas protegidas (admin) ─────────────────────────────────
const adminAuth = (req, res, next) => {
  if (req.session?.adminId) return next();
  res.status(401).json({ error: 'No autorizado' });
};

// POST /api/productos — crear producto
router.post('/', adminAuth, upload.array('imagenes', 5), async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { nombre, descripcion, categoria_id, precio, tallas, colores, disponible, destacado } = req.body;

    const [result] = await conn.query(`
      INSERT INTO productos (nombre, descripcion, categoria_id, precio, tallas, colores, disponible, destacado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [nombre, descripcion, categoria_id, precio, tallas, colores, disponible || 1, destacado || 0]);

    const prodId = result.insertId;

    if (req.files?.length) {
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const filename = `prod_${prodId}_${Date.now()}_${i}.webp`;
        const outPath  = path.join(__dirname, '..', 'public/images/productos', filename);

        await sharp(file.buffer)
          .resize(800, 1000, { fit: 'cover', position: 'top' })
          .webp({ quality: 82 })
          .toFile(outPath);

        await conn.query(
          'INSERT INTO producto_imagenes (producto_id, url, orden) VALUES (?, ?, ?)',
          [prodId, `/images/productos/${filename}`, i]
        );
      }
    }

    await conn.commit();
    res.json({ success: true, id: prodId });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

// PUT /api/productos/:id — editar producto
router.put('/:id', adminAuth, upload.array('imagenes', 5), async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { nombre, descripcion, categoria_id, precio, tallas, colores, disponible, destacado } = req.body;

    await conn.query(`
      UPDATE productos SET nombre=?, descripcion=?, categoria_id=?, precio=?,
        tallas=?, colores=?, disponible=?, destacado=?
      WHERE id=?
    `, [nombre, descripcion, categoria_id, precio, tallas, colores, disponible, destacado, req.params.id]);

    if (req.files?.length) {
      const [oldImgs] = await conn.query(
        'SELECT url FROM producto_imagenes WHERE producto_id=?', [req.params.id]
      );
      for (const img of oldImgs) {
        const fp = path.join(__dirname, '..', 'public', img.url);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      }
      await conn.query('DELETE FROM producto_imagenes WHERE producto_id=?', [req.params.id]);

      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const filename = `prod_${req.params.id}_${Date.now()}_${i}.webp`;
        const outPath  = path.join(__dirname, '..', 'public/images/productos', filename);
        await sharp(file.buffer)
          .resize(800, 1000, { fit: 'cover', position: 'top' })
          .webp({ quality: 82 })
          .toFile(outPath);
        await conn.query(
          'INSERT INTO producto_imagenes (producto_id, url, orden) VALUES (?, ?, ?)',
          [req.params.id, `/images/productos/${filename}`, i]
        );
      }
    }

    await conn.commit();
    res.json({ success: true });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

// PATCH /api/productos/:id/disponible — toggle disponibilidad
router.patch('/:id/disponible', adminAuth, async (req, res) => {
  try {
    const { disponible } = req.body;
    await db.query('UPDATE productos SET disponible=? WHERE id=?', [disponible ? 1 : 0, req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/productos/:id
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const [imgs] = await db.query(
      'SELECT url FROM producto_imagenes WHERE producto_id=?', [req.params.id]
    );
    for (const img of imgs) {
      const fp = path.join(__dirname, '..', 'public', img.url);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    await db.query('DELETE FROM productos WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/productos/admin/lista — lista completa para admin
router.get('/admin/lista', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const [rows] = await db.query(`
      SELECT p.id, p.nombre, p.precio, p.tallas, p.colores,
             p.disponible, p.destacado, c.nombre AS categoria,
             (SELECT url FROM producto_imagenes WHERE producto_id=p.id ORDER BY orden LIMIT 1) AS imagen_principal
      FROM productos p
      JOIN categorias c ON c.id = p.categoria_id
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `, [parseInt(limit), offset]);
    const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM productos');
    res.json({ productos: rows, total });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
