============================================================
NUCLEUS GROWTH EXPERIENCE — Instrucciones de instalación
Sitio Tonny Dager + API + Agenda + CRM + Pagos (ePayco)
============================================================

REQUISITOS
- PHP 8.1+ con extensiones: pdo_mysql, json, mbstring, openssl.
- MySQL 8 / MariaDB 10.4+.
- Apache con mod_rewrite y mod_headers (VPS / WHM / cPanel).
- Acceso a internet en el navegador (Vue se carga vía CDN/importmap).

------------------------------------------------------------
1) SUBIR LOS ARCHIVOS
------------------------------------------------------------
Descomprime el contenido del proyecto DIRECTAMENTE en public_html
(sin carpeta raíz envolvente). Debe verse así:

  public_html/
  ├── index.html        (sitio público — SPA Vue)
  ├── .htaccess
  ├── assets/  app/      (frontend público)
  ├── admin/             (panel administrativo — SPA Vue)
  ├── api/               (API REST PHP)
  ├── core/ config/ storage/ database/   (backend)
  ├── robots.txt sitemap.xml llms.txt manifest.json

------------------------------------------------------------
2) BASE DE DATOS
------------------------------------------------------------
a) Crea una base de datos MySQL y un usuario con permisos.
b) En phpMyAdmin importa, EN ESTE ORDEN:
     1. database/ddl.sql   (estructura: 30 tablas)
     2. database/dml.sql   (datos iniciales: rutas, zonas del Tablero, admin, etc.)
c) Edita config/database.php con host, nombre, usuario y contraseña
   (o define variables de entorno DB_HOST, DB_NAME, DB_USER, DB_PASS).

------------------------------------------------------------
3) CONFIGURACIÓN
------------------------------------------------------------
- config/app.php      -> cambia APP_KEY por una clave secreta larga.
- config/payments.php -> credenciales ePayco (public_key, private_key,
  p_cust_id, p_key). Deja test=true hasta validar.
- config/mail.php     -> email del remitente y del administrador.

SEGURIDAD: si tu VPS lo permite, mueve core/, config/, storage/ y
database/ FUERA de public_html. Si no, ya incluyen .htaccess que
bloquea el acceso directo.

------------------------------------------------------------
4) ACCESO ADMIN
------------------------------------------------------------
Panel:    https://TUDOMINIO/admin
Usuario:  admin@tonnydager.com
Clave:    NucleusAdmin2026!   <-- CÁMBIALA tras el primer ingreso.

------------------------------------------------------------
5) VERIFICACIÓN
------------------------------------------------------------
- Sitio:  https://TUDOMINIO/
- API:    https://TUDOMINIO/api/health  -> {"success":true,"db":true,...}
- Admin:  https://TUDOMINIO/admin
- ePayco: configura la URL de confirmación en tu cuenta:
          https://TUDOMINIO/api/pagos/epayco/confirmacion

Prueba en iPhone, Android, Safari y Chrome.
