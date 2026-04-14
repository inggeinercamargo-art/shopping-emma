-- ============================================================
--  Shopping Emma — Esquema MariaDB
-- ============================================================

CREATE DATABASE IF NOT EXISTS shopping_emma
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE shopping_emma;

-- ── Administradores ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  username   VARCHAR(60)  NOT NULL UNIQUE,
  password   VARCHAR(255) NOT NULL,          -- bcrypt hash
  nombre     VARCHAR(120) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Usuario por defecto: admin / emma2025
INSERT INTO admins (username, password, nombre) VALUES
('admin', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Administrador');

-- ── Categorías ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categorias (
  id     INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL UNIQUE
);

INSERT INTO categorias (nombre) VALUES
('Vestidos'),('Blusas'),('Conjuntos'),('Faldas'),('Pantalones'),('Accesorios');

-- ── Productos ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS productos (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  nombre       VARCHAR(150) NOT NULL,
  descripcion  TEXT,
  categoria_id INT NOT NULL,
  precio       DECIMAL(12,2) NOT NULL,
  tallas       VARCHAR(200) NOT NULL,         -- "XS,S,M,L,XL"
  colores      VARCHAR(300) NOT NULL,         -- "Rojo,Negro,Blanco"
  disponible   TINYINT(1) DEFAULT 1,
  destacado    TINYINT(1) DEFAULT 0,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (categoria_id) REFERENCES categorias(id)
);

-- ── Imágenes de productos ────────────────────────────────────
CREATE TABLE IF NOT EXISTS producto_imagenes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  producto_id INT NOT NULL,
  url         VARCHAR(500) NOT NULL,
  orden       TINYINT DEFAULT 0,
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
);

-- ── Barrios ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS barrios (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  nombre   VARCHAR(120) NOT NULL,
  ciudad   VARCHAR(80)  NOT NULL DEFAULT 'Barranquilla'
);

INSERT INTO barrios (nombre, ciudad) VALUES
-- Barranquilla
('El Prado','Barranquilla'),('Riomar','Barranquilla'),
('Ciudad Jardín','Barranquilla'),('Alto Prado','Barranquilla'),
('La Castellana','Barranquilla'),('Boston','Barranquilla'),
('El Recreo','Barranquilla'),('Villa Country','Barranquilla'),
('Manga','Barranquilla'),('Bellavista','Barranquilla'),
('El Tabor','Barranquilla'),('Los Nogales','Barranquilla'),
('Las Delicias','Barranquilla'),('La Victoria','Barranquilla'),
('San José','Barranquilla'),('Paraíso','Barranquilla'),
('Los Laureles','Barranquilla'),('Cevillar','Barranquilla'),
('Simón Bolívar','Barranquilla'),('Granadillo','Barranquilla'),
('Nuevo Horizonte','Barranquilla'),('La Libertad','Barranquilla'),
('Ciudadela 20 de Julio','Barranquilla'),('El Campestre','Barranquilla'),
('Chiquinquirá','Barranquilla'),('San Isidro','Barranquilla'),
('La Concepción','Barranquilla'),('Lomas del Peyé','Barranquilla'),
-- Soledad
('Centro','Soledad'),('El Oasis','Soledad'),
('Ciudad Bicentenario','Soledad'),('La Esmeralda','Soledad'),
('Villa Estadio','Soledad'),('El Parque','Soledad'),
('La Floresta','Soledad'),('Nuevo Milenio','Soledad'),
('Villa del Rey','Soledad'),('Los Rosales','Soledad');

-- ── Pedidos ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pedidos (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  cliente_nombre  VARCHAR(150) NOT NULL,
  cliente_celular VARCHAR(20)  NOT NULL,
  direccion       VARCHAR(300) NOT NULL,
  barrio_id       INT,
  barrio_otro     VARCHAR(120),              -- si escribe uno nuevo
  ciudad          VARCHAR(80) DEFAULT 'Barranquilla',
  fecha_entrega   DATE NOT NULL,
  total           DECIMAL(12,2) NOT NULL,
  estado          ENUM('pendiente','en_camino','entregado','cancelado') DEFAULT 'pendiente',
  notas           TEXT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (barrio_id) REFERENCES barrios(id) ON DELETE SET NULL
);

-- ── Detalle de pedidos ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS pedido_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id   INT NOT NULL,
  producto_id INT NOT NULL,
  nombre_snap VARCHAR(150) NOT NULL,         -- snapshot al momento de compra
  precio_snap DECIMAL(12,2) NOT NULL,
  talla       VARCHAR(10)  NOT NULL,
  color       VARCHAR(60)  NOT NULL,
  cantidad    INT          NOT NULL DEFAULT 1,
  subtotal    DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (pedido_id)   REFERENCES pedidos(id)   ON DELETE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE RESTRICT
);

-- ── Vistas de reportes ───────────────────────────────────────
CREATE OR REPLACE VIEW v_ventas_dia AS
SELECT
  DATE(p.created_at)         AS fecha,
  COUNT(DISTINCT p.id)       AS pedidos,
  SUM(pi.cantidad)           AS unidades,
  SUM(pi.subtotal)           AS ingresos
FROM pedidos p
JOIN pedido_items pi ON pi.pedido_id = p.id
WHERE p.estado != 'cancelado'
GROUP BY DATE(p.created_at);

CREATE OR REPLACE VIEW v_ventas_mes AS
SELECT
  YEAR(p.created_at)         AS anio,
  MONTH(p.created_at)        AS mes,
  COUNT(DISTINCT p.id)       AS pedidos,
  SUM(pi.cantidad)           AS unidades,
  SUM(pi.subtotal)           AS ingresos
FROM pedidos p
JOIN pedido_items pi ON pi.pedido_id = p.id
WHERE p.estado != 'cancelado'
GROUP BY YEAR(p.created_at), MONTH(p.created_at);

CREATE OR REPLACE VIEW v_ventas_barrio AS
SELECT
  COALESCE(b.nombre, p.barrio_otro, 'Otro') AS barrio,
  COALESCE(b.ciudad, p.ciudad)              AS ciudad,
  COUNT(DISTINCT p.id)                      AS pedidos,
  SUM(pi.cantidad)                          AS unidades,
  SUM(pi.subtotal)                          AS ingresos
FROM pedidos p
LEFT JOIN barrios b  ON b.id = p.barrio_id
JOIN  pedido_items pi ON pi.pedido_id = p.id
WHERE p.estado != 'cancelado'
GROUP BY barrio, ciudad;

CREATE OR REPLACE VIEW v_productos_top AS
SELECT
  pr.id,
  pr.nombre,
  c.nombre  AS categoria,
  SUM(pi.cantidad)  AS unidades_vendidas,
  SUM(pi.subtotal)  AS ingresos
FROM pedido_items pi
JOIN productos pr ON pr.id = pi.producto_id
JOIN categorias c  ON c.id  = pr.categoria_id
JOIN pedidos    p  ON p.id  = pi.pedido_id
WHERE p.estado != 'cancelado'
GROUP BY pr.id, pr.nombre, c.nombre
ORDER BY unidades_vendidas DESC;
