# 🛍 Shopping Emma — Tienda de Ropa Femenina

Plataforma de ventas con catálogo, carrito, checkout y panel de administración completo.

---

## 🚀 Instalación paso a paso

### 1. Requisitos previos
- **Node.js** v18 o superior → https://nodejs.org
- **MariaDB** 10.6+ o MySQL 8+
- Servidor Ubuntu/Debian recomendado para producción

### 2. Clonar y configurar

```bash
# Entrar a la carpeta del proyecto
cd shopping-emma

# Instalar dependencias
npm install

# Copiar archivo de entorno
cp .env.example .env
```

### 3. Configurar base de datos

Edita el archivo `.env`:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=tu_usuario_mariadb
DB_PASSWORD=tu_contraseña
DB_NAME=shopping_emma
SESSION_SECRET=una_clave_secreta_larga_y_unica
PORT=3000
```

### 4. Crear la base de datos

```bash
# Entrar a MariaDB
mysql -u root -p

# Ejecutar el esquema
SOURCE /ruta/al/proyecto/sql/schema.sql;
# O desde terminal:
mysql -u root -p < sql/schema.sql
```

### 5. Iniciar el servidor

```bash
# Desarrollo (con auto-reload)
npm run dev

# Producción
npm start
```

Abrir en el navegador: **http://localhost:3000**

---

## 🔐 Acceso al panel de administración

URL: **http://localhost:3000/admin**

| Campo    | Valor por defecto |
|----------|-------------------|
| Usuario  | `admin`           |
| Contraseña | `password`     |

> ⚠️ **Importante:** Cambia la contraseña inmediatamente en producción.
> La contraseña actual está hasheada en el SQL. Para cambiarla:

```javascript
// Ejecuta este script una vez para generar el nuevo hash:
const bcrypt = require('bcryptjs');
bcrypt.hash('TU_NUEVA_CONTRASEÑA', 10).then(h => console.log(h));

// Luego actualiza en MariaDB:
// UPDATE admins SET password = 'HASH_GENERADO' WHERE username = 'admin';
```

---

## 📂 Estructura del proyecto

```
shopping-emma/
├── server.js              ← Servidor Express principal
├── .env.example           ← Variables de entorno (copiar a .env)
├── package.json
├── config/
│   └── db.js              ← Conexión MariaDB
├── api/
│   ├── productos.js       ← CRUD productos + imágenes
│   ├── pedidos.js         ← Pedidos + reportes
│   └── barrios.js         ← Barrios Barranquilla/Soledad
├── admin/
│   └── router.js          ← Autenticación admin
├── sql/
│   └── schema.sql         ← Esquema completo de la BD
└── public/
    ├── index.html         ← Tienda cliente
    ├── css/
    │   ├── store.css      ← Estilos tienda
    │   └── admin.css      ← Estilos panel admin
    ├── js/
    │   ├── store.js       ← Lógica tienda + carrito
    │   └── admin.js       ← Panel administración
    ├── admin/
    │   ├── login.html     ← Login administrador
    │   └── index.html     ← Dashboard admin
    └── images/
        └── productos/     ← Imágenes subidas (auto-creada)
```

---

## 🌟 Funcionalidades

### Tienda (clientes)
- Catálogo con filtros por categoría, precio y búsqueda en tiempo real
- Hasta 100 productos con paginación (16 por página)
- Modal de producto con galería de hasta 5 imágenes
- Selector de color, talla y cantidad
- Carrito lateral persistente (localStorage)
- Checkout con validación de fecha (máx. 3 días)
- Listado de barrios de Barranquilla y Soledad con opción "Otro"
- Pago 100% contraentrega

### Panel administrador
- Login seguro con bcrypt
- Dashboard con métricas y gráfica de ventas
- CRUD completo de productos con subida de imágenes (auto-optimizadas a WebP)
- Toggle disponible/no disponible por producto
- Gestión de pedidos con cambio de estado
- Reportes: por día, por mes, por barrio, productos top
- Agregar nuevos barrios

---

## 🌐 Deployment en servidor (Ubuntu)

```bash
# Instalar PM2 para mantener el servidor corriendo
npm install -g pm2

# Iniciar con PM2
pm2 start server.js --name "shopping-emma"
pm2 startup
pm2 save

# Ver logs
pm2 logs shopping-emma
```

### Nginx (proxy reverso recomendado)

```nginx
server {
    listen 80;
    server_name tudominio.com www.tudominio.com;

    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Imágenes con caché
    location /images/ {
        alias /ruta/shopping-emma/public/images/;
        expires 7d;
        add_header Cache-Control "public";
    }
}
```

### SSL con Let's Encrypt
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d tudominio.com
```

---

## 📱 Soporte móvil
El sitio es completamente responsive. Funciona en móviles, tablets y escritorio.

---

**Shopping Emma v1.0** — Desarrollado con Node.js + Express + MariaDB
