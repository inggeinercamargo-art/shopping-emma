require('dotenv').config();
const express  = require('express');
const session  = require('express-session');
const flash    = require('connect-flash');
const path     = require('path');
const fs       = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Carpeta de uploads ───────────────────────────────────────
const uploadDir = path.join(__dirname, 'public/images/productos');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ── Middlewares ──────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret:            process.env.SESSION_SECRET || 'emma_secret',
  resave:            false,
  saveUninitialized: false,
  cookie:            { maxAge: 8 * 60 * 60 * 1000 }  // 8 horas
}));
app.use(flash());

// ── Motor de plantillas ──────────────────────────────────────
app.set('view engine', 'html');

// ── Rutas API (tienda pública) ───────────────────────────────
app.use('/api/productos',  require('./api/productos'));
app.use('/api/pedidos',    require('./api/pedidos'));
app.use('/api/barrios',    require('./api/barrios'));

// ── Rutas Admin ──────────────────────────────────────────────
app.use('/admin',          require('./admin/router'));

// ── Tienda pública ───────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── 404 ──────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.listen(PORT, () => {
  console.log(`\n✅ Shopping Emma corriendo en http://localhost:${PORT}`);
  console.log(`   Panel admin: http://localhost:${PORT}/admin\n`);
});
