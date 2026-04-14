const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const db      = require('../config/db');
const path    = require('path');

// ── Middleware auth ──────────────────────────────────────────
const requireAdmin = (req, res, next) => {
  if (req.session?.adminId) return next();
  res.redirect('/admin/login');
};

// ── Login ────────────────────────────────────────────────────
router.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/login.html'));
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const [[admin]] = await db.query(
      'SELECT * FROM admins WHERE username=?', [username]
    );

    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    req.session.adminId   = admin.id;
    req.session.adminName = admin.nombre;
    res.json({ success: true, nombre: admin.nombre });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// ── API: verificar sesión ─────────────────────────────────────
router.get('/session', (req, res) => {
  if (req.session?.adminId) {
    res.json({ loggedIn: true, nombre: req.session.adminName });
  } else {
    res.json({ loggedIn: false });
  }
});

// ── Panel admin (SPA) ─────────────────────────────────────────
router.get('/', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/index.html'));
});

router.get('/dashboard', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/index.html'));
});

module.exports = router;
