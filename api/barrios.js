const router = require('express').Router();
const db     = require('../config/db');

const adminAuth = (req, res, next) => {
  if (req.session?.adminId) return next();
  res.status(401).json({ error: 'No autorizado' });
};

// GET /api/barrios
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, nombre, ciudad FROM barrios ORDER BY ciudad, nombre'
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/barrios — admin puede agregar
router.post('/', adminAuth, async (req, res) => {
  try {
    const { nombre, ciudad } = req.body;
    const [r] = await db.query(
      'INSERT INTO barrios (nombre, ciudad) VALUES (?, ?)',
      [nombre, ciudad || 'Barranquilla']
    );
    res.json({ success: true, id: r.insertId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
